"""Original deterministic sound design, rendered offline to a single PCM sprite.
No downloaded samples. Numpy is an offline authoring tool, never a runtime dependency.
"""
from pathlib import Path
import numpy as np, wave
rate=32000
rng=np.random.default_rng(20261102)
def noise(n, cutoff=.13):
 x=rng.normal(0,1,n); k=np.fft.rfft(x); k*=np.exp(-np.linspace(0,1,len(k))**2/(cutoff**2)); y=np.fft.irfft(k,n); return y/(np.max(np.abs(y))+1e-9)
def mallet(f,d=.22,wood=False):
 t=np.arange(int(rate*d))/rate; y=np.zeros_like(t)
 for ratio,amp,decay in [(1,1,10),(2.756,.24,19),(5.404,.10,32),(8.93,.04,54)]:
  y+=amp*np.sin(2*np.pi*f*ratio*(t+.0003*(1-np.exp(-90*t))))*np.exp(-decay*t)
 y*=1-np.exp(-1600*t)
 y+=noise(len(t),.28 if wood else .6)*np.exp(-t*200)*(.38 if wood else .12)
 if wood:y=np.tanh(y*1.8)*np.exp(-t*15)
 return y
clips={}
for i in range(4):clips[f'cell{i}']=mallet(540+i*7,.18,True)+mallet(1080+i*11,.18)*.10
for i in range(2):
 t=np.arange(int(rate*.18))/rate;clips[f'undo{i}']=noise(len(t),.18)*np.sin(np.pi*np.minimum(t/.16,1))**2*np.exp(-t*15)*.8+mallet(245+i*10,.18,True)*.45
for i in range(3):clips[f'coin{i}']=mallet(1480+i*19,.16)*.52+mallet(2240+i*17,.16)*.18
for i in range(2):clips[f'button{i}']=mallet(310+i*8,.09,True)
clips['reject0']=mallet(180,.13,True)
for i,f in enumerate([659.25,783.99,1046.5]):clips[f'star{i}']=mallet(f,.42)+.28*mallet(f*2,.42)
def chord(notes,duration):
 result=np.zeros(int(rate*duration))
 for i,f in enumerate(notes):
  a=mallet(f,.55);at=int(rate*.055*i);end=min(len(result),at+len(a));result[at:end]+=a[:end-at]*(.7 if i else 1)
 return result
clips['win0']=chord([523.25,659.25,783.99,1046.5],1.05)
clips['progress0']=chord([783.99,1046.5,1318.5],.72)
output=[];meta={};offset=0
for name,y in clips.items():
 # Short reflected body, baked once; zero CPU convolution/reverb during drawing.
 dry=y.copy()
 for delay,gain in [(.017,.13),(.031,.08),(.061,.045)]:
  n=int(rate*delay)
  if n<len(y):y[n:]+=dry[:-n]*gain
 y-=np.mean(y);y*=np.minimum(np.arange(len(y))/70,1)*np.minimum(np.arange(len(y))[::-1]/150,1)
 y*=.54/(np.max(np.abs(y))+1e-9)
 meta.setdefault(''.join(c for c in name if not c.isdigit()),[]).append([round(offset/rate,6),round(len(y)/rate,6)])
 output.extend([y,np.zeros(int(rate*.025))]);offset+=len(y)+int(rate*.025)
all_samples=np.concatenate(output);assert np.max(np.abs(all_samples))<.6
path=Path('src/assets/audio');path.mkdir(parents=True,exist_ok=True)
with wave.open(str(path/'feedback.wav'),'wb')as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((all_samples*32767).astype('<i2').tobytes())
import json
Path('src/presentation/sound-bank.ts').write_text('/** Offline-rendered original samples. Regenerate with tools/render-audio.py. */\nexport const soundBank = '+json.dumps(meta,indent=2)+' as const;\nexport type Cue = keyof typeof soundBank;\n')
print('Sound sprite:',offset/rate,'seconds,', (path/'feedback.wav').stat().st_size,'bytes')
