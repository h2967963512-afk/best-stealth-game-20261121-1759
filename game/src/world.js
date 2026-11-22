// Shadow Courier — the simulation: the player, the wardens, what they can see,
// what they can hear, and what counts as winning or being caught. No drawing
// here, no sound here: stepWorld takes an input and returns the events the
// frame caused, and main.js turns those into sound and screens.
import { FIELD, GAME, GUARD, LIGHT, NOISE, PLAYER, TILE } from './config.js';
import { LEVELS } from './levels.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_INVESTIGATE = 'investigate';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

/** Tile key for a world position. */
export function tileKey(x, y) {
  return `${Math.floor(x / TILE)},${Math.floor(y / TILE)}`;
}

function tileCentreOf(col, row) {
  return { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
}

/** Fresh state for a level: the player at the spawn, every warden on patrol. */
export function createWorld(levelIndex) {
  const level = LEVELS[levelIndex];
  const guards = level.guards.map((guard) => ({
    x: guard.x,
    y: guard.y,
    facing: 0,
    state: GUARD_PATROL,
    waypoint: 1 % guard.waypoints.length,
    waypoints: guard.waypoints,
    meter: 0,
    lastSeen: null,
    unseenFor: 0,
    lookTimer: 0,
    scanDir: 1,
    stuckFor: 0,
  }));
  return {
    levelIndex,
    level,
    time: 0,
    player: {
      x: level.spawn.x,
      y: level.spawn.y,
      moving: false,
      running: false,
      sneaking: false,
      stepTimer: 0,
    },
    guards,
    seals: level.seals.map((seal) => ({ ...seal })),
    sealsTaken: 0,
    pebbles: [],
    pebblesLeft: NOISE.pebbleCount,
    pebblesThrown: 0,
    exitOpen: false,
    spotted: false, // any warden ever grew suspicious: no ghost bonus
    alarm: false, // any warden is chasing right now
    caught: false,
    cleared: false,
    events: [],
  };
}

/** True when the point sits inside a solid tile (wall or crate). */
export function isSolid(level, x, y) {
  if (x < 0 || y < 0 || x >= FIELD.width || y >= FIELD.height) return true;
  return level.solids.has(tileKey(x, y));
}

/** True when the point is on a shadow tile. */
function inShadow(level, x, y) {
  return level.shadows.has(tileKey(x, y));
}

/** True when the point lies in a lamp's pool of light. */
function inLampLight(level, x, y) {
  for (const lamp of level.lamps) {
    const dx = x - lamp.x;
    const dy = y - lamp.y;
    if (dx * dx + dy * dy < LIGHT.lampRadius * LIGHT.lampRadius) return true;
  }
  return false;
}

/** How much easier the player is to see where they stand: shadow hides, lamps expose. */
export function visibilityFactor(level, x, y) {
  if (inShadow(level, x, y)) return LIGHT.shadowFactor;
  if (inLampLight(level, x, y)) return LIGHT.lampFactor;
  return 1;
}

/** Straight-line sight between two points: blocked when a sample lands in a solid tile. */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 8));
  for (let i = 1; i < steps; i += 1) {
    if (isSolid(level, x0 + (dx * i) / steps, y0 + (dy * i) / steps)) return false;
  }
  return true;
}

/** Move a circle through the level, sliding along walls instead of sticking. */
function moveCircle(level, body, dx, dy, radius) {
  const nextX = body.x + dx;
  if (!isSolid(level, nextX + Math.sign(dx) * radius, body.y - radius * 0.7)
    && !isSolid(level, nextX + Math.sign(dx) * radius, body.y)
    && !isSolid(level, nextX + Math.sign(dx) * radius, body.y + radius * 0.7)) {
    body.x = nextX;
  }
  const nextY = body.y + dy;
  if (!isSolid(level, body.x - radius * 0.7, nextY + Math.sign(dy) * radius)
    && !isSolid(level, body.x, nextY + Math.sign(dy) * radius)
    && !isSolid(level, body.x + radius * 0.7, nextY + Math.sign(dy) * radius)) {
    body.y = nextY;
  }
  body.x = Math.max(radius, Math.min(FIELD.width - radius, body.x));
  body.y = Math.max(radius, Math.min(FIELD.height - radius, body.y));
}

