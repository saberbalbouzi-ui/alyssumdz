/* مزامنة ثنائية الاتجاه بين المنصة وGoogle Sheets لمركز الاتصال.
   1) أنشئ جدولاً بورقة "Orders" وفي الصف الأول: order_id | event | status | date | name | phone | wilaya | commune | address | items | total | note | v
   2) Extensions ← Apps Script ← الصق هذا الملف.  3) Project Settings ← Script properties: SHARED_SECRET (سرّ طويل عشوائي) و PLATFORM_URL (مثل https://api.example) و PLATFORM_KEY (مفتاح بنطاق sheets:inbound).
   4) Deploy ← Web app ← Execute as: Me ← Who has access: Anyone ← انسخ الرابط (…/exec) إلى تكامل sheets في المنصة (config.script_url) مع secrets.shared_secret بالقيمة نفسها.
   5) Triggers ← Add: onEditInstalled ← From spreadsheet ← On edit.   حقل v يزداد عند كل تعديل ليمنع تكرار المعالجة. */
const SHEET = "Orders", COLS = ["order_id", "event", "status", "date", "name", "phone", "wilaya", "commune", "address", "items", "total", "note", "v"];
function props_() { return PropertiesService.getScriptProperties(); }
function sheet_() { return SpreadsheetApp.getActive().getSheetByName(SHEET); }

/* المنصة ← الجدول: إدراج/تحديث صف برقم الطلب */
function doPost(e) {
  const body = JSON.parse(e.postData.contents || "{}");
  if (!body.secret || body.secret !== props_().getProperty("SHARED_SECRET")) return json_({ ok: false, error: "forbidden" });
  if (body.action !== "upsert" || !body.row || !body.row.order_id) return json_({ ok: false, error: "bad_request" });
  const sh = sheet_(), ids = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues().map(r => String(r[0]));
  let row = ids.indexOf(String(body.row.order_id)); row = row < 0 ? sh.getLastRow() + 1 : row + 2;
  const prevV = Number(sh.getRange(row, COLS.indexOf("v") + 1).getValue()) || 0;
  sh.getRange(row, 1, 1, COLS.length).setValues([COLS.map(c => c === "v" ? prevV : (body.row[c] === undefined ? "" : body.row[c]))]);
  return json_({ ok: true, row: row });
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* الجدول ← المنصة: عند تعديل عمود status أو note يُرسل التحديث */
function onEditInstalled(e) {
  const sh = e.range.getSheet(); if (sh.getName() !== SHEET || e.range.getRow() < 2) return;
  const col = COLS[e.range.getColumn() - 1]; if (col !== "status" && col !== "note") return;
  const r = e.range.getRow(), vals = sh.getRange(r, 1, 1, COLS.length).getValues()[0], rec = {}; COLS.forEach((c, i) => rec[c] = vals[i]);
  const v = (Number(rec.v) || 0) + 1; sh.getRange(r, COLS.indexOf("v") + 1).setValue(v);
  const p = props_();
  UrlFetchApp.fetch(p.getProperty("PLATFORM_URL") + "/v1/sheets/inbound", { method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + p.getProperty("PLATFORM_KEY"), "Idempotency-Key": rec.order_id + ":" + v },
    payload: JSON.stringify({ updates: [{ order_id: String(rec.order_id), status: String(rec.status), note: String(rec.note || ""), v: String(v) }] }) });
}
