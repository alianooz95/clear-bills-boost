import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerReceipt } from "@/lib/receipts/receipts.functions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { tafqeet } from "@/lib/invoices/tafqeet";
import { Printer, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/receipts/$id")({
  head: () => ({ meta: [{ title: "سند تحصيل" }] }),
  component: ReceiptDetail,
});

function ReceiptDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getCustomerReceipt);
  const { data, isLoading } = useQuery({
    queryKey: ["customer-receipt", id],
    queryFn: () => fn({ data: { id } }),
  });

  if (isLoading) return <div className="text-muted-foreground">جاري التحميل…</div>;
  if (!data) return null;
  const allocations = (data as any).allocations ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Link to="/receipts"><Button variant="ghost" size="icon"><ArrowRight className="h-4 w-4" /></Button></Link>
          <h1 className="text-xl font-bold">سند تحصيل — {data.receipt_number}</h1>
        </div>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 ms-1" /> طباعة</Button>
      </div>

      <div className="receipt-print bg-white text-black mx-auto max-w-2xl rounded-lg border shadow-sm p-8 print:shadow-none print:border-0">
        <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
          <div className="text-start">
            <h3 className="text-lg font-bold">Oplus Pharma</h3>
            <p className="text-[11px] text-gray-600">الرقم الضريبي: 700000000000003</p>
            <p className="text-[11px] text-gray-600">صنعاء — اليمن</p>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold">سند تحصيل</h2>
            <p className="text-xs mt-1">RECEIPT VOUCHER</p>
          </div>
          <div className="text-end text-xs">
            <div className="border border-black rounded px-2 py-1 font-mono font-bold">{data.receipt_number}</div>
            <div className="mt-1">التاريخ: <span dir="ltr" className="font-mono">{data.receipt_date}</span></div>
          </div>
        </div>

        <table className="w-full text-sm mb-3">
          <tbody>
            <tr><td className="py-1.5 w-32 font-semibold">استلمنا من السيد:</td><td className="py-1.5 border-b border-dashed">{data.customers?.name}</td></tr>
            {data.customers?.tax_number && (
              <tr><td className="py-1.5 font-semibold">الرقم الضريبي:</td><td className="py-1.5 border-b border-dashed font-mono" dir="ltr">{data.customers.tax_number}</td></tr>
            )}
            <tr><td className="py-1.5 font-semibold">مبلغ وقدره:</td><td className="py-1.5 border-b border-dashed font-mono font-bold text-lg">{formatMoney(data.amount)}</td></tr>
            <tr><td className="py-1.5 font-semibold">فقط لا غير:</td><td className="py-1.5 border-b border-dashed">{tafqeet(Number(data.amount))}</td></tr>
            <tr><td className="py-1.5 font-semibold">طريقة الدفع:</td><td className="py-1.5 border-b border-dashed">{data.method || "—"}</td></tr>
            <tr><td className="py-1.5 font-semibold">المرجع:</td><td className="py-1.5 border-b border-dashed" dir="ltr">{data.reference || "—"}</td></tr>
            <tr><td className="py-1.5 font-semibold align-top">وذلك عن:</td><td className="py-1.5 border-b border-dashed">{data.notes || (allocations.length > 0 ? "سداد فواتير" : "تحصيل على الحساب")}</td></tr>
          </tbody>
        </table>

        {allocations.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-semibold mb-1">الفواتير المسددة:</div>
            <table className="w-full text-xs border border-black">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-black px-2 py-1 text-start">رقم الفاتورة</th>
                  <th className="border border-black px-2 py-1 text-start">التاريخ</th>
                  <th className="border border-black px-2 py-1 text-end">إجمالي الفاتورة</th>
                  <th className="border border-black px-2 py-1 text-end">المسدد من هذا السند</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a: any) => (
                  <tr key={a.id}>
                    <td className="border border-black px-2 py-1 font-mono">{a.invoices?.invoice_number}</td>
                    <td className="border border-black px-2 py-1" dir="ltr">{a.invoices?.invoice_date}</td>
                    <td className="border border-black px-2 py-1 text-end font-mono">{formatMoney(a.invoices?.total ?? 0)}</td>
                    <td className="border border-black px-2 py-1 text-end font-mono font-bold">{formatMoney(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6 mt-10 text-xs text-center">
          <div><div className="border-t border-black pt-1">المحاسب</div></div>
          <div><div className="border-t border-black pt-1">المستلم</div></div>
          <div><div className="border-t border-black pt-1">الدافع</div></div>
        </div>
        <p className="text-[10px] text-gray-500 text-center mt-4">هذا السند يعتبر مستنداً رسمياً لإثبات استلام المبلغ المذكور أعلاه.</p>
      </div>

      <style>{`
        @media print {
          @page { size: A5 landscape; margin: 8mm; }
          body * { visibility: hidden; }
          .receipt-print, .receipt-print * { visibility: visible; }
          .receipt-print { position: absolute; inset: 0; margin: 0; }
        }
      `}</style>
    </div>
  );
}