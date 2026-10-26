# Protocolo da partida online, versão 1

Este documento é o contrato entre o cliente e o servidor da partida (Nakama), na versão 1 do protocolo (D055). Ele descreve o que o servidor faz hoje; a fonte da verdade é o código:

- `packages/protocol/src/` (`messages.ts`, `envelope.ts`, `trajectory.ts`): operações, leitores das mensagens, quantização, envelope e trajetória;
- `services/nakama/src/game/` e `services/nakama/src/match.ts`: fases, prazos, limites, reserva e histórico;
- `packages/modes/src/`: regras, tipos de decisão e operações da mesa;
- `services/sim/src/server.ts`: o serviço de simulação.

O teste `packages/protocol/test/protocol-doc.test.ts` confere que toda operação, recusa e código de erro do protocolo aparece aqui.

## 1. Versões e entrada

| Constante | Valor | Para que serve |
|-----------|-------|----------------|
| `PROTOCOL_VERSION` = 1 | formato das mensagens, do envelope e das regras de recusa | conferida ao entrar na partida |
| `SIM_VERSION` = 1 | física da simulação e formato da trajetória | vai nos snapshots (`simVersion`) e no histórico; o serviço de simulação aceita a versão atual e a anterior |

**Como entrar.** O cliente descobre o `matchId` por uma RPC (`create_private_match`, `join_by_code`) ou pelo matchmaker (ver `docs/f3/servidor-local.md`) e entra com o metadado da versão. Os valores do metadado são texto:

```js
await socket.joinMatch(matchId, undefined, { protocolVersion: '1' });
```

Sem o metadado, ou com outro valor, a entrada é recusada. O erro chega no campo `message` da exceção do `joinMatch`:

| Código | Quando | O que o cliente faz |
|--------|--------|---------------------|
| `PROTOCOL_MISMATCH` | `protocolVersion` ausente ou diferente de `PROTOCOL_VERSION` | pedir para recarregar a página |
| `MATCH_ENDED` | a partida já terminou | voltar ao menu |
| `ROOM_FULL` | os lugares estão ocupados (e quem entra não é um dos jogadores) | escolher outra sala |

**Entrar de novo.** Depois que a partida começou, só os jogadores dela entram (o servidor reconhece o `userId`). Quem volta recebe um `match_snapshot` (seção 10). Uma segunda aba do mesmo usuário substitui a primeira: a conexão antiga é removida e o lugar continua do usuário.

**Começo da partida.** Na sala privada, a partida começa quando entra o segundo jogador; na fila, quando os dois chegam à partida criada pelo matchmaker. Os lugares seguem a ordem de entrada (o primeiro a entrar é o lugar 0). O servidor sorteia quem abre (`firstSeat`) e manda um `match_snapshot` a cada jogador, com o `you.seat` dele. Antes disso o servidor não manda nada ao primeiro jogador.

## 2. Convenções

- **Mesa online:** `pool9ft`. Unidades em centímetros, no plano XZ (Y é para cima). O centro da mesa é `(0, 0)`; `x` vai de −63,5 a +63,5 e `z` de −127 a +127. A cabeceira fica em `z` negativo (a branca começa em `(0, −69,85)`, na linha da cabeceira) e o pé da mesa em `z` positivo (a bola da ponta do triângulo em `(0, +69,85)`). Raio da bola: 2,8575 cm.
- **Bolas:** `id` 0 é a branca; 1 a 15 são as bolas numeradas. Uma bola encaçapada tem `pocketed: true`; o servidor a deixa em `(0, 0)` até ser reposta.
- **Tacada:** `angle` em radianos; a bola sai na direção `(cos angle, sin angle)` no plano XZ, ou seja, `angle = atan2(dz, dx)`. O ângulo 0 aponta para `+x` e π/2 para `+z` (para o pé da mesa). `power` vai de 0 a 110 (`SHOT.maxPower`). `spin` é o ponto do taco na bola, `{ x, y }` com comprimento de no máximo 1: `x` é lateral e `y` vertical.
- **Lugares e equipes:** `seat` é o índice do lugar (0 e 1 no 1×1). No 1×1, `winnerTeam` é o lugar vencedor. `turnId` conta as decisões da partida (tacadas, vezes perdidas por tempo, respostas de push-out e saídas de lugar, como a desistência); começa em 0.
- **Mensagens do cliente:** o corpo é JSON em texto (`socket.sendMatchState(matchId, op, JSON.stringify(corpo))`). Todo número tem de ser finito e ter módulo de no máximo `MAX_ABS_NUMBER` = 1 000 000; `turnId` e `seq` são inteiros de 0 a 2 147 483 647. Campos desconhecidos são ignorados. Um número fora da faixa invalida a mensagem inteira (`BAD_MESSAGE`). O `JSON.parse` do runtime do Nakama recusa até literais como `1e999`: o corpo fica ilegível e a recusa vem com `seq: null`.
- **Mensagens do servidor:** `match_snapshot` (101) e `shot_result` (105) vão no envelope binário (seção 4). As outras vão em JSON, em texto (`JSON.parse(new TextDecoder().decode(data))`).
- **Ordem:** o servidor processa as mensagens a cada tick (10 por segundo), por ordem de chegada. Uma resposta pode demorar até um tick (100 ms) além da rede.

