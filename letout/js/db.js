// db.js — IndexedDB 封装（本地优先 / 轻量，符合「不为了 AI 而 AI」）
// 数据库：letout  v1
// 表：releases / meta
//
// 阅后即焚策略：每一次「释放」都会写一条 releases 行（模式 / 时长 / 时间 / peaks），
// 用于后台看板统计；但音频本体只在 keep=true 时才落盘。默认 keep=false → 不留存音频。

const DB_NAME = 'letout';
const DB_VERSION = 1;

let _dbPromise = null;

export function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('releases')) {
        const s = db.createObjectStore('releases', { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt', { unique: false });
        s.createIndex('mode', 'mode', { unique: false });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    let result;
    const r = fn(os);
    if (r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  }));
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));

// ---- releases ----
// rec: { mode, durationMs, peaks, keep, hasAudio, audioBlob? }
export function putRelease(rec) {
  const row = Object.assign({
    id: uid(),
    createdAt: Date.now(),
    keep: false,
    hasAudio: false,
    peaks: [],
    note: null,
  }, rec);
  return tx('releases', 'readwrite', (os) => os.add(row)).then(() => row);
}

export function getAllReleases() {
  return tx('releases', 'readonly', (os) => os.getAll()).then((rows) =>
    (rows || []).sort((a, b) => b.createdAt - a.createdAt));
}

export function deleteRelease(id) {
  return tx('releases', 'readwrite', (os) => os.delete(id));
}

// ---- meta ----
export function putMeta(key, value) {
  return tx('meta', 'readwrite', (os) => os.put({ key, value }));
}
export function getMeta(key) {
  return tx('meta', 'readonly', (os) => os.get(key)).then((r) => (r ? r.value : undefined));
}
