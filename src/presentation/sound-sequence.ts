import { soundBank, type Cue } from './sound-bank';
// All cell samples share C5. Only these discrete C-major-pentatonic notes may transpose them.
const phrases = [[0, 2, 4, 7, 4, 2, 0, 2], [0, 2, 4, 2, 0, 2, 4, 2], [4, 2, 0, 2, 4, 7, 4, 2]] as const;
/** Timbre varies; tuning never depends on random jitter, sample index or level transposition. */
export class SoundSequence {
  private level = '';
  private family = 0;
  private phrase = 0;
  private counters = new Map<Cue, number>();
  private last = new Map<Cue, number>();
  constructor(private random = Math.random) {}
  beginLevel(id: string): void {
    if (this.level === id) return;
    const hash = [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
    this.family = hash % 3;
    this.level = id; this.phrase = hash % phrases.length;
    this.counters.set('cell', 0);
  }
  next(cue: Cue, _progress: number): { index: number; rate: number; gain: number } {
    const count = this.counters.get(cue) ?? 0;
    this.counters.set(cue, count + 1);
    if (cue === 'win') this.counters.set('star', 0);
    const first = cue === 'cell' ? this.family * 4 : 0;
    const size = cue === 'cell' ? 4 : soundBank[cue].length;
    let index = first + Math.floor(Math.max(0, Math.min(.999999, this.random())) * size);
    if (cue === 'star') index = count % size;
    // Coin samples are tuned C/E/G/E, not random off-key strikes or a continuous pitch sweep.
    else if (cue === 'coin') index = count % size;
    else if (size > 1 && index === this.last.get(cue)) index = first + (index - first + 1) % size;
    this.last.set(cue, index);
    const semitones = cue === 'cell' ? phrases[this.phrase]![count % 8]! : 0;
    return { index, rate: 2 ** (semitones / 12), gain: .98 + this.random() * .04 };
  }
}
