export type AuthUser = {
  id: string;
  email: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type PaymentMethod = "cash" | "upi" | "card" | "bank" | "cheque" | "other";
export type DocType = "cash_memo" | "bill";
export type SaleStatus = "paid" | "unpaid" | "partial";
export type StockReason = "opening" | "sale" | "adjustment" | "purchase" | "return";

export type StoreProfile = {
  user_id: string;
  business_name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  memo_footer: string;
  currency: string;
};

export type Product = {
  id: string;
  user_id: string;
  sku: string;
  name: string;
  unit: string;
  sale_price: number;
  tax_rate: number;
  stock_qty: number;
  low_stock_alert: number;
  is_active: boolean;
  created_at: string;
};

export type Customer = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  notes: string;
  created_at: string;
};

export type Sale = {
  id: string;
  user_id: string;
  doc_type: DocType;
  doc_number: string;
  sale_date: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  customer_gstin: string;
  subtotal: number;
  discount: number;
  tax_total: number;
  round_off: number;
  grand_total: number;
  amount_paid: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  notes: string;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string | null;
  position: number;
  description: string;
  unit: string;
  qty: number;
  unit_price: number;
  tax_rate: number;
  line_amount: number;
};

export type SalePayment = {
  id: string;
  sale_id: string;
  amount: number;
  method: PaymentMethod;
  note: string;
  created_at: string;
};

export type StockMovement = {
  id: string;
  product_id: string;
  change_qty: number;
  balance_after: number;
  reason: StockReason;
  note: string;
  sale_id: string | null;
  created_at: string;
};

export type CounterLine = {
  key: string;
  productId: string | null;
  sku: string;
  description: string;
  unit: string;
  qty: number;
  unitPrice: bigint;
  taxRate: number;
  stockQty: number | null;
};
