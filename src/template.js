// Build the themed card as a satori element tree. Pure data — no framework, no
// HTML strings. satori consumes vnodes of the shape
// `{ type, props: { style, children } }` with inline styles only (no CSS class
// selectors, no <style> block, no pseudo-elements), so the whole card is
// composed from the `h()` helper below.
//
// Colors come from a resolved theme object (see themes.js) passed in via
// model.theme — this file owns the role→slot mapping (GET→green, JSON string→
// green, kv-key→cyan, …); the theme only supplies the 15 hex values.

import { resolveTheme } from './themes.js';

// vnode constructor. `children` may be a string, a vnode, or an array of either.
function h(type, style, children) {
  return { type, props: { style, children } };
}

// One logical line of a code block. satori only honors `\n` inside a single
// string child — once text is split into colored spans (or once wordBreak is
// applied), newlines collapse. So each source line gets its own flex row, and
// wordBreak:'break-all' + flexWrap let long unbroken tokens wrap inside it.
function codeLine(children) {
  return h(
    'div',
    { display: 'flex', flexWrap: 'wrap', whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
    children
  );
}

// Colorize one line of pretty-printed JSON into an array of <span> vnodes.
function colorizeLine(text, theme) {
  const tokenRe =
    /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b)|(\bnull\b)/g;
  const out = [];
  let last = 0;
  let m;
  const push = (s, color) => {
    if (s) out.push(h('span', color ? { color } : {}, s));
  };
  while ((m = tokenRe.exec(text)) !== null) {
    push(text.slice(last, m.index));
    if (m[1]) push(m[1], theme.blue); // key
    else if (m[2]) push(m[2], theme.green); // string
    else if (m[3]) push(m[3], theme.purple); // number
    else if (m[4]) push(m[4], theme.orange); // bool
    else if (m[5]) push(m[5], theme.textMuted); // null
    last = tokenRe.lastIndex;
  }
  push(text.slice(last));
  if (out.length === 0) out.push(h('span', {}, ' ')); // keep blank lines tall
  return out;
}

// Pretty-printed JSON → array of colored code lines.
function colorizeJson(text, theme) {
  return String(text).split('\n').map((line) => codeLine(colorizeLine(line, theme)));
}

// Plain (non-JSON) text → array of code lines. Empty lines keep their height.
function plainCode(text) {
  return String(text).split('\n').map((line) => codeLine(line === '' ? ' ' : line));
}

const FONT = 'Fira Mono';
const DEFAULT_PADDING = 28;

// Transparent margin around the card (where the drop shadow lives). Validated in
// config.js; this is a last-resort guard so the tree never gets NaN/negative.
export function paddingOf(model) {
  const p = Number(model.padding);
  return Number.isFinite(p) && p >= 0 ? p : DEFAULT_PADDING;
}

// The satori canvas width = card width + padding on both sides. Exported so
// render.js computes the exact same width satori is told to lay out.
export function rootWidth(model) {
  return model.width + 2 * paddingOf(model);
}

// Map a --background value (+ theme) to root style props. Returns {} for
// none/unset, which keeps the transparent margin (today's default behavior).
function rootBackgroundStyle(value, theme) {
  if (value == null) return {};
  const v = String(value).trim();
  if (v === '' || v === 'none' || v === 'transparent') return {};
  if (v === 'auto') {
    // A tasteful theme-derived backdrop: subtle diagonal panel → background.
    return { backgroundImage: `linear-gradient(135deg, ${theme.panel} 0%, ${theme.background} 100%)` };
  }
  if (/^(linear|radial|conic)-gradient\s*\(/i.test(v)) return { backgroundImage: v };
  return { backgroundColor: v };
}

// A mac-style traffic-light dot.
function trafficDot(color) {
  return h('div', { display: 'flex', width: 12, height: 12, borderRadius: 6, backgroundColor: color }, []);
}

const TITLE_MAX = 48;
function truncateTitle(s) {
  const t = String(s).trim();
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t;
}

// An optional window title bar (traffic-light dots + centered title). `title` is
// pre-truncated. The card's borderRadius + overflow:hidden round the top corners.
function windowBar(title, theme) {
  return h(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      height: 36,
      paddingLeft: 14,
      paddingRight: 14,
      backgroundColor: theme.panel,
      borderBottom: `1px solid ${theme.border}`,
    },
    [
      h('div', { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }, [
        trafficDot('#ff5f56'), trafficDot('#ffbd2e'), trafficDot('#27c93f'),
      ]),
      h(
        'div',
        {
          display: 'flex',
          flexGrow: 1,
          justifyContent: 'center',
          fontSize: 12.5,
          color: theme.textMuted,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        },
        title
      ),
      // Right spacer matching the dot cluster so the title stays optically centered.
      h('div', { display: 'flex', width: 52, flexShrink: 0 }, []),
    ]
  );
}

