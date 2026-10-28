import {NextResponse} from 'next/server';
import {startJob, jobView, ServiceError, UrlRejected} from '@/lib/speedlab/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Lighthouse يحتاج Node وليس Edge

export async function POST(req: Request) {
  // TODO: استبدل identity بمعرّف المستخدم المسجّل (Supabase Auth مثلاً) وارفض الزوار غير المسجّلين إن أردت.
  const identity = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anonymous';
  const body = await req.json().catch(() => null);
  const lang = ['ar', 'fr', 'en'].includes(body?.lang) ? body.lang : 'ar';
  try {
    const job = await startJob({url: String(body?.url ?? '').trim().slice(0, 2048), locale: lang, identity});
    return NextResponse.json(jobView(job, lang), {status: job.status === 'done' ? 200 : 202});
  } catch (e) {
    if (e instanceof UrlRejected) return NextResponse.json({error: {code: e.code, message: e.message}}, {status: 422});
    if (e instanceof ServiceError) return NextResponse.json({error: {code: e.code, message: e.message}}, {status: e.status, headers: e.retryAfter ? {'retry-after': String(e.retryAfter)} : {}});
    return NextResponse.json({error: {code: 'internal_error', message: 'خطأ داخلي'}}, {status: 500});
  }
}
