export interface Level {
  id: string; version: number; width: number; height: number;
  cells: readonly number[]; start: number; witness: readonly number[];
  tag: string; origin: string;
}
export const adjacent = (level: Level, a: number, b: number): boolean =>
  Math.abs(a % level.width - b % level.width) + Math.abs(Math.floor(a / level.width) - Math.floor(b / level.width)) === 1;
export function validPath(level: Level, path: readonly number[]): boolean {
  return path.length > 0 && path[0] === level.start && new Set(path).size === path.length &&
    path.every((cell, i) => Number.isInteger(cell) && level.cells.includes(cell) && (i === 0 || adjacent(level, path[i - 1]!, cell)));
}
export const complete = (level: Level, path: readonly number[]): boolean => path.length === level.cells.length && validPath(level, path);
/** One legal edge or one reverse edge; no teleport to an older cell. */
export function advance(level: Level, path: readonly number[], cell: number): number[] {
  const last = path[path.length - 1]!;
  if (cell === last || !level.cells.includes(cell) || !adjacent(level, last, cell)) return [...path];
  if (path.length > 1 && cell === path[path.length - 2]) return path.slice(0, -1);
  return path.includes(cell) ? [...path] : [...path, cell];
}
