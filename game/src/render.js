// Shadow Courier — everything on screen: the level seen from above, the
// wardens' vision cones, the pools of lamplight, the HUD and the screens.
// Nothing here changes the simulation; it only reads a world state.
import { COLOURS, FIELD, GUARD, LIGHT, TILE } from './config.js';
import { GUARD_CHASE, GUARD_INVESTIGATE, GUARD_SEARCH } from './world.js';
import { visibilityFactor } from './world.js';

const PLAYER_RADIUS = 13;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_OVER = 'over';
export const SCREEN_PAUSE = 'pause';

/** Fit the 960x600 field into the canvas, letterboxed. */
export function computeView(canvasWidth, canvasHeight) {
  const scale = Math.min(canvasWidth / FIELD.width, canvasHeight / FIELD.height);
  return {
    scale,
    ox: (canvasWidth - FIELD.width * scale) / 2,
    oy: (canvasHeight - FIELD.height * scale) / 2,
  };
}

/** Canvas pixels back to world units (the inverse of the letterbox). */
export function screenToWorld(view, px, py) {
  return { x: (px - view.ox) / view.scale, y: (py - view.oy) / view.scale };
}

function tileAt(level, col, row) {
  return level.solids.has(`${col},${row}`);
}

function drawFloor(ctx, view, level) {
  for (let row = 0; row < level.rows; row += 1) {
    for (let col = 0; col < level.cols; col += 1) {
      const key = `${col},${row}`;
      if (level.solids.has(key)) continue;
      ctx.fillStyle = level.shadows.has(key) ? COLOURS.shadowFloor : (col + row) % 2 === 0 ? COLOURS.floor : COLOURS.floorAlt;
      ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
    }
  }
  // Lamp pools: soft circles of light on the floor.
  for (const lamp of level.lamps) {
    const gradient = ctx.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, LIGHT.lampRadius);
    gradient.addColorStop(0, 'rgba(255, 196, 110, 0.22)');
    gradient.addColorStop(1, 'rgba(255, 196, 110, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, LIGHT.lampRadius, 0, Math.PI * 2);
    ctx.fill();
    // The lamp itself: a small brass post.
    ctx.fillStyle = '#8a6d3b';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCone(ctx, guard, level) {
  const state = guard.state;
  const fill = state === GUARD_CHASE ? COLOURS.coneAlerted
    : state === GUARD_INVESTIGATE || state === GUARD_SEARCH ? COLOURS.coneSuspicious
      : COLOURS.coneCalm;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.arc(guard.x, guard.y, GUARD.viewRange, guard.facing - GUARD.viewHalfAngle, guard.facing + GUARD.viewHalfAngle);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLOURS.coneEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.facing - GUARD.viewHalfAngle) * GUARD.viewRange,
    guard.y + Math.sin(guard.facing - GUARD.viewHalfAngle) * GUARD.viewRange);
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.facing + GUARD.viewHalfAngle) * GUARD.viewRange,
    guard.y + Math.sin(guard.facing + GUARD.viewHalfAngle) * GUARD.viewRange);
  ctx.stroke();
}

function drawSolids(ctx, level) {
  for (let row = 0; row < level.rows; row += 1) {
    for (let col = 0; col < level.cols; col += 1) {
      const key = `${col},${row}`;
      if (!level.solids.has(key)) continue;
      const x = col * TILE;
      const y = row * TILE;
      // Crates and walls both block sight; crates are wooden boxes, walls stone.
      if (level.crates.has(key)) {
        ctx.fillStyle = COLOURS.crate;
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = COLOURS.crateTop;
        ctx.fillRect(x + 2, y + 2, TILE - 4, 8);
        ctx.strokeStyle = COLOURS.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2);
        ctx.lineTo(x + TILE - 2, y + TILE - 2);
        ctx.moveTo(x + TILE - 2, y + 2);
        ctx.lineTo(x + 2, y + TILE - 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = COLOURS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLOURS.wallTop;
        ctx.fillRect(x, y, TILE, 6);
      }
    }
  }
}

