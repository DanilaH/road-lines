export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class WebStorageAdapter implements StorageAdapter {
  public constructor(private readonly storage: Storage) {}

  public async getItem(key: string): Promise<string | null> {
    return this.storage.getItem(key);
  }

  public async setItem(key: string, value: string): Promise<void> {
    this.storage.setItem(key, value);
  }

  public async removeItem(key: string): Promise<void> {
    this.storage.removeItem(key);
  }
}
