/** Offline-rendered original samples. Regenerate with tools/render-audio.py. */
export const soundBank = {
  "cell": [
    [
      0.0,
      0.18
    ],
    [
      0.205,
      0.18
    ],
    [
      0.41,
      0.18
    ],
    [
      0.615,
      0.18
    ]
  ],
  "undo": [
    [
      0.82,
      0.18
    ],
    [
      1.025,
      0.18
    ]
  ],
  "coin": [
    [
      1.23,
      0.16
    ],
    [
      1.415,
      0.16
    ],
    [
      1.6,
      0.16
    ]
  ],
  "button": [
    [
      1.785,
      0.09
    ],
    [
      1.9,
      0.09
    ]
  ],
  "reject": [
    [
      2.015,
      0.13
    ]
  ],
  "star": [
    [
      2.17,
      0.42
    ],
    [
      2.615,
      0.42
    ],
    [
      3.06,
      0.42
    ]
  ],
  "win": [
    [
      3.505,
      1.05
    ]
  ],
  "progress": [
    [
      4.58,
      0.72
    ]
  ]
} as const;
export type Cue = keyof typeof soundBank;
