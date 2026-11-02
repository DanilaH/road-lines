import { soundBank, type Cue } from './sound-bank';
const phrases = [[0, 2, 4, 2, -1, 1, 3, 1], [2, 0, 3, 1, 4, 2, 0, 1], [0, 3, 1, 4, 2, -1, 2, 1]] as const;
/** Musical movement is local to the level; unrelated button/coin cues cannot reset its voice. */
export class SoundSequence {
  private level = '';
  private family = 0;
  private phrase = 0;
  private transpose = 0;
  private counters = new Map<Cue, number>();
  private last = new Map<Cue, number>();
  constructor(private random = Math.random) {}
  beginLevel(id: string): void {
    if (this.level === id) return;
    const hash = [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
    const family = hash % 3;
    this.family = this.level && family === this.family ? (family + 1) % 3 : family;
    this.level = id; this.phrase = hash % phrases.length; this.transpose = hash % 4 - 2;
    this.counters.set('cell', 0);
  }
  next(cue: Cue, progress: number): { index: number; rate: number; gain: number } {
    const count = this.counters.get(cue) ?? 0;
    this.counters.set(cue, count + 1);
    if (cue === 'win') this.counters.set('star', 0);
    const first = cue === 'cell' ? this.family * 4 : 0;
    const size = cue === 'cell' ? 4 : soundBank[cue].length;
    let index = first + Math.floor(Math.max(0, Math.min(.999999, this.random())) * size);
    if (cue === 'star') index = count % size;
    else if (size > 1 && index === this.last.get(cue)) index = first + (index - first + 1) % size;
    this.last.set(cue, index);
    const semitones = cue === 'cell' ? phrases[this.phrase]![count % 8]! + this.transpose : cue === 'coin' ? Math.max(0, Math.min(1, progress)) * 3 - 1 : 0;
    const rate = Math.max(.82, Math.min(1.28, 2 ** (semitones / 12) * (.99 + this.random() * .02)));
    return { index, rate, gain: .94 + this.random() * .12 };
  }
}
