import { isoToLocalDate } from "../lib/format";
import type {
  Customer,
  DocType,
  PaymentMethod,
  Product,
  Sale,
  SaleItem,
  SalePayment,
  SaleStatus,
  StockMovement,
  StoreProfile,
} from "../lib/types";
import { requireUserId } from "./auth";
import { allRows, newId, nowIso, oneRow, persistDb, runSql } from "./engine";
import { mapCustomer, mapMovement, mapPayment, mapProduct, mapProfile, mapSale, mapSaleItem } from "./mappers";

export function emptyProfile(userId: string): StoreProfile {
  return {
    user_id: userId,
    business_name: "",
    address: "",
    phone: "",
    email: "",
    gstin: "",
    memo_footer: "",
    currency: "INR",
  };
}

export async function ensureStoreProfile(userId: string): Promise<StoreProfile> {
  const existing = oneRow("SELECT * FROM store_profiles WHERE user_id = ?", [userId]);
  if (existing) return mapProfile(existing);
  const stamp = nowIso();
  runSql(
    `INSERT INTO store_profiles (
      user_id, business_name, address, phone, email, gstin, memo_footer, currency, created_at, updated_at
    ) VALUES (?, '', '', '', '', '', '', 'INR', ?, ?)`,
    [userId, stamp, stamp],
  );
  await persistDb();
  return emptyProfile(userId);
}

export function getStoreProfile(): StoreProfile | null {
  const uid = requireUserId();
  const row = oneRow("SELECT * FROM store_profiles WHERE user_id = ?", [uid]);
  return row ? mapProfile(row) : null;
}

export function countSales(): number {
  const uid = requireUserId();
  const row = oneRow("SELECT COUNT(*) AS n FROM sales WHERE user_id = ?", [uid]);
  return Number(row?.n ?? 0);
}

export async function updateStoreProfile(patch: Omit<StoreProfile, "user_id">): Promise<void> {
  const uid = requireUserId();
  const current = getStoreProfile();
  if (current && patch.currency !== current.currency && countSales() > 0) {
    throw new Error(
      `Currency stays ${current.currency} because this shop already has sales. Amounts are stored in that currency and are not converted.`,
    );
  }
  runSql(
    `UPDATE store_profiles
     SET business_name = ?, address = ?, phone = ?, email = ?, gstin = ?, memo_footer = ?, currency = ?, updated_at = ?
     WHERE user_id = ?`,
    [
      patch.business_name,
      patch.address,
      patch.phone,
      patch.email,
      patch.gstin,
      patch.memo_footer,
      patch.currency,
      nowIso(),
      uid,
    ],
  );
  await persistDb();
}

export function listProducts(): Product[] {
  const uid = requireUserId();
  return allRows("SELECT * FROM products WHERE user_id = ? ORDER BY name COLLATE NOCASE", [uid]).map(mapProduct);
}

export function listActiveProducts(): Product[] {
  return listProducts().filter((p) => p.is_active);
}

export function getProduct(id: string): Product | null {
  const uid = requireUserId();
  const row = oneRow("SELECT * FROM products WHERE id = ? AND user_id = ?", [id, uid]);
  return row ? mapProduct(row) : null;
}

export type ProductWrite = {
  sku: string;
  name: string;
  unit: string;
  sale_price: number;
  tax_rate: number;
  low_stock_alert: number;
  is_active: boolean;
};

export async function insertProduct(input: ProductWrite & { opening_qty?: number }): Promise<string> {
  const uid = requireUserId();
  const sku = input.sku.trim();
  if (sku) {
    const dup = oneRow(
      "SELECT id FROM products WHERE user_id = ? AND lower(sku) = lower(?) AND trim(sku) != ''",
      [uid, sku],
    );
    if (dup) throw new Error("This SKU is already used");
  }
  const id = newId();
  const stamp = nowIso();
  const opening = Number.isFinite(input.opening_qty) ? Number(input.opening_qty) : 0;
  runSql(
    `INSERT INTO products (
      id, user_id, sku, name, unit, sale_price, tax_rate, stock_qty, low_stock_alert, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      uid,
      sku,
      input.name.trim(),
      input.unit,
      input.sale_price,
      input.tax_rate,
      opening,
      input.low_stock_alert,
      input.is_active ? 1 : 0,
      stamp,
      stamp,
    ],
  );
  if (opening !== 0) {
    runSql(
      `INSERT INTO stock_movements (
        id, user_id, product_id, change_qty, balance_after, reason, note, sale_id, created_at
      ) VALUES (?, ?, ?, ?, ?, 'opening', 'Opening stock', NULL, ?)`,
      [newId(), uid, id, opening, opening, stamp],
    );
  }
  await persistDb();
  return id;
}

export async function updateProduct(id: string, input: ProductWrite): Promise<void> {
  const uid = requireUserId();
  const sku = input.sku.trim();
  if (sku) {
    const dup = oneRow(
      "SELECT id FROM products WHERE user_id = ? AND lower(sku) = lower(?) AND trim(sku) != '' AND id != ?",
      [uid, sku, id],
    );
    if (dup) throw new Error("This SKU is already used");
  }
  const result = oneRow("SELECT id FROM products WHERE id = ? AND user_id = ?", [id, uid]);
  if (!result) throw new Error("Product not found");
  runSql(
    `UPDATE products
     SET sku = ?, name = ?, unit = ?, sale_price = ?, tax_rate = ?, low_stock_alert = ?, is_active = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      sku,
      input.name.trim(),
      input.unit,
      input.sale_price,
      input.tax_rate,
      input.low_stock_alert,
      input.is_active ? 1 : 0,
      nowIso(),
      id,
      uid,
    ],
  );
  await persistDb();
}

