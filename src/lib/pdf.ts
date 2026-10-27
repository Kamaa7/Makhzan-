import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { amountInWords } from "./amountInWords";
import { formatDate, formatQty } from "./format";
import { asPaise, formatMoney } from "./money";
import type { Sale, SaleItem, StoreProfile } from "./types";

function memoTitle(sale: Sale, profile: StoreProfile): string {
  if (sale.doc_type === "cash_memo") return "CASH MEMO";
  if (profile.gstin.trim() && asPaise(sale.tax_total) > 0n) return "TAX INVOICE";
  return "BILL";
}

export function buildSalePdf(sale: Sale, items: SaleItem[], profile: StoreProfile): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const currency = profile.currency || "INR";
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(profile.business_name || "Store", 14, y);
  doc.setFontSize(12);
  doc.text(memoTitle(sale, profile), pageWidth - 14, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const headerBits = [profile.address, profile.phone && `Phone: ${profile.phone}`, profile.email]
    .filter(Boolean)
    .join("\n");
  if (headerBits) {
    const lines = doc.splitTextToSize(headerBits, 110);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 2;
  }
  if (profile.gstin.trim()) {
    doc.setFont("helvetica", "bold");
    doc.text(`GSTIN: ${profile.gstin}`, 14, y);
    doc.setFont("helvetica", "normal");
    y += 5;
  }

  y += 2;
  doc.setDrawColor(15, 61, 52);
  doc.line(14, y, pageWidth - 14, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`No. ${sale.doc_number}`, 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${formatDate(sale.sale_date)}`, pageWidth - 14, y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("Billed to", 14, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  const billed = [
    sale.customer_name || "Walk-in",
    sale.customer_phone,
    sale.customer_email,
    sale.customer_address,
    sale.customer_gstin && `GSTIN: ${sale.customer_gstin}`,
  ]
    .filter(Boolean)
    .join("\n");
  const billedLines = doc.splitTextToSize(billed, 120);
  doc.text(billedLines, 14, y);
  y += billedLines.length * 4 + 4;

  autoTable(doc, {
    startY: y,
    head: [["#", "Item", "Qty", "Unit", "Rate", "Tax %", "Amount"]],
    body: items.map((item, i) => [
      String(i + 1),
      item.description,
      formatQty(Number(item.qty)),
      item.unit,
      formatMoney(asPaise(item.unit_price), currency),
      String(item.tax_rate),
      formatMoney(asPaise(item.line_amount), currency),
    ]),
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [15, 61, 52], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  y = ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  const rows: [string, string][] = [
    ["Subtotal", formatMoney(asPaise(sale.subtotal), currency)],
    ["Discount", formatMoney(asPaise(sale.discount), currency)],
    ["Tax", formatMoney(asPaise(sale.tax_total), currency)],
    ["Grand total", formatMoney(asPaise(sale.grand_total), currency)],
    ["Paid", formatMoney(asPaise(sale.amount_paid), currency)],
    ["Due", formatMoney(asPaise(sale.grand_total) - asPaise(sale.amount_paid), currency)],
  ];

  autoTable(doc, {
    startY: y,
    body: rows,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40 },
      1: { halign: "right" },
    },
    margin: { left: pageWidth - 84, right: 14 },
  });

  y = ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  doc.setFontSize(9);
  const words = amountInWords(asPaise(sale.grand_total), currency);
  const wordLines = doc.splitTextToSize(`Amount in words: ${words}`, pageWidth - 28);
  doc.text(wordLines, 14, y);
  y += wordLines.length * 4 + 6;

  if (sale.notes.trim()) {
    const noteLines = doc.splitTextToSize(`Notes: ${sale.notes}`, pageWidth - 28);
    doc.text(noteLines, 14, y);
    y += noteLines.length * 4 + 6;
  }

  if (profile.memo_footer.trim()) {
    const footerLines = doc.splitTextToSize(profile.memo_footer, pageWidth - 28);
    doc.setFont("helvetica", "italic");
    doc.text(footerLines, 14, y);
    doc.setFont("helvetica", "normal");
    y += footerLines.length * 4 + 10;
  } else {
    y += 10;
  }

  doc.text("Authorised signature", pageWidth - 14, Math.min(y + 16, 280), { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text(`${currency} · Makhzan`, 14, 287);
  doc.setTextColor(0);

  return doc;
}

export function downloadSalePdf(sale: Sale, items: SaleItem[], profile: StoreProfile): void {
  buildSalePdf(sale, items, profile).save(`${sale.doc_number}.pdf`);
}
