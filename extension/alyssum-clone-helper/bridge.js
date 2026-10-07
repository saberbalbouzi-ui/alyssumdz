/* جسر بين صفحة لوحة التحكم (admin.html) والإضافة: يستقبل طلبات postMessage ويمرّرها للخلفية. لا يُنفَّذ شيء إلا بعد موافقتك على نطاق اللوحة. */
(() => {
  if (window.__alyCloneBridge) return; window.__alyCloneBridge = 1;
  const send = m => window.postMessage(Object.assign({ aly: 1 }, m), location.origin);
  async function allowed(ask) {
    const k = "ok:" + location.origin, st = await chrome.storage.local.get(k); if (st[k]) return true; if (!ask) return false;
    if (!document.querySelector('meta[name="admin-version"]')) return false;      // لوحات أليسوم فقط
    if (confirm("السماح للوحة التحكم (" + location.origin + ") بفتح المواقع في متصفحك عبر إضافة «مساعد نسخ القوالب»؟\n(تُفتح نافذة صغيرة مؤقتة لكل موقع ثم تُغلق)")) { await chrome.storage.local.set({ [k]: true }); return true; } return false;
  }
  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };      // بعد تحديث الإضافة يبقى هذا السكربت يتيماً في الصفحة المفتوحة
  const onMsg = async e => {
    const d = e.data; if (e.source !== window || !d || d.alyReq !== 1) return;
    if (!alive()) { window.removeEventListener("message", onMsg); return; }      // يتجاهل بصمت؛ أعد تحميل اللوحة (F5) ليُحقن الجسر الجديد
    try {
    if (d.type === "ping") return send({ type: "pong", id: d.id, v: chrome.runtime.getManifest().version, ok: await allowed(false) });
    if (d.type === "fetch") {
      if (!(await allowed(true))) return send({ type: "res", id: d.id, error: "لم يُسمح للوحة باستعمال الإضافة" });
      try { chrome.runtime.sendMessage({ type: "fetch", url: String(d.url || ""), width: d.width }, r => { const le = chrome.runtime.lastError; send(Object.assign({ type: "res", id: d.id }, le ? { error: le.message } : (r || { error: "لا استجابة" }))); }); } catch (err) { send({ type: "res", id: d.id, error: String(err && err.message || err) }); }
    }
    } catch (err) { if (!alive()) window.removeEventListener("message", onMsg); }
  };
  window.addEventListener("message", onMsg);
})();
