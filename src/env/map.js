// 地图：三种形态（蜡笔版 / 羊皮纸版 / 小地图）共用一套地标 (u,v) 与一条按弧长取点的路线。
//   蜡笔版（立誓 b03，告示背面）x = u·1920, y = v·1080      —— 世界坐标，镜头自己 applyCam
//   羊皮纸版（间奏一 b06）      x = 160 + u·1600, y = 90 + v·900
//   小地图（旅途 HUD b07/b08/b14）x = 1524 + u·300, y = 72 + v·170（屏幕坐标卡片）
// 纯函数：只由参数（含 T）决定画面；内部 save/restore；不调 ctx.layer / ctx.mask。
import { PAL, blob, poly, cut, shade, lin, rad, glow, rays, sparkle, ribbon, smooth as smoothPath } from '../core/paper.js';
import { clamp, lerp, seg, TAU, hash2, rgba, mixHex, wobble, smoothstep } from '../core/util.js';
import { outBack, outCubic, inOutCubic, inOutSine, inQuad, outQuad } from '../core/ease.js';
import { applyCam } from '../core/camera.js';
import { paperGlyph } from '../ui/type.js';
import { NAMES } from '../cues.js';

// ———————————————————— 地标与三种形态 ————————————————————
/** 地标 (u,v)（storyboard 4.4）。 */
export const MAP_UV = Object.freeze({
  castle: [0.12, 0.58], meadow: [0.27, 0.68], village: [0.43, 0.52],
  pass: [0.58, 0.33], forest: [0.73, 0.53], dragon: [0.885, 0.40],
});
/** 路线经过地标的顺序。 */
export const MAP_ORDER = Object.freeze(['castle', 'meadow', 'village', 'pass', 'forest', 'dragon']);
/** 三种形态的矩形：x = rect.x + u·w, y = rect.y + v·h。 */
export const MAP_FORMS = Object.freeze({
  crayon: Object.freeze({ x: 0, y: 0, w: 1920, h: 1080 }),
  parchment: Object.freeze({ x: 160, y: 90, w: 1600, h: 900 }),
  mini: Object.freeze({ x: 1524, y: 72, w: 300, h: 170 }),
});
const formOf = (f) => (typeof f === 'string' ? MAP_FORMS[f] : f || MAP_FORMS.crayon);

/** (u,v) → 某形态的坐标。form 为 'crayon' | 'parchment' | 'mini' 或任意 {x,y,w,h}。 */
export function mapToScreen(form, u, v) {
  const f = formOf(form);
  return [f.x + u * f.w, f.y + v * f.h];
}

// ———————————————————— 路线（按弧长） ————————————————————
// 穿过 6 个地标的平滑开放曲线（与 paper.smooth 同一构造：Catmull-Rom，张力 0.5），
// 加轻微手绘抖动（在地标处为 0，保证正好穿过地标），弧长在 16:9 度量里计算（三种形态比例一致）。
const AX = 16, AY = 9;
const ROUTE = (() => {
  const P = MAP_ORDER.map((k) => [MAP_UV[k][0] * AX, MAP_UV[k][1] * AY]);
  const n = P.length, s = 0.5 / 3, PER = 96;
  const get = (i) => P[Math.max(0, Math.min(n - 1, i))];
  const raw = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) * s, p1[1] + (p2[1] - p0[1]) * s];
    const c2 = [p2[0] - (p3[0] - p1[0]) * s, p2[1] - (p3[1] - p1[1]) * s];
    for (let k = 0; k < PER; k++) {
      const t = k / PER, mt = 1 - t;
      const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
      raw.push([a * p1[0] + b * c1[0] + c * c2[0] + d * p2[0], a * p1[1] + b * c1[1] + c * c2[1] + d * p2[1], t]);
    }
  }
  raw.push([P[n - 1][0], P[n - 1][1], 0]);
  const L0 = [0];
  for (let i = 1; i < raw.length; i++) L0.push(L0[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const pts = raw.map((p, i) => {
    const a = raw[Math.max(0, i - 1)], b = raw[Math.min(raw.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const w = 0.03 * Math.sin(Math.PI * p[2]) * (0.62 * Math.sin(L0[i] * 7.1 + 1.3) + 0.38 * Math.sin(L0[i] * 13.7 + 0.4));
    return [p[0] - (dy / len) * w, p[1] + (dx / len) * w];
  });
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = L[L.length - 1];
  return { uv: pts.map(([x, y]) => [x / AX, y / AY]), L, total, marks: MAP_ORDER.map((_, i) => L[i * PER] / total) };
})();

/** 各地标在路线上的弧长参数 r（castle = 0，dragon = 1）。 */
export const MAP_ROUTE_R = Object.freeze(Object.fromEntries(MAP_ORDER.map((k, i) => [k, ROUTE.marks[i]])));

function routeIndex(s) {
  const L = ROUTE.L;
  let lo = 0, hi = L.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
  return lo;
}
/** r ∈ [0,1]（按弧长）→ [u, v]。 */
export function mapRoute(r) {
  const s = clamp(r) * ROUTE.total;
  const i = routeIndex(s), j = Math.min(i + 1, ROUTE.uv.length - 1);
  const k = (s - ROUTE.L[i]) / ((ROUTE.L[j] - ROUTE.L[i]) || 1);
  return [lerp(ROUTE.uv[i][0], ROUTE.uv[j][0], k), lerp(ROUTE.uv[i][1], ROUTE.uv[j][1], k)];
}
/** 路线在 r 处的切线角（16:9 度量下，弧度；0 = 向右）。 */
export function mapRouteAngle(r) {
  const a = mapRoute(clamp(r) - 0.004), b = mapRoute(clamp(r) + 0.004);
  return Math.atan2((b[1] - a[1]) * AY, (b[0] - a[0]) * AX);
}
/** 路线 [r0, r1] 段在某形态里的折线点。 */
export function mapRoutePoints(form, r0 = 0, r1 = 1) {
  const f = formOf(form);
  const a = clamp(Math.min(r0, r1)), b = clamp(Math.max(r0, r1));
  const s0 = a * ROUTE.total, s1 = b * ROUTE.total;
  const out = [mapToScreen(f, ...mapRoute(a))];
  for (let i = routeIndex(s0) + 1; i < ROUTE.L.length && ROUTE.L[i] < s1; i++) out.push(mapToScreen(f, ROUTE.uv[i][0], ROUTE.uv[i][1]));
  out.push(mapToScreen(f, ...mapRoute(b)));
  return out;
}

// ———————————————————— 通用小工具 ————————————————————
const pathOf = (pts, closed = true) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (closed) p.closePath(); return p; };
const DEG = Math.PI / 180;

/** 把折线切成虚线段（每段一个点数组），图案从起点算起，生长时已画的段不会挪动。 */
function dashSplit(pts, on, off) {
  const out = [];
  const period = on + off;
  let pos = 0, cur = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    let [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    let len = Math.hypot(x1 - x0, y1 - y0);
    while (len > 1e-9) {
      const inOn = pos < on;
      const remain = inOn ? on - pos : period - pos;
      if (remain >= len) {
        pos += len;
        if (inOn) cur.push([x1, y1]);
        len = 0;
      } else {
        const k = remain / len;
        const xm = x0 + (x1 - x0) * k, ym = y0 + (y1 - y0) * k;
        if (inOn) { cur.push([xm, ym]); if (cur.length > 1) out.push(cur); cur = null; } else cur = [[xm, ym]];
        pos = (pos + remain) % period;
        len -= remain; x0 = xm; y0 = ym;
      }
    }
  }
  if (cur && cur.length > 1) out.push(cur);
  return out;
}
function polyLen(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; }
/** 折线的前 p（0..1，按长度）部分。 */
function polyHead(pts, p) {
  if (p >= 1) return pts;
  const L = polyLen(pts) * clamp(p);
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= L) { const k = (L - acc) / (d || 1); out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]); return out; }
    acc += d; out.push(pts[i]);
  }
  return out;
}

/**
 * 蜡笔笔触：两遍 alpha 0.8 的抖动描边 + 沿线的纸纹“露白”小点（蜡笔压不进纸纹的地方）。
 * o: { color, lw, seed, alpha, tooth（露白点颜色，= 底纸色）, teeth（露白密度 0..1） }
 */
function crayonLine(g, pts, o) {
  if (pts.length < 2) return;
  const { color, lw = 9, seed = 1, alpha = 1, tooth = PAL.kraft, teeth = 0.5 } = o;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color;
  for (let pass = 0; pass < 2; pass++) {
    g.globalAlpha = alpha * 0.8;
    g.lineWidth = lw * (pass ? 0.74 : 0.96);
    const ox = pass ? -0.6 : 0.5, oy = pass ? -0.45 : 0.4;
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const jx = (hash2(seed * 7 + pass, i) - 0.5) * lw * 0.12, jy = (hash2(seed * 11 + pass, i) - 0.5) * lw * 0.12;
      if (i) g.lineTo(pts[i][0] + ox + jx, pts[i][1] + oy + jy); else g.moveTo(pts[i][0] + ox + jx, pts[i][1] + oy + jy);
    }
    g.stroke();
  }
  if (teeth > 0) {
    const sp = new Path2D();
    let acc = 0, k = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const d = Math.hypot(x1 - x0, y1 - y0);
      if (d < 1e-6) continue;
      const nx = -(y1 - y0) / d, ny = (x1 - x0) / d;
      for (; acc < d; acc += 4.2, k++) {
        if (hash2(seed * 3 + 0.5, k) > teeth) continue;
        const t = acc / d, off = (hash2(seed * 5 + 0.25, k) - 0.5) * lw * 0.85, r = 0.5 + hash2(seed, k + 0.5) * lw * 0.09;
        const x = lerp(x0, x1, t) + nx * off, y = lerp(y0, y1, t) + ny * off;
        sp.moveTo(x + r, y); sp.ellipse(x, y, r, r * 0.7, k, 0, TAU);
      }
      acc -= d;
    }
    g.globalAlpha = alpha * 0.55;
    g.fillStyle = tooth;
    g.fill(sp);
  }
  g.restore();
}
/** 蜡笔排线填色（在 clip 内来回折线），p 0..1 为排到哪（从左往右）。 */
function crayonHatch(g, clipPath, box, o) {
  const { color, lw = 6, gap = 9, ang = -0.5, p = 1, seed = 3, alpha = 0.75, tooth = PAL.kraft } = o;
  if (p <= 0) return;
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + lw;
  const pts = [];
  const n = Math.ceil((2 * R) / gap);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i <= n; i++) {
    const u = -R + i * gap;
    const a = i % 2 ? R : -R;
    pts.push([cx + u * ca - a * sa + (hash2(seed, i) - 0.5) * 3, cy + u * sa + a * ca + (hash2(seed + 1, i) - 0.5) * 3]);
  }
  g.save();
  g.clip(clipPath);
  crayonLine(g, polyHead(pts, p), { color, lw, seed, alpha, tooth, teeth: 0.35 });
  g.restore();
}

/** 心形路径点（经典参数心形），从顶部凹口出发顺时针。bbox 中心在 (cx,cy)，高 h。 */
export function heartPoints(cx, cy, h, n = 96) {
  const k = h / 28.7, out = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    out.push([cx + x * k, cy - (y + 2.65) * k]);
  }
  return out;
}
/** 心形 Path2D（与蜡笔地图上那颗心同一轮廓；b04 心形遮罩用它保证交接一致）。 */
export const heartPath = (cx, cy, h) => pathOf(heartPoints(cx, cy, h, 96));

/** 立起的纸片（立体书机关）：以底边为锚 scaleY 0→1（outBack 过冲），底部带一小片折角与接触阴影。 */
function standUp(g, bx, by, p, w, fn, o = {}) {
  if (p <= 0) return;
  const k = p >= 1 ? 1 : Math.max(0.001, outBack(clamp(p), o.back ?? 2.4));
  g.save();
  // 接触阴影（右下）：随立起变实
  g.fillStyle = rgba(PAL.shadow, 0.16 * clamp(p * 1.6));
  g.fill(blob(bx + w * 0.08, by + 2.5, w * 0.56, Math.max(2, w * 0.05), { seed: Math.round(bx), amp: 0.06 }));
  // 底部折角小片（粘在页面上的舌片）
  if (o.tab !== false) {
    const tw = w * 0.5;
    g.fillStyle = rgba(PAL.shadow, 0.10);
    g.fill(pathOf([[bx - tw / 2, by], [bx + tw / 2, by], [bx + tw / 2 - 4, by + 6], [bx - tw / 2 + 4, by + 6]]));
  }
  g.translate(bx, by); g.scale(1, k); g.translate(-bx, -by);
  fn(k);
  g.restore();
}

// ———————————————————— 小骑士、图钉、蜡笔手 ————————————————————
/**
 * 纸片小骑士（马 + 骑手剪影，奶油色贴纸白边 + 木底座）。锚点 = 底座中心 (x,y)。
 * o: { x, y, size=60（总高）, face=1|-1, hop 0..1（蹦一下）, t（马腿小跑相位）, pen（底座带红墨笔尖）, alpha, rot }
 */