## 3. Operações

Os códigos abaixo de 100 são do cliente para o servidor (C→S) e os acima de 100, do servidor para o cliente (S→C).

| Op | Direção | Nome | Campos |
|----|---------|------|--------|
| 1 | C→S | `aim_update` | `turnId`, `angle`, `spin: { x, y }`, `power?` |
| 2 | C→S | `shot_request` | `turnId`, `seq`, `angle`, `power`, `spin: { x, y }`, `cueBall?: { x, z }`, `pushOut?` |
| 3 | C→S | `ball_in_hand_move` | `turnId`, `x`, `z` |
| 4 | C→S | `emote` | reservada: o servidor responde `error` com `UNSUPPORTED_OP` |
| 5 | C→S | `concede` | nenhum (o corpo nunca é lido) |
| 6 | C→S | `rematch_vote` | reservada: o servidor responde `error` com `UNSUPPORTED_OP` |
| 7 | C→S | `push_out_choice` | `turnId`, `accept` |
| 101 | S→C | `match_snapshot` | envelope: cabeçalho `SnapshotHeader` (seção 4.1) e, na volta no meio de uma reprodução, a trajetória |
| 102 | S→C | `aim_relay` | `seat`, `turnId`, `angle`, `spin`, `power?` |
| 103 | S→C | `shot_accepted` | `turnId`, `seq`, `seat`, `shot` (quantizada) |
| 104 | S→C | `shot_rejected` | `seq` (ou `null`), `reason` |
| 105 | S→C | `shot_result` | envelope: cabeçalho `ShotResultHeader` (seção 4.2) e a trajetória v1 |
| 106 | S→C | `seat_update` | `seat`, `connected` |
| 107 | S→C | `match_end` | `winnerTeam`, `reason`, `summary: { turns, shots }` |
| 108 | S→C | `error` | `code` |
| 109 | S→C | `ball_in_hand_relay` | `seat`, `turnId`, `x`, `z` |

### 3.1 Do cliente ao servidor

- **`aim_update` (1)** e **`ball_in_hand_move` (3)** são só visuais: o servidor repassa ao outro jogador (como 102 e 109, com o `seat` do remetente) e não guarda nada. Valem só quando o remetente é o lugar da vez, o `turnId` é o atual e a partida espera uma tacada; fora disso, e quando o corpo é inválido, o servidor descarta em silêncio, sem resposta e sem contar como recusa. O ritmo recomendado é de até 10 por segundo; o limite é 15 (seção 8). Os valores repassados não são quantizados. Só o corpo ilegível (JSON inválido) conta como recusa.
- **`shot_request` (2)** pede a tacada. `seq` é o contador do cliente, crescente; o par `(turnId, seq)` torna o reenvio idempotente (seção 9). `cueBall` posiciona a branca na bola na mão (veja as regras abaixo). `pushOut: true` declara um push-out do 9-ball.
- **`concede` (5)** encerra a partida: a outra equipe vence com o motivo `CONCEDE`. O corpo nunca é lido, então pode ser vazio. Só vale para um jogador da partida em andamento; em qualquer outro caso nada acontece.
- **`push_out_choice` (7)** responde ao push-out do 9-ball: depois da tacada com `pushOut: true`, a vez passa ao adversário, que responde. `accept: true` joga a partir de onde as bolas pararam; `accept: false` devolve a tacada a quem fez o push-out. O servidor trata a resposta como uma decisão e manda um `shot_result` de `kind: 'choice'`. A resposta fora de hora é recusada como `shot_rejected` com `NO_CHOICE_PENDING` e `seq: null`.
- Só as operações 1, 2, 3 e 7 têm o corpo lido como JSON. Qualquer outra operação (as reservadas 4 e 6, ou um código desconhecido) recebe `error` com `UNSUPPORTED_OP`, sem ler o corpo e sem contar como recusa.

**Bola na mão.** O `ruling.ballInHand` do último `shot_result` (e o `match.mode.ballInHand` dos snapshots) diz quem tem a bola na mão e onde: `{ seat, zone }`, com `zone` igual a `anywhere` ou `kitchen` (atrás da linha da cabeceira, `z ≤ −profundidade/2 · 0,55`). Quem tem a bola na mão põe a branca com `cueBall` no `shot_request`:

