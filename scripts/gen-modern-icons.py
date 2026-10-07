#!/usr/bin/env python3
"""يولّد assets/js/modern-icons.js: مجموعة الأيقونات العصرية (SVG) + جدول تحويل الإيموجي والرموز القديمة إليها.
الأيقونات الـ52 الأساسية تُقرأ من scripts/pagebuilder.js (IC(...)) والإضافية معرّفة هنا. شغّله بعد تعديل الجدول: python3 scripts/gen-modern-icons.py"""
import re, json

src = open("scripts/pagebuilder.js", encoding="utf-8").read()
ICONS = {}
for m in re.finditer(r'IC\("([a-z0-9-]+)", "[^"]*", `([^`]*)`\)', src):
    ICONS[m.group(1)] = m.group(2).replace("${N}", ' fill="none"')

O = lambda d: f'<path d="{d}" fill="none"/>'
P = lambda d: f'<path d="{d}"/>'
C = lambda x, y, r: f'<circle cx="{x}" cy="{y}" r="{r}"/>'
EXTRA = {
    "trash": P("M5 7h14l-1 13H6z") + O("M3 7h18M9 7V4h6v3M10 11v6M14 11v6"),
    "edit": P("M4 20l1-4L16 5l3 3L8 19z") + O("M14 7l3 3"),
    "settings": C(12, 12, 3) + O("M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"),
    "save": P("M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z") + O("M8 3v5h7V3M8 21v-7h8v7"),
    "link": O("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"),
    "eye-off": O("M3 3l18 18M10.6 6.2A9 9 0 0 1 12 6c5 0 8.5 4.2 9.5 6a12 12 0 0 1-3 3.6M6.7 7.5A12 12 0 0 0 2.5 12c1 1.8 4.5 6 9.5 6 1.4 0 2.7-.3 3.8-.9"),
    "plus": O("M12 5v14M5 12h14"),
    "minus": O("M5 12h14"),
    "x": O("M6 6l12 12M18 6L6 18"),
    "arrow-up": O("M12 19V5M6 11l6-6 6 6"),
    "arrow-down": O("M12 5v14M6 13l6 6 6-6"),
    "arrow-left": O("M19 12H5M11 6l-6 6 6 6"),
    "arrow-right": O("M5 12h14M13 6l6 6-6 6"),
    "home": P("M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"),
    "warning": P("M12 3l10 18H2z") + O("M12 10v5M12 18.2v.1"),
    "hourglass": P("M6 3h12v4l-5 5 5 5v4H6v-4l5-5-5-5z"),
    "search": C(11, 11, 6.5) + O("M16 16l5 5"),
    "image": P("M3 5h18v14H3z") + C(8.5, 10, 1.8) + O("M3 17l5-5 4 4 3-3 6 6"),
    "palette": P("M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.5-2.2-.6-1.4.3-2.8 1.8-2.8H18a3 3 0 0 0 3-3C21 6.6 17 3 12 3z") + C(7.5, 11, 1) + C(10.5, 7, 1) + C(15, 7.5, 1),
    "store": P("M4 9l1.5-5h13L20 9v1a3 3 0 0 1-6 0 3 3 0 0 1-4 0 3 3 0 0 1-6 0z") + O("M5 12v8h14v-8M10 20v-5h4v5"),
    "building": P("M5 21V4h9v17") + P("M14 9h5v12") + O("M8 8h3M8 12h3M8 16h3"),
    "ticket": P("M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z") + O("M14 6v12"),
    "file": P("M6 3h8l5 5v13H6z") + O("M14 3v5h5M9 13h6M9 17h6"),
    "clipboard": P("M7 5h10v16H7z") + O("M9 5V3h6v2M10 11h4M10 15h4"),
    "smile": C(12, 12, 9.5) + O("M8 14c1 1.6 2.2 2.4 4 2.4s3-.8 4-2.4M9 9.5v.1M15 9.5v.1"),
    "ban": C(12, 12, 9) + O("M5.6 5.6l12.8 12.8"),
    "menu": O("M4 7h16M4 12h16M4 17h16"),
    "bell": P("M6 16V11a6 6 0 0 1 12 0v5l2 2H4z") + O("M10 21h4"),
    "megaphone": P("M3 10v4h4l8 4V6L7 10z") + O("M18 9a4 4 0 0 1 0 6"),
    "chart": O("M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"),
    "copy": P("M9 9h11v12H9z") + O("M5 15V3h11"),
    "download": O("M12 3v12M7 10l5 5 5-5M4 21h16"),
    "upload": O("M12 21V9M7 14l5-5 5 5M4 3h16"),
    "undo": O("M9 8h6a5 5 0 0 1 0 10H8M9 4L5 8l4 4"),
    "key": C(8, 15, 4) + O("M11 12l9-9M16 7l3 3"),
    "camera": P("M3 8h4l2-3h6l2 3h4v12H3z") + C(12, 13, 3.5),
    "video": P("M2 6h14v12H2z") + O("M16 10l6-3v10l-6-3"),
    "info": C(12, 12, 9.5) + O("M12 11v6M12 7.2v.1"),
    "question": C(12, 12, 9.5) + O("M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.1"),
    "rocket": P("M12 2c4 2 6 6 5 11l-3 3h-4l-3-3C6 8 8 4 12 2z") + C(12, 9, 1.8) + O("M8 16l-3 5 5-2M16 16l3 5-5-2"),
    "bag": P("M5 8h14l1 13H4z") + O("M9 8a3 3 0 0 1 6 0"),
    "calendar": P("M4 5h16v16H4z") + O("M4 10h16M8 3v4M16 3v4"),
    "scissors": C(6, 6, 3) + C(6, 18, 3) + O("M8.5 8l12 10M8.5 16l12-10"),
    "puzzle": P("M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4H4a2 2 0 1 1 0-4h2V6h4z"),
    "hand": O("M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7-3 0-4-1.5-5.5-4L4 13.5a1.5 1.5 0 0 1 2.5-1.5L8 14"),
    "lightbulb": O("M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"),
    "bookmark": P("M6 3h12v18l-6-4-6 4z"),
    "folder": P("M3 6h6l2 2h10v12H3z"),
    "print": P("M7 3h10v5H7z") + P("M5 8h14v8h-3v5H8v-5H5z"),
    "mic": P("M9 3h6v9a3 3 0 0 1-6 0z") + O("M5 11a7 7 0 0 0 14 0M12 18v3"),
    "wand": O("M5 19L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z"),
    "anchor": C(12, 5, 2) + O("M12 7v14M5 13a7 7 0 0 0 14 0M8 11H5l-1 2M16 11h3l1 2"),
    "type": O("M5 20L12 4l7 16M8 14h8"),
    "hash": O("M5 9h14M5 15h14M10 3L8 21M16 3l-2 18"),
    "radio": C(12, 12, 9) + C(12, 12, 3.5),
    "magnet": O("M5 14V8a7 7 0 0 1 14 0v6M5 14h4v-6M15 14h4M9 14v3M15 14v3"),
    "compass": C(12, 12, 9.5) + P("M15.5 8.5l-2 5-5 2 2-5z"),
    "book": P("M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z") + O("M5 18a2 2 0 0 1 2-2h12"),
    "dot": '<circle cx="12" cy="12" r="5" fill="currentColor"/>',
    "monitor": P("M3 4h18v12H3z") + O("M8 21h8M12 16v5"),
    "unlock": O("M7 11V8a5 5 0 0 1 9.5-2") + P("M5 11h14v10H5z"),
    "star-fill": '<path d="M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3 6.3 20.3l1.1-6.3L2.8 9.5l6.4-.9z" fill="currentColor" fill-opacity="1"/>',
    "bot": P("M5 8h14v11H5z") + O("M12 3v5M9 13v.1M15 13v.1M9 16.5h6"),
    "mobile": P("M7 2h10v20H7z") + O("M11 19h2"),
}
ICONS.update({k: v for k, v in EXTRA.items()})

