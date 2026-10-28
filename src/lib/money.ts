/** Match Postgres numeric round() — half away from zero — then return integer minor units. */
export function pgRoundInt(n: number): bigint {
  const s = n < 0 ? -1 : 1;
  return BigInt(s * Math.floor(Math.abs(n) + 0.5));
}

export type CurrencyDef = {
  code: string;
  name: string;
  decimals: number;
  major: string;
  minor: string;
};

export const CURRENCIES: CurrencyDef[] = [
  { code: "INR", name: "Indian Rupee", decimals: 2, major: "Rupee", minor: "Paise" },
  { code: "AED", name: "UAE Dirham", decimals: 2, major: "Dirham", minor: "Fils" },
  { code: "SAR", name: "Saudi Riyal", decimals: 2, major: "Riyal", minor: "Halala" },
  { code: "QAR", name: "Qatari Riyal", decimals: 2, major: "Riyal", minor: "Dirham" },
  { code: "KWD", name: "Kuwaiti Dinar", decimals: 3, major: "Dinar", minor: "Fils" },
  { code: "BHD", name: "Bahraini Dinar", decimals: 3, major: "Dinar", minor: "Fils" },
  { code: "OMR", name: "Omani Rial", decimals: 3, major: "Rial", minor: "Baisa" },
  { code: "JOD", name: "Jordanian Dinar", decimals: 3, major: "Dinar", minor: "Fils" },
  { code: "EGP", name: "Egyptian Pound", decimals: 2, major: "Pound", minor: "Piastre" },
  { code: "IQD", name: "Iraqi Dinar", decimals: 3, major: "Dinar", minor: "Fils" },
  { code: "ILS", name: "Israeli Shekel", decimals: 2, major: "Shekel", minor: "Agora" },
  { code: "TRY", name: "Turkish Lira", decimals: 2, major: "Lira", minor: "Kurus" },
  { code: "LBP", name: "Lebanese Pound", decimals: 2, major: "Pound", minor: "Piastre" },
  { code: "SYP", name: "Syrian Pound", decimals: 2, major: "Pound", minor: "Piastre" },
  { code: "YER", name: "Yemeni Rial", decimals: 2, major: "Rial", minor: "Fils" },
  { code: "IRR", name: "Iranian Rial", decimals: 2, major: "Rial", minor: "Dinar" },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

function normalizeCode(code?: string | null): string {
  const trimmed = (code || "INR").trim().toUpperCase();
  return trimmed.length === 3 ? trimmed : "INR";
}

/** Known catalog entry, or a 2-decimal fallback so an unknown saved ISO code still displays. */
export function getCurrency(code?: string | null): CurrencyDef {
  const normalized = normalizeCode(code);
  return (
    BY_CODE.get(normalized) ?? {
      code: normalized,
      name: normalized,
      decimals: 2,
      major: "Unit",
      minor: "Cent",
    }
  );
}

export function currencyScale(code?: string | null): number {
  return 10 ** getCurrency(code).decimals;
}

export function moneyStep(code?: string | null): string {
  return getCurrency(code).decimals === 3 ? "0.001" : "0.01";
}

export function moneyPlaceholder(code?: string | null): string {
  return getCurrency(code).decimals === 3 ? "0.000" : "0.00";
}

export function asPaise(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.trim() !== "") {
    const [whole] = value.split(".");
    return BigInt(whole || "0");
  }
  return 0n;
}

export function majorToMinor(major: number, currency = "INR"): bigint {
  return pgRoundInt(major * currencyScale(currency));
}

export function minorToMajorNumber(minor: bigint, currency = "INR"): number {
  return Number(minor) / currencyScale(currency);
}

/** INR helper kept for call sites that are explicitly rupees. */
export function rupeesToPaise(rupees: number): bigint {
  return majorToMinor(rupees, "INR");
}

export function paiseToRupeesNumber(paise: bigint, currency = "INR"): number {
  return minorToMajorNumber(paise, currency);
}

