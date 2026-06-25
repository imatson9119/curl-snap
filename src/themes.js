// Color themes. A theme is a flat set of 15 named hex values (terminal-style):
// 8 structural slots + 7 accent slots. The role→slot mapping (GET→green, JSON
// string→green, kv-key→cyan, …) lives in template.js — a theme only supplies the
// hexes. Gruvbox is the default and matches the original hardcoded look exactly.

// The slot names. Themes are validated against this list.
export const SLOTS = [
  // structural
  'background',     // card body
  'panel',          // header / footer
  'codeBackground', // code blocks
  'border',         // all borders / rules
  'text',           // primary text, kv-value
  'textDim',        // section titles, brand, command text
  'textMuted',      // domain, meta, JSON null, empty body
  'accentText',     // text drawn ON bright pills/strips (the "ink")
  // accents
  'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'orange',
];

// --- Dark presets -----------------------------------------------------------

// Exact values from the original hardcoded card (do not change — the default
// path must stay byte-identical). `cyan` was Gruvbox "aqua"; `accentText` was
// the dark color drawn on pills (old bg0h).
const gruvbox = {
  background: '#282828', panel: '#32302f', codeBackground: '#1d2021', border: '#3c3836',
  text: '#ebdbb2', textDim: '#a89984', textMuted: '#928374', accentText: '#1d2021',
  red: '#fb4934', green: '#b8bb26', yellow: '#fabd2f', blue: '#83a598',
  purple: '#d3869b', cyan: '#8ec07c', orange: '#fe8019',
};

const dracula = {
  background: '#282a36', panel: '#343746', codeBackground: '#21222c', border: '#44475a',
  text: '#f8f8f2', textDim: '#b8bcce', textMuted: '#6272a4', accentText: '#21222c',
  red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c', blue: '#bd93f9',
  purple: '#ff79c6', cyan: '#8be9fd', orange: '#ffb86c',
};

const nord = {
  background: '#2e3440', panel: '#3b4252', codeBackground: '#272c36', border: '#434c5e',
  text: '#e5e9f0', textDim: '#d8dee9', textMuted: '#7b88a0', accentText: '#2e3440',
  red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b', blue: '#81a1c1',
  purple: '#b48ead', cyan: '#88c0d0', orange: '#d08770',
};

const oneDark = {
  background: '#282c34', panel: '#2c313a', codeBackground: '#21252b', border: '#3e4451',
  text: '#abb2bf', textDim: '#9da5b4', textMuted: '#5c6370', accentText: '#21252b',
  red: '#e06c75', green: '#98c379', yellow: '#e5c07b', blue: '#61afef',
  purple: '#c678dd', cyan: '#56b6c2', orange: '#d19a66',
};

const catppuccin = { // Mocha
  background: '#1e1e2e', panel: '#181825', codeBackground: '#11111b', border: '#313244',
  text: '#cdd6f4', textDim: '#bac2de', textMuted: '#a6adc8', accentText: '#11111b',
  red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af', blue: '#89b4fa',
  purple: '#cba6f7', cyan: '#94e2d5', orange: '#fab387',
};

const tokyoNight = {
  background: '#1a1b26', panel: '#1f2335', codeBackground: '#16161e', border: '#292e42',
  text: '#c0caf5', textDim: '#a9b1d6', textMuted: '#565f89', accentText: '#16161e',
  red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7',
  purple: '#bb9af7', cyan: '#7dcfff', orange: '#ff9e64',
};

// --- Light presets ----------------------------------------------------------
// On light themes the pills/strips are still saturated accents, so `accentText`
// is near-white ink; panel/code are slightly darker tints of the light bg.

const githubLight = {
  background: '#ffffff', panel: '#f6f8fa', codeBackground: '#eff2f5', border: '#d0d7de',
  text: '#1f2328', textDim: '#57606a', textMuted: '#656d76', accentText: '#ffffff',
  red: '#cf222e', green: '#1a7f37', yellow: '#bf8700', blue: '#0969da',
  purple: '#8250df', cyan: '#1b7c83', orange: '#bc4c00',
};

const solarizedLight = {
  background: '#fdf6e3', panel: '#eee8d5', codeBackground: '#e9e2cd', border: '#d3cbb3',
  text: '#586e75', textDim: '#657b83', textMuted: '#93a1a1', accentText: '#fdf6e3',
  red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2',
  purple: '#6c71c4', cyan: '#2aa198', orange: '#cb4b16',
};

const catppuccinLatte = {
  background: '#eff1f5', panel: '#e6e9ef', codeBackground: '#dce0e8', border: '#ccd0da',
  text: '#4c4f69', textDim: '#5c5f77', textMuted: '#6c6f85', accentText: '#eff1f5',
  red: '#d20f39', green: '#40a02b', yellow: '#df8e1d', blue: '#1e66f5',
  purple: '#8839ef', cyan: '#179299', orange: '#fe640b',
};

const githubDark = {
  background: '#0d1117', panel: '#161b22', codeBackground: '#010409', border: '#30363d',
  text: '#e6edf3', textDim: '#c9d1d9', textMuted: '#8b949e', accentText: '#0d1117',
  red: '#ff7b72', green: '#3fb950', yellow: '#d29922', blue: '#58a6ff',
  purple: '#bc8cff', cyan: '#39c5cf', orange: '#ffa657',
};

