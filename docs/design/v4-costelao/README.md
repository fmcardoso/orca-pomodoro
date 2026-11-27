# Costelão (big rib) expressions

[Open the animated preview](index.html) · [Light sheet](sheet.png) · [Dark sheet](sheet-dark.png)

Each row shows the same ribbed 32 × 32 px tomato. The first is the [original 03 Costelão](../v3-tomato/README.md). In the three columns, compare the focused, sleeping and happy faces. The sprite is 64 × 64 px on the Dueto (duet) card and 256 × 256 px in the enlarged view.

| Face | Expression | Frames |
| --- | --- | --- |
| Reference · Original | Slanted eyebrows from the previous design. | [Original sequence](ref-frames.png) |
| A · Pontinho (little dot) | Button eyes, subtle blush and a short smile. When celebrating, the eyes close into two arcs. | [Sequence A](a-frames.png) |
| B · Brilho (shine) | Tall eyes with a one-pixel highlight and full cheeks. The eyes open wider when celebrating. | [Sequence B](b-frames.png) |
| C · Sossego (calm) | Lowered eyelids and a calm smile. When celebrating, the smile opens and the eyes form wide arcs. | [Sequence C](c-frames.png) |

**My pick is A · Pontinho.** On the card, the two dots leave room to read the smile. The closed eyes and the Z set the pause apart even at the smaller scale.

In the preview, select the face, the expression and the theme. Pausing or resuming the timer also switches the expression. Each sequence has four frames, read from left to right. With reduced motion, the preview shows the first frame.

## Reproduce the images

The HTML opens directly in the browser. The capture uses the same card and freezes the clock and the animation on the first frame. To generate the PNGs from the repository root on a Mac with Chrome installed, run:

```sh
npm install --prefix /tmp/pomodoro-preview playwright@1.63.0
NODE_PATH=/tmp/pomodoro-preview/node_modules \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node docs/design/v4-costelao/capture.cjs
```
