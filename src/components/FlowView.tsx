import { useMemo, useState } from 'react';
import { ASIS_COLORS, METHOD_COLORS, renderFlow, type Mode } from '../flow/engine';
import type { Process } from '../domain/types';
import { fileNameOf } from '../domain/storage';
import { downloadBlob, svgToPngBlob } from '../download';

export function FlowView({ process }: { process: Process }) {
  const [mode, setMode] = useState<Mode>('asis');
  const steps = useMemo(() => process.steps.filter(s => s.action.trim()), [process.steps]);
  const { svg, issues } = useMemo(() => renderFlow(steps, mode), [steps, mode]);
  const name = (ext: string) => fileNameOf({ ...process, title: (process.title || '業務フロー') + (mode === 'tobe' ? '_ToBe' : '_AsIs') }, ext);
  const saveSvg = () => downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), name('svg'));
  const savePng = async () => { try { downloadBlob(await svgToPngBlob(svg), name('png')); } catch { alert('PNGを作成できませんでした。SVG保存をお試しください。'); } };

  return (
    <section className="panel">
      <div className="bar">
        <h2>業務フロー図</h2>
        <span className="spacer" />
        <div className="seg" role="tablist" aria-label="表示する図">
          <button role="tab" aria-selected={mode === 'asis'} className={mode === 'asis' ? 'on' : ''} onClick={() => setMode('asis')}>現状（As-Is）</button>
          <button role="tab" aria-selected={mode === 'tobe'} className={mode === 'tobe' ? 'on' : ''} onClick={() => setMode('tobe')}>改善後（To-Be）</button>
        </div>
        <button className="secondary" onClick={savePng} disabled={!svg}>PNG保存</button>
        <button className="secondary" onClick={saveSvg} disabled={!svg}>SVG保存</button>
      </div>
      <div className="legend">
        {mode === 'tobe'
          ? Object.entries(METHOD_COLORS).map(([k, v]) => <span key={k}><i style={{ background: v.fill, borderColor: v.stroke }} />{k}</span>)
          : <>
            <span><i style={{ background: ASIS_COLORS.task.fill, borderColor: ASIS_COLORS.task.stroke }} />作業</span>
            <span><i style={{ background: ASIS_COLORS.decision.fill, borderColor: ASIS_COLORS.decision.stroke }} />判断（ひし形）</span>
            <span><i style={{ background: ASIS_COLORS.terminal, borderColor: ASIS_COLORS.terminal }} />開始・終了（自動）</span>
          </>}
        <span><i style={{ background: '#fff', borderColor: ASIS_COLORS.back, borderStyle: 'dashed' }} />差し戻し（点線）</span>
      </div>
      {svg
        ? <div className="diagram" dangerouslySetInnerHTML={{ __html: svg }} />
        : <p className="muted empty">工程の「作業内容」を入力するとフロー図を表示します。</p>}
      <div className="issues" aria-live="polite">
        {steps.length > 0 && (issues.length
          ? issues.map((i, k) => <div key={k} className={i.level}>{i.level === 'error' ? 'エラー：' : '注意：'}{i.text}</div>)
          : <div className="ok">入力チェック：問題ありません</div>)}
      </div>
    </section>
  );
}
