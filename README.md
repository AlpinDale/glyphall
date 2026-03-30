# glyphall

`glyphall` (*glyph-fall*) is a small browser library for animating text
relayout at the glyph level. It uses `@chenglou/pretext` for line breaking and
text flow, then renders and scrambles individual graphemes in the DOM during reflow.

![glyphall demo](assets/glyphall-demo.gif)

It's recommended to not use this with your phone's auto-rotate feature.

## Requirements

A modern mobile browser with `deviceorientation` API support.

## Usage

```sh
bun install
bun run build
```

```ts
import { createGlyphall } from 'glyphall'

createGlyphall(
  {
    viewport,
    pageFrame,
    page,
    sensorToggle,
  },
  {
    text: 'Your text here',
  },
)
```

The library expects you to provide the container elements and your own page styling.

## Demo

The current reader demo lives in [demo](./demo).

Run it locally:

```sh
bun run dev
```

Open `http://127.0.0.1:3000`.

To test from another device on your LAN:

```sh
bun run dev:lan
```

## Sensor access

Some mobile browsers require a secure context before exposing motion/orientation
sensors. The simplest development path is to run the local HTTP server and
expose it through an HTTPS tunnel such as `cloudflared`.

## Optional HTTPS

If you already have a certificate and key, you can run the server in TLS mode:

```sh
USE_TLS=1 CERT_FILE=/path/to/cert.pem KEY_FILE=/path/to/key.pem bun run dev:https
```
