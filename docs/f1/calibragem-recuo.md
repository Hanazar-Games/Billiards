# Calibragem do recuo (F1-09, parte do sim)

Status: **fechada pela D041** (Tarefa 8 do plano da F1-A). O usuário escolheu a opção 1 da D039:

- `TUNING` passa a ser a tentativa 6 (recuo de 61,1 cm, invariante conservado).
- A referência de sensação de long-stun, pot-corner e pot-side passa a ser o sim calibrado (`packages/sim/test/feel/sim-reference.json`), com as margens da D038.
- Os dois testes de `packages/sim/test/calibration.test.js` passam.

Para reproduzir qualquer linha abaixo, rode a partir de `packages/sim`:

```bash
node tools/feel-report.mjs '{"ballTableFriction": 0}'
```

O JSON sobrescreve `TUNING_LEGACY`. O relatório mostra:

- as tacadas fora da referência de sensação (o envelope do legado da D038 ou, nas tacadas da D041, o sim calibrado);
- o recuo da `draw-ref`;
- o invariante de rolamento 2,5v + ωR depois de 0,1 s.

## Critérios

1. Teste de sensação (D033/D038): as 11 tacadas do corpus dentro do envelope do legado medido em 14 taxas de quadro. Depois da D041, long-stun, pot-corner e pot-side usam o sim calibrado como referência; as contagens da coluna "Sensação" abaixo são contra o legado.
2. `draw-ref` (branca a 50 cm da bola 1, força 60, efeito y = −0,8): a branca volta pelo menos 10 cm depois do contato.
3. Bola sozinha com efeito para trás: 2,5v + ωR muda no máximo 5% nos primeiros 0,1 s. É o momento angular em torno do ponto de contato, que o atrito com o pano conserva numa esfera maciça.

## Diagnóstico medido

Os números abaixo são de uma bola sozinha, força 30, com a branca no meio da mesa.

| | Logo após a tacada | 0,05 s | 0,1 s | 1,0 s |
|---|---|---|---|---|
| Legado, sem efeito: v / ωR (cm/s) | 111 / 98 | 105 / 105 | 105 / 105 | 98 / 97 |
| Legado, efeito para trás: v / ωR (cm/s) | 29 / −132 | −35 / −35 | −35 / −35 | −31 / −31 |
| Sem atrito do cannon, sem efeito: v / ωR (cm/s) | 176 / 0 | 156 / 51 | 143 / 81 | 118 / 117 |
| Sem atrito do cannon, efeito para trás: v / ωR (cm/s) | 176 / −353 | 115 / −198 | 78 / −106 | 23 / 23 |

- **Causa do recuo quebrado.** O atrito bola-mesa do cannon-es (0,15) leva a bola ao rolamento puro já no primeiro passo de 1/360 s. Ele não conserva 2,5v + ωR. Os números batem com uma esfera de inércia 0,67·mR² em vez de 0,4·mR²: ele conserva 1,5v + ωR. Por isso, no legado, a branca com efeito para trás passa a rolar para trás antes de chegar à bola 1, e a `draw-ref` nem faz contato.
  - Valores pequenos de atrito também quebram o invariante: com 0,001, ele cai de 367 para 334 em 0,1 s; com 0,01, para 116.
  - O único ponto de partida que conserva o invariante é `ballTableFriction: 0`, como o plano previa.
- **O conflito.** O envelope de sensação foi medido nesse legado, onde toda bola rola de imediato.
  - Sem o atrito do cannon, a bola desliza até o acoplamento de rolamento (`rollCoupling`) igualar v e ωR. Ela termina com 5/7 da velocidade, contra cerca de 0,6 no legado.
  - Isso muda o que acontece depois do contato e da tabela. Na `pot-side`, depois do encaçape, a branca bate na tabela lateral e percorre mais 130 cm no legado. No sim, o efeito de rolamento que ela ainda carrega freia o rebote, e ela percorre cerca de 70 cm.
  - Rebote numa tabela lateral (bola sozinha, força 20): 1 s depois do rebote, o legado mantém 71% da velocidade normal de chegada. Sem o atrito do cannon, ficam 43%.

## Tentativas

Os parâmetros não citados ficam com o valor de `TUNING_LEGACY`.

