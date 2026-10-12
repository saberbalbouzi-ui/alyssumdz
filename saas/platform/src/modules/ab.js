import { HttpError, ok } from "../core.js";
import { hmacHex, nowStr } from "../util.js";

const KEY = /^[a-z0-9][a-z0-9_-]{1,40}$/;
/** دالة التوزيع التراكمي للتوزيع الطبيعي المعياري (تقريب Abramowitz-Stegun) */
const cdf = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
/** اختبار فرق نسبتين (z) ثنائي الطرف: يُرجع { z, p } */
export function twoProportion(c1, n1, c2, n2) {
  if (n1 < 1 || n2 < 1) return { z: 0, p: 1 };
  const p1 = c1 / n1, p2 = c2 / n2, pp = (c1 + c2) / (n1 + n2), se = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2)); if (se === 0) return { z: 0, p: 1 };
  const z = (p2 - p1) / se; return { z, p: 2 * (1 - cdf(Math.abs(z))) };
}
/** نتائج: المتغيّر الأول = الشاهد. الحكم يتطلب ≥ minViews مشاهدة لكل متغيّر و p<alpha (تنبيه: لا تُوقف التجربة عند أول ظهور للدلالة) */
export function summarize(rows, { minViews = 100, alpha = 0.05 } = {}) {
  const ctrl = rows[0], out = rows.map((v) => ({ variant: v.vkey, views: v.views, conversions: v.conversions, revenue: v.revenue, rate: v.views ? +(v.conversions / v.views).toFixed(4) : 0 }));
  for (let i = 1; i < out.length; i++) { const t = twoProportion(ctrl.conversions, ctrl.views, rows[i].conversions, rows[i].views), enough = ctrl.views >= minViews && rows[i].views >= minViews;
    out[i].vs_control = { lift: out[0].rate ? +((out[i].rate - out[0].rate) / out[0].rate).toFixed(3) : null, p_value: +t.p.toFixed(4), verdict: !enough ? "insufficient_data" : t.p < alpha ? (out[i].rate > out[0].rate ? "better" : "worse") : "no_difference" }; }
  const better = out.filter((o) => o.vs_control?.verdict === "better").sort((a, b) => b.rate - a.rate)[0];
  return { variants: out, winner: better ? better.variant : null, min_views: minViews, note: "الدلالة الإحصائية لا تُعتمد قبل بلوغ الحد الأدنى للمشاهدات؛ لا توقف التجربة عند أول ظهور للدلالة." };
}

