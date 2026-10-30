import assert from 'node:assert/strict';
import { resolve } from 'node:path';

async function ribbonPixels(page, hex) {
  await page.locator('[data-transition-ghost]').evaluateAll(nodes => Promise.all(nodes.flatMap(el => el.getAnimations()).map(a => a.finished.catch(() => {}))));
  await page.locator('#board').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))));
  const png = await page.locator('#board').screenshot();
  return page.evaluate(async ({ data, hex }) => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const expected = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
    let count = 0;
    // The field now shades the same hue from 17% lighter to 12% darker.
    // Match that narrow colour ramp, rather than requiring a flat RGB pixel.
    const ramp = Array.from({ length: 60 }, (_, i) => {
      const amount = -.12 + i * .29 / 59, target = amount < 0 ? 0 : 255;
      return expected.map(v => Math.round(v * (1 - Math.abs(amount)) + target * Math.abs(amount)));
    });
    for (let i = 0; i < pixels.length; i += 4)
      if (ramp.some(rgb => rgb.every((v, c) => Math.abs(pixels[i + c] - v) <= 2))) count++;
    return count;
  }, { data: png.toString('base64'), hex });
}
const matrix = [
  ['classic', 'Классика', '#8550ed', '#fff9ef', 0], ['mint', 'Мята', '#20ae79', '#f4faf2', 0],
  ['lagoon', 'Лагуна', '#129fc3', '#f1fafb', 500], ['sunset', 'Закат', '#ee7452', '#fff6ee', 500],
  ['lavender', 'Лаванда', '#b855d3', '#f8f3fc', 500], ['honey', 'Мёд', '#b88122', '#fffae9', 500],
  ['dusk', 'Сумерки', '#a38afa', '#202335', 500], ['neon', 'Неон', '#a8d94b', '#192725', 500],
];
const key = 'road-lines.save.v1';
const ready = page => page.locator('#app[data-ready=true]').waitFor();
const save = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const seed = async (page, coins) => page.addInitScript(({ key, coins }) => {
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, levelId: 'intro-01', levelVersion: 1, path: [0, 1], completed: [], coins, hints: 3 }));
}, { key, coins });

