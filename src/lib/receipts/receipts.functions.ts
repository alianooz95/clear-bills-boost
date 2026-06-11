import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateInput = z.object({
  customer_id: z.string().uuid(),
  amount: z.number().positive(),
  receipt_date: z.string().min(1),
  method: z.string().max(50).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
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
    return row;
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
    return row;
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