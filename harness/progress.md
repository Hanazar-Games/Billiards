# Progresso

## Estado atual

- **F4-B executada, menos a produção** (plano [`2026-10-27-f4b-cliente-online-implantacao.md`](../docs/superpowers/plans/2026-10-27-f4b-cliente-online-implantacao.md), execução nativa; D063 a D066 `accepted`, a D053 passou a `superseded` pela D064). F4-08 a F4-12 marcados; o F4-13 espera a máquina e o domínio do usuário:
  - **Cliente online:** `src/online/config.js` (`VITE_NAKAMA_URL` e `VITE_NAKAMA_SERVER_KEY`; sem URL no build de produção, "indisponível"); `OnlineSession` (convidado por dispositivo, RPCs de perfil e sala, fila 1×1, entrada com `protocolVersion`, reconexão dentro da reserva de 60 s, sessão renovada antes de vencer); `OnlineMatchController` (a interface do `LocalMatchController`, guiada pelo servidor, com o reenvio idempotente da tacada em trânsito e a mira e a bola na mão em até 10 por segundo); o caminho online do `Game` em `src/game/onlineGame.js` (tacada do adversário, tempo esgotado do servidor, push-out, snapshot da volta com o deslocamento, fim com "Vitória!" ou "Derrota", taco e bola na mão do adversário); e o painel "🌐 Jogar online" (`OnlinePanel`: nome, filas de 8-ball e 9-ball, sala com código, entrar com código e a volta à partida depois de recarregar a página).
  - **Servidor:** as APIs nativas fora do uso do jogo são recusadas com `NATIVE_API_CLOSED` (D064).
  - **CI (D066):** o `deploy.yml` usa o Node 24 e o caminho do próprio repositório; o `integration.yml` roda o `test:infra`, a integração e os dois navegadores (`test:online`) contra a pilha do runner, com `timeout-minutes: 35`.
  - **Produção com TLS (D065):** `infra/docker-compose.prod.yml` com o Caddy 2.10.0 nas portas 80 e 443 e o console só em `127.0.0.1:7351`, `infra/Caddyfile`, `infra/check-env.mjs`, `infra/gen-secrets.mjs`, os scripts `infra:prod:up`, `infra:prod:logs` e `infra:prod:stop` e o passo a passo `docs/f4/implantacao.md`.
  - **Verificações:** GitHub Actions **40547757267** e **40556758176** (integração 33 de 33 e `test:online` 4 de 4; na segunda, também o `test:infra`, que confere as portas do compose de produção e na CI não é pulado); `test:online` 4 de 4 duas vezes contra o `server` (8-ball em 28 tacadas e 77 s); suíte local verde, menos o `test:browser`, que estoura os 180 s do próprio arquivo nesta máquina (pendência antiga, da F4-A).
- **F4-A concluída** (plano [`2026-10-26-f4a-partida-online-servidor.md`](../docs/superpowers/plans/2026-10-26-f4a-partida-online-servidor.md), execução por subagentes, D054 a D059 e D062 `accepted`; a D060 e a D061 passaram a `superseded` pela D062). O servidor autoritativo da partida online 1×1 está pronto e verificado com bots:
  - contrato em `packages/protocol` (operações, leitores, quantização, envelope binário, trajetória v1), mesa autoritativa em `packages/modes` (`rackTable`, `placeCueBall`, `respotBalls`, `isCueBallPlacementValid`), `services/sim` (HTTP com segredo e versões N e N−1, em contêiner próprio) e a partida em `services/nakama` (snapshot, tacada, regras, cronômetro, reconexão, W.O., desistência e histórico);
  - `docs/protocol.md` descreve o protocolo v1 (as operações, o envelope, a trajetória, a quantização, os motivos de recusa, os prazos, a reconexão e o `match_history`), e um teste confere que ele cita toda operação e recusa;
  - a integração passou no GitHub Actions na execução **40380325534** (32 testes, nenhum falhou), com dois bots jogando uma partida inteira de 8-ball até o fim e o registro em `match_history` conferido. F4-01 a F4-07 marcados;
  - a revisão final da branch da F4-A ("With fixes") está corrigida (D062): a bola na mão fica 0,01 cm longe de encostar no nariz da tabela (`cushionInset` = 10,594 cm, derivado das constantes do sim) e de outra bola (2R + 0,01 cm); a linha da cabeceira entra na `kitchen`; o `match_history` traz todas as decisões (`decisions`, com tacadas, vezes perdidas por tempo e escolhas de push-out); a segunda aba no saguão derruba a conexão antiga; e o `docs/protocol.md` corrige o `turnId` da próxima tacada e o `playback` da tacada de força 0. Integração verde na execução **40408461222** (32 testes, nenhum falhou);
  - falta a F4-B, o cliente online e a implantação, com plano próprio (D054).
