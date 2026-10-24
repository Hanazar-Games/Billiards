# SDD ledger — plan: docs/superpowers/plans/2026-10-24-f1a-nucleo-simulacao.md

Spec: docs/superpowers/specs/2026-10-24-billiards-online-design.md (read). F0 report: docs/spikes/2026-10-24-runtime-simulacao.md
Executor: subagent-driven-development; branch claude/planejamento-online; start HEAD c388d67

Ruling: the user answered "Por subagentes" to "O plano captura o que você quer, incluindo a D036? E qual forma prefere?" — treated as approval of the plan and of D035–D037 — cost if wrong: Task 1 flips D035–D037 to accepted; reversible by superseding entries

## Pre-flight: shared interfaces
| Tasks | Produces | Consumes | Finding |
|---|---|---|---|
| T1→T2 | root workspaces, tsconfig include packages/*/src, typescript devDep | T2 runs npm run typecheck | consistent (T1 never runs typecheck; empty include would fail with TS18003, first run is T2) |
| T2→T3 | createWorld(profile,tuning)→SimWorld{world,materials,tableBodies,pockets,profile,tuning}; TUNING/TUNING_LEGACY | ball.js/guards.js/simulate.js take tuning | ambiguity: plan says "ordem: plano, depois tabelas" and test compares sim tableBodies with legacy Table.bodies (cushions only) |
| T3→T4 | guards hooks onBallContact/onCushionContact; ShotResult.events | events.js | consistent; T4 test forbids same pair ball_ball within 1/180 s, so manual swept contact + cannon beginContact of the same contact must be deduped |
| T3→T5 | ShotResult.frames, final.q | frames.js | consistent; t = step/360 matches test (i+1)*12/360 |
| T5→T6 | Frame {t, balls[{id,x,z,q}]} | TrajectoryFrame, encoder t check 1e-9 | consistent |
| T3→T7 | CORPUS kinds (11 non-calibration), runLegacy {fps}, createLegacyWorld | legacy-reference generator | consistent after plan note on building non-rack legacy tables |
| T7→T8 | feel test, legacy-reference.json | calibration must keep feel green; adds opts.probe | consistent |
| T8→T9 | calibrated TUNING, golden.json | bench + golden update | consistent |
| T1..T9→T10 | feature_list item verifications | T10 marks passes | consistent |

## Pre-flight: per-task self-consistency
| Task | Finding |
|---|---|
| T1 | consistent (baseline run before move; README/LICENSE/ANNOUNCEMENT*/SETTINGS_AUDIT stay at root) |
| T2 | 5 tests; see SimWorld.tableBodies ruling |
| T3 | 20 tests total claimed = 5+5+9+1 ✓; golden generated only after parity passes |
| T4 | 25 ✓ |
| T5 | 29 ✓ |
| T6 | protocol 4, sim 30 ✓ |
| T7 | characterization test (passes immediately by design); plan adds a mutation check proving it can fail |
| T8 | probe opt adds 1-step run via maxSimSeconds 1/360 → MAX_STEPS = 1 ✓ |
| T9, T10 | consistent |