M = {}
def m(names, icon):
    for ch in names.split():
        M[ch] = icon
m("✅ ☑ 🟩", "check-circle"); m("✓ ✔ ☑️", "check"); m("❌ ❎ ✕ ✖ ✘ ✗ 🔚", "x"); m("🚫 ⛔", "ban"); m("⚠ ❗ ‼", "warning"); m("❓ ❔", "question"); m("🤔", "question")
m("⏳ ⌛", "hourglass"); m("⏱ ⏰ 🕐 🕒 🕘 🕑 🕓 🕕 🕖 ⏲ 🕰", "clock"); m("★ ⭐ 🌟 ☆ 🥇 🏅 🎖", "star-fill"); m("✨ ✦ ✧ ✥ 💫 💥 🎉 🎊 🪄", "sparkle"); m("🎁", "gift"); m("🌿 🍃 🌾 🍀 🌳 🌴 🥗 🍽 🍵 ☕ 🍋 🍎 🍇 🍓 🍊 🫒 🌰 🧄 🌶 🥥 🏞 🌊 ⛰ 🐑 🐪", "leaf")
m("🌱", "sprout"); m("🌸 🌹 🌺 🌻 🌼", "flower"); m("🚚 🚛 📮", "truck"); m("📦 💼", "box"); m("🛒 🧺", "cart"); m("🛍", "bag"); m("💵 💰", "cash"); m("💳", "card"); m("🏷 🔖", "tag"); m("🎟", "ticket")
m("🔥", "flame"); m("⚡ 🔌", "zap"); m("💎", "gem"); m("👑", "crown"); m("🏆 🎓", "trophy"); m("👍 💪", "thumbs-up"); m("❤ 💚 💛 💙 💜 🖤 🤍 💖 💝 💕 🧡", "heart"); m("🎯", "target"); m("♾ ♻", "infinity")
m("💧 🧴 🧪 🧬 🍯 🧼 🧽 🧹 🪥 🛁 🌡", "drop"); m("💊 💉 🩹 🦷", "pill"); m("🩺 🫀 🫁", "heart-pulse"); m("🧠", "brain"); m("☀ 🌈", "sun"); m("🌙 ☪ 🕌 🕋 📿 🤲 🌑", "moon"); m("🔒 🔐", "lock"); m("🔓", "unlock"); m("🔑", "key")
m("👤 🧕 💆 💇 🧖 🧘 🏃 😴", "user"); m("👥 👶 🤝 👨‍👩‍👧", "users"); m("😊 🙂 😍 🥳", "smile"); m("👋 ✋ 🙏 🙌 👏 👇 👆 🤚", "hand")
m("📞 ☎ 📱 📲", "phone"); m("✉ 📧", "mail"); m("💬 🗣", "chat"); m("🤖", "bot"); m("🎧", "headset"); m("📍 🗺 📌", "pin"); m("🌐 🌍", "globe"); m("🏠 🏡", "home"); m("🏢 🏬", "building"); m("🏪", "store")
m("🗑", "trash"); m("✏ ✎ ✍ 📝", "edit"); m("⚙ 🛠 🎛", "settings"); m("💾", "save"); m("🔗 ⛓", "link"); m("👁 👀", "eye"); m("🙈", "eye-off"); m("➕", "plus"); m("➖", "minus")
m("⬆ 🔝", "arrow-up"); m("⬇ 🔻", "arrow-down"); m("⬅ ◀", "arrow-left"); m("➡ ➔ ➜ ➤ ❯ ➰ ⬀", "arrow-right"); m("🔄 🔁", "refresh"); m("🔍 🔎", "search")
m("🖼 🏞 🪟 📸", "image"); m("🎨 🖌", "palette"); m("🎬 🎞 📼", "video"); m("🎙", "mic"); m("🔊 🎵", "volume"); m("🔇", "volume-off"); m("⏸", "pause"); m("▶", "play")
m("📋 📑", "clipboard"); m("📄 📃 🧾", "file"); m("📁 🗂", "folder"); m("📤", "upload"); m("📥", "download"); m("📣 📢", "megaphone"); m("🔔", "bell"); m("📊 📈", "chart"); m("🧭", "compass"); m("🧩 🎲", "puzzle"); m("🎭", "smile")
m("🚀", "rocket"); m("📅 🗓", "calendar"); m("✂", "scissors"); m("💡", "lightbulb"); m("🔠 🔤", "type"); m("🔢", "hash"); m("⚓", "anchor"); m("🔘", "radio"); m("🧲", "magnet"); m("📚 📖 📘", "book"); m("🖨", "print"); m("🖥", "monitor"); m("☰", "menu")
m("⚪ ⚫ 🟢 🟡", "dot"); m("📐 ⚖", "layers"); m("🎂 🍰 🎈", "gift"); m("🔆 🔅", "sun")
m("🛡", "shield-check"); m("🧿", "shield-check")

