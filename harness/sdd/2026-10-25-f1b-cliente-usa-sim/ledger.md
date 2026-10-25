# SDD ledger — plan: docs/superpowers/plans/2026-10-25-f1b-cliente-usa-sim.md

User approved the plan (and D042/D043) on 2026-10-25 and chose subagent-driven execution.
Spec: docs/superpowers/specs/2026-10-24-billiards-online-design.md (reachable).

## Pre-flight scan

| Tasks | Produces → consumes | Found |
|---|---|---|
| T1 → T5 | frozen copy in packages/sim/test/legacy/client → T5 deletes client physics | consistent: sim tests stop depending on apps/client before T5 |
| T2 → T3 | SimResult {frames decoded, events, final, steps, simSeconds, capped} → TrajectoryPlayer({initial, frames, events, final, simSeconds}) | consistent (spread of SimResult works) |
| T2 → T4 | simClient.warm()/simulate(table, shot) → Game.simClient | consistent |
| T3 → T4 | advance(dt) → {poses, events, done}; player.time → ShotPlayback.player, pause test | consistent |
| T4 → T5 | no position read via body → T5 removes body | consistent |
| T4 → T6 | Game.shoot/playback/lastShotResult, Ball.reset(x,y,z) (Ball.js:419) | consistent |
| T4 → T7 | playbackRate, onMouseUp, aiPlayer.settings.thinkTimeMin/Max (AIPlayer.js:25-52) | consistent |
| T2/T3/T5/T7 | all edit apps/client/package.json scripts | sequential, no conflict |
| T1 self | test 2 regex /apps\/client/ vs its own test name and the legacy-world.js:1 comment "(apps/client/src)" | CONFLICT → ruling P1 |
| T2 self | tests vs code | consistent |
| T3 self | interpolation test gives q; corpus tables have no q (corpus.js has no `q:`) | gap → ruling P2 |
| T4 self | tests vs Step 4 bullets | consistent |
| T5 self | test vs removals | consistent |
| T6 self | dev hook behind import.meta.env.DEV vs Global Constraint "main thread imports @billiards/sim only by the dev hook" | consistent |
| T7 self | consistent |
| T8 self | consistent |

