import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Bi } from "../components/Bi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { amountInWords } from "../lib/amountInWords";
import { formatDate, formatQty } from "../lib/format";
import { asPaise, formatMoney } from "../lib/money";
import { downloadReceiptPdf, downloadSalePdf, memoTitle } from "../lib/pdf";
import { getSale, listSaleItems } from "../db";
import type { Sale, SaleItem, StoreProfile } from "../lib/types";

export function SalePrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const { push } = useToast();
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [ready, setReady] = useState(false);
  const is80 = params.get("format") === "80";

  useEffect(() => {
    if (!id) return;
    try {
      const s = getSale(id);
      if (s) setSale(s);
      else push("Sale not found", "error");
      setItems(listSaleItems(id));
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not load memo", "error");
    } finally {
      setReady(true);
    }
  }, [id, push]);

  useEffect(() => {
    if (!ready || !sale || !profile) return;
    if (params.get("download") === "1") {
      if (is80) downloadReceiptPdf(sale, items, profile);
      else downloadSalePdf(sale, items, profile);
    }
    if (params.get("autoprint") === "1") {
      const t = window.setTimeout(() => window.print(), 400);
      return () => window.clearTimeout(t);
    }
  }, [ready, sale, items, profile, params, is80]);

  if (!sale || !profile) return <p className="p-6 text-sm text-slate-500">Loading memo…</p>;

  const printQuery = (format80: boolean, extra = "") => {
    const q = new URLSearchParams();
    if (format80) q.set("format", "80");
    if (extra) q.set(extra, "1");
    const s = q.toString();
    return `/sales/${sale.id}/print${s ? `?${s}` : ""}`;
  };

  return (
    <div className={is80 ? "mx-auto w-[80mm] bg-white text-black" : "mx-auto max-w-[210mm] bg-white"}>
      {is80 ? (
        <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } html, body { background: #fff; color: #000; } }`}</style>
      ) : null}
      <div className="no-print mb-4 flex flex-wrap gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          Print
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => (is80 ? downloadReceiptPdf(sale, items, profile) : downloadSalePdf(sale, items, profile))}
        >
          Download PDF
        </button>
        <Link className={`btn-outline ${!is80 ? "bg-gray-100" : ""}`} to={printQuery(false)}>
          A4
        </Link>
        <Link className={`btn-outline ${is80 ? "bg-gray-100" : ""}`} to={printQuery(true)}>
          Receipt
        </Link>
        <Link className="btn-outline" to={`/sales/${sale.id}`}>
          Back to sale
        </Link>
      </div>
      {is80 ? <ReceiptBody sale={sale} items={items} profile={profile} /> : <A4Body sale={sale} items={items} profile={profile} />}
    </div>
  );
}