/** Steer a guard toward a point at a speed; returns true when it arrived. */
function steerGuard(level, guard, target, speed, dt) {
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 6) return true;
  const step = Math.min(distance, speed * dt);
  const beforeX = guard.x;
  const beforeY = guard.y;
  moveCircle(level, guard, (dx / distance) * step, (dy / distance) * step, GUARD.radius);
  guard.facing = Math.atan2(dy, dx);
  if (Math.hypot(guard.x - beforeX, guard.y - beforeY) < step * 0.2) {
    guard.stuckFor += dt;
  } else {
    guard.stuckFor = 0;
  }
  if (guard.stuckFor > 1.2) {
    // A patrol leg that cannot be walked (a crate in the way) is skipped
    // rather than letting the warden push at the wall forever.
    guard.stuckFor = 0;
    return true;
  }
  return false;
}

/** Can this guard see the player right now, and how fast would it notice them? */
function guardSeesPlayer(state, guard) {
  const { player, level } = state;
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > GUARD.viewRange) return 0;
  const angle = Math.atan2(dy, dx);
  let diff = angle - guard.facing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > GUARD.viewHalfAngle) return 0;
  if (!hasLineOfSight(level, guard.x, guard.y, player.x, player.y)) return 0;
  let rate = distance < GUARD.closeRange ? GUARD.detectRateClose : GUARD.detectRate;
  rate *= visibilityFactor(level, player.x, player.y);
  if (player.running) rate *= PLAYER.runVisibility;
  if (player.sneaking) rate *= PLAYER.sneakVisibility;
  return rate;
}

function guardInvestigate(state, guard, point) {
  guard.state = GUARD_INVESTIGATE;
  guard.lastSeen = { x: point.x, y: point.y };
  guard.lookTimer = 0;
}

