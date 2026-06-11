import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemInput = z.object({
  name: z.string().min(1).max(200), // trade name
  scientific_name: z.string().max(200).optional().nullable(),
  batch_number: z.string().max(100).optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  unit_price: z.number().min(0), // sell price
  cost_price: z.number().min(0).default(0),
  public_price: z.number().min(0).default(0),
  quantity: z.number().min(0).default(0),
  bonus_quantity: z.number().min(0).default(0),
  supplier_id: z.string().uuid().optional().nullable(),
  pharma_form: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  category: z.enum(["owned", "negotiation", "market"]).default("owned"),
});

export const listInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { search?: string; category?: "owned" | "negotiation" | "market" } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("inventory_items")
      .select("*, suppliers(name)")
      .order("name", { ascending: true })
      .limit(500);
    if (data.search?.trim()) q = q.ilike("name", `%${data.search.trim()}%`);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ItemInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("inventory_items")
      .insert({
        owner_id: context.userId,
        name: data.name,
        scientific_name: data.scientific_name || null,
        batch_number: data.batch_number || null,
        expiry_date: data.expiry_date || null,
        unit: data.unit || "علبة",
        unit_price: data.unit_price,
        cost_price: data.cost_price,
        public_price: data.public_price,
        quantity: data.quantity,
        bonus_quantity: data.bonus_quantity,
        supplier_id: data.supplier_id || null,
        pharma_form: data.pharma_form || null,
        country: data.country || null,
        category: data.category,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    ItemInput.extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("inventory_items")
      .update({
        name: rest.name,
        scientific_name: rest.scientific_name || null,
        batch_number: rest.batch_number || null,
        expiry_date: rest.expiry_date || null,
        unit: rest.unit || "علبة",
        unit_price: rest.unit_price,
        cost_price: rest.cost_price,
        public_price: rest.public_price,
        quantity: rest.quantity,
        bonus_quantity: rest.bonus_quantity,
        supplier_id: rest.supplier_id || null,
        pharma_form: rest.pharma_form || null,
        country: rest.country || null,
        category: rest.category,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("inventory_items")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ConvertInput = z.object({
  id: z.string().uuid(),
  unit_price: z.number().min(0),
  cost_price: z.number().min(0),
  quantity: z.number().min(0),
  bonus_quantity: z.number().min(0).default(0),
  batch_number: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  pharma_form: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
});

export const convertToOwned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ConvertInput.parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("inventory_items")
      .update({
        category: "owned",
        unit_price: rest.unit_price,
        cost_price: rest.cost_price,
        quantity: rest.quantity,
        bonus_quantity: rest.bonus_quantity,
        batch_number: rest.batch_number || null,
        expiry_date: rest.expiry_date || null,
        supplier_id: rest.supplier_id || null,
        pharma_form: rest.pharma_form || null,
        country: rest.country || null,
        unit: rest.unit || "علبة",
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });