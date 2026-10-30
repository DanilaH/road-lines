import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const text = readFileSync(new URL('../src/content/levels.ts', import.meta.url), 'utf8');
const catalog = JSON.parse(text.slice(text.indexOf('= ') + 2).trim().replace(/;$/, ''));
assert.equal(catalog.length, 90);
const authorAudit = JSON.parse(readFileSync(new URL('../docs/BANK_CONTENT_AUDIT.json', import.meta.url), 'utf8'));
assert.equal(authorAudit.levels.length, 60);
assert.equal(createHash('sha256').update(JSON.stringify(catalog.slice(0, 30))).digest('hex'), authorAudit.legacy30Sha256, 'Existing 30 records changed');
const ids = new Set(), puzzles = new Set(), classicShapes = new Set(), newMasks = new Set(), audit = [];
// Deliberately independent of the game model and solver.
for (const l of catalog) {
  assert(!ids.has(l.id)); ids.add(l.id);
  assert(Number.isInteger(l.version) && l.version > 0);
  assert(Number.isInteger(l.width) && l.width > 0 && Number.isInteger(l.height) && l.height > 0);
  const available = new Set(l.cells), adjacent = (a, b) => Math.abs(a % l.width - b % l.width) + Math.abs(Math.floor(a / l.width) - Math.floor(b / l.width)) === 1;
  assert.equal(available.size, l.cells.length);
  for (const c of l.cells) assert(Number.isInteger(c) && c >= 0 && c < l.width * l.height);
  assert(available.has(l.start));
  if (l.finish !== undefined) assert(available.has(l.finish) && l.finish !== l.start);
  const wallKeys = new Set();
  for (const edge of l.walls ?? []) {
    assert(Array.isArray(edge) && edge.length === 2);
    const [a, b] = edge; assert(available.has(a) && available.has(b) && adjacent(a, b));
    const key = [a, b].sort((x, y) => x - y).join(','); assert(!wallKeys.has(key)); wallKeys.add(key);
  }
  const checkpoints = l.checkpoints ?? [];
  if (l.checkpoints) {
    assert(checkpoints.length >= 2 && checkpoints[0] === l.start);
    assert.equal(new Set(checkpoints).size, checkpoints.length);
    assert(checkpoints.every(c => available.has(c)));
  }
  assert.equal(l.witness[0], l.start); assert.equal(l.witness.length, l.cells.length);
  assert.equal(new Set(l.witness).size, l.cells.length);
  assert(l.witness.every(c => available.has(c)));
  for (let i = 1; i < l.witness.length; i++) {
    const a = l.witness[i - 1], b = l.witness[i]; assert(adjacent(a, b));
    assert(!wallKeys.has([a, b].sort((x, y) => x - y).join(',')), l.id + ' witness crosses wall');
  }
  if (l.finish !== undefined) assert.equal(l.witness.at(-1), l.finish);
  const positions = checkpoints.map(c => l.witness.indexOf(c));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  const variants = [], shapeVariants = [];
  for (const flip of [-1, 1]) for (let r = 0; r < 4; r++) {
    const coords = l.cells.map(c => {
      let x = c % l.width * flip, y = Math.floor(c / l.width);
      for (let k = 0; k < r; k++) [x, y] = [-y, x];
      return [x, y];
    });
    const minX = Math.min(...coords.map(c => c[0])), minY = Math.min(...coords.map(c => c[1]));
    const point = c => { const [x, y] = coords[l.cells.indexOf(c)]; return `${x - minX},${y - minY}`; };
    const shape = l.cells.map(point).sort().join(';'); shapeVariants.push(shape);
    variants.push(JSON.stringify([shape, point(l.start), l.finish === undefined ? null : point(l.finish),
      (l.walls ?? []).map(e => e.map(point).sort().join('|')).sort(), checkpoints.map(point)]));
  }
  const canonical = variants.sort()[0]; assert(!puzzles.has(canonical), 'Rotated/reflected duplicate rules: ' + l.id); puzzles.add(canonical);
  if (catalog.indexOf(l) < 30) newMasks.add(shapeVariants.sort()[0]);
  if (l.finish === undefined && !l.walls?.length && !checkpoints.length) {
    const shape = shapeVariants.sort()[0]; assert(!classicShapes.has(shape), 'Duplicate classic shape: ' + l.id); classicShapes.add(shape);
  }
  // Enumerate all geometric routes to prove each new rule actually removes solutions.
  if (catalog.indexOf(l) < 30 && (l.tag === 'finish' || l.tag === 'walls' || l.tag === 'checkpoints')) {
    let classic = 0, constrained = 0;
    const route = [l.start], used = new Set(route);
    const visit = head => {
      if (route.length === l.cells.length) {
        classic++;
        if (l.finish !== undefined && head !== l.finish) return;
        if (route.slice(1).some((c, i) => wallKeys.has([route[i], c].sort((a, b) => a - b).join(',')))) return;
        const order = checkpoints.map(c => route.indexOf(c));
        if (order.some((v, i) => i && v < order[i - 1])) return;
        constrained++; return;
      }
      for (const c of l.cells) if (!used.has(c) && adjacent(head, c)) {
        route.push(c); used.add(c); visit(c); used.delete(c); route.pop();
      }
    };
    visit(l.start); assert(constrained > 0 && constrained < classic, 'Decorative or unsolvable rules: ' + l.id);
    audit.push({ id: l.id, cells: l.cells.length, classicSolutions: classic, ruleSolutions: constrained });
  }
  if (catalog.indexOf(l) >= 30) {
    const record = authorAudit.levels.find(a => a.id === l.id); assert(record, 'Missing author audit: ' + l.id);
    const geometric = route => route.length === l.cells.length && route[0] === l.start && new Set(route).size === route.length &&
      route.every((c, i) => available.has(c) && (i === 0 || adjacent(route[i - 1], c)));
    const legal = (route, omit) => {
      if (omit !== 'finish' && l.finish !== undefined && route.at(-1) !== l.finish) return false;
      if (omit !== 'walls' && route.slice(1).some((c, i) => wallKeys.has([route[i], c].sort((a, b) => a - b).join(',')))) return false;
      const order = checkpoints.map(c => route.indexOf(c));
      return omit === 'checkpoints' || order.every((v, i) => !i || v > order[i - 1]);
    };
    const rules = ['finish', 'walls', 'checkpoints'].filter(k => l[k] !== undefined);
    assert.deepEqual(Object.keys(record.counterexamples).sort(), [...rules].sort());
    for (const rule of rules) {
      const route = record.counterexamples[rule];
      assert(geometric(route) && legal(route, rule) && !legal(route), 'Rule has no independent effect: ' + l.id + '/' + rule);
    }
    // Every added silhouette must differ from every other mask, including the old bank.
    const shape = shapeVariants.sort()[0];
    assert(!newMasks.has(shape), 'Repeated new silhouette: ' + l.id); newMasks.add(shape);
    audit.push({ id: l.id, cells: l.cells.length, rules: rules.join('+') || 'classic', branches: record.branches });
  }
}
console.log('Content audit: 90 distinct rule layouts; original 30 records unchanged; 60 new silhouettes unique under eight symmetries; witnesses and each rule contribution independently checked.');
console.table(audit);
