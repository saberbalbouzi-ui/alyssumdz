/* محرّك المزامنة المستمرة: اللوحة التقليدية (main، قراءة فقط) → Beta.
   حالة مرغوبة (من شجرة git عند رأس المصدر + allowlist) مقابل حالة فعلية (sync_items + بيان الواجهة الحيّ) ⇒ أحداث مرتّبة (وسائط ← صفحات ← إعدادات ← منتجات)،
   تُسجَّل في sync_events (Outbox/Event Log) ثم تُطبَّق على الوجهة وتُتحقَّق فعلياً. idempotent: لا حدث إلا لفرق حقيقي؛ إعادة التشغيل لا تكرّر شيئاً.
   الفشل لا يُفقد شيئاً: الحدث يبقى (attempts++) وتعيد الدورة التالية تخطيطه؛ والحالة المرغوبة مصدرها المستودع فلا يضيع تعديل لو غابت Beta.
   لا مزامنة عكسية: المحرّك لا يملك أي طريق كتابة إلى المصدر. حدّ ميزانية لكل تشغيل (ملفات/بايتات) لتناسب حدود Worker ثم يُكمل التشغيل التالي. */
import { classify, compOf, sha256Hex, COMPONENTS } from "./rules.js";
import { migrate, meta } from "./db.js";

const LOCK_TTL_MS = 150_000, MAX_ATTEMPTS = 8;
const iso = () => new Date().toISOString();
const isQuota = (e) => /10048|limit exceeded|free usage limit|usage limit/i.test(String(e?.message ?? e));

/** معرّف blob في git (SHA-1 لـ«blob <len>\0<bytes>») — يطابق ما تعيده شجرة git فيتّسق وضعا delta وtree */
export async function gitBlobSha(bytes) { const h = new TextEncoder().encode(`blob ${bytes.length}\0`), all = new Uint8Array(h.length + bytes.length); all.set(h); all.set(bytes, h.length); return [...new Uint8Array(await crypto.subtle.digest("SHA-1", all))].map((b) => b.toString(16).padStart(2, "0")).join(""); }

