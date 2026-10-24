# Task 3 report — ball physics, guards and simulateShot (bit-exact parity)

**Status: NEEDS_CONTEXT.** Everything is implemented, and parity with the legacy game is bit-exact (5/5, plus all 13 corpus tables checked by hand). One test, `encaçapes do corpus caem como esperado`, cannot pass by adjusting only power: the cue ball follows ball 1 into the pocket (a scratch). A corpus decision is needed. **Nothing is committed**: the changes are in the working tree on `claude/planejamento-online`, based on `baa6871`.

## What was implemented

- `packages/sim/src/types.js`: JSDoc for `BallState`, `TableState`, `ShotInput`, `Frame`, `SimEvent`, `SimulateOptions` and `ShotResult`, plus a `Quat` tuple.
- `packages/sim/src/ball.js`: `createBall(id, tuning)`, `applyCueImpulse`, `limitSpeed`, `limitAngularSpeed`, `applyLowSpeedBrake(ball, dt, tuning)`, `applySpinPhysics(ball, dt, tuning)` and `removeBall(simWorld, ball)`.
  - It is a literal port of `Ball.js`, without the mesh.
  - The body is created with the identity orientation before `addShape`, as in legacy, so `invInertiaWorld` is identical.
- `packages/sim/src/guards.js`: `createGuards(simWorld, balls, hooks)` → `{ update, checkPockets, allStopped, applyCushionSpin }`.
  - It is a literal port of the `BallsManager` guard section, without `sync()`.
  - `_notifyManual*` becomes `hooks.onBallContact` / `hooks.onCushionContact`.
  - `checkPockets` calls `removeBall`, which is `Ball.remove()` plus `world.removeBody`, as in legacy.
- `packages/sim/src/simulate.js`: `simulateShot(table, shot, { tuning = TUNING, maxSimSeconds = 20 })`, with the brief's loop:
  - one `world.step(1/360)` per step; guards at `dt = 1/60` every 6 steps, then pockets and the stop check;
  - integer `steps`; `simSeconds = steps / 360`.
  - Body order is the table, then the unpocketed balls by id. Each ball gets a `collide` listener that calls `guards.applyCushionSpin` when the other body's material is `materials.cushion`.
  - Validation order follows ruling 5:
    - `RangeError` for a non-finite angle, power, spin or `cueBall`, and for power ≤ 0;
    - then power is clamped to `SHOT.maxPower` and spin is normalized as in `ShotInput.js`;
    - `Error` for `duplicate ball id` and for `no cue ball in play`;
    - `RangeError` for a non-finite ball x/z, a malformed `q` or a non-integer id;
    - an unknown profile throws through `getTableProfile`.
  - Inputs are never mutated: the balls are copied and sorted.
  - `final.balls` lists every input ball, sorted by id. Balls pocketed in the input keep their input x/z.
- `packages/sim/src/index.js` re-exports ball, guards, simulate and types.
- Test helpers:
  - `test/legacy/legacy-run.js`: `runLegacy(legacyWorld, { dir, force, spin }, { cadence: 'fixed60' } | { fps })`.
    - `fixed60` runs 6 × `world.step(1/360)` per frame, then guards at 1/60, then pockets, then the stop check.
    - `{ fps }` runs `physics.step(1/fps)` with `performance.now` frozen through `defineProperty`, removed again in `finally`.
    - `steps` = number of cannon 1/360 s steps (`world.stepnumber` delta) in both modes. `simSeconds` = `steps / 360` at fixed60 and `frames / fps` otherwise.
    - Force is normalized as in `Game.shoot`.
  - `test/util/hash.js`: `hashFinal`, FNV-1a copied from the spike.
  - `test/corpus.js`: `rack8()` with the exact float expressions of `_rackEightBall`, and the 13-row `CORPUS` from the brief, unchanged.
- `tools/update-golden.mjs` and the `"golden:update"` script; `test/golden.json` was generated after parity passed.

## Tests and results

- `npm test -w packages/sim`: 21 tests, **20 pass, 1 fails** (`encaçapes do corpus caem como esperado`, see below).
- `npm run typecheck`: clean, exit 0. All new `src` files are checked (`--listFilesOnly` confirms).
- `bash harness/init.sh`: `fast suites FAILING: packages/sim`. All 15 client suites pass; the failure is this one test.