- a branca encaçapada (`pocketed: true`) exige `cueBall`; sem ele, a recusa é `CUE_BALL_INVALID`;
- com a branca na mesa, `cueBall` é opcional (ela pode ser reposicionada);
- sem bola na mão, `cueBall` é recusado (`CUE_BALL_NOT_ALLOWED`);
- a branca tem de ficar pelo menos 0,01 cm (um passo da quantização) longe de encostar numa tabela ou noutra bola em jogo; senão, `CUE_BALL_INVALID`. Uma branca posta encostada é lançada pela tabela, ou a simulação acusa um contato com a bola vizinha mesmo quando a tacada vai para o outro lado:
  - **tabelas:** a bola encosta na tabela quando o centro dela está a `cushionInset` = 10,594 cm da borda (o chanfro das tabelas da simulação; o valor vem em `match.mode.config.table.cushionInset`). O centro da branca fica então em `|x| ≤ 63,5 − 10,594 − 0,01 ≈ 52,896` e `|z| ≤ 127 − 10,594 − 0,01 ≈ 116,396`. Depois de quantizado, o maior valor aceito é 52,89 e 116,39: um cliente que prende o ponto no limite deve arredondar em direção ao centro da mesa. Nenhum ponto dentro desse retângulo fica no raio em que uma caçapa engole a bola;
  - **outras bolas:** o centro da branca fica a pelo menos 2R + 0,01 cm (5,725 cm) do centro de cada bola em jogo;
- na `kitchen`, `z` tem de ser no máximo a linha da cabeceira, **depois de quantizado**. A linha em ponto flutuante é −69,85000000000001, que a quantização arredonda para −69,85, um valor acima dela: um cliente que prende o ponto exatamente na linha leva `CUE_BALL_OUTSIDE_KITCHEN`. Deixe uma folga de 0,01 cm (use `z ≤ −69,86`).

### 3.2 Do servidor ao cliente

- **`match_snapshot` (101):** o estado completo, para cada jogador com o `you.seat` dele. Vai no começo da partida, na volta de quem caiu, no reenvio de uma tacada já aceita, junto com um `TURN_MISMATCH` e depois de um `SIM_FAILED`.
- **`shot_accepted` (103):** a tacada passou nas verificações. Vai a todos, inclusive ao remetente, antes de a simulação rodar (o taco do adversário pode animar). `shot` é a tacada já quantizada (seção 6).
- **`shot_rejected` (104):** só para o remetente. `seq` repete o do pedido, ou é `null` quando o pedido não tinha um `seq` legível. Os motivos estão na seção 7.1.
- **`shot_result` (105):** o resultado de uma tacada, de uma vez perdida por tempo ou de uma resposta de push-out, a todos. Cada uma gera exatamente um. As saídas de lugar (desistência, W.O., terceira vez perdida por tempo) não geram: vão direto ao `match_end`.
- **`seat_update` (106):** um lugar caiu (`connected: false`) ou voltou (`connected: true`). Vai aos outros jogadores.
- **`match_end` (107):** a partida terminou (seção 11). Vai a todos, uma vez.
- **`error` (108):** `{ code }`, com `UNSUPPORTED_OP` ou `SIM_FAILED` (seção 7.2).
- **`aim_relay` (102)** e **`ball_in_hand_relay` (109):** o que o lugar da vez está mirando ou arrastando. Vão só aos outros jogadores.

## 4. Envelope binário (101 e 105)

```
[u32 LE: tamanho do cabeçalho em bytes][cabeçalho: JSON em ASCII][carga útil]
```

- O cabeçalho é JSON com todo caractere acima de U+007F escrito como `\uXXXX`, para ser lido byte a byte (o runtime do Nakama não tem `TextEncoder`).
- A carga útil é a trajetória v1 (seção 5), ou vazia. O servidor manda exatamente os bytes do envelope. No cliente, `decodeEnvelope(bytes)` de `@billiards/protocol` devolve `{ header, payload }`; o `payload` é uma visão do mesmo buffer, não uma cópia.
- Um envelope truncado, com byte não ASCII no cabeçalho ou com JSON inválido lança `RangeError`.

### 4.1 Cabeçalho do `match_snapshot`

