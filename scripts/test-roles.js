/* اختبار نموذج الأدوار (نقي) + اتساق قوائم الصلاحيات بين اللوحة والدالة الخادمية ونسخة PHP + تغطية أقسام القائمة.
     node scripts/test-roles.js */
const fs = require("fs"), path = require("path");
const R = require("../assets/js/admin-roles.js");
let total = 0, fails = 0;
const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗ " + n, x === undefined ? "" : JSON.stringify(x)); } };
const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const owner = { owner: true, role: "owner", perms: ["*"] }, agent = { owner: false, role: "agent", perms: R.ROLES.agent.perms }, acct = { owner: false, role: "accountant", perms: R.ROLES.accountant.perms };

ok("المالك يدخل كل قسم حتى غير المعروف", R.tabAllowed(owner, "anything") && R.tabAllowed(owner, "finance"));
ok("موظف الاتصال: الطلبات ومركز الاتصال فقط", R.tabAllowed(agent, "orders") && R.tabAllowed(agent, "callcenter") && !R.tabAllowed(agent, "finance") && !R.tabAllowed(agent, "payments") && !R.tabAllowed(agent, "delivery") && !R.tabAllowed(agent, "customers") && !R.tabAllowed(agent, "builder"));
ok("الرفض الافتراضي: قسم غير مسجَّل = للمالك فقط", !R.tabAllowed(agent, "new-unknown-tab") && !R.tabAllowed(acct, "setup") && !R.tabAllowed(acct, "store"));
ok("الفريق والمظهر الشخصي متاحان للجميع", R.tabAllowed(agent, "team") && R.tabAllowed(acct, "admtheme"));
ok("المحاسب: المالية والمدفوعات والتكاليف والعملاء والتقارير، لا التصميم ولا الاتصال", ["finance", "payments", "costs", "customers", "reports", "home", "orders"].every(t => R.tabAllowed(acct, t)) && !R.tabAllowed(acct, "builder") && !R.tabAllowed(acct, "callcenter") && !R.tabAllowed(acct, "delivery") && !R.tabAllowed(acct, "setup"));
ok("أقسام المالية للقراءة فقط (RO_TABS)", R.RO_TABS.finance && R.RO_TABS.payments && R.RO_TABS.costs && R.RO_TABS.customers && !R.RO_TABS.orders);
ok("صلاحيات «قريباً» لا تفتح أقساماً حتى لو مُنحت عبر الخادم", !R.tabAllowed({ owner: false, perms: ["products", "site", "ship", "marketing"] }, "delivery") && !R.tabAllowed({ owner: false, perms: ["products"] }, "products") && !R.tabAllowed({ owner: false, perms: ["site"] }, "builder") && R.SOON.slice().sort().join() === "marketing,products,ship,site");
ok("بلا هوية لا يُسمح بشيء", !R.tabAllowed(null, "orders") && !R.has(null, "orders"));
ok("تطبيقات: اسألني للجميع والمطوّر بصلاحية الموقع", R.appAllowed(agent, "ask") && !R.appAllowed(agent, "builder") && R.appAllowed(owner, "cloner"));
ok("الصفحة الأولى: الاتصال للموظف ثم الطلبات", R.firstTab(agent) === "callcenter" && R.firstTab({ owner: false, perms: ["orders"] }) === "orders" && R.firstTab({ owner: false, perms: [] }) === "team" && R.firstTab(owner) === "callcenter");
ok("صلاحية نجمية لا تتجاوز «قريباً»", R.has({ owner: false, perms: ["*"] }, "orders") && !R.has({ owner: false, perms: ["*"] }, "products"));

