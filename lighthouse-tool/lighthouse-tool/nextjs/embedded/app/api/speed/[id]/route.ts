import {NextResponse} from 'next/server';
import {getJob, jobView} from '@/lib/speedlab/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = /^[0-9a-f-]{36}$/.test(id) ? getJob(id) : undefined;
  if (!job) return NextResponse.json({error: {code: 'not_found', message: 'المهمة غير موجودة أو انتهت صلاحيتها'}}, {status: 404});
  const l = new URL(req.url).searchParams.get('lang');
  return NextResponse.json(jobView(job, l === 'fr' || l === 'en' ? l : 'ar'));
}
