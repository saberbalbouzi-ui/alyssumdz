# تسليم نهائي إلى Claude — Alyssum Theme Studio (الطوران 1+2)

**التاريخ:** 2026-11-14 · **الفرع:** `feature/alyssum-theme-studio` (لا تدمج في `main` — تعليمة صريحة للطور الحالي، وتتغلّب على التفويض العام في `CLAUDE.md`)
**الحالة:** التطوير منتهٍ. المتبقّي: دفع الإيداع الجاهز + تشغيل CI. الحدود: لا ميزات جديدة، لا إعادة تصميم، لا refactoring، لا طور B، لا إضعاف للاختبارات أو الحمايات، لا كشف اعتمادات.

---

## 1. البنية والمسارات

- **المحرر (Page Builder):** مصادر `scripts/pagebuilder*.js` (~4200 سطر للمحرر) تُجمَّع آلياً عبر `python3 scripts/build-admin-pb.py` إلى `assets/js/admin-pb.js` (~2MB، مولَّد — **لا تعدّله يدوياً**) مع حقن الكتلة `<!--PB:start-->…<!--PB:end-->` في `admin.html` وختم `?v=` ببصمة SHA1. **أي تعديل = في `scripts/` ثم إعادة التوليد.**
- **مكتبة القوالب:** `assets/pages/templates/` (33 قالباً: `s-*.json` متاجر، `prod-s-*.json` صفحات منتج، `c-*.json`/`o-*.json` أقدم، `index.json` الفهرس، `thumbs/` المعاينات) + صور `assets/img/tpl/*.webp`.
- **المولدات:** `scripts/gen-template*.py` — **JSON المولَّد لا يُحرَّر يدوياً**؛ عدّل المولد وأعد التوليد.
- **التعبئة:** `scripts/make-template.py --target php --kind physical` → `dist/qa-store` (قائمة بيضاء للمسارات؛ **لا تشمل** `assets/pages/templates/` ولا `assets/img/tpl/` — المكتبة رقعة تُنسخ فوق الحزمة). تحتاج `php` في PATH لخطوة lint الأخيرة.
- **الاختبارات:** `tests/free-elements-qa.js` (بطارية المحرر الحقيقية)، `scripts/test-templates.js` (سلامة المكتبة)، بقية `scripts/test-*.js` (منطق المنصة)، CI في `.github/workflows/tests.yml`.
- **التوثيق الحاكم:** `docs/THEMES-FREE-ELEMENTS-FUNCTIONAL-REPORT.md` (تقرير القبول الكامل)، `docs/THEMES-AUDIT.md`، `docs/THEMES-ROADMAP.md`، `docs/THEMES-IMPLEMENTATION.md`، `docs/PLATFORM-DEFECT-PHP-FILE-ALLOWLIST.md` (عيب `_conv`).

## 2. ما أُنجز

**الطور 1:** القوالب الستة (`s-perfume, s-skincare, s-makeup, s-women, s-men, s-kids`) + قوالب منتجاتها `prod-s-*` + 50 صورة webp (فحص بصري لكل صورة: بلا علامات مائية/نصوص مدمجة، والتزام كامل بسياسة المحتوى: لا امرأة بلا خمار ولا عاري غير الوجه واليدين) + معاينات + خطوة `test-templates.js` في CI + رفع `VERSION`.

**الطور 2:** بطارية قبول وظيفي حقيقية (Playwright يقود `admin.html` الفعلية — لا اختبارات بنى معزولة) على القوالب الستة: **235/235 ناجحة، 0 أخطاء JS** — مرتين: على مجلد العمل ثم على استنساخ حديث + إيداع التسليم. علة محرر حقيقية وُجدت وأُصلحت (§3).

## 3. العناصر الحرة — التنفيذ والقدرات

