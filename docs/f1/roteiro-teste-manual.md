# Roteiro de teste manual da F1-B (confirmação do recuo, F1-09)

Este roteiro fecha o segundo critério do F1-09: "a mesma tacada no jogo, no navegador, tem o comportamento confirmado pelo usuário". O sim calibrado pela D041 faz a branca da `draw-ref` voltar cerca de 61 cm. Quem confirma que isso parece certo no jogo é você, olhando a mesa.

## 1. Subir o jogo

```bash
npm install        # só na primeira vez
npm run dev        # servidor de desenvolvimento, porta 5173
```

Abra `http://localhost:5173` num navegador de desktop (Chrome ou Edge). O gancho das tacadas de referência só existe nesse servidor: o build de produção (`npm run build`) não o inclui.

## 2. Abrir o Treino livre

1. No menu principal, clique em **单人练习** (Treino livre, o primeiro botão de "开始游戏").
2. Espere a mesa aparecer e o jogo ficar em modo de mira.
3. Abra o console do navegador (F12, aba Console).

## 3. Tacadas de referência

No console, chame uma tacada por vez e espere ela terminar antes da próxima:

```js
await __referenceShot('draw-ref')
await __referenceShot('long-stun')
await __referenceShot('pot-corner')
await __referenceShot('pot-side')
```

Cada chamada arruma a mesa da tacada (só as bolas dela ficam; as outras somem), define mira, força e efeito, bate e devolve o resultado da simulação. A tacada toca na tela como uma tacada normal. Para repetir, chame de novo: a mesa é arrumada outra vez.

### O que observar em cada tacada

Em todas, observe estas três coisas: se a branca **volta depois do contato** (ou segue em frente, quando é o caso), o **percurso** que ela faz e **onde ela para**. Os tempos abaixo são de relógio da tacada; ela inteira dura entre 5 e 14 s.

**`draw-ref`**: o ponto do F1-09.

- Montagem: bola 1 no centro da mesa, branca a 50 cm dela, força 60, efeito para trás (y = −0,8), mira reta na bola 1.
- A branca bate na bola 1 em 0,18 s e **volta**: ela para cerca de **61 cm** atrás do ponto do contato (o teste automático mede 61,1 cm).
- A bola 1 vai até a tabela do fundo (1,1 s), volta e toca de novo na branca por volta de 4,1 s. Isso a simulação prevê; diga se parece natural.
- Se a branca não voltar, ou voltar bem menos que isso, é um defeito.

**`long-stun`**: mudou de sensação na D041.

- Montagem: só a branca, força 70, sem efeito, em linha reta pelo comprimento da mesa.
- Ela bate na tabela do fundo (0,7 s), volta até a outra tabela curta (2,7 s) e segue de novo até parar perto da primeira. O percurso fica em torno de **675 cm**; o jogo antigo fazia 548 a 633 cm. Ou seja, a bola rola um pouco mais.

**`pot-corner`**: mudou de sensação na D041.

- Montagem: bola 1 e branca, corte de cerca de 15°, força 30, na caçapa de canto.
- A bola 1 é encaçapada (0,4 s). A branca bate numa tabela (0,7 s) e para depois de cerca de **92 cm** de percurso (o jogo antigo: 66 a 89 cm).

**`pot-side`**: mudou de sensação na D041.

- Montagem: bola 1 e branca, corte de cerca de 20°, força 25, na caçapa do meio.
- A bola 1 é encaçapada (0,4 s). A branca bate numa tabela (0,8 s) e para depois de cerca de **119 cm** de percurso. O jogo antigo fazia 163 a 194 cm: a branca anda bem menos depois da tabela.

Os números do jogo antigo e do sim calibrado estão em `packages/sim/test/feel/legacy-reference.json` e `sim-reference.json`. O trade-off dessas três tacadas foi escolhido por você na D041 (recuo funcionando em vez da sensação do legado). Aqui importa saber se o resultado parece **aceitável**, não se ele é idêntico ao jogo antigo.

O resultado da última tacada fica em `__menu.game.lastShotResult` (percurso em `frames`, eventos em `events`, posição final em `final`). Se uma chamada reclamar que o jogo não está em AIM, espere a tacada anterior terminar e a mira voltar.

## 4. Uma partida livre contra a IA

1. Volte ao menu e clique em **对战 AI** (contra a IA).
2. Jogue uma partida inteira ou, no mínimo, uns 10 minutos: quebra, tacadas com efeito (use o seletor de efeito da interface) e algumas faltas.
3. Observe se:
   - as bolas se movem de forma contínua, sem teleportes nem travadas;
   - os sons e os efeitos de contato e de caçapa acontecem na hora do contato;
   - o efeito para trás (draw) e o efeito para frente (follow) fazem a branca se comportar como você espera;
   - a rotação das bolas parece certa na abertura e nas tacadas fortes com efeito para frente ou para trás: uma bola rápida que parece girar ao contrário do sentido em que anda é o limite da D044 (anote em que tacada e em que momento);
   - a IA joga as tacadas dela normalmente.

## 5. Onde registrar a resposta

Escreva o veredito em `harness/progress.md`, na entrada da sessão: o que viu em cada uma das quatro tacadas (a branca voltou? o percurso parece certo? onde parou?), o que achou da partida contra a IA e qualquer comportamento estranho.

O F1-09 só passa a `"passes": true` em `harness/feature_list.json` **depois dessa confirmação**. Se o recuo não parecer certo, não marque: abra uma decisão nova em `harness/decisions.json`, como a D039 fez.
