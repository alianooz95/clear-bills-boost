import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { listInventory } from "@/lib/inventory/inventory.functions";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Printer, FileDown } from "lucide-react";

const searchSchema = z.object({
  category: z.enum(["owned", "negotiation", "market"]).default("owned"),
});

export const Route = createFileRoute("/_authenticated/inventory/print")({
  head: () => ({ meta: [{ title: "قائمة الأصناف للطباعة" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: PrintCatalog,
});

const CAT_LABEL: Record<string, string> = {
  owned: "منتجاتي المتوفرة",
  negotiation: "منتجات تحت التفاوض",
  market: "أسعار السوق المرجعية",
};

function PrintCatalog() {
  const { category } = useSearch({ from: "/_authenticated/inventory/print" });
  const fn = useServerFn(listInventory);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory-print", category],
    queryFn: () => fn({ data: { category } }),
  });

  // Field toggles — defaults differ per category
  const [fields, setFields] = useState<Record<string, boolean>>({
    scientific_name: true,
    pharma_form: true,
    country: true,
    quantity: category === "owned",
    bonus_quantity: category === "owned",
    unit_price: true,
    cost_price: false,
    batch_number: category === "owned",
    expiry_date: category === "owned",
    supplier: false,
  });
  const toggle = (k: string) => setFields((f) => ({ ...f, [k]: !f[k] }));

  const FIELD_LABELS: Record<string, string> = {
    scientific_name: "الاسم العلمي",
    pharma_form: "الشكل الصيدلاني",
    country: "بلد المنشأ",
    quantity: "الكمية",
    bonus_quantity: "البونص",
    unit_price: "سعر البيع",
    cost_price: "سعر التكلفة",
    batch_number: "رقم الباتش",
    expiry_date: "تاريخ الانتهاء",
    supplier: "المورد",
  };

  const today = new Date().toISOString().slice(0, 10);

  const exportPdf = async () => {
    const el = document.querySelector(".catalog-print") as HTMLElement | null;
    if (!el) return;
    const html2pdf = (await import("html2pdf.js")).default;
    await html2pdf()
      .from(el)
      .set({
        margin: 10,
        filename: `${CAT_LABEL[category]}-${today}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .save();
  };

  return (
    <div className="bg-white text-black">
      <div className="print:hidden p-4 border-b space-y-3 max-w-5xl mx-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold">{CAT_LABEL[category]}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportPdf}>
              <FileDown className="h-4 w-4 ms-1" /> تصدير PDF
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 ms-1" /> طباعة
            </Button>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium mb-2">اختر الأعمدة المراد طباعتها:</p>
          <div className="flex flex-wrap gap-3">
            {Object.keys(FIELD_LABELS).map((k) => (
              <Label key={k} className="flex items-center gap-1.5 text-xs font-normal cursor-pointer">
                <Checkbox checked={!!fields[k]} onCheckedChange={() => toggle(k)} />
                {FIELD_LABELS[k]}
              </Label>
            ))}
          </div>
        </div>
      </div>

      <div className="catalog-print p-6 mx-auto" style={{ maxWidth: "900px" }}>
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h2 className="text-xl font-bold">Oplus Pharma</h2>
          <p className="text-sm">{CAT_LABEL[category]}</p>
          <p className="text-xs text-gray-600 mt-1">تاريخ الإصدار: <span dir="ltr" className="font-mono">{today}</span></p>
        </div>

        {isLoading ? (
          <p className="text-center py-8">جاري التحميل…</p>
        ) : items.length === 0 ? (
          <p className="text-center py-8 text-gray-500">لا توجد منتجات.</p>
        ) : (
          <table className="w-full text-xs border-collapse border border-black">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-black px-2 py-1.5 text-start">#</th>
                <th className="border border-black px-2 py-1.5 text-start">الاسم التجاري</th>
                {fields.scientific_name && <th className="border border-black px-2 py-1.5 text-start">الاسم العلمي</th>}
                {fields.pharma_form && <th className="border border-black px-2 py-1.5 text-start">الشكل</th>}
                {fields.country && <th className="border border-black px-2 py-1.5 text-start">المنشأ</th>}
                {fields.supplier && <th className="border border-black px-2 py-1.5 text-start">المورد</th>}
                {fields.quantity && <th className="border border-black px-2 py-1.5 text-end">الكمية</th>}
                {fields.bonus_quantity && <th className="border border-black px-2 py-1.5 text-end">بونص</th>}
                {fields.cost_price && <th className="border border-black px-2 py-1.5 text-end">التكلفة</th>}
                {fields.unit_price && <th className="border border-black px-2 py-1.5 text-end">السعر</th>}
                {fields.batch_number && <th className="border border-black px-2 py-1.5 text-start">الباتش</th>}
                {fields.expiry_date && <th className="border border-black px-2 py-1.5 text-start">الانتهاء</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, idx: number) => (
                <tr key={it.id}>
                  <td className="border border-black px-2 py-1">{idx + 1}</td>
                  <td className="border border-black px-2 py-1 font-semibold">{it.name}</td>
                  {fields.scientific_name && <td className="border border-black px-2 py-1 text-gray-700">{it.scientific_name || "—"}</td>}
                  {fields.pharma_form && <td className="border border-black px-2 py-1">{it.pharma_form || "—"}</td>}
                  {fields.country && <td className="border border-black px-2 py-1">{it.country || "—"}</td>}
                  {fields.supplier && <td className="border border-black px-2 py-1">{it.suppliers?.name || "—"}</td>}
                  {fields.quantity && <td className="border border-black px-2 py-1 text-end font-mono">{it.quantity} {it.unit || ""}</td>}
                  {fields.bonus_quantity && <td className="border border-black px-2 py-1 text-end font-mono">{it.bonus_quantity || 0}</td>}
                  {fields.cost_price && <td className="border border-black px-2 py-1 text-end font-mono">{formatMoney(it.cost_price)}</td>}
                  {fields.unit_price && <td className="border border-black px-2 py-1 text-end font-mono font-bold">{formatMoney(it.unit_price)}</td>}
                  {fields.batch_number && <td className="border border-black px-2 py-1" dir="ltr">{it.batch_number || "—"}</td>}
                  {fields.expiry_date && <td className="border border-black px-2 py-1" dir="ltr">{it.expiry_date || "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="text-[10px] text-gray-500 text-center mt-6">الأسعار قابلة للتغيير دون إشعار مسبق.</p>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden; }
          .catalog-print, .catalog-print * { visibility: visible; }
          .catalog-print { position: absolute; inset: 0; }
        }
      `}</style>
    </div>
  );
}