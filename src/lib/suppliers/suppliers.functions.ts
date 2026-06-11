import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SupplierInput = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  tax_number: z.string().max(50).optional().nullable(),
});

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { search?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.search && data.search.trim()) q = q.ilike("name", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getSupplier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("suppliers").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("المورد غير موجود");
    return row;
  });

export const createSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SupplierInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("suppliers")
      .insert({
        owner_id: context.userId,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        tax_number: data.tax_number || null,
      })
      .select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).merge(SupplierInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("suppliers")
      .update({
        name: rest.name,
        phone: rest.phone || null,
        email: rest.email || null,
        tax_number: rest.tax_number || null,
      })
      .eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getSupplierLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { supplierId: string }) =>
    z.object({ supplierId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const [
      { data: supplier, error: sErr },
      { data: invoices, error: iErr },
      { data: payments, error: pErr },
    ] = await Promise.all([
      context.supabase.from("suppliers").select("*").eq("id", data.supplierId).maybeSingle(),
      context.supabase
        .from("purchase_invoices")
        .select("id, invoice_number, invoice_type, invoice_date, total, payment_type, due_date, created_at, purchase_payments(amount)")
        .eq("supplier_id", data.supplierId)
        .order("invoice_date", { ascending: true })
        .order("created_at", { ascending: true }),
      context.supabase
        .from("purchase_payments")
        .select("id, amount, payment_date, method, reference, notes, created_at, invoice_id, purchase_invoices(invoice_number, supplier_id)")
        .order("payment_date", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    if (sErr) throw new Error(sErr.message);
    if (iErr) throw new Error(iErr.message);
    if (pErr) throw new Error(pErr.message);
    if (!supplier) throw new Error("المورد غير موجود");

    const supplierPayments = (payments ?? []).filter(
      (p: any) => p.purchase_invoices?.supplier_id === data.supplierId,
    );

    let totalPurchases = 0;
    let totalDebits = 0;
    const invoiceRows = (invoices ?? []).map((inv: any) => {
      const total = Number(inv.total);
      const paid = (inv.purchase_payments ?? []).reduce(
        (s: number, p: any) => s + Number(p.amount), 0,
      );
      const remaining = total - paid;
      if (inv.invoice_type === "purchase") totalPurchases += total;
      else totalDebits += total;
      return { ...inv, paid, remaining };
    });
    const totalPaid = supplierPayments.reduce((s, p: any) => s + Number(p.amount), 0);

    return {
      supplier,
      invoices: invoiceRows,
      payments: supplierPayments,
      summary: {
        total_purchases: totalPurchases,
        total_debits: totalDebits,
        total_paid: totalPaid,
        balance: Number(supplier.balance),
      },
    };
  });