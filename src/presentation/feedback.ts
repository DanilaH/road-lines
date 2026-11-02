import { Capacitor, registerPlugin } from '@capacitor/core';
import { soundBank, type Cue } from './sound-bank';
import { SoundSequence } from './sound-sequence';
export type { Cue } from './sound-bank';

export class CueGate {
  private last = new Map<Cue, number>();
  accept(cue: Cue, now: number): boolean {
    const interval = cue === 'reject' ? 380 : cue === 'cell' || cue === 'undo' ? 45 : cue === 'coin' ? 42 : 20;
    if (now - (this.last.get(cue) ?? -Infinity) < interval) return false;
    this.last.set(cue, now); return true;
  }
}
interface NativeFeedback { pulse(options: { cue: Cue; issuedAt: number }): Promise<void>; cancel(): Promise<void>; }
const native = registerPlugin<NativeFeedback>('RoadFeedback');
export interface FeedbackSettings { sound: boolean; vibration: boolean; }
export class Feedback {
  settings: FeedbackSettings = { sound: true, vibration: true };
  private context?: AudioContext;
  private master?: GainNode;
  private voices = new Set<AudioBufferSourceNode>();
  private buffer?: AudioBuffer;
  private bytes?: ArrayBuffer;
  private load?: Promise<void>;
  private decoding = false;
  private abort = new AbortController();
  private sequence = new SoundSequence();
  private lastHaptic = -Infinity;
  private hapticUntil = 0;
  private gate = new CueGate();
  private blocked = false;
  private disposed = false;
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
    try { const s = JSON.parse(storage.getItem('road-lines.feedback.v1') ?? 'null');
      if (s && typeof s.sound === 'boolean' && typeof s.vibration === 'boolean') this.settings = s;
    } catch { /* Noncritical preferences may use defaults, unlike game progression. */ }
    this.loadSamples();
  }
  setLevel(id: string): void { this.sequence.beginLevel(id); }
  private loadSamples(): void {
    if (this.load || this.disposed || !this.settings.sound) return;
    this.load = fetch(new URL('../assets/audio/feedback.wav', import.meta.url), { signal: this.abort.signal })
      .then(response => { if (!response.ok) throw Error('Sound unavailable'); return response.arrayBuffer(); })
      .then(bytes => { if (!this.disposed) { this.bytes = bytes; this.decodeSamples(); } }).catch(() => {});
  }
  private decodeSamples(): void {
    const context = this.context;
    if (!context || !this.bytes || this.buffer || this.decoding || this.disposed) return;
    this.decoding = true;
    void context.decodeAudioData(this.bytes.slice(0)).then(buffer => { if (!this.disposed) { this.buffer = buffer; this.bytes = undefined; } })
      .catch(() => {}).finally(() => { this.decoding = false; });
  }
  prime(): void {
    if (this.disposed || this.blocked || !this.settings.sound) return;
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.master = this.context.createGain();
        this.master.gain.value = 0.7;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -10; compressor.knee.value = 12; compressor.ratio.value = 5;
        this.master.connect(compressor); compressor.connect(this.context.destination);
      }
      this.loadSamples(); this.decodeSamples();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Audio support must not decide whether the puzzle works. */ }
  }
  setSetting(key: keyof FeedbackSettings, value: boolean): void {
    this.settings = { ...this.settings, [key]: value };
    try { this.storage.setItem('road-lines.feedback.v1', JSON.stringify(this.settings)); } catch {}
    if (!this.settings.sound) this.stopVoices(); else this.prime();
    if (!this.settings.vibration && Capacitor.isNativePlatform()) void native.cancel().catch(() => {});
  }
  play(cue: Cue, progress = 0): void {
    if (this.disposed || this.blocked || !this.gate.accept(cue, performance.now())) return;
    const now = performance.now(), celebration = cue === 'win' || cue === 'gift';
    if (this.settings.vibration && (celebration || now >= this.hapticUntil) && now - this.lastHaptic >= (cue === 'coin' ? 90 : celebration ? 20 : 70)) {
      this.lastHaptic = now;
      if (celebration) this.hapticUntil = now + (cue === 'gift' ? 409 : 238);
      if (Capacitor.isNativePlatform()) void native.pulse({ cue, issuedAt: Date.now() }).catch(() => {});
      // Web vibration is a limited fallback; native builds never rely on it.
      else if (navigator.vibrate) navigator.vibrate(cue === 'gift' ? [32,45,42,50,70,70,100] : cue === 'win' ? [34,45,42,55,62] : cue === 'undo' ? [14,22,20] : cue === 'reject' ? [24,28,24] : cue === 'star' ? [26,28,30] : cue === 'cell' ? 24 : 14);
    }
    if (!this.settings.sound) return;
    this.prime();
    const context = this.context;
    if (!context || !this.master || context.state !== 'running') return;
    if (!this.buffer || this.voices.size >= 20) return;
    const variants = soundBank[cue], choice = this.sequence.next(cue, progress), clip = variants[choice.index]!;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = this.buffer;
    source.playbackRate.value = choice.rate;
    gain.gain.value = (cue === 'button' ? .32 : cue === 'cell' ? .52 : cue === 'undo' ? .42 : .65) * choice.gain;
    source.connect(gain); gain.connect(this.master); this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(context.currentTime, clip[0], clip[1]);
  }

  setBlocked(value: boolean): void {
    this.blocked = value;
    if (value) {
      this.cancel(); if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
    }
    // Resume only on the next real gesture, never replay queued cues after background.
  }
  cancel(): void {
    this.stopVoices(); this.hapticUntil = 0;
    if (Capacitor.isNativePlatform()) void native.cancel().catch(() => {}); else navigator.vibrate?.(0);
  }
  private stopVoices(): void { for (const voice of this.voices) { try { voice.stop(); } catch {} voice.disconnect(); } this.voices.clear(); }
  dispose(): void { this.abort.abort(); this.buffer = undefined; this.bytes = undefined; this.setBlocked(true); this.disposed = true; void this.context?.close().catch(() => {}); }
}
