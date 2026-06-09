import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPaymentReceipt } from "@/lib/invoices/invoices.functions";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { tafqeet } from "@/lib/invoices/tafqeet";
import oplusLogo from "@/assets/oplus-logo.png.asset.json";

export const Route = createFileRoute(
  "/_authenticated/invoices/$id/receipt/$paymentId",
)({
  head: () => ({ meta: [{ title: "إيصال تحصيل" }] }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { id, paymentId } = Route.useParams();
  const fn = useServerFn(getPaymentReceipt);
  const { data, isLoading } = useQuery({
    queryKey: ["payment-receipt", paymentId],
    queryFn: () => fn({ data: { payment_id: paymentId } }),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل…</div>;
  if (!data) return null;
  const p: any = data;
  const inv = p.invoices;
  const allPays: any[] = inv?.invoice_payments ?? [];
  const paidTotal = allPays.reduce((s, x) => s + Number(x.amount), 0);
  const remaining = Math.max(0, Number(inv?.total ?? 0) - paidTotal);
  const paymentTypeLabel =
    inv?.payment_type === "deferred_cash"
      ? "نقدي مؤجل"
      : inv?.payment_type === "credit"
      ? "آجل"
      : "نقدي";
  const status =
    remaining <= 0
      ? { cls: "is-paid", label: "مدفوعة بالكامل" }
      : paidTotal > 0
      ? { cls: "is-partial", label: "مدفوعة جزئياً" }
      : { cls: "is-unpaid", label: "غير مدفوعة" };

  return (
    <div className="inv-font">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4 max-w-[210mm] mx-auto print:hidden">
        <div>
          <Link to="/invoices/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">← العودة للفاتورة</Link>
          <h1 className="text-2xl font-bold mt-1">إيصال تحصيل</h1>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 ms-1" /> طباعة / حفظ PDF
        </Button>
      </div>

      <div className="inv-sheet">
        <header className="inv-band">
          <div className="inv-band-left">
            <div className="inv-band-logo">
              <img src={oplusLogo.url} alt="Oplus Pharmaceuticals" />
            </div>
            <div>
              <div className="inv-band-name-ar">شركة أو بلس فارما للأدوية</div>
              <div className="inv-band-name-en">Oplus Pharmaceuticals</div>
              <div className="inv-band-tag">إيصال تحصيل · Payment Receipt</div>
            </div>
          </div>
          <div className="inv-band-right">
            <div className="inv-band-kicker">RECEIPT · إيصال قبض</div>
            <div className="inv-band-num" dir="ltr">{(p.id ?? "").slice(0, 8).toUpperCase()}</div>
            <div className="inv-band-date">
              <span>تاريخ التحصيل</span>
              <b dir="ltr">{p.payment_date}</b>
            </div>
            <div className="inv-band-date">
              <span>الفاتورة</span>
              <b dir="ltr">{inv?.invoice_number}</b>
            </div>
            <div className={`inv-band-status ${status.cls}`}>
              <span className="dot" />
              {status.label}
            </div>
          </div>
        </header>

        <section className="inv-cards">
          <article className="inv-card">
            <h5>العميل</h5>
            <div className="row"><span>الاسم</span><b>{inv?.customers?.name ?? "—"}</b></div>
            <div className="row"><span>الهاتف</span><b dir="ltr">{inv?.customers?.phone ?? "—"}</b></div>
          </article>
          <article className="inv-card">
            <h5>تفاصيل الدفع</h5>
            <div className="row"><span>نوع الدفع</span><b>{paymentTypeLabel}</b></div>
            <div className="row"><span>طريقة التحصيل</span><b>{p.method || "—"}</b></div>
            <div className="row"><span>المرجع / السند</span><b dir="ltr">{p.reference || "—"}</b></div>
            {inv?.due_date && (
              <div className="row"><span>تاريخ الاستحقاق</span><b dir="ltr">{inv.due_date}</b></div>
            )}
          </article>
          <article className="inv-card inv-card-accent">
            <h5>الملخص</h5>
            <div className="row"><span>إجمالي الفاتورة</span><b className="mono">{formatMoney(inv?.total ?? 0)}</b></div>
            <div className="row"><span>إجمالي المدفوع</span><b className="mono">{formatMoney(paidTotal)}</b></div>
            <div className="row"><span>المتبقي</span><b className="mono">{formatMoney(remaining)}</b></div>
          </article>
        </section>

        <section className="inv-totals">
          <div className="inv-totals-tafqeet">
            <span className="lbl">تفقيط مبلغ التحصيل</span>
            <p>{tafqeet(Number(p.amount), "ريال يمني")}</p>
          </div>
          <div className="inv-totals-figures">
            <div className="row grand">
              <span>المبلغ المُحصَّل</span>
              <b className="mono">{formatMoney(p.amount)} <em>YER</em></b>
            </div>
            {p.notes && (
              <div className="row"><span>ملاحظات</span><b>{p.notes}</b></div>
            )}
          </div>
        </section>

        <div className="inv-footer">
          <div className="inv-sign">
            <div><div className="line" />المحاسب</div>
            <div><div className="line" />المستلم</div>
            <div><div className="line" />المدير</div>
          </div>
        </div>

        <div className="inv-pagefoot">
          <span>Oplus Pharmaceuticals · إيصال {(p.id ?? "").slice(0, 8).toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}