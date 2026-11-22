// Shadow Courier — the loop: screens, score, lives, pebble throws, and the
// frame that ties input, simulation, sound and drawing together.
import { FIELD, GAME } from './config.js';
import { createWorld, levelScore, stepWorld } from './world.js';
import {
  SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY,
  SCREEN_TITLE, SCREEN_VICTORY, computeView, drawCaught, drawClear, drawOver,
  drawPause, drawTitle, drawVictory, drawWorld, screenToWorld,
} from './render.js';
import { ensureAudio, playEvent, toggleMute } from './audio.js';
import { readMovement, startInput } from './input.js';
import { buildShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

let view = computeView(window.innerWidth, window.innerHeight);
let screen = SCREEN_TITLE;
let world = createWorld(0);
let levelIndex = 0;
let score = 0;
let lives = GAME.lives;
let fx = [];
let lastBreakdown = null;
let lastTime = performance.now();
let paused = false;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  view = computeView(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function startLevel(index) {
  levelIndex = index;
  world = createWorld(index);
  fx = [];
  screen = SCREEN_PLAY;
  announce(`${world.level.name}. ${world.level.brief}`);
}

function startGame() {
  score = 0;
  lives = GAME.lives;
  startLevel(0);
}

function handleEvents(events) {
  for (const event of events) {
    playEvent(event);
    if (event.type === 'step' && event.running) {
      fx.push({ x: event.x, y: event.y, radius: 34, ttl: 0.5, max: 0.5 });
    }
    if (event.type === 'pebbleLand') {
      fx.push({ x: event.x, y: event.y, radius: 60, ttl: 0.6, max: 0.6 });
    }
    if (event.type === 'levelClear') {
      lastBreakdown = levelScore(world);
      score += lastBreakdown.total;
      playEvent({ type: 'levelClear' });
      screen = SCREEN_CLEAR;
      announce(`Level clear. Score ${score}.`);
    }
    if (event.type === 'caught') {
      lives -= 1;
      playEvent({ type: 'caught' });
      screen = lives > 0 ? SCREEN_CAUGHT : SCREEN_OVER;
      announce(lives > 0 ? `Caught. ${lives} lives left.` : 'Caught. Game over.');
    }
  }
}

function advance() {
  ensureAudio();
  if (screen === SCREEN_TITLE || screen === SCREEN_VICTORY || screen === SCREEN_OVER) {
    startGame();
  } else if (screen === SCREEN_CLEAR) {
    if (levelIndex + 1 < 3) {
      startLevel(levelIndex + 1);
    } else {
      screen = SCREEN_VICTORY;
      announce(`You finished Shadow Courier with ${score} points.`);
    }
  } else if (screen === SCREEN_CAUGHT) {
    startLevel(levelIndex);
  } else if (screen === SCREEN_PAUSE) {
    paused = false;
    screen = SCREEN_PLAY;
  }
}

function onKey(code, down) {
  if (!down) return;
  if (code === 'Enter' || code === 'NumpadEnter') {
    if (screen !== SCREEN_PLAY) advance();
    return;
  }
  if (code === 'KeyM') {
    const muted = toggleMute();
    announce(muted ? 'Sound off.' : 'Sound on.');
    return;
  }
  if (code === 'KeyP') {
    if (screen === SCREEN_PLAY) {
      paused = true;
      screen = SCREEN_PAUSE;
    } else if (screen === SCREEN_PAUSE) {
      advance();
    }
    return;
  }
  if (code === 'KeyR' && screen === SCREEN_PLAY) {
    startLevel(levelIndex);
  }
}

function onClick(clientX, clientY) {
  ensureAudio();
  if (screen === SCREEN_TITLE) {
    startGame();
    return;
  }
  if (screen !== SCREEN_PLAY) {
    advance();
    return;
  }
  // A click in play throws a pebble at that spot, to lure a warden away.
  const point = screenToWorld(view, clientX, clientY);
  if (point.x < 0 || point.y < 0 || point.x >= FIELD.width || point.y >= FIELD.height) return;
  if (world.pebblesLeft <= 0) return;
  const input = readMovement();
  input.pebble = { x: point.x, y: point.y };
  handleEvents(stepWorld(world, input, 0));
}

startInput(onKey, onClick);

// A read-only handle for the browser playtest (and for anyone poking at the
// game from the console): the screen, the world, the score and the lives.
window.__game = {
  screen: () => screen,
  world: () => world,
  score: () => score,
  lives: () => lives,
};

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (screen === SCREEN_PLAY && !paused) {
    const input = readMovement();
    const player = world.player;
    if (input.moveX !== 0 || input.moveY !== 0) {
      player.faceAngle = Math.atan2(input.moveY, input.moveX);
    }
    handleEvents(stepWorld(world, input, dt));
  }
  for (const ring of fx) ring.ttl -= dt;
  fx = fx.filter((ring) => ring.ttl > 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (screen === SCREEN_TITLE) {
    drawTitle(ctx, view, world);
  } else {
    drawWorld(ctx, view, world, fx, score, lives);
    if (screen === SCREEN_CLEAR && lastBreakdown) drawClear(ctx, view, lastBreakdown);
    if (screen === SCREEN_CAUGHT) drawCaught(ctx, view, lives);
    if (screen === SCREEN_VICTORY) drawVictory(ctx, view, score);
    if (screen === SCREEN_OVER) drawOver(ctx, view, score);
    if (screen === SCREEN_PAUSE) drawPause(ctx, view);
  }
  requestAnimationFrame(frame);
}

// A screenshot scene (?shot=start|play|end) renders one deterministic frame
// instead of starting the game loop.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const scene = buildShot(shot);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (scene.screen === SCREEN_TITLE) {
    drawTitle(ctx, view, scene.world);
  } else {
    drawWorld(ctx, view, scene.world, scene.fx, scene.score, scene.lives);
    if (scene.screen === SCREEN_CLEAR && scene.breakdown) drawClear(ctx, view, scene.breakdown);
    if (scene.screen === SCREEN_VICTORY) drawVictory(ctx, view, scene.score);
  }
  document.title = `Shadow Courier — ${shot}`;
  window.__shotReady = true;
  window.__shot = scene;
} else {
  requestAnimationFrame(frame);
}
