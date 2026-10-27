# Servidor local (F3 e F4-A): Nakama, contas, salas e partida

O servidor do jogo roda no Nakama 3.41.0 com PostgreSQL 16 e o serviço de simulação `sim`, em Docker. O módulo do jogo (`services/nakama`) é escrito em TypeScript e empacotado num único `build/index.js` para o runtime JavaScript do Nakama (D050). O `sim` (`services/sim`, D059) simula cada tacada aceita; só o Nakama fala com ele, pela rede do Compose. O protocolo da partida está em [`docs/protocol.md`](../protocol.md).

## Requisitos

- Docker com o Compose v2 (Docker Desktop no Windows e no macOS).
- Node ≥ 22.12 para gerar o módulo e subir o servidor. Os testes são `.ts` e precisam de um Node que execute TypeScript sem flag: o Node 24, o mesmo do CI. Com o Node 22, todo teste que é ou importa um `.ts` falha com `ERR_UNKNOWN_FILE_EXTENSION`.

Sem Docker, o `npm test` da raiz continua funcionando: o pacote `services/nakama` roda só os testes unitários, e o `services/sim` testa o servidor HTTP dentro do próprio processo. Os testes de integração precisam do Docker e rodam também no GitHub Actions, a cada push na branch de trabalho (D051).

## Subir, testar e derrubar

```bash
npm run infra:up                                   # gera o módulo e o sim e sobe PostgreSQL + sim + Nakama (espera ficarem saudáveis)
npm run test:integration -w services/nakama        # bots contra o servidor local
npm run infra:down                                 # derruba e apaga o volume do banco
```

- Na primeira vez, `infra:up` copia `infra/.env.example` para `infra/.env`. Os valores são **só de desenvolvimento**.
- `SIM_SECRET` é o segredo que o Nakama manda ao `sim` em cada chamada (cabeçalho `x-sim-secret`); no `.env.example` vale `dev-sim-secret`. O `sim` não publica porta: só o contêiner do Nakama o alcança, em `http://sim:8080`.
- API e socket: `http://127.0.0.1:7350`. Console: `http://127.0.0.1:7351` (usuário `admin`, senha `NAKAMA_CONSOLE_PASSWORD` do `.env`).
- Para recarregar o módulo depois de mudar `services/nakama/src`, rode `npm run infra:reload`. Ele gera o módulo e recria o contêiner do Nakama, que só lê os módulos ao iniciar. Rodar `infra:up` de novo não basta.

## Servidor de testes na rede local

Para rodar o servidor em outra máquina da rede (por exemplo, `server`) e testar a partir desta:

1. **No servidor** (precisa de Docker, Node e git):

   ```bash
   git clone -b claude/planejamento-online https://github.com/rguilherme10/billiard.git && cd billiard
   cp infra/.env.example infra/.env     # depois edite: NAKAMA_BIND=0.0.0.0 e uma NAKAMA_CONSOLE_PASSWORD só sua
   PUPPETEER_SKIP_DOWNLOAD=1 npm ci     # sem baixar o Chrome dos testes de navegador
   npm run infra:up
   ```

   Para rodar também os testes no servidor, instale o Node 24 com o `nvm`. Ele não vem pelo `apt`: é instalado por um script, só para o seu usuário, e o Node do sistema continua lá. Depois, reinstale as dependências e rode as suítes sem navegador (o servidor não tem Chrome):

   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
   source ~/.bashrc && nvm install 24
   PUPPETEER_SKIP_DOWNLOAD=1 npm ci
   npm test -w packages/protocol -w packages/modes -w packages/sim -w services/sim -w services/nakama
   ```

   Pare antes qualquer outro Nakama que use as portas 7350 e 7351. Com `NAKAMA_BIND=0.0.0.0`, a API e o console ficam visíveis para toda a rede. Por isso, troque a senha do console. As outras chaves podem ficar com os valores de desenvolvimento enquanto o servidor for só de testes.

2. **Nesta máquina:**

   ```bash
   NAKAMA_HOST=server npm run test:integration -w services/nakama
   ```

   No PowerShell, use `$env:NAKAMA_HOST='server'` antes do comando; no Prompt de Comando (cmd), `set "NAKAMA_HOST=server"`. Sem a variável, os testes procuram um Nakama em `127.0.0.1`: cada arquivo espera 60 s pelo healthcheck e falha. Se as chaves do `.env` do servidor forem diferentes das de desenvolvimento, passe também `NAKAMA_SERVER_KEY` e `NAKAMA_HTTP_KEY`. `NAKAMA_PORT` muda a porta da API (o padrão é 7350). `NAKAMA_URL=http://server:7350` faz o mesmo numa variável só, e com `https://` liga o TLS (a produção, `docs/f4/implantacao.md`).

   Os dois navegadores de ponta a ponta (F4-10, F4-11) usam o mesmo servidor; o Chrome desta máquina serve (`PUPPETEER_EXECUTABLE_PATH`, veja o `CLAUDE.md`):

   ```bash
   NAKAMA_URL=http://server:7350 npm run test:online -w apps/client
   ```

   São quatro testes, em cerca de 3 min: uma partida inteira de 8-ball por uma sala com código, a fila de 9-ball com desistência, a queda no meio da reprodução e a recarga da página. Não rode junto com o `test:integration`: a fila dos bots e a dos navegadores se misturam.

