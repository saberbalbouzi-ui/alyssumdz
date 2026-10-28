// تشغيل Lighthouse بإعدادات PageSpeed: جوال (Moto G Power، 4G بطيء، معالج x4) وحاسوب.
import lighthouse, {desktopConfig} from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo', 'agentic-browsing'];

// أخطاء معروفة: [رسالة بالعربية، هل تفيد إعادة المحاولة]
export const KNOWN_ERRORS = {
  CHROME_INTERSTITIAL_ERROR: ['منع Chrome تحميل الصفحة (شهادة SSL غير صالحة أو حظر الاتصال).', false],
  ERRORED_DOCUMENT_REQUEST: ['تعذّر طلب الصفحة. تحقق من العنوان وحالة الاستجابة.', true],
  FAILED_DOCUMENT_REQUEST: ['فشل طلب الصفحة (DNS أو انقطاع الاتصال).', true],
  DNS_FAILURE: ['تعذّر تحليل اسم النطاق.', true],
  NO_FCP: ['لم تُرسم أي عناصر على الشاشة. الصفحة فارغة أو تتأخر في العرض.', true],
  NO_LCP: ['لم يُسجَّل عنصر LCP. تأكد أن الصفحة تعرض نصاً أو صورة مرئية.', true],
  PAGE_HUNG: ['الصفحة علقت أثناء التحميل.', true],
  PROTOCOL_TIMEOUT: ['انتهت مهلة الاتصال بـ Chrome.', true],
  NOT_HTML: ['العنوان لا يعيد صفحة HTML.', false],
  INSECURE_DOCUMENT_REQUEST: ['الصفحة لا تُخدَّم عبر HTTPS.', false],
  ERRORED_DOCUMENT_REQUEST_STATUS: ['الخادم أعاد رمز حالة خطأ.', true],
};

function withTimeout(p, ms, onTimeout) {
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => { onTimeout?.(); rej(Object.assign(new Error('انتهت مهلة التحليل'), {code: 'ANALYSIS_TIMEOUT'})); }, ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

async function once(url, device, locale, port) {
  const base = {port, output: 'json', locale, logLevel: 'error', onlyCategories: CATEGORIES};
  const res = device === 'desktop'
    ? await lighthouse(url, base, desktopConfig)
    : await lighthouse(url, {...base, formFactor: 'mobile'});
  return res.lhr;
}

/** يشغّل Chrome واحداً ويحلل فيه كل الأجهزة المطلوبة. يعيد {mobile:{lhr}|{error}, desktop:...} */
export async function analyze(url, {devices = ['mobile', 'desktop'], locale = 'en-US', retries = 2, timeoutMs = 180_000, onDevice} = {}) {
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH || undefined,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const out = {};
  try {
    for (const device of devices) {
      onDevice?.(device, 'running');
      let lhr, lastErr, lastCode;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          lhr = await withTimeout(once(url, device, locale, chrome.port), timeoutMs, () => chrome.kill());
          if (!lhr.runtimeError) break;
          const [msg, retryable] = KNOWN_ERRORS[lhr.runtimeError.code] || [lhr.runtimeError.message, true];
          lastCode = lhr.runtimeError.code; lastErr = msg;
          if (!retryable) break;
        } catch (e) {
          lastCode = e.code || 'ANALYSIS_FAILED'; lastErr = e.message;
          if (e.code === 'ANALYSIS_TIMEOUT') break;
        }
      }
      out[device] = lhr && !lhr.runtimeError ? {lhr} : {error: {code: lastCode || 'ANALYSIS_FAILED', message: lastErr || 'فشل التحليل'}};
      onDevice?.(device, out[device].error ? 'failed' : 'done');
    }
  } finally {
    try { await chrome.kill(); } catch {}
  }
  return out;
}
