import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/init-owner")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const email = "alianooz@oplus.app";
        const password = "Aa040695";
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, userId: data.user?.id }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});