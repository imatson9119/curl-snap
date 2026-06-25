// Mask sensitive values by default. Redaction touches only what we display.

const MASK = '••••••';

// Header names whose values are always masked (case-insensitive, exact match).
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'apikey',
  'x-auth-token',
  'x-amz-security-token',
  'x-csrf-token',
]);

// JSON keys / query param names masked when they contain one of these (substring).
const SENSITIVE_KEY_PATTERNS = [
  'password', 'passwd', 'secret', 'token', 'apikey', 'api_key', 'api-key',
  'access_token', 'refresh_token', 'client_secret', 'authorization', 'auth',
  'ssn', 'card', 'cvv', 'cvc', 'private_key', 'privatekey', 'session', 'credential',
];

/**
 * @typedef {Object} RedactionOptions
 * @property {boolean} enabled            master switch (--no-redact => false)
 * @property {string[]} [extraKeys]       additional key/header names to mask
 * @property {string[]} [reveal]          key/header names to force-show
 */

function buildMatchers(options) {
  const extra = (options.extraKeys || []).map((s) => s.toLowerCase());
  const reveal = new Set((options.reveal || []).map((s) => s.toLowerCase()));
  return { extra, reveal };
}

function keyIsSensitive(name, extra, reveal) {
  const lower = String(name).toLowerCase();
  if (reveal.has(lower)) return false;
  if (extra.includes(lower)) return true;
  if (SENSITIVE_KEY_PATTERNS.some((p) => lower.includes(p))) return true;
  return false;
}

// Value-based detection (conservative, high-precision): catches secrets whose
// key name isn't obviously sensitive — JWTs (three base64url segments) and
// scheme-prefixed bearer/basic tokens.
const JWT_RE = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;
const BEARER_RE = /^(Bearer|Basic|Token)\s+\S{12,}$/i;
function valueLooksSecret(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  return JWT_RE.test(s) || BEARER_RE.test(s);
}

function headerIsSensitive(name, extra, reveal, substringMatch) {
  const lower = String(name).toLowerCase();
  if (reveal.has(lower)) return false;
  if (SENSITIVE_HEADERS.has(lower)) return true;
  if (extra.includes(lower)) return true;
  // Substring matching catches custom headers we *send* (e.g. X-Foo-Secret),
  // but is skipped for response headers to avoid masking benign standard ones
  // like access-control-allow-credentials.
  if (substringMatch && SENSITIVE_KEY_PATTERNS.some((p) => lower.includes(p))) return true;
  return false;
}

/** Mask an auth-style header value, preserving the scheme when present. */
function maskHeaderValue(name, value) {
  const lower = name.toLowerCase();
  if (lower === 'authorization' || lower === 'proxy-authorization') {
    const m = /^(\S+)\s+(.+)$/.exec(value);
    if (m) return `${m[1]} ${MASK}`;
  }
  return MASK;
}

/**
 * Redact a list of {name, value} headers.
 * @returns {{name: string, value: string}[]}
 */
export function redactHeaders(headers, options, { substringMatch = true } = {}) {
  if (!options.enabled) return headers;
  const { extra, reveal } = buildMatchers(options);
  return headers.map((h) => {
    if (headerIsSensitive(h.name, extra, reveal, substringMatch)) {
      return { name: h.name, value: maskHeaderValue(h.name, h.value) };
    }
    // Value-based: mask a token-shaped value under a non-secret-looking header.
    if (!reveal.has(String(h.name).toLowerCase()) && valueLooksSecret(h.value)) {
      return { name: h.name, value: maskHeaderValue(h.name, h.value) };
    }
    return h;
  });
}

/**
 * Redact a list of {name, value} query params by name.
 * @returns {{name: string, value: string}[]}
 */
export function redactParams(params, options) {
  if (!options.enabled) return params;
  const { extra, reveal } = buildMatchers(options);
  return params.map((p) =>
    keyIsSensitive(p.name, extra, reveal) ? { name: p.name, value: MASK } : p
  );
}

/** Recursively mask sensitive keys (and token-shaped values) within JSON. */
function redactJsonValue(value, extra, reveal) {
  if (Array.isArray(value)) {
    return value.map((v) => redactJsonValue(v, extra, reveal));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (keyIsSensitive(k, extra, reveal)) {
        out[k] = MASK;
      } else if (reveal.has(String(k).toLowerCase())) {
        // force-show this key: skip the value scan on its direct string, but
        // still redact nested keys if it's an object/array.
        out[k] = typeof v === 'string' ? v : redactJsonValue(v, extra, reveal);
      } else {
        out[k] = redactJsonValue(v, extra, reveal);
      }
    }
    return out;
  }
  // Leaf string anywhere: mask if it looks like a token/JWT.
  if (typeof value === 'string' && valueLooksSecret(value)) return MASK;
  return value;
}

/**
 * Redact a body string. If it parses as JSON, mask by key; otherwise leave as-is
 * (we don't blindly regex non-JSON bodies to avoid corrupting them).
 * @param {string|undefined} body
 * @param {RedactionOptions} options
 * @returns {string|undefined}
 */
export function redactBody(body, options) {
  if (!options.enabled || body === undefined) return body;
  const { extra, reveal } = buildMatchers(options);
  const trimmed = body.trim();
  if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(redactJsonValue(parsed, extra, reveal), null, 2);
    } catch {
      // fall through
    }
  }
  // application/x-www-form-urlencoded style: a=b&c=d
  if (/^[^=&\s]+=[^=&]*(&[^=&\s]+=[^=&]*)*$/.test(trimmed)) {
    return trimmed
      .split('&')
      .map((pair) => {
        const eq = pair.indexOf('=');
        if (eq === -1) return pair;
        const key = pair.slice(0, eq);
        const decodedKey = decodeURIComponent(key);
        if (keyIsSensitive(decodedKey, extra, reveal)) return `${key}=${MASK}`;
        // Value-based: mask a token-shaped value under a non-secret key.
        const val = pair.slice(eq + 1);
        if (!reveal.has(decodedKey.toLowerCase()) && valueLooksSecret(decodeURIComponent(val))) {
          return `${key}=${MASK}`;
        }
        return pair;
      })
      .join('&');
  }
  return body;
}

/**
 * Redact sensitive query params inside a path+query string for display.
 * @param {string} path
 * @param {RedactionOptions} options
 */
export function redactPath(path, options) {
  if (!options.enabled) return path;
  const { extra, reveal } = buildMatchers(options);
  const qIdx = path.indexOf('?');
  if (qIdx === -1) return path;
  const base = path.slice(0, qIdx);
  const query = path.slice(qIdx + 1);
  const redacted = query
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      if (eq === -1) return pair;
      const key = pair.slice(0, eq);
      return keyIsSensitive(decodeURIComponent(key), extra, reveal)
        ? `${key}=${MASK}`
        : pair;
    })
    .join('&');
  return `${base}?${redacted}`;
}

export { MASK };
