# Progresso

## Estado atual

- **Fase:** F1-A concluída. F1-B executada (8 tarefas, plano `docs/superpowers/plans/2026-10-25-f1b-cliente-usa-sim.md`, D042 e D043 `accepted`); falta só a confirmação do F1-09 pelo usuário, no navegador. Plano da F1-A: `docs/superpowers/plans/2026-10-24-f1a-nucleo-simulacao.md`.
  - **F1-B, T1–T7** (`17a96ff` a `c59a806`, cada uma com revisão da tarefa; a T8 é este fechamento):
    - Cópia congelada da física legada (D042), com manifesto SHA-256: paridade, sensação e benchmark não dependem mais do cliente.
    - Worker de simulação (`SimWorkerClient`, `simClient`) e `TrajectoryPlayer`.
    - O `Game` reproduz as tacadas do worker (`ShotPlayback`, `toTableState`/`applyTableState`, `_simulateShot`, `_onSimEvent`).
    - A física legada e o `cannon-es` saíram do cliente.
    - Gancho só de desenvolvimento, `__referenceShot(name)`: a `draw-ref` recua 61,1 cm no jogo, como na D041.
    - Partida completa de 8-ball contra a IA termina no navegador (37 a 71 tacadas do humano, 100 a 230 s localmente). Verifica o F1-07.
  - **F1-07 marcado** depois de rodar a verificação (`test:full-match`, dentro de `npm test`). **F1-09 continua `false`**: a parte do sim está feita (F1-A) e falta o usuário confirmar no jogo, seguindo `docs/f1/roteiro-teste-manual.md`.
  - A revisão final da F1-B, sobre a branch inteira, está em andamento; o resultado entra neste arquivo quando vier.
  - **T1–T3** (`52b543d`, `19dfb36`, `baa6871`, `846c667`): monorepo e `packages/sim` com paridade bit a bit com o legado a 60 Hz fixo.
  - **T4–T6** (`4dbafba`, `b9cbdff`, `694777e`): eventos, trajetória a 30 Hz e o codec v1 em `packages/protocol`. A abertura ocupa 36,0 KB.
  - **T7** (`43f5188`, `832b860`): teste de sensação 11/11 dentro do envelope do legado em 14 taxas de quadro. O usuário aceitou a D038, que substitui a D035.
  - **T8** (`147d5cb`, `2b83739`, `f0c20fa`): recuo calibrado pela D041, escolhida pelo usuário em 2026-10-25 (opção 1 da D039). Sem o atrito bola-mesa do cannon-es, a branca da `draw-ref` volta 61 cm e o invariante 2,5v + ωR se conserva. Long-stun, pot-corner e pot-side mudaram de sensação: a referência delas passa a ser o sim calibrado, com as margens da D038, e as outras 8 tacadas seguem no envelope do legado. Tentativas e decisão em `docs/f1/calibragem-recuo.md`.
    - De passagem, foi corrigido um travamento (`147d5cb`): o cannon-es empacota os ids dos corpos em 16 bits e usa um contador global. Num servidor, depois de uns 3 mil tacadas no mesmo processo, `simulateShot` lançaria erro. Agora cada mundo numera os próprios corpos.
  - **T9** (`86039bc`): abertura em 45 ms, contra 122 ms do spike (2,69×). A troca é o broadphase com caixas (AABB) em vez de esferas, com física idêntica: golden e paridade não mudaram.
  - **T10:**
    - F1-01 a F1-06 e F1-08 marcados depois de rodar cada verificação.
    - A paridade agora cobre 4 tacadas de uma bola, incluindo o efeito na tabela (`bc93f7b`).
    - Decisão D040: o critério "sem `three`" do F1-02 vale para `packages/sim/src`.
    - Roteiro, spec e documentos atualizados.
- **Resultado da F0:** a física autoritativa fica no `services/sim` em Node (D017). No goja do Nakama, a simulação foi cerca de 175 vezes mais lenta. Relatório: `docs/spikes/2026-10-24-runtime-simulacao.md`.
- **Branch de trabalho:** `claude/planejamento-online`, mantida sem merge na `main` por escolha do usuário (2026-10-24).
- **Base:** Hanazar-Games/Billiards v1.26.13 (`0448b03`). O código do jogo agora está em `apps/client/`, sem alteração de conteúdo.
- **Registro da execução da F1-A:** `harness/sdd/2026-10-24-f1a-nucleo-simulacao/ledger.md` (decisões de execução, pendências por tarefa, commits), com as restrições passadas aos subagentes (`constraints.md`) e os relatórios das Tarefas 1 e 2.

