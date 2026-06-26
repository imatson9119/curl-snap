// Upload a rendered file to an anonymous host and return a shareable URL.
// Pluggable host map (no auth needed for any of them); catbox.moe is the default.
// We bundle a few so the feature survives any single host dying — which is not
// hypothetical: 0x0.st (the previous default) disabled uploads indefinitely.

import fs from 'node:fs';
import path from 'node:path';

// Send a User-Agent that uniquely identifies us. Some hosts reject generic or
// library-default UAs (Node's fetch sends "node"); a real one keeps us in the
// clear and lets a host contact/identify the tool rather than blanket-blocking.
const VERSION = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).version;
const USER_AGENT = `curl-snap/${VERSION}`;
const TIMEOUT_MS = 30_000;

// Each host: the POST url, the file field name, optional extra form `fields`,
// and a `parse` that turns the response body into the public URL. Pick one with
// --upload-host. `persistent: false` flags hosts whose links expire.
export const DEFAULT_HOST = 'catbox';
const HOSTS = {
  catbox: {
    url: 'https://catbox.moe/user/api.php',
    field: 'fileToUpload',
    fields: { reqtype: 'fileupload' },
    parse: (t) => t.trim(),
  },
  litterbox: {
    url: 'https://litterbox.catbox.moe/resources/internals/api.php',
    field: 'fileToUpload',
    fields: { reqtype: 'fileupload', time: '72h' },
    parse: (t) => t.trim(),
    persistent: false, // expires after 72h
  },
  'file.io': {
    url: 'https://file.io',
    field: 'file',
    parse: (t) => {
      try { return (JSON.parse(t).link || '').trim(); } catch { return ''; }
    },
    persistent: false, // expires after first download / 14 days
  },
};

export function uploadHosts() {
  return Object.keys(HOSTS);
}

// fetch() rejects (rather than returning a response) only on network-level
// failures — DNS, connection refused/reset, TLS, an IPv6 blackhole, or our
// timeout. undici collapses them all to the unhelpful "fetch failed"; the real
// reason lives in err.cause. Pull out something actionable.
function describeNetworkError(err, url) {
  if (err && err.name === 'TimeoutError') {
    return `no response from ${url} within ${TIMEOUT_MS / 1000}s — the host may be down or unreachable`;
  }
  const cause = (err && err.cause) || err;
  const code = cause && cause.code;
  const msg = (cause && cause.message) || (err && err.message) || 'network error';
  return `could not reach ${url}: ${msg}${code ? ` (${code})` : ''}`;
}

/**
 * @param {string} filePath  absolute path to the rendered file
 * @param {{host?: string}} [opts]
 * @returns {Promise<string>}  the public URL
 */
export async function uploadFile(filePath, { host = DEFAULT_HOST } = {}) {
  const cfg = HOSTS[host];
  if (!cfg) throw new Error(`Unknown upload host: ${host} (try: ${uploadHosts().join(', ')})`);
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  for (const [k, v] of Object.entries(cfg.fields || {})) fd.append(k, v);
  fd.append(cfg.field, new Blob([buf]), path.basename(filePath));
  let res;
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      body: fd,
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(describeNetworkError(err, cfg.url));
  }
  if (!res.ok) {
    // Hosts often return a human-readable reason in the body (e.g. a rate-limit
    // or "uploads disabled" note) — surface it instead of just the status line.
    const detail = (await res.text().catch(() => '')).trim();
    throw new Error(
      `${cfg.url} returned ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`
    );
  }
  const url = cfg.parse(await res.text());
  if (!/^https?:\/\//.test(url)) throw new Error(`unexpected response: ${String(url).slice(0, 120)}`);
  return url;
}
