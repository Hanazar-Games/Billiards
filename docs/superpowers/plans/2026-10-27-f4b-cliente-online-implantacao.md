# F4-B — Partida online 1×1: o cliente e a implantação — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dois navegadores jogam uma partida online 1×1 completa contra o servidor autoritativo da F4-A. Para isso:
- o cliente entra como convidado, acha o adversário pela fila ou por uma sala privada e reproduz as tacadas que o servidor decide;
- o servidor roda numa máquina pública com TLS;
- as APIs nativas do Nakama que o jogo não usa ficam fechadas (D053).

**Architecture:**
- **`OnlineMatchController`:** fala com o servidor pelo `OnlineSession` (`@heroiclabs/nakama-js`) e entrega ao `Game` a mesma forma do `LocalMatchController`, `{ initial, result, ruling }`, para a tacada local. Também emite eventos para o que vem do servidor sem pedido do jogador: a tacada do adversário, o tempo esgotado, o snapshot da volta e o fim.
- **`Game`:** ganha um caminho `online` que reproduz esses eventos pelo mesmo `TrajectoryPlayer`. No fim de cada tacada, aplica a mesa oficial do servidor.
- **Telas novas:** em PT-BR, num painel só.
- **Produção:** um compose de sobreposição com o Caddy na frente do Nakama (TLS automático). O cliente segue no GitHub Pages, gerado com o endereço do servidor.

**Tech Stack:**
- `@heroiclabs/nakama-js` 2.8.0, agora também no cliente;
- Vite 6, Three.js e Puppeteer 25 (com dois contextos de navegador nos testes);
- `node:test`;
- Nakama 3.41.0, PostgreSQL 16 e Caddy 2, em Docker Compose;
- GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-10-24-billiards-online-design.md`](../specs/2026-10-24-billiards-online-design.md):
- §5.1 (proxy TLS em `infra/`), §5.3 (`OnlineMatchController`) e §5.4 (hospedagem);
- §6.3 (versões);
- §7.3 a §7.5 (cronômetro, reconexão, fila e salas);
- §9.1 e §9.2 (erros e segurança), §9.4 (operação) e §10 (marco vertical da F4).

O contrato com o servidor está em [`docs/protocol.md`](../../protocol.md), que é a referência para cada mensagem, campo e prazo. Base: o plano da F4-A ([`2026-10-26-f4a-partida-online-servidor.md`](2026-10-26-f4a-partida-online-servidor.md)) e as decisões D049, D053, D054 e D062.

## Decisões que este plano propõe

Registradas em `harness/decisions.json` com `status: "open"` junto com este plano. A Tarefa 1 as marca como `accepted` quando o plano for aprovado, e a D053 passa a `superseded` pela D064.

| Id | Decisão | Por quê |
|----|---------|---------|
| **D063** | **Forma do cliente online:** | A spec pede que os dois controladores entreguem ao `Game` a mesma coisa (§5.3). A diferença do online é o que chega sem pedido: a tacada do adversário, o tempo esgotado e a volta. |
| | `OnlineMatchController` com a mesma interface do `LocalMatchController`, mais eventos para o que o servidor manda sem pedido. | |
| | O `Game` aplica a mesa oficial (`table` do `shot_result`) no fim de cada tacada online e não repõe bolas por conta própria. | |
| | O endereço do servidor vem de `VITE_NAKAMA_URL` e a chave de `VITE_NAKAMA_SERVER_KEY`. Sem endereço, o build de produção mostra o online como indisponível. | |
| | O cliente reconecta sozinho durante os 60 s da reserva e guarda o `matchId` para voltar à partida depois de recarregar a página. | |
| | Fila e sala para 8-ball e 9-ball, porque o servidor já cobre o push-out. | |
| | As telas novas ficam em PT-BR. O LAN continua como está até a F5, que o remove (§5.3) junto com a revisão das telas. | |
| **D064** | **Fecha a D053.** Ficam abertas só as APIs nativas que o jogo usa: | Cada API aberta é uma porta para contornar as regras do servidor (§9.2). Fechar por hook é barato e reabrir é uma linha, quando uma fase precisar (grupos na F7, compras na F8). |
| | autenticação por dispositivo, e-mail e Google (já validadas); | |
| | `SessionRefresh`, `SessionLogout`, `GetAccount` e `GetUsers`; | |
| | vínculo e desvínculo de dispositivo, e-mail e Google; | |
| | as RPCs; | |
| | `ReadStorageObjects` e `ListStorageObjects` (o histórico é de leitura pública); | |
| | `ListNotifications` e `DeleteNotifications`; | |
| | no socket, a fila (`MatchmakerAdd`, `MatchmakerRemove`) e a partida (`MatchJoin`, `MatchLeave`, `MatchDataSend`). | |
| | Fecha o resto: escrita e remoção no armazenamento, amigos, grupos, canais de chat e mensagens diretas, status, grupos de fila (`Party*`), partidas criadas pelo cliente (`MatchCreate`), placares e torneios, validação de compras, exclusão nativa de conta (a LGPD vem por RPC, §8.1) e o vínculo de métodos de autenticação sem validação de nome. | |
| **D065** | **Implantação:** | O Caddy obtém e renova o certificado sozinho, e o mesmo compose roda em qualquer máquina com Docker e um domínio. As chaves só com letras, números, `_` e `-` resolvem a expansão do `SIM_SECRET` pelo Compose e pelo shell, um ponto aberto da F4-A. |
| | `infra/docker-compose.prod.yml` sobrepõe o compose de desenvolvimento e acrescenta o Caddy (`caddy:2.10.0-alpine`) nas portas 80 e 443, que encaminha o domínio para `nakama:7350`. | |
| | O Nakama não publica portas, a não ser o console em `127.0.0.1:7351`, acessado por túnel SSH. O PostgreSQL e o `sim` também não publicam portas. | |
| | Os segredos ficam no `infra/.env` da máquina. Cada um tem de casar com `^[A-Za-z0-9_-]{24,}$`, e o `infra/check-env.mjs` recusa o resto antes de subir. | |
| | O cliente segue no GitHub Pages, gerado com as variáveis do repositório `NAKAMA_URL` e `NAKAMA_SERVER_KEY`. | |
| | A máquina e o domínio são do usuário. | |
| | Alternativa, se o usuário preferir: o `server` da rede atrás de um Cloudflare Tunnel, que entrega o TLS e dispensa portas abertas. Nesse caso, o Caddy sai. | |
| **D066** | **CI do cliente online:** | Hoje o `deploy.yml` roda o `npm test` com o Node 22, que não executa os testes `.ts`. Ao fazer o merge na `main`, a publicação quebraria. O caminho `/Billiards/` vem do repositório original. A partida entre dois navegadores precisa do Nakama e do Chrome juntos, e isso só existe no job de integração. |
| | O `deploy.yml` passa para o Node 24, e o caminho base do Pages vem do nome do repositório (`/${{ github.event.repository.name }}/`). | |
| | O teste com dois navegadores (`test:online`) roda no job de integração, que passa a instalar o Chrome e ganha `timeout-minutes: 35`. | |
| | O `npm test` da raiz continua sem Docker. | |

## Itens novos em `harness/feature_list.json`

A Tarefa 1 os acrescenta com `passes: false`.

| Item | Descrição | Verificação |
|------|-----------|-------------|
| F4-08 | Cliente online: entrada como convidado, fila 1×1 e sala privada pelo código | `a fila junta os dois navegadores numa partida de 9-ball`, `PROTOCOL_MISMATCH pede para atualizar a página` |
| F4-09 | `OnlineMatchController` e `Game`: tacadas decididas pelo servidor | `a tacada do adversário é reproduzida e a mesa termina na oficial`, `a tacada local só se move quando o servidor responde` |
| F4-10 | Dois navegadores jogam uma partida online 1×1 completa (marco da F4) | `dois navegadores jogam uma partida online inteira de 8-ball` |
| F4-11 | Reconexão no cliente | `queda no meio da reprodução: o navegador volta e termina no mesmo estado`, `recarregar a página no meio da partida volta para a mesma partida` |
| F4-12 | APIs nativas fora do uso do jogo recusadas (D064) | `APIs nativas fora do uso do jogo são recusadas` |
| F4-13 | Servidor de produção com TLS | `o Nakama de produção responde por HTTPS e WSS` (a integração e o `test:online` contra o domínio de produção) |

## Global Constraints

- **Versões:**
  - `@heroiclabs/nakama-js` 2.8.0 no cliente, a mesma dos bots;
  - Caddy `caddy:2.10.0-alpine`. Antes de fixar, confira que a tag existe (`docker manifest inspect`) e registre uma ruling se precisar de outra.
  - O resto continua como está: Nakama 3.41.0, `postgres:16-alpine`, `node:24-alpine` e Node 24.
- **Protocolo:** o fio é o protocolo v1 de `docs/protocol.md`, sem mudança. O cliente manda `protocolVersion: '1'` ao entrar. Num `PROTOCOL_MISMATCH`, pede para recarregar a página (§6.3), sem tentar de novo.
- **Ritmo do cliente:**
  - `aim_update` e `ball_in_hand_move`: no máximo 10 por segundo cada (o servidor aceita 15);
  - as outras mensagens: no máximo 1 por ação do jogador (o servidor aceita 5 por segundo e descarta o excesso sem resposta).
- **Tempo:**
  - o cronômetro mostrado vem do `deadlineInMs` do servidor, menos 500 ms de margem pela latência;
  - o cliente nunca decide um tempo esgotado online;
  - a reserva de reconexão é de 60 s.
- **Mesa:** online, o fim de cada tacada (a do jogador, a do adversário, a da volta) termina com a `table` oficial aplicada, e o `Game` não repõe bolas sozinho.
- **Cliente:**
  - JavaScript ES2022 com módulos, no estilo do arquivo editado. Textos novos da interface em PT-BR;
  - os modos offline (contra a IA, 2 jogadores, treino, LAN) não mudam de comportamento: as suítes atuais continuam verdes;
  - a IA nunca joga online.
- **Segredos:** nada real no repositório. O `infra/.env.production.example` traz só marcadores, e os segredos casam com `^[A-Za-z0-9_-]{24,}$`. A chave do servidor do cliente (`VITE_NAKAMA_SERVER_KEY`) é configuração pública do Nakama, não segredo, e vai numa variável do repositório.
- **Testes:**
  - o `npm test` da raiz não depende do Docker nem do servidor;
  - os testes com servidor (`test:integration`, `test:online`) rodam no job de integração, no `server` da rede e contra a produção;
  - `NAKAMA_URL` (URL completa, por exemplo `https://api.exemplo.com`) aponta os dois para outra máquina, e `NAKAMA_HOST`/`NAKAMA_PORT` continuam valendo;
  - os itens F4-08 a F4-13 só são marcados depois de uma execução verde registrada no `progress.md`.
