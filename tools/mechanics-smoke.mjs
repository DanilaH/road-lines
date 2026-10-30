import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

export async function runMechanicsSmoke(browser, url, output, root) {
  const text = readFileSync(resolve(root, 'src/content/levels.ts'), 'utf8');
  const levels = JSON.parse(text.slice(text.indexOf('= ') + 2).trim().replace(/;$/, ''));
  const key = 'road-lines.save.v1';
  const open = async (id, width = 390, height = 844, themeId = 'classic') => {
    const level = levels.find(l => l.id === id), page = await browser.newPage({ viewport: { width, height } });
    await page.addInitScript(({ key, level, themeId }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 2, levelId: level.id, levelVersion: 1, path: [level.start], completed: [], coins: 0, hints: 3,
        themeId, ownedThemes: ['classic', 'mint', ...(themeId === 'classic' ? [] : [themeId])] }));
    }, { key, level, themeId });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await page.locator('#app[data-ready=true]').waitFor(); await page.locator('[data-action=continue]').click();
    const save = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
    const center = async cell => {
      const b = await page.locator('#board').boundingBox();
      const xs = level.cells.map(c => c % level.width), ys = level.cells.map(c => Math.floor(c / level.width));
      const columns = Math.max(...xs) - Math.min(...xs) + 1, rows = Math.max(...ys) - Math.min(...ys) + 1;
      const size = Math.min(56 * Math.min(b.width / 390, 1.5), (b.width - 40) / (columns + (columns - 1) / 7), (b.height - 64) / (rows + (rows - 1) / 7)), step = size * 8 / 7;
      return { x: b.x + (b.width - (columns - 1) * step - size) / 2 + (cell % level.width - Math.min(...xs)) * step + size / 2,
        y: b.y + (b.height - (rows - 1) * step - size) / 2 + (Math.floor(cell / level.width) - Math.min(...ys)) * step + size / 2 };
    };
    const drag = async route => {
      const first = await center(route[0]); await page.mouse.move(first.x, first.y); await page.mouse.down();
      for (const c of route.slice(1)) { const p = await center(c); await page.mouse.move(p.x, p.y); }
      await page.mouse.up();
    };
    return { page, level, save, drag, errors };
  };
  for (const id of ['finish-01', 'walls-01', 'checkpoints-01']) {
    const { page, save, drag, errors } = await open(id);
    if (id === 'finish-01') {
      await drag([0, 1, 2, 5, 8]); assert.deepEqual((await save()).path, [0, 1, 2, 5], 'Early finish is rejected without erasing progress');
      await drag([5, 2]); assert.deepEqual((await save()).path, [0, 1, 2]);
    } else if (id === 'walls-01') {
      await drag([0, 3, 6, 7, 8]); assert.deepEqual((await save()).path, [0, 3, 6, 7], 'A real pointer cannot cross a wall');
      await page.reload(); await page.locator('#app[data-ready=true]').waitFor(); await page.locator('[data-action=continue]').click();
      assert.deepEqual((await save()).path, [0, 3, 6, 7]);
      await page.getByRole('button', { name: 'Подсказка, осталось 3', exact: true }).click();
      await page.getByText('Бледная линия показывает продолжение.', { exact: true }).waitFor(); assert.equal((await save()).hints, 2);
    } else {
      await drag([0, 1, 2, 5, 8]); assert.deepEqual((await save()).path, [0, 1, 2, 5], 'Number 3 cannot be visited before number 2');
      await page.getByRole('button', { name: 'Начать заново', exact: true }).click();
      await drag([0, 1, 4]); await page.locator('.instruction').getByText(/следующая точка 3/).waitFor();
      await drag([4, 1]); await page.locator('.instruction').getByText(/следующая точка 2/).waitFor();
      assert.deepEqual((await save()).path, [0, 1]);
      await page.reload(); await page.locator('#app[data-ready=true]').waitFor(); await page.locator('[data-action=continue]').click();
      await page.locator('.instruction').getByText(/следующая точка 2/).waitFor();
      await page.getByRole('button', { name: 'Подсказка, осталось 3', exact: true }).click();
      await page.getByText('Бледная линия показывает продолжение.', { exact: true }).waitFor(); assert.equal((await save()).hints, 2);
    }
    await page.screenshot({ path: resolve(output, `mechanic-${id}-active.png`) });
    assert.deepEqual(errors, []); await page.close();
  }
  for (const [width, height] of [[320,568], [360,800], [390,844], [412,915], [576,1280]]) {
    for (const id of ['finish-05', 'walls-05', 'checkpoints-05']) {
      const { page, errors } = await open(id, width, height);
      await page.waitForTimeout(550);
      const instruction = await page.locator('.instruction').boundingBox(), banner = await page.locator('#banner-slot').boundingBox();
      assert(instruction && banner && instruction.y + instruction.height <= banner.y, 'Rule copy clears banner');
      await page.screenshot({ path: resolve(output, `mechanic-${id}-${width}x${height}.png`) });
      assert.deepEqual(errors, []); await page.close();
    }
  }
  for (const theme of ['dusk', 'neon']) {
    const { page, errors } = await open('checkpoints-04', 390, 844, theme);
    await page.waitForTimeout(550); await page.screenshot({ path: resolve(output, `mechanic-${theme}.png`) });
    assert.deepEqual(errors, []); await page.close();
  }
  console.log('Mechanics: real pointer rejection/undo, reload, worker hints, five viewports and dark themes passed.');
}
