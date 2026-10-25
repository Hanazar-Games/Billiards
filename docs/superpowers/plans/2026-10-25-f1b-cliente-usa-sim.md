# F1-B — Cliente usa `packages/sim`: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O cliente offline deixa de rodar a física legada. Cada tacada é simulada por `packages/sim` num Web Worker e reproduzida a partir da trajetória v1. A física legada sai de `apps/client`, uma partida de 8-ball contra a IA vai até o fim no navegador e o recuo é confirmado pelo usuário no jogo.

**Architecture:** O worker recebe o estado da mesa e a tacada e devolve a trajetória codificada (`encodeTrajectory`), os eventos e o estado final. Esse é o mesmo pacote que o servidor vai mandar na F4 (D011, D012). No thread principal, um `TrajectoryPlayer` sem Three.js interpola as amostras na taxa de quadros da tela e entrega os eventos no instante em que acontecem. O `Game` aplica as poses nos meshes, reage aos eventos (regras, som, efeitos, estatísticas) e, no fim, aplica o estado final exato. A partir da Tarefa 4, o mesh é a fonte da posição de cada bola. As regras continuam em `Rules.js` e `NineBallRules.js`: o `LocalMatchController` com `packages/modes` é a F2.

**Tech Stack:** Vite 6 (worker ES module, `new Worker(new URL(...), { type: 'module' })`); Three.js 0.170; `@billiards/sim` e `@billiards/protocol` do workspace; `node:test` para as suítes novas do cliente; Puppeteer 25 com Chromium para as de navegador.

**Spec:** [`docs/superpowers/specs/2026-10-24-billiards-online-design.md`](../specs/2026-10-24-billiards-online-design.md): §5.3 (mudança central no cliente), §6 passo 6 (reprodução), §6.1 (trajetória v1), §9.3 (testes de `apps/client`), §10 (F1). Plano anterior: [`2026-10-24-f1a-nucleo-simulacao.md`](2026-10-24-f1a-nucleo-simulacao.md).

## Decisões que este plano propõe

Registradas em `harness/decisions.json` com `status: "open"` junto com este plano. A Tarefa 1 as marca como `accepted` quando o plano for aprovado.

| Id | Decisão | Por quê |
|----|---------|---------|
| **D042** | Os testes de paridade e de sensação de `packages/sim` e o spike `spikes/sim-bench` passam a carregar uma **cópia congelada** dos 10 arquivos de física do legado, em `packages/sim/test/legacy/client/`. Os arquivos são idênticos aos da base `0448b03`, e um manifesto com SHA-256 impede edição. | Hoje eles importam `apps/client/src/` (`legacy-world.js`, `legacy-run.js`, `spikes/sim-bench/src/world.js`). Tirar a física do cliente quebraria a paridade bit a bit, que a D041 manda manter com `TUNING_LEGACY`, a referência de sensação e o benchmark da D034. |
| **D043** | Na F1-B, os replays (`ShotRecorder`, `ReplayLibrary`, replay instantâneo) mantêm o formato atual, gravado dos meshes durante a reprodução. A migração para a trajetória v1 e para o `TrajectoryPlayer` fica para a F4. Isso adia em parte a D012 ("replays usam o mesmo formato"). | Os replays salvos ficam no `localStorage` no formato antigo, e convertê-los exige migração. Nada no critério de saída da F1-B depende disso. A F4 publica o formato em `docs/protocol.md`. |

## Global Constraints

- Node ≥ 22.12 (executa `.ts` direto). Testes de navegador com Puppeteer e Chromium: `PUPPETEER_EXECUTABLE_PATH` aponta para o Chromium do sistema quando o Puppeteer não baixou o seu.
- `packages/sim/src` não muda na F1-B. O cliente usa o `TUNING` padrão (D041) e nunca passa `tuning`.
- Só o worker executa `simulateShot`. O código do thread principal importa de `@billiards/sim` só pelo gancho de desenvolvimento da Tarefa 6, atrás de `import.meta.env.DEV`. Assim o `cannon-es` fica fora do bundle principal.
- Caminho único de reprodução (D012): o thread principal decodifica a trajetória com `decodeTrajectory` de `@billiards/protocol`, mesmo offline.
- Unidades em centímetros; bolas no plano XZ com `y = BALL.radius`; quatérnios como `[x, y, z, w]`.
- Tacada enviada ao sim: `angle = Math.atan2(aimDirection.z, aimDirection.x)`, `power = force` (a mesma de hoje, já limitada a `SHOT.maxPower`) e `spin = { x: cueTipOffset.x, y: cueTipOffset.y }`. Essa é a conversão que a paridade da F1-A usou.
- O LAN continua funcionando até a F4 (D016): o host simula pelo worker e o convidado recebe snapshots com as poses dos meshes.
- O cliente segue em JavaScript ES2022 com módulos ES, no estilo de cada arquivo. As strings novas da interface seguem o idioma atual de `UIText.js` (chinês); a tradução é a F5.
- Suítes novas do cliente: `node test/<nome>.test.js` com `node:test`, com script `test:<nome>` em `apps/client/package.json` e entrada no script `test`.
- Commits em inglês (conventional commits); documentos em PT-BR. Commit e push na branch de trabalho ao fim de cada interação (D028).

## Review Focus

1. **Resultado da simulação que chega depois de a tacada ter sido abandonada** (volta ao menu, `resetGame`, novo rack, `dispose`). Esperado: o resultado é ignorado, sem erro no console e sem mudar o estado. Teste na Tarefa 4.
2. **Falha no worker** (exceção em `simulateShot` ou o worker que morre). Esperado: a tacada é cancelada, as bolas ficam onde estavam, o jogo volta a `AIM` com aviso, e a tacada seguinte funciona com um worker novo. Testes nas Tarefas 2 e 4.
3. **`dt` grande** (aba em segundo plano; o `GameLoop` limita o `dt` a 0,1 s) **ou reprodução acelerada.** Esperado: cada evento sai uma única vez, em ordem, e o estado final é aplicado exato. Teste na Tarefa 3.
4. **Tacada com força 0** (Enter sem carregar; `shotInput` remoto do LAN com força 0). O sim recusa `power ≤ 0`. Esperado: o mesmo que o legado, ou seja, nenhuma bola se move e o turno é resolvido como tacada sem contato, sem `RangeError`. Testes nas Tarefas 3 e 4.
5. **Pausa ou configurações abertas durante a reprodução.** Esperado: a reprodução para e retoma do mesmo instante, sem pular eventos. Teste na Tarefa 4.

