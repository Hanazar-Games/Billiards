# Billiards Online — Especificação de design

- **Data:** 2026-10-24
- **Base:** fork definitivo de Hanazar-Games/Billiards v1.26.13 (commit `0448b03`, licença MIT)
- **Status:** Seções 1 (componentes) e 2 (fluxo da tacada) aprovadas em conversa. Seções 3–6 aceitas pela recomendação ("pode seguir com o recomendado"), pendentes de revisão do documento.
- **Decisões registradas em:** [`harness/decisions.json`](../../../harness/decisions.json)

---

## 1. Objetivo

Transformar o jogo de sinuca 3D existente em um **jogo online free-to-play**, monetizado com **venda direta de skins** (tacos, bolas, mesas), jogado **no navegador** (desktop e celular) por um público brasileiro.

Requisitos de produto:

| Tema | Decisão |
|------|---------|
| Modelo de negócio | Free-to-play, venda direta de skins cosméticas; sem caixas de recompensa |
| Plataforma | Somente web (desktop e celular), instalável como PWA |
| Pagamento | Pix e cartão via Mercado Pago ou Stripe (escolha na fase da loja) |
| Formatos de partida | 1×1, duplas 2×2, cada um por si (3–5), espectadores |
| Modos de jogo | 8-ball primeiro; depois 9-ball, duplas, cutthroat e outros |
| Idioma | Português do Brasil |
| Skins | Somente do catálogo do jogo; sem envio de modelos pelos jogadores |
| Competitivo | Ranking em fase posterior; MVP só casual |

## 2. Critérios de sucesso

### MVP técnico (beta fechado, fases F0–F6)

1. Dois jogadores em redes diferentes entram na mesma partida por matchmaking ou por código de sala privada.
2. Todos os participantes veem exatamente o mesmo resultado físico de cada tacada.
3. Não é possível jogar fora do próprio turno nem enviar uma tacada inválida que seja aceita.
4. Desconexão e reconexão não duplicam tacadas nem travam a partida.
5. O jogador equipa taco, conjunto de bolas e mesa; o taco equipado aparece para o adversário.
6. Nenhuma skin altera a física (a simulação não recebe o loadout).
7. Uma partida concluída registra o resultado uma única vez.
8. O jogo funciona com toque no celular e com mouse no desktop, com interface em PT-BR.
9. Testes de regras, testes golden da física, integração multiplayer e build passam no CI.

### Lançamento comercial

MVP técnico + loja com pagamento (F8) + revisão jurídica e fiscal concluída.

## 3. Fora de escopo (por ora)

- Luvas e qualquer modelo de mão/jogador (não existe na cena atual; projeto de arte próprio).
- Skins criadas ou enviadas por jogadores.
- Chat de texto livre (MVP terá apenas emotes predefinidos; evita moderação e riscos com menores).
- Moeda virtual comprada com dinheiro (a loja vende itens diretamente em reais).
- Apps nativos nas lojas (Android/iOS).
- Partidas ranqueadas e temporadas no MVP.
- Migração dos sistemas locais (carreira, conquistas, torneios, replays, desafios) para o servidor: ficam disponíveis apenas offline.

## 4. Diagnóstico do código-base

Fatos verificados na leitura do código (caminhos relativos à raiz do repositório):

