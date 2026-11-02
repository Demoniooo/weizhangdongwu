// b02 私有：L03 灾祸（火球、火雨、逃难市民、掉篮、掀帽、躲桶）与和平段的前景纸鸟、余烬。
// 纯函数：只由 T 决定；火球 / 市民的位置都由时刻反推。
import { PAL, blob, cut, glow, ribbon, rad } from '../../core/paper.js';
import { applyCam, toScreen } from '../../core/camera.js';
import { clamp, lerp, seg, hit, hash2, TAU, rgba, mixHex } from '../../core/util.js';
import { outBack, outCubic, inQuad, inOutSine } from '../../core/ease.js';
import { burst, stream } from '../../core/particles.js';
import { drawCitizen, drawGuard, drawAppleBasket } from '../../rigs/folk.js';
import { emberDraw, sparkDraw } from '../../props/misc.js';
import { CASTLE } from '../../env/castle.js';
import { paperBird } from './balcony.js';
import { TM } from './shared.js';

const NEAR = CASTLE.depth.near;   // 1.1：城下屋顶与地面带
const H = CASTLE.houses;

// ———————————————————— 火球 ————————————————————
/** 一颗火球：亮芯 + 三层剪纸火舌拖尾（沿来向）+ 外光。(x,y) 球心，dir 运动方向（弧度），r 半径。 */
export function drawFireball(g, x, y, r, dir, T, seed = 1) {
  const bx = -Math.cos(dir), by = -Math.sin(dir);   // 拖尾方向
  const nx = -by, ny = bx;
  glow(g, x, y, r * 4.2, PAL.fire, 0.55);
  const layers = [[PAL.fireDeep, 1.0, 7.2], [PAL.fire, 0.78, 5.6], [PAL.fire2, 0.52, 4.0]];
  for (const [col, wk, lk] of layers) {
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const wig = Math.sin(T * 34 + u * 7 + seed) * r * 0.22 * u;
      pts.push([x + bx * r * lk * u + nx * wig, y + by * r * lk * u + ny * wig]);
    }
    g.fillStyle = col;
    g.fill(ribbon(pts, (u) => r * wk * 1.05 * (1 - u) ** 0.8 + 0.6));
  }
  g.fillStyle = PAL.fire2; g.beginPath(); g.arc(x, y, r * 0.78, 0, TAU); g.fill();
  g.fillStyle = PAL.white; g.globalAlpha *= 0.85; g.beginPath(); g.arc(x - r * 0.18, y - r * 0.2, r * 0.38, 0, TAU); g.fill();
  g.globalAlpha /= 0.85;
}

// 火雨表：落点（near 层世界坐标）与落地时刻。house = 点着的屋顶（与 drawCastle fires 一致）。
const roofPt = (i) => [H[i].x - 6, H[i].ridge + 10];
export const RAIN = [
  { at: TM.fire1, p: roofPt(3), r: 46, house: 3, big: true },        // L03 第一颗：x=1140 的屋顶
  { at: TM.fire1 + 0.12, p: roofPt(5), r: 34, house: 5 },             // 1500
  { at: TM.fire1 + 0.24, p: roofPt(4), r: 34, house: 4 },             // 1320
  { at: TM.fire1 + 0.36, p: [1050, 1018], r: 26 },
  { at: TM.fire1 + 0.48, p: roofPt(2), r: 32, house: 2 },             // 780
  { at: TM.fire1 + 0.60, p: roofPt(1), r: 32, house: 1 },             // 600
  { at: TM.hat, p: [842, 1000], r: 28 },                              // 掀飞卫兵高帽的那颗
  { at: TM.fire1 + 0.84, p: [1235, 1040], r: 24 },
  { at: TM.fire1 + 0.96, p: [690, 992], r: 24 },
];
/** drawCastle 的 fires 参数（屋顶从右往左依次点着）。 */
export const FIRES = RAIN.filter((q) => q.house !== undefined).map((q) => ({ house: q.house, at: q.at }));
const FLY = 0.3;                    // 每颗从画外飞到落点的时长
const FROM = [880, -1500];          // 来向：从右上斜落（相对落点的屏幕偏移，按 0.3s 飞完）

