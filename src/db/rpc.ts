import { asPaise, computeSaleTotals } from "../lib/money";
import { captionForTakes, planTake, qty3 } from "../lib/batch";
import { todayISO } from "../lib/format";
import { commitSalePayment, nextPaymentStatus } from "../lib/saleState";
import type { DocType, PaymentMethod } from "../lib/types";
import { requireUserId } from "./auth";
import { addBatchQty, lotsCovering, takeBatchQty } from "./batches";
import { getDb, newId, nowIso, oneRow, persistDb, refreshAutoBackup, runSql } from "./engine";
import { mapProduct } from "./mappers";

const METHODS = new Set(["cash", "upi", "card", "bank", "cheque", "other"]);

export type SaleLineInput = {
  product_id: string | null;
  description: string;
  unit: string;
  qty: number;
  unit_price: number;
  tax_rate: number;
};

export async function createSale(input: {
  doc_type: DocType;
  items: SaleLineInput[];
  customer_id?: string | null;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  customer_gstin?: string;
  discount: number;
  amount_paid: number;
  payment_method: PaymentMethod;
  sale_date: string;
  notes?: string;
  patient_name?: string;
  doctor_name?: string;
  prescription_note?: string;
}): Promise<string> {
  const uid = requireUserId();
  if (input.doc_type !== "cash_memo" && input.doc_type !== "bill") {
    throw new Error("Invalid document type");
  }
  if (!input.items.length) throw new Error("At least one line item is required");
  if (!METHODS.has(input.payment_method)) throw new Error("Invalid payment method");
  if (input.discount < 0) throw new Error("Discount cannot be negative");

  let name = (input.customer_name ?? "").trim();
  let phone = (input.customer_phone ?? "").trim();
  let email = (input.customer_email ?? "").trim();
  let address = (input.customer_address ?? "").trim();
  let gstin = (input.customer_gstin ?? "").trim();

  if (input.customer_id) {
    const cust = oneRow("SELECT * FROM customers WHERE id = ? AND user_id = ?", [input.customer_id, uid]);
    if (!cust) throw new Error("Customer not found");
    if (!name) name = String(cust.name);
    if (!phone) phone = String(cust.phone ?? "");
    if (!email) email = String(cust.email ?? "");
    if (!address) address = String(cust.address ?? "");
    if (!gstin) gstin = String(cust.gstin ?? "");
  }

  if (input.doc_type === "bill" && !name) {
    throw new Error("A bill requires a customer name");
  }

  const prepared = input.items.map((item, index) => {
    const qty = qty3(Number(item.qty));
    const unitPrice = Number(item.unit_price);
    const taxRate = Number(item.tax_rate ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Quantity must be greater than zero (line ${index + 1})`);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`Unit price cannot be negative (line ${index + 1})`);
    if (taxRate < 0 || taxRate > 100) throw new Error(`Tax rate must be between 0 and 100 (line ${index + 1})`);
    return { ...item, qty, unit_price: unitPrice, tax_rate: taxRate };
  });

  for (const item of prepared) {
    if (!item.product_id) continue;
    const row = oneRow("SELECT * FROM products WHERE id = ? AND user_id = ?", [item.product_id, uid]);
    if (!row) throw new Error("Product not found");
    const product = mapProduct(row);
    if (!product.is_active) throw new Error(`Product "${product.name}" is inactive`);
    if (product.stock_qty < item.qty) {
      throw new Error(`Insufficient stock for "${product.name}" (have ${product.stock_qty}, need ${item.qty})`);
    }
  }

  const profileRow = oneRow("SELECT currency FROM store_profiles WHERE user_id = ?", [uid]);
  const currency = String(profileRow?.currency ?? "INR");
  const totals = computeSaleTotals(
    prepared.map((i) => ({ qty: i.qty, unitPrice: asPaise(i.unit_price), taxRate: i.tax_rate })),
    asPaise(input.discount),
    currency,
  );
  if (asPaise(input.discount) > totals.subtotal) throw new Error("Discount cannot exceed subtotal");

  const settled = commitSalePayment(input.doc_type, asPaise(input.amount_paid), totals.grandTotal);
  const paid = settled.amountPaid;
  const status = settled.status;

  const saleId = newId();
  const stamp = nowIso();
  const database = getDb();
  database.run("BEGIN");
  try {
    const seqRow = oneRow("SELECT last_number FROM doc_sequences WHERE user_id = ? AND doc_type = ?", [
      uid,
      input.doc_type,
    ]);
    const nextNum = seqRow ? Number(seqRow.last_number) + 1 : 1;
    if (seqRow) {
      runSql("UPDATE doc_sequences SET last_number = ? WHERE user_id = ? AND doc_type = ?", [nextNum, uid, input.doc_type]);
    } else {
      runSql("INSERT INTO doc_sequences (user_id, doc_type, last_number) VALUES (?, ?, ?)", [uid, input.doc_type, nextNum]);
    }
    const docNumber =
      input.doc_type === "cash_memo" ? `CM-${String(nextNum).padStart(5, "0")}` : `BILL-${String(nextNum).padStart(5, "0")}`;

    runSql(
      `INSERT INTO sales (
        id, user_id, doc_type, doc_number, sale_date, customer_id,
        customer_name, customer_phone, customer_email, customer_address, customer_gstin,
        subtotal, discount, tax_total, round_off, grand_total, amount_paid, payment_method, status,
        patient_name, doctor_name, prescription_note, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        uid,
        input.doc_type,
        docNumber,
        input.sale_date,
        input.customer_id || null,
        name,
        phone,
        email,
        address,
        gstin,
        Number(totals.subtotal),
        Number(asPaise(input.discount)),
        Number(totals.taxTotal),
        Number(totals.roundOff),
        Number(totals.grandTotal),
        Number(paid),
        input.payment_method,
        status,
        (input.patient_name ?? "").trim().slice(0, 80),
        (input.doctor_name ?? "").trim().slice(0, 80),
        (input.prescription_note ?? "").trim().slice(0, 240),
        input.notes ?? "",
        stamp,
        stamp,
      ],
    );

    prepared.forEach((item, index) => {
      const lineAmt = Number(
        computeSaleTotals([{ qty: item.qty, unitPrice: asPaise(item.unit_price), taxRate: item.tax_rate }], 0n).subtotal,
      );
      let batchNo = "";
      let expiryDate = "";
      if (item.product_id) {
        const current = oneRow("SELECT stock_qty, name FROM products WHERE id = ? AND user_id = ?", [item.product_id, uid]);
        if (!current) throw new Error("Product not found");
        const stockQty = Number(current.stock_qty);
        const lots = lotsCovering(item.product_id, uid, stockQty);
        let takes;
        try {
          takes = planTake(lots, item.qty, input.sale_date, "sale");
        } catch (err) {
          const message = err instanceof Error ? err.message : "Insufficient stock";
          throw new Error(`${String(current.name)}: ${message}`);
        }
        for (const take of takes) takeBatchQty(uid, take.id, take.take);
        const caption = captionForTakes(lots, takes);
        batchNo = caption.batch_no;
        expiryDate = caption.expiry_date;
        const next = qty3(stockQty - item.qty);
        if (next < 0) throw new Error("Insufficient stock");
        runSql("UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ? AND user_id = ?", [
          next,
          stamp,
          item.product_id,
          uid,
        ]);
        const movementNote = batchNo ? `${docNumber} · ${batchNo}` : docNumber;
        runSql(
          `INSERT INTO stock_movements (
            id, user_id, product_id, change_qty, balance_after, reason, note, sale_id, created_at
          ) VALUES (?, ?, ?, ?, ?, 'sale', ?, ?, ?)`,
          [newId(), uid, item.product_id, -item.qty, next, movementNote, saleId, stamp],
        );
      }
      runSql(
        `INSERT INTO sale_items (
          id, user_id, sale_id, product_id, position, description, unit, qty, unit_price, tax_rate, line_amount, batch_no, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          uid,
          saleId,
          item.product_id,
          index + 1,
          item.description.trim() || "Item",
          item.unit || "pcs",
          item.qty,
          item.unit_price,
          item.tax_rate,
          lineAmt,
          batchNo,
          expiryDate,
        ],
      );
    });

    if (paid > 0n) {
      runSql(
        `INSERT INTO sale_payments (id, user_id, sale_id, amount, method, note, created_at)
         VALUES (?, ?, ?, ?, ?, 'Sale payment', ?)`,
        [newId(), uid, saleId, Number(paid), input.payment_method, stamp],
      );
    }

    database.run("COMMIT");
  } catch (err) {
    database.run("ROLLBACK");
    throw err;
  }
  await persistDb();
  await refreshAutoBackup();
  return saleId;
}

export async function recordSalePayment(input: {
  sale_id: string;
  amount: number;
  method: PaymentMethod;
  note?: string;
}): Promise<string> {
  const uid = requireUserId();
  if (!METHODS.has(input.method)) throw new Error("Invalid payment method");
  if (input.amount <= 0) throw new Error("Payment amount must be greater than zero");

  const sale = oneRow("SELECT * FROM sales WHERE id = ?", [input.sale_id]);
  if (!sale || String(sale.user_id) !== uid) throw new Error("Sale not found");

  const settled = nextPaymentStatus(asPaise(sale.amount_paid), asPaise(sale.grand_total), asPaise(input.amount));
  const newPaid = settled.amountPaid;
  const status = settled.status;
  const id = newId();
  const stamp = nowIso();
  runSql(
    `INSERT INTO sale_payments (id, user_id, sale_id, amount, method, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, uid, input.sale_id, input.amount, input.method, input.note ?? "", stamp],
  );
  runSql(
    `UPDATE sales SET amount_paid = ?, status = ?, payment_method = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    [Number(newPaid), status, input.method, stamp, input.sale_id, uid],
  );
  await persistDb();
  await refreshAutoBackup();
  return id;
}

export async function adjustStock(input: {
  product_id: string;
  change_qty: number;
  reason: "adjustment" | "purchase" | "return";
  note?: string;
  batch_no?: string;
  expiry_date?: string;
  batch_id?: string;
}): Promise<string> {
  const uid = requireUserId();
  if (!["adjustment", "purchase", "return"].includes(input.reason)) {
    throw new Error("Reason must be adjustment, purchase, or return");
  }
  const change = qty3(input.change_qty);
  if (!change) throw new Error("Quantity change cannot be zero");
  if ((input.reason === "purchase" || input.reason === "return") && change <= 0) {
    throw new Error("Purchase and return must add stock");
  }
  const row = oneRow("SELECT * FROM products WHERE id = ?", [input.product_id]);
  if (!row || String(row.user_id) !== uid) throw new Error("Product not found");
  const next = qty3(Number(row.stock_qty) + change);
  if (next < 0) throw new Error("Stock cannot go below zero");
  const id = newId();
  const stamp = nowIso();
  const batchNo = (input.batch_no ?? "").trim();
  const expiry = (input.expiry_date ?? "").trim();
  const database = getDb();
  database.run("BEGIN");
  try {
    if (change > 0) {
      addBatchQty({
        userId: uid,
        productId: input.product_id,
        batchNo,
        expiry,
        qty: change,
        stamp,
      });
    } else if (input.batch_id) {
      takeBatchQty(uid, input.batch_id, Math.abs(change));
    } else {
      const lots = lotsCovering(input.product_id, uid, Number(row.stock_qty));
      const takes = planTake(lots, Math.abs(change), todayISO(), "discard");
      for (const take of takes) takeBatchQty(uid, take.id, take.take);
    }
    const batchNote = [input.note ?? "", batchNo, expiry].filter(Boolean).join(" · ");
    runSql("UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ? AND user_id = ?", [
      next,
      stamp,
      input.product_id,
      uid,
    ]);
    runSql(
      `INSERT INTO stock_movements (
        id, user_id, product_id, change_qty, balance_after, reason, note, sale_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [id, uid, input.product_id, change, next, input.reason, batchNote, stamp],
    );
    database.run("COMMIT");
  } catch (err) {
    database.run("ROLLBACK");
    throw err;
  }
  await persistDb();
  await refreshAutoBackup();
  return id;
}
