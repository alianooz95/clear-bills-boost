import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CustomerInput = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  tax_number: z.string().max(50).optional().nullable(),
});

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { search?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.search && data.search.trim()) {
      q = q.ilike("name", `%${data.search.trim()}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("العميل غير موجود");
    return row;
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CustomerInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customers")
      .insert({
        owner_id: context.userId,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        tax_number: data.tax_number || null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).merge(CustomerInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("customers")
      .update({
        name: rest.name,
        phone: rest.phone || null,
        email: rest.email || null,
        tax_number: rest.tax_number || null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getCustomerLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string }) =>
    z.object({ customerId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const [{ data: customer, error: cErr }, { data: invoices, error: iErr }] = await Promise.all([
      context.supabase.from("customers").select("*").eq("id", data.customerId).maybeSingle(),
      context.supabase
        .from("invoices")
        .select("id, invoice_number, invoice_type, invoice_date, total, created_at")
        .eq("customer_id", data.customerId)
        .order("invoice_date", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    if (cErr) throw new Error(cErr.message);
    if (iErr) throw new Error(iErr.message);
    if (!customer) throw new Error("العميل غير موجود");

    let running = 0;
    let totalSales = 0;
    let totalCredits = 0;
    const rows = (invoices ?? []).map((inv) => {
      const total = Number(inv.total);
      const debit = inv.invoice_type === "sales" ? total : 0;
      const credit = inv.invoice_type === "credit_note" ? total : 0;
      running += debit - credit;
      if (inv.invoice_type === "sales") totalSales += total;
      else totalCredits += total;
      return { ...inv, debit, credit, running_balance: running };
    });

    return {
      customer,
      rows,
      summary: {
        total_sales: totalSales,
        total_credits: totalCredits,
        balance: Number(customer.balance),
      },
    };
  });