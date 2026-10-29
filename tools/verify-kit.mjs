import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = resolve(root, 'vendor/mini-games-kit');
const manifest = JSON.parse(readFileSync(resolve(base, 'manifest.json'), 'utf8'));
const hashBlob = (bytes) => createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
let exact = 0;
for (const entry of manifest.files) {
  const path = resolve(base, entry.path);
  if (!path.startsWith(base + '/')) throw Error('Unsafe manifest path');
  const bytes = readFileSync(path);
  if (createHash('sha256').update(bytes).digest('hex') !== entry.local_sha256)
    throw Error('Snapshot content changed without provenance update: ' + entry.path);
  if (entry.origin !== 'local' && entry.changes.length === 0) {
    if (hashBlob(bytes) !== entry.upstream_blob_sha) throw Error('Vendor drift: ' + entry.path);
    exact++;
  }
}
const tracked = new Set(manifest.files.map(e => e.path));
function walk(dir, prefix = '') {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.isDirectory()) walk(resolve(dir, item.name), relative + '/');
    else if (!['README.md', 'manifest.json'].includes(relative) && !tracked.has(relative))
      throw Error('Unrecorded vendor file: ' + relative);
  }
}
walk(base);
console.log('Kit manifest OK: ' + manifest.files.length + ' files; ' + exact + ' unchanged upstream blobs.');