// HTTP verb → accent color (drives the method pill and the top strip).
function methodColor(method, theme) {
  switch (String(method).toUpperCase()) {
    case 'GET': return theme.green;
    case 'POST': return theme.yellow;
    case 'PUT': return theme.blue;
    case 'PATCH': return theme.cyan;
    case 'DELETE': return theme.red;
    case 'HEAD':
    case 'OPTIONS': return theme.purple;
    default: return theme.orange;
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
function toneColor(tone, theme) {
  switch (tone) {
    case 'ok': return theme.green;
    case 'redirect': return theme.blue;
    case 'warn': return theme.yellow;
    default: return theme.red;
  }
}

function formatBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// A key/value table (request/response headers, query params).
function kvBlock(items, theme) {
  return h(
    'div',
    { display: 'flex', flexDirection: 'column', gap: 7 },
    items.map((it) =>
      h('div', { display: 'flex', gap: 14, fontSize: 13, lineHeight: 1.5 }, [
        // satori has no min-width; a fixed width matches the old min-width:150
        // visually since keys are short labels.
        h('span', { color: theme.cyan, width: 150, flexShrink: 0, wordBreak: 'break-all' }, it.name),
        h('span', { flexGrow: 1, flexShrink: 1, color: theme.text, wordBreak: 'break-all' }, it.value),
      ])
    )
  );
}

// A monospace code block: a column of code lines (from colorizeJson/plainCode).
function codeBlock(lines, theme, extraStyle = {}) {
  return h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      fontSize: 13,
      lineHeight: 1.6,
      color: theme.text,
      backgroundColor: theme.codeBackground,
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      padding: '14px 16px',
      ...extraStyle,
    },
    lines
  );
}

// A card section: title row (+ optional meta), optional sub-meta line, body.
// `first` drops the top border (satori has no :first-child selector).
function section(title, inner, { meta, subMeta, first } = {}, theme) {
  const children = [
    h(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 11,
      },
      [
        h(
          'div',
          {
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: theme.textDim,
          },
          // text-transform isn't supported; uppercase in JS.
          String(title).toUpperCase()
        ),
        h('div', { display: 'flex', alignItems: 'center', gap: 10 }, meta || []),
      ]
    ),
  ];
  if (subMeta) {
    children.push(
      h(
        'div',
        {
          marginTop: -4,
          marginBottom: 10,
          fontSize: 11.5,
          color: theme.textMuted,
          letterSpacing: '0.02em',
          wordBreak: 'break-all',
        },
        subMeta
      )
    );
  }
  children.push(inner);
  return h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 0',
      ...(first ? {} : { borderTop: `1px solid ${theme.border}` }),
    },
    children
  );
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
 * @param {Object} [model.theme]    resolved theme (see themes.js)
 * @returns {Object} satori element tree (root vnode)
 */
