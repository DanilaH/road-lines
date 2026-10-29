import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const text = readFileSync(new URL('../src/content/levels.ts', import.meta.url), 'utf8');
const catalog = JSON.parse(text.slice(text.indexOf('= ') + 2).trim().replace(/;$/, ''));
assert.equal(catalog.length, 15);
const ids = new Set(), shapes = new Set();
for (const l of catalog) {
  assert(!ids.has(l.id)); ids.add(l.id);
  assert(Number.isInteger(l.width) && l.width > 0 && Number.isInteger(l.height) && l.height > 0);
  const available = new Set(l.cells);
  assert.equal(available.size, l.cells.length);
  for (const c of l.cells) assert(Number.isInteger(c) && c >= 0 && c < l.width * l.height);
  assert.equal(l.witness[0], l.start); assert.equal(l.witness.length, l.cells.length);
  const used = new Set();
  for (let i = 0; i < l.witness.length; i++) {
    const c = l.witness[i]; assert(available.has(c) && !used.has(c)); used.add(c);
    if (i) { const p = l.witness[i - 1]; assert.equal(Math.abs(p % l.width - c % l.width) + Math.abs(Math.floor(p / l.width) - Math.floor(c / l.width)), 1); }
  }
  const variants = [];
  for (const flip of [-1, 1]) for (let r = 0; r < 4; r++) {
    const coords = l.cells.map(c => {
      let x = c % l.width * flip, y = Math.floor(c / l.width);
      for (let k = 0; k < r; k++) [x, y] = [-y, x];
      return [x, y];
    });
    const minX = Math.min(...coords.map(c => c[0])), minY = Math.min(...coords.map(c => c[1]));
    variants.push(coords.map(([x, y]) => `${x - minX},${y - minY}`).sort().join(';'));
  }
  const canonical = variants.sort()[0]; assert(!shapes.has(canonical), 'Rotated/reflected duplicate: ' + l.id); shapes.add(canonical);
}
console.log('Content audit: 15 distinct shapes, 15 independently checked complete witnesses, all IDs/bounds valid.');
