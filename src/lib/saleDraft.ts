import type { CounterLine, DocType, PaymentMethod } from "./types";

const DOC_TYPES = new Set<DocType>(["cash_memo", "bill"]);
const METHODS = new Set<PaymentMethod>(["cash", "upi", "card", "bank", "cheque", "other"]);

export type SaleDraft = {
  docType: DocType;
  customerId: string;
  walkInName: string;
  walkInPhone: string;
  lines: CounterLine[];
  discountRaw: string;
  paidRaw: string;
  method: PaymentMethod;
  saleDate: string;
  notes: string;
  cashReceivedRaw: string;
};

function draftKey(userId: string): string {
  return `makhzan.saleDraft.${userId}`;
}

function asBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.trim() !== "") return BigInt(value);
  return 0n;
}

function parseLine(raw: unknown): CounterLine | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const key = String(row.key ?? "");
  if (!key) return null;
  const qty = Number(row.qty);
  const taxRate = Number(row.taxRate);
  return {
    key,
    productId: row.productId == null || row.productId === "" ? null : String(row.productId),
    sku: String(row.sku ?? ""),
    description: String(row.description ?? ""),
    unit: String(row.unit ?? "pcs"),
    qty: Number.isFinite(qty) ? qty : 0,
    unitPrice: asBigInt(row.unitPrice),
    taxRate: Number.isFinite(taxRate) ? taxRate : 0,
    stockQty: (() => {
      const stock = Number(row.stockQty);
      return Number.isFinite(stock) ? stock : null;
    })(),
  };
}

export function saleDraftIsMeaningful(draft: SaleDraft): boolean {
  return (
    draft.lines.length > 0 ||
    Boolean(
      draft.discountRaw.trim() ||
        draft.paidRaw.trim() ||
        draft.notes.trim() ||
        draft.walkInName.trim() ||
        draft.walkInPhone.trim() ||
        draft.customerId,
    )
  );
}

export function serializeSaleDraft(draft: SaleDraft): string {
  return JSON.stringify({
    ...draft,
    lines: draft.lines.map((line) => ({ ...line, unitPrice: line.unitPrice.toString() })),
  });
}

export function parseSaleDraft(raw: string): SaleDraft | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const docType = data.docType;
    const method = data.method;
    if (typeof docType !== "string" || !DOC_TYPES.has(docType as DocType)) return null;
    if (typeof method !== "string" || !METHODS.has(method as PaymentMethod)) return null;
    const lines = Array.isArray(data.lines) ? data.lines.map(parseLine).filter((l): l is CounterLine => Boolean(l)) : [];
    const draft: SaleDraft = {
      docType: docType as DocType,
      customerId: String(data.customerId ?? ""),
      walkInName: String(data.walkInName ?? ""),
      walkInPhone: String(data.walkInPhone ?? ""),
      lines,
      discountRaw: String(data.discountRaw ?? ""),
      paidRaw: String(data.paidRaw ?? ""),
      method: method as PaymentMethod,
      saleDate: String(data.saleDate ?? ""),
      notes: String(data.notes ?? ""),
      cashReceivedRaw: String(data.cashReceivedRaw ?? ""),
    };
    return saleDraftIsMeaningful(draft) ? draft : null;
  } catch {
    return null;
  }
}

export function loadSaleDraft(userId: string): SaleDraft | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    return parseSaleDraft(raw);
  } catch {
    return null;
  }
}

export function saveSaleDraft(userId: string, draft: SaleDraft): void {
  if (!userId) return;
  try {
    if (!saleDraftIsMeaningful(draft)) {
      localStorage.removeItem(draftKey(userId));
      return;
    }
    localStorage.setItem(draftKey(userId), serializeSaleDraft(draft));
  } catch {
    /* quota / private mode */
  }
}

export function clearSaleDraft(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(draftKey(userId));
  } catch {
    /* ignore */
  }
}
