import { complete, validPath, type Level } from '../core/model';
import { levels } from '../content/levels';
import { themes, getTheme, defaultTheme, freeThemeIds } from '../content/themes';
import { initialRewards, giftReward, offerDue, validDate, wheelPrizes, type RewardState, type WheelSpin } from '../core/rewards';
export const SAVE_KEY = 'road-lines.save.v1';
export interface GameSave extends RewardState {
  version: 3; levelId: string; levelVersion: number; path: number[];
  completed: string[]; coins: number; hints: number;
  themeId: string; ownedThemes: string[];
  drafts: Record<string, { version: number; path: number[] }>;
}
export interface SyncStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export const defaultSave = (): GameSave => ({ ...initialRewards(), version: 3, levelId: levels[0]!.id, levelVersion: 1,
  path: [levels[0]!.start], completed: [], coins: 0, hints: 3, drafts: {}, themeId: defaultTheme.id, ownedThemes: [...freeThemeIds] });
export function decodeSave(raw: string): GameSave {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw Error('Invalid save');
  const d = data as Record<string, unknown>;
  if ((d.version !== 1 && d.version !== 2 && d.version !== 3) || !Array.isArray(d.completed) || d.completed.some(id => typeof id !== 'string' || !levels.some(l => l.id === id)) ||
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
  let rewards = initialRewards();
  if (d.version === 3) {
    const count = d.completed.length;
    if (!Number.isSafeInteger(d.giftMilestones) || (d.giftMilestones as number) < 0 || (d.giftMilestones as number) !== Math.floor(count / 20) ||
      (d.giftNotice !== null && (!Number.isSafeInteger(d.giftNotice) || (d.giftNotice as number) < 20 || (d.giftNotice as number) % 20 !== 0 || (d.giftNotice as number) > (d.giftMilestones as number) * 20)) ||
      !Number.isSafeInteger(d.lastOfferAt) || (d.lastOfferAt as number) < 0 || (d.lastOfferAt as number) > count) throw Error('Invalid reward progress');
    const o = d.offer as RewardState['offer'];
    if (o !== null && (!o || !themes.some(t => t.id === o.themeId && t.price > 0) || ownedThemes.includes(o.themeId) ||
      !d.completed.includes(o.levelId) || !Number.isSafeInteger(o.milestone) || o.milestone < 10 || o.milestone !== d.lastOfferAt)) throw Error('Invalid theme offer');
    const daily = d.daily as RewardState['daily'];
    const validSpin = (s: WheelSpin | null): boolean => s === null || Boolean(s && typeof s.id === 'string' && s.id.length > 0 && s.id.length <= 100 && validDate(s.date) && Number.isInteger(s.sector) && s.sector >= 0 && s.sector < wheelPrizes.length);
    if (!daily || (daily.lastDate !== null && !validDate(daily.lastDate)) || !validSpin(daily.pending) || !validSpin(daily.last) ||
      (daily.pending && daily.pending.date !== daily.lastDate) || (daily.last && (!daily.lastDate || daily.last.date > daily.lastDate)) ||
      (daily.pending && daily.last?.id === daily.pending.id) || (daily.lastDate !== null && !daily.pending && daily.last?.date !== daily.lastDate)) throw Error('Invalid wheel ledger');
    rewards = { giftMilestones: d.giftMilestones as number, giftNotice: d.giftNotice as number | null,
      lastOfferAt: d.lastOfferAt as number, offer: o && { ...o }, daily: { lastDate: daily.lastDate, pending: daily.pending && { ...daily.pending }, last: daily.last && { ...daily.last } } };
  }
  // Additive migration from stage-1 saves. Drafts are transient; wallet/progression stay strict.
  const drafts: GameSave['drafts'] = {};
  if (d.drafts && typeof d.drafts === 'object') for (const l of levels) {
    const draft = (d.drafts as Record<string, { version?: unknown; path?: unknown }>)[l.id];
    if (draft?.version === l.version && Array.isArray(draft.path) && validPath(l, draft.path)) {
      drafts[l.id] = { version: l.version, path: [...draft.path] };
    }
  }
  drafts[level.id] = { version: level.version, path: [...path] };
  return { ...rewards, version: 3, levelId: level.id, levelVersion: level.version, path: [...path],
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
  reload(): GameSave {
    const raw = this.storage.getItem(SAVE_KEY);
    if (!this.recoveryRequired && raw !== this.baseline) throw Error('Save changed in another writer');
    const state = raw === null ? defaultSave() : decodeSave(raw);
    this.state = state; this.baseline = raw; this.recoveryRequired = false; return state;
  }
  stageSpin(spin: WheelSpin): void {
    if (this.state.daily.pending) throw Error('Spin already pending');
    if (!validDate(spin.date) || (this.state.daily.lastDate && spin.date <= this.state.daily.lastDate)) throw Error('Daily spin unavailable');
    this.write({ ...this.state, daily: { ...this.state.daily, lastDate: spin.date, pending: spin } });
  }
  commitSpin(id: string): void {
    const spin = this.state.daily.pending;
    if (!spin) { if (this.state.daily.last?.id === id) return; throw Error('Unknown spin'); }
    if (spin.id !== id) throw Error('Stale spin');
    this.write({ ...this.state, coins: this.state.coins + wheelPrizes[spin.sector]!, daily: { ...this.state.daily, pending: null, last: spin } });
  }
  dismissOffer(): void { if (this.state.offer) this.write({ ...this.state, offer: null }); }
  acknowledgeGift(): void { if (this.state.giftNotice) this.write({ ...this.state, giftNotice: null }); }
  path(level: Level, path: readonly number[]): void {
    if (!validPath(level, path)) throw Error('Illegal prefix');
    this.write({ ...this.state, levelId: level.id, levelVersion: level.version, path: [...path],
      offer: level.id !== this.state.levelId || !complete(level, path) ? null : this.state.offer });
  }
  selectTheme(id: string): 'unchanged' | 'equipped' | 'purchased' | 'insufficient' {
    const theme = getTheme(id), owned = this.state.ownedThemes.includes(id);
    if (owned && this.state.themeId === id) return 'unchanged';
    if (!owned && this.state.coins < theme.price) return 'insufficient';
    // Coins, ownership and equipment become durable in one atomic replacement.
    this.write({ ...this.state, coins: this.state.coins - (owned ? 0 : theme.price), themeId: id,
      ownedThemes: owned ? this.state.ownedThemes : [...this.state.ownedThemes, id],
      offer: this.state.offer?.themeId === id ? null : this.state.offer });
    return owned ? 'equipped' : 'purchased';
  }
  finish(level: Level, path: readonly number[]): number {
    if (!complete(level, path)) throw Error('Incomplete level');
    const first = !this.state.completed.includes(level.id);
    const count = this.state.completed.length + (first ? 1 : 0), gift = giftReward(count, this.state.giftMilestones);
    const offered = first && offerDue(count, this.state.lastOfferAt) ? themes.find(t => !this.state.ownedThemes.includes(t.id)) : undefined;
    this.write({ ...this.state, levelId: level.id, levelVersion: level.version, path: [...path],
      giftMilestones: gift.milestones, giftNotice: gift.coins ? gift.milestones * 20 : this.state.giftNotice,
      lastOfferAt: offered ? count : this.state.lastOfferAt,
      offer: offered ? { themeId: offered.id, levelId: level.id, milestone: count } : this.state.offer,
      completed: first ? [...this.state.completed, level.id] : this.state.completed, coins: this.state.coins + (first ? 20 : 0) + gift.coins });
    return first ? 20 : 0;
  }
}
