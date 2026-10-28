import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { Bi } from "../components/Bi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { ShortcutHint } from "../components/ShortcutsDialog";
import { PageHeader, Spinner } from "../components/ui";
import { useShortcuts } from "../hooks/useShortcuts";
import { isCtrlKey, isDialogOpen, isFKey } from "../lib/shortcuts";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { asPaise, formatMoney } from "../lib/money";
import { deleteCustomer, insertCustomer, listCustomers, listOpenSaleDues, updateCustomer } from "../db";
import type { Customer } from "../lib/types";

type Row = Customer & { due: bigint };

export function Customers() {
  const { profile } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const currency = profile?.currency || "INR";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dues, setDues] = useState<Record<string, bigint>>({});
  const [onlyDues, setOnlyDues] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Customer | "new" | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setCustomers(listCustomers());
    const map: Record<string, bigint> = {};
    for (const s of listOpenSaleDues()) {
      map[s.customer_id] = (map[s.customer_id] ?? 0n) + (asPaise(s.grand_total) - asPaise(s.amount_paid));
    }
    setDues(map);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => push(err instanceof Error ? err.message : "Could not load customers", "error"))
      .finally(() => setLoading(false));
  }, [load, push]);

  const rows: Row[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers
      .map((c) => ({ ...c, due: dues[c.id] ?? 0n }))
      .filter((c) => {
        if (onlyDues && c.due <= 0n) return false;
        if (!term) return true;
        return (
          c.name.toLowerCase().includes(term) ||
          c.phone.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term)
        );
      });
  }, [customers, dues, onlyDues, q]);

  const openAddCustomer = () => {
    if (editor === "new") {
      nameRef.current?.focus();
      return;
    }
    setEditor("new");
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
      match: (e) => isCtrlKey(e, "n"),
      preventDefault: true,
      run: () => {
        if (isDialogOpen() && editor !== "new") return;
        openAddCustomer();
      },
    },
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle="Walk-in sales do not need a saved customer."
        actions={
          <button type="button" className="btn-primary" onClick={openAddCustomer}>
            Add customer
            <ShortcutHint keys="Ctrl+N" />
          </button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={searchRef}
          className="input-field max-w-xs"
          placeholder="Search name, phone, email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyDues} onChange={(e) => setOnlyDues(e.target.checked)} />
          Only with dues
        </label>
      </div>
      {loading ? (
        <Spinner label="Loading customers…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No customers"
          body="Add a customer to raise bills on credit. Cash memos can stay walk-in."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditor("new")}>
              Add customer
            </button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">GSTIN</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">
                    <button type="button" className="text-left hover:underline" onClick={() => navigate(`/customers/${c.id}`)}>
                      {c.name}
                    </button>
                  </td>
                  <td className="px-3 py-2">{c.phone || "—"}</td>
                  <td className="px-3 py-2">{c.gstin || "—"}</td>
                  <td className="px-3 py-2 text-right">{c.due > 0n ? formatMoney(c.due, currency) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="btn-ghost text-xs" onClick={() => setEditor(c)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    >
                      <Bi k="statement" />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => navigate(`/sale?customer=${c.id}`)}
                    >
                      New sale
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => navigate(`/sales?customer=${c.id}`)}
                    >
                      Sales
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editor && (
        <CustomerEditor
          key={editor === "new" ? "new" : editor.id}
          initial={editor === "new" ? null : editor}
          nameRef={nameRef}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            await load();
            setEditor(null);
          }}
        />
      )}
    </div>
  );
}

function CustomerEditor({
  initial,
  nameRef,
  onClose,
  onSaved,
}: {
  initial: Customer | null;
  nameRef: RefObject<HTMLInputElement>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name || "",
    phone: initial?.phone || "",
    email: initial?.email || "",
    address: initial?.address || "",
    gstin: initial?.gstin || "",
    notes: initial?.notes || "",
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      push("Name is required", "error");
      return;
    }
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      gstin: form.gstin.trim(),
      notes: form.notes.trim(),
    };
    try {
      if (initial) await updateCustomer(initial.id, payload);
      else await insertCustomer(payload);
      push("Customer saved", "success");
      await onSaved();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not save customer", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      await deleteCustomer(initial.id);
      push("Customer deleted", "success");
      await onSaved();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not delete", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? "Edit customer" : "Add customer"} onClose={onClose}>
      <form className="space-y-3" onSubmit={save}>
        <input
          ref={nameRef}
          className="input-field"
          placeholder="Name *"
          required
          autoFocus={!initial}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input className="input-field" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="input-field" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <textarea className="input-field min-h-[72px]" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input className="input-field" placeholder="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
        <textarea className="input-field min-h-[72px]" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="flex gap-2">
          <button className="btn-primary" type="submit" disabled={busy}>
            Save
          </button>
          <button className="btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          {initial && (
            <button className="btn-ghost text-red-700" type="button" onClick={() => setConfirmDelete(true)} disabled={busy}>
              Delete
            </button>
          )}
        </div>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete customer"
        message="Delete this customer? Past sales keep the billed-to snapshot."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          void remove();
        }}
      />
    </Modal>
  );
}
