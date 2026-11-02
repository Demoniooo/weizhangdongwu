// b11 · 间奏二：大战（五拍）（[120.97, 137.92)，见 docs/storyboard.md「### b11」与 docs/blocks/b11.md）。
// 五拍各一个镜头；块内转场在相邻镜头的交界处由“盖满全屏的那一帧”换镜（龙身横扫 124.00、火墙 127.40、竖甩 130.50 / 133.50），
// 两边镜头在交界前后都画同一个遮挡物，所以没有硬切。时刻一律 cue('I2') + 偏移（见 b11/k.js 的 TT）。
import { TT } from './b11/k.js';
import { drawBeat1 } from './b11/beat1.js';
import { drawBeat2 } from './b11/beat2.js';
import { drawBeat3 } from './b11/beat3.js';
import { drawBeat4 } from './b11/beat4.js';
import { drawBeat5 } from './b11/beat5.js';
import { whipLinesV } from './b11/common.js';
import { seg } from '../core/util.js';
import { camB3 } from './b11/beat3.js';

export default [
  { id: 'b11_break', start: TT.start, end: TT.sweepMid, draw(g, T, lt, ctx) { drawBeat1(g, T, ctx); } },
  { id: 'b11_coil', start: TT.sweepMid, end: TT.wallMid, draw(g, T, lt, ctx) { drawBeat2(g, T, ctx); } },
  {
    id: 'b11_shadow', start: TT.wallMid, end: TT.upMid,
    draw(g, T, lt, ctx) {
      drawBeat3(g, T, ctx);
      // 130.40–130.50 竖甩上摇（往鸟笼）：画面整体往下拖 + 竖速度线
      const a = seg(T, TT.up0, TT.upMid);
      if (a > 0) whipLinesV(g, T, a, 1);
      void camB3;
    },
  },
  { id: 'b11_swing', start: TT.upMid, end: TT.dnMid, draw(g, T, lt, ctx) { drawBeat4(g, T, ctx); } },
  { id: 'b11_clash', start: TT.dnMid, end: TT.end, draw(g, T, lt, ctx) { drawBeat5(g, T, ctx); } },
];
