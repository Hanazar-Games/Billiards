# Progresso

## Estado atual

- **Fase:** F0. Harness concluído (F0-01 verificado); spike do runtime da simulação ainda não começou.
- **Branch de trabalho:** `claude/planejamento-online`
- **Base:** Hanazar-Games/Billiards v1.26.13 (`0448b03`), sem alterações no código do jogo.

## Próximo passo

1. O usuário revisa a spec (`docs/superpowers/specs/2026-10-24-billiards-online-design.md`), em especial as Seções 3–6 e as questões em aberto (§12).
2. O usuário revisa o plano da F0 (`docs/superpowers/plans/2026-10-24-f0-spike-runtime-simulacao.md`) e escolhe o método de execução (subagentes ou nativo).
3. Executar o plano da F0, tarefa por tarefa.

## Registro de sessões

### 2026-10-24 — sessão 1

- Análise do repositório base: física acoplada a Three.js, física customizada por frame (dependência de FPS), LAN autoritativo no host, regras para 2 jogadores, skins como presets, sem mão na cena, interface em chinês, efeito de tabela aplicado no tratador de colisões do `Game.js`.
- Decisões de produto com o usuário: F2P com venda de skins, só web, formatos 1×1, 2×2, cada um por si e espectadores, Abordagem 1 (Nakama + serviço de simulação em Node).
- Seções 1 e 2 do design aprovadas; Seções 3–6 aceitas pela recomendação.
- Criados: spec, roteiro de fases, plano da F0, harness (`CLAUDE.md`, `harness/*`, hook SessionStart).
- Linha de base: 15 suítes de teste do Node passando (6 s); `test:smoke` com Chromium pré-instalado: 54/54 (81 s).
