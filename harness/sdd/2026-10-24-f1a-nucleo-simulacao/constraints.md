Global constraints (verbatim from the plan, docs/superpowers/plans/2026-10-24-f1a-nucleo-simulacao.md):
- Node ≥ 22.12. Nenhum passo de build para rodar JS ou TS: testes com `node --test`, TS com importações `.ts` explícitas.
- `packages/sim/src` não importa `three` nem usa `document`, `window`, `localStorage`, `performance` ou `Math.random`. JavaScript com `// @ts-check` em todos os arquivos de `src/`.
- `packages/protocol` é TypeScript com sintaxe apagável (`erasableSyntaxOnly`): sem `enum`, `namespace` nem propriedades de parâmetro.
- Unidades em centímetros; passo de 1/360 s; guardas a cada 6 passos com `dt = 1/60`; amostras da trajetória a cada 12 passos (30 Hz); limite de 7200 passos (20 s). Contadores inteiros de passo: o tempo é sempre `passo / 360`, nunca acumulado em ponto flutuante.
- Tacada: direção `(cos angle, sin angle)` no plano XZ; `power` limitado a `SHOT.maxPower` (110); `spin` normalizado quando o comprimento passa de 1 (como `ShotInput.js`).
- Constantes de física copiadas literalmente de `apps/client/src/config.js` e `apps/client/src/game/TableProfiles.js`, incluindo o helper `cm()`.
- Durante a F1-A, `apps/client/src` muda apenas pela mudança de lugar (Tarefa 1). A física do cliente continua a legada.
- Commits em inglês (conventional commits); documentos em PT-BR.
Project rules (CLAUDE.md): decisions.json is append-only (new id; supersede old with status "superseded" + "supersededBy"); feature_list "passes": true only after running its verification; never commit secrets; commits end with the Co-Authored-By trailer your own session's attribution instruction gives you, followed by:
Claude-Session: https://claude.ai/code/session_018UT5KLJNAATd3p2z9KPLoT
