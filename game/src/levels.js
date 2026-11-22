// The three levels of Shadow Courier. Each map is 24 by 15 tiles:
//   # wall (blocks movement and sight)   C crate (cover: blocks both too)
//   . lit floor                           s shadow floor (hard to be seen in)
//   L lamp (its pool of light is easy to be seen in)
//   P player start   S lantern seal   E exit   G guard start
// A guard's patrol is a loop of tile waypoints, listed in the order the G
// markers appear when the map is read top to bottom, left to right.
import { TILE } from './config.js';

const LEVEL_1_MAP = [
  '########################',
  '#P....ss......#......S.#',
  '#.....ss......#........#',
  '#.CC..ss..C...#...C....#',
  '#.....ss......#........#',
  '#.....ss..C...#..ss....#',
  '#..G......C......ss..E.#',
  '#.....ss......#..ss....#',
  '#..C..ss..C...#........#',
  '#.....ss......#...C....#',
  '#..S..ss......#....G...#',
  '#.....ss..C...#........#',
  '#.....ss......#..ss....#',
  '#.....ss......#..ss....#',
  '########################',
];

const LEVEL_2_MAP = [
  '########################',
  '#P...ss....C....ss...S.#',
  '#....ss....C....ss.....#',
  '#.C..ss....C..L.ss..C..#',
  '#....ss.........ss.....#',
  '#....ss..CC.....ss..G..#',
  '#..G....CC....C....ss..#',
  '#....ss....C.......ss..#',
  '#.C..ss....C..ss...C...#',
  '#....ss....C..ss...C.S.#',
  '#....ss.....G.ss.......#',
  '#..S.ss..C....ss..CC...#',
  '#....ss..C....ss..CC...#',
  '#....ss.......ss....E..#',
  '########################',
];

const LEVEL_3_MAP = [
  '########################',
  '#P...ss...C...ss....S..#',
  '#....ss...C...ss..C....#',
  '#.C..ss...C.L.ss..C..G.#',
  '#....ss.......ss.......#',
  '#..G.ss..CC...ss...C...#',
  '#....ss..CC...ss...C.S.#',
  '#.C..ss.......ss.......#',
  '#....ss...C...ss..CC...#',
  '#....ss...C...ss..CC.G.#',
  '#..S.ss.......ss.......#',
  '#....ss..C....ss...C...#',
  '#.CG.ss..C..L.ss...C.E.#',
  '#....ss.......ss.......#',
  '########################',
];

function tileCentre(col, row) {
  return { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
}

/**
 * Turn one ASCII map plus its patrol loops into the level the simulation runs:
 * solid tiles, shadow tiles, lamps, seals, the exit, the player start and the
 * guards with their patrols. Throws on a malformed map so a typo is caught
 * at load time instead of mid-game.
 */
export function buildLevel(definition, index) {
  const { map, name, brief, patrols } = definition;
  const solids = new Set();
  const crates = new Set();
  const shadows = new Set();
  const lamps = [];
  const seals = [];
  const guardStarts = [];
  let spawn = null;
  let exit = null;
  for (let row = 0; row < map.length; row += 1) {
    if (map[row].length !== 24) throw new Error(`level ${index + 1} row ${row} is ${map[row].length} wide, want 24`);
    for (let col = 0; col < 24; col += 1) {
      const key = `${col},${row}`;
      const cell = map[row][col];
      if (cell === '#' || cell === 'C') solids.add(key);
      if (cell === 'C') crates.add(key);
      if (cell === 's') shadows.add(key);
      if (cell === 'L') lamps.push(tileCentre(col, row));
      if (cell === 'S') seals.push({ ...tileCentre(col, row), taken: false });
      if (cell === 'P') spawn = tileCentre(col, row);
      if (cell === 'E') exit = tileCentre(col, row);
      if (cell === 'G') guardStarts.push(tileCentre(col, row));
    }
  }
  if (!spawn) throw new Error(`level ${index + 1} has no player start`);
  if (!exit) throw new Error(`level ${index + 1} has no exit`);
  if (guardStarts.length !== patrols.length) {
    throw new Error(`level ${index + 1} has ${guardStarts.length} guards but ${patrols.length} patrols`);
  }
  const guards = guardStarts.map((start, i) => ({
    x: start.x,
    y: start.y,
    waypoints: patrols[i].map(([col, row]) => tileCentre(col, row)),
  }));
  return {
    index,
    name,
    brief,
    cols: 24,
    rows: 15,
    solids,
    crates,
    shadows,
    lamps,
    seals,
    spawn,
    exit,
    guards,
  };
}

export const LEVELS = [
  buildLevel(
    {
      name: 'The Quiet Gallery',
      brief: 'Two wardens walk the gallery. Take both seals, then slip out the east door.',
      map: LEVEL_1_MAP,
      patrols: [
        [[4, 6], [4, 11], [8, 11], [8, 6]],
        [[19, 10], [19, 5], [16, 5], [16, 10]],
      ],
    },
    0,
  ),
  buildLevel(
    {
      name: 'The Stacked Vault',
      brief: 'Crates everywhere, three wardens, three seals. The shadows along the walls are your friends.',
      map: LEVEL_2_MAP,
      patrols: [
        [[21, 5], [21, 11], [22, 11], [22, 5]],
        [[3, 6], [3, 12], [7, 12], [7, 6]],
        [[12, 10], [12, 4], [16, 4], [16, 10]],
      ],
    },
    1,
  ),
  buildLevel(
    {
      name: "The Warden's Hall",
      brief: 'Four wardens cross each other’s routes. Patience beats speed — wait for the gap.',
      map: LEVEL_3_MAP,
      patrols: [
        [[21, 3], [21, 8], [22, 8], [22, 3]],
        [[3, 5], [3, 11], [7, 11], [7, 5]],
        [[20, 10], [20, 13], [14, 13], [14, 10]],
        [[3, 12], [7, 12], [7, 8], [3, 8]],
      ],
    },
    2,
  ),
];
