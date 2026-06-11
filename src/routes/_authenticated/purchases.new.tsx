import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { listSuppliers } from "@/lib/suppliers/suppliers.functions";
import { createPurchaseInvoice } from "@/lib/purchases/purchases.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Check } from "lucide-react";
import { computeInvoiceTotals, computeLineTotal, formatMoney } from "@/lib/invoices/invoice-math";
import { toast } from "sonner";

type Row = {
  item_name: string;
  sold_quantity: string;
  bonus_quantity: string;
  unit_price: string;
  discount_amount: string;
  unit?: string | null;
};

const emptyRow = (): Row => ({
  item_name: "",
  sold_quantity: "1",
  bonus_quantity: "0",
  unit_price: "0",
  discount_amount: "0",
  unit: null,
});

const SearchSchema = z.object({ supplier: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/purchases/new")({
  head: () => ({ meta: [{ title: "فاتورة شراء جديدة" }] }),
  validateSearch: SearchSchema,
  component: NewPurchasePage,
});

function NewPurchasePage() {
  const navigate = useNavigate();
  const { supplier: preset } = Route.useSearch();
  const listFn = useServerFn(listSuppliers);
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", ""],
    queryFn: () => listFn({ data: {} }),
  });

  const [supplierId, setSupplierId] = useState<string>(preset ?? "");
  const [type, setType] = useState<"purchase" | "debit_note">("purchase");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [paymentType, setPaymentType] = useState<"cash" | "deferred_cash" | "credit">("cash");
  const [dueDate, setDueDate] = useState<string>("");

  const items = useMemo(
    () => rows.map((r) => ({
      item_name: r.item_name,
      sold_quantity: Number(r.sold_quantity) || 0,
      bonus_quantity: Number(r.bonus_quantity) || 0,
      unit_price: Number(r.unit_price) || 0,
      discount_amount: Number(r.discount_amount) || 0,
      unit: r.unit || null,
    })),
    [rows],
  );
  const totals = useMemo(() => computeInvoiceTotals(items), [items]);

  const createFn = useServerFn(createPurchaseInvoice);
  const m = useMutation({
    mutationFn: () => createFn({
      data: {
        supplier_id: supplierId,
        invoice_type: type,
        invoice_date: date,
        payment_type: paymentType,
        due_date: paymentType === "deferred_cash" ? dueDate || null : null,
        notes: notes || null,
        items: items.filter((it) => it.item_name.trim()),
      },
    }),
    onSuccess: (res) => {
      toast.success(`تم إنشاء الفاتورة ${res.invoice_number}`);
      navigate({ to: "/purchases/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const canSubmit = !!supplierId && !!date
    && items.some((it) => it.item_name.trim() && it.sold_quantity > 0)
    && (type !== "purchase" || paymentType !== "deferred_cash" || !!dueDate);

  return (
    <div className="max-w-3xl mx-auto pb-32">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">فاتورة شراء جديدة</h1>

      <Card className="mb-4"><CardContent className="pt-5 space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
          <button type="button" onClick={() => setType("purchase")}
            className={`py-2.5 rounded-md text-sm font-semibold ${type === "purchase" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>شراء</button>
          <button type="button" onClick={() => setType("debit_note")}
            className={`py-2.5 rounded-md text-sm font-semibold ${type === "debit_note" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>مردود مشتريات</button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>المورد *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="اختر موردًا…" /></SelectTrigger>
              <SelectContent>
                {(suppliers ?? []).map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>التاريخ</Label>
            <Input className="h-11" dir="ltr" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {type === "purchase" && (
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">نوع الدفع</Label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-muted rounded-lg">
              {(["cash", "deferred_cash", "credit"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setPaymentType(t)}
                  className={`py-2.5 rounded-md text-xs sm:text-sm font-semibold ${paymentType === t ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                  {t === "cash" ? "نقدي" : t === "deferred_cash" ? "نقدي مؤجل" : "آجل"}
                </button>
              ))}
            </div>
            {paymentType === "deferred_cash" && (
              <div className="space-y-1.5">
                <Label>تاريخ الاستحقاق *</Label>
                <Input className="h-11" dir="ltr" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            )}
          </div>
        )}
      </CardContent></Card>

      <div className="space-y-3">
        {rows.map((r, i) => {
          const lt = computeLineTotal({
            sold_quantity: Number(r.sold_quantity) || 0,
            unit_price: Number(r.unit_price) || 0,
            discount_amount: Number(r.discount_amount) || 0,
          });
          return (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground">صنف #{i + 1}</div>
                <Button variant="ghost" size="icon" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                  disabled={rows.length === 1} className="h-8 w-8 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">اسم الصنف</Label>
                <Input value={r.item_name} onChange={(e) => update(i, { item_name: e.target.value })} className="h-11" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">الكمية</Label>
                  <Input dir="ltr" type="number" min="0" step="1" value={r.sold_quantity}
                    onChange={(e) => update(i, { sold_quantity: e.target.value })} className="h-11 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">سعر الوحدة</Label>
                  <Input dir="ltr" type="number" min="0" step="0.01" value={r.unit_price}
                    onChange={(e) => update(i, { unit_price: e.target.value })} className="h-11 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">البونص</Label>
                  <Input dir="ltr" type="number" min="0" step="1" value={r.bonus_quantity}
                    onChange={(e) => update(i, { bonus_quantity: e.target.value })} className="h-11 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">الخصم</Label>
                  <Input dir="ltr" type="number" min="0" step="0.01" value={r.discount_amount}
                    onChange={(e) => update(i, { discount_amount: e.target.value })} className="h-11 font-mono" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">إجمالي السطر</span>
                <span className="text-lg font-bold font-mono">{formatMoney(lt)}</span>
              </div>
            </CardContent></Card>
          );
        })}
        <Button variant="outline" className="w-full h-12 border-dashed" onClick={() => setRows((r) => [...r, emptyRow()])}>
          <Plus className="h-4 w-4 ms-1" /> إضافة صنف آخر
        </Button>
      </div>

      <Card className="mt-4"><CardContent className="pt-5">
        <Label className="text-xs">ملاحظات</Label>
        <Textarea className="mt-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </CardContent></Card>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t shadow-lg">
        <div className="max-w-3xl mx-auto p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 mb-2 text-sm">
            <span className="text-muted-foreground">{items.filter((it) => it.item_name.trim()).length} صنف</span>
            <div className="text-end">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">الصافي</div>
              <div className="text-xl font-black font-mono">{formatMoney(totals.total)}</div>
            </div>
          </div>
          <Button size="lg" className="w-full h-12 text-base" disabled={!canSubmit || m.isPending} onClick={() => m.mutate()}>
            <Check className="h-5 w-5 ms-2" />
            {m.isPending ? "جاري الحفظ…" : "حفظ فاتورة الشراء"}
          </Button>
        </div>
      </div>
    </div>
  );
}