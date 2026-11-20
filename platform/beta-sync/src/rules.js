/* قواعد المزامنة اللوحة التقليدية (main) → Beta: ما يُزامَن، وإلى أي مكوّن، وكيف يُنظَّف. لا I/O هنا (دوال نقية) فتُختبَر بلا شبكة.
   مبدأ: allowlist صريح فقط. كل ما عداه (الشيفرة: assets/js وcss وadmin.html…) يصل Beta عبر مسار الإصدارات لا عبر المزامنة.
   ممنوع نقله مطلقاً (لا قاعدة له أصلاً ⇒ يُتجاهل): payments/customers/returns/social/pixels وكل ما يخصّ الطلبات والعملاء والأسرار.
   التنظيف: (1) تحويل خاص بكل مجموعة (حقول اتصال/دفع)، (2) استبدال مضيفات/مراجع Supabase/مفاتيح Production العامة بقيم Beta، (3) حجر (quarantine) أي ملف فيه سرّ أو هوية مالك لا يُستبدل — لا يُنسخ ويظهر في اللوحة بسببه. */

export const COMPONENTS = ["ui", "templates"];
const TPL = ["assets/pages/", "assets/img/tpl/", "p/_template/", "lp/"];            // مطابِق لـplatform/env/beta/static-worker.js (يختبره engine.test)
export const compOf = (p) => (TPL.some((x) => p.startsWith(x)) ? "templates" : "ui");
export const TPL_PREFIXES = TPL;

const SETTINGS = ["theme", "seo", "chrome", "collections", "welcome", "ship-co", "upsell", "coupons", "blog", "store", "checkout", "pay-methods"];
const IMG_EXT = /\.(webp|png|jpe?g|gif|avif|svg)$/i, MAX_BYTES = { text: 2_000_000, img: 8_000_000 };
/** ترتيب التطبيق: الوسائط أولاً ثم الصفحات ثم الإعدادات ثم بيانات المنتجات (لا يشير ملف إلى ما لم يصل بعد) */
export const PRIORITY = { media: 0, page: 1, settings: 2, products: 3 };

/** يصنّف مساراً: null = خارج النطاق (يُتجاهل بصمت) */
export function classify(path) {
  if (path === "assets/js/data.js") return { id: "products", kind: "datajs", prio: PRIORITY.products };
  let m = path.match(/^assets\/data\/([a-z0-9-]+)\.json$/); if (m && SETTINGS.includes(m[1])) return { id: "settings:" + m[1], kind: "json", name: m[1], prio: PRIORITY.settings };
  if (/^assets\/img\/(?!tpl\/)[^]+/.test(path) && IMG_EXT.test(path)) return { id: "media", kind: "bin", prio: PRIORITY.media };
  if (/^assets\/pages\/(?!templates\/|_conv\/)[a-z0-9_-]+\.json$/i.test(path)) return { id: "pages", kind: "json", name: "page", prio: PRIORITY.page };
  if (/^(p|lp)\/[a-z0-9_.-]+\/index(\.[a-z]+)?\.html$/i.test(path) && !path.startsWith("p/_template/")) return { id: "pages", kind: "html", prio: PRIORITY.page };
  if (path === "index.html") return { id: "pages", kind: "html", prio: PRIORITY.page };
  return null;
}

