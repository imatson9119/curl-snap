// Render the card to a PNG buffer with no browser: satori turns the element
// tree into an SVG, then @resvg/resvg-js rasterizes it. Fonts are bundled, so
// output is deterministic and there's nothing to install.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { buildTree, rootWidth } from './template.js';

// Resolve the vendored fonts relative to this module (not cwd), so it works the
// same whether installed locally, globally (npm i -g), via npx, or in the
// Homebrew libexec. Same import.meta.url pattern bin/curl-snap.js uses.
const here = path.dirname(fileURLToPath(import.meta.url));
const fontDir = path.join(here, '..', 'assets', 'fonts');

// Read once at module load (~180KB each) and reuse across calls.
const fonts = [
  { name: 'Fira Mono', weight: 400, style: 'normal', data: fs.readFileSync(path.join(fontDir, 'FiraMono-Regular.ttf')) },
  { name: 'Fira Mono', weight: 500, style: 'normal', data: fs.readFileSync(path.join(fontDir, 'FiraMono-Medium.ttf')) },
  { name: 'Fira Mono', weight: 700, style: 'normal', data: fs.readFileSync(path.join(fontDir, 'FiraMono-Bold.ttf')) },
];

// Shared: model → satori SVG string. Width is computed in exactly one place
// (template.rootWidth) so the satori canvas can't drift from the root vnode.
// satori auto-computes the height, and vectorizes text to paths, so the SVG is
// self-contained (no font needed to view it).
async function buildSvg(model) {
  return satori(buildTree(model), { width: rootWidth(model), fonts });
}

/**
 * @param {Object} model   see template.buildTree
 * @returns {Promise<string>}  portable SVG markup
 */
export async function renderSvg(model) {
  return buildSvg(model);
}

/**
 * @param {Object} model   see template.buildTree
 * @returns {Promise<Buffer>}
 */
export async function renderPng(model) {
  const resvg = new Resvg(await buildSvg(model), {
    // deviceScaleFactor equivalent — render at Nx for crisp output (default 2).
    fitTo: { mode: 'zoom', value: model.scale || 2 },
    // Transparent background so the card's drop shadow keeps its alpha.
    background: 'rgba(0, 0, 0, 0)',
    // Everything we need is embedded; don't touch system fonts.
    font: { loadSystemFonts: false },
  });

  return resvg.render().asPng();
}
