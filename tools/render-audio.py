"""Original, deterministic C-major sound sprite. No downloaded audio/runtime synthesis.
Variants change body/attack only: every cell strike is tuned to the same C5.
"""
from pathlib import Path
import json
import numpy as np
import wave
rate = 32000
rng = np.random.default_rng(20261103)
C = 523.2511306011972

def note(semitones):
    return C * 2 ** (semitones / 12)

def noise(n):
    x = rng.normal(0, 1, n)
    # A quiet, low-passed contact transient; never an extra pitched oscillator.
    y = np.convolve(x, np.ones(9) / 9, mode='same')
    return y / (np.max(np.abs(y)) + 1e-9)

def mallet(f, duration=.12, family=0, strike=0):
    t = np.arange(int(rate * duration)) / rate
    partials = [(1, .20, .05, .012), (1, .12, .025, .004), (1, .28, .08, .018)][family]
    decay = [36, 29, 42][family] * (1 + strike * .012)
    y = sum(amp * np.sin(2 * np.pi * f * harmonic * t) * np.exp(-t * decay * (1 + .4 * (harmonic-1)))
            for harmonic, amp in enumerate(partials, 1))
    y *= 1 - np.exp(-t * (650 + 40 * strike))
    y += noise(len(t)) * np.exp(-t * 450) * (.008 + strike * .001)
    # Quiet baked body; short enough that rapid drawing never creates a metallic wash.
    dry = y.copy()
    for delay, gain in [(.012, .055), (.025, .025)]:
        n = int(rate * delay)
        if n < len(y): y[n:] += dry[:-n] * gain
    fade = min(int(rate * .018), len(y))
    y[-fade:] *= np.linspace(1, 0, fade)
    return y

def chord(notes, duration, family=1):
    result = np.zeros(int(rate * duration))
    for i, semitones in enumerate(notes):
        a = mallet(note(semitones), .36, family, i % 4)
        at = int(rate * .055 * i)
        end = min(len(result), at + len(a))
        result[at:end] += a[:end-at] * (.72 if i else 1)
    return result

clips = {}
for family in range(3):
    for strike in range(4):
        clips[f'cell{family*4+strike}'] = mallet(C, .115, family, strike)
for i in range(4): clips[f'undo{i}'] = mallet(note(-12), .095, 0, i)
for i, semitones in enumerate([12,16,19,16]): clips[f'coin{i}'] = mallet(note(semitones), .105, 1, i)
for i in range(3): clips[f'button{i}'] = mallet(note(-12), .075, 0, i)
for i in range(2): clips[f'reject{i}'] = mallet(note(-24), .105, 0, i)
for i, semitones in enumerate([4,7,12]): clips[f'star{i}'] = mallet(note(semitones), .32, 1, i)
clips['win0'] = chord([-12,-8,-5,0], .72)
clips['win1'] = chord([-12,-5,-8,0], .72, 2)
clips['progress0'] = chord([4,7,12], .52)
clips['progress1'] = chord([7,4,12], .52, 2)
clips['gift0'] = chord([-17,-12,-8,-5,0,4], .92)
output = []; meta = {}; offset = 0
for name, y in clips.items():
    y -= np.mean(y)
    # Equal perceived body across strikes, with a peak cap instead of per-strike peak normalization.
    rms = np.sqrt(np.mean(y*y))
    y *= .115 / (rms + 1e-9)
    y *= min(1, .48 / (np.max(np.abs(y)) + 1e-9))
    y[0] = y[-1] = 0
    meta.setdefault(''.join(c for c in name if not c.isdigit()), []).append([round(offset/rate,6),round(len(y)/rate,6)])
    output.extend([y,np.zeros(int(rate*.025))]); offset += len(y)+int(rate*.025)
samples = np.concatenate(output); assert np.max(np.abs(samples)) <= .481
path = Path('src/assets/audio'); path.mkdir(parents=True,exist_ok=True)
with wave.open(str(path/'feedback.wav'),'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes((samples*32767).astype('<i2').tobytes())
Path('src/presentation/sound-bank.ts').write_text('/** Offline-rendered original samples. Regenerate with tools/render-audio.py. */\nexport const soundBank = '+json.dumps(meta,indent=2)+' as const;\nexport type Cue = keyof typeof soundBank;\n')
print('Sound sprite:',offset/rate,'seconds,',(path/'feedback.wav').stat().st_size,'bytes')
