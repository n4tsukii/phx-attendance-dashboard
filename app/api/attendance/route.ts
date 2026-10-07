import { getAttendanceDashboardData } from '@/lib/attendance-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const school = searchParams.get('school') || undefined;
    const data = await getAttendanceDashboardData(school,
      searchParams.get('from') || undefined, searchParams.get('to') || undefined);
    return Response.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof RangeError) {
      return Response.json({ error: 'Trường hoặc khoảng ngày không hợp lệ.' }, {
        status: 400, headers: { 'Cache-Control': 'no-store' },
      });
    }
    console.error('Failed to load attendance dashboard data:', error);
    return Response.json(
      { error: 'Không tải được dữ liệu điểm danh & sổ đầu bài từ ClickHouse.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
