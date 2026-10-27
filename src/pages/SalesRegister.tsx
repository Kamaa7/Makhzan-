import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ShortcutHint } from "../components/ShortcutsDialog";
import { DocTypeBadge, FilterChip, PageHeader, Spinner, StatCard, StatusBadge } from "../components/ui";
import { useShortcuts } from "../hooks/useShortcuts";
import { isAltLetter, isDialogOpen, isFKey } from "../lib/shortcuts";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { docTypeLabel, formatDate, monthStartISO, statusLabel, todayISO } from "../lib/format";
import { asPaise, formatMoney, formatPaisePlain } from "../lib/money";
import { listSales } from "../db";
import type { DocType, Sale, SaleStatus } from "../lib/types";

type Range = "today" | "month" | "all" | "custom";

/** Named export used by App.tsx — keep this name so Vite/ESM can bind it. */
export function SalesRegister() {
  const { profile } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const currency = profile?.currency || "INR";
  const [range, setRange] = useState<Range>("today");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [docType, setDocType] = useState<DocType | "">("");
  const [status, setStatus] = useState<SaleStatus | "">("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const customerFilter = params.get("customer") || "";

  useEffect(() => {
    if (range === "today") {
      setFrom(todayISO());
      setTo(todayISO());
    } else if (range === "month") {
      setFrom(monthStartISO());
      setTo(todayISO());
    }
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = listSales({
          from: range === "all" ? undefined : from,
          to: range === "all" ? undefined : to,
          docType,
          status,
          customerId: customerFilter || undefined,
          limit: 1000,
        });
        if (!cancelled) setRows(data);
      } catch (err) {
        push(err instanceof Error ? err.message : "Could not load sales", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, from, to, docType, status, customerFilter, push]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.doc_number.toLowerCase().includes(term) ||
        r.customer_name.toLowerCase().includes(term) ||
        r.customer_phone.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const stats = useMemo(() => {
    let total = 0n;
    let collected = 0n;
    for (const r of visible) {
      total += asPaise(r.grand_total);
      collected += asPaise(r.amount_paid);
    }
    return { count: visible.length, total, collected, outstanding: total - collected };
  }, [visible]);

  const exportCsv = () => {
    const header = [
      "Date",
      "Number",
      "Type",
      "Customer",
      "Phone",
      "Currency",
      "Subtotal",
      "Discount",
      "Tax",
      "Total",
      "Paid",
      "Due",
      "Status",
      "Method",
    ];
    const lines = visible.map((r) => {
      const due = asPaise(r.grand_total) - asPaise(r.amount_paid);
      return [
        r.sale_date,
        r.doc_number,
        docTypeLabel(r.doc_type),
        r.customer_name,
        r.customer_phone,
        currency,
        formatPaisePlain(asPaise(r.subtotal), currency),
        formatPaisePlain(asPaise(r.discount), currency),
        formatPaisePlain(asPaise(r.tax_total), currency),
        formatPaisePlain(asPaise(r.grand_total), currency),
        formatPaisePlain(asPaise(r.amount_paid), currency),
        formatPaisePlain(due, currency),
        statusLabel(r.status),
        r.payment_method,
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = `\uFEFF${header.join(",")}\n${lines.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const fromName = range === "all" ? "all" : from;
    const toName = range === "all" ? "all" : to;
    a.download = `sales-${fromName}-to-${toName}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  useShortcuts([
    {
      match: (e) => isFKey(e, 3),
      preventDefault: true,
      run: () => {
        if (isDialogOpen()) return;
        searchRef.current?.focus();
      },
    },
    {
      match: (e) => isAltLetter(e, "e"),
      preventDefault: true,
      run: () => {
        if (isDialogOpen() || visible.length === 0) return;
        exportCsv();
      },
    },
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Register"
        subtitle="Up to 1,000 header rows."
        actions={
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={visible.length === 0}>
            Export CSV
            <ShortcutHint keys="Alt+E" />
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={range === "today"} onClick={() => setRange("today")}>
          Today
        </FilterChip>
        <FilterChip active={range === "month"} onClick={() => setRange("month")}>
          This month
        </FilterChip>
        <FilterChip active={range === "all"} onClick={() => setRange("all")}>
          All time
        </FilterChip>
        <FilterChip active={range === "custom"} onClick={() => setRange("custom")}>
          Custom
        </FilterChip>
        {range === "custom" && (
          <>
            <input className="input-field w-auto" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input className="input-field w-auto" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
        <select className="input-field w-auto" value={docType} onChange={(e) => setDocType(e.target.value as DocType | "")}>
          <option value="">Cash memo / Bill</option>
          <option value="cash_memo">Cash memo</option>
          <option value="bill">Bill</option>
        </select>
        <select className="input-field w-auto" value={status} onChange={(e) => setStatus(e.target.value as SaleStatus | "")}>
          <option value="">Any status</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <input
          ref={searchRef}
          className="input-field max-w-xs"
          placeholder="Number, customer, phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Documents" value={String(stats.count)} />
        <StatCard label="Total sales" value={formatMoney(stats.total, currency)} />
        <StatCard label="Collected" value={formatMoney(stats.collected, currency)} tone="success" />
        <StatCard label="Outstanding" value={formatMoney(stats.outstanding, currency)} tone={stats.outstanding > 0n ? "danger" : undefined} />
      </div>

      {loading ? (
        <Spinner label="Loading register…" />
      ) : visible.length === 0 ? (
        <EmptyState title="No sales in this view" body="Change the filters or record a sale from the counter." />
      ) : (
        <div className="table-wrap">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Number</th>
                <th>Type</th>
                <th>Customer</th>
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => navigate(`/sales/${r.id}`)}>
                  <td>{formatDate(r.sale_date)}</td>
                  <td className="font-mono text-xs">{r.doc_number}</td>
                  <td>
                    <DocTypeBadge type={r.doc_type} />
                  </td>
                  <td>{r.customer_name || "Walk-in"}</td>
                  <td className="text-right">{formatMoney(asPaise(r.grand_total), currency)}</td>
                  <td className="text-right">{formatMoney(asPaise(r.amount_paid), currency)}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