export function drawKnightToken(g, o = {}) {
  const { x = 0, y = 0, size = 60, face = 1, hop = 0, t = 0, pen = false, alpha = 1, rot = 0 } = o;
  if (alpha <= 0) return;
  const s = size / 60;
  const h = Math.sin(Math.PI * clamp(hop));
  const gal = Math.sin(t * TAU * 2.2);
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  // 底座阴影（不随骑士跳）
  g.fillStyle = rgba(PAL.shadow, 0.22 * (1 - h * 0.5));
  g.beginPath(); g.ellipse(3 * s, 2.5 * s, 18 * s * (1 - h * 0.25), 4.5 * s, 0, 0, TAU); g.fill();
  if (pen) { g.fillStyle = PAL.scarf; g.beginPath(); g.ellipse(0, 1 * s, 5 * s, 2.6 * s, 0, 0, TAU); g.fill(); }
  g.translate(0, -h * 9 * s);
  g.rotate(rot + h * 0.08 * face);
  g.scale(s * face, s);
  // 木底座
  cut(g, blob(0, -1.5, 17, 5, { seed: 5, amp: 0.02 }), PAL.woodDark);
  cut(g, blob(0, -3.2, 16, 4.2, { seed: 6, amp: 0.02 }), PAL.wood, { rim: mixHex(PAL.wood, PAL.paper, 0.5), rimW: 1.2 });
  // 部件（局部坐标，马头朝 +x）
  const legA = 0.28 * gal, legB = -0.28 * gal;
  const leg = (x0, y0, ang, len) => [[x0, y0], [x0 + Math.sin(ang) * len * 0.55, y0 + Math.cos(ang) * len * 0.5], [x0 + Math.sin(ang) * len, y0 + Math.cos(ang) * len]];
  const legs = [leg(9, -17, 0.55 + legA, 13), leg(6, -17, 0.15 + legB, 13), leg(-9, -17, -0.45 + legB, 13), leg(-6, -17, -0.1 + legA, 13)];
  const body = blob(-0.5, -22, 15, 8.2, { seed: 7, amp: 0.03 });
  const neck = poly([[7, -27], [15, -38], [21, -42], [26, -36], [18, -26], [11, -18]], { seed: 8, amp: 0.4, step: 6, round: 0.6 });
  const head = blob(24.5, -38.5, 7.2, 4.4, { seed: 9, amp: 0.03, rot: 0.45 });
  const tail = ribbon([[-14, -25], [-21, -24 + gal * 1.5], [-26, -19 + gal * 2], [-28, -12 + gal * 2]], (k) => 3.2 * (1 - k * 0.6));
  const mane = ribbon([[12, -32], [16, -38], [20, -42], [23, -44]], (k) => 2.6 * (1 - k * 0.5));
  const torso = blob(-1.5, -37, 6, 8.5, { seed: 10, amp: 0.04 });
  const headR = blob(0.5, -50, 6.4, 6.2, { seed: 11, amp: 0.03 });
  const hair = poly([[-6, -51], [-4.8, -56.5], [0, -58.5], [5.5, -56], [7, -51.5], [3, -53.5], [-1, -54], [-4, -52.5]], { seed: 12, amp: 0.3, step: 4, round: 0.7 });
  const sw = Math.sin(t * TAU * 1.3);
  const scarf = ribbon([[-2, -44], [-10, -46 + sw], [-18, -44 - sw * 1.4], [-26, -46 + sw * 2], [-32, -43 - sw * 2]], (k) => 2.4 * (1 - k * 0.45));
  // 贴纸白边（一次描边统一外轮廓）
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = PAL.paper; g.lineWidth = 6.5;
  for (const p of [body, neck, head, tail, torso, headR, hair, scarf]) g.stroke(p);
  for (const l of legs) { g.beginPath(); g.moveTo(...l[0]); g.lineTo(...l[1]); g.lineTo(...l[2]); g.stroke(); }
  g.fillStyle = PAL.paper;
  for (const p of [body, neck, head, torso, headR]) g.fill(p);
  g.restore();
  // 马
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 4; i++) {
    const l = legs[i];
    g.strokeStyle = i % 2 ? PAL.horseShade : PAL.horse; g.lineWidth = 3.3;
    g.beginPath(); g.moveTo(...l[0]); g.lineTo(...l[1]); g.lineTo(...l[2]); g.stroke();
    g.fillStyle = PAL.mane; g.beginPath(); g.arc(l[2][0], l[2][1], 1.7, 0, TAU); g.fill();
  }
  g.restore();
  cut(g, tail, PAL.mane);
  cut(g, body, PAL.horse, { rim: PAL.white, rimW: 1.4 });
  shade(g, body, PAL.horseShade, 0, -30, 0, -14, 0, 0.9);
  cut(g, neck, PAL.horse);
  cut(g, head, PAL.horse);
  cut(g, mane, PAL.mane);
  g.fillStyle = PAL.ink; g.beginPath(); g.arc(25.5, -40, 0.9, 0, TAU); g.fill();
  g.strokeStyle = PAL.gold; g.lineWidth = 1.1; g.beginPath(); g.moveTo(21, -40); g.lineTo(28, -37.5); g.stroke();
  // 骑手
  cut(g, scarf, PAL.scarf);
  cut(g, torso, PAL.heroBlue, { rim: mixHex(PAL.heroBlue, PAL.white, 0.45), rimW: 1.2 });
  cut(g, blob(1, -28, 3.4, 5, { seed: 13 }), PAL.boot);
  cut(g, headR, PAL.skin);
  cut(g, hair, PAL.heroHair);
  g.fillStyle = PAL.ink; g.beginPath(); g.ellipse(3.6, -50, 0.75, 1.1, 0, 0, TAU); g.fill();
  g.fillStyle = rgba(PAL.blush, 0.45); g.beginPath(); g.ellipse(3.2, -47.4, 1.4, 0.9, 0, 0, TAU); g.fill();
  g.restore();
}

/**
 * 红色任务图钉（水滴形，钉头上路径画「！」）。锚点 = 钉尖 (x,y)。
 * o: { x, y, size=84（总高）, drop 0..1（从上方落下 0–0.55，砸下挤压 0.55–0.75，回弹余振，0.55 起漾两圈波纹）, alpha }
 */
export function drawMissionPin(g, o = {}) {
  const { x = 0, y = 0, size = 84, drop = 1, alpha = 1 } = o;
  if (drop <= 0 || alpha <= 0) return;
  const s = size / 84;
  const d = clamp(drop);
  const fall = d < 0.55 ? 1 - inQuad(d / 0.55) : 0;
  const after = Math.max(0, d - 0.55) / 0.45;
  let sq = 0;
  if (d >= 0.55) sq = Math.exp(-after * 4.5) * Math.cos(after * 15) * 0.22;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  // 波纹
  if (d >= 0.55) {
    for (let k = 0; k < 2; k++) {
      const a = clamp((after - k * 0.18) / 0.82);
      if (a <= 0 || a >= 1) continue;
      g.strokeStyle = rgba(k ? PAL.redDark : PAL.red, 0.75 * (1 - a));
      g.lineWidth = 3.2 * s * (1 - a * 0.5);
      g.beginPath(); g.ellipse(0, 0, (12 + a * 74) * s, (4 + a * 24) * s, 0, 0, TAU); g.stroke();
    }
  }
  // 地面阴影（越近越实）
  g.fillStyle = rgba(PAL.shadow, 0.28 * (1 - fall * 0.8));
  g.beginPath(); g.ellipse(6 * s, 2 * s, 14 * s * (1 - fall * 0.5), 4 * s, 0, 0, TAU); g.fill();
  g.translate(0, -fall * 380 * s);
  g.scale(s * (1 - sq * 0.6), s * (1 + sq));
  // 钉针
  g.strokeStyle = PAL.steelDark; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -16); g.stroke();
  g.strokeStyle = PAL.steel; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-0.6, -2); g.lineTo(-0.6, -15); g.stroke();
  // 水滴钉头
  const R = 24, cy = -52;
  const drop_ = new Path2D();
  const be = Math.acos(R / (-12 - cy));
  drop_.moveTo(0, -12);
  drop_.arc(0, cy, R, Math.PI / 2 + be, Math.PI / 2 - be + TAU, false);
  drop_.closePath();
  cut(g, drop_, PAL.red, { shadow: 3, rim: mixHex(PAL.red, PAL.goldLight, 0.55), rimW: 2.4 });
  shade(g, drop_, PAL.redDark, -R, cy - R, R, cy + R, 0, 0.7);
  g.fillStyle = rgba(PAL.white, 0.5);
  g.beginPath(); g.ellipse(-9, cy - 10, 5, 7.5, -0.5, 0, TAU); g.fill();
  // 「！」（路径画）
  const bar = new Path2D();
  bar.moveTo(-4.2, cy - 15); bar.lineTo(4.2, cy - 15); bar.lineTo(2.4, cy + 4); bar.lineTo(-2.4, cy + 4); bar.closePath();
  cut(g, bar, PAL.paper);
  g.fillStyle = PAL.paper; g.beginPath(); g.arc(0, cy + 11, 3.6, 0, TAU); g.fill();
  g.restore();
}

/**
 * 戴棕手套的手握红蜡笔（带纸套）。锚点 = 笔尖 tip:[x,y]。
 * o: { tip, ang（从笔尖指向手的方向，弧度；默认 2.3 = 手在左下）, s=1, press 0..1（下压，笔尖压扁一点）, t（笔触轻颤）, alpha }
 */
export function drawCrayon(g, o = {}) {
  const { tip = [960, 540], ang = 2.3, s = 1, press = 0, t = 0, alpha = 1 } = o;
  if (alpha <= 0) return;
  const tremble = Math.sin(t * 23) * 0.006 + Math.sin(t * 7.3) * 0.01;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(tip[0], tip[1]);
  g.rotate(ang + tremble);
  g.scale(s, s);
  // 局部坐标：笔尖在原点，笔身沿 +x 伸向手；+y 是拇指一侧（ang≈2.3 时在屏幕左上）
  const W = 12;
  // —— 蜡笔（先画，手盖在上面） ——
  const body = pathOf([[22, -W], [232, -W], [236, -W + 3], [236, W - 3], [232, W], [22, W]]);
  cut(g, body, PAL.scarf, { shadow: 6 });
  // press：笔尖压钝成一小段平头（0 时与原造型完全一样）
  const pr = clamp(press);
  const tipPts = pr > 0 ? [[0, -2.6 * pr], [7, -4 - 1.6 * pr], [24, -W + 0.5], [24, W - 0.5], [7, 4 + 1.6 * pr], [0, 2.6 * pr]] : [[0, 0], [7, -4], [24, -W + 0.5], [24, W - 0.5], [7, 4]];
  const tipP = poly(tipPts, { seed: 1, amp: 0.3, step: 6, round: 0.4 });
  cut(g, tipP, PAL.scarf);
  shade(g, tipP, PAL.scarfDark, 0, -W, 0, W, 0.15, 0.85);
  g.fillStyle = rgba(PAL.white, 0.4); g.fill(pathOf([[4, -1.6], [22, -W + 3], [22, -W + 6], [6, 0]]));
  const wrap = pathOf([[46, -W - 0.8], [150, -W - 0.8], [150, W + 0.8], [46, W + 0.8]]);
  cut(g, wrap, PAL.paper);
  shade(g, wrap, PAL.kraftDark, 0, -W, 0, W, 0.05, 0.45);
  g.save(); g.clip(wrap);
  g.fillStyle = PAL.scarfDark; g.fillRect(50, -W - 2, 4, 2 * W + 4);
  g.strokeStyle = PAL.scarfDark; g.lineWidth = 2; g.lineJoin = 'round';
  g.beginPath(); for (let i = 0; i <= 10; i++) { const xx = 60 + i * 7; const yy = i % 2 ? -4.5 : 4.5; if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy); } g.stroke();
  g.restore();
  g.fillStyle = rgba(PAL.white, 0.28); g.fillRect(24, -W + 2, 210, 3.5);
  // —— 袖子 + 手套口 ——
  const sleeve = poly([[206, -50], [760, -86], [776, 92], [206, 52]], { seed: 32, amp: 1.6, step: 30, round: 0.2 });
  cut(g, sleeve, PAL.heroBlue, { shadow: 6, rim: mixHex(PAL.heroBlue, PAL.white, 0.45), rimW: 3 });
  shade(g, sleeve, PAL.heroBlueDark, 0, 60, 0, -50, 0.0, 0.55);
  const band = poly([[204, -52], [232, -54], [234, 56], [204, 54]], { seed: 33, amp: 0.8, step: 14, round: 0.4 });
  cut(g, band, PAL.heroBlueDark);
  const cuffP = poly([[170, -46], [214, -50], [218, 52], [172, 48], [162, 2]], { seed: 34, amp: 1, step: 14, round: 0.7 });
  cut(g, cuffP, PAL.boot, { rim: mixHex(PAL.boot, PAL.paper, 0.45), rimW: 2.4 });
  g.save(); g.strokeStyle = rgba(PAL.goldLight, 0.55); g.lineWidth = 1.6; g.setLineDash([4, 4]);
  g.beginPath(); g.moveTo(178, -40); g.quadraticCurveTo(170, 2, 180, 44); g.stroke(); g.restore();
  // —— 手背（拳） ——
  const rim = mixHex(PAL.leather, PAL.paper, 0.5), dark = mixHex(PAL.leather, PAL.boot, 0.6);
  // 卷在笔下面的三根手指（拳面上的指节）
  for (const [cx, cy, rx, ry] of [[112, -30, 15, 12], [126, -42, 15, 12], [146, -48, 15, 11.5]]) {
    const f = blob(cx, cy, rx, ry, { seed: cx, amp: 0.03 });
    cut(g, f, PAL.leather, { rim, rimW: 1.6 });
    shade(g, f, PAL.boot, cx, cy - ry, cx, cy + ry, 0, 0.45);
  }
  const back = poly([[104, -26], [124, -40], [172, -44], [182, 6], [176, 40], [140, 46], [110, 30], [98, 4]], { seed: 35, amp: 0.8, step: 14, round: 0.75 });
  cut(g, back, PAL.leather, { shadow: 4, rim, rimW: 2.6 });
  shade(g, back, PAL.boot, 0, 44, 0, -40, 0, 0.5);
  // 手套缝线 + 指节缝
  g.save(); g.strokeStyle = rgba(PAL.goldLight, 0.5); g.lineWidth = 1.5; g.setLineDash([4, 4]);
  g.beginPath(); g.moveTo(170, -34); g.quadraticCurveTo(154, 2, 166, 36); g.stroke(); g.setLineDash([]); g.restore();
  g.save(); g.strokeStyle = rgba(PAL.boot, 0.75); g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(118, -20); g.quadraticCurveTo(126, -24, 132, -34); g.moveTo(136, -26); g.quadraticCurveTo(144, -32, 150, -42); g.stroke();
  g.restore();
  // 食指：压在笔身上、伸向笔尖
  const idx = capsule(128, -6, 70, -2, 11.5);
  cut(g, idx, PAL.leather, { shadow: 2, rim, rimW: 2 });
  shade(g, idx, PAL.boot, 0, 10, 0, -12, 0, 0.45);
  g.fillStyle = rgba(PAL.boot, 0.6); g.beginPath(); g.ellipse(84, -2.5, 3.2, 7.5, 0, 0, TAU); g.fill();
  // 拇指：从拇指一侧夹住笔
  const th = capsule(152, 30, 98, 20, 11);
  cut(g, th, PAL.leather, { rim, rimW: 2 });
  shade(g, th, dark, 0, 40, 0, 10, 0, 0.5);
  g.restore();
}
/** 两端圆头的胶囊形（手指）。 */
function capsule(x0, y0, x1, y1, r) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * r, ny = Math.cos(a) * r;
  const p = new Path2D();
  p.moveTo(x0 + nx, y0 + ny); p.lineTo(x1 + nx, y1 + ny);
  p.arc(x1, y1, r, a + Math.PI / 2, a - Math.PI / 2, true);
  p.lineTo(x0 - nx, y0 - ny);
  p.arc(x0, y0, r, a - Math.PI / 2, a + Math.PI / 2, true);
  p.closePath();
  return p;
}
function rrPath(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }

