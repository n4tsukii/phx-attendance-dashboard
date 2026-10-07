import {getAttendanceAnalysis} from '@/lib/analysis-data';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{const q=new URL(request.url).searchParams;return Response.json(await getAttendanceAnalysis({from:q.get('from'),to:q.get('to')}),{headers:{'Cache-Control':'no-store'}});}
 catch(e){return Response.json({error:e instanceof RangeError?'Khoảng ngày không hợp lệ.':'Chưa đọc được dữ liệu điểm danh.'},{status:e instanceof RangeError?400:503,headers:{'Cache-Control':'no-store'}});}
}
