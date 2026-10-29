import { adjacent, validPath, type Level } from './model';
export type SolveResult = { kind: 'FOUND'; path: number[] } | { kind: 'UNSOLVABLE' } | { kind: 'UNKNOWN' };
export interface SolveOptions { budgetMs?: number; maxNodes?: number; now?: () => number; }
export function solve(level: Level, prefix: readonly number[], options: SolveOptions = {}): SolveResult {
  if (!validPath(level, prefix)) return { kind: 'UNSOLVABLE' };
  const now = options.now ?? (() => performance.now());
  const deadline = now() + (options.budgetMs ?? 180), maxNodes = options.maxNodes ?? 100_000;
  const neighbors = new Map(level.cells.map(cell => [cell, level.cells.filter(other => adjacent(level, cell, other))]));
  const path = [...prefix], used = new Set(path);
  let nodes = 0, exhausted = false;
  const search = (head: number): boolean => {
    if (++nodes > maxNodes || now() >= deadline) { exhausted = true; return false; }
    if (path.length === level.cells.length) return true;
    const reachable = new Set([head]), queue = [head];
    for (const cell of queue) for (const next of neighbors.get(cell)!) {
      if ((!used.has(next) || next === head) && !reachable.has(next)) { reachable.add(next); queue.push(next); }
    }
    if (reachable.size !== level.cells.length - used.size + 1) return false;
    let leaves = 0;
    for (const cell of reachable) if (cell !== head) {
      const degree = neighbors.get(cell)!.filter(n => reachable.has(n)).length;
      if (degree === 0 || (degree === 1 && ++leaves > 1)) return false;
    }
    const candidates = neighbors.get(head)!.filter(n => !used.has(n));
    candidates.sort((a, b) => neighbors.get(a)!.filter(n => !used.has(n)).length - neighbors.get(b)!.filter(n => !used.has(n)).length);
    for (const cell of candidates) {
      used.add(cell); path.push(cell);
      if (search(cell)) return true;
      path.pop(); used.delete(cell);
      if (exhausted) return false;
    }
    return false;
  };
  return search(path[path.length - 1]!) ? { kind: 'FOUND', path: [...path] } : { kind: exhausted ? 'UNKNOWN' : 'UNSOLVABLE' };
}
export type HintResult = SolveResult & { rollbackLength?: number };
export function findHint(level: Level, prefix: readonly number[], budgetMs = 200): HintResult {
  const started = performance.now();
  const result = solve(level, prefix, { budgetMs: budgetMs * 0.8 });
  if (result.kind !== 'UNSOLVABLE') return result;
  for (let length = prefix.length - 1; length >= 1; length--) {
    const remaining = budgetMs - (performance.now() - started);
    if (remaining <= 0) break;
    const candidate = solve(level, prefix.slice(0, length), { budgetMs: remaining });
    if (candidate.kind === 'FOUND') return { kind: 'UNSOLVABLE', rollbackLength: length };
    if (candidate.kind === 'UNKNOWN') break;
  }
  return result;
}
