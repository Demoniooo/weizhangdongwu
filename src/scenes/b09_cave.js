// b09 · 山洞：公主、巨眼、拔剑、巨龙开口、龙名①（[98.60, 109.15)，见 docs/storyboard.md「b09」与 docs/blocks/b09.md）。
// 入场 b08→b09（98.60–99.60）由本块画：洞口杏仁形遮罩（journey.caveMouthPath，与 b08 同一个 journeyCam(T)）随推镜放大到满屏，
// 遮罩里只画一层径向渐变（+ 獠牙复刻），颜色桥 dragonDeep。出场 b09→b10（109.00–109.15）由 b10 画甩镜帘，本块照常画到 109.15。
// 所有镜头调用同一个 drawFrame（同一条机位曲线、同一套光照与角色时序），镜头切分只是为了对应分镜条目。
import { cue } from '../cues.js';
import { journeyCam } from '../env/journey.js';
import { seg, smoothstep } from '../core/util.js';
import { ez, inQuad, inOutSine } from '../core/ease.js';
import { drawFrame, TT } from './b09/stage.js';
import { mouthInterior, mouthMaskPath, coverScale } from './b09/eye.js';

const at = (id, d = 0) => +(cue(id) + d).toFixed(4);
const frame = (overlay = 0) => (g, T, lt, ctx) => drawFrame(g, T, ctx, { overlay: overlay ? 1 - ez(T, TT.full, TT.full + 0.28, inOutSine) : 0 });

export default [
  {
    // 98.60–99.60 洞口遮罩：S=1 时就是洞口内缘，99.22 起加速放大，99.60 盖满全屏（只占 1 个缓冲）
    id: 'b09_mouth_in', start: at('V13', 0.56), end: at('V13', 1.56), z: 1,
    draw(g, T, lt, ctx) {
      const c = journeyCam(T);
      const S = Math.pow(coverScale(c) * 1.02, inQuad(seg(T, at('V13', 1.18), at('V13', 1.56))));
      const dark = smoothstep(at('V13', 0.9), at('V13', 1.5), T);
      ctx.mask(g, (mg) => mg.fill(mouthMaskPath(c, S)), (lg) => mouthInterior(lg, T, c, dark));
    },
  },
  { id: 'b09_dark', start: at('V13', 1.56), end: at('V14'), draw: frame(1) },
  { id: 'b09_eye', start: at('V14'), end: at('V15'), draw: frame(0) },
  { id: 'b09_draw', start: at('V15'), end: at('V16'), draw: frame(0) },
  { id: 'b09_open', start: at('V16'), end: at('D1a'), draw: frame(0) },
  { id: 'b09_d1', start: at('D1a'), end: at('Q1'), draw: frame(0) },
];
