# Task 2 report: `packages/sim` constants, headless table geometry and physics world

Status: DONE
Commit: `19dfb36 feat(sim): add headless table geometry and physics world` (branch `claude/planejamento-online`, not pushed)

## What was implemented

New workspace package `packages/sim` (`@billiards/sim` 0.1.0, private, ESM, `exports["."] = ./src/index.js`, `scripts.test = node --test test/*.test.js`, `dependencies.cannon-es = 0.20.0`, `devDependencies.three = ^0.170.0`).

`packages/sim/src` (every file starts with `// @ts-check`; no `three`, DOM, `Math.random`, clocks):
- `constants.js`: `SCALE`, `BALL`, `PHYSICS`, `SHOT` copied literally from `apps/client/src/config.js`; the `cm()` helper and `TABLE_PROFILES` (`pool9ft`, `pool8ft`, `bar7ft`, `chinese8` with the 10 physics fields from the brief) copied literally from `TableProfiles.js`, computed with the same expressions (`BALL.radius * 2.55` etc.); `getTableProfile(id)` throws `Error('unknown table profile: <id>')` (no pool9ft fallback; uses `Object.hasOwn` so `'toString'`/`'__proto__'` also throw); `TUNING_LEGACY` and `TUNING` (frozen, same content; `TUNING` is a frozen copy, not the same reference); typedefs `TableProfile`, `Tuning`.
- `math.js`: `normalize`, `cross`, `quaternionFromBasis`, written with the same operation order as Three's `Vector3.normalize` (`x * (1 / (len || 1))`), `crossVectors`, `Matrix4.makeBasis` + `Quaternion.setFromRotationMatrix`.
- `table.js`: `getPocketPositions(profile)` (order `[(-W,-D),(W,-D),(-W,0),(W,0),(-W,D),(W,D)]`, `type` `'corner'`/`'side'`, `y: 0`) and `createTableBodies(profile, cushionMaterial)` (6 bodies in `Table.createCushions` order, box + bevel shape each, same arithmetic as `_getTableGeometryMetrics` physics fields, `addCushion` and `_addCushionBevelPhysics`).
- `world.js`: `createWorld(profile, tuning = TUNING)` returning `{ world, materials: { ball, cushion, table }, planeBody, tableBodies, pockets, profile, tuning }`. Follows the controller ruling: `tableBodies` = the 6 cushions only; the table plane is `planeBody`, added first to `world.bodies`, then the cushions (`world.bodies[0] === planeBody`, `world.bodies[i + 1] === tableBodies[i]`, same as legacy `PhysicsWorld` + `Table.addToScene`). Contact materials in legacy order (ball-cushion, ball-ball, ball-table); ball-cushion restitution, ball-table friction/restitution, solver iterations/tolerance come from `tuning`; the rest from `BALL`.
- `index.js`: `export *` from the four modules (the math helpers are public too).

