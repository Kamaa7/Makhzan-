import JsBarcode from "jsbarcode";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bi } from "../components/Bi";
import { PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getProduct } from "../db";
import type { Product } from "../lib/types";

export function ProductLabel() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { push } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [copies, setCopies] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    try {
      const p = getProduct(id);
      if (!p) push("Product not found", "error");
      else setProduct(p);
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not load product", "error");
    } finally {
      setReady(true);
    }
  }, [id, push]);

  const sku = product?.sku.trim() ?? "";
  const n = Math.min(24, Math.max(1, copies));
  const shop = profile?.business_name.trim() || "";

  if (!ready) return <p className="p-6 text-sm text-slate-500">Loading label…</p>;
  if (!product) {
    return (
      <div className="p-6">
        <Link to="/products" className="btn-secondary">
          Back to products
        </Link>
      </div>
    );
  }

  if (!sku) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <p className="text-sm text-gray-700">A SKU is required to print a barcode label.</p>
        <Link to="/products" className="btn-secondary">
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl bg-white text-black">
      <div className="no-print border-b border-gray-200 px-4 py-4">
        <PageHeader
          title={<Bi k="printLabel" />}
          subtitle={product.name}
          actions={
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-slate-500">
                  <Bi k="copies" />
                </span>
                <input
                  className="input-field w-20"
                  type="number"
                  min={1}
                  max={24}
                  value={copies}
                  onChange={(e) => setCopies(Math.min(24, Math.max(1, Number(e.target.value) || 1)))}
                />
              </label>
              <button type="button" className="btn-primary" onClick={() => window.print()}>
                <Bi k="print" />
              </button>
              <Link to="/products" className="btn-secondary">
                Back
              </Link>
            </div>
          }
        />
      </div>
      <style>{`
        @media print {
          @page { size: auto; margin: 4mm; }
          html, body { background: #fff; color: #000; }
        }
      `}</style>
      <div className="flex flex-wrap gap-3 p-4 print:gap-2 print:p-0">
        {Array.from({ length: n }, (_, i) => (
          <article
            key={i}
            className="flex w-[48mm] flex-col items-center justify-center border border-black bg-white px-1.5 py-1.5 text-black"
          >
            {shop ? <p className="w-full truncate text-center text-[9px] font-semibold leading-tight">{shop}</p> : null}
            <p className="w-full truncate text-center text-[10px] font-medium leading-tight">{product.name}</p>
            <SkuBarcode sku={sku} />
            <p className="mt-0.5 font-mono text-[10px] tracking-wide">{sku}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function SkuBarcode({ sku }: { sku: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, sku, {
        format: "CODE128",
        displayValue: false,
        margin: 2,
        height: 36,
        width: 1.4,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      /* invalid CODE128 payload — SKU still prints as text */
    }
  }, [sku]);
  return <svg ref={ref} className="mt-0.5 h-[36px] w-full max-w-[44mm]" />;
}
