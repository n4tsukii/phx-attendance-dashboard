import AttendanceAnalysis from '@/components/attendance-analysis';
import { getAttendanceAnalysis } from '@/lib/analysis-data';
export const dynamic = 'auto';
export default async function Page(){
  try{return <AttendanceAnalysis initialData={await getAttendanceAnalysis()}/>;}
  catch{return <AttendanceAnalysis initialData={null}/>;}
}
