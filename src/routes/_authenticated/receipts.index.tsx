import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomerReceipts, deleteCustomerReceipt } from "@/lib/receipts/receipts.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/receipts/")({
  head: () => ({ meta: [{ title: "سندات التحصيل" }] }),
  component: ReceiptsIndex,
});

function ReceiptsIndex() {
  const qc = useQueryClient();
  const fn = useServerFn(listCustomerReceipts);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["customer-receipts"],
    queryFn: () => fn({ data: {} }),
  });

  const delFn = useServerFn(deleteCustomerReceipt);
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم حذف السند"); qc.invalidateQueries({ queryKey: ["customer-receipts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">سندات التحصيل</h1>
        <Link to="/receipts/new"><Button><Plus className="h-4 w-4 ms-1" /> سند جديد</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>السندات</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>رقم السند</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>الطريقة</TableHead>
              <TableHead>المرجع</TableHead>
              <TableHead className="text-end">المبلغ</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">جاري التحميل…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">لا توجد سندات.</TableCell></TableRow>
              ) : rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.receipt_number}</TableCell>
                  <TableCell dir="ltr" className="text-start">{r.receipt_date}</TableCell>
                  <TableCell>{r.customers?.name}</TableCell>
                  <TableCell className="text-xs">{r.method || "—"}</TableCell>
                  <TableCell className="text-xs" dir="ltr">{r.reference || "—"}</TableCell>
                  <TableCell className="text-end font-mono font-semibold text-emerald-700">{formatMoney(r.amount)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link to="/receipts/$id" params={{ id: r.id }}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Printer className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => confirm("حذف السند؟ سيُعاد المبلغ لرصيد العميل.") && del.mutate(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}