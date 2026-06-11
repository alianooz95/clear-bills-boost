import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerFullLedger } from "@/lib/customers/customers.functions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { Printer, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/$id/statement")({
  head: () => ({ meta: [{ title: "كشف حساب" }] }),
  component: StatementPage,
});

function StatementPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getCustomerFullLedger);
  const { data, isLoading } = useQuery({
    queryKey: ["customer-full-ledger", id],
    queryFn: () => fn({ data: { customerId: id } }),
  });

  if (isLoading) return <div className="text-muted-foreground">جاري التحميل…</div>;
  if (!data) return null;

  const { customer, statement, summary } = data;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link to="/customers/$id" params={{ id: customer.id }}>
          <Button variant="ghost"><ArrowRight className="h-4 w-4 ms-1" /> رجوع</Button>
        </Link>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 ms-1" /> طباعة</Button>
      </div>

      <div className="bg-white text-black p-8 rounded-xl shadow-sm border print:border-0 print:shadow-none">
        <header className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-black">كشف حساب</h1>
              <p className="text-sm text-slate-500 mt-1">حتى تاريخ <span dir="ltr">{today}</span></p>
            </div>
            <div className="text-end">
              <div className="text-xs text-slate-500">العميل</div>
              <div className="text-lg font-bold">{customer.name}</div>
              {customer.phone && <div className="text-xs" dir="ltr">{customer.phone}</div>}
              {customer.tax_number && <div className="text-xs">ض. {customer.tax_number}</div>}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <Box label="إجمالي المبيعات" value={summary.total_sales} />
          <Box label="المدفوع" value={summary.total_paid} color="text-emerald-700" />
          <Box label="إشعارات دائنة" value={summary.total_credits} />
          <Box label="الرصيد" value={summary.balance} color="text-rose-700" bold />
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="text-start p-2 border">التاريخ</th>
              <th className="text-start p-2 border">المرجع</th>
              <th className="text-start p-2 border">البيان</th>
              <th className="text-end p-2 border">مدين</th>
              <th className="text-end p-2 border">دائن</th>
              <th className="text-end p-2 border">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {statement.length === 0 ? (
              <tr><td colSpan={6} className="text-center p-4 text-slate-500">لا توجد حركات.</td></tr>
            ) : statement.map((r: any) => (
              <tr key={r.key} className="hover:bg-slate-50">
                <td className="p-2 border" dir="ltr">{r.date}</td>
                <td className="p-2 border">{r.ref}</td>
                <td className="p-2 border">{r.desc}</td>
                <td className="p-2 border text-end font-mono">{r.debit ? formatMoney(r.debit) : "—"}</td>
                <td className="p-2 border text-end font-mono">{r.credit ? formatMoney(r.credit) : "—"}</td>
                <td className="p-2 border text-end font-mono font-bold">{formatMoney(r.running)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white font-bold">
              <td colSpan={5} className="p-3 text-end">الرصيد النهائي</td>
              <td className="p-3 text-end font-mono">{formatMoney(summary.balance)}</td>
            </tr>
          </tfoot>
        </table>

        <footer className="mt-8 pt-4 border-t text-xs text-slate-500 flex justify-between">
          <span>كشف حساب صادر بتاريخ <span dir="ltr">{today}</span></span>
          <span>المبالغ بالعملة المحلية</span>
        </footer>
      </div>
    </div>
  );
}

function Box({ label, value, color, bold }: { label: string; value: number; color?: string; bold?: boolean }) {
  return (
    <div className="border rounded-lg p-3 bg-slate-50">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono ${bold ? "text-xl font-black" : "text-lg font-semibold"} ${color || ""}`}>
        {formatMoney(value)}
      </div>
    </div>
  );
}