| Campo | Tipo | Significado |
|-------|------|-------------|
| `protocolVersion`, `simVersion` | número | as versões do servidor |
| `mode`, `format` | texto | `8ball` ou `9ball`; `1v1` |
| `phase` | texto | `LOBBY`, `AWAITING_SHOT` ou `ENDED` |
| `you` | `{ seat }` | o lugar do destinatário (`null` para quem não joga) |
| `seats` | lista | por lugar: `seat`, `userId`, `username`, `connected`, `timeouts` (vezes seguidas perdidas por tempo) |
| `turnId` | número | o `turnId` atual: é o que o próximo `shot_request` deve trazer |
| `match` | `MatchState` | o estado oficial (veja abaixo) |
| `table` | `TableState` | a mesa oficial: `tableProfileId` e `balls: [{ id, x, z, pocketed, q? }]`; `q` é o quatérnio `[x, y, z, w]` e só existe depois da primeira tacada |
| `turn` | `{ seat, turnId, deadlineInMs }` ou `null` | o lugar da vez e o tempo que resta para a tacada; `null` fora de `AWAITING_SHOT` |
| `playback` | `{ result, offsetMs }` ou `null` | a tacada ainda em reprodução na volta de um jogador (seção 10) |
| `end` | `MatchEnd` ou `null` | só em um snapshot enviado depois do fim (o reenvio da última tacada) |

`MatchState` (de `packages/modes`): `{ seats: [{ index, userId, connected, timeouts }], turnId, phase, mode }`. O `mode` é o estado do modo de jogo: `modeId`, `config` (`format`, `table: { width, depth, ballRadius, cushionInset }`, `maxPower`), `turn` (`seats: [{ index, team, eliminated }]`, `teams`, `currentSeat`), `breakShot` (a próxima tacada é a abertura), `ballInHand`, `winnerTeam` e os campos de cada modo: no 8-ball, `groups` (por equipe: `solid`, `stripe` ou `null` com a mesa aberta) e `pocketed`; no 9-ball, `pocketed`, `fouls` e `pushOut: { available, pending, seat }`.

### 4.2 Cabeçalho do `shot_result`

| Campo | Tipo | Significado |
|-------|------|-------------|
| `kind` | texto | `shot` (uma tacada), `timeout` (a vez estourou) ou `choice` (resposta de push-out) |
| `turnId` | número | o `turnId` em que a decisão aconteceu; depois dela o `match.turnId` é 1 maior |
| `seq` | número ou `null` | o `seq` do pedido; `null` em `timeout` e `choice` |
| `seat` | número | o lugar que tacou, perdeu a vez ou respondeu |
| `shot` | tacada ou `null` | a tacada quantizada, como em `shot_accepted` |
| `events` | lista | os eventos da simulação (seção 5.3); vazia sem tacada |
| `final` | `TableState` | o estado exato que a simulação deixou, com `q` em todas as bolas (sem tacada, é a mesa de antes) |
| `table` | `TableState` | a mesa oficial depois das regras: `final` com as bolas repostas (`ruling.respot`) |
| `ruling` | objeto | a decisão das regras (abaixo) |
| `match` | `MatchState` | o estado oficial depois da decisão |
| `durationMs` | número | a duração da reprodução (tempo simulado) em milissegundos; 0 sem tacada |
| `capped` | booleano | a simulação parou no limite de 20 s de tempo simulado, e não com as bolas paradas |
| `nextTurn` | `{ seat, turnId, deadlineInMs }` ou `null` | o próximo lugar da vez; `null` quando a decisão encerrou a partida |

`ruling`: `fouls` (lista de códigos de falta), `ballInHand` (`{ seat, zone }` ou `null`), `nextSeat`, `winnerTeam`, `respot` (as bolas devolvidas à mesa, já aplicadas em `table`) e `messages` (`[{ code, params? }]`). O servidor só manda códigos; o texto de cada um é do cliente.

| Falta (`fouls`) | Quando |
|-----------------|--------|
| `SCRATCH` | a branca caiu |
| `NO_BALL_HIT` | a branca não tocou em nenhuma bola |
| `NO_RAIL_AFTER_CONTACT` | depois do contato, nenhuma bola encostou numa tabela nem caiu |
| `WRONG_FIRST_HIT` | a primeira bola tocada não era permitida |
| `ILLEGAL_BREAK` | a abertura não encaçapou nem levou quatro bolas a uma tabela |
| `EARLY_EIGHT` | a bola 8 caiu antes da hora |
| `TIMEOUT` | a vez estourou |

Códigos de `messages` (`code`): `BREAK_FOUL`, `ILLEGAL_BREAK`, `BREAK_NO_POCKET`, `BREAK_LEGAL`, `EIGHT_ON_BREAK_RESPOT`, `EARLY_EIGHT`, `LEGAL_EIGHT_WIN`, `NINE_ON_BREAK_WIN`, `LEGAL_NINE_WIN`, `NINE_ON_FOUL_RESPOT`, `FOUL`, `NO_POCKET`, `POCKETED`, `PUSH_OUT_PENDING`, `PUSH_OUT_ACCEPTED`, `PUSH_OUT_PASSED`, `THREE_FOUL_WARNING`, `THREE_FOUL_LOSS` e `TIMEOUT`. Os parâmetros, quando há, são números ou textos (por exemplo `FOUL` traz `reason`, e `POCKETED` traz `count`).