3. **Para atualizar o servidor depois de mudar o módulo:** no servidor, rode `git pull && npm run infra:reload`.

   **Atenção na atualização para a F4-A.** O `infra/.env` criado antes dela não tem `SIM_SECRET`, e o Compose passou a exigi-lo: qualquer comando dele (até o `infra:down`) para com a mensagem `SIM_SECRET is missing, copy it from infra/.env.example to infra/.env`. No servidor, rode `git pull`, acrescente `SIM_SECRET=dev-sim-secret` (ou um segredo seu) ao `infra/.env` e rode `npm run infra:up`, que gera o `sim` e sobe o contêiner novo.

## Ver uma partida de ponta a ponta

Os testes de integração de `services/nakama/test/integration/game.test.ts` jogam partidas com bots. O principal é a partida inteira de 8-ball, com os dois bots escolhendo as tacadas por `autoplay.ts` até o fim:

```bash
npm run test:integration -w services/nakama -- --test-name-pattern="partida inteira"
```

Os outros mostram cada parte, com o nome que o `feature_list.json` cita: `tacada fora do turno → shot_rejected`, `os dois bots terminam a tacada com o mesmo estado final`, `tempo esgotado conta como falta` (45 s), `bot cai no meio da reprodução, volta e termina no mesmo estado`, `shot_request repetido não gera segunda tacada`, `bot ausente por mais de 60 s perde por W.O.` (60 s) e `desistência encerra a partida e grava o histórico uma vez`. O resultado fica no `match_history` (veja `docs/protocol.md`, seção 11). Se uma partida falhar, `docker compose -f infra/docker-compose.yml --env-file infra/.env logs nakama sim` mostra o que o servidor registrou, inclusive uma linha por tacada simulada.

## O que o servidor oferece

| Recurso | Como usar | Erros (campo `message`) |
|---------|-----------|-------------------------|
| Convidado | `authenticateDevice(id, true)` | `USERNAME_INVALID`, se pedir um nome impróprio. Os outros métodos sem validação de nome (custom, Facebook, Game Center, Apple, Steam) dão `AUTH_METHOD_DISABLED` |
| Vínculo de e-mail | `linkEmail(session, { email, password })`; depois `authenticateEmail(email, password, false)` | os do próprio Nakama |
| Google | `linkGoogle(session, { token })` (login real a conferir na F5) | token inválido é recusado |
| Perfil | RPC `profile_update` `{ username?, avatar? }` → `{ username, avatar }` | `USERNAME_INVALID`, `USERNAME_TAKEN`, `AVATAR_INVALID`, `PAYLOAD_INVALID` |
| Perfil de outro jogador | `getUsers(session, [userId])` | — |
| Sala privada | RPC `create_private_match` `{ mode: '8ball' \| '9ball', format: '1v1' }` → `{ matchId, code }` | `MODE_INVALID`, `ROOM_CODE_EXHAUSTED` |
| Entrar pelo código | RPC `join_by_code` `{ code }` → `{ matchId }`; depois `socket.joinMatch(matchId)` | `CODE_INVALID`, `ROOM_NOT_FOUND`, `ROOM_FULL`. A listagem nativa de partidas é recusada (`MATCH_LISTING_DISABLED`), para não expor os códigos |
| Fila 1×1 | `socket.addMatchmaker('+properties.mode:<mode> +properties.format:1v1', 2, 2, { mode, format: '1v1' })`; o evento `onmatchmakermatched` traz o `match_id` | bilhete com modo inválido não forma partida |
| Partida | `socket.joinMatch(matchId, undefined, { protocolVersion: '1' })`; depois, as mensagens de `docs/protocol.md` | `PROTOCOL_MISMATCH`, `MATCH_ENDED`, `ROOM_FULL` (e, nas mensagens, os motivos de `shot_rejected`) |

- **Nomes:** de 3 a 16 caracteres `[a-z0-9_]`, guardados em minúsculas e sem acento. O filtro de palavras PT-BR pega maiúsculas, acentos, leetspeak e separadores, inclusive em palavras curtas como `p_u_t_a`. Ele não barra palavras comuns que contêm um trecho parecido, como `temporada` e `computador` (D052).
- **Avatares:** `preset:a01` a `preset:a12`.
- **Mudar o perfil:** o `UpdateAccount` nativo é recusado (`PROFILE_VIA_RPC`). O perfil só muda pela RPC.
- **Códigos de sala:** 6 caracteres sem 0/O/1/I. A busca aceita minúsculas e espaços nas pontas.
- **Sala recém-criada:** ela entra na listagem de rótulos depois de um atraso de indexação (até 100 ms no ambiente local). Se `join_by_code` responder `ROOM_NOT_FOUND` logo depois da criação, o cliente tenta de novo por alguns segundos.
- **Fim por inatividade:** uma sala vazia termina depois de 60 s.

## Segredos em produção

Na VPS (D049), as chaves (`NAKAMA_SERVER_KEY`, `NAKAMA_HTTP_KEY`, `NAKAMA_SESSION_KEY`, `NAKAMA_CONSOLE_PASSWORD`, `POSTGRES_PASSWORD` e `SIM_SECRET`) vêm do ambiente do servidor e nunca entram no repositório. O `SIM_SECRET` chega ao Nakama por `--runtime.env "SIM_SECRET=${SIM_SECRET}"`, expandido pelo Compose e pelo shell: um segredo com `$`, crase ou `"` quebra o comando, e ele aparece nos argumentos do processo. A F4-B resolveu isso (D065): os segredos casam com `^[A-Za-z0-9_-]{24,}$`, conferidos pelo `infra/check-env.mjs` antes de subir a produção, e o passo a passo está em `docs/f4/implantacao.md`.
