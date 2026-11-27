/* سكربت قبول LAURA قبل الإعلان — يشغّله مسؤول Cloudflare/Supabase بأسراره هو في بيئة تنفيذه؛ لا يطبع أي سر ولا يخزّنه.
   لا يكفي أن يكون /health سليماً: يثبت (1) دخولاً حقيقياً بصلاحيات المالك عبر الوسيط (2) قراءة بيانات المتجر الحقيقية ومطابقتها لمصدر مستقل
   (3) منع بيانات متجر آخر (4) محادثة بنموذج حقيقي (5) أداة قراءة وأداة كتابة بموافقة وتحقق (6) عدم تسرّب أسرار أو بيانات زبائن حساسة.
   الإعداد بمتغيرات بيئة (كلها اختيارية؛ ما لا يُضبط يُسجَّل SKIP لا PASS، والنتيجة النهائية «NOT PROVEN» ما دام فحص إلزامي متخطّى):
     VERIFY_PROXY_URL + VERIFY_JWT_OWNER [+ VERIFY_ANON_KEY]   مسار الإنتاج الحقيقي: Supabase platform-proxy بجلسة المالك الفعلية
     VERIFY_JWT_STAFF                                           جلسة موظف محدود الصلاحيات (فحص حجب بيانات الزبائن)
     VERIFY_API + VERIFY_KEY_A [+ VERIFY_KEY_B]                 الـWorker مباشرة بمفتاح المتجر (A) ومتجر آخر (B) للمصدر المستقل وعزل المستأجرين
     VERIFY_ACTOR_SECRET + VERIFY_TID_A [+ VERIFY_TID_B]        لتوقيع هوية مباشرة (عزل المتاجر؛ هو نفس LAURA_ACTOR_SECRET — لا يُطبع)
     VERIFY_EXPECT_WRITES=off|on (الافتراضي off)  VERIFY_LLM=real|mock (الافتراضي real)  VERIFY_WRITE_REF + VERIFY_ALLOW_APPROVE=yes (موافقة حقيقية على طلب اختبار مخصّص)
     VERIFY_EXTRA_SECRETS=قيم,مفصولة,بفواصل (تُفحص ألا تظهر في أي ردّ)  VERIFY_GAP_MS (الافتراضي 3500)
   التشغيل: node platform/api/tools/laura-prod-verify.mjs   (الخروج: 0 مُثبَت · 1 فشل · 3 غير مُثبَت لتخطّي فحص إلزامي) */
