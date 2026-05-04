/**
 * IndexedDB storage for question media (images, screenshots of charts/tables).
 * Each entry is keyed by question ID and stores a Blob.
 * Using IndexedDB instead of localStorage avoids the ~5 MB size cap.
 */

const DB_NAME = 'aqui-media'
const DB_VERSION = 1
const STORE = 'question-media'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveMedia(questionId: string, file: File): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(file, questionId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Returns an object URL for the stored blob, or null if not found. Caller must revoke the URL when done. */
export async function getMediaObjectUrl(questionId: string): Promise<string | null> {
  const db = await openDB()
  const blob: Blob | null = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(questionId)
    req.onsuccess = () => resolve((req.result as Blob) ?? null)
    req.onerror = () => reject(req.error)
  })
  if (!blob) return null
  return URL.createObjectURL(blob)
}

export async function deleteMedia(questionId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(questionId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Returns the set of question IDs that have media stored. */
export async function listMediaIds(): Promise<Set<string>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAllKeys()
    req.onsuccess = () => resolve(new Set(req.result as string[]))
    req.onerror = () => reject(req.error)
  })
}
