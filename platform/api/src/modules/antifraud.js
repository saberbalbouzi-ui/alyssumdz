import { HttpError, ok } from "../core.js";
import { hmacHex, localPhone } from "../util.js";

const REASONS = ["refused", "fake", "no_answer", "returned", "fraud"];
const DEF = { review: 30, block: 80 };
const DAY = 86400, HOUR = 3600;
/** V01-05: الإشارات المشتركة بين المستأجرين اشتراك صريح (settings.fraud.network === true)؛ الافتراضي معزول لمنع تسميم الدرجات */
export const networkOn = (t) => t?.settings?.fraud?.network === true;
const REPORT_DAILY_CAP = 200;
/** تسميات الأسباب (للعرض): يضيفها المستهلك بلغته؛ الرموز ثابتة */
export const REASON_LABEL = {
  invalid_phone: "رقم هاتف غير صالح", fake_pattern: "رقم يبدو وهمياً (أرقام متكررة)", bad_name: "اسم غير معقول", no_device: "لا بصمة جهاز (قد يكون برنامجاً آلياً)",
  repeat_phone: "الرقم نفسه طلب مراراً خلال 24 ساعة", device_many_phones: "الجهاز نفسه يستعمل أرقاماً كثيرة", ip_many_phones: "العنوان نفسه يستعمل أرقاماً كثيرة خلال ساعة",
  reported_others: "أُبلغ عنه من تجّار آخرين", reported_own: "أبلغتَ عنه سابقاً", amount_outlier: "مبلغ أكبر بكثير من المعتاد",
};

/** منطق التقييم نقي بلا قاعدة بيانات: signals → { score, level, reasons[], action } */
export function scoreOrder(s, cfg = {}) {
  const th = { ...DEF, ...cfg }, reasons = []; let score = 0;
  const add = (code, pts) => { if (pts > 0) { score += pts; reasons.push({ code, points: pts }); } };
  if (!s.phoneValid) add("invalid_phone", 60);
  else if (/^0[567](\d)\1{7}$/.test(s.phone) || /^0[567]\d{2}(\d)\1{5}$/.test(s.phone) || /01234567|12345678|87654321/.test(s.phone)) add("fake_pattern", 25);
  const nm = String(s.name ?? "").trim();
  if (nm.length < 3 || /\d/.test(nm) || /(.)\1{3,}/.test(nm) || nm.replace(/\s/g, "").length < 3 || /^[^\p{L}]+$/u.test(nm)) add("bad_name", 15);
  if (!s.deviceKnown) add("no_device", 5);
  if (s.repeatPhone24h >= 4) add("repeat_phone", 25); else if (s.repeatPhone24h >= 2) add("repeat_phone", 15);
  if (s.devicePhones24h >= 6) add("device_many_phones", 40); else if (s.devicePhones24h >= 3) add("device_many_phones", 25);
  if (s.ipPhones1h >= 4) add("ip_many_phones", 20);
  if (s.reportTenants >= 3) add("reported_others", 60); else if (s.reportTenants === 2) add("reported_others", 40); else if (s.reportTenants === 1) add("reported_others", 20);
  if (s.ownReports > 0) add("reported_own", 25);
  if (s.avgTotal > 0 && s.sampleSize >= 5 && s.total > s.avgTotal * 5) add("amount_outlier", 10);
  score = Math.min(100, score);
  const level = score >= 60 ? "high" : score >= th.review ? "medium" : "low";
  const action = score >= th.block ? "block" : score >= th.review ? "review" : "allow";
  return { score, level, action, reasons: reasons.map((r) => ({ ...r, label: REASON_LABEL[r.code] })) };
}

