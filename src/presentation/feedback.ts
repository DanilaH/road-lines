import { Capacitor, registerPlugin } from '@capacitor/core';
import { soundBank, type Cue } from './sound-bank';
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
  private variant = 0;
  private gate = new CueGate();
  private blocked = false;
  private disposed = false;
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
    try { const s = JSON.parse(storage.getItem('road-lines.feedback.v1') ?? 'null');
      if (s && typeof s.sound === 'boolean' && typeof s.vibration === 'boolean') this.settings = s;
    } catch { /* Noncritical preferences may use defaults, unlike game progression. */ }
    this.loadSamples();
  }
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
    if (this.settings.vibration) {
      if (Capacitor.isNativePlatform()) void native.pulse({ cue, issuedAt: Date.now() }).catch(() => {});
      // Web vibration is a limited fallback; native builds never rely on it.
      else if (navigator.vibrate) navigator.vibrate(cue === 'win' ? [28, 65, 34, 75, 48] : cue === 'star' ? 24 : cue === 'cell' ? 12 : 8);
    }
    if (!this.settings.sound) return;
    this.prime();
    const context = this.context;
    if (!context || !this.master || context.state !== 'running') return;
    if (!this.buffer || this.voices.size >= 20) return;
    const variants = soundBank[cue], clip = variants[this.variant++ % variants.length]!;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = this.buffer;
    source.playbackRate.value = cue === 'cell' || cue === 'coin' ? .94 + Math.max(0, Math.min(1, progress)) * .20 : 1;
    gain.gain.value = cue === 'button' ? .32 : cue === 'cell' ? .52 : cue === 'undo' ? .42 : .65;
    source.connect(gain); gain.connect(this.master); this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(context.currentTime, clip[0], clip[1]);
  }

  setBlocked(value: boolean): void {
    this.blocked = value;
    if (value) {
      this.stopVoices(); if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
      if (Capacitor.isNativePlatform()) void native.cancel().catch(() => {}); else navigator.vibrate?.(0);
    }
    // Resume only on the next real gesture, never replay queued cues after background.
  }
  private stopVoices(): void { for (const voice of this.voices) { try { voice.stop(); } catch {} voice.disconnect(); } this.voices.clear(); }
  dispose(): void { this.abort.abort(); this.buffer = undefined; this.bytes = undefined; this.setBlocked(true); this.disposed = true; void this.context?.close().catch(() => {}); }
}
