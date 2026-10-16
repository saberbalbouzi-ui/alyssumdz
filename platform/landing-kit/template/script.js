/* سكربت انطلاق: يحمّل المحتوى من ../content/*.json (يتطلب خادماً محلياً: python3 -m http.server) */
const I18N = {
  ar: {"nav.paths":"لمن المنصة","nav.panel":"لوحة التحكم","nav.studio":"الستوديو","nav.templates":"القوالب","nav.faq":"الأسئلة","nav.login":"تسجيل الدخول","nav.start":"ابدأ مجاناً","hero.pill":"منصة التجارة وصناعة المحتوى","hero.h1a":"كل أدواتك في منصة واحدة","hero.h1b":"متجر، طلبات، شحن، ربح، وتصميم","hero.cta1":"ابدأ مجاناً","hero.cta2":"شاهد العرض","hero.c1":"عربية RTL كاملة","hero.c2":"بلا تثبيت","hero.c3":"20 أداة صور مجانية","aud.h":"اختر طريقك","how.h":"كيف تعمل؟"},
  fr: {"nav.paths":"Pour qui","nav.panel":"Tableau de bord","nav.studio":"Studio","nav.templates":"Modèles","nav.faq":"FAQ","nav.login":"Connexion","nav.start":"Commencer gratuitement","hero.pill":"Plateforme e-commerce et contenu","hero.h1a":"Tous vos outils sur une seule plateforme","hero.h1b":"Boutique, commandes, livraison, profit et design","hero.cta1":"Commencer gratuitement","hero.cta2":"Voir la démo","hero.c1":"Arabe RTL complet","hero.c2":"Sans installation","hero.c3":"20 outils photo gratuits","aud.h":"Choisissez votre voie","how.h":"Comment ça marche ?"},
  en: {"nav.paths":"Who it's for","nav.panel":"Dashboard","nav.studio":"Studio","nav.templates":"Templates","nav.faq":"FAQ","nav.login":"Log in","nav.start":"Start free","hero.pill":"E-commerce & content platform","hero.h1a":"All your tools on one platform","hero.h1b":"Store, orders, shipping, profit and design","hero.cta1":"Start free","hero.cta2":"Watch the demo","hero.c1":"Full Arabic RTL","hero.c2":"No install","hero.c3":"20 free photo tools","aud.h":"Choose your path","how.h":"How it works"}
};
function setLang(l){
  document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(e => { const v = I18N[l][e.dataset.i18n]; if (v) e.textContent = v; });
  document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === l));
}
document.querySelectorAll('.lang button').forEach(b => b.onclick = () => setLang(b.dataset.lang));

const j = u => fetch(u).then(r => r.json());
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* الشرائح الأربع */
j('../content/audiences.json').then(d => {
  const pics = {physical:['../images/products/scene-13-scene-honey.webp','../images/catalog/catalog-02-perfumes.webp'],digital:['../images/stock/it-dark.webp','../images/stock/it-code.webp'],designers:['../images/before-after/cutout-11-watch-before-after.webp','../images/store-templates/s-aurora.jpg'],creators:['../images/brand/brand-24-kit-branding.webp','../images/video/video-27-perfume-splash-motion.webp']};
  const box = document.getElementById('aud-panel');
  const show = id => { const a = d.audiences.find(x => x.id === id); box.innerHTML =
    `<div><h3>${esc(a.headline)}</h3><ul>${a.solution.map(s => `<li>${esc(s)}</li>`).join('')}</ul><a class="btn" href="#signup">ابدأ الآن</a></div>
     <div class="pics">${pics[id].map(p => `<img src="${p}" alt="" loading="lazy">`).join('')}</div>`;
    document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === id)); };
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => show(b.dataset.tab)); show('physical');
});

/* أقسام اللوحة */
j('../content/panel-modules.json').then(d => {
  const host = document.getElementById('modules');
  d.groups.slice(0, 6).forEach(g => host.append(el('div', 'card', `<h3>${esc(g.group)}</h3><p>${g.modules.slice(0, 6).map(m => esc(m.name)).join(' · ')}</p>`)));
});

/* الأدوات */
j('../content/tools.json').then(d => {
  const host = document.getElementById('tools');
  d.tools.slice(0, 12).forEach(t => host.append(el('div', 'tc',
    `${t.icon ? `<img src="../${t.icon}" alt="" width="64" height="64" loading="lazy">` : ''}<b>${esc(t.name)}</b><small>${esc(t.tagline)}</small><span class="tag">${t.type === 'free' ? 'مجانية' : 'ذكاء'}</span>`)));
});

/* القوالب + المرشّحات */
const TPL = [['s-fashion','fashion','أزياء'],['s-cosmetics','cosmetics','تجميل'],['s-honey','honey','عسل'],['s-herbs','honey','أعشاب'],['s-supplements','cosmetics','مكملات'],['s-digital','digital','رقمي'],['s-tech','tech','تقني'],['s-it','tech','معلوماتية'],['s-jewelry','jewel','مجوهرات'],['s-watches','jewel','ساعات'],['s-aurora','all','أورورا'],['s-gold','all','فخامة ذهبية']];
const tp = document.getElementById('tpls');
const drawT = f => { tp.innerHTML = ''; TPL.filter(t => f === 'all' || t[1] === f).forEach(t => tp.append(el('figure', '', `<img src="../images/store-templates/${t[0]}.jpg" alt="معاينة قالب ${t[2]}" width="768" height="516" loading="lazy"><figcaption>${t[2]}</figcaption>`))); };
document.querySelectorAll('#tpl-chips button').forEach(b => b.onclick = () => { document.querySelectorAll('#tpl-chips button').forEach(x => x.classList.toggle('on', x === b)); drawT(b.dataset.f); });
drawT('all');