- **Fase:** F1-A concluída. F1-B executada (8 tarefas, plano `docs/superpowers/plans/2026-10-25-f1b-cliente-usa-sim.md`, D042 e D043 `accepted`); falta só a confirmação do F1-09 pelo usuário, no navegador. Plano da F1-A: `docs/superpowers/plans/2026-10-24-f1a-nucleo-simulacao.md`.
  - **F3 concluída** (plano `docs/superpowers/plans/2026-10-25-f3-nakama-contas-salas.md`, execução nativa, D049 a D052 `accepted`). O servidor local tem Docker Compose com Nakama 3.41.0 e PostgreSQL 16, e o módulo `services/nakama` cobre contas de convidado com vínculo de e-mail, perfil validado, salas privadas com código de 6 caracteres e matchmaking 1×1. A integração passou no GitHub Actions (execução 40257461881). F3-01 a F3-05 marcados. Ver `docs/f3/servidor-local.md`.
  - **F2 concluída** (plano `docs/superpowers/plans/2026-10-25-f2-modes-n-lugares.md`, execução nativa, D045 a D047 `accepted`). F2-01 a F2-05 marcados depois de rodar as verificações na suíte completa:
    - `packages/modes` (TypeScript, sem dependências): ordem de turnos para 1×1, 2×2 (A1, B1, A2, B2) e cada um por si (pula eliminados); 8-ball e 9-ball portados, com os 28 testes de regras portados e um teste diferencial de 3.000 tacadas para cada modo contra a cópia congelada das regras legadas (D046); `MatchState` e o invariante "sempre há um lugar da vez até o fim".
    - Cliente: o `LocalMatchController` valida a tacada, simula no worker (com limite de 10 s) e decide pelo modo, e o `Game` aplica a decisão pela sequência de interface de antes. `Rules.js` e `NineBallRules.js` saíram do cliente; a arrumação vem do modo (D047).
    - Partidas locais de 2 jogadores de 8-ball e 9-ball vão até o fim no navegador (`test:local-2p`), além da partida contra a IA.
    - Revisão final da branch da F2: ver o registro da sessão.
  - **F1-B, T1–T7** (`17a96ff` a `c59a806`, cada uma com revisão da tarefa; a T8 é este fechamento):
    - Cópia congelada da física legada (D042), com manifesto SHA-256: paridade, sensação e benchmark não dependem mais do cliente.
    - Worker de simulação (`SimWorkerClient`, `simClient`) e `TrajectoryPlayer`.
    - O `Game` reproduz as tacadas do worker (`ShotPlayback`, `toTableState`/`applyTableState`, `_simulateShot`, `_onSimEvent`).
    - A física legada e o `cannon-es` saíram do cliente.
    - Gancho só de desenvolvimento, `__referenceShot(name)`: a `draw-ref` recua 61,1 cm no jogo, como na D041.
    - Partida completa de 8-ball contra a IA termina no navegador (37 a 71 tacadas do humano, 100 a 230 s localmente). Verifica o F1-07.
  - **F1-07 marcado** depois de rodar a verificação (`test:full-match`, dentro de `npm test`). **F1-09 continua `false`**: a parte do sim está feita (F1-A) e falta o usuário confirmar no jogo, seguindo `docs/f1/roteiro-teste-manual.md`.
  - **Revisão final da F1-B** (branch inteira, `2edc314..12cc725`): veredito "With fixes". As correções entraram em `afde97c`, `a8c445e`, `b277cc5`, `c9c223a` e `2c9e258`:
    - O som da tacada, o giz, a onda de impacto, o tremor, a vibração e o toque do taco saem quando as bolas começam a andar, e não mais no clique (I1). Uma tacada cancelada não toca nada. O worker já simula uma tacada curta quando a partida começa: a primeira abertura espera ~330 ms em vez de ~450 ms (build de produção, Chrome headless nesta máquina); as seguintes, 100 a 220 ms.
    - O `TrajectoryPlayer` recebe o raio da bola. Quando ela anda mais de meia volta de rolamento entre duas amostras, gira pelo arco que concorda com o rolamento: a branca da abertura e da long-stun não gira mais ao contrário (I2). O limite das amostras de 30 Hz fica na **D044, `open`**.
    - `_advancePlayback` para quando um evento tira o jogo de `SHOOTING`, sem `resolveTurn` duplo (M3). Testes mais fortes: tacada sem força, resultado velho depois de um reset com outra tacada em andamento, aviso de tacada cancelada na partida completa e gancho de desenvolvimento ausente no build (M1, M2, M4, M5).
    - O F1-09 continua esperando o usuário.
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

1. **Produção (Tarefa 9, passo 6, F4-13):** o usuário escolhe uma máquina Linux com Docker e um domínio com registro A apontando para ela (portas 80 e 443 abertas, região perto dos jogadores), ou a alternativa com Cloudflare Tunnel no `server` (D065), e segue `docs/f4/implantacao.md`: `infra/.env` com `gen-secrets`, `npm run infra:prod:up` e as variáveis `NAKAMA_URL` e `NAKAMA_SERVER_KEY` do repositório para o Pages. Depois, daqui: `NAKAMA_URL=https://<domínio> npm run test:integration -w services/nakama` e `NAKAMA_URL=https://<domínio> npm run test:online -w apps/client`. Com os dois verdes, marcar o F4-13 e fechar a F4.
2. **O `server` parou de responder nas portas 7350 e 7351** em 2026-10-27, no meio do último `test:online` (o ping responde; a conexão TCP estoura o tempo). O usuário confere a pilha lá (`docker compose -f infra/docker-compose.yml --env-file infra/.env ps`) e sobe de novo com `git pull && npm run infra:up`.
3. **O usuário confirma o F1-09** no navegador, quando quiser, seguindo `docs/f1/roteiro-teste-manual.md` (`npm run dev`, Treino livre, `await __referenceShot('draw-ref')` no console). Em 2026-10-25 o usuário preferiu adiar. Se a branca voltar como esperado, marcar `passes: true` e registrar a data; se não, abrir uma decisão nova sobre o recuo (a D041 aceitou a sensação medida).
4. No ambiente local, rode `bash harness/init.sh` (Node ≥ 22.12), porque o hook SessionStart só roda na nuvem. Os testes de navegador precisam de Chromium. O Puppeteer baixa um na instalação, a menos que `PUPPETEER_SKIP_DOWNLOAD` esteja definido. Sem esse download, aponte `PUPPETEER_EXECUTABLE_PATH` para o Chrome do sistema.