- **Idioma e commits:** documentos em PT-BR; código e commits em inglês (conventional commits). Commit e push na branch de trabalho ao fim de cada interação (D028).

## Review Focus

1. **Resultado do servidor no meio de uma ação local:**
   - Um `shot_result` de tempo esgotado chega enquanto o jogador carrega a tacada ou arrasta a bola na mão: a ação local é cancelada, a vez passa e a mesa fica a oficial.
   - Um `shot_request` que saiu no mesmo instante recebe `NOT_YOUR_TURN`, e o cliente o descarta sem mensagem de erro.
   - Teste na Tarefa 5.
2. **Queda com a tacada própria em trânsito:**
   - Na volta, se o snapshot traz a reprodução dessa tacada, ela é usada.
   - Se o `turnId` não mudou, o mesmo `(turnId, seq)` é reenviado.
   - Senão, a mesa do snapshot vale.
   - Nunca sai uma segunda tacada.
   - Teste na Tarefa 4.
3. **Página recarregada no meio da partida:**
   - O painel online volta para a mesma partida pelo `matchId` guardado.
   - Uma partida que já acabou (`MATCH_ENDED`) apaga o `matchId` e mostra o menu, sem laço de tentativas.
   - Testes nas Tarefas 6 e 8.
4. **Servidor atualizado (`PROTOCOL_MISMATCH`):** a mensagem pede para recarregar a página, e nada tenta entrar de novo. Testes nas Tarefas 3 e 6.
5. **Build de produção sem servidor configurado, ou servidor fora do ar:**
   - O botão online mostra "indisponível".
   - O jogo offline não ganha erro no console.
   - A conexão que cai sem volta em 60 s leva ao menu com aviso.
   - Testes nas Tarefas 1, 6 e 3.

## Fora do escopo da F4-B

- Remover o LAN e traduzir as telas antigas (F5, D063).
- Espectadores, 2×2 e grupos na fila (F7).
- Emotes e revanche (as operações 4 e 6 continuam reservadas).
- Vínculo de e-mail e Google na interface. O servidor já aceita desde a F3, e as telas vêm na F5 ou na F8, quando comprar exigir conta vinculada (§8.1).
- Loadout e cosméticos (F6).
- Teste de carga e métricas Prometheus do `sim` (F9).
- Os menores adiados da F4-A (`progress.md`).

## Estrutura de arquivos

```
apps/client/src/online/config.js            onlineConfig(env): endereço, porta, TLS e chave, ou null
apps/client/src/online/OnlineSession.js      nakama-js: dispositivo, RPCs, fila, socket, entrar na partida, reconexão
apps/client/src/match/OnlineMatchController.js  a partida online com a interface do LocalMatchController, mais eventos
apps/client/src/match/matchStatus.js         status() comum aos dois controladores (sai do LocalMatchController)
apps/client/src/menu/OnlinePanel.js          entrada, fila, sala e volta à partida
apps/client/src/dev/FakeOnlineController.js  controlador falso só para os testes de navegador
apps/client/test/online-*.test.js            testes do Node (config, sessão, controlador, painel) e do navegador
services/nakama/src/nativeApis.ts            D064: listas de APIs fechadas e o hook que recusa
infra/docker-compose.prod.yml, infra/Caddyfile, infra/.env.production.example, infra/check-env.mjs, infra/gen-secrets.mjs
docs/f4/implantacao.md                       passo a passo da produção (PT-BR)
```