## Próximo passo

1. **O usuário confirma o F1-09** no navegador, seguindo `docs/f1/roteiro-teste-manual.md` (`npm run dev`, Treino livre, `await __referenceShot('draw-ref')` no console). Se a branca voltar como esperado, marcar `passes: true` e registrar a data; se não, abrir uma decisão nova sobre o recuo (a D041 aceitou a sensação medida).
2. **Escrever o plano da F2** (`packages/modes` com N lugares) com `superpowers:writing-plans` e pedir a revisão do usuário antes de implementar. Considerar nele as pendências da F1-B abaixo.
3. No ambiente local, rode `bash harness/init.sh` (Node ≥ 22.12), porque o hook SessionStart só roda na nuvem. Os testes de navegador precisam de Chromium. O Puppeteer baixa um na instalação, a menos que `PUPPETEER_SKIP_DOWNLOAD` esteja definido. Sem esse download, aponte `PUPPETEER_EXECUTABLE_PATH` para o Chrome do sistema.

## Pendências da F1-B (não bloqueiam; para a F2 ou depois)

- **Sem vigia do worker:** se o worker nunca responder, a tacada fica em `SHOOTING`. O limite antigo de 20 s do relógio da física saiu com a física legada.
- **Tacada cancelada conta nas estatísticas:** `_cancelShot` repete o turno, mas a tacada já entrou em `statsTracker`.
- **Convidado da LAN sem rastro da tacada:** os snapshots perdem as velocidades, então o convidado não desenha mais o rastro.
- **Constantes mortas:** os ajustes de física de `BALL` em `apps/client/src/config.js` não são mais lidos pelo cliente.
- **README:** ainda apresenta o `cannon-es` como a física do cliente.
- **Partida completa sob `CI=1`:** o tempo com swiftshader (renderização por software) não foi medido; o teste tem limite de 600 s. Se estourar, registrar uma decisão (limite maior ou partida com semente), sem afrouxar a asserção.
- **Replays:** continuam no formato antigo, gravado dos meshes (D043); a migração para a trajetória v1 fica para a F4.

## Pendências da execução da F1-A (para a Tarefa 10 ou depois)

- Da revisão da T2: `BALL`, `SHOT` e os perfis são objetos mutáveis e compartilhados (congelar depois; `PHYSICS.gravity` é um `Float32Array`). O `index.js` reexporta `normalize` e `cross`, que viram API pública.
- Da revisão da T3:
  - **Branca com bola na mão:** se a branca vem encaçapada na entrada, o `simulateShot` lança erro mesmo quando recebe `shot.cueBall`. Na bola na mão depois de uma falta, quem chama precisa marcar `pocketed: false` antes, ou o sim passa a aceitar que o `cueBall` traga a branca de volta. Decidir na F2/F4, com a camada de modos, e incluir um teste.
  - **Validação extra sem teste:** `maxSimSeconds`, ids, `q`, x/z e `cueBall` inválidos não têm teste. Um `spin` ausente gera `TypeError`; a camada do protocolo deve validar o formato.
  - **Relógio no `legacy-run.js`:** é restaurado com `delete performance.now`; o certo é salvar e restaurar o descritor.
  - **Paridade do `draw-rack`:** roda com `TUNING_LEGACY`, em que a branca não alcança o rack, então só exercita a branca. Com o `TUNING` da D041 o rack é atingido, mas isso só o golden cobre.
- Da revisão final da F1-A (autorrevisão, sem subagente):
  - A chave de par de `events.js` (`a * 256 + b`) colide para ids ≥ 256. O sim aceita qualquer id inteiro não negativo, e o codec limita a 255.
  - Eventos `ball_cushion` não têm deduplicação: uma bola encostada na tabela ou resgatada pelas guardas pode gerar eventos extras. As regras da F2 não devem contar tabelas só pelo número de eventos.
  - Os quadros param no último múltiplo de 12 passos, então até 1/60 s de movimento (e um encaçape nesse intervalo) só aparece no estado final.

## Pendências menores (revisão final da F0)

- `compare.json` não é estritamente reproduzível: as execuções legadas dependem do corte de subpassos por relógio do cannon-es. Congelar o relógio ou aquecer antes, e anotar no relatório.
- A semente não muda o resultado (a orientação das bolas é cosmética): `packages/sim` não precisa de gerador aleatório; o teste de determinismo não detecta aleatoriedade sem semente.
- D017 editada no lugar perdeu o texto dos critérios pré-registrados e manteve o motivo desatualizado ("desempenho desconhecido"); falta uma linha no `CLAUDE.md` dizendo como resolver entradas `pending-spike`.
- Relatório: "shims necessários" → "instalados por ausência"; o "p95" do goja é o máximo de 3 amostras; quantificar a divergência Node × goja (os passos são idênticos); a tabela do goja omite passos, tempo simulado e `capped` (iguais ao Node).

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

