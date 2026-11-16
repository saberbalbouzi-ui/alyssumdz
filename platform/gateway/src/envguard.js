/* حارس البيئات (Production / Beta / Local): نقي بلا واردات ولا I/O — يعمل في Worker وNode معاً (ونسخة مطابقة في platform/gateway/src؛ اختبار envguard يتحقق من التطابق).
   المبدأ: **فشل مُغلَق**. بيئة غير الإنتاج لا تبدأ إن حملت أي هوية/اعتماد إنتاجي، ولا تتصل بأي مضيف خارج قائمة سماح صارمة (فيستحيل وصولها لبيانات الإنتاج أو الدفع/الرسائل الحقيقية
   حتى مع خطأ إعداد). لا يطبع قيم متغيرات أبداً: الأخطاء تذكر أسماء المتغيرات ورموز الخطأ فقط. */

export const ENV_NAMES = ["production", "beta", "local"];
const LIVE_NAME_RX = /(KEY|SECRET|TOKEN)$/i;

/** البيئة المعلنة: ENVIRONMENT (غيابه = production ضمنياً مع تحذير، توافقاً مع النشر القائم) */
export function envName(vars = {}) { const v = String(vars.ENVIRONMENT ?? "").trim().toLowerCase(); return v === "" ? "production" : v; }

const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ""; } };
const reg = (R) => R.environments ?? R;
const never = (R) => R.never_outside_production ?? { hosts: [], supabase_refs: [], live_url_prefixes: [], live_credential_prefixes: [], public_key_markers: [], identity_markers: [] };

