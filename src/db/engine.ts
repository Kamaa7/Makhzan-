import type { Database, SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import schemaSql from "./schema.sql?raw";

const IDB_NAME = "makhzan";
const IDB_STORE = "sqlite";
const IDB_KEY = "db";
const IDB_BACKUP_KEY = "backup";
const IDB_BACKUP_AT_KEY = "backupAt";
const LS_BACKUP_AT = "makhzan.lastBackupAt";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let persistTail: Promise<void> = Promise.resolve();

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) idb.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open local storage"));
  });
}

async function idbGet(): Promise<Uint8Array | null> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => {
      const value = req.result;
      resolve(value instanceof Uint8Array ? value : value ? new Uint8Array(value) : null);
    };
    req.onerror = () => reject(req.error ?? new Error("Could not read local database"));
    tx.oncomplete = () => idb.close();
  });
}

async function idbPut(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => {
      idb.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("Could not save local database"));
  });
}

async function loadInitSqlJs(): Promise<(config?: object) => Promise<SqlJsStatic>> {
  const mod = await import("sql.js");
  const init = (mod as { default?: unknown }).default ?? mod;
  if (typeof init !== "function") {
    throw new Error("sql.js did not expose an initializer (Vite must pre-bundle it)");
  }
  return init as (config?: object) => Promise<SqlJsStatic>;
}

async function getSql(): Promise<SqlJsStatic> {
  if (SQL) return SQL;
  const initSqlJs = await loadInitSqlJs();
  SQL = await initSqlJs({ locateFile: () => wasmUrl });
  return SQL;
}

function migrateSalesRoundOff(database: Database): void {
  const info = database.exec("PRAGMA table_info(sales)");
  const names = (info[0]?.values ?? []).map((row) => String(row[1]));
  if (!names.includes("round_off")) {
    database.run("ALTER TABLE sales ADD COLUMN round_off INTEGER NOT NULL DEFAULT 0");
  }
}

export async function initDb(): Promise<void> {
  if (db) return;
  const sql = await getSql();
  const saved = await idbGet();
  db = saved ? new sql.Database(saved) : new sql.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.exec(schemaSql);
  migrateSalesRoundOff(db);
  await persistDb();
}

export function getDb(): Database {
  if (!db) throw new Error("Local database is not ready yet");
  return db;
}

export function persistDb(): Promise<void> {
  persistTail = persistTail
    .then(() => idbPut(getDb().export()))
    .catch((err) => {
      console.error(err);
    });
  return persistTail;
}

function localDateStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function writeBackupAt(iso: string): void {
  try {
    localStorage.setItem(LS_BACKUP_AT, iso);
  } catch {
    /* private mode */
  }
}

export function readLastBackupAt(): string | null {
  try {
    const value = localStorage.getItem(LS_BACKUP_AT);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function formatLastBackupAt(iso: string | null): string {
  if (!iso) return "No backup yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No backup yet";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function idbPutBackup(bytes: Uint8Array, at: string): Promise<void> {
  return new Promise((resolve, reject) => {
    void openIdb()
      .then((idb) => {
        const tx = idb.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        store.put(bytes, IDB_BACKUP_KEY);
        store.put(at, IDB_BACKUP_AT_KEY);
        tx.oncomplete = () => {
          idb.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error("Could not save automatic backup"));
      })
      .catch(reject);
  });
}

/** Copy the live SQLite file into a second IndexedDB key. Does not download a file. */
export function refreshAutoBackup(): Promise<void> {
  persistTail = persistTail
    .then(() => {
      const bytes = getDb().export();
      const at = new Date().toISOString();
      writeBackupAt(at);
      return idbPutBackup(bytes, at);
    })
    .catch((err) => {
      console.error(err);
    });
  return persistTail;
}

/** Download the live database (not a stale auto-copy), then refresh Last backup. */
export async function saveKeeperBackup(): Promise<void> {
  downloadDbFile(`makhzan-backup-${localDateStamp()}.db`);
  await refreshAutoBackup();
}

export function allRows(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = getDb().prepare(sql);
  try {
    stmt.bind(params as never[]);
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

export function oneRow(sql: string, params: unknown[] = []): Record<string, unknown> | null {
  return allRows(sql, params)[0] ?? null;
}

export function runSql(sql: string, params: unknown[] = []): void {
  getDb().run(sql, params as never[]);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function exportDbBytes(): Uint8Array {
  return getDb().export();
}

export async function replaceDb(bytes: Uint8Array): Promise<void> {
  const sql = await getSql();
  const next = new sql.Database(bytes);
  next.run("PRAGMA foreign_keys = ON");
  const check = next.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
  if (!check.length || !check[0].values.length) {
    next.close();
    throw new Error("That file is not a Makhzan database");
  }
  next.exec(schemaSql);
  migrateSalesRoundOff(next);
  db?.close();
  db = next;
  await persistDb();
  await refreshAutoBackup();
}

export function downloadDbFile(filename = "makhzan.db"): void {
  const bytes = exportDbBytes();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
