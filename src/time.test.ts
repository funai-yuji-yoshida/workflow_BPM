import { describe, expect, it } from 'vitest';
import { buckets, byTitle, coveredMinutes, measuredFor, summarize, toCsv } from './time/aggregate';
import { addDays, periodRange, startOfWeek } from './time/dates';
import { sanitizeTimeStore, timeFromFileJson, timeToFileJson } from './time/storage';
import { DEFAULT_SETTINGS, defaultTimeStore, newEntry, newGenre } from './time/types';

const g1 = newGenre({ genreId: 'g1', name: '定型処理' }), g2 = newGenre({ genreId: 'g2', name: '会議' });
const E = (date: string, s: number, e: number, genreId: string, o = {}) => newEntry({ date, startMin: s * 60, endMin: e * 60, genreId, title: 'x', ...o });

describe('日付', () => {
  it('週は月曜始まり', () => {
    expect(startOfWeek('2026-10-21', 1)).toBe('2026-10-19'); // 水曜 → 月曜
    expect(startOfWeek('2026-10-25', 1)).toBe('2026-10-19'); // 日曜 → 前の月曜
    expect(periodRange('week', '2026-10-21', 1)).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    expect(periodRange('month', '2026-02-10', 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('集計', () => {
  const entries = [
    E('2026-10-19', 9, 11, 'g1', { count: 4, title: '請求書作成' }), // 120分・4件
    E('2026-10-19', 10, 11, 'g2'), // 重なり
    E('2026-10-20', 9, 10, 'g1', { title: '請求書作成' }), // 件数なし
    E('2026-10-27', 9, 10, 'g1'), // 期間外
  ];
  const r = periodRange('week', '2026-10-21', 1);
  it('ジャンル別合計・割合・分/件・1日平均（記録した日のみ）', () => {
    const s = summarize(entries, [g1, g2], r);
    expect(s.total).toBe(240);
    expect(s.covered).toBe(180); // 重なりは二重計上しない
    expect(s.recordedDays).toBe(2);
    expect(s.rows[0].genre.genreId).toBe('g1');
    expect(s.rows[0].minutes).toBe(180);
    expect(s.rows[0].share).toBeCloseTo(0.75);
    expect(s.rows[0].perItem).toBe(30); // 件数を入れた記録だけ：120分/4件
    expect(s.rows[0].dailyAvg).toBe(90);
  });
  it('作業内容別の内訳', () => {
    expect(byTitle(entries, 'g1', r)[0]).toMatchObject({ title: '請求書作成', minutes: 180, records: 2, count: 4 });
  });
  it('日別・週別バケット', () => {
    const d = buckets(entries, r, 'day', 1);
    expect(d).toHaveLength(7);
    expect(d[0].byGenre).toEqual({ g1: 120, g2: 60 });
    const w = buckets(entries, periodRange('month', '2026-10-01', 1), 'week', 1);
    expect(w.reduce((s, b) => s + b.total, 0)).toBe(300);
  });
  it('業務ひも付けの実測値と月換算', () => {
    const m = measuredFor(entries, ['g1'], DEFAULT_SETTINGS)!;
    expect(m.count).toBe(4);
    expect(m.perItem).toBe(30);
    expect(m.recordedDays).toBe(3);
    expect(m.monthly).toBeCloseTo(4 / 3 * 20);
    expect(measuredFor(entries, ['none'], DEFAULT_SETTINGS)).toBeNull();
  });
  it('重なりの統合', () => {
    expect(coveredMinutes([E('2026-10-19', 9, 10, 'a'), E('2026-10-19', 9.5, 11, 'a'), E('2026-10-19', 13, 14, 'a')])).toBe(180);
  });
});

describe('CSV・保存', () => {
  it('BOM付き・数式にならない・引用符処理', () => {
    const csv = toCsv([['a', '=SUM(A1)', 'x,"y"', 3]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('"x,""y"""');
  });
  it('ファイル往復・不正値の補正', () => {
    const s = defaultTimeStore();
    s.entries.push(E('2026-10-19', 9, 10, s.genres[0].genreId));
    expect(timeFromFileJson(timeToFileJson(s)).entries).toHaveLength(1);
    expect(() => timeFromFileJson('{"app":"other"}')).toThrow();
    const t = sanitizeTimeStore({ entries: [{ date: '2026-13-40', startMin: 0, endMin: 30 }, { date: '2026-10-19', startMin: 607, endMin: 600 }] });
    expect(t.entries).toHaveLength(1);
    expect(t.entries[0].startMin).toBe(600);
    expect(t.entries[0].endMin).toBe(615);
    expect(t.genres.length).toBe(9);
  });
});
