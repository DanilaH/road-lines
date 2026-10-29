import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inspect = !process.argv.includes('--production');
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', ...(inspect ? ['--mode', 'inspect'] : [])], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const port = 4189;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
const url = `http://127.0.0.1:${port}`;
const results = [];
let browser;
const output = resolve(root, '.test-output');
mkdirSync(output, { recursive: true });
try {
  for (let n = 0; ; n++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    if (server.exitCode !== null || n > 100) throw Error('Preview did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  for (const [width, height] of [[320, 568], [360, 800], [390, 844], [412, 915], [576, 1280]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('#app[data-ready=true]').waitFor();
    assert.equal(await page.locator('canvas').count(), 1);
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('#app').getAttribute('data-blocked'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').isVisible(), false);
    assert.equal(await page.locator('#app').getAttribute('data-blocked'), 'false');
    const play = await page.locator('#board').boundingBox();
    const banner = await page.locator('#banner-slot').boundingBox();
    assert(play && banner && play.y + play.height <= banner.y + 1, 'Board must not overlap native banner reservation');
    const hud = await page.locator('.hud').boundingBox();
    assert(hud && hud.x >= 0 && hud.x + hud.width <= width, 'HUD containment');
    for (const button of await page.locator('.hud button').all()) {
      const b = await button.boundingBox(); assert(b && b.width >= 48 && b.height >= 48, '48px action target');
    }
    await page.screenshot({ path: resolve(output, `play-${width}x${height}.png`) });
    if (inspect) {
      await page.goto(`${url}/?screen=result`);
      await page.locator('#app[data-ready=true]').waitFor();
      assert.equal(await page.locator('#banner-slot').isVisible(), false);
      const heading = await page.locator('.result-heading').boundingBox();
      const miniature = await page.locator('#board').boundingBox();
      const rewards = await page.locator('.rewards').boundingBox();
      assert(heading && miniature && rewards && heading.y + heading.height < miniature.y, 'Stars above miniature');
      assert(miniature.y + miniature.height <= rewards.y, 'Miniature clear of reward controls');
      assert(rewards.y + rewards.height <= height, 'Rewards on screen');
      await page.screenshot({ path: resolve(output, `result-${width}x${height}.png`) });
      await page.getByRole('button', { name: 'ДАЛЬШЕ', exact: true }).click();
      await page.locator('.play').waitFor();
    } else {
      await page.goto(`${url}/?screen=result`);
      await page.locator('#app[data-ready=true]').waitFor();
      assert.equal(await page.locator('.result-heading').isVisible(), false, 'Inspection route is excluded from production');
    }
    assert.deepEqual(errors, []);
    results.push({ width, height, passed: true });
    await page.close();
  }
  // Resize the running renderer without creating a second canvas or stale bounds.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url); await page.locator('#app[data-ready=true]').waitFor();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForFunction(() => document.querySelector('canvas')?.width === Math.round(document.querySelector('#board')?.clientWidth * Math.min(devicePixelRatio, 2)));
  assert.equal(await page.locator('canvas').count(), 1);
  await page.close();
  writeFileSync(resolve(output, inspect ? 'browser-inspect.json' : 'browser-production.json'), JSON.stringify({ inspect, results }, null, 2));
  console.log(`Browser smoke: ${results.length} viewports passed (${inspect ? 'inspect' : 'production'}), plus live resize.`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
