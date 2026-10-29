export interface RandomSource {
  next(): number;
}

export interface WeightedEntry<T> {
  value: T;
  weight: number;
}

export class MathRandomSource implements RandomSource {
  public next(): number {
    return Math.random();
  }
}

export const nextUnit = (random: RandomSource): number => {
  const sample = random.next();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error(`Random source returned invalid sample: ${sample}`);
  }
  return sample;
};

export const pickWeighted = <T>(entries: readonly WeightedEntry<T>[], random: RandomSource): T => {
  const usable = entries.filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0);
  const total = usable.reduce((sum, entry) => sum + entry.weight, 0);
  if (usable.length === 0 || total <= 0) {
    throw new Error('Cannot choose from an empty or zero-weight set');
  }

  const target = nextUnit(random) * total;
  let cursor = 0;
  for (const entry of usable) {
    cursor += entry.weight;
    if (target < cursor) return entry.value;
  }

  return usable[usable.length - 1]!.value;
};
