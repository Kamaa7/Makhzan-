import assert from "node:assert/strict";
import { amountInWords } from "../src/lib/amountInWords";
import { computeSaleTotals, formatMoney, getCurrency, parseMajorInput, roundOffStep, roundToNearestStep } from "../src/lib/money";

assert.equal(getCurrency("INR").decimals, 2);
assert.equal(getCurrency("AED").decimals, 2);
assert.equal(getCurrency("KWD").decimals, 3);
assert.equal(getCurrency("xyz").code, "XYZ");

assert.equal(parseMajorInput("1.500", "KWD"), 1500n);
assert.equal(parseMajorInput("10.50", "AED"), 1050n);
assert.equal(parseMajorInput("10.50", "INR"), 1050n);
assert.throws(() => parseMajorInput("10.501", "AED"));
assert.throws(() => parseMajorInput("1.5001", "KWD"));

const inr = formatMoney(105000n, "INR");
assert.match(inr, /1,050\.00/);
assert.match(amountInWords(105000n, "INR"), /Rupees/);
assert.match(amountInWords(105000n, "INR"), /Only/);

const kwd = formatMoney(1500n, "KWD");
assert.match(kwd, /1\.500/);

const aed = formatMoney(1050n, "AED");
assert.match(aed, /10\.50/);

assert.equal(
  amountInWords(120050n, "AED"),
  "Dirhams One Thousand Two Hundred and Fifty Fils Only",
);

const unknown = formatMoney(1050n, "XXX");
assert.match(unknown, /10\.50/);

assert.equal(roundOffStep("INR"), 100n);
assert.equal(roundOffStep("KWD"), 1000n);
assert.equal(roundToNearestStep(1050n, 100n), 1100n);
assert.equal(roundToNearestStep(1250n, 1000n), 1000n);

const inrRound = computeSaleTotals([{ qty: 1, unitPrice: 1050n, taxRate: 0 }], 0n, "INR");
assert.equal(inrRound.exactTotal, 1050n);
assert.equal(inrRound.grandTotal, 1100n);
assert.equal(inrRound.roundOff, 50n);

const kwdRound = computeSaleTotals([{ qty: 1, unitPrice: 1250n, taxRate: 0 }], 0n, "KWD");
assert.equal(kwdRound.exactTotal, 1250n);
assert.equal(kwdRound.grandTotal, 1000n);
assert.equal(kwdRound.roundOff, -250n);

console.log("currency asserts ok");
console.log("  INR 105000 minor ->", inr, "|", amountInWords(105000n, "INR"));
console.log("  KWD 1500 minor ->", kwd);
console.log("  AED 1050 minor ->", aed);
