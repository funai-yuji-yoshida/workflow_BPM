/** 日付は 'YYYY-MM-DD'（端末の現地時刻）の文字列で扱う */
const pad = (n: number) => String(n).padStart(2, '0');

export const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayYmd = () => toYmd(new Date());
export const addDays = (s: string, n: number) => { const d = fromYmd(s); d.setDate(d.getDate() + n); return toYmd(d); };
export const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toYmd(fromYmd(s)) === s;

export const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const minOfDate = (d: Date) => d.getHours() * 60 + d.getMinutes();

export type PeriodKind = 'day' | 'week' | 'month' | 'custom';
export interface Range { start: string; end: string } // 両端を含む

export function startOfWeek(s: string, weekStart: number) {
  const d = fromYmd(s);
  const diff = (d.getDay() - weekStart + 7) % 7;
  return addDays(s, -diff);
}

export function periodRange(kind: Exclude<PeriodKind, 'custom'>, anchor: string, weekStart: number): Range {
  if (kind === 'day') return { start: anchor, end: anchor };
  if (kind === 'week') { const s = startOfWeek(anchor, weekStart); return { start: s, end: addDays(s, 6) }; }
  const d = fromYmd(anchor);
  return { start: toYmd(new Date(d.getFullYear(), d.getMonth(), 1)), end: toYmd(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}

export function shiftAnchor(kind: Exclude<PeriodKind, 'custom'>, anchor: string, dir: number) {
  if (kind === 'day') return addDays(anchor, dir);
  if (kind === 'week') return addDays(anchor, 7 * dir);
  const d = fromYmd(anchor);
  return toYmd(new Date(d.getFullYear(), d.getMonth() + dir, 1));
}

export function daysIn(r: Range): string[] {
  const out: string[] = [];
  for (let d = r.start; d <= r.end && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];
export const labelYmd = (s: string) => { const d = fromYmd(s); return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`; };
export function labelRange(kind: PeriodKind, r: Range) {
  const s = fromYmd(r.start);
  if (kind === 'day') return `${s.getFullYear()}年${labelYmd(r.start)}`;
  if (kind === 'month') return `${s.getFullYear()}年${s.getMonth() + 1}月`;
  return `${s.getFullYear()}年${labelYmd(r.start)}〜${labelYmd(r.end)}`;
}