| # | Constatação | Consequência |
|---|-------------|--------------|
| 1 | `src/game/Ball.js` cria `THREE.Mesh` e `CANNON.Body` na mesma classe; `src/game/Table.js` cria corpos de colisão das tabelas junto com a geometria visual. | A física não roda sem Three.js. É preciso extrair um pacote de simulação headless. |
| 2 | `PhysicsWorld.step(dt)` é chamado a partir de `src/menu/MenuSystem.js` com o `dt` do frame (`world.step(1/360, dt, 24)`); a física customizada (`BallsManager.updatePhysicsGuards`: spin, frenagem, colisões varridas, limites da mesa) roda uma vez por frame de renderização. Há também um limite de 20 s medido com `performance.now()`. | O resultado de uma tacada depende da taxa de quadros (inferência pela leitura; ainda não medido). A simulação nova usa passo fixo e tempo simulado. |
| 3 | O LAN (`server/lan-server.js`) é um relay; o navegador do host simula e envia snapshots completos a cada 50 ms (`GameStateSerializer`). O convidado envia só `shotInput`. | O conceito de "enviar intenção" é reaproveitado; o LAN é removido. |
| 4 | `src/game/ShotInput.js` (`applyShotInput`) já valida turno, estado, números finitos, normaliza direção e spin, limita potência e valida bola na mão. | A lógica vai para o servidor, desacoplada de `Game`. |
| 5 | `src/game/Rules.js` e `src/game/NineBallRules.js` dependem apenas de `config.js` e `UIText.js`, mas supõem dois jogadores (`player1Group`, `player2Group`, `player1ConsecutiveFouls`…). Eventos como "primeira bola tocada" são alimentados por `Game.js` (3.677 linhas). | As regras são reescritas como modos com N lugares; a detecção de eventos passa para a simulação. |
| 6 | Skins existentes são presets procedurais de material: `src/game/CueThemes.js`, `src/theme/BallThemes.js`, `src/theme/TableThemes.js`, `src/theme/RoomThemes.js`. Não há `GLTFLoader`. | Cosméticos do MVP usam esses presets; o pipeline de modelos 3D vem antes da venda. |
| 7 | Não há mão nem jogador na cena; só o taco. | Luvas ficam fora de escopo. |
| 8 | Progresso e configurações ficam em `localStorage`; a interface está em chinês (`src/core/UIText.js`). | Sistemas locais ficam offline; tradução PT-BR é uma tarefa. |
| 9 | `src/replay/ShotRecorder.js` grava X/Z das 16 bolas a 60 fps em `Float32Array`. | Serve de referência para o formato de trajetória (que generaliza para N bolas e inclui rotação). |
| 10 | `src/spectator/` (CameraDirector, CommentarySystem, BroadcastUI) implementa transmissão de IA × IA. | Reaproveitado para espectadores online. |
| 11 | Entrada usa Pointer Events (toque básico funciona), mas os controles foram desenhados para mouse e teclado (Shift+arrastar, WASD). | É necessária uma interface de toque própria. |

## 5. Arquitetura (Seção 1 — aprovada)

### 5.1 Componentes

```
Navegador ──WebSocket (wss)──► Nakama ── PostgreSQL
  apps/client                   services/nakama (módulo TypeScript)
                                  │ HTTP interno, 1 chamada por tacada
                                  ▼
                                services/sim (Node, sem estado)
```

| Componente | Responsabilidade | Depende de |
|------------|------------------|------------|
| `packages/sim` | Física headless em passo fixo. `simulateShot(estado, tacada) → { trajetória, eventos, estadoFinal }`. Sem Three.js, DOM ou relógio de parede. | `cannon-es` |
| `packages/modes` | Regras como módulos com interface comum (seção 7.1). Código puro e sem dependências, empacotável para o runtime do Nakama. | — |
| `packages/protocol` | Tipos e validação das mensagens, códigos de operação, codificação binária da trajetória, versões. | — |
| `apps/client` | O jogo atual: renderização, controles, UI, reprodução de trajetórias, modos offline. | `sim`, `modes`, `protocol`, `three`, `@heroiclabs/nakama-js` |
| `services/nakama` | Partidas autoritativas, turnos, matchmaking, salas privadas, espectadores, contas, inventário, loadout, loja, webhooks de pagamento. | `modes`, `protocol` |
| `services/sim` | Serviço HTTP interno que expõe `packages/sim`. Aceita apenas chamadas do Nakama (rede privada + segredo compartilhado). | `sim` |
| `infra/` | `docker-compose`: Nakama, PostgreSQL, sim, proxy TLS. | — |