// ———————————————————— 蜡笔地图（立誓，告示背面） ————————————————————
/** 蜡笔地图布局（世界 = 1920×1080 版，镜头自己 applyCam）。heart 是 b04 心形遮罩的交接物。 */
export const CRAYON = Object.freeze({
  sheet: Object.freeze({ x0: -380, y0: -220, x1: 2300, y1: 1300 }),
  castle: Object.freeze([230, 626]),
  sword: Object.freeze({ x: 290, y: 632, len: 172 }),
  mountain: Object.freeze({ x: 1114, y: 480, peak: Object.freeze([1114, 238]) }),
  forest: Object.freeze([[1350, 600, 168], [1395, 592, 176], [1440, 600, 160], [1486, 590, 172], [1372, 648, 132], [1418, 655, 124], [1463, 644, 136]].map(Object.freeze)),
  owl: Object.freeze([1417, 492]),
  dragonMt: Object.freeze({ x: 1745, y: 640, peak: Object.freeze([1745, 300]) }),
  cage: Object.freeze({ x: 1638, y: 672 }),
  heart: Object.freeze({ x: 1638, y: 620, h: 200 }),
});

const CR = (() => {
  const sh = CRAYON.sheet;
  const sheet = poly([[sh.x0, sh.y0], [sh.x1, sh.y0], [sh.x1, sh.y1], [sh.x0, sh.y1]], { seed: 41, amp: 6, step: 70 });
  // 底稿涂鸦：王城（蜡笔线 + 排线）
  const cx = 214, by = 668;
  const towerL = pathOf([[cx - 70, by], [cx - 70, by - 98], [cx - 34, by - 98], [cx - 34, by]]);
  const towerR = pathOf([[cx + 42, by], [cx + 42, by - 96], [cx + 78, by - 96], [cx + 78, by]]);
  const keep = pathOf([[cx - 22, by], [cx - 22, by - 132], [cx + 26, by - 132], [cx + 26, by]]);
  const wall = pathOf([[cx - 34, by], [cx - 34, by - 58], [cx + 42, by - 58], [cx + 42, by]]);
  const roofL = pathOf([[cx - 78, by - 96], [cx - 52, by - 146], [cx - 26, by - 96]]);
  const roofK = pathOf([[cx - 30, by - 130], [cx + 2, by - 196], [cx + 34, by - 130]]);
  const roofR = pathOf([[cx + 34, by - 94], [cx + 60, by - 144], [cx + 86, by - 94]]);
  const castle = { towerL, towerR, keep, wall, roofL, roofK, roofR, cx, by };
  // 小丘
  const hills = [[430, 744, 92, 58], [574, 772, 118, 66], [726, 738, 86, 50]].map(([x, y, w, h], i) => {
    const pts = [];
    for (let k = 0; k <= 20; k++) { const a = Math.PI - (k / 20) * Math.PI; pts.push([x + Math.cos(a) * w, y - Math.sin(a) * h + (hash2(70 + i, k) - 0.5) * 3]); }
    return pts;
  });
  return { sheet, castle, hills };
})();

function drawCrayonSheet(g, T) {
  const sh = CRAYON.sheet;
  cut(g, CR.sheet, PAL.kraft);
  // 牛皮纸的斑驳与折痕（告示折过）
  g.save();
  g.clip(CR.sheet);
  const spots = [[300, 200, 520, 0.10], [1300, 860, 640, 0.09], [1750, 180, 480, 0.08], [700, 980, 420, 0.07], [-100, 700, 500, 0.08], [2100, 760, 520, 0.08]];
  for (const [x, y, r, a] of spots) { g.fillStyle = rad(g, x, y, 0, r, [[0, rgba(PAL.kraftDark, a)], [1, rgba(PAL.kraftDark, 0)]]); g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  for (const [x, y, r, a] of [[900, 420, 600, 0.12], [1500, 560, 420, 0.07]]) { g.fillStyle = rad(g, x, y, 0, r, [[0, rgba(PAL.paper, a)], [1, rgba(PAL.paper, 0)]]); g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  g.lineWidth = 3;
  g.strokeStyle = rgba(PAL.kraftDark, 0.32);
  g.beginPath(); g.moveTo(sh.x0, 548); g.bezierCurveTo(400, 552, 1300, 541, sh.x1, 546); g.stroke();
  g.beginPath(); g.moveTo(968, sh.y0); g.bezierCurveTo(962, 300, 972, 800, 965, sh.y1); g.stroke();
  g.strokeStyle = rgba(PAL.paper, 0.4); g.lineWidth = 2;
  g.beginPath(); g.moveTo(sh.x0, 551); g.bezierCurveTo(400, 555, 1300, 544, sh.x1, 549); g.stroke();
  g.beginPath(); g.moveTo(971, sh.y0); g.bezierCurveTo(965, 300, 975, 800, 968, sh.y1); g.stroke();
  g.restore();
}

function drawCrayonDoodles(g, T) {
  const c = CR.castle, tooth = PAL.kraft;
  // 王城：排线上色 + 墨蓝蜡笔描边
  crayonHatch(g, c.wall, [c.cx - 40, c.by - 60, c.cx + 48, c.by], { color: PAL.stone2, lw: 5, gap: 9, seed: 51 });
  for (const [p, b] of [[c.towerL, [c.cx - 72, c.by - 100, c.cx - 32, c.by]], [c.towerR, [c.cx + 40, c.by - 98, c.cx + 80, c.by]], [c.keep, [c.cx - 24, c.by - 134, c.cx + 28, c.by]]]) crayonHatch(g, p, b, { color: PAL.paper2, lw: 5, gap: 8, seed: 52 });
  for (const [p, b, col] of [[c.roofL, [c.cx - 80, c.by - 148, c.cx - 24, c.by - 94], PAL.roofRed], [c.roofK, [c.cx - 32, c.by - 198, c.cx + 36, c.by - 128], PAL.roof], [c.roofR, [c.cx + 32, c.by - 146, c.cx + 88, c.by - 92], PAL.roofRed]]) crayonHatch(g, p, b, { color: col, lw: 6, gap: 6.5, ang: 0.9, seed: 53 });
  const ink = mixHex(PAL.ink, PAL.heroBlueDark, 0.35);
  const outline = (pts, seed) => crayonLine(g, pts, { color: ink, lw: 4.5, seed, tooth, teeth: 0.3 });
  const by = c.by, cx = c.cx;
  outline([[cx - 70, by], [cx - 70, by - 98], [cx - 34, by - 98], [cx - 34, by - 58]], 61);
  outline([[cx + 42, by - 58], [cx + 42, by - 96], [cx + 78, by - 96], [cx + 78, by]], 62);
  outline([[cx - 22, by - 58], [cx - 22, by - 132], [cx + 26, by - 132], [cx + 26, by - 58]], 63);
  outline([[cx - 92, by + 2], [cx + 104, by - 1]], 64);
  outline([[cx - 78, by - 96], [cx - 52, by - 146], [cx - 26, by - 96]], 65);
  outline([[cx - 30, by - 130], [cx + 2, by - 196], [cx + 34, by - 130]], 66);
  outline([[cx + 34, by - 94], [cx + 60, by - 144], [cx + 86, by - 94]], 67);
  // 垛口 + 城门 + 小窗
  const cren = [];
  for (let k = 0; k < 4; k++) { const x = cx - 34 + k * 19; cren.push([x, by - 58], [x, by - 66], [x + 9, by - 66], [x + 9, by - 58]); }
  outline(cren, 68);
  const gate = [];
  for (let k = 0; k <= 10; k++) { const a = Math.PI - (k / 10) * Math.PI; gate.push([cx + 4 + Math.cos(a) * 14, by - 18 - Math.sin(a) * 14]); }
  outline([[cx - 10, by], ...gate, [cx + 18, by]], 69);
  g.fillStyle = rgba(ink, 0.8);
  for (const [x, y] of [[cx - 52, by - 70], [cx + 60, by - 70], [cx + 2, by - 100]]) { g.beginPath(); g.ellipse(x, y, 4.5, 6.5, 0, 0, TAU); g.fill(); }
  // 主堡小红旗
  const fw = Math.sin(T * 5) * 3;
  crayonLine(g, [[cx + 2, by - 196], [cx + 2, by - 226]], { color: PAL.woodDark, lw: 3.5, seed: 70, tooth });
  crayonLine(g, [[cx + 3, by - 226], [cx + 26, by - 219 + fw], [cx + 3, by - 211]], { color: PAL.scarf, lw: 5, seed: 71, tooth });
  // 小丘（绿色排线 + 轮廓）
  CR.hills.forEach((pts, i) => {
    const p = pathOf([...pts, [pts[pts.length - 1][0], pts[0][1]]]);
    crayonHatch(g, p, [pts[0][0], pts[10][1] - 4, pts[20][0], pts[0][1] + 2], { color: i === 1 ? PAL.meadow : PAL.grass, lw: 6, gap: 9, ang: -0.9, seed: 80 + i, alpha: 0.6 });
    crayonLine(g, pts, { color: PAL.grassDark, lw: 5.5, seed: 84 + i, tooth });
  });
  // 草点 + 小花
  for (let k = 0; k < 16; k++) {
    const x = 380 + hash2(90, k) * 470, y = 780 + hash2(91, k) * 90;
    crayonLine(g, [[x - 7, y - 8], [x - 4, y], [x - 1, y - 13], [x + 2, y], [x + 6, y - 9]], { color: k % 3 ? PAL.grass : PAL.grassDark, lw: 3, seed: 92 + k, tooth, teeth: 0.2 });
  }
  // 村庄两间小屋（立誓路线经过，只是底稿）
  for (const [hx, hy, col, sd] of [[790, 612, PAL.roofRed, 1], [852, 626, PAL.roof, 2]]) {
    const roof = pathOf([[hx - 26, hy - 26], [hx, hy - 50], [hx + 26, hy - 26]]);
    crayonHatch(g, roof, [hx - 28, hy - 52, hx + 28, hy - 24], { color: col, lw: 5, gap: 6, ang: 0.8, seed: 95 + sd });
    crayonLine(g, [[hx - 20, hy - 26], [hx - 20, hy], [hx + 20, hy], [hx + 20, hy - 26]], { color: ink, lw: 4, seed: 97 + sd, tooth });
    crayonLine(g, [[hx - 28, hy - 25], [hx, hy - 50], [hx + 28, hy - 25]], { color: ink, lw: 4, seed: 99 + sd, tooth });
    crayonLine(g, [[hx - 4, hy], [hx - 4, hy - 13], [hx + 5, hy - 13], [hx + 5, hy]], { color: ink, lw: 3.2, seed: 101 + sd, tooth });
  }
  // 左上角一个蜡笔小太阳
  const sp = [];
  for (let k = 0; k <= 40; k++) { const a = k * 0.42, r = 4 + k * 0.85; sp.push([118 + Math.cos(a) * r, 128 + Math.sin(a) * r]); }
  crayonLine(g, sp, { color: PAL.gold, lw: 6, seed: 110, tooth });
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + 0.2;
    crayonLine(g, [[118 + Math.cos(a) * 48, 128 + Math.sin(a) * 48], [118 + Math.cos(a) * 70, 128 + Math.sin(a) * 70]], { color: PAL.gold, lw: 5, seed: 111 + k, tooth });
  }
}

function crayonSword(g, p, T) {
  const { x, y } = CRAYON.sword;
  standUp(g, x, y, p, 60, () => {
    // 剑插在地上：刃从地面露出到护手
    const blade = pathOf([[x - 9, y], [x - 9, y - 112], [x, y - 120], [x + 9, y - 112], [x + 9, y]]);
    cut(g, blade, PAL.steel, { shadow: 3, rim: PAL.white, rimW: 2 });
    g.save(); g.clip(blade); g.fillStyle = rgba(PAL.steelDark, 0.75); g.fillRect(x, y - 130, 12, 140); g.restore();
    g.strokeStyle = rgba(PAL.steelDark, 0.7); g.lineWidth = 2; g.beginPath(); g.moveTo(x - 2, y - 8); g.lineTo(x - 2, y - 104); g.stroke();
    const guard = poly([[x - 30, y - 124], [x + 30, y - 124], [x + 34, y - 116], [x + 26, y - 110], [x - 26, y - 110], [x - 34, y - 116]], { seed: 121, amp: 0.4, step: 10, round: 0.5 });
    cut(g, guard, PAL.gold, { rim: PAL.goldLight, rimW: 2 });
    shade(g, guard, PAL.goldDark, x, y - 124, x, y - 110, 0, 0.7);
    const grip = rrPath(x - 6.5, y - 158, 13, 36, 4);
    cut(g, grip, PAL.leather);
    g.strokeStyle = rgba(PAL.boot, 0.9); g.lineWidth = 2;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x - 6, y - 150 + k * 8); g.lineTo(x + 6, y - 146 + k * 8); g.stroke(); }
    cut(g, blob(x, y - 165, 11, 11, { seed: 122 }), PAL.gold, { rim: PAL.goldLight, rimW: 1.6 });
    cut(g, blob(x, y - 165, 6.5, 6.5, { seed: 123 }), PAL.red, { rim: mixHex(PAL.red, PAL.white, 0.5), rimW: 1.2 });
    g.fillStyle = rgba(PAL.white, 0.8); g.beginPath(); g.arc(x - 2, y - 167.5, 1.8, 0, TAU); g.fill();
  });
  if (p >= 0.6) {
    // 土堆（蜡笔）与剑光
    crayonLine(g, [[x - 26, y + 2], [x - 12, y - 4], [x + 12, y - 4], [x + 28, y + 2]], { color: PAL.woodDark, lw: 4, seed: 125 });
    const tw = 0.5 + 0.5 * Math.sin(T * 6.3);
    sparkle(g, x + 10, y - 96, 10 + 6 * tw, { rot: T * 0.6, alpha: 0.9 * clamp((p - 0.6) * 3), color: PAL.white });
  }
}

