// b11 私有：时刻表（一律 cue('I2') + 偏移）、机位工具、共用小件。纯函数，无跨帧状态。
import { cue } from '../../cues.js';
import { PAL, blob, glow } from '../../core/paper.js';
import { cam, lerpCam, applyCam } from '../../core/camera.js';
import { clamp, lerp, seg, rgba } from '../../core/util.js';
import { ez } from '../../core/ease.js';
import { withDrift, DRIFT } from '../_seams.js';

export const I2 = cue('I2');            // 120.97 撞墙
export const END = cue('B01');          // 137.92 块尾（b12 的 B01）
const at = (o) => I2 + o;

/** 全块节点（默认秒 = cue('I2') + 偏移，对应 storyboard b11 各 @秒）。 */
export const TT = {
  start: I2,
  whip1: at(0.28),            // 121.25 机位甩正
  roll0: at(0.28), roll1: at(0.65),
  fire: at(0.63),             // 121.60 火柱
  plant: at(0.73),            // 121.70 竖剑劈火
  push0: at(1.43), push1: at(1.95),   // 122.40 顶火前进
  fireOff: at(1.88),
  bite: at(2.03),             // 123.00 扑咬
  vault0: at(2.13), vault1: at(2.53), // 123.10–123.50 撑下颌翻过
  land: at(2.63),             // 123.60 落在龙脖子上
  sweep0: at(2.93), sweepMid: at(3.03), sweep1: at(3.13), // 123.90–124.10 龙身横扫遮挡（124.00 换镜）
  nose: at(3.33),             // 124.30 踩龙鼻子
  plates: [3.83, 4.33, 4.83, 5.33, 5.83].map(at), // 124.80 昆 … 126.80 卡
  tailBite: at(6.03),         // 127.00 咬到自己尾巴
  leap: at(6.23),             // 127.20 跃向半空
  wall0: at(6.20), wallMid: at(6.43), wall1: at(6.50), // 127.17–127.47 火墙擦屏（127.40 换镜：前沿已出画左）
  clash1: at(6.83),           // 127.80 剑对爪
  horn: at(7.23),             // 128.20 落在龙角上
  clash2: at(7.63),           // 128.60 剑对牙
  wing: at(8.13),             // 129.10 龙翼横扫
  clash3: at(8.43),           // 129.40 第三次，最大
  snag0: at(8.83), snag1: at(9.43),   // 129.80–130.40 围巾挂上龙角
  up0: at(9.43), upMid: at(9.53), up1: at(9.63),   // 130.40–130.60 竖甩上摇到鸟笼（130.50 换镜）
  cheer: at(9.63),            // 130.60 举牌
  pin: at(10.23),             // 131.20 第一颗锁芯
  pull0: at(10.43), pull1: at(10.93), // 131.40–131.90 拉远下摇
  swing0: at(10.53), swing1: at(12.03), // 131.50–133.00 荡一圈
  dizzy: at(11.63),           // 132.60 蚊香眼
  kick: at(12.03),            // 133.00 踢鼻子
  release: at(12.23),         // 133.20 围巾松开
  dn0: at(12.43), dnMid: at(12.53), dn1: at(12.63), // 133.40–133.60 竖甩下摇（133.50 换镜）
  charge0: at(12.63), charge1: at(14.33),
  clash: at(14.43),           // 135.40 正中对撞
  back0: at(14.53), back1: at(15.33),
  lb0: at(15.33), lb1: at(15.83),     // 136.30–136.80 黑边 + 撕纸分屏
  standoff: at(15.83),        // 136.80 对峙
  weed0: at(15.93), weed1: at(16.63), // 136.90–137.60 风滚草
  fade0: at(16.03), fade1: at(16.43), // 137.00–137.40 前景淡出、sat→0.9
  hand: at(16.43),            // 137.40 b12 接管黑边
  end: END,
};

export { withDrift, DRIFT };
export const W = 1920, H = 1080;

/** 关键帧机位：keys = [[t, cam, ease?], …]，段间按后一个 key 的缓动插值。 */
export function camPath(T, keys) {
  if (T <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, c1, e] = keys[i];
    const [t0, c0] = keys[i - 1];
    if (T <= t1) return lerpCam(c0, c1, ez(T, t0, t1, e));
  }
  return keys[keys.length - 1][1];
}

/** 关键帧标量：[[t, v, ease?], …]。 */
export function keyv(T, keys) {
  if (T <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (T <= t1) return lerp(v0, v1, ez(T, t0, t1, e));
  }
  return keys[keys.length - 1][1];
}
/** 关键帧点：[[t, [x,y], ease?], …]。 */
export function keyp(T, keys) {
  return [keyv(T, keys.map(([t, p, e]) => [t, p[0], e])), keyv(T, keys.map(([t, p, e]) => [t, p[1], e]))];
}

/** 在 depth 层世界坐标里画（save / applyCam / restore）。 */
export function inWorld(lg, c, depth, fn) {
  lg.save(); applyCam(lg, c, depth); const r = fn(lg); lg.restore(); return r;
}

/** 抛物线跳跃：从 a 到 b，k 0..1，顶点高 h。 */
export function hopPos(a, b, k, h) {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k) - h * 4 * k * (1 - k)];
}

/** 剪纸星形火花（四角星 + 光晕），对撞用。 */
export function clashStar(g, x, y, size, p, o = {}) {
  if (p <= 0 || p >= 1) return;
  const a = (1 - p) ** 0.6, s = size * (0.55 + 0.6 * Math.sqrt(p));
  g.save();
  glow(g, x, y, s * 1.6, o.glow || PAL.fire2, 0.85 * a);
  g.translate(x, y); g.rotate((o.rot || 0) + p * 0.5);
  const star = (R, r, col, al) => {
    g.globalAlpha = al;
    g.beginPath();
    for (let i = 0; i < 8; i++) { const ang = (i * Math.PI) / 4, rr = i % 2 ? r : R; g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
    g.closePath(); g.fillStyle = col; g.fill();
  };
  star(s, s * 0.16, PAL.goldLight, a);
  g.rotate(Math.PI / 4);
  star(s * 0.55, s * 0.1, PAL.white, a);
  g.restore();
}

/** 地上擦痕 + 烟（对撞后被推回）。 */
export function scrape(g, x0, x1, y, p, seedN) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha = 0.55 * clamp(1.4 - p);
  g.fillStyle = rgba(PAL.shadow, 0.6);
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
  g.fill(blob((xa + xb) / 2, y + 6, (xb - xa) / 2 + 10, 7, { seed: seedN, amp: 0.05 }));
  g.restore();
}

export const sat01 = (T) => 1 - 0.1 * seg(T, TT.fade0, TT.fade1);   // 137.00–137.40 洞穴各层 sat 1 → 0.9
export { cam, clamp, lerp, seg };
