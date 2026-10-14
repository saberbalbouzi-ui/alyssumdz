/* اختبار اتصال Meta Marketing API (قراءة فقط): يقرأ الرمز من .env أو من متغيّرات البيئة (لا يُكتب في الشيفرة ولا يُطبع).
     node scripts/meta-ads-test.js                 ← يعرض الحسابات الإعلانية (me/adaccounts)
     node scripts/meta-ads-test.js act_123456      ← + إنفاق وظهور ونقرات آخر 30 يوماً (insights) لحساب
   يلزم رمز بصلاحية ads_read. الرمز المؤقت من Graph API Explorer ينتهي خلال ساعة أو ساعتين: عند خطأ مصادقة ولّد جديداً وحدّث .env. */
const fs = require("fs"), path = require("path");

function loadEnv() {
  const f = path.join(__dirname, "..", ".env"); if (!fs.existsSync(f)) return;
  fs.readFileSync(f, "utf8").split(/\r?\n/).forEach(l => { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); });
}
loadEnv();
const TOKEN = process.env.META_ACCESS_TOKEN, VER = process.env.META_GRAPH_VERSION || "v21.0", BASE = "https://graph.facebook.com/" + VER;

async function graph(p, params) {
  const u = new URL(BASE + p); Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { Authorization: "Bearer " + TOKEN } });   // الرمز في الترويسة لا في الرابط (فلا يظهر في السجلات)
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = j.error || {}; const err = new Error((e.message || ("HTTP " + r.status)) + (e.code ? " (code " + e.code + (e.error_subcode ? "/" + e.error_subcode : "") + ")" : "")); err.code = e.code; err.status = r.status; throw err; }
  return j;
}

/* me/adaccounts ← [{id:"act_…", name, currency, account_status, amount_spent}] */
async function listAdAccounts() {
  const out = []; let j = await graph("/me/adaccounts", { fields: "id,name,account_id,currency,account_status,timezone_name,amount_spent", limit: "100" });
  out.push(...(j.data || [])); let guard = 0;
  while (j.paging && j.paging.next && guard++ < 5) { const r = await fetch(j.paging.next, { headers: { Authorization: "Bearer " + TOKEN } }); j = await r.json(); out.push(...(j.data || [])); }
  return out;
}

/* insights آخر N يوماً: إجمالي + يومي (spend, impressions, clicks) */
async function insights(actId, days) {
  const id = /^act_/.test(actId) ? actId : "act_" + actId, base = { fields: "spend,impressions,clicks,cpc,ctr,account_currency", date_preset: days === 30 ? "last_30d" : "last_7d" };
  const total = await graph("/" + id + "/insights", base);
  const daily = await graph("/" + id + "/insights", Object.assign({}, base, { time_increment: "1", limit: "100" }));
  return { total: (total.data || [])[0] || null, daily: daily.data || [] };
}

(async () => {
  if (!TOKEN) { console.error("✗ لا يوجد META_ACCESS_TOKEN: ضعه في .env (انظر .env.example)"); process.exit(2); }
  try {
    const accs = await listAdAccounts();
    console.log("✓ الاتصال ناجح — الحسابات الإعلانية (" + accs.length + "):");
    accs.forEach(a => console.log("  • " + a.id + " — " + (a.name || "") + " [" + (a.currency || "?") + "] الحالة " + a.account_status + (a.amount_spent ? " — إنفاق تراكمي " + a.amount_spent : "")));
    const want = process.argv[2] || process.env.META_AD_ACCOUNT_ID || (accs[0] && accs[0].id);
    if (!want) { console.log("لا حساب إعلاني لهذا الرمز (تأكد من صلاحية ads_read ومن ربط الحساب بالمستخدم)."); return; }
    const r = await insights(want, 30), t = r.total;
    console.log("\n— آخر 30 يوماً للحساب " + want + ":");
    if (!t) console.log("  لا بيانات إنفاق في هذه الفترة.");
    else console.log("  الإنفاق: " + t.spend + " " + (t.account_currency || "") + " · الظهور: " + t.impressions + " · النقرات: " + t.clicks + " · CPC: " + (t.cpc || "—") + " · CTR: " + (t.ctr ? Number(t.ctr).toFixed(2) + "%" : "—"));
    if (r.daily.length) { console.log("  حسب اليوم (آخر 7):"); r.daily.slice(-7).forEach(d => console.log("   " + d.date_start + "  " + d.spend + "  ظهور " + d.impressions + "  نقرات " + d.clicks)); }
  } catch (e) {
    if (e.code === 190 || e.status === 401) console.error("✗ خطأ مصادقة: الرمز منتهٍ أو غير صالح — ولّد رمزاً جديداً من Graph API Explorer وحدّث .env. (" + e.message + ")");
    else if (e.code === 200 || e.code === 10) console.error("✗ صلاحية ناقصة: يلزم ads_read (وread_insights). (" + e.message + ")");
    else console.error("✗ " + e.message);
    process.exit(1);
  }
})();
