import type { DocType, SaleStatus } from "./types";

/** One rule for paid / partial / unpaid. A zero payment is unpaid, even on a zero total. */
export function salePaymentStatus(amountPaid: bigint, grandTotal: bigint): SaleStatus {
  if (amountPaid <= 0n) return "unpaid";
  if (amountPaid >= grandTotal) return "paid";
  return "partial";
}

/** What createSale stores. A cash memo is always paid in full. */
export function commitSalePayment(
  docType: DocType,
  amountPaid: bigint,
  grandTotal: bigint,
): { amountPaid: bigint; status: SaleStatus } {
  if (docType === "cash_memo") return { amountPaid: grandTotal, status: "paid" };
  if (amountPaid < 0n) throw new Error("Amount paid cannot be negative");
  if (amountPaid > grandTotal) throw new Error("Amount paid cannot exceed the total");
  return { amountPaid, status: salePaymentStatus(amountPaid, grandTotal) };
}

/** What recordSalePayment stores. Payments only move forward, and cannot pass the total. */
export function nextPaymentStatus(
  alreadyPaid: bigint,
  grandTotal: bigint,
  add: bigint,
): { amountPaid: bigint; status: SaleStatus } {
  if (add <= 0n) throw new Error("Payment amount must be greater than zero");
  const due = grandTotal - alreadyPaid;
  if (add > due) throw new Error("Payment would exceed the amount due");
  const amountPaid = alreadyPaid + add;
  return { amountPaid, status: salePaymentStatus(amountPaid, grandTotal) };
}

export type StockIntent = "purchase" | "return" | "correction" | "remove";

/** Add/remove and the stored reason are one choice, so they cannot disagree. */
export function stockChange(
  intent: StockIntent,
  qty: number,
): { change: number; reason: "purchase" | "return" | "adjustment" } {
  const n = Math.abs(qty);
  if (intent === "remove") return { change: -n, reason: "adjustment" };
  if (intent === "correction") return { change: n, reason: "adjustment" };
  return { change: n, reason: intent };
}
