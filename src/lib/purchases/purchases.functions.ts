import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  item_name: z.string().min(1).max(200),
  sold_quantity: z.number().min(0),
  bonus_quantity: z.number().min(0).default(0),
  unit_price: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
  unit: z.string().max(50).optional().nullable(),
  batch_number: z.string().max(100).optional().nullable(),
  expiry_date: z.string().optional().nullable(),
});

const CreatePurchaseInput = z.object({
  supplier_id: z.string().uuid(),
  invoice_type: z.enum(["purchase", "debit_note"]),
  invoice_date: z.string().min(1),
  payment_type: z.enum(["cash", "deferred_cash", "credit"]).default("cash"),
  due_date: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(ItemSchema).min(1),
});

export const listPurchaseInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { supplier_id?: string; invoice_type?: "purchase" | "debit_note" } | undefined) => data ?? {},
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("purchase_invoices")
      .select("*, suppliers(name), purchase_payments(amount)")
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.supplier_id) q = q.eq("supplier_id", data.supplier_id);
    if (data.invoice_type) q = q.eq("invoice_type", data.invoice_type);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPurchaseInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: inv, error } = await context.supabase
      .from("purchase_invoices")
      .select("*, suppliers(*), purchase_invoice_items(*), purchase_payments(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("الفاتورة غير موجودة");
    return inv;
  });

export const createPurchaseInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreatePurchaseInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: sup, error: sErr } = await context.supabase
      .from("suppliers").select("id").eq("id", data.supplier_id).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sup) throw new Error("المورد غير موجود");

    const { data: numData, error: nErr } = await context.supabase.rpc(
      "generate_purchase_invoice_number", { p_type: data.invoice_type },
    );
    if (nErr) throw new Error(nErr.message);
    const invoiceNumber = numData as unknown as string;

    const { data: inv, error: iErr } = await context.supabase
      .from("purchase_invoices")
      .insert({
        owner_id: context.userId,
        supplier_id: data.supplier_id,
        invoice_number: invoiceNumber,
        invoice_type: data.invoice_type,
        invoice_date: data.invoice_date,
        payment_type: data.invoice_type === "purchase" ? data.payment_type : "cash",
        due_date: data.invoice_type === "purchase" && data.payment_type === "deferred_cash"
          ? data.due_date || null : null,
        notes: data.notes || null,
      })
      .select("*").single();
    if (iErr) throw new Error(iErr.message);

    const itemsPayload = data.items.map((it) => ({
      invoice_id: inv.id,
      item_name: it.item_name,
      sold_quantity: it.sold_quantity,
      bonus_quantity: it.bonus_quantity,
      unit_price: it.unit_price,
      discount_amount: it.discount_amount,
      unit: it.unit || null,
      batch_number: it.batch_number || null,
      expiry_date: it.expiry_date || null,
    }));
    const { error: itErr } = await context.supabase
      .from("purchase_invoice_items").insert(itemsPayload);
    if (itErr) {
      await context.supabase.from("purchase_invoices").delete().eq("id", inv.id);
      throw new Error(itErr.message);
    }

    // Auto-record full payment for cash purchase invoices
    if (data.invoice_type === "purchase" && data.payment_type === "cash") {
      const { data: refreshed } = await context.supabase
        .from("purchase_invoices").select("total").eq("id", inv.id).single();
      const total = Number(refreshed?.total ?? 0);
      if (total > 0) {
        await context.supabase.from("purchase_payments").insert({
          invoice_id: inv.id,
          owner_id: context.userId,
          amount: total,
          payment_date: data.invoice_date,
          method: "cash",
          notes: "صرف تلقائي — فاتورة شراء نقدية",
        });
      }
    }

    return { id: inv.id, invoice_number: invoiceNumber };
  });

export const deletePurchaseInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("purchase_invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const PurchasePaymentInput = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_date: z.string().min(1),
  method: z.string().max(50).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const addPurchasePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PurchasePaymentInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("purchase_payments")
      .insert({
        owner_id: context.userId,
        invoice_id: data.invoice_id,
        amount: data.amount,
        payment_date: data.payment_date,
        method: data.method || null,
        reference: data.reference || null,
        notes: data.notes || null,
      })
      .select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePurchasePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("purchase_payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });