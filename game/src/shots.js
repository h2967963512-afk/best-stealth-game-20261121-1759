// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by an
// autopilot that pathfinds on the tile grid (head for the nearest seal, or
// the exit once they are all taken; back away from any warden that has
// started to notice you), so the frame is what a real game looks like and
// the same seed always gives the same frame. No state here is faked: every
// meter, patrol and seal comes out of stepWorld.
import { TILE } from './config.js';
import { createWorld, levelScore, stepWorld } from './world.js';
import { SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const STEP = 1 / 60;
const START_SECONDS = 2;
const PLAY_SECONDS = 20;
const END_SECONDS = 240;

/** Shortest walkable path between two world points, as tile centres. */
function bfsPath(level, from, to) {
  const key = (c, r) => `${c},${r}`;
  const start = [Math.floor(from.x / TILE), Math.floor(from.y / TILE)];
  const goal = [Math.floor(to.x / TILE), Math.floor(to.y / TILE)];
  const prev = new Map([[key(...start), null]]);
  const queue = [start];
  while (queue.length) {
    const [c, r] = queue.shift();
    if (c === goal[0] && r === goal[1]) {
      const path = [];
      let cur = key(c, r);
      while (cur) {
        const [pc, pr] = cur.split(',').map(Number);
        path.unshift({ x: (pc + 0.5) * TILE, y: (pr + 0.5) * TILE });
        cur = prev.get(cur);
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = key(c + dc, r + dr);
      if (prev.has(nk) || level.solids.has(nk)) continue;
      if (c + dc < 0 || c + dc >= 24 || r + dr < 0 || r + dr >= 15) continue;
      prev.set(nk, key(c, r));
      queue.push([c + dc, r + dr]);
    }
  }
  return null;
}

/** Where the autopilot wants to go: the nearest seal, or the exit. */
function autopilotTarget(state) {
  if (state.sealsTaken === state.seals.length) return state.level.exit;
  let best = null;
  let bestDistance = Infinity;
  for (const seal of state.seals) {
    if (seal.taken) continue;
    const distance = Math.hypot(seal.x - state.player.x, seal.y - state.player.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = seal;
    }
  }
  return best;
}

/**
 * One step of the autopilot. It follows the pathfinder's route to its target,
 * unless a warden has started to notice it — then it backs away from that
 * warden until the meter calms down.
 */
function autopilotInput(state) {
  const player = state.player;
  const nervous = state.guards.some((guard) => guard.meter > 0.15);
  for (const guard of state.guards) {
    if (guard.meter > 0.35) {
      const dx = player.x - guard.x;
      const dy = player.y - guard.y;
      const length = Math.hypot(dx, dy) || 1;
      return { moveX: dx / length, moveY: dy / length, run: false, sneak: true, pebble: null };
    }
  }
  const target = autopilotTarget(state);
  const path = bfsPath(state.level, player, target);
  if (!path || path.length < 2) return { moveX: 0, moveY: 0, run: false, sneak: nervous, pebble: null };
  const point = path[1];
  const dx = point.x - player.x;
  const dy = point.y - player.y;
  const length = Math.hypot(dx, dy);
  if (length < 4) return { moveX: 0, moveY: 0, run: false, sneak: nervous, pebble: null };
  return { moveX: dx / length, moveY: dy / length, run: false, sneak: nervous, pebble: null };
}

function playForward(levelIndex, seconds) {
  const state = createWorld(levelIndex);
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.caught || state.cleared) break;
    const input = autopilotInput(state);
    if (input.moveX !== 0 || input.moveY !== 0) {
      state.player.faceAngle = Math.atan2(input.moveY, input.moveX);
    }
    stepWorld(state, input, STEP);
  }
  return state;
}

/** Build one screenshot scene: the world, which screen to draw over it, and the HUD numbers. */
export function buildShot(name) {
  if (name === 'start') {
    const world = playForward(0, START_SECONDS);
    return { world, screen: SCREEN_TITLE, score: 0, lives: 3, fx: [] };
  }
  if (name === 'play') {
    // A mid-game frame: keep shortening the run until the courier survives it.
    for (const seconds of [PLAY_SECONDS, 14, 10, 7]) {
      const world = playForward(1, seconds);
      if (!world.caught) return { world, screen: SCREEN_PLAY, score: 0, lives: 3, fx: [] };
    }
    const world = playForward(1, 7);
    return { world, screen: SCREEN_PLAY, score: 0, lives: 3, fx: [] };
  }
  if (name === 'end') {
    // The finale: the courier finishing the hardest level, if it can.
    for (const levelIndex of [2, 1, 0]) {
      const world = playForward(levelIndex, END_SECONDS);
      if (world.cleared) {
        const breakdown = levelScore(world);
        return { world, screen: SCREEN_CLEAR, score: breakdown.total, lives: 3, fx: [], breakdown };
      }
    }
    const world = playForward(2, 60);
    return { world, screen: SCREEN_PLAY, score: 0, lives: 3, fx: [] };
  }
  // Unknown scene name: show the title over level one.
  const world = createWorld(0);
  return { world, screen: SCREEN_TITLE, score: 0, lives: 3, fx: [] };
}
