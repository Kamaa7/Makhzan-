export function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  return qty.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

export function todayISO(): string {
  return localDateISO(new Date());
}

export function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Shop-local calendar date from an ISO timestamp. */
export function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return localDateISO(d);
}

export function monthStartISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function docTypeLabel(type: string): string {
  return type === "cash_memo" ? "Cash memo" : "Bill";
}

export function statusLabel(status: string): string {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  return "Unpaid";
}

export function newId(): string {
  return crypto.randomUUID();
}
