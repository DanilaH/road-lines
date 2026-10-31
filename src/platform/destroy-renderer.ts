import type Phaser from 'phaser';

/** destroy() is deferred by Phaser; a sleeping loop still needs its final step. */
export function destroyRenderer(game: Phaser.Game, destroyed: () => void): void {
  game.events.once('destroy', destroyed);
  game.destroy(true);
  if (game.loop.started && !game.loop.running) game.loop.wake();
}