## Fora do escopo da F1-B

- `LocalMatchController` e `packages/modes` (F2). O `Game` continua dono das regras.
- Linha-guia de mira com a geometria de `packages/sim` (spec §6, passo 1). O `TrajectoryPredictor` atual fica.
- Divergência do golden entre Chromium, Firefox e WebKit com Playwright (spec §9.3, informativa). O Playwright não está instalado; fica para quando o modo offline for comparado entre navegadores.
- Replays no formato v1 (D043).

## Estrutura de arquivos

```
packages/sim/test/legacy/client/        cópia congelada (D042): config.js, core/PhysicsWorld.js, game/{Table,TableProfiles,BallsManager,Ball}.js,
                                         theme/{TableThemes,ProceduralTextures,BallThemes}.js, trainer/DrillData.js, MANIFEST.json, README.md
packages/sim/test/legacy-copy.test.js   manifesto e "ninguém importa apps/client"
apps/client/src/sim/simRequest.js       handleSimRequest: simula e codifica (puro, testável no Node)
apps/client/src/sim/sim.worker.js       liga onmessage → handleSimRequest
apps/client/src/sim/SimWorkerClient.js  simulate(table, shot) → Promise; um worker compartilhado (simClient)
apps/client/src/sim/TrajectoryPlayer.js poses interpoladas + eventos por intervalo de tempo (puro)
apps/client/src/game/ShotPlayback.js    aplica as poses do TrajectoryPlayer nos meshes das bolas
apps/client/src/dev/referenceShots.js   gancho de desenvolvimento __referenceShot(name) (F1-09)
apps/client/test/sim-worker.test.js, trajectory-player.test.js, no-legacy-physics.test.js, full-match.test.js
docs/f1/roteiro-teste-manual.md         roteiro da confirmação do usuário (F1-09)
```

Removidos na Tarefa 5: `apps/client/src/core/PhysicsWorld.js`, a física de `Ball.js`, `BallsManager.js` e `Table.js`, e a dependência `cannon-es` de `apps/client`.

---

### Task 1: Cópia congelada do legado para os testes do sim (D042)

**Files:**
- Create: `packages/sim/test/legacy/client/` com os 10 arquivos (lista na Estrutura de arquivos), `MANIFEST.json` e `README.md`
- Create: `packages/sim/test/legacy-copy.test.js`
- Modify: `packages/sim/test/legacy/legacy-world.js:5-9`, `packages/sim/test/legacy/legacy-run.js:13`, `spikes/sim-bench/src/world.js:4-7`, `spikes/sim-bench/src/run-shot.js:3` (importações)
- Modify: `harness/decisions.json` (D042 e D043 de `open` para `accepted`)

**Interfaces:**
- Produces: `packages/sim/test/legacy/client/<caminho>`, com os mesmos caminhos relativos de `apps/client/src/`. As importações relativas internas dos arquivos continuam válidas.

- [ ] **Step 1: Escrever o teste que falha**

```js
// packages/sim/test/legacy-copy.test.js — D042: frozen legacy, nobody imports the client
test('a cópia congelada do legado bate com o MANIFEST.json', () => {
  const dir = new URL('./legacy/client/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('MANIFEST.json', dir), 'utf8'));
  assert.equal(Object.keys(manifest).length, 10);
  for (const [path, sha256] of Object.entries(manifest)) {
    // CRLF → LF: a checkout with core.autocrlf must not change the hash.
    const text = readFileSync(new URL(path, dir), 'utf8').replaceAll('\r\n', '\n');
    assert.equal(createHash('sha256').update(text).digest('hex'), sha256, path);
  }
});

test('nenhum teste, ferramenta ou benchmark importa apps/client', () => {
  for (const root of ['packages/sim/test', 'packages/sim/tools', 'packages/sim/bench', 'spikes/sim-bench/src']) {
    for (const file of jsFilesUnder(root)) {   // recursive, skips test/legacy/client
      assert.doesNotMatch(readFileSync(file, 'utf8'), /apps\/client/, file);
    }
  }
});
```

