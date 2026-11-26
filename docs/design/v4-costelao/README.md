# Expressões do Costelão

[Abrir a prévia animada](index.html) · [Prancha clara](sheet.png) · [Prancha escura](sheet-dark.png)

Cada linha mostra o mesmo tomate frisado de 32 × 32 px. A primeira traz o [03 Costelão original](../v3-tomato/README.md). Nas três colunas, compare o rosto concentrado, dormindo e feliz. O sprite ocupa 64 × 64 px no cartão Dueto e 256 × 256 px na ampliação.

| Rosto | Expressão | Quadros |
| --- | --- | --- |
| Referência · Original | Sobrancelhas inclinadas do desenho anterior. | [Sequência original](ref-frames.png) |
| A · Pontinho | Olhos de botão, blush discreto e sorriso curto. Ao comemorar, fecha os olhos em dois arcos. | [Sequência A](a-frames.png) |
| B · Brilho | Olhos altos com um pixel de luz e bochechas cheias. Os olhos se abrem mais na comemoração. | [Sequência B](b-frames.png) |
| C · Sossego | Pálpebras baixas e sorriso tranquilo. O sorriso se abre e os olhos formam arcos largos na comemoração. | [Sequência C](c-frames.png) |

**Minha escolha é A · Pontinho.** No cartão, os dois pontos deixam espaço para ler o sorriso. Os olhos fechados e o Z distinguem a pausa até na escala menor.

Na prévia, selecione o rosto, a expressão e o tema. Pausar ou retomar o timer também troca a expressão. Cada sequência tem quatro quadros, lidos da esquerda para a direita. Com movimento reduzido, a prévia exibe o primeiro quadro.

## Reproduzir as imagens

O HTML abre direto no navegador. A captura usa o mesmo cartão e congela o relógio e a animação no primeiro quadro. Para gerar os PNGs na raiz do repositório em um Mac com Chrome instalado, execute:

```sh
npm install --prefix /tmp/pomodoro-preview playwright@1.63.0
NODE_PATH=/tmp/pomodoro-preview/node_modules \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node docs/design/v4-costelao/capture.cjs
```
