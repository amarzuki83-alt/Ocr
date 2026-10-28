/**
 * Web Share Target IndexedDB Bridge
 * Allows the Service Worker to pass shared images received from the Phone Gallery
 * to the React application client seamlessly.
 */

const DB_NAME = 'AtharDigitalPwaDB';
const DB_VERSION = 1;
const STORE_NAME = 'sharedFiles';
const KEY_NAME = 'latest-shared-image';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e: any) => resolve(e.target.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Checks and retrieves any image shared from the mobile phone gallery
 * Removes the image from storage after retrieval to avoid duplicate scans.
 */
export async function getSharedImageFromIdb(): Promise<File | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_NAME);

      req.onsuccess = () => {
        const result = req.result;
        if (result) {
          // Clean up so it doesn't trigger on future standard refreshes
          store.delete(KEY_NAME);
          tx.oncomplete = () => {
            db.close();
            // Convert to standard File if stored as Blob
            if (result instanceof File) {
              resolve(result);
            } else if (result instanceof Blob) {
              const file = new File([result], 'shared-gallery-receipt.jpg', {
                type: result.type || 'image/jpeg',
              });
              resolve(file);
            } else {
              resolve(null);
            }
          };
        } else {
          db.close();
          resolve(null);
        }
      };

      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('[PWA] Failed to check shared image from IndexedDB:', err);
    return null;
  }
}

/**
 * Saves a file to IndexedDB (used as client-side fallback if needed)
 */
export async function saveSharedImageToIdb(file: File | Blob): Promise<boolean> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(file, KEY_NAME);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[PWA] Failed to save shared image:', err);
    return false;
  }
}
