// خدمة Lighthouse مستقلة: POST /v1/analyze ثم GET /v1/analyze/:id
import http from 'node:http';
import crypto from 'node:crypto';
import {analyze} from './lh.mjs';
import {summarize} from './analyze.mjs';
import {validateTarget, UrlRejected} from './security.mjs';

const env = process.env;
const cfg = {
  port: Number(env.PORT) || 3000,
  apiKeys: (env.API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean),
  disableAuth: env.DISABLE_AUTH === '1',
  concurrency: Math.max(1, Number(env.CONCURRENCY) || 2),
  maxQueue: Number(env.MAX_QUEUE) || 50,
  cacheMs: (env.CACHE_TTL_SECONDS === undefined ? 600 : Number(env.CACHE_TTL_SECONDS)) * 1000,
  jobTtlMs: (Number(env.JOB_TTL_SECONDS) || 3600) * 1000,
  maxJobs: Number(env.MAX_JOBS) || 100,
  ratePerHour: env.RATE_LIMIT_PER_HOUR === undefined ? 20 : Number(env.RATE_LIMIT_PER_HOUR),
  origins: (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  allowPrivate: env.ALLOW_PRIVATE_HOSTS === '1',
  allowedPorts: (env.ALLOWED_PORTS || '80,443').split(',').map(s => s.trim()),
  trustProxy: env.TRUST_PROXY === '1',
  timeoutMs: (Number(env.ANALYSIS_TIMEOUT_SECONDS) || 180) * 1000,
};
if (!cfg.apiKeys.length && !cfg.disableAuth) {
  console.error('يجب ضبط API_KEYS (مفتاح أو أكثر مفصولة بفاصلة)، أو DISABLE_AUTH=1 للتجربة المحلية فقط.');
  process.exit(1);
}

const log = (event, data = {}) => console.log(JSON.stringify({t: new Date().toISOString(), event, ...data}));

/* ---------- المهام والطابور ---------- */
const jobs = new Map();      // id -> job
const queue = [];            // jobs بانتظار التنفيذ
let running = 0;

function newJob({url, devices, locale, lang}) {
  const job = {
    id: crypto.randomUUID(), url, devices, locale, lang,
    status: 'queued', createdAt: Date.now(), startedAt: null, finishedAt: null,
    results: {}, deviceStatus: Object.fromEntries(devices.map(d => [d, 'queued'])), waiters: [], summaries: {},
  };
  jobs.set(job.id, job);
  return job;
}
const cacheKey = j => `${j.url}|${[...j.devices].sort().join(',')}|${j.locale}`;

function finish(job) {
  job.finishedAt = Date.now();
  const states = Object.values(job.deviceStatus);
  job.status = states.every(s => s === 'failed') ? 'failed' : 'done';
  for (const w of job.waiters.splice(0)) w();
}

async function runJob(job) {
  running++;
  job.status = 'running'; job.startedAt = Date.now();
  log('job_start', {id: job.id, url: job.url, devices: job.devices});
  try {
    job.results = await analyze(job.url, {
      devices: job.devices, locale: job.locale, timeoutMs: cfg.timeoutMs,
      onDevice: (d, s) => { job.deviceStatus[d] = s; },
    });
  } catch (e) {
    for (const d of job.devices) { job.results[d] = {error: {code: 'ANALYSIS_FAILED', message: e.message}}; job.deviceStatus[d] = 'failed'; }
  }
  running--;
  finish(job);
  log('job_end', {id: job.id, status: job.status, ms: job.finishedAt - job.startedAt});
  pump();
}
function pump() {
  while (running < cfg.concurrency && queue.length) runJob(queue.shift());
}
function waitFor(job, seconds) {
  if (job.status === 'done' || job.status === 'failed' || !seconds) return Promise.resolve();
  return new Promise(res => {
    const t = setTimeout(() => { const i = job.waiters.indexOf(done); if (i >= 0) job.waiters.splice(i, 1); res(); }, Math.min(seconds, 120) * 1000);
    const done = () => { clearTimeout(t); res(); };
    job.waiters.push(done);
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [id, j] of jobs) if (j.finishedAt && now - j.finishedAt > cfg.jobTtlMs) jobs.delete(id);
  if (jobs.size > cfg.maxJobs) {
    const done = [...jobs.values()].filter(j => j.finishedAt).sort((a, b) => a.finishedAt - b.finishedAt);
    for (const j of done.slice(0, jobs.size - cfg.maxJobs)) jobs.delete(j.id);
  }
}, 60_000).unref();

/* ---------- تحديد المعدّل ---------- */
const hits = new Map();
function rateLimited(identity) {
  if (!cfg.ratePerHour) return 0;
  const now = Date.now(), win = 3600_000;
  const arr = (hits.get(identity) || []).filter(t => now - t < win);
  if (arr.length >= cfg.ratePerHour) { hits.set(identity, arr); return Math.ceil((win - (now - arr[0])) / 1000); }
  arr.push(now); hits.set(identity, arr);
  return 0;
}

/* ---------- أدوات HTTP ---------- */
const sha = s => crypto.createHash('sha256').update(s).digest();
function authenticate(req) {
  if (cfg.disableAuth) return 'anonymous';
  const key = req.headers['x-api-key'] || (/^Bearer (.+)$/i.exec(req.headers.authorization || '') || [])[1];
  if (!key) return null;
  const k = sha(String(key));
  let ok = false;
  for (const valid of cfg.apiKeys) if (crypto.timingSafeEqual(k, sha(valid))) ok = true;
  return ok ? sha(String(key)).toString('hex').slice(0, 12) : null;
}
function clientIp(req) {
  if (cfg.trustProxy && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress;
}
function cors(req, res) {
  const o = req.headers.origin;
  if (o && (cfg.origins.includes('*') || cfg.origins.includes(o))) {
    res.setHeader('access-control-allow-origin', cfg.origins.includes('*') ? '*' : o);
    res.setHeader('vary', 'origin');
    res.setHeader('access-control-allow-headers', 'content-type, x-api-key, authorization');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-max-age', '600');
  }
}
function send(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers});
  res.end(data);
}
const fail = (res, status, code, message, extra = {}) => send(res, status, {error: {code, message}}, extra);
function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too_large'), {code: 'body_too_large'})); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(Object.assign(new Error('bad json'), {code: 'invalid_json'})); } });
    req.on('error', reject);
  });
}