/** One guard's brain for one frame. */
function stepGuard(state, guard, dt) {
  const sees = guardSeesPlayer(state, guard);
  if (sees > 0) {
    const before = guard.meter;
    guard.meter = Math.min(1, guard.meter + sees * dt);
    guard.lastSeen = { x: state.player.x, y: state.player.y };
    guard.unseenFor = 0;
    if (before < GUARD.suspiciousAt && guard.meter >= GUARD.suspiciousAt) {
      state.spotted = true;
      state.events.push({ type: 'spotted', x: guard.x, y: guard.y });
    }
    if (guard.meter >= GUARD.alertedAt && guard.state !== GUARD_CHASE) {
      guard.state = GUARD_CHASE;
      state.events.push({ type: 'alarmed', x: guard.x, y: guard.y });
    }
  } else {
    guard.meter = Math.max(0, guard.meter - GUARD.decayRate * dt);
    guard.unseenFor += dt;
    if (guard.state === GUARD_CHASE && guard.unseenFor > GUARD.loseTrailSeconds) {
      guard.state = GUARD_SEARCH;
      guard.lookTimer = 0;
      state.events.push({ type: 'lost', x: guard.x, y: guard.y });
    }
  }

  if (guard.state === GUARD_PATROL) {
    const target = guard.waypoints[guard.waypoint];
    if (steerGuard(state.level, guard, target, GUARD.patrolSpeed, dt)) {
      guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
    }
    return;
  }
  if (guard.state === GUARD_CHASE) {
    const target = guard.lastSeen ?? { x: state.player.x, y: state.player.y };
    steerGuard(state.level, guard, target, GUARD.chaseSpeed, dt);
    const dx = state.player.x - guard.x;
    const dy = state.player.y - guard.y;
    if (Math.hypot(dx, dy) < GUARD.catchRange && guard.meter > 0.5) {
      state.caught = true;
      state.events.push({ type: 'caught', x: guard.x, y: guard.y });
    }
    return;
  }
  if (guard.state === GUARD_INVESTIGATE || guard.state === GUARD_SEARCH) {
    const target = guard.lastSeen ?? { x: guard.x, y: guard.y };
    if (steerGuard(state.level, guard, target, GUARD.investigateSpeed, dt)) {
      // Arrived: stand and look around for a while, then give up.
      guard.lookTimer += dt;
      guard.facing += guard.scanDir * 1.6 * dt;
      if (guard.lookTimer > 1.2) guard.scanDir *= -1;
      if (guard.lookTimer > GUARD.investigateSeconds) {
        guard.state = GUARD_RETURN;
        guard.lookTimer = 0;
      }
    }
    return;
  }
  // GUARD_RETURN: walk back to the nearest waypoint, then resume the patrol.
  let nearest = 0;
  let nearestDistance = Infinity;
  guard.waypoints.forEach((point, index) => {
    const distance = Math.hypot(point.x - guard.x, point.y - guard.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  });
  if (steerGuard(state.level, guard, guard.waypoints[nearest], GUARD.returnSpeed, dt)) {
    guard.state = GUARD_PATROL;
    guard.waypoint = (nearest + 1) % guard.waypoints.length;
  }
}

/** A footstep noise: every guard in range turns to look at where it came from. */
function noiseHeard(state, x, y, radius) {
  for (const guard of state.guards) {
    if (guard.state === GUARD_CHASE) continue;
    if (Math.hypot(guard.x - x, guard.y - y) > radius) continue;
    if (guard.state !== GUARD_INVESTIGATE || !guard.lastSeen
      || Math.hypot(guard.lastSeen.x - x, guard.lastSeen.y - y) > 30) {
      guardInvestigate(state, guard, { x, y });
    }
  }
}

/**
 * Advance the world one frame. `input` is { moveX, moveY, run, sneak,
 * pebble: {x, y} | null }. Returns the events the frame caused; the caller
 * clears them by reading state.events after each call.
 */
export function stepWorld(state, input, dt) {
  state.events = [];
  if (state.caught || state.cleared) return state.events;
  state.time += dt;
  const { player, level } = state;

  const moving = input.moveX !== 0 || input.moveY !== 0;
  player.moving = moving;
  player.running = moving && input.run && !input.sneak;
  player.sneaking = moving && input.sneak;
  const speed = player.running ? PLAYER.runSpeed : player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  if (moving) {
    const length = Math.hypot(input.moveX, input.moveY);
    moveCircle(level, player, (input.moveX / length) * speed * dt, (input.moveY / length) * speed * dt, PLAYER.radius);
    player.stepTimer -= dt;
    if (player.stepTimer <= 0) {
      player.stepTimer = player.running ? 0.28 : player.sneaking ? 0.62 : 0.42;
      state.events.push({ type: 'step', x: player.x, y: player.y, running: player.running, byPlayer: true });
      if (player.running) noiseHeard(state, player.x, player.y, NOISE.runRadius);
    }
  }

  if (input.pebble && state.pebblesLeft > 0) {
    state.pebblesLeft -= 1;
    state.pebblesThrown += 1;
    const pebble = { x: input.pebble.x, y: input.pebble.y, timer: 0.45, landed: false };
    state.pebbles.push(pebble);
    state.events.push({ type: 'pebble', x: pebble.x, y: pebble.y });
  }
  for (const pebble of state.pebbles) {
    if (pebble.landed) continue;
    pebble.timer -= dt;
    if (pebble.timer <= 0) {
      pebble.landed = true;
      state.events.push({ type: 'pebbleLand', x: pebble.x, y: pebble.y });
      noiseHeard(state, pebble.x, pebble.y, NOISE.pebbleRadius);
    }
  }

  for (const guard of state.guards) stepGuard(state, guard, dt);
  state.alarm = state.guards.some((guard) => guard.state === GUARD_CHASE);

  for (const seal of state.seals) {
    if (seal.taken) continue;
    if (Math.hypot(seal.x - player.x, seal.y - player.y) < PLAYER.radius + 16) {
      seal.taken = true;
      state.sealsTaken += 1;
      state.events.push({ type: 'pickup', x: seal.x, y: seal.y, left: state.seals.length - state.sealsTaken });
      if (state.sealsTaken === state.seals.length) {
        state.exitOpen = true;
        state.events.push({ type: 'exitOpen', x: level.exit.x, y: level.exit.y });
      }
    }
  }

  if (state.exitOpen && Math.hypot(level.exit.x - player.x, level.exit.y - player.y) < PLAYER.radius + 18) {
    state.cleared = true;
    const timeBonus = Math.max(0, GAME.levelTimeBonus - Math.floor(state.time) * GAME.timeBonusPerSecond);
    const ghost = state.spotted ? 0 : GAME.ghostBonus;
    const score = state.seals.length * GAME.sealPoints + timeBonus + ghost;
    state.events.push({ type: 'levelClear', score, timeBonus, ghost, time: state.time });
  }
  return state.events;
}

/** Points a cleared level is worth, for the score screen. */
export function levelScore(state) {
  const timeBonus = Math.max(0, GAME.levelTimeBonus - Math.floor(state.time) * GAME.timeBonusPerSecond);
  return {
    seals: state.seals.length * GAME.sealPoints,
    timeBonus,
    ghost: state.spotted ? 0 : GAME.ghostBonus,
    total: state.seals.length * GAME.sealPoints + timeBonus + (state.spotted ? 0 : GAME.ghostBonus),
  };
}

export { tileCentreOf };
