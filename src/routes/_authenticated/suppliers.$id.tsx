import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSupplierLedger } from "@/lib/suppliers/suppliers.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { Plus, Phone, Mail, Hash } from "lucide-react";

export const Route = createFileRoute("/_authenticated/suppliers/$id")({
  head: () => ({ meta: [{ title: "كشف حساب المورد" }] }),
  component: SupplierDetail,
});

function statusOf(inv: { remaining: number; total: number }) {
  if (inv.remaining <= 0.0001) return { label: "مدفوعة", cls: "bg-emerald-100 text-emerald-700" };
  if (inv.remaining < inv.total) return { label: "جزئية", cls: "bg-amber-100 text-amber-700" };
  return { label: "غير مدفوعة", cls: "bg-slate-100 text-slate-700" };
}

function SupplierDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getSupplierLedger);
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-ledger", id],
    queryFn: () => fn({ data: { supplierId: id } }),
  });

  if (isLoading) return <div className="text-muted-foreground">جاري التحميل…</div>;
  if (!data) return null;
  const { supplier, invoices, payments, summary } = data;

  // Build statement
  type E = { key: string; date: string; ref: string; desc: string; debit: number; credit: number };
  const events: E[] = [];
  for (const inv of invoices) {
    events.push({
      key: "i-" + inv.id,
      date: inv.invoice_date,
      ref: inv.invoice_number,
      desc: inv.invoice_type === "purchase" ? "فاتورة شراء" : "مردود مشتريات",
      debit: inv.invoice_type === "purchase" ? Number(inv.total) : 0,
      credit: inv.invoice_type === "debit_note" ? Number(inv.total) : 0,
    });
  }
  for (const p of payments as any[]) {
    events.push({
      key: "p-" + p.id,
      date: p.payment_date,
      ref: p.purchase_invoices?.invoice_number ?? "",
      desc: "صرف للمورد" + (p.reference ? ` — ${p.reference}` : ""),
      debit: 0,
      credit: Number(p.amount),
    });
  }
  events.sort((a, b) => a.date === b.date ? a.key.localeCompare(b.key) : a.date.localeCompare(b.date));
  let run = 0;
  const statement = events.map((e) => { run += e.debit - e.credit; return { ...e, running: run }; });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{supplier.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            {supplier.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{supplier.phone}</span></span>}
            {supplier.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /><span dir="ltr">{supplier.email}</span></span>}
            {supplier.tax_number && <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{supplier.tax_number}</span>}
          </div>
        </div>
        <Link to="/purchases/new" search={{ supplier: supplier.id }}>
          <Button><Plus className="h-4 w-4 ms-1" /> فاتورة شراء</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="إجمالي المشتريات" value={summary.total_purchases} />
        <SummaryCard label="المدفوع للمورد" value={summary.total_paid} />
        <SummaryCard label="مردود مشتريات" value={summary.total_debits} />
        <SummaryCard label="الرصيد المستحق" value={summary.balance} highlight />
      </div>

      <Tabs defaultValue="invoices">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="invoices">الفواتير ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">الدفعات ({payments.length})</TabsTrigger>
          <TabsTrigger value="statement">كشف الحساب</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الرقم</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الدفع</TableHead>
                  <TableHead className="text-end">الإجمالي</TableHead>
                  <TableHead className="text-end">المدفوع</TableHead>
                  <TableHead className="text-end">المتبقي</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد فواتير شراء.</TableCell></TableRow>
                ) : invoices.map((inv: any) => {
                  const st = statusOf(inv);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell dir="ltr" className="text-start">{inv.invoice_date}</TableCell>
                      <TableCell>
                        <Link to="/purchases/$id" params={{ id: inv.id }} className="text-primary hover:underline">{inv.invoice_number}</Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={inv.invoice_type === "purchase" ? "default" : "secondary"}>
                          {inv.invoice_type === "purchase" ? "شراء" : "مردود"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{inv.payment_type === "cash" ? "نقدي" : inv.payment_type === "deferred_cash" ? "نقدي مؤجل" : "آجل"}</TableCell>
                      <TableCell className="text-end font-mono">{formatMoney(inv.total)}</TableCell>
                      <TableCell className="text-end font-mono text-emerald-700">{formatMoney(inv.paid)}</TableCell>
                      <TableCell className="text-end font-mono font-semibold">{formatMoney(inv.remaining)}</TableCell>
                      <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الفاتورة</TableHead>
                  <TableHead>الطريقة</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>ملاحظات</TableHead>
                  <TableHead className="text-end">المبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد دفعات.</TableCell></TableRow>
                ) : (payments as any[]).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell dir="ltr" className="text-start">{p.payment_date}</TableCell>
                    <TableCell>
                      <Link to="/purchases/$id" params={{ id: p.invoice_id }} className="text-primary hover:underline">{p.purchase_invoices?.invoice_number}</Link>
                    </TableCell>
                    <TableCell className="text-xs">{p.method || "—"}</TableCell>
                    <TableCell className="text-xs" dir="ltr">{p.reference || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.notes || "—"}</TableCell>
                    <TableCell className="text-end font-mono font-semibold text-emerald-700">{formatMoney(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="statement">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>البيان</TableHead>
                  <TableHead className="text-end">مدين</TableHead>
                  <TableHead className="text-end">دائن</TableHead>
                  <TableHead className="text-end">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد حركات.</TableCell></TableRow>
                ) : statement.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell dir="ltr" className="text-start">{r.date}</TableCell>
                    <TableCell className="text-xs">{r.ref}</TableCell>
                    <TableCell className="text-xs">{r.desc}</TableCell>
                    <TableCell className="text-end font-mono">{r.debit ? formatMoney(r.debit) : "—"}</TableCell>
                    <TableCell className="text-end font-mono text-emerald-700">{r.credit ? formatMoney(r.credit) : "—"}</TableCell>
                    <TableCell className="text-end font-mono font-semibold">{formatMoney(r.running)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary" : ""}>
      <CardContent className="pt-5 pb-5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={"text-xl sm:text-2xl font-bold font-mono mt-1 " + (highlight ? "text-primary" : "")}>{formatMoney(value)}</div>
      </CardContent>
    </Card>
  );
}