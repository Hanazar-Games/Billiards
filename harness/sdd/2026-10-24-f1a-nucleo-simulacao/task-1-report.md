# Task 1 report: monorepo, cliente em `apps/client`

Status: DONE (one note on the commit trailer, see Concerns).

Commit: `52b543d build: move the game into apps/client and set up npm workspaces`

## What I implemented

- Step 1: D035, D036, D037 are now `"status": "accepted"` with `"source": "plano da F1-A aprovado pelo usuário"`. D010 stays `accepted` and has the new `"note"` (placed right after `source`, text exactly as in the brief). F1-04 `verification` replaced with the two D037 lines. Both JSON files round-trip byte-for-byte through `json.dumps(indent=2, ensure_ascii=False)`, so the style is unchanged.
- Step 3: `git mv` of `src/ test/ scripts/ server/ dist/ index.html vite.config.js` and the old `package.json` into `apps/client/`. All 119 moves are 100% renames (no content change). `apps/client/package.json` is the old root manifest with only `"name": "@billiards/client"` changed (keeps `"version": "1.26.13"`, same scripts and dependencies).
- New root `package.json`: `billiards-online`, private, `type: module`, `workspaces: ["apps/*", "packages/*"]`, scripts `dev`, `build`, `build:pages`, `test:pages` (each `npm run <s> -w apps/client`), `test` (`npm test --workspaces --if-present`), `typecheck` (`tsc -p tsconfig.json`), `devDependencies.typescript` pinned to `5.9.3` (latest 5.9.x from `npm view typescript@5.9 version`). No `version` field.
- New `tsconfig.json` with exactly the compilerOptions and `include` from the brief.
- `npm install` rewrote `package-lock.json` (root `billiards-online`, `apps/client` workspace entry, `node_modules/@billiards/client` link, typescript 5.9.3). `npm ci --dry-run` succeeds against it.
- `.github/workflows/deploy.yml`: `path: ./dist` -> `./apps/client/dist`. The other steps (`npm ci`, `npm test`, `npm run build:pages`, `npm run test:pages`) work unchanged through the root scripts.
- `harness/init.sh`: fast-suite loop now `npm run -s -w apps/client "test:$suite"`; added a loop over `packages/*/package.json` running `npm test -w "<dir>"` and appending failures to `failed` (zero iterations now). I also updated the "rerun with" hint in the failure message, since the old `npm run test:<suite>` no longer exists at the root.
- Spike imports `../../../src/` -> `../../../apps/client/src/` in `spikes/sim-bench/src/world.js` and `src/run-shot.js`.
- `CLAUDE.md`: command table (rules suite via `-w apps/client`, `npm test` description, build output path, new `typecheck` row), the browser-test line, and the intro path `src/` -> `apps/client/src/`.
- `README.md`: Development Commands block rewritten for the workspace layout, plus the two LAN start commands (`npm run dev -w apps/client -- --host 0.0.0.0`, `npm run host -w apps/client`). The root `dev` script would not forward `--host` to vite, so the LAN instructions needed the `-w` form.

## What I ran

Baseline before moving (`CI=1 PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm test > /tmp/f1a-before.log`): `exit=0`.
After the move (same command, `> /tmp/f1a-after.log`): `exit=0`. The root `npm test` now prints `> npm test --workspaces --if-present`.

Per-suite pass lines are identical before and after (`diff` of the extracted summaries is empty; 175 check marks and 0 failures in both logs):

| suite | result |
|-------|--------|
| rules | 28 passed, 0 failed |
| table | 34 passed, 0 failed |
| lan | 20 passed, 0 failed |
| ai | 11 passed, 0 failed |
| audio | pass 6, fail 0 |
| instant-replay | pass 30, fail 0 |
| career | pass 51, fail 0 |
| trainer-challenge-safety | pass 25, fail 0 |
| achievement-toast | pass 8, fail 0 |
| tournament | pass 15, fail 0 |
| highlight | pass 22, fail 0 |
| panels | pass 12, fail 0 |
| runtime | pass 67, fail 0 |
| browser | pass 22, fail 0 |
| smoke | 54 passed, 0 failed |

(ui-layout and settings-audit print check marks only; all present, none failing.)

- `npm run build` (root): built in 1.79 s, output in `apps/client/dist/` with the same hashed asset names (`index-DLQ7FLyp.js`, `three-CsPdlfT-.js`, ...), so the tracked `dist` content is unchanged.
- `(cd spikes/sim-bench && npm test)`: `# tests 5`, `# pass 5`, `# fail 0`.
- `bash harness/init.sh | head -3`: `fast suites: 15/15 passing` (exit 0). `node harness/status.mjs` still reports F1 as the current phase.
- `npm ci --dry-run`: succeeds.
- I did not run `npm run typecheck` (as instructed).

## Files changed

132 files in the commit: 119 renames into `apps/client/`, plus `package.json` (rewritten), `apps/client/package.json` (new), `tsconfig.json` (new), `package-lock.json`, `.github/workflows/deploy.yml`, `harness/init.sh`, `harness/decisions.json`, `harness/feature_list.json`, `CLAUDE.md`, `README.md`, `spikes/sim-bench/src/world.js`, `spikes/sim-bench/src/run-shot.js`, `spikes/sim-bench/test/world.test.mjs`.

## Self-review findings

- `spikes/sim-bench/compare-models.mjs` has no `../../../src/` import (it only imports `./src/*`), so it needed no change. `spikes/sim-bench/test/world.test.mjs` did have one (`BALL` from `../../../src/config.js`), so I updated it; without that the spike's world test would fail. That file is outside the brief's list but is required for "spike with 5 tests passing".
- Historical F0 plan text still shows the old `../../../src/` paths; I left it alone as a record.
- `package-lock.json` keeps a top-level `"version": "1.26.13"` that npm carried over from the old lock, although the root `package.json` has no version. `npm ci --dry-run` is fine with it; I left npm's output as is.
- I did not touch `harness/progress.md` (CLAUDE.md asks for an update at the end of an interaction, but it is not in this task's file list and Task 10 modifies it) and did not mark F1-01 `passes: true`, even though its two verification lines (`npm test` at the root, `npm run build`) now pass; the plan marks features in Task 10.
- No secrets, no `src/` content changes, no push, branch unchanged.

## Concerns

- Commit trailer: `constraints.md` asks for `Co-Authored-By: Claude Opus 5.5`, but this session's attribution instruction names Claude Sonnet 5.5, which is the model that actually did the work. I used `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` plus the same `Claude-Session:` line. If the controller wants the Opus trailer, amend the message (`git commit --amend`); nothing else depends on it.