**Tempo.** `nextTurn.deadlineInMs` vale para o instante em que o `shot_result` saiu e já inclui a reprodução: é a duração da tacada arredondada para cima ao décimo de segundo, mais 1 s de folga, mais os 45 s da vez. Em `timeout` e `choice` não há reprodução, e o prazo é de 45 s. O mesmo vale para `turn.deadlineInMs` do snapshot, calculado no instante do envio.

## 5. Trajetória v1

A trajetória é a carga útil do `shot_result`. Ela traz as posições e as rotações das bolas que se mexem, a 30 quadros por segundo, para o cliente reproduzir a tacada com interpolação. Não é o resultado: o estado exato vem no cabeçalho (`final` e `table`), e o cliente o aplica ao fim da reprodução.

### 5.1 Formato

Binário, little-endian:

| Parte | Campo | Tipo | Observação |
|-------|-------|------|------------|
| cabeçalho (4 bytes) | `version` | u8 | 1 |
| | `sampleRate` | u8 | 30 |
| | `frameCount` | u16 | número de quadros |
| por quadro | `movingCount` | u8 | quantas bolas vêm a seguir |
| por bola (12 bytes) | `id` | u8 | 0 a 255 |
| | `x` | i16 | centésimos de centímetro |
| | `z` | i16 | centésimos de centímetro |
| | `largest` | u8 | índice (0 a 3) da maior componente do quatérnio |
| | três componentes | 3 × i16 | as outras componentes, na ordem dos índices |

- **Tempo:** o quadro `i` (contado de 0) está em `t = (i + 1) / 30` s. A amostragem começa das bolas já colocadas, antes do golpe, e para no último múltiplo de 12 passos de simulação (a 360 passos por segundo): o que passa disso só aparece no estado final.
- **Quais bolas:** cada quadro traz só as bolas que se moveram ou giraram desde a amostra anterior. Uma bola que caiu numa caçapa aparece mais uma vez, no ponto onde foi detectada, e some depois.
- **Posição:** `x` e `z` em centésimos de centímetro, no intervalo de ±327,67 cm.
- **Rotação:** quatérnio `[x, y, z, w]` unitário na forma "três menores". `largest` é o índice da maior componente em módulo; ela não é gravada e vale `sqrt(1 − soma dos quadrados das outras)`, sempre positiva (o sinal do quatérnio é trocado se for preciso, porque `q` e `−q` são a mesma rotação). Cada uma das outras três componentes é um i16 igual a `valor · 32767 · √2`.
- **Limites:** no máximo 65 535 quadros e 255 bolas por quadro. Valores fora da faixa fazem o codificador lançar `RangeError`, em vez de truncar.
- **Sem tacada:** `timeout`, `choice` e uma tacada de força 0 levam a trajetória vazia (4 bytes, `frameCount` 0).
- **Tamanho:** de 4 bytes a algumas dezenas de KB; a abertura fica em torno de 27 KB.
- **Decodificar:** `decodeTrajectory(bytes)` de `@billiards/protocol` devolve `[{ t, balls: [{ id, x, z, q }] }]`. Versão ou taxa desconhecida, buffer truncado e bytes sobrando são erros.

### 5.2 Reprodução

O cliente interpola os quadros na taxa de quadros da tela e, ao fim, aplica `table`. Um cliente que entra no meio da tacada recebe um `offsetMs` que pode passar do último quadro (seção 10): ele tem de tolerar isso e ir direto ao estado final.

### 5.3 Eventos

Os `events` do `shot_result` ficam em ordem e têm `t` em segundos de tempo simulado (`passo / 360`), o mesmo relógio dos quadros:

| `type` | Campos | Quando |
|--------|--------|--------|
| `ball_ball` | `a`, `b` (com `a < b`), `speed` | início de um contato entre duas bolas |
| `ball_cushion` | `ball`, `speed` | início de um contato de uma bola com a tabela |
| `pocket` | `ball`, `pocket` | uma bola caiu; `pocket` é o índice da caçapa |
| `first_contact` | `ball` | a primeira bola que a branca tocou; sai junto com o primeiro `ball_ball` da branca |

Índices das caçapas, com `W = 63,5` e `D = 127`: 0 é `(−W, −D)`, 1 é `(W, −D)`, 2 é `(−W, 0)`, 3 é `(W, 0)`, 4 é `(−W, D)` e 5 é `(W, D)`.

