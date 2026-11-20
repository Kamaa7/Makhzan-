import type { Database, SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import {
  desktopBackupIfCurrent,
  desktopComparePut,
  desktopForcePut,
  desktopReadShop,
  desktopSaveCopy,
  isDesktop,
} from "../lib/desktop";
import schemaSql from "./schema.sql?raw";

const IDB_NAME = "makhzan";
const IDB_STORE = "sqlite";
const IDB_KEY = "db";
const IDB_GEN_KEY = "gen";
const IDB_BACKUP_KEY = "backup";
const IDB_BACKUP_AT_KEY = "backupAt";
const LS_BACKUP_AT = "makhzan.lastBackupAt";
const SHOP_CHANNEL = "makhzan-shop";

class ShopChangedError extends Error {
  constructor() {
    super("Another window saved the shop. Reload this window before you continue.");
    this.name = "ShopChangedError";
  }
}

function isShopChangedError(err: unknown): boolean {
  return err instanceof ShopChangedError || (err instanceof Error && err.name === "ShopChangedError");
}

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let loadedGeneration = 0;
let stale = false;
let watchReady = false;
let persistTail: Promise<void> = Promise.resolve();
let shopChannel: BroadcastChannel | null = null;

function watchOtherWindows(): void {
  if (shopChannel || typeof BroadcastChannel === "undefined") return;
  shopChannel = new BroadcastChannel(SHOP_CHANNEL);
  shopChannel.onmessage = (event: MessageEvent<{ generation?: unknown }>) => {
    if (!watchReady) return;
    const generation = event.data?.generation;
    if (typeof generation !== "number" || generation === loadedGeneration) return;
    markStale();
  };
}

function publishGeneration(generation: number): void {
  loadedGeneration = generation;
  shopChannel?.postMessage({ generation });
}

function markStale(): void {
  if (stale) return;
  stale = true;
  window.dispatchEvent(new Event("makhzan-shop-changed"));
}

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

function toBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function readGeneration(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

async function idbReadSnapshot(): Promise<{ bytes: Uint8Array | null; generation: number }> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const dbReq = store.get(IDB_KEY);
    const genReq = store.get(IDB_GEN_KEY);
    let bytes: Uint8Array | null = null;
    let generation = 0;
    dbReq.onsuccess = () => {
      bytes = toBytes(dbReq.result);
    };
    genReq.onsuccess = () => {
      generation = readGeneration(genReq.result);
    };
    tx.oncomplete = () => {
      idb.close();
      resolve({ bytes, generation });
    };
    tx.onerror = () => {
      idb.close();
      reject(tx.error ?? new Error("Could not read local database"));
    };
  });
}

function settleTransaction<T>(
  idb: IDBDatabase,
  tx: IDBTransaction,
  resolve: (value: T) => void,
  reject: (err: Error) => void,
): { finish: (value: T) => void; fail: (err: Error) => void; reason: { current: Error | null } } {
  let settled = false;
  const reason = { current: null as Error | null };
  const fail = (err: Error) => {
    if (settled) return;
    settled = true;
    idb.close();
    reject(err);
  };
  const finish = (value: T) => {
    if (settled) return;
    settled = true;
    idb.close();
    resolve(value);
  };
  tx.onerror = (event) => {
    event.preventDefault();
    fail(reason.current ?? tx.error ?? new Error("Could not save local database"));
  };
  return { finish, fail, reason };
}

/** Write the shop file only when this window still holds the generation it loaded. */
function idbCompareAndPut(bytes: Uint8Array, expected: number): Promise<number> {
  return openIdb().then(
    (idb) =>
      new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, "readwrite");
        const { finish, fail, reason } = settleTransaction<number>(idb, tx, resolve, reject);
        const store = tx.objectStore(IDB_STORE);
        const genReq = store.get(IDB_GEN_KEY);
        genReq.onsuccess = () => {
          const current = readGeneration(genReq.result);
          if (current !== expected) {
            reason.current = new ShopChangedError();
            tx.abort();
            fail(reason.current);
            return;
          }
          store.put(bytes, IDB_KEY);
          store.put(expected + 1, IDB_GEN_KEY);
        };
        genReq.onerror = () => fail(genReq.error ?? new Error("Could not read the shop file"));
        tx.oncomplete = () => finish(expected + 1);
      }),
  );
}

