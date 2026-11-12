/* واجهة وكيل أليسوم (المرحلة 10): لوح «اسألني» الأصلي في الواقع الفضائي.
   تعرض: ما فُهم، المهمة، الأدوات وحالتها، بطاقة الموافقة، النتيجة المتحقَّقة أو الخطأ الدقيق؛ بلا أي «تفكير خاص».
   كل النصوص تُدرج عبر textContent (لا innerHTML بنصوص من البيانات). الحالة: idle/listening/thinking/executing/speaking/awaiting/success/error.
   العنصر دائم (يُعاد إلحاقه بعد أي إعادة رسم للوح) كي لا يضيع الحوار أو الإدخال. */
(() => {
  "use strict";
  const A = window.AlyssumAgent; if (!A) return;
  const cap = A.registerUI(); if (!cap) return;
  const h = (tag, cls, txt, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; if (attrs) Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k])); return e; };
  const STATE_AR = { idle: "جاهز", listening: "أستمع…", thinking: "أحلّل الطلب…", executing: "أنفّذ…", speaking: "أتحدث…", awaiting: "بانتظار ردّك", success: "تم", error: "تعذّر" };
  const RISK_AR = { read: "قراءة", ui: "واجهة", write: "كتابة" }, ST_ICON = { running: "◌", ok: "✓", error: "✕", skipped: "–" };
  const TAG = { fact: "حقيقة", estimate: "تقدير", rec: "توصية" };
  const ARGS_AR = { status: "الحالة", wilaya: "الولاية", period: "الفترة", id: "الطلب", ordinal: "الترتيب", q: "بحث", slug: "المنتج", limit: "الحد", panel: "اللوح", key: "الإعداد", by: "حسب", low: "المنخفض" };
  const STATUS_AR = { nouvelle: "في الانتظار", confirmee: "مؤكدة", expediee: "مرسلة", livree: "مسلَّمة", annulee: "ملغاة", echec: "فاشلة" };
  const PER_AR = { today: "اليوم", yesterday: "أمس", week: "آخر 7 أيام", month: "هذا الشهر", all: "الكل" };

  const view = h("div", "ag"); view.dir = "rtl"; view.dataset.state = "idle";
  view.innerHTML = '<div class="ag-head"><div class="ag-orb" aria-hidden="true"><i></i><i></i><i></i></div><div class="ag-hd"><b>وكيل أليسوم</b><span class="ag-state" role="status" aria-live="polite">جاهز</span></div><button type="button" class="ag-mini" data-act="help" title="دليل المساعدة">دليل</button></div><div class="ag-log" role="log" aria-live="polite"></div><div class="ag-chips"></div><form class="ag-form" autocomplete="off"><input class="ag-in" type="text" maxlength="400" placeholder="اكتب أو قل طلبك… مثل: وريني الطلبات غير المؤكدة" aria-label="طلب للوكيل" enterkeyhint="send"><button type="button" class="ag-mic" title="تحدّث" aria-label="تحدّث">🎙</button><button type="submit" class="ag-send">إرسال</button></form>';
  const log = view.querySelector(".ag-log"), inp = view.querySelector(".ag-in"), form = view.querySelector(".ag-form"), stEl = view.querySelector(".ag-state"), chips = view.querySelector(".ag-chips");
  ["وريني الطلبات غير المؤكدة", "شحال بعنا اليوم؟", "وين وصل المخزون المنخفض؟"].forEach(s => { const b = h("button", "ag-chip", s, { type: "button" }); b.dataset.q = s; chips.appendChild(b); });

  const blocks = {}; /* run.id → عناصر الحوار */
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const argText = a => Object.keys(a || {}).filter(k => a[k] !== undefined && a[k] !== "").map(k => (ARGS_AR[k] || k) + "=" + (k === "status" ? STATUS_AR[a[k]] || a[k] : k === "period" ? PER_AR[a[k]] || a[k] : String(a[k]))).join(" · ");
  function runBox(id, text) {
    if (blocks[id]) return blocks[id];
    while (log.children.length >= 40) { const o = log.firstElementChild; delete blocks[o.dataset.run]; o.remove(); } /* سقف للذاكرة: آخر 40 تشغيلاً */
    const box = h("div", "ag-run"); box.dataset.run = id;
    const isSys = /^\(/.test(text || ""); if (!isSys) box.appendChild(h("div", "ag-msg u", text));
    const und = h("div", "ag-und"), steps = h("ul", "ag-steps"), res = h("div", "ag-res"); box.append(und, steps, res); log.appendChild(box);
    return (blocks[id] = { box, und, steps, res, rows: {} });
  }
  function stepRow(b, s) {
    let li = b.rows[s.id]; if (!li) { li = h("li", "ag-step"); li.append(h("i", "ag-si"), h("span", "ag-sn"), h("em", "ag-sr"), h("small", "ag-sm")); b.steps.appendChild(li); b.rows[s.id] = li; }
    li.dataset.status = s.status; li.dataset.tool = s.tool; li.querySelector(".ag-si").textContent = ST_ICON[s.status] || "·";
    li.querySelector(".ag-sn").textContent = (s.title && s.title.ar) || s.tool; li.querySelector(".ag-sr").textContent = RISK_AR[s.risk] || "";
    li.querySelector(".ag-sm").textContent = s.status === "error" ? (s.error || "") : s.status === "running" ? "" : ((s.summary ? s.summary + " · " : "") + s.ms + "ms");
    li.title = s.tool;
  }
  function renderResult(b, run) {
    b.res.textContent = "";
    (run.result.blocks || []).forEach(x => { const d = h("div", "ag-b " + x.k); if (TAG[x.k]) d.appendChild(h("span", "ag-tag", TAG[x.k])); d.appendChild(h("span", "ag-t", x.t)); b.res.appendChild(d); });
    (run.notes || []).forEach(n => b.res.appendChild(h("div", "ag-b note", n)));
    if (run.result.verified) b.box.classList.add("verified");
    if (run.confirm) confirmCard(b, run);
  }
  function confirmCard(b, run) {
    const c = run.confirm, card = h("div", "ag-confirm"); card.dataset.token = c.token;
    card.append(h("b", "ag-ct", c.title), h("div", "ag-cs", c.summary.id + " — " + c.summary.name + " — " + c.summary.total + " DA"));
    const left = h("small", "ag-left"), yes = h("button", "ag-yes", "موافقة وتنفيذ", { type: "button" }), no = h("button", "ag-no", "إلغاء", { type: "button" }), row = h("div", "ag-crow"); row.append(yes, no, left); card.appendChild(row); b.res.appendChild(card);
    const tick = () => { const s = Math.max(0, Math.ceil((c.exp - Date.now()) / 1000)); left.textContent = s > 0 ? "تنتهي الموافقة بعد " + s + "ث" : "انتهت المهلة"; if (s <= 0 || card.dataset.done) { yes.disabled = no.disabled = true; clearInterval(iv); } };
    const iv = setInterval(tick, 500); tick();
    yes.onclick = ev => { if (!ev.isTrusted) return; card.dataset.done = "1"; yes.disabled = no.disabled = true; cap.approve(c.token); };
    no.onclick = ev => { if (!ev.isTrusted) return; card.dataset.done = "1"; yes.disabled = no.disabled = true; cap.reject(c.token); };
  }

  const setView = s => { view.dataset.state = s; stEl.textContent = STATE_AR[s] || s; document.body.dataset.agent = s; };
  A.on(ev => {
    if (ev.type === "state") { setView(ev.state); if (ev.state === "success" || ev.state === "error") { clearTimeout(setView.t); setView.t = setTimeout(() => { if (A.state() === ev.state && !A.pending()) { cap.setState("idle"); } }, 6000); } }
    else if (ev.type === "expired") { log.querySelectorAll(".ag-confirm:not([data-done])").forEach(c => { c.dataset.done = "1"; c.querySelectorAll("button").forEach(x => { x.disabled = true; }); }); }
    else if (ev.type === "run" && ev.phase === "start") { log.querySelectorAll(".ag-confirm:not([data-done])").forEach(c => { c.dataset.done = "1"; c.querySelectorAll("button").forEach(x => { x.disabled = true; }); }); runBox(ev.run.id, ev.run.text); scroll(); }
    else if (ev.type === "understood") { const b = blocks[ev.run]; if (b) { b.und.textContent = ""; b.und.append(h("span", "ag-uk", "فهمت"), h("b", "ag-ul", ev.understood.label), h("span", "ag-ua", argText(ev.understood.args))); b.und.title = ev.understood.intent + " · ثقة " + Math.round((ev.understood.conf || 0) * 100) + "%"; } scroll(); }
    else if (ev.type === "step") { const b = blocks[ev.run]; if (b) stepRow(b, ev.step); scroll(); }
    else if (ev.type === "run" && ev.phase === "end") { const b = runBox(ev.run.id, ev.run.text); if (ev.run.understood && !b.und.textContent) b.und.append(h("span", "ag-uk", "المهمة"), h("b", "ag-ul", ev.run.understood.label)); ev.run.steps.forEach(s => stepRow(b, s)); renderResult(b, ev.run); b.box.dataset.status = ev.run.status; scroll(); speak(ev.run); }
  });

  /* ───── إرسال ───── */
  async function send(q) { q = String(q || "").trim(); if (!q) return; inp.value = ""; await cap.submit(q); inp.focus(); }
  form.addEventListener("submit", e => { e.preventDefault(); send(inp.value); });
  view.addEventListener("click", e => { const c = e.target.closest(".ag-chip"); if (c && e.isTrusted) send(c.dataset.q); const hb = e.target.closest("[data-act=help]"); if (hb && typeof SpatialOS !== "undefined") SpatialOS.open("help"); });
  view.addEventListener("keydown", e => { e.stopPropagation(); });

  /* ───── الصوت (اختياري؛ يعتمد المتصفح — لم يُختبر بميكروفون حقيقي) ───── */
  let rec = null, speakOn = false;
  const mic = view.querySelector(".ag-mic"), SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) mic.style.display = "none"; else mic.addEventListener("click", ev => {
    if (!ev.isTrusted) return;
    if (rec) { try { rec.stop(); } catch (_) { } return; }
    try { rec = new SR(); rec.lang = "ar-DZ"; rec.interimResults = false; rec.maxAlternatives = 1; cap.setState("listening"); setView("listening"); mic.classList.add("on");
      rec.onresult = r => { const t = r.results[0] && r.results[0][0] && r.results[0][0].transcript; if (t) { inp.value = t; send(t); } };
      rec.onend = () => { rec = null; mic.classList.remove("on"); if (view.dataset.state === "listening") { setView("idle"); cap.setState("idle"); } }; rec.onerror = () => { rec = null; mic.classList.remove("on"); setView("idle"); };
      rec.start(); } catch (_) { rec = null; mic.classList.remove("on"); }
  });
  const sp = h("button", "ag-mini", "صوت: مغلق", { type: "button", title: "قراءة الرد بصوت عالٍ" }); sp.dataset.act = "speak"; view.querySelector(".ag-head").insertBefore(sp, view.querySelector("[data-act=help]"));
  if (!window.speechSynthesis) sp.style.display = "none"; else sp.addEventListener("click", e => { if (!e.isTrusted) return; speakOn = !speakOn; sp.textContent = "صوت: " + (speakOn ? "مفعّل" : "مغلق"); if (!speakOn) try { speechSynthesis.cancel(); } catch (_) { } });
  function speak(run) {
    if (!speakOn || !window.speechSynthesis || !run.result.blocks) return;
    try { const first = run.result.blocks.filter(b => b.k !== "rec").slice(0, 2).map(b => b.t).join(". "); const u = new SpeechSynthesisUtterance(first); u.lang = run.lang === "fr" ? "fr-FR" : "ar"; u.onstart = () => { setView("speaking"); cap.setState("speaking"); }; u.onend = () => { setView("idle"); cap.setState("idle"); }; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (_) { }
  }

  /* ───── الإلحاق باللوح الفضائي ───── */
  function mount() { const slot = document.querySelector(".ag-slot"); if (slot && view.parentNode !== slot) { slot.appendChild(view); scroll(); } }
  window.AgentPanel = Object.freeze({ html: () => { queueMicrotask(mount); setTimeout(mount, 0); return '<div class="ag-slot"></div>'; }, mount, view, send, version: 1 });
})();