function drawExit(ctx, level, open, time) {
  const { x, y } = level.exit;
  const pulse = open ? 0.75 + 0.25 * Math.sin(time * 4) : 0.4;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = open ? COLOURS.exit : COLOURS.exitDark;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = open ? '#a7f3d0' : '#065f46';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = open ? '#052e16' : '#a7f3d0';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'EXIT' : 'LOCK', x, y);
}

function drawSeals(ctx, seals, time) {
  for (const seal of seals) {
    if (seal.taken) continue;
    const pulse = 1 + 0.12 * Math.sin(time * 3 + seal.x);
    ctx.save();
    ctx.translate(seal.x, seal.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.seal;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(9, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGuards(ctx, guards) {
  for (const guard of guards) {
    drawCone(ctx, guard);
  }
  for (const guard of guards) {
    ctx.fillStyle = COLOURS.guardDark;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick: the warden's lantern.
    ctx.strokeStyle = '#fecaca';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * (GUARD.radius + 6),
      guard.y + Math.sin(guard.facing) * (GUARD.radius + 6));
    ctx.stroke();
    // Detection meter: a ring that fills as the warden notices you.
    if (guard.meter > 0.03) {
      ctx.strokeStyle = guard.meter >= 1 ? '#ef4444' : '#fbbf24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius + 7, -Math.PI / 2, -Math.PI / 2 + guard.meter * Math.PI * 2);
      ctx.stroke();
    }
    if (guard.state === GUARD_CHASE) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - GUARD.radius - 12);
    } else if (guard.state === GUARD_INVESTIGATE || guard.state === GUARD_SEARCH) {
      ctx.fillStyle = '#fb923c';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, guard.y - GUARD.radius - 12);
    }
  }
}

function drawPlayer(ctx, state) {
  const { player, level } = state;
  const hidden = visibilityFactor(level, player.x, player.y) < 1;
  ctx.save();
  if (hidden) {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_RADIUS + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = COLOURS.playerDark;
  ctx.beginPath();
  ctx.arc(player.x, player.y, PLAYER_RADIUS + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOURS.player;
  ctx.beginPath();
  ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  // A small hood peak showing which way the courier faces.
  const angle = player.faceAngle ?? -Math.PI / 2;
  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(angle) * (PLAYER_RADIUS + 4), player.y + Math.sin(angle) * (PLAYER_RADIUS + 4));
  ctx.lineTo(player.x + Math.cos(angle + 2.5) * 7, player.y + Math.sin(angle + 2.5) * 7);
  ctx.lineTo(player.x + Math.cos(angle - 2.5) * 7, player.y + Math.sin(angle - 2.5) * 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFx(ctx, fx) {
  for (const ring of fx) {
    const progress = 1 - ring.ttl / ring.max;
    ctx.strokeStyle = `rgba(226, 232, 240, ${0.7 * (1 - progress)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius * (0.3 + 0.7 * progress), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHud(ctx, state, score, lives) {
  const { level, sealsTaken, seals, pebblesLeft, time, alarm } = state;
  ctx.save();
  ctx.fillStyle = COLOURS.hud;
  ctx.fillRect(0, 0, FIELD.width, 34);
  ctx.fillStyle = COLOURS.text;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${level.index + 1}/3 · ${level.name}`, 12, 17);
  ctx.textAlign = 'center';
  const sealText = seals.map((seal) => (seal.taken ? '◆' : '◇')).join(' ');
  ctx.fillStyle = COLOURS.seal;
  ctx.fillText(sealText, FIELD.width / 2 - 40, 17);
  ctx.fillStyle = COLOURS.text;
  ctx.fillText(`Score ${score}`, FIELD.width / 2 + 90, 17);
  ctx.textAlign = 'right';
  ctx.fillText(`${'♥'.repeat(Math.max(0, lives))}${'♡'.repeat(Math.max(0, 3 - lives))}`, FIELD.width - 170, 17);
  ctx.fillText(`◉ ${pebblesLeft}  ⏱ ${Math.floor(time)}s`, FIELD.width - 12, 17);
  if (alarm) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('! ALARM — BREAK LINE OF SIGHT !', FIELD.width / 2, 52);
  } else if (state.guards.some((g) => g.state === GUARD_INVESTIGATE || g.state === GUARD_SEARCH)) {
    ctx.fillStyle = '#fb923c';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('? A warden is looking for you — stay out of the cones', FIELD.width / 2, 52);
  }
  ctx.restore();
}

/** The whole world: floor, cones, cover, seals, wardens, courier, HUD. */
export function drawWorld(ctx, view, state, fx, score, lives) {
  ctx.save();
  ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(-view.ox / view.scale, -view.oy / view.scale, FIELD.width + (2 * view.ox) / view.scale, FIELD.height + (2 * view.oy) / view.scale);
  drawFloor(ctx, view, state.level);
  drawGuards(ctx, state.guards);
  drawSolids(ctx, state.level);
  drawExit(ctx, state.level, state.exitOpen, state.time);
  drawSeals(ctx, state.seals, state.time);
  for (const pebble of state.pebbles) {
    ctx.fillStyle = COLOURS.pebble;
    ctx.beginPath();
    ctx.arc(pebble.x, pebble.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  drawFx(ctx, fx);
  drawPlayer(ctx, state);
  drawHud(ctx, state, score, lives);
  ctx.restore();
}

function dim(ctx, view) {
  ctx.save();
  ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  ctx.fillStyle = 'rgba(5, 8, 12, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();
}

function panel(ctx, view, lines, title, accent) {
  ctx.save();
  ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  const width = 620;
  const height = 92 + lines.length * 26;
  const x = (FIELD.width - width) / 2;
  const y = (FIELD.height - height) / 2;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.92)';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, FIELD.width / 2, y + 44);
  ctx.fillStyle = COLOURS.text;
  ctx.font = '16px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, FIELD.width / 2, y + 88 + i * 26);
  });
  ctx.restore();
}

export function drawTitle(ctx, view, state) {
  drawWorld(ctx, view, state, [], 0, 3);
  dim(ctx, view);
  panel(ctx, view, [
    'A courier. Three lantern seals. Wardens with eyes everywhere.',
    'WASD / arrows to move · Shift to run (loud!) · C to sneak',
    'Click to toss a pebble and lure a warden away · Stay in the shadows',
    'Collect every seal, then reach the green EXIT unseen.',
    '',
    'Press Enter or click to begin — Level 1: The Quiet Gallery',
  ], 'SHADOW COURIER', '#7dd3fc');
}

export function drawClear(ctx, view, breakdown) {
  dim(ctx, view);
  panel(ctx, view, [
    `Seals ${breakdown.seals}  ·  Time bonus ${breakdown.timeBonus}  ·  Ghost bonus ${breakdown.ghost}`,
    `Level score ${breakdown.total}`,
    '',
    'Press Enter for the next level',
  ], 'LEVEL CLEAR', '#39d98a');
}

export function drawCaught(ctx, view, livesLeft) {
  dim(ctx, view);
  panel(ctx, view, [
    'A warden caught you in the light.',
    livesLeft > 0 ? `${livesLeft} ${livesLeft === 1 ? 'life' : 'lives'} left — the level restarts.` : 'That was your last life.',
    '',
    'Press Enter to try again',
  ], 'CAUGHT!', '#f87171');
}

export function drawVictory(ctx, view, total) {
  dim(ctx, view);
  panel(ctx, view, [
    'All three seals of every level, and not a warden the wiser —',
    'or at least, none that could prove it.',
    `Final score: ${total}`,
    '',
    'Press Enter to play again',
  ], 'GHOST OF THE ARCHIVE', '#ffd166');
}

export function drawOver(ctx, view, total) {
  dim(ctx, view);
  panel(ctx, view, [
    'The wardens know your face now.',
    `Final score: ${total}`,
    '',
    'Press Enter to try again',
  ], 'GAME OVER', '#f87171');
}

export function drawPause(ctx, view) {
  dim(ctx, view);
  panel(ctx, view, ['Press P to keep sneaking'], 'PAUSED', '#94a3b8');
}
