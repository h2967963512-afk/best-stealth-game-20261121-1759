// A tiny seeded RNG (mulberry32) so a level's patrol jitter and the screenshot
// scenes play the same way every time. The game never calls Math.random.
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max] from the given rng. */
export function intBetween(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One of the array's items, picked by the rng. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
