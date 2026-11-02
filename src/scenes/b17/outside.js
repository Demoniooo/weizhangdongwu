// b17 · 夜城卷轴路（198.50–199.95）：圆窗拉出 → 卷轴从主堡圆窗飞出、绕过主堡上空、落到城门外、沿山路铺向天边。
// 同一条卷轴在“世界”（CASTLE 夜景，198.50–199.30）与“立体书”（199.30 起，bookToCastleCam 换算）里用同一个函数画，
// 199.30 那一帧两边逐像素一致（布景按 castle.md 5.4：LAYER_GROUPS + { time:'night' }）。
import { cue } from '../../cues.js';
import { PAL, glow, sparkle } from '../../core/paper.js';
import { cam, applyCam } from '../../core/camera.js';
import { clamp, lerp, seg, smoothstep } from '../../core/util.js';
import { ez, outCubic, outBack, glide } from '../../core/ease.js';
import { burst, stream } from '../../core/particles.js';
import { drawCastle, LAYER_GROUPS, CAMS as CA, CASTLE } from '../../env/castle.js';
import { drawThroneRoom, roseCam } from '../../env/throne.js';
import { BOOK } from '../../env/book.js';
import { drawInfiniteScroll, samplePath, pathAt } from '../../props/paper.js';
import { sparkDraw } from '../../props/misc.js';
import { T_OUT } from './hall.js';

export const T_LAND0 = T_OUT;                    // 198.50 拉出开始
export const T_LAND1 = T_OUT + 0.4;              // 198.90 落到 CA-W
export const T_BOOK = cue('O08') - 0.36;         // 199.30 拉回成书（bookPushCam 拉回段起点）
const TA0 = T_OUT - 0.03, TA1 = T_OUT + 0.52;    // 198.47–199.02 卷头绕主堡上空、落到城门外
const TB1 = cue('O08') - 0.16;                   // 199.50 铺到天边
export const CASTLE_O = Object.freeze({ time: 'night' });

// 卷轴路径（CASTLE 主体层坐标；CA-W 下 = 屏幕）：圆窗 → 顺时针绕过主堡右上空 → 钩形落到城门外的山路上 → 沿城下近段山路向右下伸出画面。
// 第三个分量是纸宽：从圆窗里钻出来时窄（远），绕到最高处最宽（离镜头最近，字 ≥ 48px），落地后越铺越远越窄。
const PATH = [
  [960, 430, 18], [1010, 372, 54], [1076, 306, 74], [1158, 240, 82], [1262, 186, 86], [1384, 160, 90], [1510, 168, 90],
  [1652, 216, 90], [1728, 300, 90], [1738, 420, 88], [1702, 556, 84], [1616, 690, 80], [1504, 806, 76], [1404, 900, 70],
  [1372, 958, 64],
  [1434, 998, 56], [1600, 1022, 46], [1820, 1036, 34], [2080, 1044, 24], [2400, 1050, 14],
];
const SP = samplePath(PATH, 8);
const nearestL = (x, y) => { let best = 0, bd = 1e9; SP.pts.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = i; } }); return SP.L[best]; };
const L_TEXT = nearestL(1076, 306) - 70;         // 「王浩然」从绕圈的上升段开始写，勇者全名正好写在弧顶
const L_LAND = nearestL(1372, 958);              // 落地点（钩底）
export const SCROLL_LEN = SP.total;

/** 卷头沿路径的进度 0..1（按弧长）。 */
export function scrollP(T) {
  const a = seg(T, TA0, TA1), b = seg(T, TA1, TB1);
  const la = L_LAND * lerp(a, outCubic(a), 0.35);
  const lb = (SP.total - L_LAND) * outCubic(b);
  return (la + lb) / SP.total;
}

/**
 * 在 castle 主体层坐标系里画卷轴（调用前 g 已 applyCam 到主体层 / 立体书换算机位）。
 * 两遍：主体层 y < 915 的部分写字（绕圈的上半段），y ≥ 915 的部分（城下近段山路，字幕带）只画点纹。
 */
function scrollBody(g, T, p) {
  if (p <= 0) return;
  const o = { p, t: T * 2.5, offset: -(L_TEXT - 6) };
  g.save(); g.beginPath(); g.rect(-4000, -4000, 10000, 4000 + 915); g.clip();
  drawInfiniteScroll(g, PATH, { ...o, minPx: 9 });
  g.restore();
  g.save(); g.beginPath(); g.rect(-4000, 915, 10000, 6000); g.clip();
  drawInfiniteScroll(g, PATH, { ...o, minPx: 1e9 });
  g.restore();
}

