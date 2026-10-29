export const presentation = {
  background: 0xfafaf8,
  empty: 0xe1e3e5,
  fill: 0x7e67d9,
  ink: 0x49a966,
  maxCell: 56,
  gapRatio: 1 / 7,
  bannerHeight: 60,
  gutter: 20,
} as const;

// Presentation fixtures only. Stage 1 replaces these with validated level content.
export const sampleCells: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2],
];
export const sampleRoute: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0], [2, 0], [2, 1], [2, 2],
];