export const antifraud = {
  id: "antifraud",
  routes(r, ctx) {
    const { db } = ctx, H = (kind, v) => hmacHex(ctx.secret, kind + ":" + v);

    r.post("/v1/fraud/check", { scope: "fraud:check", limit: { key: "fraud", max: 240, win: 60 } }, async (req) => {
      const b = req.json(), tid = req.tenant.id, phone = localPhone(b.phone), now = ctx.nowS();
      const total = Math.max(0, Math.round(+b.total || 0)); if (total > 10_000_000) throw new HttpError(400, "validation_error", "total خارج الحدود", { total: "≤ 10,000,000" });
      const dev = b.device && typeof b.device === "object" ? String(b.device.fingerprint ?? "").slice(0, 200) : "";
      const ph = phone ? await H("ph", phone) : await H("raw", String(b.phone ?? "").slice(0, 40)), dh = dev ? await H("dv", dev) : null, ih = req.ip && req.ip !== "0" ? await H("ip", req.ip) : null;
      const one = (sql, ...a) => db.val(sql, ...a), net = networkOn(req.tenant), scope = net ? "" : " AND tenant_id=?", sa = net ? [] : [tid];
      const [repeat, devPh, ipPh, repTen, own, avg] = await Promise.all([
        one("SELECT COUNT(*) FROM fr_checks WHERE tenant_id=? AND phone_h=? AND at>?", tid, ph, now - DAY),
        dh ? one("SELECT COUNT(DISTINCT phone_h) FROM fr_checks WHERE device_h=? AND at>? AND phone_h<>?" + scope, dh, now - DAY, ph, ...sa) : 0,
        ih ? one("SELECT COUNT(DISTINCT phone_h) FROM fr_checks WHERE ip_h=? AND at>? AND phone_h<>?" + scope, ih, now - HOUR, ph, ...sa) : 0,
        net ? one("SELECT COUNT(DISTINCT tenant_id) FROM fr_reports WHERE phone_h=? AND tenant_id<>?", ph, tid) : 0,
        one("SELECT COUNT(*) FROM fr_reports WHERE phone_h=? AND tenant_id=?", ph, tid),
        db.one("SELECT AVG(total) AS a, COUNT(*) AS n FROM (SELECT total FROM fr_checks WHERE tenant_id=? AND total>0 ORDER BY id DESC LIMIT 50)", tid),
      ]);
      const res = scoreOrder({ phoneValid: !!phone, phone: phone ?? "", name: b.name, deviceKnown: !!dh, repeatPhone24h: repeat, devicePhones24h: devPh, ipPhones1h: ipPh, reportTenants: repTen, ownReports: own, total, avgTotal: avg?.a ?? 0, sampleSize: avg?.n ?? 0 }, req.tenant.settings.fraud);
      if (req.mode === "live") {
        await db.run("INSERT INTO fr_checks (tenant_id,phone_h,device_h,ip_h,total,score,level,at) VALUES (?,?,?,?,?,?,?,?)", tid, ph, dh, ih, total, res.score, res.level, now);
        if (res.level === "high") await ctx.emit(tid, "fraud.high_risk", { score: res.score, reasons: res.reasons.map((x) => x.code) });
      }
      return ok({ ...res, phoneValid: !!phone, normalizedPhone: phone });
    });

    r.post("/v1/fraud/report", { scope: "fraud:report", limit: { key: "freport", max: 120, win: 60 } }, async (req) => {
      const b = req.json(), phone = localPhone(b.phone); if (!phone) throw new HttpError(422, "invalid_phone", "رقم هاتف جزائري محمول غير صالح");
      if (!REASONS.includes(b.reason)) throw new HttpError(400, "validation_error", "reason غير صالح", { reason: REASONS });
      if (req.mode !== "live") return ok({ ok: true, sandbox: true });
      const day = ctx.now().slice(0, 10);
      if ((await db.val("SELECT COUNT(*) FROM fr_reports WHERE tenant_id=? AND day=?", req.tenant.id, day)) >= REPORT_DAILY_CAP) throw new HttpError(429, "report_quota", "تجاوزتَ الحد اليومي للبلاغات");
      try { await db.run("INSERT INTO fr_reports (tenant_id,phone_h,reason,day,at) VALUES (?,?,?,?,?)", req.tenant.id, await H("ph", phone), b.reason, day, ctx.nowS()); } catch (e) { if (!/UNIQUE|constraint/i.test(String(e.message))) throw e; return ok({ ok: true, duplicate: true }); }
      return ok({ ok: true }, 201);
    });

    // استعلام مجمَّع بلا بيانات شخصية: عدد التجّار المبلِّغين فقط (لا هويات ولا أسباب لتجار آخرين)
    r.get("/v1/fraud/phone/:phone", { scope: "fraud:check" }, async (req) => {
      const phone = localPhone(decodeURIComponent(req.params.phone)); if (!phone) throw new HttpError(422, "invalid_phone", "رقم هاتف جزائري محمول غير صالح");
      const h = await H("ph", phone), tid = req.tenant.id;
      return ok({ phone, network: networkOn(req.tenant), otherTenants: !networkOn(req.tenant) ? 0 : await db.val("SELECT COUNT(DISTINCT tenant_id) FROM fr_reports WHERE phone_h=? AND tenant_id<>?", h, tid), own: await db.all("SELECT reason, COUNT(*) AS n FROM fr_reports WHERE phone_h=? AND tenant_id=? GROUP BY reason", h, tid) });
    });
    // حق الحذف للمستأجر: يسحب بلاغاته عن رقم
    r.delete("/v1/fraud/report/:phone", { scope: "fraud:report" }, async (req) => {
      const phone = localPhone(decodeURIComponent(req.params.phone)); if (!phone) throw new HttpError(422, "invalid_phone", "رقم هاتف جزائري محمول غير صالح");
      const x = await db.run("DELETE FROM fr_reports WHERE phone_h=? AND tenant_id=?", await H("ph", phone), req.tenant.id); return ok({ ok: true, removed: x.changes });
    });
    // حق المحو (القانون 18-07): يمحو كل أثر لرقم في المنصة عند طلب صاحبه
    r.post("/admin/fraud/erase", { auth: "admin" }, async (req) => {
      const phone = localPhone(req.json().phone); if (!phone) throw new HttpError(422, "invalid_phone", "رقم غير صالح"); const h = await H("ph", phone);
      const a = await db.run("DELETE FROM fr_reports WHERE phone_h=?", h), c = await db.run("DELETE FROM fr_checks WHERE phone_h=?", h);
      await ctx.audit(req.actor, "fraud.erase", null, { reports: a.changes, checks: c.changes }); return ok({ ok: true, reports: a.changes, checks: c.changes });
    });
  },
  /** احتفاظ محدود: فحوص 90 يوماً، بلاغات 365 يوماً */
  async cron(ctx) {
    const now = ctx.nowS(); const a = await ctx.db.run("DELETE FROM fr_checks WHERE at<?", now - 90 * DAY), b = await ctx.db.run("DELETE FROM fr_reports WHERE at<?", now - 365 * DAY);
    return { purgedChecks: a.changes, purgedReports: b.changes };
  },
};