/** 世界 / 立体书两种模式下的卷轴（含卷头火星、出窗闪光）。fold：立体书折倒时随主堡一起倒下。 */
export function drawScroll(g, T, c, o = {}) {
  const p = scrollP(T);
  if (p <= 0) return;
  const fk = o.fold ?? 1;
  if (fk <= 0.002) return;
  g.save();
  applyCam(g, c, 1);
  if (fk < 1) { const s = Math.max(0.002, outBack(clamp(fk), 1.5)); g.translate(0, CASTLE.pageBottom); g.scale(1, s); g.translate(0, -CASTLE.pageBottom); }
  scrollBody(g, T, p);
  // 卷头的火星尾迹
  stream(g, T, {
    start: TA0, end: TB1, rate: 55, seed: 1711, life: [0.25, 0.5], gravity: 300, drag: 1.2, size: [7, 13],
    emit: (tb) => { const q = scrollP(tb); const h = pathAt(SP, SP.total * q); return { x: h[0], y: h[1], vx: -Math.cos(h[2]) * 120, vy: -Math.sin(h[2]) * 120 - 60 }; },
  }, sparkDraw);
  // 卷头钻出圆窗的一下闪光
  burst(g, T, { at: TA0 + 0.03, seed: 1712, count: 24, x: CASTLE.window.x, y: CASTLE.window.y, spread: 10, speed: [80, 260], angle: [-3.1, 0.0], gravity: 160, drag: 1.2, life: [0.35, 0.7], size: [6, 12] }, sparkDraw);
  const fl = seg(T, TA0, TA0 + 0.35);
  if (fl > 0 && fl < 1) glow(g, CASTLE.window.x, CASTLE.window.y, 120 * (0.5 + fl), PAL.goldLight, 0.55 * (1 - fl));
  g.restore();
}

/** 圆窗拉出的外景机位：圆窗（主体层 (960,430) r70）从铺满全屏（屏幕半径 1150）退到 CA-W。 */
export function outsideCam(T) {
  const k = ez(T, T_LAND0, T_LAND1, outCubic);
  const Z0 = 1150 / CASTLE.window.r;
  const z = Math.pow(Z0, 1 - k);
  const sy = lerp(540, CASTLE.window.y, k);
  return { c: k >= 1 ? CA.CA_W : cam(960, CASTLE.window.y - (sy - 540) / z, z), k, z, sy };
}

/** 世界模式（198.50–199.30）：LAYER_GROUPS 三组 + 圆窗遮罩（厅内玫瑰窗）+ 卷轴（near 之后、fg 之前）。 */
export function drawOutside(g, T, ctx) {
  const { c, k, z, sy } = outsideCam(T);
  const [g1, g2, g3] = LAYER_GROUPS;
  ctx.layer(g, g1[1], (lg) => { for (const layer of g1[0]) drawCastle(lg, T, c, { ...CASTLE_O, layer }); });
  ctx.layer(g, g2[1], (lg) => { for (const layer of g2[0]) drawCastle(lg, T, c, { ...CASTLE_O, layer }); });
  // 圆窗遮罩：圆里是厅内的玫瑰窗（与上一镜头最后一帧同一机位），越缩越小，最后淡成外侧圆窗本来的样子
  if (k < 1) {
    const r = CASTLE.window.r * z;
    const a = 1 - smoothstep(0.55, 0.97, k);
    if (a > 0.002) {
      ctx.mask(g, (mg) => { mg.beginPath(); mg.arc(960, sy, r, 0, Math.PI * 2); mg.fill(); }, (lg) => {
        const ci = roseCam(960, sy, r * (150 / 150), 1);
        drawThroneRoom(lg, T, ci, { light: 'night', layer: 'back', flat: 1, rose: { face: 'in' }, windowL: 'winter', windowR: 'moon' });
        glow(lg, 960, sy, r * 0.5, PAL.goldLight, 0.35);
      }, { alpha: a });
    }
  }
  ctx.layer(g, g3[1], (lg) => {
    drawCastle(lg, T, c, { ...CASTLE_O, layer: 'near' });
    drawScroll(lg, T, c);
    drawCastle(lg, T, c, { ...CASTLE_O, layer: 'fg' });
  });
  return { c };
}

/** 立体书模式里的卷轴：裁到天幕卡横向范围、书页下沿（与 book.js drawPopup 同一裁剪）。bookT = 书内机位变换（applyCam(c,1) 后）。 */
export function drawScrollInBook(lg, T, cBook, castleCam, fold) {
  const base = lg.getTransform();
  lg.save();
  applyCam(lg, cBook, 1);
  const bottom = BOOK.spread.y1 + (1 - (castleCam.flat ?? 0)) * 3000;
  lg.beginPath(); lg.rect(BOOK.card.x0, -4000, BOOK.card.x1 - BOOK.card.x0, 4000 + bottom); lg.clip();
  lg.setTransform(base);
  // 折倒顺序同 book.js（主堡 j=6）：kk = 1 − clamp((fold − 6·0.075)/0.25)
  const fk = 1 - clamp((fold - 6 * 0.075) / 0.25);
  drawScroll(lg, T, castleCam, { fold: fk });
  lg.restore();
}
void glide; void sparkle;