`jsFilesUnder(root)` é um helper local do arquivo: `readdirSync(..., { recursive: true })`, filtrado por `.js`/`.mjs`, com os caminhos relativos à raiz do repositório.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test packages/sim/test/legacy-copy.test.js`
Expected: FAIL nos 2 testes (falta o `MANIFEST.json`; `legacy-world.js` importa `apps/client`).

- [ ] **Step 3: Copiar da base e gerar o manifesto**

Para cada arquivo `f` da lista: `git show 0448b03:src/$f > packages/sim/test/legacy/client/$f`. Depois, gere o `MANIFEST.json` (`{ "<f>": "<sha256 do texto com CRLF trocado por LF>" }`, chaves ordenadas) com um comando `node -e` de uma linha. O `README.md` diz, em PT-BR: cópia de Hanazar-Games/Billiards v1.26.13 (licença MIT, ver `LICENSE`), usada só pela paridade e pela referência de sensação, e nunca editada.

- [ ] **Step 4: Apontar as importações para a cópia**

`legacy-world.js` e `legacy-run.js` passam a importar de `./client/...`. Em `spikes/sim-bench/src/world.js` e `run-shot.js`, o prefixo vira `../../../packages/sim/test/legacy/client/`.

- [ ] **Step 5: Rodar tudo o que usa o legado**

Run: `npm test -w packages/sim && node --test spikes/sim-bench/test && npm run bench -w packages/sim && node packages/sim/tools/legacy-reference.mjs && git diff --exit-code packages/sim/test/feel/legacy-reference.json`
Expected: sim 60/60 (58 + 2 novos); spike verde; `ratio` ≥ 1,3; a referência regenerada é idêntica (o `git diff` sai com 0).

- [ ] **Step 6: Aceitar D042/D043 e fazer commit**

Marque D042 e D043 como `accepted`, com `source` "plano da F1-B aprovado pelo usuário em <data>".

```bash
git add packages/sim/test spikes/sim-bench/src harness/decisions.json
git commit -m "test(sim): freeze the legacy physics the parity tests compare against"
```

---

### Task 2: Worker de simulação no cliente

**Files:**
- Create: `apps/client/src/sim/simRequest.js`, `apps/client/src/sim/sim.worker.js`, `apps/client/src/sim/SimWorkerClient.js`
- Modify: `apps/client/package.json` (dependências `"@billiards/sim": "*"` e `"@billiards/protocol": "*"`; script `test:sim-worker`; entrada no `test`), `apps/client/vite.config.js` (`worker: { format: 'es' }`)
- Test: `apps/client/test/sim-worker.test.js`; novo subteste em `apps/client/test/browser-regressions.test.js`

**Interfaces:**
- Consumes: `simulateShot(table, shot)` e os tipos `TableState`, `ShotInput`, `SimEvent` de `@billiards/sim`; `encodeTrajectory`, `decodeTrajectory` e `TrajectoryFrame` de `@billiards/protocol`.
- Produces:
  - `handleSimRequest({ id, table, shot }) → { reply, transfer }`. `reply` é `{ id, ok: true, trajectory: Uint8Array, events, final, steps, simSeconds, capped }` ou `{ id, ok: false, error: string }`; `transfer` é `[reply.trajectory.buffer]` ou `[]`.
  - `class SimWorkerClient`, com `constructor(createWorker = () => new Worker(new URL('./sim.worker.js', import.meta.url), { type: 'module' }))`, `warm(): void`, `simulate(table, shot): Promise<SimResult>` e `dispose(): void`.
  - `SimResult = { frames: TrajectoryFrame[], events, final, steps, simSeconds, capped }`, com `frames` já decodificados.
  - `export const simClient = new SimWorkerClient()`: compartilhado pelo app, cria o worker só no primeiro `warm`/`simulate`.

- [ ] **Step 1: Escrever os testes que falham**

```js
// apps/client/test/sim-worker.test.js
import { CORPUS } from '../../../packages/sim/test/corpus.js';
const brk = CORPUS.find(c => c.name === 'break');

test('handleSimRequest devolve a trajetória codificada, os eventos e o estado final do sim', () => {
  const { reply, transfer } = handleSimRequest({ id: 7, table: brk.table, shot: brk.shot });
  const direct = simulateShot(brk.table, brk.shot);
  assert.equal(reply.id, 7); assert.equal(reply.ok, true);
  assert.deepEqual(decodeTrajectory(reply.trajectory), decodeTrajectory(encodeTrajectory(direct.frames)));
  assert.deepEqual([reply.events, reply.final, reply.steps, reply.capped], [direct.events, direct.final, direct.steps, direct.capped]);
  assert.deepEqual(transfer, [reply.trajectory.buffer]);
});

test('handleSimRequest transforma a exceção do sim em ok: false', () => {
  const { reply, transfer } = handleSimRequest({ id: 1, table: brk.table, shot: { ...brk.shot, power: NaN } });
  assert.equal(reply.ok, false); assert.match(reply.error, /power/); assert.deepEqual(transfer, []);
});

test('SimWorkerClient resolve cada pedido pelo id, mesmo fora de ordem', async () => {
  const fake = new FakeWorker(); const client = new SimWorkerClient(() => fake);
  const p1 = client.simulate(brk.table, brk.shot);
  const p2 = client.simulate(brk.table, { ...brk.shot, power: 20 });
  fake.reply(1); fake.reply(0);                       // answers the second request first
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.deepEqual(r1.final, simulateShot(brk.table, brk.shot).final);
  assert.deepEqual(r2.final, simulateShot(brk.table, { ...brk.shot, power: 20 }).final);
  assert.equal(r1.frames.length, Math.floor(r1.steps / 12));
});
test('SimWorkerClient rejeita com a mensagem de ok: false', async () => { /* power: NaN → assert.rejects(p, /power/) */ });
test('worker que morre rejeita os pedidos pendentes e o seguinte usa um worker novo', async () => {
  /* fake.fail() → assert.rejects(p1); the next simulate() calls the factory a second time and resolves */
});
test('dispose rejeita os pendentes e encerra o worker', async () => { /* assert.rejects(p, /disposed/); fake.terminated === true */ });
```

O `FakeWorker` é local ao teste: um `EventTarget` com `postMessage(msg)` (guarda a mensagem), `terminate()` (marca `terminated`), `reply(i)` (despacha `new MessageEvent('message', { data: handleSimRequest(msgs[i]).reply })`) e `fail()` (despacha `new Event('error')`).

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm run test:sim-worker -w apps/client`
Expected: FAIL: `Cannot find module .../src/sim/simRequest.js`.

- [ ] **Step 3: Implementar `simRequest.js`, `sim.worker.js` e `SimWorkerClient.js`**

