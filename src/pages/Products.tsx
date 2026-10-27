import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { ShortcutHint } from "../components/ShortcutsDialog";
import { FilterChip, MoneyInput, PageHeader, Spinner, StatCard } from "../components/ui";
import { useShortcuts } from "../hooks/useShortcuts";
import { isCtrlKey, isDialogOpen, isFKey } from "../lib/shortcuts";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { UNITS } from "../lib/constants";
import { formatQty } from "../lib/format";
import { asPaise, formatMoney, lineAmount, parseMajorInput, paiseToRupeesNumber } from "../lib/money";
import {
  adjustStock,
  deleteProduct,
  getProduct,
  insertProduct,
  listProducts,
  listStockMovements,
  updateProduct,
} from "../db";
import type { Product, StockMovement } from "../lib/types";

type Filter = "active" | "low" | "inactive" | "all";

export function Products() {
  const { profile } = useAuth();
  const { push } = useToast();
  const [params, setParams] = useSearchParams();
  const currency = profile?.currency || "INR";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("active");
  const [q, setQ] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [editor, setEditor] = useState<Product | "new" | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const skuFocusRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setProducts(listProducts());
  }, []);

  useEffect(() => {
    load()
      .catch((err) => push(err instanceof Error ? err.message : "Could not load products", "error"))
      .finally(() => setLoading(false));
  }, [load, push]);

  useEffect(() => {
    if (params.get("new") === "1") {
      setEditor("new");
    }
  }, [params]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === "active" && !p.is_active) return false;
      if (filter === "inactive" && p.is_active) return false;
      if (filter === "low" && !(p.is_active && Number(p.stock_qty) <= Number(p.low_stock_alert))) return false;
      if (!term) return true;
      return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
    });
  }, [products, filter, q]);

  const stats = useMemo(() => {
    const active = products.filter((p) => p.is_active);
    const low = active.filter((p) => Number(p.stock_qty) <= Number(p.low_stock_alert)).length;
    const out = active.filter((p) => Number(p.stock_qty) <= 0).length;
    const value = active.reduce((s, p) => s + lineAmount(Number(p.stock_qty), asPaise(p.sale_price)), 0n);
    return { active: active.length, low, out, value };
  }, [products]);

  const findBySku = (code: string) =>
    products.find((p) => p.sku && p.sku.toLowerCase() === code.toLowerCase());

  const onScan = (code: string) => {
    if (editor) return;
    const found = findBySku(code);
    if (found) {
      setHighlight(found.id);
      setStockFor(found);
      push(found.name, "success");
      document.getElementById(`product-${found.id}`)?.scrollIntoView({ block: "center" });
      return;
    }
    push(`No product for barcode ${code}`, "error", {
      label: "Add product with this SKU",
      onAction: () => {
        setParams({ new: "1", sku: code });
        setEditor("new");
      },
    });
  };

  useBarcodeScanner(onScan, !editor);

  const openAddProduct = () => {
    if (editor === "new") {
      skuFocusRef.current?.focus();
      return;
    }
    setParams({ new: "1" });
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
        openAddProduct();
      },
    },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Stock"
        subtitle="SKU is the barcode. Scan to find or open stock."
        actions={
          <button type="button" className="btn-primary" onClick={openAddProduct}>
            Add product
            <ShortcutHint keys="Ctrl+N" />
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Active" value={String(stats.active)} />
        <StatCard label="Low stock" value={String(stats.low)} tone={stats.low > 0 ? "danger" : undefined} />
        <StatCard label="Out of stock" value={String(stats.out)} tone={stats.out > 0 ? "danger" : undefined} />
        <StatCard label="Stock value" value={formatMoney(stats.value, currency)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["active", "low", "inactive", "all"] as Filter[]).map((f) => (
          <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f === "low" ? "Low stock" : f[0].toUpperCase() + f.slice(1)}
          </FilterChip>
        ))}
        <input
          ref={searchRef}
          className="input-field max-w-xs"
          placeholder="Search name or SKU"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <Spinner label="Loading products…" />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No products yet"
          body="Add your first item. Focus the SKU field and scan the barcode, then type the name and price."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditor("new")}>
              Add product
            </button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Unit</th>
                <th className="text-right">Price</th>
                <th className="text-right">Tax %</th>
                <th className="text-right">Stock</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr
                  id={`product-${p.id}`}
                  key={p.id}
                  className={highlight === p.id ? "bg-gray-100" : ""}
                >
                  <td className="px-3 py-2 font-mono text-xs">{p.sku || "—"}</td>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">{p.unit}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(asPaise(p.sale_price), currency)}</td>
                  <td className="px-3 py-2 text-right">{p.tax_rate}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={Number(p.stock_qty) <= Number(p.low_stock_alert) ? "text-red-700" : ""}>
                      {formatQty(Number(p.stock_qty))}
                    </span>
                  </td>
                  <td className="px-3 py-2">{p.is_active ? "Active" : "Inactive"}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="btn-ghost text-xs" onClick={() => setEditor(p)}>
                      Edit
                    </button>
                    <button type="button" className="btn-ghost text-xs" onClick={() => setStockFor(p)}>
                      Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editor && (
        <ProductEditor
          key={editor === "new" ? "new" : editor.id}
          initial={editor === "new" ? null : editor}
          initialSku={params.get("sku") || ""}
          skuRef={skuFocusRef}
          currency={currency}
          onClose={() => {
            setEditor(null);
            setParams({});
          }}
          onSaved={async () => {
            await load();
            setEditor(null);
            setParams({});
          }}
        />
      )}

      {stockFor && (
        <StockModal
          product={stockFor}
          currency={currency}
          onClose={() => setStockFor(null)}
          onChanged={async () => {
            await load();
            const next = getProduct(stockFor.id);
            if (next) setStockFor(next);
          }}
        />
      )}
    </div>
  );
}

