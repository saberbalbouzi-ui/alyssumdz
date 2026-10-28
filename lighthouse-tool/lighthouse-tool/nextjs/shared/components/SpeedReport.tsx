'use client';
// مكوّن تحليل سرعة الموقع: يرسل الرابط، يتابع التقدم، ثم يعرض الدرجات والمقاييس ومعالج الأخطاء.
// يفترض Tailwind ووجود dir="rtl" على الصفحة. يستعمل خصائص منطقية (ms-/ps-/text-start) فيعمل مع LTR أيضاً.
import {useCallback, useEffect, useRef, useState} from 'react';
import LighthouseFullReport from './LighthouseFullReport';

type Lang = 'ar' | 'fr' | 'en';
type DeviceName = 'mobile' | 'desktop';
type Issue = {
  id: string; title: string; description: string; displayValue: string | null;
  pointsGain: number; approximate: boolean; diagnostic: boolean;
  categories: Record<string, number>; fix: string | null; itemCount: number; items: string[];
};
type Metric = {id: string; acronym: string; title: string; value: string | null; score: number | null; pointsLost: number};
type DeviceResult = {
  status: 'queued' | 'running' | 'done' | 'failed';
  error?: {code: string; message: string};
  scores?: Record<string, number | null>;
  metrics?: Metric[];
  issues?: Issue[];
};
type Job = {id: string; url: string; status: 'queued' | 'running' | 'done' | 'failed'; queuePosition?: number; devices: Record<string, DeviceResult>};

const CATS = ['performance', 'accessibility', 'best-practices', 'seo', 'agentic-browsing'] as const;
const T: Record<Lang, Record<string, string>> = {
  ar: {title: 'تحليل سرعة موقعك', placeholder: 'https://example.com', analyze: 'حلّل الآن', busy: 'جارٍ التحليل…', queued: 'في الطابور', running: 'يعمل الفحص', mobile: 'جوال', desktop: 'حاسوب',
    performance: 'الأداء', accessibility: 'إمكانية الوصول', 'best-practices': 'أفضل الممارسات', seo: 'SEO', 'agentic-browsing': 'التنقل الوكيلي',
    fixTitle: 'ما الذي يمنع الوصول إلى 100؟', pts: 'نقطة', diag: 'تشخيص', how: 'طريقة الإصلاح', affected: 'العناصر المتأثرة', metrics: 'مقاييس الأداء',
    allGood: 'ممتاز، لا توجد بنود راسبة.', json: 'تحميل JSON', full: 'عرض التقرير الكامل', hideFull: 'إخفاء التقرير الكامل', fail: 'تعذّر إكمال الفحص', timeout: 'استغرق الفحص وقتاً أطول من المتوقع. حاول مجدداً.'},
  fr: {title: 'Analyse de vitesse', placeholder: 'https://example.com', analyze: 'Analyser', busy: 'Analyse en cours…', queued: 'En file d’attente', running: 'Analyse en cours', mobile: 'Mobile', desktop: 'Ordinateur',
    performance: 'Performances', accessibility: 'Accessibilité', 'best-practices': 'Bonnes pratiques', seo: 'SEO', 'agentic-browsing': 'Navigation agentique',
    fixTitle: 'Qu’est-ce qui empêche d’atteindre 100 ?', pts: 'pts', diag: 'Diagnostic', how: 'Comment corriger', affected: 'Éléments concernés', metrics: 'Métriques de performance',
    allGood: 'Parfait, aucun point en échec.', json: 'Télécharger JSON', full: 'Voir le rapport complet', hideFull: 'Masquer le rapport complet', fail: 'Analyse impossible', timeout: 'L’analyse a pris trop de temps. Réessayez.'},
  en: {title: 'Site speed analysis', placeholder: 'https://example.com', analyze: 'Analyze', busy: 'Analyzing…', queued: 'Queued', running: 'Running', mobile: 'Mobile', desktop: 'Desktop',
    performance: 'Performance', accessibility: 'Accessibility', 'best-practices': 'Best Practices', seo: 'SEO', 'agentic-browsing': 'Agentic Browsing',
    fixTitle: 'What stands between you and 100?', pts: 'pts', diag: 'Diagnostic', how: 'How to fix', affected: 'Affected elements', metrics: 'Performance metrics',
    allGood: 'Perfect, no failing items.', json: 'Download JSON', full: 'Show full report', hideFull: 'Hide full report', fail: 'Analysis failed', timeout: 'The analysis took too long. Try again.'},
};

const tone = (s: number | null | undefined) => (s == null ? 'text-neutral-400' : s >= 90 ? 'text-emerald-600' : s >= 50 ? 'text-orange-500' : 'text-red-600');
const stroke = (s: number | null | undefined) => (s == null ? '#a3a3a3' : s >= 90 ? '#0c6' : s >= 50 ? '#fa3' : '#f33');

