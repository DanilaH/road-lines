import { levels } from '../content/levels';

export const levelSets = [
  { id: 'intro', title: 'Первые линии', description: 'От простого жеста к первым развилкам', color: '#55b975', levels },
  { id: 'turns', title: 'Повороты', description: 'Набор готовится', color: '#45b7bf', levels: [] },
  { id: 'shapes', title: 'Сложные фигуры', description: 'Набор готовится', color: '#a183ce', levels: [] },
] as const;

export function isLevelAvailable(id: string, completed: readonly string[]): boolean {
  const set = levelSets.find(s => s.levels.some(l => l.id === id));
  if (!set) return false;
  if (set.id !== 'intro' && !levels.slice(0, 3).every(l => completed.includes(l.id))) return false;
  const index = set.levels.findIndex(l => l.id === id);
  return completed.includes(id) || set.levels.slice(0, index).every(l => completed.includes(l.id));
}
