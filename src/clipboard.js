// Copy a rendered file to the system clipboard. PNG goes on the image clipboard;
// SVG goes on as text (so it can be pasted into a file/editor). Best-effort and
// cross-platform — returns {copied:false, reason} instead of throwing so the
// caller can fall back to saving a file.
//
// Security: never build a shell command string from the file path. Paths are
// passed as argv elements (no shell), fed to a tool's stdin, or — for the
// PowerShell cases — embedded as a single-quoted literal that PowerShell does
// not expand. `--out` paths are user-controlled, and a shell-interpolated path
// like `a$(cmd).png` would otherwise run `cmd`.

import fs from 'node:fs';
import os from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const isWSL = () => /microsoft/i.test(os.release()) || Boolean(process.env.WSL_DISTRO_NAME);
const isWayland = () => Boolean(process.env.WAYLAND_DISPLAY);

// Run a command (no shell); map success/failure to the {copied, reason} shape.
async function run(cmd, args, reason) {
  try {
    await execFileAsync(cmd, args);
    return { copied: true };
  } catch (err) {
    return { copied: false, reason: reason || (err && err.message) || 'clipboard copy failed' };
  }
}

// Run a command (no shell) and write `input` to its stdin — the safe stand-in
// for a `cmd < file` shell redirection.
function runWithInput(cmd, args, input, reason) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', (err) => finish({ copied: false, reason: reason || (err && err.message) }));
    child.on('close', (code) =>
      finish(code === 0 ? { copied: true } : { copied: false, reason: reason || `exited ${code}` })
    );
    child.stdin.on('error', () => {}); // swallow EPIPE when the tool isn't installed
    child.stdin.end(input);
  });
}

// Read the file, then feed it to a command's stdin (best-effort on read errors).
function feedFile(cmd, args, filePath, reason) {
  let input;
  try {
    input = fs.readFileSync(filePath);
  } catch (err) {
    return Promise.resolve({ copied: false, reason: reason || (err && err.message) });
  }
  return runWithInput(cmd, args, input, reason);
}

// A PowerShell single-quoted string literal: no interpolation happens inside it,
// and a literal quote is written by doubling it. Injection-safe for paths.
function psLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

// PowerShell one-liner that loads an image file (given a native Windows path)
// and puts it on the Windows clipboard.
function winImagePs(winPath) {
  return (
    'Add-Type -AssemblyName System.Windows.Forms,System.Drawing; ' +
    `[System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile(${psLiteral(winPath)}))`
  );
}

// Convert a WSL path to its Windows form via wslpath (no shell). '' on failure.
async function wslToWindowsPath(filePath) {
  try {
    const { stdout } = await execFileAsync('wslpath', ['-w', filePath]);
    return stdout.trim();
  } catch {
    return '';
  }
}

/**
 * @param {string} filePath  absolute path to the rendered file
 * @param {{format?: 'png'|'svg'}} [opts]
 * @returns {Promise<{copied: boolean, reason?: string}>}
 */
export async function copyToClipboard(filePath, { format = 'png' } = {}) {
  const isSvg = format === 'svg';

  if (process.platform === 'darwin') {
    if (isSvg) return feedFile('pbcopy', [], filePath, 'pbcopy failed');
    // osascript runs with no shell; the path sits inside an AppleScript string
    // literal, which has no command-substitution, so JSON escaping of "/\ is
    // sufficient to keep it inert.
    const script = `set the clipboard to (read (POSIX file ${JSON.stringify(filePath)}) as «class PNGf»)`;
    return run('osascript', ['-e', script], 'osascript failed');
  }

  // WSL talks to the Windows clipboard via clip.exe / PowerShell.
  if (isWSL()) {
    if (isSvg) return feedFile('clip.exe', [], filePath, 'clip.exe failed');
    const winPath = await wslToWindowsPath(filePath);
    if (!winPath) return { copied: false, reason: 'PNG clipboard unavailable on this system' };
    return run(
      'powershell.exe',
      ['-NoProfile', '-Command', winImagePs(winPath)],
      'PNG clipboard unavailable on this system'
    );
  }

  if (process.platform === 'win32') {
    if (isSvg) return feedFile('clip', [], filePath, 'clip failed');
    return run(
      'powershell.exe',
      ['-NoProfile', '-Command', winImagePs(filePath)],
      'PNG clipboard unavailable on this system'
    );
  }

  if (process.platform === 'linux') {
    const type = isSvg ? 'text/plain' : 'image/png';
    if (isWayland()) {
      // wl-copy reads stdin; feed the file rather than redirecting via a shell.
      return feedFile('wl-copy', ['--type', type], filePath, 'install wl-clipboard to enable clipboard copy');
    }
    // xclip takes the file directly with -i, so the path is a plain argv element.
    return run(
      'xclip',
      ['-selection', 'clipboard', '-t', type, '-i', filePath],
      'install xclip to enable clipboard copy'
    );
  }

  return { copied: false, reason: `clipboard copy not supported on ${process.platform}` };
}

// Back-compat alias for the old image-only entry point.
export function copyImageToClipboard(pngPath) {
  return copyToClipboard(pngPath, { format: 'png' });
}
