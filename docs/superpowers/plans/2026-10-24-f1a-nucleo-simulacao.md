# F1-A — Núcleo da simulação: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o repositório em monorepo e criar `packages/sim`, uma física sem gráficos, determinística e com ritmo fixo, que reproduz o legado bit a bit antes de qualquer ajuste. Ela emite eventos e trajetória, codificada por `packages/protocol`. Depois vêm a calibragem do recuo e a otimização, sem perder a sensação de jogo.

**Architecture:** A física é extraída por **porte fiel**, com um teste de paridade bit a bit contra o código legado rodado no mesmo ritmo. Os parâmetros ficam num objeto `tuning` injetável: `TUNING_LEGACY` mantém a paridade; `TUNING` é o padrão calibrado. A sensação é medida contra um arquivo de referência gerado uma vez a partir do legado. O cliente continua usando a física antiga; a troca é a F1-B.

**Tech Stack:** npm workspaces; Node ≥ 22.12 (o Node 22.22 do contêiner executa `.ts` direto); `cannon-es` 0.20.0; TypeScript 5.9.x só para checagem de tipos (`tsc --noEmit`); `node:test`.

**Spec:** [`docs/superpowers/specs/2026-10-24-billiards-online-design.md`](../specs/2026-10-24-billiards-online-design.md) — §5.1–5.2, §6, §6.1, §9.3, §10 (F1). Relatório da F0: [`docs/spikes/2026-10-24-runtime-simulacao.md`](../../spikes/2026-10-24-runtime-simulacao.md).

## Decisões que este plano propõe

Registradas em `harness/decisions.json` com `status: "open"`. A Tarefa 1 as marca como `accepted` quando o plano for aprovado.

| Id | Decisão | Por quê (medido no planejamento) |
|----|---------|----------------------------------|
| **D036** | Física customizada a cada **6 passos** (60 Hz de tempo simulado, `dt = 1/60`), cannon-es a cada 1/360 s. Substitui o "a cada passo" da D010. | A cada passo, a tacada longa andou 652 cm contra 575–584 cm no legado, e a branca caiu na caçapa numa tacada com efeito. A 60 Hz fixo: 574 cm, e o recuo ficou idêntico ao legado a 60 FPS. |
| **D035** | Tolerância de sensação = envelope do legado a 30/60/120/144 FPS (relógio congelado), alargado por max(1 cm, 2% do valor a 60 FPS); contagens ±1. | Só o par 60×144 deixou uma tacada reta 0,1 cm fora, mesmo reproduzindo o legado fielmente. |
| **D037** | Critério F1-04: cada tacada do corpus ≤ 48 KB codificada (antes: "típica ≤ 30 KB"). | A abertura mediu 35,4 KB a 60 Hz. |

## Global Constraints

- Node ≥ 22.12. Nenhum passo de build para rodar JS ou TS: testes com `node --test`, TS com importações `.ts` explícitas.
- `packages/sim/src` não importa `three` nem usa `document`, `window`, `localStorage`, `performance` ou `Math.random`. JavaScript com `// @ts-check` em todos os arquivos de `src/`.
- `packages/protocol` é TypeScript com sintaxe apagável (`erasableSyntaxOnly`): sem `enum`, `namespace` nem propriedades de parâmetro.
- Unidades em centímetros; passo de 1/360 s; guardas a cada 6 passos com `dt = 1/60`; amostras da trajetória a cada 12 passos (30 Hz); limite de 7200 passos (20 s). **Contadores inteiros de passo**: o tempo é sempre `passo / 360`, nunca acumulado em ponto flutuante.
- Tacada: direção `(cos angle, sin angle)` no plano XZ; `power` limitado a `SHOT.maxPower` (110); `spin` normalizado quando o comprimento passa de 1 (como `ShotInput.js`).
- Constantes de física copiadas **literalmente** de `apps/client/src/config.js` e `apps/client/src/game/TableProfiles.js`, incluindo o helper `cm()`.
- Durante a F1-A, `apps/client/src` muda apenas pela mudança de lugar (Tarefa 1). A física do cliente continua a legada.
- Commits em inglês (conventional commits); documentos em PT-BR. Commit e push na branch de trabalho ao fim de cada interação (D028).

## Review Focus

1. **Perfil de mesa desconhecido.** O legado cai silenciosamente na `pool9ft`; no servidor, isso simularia outra mesa. Esperado: `getTableProfile('xyz')` lança `Error`. Teste na Tarefa 2.
2. **Mutação do estado de entrada.** O servidor guarda o estado oficial e pode repetir uma simulação. Esperado: `simulateShot` não altera o objeto recebido. Teste na Tarefa 3.
3. **Números inválidos na tacada** (`NaN`, `Infinity`, `power ≤ 0`). Esperado: `RangeError`, nunca posições `NaN` na saída. Teste na Tarefa 3.
4. **Bolas já encaçapadas no estado de entrada.** Esperado: não entram no mundo físico e continuam `pocketed: true` na saída. Teste na Tarefa 3.
5. **Valores fora da faixa do codec** (posição > 327,67 cm, mais de 255 bolas num quadro, mais de 65535 quadros). Esperado: `RangeError`, nunca estouro silencioso. Teste na Tarefa 6.

## Estrutura de arquivos

```
package.json                 raiz: workspaces, scripts que delegam, typescript
tsconfig.json                checagem de tipos de packages/protocol e packages/sim/src
apps/client/                 tudo o que hoje está na raiz do jogo (src, test, index.html, …)
packages/sim/
  src/constants.js           BALL, PHYSICS, SHOT, TABLE_PROFILES, getTableProfile, TUNING_LEGACY, TUNING
  src/math.js                quaternionFromBasis e vetores 3D mínimos
  src/table.js               getPocketPositions, createTableBodies
  src/world.js               createWorld (mundo cannon + materiais + corpos da mesa)
  src/ball.js                createBall e física por bola (impulso, limites, freio, spin)
  src/guards.js              createGuards (colisões varridas, sobreposição, limites, caçapas, parada)
  src/events.js              createEventLog (eventos da tacada)
  src/frames.js              createFrameSampler (trajetória a 30 Hz)
  src/simulate.js            simulateShot
  src/types.js               typedefs JSDoc
  src/index.js               API pública
  test/legacy/env.js         stubs de DOM (copiados do spike) — só testes
  test/legacy/legacy-world.js, legacy-run.js   física legada sem gráficos — só testes
  test/util/hash.js          hashFinal (FNV-1a)
  test/corpus.js             13 tacadas de referência
  test/golden.json, test/feel/legacy-reference.json, test/feel/metrics.js
  tools/update-golden.mjs, tools/legacy-reference.mjs
  bench/break.mjs            comparação de desempenho com o spike (D034)
packages/protocol/
  src/trajectory.ts, src/index.ts, test/trajectory.test.ts
```

