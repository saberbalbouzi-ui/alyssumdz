/* زر «تفعيل خدمة تأكيد الزبائن» أعلى صفحة الطلبات: خدمة اختيارية توفرها المنصة (يتصل فريقها بزبائنك لتأكيد الطلبات).
   الضغط يرسل طلب تفعيل إلى إدارة المنصة (نظام طلبات الدعم)، وتتبدّل الحالة: قيد المعالجة ← مفعّلة عند اعتمادها من الإدارة. */
const ConfirmSvc = (() => {
  const KEY = "alyssum_svc_confirm", $ = id => document.getElementById(id);
  const S = { on: null };
  const req = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } };
  const setReq = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { } };
  const css = () => {
    if ($("cs-css")) return; const st = document.createElement("style"); st.id = "cs-css";
    st.textContent = `#cs-svc{margin:0 0 .6rem}.cs-btn{display:inline-flex;align-items:center;gap:.45rem;padding:.55rem 1.1rem;border-radius:12px;font:inherit;font-weight:800;color:#fff;cursor:pointer;background:linear-gradient(180deg,rgba(74,222,128,.38),rgba(34,197,94,.16));border:1px solid rgba(134,239,172,.55);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -6px 10px rgba(0,0,0,.2),0 6px 14px rgba(0,0,0,.25);backdrop-filter:blur(8px);transition:transform .2s,background .2s}.cs-btn:hover{transform:translateY(-2px);background:linear-gradient(180deg,rgba(74,222,128,.55),rgba(34,197,94,.26))}
.cs-btn.w{background:linear-gradient(180deg,rgba(245,158,11,.38),rgba(245,158,11,.16));border-color:rgba(245,158,11,.55);cursor:default}.cs-btn.w:hover{transform:none}.cs-btn.ok{cursor:default}.cs-btn.ok:hover{transform:none}
.cs-mbg{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:14px}.cs-mod{width:min(520px,100%);padding:1.3rem;border-radius:18px;background:rgba(9,24,18,.985);color:#e8f5ee;border:1px solid rgba(255,255,255,.18);box-shadow:0 24px 70px rgba(0,0,0,.6)}.cs-mod h3{margin:0 0 .5rem}.cs-mod p{line-height:1.9;margin:.3rem 0 .6rem}.cs-mod textarea{width:100%;min-height:80px}.cs-mod .act{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.8rem}
html.white .cs-mod{background:#fff;color:#0f172a;border-color:#d2d9e3}`;
    document.head.appendChild(st);
  };
  function draw() {
    const h = $("cs-svc"); if (!h) return; css(); const r = req(), on = S.on === true;
    const html = on ? '<span class="cs-btn ok">✅ خدمة تأكيد الزبائن مفعّلة</span>' : r ? '<span class="cs-btn w" title="أُرسل طلبك إلى إدارة المنصة وستتواصل معك">⏳ طلب تفعيل خدمة تأكيد الزبائن قيد المعالجة</span>' : '<button type="button" class="cs-btn" onclick="ConfirmSvc.open()">☎️ تفعيل خدمة تأكيد الزبائن</button>';
    if (h.dataset.s !== html) { h.dataset.s = html; h.innerHTML = html; }
  }
  function open() {
    css(); if ($("cs-mbg")) return; const d = document.createElement("div"); d.className = "cs-mbg"; d.id = "cs-mbg";
    d.innerHTML = '<div class="cs-mod"><h3>خدمة تأكيد الزبائن</h3><p>خدمة <b>اختيارية</b> توفرها المنصة: يتولّى فريقها الاتصال بزبائنك الجدد لتأكيد طلباتهم وتسجيل نتيجة كل اتصال، فتوفّر وقتك.</p><p>اضغط «إرسال طلب التفعيل» ليصل طلبك إلى إدارة المنصة، وستتواصل معك لإتمام التفعيل.</p><label style="font-size:.8rem;font-weight:800">ملاحظة للإدارة (اختياري)</label><textarea id="cs-note" placeholder="مثال: أوقات الاتصال المناسبة، عدد الطلبات اليومي التقريبي…"></textarea><div class="act"><button type="button" class="cs-btn" id="cs-go">إرسال طلب التفعيل</button><button type="button" class="cs-btn" style="background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.25)" onclick="ConfirmSvc.close()">إغلاق</button></div></div>';
    d.addEventListener("mousedown", e => { if (e.target === d) close(); }); document.body.appendChild(d);
    $("cs-go").onclick = send;
  }
  function close() { const d = $("cs-mbg"); if (d) d.remove(); }
  async function send() {
    const b = $("cs-go"), note = ($("cs-note") || {}).value || ""; if (b) b.disabled = true;
    const txt = "طلب تفعيل خدمة تأكيد الزبائن" + (note.trim() ? "\n\n" + note.trim() : "");
    let r; try { r = await (typeof AdminStores !== "undefined" && AdminStores.notify ? AdminStores.notify(txt, "service_activation", { service: "order_confirm", note: note.trim() || undefined }, "طلب تفعيل خدمة تأكيد الزبائن") : Promise.resolve()); } catch (e) { r = null; }
    if (r === false) { if (b) b.disabled = false; return; }
    setReq({ at: Date.now(), num: r && r.num }); close(); draw();
  }
  async function status() {
    const SC = window.SaasClient; if (!SC || !SC.on()) return; const r = await SC.status(); if (!r) return;
    const oc = r.services && r.services.order_confirm; S.on = !!(oc && oc.on); if (S.on) setReq(null); draw();
  }
  function init() { setInterval(() => { if ($("cs-svc")) draw(); }, 2000); status(); setInterval(status, 5 * 60 * 1000); document.addEventListener("click", e => { if (e.target.closest && e.target.closest('.nav-btn[onclick*="orders"]')) setTimeout(status, 300); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { open, close, draw, status };
})();
