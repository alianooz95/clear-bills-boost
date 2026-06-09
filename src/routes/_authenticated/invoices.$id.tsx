import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getInvoice,
  deleteInvoice,
  convertQuotationToInvoice,
  addInvoicePayment,
  deleteInvoicePayment,
} from "@/lib/invoices/invoices.functions";
import { Button } from "@/components/ui/button";
import { Printer, Trash2, FileCheck2, Plus } from "lucide-react";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { tafqeet } from "@/lib/invoices/tafqeet";
import { toast } from "sonner";
import oplusLogo from "@/assets/oplus-logo.png.asset.json";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const convertFn = useServerFn(convertQuotationToInvoice);
  const payFn = useServerFn(addInvoicePayment);
  const delPayFn = useServerFn(deleteInvoicePayment);

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

  const convert = useMutation({
    mutationFn: () => convertFn({ data: { id } }),
    onSuccess: (res: any) => {
      toast.success(`تم إنشاء فاتورة مبيعات ${res.invoice_number}`);
      qc.invalidateQueries();
      navigate({ to: "/invoices/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground p-8 text-center">جاري التحميل…</div>;
  if (!data) return null;

  const inv: any = data;
  const items = inv.invoice_items ?? [];
  const payments: any[] = inv.invoice_payments ?? [];
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(inv.total) - paidTotal);
  const isSales = inv.invoice_type === "sales";
  const isOverdue =
    isSales && remaining > 0 && inv.due_date && new Date(inv.due_date) < new Date();
  const payStatus =
    !isSales
      ? null
      : remaining <= 0
      ? { cls: "is-paid", label: "مدفوعة بالكامل" }
      : paidTotal > 0
      ? { cls: "is-partial", label: "مدفوعة جزئياً" }
      : isOverdue
      ? { cls: "is-overdue", label: "متأخرة السداد" }
      : { cls: "is-unpaid", label: "غير مدفوعة" };
  const paymentTypeLabel =
    inv.payment_type === "deferred_cash"
      ? "نقدي مؤجل"
      : inv.payment_type === "credit"
      ? "آجل"
      : "نقدي";
  const isQuotation = inv.invoice_type === "quotation";
  const createdAt = inv.created_at ? new Date(inv.created_at) : null;
  const validUntil = isQuotation
    ? new Date(new Date(inv.invoice_date).getTime() + 7 * 86400000)
    : null;
  const ageDays = isQuotation
    ? Math.floor((Date.now() - new Date(inv.invoice_date).getTime()) / 86400000)
    : 0;
  const isExpired = isQuotation && ageDays > 7;
  const invoiceTypeLabel =
    inv.invoice_type === "sales"
      ? `فاتورة مبيعات — ${paymentTypeLabel}`
      : isQuotation
      ? `عرض سعر — Quotation ${isExpired ? "(منتهي)" : "(ساري)"}`
      : "فاتورة مرتجع / تعويضية";

  // Company / branch info (static placeholders — can be moved to settings later)
  const company = {
    nameAr: "شركة أو بلس فارما للأدوية",
    nameEn: "Oplus Pharmaceuticals",
    phone: "+967 777 000 000",
    address: "صنعاء — شارع الزبيري",
    branch: "الفرع الرئيسي",
    warehouse: "المخزن الرئيسي",
    enteredBy: "المستخدم",
    copyNo: "1",
  };

  return (
    <div className="inv-font">
      {/* Action bar (hidden on print) */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4 max-w-[210mm] mx-auto print:hidden">
        <div>
          <Link to="/invoices" className="text-sm text-muted-foreground hover:text-foreground">← العودة للفواتير</Link>
          <h1 className="text-2xl font-bold mt-1">{inv.invoice_number}</h1>
        </div>
        <div className="flex gap-2">
          {isQuotation && (
            <Button variant="default" onClick={() => convert.mutate()} disabled={convert.isPending}>
              <FileCheck2 className="h-4 w-4 ms-1" /> تحويل إلى فاتورة مبيعات
            </Button>
          )}
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

      {/* A4 Sheet */}
      <div className="inv-sheet">
        {/* Editorial brand band */}
        <header className="inv-band">
          <div className="inv-band-left">
            <div className="inv-band-logo">
              <img src={oplusLogo.url} alt="Oplus Pharmaceuticals" />
            </div>
            <div>
              <div className="inv-band-name-ar">{company.nameAr}</div>
              <div className="inv-band-name-en">{company.nameEn}</div>
              <div className="inv-band-tag">صحة أفضل · حياة أفضل · Better Health · Better Life</div>
            </div>
          </div>
          <div className="inv-band-right">
            <div className="inv-band-kicker">{isQuotation ? "QUOTATION · عرض سعر" : "INVOICE · فاتورة"}</div>
            <div className="inv-band-num" dir="ltr">{inv.invoice_number}</div>
            <div className="inv-band-date">
              <span>{isQuotation ? "تاريخ العرض" : "تاريخ الفاتورة"}</span>
              <b dir="ltr">{inv.invoice_date}</b>
            </div>
          {isSales && (
            <>
              <div className="inv-band-date">
                <span>نوع الدفع</span>
                <b>{paymentTypeLabel}</b>
              </div>
              {inv.due_date && (
                <div className="inv-band-date">
                  <span>تاريخ الاستحقاق</span>
                  <b dir="ltr">{inv.due_date}</b>
                </div>
              )}
              {payStatus && (
                <div className={`inv-band-status ${payStatus.cls}`}>
                  <span className="dot" />
                  {payStatus.label}
                </div>
              )}
            </>
          )}
          </div>
        </header>

        {/* Floating meta cards */}
        <section className="inv-cards">
          <article className="inv-card">
            <h5>الجهة المُصدِرة</h5>
            <div className="row"><span>الهاتف</span><b dir="ltr">{company.phone}</b></div>
            <div className="row"><span>العنوان</span><b>{company.address}</b></div>
            <div className="row"><span>الفرع</span><b>{company.branch}</b></div>
            <div className="row"><span>المخزن</span><b>{company.warehouse}</b></div>
          </article>
          <article className="inv-card">
            <h5>العميل</h5>
            <div className="row"><span>المطلوب من</span><b>{inv.customers?.name ?? "—"}</b></div>
            <div className="row"><span>رقم العميل</span><b dir="ltr">{(inv.customers?.id ?? "").slice(0, 8).toUpperCase()}</b></div>
            <div className="row"><span>مدخل الفاتورة</span><b>{company.enteredBy}</b></div>
            <div className="row"><span>رقم النسخة</span><b dir="ltr">{company.copyNo}</b></div>
          </article>
          <article className="inv-card inv-card-accent">
            <h5>التصنيف</h5>
            <div className="inv-type-pill">{invoiceTypeLabel}</div>
            {isQuotation && validUntil && (
              <>
                <div className="row"><span>تاريخ الإنشاء</span><b dir="ltr">{createdAt?.toISOString().slice(0, 10)}</b></div>
                <div className="row"><span>صالح حتى</span><b dir="ltr">{validUntil.toISOString().slice(0, 10)}</b></div>
                <div className="row"><span>الحالة</span><b>{isExpired ? "منتهي الصلاحية" : "ساري"}</b></div>
              </>
            )}
            <div className="row note"><span>البيان</span><b>{inv.notes || "بدون مرتجع بعد خروج البضاعة."}</b></div>
          </article>
        </section>

        {/* Items table */}
        <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th style={{ width: "8%" }}>رقم الصنف</th>
              <th style={{ width: "30%" }}>اسم الصنف</th>
              <th style={{ width: "9%" }}>الوحدة</th>
              <th style={{ width: "11%" }}>تاريخ الانتهاء</th>
              <th className="mono" style={{ width: "8%" }}>الكمية</th>
              <th className="mono" style={{ width: "8%" }}>البونص</th>
              <th className="mono" style={{ width: "12%" }}>السعر</th>
              <th className="mono" style={{ width: "14%" }}>القيمة</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, idx: number) => (
              <tr key={it.id}>
                <td className="mono">{String(idx + 1).padStart(3, "0")}</td>
                <td className="name">{it.item_name}</td>
                <td>{it.unit || "علبة"}</td>
                <td className="mono">{it.expiry_date || "—"}</td>
                <td className="mono">{it.sold_quantity}</td>
                <td className="mono">{Number(it.bonus_quantity) > 0 ? it.bonus_quantity : "—"}</td>
                <td className="mono">{formatMoney(it.unit_price)}</td>
                <td className="mono">{formatMoney(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Totals stripe */}
        <section className="inv-totals">
          <div className="inv-totals-tafqeet">
            <span className="lbl">التفقيط</span>
            <p>{tafqeet(inv.total, "ريال يمني")}</p>
          </div>
          <div className="inv-totals-figures">
            <div className="row">
              <span>الخصم</span>
              <b className="mono">{formatMoney(inv.discount_total)}</b>
            </div>
            <div className="row grand">
              <span>الإجمالي بعد الخصم</span>
              <b className="mono">{formatMoney(inv.total)} <em>YER</em></b>
            </div>
            {inv.invoice_type === "sales" && (
              <>
                <div className="row">
                  <span>المدفوع</span>
                  <b className="mono">{formatMoney(paidTotal)}</b>
                </div>
                <div className="row">
                  <span>المتبقي</span>
                  <b className="mono">{formatMoney(remaining)} <em>YER</em></b>
                </div>
                {inv.due_date && (
                  <div className="row">
                    <span>تاريخ الاستحقاق</span>
                    <b dir="ltr">{inv.due_date}</b>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Collections (sales invoices only, hidden on print) */}
        {inv.invoice_type === "sales" && (
          <PaymentsSection
            invoiceId={inv.id}
            payments={payments}
            remaining={remaining}
            onAdd={async (input) => {
              try {
                await payFn({ data: { invoice_id: inv.id, ...input } });
                toast.success("تم تسجيل التحصيل");
                qc.invalidateQueries();
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
            onDelete={async (pid) => {
              if (!confirm("حذف هذا التحصيل؟")) return;
              try {
                await delPayFn({ data: { id: pid } });
                toast.success("تم الحذف");
                qc.invalidateQueries();
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
          />
        )}

        {/* Footer block: Terms + Signatures (kept together for print) */}
        <div className="inv-footer">
          <section className="inv-terms-block">
            <h4>الشروط والأحكام</h4>
            <ol>
              {isQuotation && (
                <>
                  <li>هذا المستند عرض سعر فقط ولا يُعدّ فاتورة ضريبية ولا يُلزم بالبيع.</li>
                  <li>الأسعار سارية لمدة 7 أيام من تاريخ العرض ما لم يُذكر خلاف ذلك.</li>
                </>
              )}
              <li>أصناف الثلاجة غير قابلة للإرجاع أو الاستبدال بعد خروجها من المخزن.</li>
              <li>الالتزام بسداد القيمة بموجب سندات القبض الرسمية الصادرة من المحاسبة.</li>
              <li>أي ملاحظات على الفاتورة يجب إبلاغها خلال 24 ساعة من الاستلام.</li>
              <li>الأسعار بالريال اليمني وتشمل جميع التكاليف ما لم يُذكر خلاف ذلك.</li>
            </ol>
          </section>

          <div className="inv-sign">
            <div><div className="line" />اسم المستلم وتوقيعه</div>
            <div><div className="line" />المبيعات</div>
            <div><div className="line" />المخازن</div>
            <div><div className="line" />المحاسب</div>
          </div>
        </div>

        {/* Page footer */}
        <div className="inv-pagefoot">
          <span>Oplus Pharmaceuticals · {inv.invoice_number}</span>
        </div>
      </div>
    </div>
  );
}

function PaymentsSection({
  invoiceId,
  payments,
  remaining,
  onAdd,
  onDelete,
}: {
  invoiceId: string;
  payments: any[];
  remaining: number;
  onAdd: (input: { amount: number; payment_date: string; method?: string | null; notes?: string | null }) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>(remaining > 0 ? String(remaining) : "");
  const [pdate, setPdate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>("cash");
  const [notes, setNotes] = useState("");

  return (
    <section className="print:hidden mt-6 max-w-[210mm] mx-auto bg-card border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">التحصيلات ({payments.length})</h3>
        {remaining > 0 && (
          <Button size="sm" onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4 ms-1" /> {open ? "إلغاء" : "إضافة تحصيل"}
          </Button>
        )}
      </div>

      {open && remaining > 0 && (
        <div className="grid sm:grid-cols-2 gap-3 mb-5 p-4 rounded-lg bg-muted/40 border">
          <div className="space-y-1.5">
            <Label className="text-xs">المبلغ</Label>
            <Input dir="ltr" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">التاريخ</Label>
            <Input dir="ltr" type="date" value={pdate} onChange={(e) => setPdate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">الطريقة</Label>
            <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="نقدي / تحويل / شيك" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ملاحظات</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              onClick={() => {
                const amt = Number(amount);
                if (!amt || amt <= 0) return;
                onAdd({ amount: amt, payment_date: pdate, method, notes });
                setOpen(false);
                setAmount("");
                setNotes("");
              }}
            >
              حفظ التحصيل
            </Button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">لا توجد تحصيلات بعد.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-start py-2">التاريخ</th>
                <th className="text-start py-2">الطريقة</th>
                <th className="text-start py-2">ملاحظات</th>
                <th className="text-end py-2">المبلغ</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {payments
                .slice()
                .sort((a, b) => (a.payment_date < b.payment_date ? -1 : 1))
                .map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2" dir="ltr">{p.payment_date}</td>
                    <td className="py-2">{p.method || "—"}</td>
                    <td className="py-2 text-muted-foreground">{p.notes || "—"}</td>
                    <td className="py-2 text-end font-mono font-semibold">{formatMoney(p.amount)}</td>
                    <td className="py-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
