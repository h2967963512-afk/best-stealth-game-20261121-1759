// Shadow Courier — every tuning number in one place.
// One tile is 40 world units; the field is drawn on a canvas that letterboxes
// to the window, so nothing here knows about pixels on screen.
export const TILE = 40;
export const FIELD = { cols: 24, rows: 15, width: 24 * 40, height: 15 * 40 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 150, // world units per second
  runSpeed: 235,
  sneakSpeed: 82,
  // Detection fills this much faster while running, slower while sneaking.
  runVisibility: 1.6,
  sneakVisibility: 0.55,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  investigateSpeed: 108,
  chaseSpeed: 178,
  returnSpeed: 92,
  viewRange: 235, // how far a guard can see, in world units
  viewHalfAngle: (38 * Math.PI) / 180, // half of the vision cone
  // Detection meter 0..1. Fills per second while the player is seen.
  detectRate: 0.85,
  detectRateClose: 1.9, // inside this range the fill is much faster
  closeRange: 95,
  decayRate: 0.45, // per second while the player is unseen
  suspiciousAt: 0.35, // meter at which a guard goes to look
  alertedAt: 1.0,
  loseTrailSeconds: 4.5, // chase ends after this long without seeing the player
  investigateSeconds: 3.0, // how long a guard stares at a spot it checked
  catchRange: 20, // a chasing guard this close catches the player
};

export const LIGHT = {
  shadowFactor: 0.35, // detection fill multiplier while standing in shadow
  lampFactor: 1.5, // ...while standing in a lamp's pool of light
  lampRadius: 95,
};

export const NOISE = {
  runRadius: 130, // running is heard this far away
  runInterval: 0.42, // seconds between footstep noises while running
  pebbleRadius: 190, // a thrown pebble is heard this far away
  pebbleCount: 3, // pebbles per level
};

export const GAME = {
  lives: 3,
  levelTimeBonus: 500, // points for clearing a level, minus 5 per second used
  timeBonusPerSecond: 5,
  sealPoints: 150,
  ghostBonus: 400, // clearing a level without ever being spotted
  catchPenalty: 0,
};

export const COLOURS = {
  floor: '#232a33',
  floorAlt: '#20262e',
  shadowFloor: '#161d26',
  lampPool: 'rgba(255, 196, 110, 0.13)',
  wall: '#4a5568',
  wallTop: '#67748a',
  crate: '#7a5a34',
  crateTop: '#9c7648',
  crateEdge: '#5d4426',
  exit: '#39d98a',
  exitDark: '#1d7a4c',
  seal: '#ffd166',
  player: '#7dd3fc',
  playerDark: '#0c4a6e',
  guard: '#f87171',
  guardDark: '#7f1d1d',
  coneCalm: 'rgba(250, 204, 21, 0.20)',
  coneSuspicious: 'rgba(251, 146, 60, 0.30)',
  coneAlerted: 'rgba(239, 68, 68, 0.34)',
  coneEdge: 'rgba(250, 204, 21, 0.45)',
  pebble: '#d6d3d1',
  text: '#e7edf3',
  textDim: '#94a3b8',
  hud: 'rgba(10, 14, 20, 0.72)',
};
