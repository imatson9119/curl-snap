# Roadmap

Ideas on deck for curl-snap, framed around being a pretty way to **visualize and
share** curl requests/responses (think CodeSnap for API calls). Nothing here is a
commitment — it's a backlog to pull from. Grouped roughly by theme.

## Visual customization

- **Background** — render the card on a solid color or gradient backdrop
  (`--background`), the way CodeSnap frames code. Currently transparent.
- **Window chrome** — an optional title bar with traffic-light dots and a title
  (the method + URL, or a custom string). `--window`.
- **Padding** — expose the framing margin (`--padding`); it's a fixed 28px today.
- **Branding** — make the `curl-snap` footer customizable or removable
  (`--brand "myapi"` / `--no-brand`).
- **More light/dark themes** — the palette system makes new presets cheap.

## Output & sharing

- **SVG output** (`--format svg`) — nearly free: satori already produces an SVG
  before resvg rasterizes it. Crisp, scalable images for docs/blogs. Maybe WebP.
- **Scale** (`--scale 1|2|3`) — currently hardcoded at 2×.
- **Clipboard parity** — today macOS (`osascript`) + Linux `xclip` only. Add
  Wayland (`wl-copy`) and WSL/Windows (`clip.exe` / `Set-Clipboard`).
- **Upload & get a link** — push to a gist / 0x0 / imgur and print a URL to drop
  into a tweet, Discord, or chat (useful where clipboard can't reach).

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
