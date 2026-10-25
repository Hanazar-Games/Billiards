# F2 — `packages/modes` com N lugares e `LocalMatchController`: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As regras de 8-ball e 9-ball saem do cliente para `packages/modes`, em TypeScript puro e sem dependências, com estado de partida de N lugares e equipes. O cliente offline passa a obedecer a um `LocalMatchController`, que valida a tacada, simula no worker e decide pelo modo.

**Architecture:** `packages/modes` define a interface `GameMode` (spec §7.1, com as extensões da D045), a ordem de turnos para 1×1, 2×2 e cada um por si (§7.2) e o `MatchState`. As regras decidem a partir da lista inteira de eventos do sim (`first_contact`, `ball_cushion`, `pocket`), não por callbacks durante a reprodução. É a mesma forma que o servidor vai usar na F4. No cliente, `LocalMatchController.submitShot` valida (`validateShot`), simula no worker, decide (`resolveShot`) e devolve `{ initial, result, ruling }`. O `Game` reproduz a trajetória e, no fim, aplica a decisão pela sequência de interface de hoje (`resolveTurn`), por meio de um adaptador `Ruling → resultado legado`. `Rules.js` e `NineBallRules.js` saem do cliente.

**Tech Stack:** TypeScript 5.9 (o Node ≥ 22.12 executa `.ts` direto; `erasableSyntaxOnly`); `node:test`; cliente em JavaScript ES2022 com Vite 6, que importa o `.ts` do workspace; Puppeteer.

**Spec:** [`docs/superpowers/specs/2026-10-24-billiards-online-design.md`](../specs/2026-10-24-billiards-online-design.md): §5.1 e §5.3 (componentes e controlador de partida), §6 passo 5 (regras), §7.1 a §7.4 (modos, lugares, cronômetro, desconexão), §9.3 (testes de `packages/modes`), §10 (F2). Plano anterior: [`2026-10-25-f1b-cliente-usa-sim.md`](2026-10-25-f1b-cliente-usa-sim.md).

## Decisões que este plano propõe

Registradas em `harness/decisions.json` com `status: "open"` junto com este plano. A Tarefa 1 as marca como `accepted` quando o plano for aprovado.

| Id | Decisão | Por quê |
|----|---------|---------|
| **D045** | Interface de modos na F2. (a) `GameMode` ganha `resolveTimeout(state, seat)` e `applyChoice(state, seat, choice)` (resposta ao push-out do 9-ball), e `resolveShot` recebe a tacada como 5º argumento (o push-out é declarado na tacada, `ShotRequest.pushOut`). (b) `Ruling` ganha `respot: number[]`, e `messages` vira `{ code, params? }[]`. (c) Os eventos são a lista `SimEvent` do sim, redeclarada em `modes` sem importar o sim. (d) A ordem de turnos (lugares, equipes e lugar da vez) mora no `ModeState` (`turn`), porque a D013 diz que a ordem é "definida pelo modo"; o `MatchState` guarda conexões, `turnId` e fase. (e) Lugares e equipes começam em 0, e no cliente o jogador é o lugar + 1. | A interface da spec não cobre tempo esgotado, push-out nem bola reposta. Mensagens como "打进 N 颗球" precisam de parâmetros. E uma fonte única para a ordem de turnos evita duas cópias que divergem. |
| **D046** | O teste diferencial das regras usa uma **cópia congelada** de `game/Rules.js`, `game/NineBallRules.js`, `config.js` e `core/UIText.js`, tirada de `0448b03:src/` para `packages/modes/test/legacy/`, com manifesto SHA-256 como na D042. | Os 28 testes portados cobrem só 4 caminhos do 8-ball. Comparar milhares de tacadas aleatórias com o legado é o que garante que o port mantém cada ramo, e a cópia sobrevive à remoção das regras do cliente na Tarefa 6. |
| **D047** | Na F2, `rackLayout` reproduz a arrumação fixa de hoje (`BallsManager._rackEightBall` e `_rackNineBall`), sem sorteio. O `rng` fica na assinatura, e a ordem aleatória com semente do servidor (spec §7.1) é decidida na F4. | O jogo offline sempre arrumou assim. A semente vem do servidor, que só existe na F4. |

## Global Constraints

- `packages/modes` é TypeScript em `src/`, sem dependências de runtime (nem `@billiards/sim`).
  - Só sintaxe apagável (`erasableSyntaxOnly`): sem `enum`, `namespace` nem propriedades de parâmetro.
  - Importações relativas com extensão `.ts`, e a API pública sai por `src/index.ts`.
  - `package.json` como o de `packages/protocol`: `"exports": { ".": "./src/index.ts" }` e `"test": "node --test test/*.test.ts"`.
- Estado de modo e de partida é JSON puro (sem `Set`, `Map` nem classes), e `JSON.parse(JSON.stringify(s))` reproduz o estado.
- As funções de modo são puras: não alteram o `state` recebido e devolvem um estado novo.
- Lugares e equipes contam a partir de 0:
  - 1×1: lugar 0 na equipe 0, lugar 1 na equipe 1.
  - 2×2: lugares 0 a 3 nas equipes `[0, 1, 0, 1]`, isto é, A1, B1, A2, B2.
  - Cada um por si: o lugar i é a equipe i.
  - No cliente, `currentPlayer = seat + 1` e, em 1×1, `winner = winnerTeam + 1`.
- Paridade: a referência do comportamento das regras é `Rules.js`/`NineBallRules.js` (D046). Os textos na interface continuam as strings em chinês de hoje; a tradução é a F5.
- Os fatos da tacada vêm dos eventos do sim, exatamente como o `Game` alimentava as regras na F1-B:
  - a primeira bola é `first_contact.ball`;
  - uma tabela conta "depois do primeiro contato" se o evento `ball_cushion` vem depois do `first_contact` na lista;
  - as bolas na tabela durante a abertura são os ids diferentes de 0 dos `ball_cushion` da tacada inteira, sem repetição;
  - as encaçapadas são os ids únicos dos eventos `pocket`, na ordem;
  - a branca encaçapada é um `pocket` com `ball === 0`.
- `packages/sim/src` não muda, o cliente nunca passa `tuning`, e só o worker executa `simulateShot`.
- O LAN continua funcionando até a F4 (D016): o host decide pelo controlador, e o convidado recebe o estado da partida no snapshot.
- Suítes novas do cliente: `node test/<nome>.test.js` com `node:test`, script `test:<nome>` e entrada no `test`. Nos testes de navegador nesta máquina Windows, `PUPPETEER_EXECUTABLE_PATH` aponta para o Chrome instalado.
- Commits em inglês (conventional commits) e documentos em PT-BR. Commit e push na branch de trabalho ao fim de cada interação (D028).

