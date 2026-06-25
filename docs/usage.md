# Usage

← back to the [README](../README.md)

The full flag reference and per-feature guides. For themes see
[themes.md](themes.md); for config files see [configuration.md](configuration.md).

## All options

| Flag | What it does |
| --- | --- |
| `-c, --clipboard` | Read the curl command from the clipboard |
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
| `--upload-host <h>` | Upload host (default `0x0`) |
| `--dangerously-skip-upload-confirm` | Skip the upload confirmation prompt |
| `--width <px>` | Card width (default 760) |
| `--padding <px>` | Space around the card (default 28) |
| `--background <v>` | Backdrop: `none` (default), a CSS color, a CSS gradient, or `auto` |
| `--window` / `--no-window` | macOS-style title bar (default on) |
| `--title <str>` | Window-bar title (default: the request domain) |
| `--brand <str>` / `--no-brand` | Footer label (default: `curl-snap`) |
| `--theme <name>` | Color theme (default `gruvbox`) · see `--list-themes` |
| `--list-themes` | List the bundled themes and exit |
| `-v` / `-vv` / `--verbosity <l>` | Verbosity: low (default) / medium / high |
| `--config <path>` / `--no-config` | Use / ignore config files |
| `--init-config [path]` | Write a starter config |
| `--print-config` | Show the merged config and exit |
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

## Output, format & scale

By default you get a PNG **on the clipboard** plus a status/timing summary in the
terminal — no file is written. Pass `--out` (or `--out-dir`) to keep one on disk.

- `--format svg` (or just `--out card.svg`) produces a crisp, scalable vector you
  can embed in docs. The text is vectorized, so the SVG is self-contained — no
  fonts required to view it. With `--format svg` the clipboard gets the SVG
  markup as text.
- `--scale 1|2|3` sets the PNG zoom factor (default 2). SVG ignores it (vector).

## Backdrops & window chrome

Cards come with a macOS-style title bar by default. For a more share-ready image
— tweets, blog posts, slides — drop the card onto a backdrop too:

```sh
curl-snap '<curl>' --background "linear-gradient(135deg,#1e3a8a,#7c3aed)"
```

![A curl-snap card with a gradient backdrop and window chrome](../samples/showcase-window.png)

- `--background` takes a CSS color (`#0d1117`, `white`), a CSS gradient
  (`linear-gradient(...)`), or `auto` (a subtle backdrop derived from the active
  theme). Default is `none` (transparent).
- `--padding <px>` sets the margin around the card (default 28).
- The title bar is on by default and shows the domain (or `--title`, which moves
  the domain down to the header). `--no-window` makes a flat, full-bleed card —
  no window dots, no padding, edge-to-edge.
- `--brand <str>` / `--no-brand` customizes or hides the footer label.

## Clipboard

Auto-copy works on macOS, Linux (X11 via `xclip`, Wayland via `wl-copy`), and
Windows/WSL. If no clipboard tool is available, curl-snap saves the file instead.

## Body highlighting

JSON gets pretty-printed and colorized, but XML/HTML and form-encoded bodies are
highlighted too (detected from the content-type, or the shape of the body):

![XML response highlighting](../samples/xml-highlight.png)

`curl -F` multipart forms render their fields as well (`name=value` / `name=@file`).

## Big responses

A giant response makes an unwieldy card. curl-snap nudges you when a body is long,
and gives you two opt-in knobs:

- `--max-body-lines <n>` keeps the first `n` lines and appends `… N more lines`.
- `--max-body-depth <n>` collapses JSON nested deeper than `n` to `{ … }` / `[ … ]`.

## Uploading & sharing a link

`--upload` posts the image to a host (default [0x0.st](https://0x0.st)) and prints
a URL — handy for chat/tweets where you can't paste an image directly.

Because the upload is **public** and redaction is best-effort, curl-snap treats it
as a deliberate, eyes-open action:

- It **shows you the card's contents** (the visible fields, plus an inline image
  on terminals that support it) before anything leaves your machine.
- It **asks you to confirm** every time — the answer is never remembered, so an
  accidental upload of a secret can't slip through on a later run.
- In a **non-interactive shell** it refuses unless you pass
  `--dangerously-skip-upload-confirm`.

The host is pluggable via `--upload-host`; 0x0.st is the only one bundled today.
