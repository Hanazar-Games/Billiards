# F0 — Spike do runtime da simulação: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medir quanto custa simular uma tacada com a física atual sem gráficos, no Node (V8) e no runtime JS do Nakama (goja), e confirmar ou refutar a dependência de FPS, para decidir a opção de implantação da seção 5.5 da spec (decisão D017).

**Architecture:** Código descartável em `spikes/sim-bench/`, que importa os módulos reais de `src/`, sem modificá-los, com stubs mínimos de DOM. Um único bundle IIFE (esbuild) roda idêntico no Node e no goja. O goja é exercitado de preferência dentro do Nakama real (Docker); se o daemon do Docker não subir, um programa em Go com a mesma versão do goja usada pelo Nakama.

**Tech Stack:** Node ≥ 22.12, `three` 0.170 e `cannon-es` 0.20 (já no projeto), esbuild (versão fixada no `package.json` do spike), Docker com `heroiclabs/nakama` + `postgres:16-alpine`, ou Go 1.24 + goja.

**Spec:** [`docs/superpowers/specs/2026-10-24-billiards-online-design.md`](../specs/2026-10-24-billiards-online-design.md) — seções 4 (itens 1, 2), 5.5, 6 e 10 (F0).

## Global Constraints

- Não alterar nada em `src/`, `server/`, `test/` nem no `package.json` da raiz. O spike só **lê** o código existente.
- Todo o código do spike fica em `spikes/sim-bench/`, com `package.json` próprio (fora dos workspaces), e é descartável.
- Unidades em centímetros (`SCALE = 100`); passo fixo de `1/360` s (`PHYSICS.fixedTimeStep`); limite de **20 s de tempo simulado** por tacada.
- Tacada aplicada exatamente como em `Game.shoot()`: `cueBall.applyImpulse(dir.x * force, 0, dir.z * force, spinX, spinY)`, com `force ≤ SHOT.maxPower` (110).
- Mesa `pool9ft`, arrumação `8ball`. Construção na ordem de `Game.js:208-227`: `new Table(physics, profile)` → `table.addToScene(scene)` → `new BallsManager(physics, profile)` → `rackBalls('8ball')` → `addToScene(scene)`.
- O efeito de tabela precisa ser replicado: para cada bola, um listener `collide` que chama `balls.applyCushionSpin(ball)` quando `e.body.material === physics.cushionMaterial` (como em `Game.setupCollisionEvents`, `Game.js:408-475`).
- `Math.random` é substituído por um PRNG com semente (mulberry32), porque `Ball.setPosition` sorteia a orientação inicial das bolas.
- Tempo de parede medido com um relógio injetado: `performance.now` no Node, `Date.now` no goja. As 3 primeiras execuções de cada tacada são aquecimento e não entram nas estatísticas.

**Critérios de decisão (definidos antes de medir):**

| Pergunta | Critério |
|----------|----------|
| A física pode rodar dentro do Nakama? | Sim, se o bundle roda no goja sem alterações no código de `src/` **e** a p95 da abertura ≤ 250 ms **e** a mediana das demais tacadas ≤ 100 ms. Caso contrário, mantém-se `services/sim` (padrão). |
| O Node precisa de otimização na F1? | Sim, se a p95 da abertura no Node passar de 100 ms. Nesse caso, entra uma tarefa de otimização no plano da F1 (por exemplo, iterações do solver). |
| A dependência de FPS é real? | Sim, se o modelo legado a 60 e a 144 FPS diferir no conjunto de bolas encaçapadas **ou** em alguma posição final por mais de 0,5 cm. |

## Review Focus

