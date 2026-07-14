# @steno/plugin-image

Performance-first image optimization plugin for [Steno](https://github.com/stenopress/steno). Automatically resizes, generates high-compression `.webp` variants, and preserves aspect ratios to keep layout shifts (CLS) at zero.

Powered by WASM-compiled [Sharp](https://github.com/lovell/sharp-wasm) for lightning-fast compilation times across any Deno runtime without host-system library headaches.

## Installation

```yaml
# content/.steno/config.yml
plugins:
  - jsr:@steno/plugin-image

```

## Options

```yaml
plugins:
  - package: jsr:@steno/plugin-image
    options:
      widths: [640, 1024, 1920]
      formats: ["webp", "jpeg"]
      quality: 80

```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `widths` | `number[]` | `[640, 1024, 1280]` | Array of target viewport widths for generated responsive images. |
| `formats` | `("webp" | "jpeg" | "png")[]` | `["webp"]` | Target formats to generate. Source file extension is preserved as fallback. |
| `quality` | `number` | `80` | Compression scale from 1 to 100. |

## How it works

The plugin hooks into Steno’s `afterBuild` pipeline:

1. It recursively scans your static `dist/` directory for raw assets (`.png`, `.jpg`, `.jpeg`).
2. Optimized web-safe variations are built at different resolution steps.
3. Your original layouts can safely swap standard `<img>` tags with responsive `<picture>` markup targeting the newly generated webp formats.

## License

MIT