# F3 — Nakama, contas e salas: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um ambiente local com Docker sobe o Nakama e o PostgreSQL, carrega o módulo de servidor do jogo e permite que bots:
- entrem como convidados, vinculem e-mail e editem o perfil;
- criem uma sala privada e entrem nela pelo código;
- formem uma partida 1×1 pelo matchmaker.

**Architecture:**
- **Infraestrutura:** `infra/docker-compose.yml` sobe o PostgreSQL 16 e o Nakama 3.41.0, as mesmas versões do spike da F0.
- **Módulo de servidor:** `services/nakama` é escrito em TypeScript e empacotado pelo esbuild num único `build/index.js`. O empacotamento segue o padrão do spike: um IIFE com a lógica e uma "cola" de funções globais. O runtime JS do Nakama exige que toda função registrada seja uma declaração global.
- **Validação:** as entradas das RPCs passam pelos validadores leves de `packages/protocol` (§9.2).
- **Partida:** o manipulador de partida da F3 só cuida do saguão: lugares, entrada, saída e fim por inatividade. A partida com tacadas é a F4.
- **Testes:** os de integração usam bots em Node com `@heroiclabs/nakama-js` e precisam do Docker. O `npm test` da raiz continua sem precisar do Docker (D051).

**Tech Stack:**
- Nakama 3.41.0 (runtime JS goja) e PostgreSQL 16, ambos em Docker Compose;
- TypeScript 5.9 e esbuild 0.28.2;
- `@heroiclabs/nakama-js` 2.8.0, usado nos bots;
- `node:test`;
- GitHub Actions para a integração.

**Spec:** [`docs/superpowers/specs/2026-10-24-billiards-online-design.md`](../specs/2026-10-24-billiards-online-design.md): §5.1 e §5.4 (componentes e hospedagem), §7.5 (matchmaking e salas), §8.1 (contas), §9.2 (segurança), §9.3 (testes do `services/nakama`), §10 (F3) e §12 (VPS ou Heroic Cloud). Referência técnica: [`docs/spikes/2026-10-24-runtime-simulacao.md`](../../spikes/2026-10-24-runtime-simulacao.md) e `spikes/sim-bench/nakama/`, o compose e o empacotamento usados na F0.

## Decisões que este plano propõe

Registradas em `harness/decisions.json` com `status: "open"` junto com este plano. A Tarefa 1 as marca como `accepted` (a D049, com a opção que o usuário escolher) quando o plano for aprovado.

| Id | Decisão | Por quê |
|----|---------|---------|
| **D049** | Fecha a D019 (hospedagem). **Recomendação:** uma VPS própria com o mesmo Docker Compose do desenvolvimento, com Nakama, PostgreSQL e, na F4, o `services/sim`. A Heroic Cloud fica como saída se a operação pesar. A implantação em si é na F4. | É o mesmo compose em dev e em produção, com custo previsível no beta. A Heroic Cloud não roda o `services/sim` (Node) junto do Nakama, então seria preciso hospedar o sim em outro lugar de qualquer jeito. Esta é uma escolha do usuário: as alternativas ficam na decisão. |
| **D050** | O módulo de servidor é um bundle do esbuild (`format: 'iife'`, `target: 'es2017'`) seguido de uma cola gerada com uma função global por handler registrado, como no spike da F0. Os tipos do runtime do Nakama usados pelo módulo são declarados localmente (`services/nakama/src/nakama.ts`), em vez de depender do `heroiclabs/nakama-common` pelo GitHub. | O goja só registra funções declaradas no escopo global. O spike provou que esse formato carrega no Nakama 3.41.0. Os tipos oficiais não estão no npm, e uma dependência via GitHub complica o lockfile. O módulo usa só uma parte pequena da API. |
| **D051** | Os testes de integração (`npm run test:integration -w services/nakama`) precisam do Docker. Eles rodam nas sessões na nuvem (com `dockerd`) e no GitHub Actions (`.github/workflows/integration.yml`, a cada push na branch de trabalho). O `npm test` da raiz não depende do Docker. Os itens F3 só são marcados depois de uma execução verde da integração, registrada no `progress.md`. | Esta máquina Windows não tem o Docker instalado. O spike da F0 rodou o Nakama num contêiner com `dockerd`. A spec (§9.3) já previa a integração com Docker na CI. |
| **D052** | Contas e perfil: | Os nomes são públicos e únicos (§8.1). Concentrar a validação numa RPC e nos hooks de autenticação cumpre "clientes nunca escrevem direto" (§9.2). Tokens reais do Google não podem ser gerados num teste automático. |
| | **Username:** 3 a 16 caracteres `[a-z0-9_]`, guardado em minúsculas e validado por `packages/protocol` (filtro de palavras PT-BR). | |
| | **Avatar:** um de 12 presets (`preset:a01` a `preset:a12`, no `avatar_url`). | |
| | **Mudanças de perfil:** só pela RPC `profile_update`. O `UpdateAccount` nativo é bloqueado por um hook, e os hooks de autenticação recusam username impróprio. | |
| | **Google:** usa a autenticação nativa do Nakama. Na F3 só se testa a recusa de token inválido; o login real é conferido quando o cliente tiver a tela (F5). | |

