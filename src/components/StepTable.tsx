import { useState } from 'react';
import { INFO_TYPES, METHODS, RISK_LEVELS, RULE_CLARITY, TOOLS, WISHES, newStep, type Step } from '../domain/types';
import { classify } from '../domain/analysis';

interface Props { steps: Step[]; onChange: (steps: Step[]) => void }

const numOrBlank = (v: string): number | '' => (v === '' ? '' : Math.max(0, Number(v) || 0));

export function StepTable({ steps, onChange }: Props) {
  const [tab, setTab] = useState<'flow' | 'analysis'>('flow');
  const set = (i: number, patch: Partial<Step>) => onChange(steps.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= steps.length) return; const a = [...steps];[a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const remove = (i: number) => onChange(steps.length > 1 ? steps.filter((_, k) => k !== i) : [newStep()]);
  const insertAfter = (i: number) => { const a = [...steps]; a.splice(i + 1, 0, newStep({ actor: steps[i].actor })); onChange(a); };
  const actors = [...new Set(steps.map(s => s.actor.trim()).filter(Boolean))];
  const ids = new Set(steps.map(s => s.stepId));

  const nextSelect = (s: Step, k: 'next1' | 'next2', auto: string) => (
    <select value={s[k]} onChange={e => set(steps.indexOf(s), { [k]: e.target.value })} aria-label={k === 'next1' ? '次の工程' : '分岐2の行き先'}>
      <option value="">{auto}</option>
      {steps.map((x, i) => x.stepId !== s.stepId && <option key={x.stepId} value={x.stepId}>工程{i + 1}：{x.action.slice(0, 16) || '（未入力）'}</option>)}
      <option value="END">終了</option>
      {s[k] && s[k] !== 'END' && !ids.has(s[k]) && <option value={s[k]}>（削除された工程）</option>}
    </select>
  );

  return (
    <section className="panel">
      <div className="bar">
        <h2>工程</h2>
        <span className="spacer" />
        <div className="seg" role="tablist" aria-label="入力する項目">
          <button role="tab" aria-selected={tab === 'flow'} className={tab === 'flow' ? 'on' : ''} onClick={() => setTab('flow')}>① 流れ</button>
          <button role="tab" aria-selected={tab === 'analysis'} className={tab === 'analysis' ? 'on' : ''} onClick={() => setTab('analysis')}>② 改善分析</button>
        </div>
      </div>
      <p className="muted">
        {tab === 'flow'
          ? '1行に1工程。上から順に流れます。「次の工程」が空なら次の行へつながります。承認・確認など結果で次が変わる工程は「判断」にして分岐を2つ設定してください。前の工程を行き先にすると「差し戻し」として点線で表示されます。'
          : '情報の種類・ルールの明確さ・判断リスクを入れると、改善方式を自動で判定します（ルールによる仮説です）。方式は手動で変更できます。改善後の工程名・所要時間は空ならテンプレート文言と仮定短縮率で計算します。'}
      </p>
      <div className="tablewrap">
        <datalist id="actors">{actors.map(a => <option key={a} value={a} />)}</datalist>
        {tab === 'flow' ? (
          <table className="steps">
            <thead><tr><th>#</th><th>担当者</th><th>作業内容 *</th><th>種別</th><th>次の工程／分岐1</th><th>条件1</th><th>分岐2</th><th>条件2</th><th>分/件</th><th>ツール</th><th>備考・例外</th><th></th></tr></thead>
            <tbody>
              {steps.map((s, i) => {
                const dec = s.type === '判断';
                return (
                  <tr key={s.stepId} className={dec ? 'dec' : ''}>
                    <td className="no">{i + 1}</td>
                    <td><input list="actors" value={s.actor} placeholder="例：営業担当" onChange={e => set(i, { actor: e.target.value })} aria-label="担当者" /></td>
                    <td className="wide"><input value={s.action} placeholder={dec ? '例：内容は正しいか？' : '例：請求書を作成する'} onChange={e => set(i, { action: e.target.value })} aria-label="作業内容" /></td>
                    <td><select value={s.type} onChange={e => set(i, { type: e.target.value as Step['type'] })} aria-label="種別"><option>作業</option><option>判断</option></select></td>
                    <td>{nextSelect(s, 'next1', '次の行（自動）')}</td>
                    <td><input value={s.cond1} disabled={!dec} placeholder={dec ? '例：承認' : ''} onChange={e => set(i, { cond1: e.target.value })} aria-label="条件1" /></td>
                    <td>{dec ? nextSelect(s, 'next2', '（未設定）') : <select disabled aria-label="分岐2"><option>―</option></select>}</td>
                    <td><input value={s.cond2} disabled={!dec} placeholder={dec ? '例：差し戻し' : ''} onChange={e => set(i, { cond2: e.target.value })} aria-label="条件2" /></td>
                    <td className="num"><input type="number" min={0} value={s.minutes} onChange={e => set(i, { minutes: numOrBlank(e.target.value) })} aria-label="所要時間（分）" /></td>
                    <td><select value={s.tool} onChange={e => set(i, { tool: e.target.value })} aria-label="使用ツール"><option value="">―</option>{TOOLS.map(t => <option key={t}>{t}</option>)}</select></td>
                    <td><input value={s.notes} onChange={e => set(i, { notes: e.target.value })} aria-label="備考" /></td>
                    <td className="ops">
                      <button className="icon" title="上へ" aria-label="上へ" onClick={() => move(i, -1)}>↑</button>
                      <button className="icon" title="下へ" aria-label="下へ" onClick={() => move(i, 1)}>↓</button>
                      <button className="icon" title="この下に工程を追加" aria-label="この下に追加" onClick={() => insertAfter(i)}>＋</button>
                      <button className="danger" onClick={() => remove(i)}>削除</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="steps">
            <thead><tr><th>#</th><th>作業内容</th><th>改善希望</th><th>情報の種類</th><th>ルールの明確さ</th><th>判断リスク</th><th>改善方式</th><th>判定理由</th><th>改善後の工程名</th><th>改善後 分/件</th></tr></thead>
            <tbody>
              {steps.map((s, i) => {
                const auto = classify(s);
                return (
                  <tr key={s.stepId}>
                    <td className="no">{i + 1}</td>
                    <td className="label">{s.action || '（未入力）'}</td>
                    <td><select value={s.improvement} onChange={e => set(i, { improvement: e.target.value })} aria-label="改善希望">{WISHES.map(t => <option key={t}>{t}</option>)}</select></td>
                    <td><select value={s.infoType} onChange={e => set(i, { infoType: e.target.value })} aria-label="情報の種類">{INFO_TYPES.map(t => <option key={t}>{t}</option>)}</select></td>
                    <td><select value={s.ruleClarity} onChange={e => set(i, { ruleClarity: e.target.value })} aria-label="ルールの明確さ">{RULE_CLARITY.map(t => <option key={t}>{t}</option>)}</select></td>
                    <td><select value={s.riskLevel} onChange={e => set(i, { riskLevel: e.target.value })} aria-label="判断リスク">{RISK_LEVELS.map(t => <option key={t}>{t}</option>)}</select></td>
                    <td><select value={s.methodOverride} onChange={e => set(i, { methodOverride: e.target.value as Step['methodOverride'] })} aria-label="改善方式">
                      <option value="">自動：{auto.type}</option>{METHODS.map(m => <option key={m} value={m}>手動：{m}</option>)}</select></td>
                    <td className="reason">{s.methodOverride ? '手動で選択した方式です。' : auto.reason}</td>
                    <td><input value={s.tobeTitle} placeholder="空ならテンプレート" onChange={e => set(i, { tobeTitle: e.target.value })} aria-label="改善後の工程名" /></td>
                    <td className="num"><input type="number" min={0} value={s.tobeMinutes} placeholder="自動" onChange={e => set(i, { tobeMinutes: numOrBlank(e.target.value) })} aria-label="改善後所要時間（分）" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="bar" style={{ marginTop: 10 }}>
        <button className="secondary" onClick={() => onChange([...steps, newStep({ actor: steps[steps.length - 1]?.actor || '' })])}>＋ 工程を追加</button>
      </div>
    </section>
  );
}
