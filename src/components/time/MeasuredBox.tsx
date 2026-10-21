import type { Process } from '../../domain/types';
import type { TimeStore } from '../../time/types';
import { measuredFor } from '../../time/aggregate';
import { labelYmd } from '../../time/dates';

interface Props { process: Process; time: TimeStore; onApplyVolume: (n: number) => void; onLink: () => void }

/** 業務にひも付いたジャンルの実測値（時間記録から） */
export function MeasuredBox({ process, time, onApplyVolume, onLink }: Props) {
  const linked = time.genres.filter(g => g.processId === process.processId);
  if (!linked.length) return <p className="muted measured-hint">時間記録の「ジャンル設定」でこの業務をジャンルにひも付けると、実測の分/件と月間件数がここに表示されます。<button className="link" onClick={onLink}>ジャンル設定を開く</button></p>;
  const m = measuredFor(time.entries, linked.map(g => g.genreId), time.settings);
  const names = linked.map(g => g.name).join('・');
  if (!m) return <div className="measured"><b>実測（{names}）</b>：まだ記録がありません。</div>;
  const stepsTotal = process.steps.filter(s => s.action.trim()).reduce((s, x) => s + (Number(x.minutes) || 0), 0);
  const monthly = m.monthly === null ? null : Math.round(m.monthly);
  const gap = m.perItem !== null && stepsTotal > 0 ? Math.abs(stepsTotal - m.perItem) / m.perItem : 0;
  return (
    <div className="measured">
      <b>実測（時間記録：{names}）</b>
      <span>{labelYmd(m.from)}〜{labelYmd(m.to)}・合計 {+(m.minutes / 60).toFixed(1)}時間・{m.records}回</span>
      {m.perItem !== null
        ? <span>処理 {m.count}件 → <b>{+m.perItem.toFixed(1)}分/件</b>、月換算 <b>約{monthly}件</b>（{m.recordedDays}日記録・月{time.settings.workDaysPerMonth}日で換算）</span>
        : <span>処理件数が記録されていないため、分/件・月換算は計算できません（記録に「処理件数」を入れてください）。</span>}
      {monthly !== null && monthly !== Number(process.monthlyVolume) && (
        <button className="secondary small" onClick={() => { if (confirm(`月間処理件数を ${process.monthlyVolume || '未入力'} → ${monthly}件 に更新しますか？`)) onApplyVolume(monthly); }}>月間処理件数に反映（{monthly}件）</button>
      )}
      {gap > 0.3 && <span className="cau">工程の所要時間の合計（{stepsTotal}分/件）と実測（{+m.perItem!.toFixed(1)}分/件）に差があります。工程の抜けや時間の見積もりを見直してください。</span>}
    </div>
  );
}
