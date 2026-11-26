import type { UploadedDocumentItem } from '../types/application.ts';

const DB_NAME = 'mpv_nurse_2570_draft_idb';
const DB_VERSION = 2;
const STORE_NAME = 'draft_files';
const SUBMITTED_STORE_NAME = 'submitted_files';
const FILES_KEY = 'current_documents';

export interface StoredSubmittedFile {
  dataUrl: string;
  mimeType: string;
  savedAt: string;
}

function submittedFileKey(applicationId: string, docId: string): string {
  return `${applicationId}::${docId}`;
}

function openDraftDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(SUBMITTED_STORE_NAME)) {
          db.createObjectStore(SUBMITTED_STORE_NAME);
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

export async function saveSubmittedFilesToIdb(
  applicationId: string,
  documents: UploadedDocumentItem[]
): Promise<void> {
  const withData = documents.filter((d) => d.dataUrl && d.dataUrl.startsWith('data:'));
  if (withData.length === 0) return;
  const db = await openDraftDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(SUBMITTED_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SUBMITTED_STORE_NAME);
      const now = new Date().toISOString();
      for (const d of withData) {
        if (!d.dataUrl) continue;
        const entry: StoredSubmittedFile = {
          dataUrl: d.dataUrl,
          mimeType: d.mimeType,
          savedAt: now,
        };
        store.put(entry, submittedFileKey(applicationId, d.id));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } finally {
    db.close();
  }
}

export async function saveSingleSubmittedFileToIdb(
  applicationId: string,
  docId: string,
  dataUrl: string,
  mimeType: string
): Promise<void> {
  if (!dataUrl.startsWith('data:')) return;
  const db = await openDraftDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(SUBMITTED_STORE_NAME, 'readwrite');
      const entry: StoredSubmittedFile = {
        dataUrl,
        mimeType,
        savedAt: new Date().toISOString(),
      };
      tx.objectStore(SUBMITTED_STORE_NAME).put(entry, submittedFileKey(applicationId, docId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } finally {
    db.close();
  }
}

export async function loadSubmittedFileFromIdb(
  applicationId: string,
  docId: string
): Promise<StoredSubmittedFile | null> {
  const db = await openDraftDb();
  if (!db) return null;
  try {
    return await new Promise<StoredSubmittedFile | null>((resolve) => {
      const tx = db.transaction(SUBMITTED_STORE_NAME, 'readonly');
      const req = tx.objectStore(SUBMITTED_STORE_NAME).get(submittedFileKey(applicationId, docId));
      req.onsuccess = () => {
        const res = req.result as StoredSubmittedFile | undefined;
        resolve(res && typeof res.dataUrl === 'string' ? res : null);
      };
      req.onerror = () => resolve(null);
    });
  } finally {
    db.close();
  }
}

export async function deleteSubmittedFilesFromIdb(
  applicationId: string,
  docIds: string[]
): Promise<void> {
  if (docIds.length === 0) return;
  const db = await openDraftDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(SUBMITTED_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SUBMITTED_STORE_NAME);
      for (const docId of docIds) {
        store.delete(submittedFileKey(applicationId, docId));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } finally {
    db.close();
  }
}
