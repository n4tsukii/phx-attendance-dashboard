import { getAttendanceAnalysis } from '@/lib/analysis-data';
import { exportAnalysisCsv } from '@/lib/analysis-export';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const query=new URL(request.url).searchParams,scope=query.get('school')||'all';
    const data=await getAttendanceAnalysis({from:query.get('from'),to:query.get('to')}),csv=exportAnalysisCsv(data,query);
    return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="phx-attendance-analysis-${scope}-${data.snapshotAt.slice(0,10)}.csv"`,'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:e instanceof RangeError?'Nhóm trường không hợp lệ.':'Chưa xuất được bản phân tích, vui lòng thử lại.'},{status:e instanceof RangeError?400:503,headers:{'Cache-Control':'no-store'}});}
}
