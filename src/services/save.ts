import { complete, validPath, type Level } from '../core/model';
import { levels } from '../content/levels';
import { themes, getTheme, defaultTheme, freeThemeIds } from '../content/themes';
export const SAVE_KEY = 'road-lines.save.v1';
export interface GameSave {
  version: 2; levelId: string; levelVersion: number; path: number[];
  completed: string[]; coins: number; hints: number;
  themeId: string; ownedThemes: string[];
  drafts: Record<string, { version: number; path: number[] }>;
}
export interface SyncStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export const defaultSave = (): GameSave => ({ version: 2, levelId: levels[0]!.id, levelVersion: 1,
  path: [levels[0]!.start], completed: [], coins: 0, hints: 3, drafts: {}, themeId: defaultTheme.id, ownedThemes: [...freeThemeIds] });
export function decodeSave(raw: string): GameSave {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw Error('Invalid save');
  const d = data as Record<string, unknown>;
  if ((d.version !== 1 && d.version !== 2) || !Array.isArray(d.completed) || d.completed.some(id => typeof id !== 'string' || !levels.some(l => l.id === id)) ||
    new Set(d.completed).size !== d.completed.length || !Number.isSafeInteger(d.coins) || (d.coins as number) < 0 ||
    !Number.isSafeInteger(d.hints) || (d.hints as number) < 0) throw Error('Invalid progression');
  const level = levels.find(l => l.id === d.levelId);
  if (!level) throw Error('Unknown current level');
  const path = d.levelVersion === level.version && Array.isArray(d.path) && validPath(level, d.path) ? d.path as number[] : [level.start];
  const legacyThemes = d.version === 1 && d.themeId === undefined && d.ownedThemes === undefined;
  const ownedThemes = legacyThemes ? [...freeThemeIds] : d.ownedThemes;
  const themeId = legacyThemes ? defaultTheme.id : d.themeId;
  if (!Array.isArray(ownedThemes) || ownedThemes.some(id => typeof id !== 'string' || !themes.some(t => t.id === id)) ||
    new Set(ownedThemes).size !== ownedThemes.length || !freeThemeIds.every(id => ownedThemes.includes(id)) ||
    typeof themeId !== 'string' || !ownedThemes.includes(themeId)) throw Error('Invalid theme ownership');
  // Additive migration from stage-1 saves. Drafts are transient; wallet/progression stay strict.
  const drafts: GameSave['drafts'] = {};
  if (d.drafts && typeof d.drafts === 'object') for (const l of levels) {
    const draft = (d.drafts as Record<string, { version?: unknown; path?: unknown }>)[l.id];
    if (draft?.version === l.version && Array.isArray(draft.path) && validPath(l, draft.path)) {
      drafts[l.id] = { version: l.version, path: [...draft.path] };
    }
  }
  drafts[level.id] = { version: level.version, path: [...path] };
  return { version: 2, levelId: level.id, levelVersion: level.version, path: [...path],
    completed: [...d.completed] as string[], coins: d.coins as number, hints: d.hints as number, drafts, themeId, ownedThemes: [...ownedThemes] };
}
/** One synchronous document writer. Memory follows confirmed atomic replacement. */
export class GameStore {
  state: GameSave;
  recoveryRequired = false;
  private baseline: string | null;
  constructor(private storage: SyncStorage) {
    const raw = storage.getItem(SAVE_KEY); this.baseline = raw;
    this.state = raw === null ? defaultSave() : decodeSave(raw);
  }
  write(next: GameSave): void {
    if (this.recoveryRequired) throw Error('Authoritative reload required');
    if (this.storage.getItem(SAVE_KEY) !== this.baseline) { this.recoveryRequired = true; throw Error('Save changed in another writer'); }
    const snapshot = decodeSave(JSON.stringify(next)), raw = JSON.stringify(snapshot);
    try { this.storage.setItem(SAVE_KEY, raw); }
    catch (error) {
      try { if (this.storage.getItem(SAVE_KEY) !== raw) throw error; }
      catch { this.recoveryRequired = true; throw error; }
    }
    this.state = snapshot; this.baseline = raw;
  }
  path(level: Level, path: readonly number[]): void {
    if (!validPath(level, path)) throw Error('Illegal prefix');
    this.write({ ...this.state, levelId: level.id, levelVersion: level.version, path: [...path] });
  }
  selectTheme(id: string): 'unchanged' | 'equipped' | 'purchased' | 'insufficient' {
    const theme = getTheme(id), owned = this.state.ownedThemes.includes(id);
    if (owned && this.state.themeId === id) return 'unchanged';
    if (!owned && this.state.coins < theme.price) return 'insufficient';
    // Coins, ownership and equipment become durable in one atomic replacement.
    this.write({ ...this.state, coins: this.state.coins - (owned ? 0 : theme.price), themeId: id,
      ownedThemes: owned ? this.state.ownedThemes : [...this.state.ownedThemes, id] });
    return owned ? 'equipped' : 'purchased';
  }
  finish(level: Level, path: readonly number[]): number {
    if (!complete(level, path)) throw Error('Incomplete level');
    const first = !this.state.completed.includes(level.id);
    this.write({ ...this.state, levelId: level.id, levelVersion: level.version, path: [...path],
      completed: first ? [...this.state.completed, level.id] : this.state.completed, coins: this.state.coins + (first ? 20 : 0) });
    return first ? 20 : 0;
  }
}
