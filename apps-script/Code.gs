/* ═══════════════════════════════════════════════════════════════
   أليسوم — Google Apps Script للمتجر (الطلبات في Google Sheets)
   يحل محل أي سكربت قديم (مثل سكربت WooCommerce). الخطوات:
   1) أنشئ جدول Google Sheets جديداً ← Extensions ← Apps Script ← الصق هذا الملف في Code.gs.
   2) غيّر ADMIN_KEY أدناه إلى قيمة طويلة وعشوائية (30 حرفاً أو أكثر). لا تنشر القيمة في المستودع أو في الدردشة.
   3) (اختياري) أضف ملف Code-additions.gs كملف ثانٍ: الزيارات والمشاهدون الآن وأسئلة الوكيل.
   4) شغّل الدالة setup مرة واحدة وامنحها الصلاحيات.
   5) Deploy ← New deployment ← Web app ← Execute as: Me ← Who has access: Anyone ← Deploy.
   6) انسخ رابط /exec إلى API_URL في assets/js/config.js.
   لتحديث الكود لاحقاً: Manage deployments ← ✏️ ← New version (يبقى الرابط نفسه).
   ═══════════════════════════════════════════════════════════════ */

var ADMIN_KEY = "CHANGE-ME-TO-A-LONG-RANDOM-SECRET";   // ← غيّره قبل النشر
var ORDERS_SHEET = "Orders";
var HEADERS = ["id", "date", "name", "phone", "wilaya", "commune", "dtype", "desk", "items", "subtotal", "fee", "total", "coupon", "discount", "extra", "status", "note"];
var STATUSES = ["nouvelle", "confirmee", "expediee", "livree", "annulee", "echec"];
var MAX_PER_PHONE = 5;          // أقصى عدد طلبات لكل هاتف
var WINDOW_MIN = 10;            // خلال هذه المدة بالدقائق

function setup() {
  _sheet();
  if (ADMIN_KEY === "CHANGE-ME-TO-A-LONG-RANDOM-SECRET" || ADMIN_KEY.length < 20) throw new Error("غيّر ADMIN_KEY إلى قيمة طويلة قبل النشر");
}

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(ORDERS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ORDERS_SHEET);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#1f5c3f").setFontColor("#ffffff");
    sh.setFrozenRows(1);
    sh.getRange(2, 16, sh.getMaxRows() - 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());
  }
  return sh;
}

function _json(e, obj) {
  var s = JSON.stringify(obj), cb = e && e.parameter && e.parameter.callback;
  if (cb && /^[A-Za-z0-9_.$]+$/.test(cb)) return ContentService.createTextOutput(cb + "(" + s + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}

function _safeEqual(a, b) {                       // مقارنة بزمن ثابت
  a = String(a || ""); b = String(b || "");
  if (a.length !== b.length) return false;
  var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function _authorized(key) { return ADMIN_KEY.length >= 20 && _safeEqual(key, ADMIN_KEY); }

/* منع حقن الصيغ في Google Sheets (=, +, -, @) */
function _cell(v, max) {
  v = String(v == null ? "" : v).slice(0, max || 300);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function _num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

/* ── GET (JSONP): orders | products/fees/categories (تقرأها الواجهة محلياً فنردّ فارغاً) ── */
function doGet(e) {
  try {
    if (typeof handleExtraGet === "function") { var x = handleExtraGet(e); if (x) return x; }
    var a = e && e.parameter && e.parameter.action;
    if (a === "orders") {
      if (!_authorized(e.parameter.key)) return _json(e, { ok: false, error: "unauthorized" });
      var sh = _sheet(), last = sh.getLastRow();
      if (last < 2) return _json(e, { ok: true, orders: [] });
      var rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues(), tz = Session.getScriptTimeZone();
      var orders = rows.map(function (r) {
        var o = {}; HEADERS.forEach(function (h, i) { o[h] = r[i]; });
        if (o.date instanceof Date) o.date = o.date.toISOString();
        try { o.extra = o.extra ? JSON.parse(o.extra) : {}; } catch (er) { o.extra = {}; }
        return o;
      }).reverse();
      return _json(e, { ok: true, orders: orders });
    }
    return _json(e, { ok: false, error: "unknown_action" });
  } catch (err) { return _json(e, { ok: false, error: "server_error" }); }
}

/* ── POST (نصّ JSON بلا CORS): order من الزبائن | update_order من الإدارة ── */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse(e.postData.contents);
    if (typeof handleExtraPost === "function") { var y = handleExtraPost(e, body); if (y) return y; }
    lock.waitLock(10000);
    if (body.type === "order") return _out(_addOrder(body.order || {}));
    if (body.type === "update_order") {
      if (!_authorized(body.key)) return _out("unauthorized");
      return _out(_updateOrder(body.id, body.status, body.note));
    }
    return _out("ignored");                       // save_product / save_fees ... تُدار عبر GitHub وليس الجدول
  } catch (err) { return _out("error"); }
  finally { try { lock.releaseLock(); } catch (e2) {} }
}
function _out(t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT); }

function _addOrder(o) {
  var name = String(o.name || "").trim(), phone = String(o.phone || "").replace(/[^0-9+]/g, "");
  var items = Array.isArray(o.items) ? o.items : [];
  if (name.length < 2 || name.length > 120) return "invalid_name";
  if (phone.length < 6 || phone.length > 20) return "invalid_phone";
  if (items.length < 1 || items.length > 50) return "invalid_items";
  var total = _num(o.total); if (total < 0 || total > 10000000) return "invalid_total";

  var sh = _sheet(), last = sh.getLastRow(), cutoff = Date.now() - WINDOW_MIN * 60000, count = 0;
  if (last > 1) {                                  // حدّ المعدّل لكل هاتف
    var from = Math.max(2, last - 200 + 1);
    sh.getRange(from, 2, last - from + 1, 3).getValues().forEach(function (r) {
      var d = r[0] instanceof Date ? r[0].getTime() : 0;
      if (d > cutoff && String(r[2]).replace(/[^0-9+]/g, "") === phone) count++;
    });
    if (count >= MAX_PER_PHONE) return "rate_limited";
  }
  var text = items.map(function (i) { return String(i.title || "") + " ×" + (_num(i.qty) || 1) + " = " + Math.round(_num(i.price) * (_num(i.qty) || 1)) + " DA"; }).join("\n");
  var id = "S" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyMMdd") + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 5).toUpperCase();
  var extra = ""; try { extra = o.extra ? JSON.stringify(o.extra).slice(0, 2000) : ""; } catch (er) {}
  sh.appendRow([id, new Date(), _cell(name, 120), "'" + phone, _cell(o.wilaya, 80), _cell(o.commune, 120), _cell(o.dtype, 10), _cell(o.desk, 160),
    _cell(text, 2000), _num(o.subtotal), _num(o.fee), total, _cell(o.coupon, 40), _num(o.discount), _cell(extra, 2000), "nouvelle", ""]);
  return id;
}

function _updateOrder(id, status, note) {
  if (status && STATUSES.indexOf(status) < 0) return "invalid_status";
  var sh = _sheet(), last = sh.getLastRow();
  if (last < 2) return "not_found";
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      if (status) sh.getRange(i + 2, 16).setValue(status);
      if (note !== undefined && note !== null) sh.getRange(i + 2, 17).setValue(_cell(note, 500));
      return "ok";
    }
  }
  return "not_found";
}
