/* ════════════════════════════════════════════════════════════════════
   أليسوم — إضافات Google Apps Script: الزيارات + المشاهدون الآن + أسئلة الوكيل بلا جواب
   الخطوات (مرة واحدة):
   1) افتح مشروع Apps Script الحالي (الذي فيه Code.gs وملف الطلبات) وأنشئ ملفاً جديداً بهذا المحتوى.
   2) في دالة doGet(e) الموجودة، أضف في أول سطر:
        var __x = handleExtraGet(e); if (__x) return __x;
   3) في دالة doPost(e) الموجودة، بعد تحويل الجسم إلى كائن (مثلاً var body = JSON.parse(e.postData.contents);) أضف:
        var __y = handleExtraPost(e, body); if (__y) return __y;
   4) Deploy ← Manage deployments ← ✏️ Edit ← Version: New version ← Deploy (نفس الرابط /exec، لا تنشئ رابطاً جديداً).
   ملاحظة: يفترض الكود أن السكربت مرتبط بجدول البيانات (Bound script) وأن ثابت المفتاح اسمه ADMIN_KEY كما في Code.gs.
   ════════════════════════════════════════════════════════════════════ */

var AY_QUESTIONS_SHEET = "AgentQuestions";
var AY_PRESENCE_TTL_SEC = 75;      // يُعدّ الزائر «يشاهد الآن» إن وصل نبضه خلال هذه المدة

function _ayKey() { return (typeof ADMIN_KEY !== "undefined") ? ADMIN_KEY : "ALYSSUM-ADMIN-2026"; }
function _ayNorm(s) { return String(s || "").toLowerCase().replace(/[ً-ٟـ]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^a-z0-9؀-ۿ]+/g, " ").trim(); }
function _ayDay(d) { return Utilities.formatDate(d || new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"); }
function _ayOut(e, obj) {
  var json = JSON.stringify(obj), cb = e && e.parameter && e.parameter.callback;
  if (cb) return ContentService.createTextOutput(cb + "(" + json + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* ── POST (من الزوار): hit / ping / agent_question  |  (من الإدارة): resolve_question ── */
function handleExtraPost(e, body) {
  var t = body && body.type;
  if (t === "hit") {                                   // زيارة (مرة لكل جلسة وصفحة)
    var page = String(body.page || "other").slice(0, 60), lock = LockService.getScriptLock();
    lock.tryLock(5000);
    try {
      var p = PropertiesService.getScriptProperties(), day = _ayDay();
      var inc = function (k) { p.setProperty(k, String((Number(p.getProperty(k)) || 0) + 1)); };
      inc("v_total"); inc("v_page_" + page); inc("v_day_" + day); inc("v_pd_" + day + "_" + page);
      if (body.isNew) inc("v_unique");
    } finally { lock.releaseLock(); }
    return ContentService.createTextOutput("ok");
  }
  if (t === "ping") {                                  // نبض «يشاهد الآن»
    var c = CacheService.getScriptCache(), lk = LockService.getScriptLock(), now = Date.now();
    lk.tryLock(3000);
    try {
      var map = JSON.parse(c.get("presence") || "{}"), out = {};
      map[String(body.vid || "").slice(0, 40)] = { p: String(body.page || "other").slice(0, 60), t: now };
      for (var k in map) if (now - map[k].t < AY_PRESENCE_TTL_SEC * 1000) out[k] = map[k];
      c.put("presence", JSON.stringify(out), 600);
    } finally { lk.releaseLock(); }
    return ContentService.createTextOutput("ok");
  }
  if (t === "agent_question") {                        // سؤال لم يفهمه الوكيل
    var q = String(body.q || "").trim().slice(0, 300);
    if (q.length < 3) return ContentService.createTextOutput("skip");
    var sh = _ayQuestionsSheet(), lock2 = LockService.getScriptLock(), n = _ayNorm(q);
    lock2.tryLock(5000);
    try {
      var data = sh.getDataRange().getValues(), found = -1;
      for (var i = 1; i < data.length; i++) if (data[i][2] === n && data[i][8] !== "done") { found = i; break; }
      var pageId = String(body.page || "home").slice(0, 60);
      if (found > 0) {
        var pages = String(data[found][4] || "").split(",").filter(String);
        if (pages.indexOf(pageId) < 0) pages.push(pageId);
        sh.getRange(found + 1, 4, 1, 1).setValue(Number(data[found][3] || 0) + 1);
        sh.getRange(found + 1, 5, 1, 1).setValue(pages.join(","));
        sh.getRange(found + 1, 8, 1, 1).setValue(new Date());
      } else {
        sh.appendRow(["q" + Date.now(), q, n, 1, pageId, String(body.lang || "ar"), new Date(), new Date(), "new"]);
      }
    } finally { lock2.releaseLock(); }
    return ContentService.createTextOutput("ok");
  }
  if (t === "resolve_question" && body.key === _ayKey()) {   // من لوحة الإدارة بعد الإجابة/التجاهل
    var sh2 = _ayQuestionsSheet(), d2 = sh2.getDataRange().getValues();
    for (var j = 1; j < d2.length; j++) if (d2[j][0] === body.id) { sh2.getRange(j + 1, 9, 1, 1).setValue("done"); break; }
    return ContentService.createTextOutput("ok");
  }
  return null;
}

function _ayQuestionsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(AY_QUESTIONS_SHEET);
  if (!sh) { sh = ss.insertSheet(AY_QUESTIONS_SHEET); sh.appendRow(["id", "question", "norm", "count", "pages", "lang", "first", "last", "status"]); }
  return sh;
}

/* ── GET (JSONP من لوحة الإدارة): presence / analytics / agent_questions ── */
function handleExtraGet(e) {
  var a = e && e.parameter && e.parameter.action;
  if (["presence", "analytics", "agent_questions"].indexOf(a) < 0) return null;
  if (e.parameter.key !== _ayKey()) return _ayOut(e, { ok: false, error: "unauthorized" });
  if (a === "presence") {
    var map = JSON.parse(CacheService.getScriptCache().get("presence") || "{}"), now = Date.now(), by = {}, total = 0;
    for (var k in map) if (now - map[k].t < AY_PRESENCE_TTL_SEC * 1000) { total++; by[map[k].p] = (by[map[k].p] || 0) + 1; }
    return _ayOut(e, { ok: true, now: total, byPage: by });
  }
  if (a === "analytics") {
    var props = PropertiesService.getScriptProperties().getProperties(), day = _ayDay(), pages = {}, today = {}, days = {};
    for (var key in props) {
      if (key.indexOf("v_page_") === 0) pages[key.slice(7)] = Number(props[key]);
      else if (key.indexOf("v_pd_" + day + "_") === 0) today[key.slice(("v_pd_" + day + "_").length)] = Number(props[key]);
      else if (key.indexOf("v_day_") === 0) days[key.slice(6)] = Number(props[key]);
    }
    return _ayOut(e, { ok: true, total: Number(props.v_total) || 0, unique: Number(props.v_unique) || 0, today: Number(props["v_day_" + day]) || 0, pages: pages, todayPages: today, days: days });
  }
  var rows = _ayQuestionsSheet().getDataRange().getValues().slice(1).filter(function (r) { return r[8] !== "done"; })
    .map(function (r) { return { id: r[0], q: r[1], count: r[3], pages: String(r[4] || "").split(",").filter(String), lang: r[5], last: r[7] }; })
    .sort(function (x, y) { return y.count - x.count; });
  return _ayOut(e, { ok: true, questions: rows });
}