## Review Focus

1. **Divergência de regra no port.** Exemplos: combinação que encaçapa lisa e listrada, 8 encaçapada na abertura com falta, 9 encaçapada numa falta, tempo esgotado na abertura. Esperado: a mesma decisão do legado. Testes diferenciais nas Tarefas 2 e 3.
2. **Resultado de tacada abandonada** que chega depois de reset, novo rack ou saída. Esperado: o controlador não aplica a decisão, e o estado da partida fica intacto. Teste na Tarefa 5.
3. **Worker que nunca responde.** Esperado: depois de `simTimeoutMs` (padrão 10 s), a tacada é cancelada, nada é aplicado, e a seguinte funciona. É a pendência da F1-B. Teste na Tarefa 5.
4. **Push-out declarado numa tacada que falha** (erro do worker). Esperado: o push-out continua disponível e a vez não muda. Teste na Tarefa 5.
5. **2×2: o grupo de bolas é da equipe, e a bola na mão vai para o próximo lugar da ordem** (B1, não "o adversário"). Teste na Tarefa 2.

## Fora do escopo da F2

- Interface do cliente para 2×2 e cada um por si (F7 e F9) e o modo cutthroat (F9). O `modes` já suporta os formatos, com testes.
- Arrumação aleatória com semente (D047, F4).
- Três tempos esgotados = abandono, e reserva de 60 s após queda (§7.3, §7.4): são regras do servidor, F4.
- Estatística de tacada cancelada: o convidado do LAN depende do `totalTurns` do host. Revisitar quando o LAN sair, na F4.
- Linha-guia de mira com a geometria do sim, e a remoção do LAN (F4).

## Estrutura de arquivos

```
packages/modes/package.json
packages/modes/src/types.ts        MatchFormat, MatchConfig, TurnState, ModeStateBase, ShotRequest, SimEvent, Ruling, GameMode…
packages/modes/src/turns.ts        ordem de turnos para 1×1, 2×2 e cada um por si
packages/modes/src/facts.ts        fatos da tacada a partir dos eventos do sim
packages/modes/src/eightBall.ts    modo 8-ball
packages/modes/src/nineBall.ts     modo 9-ball
packages/modes/src/match.ts        MatchState: createMatch, applyRuling, removeSeat, currentSeat
packages/modes/src/index.ts        API pública e MODES
packages/modes/test/helpers.ts     eventos sintéticos e PRNG com semente
packages/modes/test/legacy/        cópia congelada (D046), MANIFEST.json, README.md
packages/modes/test/{types,turns,legacy-copy,eight-ball,nine-ball,match}.test.ts
apps/client/src/match/LocalMatchController.js   valida, simula e decide
apps/client/src/match/rulingText.js            códigos de mensagem → textos de hoje
apps/client/src/match/turnResult.js            Ruling → resultado legado do resolveTurn
apps/client/test/local-match.test.js           controlador no Node
apps/client/test/no-legacy-rules.test.js       "o cliente não tem regras próprias"
apps/client/test/local-2p-match.test.js        partidas locais de 2 jogadores até o fim (navegador)
```

A Tarefa 6 remove `apps/client/src/game/Rules.js`, `NineBallRules.js` e `apps/client/test/rules.test.js`. Os 28 testes desse arquivo passam a viver em `packages/modes`.

---

### Task 1: Pacote `packages/modes`: tipos e ordem de turnos (F2-01, F2-04)

**Files:**
- Create: `packages/modes/package.json`, `src/types.ts`, `src/turns.ts`, `src/index.ts`, `test/types.test.ts`, `test/turns.test.ts`
- Modify:
  - `tsconfig.json`: o `include` ganha `"packages/modes/test/*.ts"`, para que os testes de tipo sejam checados;
  - `harness/decisions.json`: D045, D046 e D047 de `open` para `accepted`;
  - `package-lock.json`, pelo `npm install`.

**Interfaces:**
- Produces, em `src/types.ts` (exportados por `index.ts`):

```ts
export type Rng = () => number;                                   // [0, 1)
export type MatchFormat = { kind: '1v1' } | { kind: '2v2' } | { kind: 'ffa'; seats: number };   // ffa: 3..5
export interface TableGeometry { width: number; depth: number; ballRadius: number }
export interface MatchConfig { format: MatchFormat; table: TableGeometry; maxPower: number; options?: { threeFoulLoss?: boolean } }
export interface Seat { index: number; team: number; eliminated: boolean }
export interface Team { index: number; members: number[]; nextMember: number }
export interface TurnState { seats: Seat[]; teams: Team[]; currentSeat: number }
export interface BallInHand { seat: number; zone: 'anywhere' | 'kitchen' }
export interface ModeStateBase { modeId: string; config: MatchConfig; turn: TurnState; breakShot: boolean;
  ballInHand: BallInHand | null; winnerTeam: number | null }
export type SimEvent =
  | { t: number; type: 'ball_ball'; a: number; b: number; speed: number }
  | { t: number; type: 'ball_cushion'; ball: number; speed: number }
  | { t: number; type: 'pocket'; ball: number; pocket: number }
  | { t: number; type: 'first_contact'; ball: number };
export interface TableState { tableProfileId: string; balls: { id: number; x: number; z: number; pocketed: boolean }[] }
export interface ShotRequest { angle: number; power: number; spin: { x: number; y: number }; cueBall?: { x: number; z: number }; pushOut?: boolean }
export type RejectReason = 'GAME_OVER' | 'NOT_YOUR_TURN' | 'BAD_INPUT' | 'PUSH_OUT_PENDING' | 'PUSH_OUT_UNAVAILABLE'
  | 'CUE_BALL_NOT_ALLOWED' | 'CUE_BALL_OUTSIDE_KITCHEN';
export type Validation = { ok: true } | { ok: false; reason: RejectReason };
export type FoulCode = 'SCRATCH' | 'NO_BALL_HIT' | 'NO_RAIL_AFTER_CONTACT' | 'WRONG_FIRST_HIT' | 'ILLEGAL_BREAK' | 'EARLY_EIGHT' | 'TIMEOUT';
export type MessageCode = 'BREAK_FOUL' | 'ILLEGAL_BREAK' | 'BREAK_NO_POCKET' | 'BREAK_LEGAL' | 'EIGHT_ON_BREAK_RESPOT' | 'EARLY_EIGHT'
  | 'LEGAL_EIGHT_WIN' | 'NINE_ON_BREAK_WIN' | 'LEGAL_NINE_WIN' | 'NINE_ON_FOUL_RESPOT' | 'FOUL' | 'NO_POCKET' | 'POCKETED'
  | 'PUSH_OUT_PENDING' | 'PUSH_OUT_ACCEPTED' | 'PUSH_OUT_PASSED' | 'THREE_FOUL_WARNING' | 'THREE_FOUL_LOSS' | 'TIMEOUT';
export interface Message { code: MessageCode; params?: Record<string, number | string> }
export interface Ruling<S> { state: S; fouls: FoulCode[]; ballInHand: BallInHand | null; nextSeat: number | null;
  eliminatedSeats: number[]; winnerTeam: number | null; respot: number[]; messages: Message[] }
export type Choice = { kind: 'push_out'; accept: boolean };
export interface BallPlacement { id: number; x: number; z: number }
export interface GameMode<S extends ModeStateBase> {
  id: string; formats: MatchFormat['kind'][]; tableProfiles: string[];
  createInitialState(cfg: MatchConfig, rng: Rng, firstSeat?: number): S;
  rackLayout(state: S): BallPlacement[];
  validateShot(state: S, seat: number, shot: ShotRequest): Validation;
  resolveShot(state: S, seat: number, events: SimEvent[], final: TableState, shot: ShotRequest): Ruling<S>;
  resolveTimeout(state: S, seat: number): Ruling<S>;
  applyChoice(state: S, seat: number, choice: Choice): Ruling<S>;
  onSeatRemoved(state: S, seat: number): S;
}
```

