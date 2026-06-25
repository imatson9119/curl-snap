// Orchestration: parse → execute → redact → render → save → copy → report.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { parseCurl } from './parse-curl.js';
import { execute } from './execute.js';
import { redactHeaders, redactBody, redactPath, redactParams } from './redact.js';
import { renderPng, renderSvg } from './render.js';
import { resolveTheme } from './themes.js';
import { copyToClipboard } from './clipboard.js';

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
 * @param {string|Object} [options.theme]   preset name or inline theme object
 * @param {Object} [options.themes]         user-defined named themes
 * @param {string} [options.background='none']
 * @param {number} [options.padding=28]
 * @param {boolean} [options.window=false]
 * @param {string} [options.title]
 * @param {'png'|'svg'} [options.format='png']
 * @param {string[]} [options.warnings]   validation warnings from resolveOptions
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

  for (const w of options.warnings || []) process.stderr.write(c.yellow(`⚠ ${w}\n`));

  // Output format: honor --format, else infer from the --out extension.
  let format = options.format === 'svg' ? 'svg' : 'png';
  if (options.out) {
    const outExt = path.extname(options.out).toLowerCase();
    if (!options.formatExplicit && outExt === '.svg') format = 'svg';
    else if (options.formatExplicit && outExt && outExt !== `.${format}`) {
      process.stderr.write(
        c.yellow(`⚠ --out ${path.basename(options.out)} doesn't match --format ${format}; writing ${format} bytes anyway.\n`)
      );
    }
  }
  const ext = format === 'svg' ? '.svg' : '.png';

  const { theme, warnings: themeWarnings } = resolveTheme({
    name: options.theme,
    userThemes: options.themes,
  });
  for (const w of themeWarnings) process.stderr.write(c.yellow(`⚠ ${w}\n`));

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
  const displayQuery = redactParams(spec.query || [], redaction);
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
    query: displayQuery,
    headers: displayHeaders,
    body: displayBody,
    bodyIsJson: isJsonString(displayBody),
    response: { ...response, body: displayResponseBody },
    responseHeaders: displayResponseHeaders,
    command,
    requestMeta,
    features,
    width,
    theme,
    background: options.background,
    padding: options.padding,
    window: options.window,
    title: options.title,
    timestamp: human,
  };

  // string for svg, Buffer for png — fs.writeFileSync handles both.
  const output = format === 'svg' ? await renderSvg(model) : await renderPng(model);

  // Decide where the image lands. By default we don't drop a file in the cwd —
  // we just copy to the clipboard. A file is written when the user asks for one
  // (--out / --out-dir), or as a fallback when there's nowhere else for it to go.
  const explicitDest = Boolean(options.out || options.outDir);
  const savePath = options.out
    ? path.resolve(options.out)
    : path.resolve(options.outDir || '.', `curl-snap-${stamp}${ext}`);

  let savedPath = null; // a persistent file we report to the user
  let clipSource; // the file fed to clipboard / --open
  if (explicitDest || options.copy === false) {
    fs.mkdirSync(path.dirname(savePath), { recursive: true });
    fs.writeFileSync(savePath, output);
    savedPath = savePath;
    clipSource = savePath;
  } else {
    // Ephemeral: clipboard (and --open) still need a real file to point at.
    clipSource = path.join(os.tmpdir(), `curl-snap-${stamp}-${process.pid}${ext}`);
    fs.writeFileSync(clipSource, output);
  }

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
  if (savedPath) process.stderr.write(`${c.green('✔')} saved ${c.bold(savedPath)}\n`);

  let copied = false;
  if (options.copy !== false) {
    const result = await copyToClipboard(clipSource, { format });
    copied = result.copied;
    if (copied) {
      const how = format === 'svg' ? 'copied SVG to clipboard' : 'copied to clipboard';
      process.stderr.write(`${c.green('📋')} ${how}\n`);
    } else {
      process.stderr.write(c.dim(`   (clipboard skipped: ${result.reason})\n`));
    }
  }

  // If the image had nowhere to go (no file requested, clipboard failed), save
  // it in the cwd anyway so the work isn't lost.
  if (!savedPath && !copied) {
    savedPath = path.resolve(`curl-snap-${stamp}${ext}`);
    fs.writeFileSync(savedPath, output);
    process.stderr.write(
      `${c.green('✔')} saved ${c.bold(savedPath)} ${c.dim('(clipboard unavailable)')}\n`
    );
  } else if (!savedPath) {
    process.stderr.write(c.dim(`   image not saved — pass --out to keep a file\n`));
  }

  if (options.open) {
    openFile(savedPath || clipSource);
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

  return { outPath: savedPath, response, spec };
}

function headerValue(headers, name) {
  const lower = name.toLowerCase();
  const found = headers.find((h) => h.name.toLowerCase() === lower);
  return found ? found.value : undefined;
}

// Open a file with the platform's default app. Best-effort, fire-and-forget.
function openFile(filePath) {
  if (process.platform === 'darwin') {
    execFile('open', [filePath], () => {});
  } else if (process.platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', filePath], () => {});
  } else if (/microsoft/i.test(os.release()) || process.env.WSL_DISTRO_NAME) {
    execFile('sh', ['-c', `explorer.exe "$(wslpath -w ${JSON.stringify(filePath)})"`], () => {});
  } else {
    execFile('xdg-open', [filePath], () => {});
  }
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
