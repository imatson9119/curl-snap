# Roadmap

Ideas on deck for curl-snap, framed around being a pretty way to **visualize and
share** curl requests/responses (think CodeSnap for API calls). Nothing here is a
commitment — it's a backlog to pull from.

## On deck

- **Multi-request / sequence cards** — stack several calls in one image (e.g.
  `auth → create → fetch`) for tutorials and threads.
- **WebP output** — alongside PNG/SVG (would need a new rasterizer dependency;
  resvg is PNG-only).
- **Upload hosts** — imgur (needs a client-id) and others beyond 0x0.st.
- **Client certs / proxies** — `--cert`/`--key`/`-x` via a custom undici
  dispatcher (currently warns; niche for an evidence tool).
- **JSON deep-collapse refinements** — beyond `--max-body-depth`, e.g. eliding
  long arrays or large string values.
- **Standalone GraphQL** highlighting (JSON-wrapped GraphQL already highlights).

## Shipped

- Themes (14 presets + custom), `--background` (color/gradient/auto),
  `--padding`, `--window` chrome, `--scale`, `--brand`/`--no-brand`.
- SVG output, clipboard parity (macOS / X11 / Wayland / Windows-WSL),
  cross-platform `--open`, `--upload` (0x0.st) with a confirm/preview gate.
- Non-JSON highlighting (XML/HTML/form), `-F` multipart + `-m` timeouts,
  `--max-body-lines` / `--max-body-depth` + long-body tip.
- Value-based redaction (JWT / bearer tokens) on top of the key-based masking.
