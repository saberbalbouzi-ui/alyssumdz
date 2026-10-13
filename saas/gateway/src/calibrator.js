import { normalize as ck, best as bestCommune } from "./commune.js";
import { normText, S } from "./status.js";
import { CredentialsError, CarrierError } from "./carriers.js";

/**
 * المعايرة عند أول ربط (نسخة JS مطابقة لـCalibrator.php): يلتقط حساب الشركة بقراءة فقط ويبني «ملف معايرة» يصحّح النظام قبل أن يعمل العميل.
 * حالة الآلة (phase/pending/…) داخل الملف نفسه فتُنفَّذ على دفعات بين طلبات قصيرة (حدّ طلبات فرعية في Workers).
 */
export const V = 1;

/** كتالوجنا مجمّعاً حسب الولاية القديمة (1–58): الولايات 59–69 تُدمج تحت أمّها لأن الشركات ما زالت تسجّلها هناك. */
export function ourGeo(geo) {
  const by = {};
  for (const w of geo.wilayas(true)) { const legacy = w.shipAs ?? w.code; (by[legacy] ??= []).push(...geo.communes(w.code)); }
  return { wilayas: () => Object.keys(by).map(Number).sort((a, b) => a - b), communes: (w) => by[w] ?? [] };
}

export async function start(ad, ours, ping = null) {
  ping ??= await ad.ping();
  const p = { v: V, carrier: ad.code, at: new Date().toISOString(), ping, phase: "geo", pending: ours.wilayas(), communes: {}, desks: {}, fees: {}, statuses: {}, status_overrides: {}, verify: {}, warnings: [], notes: [], done: false };
  if (ping.ok === false) { p.phase = "done"; p.done = true; p.warnings.push("رفضت الشركة المفاتيح: " + ping.message); }
  return p;
}

const addNotes = (p, notes) => { for (const n of notes ?? []) if (!p.notes.includes(n)) p.notes.push(n); };

function mergeGeo(p, ours, chunk, d) {
  addNotes(p, d.notes); const failed = [];
  for (const w of chunk) {
    const theirs = d.communes[w]; if (theirs === undefined) continue;                      // الشركة لا تعرض القوائم (ZR…)
    if (!theirs.length) { failed.push(w); continue; }
    const byKey = new Map(), cand = [], ids = {}; let ambig = 0;
    for (const t of theirs) { const k = ck(t.name); if (byKey.has(k)) { ambig++; continue; } byKey.set(k, t); cand.push({ id: t.id ?? k, name: String(t.name) }); if (t.id !== undefined) ids[k] = t.id; }
    const map = {}, unm = [], fuzzy = [], hit = new Set();
    for (const o of ours.communes(w)) {
      const ko = ck(o);
      if (byKey.has(ko)) { hit.add(ko); if (String(byKey.get(ko).name) !== o) map[ko] = String(byKey.get(ko).name); continue; }
      const m = bestCommune(cand, o);
      if (m) { map[ko] = String(m.name); hit.add(ck(String(m.name))); fuzzy.push([o, String(m.name), m.score]); } else unm.push(o);
    }
    const und = [];
    for (const t of theirs) if (t.deliverable === false) { und.push(String(t.name)); for (const [ko, tn] of Object.entries(map)) if (tn === String(t.name)) und.push(ko); }
    p.communes[String(w)] = { n: theirs.length, map, unmatched: unm, undeliverable: [...new Set(und)], fuzzy, ids, carrierOnly: Math.max(0, byKey.size - hit.size), ambiguous: ambig };
    if (d.desks[w]?.length) p.desks[String(w)] = d.desks[w];
  }
  if (failed.length) p._failed = [...new Set([...(p._failed ?? []), ...failed])];
}

