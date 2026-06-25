// Copy a rendered file to the system clipboard. PNG goes on the image clipboard;
// SVG goes on as text (so it can be pasted into a file/editor). Best-effort and
// cross-platform — returns {copied:false, reason} instead of throwing so the
// caller can fall back to saving a file.

import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const isWSL = () => /microsoft/i.test(os.release()) || Boolean(process.env.WSL_DISTRO_NAME);
const isWayland = () => Boolean(process.env.WAYLAND_DISPLAY);

// Run a command; map success/failure to the {copied, reason} shape.
async function run(cmd, args, reason) {
  try {
    await execFileAsync(cmd, args);
    return { copied: true };
  } catch (err) {
    return { copied: false, reason: reason || (err && err.message) || 'clipboard copy failed' };
  }
}

// PowerShell one-liner that loads an image file and puts it on the Windows
// clipboard. Used from WSL (via wslpath) and native Windows.
function winImagePs(file, { wsl }) {
  const pathExpr = wsl ? `(wslpath -w ${JSON.stringify(file)})` : JSON.stringify(file);
  return (
    'Add-Type -AssemblyName System.Windows.Forms,System.Drawing; ' +
    `[System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile(${pathExpr}))`
  );
}

/**
 * @param {string} filePath  absolute path to the rendered file
 * @param {{format?: 'png'|'svg'}} [opts]
 * @returns {Promise<{copied: boolean, reason?: string}>}
 */
export async function copyToClipboard(filePath, { format = 'png' } = {}) {
  const isSvg = format === 'svg';
  const q = JSON.stringify(filePath);

  if (process.platform === 'darwin') {
    if (isSvg) return run('sh', ['-c', `pbcopy < ${q}`], 'pbcopy failed');
    const script = `set the clipboard to (read (POSIX file ${q}) as «class PNGf»)`;
    return run('osascript', ['-e', script], 'osascript failed');
  }

  // WSL talks to the Windows clipboard via clip.exe / PowerShell.
  if (isWSL()) {
    if (isSvg) return run('sh', ['-c', `clip.exe < ${q}`], 'clip.exe failed');
    return run(
      'powershell.exe',
      ['-NoProfile', '-Command', winImagePs(filePath, { wsl: true })],
      'PNG clipboard unavailable on this system'
    );
  }

  if (process.platform === 'win32') {
    if (isSvg) return run('cmd', ['/c', `clip < ${q}`], 'clip failed');
    return run(
      'powershell.exe',
      ['-NoProfile', '-Command', winImagePs(filePath, { wsl: false })],
      'PNG clipboard unavailable on this system'
    );
  }

  if (process.platform === 'linux') {
    if (isWayland()) {
      const type = isSvg ? 'text/plain' : 'image/png';
      return run('sh', ['-c', `wl-copy --type ${type} < ${q}`], 'install wl-clipboard to enable clipboard copy');
    }
    const type = isSvg ? 'text/plain' : 'image/png';
    return run('sh', ['-c', `xclip -selection clipboard -t ${type} -i ${q}`], 'install xclip to enable clipboard copy');
  }

  return { copied: false, reason: `clipboard copy not supported on ${process.platform}` };
}

// Back-compat alias for the old image-only entry point.
export function copyImageToClipboard(pngPath) {
  return copyToClipboard(pngPath, { format: 'png' });
}
