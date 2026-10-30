export const wheelPrizes = [20, 30, 50, 75, 100, 150, 200, 300] as const;
export interface WheelSpin { id: string; date: string; sector: number; }
export interface ThemeOffer { themeId: string; levelId: string; milestone: number; }
export interface RewardState {
  giftMilestones: number; giftNotice: number | null; lastOfferAt: number; offer: ThemeOffer | null;
  daily: { lastDate: string | null; pending: WheelSpin | null; last: WheelSpin | null };
}
export const initialRewards = (): RewardState => ({ giftMilestones: 0, giftNotice: null, lastOfferAt: 0, offer: null, daily: { lastDate: null, pending: null, last: null } });
export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function canSpin(state: RewardState, date = localDate()): boolean {
  return validDate(date) && state.daily.pending === null && (state.daily.lastDate === null || date > state.daily.lastDate);
}
export function giftReward(completed: number, granted: number): { milestones: number; coins: number } {
  const milestones = Math.floor(completed / 20);
  if (!Number.isSafeInteger(completed) || completed < 0 || !Number.isSafeInteger(granted) || granted < 0 || granted > milestones) throw Error('Invalid gift progress');
  return { milestones, coins: (milestones - granted) * 100 };
}
export const offerDue = (completed: number, last: number): boolean => completed >= 10 && (last === 0 || completed - last >= 20);
export const wheelAngle = (sector: number): number => 2160 + (360 - sector * 45) % 360;
