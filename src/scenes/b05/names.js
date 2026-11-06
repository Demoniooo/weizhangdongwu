// b05 · 四遍名字的“容器”：N1 对话框剪纸字、N2 取名面板、N3 气球字、N4 印章字三行，以及三个反应气泡。
// 屏幕空间的东西（对话框、面板、印章字、气泡）画在 ui 图层；气球字画在 main 图层（世界坐标 depth 1）。
import { PAL } from '../../core/paper.js';
import { toScreen } from '../../core/camera.js';
import { ez, outBack, outCubic, inQuad, inCubic, inOutSine, spring, glide } from '../../core/ease.js';
import { clamp, lerp, seg, hit, wobble, noise1, hash2, mixHex, rgba } from '../../core/util.js';
import { paperGlyph, glyphRow, NAME_TIMES, charsOf } from '../../ui/type.js';
import { dialogBox, namePanel, bubble, glyphIcon } from '../../ui/kit.js';
import { drawBalloonString } from '../../props/misc.js';
import { CAMS } from '../../env/throne.js';
import { applyParallax } from '../_seams.js';
import { C, BALLOON_T } from './plan.js';

export const HERO = charsOf('hero');
const TN1 = [...NAME_TIMES('N1a'), ...NAME_TIMES('N1b')];
const TN1C = NAME_TIMES('N1c');
const TN2 = ['N2a', 'N2b', 'N2c'].flatMap(NAME_TIMES);
export const TN3 = ['N3a', 'N3b', 'N3c'].flatMap(NAME_TIMES);
if (!BALLOON_T.length) BALLOON_T.push(...TN3);

// ———————————————————— N1：对话框（正好 8 个 120px 字）→ 右框鼓出 → 撕开，后五字从破口飞出 ————————————————————
const DLG_Y = 795;                 // 字的中线
const PITCH = 98;
const SLOT_X = (i) => 600 + PITCH / 2 + PITCH * i;   // 第 i 个字的中心 x
const HOLE = [1492, DLG_Y];         // 撕口（右框）里卡着的字
/** 对话框存在到甩镜中段（被「翁」擦屏盖住时收走）。 */
export const DLG_END = C.K1 + 0.02;

/** 第 j 个 c 段字（0..4 = 卜多比鲁翁）被下一个字顶出破口的时刻（翁直接冲向镜头）。 */
const ejectAt = (j) => (j < 4 ? TN1C[j + 1] : TN1C[4]);
/** 被顶出后的飞行路线（屏幕坐标）：二次贝塞尔 [起点, 控制点, 终点]。 */
const FLY = [
  [HOLE, [1700, 520], [2120, 300]],
  [HOLE, [1760, 760], [2140, 640]],
  [HOLE, [1640, 330], [1880, -160]],
  [HOLE, [1830, 860], [2160, 1000]],
];
const bez = (P, u) => [
  (1 - u) * (1 - u) * P[0][0] + 2 * (1 - u) * u * P[1][0] + u * u * P[2][0],
  (1 - u) * (1 - u) * P[0][1] + 2 * (1 - u) * u * P[1][1] + u * u * P[2][1],
];

