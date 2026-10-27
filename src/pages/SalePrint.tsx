import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { amountInWords } from "../lib/amountInWords";
import { formatDate, formatQty } from "../lib/format";
import { asPaise, formatMoney } from "../lib/money";
import { downloadSalePdf } from "../lib/pdf";
import { getSale, listSaleItems } from "../db";
import type { Sale, SaleItem } from "../lib/types";

export function SalePrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const { push } = useToast();
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [ready, setReady] = useState(false);

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
      downloadSalePdf(sale, items, profile);
    }
    if (params.get("autoprint") === "1") {
      const t = window.setTimeout(() => window.print(), 400);
      return () => window.clearTimeout(t);
    }
  }, [ready, sale, items, profile, params]);

  if (!sale || !profile) return <p className="p-6 text-sm text-slate-500">Loading memo…</p>;

  const currency = profile.currency || "INR";
  const due = asPaise(sale.grand_total) - asPaise(sale.amount_paid);
  const title =
    sale.doc_type === "cash_memo"
      ? "CASH MEMO"
      : profile.gstin.trim() && asPaise(sale.tax_total) > 0n
        ? "TAX INVOICE"
        : "BILL";

  return (
    <div className="mx-auto max-w-[210mm] bg-white">
      <div className="no-print mb-4 flex flex-wrap gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          Print
        </button>
        <button type="button" className="btn-secondary" onClick={() => downloadSalePdf(sale, items, profile)}>
          Download PDF
        </button>
        <Link className="btn-outline" to={`/sales/${sale.id}`}>
          Back to sale
        </Link>
      </div>
      <article className="min-h-[297mm] px-10 py-8 text-ink">
        <header className="flex items-start justify-between gap-6 border-b-2 border-forest pb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{profile.business_name || "Store"}</h1>
            <p className="mt-1 whitespace-pre-line text-sm">{profile.address}</p>
            <p className="text-sm">
              {profile.phone}
              {profile.email ? ` · ${profile.email}` : ""}
            </p>
            {profile.gstin.trim() && <p className="mt-1 text-sm font-semibold">GSTIN: {profile.gstin}</p>}
          </div>
          <p className="text-xl font-semibold text-gray-900">{title}</p>
        </header>
        <div className="mt-4 flex justify-between text-sm">
          <div>
            <p className="text-xs uppercase text-ink-muted">Billed to</p>
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
            <tr className="border-y border-forest text-left">
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
              <tr key={item.id} className="border-b border-ink/10">
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
          <Line k="Subtotal" v={formatMoney(asPaise(sale.subtotal), currency)} />
          <Line k="Discount" v={formatMoney(asPaise(sale.discount), currency)} />
          <Line k="Tax" v={formatMoney(asPaise(sale.tax_total), currency)} />
          <Line k="Grand total" v={formatMoney(asPaise(sale.grand_total), currency)} />
          <Line k="Paid" v={formatMoney(asPaise(sale.amount_paid), currency)} />
          <Line k="Due" v={formatMoney(due, currency)} />
        </div>
        <p className="mt-6 text-sm italic">{amountInWords(asPaise(sale.grand_total), currency)}</p>
        {sale.notes && <p className="mt-3 text-sm">Notes: {sale.notes}</p>}
        {profile.memo_footer && <p className="mt-6 text-sm">{profile.memo_footer}</p>}
        <p className="mt-16 text-right text-sm">Authorised signature</p>
      </article>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