### TDD evidence

RED, from `npm test -w packages/sim` right after writing the brief's tests. This is the expected failure, since the modules did not exist yet:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../packages/sim/test/corpus.js' imported from .../golden.test.js
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../packages/sim/test/legacy/legacy-run.js' imported from .../parity.test.js
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../packages/sim/test/corpus.js' imported from .../simulate.test.js
# pass 6  # fail 3
```
GREEN (partial), from `npm test -w packages/sim`:
```
ok 1 - corpus golden idêntico em duas execuções e igual ao golden.json
ok 2..6 - paridade com o legado a 60 Hz fixo: break / medium / english / soft / draw-rack
ok 7..14 - (8 of the 9 simulate tests)
not ok 15 - encaçapes do corpus caem como esperado
    pot-corner  + actual - expected   [ +0, 1 ]
ok 16..21 - Task 2 tests
# tests 21  # pass 20  # fail 1
```

### Parity evidence (TUNING_LEGACY, fixed60)

| shot | steps (sim = legacy) | hash (sim = legacy) | pocketed |
|---|---|---|---|
| break | 4002 | e8130719 | — (16 balls moved) |
| medium | 3978 | 2a0b3eff | — |
| english | 4536 | 5c4e4061 | [2] (the removal path runs) |
| soft | 2592 | 42eb54d1 | — |
| draw-rack | 894 | 53e0d786 | — |

Checks that the test is meaningful:
- Multiplying `damping` by (1 + 1e-12) changes all 5 hashes.
- I also rebuilt **every** non-rack corpus table on the legacy world, using Task 7's recipe (`ball.remove()` + `physics.removeBody`, then `setPosition`). All 13 rows are BIT-EXACT against legacy at fixed60, including the pot rows.
- `runLegacy({ fps })` is deterministic on repeat at 30, 60, 120 and 144 FPS, and the real `performance.now` is restored afterwards.

## Blocker: the corpus pot rows cannot reach `expectPocketed: [1]` by changing power only

With the brief's geometry, all three pots drop, but the cue ball drops too: `[0, 1]`. Legacy does exactly the same, so this is the legacy physics and not a porting bug.

- **Mechanism (trace, `pot-side` at power 25):** the cue ball is fully rolling within about 6 cm, because cannon's ball-table friction quickly converts slide into roll (Task 8's diagnosis). After the full-ball hit it keeps rolling at about 18 cm/s. With `rollingResistance` = 3 cm/s² it would roll about 54 cm. Ball 1 sits 12–13.5 cm from the pocket center, on the pocket line, so the cue ball follows it in.
- **Power sweep 15–60, step 1, sim:** `[1]` alone appears only at isolated powers: corner 17 and 29; side 27, 33, 35 and 37; far corner 18, 20 and 53. Every other power gives `[0,1]`.
- **Those powers are knife-edge.** A change of ±0.01 in power flips the result. At every one of them, legacy at 60 FPS gives `[0,1]`. Task 7's feel test requires `pocketed` equal to legacy at 60 FPS, so choosing any of them would break Task 7, and probably Task 8's recalibration too.
- The brief's `pot-side` power of 25 is itself knife-edge in legacy: `[1]` at 30/60/120 FPS, `[0,1]` at fixed60 and 144 FPS.
- **Also not robust:** a closer cue ball (12–20 cm) and mild draw (−0.2 / −0.4). The only exception is `pot-side` with draw −0.4.

### Options for the controller (measured; "robust" = sim `[1]` at 25 of 25 powers in p ± 3 at step 0.25, and legacy `[1]` at 30/60/120/144 FPS)

- **A, recommended: turn the pots into cut shots, keeping the powers.**
  - **Side pot:** ball 1 stays at (−50, 0). The cue ball sits 40 cm behind the ghost ball, approaching with a 20° cut, at about (−6.7, ±13.7). Power 25. Robust (25/25 and YYYY), and robust at 30° too.
  - **Corners:** ball 1 moves to about 25 cm from the pocket, on the diagonal:
    - `pot-corner`: ball 1 at (−45.8, −109.3), cue at (−21.8, −70.6), 15° cut, power 30;
    - `pot-far-corner`: the mirror image, ball 1 at (45.8, 109.3), cue at (21.8, 70.6), power 30.
    - Both are robust (25/25 and YYYY). Many other robust cuts exist (15–35°, power 25–40).
  - The angle = atan2(ghost − cue), where ghost = ball 1 − 2R·û and û is the unit vector from ball 1 to the pocket.
  - If chosen, I would re-check the exact rounded rows, regenerate `golden.json`, and log the changes.
- **B:** keep the geometry and change `expectPocketed` to `[0, 1]`. That changes a criterion, which needs a decision, and the reference "pot" shots would become scratches. The `pot-side` power would still need to change, because 25 is knife-edge in legacy.
- **C, not recommended:** take one of the knife-edge powers (e.g. corner 17, side 27, far corner 18). The test passes today, but it is brittle and contradicts legacy at 60 FPS, so Task 7 would fail.

No power adjustment was made: the corpus has the brief's values.

## golden.json (current corpus, default TUNING; regenerate after the corpus decision)

```json
{ "break": {"hash":"e8130719","steps":4002}, "medium": {"hash":"2a0b3eff","steps":3978},
  "english": {"hash":"5c4e4061","steps":4536}, "soft": {"hash":"42eb54d1","steps":2592},
  "draw-rack": {"hash":"53e0d786","steps":894}, "rail-straight": {"hash":"97c855bf","steps":4032},
  "rail-english": {"hash":"0176617c","steps":4332}, "long-stun": {"hash":"73aa90da","steps":4542},
  "follow": {"hash":"23206d18","steps":3666}, "pot-corner": {"hash":"4ccd1d37","steps":234},
  "pot-side": {"hash":"4ccd1d37","steps":354}, "pot-far-corner": {"hash":"4ccd1d37","steps":252},
  "draw-ref": {"hash":"ba6d0239","steps":894} }
