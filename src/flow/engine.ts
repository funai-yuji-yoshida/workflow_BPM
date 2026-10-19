/* 業務フロー描画エンジン（自前SVG）。prototype/flow_prototype.html・GAS版 Index.html と同じ表記ルール
   - 縦レーン（列＝担当者・登場順）、1工程＝1行、上→下
   - 開始・終了は自動生成、判断はひし形、前の工程へ戻る矢印は差し戻し（点線・オレンジ） */
import type { Method, Step } from '../domain/types';
import { METHOD_INFO, methodOf, tobeMinutes, tobeTitle } from '../domain/analysis';

export type Mode = 'asis' | 'tobe';
export interface Issue { level: 'error' | 'warn'; text: string }

const C = { LANE_W: 236, GAP: 14, M: 14, HEAD: 40, TOP: 62, ROW_H: 116, TASK_W: 168, TASK_H: 54, DEC_W: 184, DEC_H: 76, PILL_W: 116, PILL_H: 34, STUB: 14 };

export const METHOD_COLORS: Record<Method, { fill: string; stroke: string; text: string }> = {
  'AI活用候補': { fill: '#efe7ff', stroke: '#7c4dff', text: '#3b1f8f' },
  '通常の自動化候補': { fill: '#e3f5e8', stroke: '#1e8e3e', text: '#0d4f22' },
  'AI＋人の確認': { fill: '#dff3fa', stroke: '#0b8bb5', text: '#074a61' },
  '人の判断を中心': { fill: '#eceff1', stroke: '#607d8b', text: '#263238' },
  '追加確認が必要': { fill: '#fff6d6', stroke: '#c99700', text: '#5c4500' },
};
export const ASIS_COLORS = { task: { fill: '#eaf1ff', stroke: '#7fa3f5', text: '#17365d' }, decision: { fill: '#2f6df6', stroke: '#2f6df6', text: '#ffffff' }, terminal: '#1f4fd8', back: '#e8710a', line: '#4a5566' };

type Port = 'T' | 'B' | 'L' | 'R';
const PORTS: Record<Port, [number, number]> = { T: [0, -1], B: [0, 1], L: [-1, 0], R: [1, 0] };
interface Pt { x: number; y: number }
interface FlowNode { id: string; kind: 'start' | 'end' | 'task' | 'decision'; lane: number; row: number; w: number; h: number; cx: number; cy: number; label?: string; step?: Step; no?: number }
interface Edge { from: string; to: string; label: string; back?: boolean; pts?: Pt[] }
interface Model { nodes: FlowNode[]; edges: Edge[]; issues: Issue[]; lanes: string[]; rows: number; byId: Record<string, FlowNode> }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const actorOf = (s: Step) => s.actor.trim() || '担当者未設定';
const laneX0 = (i: number) => C.M + i * (C.LANE_W + C.GAP);
const rowY0 = (r: number) => C.TOP + r * C.ROW_H;