---

### Task 1: Monorepo, com o cliente em `apps/client`

**Files:**
- Move (`git mv`): `src/`, `test/`, `scripts/`, `server/`, `dist/`, `index.html`, `vite.config.js` → `apps/client/`
- Create: `apps/client/package.json` (o `package.json` atual da raiz com `"name": "@billiards/client"`; mesmos scripts e dependências)
- Rewrite: `package.json` (raiz), `package-lock.json` (via `npm install`)
- Create: `tsconfig.json`
- Modify: `.github/workflows/deploy.yml` (`path: ./dist` → `./apps/client/dist`), `harness/init.sh`, `CLAUDE.md` (tabela de comandos), `README.md` (comandos), `spikes/sim-bench/src/*.js`, `spikes/sim-bench/compare-models.mjs` (`../../../src/` → `../../../apps/client/src/`)
- Modify: `harness/decisions.json` (D035, D036, D037 → `accepted`; D010 continua `accepted` e recebe `"note": "o ritmo da física customizada foi substituído pela D036; o resto da D010 vale"`), `harness/feature_list.json` (critério F1-04 conforme D037)

**Interfaces:**
- Produces, `package.json` da raiz:
  - `"name": "billiards-online"`, `"private": true`, `"type": "module"`;
  - `"workspaces": ["apps/*", "packages/*"]`;
  - scripts:
    - `"dev"`, `"build"`, `"build:pages"`, `"test:pages"` → `npm run <script> -w apps/client`;
    - `"test"` → `npm test --workspaces --if-present`;
    - `"typecheck"` → `tsc -p tsconfig.json`;
  - `devDependencies: { "typescript": "<5.9.x exato, de npm view typescript@5.9 version>" }`.
- Produces, `tsconfig.json`:
  - `compilerOptions`: `target: "es2022"`, `module: "nodenext"`, `moduleResolution: "nodenext"`, `strict: true`, `noEmit: true`, `allowImportingTsExtensions: true`, `erasableSyntaxOnly: true`, `verbatimModuleSyntax: true`, `allowJs: true`, `checkJs: false`, `skipLibCheck: true`;
  - `include: ["packages/*/src"]`. Arquivos `.js` só são checados se tiverem `// @ts-check`.
- Produces: `harness/init.sh` roda as 15 suítes rápidas com `npm run -s -w apps/client "test:$suite"` e depois `npm test -w "$ws"` para cada diretório em `packages/*` que tenha `package.json`.

- [ ] **Step 1: Registrar a aprovação das decisões**

Em `harness/decisions.json`, D035, D036 e D037 passam para `"status": "accepted"` e `"source": "plano da F1-A aprovado pelo usuário"`. Em `harness/feature_list.json`, o F1-04 recebe `"verification": ["teste de ida e volta: posições dentro de 0,005 cm e rotações com erro ≤ 0,001 rad", "cada tacada do corpus codificada ocupa até 48 KB; tamanhos registrados (D037)"]`.

- [ ] **Step 2: Linha de base antes de mover**

Run: `CI=1 PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm test > /tmp/f1a-before.log 2>&1; echo exit=$?`
Expected: `exit=0`.

- [ ] **Step 3: Mover e reescrever os manifests**

Faça os `git mv` listados, crie `apps/client/package.json` e o novo `package.json` da raiz, rode `npm install`, ajuste o workflow, o `init.sh`, os caminhos do spike, o `CLAUDE.md` e o `README.md`.

- [ ] **Step 4: Verificar que nada quebrou**

