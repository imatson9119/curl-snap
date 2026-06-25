// Render the card to a PNG buffer with no browser: satori turns the element
// tree into an SVG, then @resvg/resvg-js rasterizes it. Fonts are bundled, so
// output is deterministic and there's nothing to install.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { buildTree } from './template.js';

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

/**
 * @param {Object} model   see template.buildTree
 * @returns {Promise<Buffer>}
 */
export async function renderPng(model) {
  // satori auto-computes the height from the content when only width is given.
  const svg = await satori(buildTree(model), {
    width: model.width + 56,
    fonts,
  });

  const resvg = new Resvg(svg, {
    // deviceScaleFactor: 2 equivalent — render at 2x for crisp output.
    fitTo: { mode: 'zoom', value: 2 },
    // Transparent background so the card's drop shadow keeps its alpha.
    background: 'rgba(0, 0, 0, 0)',
    // Everything we need is embedded; don't touch system fonts.
    font: { loadSystemFonts: false },
  });

  return resvg.render().asPng();
}
