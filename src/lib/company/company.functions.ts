import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CompanyInput = z.object({
  name: z.string().max(200).default(""),
  address: z.string().max(500).default(""),
  phone: z.string().max(100).default(""),
  logo_data_url: z.string().max(2_000_000).default(""), // ~2MB base64
});

export const getCompanySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("company_settings")
      .select("name,address,phone,logo_data_url")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { name: "", address: "", phone: "", logo_data_url: "" };
  });

export const upsertCompanySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CompanyInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("company_settings")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });