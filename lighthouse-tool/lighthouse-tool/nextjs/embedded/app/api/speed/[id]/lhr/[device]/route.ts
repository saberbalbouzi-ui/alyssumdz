import {NextResponse} from 'next/server';
import {getJob} from '@/lib/speedlab/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, {params}: {params: Promise<{id: string; device: string}>}) {
  const {id, device} = await params;
  const job = /^[0-9a-f-]{36}$/.test(id) ? getJob(id) : undefined;
  const lhr = job?.results[device]?.lhr;
  if (!lhr) return NextResponse.json({error: {code: 'not_found', message: 'التقرير غير متاح'}}, {status: 404});
  return NextResponse.json(lhr);
}
