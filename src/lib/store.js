// A small IndexedDB key-value store for data that is expensive to fetch and worth
// keeping across visits. Every call degrades to a no-op when IndexedDB is unavailable
// (private windows, blocked storage), so callers just fetch again.

const DB_NAME = 'stargazer'
const VERSION = 1
export const USERS = 'users'

let opening = null

function open() {
  opening ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION)
      req.onupgradeneeded = () => req.result.createObjectStore(USERS)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opening
}

function done(tx) {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true)
    tx.onerror = tx.onabort = () => resolve(false)
  })
}

/** Reads `keys` from `store`; returns a Map with only the keys that were found. */
export async function getMany(store, keys) {
  const found = new Map()
  const db = await open()
  if (!db) return found
  try {
    const tx = db.transaction(store, 'readonly')
    const os = tx.objectStore(store)
    for (const key of keys) {
      const req = os.get(key)
      req.onsuccess = () => {
        if (req.result !== undefined) found.set(key, req.result)
      }
    }
    await done(tx)
  } catch {
    // treat as a cache miss
  }
  return found
}

/** Writes every `[key, value]` entry to `store` in one transaction. */
export async function putMany(store, entries) {
  const db = await open()
  if (!db || !entries.length) return
  try {
    const tx = db.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    for (const [key, value] of entries) os.put(value, key)
    await done(tx)
  } catch {
    // quota exceeded or storage revoked; the data is simply fetched again next time
  }
}

/** Deletes entries of `store` for which `stale(value)` is true. */
export async function prune(store, stale) {
  const db = await open()
  if (!db) return
  try {
    const tx = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      if (stale(cursor.value)) cursor.delete()
      cursor.continue()
    }
    await done(tx)
  } catch {
    // best effort
  }
}
