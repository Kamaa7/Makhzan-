import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ShortcutHint } from "../components/ShortcutsDialog";
import { MoneyInput, PageHeader, WarningBanner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { useShortcuts } from "../hooks/useShortcuts";
import { isCtrlEnter, isDialogOpen, isEscape, isFKey } from "../lib/shortcuts";
import { PAYMENT_METHODS } from "../lib/constants";
import { formatQty, newId, todayISO } from "../lib/format";
import {
  asPaise,
  computeSaleTotals,
  formatMoney,
  lineAmount,
  moneyStep,
  parseMajorInput,
  parseMajorInputSafe,
  paiseToRupeesNumber,
} from "../lib/money";
import { createSale, listActiveProducts, listCustomers } from "../db";
import type { CounterLine, Customer, DocType, PaymentMethod, Product } from "../lib/types";

export function NewSale() {
  const { profile } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const currency = profile?.currency || "INR";
  const scanRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const paidRef = useRef<HTMLInputElement>(null);

  const [docType, setDocType] = useState<DocType>(params.get("customer") ? "bill" : "cash_memo");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>(params.get("customer") || "");
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [lines, setLines] = useState<CounterLine[]>([]);
  const [discountRaw, setDiscountRaw] = useState("");
  const [paidRaw, setPaidRaw] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [saleDate, setSaleDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    try {
      setProducts(listActiveProducts());
      setCustomers(listCustomers());
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not load the counter", "error");
    }
  }, [push]);

  useEffect(() => {
    if (params.get("customer")) setDocType("bill");
  }, [params]);

  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

  const discount = parseMajorInputSafe(discountRaw, currency);
  const totals = useMemo(() => computeSaleTotals(lines, discount), [lines, discount]);
  const due =
    totals.grandTotal - (docType === "cash_memo" ? totals.grandTotal : parseMajorInputSafe(paidRaw, currency));

  const addProduct = (product: Product, beepName = true) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.key === existing.key ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          key: newId(),
          productId: product.id,
          sku: product.sku,
          description: product.name,
          unit: product.unit,
          qty: 1,
          unitPrice: asPaise(product.sale_price),
          taxRate: Number(product.tax_rate),
          stockQty: Number(product.stock_qty),
        },
      ];
    });
    if (beepName) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.04;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } catch {
        /* ignore */
      }
      push(product.name, "success");
    }
  };

  const onScan = (code: string) => {
    const found = products.find((p) => p.sku && p.sku.toLowerCase() === code.toLowerCase());
    if (found) {
      addProduct(found);
      return;
    }
    push(`No product for barcode ${code}`, "error", {
      label: "Add product with this SKU",
      onAction: () => navigate(`/products?new=1&sku=${encodeURIComponent(code)}`),
    });
  };

  useBarcodeScanner(onScan, true);

  useEffect(() => {
    const id = window.setInterval(() => {
      const el = document.activeElement;
      if (el === document.body || el === scanRef.current) scanRef.current?.focus();
    }, 800);
    return () => window.clearInterval(id);
  }, []);

  const searchHits = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 1) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
      .slice(0, 8);
  }, [search, products]);

  const stockBlockers = lines.filter(
    (l) => l.productId && l.stockQty !== null && l.qty > (l.stockQty ?? 0),
  );

  const updateLine = (key: string, patch: Partial<CounterLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const save = async (andPrint: boolean) => {
    if (lines.length === 0) {
      push("Add at least one item", "error");
      return;
    }
    if (stockBlockers.length) {
      push("A tracked product would go below zero", "error");
      return;
    }
    if (discount > totals.subtotal) {
      push("Discount cannot exceed subtotal", "error");
      return;
    }
    const customerName = selectedCustomer?.name || walkInName.trim();
    if (docType === "bill" && !customerName) {
      push("A bill requires a customer name", "error");
      return;
    }
    let paid = totals.grandTotal;
    try {
      parseMajorInput(discountRaw, currency);
      paid = docType === "cash_memo" ? totals.grandTotal : parseMajorInput(paidRaw, currency);
    } catch (err) {
      push(err instanceof Error ? err.message : "Check the amount decimals", "error");
      return;
    }
    if (paid > totals.grandTotal) {
      push("Amount paid cannot exceed the total", "error");
      return;
    }
    setBusy(true);
    try {
      const id = await createSale({
        doc_type: docType,
        items: lines.map((l) => ({
          product_id: l.productId,
          description: l.description,
          unit: l.unit,
          qty: l.qty,
          unit_price: Number(l.unitPrice),
          tax_rate: l.taxRate,
        })),
        customer_id: customerId || null,
        customer_name: customerName,
        customer_phone: selectedCustomer?.phone || walkInPhone,
        customer_email: selectedCustomer?.email || "",
        customer_address: selectedCustomer?.address || "",
        customer_gstin: selectedCustomer?.gstin || "",
        discount: Number(discount),
        amount_paid: Number(paid),
        payment_method: method,
        sale_date: saleDate,
        notes,
      });
      push("Sale saved", "success");
      navigate(andPrint ? `/sales/${id}/print?autoprint=1` : `/sales/${id}`);
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not save sale", "error");
    } finally {
      setBusy(false);
    }
  };

  const clearBill = () => {
    setLines([]);
    setDiscountRaw("");
    setPaidRaw("");
    setNotes("");
    setWalkInName("");
    setWalkInPhone("");
  };

  const dirty =
    lines.length > 0 ||
    Boolean(discountRaw.trim() || paidRaw.trim() || notes.trim() || walkInName.trim() || walkInPhone.trim() || customerId);

  const requestClear = () => {
    if (dirty) setConfirmClear(true);
    else clearBill();
  };

  useShortcuts([
    {
      match: (e) => isFKey(e, 2),
      preventDefault: true,
      run: () => {
        if (isDialogOpen()) return;
        searchRef.current?.focus();
      },
    },
    {
      match: (e) => isFKey(e, 4),
      preventDefault: true,
      run: () => {
        if (isDialogOpen()) return;
        setDocType((prev) => (prev === "cash_memo" ? "bill" : "cash_memo"));
      },
    },
    {
      match: (e) => isFKey(e, 6),
      preventDefault: true,
      run: () => {
        if (isDialogOpen()) return;
        discountRef.current?.focus();
      },
    },
    {
      match: (e) => isFKey(e, 7),
      preventDefault: true,
      run: () => {
        if (isDialogOpen() || docType !== "bill") return;
        paidRef.current?.focus();
      },
    },
    {
      match: (e) => isFKey(e, 8) || isCtrlEnter(e),
      preventDefault: true,
      run: () => {
        if (isDialogOpen() || busy) return;
        void save(false);
      },
    },
    {
      match: (e) => isFKey(e, 9),
      preventDefault: true,
      run: () => {
        if (isDialogOpen() || busy) return;
        void save(true);
      },
    },
    {
      match: (e) => isFKey(e, 10),
      preventDefault: true,
      run: () => {
        if (isDialogOpen()) return;
        requestClear();
      },
    },
    {
      match: (e) => isEscape(e) && !isDialogOpen(),
      run: () => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        scanRef.current?.focus();
      },
    },
  ]);

  return (
    <div className="space-y-5">
      <input
        ref={scanRef}
        className="sr-only"
        aria-label="Barcode scan"
        autoComplete="off"
        onFocus={() => undefined}
      />
      <PageHeader
        title="New Sale"
        subtitle={docType === "cash_memo" ? "Paid in full now." : "Credit / part payment."}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${docType === "cash_memo" ? "bg-black text-white" : "text-gray-600"}`}
                onClick={() => setDocType("cash_memo")}
              >
                Cash memo
              </button>
              <button
                type="button"
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${docType === "bill" ? "bg-black text-white" : "text-gray-600"}`}
                onClick={() => setDocType("bill")}
              >
                Bill
              </button>
            </div>
            <span className="text-xs text-slate-400">F4</span>
          </div>
        }
      />
      <p className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700">
        <span className="h-1.5 w-1.5 rounded-full bg-black" />
        Scanner ready — gun will add items
      </p>

      {!profile?.business_name.trim() && (
        <WarningBanner>
          Shop name is empty.{" "}
          <Link to="/store" className="font-medium text-gray-900 underline underline-offset-4">
            Open Store Profile
          </Link>{" "}
          before printing.
        </WarningBanner>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <div className="relative">
            <input
              ref={searchRef}
              className="input-field"
              placeholder="Search name or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searchHits.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-md">
                {searchHits.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                    onClick={() => {
                      addProduct(p, false);
                      setSearch("");
                    }}
                  >
                    <span>
                      {p.name}{" "}
                      <span className="font-mono text-xs text-slate-500">{p.sku}</span>
                    </span>
                    <span>{formatMoney(asPaise(p.sale_price), currency)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                {
                  key: newId(),
                  productId: null,
                  sku: "",
                  description: "Custom item",
                  unit: "pcs",
                  qty: 1,
                  unitPrice: 0n,
                  taxRate: 0,
                  stockQty: null,
                },
              ])
            }
          >
            Custom item
          </button>

          <div className="table-wrap">
            <table className="min-w-[720px]">
              <thead>
                <tr>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2 w-24">Qty</th>
                  <th className="px-2 py-2 w-28">Rate</th>
                  <th className="px-2 py-2 w-20">Tax %</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      Scan a barcode, search a product, or add a custom item.
                    </td>
                  </tr>
                ) : (
                  lines.map((l) => {
                    const amt = lineAmount(l.qty, l.unitPrice);
                    const over = l.productId && l.stockQty !== null && l.qty > l.stockQty;
                    return (
                      <tr key={l.key}>
                        <td className="px-2 py-2">
                          <input
                            className="input-field"
                            value={l.description}
                            onChange={(e) => updateLine(l.key, { description: e.target.value })}
                          />
                          {over && (
                            <p className="mt-1 text-xs text-red-700">
                              Only {formatQty(l.stockQty ?? 0)} in stock
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="input-field"
                            value={String(l.qty)}
                            onChange={(e) => updateLine(l.key, { qty: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="input-field"
                            inputMode="decimal"
                            step={moneyStep(currency)}
                            value={String(paiseToRupeesNumber(l.unitPrice, currency))}
                            onChange={(e) => {
                              try {
                                updateLine(l.key, { unitPrice: parseMajorInput(e.target.value, currency) });
                              } catch {
                                /* extra fraction digits are rejected */
                              }
                            }}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="input-field"
                            value={String(l.taxRate)}
                            onChange={(e) => updateLine(l.key, { taxRate: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="money px-2 py-2 text-right">{formatMoney(amt, currency)}</td>
                        <td className="px-2 py-2">
                          <button type="button" className="btn-ghost text-xs" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="card space-y-3 p-5">
          <div>
            <label className="label">Customer</label>
            <select
              className="input-field"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                if (e.target.value) setDocType("bill");
              }}
            >
              <option value="">Walk-in</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {!customerId && (
            <>
              <input
                className="input-field"
                placeholder={docType === "bill" ? "Customer name *" : "Name (optional)"}
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
              />
              <input className="input-field" placeholder="Phone" value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} />
            </>
          )}
          <div>
            <label className="label">Date</label>
            <input className="input-field" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Discount</label>
            <MoneyInput inputRef={discountRef} currency={currency} value={discountRaw} onChange={setDiscountRaw} />
          </div>
          {docType === "bill" && (
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Amount paid now</label>
                <button type="button" className="text-xs font-semibold text-gray-900" onClick={() => setPaidRaw(String(paiseToRupeesNumber(totals.grandTotal, currency)))}>
                  Full
                </button>
              </div>
              <MoneyInput inputRef={paidRef} currency={currency} value={paidRaw} onChange={setPaidRaw} placeholder="Amount paid" />
            </div>
          )}
          <textarea className="input-field min-h-[64px]" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <dl className="space-y-2 border-t border-gray-100 pt-3 text-sm">
            <Row k="Subtotal" v={formatMoney(totals.subtotal, currency)} />
            <Row k="Discount" v={formatMoney(discount, currency)} />
            <Row k="Tax" v={formatMoney(totals.taxTotal, currency)} />
            <Row k="Grand" v={formatMoney(totals.grandTotal, currency)} strong />
            <Row k="Due" v={formatMoney(due < 0n ? 0n : due, currency)} />
          </dl>
          {stockBlockers.length > 0 && (
            <p className="text-xs text-red-700">Save is blocked until quantities fit on-hand stock.</p>
          )}
          <div className="flex flex-col gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => save(false)}>
              Save
              <ShortcutHint keys="F8" />
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => save(true)}>
              Save and print
              <ShortcutHint keys="F9" />
            </button>
            <button type="button" className="btn-ghost" onClick={requestClear}>
              Clear
              <ShortcutHint keys="F10" />
            </button>
          </div>
        </aside>
      </div>
      <ConfirmDialog
        open={confirmClear}
        title="Clear this bill?"
        message="Items, discount, payment, notes, and walk-in details will be removed."
        confirmLabel="Clear"
        danger
        onConfirm={clearBill}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className={`money ${strong ? "font-semibold" : ""}`}>{v}</dd>
    </div>
  );
}
