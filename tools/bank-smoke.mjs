import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export async function runBankSmoke(browser, url, output, root) {
  const text = readFileSync(resolve(root, 'src/content/levels.ts'), 'utf8');
  const catalog = JSON.parse(text.slice(text.indexOf('= ') + 2).trim().replace(/;$/, ''));
  const key = 'road-lines.save.v1', tutorials = catalog.slice(0, 3).map(l => l.id);
  const seed = level => ({ version: 1, levelId: level.id, levelVersion: level.version, path: [level.start], completed: tutorials, coins: 60, hints: 3 });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key, seed: seed(catalog[3]) });
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  const ready = () => page.locator('#app[data-ready=true]').waitFor();
  const save = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
  const openSet = async id => {
    await page.locator(`[data-action=open-set][data-set=${id}]`).click();
    await page.getByRole('heading', { name: id === 'turns' ? 'Повороты' : 'Сложные фигуры', exact: true }).waitFor();
    assert.equal(await page.locator('.level-tile:enabled').count(), 1);
    assert.equal(await page.locator('.level-tile').count(), 30);
  };
  const toSets = async () => { await page.getByRole('button', { name: 'Пауза', exact: true }).click(); await page.getByRole('button', { name: 'ВЫБОР УРОВНЕЙ', exact: true }).click(); };
  const movePrefix = async (level, length) => {
    await page.locator('#board').focus();
    for (let i = 1; i < length; i++) {
      const delta = level.witness[i] - level.witness[i - 1];
      await page.keyboard.press(delta === 1 ? 'ArrowRight' : delta === -1 ? 'ArrowLeft' : delta === level.width ? 'ArrowDown' : 'ArrowUp');
    }
  };
  await page.goto(url); await ready();
  assert.match(await page.locator('.home-progress').textContent(), /3\s*\/\s*90/);
  await page.locator('[data-action=sets]:visible').click(); assert.equal(await page.locator('.set-card:enabled').count(), 3);
  await page.screenshot({ path: resolve(output, 'bank-sets-unlocked.png') });
  await openSet('turns'); await page.screenshot({ path: resolve(output, 'bank-turns-grid.png') });
  await page.getByRole('button', { name: 'Уровень 1, доступен', exact: true }).click();
  await movePrefix(catalog[30], 3); assert.deepEqual((await save()).path, catalog[30].witness.slice(0, 3));
  assert.equal(await page.locator('.level strong').textContent(), '2–1');
  await toSets(); await openSet('shapes'); await page.getByRole('button', { name: 'Уровень 1, доступен', exact: true }).click();
  await movePrefix(catalog[60], 3); assert.equal(await page.locator('.level strong').textContent(), '3–1');
  await toSets(); await openSet('turns'); await page.getByRole('button', { name: 'Уровень 1, доступен', exact: true }).click();
  assert.deepEqual((await save()).path, catalog[30].witness.slice(0, 3));
  assert.deepEqual((await save()).drafts['shapes-01'].path, catalog[60].witness.slice(0, 3));
  await page.reload(); await ready(); await page.locator('[data-action=continue]').click();
  assert.equal(await page.locator('.level strong').textContent(), '2–1'); assert.deepEqual((await save()).path, catalog[30].witness.slice(0, 3));
  await toSets(); await openSet('shapes');
  assert.match(await page.locator('.menu-caption').textContent(), /0 из 30/);
  await page.close(); await context.close(); assert.deepEqual(errors, []);
  for (const [width, height] of [[320, 568], [360, 800], [390, 844], [412, 915], [576, 1280]]) {
    const p = await browser.newPage({ viewport: { width, height } });
    await p.addInitScript(({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)), { key, seed: seed(catalog[89]) });
    await p.goto(url); await p.locator('#app[data-ready=true]').waitFor(); await p.locator('[data-action=continue]').click();
    await p.waitForTimeout(550);
    const b = await p.locator('.instruction').boundingBox(), banner = await p.locator('#banner-slot').boundingBox();
    assert(b && banner && b.y + b.height <= banner.y, 'Combined-rule copy stays above banner');
    assert.equal(await p.locator('.level strong').textContent(), '3–30');
    await p.screenshot({ path: resolve(output, `bank-final-${width}x${height}.png`) });
    await p.close();
  }
  console.log('Bank: independent set unlocks, navigation, per-set counters, cross-set drafts/reload and final-field viewports passed.');
}