function crayonMountain(g, p, flagP, T) {
  const { x, y } = CRAYON.mountain;
  const k_ = (y - CRAYON.mountain.peak[1]) / 320; // 高度缩放（峰顶与底边的距离 / 原设计 320）
  const Y = (dy) => y - dy * k_;
  standUp(g, x, y, p, 300, () => {
    const body = poly([[x - 164, y], [x - 104, Y(140)], [x - 76, Y(116)], [x - 30, Y(214)], [x, Y(320)], [x + 40, Y(210)], [x + 66, Y(170)], [x + 101, Y(208)], [x + 176, y]], { seed: 131, amp: 1.4, step: 22, round: 0.18 });
    cut(g, body, PAL.mountain, { shadow: 4, rim: mixHex(PAL.mountain, PAL.white, 0.45), rimW: 3 });
    g.save(); g.clip(body);
    g.fillStyle = rgba(PAL.mountainDark, 0.55);
    g.fill(pathOf([[x, Y(320)], [x + 40, Y(210)], [x + 66, Y(170)], [x + 101, Y(208)], [x + 176, y], [x + 24, y], [x + 8, Y(160)]]));
    g.restore();
    const snow = poly([[x - 52, Y(170)], [x - 30, Y(214)], [x, Y(320)], [x + 40, Y(210)], [x + 50, Y(194)], [x + 30, Y(200)], [x + 20, Y(182)], [x + 2, Y(206)], [x - 14, Y(178)], [x - 30, Y(194)]], { seed: 132, amp: 0.8, step: 14, round: 0.25 });
    cut(g, snow, PAL.snow, { rim: PAL.white });
    shade(g, snow, PAL.snowShade, x - 40, Y(300), x + 40, Y(180), 0, 0.6);
    const snow2 = poly([[x + 82, Y(180)], [x + 101, Y(208)], [x + 120, Y(162)], [x + 108, Y(168)], [x + 98, Y(156)]], { seed: 133, amp: 0.6, step: 10, round: 0.3 });
    cut(g, snow2, PAL.snow);
    crayonHatch(g, body, [x - 160, Y(150), x + 170, y], { color: mixHex(PAL.mountainDark, PAL.ink, 0.2), lw: 3.5, gap: 16, ang: -1.0, seed: 134, alpha: 0.28 });
  });
  if (flagP > 0) {
    const [px, py] = CRAYON.mountain.peak;
    const k = outBack(clamp(flagP), 2);
    const top = py - 58 * k;
    g.save();
    g.strokeStyle = PAL.woodDark; g.lineWidth = 4.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(px, py + 4); g.lineTo(px, top); g.stroke();
    const wv = (i) => Math.sin(T * 7 - i * 1.2) * 4 * k;
    const flag = pathOf([[px + 1, top + 2], [px + 24 * k, top + 8 + wv(1)], [px + 48 * k, top + 13 + wv(2)], [px + 24 * k, top + 19 + wv(1)], [px + 1, top + 26]]);
    cut(g, flag, PAL.scarf, { shadow: 2, rim: mixHex(PAL.scarf, PAL.white, 0.4), rimW: 1.6 });
    shade(g, flag, PAL.scarfDark, px, top, px + 48, top + 26, 0, 0.5);
    g.restore();
  }
}

function crayonPine(g, x, base, h, seed, p) {
  standUp(g, x, base, p, h * 0.62, () => {
    const w = h * 0.62;
    g.fillStyle = PAL.woodDark;
    g.fillRect(x - w * 0.07, base - h * 0.16, w * 0.14, h * 0.16 + 1);
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const tb = base - h * 0.12 - i * h * 0.21, tw = w * (1 - i * 0.2), tt = tb - h * 0.36;
      const pts = [[x - tw / 2, tb], [x - tw * 0.18, tb - h * 0.12], [x, tt], [x + tw * 0.18, tb - h * 0.12], [x + tw / 2, tb]];
      const tp = poly(pts, { seed: seed + i, amp: 0.9, step: 12, round: 0.2 });
      cut(g, tp, i % 2 ? PAL.forest : mixHex(PAL.forest, PAL.grassDark, 0.35), { shadow: i === 0 ? 3 : 0, rim: mixHex(PAL.forest, PAL.leafLight, 0.45), rimW: 2 });
      g.save(); g.clip(tp); g.fillStyle = rgba(PAL.forestDeep, 0.6); g.fillRect(x, tt - 2, tw, tb - tt + 4); g.restore();
    }
  });
}

function crayonOwl(g, T, at) {
  if (at == null || T < at) return;
  const [ox, oy] = CRAYON.owl;
  const open = clamp((T - at) / 0.12);
  const tb = T - at - 0.8;
  const blink = tb > 0 ? 1 - Math.max(0, 1 - Math.abs(((tb % 1.9) - 0.06) / 0.06)) : 1;
  const k = open * blink;
  g.save();
  g.fillStyle = rgba(PAL.forestDeep, 0.85 * open);
  g.fill(blob(ox, oy, 26, 14, { seed: 141 }));
  for (const dx of [-8.5, 8.5]) {
    glow(g, ox + dx, oy, 16, PAL.goldLight, 0.35 * k);
    g.fillStyle = PAL.goldLight; g.beginPath(); g.ellipse(ox + dx, oy, 6.2, 6.2 * k, 0, 0, TAU); g.fill();
    g.fillStyle = PAL.ink; g.beginPath(); g.ellipse(ox + dx + 0.8, oy, 2.3, 2.8 * k, 0, 0, TAU); g.fill();
  }
  g.restore();
}

function crayonDragonMt(g, p, T, duck) {
  const { x, y } = CRAYON.dragonMt;
  const mp = clamp(p / 0.75);
  standUp(g, x, y, mp, 280, () => {
    const body = poly([[x - 150, y], [x - 100, y - 200], [x - 70, y - 180], [x - 45, y - 280], [x, y - 340], [x + 30, y - 300], [x + 50, y - 296], [x + 72, y - 240], [x + 96, y - 218], [x + 140, y]], { seed: 151, amp: 1.6, step: 20, round: 0.15 });
    const col = mixHex(PAL.dragonDark, PAL.ink, 0.22);
    cut(g, body, col, { shadow: 4, rim: mixHex(PAL.dragonWing, PAL.white, 0.15), rimW: 2.6 });
    g.save(); g.clip(body);
    g.fillStyle = rgba(PAL.dragonDeep, 0.7);
    g.fill(pathOf([[x, y - 340], [x + 30, y - 300], [x + 50, y - 296], [x + 72, y - 240], [x + 96, y - 218], [x + 140, y], [x + 20, y], [x + 6, y - 180]]));
    g.restore();
    crayonHatch(g, body, [x - 150, y - 300, x + 140, y], { color: PAL.dragon, lw: 3.5, gap: 15, ang: 1.0, seed: 152, alpha: 0.32, tooth: col });
    // 洞口
    const cave = new Path2D();
    cave.moveTo(x - 8, y); cave.lineTo(x - 8, y - 30); cave.quadraticCurveTo(x + 22, y - 72, x + 52, y - 30); cave.lineTo(x + 52, y); cave.closePath();
    cut(g, cave, PAL.ink);
    glow(g, x + 22, y - 18, 40, PAL.magic, 0.35 + 0.15 * Math.sin(T * 3));
    // 冒烟（蜡笔小圈，一个接一个往上飘）
    for (let k = 0; k < 4; k++) {
      const ph = (T * 0.45 + k / 4) % 1;
      const cx0 = x + 22 + ph * 26 + Math.sin(ph * 5 + k) * 6, cy0 = y - 352 - ph * 90, r0 = 7 + ph * 12;
      const ring = [];
      for (let i = 0; i <= 14; i++) { const a = (i / 14) * TAU + k; ring.push([cx0 + Math.cos(a) * r0, cy0 + Math.sin(a) * r0 * 0.8]); }
      crayonLine(g, ring, { color: PAL.inkSoft, lw: 3.2, seed: 153 + k, alpha: 0.8 * (1 - ph) * Math.min(1, ph * 5), tooth: PAL.kraft, teeth: 0.25 });
    }
  });
  if (mp >= 0.4) drawDoodleDragon(g, x, y, T, duck, clamp((mp - 0.4) / 0.6));
}
/** 山顶趴着的涂鸦龙（蜡笔线）。duck 0..1 缩脖子。 */
function drawDoodleDragon(g, x, y, T, duck, a) {
  const col = mixHex(PAL.dragon, PAL.magic, 0.15), tooth = mixHex(PAL.dragonDark, PAL.ink, 0.22);
  const bob = Math.sin(T * 2.4) * 2;
  const hx = x - 52 + duck * 10, hy = y - 312 + duck * 14 + bob;
  g.save();
  g.globalAlpha *= a;
  const body = [[hx + 14, hy + 10], [x - 20, y - 320 + bob * 0.5], [x + 10, y - 345], [x + 40, y - 312], [x + 66, y - 300], [x + 88, y - 312]];
  crayonLine(g, body, { color: col, lw: 6, seed: 161, tooth });
  const spikes = [];
  for (let i = 0; i < 6; i++) { const t0 = 0.15 + i * 0.13; const px = lerp(x - 22, x + 76, t0), py = lerp(y - 328, y - 312, t0) - Math.sin(t0 * Math.PI) * 18; spikes.push([px - 5, py], [px, py - 9], [px + 5, py]); }
  crayonLine(g, spikes, { color: col, lw: 3.5, seed: 162, tooth });
  crayonLine(g, [[x + 88, y - 312], [x + 100, y - 322], [x + 108, y - 312], [x + 98, y - 304], [x + 88, y - 312]], { color: col, lw: 4, seed: 163, tooth });
  const head = [];
  for (let i = 0; i <= 18; i++) { const t = (i / 18) * TAU; head.push([hx + Math.cos(t) * 17, hy + Math.sin(t) * 11]); }
  crayonLine(g, head, { color: col, lw: 5, seed: 164, tooth });
  crayonLine(g, [[hx - 2, hy - 9], [hx - 8, hy - 24], [hx + 2, hy - 15]], { color: col, lw: 3.5, seed: 165, tooth });
  crayonLine(g, [[hx + 8, hy - 10], [hx + 8, hy - 26], [hx + 14, hy - 12]], { color: col, lw: 3.5, seed: 166, tooth });
  g.fillStyle = PAL.dragonEye; g.beginPath(); g.ellipse(hx - 4, hy - 2, 4, 3.4, 0, 0, TAU); g.fill();
  g.fillStyle = PAL.ink; g.beginPath(); g.ellipse(hx - 4.5, hy - 2, 1.2, 2.8, 0, 0, TAU); g.fill();
  // 鼻孔一缕烟
  const ph = (T * 0.8) % 1;
  crayonLine(g, [[hx - 18, hy + 2], [hx - 24 - ph * 8, hy - 6 - ph * 14], [hx - 20 - ph * 10, hy - 14 - ph * 18]], { color: PAL.inkSoft, lw: 3, seed: 167, alpha: 0.6 * (1 - ph), tooth });
  g.restore();
}