/** N1 对话框（屏幕空间，ui 图层里画）。cursor 只在接缝帧前亮（41.90 正处在灭相）。 */
export function drawN1(lg, T) {
  if (T >= DLG_END) return;
  // 47 前的挤压：N1b 每进一个字，前面的字被挤一下
  let press = 0;
  for (let i = 4; i < 8; i++) press += 0.25 * ez(T, TN1[i], TN1[i] + 0.12);
  const relax = ez(T, C.N1c, C.N1c + 0.16, outCubic);
  press *= 1 - relax;
  const bul = T < TN1[7] ? 0 : spring(T - TN1[7], { freq: 2.6, damping: 0.3 }) * (1 - ez(T, C.N1c, C.N1c + 0.1));
  const tear = ez(T, C.N1c, C.N1c + 0.1, outCubic);
  // 甩镜时对话框整体被扯走（向右下掉出），被「翁」擦屏盖住
  const away = ez(T, C.K1 - 0.12, DLG_END, inQuad);
  lg.save();
  if (away > 0) { lg.translate(260 * away, 520 * away); lg.rotate(0.12 * away); }
  dialogBox(lg, {
    speaker: 'hero', tag: '？？？', text: '', cursor: T < C.N1a, textArea: { x: 600, w: 784 },
    bulgeRight: bul, tear, tearY: DLG_Y, t: T,
  });
  // 前 8 个字
  const n1c = T >= C.N1c ? hit(T, C.N1c, 0.12) : 0;
  glyphRow(lg, HERO.slice(0, 8), 600, DLG_Y, 120, {
    style: 'cut', pitch: PITCH,
    appear: TN1.map((t0) => (T - t0) / 0.25),
    perChar: (i) => {
      // 越早的字被挤得越多（向左、横向压扁），撕开那一下全体一震
      let dx = 0;
      for (let j = Math.max(i + 1, 4); j < 8; j++) dx -= 3.2 * ez(T, TN1[j], TN1[j] + 0.1) * (1 + 0.6 * wobble(T, TN1[j], 6, 0.12));
      dx *= 1 - relax;
      return { dx, squashX: 1 - 0.07 * press * (i < 7 ? 1 : 0.5), dy: -10 * n1c * Math.sin(i * 1.7 + 0.5), rot: 0.05 * n1c * Math.sin(i * 2.3) };
    },
  });
  // c 段：卡在撕口 → 被下一个字顶出去
  for (let j = 0; j < 4; j++) drawEjected(lg, T, j);
  lg.restore();
}
/** c 段第 j 个字：先卡在破口里（可读 0.26s），再被顶出去飞走（带拖影）。 */
function drawEjected(lg, T, j) {
  const t0 = TN1C[j], te = ejectAt(j);
  if (T < t0) return;
  const ch = HERO[8 + j];
  if (T < te) {
    // 卡在破口：第一个字是撞破右框的那一下（从格位冲过来）
    const a = seg(T, t0, t0 + 0.1);
    const x0 = j === 0 ? SLOT_X(8) : HOLE[0] - 60;
    const x = lerp(x0, HOLE[0], outBack(a, 2));
    const jig = wobble(T, t0, 7, 0.16);
    paperGlyph(lg, ch, x, HOLE[1] + 6 * jig, 120, {
      style: 'cut', scale: lerp(0.4, 1, outBack(a, 2.2)), squashX: 0.82 + 0.08 * jig, rot: 0.12 + 0.12 * jig, alpha: Math.min(1, a * 3),
    });
    return;
  }
  const u = (T - te) / 0.5;
  if (u >= 1) return;
  // 飞走：拖影（3 张越来越淡的旧位置）
  for (let k = 3; k >= 0; k--) {
    const uk = clamp(u - k * 0.05);
    if (k > 0 && uk <= 0) continue;
    const [x, y] = bez(FLY[j], outCubic(uk));
    const rot = (j % 2 ? -1 : 1) * (0.15 + 2.2 * uk * uk);
    paperGlyph(lg, ch, x, y, 120, { style: 'cut', scale: 1 + 0.25 * uk, rot, alpha: k ? 0.22 / k : 1 });
  }
}

