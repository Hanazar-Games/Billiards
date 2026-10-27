# Spike F0 — Runtime da simulação

- **Data:** 2026-10-24
- **Plano:** [`docs/superpowers/plans/2026-10-24-f0-spike-runtime-simulacao.md`](../superpowers/plans/2026-10-24-f0-spike-runtime-simulacao.md)
- **Código (descartável):** [`spikes/sim-bench/`](../../spikes/sim-bench/)
- **Decisões resultantes:** D017 (aceita), D033 e D034 em [`harness/decisions.json`](../../harness/decisions.json). A D033 e a D034 substituem a D032 e a D031, que a revisão final mostrou estarem mal fundamentadas.

## Resumo

1. **A física não pode rodar dentro do Nakama.** No goja (o runtime JavaScript do Nakama 3.41.0), a abertura leva **22,4 s**, cerca de 175 vezes mais que no Node. O limite era 250 ms. Fica mantido o `services/sim` em Node (D009).
2. **O Node precisa de otimização na F1.** A abertura tem p95 de **158 ms**, acima do limite de 100 ms.
3. **A dependência de FPS é real e grande.** A mesma abertura termina com bolas até **138 cm** distantes entre 60 e 144 FPS. Até a tacada fraca difere 2,7 cm, contra um limite de 0,5 cm.
4. **Motores JavaScript diferentes calculam resultados diferentes.** Em 2 das 5 tacadas, Node e goja chegam a estados finais diferentes partindo da mesma entrada. Isso reforça a sincronização pela trajetória (D011).

## Ambiente

| Item | Valor |
|------|-------|
| CPU | Intel Xeon, 4 vCPUs (contêiner compartilhado); simulação em uma única thread |
| Node | 22.22.0 |
| Nakama | 3.41.0 (imagem `heroiclabs/nakama:3.41.0`), PostgreSQL 16 |
| Bundle | esbuild 0.28.2, IIFE, `target: es2017`, 783 KB (inclui three 0.170 e cannon-es 0.20) |
| Medição | Só o laço da tacada (`runShot`). A montagem do mundo, que hoje cria geometria do Three.js e não existirá em `packages/sim`, fica de fora. |
| Amostras | Node: 20 medidas + 3 de aquecimento. goja: 3 medidas + 1 de aquecimento (ver Limitações). |

Mesa `pool9ft`, arrumação de 8-ball. Todas as tacadas partem da arrumação inicial e miram a bola 1 (vértice do triângulo).

| Tacada | Força | Efeito |
|--------|-------|--------|
| `break` | 110 | — |
| `medium` | 50 | — |
| `draw` | 60 | `y = -0,8` |
| `english` | 60 | `x = 0,8` |
| `soft` | 15 | — |

Modelos de passo:
- **`fixed`:** um passo de 1/360 s por iteração, com a física customizada a cada passo. É o modelo da spec.
- **`legacy60` e `legacy144`:** reproduzem o laço atual do jogo: `physics.step(dt)` seguido de `updatePhysicsGuards(dt)` uma vez por frame.

## Resultados no Node

| Tacada | Modelo | Mediana | p95 | Passos | Tempo simulado |
|---|---|---|---|---|---|
| `break` | fixed | 128 ms | 158 ms | 4546 | 12,63 s |
| `break` | legacy60 | 138 ms | 166 ms | 772 | 12,87 s |
| `break` | legacy144 | 110 ms | 126 ms | 1305 | 9,06 s |
| `medium` | fixed | 67 ms | 85 ms | 3112 | 8,64 s |
| `medium` | legacy60 | 123 ms | 133 ms | 784 | 13,07 s |
| `medium` | legacy144 | 80 ms | 84 ms | 1169 | 8,12 s |
| `draw` | fixed | 11 ms | 18 ms | 1190 | 3,31 s |
| `draw` | legacy60 | 6 ms | 8 ms | 149 | 2,48 s |
| `draw` | legacy144 | 8 ms | 11 ms | 420 | 2,92 s |
| `english` | fixed | 145 ms | 158 ms | 4640 | 12,89 s |
| `english` | legacy60 | 128 ms | 135 ms | 736 | 12,27 s |
| `english` | legacy144 | 128 ms | 161 ms | 1880 | 13,06 s |
| `soft` | fixed | 39 ms | 43 ms | 2610 | 7,25 s |
| `soft` | legacy60 | 31 ms | 32 ms | 441 | 7,35 s |
| `soft` | legacy144 | 33 ms | 34 ms | 1064 | 7,39 s |