/** 屏幕坐标里画所有正在飞的火球与落地爆点。c = 当前机位。 */
export function drawFireRain(g, T, c) {
  for (let i = 0; i < RAIN.length; i++) {
    const q = RAIN[i];
    const age = T - (q.at - FLY);
    if (age < 0) continue;
    const [tx, ty] = toScreen(c, NEAR, q.p[0], q.p[1]);
    if (age < FLY) {
      const u = age / FLY;
      const k = inQuad(u) * 0.55 + u * 0.45;
      const x = tx + FROM[0] * (1 - k), y = ty + FROM[1] * (1 - k);
      drawFireball(g, x, y, q.r * c.zoom * 0.62, Math.atan2(-FROM[1], -FROM[0]), T, i * 3.7);
    }
    const t = T - q.at;
    if (t >= 0 && t < 0.9) {
      // 落地：冲击光 + 火星
      const fl = hit(T, q.at, 0.08);
      glow(g, tx, ty, q.r * c.zoom * (2.2 + 2 * fl), PAL.fire2, 0.9 * fl);
      burst(g, T, { at: q.at, seed: 300 + i, count: q.big ? 34 : 18, x: tx, y: ty, spread: 8, speed: [240, q.big ? 780 : 520],
        angle: [-Math.PI * 0.95, -Math.PI * 0.05], gravity: 1400, drag: 1.6, life: [0.35, 0.85], size: [5, 11] }, sparkDraw);
    }
  }
}

/** 火雨的背景余烬（14.30–15.20 斜落的小火点，约 8 颗/秒，屏幕坐标）。 */
export function drawEmberRain(g, T) {
  if (T < TM.rain0 - 0.4 || T > TM.rain1 + 0.6) return;
  stream(g, T, { start: TM.rain0 - 0.3, end: TM.rain1, rate: 9, seed: 77, life: [0.6, 0.9], drag: 0,
    emit: (tb, i, r) => ({ x: 900 + r * 1300, y: -40 - hash2(i, 5) * 80, vx: -620, vy: 1100 }), size: [6, 10] },
  (gg, x, y, s) => {
    const a = (1 - s.p) * 0.9;
    gg.save(); gg.globalAlpha *= a;
    gg.strokeStyle = PAL.fire; gg.lineWidth = s.size * 0.5; gg.lineCap = 'round';
    gg.beginPath(); gg.moveTo(x, y); gg.lineTo(x + 0.05 * 620, y - 0.05 * 1100); gg.stroke();
    gg.fillStyle = PAL.fire2; gg.beginPath(); gg.arc(x, y, s.size * 0.42, 0, TAU); gg.fill();
    gg.restore();
  });
}

/** 每颗落火给天空一次橙光脉冲（0..1）。 */
export function rainPulse(T) {
  let k = 0;
  for (const q of RAIN) k = Math.max(k, hit(T, q.at, 0.14) * (q.big ? 1 : 0.6));
  return k;
}

// ———————————————————— 城下逃难的人（near 层世界坐标，s=0.30） ————————————————————
const FS = 0.3;
const RUN0 = TM.fire1 + 0.04;
const FLEE = [
  { x0: 1395, y: 1004, v: 300, variant: 2, d: 0.00 },
  { x0: 1470, y: 1030, v: 330, variant: 5, d: 0.06, basket: true },
  { x0: 1290, y: 1046, v: 280, variant: 7, d: 0.12 },
  { x0: 1560, y: 1014, v: 360, variant: 0, d: 0.03 },
  { x0: 1205, y: 1036, v: 310, variant: 9, d: 0.09 },
  { x0: 1335, y: 994, v: 290, variant: 1, d: 0.15 },
];
const runX = (m, T) => {
  const t = Math.max(0, T - RUN0 - m.d);
  return m.x0 - m.v * (t - 0.12 * (1 - Math.exp(-t / 0.12)));   // 起跑有加速
};
const BASKET = { at: TM.fire1 + 0.42, land: TM.fire1 + 0.72 };

