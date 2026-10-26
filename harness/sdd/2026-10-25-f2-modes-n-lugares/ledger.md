# SDD ledger — plan: docs/superpowers/plans/2026-10-25-f2-modes-n-lugares.md

User approved the plan (with D045, D046, D047) on 2026-10-25 and chose native execution (executing-plans). Spec: docs/superpowers/specs/2026-10-24-billiards-online-design.md (reachable).

## Pre-flight scan

| Tasks | Produces → consumes | Found |
|---|---|---|
| T1 → T2/T3 | types, createTurnState/endTurn/removeSeat → modes use them for nextSeat and onSeatRemoved | consistent |
| T2 → T3 | shotFacts, test/helpers (ev, mulberry32, config8/9), frozen legacy copy → 9-ball tests and differential | consistent |
| T2/T3 → T4 | eightBall, nineBall, removeSeat/activeTeams → MODES, removeMatchSeat, invariant test | consistent |
| T4 → T5 | MODES, createMatch, applyRuling, removeMatchSeat, currentSeat, eightBallStatus, nineBallStatus → LocalMatchController | consistent |
| T5 → T6 | LocalMatchController (submitShot err.stale/err.rejected, status(), newRack(firstSeat), timeout, choosePushOut, concede, toJSON/restore), toTurnResult, rulingText → Game | consistent |
| T6 → T7 | Game.match.status(), _applyPushOutChoice, playbackRate, _placeCueBallInHand → local-2p test | consistent |
| T6 → T8 | test:rules removed → CLAUDE.md commands, init.sh FAST_SUITES | consistent (T8 updates them) |
| T1 self | 8 turn tests + types test; tsconfig include packages/modes/test | consistent |
| T2 self | 5 ported + 6 new; differential needs frozen legacy (D046) created in Step 1 | consistent |
| T3 self | 23 ported + 4 new | consistent |
| T5 self | 11 tests | consistent |
Task 1: Ruling: the type checks live in test/types.check.ts (no Node imports) and tsconfig includes only that file, instead of packages/modes/test/*.ts — the repo has no @types/node, so tsc cannot check node:test imports; types.test.ts imports the check file so it still runs in the suite — cost if wrong: modes test files other than types.check.ts are not type-checked.
Task 1: complete (commits 25982fb..7d87f44, tests: bash -c 'npm test -w packages/modes && npm run typecheck' → > tsc -p tsconfig.json)
Task 2: Ruling: the rack test compares against the formula 254 / 2 * 0.55 (the legacy halfD * 0.55, 69.85000000000001) instead of the plan's literal 69.85 — the plan's number was the rounded value of the same formula — cost if wrong: none.
Task 2: Ruling: shared helpers (validateCommon, ruling builder, rack, removeSeatFromState, headStringZ) live in src/shared.ts, a file the plan's structure does not list — both modes use them and the plan forbids duplicated logic — cost if wrong: one extra module.
Task 2: differential mutation check: breakRailBalls < 3 instead of < 4 makes the differential fail; restored.
Task 2: complete (commits 7d87f44..a50bc08, tests: bash -c 'npm test -w packages/modes && npm run typecheck' → > tsc -p tsconfig.json)
Task 3: Ruling: ported tests translate the legacy `startShot(p)` (which seats p whatever the turn says) as setting turn.currentSeat = p − 1 before resolveShot (helper `at`) — the three-foul and reset tests shoot twice in a row from seat 0 — cost if wrong: none (test-only translation).
Task 3: Ruling: a foul with the 9 pocketed emits one message NINE_ON_FOUL_RESPOT with params.reason (the client picks the scratch text when reason is SCRATCH), instead of FOUL plus a second code — reproduces the legacy text and reasonCode with one message — cost if wrong: the client mapping must read params.reason.
Task 3: Ruling: THREE_FOUL_LOSS drops respot and ball in hand, as the legacy result that replaces the shot's result — cost if wrong: none (parity).
Task 3: differential mutation check: rail check without the push-out exemption makes the differential fail; restored. Timeouts never happen while a push-out is pending in the differential (the choice comes first); the unit test covers that path.
Task 3: complete (commits a50bc08..4f3983d, tests: bash -c 'npm test -w packages/modes && npm run typecheck' → > tsc -p tsconfig.json)
Task 4: Ruling: the invariant test also asserts that an unfinished match has at least two active teams — a match left with one team must have ended; without it a mode that forgot to declare the winner on removal passed — cost if wrong: none (stricter test).
Task 4: Ruling: MODES is defined in src/index.ts (frozen object) and removeMatchSeat keeps turnId — the plan does not say whether a removal opens a new turn; turnId counts rulings — cost if wrong: F4 may want a new turnId on removal.
Task 4: mutation check: removeSeatFromState without the last-team winner makes the invariant and the concession test fail; restored.
Task 4: complete (commits 4f3983d..2628ab3, tests: bash -c 'npm test -w packages/modes && npm run typecheck' → > tsc -p tsconfig.json)
Task 5: Ruling: toTurnResult's reasonCode is the first outcome code in messages (EIGHT_ON_BREAK_RESPOT, EARLY_EIGHT, LEGAL_EIGHT_WIN, NINE_ON_BREAK_WIN, NINE_ON_FOUL_RESPOT, LEGAL_NINE_WIN, THREE_FOUL_LOSS), else the first foul — the plan's "primeira falta ou primeiro código de desfecho" was ambiguous; this order reproduces the legacy reasonCode (EARLY_EIGHT with a scratch, THREE_FOUL_LOSS) — cost if wrong: achievements/stats keyed on reasonCode see a different code.
Task 5: Ruling: on a worker timeout the controller calls simClient.dispose?.(), so the next shot gets a new worker (SimWorkerClient recreates one after dispose) — a hung worker would otherwise hang every later shot — cost if wrong: a slow-but-alive worker loses its pending reply (none: the shot already timed out).
Task 5: Ruling: status() returns the union of the legacy 8-ball and 9-ball getStatus keys (targetBall null in 8-ball, groups null in 9-ball) plus ballInHand — readers need not branch on the mode — cost if wrong: none.
Task 5: complete (commits 2628ab3..4d8d31c, tests: bash -c 'npm run test:local-match -w apps/client && npm test -w packages/modes' → ℹ duration_ms 566.1523)
Task 6: Ruling: LocalMatchController gains resolveEvents(events, final, shot) (submitShot uses it; the 9-ball browser tests drive a win through it instead of the deleted rules) — the tests needed a way to decide a turn without a sim run — cost if wrong: one extra public method.
Task 6: Ruling: the new browser subtest shoots by code (power 40, SHOOTING, shoot()) instead of a mouse drag, and returns to free play at the end — the drag subtest already covers the input path, and later subtests assume a free-play table — cost if wrong: none.
Task 6: Ruling: a push-out intent and a ball-in-hand placement are kept until the shot's playback starts, so a cancelled shot keeps them for the retry — Review Focus 4 — cost if wrong: none.
Task 6: Ruling: resolveTurn throws when no ruling exists for a shot (no silent fallback); the runtime test mock (gameForTurn) returns a neutral ruling like the old rules mock that always resolved — a missing ruling is a bug to surface — cost if wrong: an unforeseen path that resolves a turn without a shot errors loudly.
Task 6: Ruling: new UI string UIText.shotRejected for a shot the mode refuses (no console.warn, unlike a failed simulation) — cost if wrong: none.
Task 6: Ruling: LAN snapshots carry `match` (MatchState JSON) and `pushOutDeclared` instead of the rules fields; the guest restores the match and reads the winner from match.mode.winnerTeam — cost if wrong: an old host/guest version pair cannot talk (LAN is same-build only).
Task 6: Ruling: runtime-regressions' two direct legacy 8-ball rule tests stay in that file, ported to eightBall.resolveShot with the same assertions — never delete a test — cost if wrong: none.
Task 6: complete (commits 4d8d31c..78ade21, tests: bash -c 'npm test -w apps/client && npm test -w packages/modes && npm run build && git checkout -- apps/client/dist && git clean -fdq apps/client/dist' → [32m✓ built in 2.43s[39m)
Task 7: Ruling: the test waits for the winning shot's playback to end (state leaves SHOOTING, playback null) before the 10 frames and the GAME_OVER check — the controller decides a shot before it plays back, so status().gameOver turns true while the last shot is still on screen; the plan's 'GAME_OVER after 10 frames' read the state too early (first run: both matches ended, winner 1, state still SHOOTING) — cost if wrong: none (stricter wait, same assertions).
Task 7: runs — 1st (before the ruling): both ended, state read too early; 2nd: local2p 10 shots/14.6 s winner 1, 9ball 59/70.1 s winner 2; 3rd: local2p 125/142.7 s winner 1, 9ball 43/53.8 s winner 1. All with empty error lists.
Task 7: complete (commits 78ade21..f641184, tests: npm run test:local-2p -w apps/client → ℹ duration_ms 181269.2921)
Task 8: Ruling: Task 8 commits but does not push yet; the push follows the final whole-branch review and its fixes (D028 push still happens this interaction) — cost if wrong: none.
Task 8: complete (commits f641184..6075757, tests: bash -c 'npm test -w packages/modes && npm run typecheck && bash harness/init.sh' → 3. No ambiente local, rode `bash harness/init.sh` (Node ≥ 22.12), porque o hook SessionStart só roda na nuvem. Os testes de navegador precisam de Chromium. O Puppeteer baixa um na instalação, a menos que `PUPPETEER_SKIP_DOWNLOAD` esteja definido. Sem esse download, aponte `PUPPETEER_EXECUTABLE_PATH` para o Chrome do sistema.)
Final: Ruling: final review range is the plan's range 25982fb..HEAD (the branch carries earlier phases already reviewed) — cost if wrong: none.
Final review (opus): With fixes. Critical: resetGame racks the match with the last shooter's seat (newRack(currentPlayer − 1) before currentPlayer = 1), so a rematch after player 2's last shot rules the break for the wrong player. Important: EASY AI spin up to |1.22| is rejected as BAD_INPUT (sim used to normalize); the ledger is not committed at harness/sdd/... as progress.md says.
Final: minor (deferred): nineBall.applyChoice ignores the answering seat (the pusher could answer their own push-out; a cheating hole for the F4 server).
Final: minor (deferred): LAN guest HUD (groups, remaining, summary winner) updates at the strike, because host snapshots during SHOOTING carry the already-ruled match state.
Final: minor (deferred): a failure in _startPlayback after the ruling was applied cancels the shot on screen but leaves the match advanced (no pre-shot state restore).
Final: minor (deferred): conceding during the playback of a winning shot leaves match.status().winner (the shot's) different from the Game's concede winner.
Final: minor (deferred): toTurnResult reports scratch on a THREE_FOUL_LOSS whose third foul was a scratch; legacy did not (one extra scratch in stats).
Final: minor (deferred): empty block `if (this.state === 'SHOOTING') {}` left in Game.js (~498).
Final: minor (deferred): rulingText completeness test accepts a code if either mode has a text; local-2p does not fail on shotRejected.
Final: minor (deferred): restore() does not check modeId; toJSON() returns the live object.
Final: Ruling: declined-to-judge items stand — cue-ball placement checks beyond the kitchen, SeatSlot.timeouts/3-timeout abandonment/60 s reserve, tableProfiles enforcement and random racks are F4/F7/F9 scope per the plan; legacy quirks (timeout on the break keeps the break, push-out stays after a timeout, "pass" names the next player) are kept for parity (D046); cancelled/rejected shot stats are F4 per the plan; createInitialState needs method-call form, as every caller uses — cost if wrong: F4 must add the server-side checks.
Final: fixed rematch seat mismatch (resetGame racks with seat 0, the player resetGame starts) — browser subtest "a rematch after player 2 ends a game starts player 1 in the game and in the match" RED (match 2) → GREEN, browser 33/33.
Final: fixed EASY AI spin rejected (|spin| > 1) — _simulateShot normalizes the tip offset like ShotInput; runtime test "the shot sent to the match has its spin normalized, like the LAN input path" RED → GREEN, runtime 69/69.
Final: fixed ledger missing from the repo — committed at harness/sdd/2026-10-25-f2-modes-n-lugares/ledger.md; the turnId-on-removal question recorded as D048 (open).
Final: suite after the fix pass — npm test exit 0 (browser 33, full-match, local-2p 2/2, smoke 54, runtime 69; modes 51; protocol 7; sim 60), tsc clean.
