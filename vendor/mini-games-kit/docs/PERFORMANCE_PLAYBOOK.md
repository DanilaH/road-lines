# Small web-game performance playbook

This document records production lessons from Signal 2000 that are reusable as **method**, not as universal numeric settings.

## Measure the right budgets

Track at least three different quantities:

- **archive/build bytes** — distribution/package constraint;
- **encoded network bytes** — what a cold client actually requests;
- **physical decoded pixels / RGBA proxy** — texture residency and decode/upload pressure.

They are not interchangeable. A build can contain WebP + AVIF while a modern client requests only AVIF. An atlas can reduce request count while increasing decoded texture area.

## Optimization order that paid off

1. Measure actual display size and DPR budget; stop shipping source-resolution art when it cannot be displayed.
2. Remove transparent physical waste while preserving logical frame geometry.
3. Tune the fallback codec only where aggregate savings justify visual risk.
4. Add a modern codec with capability detection and fallback.
5. Use category-specific quality only after visual screening shows categories tolerate different compression.
6. Measure controlled browser startup, then validate on the real distribution host/device.

## What not to optimize by proxy

- Request count is not a KPI by itself, especially over HTTP/2.
- A smaller ZIP does not prove a smaller startup transfer.
- Encoder/decode microbenchmarks do not prove browser Game Ready improvement.
- PSNR/MAE are screening signals, not visual acceptance.
- One noisy phone/network run is not enough to tune loader concurrency.

## Negative evidence worth preserving

Signal 2000 tested request consolidation through WebP atlases and a custom pack. Request count fell, but bytes/residency or startup behavior did not improve enough; one custom pack was slower. A later AVIF-atlas audit could cut requests drastically but saved only a small fraction of total bytes while adding decoded area and plumbing complexity. Do not repeat that experiment in a new project without new evidence that request overhead is actually dominant.

Likewise, aggressive loader concurrency produced highly variable real-phone results. Controlled throttled-browser evidence showed only a small difference across a broad middle range. Preserve engine/platform defaults until the target host demonstrates a material problem.

## Resource Timing interpretation

A useful startup diagnostic separates:

- loader wall;
- first→last resource response span;
- time after the last response until loader settle;
- observed network concurrency;
- transfer vs encoded bytes;
- slowest request wait/download split.

A tiny post-response settle tail is strong evidence that network acquisition, not image decode or engine processing, dominates that startup wall. Do not diagnose 'AVIF is slow to decode' from total load time when Resource Timing says otherwise.

## Final authority

Use controlled synthetic conditions to compare candidates. Use the actual Yandex DRAFT/CDN and hands-on target-device play to decide whether to ship. Convenience hosting remains useful for functional QA, but its routing/CDN behavior must not silently become production truth.
