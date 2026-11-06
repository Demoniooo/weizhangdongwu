// b11 第二拍：盘柱螺旋脊线（自定义 spine，画在水晶柱同一深度 0.85，柱前 / 柱后分层）。
// 设计：螺旋整体绕柱旋转（φ 随时间减小），每 0.5s 正好有一块背板转到柱前偏左的“落脚点”——勇者原地往上跳，
// 龙头在最下面跟着转：先转到柱后（被自己的身体挡住够不到），126.8 从柱子右前方绕出来，从右往左扑咬；
// 127.00 尾巴从上面甩下来想拍勇者，勇者跳开，龙一口咬住自己的尾巴尖（「松」那一节）。
import { lerp, clamp, smoothstep } from '../../core/util.js';
import { ez, inQuad, outCubic } from '../../core/ease.js';
import { TT } from './k.js';

export const COIL = { cx: 1640, r: 106, turns: 2, len: 1660, yb: 872, depth: 0.85 };
const S0 = 100, SEG = (COIL.len - S0) / 13;
const PITCH = Math.sqrt((COIL.len / COIL.turns) ** 2 - (2 * Math.PI * COIL.r) ** 2);
export const RISE = PITCH * COIL.turns;
const DPH = 2 * Math.PI * COIL.turns;               // dph/du
export const uPlate = (i) => (S0 + (i + 0.5) * SEG) / COIL.len;
export const PH_LAND = 1.36 * Math.PI;               // 落脚点：柱前偏左
const W_ROT = (DPH * SEG / COIL.len) / 0.5;          // 每 0.5s 转过一块背板
const N = 64;

/** 螺旋旋转相位（127.00 咬住尾巴后刹住）。 */
export function coilPhi(T) {
  const p0 = PH_LAND - Math.PI - DPH * uPlate(0);
  const tStop = TT.tailBite;
  if (T <= tStop) return p0 - W_ROT * (T - TT.plates[0]);
  const over = 0.22 * outCubic(clamp((T - tStop) / 0.35));
  return p0 - W_ROT * (tStop - TT.plates[0]) - over;
}

/** 原始螺旋上的点（u 0..1）：[x, y, depth]。 */
export function helixAt(u, T) {
  const ph = Math.PI + coilPhi(T) + DPH * u;
  return [COIL.cx + COIL.r * Math.cos(ph), COIL.yb - RISE * u, -Math.sin(ph), ph];
}

