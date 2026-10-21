import type { Entry, Genre, TimeSettings } from './types';
import { addDays, daysIn, startOfWeek, type Range } from './dates';

export const minutesOf = (e: Entry) => Math.max(0, e.endMin - e.startMin);
const inRange = (e: Entry, r: Range) => e.date >= r.start && e.date <= r.end;

/** 同じ日の重なりを二重に数えない「記録済み時間」 */
export function coveredMinutes(entries: Entry[]): number {
  const byDay = new Map<string, [number, number][]>();
  entries.forEach(e => { if (e.endMin > e.startMin) (byDay.get(e.date) ?? byDay.set(e.date, []).get(e.date)!).push([e.startMin, e.endMin]); });
  let total = 0;
  byDay.forEach(list => {
    list.sort((a, b) => a[0] - b[0]);
    let [s, t] = list[0];
    for (const [a, b] of list.slice(1)) { if (a <= t) t = Math.max(t, b); else { total += t - s; [s, t] = [a, b]; } }
    total += t - s;
  });
  return total;
}

export interface GenreRow {
  genre: Genre;
  minutes: number;
  share: number; // 0〜1（ジャンル合計に対する割合）
  records: number;
  count: number; // 処理件数の合計
  perItem: number | null; // 件数を入れた記録の 分/件
  dailyAvg: number; // 記録した日あたりの分
}
export interface Summary { range: Range; total: number; covered: number; recordedDays: number; rows: GenreRow[]; uncategorized: number }

/** 期間内のジャンル別集計。1日平均は「記録した日」だけで割る（休日を含めない） */
export function summarize(entries: Entry[], genres: Genre[], range: Range): Summary {
  const list = entries.filter(e => inRange(e, range));
  const recordedDays = new Set(list.map(e => e.date)).size;
  const total = list.reduce((s, e) => s + minutesOf(e), 0);
  const known = new Set(genres.map(g => g.genreId));
  const rows: GenreRow[] = genres.map(genre => {
    const es = list.filter(e => e.genreId === genre.genreId);
    const minutes = es.reduce((s, e) => s + minutesOf(e), 0);
    const counted = es.filter(e => e.count !== '' && Number(e.count) > 0);
    const count = counted.reduce((s, e) => s + Number(e.count), 0);
    const countedMin = counted.reduce((s, e) => s + minutesOf(e), 0);
    return { genre, minutes, share: total ? minutes / total : 0, records: es.length, count, perItem: count ? countedMin / count : null, dailyAvg: recordedDays ? minutes / recordedDays : 0 };
  }).filter(r => r.records > 0).sort((a, b) => b.minutes - a.minutes);
  const uncategorized = list.filter(e => !known.has(e.genreId)).reduce((s, e) => s + minutesOf(e), 0);
  return { range, total, covered: coveredMinutes(list), recordedDays, rows, uncategorized };
}

/** ジャンル内の作業内容別の内訳 */
export function byTitle(entries: Entry[], genreId: string, range: Range) {
  const m = new Map<string, { title: string; minutes: number; records: number; count: number }>();
  entries.filter(e => e.genreId === genreId && inRange(e, range)).forEach(e => {
    const k = e.title.trim() || '（作業内容なし）';
    const r = m.get(k) ?? { title: k, minutes: 0, records: 0, count: 0 };
    r.minutes += minutesOf(e); r.records++; r.count += Number(e.count) || 0;
    m.set(k, r);
  });
  return [...m.values()].sort((a, b) => b.minutes - a.minutes);
}

export interface Bucket { key: string; label: string; start: string; end: string; byGenre: Record<string, number>; total: number }

/** グラフ用：日別（期間が長いときは週別）のジャンル別合計 */
export function buckets(entries: Entry[], range: Range, unit: 'day' | 'week', weekStart: number): Bucket[] {
  const out: Bucket[] = [];
  if (unit === 'day') {
    daysIn(range).forEach(d => out.push({ key: d, label: d, start: d, end: d, byGenre: {}, total: 0 }));
  } else {
    for (let s = startOfWeek(range.start, weekStart); s <= range.end; s = addDays(s, 7)) out.push({ key: s, label: s, start: s < range.start ? range.start : s, end: addDays(s, 6) > range.end ? range.end : addDays(s, 6), byGenre: {}, total: 0 });
  }
  entries.filter(e => inRange(e, range)).forEach(e => {
    const b = out.find(x => e.date >= x.start && e.date <= x.end);
    if (!b) return;
    b.byGenre[e.genreId] = (b.byGenre[e.genreId] || 0) + minutesOf(e);
    b.total += minutesOf(e);
  });
  return out;
}

export interface Measured { minutes: number; count: number; countedMinutes: number; perItem: number | null; monthly: number | null; from: string; to: string; recordedDays: number; records: number }

/** 業務にひも付いたジャンルの実測値。
 *  月換算件数 ＝ 処理件数 ÷ 記録した日数（全ジャンルで何か記録した日）× 月の稼働日数 */
export function measuredFor(entries: Entry[], genreIds: string[], settings: TimeSettings): Measured | null {
  const es = entries.filter(e => genreIds.includes(e.genreId));
  if (!es.length) return null;
  const own = es.map(e => e.date).sort(), from = own[0], to = own[own.length - 1];
  const recordedDays = new Set(entries.map(e => e.date)).size;
  const minutes = es.reduce((s, e) => s + minutesOf(e), 0);
  const counted = es.filter(e => Number(e.count) > 0);
  const count = counted.reduce((s, e) => s + Number(e.count), 0);
  const countedMinutes = counted.reduce((s, e) => s + minutesOf(e), 0);
  return {
    minutes, count, countedMinutes, records: es.length, from, to, recordedDays,
    perItem: count ? countedMinutes / count : null,
    monthly: count && recordedDays ? count / recordedDays * settings.workDaysPerMonth : null,
  };
}

/** Excelで文字化けしないCSV（UTF-8 BOM付き、CRLF） */
export function toCsv(rows: (string | number)[][]): string {
  // 文字列の先頭が = + - @ の場合は数式として解釈されないよう ' を付ける
  const cell = (v: string | number) => {
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return String.fromCharCode(0xfeff) + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
