#!/usr/bin/env node
// curl-snap CLI entry: parse argv, gather the curl command (arg | stdin | clipboard),
// merge config + verbosity, then hand off to run().

import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { run } from '../src/cli.js';
import { loadConfig, resolveOptions, initConfig, VERBOSITY_LEVELS, listThemes, DEFAULT_THEME } from '../src/config.js';

const execFileAsync = promisify(execFile);

const VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).version;

const HELP = `
curl-snap — turn a curl request into a polished PNG for PR evidence

Usage:
  curl-snap '<curl command>'        capture the given curl
  pbpaste | curl-snap               read the curl from stdin
  curl-snap -c                      read the curl from the clipboard
  curl-snap                         show this tool's description and version

Verbosity (more metadata as you go up):
  -v, --verbosity medium            response headers + response size/type
  -vv, --verbosity high             everything above + request size/type + source command
                                    (default: low — request/response bodies only)

Metadata toggles (override whatever verbosity implies):
      --response-headers / --no-response-headers
      --request-meta     / --no-request-meta      (request body size + content-type)
      --response-meta    / --no-response-meta      (response size, content-type, final URL)
      --command          / --no-command            (reconstructed, redacted source curl)

Options:
  -c, --clipboard      read the curl command from the clipboard
  -o, --out <file>     output path (default ./curl-snap-<timestamp>.<ext>)
      --out-dir <dir>  directory for the timestamped image (when --out is not set)
      --format <fmt>   output format: png (default) | svg
      --copy / --no-copy        copy (or don't) the image to the clipboard
      --no-redact      show sensitive values (default: masked)
      --redact a,b     additional header/JSON keys to mask
      --reveal a,b     header/JSON keys to force-show
      --open / --no-open        open (or don't) the image after creating it
      --width <px>     card width (default 760)
      --padding <px>   space around the card (default 28)
      --background <v> card backdrop: none (default) | a CSS color |
                       a CSS gradient | auto (theme-derived)
      --window / --no-window    macOS-style title bar (default on)
      --title <str>    window-bar title (default: the request domain)
      --theme <name>   color theme (default gruvbox) · see --list-themes
      --list-themes    list the bundled themes and exit

Config:
      --config <path>  use a specific config file (merged on top of the rest)
      --no-config      ignore all config files for this run
      --init-config [path]   write a starter config (default: ~/.config/curl-snap/config.json)
      --print-config   show the merged config and exit
  -h, --help           show this help
  -V, --version        print the version

Config files (merged: global → project → --config, then CLI flags win):
  ~/.config/curl-snap/config.json, ~/.curl-snap.json,
  ./.curl-snap.json, ./curl-snap.config.json
`;

const FEATURE_FLAGS = {
  '--response-headers': ['responseHeaders', true],
  '--no-response-headers': ['responseHeaders', false],
  '--request-meta': ['requestMeta', true],
  '--no-request-meta': ['requestMeta', false],
  '--response-meta': ['responseMeta', true],
  '--no-response-meta': ['responseMeta', false],
  '--command': ['command', true],
  '--no-command': ['command', false],
};

