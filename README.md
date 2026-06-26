# curl-snap

[![npm version](https://img.shields.io/npm/v/curl-snap.svg)](https://www.npmjs.com/package/curl-snap)
[![node](https://img.shields.io/node/v/curl-snap.svg)](https://nodejs.org)
[![license: MIT](https://img.shields.io/npm/l/curl-snap.svg)](LICENSE)

**Run a curl command and turn the request + response into a clean, shareable image.**

curl-snap parses your curl, runs it, and renders a tidy card of the route,
headers, request, and response — themed, redacted, and ready to drop into a PR, a
doc, a blog post, or a tweet. The whole loop is: copy a curl → `curl-snap` →
paste the image.

![A curl-snap card](samples/happy-post.png)

Secrets are masked by default, because pasting a live bearer token somewhere
public is a great way to have a bad afternoon.

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
cd curl-snap && npm install && npm link
```

No browser required — curl-snap renders in-process with bundled fonts, so there's
nothing else to install. Clipboard auto-copy works on macOS, Linux
(`xclip`/`wl-copy`), and Windows/WSL; everywhere else it saves a file instead.

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

# ...or read it from a file (handy for bodies full of quotes — no shell escaping)
curl-snap -f request.curl

# ...or just run curl-snap and paste it when prompted (Ctrl-D to render)
curl-snap
```

By default the image lands **on your clipboard** (ready to paste) plus a quick
status/timing summary in the terminal — no file is written. Pass `--out` (or
`--out-dir`) when you want to keep one on disk. Run `curl-snap --help` for every
flag.

## Features

- **14 color themes** + fully custom palettes — see [Themes](https://github.com/imatson9119/curl-snap/blob/main/docs/themes.md).
- **Backdrops & window chrome** for share-ready images (color/gradient/`auto`
  background, padding, title bar) — see [Usage › Backdrops](https://github.com/imatson9119/curl-snap/blob/main/docs/usage.md#backdrops--window-chrome).
- **PNG or SVG** output, at any scale — see [Usage › Output](https://github.com/imatson9119/curl-snap/blob/main/docs/usage.md#output-format--scale).
- **Secret redaction** on by default (see [below](#redacting-secrets)).
- **Upload & share a link** with a built-in confirmation gate — see
  [Usage › Uploading](https://github.com/imatson9119/curl-snap/blob/main/docs/usage.md#uploading--sharing-a-link).
- **JSON / XML / HTML / form** body highlighting, plus `curl -F` multipart.
- **Big-response controls** (`--max-body-lines`, `--max-body-depth`).
- **Config files + verbosity levels** — see
  [Configuration](https://github.com/imatson9119/curl-snap/blob/main/docs/configuration.md)
  and [Usage › Verbosity](https://github.com/imatson9119/curl-snap/blob/main/docs/usage.md#verbosity).

## Common options

| Flag | What it does |
| --- | --- |
| `-o, --out <file>` | Save the image (otherwise it's clipboard-only) |
| `--format <fmt>` | `png` (default) or `svg` |
| `--theme <name>` | Color theme (default `gruvbox`) · `curl-snap themes` to browse + set one |
| `--background <v>` | Backdrop: `none` (default), a CSS color/gradient, or `auto` |
| `--no-redact` | Show sensitive values (masked by default) |
| `--upload` | Upload the image and print a link (asks first) |
| `-v` / `-vv` | More detail on the card (headers, sizes, source curl) |
| `--width <px>` | Card width (default 760) |
| `--no-window` | Drop the title bar for a flat, full-bleed card |

Run `--help` for every flag, or see the full reference in
[Usage](https://github.com/imatson9119/curl-snap/blob/main/docs/usage.md).

## Redacting secrets

On by default. Anything that looks sensitive gets swapped for `••••••`:

- **Headers** — `Authorization` (keeps the scheme: `Bearer ••••••`), `Cookie`,
  `X-Api-Key`, and any header whose name smells secret.
- **JSON keys**, recursively — `password`, `secret`, `token`, `api_key`,
  `client_secret`, `ssn`, `card`, and friends.
- **Form bodies** and **query params** with sensitive names.
- **Token-shaped values** — JWTs (`xxx.yyy.zzz`) and `Bearer`/`Basic` tokens get
  masked even when the key name isn't obviously secret.

Add your own with `--redact billing_id`, pull something back with `--reveal token`,
or turn it all off with `--no-redact`.

> It's still best-effort — a high-entropy secret that isn't JWT- or bearer-shaped
> and sits under an innocent key can slip through. Glance at the response before
> sharing if your API echoes raw values.

## How it works

Parse the curl into method / URL / headers / body → run it with Node's built-in
`fetch` → redact anything sensitive (for display only) → render the card to SVG
with [`satori`](https://github.com/vercel/satori) and rasterize it with
[`resvg`](https://github.com/yisibl/resvg-js). No browser, no system fonts —
output is deterministic across machines.

## Limitations

- The request goes through `fetch`, not the real `curl` binary, from the parsed
  pieces of your command. Most common flags work (`-X`, `-H`, `-d`/`--data*`,
  `--json`, `-F`/`--form` incl. `@file`, `-u`, `-b`, `-G`, `-k`, `-m`, `-L`,
  `--compressed`, …); anything fancier (client certs, proxies) warns rather than
  crashes.
- One image per request — no combined happy+sad stacking yet.

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). It's a small codebase and
intentionally dependency-light.

## License

[MIT](LICENSE) © Ian Matson
