export type RecordBookItem = {
  status: string; // 'DA_NHAP', 'CHUA_NHAP', etc.
  date: string | null;
  records: number;
};

export type EvaluationScoreItem = {
  criteria: string;
  level: string;
  score: number | null;
  records: number;
};

export type QualityIssueItem = {
  issueCode: string;
  title: string;
  records: number;
  category: 'critical' | 'warning' | 'info';
  action: string;
};

export type AssignmentStatusItem = {
  status: string;
  label: string;
  finished: boolean;
  records: number;
  percentage: number;
};

export type WorkTypeItem = {
  name: string;
  salaryStatus: string;
  unitName: string;
  records: number;
};

export type AttendanceDashboardData = {
  schools: { id: number; name: string }[];
  summary: {
    totalRecordBook: number;
    completedRecordBook: number;
    pendingRecordBook: number;
    recordBookRate: number;

    totalAssignments: number;
    completedAssignments: number;
    dueAssignments: number;
    effectiveAssignmentRate: number;
    futureAssignments: number;
    exemptAssignments: number;
    offAssignments: number;
    assignmentRate: number;

    totalEvaluations: number;
    avgScore: number | null;

    totalQualityIssues: number;
    criticalIssues: number;
  };
  recordBookBreakdown: RecordBookItem[];
  evaluationScores: EvaluationScoreItem[];
  qualityIssues: QualityIssueItem[];
  assignmentBreakdown: AssignmentStatusItem[];
  workTypeBreakdown: WorkTypeItem[];
  updatedAt: string | null;
  scope: {
    schoolId: number | null;
    from: string | null;
    to: string | null;
    undatedAssignments: number;
    undatedRecordBooks: number;
  };
};

export type AttendanceFilters = { schoolId?: number; from?: string; to?: string };

export function parseDateRange(from?: string, to?: string): Pick<AttendanceFilters, 'from' | 'to'> {
  for (const value of [from, to]) {
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) {
      throw new RangeError('Invalid calendar date');
    }
  }
  if (from && to && from > to) throw new RangeError('Invalid date range');
  return { from: from || undefined, to: to || undefined };
}

export const STATUS_LABELS: Record<string, string> = {
  HOAN_THANH: 'Đã hoàn thành', DEN_GIO: 'Đến giờ, chờ điểm danh', TRONG_TIET: 'Đang trong tiết',
  OFF: 'Phân công báo nghỉ', KHONG_CHAM_TIET: 'Miễn chấm tiết', CHUA_DEN_GIO: 'Chưa đến giờ',
  CHUA_XAC_DINH: 'Chưa rõ trạng thái',
};

export function getAssignmentAction(row: AssignmentStatusItem): { text: string; priority: number } {
  if (row.status === 'HOAN_THANH' && !row.finished) return { text: 'Kiểm tra xác nhận kết thúc tiết.', priority: 1 };
  if (['DEN_GIO', 'TRONG_TIET'].includes(row.status)) return {
    text: row.finished ? 'Đối chiếu trạng thái với xác nhận kết thúc.' : 'Theo dõi và cập nhật điểm danh trên hệ thống nguồn.', priority: 2,
  };
  if (row.status === 'CHUA_XAC_DINH' || !STATUS_LABELS[row.status]) return { text: 'Xác minh trạng thái phân công.', priority: 1 };
  if (row.status === 'KHONG_CHAM_TIET' && row.finished) return { text: 'Đối chiếu quy tắc miễn chấm và cờ kết thúc.', priority: 3 };
  if (row.status === 'HOAN_THANH') return { text: 'Đã ghi nhận trạng thái và xác nhận kết thúc.', priority: 5 };
  if (row.status === 'OFF') return { text: 'Đối chiếu trạng thái báo nghỉ của phân công.', priority: 4 };
  return { text: 'Theo dõi theo lịch phân công.', priority: 5 };
}