---

### Task 1: Base: decisões, itens, CI e configuração do cliente

**Files:**
- Create:
  - `apps/client/src/online/config.js`;
  - `apps/client/test/online-config.test.js`.
- Modify:
  - `harness/decisions.json` (D063 a D066 `accepted`; D053 `superseded` pela D064);
  - `harness/feature_list.json` (F4-08 a F4-13 com `passes: false`);
  - `.github/workflows/deploy.yml`: Node 24 e o caminho base pelo nome do repositório (D066);
  - `apps/client/package.json`: dependência `@heroiclabs/nakama-js` 2.8.0, mais o script `test:online-unit` com os testes do Node da F4-B, incluído no `test` do cliente antes das suítes de navegador;
  - `package-lock.json`.

**Interfaces:**
- Produces: `onlineConfig(env = import.meta.env): { host: string; port: string; useSSL: boolean; serverKey: string; url: string } | null`.
  - A URL vem de `VITE_NAKAMA_URL`.
  - Em `env.DEV`, a URL padrão é `http://127.0.0.1:7350` e a chave padrão `defaultkey`. Fora dele, sem URL, devolve `null`.
  - A porta padrão é 443 com `https` e 80 com `http`.
  - Uma URL inválida também dá `null`, com um `console.warn` só.

- [ ] **Step 1: Escrever os testes que falham**

```js
test('URL https sem porta usa 443 e TLS', () => {
  assert.deepEqual(onlineConfig({ VITE_NAKAMA_URL: 'https://api.exemplo.com', VITE_NAKAMA_SERVER_KEY: 'k' }),
    { host: 'api.exemplo.com', port: '443', useSSL: true, serverKey: 'k', url: 'https://api.exemplo.com' });
});
test('em desenvolvimento, sem URL, aponta para o Nakama local', () => { /* DEV: true → 127.0.0.1, 7350, useSSL false, defaultkey */ });
test('em produção, sem URL, o online fica indisponível', () => { /* DEV false, no URL → null */ });
test('URL inválida dá null', () => { /* 'nada' → null */ });
```

- [ ] **Step 2: Rodar e confirmar a falha.** Run: `npm run test:online-unit -w apps/client`. Expected: FAIL, porque `config.js` não existe.

- [ ] **Step 3: Implementar `config.js`, ajustar o `deploy.yml` e registrar as decisões e os itens**

No `deploy.yml`:
- `node-version: 24`;
- `PAGES_BASE_PATH: /${{ github.event.repository.name }}/`;
- `VITE_NAKAMA_URL: ${{ vars.NAKAMA_URL }}` e `VITE_NAKAMA_SERVER_KEY: ${{ vars.NAKAMA_SERVER_KEY }}` no passo do build.

- [ ] **Step 4: Rodar e confirmar que passa.** Run: `npm run test:online-unit -w apps/client && npm run build`. Expected: PASS, e o build sai sem `VITE_NAKAMA_URL`.

- [ ] **Step 5: Commit**

```bash
git add apps/client harness .github/workflows/deploy.yml package-lock.json
git commit -m "feat(client): online server configuration and the F4-B decisions"
```

---

### Task 2: APIs nativas fechadas (D064, F4-12)

**Files:**
- Create:
  - `services/nakama/src/nativeApis.ts`;
  - `services/nakama/test/native-apis.test.ts`;
  - `services/nakama/test/integration/native-apis.test.ts`.
- Modify:
  - `services/nakama/src/registry.ts`: o registro ganha `rtBefore`;
  - `services/nakama/src/nakama.ts`: os tipos de `registerRtBefore` e do hook de tempo real;
  - `services/nakama/build.mjs`: a cola registra cada `rtBefore` com `initializer.registerRtBefore(id, fn)`, por uma função global, como os outros (D050);
  - `services/nakama/test/bundle.test.ts`.

**Interfaces:**
- Produces:
  - `CLOSED_NATIVE_APIS: readonly string[]`: os ids de `registerBefore<Id>` fechados, conforme a D064. O ponto de partida é este, e cada nome tem de existir no runtime 3.41:
    - `WriteStorageObjects`, `DeleteStorageObjects`;
    - `AddFriends`, `BlockFriends`, `DeleteFriends`, `ImportFacebookFriends`, `ImportSteamFriends`;
    - `CreateGroup`, `UpdateGroup`, `DeleteGroup`, `JoinGroup`, `LeaveGroup`, `AddGroupUsers`, `KickGroupUsers`, `BanGroupUsers`, `PromoteGroupUsers`, `DemoteGroupUsers`;
    - `WriteLeaderboardRecord`, `DeleteLeaderboardRecord`, `WriteTournamentRecord`, `DeleteTournamentRecord`, `JoinTournament`;
    - `ValidatePurchaseApple`, `ValidatePurchaseGoogle`, `ValidatePurchaseHuawei`, `ValidatePurchaseFacebookInstant`, `ValidateSubscriptionApple`, `ValidateSubscriptionGoogle`;
    - `DeleteAccount`;
    - `LinkCustom`, `LinkFacebook`, `LinkFacebookInstantGame`, `LinkGameCenter`, `LinkApple`, `LinkSteam`.
  - `CLOSED_RT_APIS: readonly string[]`:
    - `MatchCreate`;
    - `ChannelJoin`, `ChannelMessageSend`, `ChannelMessageUpdate`, `ChannelMessageRemove`;
    - `StatusFollow`, `StatusUpdate`;
    - `PartyCreate`, `PartyJoin`.
  - `beforeNativeApiClosed(ctx, logger, nk, data): null`: recusa e registra um `logger.debug` com o id e o `userId`.
  - **Nome que não existe no 3.41:** se a carga do módulo falhar com `registerBeforeX is not a function` (a integração mostra), tire o nome da lista com uma ruling. Não deixe o módulo sem carregar.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// unit (fake initializer)
test('cada API nativa fechada está registrada com o hook que recusa', () => {
  // build the bundle, run InitModule with a fake initializer: every id in CLOSED_NATIVE_APIS reached registerBefore<Id>,
  // every id in CLOSED_RT_APIS reached registerRtBefore(id, fn); calling the hook returns null
});
test('as APIs que o jogo usa continuam abertas', () => { /* AuthenticateDevice still the validating hook; no hook on ReadStorageObjects, MatchmakerAdd, MatchDataSend */ });