Nenhuma tacada atingiu o limite de 20 s simulados. Fonte: `spikes/sim-bench/results/node.json`.

## Resultados no goja (Nakama 3.41.0)

| Tacada | Mediana goja | p95 goja | Mediana Node | Razão | Hash goja | Hash Node | Iguais? |
|---|---|---|---|---|---|---|---|
| `break` | 22,4 s | 22,6 s | 128 ms | 175× | `b6df8e22` | `a12823b3` | **não** |
| `medium` | 11,5 s | 11,8 s | 67 ms | 171× | `48ebad09` | `48ebad09` | sim |
| `draw` | 2,0 s | 2,0 s | 11 ms | 173× | `69e7d9c6` | `69e7d9c6` | sim |
| `english` | 25,4 s | 25,9 s | 145 ms | 175× | `b40d578d` | `47dff645` | **não** |
| `soft` | 6,8 s | 6,9 s | 39 ms | 175× | `05b95fba` | `05b95fba` | sim |

Modelo `fixed`. Fonte: `spikes/sim-bench/results/goja.json`.

**Compatibilidade.** O bundle carregou no Nakama sem nenhuma alteração em `src/`. As funções globais `InitModule` e `rpcSimBench` foram aceitas, e a RPC foi registrada. Foram necessários os shims `console`, `performance`, `document` e `localStorage` (no Node, só `document` e `localStorage`).

## Dependência de FPS e efeito do passo fixo

Distância entre as posições finais das bolas não encaçapadas:

| Tacada | legacy60 × legacy144: máx / RMS | fixed × legacy60: máx / RMS |
|---|---|---|
| `break` | 137,75 cm / 55,20 cm | 150,50 cm / 56,13 cm |
| `medium` | 102,41 cm / 45,57 cm | 104,20 cm / 54,02 cm |
| `draw` | 2,77 cm / 0,69 cm | 5,69 cm / 1,42 cm |
| `english` | 116,66 cm / 49,67 cm | 69,34 cm / 32,95 cm |
| `soft` | 2,74 cm / 0,98 cm | 0,56 cm / 0,20 cm |

Nenhuma tacada do corpus encaçapou bolas, então a comparação do conjunto de encaçapadas não discrimina nada (ver Limitações). Fonte: `spikes/sim-bench/results/compare.json` (`node compare-models.mjs`).

**Leitura.** A sensibilidade depende da **energia** da tacada, não do número de bolas.
- A `soft` move 14 das 16 bolas e mesmo assim diverge só 0,56 cm entre `fixed` e `legacy60`.
- As tacadas fortes (`break`, `medium`, `english`) divergem 70–150 cm.

O sistema é sensível, mas não diverge com perturbações mínimas. Na revisão final, deslocar a branca 1e-6 cm mudou as posições finais da abertura em no máximo 0,018 cm; deslocá-la 1e-3 cm mudou em 11 cm. As diferenças de 100+ cm entre modelos vêm de uma diferença sistemática, o passo das guardas (1/60 contra 1/360 s), amplificada nas tacadas fortes.

## Aplicação dos critérios

| Pergunta | Critério | Medido | Resultado |
|----------|----------|--------|-----------|
| A física pode rodar dentro do Nakama? | Bundle sem alterar `src/`, abertura p95 ≤ 250 ms e mediana das demais ≤ 100 ms | Bundle OK; abertura p95 = 22,6 s; demais de 2,0 s a 25,4 s | **Não.** Mantém-se `services/sim`. |
| O Node precisa de otimização na F1? | Abertura p95 > 100 ms | 158 ms | **Sim.** Entra uma tarefa de otimização na F1, com meta relativa (D034, que substitui a D031). |
| A dependência de FPS é real? | Conjunto de encaçapadas diferente ou posição final com diferença > 0,5 cm entre 60 e 144 FPS | Até 137,75 cm (abertura); 2,74 cm na tacada fraca | **Sim.** Confirma D010. |