- Produces, em `src/turns.ts`:
  - `createTurnState(format: MatchFormat, firstSeat = 0): TurnState` monta lugares e equipes conforme os Global Constraints. Cada equipe começa com `nextMember` igual ao seu primeiro membro, e a equipe de `firstSeat` começa com `nextMember = firstSeat`. Um `ffa` com `seats` fora de 3..5 lança `RangeError`.
  - `endTurn(turn): TurnState`: a vez da equipe atual acaba.
    1. O `nextMember` dela passa ao próximo membro ativo depois de `currentSeat`, em ciclo.
    2. A próxima equipe é a seguinte em ordem de índice, em ciclo, entre as que têm membro ativo.
    3. `currentSeat` passa a ser o `nextMember` dessa equipe, avançando se ele estiver eliminado.
  - `removeSeat(turn, seat): TurnState` marca `eliminated`. Se o lugar era o da vez e a equipe tem outro membro ativo, esse membro assume a vez (o parceiro do 2×2, §7.4); senão, aplica `endTurn`.
  - `activeTeams(turn): number[]`: equipes com ao menos um lugar ativo, em ordem.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// packages/modes/test/turns.test.ts
const order = (t: TurnState, n: number) => { const seats = [t.currentSeat]; for (let i = 0; i < n; i++) { t = endTurn(t); seats.push(t.currentSeat); } return seats; };
test('1×1 alterna 0, 1, 0', () => assert.deepEqual(order(createTurnState({ kind: '1v1' }), 2), [0, 1, 0]));
test('2×2: ordem A1, B1, A2, B2, A1', () => assert.deepEqual(order(createTurnState({ kind: '2v2' }), 4), [0, 1, 2, 3, 0]));
test('cada um por si com 5 lugares pula os eliminados', () =>
  assert.deepEqual(order(removeSeat(removeSeat(createTurnState({ kind: 'ffa', seats: 5 }), 2), 3), 3), [0, 1, 4, 0]));
test('2×2: o parceiro assume quando um lugar sai', () =>
  assert.deepEqual(order(removeSeat(createTurnState({ kind: '2v2' }), 2), 4), [0, 1, 0, 3, 0]));
test('quem sai na vez passa a vez; equipe sem lugar ativo sai da ordem', () => {
  const t = removeSeat(createTurnState({ kind: '1v1' }), 0);
  assert.equal(t.currentSeat, 1); assert.deepEqual(activeTeams(t), [1]);
});
test('2×2: o parceiro assume a vez de quem sai na vez', () => assert.equal(removeSeat(createTurnState({ kind: '2v2' }), 0).currentSeat, 2));
test('as funções não alteram o estado recebido', () => { /* deep-freeze the input of endTurn and removeSeat; no TypeError */ });
test('ffa fora de 3..5 lugares é RangeError', () => assert.throws(() => createTurnState({ kind: 'ffa', seats: 6 }), RangeError));
```

`test/types.test.ts` só passa se `npm run typecheck` aceitar o arquivo. Ele contém:
- um `Ruling` sem `respot`, marcado com `// @ts-expect-error`;
- um `MatchFormat` `{ kind: '3v3' }`, marcado com `// @ts-expect-error`;
- um teste `node:test` trivial, para que o arquivo rode na suíte.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm install && npm test -w packages/modes`
Expected: FAIL: `Cannot find module .../src/index.ts`.

- [ ] **Step 3: Implementar `package.json`, `types.ts`, `turns.ts` e `index.ts`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/modes && npm run typecheck`
Expected: 8 testes de turnos e o de tipos passam, e o `tsc` sai limpo. Para conferir que os `@ts-expect-error` mordem, apague um deles: o `tsc` tem de falhar. Depois, restaure.

- [ ] **Step 5: Aceitar D045 a D047 e fazer commit**

Marque D045, D046 e D047 como `accepted`, com `source` "plano da F2 aprovado pelo usuário em <data>".

```bash
git add packages/modes tsconfig.json package-lock.json harness/decisions.json
git commit -m "feat(modes): add the modes package with N-seat turn order"
```

---

### Task 2: Fatos da tacada e 8-ball (F2-02)

**Files:**
- Create:
  - `packages/modes/src/facts.ts` e `src/eightBall.ts`;
  - `test/helpers.ts`, `test/eight-ball.test.ts` e `test/legacy-copy.test.ts`;
  - `test/legacy/` com `game/Rules.js`, `game/NineBallRules.js`, `config.js`, `core/UIText.js`, `MANIFEST.json` e `README.md` (D046).
- Modify: `packages/modes/src/index.ts`

