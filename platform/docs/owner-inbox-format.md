# صيغة دفعة «صندوق الرسائل الخاص» (Owner Private Message Inbox)

للمالك فقط. تُعدّ الدفعة خارج المنصة (مثلاً بواسطة ChatGPT) ثم تُلصَق أو تُرفع من **WhatsApp Quick Sender ← صندوق الرسائل الخاص ← استيراد دفعة**.
الاستيراد دالة خادمية `owner_inbox_import` تتحقق من المالك ومن كل صف، تتخطّى المكرَّر، وتُرجع تقريراً. لا إرسال آلي ولا Meta API: بعد الاستيراد تظهر الرسائل بحالة `ready` وتُرسَل يدوياً.

## JSON الموحَّد (`owner-inbox/v1`)

```json
{
  "schema": "owner-inbox/v1",
  "batch": "2026-11-25-spring-eu",
  "campaign": "Spring EU",
  "messages": [
    {
      "ref": "delta-1",
      "company": "Delta Corp",
      "contact": "Sam Rivers",
      "phone": "+213550123456",
      "country": "Algeria",
      "language": "en",
      "kind": "first_contact",
      "subject": "Introduction",
      "body": "Hello Sam, ... (النص النهائي المخصَّص كاملاً)",
      "priority": 2,
      "prepared_at": "2026-11-25T09:00:00Z"
    },
    {
      "ref": "delta-2",
      "parent_ref": "delta-1",
      "company": "Delta Corp",
      "contact": "Sam Rivers",
      "phone": "+213550123456",
      "language": "en",
      "kind": "follow_up",
      "body": "Hello Sam, a short follow-up ..."
    }
  ]
}
```
يُقبل أيضاً مصفوفة رسائل مباشرة `[ {...}, {...} ]`، أو CSV بعناوين الأعمدة نفسها في الصف الأول (يُقبل `;` و`,` وTab، ونص متعدد الأسطر بين علامات اقتباس).

## الحقول

| الحقل | مطلوب | ملاحظات |
|---|---|---|
| `company` أو `contact` | واحد منهما على الأقل | الشركة / اسم الشخص المستهدف |
| `phone` | نعم | دولي: `+213550123456` أو `00213…` (أرقام فقط 8–15 بعد التطبيع). المحلي (يبدأ بصفر) يُحوَّل بدولة `country`/الافتراضية في الواجهة |
| `language` | نعم | `en` / `fr` / `ar` (تُقبل English / Français / Arabic) |
| `body` | نعم | النص النهائي (1–8000 حرف) |
| `kind` | لا (افتراضي first_contact) | `first_contact` `follow_up` `reply` `meeting` `offer` `thank_you` `closing` `other` |
| `subject` | لا | عنوان/موضوع الرسالة |
| `country` | لا | اسم الدولة |
| `campaign` | لا | تصفية الحملات (يُملأ من الجذر إن غاب) |
| `priority` | لا | 0–9، الأعلى أولاً |
| `prepared_at` | لا | تاريخ إعداد الرسالة ISO-8601 (افتراضي: وقت الاستيراد) |
| `ref` | لا | معرّف فريد للرسالة داخل صندوقك (يمنع تكرارها عند إعادة الاستيراد) |
| `parent_ref` | لا | `ref` للرسالة الأم (للمتابعات). بدونه تُربط المتابعة تلقائياً بآخر `first_contact` لنفس الرقم |
| `notes` | لا | ملاحظة داخلية |

## التكرار والتقرير
- تُتخطّى الرسالة إن وُجد لنفس الرقم نص مطابق (مع تجاهل المسافات وحالة الأحرف) أو نفس `ref`.
- التقرير: الصفوف، الجديدة، المكرَّرة، المرفوضة (مع سبب كل صف: `invalid_phone` `invalid_language` `empty_body` `company_or_contact_required`…)، والجهات الجديدة/الموجودة. الحد الأقصى 500 صف لكل طلب خادم (الواجهة تقسّم الدفعات الكبيرة، حتى 5000).

## الحالات
`ready` (Ready to Send) ← `opened` (Opened in WhatsApp) ← `sent` (Sent، بتأكيد المالك فقط مع نسخة النص المُرسَل) ← `waiting` (Waiting for Reply) / `positive` / `negative` / `followup` (Follow-up Required) / `cancelled`. فتح WhatsApp لا يعني الإرسال، و`sent` لا يعود إلى `ready/opened` ولا يُعدَّل نصه بعد الإرسال (يرفضه الخادم).

## الاستيراد المباشر (بلا نسخ ولصق)

من الصندوق: **الاستيراد المباشر (API) ← إنشاء رمز** (اسم مثل `chatgpt`). يظهر الرمز `oi_…` **مرة واحدة** (يُخزَّن منه SHA-256 فقط) وتستطيع إلغاءه فوراً. الرمز **للكتابة فقط**: يضيف رسائل بحالة `ready` ولا يقرأ ولا يعدّل ولا يحذف ولا يرسل شيئاً. سقف 5000 رسالة/24 ساعة لكل رمز، و500 صف للطلب، و10 رموز نشطة كحد أقصى.

```bash
curl -X POST "https://<project>.supabase.co/rest/v1/rpc/owner_inbox_ingest" \
  -H "apikey: <المفتاح العام للموقع>" -H "x-ingest-token: oi_…" -H "Content-Type: application/json" \
  -d '{"p_batch":"2026-11-25-spring-eu","p_rows":[ {…رسالة كما في الصيغة أعلاه…} ]}'
```
الرد تقرير: `{total, inserted, duplicates, invalid, new_contacts, existing_contacts, errors:[{row,reason}], batch}`. أخطاء الرمز: `invalid_token` (مفقود/خاطئ/ملغى)، `daily_cap_reached`، `too_many_rows`، `rows_must_be_array`.

### ربطه بإجراء Custom GPT (Actions)
1. في نافذة «الاستيراد المباشر» اضغط **نسخ مخطط OpenAPI** والصقه في Actions.
2. المصادقة: **API Key** ← **Custom** ← اسم الترويسة `x-ingest-token` ← الصق الرمز.
3. في تعليمات الـGPT: «أعدّ الرسائل بصيغة `owner-inbox/v1` (كل رسالة نصها النهائي المخصَّص كاملاً، language en/fr/ar، kind، campaign، ref فريد، parent_ref للمتابعات، phone دولي) ثم استدعِ `addInboxMessages` بدفعات ≤ 500 وأخبرني بتقرير الاستيراد. لا تُرسل شيئاً؛ الإرسال يدوي.»
