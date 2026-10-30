import { tint, type Theme } from '../content/themes';

export function applyTheme(root: HTMLElement, theme: Theme): void {
  const values = { background: theme.background, empty: theme.empty, ribbon: theme.ribbon, trail: theme.trail,
    ink: theme.ink, muted: theme.muted, panel: theme.panel, soft: theme.soft, accent: theme.accent,
    primary: theme.primary, 'primary-ink': theme.primaryInk, selected: theme.selected };
  for (const [key, value] of Object.entries(values)) document.documentElement.style.setProperty(`--${key}`, value);
  root.dataset.theme = theme.id;
}

/** Same cells/ribbon/trail palette as BoardScene; no downloaded theme assets. */
export function themePreview(theme: Theme): string {
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const gradient = `theme-ribbon-${theme.id}`;
  return `<svg class="theme-preview" viewBox="0 0 180 146" aria-hidden="true"><defs><linearGradient id="${gradient}" x2="0" y2="1"><stop stop-color="${hex(tint(theme.ribbon, .17))}"/><stop offset="1" stop-color="${hex(tint(theme.ribbon, -.12))}"/></linearGradient></defs><path fill="${theme.background}" d="M0 0h180v146H0z"/><g fill="${theme.empty}">${Array.from({length:9}, (_, i) => `<rect x="${36 + i % 3 * 38}" y="${18 + Math.floor(i / 3) * 38}" width="32" height="32" rx="3"/>`).join('')}</g><path d="M52 34h76v38H52v38" stroke="${hex(tint(theme.ribbon, -.35))}" stroke-width="32" fill="none" transform="translate(0 3)"/><path d="M52 34h76v38H52v38" stroke="url(#${gradient})" stroke-width="32" fill="none"/><path d="M38 19h103" stroke="#fff" stroke-opacity=".24" stroke-width="1"/><path d="M52 34h76v38H52v38" stroke="${theme.trail}" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 6" fill="none"/><circle cx="52" cy="34" r="5" fill="${theme.trail}"/><circle cx="52" cy="110" r="5" fill="${theme.trail}"/><circle cx="52" cy="110" r="2" fill="${theme.ribbon}"/></svg>`;
}
