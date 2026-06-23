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

You'll need Node 18+ and a Chrome/Chromium/Edge/Brave install for rendering.
There's no build step — it's plain ES modules.

## Where things live

```
bin/curl-snap.js     CLI entry: parse argv, gather the curl, resolve config
src/parse-curl.js    tokenize + parse a curl command into a RequestSpec
src/execute.js       run the request via fetch, capture status/timing/body
src/redact.js        mask sensitive headers / JSON keys / query params
src/render.js        screenshot the card with puppeteer-core
src/template.js      the Gruvbox card HTML/CSS + JSON colorizer
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
- **Theming:** the colors and layout all live in `template.js`.

## Before you open a PR

- Keep the dependency list short. puppeteer-core is the only runtime dep, and I'd
  rather hand-roll something small than add a package.
- Test the happy path, a sad path (e.g. `httpbin.org/status/404`), and a network
  failure, and eyeball the rendered PNGs.
- Match the surrounding style — small modules, JSDoc on the exported functions,
  comments that explain *why* rather than *what*.
- If you change behavior, update the README and add a line to the changelog.

Eat your own dog food: a curl-snap screenshot of the before/after is a perfectly
good way to show a rendering change in your PR.
