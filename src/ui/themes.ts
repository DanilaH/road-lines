import type { Theme } from '../content/themes';

export function applyTheme(root: HTMLElement, theme: Theme): void {
  const values = { background: theme.background, empty: theme.empty, ribbon: theme.ribbon, trail: theme.trail,
    ink: theme.ink, muted: theme.muted, panel: theme.panel, soft: theme.soft, accent: theme.accent,
    primary: theme.primary, 'primary-ink': theme.primaryInk, selected: theme.selected };
  for (const [key, value] of Object.entries(values)) document.documentElement.style.setProperty(`--${key}`, value);
  root.dataset.theme = theme.id;
}

/** Same cells/ribbon/trail palette as BoardScene; no downloaded theme assets. */
export function themePreview(theme: Theme): string {
  return `<svg class="theme-preview" viewBox="0 0 180 146" aria-hidden="true"><path fill="${theme.background}" d="M0 0h180v146H0z"/><g fill="${theme.empty}">${Array.from({length:9}, (_, i) => `<path d="M${36 + i % 3 * 38} ${18 + Math.floor(i / 3) * 38}h32v32h-32z"/>`).join('')}</g><path d="M52 34h76v38H52v38" stroke="${theme.ribbon}" stroke-width="32" fill="none"/><path d="M52 34h76v38H52v38" stroke="${theme.trail}" stroke-width="2" stroke-dasharray="2 5" fill="none"/><circle cx="52" cy="34" r="5" fill="${theme.trail}"/><circle cx="52" cy="110" r="4" fill="${theme.trail}"/></svg>`;
}