/** Import replaces the shop on this computer, so it takes the next generation. */
function idbForcePut(bytes: Uint8Array): Promise<number> {
  return openIdb().then(
    (idb) =>
      new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, "readwrite");
        const { finish, fail } = settleTransaction<number>(idb, tx, resolve, reject);
        const store = tx.objectStore(IDB_STORE);
        let next = 1;
        const genReq = store.get(IDB_GEN_KEY);
        genReq.onsuccess = () => {
          next = readGeneration(genReq.result) + 1;
          store.put(bytes, IDB_KEY);
          store.put(next, IDB_GEN_KEY);
        };
        genReq.onerror = () => fail(genReq.error ?? new Error("Could not read the shop file"));
        tx.oncomplete = () => finish(next);
      }),
  );
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

function columnNames(database: Database, table: string): string[] {
  const info = database.exec(`PRAGMA table_info(${table})`);
  return (info[0]?.values ?? []).map((row) => String(row[1]));
}

function migrateSalesRoundOff(database: Database): boolean {
  const names = columnNames(database, "sales");
  if (!names.includes("round_off")) {
    database.run("ALTER TABLE sales ADD COLUMN round_off INTEGER NOT NULL DEFAULT 0");
    return true;
  }
  return false;
}

function migratePharmacy(database: Database): boolean {
  let changed = false;
  const sales = columnNames(database, "sales");
  if (!sales.includes("patient_name")) {
    database.run("ALTER TABLE sales ADD COLUMN patient_name TEXT NOT NULL DEFAULT ''");
    database.run("ALTER TABLE sales ADD COLUMN doctor_name TEXT NOT NULL DEFAULT ''");
    database.run("ALTER TABLE sales ADD COLUMN prescription_note TEXT NOT NULL DEFAULT ''");
    changed = true;
  }
  const items = columnNames(database, "sale_items");
  if (!items.includes("batch_no")) {
    database.run("ALTER TABLE sale_items ADD COLUMN batch_no TEXT NOT NULL DEFAULT ''");
    database.run("ALTER TABLE sale_items ADD COLUMN expiry_date TEXT NOT NULL DEFAULT ''");
    changed = true;
  }
  const pending = database.exec(
    `SELECT p.id, p.user_id, p.stock_qty
     FROM products p
     WHERE p.stock_qty > 0
       AND NOT EXISTS (SELECT 1 FROM stock_batches b WHERE b.product_id = p.id)`,
  );
  const rows = pending[0]?.values ?? [];
  const stamp = new Date().toISOString();
  for (const row of rows) {
    database.run(
      `INSERT INTO stock_batches (id, user_id, product_id, batch_no, expiry_date, qty, created_at)
       VALUES (?, ?, ?, '', '', ?, ?)`,
      [crypto.randomUUID(), String(row[1]), String(row[0]), Number(row[2]), stamp],
    );
    changed = true;
  }
  return changed;
}

function openShop(sql: SqlJsStatic, bytes: Uint8Array | null): Database {
  const database = bytes ? new sql.Database(bytes) : new sql.Database();
  database.run("PRAGMA foreign_keys = ON");
  return database;
}