## Pendências da execução da F4-A (não bloqueiam; para a F4-B ou depois)

- **Escrita só-cria não verificada num servidor real:** o `storageWrite` com `version: '*'` numa chave que já existe deve falhar, mas nenhum caminho do módulo escreve duas vezes, então só o teste unitário (escrita que lança vira aviso) cobre isso.
- **Falhas do sim sem causa no aviso:** o `callSim` junta qualquer exceção em `SIM_TIMEOUT`, e o aviso `sim failed` não traz o status HTTP nem o texto; um `SIM_SECRET` errado aparece só como `SIM_HTTP`. Todo erro do serviço de simulação vira `SIM_INPUT_INVALID` (um defeito do motor parece entrada ruim).
- **Estado da partida a cada tick:** o `lastResult` (cerca de 37 KB em base64, mais os eventos) atravessa a fronteira Go a cada tick até o fim da partida.
- **Dois jogadores fora ao mesmo tempo:** a reserva que vence com o outro lugar fora por pouco tempo ainda encerra a partida como `ABORTED`, como o plano mandou.
- **Sem testes próprios:** o caminho da tacada vencedora, o da vez perdida com vencedor e o da terceira vez perdida do 9-ball (traçados, mas sem teste); cada caminho de fim gravando um registro (só a desistência e a partida inteira).
- **Menores:** `MS_PER_TICK` e `SECONDS.turn * TICK_RATE` repetidos em arquivos do módulo; o `ShotRequest` redeclarado em `packages/protocol` sem checagem de tipo contra o de `packages/modes`; o `typecheck` da raiz não cobre `services/sim` (sem `@types/node`); as fontes `source` de D054 a D060 ainda dizem "aguardando a revisão do usuário" (a aprovação está no registro de sessões e o arquivo só acrescenta).

## Pendências da F1-B (não bloqueiam; para a F2 ou depois)

- **Sem vigia do worker:** se o worker nunca responder, a tacada fica em `SHOOTING`. O limite antigo de 20 s do relógio da física saiu com a física legada.
- **Tacada cancelada conta nas estatísticas:** `_cancelShot` repete o turno, mas a tacada já entrou em `statsTracker`.
- **Convidado da LAN sem rastro da tacada:** os snapshots perdem as velocidades, então o convidado não desenha mais o rastro.
- **Constantes mortas:** os ajustes de física de `BALL` em `apps/client/src/config.js` não são mais lidos pelo cliente.
- **README:** ainda apresenta o `cannon-es` como a física do cliente.
- **Partida completa sob `CI=1`:** o tempo com swiftshader (renderização por software) não foi medido; o teste tem limite de 600 s. Se estourar, registrar uma decisão (limite maior ou partida com semente), sem afrouxar a asserção.
- **Replays:** continuam no formato antigo, gravado dos meshes (D043); a migração para a trajetória v1 fica para a F4.
- **Rotação de bolas rápidas (D044, `open`):** a heurística do `TrajectoryPlayer` não resolve a bola com efeito forte (follow, english, draw rápido) e erra alguns intervalos que o arco curto acertava, em tacadas rápidas com efeito para trás moderado. Decidir o formato (orientação mais densa ou velocidade angular nos quadros) antes de a F4 congelar `docs/protocol.md`.
- **Espera pelo worker:** a tacada só começa quando o worker responde (abertura: ~330 ms na primeira, 100 a 220 ms depois, no Chrome headless desta máquina; no celular deve ser mais). O som e os efeitos esperam junto.

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
- Pendências conhecidas, sem bloqueio, na seção "Pendências da F1-B".
- Revisão final da F1-B sobre a branch inteira: "With fixes". As correções entraram numa rodada só (`afde97c`, `a8c445e`, `b277cc5`, `c9c223a`, `2c9e258`), cada uma com o teste visto falhando antes:
  - I1: o impacto da tacada sai quando a reprodução começa; o worker se aquece com uma tacada curta no início da partida.
  - I2: arco do rolamento no `TrajectoryPlayer` (a abertura e a long-stun deixam de girar ao contrário). A D044 ficou `open`: o `follow` continua com 6 intervalos girando ao contrário, porque a branca gira mais de meia volta com menos de meia volta de rolamento, e a heurística não alcança esse caso. O roteiro manual pede para observar a rotação.
  - M1–M5: guarda contra `resolveTurn` duplo e testes mais fortes. O teste novo do resultado velho falha com a checagem do token desligada.
  - Suítes depois das correções: `npm test` na raiz saiu com 0 (client: runtime 68, sim-worker 7, trajectory-player 14, browser 31, full-match 1 (27 tacadas, 77 s), smoke 54 e as demais como antes; protocol 7; sim 60). `tsc` limpo; `test:dist` 7/7 com o build novo (o `dist` rastreado foi restaurado).
  - O F1-09 continua esperando o usuário.