function A4Body({ sale, items, profile }: { sale: Sale; items: SaleItem[]; profile: StoreProfile }) {
  const currency = profile.currency || "INR";
  const due = asPaise(sale.grand_total) - asPaise(sale.amount_paid);
  const roundOff = asPaise(sale.round_off);
  return (
    <article className="min-h-[297mm] px-10 py-8 text-gray-900">
      <header className="flex items-start justify-between gap-6 border-b-2 border-gray-900 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{profile.business_name || "Store"}</h1>
          <p className="mt-1 whitespace-pre-line text-sm">{profile.address}</p>
          <p className="text-sm">
            {profile.phone}
            {profile.email ? ` · ${profile.email}` : ""}
          </p>
          {profile.gstin.trim() && <p className="mt-1 text-sm font-semibold">GSTIN: {profile.gstin}</p>}
        </div>
        <p className="text-xl font-semibold text-gray-900">
          <MemoHeading sale={sale} profile={profile} />
        </p>
      </header>
      <div className="mt-4 flex justify-between text-sm">
        <div>
          <p className="text-xs uppercase text-slate-500">Billed to</p>
          <p className="font-semibold">{sale.customer_name || "Walk-in"}</p>
          <p>{sale.customer_phone}</p>
          <p className="whitespace-pre-line">{sale.customer_address}</p>
          {sale.customer_gstin && <p>GSTIN: {sale.customer_gstin}</p>}
        </div>
        <div className="text-right">
          <p>
            <strong>{sale.doc_number}</strong>
          </p>
          <p>{formatDate(sale.sale_date)}</p>
        </div>
      </div>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-y border-gray-900 text-left">
            <th className="py-2">#</th>
            <th>Item</th>
            <th className="text-right">Qty</th>
            <th>Unit</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Tax %</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} className="border-b border-gray-200">
              <td className="py-1.5">{i + 1}</td>
              <td>{item.description}</td>
              <td className="text-right">{formatQty(Number(item.qty))}</td>
              <td>{item.unit}</td>
              <td className="text-right">{formatMoney(asPaise(item.unit_price), currency)}</td>
              <td className="text-right">{item.tax_rate}</td>
              <td className="text-right">{formatMoney(asPaise(item.line_amount), currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 ml-auto w-64 space-y-1 text-sm">
        <Line k={<Bi k="subtotal" inline />} v={formatMoney(asPaise(sale.subtotal), currency)} />
        <Line k={<Bi k="discount" inline />} v={formatMoney(asPaise(sale.discount), currency)} />
        <Line k={<Bi k="tax" inline />} v={formatMoney(asPaise(sale.tax_total), currency)} />
        {roundOff !== 0n ? <Line k={<Bi k="roundOff" inline />} v={formatMoney(roundOff, currency)} /> : null}
        <Line k={<Bi k="grandTotal" inline />} v={formatMoney(asPaise(sale.grand_total), currency)} />
        <Line k={<Bi k="paid" inline />} v={formatMoney(asPaise(sale.amount_paid), currency)} />
        <Line k={<Bi k="due" inline />} v={formatMoney(due, currency)} />
      </div>
      <p className="mt-6 text-sm italic">{amountInWords(asPaise(sale.grand_total), currency)}</p>
      {sale.notes && <p className="mt-3 text-sm">Notes: {sale.notes}</p>}
      {profile.memo_footer && <p className="mt-6 text-sm">{profile.memo_footer}</p>}
      <p className="mt-16 text-right text-sm">Authorised signature</p>
    </article>
  );
}

function ReceiptBody({ sale, items, profile }: { sale: Sale; items: SaleItem[]; profile: StoreProfile }) {
  const currency = profile.currency || "INR";
  const due = asPaise(sale.grand_total) - asPaise(sale.amount_paid);
  const roundOff = asPaise(sale.round_off);
  return (
    <article className="px-2 py-3 text-xs text-black">
      <h1 className="text-center text-sm font-bold">{profile.business_name || "Store"}</h1>
      {profile.gstin.trim() ? <p className="text-center">GSTIN: {profile.gstin}</p> : null}
      <p className="mt-1 text-center font-semibold">
        <MemoHeading sale={sale} profile={profile} />
      </p>
      <p className="text-center">{sale.doc_number}</p>
      <p className="text-center">{formatDate(sale.sale_date)}</p>
      {sale.customer_name.trim() ? <p className="text-center">{sale.customer_name}</p> : null}
      <table className="mt-2 w-full">
        <thead>
          <tr className="border-y border-black text-left">
            <th className="py-1">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="py-0.5">{item.description}</td>
              <td className="text-right">{formatQty(Number(item.qty))}</td>
              <td className="text-right">{formatMoney(asPaise(item.line_amount), currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 space-y-0.5">
        <Line k={<Bi k="subtotal" inline />} v={formatMoney(asPaise(sale.subtotal), currency)} />
        <Line k={<Bi k="discount" inline />} v={formatMoney(asPaise(sale.discount), currency)} />
        <Line k={<Bi k="tax" inline />} v={formatMoney(asPaise(sale.tax_total), currency)} />
        {roundOff !== 0n ? <Line k={<Bi k="roundOff" inline />} v={formatMoney(roundOff, currency)} /> : null}
        <Line k={<Bi k="total" inline />} v={formatMoney(asPaise(sale.grand_total), currency)} />
        <Line k={<Bi k="paid" inline />} v={formatMoney(asPaise(sale.amount_paid), currency)} />
        <Line k={<Bi k="due" inline />} v={formatMoney(due, currency)} />
      </div>
      <p className="mt-2 italic">{amountInWords(asPaise(sale.grand_total), currency)}</p>
      {profile.memo_footer ? <p className="mt-2">{profile.memo_footer}</p> : null}
    </article>
  );
}

function Line({ k, v }: { k: ReactNode; v: string }) {
  return (
    <div className="flex justify-between">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function MemoHeading({ sale, profile }: { sale: Sale; profile: StoreProfile }) {
  const title = memoTitle(sale, profile);
  const k = title === "CASH MEMO" ? "cashMemo" : title === "TAX INVOICE" ? "taxInvoice" : "bill";
  return <Bi k={k} en={title} />;
}
