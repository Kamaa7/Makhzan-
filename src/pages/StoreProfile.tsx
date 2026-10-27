import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Field, PageHeader, WarningBanner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { countSales, downloadDbFile, replaceDb, updateStoreProfile } from "../db";
import { CURRENCIES, getCurrency } from "../lib/money";

export function StoreProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const { push } = useToast();
  const [form, setForm] = useState({
    business_name: "",
    address: "",
    phone: "",
    email: "",
    gstin: "",
    memo_footer: "",
    currency: "INR",
  });
  const [busy, setBusy] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [saleCount, setSaleCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    setForm({
      business_name: profile.business_name,
      address: profile.address,
      phone: profile.phone,
      email: profile.email || user?.email || "",
      gstin: profile.gstin,
      memo_footer: profile.memo_footer,
      currency: profile.currency || "INR",
    });
  }, [profile, user]);

  useEffect(() => {
    try {
      setSaleCount(countSales());
    } catch {
      setSaleCount(0);
    }
  }, [profile]);

  const currencyLocked = saleCount > 0;
  const currencyOptions = useMemo(() => {
    const code = (form.currency || "INR").toUpperCase();
    if (CURRENCIES.some((c) => c.code === code)) return CURRENCIES;
    return [{ ...getCurrency(code), name: `${code} (saved)` }, ...CURRENCIES];
  }, [form.currency]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.business_name.trim()) {
      push("Shop name is required", "error");
      return;
    }
    const currency = form.currency.trim().toUpperCase();
    if (currency.length !== 3) {
      push("Pick a currency", "error");
      return;
    }
    if (currencyLocked && profile && currency !== profile.currency) {
      push(
        `Currency stays ${profile.currency} because this shop already has sales. Amounts are not converted.`,
        "error",
      );
      return;
    }
    setBusy(true);
    try {
      await updateStoreProfile({
        business_name: form.business_name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        gstin: form.gstin.trim(),
        memo_footer: form.memo_footer.trim(),
        currency,
      });
      await refreshProfile();
      push("Store profile saved", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not save profile", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Store Profile" subtitle="Printed on every cash memo and bill." />
      <form className="card space-y-4" onSubmit={save}>
        <Field label="Shop name" required>
          <input className="input-field" required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
        </Field>
        <Field label="Address">
          <textarea className="input-field min-h-[88px]" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GSTIN">
            <input className="input-field" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          </Field>
          <Field label="Currency">
            <select
              className="input-field"
              value={form.currency}
              disabled={currencyLocked}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              {currencyOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                  {c.decimals === 3 ? " (3 decimals)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {currencyLocked ? (
          <WarningBanner>
            This shop already has sales in {profile?.currency || form.currency}. Amounts are stored in that currency and are not converted, so the picker is locked.
          </WarningBanner>
        ) : (
          <WarningBanner>
            Set this before you enter prices. Amounts are not converted.
          </WarningBanner>
        )}
        <Field label="Memo footer">
          <textarea className="input-field min-h-[88px]" value={form.memo_footer} onChange={(e) => setForm({ ...form, memo_footer: e.target.value })} />
        </Field>
        <button className="btn-primary" type="submit" disabled={busy}>
          Save profile
        </button>
      </form>
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Backup</h2>
        <p className="text-sm text-slate-500">
          Everything is stored in this browser. Download a .db file to keep a copy, or import one to restore.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => downloadDbFile()}>
            Download database
          </button>
          <label className="btn-secondary cursor-pointer">
            Import database
            <input
              type="file"
              accept=".db,.sqlite"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) setImportFile(file);
              }}
            />
          </label>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(importFile)}
        title="Import database"
        message="Import replaces all data in this browser. Continue?"
        confirmLabel="Import"
        danger
        onClose={() => setImportFile(null)}
        onConfirm={() => {
          const file = importFile;
          if (!file) return;
          void (async () => {
            try {
              await replaceDb(new Uint8Array(await file.arrayBuffer()));
              window.location.reload();
            } catch (err) {
              push(err instanceof Error ? err.message : "Import failed", "error");
            }
          })();
        }}
      />
    </div>
  );
}
