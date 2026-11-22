// Shadow Courier — keyboard and mouse state. The game reads a plain object
// each frame: { moveX, moveY, run, sneak }, plus clicks handed to main.js
// as pebble targets. Nothing here knows about the world.
const KEYS = new Set();

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

/** Start listening. Call once, from main.js. */
export function startInput(onKey, onClick) {
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) onKey(event.code, true);
    KEYS.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    KEYS.delete(event.code);
    onKey(event.code, false);
  });
  window.addEventListener('blur', () => KEYS.clear());
  window.addEventListener('mousedown', (event) => {
    if (event.button === 0) onClick(event.clientX, event.clientY);
  });
  window.addEventListener('contextmenu', (event) => event.preventDefault());
}

/** The movement the player is asking for this frame, from the keys held down. */
export function readMovement() {
  let moveX = 0;
  let moveY = 0;
  for (const code of KEYS) {
    const dir = MOVE_KEYS[code];
    if (!dir) continue;
    moveX += dir[0];
    moveY += dir[1];
  }
  return {
    moveX,
    moveY,
    run: KEYS.has('ShiftLeft') || KEYS.has('ShiftRight'),
    sneak: KEYS.has('KeyC') || KEYS.has('ControlLeft') || KEYS.has('ControlRight'),
  };
}

/** True while the named key is held. */
export function keyHeld(code) {
  return KEYS.has(code);
}
