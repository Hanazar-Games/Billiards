# F4-A — Partida online 1×1 autoritativa (servidor): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dois bots jogam uma partida inteira de 8-ball contra o servidor, que é a autoridade em tudo:
- o Nakama valida e quantiza cada tacada;
- o `services/sim` simula a tacada;
- o Nakama aplica as regras de `packages/modes` e manda a trajetória a todos;
- a partida tem cronômetro, reconexão, abandono e histórico gravado uma única vez.

**Architecture:**
- **`services/sim`:** serviço HTTP em Node que expõe `simulateShot`. Ele roda num contêiner próprio, sem porta publicada, e exige um segredo no cabeçalho.
- **Manipulador `billiards`:** sai do saguão da F3 e vira a partida completa. O código fica dividido em módulos por responsabilidade em `services/nakama/src/game/`. A cada tacada aceita, o manipulador chama o sim com `nk.httpRequest`, que é síncrono (§6).
- **Contrato:** as mensagens, o envelope binário e a quantização ficam em `packages/protocol`, para o cliente da F4-B usar o mesmo contrato.
- **Mesa autoritativa:** as operações sobre a mesa (arrumar, pôr a branca, repor bolas) vão para `packages/modes`, que é código puro e já roda no goja.

**Tech Stack:**
- Nakama 3.41.0 (goja), PostgreSQL 16 e Node 24 (`node:24-alpine`), em Docker Compose;
- TypeScript 5.9 e esbuild 0.28.2;
- `node:http`;
- `@heroiclabs/nakama-js` 2.8.0 nos bots;
- `node:test`;
- GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-10-24-billiards-online-design.md`](../specs/2026-10-24-billiards-online-design.md):
- §5.1 (componentes) e §6 (fluxo da tacada, trajetória, mensagens e versões);
- §7.2 a §7.4 (lugares e turnos, cronômetro, desconexão e reconexão);
- §9.1 a §9.4 (erros, segurança, testes e operação);
- §10 (F4).

Base: o plano da F3 ([`2026-10-25-f3-nakama-contas-salas.md`](2026-10-25-f3-nakama-contas-salas.md)) e as decisões D045, D047, D048, D049, D050, D051 e D053.

## Decisões que este plano propõe

Registradas em `harness/decisions.json` com `status: "open"` junto com este plano. A Tarefa 1 as marca como `accepted` quando o plano for aprovado. Nessa hora, a D044 passa a `superseded` pela D057, e a D048 pela D058.

| Id | Decisão | Por quê |
|----|---------|---------|
| **D054** | A F4 se divide em duas partes, cada uma com plano próprio. | O roteiro só pede bots, mas o marco vertical da spec (§10) e o `OnlineMatchController` (§5.3) pedem o cliente. A F4 inteira (8 a 14 dias) passa do tamanho que se revisa de uma vez. O servidor vem antes porque o cliente consome o contrato dele. |
| | **F4-A (este plano):** o servidor autoritativo, itens F4-01 a F4-07. | |
| | **F4-B:** o cliente online (`OnlineMatchController` e telas mínimas de entrada, fila e sala), a implantação na VPS com TLS e o fechamento da D053, com itens novos. O critério de saída da F4 ganha "dois navegadores jogam uma partida online 1×1 completa". | |
| **D055** | **Protocolo v1:** | A spec fixa as operações e o envelope, mas não cobre o push-out do 9-ball nem a prévia da bola na mão. Sem a operação 7, uma sala de 9-ball (já permitida na F3) trava no push-out. O texto fica em ASCII porque o goja não tem `TextEncoder`. |
| | `PROTOCOL_VERSION = 1` e `SIM_VERSION = 1`, conferidos ao entrar (metadado `protocolVersion`; se não bater, `PROTOCOL_MISMATCH`). | |
| | Operações C→S 1 a 7. A 7 é nova: `push_out_choice`. | |
| | Operações S→C 101 a 109. A 109 é nova: a retransmissão de `ball_in_hand_move`. | |
| | `emote` (4) e `rematch_vote` (6) ficam reservadas (`UNSUPPORTED_OP`) até a F4-B ou a F5. | |
| | As mensagens 101 e 105 vão num envelope binário: `[u32 LE tamanho do cabeçalho][cabeçalho JSON em ASCII][trajetória v1]`. As outras vão em JSON. | |
| | **Quantização:** ângulo em 1e-5 rad, força em 1e-3, efeito em 1e-3 e posição da branca em 0,01 cm. | |
| **D056** | **Ritmo:** `tickRate` 10. O servidor aceita a próxima tacada sem esperar a reprodução. | Um cliente que atira antes da hora só perde a própria animação: o estado é do servidor. Esperar a reprodução no servidor faria uma partida de teste levar vários minutos. |
| | O prazo da vez é o fim da reprodução (`simSeconds` + 1 s) mais 45 s, o que cumpre o "cronômetro começa ao fim da reprodução" (§6). | |
| | As fases usadas são `LOBBY`, `AWAITING_SHOT` e `ENDED`. A `SIMULATING` dura só a chamada síncrona, e a reprodução é descrita pelo `lastResult` do snapshot. | |
| **D057** | Fecha a D044 com a opção (c): a trajetória continua v1, e o reprodutor mantém a heurística do arco. Uma v2 com velocidade angular pode vir depois, com versões novas de protocolo e trajetória. | O cliente é web e recarrega quando a versão muda (§6.3), então mudar o formato depois custa pouco. As poses giradas ao contrário que restam (27 em 23.537) são um defeito visual, não de estado. |
| **D058** | Fecha a D048: `removeMatchSeat` sempre avança o `turnId`. | Com isso, nenhum `shot_request` antigo é aceito depois que um lugar sai. Uma tacada em trânsito do lugar que continua recebe `TURN_MISMATCH` e um snapshot, e é reenviada com o `turnId` novo. |
| **D059** | **`services/sim`:** | O contêiner não baixa nada no build. A trajetória vai em base64 porque o `nk.httpRequest` só lida com texto. O registro de versões permite rodar N e N−1 durante uma atualização (§6.3). |
| | um bundle do esbuild (`services/sim/build/server.mjs`) numa imagem `node:24-alpine`, só na rede do compose; | |
| | segredo no cabeçalho `x-sim-secret` (variável `SIM_SECRET`); | |
| | registro de versões `{ 1: simulateShot }`; | |
| | a resposta é JSON, com a trajetória em base64. | |
| **D060** | **Histórico e arrumação:** | O histórico com as tacadas permite refazer a partida no servidor. A leitura pública não expõe nada que a partida já não mostre. A arrumação continua fixa (D047) até haver uma ordem aleatória com semente. |
| | coleção `match_history`, com chave = `matchId` e dono = usuário do sistema; | |
| | leitura pública (2) e escrita só do servidor (0), gravada com `version: '*'` (só cria); | |
| | o registro traz os jogadores, quem abriu (sorteado pelo servidor), as tacadas quantizadas e o resultado; | |
| | partidas abortadas não geram registro. | |

## Global Constraints

- **Versões fixas:** `heroiclabs/nakama:3.41.0`, `postgres:16-alpine` e `node:24-alpine`; `esbuild` 0.28.2; `@heroiclabs/nakama-js` 2.8.0.
- **`services/*` em TypeScript,** só com sintaxe apagável. O bundle do Nakama tem `target: 'es2017'`.
- **O que entra no bundle do Nakama** roda no goja. Não pode usar:
  - `structuredClone`, `import()` dinâmico ou `require`;
  - APIs da web ou do Node (`TextEncoder`, `TextDecoder`, `fetch`, `Buffer`);
  - funções de biblioteca mais novas que o ES2017 (`Object.fromEntries`, `Array.prototype.flat`).
- **Toda função registrada no Nakama** é uma declaração `function` global na cola gerada (D050).
- **Segredos:**
  - o `infra/.env.example` só ganha `SIM_SECRET=dev-sim-secret`, marcado como valor de desenvolvimento;
  - o `services/sim` não publica porta;
  - nunca entra no repositório um segredo real.
- **Tempos:**
  - `TICK_RATE = 10`;
  - vez: 45 s, reserva de reconexão: 60 s, sala vazia: 60 s;
  - saguão de partida pública sem adversário: 30 s;
  - simulação: 3 s de timeout e 1 nova tentativa; 3 falhas na partida a abortam.
- **Limites:**
  - mais de 5 tacadas inválidas em 10 s → `matchKick`;
  - `aim_update` e `ball_in_hand_move`: até 15 por segundo e por conexão; as outras mensagens, até 5 (o excedente é descartado).
- **Mesa online:** `pool9ft`. A geometria (`width`, `depth`) vem de `TABLE_PROFILES`, o raio de `BALL.radius` e a força máxima de `SHOT.maxPower`. Esses valores são lidos de `@billiards/sim/constants`, que não importa o `cannon-es`.
- **Códigos estáveis em inglês** para recusas e erros, listados em `docs/protocol.md`.
- **O cliente não muda nesta parte** (a F4-B cuida dele). A exceção é o `LocalMatchController`, que passa a usar `placeCueBall` de `packages/modes`.
- **Testes:**
  - o `npm test` da raiz não depende do Docker: o `services/sim` testa o servidor HTTP no próprio processo;
  - a integração roda onde houver Docker: no GitHub Actions, a cada push (D051), e no `server` da rede, com `NAKAMA_HOST=server`;
  - os itens F4 só são marcados depois de uma execução verde da integração, registrada no `progress.md`.
- **Idioma e commits:** documentos em PT-BR; código e commits em inglês (conventional commits). Commit e push na branch de trabalho ao fim de cada interação (D028).

## Review Focus

1. **Mensagens que chegam em momentos estranhos:**
   - Uma tacada duplicada no mesmo lote é ignorada e responde com um snapshot.
   - Uma tacada que chega no tick do prazo recebe `TURN_MISMATCH`: o relógio roda antes das mensagens.
   - Uma tacada vinda da conexão antiga de uma segunda aba é ignorada.
   - Testes nas Tarefas 4, 5 e 6.
2. **Limite de ritmo e contagem de inválidas:**
   - 6 tacadas inválidas espaçadas de 250 ms derrubam a conexão.
   - 6 tacadas no mesmo segundo derrubam só 5: a sexta é descartada pelo limite de ritmo antes de ser contada.
   - Teste na Tarefa 4.
3. **Os dois jogadores caem:** quando a reserva de um lugar acaba e o outro também está desconectado, a partida termina `ABORTED`, sem vencedor e sem histórico. Ninguém ganha por W.O. de alguém que também sumiu. Teste na Tarefa 6.
4. **Sim lento ou fora do ar:**
   - A espera de até cerca de 6 s (duas tentativas) enfileira mensagens. Depois dela, uma tacada repetida da fila é tratada como reenvio válido da mesma vez: a tacada que falhou não conta.
   - Na terceira falha da partida, `match_end` `ABORTED`.
   - Teste na Tarefa 5.
5. **Partida do matchmaker em que o adversário nunca chega:** depois de 30 s, `match_end` `ABORTED` para quem esperou. Uma sala privada espera até ficar vazia por 60 s. Teste na Tarefa 4.

## Fora do escopo da F4-A

- **Cliente (F4-B):** `OnlineMatchController`, telas de login, fila e sala, e a reprodução de tacadas remotas no `Game`.
- **Implantação (F4-B):** VPS, TLS e as APIs nativas da D053.
- **Outras fases:**
  - emotes, revanche e loadout no snapshot (F5 e F6);
  - espectadores e 2×2 (F7);
  - ranking (F9).
- **Métricas Prometheus do sim (§9.4):** a F4-A só registra uma linha de log por chamada.

## Estrutura de arquivos

```
packages/protocol/src/messages.ts      PROTOCOL_VERSION, SIM_VERSION, OP, parsers, quantizeShot, tipos das mensagens S→C
packages/protocol/src/envelope.ts      encodeEnvelope/decodeEnvelope, bytesToBase64/base64ToBytes
packages/modes/src/table.ts            rackTable, placeCueBall, respotBalls
services/sim/src/server.ts             createSimServer (rotas, segredo, versões, limites)
services/sim/src/main.ts               lê SIM_SECRET e PORT e escuta
services/sim/build.mjs, Dockerfile     bundle único e imagem node:24-alpine
services/nakama/src/game/state.ts      GameState, constantes de tempo e limites, createGameState
services/nakama/src/game/send.ts       snapshot por presença, envelopes, JSON
services/nakama/src/game/intake.ts     ritmo, leitura das mensagens, recusas, inválidas e matchKick
services/nakama/src/game/shots.ts      tacada aceita → sim → regras → shot_result; tempo esgotado; push-out
services/nakama/src/game/sim.ts        callSim com timeout e nova tentativa
services/nakama/src/game/seats.ts      início, saída, volta, segunda aba e W.O.
services/nakama/src/game/end.ts        endMatch, desistência, histórico
services/nakama/src/match.ts           o manipulador "billiards" ligando tudo (substitui o saguão da F3)
services/nakama/test/fakes.ts          fakeNakama, fakeDispatcher, message, decodeSent
services/nakama/test/integration/game.ts      GameBot: socket, envelopes, waitFor, reconnect
services/nakama/test/integration/autoplay.ts  chooseShot pelo método da bola fantasma
docs/protocol.md                       o protocolo v1 completo
```

---

### Task 1: Contrato da partida em `packages/protocol`

**Files:**
- Create: `packages/protocol/src/messages.ts`, `src/envelope.ts`, `test/messages.test.ts` e `test/envelope.test.ts`.
- Modify:
  - `packages/protocol/src/index.ts`;
  - `harness/decisions.json`: D054 a D060 viram `accepted`; a D044 passa a `superseded` pela D057, e a D048 pela D058.

**Interfaces:**
- Produces:
  - **Versões e operações:**
    - `PROTOCOL_VERSION = 1` e `SIM_VERSION = 1`.
    - `OP`, objeto congelado:

      ```ts
      { AIM_UPDATE: 1, SHOT_REQUEST: 2, BALL_IN_HAND_MOVE: 3, EMOTE: 4, CONCEDE: 5, REMATCH_VOTE: 6, PUSH_OUT_CHOICE: 7,
        MATCH_SNAPSHOT: 101, AIM_RELAY: 102, SHOT_ACCEPTED: 103, SHOT_REJECTED: 104, SHOT_RESULT: 105,
        SEAT_UPDATE: 106, MATCH_END: 107, ERROR: 108, BALL_IN_HAND_RELAY: 109 }
      ```
  - **Leitura das mensagens C→S.** Cada função devolve um objeto novo só com os campos conhecidos, ou `null`. `turnId` e `seq` são inteiros em [0, 2³¹−1], e todo número precisa ser finito.
    - `parseShotRequest(raw: unknown): ShotRequestMessage | null`, com `ShotRequestMessage = { turnId, seq, angle, power, spin: { x, y }, cueBall?: { x, z }, pushOut?: boolean }`;
    - `parseAimUpdate(raw)`: `{ turnId, angle, spin, power? }`;
    - `parseBallInHandMove(raw)`: `{ turnId, x, z }`;
    - `parsePushOutChoice(raw)`: `{ turnId, accept: boolean }`.
  - **Quantização:** `quantizeShot<T extends ShotRequest>(shot: T): T`. Arredonda o ângulo a 1e-5, a força a 1e-3, a branca a 0,01 e cada componente do efeito a 1e-3. Se o efeito arredondado passar de comprimento 1 + 1e-9, o efeito original é levado a comprimento 1 e cada componente é arredondado em direção a zero, com folga de 1e-6 no `floor` contra o erro de ponto flutuante. `ShotRequest` é o tipo de `@billiards/modes`, redeclarado aqui sem importar o pacote.
  - **Tipos dos cabeçalhos S→C** (genéricos em `M` = estado da partida e `T` = mesa, para o protocolo não depender de `modes`):
    - `SnapshotHeader<M, T>`: `{ protocolVersion, simVersion, mode, format, phase, you: { seat: number | null }, seats: SeatInfo[], turnId, match: M | null, table: T | null, turn: TurnInfo | null, playback: { result: ShotResultHeader<M, T>; offsetMs: number } | null, end: MatchEnd | null }`.
    - `ShotResultHeader<M, T>`: `{ kind: 'shot' | 'timeout' | 'choice', turnId, seq: number | null, seat, shot: ShotRequest | null, events, final: T, table: T, ruling: { fouls, ballInHand, nextSeat, winnerTeam, respot, messages }, match: M, durationMs, capped, nextTurn: TurnInfo | null }`.
    - Os auxiliares:
      - `SeatInfo = { seat, userId, username, connected, timeouts }`;
      - `TurnInfo = { seat, turnId, deadlineInMs }`;
      - `MatchEnd = { winnerTeam: number | null, reason: 'WIN' | 'CONCEDE' | 'ABANDON' | 'ABORTED', summary: { turns, shots } }`.
  - **Recusas:** `SERVER_REJECT_REASONS = ['BAD_MESSAGE', 'NOT_AWAITING_SHOT', 'TURN_MISMATCH', 'NO_CHOICE_PENDING']`. Elas se somam às `RejectReason` dos modos.
  - **Envelope:**
    - `encodeEnvelope(header: unknown, payload?: Uint8Array): Uint8Array`. O JSON do cabeçalho tem cada caractere acima de U+007F escapado como `\uXXXX`.
    - `decodeEnvelope(bytes: Uint8Array): { header: any; payload: Uint8Array }`. Lança `RangeError` em envelope truncado, cabeçalho com byte ≥ 0x80 ou JSON inválido.
  - **Base64:** `bytesToBase64(bytes: Uint8Array): string` e `base64ToBytes(text: string): Uint8Array`. A segunda lança `RangeError` em texto inválido. São JavaScript puro, porque o goja não tem `Buffer` nem `atob`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// test/envelope.test.ts
test('envelope ida e volta com cabeçalho acentuado e trajetória', () => {
  const payload = Uint8Array.from({ length: 5000 }, (_, i) => (i * 37) & 0xff);
  const bytes = encodeEnvelope({ msg: 'ação', n: 1.5 }, payload);
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true);
  assert.ok(bytes.subarray(4, 4 + headerLength).every((b) => b < 0x80));
  assert.deepEqual(decodeEnvelope(bytes), { header: { msg: 'ação', n: 1.5 }, payload });
});
test('envelope truncado lança RangeError', () => { /* bytes.subarray(0, 6) and a header length larger than the buffer */ });
test('base64 confere com o Buffer em todos os tamanhos de 0 a 300', () => { /* bytesToBase64 === Buffer.from(b).toString('base64'); base64ToBytes back */ });
test('base64 inválido lança RangeError', () => { /* 'abc', 'ab$=', '====' */ });

