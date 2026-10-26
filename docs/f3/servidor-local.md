# Servidor local (F3): Nakama, contas e salas

O servidor do jogo roda no Nakama 3.41.0 com PostgreSQL 16, em Docker. O módulo do jogo (`services/nakama`) é escrito em TypeScript e empacotado num único `build/index.js` para o runtime JavaScript do Nakama (D050).

## Requisitos

- Docker com o Compose v2 (Docker Desktop no Windows e no macOS).
- Node ≥ 22.12 (os testes usam o Node 24 no CI).

Sem Docker, o `npm test` da raiz continua funcionando: o pacote `services/nakama` roda só os testes unitários. Os testes de integração precisam do Docker e rodam também no GitHub Actions, a cada push na branch de trabalho (D051).

## Subir, testar e derrubar

```bash
npm run infra:up                                   # gera o módulo e sobe PostgreSQL + Nakama (espera ficarem saudáveis)
npm run test:integration -w services/nakama        # bots contra o servidor local
npm run infra:down                                 # derruba e apaga o volume do banco
```

- Na primeira vez, `infra:up` copia `infra/.env.example` para `infra/.env`. Os valores são **só de desenvolvimento**.
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

   Pare antes qualquer outro Nakama que use as portas 7350 e 7351. Com `NAKAMA_BIND=0.0.0.0`, a API e o console ficam visíveis para toda a rede. Por isso, troque a senha do console. As outras chaves podem ficar com os valores de desenvolvimento enquanto o servidor for só de testes.

2. **Nesta máquina:**

   ```bash
   NAKAMA_HOST=server npm run test:integration -w services/nakama
   ```

   No PowerShell, use `$env:NAKAMA_HOST='server'` antes do comando. Se as chaves do `.env` do servidor forem diferentes das de desenvolvimento, passe também `NAKAMA_SERVER_KEY` e `NAKAMA_HTTP_KEY`. `NAKAMA_PORT` muda a porta da API (o padrão é 7350).

3. **Para atualizar o servidor depois de mudar o módulo:** no servidor, rode `git pull && npm run infra:reload`.

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

- **Nomes:** de 3 a 16 caracteres `[a-z0-9_]`, guardados em minúsculas e sem acento. O filtro de palavras PT-BR pega maiúsculas, acentos, leetspeak e separadores, inclusive em palavras curtas como `p_u_t_a`. Ele não barra palavras comuns que contêm um trecho parecido, como `temporada` e `computador` (D052).
- **Avatares:** `preset:a01` a `preset:a12`.
- **Mudar o perfil:** o `UpdateAccount` nativo é recusado (`PROFILE_VIA_RPC`). O perfil só muda pela RPC.
- **Códigos de sala:** 6 caracteres sem 0/O/1/I. A busca aceita minúsculas e espaços nas pontas.
- **Sala recém-criada:** ela entra na listagem de rótulos depois de um atraso de indexação (até 100 ms no ambiente local). Se `join_by_code` responder `ROOM_NOT_FOUND` logo depois da criação, o cliente tenta de novo por alguns segundos.
- **Fim por inatividade:** uma sala vazia termina depois de 60 s.

## Segredos em produção

Na VPS (D049), as chaves (`NAKAMA_SERVER_KEY`, `NAKAMA_HTTP_KEY`, `NAKAMA_SESSION_KEY`, `NAKAMA_CONSOLE_PASSWORD`, `POSTGRES_PASSWORD`) vêm do ambiente do servidor e nunca entram no repositório. A implantação é na F4.
