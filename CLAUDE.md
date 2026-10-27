# Billiards Online

Fork definitivo de Hanazar-Games/Billiards (sinuca 3D com Three.js + cannon-es) que está sendo transformado em um jogo online free-to-play com Nakama. O cliente offline (`apps/client/src/`) já simula cada tacada com `packages/sim` num Web Worker e reproduz a trajetória v1, e as regras de 8-ball e 9-ball vêm de `packages/modes` por meio do `LocalMatchController` (F2). O servidor autoritativo da partida online 1×1 (F4-A: Nakama, serviço de simulação e protocolo v1) está pronto e verificado com bots; o protocolo está em `docs/protocol.md`. O cliente joga online (F4-B): `OnlineSession` conecta ao Nakama com conta de convidado e reconexão, o `OnlineMatchController` dá ao `Game` a mesma interface do controlador local, guiado pelo servidor, e o painel "Jogar online" tem fila, sala com código e a volta depois de recarregar a página. A produção com TLS (Caddy) está em `docs/f4/implantacao.md`. A nova arquitetura está descrita na spec.

## Leia antes de trabalhar

1. `harness/progress.md`: estado atual e próximo passo.
2. `harness/decisions.json`: decisões tomadas (não contradiga uma decisão `accepted` sem registrar uma nova).
3. `harness/feature_list.json`: o que falta, com o critério verificável de cada item.
4. `docs/superpowers/specs/2026-10-24-billiards-online-design.md`: a spec.
5. `docs/superpowers/plans/2026-10-24-roteiro.md`: as fases e o plano detalhado da fase atual.

Nas sessões na nuvem, o hook SessionStart roda `harness/init.sh` (dependências, testes rápidos, resumo do status). Fora delas, rode-o manualmente.

## Como trabalhar

- **Uma fase por vez, um item por vez.** Siga o plano detalhado da fase atual. Se a fase ainda não tiver plano, escreva-o com a skill `superpowers:writing-plans` e peça revisão ao usuário antes de implementar.
- **TDD:** teste que falha → implementação mínima → teste passando → commit.
- **`feature_list.json`:** marque `"passes": true` só depois de rodar a verificação do item e ver o resultado esperado. Não apague nem afrouxe critérios; para mudar um, registre uma decisão.
- **`decisions.json` é um array só de acréscimo.** Decisão nova = nova entrada com o próximo id (`D0xx`), data, título, decisão, motivo, alternativas, `status` (`accepted`, `open`, `pending-spike` ou `superseded`), `source` e `refs`. Para mudar uma decisão, crie outra e marque a antiga com `"status": "superseded"` e `"supersededBy": "D0yy"`.
- **`progress.md`:** ao fim de cada interação, atualize "Estado atual", "Próximo passo" e acrescente uma entrada ao registro de sessões.
- **Commit a cada interação (D028):** ao fim de cada interação com o usuário, faça commit das mudanças e envie para a branch de trabalho (`git push -u origin <branch>`). Nunca commite direto na `main`.

## Convenções

- Documentos de planejamento e harness em PT-BR; identificadores, comentários de código e mensagens de commit em inglês (conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `spike(f0):`…).
- O código existente é JavaScript ES2022 com módulos ES. Siga o estilo do arquivo que estiver editando.
- Mantenha o aviso de copyright MIT em `LICENSE`.
- Nunca coloque segredos (chaves de pagamento, `http_key` real, senhas) no repositório.
- O jogo original fica em `apps/client/` (`src/`, `server/` e `test/` ficavam na raiz até a F1).

## Comandos