- **FREE_ONLY=true:** لا مفتاح «حر» لكل عنصر؛ التحويل على مستوى **القسم** (`button[data-q="sec-free"]` أو قائمة السياق أو أول سحب). التحديد: عنصر → ‏Escape ← عمود ← قسم ← لا شيء (الأقسام لا تُنتقى بنقرة مباشرة في هذا الوضع).
- **التدوير زاوي** حول مركز العنصر (`startRotate` = فرق `atan2`) — السحب الخطي يصفّر المحصلة؛ الاختبار يسحب قوساً 60°.
- **القدرات المُختبَرة فعلياً (لكل قالب):** تحديد بالفأرة، سحب (fx: 0→15.2)، تحجيم بمقبض d-se (fwd: 100→111.8)، تدوير 0→60°→0، تحرير نص باللوحة (blur يثبّت)، خط/لون عبر المفتّش، استبدال صور من المكتبة، تكرار/حذف، إخفاء/إظهار (`button[data-vis="hd"]`)، قفل/فك (القفل يمنع السحب فعلاً)، طبقات (يتطلب عنصرين حرّين)، تحويل قسم + تراجع، خلفية قسم تعيين/مسح، جوال، نشر، **إغلاق وإعادة فتح مع ثبات 9 خصائص** (إعادة الفتح تقرأ `_conv/home.json` من القرص — ثبات حقيقي)، واجهة متجر مكتبية وجوالة بلا تجاوز أفقي.
- **العلة المُصلَحة:** عمود مصغّرات الأقسام (`.pbx-thumbs`, `position:fixed; z-index:20; width:80px`) يظهر في FREE_ONLY المكتبي ويغطي يمين طبقة الغطاء؛ شريطا التدوير/التحريك (`.pbx-sb`) كانا يُرسمان تحته للعناصر المزاحة يميناً فتستحيل نقرتهما. الإصلاح: خصم 88px من الحد الأيمن في تموضع `.pbx-sb` (مسارا المفرد والمتعدد في `scripts/pagebuilder-editor.js`؛ ابحث عن `rg`). الدليل: قبله `rot 0→0`، بعده `rot 0→60` في الستة.
- **سلوك تصميمي (لا علة):** spacer يمرّر النقرات لخلفية القسم؛ المخفي يظهر خافتاً داخل المحرر؛ ألوان العناصر عبر المفتّش فقط.
- **المكوّنات التجارية أصيلة:** products/countdown/coupon/الأسعار/نموذج الطلب بقيت موصولة بمحرك التجارة (T20: طلب E2E بكل الحمايات — بوابة anti-copy، رمز موقّت ≥3ث، honeypot، فحص الهاتف — والطلب ظهر في لوحة المدير). لم يُمسّ الطلب/الدفع/التوصيل.

## 4. أوامر الاختبار والنتائج الفعلية

```bash
# بيئة (وصفة قابلة للتكرار):
cp /mnt/agents/audit/php81 /tmp/php81 && chmod +x /tmp/php81 && mkdir -p /tmp/phpbin && cp /tmp/php81 /tmp/phpbin/php
git clone --branch feature/alyssum-theme-studio <repo> /tmp/w && cd /tmp/w
PATH=/tmp/phpbin:$PATH python3 scripts/make-template.py --target php --kind physical --out dist/qa-store --name "متجر QA" --wa 213000000000
cp -r dist/qa-store /tmp/store && cp -r assets/pages/templates /tmp/store/assets/pages/ && cp -r assets/img/tpl /tmp/store/assets/img/
# طبّق تركيبة _conv على /tmp/store/api/index.php (السطران في §8) ثم: php -l
cd /tmp/store && nohup /tmp/php81 -S 127.0.0.1:8391 &
# ثبّت عبر POST install.php (code=رمز التثبيت المطبوع من المولد، pw/pw2، name، wa، domain فارغ)

# الاختبارات:
node scripts/test-templates.js                       # نجح: 33 قالباً، 23 مجموعة أسئلة
EQA_BASE=http://127.0.0.1:8391 EQA_STORE=/tmp/store EQA_PASS=<كلمة المرور> node tests/free-elements-qa.js
# النتيجة الفعلية (مرتين): 235/235 — 0 أخطاء JS. EQA_TPLS=s-men,s-kids للتشغيل الجزئي.
```

النتائج المدموجة: `editorqa-branch-FINAL.json` (في حزمة الأدلة `أدلة-العناصر-الحرة-2026-11-13.zip` ونسخة الفرع: `/tmp/eqa-branch-out/`). **لا تُبلِّغ عن اختبار لم يُنفَّذ.**

## 5. الإيداعات وحالة الفرع

| SHA | ماذا | أين |
|---|---|---|
| `79f1a0e` | `docs/THEMES-FREE-ELEMENTS-FUNCTIONAL-REPORT.md` | على origin ✅ |
| `a62a6bf` | `tests/free-elements-qa.js` (v3.1) — **رأس origin الحالي** | على origin ✅ |
| إيداع التسليم = **`git log -1` بعد تطبيق الحزمة** (آخر SHA موثَّق قبل إضافة هذا الملف: `f302820…`) | 120 ملفاً (74 مُضاف: الصور/القوالب/المعاينات/هذا الملف · 45 معدَّل: الملفات الثلاثة + CI + VERSION + مولدات + بطارية v3.3 + التقرير · محذوف: `_probe256.bin`) — تحقق منه بـ `git bundle verify` الذي يطبع SHA الرأس | **محلي — بانتظار الدفع** |

