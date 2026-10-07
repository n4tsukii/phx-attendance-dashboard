import 'server-only';
import {createClient} from '@clickhouse/client';
import {buildAnalysis,type ProfileRow,type AttendanceAnalysis} from './analysis-model';
import snapshotData from './attendance_snapshot.json';

export async function getAttendanceAnalysis(period?:{from?:string|null;to?:string|null}):Promise<AttendanceAnalysis>{
 const from=period?.from||'',to=period?.to||'';
 for(const value of [from,to])if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw new RangeError('Invalid attendance date');
 if(from&&to&&from>to)throw new RangeError('Invalid attendance period');
 if(process.env.NEXT_EXPORT==='true') return snapshotData as unknown as AttendanceAnalysis;
 const host=process.env.CH_HOST?.trim()||'127.0.0.1';
 try{
  const client=createClient({url:`http://${host==='localhost'?'127.0.0.1':host}:${process.env.CH_PORT||'8123'}`,username:process.env.CH_USER||'default',password:process.env.CH_PASSWORD||'',request_timeout:15000,clickhouse_settings:{max_execution_time:10}});
  try{
   const result=await client.query({query:`WITH
    (SELECT JSONExtractString(category,'to') FROM analys.mart_attendance_business WHERE kind='meta' LIMIT 1) AS last_day,
    if({from:String}='',toString(subtractDays(toDate(last_day),27)),{from:String}) AS window_from,
    if({to:String}='',last_day,{to:String}) AS window_to
    SELECT kind,school_id,category,detail,records,window_from,window_to,
    formatDateTime(source_snapshot_at,'%Y-%m-%dT%H:%i:%S.%fZ','UTC') AS source_snapshot_at,
    formatDateTime(processed_at,'%Y-%m-%dT%H:%i:%S.%fZ','UTC') AS processed_at
    FROM analys.mart_attendance_business
    WHERE kind IN ('school','config','meta') OR (JSONExtractString(category,'date')>=window_from AND JSONExtractString(category,'date')<=window_to)
    ORDER BY kind,school_id,category`,query_params:{from,to},format:'JSONEachRow'});
   return buildAnalysis(await result.json<ProfileRow>());
  }finally{await client.close();}
 }catch{
  return snapshotData as unknown as AttendanceAnalysis;
 }
}
