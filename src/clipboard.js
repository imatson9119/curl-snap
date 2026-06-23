// Copy a PNG file to the system clipboard. macOS-first (osascript); graceful
// no-op with a note elsewhere.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * @param {string} pngPath absolute path to the PNG
 * @returns {Promise<{copied: boolean, reason?: string}>}
 */
export async function copyImageToClipboard(pngPath) {
  if (process.platform === 'darwin') {
    const script = `set the clipboard to (read (POSIX file ${JSON.stringify(pngPath)}) as «class PNGf»)`;
    try {
      await execFileAsync('osascript', ['-e', script]);
      return { copied: true };
    } catch (err) {
      return { copied: false, reason: (err && err.message) || 'osascript failed' };
    }
  }

  if (process.platform === 'linux') {
    // Best effort if xclip is present.
    try {
      await execFileAsync('sh', [
        '-c',
        `xclip -selection clipboard -t image/png -i ${JSON.stringify(pngPath)}`,
      ]);
      return { copied: true };
    } catch {
      return { copied: false, reason: 'install xclip to enable clipboard copy' };
    }
  }

  return { copied: false, reason: `clipboard copy not supported on ${process.platform}` };
}
