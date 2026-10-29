import type { Level } from '../core/model';
import type { HintResult } from '../core/solver';
/** Worker per request: terminating also cancels a currently executing search. */
export class HintService {
  private cancelCurrent?: () => void;
  cancel(): void { this.cancelCurrent?.(); }
  request(level: Level, path: readonly number[]): Promise<HintResult | null> {
    this.cancel();
    return new Promise(resolve => {
      let worker: Worker;
      try { worker = new Worker(new URL('./hint.worker.ts', import.meta.url), { type: 'module' }); }
      catch { resolve({ kind: 'UNKNOWN' }); return; }
      let settled = false;
      const done = (value: HintResult | null): void => {
        if (settled) return;
        settled = true; clearTimeout(timer); worker.terminate(); this.cancelCurrent = undefined; resolve(value);
      };
      const timer = setTimeout(() => done({ kind: 'UNKNOWN' }), 1500);
      this.cancelCurrent = () => done(null);
      worker.onmessage = (event: MessageEvent<HintResult>) => done(event.data);
      worker.onerror = event => { event.preventDefault(); done({ kind: 'UNKNOWN' }); };
      worker.postMessage({ level, path: [...path] });
    });
  }
}
