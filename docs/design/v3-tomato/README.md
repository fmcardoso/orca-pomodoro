# Pixel tomatoes for Dueto

[Open the interactive picker](index.html) · [Compare in the light theme](sheet.png) · [Compare in the dark theme](sheet-dark.png)

Open the HTML directly in the browser. Select a tomato and switch between focused, sleeping and happy. The Dueto (duet) buttons also change the tomato's expression. With the system's reduced-motion preference, each state uses a fixed pose.

On the sheets, each row is a character. The three columns show the card in a 340 px sidebar and, next to it, the same sprite enlarged 4×. The scale of the clock, the controls and the ring is the same as in proposal A.

| Tomato | Design | Grid and scale on the card | Frames |
| --- | --- | --- | --- |
| 01 · Pingo | Outline-free coral cherry tomato with two-pixel-tall eyes and pink cheeks. | 16 × 16 at 4× | [View sequence](1-frames.png) |
| 02 · Roma | Tilted Roma tomato with a diagonal highlight and a pair of little boots. | 24 × 24 at 3× | [View sequence](2-frames.png) |
| 03 · Costelão (big rib) | Flattened persimmon tomato with shaded ribs and focused eyebrows. | 32 × 32 at 2× | [View sequence](3-frames.png) |
| 04 · Cartucho | Four arcade colors, a plum outline, a cream visor and square eyes. | 16 × 16 at 4× | [View sequence](4-frames.png) |
| 05 · Duplinha | Two cherry tomatoes, one red and one golden, blinking together on the same vine. | 24 × 24 at 3× | [View sequence](5-frames.png) |
| 06 · Broto | Yellow tomato with two big leaves, bright eyes and peach-colored cheeks. | 24 × 24 at 3× | [View sequence](6-frames.png) |

**My pick is Pingo.** The green cap and coral body make a silhouette that is easy to recognize. The straight, closed, smiling eyes also stand out at the sidebar's real size.

## Reproduce the sheets

The card uses the CSS and the controller from the [Dueto prototype](../v2/dueto.html). Each sprite is drawn in SVG with whole pixels and stepped animation. The sheets capture the first frame of each expression. Each sequence shows the four frames, from left to right.

From the repository root, with Chrome installed on macOS:

```sh
npm install --prefix /tmp/pomodoro-preview playwright@1.63.0
NODE_PATH=/tmp/pomodoro-preview/node_modules \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node docs/design/v3-tomato/capture.cjs
```