Run: `CI=1 PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm test > /tmp/f1a-after.log 2>&1; echo exit=$? && npm run build && (cd spikes/sim-bench && npm test) && bash harness/init.sh | head -3`
Expected: `exit=0`; build gera `apps/client/dist/`; spike com 5 testes passando; `fast suites: 15/15 passing`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "build: move the game into apps/client and set up npm workspaces"
```

### Task 2: `packages/sim` — constantes, geometria da mesa e mundo

**Files:**
- Create: `packages/sim/package.json`:
  - `"name": "@billiards/sim"`, `"version": "0.1.0"`, `"private": true`, `"type": "module"`;
  - `"exports": { ".": "./src/index.js" }`;
  - `scripts.test` = `node --test test/*.test.js`;
  - `dependencies: { "cannon-es": "0.20.0" }`, `devDependencies: { "three": "^0.170.0" }`.
- Create: `packages/sim/src/{constants,math,table,world,index}.js`
- Create: `packages/sim/test/legacy/env.js` (cópia de `spikes/sim-bench/src/env.js`) e `packages/sim/test/legacy/legacy-world.js`
- Test: `packages/sim/test/table.test.js`

**Interfaces:**
- Produces (`constants.js`):
  - `BALL`, `PHYSICS`, `SHOT` (cópia literal dos campos de `config.js`);
  - `TABLE_PROFILES` (para `pool9ft`, `pool8ft`, `bar7ft`, `chinese8`: `id`, `width`, `depth`, `height`, `cushionHeight`, `cushionWidth`, `pocketRadius`, `cornerPocketRadius`, `sidePocketRadius`, `pocketDetectMargin`);
  - `getTableProfile(id: string): TableProfile`, que lança `Error('unknown table profile: <id>')`;
  - `TUNING_LEGACY` e `TUNING`, objetos congelados com `{ ballTableFriction: 0.15, ballTableRestitution: 0.1, ballCushionRestitution: 0.9, solverIterations: 38, solverTolerance: 0.00035, rollingResistance, rollCoupling, rollingSpinFriction, sideSpinFriction, damping, angularDamping }` (valores de `PhysicsWorld.js`/`BALL`). Nesta tarefa, `TUNING === TUNING_LEGACY` em conteúdo.
- Produces (`math.js`): `quaternionFromBasis(xAxis, yAxis, zAxis): { x, y, z, w }`, equivalente a `Matrix4.makeBasis` + `Quaternion.setFromRotationMatrix` do Three.js; e `normalize`, `cross` para `{x,y,z}`.
- Produces (`table.js`):
  - `getPocketPositions(profile): Pocket[]`, em que `Pocket = { x, y: 0, z, radius, type: 'corner' | 'side' }`, na ordem `[(-W,-D), (W,-D), (-W,0), (W,0), (-W,D), (W,D)]`, com W = largura/2 e D = profundidade/2;
  - `createTableBodies(profile, cushionMaterial): CANNON.Body[]`: 6 tabelas na ordem de `Table.createCushions`, com as chanfraduras de `_addCushionBevelPhysics`.
- Produces (`world.js`): `createWorld(profile, tuning = TUNING): SimWorld`, em que `SimWorld = { world, materials: { ball, cushion, table }, tableBodies, pockets, profile, tuning }`. Ordem dos corpos: plano da mesa, depois as tabelas (como `PhysicsWorld` + `Table.addToScene`).
- Produces (teste): `createLegacyWorld({ tableProfileId }): { physics, table, balls, pockets }`, que monta o mundo legado de `apps/client/src` com os stubs de `env.js` e o listener de efeito de tabela, como `spikes/sim-bench/src/world.js`.

- [ ] **Step 1: Escrever os testes que falham**

```js
// packages/sim/test/table.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { installEnv } from './legacy/env.js';
installEnv({ seed: 1 });
const { createLegacyWorld } = await import('./legacy/legacy-world.js');
const { createWorld, getTableProfile, getPocketPositions } = await import('../src/index.js');
const PROFILES = ['pool9ft', 'pool8ft', 'bar7ft', 'chinese8'];

test('corpos das tabelas idênticos ao Table.js em todos os perfis', () => {
  for (const id of PROFILES) {
    const legacy = createLegacyWorld({ tableProfileId: id }).table.bodies;
    const sim = createWorld(getTableProfile(id)).tableBodies;
    assert.equal(sim.length, legacy.length, id);
    sim.forEach((b, i) => {
      const l = legacy[i];
      assert.deepEqual(b.position.toArray(), l.position.toArray(), `${id} body ${i} position`);
      assert.equal(b.shapes.length, l.shapes.length);
      b.shapes.forEach((s, j) => {
        assert.deepEqual(s.halfExtents.toArray(), l.shapes[j].halfExtents.toArray());
        assert.deepEqual(b.shapeOffsets[j].toArray(), l.shapeOffsets[j].toArray());
        const q = b.shapeOrientations[j], lq = l.shapeOrientations[j];
        for (const k of ['x', 'y', 'z', 'w']) assert.ok(Math.abs(q[k] - lq[k]) < 1e-12, `${id} ${i}.${j}.${k}`);
      });
    });
  }
});

test('caçapas idênticas ao legado', () => {
  for (const id of PROFILES) {
    const legacy = createLegacyWorld({ tableProfileId: id }).pockets;
    const sim = getPocketPositions(getTableProfile(id));
    assert.deepEqual(sim.map(p => [p.x, p.z, p.radius, p.type]), legacy.map(p => [p.x, p.z, p.radius, p.type]));
  }
});

test('perfil desconhecido lança erro', () => {
  assert.throws(() => getTableProfile('xyz'), /unknown table profile: xyz/);
});

test('materiais e solver iguais ao PhysicsWorld legado', () => {
  const legacy = createLegacyWorld({ tableProfileId: 'pool9ft' }).physics.world;
  const sim = createWorld(getTableProfile('pool9ft')).world;
  const view = w => w.contactmaterials.map(c => [c.friction, c.restitution, c.contactEquationStiffness, c.contactEquationRelaxation]);
  assert.deepEqual(view(sim), view(legacy));
  assert.equal(sim.solver.iterations, legacy.solver.iterations);
  assert.equal(sim.solver.tolerance, legacy.solver.tolerance);
});

test('src não importa three nem usa APIs de navegador ou aleatoriedade', () => {
  const dir = new URL('../src/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const code = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(code, /from ['"]three['"]|\bdocument\.|\bwindow\.|localStorage|performance\.now|Date\.now|Math\.random/, f);
    assert.match(code, /^\/\/ @ts-check/, `${f} sem // @ts-check`);
  }
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/sim`
Expected: FAIL com `Cannot find module` (`legacy-world.js` ou `../src/index.js`).

- [ ] **Step 3: Implementar `constants.js`, `math.js`, `table.js`, `world.js`, `index.js` e os auxiliares de teste**

`table.js` porta só a parte `CANNON` de `Table.createCushions`, `addCushion`, `_addCushionBevelPhysics`, `_getTableGeometryMetrics` (campos usados pela física) e `createPockets`. As dimensões de cada caixa vêm direto das métricas, sem `THREE.BoxGeometry`. Os eixos da chanfradura usam `math.js` em vez de `THREE.Vector3`/`Matrix4`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/sim && npm run typecheck`
Expected: PASS (5 testes); `tsc` sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/sim package.json package-lock.json
git commit -m "feat(sim): add headless table geometry and physics world"
```

### Task 3: Bolas, guardas e `simulateShot`, com paridade bit a bit

**Files:**
- Create: `packages/sim/src/{ball,guards,simulate,types}.js`; modify: `packages/sim/src/index.js`
- Create: `packages/sim/test/legacy/legacy-run.js`, `packages/sim/test/util/hash.js`, `packages/sim/test/corpus.js`, `packages/sim/test/golden.json`, `packages/sim/tools/update-golden.mjs`; script `"golden:update": "node tools/update-golden.mjs"`
- Test: `packages/sim/test/parity.test.js`, `packages/sim/test/simulate.test.js`, `packages/sim/test/golden.test.js`

**Interfaces:**
- Consumes: `createWorld`, `getTableProfile`, `TUNING_LEGACY`, `TUNING`, `SHOT` (Tarefa 2); `createLegacyWorld` (teste).
- Produces (`types.js`, JSDoc):
  - `BallState = { id: number, x: number, z: number, q?: [x, y, z, w], pocketed: boolean }`
  - `TableState = { tableProfileId: string, balls: BallState[] }`
  - `ShotInput = { angle: number, power: number, spin: { x: number, y: number }, cueBall?: { x: number, z: number } }`
  - `ShotResult = { frames: Frame[], events: SimEvent[], final: TableState, steps: number, simSeconds: number, capped: boolean }`; `frames` e `events` ficam vazios até as Tarefas 4 e 5.
- Produces:
  - `simulateShot(table: TableState, shot: ShotInput, opts?: { tuning?: Tuning, maxSimSeconds?: number }): ShotResult`, com `maxSimSeconds` padrão 20;
  - `ball.js`: `createBall(id, tuning)`, `applyCueImpulse(ball, x, y, z, spinX, spinY)`, `limitSpeed(ball)`, `limitAngularSpeed(ball)`, `applyLowSpeedBrake(ball, dt, tuning)`, `applySpinPhysics(ball, dt, tuning)`, `removeBall(simWorld, ball)`; porte literal de `Ball.js`, sem `mesh`;
  - `guards.js`: `createGuards(simWorld, balls, hooks = {})` → `{ update(dt), checkPockets(): {id, pocketIndex}[], allStopped(): boolean, applyCushionSpin(ball) }`, com `hooks = { onBallContact?(a, b, speed), onCushionContact?(ball) }`; porte literal de `BallsManager` (`updatePhysicsGuards`, `_resolveSweptBallContacts`, `_resolveBallOverlaps`, `_separateContactPair`, `_resolveBallCollisionVelocity`, `applyCushionSpin`, `_enforceTableBounds`, `_isNearPocketMouth`, `allStopped`, `checkPockets`), sem `sync()`.
- Produces (teste):
  - `runLegacy(legacyWorld, shot: { dir: {x, z}, force, spin }, mode: { cadence: 'fixed60' } | { fps: number }): { final, steps, simSeconds }`; `fixed60` = 6 × `world.step(1/360)` e depois guardas(1/60) + caçapas + parada; `{ fps }` = laço legado com `performance.now` congelado durante a execução;
  - `hashFinal(balls: { id, x, z, pocketed }[]): string`, FNV-1a como em `spikes/sim-bench/src/run-shot.js`;
  - `CORPUS: { name, kind: 'break' | 'low-energy' | 'single' | 'calibration', table: TableState, shot: ShotInput, expectPocketed?: number[] }[]` e `rack8(tableProfileId = 'pool9ft'): TableState` (posições de `BallsManager._rackEightBall`).

Laço de `simulateShot`:

```
STEP = 1/360; GUARD_EVERY = 6; MAX_STEPS = round(maxSimSeconds * 360)
valida entradas → monta mundo (ordem: mesa, depois bolas não encaçapadas em ordem de id) → aplica cueBall
→ applyCueImpulse(cue, cos(angle)*p, 0, sin(angle)*p, spin.x, spin.y)
for step = 1..MAX_STEPS:
  world.step(STEP)
  if step % 6 == 0: guards.update(1/60); checkPockets(); if allStopped(): stopped = true
  if stopped: break
simSeconds = step / 360; capped = !stopped
```

O listener `collide` de cada bola chama `guards.applyCushionSpin(ball)` quando o outro corpo tem o material de tabela, como em `Game.setupCollisionEvents`.

Corpus (`test/corpus.js`). Mesa `pool9ft`; ângulos em radianos.

| `name` | `kind` | Mesa | `angle`, `power`, `spin` | `expectPocketed` |
|--------|--------|------|--------------------------|------------------|
| `break` | break | `rack8()` | mira a bola 1, 110, (0,0) | — |
| `medium` | break | `rack8()` | mira a bola 1, 50, (0,0) | — |
| `english` | break | `rack8()` | mira a bola 1, 60, (0.8,0) | — |
| `soft` | low-energy | `rack8()` | mira a bola 1, 15, (0,0) | `[]` |
| `draw-rack` | calibration | `rack8()` | mira a bola 1, 60, (0,−0.8) | — |
| `rail-straight` | single | só a branca em (0,−60) | π/2, 40, (0,0) | `[]` |
| `rail-english` | single | só a branca em (−30,−80) | 3π/4, 50, (0.6,0) | `[]` |
| `long-stun` | single | só a branca em (0,−100) | π/2, 70, (0,0) | `[]` |
| `follow` | single | branca (0,−60), bola 1 (0,0) | π/2, 40, (0,0.6) | `[]` |
| `pot-corner` | single | bola 1 (−55,−118.5), branca (−25,−88.5) | −3π/4, 30, (0,0) | `[1]` |
| `pot-side` | single | bola 1 (−50,0), branca (−10,0) | π, 25, (0,0) | `[1]` |
| `pot-far-corner` | single | bola 1 (55,118.5), branca (25,88.5) | π/4, 30, (0,0) | `[1]` |
| `draw-ref` | calibration | branca (0,−50), bola 1 (0,0) | π/2, 60, (0,−0.8) | — |

"Mira a bola 1" = `atan2(z1 − z0, x1 − x0)`. As mesas que não são `rack8()` listam **só** as bolas da coluna Mesa. Se um encaçape não cair, ajuste só `power`, entre 15 e 60, e registre no ledger.

- [ ] **Step 1: Escrever os testes que falham**

```js
// packages/sim/test/parity.test.js — bit a bit contra o legado no mesmo ritmo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installEnv } from './legacy/env.js';
installEnv({ seed: 1 });
const { createLegacyWorld } = await import('./legacy/legacy-world.js');
const { runLegacy } = await import('./legacy/legacy-run.js');
const { simulateShot, TUNING_LEGACY } = await import('../src/index.js');
const { CORPUS } = await import('./corpus.js');
const { hashFinal } = await import('./util/hash.js');

for (const name of ['break', 'medium', 'english', 'soft', 'draw-rack']) {
  test(`paridade com o legado a 60 Hz fixo: ${name}`, () => {
    const c = CORPUS.find(x => x.name === name);
    const sim = simulateShot(c.table, c.shot, { tuning: TUNING_LEGACY });
    const legacy = runLegacy(createLegacyWorld({ tableProfileId: 'pool9ft' }),
      { dir: { x: Math.cos(c.shot.angle), z: Math.sin(c.shot.angle) }, force: c.shot.power, spin: c.shot.spin },
      { cadence: 'fixed60' });
    assert.equal(sim.steps, legacy.steps);
    assert.equal(hashFinal(sim.final.balls), hashFinal(legacy.final));
  });
}
```

```js
// packages/sim/test/simulate.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateShot, SHOT } from '../src/index.js';
import { CORPUS, rack8 } from './corpus.js';
const shot = (o = {}) => ({ angle: Math.PI / 2, power: 50, spin: { x: 0, y: 0 }, ...o });
const deepFreeze = o => { Object.values(o).forEach(v => typeof v === 'object' && v && deepFreeze(v)); return Object.freeze(o); };

test('não altera o estado de entrada', () => {
  const t = deepFreeze(rack8());
  assert.doesNotThrow(() => simulateShot(t, shot()));
});
test('números inválidos lançam RangeError', () => {
  for (const bad of [{ angle: NaN }, { power: Infinity }, { power: 0 }, { power: -5 }, { spin: { x: NaN, y: 0 } }]) {
    assert.throws(() => simulateShot(rack8(), shot(bad)), RangeError, JSON.stringify(bad));
  }
});
test('estado sem branca ativa ou com ids repetidos lança Error', () => {
  const t = rack8(); t.balls.find(b => b.id === 0).pocketed = true;
  assert.throws(() => simulateShot(t, shot()), /cue ball/);
  const d = rack8(); d.balls.push({ ...d.balls[1] });
  assert.throws(() => simulateShot(d, shot()), /duplicate ball id/);
});
test('bolas encaçapadas na entrada continuam encaçapadas e fora da física', () => {
  const t = rack8(); t.balls.find(b => b.id === 5).pocketed = true;
  const r = simulateShot(t, shot({ power: 110 }));
  assert.equal(r.final.balls.find(b => b.id === 5).pocketed, true);
  for (const b of r.final.balls) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.z));
});
test('potência acima do máximo é limitada a SHOT.maxPower', () => {
  assert.deepEqual(simulateShot(rack8(), shot({ power: 500 })).final, simulateShot(rack8(), shot({ power: SHOT.maxPower })).final);
});
test('efeito com comprimento > 1 é normalizado', () => {
  const a = simulateShot(rack8(), shot({ spin: { x: 2, y: 0 } })).final;
  const b = simulateShot(rack8(), shot({ spin: { x: 1, y: 0 } })).final;
  assert.deepEqual(a, b);
});
test('limite de tempo simulado marca capped', () => {
  const r = simulateShot(rack8(), shot({ power: 110 }), { maxSimSeconds: 0.5 });
  assert.equal(r.capped, true); assert.equal(r.steps, 180); assert.equal(r.simSeconds, 0.5);
});
test('cueBall posiciona a branca antes da tacada', () => {
  const t = { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: 0, pocketed: false }] };
  const r = simulateShot(t, shot({ power: 5, cueBall: { x: 20, z: -30 } }));
  assert.ok(Math.abs(r.final.balls[0].x - 20) < 0.01);
});
test('encaçapes do corpus caem como esperado', () => {
  for (const c of CORPUS.filter(c => c.expectPocketed)) {
    const pocketed = simulateShot(c.table, c.shot).final.balls.filter(b => b.pocketed && c.table.balls.find(x => x.id === b.id && !x.pocketed)).map(b => b.id);
    assert.deepEqual(pocketed, c.expectPocketed, c.name);
  }
});
```

```js
// packages/sim/test/golden.test.js — F1-05
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';
import { hashFinal } from './util/hash.js';
const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));

test('corpus golden idêntico em duas execuções e igual ao golden.json', () => {
  assert.deepEqual(Object.keys(golden).sort(), CORPUS.map(c => c.name).sort());
  for (const c of CORPUS) {
    const a = simulateShot(c.table, c.shot), b = simulateShot(c.table, c.shot);
    assert.equal(hashFinal(a.final.balls), hashFinal(b.final.balls), c.name);
    assert.deepEqual({ hash: hashFinal(a.final.balls), steps: a.steps }, golden[c.name], c.name);
  }
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/sim`
Expected: FAIL com `Cannot find module` (`legacy-run.js`, `corpus.js` ou exportação `simulateShot` ausente).

- [ ] **Step 3: Implementar `ball.js`, `guards.js`, `simulate.js`, `types.js`, os auxiliares de teste e o `golden.json`**

Gere o `golden.json` com `npm run golden:update -w packages/sim` **depois** que a paridade passar. Formato: `{ "<name>": { "hash": "<8 hex>", "steps": n } }`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/sim && npm run typecheck`
Expected: PASS (5 da Tarefa 2 + 5 de paridade + 9 de simulação + 1 golden = 20 testes); `tsc` sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/sim
git commit -m "feat(sim): port ball physics and guards with bit-exact legacy parity"
```

### Task 4: Eventos da tacada

**Files:**
- Create: `packages/sim/src/events.js`; modify: `packages/sim/src/simulate.js`
- Test: `packages/sim/test/events.test.js`

**Interfaces:**
- Produces: `SimEvent` =
  - `{ t, type: 'ball_ball', a, b, speed }` (`a < b`; `speed` = módulo da velocidade relativa);
  - `{ t, type: 'ball_cushion', ball, speed }`;
  - `{ t, type: 'pocket', ball, pocket }` (`pocket` = índice em `getPocketPositions`);
  - `{ t, type: 'first_contact', ball }`.
  - Em todos, `t = step / 360`.
- Produces: `createEventLog(): { push(e), events: SimEvent[] }`.

Fontes de cada evento:
- `ball_ball` e `ball_cushion` vêm do evento `beginContact` do mundo cannon (um por início de contato, nunca por passo) e dos ganchos `onBallContact` e `onCushionContact` das guardas.
- `pocket` vem de `checkPockets`.
- `first_contact` é emitido junto com o primeiro `ball_ball` que envolve a bola 0.
- `events` sai ordenado por `t`, e a ordem de inserção é mantida em empates.

- [ ] **Step 1: Escrever os testes que falham**

```js
// packages/sim/test/events.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';
const run = name => { const c = CORPUS.find(x => x.name === name); return simulateShot(c.table, c.shot); };

test('a abertura toca as tabelas (detecta mundo sem tabelas)', () => {
  assert.ok(run('break').events.filter(e => e.type === 'ball_cushion').length >= 10);
});
test('first_contact da abertura é a bola 1 e coincide com o primeiro ball_ball da branca', () => {
  const ev = run('break').events;
  const fc = ev.find(e => e.type === 'first_contact');
  const bb = ev.find(e => e.type === 'ball_ball' && e.a === 0);
  assert.equal(fc.ball, 1); assert.equal(fc.t, bb.t); assert.equal(bb.b, 1);
  assert.equal(ev.filter(e => e.type === 'first_contact').length, 1);
});
test('encaçape gera evento pocket com o índice da caçapa', () => {
  const p = run('pot-side').events.filter(e => e.type === 'pocket');
  assert.deepEqual(p.map(e => [e.ball, e.pocket]), [[1, 2]]);
});
test('eventos ordenados por t e sem par repetido em passos consecutivos', () => {
  const ev = run('break').events;
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i].t >= ev[i - 1].t);
  const last = new Map();
  for (const e of ev.filter(e => e.type === 'ball_ball')) {
    const k = `${e.a}-${e.b}`;
    if (last.has(k)) assert.ok(e.t - last.get(k) > 1 / 180 - 1e-12, `${k} at ${e.t}`);
    last.set(k, e.t);
  }
});
test('tacada só da branca na tabela não gera ball_ball', () => {
  const ev = run('rail-straight').events;
  assert.equal(ev.filter(e => e.type === 'ball_ball').length, 0);
  assert.ok(ev.some(e => e.type === 'ball_cushion'));
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/sim`
Expected: FAIL nos 5 testes novos (`events` vazio); os 20 anteriores passam.

- [ ] **Step 3: Implementar `events.js` e ligar em `simulate.js`**

Os eventos não podem alterar a física. O hash de paridade e o `golden.json` precisam continuar iguais.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/sim`
Expected: PASS (25 testes), sem mudança no `golden.json`.

- [ ] **Step 5: Commit**

```bash
git add packages/sim
git commit -m "feat(sim): emit shot events"
```

### Task 5: Trajetória a 30 Hz

**Files:**
- Create: `packages/sim/src/frames.js`; modify: `packages/sim/src/simulate.js`
- Test: `packages/sim/test/frames.test.js`

**Interfaces:**
- Produces: `Frame = { t: number, balls: { id, x, z, q: [x, y, z, w] }[] }`.
  - Um quadro a cada 12 passos (`t = k/30`), denso: quadros sem bola em movimento têm `balls: []`.
  - Uma bola entra no quadro se não estava encaçapada no quadro anterior e se, desde a última amostra emitida dela, se deslocou mais de 0,005 cm ou girou mais de 0,01 rad.
  - O último trecho (entre o último múltiplo de 12 e o fim) não gera quadro: o `final` cobre esse trecho.
- Produces: `createFrameSampler(balls): { sample(step), frames }`; `final.balls[i].q` passa a ser preenchido.

- [ ] **Step 1: Escrever os testes que falham**

```js
// packages/sim/test/frames.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';
const run = name => { const c = CORPUS.find(x => x.name === name); return { c, r: simulateShot(c.table, c.shot) }; };

test('quadros densos em múltiplos de 1/30 s até o fim', () => {
  const { r } = run('break');
  assert.equal(r.frames.length, Math.floor(r.steps / 12));
  r.frames.forEach((f, i) => assert.equal(f.t, (i + 1) * 12 / 360));
});
test('bolas paradas não aparecem; a branca aparece no primeiro quadro', () => {
  const { r } = run('soft');
  assert.ok(r.frames[0].balls.some(b => b.id === 0));
  assert.ok(!r.frames[0].balls.some(b => b.id === 15));
});
test('última amostra de cada bola fica a menos de 0,5 cm do estado final', () => {
  const { r } = run('medium');
  const lastSeen = new Map();
  for (const f of r.frames) for (const b of f.balls) lastSeen.set(b.id, b);
  for (const fb of r.final.balls.filter(b => !b.pocketed)) {
    const s = lastSeen.get(fb.id); if (!s) continue;
    assert.ok(Math.hypot(s.x - fb.x, s.z - fb.z) < 0.5, `ball ${fb.id}`);
  }
});
test('quatérnios normalizados', () => {
  for (const f of run('english').r.frames) for (const b of f.balls) assert.ok(Math.abs(Math.hypot(...b.q) - 1) < 1e-9);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/sim`
Expected: FAIL nos 4 testes novos.

- [ ] **Step 3: Implementar `frames.js` e ligar em `simulate.js`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/sim`
Expected: PASS (29 testes), sem mudança no `golden.json`.

- [ ] **Step 5: Commit**

```bash
git add packages/sim
git commit -m "feat(sim): sample the shot trajectory at 30 Hz"
```

### Task 6: `packages/protocol` — codificação binária da trajetória v1

**Files:**
- Create: `packages/protocol/package.json` (`"name": "@billiards/protocol"`, `"private": true`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, `scripts.test` = `node --test test/*.test.ts`)
- Create: `packages/protocol/src/trajectory.ts`, `packages/protocol/src/index.ts`
- Modify: `packages/sim/package.json` (`devDependencies["@billiards/protocol"] = "*"`)
- Test: `packages/protocol/test/trajectory.test.ts`, `packages/sim/test/trajectory-size.test.js`

**Interfaces:**
- Produces:
  - `TRAJECTORY_VERSION = 1`, `SAMPLE_RATE = 30`;
  - `interface TrajectoryBall { id: number; x: number; z: number; q: [number, number, number, number] }` e `interface TrajectoryFrame { t: number; balls: TrajectoryBall[] }`;
  - `encodeTrajectory(frames: TrajectoryFrame[]): Uint8Array`;
  - `decodeTrajectory(bytes: Uint8Array): TrajectoryFrame[]`, com `t = (i + 1) / SAMPLE_RATE`.
- Formato (little-endian), conforme a spec §6.1:
  - cabeçalho: `u8 version`, `u8 sampleRate`, `u16 frameCount`;
  - por quadro: `u8 movingCount`;
  - por bola (12 bytes): `u8 id`, `i16 round(x * 100)`, `i16 round(z * 100)`, `u8 índice do maior componente`, `3 × i16 round(c * 32767 * √2)`.
  - O maior componente fica positivo (negue o quatérnio se precisar).
- Erros:
  - `RangeError` quando `|x|` ou `|z|` > 327,67, `movingCount` > 255, `frameCount` > 65535, `id` > 255, ou `frames[i].t` difere de `(i + 1)/30` em mais de 1e-9;
  - `decodeTrajectory` lança `Error('unsupported trajectory version: <v>')` para versão ≠ 1 e `RangeError` para buffer truncado.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// packages/protocol/test/trajectory.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeTrajectory, decodeTrajectory, type TrajectoryFrame } from '../src/index.ts';

const q = (a: number): [number, number, number, number] => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];
const frames: TrajectoryFrame[] = [
  { t: 1 / 30, balls: [{ id: 0, x: 12.3456, z: -100.0049, q: q(0.3) }, { id: 15, x: -63.5, z: 127, q: q(-2.9) }] },
  { t: 2 / 30, balls: [] },
];

test('ida e volta preserva posições (0,005 cm) e rotações (0,001 rad)', () => {
  const out = decodeTrajectory(encodeTrajectory(frames));
  assert.equal(out.length, 2); assert.equal(out[1].balls.length, 0); assert.equal(out[1].t, 2 / 30);
  out[0].balls.forEach((b, i) => {
    const s = frames[0].balls[i];
    assert.equal(b.id, s.id);
    assert.ok(Math.abs(b.x - s.x) <= 0.005 && Math.abs(b.z - s.z) <= 0.005);
    const dot = Math.abs(b.q.reduce((acc, v, k) => acc + v * s.q[k], 0));
    assert.ok(2 * Math.acos(Math.min(1, dot)) <= 0.001);
  });
});
test('tamanho: 4 + quadros + 12 bytes por bola', () => {
  assert.equal(encodeTrajectory(frames).byteLength, 4 + 2 + 2 * 12);
});
test('valores fora da faixa lançam RangeError', () => {
  const ball = { id: 0, x: 0, z: 0, q: q(0) };
  assert.throws(() => encodeTrajectory([{ t: 1 / 30, balls: [{ ...ball, x: 327.68 }] }]), RangeError);
  assert.throws(() => encodeTrajectory([{ t: 1 / 30, balls: Array.from({ length: 256 }, () => ball) }]), RangeError);
  assert.throws(() => encodeTrajectory([{ t: 1 / 30, balls: [{ ...ball, id: 256 }] }]), RangeError);
  assert.throws(() => encodeTrajectory([{ t: 0.5, balls: [] }]), RangeError);
  assert.throws(() => encodeTrajectory(Array.from({ length: 65536 }, (_, i) => ({ t: (i + 1) / 30, balls: [] }))), RangeError);
});
test('versão desconhecida e buffer truncado são recusados', () => {
  const bytes = encodeTrajectory(frames);
  const bad = bytes.slice(); bad[0] = 2;
  assert.throws(() => decodeTrajectory(bad), /unsupported trajectory version: 2/);
  assert.throws(() => decodeTrajectory(bytes.slice(0, bytes.length - 3)), RangeError);
});
```

```js
// packages/sim/test/trajectory-size.test.js — F1-04 (D037)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeTrajectory, decodeTrajectory } from '@billiards/protocol';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';

test('cada tacada do corpus cabe em 48 KB e sobrevive à ida e volta', () => {
  for (const c of CORPUS) {
    const { frames } = simulateShot(c.table, c.shot);
    const bytes = encodeTrajectory(frames);
    console.log(`trajectory ${c.name}: ${(bytes.byteLength / 1024).toFixed(1)} KB`);
    assert.ok(bytes.byteLength <= 48 * 1024, c.name);
    const back = decodeTrajectory(bytes);
    back.forEach((f, i) => f.balls.forEach((b, j) => assert.ok(Math.abs(b.x - frames[i].balls[j].x) <= 0.005)));
  }
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm install && npm test -w packages/protocol; npm test -w packages/sim`
Expected: FAIL com `Cannot find module '../src/index.ts'` no protocol e `Cannot find package '@billiards/protocol'` ou exportação ausente no sim.

- [ ] **Step 3: Implementar `trajectory.ts` e `index.ts`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/protocol && npm test -w packages/sim && npm run typecheck`
Expected: PASS (4 + 30 testes); os tamanhos impressos ficam registrados no ledger; `tsc` sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol packages/sim package.json package-lock.json tsconfig.json
git commit -m "feat(protocol): add binary trajectory codec v1"
```

### Task 7: Referência do legado e teste de sensação (F1-06)

**Files:**
- Create: `packages/sim/test/feel/metrics.js`, `packages/sim/tools/legacy-reference.mjs`, `packages/sim/test/feel/legacy-reference.json` (gerado); script `"feel:reference": "node tools/legacy-reference.mjs"`
- Test: `packages/sim/test/feel.test.js`

**Interfaces:**
- Consumes: `CORPUS`, `runLegacy` com `{ fps }`, `createLegacyWorld`, `simulateShot`.
- Produces: `computeMetrics(kind, samples, final): Metrics`. `samples` são as posições a 30 Hz de tempo simulado: no sim, os `frames`; no legado, a primeira iteração com `t ≥ k/30`. O `kind` define as métricas:
  - `single`: `{ cuePath, cueX, cueZ, pocketed: number[] }`;
  - `low-energy`: `{ positions: {id: [x, z]}, pocketed }`;
  - `break`: `{ totalPath, moved (bolas com deslocamento > 1 cm), pocketedCount }`.
  - `cuePath` e `totalPath` são somas das distâncias entre amostras consecutivas.
- Produces: `legacy-reference.json` = `{ "<name>": { "30": Metrics, "60": Metrics, "120": Metrics, "144": Metrics } }` para todas as tacadas que não são `calibration`. No legado, cada mesa do corpus é montada sobre `createLegacyWorld`: as bolas que não estão na mesa saem com `ball.remove()` + `physics.removeBody(ball.body)`, e as demais vão para a posição com `ball.setPosition(x, BALL.radius, z)`.
- Produces: `withinEnvelope(value, legacyByFps, kindOfMetric): boolean` (D035):
  - comprimentos e posições (por eixo): `[mín − m, máx + m]`, com `m = max(1, 0.02 × |valor a 60 FPS|)` (para posições, `m = max(1, 0.02 × cuePath a 60 FPS)`);
  - contagens: `[mín − 1, máx + 1]`;
  - `pocketed`: igual ao de 60 FPS.

- [ ] **Step 1: Gerar a referência e escrever o teste que falha**

Run: `npm run feel:reference -w packages/sim`
Expected: `legacy-reference.json` com 11 tacadas × 4 FPS.

```js
// packages/sim/test/feel.test.js — D033/D035
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';
import { computeMetrics, withinEnvelope } from './feel/metrics.js';
const ref = JSON.parse(readFileSync(new URL('./feel/legacy-reference.json', import.meta.url), 'utf8'));

for (const c of CORPUS.filter(c => c.kind !== 'calibration')) {
  test(`sensação dentro do envelope do legado: ${c.name}`, () => {
    const r = simulateShot(c.table, c.shot);
    const m = computeMetrics(c.kind, [c.table, ...r.frames], r.final);
    for (const [key, value] of Object.entries(m)) {
      assert.ok(withinEnvelope(value, Object.fromEntries(Object.entries(ref[c.name]).map(([fps, mm]) => [fps, mm[key]])), key),
        `${c.name}.${key} = ${JSON.stringify(value)} fora de ${JSON.stringify(ref[c.name])}`);
    }
  });
}
```

- [ ] **Step 2: Rodar com `TUNING = TUNING_LEGACY`**

Run: `npm test -w packages/sim 2>&1 | grep -E "^# (pass|fail)|not ok"`
Expected: PASS em todas as 11 tacadas, porque o sim reproduz o legado a 60 Hz fixo. **Se alguma falhar, pare:** não afrouxe a tolerância. Registre os valores no ledger e leve ao usuário (a D035 seria insuficiente).

Também confirme que o teste falha quando deve: com `TUNING` alterado temporariamente (`rollingResistance: 30`), `long-stun` precisa falhar. Depois desfaça.

- [ ] **Step 3: Commit**

```bash
git add packages/sim
git commit -m "test(sim): add legacy feel reference and envelope test"
```

### Task 8: Calibragem do recuo (F1-09, parte do sim)

**Files:**
- Modify: `packages/sim/src/constants.js` (`TUNING`), `packages/sim/src/simulate.js` (opção `probe`), `packages/sim/src/world.js` / `ball.js` / `guards.js`, conforme a correção
- Modify: `packages/sim/test/golden.json` (via `golden:update`), `harness/decisions.json` (nova decisão com os valores calibrados), `docs/f1/calibragem-recuo.md` (create)
- Test: `packages/sim/test/calibration.test.js`

**Interfaces:**
- Consumes: `simulateShot`, `CORPUS` (`draw-ref`), `TUNING`, `TUNING_LEGACY`.
- Produces: `TUNING` calibrado. `TUNING_LEGACY` não muda, e a paridade continua passando com ele.

Diagnóstico medido no planejamento: o atrito bola-mesa do cannon-es (corpo com Y travado por `linearFactor`) destrói o invariante de rolamento (2,5v + ωR caiu de 221 para 20 em 0,1 s no legado). Com `ballTableFriction: 0`, o invariante se conserva (368 → 370), e na `draw-ref` a branca volta 23 cm. Porém as tacadas sem efeito passam a andar de 14% a 21% a mais, então é preciso reajustar a frenagem e o rolamento.

- [ ] **Step 1: Escrever os testes que falham**

```js
// packages/sim/test/calibration.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';

test('draw-ref: a branca volta pelo menos 10 cm depois do contato', () => {
  const c = CORPUS.find(x => x.name === 'draw-ref');
  const r = simulateShot(c.table, c.shot);
  const fc = r.events.find(e => e.type === 'first_contact');
  assert.ok(fc, 'a branca precisa alcançar a bola 1');
  const maxZ = Math.max(...r.frames.flatMap(f => f.balls.filter(b => b.id === 0).map(b => b.z)));
  const endZ = r.final.balls.find(b => b.id === 0).z;
  assert.ok(maxZ - endZ >= 10, `recuo de ${(maxZ - endZ).toFixed(1)} cm`);
});

test('bola sozinha com efeito para trás conserva 2,5v + ωR (±5%) nos primeiros 0,1 s', () => {
  const t = { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: -100, pocketed: false }] };
  const R = 2.8575;
  const inv = r => 2.5 * r.v + r.w * R;
  const r0 = simulateShot(t, { angle: Math.PI / 2, power: 60, spin: { x: 0, y: -0.8 } }, { maxSimSeconds: 1 / 360, probe: true });
  const r1 = simulateShot(t, { angle: Math.PI / 2, power: 60, spin: { x: 0, y: -0.8 } }, { maxSimSeconds: 0.1, probe: true });
  assert.ok(Math.abs(inv(r1.probe) - inv(r0.probe)) <= 0.05 * Math.abs(inv(r0.probe)));
});
```

A opção `probe: true` de `simulateShot` acrescenta ao resultado `probe = { v: velocidade em z da branca, w: velocidade angular em x da branca }` no último passo. É só para diagnóstico, documentada em `types.js`.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/sim`
Expected: FAIL nos 2 testes de calibragem (recuo de cerca de 0 cm; invariante cai cerca de 90%); todo o resto passa.

- [ ] **Step 3: Calibrar `TUNING`**

1. Ponto de partida: `ballTableFriction: 0`.
2. Ajuste `rollingResistance`, `rollCoupling` e `damping` até o teste de sensação (Tarefa 7) voltar a passar em todas as 11 tacadas, com os 2 testes de calibragem passando.
3. Registre cada tentativa (valores e resultado) em `docs/f1/calibragem-recuo.md`.

**Prazo: 2 dias úteis.** Se não fechar, pare e leve ao usuário as opções medidas:
- aceitar a sensação nova após teste de jogo;
- manter o recuo legado;
- outra correção encontrada.

- [ ] **Step 4: Rodar, atualizar o golden e registrar a decisão**

Run: `npm test -w packages/sim`
Expected: PASS em tudo, exceto `golden.test.js`, que falha porque `TUNING` mudou de propósito. Então:
- rode `npm run golden:update -w packages/sim` e de novo `npm test -w packages/sim` (tudo PASS);
- acrescente `D038` em `harness/decisions.json`, com os valores finais de `TUNING` e a referência a `docs/f1/calibragem-recuo.md`.

- [ ] **Step 5: Commit**

```bash
git add packages/sim docs/f1 harness/decisions.json
git commit -m "fix(sim): calibrate draw so backspin no longer destroys cue ball momentum"
```

### Task 9: Otimização (F1-08, D034)

**Files:**
- Create: `packages/sim/bench/break.mjs`; script `"bench": "node --expose-gc bench/break.mjs"`
- Modify: arquivos de `packages/sim/src` conforme a otimização; `golden.json`, se a física mudar
- Modify: `harness/decisions.json` (nova decisão, se algum parâmetro de física mudar)

**Interfaces:**
- Consumes: `simulateShot`, `CORPUS` (`break`) e o modelo `fixed` do spike (`spikes/sim-bench/src/{env,world,run-shot}.js`).
- Produces:
  - `bench/break.mjs` imprime `{ spikeMedianMs, simMedianMs, ratio, simP95Ms }`;
  - carrega o spike como `spikes/sim-bench/test/run-shot.test.mjs` faz (`installEnv` antes do `import()` dinâmico de `world.js`);
  - mede 20 + 3 de aquecimento, alternando spike e sim no mesmo processo, com `gc()` antes de cada tacada;
  - sai com código 1 se `ratio < 1.3`.

- [ ] **Step 1: Escrever o bench e confirmar a falha**

Run: `npm run bench -w packages/sim; echo exit=$?`
Expected: `exit=1` (no planejamento, o ritmo de 60 Hz deu cerca de 1,04×: 127 ms contra 132 ms).

- [ ] **Step 2: Otimizar**

Primeiro faça um perfil (`node --cpu-prof`) e ataque o que ele mostrar. Candidatos:
- alocações por passo nas guardas (`previousPositions` cria objetos a cada chamada);
- `solverIterations` (38) e `solverTolerance`;
- eixo do `SAPBroadphase`;
- limites de repouso.

Mudanças que alteram a física exigem o teste de sensação e os de calibragem verdes, `golden:update` e uma decisão registrada.

- [ ] **Step 3: Verificar**

Run: `npm run bench -w packages/sim; echo exit=$? && npm test -w packages/sim`
Expected: `exit=0`, `ratio ≥ 1.3`, `simP95Ms` impresso; todos os testes passam.

- [ ] **Step 4: Commit**

```bash
git add packages/sim harness/decisions.json
git commit -m "perf(sim): speed up shot simulation by at least 1.3x over the spike baseline"
```

### Task 10: Fechamento da F1-A

**Files:**
- Modify: `docs/superpowers/plans/2026-10-24-roteiro.md` (linha da F1 dividida em F1-A e F1-B), `docs/superpowers/specs/2026-10-24-billiards-online-design.md` (§6 passo 4: guardas a 60 Hz conforme a D036; §4 item 2: "medido na F0"), `harness/feature_list.json`, `harness/progress.md`, `harness/init.sh` (se precisar)

- [ ] **Step 1: Marcar os itens verificados**

Para cada item, rode a verificação e só então marque `"passes": true`:
- F1-01: `npm test` na raiz e `npm run build`;
- F1-02: o teste de imports de `table.test.js`;
- F1-03: eventos, limite de tempo e efeito de tabela, nos testes das Tarefas 3 e 4;
- F1-04: Tarefa 6;
- F1-05: `golden.test.js`;
- F1-06: `feel.test.js`;
- F1-08: `npm run bench`.

O F1-09 recebe `"notes": "parte do sim concluída na F1-A; falta a confirmação no navegador (F1-B)"` e continua `false`. O F1-07 continua `false` (F1-B).

- [ ] **Step 2: Verificação final**

Run: `CI=1 PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm test > /tmp/f1a-final.log 2>&1; echo exit=$? && npm run typecheck && bash harness/init.sh | head -3 && node harness/status.mjs | head -2`
Expected: `exit=0`; `tsc` sem erros; `fast suites: 15/15 passing`; o status mostra a F1 com os itens marcados.

- [ ] **Step 3: Commit**

```bash
git add docs harness
git commit -m "docs(f1a): close phase F1-A and update roadmap, spec and harness"
```
