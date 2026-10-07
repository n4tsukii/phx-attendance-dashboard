'use client';

import { ArrowUpRight, Clock3, CheckCircle2, AlertTriangle } from 'lucide-react';
import { monthlyRecordBooks, chartScale, type AttendanceDashboardData } from '@/lib/attendance-model';

const nf = new Intl.NumberFormat('vi-VN');
const pct = (value: number) => `${value.toFixed(1)}%`;

type Props = {
  data: AttendanceDashboardData;
  selectedStatus: string;
  selectedMonth: string;
  selectedIssue: string;
  onStatus: (status: string) => void;
  onMonth: (month: string) => void;
  onIssue: (issue: string) => void;
};

export default function AttendanceCharts({ data, selectedStatus, selectedMonth, selectedIssue, onStatus, onMonth, onIssue }: Props) {
  const s = data.summary;
  const waiting = s.dueAssignments - s.completedAssignments;
  const monthly = monthlyRecordBooks(data.recordBookBreakdown);
  const scale = chartScale(Math.max(0, ...monthly.months.map((m) => m.total)));
  const svgWidth = Math.max(520, monthly.months.length * 64 + 64);
  const plotTop = 28, plotHeight = 168, base = plotTop + plotHeight;
  const step = (svgWidth - 64) / Math.max(1, monthly.months.length);
  const issues = data.qualityIssues.slice(0, 5);
  const maxIssue = Math.max(1, ...issues.map((q) => q.records));
  return (
    <div className="visual-grid">
      <section className="chart-card completion-chart" aria-labelledby="completion-title">
        <div className="card-heading"><div><span className="card-kicker">TIẾN ĐỘ GHI NHẬN</span><h2 id="completion-title">Điểm danh trong nhóm đã đến giờ</h2></div><CheckCircle2 size={20} className="teal-text"/></div>
        <p className="chart-description">{nf.format(s.dueAssignments)} lượt thuộc nhóm hoàn thành, đến giờ hoặc trong tiết.</p>
        <div className="completion-value"><strong>{s.dueAssignments ? pct(s.effectiveAssignmentRate) : '—'}</strong><span>có trạng thái hoàn thành</span></div>
        <div className="completion-track" aria-label={`Đã hoàn thành ${nf.format(s.completedAssignments)}, chờ cập nhật ${nf.format(waiting)}`}>
          <span style={{ width: `${s.effectiveAssignmentRate}%` }}/>
        </div>
        <div className="completion-options">
          {[{key:'HOAN_THANH',label:'Đã hoàn thành',count:s.completedAssignments,color:'teal'}, {key:'PENDING',label:'Chờ cập nhật',count:waiting,color:'amber'}].map((r) => (
            <button key={r.key} className={`completion-option ${r.color} ${selectedStatus === r.key ? 'selected' : ''}`} aria-pressed={selectedStatus === r.key} onClick={() => onStatus(selectedStatus === r.key ? '' : r.key)}>
              <span><i className={`legend-dot ${r.color}`}/>{r.label}<ArrowUpRight size={14}/></span><strong>{nf.format(r.count)}</strong>
              <small>{s.dueAssignments ? pct(r.count/s.dueAssignments*100) : '—'} của nhóm</small>
            </button>
          ))}
        </div>
        <div className="context-counts"><span>Chưa đến giờ <strong>{nf.format(s.futureAssignments)}</strong></span><span>Miễn chấm <strong>{nf.format(s.exemptAssignments)}</strong></span><span>Phân công báo nghỉ <strong>{nf.format(s.offAssignments)}</strong></span></div>
        <p className="chart-footnote">Phân nhóm theo trạng thái hiện có. Bấm một nhóm để xem bảng đối chiếu.</p>
      </section>
      <section className="chart-card monthly-chart" aria-labelledby="monthly-title">
        <div className="card-heading"><div><span className="card-kicker">THEO THÁNG CỦA TIẾT HỌC</span><h2 id="monthly-title">Sổ đầu bài: đã nhập và chưa nhập</h2></div><Clock3 size={20} className="muted"/></div>
        <p className="chart-description">Trạng thái hiện tại của các lượt sổ đầu bài, nhóm theo tháng.</p>
        <div className="chart-legend"><span><i className="legend-dot teal"/>Đã nhập</span><span><i className="legend-dot amber"/>Chưa nhập</span><span className="muted">Đơn vị: lượt</span></div>
        {!monthly.months.length ? <div className="chart-empty">Chưa có sổ đầu bài có ngày trong phạm vi này.</div> : <div className="chart-scroll">
          <svg viewBox={`0 0 ${svgWidth} 245`} width={svgWidth} height="245" role="group" aria-label="Biểu đồ sổ đầu bài theo tháng; dùng Tab và Enter để xem chi tiết">
            {scale.ticks.map((tick) => { const y = base - tick/scale.upper*plotHeight; return <g key={tick}><line x1="52" x2={svgWidth-12} y1={y} y2={y} stroke="#e8edf2" strokeDasharray={tick ? '3 4' : undefined}/><text x="43" y={y+4} textAnchor="end" className="svg-label">{nf.format(tick)}</text></g>; })}
            {monthly.months.map((m, i) => {
              const x = 64 + i*step + step/2;
              const doneHeight = m.done/scale.upper*plotHeight, pendingHeight = m.pending/scale.upper*plotHeight;
              const selected = selectedMonth === m.key;
              return <g key={m.key} role="button" tabIndex={0} aria-pressed={selected} aria-label={`Tháng ${m.key}: đã nhập ${nf.format(m.done)}, chưa nhập ${nf.format(m.pending)}. Xem chi tiết.`} className="month-column" onClick={() => onMonth(selected ? '' : m.key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMonth(selected ? '' : m.key); } }}>
                <title>{`${m.key}: ${nf.format(m.done)} đã nhập, ${nf.format(m.pending)} chưa nhập`}</title>
                <rect x={x-23} y={plotTop-4} width="46" height={plotHeight+34} rx="6" fill={selected ? '#eeeafd' : 'transparent'} className="month-hit"/>
                <rect x={x-13} y={base-doneHeight} width="26" height={doneHeight} fill="#238476"/>
                <rect x={x-13} y={base-doneHeight-pendingHeight} width="26" height={pendingHeight} fill="#d7a14b" rx="2"/>
                <text x={x} y={base-doneHeight-pendingHeight-7} textAnchor="middle" className="svg-count">{nf.format(m.total)}</text>
                <text x={x} y={base+23} textAnchor="middle" className={`svg-label ${selected ? 'selected-label' : ''}`}>{m.key.slice(5)}/{m.key.slice(2,4)}</text>
              </g>;
            })}
          </svg>
        </div>}
        <p className="chart-footnote">Bấm cột để xem bảng tháng đó. {nf.format(monthly.undated)} lượt chưa rõ ngày được giữ ngoài trục tháng.</p>
      </section>
      <section className="chart-card quality-chart" id="quality-chart" aria-labelledby="quality-title">
        <div className="card-heading"><div><span className="card-kicker">CẦN XÁC MINH</span><h2 id="quality-title">Vấn đề dữ liệu thường gặp</h2></div><AlertTriangle size={20} className="amber-text"/></div>
        <p className="chart-description">5 quy tắc có nhiều lượt vi phạm nhất trong phạm vi đang chọn.</p>
        <div className="quality-bars">
          {issues.map((q) => <button className={`quality-bar ${selectedIssue === q.issueCode ? 'selected' : ''}`} key={q.issueCode} onClick={() => onIssue(selectedIssue === q.issueCode ? '' : q.issueCode)} aria-pressed={selectedIssue === q.issueCode}>
            <span className="quality-bar-label"><span>{q.title}</span><strong>{nf.format(q.records)}</strong><ArrowUpRight size={14}/></span>
            <span className="bar-track"><span style={{ width: `${q.records/maxIssue*100}%`, background: q.category === 'critical' ? '#c26458' : '#a99ccc' }}/></span>
          </button>)}
          {!issues.length && <div className="chart-empty">Không có quy tắc vi phạm trong phạm vi này.</div>}
        </div>
        <p className="chart-footnote">Đơn vị: lượt vi phạm. Một bản ghi có thể xuất hiện ở nhiều quy tắc.</p>
      </section>
    </div>
  );
}