**Interfaces:**
- Consumes: os tipos e `createTurnState`/`endTurn` da Tarefa 1.
- Produces:
  - `shotFacts(events: SimEvent[]): ShotFacts`, com `ShotFacts = { firstHit: number | null; railAfterFirstHit: boolean; breakRailBalls: number[]; pocketed: number[]; cuePocketed: boolean }`, conforme os Global Constraints. `pocketed` não inclui a branca.
  - `eightBall: GameMode<EightBallState>`, com `EightBallState = ModeStateBase & { modeId: '8ball'; groups: ('solid' | 'stripe' | null)[]; pocketed: number[] }`:
    - `groups` é indexado por equipe;
    - `pocketed` traz as bolas lisas e listradas fora da mesa, como o `pocketedBalls` legado;
    - `formats` é `['1v1', '2v2']`;
    - `tableProfiles` é `['pool9ft', 'pool8ft', 'bar7ft', 'chinese8']`.
  - `eightBallStatus(state): { groups: ('solid' | 'stripe' | null)[]; remaining: number[] }`: as bolas restantes do grupo de cada equipe, ou 7 se a equipe ainda não tem grupo.
  - `test/helpers.ts`:
    - `ev({ first, cushions, pocketed, cue, cushionsBeforeFirst }): SimEvent[]`, que gera, na ordem, os `ball_cushion` de `cushionsBeforeFirst`, o `first_contact`, os `ball_cushion` de `cushions`, os `pocket` de `pocketed` e o da branca;
    - `mulberry32(seed): Rng`;
    - `config8`, `config9`: geometria do `pool9ft` (`width` 127, `depth` 254, `ballRadius` 2.8575) e `maxPower` 110.

Semântica: port linha a linha de `Rules.resolveShot`, com estas regras de tradução:
- "jogador atual" é a equipe do lugar da vez;
- "oponente" é a próxima equipe da ordem;
- `ballInHand` é dado ao `nextSeat`, com zona `kitchen` nas faltas da abertura e `anywhere` nas demais;
- 8 encaçapada na abertura vai para `respot: [8]`, e a 8 sai de `pocketed`;
- quando a vez continua, `nextSeat` é o mesmo lugar (sem `endTurn`); quando passa, `nextSeat = endTurn(turn).currentSeat`.

Outras funções do modo:
- `rackLayout`: as fórmulas de `BallsManager._rackEightBall` (`apps/client/src/game/BallsManager.js:42-70`), com `d = ballRadius * 2.02`, `rackZ = depth / 2 * 0.55` e a branca em `(0, -depth / 2 * 0.55)`. São 16 bolas.
- `validateShot` verifica, nesta ordem:
  1. `GAME_OVER` e `NOT_YOUR_TURN`;
  2. `BAD_INPUT`: número não finito, `power` fora de `[0, maxPower]` ou `hypot(spin) > 1 + 1e-9`;
  3. `PUSH_OUT_UNAVAILABLE`: `pushOut` no 8-ball;
  4. `CUE_BALL_NOT_ALLOWED`: `cueBall` sem bola na mão daquele lugar;
  5. `CUE_BALL_OUTSIDE_KITCHEN`: zona `kitchen` e `cueBall.z > -depth / 2 * 0.55`.
- `resolveTimeout`: cópia de `Game._onTurnTimerExpired` (`apps/client/src/game/Game.js:1476-1495`). É a falta `TIMEOUT`, com bola na mão `anywhere` para o próximo; `breakShot` não muda.
- `applyChoice` lança `Error` no 8-ball.
- `onSeatRemoved` usa `removeSeat`. Quando sobra uma equipe ativa, ela vira `winnerTeam`.

- [ ] **Step 1: Copiar o legado e escrever os testes que falham**

Para cada arquivo `f` da lista, rode `git show 0448b03:src/$f > packages/modes/test/legacy/$f`, e gere o `MANIFEST.json` como na Tarefa 1 da F1-B. `legacy-copy.test.ts` checa os 4 hashes, com CRLF trocado por LF.

Em `eight-ball.test.ts`, porte os 4 testes de 8-ball de `apps/client/test/rules.test.js` (linhas 322-372) e o teste `serializer round-trips 8-ball state` (linhas 401-422). Mantenha os nomes e as asserções, traduzidos por esta tabela:

| Legado | `packages/modes` |
|--------|------------------|
| `new Rules()` | `s = eightBall.createInitialState(config8, mulberry32(1))` |
| `rules.breakShot = false`, `player1Group = g1`, `player2Group = g2`, `player1Pocketed = [...]` | `s = { ...s, breakShot: false, groups: [g1, g2 ?? null], pocketed: [...] }` |
| `startShot(p)`, `recordFirstHit(b)`, `recordCushionHit(c)`, `resolveShot(ids, cue)` | `r = eightBall.resolveShot(s, p - 1, ev({ first: b, cushions: [c], pocketed: ids, cue }), final, shot)` |
| `result.nextPlayer === n` | `r.nextSeat === n - 1` |
| `result.foul`, `result.scratch` | `r.fouls.length > 0`, `r.fouls.includes('SCRATCH')` |
| `result.ballInHand === true` | `r.ballInHand?.seat === r.nextSeat` |
| `result.reasonCode === X` | X está em `r.fouls` ou em `r.messages.map(m => m.code)` |
| `result.gameOver`, `result.winner === n` | `r.winnerTeam === n - 1` |
| `result.respotEightBall` | `r.respot.includes(8)` |
| teste do serializador | `JSON.parse(JSON.stringify(s))` recria o estado: `deepEqual`, e `resolveShot` dá a mesma decisão nos dois |

Testes novos:

```ts
test('fatos: tabela antes do primeiro contato não conta como "depois do contato"', () => {
  assert.equal(shotFacts(ev({ first: 1, cushionsBeforeFirst: [0] })).railAfterFirstHit, false);
  assert.equal(shotFacts(ev({ first: 1, cushions: [0] })).railAfterFirstHit, true);
});
test('2×2: o grupo é da equipe e a bola na mão vai para o próximo lugar da ordem', () => {
  // 2v2, breakShot false, groups ['solid', 'stripe']; seat 0 (A1) scratches → nextSeat 1 (B1), ballInHand { seat: 1, zone: 'anywhere' }
  // then seat 1 pockets a stripe legally → continues; then seat 1 misses → nextSeat 2 (A2), groups unchanged
});
test('rackLayout repete a arrumação de hoje', () => {
  // 16 balls; cue at (0, -69.85); ball 1 at (0, 69.85); ball 15 at (2 * d, 69.85 + 4 * d * Math.sin(Math.PI / 3)) with d = 2.8575 * 2.02
});
test('validateShot recusa bola na mão fora da cozinha', () => { /* state with ballInHand { seat: 0, zone: 'kitchen' }; cueBall z = 0 → CUE_BALL_OUTSIDE_KITCHEN; z = -100 → ok */ });
test('tempo esgotado é falta com bola na mão e não gasta a abertura', () => { /* resolveTimeout on the initial state: fouls ['TIMEOUT'], nextSeat 1, ballInHand anywhere, state.breakShot true */ });
test('diferencial: 3000 tacadas aleatórias decidem como o Rules.js congelado', () => { /* see Step 3 */ });
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/modes`
Expected: FAIL: `eightBall`/`shotFacts` não existem. O `legacy-copy` passa.

- [ ] **Step 3: Implementar `facts.ts` e `eightBall.ts`, e escrever o diferencial**

