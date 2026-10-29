import { describe, expect, it, vi } from 'vitest';

import {
  exportTextWithFallback,
  StartupPreloadController,
  StartupResourceDiagnostics,
  StartupTimeline,
  computeStartupFakeProgress,
  type StartupPreloadScheduler,
  type StartupPreloadSnapshot,
} from '../src/startup/index';

class TestScheduler implements StartupPreloadScheduler {
  public nowValue = 0;
  private nextHandle = 1;
  private readonly timeouts = new Map<number, () => void>();
  private readonly intervals = new Map<number, () => void>();

  public now(): number {
    return this.nowValue;
  }

  public setTimeout(callback: () => void): number {
    const handle = this.nextHandle++;
    this.timeouts.set(handle, callback);
    return handle;
  }

  public clearTimeout(handle: number): void {
    this.timeouts.delete(handle);
  }

  public setInterval(callback: () => void): number {
    const handle = this.nextHandle++;
    this.intervals.set(handle, callback);
    return handle;
  }

  public clearInterval(handle: number): void {
    this.intervals.delete(handle);
  }

  public fireNextTimeout(): void {
    const next = [...this.timeouts.keys()].sort((left, right) => left - right)[0];
    if (next === undefined) throw new Error('No pending timeout');
    const callback = this.timeouts.get(next)!;
    this.timeouts.delete(next);
    callback();
  }
}

describe('startup runtime primitives', () => {
  it('measures caller-defined overlapping phases without imposing phase names', () => {
    let now = 100;
    const timeline = new StartupTimeline<'platform' | 'save' | 'art' | 'ready'>({ now: () => now });
    now = 120;
    timeline.mark('platform');
    now = 160;
    timeline.mark('save');
    now = 150;
    timeline.mark('platform');
    now = 190;
    timeline.mark('art');
    now = 210;
    timeline.mark('ready');

    expect(timeline.snapshot({
      moduleToReadyMs: ['start', 'ready'],
      platformToArtMs: ['platform', 'art'],
      saveToArtMs: ['save', 'art'],
    })).toEqual({ moduleToReadyMs: 110, platformToArtMs: 70, saveToArtMs: 30 });
  });

  it('correlates queued resources and exposes network/settle diagnostics', () => {
    let now = 0;
    const diagnostics = new StartupResourceDiagnostics({
      now: () => now,
      baseUrl: 'https://game.test/',
      maxParallelDownloads: 8,
      metadata: { format: 'avif' },
      getResourceEntries: () => [
        {
          name: 'https://game.test/a.avif', startTime: 10, requestStart: 12, responseStart: 30,
          responseEnd: 70, duration: 60, transferSize: 2048, encodedBodySize: 1800, nextHopProtocol: 'h2',
        },
        {
          name: 'https://game.test/b.avif', startTime: 20, requestStart: 22, responseStart: 40,
          responseEnd: 80, duration: 60, transferSize: 0, encodedBodySize: 1000, nextHopProtocol: 'h2',
        },
      ],
    });
    diagnostics.record('a', 'a.avif');
    diagnostics.record('b', 'b.avif');
    now = 100;
    const snapshot = diagnostics.finalize();

    expect(snapshot.loaderWallMs).toBe(100);
    expect(snapshot.resourceSpanMs).toBe(70);
    expect(snapshot.settleAfterLastResponseMs).toBe(20);
    expect(snapshot.maxObservedNetworkConcurrency).toBe(2);
    expect(snapshot.cacheLikeCount).toBe(1);
    expect(snapshot.protocols).toEqual(['h2']);
    expect(snapshot.observedCount).toBe(2);
  });

  it('falls through a rejected clipboard permission to the next export method', async () => {
    const expose = vi.fn();
    const method = await exportTextWithFallback('payload', {
      writeClipboard: async () => Promise.reject(new Error('denied')),
      legacyCopy: () => false,
      expose,
    });
    expect(method).toBe('exposed');
    expect(expose).toHaveBeenCalledWith('payload');
  });

  it('keeps fake progress below completion until the real ready signal', () => {
    expect(computeStartupFakeProgress(0)).toBeGreaterThan(0);
    expect(computeStartupFakeProgress(30_000)).toBeLessThan(1);
    expect(computeStartupFakeProgress(30_000)).toBeGreaterThan(computeStartupFakeProgress(1_000));
  });

  it('can recover a diagnostic timeout when the real presentable-ready signal arrives later', () => {
    const scheduler = new TestScheduler();
    const snapshots: StartupPreloadSnapshot[] = [];
    const controller = new StartupPreloadController(
      { render: (snapshot) => snapshots.push(snapshot) },
      { showDelayMs: 1, minVisibleMs: 0, completionHoldMs: 0, fatalTimeoutMs: 10 },
      scheduler,
    );

    controller.begin();
    scheduler.fireNextTimeout(); // delayed show
    controller.fail('slow host');
    expect(controller.getPhase()).toBe('failed');

    controller.complete();
    expect(controller.getPhase()).toBe('completing');
    scheduler.fireNextTimeout(); // completion hold
    expect(controller.getPhase()).toBe('hidden');
    expect(snapshots.at(-1)?.progress).toBe(1);
  });

  it('never flashes the preload surface when startup completes before the show delay', () => {
    const scheduler = new TestScheduler();
    const controller = new StartupPreloadController(
      { render: () => undefined },
      { showDelayMs: 200 },
      scheduler,
    );

    controller.begin();
    controller.complete();
    expect(controller.getPhase()).toBe('hidden');
  });
});
