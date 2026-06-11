import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getReportsSummary } from "@/lib/reports/reports.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/invoices/invoice-math";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, AlertTriangle, Users, CalendarClock, Wallet, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "التقارير — Oplus Pharma" }] }),
  component: ReportsPage,
});

const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function ReportsPage() {
  const fn = useServerFn(getReportsSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: () => fn(),
  });

  const summary = useMemo(() => {
    if (!data) return null;
    const today = new Date();
    const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    // Monthly sales (last 12 months)
    const monthlyMap = new Map<string, { sales: number; credits: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(k, { sales: 0, credits: 0 });
    }
    let thisMonthSales = 0;
    let totalSales = 0;
    let totalCredits = 0;
    let salesCount = 0;
    for (const inv of data.invoices as any[]) {
      const k = inv.invoice_date?.slice(0, 7);
      if (!k) continue;
      const total = Number(inv.total ?? 0);
      if (inv.invoice_type === "sales") {
        totalSales += total;
        salesCount++;
        if (k === thisMonthKey) thisMonthSales += total;
        const m = monthlyMap.get(k);
        if (m) m.sales += total;
      } else if (inv.invoice_type === "credit_note") {
        totalCredits += total;
        const m = monthlyMap.get(k);
        if (m) m.credits += total;
      }
    }
    const monthly = Array.from(monthlyMap.entries()).map(([k, v]) => {
      const [y, m] = k.split("-");
      return { month: `${MONTH_AR[Number(m) - 1]} ${y.slice(2)}`, sales: v.sales, credits: v.credits };
    });

    // Outstanding debt + top debtors
    const debtors = (data.customers as any[])
      .map((c) => ({ ...c, balance: Number(c.balance ?? 0) }))
      .filter((c) => c.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    const totalDebt = debtors.reduce((s, c) => s + c.balance, 0);

    // Top customers by revenue (this period)
    const customerRevenue = new Map<string, { name: string; total: number }>();
    for (const inv of data.invoices as any[]) {
      if (inv.invoice_type !== "sales" || !inv.customer_id) continue;
      const cur = customerRevenue.get(inv.customer_id) ?? { name: inv.customers?.name ?? "—", total: 0 };
      cur.total += Number(inv.total ?? 0);
      customerRevenue.set(inv.customer_id, cur);
    }
    const topCustomers = Array.from(customerRevenue.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Payments this month
    let thisMonthPayments = 0;
    for (const p of data.payments as any[]) {
      if (p.payment_date?.slice(0, 7) === thisMonthKey) thisMonthPayments += Number(p.amount ?? 0);
    }

    // Expiry: next 90 days, expired, low stock
    const in90 = new Date(today.getTime() + 90 * 86400000);
    const expiring: any[] = [];
    const expired: any[] = [];
    const lowStock: any[] = [];
    for (const it of data.inventory as any[]) {
      if (it.category !== "owned") continue;
      if (it.expiry_date) {
        const ed = new Date(it.expiry_date);
        if (ed < today) expired.push(it);
        else if (ed <= in90) expiring.push(it);
      }
      if (Number(it.quantity ?? 0) <= 5) lowStock.push(it);
    }

    return {
      monthly, thisMonthSales, totalSales, totalCredits, salesCount,
      debtors, totalDebt, topCustomers, thisMonthPayments,
      expiring, expired, lowStock,
    };
  }, [data]);

  if (isLoading || !summary) {
    return <p className="text-center text-muted-foreground py-12">جاري تحميل التقارير…</p>;
  }

  const kpis = [
    { label: "مبيعات هذا الشهر", value: formatMoney(summary.thisMonthSales), icon: TrendingUp, color: "text-emerald-600 bg-emerald-500/10" },
    { label: "تحصيلات هذا الشهر", value: formatMoney(summary.thisMonthPayments), icon: Wallet, color: "text-blue-600 bg-blue-500/10" },
    { label: "إجمالي الديون المستحقة", value: formatMoney(summary.totalDebt), icon: AlertTriangle, color: "text-amber-600 bg-amber-500/10" },
    { label: "إجمالي المبيعات (12 شهر)", value: formatMoney(summary.totalSales), icon: FileText, color: "text-primary bg-primary/10" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">التقارير والإحصاءات</h1>
        <p className="text-sm text-muted-foreground mt-1">ملخص الأداء المالي وحالة المخزون.</p>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-border/60 shadow-soft">
            <CardContent className="p-5 flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
                <p className="font-display text-xl font-bold mt-2 tabular-nums">{k.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${k.color}`}>
                <k.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Sales chart */}
      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="font-display text-base">المبيعات الشهرية (آخر 12 شهر)</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={summary.monthly} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  formatter={(v: any) => formatMoney(Number(v))}
                  contentStyle={{ borderRadius: 8, fontSize: 12, direction: "rtl" }}
                />
                <Bar dataKey="sales" name="مبيعات" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="credits" name="تعويضات" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top debtors */}
        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-500" /> أكبر المدينين
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {summary.debtors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد ديون مستحقة ✓</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {summary.debtors.slice(0, 8).map((c: any) => (
                  <li key={c.id}>
                    <Link
                      to="/customers/$id"
                      params={{ id: c.id }}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40"
                    >
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <span className="font-mono text-sm font-semibold text-amber-700">{formatMoney(c.balance)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top customers by revenue */}
        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> أعلى العملاء مبيعاً
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {summary.topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد مبيعات بعد.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {summary.topCustomers.map((c: any, i: number) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-700 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium truncate">{c.name}</span>
                    </div>
                    <span className="font-mono text-sm font-semibold">{formatMoney(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Inventory alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" /> منتجات منتهية ({summary.expired.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-60 overflow-auto">
            {summary.expired.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">لا يوجد ✓</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {summary.expired.slice(0, 10).map((p: any) => (
                  <li key={p.id} className="px-4 py-2 flex justify-between text-xs">
                    <span className="truncate">{p.name}</span>
                    <span className="text-red-600 font-mono">{p.expiry_date}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm flex items-center gap-2 text-amber-700">
              <CalendarClock className="h-4 w-4" /> قارب على الانتهاء ({summary.expiring.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-60 overflow-auto">
            {summary.expiring.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">لا يوجد ✓</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {summary.expiring.slice(0, 10).map((p: any) => (
                  <li key={p.id} className="px-4 py-2 flex justify-between text-xs">
                    <span className="truncate">{p.name}</span>
                    <span className="text-amber-700 font-mono">{p.expiry_date}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm flex items-center gap-2 text-blue-700">
              <AlertTriangle className="h-4 w-4" /> مخزون منخفض (≤ 5) ({summary.lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-60 overflow-auto">
            {summary.lowStock.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">لا يوجد ✓</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {summary.lowStock.slice(0, 10).map((p: any) => (
                  <li key={p.id} className="px-4 py-2 flex justify-between text-xs">
                    <span className="truncate">{p.name}</span>
                    <Badge variant="outline" className="font-mono">{p.quantity} {p.unit || ""}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="text-center">
        <Button variant="outline" onClick={() => window.print()}>طباعة التقرير</Button>
      </div>
    </div>
  );
}