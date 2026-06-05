
# نظام إدارة الفواتير وحسابات العملاء

سأبني النظام كتطبيق ويب كامل داخل مشروعك الحالي باستخدام:
- **الواجهة**: React + TanStack Start + Tailwind + shadcn/ui
- **الخادم**: Server Functions (`createServerFn`) مع middleware للمصادقة
- **قاعدة البيانات**: PostgreSQL عبر Lovable Cloud مع RLS + Triggers
- **اللغة**: TypeScript بالكامل (Clean Architecture: Routes → Services → Repository)

---

## 1) تصميم قاعدة البيانات (Database Schema)

### جدول `customers` — العملاء
| العمود | النوع | ملاحظات |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| owner_id | uuid | FK → auth.users (صاحب الحساب) |
| name | text NOT NULL | |
| phone | text | |
| email | text | |
| tax_number | text | الرقم الضريبي |
| balance | numeric(14,2) DEFAULT 0 | الرصيد الحالي (موجب = مديونية على العميل) |
| created_at, updated_at | timestamptz | |

### جدول `invoices` — الفواتير
| العمود | النوع | ملاحظات |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid | FK → auth.users |
| customer_id | uuid | FK → customers(id) |
| invoice_number | text UNIQUE | يُولّد تلقائيًا (INV-000001 / CN-000001) |
| invoice_type | enum `invoice_type` | `'sales'` أو `'credit_note'` |
| invoice_date | date NOT NULL | |
| subtotal | numeric(14,2) | مجموع الأسطر قبل الخصم |
| discount_total | numeric(14,2) | إجمالي الخصومات |
| total | numeric(14,2) | الصافي (يدخل على رصيد العميل) |
| notes | text | |
| created_at | timestamptz | |

### جدول `invoice_items` — بنود الفاتورة
| العمود | النوع | ملاحظات |
|---|---|---|
| id | uuid PK | |
| invoice_id | uuid | FK → invoices(id) ON DELETE CASCADE |
| item_name | text NOT NULL | |
| sold_quantity | numeric(12,3) NOT NULL | الكمية المباعة |
| bonus_quantity | numeric(12,3) DEFAULT 0 | البونص (لا يدخل بالحساب المالي) |
| unit_price | numeric(14,2) NOT NULL | |
| discount_amount | numeric(14,2) DEFAULT 0 | خصم نقدي على السطر |
| line_total | numeric(14,2) | محسوبة: (sold_quantity × unit_price) − discount_amount |

### العلاقات
```text
auth.users 1──< customers 1──< invoices 1──< invoice_items
```

### الفهارس
- `customers(owner_id)`, `invoices(customer_id, invoice_date)`, `invoice_items(invoice_id)`

### الأمان (RLS)
- كل جدول مفعّل عليه RLS؛ سياسات `auth.uid() = owner_id` على customers/invoices، والبنود تُربط عبر join مع invoices.
- منح صلاحيات للـ `authenticated` و `service_role` حسب قواعد المشروع.

---

## 2) المنطق البرمجي (Business Logic)

### المعادلة الأساسية للسطر (داخل DB + الواجهة)
```text
line_total      = (sold_quantity × unit_price) − discount_amount
// bonus_quantity تُسجَّل فقط، ولا تدخل في line_total
invoice.subtotal       = Σ (sold_quantity × unit_price)
invoice.discount_total = Σ discount_amount
invoice.total          = subtotal − discount_total
```

### تأثير الفاتورة على رصيد العميل
| النوع | الأثر على `customers.balance` |
|---|---|
| `sales` | `balance += invoice.total` (زيادة المديونية) |
| `credit_note` | `balance −= invoice.total` (إنقاص المديونية / تعويض) |

### تنفيذ ذلك داخل Postgres (مصدر الحقيقة)
- **Trigger `trg_invoice_items_calc`** (BEFORE INSERT/UPDATE) على `invoice_items`: يحسب `line_total` تلقائيًا ويرفض القيم السالبة.
- **Function `recalc_invoice_totals(invoice_id)`**: تعيد حساب subtotal/discount_total/total من البنود.
- **Trigger `trg_invoice_items_aiud`** (AFTER INSERT/UPDATE/DELETE) على `invoice_items`: ينادي `recalc_invoice_totals`.
- **Function `apply_invoice_to_balance()`** + **Trigger `trg_invoice_balance`** على `invoices` (AFTER INSERT/UPDATE/DELETE):
  - عند INSERT: يضيف/يخصم `total` على رصيد العميل حسب النوع.
  - عند UPDATE للـ total/type/customer_id: يعكس الأثر القديم ويطبّق الجديد.
  - عند DELETE: يعكس الأثر.
- **Function `generate_invoice_number(type)`**: تُولّد رقمًا تسلسليًا (`INV-` أو `CN-`) عبر sequence لكل owner.