O diferencial roda, com `mulberry32(42)`, partidas de 1×1 lado a lado até 3000 tacadas no total. Cada partida termina no `winnerTeam` ou depois de 60 tacadas.

A cada tacada:
- **Tacada aleatória sobre as bolas em mesa:**
  - primeira bola nula com 5% de chance;
  - de 0 a 4 tabelas;
  - de 0 a 3 encaçapadas, que às vezes incluem a 8 e a branca;
  - 10% de tempo esgotado no lugar da tacada.
- **No legado, a mesma sequência que o `Game` da F1-B fazia:**
  - `startShot(lugar + 1)`;
  - `recordFirstHit`, chamado no lugar do `first_contact`, e `recordCushionHit`, um por `ball_cushion`, na ordem da lista;
  - `resolveShot(idsComBranca, branca)`, em que `idsComBranca` inclui o 0 quando a branca cai, como o `turnPocketedIds`;
  - o tempo esgotado repete as 5 linhas de `Game._onTurnTimerExpired`.
- **Comparação:** próximo lugar, falta, bola na mão e zona, reposição da 8, vencedor, grupos das duas equipes e o conjunto de bolas fora da mesa.

Uma divergência falha o teste e mostra a semente, a tacada e os dois resultados.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/modes && npm run typecheck`
Expected: PASS. Os 5 testes portados, os 6 novos e os anteriores passam, e o `tsc` sai limpo.

- [ ] **Step 5: Commit**

```bash
git add packages/modes
git commit -m "feat(modes): port 8-ball to packages/modes with a differential test against the frozen legacy rules"
```

---

### Task 3: 9-ball (F2-03)

**Files:**
- Create: `packages/modes/src/nineBall.ts`, `test/nine-ball.test.ts`
- Modify: `packages/modes/src/index.ts`

**Interfaces:**
- Consumes: os tipos e turnos da Tarefa 1; `shotFacts` e `test/helpers.ts` da Tarefa 2; a cópia congelada de `NineBallRules.js`.
- Produces:
  - `nineBall: GameMode<NineBallState>`, com `NineBallState = ModeStateBase & { modeId: '9ball'; pocketed: number[]; fouls: number[]; pushOut: { available: boolean; pending: boolean; seat: number | null }; threeFoulLoss: boolean }`:
    - `fouls` são as faltas seguidas de cada lugar;
    - `threeFoulLoss` vem de `cfg.options?.threeFoulLoss ?? true`;
    - `formats` é `['1v1']`;
    - `tableProfiles` é `['pool9ft', 'bar7ft']`.
  - `nineBallStatus(state): { targetBall: number }`, a menor bola em mesa (o `_currentTarget` legado).

Semântica: port de `NineBallRules.resolveShot`, `_applyConsecutiveFouls` e push-out, com a mesma tradução da Tarefa 2, mais estas regras:
- o push-out é declarado na tacada (`shot.pushOut`). `validateShot` devolve `PUSH_OUT_UNAVAILABLE` se `!pushOut.available` e `PUSH_OUT_PENDING` se há uma escolha pendente;
- `applyChoice(state, seat, { kind: 'push_out', accept })` faz o que `acceptPushOut`/`passPushOut` fazem. `accept: true` dá a vez ao lugar que escolhe, e `false` devolve ao `pushOut.seat`. As mensagens são `PUSH_OUT_ACCEPTED`/`PUSH_OUT_PASSED`, com `params.seat` do próximo;
- a 9 encaçapada numa falta ou no push-out vai para `respot: [9]`;
- `THREE_FOUL_WARNING` entra em `messages` antes da mensagem da tacada, quando o lugar chega a 2 faltas seguidas;
- `THREE_FOUL_LOSS` usa `params.seat` do perdedor;
- `resolveTimeout` faz o mesmo que no 8-ball, mais a contagem de faltas seguidas e a limpeza de `pushOut.pending` (o `startShot` legado o zera).

`rackLayout` usa as fórmulas de `BallsManager._rackNineBall` (`apps/client/src/game/BallsManager.js:72-117`). São 10 bolas, ids 0 a 9.

- [ ] **Step 1: Escrever os testes que falham**

Porte os 22 testes de 9-ball de `apps/client/test/rules.test.js` (linhas 45-317) e o `serializer round-trips 9-ball state` (linhas 377-399). Use a tabela da Tarefa 2, mais estas traduções:

| Legado | `packages/modes` |
|--------|------------------|
| `new NineBallRules({ threeFoulLoss: false })` | `nineBall.createInitialState({ ...config9, options: { threeFoulLoss: false } }, rng)` |
| `rules.pushOutDeclared = true` antes da tacada | `shot.pushOut = true`, com `s.pushOut.available = true` |
| `declarePushOut()` devolve `true`/`false` | `validateShot(s, 0, { ...shot, pushOut: true })` dá `{ ok: true }` / `{ ok: false, reason: 'PUSH_OUT_UNAVAILABLE' }` |
| `acceptPushOut()`/`passPushOut()` | `applyChoice(s, 1, { kind: 'push_out', accept: true / false })` |
| `rules.player1ConsecutiveFouls` | `r.state.fouls[0]` |
| `rules.pushOutPending`, `pushOutPlayer` | `r.state.pushOut.pending`, `r.state.pushOut.seat` |
| `result.respotNineBall` | `r.respot.includes(9)` |
| `result.message.includes('已连续两次犯规')` | `r.messages[0].code === 'THREE_FOUL_WARNING'`. O texto é checado no cliente, na Tarefa 5 |

Testes novos:

```ts
test('validateShot: push-out pendente bloqueia a tacada até a escolha', () => { /* PUSH_OUT_PENDING */ });
test('tempo esgotado conta como falta seguida e limpa o push-out pendente', () => { /* fouls[seat] + 1; pushOut.pending false */ });
test('rackLayout repete o losango de hoje', () => { /* 10 balls; ball 9 at (0, rackZ + 2 * d * Math.sin(Math.PI / 3)) */ });
test('diferencial: 3000 tacadas aleatórias decidem como o NineBallRules.js congelado', () => { /* as in Task 2, plus push-out declared at random when available and a random accept/pass when pending; compares pushOut and fouls too */ });
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/modes`
Expected: FAIL: `nineBall` não existe.

- [ ] **Step 3: Implementar `nineBall.ts`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/modes && npm run typecheck`
Expected: PASS. Os 23 portados, os 4 novos e os anteriores passam. Com a Tarefa 2, são 28 testes portados.

- [ ] **Step 5: Commit**

```bash
git add packages/modes
git commit -m "feat(modes): port 9-ball with push-out and three-foul rules"
```

---

### Task 4: `MatchState` e invariantes (F2-01)

