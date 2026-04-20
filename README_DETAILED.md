# Restory — README مفصّل (الواجهة + الخلفية)

وثيقة شاملة بالعربية تغطي المشروع بالكامل: البنية، التقنيات، كيفية التشغيل محلياً، بنية الواجهة، بنية الخلفية، وصف نقاط النهاية (API)، الأدوار/الصلاحيات، وصف الصفحات المهمة، وتتبّع الطلبات بالتفصيل.

---

## نظرة عامة سريعة

Restory هو نظام SaaS لإدارة مطاعم متعدد الفروع يوفّر:

- قوائم مركزية مع أسعار وتوافر مخصّص لكل فرع.
- سلة مقيّدة بحسب الفرع (branch-scoped cart) لتجنّب أخطاء التوصيل.
- دورة طلبات كاملة مع تتبّع في الوقت الحقيقي عبر WebSockets.
- لوحات إدارة ومقاييس تشغيلية (Analytics) ومستخدمين بأدوار متعددة.

المشروع يتكوّن من واجهة تفاعلية (React/TypeScript) وخلفية PHP مخصّصة تستخدم PDO/MySQL.

---

## مكوّنات المشروع (مختصر)

- Frontend: `restaurant-saas/frontend/` — React + Vite + TypeScript + Tailwind.
- Backend: `backend-ree/` — PHP (نواة بسيطة)، `index.php` كنقطة دخول وملف تعريف المسارات.
- DB: `backend-ree/database/schema.sql` — مخطّط الجداول.
- Uploads: `backend-ree/uploads/` — ملفات الصور والشعارات.

---

## بنية المجلدات (مهم للمطوّر)

- restaurant-saas/
  - frontend/
    - src/ (components, pages, hooks, api)
    - public/
    - package.json, vite.config.ts, tailwind.config.js
- backend-ree/
  - controllers/ (OrderController.php, ProductController.php, AuthController.php, ...)
  - core/ (Router.php, Database.php, RequestResponse.php, Auth.php)
  - config/ (app.php, database.php)
  - database/schema.sql
  - uploads/

---

## الأدوار (Roles) والصفحات/الصلاحيات لكل دور

النظام يدعم الأدوار الأساسية التالية مع وصف موجز للصفحات والقدرات:

- Super Admin
  - قدرات: حق الوصول الكامل إلى كل شيء عبر كل المطاعم والفروع.
  - صفحات: لوحة تحكّم عامة، إدارة المستخدمين، إعدادات النظام، مراقبة الاشتراكات.

- Owner
  - قدرات: إدارة مطعم/علامة تجارية، إعداد الفروع، إدارة القوائم، رؤية تقارير المطعم.
  - صفحات: إعدادات المطعم (branding), فروع، منتجات، اشتراكات.

- Manager
  - قدرات: إدارة المنتجات، فئات، تقارير فرع محدّد، إدارة العاملين.
  - صفحات: لوحة مدير الفرع، تقارير (مبيعات، ساعات الذروة)، إدارة طواقم العمل.

- Cashier
  - قدرات: قبول الطلبات، تسجيل الدفع (checkout) للـ dine-in، تعديل حالات الطلبات إلى accepted/ready/delivered/completed.
  - صفحات: شاشة POS / طاولة الدفع، قائمة الطلبات اليومية، سجل المدفوعات.

- Chef
  - قدرات: رؤية طلبات المطبخ، تغيير الحالة إلى preparing وserved (لـ dine-in فقط)، إدارة زمن التحضير.
  - صفحات: لوحة المطبخ (kitchen view) مرتبة حسب أولوية الطلب.

- Customer (مؤمن وبمسجل)
  - قدرات: تصفّح المنيو، إضافة للعربة، الدفع، تتبّع الطلب (order tracking).
  - صفحات: المنيو، صفحة المنتج، سلة التسوّق، شاشة متابعة الطلب.

- Guest (زائر بدون تسجيل)
  - قدرات محدودة: إنشاء طلبات ضيف (guest orders)، تتبع الطلب عبر رقم الطلب.
  - قيود: معدل الطلبيات محدد (Rate limit).

ملاحظة: الصلاحيات تُطبّق على طبقة الـ API (middleware) وعلى مستوى الاستعلامات بوجود `branch_id` لكل نموذج تشغيلي.

---

## الصفحات والواجهات المهمة (Frontend)

- Landing / Menu: صفحة عامة تعرض الفروع ومنيوهاتها.
- صفحة المطعم/الفرع: تفاصيل الفرع، ساعات العمل، رسوم التوصيل.
- صفحة المنتج: تفاصيل المنتج، المتغيرات (variants) والإضافات (addons).
- سلة وحساب: عربة مقيّدة بالفرع، حساب إجمالي مع الكوبونات والخصومات.
- Checkout: اختيار طريقة الدفع، إدخال بيانات العميل، وإنشاء الطلب مع idempotency key.
- Order Tracking: صفحة عامة بالـ `order_number` تعرض حالة الطلب ومراحل التحضير.
- Dashboard (Roles المتقدّمة): صفحات Admin/Owner/Manager/Cashier/Chef مع الأدوات المخصّصة.

---

## تتبّع الطلبات (Order lifecycle & Realtime)

نموذج حالة الطلبات (status flow) يختلف بحسب النوع:

