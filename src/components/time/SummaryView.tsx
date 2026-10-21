import { useMemo, useState } from 'react';
import type { TimeStore, Genre } from '../../time/types';
import { buckets, byTitle, summarize, toCsv, minutesOf, type Bucket } from '../../time/aggregate';
import { daysIn, fromYmd, hhmm, labelRange, labelYmd, periodRange, shiftAnchor, todayYmd, type PeriodKind, type Range } from '../../time/dates';
import { downloadBlob, svgToPngBlob } from '../../download';

interface Props { store: TimeStore; onDecompose: (g: Genre) => void }

const h = (m: number) => +(m / 60).toFixed(1);
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** 積み上げ棒グラフ（自前SVG）。文字列はすべてエスケープ */
function stackedSvg(bs: Bucket[], genres: Genre[], unit: 'day' | 'week'): string {
  const W = Math.max(560, bs.length * 34 + 70), H = 260, L = 44, B = 40, T = 14, cw = (W - L - 10) / Math.max(1, bs.length);
  const max = Math.max(60, ...bs.map(b => b.total)), top = Math.ceil(max / 60 / 2) * 2 * 60, y = (m: number) => T + (H - T - B) * (1 - m / top);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial,'Noto Sans JP','Yu Gothic',sans-serif" role="img" aria-label="ジャンル別の時間の積み上げ棒グラフ"><rect width="${W}" height="${H}" fill="#fff"/>`;
  for (let m = 0; m <= top; m += top / 4) s += `<line x1="${L}" x2="${W - 10}" y1="${y(m)}" y2="${y(m)}" stroke="#e3e8ef"/><text x="${L - 6}" y="${y(m)}" font-size="10" fill="#5f6368" text-anchor="end" dominant-baseline="central">${h(m)}h</text>`;
  const order = [...genres].sort((a, b) => a.order - b.order);
  bs.forEach((b, i) => {
    const x = L + i * cw + cw * 0.18, w = cw * 0.64;
    let acc = 0;
    order.forEach(g => {
      const m = b.byGenre[g.genreId]; if (!m) return;
      s += `<rect x="${x}" y="${y(acc + m)}" width="${w}" height="${y(acc) - y(acc + m)}" fill="${g.color}"><title>${esc(`${labelYmd(b.start)} ${g.name}：${h(m)}時間`)}</title></rect>`;
      acc += m;
    });
    const other = b.total - acc;
    if (other > 0) s += `<rect x="${x}" y="${y(acc + other)}" width="${w}" height="${y(acc) - y(acc + other)}" fill="#bdc1c6"/>`;
    if (b.total) s += `<text x="${x + w / 2}" y="${y(b.total) - 6}" font-size="10" fill="#202124" text-anchor="middle">${h(b.total)}</text>`;
    const d = fromYmd(b.start);
    const lab = unit === 'week' ? `${d.getMonth() + 1}/${d.getDate()}〜` : `${d.getMonth() + 1}/${d.getDate()}`;
    s += `<text x="${x + w / 2}" y="${H - B + 14}" font-size="10" fill="#5f6368" text-anchor="middle">${esc(lab)}</text>`;
    if (unit === 'day') s += `<text x="${x + w / 2}" y="${H - B + 27}" font-size="10" fill="#5f6368" text-anchor="middle">${'日月火水木金土'[d.getDay()]}</text>`;
  });
  return s + '</svg>';
}

