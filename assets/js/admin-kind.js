/* نوع المتجر: مادي (توصيل) أو رقمي (مفاتيح/حسابات/اشتراكات/ملفات) — اختيار عند أول دخول، رئيسية رقمية، وتنقّل بين المواقع.
   الحالة في store.json: kind = physical|digital، kindAsk = true تعني «اسأل الزبون عند أول دخول». */
const AdminKind = (() => {
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* أقسام لا معنى لها في متجر رقمي (توصيل، تجهيز طرود، مرتجعات مادية، مخزون علب…) */
  const PHYS = ["shipped", "callcenter", "pack", "dispatch", "delivery", "fees", "returns", "inventory", "sources", "blacklist", "market"];
  const D = () => (typeof AdminStores !== "undefined" && AdminStores.data && AdminStores.data()) || {};
  const owner = () => { try { const m = AdminRoles.state && AdminRoles.state.me; return !m || m.owner !== false; } catch (e) { return true; } };
  const kind = () => (D().kind === "digital" || D().edition === "digital" ? "digital" : "physical");
  const landing = () => (kind() === "digital" && owner() ? "digital" : "home");
  function css() {
    if ($("kd-css")) return; const st = document.createElement("style"); st.id = "kd-css";
    st.textContent = 'html.kind-digital .nav-btn.kind-phys{display:none!important}' +
      '#kd-bg{position:fixed;inset:0;z-index:99999;background:rgba(9,24,18,.985);display:flex;align-items:center;justify-content:center;padding:1rem;overflow:auto}' +
      '#kd-box{max-width:760px;width:100%;color:#fff;text-align:center}#kd-box h2{margin:0 0 .4rem;font-size:1.6rem}#kd-box p{margin:0 0 1.2rem;opacity:.85}' +
      '.kd-cards{display:grid;grid-template-columns:1fr 1fr;gap:1rem}@media(max-width:620px){.kd-cards{grid-template-columns:1fr}}' +
      '.kd-card{cursor:pointer;color:#fff;text-align:center;border-radius:18px;padding:1.4rem 1rem;font-family:inherit;border:1px solid rgba(255,255,255,.25);background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.05));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -6px 12px rgba(0,0,0,.22),0 6px 18px rgba(0,0,0,.3);backdrop-filter:blur(8px);transition:transform .15s,background .15s}' +
      '.kd-card:hover{transform:translateY(-2px);background:linear-gradient(180deg,rgba(var(--g-mint-rgb,226,254,23),.38),rgba(var(--g-mint-rgb,226,254,23),.12))}' +
      '.kd-card b{display:block;font-size:1.15rem;margin:.4rem 0}.kd-card small{display:block;opacity:.85;line-height:1.7}.kd-ic{font-size:2.4rem}' +
      '#kd-hero{margin-bottom:1rem;padding:1rem 1.1rem;border-radius:18px;color:#fff;border:1px solid rgba(96,165,250,.45);background:linear-gradient(180deg,rgba(96,165,250,.22),rgba(96,165,250,.06))}' +
      '#kd-hero h2{margin:0 0 .5rem;font-size:1.25rem}.kd-st{display:flex;gap:.6rem;flex-wrap:wrap;margin:.4rem 0 .7rem}.kd-st div{flex:1 1 130px;border-radius:12px;padding:.55rem .7rem;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15)}.kd-st b{display:block;font-size:1.35rem}.kd-st small{opacity:.85}' +
      '.kd-sw{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}.kd-sw button{cursor:pointer;color:#fff;border-radius:12px;padding:.5rem .9rem;font:inherit;font-weight:800;border:1px solid rgba(255,255,255,.3);background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.05));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -4px 8px rgba(0,0,0,.2),0 2px 8px rgba(0,0,0,.25);transition:transform .15s,background .15s}.kd-sw button:hover{transform:translateY(-2px);background:linear-gradient(180deg,rgba(var(--g-mint-rgb,226,254,23),.38),rgba(var(--g-mint-rgb,226,254,23),.12))}';
    document.head.appendChild(st);
  }
  function mark() { document.querySelectorAll(".nav-btn").forEach(b => { const m = /Admin\.tab\('([a-z0-9]+)'/.exec(b.getAttribute("onclick") || ""); if (m && PHYS.includes(m[1])) b.classList.add("kind-phys"); }); }
  function apply() { try { if (typeof AdminEdition !== "undefined") AdminEdition.apply(); } catch (e) { } css(); mark(); document.documentElement.classList.toggle("kind-digital", kind() === "digital"); heroDraw(); }
  /* بطاقة الرئيسية الرقمية أعلى تبويب المنتجات الرقمية */
  function heroDraw() {
    const t = $("tab-digital"); if (!t) return; let h = $("kd-hero");
    if (kind() !== "digital") { if (h) h.remove(); return; }
    if (!h) { h = document.createElement("div"); h.id = "kd-hero"; t.insertBefore(h, t.firstChild); h.addEventListener("click", onHero); }
    let S = {}; try { S = AdminDigital.S || {}; } catch (e) { }
    const os = S.orders || [], pr = (S.proofs || []).length, aw = os.filter(o => o.state === "awaiting").length, rd = os.filter(o => o.state === "ready").length, sh = os.filter(o => o.state === "short").length;
    const today = new Date().toISOString().slice(0, 10); let dn = 0, dsum = 0;
    try { (Admin.orders || []).filter(o => Admin.isDigital(o) && String(o.date || o.created_at || "").slice(0, 10) === today).forEach(o => { dn++; dsum += Number(o.total) || 0; }); } catch (e) { }
    const others = (AdminStores.stores ? AdminStores.stores() : []).filter(s => s.kind !== "digital");
    const nm = AdminStores.data().name || "";
    h.innerHTML = '<h2>💾 الرئيسية الرقمية' + (nm ? ' — ' + esc(nm) : '') + '</h2><div class="kd-st"><div><b>' + dn + '</b><small>طلبات رقمية اليوم</small></div><div><b>' + dsum.toLocaleString("en") + '</b><small>مبيعات اليوم (دج)</small></div><div><b>' + pr + '</b><small>إثباتات دفع بانتظار موافقتك</small></div><div><b>' + (aw + rd + sh) + '</b><small>طلبات تحتاج إجراءً' + (sh ? " (" + sh + " بانتظار مخزون)" : "") + '</small></div></div>' +
      '<div class="kd-sw"><span style="font-weight:800">مواقعي:</span>' + others.map(s => '<button type="button" data-kd="open" data-id="' + esc(s.id) + '">🛍️ ' + esc(s.name) + '</button>').join("") + '<button type="button" data-kd="new" data-k="physical">＋ إنشاء متجر مادي</button><button type="button" data-kd="new" data-k="digital">＋ متجر رقمي آخر</button></div>';
  }
  function onHero(e) { const b = e.target.closest("[data-kd]"); if (!b) return; if (b.dataset.kd === "open") AdminStores.open(b.dataset.id); else AdminStores.newKind(b.dataset.k); }
  /* حفظ الاختيار ثم الانتقال لرئيسية النوع */
  async function choose(k, silent) {
    const bg = $("kd-bg"); if (bg) bg.remove();
    try { await AdminStores.patch({ kind: k, kindAsk: false }); } catch (e) { }
    apply(); go();
  }
  function go() { try { const t = landing(); const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'" + t + "'")); if (t !== "home" && b) Admin.tab(t, b); } catch (e) { } }
  function ask() {
    if ($("kd-bg")) return; css(); const bg = document.createElement("div"); bg.id = "kd-bg"; bg.setAttribute("role", "dialog");
    bg.innerHTML = '<div id="kd-box"><h2>ماذا ستبيع في متجرك؟</h2><p>اختر نوع المتجر ليُجهَّز لك بالشكل المناسب. يمكنك لاحقاً إنشاء متجر من النوع الآخر والتنقل بينهما من «إعدادات الموقع».</p><div class="kd-cards">' +
      '<button type="button" class="kd-card" data-k="physical"><span class="kd-ic">🛍️</span><b>منتجات مادية</b><small>تُشحن إلى الزبون: توصيل، شركات شحن، مخزون علب، مرتجعات</small></button>' +
      '<button type="button" class="kd-card" data-k="digital"><span class="kd-ic">💾</span><b>منتجات رقمية</b><small>مفاتيح، حسابات، اشتراكات، ملفات وتدريبات: دفع بطاقة/بريدي موب/CCP وتسليم تلقائي بلا توصيل</small></button></div></div>';
    bg.addEventListener("click", e => { const c = e.target.closest(".kd-card"); if (c) choose(c.dataset.k); });
    document.body.appendChild(bg);
  }
  let tries = 0;
  function sync() {
    const d = D(); apply();
    if (!(d.kindAsk && !d.kind)) return;
    if (!owner()) return;
    const h = /[#&]kind=(digital|physical)/.exec(location.hash); if (h) return choose(h[1], true);
    const wait = () => { const app = $("app"); if (app && !app.classList.contains("hidden") && typeof Admin !== "undefined" && Admin.orders) return ask(); if (++tries < 80) setTimeout(wait, 800); };
    wait();
  }
  function init() {
    css(); const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._kdWrapped) return; const o = Admin.tab; Admin.tab = function (t, b) { const r = o.apply(this, arguments); if (t === "digital") { heroDraw(); setTimeout(heroDraw, 1500); } return r; }; Admin._kdWrapped = true; };
    w(); setTimeout(w, 500); setTimeout(() => { mark(); try { if (AdminStores.loaded()) sync(); } catch (e) { } }, 800);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { sync, apply, kind, landing, choose, ask, go, PHYS };
})();
