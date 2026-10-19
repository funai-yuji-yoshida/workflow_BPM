import { useEffect, useRef, useState } from 'react';
import { newProcess, uid, type Process } from './domain/types';
import { fileNameOf, fromFileJson, loadStore, saveStore, toFileJson, type Store } from './domain/storage';
import { invoiceSample } from './domain/samples';
import { impactOf } from './domain/analysis';
import { downloadBlob, readTextFile } from './download';
import { FlowView } from './components/FlowView';
import { StepTable } from './components/StepTable';
import { Results } from './components/Results';

function initialStore(): Store {
  const s = loadStore();
  if (s && s.processes.length) return { ...s, currentId: s.processes.some(p => p.processId === s.currentId) ? s.currentId : s.processes[0].processId };
  const p = invoiceSample();
  return { processes: [p], currentId: p.processId };
}

const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };

export default function App() {
  const [store, setStore] = useState<Store>(initialStore);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [storageOk, setStorageOk] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = store.processes.find(p => p.processId === store.currentId) ?? store.processes[0];

  useEffect(() => { setStorageOk(saveStore(store)); }, [store]);

  const say = (text: string, error = false) => setNotice({ text, error });
  const update = (patch: Partial<Process>) => setStore(s => ({ ...s, processes: s.processes.map(p => (p.processId === current.processId ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)) }));
  const addProcess = (p: Process, msg: string) => { setStore(s => ({ processes: [p, ...s.processes], currentId: p.processId })); say(msg); };
  const open = (id: string) => { setStore(s => ({ ...s, currentId: id })); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const remove = () => {
    if (!confirm(`「${current.title || '（業務名未設定）'}」をこの端末から削除します。元に戻せません。よろしいですか？`)) return;
    setStore(s => {
      const rest = s.processes.filter(p => p.processId !== current.processId);
      const list = rest.length ? rest : [newProcess()];
      return { processes: list, currentId: list[0].processId };
    });
    say('削除しました');
  };
  const duplicate = () => addProcess({ ...structuredClone(current), processId: uid('p'), title: (current.title || '業務') + '（コピー）', updatedAt: new Date().toISOString() }, '複製しました');
  const exportJson = () => downloadBlob(new Blob([toFileJson(current)], { type: 'application/json' }), fileNameOf(current, 'json'));
  const importJson = async (files: FileList | null) => {
    if (!files?.length) return;
    const ok: Process[] = [], ng: string[] = [];
    for (const f of [...files]) {
      try {
        const p = fromFileJson(await readTextFile(f));
        // 同じIDが既にあれば別の業務として取り込む（上書きしない）
        if (store.processes.some(x => x.processId === p.processId) || ok.some(x => x.processId === p.processId)) p.processId = uid('p');
        ok.push(p);
      } catch (e) { ng.push(`${f.name}（${(e as Error).message}）`); }
    }
    if (ok.length) setStore(s => ({ processes: [...ok, ...s.processes], currentId: ok[0].processId }));
    say(`${ok.length}件を読み込みました。` + (ng.length ? ` 読み込めなかったファイル：${ng.join('、')}` : ''), ng.length > 0 && !ok.length);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <header className="top">
        <div>
          <h1>AI業務分解ナビ</h1>
          <p>業務を工程に分解し、担当者別のフロー図と改善候補を整理します</p>
        </div>
        <a className="help" href="guide.html" target="_blank" rel="noopener">使い方</a>
      </header>
      <main>
        <div className="privacy" role="note">
          入力内容は<b>このブラウザの中だけ</b>に保存され、サーバーには送信されません。別の端末で使う・講師に提出するときは「ファイルに保存（JSON）」を使ってください。
          {!storageOk && <span className="err"> ※このブラウザでは自動保存が使えません。終了前に必ずファイルに保存してください。</span>}
        </div>

        <section className="panel">
          <div className="bar">
            <h2>業務</h2>
            <select className="picker" value={current.processId} onChange={e => open(e.target.value)} aria-label="業務を選ぶ">
              {store.processes.map(p => <option key={p.processId} value={p.processId}>{p.title || '（業務名未設定）'}{p.author ? `／${p.author}` : ''}</option>)}
            </select>
            <span className="spacer" />
            <button onClick={() => addProcess(newProcess(), '新しい業務を作成しました')}>＋ 新しい業務</button>
            <button className="secondary" onClick={() => addProcess(invoiceSample(), 'サンプルを追加しました')}>サンプル</button>
            <button className="secondary" onClick={duplicate}>複製</button>
            <button className="secondary" onClick={exportJson}>ファイルに保存（JSON）</button>
            <button className="secondary" onClick={() => fileRef.current?.click()}>ファイルを開く</button>
            <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={e => importJson(e.target.files)} />
            <button className="danger" onClick={remove}>削除</button>
          </div>
          {notice && <p className={notice.error ? 'notice err' : 'notice'} role="status">{notice.text}</p>}
          <div className="grid4">
            <label>業務名 *<input value={current.title} placeholder="例：請求書発行" onChange={e => update({ title: e.target.value })} /></label>
            <label>担当部署<input value={current.department} placeholder="例：経理" onChange={e => update({ department: e.target.value })} /></label>
            <label>作成者（任意）<input value={current.author} placeholder="講師に提出する場合は氏名" onChange={e => update({ author: e.target.value })} /></label>
            <label>月間処理件数<input type="number" min={0} value={current.monthlyVolume} placeholder="例：200" onChange={e => update({ monthlyVolume: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })} /></label>
          </div>
          <label>現在の困りごと<textarea value={current.painPoints} placeholder="例：確認に時間がかかる、担当者によって対応が異なる" onChange={e => update({ painPoints: e.target.value })} /></label>
        </section>

        <FlowView process={current} />
        <StepTable steps={current.steps} onChange={steps => update({ steps })} />
        <Results process={current} />

        <section className="panel">
          <h2>この端末に保存されている業務（{store.processes.length}件）</h2>
          <p className="muted">講師の方は、受講者から受け取ったJSONファイルを「ファイルを開く」でまとめて読み込むと、ここで一覧できます（複数選択可）。</p>
          <div className="tablewrap">
            <table className="list">
              <thead><tr><th>業務名</th><th>作成者</th><th>担当部署</th><th>工程数</th><th>短縮見込み</th><th>更新日時</th><th></th></tr></thead>
              <tbody>
                {store.processes.map(p => {
                  const imp = impactOf(p);
                  return (
                    <tr key={p.processId} className={p.processId === current.processId ? 'current' : ''}>
                      <td>{p.title || '（業務名未設定）'}</td><td>{p.author}</td><td>{p.department}</td>
                      <td className="numc">{p.steps.filter(s => s.action.trim()).length}</td>
                      <td className="numc">{(+imp.saved.toFixed(1))}分/件{imp.monthlyHours !== null ? `・${+imp.monthlyHours.toFixed(1)}時間/月` : ''}</td>
                      <td>{fmtDate(p.updatedAt)}</td>
                      <td><button className="secondary" onClick={() => open(p.processId)} disabled={p.processId === current.processId}>開く</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <footer className="muted">改善方式の分類と効果試算は参考情報です。業務変更の最終判断は利用者・業務責任者が行ってください。実在の顧客の個人情報・機密情報は入力しないでください。</footer>
      </main>
    </>
  );
}
