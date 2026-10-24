# Progresso

## Estado atual

- **Fase:** F0 concluída (F0-01 a F0-06 verificados). F1 dividida em F1-A (núcleo da simulação, plano escrito, aguardando revisão) e F1-B (cliente).
- **Resultado da F0:** a física autoritativa fica no `services/sim` em Node (D017). No goja do Nakama, a simulação foi cerca de 175 vezes mais lenta. Relatório: `docs/spikes/2026-10-24-runtime-simulacao.md`.
- **Branch de trabalho:** `claude/planejamento-online`, mantida sem merge na `main` por escolha do usuário (2026-10-24).
- **Base:** Hanazar-Games/Billiards v1.26.13 (`0448b03`), sem alterações em `src/`, `server/` ou `test/`.

## Próximo passo

1. O usuário revisa o plano da F1-A (`docs/superpowers/plans/2026-10-24-f1a-nucleo-simulacao.md`), em especial as decisões propostas D035 (envelope de tolerância), D036 (física customizada a 60 Hz fixo, muda a D010) e D037 (trajetória até 48 KB), que estão `open` em `harness/decisions.json`, e escolhe o método de execução.
2. Executar a F1-A; a Tarefa 1 marca D035–D037 como `accepted`.
3. Pendências menores da revisão final da F0, listadas abaixo (várias são resolvidas pela F1-A: contador inteiro de passos, teste do limite de 20 s, detecção de mundo sem tabelas, relógio congelado no legado).

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