function ProductEditor({
  initial,
  initialSku,
  skuRef,
  currency,
  onClose,
  onSaved,
}: {
  initial: Product | null;
  initialSku: string;
  skuRef: RefObject<HTMLInputElement>;
  currency: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    sku: initial?.sku || initialSku,
    name: initial?.name || "",
    unit: initial?.unit || "pcs",
    price: initial ? String(paiseToRupeesNumber(asPaise(initial.sale_price), currency)) : "",
    tax: initial ? String(initial.tax_rate) : "0",
    alert: initial ? String(initial.low_stock_alert) : "5",
    opening: "",
    is_active: initial?.is_active ?? true,
  });

  useEffect(() => {
    skuRef.current?.focus();
  }, [skuRef]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      push("Name is required", "error");
      return;
    }
    let salePrice: bigint;
    try {
      salePrice = parseMajorInput(form.price, currency);
    } catch (err) {
      push(err instanceof Error ? err.message : "Check the price decimals", "error");
      return;
    }
    setBusy(true);
    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      unit: form.unit,
      sale_price: Number(salePrice),
      tax_rate: Number(form.tax || 0),
      low_stock_alert: Number(form.alert || 0),
      is_active: form.is_active,
    };
    try {
      if (initial) {
        await updateProduct(initial.id, payload);
      } else {
        const opening = Number(form.opening || 0);
        await insertProduct({
          ...payload,
          opening_qty: Number.isFinite(opening) ? opening : 0,
        });
      }
      push("Product saved", "success");
      await onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save product";
      if (/products_user_sku_unique|duplicate/i.test(message)) {
        push("This SKU is already used", "error");
      } else {
        push(message, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      await updateProduct(initial.id, {
        sku: initial.sku,
        name: initial.name,
        unit: initial.unit,
        sale_price: Number(asPaise(initial.sale_price)),
        tax_rate: Number(initial.tax_rate),
        low_stock_alert: Number(initial.low_stock_alert),
        is_active: false,
      });
      push("Product deactivated", "success");
      await onSaved();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not deactivate", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      await deleteProduct(initial.id);
      push("Product deleted", "success");
      await onSaved();
    } catch (err) {
      push(
        err instanceof Error
          ? `${err.message} If this item is on a sale, deactivate it instead.`
          : "Could not delete",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? "Edit product" : "Add product"} onClose={onClose}>
      <form className="space-y-3" onSubmit={save}>
        <p className="text-xs text-slate-500">Focus SKU and scan once. Then type the name and price.</p>
        <div>
          <label className="label">SKU / barcode</label>
          <input
            ref={skuRef}
            className="input-field font-mono"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Name *</label>
          <input className="input-field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Unit</label>
            <select className="input-field" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Sale price</label>
            <MoneyInput currency={currency} value={form.price} onChange={(price) => setForm({ ...form, price })} />
          </div>
          <div>
            <label className="label">Tax %</label>
            <input className="input-field" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} />
          </div>
          <div>
            <label className="label">Low-stock alert</label>
            <input className="input-field" value={form.alert} onChange={(e) => setForm({ ...form, alert: e.target.value })} />
          </div>
        </div>
        {!initial && (
          <div>
            <label className="label">Opening stock (optional)</label>
            <input
              className="input-field"
              value={form.opening}
              onChange={(e) => setForm({ ...form, opening: e.target.value })}
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Active
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <button className="btn-primary" type="submit" disabled={busy}>
            Save
          </button>
          <button className="btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          {initial && (
            <>
              <button className="btn-ghost" type="button" onClick={deactivate} disabled={busy}>
                Deactivate
              </button>
              <button className="btn-ghost text-red-700" type="button" onClick={() => setConfirmDelete(true)} disabled={busy}>
                Delete
              </button>
            </>
          )}
        </div>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete product"
        message="Delete this product? If it appears on a sale, delete will be blocked — deactivate instead."
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

function StockModal({
  product,
  currency,
  onClose,
  onChanged,
}: {
  product: Product;
  currency: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { push } = useToast();
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [reason, setReason] = useState<"purchase" | "return" | "adjustment">("purchase");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<StockMovement[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setHistory(listStockMovements(product.id, 100));
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not load history", "error");
    }
  }, [product.id, push, product.stock_qty]);

  const apply = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      push("Enter a quantity greater than zero", "error");
      return;
    }
    const change = mode === "remove" ? -n : n;
    const rpcReason = mode === "remove" ? "adjustment" : reason;
    setBusy(true);
    try {
      await adjustStock({
        product_id: product.id,
        change_qty: change,
        reason: rpcReason,
        note,
      });
      push("Stock updated", "success");
      setQty("");
      setNote("");
      await onChanged();
    } catch (err) {
      push(err instanceof Error ? err.message : "Stock update failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Stock · ${product.name}`} onClose={onClose} wide>
      <p className="mb-3 text-sm text-slate-500">
        On hand: <strong>{formatQty(Number(product.stock_qty))}</strong> {product.unit} ·{" "}
        {formatMoney(asPaise(product.sale_price), currency)}
      </p>
      <form className="mb-6 grid gap-3 sm:grid-cols-2" onSubmit={apply}>
        <div className="flex gap-2">
          <button type="button" className={mode === "add" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("add")}>
            Add
          </button>
          <button
            type="button"
            className={mode === "remove" ? "btn-primary" : "btn-secondary"}
            onClick={() => {
              setMode("remove");
              setReason("adjustment");
            }}
          >
            Remove
          </button>
        </div>
        {mode === "add" ? (
          <select
            className="input-field"
            value={reason}
            onChange={(e) => setReason(e.target.value as "purchase" | "return" | "adjustment")}
          >
            <option value="purchase">Purchase</option>
            <option value="return">Customer return</option>
            <option value="adjustment">Correction</option>
          </select>
        ) : (
          <p className="self-center text-sm text-slate-500">Recorded as an adjustment.</p>
        )}
        <input className="input-field" placeholder="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
        <input className="input-field" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-primary sm:col-span-2" type="submit" disabled={busy}>
          Apply stock change
        </button>
      </form>
      <h3 className="mb-2 text-sm font-semibold">History (last 100)</h3>
      <div className="max-h-64 overflow-auto text-sm">
        {history.length === 0 ? (
          <p className="text-slate-500">No movements yet.</p>
        ) : (
          <table className="w-full">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1">When</th>
                <th>Reason</th>
                <th className="text-right">Change</th>
                <th className="text-right">Balance</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {history.map((m) => (
                <tr key={m.id} className="border-t border-gray-100">
                  <td className="py-1 text-xs">{new Date(m.created_at).toLocaleString("en-IN")}</td>
                  <td>{m.reason}</td>
                  <td className="text-right">{formatQty(Number(m.change_qty))}</td>
                  <td className="text-right">{formatQty(Number(m.balance_after))}</td>
                  <td className="text-slate-500">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}