// integration
test('APIs nativas fora do uso do jogo são recusadas', async () => {
  // one bot: writeStorageObjects, createGroup, addFriends, linkCustom, writeLeaderboardRecord → rejected;
  // socket.joinChat('sala', 1, false, false) and socket.createMatch() → rejected;
  // readStorageObjects of a match_history key (without user_id) and getUsers still work
});
```

- [ ] **Step 2: Rodar e confirmar a falha.** Run: `npm test -w services/nakama`. Expected: FAIL, porque `nativeApis.ts` não existe.

- [ ] **Step 3: Implementar as listas, o hook, o `rtBefore` no registro e a cola**

- [ ] **Step 4: Rodar e confirmar que passa.** Run: `npm test -w services/nakama && npm run typecheck`. Depois, push e a integração na CI. Expected: PASS, e os testes da F3 e da F4-A continuam verdes.

- [ ] **Step 5: Commit e push; conferir a CI**

```bash
git add services/nakama
git commit -m "feat(nakama): close the native APIs the game does not use (D064)"
git push -u origin claude/planejamento-online
```

---

### Task 3: `OnlineSession`: conta, fila, sala e socket

**Files:**
- Create:
  - `apps/client/src/online/OnlineSession.js`;
  - `apps/client/test/online-session.test.js` (Node, com cliente e socket falsos).
- Modify: o script `test:online-unit`.

**Interfaces:**
- Consumes:
  - `onlineConfig` (Tarefa 1);
  - `PROTOCOL_VERSION`, `OP` e `decodeEnvelope` (`@billiards/protocol`);
  - `Client` (`@heroiclabs/nakama-js`). A forma das chamadas é a dos bots em `services/nakama/test/integration/bot.ts` e `game.ts`.
- Produces: `class OnlineSession extends EventTarget`.
  - **Construtor:** `constructor({ config, storage = localStorage, createClient = (c) => new Client(c.serverKey, c.host, c.port, c.useSSL), setTimer = setTimeout, clearTimer = clearTimeout })`.
  - **`start(): Promise<{ userId, username }>`:**
    - o id do dispositivo fica em `storage['billiards.online.deviceId']` (`crypto.randomUUID()` na primeira vez);
    - entra com `authenticateDevice(id, true)` e conecta o socket;
    - renova a sessão com `sessionRefresh` quando faltar menos de 60 s para ela expirar.
  - **`setUsername(name): Promise<string>`:** a RPC `profile_update`.
  - **`createRoom(mode): Promise<{ matchId, code }>`** e **`joinByCode(code): Promise<string>`.** O `joinByCode` tenta de novo um `ROOM_NOT_FOUND` por até 3 s, por causa do atraso de indexação da sala recém-criada (`docs/f3/servidor-local.md`).
  - **`queue(mode): Promise<string>`:** `addMatchmaker('+properties.mode:<mode> +properties.format:1v1', 2, 2, { mode, format: '1v1' })`. Resolve com o `match_id` do `onmatchmakermatched`.
  - **`cancelQueue(): Promise<void>`.**
  - **`joinMatch(matchId): Promise<void>`:**
    - manda o metadado `{ protocolVersion: String(PROTOCOL_VERSION) }`;
    - guarda o id em `storage['billiards.online.matchId']`.
  - **`leaveMatch(): Promise<void>`** e **`forgetMatch(): void`**, que apaga o id guardado.
  - **`storedMatchId(): string | null`.**
  - **`send(op: number, body?: object): void`:** manda JSON. Sem corpo, manda `''`.
  - **`dropConnection(): void`** (para os testes): fecha o socket como uma queda de rede, e a reconexão entra em ação.
  - **`close(): void`.**
  - **Evento `message`, com `detail { op, header?, payload?, body? }`:** as operações 101 e 105 chegam pelo `decodeEnvelope`, e as outras por `JSON.parse`. Uma mensagem malformada é descartada com um `console.warn`.
  - **Evento `connection`, com `detail { state: 'online' | 'reconnecting' | 'offline' | 'replaced' }`:**
    - numa queda que o cliente não pediu, tenta reconectar o socket e entrar de novo na partida guardada depois de 1, 2, 4, 8, 8… s;
    - passados 60 s, desiste e emite `offline`;
    - quando o servidor tira esta conexão da partida (`onmatchpresence` com a própria presença em `leaves`, como na segunda aba), emite `replaced` e não tenta entrar de novo. Sem isso, duas abas se derrubariam uma à outra sem fim.
  - **`OnlineError extends Error` com `code`:** o `message` do servidor quando é um código conhecido (`USERNAME_TAKEN`, `ROOM_NOT_FOUND`, `PROTOCOL_MISMATCH`, `MATCH_ENDED`…), ou `NETWORK`.
    - `PROTOCOL_MISMATCH` e `MATCH_ENDED` não são tentados de novo.
    - `MATCH_ENDED` também apaga o id guardado.

- [ ] **Step 1: Escrever os testes que falham**

```js
test('o id do dispositivo é criado uma vez e reaproveitado', async () => { /* two start() with the same storage → same id passed to authenticateDevice */ });
test('entrar na partida manda protocolVersion e guarda o matchId', async () => { /* joinMatch metadata { protocolVersion: '1' }; storedMatchId() */ });
test('PROTOCOL_MISMATCH vira OnlineError e não é tentado de novo', async () => { /* joinMatch rejects once → OnlineError code PROTOCOL_MISMATCH; joinMatch called once */ });
test('MATCH_ENDED apaga o matchId guardado', async () => { /* … */ });
test('sala recém-criada: ROOM_NOT_FOUND é tentado de novo por até 3 s', async () => { /* fake rpc: 2× ROOM_NOT_FOUND then ok */ });
test('mensagens 101 e 105 chegam decodificadas; as outras em JSON', async () => { /* fake socket onmatchdata with encodeEnvelope bytes and JSON bytes */ });
test('queda: reconecta e entra de novo na partida; depois de 60 s emite offline', async () => {
  // fake timers: connect fails until t = 7 s → events reconnecting, online; joinMatch called again with the stored id.
  // a second scenario never reconnects → offline after the attempt that crosses 60 s
});
test('sessão perto de expirar é renovada antes de reconectar', async () => { /* … */ });
test('tirada da partida por outra aba: emite replaced e não entra de novo', async () => { /* own presence in leaves → replaced; joinMatch not called again */ });
```

- [ ] **Step 2: Rodar e confirmar a falha.** Run: `npm run test:online-unit -w apps/client`. Expected: FAIL.

- [ ] **Step 3: Implementar o `OnlineSession`**

- [ ] **Step 4: Rodar e confirmar que passa.** Run: o mesmo. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client
git commit -m "feat(client): online session over nakama-js with reconnection"
```

---

### Task 4: `OnlineMatchController` (F4-09)

**Files:**
- Create:
  - `apps/client/src/match/OnlineMatchController.js`;
  - `apps/client/src/match/matchStatus.js`;
  - `apps/client/test/online-match-controller.test.js` (Node, com sessão falsa).
