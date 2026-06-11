import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getReportsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Fetch all invoices for the user (last 12 months window for trends)
    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);
    const sinceStr = since.toISOString().slice(0, 10);

    const [{ data: invoices }, { data: customers }, { data: inventory }, { data: payments }] = await Promise.all([
      supabase
        .from("invoices")
        .select("id,invoice_number,invoice_date,invoice_type,total,customer_id,customers(name)")
        .eq("owner_id", userId)
        .gte("invoice_date", sinceStr),
      supabase
        .from("customers")
        .select("id,name,balance")
        .eq("owner_id", userId),
      supabase
        .from("inventory_items")
        .select("id,name,quantity,expiry_date,unit,category")
        .eq("owner_id", userId),
      supabase
        .from("invoice_payments")
        .select("amount,payment_date")
        .eq("owner_id", userId)
        .gte("payment_date", sinceStr),
    ]);

    return {
      invoices: invoices ?? [],
      customers: customers ?? [],
      inventory: inventory ?? [],
      payments: payments ?? [],
    };
  });