/** 工程データ → ノード・矢印・入力チェック結果 */
export function analyze(steps: Step[]): Model {
  const issues: Issue[] = [], lanes: string[] = [], nodes: FlowNode[] = [], byId: Record<string, FlowNode> = {}, edges: Edge[] = [];
  steps.forEach(s => { const a = actorOf(s); if (!lanes.includes(a)) lanes.push(a); });
  const add = (n: Omit<FlowNode, 'cx' | 'cy'>) => { const m = { ...n, cx: laneX0(n.lane) + C.LANE_W / 2, cy: rowY0(n.row) + C.ROW_H / 2 }; nodes.push(m); byId[m.id] = m; return m; };
  if (!steps.length) return { nodes, edges, issues, lanes, rows: 0, byId };
  const stepIds = new Set(steps.map(s => s.stepId));
  add({ id: '__start', kind: 'start', lane: lanes.indexOf(actorOf(steps[0])), row: 0, w: C.PILL_W, h: C.PILL_H, label: '開始' });
  steps.forEach((s, i) => { const dec = s.type === '判断'; add({ id: s.stepId, kind: dec ? 'decision' : 'task', lane: lanes.indexOf(actorOf(s)), row: i + 1, w: dec ? C.DEC_W : C.TASK_W, h: dec ? C.DEC_H : C.TASK_H, step: s, no: i + 1 }); });
  edges.push({ from: '__start', to: steps[0].stepId, label: '' });
  const ok = (t: string, no: number, which: string, self: string) => {
    if (t === self) { issues.push({ level: 'error', text: `工程${no}：${which}が自分自身になっています` }); return false; }
    if (t === 'END' || stepIds.has(t)) return true;
    issues.push({ level: 'error', text: `工程${no}：${which}の行き先が見つかりません。選び直してください` }); return false;
  };
  steps.forEach((s, i) => {
    const no = i + 1, auto = i + 1 < steps.length ? steps[i + 1].stepId : 'END';
    if (s.type === '判断') {
      if (!s.next1 || !s.next2) issues.push({ level: 'error', text: `工程${no}：判断工程には分岐を2つ設定してください` });
      if (!s.cond1.trim() || (s.next2 && !s.cond2.trim())) issues.push({ level: 'error', text: `工程${no}：分岐の条件（例：承認／差し戻し）を入力してください` });
      if (s.next1 && s.next1 === s.next2) issues.push({ level: 'warn', text: `工程${no}：2つの分岐が同じ行き先です` });
      const t1 = s.next1 || auto;
      if (ok(t1, no, '分岐1', s.stepId)) edges.push({ from: s.stepId, to: t1, label: s.cond1.trim() });
      if (s.next2 && ok(s.next2, no, '分岐2', s.stepId)) edges.push({ from: s.stepId, to: s.next2, label: s.cond2.trim() });
    } else {
      const t = s.next1 || auto;
      if (ok(t, no, '次工程', s.stepId)) edges.push({ from: s.stepId, to: t, label: '' });
    }
  });
  let rows = steps.length + 1;
  const toEnd = edges.filter(e => e.to === 'END');
  if (toEnd.length) {
    const last = toEnd.map(e => byId[e.from]).sort((a, b) => b.row - a.row)[0];
    add({ id: '__end', kind: 'end', lane: last.lane, row: steps.length + 1, w: C.PILL_W, h: C.PILL_H, label: '終了' });
    toEnd.forEach(e => (e.to = '__end')); rows++;
  } else issues.push({ level: 'warn', text: '終了につながる工程がありません' });
  edges.forEach(e => (e.back = byId[e.to].row <= byId[e.from].row));
  const reach = (start: string, forward: boolean) => {
    const seen = new Set([start]), q = [start];
    while (q.length) { const c = q.shift()!; edges.forEach(e => { const [a, b] = forward ? [e.from, e.to] : [e.to, e.from]; if (a === c && !seen.has(b)) { seen.add(b); q.push(b); } }); }
    return seen;
  };
  const fromStart = reach('__start', true), toEndSet = byId.__end ? reach('__end', false) : new Set<string>();
  const orphan = steps.map((_, i) => i + 1).filter(n => !fromStart.has(steps[n - 1].stepId));
  if (orphan.length) issues.push({ level: 'warn', text: `つながっていない工程があります（工程${orphan.join('・')}）` });
  const dead = steps.map((_, i) => i + 1).filter(n => fromStart.has(steps[n - 1].stepId) && byId.__end && !toEndSet.has(steps[n - 1].stepId));
  if (dead.length) issues.push({ level: 'warn', text: `終了につながらない流れがあります（工程${dead.join('・')}）` });
  if (lanes.length > 6) issues.push({ level: 'warn', text: `担当者が${lanes.length}名います。6名以内を推奨します（業務の分割を検討）` });
  if (steps.length > 20) issues.push({ level: 'warn', text: `工程が${steps.length}個あります。20個以内を推奨します（業務の分割を検討）` });
  return { nodes, edges, issues, lanes, rows, byId };
}