## 6. Quantização

O servidor arredonda a tacada antes de validar, simular e gravar, para que os mesmos números sejam usados nos três lugares. A tacada quantizada é a que volta em `shot_accepted` e em `shot_result.shot`.

| Campo | Passo | Observação |
|-------|-------|------------|
| `angle` | 1e-5 rad | |
| `power` | 1e-3 | |
| `spin.x`, `spin.y` | 1e-3 | o comprimento nunca passa de 1: se o arredondamento o ultrapassar, o efeito é reduzido a comprimento 1 e cortado em direção ao zero |
| `cueBall.x`, `cueBall.z` | 0,01 cm | |

A quantização é idempotente, e um cliente pode aplicar a mesma regra antes de enviar (`quantizeShot` de `@billiards/protocol`). A validação (seção 7.1) usa o valor já quantizado.

## 7. Recusas e erros

### 7.1 Motivos de `shot_rejected` (104)

Cada `shot_request` passa por estas verificações, nesta ordem. A primeira que falha decide o motivo.

| Motivo | Quando |
|--------|--------|
| `BAD_MESSAGE` | o corpo não é JSON legível, ou falta um campo, ou um campo tem tipo errado, ou um número não é finito ou passa de 1 000 000 em módulo. Vale também para um `push_out_choice` ilegível |
| *(reenvio)* | `(turnId, seq)` igual ao da última tacada aceita deste lugar: não é uma recusa; o servidor devolve um `match_snapshot` (seção 9) |
| `NOT_AWAITING_SHOT` | a partida não espera uma tacada (ainda não começou, ou já terminou) |
| `NOT_YOUR_TURN` | o remetente não é o lugar da vez. Uma tacada que chega no tick do prazo também cai aqui: o relógio roda antes das mensagens e a vez já passou |
| `TURN_MISMATCH` | o `turnId` não é o atual. O servidor manda também um `match_snapshot` ao remetente, para ele ressincronizar o `turnId` e enviar de novo |
| `GAME_OVER` | as regras já deram a partida por encerrada |
| `BAD_INPUT` | força fora de 0 a 110, ou efeito com comprimento acima de 1 |
| `PUSH_OUT_PENDING` | há um push-out do 9-ball esperando resposta (`push_out_choice`) |
| `PUSH_OUT_UNAVAILABLE` | `pushOut: true` onde o modo não permite |
| `CUE_BALL_NOT_ALLOWED` | `cueBall` sem ter a bola na mão |
| `CUE_BALL_OUTSIDE_KITCHEN` | `cueBall` à frente da linha da cabeceira, com a bola na mão na `kitchen` |
| `CUE_BALL_INVALID` | `cueBall` a menos de 0,01 cm de encostar numa tabela ou noutra bola (seção 3.1); ou tacada sem `cueBall` com a branca encaçapada |
| `NO_CHOICE_PENDING` | `push_out_choice` sem push-out pendente, de quem não é o lugar da vez, ou com `turnId` velho |

Os motivos `BAD_MESSAGE`, `NOT_AWAITING_SHOT`, `TURN_MISMATCH`, `NO_CHOICE_PENDING` e `CUE_BALL_INVALID` são do servidor (`SERVER_REJECT_REASONS`). `GAME_OVER`, `NOT_YOUR_TURN`, `BAD_INPUT`, `PUSH_OUT_PENDING`, `PUSH_OUT_UNAVAILABLE`, `CUE_BALL_NOT_ALLOWED` e `CUE_BALL_OUTSIDE_KITCHEN` vêm das regras do modo (`RejectReason` em `packages/modes`). Toda recusa conta para o limite da seção 8.

### 7.2 Códigos de `error` (108)

| Código | Quando |
|--------|--------|
| `UNSUPPORTED_OP` | só para o remetente: operação reservada (4 e 6) ou desconhecida |
| `SIM_FAILED` | a todos: o serviço de simulação falhou duas vezes seguidas (tempo esgotado, resposta com erro ou ilegível). A tacada não aconteceu |

Depois de um `SIM_FAILED`, o servidor manda um `match_snapshot` a todos, a vez recomeça com 45 s e o mesmo pedido pode ser enviado de novo (o par `(turnId, seq)` volta a valer). A terceira falha na partida a encerra com `ABORTED`.

### 7.3 O que o servidor descarta em silêncio

- mensagens acima do limite de ritmo (seção 8);
- mensagens de quem não é jogador da partida, ou de uma conexão que já foi substituída por outra do mesmo usuário;
- `aim_update` e `ball_in_hand_move` inválidos ou fora do turno;
- `concede` fora de uma partida em andamento.

