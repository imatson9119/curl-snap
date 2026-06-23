// Build the Gruvbox-theme card HTML. Pure string templating — no framework.

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Tiny JSON syntax colorizer: takes pretty-printed JSON text, returns HTML with
// spans. Falls back to escaped plain text for non-JSON bodies.
function colorizeJson(text) {
  const tokenRe =
    /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b)|(\bnull\b)/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = tokenRe.exec(text)) !== null) {
    out += escapeHtml(text.slice(last, m.index));
    if (m[1]) out += `<span class="j-key">${escapeHtml(m[1])}</span>`;
    else if (m[2]) out += `<span class="j-str">${escapeHtml(m[2])}</span>`;
    else if (m[3]) out += `<span class="j-num">${escapeHtml(m[3])}</span>`;
    else if (m[4]) out += `<span class="j-bool">${escapeHtml(m[4])}</span>`;
    else if (m[5]) out += `<span class="j-null">${escapeHtml(m[5])}</span>`;
    last = tokenRe.lastIndex;
  }
  out += escapeHtml(text.slice(last));
  return out;
}

// Gruvbox bright accents.
const GRUVBOX = {
  red: '#fb4934',
  green: '#b8bb26',
  yellow: '#fabd2f',
  blue: '#83a598',
  purple: '#d3869b',
  aqua: '#8ec07c',
  orange: '#fe8019',
  gray: '#928374',
};

// HTTP verb → accent color (drives the method pill and the top strip).
function methodColor(method) {
  switch (String(method).toUpperCase()) {
    case 'GET': return GRUVBOX.green;
    case 'POST': return GRUVBOX.yellow;
    case 'PUT': return GRUVBOX.blue;
    case 'PATCH': return GRUVBOX.aqua;
    case 'DELETE': return GRUVBOX.red;
    case 'HEAD':
    case 'OPTIONS': return GRUVBOX.purple;
    default: return GRUVBOX.orange;
  }
}

function statusTone(status) {
  if (status === undefined) return 'error';
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'warn';
  return 'error';
}

// Status tone → accent color (drives the response label and the bottom strip).
function toneColor(tone) {
  switch (tone) {
    case 'ok': return GRUVBOX.green;
    case 'redirect': return GRUVBOX.blue;
    case 'warn': return GRUVBOX.yellow;
    default: return GRUVBOX.red;
  }
}

/**
 * @param {Object} model
 * @param {string} model.method
 * @param {string} model.domain
 * @param {string} model.path
 * @param {{name:string,value:string}[]} model.headers   (already redacted)
 * @param {string|undefined} model.body                   (already redacted)
 * @param {boolean} model.bodyIsJson
 * @param {Object} model.response   ResponseResult (body already redacted)
 * @param {number} model.width
 * @returns {string} full HTML document
 */
function formatBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function kvBlock(items) {
  return `<div class="kv">${items
    .map(
      (h) =>
        `<div class="kv-row"><span class="kv-key">${escapeHtml(h.name)}</span><span class="kv-val">${escapeHtml(
          h.value
        )}</span></div>`
    )
    .join('')}</div>`;
}