- Modify: `apps/client/src/match/LocalMatchController.js`, cujo `status()` passa a usar o `matchStatus`, com o mesmo resultado.

**Interfaces:**
- Consumes:
  - `OnlineSession` (Tarefa 3);
  - `MODES` e `placeCueBall` (`@billiards/modes`);
  - `OP` e `decodeTrajectory` (`@billiards/protocol`).
- Produces:
  - **`matchStatus(modeId, match): object | null`:** a forma atual do `LocalMatchController.status()`, sem mudança.
  - **`class OnlineMatchController extends EventTarget`:**
    - **Construtor:** `constructor({ session, matchId, modeId, tableProfile, now = Date.now })`.
    - **Estado vindo do servidor:** `matchId`, `modeId`, `mode`, `match`, `table` (a mesa oficial), `localSeat`, `seats`, `turn: { seat, turnId, deadlineAt } | null` (`deadlineAt = now() + deadlineInMs`) e `end`. Mais `online = true`.
    - **Mesma interface do `LocalMatchController`:**
      - `seat`;
      - `status()`, igual a `matchStatus(modeId, match)`;
      - `newRack()` devolve as posições da `table` oficial, para o `Game.init` montar a mesa sem mudar;
      - `submitShot(table, shot)`;
      - `choosePushOut(accept)` manda a operação 7 e devolve `undefined`;
      - `concede()` manda a operação 5;
      - `dispose()` solta os ouvintes e não sai da partida.
    - **`timeout()`:** lança erro, porque online o tempo é do servidor.
    - **`submitShot(table, shot): Promise<{ initial, result, ruling, table }>`:**
      - manda a operação 2 com `{ turnId: this.turn.turnId, seq: ++this._seq, angle, power, spin, cueBall?, pushOut? }`;
      - resolve com o 105 de `kind: 'shot'` do mesmo `(turnId, seq)`: `result = { frames: decodeTrajectory(payload), events, final, simSeconds: durationMs / 1000, capped }`, `initial = shot.cueBall ? placeCueBall(table, shot.cueBall) : table` e `table` = a mesa oficial;
      - rejeita com `{ rejected: true, reason }` num 104 do mesmo `seq`, e com `{ stale: true }` quando um snapshot ou outro resultado passa na frente.
    - **`whenReady(): Promise<void>`:** resolve no primeiro snapshot.
    - **`deadlineMs(): number | null`:** o tempo que resta, menos 500 ms.
    - **Eventos (`detail`):**
      - `snapshot` `{ header, playback: { initial, result, ruling, table, offsetMs } | null }`;
      - `remoteShot` `{ initial, result, ruling, table, seat }`, para um 105 de tacada que não responde a um pedido pendente deste cliente;
      - `timeout` `{ ruling, table }` e `choice` `{ ruling, table }`;
      - `seat` `{ seat, connected }`;
      - `aim` e `ballInHand` (Tarefa 7);
      - `end` `{ winnerTeam, reason, summary, won: boolean | null }`;
      - `error` `{ code }`;
      - `connection`, repassado da sessão.
    - **Pedido pendente diante de um snapshot (Review Focus 2):**
      1. se o `playback.result` é do `(turnId, seq)` pendente, resolve com ele;
      2. senão, se o `turnId` não mudou e a vez ainda é do `localSeat`, reenvia o mesmo corpo;
      3. senão, rejeita com `stale`.
    - **`initial` de uma tacada remota:** é a `table` oficial anterior com a `cueBall` da tacada, quando há.

- [ ] **Step 1: Escrever os testes que falham**

```js
test('o primeiro snapshot define o lugar local, a mesa oficial e o prazo', () => { /* localSeat from you.seat; deadlineMs() = 45000 - 500 */ });
test('a tacada local resolve com o shot_result do mesmo turnId e seq', async () => { /* frames decoded; table = header.table */ });
test('shot_rejected do mesmo seq rejeita com rejected e o motivo', async () => { /* … */ });
test('shot_result de tacada sem pedido pendente vira remoteShot com o initial certo', () => { /* cueBall placed on the previous official table */ });
test('tempo esgotado e escolha de push-out viram eventos', () => { /* kind timeout / choice */ });
test('queda com a tacada em trânsito: o playback da volta resolve o pedido', async () => { /* Review Focus 2a */ });
test('queda com a tacada em trânsito: mesmo turnId reenvia o mesmo corpo', async () => { /* 2b: session.send called twice with identical body */ });
test('queda com a tacada em trânsito: turnId novo rejeita com stale', async () => { /* 2c */ });
test('match_end diz se este cliente venceu', () => { /* won = winnerTeam === team of localSeat; null when ABORTED */ });
test('status() é o mesmo do LocalMatchController para o mesmo estado', () => { /* matchStatus shared */ });
```

- [ ] **Step 2: Rodar e confirmar a falha.** Run: `npm run test:online-unit -w apps/client`. Expected: FAIL.

- [ ] **Step 3: Implementar o `matchStatus` e o `OnlineMatchController`**