/** 「翁」朝镜头飞来（44.84–45.00 放大到 4 倍）→ 45.00 撞镜 → 45.00–45.12 带褶皱往右下滑走（擦屏）。屏幕空间。 */
export function drawLensWeng(g, T) {
  const t0 = TN1C[4], hitAt = C.K1 - 0.1, out = C.K1 + 0.02;
  if (T < t0 || T >= out + 0.02) return;
  const ch = HERO[12];
  let x, y, s, rot, sx = 1, sy = 1, skew = 0;
  if (T < hitAt) {
    const u = seg(T, t0, hitAt);
    const e = inCubic(u);
    x = lerp(HOLE[0], 930, outCubic(u)); y = lerp(HOLE[1], 540, outCubic(u)) - 120 * Math.sin(Math.PI * u);
    s = lerp(1, 4, e); rot = lerp(0.25, -0.06, u);
  } else {
    const u = seg(T, hitAt, out);
    const e = inQuad(u);
    x = lerp(930, 1700, e); y = lerp(540, 1250, e);
    s = 4 * (1 + 0.1 * Math.sin(Math.PI * u)); rot = lerp(-0.06, 0.22, e);
    sx = 1 + 0.08 * Math.sin(u * 9); sy = 1 - 0.18 * u; skew = 0.25 * u;   // 褶皱：被镜头刮着走
  }
  g.save();
  g.translate(x, y); g.rotate(rot); g.transform(1, 0, skew, 1, 0, 0); g.scale(sx, sy);
  // 大字下面的纸片阴影
  paperGlyph(g, ch, 14, 22, 120 * s, { style: 'cut', fill: PAL.shadow, edge: PAL.shadow, alpha: 0.28 });
  paperGlyph(g, ch, 0, 0, 120 * s, { style: 'cut' });
  // 褶皱：两道斜向明暗折痕
  if (T >= hitAt) {
    const u = seg(T, hitAt, out);
    g.globalAlpha = 0.35 * Math.min(1, u * 4);
    g.strokeStyle = PAL.white; g.lineWidth = 10;
    g.beginPath(); g.moveTo(-240, -120); g.lineTo(200, 160); g.stroke();
    g.strokeStyle = PAL.redDeep; g.lineWidth = 6;
    g.beginPath(); g.moveTo(-180, 180); g.lineTo(240, -60); g.stroke();
  }
  g.restore();
}

/** 卡在王冠尖上的「翁」（世界坐标，main 图层；国王锚点 a 已画好）。45.12–45.35 落下卡住；K2 王冠滑下时掉下去。 */
export function drawCrownWeng(lg, T, a) {
  const land = C.K1 + 0.25, fall = C.K2 + 0.06;
  if (T < C.K1 + 0.02 || !a || !a.crownTop) return;
  const size = 62;
  const [cx, cy] = a.crownTop;
  const base = a.crownRot || 0;
  let x = cx, y = cy, rot = base + 0.42, sq = 0, alpha = 1;
  if (T < land) {
    const u = seg(T, C.K1 + 0.02, land);
    y -= lerp(420, 0, inQuad(u)); x += lerp(-70, 0, u); rot = lerp(-0.6, base + 0.42, u);
  } else {
    sq = 0.3 * wobble(T, land, 5, 0.18);
    rot += 0.08 * wobble(T, land, 3, 0.4) + 0.04 * Math.sin(T * 2.3);
  }
  if (T >= fall) {
    const u = (T - fall) / 0.55;
    if (u >= 1) return;
    y += 700 * u * u + 60 * u; x -= 40 * u; rot += 3 * u; alpha = 1 - clamp((u - 0.7) / 0.3);
  }
  // 字的下沿卡在尖上：字心在尖上方 0.42 字高（沿字的旋转方向）
  const ox = Math.sin(rot) * size * 0.42, oy = -Math.cos(rot) * size * 0.42;
  paperGlyph(lg, HERO[12], x + ox, y + oy, size, { style: 'cut', rot, squashX: 1 + sq * 0.5, squashY: 1 - sq, alpha });
}

