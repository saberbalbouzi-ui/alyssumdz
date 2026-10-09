/* توليد shop.html (المتجر/التصنيفات/الفئات) و account.html (حسابي) من الرئيسية المحفوظة نفسها — نسخة المتصفح من scripts/build-shop-pages.py.
   تُستدعى من PBConvert بعد نشر الرئيسية فتتبع صفحتا المتجر وحسابي هيوية القالب المثبَّت (هيدر/فوتر/سلة + `#pb-tpl-css` التي تحمل أنماط صفحة الفئات الخاصة بالقالب). لا ارتباط بأليسوم: لفافتها الخاصة (ALYSHOP) لا تُضاف إلا إن كانت الرئيسية بشبكة أليسوم (aly-grid). */
const ShopPages = (() => {
  const ALYSHOP = "<style id=\"aly-shop-css\">\n.shop-page .sec-title{position:relative;margin:0 auto 22px;padding:44px 22px 36px;border-radius:26px;overflow:hidden;border:1px solid rgba(134,239,172,.28);background:linear-gradient(0deg,rgba(3,16,9,.9),rgba(3,16,9,.5)),var(--shop-hero,linear-gradient(145deg,rgba(12,54,29,.88),rgba(3,16,9,.94))) center/cover no-repeat;box-shadow:0 22px 60px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.14)}\n.shop-page .sec-title h1{color:#ecfdf5;text-shadow:0 2px 22px rgba(0,0,0,.55)}.shop-page .sec-title p{color:#c5dccd}.shop-page .sec-title .kicker{color:#bef264}\n#shop-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:24px}\n#shop-chips .chip{background:rgba(255,255,255,.07)!important;border:1px solid rgba(134,239,172,.3)!important;color:#d1fae5!important;border-radius:999px;padding:.5rem 1.2rem;font-weight:800;backdrop-filter:blur(10px);transition:transform .2s,border-color .2s}\n#shop-chips .chip:hover{transform:translateY(-2px);border-color:#86efac!important}\n#shop-chips .chip.active{background:rgba(74,222,128,.22)!important;border-color:#bef264!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}\n.shop-page .grid .card .cta{background:rgba(74,222,128,.2)!important;border:1px solid rgba(134,239,172,.4);color:#ecfdf5!important;border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -6px 12px rgba(0,0,0,.18);backdrop-filter:blur(8px)}\n.shop-page .grid .card:hover .cta{background:rgba(74,222,128,.34)!important;transform:translateY(-2px)}\n#acct-box{background:linear-gradient(145deg,rgba(12,54,29,.88),rgba(3,16,9,.94))!important;border:1px solid rgba(134,239,172,.28)!important;color:#ecfdf5;backdrop-filter:blur(14px)}\n</style>", SHOP = "<section class=\"shop-page\"><div class=\"container\">\n  <div class=\"sec-title\"><span class=\"kicker\">تسوّق بسهولة</span><h1 id=\"shop-title\" style=\"font-size:clamp(1.6rem,4vw,2.4rem);margin:.2rem 0\">المتجر</h1><p id=\"shop-sub\"></p></div>\n  <div class=\"chips\" id=\"shop-chips\"></div>\n  <div class=\"grid%GRID%\" id=\"shop-grid\"></div>\n</div></section>\n", ACCT = "<section class=\"shop-page\"><div class=\"container\" style=\"max-width:560px;text-align:center\">\n  <div class=\"sec-title\"><span class=\"kicker\">حسابي</span><h1 style=\"font-size:clamp(1.6rem,4vw,2.2rem);margin:.2rem 0\">👤 حسابي</h1></div>\n  <div id=\"acct-box\" style=\"background:#fff;border:1px solid var(--line);border-radius:20px;padding:1.6rem\"></div>\n</div></section>\n", INIT = "<script>document.addEventListener(\"DOMContentLoaded\",()=>{bootStore().then(()=>{%s;initCartDrawer();fillCartWilayas();initReveal();});});</script></body></html>";
  function build(t) {
    const i0 = t.indexOf('<link rel="icon"'), b0 = t.indexOf("<body>"), b1 = t.indexOf("<main"), f0 = t.indexOf("</main>"), l0 = t.lastIndexOf("<script>document.addEventListener");
    if (i0 < 0 || b0 < 0 || b1 < 0 || f0 < 0 || l0 < 0) return null;
    const head = t.slice(0, i0).replace(/<link rel="preload"[^>]*>/g, ""), icon = (t.match(/<link rel="icon"[^>]*>/) || [""])[0];
    const nm = t.match(/<title>([\s\S]*?)<\/title>/), site = nm ? nm[1].split("|")[0].split("—")[0].trim() : "المتجر";
    const tp = t.match(/<style id="pb-tpl-css">[\s\S]*?<\/style>/); let tplcss = tp ? tp[0] : ""; const ALY = t.indexOf("aly-grid") >= 0;
    if (ALY) tplcss += ALYSHOP;
    const top = t.slice(b0 + 6, b1).trim() + '<main id="main">', tail = t.slice(f0 + 7, l0);
    const page = (title, desc, body, init, noindex) => head + icon + "\n<title>" + title + " | " + site + '</title><meta name="description" content="' + desc + '">' + (noindex ? '<meta name="robots" content="noindex">' : "") + "\n" + tplcss + "</head><body>\n" + top + "\n" + body.replace("%GRID%", ALY ? " aly-grid" : "") + "</main>" + tail + INIT.replace("%s", init);
    return { shop: page("المتجر", "تصفّح كل المنتجات والتصنيفات والعروض — الدفع عند الاستلام", SHOP, "initShop()", false), account: page("حسابي", "سجّل الدخول أو أنشئ حساباً جديداً لتتبّع طلباتك", ACCT, "initAccountPage()", true) };
  }
  /* بعد نشر الرئيسية: يكتب الصفحتين (يتجاهل الفشل بصمت كي لا يعطّل النشر) */
  async function sync(homeHtml) {
    const out = build(homeHtml); if (!out) return false;
    for (const [pth, html, msg] of [["shop.html", out.shop, "صفحة المتجر والفئات"], ["account.html", out.account, "صفحة حسابي"]]) {
      let cur; try { cur = await GH.getFile(pth); } catch (e) { }
      await GH.putFile(pth, btoa(unescape(encodeURIComponent(html))), cur && cur.sha, "تحديث " + msg + " بهوية الرئيسية");
    }
    return true;
  }
  return { build, sync };
})();