function Ring({score, label}: {score: number | null | undefined; label: string}) {
  const r = 34, c = 2 * Math.PI * r, v = score ?? 0;
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <svg viewBox="0 0 80 80" className="h-24 w-24" role="img" aria-label={`${label}: ${score ?? '—'}`}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="6" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={stroke(score)} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 40 40)" />
        <text x="40" y="47" textAnchor="middle" className={`fill-current text-[22px] font-semibold ${tone(score)}`}>{score ?? '—'}</text>
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export default function SpeedReport({lang = 'ar', initialUrl = ''}: {lang?: Lang; initialUrl?: string}) {
  const t = T[lang];
  const [url, setUrl] = useState(initialUrl);
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<DeviceName>('mobile');
  const [showFull, setShowFull] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }, []);

  const poll = useCallback(async (id: string, startedAt: number) => {
    try {
      const r = await fetch(`/api/speed/${id}?lang=${lang}`, {cache: 'no-store'});
      const data = await r.json();
      if (!alive.current) return;
      if (!r.ok) throw new Error(data?.error?.message || t.fail);
      setJob(data);
      if (data.status === 'done' || data.status === 'failed') { setBusy(false); if (data.status === 'failed') setErr(Object.values<DeviceResult>(data.devices).find(d => d.error)?.error?.message || t.fail); return; }
      if (Date.now() - startedAt > 5 * 60_000) { setBusy(false); setErr(t.timeout); return; }
      timer.current = setTimeout(() => poll(id, startedAt), 2500);
    } catch (e) {
      if (!alive.current) return;
      setBusy(false); setErr(e instanceof Error ? e.message : t.fail);
    }
  }, [lang, t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setJob(null); setShowFull(false); setBusy(true);
    try {
      const r = await fetch('/api/speed', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({url, lang})});
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message || t.fail);
      setJob(data);
      if (data.status === 'done' || data.status === 'failed') { setBusy(false); return; }
      poll(data.id, Date.now());
    } catch (e) {
      setBusy(false); setErr(e instanceof Error ? e.message : t.fail);
    }
  }

  const current = job?.devices?.[device];
  const devices = job ? (Object.keys(job.devices) as DeviceName[]) : [];

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h2 className="text-xl font-semibold">{t.title}</h2>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <input value={url} onChange={e => setUrl(e.target.value)} type="url" required dir="ltr" placeholder={t.placeholder}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700" />
        <button disabled={busy} className="rounded-lg bg-blue-600 px-5 py-2 text-white disabled:opacity-60">{busy ? t.busy : t.analyze}</button>
      </form>

      {err && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{err}</p>}

      {job && (job.status === 'queued' || job.status === 'running') && (
        <p className="text-sm text-neutral-500">
          {job.status === 'queued' ? `${t.queued}${job.queuePosition ? ` (#${job.queuePosition})` : ''}` : t.running}
          {' · '}{devices.map(d => `${t[d]}: ${t[job.devices[d].status] ?? job.devices[d].status}`).join(' · ')}
        </p>
      )}

      {job && job.status !== 'queued' && job.status !== 'running' && (
        <>
          <div className="inline-flex self-start overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700" role="group">
            {devices.map(d => (
              <button key={d} type="button" aria-pressed={device === d} onClick={() => { setDevice(d); setShowFull(false); }}
                className={`px-4 py-1.5 text-sm ${device === d ? 'bg-blue-600 text-white' : ''}`}>{t[d]}</button>
            ))}
          </div>

          {current?.error && <p role="alert" className="text-sm text-red-600">{current.error.message}</p>}

          {current?.scores && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {CATS.filter(c => current.scores![c] !== undefined).map(c => <Ring key={c} score={current.scores![c]} label={t[c]} />)}
              </div>

              {current.metrics && current.metrics.length > 0 && (
                <div>
                  <h3 className="mb-2 font-medium">{t.metrics}</h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {current.metrics.map(m => (
                      <li key={m.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
                        <span>{m.title}</span>
                        <span className={`font-mono ${tone(m.score)}`} dir="ltr">{m.value ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-2 font-medium">{t.fixTitle}</h3>
                {!current.issues?.length ? <p className="text-emerald-600">{t.allGood}</p> : (
                  <div className="flex flex-col gap-2">
                    {current.issues.map(i => (
                      <details key={i.id} className="rounded-lg border border-neutral-200 dark:border-neutral-800">
                        <summary className="flex cursor-pointer items-center gap-3 px-3 py-2">
                          <span dir="ltr" className={`min-w-16 rounded-md px-2 py-0.5 text-center font-mono text-xs ${i.diagnostic ? 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200'}`}>
                            {i.diagnostic ? t.diag : `${i.approximate ? '≤ ' : ''}−${i.pointsGain.toFixed(1)} ${t.pts}`}
                          </span>
                          <span className="flex-1 text-sm font-medium">{i.title}{i.displayValue ? ` — ${i.displayValue}` : ''}</span>
                        </summary>
                        <div className="flex flex-col gap-3 border-t border-neutral-200 px-3 py-3 text-sm dark:border-neutral-800">
                          {i.fix && <p className="border-s-4 border-blue-500 bg-neutral-50 px-3 py-2 dark:bg-neutral-900"><strong>{t.how}: </strong>{i.fix}</p>}
                          {i.items.length > 0 && (
                            <div>
                              <p className="mb-1 text-xs text-neutral-500">{t.affected} ({i.itemCount})</p>
                              <ul className="flex flex-col gap-1">
                                {i.items.map((x, k) => <li key={k} dir="ltr" className="break-all rounded bg-neutral-100 px-2 py-0.5 text-start font-mono text-xs dark:bg-neutral-800">{x}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowFull(v => !v)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">{showFull ? t.hideFull : t.full}</button>
                <a href={`/api/speed/${job.id}/lhr/${device}`} download={`lighthouse-${device}.json`} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">{t.json}</a>
              </div>
              {showFull && <LighthouseFullReport src={`/api/speed/${job.id}/lhr/${device}`} />}
            </>
          )}
        </>
      )}
    </section>
  );
}
