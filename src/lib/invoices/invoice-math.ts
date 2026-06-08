export type InvoiceItemInput = {
  item_name: string;
  sold_quantity: number;
  bonus_quantity: number;
  unit_price: number;
  discount_amount: number;
};

export function computeLineTotal(it: Pick<InvoiceItemInput, "sold_quantity" | "unit_price" | "discount_amount">) {
  // Bonus quantity is intentionally excluded from the financial value.
  return round2(it.sold_quantity * it.unit_price - it.discount_amount);
}

export function computeInvoiceTotals(items: InvoiceItemInput[]) {
  let subtotal = 0;
  let discount_total = 0;
  for (const it of items) {
    subtotal += it.sold_quantity * it.unit_price;
    discount_total += it.discount_amount;
  }
  subtotal = round2(subtotal);
  discount_total = round2(discount_total);
  return { subtotal, discount_total, total: round2(subtotal - discount_total) };
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMoney(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}