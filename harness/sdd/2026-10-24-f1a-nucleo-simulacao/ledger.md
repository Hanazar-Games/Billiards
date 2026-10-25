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
Task 3: review Approved (opus; spec ✅; 0 critical/important; 6 minor). Reviewer probe: removing applyCushionSpin changes break hash/steps (e8130719/4002 → 7de7d937/3666), so parity can fail
Parked (T3 minors): (1) legacy-run.js freezeClock restores via `delete performance.now` (save/restore own descriptor instead); (2) pocketed cue ball throws even when shot.cueBall is given — ball-in-hand after a scratch must flip pocketed=false before calling, or let cueBall bring the cue back into play (decide in F2/F4 with the modes layer; add a test then); (3) untested extra validation (maxSimSeconds RangeError, bad ids/q/x/z/cueBall; maxSimSeconds < 1/720 → 0 steps capped); (4) missing shot.spin / opts null → TypeError not RangeError (protocol layer validates shapes); (5) final drops q for all balls (visual only; Task 5 adds q to final per plan); (6) draw-rack parity exercises only the cue ball until Task 8 calibration
Task 3: complete (846c667)
Stop: user switching to the local environment after Task 3; Task 4 not dispatched from the cloud session
Resume: local session (inline, superpowers:executing-plans) on 2026-10-24 — ledger copied from harness/sdd; branch claude/planejamento-online fast-forwarded to main f64ebfd (PR #2 merge, no content change); npm install with PUPPETEER_SKIP_DOWNLOAD=1; baseline sim 21/21
Ruling: execute Tasks 4–10 inline (executing-plans) instead of subagents — why: the user asked this session to continue autonomously and did not ask for subagents this time; plan allows either — cost if wrong: no per-task reviewer; the final whole-branch review still runs
Task 4: Ruling: ordering/dedupe test made non-vacuous (asserts ball_ball exists) and run over every corpus shot, not only break — why: it passed with events = [] and the plan's break-only check missed a 1-step repeat in medium — cost if wrong: none (test-only)
Task 4: Ruling: a pair's ball_ball one step after its previous one is dropped (same contact) — why: swept guard leaves the pair at 0.995×2r, cannon reports the same impact on the next step (medium 0-1 at steps 282/283); genuine re-contacts measured ≥ 4 steps apart with much lower speed are kept — cost if wrong: F2 rules see one contact more or less; one constant
Task 4: Ruling: ball_ball speed = |va − vb| before cannon's solver; for guard-resolved contacts, the hook's pre-impulse normal relative speed (legacy passes the same value) — cost if wrong: cosmetic (sound volume)
Task 4: note: draw-rack and draw-ref produce no events — the cue ball stops before ball 1 with the legacy tuning (Task 8 calibration target)
Task 4: note: 26 tests, not 25 (Task 2's extra world-parity test)
Task 4: complete (commits f64ebfd..4dbafba, tests: npm test -w packages/sim → ℹ duration_ms 2617.6519)
Task 5: Ruling: two plan tests passed vacuously on frames = [] (last-sample, quaternions) — added non-vacuity asserts, plus tests for a pocketed ball's last frame (at the pocket mouth, in the first frame at/after its pocket event) and for final q on every ball — cost if wrong: none (test-only)
Task 5: Ruling: checkPockets returns { id, pocketIndex, x, z } (detection spot, read before removeBall parks the body at (0, −1000, 0)) and the sampler gets it via sampler.pocketed(id, x, z) — why: "não estava encaçapada no quadro anterior" lets the pocketing frame include the ball, and its body position is gone by then; showing (0, 0) would teleport it to the table centre in the replay — cost if wrong: additive field + one sampler method
Task 5: Ruling: final q for a ball pocketed in the input = its input q, or identity when absent — why: plan says final q "passa a ser preenchido" for all balls — cost if wrong: none
Task 5: note: 32 tests (26 + 6), not 29 (Task 2's extra test + the 2 added tests)
Task 5: complete (commits 4dbafba..b9cbdff, tests: npm test -w packages/sim → ℹ duration_ms 3337.6929)
Task 6: trajectory sizes (KB): break 36.0, medium 29.7, english 35.4, soft 5.7, draw-rack 0.9, rail-straight 4.3, rail-english 4.6, long-stun 4.8, follow 6.3, pot-corner 1.8, pot-side 3.8, pot-far-corner 2.6, draw-ref 0.9 — all ≤ 48 KB (D037)
Task 6: Ruling: codec also rejects sampleRate ≠ 30 (Error), quaternion index > 3, trailing bytes, non-finite/zero q (RangeError), normalizes q before quantizing and decodes from a subarray view — why: Review Focus 5 asks for no silent overflow; a non-unit q would overflow i16; strict decode — tested (3 extra tests, mutation-checked: fail without the checks) — cost if wrong: a caller embedding the trajectory must slice it out first
Task 6: protocol 7 tests (4 plan + 3), sim 33
Task 6: complete (commits b9cbdff..694777e, tests: sh -c 'npm test -w packages/protocol && npm test -w packages/sim && npm run typecheck' → > tsc -p tsconfig.json)
Task 7: Ruling: withinEnvelope(value, legacyByFps, key, legacy60) takes the 60 FPS metric set as a 4th argument, and low-energy metrics also carry cuePath — why: the plan's position margin is max(1, 2% × cuePath@60) but its 3-arg call never sees cuePath and low-energy had none — cost if wrong: one extra metric checked (stricter)
Task 7: Ruling: runLegacy gains onFrame(frame, fps, balls) with pocketedAt (pre-pocket position) and legacy-world gains placeLegacyTable — why: legacy samples must follow the sim frames' semantics (pocketed ball shown once at the pocket mouth, not at the parked (0, 0)) — cost if wrong: test-only helpers
Task 7: Ruling: added feel-envelope.test.js (6 unit tests for computeMetrics/withinEnvelope) before writing metrics.js — why: one mutation check can't prove every metric branch — cost if wrong: none
Task 7: evidence: sim (TUNING = TUNING_LEGACY) == legacy fixed60 (english totalPath 1601.339 vs 1601.344; pot-side end position identical); legacy-reference.json reproducible (two runs, cmp equal); mutation rollingResistance 30 → all 11 fail
Task 7: STOP (plan Step 2 says stop, don't loosen): english.totalPath 1601.3 outside 1025.1–1447.8 (+m 29.0); pot-side.cuePath 193.6 outside 164.1–185.1 (+m 3.3) and cueZ. Dense sweep 24,30,40,48,50,60,72,75,90,100,120,144,165,240 FPS → all 11 pass (english legacy 1011.6–1752.8; pot-side 162.7–194.1; follow 213.3–324.8; break 931.2–1874.9; soft 134.1–134.7)
Task 7: Ruling: recorded D038 (open) and run english/pot-side as node:test todo (PENDING_D038) so the suite stays green and the failure stays visible — why: plan says take it to the user; committing a red test breaks npm test for the branch — cost if wrong: two shots unchecked until the user answers
Task 7: NOT complete — waiting for the user's D038 ruling
Task 7: user accepted D038 (2026-10-24): reference at 14 FPS, PENDING_D038/todo removed, D035 superseded by D038 — feel 11/11 pass
Task 7: complete (commits 694777e..832b860, tests: sh -c 'npm test -w packages/sim && npm test -w packages/protocol && npm run typecheck' → > tsc -p tsconfig.json)
Task 8: Ruling: found and fixed a crash outside the brief — cannon-es packs body-id pairs into 16 bits (OverlapKeeper.getKey) and Body.idCounter is process-global, so after ~65536 bodies (≈3000 shots in one process) beginContact delivered undefined bodies and simulateShot threw; bodies now get per-world ids in add order (world.addBody helper), golden/parity unchanged — test 'o resultado não depende de quantos corpos o processo já criou' RED→GREEN — why: the sim must be a pure function of its inputs and the server runs many shots per process — cost if wrong: none (relative id order preserved)
Task 8: evidence: cannon ball-table friction rolls the ball up in the first 1/360 s step and conserves 1.5v + ωR (not 2.5v + ωR): legacy draw ball rolls backwards before reaching ball 1; even friction 0.001 breaks the invariant (367 → 334); only ballTableFriction 0 conserves it
Task 8: STOP (brief Step 3 escape: "Se não fechar, pare e leve ao usuário as opções medidas"): >800 tunings (grid 210 + random 600 + 7 small frictions) and 2 temporary model changes (legacy inertia ratio in roll coupling; cushion roll matched to rebound, both reverted) — none passes feel 11/11 + draw ≥ 10 cm + invariant ±5%; pot-side fails in every one (cue path 105–135 vs legacy 163–194: the carried rolling spin drags the side-cushion rebound). Best with draw: rollCoupling 2.04, rollingResistance 3.11, damping 0.0408, rollingSpinFriction 0.195, angularDamping 0.00674, sideSpinFriction 0.96 → draw 61.1 cm, feel 8/11 (long-stun, pot-corner, pot-side out). All attempts in docs/f1/calibragem-recuo.md; reproducible with tools/feel-report.mjs
Task 8: Ruling: recorded D039 (open) with the 3 measured options; TUNING stays TUNING_LEGACY (golden unchanged, no golden:update); calibration tests committed as node:test todo; probe option shipped — why: plan says stop and take options to the user; same pattern as D038 keeps the suite green and the failure visible — cost if wrong: F1-09 sim part waits for the user
Task 8: Ruling: added tools/feel-report.mjs (not in the brief) — why: makes every row of the calibration doc reproducible for whoever resumes — cost if wrong: one test-only script
Task 8: NOT complete — waiting for the user's D039 ruling; Tasks 9–10 do not depend on TUNING values (bench re-runs if TUNING changes)
Task 9: profile (40 breaks): sphereBox 28% + getContacts 10% + vector ops — SAPBroadphase defaults to bounding-sphere tests and the cushion boxes' spheres span the table, so every ball ran sphereBox vs the rails every step
Task 9: Ruling: the only optimization is world.broadphase.useBoundingBoxes = true — physics identical by construction (AABB overlap ⊇ sphere overlap for ball pairs; the narrowphase keeps its per-shape bounding-sphere check; surviving pairs keep SAP order) and by test (golden + parity bit-exact) — so no golden:update and no decision — cost if wrong: none measured
Task 9: Ruling: bench times the spike with its own wallMs (shot loop only, as the F0 baseline) and the sim around the whole simulateShot (world creation, events and frames included) — why: the sim's API is the unit the server pays for; conservative for the sim — cost if wrong: ratio understated
Task 9: bench: {"spikeMedianMs":122.24,"simMedianMs":45.47,"ratio":2.69,"simP95Ms":52.68}
Task 9: complete (commits 2b83739..86039bc, tests: sh -c 'npm run bench -w packages/sim && npm test -w packages/sim' →   })
Task 10: Ruling: F1-03's "tacada com efeito lateral na tabela muda a velocidade angular como no legado" had no direct test (parity covered only rack shots) — added parity for rail-straight, rail-english, long-stun, follow on placed tables (legacy final filtered to the table's balls: placeLegacyTable leaves the removed rack balls in legacy.final) — 9/9 pass; mutation (applyCushionSpin disabled in the sim) → 8/9 fail incl. rail-english — cost if wrong: none
Task 10: Ruling: F1-02's literal grep over packages/sim matches test/legacy/legacy-world.js (the parity harness loads the legacy client, which imports three) — recorded D040 (accepted; the plan the user approved verifies F1-02 by table.test.js's import test) narrowing the grep to packages/sim/src — cost if wrong: none for the server (src is clean)
Task 10: Ruling: F1-03 description "física customizada por passo" → "a 60 Hz de tempo simulado (D036)" and F1-06 verification text → D038 envelope — why: both stale against accepted decisions; text follows them, criteria not loosened beyond what D036/D038 decided — cost if wrong: none
Task 10: Ruling: root npm test first failed in test:browser because puppeteer's Chrome 148 was never downloaded (install used PUPPETEER_SKIP_DOWNLOAD=1) — reran with PUPPETEER_EXECUTABLE_PATH = the system Chrome instead of downloading — cost if wrong: browser suites run on a different Chrome build than CI
Task 10: Ruling: F1-09 note says the sim part is open (D039) instead of the brief's "parte do sim concluída na F1-A" — why: Task 8 did not close — cost if wrong: none
Task 10: verification: root `CI=1 PUPPETEER_EXECUTABLE_PATH=<system Chrome> npm test` → exit=0 (18 client suites incl. browser + smoke 54/54, protocol 7/7, sim); `npm run build` → exit 0; sim 55 pass + 2 todo (with the 9-shot parity); typecheck clean; init.sh "fast suites: 15/15 passing"; status 13/51, open D019, D029, D039. Marked F1-01..F1-06, F1-08 passes:true
Final review: self-review (no subagent: the user did not ask for subagents this session) over f64ebfd..HEAD — 0 critical, 0 important
Final: minor (deferred): events.js pair key a*256+b collides for ball ids ≥ 256 (sim accepts any non-negative id; codec caps at 255)
Final: minor (deferred): ball_cushion events are not deduplicated (a ball resting on a rail or rescued by the guards can emit extras) — F2 rules must not count rails by event count
Final: minor (deferred): frames stop at the last multiple of 12 steps, so up to 1/60 s of motion (and a pocket in it) appears only in final
Finish: workspace kept (Task 8 waits on D039 and must resume from this ledger); finishing-a-development-branch not run — the branch stays unmerged by the user's choice and F1-A is not fully closed
Task 10: complete (commits 86039bc..d73375c, tests: sh -c 'npm test -w packages/sim && npm test -w packages/protocol && npm run typecheck && bash harness/init.sh' → 3. No ambiente local, rode `bash harness/init.sh` (Node ≥ 22.12), porque o hook SessionStart só roda na nuvem. Os testes de navegador precisam de Chromium. O Puppeteer baixa um na instalação, a menos que `PUPPETEER_SKIP_DOWNLOAD` esteja definido. Sem esse download, aponte `PUPPETEER_EXECUTABLE_PATH` para o Chrome do sistema.)
Task 8: resumed 2026-10-25 — user ruling on D039: option 1 ("aceito a sensação nova com o melhor ajuste medido (recuo de 61 cm)") → D041 accepted, D039 superseded
Task 8: Ruling: brief Step 4 says "acrescente D038" — that id was taken by the Task 7 envelope decision; the calibrated TUNING and the new reference are one decision, D041 (next id) — cost if wrong: an id rename
Task 8: Ruling: the reference of long-stun, pot-corner and pot-side is the calibrated sim's own metrics (test/feel/sim-reference.json, single entry under "60" so the D038 margins apply unchanged), not removal from the feel test — why: "trocar a referência" keeps a guard on the accepted feel; test/feel/reference.js pins the list to those 3 and a test asserts it — cost if wrong: the 3 shots are guarded against drift from the accepted feel, not against the legacy
Task 8: Ruling: D033 and D038 stay accepted; D041 says it changes them only for the 3 shots — why: everything else in both still holds, and superseding them would retire the envelope the other 8 shots use — cost if wrong: two status edits
Task 8: Ruling: table.test "materiais e solver iguais ao PhysicsWorld legado" now passes TUNING_LEGACY — why: it compares with the legacy world and was written when TUNING === TUNING_LEGACY; TUNING's world is pinned by the golden — cost if wrong: none for coverage
Task 8: Ruling: tools/feel-report.mjs measures against the same reference as feel.test.js (feelReference) — why: a candidate tuning is judged as the test judges it — cost if wrong: one import
Task 8: RED: calibration tests without todo → "a branca precisa alcançar a bola 1" and "2,5v + ωR: 220.7 → 20.2"; GREEN with attempt-6 TUNING (draw 61.1 cm, 367.9 → 370.3); before golden:update only golden.test failed (brief Expected), after: 58/58
Task 8: bench re-run with the new TUNING: {"spikeMedianMs":395.31,"simMedianMs":107.25,"ratio":3.69,"simP95Ms":147.19} (both slower than in Task 9 on a loaded machine; the ratio gate holds)
Task 8: commits 147d5cb, 2b83739, f0c20fa (Tasks 9 and 10 ran between them)
Task 8: complete (commits 832b860..f0c20fa, tests: npm test -w packages/sim → ℹ duration_ms 7123.297)
Task 8: verification: root `PUPPETEER_EXECUTABLE_PATH=<system Chrome> npm test` → exit=0 (smoke 54/54, protocol, sim 58/58, client suites); typecheck clean
