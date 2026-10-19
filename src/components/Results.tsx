import { METHOD_INFO, impactOf, methodOf, tobeMinutes, tobeTitle } from '../domain/analysis';
import { METHODS, type Process } from '../domain/types';
import { METHOD_COLORS } from '../flow/engine';

const f1 = (n: number) => (+n.toFixed(1)).toLocaleString('ja-JP');

export function Results({ process }: { process: Process }) {
  const steps = process.steps.filter(s => s.action.trim());
  const imp = impactOf(process);
  return (
    <>
      <section className="panel">
        <h2>改善候補の集計</h2>
        <div className="metrics five">
          {METHODS.map(m => (
            <div key={m} className="metric" style={{ borderLeft: `4px solid ${METHOD_COLORS[m].stroke}` }}>
              <b>{steps.filter(s => methodOf(s).type === m).length}</b><span>{m}</span>
            </div>
          ))}
        </div>
        <p className="muted">入力条件にもとづく簡易ルールの判定です。AIによる判断ではなく、検討を始めるための仮説として扱ってください。</p>
      </section>

      <section className="panel">
        <h2>改善効果の試算</h2>
        <div className="metrics">
          <div className="metric"><b>{f1(imp.before)}分</b><span>現状の所要時間（1件）</span></div>
          <div className="metric"><b>{f1(imp.after)}分</b><span>改善後の想定（1件）</span></div>
          <div className="metric"><b>{f1(imp.saved)}分</b><span>短縮見込み（1件）</span></div>
          <div className="metric"><b>{imp.monthlyHours === null ? '―' : f1(imp.monthlyHours) + '時間'}</b><span>月間削減時間</span></div>
          <div className="metric"><b>{imp.yearlyHours === null ? '―' : f1(imp.yearlyHours) + '時間'}</b><span>年間削減時間</span></div>
        </div>
        {imp.monthlyHours === null && <p className="muted">月間処理件数を入力すると、月間・年間の試算を表示します。</p>}
        {imp.manual > 0 && <p className="muted">改善後所要時間を手入力した工程：{imp.manual}（その他は方式別の仮定短縮率で計算）</p>}
        <div className="caveat">試算値は、入力した所要時間・月間件数と、方式別の仮定短縮率（AI活用50%・自動化70%・AI＋人の確認30%・人の判断10%・要確認0%）から計算した参考値です。実測値や保証値ではありません。導入・確認・例外対応の時間は含みません。</div>
      </section>

      <section className="panel">
        <h2>改善後（To-Be）の提案</h2>
        {steps.length === 0 && <p className="muted">工程を入力すると表示します。</p>}
        <div className="todos">
          {steps.map((s, i) => {
            const m = methodOf(s), t = tobeMinutes(s), col = METHOD_COLORS[m.type];
            return (
              <div key={s.stepId} className="todo" style={{ borderLeft: `4px solid ${col.stroke}` }}>
                <h3>{i + 1}. {tobeTitle(s)}</h3>
                <p><span className="tag" style={{ background: col.fill, color: col.text }}>{m.type}</span> {METHOD_INFO[m.type].desc}</p>
                <p className="muted">判定理由：{m.reason}</p>
                <p className="muted">所要時間：{Number(s.minutes) || 0}分 → {f1(t.value)}分（{t.manual ? '手入力' : '仮定短縮率'}）</p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
