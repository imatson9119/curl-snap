# Roadmap

Ideas on deck for curl-snap, framed around being a pretty way to **visualize and
share** curl requests/responses (think CodeSnap for API calls). Nothing here is a
commitment — it's a backlog to pull from. Grouped roughly by theme.

## Visual customization

- **Branding** — make the `curl-snap` footer customizable or removable
  (`--brand "myapi"` / `--no-brand`).
- **More light/dark themes** — the palette system makes new presets cheap.

_Shipped: `--background` (color/gradient/auto), `--padding`, `--window` chrome._

## Output & sharing

- **Scale** (`--scale 1|2|3`) — currently hardcoded at 2× (matters for PNG;
  SVG is already resolution-independent). Maybe WebP output too.
- **Upload & get a link** — push to a gist / 0x0 / imgur and print a URL to drop
  into a tweet, Discord, or chat (useful where clipboard can't reach).

_Shipped: SVG output (`--format svg`); clipboard parity (macOS / X11 / Wayland /
Windows-WSL); cross-platform `--open`._

## Content

- **Prettify more than JSON** — syntax highlighting for XML, HTML, GraphQL, and
  form-encoded bodies (currently JSON-or-plain).
- **Big-body handling** — smart truncation (`--max-body-lines`, with a
  `… N more lines` marker) and/or deep-nesting collapse so a huge response stays
  shareable.
- **Smarter redaction** — pattern/entropy detection for JWTs and bearer-shaped
  tokens even when the key name isn't a known secret (matters more when the
  destination is public).
- **Broader curl fidelity** — support more flags so more real-world curls render
  instead of warning: `-F` multipart, `--compressed`, cookies, redirects, client
  certs.

## Niche

- **Multi-request / sequence cards** — stack several calls in one image (e.g.
  `auth → create → fetch`) for tutorials and threads.