1. **Mundo montado pela metade:** sem os corpos das tabelas, as bolas atravessam a mesa e a tacada "termina" rápido demais. Esperado: depois da abertura, toda bola não encaçapada continua dentro dos limites da mesa, com `y ≈ BALL.radius`. Coberto na Tarefa 1.
2. **Tacada que nunca termina:** bolas rolando para sempre. Esperado: a simulação para em 20 s simulados e marca `capped: true`. Coberto na Tarefa 2.
3. **Aleatoriedade sem semente:** com `Math.random` livre, o hash final varia entre execuções. Esperado: mesma semente e mesma tacada dão o mesmo hash. Coberto na Tarefa 2.
4. **Globais ausentes no goja** (`console`, `performance`, `document`): o bundle quebra ao carregar. Esperado: o shim do bundle fornece cada global usado, e o relatório lista os que foram necessários. Coberto nas Tarefas 3 e 4.
5. **Aquecimento contado como custo:** a primeira execução inclui JIT e criação de objetos. Esperado: as 3 primeiras execuções ficam fora das estatísticas, e o relatório traz mediana e p95 de pelo menos 20 execuções medidas. Coberto na Tarefa 3.

---

### Task 1: Montar o mundo físico sem gráficos no Node

**Files:**
- Create: `spikes/sim-bench/package.json` (`"private": true`, `"type": "module"`, `devDependencies: { "esbuild": "<versão exata atual>" }`, script `"test": "node --test test/"`)
- Create: `spikes/sim-bench/src/env.js`
- Create: `spikes/sim-bench/src/world.js`
- Test: `spikes/sim-bench/test/world.test.mjs`

**Interfaces:**
- Produces: `installEnv({ seed: number }): void`, que instala `globalThis.document` (só `createElement('canvas')`, devolvendo `{ width, height, getContext() }`, em que `getContext` retorna um `Proxy` cujos métodos não fazem nada), `globalThis.localStorage` em memória e `Math.random = mulberry32(seed)`.
- Produces: `createWorld({ tableProfileId = 'pool9ft', mode = '8ball' }): { physics, table, balls, pockets, scene }`, em que `pockets = table.getPocketPositions()`, com o listener `collide` de efeito de tabela já instalado.

- [ ] **Step 1: Escrever o teste que falha**

```js
// spikes/sim-bench/test/world.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installEnv } from '../src/env.js';
installEnv({ seed: 1 });
const { createWorld } = await import('../src/world.js');
const { BALL } = await import('../../../src/config.js');

test('mundo 8-ball pool9ft tem 16 bolas, 6 caçapas e corpos de tabela', () => {
  const w = createWorld({});
  assert.equal(w.balls.balls.length, 16);
  assert.equal(w.pockets.length, 6);
  assert.ok(w.table.bodies.length > 0);
  assert.ok(w.physics.world.bodies.length >= 16 + w.table.bodies.length);
  for (const b of w.balls.balls) assert.ok(Math.abs(b.body.position.y - BALL.radius) < 0.01);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `cd spikes/sim-bench && npm install && npm test`
Expected: FAIL com `Cannot find module '../src/world.js'`.

- [ ] **Step 3: Implementar `installEnv` em `src/env.js` e `createWorld` em `src/world.js`**

`world.js` importa os módulos reais por caminho relativo (`../../../src/core/PhysicsWorld.js`, `../../../src/game/Table.js`, `../../../src/game/BallsManager.js`, `../../../src/game/TableProfiles.js`) e usa `new THREE.Scene()` como cena. Se o grafo de imports exigir mais algum global de DOM, acrescente-o em `env.js` e anote numa lista `SHIMS_USED`, que será exportada para o relatório.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd spikes/sim-bench && npm test`
Expected: PASS (1 teste).

- [ ] **Step 5: Commit**

```bash
git add spikes/sim-bench/package.json spikes/sim-bench/package-lock.json spikes/sim-bench/src spikes/sim-bench/test
git commit -m "spike(f0): build headless physics world from existing modules"
```

### Task 2: Executor de tacadas com os modelos fixo e legado

**Files:**
- Create: `spikes/sim-bench/src/run-shot.js`
- Create: `spikes/sim-bench/src/corpus.js`
- Test: `spikes/sim-bench/test/run-shot.test.mjs`

