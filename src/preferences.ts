export const DEFAULT_MOTTO = 'of the lead-free world';
export const DEFAULT_MAP = '/steampunk-world-map-game-board.png';
export interface CustomMap { blob: Blob; name: string }

async function mapDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('leader.preferences', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not open local settings storage.'));
  });
}

export async function readCustomMap(): Promise<CustomMap | null> {
  const db = await mapDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('assets').objectStore('assets').get('background-map');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Could not load the custom map.'));
    });
  } finally { db.close(); }
}

export async function writeCustomMap(map: CustomMap | null): Promise<void> {
  const db = await mapDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('assets', 'readwrite');
      const store = transaction.objectStore('assets');
      if (map) store.put(map, 'background-map'); else store.delete('background-map');
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error('Could not save the custom map. Check available browser storage.'));
    });
  } finally { db.close(); }
}

export function validateMapDimensions(width: number, height: number): void {
  if (!width || width !== height) throw new Error('Choose a square image with a 1:1 aspect ratio.');
  if (width > 8192) throw new Error('Choose an image no larger than 8192 × 8192 pixels.');
}