### 2026-10-24 — sessão 2 (ambiente local, execução inline da F1-A)

- O usuário pediu para continuar de forma autônoma. A execução seguiu inline com `superpowers:executing-plans`: o usuário não pediu subagentes desta vez, e o plano admite os dois modos.
- A branch `claude/planejamento-online` avançou até a `main` (`f64ebfd`, merge do PR #2, sem mudança de conteúdo).
- T4 (`4dbafba`): eventos da tacada. O guarda varrido deixa o par a 0,995 × 2r, e o cannon reportava o mesmo impacto no passo seguinte; esse contato repetido agora é descartado. Os recontatos reais, a 4 passos ou mais, continuam.
- T5 (`b9cbdff`): trajetória a 30 Hz. O `checkPockets` agora devolve onde a bola estava ao ser encaçapada, para a reprodução não teleportar a bola para o centro da mesa.
- T6 (`694777e`): codec binário v1. Tamanhos: abertura 36,0 KB, english 35,4 KB, medium 29,7 KB, demais ≤ 6,3 KB.
- T7: infraestrutura pronta (métricas com testes unitários, gancho por quadro no `runLegacy`, `placeLegacyTable`, gerador da referência reprodutível). A verificação de mutação passou: com `rollingResistance: 30`, as 11 tacadas falham. Duas tacadas saem do envelope da D035; a D038 foi registrada como `open`, e a execução parou para o usuário decidir.
- Os testes do pacote `sim` passam: 48, mais 2 `todo`. O protocol tem 7 testes, e o `tsc` está limpo. A suíte completa com navegador não foi rodada nesta sessão; ela fica para a T10.


### 2026-10-24 — sessão 2, continuação (D038 aceita; Tarefas 7 a 10)

- O usuário aceitou a D038. A referência foi gerada nas 14 taxas, a D035 passou a `superseded`, e a sensação fica 11/11 (`832b860`). A Tarefa 7 está concluída.
- T8: o diagnóstico está em `docs/f1/calibragem-recuo.md`.
  - O atrito bola-mesa do cannon-es leva a bola ao rolamento no primeiro passo e conserva 1,5v + ωR. É isso que mata o recuo, mas o envelope de sensação foi medido nesse comportamento.
  - Foram mais de 800 ajustes e 2 mudanças de modelo (revertidas). Nenhum passou nos três critérios, e a `pot-side` falhou em todos. A execução parou na D039 (`open`), como o plano manda; os testes de recuo rodam como `todo` (`2b83739`).
  - De passagem, foi corrigido um travamento com mais de 65 536 corpos no mesmo processo (`147d5cb`) e foi acrescentada a opção de diagnóstico `probe`.
- T9 (`86039bc`): broadphase com AABB, 2,69× mais rápido que o spike (45 ms contra 122 ms), com física idêntica.
- T10:
  - A paridade agora cobre tacadas de uma bola, incluindo o efeito na tabela (`bc93f7b`). O teste de mutação passou: sem `applyCushionSpin`, 8 das 9 falham.
  - D040 registrada (F1-02 vale para `src`).
  - Critérios do F1-03 e do F1-06 alinhados à D036 e à D038; F1-01 a F1-06 e F1-08 marcados.
  - Roteiro, spec, `CLAUDE.md`, README e `init.sh` atualizados.
  - A suíte completa rodou com o Chrome do sistema: o Puppeteer não tinha baixado o seu.
- Revisão final: autorrevisão, sem subagente, porque o usuário não pediu subagentes nesta sessão. Ela não achou nada crítico nem importante, e as 3 pendências menores foram para a lista acima.

### 2026-10-25 — sessão 2, continuação (D039 decidida; Tarefa 8)

- O usuário escolheu a opção 1 da D039: aceitar a sensação nova com o melhor ajuste medido. Registrada a D041 (`accepted`); a D039 passou a `superseded`.
- T8 (`f0c20fa`): `TUNING` = tentativa 6. Os testes de recuo saíram de `todo`, falharam (sem contato; 220,7 → 20,2) e passaram com o ajuste (recuo de 61,1 cm; 367,9 → 370,3).
  - Long-stun, pot-corner e pot-side usam como referência o sim calibrado (`test/feel/sim-reference.json`, de `tools/sim-reference.mjs`), com as margens da D038. Um teste fixa essa lista em 3 tacadas; as outras 8 seguem no envelope do legado.
  - Antes do `golden:update`, só o golden falhava, como o plano previa; depois, 58/58 no `sim`.
  - O teste de materiais da T2 passou a usar `TUNING_LEGACY` explicitamente, porque compara com o mundo legado.
  - Com o `TUNING` novo, o benchmark deu 3,69× (≥ 1,3×) e as trajetórias encolheram: abertura 26,8 KB, english 33,1 KB, medium 21,6 KB (limite de 48 KB). O `tsc` está limpo.
- F1-06: critérios alinhados à D041 (continua `passes: true`, verificado pelo teste de sensação 12/12). F1-09: parte do sim feita; falta a confirmação no navegador (F1-B).

### 2026-10-25 — sessão 2, continuação (plano da F1-B)

- Plano da F1-B escrito com `superpowers:writing-plans`: `docs/superpowers/plans/2026-10-25-f1b-cliente-usa-sim.md`, em 8 tarefas.
  - Cópia congelada do legado para os testes do sim.
  - Worker de simulação e `TrajectoryPlayer`.
  - O `Game` reproduz as tacadas do worker, e a física legada sai do cliente.
  - Tacadas de referência no navegador (F1-09) e partida de 8-ball contra a IA até o fim (F1-07).
  - Fechamento.
- Achado no planejamento: a paridade, a referência de sensação e o benchmark carregam a física legada direto de `apps/client/src` (10 arquivos, 3.668 linhas). Por isso o plano propõe a D042 (cópia congelada com manifesto) antes de tirar a física do cliente.
- D043 proposta: os replays continuam no formato atual na F1-B; a migração para a trajetória v1 fica para a F4.
- Fora do escopo, registrado no plano: `LocalMatchController` (F2), linha-guia com a geometria do sim e divergência entre navegadores com Playwright.

### 2026-10-25 — sessão 2, continuação (execução da F1-B por subagentes; Tarefa 8)

- O usuário aprovou o plano da F1-B com a D042 e a D043 (`accepted`) e escolheu a execução por subagentes: um implementador por tarefa e uma revisão por tarefa. As Tarefas 1 a 7 estão feitas (`17a96ff` a `c59a806`). A Tarefa 8 é este fechamento.
- O que mudou no cliente:
  - Cópia congelada da física legada (D042), com manifesto SHA-256: paridade, sensação e benchmark do `packages/sim` não leem mais `apps/client`.
  - Worker de simulação (`SimWorkerClient`, `simClient`) e `TrajectoryPlayer` (reproduz a trajetória v1 em qualquer taxa de quadros, com os eventos no instante certo).
  - O `Game` reproduz as tacadas vindas do worker (`ShotPlayback`, `toTableState`/`applyTableState`, `_simulateShot`, `_onSimEvent`). A física legada e o `cannon-es` saíram do cliente.
  - Gancho só de desenvolvimento, `__referenceShot(name)`: a `draw-ref` recua 61,1 cm no jogo, como na D041.
  - Partida completa de 8-ball contra a IA termina no navegador, sem erros no console: 37 a 71 tacadas do humano, 100 a 230 s localmente.
- Tarefa 8:
  - Subteste de tacada no build de produção (`dist-smoke`): primeiro falhou contra o `dist` rastreado, anterior ao worker (o jogo antigo não tem `playback`), e passou com o build novo (7/7, com o worker no pacote). O `dist` rastreado foi restaurado e nada dele foi commitado.
  - Suíte completa com o Chrome do sistema: `npm test` na raiz saiu com 0 (client: rules 28, table 34, lan 20, ai 11, audio 6, instant-replay 30, career 51, ui-layout 10, settings-audit 15, trainer-challenge-safety 25, achievement-toast 8, tournament 15, highlight 22, panels 12, runtime 67, sim-worker 6, trajectory-player 11, no-legacy-physics 2, browser 29, full-match 1 (40 tacadas, 130 s), smoke 54; protocol 7; sim 60). `tsc` limpo.
  - F1-07 marcado, porque `test:full-match` passou na suíte completa. F1-09 continua `false`.
  - `init.sh`: as três suítes novas que rodam só no Node entram em `FAST_SUITES`. `CLAUDE.md` e o roteiro refletem o estado novo.
- Pendências conhecidas, sem bloqueio, na seção "Pendências da F1-B". A revisão final da F1-B sobre a branch inteira está em andamento; o controlador acrescenta o resultado.
