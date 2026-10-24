# Billiards Online

Fork definitivo de Hanazar-Games/Billiards (sinuca 3D com Three.js + cannon-es) que está sendo transformado em um jogo online free-to-play com Nakama. O código em `apps/client/src/` ainda é o jogo original; a nova arquitetura está descrita na spec.

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
- Durante a F0, não altere `src/`, `server/` nem `test/`: o spike só lê o código existente.

## Comandos

| Comando | O que faz |
|---------|-----------|
| `bash harness/init.sh` | Instala dependências, roda os testes rápidos e mostra o status |
| `node harness/status.mjs` | Mostra só o status (fase, itens pendentes, decisões em aberto) |
| `npm run dev` | Servidor de desenvolvimento do jogo (porta 5173; roda `apps/client`) |
| `npm run test:rules -w apps/client` | Testes das regras (28); as outras suítes do cliente seguem o mesmo padrão (`test:<nome>`) |
| `npm test` | Todas as suítes de todos os workspaces (`apps/*`, `packages/*`), incluindo as de navegador (exigem Chromium) |
| `npm run build` | Build de produção (saída em `apps/client/dist`) |
| `npm run typecheck` | `tsc -p tsconfig.json` sobre `packages/*/src` |

Testes de navegador neste contêiner: `CI=1 PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run test:smoke -w apps/client`.