function parseDevices(v) {
  if (!v || v === 'both') return ['mobile', 'desktop'];
  const arr = (Array.isArray(v) ? v : [v]).map(String);
  if (!arr.length || arr.some(d => !['mobile', 'desktop'].includes(d))) return null;
  return [...new Set(arr)];
}
const LOCALES = new Set(['ar', 'fr', 'en', 'en-US', 'es', 'de', 'tr']);

/* ---------- عرض المهمة ---------- */
function view(job, {lang, compact}) {
  const base = {id: job.id, url: job.url, status: job.status, createdAt: new Date(job.createdAt).toISOString(), finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null};
  if (job.status === 'queued') base.queuePosition = queue.indexOf(job) + 1;
  base.devices = {};
  for (const d of job.devices) {
    const r = job.results[d];
    const entry = {status: job.deviceStatus[d]};
    if (r && r.error) entry.error = r.error;
    if (r && r.lhr) {
      const key = d + '|' + lang;
      const s = job.summaries[key] || (job.summaries[key] = summarize(r.lhr, {lang}));
      Object.assign(entry, {scores: s.scores, categories: s.categories, metrics: s.metrics, meta: s.meta,
        issues: compact ? s.issues.map(({description, items, ...rest}) => rest) : s.issues,
        lhrUrl: `/v1/analyze/${job.id}/lhr/${d}`});
    }
    base.devices[d] = entry;
  }
  return base;
}

