import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AllocationInput = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive(),
});

const CreateInput = z.object({
  customer_id: z.string().uuid(),
  amount: z.number().positive(),
  receipt_date: z.string().min(1),
  method: z.string().max(50).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  allocations: z.array(AllocationInput).default([]),
});

export const listCustomerReceipts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customer_id?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("customer_receipts")
      .select("*, customers(name)")
      .order("receipt_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.customer_id) q = q.eq("customer_id", data.customer_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCustomerReceipt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customer_receipts")
      .select("*, customers(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("السند غير موجود");
    const { data: allocs, error: aErr } = await context.supabase
      .from("invoice_payments")
      .select("id, amount, invoice_id, invoices(invoice_number, invoice_date, total, payment_type, due_date)")
      .eq("source_receipt_id", data.id);
    if (aErr) throw new Error(aErr.message);
    return { ...row, allocations: allocs ?? [] };
  });

export const createCustomerReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: numData, error: nErr } = await context.supabase.rpc(
      "generate_customer_receipt_number",
    );
    if (nErr) throw new Error(nErr.message);
    const receiptNumber = numData as unknown as string;

    // Validate allocations
    const allocTotal = data.allocations.reduce((s, a) => s + a.amount, 0);
    if (allocTotal > data.amount + 0.001) {
      throw new Error("مجموع التوزيع على الفواتير أكبر من مبلغ السند");
    }
    // Verify invoices belong to the same customer
    if (data.allocations.length > 0) {
      const ids = data.allocations.map((a) => a.invoice_id);
      const { data: invs, error: iErr } = await context.supabase
        .from("invoices")
        .select("id, customer_id, invoice_type")
        .in("id", ids);
      if (iErr) throw new Error(iErr.message);
      for (const inv of invs ?? []) {
        if (inv.customer_id !== data.customer_id) throw new Error("فاتورة لا تخص نفس العميل");
        if (inv.invoice_type !== "sales") throw new Error("يمكن التوزيع فقط على فواتير المبيعات");
      }
    }

    const { data: row, error } = await context.supabase
      .from("customer_receipts")
      .insert({
        owner_id: context.userId,
        customer_id: data.customer_id,
        receipt_number: receiptNumber,
        amount: data.amount,
        receipt_date: data.receipt_date,
        method: data.method || null,
        reference: data.reference || null,
        notes: data.notes || null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (data.allocations.length > 0) {
      const payRows = data.allocations.map((a) => ({
        owner_id: context.userId,
        invoice_id: a.invoice_id,
        amount: a.amount,
        payment_date: data.receipt_date,
        method: data.method || null,
        reference: receiptNumber,
        notes: `سند تحصيل ${receiptNumber}`,
        source_receipt_id: row.id,
      }));
      const { error: pErr } = await context.supabase.from("invoice_payments").insert(payRows);
      if (pErr) {
        await context.supabase.from("customer_receipts").delete().eq("id", row.id);
        throw new Error(pErr.message);
      }
    }
    return row;
  });

export const listOpenInvoicesForCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customer_id: string }) =>
    z.object({ customer_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, total, payment_type, due_date, invoice_payments(amount)")
      .eq("customer_id", data.customer_id)
      .eq("invoice_type", "sales")
      .in("payment_type", ["deferred_cash", "credit"])
      .order("invoice_date", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? [])
      .map((r: any) => {
        const paid = (r.invoice_payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        return { ...r, paid, remaining: Number(r.total) - paid };
      })
      .filter((r) => r.remaining > 0.001);
  });

export const deleteCustomerReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("customer_receipts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });