// يشغّل Lighthouse بإعدادات PageSpeed (جوال: Moto G Power + 4G بطيء + معالج ×4، وحاسوب) ويحفظ النتيجة مضغوطة في assets/speed/<id>.json.gz
// تستدعيه الخطوة التشغيلية speed-test.yml؛ وللتجربة المحلية: SPEED_URL=http://localhost:8765/ SPEED_ID=t SPEED_OUT=/tmp/x node scripts/speed-run.mjs
import {writeFileSync, mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import lighthouse, {desktopConfig} from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const env = process.env;
const url = String(env.SPEED_URL || '').trim();
const id = String(env.SPEED_ID || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
const devices = (env.SPEED_DEVICES || 'both') === 'both' ? ['mobile', 'desktop'] : [env.SPEED_DEVICES === 'desktop' ? 'desktop' : 'mobile'];
const locale = /^[a-z]{2}(-[A-Z]{2})?$/.test(env.SPEED_LOCALE || '') ? env.SPEED_LOCALE : 'ar';
const out = env.SPEED_OUT || 'assets/speed';
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

// أخطاء معروفة: [رسالة، هل تفيد إعادة المحاولة]
const KNOWN = {
  CHROME_INTERSTITIAL_ERROR: ['منع Chrome تحميل الصفحة (شهادة SSL غير صالحة أو حظر الاتصال).', false],
  ERRORED_DOCUMENT_REQUEST: ['تعذّر طلب الصفحة. تحقق من العنوان وحالة الاستجابة.', true],
  FAILED_DOCUMENT_REQUEST: ['فشل طلب الصفحة (DNS أو انقطاع الاتصال).', true],
  DNS_FAILURE: ['تعذّر تحليل اسم النطاق.', true],
  NO_FCP: ['لم تُرسم أي عناصر على الشاشة. الصفحة فارغة أو تتأخر في العرض.', true],
  NO_LCP: ['لم يُسجَّل أكبر عنصر مرئي (LCP). الأرجح أن العنصر الرئيسي مخفي بشفافية 0 أو يظهر بعد تأخر طويل.', true],
  PAGE_HUNG: ['الصفحة علقت أثناء التحميل.', true],
  PROTOCOL_TIMEOUT: ['انتهت مهلة الاتصال بـ Chrome.', true],
  NOT_HTML: ['العنوان لا يعيد صفحة HTML.', false],
  INSECURE_DOCUMENT_REQUEST: ['الصفحة لا تُخدَّم عبر HTTPS.', false],
  ERRORED_DOCUMENT_REQUEST_STATUS: ['الخادم أعاد رمز حالة خطأ.', true],
};

async function once(port, device) {
  const base = {port, output: 'json', locale, logLevel: 'error', onlyCategories: CATEGORIES};
  const res = device === 'desktop' ? await lighthouse(url, base, desktopConfig) : await lighthouse(url, {...base, formFactor: 'mobile'});
  return res.lhr;
}

// تقليص الحجم: لقطة الصفحة الكاملة وإحداثيات العقد الكبيرة لا يحتاجها الملخص (التقرير الكامل يعمل بدونها)
function slim(lhr) {
  delete lhr.fullPageScreenshot;
  if (lhr.audits['full-page-screenshot']) delete lhr.audits['full-page-screenshot'];
  return lhr;
}

async function main() {
  if (!/^https?:\/\//i.test(url) || !id) { console.error('SPEED_URL/SPEED_ID غير صالحين'); process.exit(2); }
  const chrome = await chromeLauncher.launch({chromePath: env.CHROME_PATH || undefined, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']});
  const result = {v: 1, url, at: new Date().toISOString(), locale, devices: {}};
  try {
    for (const device of devices) {
      let lhr, code, msg;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          lhr = await once(chrome.port, device);
          if (!lhr.runtimeError) break;
          const [m, retry] = KNOWN[lhr.runtimeError.code] || [lhr.runtimeError.message, true];
          code = lhr.runtimeError.code; msg = m; if (!retry) break; lhr = null;
        } catch (e) { code = e.code || 'ANALYSIS_FAILED'; msg = e.message; lhr = null; }
      }
      result.devices[device] = lhr ? {lhr: slim(lhr)} : {error: {code: code || 'ANALYSIS_FAILED', message: msg || 'فشل التحليل'}};
      console.log(device, lhr ? 'ok' : 'failed ' + code);
    }
  } finally { try { await chrome.kill(); } catch {} }
  mkdirSync(out, {recursive: true});
  const gz = gzipSync(Buffer.from(JSON.stringify(result)));
  writeFileSync(`${out}/${id}.json.gz`, gz);
  console.log('saved', `${out}/${id}.json.gz`, gz.length, 'bytes');
}
main().catch(e => { console.error(e); process.exit(1); });
