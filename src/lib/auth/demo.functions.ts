import { createServerFn } from "@tanstack/react-start";

export const DEMO_EMAIL = "demo@invoices.app";
export const DEMO_PASSWORD = "Demo123456!";

export const ensureDemoUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Check if user already exists
  const { data: list } = await supabaseAdmin.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email === DEMO_EMAIL);

  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    user = data.user!;

    // Seed demo data for the new account
    const ownerId = user.id;
    const { data: customers, error: cErr } = await supabaseAdmin
      .from("customers")
      .insert([
        { owner_id: ownerId, name: "صيدلية النور", phone: "01000000001" },
        { owner_id: ownerId, name: "صيدلية الشفاء", phone: "01000000002" },
        { owner_id: ownerId, name: "صيدلية الحياة", phone: "01000000003" },
      ])
      .select("id");
    if (cErr) throw new Error(cErr.message);

    const c1 = customers![0].id;
    const c2 = customers![1].id;

    // Sales invoice 1
    const { data: inv1 } = await supabaseAdmin
      .from("invoices")
      .insert({
        owner_id: ownerId,
        customer_id: c1,
        invoice_type: "sales",
        invoice_number: `INV-DEMO-${Date.now()}-1`,
      })
      .select("id")
      .single();
    if (inv1) {
      await supabaseAdmin.from("invoice_items").insert([
        { invoice_id: inv1.id, item_name: "باراسيتامول 500", sold_quantity: 10, bonus_quantity: 1, unit_price: 25, discount_amount: 10 },
        { invoice_id: inv1.id, item_name: "فيتامين سي", sold_quantity: 5, bonus_quantity: 0, unit_price: 40, discount_amount: 0 },
      ]);
    }

    // Sales invoice 2
    const { data: inv2 } = await supabaseAdmin
      .from("invoices")
      .insert({
        owner_id: ownerId,
        customer_id: c2,
        invoice_type: "sales",
        invoice_number: `INV-DEMO-${Date.now()}-2`,
      })
      .select("id")
      .single();
    if (inv2) {
      await supabaseAdmin.from("invoice_items").insert([
        { invoice_id: inv2.id, item_name: "أموكسيسيلين", sold_quantity: 20, bonus_quantity: 2, unit_price: 35, discount_amount: 50 },
      ]);
    }

    // Credit note for customer 1
    const { data: cn } = await supabaseAdmin
      .from("invoices")
      .insert({
        owner_id: ownerId,
        customer_id: c1,
        invoice_type: "credit_note",
        invoice_number: `CN-DEMO-${Date.now()}`,
      })
      .select("id")
      .single();
    if (cn) {
      await supabaseAdmin.from("invoice_items").insert([
        { invoice_id: cn.id, item_name: "مرتجع باراسيتامول", sold_quantity: 2, bonus_quantity: 0, unit_price: 25, discount_amount: 0 },
      ]);
    }
  }

  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
});