Test helpers: `test/legacy/env.js` (byte-identical copy of `spikes/sim-bench/src/env.js`) and `test/legacy/legacy-world.js` (`createLegacyWorld({ tableProfileId, mode = '8ball' })` returning `{ physics, table, balls, pockets }`, built like the spike's `world.js` with imports from `../../../../apps/client/src/...` and the cushion-spin `collide` listener). The legacy pockets are `THREE.Vector3` with `.radius`/`.type` already attached, so they are returned as `table.getPocketPositions()` with no adaptation.

`package-lock.json` updated by `npm install` at the root (adds `node_modules/@billiards/sim` link and `packages/sim` entry) and committed.

## TDD evidence

RED (test file and `package.json` written, no helpers or sources yet):
```
$ npm test -w packages/sim
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/billiard/packages/sim/test/legacy/env.js' imported from /home/user/billiard/packages/sim/test/table.test.js
not ok 1 - test/table.test.js
```
Expected: the helpers and `src/` did not exist (the brief expects `Cannot find module`).

GREEN (after implementing helpers and sources):
```
$ npm test -w packages/sim
ok 1 - corpos das tabelas idênticos ao Table.js em todos os perfis
ok 2 - caçapas idênticas ao legado
ok 3 - perfil desconhecido lança erro
ok 4 - materiais e solver iguais ao PhysicsWorld legado
ok 5 - src não importa three nem usa APIs de navegador ou aleatoriedade
# tests 5  # pass 5  # fail 0
```

Type check (after the final edit): `npm run typecheck` exits clean (no output after the `tsc -p tsconfig.json` banner). The first run had 6 errors, fixed before commit: two `export *` collisions from `@typedef {import(...)}` re-declarations (now `@import` tags, which are not exported) and `Solver` lacking `iterations`/`tolerance` in cannon-es types (now a `/** @type {CANNON.GSSolver} */` cast).

Harness: `bash harness/init.sh` exits 0 and prints `fast suites: 15/15 passing`. Its `packages/*` loop runs `npm test -w packages/sim` (a failure would add `packages/sim` to the failed list and fail the script).

Extra parity check (scratch script, not committed): maximum absolute difference of the shape orientations against legacy is exactly 0 over 192 components (4 profiles x 6 bodies x 2 shapes x 4 components), so the port is bit-exact, not just within the test's 1e-12. Positions, half extents and offsets pass `deepEqual`.

## Files changed

- `/home/user/billiard/packages/sim/package.json`
- `/home/user/billiard/packages/sim/src/{constants,math,table,world,index}.js`
- `/home/user/billiard/packages/sim/test/table.test.js` (verbatim from the brief)
- `/home/user/billiard/packages/sim/test/legacy/{env,legacy-world}.js`
- `/home/user/billiard/package-lock.json`

Nothing under `apps/client/src` changed (`git diff 52b543d --stat -- apps` is empty).

## Self-review

- Requirements: all brief interfaces present with the specified names and signatures; controller rulings 1-5 applied.
- Discipline: only what the task asks; non-physics profile fields (`label`, `pocketStyle`, `ballSet`, `enabledFor`...) and the disabled `snooker12ft`/`carom10ft` profiles are intentionally not copied (the brief lists exactly four profiles and ten fields).
- `getCushionMetrics` holds only the physics-relevant fields of `_getTableGeometryMetrics`; the `cornerR ?? pocketRadius` fallbacks are not ported because the sim profile type always has the explicit corner/side radii.
- The pocket mapping I first wrote in `legacy-world.js` was unnecessary and was removed (amended into the same local commit before reporting).

## Concerns

None blocking. Minor notes for the reviewer:
1. `index.js` also re-exports the `math.js` helpers (brief lists them under "Produces" but does not say whether `index` exports them); trivial to narrow.
2. `createLegacyWorld` takes an optional `mode` (default `'8ball'`) like the spike's `world.js`; the brief only lists `tableProfileId`.
3. `BALL`, `PHYSICS`, `SHOT` and `TABLE_PROFILES` are plain mutable objects (literal copies); only `TUNING`/`TUNING_LEGACY` are frozen, as specified. `PHYSICS.gravity` is a `Float32Array`, which cannot be frozen.
4. `npm install` reported "10 high severity vulnerabilities" from pre-existing client dev dependencies; unrelated to this task and left untouched.

---

## Fix round 1 (test hardening)

Commit: `baa6871 test(sim): pin legacy world parity and tighten src lint` (not pushed). Only `packages/sim/test/table.test.js` changed; no `src/` changes.

### Changes

1. Test 1: the per-component `< 1e-12` check on shape orientations is now `assert.deepEqual(b.shapeOrientations[j].toArray(), l.shapeOrientations[j].toArray(), ...)`, exact like the position and offset assertions.
2. New 6th test `'mundo igual ao PhysicsWorld legado: corpos, pares de materiais e flags'`, run for all four profiles. It compares `world.bodies.slice(0, 7)` of the legacy world and the sim world through a view of type, mass, material name, position, quaternion, shape types, `allowSleep` and `collisionResponse`. It also asserts:
   - `sim.world.bodies[0] === sim.planeBody`;
   - `sim.tableBodies` has 6 entries and each is identical (`===`) to `sim.world.bodies[i + 1]` (identity rather than `deepEqual`, which would deep-compare large cannon objects and is weaker);
   - `contactmaterials.map(c => c.materials.map(m => m.name))` equal between legacy and sim;
   - gravity (`toArray()`), `allowSleep`, `broadphase.constructor.name`, `solver.constructor.name`, `quatNormalizeSkip` and `quatNormalizeFast` equal to legacy;
   - every pocket has `y === 0`.
3. Test 5 (src lint): lists only `.js` files (`readdirSync(dir).filter(f => f.endsWith('.js'))`). The regex now also catches `import 'three'` and `import("three")` / `import('three')` (`import\s*\(?\s*['"]three['"]`) and any `\bperformance\b`; the existing alternatives are kept. It still passes on the current src.

The new parity test is the last test in the file (6th) and the lint stays 5th, so the order differs from the brief only in that the lint is no longer last.

### Can-fail checks (each perturbation reverted with `git checkout -- packages/sim/src`; `git status` clean afterwards except the test edit)

- Orientation exactness: in `math.js` `quaternionFromBasis` (the `trace > 0` branch) I changed `w: 0.25 / s` to `w: 0.25 / s * (1 + 2.3e-16)`, a ~1 ulp change that the old 1e-12 tolerance would have accepted. Result: `not ok 1 - corpos das tabelas ...` with message `pool9ft 1.1 orientation`. Other tests stayed green.
- World parity test, three perturbations, each gave `not ok 6 - mundo igual ao PhysicsWorld legado ...` with tests 1-5 still green:
  - `world.allowSleep = false` in `world.js`;
  - plane body added after the cushions in `world.js` (breaks the order and `bodies[0] === planeBody`);
  - pocket `y` changed to `y + 1` in `table.js` (the `y === 0` assertion).
- Src lint, scratch file `src/zz-tmp.js` (starts with `// @ts-check`, removed after each run):

| Content of the scratch file | Test 5 |
|---|---|
| `import 'three';` | not ok |
| `await import("three")` | not ok |
| `await import('three')` | not ok |
| `import * as T from "three"` | not ok |
| `performance.timeOrigin` | not ok |
| `globalThis.performance` | not ok |
| `Date.now()` | not ok |
| `export const ok = 1;` (clean) | ok |

  A `src/notes.md` containing `Math.random, performance.now, import "three"` is skipped (test 5 ok), confirming the `.js` filter.

### Final commands and output

```
$ npm test -w packages/sim
ok 1 - corpos das tabelas idênticos ao Table.js em todos os perfis
ok 2 - caçapas idênticas ao legado
ok 3 - perfil desconhecido lança erro
ok 4 - materiais e solver iguais ao PhysicsWorld legado
ok 5 - src não importa three nem usa APIs de navegador ou aleatoriedade
ok 6 - mundo igual ao PhysicsWorld legado: corpos, pares de materiais e flags
# tests 6  # pass 6  # fail 0

$ npm run typecheck        -> exit 0, no errors
$ bash harness/init.sh     -> fast suites: 15/15 passing
```
