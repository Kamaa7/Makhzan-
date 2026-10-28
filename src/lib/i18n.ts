export const AR = {
  home: "الرئيسية",
  newSale: "بيع جديد",
  salesRegister: "سجل المبيعات",
  productsStock: "المنتجات والمخزون",
  customers: "العملاء",
  storeProfile: "ملف المتجر",
  settings: "الإعدادات",
  signOut: "تسجيل الخروج",
  cashMemo: "مذكرة نقدية",
  bill: "فاتورة",
  taxInvoice: "فاتورة ضريبية",
  park: "تعليق",
  save: "حفظ",
  saveAndPrint: "حفظ وطباعة",
  clear: "مسح",
  subtotal: "المجموع الفرعي",
  discount: "خصم",
  tax: "ضريبة",
  roundOff: "تقريب",
  grandTotal: "الإجمالي",
  paid: "المدفوع",
  due: "المستحق",
  change: "الباقي",
  scannerReady: "الماسح جاهز",
  scannerPaused: "الماسح متوقف",
  dayClose: "إقفال اليوم",
  collectedToday: "المحصل اليوم",
  stillDue: "لا يزال مستحقاً",
  markDayReviewed: "تأكيد مراجعة اليوم",
  reviewed: "تمت المراجعة",
  lastBackup: "آخر نسخة احتياطية",
  saveBackup: "حفظ نسخة احتياطية",
  cash: "نقد",
  upi: "UPI",
  card: "بطاقة",
  bank: "بنك",
  cheque: "شيك",
  other: "أخرى",
  statement: "كشف الحساب",
  bills: "الفواتير",
  payments: "المدفوعات",
  balance: "الرصيد",
  newBill: "فاتورة جديدة",
  printLabel: "طباعة ملصق",
  total: "المجموع",
  date: "التاريخ",
  number: "الرقم",
  type: "النوع",
  status: "الحالة",
  amount: "المبلغ",
  method: "الطريقة",
  note: "ملاحظة",
  copies: "النسخ",
  print: "طباعة",
} as const;

export type ArKey = keyof typeof AR;

export const EN: Record<ArKey, string> = {
  home: "Home",
  newSale: "New Sale",
  salesRegister: "Sales Register",
  productsStock: "Products & Stock",
  customers: "Customers",
  storeProfile: "Store Profile",
  settings: "Settings",
  signOut: "Sign out",
  cashMemo: "Cash memo",
  bill: "Bill",
  taxInvoice: "Tax invoice",
  park: "Park",
  save: "Save",
  saveAndPrint: "Save and print",
  clear: "Clear",
  subtotal: "Subtotal",
  discount: "Discount",
  tax: "Tax",
  roundOff: "Round off",
  grandTotal: "Grand total",
  paid: "Paid",
  due: "Due",
  change: "Change",
  scannerReady: "Scanner ready — gun will add items",
  scannerPaused: "Scanner paused — Esc returns to the gun",
  dayClose: "Day close",
  collectedToday: "Collected today",
  stillDue: "Still due",
  markDayReviewed: "Mark day reviewed",
  reviewed: "Reviewed",
  lastBackup: "Last backup",
  saveBackup: "Save backup",
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank",
  cheque: "Cheque",
  other: "Other",
  statement: "Statement",
  bills: "Bills",
  payments: "Payments",
  balance: "Balance",
  newBill: "New bill",
  printLabel: "Print label",
  total: "Total",
  date: "Date",
  number: "Number",
  type: "Type",
  status: "Status",
  amount: "Amount",
  method: "Method",
  note: "Note",
  copies: "Copies",
  print: "Print",
};

export function arabicStorageKey(userId: string): string {
  return `makhzan.arabic.${userId}`;
}

export function readArabicOn(userId: string): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(arabicStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeArabicOn(userId: string, on: boolean): void {
  if (!userId) return;
  try {
    localStorage.setItem(arabicStorageKey(userId), on ? "1" : "0");
  } catch {
    /* ignore quota */
  }
}
