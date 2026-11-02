/** Activate the thumb dock on a completed touch, including immediately after a swipe.
 * Some WebViews suppress the compatibility click following a captured gesture.
 * Mouse, keyboard and assistive clicks keep native button activation.
 */
export function installThumbControls(root: HTMLElement): () => void {
  let press: { button: HTMLButtonElement; id: number; x: number; y: number; moved: boolean } | null = null;
  let ended: { button: HTMLButtonElement; at: number } | null = null;
  const buttonAt = (target: EventTarget | null) => target instanceof Element
    ? target.closest<HTMLButtonElement>('.play-controls button') : null;
  const down = (event: PointerEvent): void => {
    if (!event.isPrimary || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
    const button = buttonAt(event.target);
    if (button && !button.disabled) press = { button, id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  };
  const move = (event: PointerEvent): void => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) press.moved = true;
  };
  const up = (event: PointerEvent): void => {
    if (!press || event.pointerId !== press.id) return;
    const saved = press; press = null; ended = { button: saved.button, at: event.timeStamp };
    const hit = buttonAt(document.elementFromPoint(event.clientX, event.clientY));
    if (event.type === 'pointerup' && !saved.moved && hit === saved.button && !saved.button.disabled) saved.button.click();
  };
  const click = (event: MouseEvent): void => {
    // The programmatic activation above has detail=0, as do keyboard/AT clicks.
    // Consume only the subsequent compatibility click, never a second real tap.
    if (event.detail > 0 && ended?.button === buttonAt(event.target) && event.timeStamp - ended.at < 800 &&
      (!('pointerType' in event) || (event as PointerEvent).pointerType !== 'mouse')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  root.addEventListener('pointerdown', down, true); root.addEventListener('pointermove', move, true);
  root.addEventListener('pointerup', up, true); root.addEventListener('pointercancel', up, true);
  root.addEventListener('click', click, true);
  return () => {
    press = null; ended = null;
    root.removeEventListener('pointerdown', down, true); root.removeEventListener('pointermove', move, true);
    root.removeEventListener('pointerup', up, true); root.removeEventListener('pointercancel', up, true);
    root.removeEventListener('click', click, true);
  };
}
