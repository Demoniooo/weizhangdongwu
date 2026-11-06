// b03 私有：L08 后告示撕下 → 翻滚扑镜 → 绕竖轴翻面 → 背面（牛皮纸蜡笔地图）平拍在镜头前（24.60–25.35）。
// 屏幕空间绘制。25.35 落定的那一刻，纸背上的内容与地图镜头的第一帧逐像素一致：
//   纸的落定变换 M_end = translate(960,540)·rotate(r)·scale(SE)，地图机位 S = applyCam(mapCam(L09))
//   ⇒ 纸背局部坐标里画地图时用 M_end⁻¹·S = scale(z/SE)·translate(−cx,−cy)（r 与机位滚转相同，互相抵消）。
import { PAL, rgba } from '../../core/paper.js';
import { toScreen } from '../../core/camera.js';
import { clamp, lerp, seg, hash2 } from '../../core/util.js';
import { ez, outCubic, inOutCubic, inOutSine, inQuad } from '../../core/ease.js';
import { drawNotice, NOTICE } from '../../props/paper.js';
import { TT } from './timing.js';

export const SE = 8.6; // 落定时纸的缩放（四边与撕掉的两角都在画外）
const W = NOTICE.w, H = NOTICE.h;
const D2R = Math.PI / 180;

// 撕剩的纸：去掉左右上角两块（与 drawNotice corners 模式同一条锯齿，告示板上留下的就是那两块）
const TORN = (() => {
  const seed = 3, pts = [];
  const chain = (sx) => {
    const cx = sx * W / 2, cy = -H / 2, out = [[cx - sx * 62, cy]];
    for (let i = 1; i < 7; i++) {
      const u = i / 7;
      out.push([cx - sx * 62 * (1 - u) + (hash2(seed + sx, i) - 0.5) * 7, cy + 50 * u + (hash2(seed + 4 + sx, i) - 0.5) * 7]);
    }
    out.push([cx, cy + 50]);
    return out;
  };
  pts.push(...chain(-1).reverse()); // 左上：从左边 (−W/2, −H/2+50) 沿锯齿到 (−W/2+62, −H/2)
  pts.push(...chain(1)); // 右上：从 (W/2−62, −H/2) 沿锯齿到 (W/2, −H/2+50)
  pts.push([W / 2, H / 2], [-W / 2, H / 2]);
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
})();

/**
 * 告示在屏幕上的状态。start：撕下那一刻告示板中心的屏幕坐标与缩放（由广场机位算）。
 * 返回 { x, y, s, rot, flip }；T < TT.tear 返回 null。
 */
export function noticeFlight(T, start, landRot) {
  if (T < TT.tear) return null;
  const [x0, y0, s0] = start;
  const u = seg(T, TT.tear, TT.cover);
  let x, y, s, rot, flip = 0;
  if (T < TT.cover) {
    const e = inOutSine(u);
    x = lerp(x0, 960, e);
    y = lerp(y0, 560, e) - 90 * Math.sin(Math.PI * Math.min(1, u * 1.15));
    s = s0 / (1 - 0.87 * inQuad(u) * 0.55 - 0.87 * 0.45 * u);
    rot = (-20 * outCubic(seg(T, TT.tear, TT.tear + 0.09)) + 28 * inOutSine(seg(T, TT.tear + 0.09, TT.cover))) * D2R;
    flip = 0.14 * Math.sin(Math.PI * u); // 翻滚的扭动（不过半，不露背面）
  } else if (T < TT.flip[0]) {
    const k = outCubic(seg(T, TT.cover, TT.flip[0]));
    x = 960; y = lerp(560, 540, k);
    s = lerp(s0 / 0.13, 8.05, k);
    rot = lerp(8, 5, k) * D2R + 0.012 * Math.sin((T - TT.cover) * 24) * (1 - k);
  } else if (T < TT.flip[1]) {
    const k = inOutCubic(seg(T, TT.flip[0], TT.flip[1]));
    x = 960; y = 540;
    s = lerp(8.05, 8.3, k);
    rot = lerp(5, -1, k) * D2R;
    flip = k;
  } else {
    const k = seg(T, TT.flip[1], TT.land);
    x = 960; y = 540;
    s = lerp(8.3, SE, inQuad(k));
    rot = lerp(-1 * D2R, landRot, ez(T, TT.flip[1], TT.land, inOutSine));
    flip = 1;
  }
  return { x, y, s, rot, flip };
}

/** 四个屏幕角是否都落在纸里（盖满时可以不画后面的广场）。 */
export function noticeCovers(st) {
  if (!st) return false;
  const ax = (W / 2) * st.s * Math.abs(Math.cos(Math.PI * st.flip)), ay = (H / 2) * st.s;
  const c = Math.cos(-st.rot), sn = Math.sin(-st.rot);
  for (const [px, py] of [[-12, -12], [1932, -12], [-12, 1092], [1932, 1092]]) {
    const dx = px - st.x, dy = py - st.y;
    const qx = dx * c - dy * sn, qy = dx * sn + dy * c;
    if (Math.abs(qy) > ay - 4) return false;
    const inner = Math.abs(qx) <= ax - 62 * st.s * Math.abs(Math.cos(Math.PI * st.flip));
    if (!inner && (Math.abs(qx) > ax - 4 || qy < (-H / 2 + 52) * st.s)) return false;
  }
  return true;
}

/**
 * 画飞行中的告示（撕掉两角）。back(bg) 在纸背局部坐标里画地图（已裁到纸内）。
 * 返回状态（供冲击 / 底图判断）。
 */
export function drawFlyingNotice(g, T, st, back) {
  if (!st) return;
  const fx = Math.cos(Math.PI * st.flip);
  g.save();
  // 撕边裁切：与 drawNotice 内部同一个变换（平移 → 旋转 → 缩放 → 翻面压扁）
  const m = g.getTransform();
  g.translate(st.x, st.y); g.rotate(st.rot); g.scale(st.s * Math.max(0.003, Math.abs(fx)), st.s);
  g.clip(TORN);
  g.setTransform(m);
  drawNotice(g, { x: st.x, y: st.y, s: st.s, rot: st.rot, flip: st.flip, face: 'front', pins: 0, t: T, back });
  // 撕口毛边：沿锯齿补一道浅色纤维亮线（只在正面、纸还小的时候看得清）
  if (fx > 0.2 && st.s < 4) {
    g.translate(st.x, st.y); g.rotate(st.rot); g.scale(st.s * fx, st.s);
    g.strokeStyle = rgba(PAL.white, 0.7); g.lineWidth = 1.6 / st.s;
    g.stroke(TORN);
  }
  g.restore();
}
