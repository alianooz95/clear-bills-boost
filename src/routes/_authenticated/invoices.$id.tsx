import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getInvoice, deleteInvoice } from "@/lib/invoices/invoices.functions";
import { Button } from "@/components/ui/button";
import { Printer, Trash2, FileText, Receipt, Phone, Mail, Hash, Calendar } from "lucide-react";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({ meta: [{ title: "تفاصيل الفاتورة" }] }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(getInvoice);
  const delFn = useServerFn(deleteInvoice);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => fn({ data: { id } }),
  });

  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الفاتورة");
      qc.invalidateQueries();
      navigate({ to: "/invoices" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground p-8 text-center">جاري التحميل…</div>;
  if (!data) return null;

  const inv: any = data;
  const isSales = inv.invoice_type === "sales";
  const items = inv.invoice_items ?? [];
  const totalBonus = items.reduce((s: number, it: any) => s + Number(it.bonus_quantity || 0), 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Action bar (hidden on print) */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-6 print:hidden">
        <div>
          <Link to="/invoices" className="text-sm text-muted-foreground hover:text-foreground">← العودة للفواتير</Link>
          <h1 className="text-2xl font-bold mt-1">{inv.invoice_number}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 ms-1" /> طباعة / حفظ PDF
          </Button>
          <Button variant="destructive" onClick={() => {
            if (confirm("هل أنت متأكد من حذف هذه الفاتورة؟ سيتم عكس أثرها على رصيد العميل.")) del.mutate();
          }}>
            <Trash2 className="h-4 w-4 ms-1" /> حذف
          </Button>
        </div>
      </div>

      {/* Invoice Sheet */}
      <div className="invoice-sheet">
        {!isSales && <div className="invoice-watermark">مرتجع</div>}

        {/* Header */}
        <div className="invoice-header px-8 py-10">
          <div className="relative z-10 flex justify-between items-start flex-wrap gap-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] opacity-70">Invoice System</div>
                  <div className="text-xl font-bold">نظام الفواتير والعملاء</div>
                </div>
              </div>
              <div className="mt-6 text-sm opacity-80 leading-relaxed max-w-xs">
                مستند مالي رسمي صادر إلكترونياً — يرجى الاحتفاظ به للرجوع إليه عند الحاجة.
              </div>
            </div>

            <div className="text-end relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur ring-1 ring-white/20 text-xs">
                <FileText className="h-3.5 w-3.5" />
                {isSales ? "فاتورة مبيعات" : "فاتورة تعويضية / مرتجع"}
              </div>
              <div className="mt-3 text-3xl md:text-4xl font-black tracking-tight" dir="ltr">
                {inv.invoice_number}
              </div>
              <div className="mt-2 flex items-center gap-2 justify-end text-sm opacity-80">
                <Calendar className="h-3.5 w-3.5" />
                <span dir="ltr">{inv.invoice_date}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="invoice-accent-bar" />

        {/* Customer / Meta */}
        <div className="px-8 py-6 grid md:grid-cols-2 gap-6 border-b" style={{ borderColor: "var(--invoice-line)" }}>
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ color: "var(--invoice-muted)" }}>فاتورة إلى</div>
            <Link
              to="/customers/$id"
              params={{ id: inv.customer_id }}
              className="block text-xl font-bold mt-1 hover:underline print:no-underline"
              style={{ color: "var(--invoice-ink)" }}
            >
              {inv.customers?.name}
            </Link>
            <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--invoice-muted)" }}>
              {inv.customers?.phone && (
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{inv.customers.phone}</span></div>
              )}
              {inv.customers?.email && (
                <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><span dir="ltr">{inv.customers.email}</span></div>
              )}
              {inv.customers?.tax_number && (
                <div className="flex items-center gap-2"><Hash className="h-3.5 w-3.5" />رقم ضريبي: <span dir="ltr">{inv.customers.tax_number}</span></div>
              )}
            </div>
          </div>

          <div className="md:text-end">
            <div className="text-xs uppercase tracking-wider" style={{ color: "var(--invoice-muted)" }}>ملخص سريع</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MetaPill label="عدد الأصناف" value={String(items.length)} />
              <MetaPill label="إجمالي البونص" value={String(totalBonus)} />
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="px-8 py-6 overflow-x-auto">
          <table className="invoice-table w-full border-collapse rounded-lg overflow-hidden">
            <thead>
              <tr>
                <th className="text-start">#</th>
                <th className="text-start">الصنف</th>
                <th className="text-end">الكمية</th>
                <th className="text-end">البونص</th>
                <th className="text-end">سعر الوحدة</th>
                <th className="text-end">الخصم</th>
                <th className="text-end">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, idx: number) => (
                <tr key={it.id}>
                  <td className="font-mono opacity-60">{String(idx + 1).padStart(2, "0")}</td>
                  <td className="font-medium">{it.item_name}</td>
                  <td className="text-end font-mono">{it.sold_quantity}</td>
                  <td className="text-end font-mono">
                    {Number(it.bonus_quantity) > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "color-mix(in oklab, var(--invoice-accent) 18%, transparent)", color: "var(--invoice-accent)" }}>
                        + {it.bonus_quantity}
                      </span>
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </td>
                  <td className="text-end font-mono">{formatMoney(it.unit_price)}</td>
                  <td className="text-end font-mono" style={{ color: Number(it.discount_amount) > 0 ? "var(--invoice-danger)" : undefined }}>
                    {Number(it.discount_amount) > 0 ? `- ${formatMoney(it.discount_amount)}` : "—"}
                  </td>
                  <td className="text-end font-mono font-bold">{formatMoney(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals + Notes */}
        <div className="px-8 pb-8 grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3">
            {inv.notes ? (
              <div className="invoice-totals p-5 h-full">
                <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--invoice-muted)" }}>ملاحظات</div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{inv.notes}</div>
              </div>
            ) : (
              <div className="invoice-totals p-5 h-full">
                <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--invoice-muted)" }}>شروط الدفع</div>
                <ul className="text-sm space-y-1.5" style={{ color: "var(--invoice-muted)" }}>
                  <li>• البونص مجاني ولا يدخل ضمن الحساب المالي.</li>
                  <li>• المرتجعات تُسوّى عبر فاتورة تعويضية.</li>
                  <li>• هذا المستند صالح بدون توقيع.</li>
                </ul>
              </div>
            )}
          </div>

          <div className="md:col-span-2 space-y-3">
            <div className="invoice-totals p-5 space-y-2.5 text-sm">
              <Row label="المجموع الفرعي" value={inv.subtotal} />
              <Row label="إجمالي الخصم" value={inv.discount_total} negative />
            </div>
            <div className="invoice-grand flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] opacity-70">الصافي المستحق</div>
                <div className="text-2xl font-black font-mono mt-1">{formatMoney(inv.total)}</div>
              </div>
              <div className="text-end text-xs opacity-70 leading-tight">
                {isSales ? "مدين على العميل" : "دائن للعميل"}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t flex items-center justify-between flex-wrap gap-3 text-xs"
          style={{ borderColor: "var(--invoice-line)", color: "var(--invoice-muted)", background: "var(--invoice-soft)" }}>
          <div>شكراً لتعاملكم معنا 🤝</div>
          <div className="flex items-center gap-2">
            <span>صدر بواسطة</span>
            <span className="font-semibold" style={{ color: "var(--invoice-ink)" }}>نظام الفواتير والعملاء</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: number | string; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span style={{ color: "var(--invoice-muted)" }}>{label}</span>
      <span className="font-mono font-semibold" style={{ color: negative ? "var(--invoice-danger)" : "var(--invoice-ink)" }}>
        {negative && Number(value) > 0 ? "- " : ""}{formatMoney(value as any)}
      </span>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-3 py-2 text-start" style={{ background: "var(--invoice-soft)", border: "1px solid var(--invoice-line)" }}>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--invoice-muted)" }}>{label}</div>
      <div className="text-base font-bold font-mono mt-0.5" style={{ color: "var(--invoice-ink)" }}>{value}</div>
    </div>
  );
}