export function buildHtml(model) {
  const { method, domain, path, headers, body, bodyIsJson, response, width } = model;
  const features = model.features || {};

  const tone = statusTone(response.ok ? response.status : undefined);
  const mColor = methodColor(method);
  const rColor = toneColor(tone);
  const statusLabel = response.ok
    ? `${response.status} ${escapeHtml(response.statusText || '')}`.trim()
    : 'NO RESPONSE';

  const sections = [];

  // Command (high verbosity) — reconstructed, redacted curl.
  if (features.command && model.command) {
    sections.push(section('Command', `<pre class="code cmd">${escapeHtml(model.command)}</pre>`));
  }

  // Request headers (only those explicitly set).
  if (headers.length) {
    sections.push(section('Request Headers', kvBlock(headers)));
  }

  // Request body.
  if (body !== undefined && body !== '') {
    let sub = '';
    if (features.requestMeta && model.requestMeta) {
      const bits = [formatBytes(model.requestMeta.bytes)];
      if (model.requestMeta.contentType) bits.push(escapeHtml(model.requestMeta.contentType));
      sub = bits.join(' · ');
    }
    sections.push(
      section('Request', `<pre class="code">${bodyIsJson ? colorizeJson(body) : escapeHtml(body)}</pre>`, '', sub)
    );
  }

  // Response body.
  let responseBodyHtml;
  if (response.ok) {
    responseBodyHtml = response.body
      ? `<pre class="code">${response.isJson ? colorizeJson(response.body) : escapeHtml(response.body)}</pre>`
      : `<div class="empty">(empty response body)</div>`;
  } else {
    responseBodyHtml = `<pre class="code error-text">${escapeHtml(response.error || 'Request failed')}</pre>`;
  }
  const responseMeta = `<span class="resp-status">${escapeHtml(statusLabel)}</span><span class="resp-time">${response.durationMs} ms</span>`;
  let responseSub = '';
  if (features.responseMeta && response.ok) {
    const bits = [];
    if (response.bytes != null) bits.push(formatBytes(response.bytes));
    if (response.contentType) bits.push(escapeHtml(response.contentType));
    if (response.redirected && response.finalUrl) bits.push(`→ ${escapeHtml(response.finalUrl)}`);
    responseSub = bits.join(' · ');
  }
  sections.push(section('Response', responseBodyHtml, responseMeta, responseSub));

  // Response headers (medium+).
  if (features.responseHeaders && model.responseHeaders && model.responseHeaders.length) {
    sections.push(section('Response Headers', kvBlock(model.responseHeaders)));
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  :root {
    --bg0: #282828;        /* card body */
    --bg0h: #1d2021;       /* code blocks / pill text */
    --bg1: #32302f;        /* header */
    --line: #3c3836;
    --line2: #504945;
    --fg: #ebdbb2;
    --fg-dim: #a89984;
    --muted: #928374;
    --aqua: ${GRUVBOX.aqua};
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent; }
  body {
    font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, "Cascadia Code", monospace;
    color: var(--fg);
    padding: 28px;
    width: ${width + 56}px;
  }
  .card {
    width: ${width}px;
    background: var(--bg0);
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    --method-color: ${mColor};
    --resp-color: ${rColor};
  }
  .strip { height: 6px; width: 100%; }
  .strip-top { background: var(--method-color); }
  .strip-bottom { background: var(--resp-color); }
  .header {
    padding: 18px 22px;
    background: var(--bg1);
    border-bottom: 1px solid var(--line);
  }
  .header-top { display: flex; align-items: center; gap: 12px; }
  .method {
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.06em;
    padding: 5px 11px;
    border-radius: 6px;
    color: var(--bg0h);
    background: var(--method-color);
    white-space: nowrap;
  }
  .path {
    font-size: 19px;
    font-weight: 600;
    color: var(--fg);
    word-break: break-all;
    line-height: 1.3;
  }
  .domain {
    margin-top: 7px;
    margin-left: 2px;
    font-size: 12.5px;
    color: var(--muted);
    letter-spacing: 0.02em;
  }
  .domain::before { content: "↗ "; opacity: 0.7; }
  .body { padding: 4px 22px 18px; }
  .section { padding: 16px 0; border-top: 1px solid var(--line); }
  .section:first-child { border-top: none; }
  .section-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 11px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--fg-dim);
  }
  .section-meta { display: flex; align-items: center; gap: 10px; }
  .sub-meta {
    margin-top: -4px; margin-bottom: 10px;
    font-size: 11.5px; color: var(--muted); letter-spacing: 0.02em;
    word-break: break-all;
  }
  .cmd { color: var(--fg-dim); }
  .resp-status {
    font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 5px;
    letter-spacing: 0.03em;
    color: var(--bg0h);
    background: var(--resp-color);
  }
  .resp-time { font-size: 12px; color: var(--muted); }
  .kv { display: flex; flex-direction: column; gap: 7px; }
  .kv-row { display: flex; gap: 14px; font-size: 13px; line-height: 1.5; }
  .kv-key { color: var(--aqua); min-width: 150px; flex-shrink: 0; word-break: break-all; }
  .kv-val { color: var(--fg); word-break: break-all; }
  .code {
    font-size: 13px;
    line-height: 1.6;
    color: var(--fg);
    background: var(--bg0h);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px 16px;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .empty { font-size: 13px; color: var(--muted); font-style: italic; }
  .error-text { color: ${GRUVBOX.red}; }
  .j-key { color: ${GRUVBOX.blue}; }
  .j-str { color: ${GRUVBOX.green}; }
  .j-num { color: ${GRUVBOX.purple}; }
  .j-bool { color: ${GRUVBOX.orange}; }
  .j-null { color: var(--muted); }
  .footer {
    padding: 12px 22px;
    border-top: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between;
    font-size: 11px; color: var(--muted);
    background: var(--bg1);
  }
  .brand { letter-spacing: 0.04em; }
  .brand b { color: var(--fg-dim); font-weight: 700; }
</style></head>
<body>
  <div class="card" id="card">
    <div class="strip strip-top"></div>
    <div class="header">
      <div class="header-top">
        <span class="method">${escapeHtml(method)}</span>
        <span class="path">${escapeHtml(path)}</span>
      </div>
      <div class="domain">${escapeHtml(domain)}</div>
    </div>
    <div class="body">
      ${sections.join('\n      ')}
    </div>
    <div class="footer">
      <span class="brand"><b>curl-snap</b> · API evidence</span>
      <span>${escapeHtml(model.timestamp || '')}</span>
    </div>
    <div class="strip strip-bottom"></div>
  </div>
</body></html>`;
}

function section(title, inner, meta = '', subMeta = '') {
  return `<div class="section">
    <div class="section-head">
      <span class="section-title">${title}</span>
      <span class="section-meta">${meta}</span>
    </div>
    ${subMeta ? `<div class="sub-meta">${subMeta}</div>` : ''}
    ${inner}
  </div>`;
}
