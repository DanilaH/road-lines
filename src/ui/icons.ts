const paths = {
  check: '<path d="m5 12 4 4L19 6"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1 1 0 0 1 .5-1.8H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="11" cy="6.8" r=".8"/><circle cx="16" cy="8" r=".8"/>',
  back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.6" fill="currentColor" stroke="none"/><rect x="14" y="3" width="7" height="7" rx="1.6" fill="currentColor" stroke="none"/><rect x="3" y="14" width="7" height="7" rx="1.6" fill="currentColor" stroke="none"/><rect x="14" y="14" width="7" height="7" rx="1.6" fill="currentColor" stroke="none"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
  settings: '<path d="M9 3h6l.7 3 2.5 1.4 2.8-.8 2 5.2-2.2 1.8-.5 2.8 1.3 2.6-4.3 3.1-2.4-1.7h-2.8l-2.4 1.7L5.4 19.1 6.7 16.5l-.5-2.8L4 11.9l2-5.2 2.8.8L9 3Z" transform="translate(-1 -1) scale(.94)"/><circle cx="12" cy="12" r="3"/>',
  restart: '<path d="M5 9a8 8 0 1 1-1 7M5 3v6h6"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1.4" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1.4" fill="currentColor" stroke="none"/>',
  hint: '<path d="M9 18h6M10 21h4M8.3 14.5A6 6 0 1 1 16 14.2c-1.2 1-1 2-1 2H9s.2-1-1-2Z"/>',
  play: '<path d="m9 5 10 7-10 7Z"/>',
  gift: '<path d="M3 9h18v5H3zM5 14v7h14v-7M12 9v12M12 9c-8 0-7-8-3-6 2 1 3 6 3 6Zm0 0c8 0 7-8 3-6-2 1-3 6-3 6Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
} as const;
export const icon = (name: keyof typeof paths): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
export const coin = '<span class="coin" aria-hidden="true">•</span>';
export const star = (index: number): string => `<svg class="star" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="gold${index}" x2="0" y2="1"><stop stop-color="#ffed91"/><stop offset=".48" stop-color="#ffd151"/><stop offset="1" stop-color="#eda92c"/></linearGradient></defs><path d="m50 5 14 28 31 5-22 23 5 32-28-15-28 15 5-32L5 38l31-5Z" fill="#d98d22" transform="translate(0 4)"/><path d="m50 5 14 28 31 5-22 23 5 32-28-15-28 15 5-32L5 38l31-5Z" fill="url(#gold${index})" stroke="#f7c245" stroke-width="2"/></svg>`;