function crayonCage(g, p, T) {
  const { x, y } = CRAYON.cage;
  standUp(g, x, y, p, 80, () => {
    // 笼里的背景（浅纸）
    const inner = new Path2D();
    inner.moveTo(x - 32, y - 4); inner.lineTo(x - 32, y - 70); inner.quadraticCurveTo(x, y - 106, x + 32, y - 70); inner.lineTo(x + 32, y - 4); inner.closePath();
    cut(g, inner, mixHex(PAL.paper, PAL.princessLight, 0.35), { shadow: 3 });
    // 简笔小公主
    const tooth = mixHex(PAL.paper, PAL.princessLight, 0.35);
    const sway = Math.sin(T * 3.1) * 1.2;
    const dress = pathOf([[x + sway * 0.3, y - 46], [x - 15, y - 8], [x + 15, y - 8]]);
    crayonHatch(g, dress, [x - 16, y - 48, x + 16, y - 6], { color: PAL.princess, lw: 5, gap: 4.5, ang: 0.4, seed: 171, alpha: 0.9, tooth });
    crayonLine(g, [[x + sway * 0.3, y - 46], [x - 15, y - 8], [x + 15, y - 8], [x + sway * 0.3, y - 46]], { color: PAL.princessDark, lw: 3, seed: 172, tooth });
    crayonLine(g, [[x - 6, y - 38], [x - 16, y - 52 + sway]], { color: PAL.skinShade, lw: 3, seed: 173, tooth });
    crayonLine(g, [[x + 6, y - 38], [x + 16, y - 52 - sway]], { color: PAL.skinShade, lw: 3, seed: 174, tooth });
    g.fillStyle = PAL.skin; g.beginPath(); g.arc(x + sway * 0.3, y - 55, 9, 0, TAU); g.fill();
    g.fillStyle = PAL.ink;
    g.beginPath(); g.ellipse(x - 3 + sway * 0.3, y - 56, 1.3, 1.8, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(x + 3.5 + sway * 0.3, y - 56, 1.3, 1.8, 0, 0, TAU); g.fill();
    crayonLine(g, [[x - 8 + sway * 0.3, y - 61], [x - 2, y - 66], [x + 8 + sway * 0.3, y - 62]], { color: PAL.hairGold, lw: 4, seed: 175, tooth });
    crayonLine(g, [[x + 8, y - 58], [x + 12, y - 48], [x + 9, y - 40], [x + 13, y - 32], [x + 10, y - 24]], { color: PAL.hairGold, lw: 4, seed: 176, tooth });
    crayonLine(g, [[x - 6, y - 64], [x - 4, y - 72], [x - 1, y - 66], [x + 2, y - 73], [x + 5, y - 66], [x + 7, y - 72], [x + 8, y - 64]], { color: PAL.gold, lw: 3, seed: 177, tooth });
    // 金笼栏（剪纸）
    const bars = new Path2D();
    for (let i = 0; i <= 6; i++) { const bx = x - 32 + i * (64 / 6); bars.rect(bx - 1.8, y - 72 + Math.abs(i - 3) * 2.2, 3.6, 70 - Math.abs(i - 3) * 2.2); }
    cut(g, bars, PAL.gold, { rim: PAL.goldLight, rimW: 1 });
    const dome = new Path2D();
    dome.moveTo(x - 34, y - 70); dome.quadraticCurveTo(x, y - 110, x + 34, y - 70); dome.lineTo(x + 30, y - 66); dome.quadraticCurveTo(x, y - 100, x - 30, y - 66); dome.closePath();
    cut(g, dome, PAL.gold, { rim: PAL.goldLight, rimW: 1.2 });
    cut(g, rrPath(x - 38, y - 8, 76, 10, 3), PAL.goldDark, { rim: PAL.gold, rimW: 1.2 });
    const ring = new Path2D(); ring.arc(x, y - 96, 7, 0, TAU); ring.arc(x, y - 96, 3.5, 0, TAU, true);
    cut(g, ring, PAL.gold);
  });
}

function crayonHeart(g, drawP, fillP, beat, T) {
  const { x, y, h } = CRAYON.heart;
  if (drawP <= 0 && fillP <= 0) return;
  g.save();
  g.translate(x, y); g.scale(beat, beat); g.translate(-x, -y);
  const pts = heartPoints(x, y, h, 120);
  if (fillP > 0) crayonHatch(g, pathOf(pts), [x - h * 0.6, y - h * 0.5, x + h * 0.6, y + h * 0.5], { color: PAL.heart, lw: 13, gap: 10, ang: -0.75, p: fillP, seed: 181, alpha: 0.8, tooth: PAL.kraft });
  if (drawP > 0) crayonLine(g, polyHead(pts, drawP), { color: PAL.heart, lw: 10, seed: 182, tooth: PAL.kraft });
  g.restore();
}
function crayonHeartBack(g, fillP, beat) {
  // 心的填色画在笼子后面，让笼中小公主仍然看得见
  const { x, y, h } = CRAYON.heart;
  if (fillP <= 0) return;
  g.save();
  g.translate(x, y); g.scale(beat, beat); g.translate(-x, -y);
  crayonHatch(g, heartPath(x, y, h), [x - h * 0.6, y - h * 0.5, x + h * 0.6, y + h * 0.5], { color: PAL.heart, lw: 13, gap: 10, ang: -0.75, p: fillP, seed: 181, alpha: 0.82, tooth: PAL.kraft });
  g.restore();
}

/**
 * 蜡笔地图（告示背面的牛皮纸，立誓 b03 25.35–34.10）。在世界坐标里画（蜡笔版 x = u·1920），镜头自己 applyCam，或传 o.cam。
 * o: {
 *   cam,                      可选：内部 applyCam(g, cam, 1)
 *   icons: { sword, mountain, flag, forest（数字 = 7 棵错峰 50ms 的总进度，或长度 7 的数组）, cage（龙山 + 涂鸦龙 + 鸟笼）, heart（心的描边进度） } 各 0..1,
 *   route 0..1（红虚线画到哪，按弧长；地标处的 r 见 MAP_ROUTE_R）, heartFill 0..1, heartBeatAt（心跳一下 1→1.12→1 的时刻，涂鸦龙同时缩脖子）,
 *   owlBlink（猫头鹰眼睁开的时刻）, sheet（默认 true：画整张牛皮纸）, doodles（默认 true：王城、小丘、小屋底稿）
 * }
 */
export function drawCrayonMap(g, T, o = {}) {
  const ic = o.icons || {};
  g.save();
  if (o.cam) applyCam(g, o.cam, 1);
  if (o.sheet !== false) drawCrayonSheet(g, T);
  if (o.doodles !== false) drawCrayonDoodles(g, T);
  crayonSword(g, ic.sword ?? 0, T);
  crayonMountain(g, ic.mountain ?? 0, ic.flag ?? 0, T);
  // 路线：红蜡笔虚线 lw 9 dash [18,14]
  const route = clamp(o.route ?? 0);
  if (route > 0) {
    const pts = mapRoutePoints('crayon', 0, route);
    dashSplit(pts, 18, 14).forEach((d, i) => crayonLine(g, d, { color: PAL.scarf, lw: 9, seed: 200 + i, tooth: PAL.kraft, teeth: 0.45 }));
  }
  // 7 棵松（挡住路线）
  const fo = ic.forest ?? 0;
  const trees = CRAYON.forest;
  const order = [0, 1, 2, 3, 4, 5, 6];
  for (const i of order) {
    const pv = Array.isArray(fo) ? fo[i] ?? 0 : clamp((fo * (0.3 + 6 * 0.05) - i * 0.05) / 0.3);
    if (i === 4) crayonOwl(g, T, o.owlBlink);
    crayonPine(g, trees[i][0], trees[i][1], trees[i][2], 140 + i * 5, pv);
  }
  // 龙山 + 笼 + 心
  const beatAt = o.heartBeatAt;
  const bt = beatAt == null ? -1 : T - beatAt;
  const beat = bt >= 0 && bt < 0.32 ? 1 + 0.12 * Math.sin((bt / 0.32) * Math.PI) : 1;
  const duck = bt >= 0 ? clamp(bt / 0.12) * (1 - clamp((bt - 0.9) / 0.4)) : 0;
  const cg = ic.cage ?? 0;
  crayonDragonMt(g, cg, T, duck);
  crayonHeartBack(g, o.heartFill ?? 0, beat);
  crayonCage(g, clamp((cg - 0.3) / 0.7), T);
  crayonHeart(g, ic.heart ?? 0, 0, beat, T);
  g.restore();
}

// ———————————————————— 羊皮纸地图（间奏一 b06） ————————————————————
/** 羊皮纸地图布局（屏幕坐标，cam(960,540,1) 时）。 */
export const PARCHMENT = Object.freeze({
  rect: Object.freeze({ x: 160, y: 90, w: 1600, h: 900 }),
  folds: Object.freeze([560, 960, 1360]),
  compass: Object.freeze({ x: 1600, y: 860, r: 70 }),
  ring: Object.freeze({ r: 92, size: 48 }),
  landmarks: Object.freeze(MAP_ORDER.map((k) => Object.freeze(mapToScreen('parchment', ...MAP_UV[k])))),
  pin: Object.freeze([1586, 432]),
});

const PM = (() => {
  const { x, y, w, h } = PARCHMENT.rect;
  const sheet = poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { seed: 301, amp: 2.4, step: 40 });
  // 河：从雪山口脚下流到下边缘
  const riverPts = [[1150, 452], [1090, 512], [1010, 560], [946, 612], [880, 664], [800, 716], [742, 800], [690, 900], [640, 994]];
  const river = ribbon(riverPts, (k) => 4 + k * 9);
  // 墨线小山（雪山口、龙山周围）与小树
  const ink = new Path2D();
  const peaks = [[968, 336, 26], [1016, 300, 34], [1182, 318, 30], [1236, 352, 24], [1046, 430, 20], [1500, 352, 22], [1660, 372, 26], [1700, 470, 18], [1468, 470, 16]];
  for (const [px, py, s] of peaks) {
    ink.moveTo(px - s, py + s * 0.8); ink.lineTo(px - s * 0.2, py - s * 0.6); ink.lineTo(px, py - s * 0.5); ink.lineTo(px + s, py + s * 0.8);
    for (let k = 0; k < 3; k++) { ink.moveTo(px + s * (0.15 + k * 0.25), py - s * 0.2 + k * s * 0.3); ink.lineTo(px + s * (0.32 + k * 0.25), py + s * 0.25 + k * s * 0.3); }
  }
  const hills = [[470, 760, 40], [540, 790, 52], [660, 770, 44], [420, 690, 30], [720, 700, 30], [960, 760, 40], [1060, 700, 34], [300, 820, 34]];
  for (const [hx, hy, s] of hills) { ink.moveTo(hx - s, hy); ink.quadraticCurveTo(hx, hy - s * 0.9, hx + s, hy); }
  const trees = [];
  for (let i = 0; i < 26; i++) trees.push([450 + hash2(311, i) * 330, 700 + hash2(312, i) * 120, 5 + hash2(313, i) * 3]);
  const pines = [];
  for (let i = 0; i < 30; i++) pines.push([1240 + hash2(314, i) * 190, 520 + hash2(315, i) * 130, 7 + hash2(316, i) * 4]);
  const fields = [];
  for (let i = 0; i < 12; i++) fields.push([760 + (i % 4) * 46 + hash2(317, i) * 10, 590 + Math.floor(i / 4) * 34 + hash2(318, i) * 6, i]);
  const waves = [];
  for (let i = 0; i < 9; i++) waves.push([196 + (i % 3) * 62 + Math.floor(i / 3) * 24, 880 + Math.floor(i / 3) * 34]);
  return { sheet, river, riverPts, ink, trees, pines, fields, waves };
})();

/** 地图封皮（卡背）：kraft + 罗盘纹 + 双线框。b06 卡背放大成第一片折页时用同一个函数保证一致。rect = {x,y,w,h}。 */
export function drawMapCover(g, rect, o = {}) {
  const { x, y, w, h } = rect;
  const { alpha = 1, seed = 331, inner = false } = o;
  g.save();
  g.globalAlpha *= alpha;
  const p = poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { seed, amp: 1.6, step: 40 });
  const base = inner ? mixHex(PAL.kraft, PAL.kraftDark, 0.25) : PAL.kraft;
  cut(g, p, base);
  shade(g, p, PAL.kraftDark, x, y, x + w, y + h, 0.05, 0.35);
  g.save(); g.clip(p);
  const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) * 0.34;
  g.strokeStyle = rgba(PAL.kraftDark, 0.75); g.lineWidth = 2.4;
  g.strokeRect(x + 16, y + 16, w - 32, h - 32);
  g.lineWidth = 1.2; g.strokeRect(x + 24, y + 24, w - 48, h - 48);
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
  g.beginPath(); g.arc(cx, cy, R * 0.82, 0, TAU); g.stroke();
  for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU, r0 = i % 4 ? R * 0.9 : R * 0.84; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2, L = i % 2 ? R * 0.5 : R * 0.95, ww = i % 2 ? R * 0.09 : R * 0.13;
    const tipx = cx + Math.cos(a) * L, tipy = cy + Math.sin(a) * L;
    const lx = cx + Math.cos(a - Math.PI / 2) * ww, ly = cy + Math.sin(a - Math.PI / 2) * ww;
    const rx = cx + Math.cos(a + Math.PI / 2) * ww, ry = cy + Math.sin(a + Math.PI / 2) * ww;
    g.fillStyle = rgba(PAL.kraftDark, i % 2 ? 0.45 : 0.6);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(lx, ly); g.lineTo(tipx, tipy); g.closePath(); g.fill();
    g.fillStyle = rgba(PAL.kraftDark, i % 2 ? 0.25 : 0.32);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(rx, ry); g.lineTo(tipx, tipy); g.closePath(); g.fill();
  }
  g.fillStyle = rgba(PAL.redDark, 0.55); g.beginPath(); g.arc(cx, cy, R * 0.07, 0, TAU); g.fill();
  g.restore();
  g.restore();
}

function drawParchmentBase(g, T) {
  const { x, y, w, h } = PARCHMENT.rect;
  cut(g, PM.sheet, PAL.paper2);
  g.save();
  g.clip(PM.sheet);
  g.fillStyle = rad(g, x + w / 2, y + h / 2, h * 0.3, w * 0.62, [[0, rgba(PAL.paper, 0.55)], [0.7, rgba(PAL.paper2, 0)], [1, rgba(PAL.kraft, 0.75)]]);
  g.fillRect(x, y, w, h);
  for (let i = 0; i < 14; i++) {
    const mx = x + hash2(321, i) * w, my = y + hash2(322, i) * h, r = 60 + hash2(323, i) * 160;
    g.fillStyle = rad(g, mx, my, 0, r, [[0, rgba(i % 3 ? PAL.kraft : PAL.paper, 0.2)], [1, rgba(PAL.kraft, 0)]]);
    g.fillRect(mx - r, my - r, 2 * r, 2 * r);
  }
  // 区域水彩
  const washes = [
    [580, 730, 260, 120, PAL.meadow, 0.22], [430, 780, 180, 90, PAL.leafLight, 0.2], [850, 570, 180, 105, PAL.gold, 0.2],
    [1095, 385, 190, 135, PAL.ice, 0.4], [1100, 360, 120, 80, PAL.snow, 0.5], [1330, 575, 175, 115, PAL.forest, 0.2],
    [1580, 445, 170, 125, PAL.dragon, 0.2], [1600, 430, 100, 70, PAL.dragonDark, 0.16], [340, 615, 120, 90, PAL.roofRed, 0.08],
  ];
  washes.forEach(([wx, wy, rx, ry, c, a], i) => { g.fillStyle = rgba(c, a); g.fill(blob(wx, wy, rx, ry, { seed: 330 + i, amp: 0.08, freq: 4 })); });
  // 海（左下角）
  g.fillStyle = rgba(PAL.water, 0.3);
  g.fill(blob(200, 960, 300, 150, { seed: 341, amp: 0.06 }));
  g.strokeStyle = rgba(PAL.waterDeep, 0.55); g.lineWidth = 2.2; g.lineCap = 'round';
  for (const [wx, wy] of PM.waves) { g.beginPath(); g.moveTo(wx - 18, wy); g.quadraticCurveTo(wx - 9, wy - 8, wx, wy); g.quadraticCurveTo(wx + 9, wy - 8, wx + 18, wy); g.stroke(); }
  // 罗盘方位线（portolan 式，从罗盘与左上一个小副罗盘放射，墨 / 绿 / 红交替）
  g.lineWidth = 1.3;
  for (const [hx, hy, n0] of [[PARCHMENT.compass.x, PARCHMENT.compass.y, 0], [520, 250, 1]]) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + n0 * 0.1;
      g.strokeStyle = rgba([PAL.inkSoft, PAL.grassDark, PAL.redDark][(i + n0) % 3], 0.13);
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.cos(a) * 2200, hy + Math.sin(a) * 2200); g.stroke();
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2, L = i % 2 ? 14 : 26;
    g.fillStyle = i % 2 ? rgba(PAL.gold, 0.55) : rgba(PAL.goldDark, 0.6);
    g.fill(pathOf([[520, 250], [520 + Math.cos(a - 0.35) * 6, 250 + Math.sin(a - 0.35) * 6], [520 + Math.cos(a) * L, 250 + Math.sin(a) * L], [520 + Math.cos(a + 0.35) * 6, 250 + Math.sin(a + 0.35) * 6]]));
  }
  // 海上一只纸船、天上几只墨线鸟
  const bob = Math.sin(T * 2.2) * 3;
  g.save(); g.translate(318, 930 + bob); g.rotate(Math.sin(T * 2.2 + 1) * 0.05);
  g.fillStyle = PAL.wood; g.fill(pathOf([[-30, 0], [30, 0], [20, 12], [-22, 12]]));
  g.fillStyle = PAL.paper; g.fill(pathOf([[-2, -2], [-2, -44], [24, -4]]));
  g.fillStyle = rgba(PAL.kraftDark, 0.5); g.fill(pathOf([[-4, -2], [-4, -36], [-22, -4]]));
  g.fillStyle = PAL.scarf; g.fill(pathOf([[-2, -44], [10, -40], [-2, -36]]));
  g.restore();
  g.strokeStyle = rgba(PAL.inkSoft, 0.6); g.lineWidth = 2; g.lineCap = 'round';
  for (const [bx, by, bs] of [[760, 190, 1], [800, 214, 0.8], [836, 180, 0.9], [1220, 170, 0.8], [1250, 196, 0.7]]) {
    const w = Math.sin(T * 4 + bx) * 2;
    g.beginPath(); g.moveTo(bx - 10 * bs, by - 4 * bs + w); g.quadraticCurveTo(bx - 4 * bs, by - 8 * bs + w, bx, by); g.quadraticCurveTo(bx + 4 * bs, by - 8 * bs + w, bx + 10 * bs, by - 4 * bs + w); g.stroke();
  }
  // 田块
  for (const [fx, fy, i] of PM.fields) { g.fillStyle = rgba([PAL.gold, PAL.leafLight, PAL.meadow][i % 3], 0.32); g.save(); g.translate(fx, fy); g.rotate(-0.12); g.fillRect(-20, -13, 40, 26); g.restore(); }
  // 河
  g.fillStyle = rgba(PAL.water, 0.75); g.fill(PM.river);
  g.strokeStyle = rgba(PAL.waterDeep, 0.5); g.lineWidth = 1.6; g.stroke(PM.river);
  // 墨线
  g.strokeStyle = rgba(PAL.inkSoft, 0.62); g.lineWidth = 2.2; g.lineJoin = 'round';
  g.stroke(PM.ink);
  for (const [tx, ty, s] of PM.trees) { g.fillStyle = rgba(PAL.grassDark, 0.45); g.beginPath(); g.arc(tx, ty - s, s, 0, TAU); g.fill(); g.strokeStyle = rgba(PAL.inkSoft, 0.5); g.lineWidth = 1.4; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx, ty - s * 0.4); g.stroke(); }
  for (const [tx, ty, s] of PM.pines) { g.fillStyle = rgba(PAL.forestDeep, 0.42); g.beginPath(); g.moveTo(tx - s * 0.6, ty); g.lineTo(tx, ty - s * 1.8); g.lineTo(tx + s * 0.6, ty); g.closePath(); g.fill(); }
  // 边框：金线 + 深红线 + 细墨线；四角金色卷草
  g.lineWidth = 4; g.strokeStyle = rgba(PAL.gold, 0.95); g.strokeRect(x + 20, y + 20, w - 40, h - 40);
  g.lineWidth = 2; g.strokeStyle = rgba(PAL.redDark, 0.8); g.strokeRect(x + 30, y + 30, w - 60, h - 60);
  g.lineWidth = 1; g.strokeStyle = rgba(PAL.inkSoft, 0.5); g.strokeRect(x + 36, y + 36, w - 72, h - 72);
  for (const [cx, cy, sx, sy] of [[x + 20, y + 20, 1, 1], [x + w - 20, y + 20, -1, 1], [x + 20, y + h - 20, 1, -1], [x + w - 20, y + h - 20, -1, -1]]) {
    g.save(); g.translate(cx, cy); g.scale(sx, sy);
    const curl = new Path2D();
    curl.moveTo(0, 0); curl.bezierCurveTo(46, 4, 66, 24, 52, 40); curl.bezierCurveTo(42, 50, 28, 40, 36, 30); curl.bezierCurveTo(42, 22, 50, 30, 46, 34);
    curl.moveTo(0, 0); curl.bezierCurveTo(4, 46, 24, 66, 40, 52); curl.bezierCurveTo(50, 42, 40, 28, 30, 36);
    g.strokeStyle = PAL.gold; g.lineWidth = 4.5; g.lineCap = 'round'; g.stroke(curl);
    g.strokeStyle = PAL.goldDark; g.lineWidth = 1.5; g.stroke(curl);
    cut(g, blob(14, 14, 9, 9, { seed: 351 }), PAL.red, { rim: PAL.goldLight, rimW: 1.4 });
    g.restore();
  }
  g.restore();
}