export async function deleteProduct(id: string): Promise<void> {
  const uid = requireUserId();
  const used = oneRow(
    "SELECT 1 AS x FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.product_id = ? AND s.user_id = ?",
    [id, uid],
  );
  if (used) throw new Error("This product appears on a sale. Deactivate it instead.");
  runSql("DELETE FROM products WHERE id = ? AND user_id = ?", [id, uid]);
  await persistDb();
}

export function listStockMovements(productId: string, limit = 100): StockMovement[] {
  const uid = requireUserId();
  return allRows(
    `SELECT * FROM stock_movements
     WHERE product_id = ? AND user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [productId, uid, limit],
  ).map(mapMovement);
}

export function listCustomers(): Customer[] {
  const uid = requireUserId();
  return allRows("SELECT * FROM customers WHERE user_id = ? ORDER BY name COLLATE NOCASE", [uid]).map(mapCustomer);
}

export function getCustomer(id: string): Customer | null {
  const uid = requireUserId();
  const row = oneRow("SELECT * FROM customers WHERE id = ? AND user_id = ?", [id, uid]);
  return row ? mapCustomer(row) : null;
}

export type CustomerWrite = {
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  notes: string;
};

export async function insertCustomer(input: CustomerWrite): Promise<string> {
  const uid = requireUserId();
  const id = newId();
  const stamp = nowIso();
  runSql(
    `INSERT INTO customers (id, user_id, name, phone, email, address, gstin, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, uid, input.name.trim(), input.phone, input.email, input.address, input.gstin, input.notes, stamp, stamp],
  );
  await persistDb();
  return id;
}

