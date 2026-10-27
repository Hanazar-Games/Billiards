# Implantação do servidor online (F4-B)

Este é o passo a passo para colocar o servidor do jogo online na internet, com TLS (D065). A máquina e o domínio são seus; nada daqui vai para o repositório além dos arquivos de exemplo.

O que sobe, com `infra/docker-compose.yml` mais `infra/docker-compose.prod.yml`:

| Serviço | Imagem | Portas publicadas |
|---------|--------|-------------------|
| `caddy` | `caddy:2.10.0-alpine` | 80 e 443 (TLS com certificado do Let's Encrypt, renovado sozinho) |
| `nakama` | `heroiclabs/nakama:3.41.0` | só o console, em `127.0.0.1:7351` |
| `sim` | `services/sim` | nenhuma |
| `postgres` | `postgres:16-alpine` | nenhuma |

O Caddy recebe `https://<domínio>` e o WebSocket do jogo e encaminha tudo para `nakama:7350`. Todos os serviços voltam sozinhos depois de uma queda ou de um reinício da máquina (`restart: unless-stopped`).

## Requisitos

- Linux com Docker e o plugin Compose 2.24.4 ou mais novo (o `!override` das portas do Nakama precisa dele).
- Node 24 e npm, para gerar o módulo do Nakama e o serviço de simulação, e o `git`.
- Um domínio (ou subdomínio) com registro A apontando para o IP da máquina, e AAAA se ela tiver IPv6. O certificado só sai depois que o DNS responde.
- As portas 80 e 443 abertas na entrada (firewall da máquina e da nuvem). A 80 serve para o Let's Encrypt validar o domínio e para redirecionar para a 443.
- Uma região só, perto dos jogadores: São Paulo ou a mais próxima disponível (spec §5.4).

## Primeira subida

Na máquina:

```bash
git clone https://github.com/<você>/<repositório>.git billiards && cd billiards
npm ci
```

Crie o `infra/.env` com o domínio, o e-mail para os avisos do Let's Encrypt e segredos novos:

```bash
printf 'NAKAMA_DOMAIN=jogo.seudominio.com.br\nACME_EMAIL=voce@seudominio.com.br\n' > infra/.env
node infra/gen-secrets.mjs >> infra/.env
chmod 600 infra/.env
```

O `infra/.env.production.example` mostra as chaves esperadas. Cada segredo usa só letras, números, `_` e `-`, com 24 caracteres ou mais e sem aspas, para que nem o Compose nem o shell os alterem. Guarde uma cópia do `infra/.env` fora da máquina (num gerenciador de senhas): sem a `NAKAMA_SESSION_KEY`, as sessões abertas caem; sem a `POSTGRES_PASSWORD`, o banco não abre.

Suba:

```bash
npm run infra:prod:up
```

O script roda antes o `infra/check-env.mjs`, que recusa chave faltando, valor de exemplo, segredo fora do padrão e domínio com `https://` ou porta. Depois gera o módulo e o `sim` e sobe tudo com `--wait`.

Confira de qualquer lugar:

```bash
curl https://jogo.seudominio.com.br/healthcheck
```

A resposta é `{}`. Na primeira vez, o certificado pode levar alguns segundos; `npm run infra:prod:logs` mostra o Caddy obtendo o certificado.

## Atualização

```bash
git pull && npm ci && npm run infra:prod:up
```

O `up` recria só o que mudou. O banco fica no volume `postgres-data` e os certificados em `caddy_data`; nenhum script de produção apaga volumes.

| Comando | O que faz |
|---------|-----------|
| `npm run infra:prod:up` | Confere o `.env`, gera o módulo e o `sim`, sobe ou atualiza |
| `npm run infra:prod:logs` | Acompanha os logs de todos os serviços |
| `npm run infra:prod:stop` | Para os serviços sem apagar nada; `infra:prod:up` volta |

Não use `npm run infra:down` em produção: ele é do ambiente local e apaga os volumes (`down -v`), com o banco junto.

## Console do Nakama

O console fica só na própria máquina. Do seu computador, abra um túnel SSH:

```bash
ssh -L 7351:127.0.0.1:7351 usuario@maquina
```

Com o túnel aberto, acesse `http://127.0.0.1:7351`, com o usuário `admin` e a senha `NAKAMA_CONSOLE_PASSWORD` do `infra/.env`.

## Cópia do banco

Uma cópia compactada, com data:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml --env-file infra/.env \
  exec -T postgres pg_dump -U postgres nakama | gzip > nakama-$(date +%F).sql.gz
```

Para restaurar, numa máquina nova, a cópia entra num banco vazio, antes de o Nakama subir pela primeira vez: o `infra:prod:up` roda as migrações do Nakama, e uma cópia restaurada por cima de um banco já migrado falha em quase tudo sem parar. Com o `infra/.env` da máquina antiga (a mesma `POSTGRES_PASSWORD`):

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml --env-file infra/.env up -d --wait postgres
```

```bash
gunzip -c nakama-AAAA-MM-DD.sql.gz | docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file infra/.env exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 --single-transaction nakama
```

Se o `psql` parar com erro, nada foi gravado: confira se o volume `postgres-data` estava mesmo vazio (`docker volume ls`). Com a restauração completa, `npm run infra:prod:up` sobe o resto; as migrações do Nakama encontram o banco já no ponto.

Para voltar uma cópia na mesma máquina, pare tudo (`npm run infra:prod:stop`), apague o volume do banco (`docker volume rm billiards_postgres-data`, depois de conferir que a cópia abre com `gunzip -t`) e siga os dois comandos acima.

Leve a cópia para fora da máquina. Uma cópia por dia, num `cron`, já cobre o beta.

## Cliente no GitHub Pages

O cliente continua no GitHub Pages; o workflow `deploy.yml` gera o build com duas variáveis do repositório (D065, D066). Em **Settings → Secrets and variables → Actions → Variables**, crie:

| Variável | Valor |
|----------|-------|
| `NAKAMA_URL` | `https://jogo.seudominio.com.br` |
| `NAKAMA_SERVER_KEY` | o `NAKAMA_SERVER_KEY` do `infra/.env` |

A chave de servidor vai dentro do JavaScript do cliente, e qualquer jogador pode lê-la: ela só identifica o jogo. As outras chaves do `.env` são segredos e nunca saem da máquina. Depois de criar as variáveis, rode o workflow de deploy de novo (**Actions → Deploy → Run workflow**). Sem `NAKAMA_URL`, o botão "Jogar online" mostra "Jogo online indisponível nesta versão".

## Verificação contra a produção

Do seu computador, com o repositório:

```bash
NAKAMA_URL=https://jogo.seudominio.com.br NAKAMA_SERVER_KEY=<chave> NAKAMA_HTTP_KEY=<chave> npm run test:integration -w services/nakama
```

```bash
NAKAMA_URL=https://jogo.seudominio.com.br NAKAMA_SERVER_KEY=<chave> npm run test:online -w apps/client
```

O primeiro roda os bots (contas, salas, fila e partidas); o segundo, dois navegadores jogando pelo painel online. As chaves ficam só no seu terminal, sem ir para nenhum arquivo do repositório.

## Contas e partidas de teste

Os testes criam contas e partidas no banco de produção. Os dispositivos de teste têm prefixo: `bot-` nos bots da integração e `e2e-` nos navegadores. Antes do beta, você pode aceitá-las (ficam como contas sem uso) ou apagá-las.

Para ver quais são, pelo `psql` do contêiner:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml --env-file infra/.env exec postgres psql -U postgres nakama
```

```sql
SELECT u.id, u.username, d.id AS device
FROM users u JOIN user_device d ON d.user_id = u.id
WHERE d.id LIKE 'bot-%' OR d.id LIKE 'e2e-%';
```

Para apagá-las, faça antes uma cópia do banco e rode, numa transação:

```sql
BEGIN;
CREATE TEMP TABLE test_users AS
  SELECT DISTINCT user_id AS id FROM user_device WHERE id LIKE 'bot-%' OR id LIKE 'e2e-%';
-- O histórico pertence ao sistema: sai a partida que tem um jogador de teste.
DELETE FROM storage s
WHERE s.collection = 'match_history'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.value -> 'players') p
              WHERE (p ->> 'userId')::uuid IN (SELECT id FROM test_users));
-- Dispositivos, e-mails e objetos do usuário saem junto (ON DELETE CASCADE).
DELETE FROM users WHERE id IN (SELECT id FROM test_users);
COMMIT;
```

Rode isso com o jogo sem partidas em andamento.

## Alternativa: Cloudflare Tunnel

Se não houver máquina com IP público, o `server` da rede local pode atender pela Cloudflare (D065), sem o Caddy e sem abrir portas no roteador:

1. Suba o stack de desenvolvimento no `server` com segredos de produção: `infra/.env` como acima, mas com `NAKAMA_BIND=127.0.0.1`, e `npm run infra:up`. Esse caminho não passa pelo `check-env`, então rode `node infra/check-env.mjs` à mão antes.
2. Com o domínio na Cloudflare, crie um túnel (`cloudflared tunnel create billiards`) e aponte o nome público para `http://127.0.0.1:7350`. A Cloudflare cuida do certificado, e o WebSocket passa pelo túnel.
3. As variáveis do Pages e a verificação são as mesmas, com `NAKAMA_URL=https://<nome público>`.

O preço é depender da rede de casa (energia, upload, IP) e da Cloudflare no caminho de cada tacada. Serve para o beta fechado; para o público, prefira a máquina dedicada.
