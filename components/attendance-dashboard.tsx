'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowUpRight, BookOpen, CheckCircle2, ChevronLeft, ChevronRight,
  Download, Filter, Info, ListChecks, RefreshCw, Search, X } from 'lucide-react';
import { getAssignmentAction, parseDateRange, type AttendanceDashboardData } from '@/lib/attendance-model';
import AttendanceCharts from './attendance-charts';

const nf = new Intl.NumberFormat('vi-VN');
const pf = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
type View = 'assignments' | 'record_book' | 'quality' | 'work_type' | 'evaluations';
type Filters = { school: string; from: string; to: string };
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat('vi-VN', {
  timeZone:'Asia/Bangkok', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit',
}).format(new Date(value)) : 'Chưa có lần cập nhật';
const shortDate = (value: string | null) => value ? value.split('-').reverse().join('/') : 'Chưa rõ ngày';
const gradeLabel = (value: string) => value === 'DA_NHAP' ? 'Đã nhập' : value === 'CHUA_NHAP' ? 'Chưa nhập' : value === 'CHUA_XAC_DINH' ? 'Chưa rõ trạng thái' : value;
const qualityLabel = (value: string) => value === 'critical' ? 'Ưu tiên đối chiếu' : value === 'warning' ? 'Cần xác minh' : 'Thông tin';

