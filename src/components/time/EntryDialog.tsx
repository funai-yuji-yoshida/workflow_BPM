import { useEffect, useMemo, useRef, useState } from 'react';
import { SNAP, type Entry, type Genre } from '../../time/types';
import { hhmm } from '../../time/dates';

interface Props {
  entry: Entry;
  isNew: boolean;
  genres: Genre[];
  entries: Entry[];
  last: Entry | null;
  onSave: (e: Entry, asTemplate: boolean) => void;
  onDelete: () => void;
  onClose: () => void;
}

const TIMES = Array.from({ length: 24 * 60 / SNAP + 1 }, (_, i) => i * SNAP);

export function EntryDialog({ entry, isNew, genres, entries, last, onSave, onDelete, onClose }: Props) {
  const [e, setE] = useState<Entry>(entry);
  const [asTemplate, setAsTemplate] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);

  const visible = genres.filter(g => !g.hidden || g.genreId === e.genreId).sort((a, b) => a.order - b.order);
  const titles = useMemo(() => [...new Set(entries.map(x => x.title.trim()).filter(Boolean))].slice(0, 200), [entries]);
  const set = (p: Partial<Entry>) => { setE(x => ({ ...x, ...p })); setError(''); };
  // 作業内容が過去と同じなら、前回のジャンルを自動選択
  const setTitle = (title: string) => {
    const prev = [...entries].reverse().find(x => x.title.trim() === title.trim() && x.entryId !== e.entryId);
    set(prev && !e.genreId ? { title, genreId: prev.genreId } : prev && isNew ? { title, genreId: prev.genreId } : { title });
  };
  const sameAsLast = () => last && set({ title: last.title, genreId: last.genreId, count: last.count, memo: '' });
  const submit = () => {
    if (!e.title.trim()) return setError('作業内容を入力してください');
    if (!e.genreId) return setError('ジャンルを選んでください');
    if (e.endMin <= e.startMin) return setError('終了は開始より後にしてください');
    onSave({ ...e, title: e.title.trim() }, asTemplate);
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="entry-title" onKeyDown={ev => { if (ev.key === 'Enter' && (ev.target as HTMLElement).tagName === 'INPUT') { ev.preventDefault(); submit(); } }}>
      <h2 id="entry-title">{isNew ? '作業を記録' : '記録を編集'}</h2>
      {isNew && last && <button type="button" className="secondary small" onClick={sameAsLast}>直前と同じ（{last.title}）</button>}
      <label>作業内容 *
        <input autoFocus list="entry-titles" value={e.title} placeholder="例：請求書作成、問い合わせメール返信" onChange={ev => setTitle(ev.target.value)} />
      </label>
      <datalist id="entry-titles">{titles.map(t => <option key={t} value={t} />)}</datalist>
      <fieldset className="genres">
        <legend>ジャンル *</legend>
        {visible.map(g => (
          <label key={g.genreId} className={'chip' + (e.genreId === g.genreId ? ' on' : '')} style={{ '--c': g.color } as React.CSSProperties}>
            <input type="radio" name="genre" value={g.genreId} checked={e.genreId === g.genreId} onChange={() => set({ genreId: g.genreId })} />
            <i />{g.name}
          </label>
        ))}
      </fieldset>
      <div className="grid3">
        <label>日付<input type="date" value={e.date} onChange={ev => ev.target.value && set({ date: ev.target.value })} /></label>
        <label>開始<select value={e.startMin} onChange={ev => { const s = Number(ev.target.value); set({ startMin: s, endMin: Math.max(e.endMin, s + SNAP) }); }}>{TIMES.slice(0, -1).map(t => <option key={t} value={t}>{hhmm(t)}</option>)}</select></label>
        <label>終了<select value={e.endMin} onChange={ev => set({ endMin: Number(ev.target.value) })}>{TIMES.slice(1).map(t => <option key={t} value={t} disabled={t <= e.startMin}>{hhmm(t)}</option>)}</select></label>
      </div>
      <div className="grid3">
        <label>処理件数（任意）<input type="number" min={0} value={e.count} placeholder="例：3" onChange={ev => set({ count: ev.target.value === '' ? '' : Math.max(0, Math.round(Number(ev.target.value) || 0)) })} /></label>
        <label className="span2">メモ（任意）<input value={e.memo} placeholder="割り込み・手戻りなど" onChange={ev => set({ memo: ev.target.value })} /></label>
      </div>
      <p className="muted">所要時間：{(e.endMin - e.startMin) / 60}時間{e.count ? `（${+((e.endMin - e.startMin) / Number(e.count)).toFixed(1)}分/件）` : ''}</p>
      {isNew && <label className="check"><input type="checkbox" checked={asTemplate} onChange={ev => setAsTemplate(ev.target.checked)} /> この内容を「よく使う作業」に登録する</label>}
      {error && <p className="err" role="alert">{error}</p>}
      <div className="bar end">
        {!isNew && <button type="button" className="danger" onClick={() => { if (confirm('この記録を削除しますか？')) onDelete(); }}>削除</button>}
        <span className="spacer" />
        <button type="button" className="secondary" onClick={() => ref.current?.close()}>キャンセル</button>
        <button type="button" onClick={submit}>保存</button>
      </div>
    </dialog>
  );
}
