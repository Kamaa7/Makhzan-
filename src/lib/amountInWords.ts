import { getCurrency } from "./money";

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
}

function threeDigit(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h && rest) return `${ONES[h]} Hundred ${twoDigit(rest)}`;
  if (h) return `${ONES[h]} Hundred`;
  return twoDigit(rest);
}

function rupeesInWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  if (crore) parts.push(`${threeDigit(crore)} Crore`);
  if (lakh) parts.push(`${threeDigit(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigit(thousand)} Thousand`);
  if (hundred) parts.push(threeDigit(hundred));
  return parts.join(" ");
}

function internationalInWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const billion = Math.floor(n / 1_000_000_000);
  n %= 1_000_000_000;
  const million = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (billion) parts.push(`${threeDigit(billion)} Billion`);
  if (million) parts.push(`${threeDigit(million)} Million`);
  if (thousand) parts.push(`${threeDigit(thousand)} Thousand`);
  if (n) parts.push(threeDigit(n));
  return parts.join(" ");
}

function pluralize(word: string, n: number): string {
  if (n === 1) return word;
  if (word === "Paise") return "Paise";
  if (word.endsWith("s")) return word;
  return `${word}s`;
}

function minorWords(n: number): string {
  if (n < 100) return twoDigit(n);
  return threeDigit(n);
}

function inrInWords(paise: bigint): string {
  const abs = paise < 0n ? -paise : paise;
  const rupees = Number(abs / 100n);
  const leftover = Number(abs % 100n);
  const rupeeWord = rupees === 1 ? "Rupee" : "Rupees";
  const paiseWord = leftover === 1 ? "Paisa" : "Paise";
  const rupeeWords = rupeesInWords(rupees);
  if (leftover === 0) return `${rupeeWord} ${rupeeWords} Only`;
  return `${rupeeWord} ${rupeeWords} and ${twoDigit(leftover)} ${paiseWord} Only`;
}

/** INR: Indian grouping. Other shop currencies: thousand/million. */
export function amountInWords(paise: bigint, currency = "INR"): string {
  const def = getCurrency(currency);
  if (def.code === "INR") return inrInWords(paise);

  const abs = paise < 0n ? -paise : paise;
  const scale = 10n ** BigInt(def.decimals);
  const major = Number(abs / scale);
  const leftover = Number(abs % scale);
  const majorLabel = pluralize(def.major, major);
  const majorWords = internationalInWords(major);
  if (leftover === 0) return `${majorLabel} ${majorWords} Only`;
  const minorLabel = pluralize(def.minor, leftover);
  return `${majorLabel} ${majorWords} and ${minorWords(leftover)} ${minorLabel} Only`;
}