- [ ] **Step 4: Rodar e confirmar que passa.** Run: `npm run test:online-unit -w apps/client && npm run test:local-match -w apps/client`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client
git commit -m "feat(client): online match controller driven by the server"
```

---

### Task 5: O `Game` joga online (F4-09)

**Files:**
- Create:
  - `apps/client/src/dev/FakeOnlineController.js`: a mesma interface e os mesmos eventos do `OnlineMatchController`, com métodos para os testes emitirem mensagens e responderem tacadas;
  - `apps/client/test/online-game.test.js` (navegador, Vite e Puppeteer, sem servidor).
- Modify:
  - `apps/client/src/game/Game.js`;
  - `apps/client/src/menu/MenuSystem.js` (`_startOnlineGame`);
  - `apps/client/package.json` (o script `test:online-game`, incluído no `test` do cliente);
  - `apps/client/src/match/turnResult.js`, se precisar.

**Interfaces:**
- Consumes: os eventos e a interface da Tarefa 4.
- Produces:
  - **`Game.init(modeConfig)`** aceita `modeConfig.matchController`. Com um controlador online:
    - `this.online = true` e `networkMode = 'online'`;
    - `localPlayerId = controller.localSeat + 1`;
    - os nomes vêm de `controller.seats[*].username`;
    - o cronômetro fica ligado, com máximo de 45 s, e o restante vem de `controller.deadlineMs()`.
  - **Revisão dos `networkMode`:** cada `this.networkMode` usado com sentido de LAN passa a `this.networkMode === 'lan'`. O que é só online usa `this.online`. O LAN não muda.
  - **`_playRemoteShot({ initial, result, ruling, table }, offsetMs = 0)`:**
    - estado `SHOOTING`, a mesa vai para `initial`, `_shotRuling = ruling` e `_officialTable = table`;
    - a reprodução começa pelo `_startPlayback`.
    - Com `offsetMs`, avança o `TrajectoryPlayer` até esse ponto sem tocar os eventos de antes: nada de som nem de efeito.
    - Um `offsetMs` além da duração, ou sem quadros, aplica `table` direto e resolve a vez.
  - **Fim da tacada online:** aplica `_officialTable` antes do `resolveTurn`, e o `resolveTurn` não repõe bolas (`respotEightBall` e `respotNineBall` ficam desligados online).
  - **Eventos:**
    - `timeout` resolve a vez como o tempo esgotado local, com a mesa oficial. Se o jogador local estava carregando ou com a bola na mão, a ação é cancelada antes (Review Focus 1).
    - `choice` resolve como o `_applyPushOutChoice` local, sem chamar o controlador para decidir.
    - `snapshot` abandona a tacada em curso e aplica a mesa, a vez, a bola na mão e o cronômetro; com `playback`, chama `_playRemoteShot(..., offsetMs)`.
    - `seat` mostra "Adversário desconectado — ele tem 60 s para voltar" ou "Adversário voltou".
    - `connection` com `reconnecting` mostra "Reconectando…" e bloqueia a entrada; `online` tira o aviso; `offline` mostra "Conexão perdida" e volta ao menu; `replaced` mostra "A partida continua em outra aba" e volta ao menu, sem apagar o `matchId` guardado.
    - `error` com `SIM_FAILED` mostra "Falha na simulação — jogue de novo", e o snapshot que vem junto devolve a vez. Outros códigos vão só para o `console.warn`.
    - `end` mostra o resultado (abaixo), apaga o `matchId` guardado e volta ao menu num clique ou depois de 8 s.
  - **Recusas:**
    - Um `rejected` de `NOT_YOUR_TURN` ou `TURN_MISMATCH` online é descartado sem mensagem: o snapshot ou o resultado que vem junto acerta a mesa.
    - As outras recusas usam o `_cancelShot` atual.
  - **Ações locais:**
    - o tempo esgotado local online só mostra "Tempo esgotado — aguardando o servidor";
    - a escolha de push-out (`_applyPushOutChoice`) chama `controller.choosePushOut(accept)` e espera o evento `choice`, sem decidir localmente;
    - a desistência chama `controller.concede()`, que ignora o argumento de lugar;
    - a IA nunca é ligada online.
  - **`MenuSystem._startOnlineGame(controller)`:** abre o jogo com `modeConfig.matchController = controller` e o modo do controlador. Nasce nesta tarefa, porque os testes daqui o usam, e a Tarefa 6 o chama do painel.
  - **Textos do resultado** (exatos):
    - `WIN`: "Vitória!" e "Derrota";
    - `CONCEDE`: "Vitória — o adversário desistiu" e "Você desistiu";
    - `ABANDON`: "Vitória por W.O." e "Derrota por W.O.";
    - `ABORTED`: "Partida cancelada, sem resultado".

- [ ] **Step 1: Escrever os testes que falham** (no navegador; o controlador falso entra por `__menu._startOnlineGame(fake)`)

```js
test('a tacada do adversário é reproduzida e a mesa termina na oficial', async () => {
  // fake: snapshot (localSeat 1, turn seat 0) → remoteShot with a real sim result (from the page's simClient) and an
  // official table that differs from result.final by a respotted 8 → after playback: state AIM, currentPlayer 2,
  // ballsManager.toTableState() deepEquals the official table
});
test('a tacada local só se move quando o servidor responde', async () => {
  // localSeat 0: play through onMouseUp → fake.pendingShot exists, balls still at rest for 500 ms → fake resolves → playback → official table
});
test('tempo esgotado do servidor no meio da carga cancela a tacada local e passa a vez', async () => { /* Review Focus 1 */ });
test('volta no meio da reprodução retoma do deslocamento, sem tocar os eventos de antes', async () => {
  // snapshot with playback offsetMs = half the duration: the cue ball starts near the trajectory's middle position; no pocket sound before
});
test('playback além do último quadro aplica a mesa oficial direto', async () => { /* offsetMs = durationMs + 500 */ });
test('fim da partida mostra o resultado e volta ao menu', async () => { /* end won:true reason WIN → "Vitória!" */ });
test('os modos offline continuam iguais', async () => { /* vsai starts, LocalMatchController in use, networkMode null */ });
```

- [ ] **Step 2: Rodar e confirmar a falha.** Run: `npm run test:online-game -w apps/client`. Expected: FAIL.

- [ ] **Step 3: Implementar o caminho online no `Game`**

- [ ] **Step 4: Rodar e confirmar que passa.** Run: `npm run test:online-game -w apps/client && npm run test:local-2p -w apps/client && npm run test:lan -w apps/client && npm run test:browser -w apps/client`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client
git commit -m "feat(client): the game plays online shots, timeouts and rejoins from the server"
```

---

### Task 6: Telas online (F4-08)

**Files:**
- Create:
  - `apps/client/src/menu/OnlinePanel.js`;
  - `apps/client/test/online-panel.test.js` (Node, com o mesmo tipo de DOM mínimo de `test/panel-lifecycle.test.js` e uma sessão falsa).
- Modify:
  - `apps/client/src/menu/MainMenuScreen.js`: o botão "Jogar online", com um callback novo no fim do construtor;
  - `apps/client/src/menu/MenuSystem.js`: `_showOnline()` e o `_hideAllPanels` cobrindo o painel novo.

**Interfaces:**
- Consumes: `onlineConfig`, `OnlineSession`, `OnlineMatchController` e `MenuSystem._startOnlineGame(controller)` (Tarefa 5).
- Produces:
  - **`class OnlinePanel`:**
    - **Construtor:** `constructor({ config, createSession, onStart(controller), onBack })`.
    - **`show()`:**
      - sem `config`, mostra "Jogo online indisponível nesta versão" e nada conecta;
      - com `config`, conecta e, se há um `matchId` guardado, tenta voltar para ele (Review Focus 3).
    - **Estados:** `connecting`, `lobby`, `queue`, `room` e `joining`.
    - **Métodos que os testes de ponta a ponta chamam:** `setUsername(name)`, `queue(mode)`, `cancelQueue()`, `createRoom(mode)` (mostra o código), `joinByCode(code)` (o código vai em maiúsculas e sem espaços nas pontas) e `destroy()`.
    - **Entrar numa partida:**
      - cria o controlador e espera o primeiro snapshot (`whenReady`) antes de `onStart`. O servidor só manda o snapshot quando os dois lugares se ocupam, ou na volta de um jogador. Até lá, a tela mostra "Aguardando o adversário…";
      - um `match_end` `ABORTED` antes do começo (a partida da fila em que o adversário não chega em 30 s) mostra "O adversário não apareceu", apaga o `matchId` guardado e volta ao saguão.
  - **`window.__menu.onlinePanel`:** fica acessível em desenvolvimento.
  - **Textos** (exatos):
    - "Jogar online", "Seu nome", "Fila 8-ball", "Fila 9-ball", "Criar sala", "Entrar com código", "Cancelar", "Código da sala", "Aguardando o adversário…" e "Procurando adversário…";
    - por código de erro:
      - `USERNAME_INVALID` → "Nome inválido (3 a 16 letras, números ou _)";
      - `USERNAME_TAKEN` → "Esse nome já existe";
      - `CODE_INVALID` → "Código inválido";
      - `ROOM_NOT_FOUND` → "Sala não encontrada";
      - `ROOM_FULL` → "Sala cheia";
      - `PROTOCOL_MISMATCH` → "O jogo foi atualizado. Recarregue a página.";
      - `NETWORK` → "Sem conexão com o servidor".

