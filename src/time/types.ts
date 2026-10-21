import { uid } from '../domain/types';

export interface Genre {
  genreId: string;
  name: string;
  color: string;
  order: number;
  hidden: boolean;
  /** ひも付けた業務フローの業務ID（空＝なし） */
  processId: string;
}

/** 1件の作業記録。時刻は端末の現地時刻、0時からの分（15の倍数） */
export interface Entry {
  entryId: string;
  date: string; // YYYY-MM-DD
  startMin: number;
  endMin: number;
  title: string;
  genreId: string;
  count: number | '';
  memo: string;
}

export interface Template { templateId: string; title: string; genreId: string; minutes: number }

export interface TimeSettings {
  weekStart: number; // 0=日曜, 1=月曜
  dayStartHour: number;
  dayEndHour: number;
  workHoursPerDay: number;
  workDaysPerMonth: number;
}

export interface TimeStore { genres: Genre[]; entries: Entry[]; templates: Template[]; settings: TimeSettings }

export const SNAP = 15;

/** 色覚の違いでも区別しやすく、白文字が読める濃さの12色 */
export const PALETTE = ['#1a73e8', '#e8710a', '#188038', '#d93025', '#9334e6', '#00838f', '#c2185b', '#5f6368', '#795548', '#3949ab', '#827717', '#0b8043'];

export const DEFAULT_GENRE_NAMES = ['定型処理', '資料作成', 'メール/チャット対応', '電話/来客対応', '会議', '確認/承認', '調べもの', '移動', 'その他'];

export const DEFAULT_SETTINGS: TimeSettings = { weekStart: 1, dayStartHour: 8, dayEndHour: 20, workHoursPerDay: 8, workDaysPerMonth: 20 };

export function newGenre(o: Partial<Genre> = {}): Genre {
  return { genreId: uid('g'), name: '', color: PALETTE[0], order: 0, hidden: false, processId: '', ...o };
}
export function newEntry(o: Partial<Entry> = {}): Entry {
  return { entryId: uid('e'), date: '', startMin: 9 * 60, endMin: 9 * 60 + 30, title: '', genreId: '', count: '', memo: '', ...o };
}

export function defaultTimeStore(): TimeStore {
  return {
    genres: DEFAULT_GENRE_NAMES.map((name, i) => newGenre({ name, color: PALETTE[i % PALETTE.length], order: i })),
    entries: [], templates: [], settings: { ...DEFAULT_SETTINGS },
  };
}
