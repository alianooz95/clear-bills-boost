import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  item_name: z.string().min(1).max(200),
  sold_quantity: z.number().min(0),
  bonus_quantity: z.number().min(0).default(0),
  unit_price: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
  inventory_item_id: z.string().uuid().optional().nullable(),
  batch_number: z.string().max(100).optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
});

const CreateInvoiceInput = z.object({
  customer_id: z.string().uuid(),
  invoice_type: z.enum(["sales", "credit_note", "quotation"]),
  invoice_date: z.string().min(1),
  notes: z.string().max(1000).optional().nullable(),
  payment_type: z.enum(["cash", "deferred_cash", "credit"]).default("cash"),
  due_date: z.string().optional().nullable(),
  items: z.array(ItemSchema).min(1),
});

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { customer_id?: string; invoice_type?: "sales" | "credit_note" | "quotation" } | undefined) =>
      data ?? {},
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("invoices")
      .select("*, customers(name)")
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.customer_id) q = q.eq("customer_id", data.customer_id);
    if (data.invoice_type) q = q.eq("invoice_type", data.invoice_type);
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
      .select("*, customers(*), invoice_items(*), invoice_payments(*)")
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
        payment_type: data.invoice_type === "sales" ? data.payment_type : "cash",
        due_date:
          data.invoice_type === "sales" && data.payment_type === "deferred_cash"
            ? data.due_date || null
            : null,
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
      inventory_item_id: it.inventory_item_id || null,
      batch_number: it.batch_number || null,
      expiry_date: it.expiry_date || null,
      unit: it.unit || null,
    }));

    const { error: itErr } = await context.supabase.from("invoice_items").insert(itemsPayload);
    if (itErr) {
      // Rollback the invoice if items failed
      await context.supabase.from("invoices").delete().eq("id", inv.id);
      throw new Error(itErr.message);
    }

    // Auto-record full payment for cash sales invoices
    if (data.invoice_type === "sales" && data.payment_type === "cash") {
      // Re-fetch invoice total (triggers compute it from items)
      const { data: refreshed } = await context.supabase
        .from("invoices")
        .select("total")
        .eq("id", inv.id)
        .single();
      const total = Number(refreshed?.total ?? 0);
      if (total > 0) {
        await context.supabase.from("invoice_payments").insert({
          invoice_id: inv.id,
          owner_id: context.userId,
          amount: total,
          payment_date: data.invoice_date,
          method: "cash",
          notes: "تحصيل تلقائي — فاتورة نقدية",
        });
      }
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

export const convertQuotationToInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: src, error } = await context.supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!src) throw new Error("الفاتورة غير موجودة");
    if (src.invoice_type !== "quotation") throw new Error("هذه ليست عرض سعر");

    const { data: numData, error: nErr } = await context.supabase.rpc("generate_invoice_number", {
      p_type: "sales",
    });
    if (nErr) throw new Error(nErr.message);
    const invoiceNumber = numData as unknown as string;

    const { data: inv, error: iErr } = await context.supabase
      .from("invoices")
      .insert({
        owner_id: context.userId,
        customer_id: src.customer_id,
        invoice_number: invoiceNumber,
        invoice_type: "sales",
        invoice_date: new Date().toISOString().slice(0, 10),
        notes: [src.notes, `محوّل من عرض السعر ${src.invoice_number}`]
          .filter(Boolean)
          .join(" — "),
      })
      .select("*")
      .single();
    if (iErr) throw new Error(iErr.message);

    const itemsPayload = (src.invoice_items ?? []).map((it: any) => ({
      invoice_id: inv.id,
      item_name: it.item_name,
      sold_quantity: it.sold_quantity,
      bonus_quantity: it.bonus_quantity,
      unit_price: it.unit_price,
      discount_amount: it.discount_amount,
      inventory_item_id: it.inventory_item_id,
      batch_number: it.batch_number,
      expiry_date: it.expiry_date,
      unit: it.unit,
    }));
    if (itemsPayload.length) {
      const { error: itErr } = await context.supabase.from("invoice_items").insert(itemsPayload);
      if (itErr) {
        await context.supabase.from("invoices").delete().eq("id", inv.id);
        throw new Error(itErr.message);
      }
    }
    return { id: inv.id, invoice_number: invoiceNumber };
  });