### 5.2 Estrutura do repositório

```
billiard/
├── packages/{sim,modes,protocol}/
├── apps/client/              # conteúdo atual de src/, index.html, test/, vite.config.js
├── services/{nakama,sim}/
├── infra/
├── docs/                     # specs, planos, protocolo, spikes
└── harness/                  # memória e progresso do desenvolvimento
```

- Monorepo com **npm workspaces**.
- **Fork definitivo:** não haverá merge de commits futuros do repositório original. O aviso de copyright MIT é mantido em `LICENSE`.
- **Linguagens:** TypeScript em `modes`, `protocol`, `services/*`; JavaScript com `// @ts-check` + JSDoc em `packages/sim` (extração com mudança mínima); JavaScript no cliente.

### 5.3 Mudança central no cliente

`Game.js` deixa de ser dono das regras e da física. Ele passa a obedecer a um **controlador de partida**:

| Implementação | Uso | Simulação | Regras |
|---------------|-----|-----------|--------|
| `LocalMatchController` | Contra IA, 2 jogadores no mesmo aparelho, treino | `packages/sim` em Web Worker | `packages/modes` no navegador |
| `OnlineMatchController` | Partidas online | Servidor | Servidor |

Os dois entregam ao `Game` a mesma coisa: trajetórias para reproduzir e decisões de regra para exibir. O LAN (`src/net/NetworkClient.js`, `server/lan-server.js`, `src/menu/LanRoomPanel.js`) é removido.

### 5.4 Hospedagem

- Cliente estático em CDN (o deploy atual para GitHub Pages serve de base).
- Nakama, PostgreSQL e sim em Docker; VPS própria ou Heroic Cloud (decisão na F3).
- Assets de skins pagas em armazenamento de objetos com CDN (ex.: Cloudflare R2), a partir da F8.
- Região única no lançamento (São Paulo ou mais próxima disponível).

### 5.5 Opção de implantação condicionada ao spike (F0)

Se o spike mostrar que `packages/sim` roda no runtime JS do Nakama (goja) com desempenho aceitável, o mesmo pacote pode ser embutido no módulo do Nakama e o `services/sim` deixa de ser necessário. A interface `simulateShot` não muda; só o local de execução.

## 6. Fluxo de uma tacada (Seção 2 — aprovada)

```
Atirador            Nakama (partida)               Simulação         Outros clientes
   │ shot_request ──►│ valida                           │                   │
   │◄─ shot_accepted ┤──────────── shot_accepted ───────┼──────────────────►│ (taco anima)
   │                 │── POST /simulate ───────────────►│                   │
   │                 │◄─ trajetória + eventos + final ──┤                   │
   │                 │ aplica regras do modo            │                   │
   │◄── shot_result ─┤───────────── shot_result ────────┼──────────────────►│ (reprodução)
```

1. **Mira.** O atirador mira localmente. O cliente envia `aim_update` até 10×/s; o Nakama retransmite aos demais. É apenas visual. A linha-guia usa a geometria de `packages/sim`.
2. **Pedido.** `shot_request { turnId, seq, angle, power, spin: {x, y}, cueBall?: {x, z} }`.
3. **Validação no Nakama.** Remetente é o jogador do lugar da vez; `turnId` confere; estado é `AWAITING_SHOT`; cronômetro não expirou; números finitos e dentro dos limites; posição de bola na mão válida segundo o modo. Os valores são **quantizados** (precisão fixa) para que exatamente os mesmos números sejam simulados e registrados. O servidor envia `shot_accepted` a todos; a animação de golpe do taco começa e disfarça a espera.
4. **Simulação.** O Nakama chama `POST /simulate { simVersion, tableProfileId, balls, shot }` (timeout 3 s). O serviço:
   - simula com passo fixo de 1/360 s, aplicando a física customizada **a cada passo**;
   - para quando todas as bolas param ou ao atingir o limite de **tempo simulado** (20 s);
   - devolve a **trajetória** (30 amostras/s, apenas bolas em movimento), os **eventos** com instante (`ball_ball`, `ball_cushion`, `pocket`, `first_contact`) e o **estado final** exato.
