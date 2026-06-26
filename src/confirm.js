// Interactive confirmation before uploading. Uploads make the card PUBLIC, and
// redaction is best-effort, so we show exactly what's in the image (the visible
// fields, plus an inline image preview where the terminal supports it) and
// require an explicit y/N — read from the controlling terminal so it works even
// when the curl came in via stdin. The confirm is never remembered; only a
// first-time marker makes the first prompt louder.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const MARKER = path.join(os.homedir(), '.config', 'curl-snap', '.upload-ack');
const PREVIEW_BODY_LINES = 40; // cap each body in the text preview

const A = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

const isYes = (s) => /^y(es)?$/i.test(String(s || '').trim());

function capLines(text, max) {
  const lines = String(text).split('\n');
  if (lines.length <= max) return lines;
  return [...lines.slice(0, max), `… ${lines.length - max} more lines`];
}

// A text rendering of the visible card fields (already-redacted display values).
function fieldsText(model) {
  const L = [];
  const indent = (text) => String(text).split('\n').map((ln) => `    ${ln}`);
  L.push(`  ${A.bold(`${model.method} ${model.path}`)}`);
  L.push(A.dim(`  ↗ ${model.domain}`));
  if (model.query && model.query.length) {
    L.push(A.bold('  Query:'));
    for (const q of model.query) L.push(`    ${q.name}: ${q.value}`);
  }
  if (model.headers && model.headers.length) {
    L.push(A.bold('  Request headers:'));
    for (const h of model.headers) L.push(`    ${h.name}: ${h.value}`);
  }
  if (model.body) {
    L.push(A.bold('  Request body:'));
    L.push(...indent(capLines(model.body, PREVIEW_BODY_LINES).join('\n')));
  }
  const r = model.response || {};
  if (r.ok) {
    const t = r.durationMs != null ? ` (${r.durationMs} ms)` : '';
    L.push(A.bold(`  Response: ${`${r.status} ${r.statusText || ''}`.trim()}${t}`));
    if (r.body) {
      L.push(A.bold('  Response body:'));
      L.push(...indent(capLines(r.body, PREVIEW_BODY_LINES).join('\n')));
    }
  } else {
    L.push(A.red(`  Response: failed — ${r.error || ''}`));
  }
  if (model.responseHeaders && model.responseHeaders.length) {
    L.push(A.bold('  Response headers:'));
    for (const h of model.responseHeaders) L.push(`    ${h.name}: ${h.value}`);
  }
  return L.join('\n');
}

// --- inline image preview (best-effort, no deps) ---------------------------

function iterm2Escape(buf) {
  const b64 = buf.toString('base64');
  return `\x1b]1337;File=inline=1;preserveAspectRatio=1;size=${buf.length}:${b64}\x07\n`;
}

function kittyEscape(buf) {
  const b64 = buf.toString('base64');
  const CHUNK = 4096;
  let out = '';
  for (let i = 0; i < b64.length; i += CHUNK) {
    const chunk = b64.slice(i, i + CHUNK);
    const more = i + CHUNK < b64.length ? 1 : 0;
    const ctrl = i === 0 ? `a=T,f=100,m=${more}` : `m=${more}`;
    out += `\x1b_G${ctrl};${chunk}\x1b\\`;
  }
  return out + '\n';
}

// Returns an escape sequence to display the PNG inline, or null if unsupported.
function imageEscape(buf) {
  const tp = (process.env.TERM_PROGRAM || '').toLowerCase();
  if (tp.includes('iterm') || tp.includes('wezterm') || process.env.WEZTERM_PANE) {
    return iterm2Escape(buf);
  }
  if (process.env.KITTY_WINDOW_ID || /kitty/i.test(process.env.TERM || '')) {
    return kittyEscape(buf);
  }
  return null;
}

// --- the prompt ------------------------------------------------------------

// Read one line from the controlling terminal; null if there isn't one.
function askTty(writeFd, prompt) {
  let rfd;
  try {
    rfd = fs.openSync('/dev/tty', 'r');
  } catch {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try { fs.writeSync(writeFd, prompt); } catch {}
    const input = fs.createReadStream(null, { fd: rfd }); // autoClose closes rfd
    const rl = readline.createInterface({ input });
    let done = false;
    // Destroy the input stream too: rl.close() alone leaves the /dev/tty stream
    // open, so its fd keeps the event loop alive and the process hangs on exit
    // (most visible when the user declines and there's no upload left to run).
    const finish = (val) => {
      if (done) return;
      done = true;
      rl.close();
      input.destroy();
      resolve(val);
    };
    rl.once('line', finish);
    rl.once('close', () => finish(''));
    input.once('error', () => finish(''));
  });
}

/**
 * Preview the card, then ask the user to confirm an upload.
 * @returns {Promise<boolean>} true to proceed
 */
export async function confirmUpload({ host, skip, model, filePath, format }) {
  if (skip) return true;

  let wfd;
  try {
    wfd = fs.openSync('/dev/tty', 'w');
  } catch {
    process.stderr.write(
      A.red('✖ Refusing to upload without confirmation in a non-interactive shell.\n') +
        A.dim('   Re-run with --dangerously-skip-upload-confirm to allow.\n')
    );
    return false;
  }
  const write = (s) => { try { fs.writeSync(wfd, s); } catch {} };
  const firstTime = !fs.existsSync(MARKER);

  write('\n');
  if (firstTime) {
    write(A.yellow('━━━ Upload preview ━━━\n'));
    write(
      A.yellow(
        `This uploads the image to ${host} — it becomes PUBLIC; anyone with the link\n` +
          `can view it. Redaction is best-effort, so don't upload real secrets. You'll\n` +
          `be asked to confirm before every upload.\n`
      )
    );
  } else {
    write(A.yellow(`Uploading to ${host} makes a PUBLIC link. Review what's in the image:\n`));
  }
  write('\n' + fieldsText(model) + '\n');

  if (format !== 'svg') {
    try {
      const esc = imageEscape(fs.readFileSync(filePath));
      if (esc) write('\n' + esc);
    } catch { /* image preview is best-effort */ }
  }

  const ans = await askTty(wfd, '\n' + A.bold(`Upload to ${host}?`) + A.dim(' [y/N] '));
  const ok = isYes(ans);
  if (ok && firstTime) {
    try {
      fs.mkdirSync(path.dirname(MARKER), { recursive: true });
      fs.writeFileSync(MARKER, `${new Date().toISOString()}\n`);
    } catch { /* marker is best-effort */ }
  }
  try { fs.closeSync(wfd); } catch {}
  return ok;
}
