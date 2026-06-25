# Contributing

Thanks for taking a look. curl-snap is small and I'd like to keep it that way, so
the bar for changes is mostly "does this stay simple and dependency-light?"

## Getting set up

```sh
git clone https://github.com/imatson9119/curl-snap.git
cd curl-snap
npm install
node bin/curl-snap.js "curl https://httpbin.org/get"   # smoke test
```

You'll need Node 18+. Rendering is fully in-process (satori + resvg, with fonts
bundled), so there's no browser to install. There's no build step — it's plain
ES modules.

## Where things live

```
bin/curl-snap.js     CLI entry: parse argv, gather the curl, resolve config
src/parse-curl.js    tokenize + parse a curl command into a RequestSpec
src/execute.js       run the request via fetch, capture status/timing/body
src/redact.js        mask sensitive headers / keys / token-shaped values
src/render.js        render the card to PNG with satori + resvg
src/template.js      the card as a satori element tree + JSON/XML/form colorizers
src/themes.js        color theme presets + resolution (the 15-slot palette)
src/clipboard.js     copy the image/SVG to the clipboard (cross-platform)
src/upload.js        upload the image to a host (0x0.st) and return a link
src/confirm.js       the upload preview + confirmation prompt
src/config.js        config file loading + verbosity → feature resolution
src/cli.js           glue: parse → execute → redact → render → save → copy
```

## A couple of common changes

- **Supporting another curl flag:** add it to `parse-curl.js` (most flags are a
  one-line case in the parser). If it's unsupported today it gets collected as a
  warning rather than crashing, so start there.
- **A new piece of metadata on the card:** add it as a feature key in
  `config.js` (wire it into the `low`/`medium`/`high` presets and give it
  `--thing` / `--no-thing` flags in `bin/curl-snap.js`), then render it in
  `template.js`. Existing features like `responseMeta` are a good template.
- **Theming:** colors live in `themes.js` (presets are flat 15-slot palettes);
  the role→slot mapping (GET→green, JSON string→green, …) and layout live in
  `template.js`. To add a preset, add its palette to `PRESETS`.

## Before you open a PR

- Keep the dependency list short. The runtime deps are `satori` (card → SVG) and
  `@resvg/resvg-js` (SVG → PNG); I'd rather hand-roll something small than add a
  package.
- Test the happy path, a sad path (e.g. `httpbin.org/status/404`), and a network
  failure, and eyeball the rendered PNGs.
- Match the surrounding style — small modules, JSDoc on the exported functions,
  comments that explain *why* rather than *what*.
- If you change behavior, update the README and add a line to the changelog.

Eat your own dog food: a curl-snap screenshot of the before/after is a perfectly
good way to show a rendering change in your PR.