5. **Regras.** O Nakama executa `mode.resolveShot(...)` (seção 7.1), atualiza o estado oficial, incrementa `turnId` e envia `shot_result` a todos. O cronômetro do próximo turno começa ao fim da reprodução (o servidor conhece a duração da trajetória).
6. **Reprodução.** Os clientes interpolam as amostras na taxa de quadros da tela, disparam som e efeitos nos instantes dos eventos e, ao final, aplicam o estado final exato. Clientes não recalculam física online.

**Alternativa descartada:** cada cliente simular e corrigir no fim. Motores JS diferentes podem divergir em funções matemáticas, e a sinuca amplifica pequenas diferenças, causando "saltos" visíveis.

**Caminho único de reprodução.** Online, offline e replays usam o mesmo formato de trajetória e o mesmo reprodutor.

**`nk.httpRequest` é síncrona** no runtime JS do Nakama: bloqueia o loop daquela partida durante a simulação. É aceitável porque cada partida tem loop próprio e o estado está em `SIMULATING`. A partida usa `tickRate` baixo (10/s); mensagens que chegam durante a espera ficam na fila.

### 6.1 Formato da trajetória (v1)

Binário, little-endian:

| Campo | Tipo | Observação |
|-------|------|------------|
| `version` | u8 | 1 |
| `sampleRate` | u8 | 30 |
| `frameCount` | u16 | |
| por quadro: `movingCount` | u8 | |
| por bola em movimento: `id` | u8 | |
| `x`, `z` | i16, i16 | centésimos de cm (0,1 mm); cobre ±327 cm |
| rotação | 3×i16 + u8 | quatérnio "smallest three" |

Tamanho estimado: 10–30 KB por tacada típica. O estado final vai separado, em `float64`, para que todos terminem exatamente na mesma posição.

### 6.2 Mensagens (códigos de operação)

| Op | Direção | Mensagem | Conteúdo |
|----|---------|----------|----------|
| 1 | C→S | `aim_update` | `turnId, angle, spin, power?` (≤10/s) |
| 2 | C→S | `shot_request` | `turnId, seq, angle, power, spin, cueBall?` |
| 3 | C→S | `ball_in_hand_move` | `turnId, x, z` (prévia visual) |
| 4 | C→S | `emote` | `emoteId` |
| 5 | C→S | `concede` | — |
| 6 | C→S | `rematch_vote` | `accept` |
| 101 | S→C | `match_snapshot` | estado completo, lugares, loadouts, fase, deslocamento de reprodução |
| 102 | S→C | `aim_update` | retransmissão com `seat` |
| 103 | S→C | `shot_accepted` | `turnId, seq, seat, input quantizado` |
| 104 | S→C | `shot_rejected` | `seq, reason` |
| 105 | S→C | `shot_result` | `turnId, trajetória, eventos, decisão, estadoFinal, nextTurn {seat, startsAt, deadline}` |
| 106 | S→C | `seat_update` | conectado, desconectado, eliminado, substituído |
| 107 | S→C | `match_end` | `winnerTeam, reason, resumo` |
| 108 | S→C | `error` | `code` |

Mensagens de controle em JSON; `shot_result` em envelope binário (cabeçalho JSON + trajetória). Detalhes ficam em `docs/protocol.md` (a criar na F4).

### 6.3 Versões

- `protocolVersion` e `simVersion` são enviados ao entrar na partida. Incompatibilidade → aviso para recarregar a página.
- Durante uma atualização, `services/sim` aceita a versão atual e a anterior.

## 7. Partidas (Seção 3)

### 7.1 Interface de modo

```ts
interface GameMode {
  id: string;                                   // '8ball', '9ball', 'cutthroat'…
  formats: MatchFormat[];                       // ex.: 1v1, 2v2, ffa(3..5)
  tableProfiles: string[];                      // perfis de mesa compatíveis
  createInitialState(cfg: MatchConfig, rng: Rng): ModeState;   // arrumação + quem abre
  rackLayout(state: ModeState): BallLayout;
  validateShot(state: ModeState, seat: number, shot: ShotInput): Validation;
  resolveShot(state: ModeState, seat: number, events: ShotEvents, final: TableState): Ruling;
  onSeatRemoved(state: ModeState, seat: number): ModeState;    // abandono / eliminação
}

interface Ruling {
  state: ModeState;
  fouls: FoulCode[];
  ballInHand: { seat: number; zone: 'anywhere' | 'kitchen' } | null;
  nextSeat: number | null;
  eliminatedSeats: number[];
  winnerTeam: number | null;
  messages: MessageCode[];                      // textos resolvidos no cliente (PT-BR)
}
```

- A ordem aleatória da arrumação usa uma semente gerada pelo servidor e registrada no histórico.
- As regras de 8-ball e 9-ball são portadas de `Rules.js` e `NineBallRules.js`, com os 28 testes existentes adaptados.

### 7.2 Lugares, equipes e turnos

```ts
interface MatchState {
  seats: { index: number; userId: string | null; team: number; connected: boolean;
           timeouts: number; eliminated: boolean }[];
  teams: { index: number; members: number[]; nextMember: number }[];
  currentSeat: number;
  turnId: number;
  phase: 'LOBBY' | 'AWAITING_SHOT' | 'SIMULATING' | 'PLAYBACK' | 'ENDED';
  mode: ModeState;
}
```

| Formato | Equipes | Ordem |
|---------|---------|-------|
| 1×1 | 2 equipes de 1 | A, B, A, B… |
| 2×2 | 2 equipes de 2; o grupo de bolas é da equipe | A1, B1, A2, B2… (rodízio interno por equipe) |
| Cada um por si | 3–5 equipes de 1 | ordem dos lugares, pulando eliminados |

### 7.3 Cronômetro e ausência

- Cronômetro de tacada: 45 s (configurável por modo), medido em ticks do servidor.
- Tempo esgotado conta como falta: a vez passa e o próximo recebe bola na mão (quando o modo prevê).
- 3 tempos esgotados seguidos = abandono.

### 7.4 Desconexão e reconexão

- O lugar fica reservado por **60 s**. Se for a vez do jogador, o cronômetro continua correndo.
- Depois de 60 s:
  - **1×1:** derrota por W.O.;
  - **2×2:** o parceiro assume as tacadas do lugar ausente; se a equipe inteira sair, ela perde;
  - **cada um por si:** o jogador é eliminado (`mode.onSeatRemoved`) e a partida continua.
- **Reconexão:** o cliente guarda o `matchId` e entra de novo na mesma partida. O servidor reconhece o `userId` do lugar, recebe a nova conexão e envia `match_snapshot`. Se uma tacada estiver em reprodução, o snapshot inclui o `shot_result` e o deslocamento, e o cliente retoma do ponto certo.
- `turnId` + `seq` tornam o reenvio de `shot_request` idempotente: uma tacada repetida é ignorada e o servidor responde com o estado atual.
- Uma segunda aba do mesmo usuário substitui a conexão anterior.

### 7.5 Matchmaking e salas

- **Matchmaker do Nakama**, com propriedades `mode` e `format`:
  - 1×1: 2 jogadores;
  - 2×2: 4 jogadores, com grupos (parties); membros de um grupo ficam na mesma equipe;
  - cada um por si: de 3 a 5 jogadores.
- **Sala privada:** RPC `create_private_match(config)` devolve um código de 6 caracteres guardado no rótulo da partida; `join_by_code(code)` localiza a partida pela listagem de rótulos.
- **MVP:** só casual, sem rating. Na F9, rating com OpenSkill (lida bem com equipes e partidas com vários jogadores).

### 7.6 Espectadores