### 2026-10-25 — sessão 2, continuação (plano da F2)

- O usuário preferiu adiar a confirmação do F1-09 e pediu o plano da F2, com as respostas em PT-BR.
- Plano escrito com `superpowers:writing-plans`: `docs/superpowers/plans/2026-10-25-f2-modes-n-lugares.md`. São 8 tarefas:
  1. pacote `packages/modes`, com tipos e ordem de turnos para 1×1, 2×2 e cada um por si;
  2. 8-ball, com teste diferencial contra o `Rules.js` congelado;
  3. 9-ball, com push-out e três faltas;
  4. `MatchState` e o invariante "sempre há um lugar da vez";
  5. `LocalMatchController` no cliente, com limite de tempo do worker;
  6. o `Game` obedece ao controlador, e `Rules.js`/`NineBallRules.js` saem do cliente;
  7. partidas locais de 2 jogadores de 8-ball e 9-ball até o fim;
  8. fechamento.
- Decisões propostas (`open`):
  - D045: extensões da interface de modos (tempo esgotado, push-out, bola reposta, mensagens com parâmetros, ordem de turnos no estado do modo);
  - D046: cópia congelada das regras legadas para o teste diferencial;
  - D047: arrumação fixa na F2, com sorteio só na F4.
- O plano absorve duas pendências: o limite de tempo do worker (pendência da F1-B) e a branca com bola na mão enviada ao sim (pendência da F1-A, T3).
- Fica fora da F2: a estatística da tacada cancelada, que depende do LAN e vai para a F4.
- Nenhum código mudou nesta etapa. Falta a revisão do usuário e a escolha do modo de execução.

### 2026-10-25 — sessão 2, continuação (execução da F2, modo nativo)

- O usuário aprovou o plano da F2 com a D045, a D046 e a D047 (`accepted`) e escolheu a execução nativa: um contexto só, TDD por tarefa e uma revisão da branch inteira no fim.
- Tarefas 1 a 7 (`7d87f44` a `f641184`), cada uma com o teste visto falhando antes:
  - T1: pacote `packages/modes`, tipos (D045) e ordem de turnos; os testes de tipo ficam em `test/types.check.ts`, que o `tsc` checa (o repositório não tem `@types/node`).
  - T2 e T3: 8-ball e 9-ball portados; os testes diferenciais pegam uma mutação de propósito em cada modo.
  - T4: `MatchState` e o invariante, reforçado com "partida não encerrada tem duas equipes ativas".
  - T5: `LocalMatchController`, `rulingText` (os textos de antes, em chinês) e `toTurnResult`; o worker que não responde em 10 s é descartado e a próxima tacada usa um novo.
  - T6: o `Game` obedece ao controlador; o LAN manda o estado da partida no snapshot; os testes que liam `game.rules` passaram a ler o controlador, sem afrouxar asserções.
  - T7: partidas locais de 2 jogadores até o fim. A primeira execução mostrou que o estado tem de ser lido depois da reprodução da tacada final (o controlador decide antes de reproduzir).
- Tarefa 8: `npm test` na raiz saiu com 0 (client: browser 32, full-match 19 tacadas/57,6 s, local-2p 8-ball 113 tacadas/124 s e 9-ball 19 tacadas/27 s, smoke 54 e as demais; modes 51; protocol 7; sim 60); `tsc` limpo; build com o worker; `test:dist` 7/7; `init.sh` verde. F2-01 a F2-05 marcados.
- Decisões de execução e pendências: `harness/sdd/2026-10-25-f2-modes-n-lugares/ledger.md`.
- Revisão final da branch da F2 (`25982fb..6075757`, revisor novo): "With fixes". As correções entraram numa rodada só, cada uma com o teste visto falhando antes:
  - Crítico: depois de uma revanche em que o jogador 2 deu a última tacada, o controlador começava com o jogador 2 e o `Game` com o jogador 1 (a abertura seria julgada para o jogador errado). O `resetGame` agora arruma com o lugar 0.
  - A IA fácil podia propor efeito acima de 1, que o modo recusa; o `_simulateShot` normaliza o efeito como o caminho do LAN.
  - O ledger desta execução foi commitado em `harness/sdd/2026-10-25-f2-modes-n-lugares/ledger.md`, e a dúvida sobre o `turnId` quando um lugar sai virou a D048 (`open`, para a F4).
  - Suíte depois das correções: `npm test` na raiz saiu com 0 (browser 33, runtime 69, full-match, local-2p 2/2, smoke 54; modes 51; protocol 7; sim 60); `tsc` limpo.
  - Achados menores ficaram registrados no ledger (por exemplo: `applyChoice` sem checar quem responde ao push-out, o que importa no servidor da F4; o HUD do convidado do LAN muda no golpe, antes das bolas caírem).

