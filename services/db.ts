import { BucketItem } from '../types';

const DB_NAME = 'JustKickDB';
const DB_VERSION = 1;
const STORE_ITEMS = 'items';

export interface BackupData {
  items: BucketItem[];
  customBuckets: string[];
  customInterests: string[];
  exportedAt: number;
}

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_ITEMS)) {
          db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    return this.dbPromise;
  }

  async getAllItems(): Promise<BucketItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_ITEMS, 'readonly');
      const store = transaction.objectStore(STORE_ITEMS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveItem(item: BucketItem): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_ITEMS, 'readwrite');
      const store = transaction.objectStore(STORE_ITEMS);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteItem(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_ITEMS, 'readwrite');
      const store = transaction.objectStore(STORE_ITEMS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async exportBackup(customBuckets: string[], customInterests: string[]): Promise<void> {
    const items = await this.getAllItems();
    const backup: BackupData = {
      items,
      customBuckets,
      customInterests,
      exportedAt: Date.now()
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    // Format filename: justkick_backup_YYYY-MM-DD.json
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `justkick_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async importBackup(file: File): Promise<BackupData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const json = e.target?.result as string;
          const data = JSON.parse(json) as BackupData;
          
          if (!Array.isArray(data.items)) {
            throw new Error("Invalid backup file format");
          }

          const db = await this.getDB();
          const transaction = db.transaction(STORE_ITEMS, 'readwrite');
          const store = transaction.objectStore(STORE_ITEMS);
          
          // Clear current store before importing
          store.clear();

          data.items.forEach(item => store.put(item));
          
          // Wait for transaction complete
          transaction.oncomplete = () => resolve(data);
          transaction.onerror = () => reject(transaction.error);

        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}

export const localDB = new LocalDatabase();