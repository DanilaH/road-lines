import { themes, type Theme } from '../content/themes';
/** Affordable discoveries lead; rotate within the same budget tier without repeating the last offer. */
export function themeSuggestions(owned: readonly string[], coins: number, previous: string | null, random = Math.random): Theme[] {
  const candidates = themes.filter(t => !owned.includes(t.id));
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  candidates.sort((a, b) => Number(b.price <= coins) - Number(a.price <= coins));
  if (candidates[0]?.id === previous) {
    const other = candidates.findIndex(t => t.id !== previous && (t.price <= coins) === (candidates[0]!.price <= coins));
    if (other > 0) [candidates[0], candidates[other]] = [candidates[other]!, candidates[0]!];
  }
  return candidates;
}
