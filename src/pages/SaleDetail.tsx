import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { ShortcutHint } from "../components/ShortcutsDialog";
import { DocTypeBadge, MoneyInput, PageHeader, Spinner, StatusBadge } from "../components/ui";
import { useShortcuts } from "../hooks/useShortcuts";
import { isCtrlKey, isDialogOpen, isFKey } from "../lib/shortcuts";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PAYMENT_METHODS } from "../lib/constants";
import { docTypeLabel, formatDate, formatQty } from "../lib/format";
import { amountInWords } from "../lib/amountInWords";
import { asPaise, formatMoney, parseMajorInput } from "../lib/money";
import { downloadSalePdf } from "../lib/pdf";
import { getSale, listSaleItems, listSalePayments, recordSalePayment } from "../db";
import type { PaymentMethod, Sale, SaleItem, SalePayment } from "../lib/types";

export function SaleDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const currency = profile?.currency || "INR";
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id) return;
    const s = getSale(id);
    const i = listSaleItems(id);
    const p = listSalePayments(id);
    if (!s) {
      push("Sale not found", "error");
      navigate("/sales");
      return;
    }
    setSale(s);
    setItems(i);
    setPayments(p);
  };

  useEffect(() => {
    load()
      .catch((err) => push(err instanceof Error ? err.message : "Could not load sale", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (payOpen) amountRef.current?.focus();
  }, [payOpen]);

  useShortcuts([
    {
      match: (e) => isFKey(e, 8),
      preventDefault: true,
      run: () => {
        if (!sale) return;
        const dueNow = asPaise(sale.grand_total) - asPaise(sale.amount_paid);
        if (dueNow <= 0n) return;
        if (isDialogOpen() && !payOpen) return;
        setPayOpen(true);
        amountRef.current?.focus();
      },
    },
    {
      match: (e) => isCtrlKey(e, "p"),
      preventDefault: true,
      run: () => {
        if (isDialogOpen() || !sale) return;
        navigate(`/sales/${sale.id}/print`);
      },
    },
  ]);

  if (loading) return <Spinner label="Loading sale…" />;
  if (!sale || !profile) return null;

  const due = asPaise(sale.grand_total) - asPaise(sale.amount_paid);

  const recordPayment = async (e: FormEvent) => {
    e.preventDefault();
    let paise: bigint;
    try {
      paise = parseMajorInput(amount, currency);
    } catch (err) {
      push(err instanceof Error ? err.message : "Check the amount decimals", "error");
      return;
    }
    if (paise <= 0n) {
      push("Enter an amount", "error");
      return;
    }
    setBusy(true);
    try {
      await recordSalePayment({
        sale_id: sale.id,
        amount: Number(paise),
        method,
        note,
      });
      push("Payment recorded", "success");
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Payment failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={sale.doc_number}
        subtitle={`${formatDate(sale.sale_date)} · ${docTypeLabel(sale.doc_type)}`}
        actions={
          <>
            <DocTypeBadge type={sale.doc_type} />
            <StatusBadge status={sale.status} />
            <button type="button" className="btn-secondary" onClick={() => downloadSalePdf(sale, items, profile)}>
              Download PDF
            </button>
            <Link className="btn-secondary" to={`/sales/${sale.id}/print`}>
              A4
              <ShortcutHint keys="Ctrl+P" />
            </Link>
            <Link className="btn-primary" to={`/sales/${sale.id}/print?format=80`}>
              Receipt
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4 text-sm">
          <p className="label">Billed to</p>
          <p className="font-semibold">{sale.customer_name || "Walk-in"}</p>
          <p>{sale.customer_phone}</p>
          <p>{sale.customer_address}</p>
          {sale.customer_gstin && <p>GSTIN: {sale.customer_gstin}</p>}
        </div>
        <div className="card space-y-1 p-4 text-sm">
          <Row k="Subtotal" v={formatMoney(asPaise(sale.subtotal), currency)} />
          <Row k="Discount" v={formatMoney(asPaise(sale.discount), currency)} />
          <Row k="Tax" v={formatMoney(asPaise(sale.tax_total), currency)} />
          {asPaise(sale.round_off) !== 0n ? (
            <Row k="Round off" v={formatMoney(asPaise(sale.round_off), currency)} />
          ) : null}
          <Row k="Grand total" v={formatMoney(asPaise(sale.grand_total), currency)} />
          <Row k="Paid" v={formatMoney(asPaise(sale.amount_paid), currency)} />
          <Row k="Due" v={formatMoney(due, currency)} />
          <p className="pt-2 text-xs text-slate-500">{amountInWords(asPaise(sale.grand_total), currency)}</p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Tax %</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{item.description}</td>
                <td className="px-3 py-2 text-right">{formatQty(Number(item.qty))}</td>
                <td className="px-3 py-2">{item.unit}</td>
                <td className="px-3 py-2 text-right">{formatMoney(asPaise(item.unit_price), currency)}</td>
                <td className="px-3 py-2 text-right">{item.tax_rate}</td>
                <td className="px-3 py-2 text-right">{formatMoney(asPaise(item.line_amount), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Payment history</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">No payments yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between border-b border-gray-100 pb-2">
                  <span>
                    {new Date(p.created_at).toLocaleString("en-IN")} · {p.method}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                  <span>{formatMoney(asPaise(p.amount), currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {due > 0n && (
          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Record payment</h2>
            <p className="text-sm text-slate-500">Due {formatMoney(due, currency)}</p>
            <button type="button" className="btn-primary" onClick={() => setPayOpen(true)}>
              Record payment
              <ShortcutHint keys="F8" />
            </button>
          </div>
        )}
      </div>
      {payOpen && due > 0n && (
        <Modal title="Record payment" onClose={() => setPayOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              await recordPayment(e);
              setPayOpen(false);
            }}
          >
            <MoneyInput inputRef={amountRef} currency={currency} value={amount} onChange={setAmount} placeholder="Amount" />
            <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input className="input-field" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-primary" type="submit" disabled={busy}>
              Record payment
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{k}</span>
      <span>{v}</span>
    </div>
  );
}
