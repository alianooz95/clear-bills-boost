import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  item_name: z.string().min(1).max(200),
  sold_quantity: z.number().min(0),
  bonus_quantity: z.number().min(0).default(0),
  unit_price: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
});

const CreateInvoiceInput = z.object({
  customer_id: z.string().uuid(),
  invoice_type: z.enum(["sales", "credit_note"]),
  invoice_date: z.string().min(1),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(ItemSchema).min(1),
});

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customer_id?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("invoices")
      .select("*, customers(name)")
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.customer_id) q = q.eq("customer_id", data.customer_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: inv, error } = await context.supabase
      .from("invoices")
      .select("*, customers(*), invoice_items(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("الفاتورة غير موجودة");
    return inv;
  });

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInvoiceInput.parse(data))
  .handler(async ({ data, context }) => {
    // Verify customer belongs to user (RLS will also enforce)
    const { data: cust, error: cErr } = await context.supabase
      .from("customers")
      .select("id")
      .eq("id", data.customer_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cust) throw new Error("العميل غير موجود");

    // Generate invoice number via RPC
    const { data: numData, error: nErr } = await context.supabase.rpc(
      "generate_invoice_number",
      { p_type: data.invoice_type },
    );
    if (nErr) throw new Error(nErr.message);
    const invoiceNumber = numData as unknown as string;

    const { data: inv, error: iErr } = await context.supabase
      .from("invoices")
      .insert({
        owner_id: context.userId,
        customer_id: data.customer_id,
        invoice_number: invoiceNumber,
        invoice_type: data.invoice_type,
        invoice_date: data.invoice_date,
        notes: data.notes || null,
      })
      .select("*")
      .single();
    if (iErr) throw new Error(iErr.message);

    const itemsPayload = data.items.map((it) => ({
      invoice_id: inv.id,
      item_name: it.item_name,
      sold_quantity: it.sold_quantity,
      bonus_quantity: it.bonus_quantity,
      unit_price: it.unit_price,
      discount_amount: it.discount_amount,
    }));

    const { error: itErr } = await context.supabase.from("invoice_items").insert(itemsPayload);
    if (itErr) {
      // Rollback the invoice if items failed
      await context.supabase.from("invoices").delete().eq("id", inv.id);
      throw new Error(itErr.message);
    }

    return { id: inv.id, invoice_number: invoiceNumber };
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });