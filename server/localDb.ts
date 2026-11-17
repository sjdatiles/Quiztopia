import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

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
  private readonly db: any;
  private txMutex: Promise<void> = Promise.resolve();

  constructor(dbPath?: string) {
    const resolved = dbPath || path.resolve(process.cwd(), 'data', 'quiztopia.db');
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
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

  collection(name: string): LocalCollectionRef {
    return new LocalCollectionRef(this, name);
  }

  batch(): LocalWriteBatch {
    return new LocalWriteBatch(this);
  }

  async runTransaction<T>(fn: (tx: LocalTransaction) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const tx = new LocalTransaction(this);
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(tx);
        tx._applyAll();
        this.db.exec('COMMIT');
        return result;
      } catch (err) {
        try {
          this.db.exec('ROLLBACK');
        } catch {
          // ignore rollback error if transaction wasn't active
        }
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
    const stmt = this.db.prepare('SELECT data FROM documents WHERE collection = ? AND id = ?');
    const row = stmt.get(collectionName, id) as { data: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data);
  }

  _listRaw(collectionName: string): { id: string; data: DocData }[] {
    const stmt = this.db.prepare('SELECT id, data FROM documents WHERE collection = ?');
    const rows = stmt.all(collectionName) as { id: string; data: string }[];
    return rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) }));
  }

  _setRaw(collectionName: string, id: string, data: DocData, merge: boolean): void {
    let finalData = cloneData(data);
    if (merge) {
      const existing = this._getRaw(collectionName, id);
      if (existing) {
        finalData = { ...existing, ...finalData };
      }
    }
    const stmt = this.db.prepare(
      'INSERT INTO documents (collection, id, data) VALUES (?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data'
    );
    stmt.run(collectionName, id, JSON.stringify(finalData));
  }

  _updateRaw(collectionName: string, id: string, data: DocData): void {
    const existing = this._getRaw(collectionName, id);
    if (!existing) {
      throw new Error(`NOT_FOUND: Document ${collectionName}/${id} does not exist.`);
    }
    const merged = { ...existing, ...cloneData(data) };
    const stmt = this.db.prepare('UPDATE documents SET data = ? WHERE collection = ? AND id = ?');
    stmt.run(JSON.stringify(merged), collectionName, id);
  }

  _deleteRaw(collectionName: string, id: string): void {
    const stmt = this.db.prepare('DELETE FROM documents WHERE collection = ? AND id = ?');
    stmt.run(collectionName, id);
  }
}
