/* SABER DIGITAL PRO — interactions (no libraries). Progressive enhancement: the page is fully readable without JS. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* sticky header state */
  var hdr = $("#hdr");
  function onScroll() { if (hdr) hdr.classList.toggle("stuck", window.scrollY > 12); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* mobile menu */
  var btn = $(".menu-btn"), panel = $("#panel");
  function setMenu(open) {
    if (!btn || !panel) return;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? btn.dataset.close : btn.dataset.open);
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    panel.inert = !open;
    root.style.overflow = open ? "hidden" : "";
    if (open) {
      var first = $("a", panel);
      if (first) setTimeout(function () { first.focus(); }, 60);
    } else if (doc.activeElement && panel.contains(doc.activeElement)) {
      btn.focus();
    }
  }
  if (btn && panel) {
    panel.inert = true;
    btn.addEventListener("click", function () { setMenu(btn.getAttribute("aria-expanded") !== "true"); });
    $$("a", panel).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    doc.addEventListener("keydown", function (e) {
      if (String(e.key || "") === "Escape" && btn.getAttribute("aria-expanded") === "true") setMenu(false);
    });
    window.matchMedia("(min-width:1081px)").addEventListener("change", function (m) { if (m.matches) setMenu(false); });
  }

  /* reveal on scroll */
  var rv = $$(".rv");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    rv.forEach(function (n) { io.observe(n); });
  } else {
    rv.forEach(function (n) { n.classList.add("in"); });
  }

  /* scroll-spy + current section (used by the language switcher to preserve position) */
  var current = "";
  var spyLinks = $$("[data-spy]");
  var secEls = ["services", "work", "approach", "why", "industries", "faq", "contact"].map(function (i) { return doc.getElementById(i); }).filter(Boolean);
  function spy() {
    var y = window.scrollY + window.innerHeight * 0.32, cur = "";
    secEls.forEach(function (s) { if (s.getBoundingClientRect().top + window.scrollY <= y) cur = s.id; });
    if (window.scrollY < 200) cur = "";
    current = cur;
    spyLinks.forEach(function (a) { a.classList.toggle("on", a.dataset.spy === cur); });
  }
  spy();
  window.addEventListener("scroll", spy, { passive: true });
  window.addEventListener("resize", spy);

  /* arriving with a #section (e.g. from the language switcher): jump there once layout and fonts settle */
  function jumpHash() {
    if (!location.hash || location.hash.length < 2) return;
    var t = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t) t.scrollIntoView({ behavior: "instant", block: "start" });
  }
  if (location.hash) {
    jumpHash();
    window.addEventListener("load", jumpHash);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(jumpHash);
  }

  /* language switcher: keep the section the visitor is reading */
  $$("[data-lang-link]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (a.getAttribute("aria-current") === "true") { e.preventDefault(); return; }
      var h = current || (location.hash && location.hash.length > 1 ? location.hash.slice(1) : "");
      if (h) { e.preventDefault(); location.href = a.getAttribute("href").replace(/#.*$/, "") + "#" + h; }
    });
  });

  /* pointer glow on cards */
  $$(".svc-card").forEach(function (c) {
    c.addEventListener("pointermove", function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
    });
  });

  /* service CTA pre-selects the service in the form */
  $$("[data-service]").forEach(function (a) {
    a.addEventListener("click", function () {
      var s = $("#f-service");
      if (!s) return;
      for (var i = 0; i < s.options.length; i++) if (s.options[i].value === a.dataset.service) { s.selectedIndex = i; break; }
    });
  });

  /* contact form */
  var form = $("#contact-form"), cfgEl = $("#form-cfg");
  if (form && cfgEl) {
    var cfg = JSON.parse(cfgEl.textContent), ok = $("#form-ok"), sum = $("#form-summary"), pre = $("#ok-msg"), live = $("#ok-live");
    var emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, hostRx = /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
    var names = ["name", "email", "company", "website", "service", "message"];
    var val = function (n) { var el = form.elements[n]; return el ? String(el.value || "").trim() : ""; };
    var normSite = function (v) {
      if (!v) return "";
      var u = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : "https://" + v;
      try { var x = new URL(u); return /^https?:$/.test(x.protocol) && hostRx.test(x.hostname) ? x.href : null; } catch (e) { return null; }
    };
    var check = function (n) {
      var v = val(n), bad;
      if (n === "email") bad = !emailRx.test(v);
      else if (n === "website") bad = v !== "" && normSite(v) === null;
      else bad = v === "";
      var el = form.elements[n], er = $("#err-" + n);
      if (el) el.setAttribute("aria-invalid", bad ? "true" : "false");
      if (er) {
        er.classList.toggle("show", bad);
        if (n === "email") er.textContent = v === "" ? cfg.errors.required : cfg.errors.email;
      }
      return !bad;
    };
    names.forEach(function (n) {
      var el = form.elements[n];
      if (!el) return;
      el.addEventListener("blur", function () { if (el.dataset.touched || val(n) !== "") { el.dataset.touched = "1"; check(n); } });
      var again = function () { if (el.getAttribute("aria-invalid") === "true") check(n); };
      el.addEventListener("input", again);
      el.addEventListener("change", again);
    });
    var message = function () {
      var L = cfg.labels, lines = [cfg.intro, ""];
      names.forEach(function (k) {
        var v = k === "website" ? (normSite(val(k)) || "") : val(k);
        if (v) lines.push(L[k] + ": " + v);
      });
      return lines.join("\n");
    };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = names.filter(function (n) { form.elements[n].dataset.touched = "1"; return !check(n); });
      sum.classList.toggle("show", bad.length > 0);
      if (bad.length) { form.elements[bad[0]].focus(); return; }
      var msg = message();
      pre.textContent = msg;
      $("#ok-wa").href = "https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(msg);
      $("#ok-mail").href = "mailto:" + cfg.email + "?subject=" + encodeURIComponent(cfg.subject + " — " + val("company")) + "&body=" + encodeURIComponent(msg);
      form.style.display = "none";
      ok.classList.add("show");
      live.textContent = "";
      ok.focus();
    });
    $("#ok-edit").addEventListener("click", function () {
      ok.classList.remove("show");
      form.style.display = "";
      form.elements.name.focus();
    });
    $("#ok-copy").addEventListener("click", function () {
      var t = pre.textContent;
      var done = function () { live.textContent = cfg.copied; };
      var fallback = function () {
        var ta = doc.createElement("textarea");
        ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0";
        doc.body.appendChild(ta); ta.select();
        try { doc.execCommand("copy"); done(); } catch (er) { /* leave the visible message selectable */ }
        ta.remove();
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
    });
  }
})();