/** 罗盘（羊皮纸右下）。needle 为指针转角（弧度，0 朝上）。 */
function drawCompass(g, cx, cy, R, needle, T) {
  g.save();
  g.fillStyle = rgba(PAL.paper, 0.6); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.strokeStyle = rgba(PAL.inkSoft, 0.8); g.lineWidth = 2.4; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
  g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, R * 0.86, 0, TAU); g.stroke();
  for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU; const r0 = i % 4 ? R * 0.9 : R * 0.8; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98); g.stroke(); }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2, L = i % 2 ? R * 0.55 : R * 0.84, ww = i % 2 ? R * 0.1 : R * 0.15;
    const tip = [cx + Math.cos(a) * L, cy + Math.sin(a) * L];
    const l = [cx + Math.cos(a - Math.PI / 2) * ww, cy + Math.sin(a - Math.PI / 2) * ww];
    const r = [cx + Math.cos(a + Math.PI / 2) * ww, cy + Math.sin(a + Math.PI / 2) * ww];
    g.fillStyle = i % 2 ? PAL.goldLight : PAL.gold; g.fill(pathOf([[cx, cy], l, tip]));
    g.fillStyle = i % 2 ? PAL.gold : PAL.goldDark; g.fill(pathOf([[cx, cy], r, tip]));
  }
  // 指针
  g.translate(cx, cy); g.rotate(needle);
  const nN = pathOf([[0, -R * 0.78], [R * 0.09, 0], [-R * 0.09, 0]]);
  const nS = pathOf([[0, R * 0.62], [R * 0.09, 0], [-R * 0.09, 0]]);
  cut(g, nN, PAL.red, { shadow: 2 }); cut(g, nS, PAL.inkSoft);
  cut(g, blob(0, 0, R * 0.09, R * 0.09, { seed: 361 }), PAL.goldLight, { rim: PAL.white, rimW: 1 });
  g.restore();
}

// —— 羊皮纸地标（立起的小纸片），局部坐标：底边中心 (0,0) ——
function lmCastle(g, T) {
  cut(g, blob(0, 4, 72, 20, { seed: 401, amp: 0.03 }), PAL.meadow, { rim: PAL.leafLight, rimW: 2 });
  for (let i = 0; i < 13; i++) {
    if (i === 6) continue;
    const tx = -54 + i * 9, th = [14, 19, 24, 19][i % 4];
    const body = pathOf([[tx - 3.2, -12], [tx - 3.2, -34 - th], [tx + 3.2, -34 - th], [tx + 3.2, -12]]);
    cut(g, body, i % 2 ? PAL.stone : mixHex(PAL.stone, PAL.paper, 0.3));
    const roof = pathOf([[tx - 4.6, -33.5 - th], [tx, -43 - th], [tx + 4.6, -33.5 - th]]);
    cut(g, roof, i % 2 ? PAL.roof : PAL.roofRed);
    g.strokeStyle = rgba(PAL.woodDark, 0.8); g.lineWidth = 0.8; g.beginPath(); g.moveTo(tx, -43 - th); g.lineTo(tx, -49 - th); g.stroke();
    g.fillStyle = PAL.scarf; g.beginPath(); g.moveTo(tx + 0.3, -49 - th); g.lineTo(tx + 4.5, -47.5 - th + Math.sin(T * 6 + i) * 0.8); g.lineTo(tx + 0.3, -46 - th); g.fill();
  }
  // 主堡
  const keep = pathOf([[-9, -12], [-9, -60], [9, -60], [9, -12]]);
  cut(g, keep, mixHex(PAL.stone, PAL.paper, 0.35), { rim: PAL.white, rimW: 1.4 });
  shade(g, keep, PAL.stone2, -9, 0, 9, 0, 0, 0.6);
  cut(g, pathOf([[-11.5, -59], [0, -82], [11.5, -59]]), PAL.roof, { rim: mixHex(PAL.roof, PAL.white, 0.35), rimW: 1.2 });
  g.strokeStyle = PAL.woodDark; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -82); g.lineTo(0, -90); g.stroke();
  g.fillStyle = PAL.scarf; g.beginPath(); g.moveTo(0.4, -90); g.lineTo(7, -88 + Math.sin(T * 5) * 1); g.lineTo(0.4, -86); g.fill();
  g.fillStyle = PAL.gold; g.beginPath(); g.arc(0, -46, 3.6, 0, TAU); g.fill();
  g.fillStyle = PAL.heart; g.beginPath(); g.arc(0, -46, 1.6, 0, TAU); g.fill();
  // 城墙 + 垛口 + 城门
  const wall = new Path2D();
  wall.moveTo(-58, -6); wall.lineTo(-58, -30);
  for (let k = 0; k < 15; k++) { const wx = -58 + k * 7.8; wall.lineTo(wx, -34); wall.lineTo(wx + 4, -34); wall.lineTo(wx + 4, -30); wall.lineTo(wx + 7.8, -30); }
  wall.lineTo(58, -6); wall.closePath();
  cut(g, wall, PAL.stone, { rim: PAL.white, rimW: 1.4 });
  shade(g, wall, PAL.stone2, 0, -34, 0, -6, 0, 0.6);
  const gate = new Path2D(); gate.moveTo(-7, -6); gate.lineTo(-7, -16); gate.arc(0, -16, 7, Math.PI, 0); gate.lineTo(7, -6); gate.closePath();
  cut(g, gate, PAL.woodDark);
}
function lmMeadow(g, T, b) {
  for (const [gx, s] of [[-40, 1], [-6, 1.2], [36, 0.9]]) {
    const tuft = poly([[gx - 10 * s, 0], [gx - 7 * s, -12 * s], [gx - 3 * s, -2 * s], [gx, -16 * s], [gx + 3 * s, -2 * s], [gx + 8 * s, -11 * s], [gx + 10 * s, 0]], { seed: 410 + gx, amp: 0.3, step: 6 });
    cut(g, tuft, PAL.grass, { rim: PAL.leafLight, rimW: 1.2 });
  }
  [[-24, 11], [2, 13], [26, 10]].forEach(([sx, r], i) => {
    const tb = b == null ? -1 : T - b - i * 0.09;
    const hop = tb >= 0 && tb < 0.42 ? Math.sin((tb / 0.42) * Math.PI) : 0;
    const land = tb >= 0.42 ? wobble(tb, 0.42, 5, 0.12) * 0.25 : 0;
    const bob = Math.sin(T * 3 + i * 2) * 0.04;
    g.save();
    g.translate(sx, -hop * 24);
    g.scale(1 - hop * 0.12 + land, 1 + hop * 0.18 - land + bob);
    const body = new Path2D();
    body.moveTo(-r, 0); body.bezierCurveTo(-r, -r * 1.25, r, -r * 1.25, r, 0); body.closePath();
    cut(g, body, PAL.slime, { rim: PAL.leafLight, rimW: 1.3 });
    shade(g, body, PAL.slimeDark, 0, -r, 0, 0, 0, 0.6);
    g.fillStyle = PAL.ink;
    g.beginPath(); g.ellipse(-r * 0.32, -r * 0.55, r * 0.11, r * 0.17, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(r * 0.28, -r * 0.55, r * 0.11, r * 0.17, 0, 0, TAU); g.fill();
    g.fillStyle = rgba(PAL.white, 0.7); g.beginPath(); g.ellipse(-r * 0.5, -r * 0.8, r * 0.18, r * 0.1, -0.5, 0, TAU); g.fill();
    g.restore();
  });
}
function lmVillage(g, T, b) {
  const tb = b == null ? -1 : T - b;
  // 风车
  const tower = pathOf([[-30, 0], [-26, -46], [-12, -46], [-8, 0]]);
  cut(g, tower, PAL.paper, { rim: PAL.white, rimW: 1.2 });
  shade(g, tower, PAL.stone2, -30, 0, -8, 0, 0, 0.5);
  cut(g, pathOf([[-31, -45], [-19, -60], [-7, -45]]), PAL.roofRed);
  g.fillStyle = PAL.woodDark; g.fillRect(-21.5, -14, 5, 14);
  const spin = tb > 0 ? 9 * tb * tb / (2 * 0.5) * (tb < 0.5 ? 1 : 0) + (tb >= 0.5 ? 9 * (tb - 0.25) : 0) : 0;
  const ang = 0.3 + T * 0.4 + spin;
  g.save(); g.translate(-19, -50);
  for (let k = 0; k < 4; k++) {
    g.save(); g.rotate(ang + (k * Math.PI) / 2);
    g.fillStyle = PAL.wood; g.fillRect(-1.2, -28, 2.4, 28);
    cut(g, pathOf([[1.2, -27], [9, -27], [9, -9], [1.2, -9]]), PAL.paper);
    g.restore();
  }
  cut(g, blob(0, 0, 3, 3, { seed: 421 }), PAL.goldDark);
  g.restore();
  // 小屋
  for (const [hx, w, hh, col] of [[14, 22, 15, PAL.roofRed], [40, 18, 12, PAL.roof]]) {
    cut(g, pathOf([[hx - w / 2, 0], [hx - w / 2, -hh], [hx + w / 2, -hh], [hx + w / 2, 0]]), PAL.paper2, { rim: PAL.white, rimW: 1 });
    cut(g, pathOf([[hx - w / 2 - 3, -hh + 1], [hx, -hh - 12], [hx + w / 2 + 3, -hh + 1]]), col);
    g.fillStyle = PAL.woodDark; g.beginPath(); g.arc(hx, -3, 3.4, Math.PI, 0); g.lineTo(hx + 3.4, 0); g.lineTo(hx - 3.4, 0); g.fill();
  }
  // 宝箱（被经过时闪一下）
  const chest = pathOf([[-4, 0], [-4, -8], [6, -8], [6, 0]]);
  g.save(); g.translate(28, 2);
  cut(g, chest, PAL.wood); g.fillStyle = PAL.gold; g.fillRect(-4, -5, 10, 1.6); g.fillRect(0, -8, 2, 8);
  g.restore();
  if (tb >= 0 && tb < 0.8) sparkle(g, 30, -8, 14 * Math.sin((tb / 0.8) * Math.PI), { rot: tb * 3, color: PAL.goldLight });
}
function lmPass(g, T, b) {
  const tb = b == null ? -1 : T - b;
  const body = poly([[-62, 0], [-34, -50], [-20, -42], [0, -96], [24, -52], [40, -64], [66, 0]], { seed: 431, amp: 0.8, step: 10, round: 0.1 });
  cut(g, body, PAL.mountain, { rim: mixHex(PAL.mountain, PAL.white, 0.4), rimW: 2 });
  g.save(); g.clip(body); g.fillStyle = rgba(PAL.mountainDark, 0.5); g.fill(pathOf([[0, -96], [24, -52], [40, -64], [66, 0], [8, 0]])); g.restore();
  cut(g, poly([[-20, -50], [0, -96], [18, -58], [10, -62], [4, -54], [-4, -64], [-12, -52]], { seed: 432, amp: 0.4, step: 6, round: 0.2 }), PAL.snow, { rim: PAL.white });
  cut(g, poly([[32, -56], [40, -64], [50, -46], [42, -50]], { seed: 433, amp: 0.3, step: 5 }), PAL.snow);
  const flutter = tb >= 0 ? 1 + 2 * Math.exp(-tb * 1.5) : 1;
  g.strokeStyle = PAL.woodDark; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -95); g.lineTo(0, -116); g.stroke();
  const wv = (i) => Math.sin(T * 7 * flutter - i) * 1.6 * flutter;
  cut(g, pathOf([[0.6, -116], [9, -113 + wv(1)], [17, -110 + wv(2)], [9, -107 + wv(1)], [0.6, -104]]), PAL.scarf);
  if (tb >= 0 && tb < 1.2) {
    const a = tb / 1.2;
    for (let k = 0; k < 7; k++) {
      const ang = -Math.PI / 2 + (k - 3) * 0.42, r = 14 + a * 46;
      g.fillStyle = rgba(PAL.snow, 0.85 * (1 - a));
      g.fill(blob(Math.cos(ang) * r, -88 + Math.sin(ang) * r * 0.8, 6 * (1 - a * 0.5), 5 * (1 - a * 0.5), { seed: 434 + k }));
    }
  }
}
function lmForest(g, T, b) {
  const tb = b == null ? -1 : T - b;
  const lit = tb >= 0 ? clamp(tb / 0.3) : 0;
  // 弯月
  const mx = 30, my = -74;
  if (lit > 0) glow(g, mx, my, 46, PAL.moonGlow, 0.7 * lit);
  const moon = new Path2D(); moon.arc(mx, my, 13, 0, TAU); moon.arc(mx + 6, my - 4, 11, 0, TAU, true);
  cut(g, moon, mixHex(PAL.moon, PAL.kraft, 0.4 * (1 - lit)), { rim: PAL.white, rimW: 1 });
  for (const [px, ph, sd] of [[-40, 44, 1], [-18, 56, 2], [6, 50, 3], [28, 40, 4], [-30, 32, 5]]) {
    const w = ph * 0.55;
    for (let i = 0; i < 3; i++) {
      const tb2 = -4 - i * ph * 0.24, tw = w * (1 - i * 0.24);
      const tp = pathOf([[px - tw / 2, tb2], [px, tb2 - ph * 0.42], [px + tw / 2, tb2]]);
      cut(g, tp, i % 2 ? PAL.forestDeep : mixHex(PAL.forestDeep, PAL.forest, 0.4), { rim: rgba(PAL.leafLight, 0.5), rimW: 1 });
    }
    g.fillStyle = PAL.woodDark; g.fillRect(px - 1.5, -5, 3, 5);
  }
}
function lmDragon(g, T, b) {
  const tb = b == null ? -1 : T - b;
  const body = poly([[-66, 0], [-40, -70], [-22, -60], [-6, -104], [14, -112], [28, -84], [48, -74], [68, 0]], { seed: 441, amp: 0.8, step: 10, round: 0.1 });
  const col = mixHex(PAL.mountainDark, PAL.dragonDark, 0.6);
  cut(g, body, col, { rim: mixHex(PAL.dragonWing, PAL.white, 0.2), rimW: 1.8 });
  g.save(); g.clip(body); g.fillStyle = rgba(PAL.dragonDeep, 0.6); g.fill(pathOf([[14, -112], [28, -84], [48, -74], [68, 0], [12, 0]])); g.restore();
  const glowK = tb >= 0 ? Math.exp(-Math.max(0, tb - 0.2) * 1.2) * clamp(tb / 0.2) : 0;
  const cave = new Path2D(); cave.moveTo(-2, 0); cave.lineTo(-2, -12); cave.quadraticCurveTo(12, -30, 26, -12); cave.lineTo(26, 0); cave.closePath();
  cut(g, cave, PAL.ink);
  glow(g, 12, -8, 30 + glowK * 30, PAL.magic, 0.25 + 0.6 * glowK);
  // 烟（循环小团）
  for (let k = 0; k < 3; k++) {
    const ph = (T * 0.5 + k / 3) % 1;
    g.fillStyle = rgba(PAL.inkSoft, 0.45 * (1 - ph));
    g.fill(blob(16 + ph * 14, -118 - ph * 40, 5 + ph * 8, 4 + ph * 6, { seed: 442 + k }));
  }
  // 山顶的涂鸦小龙：被经过时抬头吐烟圈
  const up = tb >= 0 ? clamp(tb / 0.18) * (1 - clamp((tb - 1.4) / 0.4)) : 0;
  g.save();
  g.strokeStyle = PAL.dragon; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-22, -100); g.quadraticCurveTo(-6, -116, 10, -110); g.quadraticCurveTo(22, -106, 32, -112); g.stroke();
  const hx = -26 - up * 2, hy = -104 - up * 12;
  g.beginPath(); g.moveTo(-18, -104); g.lineTo(hx + 3, hy + 3); g.stroke();
  g.fillStyle = PAL.dragon; g.beginPath(); g.ellipse(hx, hy, 7, 4.6, -0.2 - up * 0.3, 0, TAU); g.fill();
  g.fillStyle = PAL.dragonEye; g.beginPath(); g.arc(hx - 1, hy - 1.5, 1.6, 0, TAU); g.fill();
  g.restore();
  if (tb >= 0.15 && tb < 1.4) {
    const a = (tb - 0.15) / 1.25;
    g.strokeStyle = rgba(PAL.inkSoft, 0.8 * (1 - a)); g.lineWidth = 2.6 * (1 - a * 0.5);
    g.beginPath(); g.ellipse(hx - 10 - a * 30, hy - 6 - a * 22, 4 + a * 10, 3 + a * 7, -0.3, 0, TAU); g.stroke();
  }
}
const LM_DRAW = [lmCastle, lmMeadow, lmVillage, lmPass, lmForest, lmDragon];
const LM_BASE = [[0, 38], [0, 18], [0, 27], [0, 33], [0, 33], [0, 40]];
const LM_W = [150, 100, 90, 130, 90, 140];
/** 地标纸片的放大倍数（王城要装进半径 92 的环形字里，保持 1）。 */
const LM_SCALE = [1, 1.35, 1.35, 1.35, 1.35, 1.35];

