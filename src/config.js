// Config + verbosity resolution.
//
// Precedence (lowest → highest): built-in defaults < verbosity preset <
// config files (global then project) < explicit CLI flags. Each metadata
// feature can also be toggled individually, overriding whatever the verbosity
// preset implied.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Re-export theme helpers so the CLI imports config concerns from one module.
export { listThemes, DEFAULT as DEFAULT_THEME } from './themes.js';

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
    const { features, extraRedact, reveal, themes, ...rest } = config;
    Object.assign(merged, rest);
    if (features) merged.features = { ...(merged.features || {}), ...features };
    // user-defined themes accumulate by name across sources (like features),
    // so a project config can add a theme without clobbering global ones.
    if (themes) merged.themes = { ...(merged.themes || {}), ...themes };
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

  // Validate the appearance/output options: warn + fall back rather than throw,
  // and collect the warnings so cli.js can print them like theme warnings.
  const warnings = [];
  const bg = validateBackground(pick('background', 'none'));
  if (bg.warning) warnings.push(bg.warning);
  const pad = validatePadding(pick('padding', 28));
  if (pad.warning) warnings.push(pad.warning);
  const fmt = validateFormat(pick('format', 'png'));
  if (fmt.warning) warnings.push(fmt.warning);
  const scl = validateScale(pick('scale', 2));
  if (scl.warning) warnings.push(scl.warning);
  const mbl = validatePositiveInt(pick('maxBodyLines', undefined), '--max-body-lines');
  if (mbl.warning) warnings.push(mbl.warning);
  const mbd = validatePositiveInt(pick('maxBodyDepth', undefined), '--max-body-depth');
  if (mbd.warning) warnings.push(mbd.warning);

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
    theme: pick('theme', 'gruvbox'), // preset name OR an inline theme object
    themes: config.themes || undefined, // user-defined named themes
    background: bg.value,
    padding: pad.value,
    window: pick('window', true),
    title: pick('title', undefined),
    format: fmt.value,
    formatExplicit: cliOpts.format !== undefined || config.format !== undefined,
    scale: scl.value,
    brand: pick('brand', 'curl-snap'), // string, or false to hide the footer label
    maxBodyLines: mbl.value,
    maxBodyDepth: mbd.value,
    // upload is CLI-only (never config-driven — avoids silent network egress)
    upload: cliOpts.upload === true,
    uploadHost: cliOpts.uploadHost || 'catbox',
    skipUploadConfirm: cliOpts.skipUploadConfirm === true,
    verbosity,
    features,
    warnings,
  };
}

// --- appearance/output validators (warn + fall back, never throw) -----------

const COLOR_HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_FUNC = /^(rgb|rgba|hsl|hsla)\(/i;
const COLOR_NAMED = /^[a-z]+$/i; // permissive: a CSS named color
const GRADIENT = /^(linear|radial|conic)-gradient\s*\(/i;

function validateBackground(v) {
  if (v == null) return { value: 'none' };
  const s = String(v).trim();
  if (s === '') return { value: 'none' };
  if (s === 'none' || s === 'transparent' || s === 'auto') return { value: s };
  if (GRADIENT.test(s) || COLOR_HEX.test(s) || COLOR_FUNC.test(s) || COLOR_NAMED.test(s)) {
    return { value: s };
  }
  return { value: 'none', warning: `Invalid --background ${JSON.stringify(v)}; using none.` };
}

function validatePadding(v) {
  const n = Number(v);
  if (Number.isInteger(n) && n >= 0 && n <= 400) return { value: n };
  return { value: 28, warning: `Invalid --padding ${JSON.stringify(v)} (expected 0–400); using 28.` };
}

function validateFormat(v) {
  const s = String(v).toLowerCase();
  if (s === 'png' || s === 'svg') return { value: s };
  return { value: 'png', warning: `Unknown --format ${JSON.stringify(v)} (expected png|svg); using png.` };
}

function validateScale(v) {
  const n = Number(v);
  if (n === 1 || n === 2 || n === 3) return { value: n };
  return { value: 2, warning: `Invalid --scale ${JSON.stringify(v)} (expected 1|2|3); using 2.` };
}

// Optional positive-int option (e.g. --max-body-lines/-depth). Unset → undefined.
function validatePositiveInt(v, label) {
  if (v == null) return { value: undefined };
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1) return { value: n };
  return { value: undefined, warning: `Invalid ${label} ${JSON.stringify(v)} (expected a positive integer); ignoring.` };
}

/** A sensible starter config users can edit. */
export function exampleConfig() {
  return {
    verbosity: 'low',
    redact: true,
    copy: true,
    open: false,
    width: 760,
    theme: 'gruvbox',
    themes: {}, // e.g. { mine: { background: '#101010', green: '#00ff88', … } }
    background: 'none', // none | a CSS color | a CSS gradient | auto
    padding: 28,
    window: true,
    title: null, // window-bar title (defaults to the request domain)
    format: 'png', // png | svg
    scale: 2, // PNG zoom: 1 | 2 | 3
    brand: 'curl-snap', // footer label; set false to hide it
    maxBodyLines: null, // cap rendered body lines (null = unlimited)
    maxBodyDepth: null, // collapse JSON deeper than this (null = unlimited)
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

/**
 * Merge `patch` into the global config file (creating it if absent) and write it
 * back, preserving every other key. Used by interactive commands that persist a
 * single setting (e.g. `curl-snap themes`). Returns the path written.
 */
export function updateUserConfig(patch, targetPath) {
  const dest = targetPath || configPaths().global[0];
  const current = fs.existsSync(dest) ? readJson(dest) || {} : {};
  const next = { ...current, ...patch };
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(next, null, 2) + '\n');
  return dest;
}
