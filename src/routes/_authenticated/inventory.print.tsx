import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { z } from "zod";
import { listInventory } from "@/lib/inventory/inventory.functions";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

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

  useEffect(() => {
    if (!isLoading && items.length > 0) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [isLoading, items.length]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="bg-white text-black">
      <div className="print:hidden p-4 flex justify-between items-center border-b">
        <h1 className="text-lg font-bold">{CAT_LABEL[category]}</h1>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 ms-1" /> طباعة</Button>
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
                <th className="border border-black px-2 py-1.5 text-start">الاسم العلمي</th>
                <th className="border border-black px-2 py-1.5 text-start">الشكل</th>
                <th className="border border-black px-2 py-1.5 text-start">المنشأ</th>
                {category === "owned" && <th className="border border-black px-2 py-1.5 text-end">الكمية</th>}
                {category === "owned" && <th className="border border-black px-2 py-1.5 text-end">بونص</th>}
                <th className="border border-black px-2 py-1.5 text-end">السعر</th>
                {category === "owned" && <th className="border border-black px-2 py-1.5 text-start">الانتهاء</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, idx: number) => (
                <tr key={it.id}>
                  <td className="border border-black px-2 py-1">{idx + 1}</td>
                  <td className="border border-black px-2 py-1 font-semibold">{it.name}</td>
                  <td className="border border-black px-2 py-1 text-gray-700">{it.scientific_name || "—"}</td>
                  <td className="border border-black px-2 py-1">{it.pharma_form || "—"}</td>
                  <td className="border border-black px-2 py-1">{it.country || "—"}</td>
                  {category === "owned" && <td className="border border-black px-2 py-1 text-end font-mono">{it.quantity} {it.unit || ""}</td>}
                  {category === "owned" && <td className="border border-black px-2 py-1 text-end font-mono">{it.bonus_quantity || 0}</td>}
                  <td className="border border-black px-2 py-1 text-end font-mono font-bold">{formatMoney(it.unit_price)}</td>
                  {category === "owned" && <td className="border border-black px-2 py-1" dir="ltr">{it.expiry_date || "—"}</td>}
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