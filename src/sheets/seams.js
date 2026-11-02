// 模型图：七处隐形接缝（src/scenes/_seams.js 的 drawSeam 参考画面）。
// 每个接缝占 2 秒：段内时间 lt ∈ [0,2) 映射到接缝时间 T' = T + (lt − 1)，段中点 = 接缝时刻 T（1:1 实时，便于对比 T − 1/30 等相邻帧）。
// 左下角（字幕带里，模型图专用）标注接缝名、时刻与 T'。
// 渲染（每段中点）：
//   node tools/render.mjs stills --sheet seams --times 1,3,5,7,9,11,13 --outdir out/review/seams
// 对比 A 块最后一帧：段中点 − 1/30，例如第 1 段 --times 0.9667（= 41.8667 时刻的参考画面）。
import { PAL, rr } from '../core/paper.js';
import { rgba } from '../core/util.js';
import { glyphRow } from '../ui/type.js';
import { SEAMS, SEAM_KEYS, drawSeam } from '../scenes/_seams.js';

const SEG = 2;

function label(g, S, i, Tp) {
  const lines = [`接缝 ${i + 1}/7  ${S.A} → ${S.B}  ·  ${S.cueId} ${S.T.toFixed(2)}`, `${S.title}  ·  T' ${Tp.toFixed(3)}`];
  g.save();
  g.fillStyle = rgba(PAL.ink, 0.62);
  g.fill(rr(14, 990, 760, 78, 10));
  glyphRow(g, [...lines[0]], 28, 1018, 26, { family: 'play', fill: PAL.goldLight, edge: null, gap: 0 });
  glyphRow(g, [...lines[1]], 28, 1052, 22, { family: 'play', fill: PAL.paper, edge: null, gap: 0 });
  g.restore();
}

export default SEAM_KEYS.map((key, i) => ({
  id: `sheet_seams_${i + 1}`,
  start: i * SEG,
  end: (i + 1) * SEG,
  draw(g, T, lt, ctx) {
    const S = SEAMS[key];
    const Tp = S.T + (lt - SEG / 2);
    g.fillStyle = PAL.ink; g.fillRect(0, 0, 1920, 1080);
    drawSeam(g, Tp, ctx, key);
    label(g, S, i, Tp);
  },
}));
