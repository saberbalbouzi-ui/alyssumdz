import {NextResponse} from 'next/server';
import {getRawReport} from '@/lib/lighthouse-client';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, {params}: {params: Promise<{id: string; device: string}>}) {
  const {id, device} = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || (device !== 'mobile' && device !== 'desktop')) {
    return NextResponse.json({error: {code: 'not_found', message: 'غير موجود'}}, {status: 404});
  }
  const r = await getRawReport(id, device);
  return new NextResponse(r.body, {status: r.status, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}});
}
