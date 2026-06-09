import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { listCustomers } from "@/lib/customers/customers.functions";
import { createInvoice } from "@/lib/invoices/invoices.functions";
import { listInventory } from "@/lib/inventory/inventory.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Trash2, Plus, Minus, ChevronDown, ChevronUp, Check, Package, ChevronsUpDown } from "lucide-react";
import { computeInvoiceTotals, computeLineTotal, formatMoney } from "@/lib/invoices/invoice-math";
import { toast } from "sonner";

type Row = {
  item_name: string;
  sold_quantity: string;
  bonus_quantity: string;
  unit_price: string;
  discount_amount: string;
  inventory_item_id?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  unit?: string | null;
};

const emptyRow = (): Row => ({
  item_name: "",
  sold_quantity: "1",
  bonus_quantity: "0",
  unit_price: "0",
  discount_amount: "0",
  inventory_item_id: null,
  batch_number: null,
  expiry_date: null,
  unit: null,
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
  const [type, setType] = useState<"sales" | "credit_note" | "quotation">("sales");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [paymentType, setPaymentType] = useState<"cash" | "deferred_cash" | "credit">("cash");
  const [dueDate, setDueDate] = useState<string>("");

  const items = useMemo(
    () =>
      rows.map((r) => ({
        item_name: r.item_name,
        sold_quantity: Number(r.sold_quantity) || 0,
        bonus_quantity: Number(r.bonus_quantity) || 0,
        unit_price: Number(r.unit_price) || 0,
        discount_amount: Number(r.discount_amount) || 0,
        inventory_item_id: r.inventory_item_id || null,
        batch_number: r.batch_number || null,
        expiry_date: r.expiry_date || null,
        unit: r.unit || null,
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
          payment_type: paymentType,
          due_date: paymentType === "deferred_cash" ? dueDate || null : null,
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

  const bumpQty = (i: number, delta: number) =>
    updateRow(i, { sold_quantity: String(Math.max(0, (Number(rows[i].sold_quantity) || 0) + delta)) });

  const canSubmit =
    !!customerId &&
    !!date &&
    items.some((it) => it.item_name.trim() && it.sold_quantity > 0 && it.unit_price >= 0) &&
    (type !== "sales" || paymentType !== "deferred_cash" || !!dueDate);

  const filledCount = items.filter((it) => it.item_name.trim() && it.sold_quantity > 0).length;

  return (
    <div className="max-w-3xl mx-auto pb-32">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">فاتورة جديدة</h1>

      {/* Step 1: Type segmented + basics */}
      <Card className="mb-4">
        <CardContent className="pt-5 space-y-4">
          {/* Segmented invoice type */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setType("sales")}
              className={`py-2.5 rounded-md text-xs sm:text-sm font-semibold transition ${type === "sales" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              مبيعات
            </button>
            <button
              type="button"
              onClick={() => setType("quotation")}
              className={`py-2.5 rounded-md text-xs sm:text-sm font-semibold transition ${type === "quotation" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              عرض سعر
            </button>
            <button
              type="button"
              onClick={() => setType("credit_note")}
              className={`py-2.5 rounded-md text-xs sm:text-sm font-semibold transition ${type === "credit_note" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              مرتجع
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>العميل *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="اختر عميلًا…" /></SelectTrigger>
                <SelectContent>
                  {(customers ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input className="h-11" dir="ltr" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {type === "sales" && (
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">نوع الدفع</Label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-muted rounded-lg">
                <button
                  type="button"
                  onClick={() => setPaymentType("cash")}
                  className={`py-2.5 rounded-md text-xs sm:text-sm font-semibold transition ${paymentType === "cash" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  نقدي
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType("deferred_cash")}
                  className={`py-2.5 rounded-md text-xs sm:text-sm font-semibold transition ${paymentType === "deferred_cash" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  نقدي مؤجل
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType("credit")}
                  className={`py-2.5 rounded-md text-xs sm:text-sm font-semibold transition ${paymentType === "credit" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  آجل
                </button>
              </div>
              {paymentType === "deferred_cash" && (
                <div className="space-y-1.5">
                  <Label>تاريخ الاستحقاق *</Label>
                  <Input className="h-11" dir="ltr" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {paymentType === "cash" && "سيتم تسجيل التحصيل الكامل تلقائياً عند الحفظ."}
                {paymentType === "deferred_cash" && "فاتورة نقدية مؤجلة الدفع إلى تاريخ محدد."}
                {paymentType === "credit" && "فاتورة آجلة — تُسجَّل التحصيلات لاحقاً من صفحة الفاتورة."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Items as stacked cards */}
      <div className="space-y-3">
        {rows.map((r, i) => {
          const lt = computeLineTotal({
            sold_quantity: Number(r.sold_quantity) || 0,
            unit_price: Number(r.unit_price) || 0,
            discount_amount: Number(r.discount_amount) || 0,
          });
          const isOpen = !!expanded[i];
          const hasExtras = Number(r.bonus_quantity) > 0 || Number(r.discount_amount) > 0;
          return (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-muted-foreground">صنف #{i + 1}</div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                    disabled={rows.length === 1}
                    className="h-8 w-8 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <InventoryPicker
                  value={r.item_name}
                  onPick={(picked) =>
                    updateRow(i, {
                      item_name: picked.name,
                      unit_price: String(picked.unit_price),
                      inventory_item_id: picked.id,
                      batch_number: picked.batch_number,
                      expiry_date: picked.expiry_date,
                      unit: picked.unit,
                    })
                  }
                  onFreeText={(text) =>
                    updateRow(i, {
                      item_name: text,
                      inventory_item_id: null,
                      batch_number: null,
                      expiry_date: null,
                      unit: null,
                    })
                  }
                />

                {(r.batch_number || r.expiry_date) && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {r.batch_number && (
                      <span className="px-2 py-1 rounded-md bg-muted">باتش: <span dir="ltr">{r.batch_number}</span></span>
                    )}
                    {r.expiry_date && (
                      <span className="px-2 py-1 rounded-md bg-muted">انتهاء: <span dir="ltr">{r.expiry_date}</span></span>
                    )}
                    {r.unit && <span className="px-2 py-1 rounded-md bg-muted">{r.unit}</span>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Quantity stepper */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">الكمية</Label>
                    <div className="flex items-center h-11 rounded-md border bg-background overflow-hidden">
                      <button type="button" onClick={() => bumpQty(i, -1)} className="h-full w-11 flex items-center justify-center hover:bg-muted">
                        <Minus className="h-4 w-4" />
                      </button>
                      <Input
                        dir="ltr"
                        type="number" inputMode="decimal" min="0" step="1"
                        value={r.sold_quantity}
                        onChange={(e) => updateRow(i, { sold_quantity: e.target.value })}
                        className="h-full border-0 text-center font-bold text-base focus-visible:ring-0"
                      />
                      <button type="button" onClick={() => bumpQty(i, 1)} className="h-full w-11 flex items-center justify-center hover:bg-muted">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {/* Price */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">سعر الوحدة</Label>
                    <Input
                      dir="ltr" type="number" inputMode="decimal" min="0" step="0.01"
                      value={r.unit_price}
                      onChange={(e) => updateRow(i, { unit_price: e.target.value })}
                      className="h-11 text-base font-mono"
                    />
                  </div>
                </div>

                {/* Advanced toggle */}
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [i]: !isOpen }))}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  بونص وخصم {hasExtras && !isOpen && <span className="text-primary">•</span>}
                </button>

                {isOpen && (
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t">
                    <div className="space-y-1.5 pt-3">
                      <Label className="text-xs">البونص (مجاني)</Label>
                      <Input dir="ltr" type="number" inputMode="decimal" min="0" step="1"
                        value={r.bonus_quantity}
                        onChange={(e) => updateRow(i, { bonus_quantity: e.target.value })}
                        className="h-11 font-mono" />
                    </div>
                    <div className="space-y-1.5 pt-3">
                      <Label className="text-xs">الخصم</Label>
                      <Input dir="ltr" type="number" inputMode="decimal" min="0" step="0.01"
                        value={r.discount_amount}
                        onChange={(e) => updateRow(i, { discount_amount: e.target.value })}
                        className="h-11 font-mono" />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">إجمالي السطر</span>
                  <span className="text-lg font-bold font-mono">{formatMoney(lt)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Button
          variant="outline"
          className="w-full h-12 border-dashed"
          onClick={() => setRows((r) => [...r, emptyRow()])}
        >
          <Plus className="h-4 w-4 ms-1" /> إضافة صنف آخر
        </Button>
      </div>

      {/* Notes */}
      <Card className="mt-4">
        <CardContent className="pt-5">
          <Label className="text-xs">ملاحظات (اختياري)</Label>
          <Textarea
            className="mt-1.5"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="أي بيان إضافي يظهر بالفاتورة…"
          />
        </CardContent>
      </Card>

      {/* Sticky bottom bar: totals + save */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t shadow-lg">
        <div className="max-w-3xl mx-auto p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 mb-2 text-sm">
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{filledCount} صنف</span>
              {totals.discount_total > 0 && (
                <span className="text-destructive">خصم {formatMoney(totals.discount_total)}</span>
              )}
            </div>
            <div className="text-end">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">الصافي</div>
              <div className="text-xl font-black font-mono">{formatMoney(totals.total)}</div>
            </div>
          </div>
          <Button
            size="lg"
            className="w-full h-12 text-base"
            disabled={!canSubmit || m.isPending}
            onClick={() => m.mutate()}
          >
            <Check className="h-5 w-5 ms-2" />
            {m.isPending ? "جاري الحفظ…" : "حفظ الفاتورة"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type InventoryRow = {
  id: string;
  name: string;
  batch_number: string | null;
  expiry_date: string | null;
  unit: string | null;
  unit_price: number;
};

function InventoryPicker({
  value,
  onPick,
  onFreeText,
}: {
  value: string;
  onPick: (item: InventoryRow) => void;
  onFreeText: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listFn = useServerFn(listInventory);
  const { data: inventory } = useQuery({
    queryKey: ["inventory", query],
    queryFn: () => listFn({ data: { search: query } }),
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full h-11 justify-between text-base font-normal"
        >
          <span className="flex items-center gap-2 min-w-0 flex-1 truncate text-start">
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={value ? "" : "text-muted-foreground"}>
              {value || "اختر صنفاً من المخزون…"}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] pointer-events-auto" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="ابحث أو اكتب اسم صنف جديد…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              <div className="space-y-2 p-2">
                <div className="text-sm text-muted-foreground">لا يوجد صنف بهذا الاسم.</div>
                {query.trim() && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => { onFreeText(query.trim()); setOpen(false); }}
                  >
                    استخدام "{query.trim()}" كاسم حر
                  </Button>
                )}
              </div>
            </CommandEmpty>
            {(inventory as InventoryRow[] | undefined)?.length ? (
              <CommandGroup heading="أصناف المخزون">
                {(inventory as InventoryRow[]).map((it) => (
                  <CommandItem
                    key={it.id}
                    value={it.id}
                    onSelect={() => { onPick(it); setOpen(false); }}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                        {it.batch_number && <span dir="ltr">#{it.batch_number}</span>}
                        {it.expiry_date && <span dir="ltr">⏱ {it.expiry_date}</span>}
                        {it.unit && <span>{it.unit}</span>}
                      </div>
                    </div>
                    <span className="font-mono text-sm font-semibold shrink-0">{formatMoney(it.unit_price)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}