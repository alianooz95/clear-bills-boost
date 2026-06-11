import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  convertToOwned,
} from "@/lib/inventory/inventory.functions";
import { listSuppliers } from "@/lib/suppliers/suppliers.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Pencil, Trash2, Package, Printer, ArrowRightLeft, FileDown } from "lucide-react";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory/")({
  head: () => ({ meta: [{ title: "المخزون — الأصناف" }] }),
  component: InventoryPage,
});

type Category = "owned" | "negotiation" | "market";
type Item = {
  id: string;
  name: string;
  scientific_name: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  unit: string | null;
  unit_price: number;
  cost_price: number;
  quantity: number;
  bonus_quantity: number;
  supplier_id: string | null;
  suppliers?: { name: string } | null;
  pharma_form: string | null;
  country: string | null;
  category: Category;
};

const CATS: { value: Category; label: string }[] = [
  { value: "owned", label: "منتجاتي" },
  { value: "negotiation", label: "تحت التفاوض" },
  { value: "market", label: "أسعار السوق" },
];

function InventoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("owned");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [converting, setConverting] = useState<Item | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);

  const listFn = useServerFn(listInventory);
  const { data: items, isLoading } = useQuery({
    queryKey: ["inventory", search, category],
    queryFn: () => listFn({ data: { search, category } }),
  });

  const delFn = useServerFn(deleteInventoryItem);
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" /> المنتجات الدوائية
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPdfOpen(true)}>
            <FileDown className="h-4 w-4 ms-1" /> تصدير PDF
          </Button>
          <Button variant="outline" onClick={() => window.open(`/inventory/print?category=${category}`, "_blank")}>
            <Printer className="h-4 w-4 ms-1" /> طباعة القائمة
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 ms-1" /> منتج جديد
          </Button>
        </div>
      </div>

      <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          {CATS.map((c) => <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث باسم المنتج…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pe-9"
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center py-8">جاري التحميل…</div>
      ) : (items ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            لا توجد منتجات في هذه الفئة بعد.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(items as Item[]).map((it) => (
            <Card key={it.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{it.name}</span>
                    {it.scientific_name && <span className="text-xs text-muted-foreground">({it.scientific_name})</span>}
                    {it.pharma_form && <Badge variant="outline" className="text-[10px]">{it.pharma_form}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    {it.suppliers?.name && <span>المورد: {it.suppliers.name}</span>}
                    {it.country && <span>المنشأ: {it.country}</span>}
                    {it.expiry_date && <span>انتهاء: <span dir="ltr">{it.expiry_date}</span></span>}
                    {it.batch_number && <span>باتش: <span dir="ltr">{it.batch_number}</span></span>}
                  </div>
                  <div className="text-xs flex flex-wrap gap-x-3">
                    <span>الكمية: <span className="font-mono font-semibold">{it.quantity}</span> {it.unit}</span>
                    {Number(it.bonus_quantity) > 0 && <span className="text-emerald-700">بونص: <span className="font-mono">{it.bonus_quantity}</span></span>}
                    <span>تكلفة: <span className="font-mono">{formatMoney(it.cost_price)}</span></span>
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <div className="text-[10px] text-muted-foreground">سعر البيع</div>
                  <div className="font-mono font-bold text-lg">{formatMoney(it.unit_price)}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {it.category === "negotiation" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-700"
                      title="تحويل إلى منتجاتي"
                      onClick={() => setConverting(it)}>
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(it); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                    onClick={() => { if (confirm("حذف هذا المنتج؟")) del.mutate(it.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ItemDialog open={open} onOpenChange={setOpen} editing={editing} defaultCategory={category} onSaved={() => {
        qc.invalidateQueries({ queryKey: ["inventory"] });
      }} />

      <ConvertDialog
        item={converting}
        onClose={() => setConverting(null)}
        onDone={() => { qc.invalidateQueries({ queryKey: ["inventory"] }); setConverting(null); }}
      />

      <PdfExportDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        category={category}
        items={(items as Item[]) ?? []}
      />
    </div>
  );
}

function ItemDialog({
  open, onOpenChange, editing, defaultCategory, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Item | null;
  defaultCategory: Category;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [scientific, setScientific] = useState("");
  const [pharmaForm, setPharmaForm] = useState("");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [unit, setUnit] = useState("علبة");
  const [price, setPrice] = useState("0");
  const [cost, setCost] = useState("0");
  const [qty, setQty] = useState("0");
  const [bonus, setBonus] = useState("0");
  const [country, setCountry] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [category, setCategory] = useState<Category>("owned");

  const supplierFn = useServerFn(listSuppliers);
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => supplierFn({ data: {} }) });

  // Reset on open
  useStateReset(open, () => {
    setName(editing?.name ?? "");
    setScientific(editing?.scientific_name ?? "");
    setPharmaForm(editing?.pharma_form ?? "");
    setBatch(editing?.batch_number ?? "");
    setExpiry(editing?.expiry_date ?? "");
    setUnit(editing?.unit ?? "علبة");
    setPrice(String(editing?.unit_price ?? "0"));
    setCost(String(editing?.cost_price ?? "0"));
    setQty(String(editing?.quantity ?? "0"));
    setBonus(String(editing?.bonus_quantity ?? "0"));
    setCountry(editing?.country ?? "");
    setSupplierId(editing?.supplier_id ?? "");
    setCategory(editing?.category ?? defaultCategory);
  });

  const createF = useServerFn(createInventoryItem);
  const updateF = useServerFn(updateInventoryItem);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        scientific_name: scientific.trim() || null,
        batch_number: batch.trim() || null,
        expiry_date: expiry || null,
        unit: unit.trim() || "علبة",
        unit_price: Number(price) || 0,
        cost_price: Number(cost) || 0,
        quantity: Number(qty) || 0,
        bonus_quantity: Number(bonus) || 0,
        supplier_id: supplierId || null,
        pharma_form: pharmaForm.trim() || null,
        country: country.trim() || null,
        category,
      };
      if (!payload.name) throw new Error("الاسم التجاري مطلوب");
      if (editing) return updateF({ data: { id: editing.id, ...payload } });
      return createF({ data: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "تم التحديث" : "تمت إضافة المنتج");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل منتج" : "منتج جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>الفئة</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الاسم التجاري *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Panadol" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>الاسم العلمي</Label>
              <Input value={scientific} onChange={(e) => setScientific(e.target.value)} placeholder="Paracetamol 500mg" />
            </div>
            <div className="space-y-1.5">
              <Label>الشكل الصيدلاني</Label>
              <Input value={pharmaForm} onChange={(e) => setPharmaForm(e.target.value)} placeholder="أقراص / شراب / حقن" />
            </div>
            <div className="space-y-1.5">
              <Label>بلد المنشأ</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="مصر / الهند / ألمانيا" />
            </div>
            <div className="space-y-1.5">
              <Label>المورد</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الوحدة</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="علبة" />
            </div>
            <div className="space-y-1.5">
              <Label>الكمية</Label>
              <Input className="font-mono" dir="ltr" type="number" min="0" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>البونص</Label>
              <Input className="font-mono" dir="ltr" type="number" min="0" step="0.01" value={bonus} onChange={(e) => setBonus(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>سعر التكلفة</Label>
              <Input className="font-mono" dir="ltr" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>سعر البيع *</Label>
              <Input className="font-mono" dir="ltr" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الانتهاء</Label>
              <Input dir="ltr" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الباتش</Label>
              <Input dir="ltr" value={batch} onChange={(e) => setBatch(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "جاري الحفظ…" : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tiny helper: re-run effect when `open` flips to true
import { useEffect } from "react";
function useStateReset(open: boolean, fn: () => void) {
  useEffect(() => {
    if (open) fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

const PDF_FIELDS: { key: string; label: string }[] = [
  { key: "scientific_name", label: "الاسم العلمي" },
  { key: "pharma_form", label: "الشكل الصيدلاني" },
  { key: "country", label: "بلد المنشأ" },
  { key: "supplier", label: "المورد" },
  { key: "quantity", label: "الكمية" },
  { key: "bonus_quantity", label: "البونص" },
  { key: "cost_price", label: "سعر التكلفة" },
  { key: "unit_price", label: "سعر البيع" },
  { key: "batch_number", label: "رقم الباتش" },
  { key: "expiry_date", label: "تاريخ الانتهاء" },
];

const CAT_LABEL: Record<Category, string> = {
  owned: "منتجاتي المتوفرة",
  negotiation: "منتجات تحت التفاوض",
  market: "أسعار السوق المرجعية",
};

function PdfExportDialog({
  open, onOpenChange, category, items,
}: { open: boolean; onOpenChange: (v: boolean) => void; category: Category; items: Item[] }) {
  const [fields, setFields] = useState<Record<string, boolean>>({
    scientific_name: true,
    pharma_form: true,
    country: true,
    supplier: false,
    quantity: category === "owned",
    bonus_quantity: category === "owned",
    cost_price: false,
    unit_price: true,
    batch_number: category === "owned",
    expiry_date: category === "owned",
  });
  const [busy, setBusy] = useState(false);

  useStateReset(open, () => {
    setFields({
      scientific_name: true,
      pharma_form: true,
      country: true,
      supplier: false,
      quantity: category === "owned",
      bonus_quantity: category === "owned",
      cost_price: false,
      unit_price: true,
      batch_number: category === "owned",
      expiry_date: category === "owned",
    });
  });

  const toggle = (k: string) => setFields((f) => ({ ...f, [k]: !f[k] }));

  const exportPdf = async () => {
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const esc = (s: any) => String(s ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
      const th = (label: string, end = false) =>
        `<th style="border:1px solid #000;padding:4px 6px;text-align:${end ? "end" : "start"};background:#f3f4f6;">${label}</th>`;
      const td = (val: string, opts: { end?: boolean; bold?: boolean; ltr?: boolean } = {}) =>
        `<td style="border:1px solid #000;padding:4px 6px;text-align:${opts.end ? "end" : "start"};${opts.bold ? "font-weight:700;" : ""}${opts.ltr ? "direction:ltr;" : ""}font-family:${opts.ltr ? "monospace" : "inherit"};">${val}</td>`;

      const rows = items.map((it, idx) => {
        const cells = [
          td(String(idx + 1)),
          td(esc(it.name), { bold: true }),
          fields.scientific_name && td(esc(it.scientific_name)),
          fields.pharma_form && td(esc(it.pharma_form)),
          fields.country && td(esc(it.country)),
          fields.supplier && td(esc(it.suppliers?.name)),
          fields.quantity && td(`${it.quantity} ${esc(it.unit || "")}`, { end: true, ltr: true }),
          fields.bonus_quantity && td(String(it.bonus_quantity || 0), { end: true, ltr: true }),
          fields.cost_price && td(formatMoney(it.cost_price), { end: true, ltr: true }),
          fields.unit_price && td(formatMoney(it.unit_price), { end: true, ltr: true, bold: true }),
          fields.batch_number && td(esc(it.batch_number), { ltr: true }),
          fields.expiry_date && td(esc(it.expiry_date), { ltr: true }),
        ].filter(Boolean).join("");
        return `<tr>${cells}</tr>`;
      }).join("");

      const headers = [
        th("#"),
        th("الاسم التجاري"),
        fields.scientific_name && th("الاسم العلمي"),
        fields.pharma_form && th("الشكل"),
        fields.country && th("المنشأ"),
        fields.supplier && th("المورد"),
        fields.quantity && th("الكمية", true),
        fields.bonus_quantity && th("بونص", true),
        fields.cost_price && th("التكلفة", true),
        fields.unit_price && th("السعر", true),
        fields.batch_number && th("الباتش"),
        fields.expiry_date && th("الانتهاء"),
      ].filter(Boolean).join("");

      const container = document.createElement("div");
      container.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;background:#ffffff;color:#000000;padding:24px;direction:rtl;font-family:'Cairo','Tajawal',Arial,sans-serif;";
      container.innerHTML = `
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px;">
          <h2 style="font-size:20px;font-weight:700;margin:0;">Oplus Pharma</h2>
          <p style="font-size:14px;margin:4px 0 0;">${CAT_LABEL[category]}</p>
          <p style="font-size:11px;color:#555;margin:4px 0 0;">تاريخ الإصدار: <span dir="ltr" style="font-family:monospace;">${today}</span></p>
        </div>
        ${items.length === 0
          ? `<p style="text-align:center;padding:32px;color:#666;">لا توجد منتجات.</p>`
          : `<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`}
        <p style="font-size:10px;color:#666;text-align:center;margin-top:24px;">الأسعار قابلة للتغيير دون إشعار مسبق.</p>
      `;
      document.body.appendChild(container);

      try {
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
          import("html2canvas-pro"),
          import("jspdf"),
        ]);
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const imgW = pageW - margin * 2;
        const imgH = (canvas.height * imgW) / canvas.width;
        let heightLeft = imgH;
        let position = margin;
        pdf.addImage(imgData, "JPEG", margin, position, imgW, imgH);
        heightLeft -= pageH - margin * 2;
        while (heightLeft > 0) {
          position = margin - (imgH - heightLeft);
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", margin, position, imgW, imgH);
          heightLeft -= pageH - margin * 2;
        }
        pdf.save(`${CAT_LABEL[category]}-${today}.pdf`);
      } finally {
        document.body.removeChild(container);
      }
      toast.success("تم تصدير PDF");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "فشل التصدير");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>تصدير PDF — {CAT_LABEL[category]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">اختر الأعمدة التي ستظهر في الملف:</p>
          <div className="grid grid-cols-2 gap-2">
            {PDF_FIELDS.map((f) => (
              <Label key={f.key} className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                <Checkbox checked={!!fields[f.key]} onCheckedChange={() => toggle(f.key)} />
                {f.label}
              </Label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>إلغاء</Button>
          <Button onClick={exportPdf} disabled={busy}>
            <FileDown className="h-4 w-4 ms-1" /> {busy ? "جاري التصدير…" : "تصدير"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({
  item, onClose, onDone,
}: { item: Item | null; onClose: () => void; onDone: () => void }) {
  const [price, setPrice] = useState("0");
  const [cost, setCost] = useState("0");
  const [qty, setQty] = useState("0");
  const [bonus, setBonus] = useState("0");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");

  useStateReset(!!item, () => {
    setPrice(String(item?.unit_price ?? "0"));
    setCost(String(item?.cost_price ?? "0"));
    setQty(String(item?.quantity ?? "0"));
    setBonus(String(item?.bonus_quantity ?? "0"));
    setBatch(item?.batch_number ?? "");
    setExpiry(item?.expiry_date ?? "");
  });

  const convertFn = useServerFn(convertToOwned);
  const run = useMutation({
    mutationFn: async () => {
      if (!item) return;
      return convertFn({
        data: {
          id: item.id,
          unit_price: Number(price) || 0,
          cost_price: Number(cost) || 0,
          quantity: Number(qty) || 0,
          bonus_quantity: Number(bonus) || 0,
          batch_number: batch.trim() || null,
          expiry_date: expiry || null,
          supplier_id: item.supplier_id,
          pharma_form: item.pharma_form,
          country: item.country,
          unit: item.unit,
        },
      });
    },
    onSuccess: () => { toast.success("تم التحويل إلى منتجاتي"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تحويل إلى منتجاتي — {item?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">راجع وعدّل البيانات قبل النقل إلى المخزون.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>سعر البيع</Label>
            <Input className="font-mono" dir="ltr" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>سعر التكلفة</Label>
            <Input className="font-mono" dir="ltr" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>الكمية</Label>
            <Input className="font-mono" dir="ltr" type="number" min="0" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>البونص</Label>
            <Input className="font-mono" dir="ltr" type="number" min="0" step="0.01" value={bonus} onChange={(e) => setBonus(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الباتش</Label>
            <Input dir="ltr" value={batch} onChange={(e) => setBatch(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ الانتهاء</Label>
            <Input dir="ltr" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? "جاري التحويل…" : "تحويل إلى منتجاتي"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}