| Comando | O que faz |
|---------|-----------|
| `bash harness/init.sh` | Instala dependências, roda os testes rápidos e mostra o status |
| `node harness/status.mjs` | Mostra só o status (fase, itens pendentes, decisões em aberto) |
| `npm run dev` | Servidor de desenvolvimento do jogo (porta 5173; roda `apps/client`) |
| `npm test -w packages/modes` | Regras de 8-ball e 9-ball, ordem de turnos com N lugares, invariantes e os testes diferenciais contra as regras legadas congeladas (D046) |
| `npm run test:local-match -w apps/client` | `LocalMatchController` no Node; as outras suítes do cliente seguem o mesmo padrão (`test:<nome>`) |
| `npm run test:sim-worker -w apps/client` | Worker de simulação (`handleSimRequest` e `SimWorkerClient`, com um Worker falso, só no Node) |
| `npm run test:trajectory-player -w apps/client` | `TrajectoryPlayer`: reproduz a trajetória v1 em qualquer taxa de quadros, com os eventos no instante certo (só no Node) |
| `npm run test:no-legacy-physics -w apps/client` | O cliente não tem física própria: sem `cannon-es` nem corpos físicos em `src/` (só no Node) |
| `npm run test:full-match -w apps/client` | Partida de 8-ball contra a IA até o fim, no navegador (F1-07); leva cerca de 2 a 4 min e exige Chromium |
| `npm run test:local-2p -w apps/client` | Partidas locais de 2 jogadores de 8-ball e 9-ball até o fim, no navegador (F2-05); cerca de 2 a 4 min |
| `npm run test:online-unit -w apps/client` | Cliente online no Node, sem servidor: configuração, `OnlineSession` (com um `nakama-js` falso), `OnlineMatchController` e o painel online |
| `npm run test:online-game -w apps/client` | O `Game` jogando online contra um servidor falso na própria página (`src/dev/FakeOnlineController.js`): tacadas, tempo esgotado, volta no meio da reprodução, fim, mira e bola na mão do adversário; no navegador |
| `npm run test:online -w apps/client` | Dois navegadores jogam online de ponta a ponta contra um Nakama de verdade (F4-10, F4-11): partida inteira de 8-ball, fila de 9-ball, queda e recarga. Fora do `npm test`; usa `NAKAMA_URL` (padrão `http://127.0.0.1:7350`, `http://server:7350` para o servidor da rede, `https://` para a produção). Cerca de 3 min; roda na integração do GitHub Actions |
| `npm test` | Todas as suítes de todos os workspaces (`apps/*`, `packages/*`), incluindo as de navegador (exigem Chromium) |
| `npm run build` | Build de produção (saída em `apps/client/dist`) |
| `npm run infra:up` / `npm run infra:down` | Sobe e derruba o Nakama 3.41.0, o PostgreSQL 16 e o serviço de simulação (`services/sim`) locais (Docker Compose em `infra/`); precisa do Docker e de `SIM_SECRET` no `infra/.env` |
| `npm test -w services/sim` | O serviço de simulação (F4-A): segredo, versões N e N−1, limites do corpo e o formato da resposta; o servidor HTTP roda no próprio processo do teste, sem Docker |
| `npm test -w services/nakama` | Testes unitários do módulo do Nakama (partida, mensagens, prazos, reserva, histórico) com um `nk` falso, mais a checagem do bundle; sem Docker |
| `npm test -w packages/protocol` | Contrato do protocolo: mensagens, quantização, envelope, trajetória v1 e a conferência de que `docs/protocol.md` descreve todas as operações e recusas |
| `npm run test:integration -w services/nakama` | Bots com `nakama-js` contra o servidor local: contas, perfil, salas e matchmaking (F3) e a partida online (F4-A: tacadas, reconexão, W.O., histórico e uma partida inteira de 8-ball). Leva alguns minutos (há testes de 45 s e 60 s). Também roda no GitHub Actions a cada push (D051) |
| `npm run typecheck` | `tsc -p tsconfig.json` sobre `packages/*/src` |
| `npm run infra:prod:up` / `infra:prod:logs` / `infra:prod:stop` | Produção com TLS (D065): confere o `infra/.env` (`infra/check-env.mjs`), sobe o stack com o Caddy (`infra/docker-compose.prod.yml`), acompanha os logs, para sem apagar volumes. Passo a passo em `docs/f4/implantacao.md` |
| `npm run test:infra` | O `check-env`, o `gen-secrets` e as portas do compose de produção (esta parte precisa do Docker e é pulada sem ele) |

Testes de navegador neste contêiner: `CI=1 PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run test:smoke -w apps/client`. Numa máquina Windows sem o Chrome que o Puppeteer fixa, aponte `PUPPETEER_EXECUTABLE_PATH` para o Chrome instalado (por exemplo, `"/c/Program Files/Google/Chrome/Application/chrome.exe"` no Git Bash). Com `CI=1` (swiftshader), o tempo da partida completa ainda não foi medido.