### طبقة الخدمات في الـ Backend (TypeScript — Clean Architecture)
```
src/lib/customers/
  customers.functions.ts   // serverFn: list/create/update/get + getLedger
  customers.service.ts     // قواعد الأعمال (validation, حدود)
  customers.repo.ts        // وصول DB (supabase queries)
src/lib/invoices/
  invoices.functions.ts    // serverFn: create/list/get/void
  invoices.service.ts      // بناء الفاتورة + التحقق من النوع والبنود
  invoices.repo.ts
  invoice-math.ts          // pure functions: computeLineTotal, computeInvoiceTotals
```
- جميع الـ serverFn محمية بـ `requireSupabaseAuth`.
- التحقق من المدخلات بـ Zod (أطوال، أرقام موجبة، خصم ≤ subtotal للسطر…).

---

## 3) واجهات البرمجة (Server Functions / REST-like)

تُستدعى من الواجهة عبر `useServerFn` + React Query.

### العملاء
- `listCustomers({ search?, page?, pageSize? })`
- `createCustomer({ name, phone?, email?, tax_number? })`
- `updateCustomer({ id, ... })`
- `getCustomer({ id })`
- `getCustomerLedger({ customerId, from?, to? })`
  - يُرجع: بيانات العميل + جميع الفواتير (مبيعات وتعويضية) مرتبة زمنياً + الأعمدة: التاريخ، الرقم، النوع، المدين، الدائن، الرصيد التراكمي، وفي الأسفل: إجمالي المبيعات، إجمالي التعويضات/المدفوعات، الرصيد الحالي.

### الفواتير
- `createInvoice({ customer_id, invoice_type, invoice_date, notes?, items: [{ item_name, sold_quantity, bonus_quantity, unit_price, discount_amount }] })`
  - يبني الفاتورة + البنود في معاملة واحدة، الـ triggers تتولى الحسابات والرصيد.
- `listInvoices({ customer_id?, type?, from?, to? })`
- `getInvoice({ id })` (مع البنود)
- `voidInvoice({ id })` (حذف منطقي يعكس الأثر على الرصيد)

### Webhook عام (اختياري لاحقًا)
- `POST /api/public/print/:invoiceId` لتوليد نسخة طباعة (PDF/HTML) — خارج هذه المرحلة.

---

## 4) واجهة المستخدم (Minimum Viable UI)

- **/customers**: قائمة + بحث + زر "عميل جديد".
- **/customers/$id**: ملف العميل + كشف الحساب (Ledger) + زر "فاتورة جديدة".
- **/invoices/new**: نموذج فاتورة (اختيار النوع: مبيعات/تعويضية، اختيار العميل، جدول بنود ديناميكي يعرض الإجمالي لحظيًا، البونص يُعرض لكن لا يُضاف للإجمالي).
- **/invoices/$id**: عرض الفاتورة بتنسيق قابل للطباعة (يُظهر عمود البونص).
- **/auth**: تسجيل دخول (Email/Password عبر Lovable Cloud).

التصميم يعتمد design tokens الحالية في `src/styles.css` فقط (لا ألوان مباشرة في المكونات).

---

## 5) خطة التنفيذ المرحلية

1. تفعيل **Lovable Cloud** + إنشاء enum وجداول customers/invoices/invoice_items + RLS + Grants.
2. كتابة الـ Functions/Triggers (line_total، recalc، apply_to_balance، generate_invoice_number).
3. طبقة Repo/Service/serverFn للعملاء، ثم للفواتير، مع invoice-math نقي + اختبارات بسيطة للحسابات.
4. شاشات: Auth → Customers list/detail → New Invoice → Invoice view (طباعة).
5. كشف حساب العميل (Ledger) مع الرصيد التراكمي.
6. تلميع + حالات الحافة (تعديل/حذف فاتورة، فاتورة تعويضية > الرصيد، صلاحيات).

---

### نقاط أحتاج تأكيدها قبل البدء بالتنفيذ
1. **المصادقة**: هل تكفي تسجيل دخول بـ Email/Password (مستخدم واحد = صاحب المتجر، وكل بياناته خاصة به)، أم تريد دعم عدة مستخدمين/أدوار (admin/cashier)؟
2. **الضرائب (VAT)**: تجاهلها تمامًا في هذه المرحلة، أم نضيف حقل `tax_rate` على السطر؟
3. **المخزون**: ذكرت أن البونص "يُخصم من المخزون لاحقًا" — هل أضيف الآن جدول `items/products` بسيط مع تتبع كميات، أم أبقي `item_name` كنص حر وأؤجل المخزون؟
4. **العملة واللغة**: واجهة عربية RTL وعملة افتراضية (SAR/EGP/AED)؟
