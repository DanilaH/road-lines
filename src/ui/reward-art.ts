import giftUrl from '../assets/rewards/gift.webp';
import giftSmallUrl from '../assets/rewards/gift-small.webp';
import medalUrl from '../assets/rewards/medallion.webp';

/** Decorative artwork only: labels and rewards remain real DOM and durable state. */
export function rewardArt(kind: 'gift' | 'medallion', large = false): string {
  const src = kind === 'gift' ? large ? giftUrl : giftSmallUrl : medalUrl;
  const size = kind === 'gift' && large ? 384 : kind === 'gift' ? 96 : 128;
  return `<img class="reward-art reward-art-${kind}${large ? ' reward-art-large' : ''}" src="${src}" width="${size}" height="${size}" alt="" aria-hidden="true" draggable="false" decoding="async">`;
}
