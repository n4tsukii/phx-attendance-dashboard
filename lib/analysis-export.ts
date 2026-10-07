import type { AttendanceAnalysis } from './analysis-model';
const cell=(v:unknown)=>{let s=String(v??'');if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function exportAnalysisCsv(data:AttendanceAnalysis,query:URLSearchParams){
  const school=query.get('school')||'all',from=query.get('from')||data.range.from,to=query.get('to')||data.range.to,shift=query.get('shift')||'all',classId=query.get('class')||'all',grade=query.get('grade')||'all';
  if(school!=='all'&&!data.schools.some(s=>String(s.id)===school))throw new RangeError('Invalid school');
  const included=(r:{schoolId:number;classId:number;date:string;shift:string;grade:string})=>(school==='all'||String(r.schoolId)===school)&&r.date>=from&&r.date<=to&&(shift==='all'||r.shift===shift)&&(classId==='all'||`${r.schoolId}:${r.classId}`===classId)&&(grade==='all'||r.grade===grade);
  const rows:unknown[][]=[['snapshot_utc',data.snapshotAt],['period',from,to],['school',school],[],['grain','school','class','date','shift','initialized','marked_or_entered','exited','missing_begin','missing_end','detail']];
  for(const r of data.gates.filter(included))rows.push(['gate',r.schoolId,r.className,r.date,r.shift,r.n,r.entered,r.exited,r.missing_in,r.missing_out,`unconfigured=${r.unknown_window};in_only=${r.in_only};out_only=${r.out_only};no_signals=${r.neither}`]);
  for(const r of data.registers.filter(r=>included({...r,shift:shift==='all'?'BOTH':shift})))rows.push(['class_register',r.schoolId,r.className,r.date,'DAY',r.n,r.marked,'',r.n-r.marked,'',`status=${r.status};no_log=${r.no_log};no_teacher=${r.no_teacher}`]);
  for(const r of data.lessons.filter(included))rows.push(['lesson',r.schoolId,r.className,r.date,r.shift,r.n,r.done,'',r.n-r.done,'',`overdue=${r.overdue};past_but_status_future=${r.stuck_future}`]);
  return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
