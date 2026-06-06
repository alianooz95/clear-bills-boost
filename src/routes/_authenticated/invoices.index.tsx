import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listInvoices } from "@/lib/invoices/invoices.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({ meta: [{ title: "الفواتير" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const fn = useServerFn(listInvoices);
  const { data, isLoading } = useQuery({ queryKey: ["invoices"], queryFn: () => fn({ data: {} }) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">الفواتير</h1>
        <Link to="/invoices/new"><Button><Plus className="h-4 w-4 ms-1" /> فاتورة جديدة</Button></Link>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرقم</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead className="text-end">الإجمالي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">جاري التحميل…</TableCell></TableRow>
              ) : !data || data.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد فواتير بعد.</TableCell></TableRow>
              ) : data.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="text-primary hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </TableCell>
                  <TableCell dir="ltr" className="text-start">{inv.invoice_date}</TableCell>
                  <TableCell>{inv.customers?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={inv.invoice_type === "sales" ? "default" : inv.invoice_type === "quotation" ? "outline" : "secondary"}>
                      {inv.invoice_type === "sales" ? "مبيعات" : inv.invoice_type === "quotation" ? "عرض سعر" : "تعويضية"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end font-mono">{formatMoney(inv.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}