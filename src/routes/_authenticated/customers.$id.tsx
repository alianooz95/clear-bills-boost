import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerLedger } from "@/lib/customers/customers.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  head: () => ({ meta: [{ title: "كشف حساب العميل" }] }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getCustomerLedger);
  const { data, isLoading } = useQuery({
    queryKey: ["ledger", id],
    queryFn: () => fn({ data: { customerId: id } }),
  });

  if (isLoading) return <div className="text-muted-foreground">جاري التحميل…</div>;
  if (!data) return null;

  const { customer, rows, summary } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {customer.phone && <span dir="ltr">{customer.phone}</span>}
            {customer.email && <span className="ms-3" dir="ltr">{customer.email}</span>}
            {customer.tax_number && <span className="ms-3">رقم ضريبي: {customer.tax_number}</span>}
          </p>
        </div>
        <Link to="/invoices/new" search={{ customer: customer.id }}>
          <Button><Plus className="h-4 w-4 ms-1" /> فاتورة جديدة</Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <SummaryCard label="إجمالي المبيعات" value={summary.total_sales} />
        <SummaryCard label="إجمالي التعويضات" value={summary.total_credits} />
        <SummaryCard label="الرصيد الحالي" value={summary.balance} highlight />
      </div>

      <Card>
        <CardHeader><CardTitle>كشف الحساب</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الرقم</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead className="text-end">مدين</TableHead>
                <TableHead className="text-end">دائن</TableHead>
                <TableHead className="text-end">الرصيد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد حركات بعد.</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell dir="ltr" className="text-start">{r.invoice_date}</TableCell>
                  <TableCell>
                    <Link to="/invoices/$id" params={{ id: r.id }} className="text-primary hover:underline">
                      {r.invoice_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.invoice_type === "sales" ? "default" : "secondary"}>
                      {r.invoice_type === "sales" ? "مبيعات" : "تعويضية"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end font-mono">{r.debit ? formatMoney(r.debit) : "—"}</TableCell>
                  <TableCell className="text-end font-mono">{r.credit ? formatMoney(r.credit) : "—"}</TableCell>
                  <TableCell className="text-end font-mono font-semibold">{formatMoney(r.running_balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary" : ""}>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={"text-2xl font-bold font-mono mt-1 " + (highlight ? "text-primary" : "")}>
          {formatMoney(value)}
        </div>
      </CardContent>
    </Card>
  );
}