function auditStatuses(ad, p, seen) {
  const unknown = [];
  for (const [raw, n] of Object.entries(seen)) {
    const [u, src] = ad.explainStatus(raw); p.statuses[raw] = { u, src, n };
    if (src === "unknown") unknown.push(`${raw} ×${n}`);
    else if (src === "fallback" && u !== S.UNKNOWN) p.status_overrides[normText(raw)] = u;      // تثبيت صريح لما قُدِّر بالقواعد العامة
  }
  if (unknown.length) p.warnings.push("حالات موجودة في حسابك ولا يعرفها النظام (لن تُطبَّق على الطلبات حتى تُضاف): " + unknown.slice(0, 8).join("، "));
}

/** دفعة واحدة؛ يُرجع الملف المحدَّث. */
export async function step(ad, ours, p, chunkSize = 10) {
  if (p.done) return p;
  if (p.phase === "geo") {
    const chunk = p.pending.splice(0, chunkSize);
    mergeGeo(p, ours, chunk, await ad.discover(chunk, { communes: true, desks: true }));
    if (!p.pending.length) {
      const failed = p._failed ?? []; delete p._failed;
      if (failed.length && !p.retried) { p.pending = failed; p.retried = true; }            // ولايات تعثّرت (حدّ المعدّل مثلاً): تُعاد مرة واحدة في آخر الدور
      else { if (failed.length) p.warnings.push("تعذّر جلب بلديات الولايات: " + failed.slice(0, 12).join("، ") + (failed.length > 12 ? "…" : "") + " (ستُتحقَّق بلدياتها وقت الإرسال)"); p.phase = "meta"; }
    }
    return p;
  }
  if (p.phase === "meta") {
    const d = await ad.discover([], { fees: true, statuses: true });
    p.fees = d.fees; auditStatuses(ad, p, d.statuses); p._trk = d.trackings; addNotes(p, d.notes); p.phase = "verify"; return p;
  }
  let ok = 0, fail = 0; const err = [];
  ad.withProfile(p);
  for (const t of p._trk ?? []) {
    try { await ad.track(t); ok++; }
    catch (e) { if (e instanceof CredentialsError) throw e; if (e instanceof CarrierError) { fail++; err.push(String(e.message).slice(0, 140)); } else throw e; }
  }
  delete p._trk; p.verify = { track: { ok, fail, errors: err } };
  if (fail > 0) p.warnings.push(`تعذّر تحليل ردّ التتبع لـ${fail} من ${ok + fail} طرد حقيقي (${err.slice(0, 2).join(" | ")}) — أرسل تقرير المعايرة للدعم لتصحيح المحوّل`);
  p.phase = "done"; p.done = true; p.at = new Date().toISOString(); return p;
}

export async function run(ad, ours, chunkSize = 10) {
  let p = await start(ad, ours);
  for (let i = 0; i < 400 && !p.done; i++) p = await step(ad, ours, p, chunkSize);
  return p;
}

/** ملخّص قصير للعميل (بلا قوائم ضخمة). */
export function summary(p) {
  const c = { wilayas: 0, mapped: 0, unmatched: 0, undeliverable: 0, fuzzy: 0, carrierOnly: 0 }, ex = [];
  for (const x of Object.values(p.communes ?? {})) {
    c.wilayas++; c.mapped += Object.keys(x.map).length; c.unmatched += x.unmatched.length; c.undeliverable += x.undeliverable.length; c.fuzzy += x.fuzzy.length; c.carrierOnly += x.carrierOnly ?? 0;
    for (const u of x.unmatched) if (ex.length < 8) ex.push(u);
  }
  const sts = Object.values(p.statuses ?? {}), st = { seen: sts.length, unknown: sts.filter((s) => s.src === "unknown").length, learned: Object.keys(p.status_overrides ?? {}).length };
  return { carrier: p.carrier ?? "", at: p.at ?? "", done: !!p.done, phase: p.phase ?? "", ping: p.ping ?? null, progress: { left: (p.pending ?? []).length, phase: p.phase ?? "" },
    communes: c, unmatched_examples: ex, desks: Object.values(p.desks ?? {}).reduce((a, l) => a + l.length, 0), fees: Object.keys(p.fees ?? {}).length,
    statuses: st, verify: p.verify?.track ?? null, warnings: p.warnings ?? [], notes: p.notes ?? [], webhook: p.webhook ?? null };
}
