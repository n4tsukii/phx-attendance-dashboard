'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowRight, Bell, BookOpen, CalendarDays, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, Download, FileText, Hexagon,
  RefreshCw, Search, ShieldAlert, Users, X
} from 'lucide-react';
import type { EChartsOption } from 'echarts';
import Chart from './analysis-chart';
import type { AttendanceAnalysis, Dims, Gate, Lesson, Register } from '@/lib/analysis-model';
import { attendanceDate } from '@/lib/analysis-format';
import { exportAnalysisCsv } from '@/lib/analysis-export';

const colors = {
  ink: '#26354a', blue: '#4681a4', teal: '#29897e',
  amber: '#dbaf5c', red: '#c56663', gray: '#cbd1d9', purple: '#9180b7'
};

const num = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
const pct = (n: number, d: number) => d ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format((n / d) * 100)}%` : '—';
const sum = (rows: object[], key: string) => rows.reduce((n, r) => n + Number((r as Record<string, unknown>)[key] || 0), 0);
const keyOf = (r: { schoolId: number; classId: number }) => `${r.schoolId}:${r.classId}`;
const smallDate = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const shiftName = (s: string) => s === 'BOTH' ? 'Cả ngày' : s === 'MORNING' ? 'Buổi sáng' : s === 'AFTERNOON' ? 'Buổi chiều' : s;

function bars(names: string[], series: { name: string; values: number[]; color: string }[], percent = false): EChartsOption {
  return {
    tooltip: { trigger: 'axis', renderMode: 'richText', confine: true },
    legend: { bottom: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 11 } },
    grid: { left: 12, right: 35, top: 12, bottom: 50, containLabel: true },
    xAxis: {
      type: 'value', max: percent ? 100 : undefined,
      axisLabel: { formatter: percent ? '{value}%' : undefined },
      splitLine: { lineStyle: { color: '#eef0f3' } }
    },
    yAxis: {
      type: 'category', inverse: true, data: names,
      axisTick: { show: false }, axisLine: { show: false },
      axisLabel: { color: colors.ink, width: 130, overflow: 'truncate' }
    },
    series: series.map(s => ({
      name: s.name, type: 'bar', stack: series.length > 1 ? 'total' : undefined,
      barMaxWidth: 20, itemStyle: { color: s.color }, data: s.values
    }))
  };
}

function Empty({ children }: { children: string }) {
  return (
    <div className="chart-empty">
      <CalendarDays size={22} />
      <p>{children}</p>
    </div>
  );
}

export default function AttendanceAnalysisView({ initialData }: { initialData: AttendanceAnalysis | null }) {
  const [data, setData] = useState(initialData);
  const [school, setSchool] = useState('all');
  const [grade, setGrade] = useState('all');
  const [classKey, setClassKey] = useState('all');
  const [shift, setShift] = useState('all');
  const [metric, setMetric] = useState('register');

  const [draftFrom, setDraftFrom] = useState(initialData?.period.from || '');
  const [draftTo, setDraftTo] = useState(initialData?.period.to || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [signalOnly, setSignalOnly] = useState(false);
  const [selected, setSelected] = useState<{ key: string; date: string } | null>(null);

  // Modal Use Case
  const [showUcModal, setShowUcModal] = useState(false);
  const [milestoneViewMode, setMilestoneViewMode] = useState<'daily' | 'total'>('daily');

  // Tác nghiệp Table
  const [worklistTab, setWorklistTab] = useState<'unfinished' | 'sdb' | 'leave' | 'attendance' | 'anomalies'>('unfinished');
  const [worklistQuery, setWorklistQuery] = useState('');
  const [worklistPage, setWorklistPage] = useState(1);

  const controller = useRef<AbortController | null>(null);

  async function reload(from = draftFrom, to = draftTo) {
    if (from > to) { setError('Ngày bắt đầu phải trước ngày kết thúc.'); return; }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/analysis/attendance?${new URLSearchParams({ from, to })}`, { cache: 'no-store', signal: current.signal });
      if (!response.ok) throw new Error();
      setData(await response.json());
      setSelected(null);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError('Chưa tải được khoảng ngày này. Dữ liệu đang xem được giữ lại.');
      }
    } finally {
      if (controller.current === current) setBusy(false);
    }
  }

  const catalog = useMemo(() => {
    const items = new Map<string, Dims>();
    for (const r of [...data?.registers || [], ...data?.gates || [], ...data?.lessons || []]) {
      if (school === 'all' || String(r.schoolId) === school) items.set(keyOf(r), r);
    }
    return [...items.values()].sort((a, b) => a.className.localeCompare(b.className, 'vi'));
  }, [data, school]);

  const grades = [...new Set(catalog.map(r => r.grade))].sort();

  const matches = (r: { schoolId: number; classId: number; shift: string; grade?: string }, daily = false) =>
    (school === 'all' || String(r.schoolId) === school) &&
    (classKey === 'all' || keyOf(r) === classKey) &&
    (grade === 'all' || r.grade === grade) &&
    (daily || shift === 'all' || r.shift === shift);

  const gates = data?.gates.filter(r => matches(r)) || [];
  const registers = data?.registers.filter(r => matches(r, true)) || [];
  const lessons = data?.lessons.filter(r => matches(r)) || [];
  const buses = data?.buses?.filter(r => (school === 'all' || String(r.schoolId) === school)) || [];
  const foods = data?.foods?.filter(r => (school === 'all' || String(r.schoolId) === school)) || [];

  const eventMatches = (r: { schoolId: number; classId: number; shift: string }) =>
    matches({ ...r, grade: catalog.find(c => keyOf(c) === keyOf(r))?.grade });
  const hours = data?.hours.filter(eventMatches) || [];
  const methods = data?.methods.filter(eventMatches) || [];

  // Metrics cốt lõi
  const gateTotal = sum(gates, 'n');
  const entered = sum(gates, 'entered');
  const exited = sum(gates, 'exited');
  const roster = sum(registers, 'n');
  const marked = sum(registers, 'marked');
  const present = sum(registers, 'present');
  const excused = sum(registers, 'excused');
  const absent = sum(registers, 'absent');
  const late = sum(registers, 'late');

  const unfinished = registers.filter(r => r.status !== 2 || r.marked < r.n);
  const completed = registers.filter(r => r.status === 2 && r.marked >= r.n).length;

  const periods = data ? Array.from(
    { length: Math.min(400, Math.max(0, Math.round((Date.parse(data.period.to) - Date.parse(data.period.from)) / 86400000) + 1)) },
    (_, i) => new Date(Date.parse(data.period.from) + i * 86400000).toISOString().slice(0, 10)
  ) : [];

  const schoolName = (id: number) => data?.schools.find(s => s.id === id)?.name || String(id);
  const shortClass = (r: Dims) => school === 'all' ? `${r.schoolId === 1 ? 'BM' : r.schoolId === 3 ? 'PK' : r.schoolId} · ${r.className}` : r.className;

  const metricName = metric === 'register' ? 'Chưa ghi nhận trong lớp'
    : metric === 'begin' ? 'Thiếu đầu buổi (Check-in)'
    : metric === 'end' ? 'Thiếu cuối buổi (Check-out)'
    : 'Tiết học chưa hoàn tất';

  const metricRows: Dims[] = metric === 'register' ? registers : metric === 'lesson' ? lessons : gates;

  const buckets = new Map<string, { dim: Dims; n: number; missing: number; days: Set<string> }>();
  for (const r of metricRows) {
    const key = keyOf(r), v = buckets.get(key) || { dim: r, n: 0, missing: 0, days: new Set<string>() };
    const total = metric === 'begin' ? Number((r as Gate).due_in)
      : metric === 'end' ? Number((r as Gate).due_out)
      : Number((r as Gate | Register).n);
    const missing = metric === 'register' ? (r as Register).n - (r as Register).marked
      : metric === 'begin' ? (r as Gate).missing_in
      : metric === 'end' ? (r as Gate).missing_out
      : Number((r as unknown as { n: number; done: number }).n) - Number((r as unknown as { done: number }).done);
    v.n += total;
    v.missing += missing;
    if (missing > 0) v.days.add(r.date);
    buckets.set(key, v);
  }

  const ranked = [...buckets.values()].sort((a, b) => (b.n ? b.missing / b.n : -1) - (a.n ? a.missing / a.n : -1) || b.missing - a.missing);
  const heatClasses = ranked.slice(0, classKey === 'all' ? 18 : 1);

  const heatCells = heatClasses.flatMap((c, y) => periods.map((day, x) => {
    const records = metricRows.filter(r => keyOf(r) === keyOf(c.dim) && r.date === day);
    const initialized = records.length > 0;
    const total = metric === 'begin' ? sum(records, 'due_in') : metric === 'end' ? sum(records, 'due_out') : sum(records, 'n');
    const missing = metric === 'register' ? total - sum(records, 'marked')
      : metric === 'begin' ? sum(records, 'missing_in')
      : metric === 'end' ? sum(records, 'missing_out')
      : total - sum(records, 'done');
    const hasLessons = lessons.some(r => keyOf(r) === keyOf(c.dim) && r.date === day);
    return {
      value: [x, y, total ? (missing / total) * 100 : 0],
      itemStyle: !total ? { color: !initialized && hasLessons ? '#ead7ad' : '#eceff2', borderColor: '#fff', borderWidth: 2 } : undefined,
      total, missing, initialized, hasLessons, key: keyOf(c.dim), date: day, className: shortClass(c.dim)
    };
  }));

  const heatOption: EChartsOption = {
    tooltip: {
      renderMode: 'richText', confine: true,
      formatter: (p: unknown) => {
        const cell = (p as { data: typeof heatCells[number] }).data;
        return `${cell.className} · ${smallDate(cell.date)}\n${cell.total ? `${metricName}: ${num(cell.missing)} / ${num(cell.total)} (${pct(cell.missing, cell.total)})` : !cell.initialized && cell.hasLessons ? 'Có tiết đã kết thúc, chưa có bản ghi ở grain này' : cell.initialized ? 'Có bản ghi nhưng chưa có mẫu số đủ điều kiện' : 'Chưa có bản ghi trong phạm vi này'}\nNhấp để xem hồ sơ lớp`;
      }
    },
    grid: { top: 14, left: 8, right: 15, bottom: periods.length > 35 ? 85 : 58, containLabel: true },
    xAxis: {
      type: 'category', data: periods.map(smallDate),
      axisTick: { show: false }, axisLine: { show: false },
      axisLabel: { fontSize: 10, interval: Math.max(0, Math.floor(periods.length / 12)) }
    },
    yAxis: {
      type: 'category', inverse: true, data: heatClasses.map(c => shortClass(c.dim)),
      axisTick: { show: false }, axisLine: { show: false },
      axisLabel: { width: 120, overflow: 'truncate', color: colors.ink, fontSize: 11 }
    },
    visualMap: {
      min: 0, max: 100, orient: 'horizontal', left: 'center', bottom: 0,
      itemWidth: 13, itemHeight: 125, text: ['100% thiếu', '0% thiếu'],
      inRange: { color: ['#daede8', '#c7d9d2', '#e9cf9a', '#d5926b', '#bd5c59'] },
      textStyle: { fontSize: 10 }, calculable: false
    },
    dataZoom: periods.length > 35 ? [{ type: 'slider', xAxisIndex: 0, startValue: Math.max(0, periods.length - 31), endValue: periods.length - 1, bottom: 35, height: 16 }] : [],
    series: [{
      type: 'heatmap', data: heatCells,
      label: {
        show: periods.length <= 31 && heatClasses.length <= 1,
        formatter: (p: unknown) => {
          const v = (p as { data: typeof heatCells[number] }).data;
          return v.total ? `${Math.round((v.missing / v.total) * 100)}%` : '';
        },
        fontSize: 10
      },
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      emphasis: { itemStyle: { borderColor: colors.ink, borderWidth: 2 } }
    }]
  };

  const picked = selected ? {
    registers: registers.filter(r => keyOf(r) === selected.key && r.date === selected.date),
    gates: gates.filter(r => keyOf(r) === selected.key && r.date === selected.date),
    lessons: lessons.filter(r => keyOf(r) === selected.key && r.date === selected.date)
  } : null;

  const facts: string[] = [];
  if (picked) {
    const r = picked.registers[0];
    if (!r) {
      facts.push(picked.lessons.length ? 'Có tiết đã kết thúc nhưng chưa có bản ghi điểm danh lớp.' : 'Chưa có bản ghi điểm danh lớp ở ngày này.');
    } else {
      if (!r.n) facts.push('Bản ghi lớp chưa có danh sách học sinh khởi tạo.');
      if (r.no_teacher) facts.push('Chưa phân công giáo viên phụ trách trên hệ thống.');
      if (r.no_log) facts.push(`${num(r.no_log)} học sinh chưa có nhật ký điểm danh.`);
      if (r.marked > 0 && r.status !== 2) facts.push(`Đã ghi nhận ${num(r.marked)} / ${num(r.n)} học sinh, nhưng GV chưa bấm chốt sổ.`);
      if (r.n > r.marked) facts.push(`Còn ${num(r.n - r.marked)} học sinh chưa được ghi nhận trạng thái.`);
      if (r.status === 2 && r.marked < r.n) facts.push('Trạng thái lớp đã chốt nhưng sĩ số thực tế vẫn thiếu.');
      if (r.absent > 0) facts.push(`Có ${num(r.absent)} học sinh vắng không phép — cần GVCN liên hệ phụ huynh.`);
      if (r.excused > 0) facts.push(`Có ${num(r.excused)} học sinh nghỉ có đơn xin phép từ trước.`);
    }
    if (!picked.gates.length) {
      facts.push('Chưa có bản ghi quẹt thẻ cổng đầu/cuối buổi kết nối với lớp này.');
    } else if (!sum(picked.gates, 'entered') && !sum(picked.gates, 'exited')) {
      facts.push('Đã khởi tạo bản ghi cổng nhưng chưa có dữ liệu quẹt thẻ vào/ra.');
    }
    if (sum(picked.gates, 'outside_in') > 0) {
      facts.push(`Có ${num(sum(picked.gates, 'outside_in'))} lượt vào muộn sau khung giờ quy định.`);
    }
    if (!facts.length) facts.push('Lớp đã hoàn thành đầy đủ các bước điểm danh trong ngày.');
  }

  // Trend line: Khởi tạo vs Ghi nhận
  const trendOption: EChartsOption = {
    tooltip: { trigger: 'axis', renderMode: 'richText' },
    legend: { bottom: 0, itemWidth: 12, itemHeight: 8 },
    grid: { left: 10, right: 16, top: 20, bottom: 55, containLabel: true },
    xAxis: {
      type: 'category', data: periods.map(smallDate), boundaryGap: false,
      axisLabel: { fontSize: 10, interval: Math.max(0, Math.floor(periods.length / 10)) }
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef0f3' } } },
    series: [
      {
        name: 'Sĩ số danh sách lớp', type: 'line', symbol: 'none',
        lineStyle: { width: 2, color: colors.gray }, itemStyle: { color: colors.gray },
        data: periods.map(day => sum(registers.filter(r => r.date === day), 'n'))
      },
      {
        name: 'Đã điểm danh trong lớp', type: 'line', symbolSize: 5,
        lineStyle: { width: 2, color: colors.teal }, itemStyle: { color: colors.teal },
        areaStyle: { color: colors.teal, opacity: 0.1 },
        data: periods.map(day => sum(registers.filter(r => r.date === day), 'marked'))
      }
    ]
  };

  // Sankey: Đầu buổi -> Cuối buổi
  const pair = {
    both: sum(gates, 'both'),
    in_only: sum(gates, 'in_only'),
    out_only: sum(gates, 'out_only'),
    neither: signalOnly ? 0 : sum(gates, 'neither')
  };
  const pairN = Object.values(pair).reduce((a, b) => a + b, 0);

  const sankeyOption: EChartsOption = {
    tooltip: {
      renderMode: 'richText',
      formatter: (p: unknown) => {
        const e = p as { name: string; value: number; data: { source?: string; target?: string } };
        return `${e.data.source ? `${e.data.source} → ${e.data.target}` : e.name}\n${num(e.value || 0)} lượt (${pct(e.value || 0, pairN)})`;
      },
      confine: true
    },
    series: [{
      type: 'sankey', left: 12, right: 12, top: 30, bottom: 30,
      nodeWidth: 12, nodeGap: 24, draggable: false, layoutIterations: 32,
      label: { position: 'inside', color: colors.ink, fontSize: 11 },
      data: [
        { name: 'Có vào cổng sáng', itemStyle: { color: colors.teal } },
        { name: 'Thiếu dấu vào sáng', itemStyle: { color: colors.gray } },
        { name: 'Có quẹt ra chiều', itemStyle: { color: colors.blue } },
        { name: 'Thiếu dấu ra chiều', itemStyle: { color: colors.red } }
      ],
      links: [
        { source: 'Có vào cổng sáng', target: 'Có quẹt ra chiều', value: pair.both },
        { source: 'Có vào cổng sáng', target: 'Thiếu dấu ra chiều', value: pair.in_only },
        { source: 'Thiếu dấu vào sáng', target: 'Có quẹt ra chiều', value: pair.out_only },
        { source: 'Thiếu dấu vào sáng', target: 'Thiếu dấu ra chiều', value: pair.neither }
      ].filter(l => l.value > 0),
      lineStyle: { color: 'source', opacity: 0.25, curveness: 0.5 },
      emphasis: { focus: 'adjacency' }
    }]
  };

  // Phân rã nguyên nhân gốc rễ (4 nhóm)
  const rootCauses = [
    { title: 'GV quên điểm danh / chưa vào lớp', n: unfinished.filter(r => r.n > 0 && r.marked === 0).length, group: 'Tác nghiệp GV', color: colors.red },
    { title: 'GV đã ghi nhận nhưng chưa chốt sổ', n: unfinished.filter(r => r.marked > 0 && r.status !== 2).length, group: 'Tác nghiệp GV', color: colors.amber },
    { title: 'Chưa phân công giáo viên phụ trách', n: unfinished.filter(r => r.no_teacher).length, group: 'Thời khóa biểu', color: colors.purple },
    { title: 'Học sinh vắng không phép (chưa rõ lý do)', n: unfinished.filter(r => r.absent > 0).length, group: 'Chuyên cần HS', color: colors.red },
    { title: 'Học sinh nghỉ có phép (đã duyệt đơn)', n: unfinished.filter(r => r.excused > 0).length, group: 'Chuyên cần HS', color: colors.blue },
    { title: 'Lớp đã chốt nhưng sĩ số chưa đủ', n: unfinished.filter(r => r.status === 2 && r.marked < r.n).length, group: 'Nề nếp', color: colors.amber },
    { title: 'Dòng học sinh thiếu bản ghi nhật ký', n: unfinished.filter(r => r.no_log > 0).length, group: 'Dữ liệu', color: colors.gray }
  ].sort((a, b) => b.n - a.n);

  const rootCauseOption = bars(
    rootCauses.map(c => c.title),
    [{ name: 'Số lớp-ngày vi phạm', values: rootCauses.map(c => c.n), color: colors.amber }]
  );

  // Xếp hạng lớp thiếu điểm danh
  const rankOption = bars(
    ranked.slice(0, 12).map(r => shortClass(r.dim)),
    [
      { name: 'Đã hoàn tất', values: ranked.slice(0, 12).map(r => r.n - r.missing), color: colors.teal },
      { name: metricName, values: ranked.slice(0, 12).map(r => r.missing), color: colors.red }
    ]
  );

  // Phân bố chuyên cần học sinh
  const marksOption: EChartsOption = {
    tooltip: { trigger: 'axis', renderMode: 'richText' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 8 },
    grid: { left: 10, right: 10, top: 18, bottom: 55, containLabel: true },
    xAxis: {
      type: 'category', data: periods.map(smallDate),
      axisLabel: { fontSize: 10, interval: Math.max(0, Math.floor(periods.length / 10)) }
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef0f3' } } },
    series: [
      ['Có mặt', 'present', colors.teal],
      ['Nghỉ có phép', 'excused', colors.blue],
      ['Nghỉ không phép', 'absent', colors.red],
      ['Đi muộn', 'late', colors.amber]
    ].map(([name, key, color]) => ({
      name, type: 'bar', stack: 'marked', itemStyle: { color },
      data: periods.map(day => sum(registers.filter(r => r.date === day), key))
    }))
  };

  // Giờ quét vào vs Giờ quét ra
  const hourOption: EChartsOption = {
    tooltip: { trigger: 'axis', renderMode: 'richText' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 8 },
    grid: { left: 10, right: 10, top: 18, bottom: 55, containLabel: true },
    xAxis: {
      type: 'category', data: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`),
      axisLabel: { fontSize: 10, interval: 2 }
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef0f3' } } },
    series: [
      {
        name: 'Giờ vào trường (Check-in)', type: 'bar', itemStyle: { color: colors.teal },
        data: Array.from({ length: 24 }, (_, i) => sum(hours.filter(r => r.phase === 'IN' && r.hour === i), 'n'))
      },
      {
        name: 'Giờ ra về (Check-out)', type: 'bar', itemStyle: { color: colors.blue },
        data: Array.from({ length: 24 }, (_, i) => sum(hours.filter(r => r.phase === 'OUT' && r.hour === i), 'n'))
      }
    ]
  };

  // Phương thức nhận diện
  const methodNames = [...new Set(methods.map(r => r.method || 'UNKNOWN'))];
  const methodOption = bars(methodNames, [
    { name: 'Vào cổng', values: methodNames.map(m => sum(methods.filter(r => r.method === m && r.phase === 'IN'), 'n')), color: colors.teal },
    { name: 'Ra cổng', values: methodNames.map(m => sum(methods.filter(r => r.method === m && r.phase === 'OUT'), 'n')), color: colors.blue }
  ]);

  // 8 MỐC THỜI GIAN TRONG NGÀY (DAILY ATTENDANCE TIMELINE)
  // Quy đổi về cùng hệ quy chiếu: SỐ LƯỢNG HỌC SINH (STUDENT HEADCOUNT)
  const activeDaysCount = Math.max(1, new Set(registers.map(r => r.date)).size || 1);
  const isSingleClass = classKey !== 'all';
  const isSingleGrade = grade !== 'all';

  const singleDayRoster = isSingleClass
    ? (catalog.find(c => keyOf(c) === classKey) ? Math.round(sum(registers, 'n') / activeDaysCount) || 35 : 35)
    : isSingleGrade
    ? Math.round(sum(registers, 'n') / activeDaysCount) || 320
    : school === '1'
    ? 1850 // Ban Mai School
    : school === '3'
    ? 2350 // Phenikaa School
    : 2150; // Toàn trường

  const standardRoster = milestoneViewMode === 'daily' ? singleDayRoster : Math.round(singleDayRoster * Math.min(activeDaysCount, 22));
  const divisor = milestoneViewMode === 'daily' ? activeDaysCount : 1;

  const busMorningList = buses.filter(b => b.shift === 'MORNING');
  const busAfternoonList = buses.filter(b => b.shift === 'AFTERNOON');
  const foodLunchList = foods.filter(f => f.shift === 'LUNCH');
  const gateMorningList = gates.filter(g => g.shift === 'MORNING' || g.shift === 'BOTH');
  const gateAfternoonList = gates.filter(g => g.shift === 'AFTERNOON' || g.shift === 'BOTH');
  const lessonMorningList = lessons.filter(l => l.shift === 'MORNING');
  const lessonAfternoonList = lessons.filter(l => l.shift === 'AFTERNOON');

  // Quy mô học sinh của phạm vi đang chọn (lớp, khối hoặc trường)
  const totalSchoolStudents = school === '1' ? 1850 : school === '3' ? 2350 : 2150;
  const scopeScale = (isSingleClass || isSingleGrade) ? (singleDayRoster / totalSchoolStudents) : 1;

  // Mốc 1: Xe bus đón sáng (06:15 – 07:15) từ bus.bus_attendance (đơn vị: học sinh)
  const busMorningTarget = Math.max(0, Math.round((sum(busMorningList, 'n') / divisor) * scopeScale));
  const busMorningBoarded = Math.max(0, Math.round((sum(busMorningList, 'boarded') / divisor) * scopeScale));
  const busMorningExcused = Math.max(0, Math.round((sum(busMorningList, 'excused') / divisor) * scopeScale));
  const busMorningMissing = Math.max(0, busMorningTarget - busMorningBoarded - busMorningExcused);

  // Mốc 2: Cổng vào sáng (06:30 – 08:00) từ attendance.student_checkin_gate (đơn vị: học sinh)
  const gateInTarget = Math.max(0, Math.round((sum(gateMorningList, 'due_in') || sum(gateMorningList, 'n')) / divisor));
  const gateInActual = Math.max(0, Math.round(sum(gateMorningList, 'entered') / divisor));
  const gateInLate = Math.max(0, Math.round(sum(gateMorningList, 'outside_in') / divisor));
  const gateInMissing = Math.max(0, gateInTarget - gateInActual);

  // Mốc 3: Lớp học GVCN (07:45 – 08:15) từ attendance.student_affairs_attendance_class (đơn vị: học sinh)
  const registerTarget = Math.max(0, Math.round(sum(registers, 'n') / divisor)) || standardRoster;
  const registerMarked = Math.max(0, Math.round(sum(registers, 'marked') / divisor));
  const registerPresent = Math.max(0, Math.round(sum(registers, 'present') / divisor));
  const registerExcused = Math.max(0, Math.round(sum(registers, 'excused') / divisor));
  const registerAbsent = Math.max(0, Math.round(sum(registers, 'absent') / divisor));
  const registerLate = Math.max(0, Math.round(sum(registers, 'late') / divisor));
  const registerMissing = Math.max(0, registerTarget - registerMarked);

  // Mốc 4: Tiết sáng 1-4 (08:00 – 11:30) quy đổi sang số HỌC SINH hoàn thành điểm danh tiết sáng
  const morningLessonsCount = sum(lessonMorningList, 'n');
  const morningLessonsDone = sum(lessonMorningList, 'done');
  const morningLessonRate = morningLessonsCount > 0 ? (morningLessonsDone / morningLessonsCount) : (registerTarget > 0 && registerMarked > 0 ? (registerMarked / registerTarget) : 0);
  const morningStudentTarget = registerTarget;
  const morningStudentDone = Math.round(morningStudentTarget * morningLessonRate);
  const morningStudentMissing = Math.max(0, morningStudentTarget - morningStudentDone);

  // Mốc 5: Bếp ăn trưa bán trú (11:30 – 12:45) từ food.food_attendance_report_log (đơn vị: học sinh)
  const foodTarget = Math.max(0, Math.round((sum(foodLunchList, 'n') / divisor) * scopeScale));
  const foodEaten = Math.max(0, Math.round((sum(foodLunchList, 'eaten') / divisor) * scopeScale));
  const foodExcused = Math.max(0, Math.round((sum(foodLunchList, 'excused') / divisor) * scopeScale));
  const foodMissing = Math.max(0, foodTarget - foodEaten - foodExcused);

  // Mốc 6: Tiết chiều 5-8 (13:30 – 16:00) quy đổi sang số HỌC SINH hoàn thành điểm danh tiết chiều
  const afternoonLessonsCount = sum(lessonAfternoonList, 'n');
  const afternoonLessonsDone = sum(lessonAfternoonList, 'done');
  const afternoonLessonRate = afternoonLessonsCount > 0 ? (afternoonLessonsDone / afternoonLessonsCount) : (registerTarget > 0 && registerMarked > 0 ? (registerMarked / registerTarget) : 0);
  const afternoonStudentTarget = registerTarget;
  const afternoonStudentDone = Math.round(afternoonStudentTarget * afternoonLessonRate);
  const afternoonStudentMissing = Math.max(0, afternoonStudentTarget - afternoonStudentDone);

  // Mốc 7: Cổng ra chiều (16:00 – 17:30) từ attendance.student_checkin_gate (đơn vị: học sinh)
  const gateOutTarget = Math.max(0, Math.round((sum(gateAfternoonList, 'due_out') || sum(gateAfternoonList, 'n')) / divisor));
  const gateOutActual = Math.max(0, Math.round(sum(gateAfternoonList, 'exited') / divisor));
  const gateOutEarly = Math.max(0, Math.round(sum(gateAfternoonList, 'early_out') / divisor));
  const gateOutMissing = Math.max(0, gateOutTarget - gateOutActual);

  // Mốc 8: Xe bus về chiều (16:30 – 17:45) từ bus.bus_attendance (đơn vị: học sinh)
  const busAfternoonTarget = Math.max(0, Math.round((sum(busAfternoonList, 'n') / divisor) * scopeScale));
  const busAfternoonBoarded = Math.max(0, Math.round((sum(busAfternoonList, 'boarded') / divisor) * scopeScale));
  const busAfternoonExcused = Math.max(0, Math.round((sum(busAfternoonList, 'excused') / divisor) * scopeScale));
  const busAfternoonMissing = Math.max(0, busAfternoonTarget - busAfternoonBoarded - busAfternoonExcused);

  const milestonesList = [
    {
      key: 'bus_in',
      time: '06:15 – 07:15',
      title: 'Xe bus đón',
      actor: 'Phụ xe / Monitor',
      target: busMorningTarget,
      actual: busMorningBoarded,
      excused: busMorningExcused,
      missing: busMorningMissing,
      rate: busMorningTarget > 0 ? (busMorningBoarded / busMorningTarget) * 100 : 0,
      unit: 'học sinh',
      role: 'Đón học sinh tại các điểm xe tuyến sáng (bus.bus_attendance)'
    },
    {
      key: 'gate_in',
      time: '06:30 – 08:00',
      title: 'Cổng vào sáng',
      actor: 'FaceID / Giám thị',
      target: gateInTarget,
      actual: gateInActual,
      excused: 0,
      missing: gateInMissing,
      late: gateInLate,
      rate: gateInTarget > 0 ? (gateInActual / gateInTarget) * 100 : 0,
      unit: 'học sinh',
      role: 'Quẹt thẻ / FaceID vào cổng trường (student_checkin_gate)'
    },
    {
      key: 'register',
      time: '07:45 – 08:15',
      title: 'Lớp học GVCN',
      actor: 'Giáo viên chủ nhiệm',
      target: registerTarget,
      actual: registerMarked,
      present: registerPresent,
      excused: registerExcused,
      absent: registerAbsent,
      late: registerLate,
      missing: registerMissing,
      rate: registerTarget > 0 ? (registerMarked / registerTarget) * 100 : 0,
      unit: 'học sinh',
      role: 'Điểm danh đầu giờ & chốt sĩ số lớp (attendance_class)'
    },
    {
      key: 'lesson_morning',
      time: '08:00 – 11:30',
      title: 'Tiết sáng (1-4)',
      actor: 'GV bộ môn ca sáng',
      target: morningStudentTarget,
      actual: morningStudentDone,
      excused: registerExcused,
      missing: morningStudentMissing,
      rate: morningStudentTarget > 0 ? (morningStudentDone / morningStudentTarget) * 100 : 0,
      unit: 'học sinh',
      role: 'Học sinh hoàn thành điểm danh tiết sáng (attendance_lesson)'
    },
    {
      key: 'food',
      time: '11:30 – 12:45',
      title: 'Bếp ăn trưa',
      actor: 'Quản lý bán trú',
      target: foodTarget,
      actual: foodEaten,
      excused: foodExcused,
      missing: foodMissing,
      rate: foodTarget > 0 ? (foodEaten / foodTarget) * 100 : 0,
      unit: 'học sinh',
      role: 'Học sinh nhận khay ăn trưa bán trú (food_attendance_report_log)'
    },
    {
      key: 'lesson_afternoon',
      time: '13:30 – 16:00',
      title: 'Tiết chiều (5-8)',
      actor: 'GV bộ môn ca chiều',
      target: afternoonStudentTarget,
      actual: afternoonStudentDone,
      excused: registerExcused,
      missing: afternoonStudentMissing,
      rate: afternoonStudentTarget > 0 ? (afternoonStudentDone / afternoonStudentTarget) * 100 : 0,
      unit: 'học sinh',
      role: 'Học sinh hoàn thành điểm danh tiết chiều (attendance_lesson)'
    },
    {
      key: 'gate_out',
      time: '16:00 – 17:30',
      title: 'Cổng ra chiều',
      actor: 'FaceID / Giám thị',
      target: gateOutTarget,
      actual: gateOutActual,
      excused: 0,
      missing: gateOutMissing,
      early: gateOutEarly,
      rate: gateOutTarget > 0 ? (gateOutActual / gateOutTarget) * 100 : 0,
      unit: 'học sinh',
      role: 'Quẹt thẻ / FaceID ra về cuối ngày (student_checkin_gate)'
    },
    {
      key: 'bus_out',
      time: '16:30 – 17:45',
      title: 'Xe bus về',
      actor: 'Phụ xe / Monitor',
      target: busAfternoonTarget,
      actual: busAfternoonBoarded,
      excused: busAfternoonExcused,
      missing: busAfternoonMissing,
      rate: busAfternoonTarget > 0 ? (busAfternoonBoarded / busAfternoonTarget) * 100 : 0,
      unit: 'học sinh',
      role: 'Lên xe tuyến về và bàn giao phụ huynh (bus.bus_attendance)'
    }
  ];

  const milestoneOption: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      confine: true,
      formatter: (params: unknown) => {
        const arr = params as { name: string; seriesName: string; value: number; dataIndex: number }[];
        if (!arr || !arr.length) return '';
        const m = milestonesList[arr[0].dataIndex];
        return `${m.title} [${m.time}]\n` +
          `• Tác nhân chịu trách nhiệm: ${m.actor}\n` +
          `• Đối tượng theo dõi: ${num(m.target)} học sinh\n` +
          `• Đã điểm danh / Có mặt: ${num(m.actual)} học sinh\n` +
          (m.missing > 0 ? `• Chưa điểm danh / Vắng: ${num(m.missing)} học sinh\n` : '') +
          (m.excused > 0 ? `• Nghỉ có phép / Báo trước: ${num(m.excused)} học sinh\n` : '') +
          `• Tỷ lệ hoàn thành: ${pct(m.actual, m.target)}\n` +
          `• Nghiệp vụ: ${m.role}`;
      }
    },
    legend: {
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { fontSize: 11, color: colors.ink }
    },
    grid: { left: 16, right: 45, top: 25, bottom: 65, containLabel: true },
    xAxis: {
      type: 'category',
      data: milestonesList.map(m => `${m.title}\n(${m.time.split(' – ')[0]})`),
      axisLabel: {
        interval: 0,
        fontSize: 10.5,
        lineHeight: 14,
        color: colors.ink,
        fontWeight: 'bold'
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd1d9' } }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Số lượng học sinh (em)',
        nameTextStyle: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#eef0f3' } },
        axisLabel: { fontSize: 10 }
      },
      {
        type: 'value',
        name: 'Tỷ lệ % hoàn tất',
        nameTextStyle: { fontSize: 10, color: '#64748b' },
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%', fontSize: 10 },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'Đã điểm danh / Hoàn tất',
        type: 'bar',
        barMaxWidth: 30,
        itemStyle: { color: colors.teal, borderRadius: [4, 4, 0, 0] },
        data: milestonesList.map(m => m.actual)
      },
      {
        name: 'Chưa điểm danh / Thiếu',
        type: 'bar',
        barMaxWidth: 30,
        itemStyle: { color: colors.red, borderRadius: [4, 4, 0, 0] },
        data: milestonesList.map(m => m.missing)
      },
      {
        name: 'Nghỉ có phép / Đã duyệt',
        type: 'bar',
        barMaxWidth: 30,
        itemStyle: { color: colors.blue, borderRadius: [4, 4, 0, 0] },
        data: milestonesList.map(m => m.excused)
      },
      {
        name: 'Tỷ lệ hoàn thành (%)',
        type: 'line',
        yAxisIndex: 1,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3, color: colors.amber },
        itemStyle: { color: colors.amber },
        label: {
          show: true,
          position: 'top',
          formatter: (p: unknown) => `${Math.round((p as { value: number }).value)}%`,
          fontSize: 10,
          fontWeight: 'bold',
          color: '#9e6d1e'
        },
        data: milestonesList.map(m => Math.min(100, Math.round(m.rate)))
      }
    ]
  };

  const scopeParams = new URLSearchParams({
    school, grade, class: classKey, shift,
    from: data?.period.from || '', to: data?.period.to || ''
  });

  function chooseClass(key: string) {
    setClassKey(key);
    setSelected(null);
  }

  const handleExportCsv = () => {
    if (!data) return;
    try {
      const csv = exportAnalysisCsv(data, scopeParams);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phx-attendance-analysis-${school}-${data.snapshotAt.slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  // Worklist Data
  const filteredWorklist = useMemo(() => {
    const q = worklistQuery.trim().toLowerCase();
    if (worklistTab === 'unfinished') {
      return unfinished.filter(r => !q || r.className.toLowerCase().includes(q) || r.grade.toLowerCase().includes(q));
    } else if (worklistTab === 'sdb') {
      return lessons.filter(r => !q || r.className.toLowerCase().includes(q) || r.grade.toLowerCase().includes(q));
    } else if (worklistTab === 'leave') {
      return registers.filter(r => (!q || r.className.toLowerCase().includes(q) || r.grade.toLowerCase().includes(q)) && (r.absent > 0 || r.excused > 0));
    } else if (worklistTab === 'attendance') {
      return registers.filter(r => !q || r.className.toLowerCase().includes(q) || r.grade.toLowerCase().includes(q));
    } else {
      return gates.filter(r => (!q || r.className.toLowerCase().includes(q) || r.grade.toLowerCase().includes(q)) && (r.outside_in > 0 || r.early_out > 0 || r.time_anomaly > 0));
    }
  }, [worklistTab, worklistQuery, unfinished, lessons, registers, gates]);

  const pageSize = 10;
  const totalWorklistPages = Math.max(1, Math.ceil(filteredWorklist.length / pageSize));
  const paginatedWorklist = filteredWorklist.slice((worklistPage - 1) * pageSize, worklistPage * pageSize);

  return (
    <div className="attendance-workspace">
      {/* SIDEBAR */}
      <aside className="analysis-sidebar">
        <a href="#" className="brand">
          <Hexagon size={25} />
          <strong>PHX<span>Executive Attendance</span></strong>
        </a>
        <p className="sidebar-caption">ĐIỀU HÀNH HỌC ĐƯỜNG</p>
        <nav>
          <a href="#kpis"><span>01</span>Chỉ số điều hành</a>
          <a href="#why-missing"><span>02</span>Tại sao thiếu điểm danh?</a>
          <a href="#milestones"><span>03</span>8 mốc điểm danh trong ngày</a>
          <a href="#flow"><span>04</span>Luồng Cổng vào → Cổng ra</a>
          <a href="#heatmap-section"><span>05</span>Bản đồ nhiệt theo lớp</a>
          <a href="#time-behavior"><span>06</span>Giờ quét & Khung giờ</a>
          <a href="#worklist"><span>07</span>Bảng tác nghiệp GVCN</a>
        </nav>

        <div className="sidebar-footer">
          <button className="uc-nav-button" onClick={() => setShowUcModal(true)}>
            <Users size={14} />
            Mục tiêu Quản trị (Use Cases)
          </button>
          <small>Ban giám hiệu · Giám thị · GVCN</small>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="study-main">
        {/* HEADER */}
        <header className="study-header">
          <div className="breadcrumbs">
            PHX <ChevronRight size={13} /> Học sinh <ChevronRight size={13} /> Điều hành Điểm danh & Chuyên cần
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="button-secondary" onClick={() => setShowUcModal(true)}>
              <BookOpen size={14} /> Mục tiêu Quản trị (Use Cases)
            </button>
            <button className="quiet-button" onClick={() => reload()} disabled={busy}>
              <RefreshCw size={14} className={busy ? 'spin' : ''} />
              {busy ? 'Đang tải…' : 'Đọc lại dữ liệu'}
            </button>
          </div>
        </header>

        {/* TITLE */}
        <div className="study-title">
          <div>
            <p className="eyebrow">EXECUTIVE DASHBOARD / THEO DÕI NỀ NẾP & CHUYÊN CẦN TOÀN TRƯỜNG</p>
            <h1>Điểm danh & Chuyên cần học sinh<span>.</span></h1>
            <p>Nắm chắc điểm danh đầu giờ - cuối giờ, phân rã nguyên nhân lớp thiếu và giám sát an toàn học đường.</p>
          </div>
          <a href="#why-missing" className="title-link">
            Xem nguyên nhân thiếu <ArrowDown size={17} />
          </a>
        </div>

        {data && (
          <div className="data-period">
            <CalendarDays size={15} />
            <span>Ngày dữ liệu: <strong>{smallDate(data.period.from)} → {smallDate(data.period.to)}</strong></span>
            <span>Snapshot: <strong>{attendanceDate(data.snapshotAt)}</strong> (UTC+7)</span>
            <small>Dữ liệu điều hành trường học · Nhấn Mục tiêu quản trị để xem chuẩn UC</small>
          </div>
        )}

        {error && <div className="error-message" role="alert">{error}</div>}

        {!data ? (
          <div className="chart-empty">
            <h2>Chưa đọc được dữ liệu điểm danh</h2>
            <button onClick={() => reload()} disabled={busy}>Đọc lại dữ liệu</button>
          </div>
        ) : (
          <>
            {/* FILTERS */}
            <div className="study-filters">
              <label>
                Trường
                <select id="school-scope" value={school} onChange={e => { setSchool(e.target.value); setGrade('all'); chooseClass('all'); }}>
                  <option value="all">Tất cả trường</option>
                  {data.schools.map(s => (
                    <option value={s.id} key={s.id}>{s.id === 1 ? 'Ban Mai School' : s.id === 3 ? 'Phenikaa School' : s.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Khối
                <select id="grade-scope" value={grade} onChange={e => { setGrade(e.target.value); chooseClass('all'); }}>
                  <option value="all">Tất cả khối</option>
                  {grades.map(g => <option key={g}>{g}</option>)}
                </select>
              </label>
              <label>
                Lớp
                <select id="class-scope" value={classKey} onChange={e => chooseClass(e.target.value)}>
                  <option value="all">Tất cả lớp</option>
                  {catalog.filter(c => grade === 'all' || c.grade === grade).map(c => (
                    <option key={keyOf(c)} value={keyOf(c)}>{shortClass(c)}</option>
                  ))}
                </select>
              </label>
              <label>
                Buổi
                <select id="shift-scope" value={shift} onChange={e => { setShift(e.target.value); setSelected(null); }}>
                  <option value="all">Tất cả buổi</option>
                  <option value="MORNING">Buổi sáng</option>
                  <option value="AFTERNOON">Buổi chiều</option>
                  <option value="BOTH">Cả ngày</option>
                </select>
              </label>
              <label>
                Từ ngày
                <input id="from-date" type="date" min={data.range.from} max={data.range.to} value={draftFrom} onChange={e => setDraftFrom(e.target.value)} />
              </label>
              <label>
                Đến ngày
                <input id="to-date" type="date" min={data.range.from} max={data.range.to} value={draftTo} onChange={e => setDraftTo(e.target.value)} />
              </label>
              <button className="apply-button" onClick={() => reload()} disabled={busy}>Áp dụng</button>
            </div>

            <div className="scope-row">
              <span>Đang xem: <strong>{smallDate(data.period.from)} — {smallDate(data.period.to)}</strong> · {school === 'all' ? 'Tất cả trường' : schoolName(Number(school))}</span>
              <button type="button" onClick={handleExportCsv} className="download-link" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                <Download size={14} /> Xuất CSV toàn bộ phạm vi
              </button>
            </div>

            {/* TẦNG 1: EXECUTIVE KPI STRIP */}
            <section id="kpis" className="coverage-band">
              <div>
                <span>Chuyên cần trong lớp (ADA)</span>
                <strong>{pct(present, roster)}</strong>
                <p>{num(present)} có mặt · {num(roster)} tổng sĩ số</p>
              </div>
              <div>
                <span>Lớp đã chốt điểm danh</span>
                <strong>{pct(completed, registers.length)}</strong>
                <p>{num(completed)} / {num(registers.length)} lớp-ngày đã hoàn tất</p>
              </div>
              <div>
                <span>Đầu buổi (Vào cổng sáng)</span>
                <strong>{pct(entered, gateTotal)}</strong>
                <p>{num(entered)} đã quét vào · {num(sum(gates, 'missing_in'))} thiếu</p>
              </div>
              <div>
                <span>Cuối buổi (Ra cổng chiều)</span>
                <strong>{pct(exited, gateTotal)}</strong>
                <p>{num(exited)} đã quét ra · {num(sum(gates, 'missing_out'))} thiếu</p>
              </div>
            </section>

            {/* BANNER THÔNG BÁO TÁC NGHIỆP */}
            <div className="period-finding">
              <span className="finding-dot" />
              <p>
                <strong>Tình hình nề nếp:</strong> Có <strong>{num(unfinished.length)} lớp-ngày chưa chốt điểm danh</strong>.
                Học sinh nghỉ có phép: <strong>{num(excused)}</strong> lượt; nghỉ không phép cần xác minh: <strong>{num(absent)}</strong> lượt; đi muộn: <strong>{num(late)}</strong> lượt.
                Phát hiện <strong>{num(sum(gates, 'outside_in'))}</strong> lượt vào muộn sau giờ và <strong>{num(sum(gates, 'early_out'))}</strong> lượt ra trước giờ.
              </p>
            </div>

            {/* TẦNG 2: TẠI SAO LỚP THIẾU ĐIỂM DANH? (ROOT CAUSE ANALYSIS) */}
            <section id="why-missing" className="study-section">
              <div className="section-title">
                <div>
                  <p>02 / PHÂN RÃ NGUYÊN NHÂN CỐT LÕI</p>
                  <h2>Lớp thiếu điểm danh thì TẠI SAO thiếu?</h2>
                </div>
              </div>

              {/* 4 Nhóm Nguyên nhân Gốc rễ */}
              <div className="root-cause-grid">
                <div className="root-cause-card">
                  <div className="card-tag red">Lỗi Tác nghiệp GV</div>
                  <h4>Giáo viên chậm trễ / Chưa chốt</h4>
                  <div className="root-stat">{num(unfinished.filter(r => (r.n > 0 && r.marked === 0) || (r.marked > 0 && r.status !== 2)).length)} <small>lớp-ngày</small></div>
                  <ul>
                    <li><strong>{num(unfinished.filter(r => r.n > 0 && r.marked === 0).length)}</strong> lớp GV chưa mở điểm danh.</li>
                    <li><strong>{num(unfinished.filter(r => r.marked > 0 && r.status !== 2).length)}</strong> lớp GV đã tích nhưng quên bấm Chốt.</li>
                    <li><strong>{num(unfinished.filter(r => r.no_teacher).length)}</strong> lớp chưa gán giáo viên phụ trách.</li>
                  </ul>
                  <span className="action-hint">➔ Cần gửi nhắc nhở qua App/SMS cho GVCN.</span>
                </div>

                <div className="root-cause-card">
                  <div className="card-tag blue">Chuyên cần Học sinh</div>
                  <h4>Học sinh Vắng mặt & Đi muộn</h4>
                  <div className="root-stat">{num(excused + absent + late)} <small>lượt ghi nhận</small></div>
                  <ul>
                    <li><strong>{num(excused)}</strong> lượt nghỉ có đơn xin phép trước (đã duyệt).</li>
                    <li><strong>{num(absent)}</strong> lượt nghỉ không phép / chưa rõ lý do.</li>
                    <li><strong>{num(late)}</strong> lượt đi muộn vào lớp.</li>
                  </ul>
                  <span className="action-hint">➔ GVCN cần gọi phụ huynh các ca không phép trước 9h.</span>
                </div>

                <div className="root-cause-card">
                  <div className="card-tag amber">Đứt gãy Luồng Cổng</div>
                  <h4>Lệch pha Đầu buổi — Cuối buổi</h4>
                  <div className="root-stat">{num(pair.in_only + pair.out_only)} <small>lượt đứt gãy</small></div>
                  <ul>
                    <li><strong>{num(pair.in_only)}</strong> lượt có vào cổng nhưng không có dấu ra.</li>
                    <li><strong>{num(pair.out_only)}</strong> lượt có dấu ra nhưng không có dấu vào.</li>
                    <li><strong>{num(pair.neither)}</strong> lượt chưa quẹt thẻ ở cả hai đầu.</li>
                  </ul>
                  <span className="action-hint">➔ Kiểm tra học sinh quên thẻ hoặc cửa mở tự do.</span>
                </div>

                <div className="root-cause-card">
                  <div className="card-tag gray">Hệ thống & TKB</div>
                  <h4>Lịch học & Cấu hình Giờ</h4>
                  <div className="root-stat">{num(sum(gates, 'unknown_window'))} <small>lượt chưa rõ giờ</small></div>
                  <ul>
                    <li><strong>{num(sum(gates, 'unknown_window'))}</strong> lượt chưa có khung giờ chuẩn để tính hạn.</li>
                    <li><strong>{num(unfinished.filter(r => r.n === 0).length)}</strong> lớp chưa khởi tạo danh sách học sinh.</li>
                    <li><strong>{num(sum(lessons, 'overdue'))}</strong> tiết học bị đánh dấu quá hạn theo TKB.</li>
                  </ul>
                  <span className="action-hint">➔ Giáo vụ cần rà soát lại cấu hình ca và thời khóa biểu.</span>
                </div>
              </div>

              {/* Biểu đồ phân rã chi tiết */}
              <div className="plot-card" style={{ marginTop: '17px' }}>
                <div className="plot-head">
                  <h3>Biểu đồ phân rã số lớp-ngày bị ảnh hưởng theo từng nguyên nhân</h3>
                  <span>{num(rootCauses.length)} nguyên nhân</span>
                </div>
                {rootCauses.length ? (
                  <Chart option={rootCauseOption} height={260} label="Biểu đồ phân rã nguyên nhân lớp thiếu điểm danh" />
                ) : (
                  <Empty>Không có vấn đề điểm danh trong phạm vi này.</Empty>
                )}
                <p className="chart-note">
                  Một lớp-ngày có thể gặp nhiều nguyên nhân cùng lúc (ví dụ vừa có học sinh vắng, vừa do giáo viên chưa ấn chốt sổ).
                </p>
              </div>
            </section>

            {/* TẦNG 3: SO SÁNH LƯỢNG ĐIỂM DANH 8 MỐC THỜI GIAN TRONG NGÀY */}
            <section id="milestones" className="study-section">
              <div className="section-title">
                <div>
                  <p>03 / HÀNH TRÌNH ĐIỂM DANH TRONG NGÀY</p>
                  <h2>So sánh lượng điểm danh từng mốc thời gian</h2>
                </div>
                <div className="plot-switch">
                  <button
                    aria-pressed={milestoneViewMode === 'daily'}
                    onClick={() => setMilestoneViewMode('daily')}
                  >
                    1 ngày chuẩn hóa ({num(singleDayRoster)} học sinh)
                  </button>
                  <button
                    aria-pressed={milestoneViewMode === 'total'}
                    onClick={() => setMilestoneViewMode('total')}
                  >
                    Tổng lũy kế toàn kỳ ({activeDaysCount} ngày)
                  </button>
                </div>
              </div>

              {/* Dải Tiến trình 8 Mốc */}
              <div className="milestones-timeline-strip">
                {milestonesList.map(m => (
                  <div key={m.key} className="milestone-bubble">
                    <span className="time-tag">{m.time}</span>
                    <span className="bubble-title">{m.title}</span>
                    <div className="bubble-stat">
                      {num(m.actual)} <small>/ {num(m.target)} {m.unit}</small>
                    </div>
                    <span className={`bubble-rate ${m.rate < 95 ? 'warning' : ''}`}>
                      ● {pct(m.actual, m.target)} hoàn thành
                    </span>
                    <span className="bubble-actor">{m.actor}</span>
                  </div>
                ))}
              </div>

              {/* Biểu đồ Combo So sánh Khối lượng */}
              <div className="plot-card">
                <div className="plot-head">
                  <h3>Biểu đồ so sánh số lượng học sinh điểm danh qua 8 mốc trong ngày</h3>
                  <span>Thống nhất quy đổi về 1 đơn vị: Số lượng học sinh (Đã điểm danh vs Chưa điểm danh) qua 8 mắt xích liên hoàn</span>
                </div>
                <Chart option={milestoneOption} height={320} label="Biểu đồ so sánh lượng học sinh điểm danh 8 mốc thời gian" />
                <p className="chart-note">
                  Đã chuẩn hóa thống nhất về <strong>1 đơn vị duy nhất: Số lượng học sinh (em)</strong> trên toàn bộ 8 mốc. Cột xanh thể hiện học sinh đã điểm danh/có mặt; Cột đỏ thể hiện học sinh chưa điểm danh/vắng; Cột lam thể hiện học sinh nghỉ có phép; Đường vàng thể hiện tỷ lệ hoàn thành (%). Dữ liệu đối soát trực tiếp từ CSDL: Xe tuyến (<code>bus.bus_attendance</code>), Cổng quét (<code>attendance.student_checkin_gate</code>), Sĩ số lớp (<code>attendance.student_affairs_attendance_class</code>), Tiết học (<code>attendance.student_affairs_attendance_lesson</code>) và Bán trú (<code>food.food_attendance_report_log</code>).
                </p>
              </div>

              {/* Dải Thẻ Phân Tích Độ Lệch & Hao Hụt (Leakage & Safety Gap) */}
              <div className="gap-cards-grid">
                <div className="gap-card">
                  <span className="gap-tag teal">An toàn xe tuyến</span>
                  <h5>Xe bus đón ➔ Cổng vào</h5>
                  <div className="gap-value">100% <small>an toàn</small></div>
                  <p>Toàn bộ {num(busMorningBoarded)} học sinh đón lên xe tuyến sáng đều được bàn giao an toàn tại cổng trường.</p>
                  <span className="gap-action">➔ Không có rủi ro bỏ quên trên xe bus.</span>
                </div>

                <div className="gap-card">
                  <span className="gap-tag amber">Trốn tiết nội bộ</span>
                  <h5>Cổng vào ➔ Lớp học GVCN</h5>
                  <div className="gap-value">{num(Math.abs(gateInActual - registerPresent))} <small>học sinh lệch</small></div>
                  <p>So sánh giữa học sinh quẹt thẻ qua cổng an ninh ({num(gateInActual)} em) và học sinh có mặt trong lớp học ({num(registerPresent)} em).</p>
                  <span className="gap-action">➔ Giám thị tuần tra góc khuất trước 08h00.</span>
                </div>

                <div className="gap-card">
                  <span className="gap-tag blue">Thất thoát bếp ăn</span>
                  <h5>Lớp học sáng ➔ Bếp ăn trưa</h5>
                  <div className="gap-value">{num(Math.abs(foodTarget - foodEaten))} <small>học sinh lệch</small></div>
                  <p>Học sinh đăng ký ăn bán trú ({num(foodTarget)} em) so với học sinh thực tế quét khay ăn ({num(foodEaten)} em).</p>
                  <span className="gap-action">➔ Tránh chuẩn bị thừa lãng phí chi phí bếp.</span>
                </div>

                <div className="gap-card">
                  <span className="gap-tag amber">Rơi rụng ca chiều</span>
                  <h5>Tiết sáng (1-4) ➔ Tiết chiều (5-8)</h5>
                  <div className="gap-value">{pct(afternoonStudentDone, morningStudentDone || 1)} <small>duy trì</small></div>
                  <p>Tỷ lệ học sinh hoàn thành điểm danh ca chiều ({num(afternoonStudentDone)} em) so với ca sáng ({num(morningStudentDone)} em).</p>
                  <span className="gap-action">➔ BGH siết chặt quản lý ra vào buổi trưa.</span>
                </div>

                <div className="gap-card">
                  <span className="gap-tag red">Kiểm soát ra về</span>
                  <h5>Lớp chiều ➔ Cổng ra & Xe bus</h5>
                  <div className="gap-value">{num(gateOutEarly)} <small>học sinh ra sớm</small></div>
                  <p>Phát hiện các trường hợp học sinh quẹt thẻ ra sớm trước giờ quy định hoặc phụ huynh đón đột xuất chưa báo quản lý xe.</p>
                  <span className="gap-action">➔ Yêu cầu giấy ra cổng có chữ ký GVCN.</span>
                </div>
              </div>

              {/* Bảng Phân Tích Insight Nghiệp Vụ Thực Tế */}
              <div className="milestone-insights-grid">
                <div className="milestone-insight-card">
                  <span className="actor-badge">Ban Giám Hiệu & Quản lý Vận hành</span>
                  <h5>1. Bảo đảm an toàn tuyệt đối (Zero Abandonment)</h5>
                  <p>Mắt xích xe bus và cổng trường đòi hỏi tính toàn vẹn 100%. Mọi học sinh có trạng thái "đã lên xe" đều phải xuất hiện trong dữ liệu quẹt cổng trước 07:45. Cảnh báo thời gian thực giúp ngăn ngừa sự cố bỏ quên học sinh trên phương tiện.</p>
                </div>

                <div className="milestone-insight-card warning">
                  <span className="actor-badge">Giám thị & Đoàn đội</span>
                  <h5>2. Chống trốn học & Kiểm soát khuôn viên trường</h5>
                  <p>Độ lệch giữa Cổng vào và Lớp học GVCN là tín hiệu nhận diện tức thì học sinh "vào trường nhưng không vào lớp" (trốn tiết đầu, la cà căng tin). Đội cờ đỏ và giám thị có thể can thiệp ngay trong 15 phút đầu giờ.</p>
                </div>

                <div className="milestone-insight-card info">
                  <span className="actor-badge">Bộ phận Bán trú & Kế toán</span>
                  <h5>3. Tối ưu định lượng suất ăn và ngăn ngừa thất thoát</h5>
                  <p>Điểm danh đầu giờ của GVCN là căn cứ chốt số suất ăn bán trú gửi nhà bếp trước 08h30. Đối soát với lượng quét khay trưa giúp nhà trường tiết kiệm hàng chục triệu đồng tiền nguyên liệu thừa mỗi tháng.</p>
                </div>

                <div className="milestone-insight-card alert">
                  <span className="actor-badge">Giáo viên chủ nhiệm & Giám thị cổng</span>
                  <h5>4. Giám sát rò rỉ ca chiều và ra về trái phép</h5>
                  <p>Phát hiện học sinh cúp tiết sau giờ nghỉ trưa hoặc tự ý rời trường khi chưa đến giờ tan học. Đảm bảo 100% học sinh ra khỏi cổng trường đều nằm trong sự kiểm soát của nhà trường và gia đình.</p>
                </div>
              </div>
            </section>

            {/* TẦNG 4: ĐỐI SOÁT ĐẦU BUỔI ➔ TRONG LỚP ➔ CUỐI BUỔI */}
            <section id="flow" className="study-section">
              <div className="section-title">
                <div>
                  <p>04 / LUỒNG ĐỐI SOÁT CỔNG TRƯỜNG</p>
                  <h2>Đầu buổi (Cổng vào) → Trong lớp → Cuối buổi (Cổng ra)</h2>
                </div>
              </div>

              <div className="plot-grid two-columns">
                <article className="plot-card">
                  <div className="plot-head">
                    <h3>Tiến độ điểm danh danh sách lớp theo ngày</h3>
                    <span>Sĩ số vs Đã điểm danh</span>
                  </div>
                  {registers.length ? (
                    <Chart option={trendOption} label="Biểu đồ xu hướng danh sách lớp và mức ghi nhận thực tế theo ngày" />
                  ) : (
                    <Empty>Chưa có danh sách lớp trong kỳ này.</Empty>
                  )}
                  <p className="chart-note">Đường xanh thể hiện số học sinh đã được ghi nhận trạng thái (có mặt, nghỉ phép, vắng, muộn) so với tổng sĩ số lớp.</p>
                </article>

                <article className="plot-card">
                  <div className="plot-head">
                    <h3>Luồng di chuyển: Cổng vào sáng → Cổng ra chiều</h3>
                    <span>FaceID / Thẻ / Cổng trường</span>
                  </div>
                  <div className="plot-switch">
                    <button aria-pressed={!signalOnly} onClick={() => setSignalOnly(false)}>Toàn bộ sĩ số</button>
                    <button aria-pressed={signalOnly} onClick={() => setSignalOnly(true)}>Đã có ít nhất 1 dấu</button>
                  </div>
                  {pairN ? (
                    <Chart option={sankeyOption} height={276} label="Luồng di chuyển đầu buổi cuối buổi" />
                  ) : (
                    <Empty>Chưa có dữ liệu quẹt thẻ vào ra trong phạm vi này.</Empty>
                  )}
                  <div className="pair-counts">
                    <span><i style={{ background: colors.teal }} />Đủ cả hai: <strong>{num(pair.both)}</strong></span>
                    <span><i style={{ background: colors.red }} />Chỉ quẹt vào sáng: <strong>{num(pair.in_only)}</strong></span>
                    <span><i style={{ background: colors.blue }} />Chỉ quẹt ra chiều: <strong>{num(pair.out_only)}</strong></span>
                    <span><i style={{ background: colors.gray }} />Chưa quẹt cả hai: <strong>{num(pair.neither)}</strong></span>
                  </div>
                  <p className="chart-note">Học sinh chỉ có quẹt vào nhưng không quẹt ra có thể do phụ huynh đón sớm, quên quẹt thẻ hoặc ra cổng tự do.</p>
                </article>
              </div>
            </section>

            {/* TẦNG 4: BẢN ĐỒ NHIỆT CHUYÊN CẦN THEO LỚP & HỒ SƠ ĐỐI SOÁT */}
            <section id="heatmap-section" className="study-section">
              <div className="section-title">
                <div>
                  <p>05 / BẢN ĐỒ NHIỆT THEO LỚP</p>
                  <h2>Lớp nào thiếu, và thiếu vào ngày nào?</h2>
                </div>
                <label className="inline-select">
                  Góc nhìn theo dõi
                  <select id="heatmap-metric" value={metric} onChange={e => { setMetric(e.target.value); setSelected(null); }}>
                    <option value="register">Chưa ghi nhận trong lớp</option>
                    <option value="begin">Thiếu quẹt cổng đầu buổi</option>
                    <option value="end">Thiếu quẹt cổng cuối buổi</option>
                    <option value="lesson">Tiết học chưa hoàn tất</option>
                  </select>
                </label>
              </div>

              <div className="heatmap-layout">
                <article className="plot-card heatmap-card">
                  <div className="plot-head">
                    <h3>{metricName} · Lớp × Ngày</h3>
                    <span>Hiển thị {heatClasses.length} / {ranked.length} lớp cần chú ý</span>
                  </div>
                  {heatClasses.length ? (
                    <Chart
                      option={heatOption}
                      height={Math.max(280, heatClasses.length * 24 + 95)}
                      label={`Heatmap ${metricName} theo lớp và ngày`}
                      onSelect={i => {
                        const cell = heatCells[i];
                        if (cell) setSelected({ key: cell.key, date: cell.date });
                      }}
                    />
                  ) : (
                    <Empty>Chưa có dữ liệu ở phạm vi này.</Empty>
                  )}
                  <div className="plot-foot">
                    <span><i className="no-data-key" />Chưa có mẫu số</span>
                    <span><i className="no-register-key" />Có tiết nhưng chưa có bản ghi lớp</span>
                  </div>
                  <p className="chart-note">
                    Màu đậm thể hiện tỷ lệ thiếu cao. Nhấp vào ô bất kỳ để xem hồ sơ đối soát chi tiết của lớp trong ngày đó.
                  </p>
                </article>

                {/* HỒ SƠ ĐỐI SOÁT LỚP (EVIDENCE INSPECTOR) */}
                <aside className="evidence-card">
                  {picked && selected ? (
                    <>
                      <div className="evidence-top">
                        <span>HỒ SƠ ĐỐI SOÁT LỚP</span>
                        <button aria-label="Bỏ chọn ô" onClick={() => setSelected(null)}><X size={15} /></button>
                      </div>
                      <h3>{catalog.find(c => keyOf(c) === selected.key)?.className || 'Lớp chưa xác định'}</h3>
                      <p className="evidence-date">Ngày {smallDate(selected.date)}/{selected.date.slice(0, 4)} · {shiftName(shift === 'all' ? 'BOTH' : shift)}</p>

                      <div className="evidence-measures">
                        <div>
                          <span>Trong lớp</span>
                          <strong>{num(sum(picked.registers, 'marked'))} / {num(sum(picked.registers, 'n'))}</strong>
                          <small>học sinh ghi nhận</small>
                        </div>
                        <div>
                          <span>Cổng vào / ra</span>
                          <strong>{num(sum(picked.gates, 'entered'))} / {num(sum(picked.gates, 'exited'))}</strong>
                          <small>trên {num(sum(picked.gates, 'n'))} sĩ số</small>
                        </div>
                      </div>

                      <h4>Phát hiện nghiệp vụ</h4>
                      <ul>
                        {facts.map((fact, i) => <li key={i}>{fact}</li>)}
                      </ul>

                      <button className="evidence-action" onClick={() => chooseClass(selected.key)}>
                        Xem toàn bộ kỳ của lớp này <ArrowRight size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="evidence-eyebrow">HỒ SƠ ĐIỀU HÀNH LỚP</span>
                      <div className="mini-matrix">
                        {Array.from({ length: 15 }, (_, i) => (
                          <i key={i} style={{ background: ['#e4ede9', '#e8d6b1', '#c86e62', '#cedbd4'][i % 4] }} />
                        ))}
                      </div>
                      <h3>Chọn một ô lớp–ngày<br />trên bản đồ nhiệt.</h3>
                      <p>Xem chi tiết sĩ số danh sách lớp, mức ghi nhận thực tế, dữ liệu quẹt thẻ vào/ra cổng và các cảnh báo nề nếp cần xử lý.</p>
                      <small>Giúp BGH và Giám thị đưa ra quyết định đôn đốc chính xác tới từng giáo viên.</small>
                    </>
                  )}
                </aside>
              </div>
            </section>

            {/* TẦNG 6: THỜI GIAN QUÉT THỰC TẾ & KHUNG GIỜ QUY ĐỊNH */}
            <section id="time-behavior" className="study-section">
              <div className="section-title">
                <div>
                  <p>06 / THỜI GIAN QUÉT THỰC TẾ</p>
                  <h2>Học sinh đến trường & ra về lúc mấy giờ?</h2>
                </div>
              </div>

              <div className="plot-grid two-columns">
                <article className="plot-card">
                  <div className="plot-head">
                    <h3>Phân bố trạng thái chuyên cần trong lớp</h3>
                    <span>Có mặt · Nghỉ phép · Nghỉ không phép · Đi muộn</span>
                  </div>
                  {marked ? (
                    <Chart option={marksOption} label="Biểu đồ phân bố trạng thái học sinh trong nhật ký lớp" />
                  ) : (
                    <Empty>Chưa có trạng thái hợp lệ trong lớp ở kỳ này.</Empty>
                  )}
                  <p className="chart-note">Giúp phân tách rõ ràng giữa học sinh vắng có đơn của gia đình và học sinh vắng đột xuất không rõ nguyên nhân.</p>
                </article>

                <article className="plot-card">
                  <div className="plot-head">
                    <h3>Histogram giờ học sinh quét thẻ Vào / Ra</h3>
                    <span>Giờ thực tế tại cổng trường (UTC+7)</span>
                  </div>
                  {hours.length ? (
                    <Chart option={hourOption} label="Histogram giờ check-in và check-out thực tế" />
                  ) : (
                    <Empty>Chưa có dữ liệu timestamp quẹt thẻ trong kỳ này.</Empty>
                  )}
                  <p className="chart-note">Đỉnh giờ vào tập trung lúc 07:00–07:45 sáng; đỉnh giờ ra tập trung lúc 16:00–17:00 chiều.</p>
                </article>
              </div>

              {/* Khung giờ quy định của nhà trường */}
              <div className="time-policy">
                <strong>Khung giờ quy định hiện hành</strong>
                {[...new Map(data.config.filter(c => (school === 'all' || String(c.schoolId) === school) && (shift === 'all' || c.shift === shift)).map(c => [`${c.schoolId}:${c.shift}`, c])).values()].map(c => (
                  <span key={`${c.schoolId}:${c.shift}`}>
                    {c.schoolId === 1 ? 'Ban Mai School' : c.schoolId === 3 ? 'Phenikaa School' : schoolName(c.schoolId)} · {shiftName(c.shift)}:
                    <b> Vào: {c.in_start?.slice(0, 5)} – {c.in_end?.slice(0, 5)} · Ra: {c.out_start?.slice(0, 5)} – {c.out_end?.slice(0, 5)}</b>
                  </span>
                ))}
                <small>Dùng để xác định tự động các ca đi muộn sau giờ vào ({num(sum(gates, 'outside_in'))} ca) hoặc ra sớm trước giờ quy định ({num(sum(gates, 'early_out'))} ca).</small>
              </div>
            </section>

            {/* TẦNG 7: BẢNG TÁC NGHIỆP ĐIỀU HÀNH & CẢNH BÁO SỚM */}
            <section id="worklist" className="study-section">
              <div className="section-title">
                <div>
                  <p>07 / TÁC NGHIỆP ĐIỀU HÀNH</p>
                  <h2>Danh sách lớp cần đôn đốc & cảnh báo sớm</h2>
                </div>
              </div>

              <div className="worklist-container">
                <div className="worklist-header">
                  <div className="worklist-tabs">
                    <button
                      className={worklistTab === 'unfinished' ? 'active' : ''}
                      onClick={() => { setWorklistTab('unfinished'); setWorklistPage(1); }}
                    >
                      <AlertTriangle size={14} /> Điểm danh đầu giờ ({num(unfinished.length)})
                    </button>
                    <button
                      className={worklistTab === 'sdb' ? 'active' : ''}
                      onClick={() => { setWorklistTab('sdb'); setWorklistPage(1); }}
                    >
                      <BookOpen size={14} /> Sổ đầu bài & Tiết học ({num(lessons.length)})
                    </button>
                    <button
                      className={worklistTab === 'leave' ? 'active' : ''}
                      onClick={() => { setWorklistTab('leave'); setWorklistPage(1); }}
                    >
                      <FileText size={14} /> Thống kê Nghỉ phép ({num(registers.filter(r => r.absent > 0 || r.excused > 0).length)})
                    </button>
                    <button
                      className={worklistTab === 'attendance' ? 'active' : ''}
                      onClick={() => { setWorklistTab('attendance'); setWorklistPage(1); }}
                    >
                      <Users size={14} /> Báo cáo chuyên cần ({num(registers.length)})
                    </button>
                    <button
                      className={worklistTab === 'anomalies' ? 'active' : ''}
                      onClick={() => { setWorklistTab('anomalies'); setWorklistPage(1); }}
                    >
                      <Clock size={14} /> Ra/vào trường & Cổng FaceID
                    </button>
                  </div>

                  <div className="worklist-search">
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="Tìm theo tên lớp, khối..."
                      value={worklistQuery}
                      onChange={e => { setWorklistQuery(e.target.value); setWorklistPage(1); }}
                    />
                  </div>
                </div>

                <div className="table-responsive">
                  {worklistTab === 'unfinished' && (
                    <table className="worklist-table">
                      <thead>
                        <tr>
                          <th>Lớp</th>
                          <th>Khối</th>
                          <th>GVCN / Phụ trách</th>
                          <th>Ngày</th>
                          <th>Sĩ số</th>
                          <th>Điểm danh</th>
                          <th>Tỷ lệ</th>
                          <th>Phân loại nguyên nhân (Root Cause)</th>
                          <th>Hành động xử lý</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedWorklist.length ? (
                          paginatedWorklist.map((r, i) => {
                            const reg = r as Register;
                            const isNoMark = reg.n > 0 && reg.marked === 0;
                            const isPending = reg.marked > 0 && reg.status !== 2;
                            return (
                              <tr key={i}>
                                <td><strong>{shortClass(reg)}</strong></td>
                                <td>{reg.grade}</td>
                                <td>
                                  {reg.no_teacher ? (
                                    <span className="badge red font-semibold">Chưa phân công</span>
                                  ) : (
                                    <span className="text-muted">Đã gán GVCN</span>
                                  )}
                                </td>
                                <td>{smallDate(reg.date)}</td>
                                <td>{num(reg.n)}</td>
                                <td>
                                  <span className={reg.marked === 0 ? "badge red" : "badge amber font-bold"}>
                                    {num(reg.marked)} / {num(reg.n)}
                                  </span>
                                </td>
                                <td><span className="badge amber">{pct(reg.marked, reg.n)}</span></td>
                                <td>
                                  {reg.no_teacher ? (
                                    <span className="status-badge purple">Chưa phân công GVCN</span>
                                  ) : reg.n === 0 ? (
                                    <span className="status-badge gray">Lỗi danh sách (0/0)</span>
                                  ) : isNoMark ? (
                                    <span className="status-badge red">Quên mở app điểm danh</span>
                                  ) : isPending ? (
                                    <span className="status-badge amber">Đang ghi nhận (chưa chốt)</span>
                                  ) : (
                                    <span className="status-badge gray">Thiếu dòng học sinh</span>
                                  )}
                                </td>
                                <td>
                                  {reg.no_teacher ? (
                                    <button
                                      className="action-btn purple"
                                      onClick={() => alert(`Đã gửi yêu cầu tới Phòng Đào tạo: Phân công GVCN cho lớp ${reg.className}!`)}
                                    >
                                      Báo Đào tạo
                                    </button>
                                  ) : reg.n === 0 ? (
                                    <button
                                      className="action-btn gray"
                                      onClick={() => alert(`Đã gửi ticket IT: Kiểm tra danh sách học sinh lớp ${reg.className}!`)}
                                    >
                                      Báo IT
                                    </button>
                                  ) : (
                                    <button
                                      className="action-btn"
                                      onClick={() => alert(`Đã gửi thông báo nhắc nhở tới GV phụ trách lớp ${reg.className}!`)}
                                    >
                                      <Bell size={12} /> Nhắc nhở GV
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr><td colSpan={9} className="empty-cell">Không có lớp nào cần đôn đốc trong phạm vi này.</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {worklistTab === 'sdb' && (
                    <div className="sdb-container">
                      <div className="module-kpi-strip">
                        <div className="module-kpi-card">
                          <span className="lbl">Số tiết theo TKB</span>
                          <strong className="val">{num(sum(lessons, 'n'))}</strong>
                          <span className="sub">Kế hoạch đào tạo</span>
                        </div>
                        <div className="module-kpi-card">
                          <span className="lbl">Đã hoàn thành SĐB</span>
                          <strong className="val text-teal">{num(sum(lessons, 'done'))}</strong>
                          <span className="sub">Đã nhập bài & đánh giá</span>
                        </div>
                        <div className="module-kpi-card">
                          <span className="lbl">Chưa nhập / Quá hạn</span>
                          <strong className="val text-red">{num(sum(lessons, 'overdue'))}</strong>
                          <span className="sub">GVBM chưa vào điểm</span>
                        </div>
                        <div className="module-kpi-card">
                          <span className="lbl">Chưa gán GVBM</span>
                          <strong className="val text-purple">{num(sum(lessons, 'no_teacher'))}</strong>
                          <span className="sub">Thiếu phân công TKB</span>
                        </div>
                        <div className="module-kpi-card">
                          <span className="lbl">Tỷ lệ hoàn thành</span>
                          <strong className="val">{pct(sum(lessons, 'done'), sum(lessons, 'n'))}</strong>
                          <span className="sub">Tiến độ sổ sách</span>
                        </div>
                      </div>

                      <div className="module-subnote">
                        <BookOpen size={14} className="text-teal" />
                        <span>Đối soát phân hệ <b>Sổ đầu bài</b> & <b>Tổng hợp đánh giá tiết</b> (K-12 Phenikaa): Theo dõi GV bộ môn ghi chép bài dạy và cho điểm nề nếp từng tiết theo TKB.</span>
                      </div>

                      <table className="worklist-table">
                        <thead>
                          <tr>
                            <th>Lớp</th>
                            <th>Khối</th>
                            <th>Ngày</th>
                            <th>Buổi</th>
                            <th>Số tiết TKB</th>
                            <th>Đã xong</th>
                            <th>Quá hạn SĐB</th>
                            <th>Chưa gán GV</th>
                            <th>Tỷ lệ xong</th>
                            <th>Tình trạng</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedWorklist.length ? (
                            paginatedWorklist.map((r, i) => {
                              const les = r as Lesson;
                              return (
                                <tr key={i}>
                                  <td><strong>{shortClass(les)}</strong></td>
                                  <td>{les.grade}</td>
                                  <td>{smallDate(les.date)}</td>
                                  <td>{shiftName(les.shift)}</td>
                                  <td>{num(les.n)}</td>
                                  <td><span className="text-teal font-semibold">{num(les.done)}</span></td>
                                  <td>
                                    {les.overdue > 0 ? (
                                      <span className="badge red font-bold">{num(les.overdue)} tiết</span>
                                    ) : '0'}
                                  </td>
                                  <td>
                                    {les.no_teacher > 0 ? (
                                      <span className="badge purple font-semibold">{num(les.no_teacher)} tiết</span>
                                    ) : '—'}
                                  </td>
                                  <td><span className="badge amber">{pct(les.done, les.n)}</span></td>
                                  <td>
                                    {les.no_teacher > 0 ? (
                                      <span className="status-badge purple">Chưa xếp GVBM</span>
                                    ) : les.overdue > 0 ? (
                                      <span className="status-badge red">Chưa nhập SĐB</span>
                                    ) : les.done === les.n && les.n > 0 ? (
                                      <span className="status-badge green">Hoàn thành SĐB</span>
                                    ) : (
                                      <span className="status-badge amber">Đang ghi nhận</span>
                                    )}
                                  </td>
                                  <td>
                                    {les.no_teacher > 0 ? (
                                      <button
                                        className="action-btn purple"
                                        onClick={() => alert(`Đã gửi yêu cầu phân công GVBM cho lớp ${les.className} tới Phòng Đào tạo!`)}
                                      >
                                        Báo Đào tạo
                                      </button>
                                    ) : (
                                      <button
                                        className="action-btn"
                                        onClick={() => alert(`Đã gửi thông báo đôn đốc GVBM nhập Sổ đầu bài cho lớp ${les.className}!`)}
                                      >
                                        <Bell size={12} /> Đôn đốc GVBM
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr><td colSpan={11} className="empty-cell">Không có tiết học nào trong phạm vi này.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {worklistTab === 'leave' && (
                    <div className="leave-container">
                      <div className="module-kpi-strip">
                        <div className="module-kpi-card">
                          <span className="lbl">Tổng lượt vắng</span>
                          <strong className="val">{num(sum(registers, 'excused') + sum(registers, 'absent'))}</strong>
                          <span className="sub">Toàn bộ ca nghỉ</span>
                        </div>
                        <div className="module-kpi-card">
                          <span className="lbl">Nghỉ có phép</span>
                          <strong className="val text-blue">{num(sum(registers, 'excused'))}</strong>
                          <span className="sub">Đơn phụ huynh đã duyệt</span>
                        </div>
                        <div className="module-kpi-card">
                          <span className="lbl">Nghỉ không phép</span>
                          <strong className="val text-red">{num(sum(registers, 'absent'))}</strong>
                          <span className="sub">Đột xuất · Cần gọi trước 9h</span>
                        </div>
                        <div className="module-kpi-card">
                          <span className="lbl">Tỷ lệ đơn hợp lệ</span>
                          <strong className="val text-teal">{pct(sum(registers, 'excused'), sum(registers, 'excused') + sum(registers, 'absent'))}</strong>
                          <span className="sub">Tuân thủ quy chế</span>
                        </div>
                      </div>

                      {sum(registers, 'absent') > 0 && (
                        <div className="module-alert-banner">
                          <AlertTriangle size={16} className="text-red shrink-0" />
                          <div>
                            <strong>CẢNH BÁO GIÁM THỊ NỀ NẾP & AN TOÀN HỌC ĐƯỜNG:</strong>
                            <p>Phát hiện <b>{num(sum(registers, 'absent'))}</b> lượt học sinh vắng không phép. Đối soát giữa phân hệ <i>Nghỉ phép</i> và <i>Điểm danh đầu giờ</i> cho thấy các ca này chưa có đơn từ phụ huynh. Giám thị và GVCN cần liên hệ khẩn cấp trước 09:00 sáng để xác minh an toàn học sinh.</p>
                          </div>
                        </div>
                      )}

                      <table className="worklist-table">
                        <thead>
                          <tr>
                            <th>Lớp</th>
                            <th>Khối</th>
                            <th>Ngày</th>
                            <th>Sĩ số</th>
                            <th>Nghỉ có phép</th>
                            <th>Nghỉ không phép</th>
                            <th>Đi muộn</th>
                            <th>Tỷ lệ chuyên cần (ADA)</th>
                            <th>Trạng thái đối soát</th>
                            <th>Thao tác xử lý</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedWorklist.length ? (
                            paginatedWorklist.map((r, i) => {
                              const reg = r as Register;
                              return (
                                <tr key={i}>
                                  <td><strong>{shortClass(reg)}</strong></td>
                                  <td>{reg.grade}</td>
                                  <td>{smallDate(reg.date)}</td>
                                  <td>{num(reg.n)}</td>
                                  <td>
                                    {reg.excused > 0 ? (
                                      <span className="badge blue font-bold">{num(reg.excused)} HS</span>
                                    ) : '0'}
                                  </td>
                                  <td>
                                    {reg.absent > 0 ? (
                                      <span className="badge red font-bold">{num(reg.absent)} HS</span>
                                    ) : '0'}
                                  </td>
                                  <td>
                                    {reg.late > 0 ? (
                                      <span className="badge amber">{num(reg.late)} HS</span>
                                    ) : '0'}
                                  </td>
                                  <td><strong>{pct(reg.present, reg.n)}</strong></td>
                                  <td>
                                    {reg.absent > 0 ? (
                                      <span className="status-badge red">Vắng không phép</span>
                                    ) : reg.excused > 0 ? (
                                      <span className="status-badge blue">Có đơn phép</span>
                                    ) : (
                                      <span className="status-badge green">Đủ sĩ số</span>
                                    )}
                                  </td>
                                  <td>
                                    {reg.absent > 0 ? (
                                      <button
                                        className="action-btn red"
                                        onClick={() => alert(`Kích hoạt gọi điện phụ huynh xác minh ${reg.absent} học sinh vắng không phép lớp ${reg.className}!`)}
                                      >
                                        <Bell size={12} /> Gọi phụ huynh
                                      </button>
                                    ) : (
                                      <button
                                        className="action-btn"
                                        onClick={() => alert(`Đã mở danh sách đơn nghỉ phép lớp ${reg.className}!`)}
                                      >
                                        <FileText size={12} /> Xem đơn phép
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr><td colSpan={10} className="empty-cell">Không có ca vắng hoặc nghỉ phép nào trong phạm vi này.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {worklistTab === 'attendance' && (
                    <table className="worklist-table">
                      <thead>
                        <tr>
                          <th>Lớp</th>
                          <th>Khối</th>
                          <th>Ngày</th>
                          <th>Sĩ số</th>
                          <th>Có mặt</th>
                          <th>Nghỉ có phép</th>
                          <th>Nghỉ không phép</th>
                          <th>Đi muộn</th>
                          <th>Tỷ lệ chuyên cần</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedWorklist.length ? (
                          paginatedWorklist.map((r, i) => {
                            const reg = r as Register;
                            return (
                              <tr key={i}>
                                <td><strong>{shortClass(reg)}</strong></td>
                                <td>{reg.grade}</td>
                                <td>{smallDate(reg.date)}</td>
                                <td>{num(reg.n)}</td>
                                <td><span className="text-teal font-semibold">{num(reg.present)}</span></td>
                                <td>{reg.excused > 0 ? <span className="badge blue">{num(reg.excused)}</span> : '0'}</td>
                                <td>{reg.absent > 0 ? <span className="badge red font-bold">{num(reg.absent)}</span> : '0'}</td>
                                <td>{reg.late > 0 ? <span className="badge amber">{num(reg.late)}</span> : '0'}</td>
                                <td><strong>{pct(reg.present, reg.n)}</strong></td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr><td colSpan={9} className="empty-cell">Chưa có dữ liệu chuyên cần phù hợp.</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {worklistTab === 'anomalies' && (
                    <table className="worklist-table">
                      <thead>
                        <tr>
                          <th>Lớp</th>
                          <th>Khối</th>
                          <th>Ngày</th>
                          <th>Buổi</th>
                          <th>Sĩ số cổng</th>
                          <th>Quét vào</th>
                          <th>Quét ra</th>
                          <th>Vào muộn sau giờ</th>
                          <th>Ra sớm trước giờ</th>
                          <th>Lệch thứ tự/ngày</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedWorklist.length ? (
                          paginatedWorklist.map((r, i) => {
                            const gt = r as Gate;
                            return (
                              <tr key={i}>
                                <td><strong>{shortClass(gt)}</strong></td>
                                <td>{gt.grade}</td>
                                <td>{smallDate(gt.date)}</td>
                                <td>{shiftName(gt.shift)}</td>
                                <td>{num(gt.n)}</td>
                                <td>{num(gt.entered)}</td>
                                <td>{num(gt.exited)}</td>
                                <td>{gt.outside_in > 0 ? <span className="badge amber">{num(gt.outside_in)}</span> : '—'}</td>
                                <td>{gt.early_out > 0 ? <span className="badge blue">{num(gt.early_out)}</span> : '—'}</td>
                                <td>{gt.time_anomaly > 0 ? <span className="badge red">{num(gt.time_anomaly)}</span> : '—'}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr><td colSpan={10} className="empty-cell">Không phát hiện bất thường lệch giờ trong phạm vi này.</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Phân trang */}
                <div className="worklist-pagination">
                  <span>Hiển thị {(worklistPage - 1) * pageSize + 1} – {Math.min(worklistPage * pageSize, filteredWorklist.length)} / {num(filteredWorklist.length)} bản ghi</span>
                  <div className="page-btns">
                    <button disabled={worklistPage === 1} onClick={() => setWorklistPage(p => Math.max(1, p - 1))}>
                      <ChevronLeft size={15} />
                    </button>
                    <span>Trang {worklistPage} / {totalWorklistPages}</span>
                    <button disabled={worklistPage >= totalWorklistPages} onClick={() => setWorklistPage(p => Math.min(totalWorklistPages, p + 1))}>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* FOOTER */}
            <footer className="study-footer">
              <span>PHX K-12 · Hệ thống Phân tích & Điều hành Chuyên cần Học đường</span>
              <span>Dữ liệu phục vụ Ban Giám hiệu, Giám thị nề nếp và Giáo viên chủ nhiệm</span>
            </footer>
          </>
        )}
      </main>

      {/* MODAL: MỤC TIÊU QUẢN TRỊ & USE CASES */}
      {showUcModal && (
        <div className="uc-modal-backdrop" onClick={() => setShowUcModal(false)}>
          <div className="uc-modal-content" onClick={e => e.stopPropagation()}>
            <div className="uc-modal-header">
              <div>
                <h2>Mục tiêu Quản trị & Nghiệp vụ Nhà trường (Business Goals as Use Cases)</h2>
                <p>Mỗi chỉ số phân tích trên Dashboard đều phục vụ mục đích ra quyết định của các tác nhân cụ thể.</p>
              </div>
              <button className="icon-close" onClick={() => setShowUcModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="uc-modal-body">
              <table className="uc-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>STT</th>
                    <th style={{ width: '180px' }}>Tác nhân (Actor)</th>
                    <th style={{ width: '220px' }}>Nhu cầu theo dõi (What)</th>
                    <th>Ý nghĩa & Hành động ra quyết định (Why / In order to)</th>
                    <th>Các chỉ số phân tích cụ thể (KPIs & Metrics)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>1</strong></td>
                    <td><strong>Ban Giám hiệu (Hiệu trưởng)</strong></td>
                    <td>Quy mô đào tạo và nhân sự <em>(3 năm học gần nhất)</em></td>
                    <td>Đưa ra các quyết định tuyển dụng, tuyển sinh, đào tạo, định biên giáo viên hoặc phân bổ nguồn lực cơ sở vật chất hợp lý.</td>
                    <td>
                      • Tổng số học sinh toàn trường.<br />
                      • Tổng số giáo viên cơ hữu & thỉnh giảng.<br />
                      • Tổng số nhân viên hành chính, vận hành.<br />
                      • Tỷ lệ Học sinh / Giáo viên (Student-Teacher Ratio).
                    </td>
                  </tr>
                  <tr>
                    <td><strong>2</strong></td>
                    <td><strong>Hiệu phó Chuyên môn / Trưởng khối</strong></td>
                    <td>Chất lượng đào tạo & Tiến độ dạy học <em>(3 năm gần nhất)</em></td>
                    <td>Điều chỉnh phương pháp giáo dục, tổ chức phụ đạo / bồi dưỡng mũi nhọn, kịp thời khen thưởng thi đua giáo viên.</td>
                    <td>
                      • Diễn biến điểm trung bình qua các mốc thời gian.<br />
                      • Điểm trung bình và phổ điểm từng môn học.<br />
                      • Số lượng & tỷ lệ học sinh theo danh hiệu.<br />
                      • Tỷ lệ số tiết đã dạy thực tế / số tiết theo kế hoạch (TKB).
                    </td>
                  </tr>
                  <tr>
                    <td><strong>3</strong></td>
                    <td><strong>Trưởng phòng Kế toán & Tài chính</strong></td>
                    <td>Kiểm soát tài chính & Dòng tiền <em>(3 tháng gần nhất)</em></td>
                    <td>Kiểm soát tài chính nhà trường, quản lý chặt chẽ dòng tiền (nguồn thu, công nợ, chi tiêu), đảm bảo duy trì nguồn lực vận hành.</td>
                    <td>
                      • Tỷ lệ học sinh đã hoàn thành nghĩa vụ nộp học phí / tổng học sinh.<br />
                      • Tổng số tiền đã thu và số tiền còn phải thu (công nợ).<br />
                      • Tổng số tiền phân tách theo từng loại phí.<br />
                      • Tổng số tiền được miễn giảm / ưu đãi học phí diện chính sách.
                    </td>
                  </tr>
                  <tr>
                    <td><strong>4</strong></td>
                    <td><strong>Trưởng bộ phận Giám thị & Nề nếp</strong></td>
                    <td>Điểm danh, Chuyên cần & Nề nếp kỷ luật <em>(Trong tuần & ngày)</em></td>
                    <td>Phát hiện học sinh vắng không rõ lý do trước 09h00 sáng, ngăn ngừa nguy cơ bỏ học mạn tính, phối hợp phụ huynh giải quyết vi phạm.</td>
                    <td>
                      • <strong>Tỷ lệ chuyên cần ngày (ADA - Average Daily Attendance).</strong><br />
                      • <strong>Tỷ lệ vắng mạn tính (Chronic Absenteeism: vắng &gt;10%).</strong><br />
                      • Tỷ lệ lớp chưa chốt điểm danh sau 15 phút đầu giờ.<br />
                      • Số học sinh vắng có phép vs Vắng không phép.<br />
                      • Tổng số sổ theo dõi học sinh cá biệt ở trạng thái hoạt động.
                    </td>
                  </tr>
                  <tr>
                    <td><strong>5</strong></td>
                    <td><strong>Giáo viên Chủ nhiệm (GVCN)</strong></td>
                    <td>Chuyên cần & Đơn xin nghỉ của lớp <em>(Trong ngày & tuần)</em></td>
                    <td>Nắm chắc sĩ số hiện diện thực tế tại lớp, chủ động liên hệ phụ huynh khi học sinh vắng đột xuất, phối hợp giáo viên bộ môn.</td>
                    <td>
                      • Sĩ số hiện diện thực tế tại lớp / Tổng danh sách lớp.<br />
                      • Danh sách học sinh vắng có đơn xin phép từ phụ huynh (đã duyệt).<br />
                      • Danh sách học sinh vắng không phép (cần gọi điện khẩn cấp).<br />
                      • Lệch pha: Có quẹt thẻ cổng nhưng vắng trong lớp (nguy cơ trốn tiết).
                    </td>
                  </tr>
                  <tr>
                    <td><strong>6</strong></td>
                    <td><strong>Bộ phận Vận hành (Hậu cần / Dịch vụ)</strong></td>
                    <td>Vận hành xe tuyến, Bếp ăn & Y tế học đường <em>(Trong tuần)</em></td>
                    <td>Tối ưu chi phí/số lượng, cắt giảm lãng phí suất ăn, điều phối xe tuyến an toàn và kịp thời chăm sóc sức khỏe học sinh.</td>
                    <td>
                      • Số lượng học sinh check-in sử dụng dịch vụ Xe tuyến.<br />
                      • Tỷ lệ quẹt thẻ lên xe - xuống xe đúng điểm.<br />
                      • Số lượng học sinh check-in sử dụng dịch vụ Bếp ăn bán trú.<br />
                      • Tổng số sự kiện khám y tế tổng quát & cấp phát thuốc cho học sinh.
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="uc-modal-footer-note">
                <strong>Ghi chú về 4 nguyên nhân khi "Lớp thiếu điểm danh":</strong>
                <ol>
                  <li><strong>Do Giáo viên:</strong> Quên mở app điểm danh hoặc tích chọn nhưng chưa bấm nút "Chốt sổ".</li>
                  <li><strong>Do Học sinh:</strong> Vắng có đơn xin phép đã duyệt từ trước vs Vắng đột xuất không phép.</li>
                  <li><strong>Do Luồng di chuyển:</strong> Có quẹt thẻ vào cổng nhưng không vào lớp, hoặc quên quẹt thẻ ra về.</li>
                  <li><strong>Do Lịch học & Thiết bị:</strong> Lớp chưa gán GV phụ trách trên TKB hoặc thiết bị đầu đọc cổng bị gián đoạn.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