// ———————————————————— N2：吊线 8 格取名面板（按 TR-2S 设计的屏幕坐标，depth 1.1 随机位视差） ————————————————————
export const PANEL_IN = C.K1 + 0.4;          // 45.50 从画面顶上降下
export const PANEL_OUT = C.K2;               // 49.31 前淡出（snap 推到国王格时掠过镜头）
const PK = {
  full: TN2[7] + 0.12,       // 迪落定 → 满格泛金
  bulge0: C.N2c + 0.32, bulge1: C.N2c + 0.64,     // 48.03–48.35 鼓成气球
  over0: C.N2c + 0.59, over1: C.N2c + 0.9,        // 48.30–48.61 「字数超限！」闪三次
  left: C.N2c + 0.89,                              // 48.60 左绳断
  pop: TN2[12] + 0.01,                             // 49.00 翁挤进去 → 格框崩飞
  right: C.N2c + 1.47,                             // 49.18 右绳断
};
export const PANEL_EVENTS = PK;
/** 面板（ui 图层里画；c = 当前机位）。返回 namePanel 的返回值。 */
export function drawN2(lg, T, c) {
  if (T < PANEL_IN || T >= PANEL_OUT) return null;
  const tiles = HERO.map((ch, i) => ({ ch, p: (T - TN2[i]) / 0.25 }));
  let cp = 0;
  for (let i = 0; i < 13; i++) { const tl = TN2[i] + 0.14; if (T >= tl) cp = Math.max(cp, 1 - (T - tl) / 0.22); }
  const swing = T < PK.left ? 0 : 70 * spring(T - PK.left, { freq: 2.2, damping: 0.38 });
  const popSwing = 70 * spring(PK.pop - PK.left, { freq: 2.2, damping: 0.38 });
  const desc = ez(T, PANEL_IN, C.N2a, (u) => outBack(u, 1.5));
  const fade = 1 - ez(T, C.K2 - 0.09, PANEL_OUT);
  let r = null;
  lg.save();
  applyParallax(lg, c, CAMS.TR_2S, 1.1);
  lg.translate(0, -760 * (1 - desc));
  lg.globalAlpha *= fade;
  r = namePanel(lg, {
    tiles, counterPop: clamp(cp), t: T,
    full: ez(T, PK.full, PK.full + 0.1) * (1 - ez(T, C.N2c, C.N2c + 0.12)),
    bulge: ez(T, PK.bulge0, PK.bulge1, outBack),
    overTag: seg(T, PK.over0, PK.over1),
    strings: { left: PK.left, right: PK.right },
    swing, popSwing, popFrames: Math.max(0, (T - PK.pop) / 0.4),
    drop: seg(T, PK.right, PK.right + 0.27),
  });
  lg.restore();
  return r;
}

// ———————————————————— N3：国王吹出的气球字（世界坐标，depth 1） ————————————————————
const BAL_FILL = [PAL.princessLight, PAL.skyDay, PAL.leafLight, PAL.goldLight];
/** 每个气球的最终位置（世界）、大小、旋转、镜像：两行，左→右、上行读完再读下行。c 段越来越小、越来越耷拉。 */
export const BAL = [
  [770, 352, 1.12, -0.22], [866, 378, 0.98, 0.18], [962, 342, 1.25, -0.1], [1060, 372, 1.0, 0.24],
  [1158, 330, 0.95, -0.18], [1252, 366, 1.18, 0.12], [1340, 322, 0.86, -0.25], [1424, 356, 1.06, 0.15],
  [1104, 478, 1.0, 0.1], [1186, 494, 0.86, -0.2], [1258, 512, 0.72, 0.22], [1318, 532, 0.58, -0.15], [1362, 560, 0.45, 0.45],
].map(([x, y, s, rot], i) => ({ x, y, s, rot, flipY: i === 2, mirror: i === 5, fill: BAL_FILL[i % 4] }));
const BAL_SIZE = 96;
/**
 * 气球 i 在 T 时刻的世界位置与状态。mouth = 国王嘴（出生点），lift = 国王被吊起的位移 [dx, dy]。
 * 返回 null 表示还没吹出来 / 已被戳破。
 */