## 8. Prazos, reserva e limites

O laço da partida roda a 10 ticks por segundo (`TICK_RATE`). Os prazos são medidos em ticks do servidor.

| O quê | Valor | O que acontece |
|-------|-------|----------------|
| Vez | 45 s | Estourou: o servidor manda um `shot_result` de `kind: 'timeout'` com a falta `TIMEOUT` (o próximo lugar recebe bola na mão onde o modo prevê), e a vez passa. A contagem da vez seguinte começa na hora |
| Vezes seguidas perdidas | 3 | O lugar que deixa a vez estourar três vezes seguidas abandona: o servidor manda direto o `match_end` com `ABANDON`, sem um terceiro `shot_result`. Uma tacada aceita zera a contagem (`timeouts` em `seats`) |
| Reprodução | acompanha a tacada | O servidor não espera a reprodução: já aceita a próxima tacada. A vez seguinte tem 45 s contados depois da reprodução e de 1 s de folga (seção 4.2) |
| Reserva de reconexão | 60 s | Quem cai mantém o lugar por 60 s. Se for a vez dele, o relógio da vez continua. Passados os 60 s, o lugar perde por W.O. (`ABANDON`). Se todos os outros lugares também estão fora, a partida termina `ABORTED`, sem vencedor e sem histórico |
| Saguão da fila | 30 s | Partida pública sem adversário depois de 30 s termina `ABORTED` |
| Sala vazia | 60 s | Uma sala sem ninguém conectado fecha |
| Fim da partida | 10 s | A sala fica aberta por 10 s depois do `match_end`, para os clientes lerem o fim e o último resultado, e então fecha |

Limites por conexão:

| Limite | Valor | Excedente |
|--------|-------|-----------|
| `aim_update` e `ball_in_hand_move` (somados) | 15 por segundo | descartado em silêncio |
| as outras mensagens (`shot_request`, `concede`, `push_out_choice`) | 5 por segundo | descartado em silêncio: um cliente que manda tacadas mais depressa que isso, como um bot sem pausa, perde o pedido sem receber resposta |
| recusas (`shot_rejected`) | mais de 5 em 10 s | o servidor remove a conexão (`matchKick`). O lugar continua do jogador, que pode voltar dentro da reserva |

A simulação tem 3 s de limite por tentativa e uma nova tentativa; 3 falhas na partida a abortam.

## 9. Fluxo de uma tacada e reenvio idempotente

1. O cliente do lugar da vez envia `shot_request` com o `turnId` do último snapshot ou `shot_result` e um `seq` novo.
2. O servidor valida (seção 7.1). Se aceitar, manda `shot_accepted` a todos e chama o serviço de simulação.
3. Com o resultado, aplica as regras, avança o `turnId` e manda um `shot_result` a todos. Se a decisão decidiu a partida, manda em seguida o `match_end`.
4. Todos reproduzem a trajetória e aplicam `table` ao final.

Se a confirmação se perde ou o cliente não sabe se o pedido chegou, ele envia o mesmo `shot_request` de novo, com o mesmo `turnId` e o mesmo `seq`. O servidor reconhece a cópia (é a última tacada aceita daquele lugar), não faz uma segunda tacada e responde ao remetente com um `match_snapshot` do estado atual. O `seq` só precisa crescer entre tacadas; um pedido novo, com outro par, é uma tacada nova.

## 10. Reconexão e deslocamento de reprodução

1. Quando a conexão de um jogador sai, os outros recebem `seat_update` com `connected: false`. O lugar fica reservado por 60 s.
2. O cliente guarda o `matchId` e entra de novo (seção 1). O servidor remove qualquer conexão antiga do mesmo usuário, devolve o lugar, manda o `match_snapshot` a quem voltou e `seat_update` com `connected: true` aos outros.
3. Se a última tacada ainda está em reprodução, o snapshot traz `playback: { result, offsetMs }` e a trajetória como carga útil do envelope. `result` é o cabeçalho do `shot_result` daquela tacada; `offsetMs = (tick atual − tick do envio) · 100`. O cliente retoma a reprodução desse ponto.
4. O `playback` só vai enquanto `offsetMs` é menor que a duração da tacada arredondada para cima ao décimo de segundo, mais 1 s de folga. Por isso **o `offsetMs` pode passar do último quadro da trajetória e de `durationMs`, em até 1 s**: o cliente tem de tratar esse caso (ir direto ao estado final). Sem `playback`, a mesa oficial está em `table`.
5. Um `timeout`, um `choice` ou uma tacada de força 0 não têm o que reproduzir e nunca vão em `playback`.

## 11. Fim da partida e histórico

