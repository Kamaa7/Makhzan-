import { formatDate } from "./format";

export const NEAR_EXPIRY_DAYS = 90;

export type Lot = {
  id: string;
  batch_no: string;
  expiry_date: string;
  qty: number;
};

export function qty3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Printed under the item when this sale line used a batch or an expiry. */
export function batchCaption(batchNo: string, expiry: string): string {
  const batch = batchNo.trim();
  const exp = expiry.trim();
  if (batch.startsWith("Batch ") || batch.includes("Exp ")) return batch;
  const expLabel = exp ? (isIsoDate(exp) ? formatDate(exp) : exp) : "";
  if (batch && expLabel) return `Batch ${batch} · Exp ${expLabel}`;
  if (batch) return `Batch ${batch}`;
  if (expLabel) return `Exp ${expLabel}`;
  return "";
}

export function itemBillText(item: { description: string; batch_no?: string; expiry_date?: string }): string {
  const caption = batchCaption(item.batch_no ?? "", item.expiry_date ?? "");
  return caption ? `${item.description}\n${caption}` : item.description;
}

/** Which lots cover this quantity. A sale skips expired lots. A removal clears expired lots first. */
export function planTake(lots: Lot[], need: number, today: string, mode: "sale" | "discard"): { id: string; take: number }[] {
  const wanted = qty3(need);
  if (wanted <= 0) throw new Error("Quantity must be greater than zero");
  const ordered = lots
    .filter((lot) => lot.qty > 0)
    .sort((a, b) => {
      const ae = a.expiry_date.trim();
      const be = b.expiry_date.trim();
      const aExpired = ae !== "" && ae < today;
      const bExpired = be !== "" && be < today;
      if (aExpired !== bExpired) {
        if (mode === "discard") return aExpired ? -1 : 1;
        return aExpired ? 1 : -1;
      }
      if (!ae && be) return 1;
      if (ae && !be) return -1;
      return ae.localeCompare(be);
    });
  const pool = mode === "sale" ? ordered.filter((lot) => lot.expiry_date.trim() === "" || lot.expiry_date >= today) : ordered;
  let left = wanted;
  const takes: { id: string; take: number }[] = [];
  for (const lot of pool) {
    if (left <= 0) break;
    const take = qty3(Math.min(lot.qty, left));
    if (take <= 0) continue;
    takes.push({ id: lot.id, take });
    left = qty3(left - take);
  }
  if (left > 0) {
    const expired = qty3(
      lots.filter((lot) => lot.expiry_date.trim() !== "" && lot.expiry_date < today).reduce((sum, lot) => sum + lot.qty, 0),
    );
    if (mode === "sale" && expired > 0) {
      throw new Error(`Only ${qty3(wanted - left)} can be sold. ${expired} is past expiry.`);
    }
    throw new Error("Insufficient stock");
  }
  return takes;
}

export function captionForTakes(lots: Lot[], takes: { id: string; take: number }[]): { batch_no: string; expiry_date: string } {
  const used = takes
    .map((take) => lots.find((lot) => lot.id === take.id))
    .filter((lot): lot is Lot => Boolean(lot))
    .filter((lot) => lot.batch_no.trim() || lot.expiry_date.trim());
  if (used.length === 0) return { batch_no: "", expiry_date: "" };
  if (used.length === 1) return { batch_no: used[0].batch_no.trim(), expiry_date: used[0].expiry_date.trim() };
  return {
    batch_no: used.map((lot) => batchCaption(lot.batch_no, lot.expiry_date)).join(", "),
    expiry_date: "",
  };
}
