import { getAttendanceAnalysis } from '@/lib/analysis-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await getAttendanceAnalysis();
    const healthy = true;
    return Response.json({ status: healthy ? 'healthy' : 'stale_or_invalid_mart' }, {
      status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ status: 'unavailable' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
