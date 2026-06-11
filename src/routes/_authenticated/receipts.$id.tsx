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
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h2 className="text-2xl font-bold">سند تحصيل نقدي</h2>
          <p className="text-sm mt-1">RECEIPT VOUCHER</p>
        </div>
        <div className="flex justify-between text-sm mb-4">
          <div>رقم السند: <span className="font-mono font-bold">{data.receipt_number}</span></div>
          <div>التاريخ: <span dir="ltr" className="font-mono">{data.receipt_date}</span></div>
        </div>

        <table className="w-full text-sm mb-4">
          <tbody>
            <tr><td className="py-2 w-32 font-semibold">استلمنا من السيد:</td><td className="py-2 border-b border-dashed">{data.customers?.name}</td></tr>
            <tr><td className="py-2 font-semibold">مبلغ وقدره:</td><td className="py-2 border-b border-dashed font-mono font-bold text-lg">{formatMoney(data.amount)}</td></tr>
            <tr><td className="py-2 font-semibold">فقط لا غير:</td><td className="py-2 border-b border-dashed">{tafqeet(Number(data.amount))}</td></tr>
            <tr><td className="py-2 font-semibold">طريقة الدفع:</td><td className="py-2 border-b border-dashed">{data.method || "—"}</td></tr>
            <tr><td className="py-2 font-semibold">المرجع:</td><td className="py-2 border-b border-dashed" dir="ltr">{data.reference || "—"}</td></tr>
            <tr><td className="py-2 font-semibold align-top">وذلك عن:</td><td className="py-2 border-b border-dashed">{data.notes || "تحصيل على الحساب"}</td></tr>
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-8 mt-12 text-sm text-center">
          <div>
            <div className="border-t border-black pt-2">توقيع المستلم</div>
          </div>
          <div>
            <div className="border-t border-black pt-2">توقيع الدافع</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A5; margin: 10mm; }
          body * { visibility: hidden; }
          .receipt-print, .receipt-print * { visibility: visible; }
          .receipt-print { position: absolute; inset: 0; margin: 0; }
        }
      `}</style>
    </div>
  );
}