/** 背板中心（与 drawDragon 一致：在 2D 弧长上把 S0 之后等分 13 节；背侧法线外 36px）。 */
export function plateAt(i, T) {
  const pts = coilSpine(T);
  const L = [0];
  for (let k = 1; k < pts.length; k++) L.push(L[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const tot = L[L.length - 1], s = S0 + (i + 0.5) * (tot - S0) / 13;
  let k = 1; while (k < pts.length - 1 && L[k] < s) k++;
  const f = clamp((s - L[k - 1]) / (L[k] - L[k - 1] || 1));
  const x = lerp(pts[k - 1][0], pts[k][0], f), y = lerp(pts[k - 1][1], pts[k][1], f);
  const a = Math.max(0, k - 2), b = Math.min(pts.length - 1, k + 1);
  let tx = pts[b][0] - pts[a][0], ty = pts[b][1] - pts[a][1];
  const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
  return [x + ty * 36, y - tx * 36];
}

// 咬尾：脖子把头抬到 headTo（脖根插座目标、头转角 48°），尾巴从上面绕下来把尾尖送进龙嘴。
// Head local anchors (dragon.js headLocal) and head rotation (deg, + = head up).
export const SOCKET = [100, 52];
export const rotV = (x, y, deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
/** 由脖根插座与头转角求头上局部点（世界）。 */
export function headPoint(sock, rotDeg, local) {
  const so = rotV(SOCKET[0], SOCKET[1], rotDeg);
  const hc = [sock[0] - so[0], sock[1] - so[1]];
  const l = rotV(local[0], local[1], rotDeg);
  return [hc[0] + l[0], hc[1] + l[1]];
}
export const NOSE_TOP = [-112, -64];       // 吻背（勇者踩的“龙鼻子”）
export const MOUTH = [-180, 50];
const HEAD_TO = [1851, 562], BITE_ROT = 30;
export const BITE = { headTo: HEAD_TO, rot: BITE_ROT, tailTo: headPoint(HEAD_TO, BITE_ROT, [MOUTH[0] - 86, MOUTH[1] + 4]) };   // 尾尖从嘴里穿出来一截（黑桃露在吻外）
export const biteK = (T) => ez(T, TT.tailBite - 0.2, TT.tailBite, inQuad);
const tailK = (T) => ez(T, TT.tailBite - 0.32, TT.tailBite, inQuad);

/** 头转角（度）：追咬时抬头、一张一合地往上够；咬尾时抬到 BITE.rot。 */
export function coilRot(T) {
  const chase = smoothstep(TT.nose, TT.nose + 0.4, T), kb = biteK(T);
  return 8 + 22 * chase * (1 - kb) + (BITE.rot - 8) * kb + 6 * Math.sin(T * 9) * chase * (1 - kb);
}
/** 头上某局部点（咬尾时按形变后的插座）。 */
export function coilHeadPoint(T, local) {
  const kb = biteK(T);
  const h = helixAt(0, T);
  const sock = [lerp(h[0], BITE.headTo[0], kb), lerp(h[1], BITE.headTo[1], kb)];
  return headPoint(sock, coilRot(T), local);
}

/** 64 点脊线（带 .depth / .rot），自定义 spine 交给 drawDragon；先细分采样再按 2D 弧长重采样（drawDragon 按下标查 depth）。 */
export function coilSpine(T) {
  const kb = biteK(T), kt = tailK(T);
  const M = 220;
  const p0 = helixAt(0, T);
  const UL = 0.3, UT = 0.6;
  const tb = helixAt(UT, T);
  const ctl = [Math.max(tb[0], BITE.tailTo[0]) + 210, (tb[1] + BITE.tailTo[1]) / 2 - 40];
  const fine = [], fd = [];
  for (let k = 0; k < M; k++) {
    const u = k / (M - 1);
    let [x, y, d] = helixAt(u, T);
    if (u < UL && kb > 0) {
      const w = (1 - u / UL) ** 1.5 * kb;
      x += w * (BITE.headTo[0] - p0[0]); y += w * (BITE.headTo[1] - p0[1]);
      d = lerp(d, 1, w);
    }
    if (u > UT && kt > 0) {
      const v = (u - UT) / (1 - UT);
      const w = smoothstep(0, 0.35, v) * kt;
      const a = 1 - v;
      const bx = a * a * tb[0] + 2 * a * v * ctl[0] + v * v * BITE.tailTo[0];
      const by = a * a * tb[1] + 2 * a * v * ctl[1] + v * v * BITE.tailTo[1];
      x = lerp(x, bx, w); y = lerp(y, by, w);
      d = lerp(d, 0.9, w);
    }
    fine.push([x, y]); fd.push(d);
  }
  const L = [0];
  for (let k = 1; k < M; k++) L.push(L[k - 1] + Math.hypot(fine[k][0] - fine[k - 1][0], fine[k][1] - fine[k - 1][1]));
  const tot = L[M - 1];
  const pts = [], depth = [];
  let j = 1;
  for (let k = 0; k < N; k++) {
    const sk = (tot * k) / (N - 1);
    while (j < M - 1 && L[j] < sk) j++;
    const f = clamp((sk - L[j - 1]) / (L[j] - L[j - 1] || 1));
    pts.push([lerp(fine[j - 1][0], fine[j][0], f), lerp(fine[j - 1][1], fine[j][1], f)]);
    depth.push(lerp(fd[j - 1], fd[j], f));
  }
  pts.rot = coilRot(T);
  pts.depth = depth;
  return pts;
}
