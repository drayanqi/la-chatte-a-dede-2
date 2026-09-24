/**
 * Docs GIF render (Epic 8.2): screenshots the real canvas frame by frame for
 * every situation and assembles docs/scripting/img/<situation>.gif.
 *
 * Run: npx playwright test --config=playwright.docs.config.ts
 * (separate config: NOT part of the e2e suite — the webServer here is a bare
 * Vite dev server, no backend, no engine)
 */
import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const ROOT = process.cwd();
const FRAMES_DIR = path.resolve(ROOT, 'docs/scripting/frames');
const OUT_DIR = path.resolve(ROOT, 'docs/scripting/img');
const STEP = 5; // 60 Hz engine → 12 fps GIF
const DELAY_MS = Math.round((1000 * STEP) / 60);

for (const file of fs.readdirSync(FRAMES_DIR).filter((f) => f.endsWith('.json'))) {
  const name = file.replace(/\.json$/, '');
  test(`render ${name}.gif`, async ({ page }) => {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(FRAMES_DIR, file), 'utf8'),
    ) as { frames: { index: number }[] };
    await page.goto(`/scripts/action-docs/viewer.html?situation=${name}&frame=0`);
    await page.waitForFunction(() => window.__docReady === true, undefined, { timeout: 30_000 });
    const canvas = page.locator('[data-testid="field-canvas"] canvas');

    const gif = GIFEncoder();
    for (const frame of parsed.frames.filter((_, i) => i % STEP === 0)) {
      await page.evaluate((n) => window.__docSeek?.(n), frame.index);
      // Two RAFs guarantee the Pixi ticker has rendered the seeked frame.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      const shot = await canvas.screenshot({ type: 'png' });
      const png = PNG.sync.read(shot);
      const palette = quantize(png.data, 256);
      gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, {
        palette,
        delay: DELAY_MS,
      });
    }
    gif.finish();
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, `${name}.gif`), Buffer.from(gif.bytes()));
  });
}
