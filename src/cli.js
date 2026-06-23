// Orchestration: parse → execute → redact → render → save → copy → report.

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { parseCurl } from './parse-curl.js';
import { execute } from './execute.js';
import { redactHeaders, redactBody, redactPath } from './redact.js';
import { renderPng } from './render.js';
import { copyImageToClipboard } from './clipboard.js';

// Minimal ANSI helpers for the terminal summary.
const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
};

function timestampParts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
  const human = d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  return { stamp, human };
}

function statusColor(status, ok) {
  if (!ok || status === undefined) return c.red;
  if (status >= 200 && status < 300) return c.green;
  if (status >= 300 && status < 400) return c.cyan;
  if (status >= 400 && status < 500) return c.yellow;
  return c.red;
}

/**
 * @param {Object} options
 * @param {string} options.curl            the curl command string
 * @param {string} [options.out]
 * @param {boolean} [options.copy=true]
 * @param {boolean} [options.redact=true]
 * @param {string[]} [options.extraRedact]
 * @param {string[]} [options.reveal]
 * @param {boolean} [options.open=false]
 * @param {number} [options.width=760]
 * @param {string} [options.chrome]
 * @param {string} [options.verbosity='low']
 * @param {Object} [options.features]   {responseHeaders, requestMeta, responseMeta, command}
 * @param {string} [options.outDir]
 */
export async function run(options) {
  const width = options.width || 760;
  const features = options.features || {};
  const redaction = {
    enabled: options.redact !== false,
    extraKeys: options.extraRedact || [],
    reveal: options.reveal || [],
  };

  const spec = parseCurl(options.curl);
  for (const w of spec.warnings) process.stderr.write(c.yellow(`⚠ ${w}\n`));

  const { stamp, human } = timestampParts();

  // Show the request immediately so the user sees what's being run.
  process.stderr.write(
    `${c.magenta('▸')} ${c.bold(spec.method)} ${spec.url}\n` + c.dim('  sending…\n')
  );

  const response = await execute(spec);

  // Redact for display only.
  const displayHeaders = redactHeaders(spec.headers, redaction);
  const displayBody = prettyJson(redactBody(spec.body, redaction));
  const displayPath = redactPath(spec.path, redaction);
  const displayResponseBody = response.ok ? redactBody(response.body, redaction) : response.body;
  const displayResponseHeaders =
    response.ok && Array.isArray(response.headers)
      ? redactHeaders(response.headers, redaction, { substringMatch: false })
      : [];

  // High-verbosity "Command" section: a reconstructed, redacted curl built from
  // the redacted display values (never the raw input), so secrets stay masked.
  const command = features.command
    ? reconstructCurl(spec, displayHeaders, displayBody)
    : undefined;

  const requestMeta = features.requestMeta
    ? {
        bytes: spec.body !== undefined ? Buffer.byteLength(spec.body) : 0,
        contentType: headerValue(spec.headers, 'content-type'),
      }
    : undefined;

  const model = {
    method: spec.method,
    domain: spec.domain,
    path: displayPath,
    headers: displayHeaders,
    body: displayBody,
    bodyIsJson: isJsonString(displayBody),
    response: { ...response, body: displayResponseBody },
    responseHeaders: displayResponseHeaders,
    command,
    requestMeta,
    features,
    width,
    timestamp: human,
  };

  const png = await renderPng(model, { chromePath: options.chrome });

  const outPath = resolveOutPath(options, stamp);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);

  // Terminal summary.
  const sc = statusColor(response.status, response.ok);
  if (response.ok) {
    process.stderr.write(
      `${sc('●')} ${sc(`${response.status} ${response.statusText || ''}`.trim())} ${c.dim(
        `· ${response.durationMs} ms`
      )}\n`
    );
  } else {
    process.stderr.write(`${c.red('●')} ${c.red('request failed')} ${c.dim(`· ${response.error}`)}\n`);
  }
  process.stderr.write(`${c.green('✔')} saved ${c.bold(outPath)}\n`);

  if (options.copy !== false) {
    const result = await copyImageToClipboard(outPath);
    if (result.copied) process.stderr.write(`${c.green('📋')} copied to clipboard\n`);
    else process.stderr.write(c.dim(`   (clipboard skipped: ${result.reason})\n`));
  }

  if (options.open && process.platform === 'darwin') {
    execFile('open', [outPath], () => {});
  }

  if (redaction.enabled) {
    process.stderr.write(c.dim('   sensitive values masked · use --no-redact to reveal\n'));
  }
  if (options.verbosity && options.verbosity !== 'low') {
    const on = Object.entries(features).filter(([, v]) => v).map(([k]) => k);
    process.stderr.write(
      c.dim(`   verbosity: ${options.verbosity}${on.length ? ` (${on.join(', ')})` : ''}\n`)
    );
  }

  return { outPath, response, spec };
}

// Resolve the output PNG path: explicit --out wins; else a timestamped name in
// outDir (if configured) or the current directory.
function resolveOutPath(options, stamp) {
  if (options.out) return path.resolve(options.out);
  const name = `curl-snap-${stamp}.png`;
  return path.resolve(options.outDir || '.', name);
}

function headerValue(headers, name) {
  const lower = name.toLowerCase();
  const found = headers.find((h) => h.name.toLowerCase() === lower);
  return found ? found.value : undefined;
}

// Rebuild a curl command from the (already redacted) display values for the
// high-verbosity Command section. Multi-line for readability.
function reconstructCurl(spec, headers, body) {
  const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const lines = [`curl${spec.method !== 'GET' ? ` -X ${spec.method}` : ''} ${q(spec.url)}`];
  if (spec.insecure) lines.push('-k');
  for (const h of headers) lines.push(`-H ${q(`${h.name}: ${h.value}`)}`);
  if (body !== undefined && body !== '') {
    const oneLine = isJsonString(body) ? body.replace(/\n\s*/g, '') : body;
    lines.push(`--data ${q(oneLine)}`);
  }
  return lines.join(' \\\n  ');
}

function isJsonString(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return t.startsWith('{') || t.startsWith('[');
}

// Pretty-print a body if it's valid JSON; otherwise return it unchanged.
function prettyJson(s) {
  if (typeof s !== 'string') return s;
  const t = s.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return s;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return s;
  }
}
