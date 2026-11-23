/* مطابقة مدارات Spatial Core لقائمة لوحة التحكم الحقيقية (admin.html): المدار العلوي = المجموعات، والمدار الثاني = عناصر كل مجموعة بأسمائها وترتيبها،
   وكل عنصر يفتح لوحاً حقيقياً على التبويب نفسه (FRAME[id].tab) الموجود فعلاً في admin.html. يمنع انجراف القائمتين عند إضافة تبويب جديد (لا مستعرض). التشغيل: node admin-preview/spatial-os/test/nav-sync.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 400) : "")); console.log(R[R.length - 1]); };
const ROOT = path.resolve(__dirname, "../../.."), html = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
/* قائمة اللوحة: كل زر nav-btn ظاهر (ليس nav-hid) بمجموعته وتبويبه واسمه */
const nav = []; const re = /<button class="nav-btn([^"]*)"[^>]*data-grp="([a-z]+)"[^>]*onclick="Admin\.tab\('([a-z0-9_-]+)'[^>]*>[\s\S]*?<b>([^<]+)/g; let m;
while ((m = re.exec(html))) { if (/nav-hid/.test(m[1])) continue; nav.push({ grp: m[2], tab: m[3], name: m[4].trim() }); }
const ctx = vm.createContext({ window: {}, document: {}, console }); const src = fs.readFileSync(path.join(__dirname, "../panels.js"), "utf8");
vm.runInContext(src + "\n;globalThis.__o = { SEC, GROUPS, RING, NAVX };", ctx); const { SEC, GROUPS, RING } = ctx.__o;
const sp = fs.readFileSync(path.join(__dirname, "../spatial.js"), "utf8"), FRAME = {}; { const mm = sp.match(/const FRAME = \{([\s\S]*?)\n  \};|const FRAME = \{([\s\S]*?)\};/); const body = (mm[1] || mm[2]); body.replace(/(\w+): \{ tab: "([a-z0-9_-]+)"/g, (_, k, t) => { FRAME[k] = t; }); }
NAVX_IDS = ctx.__o.NAVX.map(x => x[0]); NAVX_IDS.forEach(id => { FRAME[id] = id; });                        /* تُسجَّل ديناميكياً بـObject.fromEntries(NAVX…) */
const grpOf = { dash: [["gen", "home"]], prod: "products", store: "shop", look: "look", ext: "apps", set: "gen" };
ok("المدار العلوي ستة عناصر بالترتيب: الرئيسية، المنتجات، المتجر، المظهر، إضافات، الإعدادات العامة", JSON.stringify(RING.map(id => SEC.find(s => s.id === id).name)) === JSON.stringify(["الرئيسية", "المنتجات", "المتجر", "المظهر", "إضافات", "الإعدادات العامة"]), RING.map(id => SEC.find(s => s.id === id).name));
const names = ["الرئيسية", "المنتجات", "المتجر", "المظهر", "إضافات", "الإعدادات العامة"], hdr = [...html.matchAll(/<button type="button" class="ng[^"]*" data-g="([a-z]+)"[^>]*>[\s\S]*?<b>([^<]+)<\/b>/g)].map(x => [x[1], x[2].trim()]);
ok("أسماء مجموعات القائمة الحقيقية موجودة في admin.html (المنتجات/المتجر/المظهر/إضافات/الإعدادات العامة)", ["products:المنتجات", "shop:المتجر", "look:المظهر", "apps:إضافات", "gen:الإعدادات العامة"].every(x => hdr.some(h => h.join(":") === x)), hdr);
for (const top of RING) {
  const g = grpOf[top], items = top === "dash" ? nav.filter(n => n.tab === "home") : nav.filter(n => n.grp === g && !(top === "set" && n.tab === "home"));
  const ent = GROUPS[top].map(e => e.split("|")), got = ent.map(e => ({ id: e[0], label: e[1] || SEC.find(s => s.id === e[0]).name, tab: FRAME[e[0]] }));
  const exp = items.map(i => ({ tab: i.tab, name: i.name })), act = got.map(x => ({ tab: x.tab, name: x.label }));
  const nm = n => n.replace(/\s+/g, " ").trim();
  ok("المجموعة «" + SEC.find(s => s.id === top).name + "»: عناصرها وترتيبها وأسماؤها مطابقة للقائمة", JSON.stringify(act.map(x => [x.tab, x.name === "لوحة التحكم" || true ? nm(x.name) : x.name])) === JSON.stringify(exp.map(x => [x.tab, nm(x.name)])), { act: act.map(x => x.tab + ":" + x.name).join(" | "), exp: exp.map(x => x.tab + ":" + x.name).join(" | ") });
}
ok("كل عنصر في المدارات له بطاقة SEC وتبويب حقيقي في admin.html", Object.values(GROUPS).flat().every(e => { const id = e.split("|")[0], t = FRAME[id]; return SEC.some(s => s.id === id) && !!t && html.includes("Admin.tab('" + t + "'") || (t && new RegExp("id=\"tab-" + t + "\"").test(html)); }), Object.values(GROUPS).flat().filter(e => { const id = e.split("|")[0], t = FRAME[id]; return !(SEC.some(s => s.id === id) && !!t && html.includes("Admin.tab('" + t + "'")); }));
console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
