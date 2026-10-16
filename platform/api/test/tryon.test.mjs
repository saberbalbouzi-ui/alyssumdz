/* التجربة الافتراضية للزبون: تحقق الصور، الموافقة، الحصة اليومية، عدم التخزين، رد الحصة عند الفشل، المفتاح العام. */
import { makeEnv, Tally } from "./_harness.mjs";
import { tryon, checkImage, tryOnPrompt } from "../src/modules/tryon.js";
const { ok, done } = Tally();
const E = makeEnv([tryon], { providers: ["tryon"] }); const { call, adm, tenant, sql, fake, clock } = E;
const A = await tenant("A"), B = await tenant("B");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const JPG = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]).toString("base64");
let ipn = 0; const tr = (b, key, h = {}) => call("POST", "/v1/tryon", b, key, {}, h, "10.0.0." + (++ipn));
const body = { person: JPG, garment: PNG, consent: true };
ok("checkImage: يقبل PNG وJPEG", checkImage(PNG, "x") === PNG && checkImage(JPG, "x") === JPG);
ok("checkImage: يرفض نوعاً مزيفاً (ترويسة صورة ومحتوى نص)", (() => { try { checkImage("data:image/png;base64," + Buffer.from("hello world!").toString("base64"), "x"); return false; } catch (e) { return e.code === "validation_error"; } })());
ok("checkImage: يرفض svg وروابط", (() => { let n = 0; for (const s of ["data:image/svg+xml;base64,PHN2Zz4=", "https://x.com/a.png", ""]) { try { checkImage(s, "x"); } catch { n++; } } return n === 3; })());
ok("checkImage: يرفض الكبير", (() => { try { checkImage("data:image/jpeg;base64," + Buffer.alloc(1_600_000, 1).toString("base64"), "x"); return false; } catch (e) { return e.code === "image_too_large"; } })());
ok("التعليمات: تحفظ الوجه والجلد وتمنع كشفاً أكثر", /face, identity/.test(tryOnPrompt()) && /no nudity/.test(tryOnPrompt()) && /upper body/.test(tryOnPrompt("top")));
let [c, b] = await tr(body, A.key); ok("بلا تكامل مضبوط: 503", c === 503 && b.error.code === "tryon_not_configured", b);
await call("PUT", "/v1/integrations/tryon", { config: { model: "fal-ai/test/edit" }, secrets: { api_key: "fal-secret" } }, A.key);
[c, b] = await tr({ ...body, consent: false }, A.key); ok("بلا موافقة: 400", c === 400 && b.error.code === "consent_required");
[c] = await tr({ ...body, person: "x" }, A.key); ok("صورة غير صالحة: 400", c === 400);
fake.handler = (url) => url === "https://fal.run/fal-ai/test/edit" ? [200, { images: [{ url: "https://cdn.fal/out.jpg" }] }] : url === "https://cdn.fal/out.jpg" ? [200, "", {}, null, new Uint8Array([0xff, 0xd8, 1, 2, 3]).buffer] : [404, "{}"];
fake.calls.length = 0; [c, b] = await tr(body, A.key);
ok("تجربة ناجحة: صورة data URL وحصة متبقية", c === 200 && /^data:image\/jpeg;base64,/.test(b.image) && b.remaining_today === 99, [c, Object.keys(b)]);
const sub = fake.calls.find((x) => x.url.startsWith("https://fal.run")); const sent = JSON.parse(sub.init.body);
ok("الإرسال: المفتاح في الترويسة، صورتان بالترتيب شخص ثم قطعة", sub.init.headers.Authorization === "Key fal-secret" && sent.image_urls[0] === JPG && sent.image_urls[1] === PNG && /VIRTUAL TRY-ON/.test(sent.prompt));
ok("لا تُخزَّن الصور: الجدول عدّاد فقط", JSON.stringify(sql("SELECT * FROM tr_usage")).length < 80 && sql("SELECT n FROM tr_usage").n === 1);
/* فشل الخدمة يردّ الحصة */
fake.handler = () => [500, "{}"]; [c, b] = await tr(body, A.key); ok("فشل الخدمة: 502 والحصة لا تُستهلك", c === 502 && sql("SELECT n FROM tr_usage").n === 1, b);
fake.handler = () => [401, "{}"]; [c, b] = await tr(body, A.key); ok("مفتاح الخدمة مرفوض: رسالة مفهومة", c === 502 && /مفتاح/.test(b.error.message));
clock.t += 700_000; fake.handler = () => [200, { images: [] }]; [c, b] = await tr(body, A.key); ok("بلا صورة ناتجة: 502 tryon_no_image", c === 502 && b.error.code === "tryon_no_image");
/* الحصة اليومية */
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { tryon: { daily: 2 } } });
fake.handler = (url) => url.startsWith("https://fal.run") ? [200, { images: [{ url: "https://cdn.fal/o.jpg" }] }] : [200, "", {}, null, new Uint8Array([0xff, 0xd8]).buffer];
clock.t += 700_000; [c] = await tr(body, A.key); ok("الثانية ضمن الحصة", c === 200);
[c, b] = await tr(body, A.key); ok("الثالثة: 429 quota_exceeded", c === 429 && b.error.code === "quota_exceeded", b);
/* عزل المستأجرين */
[c, b] = await tr(body, B.key); ok("مستأجر آخر لم يفعّل: 503", c === 503);
/* وضع الاختبار لا يستدعي الخدمة */
const T = await tenant("T", ["*"], "test"); await call("PUT", "/v1/integrations/tryon", { config: {}, secrets: { api_key: "k" } }, T.key); fake.calls.length = 0;
[c, b] = await tr(body, T.key); ok("مفتاح اختبار: sandbox بلا استدعاء", c === 200 && b.sandbox === true && fake.calls.length === 0);
/* المفتاح العام + الأصل */
const [, pk] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["tryon:render"], mode: "pub" }); await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"], tryon: { daily: 50 } } });
clock.t += 700_000; fake.handler = (url) => url.startsWith("https://fal.run") ? [200, { images: [{ url: "https://cdn.fal/o.jpg" }] }] : [200, "", {}, null, new Uint8Array([0xff, 0xd8]).buffer];
[c, b] = await tr(body, pk.key, { origin: "https://shop.example" }); ok("مفتاح عام من أصل المتجر", c === 200);
[c] = await tr(body, pk.key, { origin: "https://evil.example" }); ok("أصل غريب 403", c === 403);
[c] = await call("GET", "/v1/carts", null, pk.key, {}, { origin: "https://shop.example" }); ok("المفتاح العام لا يصلح لغير مساره", c === 403 || c === 404);
/* حدّ الـIP: 6 كل 10 دقائق */
let last = 0; for (let i = 0; i < 8; i++) [last] = await call("POST", "/v1/tryon", body, pk.key, {}, { origin: "https://shop.example" }, "3.3.3.3"); ok("حدّ المعدّل لكل IP", last === 429);
process.exit(done());
