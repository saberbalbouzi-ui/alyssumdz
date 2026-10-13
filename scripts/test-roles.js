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
ok("المحاسب (قراءة): لوحة المبيعات والتقارير فقط الآن", R.tabAllowed(acct, "reports") && R.tabAllowed(acct, "home") && R.tabAllowed(acct, "orders") && !R.tabAllowed(acct, "finance") && !R.tabAllowed(acct, "payments") && !R.tabAllowed(acct, "builder") && !R.tabAllowed(acct, "callcenter"));
ok("صلاحيات «قريباً» لا تفتح أقساماً حتى لو مُنحت عبر الخادم", !R.tabAllowed({ owner: false, perms: ["finance", "products", "site", "customers", "ship", "marketing"] }, "finance") && !R.tabAllowed({ owner: false, perms: ["products"] }, "products") && R.SOON.length === 6);
ok("بلا هوية لا يُسمح بشيء", !R.tabAllowed(null, "orders") && !R.has(null, "orders"));
ok("تطبيقات: اسألني للجميع والمطوّر بصلاحية الموقع", R.appAllowed(agent, "ask") && !R.appAllowed(agent, "builder") && R.appAllowed(owner, "cloner"));
ok("الصفحة الأولى: الاتصال للموظف ثم الطلبات", R.firstTab(agent) === "callcenter" && R.firstTab({ owner: false, perms: ["orders"] }) === "orders" && R.firstTab({ owner: false, perms: [] }) === "team" && R.firstTab(owner) === "callcenter");
ok("صلاحية نجمية لا تتجاوز «قريباً»", R.has({ owner: false, perms: ["*"] }, "orders") && !R.has({ owner: false, perms: ["*"] }, "finance"));

const rows = [
  { actor: "a@x", role: "agent", action: "order.status", to_status: "confirmee", n: 6, last_at: "2026-10-13T10:00:00Z" },
  { actor: "a@x", role: "agent", action: "order.status", to_status: "annulee", n: 2, last_at: "2026-10-13T11:00:00Z" },
  { actor: "a@x", role: "agent", action: "order.call", to_status: "📞1", n: 9, last_at: "2026-10-13T09:00:00Z" },
  { actor: "b@x", role: "agent", action: "order.status", to_status: "confirmee", n: 10, last_at: "2026-10-12T09:00:00Z" },
  { actor: "b@x", role: "agent", action: "login", to_status: "", n: 3, last_at: "2026-10-12T08:00:00Z" },
];
const sm = R.summarize(rows);
ok("إحصاء الفريق: ترتيب بالتأكيدات ونسبة التأكيد", sm.length === 2 && sm[0].actor === "b@x" && sm[0].confirmed === 10 && sm[0].rate === 100 && sm[1].actor === "a@x" && sm[1].confirmed === 6 && sm[1].cancelled === 2 && sm[1].rate === 75 && sm[1].calls === 9 && sm[1].last === "2026-10-13T11:00:00Z", sm);
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
const OWNER_ONLY = ["store", "setup", "agent", "analytics", "returns", "blacklist"];   // إعدادات عامة، وأقسام بياناتها في تخزين المالك (قريباً)
const unmapped = tabs.filter(t => !R.TAB_PERM[t] && !["team", "admtheme"].includes(t));
ok("أقسام القائمة: غير المسجَّلة هي المالك-فقط المعروفة", JSON.stringify(unmapped.sort()) === JSON.stringify(OWNER_ONLY.sort()), unmapped);
ok("لا قسم مسجَّل بصلاحية مجهولة", Object.values(R.TAB_PERM).concat(Object.values(R.APP_PERM)).every(p => jsPerms.includes(p)));
ok("لا صلاحية مالية لدور الاتصال", !R.has(agent, "finance") && !R.has(agent, "ship") && !R.has(agent, "site"));
console.log(fails ? `\n✗ ${fails} من ${total} فشل` : `✓ ${total} فحصاً ناجحاً`); process.exit(fails ? 1 : 0);
