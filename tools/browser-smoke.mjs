import { runMechanicsSmoke } from './mechanics-smoke.mjs';
import { runMenuSmoke } from './menu-smoke.mjs';
import { runThemeSmoke } from './theme-smoke.mjs';
import { runRewardsSmoke } from './rewards-smoke.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
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
const enterGame = async page => {
  await page.locator('#app[data-ready=true]').waitFor();
  if (await page.locator('[data-action=continue]').isVisible()) await page.locator('[data-action=continue]').click();
};
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
    await page.screenshot({ path: resolve(output, `home-${width}x${height}.png`) });
    await page.locator('[data-action=sets]:visible').click();
    await page.screenshot({ path: resolve(output, `sets-${width}x${height}.png`) });
    assert.equal(await page.locator('.set-card:disabled').count(), 2);
    await page.locator('[data-action=open-set]:enabled').click();
    await page.screenshot({ path: resolve(output, `levels-${width}x${height}.png`) });
    assert.equal(await page.locator('.level-tile').count(), 30);
    assert.equal(await page.locator('.level-tile:enabled').count(), 1);
    const grid = await page.locator('.menu-screen').boundingBox();
    const reserved = await page.locator('#banner-slot').boundingBox();
    assert(grid && reserved && grid.y + grid.height <= reserved.y, 'Grid clears banner');
    for (const button of await page.locator('.level-tile').all()) {
      const b = await button.boundingBox(); assert(b && b.width >= 48 && b.height >= 48, 'Grid tap targets');
    }
    await page.locator('.level-tile').last().scrollIntoViewIfNeeded();
    const lastTile = await page.locator('.level-tile').last().boundingBox();
    assert(lastTile && lastTile.y + lastTile.height <= reserved.y, 'Last task scrolls above banner');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await enterGame(page);
    assert.equal(await page.locator('#board canvas').count(), 1);
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
    for (const button of await page.locator('.hud button:visible').all()) {
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
      await enterGame(page);
      await page.locator('.play').waitFor();
    } else {
      await page.goto(`${url}/?screen=result`);
      await page.locator('#app[data-ready=true]').waitFor();
      await enterGame(page);
      assert.equal(await page.locator('.result-heading').isVisible(), false, 'Inspection route is excluded from production');
    }
    assert.deepEqual(errors, []);
    results.push({ width, height, passed: true });
    await page.close();
  }
  // Resize the running renderer without creating a second canvas or stale bounds.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url); await enterGame(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForFunction(() => document.querySelector('#board canvas')?.width === Math.round(document.querySelector('#board')?.clientWidth * Math.min(devicePixelRatio, 2)));
  assert.equal(await page.locator('#board canvas').count(), 1);
  await page.close();
  // Exercise the production input pipeline with a real mouse, not a debug route setter.
  const gameplayContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const gameplay = await gameplayContext.newPage();
  await gameplay.addInitScript(() => {
    const Base = window.AudioContext;
    window.__audioProbe = { oscillators: 0, active: 0, contexts: [] };
    window.AudioContext = class extends Base {
      constructor(...args) { super(...args); window.__audioProbe.contexts.push(this); }
      createOscillator() {
        const node = super.createOscillator(); window.__audioProbe.oscillators++; window.__audioProbe.active++;
        node.addEventListener('ended', () => window.__audioProbe.active--, { once: true }); return node;
      }
    };
  });

  const catalogText = readFileSync(resolve(root, 'src/content/levels.ts'), 'utf8');
  const catalog = JSON.parse(catalogText.slice(catalogText.indexOf('= ') + 2).trim().replace(/;$/, ''));
  const saveKey = 'road-lines.save.v1';
  const errors = [];
  gameplay.on('pageerror', e => errors.push(e.message));
  const open = async () => { await gameplay.goto(url); await enterGame(gameplay); };
  const readSave = () => gameplay.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
  const center = async (level, cell) => {
    const b = await gameplay.locator('#board').boundingBox();
    const xs = level.cells.map(c => c % level.width), ys = level.cells.map(c => Math.floor(c / level.width));
    const columns = Math.max(...xs) - Math.min(...xs) + 1, rows = Math.max(...ys) - Math.min(...ys) + 1;
    const size = Math.min(56 * Math.min(b.width / 390, 1.5), (b.width - 40) / (columns + (columns - 1) / 7), (b.height - 64) / (rows + (rows - 1) / 7));
    const gap = size / 7;
    return { x: b.x + (b.width - columns * size - (columns - 1) * gap) / 2 + (cell % level.width - Math.min(...xs)) * (size + gap) + size / 2,
      y: b.y + (b.height - rows * size - (rows - 1) * gap) / 2 + (Math.floor(cell / level.width) - Math.min(...ys)) * (size + gap) + size / 2 };
  };
  const move = async p => gameplay.mouse.move(p.x, p.y);
  await open();
  const first = catalog[0];
  await move(await center(first, first.start)); await gameplay.mouse.down();
  await move(await center(first, 1)); await gameplay.mouse.up();
  assert.deepEqual((await readSave()).path, [0, 1]);
  await gameplay.reload(); await enterGame(gameplay);
  assert.deepEqual((await readSave()).path, [0, 1]);
  await move(await center(first, 1)); await gameplay.mouse.down(); await move(await center(first, 0)); await gameplay.mouse.up();
  assert.deepEqual((await readSave()).path, [0]);
  // One pointermove traverses both intermediate/last cells.
  await move(await center(first, 0)); await gameplay.mouse.down(); await move(await center(first, 2)); await gameplay.mouse.up();
  await gameplay.locator('.result').waitFor();
  assert.equal((await readSave()).coins, 20);
  assert.equal(await gameplay.locator('.balance').textContent(), '0', 'Owned value is not animated into the counter before collection');
  await gameplay.waitForTimeout(1450);
  assert.equal(await gameplay.locator('.flying-coin').count(), 16);
  const painted = await gameplay.locator('.celebration-layer').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0; for (let i = 3; i < data.length; i += 16) if (data[i]) count++;
    return { count, width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height };
  });
  assert(painted.count > 20 && painted.width === 390 && painted.height === 844);
  assert(await gameplay.evaluate(() => window.__audioProbe.oscillators > 8 && window.__audioProbe.contexts.length === 1));
  await gameplay.screenshot({ path: resolve(output, 'win-celebration.png') });
  await gameplay.reload(); await enterGame(gameplay);
  assert.equal((await readSave()).coins, 20);
  await gameplay.getByRole('button', { name: 'ДАЛЬШЕ', exact: true }).click();
  await gameplay.locator('.play').waitFor();
  assert.equal((await readSave()).levelId, catalog[1].id);
  await gameplay.getByRole('button', { name: 'Пауза', exact: true }).click();
  await gameplay.getByRole('button', { name: 'Звук: вкл', exact: true }).click();
  await gameplay.getByRole('button', { name: 'Вибрация: вкл', exact: true }).click();
  await gameplay.getByRole('button', { name: 'ПРОДОЛЖИТЬ', exact: true }).click();
  const mutedCount = await gameplay.evaluate(() => window.__audioProbe.oscillators);

  // All actual witnesses through the production input; reject no legal authored turn.
  for (let index = 1; index < catalog.length; index++) {
    const level = catalog[index];
    await move(await center(level, level.start)); await gameplay.mouse.down();
    for (const [step, cell] of level.witness.slice(1).entries()) {
      await move(await center(level, cell));
      if (index === 14 && step === 10) await gameplay.screenshot({ path: resolve(output, 'active-route.png') });
    }
    await gameplay.mouse.up(); await gameplay.locator('.result').waitFor();
    assert.equal((await readSave()).completed.length, index + 1);
    if (index === 1) {
      assert.equal(await gameplay.evaluate(() => window.__audioProbe.oscillators), mutedCount, 'Mute creates no new voices');
      await gameplay.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal(await gameplay.locator('.flying-coin').count(), 0);
      assert.equal(await gameplay.locator('.balance').textContent(), '40');
      await gameplay.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
      await gameplay.waitForTimeout(900);
      assert.equal(await gameplay.locator('.flying-coin').count(), 0, 'Background cancels delayed scatter instead of replaying it');
      assert.equal((await readSave()).coins, 40);
    }
    if (index < catalog.length - 1) {
      await gameplay.getByRole('button', { name: 'ДАЛЬШЕ', exact: true }).click({ clickCount: index === 2 ? 2 : 1 });
      if (await gameplay.locator('.bonus-overlay').isVisible()) {
        await gameplay.locator('[data-action=close-bonus]').click();
        await gameplay.getByRole('button', { name: 'ДАЛЬШЕ', exact: true }).click();
      }
      if (index === 3) {
        await gameplay.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
        await gameplay.waitForTimeout(700);
        assert.equal((await readSave()).levelId, level.id, 'Cancelled collection must not navigate in the background');
        assert.equal((await readSave()).coins, 80);
        assert.equal(await gameplay.locator('.flying-coin').count(), 0);
        await gameplay.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
        await gameplay.getByRole('button', { name: 'ДАЛЬШЕ', exact: true }).click();
      }
      await gameplay.locator('.play').waitFor(); assert.equal((await readSave()).levelId, catalog[index + 1].id);
    }
    if (index === 1) {
      await gameplay.getByRole('button', { name: 'Пауза', exact: true }).click();
      await gameplay.getByRole('button', { name: 'Звук: выкл', exact: true }).click();
      await gameplay.getByRole('button', { name: 'Вибрация: выкл', exact: true }).click();
      await gameplay.getByRole('button', { name: 'ПРОДОЛЖИТЬ', exact: true }).click();
    }
  }
  assert.equal((await readSave()).coins, 700);
  await gameplay.getByRole('button', { name: 'К ВЫБОРУ УРОВНЕЙ', exact: true }).click();
  if (await gameplay.locator('.bonus-overlay').isVisible()) {
    await gameplay.locator('[data-action=close-bonus]').click();
    await gameplay.getByRole('button', { name: 'К ВЫБОРУ УРОВНЕЙ', exact: true }).click();
  }
  await gameplay.locator('.bank-complete').waitFor();
  assert.equal(await gameplay.locator('.level-tile.completed').count(), 30);
  await gameplay.getByRole('button', { name: 'Уровень 1, пройден, три звезды', exact: true }).click();
  await gameplay.locator('#app[data-screen=game]').waitFor();
  // A worker hint is spent only after a found continuation is presented.
  await gameplay.getByRole('button', { name: 'Подсказка, осталось 3', exact: true }).click();
  await gameplay.getByText('Бледная линия показывает продолжение.', { exact: true }).waitFor();
  assert.equal((await readSave()).hints, 2);
  await gameplay.getByRole('button', { name: 'Начать заново', exact: true }).click();
  await move(await center(first, 0)); await gameplay.mouse.down(); await move(await center(first, 2)); await gameplay.mouse.up();
  await gameplay.locator('.result').waitFor(); assert.equal((await readSave()).coins, 700);
  // Restore a deterministic branch puzzle, then prove dead-end help is free.
  await gameplay.evaluate(({ key, level }) => {
    const s = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...s, levelId: level.id, levelVersion: 1, path: [level.start] }));
  }, { key: saveKey, level: catalog[2] });
  await gameplay.reload(); await enterGame(gameplay);
  const branch = catalog[2];
  // A diagonal misses the central rectangles of the orthogonal neighbours.
  await move(await center(branch, 0)); await gameplay.mouse.down(); await move(await center(branch, 4)); await gameplay.mouse.up();
  assert.deepEqual((await readSave()).path, [0]);
  await move(await center(branch, 0)); await gameplay.mouse.down();
  await move(await center(branch, 1)); await move(await center(branch, 4)); await gameplay.mouse.up();
  await gameplay.getByRole('button', { name: 'Подсказка, осталось 2', exact: true }).click();
  await gameplay.getByRole('button', { name: 'Вернуться', exact: true }).waitFor();
  assert.equal((await readSave()).hints, 2);
  await gameplay.getByRole('button', { name: 'Вернуться', exact: true }).click();
  assert.deepEqual((await readSave()).path, [0, 1]);
  // Real protocol touch cancellation and a second finger cannot reset/redirect the route.
  const cdp = await gameplay.context().newCDPSession(gameplay);
  const touch = async (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const p1 = await center(branch, 1), p2 = await center(branch, 2), p5 = await center(branch, 5), p0 = await center(branch, 0);
  await touch('touchStart', [{ ...p1, id: 1 }]);
  await touch('touchMove', [{ ...p2, id: 1 }]);
  await touch('touchCancel', []);
  assert.deepEqual((await readSave()).path, [0, 1, 2]);
  await touch('touchStart', [{ ...p2, id: 1 }]);
  await touch('touchStart', [{ ...p2, id: 1 }, { ...p0, id: 2 }]);
  await touch('touchMove', [{ ...p5, id: 1 }, { ...p0, id: 2 }]);
  await touch('touchEnd', []);
  assert.deepEqual((await readSave()).path, [0, 1, 2, 5]);
  await cdp.detach();
  // Once the pointer leaves the board, re-entry while still held cannot continue.
  await move(await center(branch, 5)); await gameplay.mouse.down();
  const outside = await gameplay.locator('#board').boundingBox();
  await gameplay.mouse.move(outside.x + outside.width + 20, p5.y);
  await move(await center(branch, 4)); await gameplay.mouse.up();
  assert.deepEqual((await readSave()).path, [0, 1, 2, 5]);

  // An unavailable worker search is neither a charged hint nor a claimed dead end.
  await gameplay.route('**/assets/hint.worker-*.js', route => route.abort());
  await gameplay.getByRole('button', { name: 'Подсказка, осталось 2', exact: true }).click();
  await gameplay.getByText('Сейчас не удалось найти продолжение. Подсказка не потрачена.', { exact: true }).waitFor();
  assert.equal((await readSave()).hints, 2);
  const other = await gameplay.context().newPage();
  await other.goto(url);
  await other.getByText('Игра уже открыта в другой вкладке. Закрой её и попробуй снова.', { exact: true }).waitFor();
  await other.close();
  assert.deepEqual(errors, []); await gameplay.close(); await gameplayContext.close();
  await runMechanicsSmoke(browser, url, output, root);
  await runMenuSmoke(browser, url, output);
  await runThemeSmoke(browser, url, output);
  await runRewardsSmoke(browser, url, output, root);
  writeFileSync(resolve(output, inspect ? 'browser-inspect.json' : 'browser-production.json'), JSON.stringify({ inspect, results }, null, 2));
  console.log(`Browser smoke: ${results.length} viewports passed (${inspect ? 'inspect' : 'production'}), plus live resize.`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
