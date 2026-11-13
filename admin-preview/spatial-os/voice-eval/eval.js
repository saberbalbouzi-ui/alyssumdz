/* تقييم الصوت الجزائري (مرحلة 12 / WS2). أوضاع:
   node eval.js --oracle            : النص المرجعي ← المحلّل الحتمي (سقف دقة الأمر لو كان التعرّف مثالياً). ليس تقييماً صوتياً؛ يعمل بلا صوت.
   VOICE_EVAL_DIR=/path node eval.js --audio : تسجيلات حقيقية (خارج المستودع) + manifest.json ← STT عبر وسيط الخادم ← WER/CER/أمر/معرّف/لغة/زمن، موزَّعة حسب المصدر (human|synthetic) والعائلة.
   node eval.js --tts-sheet         : يولّد ورقة تقييم TTS للمستمعين الناطقين (النطق/الوضوح/الطبيعية/الأرقام) + قياسات آلية عند توفّر مزوّد.
   قواعد صارمة: مجلد التسجيلات يجب أن يقع خارج مستودع git؛ تسجيلات بشرية بلا consent:true في manifest تُرفض؛ لا يُكتب صوت في المستودع؛ الملخص المنشور تجميعي فقط (بلا نصوص بشرية).
   بلا تسجيلات/مفتاح ← BLOCKED صريح، ولا تُحتسب أي نتيجة بشرية. */
const fs = require("fs"), path = require("path"), cp = require("child_process"); const S = require("./score");
const SENT = JSON.parse(fs.readFileSync(path.join(__dirname, "sentences.json"), "utf8")).sentences, BY = Object.fromEntries(SENT.map(s => [s.id, s]));
const arg = f => process.argv.includes(f), OUTD = path.join(__dirname, "results"); fs.mkdirSync(OUTD, { recursive: true });
const group = (rows, key) => { const g = {}; rows.forEach(r => (g[r[key]] = g[r[key]] || []).push(r)); return g; };
const WRITE_TOOLS = new Set(["orders.confirm", "orders.write"]);
/* المحلّل يعيد «نيّة» لا أداة نهائية: فتح طلب بمعرّف يُحسم في النواة (orders.get/ui.show_order)، لذا تُقبل orders.list كنيّة قراءة مكافئة في هذا الوضع الأدنى فقط */
const ACCEPT = { "orders.get": ["orders.get", "orders.list", "ui.show_order"] };

function oracle() {
  const rows = SENT.map(s => { const t = S.tool(s.text), exp = s.tool; let ok, kind;
    if (exp === "clarify_or_refuse" || exp === "clarify" || exp === "refuse") { ok = !t || !WRITE_TOOLS.has(t); kind = "safety"; } else { ok = (ACCEPT[exp] || [exp]).includes(t); kind = "intent"; }
    return { id: s.id, family: s.family, risk: s.risk, expected: exp, got: t, ok, kind, text: s.text }; });
  const intent = rows.filter(r => r.kind === "intent"), fam = group(intent, "family");
  const out = { mode: "oracle (text→NLU, NOT voice)", date: new Date().toISOString().slice(0, 10), sentences: SENT.length, intent_total: intent.length, intent_ok: intent.filter(r => r.ok).length, intent_acc: +(intent.filter(r => r.ok).length / intent.length).toFixed(3),
    safety_total: rows.length - intent.length, safety_ok: rows.filter(r => r.kind === "safety" && r.ok).length, by_family: Object.fromEntries(Object.entries(fam).map(([k, v]) => [k, { n: v.length, ok: v.filter(r => r.ok).length, acc: +(v.filter(r => r.ok).length / v.length).toFixed(2) }])),
    misses: rows.filter(r => !r.ok).map(r => ({ id: r.id, family: r.family, expected: r.expected, got: r.got, text: r.text })),
    caveat: "المحلّل الحتمي فقط. المقصود من الجمل المخطّأة (compare/followup/فلتر الولاية…) فجوات في الأدوات/المحلّل لا في التعرّف الصوتي." };
  fs.writeFileSync(path.join(__dirname, "oracle-result.json"), JSON.stringify(out, null, 1)); console.log(JSON.stringify({ intent_acc: out.intent_acc, intent: out.intent_ok + "/" + out.intent_total, safety: out.safety_ok + "/" + out.safety_total, by_family: out.by_family }));
}

