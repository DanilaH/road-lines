import { crossedCells, touchesHead, type Point } from '../core/gesture';
import { advance, moveBlock, type MoveBlock, type Level } from '../core/model';
import type { BoardLayout } from '../ui/layout';
export interface InputState { level: Level; path: readonly number[]; layout: BoardLayout; blocked: boolean; }
export function installRouteInput(host: HTMLElement, read: () => InputState, change: (path: number[]) => void, end: () => void, reject: (cell: number, reason: MoveBlock) => void = () => {}): { cancel(): void; dispose(): void } {
  let pointer: number | null = null, previous: Point | null = null;
  const point = (event: PointerEvent): Point => { const r = host.getBoundingClientRect(); return { x: event.clientX - r.x, y: event.clientY - r.y }; };
  const cancel = (): void => {
    const id = pointer; pointer = null; previous = null;
    if (id !== null) { if (host.hasPointerCapture(id)) host.releasePointerCapture(id); end(); }
  };
  const down = (event: PointerEvent): void => {
    const s = read(); if (s.blocked || pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const p = point(event);
    if (!touchesHead(s.level, s.layout, s.path[s.path.length - 1]!, p)) return;
    event.preventDefault(); pointer = event.pointerId; previous = p; host.setPointerCapture(pointer); host.focus({ preventScroll: true });
  };
  const move = (event: PointerEvent): void => {
    if (event.pointerId !== pointer || !previous) return;
    const s = read(); if (s.blocked) { cancel(); return; }
    event.preventDefault(); const p = point(event); let next = [...s.path];
    let rejection: { cell: number; reason: MoveBlock } | null = null;
    for (const cell of crossedCells(s.level, s.layout, previous, p)) {
      const reason = moveBlock(s.level, next, cell);
      if (reason && !rejection) rejection = { cell, reason };
      next = advance(s.level, next, cell);
    }
    previous = p;
    if (next.length !== s.path.length || next.some((c, i) => c !== s.path[i])) change(next);
    if (rejection) reject(rejection.cell, rejection.reason);
    if (p.x < 0 || p.y < 0 || p.x > host.clientWidth || p.y > host.clientHeight) cancel();
  };
  const up = (event: PointerEvent): void => { if (event.pointerId === pointer) { move(event); cancel(); } };
  const lost = (event: PointerEvent): void => { if (event.pointerId === pointer) cancel(); };
  const key = (event: KeyboardEvent): void => {
    const s = read(); if (s.blocked) return;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -s.level.width, ArrowDown: s.level.width }[event.key];
    if (delta === undefined) return;
    event.preventDefault(); const next = advance(s.level, s.path, s.path[s.path.length - 1]! + delta);
    if (next.length !== s.path.length) { change(next); end(); }
    else { const cell = s.path[s.path.length - 1]! + delta, reason = moveBlock(s.level, s.path, cell); if (reason) reject(cell, reason); }
  };
  host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', lost); host.addEventListener('lostpointercapture', lost); host.addEventListener('keydown', key);
  return { cancel, dispose() { cancel(); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', lost); host.removeEventListener('lostpointercapture', lost); host.removeEventListener('keydown', key); } };
}
