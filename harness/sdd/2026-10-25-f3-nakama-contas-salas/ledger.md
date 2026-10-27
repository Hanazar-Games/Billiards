# SDD ledger — plan: docs/superpowers/plans/2026-10-25-f3-nakama-contas-salas.md

User approved the plan on 2026-10-25 with D049 (VPS) and D050–D052, and will install Docker Desktop on this machine; execute here. Spec: docs/superpowers/specs/2026-10-24-billiards-online-design.md (reachable).

## Pre-flight scan

| Tasks | Produces → consumes | Found |
|---|---|---|
| T1 → T2 | services/nakama package, infra:up (builds the module), env.ts/waitForNakama → T2 build replaces the provisional build | consistent |
| T2 → T4/T5/T6 | REGISTRY, initModule, generated glue, bundle test → handlers registered later | consistent (bundle test grows with REGISTRY) |
| T3 → T4/T5/T6 | validateUsername, parseAvatar, parseRoomCode, generateRoomCode, parseMatchConfig(raw, MODES) → profile, rooms, matchmaker | consistent |
| T3 → T5 | modes without structuredClone → bundle test forbids structuredClone once MODES is bundled | consistent (T3 removes it first) |
| T4 → T5/T6 | newBot, once/withTimeout (T6 adds) → integration tests | consistent |
| T5 → T6 | match handler 'billiards' → matchmakerMatched creates it | consistent |
| T1–T6 → T7 | infra:up, test, test:integration, infra:down → CI workflow | consistent |
Setup: Ruling: native execution (executing-plans), the user's choice for F2; the user did not restate a method for F3 — cost if wrong: no per-task reviewer (one final review instead).
Setup: Ruling: Task 3 runs first (it needs no Docker; Docker Desktop is not installed yet), then Tasks 1, 2, 4, 5, 6, 7, 8 — T3 consumes nothing from T1/T2 — cost if wrong: none.
Setup: Ruling: D049 (VPS) to D052 are accepted now, and D019 is superseded by D049, at the start rather than in Task 1's commit — the user approved them in chat — cost if wrong: none.
Task 3: Ruling: the name filter has two lists — BLOCKED_WORDS (distinctive, refused anywhere in the skeleton) and BLOCKED_TOKENS (short or ambiguous, e.g. 'puta' inside 'computador', 'viado' inside 'enviado', refused only as a whole part) — the plan's '≥4 letters = substring' rule would refuse computador/enviado — cost if wrong: a disguised ambiguous word inside a longer name passes.
Task 3: complete (commits 3fe0bc9..8365b4f, tests: bash -c 'npm test -w packages/protocol && npm test -w packages/modes && npm run typecheck' → > tsc -p tsconfig.json)
Task 1: Ruling: files committed after RED ('Nakama não está no ar'); Step 4 (infra:up + healthcheck) waits for Docker Desktop, so Task 1 is not marked complete until it runs green — Docker is not installed yet — cost if wrong: none (the task stays open).
Task 2: Ruling: registry.ts exports REGISTRY and globalName() but no initModule — Nakama reads the InitModule source to map each registered id to a global function, so the generated glue writes every register call literally; an initModule inside the IIFE could not register closures — cost if wrong: none.
Task 2: unit part green (bundle 3/3, tsc clean); Step 4 integration (module.test.ts) waits for Docker.
Task 4: Ruling: two more stable error codes — PAYLOAD_INVALID (profile_update with bad JSON or nothing to change) and PROFILE_VIA_RPC (the refused UpdateAccount) — the plan lists the domain codes but not these two cases — cost if wrong: clients see two extra codes.
Task 4: unit part green (module 9/9, tsc clean); integration (accounts.test.ts, 8 tests) waits for Docker.
Task 5: Ruling: two more codes — ROOM_CODE_EXHAUSTED (5 attempts found only codes in use) and PAYLOAD_INVALID for bad JSON — cost if wrong: clients see two extra codes.
Task 5: Ruling: a room reopens (label open: true) when a seated player leaves, and an empty room ends after 60 ticks (1 per second); the lobby keys presences by userId so the same player can rejoin — the plan says "a sala enche → open: false" and is silent on leaving — cost if wrong: a third player could take a seat freed by a disconnect (F4 reconnection will revisit).
Task 5: unit part green (module 19/19, tsc clean, no structuredClone in the bundle); integration (rooms.test.ts, 4 tests) waits for Docker.
Task 6: Ruling: test:integration runs the files one at a time (--test-concurrency=1), and the matchmaking tests disconnect their sockets at the end — parallel files would let one file's 8-ball ticket pair with another's — cost if wrong: a slower integration run.
Task 6: unit part green (module 21/21, 10 registrations, tsc clean); integration (matchmaking.test.ts, 2 tests) waits for Docker.
Task 7: Ruling: the workflow uses Node 24 (the dev machine's), not 22.12 — the integration tests run .ts files, and Node only strips types without a flag from 22.18/23.6 on — cost if wrong: CI does not catch a Node 22.12-only break.
Task 7: first CI run (40255056468): infra:up and the unit tests passed; the integration step hung until the 20-min job timeout (cancelled). Job logs need sign-in. Ruling: bots' sockets are closed after each file (closeBots), test:integration adds --test-timeout=90000 and --test-force-exit, and the workflow writes the test summary and Nakama warnings as annotations (readable without sign-in) — open sockets kept the test process alive — cost if wrong: none.
Task 7: second CI run (40256810419): passed — healthcheck, same device, improper username, USERNAME_TAKEN, readable profile, UpdateAccount refused, invalid Google token, 2-bot matchmaking; failed — both e-mail link tests and join_by_code (ROOM_NOT_FOUND). Annotations cap at 10 per type, so the run is only partly visible.
Task 7: Ruling: CI writes a JUnit report and services/nakama/test/integration/summary.mjs turns it into one annotation per failing test plus a totals notice; the workflow calls node --test directly with the script's flags (options after the file globs would not reach Node) — cost if wrong: the flags are listed twice (script and workflow).
Task 7: Ruling: infra/nakama/local.yml sets match.label_update_interval_ms: 100 (default 1000) — a just-created room is not in the label listing yet, a likely cause of ROOM_NOT_FOUND — cost if wrong: none in dev; production config is separate.
Task 7: Ruling: rpcError throws a plain { message, code } object (as the Nakama runtime docs show) instead of an Error — the client message carried the goja stack ("ROOM_NOT_FOUND at rpcError (index.js:…)") — cost if wrong: none.
Task 7: third CI run (40257014431?): 13 passed, 3 failed — ROOM_FULL test got ROOM_NOT_FOUND once the room had 2 players (null size bounds likely read as 0), and both e-mail tests got HTTP 400 with the body hidden. Ruling: matchList gets explicit size bounds (0..64) and the account tests unwrap client errors (call()) — cost if wrong: none.
Task 7: fourth CI run: 12 passed, 4 failed — e-mail: nakama-js 2.8 is linkEmail(session, { email, password }) (the tests passed positional strings; the server answered "proto: syntax error"); rooms: both room tests got ROOM_NOT_FOUND, while the first passed in run 3 — a new room reaches the label listing after an indexing delay.
Task 7: Ruling: join_by_code keeps the label listing (spec §7.5); the room tests wait up to 5 s for the room to be listed (and for the full room's label), retrying only on ROOM_NOT_FOUND — clients should do the same — cost if wrong: a real lookup bug would show as a 5 s timeout instead of an instant failure.
CI run 40257461881 on 33bc3e5 (https://github.com/rguilherme10/billiard/actions/runs/40257461881): Integration (Nakama) success — 16 passed, 0 failed (health 1, module 1, accounts 8, rooms 4, matchmaking 2).
Task 1: complete (commits 8365b4f..653f6ac and fixes through 33bc3e5, tests: CI run 40257461881 → healthcheck test pass; infra:up --wait healthy)
Task 2: complete (commits 653f6ac..6964742, tests: npm test -w services/nakama → bundle 3/3; CI run 40257461881 → module test pass)
Task 4: complete (commits 6964742..317ebf1 and test fixes through 33bc3e5, tests: npm test -w services/nakama → profile 6/6; CI run 40257461881 → accounts 8/8)
Task 5: complete (commits 317ebf1..3884abc and fixes through 33bc3e5, tests: npm test -w services/nakama → match 5/5, rooms 5/5; CI run 40257461881 → rooms 4/4)
Task 6: complete (commits 3884abc..b06557a, tests: npm test -w services/nakama → matchmaker 2/2; CI run 40257461881 → matchmaking 2/2)
Task 7: complete (commits b06557a..33bc3e5, tests: CI run 40257461881 success)
Ruling: Tasks 1, 2, 4, 5, 6 are recorded complete on the CI run instead of a local integration run (D051 allows CI); Docker Desktop is still not installed here — cost if wrong: none (the same tests ran green on GitHub's runner).
Task 8: Ruling: F3-01 to F3-05 are marked on CI run 40257461881 (D051), and the push waits for the final review — cost if wrong: none.
Task 8: complete (commits 33bc3e5..dbe8c0a, tests: bash -c 'npm test -w services/nakama && npm test -w packages/protocol && npm run typecheck' → > tsc -p tsconfig.json)
Final: Ruling: final review range is f032a4e..HEAD (the F3 plan commit to the close-out) — cost if wrong: none.
Final review (opus): With fixes. Critical C1: AuthenticateCustom/Facebook/GameCenter (no config needed) create accounts with any username, bypassing the hooks. Important: I1 built-in ListMatches exposes private rooms and codes; I2 separators split blocked tokens (p_u_t_a, c_u, f_d_p); I3 false positives (porra→pora refuses temporada, iporanga, ponta_pora; otario refuses notario); I4 an old connection's leave frees the new connection's seat; I5 infra:up does not reload the module (docs say it does).
Final: minor (deferred): M1 default guest usernames are Nakama's mixed-case random names (breaks D052's lowercase invariant until the player sets one).
Final: minor (deferred): M2 diminutives pass (merdinha, bucetinha, caralhinho) — use stems.
Final: minor (deferred): M3 "room that ended empty → ROOM_NOT_FOUND" has no test (60 s limit not configurable).
Final: minor (deferred): M4 matchmaker hook does not check group size; forged pairs still get onmatchmakermatched without match_id (client must treat as failure); consider matchmaker.rev_precision.
Final: minor (deferred): M5 room creation is unlimited per user (each room is a goja VM for 60 s).
Final: minor (deferred): M6 two integration tests accept any rejection (e-mail of another account, invalid Google token).
Final: minor (deferred): M7 docs drift — servidor-local.md says Node ≥ 22.12 (type stripping needs 22.18+/23.6+); CLAUDE.md npm test/typecheck rows omit services/*. (The ledger itself is committed under harness/sdd/ at the finish.)
Final: minor (deferred): M8 production notes — console.signing_key missing from the secrets list, refresh key derived as <session>-refresh, secrets unquoted in the compose sh line, label_update_interval 1 s in production needs client retries.
Final: minor (deferred): M9 refresh_token_expiry_sec not set (default may be shorter than the 7200 s session).
Final: minor (deferred): M10 @heroiclabs/nakama-js pulls @scarf/scarf install-time analytics (opt out with scarfSettings or SCARF_ANALYTICS=false).
Final: minor (deferred): M11 build.mjs builds the entry path from URL.pathname (breaks with spaces); use fileURLToPath.
Final: minor (deferred): M12 other built-in APIs (chat channels/DMs, storage writes, groups, status, client-created matches) still open — recorded as D053 (open) for F4 before deploy.
Final: Ruling: declined-to-judge items stand — reconnection beyond the seat fix (F4, §7.4), room-code display (F5), list completeness (plan-sized), real Google login (F5), 2×2 seats/spectators (F7), rename limits/squatting (post-MVP), Actions pinned by tag (project style), explicit matchList bounds (harmless; the comment is corrected to say they are explicit, not that null fails) — cost if wrong: none for F3.
Final: Ruling: D053 (open) records which built-in Nakama APIs F3 closes (other auth methods, UpdateAccount, ListMatches) and which must be closed before the F4 deploy (chat channels and DMs, storage writes, groups, status, client-created matches) — the reviewer's M12; the spec forbids free chat and client storage writes — cost if wrong: none (decision to take in F4).
Final: fixed C1 unvalidated auth methods — profile test "métodos de autenticação sem validação de nome são recusados" RED→GREEN; CI "autenticação custom (sem validação de nome) é recusada" green.
Final: fixed I1 private rooms listed by clients — match test "a listagem de partidas pelo cliente é recusada" RED→GREEN; CI "o cliente não consegue listar salas privadas" green.
Final: fixed I2 separators around short words — protocol test "separadores não disfarçam palavras curtas" RED→GREEN.
Final: fixed I3 false positives (temporada, iporanga, ponta_pora, notario…) — protocol test "palavras comuns e lugares que contêm um pedaço bloqueado passam" RED→GREEN.
Final: fixed I4 old connection's leave freeing the new seat — match test "a saída da conexão antiga não libera o lugar da nova" RED→GREEN.
Final: fixed I5 module reload — npm run infra:reload (build + recreate Nakama, wait healthy), exercised in CI before the tests; docs corrected.
Final: suite after the fix pass — protocol 15/15, nakama unit 24/24, tsc clean, init.sh green; CI run 40259666251: integration 18/18.
