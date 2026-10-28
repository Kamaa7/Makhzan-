import type { ReactNode, RefObject } from "react";
import { getCurrency, moneyPlaceholder, moneyStep } from "../lib/money";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-gray-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger" | "success";
}) {
  const valueClass =
    tone === "danger" ? "text-red-600" : tone === "success" ? "text-green-700" : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      {children}
    </div>
  );
}

export function WarningBanner({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-green-100 text-green-800"
      : status === "partial"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";
  const label = status === "paid" ? "Paid" : status === "partial" ? "Partial" : "Unpaid";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export function DocTypeBadge({ type }: { type: string }) {
  if (type === "cash_memo") {
    return <span className="inline-flex rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">Cash memo</span>;
  }
  return <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">Bill</span>;
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-black" />
      <span>{label}</span>
    </div>
  );
}

export function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
        active ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

export function MoneyInput({
  value,
  onChange,
  currency,
  inputRef,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  currency: string;
  inputRef?: RefObject<HTMLInputElement>;
  placeholder?: string;
}) {
  const def = getCurrency(currency);
  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="input-field pr-12"
        inputMode="decimal"
        step={moneyStep(currency)}
        placeholder={placeholder ?? moneyPlaceholder(currency)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-400">
        {def.code}
      </span>
    </div>
  );
}