- [ ] **Step 1: Escrever os testes que falham**

```js
test('sem servidor configurado, o online fica indisponível e nada conecta', () => { /* config null → message; createSession never called */ });
test('PROTOCOL_MISMATCH pede para atualizar a página', async () => { /* joinMatch throws code PROTOCOL_MISMATCH → exact text; no retry */ });
test('matchId guardado: o painel volta para a partida', async () => { /* storedMatchId → joinMatch(id) → onStart(controller) after whenReady */ });
test('matchId de partida que acabou é esquecido e o painel fica no saguão', async () => { /* MATCH_ENDED → forgetMatch; state lobby */ });
test('USERNAME_TAKEN mostra a mensagem e mantém o nome antigo', async () => { /* … */ });
test('o código é normalizado antes de entrar', async () => { /* ' ab12cd ' → joinByCode('AB12CD') */ });
test('cancelar a fila remove o bilhete', async () => { /* cancelQueue called; state lobby */ });
test('adversário que não aparece: o painel volta ao saguão com aviso', async () => { /* end ABORTED before whenReady → message; forgetMatch; state lobby */ });
```

- [ ] **Step 2: Rodar e confirmar a falha.** Run: `npm run test:online-unit -w apps/client`. Expected: FAIL.

- [ ] **Step 3: Implementar o painel e a ligação no menu**

- [ ] **Step 4: Rodar e confirmar que passa.** Run: `npm run test:online-unit -w apps/client && npm run test:panels -w apps/client && npm run test:smoke -w apps/client`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client
git commit -m "feat(client): online entry, queue and private room screens"
```

---

### Task 7: Presença do adversário: mira e bola na mão

**Files:**
- Modify:
  - `apps/client/src/match/OnlineMatchController.js`;
  - `apps/client/src/game/Game.js`;
  - `apps/client/test/online-match-controller.test.js`;
  - `apps/client/test/online-game.test.js`.

**Interfaces:**
- Produces:
  - **`sendAim({ angle, spin, power? })` e `sendBallInHand({ x, z })`:**
    - só valem na vez do `localSeat`;
    - levam o `turnId` atual;
    - no máximo 1 a cada 100 ms; a última chamada da janela é a que sai.
  - **Eventos:** `aim` `{ seat, angle, spin, power }` (op 102) e `ballInHand` `{ seat, x, z }` (op 109), só do outro lugar.
  - **`Game`:**
    - durante a vez local, chama `sendAim` quando a mira, o efeito ou a força mudam, e `sendBallInHand` quando a branca é arrastada;
    - durante a vez do adversário, mostra o taco na direção do último `aim` e move a branca para o último `ballInHand`;
    - a mira e a bola na mão do adversário não mudam o estado da partida.

- [ ] **Step 1: Escrever os testes que falham**

```js
test('aim_update sai no máximo a cada 100 ms, com o turnId atual e só na própria vez', () => { /* fake timers: 30 calls in 1 s → ≤ 10 sends; none off-turn */ });
test('a mira do adversário gira o taco; a bola na mão dele move a branca', async () => { /* browser, FakeOnlineController emits aim/ballInHand */ });
```

- [ ] **Step 2: Rodar e confirmar a falha.** Run: `npm run test:online-unit -w apps/client && npm run test:online-game -w apps/client`. Expected: FAIL.

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e confirmar que passa.** Run: o mesmo. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client
git commit -m "feat(client): relay the opponent's aim and ball in hand"
```

---

### Task 8: Dois navegadores de ponta a ponta (F4-10, F4-11)

**Files:**
- Create: `apps/client/test/online-match.test.js` (o script `test:online`, fora do `npm test`).
- Modify:
  - `.github/workflows/integration.yml`: instalar o Chrome; rodar o `test:online` depois da integração, com o `VITE_NAKAMA_URL` do stack local; `timeout-minutes: 35` (D066);
  - `services/nakama/test/integration/env.ts`: `NAKAMA_URL`, com TLS pelo esquema, para a Tarefa 9.

**Interfaces:**
- Consumes: tudo das Tarefas 3 a 7. Também `findStorageObject` (`services/nakama/test/integration/bot.ts`), para conferir o histórico.
- Produces:
  - O teste sobe o Vite com `VITE_NAKAMA_URL = process.env.NAKAMA_URL ?? 'http://127.0.0.1:7350'`.
  - Cada jogador fica num contexto de navegador separado (`browser.createBrowserContext()`), com `localStorage` e dispositivo próprios.
  - Os jogadores agem pelo `__menu.onlinePanel` e pelo `playTurn` de `test/local-2p-match.test.js`, adaptado: só joga a página cuja vez é a local, e a escolha de push-out vai pelo controlador.
  - `__menu.game.playbackRate = 4` acelera a reprodução nas duas páginas. O servidor não espera a reprodução (D056).

- [ ] **Step 1: Escrever os testes**

```js
test('dois navegadores jogam uma partida online inteira de 8-ball', { timeout: 900000 }, async () => {
  // A creates a room, B joins by code; loop until both show the end: after each shot both pages' toTableState() deepEqual;
  // one page shows "Vitória!" and the other "Derrota"; match_history (by matchId, without user_id) has the same winnerTeam
});
test('a fila junta os dois navegadores numa partida de 9-ball', { timeout: 120000 }, async () => {
  // both queue 9ball → same matchId; first shot plays on both; A concedes → B "Vitória — o adversário desistiu"
});
test('queda no meio da reprodução: o navegador volta e termina no mesmo estado', { timeout: 180000 }, async () => {
  // during A's shot playback B calls session.dropConnection() → "Reconectando…" → back online → B's table after the shot equals A's
});
test('recarregar a página no meio da partida volta para a mesma partida', { timeout: 180000 }, async () => {
  // B reloads → opens the online panel → back in the same match (same matchId), its turn state equals the server's; then concede
});
```

- [ ] **Step 2: Rodar.** Onde não houver Docker, o `server` da rede faz as vezes do servidor local, a partir desta máquina: `NAKAMA_URL=http://server:7350 npm run test:online -w apps/client`. Na CI, faça o push. Expected: os quatro passam. Se o Nakama recusar o navegador por CORS, registre uma ruling e resolva no servidor, sem mexer no protocolo.

- [ ] **Step 3: Corrigir o que a ponta a ponta mostrar.** Cada defeito ganha antes um teste das Tarefas 3 a 7 que o reproduz.

