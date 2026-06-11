import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPurchaseInvoices } from "@/lib/purchases/purchases.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { formatMoney } from "@/lib/invoices/invoice-math";

export const Route = createFileRoute("/_authenticated/purchases/")({
  head: () => ({ meta: [{ title: "فواتير الشراء" }] }),
  component: PurchasesPage,
});

function PurchasesPage() {
  const fn = useServerFn(listPurchaseInvoices);
  const { data, isLoading } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: () => fn({ data: {} }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">فواتير الشراء</h1>
        <Link to="/purchases/new">
          <Button><Plus className="h-4 w-4 ms-1" /> فاتورة شراء جديدة</Button>
        </Link>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الرقم</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الدفع</TableHead>
                <TableHead className="text-end">الإجمالي</TableHead>
                <TableHead className="text-end">المدفوع</TableHead>
                <TableHead className="text-end">المتبقي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">جاري التحميل…</TableCell></TableRow>
              ) : !data || data.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد فواتير شراء بعد.</TableCell></TableRow>
              ) : data.map((inv: any) => {
                const paid = (inv.purchase_payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
                const remaining = Number(inv.total) - paid;
                return (
                  <TableRow key={inv.id}>
                    <TableCell dir="ltr" className="text-start">{inv.invoice_date}</TableCell>
                    <TableCell>
                      <Link to="/purchases/$id" params={{ id: inv.id }} className="text-primary hover:underline">{inv.invoice_number}</Link>
                    </TableCell>
                    <TableCell>{inv.suppliers?.name}</TableCell>
                    <TableCell>
                      <Badge variant={inv.invoice_type === "purchase" ? "default" : "secondary"}>
                        {inv.invoice_type === "purchase" ? "شراء" : "مردود"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{inv.payment_type === "cash" ? "نقدي" : inv.payment_type === "deferred_cash" ? "نقدي مؤجل" : "آجل"}</TableCell>
                    <TableCell className="text-end font-mono">{formatMoney(inv.total)}</TableCell>
                    <TableCell className="text-end font-mono text-emerald-700">{formatMoney(paid)}</TableCell>
                    <TableCell className="text-end font-mono font-semibold">{formatMoney(remaining)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}