export function SummaryView({ store, onDecompose }: Props) {
  const { genres, entries, settings } = store;
  const [kind, setKind] = useState<PeriodKind>('week');
  const [anchor, setAnchor] = useState(todayYmd());
  const [custom, setCustom] = useState<Range>(() => periodRange('month', todayYmd(), settings.weekStart));
  const [detail, setDetail] = useState('');
  const range = kind === 'custom' ? custom : periodRange(kind, anchor, settings.weekStart);
  const sum = useMemo(() => summarize(entries, genres, range), [entries, genres, range.start, range.end]);
  const unit: 'day' | 'week' = daysIn(range).length > 31 || kind === 'month' ? 'week' : 'day';
  const bs = useMemo(() => buckets(entries, range, unit, settings.weekStart), [entries, range.start, range.end, unit]);
  const svg = useMemo(() => stackedSvg(bs, genres, unit), [bs, genres, unit]);
  const detailRows = detail ? byTitle(entries, detail, range) : [];
  const top3 = sum.rows.slice(0, 3).map(r => r.genre.genreId);
  const label = kind === 'custom' ? `${labelYmd(range.start)}〜${labelYmd(range.end)}` : labelRange(kind, range);
  const fname = (k: string) => `時間記録_${k}_${range.start}_${range.end}.csv`;

  const csvEntries = () => downloadBlob(new Blob([toCsv([
    ['日付', '開始', '終了', '時間(分)', 'ジャンル', '作業内容', '処理件数', 'メモ'],
    ...entries.filter(e => e.date >= range.start && e.date <= range.end).sort((a, b) => (a.date + hhmm(a.startMin)).localeCompare(b.date + hhmm(b.startMin)))
      .map(e => [e.date, hhmm(e.startMin), e.endMin >= 1440 ? '24:00' : hhmm(e.endMin), minutesOf(e), genres.find(g => g.genreId === e.genreId)?.name ?? '', e.title, e.count === '' ? '' : e.count, e.memo]),
  ])], { type: 'text/csv' }), fname('記録一覧'));
  const csvSummary = () => downloadBlob(new Blob([toCsv([
    ['ジャンル', '合計時間(時間)', '割合(%)', '記録回数', '処理件数', '分/件', '1日平均(分)'],
    ...sum.rows.map(r => [r.genre.name, h(r.minutes), +(r.share * 100).toFixed(1), r.records, r.count, r.perItem === null ? '' : +r.perItem.toFixed(1), +r.dailyAvg.toFixed(1)]),
    ['合計', h(sum.total), 100, sum.rows.reduce((s, r) => s + r.records, 0), sum.rows.reduce((s, r) => s + r.count, 0), '', sum.recordedDays ? +(sum.total / sum.recordedDays).toFixed(1) : ''],
  ])], { type: 'text/csv' }), fname('ジャンル別集計'));
  const png = async () => { try { downloadBlob(await svgToPngBlob(svg), `時間記録_グラフ_${range.start}_${range.end}.png`); } catch { alert('PNGを作成できませんでした'); } };

  return (
    <>
      <section className="panel">
        <div className="bar">
          <h2>集計</h2>
          <div className="seg" role="tablist" aria-label="期間の種類">
            {(['day', 'week', 'month', 'custom'] as PeriodKind[]).map(k => (
              <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{{ day: '日', week: '週', month: '月', custom: '期間指定' }[k]}</button>
            ))}
          </div>
          {kind !== 'custom' ? (
            <>
              <button className="icon" aria-label="前へ" onClick={() => setAnchor(a => shiftAnchor(kind, a, -1))}>◀</button>
              <b className="period">{label}</b>
              <button className="icon" aria-label="次へ" onClick={() => setAnchor(a => shiftAnchor(kind, a, 1))}>▶</button>
              <button className="secondary" onClick={() => setAnchor(todayYmd())}>今日</button>
            </>
          ) : (
            <span className="bar">
              <input type="date" value={custom.start} onChange={e => e.target.value && setCustom(c => ({ start: e.target.value, end: e.target.value > c.end ? e.target.value : c.end }))} aria-label="開始日" style={{ width: 150 }} />〜
              <input type="date" value={custom.end} onChange={e => e.target.value && setCustom(c => ({ start: e.target.value < c.start ? e.target.value : c.start, end: e.target.value }))} aria-label="終了日" style={{ width: 150 }} />
            </span>
          )}
          <span className="spacer" />
          <button className="secondary" onClick={csvSummary} disabled={!sum.total}>集計CSV</button>
          <button className="secondary" onClick={csvEntries} disabled={!sum.total}>記録一覧CSV</button>
        </div>
        <div className="metrics four">
          <div className="metric"><b>{h(sum.total)}時間</b><span>記録の合計</span></div>
          <div className="metric"><b>{sum.recordedDays}日</b><span>記録した日数</span></div>
          <div className="metric"><b>{sum.recordedDays ? h(sum.total / sum.recordedDays) : 0}時間</b><span>1日平均（記録した日）</span></div>
          <div className="metric"><b>{h(sum.covered)}時間</b><span>重なりを除いた記録時間</span></div>
        </div>
        {!sum.total && <p className="empty muted">この期間の記録はありません。「時間記録」で作業を記録してください。</p>}
      </section>

      {sum.total > 0 && (
        <>
          <section className="panel">
            <div className="bar"><h2>{unit === 'day' ? '日別' : '週別'}の内訳</h2><span className="spacer" /><button className="secondary" onClick={png}>PNG保存</button></div>
            <div className="chart" dangerouslySetInnerHTML={{ __html: svg }} />
          </section>

          <section className="panel">
            <h2>ジャンル別</h2>
            <p className="muted">時間の多い順。<b>上位3つ</b>は改善の候補です。「業務フローで分解する」で、そのジャンルの業務を工程に分解できます。分/件は処理件数を入れた記録だけで計算します。</p>
            <div className="tablewrap">
              <table className="list sum">
                <thead><tr><th>ジャンル</th><th>合計</th><th className="barcol">割合</th><th>記録</th><th>処理件数</th><th>分/件</th><th>1日平均</th><th></th></tr></thead>
                <tbody>
                  {sum.rows.map(r => (
                    <tr key={r.genre.genreId} className={top3.includes(r.genre.genreId) ? 'top' : ''}>
                      <td><button className="link" onClick={() => setDetail(d => (d === r.genre.genreId ? '' : r.genre.genreId))} aria-expanded={detail === r.genre.genreId}><i className="dot" style={{ background: r.genre.color }} />{r.genre.name}</button></td>
                      <td className="numc">{h(r.minutes)}h</td>
                      <td className="barcol"><span className="hbar"><span style={{ width: `${r.share * 100}%`, background: r.genre.color }} /></span>{Math.round(r.share * 100)}%</td>
                      <td className="numc">{r.records}回</td>
                      <td className="numc">{r.count || '―'}</td>
                      <td className="numc">{r.perItem === null ? '―' : `${+r.perItem.toFixed(1)}分`}</td>
                      <td className="numc">{Math.round(r.dailyAvg)}分</td>
                      <td>{top3.includes(r.genre.genreId) && <button className="secondary small" onClick={() => onDecompose(r.genre)}>業務フローで分解する</button>}</td>
                    </tr>
                  ))}
                  {sum.uncategorized > 0 && <tr><td>（削除されたジャンル）</td><td className="numc">{h(sum.uncategorized)}h</td><td colSpan={6} /></tr>}
                </tbody>
              </table>
            </div>
            {detail && (
              <div className="detail">
                <h3>{genres.find(g => g.genreId === detail)?.name} の作業内容別</h3>
                <table className="list">
                  <thead><tr><th>作業内容</th><th>合計</th><th>記録</th><th>処理件数</th></tr></thead>
                  <tbody>{detailRows.map(d => <tr key={d.title}><td>{d.title}</td><td className="numc">{h(d.minutes)}h</td><td className="numc">{d.records}回</td><td className="numc">{d.count || '―'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