## Outros achados

1. **O laço atual também depende da velocidade da máquina.** `World.step(dt, timeSinceLastCalled, maxSubSteps)` do cannon-es interrompe os subpassos quando `performance.now() - t0 > dt * 1000` (`cannon-es.js:12520-12529`). Numa execução lenta, a abertura legacy60 deu 759 passos em vez de 772. O passo fixo da spec, que chama `world.step(1/360)` sem acumulador, não sofre disso.
2. **`vm.createContext` deixa a física de 5 a 6 vezes mais lenta no Node** (abertura: 740 ms contra 130 ms), porque o acesso a globais como `Math` passa por interceptadores. O `services/sim` não deve isolar a simulação em contextos `vm`.
3. **Parte da física está no `Game.js`.** O efeito transferido pela tabela (`applyCushionSpin`) é aplicado dentro do tratador de colisões `Game.setupCollisionEvents`. O `packages/sim` precisa levar essa lógica (o spike a replicou em `src/world.js`).
4. **O `draw` com força 60 não chega à bola 1** em nenhum modelo. Na revisão final, um único passo de 1/360 s levou a branca de 353 para 206 cm/s e de −180 para −103 rad/s. O invariante de rolamento (2,5v + ωR) caiu de 368 para 220: o efeito para trás destrói o momento em vez de acoplá-lo, e a branca anda só 8–14 cm. É o mesmo caminho de código do jogo (não conferido no navegador). Vira item de calibragem da F1 (F1-09).

## Consequências para a F1

- **D034 (substitui a D031):** otimizar `packages/sim` até a mediana da abertura com passo fixo ficar pelo menos 1,3× mais rápida que o modelo `fixed` deste spike, medidos no mesmo processo e na mesma máquina, com coleta de lixo forçada antes de cada tacada. Uma meta absoluta (p95 ≤ 100 ms) não serve: a mesma medição variou de 133 a 167 ms neste contêiner. Pontos a investigar: 38 iterações do solver, `SAPBroadphase`, limites de repouso, custo das guardas por passo.
- **D033 (substitui a D032):**
  - **Corpus:** tacadas de uma bola na tabela, encaçapes simples, uma abertura e tacadas de baixa energia.
  - **Métricas:** distância percorrida, posição final e conjunto de bolas encaçapadas. O tempo até parar fica de fora, porque é dominado pela frenagem em baixa velocidade.
  - **Tolerância:** o espalhamento do próprio legado entre 60 e 144 FPS, que os jogadores já experimentam, medido na F1.
  - **Recuo (draw):** é item de calibragem (F1-09), não referência a copiar.
- O hash dos testes golden só é estável dentro do mesmo motor (V8). O cliente offline e o servidor usam V8 (Chrome/Node), mas Firefox e Safari podem divergir. Isso só afeta o modo offline (spec §9.3).

## Limitações

- **goja com 3 amostras em vez de 20.** Os tempos ficaram cerca de 90 vezes acima do limite, então o tamanho da amostra não muda a decisão. A rodada completa levaria cerca de 26 minutos.
- **Uma RPC por vez no Nakama.** Com partidas simultâneas, o custo por tacada no goja só aumentaria.
- **Nenhuma tacada do corpus encaçapa bolas.** Corrigir no corpus golden da F1 (D033). O encaçape em si funciona sem gráficos: na revisão final, a branca mirada na caçapa de canto mais próxima caiu.
- **Contêiner compartilhado de 4 vCPUs.** Os números absolutos variam com a máquina; a razão goja/Node (cerca de 175×) é o dado robusto.
- **O caminho B (runner Go) não foi necessário:** o caminho A (Nakama real) funcionou.

## Como reproduzir

```bash
cd spikes/sim-bench
npm install && npm test        # 5 testes
node run-node.mjs              # results/node.json (~40 s)
node compare-models.mjs        # results/compare.json
dockerd &                      # se o daemon não estiver rodando
./run-goja.sh                  # results/goja.json (~5 min; RUNS/WARMUP configuráveis)
```
