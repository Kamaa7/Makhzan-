import assert from "node:assert/strict";
import { parseSaleDraft, saleDraftIsMeaningful, serializeSaleDraft } from "../src/lib/saleDraft";

const draft = {
  docType: "bill" as const,
  customerId: "cust-1",
  walkInName: "",
  walkInPhone: "",
  lines: [
    {
      key: "line-1",
      productId: "p1",
      sku: "890123",
      description: "Soap",
      unit: "pcs",
      qty: 2,
      unitPrice: 1050n,
      taxRate: 5,
      stockQty: 12,
    },
    {
      key: "line-2",
      productId: null,
      sku: "",
      description: "Custom item",
      unit: "pcs",
      qty: 1,
      unitPrice: 250n,
      taxRate: 0,
      stockQty: null,
    },
  ],
  discountRaw: "1.00",
  paidRaw: "10.50",
  method: "upi" as const,
  saleDate: "2026-10-28",
  notes: "hold",
  cashReceivedRaw: "20.00",
  patientName: "Asha",
  doctorName: "Dr Rao",
  prescriptionNote: "twice daily",
};

const roundTrip = parseSaleDraft(serializeSaleDraft(draft));
assert.ok(roundTrip);
assert.equal(roundTrip.docType, "bill");
assert.equal(roundTrip.customerId, "cust-1");
assert.equal(roundTrip.lines.length, 2);
assert.equal(roundTrip.lines[0].unitPrice, 1050n);
assert.equal(roundTrip.lines[0].qty, 2);
assert.equal(roundTrip.lines[0].taxRate, 5);
assert.equal(roundTrip.lines[1].productId, null);
assert.equal(roundTrip.lines[1].unitPrice, 250n);
assert.equal(roundTrip.paidRaw, "10.50");
assert.equal(roundTrip.method, "upi");
assert.equal(roundTrip.cashReceivedRaw, "20.00");
assert.equal(roundTrip.patientName, "Asha");
assert.equal(roundTrip.doctorName, "Dr Rao");
assert.equal(roundTrip.prescriptionNote, "twice daily");
assert.ok(saleDraftIsMeaningful(roundTrip));
assert.equal(parseSaleDraft("{}"), null);
assert.equal(parseSaleDraft('{"docType":"cash_memo","method":"cash","lines":[]}'), null);

const messy = parseSaleDraft(
  '{"docType":"cash_memo","method":"cash","discountRaw":"","paidRaw":"","saleDate":"","notes":"","walkInName":"","walkInPhone":"","customerId":"","cashReceivedRaw":"","lines":[{"key":"x","qty":1,"unitPrice":"12.34","taxRate":0}]}',
);
assert.ok(messy);
assert.equal(messy.lines[0].unitPrice, 0n);
assert.equal(messy.patientName, "");
assert.equal(messy.doctorName, "");
assert.equal(messy.prescriptionNote, "");

console.log("draft asserts ok");