**Files:**
- Create: `packages/modes/src/match.ts`, `test/match.test.ts`
- Modify: `packages/modes/src/index.ts`, que passa a exportar `MODES = { '8ball': eightBall, '9ball': nineBall }`.

**Interfaces:**
- Consumes: `GameMode`, `eightBall`, `nineBall` e `removeSeat`/`activeTeams`.
- Produces:
  - `interface SeatSlot { index: number; userId: string | null; connected: boolean; timeouts: number }`.
  - `interface MatchState<S> { seats: SeatSlot[]; turnId: number; phase: 'LOBBY' | 'AWAITING_SHOT' | 'SIMULATING' | 'PLAYBACK' | 'ENDED'; mode: S }`.
  - `createMatch(mode, cfg, rng, firstSeat = 0): MatchState`:
    - `phase` é `'AWAITING_SHOT'` e `turnId` é 0;
    - há um `SeatSlot` por lugar, com `userId` null e `connected` true.
  - `applyRuling(match, ruling): MatchState`:
    - `mode` passa a ser `ruling.state` e `turnId` aumenta em 1;
    - `phase` vira `'ENDED'` se `ruling.winnerTeam !== null`, senão `'AWAITING_SHOT'`.
  - `removeMatchSeat(match, mode, seat): MatchState` usa `mode.onSeatRemoved` e encerra a partida se houver vencedor.
  - `currentSeat(match): number | null`: null quando `ENDED`, senão `match.mode.turn.currentSeat`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
test('invariante: até o fim sempre há um lugar da vez, ativo, e a decisão aponta para ele', () => {
  // For (8ball,1v1), (8ball,2v2), (9ball,1v1): 300 games each with mulberry32(seed), up to 200 actions per game.
  // Actions: a random shot (ev() over the balls on the table, as in the Task 2 differential), a 10% timeout,
  // a push-out choice when pending, and in 2% of actions a removeMatchSeat.
  // After each action: phase === 'ENDED' ⇔ mode.winnerTeam !== null;
  //   if not ended: seat = currentSeat(match) is not eliminated, its team is in activeTeams, and ruling.nextSeat === seat;
  //   ruling.ballInHand → ruling.ballInHand.seat === ruling.nextSeat;
  //   JSON.parse(JSON.stringify(match)) deep-equals match.
});
test('desistência em 1×1 dá a vitória à outra equipe e encerra a partida', () => { /* removeMatchSeat(m, eightBall, 0) → phase ENDED, mode.winnerTeam 1, currentSeat null */ });
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/modes`
Expected: FAIL: `createMatch` não existe.

- [ ] **Step 3: Implementar `match.ts` e `MODES`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/modes && npm run typecheck`
Expected: PASS. Se o invariante falhar, a causa vai para `superpowers:systematic-debugging`. Nunca afrouxe a asserção.

- [ ] **Step 5: Commit**

```bash
git add packages/modes
git commit -m "feat(modes): add MatchState with the always-a-seat-to-play invariant"
```

---

### Task 5: `LocalMatchController` no cliente

**Files:**
- Create: `apps/client/src/match/LocalMatchController.js`, `src/match/rulingText.js`, `src/match/turnResult.js`, `apps/client/test/local-match.test.js`
- Modify: `apps/client/package.json` (dependência `"@billiards/modes": "*"`, script `test:local-match` e entrada no `test`)

**Interfaces:**
- Consumes:
  - `MODES`, `createMatch`, `applyRuling`, `removeMatchSeat`, `currentSeat`, `eightBallStatus` e `nineBallStatus` de `@billiards/modes`;
  - `simClient` e `SimResult` da F1-B.
- Produces:
  - `class LocalMatchController`:
    - `constructor({ modeId, tableProfile, format = { kind: '1v1' }, simClient, simTimeoutMs = 10000 })`. `modeId` é `'8ball'`, `'9ball'` ou `null` (treino livre e treinador: só simula, sem regras). `tableProfile` é o perfil do cliente; a geometria vai para o `MatchConfig`, com `ballRadius: BALL.radius` e `maxPower: SHOT.maxPower`.
    - Propriedades: `simClient` (pública e trocável, para os testes) e `match` (`MatchState`, ou `null` sem modo).
    - `newRack(firstSeat = 0): BallPlacement[]` cria uma partida nova, invalida as tacadas pendentes e devolve o `rackLayout`. Sem modo, devolve o do 8-ball.
    - `async submitShot(table, shot): Promise<{ initial, result, ruling }>`:
      1. `validateShot`. Uma recusa rejeita com um `Error` que tem `rejected: true` e `reason`, sem chamar o worker.
      2. Com `shot.cueBall`, a branca vai para essa posição, com `pocketed: false`, na mesa enviada ao sim e devolvida em `initial`. É o que o servidor fará na F4, e resolve a pendência da F1-A sobre a branca encaçapada com bola na mão.
      3. Força `<= 0` usa o resultado vazio `{ frames: [], events: [], final: table, steps: 0, simSeconds: 0, capped: false }`, sem worker.
      4. Senão, `simClient.simulate(table, { angle, power, spin })`, com limite de `simTimeoutMs`. No limite, rejeita com `/simulation timed out/`.
      5. Se `newRack`, `restore` ou `dispose` aconteceram no meio, rejeita com `Error` que tem `stale: true` e não aplica nada.
      6. Senão, `ruling = mode.resolveShot(match.mode, seat, result.events, result.final, shot)` e `match = applyRuling(match, ruling)`.
      Sem modo, `ruling` é `null`.
    - `timeout(): Ruling`, `choosePushOut(accept): Ruling` e `concede(seat): void` aplicam ao `match`.
    - `status(): MatchStatus | null`: o formato do `getStatus()` legado, para a UI, a IA e o espectador mudarem só a origem:
      - `currentPlayer`, `breakShot`, `gameOver`, `winner`;
      - `player1Group`, `player2Group`, `player1Remaining`, `player2Remaining`;
      - `targetBall`, `player1ConsecutiveFouls`, `player2ConsecutiveFouls`, `pushOutAvailable`, `pushOutPending`;
      - `ballInHand: { player, kitchen } | null`.
    - `toJSON(): MatchState | null`, `restore(json): void` (LAN; invalida as tacadas pendentes) e `dispose(): void`.
  - `rulingText(modeId, messages, names): string`. Junta as mensagens na ordem, com o mesmo texto de hoje para cada código. As fontes são `Rules.js:101-266`, `NineBallRules.js:128-401`, `UIText.turnTimeout`, `pushOutAcceptedMsg`, `pushOutPassedMsg` e `threeFoulLoss`. `names` é `[nome do jogador 1, nome do jogador 2]`.
  - `toTurnResult(modeId, ruling, status, names)` monta o resultado legado que o `resolveTurn` consome. Os campos são `nextPlayer`, `foul`, `scratch`, `ballInHand`, `ballInHandBehindLine`, `message`, `gameOver`, `winner`, `respotEightBall`, `respotNineBall`, `pushOutPending` e `reasonCode`. `reasonCode` é a primeira falta ou o primeiro código de desfecho (`EIGHT_ON_BREAK_RESPOT`, `EARLY_EIGHT`, `LEGAL_EIGHT_WIN`, `NINE_ON_BREAK_WIN`, `NINE_ON_FOUL_RESPOT`, `LEGAL_NINE_WIN`, `THREE_FOUL_LOSS`), com `NINE_ON_FOUL_RESPOT` à frente da falta, como no legado.