`sim.worker.js` só faz `self.onmessage = (e) => { const { reply, transfer } = handleSimRequest(e.data); self.postMessage(reply, transfer); }`. O `SimWorkerClient` guarda os pedidos pendentes num `Map` por id. No evento `error` do worker, rejeita todos os pendentes, chama `terminate()` e esquece o worker; o próximo `simulate` cria outro.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm install && npm run test:sim-worker -w apps/client`
Expected: PASS (6/6).

- [ ] **Step 5: Subteste de navegador com o worker real**

Em `browser-regressions.test.js`, logo depois de `freeplay renders geometry…`:

```js
await t.test('the sim worker simulates a shot off the main thread', async () => {
  const r = await page.evaluate(async () => {
    const { simClient } = await import('/src/sim/SimWorkerClient.js');
    const table = { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: -50, pocketed: false }, { id: 1, x: 0, z: 0, pocketed: false }] };
    const res = await simClient.simulate(table, { angle: Math.PI / 2, power: 40, spin: { x: 0, y: 0 } });
    return { first: res.events.find(e => e.type === 'first_contact')?.ball, frames: res.frames.length, steps: res.steps, z1: res.final.balls[1].z };
  });
  assert.equal(r.first, 1); assert.equal(r.frames, Math.floor(r.steps / 12)); assert.ok(r.z1 > 0);
});
```

Run: `npm run test:browser -w apps/client`
Expected: PASS, com a lista de erros do console vazia no fim.

- [ ] **Step 6: Commit**

```bash
git add apps/client package-lock.json
git commit -m "feat(client): simulate shots with packages/sim in a web worker"
```

---

### Task 3: `TrajectoryPlayer`

**Files:**
- Create: `apps/client/src/sim/TrajectoryPlayer.js`
- Modify: `apps/client/package.json` (script `test:trajectory-player`; entrada no `test`)
- Test: `apps/client/test/trajectory-player.test.js`

**Interfaces:**
- Consumes: `SimResult` (Tarefa 2) e o `TableState` enviado ao sim.
- Produces: `class TrajectoryPlayer`:
  - `constructor({ initial, frames, events, final, simSeconds })`;
  - getters `duration` (= `simSeconds`) e `time`;
  - `advance(dt) → { poses: { id, x, z, q }[], events: SimEvent[], done: boolean }`.

Semântica que os testes fixam:
- **Instantes das poses.** As poses-chave de cada bola ficam em `0` (`initial`), no `t` de cada quadro e em `duration` (`final`). Um quadro lista só as bolas que se moveram. Uma bola ausente de um quadro repete a pose do quadro anterior (densificação por repetição).
- **Interpolação.** A posição é linear. A rotação usa nlerp pelo arco curto (troca o sinal quando o produto escalar é negativo).
- **Bolas encaçapadas.** `poses` lista só as bolas em jogo no instante atual. Uma bola sai a partir do instante do seu evento `pocket`, e uma bola encaçapada em `initial` nunca aparece. Uma bola encaçapada em `final` não interpola em direção a (0, 0): ela mantém a última pose dos quadros.
- **Eventos.** São os que têm `anterior < t ≤ atual`, na ordem de entrada; o primeiro avanço inclui `t = 0`.
- **Fim.** Quando `time ≥ duration`, `done` vale `true`, `poses` traz os valores exatos de `final` (não interpolados) e os eventos restantes saem todos. Um `dt` inválido (`NaN` ou ≤ 0) não avança.

- [ ] **Step 1: Escrever os testes que falham**

```js
// apps/client/test/trajectory-player.test.js
const play = (c) => { const r = simulateShot(c.table, c.shot); return { r, p: new TrajectoryPlayer({ initial: c.table, ...r, frames: decodeTrajectory(encodeTrajectory(r.frames)) }) }; };
const byName = (n) => CORPUS.find(c => c.name === n);

test('interpola posição e rotação entre amostras', () => {
  const q90 = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const p = new TrajectoryPlayer({ initial: { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: 0, q: [0, 0, 0, 1], pocketed: false }] },
    frames: [{ t: 1 / 30, balls: [{ id: 0, x: 3, z: 0, q: q90 }] }], events: [],
    final: { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 3, z: 0, q: q90, pocketed: false }] }, simSeconds: 1 / 30 });
  const { poses } = p.advance(1 / 60);
  assert.ok(Math.abs(poses[0].x - 1.5) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...poses[0].q) - 1) < 1e-12);
  assert.ok(Math.abs(poses[0].q[1] - Math.sin(Math.PI / 8)) < 1e-3);   // ≈ half of 90° about y
});

test('bola ausente num quadro fica parada até a amostra seguinte', () => {
  /* ball 1: frame 1 x = 10, absent from frame 2, frame 3 x = 13 → x(1.5/30) = 10, x(2.5/30) = 11.5 */
});

test('eventos saem uma vez e em ordem, com qualquer divisão de dt', () => {
  const { r, p } = play(byName('break'));
  const dts = [1 / 144, 0.1, 1 / 60, 1 / 240, 0.033];
  const seen = []; let out; let i = 0;
  do { out = p.advance(dts[i++ % dts.length]); seen.push(...out.events); } while (!out.done);
  assert.deepEqual(seen, r.events);
});

test('no fim, as poses são exatamente o estado final', () => {
  const { r, p } = play(byName('break'));
  let out; do { out = p.advance(1 / 60); } while (!out.done);
  assert.deepEqual(out.poses, r.final.balls.filter(b => !b.pocketed).map(({ id, x, z, q }) => ({ id, x, z, q })));
  assert.equal(p.time, p.duration);
});

test('dt enorme termina a tacada num avanço só, com todos os eventos', () => {
  const { r, p } = play(byName('break'));
  const out = p.advance(100);
  assert.equal(out.done, true); assert.deepEqual(out.events, r.events);
});

test('bola encaçapada some no instante do evento e não vai para (0, 0)', () => {
  const { r, p } = play(byName('pot-corner'));
  const tPocket = r.events.find(e => e.type === 'pocket' && e.ball === 1).t;
  let out; let last1 = null;
  do {
    out = p.advance(1 / 120);
    const b1 = out.poses.find(b => b.id === 1);
    if (p.time < tPocket) { assert.ok(b1); last1 = b1; } else assert.equal(b1, undefined);
  } while (!out.done);
  assert.ok(Math.hypot(last1.x, last1.z) > 10);
});

