import { describe, it, expect } from 'vitest';
import { cueNotes, CueGate, Feedback } from '../src/presentation/feedback';
import { victoryLayout } from '../src/presentation/geometry';
import { boardLayout } from '../src/ui/layout';

describe('presentation limits', () => {
  it('expands the complete figure before settling exactly at the miniature', () => {
    const from = boardLayout(390, 700), to = boardLayout(390, 300, true);
    expect(victoryLayout(from, to, 0)).toEqual(from);
    expect(victoryLayout(from, to, 150).width).toBeGreaterThan(from.width);
    const end = victoryLayout(from, to, 650);
    for (const key of ['x', 'y', 'cell', 'gap', 'width', 'height'] as const) expect(end[key]).toBeCloseTo(to[key]);
    for (let ms = 0; ms <= 800; ms += 10) {
      const value = victoryLayout(from, to, ms);
      expect(value.cell).toBeGreaterThan(0); expect(Number.isFinite(value.y)).toBe(true);
    }
  });
  it('caps rapid cue streams independently without dropping the win accent', () => {
    const gate = new CueGate();
    expect(gate.accept('cell', 0)).toBe(true); expect(gate.accept('cell', 20)).toBe(false);
    expect(gate.accept('win', 20)).toBe(true); expect(gate.accept('cell', 46)).toBe(true);
    expect(gate.accept('reject', 0)).toBe(true); expect(gate.accept('reject', 100)).toBe(false); expect(gate.accept('reject', 380)).toBe(true);
    expect(gate.accept('coin', 0)).toBe(true); expect(gate.accept('coin', 10)).toBe(false);
  });
  it('persists sound and vibration independently', () => {
    let raw = JSON.stringify({ sound: false, vibration: true });
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const feedback = new Feedback(storage);
    expect(feedback.settings).toEqual({ sound: false, vibration: true });
    feedback.setSetting('vibration', false);
    expect(new Feedback(storage).settings).toEqual({ sound: false, vibration: false });
  });
  it('bounds notes and rises across a route/coin sequence', () => {
    for (const cue of ['cell', 'undo', 'win', 'star', 'coin', 'progress', 'button', 'reject'] as const) {
      for (const progress of [0, .5, 1]) for (const note of cueNotes(cue, progress)) {
        expect(note.frequency).toBeGreaterThan(40); expect(note.frequency).toBeLessThan(4000);
        expect(note.gain).toBeLessThanOrEqual(.16); expect(note.duration).toBeLessThanOrEqual(.35);
        expect(note.delay).toBeLessThan(.2);
      }
    }
    expect(cueNotes('cell', 1)[0]!.frequency).toBeGreaterThan(cueNotes('cell', 0)[0]!.frequency);
    expect(cueNotes('undo')[0]!.end).toBeLessThan(cueNotes('undo')[0]!.frequency);
  });
});
