import { newProcess, newStep, type Process } from './types';

/** 説明用サンプル（請求書業務）。架空の業務 */
export function invoiceSample(): Process {
  const S = newStep;
  return newProcess({
    title: '請求書発行・入金確認（サンプル）', department: '経理', painPoints: '請求書の差し戻しが多く、入金確認に時間がかかる', monthlyVolume: 100,
    steps: [
      S({ actor: '営業担当', action: '取引発生・請求金額を決める', tool: '電話・口頭', minutes: 10, infoType: '複合情報', ruleClarity: '一部例外あり', riskLevel: '高' }),
      S({ stepId: 'smp2', actor: '経理担当', action: '請求書を作成する', tool: 'Excel・スプレッドシート', minutes: 20, infoType: '定型データ', ruleClarity: '明確', riskLevel: '低' }),
      S({ actor: '経理マネージャー', action: '請求書の内容は正しいか？', type: '判断', next1: 'smp4', cond1: '承認', next2: 'smp2', cond2: '差し戻し', tool: 'Excel・スプレッドシート', minutes: 10, infoType: '定型データ', ruleClarity: '一部例外あり', riskLevel: '中' }),
      S({ stepId: 'smp4', actor: '経理担当', action: '請求書を発行・送付する', tool: 'メール', minutes: 10, infoType: '定型データ', ruleClarity: '明確', riskLevel: '低' }),
      S({ stepId: 'smp5', actor: '経理担当', action: '入金はあるか？', type: '判断', next1: 'smp7', cond1: '入金', next2: 'smp6', cond2: '未入金', tool: '既存システム', minutes: 15, infoType: '定型データ', ruleClarity: '明確', riskLevel: '低' }),
      S({ stepId: 'smp6', actor: '営業担当', action: '顧客へ確認する', next1: 'smp5', tool: '電話・口頭', minutes: 15, infoType: '文章・メール', ruleClarity: '曖昧・都度判断', riskLevel: '中', improvement: '人の判断を残したい' }),
      S({ stepId: 'smp7', actor: '経理担当', action: '請求管理システムを更新する', next1: 'END', tool: '既存システム', minutes: 5, infoType: '定型データ', ruleClarity: '明確', riskLevel: '低', tobeTitle: '入金データから自動更新', tobeMinutes: 0 }),
    ],
  });
}
