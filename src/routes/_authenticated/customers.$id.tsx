import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerFullLedger } from "@/lib/customers/customers.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { Plus, Printer, Phone, Mail, Hash } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  head: () => ({ meta: [{ title: "كشف حساب العميل" }] }),
  component: CustomerDetail,
});

function statusOf(inv: { remaining: number; total: number; payment_type?: string | null; due_date?: string | null }) {
  if (inv.remaining <= 0.0001) return { label: "مدفوعة", cls: "bg-emerald-100 text-emerald-700" };
  if (inv.remaining < inv.total) return { label: "جزئية", cls: "bg-amber-100 text-amber-700" };
  if (inv.due_date && new Date(inv.due_date) < new Date()) return { label: "متأخرة", cls: "bg-rose-100 text-rose-700" };
  return { label: "غير مدفوعة", cls: "bg-slate-100 text-slate-700" };
}

function payTypeLabel(t?: string | null) {
  return t === "cash" ? "نقدي" : t === "deferred_cash" ? "نقدي مؤجل" : t === "credit" ? "آجل" : "—";
}

function CustomerDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getCustomerFullLedger);
  const { data, isLoading } = useQuery({
    queryKey: ["customer-full-ledger", id],
    queryFn: () => fn({ data: { customerId: id } }),
  });

  if (isLoading) return <div className="text-muted-foreground">جاري التحميل…</div>;
  if (!data) return null;

  const { customer, invoices, payments, statement, summary } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{customer.phone}</span></span>}
            {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /><span dir="ltr">{customer.email}</span></span>}
            {customer.tax_number && <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{customer.tax_number}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/customers/$id/statement" params={{ id: customer.id }}>
            <Button variant="outline"><Printer className="h-4 w-4 ms-1" /> طباعة كشف الحساب</Button>
          </Link>
          <Link to="/invoices/new" search={{ customer: customer.id }}>
            <Button><Plus className="h-4 w-4 ms-1" /> فاتورة جديدة</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="إجمالي المبيعات" value={summary.total_sales} />
        <SummaryCard label="إجمالي المدفوع" value={summary.total_paid} />
        <SummaryCard label="إشعارات دائنة" value={summary.total_credits} />
        <SummaryCard label="الرصيد الحالي" value={summary.balance} highlight />
      </div>

      <Tabs defaultValue="invoices" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="invoices">الفواتير ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">الدفعات ({payments.length})</TabsTrigger>
          <TabsTrigger value="statement">كشف الحساب</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الرقم</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الدفع</TableHead>
                    <TableHead>الاستحقاق</TableHead>
                    <TableHead className="text-end">الإجمالي</TableHead>
                    <TableHead className="text-end">المدفوع</TableHead>
                    <TableHead className="text-end">المتبقي</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد فواتير.</TableCell></TableRow>
                  ) : invoices.map((inv: any) => {
                    const st = statusOf(inv);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell dir="ltr" className="text-start">{inv.invoice_date}</TableCell>
                        <TableCell>
                          <Link to="/invoices/$id" params={{ id: inv.id }} className="text-primary hover:underline">
                            {inv.invoice_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={inv.invoice_type === "sales" ? "default" : "secondary"}>
                            {inv.invoice_type === "sales" ? "مبيعات" : inv.invoice_type === "credit_note" ? "إشعار دائن" : "عرض سعر"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{payTypeLabel(inv.payment_type)}</TableCell>
                        <TableCell dir="ltr" className="text-start text-xs">{inv.due_date || "—"}</TableCell>
                        <TableCell className="text-end font-mono">{formatMoney(inv.total)}</TableCell>
                        <TableCell className="text-end font-mono text-emerald-700">{formatMoney(inv.paid)}</TableCell>
                        <TableCell className="text-end font-mono font-semibold">{formatMoney(inv.remaining)}</TableCell>
                        <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الفاتورة</TableHead>
                    <TableHead>الطريقة</TableHead>
                    <TableHead>المرجع</TableHead>
                    <TableHead>ملاحظات</TableHead>
                    <TableHead className="text-end">المبلغ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد دفعات.</TableCell></TableRow>
                  ) : payments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell dir="ltr" className="text-start">{p.payment_date}</TableCell>
                      <TableCell>
                        <Link to="/invoices/$id" params={{ id: p.invoice_id }} className="text-primary hover:underline">
                          {p.invoices?.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{p.method || "—"}</TableCell>
                      <TableCell className="text-xs" dir="ltr">{p.reference || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.notes || "—"}</TableCell>
                      <TableCell className="text-end font-mono font-semibold text-emerald-700">{formatMoney(p.amount)}</TableCell>
                      <TableCell>
                        <Link to="/invoices/$id/receipt/$paymentId" params={{ id: p.invoice_id, paymentId: p.id }} className="text-xs text-primary hover:underline">إيصال</Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statement">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
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
                  ) : statement.map((r: any) => (
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
            </CardContent>
          </Card>
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
        <div className={"text-xl sm:text-2xl font-bold font-mono mt-1 " + (highlight ? "text-primary" : "")}>
          {formatMoney(value)}
        </div>
      </CardContent>
    </Card>
  );
}