- [ ] **Step 4: Rodar de novo.** Run: o `test:online` contra o `server` e a CI. Expected: verde nos dois lugares, com o id da execução no `progress.md`.

- [ ] **Step 5: Commit e push**

```bash
git add apps/client .github/workflows/integration.yml services/nakama/test/integration/env.ts
git commit -m "test(client): two browsers play an online match end to end"
git push -u origin claude/planejamento-online
```

---

### Task 9: Produção com TLS (F4-13)

**Files:**
- Create:
  - `infra/docker-compose.prod.yml` e `infra/Caddyfile`;
  - `infra/.env.production.example`, `infra/check-env.mjs` e `infra/gen-secrets.mjs`;
  - `infra/test/check-env.test.mjs` e `infra/test/prod-compose.test.mjs`;
  - `docs/f4/implantacao.md`.
- Modify:
  - `package.json` da raiz: os scripts `infra:prod:up`, `infra:prod:logs` e `infra:prod:stop`. Nenhum deles apaga volumes;
  - `.github/workflows/integration.yml`: o `prod-compose.test.mjs` (precisa do Docker).

**Interfaces:**
- Produces:
  - **`check-env.mjs [arquivo=infra/.env]`:** sai com o código 1 e lista o problema se:
    - falta alguma destas chaves: `NAKAMA_DOMAIN`, `ACME_EMAIL`, `NAKAMA_SERVER_KEY`, `NAKAMA_HTTP_KEY`, `NAKAMA_SESSION_KEY` (o compose também deriva dela a chave de renovação), `NAKAMA_CONSOLE_PASSWORD`, `POSTGRES_PASSWORD` e `SIM_SECRET`;
    - alguma ainda tem o valor de `infra/.env.example`;
    - um segredo não casa com `^[A-Za-z0-9_-]{24,}$`.
  - **`gen-secrets.mjs`:** imprime um bloco `.env` com segredos de `crypto.randomBytes(24).toString('hex')`.
  - **`infra:prod:up`:** roda o `check-env`, gera o `sim` e o módulo e sobe com `docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build --wait`.
  - **`docker-compose.prod.yml`:**
    - Caddy nas portas 80 e 443, com os volumes `caddy_data` e `caddy_config`;
    - `ports: !reset ["127.0.0.1:7351:7351"]` no Nakama;
    - nenhuma porta no PostgreSQL nem no `sim`.
  - **`Caddyfile`:** `{ email {$ACME_EMAIL} }` e `{$NAKAMA_DOMAIN} { reverse_proxy nakama:7350 }`.
  - **`docs/f4/implantacao.md`** (PT-BR):
    - requisitos: Linux com Docker, um domínio com registro A apontando para a máquina, portas 80 e 443 abertas, numa região única perto dos jogadores (São Paulo ou a mais próxima, §5.4);
    - primeira subida e atualização (`git pull && npm run infra:prod:up`);
    - console por `ssh -L 7351:127.0.0.1:7351`;
    - cópia do banco (`docker compose … exec postgres pg_dump`);
    - variáveis do Pages (`NAKAMA_URL`, `NAKAMA_SERVER_KEY`);
    - a alternativa com Cloudflare Tunnel (D065).

- [ ] **Step 1: Escrever os testes que falham**

```js
test('check-env recusa chave faltando, valor de desenvolvimento e segredo com caractere fora do padrão', () => { /* three temp files → exit 1 with the key named; a good file → exit 0 */ });
test('gen-secrets produz segredos que o check-env aceita', () => { /* … */ });
test('no compose de produção só o Caddy publica 80 e 443; o console fica em 127.0.0.1', () => {
  // docker compose -f … -f … config --format json → caddy ports 80/443; nakama only 127.0.0.1:7351; postgres and sim none
});
```

- [ ] **Step 2: Rodar e confirmar a falha.** Run: `node --test infra/test/check-env.test.mjs` (e, na CI, o `prod-compose`). Expected: FAIL.

- [ ] **Step 3: Implementar o compose, o Caddyfile, os scripts e o passo a passo**

- [ ] **Step 4: Rodar e confirmar que passa.** Run: os testes acima, e a integração na CI. Expected: PASS.

- [ ] **Step 5: Commit e push**

```bash
git add infra docs/f4 package.json .github/workflows/integration.yml
git commit -m "feat(infra): production compose with TLS through Caddy"
git push -u origin claude/planejamento-online
```

- [ ] **Step 6: Implantação (o usuário).** Pare e peça ao usuário a máquina e o domínio, ou a escolha da alternativa da D065. Ele segue o `docs/f4/implantacao.md` e cria as variáveis do repositório. Daqui, rode:

```bash
NAKAMA_URL=https://<domínio> npm run test:integration -w services/nakama
```

```bash
NAKAMA_URL=https://<domínio> npm run test:online -w apps/client
```

Expected: tudo verde. As contas e partidas de teste ficam no banco de produção antes do beta. O `docs/f4/implantacao.md` diz como apagá-las (`DELETE` por prefixo do dispositivo de teste), ou como aceitá-las.

---

### Task 10: Fechamento da F4

**Files:**
- Modify:
  - `CLAUDE.md`: comandos `test:online`, `test:online-unit`, `test:online-game` e `infra:prod:*`, e o estado do cliente online;
  - `docs/f3/servidor-local.md`: o `test:online` contra o `server`;
  - `docs/protocol.md`: uma seção curta "Cliente de referência", que aponta para `OnlineSession` e `OnlineMatchController`;
  - `harness/feature_list.json`, `harness/progress.md` e `docs/superpowers/plans/2026-10-24-roteiro.md`.

- [ ] **Step 1: Suíte completa.** Run: `npm test && npm run typecheck && bash harness/init.sh`, a CI verde e o `test:online` contra o `server`. Expected: tudo verde. Uma suíte de navegador que só passa do limite de tempo nesta máquina fica registrada com o erro exato.

- [ ] **Step 2: Marcar os itens**, cada um só com a execução que o verificou:

| Item | Execução |
|------|----------|
| F4-08 | `online-panel` no `npm test`, mais o teste da fila no `test:online` |
| F4-09 | `online-game` no `npm test` |
| F4-10 | `test:online` na CI ou no `server` |
| F4-11 | `test:online` na CI ou no `server` |
| F4-12 | integração na CI |
| F4-13 | integração e `test:online` contra a produção (Tarefa 9, Step 6) |

Sem a produção (Step 6 pendente), o F4-13 fica `false` e o "Próximo passo" diz o que falta.

- [ ] **Step 3: Atualizar o roteiro e o `progress.md`.** A F4-B fica concluída, ou concluída menos a produção. O próximo passo é o plano da F5.

- [ ] **Step 4: Commit e push**

```bash
git add CLAUDE.md docs harness
git commit -m "docs(f4): close phase F4-B with the online client and the production deploy"
git push -u origin claude/planejamento-online
```
