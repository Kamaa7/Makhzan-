import { isIsoDate, qty3, type Lot } from "../lib/batch";
import { allRows, newId, oneRow, runSql } from "./engine";

export type StockBatch = Lot & { product_id: string };

function mapLot(row: Record<string, unknown>): StockBatch {
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    batch_no: String(row.batch_no ?? ""),
    expiry_date: String(row.expiry_date ?? ""),
    qty: Number(row.qty),
  };
}

export function listProductBatches(productId: string, userId: string): StockBatch[] {
  return allRows(
    `SELECT id, product_id, batch_no, expiry_date, qty
     FROM stock_batches
     WHERE product_id = ? AND user_id = ? AND qty > 0
     ORDER BY CASE WHEN expiry_date = '' THEN 1 ELSE 0 END, expiry_date, batch_no`,
    [productId, userId],
  ).map(mapLot);
}

export function listOpenBatches(userId: string): StockBatch[] {
  return allRows(
    `SELECT id, product_id, batch_no, expiry_date, qty
     FROM stock_batches
     WHERE user_id = ? AND qty > 0`,
    [userId],
  ).map(mapLot);
}

/** Lots plus any stock that was never given a batch, so older shops can still sell. */
export function lotsCovering(productId: string, userId: string, stockQty: number): Lot[] {
  const rows = listProductBatches(productId, userId);
  const covered = qty3(rows.reduce((sum, lot) => sum + lot.qty, 0));
  const gap = qty3(stockQty - covered);
  const lots: Lot[] = rows.map((row) => ({
    id: row.id,
    batch_no: row.batch_no,
    expiry_date: row.expiry_date,
    qty: row.qty,
  }));
  if (gap > 0) lots.push({ id: "", batch_no: "", expiry_date: "", qty: gap });
  return lots;
}

export function addBatchQty(input: {
  userId: string;
  productId: string;
  batchNo: string;
  expiry: string;
  qty: number;
  stamp: string;
}): void {
  const batchNo = input.batchNo.trim().slice(0, 40);
  const expiry = input.expiry.trim();
  if (expiry && !isIsoDate(expiry)) throw new Error("Expiry must be a real date");
  const qty = qty3(input.qty);
  if (qty <= 0) throw new Error("Quantity must be greater than zero");
  const existing = oneRow(
    `SELECT id, qty FROM stock_batches
     WHERE product_id = ? AND user_id = ? AND lower(batch_no) = lower(?) AND expiry_date = ?`,
    [input.productId, input.userId, batchNo, expiry],
  );
  if (existing) {
    runSql("UPDATE stock_batches SET qty = ? WHERE id = ? AND user_id = ?", [
      qty3(Number(existing.qty) + qty),
      String(existing.id),
      input.userId,
    ]);
    return;
  }
  runSql(
    `INSERT INTO stock_batches (id, user_id, product_id, batch_no, expiry_date, qty, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), input.userId, input.productId, batchNo, expiry, qty, input.stamp],
  );
}

export function takeBatchQty(userId: string, batchId: string, qty: number): void {
  if (!batchId) return;
  const row = oneRow("SELECT qty FROM stock_batches WHERE id = ? AND user_id = ?", [batchId, userId]);
  if (!row) throw new Error("That batch is no longer in stock");
  const next = qty3(Number(row.qty) - qty);
  if (next < 0) throw new Error("That batch does not have enough quantity");
  if (next === 0) {
    runSql("DELETE FROM stock_batches WHERE id = ? AND user_id = ?", [batchId, userId]);
    return;
  }
  runSql("UPDATE stock_batches SET qty = ? WHERE id = ? AND user_id = ?", [next, batchId, userId]);
}

export function expiryCounts(userId: string, today: string, soonUntil: string): { expired: number; soon: number } {
  const row = oneRow(
    `SELECT
       SUM(CASE WHEN expiry_date != '' AND expiry_date < ? THEN 1 ELSE 0 END) AS expired,
       SUM(CASE WHEN expiry_date != '' AND expiry_date >= ? AND expiry_date <= ? THEN 1 ELSE 0 END) AS soon
     FROM stock_batches
     WHERE user_id = ? AND qty > 0`,
    [today, today, soonUntil, userId],
  );
  return {
    expired: Number(row?.expired ?? 0),
    soon: Number(row?.soon ?? 0),
  };
}
