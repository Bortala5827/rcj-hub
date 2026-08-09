// db.js — IndexedDB 封装（原生，无第三方依赖，符合「轻量优先 / 本地优先」）
// 数据库：solospeak  v1
// 表：recordings / topics / goals / meta

const DB_NAME = 'solospeak';
const DB_VERSION = 1;

let _dbPromise = null;

export function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('recordings')) {
        const s = db.createObjectStore('recordings', { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt', { unique: false });
        s.createIndex('favorite', 'favorite', { unique: false });
      }
      if (!db.objectStoreNames.contains('topics')) {
        const s = db.createObjectStore('topics', { keyPath: 'id' });
        s.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains('goals')) {
        db.createObjectStore('goals', { keyPath: 'date' });
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

// ---- recordings ----
export function putRecording(rec) {
  const row = Object.assign({ id: uid(), createdAt: Date.now(), favorite: false }, rec);
  return tx('recordings', 'readwrite', (os) => os.add(row)).then(() => row);
}
export function getAllRecordings() {
  return tx('recordings', 'readonly', (os) => os.getAll()).then((rows) =>
    (rows || []).sort((a, b) => b.createdAt - a.createdAt));
}
export function deleteRecording(id) {
  return tx('recordings', 'readwrite', (os) => os.delete(id));
}
export function setFavorite(id, val) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction('recordings', 'readwrite');
    const os = t.objectStore('recordings');
    const g = os.get(id);
    g.onsuccess = () => {
      const row = g.result;
      if (row) { row.favorite = val; os.put(row); }
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  }));
}

// ---- topics ----
export function putTopic(topic) {
  return tx('topics', 'readwrite', (os) => os.add(Object.assign({ id: uid(), usageCount: 0, createdAt: Date.now() }, topic)));
}
export function getAllTopics() {
  return tx('topics', 'readonly', (os) => os.getAll()).then((r) => r || []);
}
export function incrementTopicUsage(id) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction('topics', 'readwrite');
    const os = t.objectStore('topics');
    const g = os.get(id);
    g.onsuccess = () => { const r = g.result; if (r) { r.usageCount = (r.usageCount || 0) + 1; os.put(r); } };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  }));
}

// ---- goals ----
export function putGoal(goal) {
  return tx('goals', 'readwrite', (os) => os.put(goal));
}
export function getGoal(date) {
  return tx('goals', 'readonly', (os) => os.get(date));
}

// ---- meta ----
export function putMeta(key, value) {
  return tx('meta', 'readwrite', (os) => os.put({ key, value }));
}
export function getMeta(key) {
  return tx('meta', 'readonly', (os) => os.get(key)).then((r) => (r ? r.value : undefined));
}