Pre-flight Ruling: SimWorld.tableBodies = the 6 cushion bodies only (same as legacy Table.bodies); the table plane is a separate body added first to world.bodies and exposed as SimWorld.planeBody — why: the T2 test compares tableBodies with legacy Table.bodies — cost if wrong: one renamed field
Pre-flight Ruling: push the branch after every completed task (not only at end of interaction) — why: container is ephemeral and the run is long; D028 allows pushes to the working branch — cost if wrong: none
Task 1: dispatched implementer (sonnet) agent a037b6ff2ac423d1f; BASE c388d67
Task 1: implementer DONE_WITH_CONCERNS, commit 52b543d (concerns: trailer names the implementer's model; extra spike test path fix; README LAN commands use -w; F1-01 left for T10)
Ruling: commit trailers keep the Co-Authored-By line the committing agent's own harness gives (52b543d says Sonnet 5.5) plus the Claude-Session line; constraints.md updated — why: attribution should name the model that did the work, and amending rewrites a commit for cosmetics — cost if wrong: one-line amend per commit
Task 1: review package review-c388d67..52b543d.diff; dispatching task reviewer (sonnet)
Push: 52b543d pushed before Task 1 review (stop hook) — fix rounds will add commits on top
Task 1: review Approved (spec ✅; 0 critical/important; 6 minor)
Parked (T1 minors → T10 close-out docs): CLAUDE.md "Durante a F0, não altere src/ server/ test/" stale → point at apps/client or mark historical; README PAGES_OUT_DIR/DIST_DIR now relative to apps/client; init.sh header comment mentions F1 monorepo as future; lockfile top-level version 1.26.13 (cosmetic, leave); typecheck fails TS18003 until T2 adds packages/sim (expected)
Task 1: complete (52b543d, pushed)
Task 2: dispatched implementer (sonnet) agent a93421386437750df; BASE 52b543d
Task 2: implementer DONE, commit 19dfb36; review package review-52b543d..19dfb36.diff; dispatching task reviewer (sonnet)
Push: 19dfb36 pushed (before Task 2 review)
Pre-T3 notes (checked legacy): balls created ids 0..15 (BallsManager.createBalls) and added in that order after plane+cushions (addToScene) → id order matches; Game.js:994 force = max(min(maxPower, max(0,p)), minPower), SHOT.minPower = 0; ShotInput.js:82 spinLength = max(1, hypot); Ball.js:228 random orientation is cosmetic (cannon skips inertia-world update for isotropic inertia); rack8 must reuse _rackEightBall's exact float expressions (d = r*2.02, z = rackZ + (row-1)*d*Math.sin(Math.PI/3))
Task 2: review Approved (spec ✅; 0 critical/important; 6 minor)
Ruling: apply T2 minors 1-3 now (exact orientation compare; 6th test pinning world.bodies[0..6] fields, contact-material pairs by material name, gravity/allowSleep/broadphase, planeBody; widen src lint to import 'three'/import('three')/performance and .js-only listing) — why: they harden the bit-exact base Task 3 depends on, test-only, one small round — cost if wrong: one extra sonnet round
Parked (T2 minors 4-6): BALL/SHOT/profiles mutable shared objects (deep-freeze later, PHYSICS.gravity is Float32Array); index re-exports normalize/cross (public surface); createCushion len redundancy (keeps bit-exact arithmetic)
Task 2: fix round 1 — resumed implementer a93421386437750df; round BASE 19dfb36
Task 2: fix round 1 DONE, commit baa6871 (test-only, 6/6); scoped re-review done by controller (37-line test diff read in full + focused run 6/6) — Ruling: controller re-review for a test-only polish round on an already-Approved task — why: diff is small and fully visible; a reviewer seat would duplicate it — cost if wrong: final review catches it
Task 2: complete (19dfb36, baa6871)
Push: baa6871 pushed
Task 3: dispatched implementer (opus) agent ab930d7bf6a65dd68; BASE baa6871
Ruling (T3 dispatch): "tabela" = cushion → listener checks materials.cushion — why: PT-BR pool term; legacy listener uses cushionMaterial — cost if wrong: none (legacy is the reference)
Ruling (T3 dispatch): expected total 21 tests (brief says 20; Task 2 gained the world-parity test) — cost if wrong: none
Task 3: implementer NEEDS_CONTEXT (no commit; working tree): parity 5/5 bit-exact (+ all 13 corpus rows vs legacy fixed60); 20/21 — pot rows give [0,1] (cue follows ball 1 in, same in legacy); power-only adjustment in 15–60 is knife-edge (±0.01 flips; legacy60 still scratches)
Ruling: option A — turn the three pot rows into cut shots, keep their powers: pot-side ball 1 (−50,0), cue ≈(−6.7,13.7), ~20° cut, power 25; pot-corner ball 1 (−45.8,−109.3), cue (−21.8,−70.6), ~15° cut, power 30; pot-far-corner mirrored (45.8,109.3)/(21.8,70.6), power 30; expectPocketed stays [1] — why: keeps the plan's intent (simple pots of ball 1, D033 corpus) and the criterion unchanged; implementer measured robustness at ±3 power and legacy 30/60/120/144 FPS, which Task 7 needs; option B changes a criterion, option C breaks Task 7 — cost if wrong: re-pick three corpus rows + regenerate golden
Ruling: balls pocketed during the shot report x = z = 0 in final (literal Ball.remove() port, parity requires it); final.balls sorted by id — accepted — cost if wrong: Task 4 pocket events carry the pocket index anyway
Task 3: resumed implementer ab930d7bf6a65dd68 with ruling A
Task 3: implementer DONE, commit 846c667 (21/21; parity 5/5; corpus pot rows → cut shots per ruling A, robust p±3 and legacy 30/60/120/144 FPS; no power changes); pushed before review
Task 3: review package BASE baa6871 (commits 6dca37b harness-only + 846c667); dispatching task reviewer (opus)
Task 3: reviewer (opus) agent a4c2c49e2b496e8a6 dispatched on review-baa6871..846c667.diff