/* ---------- الخادم ---------- */
const server = http.createServer(async (req, res) => {
  cors(req, res);
  const u = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (u.pathname === '/health') return send(res, 200, {ok: true, running, queued: queue.length, jobs: jobs.size});

    const identity = authenticate(req);
    if (!identity) return fail(res, 401, 'unauthorized', 'مفتاح API مفقود أو غير صحيح', {'www-authenticate': 'Bearer'});

    const lang = ['ar', 'fr', 'en'].includes(u.searchParams.get('lang')) ? u.searchParams.get('lang') : 'ar';
    const compact = u.searchParams.get('compact') === '1';
    const wait = Number(u.searchParams.get('wait')) || 0;

    if (req.method === 'POST' && u.pathname === '/v1/analyze') {
      let body;
      try { body = await readJson(req); } catch (e) { return fail(res, e.code === 'body_too_large' ? 413 : 400, e.code || 'bad_request', 'طلب غير صالح'); }
      const devices = parseDevices(body.devices ?? body.device);
      if (!devices) return fail(res, 400, 'invalid_devices', 'devices يجب أن تكون mobile أو desktop أو both');
      const locale = LOCALES.has(body.locale) ? body.locale : (body.lang && LOCALES.has(body.lang) ? body.lang : 'en-US');
      const reqLang = ['ar', 'fr', 'en'].includes(body.lang) ? body.lang : lang;
      let href;
      try { href = await validateTarget(body.url, {allowPrivate: cfg.allowPrivate, allowedPorts: cfg.allowedPorts}); }
      catch (e) { if (e instanceof UrlRejected) return fail(res, 422, e.code, e.message); throw e; }

      const probe = {url: href, devices, locale};
      // تخزين مؤقت وإعادة استخدام مهمة قائمة لنفس العنوان
      if (!body.fresh) {
        const k = cacheKey(probe), now = Date.now();
        const hit = [...jobs.values()].reverse().find(j => cacheKey(j) === k && (j.status === 'queued' || j.status === 'running' || (j.status === 'done' && now - j.finishedAt < cfg.cacheMs)));
        if (hit) { await waitFor(hit, wait); return send(res, hit.status === 'done' ? 200 : 202, {...view(hit, {lang: reqLang, compact}), cached: true}, {location: `/v1/analyze/${hit.id}`}); }
      }
      const wait429 = rateLimited(identity === 'anonymous' ? clientIp(req) : identity);
      if (wait429) return fail(res, 429, 'rate_limited', 'تجاوزت حد الطلبات في الساعة', {'retry-after': String(wait429)});
      if (queue.length >= cfg.maxQueue) return fail(res, 503, 'queue_full', 'الطابور ممتلئ، أعد المحاولة بعد قليل', {'retry-after': '30'});
      const job = newJob({...probe, lang: reqLang});
      queue.push(job); pump();
      await waitFor(job, wait);
      return send(res, job.status === 'done' || job.status === 'failed' ? 200 : 202, view(job, {lang: reqLang, compact}), {location: `/v1/analyze/${job.id}`});
    }

    let m = req.method === 'GET' && u.pathname.match(/^\/v1\/analyze\/([0-9a-f-]{36})$/);
    if (m) {
      const job = jobs.get(m[1]);
      if (!job) return fail(res, 404, 'not_found', 'المهمة غير موجودة أو انتهت صلاحيتها');
      await waitFor(job, wait);
      return send(res, 200, view(job, {lang, compact}));
    }
    m = req.method === 'GET' && u.pathname.match(/^\/v1\/analyze\/([0-9a-f-]{36})\/lhr\/(mobile|desktop)$/);
    if (m) {
      const job = jobs.get(m[1]);
      const r = job && job.results[m[2]];
      if (!job) return fail(res, 404, 'not_found', 'المهمة غير موجودة أو انتهت صلاحيتها');
      if (!r || !r.lhr) return fail(res, 409, 'not_ready', r && r.error ? r.error.message : 'التقرير غير جاهز بعد');
      return send(res, 200, r.lhr);
    }
    return fail(res, 404, 'not_found', 'المسار غير موجود');
  } catch (e) {
    log('error', {message: e.message});
    if (!res.headersSent) fail(res, 500, 'internal_error', 'خطأ داخلي');
  }
});
server.requestTimeout = 150_000;
server.listen(cfg.port, () => log('listening', {port: cfg.port, concurrency: cfg.concurrency, auth: !cfg.disableAuth, allowPrivate: cfg.allowPrivate}));

let closing = false;
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  if (closing) return; closing = true;
  log('shutdown');
  server.close();
  const t = setInterval(() => { if (!running && !queue.length) process.exit(0); }, 500);
  setTimeout(() => process.exit(0), 60_000).unref(); t.unref?.();
});
