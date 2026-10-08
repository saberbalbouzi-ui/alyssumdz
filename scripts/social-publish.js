#!/usr/bin/env node
/* ناشر المنشورات المجدولة (يعمل في GitHub Actions كل 15 دقيقة؛ بلا مكتبات — Node 18+):
   يقرأ assets/data/social.json وينشر على فيسبوك/انستغرام كل منشور status="scheduled" وat<=الآن وvia="runner"،
   ثم يكتب النتيجة (published/failed + المعرّفات + الخطأ) في الملف نفسه ليُحفَظ بـcommit.
   الأسرار (Settings ← Secrets): META_PAGE_TOKEN (رمز صفحة طويل الأمد) + META_PAGE_ID + META_IG_ID (اختياري). لا تُكتب في المستودع أبداً.
   وضع التجربة: node scripts/social-publish.js --dry (لا يتصل بشبكة ولا يكتب). */
const fs = require("fs"), path = require("path");
const FILE = path.join(__dirname, "..", "assets", "data", "social.json"), DRY = process.argv.includes("--dry");
const V = process.env.META_API_VER || "v21.0", TOK = process.env.META_PAGE_TOKEN || "", PAGE = process.env.META_PAGE_ID || "", IG = process.env.META_IG_ID || "";
const G = "https://graph.facebook.com/" + V;
async function call(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(Object.assign({ access_token: TOK }, body)).toString() });
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error((j.error && (j.error.message || j.error.error_user_msg)) || ("HTTP " + r.status)); return j;
}
const abs = (u, d) => /^https?:/.test(u || "") ? u : (u ? "https://" + d + "/" + String(u).replace(/^\//, "") : "");
async function fb(p, d) {
  const img = abs(p.image, d);
  if (img) { const j = await call(G + "/" + PAGE + "/photos", { url: img, caption: p.text || "" }); return j.post_id || j.id; }
  const j = await call(G + "/" + PAGE + "/feed", { message: p.text || "" }); return j.id;
}
async function ig(p, d) {
  const img = abs(p.image, d); if (!img) throw new Error("انستغرام يحتاج صورة");
  const c = await call(G + "/" + IG + "/media", { image_url: img, caption: p.text || "" });
  for (let i = 0; i < 6; i++) { const r = await fetch(G + "/" + c.id + "?fields=status_code&access_token=" + encodeURIComponent(TOK)).then(x => x.json()).catch(() => ({})); if (!r.status_code || r.status_code === "FINISHED") break; if (r.status_code === "ERROR") throw new Error("فشل تجهيز الصورة"); await new Promise(z => setTimeout(z, 4000)); }
  const j = await call(G + "/" + IG + "/media_publish", { creation_id: c.id }); return j.id;
}
(async () => {
  const data = JSON.parse(fs.readFileSync(FILE, "utf8")), now = Date.now(), domain = (data.settings && data.settings.domain) || process.env.SITE_DOMAIN || "";
  const due = (data.posts || []).filter(p => p.status === "scheduled" && p.via === "runner" && new Date(p.at).getTime() <= now);
  console.log("منشورات مستحقة:", due.length); if (!due.length) return;
  let changed = false;
  for (const p of due) {
    const res = {}; let err = [];
    for (const ch of (p.channels || [])) {
      try {
        if (DRY) { res[ch] = "dry"; continue; }
        if (!TOK) throw new Error("META_PAGE_TOKEN غير مضبوط");
        if (ch === "fb") { if (p.ids && p.ids.fb) { res.fb = p.ids.fb; continue; } if (!PAGE) throw new Error("META_PAGE_ID غير مضبوط"); res.fb = await fb(p, domain); }
        if (ch === "ig") { if (!IG) throw new Error("META_IG_ID غير مضبوط"); res.ig = await ig(p, domain); }
      } catch (e) { err.push(ch + ": " + e.message); }
    }
    if (DRY) { console.log("[dry]", p.id, p.channels); continue; }
    p.ids = Object.assign(p.ids || {}, res); p.doneAt = new Date().toISOString();
    const okAll = !err.length; p.status = okAll ? "published" : (Object.keys(res).length ? "partial" : "failed"); p.error = err.join(" | "); changed = true;
    console.log(p.id, p.status, p.error || "");
  }
  if (changed) fs.writeFileSync(FILE, JSON.stringify(data, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