Ruling P1: T1's "nobody imports apps/client" test matches module specifiers, i.e. quoted strings containing "/apps/client/" (regex /['"][^'"\n]*\/apps\/client\//), not any mention; the legacy-world.js header comment is updated to point at the frozen copy — the plan's literal regex would fail on its own test name and on comments — cost if wrong: a comment-only mention of apps/client would not be caught (harmless).
Ruling P2: TrajectoryPlayer treats a ball without q in `initial`/`final` as the identity quaternion [0, 0, 0, 1] — corpus tables (and the empty-shot test's table) carry no q — cost if wrong: the first interpolation segment of a corpus shot starts from identity rotation instead of the mesh's (visual only, F1-B uses toTableState which always has q).
Task 1: dispatched (BASE 2edc314, implementer sonnet)
Task 1: Ruling: spikes/sim-bench/test/world.test.mjs still imports apps/client config.js — D042 covers the whole spike, so repoint it to the frozen copy and add spikes/sim-bench/test to the scan roots — cost if wrong: one extra import line changed.
Task 1: Ruling: `node --test spikes/sim-bench/test` fails on Node 24 (directory treated as module) — use the spike's own glob `node --test spikes/sim-bench/test/*.test.mjs` — cost if wrong: none (same tests).
Task 1: minor (deferred): legacy-copy.test.js manifest test does not assert the set of .js files under legacy/client equals the manifest keys (an extra unmanifested file would pass).
Task 1: minor (deferred): import scan misses backtick specifiers, paths without a leading slash, path.join forms, and the top-level spike scripts (build.mjs, compare-models.mjs, run-node.mjs); none references apps/client today.
Task 1: ⚠️ resolved by controller: npm test -w packages/sim → 60/60; node --test spikes/sim-bench/test/*.test.mjs → 5/5 at 0d1c8e9.
Task 1: complete (commits 2edc314..0d1c8e9, review clean)
Task 2: dispatched (BASE 0d1c8e9, implementer sonnet)
Env note: browser suites on this machine need PUPPETEER_EXECUTABLE_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe" (puppeteer's pinned Chrome 148 is not cached).
Task 2: minor (deferred): SimWorkerClient.js:97-98 registers the pending entry before postMessage; a throwing postMessage (DataCloneError) leaves a stale entry.
Task 2: minor (deferred): warm() can throw synchronously if module-worker construction throws (e.g. file://) — carried to Task 4 (init calls warm()).
Task 2: minor (deferred): no timeout for a worker that dies without an `error` event; a pending simulate() would hang (shot stuck in SHOOTING).
Task 2: minor (deferred): simulate() after dispose() silently recreates a worker.
Task 2: minor (deferred): _drop terminates before rejecting (SimWorkerClient.js:145-146).
Task 2: ⚠️ resolved by controller: implementer ran test:browser 23/23 and full npm test -w apps/client exit 0 with real Chrome; vite build produced a separate sim.worker chunk; Task 5/8 builds re-verify.
Task 2: complete (commits 0d1c8e9..b01932d, review clean)
Task 3: dispatched (BASE b01932d, implementer sonnet)
Task 3: Ruling: implementer added a 9th test (short-arc nlerp sign flip, mutation-checked) — the brief's 8 tests never exercise the flip the semantics require — cost if wrong: one extra test.
Task 3: Ruling: an invalid dt never completes a shot, even a zero-duration one (done stays false until a valid advance) — "dt inválido não avança" read literally; t=0 events are not skipped — cost if wrong: a zero-power shot waits one valid frame.
Task 3: Ruling: reviewer's 2 Important (plan-mandated) test gaps — event release timing and pocketed-in-final pose not protected (mutations survived) — add two synthetic tests, no production change; the plan's tests stay as written — cost if wrong: two extra tests.
Task 3: minor (deferred): nlerp allocates two arrays per ball per frame; stationary balls could skip normalization.
Task 3: minor (deferred): untested branches — ball without q in final, ball pocketed in initial never appears, invalid dt leaves poses/done unchanged; frames with t <= previous key merge silently.
Task 3: fix round 1/5 (2 addressed, 0 open; commits 0872353..3b72c9b)
Task 3: minor (deferred): trajectory-player.test.js:135 uses assert.equal on a boolean; :157-158 checks only x/z of the held pose, not q.
Task 3: complete (commits b01932d..3b72c9b, review clean)
Task 4: Ruling: a playback advances only while state === 'SHOOTING'; if the state leaves SHOOTING by another path (forced resolveTurn as in the LAN subtest, game over, replay), the playback is dropped (playback = null, ++_shotToken) and resolveTurn is not called again — the plan only covers the normal `done` path and the abandon paths it lists — cost if wrong: a dropped playback leaves meshes mid-trajectory in a path that already ended the turn.
Task 4: Ruling: init() calls simClient.warm() inside try/catch (warm can throw synchronously, Task 2 minor); a construction failure then surfaces on the first simulate() as a failed simulation — cost if wrong: none visible.
Task 4: dispatched (BASE 3b72c9b, implementer opus)
Task 4: implementer concerns noted for review: no watchdog for a silent worker (20 s clock limit removed); cancelled shot still counted in stats; _cancelShot restarts the AI on its turn (not in brief); applyTableState also restores visible/not-pocketed for in-play balls; LAN guest draws no shot trail (snapshots lost velocities); _shotStartTime kept for a runtime test.
Task 4: ⚠️ resolved by controller: sim pocket index order (packages/sim/src/table.js:52-62) equals client Table.js:399-406; event speeds are in the same cm/s units as the legacy relVel/v (the sim ports the legacy world in cm, bit-for-bit parity at TUNING_LEGACY). Failure notice display untested → minor.
Task 4: minor (deferred): zero-power browser test (plan-supplied) doesn't prove the shot resolved — `turns: 1` comes from startTurn in shoot(); add state !== 'SHOOTING' and lastShotResult.steps === 0. (Review Focus 4)
Task 4: minor (deferred): stale-result browser test (plan-supplied) passes without _shotToken (live() also requires SHOOTING); the token-only case (abandon, new shot, old result arrives), dispose/_resetTrainerDrill abandon paths, and ruling 1 are untested. (Review Focus 1)
Task 4: minor (deferred): latent double resolveTurn — _advancePlayback (Game.js:1130-1135) detects abandonment only by playback identity; add `|| this.state !== 'SHOOTING'`.
Task 4: minor (deferred): ruling 1 applied one frame late (Game.js:1296): playback non-null in GAME_OVER/AIM until next unpaused frame; _abandonShot leaves ball.speed set.
Task 4: minor (deferred): _cancelShot restarts the AI — a persistently failing worker loops think→shoot→fail in vs-AI/spectator; a cancelled shot still counts in stats and challenge shot limits (LAN guest's pendingShot relies on host totalTurns increment).
Task 4: minor (deferred): no watchdog when the worker never answers (old 20 s limit removed); a timeout in SimWorkerClient.simulate is the natural follow-up.
Task 4: minor (deferred): LAN guest draws no shot trail (snapshots carry no velocities); pocket sound/flash now per event, not de-duplicated per pocket per frame; first-hit distance measured one frame after contact; failure notice display untested.
Task 4: minor (deferred): ShotPlayback rebuilds final from done poses (ShotPlayback.js:44-54) instead of applying `final` directly — relies on final.balls listing every ball.
Task 4: complete (commits 3b72c9b..f6f4afd, review clean)
Task 5: dispatched (BASE f6f4afd, implementer sonnet)
Task 5: Ruling: accept optimizeDeps.include ['@billiards/sim > cannon-es'] in vite.config.js (not in brief) — without it a cold Vite cache reloads the page when the worker first loads cannon-es and 10 browser tests fail — cost if wrong: one config line.
Task 5: Ruling: dist-smoke's `assets.length >= 3` counted the removed physics chunk; instead of lowering it to >= 2, keep >= 3 and name index-*, three-* and sim.worker-* — no criterion loosened, and it pins the worker chunk — cost if wrong: none.
Task 5: minor (deferred): dead BALL tuning constants left in apps/client/src/config.js (PHYSICS export removed).
Task 5: Ruling: the worker chunk loads with a game, not at boot, so the >= 3 / sim.worker-* assertions live in the free-play subtest after AIM; boot keeps index-*/three-* — cost if wrong: none.
Task 5: minor (deferred): ~28 dead BALL tuning fields in apps/client/src/config.js:17-47 (read by nothing; shots use packages/sim constants).
Task 5: minor (deferred): InstantReplayController.js:171 `ball.speed = 0` has no assertion in instant-replay.test.js.
Task 5: minor (deferred): dist-smoke.test.js chunk regexes duplicated (59-60, 94-96); `>= 3` implied by named checks.
Task 5: minor (deferred): showPhysicsDebug setting is dead (SettingsScreen.js:980, Game.js:3227, SettingsStore.js:234/459; pinned by settings-audit).
Task 5: minor (deferred): no-legacy-physics regex misses ball.body.sleep()/world and dynamic import('cannon-es').
Task 5: minor (deferred): README.md:3,82,149 and SettingsScreen.js:1144 about text still present cannon-es as the game's physics; packages/sim/src header comments point at removed client files (src frozen in F1-B).
Task 5: ⚠️ resolved by controller: tracked apps/client/dist is stale (old physics chunk, no worker) because the plan restores dist after each build; test:dist runs after a fresh build (Task 8). test:pages needs a real PAGES_URL, not run in F1-B.
Task 5: complete (commits f6f4afd..706e18b, review clean)
Task 6: dispatched (BASE 706e18b, implementer sonnet)
Task 6: minor (deferred): browser subtest's `draw >= 10` (plan-mandated) would pass a halved draw; the commit message says it "pins the 61 cm draw" — a ±1 cm band around 61.1 would be safe.
Task 6: minor (deferred): playReferenceShot does not guard networkMode / non-freeplay modes (LAN client would poll forever; 8/9-ball rules see removed balls).
Task 6: minor (deferred): hook skips ui.setHUDState('SHOOTING')/hideReplayHint/_shotStartTime (HUD says AIM during the shot); dev shots count in career stats/highlights and the ball-return tray.
Task 6: minor (deferred): manual script doesn't say the table keeps only the shot's balls until a new game, nor gives expected stop positions (long-stun (0,110.7), pot-corner (−26.9,−76.7), pot-side (−17.7,−65.2), draw-ref final z −66.5); guards and cancel path untested.
Task 6: fix round 1/5 (1 addressed, 0 open; commits 5406454..d631629)
Task 6: minor (deferred): picker assertions in the spin-restore subtest (browser-regressions.test.js:536,539) cannot fail; removing _updateCueTipPicker() at referenceShots.js:47 still passes — spy on it instead.
Task 6: minor (deferred): referenceShots.js:53-59 synchronous-throw branch leaves state SHOOTING (pre-existing); during a reference shot the picker still shows the player's spin, not the corpus spin.
Task 6: complete (commits 706e18b..d631629, review clean)
Task 7: dispatched (BASE d631629, implementer sonnet)
Task 7: Ruling: playHumanTurn floors game.power at 1 because onMouseUp ignores a release below 1 (the real input path) — cost if wrong: the human never plays a sub-1 power shot in this test.
Task 7: Ruling: run time 100–230 s against the 600 s timeout is accepted; timeout and 200-shot cap untouched — cost if wrong: a slow CI machine may need a recorded decision to raise the timeout.
Task 7: Ruling: Important (plan-mandated) verbatim copy of resolveTurn's AI ball-in-hand grid in full-match.test.js:22-38 — extract it into a Game method (`_placeCueBallInHand(behindLine)`, Game.js:2049-2078) that resolveTurn and the test both call; the plan's intent ("a mesma grade") is kept without the copy — cost if wrong: a small refactor of the AI placement path, covered by full-match and the browser suite.
Task 7: minor (deferred): a cancelled shot logs console.warn, which full-match does not collect (the match can pass with failed simulations).
Task 7: minor (deferred): full-match does not assert state GAME_OVER / winner ∈ {1,2}, and reads errors right after gameOver without waiting a few frames.
Task 7: minor (deferred): per-turn wait times out with a generic message (no shot count/state/currentPlayer); unseeded randomness, no shot log; only 3 sample runs (37–71 shots vs cap 200).
Task 7: minor (deferred): browser/server setup block duplicated from browser-regressions.test.js (existing pattern); README.md:130 doesn't list test:full-match.
Task 7: ⚠️ open for Task 8: 600 s timeout under CI=1 (swiftshader) unmeasured; local runs 101–236 s.
Task 7: fix round 1/5 (1 addressed, 0 open; commits 426b2b6..c59a806)
Task 7: minor (deferred): Game.js:1524 doc comment of _placeCueBallInHand says "grid near the head end" but the behindLine branch scans a line.
Task 7: complete (commits d631629..c59a806, review clean)
Task 8: Ruling: Task 8 commits but does not push; the controller pushes after the final whole-branch review and its fix wave (D028 push still happens this interaction) — cost if wrong: none.
Task 8: dispatched (BASE c59a806, implementer sonnet)
Task 8: Ruling: the new Node-only suites (sim-worker, trajectory-player, no-legacy-physics) join FAST_SUITES in harness/init.sh (its header asks for it) — cost if wrong: init.sh runs ~3 s longer.
Task 8: Ruling: the dist shot subtest sits after the free-play subtest (not right after "project URL boots") so the existing worker-chunk check still proves the chunk loads with a game; it waits on Boolean(game.playback) — cost if wrong: none.
Task 8: minor (deferred): dist-smoke.test.js:125 hard-codes a 25 s wait for the real-time shot; may flake under CI=1 (raise playbackRate or drop the override).
Task 8: minor (deferred): progress.md "Estado atual" puts the F1-B block above unlabeled F1-A T1–T10 bullets; "draw-ref recua 61,1 cm no jogo" reads as a browser-asserted figure (browser test asserts >= 10; 61.104 was measured once by the Task 6 run); "revisão final em andamento" must be updated after the final review; status.mjs now reports "fase atual: F2" while F1-09 is open.
Task 8: complete (commits c59a806..12cc725, review clean)
Final: Ruling: final review range is the plan's range 2edc314..HEAD (the branch also carries earlier phases already reviewed) — cost if wrong: none.
Final review (opus): With fixes. Important: (1) cue-hit sound/FX fire in shoot() before the worker answers (break 60–135 ms on desktop); (2) 30 Hz short-arc nlerp shows fast rolling balls spinning backward (break, long-stun, follow). Fix-now minors: zero-power test asserts, token-only stale test, double-resolveTurn guard, full-match collects "shot simulation failed" warnings, dist-smoke asserts no __referenceShot.
Final: Ruling: Important #2 is a plan/spec limit (§6.1 30 Hz) — record D044 `open` (orientation sampling vs v1 format before F4 freezes docs/protocol.md), apply the cheap partial fix in TrajectoryPlayer (when the interval's displacement implies a rolling angle > π, take the arc aligned with the rolling axis and interpolate by axis-angle), and add a rotation check to the manual script — cost if wrong: heavy sliding spin can still alias; the format fix stays open.
Final: Ruling: Minor 6 (guard-resolved contacts now feed sound/stats/achievements) stands — more faithful to what the sim simulated; counts may be slightly higher than legacy — cost if wrong: cushion_master unlocks a bit earlier.
Final: Ruling: Minor 7 (status.mjs reports F2 while F1-09 is open) and Minor 8 (_shotStartTime dead state, pinned by a runtime test) stay deferred — progress.md makes F1-09 step 1 — cost if wrong: a future session reads the wrong phase from status.mjs.
Final: fix wave dispatched (FIX_BASE 12cc725, opus)
Final: fix wave done (commits 12cc725..b214db9): I1 hit feedback at playback start + worker warm-up; I2 rolling-axis heuristic + D044 open + manual-script line; M1–M5; progress.md updated.
Final: Ruling: I2 heuristic accepted as a partial fix — on a 157-shot grid it cuts wrong-way intervals 855 → 380 but makes 105 previously-right intervals wrong (fast shots with moderate draw) and does not fix `follow` (topspin turns > π while rolling < π); corpus has no regressions; the real fix stays with D044 (open) before F4 — cost if wrong: some fast draw shots show wrong-way spin that the short arc showed right; reverting is one commit (afde97c).
Final: Ruling: shoot → playback latency (headless Chrome, prod build: break ~330 ms cold after warm-up, 100–220 ms warm) is inherent to the worker architecture (D011); the hit now waits for the balls; reported to the user for the F1-09 check — cost if wrong: a perceptible delay between release and hit on slow devices.
Final: re-review of fix wave (12cc725..b214db9): all findings addressed, no new Critical/Important.
Final: minor (deferred): _playShotImpact can fire while paused (worker result lands in the ~100–330 ms after a shot; the .then does not check paused).
Final: minor (deferred): the 70 ms cue-hide timer now starts at playback start; a sim shorter than ~70 ms could hide the cue after returning to AIM (unmeasured; zero-power already had the race).
Final: minor (deferred): TrajectoryPlayer.normalize() lacks a zero-length guard (inputs are unit quaternions).
Final: minor (deferred): recorder/trails/power label still start at shoot time (instant replay gets the worker wait as a still lead-in); a LAN guest hears the hit ~100–300 ms before the host's balls move.
Final: complete (commits 2edc314..b214db9)