export function balloonAt(i, T, mouth, lift) {
  const t0 = TN3[i];
  if (T < t0 || T >= C.N4a - 0.06) return null;
  const B = BAL[i];
  // 先在嘴边吹大（0–0.22s，读得到），再飘到自己的位置（0.15–0.65s）
  const u = seg(T, t0 + 0.15, t0 + 0.65);
  const mv = outCubic(u);
  const bud = [mouth[0] - 70, mouth[1] - 80];
  let x = lerp(bud[0], B.x, mv), y = lerp(bud[1], B.y, mv) - 40 * Math.sin(Math.PI * u);
  const grow = outBack(seg(T, t0, t0 + 0.22), 2.4);
  // 漂浮晃动（噪声）
  x += noise1(T * 0.9 + i * 3.1, 11) * 10; y += noise1(T * 1.1 + i * 2.3, 12) * 8;
  // N3b：斑把贝弹开；每个新气球到位时挤一下邻居
  for (let j = 0; j < 13; j++) {
    if (j === i || Math.abs(j - i) > 1) continue;
    const tj = TN3[j] + 0.3;
    if (T > tj) x += (i < j ? -1 : 1) * 14 * wobble(T, tj, 3, 0.3);
  }
  if (i === 6) { const tb = TN3[6] + 0.32; if (T > tb) { const w = hit(T, tb, 0.35); x += 46 * w * Math.cos((T - tb) * 9); y -= 30 * w; } }
  if (i === 4) { const tb = TN3[6] + 0.32; if (T > tb) x -= 18 * wobble(T, tb, 4, 0.25); }
  // N3c 之后整体被风带着上浮、随国王一起升起
  x += lift[0]; y += lift[1];
  const rot = B.rot + noise1(T * 0.8 + i, 13) * 0.12 + (i === 12 ? 0.25 * Math.sin(T * 2.4) : 0);
  // 翁：耷拉着往下垂
  if (i === 12) y += 18 * ez(T, t0 + 0.3, t0 + 0.6);
  return { x, y, s: B.s * grow, rot, B };
}
/** 气球线 + 气球字（main 图层，世界坐标）。from = 线的汇集端（嘴 → 王冠尖）。返回各气球中心（世界）。 */
export function drawBalloons(lg, T, mouth, crownTop, lift) {
  const list = [];
  for (let i = 0; i < 13; i++) { const b = balloonAt(i, T, mouth, lift); if (b) list.push([i, b]); }
  if (!list.length) return list;
  // 线：N3c 起汇到王冠尖（13 根线缠在王冠上）
  const kc = ez(T, C.N3c + 0.12, C.N3c + 0.45, inOutSine);
  const from = [lerp(mouth[0], crownTop[0], kc), lerp(mouth[1], crownTop[1], kc)];
  const to = list.map(([, b]) => {
    const a = b.rot;
    return [b.x - Math.sin(a) * BAL_SIZE * b.s * 0.52, b.y + Math.cos(a) * BAL_SIZE * b.s * 0.52];
  });
  drawBalloonString(lg, { from, to, knot: ez(T, C.N3b, C.N3b + 0.5, outCubic) * (1 - 0.7 * kc), t: T, lw: 2.4, seed: 5 });
  for (const [i, b] of list) {
    paperGlyph(lg, HERO[i], b.x, b.y, BAL_SIZE, {
      style: 'balloon', fill: b.B.fill, scale: b.s, rot: b.rot, flipY: b.B.flipY, mirror: b.B.mirror,
    });
  }
  return list;
}
/** 噗：吹出气球时嘴边的一小团气（世界坐标）。 */
export function drawPuffs(lg, T, mouth) {
  for (let i = 0; i < 13; i++) {
    const u = (T - TN3[i]) / 0.3;
    if (u < 0 || u >= 1) continue;
    lg.save();
    lg.globalAlpha = (1 - u) * 0.8;
    lg.fillStyle = PAL.white;
    for (let k = 0; k < 3; k++) {
      const a = -2.4 + k * 0.45 + hash2(i, k) * 0.3;
      const r = 6 + 10 * u + k * 2;
      lg.beginPath(); lg.arc(mouth[0] + Math.cos(a) * (14 + 40 * u), mouth[1] + Math.sin(a) * (14 + 40 * u), r, 0, Math.PI * 2); lg.fill();
    }
    lg.restore();
  }
}

// ———————————————————— N4：印章字三行（屏幕空间；镜头越拉越远，字越来越大） ————————————————————
export const ROWS = [
  { from: 0, n: 4, y: 228, size: 130, at: C.N4a, arc: 150 },
  { from: 4, n: 4, y: 400, size: 160, at: C.N4b, arc: 90 },
  { from: 8, n: 5, y: 608, size: 200, at: C.N4c, arc: 26 },
];
const CELL = 1.12, GAPK = 0.07;
/** 第 i 个字在行里的屏幕位置。 */
export function rowSlot(i) {
  const R = ROWS.find((r) => i >= r.from && i < r.from + r.n);
  const w = R.size * CELL, gap = R.size * GAPK;
  const total = R.n * w + (R.n - 1) * gap;
  return { x: 960 - total / 2 + w / 2 + (i - R.from) * (w + gap), y: R.y, size: R.size, at: R.at, R };
}
export const RETURN0 = C.I1 - 0.69;  // 56.20 开始飞回圣旨
/**
 * 印章字：从圣旨字位跳起 → 飞到屏幕行悬停 → 56.20 起飞回圣旨（落到金字上消失）。
 * chars = 圣旨 13 个字位（屏幕坐标，drawThroneRoom 返回）；zoomNow = 圣旨所在深度的当前缩放（落点字号）。
 */
