// Keep SSR and browser text identical across ICU versions and host timezones.
// Attendance business time is the fixed UTC+7 offset used by the profile.
export function attendanceDate(iso: string): string {
  const time = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  if (!Number.isFinite(time.getTime())) throw new Error('Invalid attendance timestamp');
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(time.getUTCDate())}/${pad(time.getUTCMonth() + 1)}/${time.getUTCFullYear()} · ${pad(time.getUTCHours())}:${pad(time.getUTCMinutes())}`;
}
