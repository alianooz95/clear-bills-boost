import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const TITLES: Record<string, string> = {
  "/dashboard": "لوحة التحكم",
  "/customers": "العملاء",
  "/invoices": "الفواتير",
  "/invoices/new": "فاتورة جديدة",
  "/inventory": "المخزون",
};

function AuthedLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const title =
    TITLES[path] ??
    Object.entries(TITLES).find(([k]) => path.startsWith(k))?.[1] ??
    "";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-soft">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-background/70 backdrop-blur-xl sticky top-0 z-20 px-4 print:hidden">
            <SidebarTrigger className="-ms-1" />
            <div className="h-5 w-px bg-border" />
            <h2 className="font-display text-sm font-semibold text-foreground/80">{title}</h2>
            <div className="ms-auto flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                متصل
              </span>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 print:p-0 print:m-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}