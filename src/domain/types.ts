export type StepType = '作業' | '判断';

export const METHODS = ['AI活用候補', '通常の自動化候補', 'AI＋人の確認', '人の判断を中心', '追加確認が必要'] as const;
export type Method = (typeof METHODS)[number];

export const TOOLS = ['メール', 'Excel・スプレッドシート', '紙・帳票', '既存システム', '電話・口頭', 'その他'];
export const WISHES = ['未定', 'AIに任せたい', 'ルールで自動化したい', '人の判断を残したい'];
export const INFO_TYPES = ['未設定', '定型データ', '文章・メール', '画像・PDF', '音声', '複合情報'];
export const RULE_CLARITY = ['未設定', '明確', '一部例外あり', '曖昧・都度判断'];
export const RISK_LEVELS = ['未設定', '低', '中', '高'];

/** 1工程。項目はGAS版の工程一覧シート（21列）と対応する */
export interface Step {
  stepId: string;
  actor: string;
  action: string;
  type: StepType;
  /** 空＝次の順序の工程、'END'＝終了、それ以外は行き先の stepId */
  next1: string;
  cond1: string;
  next2: string;
  cond2: string;
  tool: string;
  /** 1件あたりの分。未入力は '' */
  minutes: number | '';
  improvement: string;
  infoType: string;
  ruleClarity: string;
  riskLevel: string;
  notes: string;
  /** 空＝自動判定の結果を使う */
  methodOverride: Method | '';
  tobeTitle: string;
  tobeMinutes: number | '';
}

export interface Process {
  processId: string;
  title: string;
  department: string;
  author: string;
  painPoints: string;
  monthlyVolume: number | '';
  updatedAt: string;
  steps: Step[];
}

export const uid = (p = 's') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function newStep(o: Partial<Step> = {}): Step {
  return {
    stepId: uid(), actor: '', action: '', type: '作業', next1: '', cond1: '', next2: '', cond2: '',
    tool: 'メール', minutes: '', improvement: '未定', infoType: '未設定', ruleClarity: '未設定', riskLevel: '未設定',
    notes: '', methodOverride: '', tobeTitle: '', tobeMinutes: '', ...o,
  };
}

export function newProcess(o: Partial<Process> = {}): Process {
  return {
    processId: uid('p'), title: '', department: '', author: '', painPoints: '', monthlyVolume: '',
    updatedAt: new Date().toISOString(), steps: [newStep()], ...o,
  };
}
