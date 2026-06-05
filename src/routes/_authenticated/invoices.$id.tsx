import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getInvoice, deleteInvoice } from "@/lib/invoices/invoices.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({ meta: [{ title: "تفاصيل الفاتورة" }] }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(getInvoice);
  const delFn = useServerFn(deleteInvoice);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => fn({ data: { id } }),
  });

  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الفاتورة");
      qc.invalidateQueries();
      navigate({ to: "/invoices" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">جاري التحميل…</div>;
  if (!data) return null;

  const inv: any = data;

  return (
    <div className="space-y-4 max-w-4xl mx-auto print:max-w-full">
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 className="text-2xl font-bold">{inv.invoice_number}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 ms-1" /> طباعة
          </Button>
          <Button variant="destructive" onClick={() => {
            if (confirm("هل أنت متأكد من حذف هذه الفاتورة؟ سيتم عكس أثرها على رصيد العميل.")) del.mutate();
          }}>
            <Trash2 className="h-4 w-4 ms-1" /> حذف
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <div className="text-sm text-muted-foreground">العميل</div>
              <Link to="/customers/$id" params={{ id: inv.customer_id }} className="text-lg font-semibold text-primary hover:underline">
                {inv.customers?.name}
              </Link>
              {inv.customers?.tax_number && (
                <div className="text-sm text-muted-foreground">رقم ضريبي: {inv.customers.tax_number}</div>
              )}
            </div>
            <div className="text-end">
              <Badge variant={inv.invoice_type === "sales" ? "default" : "secondary"} className="text-sm">
                {inv.invoice_type === "sales" ? "فاتورة مبيعات" : "فاتورة تعويضية"}
              </Badge>
              <div className="text-sm text-muted-foreground mt-1" dir="ltr">{inv.invoice_date}</div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الصنف</TableHead>
                <TableHead className="text-end">الكمية</TableHead>
                <TableHead className="text-end">البونص</TableHead>
                <TableHead className="text-end">سعر الوحدة</TableHead>
                <TableHead className="text-end">الخصم</TableHead>
                <TableHead className="text-end">الإجمالي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(inv.invoice_items ?? []).map((it: any) => (
                <TableRow key={it.id}>
                  <TableCell>{it.item_name}</TableCell>
                  <TableCell className="text-end font-mono">{it.sold_quantity}</TableCell>
                  <TableCell className="text-end font-mono">{Number(it.bonus_quantity) > 0 ? it.bonus_quantity : "—"}</TableCell>
                  <TableCell className="text-end font-mono">{formatMoney(it.unit_price)}</TableCell>
                  <TableCell className="text-end font-mono">{formatMoney(it.discount_amount)}</TableCell>
                  <TableCell className="text-end font-mono">{formatMoney(it.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end">
            <div className="w-full sm:w-72 space-y-1 text-sm">
              <Row label="المجموع" value={inv.subtotal} />
              <Row label="الخصم" value={inv.discount_total} />
              <div className="border-t pt-2">
                <Row label="الصافي" value={inv.total} bold />
              </div>
            </div>
          </div>

          {inv.notes && (
            <div className="border-t pt-3">
              <div className="text-sm text-muted-foreground">ملاحظات</div>
              <div className="text-sm whitespace-pre-wrap">{inv.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number | string; bold?: boolean }) {
  return (
    <div className={"flex justify-between " + (bold ? "text-base font-bold" : "")}>
      <span>{label}</span>
      <span className="font-mono">{formatMoney(value as any)}</span>
    </div>
  );
}