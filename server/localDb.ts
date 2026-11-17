import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

type DocData = Record<string, any>;

export interface LocalDocSnapshot {
  id: string;
  exists: boolean;
  ref: LocalDocRef;
  data: () => DocData | undefined;
}

export interface LocalQuerySnapshot {
  docs: LocalDocSnapshot[];
  empty: boolean;
  size: number;
}

type WhereFilter = {
  field: string;
  op: '==' | '!=' | 'in' | '<' | '<=' | '>' | '>=';
  value: any;
};

interface StorageBackend {
  getRaw(collectionName: string, id: string): DocData | null;
  listRaw(collectionName: string): { id: string; data: DocData }[];
  setRaw(collectionName: string, id: string, data: DocData, merge: boolean): void;
  updateRaw(collectionName: string, id: string, data: DocData): void;
  deleteRaw(collectionName: string, id: string): void;
  beginImmediate(): void;
  commit(): void;
  rollback(): void;
}

function cloneData<T>(val: T): T {
  if (val === undefined) return val;
  return JSON.parse(JSON.stringify(val));
}

function getFieldValue(obj: DocData, fieldPath: string): any {
  const parts = fieldPath.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function matchesFilter(doc: DocData, f: WhereFilter): boolean {
  const actual = getFieldValue(doc, f.field);
  switch (f.op) {
    case '==':
      return actual === f.value;
    case '!=':
      return actual !== f.value;
    case 'in':
      return Array.isArray(f.value) && f.value.includes(actual);
    case '<':
      return actual < f.value;
    case '<=':
      return actual <= f.value;
    case '>':
      return actual > f.value;
    case '>=':
      return actual >= f.value;
    default:
      return false;
  }
}

class SqliteBackend implements StorageBackend {
  private readonly db: any;

  constructor(DatabaseSyncCtor: any, dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSyncCtor(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS documents (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      );
      CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents (collection);
    `);
  }

  getRaw(collectionName: string, id: string): DocData | null {
    const stmt = this.db.prepare('SELECT data FROM documents WHERE collection = ? AND id = ?');
    const row = stmt.get(collectionName, id) as { data: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data);
  }

  listRaw(collectionName: string): { id: string; data: DocData }[] {
    const stmt = this.db.prepare('SELECT id, data FROM documents WHERE collection = ?');
    const rows = stmt.all(collectionName) as { id: string; data: string }[];
    return rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) }));
  }

  setRaw(collectionName: string, id: string, data: DocData, merge: boolean): void {
    let finalData = cloneData(data);
    if (merge) {
      const existing = this.getRaw(collectionName, id);
      if (existing) {
        finalData = { ...existing, ...finalData };
      }
    }
    const stmt = this.db.prepare(
      'INSERT INTO documents (collection, id, data) VALUES (?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data'
    );
    stmt.run(collectionName, id, JSON.stringify(finalData));
  }

  updateRaw(collectionName: string, id: string, data: DocData): void {
    const existing = this.getRaw(collectionName, id);
    if (!existing) {
      throw new Error(`NOT_FOUND: Document ${collectionName}/${id} does not exist.`);
    }
    const merged = { ...existing, ...cloneData(data) };
    const stmt = this.db.prepare('UPDATE documents SET data = ? WHERE collection = ? AND id = ?');
    stmt.run(JSON.stringify(merged), collectionName, id);
  }

  deleteRaw(collectionName: string, id: string): void {
    const stmt = this.db.prepare('DELETE FROM documents WHERE collection = ? AND id = ?');
    stmt.run(collectionName, id);
  }

  beginImmediate(): void {
    this.db.exec('BEGIN IMMEDIATE');
  }

  commit(): void {
    this.db.exec('COMMIT');
  }

  rollback(): void {
    try {
      this.db.exec('ROLLBACK');
    } catch {
      // ignore if not active
    }
  }
}

class JsonFileBackend implements StorageBackend {
  private readonly filePath: string;
  private store: Record<string, Record<string, DocData>> = {};
  private snapshot: Record<string, Record<string, DocData>> | null = null;
  private inTx = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      if (fs.existsSync(filePath)) {
        this.store = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      this.store = {};
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.store), 'utf-8');
    } catch {
      // Best-effort persistence if running in ultra-restricted environment
    }
  }

  getRaw(collectionName: string, id: string): DocData | null {
    const col = this.store[collectionName];
    return col && col[id] ? cloneData(col[id]) : null;
  }

  listRaw(collectionName: string): { id: string; data: DocData }[] {
    const col = this.store[collectionName] || {};
    return Object.entries(col).map(([id, data]) => ({ id, data: cloneData(data) }));
  }

  setRaw(collectionName: string, id: string, data: DocData, merge: boolean): void {
    if (!this.store[collectionName]) this.store[collectionName] = {};
    let finalData = cloneData(data);
    if (merge && this.store[collectionName][id]) {
      finalData = { ...this.store[collectionName][id], ...finalData };
    }
    this.store[collectionName][id] = finalData;
    if (!this.inTx) this.persist();
  }

  updateRaw(collectionName: string, id: string, data: DocData): void {
    const existing = this.store[collectionName]?.[id];
    if (!existing) {
      throw new Error(`NOT_FOUND: Document ${collectionName}/${id} does not exist.`);
    }
    this.store[collectionName][id] = { ...existing, ...cloneData(data) };
    if (!this.inTx) this.persist();
  }

  deleteRaw(collectionName: string, id: string): void {
    if (this.store[collectionName]) {
      delete this.store[collectionName][id];
      if (!this.inTx) this.persist();
    }
  }

  beginImmediate(): void {
    this.inTx = true;
    this.snapshot = cloneData(this.store);
  }

  commit(): void {
    this.inTx = false;
    this.snapshot = null;
    this.persist();
  }

  rollback(): void {
    if (this.snapshot) {
      this.store = this.snapshot;
    }
    this.inTx = false;
    this.snapshot = null;
  }
}

export class LocalDocRef {
  readonly collectionName: string;
  readonly id: string;
  private readonly store: LocalFirestoreDb;

  constructor(store: LocalFirestoreDb, collectionName: string, id: string) {
    this.store = store;
    this.collectionName = collectionName;
    this.id = id;
  }

  async get(): Promise<LocalDocSnapshot> {
    const raw = this.store._getRaw(this.collectionName, this.id);
    if (!raw) {
      return { id: this.id, exists: false, ref: this, data: () => undefined };
    }
    return {
      id: this.id,
      exists: true,
      ref: this,
      data: () => cloneData(raw),
    };
  }

  async set(data: DocData, options?: { merge?: boolean }): Promise<void> {
    this.store._setRaw(this.collectionName, this.id, data, Boolean(options?.merge));
  }

  async update(data: DocData): Promise<void> {
    this.store._updateRaw(this.collectionName, this.id, data);
  }

  async delete(): Promise<void> {
    this.store._deleteRaw(this.collectionName, this.id);
  }
}

export class LocalQuery {
  private readonly store: LocalFirestoreDb;
  private readonly collectionName: string;
  private readonly filters: WhereFilter[];
  private readonly limitCount: number | null;

  constructor(
    store: LocalFirestoreDb,
    collectionName: string,
    filters: WhereFilter[] = [],
    limitCount: number | null = null
  ) {
    this.store = store;
    this.collectionName = collectionName;
    this.filters = filters;
    this.limitCount = limitCount;
  }

  where(field: string, op: WhereFilter['op'], value: any): LocalQuery {
    return new LocalQuery(
      this.store,
      this.collectionName,
      [...this.filters, { field, op, value }],
      this.limitCount
    );
  }

  limit(n: number): LocalQuery {
    return new LocalQuery(this.store, this.collectionName, this.filters, n);
  }

  async get(): Promise<LocalQuerySnapshot> {
    const rows = this.store._listRaw(this.collectionName);
    const matched: LocalDocSnapshot[] = [];
    for (const row of rows) {
      if (this.filters.every((f) => matchesFilter(row.data, f))) {
        const ref = new LocalDocRef(this.store, this.collectionName, row.id);
        const copied = cloneData(row.data);
        matched.push({
          id: row.id,
          exists: true,
          ref,
          data: () => cloneData(copied),
        });
        if (this.limitCount !== null && matched.length >= this.limitCount) {
          break;
        }
      }
    }
    return {
      docs: matched,
      empty: matched.length === 0,
      size: matched.length,
    };
  }
}

export class LocalCollectionRef extends LocalQuery {
  private readonly _store: LocalFirestoreDb;
  private readonly _name: string;

  constructor(store: LocalFirestoreDb, name: string) {
    super(store, name);
    this._store = store;
    this._name = name;
  }

  doc(id: string): LocalDocRef {
    return new LocalDocRef(this._store, this._name, id);
  }
}

export class LocalTransaction {
  private readonly store: LocalFirestoreDb;
  private readonly ops: (() => void)[] = [];

  constructor(store: LocalFirestoreDb) {
    this.store = store;
  }

  async get(ref: LocalDocRef): Promise<LocalDocSnapshot> {
    return ref.get();
  }

  set(ref: LocalDocRef, data: DocData, options?: { merge?: boolean }): LocalTransaction {
    const snapshot = cloneData(data);
    this.ops.push(() => {
      this.store._setRaw(ref.collectionName, ref.id, snapshot, Boolean(options?.merge));
    });
    return this;
  }

  update(ref: LocalDocRef, data: DocData): LocalTransaction {
    const snapshot = cloneData(data);
    this.ops.push(() => {
      this.store._updateRaw(ref.collectionName, ref.id, snapshot);
    });
    return this;
  }

  delete(ref: LocalDocRef): LocalTransaction {
    this.ops.push(() => {
      this.store._deleteRaw(ref.collectionName, ref.id);
    });
    return this;
  }

  _applyAll(): void {
    for (const op of this.ops) op();
  }
}

export class LocalWriteBatch {
  private readonly store: LocalFirestoreDb;
  private readonly ops: (() => void)[] = [];

  constructor(store: LocalFirestoreDb) {
    this.store = store;
  }

  set(ref: LocalDocRef, data: DocData, options?: { merge?: boolean }): LocalWriteBatch {
    const snapshot = cloneData(data);
    this.ops.push(() => {
      this.store._setRaw(ref.collectionName, ref.id, snapshot, Boolean(options?.merge));
    });
    return this;
  }

  update(ref: LocalDocRef, data: DocData): LocalWriteBatch {
    const snapshot = cloneData(data);
    this.ops.push(() => {
      this.store._updateRaw(ref.collectionName, ref.id, snapshot);
    });
    return this;
  }

  delete(ref: LocalDocRef): LocalWriteBatch {
    this.ops.push(() => {
      this.store._deleteRaw(ref.collectionName, ref.id);
    });
    return this;
  }

  async commit(): Promise<void> {
    await this.store.runTransaction(async () => {
      for (const op of this.ops) op();
    });
  }
}

export class LocalFirestoreDb {
  private readonly backend: StorageBackend;
  private txMutex: Promise<void> = Promise.resolve();

  constructor(dbPath?: string) {
    // Use /tmp on serverless platforms (like Vercel) where process.cwd() is read-only
    const baseDir = process.env.VERCEL ? '/tmp/quiztopia-data' : path.resolve(process.cwd(), 'data');
    const sqlitePath = dbPath || path.join(baseDir, 'quiztopia.db');
    const jsonPath = path.join(baseDir, 'quiztopia.json');

    let selected: StorageBackend | null = null;
    try {
      const require = createRequire(import.meta.url);
      const sqliteMod = require('node:sqlite');
      if (sqliteMod?.DatabaseSync) {
        selected = new SqliteBackend(sqliteMod.DatabaseSync, sqlitePath);
      }
    } catch {
      selected = null;
    }

    this.backend = selected || new JsonFileBackend(jsonPath);
  }

  collection(name: string): LocalCollectionRef {
    return new LocalCollectionRef(this, name);
  }

  batch(): LocalWriteBatch {
    return new LocalWriteBatch(this);
  }

  async runTransaction<T>(fn: (tx: LocalTransaction) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const tx = new LocalTransaction(this);
      this.backend.beginImmediate();
      try {
        const result = await fn(tx);
        tx._applyAll();
        this.backend.commit();
        return result;
      } catch (err) {
        this.backend.rollback();
        throw err;
      }
    };

    const next = this.txMutex.then(run, run);
    this.txMutex = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  _getRaw(collectionName: string, id: string): DocData | null {
    return this.backend.getRaw(collectionName, id);
  }

  _listRaw(collectionName: string): { id: string; data: DocData }[] {
    return this.backend.listRaw(collectionName);
  }

  _setRaw(collectionName: string, id: string, data: DocData, merge: boolean): void {
    this.backend.setRaw(collectionName, id, data, merge);
  }

  _updateRaw(collectionName: string, id: string, data: DocData): void {
    this.backend.updateRaw(collectionName, id, data);
  }

  _deleteRaw(collectionName: string, id: string): void {
    this.backend.deleteRaw(collectionName, id);
  }
}
