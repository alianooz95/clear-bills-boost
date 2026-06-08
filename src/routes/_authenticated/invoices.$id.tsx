import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getInvoice, deleteInvoice, convertQuotationToInvoice } from "@/lib/invoices/invoices.functions";
import { Button } from "@/components/ui/button";
import { Printer, Trash2, FileCheck2 } from "lucide-react";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { tafqeet } from "@/lib/invoices/tafqeet";
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
  const convertFn = useServerFn(convertQuotationToInvoice);

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
      ? "فاتورة مبيعات — نقدي معلق"
      : isQuotation
      ? `عرض سعر — Quotation ${isExpired ? "(منتهي)" : "(ساري)"}`
      : "فاتورة مرتجع / تعويضية";

  // Company / branch info (static placeholders — can be moved to settings later)
  const company = {
    nameAr: "محلات الأيهم والهدى للأدوية والمستلزمات الطبية",
    nameEn: "AL-Ayham and Al-huda Stores",
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
        {/* Header: company name AR | logo | company name EN */}
        <div className="inv-header">
          <div>
            <div className="name-ar">{company.nameAr}</div>
            <div className="inv-sub" style={{ textAlign: "right" }}>للأدوية والمستلزمات الطبية</div>
          </div>
          <div className="logo">A&H</div>
          <div>
            <div className="name-en">{company.nameEn}</div>
            <div className="inv-sub" style={{ textAlign: "left", direction: "ltr" }}>Pharmaceuticals &amp; Medical Supplies</div>
          </div>
        </div>

        {/* Meta grid */}
        <div className="inv-meta">
          <div><b>الهاتف:</b> <span dir="ltr">{company.phone}</span></div>
          <div><b>العنوان:</b> {company.address}</div>
          <div><b>{isQuotation ? "تاريخ العرض:" : "تاريخ الفاتورة:"}</b> <span dir="ltr">{inv.invoice_date}</span></div>
          <div><b>{isQuotation ? "رقم العرض:" : "رقم الفاتورة:"}</b> <span dir="ltr">{inv.invoice_number}</span></div>
          {isQuotation && validUntil && (
            <>
              <div><b>تاريخ الإنشاء:</b> <span dir="ltr">{createdAt?.toISOString().slice(0, 10)}</span></div>
              <div><b>صالح حتى:</b> <span dir="ltr">{validUntil.toISOString().slice(0, 10)}</span></div>
              <div><b>الحالة:</b> {isExpired ? "منتهي الصلاحية" : "ساري"}</div>
            </>
          )}
          <div><b>فرع البيع:</b> {company.branch}</div>
          <div><b>اسم المخزن:</b> {company.warehouse}</div>
          <div><b>مدخل الفاتورة:</b> {company.enteredBy}</div>
          <div><b>رقم النسخة:</b> {company.copyNo}</div>
        </div>

        {/* Invoice type banner */}
        <div className="inv-type">{invoiceTypeLabel}</div>

        {/* Customer line */}
        <div className="inv-customer">
          <div><b>المطلوب من الأخوة:</b> {inv.customers?.name ?? "—"}</div>
          <div><b>عميل رقم:</b> <span dir="ltr">{(inv.customers?.id ?? "").slice(0, 8).toUpperCase()}</span></div>
          <div className="note">
            <b>البيان:</b> {inv.notes || "بدون مرتجع بعد خروج البضاعة."}
          </div>
        </div>

        {/* Items table */}
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

        {/* Totals row */}
        <div className="inv-totals-row">
          <div><b>الخصم:</b> <span className="mono">{formatMoney(inv.discount_total)}</span></div>
          <div><b>الإجمالي بعد الخصم:</b> <span className="mono">{formatMoney(inv.total)}</span></div>
        </div>

        {/* Tafqeet */}
        <div className="inv-tafqeet">
          <b>التفقيط:</b> {tafqeet(inv.total, "ريال يمني")}
        </div>

        {/* Terms */}
        <div className="inv-terms">
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
            <li>الأسعار المذكورة بالريال اليمني وتشمل جميع التكاليف ما لم يُذكر خلاف ذلك.</li>
          </ol>
        </div>

        {/* Signatures */}
        <div className="inv-sign">
          <div><div className="line" />اسم المستلم وتوقيعه</div>
          <div><div className="line" />المبيعات</div>
          <div><div className="line" />المخازن</div>
          <div><div className="line" />المحاسب</div>
        </div>

        {/* Page footer */}
        <div className="inv-pagefoot">صفحة 1 من 1</div>
      </div>
    </div>
  );
}
