// Config + verbosity resolution.
//
// Precedence (lowest → highest): built-in defaults < verbosity preset <
// config files (global then project) < explicit CLI flags. Each metadata
// feature can also be toggled individually, overriding whatever the verbosity
// preset implied.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const VERBOSITY_LEVELS = ['low', 'medium', 'high'];

// The individual metadata features verbosity bundles together.
export const FEATURE_KEYS = ['responseHeaders', 'requestMeta', 'responseMeta', 'command'];

// What each verbosity level turns on. Higher levels are supersets.
export const VERBOSITY_FEATURES = {
  low: { responseHeaders: false, requestMeta: false, responseMeta: false, command: false },
  medium: { responseHeaders: true, requestMeta: false, responseMeta: true, command: false },
  high: { responseHeaders: true, requestMeta: true, responseMeta: true, command: true },
};

function readJson(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`Could not read config ${file}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in config ${file}: ${err.message}`);
  }
}

export function configPaths() {
  const home = os.homedir();
  return {
    global: [
      path.join(home, '.config', 'curl-snap', 'config.json'),
      path.join(home, '.curl-snap.json'),
    ],
    project: [
      path.join(process.cwd(), '.curl-snap.json'),
      path.join(process.cwd(), 'curl-snap.config.json'),
    ],
  };
}

/**
 * Load and merge config files. Global first, then project (project wins), then
 * an explicit --config path (wins over everything).
 * @returns {Object} merged config (empty object if none / disabled)
 */
export function loadConfig({ explicitPath, useConfig = true } = {}) {
  if (!useConfig) return {};
  const { global, project } = configPaths();
  const sources = [];
  for (const p of [...global, ...project]) {
    const c = readJson(p);
    if (c) sources.push({ file: p, config: c });
  }
  if (explicitPath) {
    const c = readJson(explicitPath);
    if (c === null) throw new Error(`Config file not found: ${explicitPath}`);
    sources.push({ file: explicitPath, config: c });
  }

  const merged = {};
  for (const { config } of sources) {
    const { features, extraRedact, reveal, ...rest } = config;
    Object.assign(merged, rest);
    if (features) merged.features = { ...(merged.features || {}), ...features };
    // arrays accumulate across sources rather than replace
    if (extraRedact) merged.extraRedact = [...(merged.extraRedact || []), ...extraRedact];
    if (reveal) merged.reveal = [...(merged.reveal || []), ...reveal];
  }
  merged.__sources = sources.map((s) => s.file);
  return merged;
}

/**
 * Resolve final options from parsed CLI opts + merged config.
 * cliOpts only contains keys the user actually set (so we can distinguish
 * "unset" from "explicitly false").
 */
export function resolveOptions(cliOpts, config) {
  const verbosity = cliOpts.verbosity || config.verbosity || 'low';
  if (!VERBOSITY_FEATURES[verbosity]) {
    throw new Error(`Unknown verbosity "${verbosity}" (expected: ${VERBOSITY_LEVELS.join(', ')})`);
  }

  // base preset < config.features < explicit CLI feature flags
  const features = {
    ...VERBOSITY_FEATURES[verbosity],
    ...(config.features || {}),
    ...(cliOpts.features || {}),
  };

  const pick = (key, dflt) => {
    if (cliOpts[key] !== undefined) return cliOpts[key];
    if (config[key] !== undefined) return config[key];
    return dflt;
  };

  return {
    curl: cliOpts.curl,
    out: cliOpts.out, // per-run only; not taken from config
    outDir: pick('outDir', undefined),
    copy: pick('copy', true),
    redact: pick('redact', true),
    extraRedact: [...(config.extraRedact || []), ...(cliOpts.extraRedact || [])],
    reveal: [...(config.reveal || []), ...(cliOpts.reveal || [])],
    open: pick('open', false),
    width: pick('width', 760),
    verbosity,
    features,
  };
}

/** A sensible starter config users can edit. */
export function exampleConfig() {
  return {
    verbosity: 'low',
    redact: true,
    copy: true,
    open: false,
    width: 760,
    outDir: null,
    extraRedact: [],
    reveal: [],
    features: {
      responseHeaders: false,
      requestMeta: false,
      responseMeta: false,
      command: false,
    },
  };
}

/** Write a starter config. Returns the path written. Throws if it exists. */
export function initConfig(targetPath) {
  const dest = targetPath || configPaths().global[0];
  if (fs.existsSync(dest)) throw new Error(`Config already exists: ${dest}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(exampleConfig(), null, 2) + '\n');
  return dest;
}