const rows = [
  { actor: "a@x", role: "agent", action: "order.status", to_status: "confirmee", n: 6, last_at: "2026-10-13T10:00:00Z" },
  { actor: "a@x", role: "agent", action: "order.status", to_status: "annulee", n: 2, last_at: "2026-10-13T11:00:00Z" },
  { actor: "a@x", role: "agent", action: "order.call", to_status: "📞1", n: 9, last_at: "2026-10-13T09:00:00Z" },
  { actor: "b@x", role: "agent", action: "order.status", to_status: "confirmee", n: 10, last_at: "2026-10-12T09:00:00Z" },
  { actor: "b@x", role: "agent", action: "login", to_status: "", n: 3, last_at: "2026-10-12T08:00:00Z" },
];
const sm = R.summarize(rows);
ok("إحصاء الفريق: ترتيب بالتأكيدات ونسبة التأكيد", sm.length === 2 && sm[0].actor === "b@x" && sm[0].confirmed === 10 && sm[0].rate === 100 && sm[1].actor === "a@x" && sm[1].confirmed === 6 && sm[1].cancelled === 2 && sm[1].rate === 75 && sm[1].calls === 9 && sm[1].last === "2026-10-13T11:00:00Z", sm);
const rows2 = [
  { actor: "c@x", role: "agent", action: "order.status", to_status: "confirmee", n: 5, last_at: "2026-10-13T10:00:00Z" },
  { actor: "c@x", role: "agent", action: "order.status", to_status: "annulee", n: 5, last_at: "2026-10-13T10:00:00Z" },
  { actor: "c@x", role: "agent", action: "order.call", to_status: "📞1", n: 4, last_at: "2026-10-13T09:00:00Z" },
  { actor: "c@x", role: "agent", action: "order.call", to_status: "📞2", n: 2, last_at: "2026-10-13T09:00:00Z" },
  { actor: "c@x", role: "agent", action: "order.call", to_status: "⏰", n: 3, last_at: "2026-10-13T09:00:00Z" },
  { actor: "c@x", role: "agent", action: "order.call", to_status: "⏰📅", n: 2, last_at: "2026-10-13T09:00:00Z" },
  { actor: "c@x", role: "agent", action: "order.call", to_status: "📵", n: 1, last_at: "2026-10-13T09:00:00Z" },
  { actor: "c@x", role: "agent", action: "order.call", to_status: "🏠", n: 2, last_at: "2026-10-13T09:00:00Z" },
  { actor: "c@x", role: "agent", action: "order.call", to_status: "", n: 7, last_at: "2026-10-13T09:00:00Z" },
];
const s2 = R.summarize(rows2)[0];
ok("إحصاء الاتصال المفصَّل: غير متاح 1/2، لاحقاً، مؤجَّل لغد، رقم خاطئ، تعديل عنوان (والفارغ لا يُعدّ)", s2.try1 === 4 && s2.try2 === 2 && s2.try3 === 0 && s2.later === 3 && s2.tomorrow === 2 && s2.wrong === 1 && s2.addr === 2 && s2.calls === 21 && s2.rate === 50, s2);
ok("زمن الاستجابة: تنسيق وتلوين وأسباب الإلغاء", R.fmtMin(9) === "9 د" && R.fmtMin(120) === "2.0 س" && R.fmtMin(null) === "—" && R.respTone(10) === "#d4ff4d" && R.respTone(40) === "#fcd34d" && R.respTone(200) === "#fca5a5" && Object.keys(R.CANCEL_REASONS).length === 7 && R.CANCEL_REASONS.expensive);
const as0 = { on: true, weights: { "a@x": 1, "b@x": 3, "z@x": 0 } }, cnt = {}; for (let i = 0; i < 4000; i++) { const w = R.assigneeOf("ORD" + i, as0); cnt[w] = (cnt[w] || 0) + 1; }
ok("توزيع مسبق: ثابت لنفس الطلب، يحترم الحصص (1:3)، والحصة 0 والتعطيل بلا إسناد", R.assigneeOf("ORD7", as0) === R.assigneeOf("ORD7", as0) && !cnt["z@x"] && cnt["b@x"] > cnt["a@x"] * 2 && cnt["b@x"] < cnt["a@x"] * 4 && (cnt["a@x"] + cnt["b@x"]) === 4000 && R.assigneeOf("X", { on: false, weights: { a: 1 } }) === "" && R.assigneeOf("X", null) === "" && R.assigneeOf("X", { on: true, weights: {} }) === "", cnt);
ok("هدف لكل موظفة يغلب الافتراضي", R.goalFor({ daily: 10, rate: 70, per: { "a@x": { daily: 4 } } }, "a@x").daily === 4 && R.goalFor({ daily: 10, rate: 70, per: { "a@x": { daily: 4 } } }, "a@x").rate === 70 && R.goalFor({ daily: 10 }, "b@x").daily === 10 && R.goalFor(null, "x").daily === 0);
const lb = R.leaderboard([{ actor: "a", confirmed: 5, cancelled: 5, rate: 50 }, { actor: "b", confirmed: 9, cancelled: 1, rate: 90 }, { actor: "c", confirmed: 5, cancelled: 1, rate: 83 }, { actor: "d", confirmed: 0, cancelled: 0, rate: null }], [{ actor: "b", med_min: 5 }]);
ok("ترتيب الفريق: بالتأكيدات ثم النسبة، ويستثني من بلا قرارات", lb.length === 3 && lb[0].actor === "b" && lb[0].rank === 1 && lb[1].actor === "c" && lb[2].actor === "a" && lb[0].med === 5, lb);
ok("إحصاء فارغ", R.summarize([]).length === 0 && R.summarize(null).length === 0);

