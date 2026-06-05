import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemInput = z.object({
  name: z.string().min(1).max(200),
  batch_number: z.string().max(100).optional().nullable(),
  expiry_date: z.string().optional().nullable(), // YYYY-MM-DD
  unit: z.string().max(50).optional().nullable(),
  unit_price: z.number().min(0),
});

export const listInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { search?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("inventory_items")
      .select("*")
      .order("name", { ascending: true })
      .limit(500);
    if (data.search?.trim()) q = q.ilike("name", `%${data.search.trim()}%`);
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
        batch_number: data.batch_number || null,
        expiry_date: data.expiry_date || null,
        unit: data.unit || "علبة",
        unit_price: data.unit_price,
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
        batch_number: rest.batch_number || null,
        expiry_date: rest.expiry_date || null,
        unit: rest.unit || "علبة",
        unit_price: rest.unit_price,
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