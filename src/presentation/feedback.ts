import { Capacitor, registerPlugin } from '@capacitor/core';
import { getAccumulationPitchMultiplier } from '../../vendor/mini-games-kit/src/audio/pitch';

export type Cue = 'cell' | 'undo' | 'win' | 'star' | 'coin' | 'progress' | 'button' | 'reject';
export interface Note { frequency: number; end?: number; delay: number; duration: number; gain: number; type: OscillatorType; }
export function cueNotes(cue: Cue, progress = 0): Note[] {
  const pitch = getAccumulationPitchMultiplier(progress, { startMultiplier: 0.9, endMultiplier: 1.45 }, 0.5);
  const note = (frequency: number, duration: number, gain: number, delay = 0, type: OscillatorType = 'sine', end?: number): Note => ({ frequency, duration, gain, delay, type, end });
  switch (cue) {
    case 'cell': return [note(400 * pitch, 0.085, 0.075, 0, 'triangle', 310 * pitch), note(950 * pitch, 0.035, 0.018)];
    case 'reject': return [note(210, 0.065, 0.035, 0, 'sine', 160)];
    case 'undo': return [note(290, 0.08, 0.055, 0, 'triangle', 170)];
    case 'win': return [note(135, 0.18, 0.16, 0, 'sine', 52), ...[523.25, 659.25, 783.99, 1046.5].map((f, i) => note(f, 0.34, 0.055, i * 0.045, 'triangle'))];
    case 'star': { const f = [659.25, 783.99, 1046.5][Math.round(Math.max(0, Math.min(1, progress)) * 2)]!; return [note(f, 0.24, 0.1, 0, 'triangle'), note(f * 2, 0.18, 0.035, 0.03)]; }
    case 'coin': return [note(950 * pitch, 0.09, 0.055, 0, 'sine', 1250 * pitch), note(1900 * pitch, 0.055, 0.018)];
    case 'progress': return [note(780, 0.14, 0.055), note(1040, 0.2, 0.06, 0.065)];
    case 'button': return [note(360, 0.045, 0.025, 0, 'triangle', 300)];
  }
}
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
  private voices = new Set<OscillatorNode>();
  private gate = new CueGate();
  private blocked = false;
  private disposed = false;
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
    try { const s = JSON.parse(storage.getItem('road-lines.feedback.v1') ?? 'null');
      if (s && typeof s.sound === 'boolean' && typeof s.vibration === 'boolean') this.settings = s;
    } catch { /* Noncritical preferences may use defaults, unlike game progression. */ }
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
    for (const n of cueNotes(cue, progress)) {
      if (this.voices.size >= 20) break;
      const oscillator = context.createOscillator(), envelope = context.createGain(), at = context.currentTime + n.delay;
      oscillator.type = n.type; oscillator.frequency.setValueAtTime(n.frequency, at);
      if (n.end) oscillator.frequency.exponentialRampToValueAtTime(n.end, at + n.duration);
      envelope.gain.setValueAtTime(0.0001, at); envelope.gain.exponentialRampToValueAtTime(n.gain, at + 0.005);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + n.duration);
      oscillator.connect(envelope); envelope.connect(this.master); this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(at); oscillator.stop(at + n.duration + 0.015);
    }
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
  dispose(): void { this.setBlocked(true); this.disposed = true; void this.context?.close().catch(() => {}); }
}
