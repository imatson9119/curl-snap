// Upload a rendered file to an anonymous host and return a shareable URL.
// Pluggable host map; 0x0.st is the default (no auth). imgur (needs a client-id)
// is a deferred follow-up.

import fs from 'node:fs';
import path from 'node:path';

// 0x0.st (and similar hosts) require a User-Agent that uniquely identifies the
// program — they reject generic/library defaults (Node's fetch sends "node"),
// empty UAs, and browser-masquerading ones. Send our own so uploads aren't
// refused (commonly surfaced as a 503/403 from their edge).
const VERSION = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).version;
const USER_AGENT = `curl-snap/${VERSION}`;
const TIMEOUT_MS = 30_000;

const HOSTS = {
  '0x0': { url: 'https://0x0.st', field: 'file', parse: (t) => t.trim() },
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
export async function uploadFile(filePath, { host = '0x0' } = {}) {
  const cfg = HOSTS[host];
  if (!cfg) throw new Error(`Unknown upload host: ${host} (try: ${uploadHosts().join(', ')})`);
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
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
    // Hosts like 0x0.st return a human-readable reason in the body (e.g.
    // "User agent not allowed") — surface it instead of just the status line.
    const detail = (await res.text().catch(() => '')).trim();
    throw new Error(
      `${cfg.url} returned ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`
    );
  }
  const url = cfg.parse(await res.text());
  if (!/^https?:\/\//.test(url)) throw new Error(`unexpected response: ${String(url).slice(0, 120)}`);
  return url;
}
