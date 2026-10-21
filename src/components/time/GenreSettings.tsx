import { useRef } from 'react';
import { PALETTE, SNAP, newGenre, type Genre, type TimeStore } from '../../time/types';
import { timeFromFileJson, timeToFileJson } from '../../time/storage';
import { downloadBlob, readTextFile } from '../../download';
import type { Process } from '../../domain/types';

interface Props { store: TimeStore; processes: Process[]; onChange: (s: TimeStore) => void; say: (t: string, err?: boolean) => void }

export function GenreSettings({ store, processes, onChange, say }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const genres = [...store.genres].sort((a, b) => a.order - b.order);
  const used = new Set(store.entries.map(e => e.genreId));
  const setGenres = (list: Genre[]) => onChange({ ...store, genres: list.map((g, i) => ({ ...g, order: i })) });
  const patch = (id: string, p: Partial<Genre>) => setGenres(genres.map(g => (g.genreId === id ? { ...g, ...p } : g)));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= genres.length) return; const a = [...genres];[a[i], a[j]] = [a[j], a[i]]; setGenres(a); };
  const add = () => setGenres([...genres, newGenre({ name: '新しいジャンル', color: PALETTE[genres.length % PALETTE.length] })]);
  const remove = (g: Genre) => {
    if (used.has(g.genreId)) return say('記録で使われているジャンルは削除できません。「非表示」にしてください。', true);
    if (confirm(`「${g.name}」を削除しますか？`)) { setGenres(genres.filter(x => x.genreId !== g.genreId)); }
  };
  const setNum = (k: keyof TimeStore['settings'], v: string, lo: number, hi: number) => onChange({ ...store, settings: { ...store.settings, [k]: Math.min(hi, Math.max(lo, Math.round(Number(v) || lo))) } });

  const exportJson = () => downloadBlob(new Blob([timeToFileJson(store)], { type: 'application/json' }), `時間記録_${new Date().toISOString().slice(0, 10)}.json`);
  const importJson = async (f: File | undefined) => {
    if (!f) return;
    try {
      const s = timeFromFileJson(await readTextFile(f));
      if (!confirm(`ファイルの時間記録（記録${s.entries.length}件・ジャンル${s.genres.length}個）で、この端末の時間記録を置き換えます。今の内容は消えます。よろしいですか？`)) return;
      onChange(s); say('時間記録を読み込みました');
    } catch (e) { say(`読み込めませんでした（${(e as Error).message}）`, true); }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <section className="panel">
        <div className="bar"><h2>ジャンル</h2><span className="spacer" /><button onClick={add}>＋ ジャンルを追加</button></div>
        <p className="muted">名前・色・並び順を自由に変えられます。業務フローの業務をひも付けると、その業務の画面に実測の「分/件」と月換算の件数が表示されます。</p>
        <div className="tablewrap">
          <table className="steps genres-t">
            <thead><tr><th>並び</th><th>名前</th><th>色</th><th>業務フローの業務</th><th>記録</th><th>表示</th><th></th></tr></thead>
            <tbody>
              {genres.map((g, i) => (
                <tr key={g.genreId} className={g.hidden ? 'hiddenrow' : ''}>
                  <td className="ops"><button className="icon" aria-label="上へ" onClick={() => move(i, -1)}>↑</button><button className="icon" aria-label="下へ" onClick={() => move(i, 1)}>↓</button></td>
                  <td className="wide"><input value={g.name} onChange={e => patch(g.genreId, { name: e.target.value })} aria-label="ジャンル名" /></td>
                  <td>
                    <div className="swatches" role="radiogroup" aria-label={`${g.name}の色`}>
                      {PALETTE.map(c => <button key={c} role="radio" aria-checked={g.color === c} aria-label={c} className={'sw' + (g.color === c ? ' on' : '')} style={{ background: c }} onClick={() => patch(g.genreId, { color: c })} />)}
                    </div>
                  </td>
                  <td>
                    <select value={g.processId} onChange={e => patch(g.genreId, { processId: e.target.value })} aria-label="ひも付ける業務">
                      <option value="">（ひも付けなし）</option>
                      {processes.map(p => <option key={p.processId} value={p.processId}>{p.title || '（業務名未設定）'}</option>)}
                      {g.processId && !processes.some(p => p.processId === g.processId) && <option value={g.processId}>（削除された業務）</option>}
                    </select>
                  </td>
                  <td className="numc">{store.entries.filter(e => e.genreId === g.genreId).length}件</td>
                  <td><label className="check"><input type="checkbox" checked={!g.hidden} onChange={e => patch(g.genreId, { hidden: !e.target.checked })} />表示</label></td>
                  <td><button className="danger" onClick={() => remove(g)} disabled={used.has(g.genreId)} title={used.has(g.genreId) ? '記録で使用中のため削除できません' : ''}>削除</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>よく使う作業</h2>
        <p className="muted">「時間記録」画面の右側にボタンとして並びます。記録の入力画面で「よく使う作業に登録」にチェックしても追加できます。</p>
        <div className="tablewrap">
          <table className="steps genres-t">
            <thead><tr><th>作業内容</th><th>ジャンル</th><th>標準時間（分）</th><th></th></tr></thead>
            <tbody>
              {store.templates.map(t => (
                <tr key={t.templateId}>
                  <td className="wide"><input value={t.title} onChange={e => onChange({ ...store, templates: store.templates.map(x => (x.templateId === t.templateId ? { ...x, title: e.target.value } : x)) })} aria-label="作業内容" /></td>
                  <td><select value={t.genreId} onChange={e => onChange({ ...store, templates: store.templates.map(x => (x.templateId === t.templateId ? { ...x, genreId: e.target.value } : x)) })} aria-label="ジャンル">{genres.map(g => <option key={g.genreId} value={g.genreId}>{g.name}</option>)}</select></td>
                  <td className="num"><select value={t.minutes} onChange={e => onChange({ ...store, templates: store.templates.map(x => (x.templateId === t.templateId ? { ...x, minutes: Number(e.target.value) } : x)) })} aria-label="標準時間">{Array.from({ length: 16 }, (_, i) => (i + 1) * SNAP).map(m => <option key={m} value={m}>{m}</option>)}</select></td>
                  <td><button className="danger" onClick={() => onChange({ ...store, templates: store.templates.filter(x => x.templateId !== t.templateId) })}>削除</button></td>
                </tr>
              ))}
              {store.templates.length === 0 && <tr><td colSpan={4} className="muted">まだありません</td></tr>}
            </tbody>
          </table>
        </div>
        <button className="secondary" style={{ marginTop: 8 }} onClick={() => onChange({ ...store, templates: [...store.templates, { templateId: 't' + Date.now().toString(36), title: '新しい作業', genreId: genres[0]?.genreId ?? '', minutes: 30 }] })}>＋ 追加</button>
      </section>

      <section className="panel">
        <h2>設定</h2>
        <div className="grid4">
          <label>表示の開始時刻<input type="number" min={0} max={23} value={store.settings.dayStartHour} onChange={e => setNum('dayStartHour', e.target.value, 0, Math.min(23, store.settings.dayEndHour - 1))} /></label>
          <label>表示の終了時刻<input type="number" min={1} max={24} value={store.settings.dayEndHour} onChange={e => setNum('dayEndHour', e.target.value, store.settings.dayStartHour + 1, 24)} /></label>
          <label>1日の勤務時間（目安）<input type="number" min={1} max={24} value={store.settings.workHoursPerDay} onChange={e => setNum('workHoursPerDay', e.target.value, 1, 24)} /></label>
          <label>月の稼働日数（月換算用）<input type="number" min={1} max={31} value={store.settings.workDaysPerMonth} onChange={e => setNum('workDaysPerMonth', e.target.value, 1, 31)} /></label>
        </div>
        <h3>時間記録のファイル</h3>
        <p className="muted">別の端末へ移すとき・バックアップするときに使います。時間記録は個人の行動の記録なので、提出を求められていない限り他人に渡さないでください。</p>
        <div className="bar">
          <button className="secondary" onClick={exportJson}>時間記録をファイルに保存（JSON）</button>
          <button className="secondary" onClick={() => fileRef.current?.click()}>ファイルから読み込む</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => importJson(e.target.files?.[0])} />
        </div>
      </section>
    </>
  );
}