- Entram com `role: 'spectator'` nos metadados de entrada: a partir do perfil de um amigo ou de uma lista de "partidas ao vivo" (listagem por rótulo `spectatable`).
- Limite de 50 espectadores por partida no início.
- O servidor descarta qualquer mensagem de jogo vinda de espectador.
- Recebem as mesmas mensagens que os jogadores. Em partidas ranqueadas (F9), recebem com atraso de uma tacada.
- O cliente reaproveita `src/spectator/` (câmera cinematográfica, interface de transmissão).

## 8. Contas, cosméticos e loja (Seção 4)

### 8.1 Contas

- **Entrada sem atrito:** autenticação por dispositivo (convidado).
- **Vínculo:** Google e e-mail/senha. **Comprar exige conta vinculada**, para que os itens não se percam ao trocar de aparelho.
- **Perfil:** `username` público (único no Nakama), avatar a partir de presets, estatísticas. Filtro de palavras impróprias em PT-BR.
- **LGPD:** política de privacidade, consentimento, exportação e exclusão de conta (RPC).

### 8.2 Catálogo

Arquivo versionado no repositório (`services/nakama/src/catalog/catalog.json`), carregado na inicialização do Nakama e entregue ao cliente pela RPC `get_catalog` (com versão para cache).

```json
{
  "id": "cue_neon_001",
  "type": "cue",
  "name": "Neon",
  "rarity": "epic",
  "priceBrlCents": 990,
  "visual": { "preset": "neon" },
  "enabled": true
}
```

- Tipos no MVP: `cue`, `ballset`, `table`.
- `visual.preset` aponta para os presets existentes. A partir da F8, `visual.assets` pode referenciar modelo, texturas e miniatura.
- **O catálogo não tem nenhum campo de física.** A simulação não recebe o loadout, então nenhuma skin altera a física por construção.
- Um conjunto de bolas precisa preservar números e a distinção lisa/listrada (checklist de legibilidade antes de publicar).

### 8.3 Inventário e loadout

- **Inventário:** coleção `inventory`, chave `items`, um objeto por usuário. Leitura só pelo dono; escrita só pelo servidor (`permissionWrite: 0`). Conteúdo: `[{ id, source: 'default'|'purchase'|'reward', orderId?, acquiredAt }]`.
- **Loadout:** coleção `loadout`, chave `current`, escrita só pelo servidor. A RPC `equip(slot, itemId)` valida a posse do item e o tipo do lugar.
- **Na partida:** o `match_snapshot` traz o loadout de cada lugar.
  - O **taco** de cada jogador é visto por todos.
  - **Bolas e mesa:** cada participante vê os que tiver equipado (preferência de quem assiste).
- **Carregamento:** sob demanda, com o visual padrão enquanto carrega ou se falhar.
- **Prévia:** tela de visualização do item antes de equipar ou comprar.

### 8.4 Loja e pagamentos (F8)

- Venda **direta em reais**, sem moeda virtual paga e sem caixas de recompensa.
- Interface `PaymentProvider { createCheckout(order), fetchPayment(id), verifyWebhook(req) }`, com implementação para Mercado Pago ou Stripe.

**Fluxo:**

1. `create_order(itemId)`: o servidor confere que o item está ativo e que o jogador ainda não o tem. Cria o pedido `pending` com o preço do momento e gera o checkout (QR Pix ou cartão).
2. O jogador paga.
3. O webhook chega numa RPC do Nakama, autenticada por chave HTTP e assinatura do provedor.
4. O servidor **consulta o pagamento na API do provedor**, que é a fonte da verdade; o corpo do webhook não é confiável.
5. Se aprovado e o valor conferir, o servidor grava numa **escrita em lote com checagem de versão**: pedido `pending → paid` e item adicionado ao inventário. Conflito de versão → lê de novo e repete.
6. Notificação `item_granted` ao cliente.

**Regras complementares:**

- **Idempotência por `orderId`:** um pedido `paid` ignora webhooks repetidos; webhooks fora de ordem respeitam a máquina de estados.
- **Estorno ou chargeback:** pedido `refunded`, item removido; se estiver equipado, volta o padrão.
- **Reconciliação diária** (script externo): pedidos `pending` antigos são comparados com o provedor.
- **Fiscal:** emissão de nota fiscal de venda digital, a definir com contador antes do lançamento.

### 8.5 Pipeline de assets (antes das skins pagas)

- Modelos GLB com compressão (Draco ou meshopt), texturas KTX2, miniaturas WebP. Limites de tamanho por tipo, pensados para celular.
- Arquivos com nome por hash de conteúdo (cache imutável) na CDN; o catálogo referencia esses caminhos.
- Cliente: `GLTFLoader` + `KTX2Loader` sob demanda, cache LRU, padrão como fallback.
- Tacos seguem um gabarito: comprimento, ponto da ponta e ponto de empunhadura padronizados, para que a animação não mude.

## 9. Erros, segurança, testes e operação (Seção 5)

### 9.1 Tratamento de erros

| Situação | Comportamento |
|----------|---------------|
| Simulação com timeout ou erro 5xx | 1 nova tentativa; se falhar, devolve o turno ao mesmo jogador sem penalidade e reinicia o cronômetro; registra métrica. Três falhas na mesma partida → partida abortada sem resultado. |
| `shot_request` inválido | `shot_rejected { reason }`. Mais de 5 inválidos em 10 s → conexão removida. |
| Excesso de mensagens | Limite por conexão (`aim_update` ≤ 15/s; outras ≤ 5/s); o excedente é descartado. |
| Queda durante a reprodução | Ao reconectar, `match_snapshot` com deslocamento. |
| Queda do nó do Nakama | Partidas em memória se perdem e ficam como "abortadas", sem resultado. Aceito no MVP (nó único). |
| Resultado gravado duas vezes | Histórico indexado por `matchId`, gravado só se ainda não existir. |
| Webhook duplicado ou fora de ordem | Idempotência e máquina de estados do pedido. |
| Falha ao carregar asset | Skin padrão. |

### 9.2 Segurança

- O servidor decide tudo. Clientes nunca escrevem no armazenamento diretamente.
- Toda entrada de RPC e de partida é validada por validadores leves de `packages/protocol` (sem bibliotecas pesadas no runtime do Nakama).
- `services/sim` só na rede privada, com segredo em cabeçalho.
- Segredos em variáveis de ambiente, nunca no repositório.
- **Limite conhecido:** a linha-guia de mira roda no cliente e não pode ser imposta a um cliente modificado. Mitigação: o nível de ajuda é padronizado por modo e, nas ranqueadas (F9), há detecção estatística de precisão anormal.
- Sem chat livre no MVP; apenas emotes predefinidos.

### 9.3 Testes

| Alvo | Testes |
|------|--------|
| `packages/sim` | Unitários; **golden**: um conjunto fixo de tacadas (abertura, reta, efeitos, tabela, caçapa) com estado final gravado, que precisa ser idêntico bit a bit entre execuções no Node; **comparação de sensação** com a física atual (mesmas bolas encaçapadas, posições finais dentro de tolerância documentada); roteiro de teste manual. |
| Divergência entre navegadores | O conjunto golden roda em Chromium, Firefox e WebKit (Playwright) para medir divergência. É informativo: só afeta o modo offline. |
| `packages/modes` | Os 28 testes de regras portados; novos testes para N lugares, 2×2, cada um por si e abandono; invariantes (sempre há um lugar da vez até o fim). |
| `packages/protocol` | Codificação e decodificação ida e volta; fuzz dos validadores. |
| `services/nakama` | Unitários do manipulador de partida com `nk` e `dispatcher` falsos; integração com `docker compose` + bots em Node (`nakama-js`) jogando partidas completas: 1×1, reconexão, espectador, 2×2. |
| `apps/client` | Suítes Puppeteer existentes; reprodução de trajetória (trajetória → posições finais); interface de toque. |
| Carga | Bots simulando partidas simultâneas. Meta: p95 entre `shot_request` e `shot_result` abaixo de 500 ms; medir CPU por tacada. |
| CI | GitHub Actions: checagem de tipos, unitários, golden, build; integração com Docker. |