test('tacada vazia termina no primeiro avanço', () => {
  const t = byName('soft').table;
  const out = new TrajectoryPlayer({ initial: t, frames: [], events: [], final: t, simSeconds: 0 }).advance(1 / 60);
  assert.equal(out.done, true); assert.equal(out.poses.length, t.balls.filter(b => !b.pocketed).length);
});

test('dt inválido não avança', () => {
  const { p } = play(byName('break'));
  for (const dt of [NaN, -1, 0]) assert.deepEqual(p.advance(dt).events, []);
  assert.equal(p.time, 0);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm run test:trajectory-player -w apps/client`
Expected: FAIL: `Cannot find module .../src/sim/TrajectoryPlayer.js`.

- [ ] **Step 3: Implementar `TrajectoryPlayer.js`**

O construtor densifica as poses por bola num array por instante: `[0, ...frames.map(f => f.t), duration]`. O `advance` faz busca binária do intervalo. Sem Three.js: os quatérnios são arrays.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test:trajectory-player -w apps/client`
Expected: PASS (8/8).

- [ ] **Step 5: Commit**

```bash
git add apps/client
git commit -m "feat(client): play back v1 trajectories with timed shot events"
```

---

### Task 4: O `Game` reproduz as tacadas do worker

**Files:**
- Create: `apps/client/src/game/ShotPlayback.js`
- Modify:
  - `apps/client/src/game/BallsManager.js`: `toTableState`, `applyTableState`; `resetCueBallIfPocketed` lê o mesh.
  - `apps/client/src/game/Ball.js`: `speed`; `getSpeed()` devolve `this.speed`.
  - `apps/client/src/game/Game.js`: `shoot`, `update`, eventos, posicionamento da branca, `_respotBall`, `resetGame`, `dispose`.
  - `apps/client/src/menu/MenuSystem.js`: tira os 4 `this.physics.step(dt)`.
  - `apps/client/src/net/GameStateSerializer.js`: poses dos meshes.
  - `apps/client/src/core/UIText.js`: `shotSimulationFailed`.
- Test: `apps/client/test/browser-regressions.test.js`

**Interfaces:**
- Consumes: `simClient` e `SimResult` (Tarefa 2); `TrajectoryPlayer` (Tarefa 3).
- Produces:
  - `BallsManager.toTableState(tableProfileId) → TableState`: bolas por id, `{ id, x, z, q, pocketed }`, lidas de `mesh.position` e `mesh.quaternion`.
  - `BallsManager.applyTableState(state): void`: uma bola encaçapada chama `ball.remove()` se ainda não estiver fora; as outras recebem `mesh.position` (com `y = BALL.radius`), `mesh.quaternion` e `speed = 0`.
  - `class ShotPlayback`, com `constructor(ballsManager, player)`, o campo `player` (o `TrajectoryPlayer`, só leitura) e `update(dt) → { events, done }`. O `update` aplica as poses nos meshes e define `ball.speed` (cm/s, pela variação da pose em `dt`); no `done`, chama `applyTableState(final)`.
  - `Game.playback` (`ShotPlayback | null`), `Game.playbackRate` (padrão 1; fator de avanço da reprodução), `Game.simClient` (padrão `simClient`) e `Game.lastShotResult` (o `SimResult` da última tacada reproduzida; numa tacada com força 0, o resultado vazio).

- [ ] **Step 1: Trocar os subtestes de navegador que dependem da física legada**

Em `browser-regressions.test.js`:

```js
await t.test('a mouse drag plays the shot from the worker trajectory', async () => {
  // same drag as before; then:
  await page.waitForFunction(() => __menu.game.state === 'SHOOTING');
  await page.waitForFunction(() => __menu.game.playback !== null);
  const [x0, , z0] = await page.evaluate(() => __menu.game.ballsManager.getCueBall().mesh.position.toArray());
  await page.waitForFunction((x0, z0) => { const p = __menu.game.ballsManager.getCueBall().mesh.position; return Math.hypot(p.x - x0, p.z - z0) > 1; }, {}, x0, z0);
  await page.waitForFunction(() => __menu.game.state === 'AIM' && __menu.game.playback === null, { timeout: 25000 });
});

await t.test('a stale shot result is ignored after a reset', async () => {
  const r = await page.evaluate(async () => {
    const game = __menu.game; let release; const gate = new Promise(res => { release = res; });
    const real = game.simClient; game.simClient = { warm() {}, simulate: (...a) => gate.then(() => real.simulate(...a)) };
    game.power = 30; game.state = 'SHOOTING'; game.shoot();
    game.resetGame(); const rack = game.ballsManager.toTableState(game.tableProfileId);
    release(); await new Promise(res => setTimeout(res, 500));
    game.simClient = real;
    return { state: game.state, playback: game.playback, same: JSON.stringify(game.ballsManager.toTableState(game.tableProfileId)) === JSON.stringify(rack) };
  });
  assert.deepEqual(r, { state: 'AIM', playback: null, same: true });
});

await t.test('a failed simulation cancels the shot and the next one plays', async () => {
  const r = await page.evaluate(async () => {
    const game = __menu.game; const real = game.simClient; const before = JSON.stringify(game.ballsManager.toTableState(game.tableProfileId));
    game.simClient = { warm() {}, simulate: () => Promise.reject(new Error('boom')) };
    game.power = 30; game.state = 'SHOOTING'; game.shoot();
    await new Promise(res => setTimeout(res, 100));
    const cancelled = { state: game.state, same: JSON.stringify(game.ballsManager.toTableState(game.tableProfileId)) === before };
    game.simClient = real; game.power = 30; game.state = 'SHOOTING'; game.shoot();
    await new Promise(res => { const tick = () => (game.playback ? res() : requestAnimationFrame(tick)); tick(); });
    return cancelled;
  });
  assert.deepEqual(r, { state: 'AIM', same: true });
  await page.waitForFunction(() => __menu.game.state === 'AIM' && __menu.game.playback === null, { timeout: 25000 });
});

await t.test('a zero-power shot resolves without moving any ball', async () => {
  const r = await page.evaluate(async () => {
    const game = __menu.game; const real = game.simClient; let calls = 0;
    game.simClient = { warm() {}, simulate: (...a) => { calls++; return real.simulate(...a); } };
    const before = JSON.stringify(game.ballsManager.toTableState(game.tableProfileId)); const turns = game.statsTracker.totalTurns;
    game.power = 0; game.state = 'SHOOTING'; game.shoot();
    await new Promise(res => setTimeout(res, 300));
    game.simClient = real;
    return { calls, same: JSON.stringify(game.ballsManager.toTableState(game.tableProfileId)) === before, turns: game.statsTracker.totalTurns - turns, playback: game.playback };
  });
  assert.deepEqual(r, { calls: 0, same: true, turns: 1, playback: null });
});

await t.test('pausing during playback freezes the shot and resuming continues it', async () => {
  const r = await page.evaluate(async () => {
    const game = __menu.game; const wait = ms => new Promise(res => setTimeout(res, ms));
    game.power = 80; game.state = 'SHOOTING'; game.shoot();
    await new Promise(res => { const tick = () => (game.playback ? res() : requestAnimationFrame(tick)); tick(); });
    game._togglePause(); const t0 = game.playback.player.time; await wait(300);
    const frozen = game.playback.player.time === t0;
    game._togglePause(); await wait(300);
    return { frozen, resumed: game.playback === null || game.playback.player.time > t0 };
  });
  assert.deepEqual(r, { frozen: true, resumed: true });
  await page.waitForFunction(() => __menu.game.state === 'AIM' && __menu.game.playback === null, { timeout: 25000 });
});
```

O subteste `instant replay freezes physics…` passa a medir `game.playback === null && cue.mesh.position` antes e depois, em vez de `__menu.physics.world.time`. O subteste `respotting restores the ball…` vira `respotting puts the ball back on the table`: `ball.remove()`, `_respotBall(8)`, e então `!ball.pocketed && ball.mesh.visible`. No subteste LAN (linha 503), zerar as velocidades dos corpos deixa de ser necessário: tire a linha.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm run test:browser -w apps/client`
Expected: FAIL nos subtestes novos (`playback` é `undefined`; `toTableState is not a function`).

- [ ] **Step 3: Implementar `toTableState`/`applyTableState`, `Ball.speed` e `ShotPlayback`**

- [ ] **Step 4: Ligar o `Game` à reprodução**

- **`shoot()`, caminho local.** `cueBall.applyImpulse(...)` vira `this._simulateShot(force)`:
  - guarda `table = toTableState(...)` e um `token = ++this._shotToken`;
  - com `force <= 0`, usa na hora o resultado vazio `{ frames: [], events: [], final: table, steps: 0, simSeconds: 0, capped: false }`, sem chamar o worker;
  - senão, `this.simClient.simulate(table, shot)`. O resultado só vale se `token === this._shotToken` e `this.state === 'SHOOTING'`;
  - um resultado válido (ou o vazio) vira `this.lastShotResult = result` e `this.playback = new ShotPlayback(this.ballsManager, new TrajectoryPlayer({ initial: table, ...result }))`;
  - numa rejeição válida, aplica `applyTableState(table)`, chama `_enterAimState()`, mostra `UIText.shotSimulationFailed` e faz `console.warn`, nunca `console.error`.
- **`update()`.** As linhas 1213–1286 de hoje saem: `updatePhysicsGuards`, `sync`, o limite de 20 s pelo relógio, `checkPockets` e `allStopped`. No lugar:
  - `const { events, done } = this.playback.update(dt * this.playbackRate)`;
  - cada evento passa por `this._onSimEvent(e)`;
  - no `done`, `this.playback = null` e `this.resolveTurn(this.turnPocketedIds)`.
- **`_onSimEvent(e)`** despacha para:
  - `_onFirstContact(ballId)`: `rules.recordFirstHit` e a medida de carreira da primeira bola;
  - `_onBallBallEvent(a, b, speed)`: o corpo do listener de colisão legado, com `relVel` → `speed`;
  - `_onCushionEvent(ballId, speed)`: idem, com `v` → `speed` e sem `applyCushionSpin`, que agora é do sim;
  - `_onPocketEvent(ballId, pocketIndex)`: o bloco `newlyPocketed` de hoje, mais `ball.remove()`.
- **Remoções.** `setupCollisionEvents`, `_wireBallsManagerEvents`, `_handleManualBallContact` e os `_ballCollideListeners` saem. As colisões varridas das guardas já geram `ball_ball` no sim.
- **Mesh como fonte da posição.** `getCueBallPlacementReason` (linha 808), `_respotBall` (1657) e `GameStateSerializer` (serializa e aplica `mesh.position` e `mesh.quaternion`; o snapshot perde as velocidades) passam a ler o mesh.
- **Tacadas abandonadas.** `resetGame`, `_resetTrainerDrill` e `dispose` incrementam `_shotToken` e zeram `playback`. `init` chama `this.simClient.warm()`.
- **MenuSystem.** Os 4 laços chamam só `this.game.update(dt)`.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm run test:browser -w apps/client && npm run test:smoke -w apps/client`
Expected: PASS, incluindo o subteste LAN (tacada do convidado executada pelo host) e a lista de erros vazia; smoke 54/54.

- [ ] **Step 6: Rodar as suítes Node do cliente**

Run: `npm test -w apps/client`
Expected: PASS em todas.

- [ ] **Step 7: Commit**

```bash
git add apps/client
git commit -m "feat(client): play shots from the worker trajectory instead of the live physics"
```

---

### Task 5: Remoção da física legada do cliente

**Files:**
- Delete: `apps/client/src/core/PhysicsWorld.js`
- Modify:
  - `apps/client/src/game/Ball.js`: sem `cannon-es`. Saem `body`, `shape`, `setPhysicsMaterial`, `applyImpulse`, `limitSpeed`, `limitAngularSpeed`, `applyLowSpeedBrake`, `applySpinPhysics`, `sync` e `isSleeping`.
  - `apps/client/src/game/BallsManager.js`: `constructor(tableProfile)`. Saem as guardas, as colisões varridas, `applyCushionSpin`, `allStopped` e `checkPockets`.
  - `apps/client/src/game/Table.js`: `constructor(tableProfile)`; saem os corpos `CANNON` e `addToScene` sem física.
  - `apps/client/src/game/Game.js`: `constructor(renderer, audioManager)`; sem `this.physics`.
  - `apps/client/src/menu/MenuSystem.js`: sem `PhysicsWorld`; as tabelas e bolas do replay mudam de construtor.
  - `apps/client/src/replay/InstantReplayController.js`, `apps/client/src/ui/Minimap.js`: sem `body`.
  - `apps/client/package.json`: sem `cannon-es`; script `test:no-legacy-physics`.
  - `apps/client/vite.config.js`: sai o chunk `physics`.
- Test: `apps/client/test/no-legacy-physics.test.js`

**Interfaces:**
- Consumes: Tarefa 4 (nenhuma leitura de posição passa por `body`).
- Produces: `new Game(renderer, audioManager)`, `new Table(tableProfile)` e `new BallsManager(tableProfile)`.

- [ ] **Step 1: Escrever o teste que falha**

```js
// apps/client/test/no-legacy-physics.test.js — F1-B: the client has no physics of its own
test('src não importa cannon-es nem usa corpos físicos', () => {
  for (const file of jsFilesUnder('src')) {
    const code = readFileSync(file, 'utf8');
    assert.doesNotMatch(code, /from ['"]cannon-es['"]/, file);
    assert.doesNotMatch(code, /\.body\.(position|velocity|angularVelocity|quaternion)\b|\bPhysicsWorld\b|applyImpulse\(/, file);
  }
  assert.equal(existsSync('src/core/PhysicsWorld.js'), false);
});

test('package.json do cliente não depende de cannon-es', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.dependencies['cannon-es'], undefined);
});
```

`jsFilesUnder` é o mesmo helper local da Tarefa 1. Os caminhos são relativos a `apps/client`, de onde o `npm -w` roda o script.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm run test:no-legacy-physics -w apps/client`
Expected: FAIL, listando `src/core/PhysicsWorld.js` e `src/game/Ball.js`.

- [ ] **Step 3: Remover a física**

Corte os pontos listados em Files. Então rode `grep -rn "physics" apps/client/src` e revise cada ocorrência que sobrar. Textos da interface, como a descrição em `SettingsScreen.js`, continuam; parâmetros e campos `physics` saem.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm install && npm test -w apps/client && npm test -w packages/sim && npm run build`
Expected: PASS em tudo. O sim continua em 60/60, porque usa a cópia da Tarefa 1. O build gera `dist/assets/sim.worker-*.js` e nenhum chunk `physics-*.js`.

- [ ] **Step 5: Commit**

```bash
git add apps/client package-lock.json
git checkout -- apps/client/dist   # the build rewrites tracked dist files
git commit -m "refactor(client): remove the legacy physics now that shots come from packages/sim"
```

---

### Task 6: Tacadas de referência no navegador (F1-09)

**Files:**
- Create: `apps/client/src/dev/referenceShots.js`, `docs/f1/roteiro-teste-manual.md`
- Modify: `apps/client/src/main.js` (gancho só em `import.meta.env.DEV`), `packages/sim/package.json` (`"exports": { ".": "./src/index.js", "./corpus": "./test/corpus.js" }`)
- Test: `apps/client/test/browser-regressions.test.js`

**Interfaces:**
- Consumes: `CORPUS` de `@billiards/sim/corpus`; `Game.shoot`, `Game.playback` (Tarefa 4); `Ball.reset` e `Ball.remove`.
- Produces: `playReferenceShot(game, name): Promise<SimResult>`. A função monta a mesa da tacada do corpus: as bolas listadas vão para `reset(x, BALL.radius, z)`, e as outras saem com `remove()`. Depois ela define `aimDirection = (cos angle, 0, sin angle)`, `cueTipOffset = spin` e `power`, passa o estado a `SHOOTING` e chama `shoot()`. Ela espera, por `requestAnimationFrame`, `game.playback` aparecer e voltar a `null`, e resolve com `game.lastShotResult`. Em desenvolvimento, `window.__referenceShot(name)` chama `playReferenceShot(__menu.game, name)`.

- [ ] **Step 1: Escrever o subteste que falha**

```js
await t.test('draw-ref in the game: the cue ball comes back after the contact', async () => {
  await menu();
  await page.evaluate(() => __menu._startGame('freeplay'));
  await page.waitForFunction(() => __menu.game?.state === 'AIM');
  const r = await page.evaluate(async () => {
    const res = await window.__referenceShot('draw-ref');
    const cueZ = res.frames.flatMap(f => f.balls.filter(b => b.id === 0).map(b => b.z));
    return { contact: res.events.some(e => e.type === 'first_contact'), draw: Math.max(...cueZ) - res.final.balls[0].z,
      exact: __menu.game.ballsManager.getCueBall().mesh.position.z === res.final.balls[0].z };
  });
  assert.equal(r.contact, true); assert.ok(r.draw >= 10, `recuo de ${r.draw.toFixed(1)} cm`); assert.equal(r.exact, true);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm run test:browser -w apps/client`
Expected: FAIL: `window.__referenceShot is not a function`.

- [ ] **Step 3: Implementar `referenceShots.js`, o gancho em `main.js` e a exportação `./corpus`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test:browser -w apps/client && npm run build && grep -l "__referenceShot" apps/client/dist/assets/*.js; echo "exit=$?"`
Expected: PASS. O recuo medido fica perto dos 61 cm da D041. O `grep` não lista nenhum arquivo e imprime `exit=1`: o gancho não entra no build de produção.

- [ ] **Step 5: Escrever o roteiro de teste manual**

`docs/f1/roteiro-teste-manual.md`, em PT-BR:
1. Como subir o jogo (`npm run dev`).
2. Como abrir o Treino livre e chamar no console `__referenceShot('draw-ref')`, depois `'long-stun'`, `'pot-corner'` e `'pot-side'`. As três últimas mudaram de sensação na D041.
3. O que observar em cada tacada: a branca volta depois do contato, o percurso e onde a branca para.
4. Uma partida livre contra a IA.
5. Onde registrar a resposta: `progress.md`, e o F1-09 só depois da confirmação.

- [ ] **Step 6: Commit**

```bash
git add apps/client packages/sim/package.json docs/f1/roteiro-teste-manual.md
git checkout -- apps/client/dist
git commit -m "feat(client): reference shots in the dev build for the draw check (F1-09)"
```

---

### Task 7: Partida de 8-ball contra a IA até o fim (F1-07)

**Files:**
- Create: `apps/client/test/full-match.test.js`
- Modify: `apps/client/package.json` (script `test:full-match`; entrada no `test`, antes de `test:smoke`)

**Interfaces:**
- Consumes: `MenuSystem._startGame('vsai')`; `Game.playbackRate`, `Game.ballInHand`, `Game.isCueBallPlacementLegal`, `Game._endBallInHand`, `Game.onMouseUp` e `Game.rules.gameOver`; `AIPlayer` (`/src/ai/AIPlayer.js`).

- [ ] **Step 1: Escrever o teste**

O teste sobe o Vite e o Puppeteer como `browser-regressions.test.js`, com `reducedMotion: true` e `autoInstantReplay: false`. Ele junta `pageerror` e `console.error`.

```js
test('8-ball contra a IA vai até o fim sem erros no console', { timeout: 600000 }, async () => {
  // … server, browser, page, errors as in browser-regressions.test.js
  await page.evaluate(() => __menu._startGame('vsai'));
  await page.waitForFunction(() => __menu.game?.state === 'AIM');
  await page.evaluate(() => { const g = __menu.game; g.playbackRate = 8; g.aiPlayer.settings.thinkTimeMin = g.aiPlayer.settings.thinkTimeMax = 0; });
  let shots = 0;
  while (!(await page.evaluate(() => __menu.game.rules.gameOver)) && shots < 200) {
    await page.waitForFunction(() => { const g = __menu.game; return g.rules.gameOver || (g.state === 'AIM' && g.currentPlayer === 1); }, { timeout: 60000 });
    if (await page.evaluate(() => __menu.game.rules.gameOver)) break;
    await page.evaluate(playHumanTurn);   // see below
    shots++;
  }
  assert.equal(await page.evaluate(() => __menu.game.rules.gameOver), true, `sem fim depois de ${shots} tacadas do jogador`);
  assert.deepEqual(errors, []);
});
```

`playHumanTurn` roda na página:
1. Com `ballInHand`, põe a branca na primeira posição legal, com a mesma grade de candidatos que `resolveTurn` usa para a IA (Game.js:2032–2050): `cue.reset(x, BALL.radius, z)` e `_endBallInHand()`.
2. Pede a jogada a um `new AIPlayer('hard')` com `thinkTime` 0 (`await ai.takeTurn(game)`).
3. Aplica `aimDirection`, `cueTipOffset` e `power`, passa o estado a `CHARGING` e chama `game.onMouseUp({ type: 'pointerup' })`. É o mesmo caminho de quando o jogador solta o mouse.

- [ ] **Step 2: Rodar**

Run: `npm run test:full-match -w apps/client`
Expected: PASS (`gameOver` verdadeiro, lista de erros vazia). Se falhar, a causa vai para `superpowers:systematic-debugging`; nunca afrouxe a asserção nem aumente o limite de 200 tacadas sem registrar uma decisão.

- [ ] **Step 3: Commit**

```bash
git add apps/client
git commit -m "test(client): play a full 8-ball match against the AI in the browser (F1-07)"
```

---

### Task 8: Fechamento da F1-B

**Files:**
- Modify: `apps/client/test/dist-smoke.test.js` (subteste de tacada no build)
- Modify: `harness/feature_list.json`, `harness/progress.md`, `docs/superpowers/plans/2026-10-24-roteiro.md`, `CLAUDE.md` (frase "O código em `apps/client/src/` ainda é o jogo original" e a tabela de comandos, com as suítes novas)

- [ ] **Step 1: Tacada no build de produção**

Em `dist-smoke.test.js`, depois de `project URL boots…`, acrescente `a free-play shot simulates in the bundled worker`:
- inicia `freeplay`;
- `power = 40`, estado `SHOOTING` e `shoot()`;
- espera `playback !== null` e depois `state === 'AIM'`;
- confirma que a lista `errors` (404 de scripts incluídos) continua vazia.

Run: `npm run build && npm run test:dist -w apps/client`
Expected: PASS.

- [ ] **Step 2: Rodar a suíte completa**

Run: `npm test && npm run typecheck && bash harness/init.sh`
Expected:
- `npm test` passa em todas as suítes de todos os workspaces, incluindo browser, smoke e full-match;
- o `tsc` sai limpo;
- `init.sh` mostra as suítes rápidas passando.

- [ ] **Step 3: Marcar o F1-07 e atualizar o harness**

- **F1-07:** marque `passes: true`, porque o critério é o teste da Tarefa 7.
- **F1-09:** continua `false` até o usuário confirmar no navegador, seguindo `docs/f1/roteiro-teste-manual.md`. Peça a confirmação no fim da interação.
- **Roteiro:** a linha da F1-B passa a apontar para este plano.
- **`progress.md`:** "Estado atual", "Próximo passo" (confirmação do F1-09; depois, o plano da F2) e o registro da sessão.

- [ ] **Step 4: Commit e push**

```bash
git add apps/client/test harness docs CLAUDE.md
git checkout -- apps/client/dist
git commit -m "docs(f1b): close phase F1-B and update roadmap and harness"
git push -u origin claude/planejamento-online
```
