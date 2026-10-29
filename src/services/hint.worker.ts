import { findHint } from '../core/solver';
import type { Level } from '../core/model';
self.onmessage = (event: MessageEvent<{ level: Level; path: number[] }>) => {
  self.postMessage(findHint(event.data.level, event.data.path));
};