export function fractionDigitCount(raw: string): number {
  const trimmed = raw.trim().replace(/,/g, "");
  const dot = trimmed.indexOf(".");
  if (dot < 0) return 0;
  return trimmed.slice(dot + 1).replace(/\D/g, "").length;
}

export function majorInputOk(raw: string, currency = "INR"): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  return fractionDigitCount(trimmed) <= getCurrency(currency).decimals;
}

export class CurrencyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurrencyParseError";
  }
}

/** Parse a major-unit string into integer minor units. Rejects extra fraction digits. */
export function parseMajorInput(raw: string, currency = "INR"): bigint {
  const trimmed = raw.trim();
  if (!trimmed) return 0n;
  const def = getCurrency(currency);
  if (fractionDigitCount(trimmed) > def.decimals) {
    throw new CurrencyParseError(`${def.code} allows ${def.decimals} decimal place${def.decimals === 1 ? "" : "s"}`);
  }
  const n = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0n;
  return majorToMinor(n, def.code);
}

export function parseMajorInputSafe(raw: string, currency = "INR"): bigint {
  try {
    return parseMajorInput(raw, currency);
  } catch {
    return 0n;
  }
}

export function parseRupeesInput(raw: string, currency = "INR"): bigint {
  return parseMajorInput(raw, currency);
}

export function formatMoney(paise: bigint, currency = "INR"): string {
  const def = getCurrency(currency);
  const major = minorToMajorNumber(paise, def.code);
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: def.code,
      minimumFractionDigits: def.decimals,
      maximumFractionDigits: def.decimals,
    }).format(major);
  } catch {
    return `${new Intl.NumberFormat("en", {
      minimumFractionDigits: def.decimals,
      maximumFractionDigits: def.decimals,
    }).format(major)} ${def.code}`;
  }
}

export function formatPaisePlain(paise: bigint, currency = "INR"): string {
  const def = getCurrency(currency);
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: def.decimals,
    maximumFractionDigits: def.decimals,
  }).format(minorToMajorNumber(paise, def.code));
}

export function lineAmount(qty: number, unitPricePaise: bigint): bigint {
  return pgRoundInt(qty * Number(unitPricePaise));
}

export function lineTax(amount: bigint, taxRate: number): bigint {
  return pgRoundInt((Number(amount) * taxRate) / 100);
}

export type SaleTotals = {
  subtotal: bigint;
  taxRaw: bigint;
  taxTotal: bigint;
  exactTotal: bigint;
  grandTotal: bigint;
  roundOff: bigint;
};

/** One whole major unit in minor units: 100 for 2-decimal currencies, 1000 for 3-decimal. */
export function roundOffStep(currency?: string | null): bigint {
  return getCurrency(currency).decimals === 3 ? 1000n : 100n;
}

/** Round `exact` to the nearest `step` using the same half-away-from-zero rule as pgRoundInt. */
export function roundToNearestStep(exact: bigint, step: bigint): bigint {
  if (step <= 0n) return exact;
  return pgRoundInt(Number(exact) / Number(step)) * step;
}

export function computeSaleTotals(
  lines: { qty: number; unitPrice: bigint; taxRate: number }[],
  discount: bigint,
  currency = "INR",
): SaleTotals {
  let subtotal = 0n;
  let taxRaw = 0n;
  for (const line of lines) {
    const amt = lineAmount(line.qty, line.unitPrice);
    subtotal += amt;
    taxRaw += lineTax(amt, line.taxRate);
  }
  const taxTotal =
    subtotal === 0n ? 0n : pgRoundInt((Number(taxRaw) * Number(subtotal - discount)) / Number(subtotal));
  const exactTotal = subtotal - discount + taxTotal;
  const grandTotal = roundToNearestStep(exactTotal, roundOffStep(currency));
  const roundOff = grandTotal - exactTotal;
  return { subtotal, taxRaw, taxTotal, exactTotal, grandTotal, roundOff };
}
