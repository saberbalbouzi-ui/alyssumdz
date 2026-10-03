/* السحابة (Supabase) — المرحلة 2. الوصول بمفتاح خاص بالمحرر عبر دوال RPC (supabase/editor.sql)، والصور في Storage.
   لا يُرسل شيء إلى الشبكة أثناء التحرير؛ الحفظ السحابي صريح (زر) أو دوري لمشروع مفتوح فقط. */
(function () {
  const Ed = window.Ed; const SS = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, LSg = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const C = Ed.cloud = {
    conf() { const c = typeof CONFIG !== "undefined" ? CONFIG : {}; return { url: String(c.SUPABASE_URL || "").replace(/\/+$/, ""), anon: c.SUPABASE_ANON_KEY || "" }; },
    enabled() { const c = this.conf(); return !!(c.url && c.anon); },
    getKey() { return SS("ed_key") || LSg("ed_key") || ""; },
    setKey(k, remember) { try { sessionStorage.setItem("ed_key", k); remember ? localStorage.setItem("ed_key", k) : localStorage.removeItem("ed_key"); } catch (e) { } },
    clearKey() { try { sessionStorage.removeItem("ed_key"); localStorage.removeItem("ed_key"); } catch (e) { } },
    headers(json) { const c = this.conf(), h = { apikey: c.anon }; if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(c.anon)) h.Authorization = "Bearer " + c.anon; if (json) h["Content-Type"] = "application/json"; return h; },
    async rpc(fn, p) {
      if (!this.enabled()) throw new Error("Supabase غير مضبوط في config.js");
      let r; try { r = await fetch(this.conf().url + "/rest/v1/rpc/" + fn, { method: "POST", headers: this.headers(true), body: JSON.stringify({ p: Object.assign({ key: this.getKey() }, p || {}) }) }); } catch (e) { throw new Error("تعذّر الاتصال بالإنترنت"); }
      const j = await r.json().catch(() => null);
      if (!r.ok) { const m = String((j && (j.message || j.hint)) || r.status); if (/forbidden/.test(m)) { throw Object.assign(new Error("مفتاح المحرر غير صحيح"), { auth: true }); } if (r.status === 404 || /Could not find the function/.test(m)) throw new Error("دوال المحرر غير مثبّتة: شغّل supabase/editor.sql في Supabase"); throw new Error(m); }
      return j;
    },
    /* يضمن وجود مفتاح صالح (يسأل عنه مرة واحدة ويتحقق) */
    async ensureKey() {
      if (this.getKey()) { try { await this.rpc("editor_ping"); return true; } catch (e) { if (!e.auth) throw e; this.clearKey(); Ed.toast("المفتاح غير صحيح، أعد إدخاله"); } }
      for (let i = 0; i < 3; i++) {
        const a = await Ed.promptDialog("مفتاح المحرر", "أدخل مفتاح المحرر الخاص", "", { password: true, remember: true, note: "مفتاح مستقل عن حساب لوحة التحكم، يُحفظ في هذا الجهاز فقط ولا يُرسل إلا للتحقق." });
        if (!a || !a.value) return false; this.setKey(a.value.trim(), a.remember);
        try { await this.rpc("editor_ping"); Ed.toast("تم التحقق ✓"); return true; } catch (e) { if (!e.auth) throw e; this.clearKey(); Ed.toast("المفتاح غير صحيح"); }
      }
      return false;
    },
    projects() { return this.rpc("editor_projects"); },
    createProject(name, w, h) { return this.rpc("editor_project_create", { name, width: w, height: h }); },
    renameProject(id, name) { return this.rpc("editor_project_rename", { id, name }); },
    deleteProject(id) { return this.rpc("editor_project_delete", { id }); },
    versions(project) { return this.rpc("editor_versions", { project }); },
    /* رفع الأصول المحلية (data:) إلى Storage عبر إذن مسبق؛ تتحول إلى روابط عامة */
    async uploadAssets(project, onStep) {
      const used = new Set((JSON.stringify(Ed.serialize({ embed: false })).match(/asset:[\w]+/g) || []).map(x => x.slice(6))), cfg = this.conf(); let n = 0;
      for (const id of used) {
        const a = Ed.assets.get(id); if (!a || !/^data:/.test(a.src)) continue; onStep && onStep("رفع صورة " + (++n));
        let blob = await (await fetch(a.src)).blob();
        if (blob.size > 4 * 1024 * 1024 || !/image\/(png|jpeg|webp|gif)/.test(blob.type)) {                 // إعادة ترميز WebP للكبيرة
          const el = await Ed.loadEl(a.src), k = Math.min(1, 4000 / Math.max(el.naturalWidth, el.naturalHeight)), cv = document.createElement("canvas"); cv.width = Math.round(el.naturalWidth * k); cv.height = Math.round(el.naturalHeight * k); cv.getContext("2d").drawImage(el, 0, 0, cv.width, cv.height);
          blob = await new Promise(r => cv.toBlob(r, "image/webp", .92)); a.w = cv.width; a.h = cv.height;
        }
        const ext = ({ "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif" })[blob.type] || "webp";
        const g = await this.rpc("editor_asset_grant", { project, ext, name: a.name, w: a.w, h: a.h });
        const r = await fetch(cfg.url + "/storage/v1/object/editor/" + g.path, { method: "POST", headers: Object.assign(this.headers(false), { "Content-Type": blob.type, "x-upsert": "false", "cache-control": "max-age=31536000" }), body: blob });
        if (!r.ok) throw new Error("فشل رفع صورة (" + r.status + ")");
        a.src = cfg.url + "/storage/v1/object/public/editor/" + g.path; a.remote = true;
      }
      return n;
    },
    thumb() { const m = Math.min(1, 240 / Ed.doc.width) / Ed.zoom; Ed.c.discardActiveObject(); Ed.c.renderAll(); return Ed.c.toDataURL({ format: "jpeg", quality: .6, multiplier: m, enableRetinaScaling: false }); },
    /* حفظ إصدار جديد من التصميم الحالي */
    async save(opt) {
      opt = opt || {}; if (this.busy) return null; this.busy = true;
      try {
        if (!(await this.ensureKey())) return null;
        if (!Ed.project) { const a = await Ed.promptDialog("مشروع جديد", "اسم المشروع", Ed.projectName || ""); if (!a || !a.value.trim()) return null; const r = await this.createProject(a.value.trim(), Ed.doc.width, Ed.doc.height); Ed.setProject({ id: r.id, name: r.name }); }
        await this.uploadAssets(Ed.project.id, t => !opt.quiet && Ed.toast("☁ " + t + "…", 1500));
        const doc = Ed.serialize({ embed: true }); if (Object.values(doc.assets || {}).some(a => /^data:/.test(a.src))) throw new Error("بقيت صور محلية غير مرفوعة");
        const r = await this.rpc("editor_design_save", { project: Ed.project.id, doc, thumb: this.thumb() });
        Ed.cloudDirty = false; Ed.emit("cloud"); if (!opt.quiet) Ed.toast("☁ حُفظ في السحابة — نسخة " + r.version); return r;
      } finally { this.busy = false; }
    },
    async open(id, name, version) {
      const r = await this.rpc("editor_design_load", { project: id, version: version || null });
      if (!r) { Ed.setProject({ id, name }); Ed.newDoc(1080, 3000, "#ffffff"); Ed.history.reset(); return; }
      await Ed.deserialize(r.doc); Ed.history.reset(); Ed.setProject({ id, name }); Ed.cloudDirty = false; Ed.emit("changed", "open"); Ed.toast("فُتح «" + name + "» — نسخة " + r.version);
    }
  };
  Ed.project = null;
  Ed.setProject = function (p) { Ed.project = p; Ed.projectName = p ? p.name : ""; try { p ? localStorage.setItem("ed_project", JSON.stringify(p)) : localStorage.removeItem("ed_project"); } catch (e) { } Ed.emit("cloud"); };
  Ed.on("history", () => { Ed.cloudDirty = true; Ed.emit("cloud"); });
  setInterval(() => { if (Ed.project && Ed.cloudDirty && C.getKey() && !C.busy && !document.querySelector(".modal") && navigator.onLine) C.save({ quiet: true }).catch(e => console.warn("cloud autosave", e.message)); }, 120000);
})();
