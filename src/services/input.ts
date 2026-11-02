import { crossedCells, touchesHead, type Point } from '../core/gesture';
import { advance, moveBlock, type MoveBlock, type Level } from '../core/model';
import type { BoardLayout } from '../ui/layout';
export interface InputState { level: Level; path: readonly number[]; layout: BoardLayout; blocked: boolean; }
/** Small accumulated thumb motion becomes orthogonal steps; no automatic turns. */
export function directionSteps(delta: Point, threshold: number): { steps: { x: number; y: number }[]; remainder: Point } {
  const horizontal = Math.abs(delta.x) >= Math.abs(delta.y), major = horizontal ? delta.x : delta.y;
  const count = Math.min(12, Math.floor(Math.abs(major) / threshold));
  if (!count) return { steps: [], remainder: delta };
  const sign = Math.sign(major);
  return { steps: Array.from({ length: count }, () => ({ x: horizontal ? sign : 0, y: horizontal ? 0 : sign })),
    remainder: count === 12 ? { x: 0, y: 0 } : { x: horizontal ? delta.x - sign * count * threshold : 0, y: horizontal ? 0 : delta.y - sign * count * threshold } };
}
export function installRouteInput(host: HTMLElement, read: () => InputState, change: (path: number[]) => void, end: () => void,
  reject: (cell: number, reason: MoveBlock) => void = () => {}, surface: HTMLElement = host): { cancel(): void; dispose(): void } {
  let pointer: number | null = null, previous: Point | null = null, relative = false, remainder = { x: 0, y: 0 };
  const point = (event: PointerEvent): Point => { const r = host.getBoundingClientRect(); return { x: event.clientX - r.x, y: event.clientY - r.y }; };
  const cancel = (): void => {
    const id = pointer; pointer = null; previous = null; remainder = { x: 0, y: 0 };
    if (id !== null) { if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id); end(); }
  };
  const down = (event: PointerEvent): void => {
    const s = read();
    if (s.blocked || pointer !== null || (event.pointerType === 'mouse' && event.button !== 0) ||
      (event.target as Element).closest('button,a,input,select,textarea,[role=dialog],#banner-slot')) return;
    const p = point(event);
    relative = !touchesHead(s.level, s.layout, s.path.at(-1)!, p);
    event.preventDefault(); pointer = event.pointerId; previous = p; remainder = { x: 0, y: 0 };
    surface.setPointerCapture(pointer); host.focus({ preventScroll: true });
  };
  const move = (event: PointerEvent): void => {
    if (event.pointerId !== pointer || !previous) return;
    const s = read(); if (s.blocked) { cancel(); return; }
    if (event.type === 'pointermove') event.preventDefault(); const p = point(event); let next = [...s.path];
    let rejection: { cell: number; reason: MoveBlock } | null = null;
    if (relative) {
      remainder = { x: remainder.x + p.x - previous.x, y: remainder.y + p.y - previous.y };
      const result = directionSteps(remainder, Math.max(22, Math.min(46, s.layout.cell * .7)));
      remainder = result.remainder;
      for (const step of result.steps) {
        const cell = next.at(-1)! + step.x + step.y * s.level.width, reason = moveBlock(s.level, next, cell), advanced = advance(s.level, next, cell);
        if (advanced.length === next.length) { if (reason) rejection = { cell, reason }; remainder = { x: 0, y: 0 }; break; }
        next = advanced;
      }
    } else {
      for (const cell of crossedCells(s.level, s.layout, previous, p)) {
        const reason = moveBlock(s.level, next, cell);
        if (reason && !rejection) rejection = { cell, reason };
        next = advance(s.level, next, cell);
      }
      const l = s.layout;
      // Handoff outside the figure: next movement steers relative to the finger,
      // with no jump or accumulated off-board distance on this event.
      if (p.x < l.x || p.y < l.y || p.x > l.x + l.width || p.y > l.y + l.height) relative = true;
    }
    previous = p;
    if (next.length !== s.path.length || next.some((c, i) => c !== s.path[i])) change(next);
    if (rejection) reject(rejection.cell, rejection.reason);
  };
  const up = (event: PointerEvent): void => { if (event.pointerId === pointer) { move(event); cancel(); } };
  const lost = (event: PointerEvent): void => { if (event.pointerId === pointer) cancel(); };
  const key = (event: KeyboardEvent): void => {
    const s = read(); if (s.blocked) return;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -s.level.width, ArrowDown: s.level.width }[event.key];
    if (delta === undefined) return;
    event.preventDefault(); const next = advance(s.level, s.path, s.path.at(-1)! + delta);
    if (next.length !== s.path.length) { change(next); end(); }
    else { const cell = s.path.at(-1)! + delta, reason = moveBlock(s.level, s.path, cell); if (reason) reject(cell, reason); }
  };
  surface.addEventListener('pointerdown', down); surface.addEventListener('pointermove', move); surface.addEventListener('pointerup', up);
  surface.addEventListener('pointercancel', lost); surface.addEventListener('lostpointercapture', lost); host.addEventListener('keydown', key);
  return { cancel, dispose() { cancel(); surface.removeEventListener('pointerdown', down); surface.removeEventListener('pointermove', move);
    surface.removeEventListener('pointerup', up); surface.removeEventListener('pointercancel', lost); surface.removeEventListener('lostpointercapture', lost); host.removeEventListener('keydown', key); } };
}
