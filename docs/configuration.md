# Configuration

← back to the [README](../README.md)

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
curl-snap --print-config       # show what curl-snap resolved, and from where
curl-snap '<curl>' --no-config # ignore config for one run
```

A config is just the long-form of the flags:

```json
{
  "verbosity": "medium",
  "redact": true,
  "width": 820,
  "theme": "tokyo-night",
  "background": "auto",
  "outDir": "./pr-evidence",
  "extraRedact": ["billing_id", "internal_ref"],
  "features": { "command": true }
}
```

## Merge rules

- `extraRedact` and `reveal` **accumulate** across config + CLI.
- `features` **merges** on top of whatever the verbosity level set, so you can
  flip a single piece of metadata without changing the level.
- `themes` (your custom palettes) merge by name across config files — see
  [Themes › Custom themes](themes.md#custom-themes).
- `out` stays **per-run** (never from config) — use `outDir` for a default folder.
- `--upload` is **CLI-only** and never read from config, to avoid silently
  enabling network egress.