out = "/* أيقونات عصرية (SVG) تحلّ محل الإيموجي والرموز القديمة في الموقع واللوحة. مولَّد بـ scripts/gen-modern-icons.py — لا تعدّله يدوياً. */\n"
out += "window.ModernIcons = (function () {\n  const ICONS = " + json.dumps(ICONS, ensure_ascii=False) + ";\n  const MAP = " + json.dumps(M, ensure_ascii=False) + ";\n"
out += r'''  const KEYS = Object.keys(MAP).sort((a, b) => b.length - a.length);
  const STRIP = /(?:[\u{1F000}-\u{1FAFF}]|[⌀-⏿]|[☀-➿]|[⬀-⯿]|❤)(?:️|[\u{1F3FB}-\u{1F3FF}])?(?:‍(?:[\u{1F000}-\u{1FAFF}]|[☀-➿])️?)*|️|[\u{1F1E6}-\u{1F1FF}]/gu;
  const RE = new RegExp(KEYS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/️/g, "")).join("|") + "|[\\uFE0F]", "gu");
  const svg = n => ICONS[n] ? '<svg class="mi-ic" viewBox="0 0 24 24" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + "</svg>" : "";
  const lookup = ch => MAP[ch] || MAP[ch.replace(/️/g, "")];
  /* نص ← HTML: الرموز المعروفة أيقونات، وغير المعروفة (إيموجي) تُحذف */
  function html(str, keepUnknown) { return String(str).replace(RE, ch => { if (ch === "️") return ""; const n = lookup(ch); return n ? svg(n) : ch; }).replace(keepUnknown ? /$^/ : STRIP, ""); }
  const has = s => { RE.lastIndex = 0; STRIP.lastIndex = 0; const r = RE.test(s) || STRIP.test(s); RE.lastIndex = 0; STRIP.lastIndex = 0; return r; };
  const SKIP = "script,style,noscript,textarea,input,select,svg,code,pre,[contenteditable],[contenteditable=true],.mi-keep,#ctlq-pop";
  /* تحويل عقد النص داخل عنصر (أو شجرة) إلى أيقونات؛ opts.skip = محدِّد إضافي للمناطق التي لا تُمسّ (محتوى الزبون) */
  function convert(root, opts) {
    opts = opts || {}; if (!root || root.nodeType !== 1 && root.nodeType !== 9) return; const skip = SKIP + (opts.skip ? "," + opts.skip : "");
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => { const p = n.parentElement; if (!p || p.closest(skip)) return NodeFilter.FILTER_REJECT; return has(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } }), L = [];
    while (w.nextNode()) L.push(w.currentNode);
    L.forEach(n => { const p = n.parentElement; if (!p) return; if (p.tagName === "OPTION" || p.tagName === "TITLE") { n.nodeValue = n.nodeValue.replace(RE, "").replace(STRIP, "").replace(/^\s+/, ""); return; } const h = html(n.nodeValue); if (!h.includes("<svg") && h === n.nodeValue) return; const t = document.createElement("template"); t.innerHTML = h; n.replaceWith(t.content); });
    (root.querySelectorAll ? root.querySelectorAll("[title],[placeholder],[aria-label],optgroup[label]") : []).forEach(e => ["title", "placeholder", "aria-label", "label"].forEach(a => { const v = e.getAttribute(a); if (v && has(v)) e.setAttribute(a, v.replace(RE, "").replace(STRIP, "").replace(/\s{2,}/g, " ").trim()); }));
  }
  /* مراقبة الصفحة: يحوّل ما يُضاف لاحقاً (رسائل، نوافذ، قوائم) */
  function watch(opts) {
    opts = opts || {}; const root = opts.root || document.body; let q = new Set(), t = 0;
    const flush = () => { const S = [...q]; q = new Set(); S.forEach(n => { if (n.isConnected) convert(n.nodeType === 3 ? n.parentElement : n, opts); }); };
    new MutationObserver(ms => { ms.forEach(m => { m.addedNodes.forEach(n => q.add(n)); if (m.type === "characterData") q.add(m.target); }); clearTimeout(t); t = setTimeout(flush, 60); }).observe(root, { childList: true, subtree: true, characterData: true });
    convert(root, opts);
  }
  const style = () => { if (document.getElementById("mi-css")) return; const s = document.createElement("style"); s.id = "mi-css"; s.textContent = ".mi-ic{width:1.15em;height:1.15em;vertical-align:-.2em;display:inline-block;flex:none;margin-inline:.08em}button>.mi-ic:only-child,.mi-ic.only{margin:0}"; document.head.appendChild(s); };
  return { ICONS, MAP, svg, html, convert, watch, style, has };
})();
'''
open("assets/js/modern-icons.js", "w", encoding="utf-8").write(out)
print("icons:", len(ICONS), "map:", len(M))
