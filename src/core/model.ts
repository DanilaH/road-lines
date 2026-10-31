export interface Level {
  id: string; version: number; width: number; height: number;
  cells: readonly number[]; start: number; witness: readonly number[];
  tag: string; origin: string;
  /** Optional rules; existing classic levels keep their IDs and versions. */
  finish?: number;
  walls?: readonly (readonly [number, number])[];
  /** Ordered cells, including the start as number 1. */
  checkpoints?: readonly number[];
}
export const adjacent = (level: Level, a: number, b: number): boolean =>
  Math.abs(a % level.width - b % level.width) + Math.abs(Math.floor(a / level.width) - Math.floor(b / level.width)) === 1;
export const canCross = (level: Level, a: number, b: number): boolean => adjacent(level, a, b) &&
  !(level.walls ?? []).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
export type MoveBlock = 'wall' | 'finish' | 'checkpoint';
/** Only explain a reachable new cell; gaps, old cells and distant taps aren't rule collisions. */
export function moveBlock(level: Level, path: readonly number[], cell: number): MoveBlock | null {
  const head = path[path.length - 1]!;
  if (!level.cells.includes(cell) || path.includes(cell) || !adjacent(level, head, cell)) return null;
  if (!canCross(level, head, cell)) return 'wall';
  if (cell === level.finish && path.length !== level.cells.length - 1) return 'finish';
  if (level.checkpoints?.includes(cell) && level.checkpoints.find(c => !path.includes(c)) !== cell) return 'checkpoint';
  return null;
}
export function canExtend(level: Level, path: readonly number[], cell: number): boolean {
  if (!level.cells.includes(cell) || path.includes(cell) || !canCross(level, path[path.length - 1]!, cell)) return false;
  if (cell === level.finish && path.length !== level.cells.length - 1) return false;
  return !level.checkpoints?.includes(cell) || level.checkpoints.find(c => !path.includes(c)) === cell;
}
export function validPath(level: Level, path: readonly number[]): boolean {
  return path.length > 0 && path[0] === level.start && level.cells.includes(level.start) &&
    path.every((cell, i) => Number.isInteger(cell) && (i === 0 || canExtend(level, path.slice(0, i), cell)));
}
export const complete = (level: Level, path: readonly number[]): boolean => path.length === level.cells.length &&
  (level.finish === undefined || path[path.length - 1] === level.finish) && validPath(level, path);
/** One legal edge or one reverse edge; no teleport to an older cell. */
export function advance(level: Level, path: readonly number[], cell: number): number[] {
  const last = path[path.length - 1]!;
  if (cell === last) return [...path];
  if (path.length > 1 && cell === path[path.length - 2]) return path.slice(0, -1);
  return canExtend(level, path, cell) ? [...path, cell] : [...path];
}