| # | Ajuste | Sensação (11) | Recuo `draw-ref` | 2,5v + ωR em 0,1 s | Fora do envelope |
|---|---|---|---|---|---|
| 0 | `TUNING_LEGACY` | 11 | sem contato | 221 → 20 | — |
| 1 | `ballTableFriction: 0` | 4 | 23,0 cm | 368 → 370 | break, soft, rail-straight, rail-english, long-stun, pot-corner, pot-side |
| 2 | atrito 0,0002 a 0,03 (7 valores) | 6 a 9 | 22,2 cm (0,0002) → sem contato (0,03) | só ≤ 0,0005 fica em ±5% | sempre pot-corner e pot-side |
| 3 | grade com atrito 0: `rollCoupling` {1, 2, 2,8, 4, 6, 10, 20} × `rollingResistance` {3, 10, 20, 30, 45, 60} × `damping` {0,018, 0,1, 0,2, 0,35, 0,5} (210 combinações) | 9 no máximo | recuo ≥ 10 cm só com `rollCoupling` ≤ 2,8 | ok | melhor: `rollCoupling` 10, `damping` 0,1 → follow, pot-side, mas sem recuo (0 cm) |
| 4 | busca aleatória com atrito 0 (300 amostras): `rollCoupling` 0,5–30, `rollingResistance` 0,5–80, `damping` 0,005–0,6, `rollingSpinFriction` 0,02–3, `angularDamping` 0,005–0,5 | 8 no máximo com os 2 critérios de recuo | — | — | melhor: soft, pot-corner, pot-side |
| 5 | busca aleatória mais estreita com atrito 0 (300 amostras), incluindo `sideSpinFriction` 0,1–1,5 | 8 com os 2 critérios de recuo; 9 sem eles | — | — | ver as linhas 6 e 7 |
| 6 | **melhor com recuo:** atrito 0, `rollCoupling` 2,04, `rollingResistance` 3,11, `damping` 0,0408, `rollingSpinFriction` 0,195, `angularDamping` 0,00674, `sideSpinFriction` 0,96 | 8 | 61,1 cm | 368 → 370 | long-stun (cuePath 675 contra 548–633 cm), pot-corner (92 contra 66–89 cm), pot-side (119 contra 163–194 cm) |
| 7 | melhor sensação sem recuo: atrito 0, `rollCoupling` 5,1, `rollingResistance` 2,91, `damping` 0,0497, `rollingSpinFriction` 0,23, `angularDamping` 0,047, `sideSpinFriction` 0,544 | 9 | 0 cm | 368 → 368 | pot-corner, pot-side |
| 8 | inércia efetiva do legado no acoplamento (1,5 no lugar de 2,5), mudança de código temporária | 3 a 4 | sem contato | quebra (é o efeito do legado) | não resolve a pot-side (107–126 contra 163–194 cm) |
| 9 | rolamento casado com o rebote na tabela (`applyCushionSpin`), mudança de código temporária | 4 | 19,3 cm | ok | piora: o rebote quase não muda, e a rail-english cai na caçapa |

As mudanças de código das tentativas 8 e 9 foram revertidas.

Nas tentativas 1 a 9, **pot-side ficou fora em todas as combinações**, e pot-corner em todas menos algumas combinações da linha 3, que não têm recuo. Nenhuma combinação passou nos três critérios ao mesmo tempo.

## Opções levadas ao usuário (D039)

1. **Aceitar a sensação nova depois de um teste de jogo.**
   - Usar a linha 6 (recuo de 61 cm, invariante conservado).
   - Trocar a referência de sensação dessas tacadas, por exemplo excluindo pot-corner, pot-side e long-stun do envelope do legado. Isso exige uma decisão nova, porque muda o critério da D033.
2. **Manter o recuo do legado.**
   - `TUNING` = `TUNING_LEGACY`: a sensação fica 11/11 e o recuo continua quebrado.
   - A F1-09 fica falsa e volta numa fase futura.
3. **Outra correção do modelo**, sem prazo garantido.
   - Por exemplo, trocar o acoplamento exponencial por atrito de deslizamento constante (Coulomb), que separa melhor o tempo de rolamento da tacada sem efeito e o da tacada com recuo.
   - Junto, revisar o rebote na tabela, que é o que tira a pot-side do envelope.

## Decisão (D041)

O usuário escolheu a opção 1 em 2026-10-25.

- `TUNING` (`packages/sim/src/constants.js`) é a tentativa 6. `TUNING_LEGACY` não muda e segue na paridade com o legado.
- O teste de sensação usa o envelope do legado em 8 tacadas. Em long-stun, pot-corner e pot-side, a referência é o próprio sim calibrado, gerado por `npm run feel:sim-reference -w packages/sim`, com as margens da D038 em volta do valor. A medida do legado dessas 3 tacadas continua em `legacy-reference.json`.
- Regenerar `sim-reference.json` ou mudar a lista de tacadas exige decisão nova.
- Falta confirmar o recuo no navegador (segundo critério do F1-09), na F1-B.
