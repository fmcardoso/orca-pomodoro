# Images for the plugin directory

`render.cjs` draws the images that Orca's plugin directory shows on the plugin's page, into
`plugin/assets/` (the manifest's `icon`, `cover` and `screenshots`):

| File | Size | Shows |
| --- | --- | --- |
| `icon.png` | 256 × 256 | The focused tomato, 8 px per art pixel |
| `cover.png` | 1600 × 1000 | The celebrating tomato, the name, and the panel proposing a break |
| `screenshot-focus.png` | 1600 × 1000 | Focus, with the status bar item |
| `screenshot-break.png` | 1600 × 1000 | The break offer after the 4th pomodoro |
| `screenshot-rest.png` | 1600 × 1000 | A break in the dark theme |
| `screenshot-day.png` | 1600 × 1000 | Today's count with − and + in the dark theme |

The panel in them is the real `plugin/src/panel.html`, drawn in Chromium with a stand-in `orca`
and the design's default colors; the big tomato comes from `plugin/src/sprites.ts`. Regenerate them
after changing the panel (from the repository root, after `npm install`):

```sh
npm install --prefix /tmp/pomodoro-preview playwright@1.63.0
NODE_PATH=/tmp/pomodoro-preview/node_modules \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node docs/store/render.cjs
```

The directory's limits: the icon square and at least 128 × 128 (at most 256 KB); the cover at
least 800 × 500 (at most 1024 KB); each screenshot at least 1280 × 800 (at most 1536 KB); at most
6 screenshots and 8 MB of images in all.
