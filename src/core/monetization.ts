export const hintOffers = [{ count: 1, price: 60 }, { count: 3, price: 150 }] as const;
export const coinTopup = 150;
export interface AdReceipt { schema: 1; id: string; stream: string; sequence: number; session: string; placement: 'hint-coins' | 'theme-coins'; amount: 150; }
export interface AdLedger { stream: string | null; sequence: number; id: string | null; }
export const initialAdLedger = (): AdLedger => ({ stream: null, sequence: 0, id: null });
const token = (s: unknown): s is string => typeof s === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(s);
export function validAdLedger(x: unknown): x is AdLedger {
  const a = x as AdLedger;
  return Boolean(a && Number.isSafeInteger(a.sequence) && a.sequence >= 0 && (a.sequence === 0 ? a.stream === null && a.id === null : token(a.stream) && token(a.id)));
}
export function validAdReceipt(x: unknown): x is AdReceipt {
  const r = x as AdReceipt;
  return Boolean(r && r.schema === 1 && token(r.id) && token(r.stream) && token(r.session) && Number.isSafeInteger(r.sequence) && r.sequence > 0 && r.amount === coinTopup && (r.placement === 'hint-coins' || r.placement === 'theme-coins'));
}
