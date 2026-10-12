/* تجميع شركات التوصيل (نسخة الاستضافة): بطاقة في «شركات التوصيل» لتفعيل أي شركة بمفاتيح حسابك (تُحفظ مشفّرة على خادمك)
   وزر «إرسال عبر …» في معاينة الطلب. تعمل فقط حين تكون الخلفية PHP وتتوفر وحدة الشحن على الخادم؛ وإلا لا تظهر. */
const ShipAgg = (() => {
  const $ = id => document.getElementById(id), S = { cat: null, on: [], base: "", err: "" };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const php = () => typeof PHPAPI !== "undefined" && PHPAPI.on();
  const call = async (r, body, q) => { try { return await PHPAPI.call(r, body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }, q); } catch (e) { return { ok: false, status: 0, j: {} }; } };
  const MAT = { documented: "موثّقة", experimental: "تجريبية", planned: "قريباً" };
  const MSG = { already_sent: "الطلب أُرسل سابقاً", order_closed: "الطلب مغلق", unknown_wilaya: "ولاية الطلب غير معروفة", carrier_rejected: "رفضت الشركة الطلب", ship_unavailable: "الخدمة غير متاحة على هذا الخادم", ship_not_installed: "وحدة الشحن غير مثبتة في هذه النسخة" };
  const say = (t, k) => { const m = (k === "err" ? "❌ " : k === "ok" ? "✅ " : "") + t; typeof toast === "function" ? toast(m) : alert(m); };

  async function load() {
    if (!php()) return false;
    const r = await call("ship_carriers", undefined);
    if (!r.ok) { S.cat = null; S.err = (r.j && r.j.error) || ""; return false; }
    S.cat = r.j.carriers || []; S.on = r.j.connected || []; S.base = r.j.webhook_base || ""; S.err = ""; return true;
  }
  const connected = code => S.on.find(x => x.carrier_code === code);

  function css() {
    if ($("sa-css")) return; const st = document.createElement("style"); st.id = "sa-css";
    st.textContent = `.sa-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.6rem;margin-top:.7rem}.sa-c{border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:.7rem .8rem;display:flex;flex-direction:column;gap:.4rem;background:rgba(255,255,255,.04)}.sa-c b{font-size:.95rem}.sa-b{font-size:.72rem;opacity:.85}.sa-c.on{border-color:rgba(80,227,138,.55)}
.sa-mbg{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:14px}.sa-mod{width:min(520px,100%);max-height:92vh;overflow:auto;padding:1.1rem;border-radius:18px;background:rgba(9,24,18,.985);border:1px solid rgba(255,255,255,.18);color:#fff}.sa-mod input{width:100%;margin:.2rem 0 .6rem}.sa-url{direction:ltr;word-break:break-all;background:rgba(0,0,0,.35);padding:.5rem;border-radius:10px;font-size:.78rem;user-select:all}
html.white .sa-mod{background:#fff;color:#0f172a;border-color:#d2d9e3}html.white .sa-c{border-color:#d2d9e3;background:#f3f5f9}`;
    document.head.appendChild(st);
  }

  function draw() {
    const h = $("sa-card"); if (!h || !S.cat) return;
    const cards = S.cat.map(c => {
      const on = connected(c.code);
      const act = !c.activatable ? '<span class="sa-b">غير متاحة بعد</span>' : on
        ? '<div style="display:flex;gap:.4rem;flex-wrap:wrap"><button class="small" type="button" data-sa="conn" data-c="' + esc(c.code) + '">تحديث المفاتيح</button><button class="small" type="button" style="background:var(--red)" data-sa="off" data-c="' + esc(c.code) + '">فصل</button></div>'
        : '<button class="small green" type="button" data-sa="conn" data-c="' + esc(c.code) + '">تفعيل</button>';
      return '<div class="sa-c' + (on ? ' on' : '') + '"><b>' + esc(c.label) + (on ? ' ✅' : '') + '</b><span class="sa-b">' + esc(MAT[c.maturity] || c.maturity) + (c.maturity === "experimental" ? " — جرّبها بطلب واحد أولاً" : "") + '</span>' + act + '</div>';
    }).join("");
    h.innerHTML = '<b style="color:var(--green)">🌐 تجميع شركات التوصيل</b><div class="hint">فعّل أي شركة بمفاتيح حسابك أنت؛ تُحفظ مشفّرة على خادمك ولا تظهر بعد الحفظ. بعد التفعيل يظهر زر «إرسال عبر …» في معاينة كل طلب، وتتحدّث حالة الطلب تلقائياً إذا وضعتَ رابط التحديث (الذي يظهر عند التفعيل) في حسابك لدى الشركة. لا يُرسل الطلب مرتين: يمنع النظام التكرار.</div><div class="sa-grid">' + cards + '</div>';
  }

  function modal(code, label, fields, needBase) {
    css(); const d = document.createElement("div"); d.className = "sa-mbg"; d.id = "sa-mbg";
    d.innerHTML = '<div class="sa-mod"><h3 style="margin:0 0 .6rem">تفعيل ' + esc(label) + '</h3><div id="sa-body">' +
      fields.map(f => '<label class="hint">' + esc(f.label) + (f.required === false ? " (اختياري)" : "") + '</label><input data-f="' + esc(f.key) + '" type="' + (f.secret ? "password" : "text") + '" autocomplete="off" dir="ltr">').join("") +
      (needBase ? '<label class="hint">رابط الخدمة (https://…) — يعطيك إياه مزوّد الشركة</label><input id="sa-base" type="text" dir="ltr" placeholder="https://">' : "") +
      '<div class="hint">تُشفَّر المفاتيح قبل حفظها ولا تُعرض مرة أخرى.</div></div><div style="display:flex;gap:.5rem;margin-top:.6rem"><button class="small green" type="button" id="sa-go">حفظ وتفعيل</button><button class="small gray" type="button" id="sa-x">إغلاق</button></div></div>';
    d.addEventListener("mousedown", e => { if (e.target === d) d.remove(); }); document.body.appendChild(d);
    $("sa-x").onclick = () => d.remove();
    $("sa-go").onclick = async () => {
      const cred = {}; d.querySelectorAll("[data-f]").forEach(i => { if (i.value.trim()) cred[i.dataset.f] = i.value.trim(); });
      const body = { carrier: code, credentials: cred }; if (needBase) body.base_url = ($("sa-base") || {}).value || "";
      $("sa-go").disabled = true; const r = await call("ship_connect", body); $("sa-go").disabled = false;
      if (!r.ok) { say("تعذّر التفعيل: " + ((r.j && (r.j.message || MSG[r.j.error] || r.j.error)) || "تحقق من المفاتيح"), "err"); return; }
      await load(); draw();
      $("sa-body").innerHTML = '<p>✅ تم التفعيل. ضع هذا الرابط في حسابك لدى الشركة ليصلك تحديث حالات الطرود تلقائياً (<b>يظهر هذه المرة فقط</b>):</p><div class="sa-url" id="sa-wh">' + esc(r.j.webhook_url) + '</div><button class="small blue" type="button" id="sa-cp" style="margin-top:.5rem">نسخ الرابط</button>';
      $("sa-go").style.display = "none"; $("sa-x").textContent = "تم";
      $("sa-cp").onclick = () => { try { navigator.clipboard.writeText(r.j.webhook_url); say("نُسخ الرابط", "ok"); } catch (e) { var s = window.getSelection(), g = document.createRange(); g.selectNodeContents($("sa-wh")); s.removeAllRanges(); s.addRange(g); } };
    };
  }

  async function send(orderId, code) {
    const lab = (S.cat.find(c => c.code === code) || {}).label || code;
    if (!confirm("إرسال هذا الطلب عبر " + lab + "؟ لا يمكن إرساله مرتين.")) return;
    const r = await call("ship_send", { carrier: code, order_id: orderId });
    if (r.ok && r.j.ok) { say("أُرسل الطلب — رقم التتبع " + r.j.tracking, "ok"); try { document.getElementById("ord-prev-bg").classList.remove("open"); if (Admin.load) Admin.load(); } catch (e) { } return; }
    say("لم يُرسل: " + ((r.j && (r.j.message || MSG[r.j.error] || r.j.error)) || "خطأ غير معروف"), "err");
  }

  function wrapPreview() {
    if (typeof Admin === "undefined" || !Admin.openOrderPreview || Admin.openOrderPreview.__sa) return !!(typeof Admin !== "undefined" && Admin.openOrderPreview && Admin.openOrderPreview.__sa);
    const orig = Admin.openOrderPreview;
    Admin.openOrderPreview = function (i) {
      const rv = orig.apply(this, arguments);
      try {
        const o = Admin.orders && Admin.orders[i], a = $("ord-prev-a");
        if (o && a && S.on.length && !/🚚[a-z0-9_]+:/i.test(String(o.note || "")) && !["annulee", "livree"].includes(o.status)) {
          S.on.forEach(c => { const lab = (S.cat.find(x => x.code === c.carrier_code) || {}).label || c.carrier_code; const b = document.createElement("button"); b.type = "button"; b.className = "small green"; b.textContent = "🚚 إرسال عبر " + lab; b.onclick = () => send(o.id, c.carrier_code); a.insertBefore(b, a.firstChild); });
        }
      } catch (e) { }
      return rv;
    };
    Admin.openOrderPreview.__sa = 1; return true;
  }

  function mount() {
    if (!php()) return;
    const tab = $("tab-delivery"); if (!tab || $("sa-card")) return;
    css(); const c = document.createElement("div"); c.className = "card"; c.id = "sa-card"; c.style.display = "none";
    const anchor = tab.querySelector("#delivery-table"); const host = anchor ? anchor.closest(".card") : null;
    if (host) host.parentNode.insertBefore(c, host); else tab.appendChild(c);
    load().then(ok => { if (ok) { c.style.display = ""; draw(); } });
    c.addEventListener("click", async e => {
      const b = e.target.closest("[data-sa]"); if (!b) return; const code = b.dataset.c, meta = (S.cat || []).find(x => x.code === code); if (!meta) return;
      if (b.dataset.sa === "conn") modal(code, meta.label, meta.fields || [], !!meta.needs_base_url);
      else if (b.dataset.sa === "off" && confirm("فصل " + meta.label + "؟ تبقى الطرود المرسلة كما هي.")) { await call("ship_disconnect", { carrier: code }); await load(); draw(); }
    });
  }

  function init() { if (!php()) return; let n = 0; const t = setInterval(() => { mount(); const w = wrapPreview(); if (++n > 40 || (w && $("sa-card"))) clearInterval(t); }, 800); load().then(() => wrapPreview()); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { load, send, S };
})();