## Global Constraints

- **Versões fixas:** imagens `heroiclabs/nakama:3.41.0` e `postgres:16-alpine`; `esbuild` 0.28.2; `@heroiclabs/nakama-js` 2.8.0. Node ≥ 22.12.
- **`services/nakama` em TypeScript** (D015), só com sintaxe apagável, como o `packages/modes`. O bundle tem `target: 'es2017'`.
- **Toda função registrada no Nakama** (RPC, hook, `InitModule` e as funções do manipulador de partida) é uma declaração `function` global na cola gerada (D050).
- **Segredos:**
  - `infra/.env` fica fora do git.
  - `infra/.env.example` só tem valores de desenvolvimento, marcados como tais: `NAKAMA_SERVER_KEY=defaultkey`, `NAKAMA_HTTP_KEY=dev-http-key`, `NAKAMA_SESSION_KEY=dev-session-key`, `NAKAMA_CONSOLE_PASSWORD=dev-console`, `POSTGRES_PASSWORD=dev-postgres`.
  - Nunca entra no repositório uma `http_key` real, uma senha ou um client secret.
- **Portas** publicadas só em `127.0.0.1`: 7350 (API e socket) e 7351 (console).
- **Entradas de RPC** são validadas por funções de `packages/protocol`, sem bibliotecas no runtime do Nakama. Os erros têm códigos estáveis em inglês (`USERNAME_INVALID`, `USERNAME_TAKEN`, `AVATAR_INVALID`, `MODE_INVALID`, `CODE_INVALID`, `ROOM_NOT_FOUND`, `ROOM_FULL`).
- **O `npm test` da raiz não depende do Docker** (D051). O pacote `services/nakama` tem `test` (unitário, sem servidor) e `test:integration` (com o stack no ar).
- **Formatos aceitos:** 1×1 para `8ball` e `9ball`. O 2×2 e o cada um por si ficam para a F7 e a F9, mas as validações já usam `MODES[mode].formats`, de `@billiards/modes`. O `packages/protocol` continua sem dependências (§5.1): quem chama passa `MODES` para o validador.
- **Tudo que entra no bundle do Nakama roda no goja:** sem `structuredClone`, `import()` dinâmico nem `require`. O `packages/modes` também vai para o bundle, e o servidor da F4 vai rodá-lo.
- **Idioma e commits:** documentos em PT-BR, código e commits em inglês (conventional commits). Commit e push na branch de trabalho ao fim de cada interação (D028).

## Review Focus

1. **Filtro de nomes:** truques e falsos positivos.
   - Truques: acento, maiúscula, leetspeak (`p0rr4`) e separadores (`m_e_r_d_a`) não passam.
   - Falsos positivos: nomes legítimos que contêm um pedaço curto de palavrão (`cubo`, `cassio`) passam.
   - Teste na Tarefa 3.
2. **Código de sala digitado de qualquer jeito:** minúsculas e espaços nas pontas funcionam. Uma sala cheia dá `ROOM_FULL`. Um código inexistente, ou de uma sala que terminou por ficar vazia, dá `ROOM_NOT_FOUND`. Teste na Tarefa 5.
3. **Matchmaking entre modos diferentes:** um bilhete de `8ball` nunca forma partida com um de `9ball`. Um bilhete com propriedades forjadas (`mode: 'xyz'`) não cria partida. Teste na Tarefa 6.
4. **Conta duplicada:**
   - Entrar de novo com o mesmo id de dispositivo devolve a mesma conta.
   - Vincular um e-mail que já é de outra conta dá erro, e a primeira conta fica intacta.
   - Teste na Tarefa 4.
5. **Username já usado por outro jogador:** a RPC devolve `USERNAME_TAKEN`, e o perfil fica como estava. Teste na Tarefa 4.

## Fora do escopo da F3

- A partida com tacadas, o protocolo de mensagens (§6.2), o cronômetro, a reconexão e o `services/sim` em HTTP: tudo isso é a F4.
- A interface no cliente (login, perfil, salas e fila): F4 e F5.
- A implantação na VPS e o TLS (D049, na F4).
- LGPD (exportação e exclusão de conta), estatísticas no perfil e amigos: F4 e depois.
- Matchmaking 2×2 com grupos (F7) e cada um por si (F9).

## Estrutura de arquivos

