import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { listCustomers } from "@/lib/customers/customers.functions";
import { createInvoice } from "@/lib/invoices/invoices.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { computeInvoiceTotals, computeLineTotal, formatMoney } from "@/lib/invoices/invoice-math";
import { toast } from "sonner";

type Row = {
  item_name: string;
  sold_quantity: string;
  bonus_quantity: string;
  unit_price: string;
  discount_amount: string;
};

const emptyRow = (): Row => ({
  item_name: "",
  sold_quantity: "1",
  bonus_quantity: "0",
  unit_price: "0",
  discount_amount: "0",
});

const SearchSchema = z.object({ customer: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/invoices/new")({
  head: () => ({ meta: [{ title: "فاتورة جديدة" }] }),
  validateSearch: SearchSchema,
  component: NewInvoicePage,
});

function NewInvoicePage() {
  const navigate = useNavigate();
  const { customer: presetCustomer } = Route.useSearch();
  const listFn = useServerFn(listCustomers);
  const { data: customers } = useQuery({
    queryKey: ["customers", ""],
    queryFn: () => listFn({ data: {} }),
  });

  const [customerId, setCustomerId] = useState<string>(presetCustomer ?? "");
  const [type, setType] = useState<"sales" | "credit_note">("sales");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const items = useMemo(
    () =>
      rows.map((r) => ({
        item_name: r.item_name,
        sold_quantity: Number(r.sold_quantity) || 0,
        bonus_quantity: Number(r.bonus_quantity) || 0,
        unit_price: Number(r.unit_price) || 0,
        discount_amount: Number(r.discount_amount) || 0,
      })),
    [rows],
  );
  const totals = useMemo(() => computeInvoiceTotals(items), [items]);

  const createFn = useServerFn(createInvoice);
  const m = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          customer_id: customerId,
          invoice_type: type,
          invoice_date: date,
          notes: notes || null,
          items: items.filter((it) => it.item_name.trim()),
        },
      }),
    onSuccess: (res) => {
      toast.success(`تم إنشاء الفاتورة ${res.invoice_number}`);
      navigate({ to: "/invoices/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const canSubmit =
    !!customerId &&
    !!date &&
    items.some((it) => it.item_name.trim() && it.sold_quantity > 0 && it.unit_price >= 0);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">فاتورة جديدة</h1>

      <Card>
        <CardContent className="pt-6 grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>نوع الفاتورة</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">فاتورة مبيعات</SelectItem>
                <SelectItem value="credit_note">فاتورة تعويضية</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>العميل *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="اختر عميلًا…" /></SelectTrigger>
              <SelectContent>
                {(customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>التاريخ *</Label>
            <Input dir="ltr" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>الأصناف</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setRows((r) => [...r, emptyRow()])}>
            <Plus className="h-4 w-4 ms-1" /> سطر
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الصنف</TableHead>
                <TableHead className="w-24">الكمية</TableHead>
                <TableHead className="w-24">البونص</TableHead>
                <TableHead className="w-28">سعر الوحدة</TableHead>
                <TableHead className="w-28">الخصم</TableHead>
                <TableHead className="w-28 text-end">الإجمالي</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const lt = computeLineTotal({
                  sold_quantity: Number(r.sold_quantity) || 0,
                  unit_price: Number(r.unit_price) || 0,
                  discount_amount: Number(r.discount_amount) || 0,
                });
                return (
                  <TableRow key={i}>
                    <TableCell><Input value={r.item_name} onChange={(e) => updateRow(i, { item_name: e.target.value })} /></TableCell>
                    <TableCell><Input dir="ltr" type="number" min="0" step="0.001" value={r.sold_quantity} onChange={(e) => updateRow(i, { sold_quantity: e.target.value })} /></TableCell>
                    <TableCell><Input dir="ltr" type="number" min="0" step="0.001" value={r.bonus_quantity} onChange={(e) => updateRow(i, { bonus_quantity: e.target.value })} /></TableCell>
                    <TableCell><Input dir="ltr" type="number" min="0" step="0.01" value={r.unit_price} onChange={(e) => updateRow(i, { unit_price: e.target.value })} /></TableCell>
                    <TableCell><Input dir="ltr" type="number" min="0" step="0.01" value={r.discount_amount} onChange={(e) => updateRow(i, { discount_amount: e.target.value })} /></TableCell>
                    <TableCell className="text-end font-mono">{formatMoney(lt)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} disabled={rows.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t">
            <Totals label="المجموع" value={totals.subtotal} />
            <Totals label="الخصم" value={totals.discount_total} />
            <Totals label="الصافي" value={totals.total} highlight />
          </div>
          <p className="text-xs text-muted-foreground">
            ملاحظة: كمية البونص لا تُحتسب ماليًا — تكلفتها على العميل = 0، وتُسجَّل فقط للظهور بالفاتورة وخصم المخزون.
          </p>
          <div className="flex justify-end">
            <Button size="lg" disabled={!canSubmit || m.isPending} onClick={() => m.mutate()}>
              {m.isPending ? "جاري الحفظ…" : "حفظ الفاتورة"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Totals({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={"rounded-lg border p-3 " + (highlight ? "border-primary bg-primary/5" : "")}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={"text-xl font-bold font-mono " + (highlight ? "text-primary" : "")}>{formatMoney(value)}</div>
    </div>
  );
}