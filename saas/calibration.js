/* «المعايرة» داخل لوحة مزوّد المنصة (لك أنت فقط؛ لا تُشحن لمواقع الزبائن): بلاغات المعايرة التي ترسلها لوحات الزبائن صامتةً.
   الحالات المجهولة: اقتراح برمجي (كلمات مفتاحية، بلا ذكاء اصطناعي) واعتماد بنقرة ← يُعمَّم تلقائياً على كل الزبائن الذين لديهم الشركة نفسها
   (تقرأ لوحاتهم القرارات من المنصة وتدمجها في ملف اتصالهم). بقية المشاكل مجمَّعة بعدد المواقع المتأثرة. */
window.SaasCalib = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { issues: [], fixes: [], busy: false, err: "" };
  let sb = null, root = null;
  const say = t => { const b = $("toasts"); if (!b) return alert(t); const d = document.createElement("div"); d.className = "toast"; d.textContent = t; b.appendChild(d); setTimeout(() => d.remove(), 6000); };
  const UNI = { pending: "قيد التحضير", shipped: "شُحن / في الطريق", out_for_delivery: "خرج للتوصيل", delivered: "سُلِّم", failed_attempt: "محاولة فاشلة", returned: "مرتجع", cancelled: "ملغى" };
  /* تطبيع مطابق لـStatusMapper::normalize (PHP) وnormText (بوابة JS) — يجب أن يبقى واحداً */
  const ACC = { é: "e", è: "e", ê: "e", ë: "e", à: "a", â: "a", ä: "a", î: "i", ï: "i", ô: "o", ö: "o", û: "u", ù: "u", ü: "u", ç: "c", œ: "oe" };
  const norm = raw => String(raw == null ? "" : raw).trim().toLowerCase().replace(/[éèêëàâäîïôöûùüçœ]/g, c => ACC[c]).replace(/\(\s*\d+\s*\)/g, " ").replace(/[_\-\[\]()]/g, " ").replace(/\s+/g, " ").trim();
  /* اقتراح بالكلمات المفتاحية (فرنسي/عربي/إنجليزي) — تخمين يراجعه المدير قبل الاعتماد، وليس قراراً آلياً */
  const RULES = [[/annul|cancel|supprim|ملغ|الغ/, "cancelled"], [/retour|return|refus|rejet|مرتجع|رفض|ارجاع|إرجاع/, "returned"], [/ech|fail|absent|injoign|tentative|فاشل|فشل|غائب/, "failed_attempt"],
    [/livr.*cours|out for|distribution|tourn|جاري التوصيل|خرج/, "out_for_delivery"], [/livr|deliver|recu par|encaiss|سلم|تسليم|مسلم/, "delivered"], [/prepar|attente|cree|nouveau|new|pending|valid|تحضير|انتظار|جديد/, "pending"],
    [/exped|transit|centre|hub|depart|arriv|route|ramass|prise|شحن|مركز|طريق|استلم/, "shipped"]];
  const suggest = raw => { const t = norm(raw); for (const [re, u] of RULES) if (re.test(t)) return u; return ""; };

  async function load() {
    S.busy = true; draw();
    const [a, b] = await Promise.all([sb.rpc("saas_calib_issues", { p_days: 60 }), sb.rpc("saas_fixes_admin")]);
    S.busy = false;
    if (a.error || b.error) { S.err = (a.error || b.error).message || "تعذّر التحميل — شغّل carrier-fixes.sql في SQL Editor"; S.issues = []; S.fixes = []; }
    else { S.err = ""; S.issues = a.data || []; S.fixes = b.data || []; }
    draw();
  }
  function groups() {
    const unk = new Map(), oth = new Map(), fixedKeys = new Set(S.fixes.map(f => f.carrier + "|" + f.norm));
    for (const t of S.issues) {
      const p = t.payload || {}, carrier = p.carrier || "؟", open = t.status !== "resolved" && t.status !== "rejected";
      for (const u of p.unknown || []) {
        const c = u.carrier || carrier, n = norm(u.raw); if (!n || fixedKeys.has(c + "|" + n) || fixedKeys.has("*|" + n)) continue;
        const k = c + "|" + n; const g = unk.get(k) || { carrier: c, raw: u.raw, norm: n, n: 0, sites: new Set(), tickets: new Set() };
        g.n += +u.n || 0; g.sites.add(t.origin || t.site); g.tickets.add(t.id); unk.set(k, g);
      }
      if (!open) continue;
      for (const i of p.issues || []) {
        if (/حالة طرد غير معروفة|حالات موجودة في حسابك ولا يعرفها/.test(i) || /^حالات طرود غير معروفة/.test(t.subject || "") && /«/.test(i)) continue;   // تُعالَج في جدول الحالات
        const key = carrier + "|" + String(i).replace(/\d+/g, "N").slice(0, 120);
        const g = oth.get(key) || { carrier, text: i, sites: new Set(), tickets: new Set(), n: 0 }; g.sites.add(t.origin || t.site); g.tickets.add(t.id); g.n++; oth.set(key, g);
      }
    }
    return { unk: [...unk.values()].sort((a, b) => b.sites.size - a.sites.size || b.n - a.n), oth: [...oth.values()].sort((a, b) => b.sites.size - a.sites.size) };
  }
  function draw() {
    if (!root) return;
    if (S.busy && !S.issues.length && !S.fixes.length) { root.innerHTML = '<div class="card"><p class="hint">جارٍ التحميل…</p></div>'; return; }
    if (S.err) { root.innerHTML = '<div class="card"><b>المعايرة</b><p class="hint" style="color:#f87171">' + esc(S.err) + '</p><button class="btn" data-cb="reload">إعادة المحاولة</button></div>'; return; }
    const g = groups();
    const opts = sel => '<option value="">— اختر —</option>' + Object.entries(UNI).map(([k, v]) => '<option value="' + k + '"' + (k === sel ? " selected" : "") + '>' + esc(v) + '</option>').join("");
    const unkRows = g.unk.map((x, i) => '<tr><td><b>' + esc(x.carrier) + '</b></td><td dir="auto">' + esc(x.raw) + '</td><td>' + x.sites.size + '</td><td>' + x.n + '</td><td><select data-cb-sel="' + i + '">' + opts(suggest(x.raw)) + '</select>' + (suggest(x.raw) ? ' <span class="hint">اقتراح</span>' : "") + '</td>' +
      '<td><button class="btn" data-cb="fix" data-i="' + i + '">اعتمد وعمِّم</button></td></tr>').join("");
    const othRows = g.oth.map((x, i) => '<tr><td><b>' + esc(x.carrier) + '</b></td><td>' + esc(x.text) + '</td><td>' + x.sites.size + '</td><td>' + x.n + '</td><td><button class="btn g s" data-cb="close" data-i="' + i + '">تمّت المعالجة</button></td></tr>').join("");
    const fixRows = S.fixes.map(f => '<tr><td><b>' + esc(f.carrier) + '</b></td><td dir="auto">' + esc(f.raw) + '</td><td>' + esc(UNI[f.unified] || f.unified) + '</td><td class="hint">' + esc((f.created_at || "").slice(0, 10)) + '</td><td><button class="btn g s" data-cb="del" data-id="' + f.id + '">حذف</button></td></tr>').join("");
    root.innerHTML = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap"><b>🧭 المعايرة — بلاغات حسابات الزبائن مع شركات التوصيل</b><button class="btn g s" data-cb="reload">تحديث</button></div>' +
      '<p class="hint">هذه الصفحة لك وحدك. الزبون لا يقرأ أي تقرير؛ ما يكتشفه النظام عند ربط حسابه يصلك هنا تلقائياً. اعتماد حالة يُطبَّق على كل الزبائن الذين لديهم الشركة نفسها خلال دقائق من فتحهم للوحتهم، ولا يتطلب تحديث الكود.</p></div>' +
      '<div class="card"><b>حالات طرود مجهولة (' + g.unk.length + ')</b><p class="hint">الاقتراح تخمين بالكلمات المفتاحية — راجعه قبل الاعتماد. «المواقع» = عدد المواقع التي رأتها.</p>' +
      (g.unk.length ? '<div style="overflow:auto"><table><thead><tr><th>الشركة</th><th>النص عند الشركة</th><th>المواقع</th><th>الطرود</th><th>المعنى</th><th></th></tr></thead><tbody>' + unkRows + '</tbody></table></div>' : '<p class="hint">لا حالات مجهولة معلّقة ✓</p>') + '</div>' +
      '<div class="card"><b>مشاكل أخرى مجمّعة (' + g.oth.length + ')</b><p class="hint">بلديات غير موجودة، فشل قراءة التتبع، إشعارات غير مفهومة… تحتاج تصحيح الكتالوج أو المحوّل في الكود؛ «تمّت المعالجة» تغلق التذاكر المرتبطة.</p>' +
      (g.oth.length ? '<div style="overflow:auto"><table><thead><tr><th>الشركة</th><th>المشكلة</th><th>المواقع</th><th>مرات</th><th></th></tr></thead><tbody>' + othRows + '</tbody></table></div>' : '<p class="hint">لا مشاكل مفتوحة ✓</p>') + '</div>' +
      '<div class="card"><b>القرارات المعتمدة (' + S.fixes.length + ')</b>' + (S.fixes.length ? '<div style="overflow:auto"><table><thead><tr><th>الشركة</th><th>النص</th><th>المعنى</th><th>التاريخ</th><th></th></tr></thead><tbody>' + fixRows + '</tbody></table></div>' : '<p class="hint">لا قرارات بعد.</p>') + '</div>';
    root._g = g;
  }
  async function onClick(e) {
    const b = e.target.closest("[data-cb]"); if (!b) return; const k = b.dataset.cb, g = root._g || { unk: [], oth: [] };
    if (k === "reload") return load();
    if (k === "fix") {
      const x = g.unk[+b.dataset.i], sel = root.querySelector('[data-cb-sel="' + b.dataset.i + '"]'); if (!x || !sel || !sel.value) return say("اختر المعنى أولاً");
      if (!confirm("اعتماد «" + x.raw + "» = " + UNI[sel.value] + " لشركة " + x.carrier + " عند كل الزبائن؟")) return;
      const r = await sb.rpc("saas_fix_set", { p_carrier: x.carrier, p_raw: x.raw, p_norm: x.norm, p_unified: sel.value, p_note: null });
      if (r.error) return say("فشل: " + r.error.message);
      for (const id of x.tickets) await sb.rpc("saas_reply", { p_ticket: id, p_body: "اعتُمدت الحالة «" + x.raw + "» = " + UNI[sel.value] + " وعُمِّمت.", p_internal: true, p_status: "resolved" });
      say("اعتُمد وسيُطبَّق على الزبائن تلقائياً"); return load();
    }
    if (k === "del") { if (!confirm("حذف هذا القرار؟ سيزول عن الزبائن عند مزامنتهم القادمة.")) return; const r = await sb.rpc("saas_fix_del", { p_id: +b.dataset.id }); say(r.error ? "فشل: " + r.error.message : "حُذف"); return load(); }
    if (k === "close") { const x = g.oth[+b.dataset.i]; if (!x) return; for (const id of x.tickets) await sb.rpc("saas_reply", { p_ticket: id, p_body: "تمت المعالجة.", p_internal: true, p_status: "resolved" }); say("أُغلقت التذاكر"); return load(); }
  }
  return { mount(el, client) { root = el; sb = client; el.onclick = onClick; load(); }, S, suggest, norm };
})();