export async function runThemeSmoke(browser, url, output) {
  // Catalog accessibility/scroll/targets on all supported layouts, including short phone.
  for (const [width, height] of [[320, 568], [360, 800], [390, 844], [412, 915], [576, 1280]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(url); await ready(page);
    await page.locator('[data-action=themes]:visible').scrollIntoViewIfNeeded();
    await page.locator('[data-action=themes]:visible').click();
    assert.equal(await page.locator('.theme-card').count(), 8);
    assert.equal(await page.locator('.theme-card:has(.coin)').count(), 6);
    const columns = await page.locator('.theme-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(columns, 2);
    for (const card of await page.locator('.theme-card').all()) {
      await card.scrollIntoViewIfNeeded(); const b = await card.boundingBox();
      assert(b && b.width >= 48 && b.height >= 48 && b.x >= 0 && b.x + b.width <= width, 'Catalog target containment');
    }
    await page.locator('.menu-body').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: resolve(output, `themes-${width}x${height}.png`) });
    await page.locator('[data-theme-id=lagoon]').click();
    assert.equal(await page.locator('[data-action=buy-theme]').isDisabled(), true);
    await page.getByText('Не хватает монет: 500.', { exact: true }).waitFor();
    const dialog = await page.locator('.theme-purchase').boundingBox();
    assert(dialog && dialog.y >= 0 && dialog.y + dialog.height <= height, 'Purchase dialog fits');
    await page.keyboard.press('Escape');
    await page.locator('[data-theme-id=mint]').click();
    assert.equal((await save(page)).themeId, 'mint'); assert.equal((await save(page)).coins, 0);
    await page.keyboard.press('Escape');
    await page.locator('[data-action=continue]').click();
    assert(await ribbonPixels(page, '#20ae79') > 100, 'Free theme reaches real Phaser field');
    await page.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await seed(page, 3000); await page.goto(url); await ready(page);
  await page.locator('[data-action=themes]:visible').click();
  let balance = 3000;
  for (const [id, name, ribbon, background, price] of matrix) {
    await page.locator(`[data-theme-id=${id}]`).click();
    if (price) {
      await page.getByRole('dialog', { name, exact: true }).waitFor();
      assert.equal((await save(page)).coins, balance, 'Preview does not debit');
      await page.locator('[data-action=buy-theme]').evaluate(button => { button.click(); button.click(); });
      balance -= price;
    }
    assert.equal((await save(page)).coins, balance, 'One debit per purchase');
    assert.equal((await save(page)).themeId, id);
    assert((await save(page)).ownedThemes.includes(id));
    assert.deepEqual((await save(page)).path, [0, 1]);
    assert.equal(await page.locator('.theme-card.equipped').getAttribute('data-theme-id'), id);
    await page.keyboard.press('Escape');
    // Home origin for the first theme; pause origin for all subsequent themes.
    if (await page.getByRole('dialog', { name: 'Пауза', exact: true }).isVisible()) await page.keyboard.press('Escape');
    else await page.locator('[data-action=continue]').click();
    assert(await ribbonPixels(page, ribbon) > 100, `${id} uses actual ribbon color`);
    const actual = await page.locator('.surface').evaluate(el => getComputedStyle(el).backgroundColor);
    const expected = `rgb(${[1, 3, 5].map(i => Number.parseInt(background.slice(i, i + 2), 16)).join(', ')})`;
    assert.equal(actual, expected);
    if (id === 'dusk' || id === 'neon') await page.screenshot({ path: resolve(output, `theme-${id}-play.png`) });
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    await page.getByRole('button', { name: 'ТЕМЫ', exact: true }).click();
  }
  assert.equal(balance, 0);
  await page.reload(); await ready(page);
  assert.equal((await save(page)).ownedThemes.length, 8);
  assert.equal((await save(page)).themeId, 'neon'); assert.equal((await save(page)).coins, 0);
  await page.locator('[data-action=themes]:visible').click();
  assert.equal(await page.locator('.theme-card:has(.coin)').count(), 0);
  await page.locator('[data-theme-id=lagoon]').click();
  assert.equal((await save(page)).coins, 0, 'Re-equipping paid theme is free');
  await page.keyboard.press('Escape'); await page.locator('[data-action=continue]').click();
  // Completing and continuing after a purchase cannot erase ownership or restore spent coins.
  await page.locator('#board').focus(); await page.keyboard.press('ArrowRight');
  await page.locator('.result-heading:visible').waitFor();
  assert.equal((await save(page)).coins, 20);
  await page.getByRole('button', { name: 'Темы', exact: true }).click();
  await page.locator('[data-theme-id=dusk]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#app').getAttribute('data-screen'), 'game', 'Result origin restored');
  assert.equal(await page.locator('.result-heading').isVisible(), true);
  assert.equal((await save(page)).coins, 20);
  await page.screenshot({ path: resolve(output, 'theme-dusk-result.png') });
  await page.getByRole('button', { name: 'ДАЛЬШЕ', exact: true }).click();
  assert.equal((await save(page)).themeId, 'dusk');
  assert.equal((await save(page)).ownedThemes.length, 8);
  assert.equal((await save(page)).coins, 20);
  assert.deepEqual(errors, []);
  await context.close();

  const failure = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await seed(failure, 1000); await failure.goto(url); await ready(failure);
  await failure.locator('[data-action=themes]:visible').click(); await failure.locator('[data-theme-id=lagoon]').click();
  await failure.evaluate(() => { Storage.prototype.setItem = () => { throw Error('disk full'); }; });
  await failure.locator('[data-action=buy-theme]').click();
  assert.equal((await save(failure)).coins, 1000); assert.equal((await save(failure)).themeId, 'classic');
  assert.equal((await save(failure)).ownedThemes?.includes('lagoon') ?? false, false);
  await failure.getByText('Не удалось сохранить прогресс.', { exact: true }).waitFor();
  await failure.reload(); await ready(failure);
  assert.equal(await failure.locator('#app').getAttribute('data-theme'), 'classic');
  await failure.locator('[data-action=themes]:visible').click(); await failure.locator('[data-theme-id=lagoon]').click();
  await failure.locator('[data-action=buy-theme]').click();
  assert.equal((await save(failure)).coins, 500); assert.equal((await save(failure)).themeId, 'lagoon');
  await failure.close();
  console.log('Themes: 5 catalog viewports, 8 real palettes, purchases/reload/repeat/failure and exact Back origins passed.');
}

