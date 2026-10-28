'use client';
// يعرض التقرير الكامل بمحرّك العرض الرسمي نفسه الذي تستعمله PageSpeed Insights.
// الملف /lighthouse-report.js موجود في public/ (انسخه من الحزمة)، ولا يُحمَّل إلا عند الضغط على "عرض التقرير الكامل".
import {useEffect, useRef, useState} from 'react';

declare global {
  interface Window { __LHR?: {renderReport: (lhr: unknown, opts?: Record<string, unknown>) => HTMLElement} }
}

function loadRenderer(): Promise<void> {
  if (window.__LHR) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/lighthouse-report.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('lighthouse-report.js'));
    document.head.append(s);
  });
}

export default function LighthouseFullReport({src}: {src: string}) {
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lhr] = await Promise.all([fetch(src).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }), loadRenderer()]);
        if (cancelled || !box.current || !window.__LHR) return;
        const el = window.__LHR.renderReport(lhr, {omitTopbar: true, disableFireworks: true, disableDarkMode: true});
        const loc = String(lhr?.configSettings?.locale || 'en').split('-')[0];
        el.setAttribute('dir', ['ar', 'he', 'fa', 'ur'].includes(loc) ? 'rtl' : 'ltr');
        el.classList.toggle('lh-dark', document.documentElement.classList.contains('dark'));
        box.current.replaceChildren(el);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'error');
      }
    })();
    return () => { cancelled = true; };
  }, [src]);

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  return <div ref={box} className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800" />;
}