/** 画城下的群演（调用方已 applyCam 到 near 层）。 */
export function drawTownFolk(g, T) {
  // 躲进木桶的面包师（路右边）
  const peek = T < TM.hat ? 1 : clamp(1 - (T - TM.hat) / 0.2) + 0.6 * seg(T, TM.hat + 0.55, TM.hat + 0.8);
  drawCitizen(g, { x: 1092, y: 992, s: FS, t: T, variant: 11, pose: T < TM.hat - 0.25 ? 'idle' : 'hideBarrel', peek, face: -1, expr: T < TM.fire1 + 0.05 ? 'normal' : 'scared' });
  // 卫兵：先跟着跑，14.90 被落火的气浪掀翻高帽
  const gx = 900 - 210 * Math.max(0, Math.min(T, TM.hat) - RUN0 - 0.05);
  const blown = T >= TM.hat;
  drawGuard(g, { x: gx, y: 1008, s: FS, t: T, face: -1, pose: blown ? 'blown' : T < RUN0 ? 'attention' : 'stepBack',
    hatFly: blown ? clamp((T - TM.hat) / 0.75) : 0, expr: blown ? 'blown' : 'scared', joints: blown ? { dx: -6 * outCubic(clamp((T - TM.hat) / 0.2)) } : undefined });
  // 苹果篮落地后由镜头接管
  if (T >= BASKET.land) {
    const m = FLEE[1];
    const bx = runX(m, BASKET.land) - 6;
    drawAppleBasket(g, { x: bx, y: m.y, s: FS * 0.85, spill: clamp((T - BASKET.land) / 0.5), rot: 0.4 * clamp((T - BASKET.land) / 0.2), t: T });
  }
  // 六个逃难的人（向左跑，错峰）
  const order = FLEE.map((m, i) => ({ m, i })).sort((a, b) => a.m.y - b.m.y);
  for (const { m, i } of order) {
    const x = runX(m, T);
    if (x < 300) continue;
    const startled = T < RUN0 + m.d;
    const o = { x, y: m.y, s: FS, t: T, variant: m.variant, face: -1, phase: i * 0.21, seed: 40 + i,
      pose: startled ? 'idle' : 'flee', expr: startled && T < TM.fire1 ? 'normal' : 'scared' };
    if (startled && T >= TM.fire1) o.joints = { bob: 6 * Math.sin(Math.PI * clamp((T - TM.fire1) / 0.12)) };   // 吓一跳
    if (m.basket) o.dropItem = T < BASKET.at ? true : T < BASKET.land ? 0.6 * clamp((T - BASKET.at) / (BASKET.land - BASKET.at)) : 1;
    drawCitizen(g, o);
  }
}

// ———————————————————— 和平段：前景三只纸鸟（从左往右飞过画面上方） ————————————————————
const FG_BIRDS = [
  { d: 0.0, y: 132, s: 1.25, col: [PAL.white, PAL.paper2, PAL.princessLight] },
  { d: 0.13, y: 214, s: 1.0, col: [PAL.paper, PAL.paper2, PAL.skyDayLow] },
  { d: 0.24, y: 92, s: 0.85, col: [PAL.white, PAL.skyDayLow, PAL.goldLight] },
];
/** 屏幕坐标（前景层，虚化）。11.30 从左边进画，12.15 被龙影惊得一抖、加速出右边。 */
export function drawForegroundBirds(g, T) {
  const t0 = TM.wave - 0.12;
  for (const b of FG_BIRDS) {
    const u = T - t0 - b.d;
    if (u < 0 || u > 1.6) continue;
    const scare = Math.max(0, T - TM.L02 - 0.04);
    const x = -120 + 1020 * u + 900 * scare * scare;
    const y = b.y + 18 * Math.sin(u * 4.2 + b.d * 9) - 260 * scare * scare;
    if (x > 2100) continue;
    const flap = Math.sin((T + b.d) * (scare > 0 ? 30 : 15));
    paperBird(g, x, y, 1.5 * b.s, { face: 1, flap, col: b.col, rot: -0.12 - 0.5 * Math.min(1, scare * 3) });
  }
}

export { NEAR, applyCam, mixHex, rgba, rad, blob, cut, outBack, inOutSine, emberDraw };
