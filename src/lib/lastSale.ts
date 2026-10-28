function lastSaleKey(userId: string): string {
  return `makhzan.lastSale.${userId}`;
}

export function getLastSaleId(userId: string): string | null {
  if (!userId) return null;
  try {
    const value = localStorage.getItem(lastSaleKey(userId));
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function setLastSaleId(userId: string, saleId: string): void {
  if (!userId || !saleId) return;
  try {
    localStorage.setItem(lastSaleKey(userId), saleId);
  } catch {
    /* ignore */
  }
}
