## 1) شاشة العميل التفصيلية (تطوير `customers.$id.tsx`)

استبدال الصفحة الحالية بصفحة بتبويبات (Tabs):

- **رأس الصفحة**: اسم العميل، بياناته، 4 بطاقات ملخص (إجمالي المبيعات، إجمالي المدفوع، إجمالي التعويضات، الرصيد الحالي)، أزرار: فاتورة جديدة + طباعة كشف الحساب.
- **تبويب الفواتير**: جدول كل فواتير العميل (رقم، تاريخ، نوع، نوع دفع، الإجمالي، المدفوع، المتبقي، الحالة، استحقاق) + روابط للفاتورة.
- **تبويب الدفعات**: كل دفعات العميل عبر كل الفواتير (تاريخ، رقم الفاتورة، المبلغ، الطريقة، المرجع، ملاحظات) + رابط لإيصال الدفع.
- **تبويب كشف الحساب**: نسخة مطورة من الكشف الحالي مع إضافة الدفعات كحركات دائنة (تأثير على الرصيد التراكمي).
- **طباعة كشف الحساب**: صفحة `/customers/$id/statement` بتصميم طباعة احترافي يعرض الحركات + الرصيد.

سيرفر فنكشن جديد: `getCustomerFullLedger` يُرجع الفواتير + الدفعات + الملخص الموحّد.

## 2) وحدة الموردين الكاملة

### قاعدة البيانات (migration واحدة)
- `suppliers` (مماثل لـ customers): name, phone, email, tax_number, balance.
- `purchase_invoices`: supplier_id, invoice_number, invoice_type (purchase/debit_note), invoice_date, payment_type (cash/deferred_cash/credit), due_date, subtotal/discount/total, notes.
- `purchase_invoice_items`: نفس بنية invoice_items.
- `purchase_payments`: supplier_id, invoice_id, amount, payment_date, method, reference, notes.
- Sequence `purchase_invoice_number_seq` + RPC `generate_purchase_invoice_number`.
- Triggers: حساب line_total، إعادة حساب إجماليات الفاتورة، تحديث رصيد المورد (مدين على المشتريات)، صرف الدفعات (FOR UPDATE locking).
- RLS + GRANTs كاملة.

### الكود
- `src/lib/suppliers/suppliers.functions.ts`: list/get/create/update/getLedger.
- `src/lib/purchases/purchases.functions.ts`: list/get/create/delete + addPayment/deletePayment.
- شاشات تحت `/_authenticated/suppliers/`:
  - `suppliers.index.tsx` — قائمة الموردين (مثل العملاء).
  - `suppliers.$id.tsx` — تفاصيل المورد بتبويبات (نفس نمط العميل).
  - `purchases.index.tsx` — قائمة فواتير الشراء.
  - `purchases.new.tsx` — إنشاء فاتورة شراء.
  - `purchases.$id.tsx` — تفاصيل فاتورة الشراء + دفعاتها.
- إضافة عناصر الشريط الجانبي: "الموردون" و"المشتريات".

### الرصيد
- فاتورة شراء = رصيد المورد + (مدين علينا).
- مردود مشتريات (debit_note) = رصيد المورد − .
- دفعة لمورد = رصيد المورد − (سددنا).
- نقدية تُسجَّل دفعة تلقائية صافية صفر.

## ملاحظات تقنية
- نفس أنماط المشروع الحالي: createServerFn + requireSupabaseAuth + RLS بـ owner_id.
- Locking مماثل لـ apply_invoice_delta لمنع تعارض الدفعات.
- نموذج إنشاء فاتورة شراء ينسخ بنية `invoices.new.tsx`.

هل أنفذ كل ذلك في خطوة واحدة، أم تفضّل أن أبدأ بشاشة العميل أولاً ثم وحدة الموردين؟