- [ ] **Step 1: Escrever os testes que falham**

```js
// apps/client/test/local-match.test.js — fake simClient: simulate(table, shot) returns a gate or a canned SimResult with ev()-like events
test('submitShot valida, simula e decide pelo modo', async () => { /* 8ball break: first_contact 1, pocket 3 → ruling.nextSeat 0; status().breakShot false; match.turnId 1 */ });
test('força 0 não chama o worker e é falta sem contato', async () => { /* calls 0; ruling.fouls ['NO_BALL_HIT']; status().currentPlayer 2 */ });
test('resultado de tacada abandonada é ignorado', async () => { /* gated simulate; newRack(); release → rejects with err.stale; toJSON() equals a fresh rack */ });
test('worker que não responde: o tempo esgota e nada é aplicado', async () => { /* simTimeoutMs 50, never resolves → rejects /simulation timed out/; status unchanged; the next submit resolves */ });
test('push-out declarado sobrevive a uma tacada que falha', async () => { /* 9ball after a legal break; shot.pushOut true; simulate rejects → status().pushOutAvailable true, currentPlayer unchanged */ });
test('bola na mão fora da cozinha é recusada sem chamar o worker', async () => { /* after an 8ball break scratch: cueBall z 0 → err.rejected, reason CUE_BALL_OUTSIDE_KITCHEN, calls 0 */ });
test('bola na mão: a branca vai para shot.cueBall na mesa simulada', async () => { /* table with the cue pocketed; cueBall { x: 0, z: -100 } → the fake receives ball 0 at (0, -100), pocketed false; outcome.initial matches */ });
test('toJSON e restore reproduzem o status (LAN)', () => { /* … */ });
test('tempo esgotado e desistência', () => { /* timeout(): currentPlayer 2, ballInHand { player: 2, kitchen: false }; concede(0): gameOver, winner 2 */ });
test('rulingText dá o mesmo texto de hoje', () => {
  assert.equal(rulingText('8ball', [{ code: 'POCKETED', params: { count: 2 } }], ['P1', 'P2']), '打进 2 颗球！继续击球。');
  assert.match(rulingText('9ball', [{ code: 'THREE_FOUL_WARNING' }, { code: 'FOUL', params: { reason: 'SCRATCH' } }], ['P1', 'P2']), /已连续两次犯规/);
  // every MessageCode has a non-empty text in both modes where the mode emits it
});
test('toTurnResult converte a decisão para o formato do resolveTurn', () => { /* 8ball break foul → { nextPlayer: 2, foul: true, ballInHand: true, ballInHandBehindLine: true, reasonCode: 'SCRATCH' } */ });
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm install && npm run test:local-match -w apps/client`
Expected: FAIL: `Cannot find module .../src/match/LocalMatchController.js`.

- [ ] **Step 3: Implementar `LocalMatchController.js`, `rulingText.js` e `turnResult.js`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test:local-match -w apps/client && npm test -w packages/modes`
Expected: PASS (11/11).

- [ ] **Step 5: Commit**

```bash
git add apps/client package-lock.json
git commit -m "feat(client): add LocalMatchController over packages/modes and the sim worker"
```

---

### Task 6: O `Game` obedece ao `LocalMatchController` (F2-05)

**Files:**
- Create: `apps/client/test/no-legacy-rules.test.js`
- Delete: `apps/client/src/game/Rules.js`, `src/game/NineBallRules.js` e `test/rules.test.js`
- Modify:
  - `apps/client/src/game/Game.js`;
  - `src/game/BallsManager.js` (`applyLayout(layout)`);
  - `src/ai/AIPlayer.js`, `src/spectator/SpectatorMode.js`, `src/game/ShotInput.js` e `src/net/GameStateSerializer.js`;
  - `apps/client/package.json`: sai `test:rules`, entra `test:no-legacy-rules`;
  - os testes que leem `game.rules`, em `test/full-match.test.js`, `test/browser-regressions.test.js` e `test/runtime-regressions.test.js`.

**Interfaces:**
- Consumes: Tarefa 5 (`LocalMatchController`, `toTurnResult`, `rulingText`), além de `Game.shoot`, `_startPlayback`, `resolveTurn`, `_placeCueBallInHand` e `_endBallInHand` da F1-B.
- Produces:
  - `Game.match` (`LocalMatchController`).
  - `Game.simClient` vira um getter/setter que delega para `this.match.simClient`. Os testes que trocam `game.simClient` continuam valendo.
  - `BallsManager.applyLayout(layout: BallPlacement[]): void` põe as bolas listadas na mesa e tira as outras.
  - O `Game` não tem mais `rules`.

- [ ] **Step 1: Escrever os testes que falham**

```js
// apps/client/test/no-legacy-rules.test.js — F2: the client has no rules of its own
test('src não tem regras próprias', () => {
  assert.equal(existsSync('src/game/Rules.js'), false); assert.equal(existsSync('src/game/NineBallRules.js'), false);
  for (const file of jsFilesUnder('src')) assert.doesNotMatch(readFileSync(file, 'utf8'), /\bRules\.js\b|NineBallRules|\.rules\b/, file);
});
```

Em `browser-regressions.test.js`, logo depois do subteste de tacada por arraste:

```js
await t.test('an 8-ball turn is decided by the match controller', async () => {
  // local2p: drag shot as above, wait for AIM; then:
  const r = await page.evaluate(() => ({ hasRules: 'rules' in __menu.game, turnId: __menu.game.match.toJSON().turnId, status: __menu.game.match.status() }));
  assert.equal(r.hasRules, false); assert.equal(r.turnId, 1); assert.equal(r.status.breakShot, false);
});
```

Atualize os testes que leem ou forçam `game.rules`. O subteste LAN força o fim do jogo com `game.match.concede(0)` antes do `resolveTurn([], { gameOver: true, winner: 2, … })`, e o `full-match` lê `game.match.status().gameOver`. Não afrouxe nenhuma asserção.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm run test:no-legacy-rules -w apps/client`
Expected: FAIL, listando os arquivos de regras e os leitores de `.rules`.