export const ab = {
  id: "ab",
  routes(r, ctx) {
    const { db } = ctx;
    const load = async (tid, key) => { const e = await db.one("SELECT * FROM ab_experiments WHERE tenant_id=? AND key=?", tid, key); if (!e) throw new HttpError(404, "not_found", "التجربة غير موجودة"); e.variants = await db.all("SELECT vkey,weight,payload FROM ab_variants WHERE exp_id=? ORDER BY ord", e.id); return e; };
    async function pick(tid, e, visitor) {   // توزيع حتمي: نفس الزائر ← نفس المتغيّر دائماً
      const total = e.variants.reduce((a, v) => a + v.weight, 0), n = parseInt((await hmacHex(ctx.secret, `ab:${tid}:${e.id}:${visitor}`)).slice(0, 12), 16) % total; let acc = 0;
      for (const v of e.variants) { acc += v.weight; if (n < acc) return v; } return e.variants[0];
    }
    r.post("/v1/ab/experiments", { scope: "ab:write", summary: "إنشاء تجربة A/B (المتغيّر الأول = الشاهد)" }, async (req) => {
      const b = req.json(), key = String(b.key ?? ""); if (!KEY.test(key)) throw new HttpError(400, "validation_error", "key: a-z 0-9 _ -", { key: "landing-hero" });
      const vs = Array.isArray(b.variants) ? b.variants : []; if (vs.length < 2 || vs.length > 6) throw new HttpError(400, "validation_error", "2 إلى 6 متغيّرات", { variants: "2..6" });
      const seen = new Set(); for (const v of vs) { if (!KEY.test(String(v.key ?? "")) || seen.has(v.key)) throw new HttpError(400, "validation_error", "مفاتيح المتغيّرات فريدة وصالحة"); seen.add(v.key); if (JSON.stringify(v.payload ?? {}).length > 20000) throw new HttpError(413, "payload_too_large", "payload كبير"); }
      let id; try { id = (await db.run("INSERT INTO ab_experiments (tenant_id,key,name,status,created_at) VALUES (?,?,?,?,?)", req.tenant.id, key, String(b.name ?? key).slice(0, 120), "draft", nowStr(ctx.clock()))).id; } catch (e) { if (/UNIQUE|constraint/i.test(String(e.message))) throw new HttpError(409, "key_taken", "المفتاح مستعمل"); throw e; }
      let i = 0; for (const v of vs) { await db.run("INSERT INTO ab_variants (exp_id,vkey,weight,payload,ord) VALUES (?,?,?,?,?)", id, v.key, Math.min(100, Math.max(1, Math.floor(+v.weight) || 1)), JSON.stringify(v.payload ?? {}), i++); await db.run("INSERT INTO ab_stats (exp_id,vkey) VALUES (?,?)", id, v.key); }
      return ok({ id, key, status: "draft" }, 201);
    });
    r.get("/v1/ab/experiments", { scope: "ab:write", summary: "التجارب" }, async (req) => ok({ experiments: await db.all("SELECT key,name,status,created_at,started_at FROM ab_experiments WHERE tenant_id=? ORDER BY id DESC", req.tenant.id) }));
    r.patch("/v1/ab/experiments/:key", { scope: "ab:write", summary: "تشغيل/إيقاف/إنهاء تجربة" }, async (req) => {
      const st = req.json().status; if (!["running", "paused", "ended"].includes(st)) throw new HttpError(400, "validation_error", "status: running|paused|ended");
      const e = await load(req.tenant.id, req.params.key); if (e.status === "ended") throw new HttpError(409, "ended", "التجربة منتهية");
      await db.run("UPDATE ab_experiments SET status=?, started_at=COALESCE(started_at, ?) WHERE id=?", st, st === "running" ? nowStr(ctx.clock()) : null, e.id); return ok({ ok: true, status: st });
    });
    r.get("/v1/ab/experiments/:key/results", { scope: "ab:write", summary: "النتائج مع اختبار الدلالة" }, async (req) => {
      const e = await load(req.tenant.id, req.params.key), st = await db.all("SELECT s.vkey, s.views, s.conversions, s.revenue FROM ab_stats s JOIN ab_variants v ON v.exp_id=s.exp_id AND v.vkey=s.vkey WHERE s.exp_id=? ORDER BY v.ord", e.id);
      return ok({ experiment: e.key, status: e.status, ...summarize(st, req.tenant.settings.ab ?? {}) });
    });
    r.post("/v1/ab/assign", { scope: "ab:assign", limit: { key: "abassign", max: 1200, win: 60 }, summary: "المتغيّر الحتمي للزائر (يُحتسب مشاهدة مرة واحدة)" }, async (req) => {
      const b = req.json(), v = String(b.visitor ?? ""); if (v.length < 8 || v.length > 80) throw new HttpError(400, "validation_error", "visitor معرّف 8-80 حرفاً", { visitor: "uuid" });
      const e = await load(req.tenant.id, String(b.experiment ?? "")), ctrl = e.variants[0];
      if (e.status !== "running") return ok({ experiment: e.key, variant: ctrl.vkey, payload: JSON.parse(ctrl.payload), active: false });
      const pickV = await pick(req.tenant.id, e, v);
      if (req.mode === "live") { const vh = await hmacHex(ctx.secret, "abv:" + v); try { await db.run("INSERT INTO ab_seen (exp_id,visitor_h,kind) VALUES (?,?,'view')", e.id, vh); await db.run("UPDATE ab_stats SET views=views+1 WHERE exp_id=? AND vkey=?", e.id, pickV.vkey); } catch (x) { if (!/UNIQUE|constraint/i.test(String(x.message))) throw x; } }
      return ok({ experiment: e.key, variant: pickV.vkey, payload: JSON.parse(pickV.payload), active: true });
    });
    r.post("/v1/ab/track", { scope: "ab:track", limit: { key: "abtrack", max: 1200, win: 60 }, summary: "تسجيل تحويل (مرة واحدة لكل زائر، بعد مشاهدة)" }, async (req) => {
      const b = req.json(), v = String(b.visitor ?? ""); if (v.length < 8 || v.length > 80) throw new HttpError(400, "validation_error", "visitor غير صالح"); if (b.event !== "conversion") throw new HttpError(400, "validation_error", "event: conversion");
      const e = await load(req.tenant.id, String(b.experiment ?? "")); if (e.status !== "running") return ok({ counted: false, reason: "not_running" });
      const vh = await hmacHex(ctx.secret, "abv:" + v); if (!(await db.one("SELECT 1 FROM ab_seen WHERE exp_id=? AND visitor_h=? AND kind='view'", e.id, vh))) return ok({ counted: false, reason: "no_view" });
      if (req.mode !== "live") return ok({ counted: false, reason: "sandbox" });
      try { await db.run("INSERT INTO ab_seen (exp_id,visitor_h,kind) VALUES (?,?,'conversion')", e.id, vh); } catch (x) { if (/UNIQUE|constraint/i.test(String(x.message))) return ok({ counted: false, reason: "duplicate" }); throw x; }
      const val = Math.min(10_000_000, Math.max(0, Math.round(+b.value || 0))), pv = await pick(req.tenant.id, e, v);
      await db.run("UPDATE ab_stats SET conversions=conversions+1, revenue=revenue+? WHERE exp_id=? AND vkey=?", val, e.id, pv.vkey); return ok({ counted: true, variant: pv.vkey });
    });
  },
};
