import { openDB, type IDBPDatabase } from 'idb';

/**
 * Local persistence for the user's handwritten signature image.
 * Everything stays in IndexedDB — nothing ever leaves the browser.
 */

const DB_NAME = 'signy';
const DB_VERSION = 1;
const STORE_NAME = 'signature';
const RECORD_KEY = 'current';

export interface StoredSignature {
  /** Raw image bytes (PNG/JPEG) as uploaded by the user. */
  blob: Blob;
  fileName: string;
  mimeType: string;
  savedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveSignature(file: File): Promise<StoredSignature> {
  const record: StoredSignature = {
    blob: file,
    fileName: file.name,
    mimeType: file.type,
    savedAt: Date.now(),
  };
  const db = await getDb();
  await db.put(STORE_NAME, record, RECORD_KEY);
  return record;
}

export async function loadSignature(): Promise<StoredSignature | undefined> {
  const db = await getDb();
  return db.get(STORE_NAME, RECORD_KEY);
}

export async function deleteSignature(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, RECORD_KEY);
}
