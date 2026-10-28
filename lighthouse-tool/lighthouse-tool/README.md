# أداة تحليل السرعة (Lighthouse) لمنصتك

مجانية بالكامل: تعمل بـ Lighthouse مفتوحة المصدر على خادمك. لا تستعمل Google PageSpeed API ولا أي خدمة مدفوعة، ولا حدود استخدام من طرف ثالث.
تعطي نفس درجات PageSpeed (الأداء، إمكانية الوصول، أفضل الممارسات، SEO، التنقل الوكيلي) للجوال والحاسوب،
مع **معالج الأخطاء**: قائمة بالبنود الراسبة مرتبة بعدد النقاط التي ستستردّها، مع طريقة الإصلاح بالعربية والفرنسية والإنجليزية.

## اختر طريقة التركيب

| | الوضع المدمج `nextjs/embedded` | الخدمة المستقلة `Dockerfile` + `nextjs/proxy` |
|---|---|---|
| أين يعمل Lighthouse | داخل خادم Next.js نفسه | في حاوية Docker منفصلة |
| ما تحتاجه | خادم Node طويل العمر (VPS / Docker / Railway) وفيه Chromium | أي استضافة لمنصتك (Vercel مناسبة) + حاوية للخدمة |
| الأنسب لـ | منصة تعمل على VPS أو Docker | منصة على Vercel |

**مهم:** Vercel Serverless لا تصلح للوضع المدمج (الطابور يُفقد بين الاستدعاءات وChrome ثقيل). إن كانت منصتك على Vercel فاستعمل الخدمة المستقلة.

## الوضع المدمج (داخل منصتك)
1. في مشروع Next.js: `npm i lighthouse chrome-launcher`، وتأكد أن Chromium مثبّت على الخادم (في Docker: `apt-get install -y chromium fonts-noto-core fonts-freefont-ttf` ثم `CHROME_PATH=/usr/bin/chromium`).
2. انسخ `nextjs/embedded/app/*` إلى `app/` و `nextjs/embedded/lib/speedlab` إلى `lib/speedlab` (يفترض الاستيراد `@/lib/...`).
3. أضف `serverExternalPackages` من `next.config.snippet.ts` إلى `next.config.ts`.
4. انسخ `nextjs/shared/components/*` إلى `components/` و `nextjs/shared/public/lighthouse-report.js` إلى `public/`.
5. ضع المكوّن في أي صفحة: `<SpeedReport lang="ar" />`

متغيرات اختيارية: `SPEEDLAB_CONCURRENCY` (1)، `SPEEDLAB_RATE_PER_HOUR` (10)، `SPEEDLAB_CACHE_SECONDS` (600)، `SPEEDLAB_MAX_QUEUE` (20).

## الخدمة المستقلة (Docker)
1. `cp .env.example .env` وضع في `API_KEYS` مفتاحاً قوياً (`openssl rand -hex 32`). هذا مفتاح من صنعك أنت، ليس خدمة خارجية.
2. `docker compose up -d --build`
3. ضع Nginx أو Caddy أمامها مع HTTPS. الافتراضي أنها تستمع على `127.0.0.1:3000` فقط.
4. في منصتك: انسخ `nextjs/proxy/app/*` و `nextjs/proxy/lib/*`، وضع في البيئة `LIGHTHOUSE_API_URL` و `LIGHTHOUSE_API_KEY`، ثم انسخ `nextjs/shared/*` كما في الوضع المدمج، واستعمل `<SpeedReport />`.

نقاط الخدمة (للاختبار بـ curl):
- `POST /v1/analyze` الجسم `{"url":"https://...","devices":"both|mobile|desktop","locale":"ar","lang":"ar"}`، والترويسة `x-api-key`. أضف `?wait=120` لتنتظر النتيجة في الطلب نفسه.
- `GET /v1/analyze/:id?lang=ar` الحالة والنتيجة. `GET /v1/analyze/:id/lhr/mobile` التقرير الخام الكامل.
- `GET /health` بلا مفتاح.

## الإعدادات (مطابقة لـ PageSpeed)
جوال: Moto G Power، 4G بطيء (محاكاة)، معالج أبطأ 4 مرات. حاسوب: 1350×940، RTT 40ms، 10 Mbps.

## الأمان (لا تتجاوز هذا القسم)
- الأداة تفتح روابط يرسلها الزوار، فهي هدف لهجوم SSRF. أضفت حماية: ترفض localhost والشبكات الخاصة وعناوين بيانات السحابة (169.254.x.x) والمنافذ غير 80/443 وبيانات الدخول داخل الرابط. هذا لا يغطي إعادة التوجيه من موقع خارجي إلى عنوان داخلي، لذلك شغّل الخدمة في شبكة لا تصل إلى خدماتك الداخلية (قاعدة البيانات ولوحات الإدارة).
- في منصتك اشترط تسجيل الدخول قبل التحليل وضع حداً لكل مستخدم (انظر TODO في ملف المسار). الحدود في الأداة بالذاكرة وتُصفَّر عند إعادة التشغيل.
- كل تحليل يأخذ نحو 15-30 ثانية ونحو 500MB ذاكرة. ابدأ بتزامن 1-2 على خادم بذاكرة 2GB فأكثر.

## ما اختُبر وما لم يُختبر
اختُبر: الخدمة (المفتاح، الطابور، التخزين المؤقت، حد المعدّل، الحماية، التحليل الفعلي)، والنواة المدمجة بنفس الاختبارات، وأخطاء الصياغة في ملفات TypeScript.
لم يُختبر: بناء صورة Docker (لم يتوفر Docker فعّال في بيئة التطوير)، وتشغيل المكوّنات داخل مشروع Next.js حقيقي. جرّبها على بيئة تجريبية أولاً.

الترخيص: Lighthouse بترخيص Apache-2.0، والملف `public/lighthouse-report.js` مبني منها.
