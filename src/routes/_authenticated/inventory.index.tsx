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
import { getCompanySettings, upsertCompanySettings } from "@/lib/company/company.functions";
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

type Category = "owned" | "negotiation" | "market" | "import";
type Item = {
  id: string;
  name: string;
  scientific_name: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  unit: string | null;
  unit_price: number;
  cost_price: number;
  public_price: number;
  quantity: number;
  bonus_quantity: number;
  supplier_id: string | null;
  suppliers?: { name: string } | null;
  supplier_name: string | null;
  pharma_form: string | null;
  country: string | null;
  category: Category;
};

const CATS: { value: Category; label: string }[] = [
  { value: "owned", label: "منتجاتي" },
  { value: "negotiation", label: "تحت التفاوض" },
  { value: "market", label: "أسعار السوق" },
  { value: "import", label: "أرغب باستيرادها" },
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
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
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
                    {(it.suppliers?.name || it.supplier_name) && <span>المورد: {it.suppliers?.name ?? it.supplier_name}</span>}
                    {it.country && <span>المنشأ: {it.country}</span>}
                    {it.expiry_date && <span>انتهاء: <span dir="ltr">{it.expiry_date.slice(0, 7)}</span></span>}
                    {it.batch_number && <span>باتش: <span dir="ltr">{it.batch_number}</span></span>}
                  </div>
                  <div className="text-xs flex flex-wrap gap-x-3">
                    <span>الكمية: <span className="font-mono font-semibold">{it.quantity}</span> {it.unit}</span>
                    {Number(it.bonus_quantity) > 0 && <span className="text-emerald-700">بونص: <span className="font-mono">{it.bonus_quantity}</span></span>}
                    <span>تكلفة: <span className="font-mono">{formatMoney(it.cost_price)}</span></span>
                    <span>سعر الجمهور: <span className="font-mono font-semibold text-primary">{formatMoney(it.public_price || 0)}</span></span>
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
  const [publicPrice, setPublicPrice] = useState("0");
  const [qty, setQty] = useState("0");
  const [bonus, setBonus] = useState("0");
  const [country, setCountry] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierText, setSupplierText] = useState<string>("");
  const [category, setCategory] = useState<Category>("owned");

  const supplierFn = useServerFn(listSuppliers);
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => supplierFn({ data: {} }) });

  // Reset on open
  useStateReset(open, () => {
    setName(editing?.name ?? "");
    setScientific(editing?.scientific_name ?? "");
    setPharmaForm(editing?.pharma_form ?? "");
    setBatch(editing?.batch_number ?? "");
    setExpiry(editing?.expiry_date ? editing.expiry_date.slice(0, 7) : "");
    setUnit(editing?.unit ?? "علبة");
    setPrice(String(editing?.unit_price ?? "0"));
    setCost(String(editing?.cost_price ?? "0"));
    setPublicPrice(String(editing?.public_price ?? "0"));
    setQty(String(editing?.quantity ?? "0"));
    setBonus(String(editing?.bonus_quantity ?? "0"));
    setCountry(editing?.country ?? "");
    setSupplierId(editing?.supplier_id ?? "");
    setSupplierText(editing?.suppliers?.name ?? editing?.supplier_name ?? "");
    setCategory(editing?.category ?? defaultCategory);
  });

  const createF = useServerFn(createInventoryItem);
  const updateF = useServerFn(updateInventoryItem);

  const save = useMutation({
    mutationFn: async () => {
      // Match typed text against existing suppliers (case-insensitive trim)
      const typed = supplierText.trim();
      const matched = suppliers.find(
        (s: any) => s.name?.trim().toLowerCase() === typed.toLowerCase(),
      );
      const resolvedSupplierId = matched ? matched.id : supplierId || null;
      const resolvedSupplierName = !matched && typed ? typed : null;
      const payload = {
        name: name.trim(),
        scientific_name: scientific.trim() || null,
        batch_number: batch.trim() || null,
        expiry_date: expiry ? `${expiry}-01` : null,
        unit: unit.trim() || "علبة",
        unit_price: Number(price) || 0,
        cost_price: Number(cost) || 0,
        public_price: Number(publicPrice) || 0,
        quantity: Number(qty) || 0,
        bonus_quantity: Number(bonus) || 0,
        supplier_id: resolvedSupplierId,
        supplier_name: resolvedSupplierName,
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
              <Input
                list="supplier-options"
                value={supplierText}
                onChange={(e) => {
                  setSupplierText(e.target.value);
                  // If the typed value matches an existing supplier, link the id
                  const match = suppliers.find(
                    (s: any) => s.name?.trim().toLowerCase() === e.target.value.trim().toLowerCase(),
                  );
                  setSupplierId(match ? match.id : "");
                }}
                placeholder="اكتب اسم المورد أو اختر من القائمة"
              />
              <datalist id="supplier-options">
                {suppliers.map((s: any) => <option key={s.id} value={s.name} />)}
              </datalist>
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
              <Label>سعر الجمهور</Label>
              <Input className="font-mono" dir="ltr" type="number" min="0" step="0.01" value={publicPrice} onChange={(e) => setPublicPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الانتهاء (شهر/سنة)</Label>
              <Input dir="ltr" type="month" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
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

function PdfHeaderFooterPreview({
  category, count, company,
}: { category: Category; count: number; company: CompanyInfo }) {
  const todayLong = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const { brand, brandTo, border, text, muted } = PDF_THEME;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">معاينة الهيدر والفوتر</p>
      <div
        dir="rtl"
        className="overflow-hidden rounded-lg border shadow-sm"
        style={{ fontFamily: "'Tajawal','Cairo','Segoe UI',Arial,sans-serif", color: text, background: "#fff" }}
      >
        {/* Header */}
        <div
          className="relative px-4 py-3 text-white"
          style={{ background: `linear-gradient(135deg, ${brand} 0%, ${brandTo} 100%)` }}
        >
          <div className="flex items-center justify-between gap-3 relative">
            <div className="flex items-center gap-2 min-w-0">
              {company.logo_data_url ? (
                <img
                  src={company.logo_data_url}
                  alt=""
                  className="h-9 w-auto max-w-[60px] rounded bg-white p-1 object-contain"
                />
              ) : (
                <div className="h-9 w-9 rounded-md bg-white/20 flex items-center justify-center text-sm font-extrabold">
                  {(company.name || "O").trim().charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-[8px] tracking-[.25em] opacity-85 truncate">
                  {(company.name || "Oplus Pharma").toUpperCase()}
                </div>
                <div className="text-[13px] font-bold leading-tight truncate">{CAT_LABEL[category]}</div>
                {company.address && <div className="text-[9px] opacity-90 truncate">{company.address}</div>}
              </div>
            </div>
            <div className="text-end text-[9px] shrink-0">
              <div className="opacity-75">تاريخ الإصدار</div>
              <div className="font-semibold text-[10px]">{todayLong}</div>
              <div className="mt-1 inline-block rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold">
                {count} صنف
              </div>
            </div>
          </div>
        </div>
        {/* Body placeholder */}
        <div className="px-4 py-3 text-[10px]" style={{ color: muted }}>
          ··· جدول المنتجات ···
        </div>
        {/* Footer */}
        <div
          className="px-4 py-2 text-[9px] flex justify-between gap-3"
          style={{ borderTop: `1px solid ${border}`, color: muted }}
        >
          <div className="leading-snug min-w-0">
            <div className="font-bold text-[10px]" style={{ color: text }}>
              {company.name || "Oplus Pharma"}
            </div>
            {company.address && <div className="truncate">{company.address}</div>}
            {company.phone && <div dir="ltr" className="font-mono truncate">{company.phone}</div>}
          </div>
          <div className="text-end leading-snug shrink-0">
            <div>الأسعار قابلة للتغيير دون إشعار مسبق.</div>
            <div>© {new Date().getFullYear()}</div>
          </div>
        </div>
      </div>
    </div>
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
  { key: "public_price", label: "سعر الجمهور" },
  { key: "batch_number", label: "رقم الباتش" },
  { key: "expiry_date", label: "تاريخ الانتهاء" },
];

const CAT_LABEL: Record<Category, string> = {
  owned: "منتجاتي المتوفرة",
  negotiation: "منتجات تحت التفاوض",
  market: "أسعار السوق المرجعية",
  import: "أصناف أرغب باستيرادها",
};

type CompanyInfo = { name: string; address: string; phone: string; logo_data_url: string };
const DEFAULT_COMPANY: CompanyInfo = { name: "Oplus Pharma", address: "", phone: "", logo_data_url: "" };

// PDF theme tokens (shared between live preview and exported PDF)
const PDF_THEME = {
  brand: "#0f766e",
  brandTo: "#14b8a6",
  brandSoft: "#ecfdf5",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
};

// Embed Tajawal Arabic font as a data URL so html2canvas always renders Arabic
// correctly — even on first run before the browser has cached Google Fonts.
let _embeddedFontCss: string | null = null;
let _embeddedFontPromise: Promise<string> | null = null;
async function getEmbeddedArabicFontCss(): Promise<string> {
  if (_embeddedFontCss !== null) return _embeddedFontCss;
  if (_embeddedFontPromise) return _embeddedFontPromise;
  _embeddedFontPromise = (async () => {
    try {
      const FONTS: { weight: number; url: string }[] = [
        // Fontsource ships per-subset woff2 files. The Arabic subset is what we
        // need — Google Fonts' default gstatic URLs only contain Latin glyphs,
        // which is why Arabic letters render broken (disconnected / wrong shape)
        // inside html2canvas when the browser hasn't already cached the Arabic
        // subset from a previous page load.
        { weight: 400, url: "https://cdn.jsdelivr.net/npm/@fontsource/tajawal@5.0.5/files/tajawal-arabic-400-normal.woff2" },
        { weight: 500, url: "https://cdn.jsdelivr.net/npm/@fontsource/tajawal@5.0.5/files/tajawal-arabic-500-normal.woff2" },
        { weight: 700, url: "https://cdn.jsdelivr.net/npm/@fontsource/tajawal@5.0.5/files/tajawal-arabic-700-normal.woff2" },
      ];
      const faces = await Promise.all(FONTS.map(async (f) => {
        const res = await fetch(f.url);
        const buf = await res.arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const b64 = btoa(bin);
        return `@font-face{font-family:'TajawalPDF';font-style:normal;font-weight:${f.weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF,U+0020-007E;}`;
      }));
      _embeddedFontCss = faces.join("\n");
      // Register with document.fonts so html2canvas can resolve glyphs
      try {
        await Promise.all(FONTS.map((f) => document.fonts.load(`${f.weight} 16px TajawalPDF`)));
      } catch {}
      return _embeddedFontCss;
    } catch {
      _embeddedFontCss = "";
      return "";
    }
  })();
  return _embeddedFontPromise;
}

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
    public_price: false,
    batch_number: category === "owned",
    expiry_date: category === "owned",
  });
  const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState<CompanyInfo>(DEFAULT_COMPANY);
  const [showSettings, setShowSettings] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  const getCompanyFn = useServerFn(getCompanySettings);
  const upsertCompanyFn = useServerFn(upsertCompanySettings);
  const { data: serverCompany } = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => getCompanyFn(),
    staleTime: 60_000,
  });
  useEffect(() => {
    if (serverCompany) setCompany({ ...DEFAULT_COMPANY, ...serverCompany });
  }, [serverCompany]);

  // Preload the embedded Arabic font when the dialog opens
  useEffect(() => { if (open) void getEmbeddedArabicFontCss(); }, [open]);

  // Debounced auto-save to the server
  const saveTimer = (globalThis as any)._companySaveTimer as { id: number | null } | undefined;
  const updateCompany = (patch: Partial<CompanyInfo>) => {
    setCompany((c) => {
      const next = { ...c, ...patch };
      const t = (globalThis as any)._companySaveTimer ||= { id: null as number | null };
      if (t.id) window.clearTimeout(t.id);
      t.id = window.setTimeout(() => {
        setSavingCompany(true);
        upsertCompanyFn({ data: next })
          .catch((e: Error) => toast.error("تعذّر حفظ بيانات الشركة: " + e.message))
          .finally(() => setSavingCompany(false));
      }, 600);
      return next;
    });
  };
  void saveTimer;

  const onLogoFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { toast.error("حجم الشعار أكبر من 1.5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => updateCompany({ logo_data_url: String(reader.result || "") });
    reader.readAsDataURL(file);
  };

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
      public_price: false,
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
      const BRAND = "#0f766e"; // teal-700
      const BRAND_SOFT = "#ecfdf5";
      const BORDER = "#e5e7eb";
      const TEXT = "#111827";
      const MUTED = "#6b7280";
      const th = (label: string, end = false) =>
        `<th style="padding:10px 12px;text-align:${end ? "end" : "start"};background:${BRAND};color:#fff;font-weight:600;font-size:11px;letter-spacing:.02em;border:none;">${label}</th>`;
      const td = (val: string, opts: { end?: boolean; bold?: boolean; ltr?: boolean; accent?: boolean } = {}) =>
        `<td style="padding:9px 12px;text-align:${opts.end ? "end" : "start"};${opts.bold ? "font-weight:700;" : "font-weight:500;"}${opts.ltr ? "direction:ltr;" : ""}font-family:${opts.ltr ? "'SF Mono',Menlo,monospace" : "inherit"};color:${opts.accent ? BRAND : TEXT};border-bottom:1px solid ${BORDER};font-size:11px;">${val}</td>`;

      const rows = items.map((it, idx) => {
        const zebra = idx % 2 === 1 ? `background:#fafafa;` : "";
        const cells = [
          td(`<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:${BRAND_SOFT};color:${BRAND};font-weight:700;font-size:10px;">${idx + 1}</span>`),
          td(esc(it.name), { bold: true }),
          fields.scientific_name && td(esc(it.scientific_name)),
          fields.pharma_form && td(esc(it.pharma_form)),
          fields.country && td(esc(it.country)),
          fields.supplier && td(esc(it.suppliers?.name ?? it.supplier_name)),
          fields.quantity && td(`${it.quantity} ${esc(it.unit || "")}`, { end: true, ltr: true }),
          fields.bonus_quantity && td(String(it.bonus_quantity || 0), { end: true, ltr: true }),
          fields.cost_price && td(formatMoney(it.cost_price), { end: true, ltr: true }),
          fields.unit_price && td(formatMoney(it.unit_price), { end: true, ltr: true, bold: true, accent: true }),
          fields.public_price && td(formatMoney(it.public_price), { end: true, ltr: true }),
          fields.batch_number && td(esc(it.batch_number), { ltr: true }),
          fields.expiry_date && td(esc(it.expiry_date ? it.expiry_date.slice(0, 7) : null), { ltr: true }),
        ].filter(Boolean).join("");
        return `<tr style="${zebra}">${cells}</tr>`;
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
        fields.public_price && th("الجمهور", true),
        fields.batch_number && th("الباتش"),
        fields.expiry_date && th("الانتهاء"),
      ].filter(Boolean).join("");

      const todayLong = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
      // Pre-load embedded Arabic font (data URL) so Arabic always renders correctly
      const fontCss = await getEmbeddedArabicFontCss();
      const container = document.createElement("div");
      container.lang = "ar";
      container.dir = "rtl";
      container.style.cssText = `position:fixed;left:-10000px;top:0;width:900px;background:#ffffff;color:${TEXT};direction:rtl;font-family:'TajawalPDF','Tajawal','Cairo','Segoe UI',Arial,sans-serif;`;
      const logoHtml = company.logo_data_url
        ? `<img src="${company.logo_data_url}" crossorigin="anonymous" style="height:56px;width:auto;max-width:140px;object-fit:contain;background:#fff;padding:6px;border-radius:10px;" />`
        : `<div style="height:56px;width:56px;border-radius:12px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;">${esc((company.name || "O").trim().charAt(0))}</div>`;
      const addressLine = company.address ? `<div style="font-size:11px;opacity:.85;margin-top:4px;">${esc(company.address)}</div>` : "";
      container.innerHTML = `
        <style>${fontCss}</style>
        <div style="background:linear-gradient(135deg,${BRAND} 0%,#14b8a6 100%);padding:28px 32px;color:#fff;position:relative;overflow:hidden;">
          <div style="position:absolute;inset:0;background:radial-gradient(circle at 90% 20%,rgba(255,255,255,.18),transparent 50%);"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;position:relative;gap:16px;">
            <div style="display:flex;align-items:center;gap:14px;">
              ${logoHtml}
              <div>
                <div style="font-size:11px;letter-spacing:.25em;opacity:.85;margin-bottom:4px;">${esc((company.name || "Oplus Pharma").toUpperCase())}</div>
                <h2 style="font-size:22px;font-weight:700;margin:0;letter-spacing:-.01em;">${CAT_LABEL[category]}</h2>
                ${addressLine}
              </div>
            </div>
            <div style="text-align:end;font-size:11px;opacity:.95;">
              <div style="opacity:.75;margin-bottom:4px;">تاريخ الإصدار</div>
              <div style="font-weight:600;font-size:13px;">${todayLong}</div>
              <div style="margin-top:8px;display:inline-block;padding:4px 10px;background:rgba(255,255,255,.18);border-radius:999px;font-size:11px;font-weight:600;">${items.length} صنف</div>
            </div>
          </div>
        </div>
        <div style="padding:24px 32px 32px;">
          ${items.length === 0
            ? `<p style="text-align:center;padding:48px;color:${MUTED};font-size:13px;">لا توجد منتجات في هذه القائمة.</p>`
            : `<table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
                <thead><tr>${headers}</tr></thead>
                <tbody>${rows}</tbody>
              </table>`}
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid ${BORDER};font-size:10px;color:${MUTED};">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
              <div style="line-height:1.6;">
                <div style="font-weight:700;color:${TEXT};font-size:11px;">${esc(company.name || "Oplus Pharma")}</div>
                ${company.address ? `<div>${esc(company.address)}</div>` : ""}
                ${company.phone ? `<div dir="ltr" style="font-family:'SF Mono',Menlo,monospace;">${esc(company.phone)}</div>` : ""}
              </div>
              <div style="text-align:end;line-height:1.6;">
                <div>الأسعار قابلة للتغيير دون إشعار مسبق.</div>
                <div>© ${new Date().getFullYear()}</div>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(container);

      try {
        // Ensure the embedded font is actually registered before rasterizing.
        if (document.fonts) {
          try {
            await Promise.all([
              document.fonts.load("700 22px TajawalPDF"),
              document.fonts.load("400 12px TajawalPDF"),
            ]);
            await document.fonts.ready;
          } catch {}
        }
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تصدير PDF — {CAT_LABEL[category]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <PdfHeaderFooterPreview category={category} count={items.length} company={company} />
          <p className="text-xs text-muted-foreground">اختر الأعمدة التي ستظهر في الملف:</p>
          <div className="grid grid-cols-2 gap-2">
            {PDF_FIELDS.map((f) => (
              <Label key={f.key} className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                <Checkbox checked={!!fields[f.key]} onCheckedChange={() => toggle(f.key)} />
                {f.label}
              </Label>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => setShowSettings((s) => !s)}
            >
              {showSettings ? "إخفاء" : "إعدادات الشركة (يظهر في الهيدر والفوتر)"}
              {savingCompany && <span className="ms-2 text-muted-foreground">جاري الحفظ…</span>}
            </button>
            {showSettings && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="space-y-1">
                  <Label className="text-xs">اسم الجهة</Label>
                  <Input
                    value={company.name}
                    onChange={(e) => updateCompany({ name: e.target.value })}
                    placeholder="Oplus Pharma"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">العنوان</Label>
                  <Input
                    value={company.address}
                    onChange={(e) => updateCompany({ address: e.target.value })}
                    placeholder="القاهرة — مصر"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الهاتف</Label>
                  <Input
                    dir="ltr"
                    value={company.phone}
                    onChange={(e) => updateCompany({ phone: e.target.value })}
                    placeholder="+20 100 000 0000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">شعار الشركة (PNG/JPG، حد أقصى 2MB)</Label>
                  <div className="flex items-center gap-2">
                    {company.logo_data_url && (
                      <img src={company.logo_data_url} alt="logo" className="h-10 w-10 rounded border bg-white object-contain" />
                    )}
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
                      className="text-xs"
                    />
                    {company.logo_data_url && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => updateCompany({ logo_data_url: "" })}>
                        حذف
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
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
    setExpiry(item?.expiry_date ? item.expiry_date.slice(0, 7) : "");
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
          expiry_date: expiry ? `${expiry}-01` : null,
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
            <Label>تاريخ الانتهاء (شهر/سنة)</Label>
            <Input dir="ltr" type="month" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
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