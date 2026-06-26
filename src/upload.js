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

const HOSTS = {
  '0x0': { url: 'https://0x0.st', field: 'file', parse: (t) => t.trim() },
};

export function uploadHosts() {
  return Object.keys(HOSTS);
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
  const res = await fetch(cfg.url, {
    method: 'POST',
    body: fd,
    headers: { 'User-Agent': USER_AGENT },
  });
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
