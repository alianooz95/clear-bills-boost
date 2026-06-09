import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomers } from "@/lib/customers/customers.functions";
import { listInvoices } from "@/lib/invoices/invoices.functions";
import { listInventory } from "@/lib/inventory/inventory.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/invoices/invoice-math";
import {
  Users,
  FileText,
  Package,
  TrendingUp,
  Plus,
  ArrowUpRight,
  AlertTriangle,
  Pill,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم — Oplus Pharma" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const customersFn = useServerFn(listCustomers);
  const invoicesFn = useServerFn(listInvoices);
  const inventoryFn = useServerFn(listInventory);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", ""],
    queryFn: () => customersFn({ data: { search: "" } }),
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", "all"],
    queryFn: () => invoicesFn({ data: {} }),
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => inventoryFn({ data: undefined }),
  });

  const sales = invoices.filter((i: any) => i.invoice_type === "sales");
  const totalRevenue = sales.reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
  const quotations = invoices.filter((i: any) => i.invoice_type === "quotation").length;
  const lowStock = inventory.filter((p: any) => Number(p.quantity ?? 0) <= Number(p.reorder_level ?? 0));
  const recent = invoices.slice(0, 6);

  const stats = [
    {
      label: "إجمالي المبيعات",
      value: formatMoney(totalRevenue),
      icon: TrendingUp,
      hint: `${sales.length} فاتورة بيع`,
      accent: "from-primary to-primary",
    },
    {
      label: "العملاء",
      value: String(customers.length),
      icon: Users,
      hint: "إجمالي العملاء المسجّلين",
      accent: "from-accent to-accent",
    },
    {
      label: "الفواتير",
      value: String(invoices.length),
      icon: FileText,
      hint: `${quotations} عرض سعر`,
      accent: "from-chart-3 to-chart-3",
    },
    {
      label: "المنتجات",
      value: String(inventory.length),
      icon: Pill,
      hint: `${lowStock.length} منخفض المخزون`,
      accent: "from-chart-4 to-chart-4",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-brand p-6 md:p-8 text-primary-foreground shadow-elegant">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -top-20 -end-20 h-64 w-64 rounded-full bg-accent blur-3xl" />
          <div className="absolute -bottom-24 -start-10 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/70 font-medium">Oplus Pharma</p>
            <h1 className="font-display text-2xl md:text-3xl font-bold mt-2">أهلاً بك في لوحة التحكم</h1>
            <p className="text-sm text-white/80 mt-1 max-w-md">
              تابع المبيعات، العملاء، والمخزون بنظرة واحدة احترافية.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/invoices/new"><Plus className="h-4 w-4 ms-1" /> فاتورة جديدة</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link to="/customers">العملاء <ArrowUpRight className="h-4 w-4 ms-1" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="relative overflow-hidden border-border/60 shadow-soft hover:shadow-elegant transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                  <p className="font-display text-2xl font-bold mt-2 tabular-nums">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{s.hint}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
              <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${s.accent}`} />
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Two-column: Recent invoices + Low stock */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/60 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-display text-base">أحدث الفواتير</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/invoices">عرض الكل <ArrowUpRight className="h-3.5 w-3.5 ms-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">لا توجد فواتير بعد.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {recent.map((inv: any) => (
                  <li key={inv.id}>
                    <Link
                      to="/invoices/$id"
                      params={{ id: inv.id }}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-secondary text-primary flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{inv.customers?.name || "—"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            #{inv.invoice_number} · {inv.invoice_date}
                          </p>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="font-mono text-sm font-semibold">{formatMoney(Number(inv.total ?? 0))}</p>
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          {inv.invoice_type === "sales" ? "بيع" : inv.invoice_type === "credit_note" ? "إشعار دائن" : "عرض سعر"}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> مخزون منخفض
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/inventory">المخزون</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">كل المنتجات بمخزون كافٍ ✓</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {lowStock.slice(0, 6).map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">حد الطلب: {p.reorder_level ?? 0}</p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="font-mono">{p.quantity ?? 0}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}