// `curl-snap themes` — browse the bundled themes with live color swatches and
// set one as the default. Interactive (arrow-key) when attached to a terminal;
// falls back to a plain newline-separated list when piped, so scripts still work.

import readline from 'node:readline';
import { PRESETS, listThemes, DEFAULT } from './themes.js';
import { loadConfig, updateUserConfig } from './config.js';

// Accent slots shown in each row's swatch, in a pleasant left-to-right order.
const ACCENTS = ['red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'orange'];
const NAME_WIDTH = 16;

const A = {
  reset: '\x1b[0m',
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
};

function rgb(hex) {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0, 2), 16)};${parseInt(h.slice(2, 4), 16)};${parseInt(h.slice(4, 6), 16)}`;
}

// A truecolor preview of one theme: its accents as dots on the theme background.
function swatch(theme) {
  let s = `\x1b[48;2;${rgb(theme.background)}m `;
  for (const a of ACCENTS) s += `\x1b[38;2;${rgb(theme[a])}m● `;
  return s + A.reset;
}

function rowLine(name, { selected, current }) {
  const theme = PRESETS[name];
  const marker = selected ? A.cyan('›') : ' ';
  const padded = name.padEnd(NAME_WIDTH);
  const label = selected ? A.bold(padded) : padded;
  const tag = current ? A.dim('  (current default)') : '';
  return `  ${marker} ${label} ${swatch(theme)}${tag}`;
}

// Arrow-key selector. Resolves to the chosen theme name, or null if cancelled.
function pickInteractive(names, current) {
  return new Promise((resolve) => {
    const input = process.stdin;
    let idx = Math.max(0, names.indexOf(current));
    let rendered = 0;

    const header = A.bold('Select a theme') +
      A.dim('  (↑/↓ move · enter set default · q cancel)') + '\n';

    const draw = () => {
      if (rendered) process.stderr.write(`\x1b[${rendered}A`); // back to top of block
      const lines = [header.trimEnd()];
      names.forEach((name, i) =>
        lines.push(rowLine(name, { selected: i === idx, current: name === current }))
      );
      process.stderr.write(lines.map((l) => `\x1b[2K${l}`).join('\n') + '\n');
      rendered = lines.length;
    };

    const wasRaw = Boolean(input.isRaw);
    const cleanup = () => {
      input.off('keypress', onKey);
      if (input.setRawMode) input.setRawMode(wasRaw);
      input.pause();
      process.stderr.write('\x1b[?25h'); // show cursor
    };

    const onKey = (_str, key) => {
      if (!key) return;
      if (key.name === 'up' || key.name === 'k') { idx = (idx - 1 + names.length) % names.length; draw(); }
      else if (key.name === 'down' || key.name === 'j') { idx = (idx + 1) % names.length; draw(); }
      else if (key.name === 'return' || key.name === 'enter') { cleanup(); resolve(names[idx]); }
      else if (key.name === 'q' || key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup();
        resolve(null);
      }
    };

    readline.emitKeypressEvents(input);
    if (input.setRawMode) input.setRawMode(true);
    input.resume();
    process.stderr.write('\x1b[?25l'); // hide cursor
    input.on('keypress', onKey);
    draw();
  });
}

/** Entry point for the `themes` subcommand. */
export async function runThemesCommand() {
  const names = listThemes();
  const config = loadConfig();
  const current =
    typeof config.theme === 'string' && PRESETS[config.theme] ? config.theme : DEFAULT;

  // Non-interactive (piped/redirected): emit a plain list other tools can parse.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    for (const name of names) {
      process.stdout.write(`${name}${name === current ? '  (current)' : ''}\n`);
    }
    return;
  }

  const chosen = await pickInteractive(names, current);
  if (!chosen) {
    process.stderr.write(A.dim('Cancelled — default theme unchanged.') + '\n');
    return;
  }
  if (chosen === current) {
    process.stderr.write(A.dim(`${chosen} is already your default.`) + '\n');
    return;
  }
  const dest = updateUserConfig({ theme: chosen });
  process.stderr.write(
    `${A.green('✔')} default theme set to ${A.bold(chosen)} ${A.dim(`(${dest})`)}\n`
  );
}
