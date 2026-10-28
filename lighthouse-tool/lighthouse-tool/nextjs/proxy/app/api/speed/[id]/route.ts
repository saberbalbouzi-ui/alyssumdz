import {NextResponse} from 'next/server';
import {getAnalysis} from '@/lib/lighthouse-client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({error: {code: 'not_found', message: 'غير موجود'}}, {status: 404});
  const lang = new URL(req.url).searchParams.get('lang');
  try {
    const {status, body} = await getAnalysis(id, lang === 'fr' || lang === 'en' ? lang : 'ar');
    return NextResponse.json(body, {status});
  } catch {
    return NextResponse.json({error: {code: 'service_unavailable', message: 'خدمة التحليل غير متاحة حالياً'}}, {status: 503});
  }
}
