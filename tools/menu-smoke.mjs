import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export async function runMenuSmoke(browser, url, output) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const ready = () => page.locator('#app[data-ready=true]').waitFor();
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-lines.save.v1')));
  const pause = () => page.getByRole('button', { name: 'Пауза', exact: true }).click();
  const screen = name => page.locator(`#app[data-screen=${name}]`).waitFor();
  await page.goto(url); await ready();
  await page.locator('[data-action=menu-settings]').click();
  await page.getByRole('heading', { name: 'Настройки', exact: true }).waitFor();
  for (const action of ['sound', 'vibration', 'resume', 'sound']) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-action')), action, 'Focus cycles through visible settings controls');
  }
  await page.getByRole('button', { name: 'Звук: вкл', exact: true }).click();
  await page.keyboard.press('Escape');
  await screen('home');
  assert.equal(await page.getByRole('dialog').isVisible(), false);
  await page.locator('[data-action=continue]').click();
  await screen('game');
  // Keyboard input uses the same route model; leave a partial route for navigation checks.
  await page.locator('#board').focus(); await page.keyboard.press('ArrowRight');
  await pause();
  assert.deepEqual((await save()).path, [0, 1]);
  await page.getByRole('button', { name: 'ВЫБОР УРОВНЕЙ', exact: true }).click();
  await screen('sets');
  await page.locator('[data-action=open-set]:enabled').click();
  await screen('levels');
  assert.equal(await page.locator('.level-tile:enabled').count(), 1);
  await page.keyboard.press('Escape'); await screen('sets');
  await page.keyboard.press('Escape'); await screen('home');
  await page.keyboard.press('Escape'); await screen('home');
  await page.reload(); await ready();
  await page.locator('[data-action=continue]').click();
  assert.deepEqual((await save()).path, [0, 1], 'Menu/relaunch preserves partial route');
  await pause();
  assert.equal(await page.getByRole('button', { name: 'Звук: выкл', exact: true }).isVisible(), true);
  await page.keyboard.press('Escape');
  await page.locator('#board').focus(); await page.keyboard.press('ArrowRight');
  await page.locator('.result-heading:visible').waitFor();
  assert.equal((await save()).coins, 20);
  await page.getByRole('button', { name: 'Главное меню', exact: true }).click();
  await screen('home');
  assert.equal(await page.locator('.flying-coin').count(), 0);
  assert.equal(await page.locator('.celebration-layer').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some((v, i) => i % 4 === 3 && v > 0);
  }), false, 'Leaving a result clears all confetti');
  await page.locator('[data-action=sets]:visible').click();
  await page.locator('[data-action=open-set]:enabled').click();
  assert.equal(await page.locator('.level-tile:enabled').count(), 2);
  assert.equal(await page.locator('.level-tile.completed').count(), 1);
  await page.getByRole('button', { name: 'Уровень 2, доступен', exact: true }).click();
  await page.locator('#board').focus(); await page.keyboard.press('ArrowRight');
  await pause();
  const second = (await save()).path;
  assert(second.length > 1);
  await page.getByRole('button', { name: 'ВЫБОР УРОВНЕЙ', exact: true }).click();
  await page.locator('[data-action=open-set]:enabled').click();
  await page.getByRole('button', { name: 'Уровень 1, пройден, три звезды', exact: true }).click();
  assert.deepEqual((await save()).path, [0], 'Replay begins at start');
  assert.equal((await save()).coins, 20);
  await pause(); await page.getByRole('button', { name: 'ВЫБОР УРОВНЕЙ', exact: true }).click();
  await page.locator('[data-action=open-set]:enabled').click();
  await page.getByRole('button', { name: 'Уровень 2, доступен', exact: true }).click();
  assert.deepEqual((await save()).path, second, 'Other level draft survives switching/replay');
  await pause(); await page.getByRole('button', { name: 'ВЫБОР УРОВНЕЙ', exact: true }).click();
  await page.locator('[data-action=open-set]:enabled').click();
  await page.screenshot({ path: resolve(output, 'levels-progress.png') });
  // A failed disk write cannot activate a selected level or discard the last durable path.
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw Error('disk unavailable'); }; });
  await page.getByRole('button', { name: 'Уровень 1, пройден, три звезды', exact: true }).click();
  await screen('levels');
  assert.equal((await save()).levelId, 'intro-02');
  assert.deepEqual((await save()).path, second);
  await page.getByText('Не удалось сохранить прогресс.', { exact: true }).waitFor();
  await page.reload(); await ready();
  assert.deepEqual((await save()).path, second);
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Menu flow: route drafts, unlocks, repeats, settings, Back, failure/reload passed.');
}
