import {NextResponse} from 'next/server';
import {startAnalysis} from '@/lib/lighthouse-client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // TODO: تحقق هنا من أن المستخدم مسجّل دخوله (Supabase Auth مثلاً) وضع حدّاً لكل مستخدم.
  const body = await req.json().catch(() => null);
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!/^https?:\/\//i.test(url) || url.length > 2048) {
    return NextResponse.json({error: {code: 'invalid_url', message: 'أدخل رابطاً صحيحاً يبدأ بـ http أو https'}}, {status: 422});
  }
  const lang = ['ar', 'fr', 'en'].includes(body?.lang) ? body.lang : 'ar';
  try {
    const {status, body: data} = await startAnalysis({url, lang, locale: lang});
    return NextResponse.json(data, {status});
  } catch {
    return NextResponse.json({error: {code: 'service_unavailable', message: 'خدمة التحليل غير متاحة حالياً'}}, {status: 503});
  }
}