/** 直角の矢印ルートを、図形を避け・交差と重なりが少なくなるよう選ぶ */
function route(model: Model) {
  const { nodes, edges, lanes, rows, byId } = model;
  const gx: number[] = [];
  lanes.forEach((_, i) => { const x0 = laneX0(i); gx.push(x0 + 9, x0 + 20, x0 + C.LANE_W - 9, x0 + C.LANE_W - 20); if (i < lanes.length - 1) gx.push(x0 + C.LANE_W + C.GAP / 2); });
  // 図形の下の所要時間・ツール表示も避ける
  const rects = nodes.map(n => ({ l: n.cx - n.w / 2 - 5, r: n.cx + n.w / 2 + 5, t: n.cy - n.h / 2 - 5, b: n.cy + n.h / 2 + (n.step ? 19 : 5) }));
  const placed: { a: Pt; b: Pt; e: Edge }[] = [], use: Record<string, { i: number; o: number }> = {};
  const port = (n: FlowNode, p: Port): Pt => ({ x: n.cx + PORTS[p][0] * n.w / 2, y: n.cy + PORTS[p][1] * n.h / 2 });
  const stub = (pt: Pt, p: Port): Pt => ({ x: pt.x + PORTS[p][0] * C.STUB, y: pt.y + PORTS[p][1] * C.STUB });
  const isH = (a: Pt, b: Pt) => Math.abs(a.y - b.y) < 0.5;
  function norm(pts: Pt[]): Pt[] | null {
    const p: Pt[] = [];
    pts.forEach(q => { const l = p[p.length - 1]; if (!l || Math.abs(l.x - q.x) > 0.5 || Math.abs(l.y - q.y) > 0.5) p.push(q); });
    for (let i = 0; i < p.length - 1; i++) if (!isH(p[i], p[i + 1]) && Math.abs(p[i].x - p[i + 1].x) > 0.5) return null;
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[i - 1], b = p[i], c = p[i + 1], h1 = isH(a, b), h2 = isH(b, c);
      if (h1 === h2) { const d1 = h1 ? b.x - a.x : b.y - a.y, d2 = h2 ? c.x - b.x : c.y - b.y; if (d1 * d2 < 0) return null; }
    }
    const out = [p[0]];
    for (let i = 1; i < p.length - 1; i++) if (isH(p[i - 1], p[i]) !== isH(p[i], p[i + 1])) out.push(p[i]);
    out.push(p[p.length - 1]);
    return out;
  }
  const hit = (a: Pt, b: Pt, R: { l: number; r: number; t: number; b: number }) => {
    if (isH(a, b)) { if (a.y <= R.t || a.y >= R.b) return false; return Math.max(a.x, b.x) > R.l && Math.min(a.x, b.x) < R.r; }
    if (a.x <= R.l || a.x >= R.r) return false; return Math.max(a.y, b.y) > R.t && Math.min(a.y, b.y) < R.b;
  };
  function score(pts: Pt[], e: Edge, ps: Port, pt: Port, from: FlowNode, to: FlowNode) {
    let c = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      c += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (i > 0 && i < pts.length - 2) for (const R of rects) if (hit(a, b, R)) return Infinity;
      for (const s of placed) {
        const h1 = isH(a, b), h2 = isH(s.a, s.b);
        if (h1 === h2) {
          const same = h1 ? Math.abs(a.y - s.a.y) < 4 : Math.abs(a.x - s.a.x) < 4; if (!same) continue;
          const lo = h1 ? Math.max(Math.min(a.x, b.x), Math.min(s.a.x, s.b.x)) : Math.max(Math.min(a.y, b.y), Math.min(s.a.y, s.b.y));
          const hi = h1 ? Math.min(Math.max(a.x, b.x), Math.max(s.a.x, s.b.x)) : Math.min(Math.max(a.y, b.y), Math.max(s.a.y, s.b.y));
          if (hi - lo > 1) c += s.e.to === e.to && !s.e.back && !e.back ? (hi - lo) * 2 : 200 + (hi - lo) * 15;
        } else {
          const H = h1 ? [a, b] : [s.a, s.b], V = h1 ? [s.a, s.b] : [a, b], x = V[0].x, y = H[0].y;
          if (x > Math.min(H[0].x, H[1].x) + 1 && x < Math.max(H[0].x, H[1].x) - 1 && y > Math.min(V[0].y, V[1].y) + 1 && y < Math.max(V[0].y, V[1].y) - 1) c += 70;
        }
      }
    }
    c += (pts.length - 2) * 24;
    const uo = use[from.id + ps] || { i: 0, o: 0 }, ui = use[to.id + pt] || { i: 0, o: 0 };
    if (uo.i) c += 500; if (uo.o) c += 260; if (ui.o) c += 500; if (ui.i) c += e.back ? 300 : 40;
    if (!e.back) { if (ps === 'T') c += 200; if (pt === 'B') c += 200; if (pt === 'L' || pt === 'R') c += 30; }
    else { if (pt === 'T') c += 60; if (pt === 'B') c += 200; if (ps === 'B') c += 80; }
    return c;
  }
  const order = [...edges].sort((a, b) => (Number(a.back) - Number(b.back)) || (byId[a.from].row - byId[b.from].row));
  for (const e of order) {
    const from = byId[e.from], to = byId[e.to];
    const r1 = Math.min(from.row, to.row), r2 = Math.max(from.row, to.row);
    const cy: number[] = [];
    for (let r = Math.max(0, r1 - 1); r <= Math.min(rows, r2 + 1); r++) { const b = rowY0(r); cy.push(b + 4, b + 11); }
    let best: { s: number; pts: Pt[]; ps: Port; pt: Port } | null = null;
    for (const ps of ['B', 'R', 'L', 'T'] as Port[]) for (const pt of ['T', 'L', 'R', 'B'] as Port[]) {
      const A = port(from, ps), a = stub(A, ps), B = port(to, pt), b = stub(B, pt);
      const mids: Pt[][] = [[], [{ x: b.x, y: a.y }], [{ x: a.x, y: b.y }]];
      gx.forEach(g => {
        mids.push([{ x: g, y: a.y }, { x: g, y: b.y }]);
        cy.forEach(y => { mids.push([{ x: g, y: a.y }, { x: g, y }, { x: b.x, y }]); mids.push([{ x: a.x, y }, { x: g, y }, { x: g, y: b.y }]); });
      });
      cy.forEach(y => mids.push([{ x: a.x, y }, { x: b.x, y }]));
      for (const m of mids) {
        const pts = norm([A, a, ...m, b, B]); if (!pts || pts.length < 2) continue;
        const s = score(pts, e, ps, pt, from, to);
        if (!best || s < best.s) best = { s, pts, ps, pt };
      }
    }
    if (!best || best.s === Infinity) best = { s: 0, pts: [port(from, 'B'), port(to, 'T')], ps: 'B', pt: 'T' };
    e.pts = best.pts;
    for (let i = 0; i < e.pts.length - 1; i++) placed.push({ a: e.pts[i], b: e.pts[i + 1], e });
    (use[from.id + best.ps] = use[from.id + best.ps] || { i: 0, o: 0 }).o++;
    (use[to.id + best.pt] = use[to.id + best.pt] || { i: 0, o: 0 }).i++;
  }
}