## 6. غير المدفوع / المفقود

- **كل شيء مودَع محلياً؛ لا ملفات غير مودَعة.** الفجوة الوحيدة: إيداع التسليم `f302820` لم يُدفع بعد (مانع §7). قائمته: `git show --name-status HEAD` بعد تطبيق الحزمة.
- ملفات `saas/landing/*/gal/*.webp` (9) موجودة على origin ومفقودة من مجلد العمل المحلي — **origin هو المرجع**، لا تحذفها.
- حزمة الدفع الجاهزة: `/mnt/agents/output/alyssum-phase2-delivery.bundle` (تزايدية على `a62a6bf`، مُتحقَّقة بـ `git bundle verify`) + التعليمات في `/mnt/agents/output/تعليمات-الدفع-والتسليم-2026-11-14.md`.

## 7. الموانع والصلاحيات المطلوبة

1. **PAT بنطاقَي `repo` + `workflow`** (أو fine-grained: Contents R/W + Workflows R/W على `alyssumdz`) — البيئة لا تحوي أي اعتماد؛ MCP Contents API لا يقبل >1MB ولا الثنائيات. الرمز يُستخدم في ذاكرة git فقط ولا يُكتب في أي ملف/سجل/تقرير.
2. بعد الدفع: مراقبة تشغيلة GitHub Actions (تشتغل تلقائياً عند الدفع) والإبلاغ برابطها ونتيجتها.
3. قرار الدمج في `main` لك وحدك — **ممنوع حالياً**.

## 8. عيوب المنصّة المعروفة

- **`_conv` allowlist (PHP):** `allowedPath()` في `api/index.php` المولَّد يرفض `assets/pages/_conv/<key>.json` (مصدر التحرير) و`*.orig.html` (نسخة الاسترجاع) بـ 400 — عيب سابق لمكتبة القوالب، **مؤجَّل بقرار المالك**، موثَّق كاملاً في `docs/PLATFORM-DEFECT-PHP-FILE-ALLOWLIST.md`. التخفيف على **نسخة الاختبار فقط** (المستودع سليم) — سطرا التركيبة:
  ```php
  if (preg_match('#^assets/pages/_conv/[a-z0-9][a-z0-9-]{0,60}\.json$#', $p)) return true;        // TEST-FIXTURE
  if (preg_match('#^assets/pages/_conv/[a-z0-9][a-z0-9-]{0,60}\.orig\.html$#', $p)) return true; // TEST-FIXTURE
  ```
  يُدرجان بعد سطر `assets/img` في `allowedPath()` ثم `php -l`.
- **إصلاح المحرر** (§3) مدمج في الإيداع الجاهز. **ملاحظتا بطارية** (مُصلَحتان في v3.2/v3.3): مرِّر الصفحة الخارجية لا `scrollIntoViewIfNeeded` وحدها؛ لا تدخل القسم عبر spacer.

## 9. خطواتك الأولى للتحقق (بالترتيب)

1. **أمّن الدفع:** PAT → `cd /tmp/w && git push origin feature/alyssum-theme-studio`، أو بلا رمز: `git fetch /mnt/agents/output/alyssum-phase2-delivery.bundle HEAD:refs/heads/feature/alyssum-theme-studio && git push origin feature/alyssum-theme-studio`.
2. **استنساخ نظيف جديد** ← تحقق أن `git log -1` يطابق SHA الذي طبعته `git bundle verify` وأن `git status` نظيف.
3. **بوابة الحزمة:** `python3 scripts/build-admin-pb.py && git diff --quiet -- admin.html assets/js/admin-pb.js` → لا خروج = متطابقة بايتياً.
4. **اختبارات:** `node scripts/test-templates.js` ثم بطارية العناصر الحرة (الوصفة في §4) → توقّع **235/235**.
5. **CI:** راقب `actions` في المستودع؛ job «domain» يشمل فحص الصياغة + بوابة E-07 + اختبارات المنطق، و«ui» يشغّل المتصفح. أبلغ بالرابط والنتيجة.
6. لا تبدأ الطور B ولا تدمج في `main` إلا بتعليمة صريحة جديدة من المالك.
