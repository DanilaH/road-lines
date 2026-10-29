const paths = {
  restart: '<path d="M5 9a8 8 0 1 1-1 7M5 3v6h6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  hint: '<path d="M9 18h6M10 21h4M8.3 14.5A6 6 0 1 1 16 14.2c-1.2 1-1 2-1 2H9s.2-1-1-2Z"/>',
  play: '<path d="m9 5 10 7-10 7Z"/>',
  gift: '<path d="M3 9h18v5H3zM5 14v7h14v-7M12 9v12M12 9c-8 0-7-8-3-6 2 1 3 6 3 6Zm0 0c8 0 7-8 3-6-2 1-3 6-3 6Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
} as const;
export const icon = (name: keyof typeof paths): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
export const coin = '<span class="coin" aria-hidden="true">•</span>';
export const star = (index: number): string => `<svg class="star" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="gold${index}" x2="0" y2="1"><stop stop-color="#ffed91"/><stop offset=".48" stop-color="#ffd151"/><stop offset="1" stop-color="#eda92c"/></linearGradient></defs><path d="m50 5 14 28 31 5-22 23 5 32-28-15-28 15 5-32L5 38l31-5Z" fill="#d98d22" transform="translate(0 4)"/><path d="m50 5 14 28 31 5-22 23 5 32-28-15-28 15 5-32L5 38l31-5Z" fill="url(#gold${index})" stroke="#f7c245" stroke-width="2"/></svg>`;