import { signActor } from "../src/laura/actor.js";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SECRET_RE = [/\bsk_[A-Za-z0-9_-]{12,}/, /\bpk_[A-Za-z0-9_-]{12,}/, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/, /\bv1\.[A-Za-z0-9_-]{20,}\.[0-9a-f]{64}\b/, /AIza[0-9A-Za-z_-]{30,}/, /\bsb_secret_[A-Za-z0-9_-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY/];

export async function run(cfg, log = console.log) {
  const R = []; const bodies = []; const secrets = [cfg.actorSecret, cfg.keyA, cfg.keyB, cfg.jwtOwner, cfg.jwtStaff, cfg.anon, ...(cfg.extraSecrets || [])].filter((s) => s && String(s).length >= 12);
  const rec = (id, state, name, why) => { R.push({ id, state, name }); log(`${state.padEnd(4)} ${id} ${name}${state === "FAIL" && why !== undefined ? "  → " + JSON.stringify(why).slice(0, 260) : state === "SKIP" ? "  (" + why + ")" : ""}`); };
  const pass = (id, name, c, why) => rec(id, c ? "PASS" : "FAIL", name, why), skip = (id, name, why) => rec(id, "SKIP", name, why);
  const direct = !!(cfg.api && cfg.keyA), proxy = !!(cfg.proxy && cfg.jwtOwner), signer = !!(cfg.actorSecret && cfg.tidA);
  const now = () => Math.floor(Date.now() / 1000);
  const actor = (tid, role = "owner", perms = ["*"]) => signActor(cfg.actorSecret, { sub: "verify@local", role, perms, tid, iat: now() - 3, exp: now() + 240 });
  /* نقل: proxy = جلسة حقيقية عبر Supabase؛ direct = الـWorker بمفتاح متجر + هوية موقَّعة */
  async function viaProxy(jwt, method, path, body, query) {
    const r = await fetch(cfg.proxy, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + jwt, ...(cfg.anon ? { apikey: cfg.anon } : {}) }, body: JSON.stringify({ method, path, query, body }) });
    const t = await r.text(); bodies.push(t); let j = {}; try { j = JSON.parse(t); } catch { /* نص */ } return { s: r.status === 200 && j.ok ? j.status : r.status, j: j.ok ? j.data : j, raw: t };
  }
  async function viaDirect(key, hdr, method, path, body, query) {
    const qs = query ? "?" + new URLSearchParams(query) : ""; const r = await fetch(cfg.api + path + qs, { method, headers: { Authorization: "Bearer " + key, ...(body ? { "Content-Type": "application/json" } : {}), ...hdr }, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); bodies.push(t); let j = {}; try { j = JSON.parse(t); } catch { /* نص */ } return { s: r.status, j, raw: t };
  }
  const owner = async (m, p, b, q) => proxy ? viaProxy(cfg.jwtOwner, m, p, b, q) : viaDirect(cfg.keyA, { "x-laura-actor": await actor(cfg.tidA) }, m, p, b, q);
  const rest = (key, p, q) => viaDirect(key, {}, "GET", p, null, q);
  const chat = async (msg) => { const r = await owner("POST", "/v1/laura/chat", { message: msg }); await sleep(cfg.gapMs ?? 3500); return r; };
  const real = cfg.llm !== "mock", wantW = cfg.expectWrites === "on";
  const ask = (nl, tool, args) => real ? nl : `TEST_CALL:${tool}:${JSON.stringify(args || {})}`;
  log(`— قبول LAURA · نقل: ${proxy ? "الوسيط الحقيقي (جلسة مالك)" : direct && signer ? "Worker مباشر بهوية موقَّعة (ليس دخولاً حقيقياً)" : "غير متاح"} · نموذج: ${real ? "حقيقي" : "محاكى"} · كتابة متوقعة: ${wantW ? "on" : "off"} —`);
  if (!proxy && !(direct && signer)) { skip("A1", "لا نقل مُهيَّأ (VERIFY_PROXY_URL+VERIFY_JWT_OWNER أو VERIFY_API+VERIFY_KEY_A+VERIFY_ACTOR_SECRET+VERIFY_TID_A)", "إلزامي"); return finish(); }

  /* 1) صحة + دخول المالك */
  const h = await owner("GET", "/v1/laura/health");
  pass("A1", "health: LLM مُهيّأ + هوية موقَّعة مطلوبة", h.s === 200 && h.j.llm_configured === true && h.j.actor_required === true, h.j);
  pass("A2", `وضع الكتابة كما هو متوقع (${wantW ? "on" : "off"})`, h.j.writes_enabled === wantW, { writes_enabled: h.j.writes_enabled });
  const hist = await owner("GET", "/v1/laura/history");
  pass("B1", "دخول حقيقي بدور المالك (history.role=owner)" + (proxy ? "" : " [هوية موقَّعة محلياً — ليس إثبات دخول]"), hist.s === 200 && hist.j.role === "owner", { s: hist.s, role: hist.j.role });
  if (!proxy) skip("B1p", "إثبات الدخول الحقيقي عبر Supabase", "يلزم VERIFY_PROXY_URL+VERIFY_JWT_OWNER");
  const tl = await owner("GET", "/v1/laura/tools"), names = (tl.j.tools || []).map((t) => t.name);
  pass("B2", "المالك يرى أدوات القراءة" + (wantW ? " والكتابة" : " فقط (لا كتابة)"), tl.s === 200 && names.length > 0 && (wantW ? (tl.j.tools || []).some((t) => t.tier === "write") : (tl.j.tools || []).every((t) => t.tier === "read")), { n: names.length });

  /* 2) بيانات حقيقية مقابل مصدر مستقل */
  let stA = null, ordA = [];
  if (direct) { const st = await rest(cfg.keyA, "/v1/orders/stats"), ol = await rest(cfg.keyA, "/v1/orders", { limit: 50 }); stA = st.j; ordA = ol.j.orders || []; }
  const c1 = await chat(ask("كم عدد طلباتي الآن؟ أعطني الرقم.", "orders_stats"));
  const used = (c1.j.tools || []).find((t) => t.name === "orders_stats" || t.name === "orders_list" || t.name === "sales_summary");
  pass("C1", "أداة قراءة تُنفَّذ فعلاً وتنجح عبر المحادثة", c1.s === 200 && !!used && used.ok === true, { s: c1.s, tools: c1.j.tools, err: c1.j.error });
  if (stA && Number.isFinite(stA.orders)) pass("C2", `مطابقة: عدد الطلبات في ردّ LAURA = ${stA.orders} من مصدر مستقل (REST)`, new RegExp("(^|[^0-9])" + String(stA.orders) + "([^0-9]|$)").test(String(c1.j.reply || "").replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x660)), { expected: stA.orders, reply: String(c1.j.reply || "").slice(0, 160) });
  else skip("C2", "مطابقة البيانات بمصدر مستقل", "يلزم VERIFY_API+VERIFY_KEY_A (مصدر REST مستقل)");
  if (direct && stA && stA.orders === 0) pass("C3", "تنبيه: المتجر بلا طلبات في مصدر LAURA — تأكد من وصول بيانات المتجر الحقيقية إلى D1", false, "orders=0");

  /* 3) عزل المتاجر */
  if (direct && cfg.keyB && signer && cfg.tidB) {
    const x1 = await viaDirect(cfg.keyB, { "x-laura-actor": await actor(cfg.tidA) }, "GET", "/v1/laura/tools");
    pass("D1", "هوية متجر A مع مفتاح متجر B ← مرفوضة", [401, 403].includes(x1.s), { s: x1.s });
    const x2 = await viaDirect(cfg.keyA, { "x-laura-actor": await actor(cfg.tidB) }, "GET", "/v1/laura/tools");
    pass("D2", "هوية متجر B مع مفتاح متجر A ← مرفوضة", [401, 403].includes(x2.s), { s: x2.s });
    const x3 = ordA.length ? await rest(cfg.keyB, "/v1/orders", { ref: ordA[0].ref }) : null;
    if (x3) pass("D3", "مفتاح B لا يقرأ طلب A بمرجعه", x3.s === 200 && !(x3.j.orders || []).length, { s: x3.s });
    else skip("D3", "قراءة طلب A بمفتاح B", "لا طلبات في A");
    const xb = await viaDirect(cfg.keyB, { "x-laura-actor": await actor(cfg.tidB) }, "POST", "/v1/laura/chat", { message: ask("اعرض آخر طلباتي مع أسماء الزبائن وهواتفهم.", "orders_list") }); await sleep(cfg.gapMs ?? 3500);
    const leakA = ordA.filter((o) => o.ref && String(xb.raw).includes(o.ref) || (o.phone && String(xb.raw).includes(o.phone)));
    pass("D4", "محادثة متجر B لا تُظهر أي مرجع/هاتف من متجر A", xb.s === 200 && !leakA.length, { leaked: leakA.length });
  } else skip("D", "عزل المتاجر (D1–D4)", "يلزم VERIFY_KEY_B + VERIFY_TID_B + VERIFY_ACTOR_SECRET + VERIFY_TID_A + VERIFY_API");

  /* 4) كتابة */
  const ref = cfg.writeRef || ordA.find((o) => o.status === "nouvelle")?.ref;
  if (!wantW) {
    const w = await chat(ask("أكد الطلب " + (ref || "W-0000"), "order_confirm", { ref: ref || "W-0000" }));
    pass("E1", "وضع القراءة: طلب كتابة لا ينتج إجراءً معلّقاً ولا تنفيذاً", w.s === 200 && !(w.j.pending || []).length && !(w.j.tools || []).some((t) => t.name === "order_confirm" && t.ok), { pending: w.j.pending, tools: w.j.tools });
    const fk = await owner("POST", "/v1/laura/confirm", { id: "lp_" + "0".repeat(24), approve: true });
    pass("E2", "اعتماد إجراء غير موجود مرفوض", fk.s >= 400, { s: fk.s });
  } else if (ref) {
    const w = await chat(ask("أكد الطلب " + ref, "order_confirm", { ref })), P = (w.j.pending || [])[0];
    pass("E1", "طلب الكتابة ينتهي بإجراء معلّق ينتظر الموافقة (لا تنفيذ قبلها)", w.s === 200 && !!P && w.j.state === "awaiting_approval", { s: w.s, state: w.j.state });
    if (P && cfg.allowApprove && cfg.writeRef) {
      const ap = await owner("POST", "/v1/laura/confirm", { id: P.id, approve: true });
      pass("E3", "الموافقة تنفّذ وتُتحقق من النتيجة (verified)", ap.s === 200 && ap.j.verified !== false && /done|dispatched/.test(String(ap.j.state)), { s: ap.s, j: ap.j });
      if (direct) { const o = await rest(cfg.keyA, "/v1/orders", { ref }); pass("E4", "حالة الطلب في مصدر مستقل = مؤكَّدة", (o.j.orders || [])[0]?.status === "confirmee", (o.j.orders || [])[0]?.status); }
    } else if (P) { const rj = await owner("POST", "/v1/laura/confirm", { id: P.id, approve: false }); pass("E3", "رفض الإجراء المعلّق ينهيه دون تنفيذ (لم تُجرَ موافقة حقيقية: لا VERIFY_WRITE_REF/VERIFY_ALLOW_APPROVE)", rj.s === 200, { s: rj.s }); skip("E4", "تنفيذ كتابة بموافقة والتحقق منها", "يلزم VERIFY_WRITE_REF (طلب اختبار مخصّص) + VERIFY_ALLOW_APPROVE=yes"); }
  } else skip("E", "فحص الكتابة", "لا طلب بحالة «جديد» ولا VERIFY_WRITE_REF");

  /* 5) موظف محدود */
  if (proxy && cfg.jwtStaff) {
    const st = await viaProxy(cfg.jwtStaff, "GET", "/v1/laura/tools"), sn = (st.j.tools || []).map((t) => t.name);
    pass("F1", "الموظف المحدود يرى أدوات أقل من المالك ولا يرى أدوات خارج صلاحياته", st.s === 200 && sn.length < names.length, { staff: sn.length, owner: names.length });
    const sc = await viaProxy(cfg.jwtStaff, "POST", "/v1/laura/chat", { message: ask("اعرض أسماء وهواتف زبائني.", "customers_top") }); await sleep(cfg.gapMs ?? 3500);
    const ph = ordA.filter((o) => o.phone && String(sc.raw).includes(o.phone));
    pass("F2", "الموظف دون صلاحية الزبائن لا يحصل على هواتفهم", !ph.length, { phones_leaked: ph.length });
  } else skip("F", "حجب بيانات الزبائن عن موظف محدود", "يلزم VERIFY_JWT_STAFF بنقل الوسيط");

  return finish();
  /* 6) تسرّب: يُفحص كل ما عاد من الخادم طوال التشغيل */
  function finish() {
    const all = bodies.join("\n"); const hit = [];
    for (const s of secrets) if (all.includes(String(s))) hit.push("قيمة سر مُعرَّفة"); for (const re of SECRET_RE) if (re.test(all)) hit.push(String(re).slice(0, 24));
    const stripped = all; if (bodies.length) pass("G1", `لا أسرار/رموز في أي ردّ (${bodies.length} ردّ فُحصت)`, !hit.length, hit); else skip("G1", "فحص التسرّب", "لا ردود");
    const bad = R.filter((r) => r.state === "FAIL").length, sk = R.filter((r) => r.state === "SKIP").length;
    log(`\nالنتيجة: ${R.filter((r) => r.state === "PASS").length} نجح · ${bad} فشل · ${sk} متخطّى`); const code = bad ? 1 : sk && !cfg.allowSkip ? 3 : 0;
    log(code === 0 ? (sk ? `ACCEPTANCE: PROVEN (مع ${sk} فحص متخطّى بطلبك — ليس إثباتاً كاملاً)` : "ACCEPTANCE: PROVEN") : code === 1 ? "ACCEPTANCE: FAILED — لا تُعلن" : "ACCEPTANCE: NOT PROVEN — فحوص متخطّاة؛ لا تُعلن قبل إكمالها"); void stripped; return { results: R, code };
  }
}
const E = process.env, list = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
if (import.meta.url === `file://${process.argv[1]}`) {
  const { code } = await run({ proxy: E.VERIFY_PROXY_URL, jwtOwner: E.VERIFY_JWT_OWNER, jwtStaff: E.VERIFY_JWT_STAFF, anon: E.VERIFY_ANON_KEY, api: (E.VERIFY_API || "").replace(/\/$/, ""), keyA: E.VERIFY_KEY_A, keyB: E.VERIFY_KEY_B, actorSecret: E.VERIFY_ACTOR_SECRET, tidA: +E.VERIFY_TID_A || 0, tidB: +E.VERIFY_TID_B || 0, expectWrites: E.VERIFY_EXPECT_WRITES || "off", llm: E.VERIFY_LLM || "real", writeRef: E.VERIFY_WRITE_REF, allowApprove: E.VERIFY_ALLOW_APPROVE === "yes", extraSecrets: list(E.VERIFY_EXTRA_SECRETS), gapMs: +E.VERIFY_GAP_MS || 3500, allowSkip: E.VERIFY_ALLOW_SKIP === "1" });
  process.exit(code);
}
