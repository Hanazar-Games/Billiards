# Progresso

## Estado atual

- **Fase:** F1-A em execução por subagentes (plano `docs/superpowers/plans/2026-10-24-f1a-nucleo-simulacao.md`, aprovado; D035–D037 aceitas).
  - Tarefa 1 concluída e revisada (`52b543d`): monorepo com npm workspaces, jogo movido para `apps/client`.
  - Tarefa 2 concluída e revisada (`19dfb36`, `baa6871`): `packages/sim` com constantes, geometria da mesa e mundo, idênticos ao legado nos 4 perfis (6 testes).
  - Tarefa 3 concluída e revisada (`846c667`). Bolas, guardas e `simulateShot` têm paridade bit a bit com o legado a 60 Hz fixo (5 tacadas, e as 13 do corpus conferidas pelo implementador); 21 testes.
    - Os três encaçapes do corpus viraram cortes: na versão original, a branca seguia a bola 1 para a caçapa, inclusive no legado.
    - O resultado não muda com ±3 de força nem a 30, 60, 120 e 144 FPS no legado.
  - Tarefas 4 a 10 pendentes.
- **Resultado da F0:** a física autoritativa fica no `services/sim` em Node (D017). No goja do Nakama, a simulação foi cerca de 175 vezes mais lenta. Relatório: `docs/spikes/2026-10-24-runtime-simulacao.md`.
- **Branch de trabalho:** `claude/planejamento-online`, mantida sem merge na `main` por escolha do usuário (2026-10-24).
- **Base:** Hanazar-Games/Billiards v1.26.13 (`0448b03`). O código do jogo agora está em `apps/client/`, sem alteração de conteúdo.
- **Registro da execução da F1-A:** `harness/sdd/2026-10-24-f1a-nucleo-simulacao/ledger.md` (decisões de execução, pendências por tarefa, commits), com as restrições passadas aos subagentes (`constraints.md`) e os relatórios das Tarefas 1 e 2.

## Próximo passo

1. Seguir para a Tarefa 4 (eventos) a partir de `HEAD` (as Tarefas 1 a 3 têm `Task N: complete` no ledger).
2. Para retomar com a skill `superpowers:subagent-driven-development` no ambiente local, copie o ledger para a pasta de trabalho da skill, que é ignorada pelo git: `mkdir -p .superpowers/sdd/2026-10-24-f1a-nucleo-simulacao && cp harness/sdd/2026-10-24-f1a-nucleo-simulacao/{ledger.md,constraints.md} .superpowers/sdd/2026-10-24-f1a-nucleo-simulacao/ && mv .superpowers/sdd/2026-10-24-f1a-nucleo-simulacao/ledger.md .superpowers/sdd/2026-10-24-f1a-nucleo-simulacao/progress.md`. A skill continua da primeira tarefa sem a linha `Task N: complete`.
3. Seguir as Tarefas 4 a 10 do plano. Antes de cada commit e push, copie o ledger de volta para `harness/sdd/…/ledger.md`.
4. No ambiente local, rode `bash harness/init.sh` (Node ≥ 22.12), porque o hook SessionStart só roda na nuvem. Os testes de navegador precisam de Chromium: o Puppeteer baixa um na instalação, a menos que `PUPPETEER_SKIP_DOWNLOAD` esteja definido.

## Pendências da execução da F1-A (para a Tarefa 10 ou depois)

- Da revisão da T1: o `CLAUDE.md` ainda diz "Durante a F0, não altere `src/`, `server/` nem `test/`", e esses caminhos agora ficam em `apps/client/`. No README, `PAGES_OUT_DIR` e `DIST_DIR` passaram a ser relativos a `apps/client`. O comentário do `init.sh` ainda fala do monorepo como algo futuro.
- Da revisão da T2: `BALL`, `SHOT` e os perfis são objetos mutáveis e compartilhados (congelar depois; `PHYSICS.gravity` é um `Float32Array`). O `index.js` reexporta `normalize` e `cross`, que viram API pública.
- Da revisão da T3:
  - **Branca com bola na mão:** se a branca vem encaçapada na entrada, o `simulateShot` lança erro mesmo quando recebe `shot.cueBall`. Na bola na mão depois de uma falta, quem chama precisa marcar `pocketed: false` antes, ou o sim passa a aceitar que o `cueBall` traga a branca de volta. Decidir na F2/F4, com a camada de modos, e incluir um teste.
  - **Validação extra sem teste:** `maxSimSeconds`, ids, `q`, x/z e `cueBall` inválidos não têm teste. Um `spin` ausente gera `TypeError`; a camada do protocolo deve validar o formato.
  - **Relógio no `legacy-run.js`:** é restaurado com `delete performance.now`; o certo é salvar e restaurar o descritor.
  - **Paridade do `draw-rack`:** até a calibragem da T8, ela só exercita a branca.

## Pendências menores (revisão final da F0)