```

## Files changed (uncommitted)

- M `packages/sim/package.json` (`golden:update` script)
- M `packages/sim/src/index.js`
- A `packages/sim/src/{ball,guards,simulate,types}.js`
- A `packages/sim/test/{parity,simulate,golden}.test.js`, `test/corpus.js`, `test/golden.json`, `test/legacy/legacy-run.js`, `test/util/hash.js`
- A `packages/sim/tools/update-golden.mjs`

## Self-review

- **Literal port:** same arithmetic order, and the physics comments are kept. Only the historical "BUG FIX" note was dropped. All tunables are read from `tuning`; a grep for `BALL.{rollingResistance,…,angularDamping}` in `src` finds none. `TUNING` and `TUNING_LEGACY` are untouched.
- **Lint test:** no `three`, DOM, `performance`, `Date.now` or `Math.random` in `src`, and every file has `// @ts-check`.
- **Size:** `guards.js` has 450 lines, against about 390 for the BallsManager guard section; the difference is JSDoc. Not split.
- **Cue-ball placement:** `cueBall` is applied at body creation, which has the same effect as moving the ball after building the world.
- **Orientation:** `q` is set after `addShape`, so the inertia stays as in legacy.

## Concerns / notes

1. **Blocker above:** the corpus pot rows.
2. **Balls pocketed during the shot report x = z = 0 in `final`.** The literal `Ball.remove()` parks the body at (0, −1000, 0), and legacy hashes the same values; this is documented in `types.js`.
   - So the three pot rows currently share the hash `4ccd1d37`; only `steps` differs.
   - If the controller wants the position at the moment of pocketing instead, `runLegacy` must record the same position, or parity breaks.
   - Task 7's `cuePath` should not add a jump to (0, 0) for a pocketed cue ball.
3. **`final.balls` is sorted by id, whatever order the input uses.** I read "input id order" as ascending id; the world needs that order anyway.
4. **`draw-rack` and `draw-ref`:** with the legacy tuning the cue ball barely moves (draw-ref ends at z = −41.6 after starting at −50) and never reaches ball 1. This is the known Task 8 behavior, noted for the record.

---

## Resolution (after controller ruling: option A)

