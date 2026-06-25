# curl-snap

[![npm version](https://img.shields.io/npm/v/curl-snap.svg)](https://www.npmjs.com/package/curl-snap)
[![node](https://img.shields.io/node/v/curl-snap.svg)](https://nodejs.org)
[![license: MIT](https://img.shields.io/npm/l/curl-snap.svg)](LICENSE)

Turn a curl request into a clean PNG you can paste into a PR.

Every PR at work wants a screenshot proving the happy and sad paths of any
endpoint I touched. The usual move is to punch the payload into Swagger, run it,
and screenshot the result — except Swagger's UI is busy, off-brand, and clearly
not designed to be screenshotted. So I built a tiny tool that takes a curl
command, runs it, and renders a tidy little card of the request and response
instead. It even copies the image straight to your clipboard, so the whole loop
is: copy curl → `curl-snap` → paste into the PR.

![A curl-snap card](samples/happy-post.png)

It also redacts secrets by default, because pasting a live bearer token into a PR
is a great way to have a bad afternoon.

## Install

**npm** (it's a Node CLI, so this is the path of least resistance):

```sh
npm install -g curl-snap
```

**Homebrew** (macOS/Linux):

```sh
brew tap imatson9119/tap
brew install curl-snap
```

**From source:**

```sh
git clone https://github.com/imatson9119/curl-snap.git
cd curl-snap
npm install
npm link   # puts `curl-snap` on your PATH
```

No browser required — curl-snap renders the card entirely in-process (the fonts
are bundled), so there's nothing else to install. Clipboard auto-copy works on
macOS, Linux (`xclip`/`wl-copy`), and Windows/WSL.

## Quick start

```sh
# Paste a curl as an argument
curl-snap "curl -X POST https://api.example.com/users \
  -H 'Authorization: Bearer abc123' -H 'Content-Type: application/json' \
  -d '{\"name\":\"Ada\"}'"

# ...or pipe it in
pbpaste | curl-snap

# ...or copy a curl from anywhere and read it off the clipboard
curl-snap -c
```

Run `curl-snap` on its own and it just prints its description and version; add
`--help` for the full list of options.

By default you get the image **on your clipboard** (ready to paste) plus a quick
status/timing summary in the terminal — no file is written. Pass `--out` (or
`--out-dir`) when you actually want to keep a PNG on disk.

### Options

| Flag | What it does |
| --- | --- |
| `-o, --out <file>` | Save the image to this path (otherwise it's clipboard-only) |
| `--out-dir <dir>` | Save a timestamped image into this directory |
| `--format <fmt>` | Output format: `png` (default) or `svg` |
| `--scale <1\|2\|3>` | PNG zoom factor (default 2; SVG is vector) |
| `--copy` / `--no-copy` | Copy (or don't) the image to the clipboard |
| `--no-redact` | Show sensitive values (they're masked by default) |
| `--redact a,b` | Extra header/JSON keys to mask |
| `--reveal a,b` | Header/JSON keys to force-show |
| `--max-body-lines <n>` | Cap rendered body lines (adds `… N more lines`) |
| `--max-body-depth <n>` | Collapse JSON nested deeper than `n` to `{ … }` |
| `--open` / `--no-open` | Open (or don't) the image after making it |
| `--upload` | Upload the image and print a link (confirms first) |
| `--brand <str>` / `--no-brand` | Footer label (default: `curl-snap`) |
| `--width <px>` | Card width (default 760) |
| `--padding <px>` | Space around the card (default 28) |
| `--background <v>` | Backdrop: `none` (default), a CSS color, a CSS gradient, or `auto` |
| `--window` / `--no-window` | macOS-style title bar (default on) |
| `--title <str>` | Window-bar title (default: the request domain) |
| `--theme <name>` | Color theme (default `gruvbox`) · see `--list-themes` |
| `--list-themes` | List the bundled themes and exit |
| `-h, --help` | Help |
| `-V, --version` | Version |

## Verbosity

Low is the default — just the bodies, which is all most PRs need. Turn it up when
a reviewer wants receipts.

```sh
curl-snap '<curl>'              # low (default)
curl-snap '<curl>' -v           # medium
curl-snap '<curl>' -vv          # high
curl-snap '<curl>' --verbosity high
```

| Shows up on the card | low | medium | high | Toggle it directly |
| --- | :-: | :-: | :-: | --- |
| Request headers + request/response bodies | ✅ | ✅ | ✅ | (always on) |
| Response headers | | ✅ | ✅ | `--response-headers` / `--no-response-headers` |
| Response size, content-type, final URL | | ✅ | ✅ | `--response-meta` / `--no-response-meta` |
| Request size + content-type | | | ✅ | `--request-meta` / `--no-request-meta` |
| The reconstructed (redacted) source curl | | | ✅ | `--command` / `--no-command` |

The individual flags win over the level, so `-vv --no-command` means "everything,
but spare me the command block."

## Themes

The card ships in **gruvbox** by default, but you can pick another palette with
`--theme`:

```sh
curl-snap '<curl>' --theme dracula
curl-snap --list-themes        # see them all
```

Fourteen themes ship in the box — eleven dark, three light:

| `gruvbox` (default) | `dracula` | `nord` |
| --- | --- | --- |
| ![gruvbox](samples/themes/gruvbox.png) | ![dracula](samples/themes/dracula.png) | ![nord](samples/themes/nord.png) |
| **`one-dark`** | **`catppuccin`** (Mocha) | **`tokyo-night`** |
| ![one-dark](samples/themes/one-dark.png) | ![catppuccin](samples/themes/catppuccin.png) | ![tokyo-night](samples/themes/tokyo-night.png) |
| **`github-dark`** | **`monokai`** | **`rose-pine`** |
| ![github-dark](samples/themes/github-dark.png) | ![monokai](samples/themes/monokai.png) | ![rose-pine](samples/themes/rose-pine.png) |
| **`everforest`** | **`ayu-dark`** | **`github-light`** |
| ![everforest](samples/themes/everforest.png) | ![ayu-dark](samples/themes/ayu-dark.png) | ![github-light](samples/themes/github-light.png) |
| **`solarized-light`** | **`catppuccin-latte`** | |
| ![solarized-light](samples/themes/solarized-light.png) | ![catppuccin-latte](samples/themes/catppuccin-latte.png) | |

### Custom themes

A theme is just a flat set of 15 hex values — 8 structural slots
(`background`, `panel`, `codeBackground`, `border`, `text`, `textDim`,
`textMuted`, `accentText`) and 7 accents (`red`, `green`, `yellow`, `blue`,
`purple`, `cyan`, `orange`). Define your own in a config file under `themes`,
then select it by name. Any slot you omit is inherited from `base` (or the
default), so you can tweak just a color or two:

```json
{
  "theme": "midnight",
  "themes": {
    "midnight": { "base": "tokyo-night", "green": "#00ffa0", "accentText": "#000000" }
  }
}
```

You can also set `theme` directly to an inline object instead of a name. Unknown
theme names or invalid hex values fall back to the default with a warning rather
than failing.

## Backdrops & window chrome

Cards come with a macOS-style title bar by default. For a more share-ready image
— tweets, blog posts, slides — drop the card onto a backdrop too:

```sh
curl-snap '<curl>' --background "linear-gradient(135deg,#1e3a8a,#7c3aed)"
```

![A curl-snap card with a gradient backdrop and window chrome](samples/showcase-window.png)

- `--background` takes a CSS color (`#0d1117`, `white`), a CSS gradient
  (`linear-gradient(...)`), or `auto` (a subtle backdrop derived from the active
  theme). Default is `none` (transparent).
- `--padding <px>` sets the margin around the card (default 28).
- The title bar is on by default and shows the domain (or `--title`, which moves
  the domain down to the header). `--no-window` makes a flat, full-bleed card —
  no window dots, no padding, edge-to-edge.

## SVG output

Pass `--format svg` (or just `--out card.svg`) for a crisp, scalable vector you
can embed in docs. The text is vectorized, so the SVG is self-contained — no
fonts required to view it. With `--format svg` the clipboard gets the SVG markup
as text.

## Clipboard

Auto-copy works on macOS, Linux (X11 via `xclip`, Wayland via `wl-copy`), and
Windows/WSL. If no clipboard tool is available, curl-snap saves the file instead.

## Non-JSON bodies

JSON gets pretty-printed and colorized, but XML/HTML and form-encoded bodies are
highlighted too (detected from the content-type, or the shape of the body):

![XML response highlighting](samples/xml-highlight.png)

`curl -F` multipart forms render their fields as well (`name=value` / `name=@file`).

## Big responses

A giant response makes an unwieldy card. curl-snap nudges you when a body is long,
and gives you two opt-in knobs:

- `--max-body-lines <n>` keeps the first `n` lines and appends `… N more lines`.
- `--max-body-depth <n>` collapses JSON nested deeper than `n` to `{ … }` / `[ … ]`.

## Uploading & sharing a link

`--upload` posts the image to a host (default [0x0.st](https://0x0.st)) and prints
a URL — handy for chat/tweets where you can't paste an image. Because the upload
is **public** and redaction is best-effort, curl-snap **shows you the card's
contents and asks you to confirm** every time (it never remembers your answer).
In a non-interactive shell it refuses unless you pass
`--dangerously-skip-upload-confirm`.

## Redacting secrets

On by default. Anything that looks sensitive gets swapped for `••••••`:

- **Headers** — `Authorization` (keeps the scheme: `Bearer ••••••`), `Cookie`,
  `Set-Cookie`, `X-Api-Key`, and any header whose name smells secret.
- **JSON keys**, recursively — `password`, `secret`, `token`, `api_key`,
  `access_token`, `client_secret`, `ssn`, `card`, `cvv`, and friends.
- **Form bodies** and **query params** with sensitive names.
- **Token-shaped values**, by content — JWTs (`xxx.yyy.zzz`) and `Bearer`/`Basic`
  tokens get masked even when the key name isn't obviously secret.

Add your own with `--redact billing_id,internal_ref`, or pull something back into
the light with `--reveal token`. Want the unmasked version for a private doc?
`--no-redact`.

> It's still best-effort — a high-entropy secret that isn't JWT- or bearer-shaped
> and sits under an innocent key can slip through. Glance at the response before
> sharing if your API echoes raw values.

## Config

If you find yourself typing the same flags every time, don't. Drop a JSON config
somewhere and curl-snap will pick it up. Files are merged global → project →
`--config`, and explicit CLI flags still beat all of them:

1. `~/.config/curl-snap/config.json`
2. `~/.curl-snap.json`
3. `./.curl-snap.json` (project)
4. `./curl-snap.config.json` (project)
5. `--config <path>`

```sh
curl-snap --init-config        # scaffold ~/.config/curl-snap/config.json
curl-snap --print-config       # show what curl-snap actually resolved, and from where
curl-snap '<curl>' --no-config # ignore config for one run
```

A config is just the long-form of the flags:

```json
{
  "verbosity": "medium",
  "redact": true,
  "width": 820,
  "outDir": "./pr-evidence",
  "extraRedact": ["billing_id", "internal_ref"],
  "features": { "command": true }
}
```

`extraRedact` and `reveal` accumulate across config + CLI; `features` merges on top
of whatever the verbosity level set. `out` stays per-run — use `outDir` for a
default folder.

## What's on the card

- The method (color-coded), the path, and the domain in small, unemphasized text.
- A colored strip up top matching the method, and one along the bottom matching
  the response status — so you can tell a 200 from a 500 at a glance.
- Query parameters, pulled out of the URL into their own section so the route
  line stays readable (and sensitive ones get masked).
- Only the headers you actually set. curl's auto-added defaults never show up,
  because the card is built from your command, not from whatever went over the wire.
- Request and response bodies, with JSON pretty-printed and colorized.
- Empty sections (no headers, no body) just disappear.

The theme is [Gruvbox](https://github.com/morhetz/gruvbox), because it's easy on
the eyes and I like it.

## How it works

1. Parse the curl command into method / URL / headers / body.
2. Run it with Node's built-in `fetch` and capture the status, timing, and body.
3. Redact anything sensitive (for display only).
4. Render the card to SVG with `satori` and rasterize it to PNG with `resvg` — no browser required.
5. Copy the PNG to the clipboard (and save it to disk if you passed `--out`).

## Limitations

A few things I left out of v1, mostly on purpose:

- The request goes through `fetch`, not the real `curl` binary, using the parsed
  pieces of your command. Supported flags: `-X`, `-H`, `-d`/`--data*`/
  `--data-urlencode`, `--json`, `-F`/`--form` (incl. `@file`), `-u`, `-b`, `-A`,
  `-e`, `-G`, `-k`, `-m`/`--max-time`, `--compressed`, `-L`, `--url`, and a bare
  URL. Anything fancier (client certs, proxies) gets a warning, not a crash.
- One image per request. No combined happy+sad stacking yet.
- Clipboard image-copy needs a helper present (`xclip`/`wl-copy` on Linux); when
  none is available curl-snap saves the file instead.

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). It's a small codebase and
intentionally dependency-light.

## License

[MIT](LICENSE) © Ian Matson
