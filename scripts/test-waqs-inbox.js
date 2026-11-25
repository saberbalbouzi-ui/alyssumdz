/* صندوق الرسائل الخاص (واجهة المالك) مقابل خادم REST وهمي: الاستيراد الموحَّد وتقريره، القائمة والتصفية والترتيب، Open WhatsApp لا يسجّل إرسالاً (Opened فقط)،
   «Sent» بتأكيد المالك ونسخة المُرسَل، حارس التكرار، رفض غير المالك، وغياب الوحدة عند العملاء، وعدم تخزين الرسائل في المتصفح.
   قواعد قاعدة البيانات وRLS تُختبر في scripts/test-owner-inbox-rls.sh. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = [];
  /* خادم REST وهمي بذاكرة، يحاكي دالة الاستيراد والقيود الأساسية (التحقق الحقيقي في SQL) */
  const mkServer = mode => {
    const db = { rows: [], logs: [], reqs: [], n: 0 }, norm = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const ok = (r, j, st) => r.fulfill({ status: st || 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(j) });
    return { db, handler: async r => {
      const rq = r.request(), u = new URL(rq.url()), m = rq.method(), body = rq.postData(); db.reqs.push({ m, path: u.pathname, q: u.search, auth: rq.headers()["authorization"] || "", body: body ? JSON.parse(body) : null });
      if (m === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
      if (mode === "missing") return ok(r, { code: "PGRST205", message: "Could not find the table 'public.owner_inbox' in the schema cache" }, 404);
      if (u.pathname.endsWith("/rpc/owner_inbox_import")) {
        if (mode === "staff") return ok(r, { code: "42501", message: "unauthorized" }, 403);
        const rows = JSON.parse(body).p_rows, rep = { total: rows.length, inserted: 0, duplicates: 0, invalid: 0, new_contacts: 0, existing_contacts: 0, errors: [] }, seen = new Set();
        rows.forEach((x, i) => { const ph = String(x.phone).replace(/\D/g, ""), lg = ({ english: "en", en: "en", fr: "fr", français: "fr", ar: "ar" })[String(x.language).toLowerCase()];
          if (!/^[1-9][0-9]{7,14}$/.test(ph) || !lg || !x.body || (!x.company && !x.contact)) { rep.invalid++; rep.errors.push({ row: i + 1, reason: !lg ? "invalid_language" : "invalid_phone" }); return; }
          if (db.rows.some(d => d.phone === ph && norm(d.body) === norm(x.body)) || (x.ref && db.rows.some(d => d.ref === x.ref))) { rep.duplicates++; return; }
          if (!seen.has(ph)) { seen.add(ph); db.rows.some(d => d.phone === ph) ? rep.existing_contacts++ : rep.new_contacts++; }
          const par = db.rows.find(d => x.parent_ref && d.ref === x.parent_ref);
          db.rows.push({ id: "id" + (++db.n), created_at: new Date().toISOString(), prepared_at: x.prepared_at || new Date().toISOString(), batch: body && JSON.parse(body).p_batch, campaign: x.campaign || "", ref: x.ref || "", parent_id: par ? par.id : null, company: x.company || "", contact_name: x.contact || "", phone: ph, country: x.country || "", language: lg, kind: (x.kind || "first_contact").replace("-", "_"), subject: x.subject || "", body: x.body, priority: Number(x.priority || 0), status: "ready", opened_at: null, sent_at: null, sent_body: null, notes: "" }); rep.inserted++; });
        return ok(r, rep);
      }
      db.tokens = db.tokens || [];
      if (u.pathname.endsWith("/owner_inbox_tokens")) return ok(r, db.tokens);
      if (u.pathname.endsWith("/rpc/owner_inbox_token_create")) { const lb = JSON.parse(body).p_label; if (db.tokens.some(x => x.label.toLowerCase() === lb.toLowerCase() && !x.revoked_at)) return ok(r, { code: "23505", message: 'duplicate key value violates unique constraint "owner_inbox_tokens_label_u"' }, 409); const tk = { id: "tk" + (db.tokens.length + 1), label: lb, created_at: new Date().toISOString(), last_used_at: null, revoked_at: null }; db.tokens.unshift(tk); return ok(r, { id: tk.id, label: lb, token: "oi_" + "ab12".repeat(16) }); }
      if (u.pathname.endsWith("/rpc/owner_inbox_token_revoke")) { const tk = db.tokens.find(x => x.id === JSON.parse(body).p_id); if (tk) tk.revoked_at = new Date().toISOString(); return ok(r, !!tk); }
      if (u.pathname.endsWith("/owner_inbox_log")) return ok(r, db.logs);
      const id = (u.search.match(/id=eq\.([^&]+)/) || [])[1];
      if (m === "GET") return ok(r, db.rows);
      if (m === "PATCH") { const row = db.rows.find(d => d.id === id); if (!row) return ok(r, []); const p = JSON.parse(body);
        if (p.status === "sent" && !String(p.sent_body || "").trim()) return ok(r, { code: "23514", message: "sent_requires_sent_body" }, 400);
        if (p.status && p.status !== row.status) { db.logs.push({ message_id: id, at: new Date().toISOString(), from_status: row.status, to_status: p.status }); if (p.status === "opened") row.opened_at = new Date().toISOString(); if (p.status === "sent") row.sent_at = new Date().toISOString(); }
        Object.assign(row, p); return ok(r, [row]); }
      if (m === "DELETE") { db.rows = db.rows.filter(d => d.id !== id); return ok(r, []); }
      return ok(r, []);
    } };
  };
  async function page(seller, mode) {
    const p = await b.newPage({ viewport: { width: 420, height: 900 } }); p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    const srv = mkServer(mode || "ok"); await p.route(/\/rest\/v1\/(owner_inbox|rpc\/owner_inbox_)/, srv.handler); await p.route(/wa\.me/, r => r.abort());
    await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
    if (!seller) await p.route(/\/admin\.html(\?.*)?$/, async r => { const res = await r.fetch(); let body = await res.text(); const cfg = require("fs").readFileSync("assets/js/config.js", "utf8").replace(/SELLER:\s*true/, "SELLER: false"); body = body.replace('<script src="assets/js/config.js"></script>', () => "<script>" + cfg + "</script>"); r.fulfill({ response: res, body }); });
    await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(10500);
    await p.evaluate(() => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; window.__conf = []; window.__ans = true; window.confirm = m => { window.__conf.push(m); return window.__ans !== false; }; if (typeof API !== "undefined") { API.sb.token = async () => "owner-token"; API.sb.enabled = () => true; } });
    await p.waitForTimeout(3500); return { p, srv };
  }
  const SHOW = p => p.evaluate(async () => { let vis = 0; for (let i = 0; i < 8 && vis < 2; i++) { const el = document.getElementById("tab-waqsin"); if (el.classList.contains("hidden")) { vis = 0; Admin.tab("waqsin", document.querySelector("[onclick*=\"'waqsin'\"]")); } else vis++; await new Promise(r => setTimeout(r, 700)); } });

  /* 1) الهجرة غير مطبَّقة: رسالة واضحة بلا انهيار */
  { const { p } = await page(true, "missing"); await SHOW(p); await p.waitForTimeout(800);
    const m = await p.evaluate(() => document.getElementById("waqsin") && document.getElementById("waqsin").innerText);
    t("الجدول غير مفعَّل بعد: رسالة واضحة (لا بيانات ولا خطأ خام)", /غير مفعَّل بعد/.test(m || ""), m); await p.close(); }

  const { p, srv } = await page(true, "ok"); await SHOW(p); await p.waitForTimeout(800);
  const nav = await p.evaluate(() => ({ btn: !!document.querySelector("[onclick*=\"'waqsin'\"]"), pane: !document.getElementById("tab-waqsin").classList.contains("hidden"), empty: /الصندوق فارغ/.test(document.getElementById("waqsin").innerText) }));
  t("القسم ظاهر للمالك والصندوق فارغ (لا رسائل وهمية)", nav.btn && nav.pane && nav.empty && srv.db.rows.length === 0, nav);
  t("طلبات القراءة تحمل رمز جلسة المالك", srv.db.reqs.length > 0 && srv.db.reqs.every(r => /Bearer owner-token/.test(r.auth)), srv.db.reqs.map(r => r.auth));

  /* 2) استيراد دفعة بالصيغة الموحَّدة */
  const batch = { schema: "owner-inbox/v1", batch: "spring-eu", campaign: "Spring EU", messages: [
    { ref: "d1", company: "Delta Corp", contact: "Sam Rivers", phone: "+213 550 123 456", country: "Algeria", language: "en", kind: "first_contact", subject: "Intro", body: "Hello Sam,\n\nFirst message & more? 100% #1.", priority: 2, prepared_at: "2026-11-25T09:00:00Z" },
    { ref: "d2", parent_ref: "d1", company: "Delta Corp", contact: "Sam Rivers", phone: "00213550123456", language: "English", kind: "follow-up", body: "Hello Sam, follow-up.", priority: 0, prepared_at: "2026-11-26T09:00:00Z" },
    { ref: "g1", company: "Gamma SARL", contact: "Léa Martin", phone: "+33612345678", country: "France", language: "fr", kind: "first_contact", subject: "Présentation", body: "Bonjour Léa, premier message.", priority: 5, campaign: "Printemps FR" },
    { company: "Bad", phone: "12", language: "en", body: "no valid phone" },
    { ref: "g1", company: "Gamma SARL", phone: "+33612345678", language: "fr", body: "  Bonjour   Léa, premier message. " } ] };
  await p.click("[data-wi=imp]"); await p.fill("#im-t", JSON.stringify(batch)); await p.waitForTimeout(300);
  const pre = await p.evaluate(() => document.getElementById("im-r").textContent); await p.click("#im-ok"); await p.waitForTimeout(900);
  const rep = await p.evaluate(() => document.getElementById("im-r").textContent); const rpc = srv.db.reqs.filter(r => /rpc\/owner_inbox_import/.test(r.path));
  t("المعاينة قبل الاستيراد تُظهر صفاً غير صالح محلياً", /الصفوف: 5/.test(pre) && /تحتاج تصحيحاً \(تُرفض\): 1/.test(pre), pre);
  t("الاستيراد يمرّ بدالة الخادم (طلب واحد) بهاتف دولي مطبَّع وحملة الجذر ودفعة مسمّاة", rpc.length === 1 && rpc[0].body.p_batch === "spring-eu" && rpc[0].body.p_rows[0].phone === "213550123456" && rpc[0].body.p_rows[1].phone === "213550123456" && rpc[0].body.p_rows[0].campaign === "Spring EU" && rpc[0].body.p_rows[2].campaign === "Printemps FR", rpc[0] && rpc[0].body);
  t("تقرير الاستيراد: 3 جديدة، مكرَّرة 1، مرفوضة 1، جهتان جديدتان", /رسائل جديدة: 3/.test(rep) && /مكرَّرة \(متخطّاة\): 1/.test(rep) && /مرفوضة: 1/.test(rep) && /جهات جديدة: 2/.test(rep), rep);
  await p.click("#im-no"); await p.waitForTimeout(300);

  /* 3) القائمة: ترتيب الأولوية والتصفية والعدّادات */
  const L1 = await p.evaluate(() => ({ rows: [...document.querySelectorAll("#waqsin .wi-row:not(.wi-qh)")].map(r => r.innerText.replace(/\s+/g, " ").trim()), chips: [...document.querySelectorAll("#waqsin [data-wi=st] b")].map(x => x.textContent).join(","), head: (document.querySelector("#waqsin .wi-qh") || {}).textContent }));
  t("قائمة الإرسال: ترتيب بالأولوية (Gamma P5 ثم Delta P2 ثم المتابعة) وأعمدة الشركة/الجهة/اللغة/النوع/الحالة", L1.rows.length === 3 && /^Gamma SARL/.test(L1.rows[0]) && /^Delta Corp P2/.test(L1.rows[1]) && /Follow-up/.test(L1.rows[2]) && L1.rows.every(r => /Ready to Send/.test(r)) && /الشركة/.test(L1.head) && L1.chips.startsWith("3,3,"), L1);
  await p.selectOption("#wi-lg", "fr"); await p.waitForTimeout(200); const f1 = await p.evaluate(() => document.querySelectorAll("#waqsin .wi-row:not(.wi-qh)").length);
  await p.selectOption("#wi-lg", ""); await p.selectOption("#wi-co", "Delta Corp"); await p.waitForTimeout(200); const f2 = await p.evaluate(() => document.querySelectorAll("#waqsin .wi-row:not(.wi-qh)").length);
  await p.selectOption("#wi-co", ""); await p.selectOption("#wi-cp", "Printemps FR"); await p.waitForTimeout(200); const f3 = await p.evaluate(() => document.querySelectorAll("#waqsin .wi-row:not(.wi-qh)").length);
  await p.selectOption("#wi-cp", ""); await p.fill("#wi-q", "6123"); await p.waitForTimeout(200); const f4 = await p.evaluate(() => document.querySelectorAll("#waqsin .wi-row:not(.wi-qh)").length); await p.fill("#wi-q", "");
  t("التصفية: باللغة والشركة والحملة وبالبحث في الرقم", f1 === 1 && f2 === 2 && f3 === 1 && f4 === 1, { f1, f2, f3, f4 });

  /* 4) فتح رسالة: المعاينة والرابط؛ Open WhatsApp = Opened فقط ولا Sent */
  await p.click("[data-wi=open] >> nth=1"); await p.waitForTimeout(400);
  const D = await p.evaluate(() => ({ head: document.querySelector("#waqsin h2").textContent, prev: document.getElementById("wi-prev").textContent, href: document.getElementById("wi-go").getAttribute("href"), tgt: document.getElementById("wi-go").target, rel: document.getElementById("wi-go").rel, row: AdminWaqsInbox.S.rows.find(r => r.ref === "d1") }));
  t("معاينة الرسالة كاملة والرابط wa.me بالنص المشفَّر وبالرقم الدولي (_blank/noopener)", /Sam Rivers/.test(D.head) && D.prev === D.row.body && D.href === "https://wa.me/213550123456?text=" + encodeURIComponent(D.row.body) && D.tgt === "_blank" && /noopener/.test(D.rel), D);
  await p.evaluate(() => { document.getElementById("wi-go").addEventListener("click", e => e.preventDefault(), true); }); const n0 = srv.db.reqs.length;
  await p.click("#wi-go"); await p.waitForTimeout(700);
  const patches = srv.db.reqs.slice(n0).filter(r => r.m === "PATCH");
  const O = await p.evaluate(() => ({ st: AdminWaqsInbox.S.rows.find(r => r.ref === "d1").status, sentBody: AdminWaqsInbox.S.rows.find(r => r.ref === "d1").sent_body }));
  t("فتح WhatsApp يضع Opened فقط (طلب PATCH واحد بحالة opened) ولا يسجّل Sent ولا نسخة مُرسَل", patches.length === 1 && JSON.stringify(patches[0].body) === '{"status":"opened"}' && O.st === "opened" && !O.sentBody, { patches: patches.map(p => p.body), O });

  /* 5) تأكيد الإرسال: بنص مُخصَّص اختيارياً، برفض ثم بقبول */
  await p.click("[data-wi=custom]"); await p.fill("#wi-msg", "Hello Sam, edited right before sending."); await p.waitForTimeout(200);
  const href2 = await p.evaluate(() => decodeURIComponent(document.getElementById("wi-go").getAttribute("href").split("?text=")[1]));
  await p.evaluate(() => { window.__ans = false; window.__conf = []; }); const n1 = srv.db.reqs.length; await p.click("[data-wi=sent]"); await p.waitForTimeout(300);
  const noSend = srv.db.reqs.slice(n1).filter(r => r.m === "PATCH").length;
  await p.evaluate(() => { window.__ans = true; }); await p.click("[data-wi=sent]"); await p.waitForTimeout(500);
  const sp = srv.db.reqs.slice(n1).filter(r => r.m === "PATCH"); const S1 = await p.evaluate(() => { const r = AdminWaqsInbox.S.rows.find(x => x.ref === "d1"); return { st: r.status, sb: r.sent_body, body: r.body, pill: document.querySelector("#waqsin .wi-pill").textContent }; });
  t("التخصيص الاختياري يغيّر الرابط؛ رفض التأكيد لا يرسل شيئاً؛ والتأكيد يسجّل Sent مع نسخة النص المُرسَل فعلاً (الأصل لم يتغيّر)", href2 === "Hello Sam, edited right before sending." && noSend === 0 && sp.length === 1 && sp[0].body.status === "sent" && sp[0].body.sent_body === "Hello Sam, edited right before sending." && S1.st === "sent" && S1.sb === sp[0].body.sent_body && /First message/.test(S1.body), { href2, noSend, sp: sp.map(x => x.body), S1 });
  t("أزرار الحالة التالية تظهر بعد Sent (Waiting/Positive/Negative/Follow-up) ولا يظهر تأكيد الإرسال مرة ثانية", await p.evaluate(() => ["waiting", "positive", "negative", "followup"].every(k => document.querySelector("[data-wi=to][data-k=" + k + "]")) && !document.querySelector("[data-wi=sent]")));

  /* 6) الحارس: رسالة ثانية لنفس الجهة بعد إرسال حديث */
  await p.evaluate(() => { window.__conf = []; window.__ans = false; }); await p.click("[data-wi=back]"); await p.click("[data-wi=st][data-k=ready]"); await p.waitForTimeout(200);
  await p.evaluate(() => { [...document.querySelectorAll("#waqsin [data-wi=open]")].find(r => /Follow-up/.test(r.innerText)).click(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { document.getElementById("wi-go").click(); }); await p.waitForTimeout(300);
  const G = await p.evaluate(() => ({ conf: window.__conf.slice(), st: AdminWaqsInbox.S.rows.find(r => r.ref === "d2").status }));
  t("حارس التكرار: تنبيه بآخر نص مُرسَل لنفس الجهة، والرفض لا يفتح ولا يغيّر الحالة", G.conf.length === 1 && /Hello Sam, edited right before sending/.test(G.conf[0]) && G.st === "ready", G);

  /* 7) تحديث الحالات + الإلغاء بتأكيد */
  await p.evaluate(() => { window.__ans = true; }); await p.click("[data-wi=back]"); await p.click("[data-wi=st][data-k=sent]"); await p.waitForTimeout(200);
  await p.click("[data-wi=open]"); await p.waitForTimeout(300); const n2 = srv.db.reqs.length; await p.click("[data-wi=to][data-k=waiting]"); await p.waitForTimeout(300); await p.click("[data-wi=to][data-k=positive]"); await p.waitForTimeout(300);
  const tp = srv.db.reqs.slice(n2).filter(r => r.m === "PATCH").map(r => r.body.status);
  t("تحديث الحالة يدوياً: waiting ثم positive (طلبان فقط)", tp.join(",") === "waiting,positive" && (await p.evaluate(() => AdminWaqsInbox.S.rows.find(r => r.ref === "d1").status)) === "positive", tp);
  await p.click("[data-wi=back]");
  /* 8) غير المالك: الاستيراد مرفوض من الخادم */
  { const { p: q } = await page(true, "staff"); await SHOW(q); await q.waitForTimeout(500); await q.click("[data-wi=imp]"); await q.fill("#im-t", JSON.stringify([{ company: "X", phone: "+213550000001", language: "en", body: "hi" }])); await q.waitForTimeout(200); await q.click("#im-ok"); await q.waitForTimeout(700);
    const m = await q.evaluate(() => document.getElementById("im-r").textContent); t("رفض الخادم (403 unauthorized) يظهر كرفض للمالك فقط ولا يُنشئ شيئاً", /مرفوض: هذه الدالة للمالك وحده/.test(m), m); await q.close(); }
  /* 9) لا تخزين للرسائل في المتصفح */
  const ls = await p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = String(localStorage.getItem(k)); } return Object.keys(o).filter(k => /Hello Sam|Bonjour Léa|213550123456/.test(o[k])); });
  t("الرسائل وأرقام الهواتف لا تُخزَّن في localStorage", ls.length === 0, ls);
  /* 9b) الاستيراد المباشر برمز (API) */
  await p.click("[data-wi=api]"); await p.waitForTimeout(500);
  const A0 = await p.evaluate(() => ({ url: document.getElementById("ap-u").value, list: document.getElementById("ap-l").innerText }));
  t("نافذة الاستيراد المباشر تعرض عنوان الدالة وقائمة رموز فارغة", /\/rest\/v1\/rpc\/owner_inbox_ingest$/.test(A0.url) && /لا رموز بعد/.test(A0.list), A0);
  await p.fill("#ap-n", "chatgpt"); await p.click("#ap-c"); await p.waitForTimeout(500);
  const A1 = await p.evaluate(() => ({ tok: (document.getElementById("ap-tk") || {}).value, list: document.getElementById("ap-l").innerText }));
  t("إنشاء رمز: يُعرض مرة واحدة (oi_ + 64 خانة) ويظهر في القائمة نشطاً", /^oi_[0-9a-f]{64}$/.test(A1.tok || "") && /chatgpt/.test(A1.list) && /نشط/.test(A1.list), A1);
  await p.fill("#ap-n", "ChatGPT"); await p.click("#ap-c"); await p.waitForTimeout(400);
  t("اسم رمز مكرَّر نشط يُرفض برسالة واضحة", /مستعمل لرمز نشط/.test(await p.evaluate(() => document.getElementById("ap-e").textContent)));
  const OA = await p.evaluate(() => { const o = AdminWaqsInbox.openapi(), op = o.paths["/rest/v1/rpc/owner_inbox_ingest"].post; return { server: o.servers[0].url, hdr: o.components.securitySchemes.IngestToken, key: op.parameters[0].schema.enum[0], cfgKey: CONFIG.SUPABASE_ANON_KEY, cfgUrl: CONFIG.SUPABASE_URL, req: op.requestBody.content["application/json"].schema.properties.p_rows.items.required, max: op.requestBody.content["application/json"].schema.properties.p_rows.maxItems }; });
  t("مخطط OpenAPI: خادم المشروع، ترويسة x-ingest-token، المفتاح العام، الحقول المطلوبة، حدّ 500", OA.server === OA.cfgUrl.replace(/\/$/, "") && OA.hdr.name === "x-ingest-token" && OA.hdr.in === "header" && OA.key === OA.cfgKey && OA.req.join() === "phone,language,body" && OA.max === 500, OA);
  const lsT = await p.evaluate(() => { const bad = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/oi_ab12/.test(String(localStorage.getItem(k)))) bad.push(k); } return bad; });
  await p.click("#ap-x"); await p.click("[data-wi=api]"); await p.waitForTimeout(500);
  const A2 = await p.evaluate(() => ({ shown: !!document.getElementById("ap-tk"), list: document.getElementById("ap-l").innerText }));
  t("الرمز لا يبقى بعد إغلاق النافذة ولا يُخزَّن في المتصفح، والقائمة لا تعرضه", !A2.shown && !/oi_/.test(A2.list) && lsT.length === 0, { A2, lsT });
  const n3 = srv.db.reqs.length; await p.click("[data-rv]"); await p.waitForTimeout(500);
  const rv = srv.db.reqs.slice(n3).filter(r => /token_revoke/.test(r.path)); const A3 = await p.evaluate(() => document.getElementById("ap-l").innerText);
  t("إلغاء الرمز بتأكيد: طلب واحد بمعرّفه، ويظهر ملغى", rv.length === 1 && rv[0].body.p_id === "tk1" && /ملغى/.test(A3), { rv: rv.map(r => r.body), A3 });
  await p.click("#ap-x");
  /* 10) الفرنسية */
  await p.evaluate(async () => { AdminWaqsInbox.S.st = "ready"; AdminWaqsInbox.S.sel = null; await AdminI18n.set("fr"); }); await p.waitForTimeout(1500);
  const fx = await p.evaluate(() => document.getElementById("waqsin").innerText + "\n" + document.querySelector("#waqsin .wi-qh").textContent);
  t("الواجهة بالفرنسية بلا بقايا عربية في النصوص الثابتة", /Boîte de messages privée/.test(fx) && /Prêt à envoyer/.test(fx) && /Société/.test(fx) && !/[؀-ۿ]/.test(fx.split("\n").filter(l => !/(Delta|Gamma|Sam|Léa|Spring|Printemps|Algeria|France)/.test(l)).join("\n")), fx.slice(0, 400));
  await p.evaluate(() => AdminI18n.set("ar")); await p.waitForTimeout(500);
  /* 11) غير المالك: لا وحدة */
  { const { p: q } = await page(false, "ok"); const G2 = await q.evaluate(() => ({ off: typeof AdminWaqsInbox === "undefined" || !!AdminWaqsInbox.off, loaded: !![...document.scripts].some(s => /admin-waqs-inbox/.test(s.src)) })); t("غير المالك (SELLER=false): لا يُحمَّل ملف الصندوق ولا يعمل", G2.off && !G2.loaded, G2); await q.close(); }
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