function insideGit(d) { try { cp.execSync("git -C " + JSON.stringify(d) + " rev-parse --is-inside-work-tree", { stdio: "pipe" }); return true; } catch (_) { return false; } }
async function audio() {
  const D = process.env.VOICE_EVAL_DIR, res = { mode: "audio", date: new Date().toISOString().slice(0, 10), status: null };
  const block = why => { res.status = "BLOCKED"; res.reason = why; fs.writeFileSync(path.join(__dirname, "audio-result.json"), JSON.stringify(res, null, 1)); console.log("BLOCKED —", why); };
  if (!D || !fs.existsSync(path.join(D, "manifest.json"))) return block("لا يوجد VOICE_EVAL_DIR/manifest.json: لا تسجيلات متاحة. (بروتوكول التسجيل في PROTOCOL.md)");
  if (insideGit(D)) return block("مجلد التسجيلات داخل مستودع git — مرفوض: ضعه خارج المستودع.");
  const man = JSON.parse(fs.readFileSync(path.join(D, "manifest.json"), "utf8")); const bad = man.filter(m => m.source === "human" && m.consent !== true);
  if (bad.length) return block(bad.length + " تسجيلاً بشرياً بلا consent:true — مرفوضة.");
  if (!process.env.ALYSSUM_LLM_KEY && !process.env.ALYSSUM_LLM_PROXY_OK) return block("لا مفتاح مزوّد (ALYSSUM_LLM_KEY) لاستدعاء STT الحقيقي.");
  const { startStore, PW } = require("../test/harness"); const store = await startStore({ stock: true, env: { ALYSSUM_LLM_KEY: process.env.ALYSSUM_LLM_KEY || "", ALYSSUM_LLM_BASE: process.env.ALYSSUM_LLM_BASE || "https://generativelanguage.googleapis.com" } });
  const H = { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }; const lr = await fetch(store.base + "/api/index.php?r=login", { method: "POST", headers: H, body: JSON.stringify({ password: store.pw }) }); const cookie = (lr.headers.getSetCookie ? lr.headers.getSetCookie() : []).map(c => c.split(";")[0]).join("; ");
  const rows = [];
  for (const m of man) { const sen = BY[m.sentence_id]; if (!sen) continue; const wav = fs.readFileSync(path.join(D, m.file)); const t0 = Date.now(); let j = null;
    try { const r = await fetch(store.base + "/admin-preview/spatial-os/server/llm.php", { method: "POST", headers: Object.assign({ Cookie: cookie }, H), body: JSON.stringify({ action: "stt", audio: wav.toString("base64"), lang: "auto" }) }); j = await r.json(); } catch (_) { }
    const ms = Date.now() - t0, hyp = j && j.ok ? j.text : null, fail = !(j && j.ok);
    rows.push({ file: m.file, source: m.source, speaker: m.speaker, family: sen.family, dialect: m.dialect_self_reported || sen.dialect, noise: m.noise, speed: m.speed, ms, fail, empty: !fail && !hyp, wer: fail ? null : S.wer(sen.text, hyp || ""), cer: fail ? null : S.cer(sen.text, hyp || ""), tool_ok: fail ? null : S.tool(hyp || "") === sen.tool, id_exact: fail ? null : S.idExact(sen.ids, hyp || ""), lang_ok: fail ? null : S.lang(hyp || "") === S.lang(sen.text), hyp_anon: m.source === "synthetic" ? hyp : undefined }); }
  store.stop();
  const agg = rs => ({ n: rs.length, fail_rate: +(rs.filter(r => r.fail).length / (rs.length || 1)).toFixed(3), wer: S.mean(rs.filter(r => r.wer != null).map(r => r.wer)), cer: S.mean(rs.filter(r => r.cer != null).map(r => r.cer)), command_acc: S.mean(rs.filter(r => r.tool_ok != null).map(r => +r.tool_ok)), id_exact: S.mean(rs.filter(r => r.id_exact != null).map(r => +r.id_exact)), lang_acc: S.mean(rs.filter(r => r.lang_ok != null).map(r => +r.lang_ok)), latency_ms: { p50: S.pct(rs.map(r => r.ms), 50), p95: S.pct(rs.map(r => r.ms), 95) } });
  res.status = "MEASURED"; for (const src of ["human", "synthetic"]) { const rs = rows.filter(r => r.source === src); res[src] = rs.length ? { overall: agg(rs), by_family: Object.fromEntries(Object.entries(group(rs, "family")).map(([k, v]) => [k, agg(v)])), by_dialect: Object.fromEntries(Object.entries(group(rs, "dialect")).map(([k, v]) => [k, agg(v)])), by_noise: Object.fromEntries(Object.entries(group(rs, "noise")).map(([k, v]) => [k, agg(v)])) } : "NOT TESTED (no recordings of this source)"; }
  fs.writeFileSync(path.join(OUTD, "rows-private.json"), JSON.stringify(rows, null, 1)); /* results/ مُتجاهَل في git: قد يحوي نصوصاً */ fs.writeFileSync(path.join(__dirname, "audio-result.json"), JSON.stringify(res, null, 1)); console.log(res.status, JSON.stringify(res.human === "string" ? res.human : (res.human || {}).overall));
}

function ttsSheet() {
  const lines = ["id,text,lang,pronunciation_1to5,intelligibility_1to5,naturalness_1to5,numbers_ids_ok_yes_no,interrupt_ok_yes_no,notes"], reply = [["T01", "مبيعات اليوم: 12 طلباً بقيمة 48500 دج.", "ar"], ["T02", "وجدت 3 طلبات غير مؤكدة. الطلب رقم A1182 من الجزائر.", "ar"], ["T03", "ببطاقة موافقة تنتظرك؛ لم يُنفَّذ شيء بعد.", "ar"], ["T04", "Il reste 14 unités de miel de sidr.", "fr"], ["T05", "Voici les ventes d'aujourd'hui: douze commandes.", "fr"], ["T06", "رقم الطلب 805621 تم فتحه.", "ar"]];
  reply.forEach(r => lines.push([r[0], JSON.stringify(r[1]), r[2], "", "", "", "", "", ""].join(","))); fs.writeFileSync(path.join(__dirname, "tts-rating-sheet.csv"), "﻿" + lines.join("\n") + "\n"); console.log("tts-rating-sheet.csv written (يملؤه مستمعون ناطقون؛ لا قياس آلي للنطق).");
}
if (arg("--oracle")) oracle(); else if (arg("--audio")) audio().catch(e => { console.error(String(e).slice(0, 300)); process.exit(2); }); else if (arg("--tts-sheet")) ttsSheet(); else console.log("usage: node eval.js --oracle | --audio | --tts-sheet");
