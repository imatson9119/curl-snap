// Build the Gruvbox-theme card as a satori element tree. Pure data — no
// framework, no HTML strings. satori consumes vnodes of the shape
// `{ type, props: { style, children } }` with inline styles only (no CSS class
// selectors, no <style> block, no pseudo-elements), so the whole card is
// composed from the `h()` helper below.

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
function colorizeLine(text) {
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
    if (m[1]) push(m[1], GRUVBOX.blue); // key
    else if (m[2]) push(m[2], GRUVBOX.green); // string
    else if (m[3]) push(m[3], GRUVBOX.purple); // number
    else if (m[4]) push(m[4], GRUVBOX.orange); // bool
    else if (m[5]) push(m[5], T.muted); // null
    last = tokenRe.lastIndex;
  }
  push(text.slice(last));
  if (out.length === 0) out.push(h('span', {}, ' ')); // keep blank lines tall
  return out;
}

// Pretty-printed JSON → array of colored code lines.
function colorizeJson(text) {
  return String(text).split('\n').map((line) => codeLine(colorizeLine(line)));
}

// Plain (non-JSON) text → array of code lines. Empty lines keep their height.
function plainCode(text) {
  return String(text).split('\n').map((line) => codeLine(line === '' ? ' ' : line));
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

// Structural theme colors (formerly the :root CSS variables).
const T = {
  bg0: '#282828', // card body
  bg0h: '#1d2021', // code blocks / pill text
  bg1: '#32302f', // header / footer
  line: '#3c3836',
  line2: '#504945',
  fg: '#ebdbb2',
  fgDim: '#a89984',
  muted: '#928374',
  aqua: GRUVBOX.aqua,
};

const FONT = 'Fira Mono';

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

function formatBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// A key/value table (request/response headers, query params).
function kvBlock(items) {
  return h(
    'div',
    { display: 'flex', flexDirection: 'column', gap: 7 },
    items.map((it) =>
      h('div', { display: 'flex', gap: 14, fontSize: 13, lineHeight: 1.5 }, [
        // satori has no min-width; a fixed width matches the old min-width:150
        // visually since keys are short labels.
        h('span', { color: T.aqua, width: 150, flexShrink: 0, wordBreak: 'break-all' }, it.name),
        h('span', { flexGrow: 1, flexShrink: 1, color: T.fg, wordBreak: 'break-all' }, it.value),
      ])
    )
  );
}

// A monospace code block: a column of code lines (from colorizeJson/plainCode).
function codeBlock(lines, extraStyle = {}) {
  return h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      fontSize: 13,
      lineHeight: 1.6,
      color: T.fg,
      backgroundColor: T.bg0h,
      border: `1px solid ${T.line}`,
      borderRadius: 8,
      padding: '14px 16px',
      ...extraStyle,
    },
    lines
  );
}

// A card section: title row (+ optional meta), optional sub-meta line, body.
// `first` drops the top border (satori has no :first-child selector).
function section(title, inner, { meta, subMeta, first } = {}) {
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
            color: T.fgDim,
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
          color: T.muted,
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
      ...(first ? {} : { borderTop: `1px solid ${T.line}` }),
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
 * @returns {Object} satori element tree (root vnode)
 */
export function buildTree(model) {
  const { method, domain, path, headers, body, bodyIsJson, response, width } = model;
  const features = model.features || {};

  const tone = statusTone(response.ok ? response.status : undefined);
  const mColor = methodColor(method);
  const rColor = toneColor(tone);
  const statusLabel = response.ok
    ? `${response.status} ${response.statusText || ''}`.trim()
    : 'NO RESPONSE';

  const sections = [];

  // Command (high verbosity) — reconstructed, redacted curl.
  if (features.command && model.command) {
    sections.push((first) =>
      section('Command', codeBlock(plainCode(model.command), { color: T.fgDim }), { first })
    );
  }

  // Query parameters pulled from the URL.
  if (model.query && model.query.length) {
    sections.push((first) => section('Query Parameters', kvBlock(model.query), { first }));
  }

  // Request headers (only those explicitly set).
  if (headers.length) {
    sections.push((first) => section('Request Headers', kvBlock(headers), { first }));
  }

  // Request body.
  if (body !== undefined && body !== '') {
    let subMeta = '';
    if (features.requestMeta && model.requestMeta) {
      const bits = [formatBytes(model.requestMeta.bytes)];
      if (model.requestMeta.contentType) bits.push(model.requestMeta.contentType);
      subMeta = bits.join(' · ');
    }
    const inner = codeBlock(bodyIsJson ? colorizeJson(body) : plainCode(body));
    sections.push((first) => section('Request', inner, { subMeta, first }));
  }

  // Response body.
  let responseInner;
  if (response.ok) {
    responseInner = response.body
      ? codeBlock(response.isJson ? colorizeJson(response.body) : plainCode(response.body))
      : h('div', { display: 'flex', fontSize: 13, color: T.muted }, '(empty response body)');
  } else {
    responseInner = codeBlock(plainCode(response.error || 'Request failed'), { color: GRUVBOX.red });
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
        color: T.bg0h,
        backgroundColor: rColor,
      },
      statusLabel
    ),
    h('div', { fontSize: 12, color: T.muted }, `${response.durationMs} ms`),
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
    section('Response', responseInner, { meta: responseMeta, subMeta: responseSub, first })
  );

  // Response headers (medium+).
  if (features.responseHeaders && model.responseHeaders && model.responseHeaders.length) {
    sections.push((first) =>
      section('Response Headers', kvBlock(model.responseHeaders), { first })
    );
  }

  const sectionNodes = sections.map((make, i) => make(i === 0));

  const card = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width,
      backgroundColor: T.bg0,
      border: `1px solid ${T.line}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
    },
    [
      // Top strip (method color).
      h('div', { display: 'flex', height: 6, width: '100%', backgroundColor: mColor }, []),
      // Header.
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 22px',
          backgroundColor: T.bg1,
          borderBottom: `1px solid ${T.line}`,
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
                color: T.bg0h,
                backgroundColor: mColor,
              },
              method
            ),
            h(
              'div',
              { display: 'flex', flexShrink: 1, fontSize: 19, fontWeight: 500, color: T.fg, lineHeight: 1.3, wordBreak: 'break-all' },
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
              color: T.muted,
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
          borderTop: `1px solid ${T.line}`,
          fontSize: 11,
          color: T.muted,
          backgroundColor: T.bg1,
        },
        [
          h('div', { display: 'flex', letterSpacing: '0.04em', color: T.fgDim, fontWeight: 700 }, 'curl-snap'),
          h('div', { display: 'flex' }, model.timestamp || ''),
        ]
      ),
      // Bottom strip (status tone color).
      h('div', { display: 'flex', height: 6, width: '100%', backgroundColor: rColor }, []),
    ]
  );

  // Root: 28px transparent padding so the drop shadow has room (replaces the
  // old measure-and-clip step). No background → transparent margin.
  return h(
    'div',
    {
      display: 'flex',
      width: width + 56,
      padding: 28,
      fontFamily: FONT,
      color: T.fg,
    },
    card
  );
}
