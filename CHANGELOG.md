# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-06-25

This release drops the headless-browser dependency entirely — curl-snap now
renders in-process, so there's nothing external to install.

### Added
- Color themes. Pick a palette with `--theme <name>` (`--list-themes` to see
  them): bundled dark — `gruvbox` (default), `dracula`, `nord`, `one-dark`,
  `catppuccin`, `tokyo-night`; light — `github-light`, `solarized-light`,
  `catppuccin-latte`. Define your own in config under `themes` (15 hex slots,
  with an optional `base` to inherit from), or set `theme` to an inline object.
  Gruvbox stays the default and is unchanged.

### Changed
- Rendering no longer requires a browser. The card is now rasterized in-process
  with `satori` (→ SVG) and `@resvg/resvg-js` (→ PNG) instead of screenshotting
  HTML with headless Chrome via `puppeteer-core`. Fira Mono is bundled, so output
  is deterministic and there's nothing external to install.

### Removed
- **Breaking:** the `--chrome` flag and `CURL_SNAP_CHROME` env var — there's no
  browser to point at anymore. (Nothing to migrate: rendering needs no browser.)

## [1.1.0] - 2026-06-23

### Added
- Query parameters are extracted from the URL into their own card section
  (sensitive ones masked), keeping the route line clean.

### Changed
- By default no file is written — the image is copied to the clipboard only.
  Pass `--out`/`--out-dir` to save a PNG to disk.
- Running `curl-snap` with no curl now prints a short description and version
  instead of reading the clipboard. Clipboard input moved behind `-c`/`--clipboard`.
- Removed the "API evidence" subtext from the card footer.

## [1.0.0] - 2026-06-23

Initial release.

### Added
- Parse a curl command (arg, stdin, or clipboard), run it, and render a Gruvbox
  card of the request and response as a PNG.
- Auto-copy the PNG to the clipboard (macOS, and Linux via `xclip`).
- Method-colored top strip and response-status-colored bottom strip.
- Secret redaction on by default (headers, recursive JSON keys, form bodies,
  query params), with `--redact`, `--reveal`, and `--no-redact`.
- Verbosity levels `low` / `medium` / `high` (`-v` / `-vv`) that bundle metadata
  features, each also toggleable on its own (`--response-headers`,
  `--request-meta`, `--response-meta`, `--command`).
- Config files (global + project + `--config`) with `--init-config`,
  `--print-config`, and `--no-config`.

[Unreleased]: https://github.com/imatson9119/curl-snap/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/imatson9119/curl-snap/releases/tag/v2.0.0
[1.1.0]: https://github.com/imatson9119/curl-snap/releases/tag/v1.1.0
[1.0.0]: https://github.com/imatson9119/curl-snap/releases/tag/v1.0.0