export async function runSync({ source, target, db, san, kind = "incremental", budget = {}, force = false, log = () => { }, now = Date.now }) {
  const B = { files: budget.files ?? 12, bytes: budget.bytes ?? 6_000_000, verify: budget.verify ?? 10, kvDaily: budget.kv_daily ?? 0 }, t0 = now();
  await migrate(db);
  /* ميزانية كتابات KV اليومية (الخطة المجانية: 1000 كتابة/يوم) — تُحسب كتابات الكائنات والبيان فقط (القراءة مجانية)، وتُستأنف تلقائياً بعد منتصف الليل UTC. 0 = بلا حدّ (خطة مدفوعة/اختبارات) */
  const day = new Date(now()).toISOString().slice(0, 10); if ((await meta.get(db, "kv_day")) !== day) { await meta.set(db, "kv_day", day); await meta.set(db, "kv_writes", 0); }
  await meta.set(db, "kv_cap", B.kvDaily);
  const midnight = () => { const d = new Date(now()); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 5); };
  const kq = Number(await meta.get(db, "kv_quota_until", 0)), used0 = Number(await meta.get(db, "kv_writes", 0));
  if (!force && ((kq && now() < kq) || (B.kvDaily && used0 + 1 + COMPONENTS.length > B.kvDaily))) { const until = kq && now() < kq ? kq : midnight(); return { ok: true, skipped: "kv_quota", until: new Date(until).toISOString(), kv_writes: used0 }; }
  const bo = Number(await meta.get(db, "backoff_until", 0)); if (bo && now() < bo && !force) return { ok: true, skipped: "backoff", until: new Date(bo).toISOString() };   // حدّ معدّل GitHub: لا إلحاح
  const lock = Number(await meta.get(db, "lock", 0)); if (lock && now() - lock < LOCK_TTL_MS && !force) return { ok: true, skipped: "locked" };
  await meta.set(db, "lock", now());
  const R = { ok: false, kind, head: null, prevHead: await meta.get(db, "synced_head"), planned: 0, applied: 0, failed: 0, quarantined: 0, deleted: 0, diffs: 0, pending: 0, verified: 0, notes: [], kvUsed: used0 };
  let runId = null;
  try {
    R.phase = "head"; const head = await source.head(); R.head = head;
    await meta.set(db, "head_seen", head);                                                                       // آخر رأس رُصد في المصدر (يكشف التأخر حتى لو فشل التطبيق)
    /* مسار الخمول: الرأس نفسه المطبَّق سابقاً ولا انحراف في البيان ولا عناصر فاشلة ⇒ لا شجرة ولا حصة API (الحالة المستقرة = طلب info/refs واحد في الدقيقة) */
    if (kind === "incremental" && !force && head === await meta.get(db, "synced_head")) {
      const its = await db.all("SELECT path, comp, out_sha, state FROM sync_items WHERE state<>'deleted'"), mm = {}; for (const c of COMPONENTS) mm[c] = await target.manifest(c);
      const stuck = its.some((it) => it.state === "failed" || (it.state === "applied" && mm[it.comp]?.map?.[it.path] !== it.out_sha)) || (await db.get("SELECT 1 x FROM sync_events WHERE status IN ('pending','failed','unverified') LIMIT 1"));
      if (!stuck) { R.ok = true; R.idle = true; await meta.set(db, "backoff_until", 0); return await finish(R, db, now, t0, kind, null, null); }
    }
    const last = await meta.get(db, "seen_head"); let commits = null, conflict = null;
    if (last && last !== head) {
      const c = await (source.compare?.(last, head) ?? null);
      if (c && c.status === "behind" && !force) { await meta.set(db, "last_error", `تراجع الرأس (${head.slice(0, 8)} أقدم من ${last.slice(0, 8)}): لن يُطبَّق حدث أقدم فوق أحدث`); await meta.set(db, "lock", 0); return { ...R, ok: false, error: "head-regression", skipped: "stale-head" }; }
      if (c && c.status === "diverged") { conflict = "الرأس تفرّع عن المرصود سابقاً (force-push أو إعادة كتابة تاريخ): تُطبَّق حالة الرأس الجديد كاملة"; R.notes.push(conflict); }
      commits = c?.commits ?? null;
    }
    const items = new Map((await db.all("SELECT * FROM sync_items")).map((r) => [r.path, r])), desired = new Map(); let mode = "tree";
    /* وضع delta: تغييرات الرأس الجديد عن آخر رأس مطبَّق من نقطة ويب (لا حصة API) + مسارات الأحداث المعلّقة؛ وما عداها يبقى كما في sync_items. الفشل/عدم اليقين ⇒ شجرة git. */
    const base0 = await meta.get(db, "synced_head");
    if (kind !== "full" && !force && base0 && source.delta) {
      try {
        R.phase = "delta"; const d = base0 === head ? new Map() : await source.delta(base0, head); const pend = (await db.all("SELECT DISTINCT path FROM sync_events WHERE status IN ('pending','failed','unverified')")).map((x) => x.path);
        if (d) {
          for (const [p, it] of items) if (it.state !== "deleted") { const cls = classify(p); if (cls) desired.set(p, { blob: it.src_blob, size: 0, cls }); }
          const chg = new Map(d); for (const p of pend) if (!chg.has(p)) chg.set(p, "M");
          for (const [p, st] of chg) {
            const cls = classify(p); if (!cls) continue;
            if (st === "D") { desired.delete(p); continue; }
            try { const bytes = await source.bytes(head, p); desired.set(p, { blob: await gitBlobSha(bytes), size: bytes.length, cls, bytes }); } catch (e) { if (/→ 404/.test(String(e.message))) desired.delete(p); else throw e; }
          }
          mode = "delta"; R.notes.push("delta:" + chg.size);
        }
      } catch (e) { if (e.status === 403 || e.status === 429) R.notes.push("delta-limited"); desired.clear(); mode = "tree"; }
    }
    if (mode === "tree") { R.phase = "tree"; const abo = Number(await meta.get(db, "api_backoff_until", 0)); if (abo && now() < abo && !force) { const e = new Error("شجرة git غير متاحة الآن (حدّ API مؤقت حتى " + new Date(abo).toISOString() + ")"); e.apiBackoff = true; throw e; } const tree = await source.tree(head); for (const [p, e] of tree) { const cls = classify(p); if (cls) desired.set(p, { ...e, cls }); } }
    R.mode = mode;
    const man = {}; for (const c of COMPONENTS) man[c] = await target.manifest(c);
    for (const c of COMPONENTS) if (!man[c].map) { R.error = `لا إصدار واجهة منشور للمكوّن ${c} (لا بيان للتصحيح عليه)`; return await finish(R, db, now, t0, kind, null, commits); }

    /* ── التخطيط: فروق حقيقية فقط ── */
    const plan = [];
    for (const [path, d] of desired) {
      const it = items.get(path), comp = compOf(path), live = man[comp].map[path];
      if (it && it.src_blob === d.blob && it.state === "quarantined") continue;                                   // محجور لنفس المحتوى: لا إعادة محاولة بلا تغيير
      const drift = it && it.state === "applied" && live !== it.out_sha;                                          // البيان الحيّ لا يطابق ما طُبّق (إصدار واجهة جديد/تعديل خارجي)
      if (!it || it.src_blob !== d.blob || it.state !== "applied" && it.state !== "quarantined" || drift) plan.push({ op: !it || it.state === "deleted" ? "add" : "modify", path, d, comp, why: !it ? "new" : drift ? "drift" : it.src_blob !== d.blob ? "changed" : "retry" });
    }
    for (const [path, it] of items) if (!desired.has(path) && (it.state === "applied" || it.state === "quarantined" || it.state === "failed")) plan.push({ op: "delete", path, it, comp: it.comp, d: { cls: { prio: -1 } }, why: "removed" });
    plan.sort((a, b) => (a.op === "delete") - (b.op === "delete") || a.d.cls.prio - b.d.cls.prio || (a.path < b.path ? -1 : 1));   // الحذف آخراً (لا مرجع معلّق)
    R.planned = plan.length;

    /* ── الدفعة (ميزانية) ── */
    const batch = []; let bytes = 0; for (const e of plan) { if (batch.length >= B.files) break; const sz = e.d.size ?? 0; if (batch.length && bytes + sz > B.bytes) break; batch.push(e); bytes += sz; }
    R.pending = plan.length - batch.length;
    const runRow = await db.run("INSERT INTO sync_runs (ts,kind,head,prev_head,planned) VALUES (?,?,?,?,?)", [iso(), kind, head, last, plan.length]); runId = runRow.id;
    let rev = Number(await meta.get(db, "rev", 0));
    const patch = Object.fromEntries(COMPONENTS.map((c) => [c, { set: {}, del: [] }])), done = [];
    let quotaStop = false;
    const hitQuota = async (why) => { quotaStop = true; R.quota = true; await meta.set(db, "kv_quota_until", midnight()); await meta.set(db, "last_error", "حصة KV اليومية: " + why + " — تُستأنف تلقائياً بعد " + new Date(midnight()).toISOString()); };
    for (const e of batch) {
      if (quotaStop) { R.pending++; continue; }
      if (B.kvDaily && R.kvUsed + 1 + COMPONENTS.length > B.kvDaily) { await hitQuota("بلغت الميزانية اليومية (" + R.kvUsed + "/" + B.kvDaily + ")"); R.pending++; continue; }
      const prev = await db.get("SELECT seq, attempts FROM sync_events WHERE path=? AND status IN ('pending','failed','unverified') AND op=? AND src_blob IS ? ORDER BY seq DESC LIMIT 1", [e.path, e.op, e.op === "delete" ? null : e.d.blob]);
      rev += 1; e.rev = rev; let seq = prev?.seq;
      if (seq) await db.run("UPDATE sync_events SET attempts=attempts+1, run_id=?, ts=?, rev=? WHERE seq=?", [runId, iso(), rev, seq]);
      else seq = (await db.run("INSERT INTO sync_events (run_id,ts,path,op,src_blob,rev,status,attempts,src_commit,idem) VALUES (?,?,?,?,?,?,'pending',1,?,?)", [runId, iso(), e.path, e.op, e.op === "delete" ? null : e.d.blob, rev, head, `${e.path}|${e.op === "delete" ? "deleted" : e.d.blob}|${rev}`])).id;
      e.seq = seq;
      if ((prev?.attempts ?? 0) + 1 > MAX_ATTEMPTS) { await ev(db, seq, "failed", "تجاوز الحدّ الأقصى للمحاولات"); R.failed++; continue; }
      try {
        if (e.op === "delete") { patch[e.comp].del.push(e.path); done.push(e); continue; }
        const buf = e.d.bytes ?? await source.bytes(head, e.path); const r = san.transform(e.path, buf, e.d.cls);
        if (r.blocked) {                                                                                           // حجر: لا يُنسخ ويظهر بسببه
          await db.run("INSERT INTO sync_items (path,comp,cls,src_blob,out_sha,rev,state,src_commit,notes,reason,updated_at) VALUES (?,?,?,?,NULL,?,'quarantined',?,?,?,?) ON CONFLICT(path) DO UPDATE SET comp=excluded.comp,cls=excluded.cls,src_blob=excluded.src_blob,rev=excluded.rev,state='quarantined',src_commit=excluded.src_commit,notes=excluded.notes,reason=excluded.reason,updated_at=excluded.updated_at, out_sha=NULL", [e.path, e.comp, e.d.cls.id, e.d.blob, rev, head, JSON.stringify(r.notes ?? []), r.blocked, iso()]);
          await ev(db, seq, "quarantined", r.blocked); R.quarantined++; if (items.get(e.path)?.state === "applied") patch[e.comp].del.push(e.path); continue;
        }
        const out = await sha256Hex(r.bytes); e.out = out; e.notes = r.notes;
        if (man[e.comp].map[e.path] === out) e.adopted = true;                                                    // البيان الحيّ يشير أصلاً لهذا المحتوى بعينه ⇒ لا كتابة (يبقى التحقق الحيّ)
        else if (await target.putObject(out, r.bytes)) R.kvUsed++;
        patch[e.comp].set[e.path] = out; done.push(e);
      } catch (err) {
        if (isQuota(err)) { await db.run("UPDATE sync_events SET status='pending', attempts=MAX(attempts-1,0), error=?, ts=? WHERE seq=?", ["مؤجَّل: حصة KV", iso(), seq]); await hitQuota(String(err.message ?? err).slice(0, 100)); R.pending++; continue; } await ev(db, seq, "failed", String(err.message ?? err).slice(0, 300)); R.failed++; log("✗ " + e.path + " — " + err.message); }
    }
    /* ── تطبيق البيان (كتابة واحدة لكل مكوّن) ── */
    const trash = [];
    for (const c of COMPONENTS) {
      const p = patch[c]; if (!Object.keys(p.set).length && !p.del.length) continue;
      const cur = man[c]; const next = { ...cur.map }; for (const [k, v] of Object.entries(p.set)) next[k] = v;
      const tc = []; for (const k of p.del) { if (next[k]) tc.push({ path: k, comp: c, out_sha: next[k] }); delete next[k]; }
      if (JSON.stringify(next) === JSON.stringify(cur.map)) continue;                                            // لا تغيير فعلي في البيان ⇒ لا كتابة KV
      try { await target.setManifest(c, cur.rel, next); R.kvUsed++; trash.push(...tc); } catch (err) {
        const q = isQuota(err); if (q) await hitQuota("كتابة البيان: " + String(err.message ?? err).slice(0, 80));
        for (const e of done.filter((x) => x.comp === c)) { if (q) { await db.run("UPDATE sync_events SET status='pending', attempts=MAX(attempts-1,0), error=?, ts=? WHERE seq=?", ["مؤجَّل: حصة KV", iso(), e.seq]); R.pending++; } else { await ev(db, e.seq, "failed", "تعذّر كتابة البيان: " + err.message); R.failed++; } }
        done.splice(0, done.length, ...done.filter((x) => x.comp !== c)); }
    }
    for (const t of trash) await db.run("INSERT INTO sync_trash (path,comp,out_sha,rev,src_commit,deleted_at) VALUES (?,?,?,?,?,?)", [t.path, t.comp, t.out_sha, rev, head, iso()]);
    /* ── التحقق الفعلي من الوجهة الحيّة ثم تثبيت الحالة ── */
    for (const e of done) {
      const v = e.op === "delete" ? await target.verifyGone(e.path) : await target.verify(e.path, e.out);
      if (!v.ok) { await ev(db, e.seq, "unverified", "التحقق من الواجهة الحيّة فشل: " + v.why); R.failed++; continue; }
      if (e.op === "delete") { await db.run("UPDATE sync_items SET state='deleted', rev=?, updated_at=? WHERE path=?", [e.rev, iso(), e.path]); R.deleted++; }
      else await db.run("INSERT INTO sync_items (path,comp,cls,src_blob,out_sha,rev,state,src_commit,notes,reason,updated_at) VALUES (?,?,?,?,?,?,'applied',?,?,NULL,?) ON CONFLICT(path) DO UPDATE SET comp=excluded.comp,cls=excluded.cls,src_blob=excluded.src_blob,out_sha=excluded.out_sha,rev=excluded.rev,state='applied',src_commit=excluded.src_commit,notes=excluded.notes,reason=NULL,updated_at=excluded.updated_at", [e.path, e.comp, e.d.cls.id, e.d.blob, e.out, e.rev, head, JSON.stringify(e.notes ?? []), iso()]);
      await db.run("UPDATE sync_events SET out_sha=?, status='applied', error=NULL, ts=? WHERE seq=?", [e.out ?? null, iso(), e.seq]); R.applied++;
    }
    await meta.set(db, "rev", rev); await meta.set(db, "seen_head", head);
    /* ── تسوية دورية: فحص حيّ لعيّنة من العناصر المطبَّقة (مؤشر دوّار) ── */
    if (kind === "reconcile" || kind === "full") {
      const cur = Number(await meta.get(db, "verify_cursor", 0)), rows = await db.all("SELECT path,out_sha FROM sync_items WHERE state='applied' ORDER BY path LIMIT ? OFFSET ?", [B.verify, cur]);
      for (const r of rows) { const v = await target.verify(r.path, r.out_sha); R.verified++; if (!v.ok) { R.diffs++; await db.run("UPDATE sync_items SET state='failed', reason=?, updated_at=? WHERE path=?", ["انحراف حيّ: " + v.why, iso(), r.path]); } }
      await meta.set(db, "verify_cursor", rows.length < B.verify ? 0 : cur + B.verify);
    }
    const drifts = plan.filter((e) => e.why === "drift").length; R.diffs += drifts;
    if (R.pending === 0 && R.failed === 0) { await meta.set(db, "synced_head", head); await meta.set(db, "synced_at", iso()); await meta.set(db, "last_error", ""); }
    else if (R.failed) await meta.set(db, "last_error", `فشل ${R.failed} عملية (ستُعاد المحاولة)`);
    R.ok = R.failed === 0; return await finish(R, db, now, t0, kind, runId, commits);
  } catch (e) {
    R.error = String(e.message ?? e); await meta.set(db, "last_error", R.error);
    if (e.status === 403 || e.status === 429) { const ms = Math.min(Math.max(e.retryAfterMs ?? 90_000, 60_000), 15 * 60_000); const key = R.phase === "tree" ? "api_backoff_until" : "backoff_until"; await meta.set(db, key, now() + ms); R.rateLimited = true; R.error += (key === "api_backoff_until" ? " (الشجرة فقط: تراجع " : " (تراجع ") + Math.round(ms / 1000) + "ث)"; await meta.set(db, "last_error", R.error); } return await finish(R, db, now, t0, kind, runId, null);
  }
}
async function ev(db, seq, status, error) { await db.run("UPDATE sync_events SET status=?, error=?, ts=? WHERE seq=?", [status, error ?? null, iso(), seq]); }
async function finish(R, db, now, t0, kind, runId, commits) {
  await meta.set(db, "lock", 0); await meta.set(db, "last_run", iso()); if (R.kvUsed != null) await meta.set(db, "kv_writes", R.kvUsed); if (!R.idle) await meta.set(db, "pending", R.pending);
  const row = [kind, R.head, R.prevHead, R.planned, R.applied, R.failed, R.quarantined, R.diffs, now() - t0, R.error ?? null, commits ? JSON.stringify(commits.slice(-20)) : null];
  if (R.idle) { R.ms = now() - t0; return R; }
  if (runId) await db.run("UPDATE sync_runs SET kind=?, head=?, prev_head=?, planned=?, applied=?, failed=?, quarantined=?, diffs=?, ms=?, error=?, commits=? WHERE id=?", [...row, runId]);
  else if (R.head || R.error) await db.run("INSERT INTO sync_runs (kind,head,prev_head,planned,applied,failed,quarantined,diffs,ms,error,commits,ts) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", [...row, iso()]);
  R.ms = now() - t0; return R;
}