/** 城名环形字（半径 92、48px，从正上方顺时针，字头朝外）。p 0..1 写到哪。 */
function drawCityRing(g, cx, cy, p, T) {
  const chars = [...NAMES.city];
  const { r: R, size } = PARCHMENT.ring;
  const n = chars.length;
  if (p > 0) {
    g.save();
    g.strokeStyle = rgba(PAL.redDark, 0.55 * clamp(p * 3)); g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R + 30, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p * 1.05)); g.stroke();
    g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, R - 30, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p * 1.05)); g.stroke();
    g.restore();
  }
  for (let i = 0; i < n; i++) {
    const a = clamp(p * n * 1.15 - i * 1.15 + 0.15);
    if (a <= 0) continue;
    const ang = -Math.PI / 2 + (i / n) * TAU;
    const pop = a >= 1 ? 1 : outBack(a, 2.4);
    paperGlyph(g, chars[i], cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, size, { fill: PAL.redDark, edge: PAL.paper, edgeW: 0.1, rot: ang + Math.PI / 2, scale: pop, alpha: Math.min(1, a * 3) });
  }
}

/**
 * 羊皮纸地图（间奏一 b06 66.40–74.45）。屏幕坐标（cam(960,540,1) 时），镜头自己 applyCam 或传 o.cam。
 * o: {
 *   cam, unfold 0..1（四片风琴折：0 = 只有第一片位置上的封皮；1/3、2/3、1 依次在 x=560/960/1360 处翻开）,
 *   landmarks 0..1 或长度 6 的数组（立起进度，顺序 = MAP_ORDER）, bounce: 长度 6 的时刻数组（笔头经过时跳一下 + 各自小动画）,
 *   route 0..1（红虚线 lw 8 dash [20,14] 画到哪）, knight（默认 true：route>0 时在线头画纸片小骑士当笔头）, knightSize,
 *   ring 0..1（城名环形字）, pin 0..1（任务图钉 drop）, compass（罗盘指针转角，弧度）, sweep 0..1（一道金光斜扫）, dustAt（摊平扬灰时刻）
 * }
 */
export function drawParchmentMap(g, T, o = {}) {
  const { unfold = 1, route = 0, ring = 0, pin = 0, compass = 0, sweep = 0 } = o;
  const lms = Array.isArray(o.landmarks) ? o.landmarks : MAP_ORDER.map(() => o.landmarks ?? 0);
  const bounce = o.bounce || [];
  const { x: X, y: Y, w: W, h: H } = PARCHMENT.rect;
  g.save();
  if (o.cam) applyCam(g, o.cam, 1);
  const u = clamp(unfold);
  const PW = W / 4;
  const flips = [1, 2, 3].map((j) => clamp(u * 3 - (j - 1)));
  // 当前在翻的是第几折（0 = 全都还没翻；4 = 全开）
  let j = 1; while (j <= 3 && flips[j - 1] >= 1) j++;
  const fj = j <= 3 ? flips[j - 1] : 1;
  const th = Math.PI * inOutSine(fj);
  const hinge = X + PW * j;
  // 已经露出来的地图正面
  let reveal = X + PW * (j - 1);
  if (j <= 3 && fj > 0) reveal = th < Math.PI / 2 ? hinge - PW * Math.cos(th) : hinge;
  if (j > 3) reveal = X + W;
  if (reveal > X + 1) {
    g.save();
    g.beginPath(); g.rect(X - 30, Y - 30, reveal - X + 30, H + 60); g.clip();
    drawParchmentFront(g, T, { ...o, lms, bounce, route, ring, pin, compass, sweep, open: reveal });
    g.restore();
    // 折痕
    g.save();
    for (const fx of PARCHMENT.folds) if (fx < reveal - 2) {
      g.fillStyle = lin(g, fx - 10, 0, fx + 10, 0, [[0, rgba(PAL.kraftDark, 0)], [0.5, rgba(PAL.kraftDark, 0.22)], [0.56, rgba(PAL.paper, 0.35)], [1, rgba(PAL.paper, 0)]]);
      g.fillRect(fx - 10, Y + 4, 20, H - 8);
    }
    g.restore();
  }
  if (j <= 3) {
    // 还没翻开的整叠（kraft 封皮），在第 j-1 片位置上；翻开中的那张绕 hinge 转
    const left = X + PW * (j - 1);
    const layers = 4 - j;
    if (fj <= 0) {
      drawFoldStack(g, left, Y, PW, H, layers, j === 1 ? 'cover' : 'inner');
    } else {
      // 投在已露出部分上的阴影
      const sx = th < Math.PI / 2 ? hinge - PW * Math.cos(th) : hinge;
      const sw = 90 * Math.sin(th);
      if (sw > 1) {
        g.fillStyle = lin(g, sx - sw, 0, sx, 0, [[0, rgba(PAL.shadow, 0)], [1, rgba(PAL.shadow, 0.28 * Math.sin(th))]]);
        g.fillRect(Math.max(X, sx - sw), Y, Math.min(sw, sx - X), H);
      }
      const persp = 1 + 0.07 * Math.sin(th);
      if (th < Math.PI / 2) {
        const wv = PW * Math.cos(th);
        drawFlipFace(g, hinge - wv, hinge, Y, H, persp, 'left', j === 1 ? 'cover' : 'inner', th);
      } else {
        const wv = -PW * Math.cos(th);
        if (j < 3) drawFlipFace(g, hinge, hinge + wv, Y, H, persp, 'right', 'inner', th);
        else {
          // 最后一折过 90° 后是地图正面
          g.save();
          g.beginPath(); g.rect(hinge, Y - 30, wv, H + 60); g.clip();
          g.translate(hinge, 0); g.scale(wv / PW, 1); g.translate(-hinge, 0);
          drawParchmentFront(g, T, { ...o, lms: lms.map(() => 0), bounce: [], route: 0, ring: 0, pin: 0, sweep: 0, open: X + W, panelOnly: true });
          g.fillStyle = rgba(PAL.shadow, 0.35 * Math.sin(th)); g.fillRect(hinge, Y, PW, H);
          g.restore();
        }
      }
    }
  }
  // 摊平扬灰
  if (o.dustAt != null && T >= o.dustAt && T < o.dustAt + 1.2) {
    const a = T - o.dustAt;
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1, along = hash2(371, i);
      const bx = side > 0 ? X + along * W : X + along * W, by = side > 0 ? Y + H : Y;
      const px = bx + (hash2(372, i) - 0.5) * 60 * a, py = by + side * (20 + hash2(373, i) * 50) * Math.sqrt(a) - 30 * a * a * side;
      g.fillStyle = rgba(i % 3 ? PAL.kraft : PAL.paper, 0.7 * (1 - a / 1.2));
      g.fill(blob(px, py, 3 + hash2(374, i) * 4, 2.5 + hash2(375, i) * 3, { seed: 376 + i }));
    }
  }
  g.restore();
}

function drawFoldStack(g, x, y, w, h, layers, face) {
  // 叠在一起的几层纸：右侧和底边露出纸边
  for (let k = layers; k >= 1; k--) {
    g.fillStyle = mixHex(PAL.kraft, PAL.kraftDark, 0.25 + k * 0.12);
    g.fill(poly([[x + 2 * k, y + 2 * k], [x + w + 3 * k, y + 2 * k], [x + w + 3 * k, y + h + 3 * k], [x + 2 * k, y + h + 3 * k]], { seed: 380 + k, amp: 1.2, step: 40 }));
  }
  drawMapCover(g, { x, y, w, h }, { inner: face === 'inner' });
}
function drawFlipFace(g, x0, x1, y, h, persp, freeSide, face, th) {
  const w = Math.max(0.5, x1 - x0);
  const grow = (persp - 1) * h * 0.5;
  // 自由边离镜头更近：略高（假透视梯形）
  const pts = freeSide === 'left' ? [[x0, y - grow], [x1, y], [x1, y + h], [x0, y + h + grow]] : [[x0, y], [x1, y - grow], [x1, y + h + grow], [x0, y + h]];
  const p = pathOf(pts);
  g.save();
  g.fillStyle = face === 'cover' ? PAL.kraft : mixHex(PAL.kraft, PAL.kraftDark, 0.25);
  g.fill(p);
  g.clip(p);
  if (w > 4) {
    // 封皮图案按可见宽度压扁（scaleX），与静止的整叠、卡背用同一个 drawMapCover
    g.translate(x0, y); g.scale(w / (PARCHMENT.rect.w / 4), 1); g.translate(-x0, -y);
    drawMapCover(g, { x: x0, y, w: PARCHMENT.rect.w / 4, h }, { inner: face === 'inner' });
  }
  g.restore();
  g.save();
  g.clip(p);
  const dark = 0.38 * Math.sin(th);
  g.fillStyle = freeSide === 'left' ? lin(g, x0, 0, x1, 0, [[0, rgba(PAL.shadow, dark * 0.4)], [1, rgba(PAL.shadow, dark)]]) : lin(g, x0, 0, x1, 0, [[0, rgba(PAL.shadow, dark)], [1, rgba(PAL.shadow, dark * 0.3)]]);
  g.fillRect(Math.min(x0, x1) - 2, y - grow - 2, w + 4, h + 2 * grow + 4);
  g.restore();
  g.strokeStyle = rgba(PAL.kraftDark, 0.6); g.lineWidth = 1.5; g.stroke(p);
}

