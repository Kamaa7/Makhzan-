import { parseSaleDraft, serializeSaleDraft, type SaleDraft } from "./saleDraft";
import type { DocType } from "./types";

const CAP = 10;

export type ParkedBill = {
  id: string;
  parkedAt: string;
  customerLabel: string;
  docType: DocType;
  grandMinor: string;
  draft: SaleDraft;
};

function parkedKey(userId: string): string {
  return `makhzan.parked.${userId}`;
}

function parseParked(raw: unknown): ParkedBill | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const draftRaw = typeof row.draft === "string" ? row.draft : JSON.stringify(row.draft ?? {});
  const draft = parseSaleDraft(draftRaw);
  if (!draft) return null;
  const id = String(row.id ?? "");
  if (!id) return null;
  return {
    id,
    parkedAt: String(row.parkedAt ?? ""),
    customerLabel: String(row.customerLabel ?? "Walk-in"),
    docType: draft.docType,
    grandMinor: String(row.grandMinor ?? "0"),
    draft,
  };
}

export function listParkedBills(userId: string): ParkedBill[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(parkedKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseParked).filter((row): row is ParkedBill => Boolean(row));
  } catch {
    return [];
  }
}

function writeParked(userId: string, rows: ParkedBill[]): void {
  localStorage.setItem(
    parkedKey(userId),
    JSON.stringify(
      rows.map((row) => ({
        id: row.id,
        parkedAt: row.parkedAt,
        customerLabel: row.customerLabel,
        docType: row.docType,
        grandMinor: row.grandMinor,
        draft: JSON.parse(serializeSaleDraft(row.draft)) as unknown,
      })),
    ),
  );
}

export function parkBill(
  userId: string,
  input: { customerLabel: string; grandMinor: bigint; draft: SaleDraft },
): { droppedOldest: boolean } {
  const rows = listParkedBills(userId);
  rows.push({
    id: crypto.randomUUID(),
    parkedAt: new Date().toISOString(),
    customerLabel: input.customerLabel.trim() || "Walk-in",
    docType: input.draft.docType,
    grandMinor: input.grandMinor.toString(),
    draft: input.draft,
  });
  let droppedOldest = false;
  while (rows.length > CAP) {
    rows.shift();
    droppedOldest = true;
  }
  writeParked(userId, rows);
  return { droppedOldest };
}

export function takeParkedBill(userId: string, id: string): ParkedBill | null {
  const rows = listParkedBills(userId);
  const found = rows.find((row) => row.id === id) ?? null;
  if (!found) return null;
  writeParked(
    userId,
    rows.filter((row) => row.id !== id),
  );
  return found;
}
