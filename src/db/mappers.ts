import type { Customer, Product, Sale, SaleItem, SalePayment, StockMovement, StoreProfile } from "../lib/types";

export function mapProfile(row: Record<string, unknown>): StoreProfile {
  return {
    user_id: String(row.user_id),
    business_name: String(row.business_name ?? ""),
    address: String(row.address ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    gstin: String(row.gstin ?? ""),
    memo_footer: String(row.memo_footer ?? ""),
    currency: String(row.currency ?? "INR"),
  };
}

export function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    sku: String(row.sku ?? ""),
    name: String(row.name),
    unit: String(row.unit ?? "pcs"),
    sale_price: Number(row.sale_price),
    tax_rate: Number(row.tax_rate),
    stock_qty: Number(row.stock_qty),
    low_stock_alert: Number(row.low_stock_alert),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

export function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    address: String(row.address ?? ""),
    gstin: String(row.gstin ?? ""),
    notes: String(row.notes ?? ""),
    created_at: String(row.created_at),
  };
}

export function mapSale(row: Record<string, unknown>): Sale {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    doc_type: row.doc_type === "bill" ? "bill" : "cash_memo",
    doc_number: String(row.doc_number),
    sale_date: String(row.sale_date),
    customer_id: row.customer_id ? String(row.customer_id) : null,
    customer_name: String(row.customer_name ?? ""),
    customer_phone: String(row.customer_phone ?? ""),
    customer_email: String(row.customer_email ?? ""),
    customer_address: String(row.customer_address ?? ""),
    customer_gstin: String(row.customer_gstin ?? ""),
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    tax_total: Number(row.tax_total),
    grand_total: Number(row.grand_total),
    amount_paid: Number(row.amount_paid),
    payment_method: row.payment_method as Sale["payment_method"],
    status: row.status as Sale["status"],
    notes: String(row.notes ?? ""),
    created_at: String(row.created_at),
  };
}

export function mapSaleItem(row: Record<string, unknown>): SaleItem {
  return {
    id: String(row.id),
    sale_id: String(row.sale_id),
    product_id: row.product_id ? String(row.product_id) : null,
    position: Number(row.position),
    description: String(row.description),
    unit: String(row.unit ?? "pcs"),
    qty: Number(row.qty),
    unit_price: Number(row.unit_price),
    tax_rate: Number(row.tax_rate),
    line_amount: Number(row.line_amount),
  };
}

export function mapPayment(row: Record<string, unknown>): SalePayment {
  return {
    id: String(row.id),
    sale_id: String(row.sale_id),
    amount: Number(row.amount),
    method: row.method as SalePayment["method"],
    note: String(row.note ?? ""),
    created_at: String(row.created_at),
  };
}

export function mapMovement(row: Record<string, unknown>): StockMovement {
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    change_qty: Number(row.change_qty),
    balance_after: Number(row.balance_after),
    reason: row.reason as StockMovement["reason"],
    note: String(row.note ?? ""),
    sale_id: row.sale_id ? String(row.sale_id) : null,
    created_at: String(row.created_at),
  };
}
