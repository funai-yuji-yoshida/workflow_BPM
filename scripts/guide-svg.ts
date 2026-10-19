// 使い方ページ用のフロー図（サンプル業務の As-Is／To-Be）を public/guide/ に書き出す
// 実行：npx vite-node scripts/guide-svg.ts
import { writeFileSync } from 'node:fs';
import { renderFlow } from '../src/flow/engine';
import { invoiceSample } from '../src/domain/samples';

const steps = invoiceSample().steps;
writeFileSync('public/guide/flow-asis.svg', renderFlow(steps, 'asis').svg);
writeFileSync('public/guide/flow-tobe.svg', renderFlow(steps, 'tobe').svg);
console.log('wrote public/guide/flow-asis.svg, flow-tobe.svg');
