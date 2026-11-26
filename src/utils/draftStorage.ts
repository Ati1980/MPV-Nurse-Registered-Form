import type { UploadedDocumentItem } from '../types/application.ts';

const DB_NAME = 'mpv_nurse_2570_draft_idb';
const STORE_NAME = 'draft_files';
const FILES_KEY = 'current_documents';

function openDraftDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveDraftDocumentsToIdb(documents: UploadedDocumentItem[]): Promise<void> {
  const db = await openDraftDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(documents, FILES_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } finally {
    db.close();
  }
}

export async function loadDraftDocumentsFromIdb(): Promise<UploadedDocumentItem[] | null> {
  const db = await openDraftDb();
  if (!db) return null;
  try {
    return await new Promise<UploadedDocumentItem[] | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(FILES_KEY);
      req.onsuccess = () => {
        resolve(Array.isArray(req.result) ? (req.result as UploadedDocumentItem[]) : null);
      };
      req.onerror = () => resolve(null);
    });
  } finally {
    db.close();
  }
}

export async function clearDraftDocumentsFromIdb(): Promise<void> {
  const db = await openDraftDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(FILES_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } finally {
    db.close();
  }
}
