export interface Theme {
  id: string; name: string; price: number;
  background: string; empty: string; ribbon: string; trail: string;
  ink: string; muted: string; panel: string; soft: string;
  accent: string; primary: string; primaryInk: string; selected: string;
}

export const themes: readonly Theme[] = [
  { id: 'classic', name: 'Классика', price: 0, background: '#fff9ef', empty: '#e1e3e5', ribbon: '#8550ed', trail: '#ffffff', ink: '#362447', muted: '#8d7d93', panel: '#fffdf7', soft: '#f3ebdf', accent: '#8150ce', primary: '#8550ed', primaryInk: '#ffffff', selected: '#e9defb' },
  { id: 'mint', name: 'Мята', price: 0, background: '#f4faf2', empty: '#dce8d9', ribbon: '#20ae79', trail: '#eaffdb', ink: '#304d3d', muted: '#6c8774', panel: '#e3eee0', soft: '#edf4e9', accent: '#347c52', primary: '#379b68', primaryInk: '#ffffff', selected: '#d0e9d1' },
  { id: 'lagoon', name: 'Лагуна', price: 500, background: '#f1fafb', empty: '#d5e7e9', ribbon: '#129fc3', trail: '#d9ffff', ink: '#244952', muted: '#6c8990', panel: '#deedf0', soft: '#e8f4f6', accent: '#11798f', primary: '#168caa', primaryInk: '#ffffff', selected: '#c9e7eb' },
  { id: 'sunset', name: 'Закат', price: 500, background: '#fff6ee', empty: '#efdfd4', ribbon: '#ee7452', trail: '#fff5ce', ink: '#64463f', muted: '#a08476', panel: '#f3e5d9', soft: '#fbede1', accent: '#b65b40', primary: '#c65d42', primaryInk: '#ffffff', selected: '#f8d9c8' },
  { id: 'lavender', name: 'Лаванда', price: 500, background: '#f8f3fc', empty: '#e4dbed', ribbon: '#b855d3', trail: '#fff0ff', ink: '#574261', muted: '#95809f', panel: '#ece2f3', soft: '#f2eaf8', accent: '#8d4ba5', primary: '#a35dba', primaryInk: '#ffffff', selected: '#e8d2f0' },
  { id: 'honey', name: 'Мёд', price: 500, background: '#fffae9', empty: '#eae3cc', ribbon: '#b88122', trail: '#fff5c0', ink: '#584b32', muted: '#958969', panel: '#eee7cf', soft: '#f7f0db', accent: '#966919', primary: '#a7741f', primaryInk: '#ffffff', selected: '#f5dfa7' },
  { id: 'dusk', name: 'Сумерки', price: 500, background: '#202335', empty: '#3c4058', ribbon: '#a38afa', trail: '#f4efff', ink: '#eeeaf7', muted: '#a3a4bf', panel: '#30344b', soft: '#282c41', accent: '#bca7ff', primary: '#a38afa', primaryInk: '#211b37', selected: '#50416c' },
  { id: 'neon', name: 'Неон', price: 500, background: '#192725', empty: '#354945', ribbon: '#a8d94b', trail: '#283c16', ink: '#ecf4e7', muted: '#9bad9c', panel: '#293e37', soft: '#22332e', accent: '#b1df6a', primary: '#a8d94b', primaryInk: '#203314', selected: '#405535' },
];
export const defaultTheme = themes[0]!;
export const freeThemeIds = themes.filter(t => t.price === 0).map(t => t.id);
export function getTheme(id: string): Theme {
  const theme = themes.find(t => t.id === id);
  if (!theme) throw Error('Unknown theme');
  return theme;
}
export const colorNumber = (hex: string): number => Number.parseInt(hex.slice(1), 16);

/** Small colour shifts keep the ribbon continuous across cell and connector boundaries. */
export function tint(hex: string, amount: number): number {
  const value = colorNumber(hex), target = amount < 0 ? 0 : 255, weight = Math.abs(amount);
  return [16, 8, 0].reduce((color, shift) => color | Math.round(((value >> shift) & 255) * (1 - weight) + target * weight) << shift, 0);
}