export function monthlyRecordBooks(rows: RecordBookItem[]) {
  const values = new Map<string, { done: number; pending: number; total: number }>();
  let undated = 0;
  for (const row of rows) {
    if (!row.date) { undated += row.records; continue; }
    const key = row.date.slice(0, 7);
    const item = values.get(key) ?? { done: 0, pending: 0, total: 0 };
    item[row.status === 'DA_NHAP' ? 'done' : 'pending'] += row.records;
    item.total += row.records;
    values.set(key, item);
  }
  const keys = [...values.keys()].sort();
  const months = [];
  if (keys.length) {
    const [y, m] = keys[0].split('-').map(Number);
    const end = keys[keys.length - 1];
    const cursor = new Date(Date.UTC(y, m - 1, 1));
    while (cursor.toISOString().slice(0, 7) <= end) {
      const key = cursor.toISOString().slice(0, 7);
      months.push({ key, ...(values.get(key) ?? { done: 0, pending: 0, total: 0 }) });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return { months, undated };
}

export function chartScale(maximum: number) {
  if (maximum <= 0) return { upper: 1, ticks: [0, 1] };
  const magnitude = 10 ** Math.floor(Math.log10(maximum / 4));
  const step = [1, 2, 5, 10].map((n) => n * magnitude).find((n) => n >= maximum / 4) ?? magnitude * 10;
  const interval = Math.max(1, step);
  const upper = Math.ceil(maximum / interval) * interval;
  return { upper, ticks: Array.from({ length: Math.round(upper / interval) + 1 }, (_, i) => i * interval) };
}

export function parseSchoolFilter(value?: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const id = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
    throw new RangeError('Invalid school identifier');
  }
  return id;
}

export function isMartHealthy(rows: number, generations: number, ageSeconds: number): boolean {
  return Number.isFinite(rows) && rows > 0 && generations === 1 &&
    Number.isFinite(ageSeconds) && ageSeconds >= 0 && ageSeconds <= 900;
}

export const QUALITY_RULES_DICT: Record<string, { title: string; category: 'critical' | 'warning' | 'info'; action: string }> = {
  record_book_missing_active_lesson_or_start: {
    title: 'Sổ đầu bài thiếu tiết học hợp lệ hoặc chưa có giờ bắt đầu',
    category: 'critical',
    action: 'Kiểm tra liên kết giữa sổ đầu bài và thời khóa biểu tiết học.',
  },
  assignment_missing_active_lesson_or_start: {
    title: 'Phân công tiết dạy thiếu tiết học hoặc giờ bắt đầu',
    category: 'critical',
    action: 'Rà soát cấu hình thời khóa biểu và phân công giáo viên.',
  },
  completed_status_finished_false: {
    title: 'Tiết báo hoàn thành nhưng cờ kết thúc chưa được xác nhận',
    category: 'warning',
    action: 'Đối chiếu trạng thái hoàn thành với xác nhận kết thúc tiết học.',
  },
  finished_true_incomplete_status: {
    title: 'Đã xác nhận kết thúc nhưng trạng thái tiết chưa hoàn thành',
    category: 'warning',
    action: 'Đồng bộ lại trạng thái điểm danh và sổ đầu bài của tiết học.',
  },
  exempt_status_finished_true: { title: 'Tiết miễn chấm có xác nhận kết thúc', category: 'warning', action: 'Xác minh quy tắc miễn chấm và cờ kết thúc của nhà trường.' },
  assignment_missing_active_type: { title: 'Phân công thiếu loại tiết hợp lệ', category: 'warning', action: 'Đối chiếu danh mục loại tiết và liên kết phân công.' },
  assignment_missing_active_unit: { title: 'Loại tiết thiếu đơn vị tính', category: 'warning', action: 'Kiểm tra danh mục đơn vị tính của loại tiết.' },
  assignment_null_status: { title: 'Phân công chưa có trạng thái', category: 'warning', action: 'Xác minh và bổ sung trạng thái trên hệ thống nguồn.' },
  multiple_active_configs: { title: 'Nhiều cấu hình cùng có hiệu lực', category: 'warning', action: 'Xác nhận cấu hình điểm danh được áp dụng cho trường.' },
  duplicate_active_type_code: { title: 'Trùng mã loại tiết đang dùng', category: 'warning', action: 'Kiểm tra mã và hiệu lực của danh mục loại tiết.' },
  evaluation_missing_active_assignment: { title: 'Đánh giá thiếu phân công hợp lệ', category: 'critical', action: 'Đối chiếu đánh giá với phân công của tiết học.' },
  evaluation_detail_missing_active_result: { title: 'Chi tiết đánh giá thiếu bản ghi cha', category: 'critical', action: 'Kiểm tra bản ghi đánh giá và liên kết chi tiết.' },
  evaluation_detail_missing_historical_criteria: { title: 'Thiếu tiêu chí đánh giá gốc', category: 'warning', action: 'Đối chiếu bộ tiêu chí đã dùng khi đánh giá.' },
  evaluation_uses_retired_criteria: { title: 'Đánh giá dùng tiêu chí đã ngừng áp dụng', category: 'info', action: 'Xác nhận đây là đánh giá lịch sử cần được giữ lại.' },
  evaluation_detail_invalid_score: { title: 'Điểm đánh giá chưa hợp lệ', category: 'warning', action: 'Xác minh giá trị và thang điểm của tiêu chí.' },
  missing_active_school: { title: 'Bản ghi thiếu trường hợp lệ', category: 'critical', action: 'Đối chiếu trường và hiệu lực của danh mục trường.' },
};

export function getQualityMeta(code: string) {
  return QUALITY_RULES_DICT[code] ?? {
    title: code.replaceAll('_', ' '),
    category: 'info' as const,
    action: 'Xác minh và đối soát thông tin trên hệ thống điểm danh.',
  };
}