- `compare.json` não é estritamente reproduzível: as execuções legadas dependem do corte de subpassos por relógio do cannon-es. Congelar o relógio ou aquecer antes, e anotar no relatório.
- O teste comportamental não detecta mundo sem tabelas (`_enforceTableBounds` salva as bolas): na F1, verificar que há eventos de colisão com a tabela na abertura.
- Falta teste para o limite de 20 s; o acúmulo de `simSeconds` em ponto flutuante passa um passo. Na F1, usar contador inteiro de passos.
- A semente não muda o resultado (a orientação das bolas é cosmética): `packages/sim` não precisa de gerador aleatório; o teste de determinismo não detecta aleatoriedade sem semente.
- D017 editada no lugar perdeu o texto dos critérios pré-registrados e manteve o motivo desatualizado ("desempenho desconhecido"); falta uma linha no `CLAUDE.md` dizendo como resolver entradas `pending-spike`.
- Relatório: "shims necessários" → "instalados por ausência"; o "p95" do goja é o máximo de 3 amostras; quantificar a divergência Node × goja (os passos são idênticos); a tabela do goja omite passos, tempo simulado e `capped` (iguais ao Node); spec §4 item 2 ainda diz "ainda não medido".

## Registro de sessões

### 2026-10-24 — sessão 1

- Análise do repositório base: física acoplada a Three.js, física customizada por frame (dependência de FPS), LAN autoritativo no host, regras para 2 jogadores, skins como presets, sem mão na cena, interface em chinês, efeito de tabela aplicado no tratador de colisões do `Game.js`.
- Decisões de produto com o usuário: F2P com venda de skins, só web, formatos 1×1, 2×2, cada um por si e espectadores, Abordagem 1 (Nakama + serviço de simulação em Node).
- Seções 1 e 2 do design aprovadas; Seções 3–6 aceitas pela recomendação.
- Criados: spec, roteiro de fases, plano da F0, harness (`CLAUDE.md`, `harness/*`, hook SessionStart).
- Linha de base: 15 suítes de teste do Node passando (6 s); `test:smoke` com Chromium pré-instalado: 54/54 (81 s).

### 2026-10-24 — sessão 1 (execução da F0, modo nativo)

- Spike em `spikes/sim-bench/`, com 5 tarefas e 5 testes. Medições no Node 22.22 e no Nakama 3.41.0 (Docker), com o bundle único do esbuild.
- Resultados: abertura com passo fixo de 128 ms no Node (mediana) e 22,4 s no goja; diferença de até 138 cm entre 60 e 144 FPS; Node e goja divergem em 2 de 5 tacadas.
- Decisões: D017 resolvida (física fora do Nakama); D031 e D032 criadas e depois substituídas por D034 (meta relativa) e D033 (tolerância medida no legado) após a revisão final; F1-09 (calibragem do recuo) acrescentado.
- Revisão final por revisor independente: pronto para mesclar com correções; 3 problemas importantes corrigidos, menores listados acima.
- Suíte completa (`npm test`, com navegador) verde em 5 min. O usuário escolheu manter a branch como está, sem merge nem PR.

### 2026-10-24 — sessão 1 (planejamento da F1-A)

- Sondagens com o harness do spike: trajetória da abertura cabe em 24,7–35,4 KB; aplicar a física customizada a cada passo muda a sensação (tacada longa +11,5%; efeito na tabela encaçapa a branca), enquanto o ritmo fixo de 60 Hz reproduz o legado a 60 FPS; o atrito bola-mesa do cannon-es destrói o invariante de rolamento (recuo quebrado) e removê-lo conserta o recuo mas alonga as outras tacadas 14–21%.
- Node 22.22 executa TypeScript direto, inclusive importado pelo nome de um pacote do workspace.
- Plano da F1-A escrito (10 tarefas); roteiro com a F1 dividida em F1-A e F1-B; decisões D035–D037 propostas (`open`).

### 2026-10-24 — sessão 1 (execução da F1-A por subagentes)

- O usuário aprovou o plano da F1-A e escolheu execução por subagentes. Um implementador por tarefa, depois um revisor independente (conformidade com o enunciado e qualidade).
- Tarefa 1 (`52b543d`), monorepo: revisão aprovada; 6 pendências menores de documentação ficaram para a T10. A suíte completa deu o mesmo resultado antes e depois da mudança.
- Tarefa 2 (`19dfb36` e `baa6871`), mesa e mundo: revisão aprovada. Rodada extra de reforço dos testes: orientações comparadas de forma exata, ordem dos corpos e pares de materiais fixados, verificação de importações proibidas mais ampla.
- Tarefa 3 (`846c667`), executada por um implementador mais capaz por causa da paridade bit a bit, chegou a 21 testes passando.
  - O implementador parou uma vez: os encaçapes do corpus faziam a branca entrar junto, como no legado, e ajustar só a força dava um resultado instável.
  - Decisão: transformar os encaçapes em cortes, mantendo a força e o critério `[1]`.
  - Revisão independente aprovada, sem problemas críticos ou importantes; os achados menores estão nas pendências acima. O revisor também mostrou que a paridade detecta uma falha: sem o efeito de tabela, o hash da abertura muda.
  - O registro da execução foi copiado para `harness/sdd/` para o usuário continuar no ambiente local. A Tarefa 4 não foi iniciada na nuvem.

