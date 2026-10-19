import { METHODS, newProcess, newStep, uid, type Process, type Step } from './types';

const KEY = 'bpm-navi:v1';
export const FILE_APP = 'bpm-navi';

export interface Store { processes: Process[]; currentId: string }

/** ブラウザ内（この端末だけ）に保存。使えない環境では何もしない */
export function loadStore(): Store | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!Array.isArray(d.processes)) return null;
    const processes = d.processes.map(sanitizeProcess).filter(Boolean) as Process[];
    return { processes, currentId: String(d.currentId || '') };
  } catch { return null; }
}
export function saveStore(s: Store): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number | '' => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? '' : Math.max(0, Number(v)));
const pick = (v: unknown, list: readonly string[], dflt: string) => (list.includes(str(v)) ? str(v) : dflt);

/** 読み込んだデータを型どおりに整える（不正な値は既定値へ） */
export function sanitizeStep(x: any): Step {
  return newStep({
    stepId: str(x?.stepId) || uid(), actor: str(x?.actor), action: str(x?.action),
    type: x?.type === '判断' ? '判断' : '作業',
    next1: str(x?.next1), cond1: str(x?.cond1), next2: str(x?.next2), cond2: str(x?.cond2),
    tool: str(x?.tool), minutes: num(x?.minutes), improvement: str(x?.improvement) || '未定',
    infoType: str(x?.infoType) || '未設定', ruleClarity: str(x?.ruleClarity) || '未設定', riskLevel: str(x?.riskLevel) || '未設定',
    notes: str(x?.notes), methodOverride: pick(x?.methodOverride, METHODS, '') as Step['methodOverride'],
    tobeTitle: str(x?.tobeTitle), tobeMinutes: num(x?.tobeMinutes),
  });
}
export function sanitizeProcess(x: any): Process | null {
  if (!x || typeof x !== 'object') return null;
  const steps = Array.isArray(x.steps) ? x.steps.map(sanitizeStep) : [];
  // stepId の重複は振り直す（分岐の参照先が曖昧になるため）
  const seen = new Set<string>();
  steps.forEach((s: Step) => { if (seen.has(s.stepId)) s.stepId = uid(); seen.add(s.stepId); });
  return newProcess({
    processId: str(x.processId) || uid('p'), title: str(x.title), department: str(x.department), author: str(x.author),
    painPoints: str(x.painPoints), monthlyVolume: num(x.monthlyVolume), updatedAt: str(x.updatedAt) || new Date().toISOString(),
    steps: steps.length ? steps : [newStep()],
  });
}

export function toFileJson(p: Process): string {
  return JSON.stringify({ app: FILE_APP, version: 1, exportedAt: new Date().toISOString(), process: p }, null, 2);
}
/** 書き出したJSONファイルを読み込む。他のアプリのファイルなどはエラー */
export function fromFileJson(text: string): Process {
  let d: any;
  try { d = JSON.parse(text); } catch { throw new Error('JSONとして読めません'); }
  if (d?.app !== FILE_APP || !d.process) throw new Error('このアプリで保存したファイルではありません');
  const p = sanitizeProcess(d.process);
  if (!p) throw new Error('業務データが見つかりません');
  return p;
}

export function fileNameOf(p: Process, ext: string) {
  const base = (p.title || '業務フロー').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
  return `${base}${p.author ? '_' + p.author.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 20) : ''}.${ext}`;
}