### 9.4 Operação

- **Métricas:** Prometheus do Nakama; histograma de duração e taxa de erro do `services/sim`.
- **Logs:** estruturados, com `matchId`, `turnId` e `seat`.
- **Alertas:** taxa de erro da simulação; p95 de latência da tacada.
- **Deploy:** imagens Docker versionadas; sim com versões N e N−1.
- **Administração:** console do Nakama para contas; estornos via provedor + webhook.

## 10. Fases (Seção 6)

Estimativas para um desenvolvedor experiente, em dias úteis. Não incluem produção de arte.

| Fase | Entrega | Estimativa |
|------|---------|------------|
| **F0** | Harness de desenvolvimento + spike: simulação headless mínima, medida no Node e no goja (Nakama). Relatório em `docs/spikes/`. | 2–4 |
| **F1** | Monorepo; `packages/sim` com passo fixo, eventos e trajetória; testes golden e de sensação; cliente offline reproduzindo trajetórias via Web Worker. | 8–12 |
| **F2** | `packages/modes` com N lugares; 8-ball e 9-ball portados; `LocalMatchController`. | 4–7 |
| **F3** | Infra (Docker), Nakama, autenticação (dispositivo, Google, e-mail), perfil, sala privada, matchmaking 1×1. | 4–7 |
| **F4** | Partida online 1×1 autoritativa: protocolo, `services/sim`, trajetória, cronômetro, reconexão, abandono, histórico. **Marco vertical.** | 8–14 |
| **F5** | Interface de toque, tradução PT-BR, perfil gráfico leve para celular, PWA. | 5–8 |
| **F6** | Cosméticos com presets: catálogo, inventário, loadout, prévia, sincronização. | 4–6 |
| | **MVP técnico (beta fechado)** | **35–58** |
| **F7** | Espectadores, duplas 2×2, grupos no matchmaking. | 6–10 |
| **F8** | Loja e pagamentos, pipeline de assets GLB/CDN, conformidade (LGPD, CDC, ECA Digital, fiscal). **Lançamento comercial.** | 10–15 |
| **F9** | Cada um por si (cutthroat), 9-ball online, ranking (OpenSkill), progressão, testes de carga e endurecimento. | 10–20 |
| | **Total** | **61–103** |

F7 e F9 podem ser feitas antes ou depois do lançamento.

## 11. Riscos

| Risco | Mitigação |
|-------|-----------|
| A extração da física muda a sensação do jogo | Testes de sensação contra a física atual + teste manual antes de remover o código antigo |
| Desempenho do goja | Só afeta a opção de implantação (5.5); a arquitetura padrão não depende dele |
| Latência em redes móveis | Medir na F4; a animação do taco disfarça até cerca de 400 ms |
| Questões jurídicas e fiscais (ECA Digital, LGPD, CDC, nota fiscal) | Revisão com advogado e contador antes da F8 |
| Custo de arte das skins pagas | Começar com variações de material; modelos 3D só para itens de maior raridade |
| Divergência do repositório original | Aceita (fork definitivo) |

## 12. Questões em aberto

| Questão | Quando decidir |
|---------|----------------|
| Mercado Pago ou Stripe | F8 |
| VPS ou Heroic Cloud | F3 |
| Regra de visibilidade de mesa e bolas (hoje: cada um vê as suas) | Revisão desta spec |
| Modos após 8-ball/9-ball (cutthroat confirmado como formato; sinuca brasileira ou snooker?) | Antes da F9 |
| Duração do cronômetro (45 s) e da reserva de reconexão (60 s) | Testes de jogo na F4 |