- [ ] **Step 3: Ligar o `Game` ao controlador**

- **`init` e `resetGame`:**
  - `this.match = new LocalMatchController({ modeId, tableProfile, simClient })`. `modeId` é `'9ball'` para `9ball`, `null` para `freeplay` e `trainer` e `'8ball'` para o resto.
  - O rack sai de `this.match.newRack(this.currentPlayer - 1)` por `ballsManager.applyLayout`. O treinador continua com `setupDrill`.
  - `init` aquece o worker como hoje.
- **`shoot()`, caminho local:**
  - `_simulateShot` chama `this.match.submitShot(table, shot)`. O `shot` leva `pushOut` quando o jogador declarou o push-out nesta vez, e `cueBall` quando houve bola na mão nesta vez. A posição vem de `_endBallInHand` e de `_placeCueBallInHand`, e é limpa depois do uso.
  - O resultado vai para `_startPlayback({ initial, ...result })`, e o `ruling` fica guardado para o fim da reprodução.
  - `err.stale` é ignorado sem aviso. `err.rejected` mostra a mensagem e volta a `AIM`. Os outros erros seguem para `_cancelShot`.
  - `_isBreakShot` vem de `status().breakShot` antes da tacada. Saem `rules.startShot`, `recordFirstHit` e `recordCushionHit`.
- **`resolveTurn`:** `this.rules.resolveShot(...)` vira `toTurnResult(modeId, ruling, this.match.status(), names)`. O resto do método fica igual. Leituras de `rules.getStatus()` e de faltas seguidas passam a usar `this.match.status()`.
- **Tempo esgotado, push-out e desistência:**
  - `_onTurnTimerExpired` usa `this.match.timeout()`;
  - `_onPushOutClicked` só marca a intenção se `status().pushOutAvailable`;
  - `_applyPushOutChoice` usa `this.match.choosePushOut(accept)`;
  - `_concede` usa `this.match.concede(seat)`.
- **Leitores:**
  - `AIPlayer` e `SpectatorMode` leem `game.match.status()`, e o grupo vem de `player${n}Group`;
  - `ShotInput` lê `pushOutPending` do status;
  - `GameStateSerializer` envia `match: game.match.toJSON()` e aplica com `game.match.restore(snapshot.match)`.
- **Remoção:** apague os dois arquivos de regras e `test/rules.test.js`, e tire `test:rules` do `package.json`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w apps/client && npm test -w packages/modes && npm run build`
Expected: PASS em tudo:
- `no-legacy-rules`;
- browser, incluindo o subteste LAN;
- `full-match`, com a partida contra a IA até o fim;
- smoke 54/54;
- o build.

Depois do build, `git checkout -- apps/client/dist`.

- [ ] **Step 5: Commit**

```bash
git add apps/client package-lock.json
git checkout -- apps/client/dist
git commit -m "feat(client): decide every turn with LocalMatchController and packages/modes"
```

---

### Task 7: Partidas locais de 2 jogadores até o fim (F2-05)

**Files:**
- Create: `apps/client/test/local-2p-match.test.js`
- Modify: `apps/client/package.json` (script `test:local-2p` e entrada no `test`, antes de `test:smoke`)

**Interfaces:**
- Consumes: `MenuSystem._startGame('local2p' | '9ball')`, `Game.playbackRate`, `_placeCueBallInHand`, `_endBallInHand`, `onMouseUp`, `_applyPushOutChoice`, `Game.match.status()` e `AIPlayer`.

- [ ] **Step 1: Escrever o teste**

O arquivo segue o modelo de `full-match.test.js`: servidor, navegador e coleta de `pageerror`, `console.error` e avisos `shot simulation failed`. Ele tem dois testes:
- `8-ball local de 2 jogadores vai até o fim sem erros`;
- `9-ball local de 2 jogadores vai até o fim sem erros`.

Cada teste joga as tacadas dos **dois** lugares pelo caminho do mouse, como o `playHumanTurn` da F1-B, com `AIPlayer('hard')` e tempo de pensar 0. Também resolve a bola na mão. No 9-ball, com `pushOutPending`, escolhe `accept` por `_applyPushOutChoice('accept')`.

Os limites são 300 tacadas por partida e 600 s por teste, com `playbackRate = 8`. As asserções:
- `status().gameOver === true`;
- `winner` em `{1, 2}`;
- `state === 'GAME_OVER'` depois de 10 quadros;
- lista de erros vazia.

- [ ] **Step 2: Rodar**

Run: `npm run test:local-2p -w apps/client` (duas vezes)
Expected: PASS nas duas, com os tempos e o número de tacadas no relatório. Uma falha vai para `superpowers:systematic-debugging`; nunca afrouxe a asserção nem o limite sem uma decisão registrada.

- [ ] **Step 3: Commit**

```bash
git add apps/client
git commit -m "test(client): play local two-player 8-ball and 9-ball matches to the end (F2-05)"
```

---

### Task 8: Fechamento da F2

**Files:**
- Modify:
  - `harness/feature_list.json` (F2-01 a F2-05), `harness/progress.md` e `harness/init.sh` (`FAST_SUITES` com `packages/modes` e `test:local-match`);
  - `docs/superpowers/plans/2026-10-24-roteiro.md`;
  - `CLAUDE.md`: o "Comandos" troca `test:rules` por `npm test -w packages/modes`, e entram as suítes novas.

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm test && npm run typecheck && npm run build && npm run test:dist -w apps/client && bash harness/init.sh`
Expected: tudo verde, e `git checkout -- apps/client/dist` depois do build.

- [ ] **Step 2: Marcar os itens e atualizar o harness**

Marque cada item só se a sua verificação rodou neste passo e passou:

| Item | Verificação |
|------|-------------|
| F2-01 | `types.test.ts` (com `tsc`) e o invariante de `match.test.ts` |
| F2-02 | os 5 testes portados do 8-ball e o diferencial |
| F2-03 | push-out, três faltas e bola mais baixa portados, e o diferencial |
| F2-04 | `2×2: ordem A1, B1, A2, B2` e `cada um por si com 5 lugares pula os eliminados` |
| F2-05 | suítes de navegador e `local-2p-match` |

Atualize a linha da F2 no roteiro, o "Estado atual", o "Próximo passo" (a confirmação do F1-09, se ainda faltar, e o plano da F3) e o registro da sessão.

- [ ] **Step 3: Commit e push**

```bash
git add harness docs CLAUDE.md
git commit -m "docs(f2): close phase F2 and update roadmap and harness"
git push -u origin claude/planejamento-online
```