function parseArgs(argv) {
  // Only record keys the user actually set, so config can fill the rest.
  const opts = { _: [], features: {} };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    let inlineValue;
    if (a.startsWith('--') && a.includes('=')) {
      const eq = a.indexOf('=');
      inlineValue = a.slice(eq + 1);
      a = a.slice(0, eq);
    }
    const value = () => (inlineValue !== undefined ? inlineValue : argv[++i]);

    if (FEATURE_FLAGS[a]) {
      const [key, val] = FEATURE_FLAGS[a];
      opts.features[key] = val;
      continue;
    }

    switch (a) {
      case '-h':
      case '--help': opts.help = true; break;
      case '-V':
      case '--version': opts.version = true; break;
      case '-c':
      case '--clipboard': opts.clipboard = true; break;
      case '-o':
      case '--out': opts.out = value(); break;
      case '--out-dir': opts.outDir = value(); break;
      case '--copy': opts.copy = true; break;
      case '--no-copy': opts.copy = false; break;
      case '--no-redact': opts.redact = false; break;
      case '--redact':
        opts.extraRedact = (value() || '').split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '--reveal':
        opts.reveal = (value() || '').split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '--open': opts.open = true; break;
      case '--no-open': opts.open = false; break;
      case '--width': opts.width = parseInt(value(), 10) || 760; break;
      case '--padding': {
        const n = parseInt(value(), 10);
        opts.padding = Number.isNaN(n) ? undefined : n; // let config.js validate/warn
        break;
      }
      case '--background': opts.background = value(); break;
      case '--no-background': opts.background = 'none'; break;
      case '--window': opts.window = true; break;
      case '--no-window': opts.window = false; break;
      case '--title': opts.title = value(); break;
      case '--format': opts.format = value(); break;
      case '--theme': opts.theme = value(); break;
      case '--list-themes': opts.listThemes = true; break;
      case '--verbosity': opts.verbosity = value(); break;
      case '-v': opts.verbosity = 'medium'; break;
      case '-vv': opts.verbosity = 'high'; break;
      case '--config': opts.config = value(); break;
      case '--no-config': opts.noConfig = true; break;
      case '--init-config':
        opts.initConfig = true;
        // optional path arg if the next token isn't a flag
        if (inlineValue !== undefined) opts.initConfigPath = inlineValue;
        else if (argv[i + 1] && !argv[i + 1].startsWith('-')) opts.initConfigPath = argv[++i];
        break;
      case '--print-config': opts.printConfig = true; break;
      default:
        if (a.startsWith('-') && a !== '-') {
          process.stderr.write(`\x1b[33m⚠ Unknown flag ignored: ${a}\x1b[0m\n`);
        } else {
          opts._.push(a);
        }
    }
  }
  return opts;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function readClipboard() {
  if (process.platform === 'darwin') {
    try {
      const { stdout } = await execFileAsync('pbpaste');
      return stdout.trim();
    } catch {
      return '';
    }
  }
  return '';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.version) {
    process.stdout.write(`curl-snap ${VERSION}\n`);
    return;
  }

  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }

  if (opts.listThemes) {
    process.stdout.write('Available themes:\n');
    for (const name of listThemes()) {
      process.stdout.write(`  ${name}${name === DEFAULT_THEME ? '  (default)' : ''}\n`);
    }
    return;
  }

  if (opts.verbosity && !VERBOSITY_LEVELS.includes(opts.verbosity)) {
    process.stderr.write(
      `\x1b[31m✖ Unknown verbosity "${opts.verbosity}" (expected: ${VERBOSITY_LEVELS.join(', ')})\x1b[0m\n`
    );
    process.exitCode = 1;
    return;
  }

  if (opts.initConfig) {
    const dest = initConfig(opts.initConfigPath);
    process.stderr.write(`\x1b[32m✔\x1b[0m wrote starter config to \x1b[1m${dest}\x1b[0m\n`);
    return;
  }

  const config = loadConfig({ explicitPath: opts.config, useConfig: !opts.noConfig });

  if (opts.printConfig) {
    const { __sources, ...rest } = config;
    process.stdout.write(`# config sources: ${(__sources || []).join(', ') || '(none)'}\n`);
    process.stdout.write(JSON.stringify(rest, null, 2) + '\n');
    return;
  }

  let curl = opts._.join(' ').trim();
  if (!curl && !process.stdin.isTTY) curl = await readStdin();
  if (!curl && opts.clipboard) {
    curl = await readClipboard();
    if (curl) process.stderr.write('\x1b[2m(using curl command from clipboard)\x1b[0m\n');
  }

  if (!curl) {
    // Bare invocation (no curl anywhere): show a friendly description + version
    // rather than trying to run nothing.
    process.stdout.write(
      `\x1b[1mcurl-snap\x1b[0m ${VERSION}\n` +
        'Turn a curl request into a polished PNG for PR evidence.\n\n' +
        "Usage: curl-snap '<curl command>'   ·   run with --help for all options\n"
    );
    return;
  }

  if (!/curl\b|https?:\/\//i.test(curl)) {
    process.stderr.write(
      `\x1b[33m⚠ Input doesn't look like a curl command:\x1b[0m ${curl.slice(0, 80)}\n`
    );
  }

  const resolved = resolveOptions({ ...opts, curl }, config);
  await run(resolved);
}

main().catch((err) => {
  process.stderr.write(`\x1b[31m✖ ${err && err.message ? err.message : err}\x1b[0m\n`);
  process.exitCode = 1;
});
