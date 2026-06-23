// Execute a RequestSpec using Node's built-in fetch and capture everything we
// need for the evidence card: status, response headers, timing, and body.

/**
 * @typedef {Object} ResponseResult
 * @property {boolean} ok            true if a response came back (even a 4xx/5xx)
 * @property {number} [status]
 * @property {string} [statusText]
 * @property {{name: string, value: string}[]} [headers]
 * @property {string} [body]         pretty-printed if JSON, else raw text
 * @property {boolean} [isJson]
 * @property {number} durationMs
 * @property {string} [error]        populated when the request never completed
 */

const BODY_LIMIT = 20000; // characters; cards stay readable, big payloads truncate

/**
 * @param {import('./parse-curl.js').RequestSpec} spec
 * @returns {Promise<ResponseResult>}
 */
export async function execute(spec) {
  const headers = {};
  for (const h of spec.headers) {
    if (h.name) headers[h.name] = h.value;
  }

  const init = { method: spec.method, headers };
  if (spec.body !== undefined && spec.method !== 'GET' && spec.method !== 'HEAD') {
    init.body = spec.body;
  }

  const prevTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (spec.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const start = performance.now();
  try {
    const res = await fetch(spec.url, init);
    const text = await res.text();
    const durationMs = Math.round(performance.now() - start);

    const contentType = res.headers.get('content-type') || '';
    const bytes = Buffer.byteLength(text);
    const finalUrl = res.url;
    const redirected = res.redirected;
    let body = text;
    let isJson = false;
    if (/\bjson\b/i.test(contentType) || looksLikeJson(text)) {
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
        isJson = true;
      } catch {
        body = text;
      }
    }

    let truncated = false;
    if (body.length > BODY_LIMIT) {
      body = body.slice(0, BODY_LIMIT);
      truncated = true;
    }
    if (truncated) body += '\n… (truncated)';

    const respHeaders = [];
    for (const [name, value] of res.headers.entries()) {
      respHeaders.push({ name, value });
    }

    return {
      ok: true,
      status: res.status,
      statusText: res.statusText,
      headers: respHeaders,
      body,
      isJson,
      durationMs,
      contentType,
      bytes,
      finalUrl,
      redirected,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    return {
      ok: false,
      durationMs,
      error: err && err.cause && err.cause.code
        ? `${err.cause.code}: ${err.message}`
        : (err && err.message) || String(err),
    };
  } finally {
    if (spec.insecure) {
      if (prevTlsReject === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTlsReject;
    }
  }
}

function looksLikeJson(text) {
  const t = text.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}