export function drawSealRows(lg, T, chars, zoomNow) {
  if (!chars) return;
  for (let n = 12; n >= 0; n--) {
    const i = n < 8 ? n : 20 - n; // 先画第 3 行（最大），再画第 2、1 行：上面两行不被第 3 行盖住
    const S = rowSlot(i);
    const j = i - S.R.from;
    const t0 = S.at + j * 0.035;
    if (T < t0) continue;
    const back0 = RETURN0 + i * 0.018, back1 = back0 + 0.28;
    if (T >= back1) continue;
    const src = chars[i];
    let x, y, size, rot, alpha = 1;
    const u = seg(T, t0, t0 + 0.34);
    const e = outCubic(u);
    const hover = Math.sin(T * 3.1 + i * 0.9) * 4;
    x = lerp(src[0], S.x, e);
    y = lerp(src[1], S.y, e) - S.R.arc * Math.sin(Math.PI * u) * (1 - u * 0.4) + hover * e;
    size = lerp(64 * zoomNow * 0.95, S.size, outBack(u, 1.5));
    rot = (1 - outBack(u, 2.2)) * (j % 2 ? -0.5 : 0.5) + 0.03 * Math.sin(T * 2 + i);
    if (T >= back0) {
      const v = seg(T, back0, back1);
      const ev = inOutSine(v);
      x = lerp(S.x, src[0], ev); y = lerp(S.y + hover, src[1], ev) - 90 * Math.sin(Math.PI * v);
      size = lerp(S.size, 64 * zoomNow, ev); rot = lerp(rot, 0, ev);
      alpha = 1 - clamp((v - 0.78) / 0.22);
    }
    paperGlyph(lg, HERO[i], x, y, size, { style: 'seal', rot, alpha, seed: 3 + i });
  }
}
/** 印章字落回圣旨瞬间的金色小火花（屏幕空间）。 */
export function drawSealSparks(lg, T, chars) {
  if (!chars) return;
  for (let i = 0; i < 13; i++) {
    const at = RETURN0 + i * 0.018 + 0.26;
    const u = (T - at) / 0.15;
    if (u < 0 || u >= 1) continue;
    glyphIcon(lg, 'sparkle4', chars[i][0] + 18, chars[i][1] - 22, 30 * (1 - u * 0.5), { alpha: 1 - u, rot: u * 0.8 });
  }
}

// ———————————————————— 反应气泡（K1 / K2 国王格同构图；H1 勇者格镜像位置） ————————————————————
const BUB_K = { x: 700, y: 262, w: 470, h: 220 };
const BUB_H = { x: 1210, y: 262, w: 420, h: 210 };
/** 国王格气泡（K1「再说一遍？」/ K2「是不是…」）：tail = 嘴的屏幕坐标。 */
export function drawKingBubble(lg, T, tail) {
  const shows = [
    [C.K1 + 0.05, C.K1 + 0.42, '再说一遍？', 5],
    [C.K2 + 0.09, C.N3a - 0.04, '是不是…', 7],
  ];
  for (const [a, b, text, seed] of shows) {
    if (T < a || T >= b + 0.12) continue;
    const pop = T < b ? seg(T, a, a + 0.2) : 1 - seg(T, b, b + 0.12);
    bubble(lg, { ...BUB_K, text, tail, pop, t: T, seed, textSize: 70 });
  }
}
/** 勇者格气泡 H1「对对！」。 */
export function drawHeroBubble(lg, T, tail) {
  const a = C.H1 + 0.07, b = C.N4a - 0.12;
  if (T < a || T >= b + 0.1) return;
  const pop = T < b ? seg(T, a, a + 0.2) : 1 - seg(T, b, b + 0.1);
  bubble(lg, { ...BUB_H, text: '对对！', tail, pop, t: T, seed: 9, textSize: 84 });
}

void rgba; void mixHex; void glide; void toScreen; void hit;
