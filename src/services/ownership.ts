export class SaveOwnershipError extends Error {}
/** Hold a browser writer lock for the lifetime of this app instance. */
export function acquireSaveOwnership(): Promise<() => void> {
  if (!navigator.locks) return Promise.resolve(() => {});
  return new Promise((resolve, reject) => {
    void navigator.locks.request('road-lines-save-owner', { ifAvailable: true }, async lock => {
      if (!lock) { reject(new SaveOwnershipError('Игра уже открыта в другой вкладке. Закрой её и попробуй снова.')); return; }
      await new Promise<void>(release => resolve(release));
    }).catch(reject);
  });
}