```
infra/docker-compose.yml                  PostgreSQL 16 + Nakama 3.41.0, healthchecks, portas em 127.0.0.1
infra/nakama/local.yml                    configuração do Nakama (matchmaker rápido, logger, sessão)
infra/.env.example                        variáveis com valores só de desenvolvimento
packages/protocol/src/username.ts         normalizeUsername, validateUsername, AVATAR_PRESETS
packages/protocol/src/rooms.ts            ROOM_CODE_ALPHABET, generateRoomCode, parseRoomCode, parseMatchConfig
services/nakama/package.json              @billiards/nakama-module: build, test, test:integration
services/nakama/build.mjs                 esbuild + cola gerada a partir de src/registry.ts
services/nakama/src/nakama.ts             tipos locais do runtime (subconjunto usado)
services/nakama/src/registry.ts           o que o InitModule registra (nomes e handlers)
services/nakama/src/profile.ts            hooks de autenticação, bloqueio do UpdateAccount, RPC profile_update
services/nakama/src/rooms.ts              RPCs create_private_match e join_by_code
services/nakama/src/match.ts              manipulador de partida "billiards" (saguão)
services/nakama/src/matchmaker.ts         hook matchmakerMatched
services/nakama/test/*.test.ts            unitários (bundle, cola, handlers com nk/dispatcher falsos)
services/nakama/test/integration/*.ts     bots com nakama-js contra o stack em Docker
.github/workflows/integration.yml         sobe o stack e roda a integração a cada push na branch de trabalho
docs/f3/servidor-local.md                 como subir, testar e derrubar o servidor local
```

---

### Task 1: Infraestrutura local com Docker Compose (F3-01)

**Files:**
- Create: `infra/docker-compose.yml`, `infra/nakama/local.yml`, `infra/.env.example`, `services/nakama/package.json`, `services/nakama/test/integration/health.test.ts` e `services/nakama/test/integration/env.ts`.
- Modify:
  - `.gitignore` (`infra/.env`, `services/nakama/build/`);
  - `package.json` da raiz: `workspaces` ganha `services/*`, e entram os scripts `infra:up` e `infra:down`;
  - `harness/decisions.json`: D049 a D052 viram `accepted`, a D049 com a opção escolhida, e a D019 passa a `superseded` pela D049.

**Interfaces:**
- Produces:
  - `npm run infra:up`: roda `npm run build -w services/nakama`, depois `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --wait`. Se `infra/.env` não existir, ele é copiado do `.env.example`.
  - `npm run infra:down`: roda `docker compose -f infra/docker-compose.yml down -v`.
  - `test/integration/env.ts` exporta:
    - `NAKAMA = { host: '127.0.0.1', port: '7350', serverKey: process.env.NAKAMA_SERVER_KEY ?? 'defaultkey', httpKey: process.env.NAKAMA_HTTP_KEY ?? 'dev-http-key' }`;
    - `waitForNakama(timeoutMs = 60000): Promise<void>`, que consulta `GET /healthcheck` até receber 200. Se o tempo acabar, falha com a mensagem "Nakama não está no ar: rode npm run infra:up".
- Configuração:
  - O Nakama monta `../services/nakama/build` em `/nakama/data/modules` e usa o entrypoint `index.js`, como no spike.
  - O healthcheck do serviço do Nakama é `["CMD", "/nakama/nakama", "healthcheck"]`.
  - `local.yml` define `matchmaker.interval_sec: 1`, `matchmaker.max_intervals: 3`, `session.token_expiry_sec: 7200` e `logger.level: INFO`.
  - As chaves vêm das variáveis do `.env`, por argumentos na linha de comando do Nakama: `--socket.server_key`, `--runtime.http_key`, `--session.encryption_key` e `--console.password`.

- [ ] **Step 1: Escrever o teste de integração que falha**

```ts
// services/nakama/test/integration/health.test.ts
test('o Nakama responde ao healthcheck em até 60 s', async () => {
  await waitForNakama(60000);
  const res = await fetch(`http://${NAKAMA.host}:${NAKAMA.port}/healthcheck`);
  assert.equal(res.status, 200);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm run test:integration -w services/nakama`, com o Docker disponível e o stack desligado.
Expected: FAIL com "Nakama não está no ar: rode npm run infra:up".

- [ ] **Step 3: Escrever o compose, o `local.yml`, o `.env.example` e os scripts**

O `services/nakama/package.json` desta tarefa só tem `"test:integration": "node --test test/integration/*.test.ts"` e um `"build"` provisório, que gera um `build/index.js` com apenas `function InitModule(ctx, logger, nk, initializer) {}`. A Tarefa 2 o substitui.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run infra:up && npm run test:integration -w services/nakama && npm run infra:down`
Expected: o `up --wait` termina com os dois serviços saudáveis, e o teste passa (1/1).

- [ ] **Step 5: Aceitar D049 a D052 e fazer commit**

