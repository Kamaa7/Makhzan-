import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bi } from "../components/Bi";
import { PageHeader, StatCard, WarningBanner } from "../components/ui";
import { ShortcutHint } from "../components/ShortcutsDialog";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useShortcuts } from "../hooks/useShortcuts";
import { formatLastBackupAt, getDayCloseStats, getHomeStats, getSale, readLastBackupAt, saveKeeperBackup } from "../db";
import { PAYMENT_METHODS } from "../lib/constants";
import { markDayReviewed, readDayReviewed, type DayReviewed } from "../lib/dayReviewed";
import { todayISO } from "../lib/format";
import type { ArKey } from "../lib/i18n";
import { getLastSaleId } from "../lib/lastSale";
import { asPaise, formatMoney } from "../lib/money";
import { isAltLetter, isDialogOpen } from "../lib/shortcuts";
import type { PaymentMethod } from "../lib/types";

export function Home() {
  const { profile, user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const currency = profile?.currency || "INR";
  const userId = user?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState(0n);
  const [collected, setCollected] = useState(0n);
  const [outstanding, setOutstanding] = useState(0n);
  const [lowStock, setLowStock] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [backupAt, setBackupAt] = useState<string | null>(() => readLastBackupAt());
  const [backupBusy, setBackupBusy] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [collectedByMethod, setCollectedByMethod] = useState<Record<PaymentMethod, bigint> | null>(null);
  const [stillDue, setStillDue] = useState(0n);
  const [reviewed, setReviewed] = useState<DayReviewed | null>(null);
  const today = todayISO();

  useEffect(() => {
    try {
      const stats = getHomeStats(today);
      setTodayCount(stats.todayCount);
      setTodaySales(asPaise(stats.todaySales));
      setCollected(asPaise(stats.collected));
      setOutstanding(asPaise(stats.outstanding));
      setLowStock(stats.lowStock);
      setBackupAt(readLastBackupAt());
      const lastId = getLastSaleId(userId);
      setLastSaleId(lastId && getSale(lastId) ? lastId : null);
      const close = getDayCloseStats(today);
      const byMethod = {} as Record<PaymentMethod, bigint>;
      for (const m of PAYMENT_METHODS) byMethod[m.value] = asPaise(close.byMethod[m.value]);
      setCollectedByMethod(byMethod);
      setStillDue(asPaise(close.stillDue));
      const stored = readDayReviewed(userId);
      setReviewed(stored?.date === today ? stored : null);
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not load home", "error");
    } finally {
      setLoading(false);
    }
  }, [push, userId, today]);

  const reprintLast = () => {
    if (isDialogOpen() || !lastSaleId) return;
    navigate(`/sales/${lastSaleId}/print`);
  };

  useShortcuts([
    {
      match: (e) => isAltLetter(e, "r"),
      preventDefault: true,
      run: reprintLast,
    },
  ]);

  const saveBackup = async () => {
    setBackupBusy(true);
    try {
      await saveKeeperBackup();
      setBackupAt(readLastBackupAt());
      push("Backup file downloaded", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not save backup", "error");
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Home"
        subtitle={todayISO()}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" disabled={!lastSaleId} onClick={reprintLast}>
              Reprint last
              <ShortcutHint keys="Alt+R" />
            </button>
            <Link to="/sale" className="btn-primary">
              New sale
            </Link>
          </div>
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
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-600">
            <Bi k="lastBackup" />
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatLastBackupAt(backupAt)}</p>
          <p className="mt-1 text-xs text-slate-500">Automatic copy stays in this browser. This button saves a file.</p>
          <button type="button" className="btn-secondary mt-3" disabled={backupBusy} onClick={() => void saveBackup()}>
            {backupBusy ? "Saving…" : <Bi k="saveBackup" />}
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              <Bi k="dayClose" />
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{today} · payments taken today, not locked</p>
          </div>
          {reviewed ? (
            <button type="button" className="btn-secondary text-xs" onClick={() => setReviewed(markDayReviewed(userId, today))}>
              <Bi k="reviewed" />{" "}
              {new Date(reviewed.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </button>
          ) : (
            <button type="button" className="btn-secondary text-xs" onClick={() => setReviewed(markDayReviewed(userId, today))}>
              <Bi k="markDayReviewed" />
            </button>
          )}
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Bi k="collectedToday" />
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PAYMENT_METHODS.map((m) => (
            <div key={m.value} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-xs text-slate-500">
                <Bi k={m.value as ArKey} />
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {loading || !collectedByMethod ? "…" : formatMoney(collectedByMethod[m.value], currency)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-600">
          <Bi k="stillDue" />
        </p>
        <p className="mt-1 text-xl font-semibold text-gray-900">{loading ? "…" : formatMoney(stillDue, currency)}</p>
        <p className="mt-1 text-xs text-slate-500">Outstanding on today&apos;s documents. Does not block new sales.</p>
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
