export type Dims = {schoolId:number;classId:number;date:string;shift:string;className:string;grade:string};
export type Gate = Dims & {n:number;entered:number;exited:number;both:number;in_only:number;out_only:number;neither:number;due_in:number;due_out:number;missing_in:number;missing_out:number;unknown_window:number;outside_in:number;early_out:number;time_anomaly:number;future_time:number;duplicates:number};
export type Register = Dims & {n:number;marked:number;no_log:number;present:number;excused:number;absent:number;late:number;cancelled:number;status:number|null;no_teacher:boolean;duplicate_register:number;duplicate_detail:number};
export type Lesson = Dims & {n:number;done:number;processing:number;overdue:number;stuck_future:number;no_teacher:number;scanned:number;notified:number;present?:number;excused?:number;absent?:number;late?:number;lesson_count?:number};
export type BusAttendance = Dims & {n:number;boarded:number;excused:number};
export type FoodAttendance = Dims & {n:number;eaten:number;excused:number;unexcused:number;missing:number};
export type EventGroup = {schoolId:number;classId:number;date:string;shift:string;phase:string;hour?:number;method?:string;n:number};
export type AttendanceAnalysis = {snapshotAt:string;publishedAt:string;range:{from:string;to:string};period:{from:string;to:string};schools:{id:number;name:string}[];gates:Gate[];registers:Register[];lessons:Lesson[];buses:BusAttendance[];foods:FoodAttendance[];hours:EventGroup[];methods:EventGroup[];config:{schoolId:number;shift:string;weekday:number;type:string;enable:boolean;in_start:string;in_end:string;out_start:string;out_end:string;variants:number}[]};
export type ProfileRow = {kind:string;school_id:number|null;category:string;detail:string;records:string|number;source_snapshot_at:string;processed_at:string;window_from:string;window_to:string};
export function buildAnalysis(rows:ProfileRow[]):AttendanceAnalysis {
  if(!rows.length||new Set(rows.map(r=>r.source_snapshot_at)).size!==1||new Set(rows.map(r=>r.processed_at)).size!==1)throw new Error('Unavailable attendance generation');
  const meta=rows.find(r=>r.kind==='meta');if(!meta)throw new Error('Attendance period unavailable');
  const range=JSON.parse(meta.category);if(range.version!==2)throw new Error('Unsupported attendance grain');
  const data:AttendanceAnalysis={snapshotAt:rows[0].source_snapshot_at,publishedAt:rows[0].processed_at,range,period:{from:rows[0].window_from,to:rows[0].window_to},schools:[],gates:[],registers:[],lessons:[],buses:[],foods:[],hours:[],methods:[],config:[]};
  for(const r of rows){
    if(r.kind==='school'){data.schools.push({id:r.school_id!,name:r.category});continue;}
    if(r.kind==='meta')continue;
    const dims=JSON.parse(r.category),measures=JSON.parse(r.detail);
    if(!Number.isSafeInteger(Number(r.records))||Number(r.records)<0)throw new Error('Invalid attendance count');
    const item={...dims,...measures,schoolId:r.school_id};
    if(r.kind==='gate')data.gates.push(item);
    if(r.kind==='register')data.registers.push(item);
    if(r.kind==='lesson')data.lessons.push(item);
    if(r.kind==='bus')data.buses.push(item);
    if(r.kind==='food')data.foods.push(item);
    if(r.kind==='hour')data.hours.push(item);
    if(r.kind==='method')data.methods.push(item);
    if(r.kind==='config')data.config.push(item);
  }
  return data;
}
