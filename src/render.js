// Render the card HTML to a PNG buffer by screenshotting it with the system
// Chrome via puppeteer-core (no bundled browser download).

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { buildHtml } from './template.js';

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  // Linux fallbacks
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

export function resolveChromePath(override) {
  const candidates = [override, process.env.CURL_SNAP_CHROME, ...CHROME_CANDIDATES].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'Could not find a Chrome/Chromium executable. Pass --chrome <path> or set CURL_SNAP_CHROME.'
  );
}

/**
 * @param {Object} model       see template.buildHtml
 * @param {Object} opts
 * @param {string} [opts.chromePath]
 * @returns {Promise<Buffer>}
 */
export async function renderPng(model, opts = {}) {
  const executablePath = resolveChromePath(opts.chromePath);
  const html = buildHtml(model);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-color-profile=srgb'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: model.width + 56, height: 600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Measure the card so we can clip tightly, keeping the body's 28px padding
    // as a transparent margin (so the drop shadow isn't cut off) but dropping
    // any empty space below.
    const box = await page.$eval('#card', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const pad = 28;
    const clip = {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    };
    await page.setViewport({
      width: Math.ceil(clip.x + clip.width),
      height: Math.ceil(clip.y + clip.height),
      deviceScaleFactor: 2,
    });

    const buffer = await page.screenshot({ type: 'png', clip, omitBackground: true });
    return buffer;
  } finally {
    await browser.close();
  }
}
