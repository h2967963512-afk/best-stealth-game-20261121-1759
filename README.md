# Shadow Courier

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/h2967963512-afk/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/h2967963512-afk/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

An entry for make.fun's `best-stealth-game-20261121-1759` bounty ("Make the best stealth game").

You are Wren, a courier in the Lantern Archive after dark. Three lantern seals
per level, wardens walking patrols with cones of lamplight for eyes, and one
green exit door. Take every seal, then slip out unseen — or be caught in the
light and start the level over.

Stealth is a system, not a timer: a warden's cone fills a detection ring over
your head — slower in shadow, faster under a lamp, faster still if you run.
Half-seen, a warden comes to look; fully seen, it chases, and if it touches
you, you are caught. Break line of sight and it searches, then gives up and
goes back to its patrol. Running is loud enough to be heard through the dark,
and a thrown pebble is louder still — a useful lie, three per level.

Three levels, two to four wardens each, with patrols that cross and crates to
hide behind. A ghost bonus rewards a level nobody ever noticed you in.

## How to play

- **Move:** `WASD` or arrow keys.
- **Run:** hold `Shift` — fast, but loud, and easier to spot.
- **Sneak:** hold `C` — slow, quiet, harder to spot.
- **Pebble:** click anywhere to toss one there; wardens in earshot go to look.
- **Pause:** `P`. **Restart level:** `R`. **Mute:** `M`. **Start / continue:** `Enter`.
- **Win:** collect every seal in all three levels and reach the exit each time.
- **Lose:** caught three times.

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

No build step, no network: `game/` is plain static files, and the sound is
synthesized in code with the Web Audio API. Screenshots are taken from the
game itself with `?shot=start|play|end`.

## Layout

- `game/index.html` — page shell and canvas.
- `game/src/config.js` — every tuning number and colour.
- `game/src/random.js` — seeded RNG (no `Math.random` in the game).
- `game/src/levels.js` — the three levels as ASCII maps, plus patrol routes.
- `game/src/world.js` — the simulation: movement, vision cones, detection, noise, scoring.
- `game/src/render.js` — canvas drawing: floor, light and shadow, cones, HUD, screens.
- `game/src/input.js` — keyboard and mouse state.
- `game/src/audio.js` — synthesized footsteps, chimes and alarm stings.
- `game/src/shots.js` — the three screenshot scenes, played by an autopilot.
- `game/src/main.js` — the loop: screens, score, lives, pebbles.

---

<sub>Entered on [make.fun](https://make.fun/?ref=cj11yvbn&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
