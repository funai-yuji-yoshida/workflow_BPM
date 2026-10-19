import { describe, expect, it } from 'vitest';
import { analyze, renderFlow } from './flow/engine';
import { classify, impactOf } from './domain/analysis';
import { fromFileJson, sanitizeProcess, toFileJson } from './domain/storage';
import { invoiceSample } from './domain/samples';
import { newStep } from './domain/types';

describe('フロー解析', () => {
  it('サンプルはエラーなし・差し戻しを点線として判定', () => {
    const m = analyze(invoiceSample().steps);
    expect(m.issues).toEqual([]);
    expect(m.lanes).toEqual(['営業担当', '経理担当', '経理マネージャー']);
    const back = m.edges.filter(e => e.back).map(e => [e.from, e.to]);
    expect(back).toContainEqual([m.nodes.find(n => n.no === 3)!.id, 'smp2']);
    expect(back).toContainEqual(['smp6', 'smp5']);
    expect(m.byId.__end).toBeTruthy();
  });
  it('判断の分岐不足・行き先不明はエラー', () => {
    const steps = [newStep({ action: 'A', type: '判断', next1: 'zzz', cond1: 'OK' })];
    const levels = analyze(steps).issues.map(i => i.level + ':' + i.text);
    expect(levels.some(t => t.startsWith('error:') && t.includes('分岐を2つ'))).toBe(true);
    expect(levels.some(t => t.startsWith('error:') && t.includes('見つかりません'))).toBe(true);
  });
  it('分岐なしの工程は順に自動接続され終了まで届く', () => {
    const steps = ['A', 'B', 'C'].map(a => newStep({ action: a, actor: 'X' }));
    const m = analyze(steps);
    expect(m.issues).toEqual([]);
    expect(m.edges.map(e => e.to)).toEqual([steps[0].stepId, steps[1].stepId, steps[2].stepId, '__end']);
  });
  it('SVGは文字列をエスケープする', () => {
    const { svg } = renderFlow([newStep({ action: '<script>alert(1)</script>', actor: '"x"' })], 'asis');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
});

describe('改善方式・試算', () => {
  it('判断リスク高は人の判断', () => {
    expect(classify(newStep({ infoType: '定型データ', ruleClarity: '明確', riskLevel: '高' })).type).toBe('人の判断を中心');
  });
  it('手入力の改善後時間を優先', () => {
    const p = invoiceSample();
    const imp = impactOf(p);
    expect(imp.before).toBe(85);
    expect(imp.manual).toBe(1);
    expect(imp.monthlyHours).toBeCloseTo(imp.saved * 100 / 60);
  });
});

describe('ファイル保存・読込', () => {
  it('書き出したJSONを読み戻せる', () => {
    const p = invoiceSample();
    const back = fromFileJson(toFileJson(p));
    expect(back.steps.map(s => s.stepId)).toEqual(p.steps.map(s => s.stepId));
    expect(back.steps[2].next2).toBe('smp2');
  });
  it('他のファイルは拒否', () => {
    expect(() => fromFileJson('{"a":1}')).toThrow();
    expect(() => fromFileJson('not json')).toThrow();
  });
  it('不正な値は既定値に、重複IDは振り直し', () => {
    const p = sanitizeProcess({ title: 1, steps: [{ stepId: 'a', minutes: 'x', type: 'zzz' }, { stepId: 'a' }] })!;
    expect(p.title).toBe('1');
    expect(p.steps[0].minutes).toBe('');
    expect(p.steps[0].type).toBe('作業');
    expect(p.steps[1].stepId).not.toBe('a');
  });
});
