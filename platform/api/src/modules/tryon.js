import { HttpError, ok } from "../core.js";

/**
 * التجربة الافتراضية للزبون على صفحة المنتج: الزبون يرفع صورته فيرى القطعة عليه.
 * تمرّ الصورتان (الشخص + القطعة) إلى خدمة الذكاء المضبوطة للمستأجر (تكامل «tryon») ولا تُخزَّن عندنا — يُسجَّل فقط عدّاد استعمال يومي (حصة) بلا أي بيانات شخصية.
 * مفتاح عام بنطاق tryon:render مقيّد بأصول الموقع، مع حدّ لكل IP وحصة يومية للمستأجر (settings.tryon.daily، الافتراضي 100)، والفشل لا يستهلك الحصة.
 */
const MAX_IMG = 1_500_000;                          // بايت لكل صورة بعد فكّ base64
const DATA_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const PARTS = { top: "upper body", bottom: "lower body", full: "full outfit / dress", auto: "whatever part of the body the garment is made for" };

export function tryOnPrompt(part) {
  return "VIRTUAL TRY-ON. Image 1 is a photo of a real person. Image 2 is a garment product photo. Dress the person from Image 1 in the garment from Image 2. "
    + "STRICT RULES: keep the person's face, identity, skin tone, hair or hijab, body shape, pose, hands and the background EXACTLY as in Image 1; only the clothing changes. Replace only the clothing area the garment covers (" + (PARTS[part] ?? PARTS.auto) + "). "
    + "Keep the garment EXACTLY as in Image 2: same cut, length, sleeves, collar, fabric, color, patterns, prints, buttons and logos — fit it naturally to the person's body with realistic drape, folds, shadows and perspective. "
    + "Do not expose any more skin than the original photo shows: no nudity, no tighter or more revealing result than the garment itself. No watermark, no added text, no borders. Output the final image at the same framing as Image 1.";
}
/** يتحقق من صورة data URL: النوع، الحجم، وبصمة الملف الحقيقية (لا نثق بالترويسة) */
export function checkImage(s, label) {
  const m = DATA_RE.exec(String(s ?? "")); if (!m) throw new HttpError(400, "validation_error", label + " يجب أن تكون صورة data URL بصيغة JPEG أو PNG أو WebP");
  const bin = atob(m[2]); if (bin.length > MAX_IMG) throw new HttpError(413, "image_too_large", label + " أكبر من 1.5MB — صغّرها قبل الإرسال");
  const b = (i) => bin.charCodeAt(i), jpeg = b(0) === 0xff && b(1) === 0xd8, png = b(0) === 0x89 && bin.slice(1, 4) === "PNG", webp = bin.slice(0, 4) === "RIFF" && bin.slice(8, 12) === "WEBP";
  if (!(jpeg || png || webp)) throw new HttpError(400, "validation_error", label + " ليست صورة صالحة");
  return m[0];
}
const b64 = (buf) => { const a = new Uint8Array(buf); let s = ""; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };

export const tryon = {
  id: "tryon", providers: ["tryon"],
  routes(r, ctx) {
    const { db } = ctx;
    r.post("/v1/tryon", { scope: "tryon:render", limit: { key: "tryon", max: 6, win: 600 }, summary: "تجربة افتراضية لقطعة على صورة الزبون (person + garment، consent:true)؛ لا تُخزَّن الصور" }, async (req) => {
      const b = req.json(); if (b.consent !== true) throw new HttpError(400, "consent_required", "الموافقة مطلوبة (consent:true) بعد إخبار الزبون أن صورته تُرسل لخدمة ذكاء لإنتاج النتيجة ولا تُحفظ");
      const person = checkImage(b.person, "صورة الشخص"), garment = checkImage(b.garment, "صورة القطعة"), part = PARTS[b.part] ? b.part : "auto";
      const integ = await ctx.integration(req.tenant.id, "tryon"); if (!integ || !integ.secrets?.api_key) throw new HttpError(503, "tryon_not_configured", "التجربة الافتراضية غير مفعّلة لهذا المتجر");
      if (req.tenant.settings.tryon?.enabled === false) throw new HttpError(503, "tryon_disabled", "التجربة الافتراضية متوقفة");
      const day = ctx.now().slice(0, 10), quota = Math.max(1, Math.floor(+(req.tenant.settings.tryon?.daily ?? 100)));
      const used = (await db.val("SELECT n FROM tr_usage WHERE tenant_id=? AND day=?", req.tenant.id, day)) ?? 0;
      if (used >= quota) throw new HttpError(429, "quota_exceeded", "استُنفدت حصة التجربة الافتراضية اليوم — حاول غداً", null, { "Retry-After": "3600" });
      if (req.mode !== "live") return ok({ sandbox: true, image: garment, remaining_today: quota - used });
      await db.run("INSERT INTO tr_usage (tenant_id,day,n) VALUES (?,?,1) ON CONFLICT(tenant_id,day) DO UPDATE SET n=n+1", req.tenant.id, day);
      const refund = () => db.run("UPDATE tr_usage SET n=MAX(0,n-1) WHERE tenant_id=? AND day=?", req.tenant.id, day);
      try {
        const model = String(integ.config?.model || "fal-ai/nano-banana/edit").replace(/^\/+|\/+$/g, ""), key = integ.secrets.api_key;
        const res = await ctx.fetchFn("https://fal.run/" + model, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Key " + key }, body: JSON.stringify({ prompt: tryOnPrompt(part), image_urls: [person, garment], num_images: 1, output_format: "jpeg" }) });
        const j = JSON.parse((await res.text()) || "{}");
        if (res.status === 401 || res.status === 403) throw new HttpError(502, "tryon_upstream", "مفتاح خدمة التجربة مرفوض — راجع إعدادات المتجر");
        if (res.status !== 200) throw new HttpError(502, "tryon_upstream", "تعذّر إنتاج الصورة (HTTP " + res.status + ")");
        const u = ((j.images ?? [])[0] ?? j.image ?? {}).url; if (!u || !/^https:\/\//.test(u)) throw new HttpError(502, "tryon_no_image", "لم تُرجع الخدمة صورة");
        const img = await ctx.fetchFn(u); if (img.status !== 200) throw new HttpError(502, "tryon_upstream", "تعذّر تنزيل الصورة الناتجة");
        return ok({ image: "data:image/jpeg;base64," + b64(await img.arrayBuffer()), remaining_today: quota - used - 1, note: "معاينة تسويقية ولا تمثل المقاس الفعلي" });
      } catch (e) { await refund(); throw e; }
    });
  },
  async cron(ctx) { const x = await ctx.db.run("DELETE FROM tr_usage WHERE day<?", new Date(ctx.nowS() * 1000 - 60 * 86400_000).toISOString().slice(0, 10)); return { purgedTryon: x.changes }; },
};