**Status: DONE.** Commit `846c667 feat(sim): port ball physics and guards with bit-exact legacy parity` (not pushed).

The controller also accepted the following, so they are no longer open:
- balls pocketed during the shot report x = z = 0 in `final`;
- `final.balls` is sorted by id.

### Corpus change (old → new; why: straight-in pots scratch with the legacy physics, as explained above)

All three rows keep `kind: 'single'`, the brief's power and `expectPocketed: [1]`. Positions are exact decimal literals. The angle comes from `aimAtGhostBall(table, pocketIndex)`, a commented helper in `test/corpus.js`. It computes `atan2(ghost − cue)`, where ghost = ball 1 − 2R·û and û is the unit vector from ball 1 toward the pocket center from `getPocketPositions`.

| row | old | new |
|---|---|---|
| pot-corner | cue (−25, −88.5), ball 1 (−55, −118.5), angle −3π/4, power 30 | cue (−21.8, −70.6), ball 1 (−45.8, −109.3), angle `aimAtGhostBall(·, 0)` = −2.0932814325364077 (15.06° cut), power 30 |
| pot-side | cue (−10, 0), ball 1 (−50, 0), angle π, power 25 | cue (−6.7, 13.7), ball 1 (−50, 0), angle `aimAtGhostBall(·, 2)` = −2.7920528054533316 (20.03° cut), power 25 |
| pot-far-corner | cue (25, 88.5), ball 1 (55, 118.5), angle π/4, power 30 | cue (21.8, 70.6), ball 1 (45.8, 109.3), angle `aimAtGhostBall(·, 5)` = 1.0483112210533858 (15.06° cut), power 30 |

No power adjustments were made.

### Re-verification of the new rows

| row | sim (default TUNING) | sim [1] at p ± 3 (step 0.25) | sim vs legacy fixed60 (TUNING_LEGACY) | legacy fixed60 / 30 / 60 / 120 / 144 FPS |
|---|---|---|---|---|
| pot-corner | [1], 1632 steps | 25/25 | 1632/1632 steps, 04e0307f = 04e0307f, BIT-EXACT | [1] / [1] / [1] / [1] / [1] |
| pot-side | [1], 3528 steps | 25/25 | 3528/3528 steps, 6494fd34 = 6494fd34, BIT-EXACT | [1] / [1] / [1] / [1] / [1] |
| pot-far-corner | [1], 2400 steps | 25/25 | 2400/2400 steps, 55c99814 = 55c99814, BIT-EXACT | [1] / [1] / [1] / [1] / [1] |

### Final checks

- Parity is still 5/5 (`node --test test/parity.test.js`: `# pass 5  # fail 0`), confirmed before regenerating the golden.
- `npm run golden:update -w packages/sim` regenerated the golden.
- `npm test -w packages/sim`: `# tests 21  # pass 21  # fail 0`.
- `npm run typecheck`: exit 0, no errors.
- `bash harness/init.sh`: exit 0, `fast suites: 15/15 passing`, with no packages failing (packages/sim is green).

### Final golden.json

```json
{
  "break": { "hash": "e8130719", "steps": 4002 },
  "medium": { "hash": "2a0b3eff", "steps": 3978 },
  "english": { "hash": "5c4e4061", "steps": 4536 },
  "soft": { "hash": "42eb54d1", "steps": 2592 },
  "draw-rack": { "hash": "53e0d786", "steps": 894 },
  "rail-straight": { "hash": "97c855bf", "steps": 4032 },
  "rail-english": { "hash": "0176617c", "steps": 4332 },
  "long-stun": { "hash": "73aa90da", "steps": 4542 },
  "follow": { "hash": "23206d18", "steps": 3666 },
  "pot-corner": { "hash": "04e0307f", "steps": 1632 },
  "pot-side": { "hash": "6494fd34", "steps": 3528 },
  "pot-far-corner": { "hash": "55c99814", "steps": 2400 },
  "draw-ref": { "hash": "ba6d0239", "steps": 894 }
}
```

### Remaining notes

- `draw-rack` and `draw-ref`: with the legacy tuning the cue ball never reaches ball 1. This is the known Task 8 issue.