// test/messages.test.ts
test('shot_request válido volta só com os campos conhecidos', () => {
  assert.deepEqual(parseShotRequest({ turnId: 3, seq: 7, angle: 1, power: 50, spin: { x: 0, y: 0.5 }, extra: 1 }),
    { turnId: 3, seq: 7, angle: 1, power: 50, spin: { x: 0, y: 0.5 } });
});
test('números não finitos e inteiros inválidos dão null', () => {
  for (const bad of [JSON.parse('{"turnId":0,"seq":0,"angle":1e999,"power":1,"spin":{"x":0,"y":0}}'),
    { turnId: -1, seq: 0, angle: 0, power: 1, spin: { x: 0, y: 0 } }, { turnId: 1.5, seq: 0, angle: 0, power: 1, spin: { x: 0, y: 0 } },
    { turnId: 0, seq: 0, angle: '1', power: 1, spin: { x: 0, y: 0 } }, { turnId: 0, seq: 0, angle: 0, power: 1, spin: null }, null, 'x']) {
    assert.equal(parseShotRequest(bad), null);
  }
});
test('fuzz: os leitores nunca lançam e só aceitam números finitos', () => {
  // 5000 random JSON-like values from a seeded rng (nested objects, NaN-ish strings, huge numbers, arrays) through
  // the four parsers: no throw; every accepted value has only finite numbers.
});
test('quantizeShot arredonda nos passos da D055 e é idempotente', () => {
  const q = quantizeShot({ angle: 0.123456789, power: 50.12345, spin: { x: 0.70710678, y: 0.70710678 }, cueBall: { x: 1.23456, z: -7.891 } });
  assert.deepEqual(q, { angle: 0.12346, power: 50.123, spin: { x: 0.707, y: 0.707 }, cueBall: { x: 1.23, z: -7.89 } });
  assert.deepEqual(quantizeShot(q), q);
});
test('o efeito quantizado nunca passa de comprimento 1', () => {
  // 2000 random unit and sub-unit spins: Math.hypot(q.spin.x, q.spin.y) <= 1 + 1e-9 and each component within 1e-3 of the input
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/protocol`
Expected: FAIL, porque os módulos não existem.

- [ ] **Step 3: Implementar `messages.ts` e `envelope.ts` e exportar em `index.ts`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/protocol && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol harness/decisions.json
git commit -m "feat(protocol): match messages, quantization and the binary envelope"
```

---

### Task 2: Mesa autoritativa em `packages/modes` (e D058)

**Files:**
- Create: `packages/modes/src/table.ts` e `packages/modes/test/table.test.ts`.
- Modify:
  - `packages/modes/src/index.ts`;
  - `packages/modes/src/match.ts`: `removeMatchSeat` avança o `turnId`;
  - `packages/modes/test/match.test.ts`;
  - `apps/client/src/match/LocalMatchController.js`: `withCueBall` dá lugar a `placeCueBall`.

**Interfaces:**
- Produces:
  - `rackTable(layout: BallPlacement[], tableProfileId: string): TableState`: as bolas em ordem de id, todas com `pocketed: false`.
  - `placeCueBall<T extends TableState>(table: T, cueBall: { x: number; z: number }): T`: a branca vai para o ponto e volta ao jogo. Não muta a entrada, e os outros campos de cada bola (como `q`) ficam.
  - `respotBalls<T extends TableState>(table: T, ids: number[], geometry: TableGeometry): T`: porta de `Game._respotBall` (apps/client/src/game/Game.js:1726).
    - Só repõe as bolas encaçapadas, na ordem de `ids`. Uma bola reposta antes bloqueia a seguinte.
    - O ponto é a marca do pé, `(0, depth / 2 · 0,55)`.
    - Se alguma outra bola em jogo estiver a menos de 2,2 R do ponto, tenta `x = +k · 2R` e depois `−k · 2R`, para k de 1 a 10. Se nenhum estiver livre, usa `x = 0`.
  - `removeMatchSeat` devolve `turnId + 1` (D058).

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('rackTable arruma as 16 bolas do 8-ball em jogo, em ordem de id', () => { /* ids 0..15, all pocketed false, ball 0 at headStringZ */ });
test('placeCueBall põe a branca no ponto e a tira da caçapa sem mexer no resto', () => { /* input untouched; q of other balls kept */ });
test('o 8 encaçapado volta à marca do pé', () => { /* x 0, z depth/2*0.55, pocketed false */ });
test('com a marca ocupada, vai para +2R; com +2R também, para −2R', () => { /* two tables */ });
test('bola que não está encaçapada não se mexe', () => { /* respotBalls(table, [8]) with 8 on the table → same object values */ });
test('removeMatchSeat avança o turnId', () => { /* createMatch → removeMatchSeat → turnId 1 */ });
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/modes`
Expected: FAIL, porque `table.ts` não existe e o `turnId` continua 0.

- [ ] **Step 3: Implementar `table.ts`, ajustar `removeMatchSeat` e trocar `withCueBall` por `placeCueBall` no cliente**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/modes && npm run test:local-match -w apps/client && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/modes apps/client/src/match/LocalMatchController.js
git commit -m "feat(modes): authoritative table operations and turnId on seat removal"
```

---

### Task 3: `services/sim` com segredo e versões (F4-01)

**Files:**
- Create: `services/sim/package.json` (`@billiards/sim-service`), `build.mjs`, `Dockerfile`, `.dockerignore`, `src/server.ts`, `src/main.ts` e `test/server.test.ts`.
- Modify:
  - `infra/docker-compose.yml`: entra o serviço `sim`, e o Nakama ganha `depends_on` dele e as variáveis do runtime;
  - `infra/.env.example`: `SIM_SECRET=dev-sim-secret`;
  - `package.json` da raiz: `infra:up` e `infra:reload` geram também o sim e usam `--build`;
  - `services/nakama/src/registry.ts`: o `healthcheck_module` diz se o sim está configurado;
  - `services/nakama/test/bundle.test.ts` e `test/integration/module.test.ts`, que conferem a resposta do `healthcheck_module`;
  - `harness/init.sh`: `services/sim` entra nas suítes rápidas.

**Interfaces:**
- Consumes: `simulateShot` e `CORPUS` (`@billiards/sim`, `@billiards/sim/corpus`); `SIM_VERSION`, `bytesToBase64` e `base64ToBytes` (Tarefa 1); `encodeTrajectory`.
- Produces:
  - `createSimServer(options: { secret: string; versions?: Record<number, SimulateFn>; maxBodyBytes?: number }): http.Server`. Devolve o servidor sem escutar. `SimulateFn = (table, shot) => ShotResult`. Os padrões são `versions = { [SIM_VERSION]: simulateShot }` e `maxBodyBytes = 65536`.
  - **Rotas e respostas** (sempre JSON):

    | Pedido | Resposta |
    |--------|----------|
    | `GET /healthz`, sem segredo | 200 `{ ok: true, versions: [1] }` |
    | `POST /simulate`, com `x-sim-secret` e corpo `{ simVersion, table, shot }` | 200 `{ trajectory: <base64>, events, final, steps, simSeconds, capped }` |
    | Segredo ausente ou errado (a comparação usa `timingSafeEqual`) | 401 `{ error: 'UNAUTHORIZED' }` |
    | Corpo maior que o limite | 413 `{ error: 'BODY_TOO_LARGE' }` |
    | JSON inválido, ou sem `table` ou `shot` | 400 `{ error: 'BAD_REQUEST' }` |
    | Versão fora do registro | 400 `{ error: 'SIM_VERSION_UNSUPPORTED', versions }` |
    | A simulação lança erro | 400 `{ error: 'SIM_INPUT_INVALID', detail }` |
    | Qualquer outro caminho | 404 `{ error: 'NOT_FOUND' }` |
  - `main.ts`:
    - exige `SIM_SECRET` não vazio; sem ele, sai com código 1 e a mensagem `SIM_SECRET is required`;
    - escuta em `PORT` (o padrão é 8080);
    - registra uma linha JSON por pedido: `{ path, status, ms }`.
  - **Build e imagem:**
    - `build.mjs` gera `build/server.mjs` com o esbuild (`platform: 'node'`, `format: 'esm'`, `target: 'node24'`).
    - O `Dockerfile` usa `FROM node:24-alpine`, copia só o `build/server.mjs`, roda como `USER node`, faz `EXPOSE 8080` e usa `CMD ["node", "server.mjs"]`.
  - **Compose:**
    - O serviço `sim` tem `build: ../services/sim`, `environment: { SIM_SECRET }`, nenhuma porta publicada e um healthcheck que roda `node -e` com um `fetch` em `http://127.0.0.1:8080/healthz`.
    - O Nakama ganha `--runtime.env "SIM_URL=http://sim:8080"` e `--runtime.env "SIM_SECRET=${SIM_SECRET}"`.
  - O `healthcheck_module` devolve `{ module, version, simConfigured: Boolean(ctx.env.SIM_URL && ctx.env.SIM_SECRET) }`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// services/sim/test/server.test.ts — the server listens on port 0 inside the test process
test('chamada sem segredo é recusada', async () => { /* no header → 401 UNAUTHORIZED; wrong secret → 401 */ });
test('simVersion desconhecida é recusada', async () => { /* simVersion 999 → 400 SIM_VERSION_UNSUPPORTED, versions [1] */ });
test('aceita as versões N e N−1 do registro', async () => { /* versions { 1: fakeA, 2: fakeB }: 1 and 2 reach their own fn; 3 → refused */ });
test('a abertura volta igual à simulação local', async () => {
  // CORPUS 'break': res.final deepEquals simulateShot(table, shot).final, and
  // base64ToBytes(res.trajectory) equals encodeTrajectory(local.frames)
});
test('corpo grande demais dá 413, JSON inválido dá 400 e perfil desconhecido dá SIM_INPUT_INVALID', async () => { /* … */ });
test('GET /healthz responde sem segredo', async () => { /* 200 { ok: true, versions: [1] } */ });
test('sem SIM_SECRET o serviço não sobe', () => { /* spawnSync node src/main.ts with env without SIM_SECRET → status 1, stderr has the message */ });
```

No `bundle.test.ts`, a resposta passa a ter `simConfigured: false` (o contexto do teste não tem as variáveis). Na integração, o `module.test.ts` espera `simConfigured: true`.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w services/sim`
Expected: FAIL, porque o pacote não existe.

- [ ] **Step 3: Implementar o serviço, o build, a imagem e a ligação no compose**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w services/sim && npm test -w services/nakama`. Depois, onde houver Docker: `npm run infra:up && npm run test:integration -w services/nakama`.
Expected: PASS. O `docker compose ps` mostra o `sim` saudável e sem porta publicada.

- [ ] **Step 5: Commit e push; conferir a CI**

```bash
git add services/sim services/nakama infra package.json package-lock.json harness/init.sh
git commit -m "feat(sim): internal simulation service with shared secret and versions"
git push -u origin claude/planejamento-online
```

Confira a execução do workflow `Integration (Nakama)` pela API pública do GitHub. A anotação `integration totals` deve mostrar 0 falhas.

---

### Task 4: Início da partida, snapshot e entrada de mensagens (F4-02)

**Files:**
- Create: `services/nakama/src/game/state.ts`, `src/game/send.ts`, `src/game/intake.ts`, `src/game/seats.ts`, `test/fakes.ts`, `test/game-start.test.ts`, `test/game-intake.test.ts`, `test/integration/game.ts` e `test/integration/game.test.ts`.
- Modify:
  - `services/nakama/src/match.ts`: o manipulador passa a ligar os módulos de `game/`;
  - `src/nakama.ts`: os tipos novos do runtime;
  - `test/match.test.ts`: `tickRate` 10 e limites em segundos;
  - `test/integration/rooms.test.ts` e `matchmaking.test.ts`: entram com o metadado de versão;
  - `services/nakama/package.json`: dependência `@billiards/sim` (`*`), usada só pelas constantes;
  - `packages/sim/package.json`: export `"./constants": "./src/constants.js"`.

**Interfaces:**
- Consumes: Tarefas 1 e 2. Também `MODES`, `createMatch` e `currentSeat` (`@billiards/modes`), e `TABLE_PROFILES`, `BALL` e `SHOT` (`@billiards/sim/constants`).
- Produces:
  - **`nakama.ts` ganha:**
    - `MatchMessage.data: ArrayBuffer`;
    - `Nakama.binaryToString(data: ArrayBuffer): string`;
    - `Nakama.httpRequest(url, method, headers, body, timeoutMs): { code: number; body: string }`;
    - `Nakama.storageWrite(writes: StorageWrite[]): unknown`;
    - `MatchDispatcher.matchKick(presences: Presence[]): void`;
    - `broadcastMessage` aceita `data: string | ArrayBuffer | null`.
  - **`state.ts`:**
    - `TICK_RATE`, `SECONDS = { turn: 45, reconnect: 60, empty: 60, fill: 30, playbackGrace: 1, endLinger: 10 }` e `LIMITS = { invalidShots: 5, invalidWindowSeconds: 10, relayPerSecond: 15, otherPerSecond: 5, simTimeoutMs: 3000, simAttempts: 2, simFailures: 3 }`;
    - `ONLINE_TABLE = 'pool9ft'` e `onlineConfig(): MatchConfig`;
    - `GameEnv = { ctx: Context; logger: Logger; nk: Nakama; dispatcher: MatchDispatcher }`, montado pelo manipulador a cada chamada e recebido por todas as funções de `game/` que falam com o runtime;
    - `createGameState(params): GameState`.
  - **`GameState`** (as tarefas seguintes usam estes nomes):
    - sala: `mode`, `format`, `code`, `private` e `seats` (2);
    - jogadores: `presences: Record<userId, Presence>` (a conexão mais nova) e `players: { userId, username }[]` (por lugar, fixo no início);
    - partida: `phase: 'LOBBY' | 'AWAITING_SHOT' | 'ENDED'`, `match: MatchState | null`, `table: TableState | null` (com `q`) e `firstSeat`;
    - tempo: `createdTick`, `emptyTicks` e `deadlineTick`;
    - reprodução e reenvio: `lastResult: { header, trajectory: Uint8Array, tick, durationTicks } | null` e `lastAccepted: Record<seat, { turnId, seq }>`;
    - conexões: `disconnectedAt: Record<seat, tick>`;
    - limites: `invalid: Record<userId, tick[]>` e `rate: Record<sessionId, { second, relay, other }>`;
    - falhas e histórico: `simFailures` e `shots: { turnId, seat, shot }[]`;
    - fim: `end: MatchEnd | null`, `endTick` e `historyWritten`.
  - **Manipulador:**
    - `matchInit`: `tickRate` 10 e rótulo `{ mode, format, code, private, open, started }`.
    - `matchJoinAttempt` recusa, nesta ordem:
      1. `PROTOCOL_MISMATCH`, se `Number(metadata?.protocolVersion)` for diferente de `PROTOCOL_VERSION`;
      2. `MATCH_ENDED`, se a partida já terminou;
      3. `ROOM_FULL`, se a partida começou e o usuário não é jogador dela, ou se o saguão está cheio e o usuário é novo.
    - O `matchLoop` roda nesta ordem: relógio (`runClock`, nas Tarefas 5 e 6), mensagens (`handleMessage`) e fins de saguão.
  - **`seats.ts`:**
    - `startGame(env, state, tick)` roda quando os dois lugares se ocupam:
      - os lugares seguem a ordem de entrada;
      - quem abre é `Math.floor(Math.random() * 2)`;
      - a partida é `createMatch(MODES[mode], onlineConfig(), Math.random, firstSeat)`, com o `userId` de cada lugar;
      - a mesa é `rackTable(MODES[mode].rackLayout(match.mode), ONLINE_TABLE)`;
      - `deadlineTick = tick + 45 · 10`;
      - o rótulo passa a `open: false, started: true`, e um snapshot vai para cada presença.
    - `handleLeave(env, state, presence, tick)` marca a desconexão e manda `seat_update { seat, connected: false }` aos outros. A reserva e o W.O. são da Tarefa 6.
  - **`send.ts`:**
    - `sendSnapshot(dispatcher, state, presences, tick)`: um envelope por presença, com o `you.seat` dela;
    - `broadcastEnvelope(dispatcher, op, header, payload?)`;
    - `sendJson(dispatcher, op, body, presences?)`.

    Os envelopes vão como `ArrayBuffer` do tamanho exato.
  - **`intake.ts`:** `handleMessage(env, state, message, tick)`.
    1. **Ritmo:** por `sessionId` e por segundo de ticks. As operações 1 e 3 entram no balde `relay` (até 15); as outras, no `other` (até 5). O excedente é descartado sem resposta.
    2. **Remetente:** uma mensagem de quem não é jogador, ou de uma sessão que não é a atual do jogador, é descartada.
    3. **Leitura:** `nk.binaryToString` e depois `JSON.parse`; se falhar, `shot_rejected { seq: null, reason: 'BAD_MESSAGE' }`.
    4. **Operações:**
       - 1 e 3: valem só do lugar da vez e com o `turnId` atual. São retransmitidas aos outros como 102 e 109, com `seat`.
       - 2: `handleShotRequest`.
       - 4 e 6: `error { code: 'UNSUPPORTED_OP' }`.
       - 5 e 7: Tarefas 7 e 5.
       - Qualquer outra: `UNSUPPORTED_OP`.
  - **`handleShotRequest(env, state, presence, raw, tick)`.** As recusas vêm nesta ordem:
    1. leitura nula: `BAD_MESSAGE`;
    2. `(turnId, seq)` igual ao `lastAccepted` do lugar: é reenvio. O servidor responde com um snapshot só para o remetente, e isso não conta como inválida;
    3. fase diferente de `AWAITING_SHOT`: `NOT_AWAITING_SHOT`;
    4. não é o lugar da vez: `NOT_YOUR_TURN`;
    5. `turnId` diferente: `TURN_MISMATCH`;
    6. a tacada é quantizada, e `mode.validateShot` recusa: o motivo do modo.

    Cada recusa manda `shot_rejected { seq, reason }` ao remetente e registra o tick em `invalid`. Mais de 5 registros nos últimos 100 ticks levam a `matchKick([sender])` e zeram o registro. A aceitação é da Tarefa 5.
  - **Fins de saguão:**
    - Uma partida pública que fica 30 s sem lotar manda `match_end { winnerTeam: null, reason: 'ABORTED' }` e termina.
    - Qualquer sala termina depois de 60 s vazia.
  - **`test/fakes.ts`:**
    - `fakeNakama(overrides?)` registra `http` e `writes`, e o `binaryToString` dele usa `Buffer`;
    - `fakeDispatcher()` registra `sent`, `kicked` e `labels`;
    - `message(presence, op, body | string)` monta o `data` em `ArrayBuffer`;
    - `decodeSent(sent)` lê o envelope das operações 101 e 105 e o JSON das outras.
  - **`test/integration/game.ts`:**
    - `joinGame(bot, matchId): Promise<GameBot>` entra com `{ protocolVersion: '1' }`;
    - `startPrivateGame(mode = '8ball'): Promise<{ bots: [GameBot, GameBot]; matchId }>` espera o snapshot dos dois;
    - `GameBot` tem `socket`, `seat`, `snapshot`, `received`, `waitFor(op, predicate?, ms?)`, `send(op, body | string)`, `shoot(shot, seq?)` e `reconnect()`. O `reconnect` abre um socket novo e entra de novo.

- [ ] **Step 1: Escrever os testes que falham**

Unitários, com `fakeNakama` e `fakeDispatcher`:

```ts
test('a partida começa quando os dois entram: cada um recebe o snapshot com o próprio lugar', () => {
  // two joins → two 101 envelopes; you.seat 0 and 1; same table (16 balls, rackTable); turn.seat === match.mode.turn.currentSeat;
  // turn.deadlineInMs === 45000; label { open: false, started: true }
});
test('entrada sem protocolVersion ou com outra versão é recusada', () => { /* PROTOCOL_MISMATCH */ });
test('tacada fora do turno → shot_rejected NOT_YOUR_TURN', () => { /* … */ });
test('números não finitos → shot_rejected BAD_MESSAGE', () => { /* data '{"turnId":0,"seq":1,"angle":1e999,…}' */ });
test('turnId antigo → TURN_MISMATCH; bola na mão sem direito → CUE_BALL_NOT_ALLOWED', () => { /* … */ });
test('mais de 5 inválidas em 10 s derrubam a conexão', () => { /* 6 invalid at ticks 0,3,6,9,12,15 → kicked [sender] */ });
test('6 inválidas em 12 s não derrubam; 6 no mesmo segundo derrubam só 5 (a sexta é descartada pelo ritmo)', () => { /* … */ });
test('reenvio do último (turnId, seq) aceito responde com snapshot e não conta como inválida', () => { /* seed lastAccepted */ });
test('aim_update do lugar da vez chega ao outro como 102 com seat; de quem não é a vez, não chega', () => { /* … */ });
test('16 aim_update no mesmo segundo: só 15 retransmitidos', () => { /* … */ });
test('mensagem da sessão antiga de um jogador é ignorada', () => { /* presence replaced; old sessionId message → nothing sent */ });
test('partida pública sem adversário por 30 s termina ABORTED; sala privada não', () => { /* 300 ticks */ });
test('emote e rematch_vote dão UNSUPPORTED_OP', () => { /* … */ });
```

Integração (`test/integration/game.test.ts`):

```ts
test('os dois recebem o snapshot com lugares diferentes e a mesma mesa', async () => { /* startPrivateGame */ });
test('tacada fora do turno → shot_rejected', async () => { /* the waiting bot shoots → 104 NOT_YOUR_TURN */ });
test('números não finitos → shot_rejected', async () => { /* raw string with 1e999 → 104 BAD_MESSAGE */ });
test('mais de 5 inválidas em 10 s → conexão removida', async () => {
  // the waiting bot sends 6 out-of-turn shots 250 ms apart → the other bot receives 106 { seat, connected: false }
});
test('aim_update chega ao adversário com o lugar', async () => { /* 102 { seat } */ });
test('entrada sem protocolVersion é recusada', async () => { /* joinMatch without metadata rejects with PROTOCOL_MISMATCH */ });
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w services/nakama`
Expected: FAIL, porque os módulos de `game/` não existem.

- [ ] **Step 3: Implementar `state.ts`, `send.ts`, `intake.ts`, `seats.ts` e ligar no `match.ts`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w services/nakama`. Depois, a integração na CI (push) ou com `NAKAMA_HOST=server`.
Expected: PASS. Os testes da F3 continuam verdes com o metadado de versão.

Se o runtime não aceitar `ArrayBuffer` no `broadcastMessage`, ou não entregar `MatchMessage.data` como `ArrayBuffer`, registre uma ruling no ledger. Ajuste as conversões em `send.ts` e `intake.ts`, sem mudar o formato no fio.

- [ ] **Step 5: Commit e push; conferir a CI**

```bash
git add services/nakama packages/sim/package.json package-lock.json
git commit -m "feat(nakama): start the match, send snapshots and validate shot requests"
git push -u origin claude/planejamento-online
```

---

### Task 5: Tacada aceita, simulação, regras e cronômetro (F4-03)

**Files:**
- Create: `services/nakama/src/game/sim.ts`, `src/game/shots.ts`, `src/game/end.ts` (só `endMatch`, completado na Tarefa 7), `test/game-shots.test.ts` e `test/game-clock.test.ts`.
- Modify: `src/game/intake.ts` (aceitação e operação 7), `src/match.ts` (`runClock`) e `test/integration/game.test.ts`.

**Interfaces:**
- Consumes: Tarefas 1, 2 e 4. Também `applyRuling` e `currentSeat` (`@billiards/modes`), `encodeTrajectory([])` para a trajetória vazia, e `simulateShot` (`@billiards/sim`, só nos testes).
- Produces:
  - **`callSim(nk, sim: { url: string; secret: string }, request: { simVersion, table, shot }): { ok: true; reply: SimReply } | { ok: false; error: 'SIM_TIMEOUT' | 'SIM_HTTP' | 'SIM_BAD_REPLY' }`.**
    - Quem chama passa `{ url: ctx.env.SIM_URL, secret: ctx.env.SIM_SECRET }`.
    - O pedido é `nk.httpRequest(sim.url + '/simulate', 'post', { 'Content-Type': 'application/json', 'x-sim-secret': sim.secret }, JSON.stringify(request), 3000)`.
    - Uma exceção ou um código diferente de 200 gera uma nova tentativa, até 2 no total.
    - `SimReply` é a resposta da Tarefa 3, com a trajetória já em `Uint8Array`.
  - **Aceitação** (no fim de `handleShotRequest`):
    1. **Registro:** `lastAccepted[seat] = { turnId, seq }` e `match.seats[seat].timeouts = 0`.
    2. **Aviso:** `shot_accepted { turnId, seq, seat, shot }` para todos.
    3. **Mesa inicial:** `initial = shot.cueBall ? placeCueBall(table, shot.cueBall) : table`.
    4. **Simulação:** com força 0 não há chamada ao sim; o resultado é vazio e `final = initial`.
    5. **Regras:**
       - `ruling = mode.resolveShot(match.mode, seat, events, final, shot)`;
       - a mesa nova é `respotBalls(final, ruling.respot, config.table)`;
       - `match = applyRuling(match, ruling)`;
       - `shots.push({ turnId, seat, shot })`.
    6. **Reprodução:** `durationTicks = ceil(simSeconds · 10) + 10` e `deadlineTick = tick + durationTicks + 450`.
    7. **Resultado:** `shot_result` (105, envelope) para todos, com `kind: 'shot'` e `nextTurn = { seat, turnId, deadlineInMs }`. O `lastResult` guarda o cabeçalho e a trajetória.
    8. **Vencedor:** com vencedor, `endMatch(env, state, tick, winnerTeam, 'WIN')`.
    9. **Log (§9.4):** `logger.info` com `matchId`, `turnId`, `seat` e o tempo da chamada ao sim.
  - **Falha do sim** (depois da nova tentativa):
    - `simFailures++` e `lastAccepted[seat]` é apagado, para a mesma tacada poder ser reenviada;
    - `error { code: 'SIM_FAILED' }` e um snapshot vão para todos; o `turnId` não muda, e `deadlineTick = tick + 450`;
    - cada falha gera um `logger.warn` com `matchId`, `turnId` e o erro;
    - na terceira falha da partida, `endMatch(env, state, tick, null, 'ABORTED')`.
  - **`runClock(env, state, tick)`.** Quando a fase é `AWAITING_SHOT` e `tick ≥ deadlineTick`:
    - `ruling = mode.resolveTimeout(...)` e depois `applyRuling`;
    - `timeouts` do lugar mais 1. No terceiro seguido, `removeMatchSeat` e `endMatch(..., 'ABANDON')`;
    - senão, `shot_result` com `kind: 'timeout'`, `shot: null`, sem eventos, `final = table` e trajetória vazia. Depois, `deadlineTick = tick + 450`.
  - **Operação 7 (`push_out_choice`):**
    - Vale só do lugar da vez, com o `turnId` atual e com `match.mode.pushOut?.pending`. Senão, `shot_rejected { seq: null, reason: 'NO_CHOICE_PENDING' }`.
    - Depois, `mode.applyChoice` e `applyRuling`.
    - Por fim, `shot_result` com `kind: 'choice'` e `deadlineTick = tick + 450`.
  - **`endMatch(env, state, tick, winnerTeam, reason)`** (versão mínima): fase `ENDED`, `end` preenchido e `match_end` para todos.

- [ ] **Step 1: Escrever os testes que falham**

Nos unitários, o `fakeNakama.httpRequest` responde com o `simulateShot` de verdade, ou com falhas programadas.

```ts
test('tacada aceita: shot_accepted, uma chamada ao sim com a tacada quantizada e shot_result para todos', () => { /* … */ });
test('o shot_result traz trajetória, eventos, decisão, a partida nova e o próximo turno', () => {
  // decodeTrajectory(payload).length > 0; header.match.turnId === 1; header.nextTurn.seat === currentSeat(header.match)
});
test('o 8 encaçapado na abertura volta à marca do pé na mesa do resultado', () => { /* canned reply: 8 pocketed on the break */ });
test('o prazo conta a reprodução: tick + ceil(simSeconds·10) + 10 + 450', () => { /* … */ });
test('força 0 não chama o sim e decide a tacada', () => { /* http calls 0; ruling.fouls not empty */ });
test('falha do sim: uma nova tentativa e segue', () => { /* first call throws → 2 calls → 105 */ });
test('duas falhas: a vez volta ao mesmo jogador sem falta, e a mesma tacada pode ser reenviada', () => { /* SIM_FAILED; same turnId; resend accepted */ });
test('três falhas na partida: match_end ABORTED', () => { /* … */ });
test('tempo esgotado conta como falta', () => { /* tick deadline → 105 kind timeout; fouls ['TIMEOUT']; ballInHand.seat other; turn passes */ });
test('uma tacada que chega no tick do prazo dá TURN_MISMATCH', () => { /* the clock runs first */ });
test('três tempos esgotados seguidos = abandono; uma tacada zera a contagem', () => { /* … */ });
test('9-ball: push-out pendente e escolha pela operação 7', () => { /* NineBallState with pushOut pending → 105 kind choice; without → NO_CHOICE_PENDING */ });
```

Integração:

```ts
test('os dois bots terminam a tacada com o mesmo estado final', async () => {
  // the shooter breaks; both receive 105; headers deepEqual (table, final, match); decodeTrajectory works on both payloads
});
test('tempo esgotado conta como falta', { timeout: 90000 }, async () => {
  // nobody shoots; within 44–50 s both receive 105 kind timeout, fouls include TIMEOUT, ruling.ballInHand.seat is the waiting seat
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w services/nakama`
Expected: FAIL, porque a tacada válida não gera `shot_accepted` e o relógio não existe.

- [ ] **Step 3: Implementar `sim.ts`, `shots.ts` e `endMatch`, e ligar o relógio e a operação 7**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w services/nakama`. Depois, a integração na CI.
Expected: PASS. Na CI, a abertura chega aos dois bots. Isso confirma o envelope de cerca de 35 KB pelo socket e o `nk.httpRequest` até o sim.

- [ ] **Step 5: Commit e push; conferir a CI**

```bash
git add services/nakama
git commit -m "feat(nakama): simulate accepted shots, apply the rules and run the turn timer"
git push -u origin claude/planejamento-online
```

---

### Task 6: Reconexão, segunda aba e W.O. (F4-04, F4-05)

**Files:**
- Modify: `services/nakama/src/game/seats.ts`, `src/game/send.ts`, `src/match.ts` e `test/integration/game.test.ts`.
- Create: `test/game-seats.test.ts`.

**Interfaces:**
- Consumes: Tarefas 4 e 5. Também `removeMatchSeat` (`@billiards/modes`, que agora avança o `turnId`).
- Produces:
  - **`handleLeave`, partida começada:** vale só se o `sessionId` for o da presença atual. A presença sai, `match.seats[seat].connected = false`, `disconnectedAt[seat] = tick` e `seat_update { seat, connected: false }` vai para os outros.
  - **`handleRejoin(env, state, presence, tick)`, no `matchJoin` de um jogador da partida:**
    - **Outra sessão ativa:** se o jogador ainda tem uma presença com outro `sessionId`, ela leva `matchKick([antiga])`. A saída dela será ignorada.
    - **Presença nova:** ela substitui a antiga, `connected = true` e o `disconnectedAt` do lugar é apagado.
    - **Snapshot:** um snapshot vai só para a presença nova.
      - Com `lastResult` e `offsetMs = (tick − lastResult.tick) · 100` menor que a duração da reprodução, o snapshot traz `playback: { result, offsetMs }` e leva a trajetória no payload.
      - Senão, `playback: null`.
    - **Aviso:** `seat_update { seat, connected: true }` vai para os outros.
  - **`runClock`, na mesma passada da Tarefa 5,** confere cada lugar em `disconnectedAt`, em ordem de índice. Com `tick − at ≥ 600`:
    - se o outro lugar também estiver desconectado: `endMatch(env, state, tick, null, 'ABORTED')`;
    - senão: `removeMatchSeat` e `endMatch(env, state, tick, winnerTeam, 'ABANDON')`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('saída marca o lugar desconectado e avisa o outro', () => { /* 106 { seat, connected: false } */ });
test('volta em até 60 s: snapshot só para a conexão nova e aviso ao outro', () => { /* … */ });
test('volta no meio da reprodução: o snapshot traz o resultado, o deslocamento e a trajetória', () => {
  // shot at tick 100 with simSeconds 8; rejoin at tick 130 → playback.offsetMs 3000, payload = the result's trajectory
});
test('segunda aba substitui a primeira, e a saída da primeira é ignorada', () => { /* kicked [old]; old leave → nothing changes */ });
test('ausente por 600 ticks perde por W.O.; 599 ainda não', () => { /* match_end { winnerTeam: other team, reason: 'ABANDON' } */ });
test('os dois ausentes: a partida termina ABORTED, sem vencedor', () => { /* … */ });
test('ausente na própria vez: o cronômetro continua e o tempo esgotado conta', () => { /* timeout at 450 ticks before the W.O. at 600 */ });
```

Integração:

```ts
test('bot cai no meio da reprodução, volta e termina no mesmo estado', async () => {
  // A breaks; B gets the 105, disconnects, waits 1 s and reconnects → snapshot.playback.offsetMs >= 1000 and < durationMs;
  // snapshot.table deepEquals A's result.table; the payload decodes to the same frames as A's
});
test('shot_request repetido não gera segunda tacada', async () => {
  // A sends the same message twice back to back → B counts exactly one 103 and one 105 for that turnId; A gets a 101 for the copy
});
test('segunda aba substitui a primeira', async () => { /* A opens a second socket and joins → snapshot; A2's shot is accepted */ });
test('bot ausente por mais de 60 s perde por W.O.', { timeout: 90000 }, async () => {
  // B disconnects and stays out → between 60 and 70 s A receives 107 { winnerTeam: A's team, reason: 'ABANDON' }
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w services/nakama`
Expected: FAIL nos testes de volta, segunda aba e W.O.

- [ ] **Step 3: Implementar a saída, a volta, a segunda aba e a reserva no relógio**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w services/nakama`. Depois, a integração na CI.
Expected: PASS.

- [ ] **Step 5: Commit e push; conferir a CI**

```bash
git add services/nakama
git commit -m "feat(nakama): reconnection with playback offset, tab takeover and walkover"
git push -u origin claude/planejamento-online
```

---

### Task 7: Fim da partida, desistência e histórico (F4-06)

**Files:**
- Modify: `services/nakama/src/game/end.ts`, `src/game/intake.ts` (operação 5), `src/match.ts` (`matchLoop` e `matchTerminate`) e `test/integration/game.test.ts`.
- Create: `test/game-end.test.ts`.

**Interfaces:**
- Consumes: Tarefas 4 a 6. Também `removeMatchSeat` (`@billiards/modes`).
- Produces:
  - **`endMatch(env, state, tick, winnerTeam, reason)`,** a mesma assinatura da Tarefa 5:
    - **Guarda:** não faz nada se a partida já terminou.
    - **Estado e aviso:** fase `ENDED`, `end = { winnerTeam, reason, summary: { turns: match.turnId, shots: shots.length } }` e `endTick = tick`. O `match_end` vai para todos.
    - **Histórico:** com `reason` diferente de `ABORTED`, chama `writeHistory` uma única vez (`historyWritten`).
  - **`writeHistory(env, state)`:**
    - **Escrita:** `nk.storageWrite([{ collection: 'match_history', key: matchId, userId: SYSTEM_USER_ID, value, version: '*', permissionRead: 2, permissionWrite: 0 }])`.
    - **Registro (`value`):** `{ matchId, mode, format, private, players: [{ seat, team, userId, username }], firstSeat, rack: 'fixed', simVersion, protocolVersion, shots, winnerTeam, reason, turns, startedAt, endedAt }`. As datas vêm de `Date.now()`.
    - **Erro:** um erro de escrita (o registro já existe) vira `logger.warn` e não sobe.
    - `SYSTEM_USER_ID` é `'00000000-0000-0000-0000-000000000000'`, e o `matchId` vem de `env.ctx.matchId`.
  - **Operação 5 (`concede`):** vale de um jogador numa partida começada e não terminada. Leva a `removeMatchSeat` e a `endMatch(..., winnerTeam, 'CONCEDE')`.
  - **Encerramento:**
    - o `matchLoop` devolve `null` em `endTick + 100`;
    - o `matchTerminate` (desligamento do nó) termina como `ABORTED`, sem histórico, se a partida ainda não tiver terminado.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('partida concluída gera exatamente um registro em match_history', () => {
  // endMatch twice → storageWrite called once, version '*', permissionRead 2, permissionWrite 0, key ctx.matchId
});
test('o registro traz jogadores, quem abriu, as tacadas quantizadas e o resultado', () => { /* … */ });
test('partida abortada não grava histórico', () => { /* ABORTED and matchTerminate */ });
test('desistência: o outro time vence com reason CONCEDE', () => { /* … */ });
test('a partida termina 10 s depois do fim', () => { /* matchLoop returns null at endTick + 100 */ });
test('erro de escrita (registro já existe) não derruba a partida', () => { /* storageWrite throws → warn */ });
```

Integração:

```ts
test('desistência encerra a partida e grava o histórico uma vez', async () => {
  // A concedes → both get 107 CONCEDE; readStorageObjects(match_history, matchId, SYSTEM_USER_ID) → 1 object;
  // listStorageObjects(match_history, SYSTEM_USER_ID) has exactly one object with key matchId
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w services/nakama`
Expected: FAIL, porque nada grava histórico e a desistência não existe.

- [ ] **Step 3: Implementar `end.ts` completo, a operação 5 e o encerramento**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w services/nakama`. Depois, a integração na CI.
Expected: PASS.

- [ ] **Step 5: Commit e push; conferir a CI**

```bash
git add services/nakama
git commit -m "feat(nakama): concession, match end and a write-once match history"
git push -u origin claude/planejamento-online
```

---

### Task 8: Partida inteira, `docs/protocol.md` e fechamento da F4-A (F4-07)

**Files:**
- Create:
  - `services/nakama/test/integration/autoplay.ts`;
  - `docs/protocol.md`, em PT-BR;
  - `packages/protocol/test/protocol-doc.test.ts`.
- Modify:
  - `services/nakama/test/integration/game.test.ts`;
  - `docs/f3/servidor-local.md`: o serviço `sim`, o `SIM_SECRET` e a partida;
  - `CLAUDE.md`: comandos de `services/sim`;
  - `harness/feature_list.json`, `harness/progress.md` e `docs/superpowers/plans/2026-10-24-roteiro.md` (linhas F4-A e F4-B).

**Interfaces:**
- Consumes: Tarefas 1 a 7. Também `getPocketPositions` e `getTableProfile` (`@billiards/sim`, só nos testes).
- Produces:
  - **`chooseShot(header: { match, table }, seat): ShotRequest`** (bot de teste), determinístico:
    - **Abertura:** mira a bola da ponta com força 100.
    - **Alvos:** com os grupos definidos, as bolas do próprio grupo, ou o 8 quando o grupo acabou. Com a mesa aberta, qualquer bola de 1 a 15 menos o 8.
    - **Mira:** para cada alvo e caçapa, calcula a bola fantasma (alvo − 2R na direção da caçapa) e escolhe o par de menor ângulo de corte. O ângulo é `atan2(dz, dx)`, porque o sim usa a direção `(cos, sin)` no plano XZ. A força é `clamp(30 + 0,25 · (distância da branca à fantasma + distância do alvo à caçapa), 30, 90)`, sem efeito.
    - **Bola na mão:**
      - `anywhere`: a branca vai 6R atrás do alvo, na linha da caçapa, se o ponto estiver na mesa e livre;
      - `kitchen`, ou ponto inválido: a marca da cabeceira, `(0, −depth / 2 · 0,55)`.
  - **`docs/protocol.md`:**
    - as versões e o metadado de entrada;
    - todas as operações, com direção, nome e campos;
    - o envelope e a trajetória v1 (campo a campo, como em `trajectory.ts`);
    - a quantização;
    - os motivos de recusa e os códigos de erro;
    - prazos, reserva, reenvio idempotente, deslocamento de reprodução e limites;
    - o registro de `match_history`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// services/nakama/test/integration/game.test.ts
test('dois bots jogam uma partida inteira de 8-ball', { timeout: 300000 }, async () => {
  // loop: the bot whose seat is nextTurn.seat (or the snapshot's turn.seat) shoots chooseShot(...); both wait for the 105 and
  // their headers' table deepEqual; until 107. Expect reason 'WIN', winnerTeam 0 or 1, fewer than 200 shot results;
  // match_history has one record with the same winnerTeam and shots.length = number of kind 'shot' results
});

// packages/protocol/test/protocol-doc.test.ts
test('docs/protocol.md descreve todos os códigos de operação', () => {
  // for each [name, code] of OP: the doc has a table row starting with `| ${code} |` and the name in snake_case
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/protocol`
Expected: FAIL, porque `docs/protocol.md` não existe. A partida inteira falha na CI até o `autoplay.ts` existir.

- [ ] **Step 3: Implementar o `autoplay.ts` e escrever o `docs/protocol.md` e as atualizações de documentação**

- [ ] **Step 4: Rodar a suíte completa**

Run: `npm test && npm run typecheck && bash harness/init.sh`. Depois, faça push e confira a CI. Se o usuário atualizar o `server` (`git pull && npm run infra:up`), rode também `NAKAMA_HOST=server npm run test:integration -w services/nakama`.
Expected: tudo verde. O id da execução da CI e o resultado ficam no `progress.md`.

- [ ] **Step 5: Marcar os itens e atualizar o harness**

Marque cada item só se a verificação dele passou numa execução da integração (D051). O F4-01 vale pelos testes do `services/sim`, que rodam no `npm test`.

| Item | Teste |
|------|-------|
| F4-01 | `chamada sem segredo é recusada` e `simVersion desconhecida é recusada` (`services/sim`) |
| F4-02 | `tacada fora do turno → shot_rejected`, `números não finitos → shot_rejected` e `mais de 5 inválidas em 10 s → conexão removida` |
| F4-03 | `os dois bots terminam a tacada com o mesmo estado final` e `tempo esgotado conta como falta` |
| F4-04 | `bot cai no meio da reprodução, volta e termina no mesmo estado` e `shot_request repetido não gera segunda tacada` |
| F4-05 | `bot ausente por mais de 60 s perde por W.O.` |
| F4-06 | `desistência encerra a partida e grava o histórico uma vez` e a checagem do histórico na partida inteira |
| F4-07 | `dois bots jogam uma partida inteira de 8-ball` e `docs/protocol.md descreve todos os códigos de operação` |

No roteiro, a linha F4 vira F4-A (este plano, concluída) e F4-B (a escrever). O "Próximo passo" do `progress.md` passa a ser o plano da F4-B.

- [ ] **Step 6: Commit e push**

```bash
git add services/nakama packages/protocol docs CLAUDE.md harness
git commit -m "docs(f4): protocol v1, full bot match and close phase F4-A"
git push -u origin claude/planejamento-online
```
