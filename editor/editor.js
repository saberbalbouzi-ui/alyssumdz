/* إقلاع المحرر: لوحة Fabric، حفظ تلقائي (IndexedDB)، اختصارات لوحة المفاتيح. المرحلة 1: لا شبكة ولا ذكاء اصطناعي. */
(function () {
  const Ed = window.Ed;
  /* ───── IndexedDB صغيرة: المستند + الأصول ───── */
  const idb = {
    db: null,
    open() { return this.db ? Promise.resolve(this.db) : new Promise((res, rej) => { const r = indexedDB.open("alyssum-editor", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { this.db = r.result; res(r.result); }; r.onerror = () => rej(r.error); }); },
    async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
    async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
  };
  Ed.idb = idb; const state = (t) => { const s = document.getElementById("savestate"); if (s) s.textContent = t; };
  let saveT, savedAssets = new Set();
  async function autosave() {
    try {
      const doc = Ed.serialize({ embed: false }), ids = JSON.stringify(doc).match(/asset:[\w]+/g) || [];
      for (const x of new Set(ids)) { const id = x.slice(6); if (!savedAssets.has(id) && Ed.assets.has(id)) { await idb.set("asset:" + id, Ed.assets.get(id)); savedAssets.add(id); } }
      doc.savedAt = Date.now(); await idb.set("doc", doc); state("✓ حُفظ تلقائياً " + new Date().toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) { console.warn("autosave", e); state("⚠️ تعذّر الحفظ التلقائي"); }
  }
  Ed.autosaveNow = autosave;
  Ed.on("history", () => { state("…"); clearTimeout(saveT); saveT = setTimeout(autosave, 1000); });
  async function restore() {
    try {
      const doc = await idb.get("doc"); if (!doc || !doc.objects || doc.objects.length < 2) return false;
      const ids = JSON.stringify(doc).match(/asset:[\w]+/g) || []; for (const x of new Set(ids)) { const a = await idb.get("asset:" + x.slice(6)); if (a) { Ed.assets.set(x.slice(6), a); savedAssets.add(x.slice(6)); } }
      await Ed.deserialize(doc); return true;
    } catch (e) { console.warn("restore", e); return false; }
  }
  /* ───── اختصارات ───── */
  function typing(e) { const t = e.target; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return true; const a = Ed.c.getActiveObject(); return !!(a && a.isEditing); }
  window.addEventListener("keydown", e => {
    if (typing(e)) return; const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === "z") { e.preventDefault(); e.shiftKey ? Ed.history.redo() : Ed.history.undo(); }
    else if (mod && k === "y") { e.preventDefault(); Ed.history.redo(); }
    else if (mod && k === "d") { e.preventDefault(); const o = Ed.selected(); if (o) Ed.layers.duplicate(o); }
    else if (mod && k === "a") { e.preventDefault(); Ed.selectAll(); }
    else if (mod && k === "s") { e.preventDefault(); Ed.saveFile(); }
    else if (mod && k === "g") { e.preventDefault(); e.shiftKey ? Ed.layers.ungroup() : Ed.layers.group(); }
    else if (k === "delete" || k === "backspace") { e.preventDefault(); const l = Ed.selectedList(); if (l.length) Ed.layers.remove(l); }
    else if (k === "escape") { if (Ed.cropping()) Ed.endCrop(false); else { Ed.c.discardActiveObject(); Ed.c.requestRenderAll(); } }
    else if (k === "enter" && Ed.cropping()) Ed.endCrop(true);
    else if (k.startsWith("arrow") && Ed.selected()) { e.preventDefault(); const s = e.shiftKey ? 10 : 1; Ed.nudge(k === "arrowleft" ? -s : k === "arrowright" ? s : 0, k === "arrowup" ? -s : k === "arrowdown" ? s : 0); }
  });
  window.addEventListener("beforeunload", () => { try { Ed.history.flush(); autosave(); } catch (e) { } });
  window.addEventListener("resize", () => { });
  document.addEventListener("DOMContentLoaded", async () => {
    Ed.init(document.getElementById("cv")); Ed.initPanZoom(document.getElementById("stage"));
    if (document.fonts) { try { await Promise.race([Promise.all(["400", "700", "800"].map(w => document.fonts.load(w + " 20px Cairo"))), new Promise(r => setTimeout(r, 1500))]); } catch (e) { } }
    const ok = await restore(); if (!ok) Ed.newDoc(1080, 3000, "#ffffff"); else Ed.toast("استُعيد آخر تصميم تلقائياً");
    Ed.history.reset(); Ed.emit("layers"); state("جاهز");
    window.__editorReady = true;
  });
})();