function pointAt(pts: Pt[], d: number): Pt {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (d <= l) { const t = l ? d / l : 0; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    d -= l;
  }
  return pts[pts.length - 1];
}
const pathLen = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + Math.abs(p.x - pts[i - 1].x) + Math.abs(p.y - pts[i - 1].y) : 0), 0);
export function wrap(text: string, per: number, max: number): string[] {
  const ch = [...String(text || '')];
  if (ch.length > per && ch.length <= per * max) per = Math.ceil(ch.length / Math.ceil(ch.length / per));
  const out: string[] = [];
  for (let i = 0; i < ch.length && out.length < max; i += per) out.push(ch.slice(i, i + per).join(''));
  if (ch.length > per * max) out[max - 1] = [...out[max - 1]].slice(0, per - 1).join('') + '…';
  return out;
}
const textLines = (lines: string[], cx: number, cy: number, size: number, color: string) => {
  const lh = size + 4, y0 = cy - (lines.length - 1) * lh / 2;
  return lines.map((l, i) => `<text x="${cx}" y="${y0 + i * lh}" font-size="${size}" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="central">${esc(l)}</text>`).join('');
};

/** SVG文字列と入力チェック結果を返す（文字列はすべてエスケープ済み） */
export function renderFlow(steps: Step[], mode: Mode): { svg: string; issues: Issue[] } {
  const model = analyze(steps);
  if (!steps.length) return { svg: '', issues: model.issues };
  route(model);
  const W = C.M * 2 + model.lanes.length * (C.LANE_W + C.GAP) - C.GAP, H = rowY0(model.rows) + C.M;
  const A = ASIS_COLORS;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial,'Noto Sans JP','Yu Gothic',sans-serif" role="img" aria-label="業務フロー図">`;
  s += `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1L9,5L0,9z" fill="${A.line}"/></marker><marker id="ahb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1L9,5L0,9z" fill="${A.back}"/></marker><marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7"><circle cx="5" cy="5" r="3.5" fill="#fff" stroke="${A.line}" stroke-width="2"/></marker><marker id="dotb" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7"><circle cx="5" cy="5" r="3.5" fill="#fff" stroke="${A.back}" stroke-width="2"/></marker></defs>`;
  s += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  model.lanes.forEach((a, i) => {
    const x = laneX0(i);
    s += `<rect x="${x}" y="${C.M - 6}" width="${C.LANE_W}" height="${H - C.M}" rx="12" fill="#eef3fb"/><text x="${x + C.LANE_W / 2}" y="${C.M + 16}" font-size="15" font-weight="bold" fill="#17365d" text-anchor="middle" dominant-baseline="central">${esc(wrap(a, 14, 1)[0])}</text><line x1="${x + 16}" x2="${x + C.LANE_W - 16}" y1="${C.HEAD}" y2="${C.HEAD}" stroke="#c9d6ea"/>`;
  });
  model.edges.forEach(e => {
    const d = 'M' + e.pts!.map(p => `${p.x},${p.y}`).join('L');
    s += e.back
      ? `<path d="${d}" fill="none" stroke="${A.back}" stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round" marker-start="url(#dotb)" marker-end="url(#ahb)"/>`
      : `<path d="${d}" fill="none" stroke="${A.line}" stroke-width="1.8" stroke-linejoin="round" marker-start="url(#dot)" marker-end="url(#ah)"/>`;
  });
  model.nodes.forEach(n => {
    if (n.kind === 'start' || n.kind === 'end') { s += `<rect x="${n.cx - n.w / 2}" y="${n.cy - n.h / 2}" width="${n.w}" height="${n.h}" rx="${n.h / 2}" fill="${A.terminal}"/>` + textLines([n.label!], n.cx, n.cy, 14, '#fff'); return; }
    const st = n.step!, tobe = mode === 'tobe', method = methodOf(st).type, mc = METHOD_COLORS[method];
    const label = tobe ? tobeTitle(st) : st.action;
    const col = tobe ? mc : n.kind === 'decision' ? A.decision : A.task;
    s += `<g><title>${esc(n.no + '. ' + label + (st.notes ? '\n' + st.notes : ''))}</title>`;
    if (n.kind === 'decision') s += `<polygon points="${n.cx},${n.cy - n.h / 2} ${n.cx + n.w / 2},${n.cy} ${n.cx},${n.cy + n.h / 2} ${n.cx - n.w / 2},${n.cy}" fill="${col.fill}" stroke="${col.stroke}" stroke-width="2"/>` + textLines(wrap(label, 8, 2), n.cx, n.cy, 12, col.text);
    else s += `<rect x="${n.cx - n.w / 2}" y="${n.cy - n.h / 2}" width="${n.w}" height="${n.h}" rx="8" fill="${col.fill}" stroke="${col.stroke}" stroke-width="${tobe ? 2 : 1.5}"/>` + textLines(wrap(label, 12, 2), n.cx, n.cy, 12.5, col.text);
    const bx = n.kind === 'decision' ? n.cx - n.w / 2 + 8 : n.cx - n.w / 2 + 2, by = n.kind === 'decision' ? n.cy - n.h / 2 + 8 : n.cy - n.h / 2 + 2;
    s += `<circle cx="${bx}" cy="${by}" r="10" fill="#17365d"/><text x="${bx}" y="${by}" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle" dominant-baseline="central">${n.no}</text>`;
    const min = Number(st.minutes) || 0;
    let meta: string;
    if (tobe) { const t = tobeMinutes(st); meta = `${METHOD_INFO[method].short} · ${min}→${+t.value.toFixed(1)}分${t.manual ? '（手入力）' : ''}`; }
    else meta = [st.minutes !== '' ? min + '分' : '', st.tool].filter(Boolean).join(' · ');
    if (meta) s += `<text x="${n.cx}" y="${n.cy + n.h / 2 + 11}" font-size="10.5" fill="#5f6368" stroke="#eef3fb" stroke-width="4" stroke-linejoin="round" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(meta)}</text>`;
    s += '</g>';
  });
  model.edges.filter(e => e.label).forEach(e => {
    const q = pointAt(e.pts!, Math.min(36, pathLen(e.pts!) * 0.45)), w = [...e.label].length * 12 + 16, col = e.back ? A.back : '#17365d';
    const p = { x: Math.min(Math.max(q.x, w / 2 + 2), W - w / 2 - 2), y: q.y };
    s += `<rect x="${p.x - w / 2}" y="${p.y - 10}" width="${w}" height="20" rx="10" fill="#fff" stroke="${col}" stroke-width="1.5"/><text x="${p.x}" y="${p.y}" font-size="11.5" font-weight="bold" fill="${col}" text-anchor="middle" dominant-baseline="central">${esc(e.label)}</text>`;
  });
  return { svg: s + '</svg>', issues: model.issues };
}
