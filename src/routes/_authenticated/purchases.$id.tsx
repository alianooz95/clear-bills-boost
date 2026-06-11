import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getPurchaseInvoice, deletePurchaseInvoice,
  addPurchasePayment, deletePurchasePayment,
} from "@/lib/purchases/purchases.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { Trash2, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchases/$id")({
  head: () => ({ meta: [{ title: "فاتورة شراء" }] }),
  component: PurchaseDetail,
});

function PurchaseDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(getPurchaseInvoice);
  const { data, isLoading } = useQuery({
    queryKey: ["purchase-invoice", id],
    queryFn: () => fn({ data: { id } }),
  });

  const delFn = useServerFn(deletePurchaseInvoice);
  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الفاتورة");
      navigate({ to: "/purchases" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">جاري التحميل…</div>;
  if (!data) return null;

  const paid = (data.purchase_payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Number(data.total) - paid;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link to="/purchases"><Button variant="ghost" size="icon"><ArrowRight className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">{data.invoice_number}</h1>
            <p className="text-sm text-muted-foreground">
              <Badge variant={data.invoice_type === "purchase" ? "default" : "secondary"}>
                {data.invoice_type === "purchase" ? "شراء" : "مردود مشتريات"}
              </Badge>
              <span className="ms-2">المورد: <Link to="/suppliers/$id" params={{ id: data.supplier_id }} className="text-primary hover:underline">{data.suppliers?.name}</Link></span>
              <span className="ms-2" dir="ltr">{data.invoice_date}</span>
            </p>
          </div>
        </div>
        <Button variant="destructive" onClick={() => confirm("هل تريد حذف الفاتورة؟") && del.mutate()} disabled={del.isPending}>
          <Trash2 className="h-4 w-4 ms-1" /> حذف
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>البنود</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>الصنف</TableHead>
              <TableHead className="text-end">الكمية</TableHead>
              <TableHead className="text-end">بونص</TableHead>
              <TableHead className="text-end">سعر</TableHead>
              <TableHead className="text-end">خصم</TableHead>
              <TableHead className="text-end">الإجمالي</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data.purchase_invoice_items ?? []).map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.item_name}</TableCell>
                  <TableCell className="text-end font-mono">{it.sold_quantity}</TableCell>
                  <TableCell className="text-end font-mono">{it.bonus_quantity}</TableCell>
                  <TableCell className="text-end font-mono">{formatMoney(it.unit_price)}</TableCell>
                  <TableCell className="text-end font-mono">{formatMoney(it.discount_amount)}</TableCell>
                  <TableCell className="text-end font-mono font-semibold">{formatMoney(it.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="الإجمالي" value={data.total} />
        <Stat label="المدفوع" value={paid} color="text-emerald-700" />
        <Stat label="المتبقي" value={remaining} color="text-rose-700" />
        <Stat label="نوع الدفع" text={data.payment_type === "cash" ? "نقدي" : data.payment_type === "deferred_cash" ? "نقدي مؤجل" : "آجل"} />
      </div>

      <PaymentsSection invoiceId={id} payments={data.purchase_payments ?? []} remaining={remaining} onChange={() => qc.invalidateQueries({ queryKey: ["purchase-invoice", id] })} />
    </div>
  );
}

function Stat({ label, value, text, color }: { label: string; value?: number; text?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold mt-1 ${color || ""} ${value !== undefined ? "font-mono" : ""}`}>
          {value !== undefined ? formatMoney(value) : text}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentsSection({ invoiceId, payments, remaining, onChange }: { invoiceId: string; payments: any[]; remaining: number; onChange: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("نقدي");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const addFn = useServerFn(addPurchasePayment);
  const add = useMutation({
    mutationFn: () => addFn({ data: { invoice_id: invoiceId, amount: Number(amount), payment_date: date, method, reference: reference || null, notes: notes || null } }),
    onSuccess: () => {
      toast.success("تمت إضافة الدفعة");
      setAmount(""); setReference(""); setNotes("");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delFn = useServerFn(deletePurchasePayment);
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم حذف الدفعة"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>الدفعات للمورد</span>
          <span className="text-sm font-normal text-muted-foreground">المتبقي: <span className="font-mono font-semibold">{formatMoney(remaining)}</span></span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">المبلغ</Label>
            <Input dir="ltr" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">التاريخ</Label>
            <Input dir="ltr" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">الطريقة</Label>
            <Input value={method} onChange={(e) => setMethod(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">المرجع</Label>
            <Input dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ملاحظات</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button onClick={() => add.mutate()} disabled={!amount || Number(amount) <= 0 || add.isPending}>
          <Plus className="h-4 w-4 ms-1" /> إضافة دفعة
        </Button>

        <Table>
          <TableHeader><TableRow>
            <TableHead>التاريخ</TableHead>
            <TableHead>الطريقة</TableHead>
            <TableHead>المرجع</TableHead>
            <TableHead>ملاحظات</TableHead>
            <TableHead className="text-end">المبلغ</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">لا توجد دفعات.</TableCell></TableRow>
            ) : payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell dir="ltr" className="text-start">{p.payment_date}</TableCell>
                <TableCell className="text-xs">{p.method || "—"}</TableCell>
                <TableCell className="text-xs" dir="ltr">{p.reference || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.notes || "—"}</TableCell>
                <TableCell className="text-end font-mono font-semibold text-emerald-700">{formatMoney(p.amount)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => confirm("حذف الدفعة؟") && del.mutate(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}