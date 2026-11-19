// إعداد حماية «معلن» لأدوات الفحص اليدوية فقط: إعداد المستودع assets/data/protect.json كما هو عدا bots:false عبر استجابة معدّلة داخل المتصفح.
// بديل عن انتحال User-Agent وإخفاء navigator.webdriver (ممنوعَين): لا يُغيَّر ملف المستودع ولا حزمة العميل، ويُطبع الإعداد عند التشغيل.
// الحجب نفسه مُختبَر مستقلاً في scripts/test-protect-bots.js.
const fs = require("fs"), path = require("path");
const CFG = Object.assign({}, JSON.parse(fs.readFileSync(path.join(__dirname, "..", "assets/data/protect.json"), "utf8")), { bots: false });
let logged = false;
module.exports = async function declareProtect(ctx) {
  if (!logged) { logged = true; console.log("إعداد الحماية المعلن لهذه الأداة فقط (إعداد المستودع عدا bots:false؛ بلا انتحال UA/webdriver):", JSON.stringify(CFG)); }
  await ctx.route("**/assets/data/protect.json*", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(CFG) }));
  return ctx;
};
