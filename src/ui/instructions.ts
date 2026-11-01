import { copy } from '../i18n';
import type { Level } from '../core/model';
/** Session-only coaching. No mandatory gestures, save fields, timers or gates. */
export interface GestureCoach { released: boolean; backtracked: boolean; }
export function instruction(level: Level, path: readonly number[], completed: readonly string[], coach: GestureCoach): string {
  const next = level.checkpoints?.findIndex(c => !path.includes(c)) ?? -1;
  const goal = level.checkpoints?.length ? next < 0 ? copy.pointsDone : copy.nextPoint(next + 1) : level.finish !== undefined ? copy.finishLast : level.walls?.length ? copy.avoidWalls : '';
  if (goal) return path.length === 1 ? goal : copy.focusAndContinue(goal);
  if (!completed.includes(level.id)) {
    if (level.id === 'intro-01') return path.length === 1 ? copy.start : copy.fill;
    if (level.id === 'intro-02') return coach.released && path.length > 1 ? copy.resumeTip : copy.releaseTip;
    if (level.id === 'intro-03') return coach.backtracked ? copy.undoDone : path.length === 1 ? copy.undoStart : copy.undoTip;
  }
  return path.length === 1 ? copy.start : copy.continueHead;
}