### 2026-10-25 — sessão 2, continuação (plano da F3)

- O usuário pediu o plano da F3. Ele foi escrito com `superpowers:writing-plans`: `docs/superpowers/plans/2026-10-25-f3-nakama-contas-salas.md`, com 8 tarefas:
  1. Docker Compose com Nakama 3.41.0 e PostgreSQL 16;
  2. empacotamento do módulo em TypeScript;
  3. validadores de nome, avatar, código de sala e configuração em `packages/protocol`, sem dependências;
  4. contas e perfil;
  5. sala privada com código de 6 caracteres;
  6. matchmaking 1×1;
  7. integração no GitHub Actions;
  8. fechamento.
- Decisões propostas (`open`):
  - D049: hospedagem numa VPS com o mesmo compose; fecha a D019 quando o usuário escolher;
  - D050: bundle esbuild e tipos locais do runtime;
  - D051: a integração roda na nuvem e na CI, porque esta máquina não tem Docker;
  - D052: regras de conta e perfil.
- Achado da auto-revisão: o `packages/modes` usa `structuredClone`, que não existe no runtime do Nakama. A Tarefa 3 o troca por uma cópia JSON, com um teste.
- Nenhum código mudou nesta etapa.

### 2026-10-25 — sessão 2, continuação (execução da F3, modo nativo)

- O usuário aprovou o plano da F3 com a D049 (VPS), que substitui a D019, e com a D050 a D052. Pediu a execução nesta máquina, onde ia instalar o Docker Desktop.
- Execução nativa:
  - Tarefa 3 primeiro, porque não precisa de Docker: validadores de nome, avatar, código de sala e configuração em `packages/protocol`, sem dependências. O `packages/modes` deixou de usar `structuredClone`, que o goja não tem.
  - Depois as Tarefas 1, 2, 4, 5 e 6, com testes unitários contra um `nk` falso.
  - O Docker Desktop não chegou a ser instalado nesta sessão. Por isso a integração foi verificada no GitHub Actions (Tarefa 7, D051). O repositório é público: o resultado foi lido pela API sem login, com o resumo publicado em anotações.
- Achados durante a integração no CI, todos corrigidos com o teste vendo a falha antes:
  - sockets abertos prendiam o processo de teste;
  - o `nakama-js` 2.8 recebe `linkEmail(session, { email, password })`, não argumentos soltos;
  - uma sala recém-criada demora alguns ms para entrar na listagem de rótulos;
  - os erros das RPCs chegavam com o rastro do goja.