- Dine-in:
  - pending → accepted → preparing → served → completed
  - الدفع يتم عادة عبر endpoint الـ `checkout` بعد `served`.

- Delivery / Pickup:
  - pending → accepted → preparing → ready → delivered → completed

قواعد مهمة:

- كل الطلبات تبدأ بـ `pending`.
- تغيّر الحالات يقيّده الدور: الشيف لا يمكنه قبول/إكمال الدفع لكنه يغيّر حالة التحضير؛ الكاشير يتحكّم بباقي الحالات.
- عند تغيير الحالة تُسجّل طوابع زمنية (accepted_at, ready_at, served_at, delivered_at).

Real-time

- يتم بث أحداث بعد اكتمال عملية الكتابة في قاعدة البيانات (بعد commit) إلى قنوات WebSocket مثل `branch.{id}` و`order.{order_number}`.
- الواجهة تستمع لقنوات الفرع والطلب لعرض تحديثات فوريّة.
- يجب الحفاظ على حالة الحقيقة (MySQL) ومزامنتها بعد إعادة الاتصال عبر طلب REST لجلب الحالة الحالية.

Idempotency & Race conditions

- عند إنشاء طلب يُنصح بإرسال `Idempotency-Key` (جسر على مستوى واجهة العميل) لمنع التكرار عند إعادة المحاولة.

---

## API — نقاط النهاية الأساسية (ملخّص و رؤوس)

- `GET /health` — حالة الخدمة.
- `POST /auth/login` — استقبال `email`/`password`, يعيد `token`.
- `GET /auth/me` — بيانات المستخدم (Authorization: Bearer).

- Orders:
  - `POST /orders` — أنشئ طلبًا (جسم JSON مثال أسفل).
  - `GET /orders?branch_id=...` — قوائم الطلبات (role-protected).
  - `PATCH /orders/:id/status` — غيّر الحالة.
  - `PATCH /orders/:id/checkout` — تسجيل دفع dine-in.
  - `GET /orders/track/:orderNumber` — تتبع عام بنطاق الوصول العام.

رؤوس شائعة:

- `Authorization: Bearer <token>` — لجلسات المستخدمين.
- `X-Guest-ID: <uuid>` — لتعقب جلسات الزوار.
- `Content-Type: application/json`.

مثال JSON مبسّط لإنشاء طلب (`POST /orders`):

```json
{
  "branch_id": 12,
  "type": "delivery",
  "payment_method": "cash",
  "customer_name": "Ali",
  "customer_phone": "+9665xxxxxxx",
  "customer_address": "Street 123, Riyadh",
  "guest_id": "guest_abc123",
  "items": [
    { "product_id": 34, "quantity": 2, "variant_id": 5, "addon_ids": [2, 3] }
  ],
  "coupon_id": null
}
```

---

## اعتبارات الأمان وتهيئة الإنتاج

- غيّر `jwt_secret` و`encrypt_key` قبل أي نشر.
- قم بتفعيل `debug = false` في `backend-ree/config/app.php`.
- فرض CORS فقط على النطاقات المصرّح بها (`allowed_origins`).
- استخدم HTTPS وارتباطات وصول آمنة لملفات الـ uploads.

---

## ملاحظات تقنية/تنفيذية مهمة

- الـ Router بسيط ويستخدم regex لمطابقة `/:param`.
- `Request::body()` يتعامل مع JSON وform-data وPOST.
- الكود يستخدم PDO مع استعلامات مُحضّرة في معظم الحالات.
- `OrderController` يدير منطق الأسعار (variants/addons)، تطبيق كوبونات، وحماية البيانات الحساسة (تشفير أرقام الهاتف والعناوين).
- يوجد دعم اختياري لدمج OpenAI (AI Waiter) في `config/app.php` لكن المفتاح فارغ افتراضيًا.

---

## التشغيل المحلي (مختصر)

1. Backend (XAMPP أو PHP built-in):

```bash
cd c:/xampp/htdocs/backend-ree
php -S localhost:8000
```

2. إعداد قاعدة البيانات: استورد `backend-ree/database/schema.sql` وحرّر `backend-ree/config/database.php`.

3. Frontend:

```bash
cd restaurant-saas/frontend
npm install
npm run dev
```

---

## أمور حلوة ومميزات تميّز المشروع

- Branch-scoped carts لتجنّب أخطاء التوصيل.
- Persistent carts وسلوك optimistic checkout لتحسين تجربة العميل.
- تدفق أوامر متكامل مع idempotency وقيود معدل للزوار (guest rate limits).
- تسلسل حالات مرن يخدم dine-in، pickup، وdelivery بشروط صلاحيات واضحة للمستخدمين.

---

## الخطوات التالية (اقترح تنفيذها)

1. توليد ملف OpenAPI / Postman collection تلقائيًا من `index.php` لتسهيل الاختبار.
2. ترجمة هذا الملف إلى الإنجليزية.
3. تهيئة ملف `README` مختصر لكل مكوّن (`backend-ree/README.md`, `restaurant-saas/frontend/README.md`).
4. إذا ترغب، أكتب الآن مسوّدة نصية (LinkedIn) جاهزة للنسخ والنشر بناءً على هذه الوثيقة.

---

تم تحديث هذا الملف ليشمل وصف البنود المطلوبة: الواجهة، الخلفية، API، الهيكل الكامل، الأدوار، الصفحات، الأذونات، وتتبّع الطلبات.
