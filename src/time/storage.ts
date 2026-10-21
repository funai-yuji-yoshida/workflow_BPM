import { uid } from '../domain/types';
import { isYmd } from './dates';
import { DEFAULT_SETTINGS, PALETTE, SNAP, defaultTimeStore, type Entry, type Genre, type Template, type TimeSettings, type TimeStore } from './types';

const KEY = 'bpm-navi:time:v1';
export const TIME_FILE_APP = 'bpm-navi-time';

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const clampInt = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return isNaN(n) ? d : Math.min(hi, Math.max(lo, n)); };
const snap = (m: number) => Math.round(m / SNAP) * SNAP;

export function sanitizeTimeStore(x: any): TimeStore {
  const d = defaultTimeStore();
  if (!x || typeof x !== 'object') return d;
  const genres: Genre[] = Array.isArray(x.genres) && x.genres.length
    ? x.genres.map((g: any, i: number) => ({
      genreId: str(g?.genreId) || uid('g'), name: str(g?.name) || '（無題）',
      color: PALETTE.includes(str(g?.color)) ? str(g.color) : PALETTE[i % PALETTE.length],
      order: clampInt(g?.order, 0, 9999, i), hidden: !!g?.hidden, processId: str(g?.processId),
    }))
    : d.genres;
  const seen = new Set<string>();
  genres.forEach(g => { if (seen.has(g.genreId)) g.genreId = uid('g'); seen.add(g.genreId); });
  const entries: Entry[] = (Array.isArray(x.entries) ? x.entries : []).map((e: any) => {
    const startMin = snap(clampInt(e?.startMin, 0, 24 * 60 - SNAP, 540));
    const endMin = Math.max(startMin + SNAP, snap(clampInt(e?.endMin, SNAP, 24 * 60, startMin + 30)));
    const count = e?.count === '' || e?.count === null || e?.count === undefined || isNaN(Number(e.count)) ? '' : Math.max(0, Math.round(Number(e.count)));
    return { entryId: str(e?.entryId) || uid('e'), date: str(e?.date), startMin, endMin, title: str(e?.title), genreId: str(e?.genreId), count, memo: str(e?.memo) } as Entry;
  }).filter((e: Entry) => isYmd(e.date));
  const templates: Template[] = (Array.isArray(x.templates) ? x.templates : []).map((t: any) => ({
    templateId: str(t?.templateId) || uid('t'), title: str(t?.title), genreId: str(t?.genreId), minutes: Math.max(SNAP, snap(clampInt(t?.minutes, SNAP, 24 * 60, 30))),
  })).filter((t: Template) => t.title);
  const s = x.settings || {};
  const settings: TimeSettings = {
    weekStart: s.weekStart === 0 ? 0 : DEFAULT_SETTINGS.weekStart,
    dayStartHour: clampInt(s.dayStartHour, 0, 23, DEFAULT_SETTINGS.dayStartHour),
    dayEndHour: clampInt(s.dayEndHour, 1, 24, DEFAULT_SETTINGS.dayEndHour),
    workHoursPerDay: clampInt(s.workHoursPerDay, 1, 24, DEFAULT_SETTINGS.workHoursPerDay),
    workDaysPerMonth: clampInt(s.workDaysPerMonth, 1, 31, DEFAULT_SETTINGS.workDaysPerMonth),
  };
  if (settings.dayEndHour <= settings.dayStartHour) { settings.dayStartHour = DEFAULT_SETTINGS.dayStartHour; settings.dayEndHour = DEFAULT_SETTINGS.dayEndHour; }
  return { genres, entries, templates, settings };
}

/** ブラウザ内（この端末だけ）に保存。業務フローとは別のキー */
export function loadTimeStore(): TimeStore {
  try { const raw = localStorage.getItem(KEY); return raw ? sanitizeTimeStore(JSON.parse(raw)) : defaultTimeStore(); } catch { return defaultTimeStore(); }
}
export function saveTimeStore(s: TimeStore): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export const timeToFileJson = (s: TimeStore) => JSON.stringify({ app: TIME_FILE_APP, version: 1, exportedAt: new Date().toISOString(), data: s }, null, 2);
export function timeFromFileJson(text: string): TimeStore {
  let d: any;
  try { d = JSON.parse(text); } catch { throw new Error('JSONとして読めません'); }
  if (d?.app !== TIME_FILE_APP || !d.data) throw new Error('時間記録のファイルではありません');
  return sanitizeTimeStore(d.data);
}