```bash
git add infra services/nakama .gitignore package.json package-lock.json harness/decisions.json
git commit -m "feat(infra): run Nakama and PostgreSQL locally with Docker Compose"
```

---

### Task 2: Pipeline do módulo de servidor

**Files:**
- Create: `services/nakama/build.mjs`, `src/nakama.ts`, `src/registry.ts` e `test/bundle.test.ts`.
- Modify: `services/nakama/package.json`, com os scripts `build`, `test` (`node --test test/*.test.ts`) e as devDependencies `esbuild` 0.28.2 e `@heroiclabs/nakama-js` 2.8.0. Também `tsconfig.json`: o `include` ganha `services/nakama/src`.

**Interfaces:**
- Produces:
  - `src/nakama.ts`: tipos locais do subconjunto da API do runtime usado pelo módulo: `Context`, `Logger`, `Nakama` (`accountUpdateId`, `matchCreate`, `matchList`, `usersGetId`), `Initializer`, `MatchDispatcher`, `Presence`, `MatchHandler` e `MatchmakerResult`. Eles seguem os nomes da documentação do runtime JS do Nakama 3.x.
  - `src/registry.ts`:
    - `export const REGISTRY: { rpcs: Record<string, RpcHandler>; before: Record<string, BeforeHook>; matchmakerMatched: MatchmakerMatchedHandler | null; matches: Record<string, MatchHandler> }`;
    - `export function initModule(ctx, logger, nk, initializer): void`, que registra tudo do `REGISTRY` usando os nomes globais da cola.
  - `build.mjs` faz três coisas:
    1. empacota `src/registry.ts` em IIFE com `globalName: 'Billiards'`;
    2. importa `REGISTRY` do `src/registry.ts` (o Node 24 executa `.ts`);
    3. gera a cola: `function InitModule(ctx, logger, nk, initializer) { … }` mais uma função global para cada handler, por exemplo `function rpc_create_private_match(ctx, logger, nk, payload) { return Billiards.REGISTRY.rpcs.create_private_match(ctx, logger, nk, payload); }`. As funções do manipulador de partida são geradas com o prefixo `match_<nome>_`.
  - O resultado é `services/nakama/build/index.js`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// services/nakama/test/bundle.test.ts — loads build/index.js in node:vm with a fake initializer
