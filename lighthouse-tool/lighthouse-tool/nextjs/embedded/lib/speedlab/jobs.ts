// الوضع المدمج: Lighthouse يعمل داخل خادم Next.js نفسه، بلا خدمة منفصلة وبلا أي API خارجي.
// يتطلب خادم Node طويل العمر (VPS أو Docker أو Railway...) مع Chrome/Chromium مثبّتاً.
// لا يصلح على Vercel Serverless لأن حالة الطابور تُفقد بين الاستدعاءات (استعمل وضع proxy هناك).
import crypto from 'node:crypto';
import {analyze} from './lh.mjs';
import {summarize} from './analyze.mjs';
import {validateTarget, UrlRejected} from './security.mjs';

export {UrlRejected};
export type Device = 'mobile' | 'desktop';
type Lang = 'ar' | 'fr' | 'en';
type Status = 'queued' | 'running' | 'done' | 'failed';

interface Job {
  id: string; url: string; devices: Device[]; locale: string;
  status: Status; createdAt: number; finishedAt: number | null;
  deviceStatus: Record<string, Status>;
  results: Record<string, {lhr?: any; error?: {code: string; message: string}}>;
}

const CONCURRENCY = Math.max(1, Number(process.env.SPEEDLAB_CONCURRENCY) || 1);
const MAX_QUEUE = Number(process.env.SPEEDLAB_MAX_QUEUE) || 20;
const CACHE_MS = (process.env.SPEEDLAB_CACHE_SECONDS === undefined ? 600 : Number(process.env.SPEEDLAB_CACHE_SECONDS)) * 1000;
const JOB_TTL_MS = 60 * 60 * 1000;
const RATE_PER_HOUR = process.env.SPEEDLAB_RATE_PER_HOUR === undefined ? 10 : Number(process.env.SPEEDLAB_RATE_PER_HOUR);
const ALLOW_PRIVATE = process.env.SPEEDLAB_ALLOW_PRIVATE === '1'; // للتجربة المحلية فقط

// حالة واحدة مشتركة تبقى حيّة مع إعادة تحميل الوحدات أثناء التطوير
const g = globalThis as unknown as {__speedlab?: {jobs: Map<string, Job>; queue: Job[]; running: number; hits: Map<string, number[]>}};
const S = (g.__speedlab ??= {jobs: new Map(), queue: [], running: 0, hits: new Map()});

function pump() {
  while (S.running < CONCURRENCY && S.queue.length) {
    const job = S.queue.shift()!;
    S.running++;
    job.status = 'running';
    analyze(job.url, {devices: job.devices, locale: job.locale, onDevice: (d: Device, s: Status) => { job.deviceStatus[d] = s; }})
      .then((r: Job['results']) => { job.results = r; })
      .catch((e: Error) => { for (const d of job.devices) { job.results[d] = {error: {code: 'ANALYSIS_FAILED', message: e.message}}; job.deviceStatus[d] = 'failed'; } })
      .finally(() => {
        S.running--;
        job.finishedAt = Date.now();
        job.status = Object.values(job.deviceStatus).every(s => s === 'failed') ? 'failed' : 'done';
        pump();
      });
  }
}

function sweep() {
  const now = Date.now();
  for (const [id, j] of S.jobs) if (j.finishedAt && now - j.finishedAt > JOB_TTL_MS) S.jobs.delete(id);
}

function rateLimited(identity: string) {
  if (!RATE_PER_HOUR) return 0;
  const now = Date.now(), win = 3_600_000;
  const arr = (S.hits.get(identity) ?? []).filter(t => now - t < win);
  if (arr.length >= RATE_PER_HOUR) { S.hits.set(identity, arr); return Math.ceil((win - (now - arr[0])) / 1000); }
  arr.push(now); S.hits.set(identity, arr);
  return 0;
}

export class ServiceError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) { super(message); }
}

/** identity: معرّف المستخدم المسجّل (الأفضل) أو IP الزائر. */
export async function startJob(input: {url: string; devices?: Device | 'both'; locale?: string; identity: string; fresh?: boolean}) {
  sweep();
  const href = await validateTarget(input.url, {allowPrivate: ALLOW_PRIVATE});
  const devices: Device[] = !input.devices || input.devices === 'both' ? ['mobile', 'desktop'] : [input.devices];
  const locale = ['ar', 'fr', 'en', 'en-US'].includes(input.locale ?? '') ? input.locale! : 'ar';
  const key = `${href}|${devices.join(',')}|${locale}`;
  if (!input.fresh) {
    const now = Date.now();
    const hit = [...S.jobs.values()].reverse().find(j => `${j.url}|${j.devices.join(',')}|${j.locale}` === key && (j.status === 'queued' || j.status === 'running' || (j.status === 'done' && now - (j.finishedAt ?? 0) < CACHE_MS)));
    if (hit) return hit;
  }
  const wait = rateLimited(input.identity);
  if (wait) throw new ServiceError(429, 'rate_limited', 'تجاوزت حد التحاليل في الساعة', wait);
  if (S.queue.length >= MAX_QUEUE) throw new ServiceError(503, 'queue_full', 'الطابور ممتلئ، أعد المحاولة بعد قليل', 30);
  const job: Job = {
    id: crypto.randomUUID(), url: href, devices, locale, status: 'queued', createdAt: Date.now(), finishedAt: null,
    deviceStatus: Object.fromEntries(devices.map(d => [d, 'queued' as Status])), results: {},
  };
  S.jobs.set(job.id, job); S.queue.push(job); pump();
  return job;
}

export const getJob = (id: string) => S.jobs.get(id);

export function jobView(job: Job, lang: Lang = 'ar') {
  const devices: Record<string, unknown> = {};
  for (const d of job.devices) {
    const r = job.results[d];
    const entry: Record<string, unknown> = {status: job.deviceStatus[d]};
    if (r?.error) entry.error = r.error;
    if (r?.lhr) Object.assign(entry, summarize(r.lhr, {lang}), {lhrUrl: `/api/speed/${job.id}/lhr/${d}`});
    devices[d] = entry;
  }
  return {
    id: job.id, url: job.url, status: job.status,
    queuePosition: job.status === 'queued' ? S.queue.indexOf(job) + 1 : undefined,
    createdAt: new Date(job.createdAt).toISOString(), devices,
  };
}
