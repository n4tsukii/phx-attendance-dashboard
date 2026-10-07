import 'server-only';
import { createClient } from '@clickhouse/client';
import { parseSchoolFilter, parseDateRange, isMartHealthy } from './attendance-model';
import { buildAttendanceDashboard, type RawMartRow } from './attendance-transform';

function createMartClient() {
  const host = process.env.CH_HOST || '127.0.0.1';
  return createClient({
    url: `http://${host === 'localhost' ? '127.0.0.1' : host}:${process.env.CH_PORT || '8123'}`,
    username: process.env.CH_USER, password: process.env.CH_PASSWORD, request_timeout: 15000,
    clickhouse_settings: { max_execution_time: 10, max_memory_usage: '500000000' },
  });
}

export async function getAttendanceMartHealth(): Promise<boolean> {
  const client = createMartClient();
  try {
    const result = await client.query({
      query: `SELECT count() AS rows, uniqExact(processed_at) AS generations,
        dateDiff('second', max(processed_at), now('UTC')) AS age_seconds FROM analys.mart_chamtiet_metrics`,
      format: 'JSONEachRow',
    });
    const [health] = await result.json<{ rows: string | number; generations: string | number; age_seconds: number }>();
    return !!health && isMartHealthy(Number(health.rows), Number(health.generations), Number(health.age_seconds));
  } finally { await client.close(); }
}

export async function getAttendanceDashboardData(school?: string, from?: string, to?: string) {
  const filters = { schoolId: parseSchoolFilter(school), ...parseDateRange(from, to) };
  const client = createMartClient();
  try {
    const result = await client.query({
      query: `SELECT kind,school_id,school_name,formatDateTime(event_date,'%Y-%m-%d') AS event_date,
        category,detail,value,records,formatDateTime(processed_at,'%Y-%m-%dT%H:%i:%S.%fZ','UTC') AS processed_at
        FROM analys.mart_chamtiet_metrics
        WHERE kind IN ('assignment','record_book','work_type','evaluation_score','quality')`,
      format: 'JSONEachRow',
    });
    return buildAttendanceDashboard(await result.json<RawMartRow>(), filters);
  } finally { await client.close(); }
}