function drawParchmentFront(g, T, o) {
  const { lms, bounce, route, ring, pin, compass, sweep } = o;
  drawParchmentBase(g, T);
  const C = PARCHMENT.compass;
  drawCompass(g, C.x, C.y, C.r, compass, T);
  if (o.panelOnly) return;
  // 红虚线路线（先画墨影再画红线）
  if (route > 0) {
    const pts = mapRoutePoints('parchment', 0, route);
    const dashes = dashSplit(pts, 20, 14);
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = rgba(PAL.redDeep, 0.35); g.lineWidth = 8;
    g.beginPath(); for (const d of dashes) { g.moveTo(d[0][0] + 1.5, d[0][1] + 2.5); for (let i = 1; i < d.length; i++) g.lineTo(d[i][0] + 1.5, d[i][1] + 2.5); } g.stroke();
    g.strokeStyle = PAL.scarf; g.lineWidth = 8;
    g.beginPath(); for (const d of dashes) { g.moveTo(d[0][0], d[0][1]); for (let i = 1; i < d.length; i++) g.lineTo(d[i][0], d[i][1]); } g.stroke();
    g.strokeStyle = rgba(PAL.goldLight, 0.35); g.lineWidth = 2;
    g.beginPath(); for (const d of dashes) { g.moveTo(d[0][0] - 0.8, d[0][1] - 1.6); for (let i = 1; i < d.length; i++) g.lineTo(d[i][0] - 0.8, d[i][1] - 1.6); } g.stroke();
    g.restore();
  }
  // 城名环形字（在王城图标外圈，平贴在纸上）
  const [cx, cy] = PARCHMENT.landmarks[0];
  if (ring > 0) drawCityRing(g, cx, cy, ring, T);
  // 地标（立起的纸片）
  for (let i = 0; i < 6; i++) {
    const p = lms[i] ?? 0;
    if (p <= 0) continue;
    const [lx, ly] = PARCHMENT.landmarks[i];
    const bx = lx + LM_BASE[i][0], by = ly + LM_BASE[i][1];
    const tb = bounce[i] == null ? -1 : T - bounce[i];
    const hop = tb >= 0 && tb < 0.36 ? Math.sin((tb / 0.36) * Math.PI) : 0;
    const settle = tb >= 0.36 ? wobble(tb, 0.36, 4, 0.18) * 0.08 : 0;
    const sc = LM_SCALE[i];
    g.save();
    g.translate(bx, by - hop * 14);
    g.scale((1 - hop * 0.06 + settle) * sc, (1 + hop * 0.12 - settle) * sc);
    g.translate(-bx, -(by));
    standUp(g, bx, by, p, LM_W[i], () => {
      g.save(); g.translate(bx, by);
      LM_DRAW[i](g, T, bounce[i]);
      g.restore();
    });
    g.restore();
  }
  // 任务图钉
  if (pin > 0) drawMissionPin(g, { x: PARCHMENT.pin[0], y: PARCHMENT.pin[1], drop: pin });
  // 笔头小骑士
  if (route > 0 && o.knight !== false) {
    // 线画完后骑士停在龙山脚下（r 0.955），把山顶让给任务图钉
    const done = route >= 1;
    const [kx, ky] = mapToScreen('parchment', ...mapRoute(done ? 0.955 : route));
    drawKnightToken(g, { x: kx, y: ky, size: o.knightSize ?? 60, face: 1, hop: done ? 0 : (T * 2.6) % 1, t: done ? 0 : T, pen: !done });
  }
  // 金光斜扫
  if (sweep > 0 && sweep < 1) {
    const { x, y, w, h } = PARCHMENT.rect;
    const sx = lerp(x - 600, x + w + 600, sweep);
    g.save();
    g.clip(PM.sheet);
    g.globalCompositeOperation = 'screen';
    g.translate(sx, y + h / 2); g.rotate(0.42);
    g.fillStyle = lin(g, -160, 0, 160, 0, [[0, rgba(PAL.goldLight, 0)], [0.5, rgba(PAL.goldLight, 0.55)], [1, rgba(PAL.goldLight, 0)]]);
    g.fillRect(-160, -h, 320, 2 * h);
    g.restore();
  }
}

// ———————————————————— 小地图（旅途 HUD 右上卡片） ————————————————————
/** 小地图卡片矩形（屏幕坐标）。 */
export const MINI = MAP_FORMS.mini;

function miniIcons(g, f, T) {
  const P = (k) => mapToScreen(f, ...MAP_UV[k]);
  const [c0, c1] = P('castle');
  g.fillStyle = PAL.stone; g.fillRect(c0 - 9, c1 - 6, 18, 7);
  for (const dx of [-8, -3, 2, 7]) g.fillRect(c0 + dx - 1.2, c1 - 10 - (dx === -3 || dx === 2 ? 4 : 0), 2.6, 6);
  g.fillStyle = PAL.roofRed; for (const dx of [-8, 7]) { g.beginPath(); g.moveTo(c0 + dx - 2.4, c1 - 10); g.lineTo(c0 + dx + 0.1, c1 - 15); g.lineTo(c0 + dx + 2.6, c1 - 10); g.fill(); }
  g.fillStyle = PAL.roof; g.beginPath(); g.moveTo(c0 - 5, c1 - 14); g.lineTo(c0 - 0.5, c1 - 21); g.lineTo(c0 + 4, c1 - 14); g.fill();
  const [m0, m1] = P('meadow');
  g.fillStyle = PAL.grass; for (const dx of [-6, 0, 6]) { g.beginPath(); g.moveTo(m0 + dx - 3, m1 + 2); g.lineTo(m0 + dx, m1 - 6); g.lineTo(m0 + dx + 3, m1 + 2); g.fill(); }
  g.fillStyle = PAL.slime; g.beginPath(); g.arc(m0 + 10, m1 + 1, 3.4, Math.PI, 0); g.fill();
  const [v0, v1] = P('village');
  g.fillStyle = PAL.paper2; g.fillRect(v0 - 3, v1 - 9, 6, 9);
  g.strokeStyle = PAL.wood; g.lineWidth = 1.4;
  for (let k = 0; k < 4; k++) { const a = T * 1.5 + (k * Math.PI) / 2; g.beginPath(); g.moveTo(v0, v1 - 9); g.lineTo(v0 + Math.cos(a) * 7, v1 - 9 + Math.sin(a) * 7); g.stroke(); }
  g.fillStyle = PAL.roofRed; g.beginPath(); g.moveTo(v0 + 5, v1 - 3); g.lineTo(v0 + 9, v1 - 8); g.lineTo(v0 + 13, v1 - 3); g.fill();
  const [p0, p1] = P('pass');
  g.fillStyle = PAL.mountain; g.beginPath(); g.moveTo(p0 - 13, p1 + 5); g.lineTo(p0, p1 - 13); g.lineTo(p0 + 13, p1 + 5); g.fill();
  g.fillStyle = PAL.snow; g.beginPath(); g.moveTo(p0 - 5, p1 - 6); g.lineTo(p0, p1 - 13); g.lineTo(p0 + 5, p1 - 6); g.lineTo(p0 + 1, p1 - 8); g.fill();
  g.fillStyle = PAL.scarf; g.beginPath(); g.moveTo(p0 + 0.4, p1 - 19); g.lineTo(p0 + 6, p1 - 17); g.lineTo(p0 + 0.4, p1 - 15); g.fill();
  g.strokeStyle = PAL.woodDark; g.lineWidth = 0.8; g.beginPath(); g.moveTo(p0, p1 - 13); g.lineTo(p0, p1 - 19); g.stroke();
  const [f0, f1] = P('forest');
  g.fillStyle = PAL.forestDeep; for (const dx of [-7, 0, 7]) { g.beginPath(); g.moveTo(f0 + dx - 4, f1 + 3); g.lineTo(f0 + dx, f1 - 9 - (dx === 0 ? 3 : 0)); g.lineTo(f0 + dx + 4, f1 + 3); g.fill(); }
  g.fillStyle = PAL.moon; g.beginPath(); g.arc(f0 + 11, f1 - 12, 3.2, 0, TAU); g.fill();
  const [d0, d1] = P('dragon');
  g.fillStyle = mixHex(PAL.mountainDark, PAL.dragonDark, 0.6); g.beginPath(); g.moveTo(d0 - 14, d1 + 6); g.lineTo(d0 - 2, d1 - 14); g.lineTo(d0 + 4, d1 - 10); g.lineTo(d0 + 14, d1 + 6); g.fill();
  g.fillStyle = PAL.ink; g.beginPath(); g.arc(d0 + 1, d1 + 6, 3.4, Math.PI, 0); g.fill();
  g.fillStyle = rgba(PAL.inkSoft, 0.5); g.beginPath(); g.arc(d0 - 1 + Math.sin(T * 2) * 1, d1 - 18 - ((T * 6) % 6), 2.5, 0, TAU); g.fill();
}

function miniFront(g, f, T, o) {
  const { r, walked, dir, knightSize } = o;
  const { x, y, w, h } = f;
  // 地图底：淡淡的区域水彩
  g.save();
  g.beginPath(); g.rect(x + 10, y + 10, w - 20, h - 20); g.clip();
  const washes = [['meadow', PAL.meadow, 0.3], ['village', PAL.gold, 0.25], ['pass', PAL.ice, 0.55], ['forest', PAL.forest, 0.22], ['dragon', PAL.dragon, 0.22]];
  washes.forEach(([k, c, a], i) => { const [wx, wy] = mapToScreen(f, ...MAP_UV[k]); g.fillStyle = rgba(c, a); g.fill(blob(wx, wy, 34, 20, { seed: 501 + i, amp: 0.08 })); });
  miniIcons(g, f, T);
  // 路线：未走 = 浅墨点线；走过 = 红（去程）/ 金（归程，由 r 到终点）
  const all = mapRoutePoints(f, 0, 1);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = rgba(PAL.inkSoft, 0.55); g.lineWidth = 2.2; g.setLineDash([4, 5]);
  g.beginPath(); all.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
  g.setLineDash([]);
  const seg2 = (a, b, col, lw) => {
    if (b - a <= 1e-4) return;
    const pts = mapRoutePoints(f, a, b);
    g.strokeStyle = rgba(PAL.shadow, 0.25); g.lineWidth = lw; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px + 0.8, py + 1.4) : g.moveTo(px + 0.8, py + 1.4))); g.stroke();
    g.strokeStyle = col; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
  };
  if (walked === 'gold') { seg2(0, r, PAL.scarf, 4.2); seg2(r, 1, PAL.gold, 4.6); }
  else seg2(0, r, PAL.scarf, 4.2);
  g.restore();
  // 小骑士
  const [kx, ky] = mapToScreen(f, ...mapRoute(r));
  drawKnightToken(g, { x: kx, y: ky + 2, size: knightSize, face: dir, hop: (T * 2.2) % 1, t: T });
}

function miniBack(g, f, T) {
  const { x, y, w, h } = f;
  const cx = x + w / 2, cy = y + h / 2;
  // 墨线问号（路径画）
  const q = new Path2D();
  q.moveTo(cx - 22, cy - 22);
  q.bezierCurveTo(cx - 22, cy - 52, cx + 26, cy - 54, cx + 26, cy - 26);
  q.bezierCurveTo(cx + 26, cy - 8, cx + 2, cy - 6, cx + 1, cy + 12);
  g.save();
  g.strokeStyle = PAL.ink; g.lineWidth = 11; g.lineCap = 'round'; g.lineJoin = 'round';
  g.stroke(q);
  g.fillStyle = PAL.ink; g.beginPath(); g.arc(cx + 1, cy + 34, 7.5, 0, TAU); g.fill();
  g.strokeStyle = rgba(PAL.paper, 0.35); g.lineWidth = 3; g.translate(-2, -2); g.stroke(q);
  g.restore();
}

function cardPath(f, seed) { return poly([[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.h], [f.x, f.y + f.h]], { seed, amp: 1.2, step: 30 }); }
function drawCard(g, f, face, T, o) {
  const p = cardPath(f, 511);
  const kraftFace = face === 'back' || face === 'blank';
  cut(g, p, kraftFace ? PAL.kraft : PAL.paper, { shadow: 0 });
  if (kraftFace) shade(g, p, PAL.kraftDark, f.x, f.y, f.x + f.w, f.y + f.h, 0.05, 0.4);
  else shade(g, p, PAL.paper2, f.x, f.y, f.x, f.y + f.h, 0, 0.6);
  if (face === 'back') miniBack(g, f, T); else if (face === 'front') miniFront(g, f, T, o);
  // 缝线、墨框、金包角
  g.save();
  g.strokeStyle = PAL.kraftDark; g.lineWidth = 2; g.setLineDash([10, 8]);
  g.strokeRect(f.x + 12, f.y + 12, f.w - 24, f.h - 24);
  g.setLineDash([]);
  g.strokeStyle = PAL.ink; g.lineWidth = 4; g.lineJoin = 'round';
  g.stroke(p);
  for (const [cx, cy, sx, sy] of [[f.x, f.y, 1, 1], [f.x + f.w, f.y, -1, 1], [f.x, f.y + f.h, 1, -1], [f.x + f.w, f.y + f.h, -1, -1]]) {
    g.save(); g.translate(cx, cy); g.scale(sx, sy);
    const cp = pathOf([[-3, -3], [26, -3], [26, 4], [9, 6], [6, 9], [4, 26], [-3, 26]]);
    cut(g, cp, PAL.gold, { rim: PAL.goldLight, rimW: 1.4 });
    g.strokeStyle = PAL.goldDark; g.lineWidth = 1.2; g.stroke(cp);
    g.restore();
  }
  g.restore();
}

/**
 * 小地图卡片（屏幕坐标，右上 x 1524–1824、y 72–242）。
 * o: { r 0..1（小骑士在路线上的位置，按弧长）, dir 1|-1（骑士朝向；归程 -1）, walked 'red'|'gold'（gold：r 到终点的路段已由红变金）,
 *      show 0..1（从右侧滑入，outBack）, flip 0..1（翻到背面：墨线问号）, fold 0..1（下半张向上折起）, knightSize（默认 44）, rect（改卡片位置） }
 */
export function drawMiniMap(g, T, o = {}) {
  const { r = 0, dir = 1, walked = 'red', show = 1, flip = 0, fold = 0, knightSize = 44 } = o;
  if (show <= 0) return;
  const f = o.rect || MINI;
  const sh = show >= 1 ? 1 : Math.max(0, outBack(clamp(show), 1.6));
  const ox = (1 - sh) * (1920 - f.x + 40);
  const fx = f.x + f.w / 2, fy = f.y + f.h / 2;
  const sx = Math.cos(Math.PI * clamp(flip));
  const face = sx >= 0 ? 'front' : 'back';
  const fo = clamp(fold);
  g.save();
  g.translate(ox, 0);
  // 卡片投影（随翻面变窄、随折起变矮，始终在卡片右下）
  const cflap = Math.cos(Math.PI * fo);
  const shH = fo > 0 ? f.h / 2 + Math.max(0, cflap) * f.h / 2 : f.h;
  const shW = f.w * Math.max(0.02, Math.abs(sx));
  g.fillStyle = rgba(PAL.shadow, 0.2);
  g.fill(cardPath({ x: fx - shW / 2 + 5, y: f.y + 9, w: shW, h: shH }, 512));
  g.translate(fx, fy); g.scale(Math.max(0.02, Math.abs(sx)), 1); g.translate(-fx, -fy);
  const opt = { r: clamp(r), dir, walked, knightSize };
  if (fo <= 0) drawCard(g, f, face, T, opt);
  else {
    // 上半张不动；下半张绕中线向上折（过 90° 后看到 kraft 背面）
    g.save(); g.beginPath(); g.rect(f.x - 10, f.y - 10, f.w + 20, f.h / 2 + 10); g.clip(); drawCard(g, f, face, T, opt); g.restore();
    const c = Math.cos(Math.PI * fo);
    g.save();
    g.translate(0, fy); g.scale(1, c); g.translate(0, -fy);
    g.beginPath(); g.rect(f.x - 10, fy, f.w + 20, f.h / 2 + 10); g.clip();
    if (c >= 0) drawCard(g, f, face, T, opt);
    else drawCard(g, f, 'blank', T, opt);
    g.fillStyle = rgba(PAL.shadow, 0.3 * Math.sin(Math.PI * fo)); g.fillRect(f.x - 10, fy, f.w + 20, f.h / 2 + 10);
    g.restore();
  }
  g.restore();
}
