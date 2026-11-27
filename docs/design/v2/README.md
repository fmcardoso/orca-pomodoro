# Three compact versions of the Pomodoro

All three are 340 px wide, like the original panel. The v0.1 panel was 516 px tall, and the reductions below are measured against that.

| Interactive prototype | Design | Height | Reduction |
| --- | --- | ---: | ---: |
| [A · Dueto](dueto.html) | Tomato inside the ring, next to the clock and the button with a label. | 250 px | 52% |
| [B · Ninho](ninho.html) | Tomato in the center between two round buttons, with the clock right below. | 271 px | 47% |
| [C · Régua](regua.html) | Tomato, time and controls on one row, with a progress ruler right below. | 196 px | 62% |

**Recommendation:** Régua. It frees 320 px of height for the rest of the sidebar. The clock stays easy to read, and the tomato, at about 42 px, still shows whether it is focused, sleeping or celebrating.

| Variant | Focus | Paused | Done | Focus in dark mode |
| --- | --- | --- | --- | --- |
| Dueto | [Light](dueto-running-light.png) | [Light](dueto-paused-light.png) | [Light](dueto-finished-light.png) | [Dark](dueto-running-dark.png) |
| Ninho | [Light](ninho-running-light.png) | [Light](ninho-paused-light.png) | [Light](ninho-finished-light.png) | [Dark](ninho-running-dark.png) |
| Régua | [Light](regua-running-light.png) | [Light](regua-paused-light.png) | [Light](regua-finished-light.png) | [Dark](regua-running-dark.png) |

## Try it

Open any of the three HTML files directly in the browser. The prototype simulates the session and the count in memory. Reloading restores the example. To open a specific state, append, for example, `?state=paused&theme=dark` to the address. The available states are `running`, `paused`, `finished` and `idle`. The theme follows the system and accepts `light` or `dark` in the URL.

## Reproduce the screenshots

The script uses Playwright with Chromium, a scale of 1 pixel per CSS pixel and a frozen clock. Each individual screenshot has the height of its content.

From the repository root, using the Chrome installed on macOS:

```sh
npm install --prefix /tmp/pomodoro-preview playwright@1.63.0
NODE_PATH=/tmp/pomodoro-preview/node_modules \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node docs/design/v2/capture.cjs
```