test('o bundle registra cada handler por uma função global', () => {
  const calls = loadBundleAndInit();             // vm context; returns the initializer calls [kind, name, fnName]
  for (const [, , fnName] of calls) assert.match(source, new RegExp(`^function ${fnName}\\(`, 'm'));
  assert.deepEqual(calls.map(([kind, name]) => `${kind}:${name}`).sort(), expectedRegistrations());   // from REGISTRY
});
test('o bundle não usa recursos ausentes no goja', () => {
  assert.doesNotMatch(source, /\bstructuredClone\(|\bimport\(|\brequire\(/);
});
```

Nesta tarefa, o `REGISTRY` só tem a RPC `healthcheck_module`, que devolve `{ "module": "billiards", "version": <a versão do package.json> }`. As tarefas seguintes acrescentam as outras entradas, e os dois testes acompanham automaticamente.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w services/nakama`
Expected: FAIL, porque `build/index.js` não existe ou não tem a cola.

- [ ] **Step 3: Implementar `nakama.ts`, `registry.ts` e `build.mjs`**

O `test` roda o `build` antes (`"pretest": "node build.mjs"`).

- [ ] **Step 4: Teste de integração da RPC**

Crie `test/integration/module.test.ts`. Ele chama a RPC `healthcheck_module` pela API HTTP com a `http_key` (`POST /v2/rpc/healthcheck_module?http_key=…&unwrap`) e confere `module === 'billiards'`.

Run: `npm run infra:up && npm run test:integration -w services/nakama && npm test -w services/nakama && npm run typecheck`
Expected: PASS em tudo.

- [ ] **Step 5: Commit**

```bash
git add services/nakama tsconfig.json package-lock.json
git commit -m "feat(nakama): bundle the server module with global handler glue"
```

---

### Task 3: Validadores de nome e de sala em `packages/protocol`

**Files:**
- Create: `packages/protocol/src/username.ts`, `src/rooms.ts`, `test/username.test.ts` e `test/rooms.test.ts`.
- Modify: `packages/protocol/src/index.ts`. Também `packages/modes/src/eightBall.ts` e `nineBall.ts`: `createInitialState` troca `structuredClone(cfg)` por `JSON.parse(JSON.stringify(cfg))`, porque o goja não tem `structuredClone`. Test: `packages/modes/test/match.test.ts`.

**Interfaces:**
- Produces:
  - `normalizeUsername(raw: string): string`: tira espaços das pontas, passa para minúsculas e remove acentos (NFD sem marcas).
  - `validateUsername(raw: string): { ok: true; username: string } | { ok: false; reason: 'USERNAME_INVALID' }`. As regras são:
    - depois de normalizar, o nome tem de casar com `^[a-z0-9_]{3,16}$`;
    - o nome não pode conter palavra da lista `BLOCKED_WORDS`, uma lista PT-BR com cerca de 40 entradas que fica no próprio arquivo.
  - A comparação com `BLOCKED_WORDS` acontece numa forma "esquelética" do nome. Ela é obtida assim:
    1. troca leetspeak: `0→o`, `1→i`, `3→e`, `4→a`, `5→s`, `7→t`, `@→a`, `$→s`;
    2. remove `_` e dígitos restantes;
    3. junta letras repetidas.
  - Palavras de 4 letras ou mais são recusadas quando aparecem como trecho da forma esquelética. Palavras de até 3 letras só são recusadas quando são um pedaço inteiro do nome original separado por `_` ou por dígitos.
  - `AVATAR_PRESETS: readonly string[]`, de `'a01'` a `'a12'`, e `parseAvatar(raw: string): string | null`. Esta aceita só `preset:<id>` com um id da lista.
  - `ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'`.
  - `generateRoomCode(random: () => number): string` devolve 6 caracteres.
  - `parseRoomCode(raw: unknown): string | null` tira espaços das pontas, passa para maiúsculas e exige 6 caracteres do alfabeto.
  - `parseMatchConfig(raw: unknown, modes: Record<string, { formats: readonly string[] }>): { mode: string; format: '1v1' } | null` aceita só um `mode` presente em `modes` e um `format` presente em `modes[mode].formats`, restrito a `'1v1'` na F3. O chamador passa o `MODES` de `@billiards/modes`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('nomes válidos são normalizados', () => {
  assert.deepEqual(validateUsername('  Cássio_10 '), { ok: true, username: 'cassio_10' });
  assert.deepEqual(validateUsername('cubo'), { ok: true, username: 'cubo' });
});
test('nomes impróprios são recusados mesmo disfarçados', () => {
  for (const name of ['merda', 'MERDA', 'p0rr4', 'm_e_r_d_a', 'caralho99', 'cu_123', 'porrrra'])
    assert.deepEqual(validateUsername(name), { ok: false, reason: 'USERNAME_INVALID' }, name);
});
test('tamanho e caracteres', () => {
  for (const name of ['ab', 'a'.repeat(17), 'nome com espaço', 'emoji😀']) assert.equal(validateUsername(name).ok, false, name);
});
test('avatar só de preset', () => {
  assert.equal(parseAvatar('preset:a07'), 'preset:a07');
  for (const v of ['preset:a13', 'https://x/y.png', '']) assert.equal(parseAvatar(v), null);
});
test('código de sala: 6 caracteres do alfabeto, sem 0/O/1/I', () => {
  const code = generateRoomCode(mulberry32(1));
  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  assert.equal(parseRoomCode(' abc234 '), 'ABC234');
  for (const v of ['ABC23', 'ABC2340', 'ABC23O', 42]) assert.equal(parseRoomCode(v), null);
});
test('configuração de partida', () => {
  const modes = { '8ball': { formats: ['1v1', '2v2'] }, '9ball': { formats: ['1v1'] } };
  assert.deepEqual(parseMatchConfig({ mode: '9ball', format: '1v1' }, modes), { mode: '9ball', format: '1v1' });
  for (const v of [{ mode: 'xyz', format: '1v1' }, { mode: '8ball', format: '2v2' }, { mode: '9ball', format: '2v2' }, null, '8ball']) assert.equal(parseMatchConfig(v, modes), null);
});
```

O `mulberry32` do teste é local: uma cópia de duas linhas do helper de `packages/modes/test/helpers.ts`, sem importar arquivo de teste de outro pacote.

Em `packages/modes/test/match.test.ts`, acrescente:

```ts
test('createInitialState não depende de structuredClone (o goja não tem)', () => {
  const saved = globalThis.structuredClone;
  // @ts-expect-error removed on purpose, as in the Nakama runtime
  delete globalThis.structuredClone;
  try { for (const mode of Object.values(MODES)) assert.ok(mode.createInitialState(config8, mulberry32(1))); }
  finally { globalThis.structuredClone = saved; }
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w packages/protocol && npm test -w packages/modes`
Expected: FAIL, porque `validateUsername` não existe e `createInitialState` lança `ReferenceError: structuredClone is not defined`.

- [ ] **Step 3: Implementar `username.ts` e `rooms.ts`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w packages/protocol && npm test -w packages/modes && npm run typecheck`
Expected: PASS. O protocol tem os 7 testes anteriores e 6 novos; o modes, os 51 anteriores e 1 novo.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol packages/modes
git commit -m "feat(protocol): validate usernames, avatars, room codes and match configs"
```

---

### Task 4: Contas e perfil (F3-02, F3-03)

**Files:**
- Create: `services/nakama/src/profile.ts`, `test/profile.test.ts`, `test/integration/bot.ts` e `test/integration/accounts.test.ts`.
- Modify: `services/nakama/src/registry.ts`.

**Interfaces:**
- Consumes: `validateUsername` e `parseAvatar` (Tarefa 3); `REGISTRY` (Tarefa 2).
- Produces:
  - Hooks `before` em `AuthenticateDevice`, `AuthenticateEmail` e `AuthenticateGoogle`. Se a requisição traz `username`, ele é validado e normalizado; um nome impróprio lança `USERNAME_INVALID`.
  - Hook `before` em `UpdateAccount`, que sempre recusa: o perfil só muda pela RPC.
  - RPC `profile_update`, com payload `{ username?: string, avatar?: string }`. Ela devolve `{ username, avatar }` e usa `nk.accountUpdateId`. Os erros são `USERNAME_INVALID`, `USERNAME_TAKEN` (quando o Nakama recusa por nome duplicado) e `AVATAR_INVALID`.
  - `test/integration/bot.ts` exporta `newBot(): Promise<Bot>`, com `Bot = { client, session, deviceId, socket(): Promise<Socket> }`. O `deviceId` é `randomUUID()`.

- [ ] **Step 1: Escrever os testes que falham**

Unitários com `nk` falso em `test/profile.test.ts`:
- `profile_update` normaliza e grava o nome;
- recusa nome impróprio sem chamar `accountUpdateId`;
- traduz o erro de nome duplicado para `USERNAME_TAKEN`;
- o hook de `UpdateAccount` recusa.

Integração em `test/integration/accounts.test.ts`:

```ts
test('convidado vincula e-mail e entra de novo com e-mail na mesma conta', async () => {
  const bot = await newBot();
  const email = `bot-${randomUUID()}@example.test`;
  await bot.client.linkEmail(bot.session, email, 'senha-de-teste-123');
  const again = await bot.client.authenticateEmail(email, 'senha-de-teste-123', false);
  assert.equal(again.user_id, bot.session.user_id);
});
test('o mesmo dispositivo volta para a mesma conta', async () => { /* authenticateDevice(bot.deviceId, true) → same user_id */ });
test('e-mail de outra conta não pode ser vinculado', async () => { /* bot2.linkEmail(email of bot1) rejects; bot1 still authenticates with it */ });
test('RPC recusa username impróprio', async () => { /* rpc profile_update { username: 'p0rr4' } → error USERNAME_INVALID; account unchanged */ });
test('username já usado devolve USERNAME_TAKEN', async () => { /* bot1 takes 'bot_<rand>'; bot2 tries it → USERNAME_TAKEN */ });
test('perfil de outro jogador é legível', async () => { /* bot1 sets username + preset:a03; bot2.getUsers([bot1 id]) shows both */ });
test('UpdateAccount nativo é recusado', async () => { /* client.updateAccount(session, { username: 'x_ok' }) rejects */ });
test('token do Google inválido é recusado', async () => { /* client.linkGoogle(session, 'not-a-token') rejects */ });
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w services/nakama`, depois `npm run infra:up && npm run test:integration -w services/nakama`.
Expected: os unitários falham porque `profile_update` não existe, e a integração falha nos testes de perfil.

- [ ] **Step 3: Implementar `profile.ts` e registrar no `REGISTRY`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w services/nakama && npm run infra:up && npm run test:integration -w services/nakama`
Expected: PASS em tudo.

- [ ] **Step 5: Commit**

```bash
git add services/nakama
git commit -m "feat(nakama): guest accounts, e-mail linking and validated profiles"
```

---

### Task 5: Sala privada com código de 6 caracteres (F3-04)

**Files:**
- Create: `services/nakama/src/match.ts`, `src/rooms.ts`, `test/match.test.ts`, `test/rooms.test.ts` e `test/integration/rooms.test.ts`.
- Modify: `services/nakama/src/registry.ts`, que registra o manipulador `billiards` e as RPCs.

**Interfaces:**
- Consumes: `parseMatchConfig(raw, MODES)`, `parseRoomCode` e `generateRoomCode` (Tarefa 3); `MODES` de `@billiards/modes`; `newBot` (Tarefa 4). O `services/nakama/package.json` ganha as dependências `@billiards/protocol` e `@billiards/modes` (`*`).
- Produces:
  - **Manipulador de partida `billiards`, só o saguão**, com `tickRate` 1:
    - `matchInit(params: { mode, format, code?: string, private: boolean })` produz o rótulo JSON `{ mode, format, code, private, open: true }` (`code` é `""` em partida pública) e o estado `{ mode, format, seats: 2, presences: {}, emptyTicks: 0 }`.
    - `matchJoinAttempt` recusa com `ROOM_FULL` quando os lugares já estão ocupados. Se o mesmo usuário entra de novo, a entrada é aceita e substitui a anterior.
    - `matchJoin` e `matchLeave` atualizam o estado. Quando a sala enche, o rótulo passa a `open: false`.
    - `matchLoop` termina a partida (devolve `null`) depois de 60 ticks seguidos sem ninguém.
    - `matchSignal` devolve `{ state, data: '' }`.
  - **RPC `create_private_match`**, com payload `{ mode, format }`. Ela devolve `{ matchId, code }`. Gera um código novo até não existir outra sala aberta com o mesmo código (no máximo 5 tentativas) e cria com `nk.matchCreate('billiards', { ...config, code, private: true })`.
  - **RPC `join_by_code`**, com payload `{ code }`. Ela devolve `{ matchId }` e usa `nk.matchList(10, true, null, null, null, '+label.code:<CODE>')`. Os erros são `CODE_INVALID`, `ROOM_NOT_FOUND` e `ROOM_FULL` (quando `open` é `false`).

- [ ] **Step 1: Escrever os testes que falham**

Unitários com `nk` e `dispatcher` falsos: entrada até lotar e `ROOM_FULL` depois; fim após 60 ticks vazio; código repetido gera outro; `join_by_code` em minúsculas acha a sala.

Integração:

```ts
test('bot A cria a sala; bot B entra pelo código', async () => {
  const a = await newBot(); const b = await newBot();
  const { matchId, code } = rpc(await a.client.rpc(a.session, 'create_private_match', { mode: '8ball', format: '1v1' }));
  const sa = await a.socket(); await sa.joinMatch(matchId);
  const found = rpc(await b.client.rpc(b.session, 'join_by_code', { code: ` ${code.toLowerCase()} ` }));
  assert.equal(found.matchId, matchId);
  const sb = await b.socket(); const joined = await sb.joinMatch(found.matchId);
  assert.equal(joined.presences.length + 1, 2);   // B sees A, plus itself
});
test('terceiro bot recebe ROOM_FULL', async () => { /* … */ });
test('código inexistente dá ROOM_NOT_FOUND e código malformado dá CODE_INVALID', async () => { /* … */ });
test('modo ou formato inválido dá MODE_INVALID', async () => { /* { mode: 'xyz' } and { mode: '8ball', format: '2v2' } */ });
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w services/nakama`
Expected: FAIL, porque o manipulador e as RPCs não existem.

- [ ] **Step 3: Implementar `match.ts` e `rooms.ts`, e registrar**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -w services/nakama && npm run infra:up && npm run test:integration -w services/nakama`
Expected: PASS em tudo.

- [ ] **Step 5: Commit**

```bash
git add services/nakama
git commit -m "feat(nakama): private rooms joined by a 6-character code"
```

---

### Task 6: Matchmaking 1×1 (F3-05)

**Files:**
- Create: `services/nakama/src/matchmaker.ts`, `test/matchmaker.test.ts` e `test/integration/matchmaking.test.ts`.
- Modify: `services/nakama/src/registry.ts`.

**Interfaces:**
- Consumes: o manipulador `billiards` (Tarefa 5); `parseMatchConfig(raw, MODES)` (Tarefa 3).
- Produces:
  - **Hook `matchmakerMatched(ctx, logger, nk, matches)`:**
    - lê `properties.mode` e `properties.format` de cada entrada;
    - se as propriedades de todas as entradas forem iguais e `parseMatchConfig` as aceitar, cria `nk.matchCreate('billiards', { mode, format, private: false })` e devolve o `matchId`;
    - senão, devolve `undefined` e registra um aviso no log (não cria partida).
  - **Bilhete que o cliente deve mandar**, documentado em `docs/f3/servidor-local.md`: `socket.addMatchmaker('+properties.mode:<mode> +properties.format:1v1', 2, 2, { mode, format: '1v1' })`.

- [ ] **Step 1: Escrever os testes que falham**

Unitários: propriedades iguais e válidas criam a partida; propriedades misturadas ou forjadas devolvem `undefined` sem chamar `matchCreate`.

Integração:

```ts
test('dois bots na fila formam uma partida', async () => {
  const [a, b] = await Promise.all([newBot(), newBot()]);
  const [sa, sb] = await Promise.all([a.socket(), b.socket()]);
  const matched = Promise.all([once(sa, 'onmatchmakermatched'), once(sb, 'onmatchmakermatched')]);
  await Promise.all([sa, sb].map(s => s.addMatchmaker('+properties.mode:8ball +properties.format:1v1', 2, 2, { mode: '8ball', format: '1v1' })));
  const [ma, mb] = await withTimeout(matched, 15000);
  assert.ok(ma.match_id); assert.equal(ma.match_id, mb.match_id);
  await sa.joinMatch(ma.match_id); const jb = await sb.joinMatch(mb.match_id);
  assert.equal(jb.presences.length + 1, 2);
});
test('8-ball e 9-ball não se misturam', async () => { /* one 8ball and one 9ball ticket: no matched event in 5 s; then a second 9ball bot matches the 9ball one */ });
```

`once(socket, 'onmatchmakermatched')` é um helper do `bot.ts`: instala o callback e resolve com o primeiro evento. `withTimeout` também fica no `bot.ts` e rejeita com o nome do evento esperado.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -w services/nakama && npm run infra:up && npm run test:integration -w services/nakama`
Expected: os unitários falham porque `matchmakerMatched` não existe. Na integração, o evento chega sem `match_id`: sem o hook, o Nakama manda só o token de partida relayed.

- [ ] **Step 3: Implementar `matchmaker.ts` e registrar**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: o mesmo do Step 2.
Expected: PASS em tudo.

- [ ] **Step 5: Commit**

```bash
git add services/nakama
git commit -m "feat(nakama): 1v1 matchmaking creates an authoritative billiards match"
```

---

### Task 7: Integração na CI

**Files:**
- Create: `.github/workflows/integration.yml`.

**Interfaces:**
- Consumes: `npm run infra:up`, `npm run test:integration -w services/nakama` e `npm run infra:down` (Tarefas 1 a 6).

- [ ] **Step 1: Escrever o workflow**

O workflow roda em `push` para `claude/**` e em `pull_request` para `main`, num runner `ubuntu-latest`. Os passos são:
1. `actions/checkout@v4`;
2. `actions/setup-node@v4`, com `node-version: 22.12` e cache do npm;
3. `npm ci`;
4. `cp infra/.env.example infra/.env`;
5. `npm run infra:up`;
6. `npm test -w services/nakama`;
7. `npm run test:integration -w services/nakama`;
8. em caso de falha, `docker compose -f infra/docker-compose.yml logs nakama`;
9. sempre, `npm run infra:down`.

O workflow não usa segredos: só os valores de desenvolvimento do `.env.example`.

- [ ] **Step 2: Conferir o workflow localmente**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/integration.yml','utf8'); for (const s of ['infra:up','test:integration','infra:down','ubuntu-latest']) if(!y.includes(s)) throw new Error(s)"`
Expected: sai sem erro.

- [ ] **Step 3: Commit e push; conferir a execução**

```bash
git add .github/workflows/integration.yml
git commit -m "ci: run the Nakama integration tests on every push to the work branch"
git push -u origin claude/planejamento-online
```

Depois do push, confira o resultado da execução com `gh run list --workflow integration.yml --limit 1` e, se falhar, com `gh run view --log-failed`.
Expected: `completed success`.

---

### Task 8: Fechamento da F3

**Files:**
- Create: `docs/f3/servidor-local.md`, em PT-BR. Ele descreve:
  - os requisitos (Docker);
  - `npm run infra:up` e `infra:down`;
  - como rodar os testes de integração e o console em `http://127.0.0.1:7351`;
  - os códigos de erro das RPCs;
  - o bilhete de matchmaking;
  - onde ficam os segredos de produção (variáveis de ambiente na VPS, D049).
- Modify:
  - `harness/feature_list.json` (F3-01 a F3-05), `harness/progress.md` e `harness/init.sh`. No `init.sh`, `services/nakama` entra nas suítes rápidas só com o `test` unitário;
  - `docs/superpowers/plans/2026-10-24-roteiro.md`;
  - `CLAUDE.md`, com os comandos `infra:up`, `infra:down`, `test:integration` e o aviso de que a integração precisa do Docker.

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm test && npm run typecheck && bash harness/init.sh`. A integração roda onde houver Docker (nuvem ou CI): `npm run infra:up && npm run test:integration -w services/nakama && npm run infra:down`.
Expected: tudo verde. O resultado da integração, com o link ou o id da execução, é anotado no `progress.md`.

- [ ] **Step 2: Marcar os itens e atualizar o harness**

Marque cada item só se a verificação dele rodou e passou numa execução da integração (D051):

| Item | Teste |
|------|-------|
| F3-01 | `o Nakama responde ao healthcheck em até 60 s` |
| F3-02 | `convidado vincula e-mail e entra de novo com e-mail na mesma conta` |
| F3-03 | `RPC recusa username impróprio` e `perfil de outro jogador é legível` |
| F3-04 | `bot A cria a sala; bot B entra pelo código` |
| F3-05 | `dois bots na fila formam uma partida` |

Se a integração não pôde rodar em lugar nenhum, os itens continuam `false`, e o `progress.md` diz por quê.

- [ ] **Step 3: Commit e push**

```bash
git add docs harness CLAUDE.md
git commit -m "docs(f3): close phase F3 and update roadmap and harness"
git push -u origin claude/planejamento-online
```