/* اتساق القوائم عبر المنصات */
const ts = rd("supabase/functions/staff-admin/index.ts"), php = rd("php-edition/api/index.php");
const arr = (src, re) => { const m = re.exec(src); return m ? [...m[1].matchAll(/["']([\w.]+)["']/g)].map(x => x[1]) : null; };
const jsPerms = R.PERMS.map(p => p.id);
ok("PERMS = الدالة الخادمية", JSON.stringify(arr(ts, /const PERMS = \[([^\]]*)\]/)) === JSON.stringify(jsPerms), arr(ts, /const PERMS = \[([^\]]*)\]/));
ok("PERMS = PHP", JSON.stringify(arr(php, /const STAFF_PERMS = \[([^\]]*)\]/)) === JSON.stringify(jsPerms));
for (const role of ["manager", "agent", "support", "accountant"]) {
  const t = arr(ts, new RegExp(role + ":\\s*\\[([^\\]]*)\\]")), p = arr(php, new RegExp("'" + role + "' => \\[([^\\]]*)\\]"));
  ok("دور " + role + ": اللوحة = الدالة الخادمية", JSON.stringify(t) === JSON.stringify(R.ROLES[role].perms), t);
  ok("دور " + role + ": اللوحة = PHP", JSON.stringify(p) === JSON.stringify(R.ROLES[role].perms), p);
  ok("دور " + role + ": كل صلاحية معروفة", R.ROLES[role].perms.every(x => jsPerms.includes(x)));
}
/* صلاحيات SQL المُستعملة يجب أن تكون ضمن القائمة */
const sql = rd("supabase/roles.sql"), used = [...sql.matchAll(/has_perm\('([\w.]+)'\)/g)].map(m => m[1]);
ok("كل has_perm في SQL صلاحية معروفة", used.length >= 4 && used.every(x => jsPerms.includes(x)), used);
ok("SQL: المالك مستثنى من حصر الأعمدة والمحفّز يدقّق الحالة والمكالمات", /orders_guard/.test(sql) && /order\.status/.test(sql) && /order\.call/.test(sql) && /_aal_ok/.test(sql));

/* كل قسم في القائمة له قرار صريح: مخصَّص بصلاحية أو للمالك فقط (يُضاف هنا عند أي قسم جديد) */
const html = rd("admin.html"), tabs = [...new Set([...html.matchAll(/onclick="Admin\.tab\('(\w+)'/g)].map(m => m[1]))];
const OWNER_ONLY = ["store", "setup", "agent", "analytics", "returns", "blacklist", "experts", "sources", "dispatch", "profit"];   // إعدادات عامة، وأقسام بياناتها في تخزين المالك (قريباً)
const unmapped = tabs.filter(t => !R.TAB_PERM[t] && !["team", "admtheme"].includes(t));
ok("أقسام القائمة: غير المسجَّلة هي المالك-فقط المعروفة", JSON.stringify(unmapped.sort()) === JSON.stringify(OWNER_ONLY.sort()), unmapped);
ok("لا قسم مسجَّل بصلاحية مجهولة", Object.values(R.TAB_PERM).concat(Object.values(R.APP_PERM)).every(p => jsPerms.includes(p)));
ok("لا صلاحية مالية لدور الاتصال", !R.has(agent, "finance") && !R.has(agent, "ship") && !R.has(agent, "site") && !R.has(agent, "customers"));
ok("المالية للمحاسب وحده افتراضياً", R.ROLES.accountant.perms.includes("finance") && !R.ROLES.manager.perms.includes("finance") && !R.ROLES.support.perms.includes("finance"));
console.log(fails ? `\n✗ ${fails} من ${total} فشل` : `✓ ${total} فحصاً ناجحاً`); process.exit(fails ? 1 : 0);
