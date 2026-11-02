// b14 · 回到、城名、国王听说、捷报（[165.00, 177.20)，见 docs/storyboard.md「b14」与 docs/blocks/b14.md）。
// 入场：本块在最上层画巨大围巾从右往左擦屏（破洞当窥视孔），擦过处露出归程。
// 出场：176.80 玫瑰窗内侧铺满全屏，b15 用圆形遮罩接管。
import { PAL, mixHex } from '../core/paper.js';
import { clamp, seg, hit, TAU } from '../core/util.js';
import { ez, outBack } from '../core/ease.js';
import { toScreen } from '../core/camera.js';
import { drawScarfWipe, scarfWipeMask } from '../props/scarf.js';
import { drawSpeechWave } from '../props/misc.js';
import { bubble } from '../ui/kit.js';
import { whipCurtain, impact } from '../fx/transitions.js';
import { E04, E05, E06, E07, E08, T_START, T_END, T_IN_END, WHIP, MATCH_T0, wipeP } from './b14/common.js';
import { drawRidePicture } from './b14/ride.js';
import { drawCastlePicture, castleCam, windowScreen } from './b14/castle.js';
import { drawThronePicture, heraldBellScreen, T_ROSE } from './b14/throne.js';

/** E05 号声：声波弧从画左下（传令官的号口）涌进圆窗 + 「嘟嘟！」气泡（屏幕空间）。 */
function drawHorn(g, T) {
  const a = 1 - seg(T, E06 - 0.12, E06 + 0.02);
  if (T < E05 - 0.02 || a <= 0) return;
  const [bx, by] = heraldBellScreen(g, T);
  // 号口还在画外时，声源钉在画面左下角外（声波从画外涌进来）
  const sx = Math.max(bx, -60), sy = Math.min(by, 1140);
  const k = clamp((T - E05 + 0.02) / 0.08);
  drawSpeechWave(g, { x: sx, y: sy, dir: Math.atan2(420 - sy, 1100 - sx), spread: 0.55, n: 4, r0: 46, gap: 74, t: T, speed: 1.7, thick: 12, alpha: a * k });
  // 气泡挂在传令官头上方（他还在画外时贴着画面左下角，随拉出滑到他头上）
  const pop = clamp((T - (E05 + 0.07)) / 0.22);
  const hx = clamp(bx + 40, 300, 1500), hy = clamp(by - 150, 260, 620);
  if (pop > 0) bubble(g, { x: hx + 120, y: hy - 150, w: 330, h: 170, text: '嘟嘟！', tail: [hx, hy], pop: Math.min(pop, a), t: T, seed: 14 });
}

export default [
  // ① 回到：围巾擦屏（破洞先透出归程）→ 白马载着三位向左狂奔，倒放色带，小地图倒退变金
  {
    id: 'b14_ride', start: T_START, end: E04 + 0.2, z: 1,
    draw(g, T, lt, ctx) {
      const p = wipeP(T);
      if (T < T_IN_END) ctx.mask(g, (mg) => mg.fill(scarfWipeMask(T, { p })), (lg) => drawRidePicture(lg, T, ctx));
      else drawRidePicture(g, T, ctx);
      if (p < 1) ctx.layer(g, { shadow: 14, texture: 0.25 }, (lg) => drawScarfWipe(lg, T, { p, t: T }));
    },
  },
  // ② 城名：甩镜落定春天王城，13 座塔从左到右升起 13 面字旗；168.40 推向主堡圆窗
  {
    id: 'b14_flags', start: WHIP.t0, end: T_ROSE, z: 2,
    draw(g, T, lt, ctx) {
      const bridge = [mixHex(PAL.skyDayLow, PAL.leafLight, 0.35), PAL.skyDay];
      if (T < WHIP.t1) whipCurtain(ctx, g, T, { t0: WHIP.t0, t1: WHIP.t1, from: 'left', colors: bridge, band: 220 }, (g2) => drawCastlePicture(g2, T, ctx));
      else drawCastlePicture(g, T, ctx);
    },
  },
  // ③ 国王听说 + 捷报（勇者全名三行）：圆窗内外匹配推进王座厅，传令官吹号、展开长卷轴
  {
    id: 'b14_herald', start: MATCH_T0, end: E07, z: 3,
    draw(g, T, lt, ctx) {
      if (T < T_ROSE) {
        const [x, y, r] = windowScreen(castleCam(T));
        ctx.mask(g, (mg) => { mg.beginPath(); mg.arc(x, y, r * 1.02, 0, TAU); mg.fill(); }, (lg) => drawThronePicture(lg, T, ctx, { roseOnly: true }));
      } else drawThronePicture(g, T, ctx);
      drawHorn(g, T);
    },
  },
  // ④ 打败了 + 龙全名：红叉章砸在龙画像上；纸卷向右滚写出龙名，连弹三级台阶把国王卷晕，王冠飞出，升到玫瑰窗
  {
    id: 'b14_defeat', start: E07, end: T_END, z: 0,
    draw(g, T, lt, ctx) {
      drawThronePicture(g, T, ctx);
      impact(ctx, T, E07, 'S', { shake: 9, flash: 0.18 });
      impact(ctx, T, E08 + 2.43, 'S', { shake: 7, flash: 0 });
    },
  },
];