/** استعادة عنصر محذوف (الكائن ما زال في KV): يعيد مدخل البيان ويحدّث الحالة */
export async function restoreDeleted({ target, db, path, verify = true }) {
  const t = await db.get("SELECT * FROM sync_trash WHERE path=? ORDER BY id DESC LIMIT 1", [path]); if (!t) return { ok: false, error: "لا نسخة محذوفة لهذا المسار" };
  const comp = t.comp ?? compOf(path), m = await target.manifest(comp); if (!m.map) return { ok: false, error: "لا بيان" };
  if (!(await target.hasObject(t.out_sha))) return { ok: false, error: "الكائن لم يعد موجوداً" };
  await target.setManifest(comp, m.rel, { ...m.map, [path]: t.out_sha });
  const v = verify ? await target.verify(path, t.out_sha) : { ok: true }; if (!v.ok) return { ok: false, error: v.why };
  await db.run("UPDATE sync_items SET state='applied', out_sha=?, updated_at=? WHERE path=?", [t.out_sha, iso(), path]); return { ok: true, sha: t.out_sha };
}

/** حالة المزامنة للوحة المراقبة */
export async function syncStatus(db) {
  await migrate(db);
  const m = async (k) => await meta.get(db, k, null), n = async (sql, p = []) => Number((await db.get(sql, p))?.n ?? 0);
  const byState = Object.fromEntries((await db.all("SELECT state, COUNT(*) n FROM sync_items GROUP BY state")).map((r) => [r.state, r.n]));
  const media = await n("SELECT COUNT(*) n FROM sync_items WHERE cls='media' AND state='applied'"), mediaBad = await n("SELECT COUNT(*) n FROM sync_items WHERE cls='media' AND state<>'applied' AND state<>'deleted'");
  return {
    head_seen: await m("head_seen"), head_synced: await m("synced_head"), synced_at: await m("synced_at"), last_run: await m("last_run"), last_error: await m("last_error") || null, rev: Number(await m("rev") ?? 0),
    in_sync: !!(await m("head_seen")) && (await m("head_seen")) === (await m("synced_head")),
    items: byState, items_total: Object.values(byState).reduce((a, b) => a + b, 0), media: { synced: media, not_synced: mediaBad },
    failed_events: await db.all("SELECT path, op, attempts, error, ts FROM sync_events WHERE status IN ('failed','unverified') AND seq IN (SELECT MAX(seq) FROM sync_events GROUP BY path) ORDER BY seq DESC LIMIT 25"),
    quarantined: await db.all("SELECT path, reason, updated_at FROM sync_items WHERE state='quarantined' ORDER BY updated_at DESC LIMIT 25"),
    drift_failed: await db.all("SELECT path, reason FROM sync_items WHERE state='failed' LIMIT 25"),
    retries: await n("SELECT COALESCE(SUM(attempts-1),0) n FROM sync_events WHERE attempts>1"), events_total: await n("SELECT COUNT(*) n FROM sync_events"),
    runs: await db.all("SELECT id, ts, kind, head, planned, applied, failed, quarantined, diffs, ms, error FROM sync_runs ORDER BY id DESC LIMIT 10"),
    recent_events: await db.all("SELECT seq, ts, path, op, status, attempts, rev FROM sync_events ORDER BY seq DESC LIMIT 20"),
    trash: await n("SELECT COUNT(*) n FROM sync_trash"),
    pending: Number(await m("pending") ?? 0), kv: { day: await m("kv_day"), writes: Number(await m("kv_writes") ?? 0), cap: Number(await m("kv_cap") ?? 0), paused_until: Number(await m("kv_quota_until") ?? 0) > Date.now() ? new Date(Number(await m("kv_quota_until"))).toISOString() : null },
  };
}
