import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, StatCard, WarningBanner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getHomeStats } from "../db";
import { todayISO } from "../lib/format";
import { asPaise, formatMoney } from "../lib/money";

export function Home() {
  const { profile } = useAuth();
  const { push } = useToast();
  const currency = profile?.currency || "INR";
  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState(0n);
  const [collected, setCollected] = useState(0n);
  const [outstanding, setOutstanding] = useState(0n);
  const [lowStock, setLowStock] = useState(0);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    try {
      const stats = getHomeStats(todayISO());
      setTodayCount(stats.todayCount);
      setTodaySales(asPaise(stats.todaySales));
      setCollected(asPaise(stats.collected));
      setOutstanding(asPaise(stats.outstanding));
      setLowStock(stats.lowStock);
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not load home", "error");
    } finally {
      setLoading(false);
    }
  }, [push]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Home"
        subtitle={todayISO()}
        actions={
          <Link to="/sale" className="btn-primary">
            New sale
          </Link>
        }
      />
      {!profile?.business_name.trim() && (
        <WarningBanner>
          Shop name is empty. Printed memos will look incomplete.{" "}
          <Link to="/store" className="font-medium text-gray-900 underline underline-offset-4">
            Open Store Profile
          </Link>
        </WarningBanner>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's sales" value={loading ? "…" : formatMoney(todaySales, currency)} hint={`${todayCount} documents`} />
        <StatCard label="Collected" value={loading ? "…" : formatMoney(collected, currency)} hint="Paid on today's sales" tone="success" />
        <StatCard
          label="Outstanding"
          value={loading ? "…" : formatMoney(outstanding, currency)}
          hint="All open bills"
          tone={outstanding > 0n ? "danger" : undefined}
        />
        <StatCard
          label="Low stock"
          value={loading ? "…" : String(lowStock)}
          hint="Active items at or below alert"
          tone={lowStock > 0 ? "danger" : undefined}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/products" className="card transition hover:border-gray-300">
          <p className="font-semibold text-gray-900">Products and stock</p>
          <p className="mt-1 text-sm text-slate-500">Scan a barcode to find an item or adjust stock.</p>
        </Link>
        <Link to="/sales" className="card transition hover:border-gray-300">
          <p className="font-semibold text-gray-900">Sales register</p>
          <p className="mt-1 text-sm text-slate-500">Filter memos and bills, export CSV.</p>
        </Link>
        <Link to="/customers" className="card transition hover:border-gray-300">
          <p className="font-semibold text-gray-900">Customers</p>
          <p className="mt-1 text-sm text-slate-500">Open dues and start a bill.</p>
        </Link>
      </div>
    </div>
  );
}
