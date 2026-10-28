import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bi } from "../components/Bi";
import { EmptyState } from "../components/EmptyState";
import { PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getCustomer, listCustomerPayments, listOpenSaleDues, listSales } from "../db";
import { formatDate, isoToLocalDate, statusLabel } from "../lib/format";
import { asPaise, formatMoney } from "../lib/money";
import type { Customer, Sale, SalePayment } from "../lib/types";

type PaymentRow = SalePayment & { doc_number: string };

export function CustomerStatement() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const currency = profile?.currency || "INR";
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [outstanding, setOutstanding] = useState(0n);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const c = getCustomer(id);
      if (!c) {
        push("Customer not found", "error");
        navigate("/customers", { replace: true });
        return;
      }
      setCustomer(c);
      setSales(listSales({ customerId: id, limit: 5000 }));
      setPayments(listCustomerPayments(id));
      let due = 0n;
      for (const s of listOpenSaleDues()) {
        if (s.customer_id === id) due += asPaise(s.grand_total) - asPaise(s.amount_paid);
      }
      setOutstanding(due);
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not load statement", "error");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, push]);

  const balance = useMemo(
    () => sales.reduce((sum, s) => sum + (asPaise(s.grand_total) - asPaise(s.amount_paid)), 0n),
    [sales],
  );

  if (loading || !customer) {
    return <Spinner label="Loading statement…" />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={<Bi k="statement" />}
        subtitle={`${customer.name}${customer.phone ? ` · ${customer.phone}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/customers" className="btn-secondary">
              Customers
            </Link>
            <button type="button" className="btn-primary" onClick={() => navigate(`/sale?customer=${customer.id}`)}>
              <Bi k="newBill" />
            </button>
          </div>
        }
      />

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-600">
          <Bi k="balance" />
        </p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{formatMoney(balance, currency)}</p>
        {balance !== outstanding ? (
          <p className="mt-1 text-xs text-red-700">Does not match the outstanding figure on the customer list.</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Same as outstanding on the customer list. Walk-in sales are not listed.</p>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">
          <Bi k="bills" />
        </h2>
        {sales.length === 0 ? (
          <EmptyState title="No bills" body="This customer has no saved memos or bills." />
        ) : (
          <div className="table-wrap">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2">
                    <Bi k="date" />
                  </th>
                  <th className="px-3 py-2">
                    <Bi k="number" />
                  </th>
                  <th className="px-3 py-2">
                    <Bi k="type" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <Bi k="total" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <Bi k="paid" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <Bi k="due" />
                  </th>
                  <th className="px-3 py-2">
                    <Bi k="status" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const due = asPaise(s.grand_total) - asPaise(s.amount_paid);
                  return (
                    <tr key={s.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{formatDate(s.sale_date)}</td>
                      <td className="px-3 py-2">
                        <Link className="font-medium underline-offset-2 hover:underline" to={`/sales/${s.id}`}>
                          {s.doc_number}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        {s.doc_type === "cash_memo" ? <Bi k="cashMemo" /> : <Bi k="bill" />}
                      </td>
                      <td className="px-3 py-2 text-right">{formatMoney(asPaise(s.grand_total), currency)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(asPaise(s.amount_paid), currency)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(due, currency)}</td>
                      <td className="px-3 py-2">{statusLabel(s.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">
          <Bi k="payments" />
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">No payments on these bills yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2">
                    <Bi k="date" />
                  </th>
                  <th className="px-3 py-2">
                    <Bi k="number" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <Bi k="amount" />
                  </th>
                  <th className="px-3 py-2">
                    <Bi k="method" />
                  </th>
                  <th className="px-3 py-2">
                    <Bi k="note" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{formatDate(isoToLocalDate(p.created_at))}</td>
                    <td className="px-3 py-2">
                      <Link className="underline-offset-2 hover:underline" to={`/sales/${p.sale_id}`}>
                        {p.doc_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{formatMoney(asPaise(p.amount), currency)}</td>
                    <td className="px-3 py-2 capitalize">{p.method}</td>
                    <td className="px-3 py-2 text-slate-500">{p.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
