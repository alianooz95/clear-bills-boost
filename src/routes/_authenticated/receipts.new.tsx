import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCustomers } from "@/lib/customers/customers.functions";
import { createCustomerReceipt, listOpenInvoicesForCustomer } from "@/lib/receipts/receipts.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/receipts/new")({
  head: () => ({ meta: [{ title: "سند تحصيل جديد" }] }),
  component: NewReceipt,
});

function NewReceipt() {
  const navigate = useNavigate();
  const listFn = useServerFn(listCustomers);
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => listFn({ data: {} }) });

  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("نقدي");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const selected = customers.find((c: any) => c.id === customerId);

  const openFn = useServerFn(listOpenInvoicesForCustomer);
  const { data: openInvoices = [] } = useQuery({
    queryKey: ["open-invoices", customerId],
    queryFn: () => openFn({ data: { customer_id: customerId } }),
    enabled: !!customerId,
  });

  const allocList = Object.entries(allocations)
    .map(([invoice_id, v]) => ({ invoice_id, amount: Number(v) }))
    .filter((a) => a.amount > 0);
  const allocTotal = allocList.reduce((s, a) => s + a.amount, 0);
  const remaining = Number(amount || 0) - allocTotal;

  const createFn = useServerFn(createCustomerReceipt);
  const create = useMutation({
    mutationFn: () => createFn({ data: {
      customer_id: customerId, amount: Number(amount), receipt_date: date,
      method, reference: reference || null, notes: notes || null,
      allocations: allocList,
    } }),
    onSuccess: (row: any) => {
      toast.success(`تم إنشاء السند ${row.receipt_number}`);
      navigate({ to: "/receipts/$id", params: { id: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = customerId && Number(amount) > 0 && date && allocTotal <= Number(amount) + 0.001;

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">سند تحصيل جديد</h1>
      <Card>
        <CardHeader><CardTitle>بيانات السند</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>العميل</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="اختر عميلاً" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {Number(c.balance) !== 0 && <span className="text-xs text-muted-foreground ms-2">({formatMoney(c.balance)})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && (
                <p className="text-xs text-muted-foreground">الرصيد الحالي: <span className="font-mono font-semibold">{formatMoney(selected.balance)}</span></p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input dir="ltr" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ</Label>
              <Input dir="ltr" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>الطريقة</Label>
              <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="نقدي / تحويل / شيك" />
            </div>
            <div className="space-y-1.5">
              <Label>المرجع</Label>
              <Input dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="رقم الشيك / التحويل" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          {selected && Number(amount) > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              الرصيد بعد التحصيل: <span className="font-mono font-semibold">{formatMoney(Number(selected.balance) - Number(amount))}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {customerId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>توزيع المبلغ على الفواتير (اختياري)</span>
              <span className="text-sm font-normal text-muted-foreground">
                موزّع: <span className="font-mono font-semibold">{formatMoney(allocTotal)}</span> — على الحساب: <span className="font-mono font-semibold">{formatMoney(Math.max(0, remaining))}</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>الفاتورة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>نوع</TableHead>
                <TableHead className="text-end">الإجمالي</TableHead>
                <TableHead className="text-end">المتبقي</TableHead>
                <TableHead className="text-end w-40">مبلغ التوزيع</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {openInvoices.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">لا توجد فواتير مفتوحة لهذا العميل.</TableCell></TableRow>
                ) : openInvoices.map((inv: any) => {
                  const checked = !!allocations[inv.id];
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Checkbox checked={checked} onCheckedChange={(c) => {
                          setAllocations((prev) => {
                            const next = { ...prev };
                            if (c) next[inv.id] = String(Math.min(inv.remaining, Math.max(0, Number(amount || 0) - (allocTotal - (Number(prev[inv.id]) || 0)))));
                            else delete next[inv.id];
                            return next;
                          });
                        }} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                      <TableCell dir="ltr" className="text-start text-xs">{inv.invoice_date}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{inv.payment_type === "credit" ? "آجل" : "نقدي مؤجل"}</Badge></TableCell>
                      <TableCell className="text-end font-mono">{formatMoney(inv.total)}</TableCell>
                      <TableCell className="text-end font-mono text-rose-700">{formatMoney(inv.remaining)}</TableCell>
                      <TableCell>
                        <Input dir="ltr" type="number" min="0" step="0.01" max={inv.remaining}
                          disabled={!checked}
                          className="font-mono h-8 text-end"
                          value={allocations[inv.id] ?? ""}
                          onChange={(e) => setAllocations((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {remaining < -0.001 && (
              <div className="p-3 text-sm text-destructive">مجموع التوزيع أكبر من مبلغ السند.</div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>حفظ السند</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/receipts" })}>إلغاء</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}