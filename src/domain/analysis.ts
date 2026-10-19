import type { Method, Process, Step } from './types';

export interface Classification { type: Method; reason: string }

const UNSTRUCTURED = ['文章・メール', '画像・PDF', '音声', '複合情報'];

/** 改善方式のルールベース判定（GAS版 classify と同じルール） */
export function classify(x: Step): Classification {
  const info = x.infoType || '未設定', rule = x.ruleClarity || '未設定', risk = x.riskLevel || '未設定', wish = x.improvement || '未定';
  if (info === '未設定' || rule === '未設定' || risk === '未設定')
    return { type: '追加確認が必要', reason: '情報の種類・ルールの明確さ・判断リスクを入力すると判定します。' };
  if (risk === '高')
    return { type: '人の判断を中心', reason: '判断ミスの影響が大きいため、人が判断し、AIは情報整理や下書き支援に限定する案です。' };
  if (wish === 'AIに任せたい' && UNSTRUCTURED.includes(info))
    return { type: 'AI＋人の確認', reason: 'AIで要約・分類・下書きを作成し、担当者が結果を確認する案です。' };
  if (rule === '明確' && (info === '定型データ' || wish === 'ルールで自動化したい'))
    return { type: '通常の自動化候補', reason: '処理条件が明確なため、入力チェック・転記・通知などをルール化する案です。' };
  if (UNSTRUCTURED.includes(info))
    return { type: 'AI活用候補', reason: '文章・画像などの非定型情報をAIで整理・抽出し、人が確認する案です。' };
  if (rule === '一部例外あり')
    return { type: 'AI＋人の確認', reason: '通常ケースを自動処理し、例外だけ人が確認する案です。' };
  return { type: '通常の自動化候補', reason: '繰り返し作業をテンプレート・入力規則・通知などで簡素化する案です。' };
}

/** 手動で選んだ方式があればそれを、無ければ自動判定を使う */
export function methodOf(x: Step): Classification {
  if (x.methodOverride) return { type: x.methodOverride, reason: '手動で選択した方式です。' };
  return classify(x);
}

export const RATES: Record<Method, number> = {
  'AI活用候補': 0.5, '通常の自動化候補': 0.7, '人の判断を中心': 0.1, 'AI＋人の確認': 0.3, '追加確認が必要': 0,
};

export const METHOD_INFO: Record<Method, { short: string; prefix: string; desc: string }> = {
  'AI活用候補': { short: 'AI活用', prefix: 'AIで情報を整理：', desc: 'AIで要約・分類・情報抽出を行い、担当者が結果を確認します。' },
  '通常の自動化候補': { short: '自動化', prefix: 'ルールで自動化：', desc: '入力規則、テンプレート、転記、通知などの自動化を検討します。' },
  'AI＋人の確認': { short: 'AI＋人の確認', prefix: 'AI処理＋人の確認：', desc: 'AIに下書き・分類を任せ、担当者が確認・承認します。' },
  '人の判断を中心': { short: '人が判断', prefix: '人が判断：', desc: '判断責任は人に残し、AIは参考情報や選択肢の整理に利用します。' },
  '追加確認が必要': { short: '要確認', prefix: '条件を追加確認：', desc: '例外条件、入力情報、判断基準を整理してから方式を決めます。' },
};

export function tobeTitle(x: Step): string {
  if (x.tobeTitle.trim()) return x.tobeTitle.trim();
  return METHOD_INFO[methodOf(x).type].prefix + x.action;
}

export function tobeMinutes(x: Step): { value: number; manual: boolean } {
  if (x.tobeMinutes !== '' && !isNaN(Number(x.tobeMinutes))) return { value: Math.max(0, Number(x.tobeMinutes)), manual: true };
  const m = Math.max(0, Number(x.minutes) || 0);
  return { value: m * (1 - RATES[methodOf(x).type]), manual: false };
}

export interface Impact { before: number; after: number; saved: number; monthlyHours: number | null; yearlyHours: number | null; manual: number }

export function impactOf(p: Process): Impact {
  let before = 0, after = 0, manual = 0;
  p.steps.filter(s => s.action.trim()).forEach(s => {
    before += Math.max(0, Number(s.minutes) || 0);
    const t = tobeMinutes(s);
    after += t.value;
    if (t.manual) manual++;
  });
  const saved = Math.max(0, before - after), vol = Math.max(0, Number(p.monthlyVolume) || 0);
  return { before, after, saved, monthlyHours: vol ? saved * vol / 60 : null, yearlyHours: vol ? saved * vol * 12 / 60 : null, manual };
}