/* ───────── كشف الأسرار والهوية ───────── */
const SECRET_RX = [[/sb_secret_[A-Za-z0-9_-]{10,}/, "sb_secret"], [/\bsk_live_[A-Za-z0-9]{8,}/, "sk_live"], [/\blive_sk_[A-Za-z0-9]{8,}/, "live_sk"], [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bghp_[A-Za-z0-9]{20,}/, "github token"], [/\bgithub_pat_[A-Za-z0-9_]{20,}/, "github pat"], [/\bAKIA[0-9A-Z]{16}\b/, "aws key"], [/\bpk_live_[0-9a-f]{20,}/, "pk_live"], [/\bgk_live_[0-9a-f]{20,}/, "gk_live"], [/Bearer\s+[A-Za-z0-9._-]{40,}/, "bearer token"]];
export function findSecrets(text) {
  const hits = []; for (const [rx, n] of SECRET_RX) if (rx.test(text)) hits.push(n);
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) { try { if (atob(m[1].replace(/-/g, "+").replace(/_/g, "/")).includes("service_role")) hits.push("jwt service_role"); } catch { } }
  return hits;
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** cfg: { registry (never_outside_production + production hosts), beta: { appHost, apiHost, supabaseUrl, anonKey, waPlaceholder } } */
export function makeSanitizer(cfg) {
  const NP = cfg.registry.never_outside_production, B = cfg.beta, wa = B.waPlaceholder ?? "213000000000";
  const prodHosts = [...new Set(NP.hosts)].sort((a, b) => b.length - a.length);
  const prodRefs = NP.supabase_refs ?? [], keyMarkers = NP.public_key_markers ?? [], ident = NP.identity_markers ?? [];
  const phoneIdent = ident.filter((x) => /^\d{9,}$/.test(x)), hardIdent = ident.filter((x) => !/^\d{9,}$/.test(x));
  const hostRx = prodHosts.map((h) => new RegExp("(?<![\\w.-])" + esc(h) + "(?![\\w-])", "gi")), refRx = prodRefs.map((r) => new RegExp("https://" + esc(r) + "\\.supabase\\.co", "g")), keyRx = keyMarkers.map((k) => new RegExp(esc(k) + "[A-Za-z0-9_-]*", "g"));
  const phoneRx = phoneIdent.flatMap((p) => { const loc = "0" + p.slice(-9); return [new RegExp(esc(p), "g"), new RegExp("(?<!\\d)" + esc(loc) + "(?!\\d)", "g")]; });

  /** نصّ ← { text, notes[], blocked? } */
  function scrubText(t) {
    const notes = []; let n = 0;
    for (const rx of refRx) t = t.replace(rx, () => (n++, B.supabaseUrl)); if (n) notes.push("supabase-ref→beta:" + n); n = 0;
    for (const rx of keyRx) t = t.replace(rx, () => (n++, B.anonKey)); if (n) notes.push("public-key→beta:" + n); n = 0;
    for (const rx of hostRx) t = t.replace(rx, () => (n++, B.appHost)); if (n) notes.push("prod-host→beta:" + n); n = 0;
    for (const rx of phoneRx) t = t.replace(rx, () => (n++, wa)); if (n) notes.push("owner-phone→placeholder:" + n);
    const sec = findSecrets(t); if (sec.length) return { text: t, notes, blocked: "سرّ: " + sec.join("،") };
    for (const h of hardIdent) if (t.toLowerCase().includes(h.toLowerCase())) return { text: t, notes, blocked: "هوية مالك: " + h.slice(0, 8) + "…" };
    return { text: t, notes };
  }

  /* تحويلات خاصة بكل مجموعة (على كائنات JSON) */
  const blank = (o, keys) => { for (const k of keys) if (k in o) o[k] = typeof o[k] === "boolean" ? o[k] : ""; return o; };
  const OBJ = {
    store: (o) => blank(o, ["phone", "email", "wa", "whatsapp", "address", "instagram", "facebook", "tiktok"]),
    checkout: (o) => { o.waNumber = wa; return o; },
    "pay-methods": (o) => { for (const k of ["baridimob", "ccp", "chargily"]) if (o[k] && typeof o[k] === "object") { const on = o[k].on === true; o[k] = { on }; if (k === "baridimob") Object.assign(o[k], { rip: "", name: "" }); if (k === "ccp") Object.assign(o[k], { account: "", key: "", name: "" }); } return o; },
  };

  /** HTML: نفس طبقة Beta في build-beta.py (noindex + شريط Beta) — الصفحات المنشورة من اللوحة التقليدية لا تحملها */
  function betaHtml(t, path) {
    if (!/name=["']robots["']/i.test(t)) t = t.replace(/<head([^>]*)>/i, '<head$1><meta name="robots" content="noindex,nofollow">'); else t = t.replace(/<meta[^>]*name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex,nofollow">');
    const depth = path.split("/").length - 1, rel = (depth ? "../".repeat(depth) : "") + "assets/js/beta-banner.js";
    if (!t.includes("beta-banner.js") && t.includes("</body>")) { const i = t.lastIndexOf("</body>"); t = t.slice(0, i) + `<script src="${rel}" defer></script>` + t.slice(i); }
    return t;
  }

  /** (path, bytes, cls) ← { bytes, notes[] } | { blocked } | { skip } */
  function transform(path, buf, cls) {
    if (cls.kind === "bin") { if (buf.length > MAX_BYTES.img) return { blocked: "وسيط أكبر من الحدّ (" + buf.length + ")" }; if (buf.length === 0) return { blocked: "ملف فارغ" }; return { bytes: buf, notes: [] }; }
    if (buf.length > MAX_BYTES.text) return { blocked: "ملف نصّي أكبر من الحدّ" };
    let text = new TextDecoder("utf-8", { fatal: false }).decode(buf), notes = [];
    if (cls.kind === "json") {
      let o; try { o = JSON.parse(text); } catch { return { blocked: "JSON غير صالح" }; }
      const f = OBJ[cls.name]; if (f && o && typeof o === "object" && !Array.isArray(o)) { o = f(o); notes.push("scrub:" + cls.name); }
      text = JSON.stringify(o, null, 1) + "\n";
    } else if (cls.kind === "datajs") {
      if (!/\bvar\s+PRODUCTS\s*=/.test(text) || !/\bvar\s+CATEGORIES\s*=/.test(text)) return { blocked: "data.js بلا PRODUCTS/CATEGORIES" };
    }
    const s = scrubText(text); text = s.text; notes.push(...s.notes); if (s.blocked) return { blocked: s.blocked, notes };
    if (cls.kind === "html") { text = betaHtml(text, path); notes.push("beta-html"); }
    return { bytes: new TextEncoder().encode(text), notes };
  }
  return { transform, scrubText };
}

export const sha256Hex = async (buf) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