- Execução do CI 40257461881 (https://github.com/rguilherme10/billiard/actions/runs/40257461881): 16 testes de integração passaram e nenhum falhou.
- F3-01 a F3-05 marcados com base nessa execução.
- Pendência: rodar `npm run infra:up && npm run test:integration -w services/nakama` nesta máquina quando o Docker Desktop estiver instalado.
- Decisões de execução: `harness/sdd/2026-10-25-f3-nakama-contas-salas/ledger.md`.
- Revisão final da branch da F3 (revisor novo): "With fixes". As correções entraram numa rodada só, cada uma com o teste visto falhando antes:
  - Crítico: os métodos de login que o Nakama aceita sem configuração (custom, Facebook, Game Center, Apple, Steam) criavam contas sem passar pelo filtro de nomes. Agora são recusados (`AUTH_METHOD_DISABLED`).
  - A listagem nativa de partidas expunha as salas privadas e seus códigos. Agora é recusada (`MATCH_LISTING_DISABLED`).
  - O filtro de nomes:
    - passa a pegar palavras curtas separadas por `_`, como `p_u_t_a` e `c_u`;
    - deixa de barrar palavras comuns e lugares, como `temporada`, `Iporanga`, `Ponta Porã` e `notario`.
  - A saída da conexão antiga de um jogador não libera mais o lugar da conexão nova.
  - `npm run infra:reload` recarrega o módulo num servidor em execução; rodar `infra:up` de novo não recarregava.
  - Execução do CI 40259666251: 18 testes de integração passaram e nenhum falhou.
- Achados menores ficaram no ledger e na D053 (`open`, APIs nativas do Nakama ainda abertas, para fechar antes da implantação na F4).
- O usuário vai rodar o nosso compose num servidor de testes da rede local (`server`). Para isso:
  - o compose ganhou `NAKAMA_BIND`, que mantém o padrão `127.0.0.1` e aceita `0.0.0.0` para expor as portas na rede;
  - os testes de integração aceitam `NAKAMA_HOST` e `NAKAMA_PORT`.

  O passo a passo está em `docs/f3/servidor-local.md`, seção "Servidor de testes na rede local". Execução do CI 40263967717: 18 testes passaram e nenhum falhou.
- No `server`, o `infra:up` falhou no Node 22.22.1, que não executa TypeScript sem flag: o `build.mjs` importava `src/registry.ts`. Agora ele tira os nomes dos handlers do próprio bundle, avaliado em `node:vm`. Um teste roda o build com `--no-experimental-strip-types`.
- Integração contra o `server` (2026-10-26, a partir desta máquina Windows): 18 testes passaram e nenhum falhou. Antes disso, `health.test.ts` e `module.test.ts` caíam ao sair com `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file srcwinasync.c` (Node 24.5 no Windows). A causa era o `--test-force-exit`: sem ele, os dois arquivos passam e a suíte termina sozinha em 77 s, porque o `closeBots` já fecha os sockets. A flag saiu do `test:integration` e do workflow.

### 2026-10-26 — sessão 2, continuação (plano da F4-A)

- Plano escrito com `superpowers:writing-plans`: `docs/superpowers/plans/2026-10-26-f4a-partida-online-servidor.md`, com 8 tarefas.
  1. Contrato em `packages/protocol`: mensagens, envelope binário, quantização e base64.
  2. Mesa autoritativa em `packages/modes`: `rackTable`, `placeCueBall` e `respotBalls`, e o `turnId` avança na saída de um lugar.
  3. `services/sim` com segredo e versões, em contêiner próprio (F4-01).
  4. Início da partida, snapshot e entrada de mensagens (F4-02).
  5. Tacada aceita, simulação, regras e cronômetro (F4-03).
  6. Reconexão, segunda aba e W.O. (F4-04, F4-05).
  7. Fim da partida, desistência e histórico (F4-06).
  8. Partida inteira com bots, `docs/protocol.md` e fechamento (F4-07).
- Decisões propostas, `open` até a revisão:
  - D054: F4-A (servidor) e F4-B (cliente online, VPS e D053);
  - D055: protocolo v1;
  - D056: ritmo, sem esperar a reprodução no servidor;
  - D057: fecha a D044 mantendo a trajetória v1;
  - D058: fecha a D048 avançando o `turnId`;
  - D059: `services/sim`;
  - D060: histórico e arrumação fixa.
- Antes do plano, nesta mesma sessão: a integração contra o `server` passou (18 de 18) depois de tirar o `--test-force-exit` (`d82c0db`); o CI 40268858280 passou sem a flag.

### 2026-10-26 — sessão 2, continuação (execução da F4-A por subagentes; Tarefa 8)

- O usuário aprovou o plano da F4-A com a D054 a D060 (`accepted`; a D044 e a D048 passaram a `superseded`) e escolheu a execução por subagentes: um implementador por tarefa e uma revisão por tarefa. Tarefas 1 a 7, cada uma com a integração vista verde no CI:
  - T1, contrato do protocolo (`9cdba55`, `7869381`): mensagens, quantização, envelope e base64. A revisão trouxe o limite de 1e6 para todo número e o escape do cabeçalho sem expressão regular;
  - T2, mesa autoritativa (`1175494`): `rackTable`, `placeCueBall`, `respotBalls`, `isCueBallPlacementValid`; o `turnId` avança quando um lugar sai;
  - T3, `services/sim` (`3c0a93d`): segredo, versões, contêiner próprio; execução 40319971118;
  - T4, início da partida, snapshot e entrada de mensagens (`2eef21d`, `d2ac3f4`, `00182ee`, `e07276f`); execução 40335959150;
  - T5, tacada, simulação, regras e cronômetro (`386177b`); execução 40341712737;
  - T6, reconexão, segunda aba e W.O. (`449556f`); execução 40358452240;
  - T7, fim da partida, desistência e histórico (`1be0c24` a `0ba0737`, com cinco commits de teste para achar como um cliente lê o registro no Nakama 3.41); execução 40369657444.
- Achados da execução que mudaram ou refinaram o protocolo (D061): o `JSON.parse` do goja recusa `1e999`; o estado da partida passa por Go entre as chamadas e perde a ordem das chaves (por isso o `joinOrder`); o Nakama 3.41 recusa o UUID zero como `user_id` numa leitura de cliente e lista uma página de um objeto só por padrão; `CUE_BALL_INVALID`; `TURN_MISMATCH` acompanhado de snapshot.
- Tarefa 8 (`8cb3c11` a este fechamento):
  - `autoplay.ts` (`chooseShot`) joga os dois lugares: abertura na bola da ponta com força 100, bola fantasma com o menor ângulo de corte, bola na mão atrás do alvo (ou na cabeceira). `SHOT.maxPower` é 110, então as forças 30 a 90 e 100 do enunciado valem como estão. O `z` da cabeceira sai arredondado para baixo, por causa da quantização.
  - Validação offline do bot (`services/nakama/test/autoplay.test.ts`, 1 s): a partida inteira passa pelo `matchLoop` com o sim real e termina em 37 tacadas com `WIN`, sem recusa e com o histórico igual às tacadas. Uma bateria de 120 partidas com a abertura variando (força de 90 a 110 e ângulo de ±0,02 rad), com a versão final do bot: as 120 terminaram, com mediana de 33 tacadas e máximo de 65, bem abaixo do limite de 200.
  - A primeira versão do bot travava em 1 de 120 partidas: uma bola parada na boca da caçapa, onde a bola fantasma fica dentro das tabelas e a branca é desviada (341 faltas `NO_BALL_HIT`). O bot passou a manter a branca e a fantasma a 4,5 raios da borda e a bater direto no alvo quando não há tacada de encaçapar.
  - A partida inteira falhou duas vezes no CI (execuções 40377657260 e 40379200977), sempre na décima tacada, sem recusa nem resultado. A causa não era o servidor: o bot atirava a cada 100 ms, e o limite de 5 mensagens por segundo por conexão (especificado) descartou, sem resposta, a sexta mensagem de um bot no mesmo segundo. O teste passou a fazer uma pausa de 300 ms antes de cada tacada; o protocolo registra que o `shot_request` entra nesse limite. O relatório de falha do teste agora diz o que cada bot recebeu e quanto cada tacada levou.
  - `docs/protocol.md` (PT-BR) escrito, com o teste `protocol-doc.test.ts` visto falhando antes (o arquivo não existia) e uma mutação (sem a linha da op 109 e do `CUE_BALL_INVALID`) que o derruba. D061 registrada. `docs/f3/servidor-local.md` ganhou o `sim`, o `SIM_SECRET`, o aviso para o `infra/.env` antigo e como ver uma partida de ponta a ponta; o `CLAUDE.md` ganhou os comandos de `services/sim`, `services/nakama` e `packages/protocol`; o roteiro separou a F4-A (concluída) da F4-B.
  - Execução do CI **40380325534**: 32 testes de integração passaram e nenhum falhou (os 31 de antes e a partida inteira). F4-01 a F4-07 marcados: F4-01 pelos testes do `services/sim` no `npm test` (10 de 10); F4-02 a F4-07 pela integração.
  - Suítes locais: `npm test` na raiz verde em tudo, menos no `test:browser` do cliente, que estoura o limite de 180 s do próprio arquivo nesta máquina (os 33 testes passam em 196,7 s numa cópia temporária com o limite maior; com `CI=1` o swiftshader fica lento demais e 9 falham por tempo). Passaram: client (suítes de Node; partida completa com 31 tacadas em 97,9 s; local-2p com 20 tacadas de 8-ball em 38 s e 32 de 9-ball em 50 s; smoke), modes 69, protocol 40, sim 60, nakama-module 78 e sim-service 10; `tsc` limpo; `init.sh` com 19 de 19 suítes rápidas.
- Pendências conhecidas, sem bloqueio, na seção "Pendências da execução da F4-A". Falta a revisão final da branch da F4-A.

### 2026-10-26 — sessão 2, continuação (revisão final da F4-A e correções)

- A revisão final da branch da F4-A deu "With fixes". As correções, cada uma com o teste visto falhando antes:
  - **Bola na mão no nariz da tabela** (`97d2058`): com o sim real, a branca posta a mais de ~52,9 cm do centro (lado longo) ou ~116,4 cm (lado curto) era lançada pela tabela num toque de força 0,001, e perto das caçapas caía na hora. O `@billiards/sim/constants` passou a exportar `CUSHION_BEVEL` (lido também pelo `table.js`, com os mesmos valores; golden e paridade iguais) e `cushionContactInset(profile)`: a distância da borda ao centro da bola que encosta na face interna do chanfro, `cushionWidth + overhang/2 + (R + thickness/2) · √((2R)² + overhang²)/(2R)` = 10,594 cm na pool9ft. O `onlineConfig()` leva esse valor em `table.cushionInset` (o `packages/modes` não importa o sim), e o `isCueBallPlacementValid` deixa a branca `PLACEMENT_CLEARANCE` = 0,01 cm longe de encostar numa tabela ou noutra bola: no limite exato, a simulação acusa o contato (com a tabela, e com a bola vizinha um primeiro contato fantasma quando a tacada vai para o outro lado). O teste `game-placement.test.ts` roda o sim real a partir de cada limite (lados, perto das caçapas laterais, pontas das tabelas e os quatro cantos) em quatro direções: a branca anda só o toque, sem contato e sem cair; 0,05 cm além do limite já há contato (o limite é justo); nenhum ponto permitido fica no raio em que o sim encaçapa, então não foi preciso regra de proximidade das caçapas.
  - **Linha da cabeceira inclusiva** (`cb86b1f`): o `validateCommon` compara o `z` com `headStringZ + 1e-6`, e o `−69,85` quantizado vale; os diferenciais da D046 continuam passando. Saiu do protocolo a recomendação de usar `−69,86`.
  - **Histórico com todas as decisões** (`47bc2a1`): o `GameState.shots` virou `decisions` (`shot`, `timeout`, inclusive a terceira seguida, e `choice` com `accept`), e o registro do `match_history` o traz no lugar de `shots`. Um passe e a vez perdida por tempo de quem escolhe agora se distinguem, e a partida de 9-ball pode ser refeita. O `summary.shots` continua contando só as tacadas.
  - **Segunda aba no saguão** (`9df798b`): a conexão antiga leva `matchKick`, como na volta durante a partida, e a saída dela é ignorada.
  - **Protocolo** (`4ba2755`): a próxima tacada leva o `turnId` do snapshot ou o `nextTurn.turnId` do último `shot_result` (o `turnId` do resultado é o da vez decidida); a tacada de força 0 pode voltar num `playback` com a trajetória vazia durante o 1 s de folga. Testes unitários fixam os dois comportamentos.
  - **D062** (`de2e6bc`) repete a D060 e a D061 com as correções; as duas passaram a `superseded`.
- Suítes: modes 70, protocol 40, nakama-module 90, sim-service 10, sim 61 e `test:local-match` 12, todas verdes; `tsc` limpo. Integração no GitHub Actions: execução **40408461222**, 32 testes passaram e nenhum falhou.
- Ficaram para depois, como a revisão pediu, os menores adiados: vida do `lastResult`, mapeamento dos erros do sim e novas tentativas em 4xx, tempo da fila de chamadas, ordem do zerar das vezes perdidas, `ABORTED` com os dois fora e lacunas de teste.

### 2026-10-27 — sessão 2, continuação (testes no `server`)

- O `npm test` no `server` falhou com o Node 22.22.1 do sistema: todo teste que é ou importa um `.ts` dá `ERR_UNKNOWN_FILE_EXTENSION`. As suítes em JavaScript passaram.
- O usuário instalou o Node 24 pelo `nvm`, que não vem pelo `apt`. Com ele, as suítes sem navegador passaram lá: protocol 40, modes 70, sim 61, sim-service 10 e nakama-module 90. As de navegador do cliente ficam de fora, porque o servidor não tem Chrome.
- `docs/f3/servidor-local.md` ganhou os passos do `nvm` e o comando das suítes sem navegador.
- A integração da F4-A também passou contra a pilha nova do `server` (Nakama, PostgreSQL e `sim`), com 32 testes passando e nenhum falhando em 220 s. Isso inclui o tempo esgotado, o W.O. e a partida inteira de 8-ball entre bots, que levou 17 s. Rodar a integração nesta máquina sem `NAKAMA_HOST` aponta para `127.0.0.1`, onde não há Nakama, e todo arquivo falha depois de 60 s de espera. O `servidor-local.md` agora mostra a sintaxe do cmd.
- Com `NAKAMA_HOST=server`, a integração também passou a partir desta máquina Windows contra o `server`.

### 2026-10-27 — sessão 2, continuação (plano da F4-B)

- Plano da F4-B escrito com `superpowers:writing-plans`: 10 tarefas, itens F4-08 a F4-13 e decisões D063 a D066 propostas (`open`).
- Achados do levantamento, já no plano: o `deploy.yml` da `main` roda o `npm test` com o Node 22 (que não executa os testes `.ts`) e publica no caminho `/Billiards/` do repositório original; a Tarefa 1 corrige os dois (D066) antes do merge do PR.

### 2026-10-27 — sessão 2, continuação (execução da F4-B, modo nativo)

- O usuário aprovou o plano da F4-B e as decisões D063 a D066, com execução nativa. Tarefas 1 a 10 executadas com TDD; o registro das decisões tomadas na execução fica em `.superpowers/sdd/2026-10-27-f4b-cliente-online-implantacao/progress.md` e vai para a mensagem final.
- Commits: `406b4ed` (D064, APIs nativas), `0d169da` (`OnlineSession`), `717940f` (`OnlineMatchController`), `ad69b87` (o `Game` online), `be1406b` (telas), `324c77b` (mira e bola na mão do adversário), `a265324` (dois navegadores de ponta a ponta) e `14bf7f5` (produção com TLS).
- O que a ponta a ponta mostrou, corrigido no próprio teste: a sala recém-criada responde `ROOM_NOT_FOUND` (404) por alguns milissegundos e a sessão repete, mas o Chrome registra o 404 no console; bolas encaçapadas não têm lugar oficial na mesa (a animação da queda deixa a malha onde parou); e o estado que volta do Go vem com as chaves em outra ordem. A IA "difícil" leva perto de 100 tacadas para fechar uma partida de 8-ball (98 numa local), e o limite passou de 150 para 300, como no `test:local-2p`.
- Contas de teste com prefixo: `bot-` nos bots da integração e `e2e-` nos navegadores. O `docs/f4/implantacao.md` mostra como listar e apagar essas contas na produção.
- O `!reset` da lista de portas do plano virou `!override`: o `!reset` esvazia o valor e ignora a lista. O `prod-compose.test.mjs` confere as portas na CI e lá não é pulado.
- Suítes: `test:online-unit` 44, `test:online-game` 9, `test:full-match` (37 tacadas), `test:local-2p` (52 e 30 tacadas), `test:smoke` 54, modes 70, protocol 40, sim 61, nakama-module 97, sim-service 10, `test:infra` 5 (mais 2 que precisam do Docker), `typecheck` limpo e `init.sh` ok. O `test:browser` estoura os 180 s do arquivo nesta máquina, como na F4-A.
- Na CI, dois navegadores com swiftshader desenham poucos quadros por segundo e o laço do jogo limita o quadro a 0,1 s: com a reprodução a 4×, a partida inteira passou dos 15 min (execução 40549706442). A CI agora reproduz a 16× (`E2E_PLAYBACK_RATE`), e o e2e vira anotações (JUnit e uma linha por partida). Uma espera de texto de 15 s na recarga falhou uma vez (40554403856) e passou a esperar 30 s, conferindo a cada 200 ms e relatando o estado da página se faltar. Verde em **40556758176**: 8-ball com 71 tacadas em 175 s.
- O `server` parou de responder nas portas 7350 e 7351 durante a última rodada daqui (o ping responde).
- Falta a produção (passo 6 da Tarefa 9), que precisa da máquina e do domínio do usuário, e a revisão final da branch.
