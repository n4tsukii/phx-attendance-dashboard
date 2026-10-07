import { getQualityMeta, STATUS_LABELS, type AttendanceDashboardData, type AttendanceFilters,
  type AssignmentStatusItem, type RecordBookItem, type EvaluationScoreItem, type WorkTypeItem } from './attendance-model.ts';

export type RawMartRow = {
  kind: string; school_id: number | null; school_name: string; event_date: string | null;
  category: string; detail: string; value: number | null; records: string | number; processed_at: string | null;
};

export function buildAttendanceDashboard(allRows: RawMartRow[], filters: AttendanceFilters): AttendanceDashboardData {
  const relevant = allRows.filter((r) => r.kind !== 'quality' ||
    (!r.category.startsWith('request_') && !r.category.startsWith('approved_request_')));
  const schools = new Map<number, string>();
  for (const row of relevant) if (row.school_id !== null) schools.set(row.school_id, row.school_name);
  const schoolRows = relevant.filter((r) => filters.schoolId === undefined || r.school_id === filters.schoolId);
  const hasDates = !!(filters.from || filters.to);
  const rows = schoolRows.filter((r) => !hasDates || (r.event_date !== null &&
    (!filters.from || r.event_date >= filters.from) && (!filters.to || r.event_date <= filters.to)));
  const summary: AttendanceDashboardData['summary'] = {
    totalRecordBook: 0, completedRecordBook: 0, pendingRecordBook: 0, recordBookRate: 0,
    totalAssignments: 0, completedAssignments: 0, dueAssignments: 0, effectiveAssignmentRate: 0,
    futureAssignments: 0, exemptAssignments: 0, offAssignments: 0, assignmentRate: 0,
    totalEvaluations: 0, avgScore: null, totalQualityIssues: 0, criticalIssues: 0,
  };
  const recordBookBreakdown: RecordBookItem[] = [];
  const evaluationScores: EvaluationScoreItem[] = [];
  const assignments = new Map<string, AssignmentStatusItem>();
  const work = new Map<string, WorkTypeItem>();
  const quality = new Map<string, number>();
  for (const r of rows) {
    const count = Number(r.records);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid mart count');
    if (r.kind === 'record_book') {
      summary.totalRecordBook += count;
      summary[r.category === 'DA_NHAP' ? 'completedRecordBook' : 'pendingRecordBook'] += count;
      recordBookBreakdown.push({ date: r.event_date, status: r.category, records: count });
    } else if (r.kind === 'assignment') {
      summary.totalAssignments += count;
      if (r.category === 'HOAN_THANH') summary.completedAssignments += count;
      if (['HOAN_THANH', 'DEN_GIO', 'TRONG_TIET'].includes(r.category)) summary.dueAssignments += count;
      if (r.category === 'CHUA_DEN_GIO') summary.futureAssignments += count;
      if (r.category === 'KHONG_CHAM_TIET') summary.exemptAssignments += count;
      if (r.category === 'OFF') summary.offAssignments += count;
      const key = JSON.stringify([r.category, r.detail === 'True']);
      const row = assignments.get(key) ?? { status: r.category, label: STATUS_LABELS[r.category] ?? r.category,
        finished: r.detail === 'True', records: 0, percentage: 0 };
      row.records += count; assignments.set(key, row);
    } else if (r.kind === 'work_type') {
      const [salaryStatus, unitName] = r.detail.split('|').map((s) => s.trim());
      const name = r.category === 'CHUA_XAC_DINH' ? 'Chưa rõ loại tiết' : r.category;
      const key = JSON.stringify([name, salaryStatus, unitName]);
      const row = work.get(key) ?? { name, salaryStatus, unitName: unitName ?? 'Chưa rõ đơn vị', records: 0 };
      row.records += count; work.set(key, row);
    } else if (r.kind === 'evaluation_score') {
      summary.totalEvaluations += count;
      evaluationScores.push({ criteria: r.category, level: r.detail, score: r.value, records: count });
    } else if (r.kind === 'quality') quality.set(r.category, (quality.get(r.category) ?? 0) + count);
  }
  const qualityIssues = [...quality].map(([issueCode, records]) => ({ issueCode, records, ...getQualityMeta(issueCode) }))
    .sort((a, b) => b.records - a.records);
  summary.totalQualityIssues = qualityIssues.reduce((sum, r) => sum + r.records, 0);
  summary.criticalIssues = qualityIssues.filter((r) => r.category === 'critical').reduce((sum, r) => sum + r.records, 0);
  summary.recordBookRate = summary.totalRecordBook ? summary.completedRecordBook / summary.totalRecordBook * 100 : 0;
  summary.assignmentRate = summary.totalAssignments ? summary.completedAssignments / summary.totalAssignments * 100 : 0;
  summary.effectiveAssignmentRate = summary.dueAssignments ? summary.completedAssignments / summary.dueAssignments * 100 : 0;
  const scores = evaluationScores.filter((r) => r.score !== null);
  const scales = new Set(scores.map((r) => JSON.stringify([r.criteria, r.level.split('|').slice(1)])));
  const scoreCount = scores.reduce((sum, r) => sum + r.records, 0);
  if (scales.size === 1 && scoreCount) summary.avgScore = scores.reduce((sum, r) => sum + r.score! * r.records, 0) / scoreCount;
  const stamps = new Set(allRows.map((r) => r.processed_at).filter((s): s is string => s !== null));
  if (stamps.size > 1) throw new Error('Mixed mart generations');
  return {
    schools: [...schools].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    summary, recordBookBreakdown, evaluationScores, qualityIssues,
    assignmentBreakdown: [...assignments.values()].map((r) => ({ ...r,
      percentage: summary.totalAssignments ? r.records / summary.totalAssignments * 100 : 0 })).sort((a, b) => b.records - a.records),
    workTypeBreakdown: [...work.values()].sort((a, b) => b.records - a.records),
    updatedAt: [...stamps][0] ?? null,
    scope: { schoolId: filters.schoolId ?? null, from: filters.from ?? null, to: filters.to ?? null,
      undatedAssignments: schoolRows.filter((r) => r.kind === 'assignment' && !r.event_date).reduce((s, r) => s + Number(r.records), 0),
      undatedRecordBooks: schoolRows.filter((r) => r.kind === 'record_book' && !r.event_date).reduce((s, r) => s + Number(r.records), 0) },
  };
}
