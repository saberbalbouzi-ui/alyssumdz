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
  const RISK_AR = { read: "قراءة", ui: "واجهة", write: "كتابة", model: "نموذج" }, ST_ICON = { running: "◌", ok: "✓", error: "✕", skipped: "–" };
  const TAGL = { ar: { fact: "حقيقة", estimate: "تقدير", rec: "توصية", llm: "النموذج" }, fr: { fact: "Fait", estimate: "Estimation", rec: "Conseil", llm: "Modèle" }, en: { fact: "Fact", estimate: "Estimate", rec: "Recommendation", llm: "Model" } }, UND = { ar: "فهمت", fr: "Compris", en: "Understood" }, TSK = { ar: "المهمة", fr: "Tâche", en: "Task" };
  const ARGS_AR = { status: "الحالة", wilaya: "الولاية", period: "الفترة", id: "الطلب", ordinal: "الترتيب", q: "بحث", slug: "المنتج", limit: "الحد", panel: "اللوح", key: "الإعداد", by: "حسب", low: "المنخفض" };
  const STATUS_AR = { nouvelle: "في الانتظار", confirmee: "مؤكدة", expediee: "مرسلة", livree: "مسلَّمة", annulee: "ملغاة", echec: "فاشلة" };
  const PER_AR = { today: "اليوم", yesterday: "أمس", week: "آخر 7 أيام", month: "هذا الشهر", all: "الكل" };

  const view = h("div", "ag"); view.dir = "rtl"; view.dataset.state = "idle";
  view.innerHTML = '<div class="ag-head"><div class="ag-orb" aria-hidden="true"><i></i><i></i><i></i></div><div class="ag-hd"><b>وكيل أليسوم</b><span class="ag-state" role="status" aria-live="polite">جاهز</span></div><button type="button" class="ag-mini" data-act="help" title="دليل المساعدة">دليل</button></div><div class="ag-log" role="log" aria-live="polite"></div><div class="ag-chips"></div><div class="ag-vstat" role="status" aria-live="polite" hidden></div><div class="ag-vtools"><button type="button" class="ag-mini ag-exp" aria-pressed="false">توسيع المحادثة</button><button type="button" class="ag-mini ag-rep" aria-pressed="false">ردود صوتية: مغلقة</button><button type="button" class="ag-mini ag-stop" hidden>إيقاف الكلام</button><select class="ag-lang" aria-label="لغة الصوت"><option value="ar-DZ">عربية/دارجة</option><option value="fr-FR">Français</option><option value="en-US">English</option></select><span class="ag-caps"></span></div><form class="ag-form" autocomplete="off"><input class="ag-in" type="text" maxlength="400" placeholder="اكتب أو قل طلبك… مثل: وريني الطلبات غير المؤكدة" aria-label="طلب للوكيل" enterkeyhint="send"><button type="button" class="ag-mic" title="تحدّث" aria-label="تحدّث">🎙</button><button type="submit" class="ag-send">إرسال</button></form>';
  const log = view.querySelector(".ag-log"), inp = view.querySelector(".ag-in"), form = view.querySelector(".ag-form"), stEl = view.querySelector(".ag-state"), chips = view.querySelector(".ag-chips");
  ["وريني الطلبات غير المؤكدة", "شحال بعنا اليوم؟", "وين وصل المخزون المنخفض؟"].forEach(s => { const b = h("button", "ag-chip", s, { type: "button" }); b.dataset.q = s; chips.appendChild(b); });

  const blocks = {}; /* run.id → عناصر الحوار */
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const ST_EN = { nouvelle: "pending", confirmee: "confirmed", expediee: "shipped", livree: "delivered", annulee: "cancelled", echec: "failed" }, PER_EN = { today: "today", yesterday: "yesterday", week: "last 7 days", month: "this month", all: "all" };
  const argText = (a, lang) => Object.keys(a || {}).filter(k => a[k] !== undefined && a[k] !== "").map(k => lang === "ar" || !lang ? (ARGS_AR[k] || k) + "=" + (k === "status" ? STATUS_AR[a[k]] || a[k] : k === "period" ? PER_AR[a[k]] || a[k] : String(a[k])) : k + "=" + (k === "status" ? ST_EN[a[k]] || a[k] : k === "period" ? PER_EN[a[k]] || a[k] : String(a[k]))).join(" · ");
  function runBox(id, text) {
    if (blocks[id]) return blocks[id];
    while (log.children.length >= 40) { const o = log.firstElementChild; delete blocks[o.dataset.run]; o.remove(); } /* سقف للذاكرة: آخر 40 تشغيلاً */
    const box = h("div", "ag-run"); box.dataset.run = id;
    const isSys = /^\(/.test(text || ""); if (!isSys) { const um = h("div", "ag-msg u", text); um.dir = "auto"; box.appendChild(um); }
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
    (run.result.blocks || []).forEach(x => { const d = h("div", "ag-b " + x.k); d.dir = "auto"; const tg = (TAGL[run.lang] || TAGL.ar)[x.k]; if (tg) d.appendChild(h("span", "ag-tag", tg)); d.appendChild(h("span", "ag-t", x.t)); b.res.appendChild(d); });
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
    else if (ev.type === "understood") { const b = blocks[ev.run]; if (b) { b.und.textContent = ""; b.und.append(h("span", "ag-uk", UND[ev.understood.lang] || UND.ar), h("b", "ag-ul", ev.understood.label), h("span", "ag-ua", argText(ev.understood.args, ev.understood.lang))); b.und.title = ev.understood.intent + " · ثقة " + Math.round((ev.understood.conf || 0) * 100) + "%"; } scroll(); }
    else if (ev.type === "step") { const b = blocks[ev.run]; if (b) stepRow(b, ev.step); scroll(); }
    else if (ev.type === "run" && ev.phase === "end") { const b = runBox(ev.run.id, ev.run.text); if (ev.run.understood && !b.und.textContent) b.und.append(h("span", "ag-uk", TSK[ev.run.lang] || TSK.ar), h("b", "ag-ul", ev.run.understood.label)); ev.run.steps.forEach(s => stepRow(b, s)); renderResult(b, ev.run); b.box.dataset.status = ev.run.status; scroll(); onRunEnd(ev.run); }
  });

  /* ───── إرسال ───── */
  async function send(q) { q = String(q || "").trim(); if (!q) return; inp.value = ""; await cap.submit(q); inp.focus(); }
  form.addEventListener("submit", e => { e.preventDefault(); send(inp.value); });
  view.addEventListener("click", e => { const c = e.target.closest(".ag-chip"); if (c && e.isTrusted) send(c.dataset.q); const hb = e.target.closest("[data-act=help]"); if (hb && typeof SpatialOS !== "undefined") SpatialOS.open("help"); });
  view.addEventListener("keydown", e => { e.stopPropagation(); });

  /* ───── الصوت والحضور المكاني (المرحلة 11) ───── */
  const V = window.AgentVoice, C3 = window.Core3D, mic = view.querySelector(".ag-mic"), vstat = view.querySelector(".ag-vstat"), vtools = view.querySelector(".ag-vtools"), langSel = view.querySelector(".ag-lang");
  let voiceTurn = false, repliesOn = false, pttDown = false, pttTimer = 0, expanded = false, lastCaps = null;
  const note = (t, k) => { vstat.textContent = t || ""; vstat.dataset.k = k || ""; vstat.hidden = !t; };
  const TXT = { ar: { ok: "اسمع: ", noTts: "النطق غير متاح", approve: "سأؤكد الطلب %s. للأمان انقر زر «موافقة وتنفيذ» في البطاقة.", err: "تعذّر", listen: "أستمع…", proc: "أحوّل الصوت إلى نص…", interrupted: "قاطعتني — أستمع" }, fr: { approve: "Je confirmerai la commande %s. Par sécurité, cliquez sur le bouton d'accord.", err: "Échec" }, en: { approve: "I will confirm order %s. For safety, click the approval button on the card.", err: "Failed" } };
  function speechText(run) {
    const L = run.lang === "fr" || run.lang === "en" ? run.lang : "ar", bl = run.result.blocks || [];
    if (run.confirm) return (TXT[L].approve || TXT.ar.approve).replace("%s", run.confirm.summary.id.slice(-5));
    const llm = bl.find(x => x.k === "llm"); if (llm) return llm.t;
    return bl.filter(x => x.k !== "rec" && x.k !== "estimate").slice(0, 2).map(x => x.t).join(". ");
  }
  function onRunEnd(run) { const v = voiceTurn; voiceTurn = false; if (!V || !(v || repliesOn) || !run.result.blocks || !run.result.blocks.length) return; const t = speechText(run); if (t) V.speak(t, run.lang === "fr" || run.lang === "en" ? run.lang : "ar").then(r => { if (r && r.reason === "no-tts") note("النطق غير متاح في هذا المتصفح/الخادم — الرد مكتوب فقط", "warn"); }); }
  function refreshCaps() { if (!V) return; const c = V.caps(); lastCaps = c; const e = c.engine === "server" ? "خادم" : c.engine === "webspeech" ? "المتصفح" : "—", t = c.tts === "server" ? "خادم" : c.tts === "browser" ? "المتصفح" : "—"; vtools.querySelector(".ag-caps").textContent = "تعرّف: " + e + " · نطق: " + t + (c.perm === "denied" ? " · الميكروفون محجوب" : ""); mic.disabled = !(c.getUserMedia && c.audioContext); mic.title = mic.disabled ? "هذا المتصفح لا يدعم تسجيل الصوت" : "انقر للتحدث · اضغط مطولاً (أو Space) للتحدث والإفلات للإرسال"; }
  if (V) {
    V.on(ev => {
      if (ev.type === "state") { mic.classList.toggle("on", ev.mode === "listening"); mic.dataset.mode = ev.mode; if (ev.mode === "listening") { cap.setState("listening"); note("أستمع… (" + (ev.ptt ? "اضغط مستمراً" : "سيتوقف عند الصمت") + ")", "live"); } else if (ev.mode === "processing") { note("أحوّل الصوت إلى نص…", "live"); } else if (ev.mode === "speaking") { cap.setState("speaking"); note("أتحدث… (انقر الميكروفون أو Esc للمقاطعة)", "live"); } else { cap.setState("idle"); if (!/تعذّر|لم |رُفض|غير/.test(vstat.textContent)) note(""); } vtools.querySelector(".ag-stop").hidden = ev.mode !== "speaking"; }
      else if (ev.type === "level") mic.style.setProperty("--lv", ev.level);
      else if (ev.type === "interim") note("« " + ev.text + " »", "live");
      else if (ev.type === "transcript") { voiceTurn = true; note("سمعتُ: « " + ev.text + " »", "ok"); cap.submit(ev.text, "voice"); }
      else if (ev.type === "error") { note(ev.message, "error"); }
      else if (ev.type === "interrupt") { note("قاطعتني — أستمع", "live"); }
      else if (ev.type === "caps" || ev.type === "perm") refreshCaps();
    });
    refreshCaps(); if (window.speechSynthesis) speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", refreshCaps);
    const startPtt = () => { if (V.state().mode === "listening" || pttDown) return; pttDown = true; V.startListening({ ptt: true, lang: langSel.value }).then(r => { /* النص يُعالَج في حدث transcript */ }).catch(() => { }); };
    const endPtt = () => { if (!pttDown) return; pttDown = false; V.stopListening(); };
    mic.addEventListener("pointerdown", ev => { if (!ev.isTrusted || mic.disabled) return; mic.setPointerCapture && mic.setPointerCapture(ev.pointerId); pttTimer = setTimeout(() => { pttTimer = 0; startPtt(); }, 280); });
    mic.addEventListener("pointerup", ev => { if (!ev.isTrusted) return; if (pttDown) { endPtt(); return; } if (pttTimer) { clearTimeout(pttTimer); pttTimer = 0; const m = V.state().mode; if (m === "listening") V.stopListening(); else { if (m === "speaking") V.interrupt("user"); V.startListening({ ptt: false, lang: langSel.value }).catch(() => { }); } } });
    mic.addEventListener("pointercancel", () => { clearTimeout(pttTimer); pttTimer = 0; endPtt(); });
    const typing = t => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    const agentVisible = () => { const p = typeof SpatialOS !== "undefined" && SpatialOS.panels && SpatialOS.panels.get("ai"); return !!view.isConnected && !!p && !p.min; };
    document.addEventListener("keydown", e => { const k = String(e.key || ""); if (k === " " && !e.repeat && !typing(e.target) && agentVisible() && !(e.target && e.target.closest && e.target.closest("button,[role=dialog] iframe"))) { e.preventDefault(); startPtt(); } else if (k === "Escape") { const m = V.state().mode; if (m === "listening") V.cancelListening("aborted"); else if (m === "speaking") V.interrupt("user"); else if (expanded) setExpanded(false); } }, true);
    document.addEventListener("keyup", e => { if (String(e.key || "") === " " && pttDown) { e.preventDefault(); endPtt(); } }, true);
    langSel.addEventListener("change", () => V.setLang(langSel.value));
    vtools.querySelector(".ag-stop").addEventListener("click", ev => { if (ev.isTrusted) V.interrupt("user"); });
    vtools.querySelector(".ag-rep").addEventListener("click", ev => { if (!ev.isTrusted) return; repliesOn = !repliesOn; ev.currentTarget.setAttribute("aria-pressed", String(repliesOn)); ev.currentTarget.textContent = "ردود صوتية: " + (repliesOn ? "مفعّلة" : "مغلقة"); if (!repliesOn) V.stopSpeaking(); });
  } else { mic.style.display = "none"; vtools.style.display = "none"; }
  function setExpanded(on) { expanded = !!on; if (C3) C3.setExpanded(expanded); const b = vtools.querySelector(".ag-exp"); b.setAttribute("aria-pressed", String(expanded)); b.textContent = expanded ? "تصغير النواة" : "توسيع المحادثة"; }
  vtools.querySelector(".ag-exp").addEventListener("click", ev => { if (ev.isTrusted) setExpanded(!expanded); });
  if (!C3) vtools.querySelector(".ag-exp").style.display = "none";
  window.AgentUI = Object.freeze({ speechText, setExpanded, expanded: () => expanded, note, version: 1 });

  /* ───── الإلحاق باللوح الفضائي ───── */
  function mount() { const slot = document.querySelector(".ag-slot"); if (slot && view.parentNode !== slot) { slot.appendChild(view); scroll(); } }
  window.AgentPanel = Object.freeze({ html: () => { queueMicrotask(mount); setTimeout(mount, 0); return '<div class="ag-slot"></div>'; }, mount, view, send, version: 1 });
})();