export async function initDb(): Promise<void> {
  if (db) return;
  watchOtherWindows();
  const sql = await getSql();
  const saved = await readSnapshot();
  db = openShop(sql, saved.bytes);
  loadedGeneration = saved.generation;
  db.exec(schemaSql);
  const roundOffMigrated = migrateSalesRoundOff(db);
  const pharmacyMigrated = migratePharmacy(db);
  if (!saved.bytes || roundOffMigrated || pharmacyMigrated) {
    try {
      publishGeneration(await compareAndPut(db.export(), loadedGeneration));
    } catch (err) {
      if (!isShopChangedError(err)) throw err;
      db.close();
      const latest = await readSnapshot();
      if (!latest.bytes) throw err;
      db = openShop(sql, latest.bytes);
      loadedGeneration = latest.generation;
      stale = false;
    }
  }
  watchReady = true;
}

export function getDb(): Database {
  if (!db) throw new Error("Local database is not ready yet");
  return db;
}

export function persistDb(): Promise<void> {
  const run = persistTail.then(async () => {
    if (stale) throw new ShopChangedError();
    const bytes = getDb().export();
    try {
      publishGeneration(await compareAndPut(bytes, loadedGeneration));
    } catch (err) {
      if (isShopChangedError(err)) markStale();
      throw err;
    }
  });
  persistTail = run.catch((err) => {
    console.error(err);
  });
  return run;
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

function idbPutBackupIfCurrent(bytes: Uint8Array, at: string, expected: number): Promise<boolean> {
  return openIdb().then(
    (idb) =>
      new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, "readwrite");
        const { finish, fail } = settleTransaction<boolean>(idb, tx, resolve, reject);
        const store = tx.objectStore(IDB_STORE);
        let current = false;
        const genReq = store.get(IDB_GEN_KEY);
        genReq.onsuccess = () => {
          current = readGeneration(genReq.result) === expected;
          if (!current) return;
          store.put(bytes, IDB_BACKUP_KEY);
          store.put(at, IDB_BACKUP_AT_KEY);
        };
        genReq.onerror = () => fail(genReq.error ?? new Error("Could not read the shop file"));
        tx.oncomplete = () => finish(current);
      }),
  );
}

/** Copy the live SQLite file into a second IndexedDB key. Does not download a file. */
export function refreshAutoBackup(): Promise<void> {
  const run = persistTail.then(async () => {
    if (stale) return;
    const bytes = getDb().export();
    const at = new Date().toISOString();
    const wrote = await backupIfCurrent(bytes, at, loadedGeneration);
    if (!wrote) {
      markStale();
      return;
    }
    writeBackupAt(at);
  });
  persistTail = run.catch((err) => {
    console.error(err);
  });
  return run;
}

/** Download the live database (not a stale auto-copy), then refresh Last backup. False if the save dialog is cancelled. */
export async function saveKeeperBackup(): Promise<boolean> {
  const saved = await downloadDbFile(`makhzan-backup-${localDateStamp()}.db`);
  if (saved) await refreshAutoBackup();
  return saved;
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
  migratePharmacy(next);
  db?.close();
  db = next;
  stale = false;
  publishGeneration(await forcePut(db.export()));
  await refreshAutoBackup();
}

export async function downloadDbFile(filename = "makhzan.db"): Promise<boolean> {
  const bytes = exportDbBytes();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  if (isDesktop()) return desktopSaveCopy(copy, filename);
  const blob = new Blob([copy], { type: "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

async function readSnapshot(): Promise<{ bytes: Uint8Array | null; generation: number }> {
  if (isDesktop()) return desktopReadShop();
  return idbReadSnapshot();
}

function compareAndPut(bytes: Uint8Array, expected: number): Promise<number> {
  if (isDesktop()) return desktopComparePut(bytes, expected);
  return idbCompareAndPut(bytes, expected);
}

function forcePut(bytes: Uint8Array): Promise<number> {
  if (isDesktop()) return desktopForcePut(bytes);
  return idbForcePut(bytes);
}

function backupIfCurrent(bytes: Uint8Array, at: string, expected: number): Promise<boolean> {
  if (isDesktop()) return desktopBackupIfCurrent(expected);
  return idbPutBackupIfCurrent(bytes, at, expected);
}