export async function updateCustomer(id: string, input: CustomerWrite): Promise<void> {
  const uid = requireUserId();
  runSql(
    `UPDATE customers
     SET name = ?, phone = ?, email = ?, address = ?, gstin = ?, notes = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [input.name.trim(), input.phone, input.email, input.address, input.gstin, input.notes, nowIso(), id, uid],
  );
  await persistDb();
}

export async function deleteCustomer(id: string): Promise<void> {
  const uid = requireUserId();
  runSql("DELETE FROM customers WHERE id = ? AND user_id = ?", [id, uid]);
  await persistDb();
}

export function listOpenSaleDues(): { customer_id: string; grand_total: number; amount_paid: number }[] {
  const uid = requireUserId();
  return allRows(
    `SELECT customer_id, grand_total, amount_paid
     FROM sales
     WHERE user_id = ? AND status != 'paid' AND customer_id IS NOT NULL`,
    [uid],
  ).map((r) => ({
    customer_id: String(r.customer_id),
    grand_total: Number(r.grand_total),
    amount_paid: Number(r.amount_paid),
  }));
}

export function listSales(filters: {
  from?: string;
  to?: string;
  docType?: DocType | "";
  status?: SaleStatus | "";
  customerId?: string;
  limit?: number;
}): Sale[] {
  const uid = requireUserId();
  const clauses = ["user_id = ?"];
  const params: unknown[] = [uid];
  if (filters.from) {
    clauses.push("sale_date >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push("sale_date <= ?");
    params.push(filters.to);
  }
  if (filters.docType) {
    clauses.push("doc_type = ?");
    params.push(filters.docType);
  }
  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  if (filters.customerId) {
    clauses.push("customer_id = ?");
    params.push(filters.customerId);
  }
  params.push(filters.limit ?? 1000);
  return allRows(
    `SELECT * FROM sales WHERE ${clauses.join(" AND ")} ORDER BY sale_date DESC, created_at DESC LIMIT ?`,
    params,
  ).map(mapSale);
}

export function getSale(id: string): Sale | null {
  const uid = requireUserId();
  const row = oneRow("SELECT * FROM sales WHERE id = ? AND user_id = ?", [id, uid]);
  return row ? mapSale(row) : null;
}

export function listSaleItems(saleId: string): SaleItem[] {
  const uid = requireUserId();
  return allRows(
    "SELECT * FROM sale_items WHERE sale_id = ? AND user_id = ? ORDER BY position",
    [saleId, uid],
  ).map(mapSaleItem);
}

export function listSalePayments(saleId: string): SalePayment[] {
  const uid = requireUserId();
  return allRows(
    "SELECT * FROM sale_payments WHERE sale_id = ? AND user_id = ? ORDER BY created_at",
    [saleId, uid],
  ).map(mapPayment);
}

const PAYMENT_METHOD_VALUES: PaymentMethod[] = ["cash", "upi", "card", "bank", "cheque", "other"];

function emptyByMethod(): Record<PaymentMethod, number> {
  return { cash: 0, upi: 0, card: 0, bank: 0, cheque: 0, other: 0 };
}

function asMethod(value: unknown): PaymentMethod {
  const method = String(value) as PaymentMethod;
  return PAYMENT_METHOD_VALUES.includes(method) ? method : "other";
}

export type CustomerPaymentRow = SalePayment & { doc_number: string };

export function listCustomerPayments(customerId: string): CustomerPaymentRow[] {
  const uid = requireUserId();
  return allRows(
    `SELECT p.id, p.sale_id, p.amount, p.method, p.note, p.created_at, s.doc_number
     FROM sale_payments p
     INNER JOIN sales s ON s.id = p.sale_id AND s.user_id = p.user_id
     WHERE s.user_id = ? AND s.customer_id = ?
     ORDER BY p.created_at DESC`,
    [uid, customerId],
  ).map((r) => ({ ...mapPayment(r), doc_number: String(r.doc_number ?? "") }));
}

/** Collected today from sale_payments (shop-local date). Header amount_paid is counted once if that sale has no payment rows. */
export function getDayCloseStats(today: string): {
  byMethod: Record<PaymentMethod, number>;
  stillDue: number;
} {
  const uid = requireUserId();
  const byMethod = emptyByMethod();
  const payments = allRows("SELECT sale_id, amount, method, created_at FROM sale_payments WHERE user_id = ?", [uid]);
  const salesWithPayments = new Set<string>();
  for (const r of payments) {
    salesWithPayments.add(String(r.sale_id));
    if (isoToLocalDate(String(r.created_at)) !== today) continue;
    byMethod[asMethod(r.method)] += Number(r.amount);
  }
  const todaySales = allRows(
    "SELECT id, grand_total, amount_paid, payment_method FROM sales WHERE user_id = ? AND sale_date = ?",
    [uid, today],
  );
  for (const s of todaySales) {
    const paid = Number(s.amount_paid);
    if (paid <= 0 || salesWithPayments.has(String(s.id))) continue;
    byMethod[asMethod(s.payment_method)] += paid;
  }
  const stillDue = todaySales.reduce((sum, r) => sum + (Number(r.grand_total) - Number(r.amount_paid)), 0);
  return { byMethod, stillDue };
}

export function getHomeStats(today: string): {
  todayCount: number;
  todaySales: number;
  collected: number;
  outstanding: number;
  lowStock: number;
} {
  const uid = requireUserId();
  const todayRows = allRows(
    "SELECT grand_total, amount_paid FROM sales WHERE user_id = ? AND sale_date = ?",
    [uid, today],
  );
  const openRows = allRows(
    "SELECT grand_total, amount_paid FROM sales WHERE user_id = ? AND status != 'paid'",
    [uid],
  );
  const products = allRows(
    "SELECT stock_qty, low_stock_alert, is_active FROM products WHERE user_id = ?",
    [uid],
  );
  return {
    todayCount: todayRows.length,
    todaySales: todayRows.reduce((s, r) => s + Number(r.grand_total), 0),
    collected: todayRows.reduce((s, r) => s + Number(r.amount_paid), 0),
    outstanding: openRows.reduce((s, r) => s + (Number(r.grand_total) - Number(r.amount_paid)), 0),
    lowStock: products.filter((p) => Boolean(p.is_active) && Number(p.stock_qty) <= Number(p.low_stock_alert)).length,
  };
}
