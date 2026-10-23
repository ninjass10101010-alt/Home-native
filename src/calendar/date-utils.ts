export type MonthCell = { iso: string; day: number; inMonth: boolean };

function pad(n: number) { return String(n).padStart(2, "0"); }
export function localDateISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDaysISO(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}
export function isRealDateISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = isoToDate(iso);
  return localDateISO(d) === iso;
}
export function monthGridCells(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1, 12);
  const start = new Date(year, month, 1 - first.getDay(), 12);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { iso: localDateISO(d), day: d.getDate(), inMonth: d.getMonth() === month };
  });
}
export function selectedWeekISO(iso: string): string {
  return addDaysISO(iso, -isoToDate(iso).getDay());
}
export function parseClockToHHMM(input: string): string | null {
  const v = input.trim().toUpperCase();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return v;
  const m = v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 1 || h > 12 || min > 59) return null;
  return `${pad((h % 12) + (m[3] === "PM" ? 12 : 0))}:${pad(min)}`;
}
export function nextDateISO(iso: string): string { return addDaysISO(iso, 1); }
