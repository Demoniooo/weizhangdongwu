// 临时对照模型图（b15 作者用，交付前删除）：drawSeam('b15|b16') 在接缝附近的参考画面。
// 段内时间 lt ∈ [0,2) → T' = 185.47 + (lt − 1)；sheet 时刻 1.0 = 接缝 185.47，0.9667 = 185.4367。
import { PAL } from '../core/paper.js';
import { SEAMS, drawSeam } from '../scenes/_seams.js';

export default [{
  id: 'sheet_b15_seam',
  start: 0,
  end: 2,
  draw(g, T, lt, ctx) {
    const S = SEAMS['b15|b16'];
    const Tp = S.T + (lt - 1);
    g.fillStyle = PAL.ink; g.fillRect(0, 0, 1920, 1080);
    drawSeam(g, Tp, ctx, 'b15|b16');
  },
}];
