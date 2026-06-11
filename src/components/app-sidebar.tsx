import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, FileText, Package, Plus, LogOut, Pill, Truck, ShoppingCart, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import logoAsset from "@/assets/oplus-logo.png.asset.json";
const logo = (logoAsset as { url: string }).url;

const mainItems = [
  { title: "لوحة التحكم", url: "/dashboard", icon: LayoutDashboard },
  { title: "العملاء", url: "/customers", icon: Users },
  { title: "الفواتير", url: "/invoices", icon: FileText },
  { title: "الموردون", url: "/suppliers", icon: Truck },
  { title: "فواتير الشراء", url: "/purchases", icon: ShoppingCart },
  { title: "سندات التحصيل", url: "/receipts", icon: Receipt },
  { title: "المخزون", url: "/inventory", icon: Package },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) =>
    currentPath === p || currentPath.startsWith(p + "/");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <Sidebar collapsible="icon" side="right" className="border-l">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-white/95 p-1 shadow-soft flex items-center justify-center">
            <img src={logo} alt="Oplus Pharma" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-base font-bold text-sidebar-foreground">Oplus Pharma</span>
              <span className="text-[10px] text-sidebar-foreground/60">Better Health. Better Life.</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>القائمة الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>إجراءات سريعة</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="فاتورة جديدة">
                  <Link to="/invoices/new" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>فاتورة جديدة</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="إضافة منتج">
                  <Link to="/inventory" className="flex items-center gap-2">
                    <Pill className="h-4 w-4" />
                    <span>المنتجات الدوائية</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="تسجيل الخروج">
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}