**Interfaces:**
- Consumes: `createWorld` (Tarefa 1).
- Produces: `runShot(world, shot, { model: 'fixed' | 'legacy', fps?: number, now: () => number }): ShotRun`, em que
  `shot = { aim: { x, z } | { atBall: number }, force: number, spin: { x, y } }` e
  `ShotRun = { steps: number, simSeconds: number, wallMs: number, capped: boolean, pocketed: number[], final: { id, x, z, pocketed }[], hash: string }`.
- Produces: `CORPUS: { name: string, shot }[]`, com 5 tacadas, todas partindo da arrumação inicial:

| `name` | Mira | `force` | `spin` |
|--------|------|---------|--------|
| `break` | `atBall` = bola não-branca mais próxima da branca | 110 | `{0, 0}` |
| `medium` | idem | 50 | `{0, 0}` |
| `draw` | idem | 60 | `{0, -0.8}` |
| `english` | idem | 60 | `{0.8, 0}` |
| `soft` | idem | 15 | `{0, 0}` |

- [ ] **Step 1: Escrever os testes que falham**

```js
// spikes/sim-bench/test/run-shot.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installEnv } from '../src/env.js';
installEnv({ seed: 7 });
const { createWorld } = await import('../src/world.js');
const { runShot } = await import('../src/run-shot.js');
const { CORPUS } = await import('../src/corpus.js');
const now = () => performance.now();
const brk = CORPUS.find(c => c.name === 'break').shot;

test('modelo fixo é determinístico com a mesma semente', () => {
  installEnv({ seed: 7 }); const a = runShot(createWorld({}), brk, { model: 'fixed', now });
  installEnv({ seed: 7 }); const b = runShot(createWorld({}), brk, { model: 'fixed', now });
  assert.equal(a.hash, b.hash);
});

test('abertura termina antes do limite e mantém bolas na mesa', () => {
  const w = createWorld({});
  const r = runShot(w, brk, { model: 'fixed', now });
  assert.equal(r.capped, false);
  assert.ok(r.simSeconds > 0.5 && r.simSeconds < 20);
  const { width, depth } = w.table.profile; // TABLE_PROFILES.pool9ft: width 127, depth 254 (cm)
  for (const f of r.final.filter(f => !f.pocketed)) {
    assert.ok(Math.abs(f.x) <= width / 2 && Math.abs(f.z) <= depth / 2);
  }
});

test('modelo legado roda a 60 e 144 fps', () => {
  for (const fps of [60, 144]) {
    const r = runShot(createWorld({}), brk, { model: 'legacy', fps, now });
    assert.ok(r.steps > 0 && r.simSeconds <= 20);
  }
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `cd spikes/sim-bench && npm test`
Expected: FAIL com `Cannot find module '../src/run-shot.js'`.

- [ ] **Step 3: Implementar `runShot` e `CORPUS`**

Laço de cada modelo (o mesmo `allStopped()` + `checkPockets(pockets)` ao fim de cada iteração; limite de 20 s simulados):

```
fixed : physics.world.step(1/360); balls.updatePhysicsGuards(1/360, pockets); t += 1/360
legacy: dt = 1/fps; physics.step(dt); balls.updatePhysicsGuards(dt, pockets); t += dt
```

A ordem do legado (física, depois guardas) reproduz `MenuSystem.js:546-547` + `Game.update`. O `hash` é FNV-1a de 32 bits sobre os bytes `Float64` de `x` e `z` de cada bola, mais um byte de `pocketed`, em ordem de `id`, codificado em hexadecimal.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd spikes/sim-bench && npm test`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add spikes/sim-bench/src spikes/sim-bench/test
git commit -m "spike(f0): add shot runner with fixed and legacy stepping"
```

### Task 3: Bundle único e medição no Node

**Files:**
- Create: `spikes/sim-bench/src/bench.js`
- Create: `spikes/sim-bench/build.mjs`
- Create: `spikes/sim-bench/run-node.mjs`
- Test: `spikes/sim-bench/test/bundle.test.mjs`

**Interfaces:**
- Consumes: `installEnv`, `createWorld`, `runShot`, `CORPUS`.
- Produces: `bench.js` exporta `run(payload: { runs: number, warmup: number, seed: number, models: ('fixed' | 'legacy60' | 'legacy144')[] }, now: () => number): BenchReport`, em que `BenchReport = { runtime: string, shimsUsed: string[], results: { name, model, medianMs, p95Ms, steps, simSeconds, capped, hash }[] }`.
- Produces: `dist/sim-bench.iife.js` (esbuild: `format: 'iife'`, `globalName: 'SimBench'`, `platform: 'neutral'`, `target: 'es2017'`, `mainFields: ['module', 'main']`) e `dist/nakama/index.js` = o bundle seguido de:

```js
function InitModule(ctx, logger, nk, initializer) {
  initializer.registerRpc('sim_bench', rpcSimBench);
}
function rpcSimBench(ctx, logger, nk, payload) {
  return JSON.stringify(SimBench.run(JSON.parse(payload), function () { return Date.now(); }));
}
```

As duas funções ficam no escopo global, como o runtime JS do Nakama exige.

- [ ] **Step 1: Escrever o teste que falha**

```js
// spikes/sim-bench/test/bundle.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

test('bundle IIFE produz os mesmos hashes do código ESM', async () => {
  execFileSync('node', ['build.mjs'], { cwd: new URL('..', import.meta.url) });
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../dist/sim-bench.iife.js', import.meta.url), 'utf8'), ctx);
  const payload = { runs: 1, warmup: 0, seed: 7, models: ['fixed'] };
  const fromBundle = ctx.SimBench.run(payload, () => Date.now());
  const { run } = await import('../src/bench.js');
  const fromEsm = run(payload, () => performance.now());
  assert.deepEqual(fromBundle.results.map(r => r.hash), fromEsm.results.map(r => r.hash));
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `cd spikes/sim-bench && npm test`
Expected: FAIL com `Cannot find module` (`build.mjs` ou `src/bench.js` ausente).

- [ ] **Step 3: Implementar `bench.js`, `build.mjs` e `run-node.mjs`**

`bench.js` chama `installEnv` dentro de `run`, para que o bundle seja autossuficiente. Os globais que faltarem no contexto vazio do `vm` (por exemplo, `console`) recebem shims no início do bundle (`banner` do esbuild) e entram em `shimsUsed`. `run-node.mjs` carrega `dist/sim-bench.iife.js` via `vm`, executa `{ runs: 20, warmup: 3, seed: 7, models: ['fixed', 'legacy60', 'legacy144'] }` e grava `results/node.json`.

- [ ] **Step 4: Rodar e confirmar que passa; medir**

Run: `cd spikes/sim-bench && npm test && node run-node.mjs`
Expected: PASS (5 testes) e `results/node.json` com 15 linhas de resultado (5 tacadas × 3 modelos).

- [ ] **Step 5: Commit**

```bash
git add spikes/sim-bench/src spikes/sim-bench/build.mjs spikes/sim-bench/run-node.mjs spikes/sim-bench/test spikes/sim-bench/results/node.json
git commit -m "spike(f0): bundle simulation and benchmark it on Node"
```

### Task 4: Medição no goja

**Files:**
- Create: `spikes/sim-bench/nakama/docker-compose.yml` (caminho A)
- Create: `spikes/sim-bench/goja-runner/main.go` e `go.mod` (caminho B)
- Create: `spikes/sim-bench/run-goja.sh`
- Output: `spikes/sim-bench/results/goja.json`

**Interfaces:**
- Consumes: `dist/nakama/index.js` e `dist/sim-bench.iife.js` (Tarefa 3).
- Produces: `results/goja.json` no mesmo formato `BenchReport`, com `runtime` igual a `"nakama <versão>"` ou `"goja <versão do módulo>"`.

- [ ] **Step 1: Tentar o caminho A (Nakama real)**

Run: `dockerd > /tmp/dockerd.log 2>&1 & sleep 5; docker info --format '{{.ServerVersion}}'`
Expected: imprime a versão do servidor. Se der erro, siga para o Step 3.

- [ ] **Step 2: Rodar no Nakama**

O `docker-compose.yml` tem os serviços `postgres` (`postgres:16-alpine`, senha `localdb`) e `nakama` (`heroiclabs/nakama`, com a tag estável mais recente disponível, que é registrada no relatório). O Nakama monta `../dist/nakama` em `/nakama/data/modules` e usa como entrypoint `migrate up` seguido de `nakama --database.address postgres:localdb@postgres:5432/nakama --runtime.js_entrypoint index.js`.

Run: `cd spikes/sim-bench/nakama && docker compose up -d && sleep 15 && curl -s "http://127.0.0.1:7350/v2/rpc/sim_bench?http_key=defaulthttpkey&unwrap" -d '{"runs":20,"warmup":3,"seed":7,"models":["fixed"]}' > ../results/goja.json && docker compose logs nakama | tail -50`
Expected: `results/goja.json` com 5 resultados; os logs não mostram erro de carregamento do módulo. Siga para o Step 5.

- [ ] **Step 3: Caminho B — descobrir a versão do goja usada pelo Nakama**

Run: `curl -s https://raw.githubusercontent.com/heroiclabs/nakama/master/go.mod | grep -i goja`
Expected: uma linha com o caminho e a versão do módulo goja; use exatamente esse caminho e versão no `go.mod` do runner.

- [ ] **Step 4: Rodar no goja via Go**

`main.go` lê `dist/sim-bench.iife.js`, cria `goja.New()`, registra `console.log` e executa o script. Em seguida, chama `SimBench.run(payload, () => Date.now())` com o mesmo payload do Step 2 e grava o JSON em `results/goja.json`.

Run: `cd spikes/sim-bench/goja-runner && go run . ../dist/sim-bench.iife.js > ../results/goja.json`
Expected: `results/goja.json` com 5 resultados. Qualquer erro de sintaxe ou de global ausente é corrigido com shim no banner (Tarefa 3) e anotado, nunca com alteração em `src/`.

- [ ] **Step 5: Commit**

```bash
git add spikes/sim-bench/nakama spikes/sim-bench/goja-runner spikes/sim-bench/run-goja.sh spikes/sim-bench/results/goja.json
git commit -m "spike(f0): benchmark simulation on goja"
```

### Task 5: Relatório e decisão

**Files:**
- Create: `docs/spikes/2026-10-24-runtime-simulacao.md`
- Modify: `harness/decisions.json` (entrada `D017`)
- Modify: `harness/feature_list.json` (item `F0-*`)
- Modify: `harness/progress.md`

- [ ] **Step 1: Escrever o relatório**

O relatório traz:
- ambiente (CPU do contêiner, versões de Node, goja ou Nakama, esbuild);
- uma tabela por runtime com `name × model → medianMs, p95Ms, steps, simSeconds, capped`;
- a comparação `legacy60 × legacy144` (diferença máxima de posição em cm e diferença no conjunto de bolas encaçapadas);
- a comparação `fixed × legacy60` (quanto o passo fixo muda o resultado; dado de entrada para os testes de sensação da F1);
- se os hashes do Node e do goja coincidem;
- a lista `shimsUsed`;
- as limitações (por exemplo, "só o caminho B rodou: a exigência de funções globais do Nakama não foi exercitada").

- [ ] **Step 2: Aplicar os critérios de decisão (Global Constraints) e registrar**

Atualize `D017` em `harness/decisions.json`: `status` passa de `"pending-spike"` para `"accepted"`; `decision` recebe o resultado; `evidence` aponta para o relatório. Se o Node passar de 100 ms na abertura, acrescente `D0xx` com "otimizar a simulação na F1". Marque o item da F0 em `feature_list.json` como `"passes": true` só se o relatório existir e os critérios tiverem sido aplicados.

- [ ] **Step 3: Verificar**

Run: `node -e "const d=require('./harness/decisions.json'); const x=d.find(e=>e.id==='D017'); if(x.status!=='accepted') process.exit(1); console.log(x.decision)"`
Expected: imprime a decisão e sai com código 0.

- [ ] **Step 4: Commit**

```bash
git add docs/spikes harness
git commit -m "docs(f0): record simulation runtime spike results and decision"
```