export function buildTree(model) {
  const { method, domain, path, headers, body, bodyIsJson, response, width } = model;
  const features = model.features || {};
  // cli.js always supplies a resolved theme; fall back so direct callers/tests
  // (and any future entry points) still render the default.
  const theme = model.theme || resolveTheme({}).theme;
  const padding = paddingOf(model);
  const bgStyle = rootBackgroundStyle(model.background, theme);
  const windowTitle = model.window
    ? truncateTitle(model.title != null ? model.title : domain)
    : null;

  const tone = statusTone(response.ok ? response.status : undefined);
  const mColor = methodColor(method, theme);
  const rColor = toneColor(tone, theme);
  const statusLabel = response.ok
    ? `${response.status} ${response.statusText || ''}`.trim()
    : 'NO RESPONSE';

  const sections = [];

  // Command (high verbosity) — reconstructed, redacted curl.
  if (features.command && model.command) {
    sections.push((first) =>
      section('Command', codeBlock(plainCode(model.command), theme, { color: theme.textDim }), { first }, theme)
    );
  }

  // Query parameters pulled from the URL.
  if (model.query && model.query.length) {
    sections.push((first) => section('Query Parameters', kvBlock(model.query, theme), { first }, theme));
  }

  // Request headers (only those explicitly set).
  if (headers.length) {
    sections.push((first) => section('Request Headers', kvBlock(headers, theme), { first }, theme));
  }

  // Request body.
  if (body !== undefined && body !== '') {
    let subMeta = '';
    if (features.requestMeta && model.requestMeta) {
      const bits = [formatBytes(model.requestMeta.bytes)];
      if (model.requestMeta.contentType) bits.push(model.requestMeta.contentType);
      subMeta = bits.join(' · ');
    }
    const inner = codeBlock(bodyIsJson ? colorizeJson(body, theme) : plainCode(body), theme);
    sections.push((first) => section('Request', inner, { subMeta, first }, theme));
  }

  // Response body.
  let responseInner;
  if (response.ok) {
    responseInner = response.body
      ? codeBlock(response.isJson ? colorizeJson(response.body, theme) : plainCode(response.body), theme)
      : h('div', { display: 'flex', fontSize: 13, color: theme.textMuted }, '(empty response body)');
  } else {
    responseInner = codeBlock(plainCode(response.error || 'Request failed'), theme, { color: theme.red });
  }
  const responseMeta = [
    h(
      'div',
      {
        fontSize: 12,
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: 5,
        letterSpacing: '0.03em',
        color: theme.accentText,
        backgroundColor: rColor,
      },
      statusLabel
    ),
    h('div', { fontSize: 12, color: theme.textMuted }, `${response.durationMs} ms`),
  ];
  let responseSub = '';
  if (features.responseMeta && response.ok) {
    const bits = [];
    if (response.bytes != null) bits.push(formatBytes(response.bytes));
    if (response.contentType) bits.push(response.contentType);
    if (response.redirected && response.finalUrl) bits.push(`→ ${response.finalUrl}`);
    responseSub = bits.join(' · ');
  }
  sections.push((first) =>
    section('Response', responseInner, { meta: responseMeta, subMeta: responseSub, first }, theme)
  );

  // Response headers (medium+).
  if (features.responseHeaders && model.responseHeaders && model.responseHeaders.length) {
    sections.push((first) =>
      section('Response Headers', kvBlock(model.responseHeaders, theme), { first }, theme)
    );
  }

  const sectionNodes = sections.map((make, i) => make(i === 0));

  const card = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width,
      backgroundColor: theme.background,
      border: `1px solid ${theme.border}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
    },
    [
      // Optional window chrome (above the method strip).
      ...(windowTitle !== null ? [windowBar(windowTitle, theme)] : []),
      // Top strip (method color).
      h('div', { display: 'flex', height: 6, width: '100%', backgroundColor: mColor }, []),
      // Header.
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 22px',
          backgroundColor: theme.panel,
          borderBottom: `1px solid ${theme.border}`,
        },
        [
          h('div', { display: 'flex', alignItems: 'center', gap: 12 }, [
            h(
              'div',
              {
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.06em',
                padding: '5px 11px',
                borderRadius: 6,
                color: theme.accentText,
                backgroundColor: mColor,
              },
              method
            ),
            h(
              'div',
              { display: 'flex', flexShrink: 1, fontSize: 19, fontWeight: 500, color: theme.text, lineHeight: 1.3, wordBreak: 'break-all' },
              path
            ),
          ]),
          h(
            'div',
            {
              display: 'flex',
              marginTop: 7,
              marginLeft: 2,
              fontSize: 12.5,
              color: theme.textMuted,
              letterSpacing: '0.02em',
            },
            // The old ::before { content:"↗ " } becomes a literal span.
            [h('span', { opacity: 0.7 }, '↗ '), h('span', {}, domain)]
          ),
        ]
      ),
      // Body (sections).
      h('div', { display: 'flex', flexDirection: 'column', padding: '4px 22px 18px' }, sectionNodes),
      // Footer.
      h(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 22px',
          borderTop: `1px solid ${theme.border}`,
          fontSize: 11,
          color: theme.textMuted,
          backgroundColor: theme.panel,
        },
        [
          h('div', { display: 'flex', letterSpacing: '0.04em', color: theme.textDim, fontWeight: 700 }, 'curl-snap'),
          h('div', { display: 'flex' }, model.timestamp || ''),
        ]
      ),
      // Bottom strip (status tone color).
      h('div', { display: 'flex', height: 6, width: '100%', backgroundColor: rColor }, []),
    ]
  );

  // Root: transparent padding so the drop shadow has room (replaces the old
  // measure-and-clip step). bgStyle is {} by default → transparent margin; a
  // --background paints the whole canvas (the backdrop behind the card).
  return h(
    'div',
    {
      display: 'flex',
      width: rootWidth(model),
      padding,
      fontFamily: FONT,
      color: theme.text,
      ...bgStyle,
    },
    card
  );
}
