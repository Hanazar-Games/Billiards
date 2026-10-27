# Cópia congelada do legado (D042)

Estes 10 arquivos são uma cópia de [Hanazar-Games/Billiards](https://github.com/Hanazar-Games/Billiards) v1.26.13 (commit `0448b03`, licença MIT, ver `LICENSE` na raiz do repositório). Eles têm os mesmos caminhos relativos de `src/` no jogo original, então as importações relativas entre eles continuam válidas.

## Para que serve

Só os testes de paridade bit a bit do `packages/sim`, a referência de sensação (`tools/legacy-reference.mjs`) e o benchmark de `spikes/sim-bench` carregam estes arquivos. O cliente (`apps/client`) não os usa, e nada neste diretório entra no jogo.

## Regras

- **Nunca edite.** `MANIFEST.json` guarda o SHA-256 de cada arquivo (com CRLF trocado por LF), e `test/legacy-copy.test.js` falha se algum deixar de bater.
- Nenhum teste, ferramenta ou benchmark importa `apps/client/`; todos importam daqui.
- Um comportamento do legado que precise mudar não muda aqui: ele muda em `packages/sim/src` com uma decisão nova (`TUNING_LEGACY` é a ponte, D041).
