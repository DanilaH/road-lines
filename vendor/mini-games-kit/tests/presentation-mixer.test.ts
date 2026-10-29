import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PresentationAudioMixer,
  type ManagedAudioLayer,
  type PersistentAudioLayerSpec,
} from '../src/audio/index';

class FakeAudioParam {
  public value = 1;
  public cancelScheduledValues(): void {}
  public setValueAtTime(value: number): void { this.value = value; }
  public linearRampToValueAtTime(value: number): void { this.value = value; }
  public exponentialRampToValueAtTime(value: number): void { this.value = value; }
}

class FakeNode {
  public readonly connections: unknown[] = [];
  public disconnectCalls = 0;
  public connect(target: unknown): unknown {
    this.connections.push(target);
    return target;
  }
  public disconnect(): void {
    this.disconnectCalls += 1;
  }
}

class FakeGainNode extends FakeNode {
  public readonly gain = new FakeAudioParam();
}

class FakeContext {
  public state: AudioContextState = 'running';
  public currentTime = 1;
  public readonly destination = new FakeNode();
  public readonly gains: FakeGainNode[] = [];
  public suspendCalls = 0;
  public resumeCalls = 0;
  public closeCalls = 0;

  public createGain(): GainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  public async suspend(): Promise<void> {
    this.suspendCalls += 1;
    this.state = 'suspended';
  }

  public async resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = 'running';
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
    this.state = 'closed';
  }
}

const makeLayer = () => ({
  stop: vi.fn(),
  disconnect: vi.fn(),
  setProgress: vi.fn(),
}) satisfies ManagedAudioLayer;

const makePersistentSpec = <State>(create: PersistentAudioLayerSpec<State>['create']): PersistentAudioLayerSpec<State> => ({
  gain: 0.3,
  baseMixMultiplier: 0.5,
  fadeInMs: 20,
  fadeOutMs: 30,
  create,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PresentationAudioMixer lifecycle', () => {
  it('routes base and persistent buses through an injected master destination', () => {
    const context = new FakeContext();
    const master = new FakeNode();
    const baseLayer = makeLayer();
    const persistentLayer = makeLayer();
    const mixer = new PresentationAudioMixer<string>({
      context: context as unknown as AudioContext,
      destination: master as unknown as AudioNode,
      base: { gain: 0.2, fadeInMs: 10, create: () => baseLayer },
      resolvePersistent: () => makePersistentSpec(() => persistentLayer),
    });

    mixer.prime();
    mixer.setPersistentState('result');

    expect(context.gains).toHaveLength(2);
    expect(context.gains[0]?.connections).toEqual([master]);
    expect(context.gains[1]?.connections).toEqual([master]);
  });

  it('uses semantic state equality instead of object identity when configured', () => {
    const context = new FakeContext();
    const createPersistent = vi.fn(() => makeLayer());
    const mixer = new PresentationAudioMixer<{ key: string }>({
      context: context as unknown as AudioContext,
      base: { gain: 0.2, fadeInMs: 0, create: () => makeLayer() },
      resolvePersistent: () => makePersistentSpec(createPersistent),
      areStatesEqual: (left, right) => left.key === right.key,
    });

    mixer.setPersistentState({ key: 'rare' });
    mixer.setPersistentState({ key: 'rare' });

    expect(createPersistent).toHaveBeenCalledTimes(1);
  });

  it('suspends for mute/block and resumes the same graph rather than creating replacement base layers', async () => {
    const context = new FakeContext();
    const createBase = vi.fn(() => makeLayer());
    const mixer = new PresentationAudioMixer<string>({
      context: context as unknown as AudioContext,
      base: { gain: 0.2, fadeInMs: 0, create: createBase },
      resolvePersistent: () => makePersistentSpec(() => makeLayer()),
    });

    mixer.prime();
    mixer.setMuted(true);
    await Promise.resolve();
    mixer.setBlocked(true);
    mixer.setMuted(false);
    mixer.setBlocked(false);
    await Promise.resolve();
    await Promise.resolve();

    expect(context.suspendCalls).toBe(1);
    expect(context.resumeCalls).toBe(1);
    expect(createBase).toHaveBeenCalledTimes(1);
  });

  it('flushes delayed replacement cleanup synchronously on dispose', () => {
    vi.useFakeTimers();
    const context = new FakeContext();
    const first = makeLayer();
    const second = makeLayer();
    const layers = [first, second];
    const mixer = new PresentationAudioMixer<string>({
      context: context as unknown as AudioContext,
      base: { gain: 0.2, fadeInMs: 0, create: () => makeLayer() },
      resolvePersistent: () => makePersistentSpec(() => layers.shift() ?? makeLayer()),
    });

    mixer.setPersistentState('first');
    mixer.setPersistentState('second');
    expect(first.disconnect).not.toHaveBeenCalled();

    mixer.dispose();

    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(second.disconnect).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(first.disconnect).toHaveBeenCalledTimes(1);
  });
});