/** يتحقق من متغيرات التشغيل. يعيد { name, errors:[{code,var?}], warnings:[...] } — لا قيم أبداً */
export function validateEnvironment(R, vars = {}) {
  const errors = [], warnings = [], E = reg(R), name = envName(vars), N = never(R);
  const err = (code, v) => errors.push(v ? { code, var: v } : { code });
  if (!ENV_NAMES.includes(name) || !E[name]) { err("unknown_environment"); return { name, errors, warnings }; }
  if (vars.ENVIRONMENT == null || String(vars.ENVIRONMENT).trim() === "") warnings.push({ code: "environment_implicit_production" });
  const cfg = E[name], prod = E.production, lower = (s) => String(s ?? "").toLowerCase();
  const entries = Object.entries(vars).filter(([k, v]) => typeof v === "string" && v !== "" && k !== "ENVIRONMENT");
  if (name !== "production") {
    /* (1) لا هوية إنتاجية في أي متغير: مضيف/مرجع Supabase */
    const own = [cfg.api_host, cfg.gateway_host, cfg.app_host].filter(Boolean).map((h) => h.toLowerCase());                  // مضيفو البيئة نفسها مشروعون (beta.alyssumdz.com يحتوي نصاً alyssumdz.com)
    for (const [k, v] of entries) { let l = lower(v); for (const o of own) l = l.split(o).join(""); for (const h of [...N.hosts, prod.api_host, prod.gateway_host, prod.app_host].filter(Boolean)) if (l.includes(h.toLowerCase())) { err("production_host_in_var", k); break; } for (const ref of N.supabase_refs ?? []) if (l.includes(ref.toLowerCase())) { err("production_supabase_ref_in_var", k); break; } for (const mk of N.public_key_markers ?? []) if (l.includes(mk.toLowerCase())) { err("production_public_key_in_var", k); break; } }
    /* (2) اعتمادات حيّة محظورة */
    for (const [k, v] of entries) if (LIVE_NAME_RX.test(k) && (N.live_credential_prefixes ?? []).some((p) => v.toLowerCase().startsWith(p))) err("live_credential_in_beta", k);
    /* (3) الدفع: الوضع test فقط */
    if (vars.CHARGILY_MODE != null && String(vars.CHARGILY_MODE).toLowerCase() !== "test") err("payments_mode_not_test", "CHARGILY_MODE");
    for (const [k, v] of entries) if (/CHARGILY/i.test(k) && LIVE_NAME_RX.test(k) && !/^test_/i.test(v) && !/^whsec/i.test(v) && !/^[0-9a-f]{16,}$/i.test(v)) warnings.push({ code: "chargily_secret_format_unverified", var: k });
    /* (4) عنوان المنصة العلني يطابق مضيف البيئة (API أو بوابة الشحن لنفس البيئة) */
    if (vars.PUBLIC_URL) { const h = hostOf(vars.PUBLIC_URL); if (h && h !== cfg.api_host && h !== cfg.gateway_host && !(name === "local" && (h === "localhost" || h === "127.0.0.1"))) err("public_url_host_mismatch", "PUBLIC_URL"); }
    /* (5) Supabase: مرجع مستقل صالح */
    if (vars.SUPABASE_URL) { const m = /^https:\/\/([a-z0-9]{10,30})\.supabase\.co\/?$/.exec(String(vars.SUPABASE_URL)); if (!m) err("supabase_url_invalid", "SUPABASE_URL"); else if ((N.supabase_refs ?? []).includes(m[1]) || m[1] === prod.supabase_ref) err("supabase_is_production", "SUPABASE_URL"); }
    /* (6) تكاملات خارجية حيّة معطّلة افتراضياً في Beta: Meta (تطبيق واحد بمسارات رجوع محددة) */
    if ((vars.META_APP_ID || vars.META_APP_SECRET) && String(vars.BETA_ALLOW_META ?? "").toLowerCase() !== "yes") err("meta_credentials_in_beta", vars.META_APP_SECRET ? "META_APP_SECRET" : "META_APP_ID");
    /* (7) قائمة سماح إضافية لا تضم محظوراً */
    for (const x of String(vars.EGRESS_ALLOW_EXTRA ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
      if (isDenied(R, x.replace(/^https?:\/\//, "")) ) err("egress_extra_denied", "EGRESS_ALLOW_EXTRA");
    }
  } else {
    /* الإنتاج: لا هوية Beta فيه */
    for (const [k, v] of entries) for (const h of [E.beta?.api_host, E.beta?.gateway_host, E.beta?.app_host].filter(Boolean)) if (lower(v).includes(h.toLowerCase())) { err("beta_host_in_production", k); break; }
    if (vars.PUBLIC_URL) { const h = hostOf(vars.PUBLIC_URL); if (h && h !== prod.api_host && h !== prod.gateway_host) err("public_url_host_mismatch", "PUBLIC_URL"); }
  }
  return { name, errors, warnings };
}

export function assertEnvironment(R, vars) {
  const r = validateEnvironment(R, vars);
  if (r.errors.length) { const e = new Error("env_guard:" + r.errors.map((x) => x.code + (x.var ? "@" + x.var : "")).join(",")); e.code = "env_guard"; e.errors = r.errors; throw e; }
  return r;
}

/** مضيف/مسار محظور دائماً خارج الإنتاج: مضيفو الإنتاج، Supabase الإنتاج، وواجهات الدفع الحيّة */
export function isDenied(R, target) {
  const N = never(R), t = String(target).toLowerCase().replace(/^https?:\/\//, ""), host = t.split("/")[0];
  for (const [n, c] of Object.entries(reg(R))) if (n !== "production") for (const h of [c.api_host, c.gateway_host, c.app_host]) if (h && host === h.toLowerCase()) return false;   // مضيف بيئة غير إنتاجية ليس «إنتاجاً» ولو احتوى نصاً مشابهاً
  if ((N.hosts ?? []).some((h) => host === h || host.endsWith("." + h)) || [reg(R).production.api_host, reg(R).production.gateway_host, reg(R).production.app_host].some((h) => h && (host === h || host.endsWith("." + h)))) return true;
  if ((N.supabase_refs ?? []).some((ref) => host.startsWith(ref + ".") || host.includes(ref))) return true;
  if ((N.live_url_prefixes ?? []).some((p) => t.startsWith(p))) return true;
  return false;
}

/** سياسة الخروج: null للإنتاج (لا حارس)، وإلا قائمة سماح صارمة = قائمة السجل + EGRESS_ALLOW_EXTRA (بعد التحقق) */
export function egressPolicy(R, vars = {}) {
  const name = envName(vars), cfg = reg(R)[name]; if (!cfg || name === "production") return null;
  const allow = [...(cfg.egress?.allow ?? []), ...String(vars.EGRESS_ALLOW_EXTRA ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)];
  return { name, allow: allow.map((a) => a.toLowerCase().replace(/^https?:\/\//, "")), R };
}
export function egressAllowed(policy, url) {
  let u; try { u = new URL(url); } catch { return false; }
  const hostpath = (u.hostname + u.pathname).toLowerCase();
  if (isDenied(policy.R, hostpath)) return false;                                                                     // المحظور يغلب السماح دائماً
  if (policy.name === "local" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return true;
  return policy.allow.some((a) => { const [h, ...p] = a.split("/"), pre = p.join("/"); return u.hostname.toLowerCase() === h && (!pre || (u.pathname.replace(/^\//, "")).toLowerCase().startsWith(pre)); });
}
export class EgressBlocked extends Error { constructor(host) { super("egress_blocked:" + host); this.code = "egress_blocked"; this.host = host; } }
/** يغلّف fetch: أي مضيف خارج السماح يُرمى فوراً (لا طلب يخرج). onBlock(host) اختياري للعدّ/التدقيق (لا URL كاملاً: قد يحمل معرّفات) */
export function guardFetch(fetchFn, policy, onBlock) {
  if (!policy) return fetchFn;
  return async (url, init) => { const u = typeof url === "string" ? url : String(url?.url ?? url); if (!egressAllowed(policy, u)) { let h = ""; try { h = new URL(u).hostname; } catch { } try { onBlock?.(h); } catch { } throw new EgressBlocked(h); } return fetchFn(url, init); };
}

/** خطة نشر لأداة Cloudflare: تفرض --env صريحاً، وتمنع النشر المتبادل، وتمنع الافتراضات الخطرة (حساب/منطقة) خارج الإنتاج */
export function deployPlan(R, { kind = "api", env, flags = {}, vars = {} } = {}) {
  const E = reg(R), cfg = E[env]; if (!cfg || !ENV_NAMES.includes(env)) throw new Error("deploy_guard:--env مطلوب (production|beta|local)");
  const prod = E.production, worker = kind === "gateway" ? cfg.gateway_worker : cfg.cf_worker, d1 = kind === "gateway" ? cfg.gateway_d1 : cfg.cf_d1, host = kind === "gateway" ? cfg.gateway_host : cfg.api_host;
  if (env === "production") {
    if (!flags.production || String(vars.ALLOW_PRODUCTION_DEPLOY ?? "") !== "yes") throw new Error("deploy_guard:النشر إلى production يتطلب --production و ALLOW_PRODUCTION_DEPLOY=yes (موافقة صريحة منفصلة)");
  } else {
    if (env === "local") throw new Error("deploy_guard:local لا يُنشر إلى Cloudflare");
    const pw = kind === "gateway" ? prod.gateway_worker : prod.cf_worker, pd = kind === "gateway" ? prod.gateway_d1 : prod.cf_d1, ph = kind === "gateway" ? prod.gateway_host : prod.api_host;
    if (worker === pw || d1 === pd || host === ph) throw new Error("deploy_guard:أسماء موارد " + env + " تطابق Production");
    if (!vars.CF_ACCOUNT_ID || !vars.CF_ZONE_ID) throw new Error("deploy_guard:CF_ACCOUNT_ID وCF_ZONE_ID مطلوبان صراحةً لغير الإنتاج (لا افتراضات)");
    if (flags.production || String(vars.ALLOW_PRODUCTION_DEPLOY ?? "") === "yes") throw new Error("deploy_guard:لا تجمع إعدادات إنتاج مع نشر " + env);
  }
  const account = env === "production" ? (vars.CF_ACCOUNT_ID || null) : vars.CF_ACCOUNT_ID, zone = env === "production" ? (vars.CF_ZONE_ID || null) : vars.CF_ZONE_ID;
  /* ربط الخدمة: بوابة Beta تُربط بمنصة Beta حصراً */
  const platformService = env === "production" ? prod.cf_worker : cfg.cf_worker;
  if (kind === "gateway" && env !== "production" && platformService === prod.cf_worker) throw new Error("deploy_guard:بوابة Beta لا تُربط بمنصة Production");
  return { env, kind, worker, d1, host, account, zone, platformService, publicUrl: "https://" + host, route: host + "/*", label: cfg.label };
}