const monokai = {
  background: '#272822', panel: '#2d2e27', codeBackground: '#1e1f1c', border: '#3e3d32',
  text: '#f8f8f2', textDim: '#cfcfc2', textMuted: '#75715e', accentText: '#272822',
  red: '#f92672', green: '#a6e22e', yellow: '#e6db74', blue: '#66d9ef',
  purple: '#ae81ff', cyan: '#a1efe4', orange: '#fd971f',
};

const rosePine = {
  background: '#191724', panel: '#1f1d2e', codeBackground: '#16141f', border: '#26233a',
  text: '#e0def4', textDim: '#908caa', textMuted: '#6e6a86', accentText: '#191724',
  red: '#eb6f92', green: '#31748f', yellow: '#f6c177', blue: '#9ccfd8',
  purple: '#c4a7e7', cyan: '#ebbcba', orange: '#ea9a97',
};

const everforest = { // Dark, Medium
  background: '#2d353b', panel: '#343f44', codeBackground: '#272e33', border: '#4f585e',
  text: '#d3c6aa', textDim: '#9da9a0', textMuted: '#859289', accentText: '#2d353b',
  red: '#e67e80', green: '#a7c080', yellow: '#dbbc7f', blue: '#7fbbb3',
  purple: '#d699b6', cyan: '#83c092', orange: '#e69875',
};

const ayuDark = {
  background: '#0b0e14', panel: '#0f131a', codeBackground: '#00010a', border: '#1c212b',
  text: '#bfbdb6', textDim: '#acb6bf', textMuted: '#565b66', accentText: '#0b0e14',
  red: '#f07178', green: '#aad94c', yellow: '#ffb454', blue: '#59c2ff',
  purple: '#d2a6ff', cyan: '#95e6cb', orange: '#ff8f40',
};

export const PRESETS = {
  // dark
  gruvbox, dracula, nord, 'one-dark': oneDark, catppuccin, 'tokyo-night': tokyoNight,
  'github-dark': githubDark, monokai, 'rose-pine': rosePine, everforest, 'ayu-dark': ayuDark,
  // light
  'github-light': githubLight, 'solarized-light': solarizedLight, 'catppuccin-latte': catppuccinLatte,
};

export const DEFAULT = 'gruvbox';

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Validate + canonicalize a hex string: expand #abc → #aabbcc, lowercase.
// Returns null for anything that isn't a valid 3/6-digit hex.
function normalizeHex(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!HEX_RE.test(s)) return null;
  let h = s.toLowerCase();
  if (h.length === 4) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  return h;
}

/**
 * Resolve a theme to a complete, validated flat color object.
 *
 * @param {Object} [arg]
 * @param {string|Object} [arg.name]   preset/user-theme name, OR an inline theme
 *   object (may include a `base` key naming a preset/user theme to inherit from).
 * @param {Object} [arg.userThemes]    map of user-defined named themes; these
 *   shadow built-in presets of the same name.
 * @returns {{ theme: Object, warnings: string[] }}
 */
export function resolveTheme({ name, userThemes } = {}) {
  const warnings = [];
  const registry = { ...PRESETS, ...(userThemes || {}) };

  // Expand a theme node (preset, user theme, or inline object) into a full slot
  // map, resolving an optional `base` (which may itself chain) over the default,
  // with a cycle guard. Same rules whether the theme came from a name or inline.
  const expand = (node, seen) => {
    if (!node || typeof node !== 'object') return { ...PRESETS[DEFAULT] };
    const { base, ...slots } = node;
    let baseColors;
    if (base == null) {
      baseColors = { ...PRESETS[DEFAULT] };
    } else if (seen.has(base)) {
      warnings.push(`Theme base cycle at "${base}"; using "${DEFAULT}".`);
      baseColors = { ...PRESETS[DEFAULT] };
    } else if (registry[base]) {
      baseColors = expand(registry[base], new Set(seen).add(base));
    } else {
      warnings.push(`Unknown base theme "${base}", using "${DEFAULT}".`);
      baseColors = { ...PRESETS[DEFAULT] };
    }
    for (const key of Object.keys(slots)) {
      if (!SLOTS.includes(key)) warnings.push(`Unknown theme slot "${key}" ignored.`);
    }
    return { ...baseColors, ...slots };
  };

  // Pick the starting node.
  let node;
  if (name && typeof name === 'object') {
    node = name; // inline theme object
  } else if (name == null || name === '') {
    node = registry[DEFAULT];
  } else if (registry[name]) {
    node = registry[name];
  } else {
    warnings.push(`Unknown theme "${name}", using "${DEFAULT}".`);
    node = registry[DEFAULT];
  }

  const merged = expand(node, new Set());

  // Validate + normalize every slot; invalid/missing → that slot's default.
  const theme = {};
  for (const slot of SLOTS) {
    const norm = normalizeHex(merged[slot]);
    if (norm) {
      theme[slot] = norm;
    } else {
      if (merged[slot] !== undefined) {
        warnings.push(`Invalid hex for "${slot}": ${JSON.stringify(merged[slot])}; using default.`);
      }
      theme[slot] = PRESETS[DEFAULT][slot];
    }
  }

  return { theme, warnings };
}

export function listThemes() {
  return Object.keys(PRESETS);
}
