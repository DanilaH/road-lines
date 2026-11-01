import { levels } from '../content/levels';

export const levelSets = [
  { id: 'intro', color: '#55b975', levels: levels.slice(0, 30),
    chapters: [{ at: 15, key: 'finish' }, { at: 20, key: 'walls' }, { at: 25, key: 'checkpoints' }] },
  { id: 'turns', color: '#45b7bf', levels: levels.slice(30, 60),
    chapters: [{ at: 0, key: 'newShapes' }, { at: 5, key: 'preciseFinish' }, { at: 10, key: 'detours' }, { at: 15, key: 'checkpoints' }, { at: 20, key: 'finishWalls' }, { at: 25, key: 'pointsWalls' }] },
  { id: 'shapes', color: '#a183ce', levels: levels.slice(60, 90),
    chapters: [{ at: 0, key: 'branches' }, { at: 5, key: 'longDetour' }, { at: 10, key: 'pointsFinish' }, { at: 15, key: 'toFinish' }, { at: 20, key: 'routeOrder' }, { at: 25, key: 'allRules' }] },
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