export default function AttendanceDashboard({ onOpenBusinessGoals }: { onOpenBusinessGoals: () => void }) {
  const [data, setData] = useState<AttendanceDashboardData | null>(null);
  const [schools, setSchools] = useState<AttendanceDashboardData['schools']>([]);
  const [filters, setFilters] = useState<Filters>({ school:'', from:'', to:'' });
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [dateError, setDateError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<View>('assignments');
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState('');
  const [issue, setIssue] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [onlyReview, setOnlyReview] = useState(false);
  const details = useRef<HTMLElement>(null);
  const abort = useRef<AbortController | null>(null);
  const request = useRef(0);

  const loadData = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    const id = ++request.current;
    setLoading(true);
    const params = new URLSearchParams();
    for (const [key,value] of Object.entries(filters)) if (value) params.set(key,value);
    try {
      const response = await fetch(`/api/attendance?${params}`, { cache:'no-store', signal:controller.signal });
      if (!response.ok) throw new Error('Unavailable');
      const payload = await response.json() as AttendanceDashboardData;
      if (id === request.current) { setData(payload); setSchools(payload.schools); setError(''); }
    } catch {
      if (!controller.signal.aborted && id === request.current) setError('Chưa tải được dữ liệu cho phạm vi đang chọn. Có thể thử lại.');
    } finally { if (id === request.current) setLoading(false); }
  }, [filters]);

  useEffect(() => {
    setData(null); setPage(1); setStatus(''); setMonth(''); setIssue(''); setQuery('');
    void loadData();
    const timer = setInterval(() => void loadData(), 60000);
    return () => { clearInterval(timer); abort.current?.abort(); };
  }, [loadData]);
  useEffect(() => { setPage(1); }, [activeTab,status,month,issue,query,onlyReview]);

  const openDetails = (view: View) => {
    setActiveTab(view);
    details.current?.scrollIntoView({ behavior:'smooth', block:'start' });
    details.current?.focus({ preventScroll:true });
  };
  const assignments = useMemo(() => (data?.assignmentBreakdown ?? []).filter((r) =>
    (!status || (status === 'PENDING' ? ['DEN_GIO','TRONG_TIET'].includes(r.status) : r.status === status)) &&
    (!onlyReview || getAssignmentAction(r).priority < 5) &&
    `${r.label} ${r.status}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')))
    .sort((a,b) => getAssignmentAction(a).priority-getAssignmentAction(b).priority || b.records-a.records), [data,status,onlyReview,query]);
  const recordBooks = useMemo(() => (data?.recordBookBreakdown ?? []).filter((r) =>
    (!month || (month === 'UNDATED' ? !r.date : r.date?.startsWith(month))) && (!onlyReview || r.status !== 'DA_NHAP') &&
    `${gradeLabel(r.status)} ${r.date ?? 'Chưa rõ ngày'}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')))
    .sort((a,b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.status.localeCompare(b.status)), [data,month,query,onlyReview]);
  const quality = useMemo(() => (data?.qualityIssues ?? []).filter((r) => (!issue || r.issueCode === issue) &&
    (!onlyReview || r.category !== 'info') && `${r.title} ${r.issueCode}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')))
    .sort((a,b) => ({critical:0,warning:1,info:2}[a.category]-{critical:0,warning:1,info:2}[b.category]) || b.records-a.records), [data,issue,query,onlyReview]);
  const work = (data?.workTypeBreakdown ?? []).filter((r) => r.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  const evaluations = (data?.evaluationScores ?? []).filter((r) => `${r.criteria} ${r.level}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  const allItems = {assignments,record_book:recordBooks,quality,work_type:work,evaluations}[activeTab];
  const maxPage = Math.max(1,Math.ceil(allItems.length/12));
  const currentPage = Math.min(page,maxPage);
  const s = data?.summary;
  const waiting = s ? s.dueAssignments-s.completedAssignments : 0;
  const stale = !!data?.updatedAt && (Date.now()-new Date(data.updatedAt).getTime()>900000 || new Date(data.updatedAt).getTime()>Date.now());
  const noData = !!s && s.totalAssignments+s.totalRecordBook+s.totalQualityIssues+s.totalEvaluations===0;
  const n = (value?: number) => data && value !== undefined ? nf.format(value) : '—';
  const rate = (value?: number, denominator?: number) => data && denominator ? `${pf.format(value ?? 0)}%` : '—';
  const resetDetail = () => { setStatus(''); setMonth(''); setIssue(''); setQuery(''); setOnlyReview(false); };

  const exportCsv = () => {
    let headers: string[], rows: (string|number)[][];
    if (activeTab==='assignments') { headers=['Trạng thái','Xác nhận kết thúc','Số lượt','Hành động']; rows=assignments.map((r)=>[r.label,r.finished?'Đã xác nhận':'Chưa xác nhận',r.records,getAssignmentAction(r).text]); }
    else if (activeTab==='record_book') { headers=['Ngày tiết học','Trạng thái','Số lượt']; rows=recordBooks.map((r)=>[r.date??'Chưa rõ ngày',gradeLabel(r.status),r.records]); }
    else if (activeTab==='quality') { headers=['Quy tắc','Mức ưu tiên','Lượt vi phạm','Hành động']; rows=quality.map((r)=>[r.title,qualityLabel(r.category),r.records,r.action]); }
    else if (activeTab==='work_type') { headers=['Loại tiết','Trạng thái tính lương','Đơn vị','Lượt phân công']; rows=work.map((r)=>[r.name,r.salaryStatus,r.unitName,r.records]); }
    else { headers=['Tiêu chí','Mức và thang điểm','Điểm','Số lượt']; rows=evaluations.map((r)=>[r.criteria,r.level,r.score??'Chưa rõ',r.records]); }
    const safe = (value:string|number) => { const text=String(value); return `"${(/^[\s]*[=+@-]/.test(text)?"'"+text:text).replaceAll('"','""')}"`; };
    const scope = [['Trường',data?.schools.find((r)=>String(r.id)===filters.school)?.name??'Tất cả trường'],['Từ ngày',filters.from||'Không giới hạn'],['Đến ngày',filters.to||'Không giới hạn'],['Cập nhật',data?.updatedAt??'']];
    const csv=[...scope,[],headers,...rows].map((row)=>row.map(safe).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a'); a.href=url; a.download=`phx-diem-danh-${activeTab}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return <div className="attendance-view" id="overview">
    <div className="page-title"><div><div className="eyebrow">ĐIỂM DANH & SỔ ĐẦU BÀI</div><h1>Theo dõi điểm danh<span className="title-dot">.</span></h1><p>Nhìn rõ tiến độ ghi nhận, tập trung vào phần cần kiểm tra.</p></div>
      <button className="button" onClick={()=>void loadData()} disabled={loading}><RefreshCw size={16} className={loading?'spin':''}/>{loading?'Đang tải…':'Làm mới'}</button>
    </div>
    <div className="filter-card">
      <form onSubmit={(e)=>{e.preventDefault();try { parseDateRange(draftFrom,draftTo); setDateError('');setFilters({...filters,from:draftFrom,to:draftTo}); } catch {setDateError('Nhập ngày hợp lệ; ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');}}}>
        <label className="school-filter"><span>Trường học</span><select aria-label="Chọn trường" value={filters.school} onChange={(e)=>setFilters({...filters,school:e.target.value})}><option value="">Tất cả trường</option>{schools.map((r)=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label><span>Từ ngày</span><input type="date" aria-label="Từ ngày" value={draftFrom} onChange={(e)=>setDraftFrom(e.target.value)}/></label>
        <label><span>Đến ngày</span><input type="date" aria-label="Đến ngày" value={draftTo} onChange={(e)=>setDraftTo(e.target.value)}/></label>
        <button className="button primary" type="submit"><Filter size={15}/>Áp dụng</button>
        <button className="text-button" type="button" onClick={()=>{setFilters({school:'',from:'',to:''});setDraftFrom('');setDraftTo('');setDateError('');}}>Đặt lại</button>
      </form>
      <div className="scope-line"><span>Phạm vi: <strong>{schools.find((r)=>String(r.id)===filters.school)?.name??(filters.school?'Trường đang chọn':'Tất cả trường')}</strong> · {filters.from||filters.to?`${shortDate(filters.from||null)} → ${shortDate(filters.to||null)}`:'Tất cả ngày'}</span><button className="text-button" onClick={onOpenBusinessGoals}><Info size={14}/>Cách tính chỉ báo</button></div>
      {dateError&&<p className="form-error" role="alert">{dateError}</p>}
    </div>
    {error&&<div className="notice" role="alert"><AlertTriangle size={18}/><span>{error}{data?' Đang giữ lần tải thành công gần nhất.':''}</span><button onClick={()=>void loadData()}>Thử lại</button></div>}
    {stale&&<div className="notice" role="alert"><Info size={18}/><span>Dữ liệu đã quá 15 phút hoặc thời gian cập nhật chưa hợp lệ. Kiểm tra đồng bộ trước khi sử dụng.</span></div>}
    {(filters.from||filters.to)&&data&&<p className="scope-caveat">Ngoài khoảng ngày: {n(data.scope.undatedAssignments)} lượt phân công và {n(data.scope.undatedRecordBooks)} lượt sổ đầu bài chưa rõ ngày.</p>}
    <section className="kpi-grid" aria-label="Chỉ báo điểm danh trong phạm vi đã chọn" aria-busy={loading}>
      <div className="kpi-card"><div className="kpi-label">Hoàn thành điểm danh<CheckCircle2 size={19}/></div><div className="kpi-value teal-text">{rate(s?.effectiveAssignmentRate,s?.dueAssignments)}</div><p>{n(s?.completedAssignments)} / {n(s?.dueAssignments)} lượt trong nhóm đã đến giờ</p><span className="kpi-caption">Theo trạng thái hoàn thành, đến giờ và trong tiết</span></div>
      <button className="kpi-card actionable" onClick={()=>{setStatus('PENDING');setOnlyReview(false);setQuery('');openDetails('assignments');}} disabled={!data}><div className="kpi-label">Chờ cập nhật điểm danh<ArrowUpRight size={19}/></div><div className="kpi-value amber-text">{n(data?waiting:undefined)}</div><p>Lượt ở trạng thái đến giờ hoặc trong tiết</p><span className="kpi-caption">Xem các nhóm cần theo dõi</span></button>
      <button className="kpi-card actionable" onClick={()=>{setMonth('');setOnlyReview(true);setQuery('');openDetails('record_book');}} disabled={!data}><div className="kpi-label">Sổ đầu bài chưa nhập<BookOpen size={19}/></div><div className="kpi-value">{n(s?.pendingRecordBook)}</div><p>Đã nhập {n(s?.completedRecordBook)} / {n(s?.totalRecordBook)} lượt</p><span className="kpi-caption">Tỷ lệ đã nhập: {rate(s?.recordBookRate,s?.totalRecordBook)}</span></button>
      <button className="kpi-card actionable" onClick={()=>{setIssue('');setOnlyReview(false);setQuery('');openDetails('quality');}} disabled={!data}><div className="kpi-label">Vấn đề dữ liệu<AlertTriangle size={19}/></div><div className="kpi-value">{n(s?.totalQualityIssues)}</div><p>{n(s?.criticalIssues)} lượt cần ưu tiên đối chiếu</p><span className="kpi-caption">Lượt vi phạm; có thể trùng bản ghi</span></button>
    </section>
    {noData&&<div className="empty-scope"><ListChecks size={26}/><h2>Chưa có dữ liệu trong phạm vi này</h2><p>Thử đổi trường hoặc mở rộng khoảng ngày.</p></div>}
    {data&&!noData&&<AttendanceCharts data={data} selectedStatus={status} selectedMonth={month} selectedIssue={issue}
      onStatus={(value)=>{setStatus(value);setOnlyReview(false);setQuery('');openDetails('assignments');}}
      onMonth={(value)=>{setMonth(value);setOnlyReview(false);setQuery('');openDetails('record_book');}}
      onIssue={(value)=>{setIssue(value);setOnlyReview(false);setQuery('');openDetails('quality');}}/>}
    {!data&&loading&&<div className="chart-skeleton" aria-label="Đang tải biểu đồ"/>}
    <section className="details-section" id="attendance-details" ref={details} tabIndex={-1} aria-labelledby="details-title">
      <div className="card-heading"><div><span className="card-kicker">ĐỐI CHIẾU & THEO DÕI</span><h2 id="details-title">Chi tiết trong phạm vi đã chọn</h2></div><button className="button" onClick={exportCsv} disabled={!data||!allItems.length}><Download size={15}/>CSV bảng này</button></div>
      <div className="detail-tabs" aria-label="Chọn bảng chi tiết">{([{key:'assignments',label:'Điểm danh'},{key:'record_book',label:'Sổ đầu bài'},{key:'quality',label:'Vấn đề dữ liệu'},{key:'work_type',label:'Loại tiết'},{key:'evaluations',label:'Đánh giá tiết'}] as {key:View;label:string}[]).map((r)=><button key={r.key} className={activeTab===r.key?'active':''} aria-pressed={activeTab===r.key} onClick={()=>{setActiveTab(r.key);setQuery('');setOnlyReview(false);}}>{r.label}</button>)}</div>
      <div className="detail-filters"><label className="search-field"><Search size={16}/><input aria-label="Tìm trong bảng" placeholder="Tìm trong bảng đang xem…" value={query} onChange={(e)=>setQuery(e.target.value)}/>{query&&<button className="icon-button" onClick={()=>setQuery('')} aria-label="Xóa tìm kiếm"><X size={14}/></button>}</label>
        {activeTab==='assignments'&&<select aria-label="Lọc trạng thái điểm danh" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">Tất cả trạng thái</option><option value="PENDING">Chờ cập nhật</option>{[...new Map((data?.assignmentBreakdown??[]).map((r)=>[r.status,r.label])).entries()].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}
        {['assignments','record_book','quality'].includes(activeTab)&&<label className="checkbox-label"><input type="checkbox" checked={onlyReview} onChange={(e)=>setOnlyReview(e.target.checked)}/>Cần kiểm tra</label>}
        <button className="text-button" onClick={resetDetail}>Bỏ lọc bảng</button>
      </div>
      {activeTab==='record_book'&&month&&<div className="detail-chip">{month==='UNDATED'?'Chưa rõ ngày':`Tháng ${month.slice(5)}/${month.slice(0,4)}`}<button aria-label="Bỏ lọc tháng" onClick={()=>setMonth('')}><X size={13}/></button><span>Chỉ lọc bảng sổ đầu bài</span></div>}
      {activeTab==='quality'&&issue&&<div className="detail-chip">Đang xem một quy tắc<button aria-label="Bỏ lọc quy tắc" onClick={()=>setIssue('')}><X size={13}/></button></div>}
      <p className="table-context">{activeTab==='assignments'?'Một dòng là một nhóm trạng thái và xác nhận kết thúc; sắp xếp nhóm cần kiểm tra trước.':activeTab==='record_book'?'Một dòng là một nhóm ngày và trạng thái; ngày chưa rõ được giữ ở cuối.':activeTab==='quality'?'Một dòng là một quy tắc; ưu tiên đối chiếu dữ liệu trước, sau đó theo số lượt vi phạm.':activeTab==='evaluations'?'Điểm được giữ theo tiêu chí và thang đánh giá, không gộp thành một điểm chung.':'Một dòng là một loại tiết, trạng thái tính lương và đơn vị tính.'}</p>
      <div className="table-scroll"><table>
        <thead><tr>{(activeTab==='assignments'?['Trạng thái','Xác nhận kết thúc','Lượt phân công','Tỷ trọng','Hành động gợi ý']:activeTab==='record_book'?['Ngày tiết học','Trạng thái','Số lượt']:activeTab==='quality'?['Quy tắc cần xác minh','Mức ưu tiên','Lượt vi phạm','Hành động gợi ý']:activeTab==='work_type'?['Loại tiết','Tính lương','Đơn vị','Lượt phân công']:['Tiêu chí','Mức & thang đánh giá','Điểm','Số lượt']).map((title)=><th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>
          {activeTab==='assignments'&&assignments.slice((currentPage-1)*12,currentPage*12).map((r)=><tr key={`${r.status}:${r.finished}`}><td><span className={`status-pill ${r.status==='HOAN_THANH'?'success':['DEN_GIO','TRONG_TIET'].includes(r.status)?'warning':''}`}>{r.label}</span></td><td>{r.finished?'Đã xác nhận':'Chưa xác nhận'}</td><td className="number-cell">{nf.format(r.records)}</td><td className="number-cell">{pf.format(r.percentage)}%</td><td className="action-cell">{getAssignmentAction(r).text}</td></tr>)}
          {activeTab==='record_book'&&recordBooks.slice((currentPage-1)*12,currentPage*12).map((r,i)=><tr key={`${r.date}:${r.status}:${i}`}><td>{shortDate(r.date)}</td><td><span className={`status-pill ${r.status==='DA_NHAP'?'success':'warning'}`}>{gradeLabel(r.status)}</span></td><td className="number-cell">{nf.format(r.records)}</td></tr>)}
          {activeTab==='quality'&&quality.slice((currentPage-1)*12,currentPage*12).map((r)=><tr key={r.issueCode}><td className="rule-cell">{r.title}</td><td><span className={`status-pill ${r.category==='critical'?'critical':r.category==='warning'?'warning':''}`}>{qualityLabel(r.category)}</span></td><td className="number-cell">{nf.format(r.records)}</td><td className="action-cell">{r.action}</td></tr>)}
          {activeTab==='work_type'&&work.slice((currentPage-1)*12,currentPage*12).map((r)=><tr key={JSON.stringify([r.name,r.salaryStatus,r.unitName])}><td>{r.name}</td><td>{r.salaryStatus==='TINH_LUONG'?'Có':r.salaryStatus==='KHONG_TINH_LUONG'?'Không':'Chưa rõ'}</td><td>{r.unitName==='CHUA_XAC_DINH'?'Chưa rõ':r.unitName}</td><td className="number-cell">{nf.format(r.records)}</td></tr>)}
          {activeTab==='evaluations'&&evaluations.slice((currentPage-1)*12,currentPage*12).map((r,i)=><tr key={`${r.criteria}:${r.level}:${r.score}:${i}`}><td className="rule-cell">{r.criteria}</td><td className="action-cell">{r.level}</td><td className="number-cell">{r.score===null?'—':nf.format(r.score)}</td><td className="number-cell">{nf.format(r.records)}</td></tr>)}
          {!allItems.length&&<tr><td colSpan={5} className="empty-table">{loading?'Đang tải dữ liệu…':'Không có nhóm dữ liệu phù hợp với bộ lọc bảng.'}</td></tr>}
        </tbody>
      </table></div>
      <div className="pagination"><span>{allItems.length?`${(currentPage-1)*12+1}–${Math.min(currentPage*12,allItems.length)} / ${nf.format(allItems.length)} nhóm`:'0 nhóm'}</span><div><button aria-label="Trang trước" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={17}/></button><span>Trang {currentPage} / {maxPage}</span><button aria-label="Trang sau" disabled={currentPage===maxPage} onClick={()=>setPage(currentPage+1)}><ChevronRight size={17}/></button></div></div>
    </section>
    <footer className="page-footer"><span><i className={`live-dot ${stale?'stale':''}`}/>Cập nhật: {dateTime(data?.updatedAt??null)} · UTC+7</span><span>Làm mới dữ liệu mỗi 5 phút · {n(s?.totalAssignments)} lượt phân công</span></footer>
  </div>;
}
