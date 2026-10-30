import { levels } from '../content/levels';

export const levelSets = [
  { id: 'intro', title: 'Первые линии', description: 'Финиш, стенки и порядок точек', color: '#55b975', levels: levels.slice(0, 30),
    chapters: [{ at: 15, title: 'Финиш' }, { at: 20, title: 'Стенки' }, { at: 25, title: 'Порядок точек' }] },
  { id: 'turns', title: 'Повороты', description: 'Новые фигуры и сочетания правил', color: '#45b7bf', levels: levels.slice(30, 60),
    chapters: [{ at: 0, title: 'Новые фигуры' }, { at: 5, title: 'Точный финиш' }, { at: 10, title: 'Обходы' }, { at: 15, title: 'Порядок точек' }, { at: 20, title: 'Финиш и стенки' }, { at: 25, title: 'Точки и стенки' }] },
  { id: 'shapes', title: 'Сложные фигуры', description: 'Большие поля и маршруты с ограничениями', color: '#a183ce', levels: levels.slice(60, 90),
    chapters: [{ at: 0, title: 'Развилки' }, { at: 5, title: 'Дальний обход' }, { at: 10, title: 'Точки и финиш' }, { at: 15, title: 'Путь к флажку' }, { at: 20, title: 'Порядок обхода' }, { at: 25, title: 'Все правила вместе' }] },
] as const;
export type SetId = typeof levelSets[number]['id'];
export const getLevelSet = (id: string) => levelSets.find(s => s.levels.some(l => l.id === id))!;
export const isSetAvailable = (id: string, completed: readonly string[]): boolean =>
  levelSets.some(s => s.id === id) && (id === 'intro' || levels.slice(0, 3).every(l => completed.includes(l.id)));
export const levelLabel = (id: string): string => {
  const set = getLevelSet(id);
  return `${levelSets.indexOf(set) + 1}–${set.levels.findIndex(l => l.id === id) + 1}`;
};
export const nextInSet = (id: string) => {
  const set = getLevelSet(id);
  return set.levels[set.levels.findIndex(l => l.id === id) + 1];
};
export function isLevelAvailable(id: string, completed: readonly string[]): boolean {
  const set = getLevelSet(id);
  if (!set) return false;
  if (completed.includes(id)) return true;
  if (!isSetAvailable(set.id, completed)) return false;
  const index = set.levels.findIndex(l => l.id === id);
  return set.levels.slice(0, index).every(l => completed.includes(l.id));
}
