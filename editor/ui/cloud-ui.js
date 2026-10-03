(function () {
  const Ed = window.Ed; const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const when = d => { try { return new Date(d).toLocaleString("ar-DZ", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return ""; } };
  async function safe(fn) { try { return await fn(); } catch (e) { console.error(e); Ed.toast("⚠️ " + e.message, 4000); } }
  async function projectsDialog() {
    if (!Ed.cloud.enabled()) return Ed.toast("Supabase غير مضبوط");
    if (!(await Ed.cloud.ensureKey())) return;
    const list = await Ed.cloud.projects();
    const m = Ed.modal('<h3>☁ مشاريعي</h3><div class="acts" style="justify-content:flex-start;margin:0 0 .6rem"><button class="pri" data-n="1">+ مشروع جديد (من التصميم الحالي)</button></div><div id="pj" style="display:grid;gap:.5rem">' +
      (list.length ? list.map(p => '<div class="pj" data-id="' + p.id + '" data-name="' + esc(p.name) + '" style="display:flex;gap:.6rem;align-items:center;border:1px solid var(--line);border-radius:10px;padding:.4rem"><img src="' + esc(p.thumbnail || "") + '" alt="" style="width:56px;height:72px;object-fit:cover;object-position:top;background:#eee;border-radius:6px"><div style="flex:1;min-width:0"><b>' + esc(p.name) + '</b><div class="muted">' + p.width + "×" + p.height + " · " + p.versions + " نسخة · " + when(p.updated_at) + '</div></div><button data-a="open" class="pri">فتح</button><button data-a="ver">النسخ</button><button data-a="ren">✎</button><button data-a="del">🗑</button></div>').join("") : '<p class="muted">لا مشاريع بعد.</p>') +
      '</div><div class="acts"><button data-x="1">إغلاق</button></div>');
    m.addEventListener("click", e => safe(async () => {
      if (e.target.closest("[data-x]")) return m.remove();
      if (e.target.closest("[data-n]")) { m.remove(); Ed.setProject(null); return Ed.cloud.save(); }
      const row = e.target.closest(".pj"), b = e.target.closest("[data-a]"); if (!row || !b) return; const id = row.dataset.id, name = row.dataset.name;
      if (b.dataset.a === "open") { if (Ed.cloudDirty && Ed.project && !(await Ed.confirm("لديك تعديلات غير محفوظة في السحابة. فتح مشروع آخر سيستبدل التصميم الحالي (يبقى في الحفظ التلقائي المحلي). متابعة؟"))) return; m.remove(); await Ed.cloud.open(id, name); }
      else if (b.dataset.a === "ren") { const a = await Ed.promptDialog("إعادة تسمية", "الاسم", name); if (a && a.value.trim()) { await Ed.cloud.renameProject(id, a.value.trim()); if (Ed.project && Ed.project.id === id) Ed.setProject({ id, name: a.value.trim() }); m.remove(); projectsDialog(); } }
      else if (b.dataset.a === "del") { if (await Ed.confirm("حذف المشروع «" + esc(name) + "» بكل نسخه نهائياً؟", "حذف")) { await Ed.cloud.deleteProject(id); if (Ed.project && Ed.project.id === id) Ed.setProject(null); m.remove(); projectsDialog(); } }
      else if (b.dataset.a === "ver") { m.remove(); versionsDialog(id, name); }
    }));
  }
  async function versionsDialog(id, name) {
    const vs = await Ed.cloud.versions(id);
    const m = Ed.modal('<h3>نسخ «' + esc(name) + '»</h3><div style="display:grid;gap:.4rem">' + (vs.length ? vs.map(v => '<div style="display:flex;gap:.6rem;align-items:center;border:1px solid var(--line);border-radius:10px;padding:.35rem"><img src="' + esc(v.thumbnail || "") + '" alt="" style="width:44px;height:56px;object-fit:cover;object-position:top;background:#eee;border-radius:5px"><div style="flex:1">نسخة ' + v.version + '<div class="muted">' + when(v.created_at) + '</div></div><button data-v="' + v.version + '" class="pri">استعادة</button></div>').join("") : '<p class="muted">لا نسخ.</p>') + '</div><div class="acts"><button data-x="1">إغلاق</button></div>');
    m.addEventListener("click", e => safe(async () => { if (e.target.closest("[data-x]")) return m.remove(); const b = e.target.closest("[data-v]"); if (!b) return; m.remove(); await Ed.cloud.open(id, name, +b.dataset.v); }));
  }
  document.addEventListener("DOMContentLoaded", () => {
    $("b-cloud").onclick = () => safe(projectsDialog);
    $("b-csave").onclick = () => safe(() => Ed.cloud.save());
    $("b-cver").onclick = () => safe(async () => { if (!Ed.project) return Ed.toast("احفظ المشروع في السحابة أولاً"); if (!(await Ed.cloud.ensureKey())) return; versionsDialog(Ed.project.id, Ed.project.name); });
    const upd = () => { $("projname").textContent = Ed.project ? "☁ " + Ed.project.name + (Ed.cloudDirty ? " •" : " ✓") : "غير محفوظ في السحابة"; };
    Ed.on("cloud", upd); upd();
  });
})();
