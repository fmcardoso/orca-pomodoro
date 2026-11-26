# Tomates de pixel para o Dueto

[Abrir o seletor interativo](index.html) · [Comparar no tema claro](sheet.png) · [Comparar no tema escuro](sheet-dark.png)

Abra o HTML diretamente no navegador. Selecione um tomate e alterne entre concentrado, dormindo e feliz. Os botões do Dueto também mudam a expressão do tomate. Com a preferência de movimento reduzido do sistema, cada estado usa uma pose fixa.

Nas pranchas, cada linha é um personagem. As três colunas mostram o cartão em uma barra lateral de 340 px e, ao lado, o mesmo sprite ampliado 4×. A escala do relógio, dos controles e do anel é a mesma da proposta A.

| Tomate | Desenho | Grade e escala no cartão | Quadros |
| --- | --- | --- | --- |
| 01 · Pingo | Cerejinha coral sem contorno, com olhos de dois pixels de altura e bochechas rosadas. | 16 × 16 a 4× | [Ver sequência](1-frames.png) |
| 02 · Roma | Tomate italiano inclinado, com brilho diagonal e um par de botinhas. | 24 × 24 a 3× | [Ver sequência](2-frames.png) |
| 03 · Costelão | Tomate caqui achatado, com gomos sombreados e sobrancelhas concentradas. | 32 × 32 a 2× | [Ver sequência](3-frames.png) |
| 04 · Cartucho | Quatro cores de arcade, contorno ameixa, visor creme e olhos quadrados. | 16 × 16 a 4× | [Ver sequência](4-frames.png) |
| 05 · Duplinha | Dois tomates-cereja, um vermelho e um dourado, que piscam juntos no mesmo ramo. | 24 × 24 a 3× | [Ver sequência](5-frames.png) |
| 06 · Broto | Tomate amarelo com duas folhas grandes, olhos brilhantes e bochechas cor de pêssego. | 24 × 24 a 3× | [Ver sequência](6-frames.png) |

**Minha escolha é o Pingo.** A copa verde e o corpo coral formam uma silhueta fácil de reconhecer. Os olhos retos, fechados e sorridentes também se distinguem no tamanho real da barra lateral.

## Reproduzir as pranchas

O cartão usa o CSS e o controlador do [protótipo Dueto](../v2/dueto.html). Cada sprite é desenhado em SVG com pixels inteiros e animação em passos. As pranchas capturam o primeiro quadro de cada expressão. Cada sequência mostra os quatro quadros, da esquerda para a direita.

Na raiz do repositório, com Chrome instalado no macOS:

```sh
npm install --prefix /tmp/pomodoro-preview playwright@1.63.0
NODE_PATH=/tmp/pomodoro-preview/node_modules \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node docs/design/v3-tomato/capture.cjs
```