`match_end` traz `{ winnerTeam, reason, summary: { turns, shots } }`. `winnerTeam` é `null` quando não há vencedor. `turns` é o `turnId` final e `shots` é o número de tacadas.

| Motivo (`reason`) | Quando |
|-------------------|--------|
| `WIN` | as regras decidiram: a bola 8 ou a 9 caiu na hora certa, ou o adversário a derrubou na hora errada, ou o 9-ball chegou à terceira falta seguida |
| `CONCEDE` | um jogador enviou `concede`; a outra equipe vence |
| `ABANDON` | W.O. depois de 60 s fora, ou três vezes seguidas perdidas por tempo; a outra equipe vence |
| `ABORTED` | partida sem resultado: fila sem adversário em 30 s, os dois jogadores fora ao fim da reserva, 3 falhas da simulação ou desligamento do servidor. Sem vencedor e sem histórico |

**Registro em `match_history`.** Toda partida que acaba por `WIN`, `CONCEDE` ou `ABANDON` deixa um registro, gravado uma única vez pelo servidor (`version: '*'`: só cria):

- coleção `match_history`, chave igual ao `matchId`, dono igual ao usuário do sistema (`00000000-0000-0000-0000-000000000000`), leitura pública (2) e escrita só do servidor (0);
- valor: `matchId`, `mode`, `format`, `private`, `players` (`[{ seat, team, userId, username }]`), `firstSeat`, `rack` (`fixed`), `simVersion`, `protocolVersion`, `shots`, `winnerTeam`, `reason`, `turns`, `startedAt` e `endedAt` (milissegundos desde 1970);
- `shots` traz as tacadas já quantizadas, em ordem: `[{ turnId, seat, shot }]`. Vez perdida por tempo e resposta de push-out não entram (por isso `turns` pode ser maior que o número de tacadas);
- o registro é gravado no instante do `match_end`: um cliente que lê logo depois pode precisar tentar de novo por um momento.

**Como o cliente lê.** O Nakama 3.41 recusa o `user_id` do usuário do sistema numa leitura de cliente. Por isso a leitura por chave **não leva `user_id`**:

```js
const { objects } = await client.readStorageObjects(session, { object_ids: [{ collection: 'match_history', key: matchId }] });
```

Sem `user_id`, o Nakama devolve o objeto público do sistema com essa chave. A listagem (`listStorageObjects(session, 'match_history', '00000000-0000-0000-0000-000000000000', limite, cursor)`) é por ordem de chave, e as chaves são `matchId` aleatórios: passe um `limite` e **siga o `cursor` até achar a chave**; a primeira página pode não ter o registro, e a página padrão tem um objeto só.

## 12. Serviço de simulação (contrato interno)

Só o Nakama chama o serviço, de dentro da rede do Compose; ele não publica porta. `POST /simulate` leva o cabeçalho `x-sim-secret` com o segredo compartilhado (`SIM_SECRET`) e o corpo `{ simVersion, table, shot }`, com `table` no formato `TableState` e `shot` com `angle`, `power`, `spin` e `cueBall?`. O corpo tem no máximo 64 KiB.

| Status | Corpo | Quando |
|--------|-------|--------|
| 200 | `{ trajectory, events, final, steps, simSeconds, capped }` | `trajectory` é a trajetória v1 em base64 padrão; `final`, `events` e `capped` são os do cabeçalho do `shot_result`; `simSeconds` é o tempo simulado |
| 401 | `{ error: 'UNAUTHORIZED' }` | segredo ausente ou errado |
| 413 | `{ error: 'BODY_TOO_LARGE' }` | corpo acima de 64 KiB |
| 400 | `{ error: 'BAD_REQUEST' }` | JSON ilegível ou sem `table` e `shot` |
| 400 | `{ error: 'SIM_VERSION_UNSUPPORTED', versions }` | `simVersion` desconhecida; `versions` lista as aceitas |
| 400 | `{ error: 'SIM_INPUT_INVALID', detail }` | a simulação recusou a mesa ou a tacada |
| 404 | `{ error: 'NOT_FOUND' }` | outro caminho |

`GET /healthz` responde `{ ok: true, versions }`. Qualquer resposta que não seja 200 conta como falha da tentativa (seção 7.2).

## 13. Reservado para depois

- `emote` (4) e `rematch_vote` (6) existem como códigos, mas o servidor ainda os recusa com `UNSUPPORTED_OP`.
- 2×2, cada um por si e espectadores usam as mesmas mensagens; as regras de lugar e equipe já estão em `packages/modes`, mas o servidor só abre partidas 1×1.
- A arrumação da mesa é fixa (`rack: 'fixed'`, D060) até haver uma ordem aleatória com semente.
