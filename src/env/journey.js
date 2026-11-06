// 旅途长卷 + 旅途时间线（V04–V13 一镜到底；b07 / b08 / b14 共用）。
//
// 世界：x 0–13400，地面线 y=860（风雪山口 x≈9300 抬到 720，进森林后回落）。主体层（depth 1）= 世界坐标。
// 远 / 中 / 前景层的 x 一律写成「镜头居中 X」：深度 d 的物体在 camX = X 时正好在屏幕中线
//   （图层坐标 = 960 + (X − 960)·d；见 journeyLayerX）。所以「风车 x=6400」= 机位走到 6400 时风车在画面正中。
// 换区：前景遮挡物（屏幕空间，blur 由镜头给）从右往左扫过；每一层都以遮挡物中线为界——线右是新区、线左是旧区，
//   遮挡期间两区都完整地画（各自裁剪到自己那一侧），接缝永远藏在遮挡物后面。
// 纯函数：只由参数（含 T）决定画面；Path2D 在模块加载时按固定种子预建；不调 ctx.layer / ctx.mask。
import { PAL, blob, poly, glow, rays, sparkle, ribbon, smooth as smoothPath } from '../core/paper.js';
import { clamp, lerp, seg, TAU, hash2, fbm1, rgba, mixHex, wobble, smoothstep, mulberry32, fract } from '../core/util.js';
import { cam as mkCam, applyCam, toScreen, drift } from '../core/camera.js';
import { outBack, outCubic, inOutCubic, inQuad, inOutSine } from '../core/ease.js';
import { cue } from '../cues.js';

// ———————————————————— 时刻（全部由 cue 推出） ————————————————————
const V01 = cue('V01'), V03 = cue('V03'), V04 = cue('V04'), V05 = cue('V05'), V06 = cue('V06'), V07 = cue('V07'), V08 = cue('V08');
const V09 = cue('V09'), V10 = cue('V10'), V11 = cue('V11'), V12 = cue('V12'), V13 = cue('V13'), E03 = cue('E03');

// ———————————————————— 机位：单调三次样条（storyboard 4.6） ————————————————————
/** [T, camX, camY, zoom]（T = 默认秒，由 cue 推出）。98.90 之后是 inQuad 推进洞口，见 JOURNEY.push。 */
export const JOURNEY_CAM_KEYS = Object.freeze([
  [V04 + 0.78, 1900, 560, 1.15], // 81.00 城门拱后，接 PLAZA
  [V05, 2800, 540, 1.0], // 82.04 草原，史莱姆
  [V06, 3350, 540, 1.0], // 83.83 打怪放慢
  [V07, 4150, 540, 1.0], // 86.01 金币收完
  [V08, 5150, 540, 1.0], // 88.01 伤痕
  [V09, 6100, 540, 1.0], // 90.15 进村
  [V09 + 0.85, 6400, 500, 0.92], // 91.00 村庄：略升、略拉开
  [V10, 6800, 500, 0.92], // 91.97 开箱开始
  [V11, 8000, 520, 1.0], // 94.04 进山口
  [V11 + 1.46, 9200, 440, 1.0], // 95.50 山口顶
  [V12, 9500, 460, 1.0], // 95.85 翻过山口，月出
  [V13, 12200, 540, 1.0], // 98.04 月光疾驰
  [V13 + 0.31, 12450, 540, 1.0], // 98.35 急刹
  [V13 + 0.86, 12450, 540, 1.0], // 98.90 静止
].map(Object.freeze));
const PUSH = Object.freeze({ t0: V13 + 0.86, t1: V13 + 1.56, x: 13000, y: 640, zoom: 3.2 });

function pchip(ts, ys) {
  const n = ts.length, h = [], d = [];
  for (let i = 0; i < n - 1; i++) { h.push(ts[i + 1] - ts[i]); d.push((ys[i + 1] - ys[i]) / h[i]); }
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] === 0 || d[i] === 0 || Math.sign(d[i - 1]) !== Math.sign(d[i])) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  const end = (h0, h1, d0, d1) => {
    let v = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (Math.sign(v) !== Math.sign(d0)) v = 0;
    else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(v) > Math.abs(3 * d0)) v = 3 * d0;
    return v;
  };
  m[0] = end(h[0], h[1], d[0], d[1]);
  m[n - 1] = end(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
  return { ts, ys, m };
}
function pchipSeg(s, t) { let i = 0; while (i < s.ts.length - 2 && t > s.ts[i + 1]) i++; return i; }
function pchipAt(s, t) {
  const i = pchipSeg(s, t), h = s.ts[i + 1] - s.ts[i], u = (t - s.ts[i]) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * s.ys[i] + (u3 - 2 * u2 + u) * h * s.m[i] + (-2 * u3 + 3 * u2) * s.ys[i + 1] + (u3 - u2) * h * s.m[i + 1];
}
function pchipSlope(s, t) {
  const i = pchipSeg(s, t), h = s.ts[i + 1] - s.ts[i], u = (t - s.ts[i]) / h, u2 = u * u;
  return ((6 * u2 - 6 * u) * s.ys[i] + (3 * u2 - 4 * u + 1) * h * s.m[i] + (-6 * u2 + 6 * u) * s.ys[i + 1] + (3 * u2 - 2 * u) * h * s.m[i + 1]) / h;
}
const KT = JOURNEY_CAM_KEYS.map((k) => k[0]);
const SX = pchip(KT, JOURNEY_CAM_KEYS.map((k) => k[1]));
const SY = pchip(KT, JOURNEY_CAM_KEYS.map((k) => k[2]));
const SZ = pchip(KT, JOURNEY_CAM_KEYS.map((k) => k[3]));
const K0 = KT[0], KN = KT[KT.length - 1];

/** 不带 drift 的机位 [x, y, zoom]。81.00 之前按初速线性外推（城门拱换景用），99.60 之后保持。 */
function camBase(T) {
  if (T <= K0) { const dt = Math.max(T - K0, -1.5); return [SX.ys[0] + SX.m[0] * dt, SY.ys[0] + SY.m[0] * dt, SZ.ys[0] + SZ.m[0] * dt]; }
  if (T <= KN) return [pchipAt(SX, T), pchipAt(SY, T), pchipAt(SZ, T)];
  const q = inQuad(seg(T, PUSH.t0, PUSH.t1));
  return [lerp(12450, PUSH.x, q), lerp(540, PUSH.y, q), Math.pow(PUSH.zoom, q)];
}
function camSpeed(T) {
  if (T <= K0) return SX.m[0];
  if (T <= KN) return pchipSlope(SX, T);
  const k = seg(T, PUSH.t0, PUSH.t1);
  return k > 0 && k < 1 ? (2 * k * (PUSH.x - 12450)) / (PUSH.t1 - PUSH.t0) : 0;
}

/**
 * 旅途机位（b07 81.00 起、b08 全段共用）。默认叠 drift(amp 5, speed 0.35)；o.drift=false 取纯曲线。
 * 81.00 之前线性外推（城门拱 80.80–81.20 扫过时用），99.60 之后保持在洞口。
 */
export function journeyCam(T, o = {}) {
  const [x, y, z] = camBase(T);
  if (o.drift === false) return mkCam(x, y, z, 0);
  const [dx, dy] = drift(T, { amp: 5, speed: 0.35, seed: 21 });
  return mkCam(x + dx / z, y + dy / z, z, 0);
}
/** 机位水平速度（世界 px/s，不含 drift）。 */
export const journeyCamSpeed = (T) => camSpeed(T);

// ———————————————————— 地面与勇者 / 白马位置 ————————————————————
/** 主体层地面线（马蹄着地线）y(x)。 */
export function journeyGroundY(x) { return 860 - 140 * smoothstep(8000, 9300, x) + 140 * smoothstep(9500, 10500, x); }
/** 地面坡度角（弧度，正 = 向右下）。 */
export function journeyGroundAngle(x) { return Math.atan2(journeyGroundY(x + 6) - journeyGroundY(x - 6), 12); }
const rise = (X) => 860 - journeyGroundY(X);

const HERO_DX = 200;
const T_DISMOUNT = V13 + 0.26, T_WALK = V13 + 0.51, T_DASH0 = V13 + 0.44, T_DASH1 = V13 + 0.72;
/** 勇者世界 x：camX − 200/zoom（屏幕 x 恒为 760）；98.55 后下马步行走向洞口。 */
export function heroJourneyX(T) {
  if (T < T_WALK) { const [x, , z] = camBase(T); return x - HERO_DX / z; }
  const t = T - T_WALK, v = 175, ta = 0.3;
  return 12250 + (t < ta ? (v * t * t) / (2 * ta) : v * (t - ta / 2));
}
/** 白马世界 x：98.47 前与勇者同步；98.47–98.75 一溜烟躲到岩石（x=12650）后面。 */
export function horseJourneyX(T) {
  if (T < T_DASH0) { const [x, , z] = camBase(T); return x - HERO_DX / z; }
  return lerp(12250, JOURNEY_FIXED.rock.x, inOutCubic(seg(T, T_DASH0, T_DASH1)));
}
function horseSpeed(T) {
  const e = 0.01;
  return (horseJourneyX(T + e) - horseJourneyX(T - e)) / (2 * e);
}

// ———————————————————— 遮挡物（换区） ————————————————————
// 遮挡物画在屏幕空间：中线屏幕 x = 960 − (cam.x − cx)·D·cam.zoom。D 取「过中线那一刻约 4600 px/s 扫过」反解，
// 城门拱用 storyboard 的 depth 1.5（那一刻机位本来就快）。
const OCC = [];
function addOcc(kind, at, V, w, D) {
  const [cx, cy, cz] = camBase(at);
  const sp = Math.max(60, camSpeed(at));
  OCC.push(Object.freeze({ kind, at, cx, cy, D: D ?? V / (sp * cz), w }));
}
addOcc('gateArch', V04 + 0.78, 0, 1150, 1.5); // 81.00
addOcc('treeGag', V07 - 0.01, 4600, 640); // 86.00
addOcc('oak', V08 + 1.94, 4800, 1500); // 89.95
addOcc('halfPine', V11 - 0.09, 4800, 980); // 93.95
addOcc('snowCliff', V12 - 0.1, 4600, 1300); // 95.75
addOcc('blackTrunks', V13 - 0.44, 4600, 300); // 97.60
addOcc('blackTrunks', V13 - 0.29, 4600, 300); // 97.75（换区接缝）
addOcc('blackTrunks', V13 - 0.14, 4600, 300); // 97.90
const SEAMS = [OCC[2], OCC[3], OCC[4], OCC[6]];
const occX = (oc, c) => 960 - (c.x - oc.cx) * oc.D * c.zoom;
const occY = (oc, c) => -(c.y - oc.cy) * 1.5 * c.zoom;
/** 某遮挡物（kind，blackTrunks 可传 index 0–2）在机位 c 下的屏幕中线 x。b07 用 gateArch 的中线把 PLAZA / JOURNEY 左右分开。 */
export function occluderX(T, kind, c = journeyCam(T), index = 0) {
  const list = OCC.filter((q) => q.kind === kind);
  const oc = list[Math.min(index, list.length - 1)];
  return oc ? occX(oc, c) : NaN;
}
/** T 时刻遮挡物中线扫到屏幕 sx 的时刻（不含 drift）。 */
function occPassTime(oc, sx) {
  let a = oc.at - 1.5, b = oc.at + 1.5;
  for (let i = 0; i < 48; i++) {
    const m = (a + b) / 2, [x, , z] = camBase(m);
    if (960 - (x - oc.cx) * oc.D * z > sx) a = m; else b = m;
  }
  return (a + b) / 2;
}
// 「绕树变样」：树干盖住勇者（屏幕 x≈780）那一刻换伤痕；盖住围巾中段（≈330）那一刻换围巾缺口破洞
const T_INJ = occPassTime(OCC[1], 780), T_SCARF = occPassTime(OCC[1], 330);

// ———————————————————— 事件时刻表 ————————————————————
const COIN_AT = Array.from({ length: 12 }, (_, i) => +(V06 + 0.14 * i).toFixed(3));
const LV_AT = [V08 + 0.39, V08 + 1.09, V08 + 1.79]; // 88.40 / 89.10 / 89.80
const CRACK_AT = [V07 + 0.09, V07 + 0.24, V07 + 0.39, V07 + 0.54]; // 86.10–86.55
const SLASH_AT = [V05 + 0.56, V05 + 0.91, V05 + 1.26]; // 82.60 / 82.95 / 83.30
const OPEN_AT = [V10 + 0.03, V10 + 0.38, V10 + 0.73, V10 + 1.08, V10 + 1.43]; // 92.00 … 93.40
const BAG_AT = OPEN_AT.map((t) => +(t + 0.32).toFixed(3));
const ITEMS = ['potion', 'key', 'boots', 'shield', 'hat'];
const KINDS = ['chest', 'pot', 'barrel', 'flowerPot', 'bigChest'];
const SLIME_POP = [V05, V05 + 0.08, V05 + 0.16];
const SLIME_SX = [1250, 1400, 1550];
const SNEEZE = V11 + 1.16; // 95.20
const MOON_RISE = [V12, V12 + 1.0]; // 95.85 → 96.85
const MOON_ROAD = [V12 + 0.35, V12 + 1.55]; // 96.20 → 97.40
const BREATH_AT = Array.from({ length: 4 }, (_, i) => +(V11 + 0.25 + 0.5 * i).toFixed(3));

/** 月亮：V12 95.85–96.85 从屏幕 (1450,900) 升到 (1450,330)，半径 260，depth 0.05。 */
const MOON = Object.freeze({ x: 1450, y0: 900, y1: 330, r: 260 });
/** 固定物（只读）。windmill / flagPeak / castle 的 x 是「镜头居中 X」；rock / caveMouth 在主体层（世界坐标）。 */
export const JOURNEY_FIXED = Object.freeze({
  windmill: Object.freeze({ x: 6400, depth: 0.8, base: 806, hubY: 476 }),
  rock: Object.freeze({ x: 12650, w: 300, h: 210 }),
  caveMouth: Object.freeze({ x: 13000, y: 640, w: 520, h: 360 }),
  flagPeak: Object.freeze({ x: 8800, depth: 0.28, top: 110 }),
  moon: MOON,
  castle: Object.freeze({ x: 300, depth: 0.3, scale: 0.35 }),
  dragonMountain: Object.freeze({ x: 13700, depth: 0.3 }),
});

function worldAtScreen(T, sx) { const [x, , z] = camBase(T); return x + (sx - 960) / z; }

// ———————————————————— 状态：勇者 / 白马 ————————————————————
const blendSched = (T, sched, dur = 0.22) => {
  let k = 0;
  for (let i = 0; i < sched.length; i++) if (T >= sched[i][0]) k = i;
  const cur = sched[k][1], prev = k > 0 ? sched[k - 1][1] : cur;
  const b = k > 0 ? clamp((T - sched[k][0]) / dur) : 1;
  return b >= 1 || prev === cur ? cur : { from: prev, to: cur, k: inOutSine(b) };
};
const HORSE_SCHED = [
  [-1e9, 'gallop'], [V05 + 0.06, 'trot'], [V06 - 0.13, 'gallop'], [T_INJ, 'limp'], [V08 + 0.09, 'trot'], [V09, 'walk'],
  [V11 - 0.14, 'trot'], [V11, 'headwind'], [V12 - 0.05, 'gallop'], [V13, 'skid'], [V13 + 0.16, 'rear'], [T_DASH0, 'gallop'], [T_DASH1 - 0.04, 'hideRock'],
];
const HERO_SCHED = [
  [-1e9, 'ride'],
  ...SLASH_AT.flatMap((t) => [[t - 0.14, 'rideSlash'], [t + 0.16, 'ride']]),
  ...OPEN_AT.flatMap((t) => [[t - 0.13, 'rideLean'], [t + 0.17, 'ride']]),
  [V11, 'rideHunch'], [SNEEZE - 0.18, 'sneeze'], [SNEEZE + 0.18, 'rideHunch'], [V12 - 0.05, 'ride'],
  [T_DISMOUNT, 'dismount'], [T_WALK, 'walk'],
];
const EXPR_SCHED = [
  [-1e9, 'grin'], [V05, 'determined'], [V06, 'grin'], [T_INJ, 'hurt'], [V07 + 1.6, 'worried'], [LV_AT[0], 'grin'], [V09, 'laugh'],
  [V10, 'smug'], [V11, 'squint'], [V12 - 0.05, 'determined'], [V13, 'shock'], [T_WALK, 'determined'],
];
const schedAt = (T, sched) => { let v = sched[0][1]; for (const [t, s] of sched) if (T >= t) v = s; return v; };

/**
 * 旅途中勇者与白马的状态（b07 / b08 共用，接缝 90.00 由它保证一致）。
 * 返回 {
 *   x, y（勇者脚底世界坐标；骑乘时 = 马的位置，勇者由镜头画在马的 saddle 锚点上）, pose（建议动作，可能是 {from,to,k}）, expr（建议表情）,
 *   bandages 0..4, bump, singed, torn, chip, soot 0..1, snowCap 0..1,
 *   scarf: { notch, hole, frozen 0..1, glow 0.6, len 936 },
 *   horse: { x, y, angle（坡度）, phase（= x ÷ 280，喂 drawHorse）, speed（px/s）, pose（gait / 动作，可能是 {from,to,k}）, gait, limp 0..1, bandageLeg, noseBandage, icicles 0..1 }
 * }
 */
export function heroJourneyState(T) {
  const hurt = T >= T_INJ;
  const lvUps = LV_AT.filter((t) => T >= t).length;
  const snowCap = T < SNEEZE ? smoothstep(V11 + 0.16, SNEEZE, T) : 1 - clamp((T - SNEEZE) / 0.08);
  const frozen = T < SNEEZE + 0.02 ? smoothstep(V11 + 0.06, V11 + 0.42, T) : 1 - smoothstep(SNEEZE + 0.02, SNEEZE + 0.16, T);
  const icicles = smoothstep(V11 + 0.26, V11 + 0.86, T) * (1 - smoothstep(V12 - 0.1, V12 + 0.5, T));
  const hx = heroJourneyX(T), mx = horseJourneyX(T);
  const pose = schedAt(T, HORSE_SCHED);
  const gait = pose === 'trot' || pose === 'walk' || pose === 'gallop' ? pose : pose === 'limp' ? 'gallop' : pose === 'headwind' ? 'trot' : null;
  return {
    x: hx, y: journeyGroundY(hx),
    pose: blendSched(T, HERO_SCHED, 0.12), expr: schedAt(T, EXPR_SCHED),
    bandages: hurt ? 4 - lvUps : 0, bump: hurt, singed: hurt, torn: hurt, chip: hurt,
    soot: hurt ? 0.12 : 0, snowCap,
    scarf: { notch: T >= T_SCARF, hole: T >= T_SCARF, frozen, glow: 0.6, len: 936 },
    horse: {
      x: mx, y: journeyGroundY(mx), angle: journeyGroundAngle(mx), phase: mx / 280, speed: Math.abs(horseSpeed(T)),
      pose: blendSched(T, HORSE_SCHED, 0.25), gait, limp: hurt ? 1 - lvUps / 3 : 0,
      bandageLeg: hurt, noseBandage: T >= V07 + 1.69, icicles,
    },
  };
}

// ———————————————————— 状态：HUD ————————————————————
function expAt(T) {
  let e = 0.08 + 0.09 * SLASH_AT.filter((t) => T >= t + 0.05).length + 0.0075 * COIN_AT.filter((t) => T >= t).length;
  const c0 = V08 + 0.11;
  if (T < c0) return e;
  const lv = [c0, ...LV_AT];
  for (let i = 0; i < 3; i++) {
    if (T < lv[i + 1]) { const a = i === 0 ? e : 0, t0 = i === 0 ? c0 : lv[i] + 0.12; return T < t0 ? 0 : lerp(a, 1, seg(T, t0, lv[i + 1])); }
  }
  e = lerp(0, 0.12, seg(T, LV_AT[2] + 0.12, LV_AT[2] + 0.5));
  return e + 0.05 * BAG_AT.filter((t) => T >= t).length;
}
const miniR = (T) => clamp((camBase(T)[0] - 1900) / (12450 - 1900));
/** 小地图骑士位置 r（去程：clamp((camX − 1900)/(12450 − 1900))，沿地图路线按弧长）。 */
export const journeyMiniR = (T) => (T < K0 ? 0 : miniR(T));

/**
 * HUD 状态（b07 / b08 / b14 共用）。返回 {
 *   show 0..1（左上角色卡：74.90 滑入，99.30 滑出）, lv, lvAt[], nameReveal（6 / 7 / 8 / 9 字）, nameRevealAt[],
 *   hearts（0..5，半颗 .5）, crackAt[], heartFlash 0..1（最后一颗闪红）, heartShiver 0..1（打哆嗦）,
 *   coins, coinAt[], coinBounce（「×12」大弹的时刻）, bag, bagAt[], bagItems[],
 *   exp 0..1, expBig 0..1（88.01–89.85 放大到画面上方中央的状态）, snailCrown, levelUpAt（最近一次升级时刻或 null）,
 *   mini: { r, show, flip, fold, dir, walked }
 * }
 */
export function hudState(T) {
  if (T >= E03 - 1) return hudReturn(T);
  const show = T < V01 + 0.5 ? 0 : T < V01 + 0.85 ? clamp(outBack(seg(T, V01 + 0.5, V01 + 0.85), 1.4)) : T < V13 + 1.26 ? 1 : 1 - inQuad(seg(T, V13 + 1.26, V13 + 1.56));
  const lvUps = LV_AT.filter((t) => T >= t).length;
  const cracks = CRACK_AT.filter((t) => T >= t).length;
  let hearts = [5, 4, 3, 2, 1.5][cracks];
  if (lvUps > 0) hearts = [2, 3, 4][lvUps - 1];
  const heartFlash = cracks === 4 && lvUps === 0 ? 0.5 + 0.5 * Math.sin((T - CRACK_AT[3]) * TAU * 2.2) : T >= V03 + 1.46 && T < V03 + 1.8 ? Math.sin(seg(T, V03 + 1.46, V03 + 1.8) * Math.PI) : 0;
  const heartShiver = smoothstep(V11 + 0.3, V11 + 0.8, T) * (T < SNEEZE ? 0.4 : 1 - 0.6 * smoothstep(SNEEZE, SNEEZE + 0.5, T)) * (1 - smoothstep(V12 - 0.2, V12 + 0.2, T));
  const expBig = T < V08 ? 0 : T < V08 + 0.2 ? clamp(outBack(seg(T, V08, V08 + 0.2), 1.6)) : T < V08 + 1.59 ? 1 : 1 - inOutCubic(seg(T, V08 + 1.59, V08 + 1.84));
  const lastLv = lvUps ? LV_AT[lvUps - 1] : null;
  const miniShow = T < V04 + 0.28 ? 0 : T < V04 + 0.58 ? clamp(outBack(seg(T, V04 + 0.28, V04 + 0.58), 1.4)) : T < V13 + 1.46 ? 1 : 1 - seg(T, V13 + 1.46, V13 + 1.56);
  return {
    show, lv: 1 + lvUps, lvAt: LV_AT, nameReveal: 6 + lvUps, nameRevealAt: LV_AT,
    hearts, crackAt: CRACK_AT, heartFlash, heartShiver,
    coins: COIN_AT.filter((t) => T >= t).length, coinAt: COIN_AT, coinBounce: V06 + 1.62,
    bag: BAG_AT.filter((t) => T >= t).length, bagAt: BAG_AT, bagItems: ITEMS,
    exp: expAt(T), expBig, snailCrown: T >= LV_AT[2], levelUpAt: lastLv,
    mini: { r: journeyMiniR(T), show: miniShow, flip: smoothstep(V13 + 1.16, V13 + 1.36, T), fold: smoothstep(V13 + 1.38, V13 + 1.5, T), dir: 1, walked: 'red' },
  };
}
function hudReturn(T) {
  const t0 = E03 + 0.02;
  const show = T < t0 ? 0 : T < t0 + 0.25 ? clamp(outBack(seg(T, t0, t0 + 0.25), 1.4)) : T < E03 + 1.22 ? 1 : 1 - seg(T, E03 + 1.22, E03 + 1.37);
  return {
    show: 0, lv: 4, lvAt: LV_AT, nameReveal: 9, nameRevealAt: LV_AT, hearts: 4, crackAt: CRACK_AT, heartFlash: 0, heartShiver: 0,
    coins: 12, coinAt: COIN_AT, coinBounce: V06 + 1.62, bag: 5, bagAt: BAG_AT, bagItems: ITEMS, exp: 0.37, expBig: 0, snailCrown: true, levelUpAt: LV_AT[2],
    mini: { r: 1 - inOutSine(seg(T, E03 + 0.04, E03 + 0.67)), show, flip: 0, fold: smoothstep(E03 + 1.12, E03 + 1.3, T), dir: -1, walked: 'gold' },
  };
}

// ———————————————————— 绘图小工具 ————————————————————
const GX = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
const LG = (x0, y0, x1, y1, stops) => { const g = GX.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
const pathOf = (pts, closed = true) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (closed) p.closePath(); return p; };
const LXd = (X, d) => 960 + (X - 960) * d;
/** 「镜头居中 X」→ 深度 d 图层坐标。 */
export const journeyLayerX = LXd;
const DROP = rgba(PAL.shadow, 0.17);
const P = (p, f, o) => ({ p, f, ...o });
/** 画一组纸片：drop（右下暗色错位分层）→ 填色 → 明暗渐变 → 切口亮边。 */
function drawParts(g, parts) {
  for (const q of parts) {
    if (q.drop) { g.save(); g.translate(q.drop * 0.42, q.drop); g.fillStyle = q.dropC || DROP; g.fill(q.p); g.restore(); }
    g.fillStyle = q.f; g.fill(q.p);
    if (q.sh) { g.fillStyle = q.sh; g.fill(q.p); }
    if (q.rim) { g.save(); g.clip(q.p); g.translate(0, (q.rimW || 3) * 0.9); g.lineWidth = (q.rimW || 3) * 1.6; g.strokeStyle = q.rim; g.globalAlpha *= 0.7; g.stroke(q.p); g.restore(); }
  }
}
const Sp = (x0, x1, draw, minor = false) => ({ x0, x1, draw, minor });
const partsSp = (parts, x0, x1, extra, minor) => Sp(x0, x1, (g, T, c, o) => { drawParts(g, parts); if (extra) extra(g, T, c, o); }, minor);
const grp = (d, items) => ({ d, items: items.sort((a, b) => a.x0 - b.x0) });
const shadeH = (x0, x1, col, a0, a1) => LG(x0, 0, x1, 0, [[0, rgba(col, a0)], [1, rgba(col, a1)]]);
const shadeV = (y0, y1, col, a0, a1) => LG(0, y0, 0, y1, [[0, rgba(col, a0)], [1, rgba(col, a1)]]);

// 机位走到每个区时的 camX 范围（内容按它 + 视窗半宽生成）
const ZONE_CAM = [[1500, 6200], [5800, 8150], [7750, 9600], [9250, 12100], [11600, 13050]];
function zoneRange(k, d, pad = 260) {
  const [a, b] = ZONE_CAM[k];
  const half = (1060 + pad) / (d * (1 + (0.9 - 1) * Math.min(d, 1)));
  return [a - half, b + half];
}
/** 深度 d 在机位 c 下可见的图层 x 范围。 */
function visX(c, d, pad = 220) {
  const z = 1 + (c.zoom - 1) * d;
  const cx = 960 + (c.x - 960) * d, hw = (960 + pad) / Math.max(0.2, z);
  return [cx - hw, cx + hw];
}

// ———— 通用纸片部件（图层坐标） ————
function roundTree(x, base, h, pal, seed) {
  const r = mulberry32(seed), w = h * (0.62 + r() * 0.18);
  const trunk = poly([[x - w * 0.075, base + 6], [x - w * 0.05, base - h * 0.45], [x + w * 0.05, base - h * 0.45], [x + w * 0.075, base + 6]], { seed, amp: 0.8, step: 14 });
  const cy = base - h * 0.63;
  const crown = blob(x, cy, w * 0.5, h * 0.36, { seed: seed + 1, amp: 0.045, freq: 4 });
  const cL = blob(x - w * 0.27, cy + h * 0.13, w * 0.3, h * 0.22, { seed: seed + 2, amp: 0.05 });
  const cR = blob(x + w * 0.28, cy + h * 0.09, w * 0.3, h * 0.24, { seed: seed + 3, amp: 0.05 });
  const hi = blob(x - w * 0.15, cy - h * 0.13, w * 0.2, h * 0.11, { seed: seed + 4, amp: 0.08 });
  return [
    P(trunk, pal.trunk, { sh: shadeH(x - w * 0.07, x + w * 0.07, PAL.shadow, 0, 0.4), drop: 3 }),
    P(cL, pal.crown2, { drop: 4 }), P(cR, pal.crown2, { drop: 4, sh: shadeH(x, x + w * 0.6, pal.dark, 0, 0.35) }),
    P(crown, pal.crown, { drop: 5, sh: LG(x - w * 0.5, cy - h * 0.36, x + w * 0.5, cy + h * 0.36, [[0, rgba(pal.dark, 0)], [1, rgba(pal.dark, 0.5)]]), rim: pal.rim, rimW: 3 }),
    P(hi, rgba(pal.hi, 0.5)),
  ];
}
function pineTree(x, base, h, pal, seed, snow = 0) {
  const r = mulberry32(seed), w = h * (0.5 + r() * 0.12);
  const parts = [P(pathOf([[x - w * 0.06, base + 6], [x - w * 0.05, base - h * 0.2], [x + w * 0.05, base - h * 0.2], [x + w * 0.06, base + 6]]), pal.trunk, { drop: 2 })];
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const tb = base - h * 0.14 - i * h * 0.2, tw = w * (1 - i * 0.2), tt = tb - h * (0.34 + (i === tiers - 1 ? 0.08 : 0));
    const jag = [];
    const n = 5;
    for (let k = 0; k <= n; k++) jag.push([x + tw / 2 - (k / n) * tw, tb + (k % 2 ? -h * 0.03 : 0)]);
    const pts = [[x, tt], [x + tw * 0.22, tb - h * 0.12], [x + tw / 2, tb], ...jag.slice(1, -1), [x - tw / 2, tb], [x - tw * 0.22, tb - h * 0.12]];
    const tp = poly(pts, { seed: seed + i * 7, amp: 0.9, step: 14, round: 0.15 });
    parts.push(P(tp, i % 2 ? pal.body : pal.body2, { drop: 4, sh: shadeH(x - tw * 0.1, x + tw / 2, pal.dark, 0, 0.55), rim: pal.rim, rimW: 2.4 }));
    if (snow > 0) {
      const sh = h * 0.07 * snow;
      const cap = poly([[x, tt - 1], [x + tw * 0.2, tb - h * 0.13], [x + tw * 0.32, tb - h * 0.07], [x + tw * 0.16, tb - h * 0.1 + sh * 0.5], [x + tw * 0.02, tt + h * 0.12 + sh],
        [x - tw * 0.12, tb - h * 0.12 + sh * 0.4], [x - tw * 0.36, tb - h * 0.06], [x - tw * 0.22, tb - h * 0.13]], { seed: seed + i * 7 + 3, amp: 0.6, step: 10, round: 0.4 });
      parts.push(P(cap, PAL.snow, { sh: shadeH(x - tw / 2, x + tw / 2, PAL.snowShade, 0, 0.7), rim: PAL.white, rimW: 1.6 }));
    }
  }
  return parts;
}
function rock(x, base, w, h, pal, seed, snowCap = 0) {
  const r = mulberry32(seed);
  const pts = [[x - w / 2, base + 4], [x - w * 0.42, base - h * (0.5 + r() * 0.2)], [x - w * 0.18, base - h], [x + w * (0.1 + r() * 0.1), base - h * (0.86 + r() * 0.1)], [x + w * 0.4, base - h * (0.45 + r() * 0.2)], [x + w / 2, base + 4]];
  const p = poly(pts, { seed, amp: 1.4, step: 16, round: 0.45 });
  const parts = [P(p, pal.body, { drop: 4, sh: LG(x - w / 2, base - h, x + w / 2, base, [[0, rgba(pal.dark, 0)], [1, rgba(pal.dark, 0.55)]]), rim: pal.rim, rimW: 2.4 })];
  if (snowCap) parts.push(P(blob(x - w * 0.08, base - h * 0.88, w * 0.36, h * 0.2, { seed: seed + 5, amp: 0.08 }), PAL.snow, { rim: PAL.white, rimW: 1.4, sh: shadeV(base - h, base - h * 0.7, PAL.snowShade, 0, 0.5) }));
  return parts;
}
function bush(x, base, w, h, pal, seed) {
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const bx = x + (k - 1) * w * 0.3, bh = h * (k === 1 ? 1 : 0.75);
    parts.push(P(blob(bx, base - bh * 0.45, w * 0.32, bh * 0.55, { seed: seed + k, amp: 0.06 }), k === 1 ? pal.crown : pal.crown2, { drop: 3, rim: pal.rim, rimW: 2, sh: shadeH(bx - w * 0.3, bx + w * 0.3, pal.dark, 0, 0.4) }));
  }
  return parts;
}
function fence(x0, x1, base, col, seed) {
  const parts = [];
  const rail = new Path2D();
  rail.rect(x0, base - 34, x1 - x0, 6); rail.rect(x0, base - 18, x1 - x0, 6);
  parts.push(P(rail, mixHex(col, PAL.shadow, 0.15), { drop: 2 }));
  for (let x = x0; x <= x1; x += 46) parts.push(P(poly([[x - 4, base + 3], [x - 4, base - 42], [x, base - 47], [x + 4, base - 42], [x + 4, base + 3]], { seed: seed + x, amp: 0.4, step: 8 }), col, { drop: 2, rim: mixHex(col, PAL.paper, 0.45), rimW: 1.4 }));
  return parts;
}
function grassTuft(x, base, h, cols, seed, blades = 5) {
  const r = mulberry32(seed), pts = [];
  const w = h * (0.8 + r() * 0.5);
  pts.push([x - w / 2, base]);
  for (let k = 0; k < blades; k++) {
    const t = (k + 0.5) / blades, bx = x - w / 2 + t * w, bh = h * (0.55 + r() * 0.45) * (1 - Math.abs(t - 0.5) * 0.6);
    pts.push([bx - w / blades * 0.35, base - bh * 0.25], [bx + (r() - 0.5) * w * 0.25, base - bh], [bx + w / blades * 0.35, base - bh * 0.25]);
  }
  pts.push([x + w / 2, base]);
  return pathOf(pts);
}

// ———————————————————— 世界：五个区 ————————————————————
// 区 0 = G+M（城门外坡道 + 草原，同一片天），1 = V 村庄，2 = S 风雪山口，3 = N 月光森林，4 = C 洞口
const Z = [0, 1, 2, 3, 4].map(() => ({ far: [], mid: [], main: [], front: [], fg: [] }));
const DEPTH_FAR = 0.12;

/** 起伏地带（hill band）：顶边 = base − 噪声 − 地势抬升·d。返回 Path2D（图层坐标）。 */
function bandPath(Xa, Xb, d, base, amp, freq, seed, riseK = 1, step = 34) {
  const la = LXd(Xa, d), lb = LXd(Xb, d), n = Math.max(2, Math.ceil((lb - la) / step)), pts = [];
  for (let i = 0; i <= n; i++) {
    const xl = la + ((lb - la) * i) / n, X = 960 + (xl - 960) / d;
    pts.push([xl, base - amp * (0.5 + 0.5 * fbm1(xl * freq, seed)) - rise(X) * d * riseK]);
  }
  return smoothPath([...pts, [lb, 1900], [la, 1900]], { closed: true, tension: 0.35 });
}
/** 锯齿山脉：峰谷交替 + 雪帽。返回 { body, caps[], darks[] }。 */
function rangeBuild(la, lb, base, hR, wR, seed, o = {}) {
  const r = mulberry32(seed);
  const pts = [[la - 60, 1900], [la - 60, base - hR[0] * 0.4]];
  const caps = [], darks = [];
  let x = la - 40;
  while (x < lb + 60) {
    const w = lerp(wR[0], wR[1], r()), h = lerp(hR[0], hR[1], r());
    const vL = [x, base - h * (0.25 + r() * 0.25)], pk = [x + w * (0.45 + r() * 0.1), base - h], vR = [x + w, base - h * (0.2 + r() * 0.3)];
    const s1 = [lerp(vL[0], pk[0], 0.55), lerp(vL[1], pk[1], 0.55) + (r() - 0.5) * 14];
    pts.push(vL, s1, pk);
    if (o.snow && h > o.snowMin) {
      const f = o.snowF ?? 0.3;
      const a = [lerp(pk[0], vL[0], f), lerp(pk[1], vL[1], f)], b = [lerp(pk[0], vR[0], f * 0.9), lerp(pk[1], vR[1], f * 0.9)];
      const zz = [b];
      for (let k = 1; k < 5; k++) { const t = k / 5; zz.push([lerp(b[0], a[0], t), lerp(b[1], a[1], t) + (k % 2 ? 14 : -4) + r() * 8]); }
      caps.push(poly([pk, ...zz, a], { seed: seed + caps.length * 3, amp: 0.8, step: 12, round: 0.2 }));
    }
    if (o.dark) darks.push(pathOf([pk, vR, [vR[0], base + 400], [pk[0] + w * 0.05, base + 400]]));
    x += w;
  }
  pts.push([lb + 60, base - hR[0] * 0.4], [lb + 60, 1900]);
  return { body: poly(pts, { seed, amp: 1.6, step: 24, round: 0.12 }), caps, darks };
}

// —— 城门外的王城（缩小版，与 CASTLE 布局一致：13 塔 x = 300 + 110·i，高 [170,210,250,210]，主堡 i=6，圆窗 (960,430)） ——
// castle.js 尚未提供，这里按 storyboard 4.2 的坐标画一个缩小的远景版（只在 G 区远景出现）。
function miniCastleParts(ox, oy, s, haze, hz) {
  const H = (c) => mixHex(c, haze, hz);
  const T_ = (x, y) => [ox + (x - 960) * s, oy + (y - 880) * s];
  const parts = [];
  parts.push(P(blob(ox, oy + 200 * s, 900 * s, 330 * s, { seed: 611, amp: 0.02 }), H(PAL.meadow), { rim: H(PAL.leafLight), rimW: 2.5, sh: shadeV(oy - 80 * s, oy + 300 * s, H(PAL.grass), 0, 0.6) }));
  const hts = [170, 210, 250, 210];
  for (let i = 0; i < 13; i++) {
    if (i === 6) continue;
    const cx = 300 + 110 * i, h = hts[i % 4], top = 700 - h;
    parts.push(P(pathOf([T_(cx - 35, 880), T_(cx - 35, top), T_(cx + 35, top), T_(cx + 35, 880)]), H(i % 2 ? PAL.stone : mixHex(PAL.stone, PAL.paper, 0.35)), { sh: shadeH(T_(cx - 35, 0)[0], T_(cx + 35, 0)[0], H(PAL.stone2), 0, 0.7) }));
    parts.push(P(pathOf([T_(cx - 44, top + 4), T_(cx, top - 70), T_(cx + 44, top + 4)]), H(i % 2 ? PAL.roof : PAL.roofRed), { rim: H(PAL.white), rimW: 1.2 }));
    parts.push(P(pathOf([T_(cx - 1.6, top - 70), T_(cx - 1.6, top - 120), T_(cx + 1.6, top - 120), T_(cx + 1.6, top - 70)]), H(PAL.woodDark)));
    parts.push(P(pathOf([T_(cx + 1, top - 120), T_(cx + 26, top - 110), T_(cx + 1, top - 100)]), H(PAL.paper)));
  }
  // 主堡 + 尖顶 + 圆窗
  parts.push(P(pathOf([T_(840, 880), T_(840, 300), T_(1080, 300), T_(1080, 880)]), H(mixHex(PAL.stone, PAL.paper, 0.4)), { sh: shadeH(T_(840, 0)[0], T_(1080, 0)[0], H(PAL.stone2), 0, 0.65), rim: H(PAL.white), rimW: 1.5 }));
  parts.push(P(pathOf([T_(820, 306), T_(960, 120), T_(1100, 306)]), H(PAL.roof), { rim: H(PAL.white), rimW: 1.4 }));
  parts.push(P(blob(...T_(960, 430), 70 * s, 70 * s, { seed: 612 }), H(PAL.gold)));
  parts.push(P(blob(...T_(960, 430), 52 * s, 52 * s, { seed: 613 }), H(PAL.crystal)));
  parts.push(P(blob(...T_(960, 430), 22 * s, 22 * s, { seed: 614 }), H(PAL.heart)));
  // 阳台
  parts.push(P(pathOf([T_(850, 590), T_(850, 560), T_(1070, 560), T_(1070, 590)]), H(PAL.stone2)));
  // 城墙 + 垛口 + 城门
  const wall = [T_(260, 880), T_(260, 700)];
  for (let x = 260; x < 1660; x += 60) wall.push(T_(x, 670), T_(x + 40, 670), T_(x + 40, 700), T_(x + 60, 700));
  wall.push(T_(1660, 700), T_(1660, 880));
  parts.push(P(pathOf(wall), H(PAL.stone), { rim: H(PAL.white), rimW: 1.5, sh: shadeV(T_(0, 700)[1], T_(0, 880)[1], H(PAL.stone2), 0, 0.6) }));
  const gate = new Path2D();
  const [gx, gy] = T_(960, 880);
  gate.moveTo(gx - 70 * s, gy); gate.lineTo(gx - 70 * s, gy - 70 * s); gate.arc(gx, gy - 70 * s, 70 * s, Math.PI, 0); gate.lineTo(gx + 70 * s, gy); gate.closePath();
  parts.push(P(gate, H(PAL.woodDark)));
  return parts;
}

// —— 区 0：G + M（正午草原） ——
(function buildM() {
  const k = 0, sky = PAL.skyDayLow;
  // 远：淡远山（0.12）
  {
    const d = DEPTH_FAR, [Xa, Xb] = zoneRange(k, d);
    const rg = rangeBuild(LXd(Xa, d), LXd(Xb, d), 690, [90, 230], [180, 360], 1101, { snow: true, snowMin: 170, snowF: 0.22 });
    const col = mixHex(PAL.mountainFar, sky, 0.42);
    Z[k].far.push(grp(d, [partsSp([P(rg.body, col, { sh: shadeV(430, 700, mixHex(PAL.mountainFar, PAL.mountain, 0.4), 0, 0.35) }), ...rg.caps.map((c) => P(c, mixHex(PAL.snow, sky, 0.3)))], -1e9, 1e9)]));
  }
  // 远：缩小的王城（0.3），机位 1900 时在屏幕左侧，随后向左退去
  {
    const d = 0.3, X = 300, ox = LXd(X, d), oy = 702;
    Z[k].far.push(grp(d, [partsSp(miniCastleParts(ox, oy, 0.35, sky, 0.3), ox - 320, ox + 320, (g, T) => {
      // 塔顶小旗飘
      g.save(); g.fillStyle = rgba(PAL.scarf, 0.85);
      const [fx, fy] = [ox, oy - (880 - 120) * 0.35 - 6];
      g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + 16, fy + 3 + Math.sin(T * 6) * 2); g.lineTo(fx, fy + 7); g.fill(); g.restore();
    })]));
  }
  // 远：近一点的绿丘（0.25 / 0.38）
  for (const [d, base, amp, col, seed] of [[0.25, 660, 70, mixHex(PAL.meadow, PAL.mountainFar, 0.5), 1102], [0.38, 712, 60, mixHex(PAL.meadow, PAL.grass, 0.25), 1103]]) {
    const [Xa, Xb] = zoneRange(k, d);
    const p = bandPath(Xa, Xb, d, base, amp, 0.0022, seed);
    const items = [partsSp([P(p, mixHex(col, sky, d < 0.3 ? 0.25 : 0.08), { rim: mixHex(PAL.leafLight, sky, 0.3), rimW: 2.5, sh: shadeV(base - amp, base + 200, PAL.grassDark, 0, 0.35) })], -1e9, 1e9)];
    if (d > 0.3) {
      const r = mulberry32(seed);
      for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += 60 + r() * 140) {
        const X = 960 + (xl - 960) / d, top = base - amp * (0.5 + 0.5 * fbm1(xl * 0.0022, seed)) - rise(X) * d;
        const s = 0.5 + r() * 0.4;
        items.push(partsSp([P(blob(xl, top + 4 - 16 * s, 16 * s, 18 * s, { seed: Math.round(xl) }), mixHex(PAL.grassDark, sky, 0.2), { drop: 2 })], xl - 20, xl + 20));
      }
    }
    Z[k].far.push(grp(d, items));
  }
  // 中：草坡 0.55 + 树、灌木、石、篱笆、路牌（0.72 / 0.88）；G 区城墙尽头 + 城门塔（0.7）
  const treePal = { trunk: PAL.wood, crown: PAL.grass, crown2: mixHex(PAL.grass, PAL.grassDark, 0.45), dark: PAL.forest, rim: PAL.leafLight, hi: PAL.leafLight };
  const treePal2 = { trunk: PAL.woodDark, crown: mixHex(PAL.meadow, PAL.grass, 0.4), crown2: PAL.grass, dark: PAL.grassDark, rim: PAL.leafLight, hi: PAL.leafLight };
  const bushPal = { crown: PAL.grassDark, crown2: mixHex(PAL.grassDark, PAL.forest, 0.4), dark: PAL.forest, rim: mixHex(PAL.grass, PAL.leafLight, 0.5) };
  const rockPal = { body: PAL.stone, dark: PAL.stoneDark, rim: PAL.white };
  {
    const d = 0.55, [Xa, Xb] = zoneRange(k, d);
    const p = bandPath(Xa, Xb, d, 752, 46, 0.003, 1104);
    const items = [partsSp([P(p, mixHex(PAL.meadow, sky, 0.12), { rim: PAL.leafLight, rimW: 3, sh: shadeV(700, 900, PAL.grass, 0, 0.5) })], -1e9, 1e9)];
    const r = mulberry32(1105);
    for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += 160 + r() * 300) {
      const X = 960 + (xl - 960) / d, top = 752 - 46 * (0.5 + 0.5 * fbm1(xl * 0.003, 1104)) - rise(X) * d;
      if (X < 1500) continue;
      const h = 90 + r() * 70;
      items.push(partsSp(roundTree(xl, top + 18, h, { ...treePal2, crown: mixHex(treePal2.crown, sky, 0.12) }, 2000 + (xl | 0)), xl - h, xl + h, null, true));
    }
    Z[k].mid.push(grp(d, items));
  }
  {
    const d = 0.72, [Xa, Xb] = zoneRange(k, d);
    const items = [];
    const r = mulberry32(1106);
    for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += 220 + r() * 380) {
      const X = 960 + (xl - 960) / d;
      if (X < 1700) continue;
      const base = 812 - rise(X) * d;
      const roll = r();
      if (roll < 0.55) { const h = 190 + r() * 120; items.push(partsSp(roundTree(xl, base, h, roll < 0.3 ? treePal : treePal2, 2100 + (xl | 0)), xl - h * 0.6, xl + h * 0.6)); }
      else if (roll < 0.85) items.push(partsSp(bush(xl, base, 110 + r() * 60, 60 + r() * 30, bushPal, 2200 + (xl | 0)), xl - 100, xl + 100, null, true));
      else items.push(partsSp(rock(xl, base, 80 + r() * 50, 50 + r() * 26, rockPal, 2300 + (xl | 0)), xl - 70, xl + 70, null, true));
    }
    // G 区：城墙尽头 + 圆城门塔（机位 1900 时在画左）
    const wl = LXd(330, d), wr = LXd(1150, d), wy = 812;
    const wall = [[wl - 300, 1000], [wl - 300, wy - 250]];
    for (let x = wl - 300; x < wr - 60; x += 46) wall.push([x, wy - 274], [x + 28, wy - 274], [x + 28, wy - 250], [x + 46, wy - 250]);
    wall.push([wr - 40, wy - 250], [wr - 40, 1000]);
    const towerX = wr - 40;
    const tower = pathOf([[towerX - 70, 1000], [towerX - 70, wy - 340], [towerX + 70, wy - 340], [towerX + 70, 1000]]);
    const tRoof = poly([[towerX - 88, wy - 334], [towerX, wy - 470], [towerX + 88, wy - 334]], { seed: 1107, amp: 1, step: 20 });
    const bricks = new Path2D();
    for (let row = 0; row < 7; row++) for (let x = wl - 300 + (row % 2) * 30; x < towerX - 80; x += 60) bricks.rect(x, wy - 236 + row * 34, 56, 30);
    items.push(partsSp([
      P(pathOf(wall), mixHex(PAL.stone, sky, 0.1), { drop: 5, rim: PAL.white, rimW: 2.5, sh: shadeV(wy - 270, wy + 80, PAL.stone2, 0, 0.7) }),
      P(bricks, rgba(PAL.stone2, 0.35)),
      P(tower, mixHex(PAL.stone, PAL.paper, 0.25), { drop: 6, sh: shadeH(towerX - 70, towerX + 70, PAL.stoneDark, 0, 0.55), rim: PAL.white, rimW: 2.5 }),
      P(tRoof, PAL.roofRed, { drop: 4, rim: mixHex(PAL.roofRed, PAL.white, 0.4), rimW: 2.5, sh: shadeH(towerX - 88, towerX + 88, PAL.redDark, 0, 0.45) }),
      P(blob(towerX, wy - 250, 18, 26, { seed: 1108 }), PAL.woodDark),
    ], wl - 320, towerX + 120, (g, T) => {
      // 塔顶长旗
      const fx = towerX, fy = wy - 470;
      g.save();
      g.strokeStyle = PAL.woodDark; g.lineWidth = 4; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - 70); g.stroke();
      const wv = (i) => Math.sin(T * 6 - i * 1.3) * 5;
      g.fillStyle = PAL.scarf; g.beginPath(); g.moveTo(fx + 2, fy - 70); g.lineTo(fx + 40, fy - 62 + wv(1)); g.lineTo(fx + 78, fy - 58 + wv(2)); g.lineTo(fx + 40, fy - 50 + wv(1)); g.lineTo(fx + 2, fy - 44); g.fill();
      g.restore();
    }));
    Z[k].mid.push(grp(d, items));
  }
  {
    const d = 0.88, [Xa, Xb] = zoneRange(k, d);
    const items = [];
    const r = mulberry32(1109);
    for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += 420 + r() * 520) {
      const X = 960 + (xl - 960) / d;
      if (X < 2000) continue;
      const base = 836;
      const roll = r();
      if (roll < 0.4) { const h = 300 + r() * 120; items.push(partsSp(roundTree(xl, base, h, roll < 0.2 ? treePal : treePal2, 2400 + (xl | 0)), xl - h * 0.6, xl + h * 0.6)); }
      else if (roll < 0.7) { const len = 140 + r() * 180; items.push(partsSp(fence(xl - len / 2, xl + len / 2, base, PAL.wood, 2500 + (xl | 0)), xl - len / 2 - 10, xl + len / 2 + 10, null, true)); }
      else items.push(partsSp(bush(xl, base, 140, 70, bushPal, 2600 + (xl | 0)), xl - 110, xl + 110, null, true));
    }
    // 路牌（指向右：路径画箭头，不写字）
    const sx = LXd(2620, d), sb = 836;
    const board = poly([[sx - 46, sb - 150], [sx + 40, sb - 150], [sx + 62, sb - 128], [sx + 40, sb - 106], [sx - 46, sb - 106]], { seed: 1110, amp: 0.8, step: 14 });
    const arrow = pathOf([[sx - 28, sb - 133], [sx + 10, sb - 133], [sx + 10, sb - 142], [sx + 34, sb - 128], [sx + 10, sb - 114], [sx + 10, sb - 123], [sx - 28, sb - 123]]);
    items.push(partsSp([
      P(pathOf([[sx - 5, sb + 4], [sx - 5, sb - 160], [sx + 5, sb - 160], [sx + 5, sb + 4]]), PAL.woodDark, { drop: 3 }),
      P(board, PAL.wood, { drop: 4, rim: mixHex(PAL.wood, PAL.paper, 0.5), rimW: 2 }), P(arrow, PAL.paper),
    ], sx - 70, sx + 80));
    Z[k].mid.push(grp(d, items));
  }
  // 主体：地面 + 道路 + 碎石 + 路边小花
  buildGround(k, { top: PAL.meadow, deep: PAL.grass, rim: PAL.leafLight, road: PAL.path, roadEdge: PAL.sand, pebble: PAL.stone2, verge: [PAL.heart, PAL.goldLight, PAL.white], seed: 1111, cobble: true });
  // 前景：草丛、高草、蒲公英
  buildFg(k, { cols: [PAL.grassDark, PAL.grass, mixHex(PAL.grass, PAL.leafLight, 0.4)], flowers: [PAL.white, PAL.goldLight], seed: 1112 });
})();

// —— 地面（主体层，depth 1）与前景（1.3）通用构造 ——
function buildGround(k, o) {
  const [Xa, Xb] = zoneRange(k, 1);
  const step = 30, top = [], rTop = [], rBot = [];
  for (let x = Xa; x <= Xb + step; x += step) {
    const gy = journeyGroundY(x);
    top.push([x, gy - 15 + fbm1(x * 0.004, o.seed) * 5]);
    rTop.push([x, gy - 7 + fbm1(x * 0.006, o.seed + 1) * 2.5]);
    rBot.push([x, gy + 34 + fbm1(x * 0.005, o.seed + 2) * 5]);
  }
  const slab = smoothPath([...top, [Xb + step, 1900], [Xa, 1900]], { tension: 0.3 });
  const road = smoothPath([...rTop, ...rBot.slice().reverse()], { tension: 0.3 });
  const edge = new Path2D();
  rBot.forEach(([x, y], i) => (i ? edge.lineTo(x, y) : edge.moveTo(x, y)));
  const items = [Sp(-1e9, 1e9, (g) => {
    drawParts(g, [
      P(slab, o.top, { rim: o.rim, rimW: 3, sh: shadeV(720, 1120, o.deep, 0, 0.85) }),
      P(road, o.road, { sh: shadeV(840, 910, o.roadEdge, 0, 0.75) }),
    ]);
    g.save(); g.strokeStyle = rgba(o.roadEdge, 0.9); g.lineWidth = 3; g.stroke(edge); g.restore();
  })];
  const r = mulberry32(o.seed + 7);
  // 路面碎石 / 石板缝
  for (let x = Xa; x < Xb; x += 34 + r() * 60) {
    const gy = journeyGroundY(x), y = gy + 4 + r() * 24, w = 6 + r() * 10;
    const cob = o.cobble && x < 2050;
    const p = cob ? poly([[x - w, y - 5], [x + w, y - 6], [x + w + 2, y + 4], [x - w - 1, y + 5]], { seed: x | 0, amp: 0.6, step: 6, round: 0.6 }) : blob(x, y, w * 0.6, w * 0.32, { seed: x | 0, amp: 0.1 });
    items.push(partsSp([P(p, cob ? mixHex(o.pebble, o.road, 0.3) : o.pebble, { drop: 1.5 })], x - w - 4, x + w + 4, null, true));
  }
  // 路边小花 / 小草
  if (o.verge) for (let x = Xa; x < Xb; x += 40 + r() * 90) {
    const gy = journeyGroundY(x), y = gy + 50 + r() * 50;
    const col = o.verge[(r() * o.verge.length) | 0];
    items.push(partsSp([
      P(grassTuft(x, y, 16 + r() * 12, null, (x | 0) + 9, 3), o.deep),
      P(blob(x + 3, y - 14, 4, 4, { seed: x | 0 }), col),
    ], x - 20, x + 20, null, true));
  }
  if (o.extra) o.extra(items, r, Xa, Xb);
  Z[k].main.push(grp(1, items));
}
function buildFg(k, o) {
  const d = o.d ?? 1.32, [Xa, Xb] = zoneRange(k, d);
  const r = mulberry32(o.seed);
  const items = [];
  for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += o.gap ? o.gap * (0.7 + r() * 0.6) : 70 + r() * 120) {
    const X = 960 + (xl - 960) / d, base = 1110 - rise(X) * d * 0.98 + r() * 30;
    if (o.make) { const it = o.make(xl, base, r, X); if (it) items.push(it); continue; }
    const h = 90 + r() * 120, col = o.cols[(r() * o.cols.length) | 0];
    const parts = [P(grassTuft(xl, base, h, null, (xl | 0) + 3, 5 + ((r() * 3) | 0)), col, { drop: 4 })];
    if (o.flowers && r() < 0.35) {
      const fx = xl + (r() - 0.5) * 40, fy = base - h * 0.85;
      parts.push(P(blob(fx, fy, 9, 9, { seed: xl | 0, amp: 0.15, freq: 5 }), o.flowers[(r() * o.flowers.length) | 0], { rim: PAL.white, rimW: 1.2 }));
    }
    const sway = r() * TAU;
    items.push(Sp(xl - h, xl + h, (g, T) => {
      g.save(); g.translate(xl, base); g.rotate(Math.sin(T * 1.6 + sway) * 0.04); g.translate(-xl, -base);
      drawParts(g, parts); g.restore();
    }));
  }
  Z[k].fg.push(grp(d, items));
}

// —— 区 1：V（金色午后的村庄） ——
// 容器（宝箱、陶罐、木桶、花盆、大宝箱）的世界 x = 开箱那一刻勇者世界 x + 180；屋门对着容器（主人站门口）。
const CONTAINERS = OPEN_AT.map((t, i) => Object.freeze({ kind: KINDS[i], at: t, x: Math.round(heroJourneyX(t) + 180), y: journeyGroundY(heroJourneyX(t) + 180), item: ITEMS[i] }));
const HOUSE_D = 0.95;
const HOUSES = (() => {
  // 开箱的五户：门在容器右侧 70px 处（开箱那一刻的屏幕位置反解成 0.95 层的「镜头居中 X」）
  const out = CONTAINERS.map((cn, i) => {
    const [cx, , z] = camBase(cn.at);
    const sx = 960 + (cn.x - cx) * z + 70;
    const zd = 1 + (z - 1) * HOUSE_D;
    const X = cx + (sx - 960) / (HOUSE_D * zd);
    return { X, w: [230, 210, 200, 220, 260][i], h: [170, 160, 150, 166, 190][i], roof: [PAL.roofRed, PAL.roof, PAL.roofRed, mixHex(PAL.roof, PAL.roofRed, 0.0), PAL.roofRed][i], owner: true, i };
  });
  // 村口和风车旁的几户
  for (const [X, w, h, roof] of [[5960, 210, 150, PAL.roof], [6230, 240, 175, PAL.roofRed], [7860, 220, 160, PAL.roof], [8080, 200, 150, PAL.roofRed]]) out.push({ X, w, h, roof, owner: false });
  return out.sort((a, b) => a.X - b.X).map(Object.freeze);
})();
function cottage(x, base, w, h, roofCol, seed) {
  const r = mulberry32(seed);
  const wallTop = base - h;
  const parts = [];
  const wall = poly([[x - w / 2, base + 4], [x - w / 2, wallTop], [x + w / 2, wallTop], [x + w / 2, base + 4]], { seed, amp: 0.8, step: 20 });
  parts.push(P(wall, mixHex(PAL.paper, PAL.goldLight, 0.18), { drop: 6, sh: LG(x - w / 2, 0, x + w / 2, 0, [[0, rgba(PAL.sand, 0)], [1, rgba(PAL.sand, 0.65)]]), rim: PAL.white, rimW: 2 }));
  // 木筋
  const beams = new Path2D();
  beams.rect(x - w / 2, wallTop, w, 7); beams.rect(x - w / 2, base - h * 0.48, w, 6);
  beams.rect(x - w / 2 + 6, wallTop, 7, h); beams.rect(x + w / 2 - 13, wallTop, 7, h);
  parts.push(P(beams, mixHex(PAL.wood, PAL.paper, 0.15)));
  // 圆门（主人站这）
  const door = new Path2D();
  const dx = x - w * 0.12, dw = 30, dh = 92;
  door.moveTo(dx - dw, base + 2); door.lineTo(dx - dw, base - dh + dw); door.arc(dx, base - dh + dw, dw, Math.PI, 0); door.lineTo(dx + dw, base + 2); door.closePath();
  parts.push(P(door, PAL.woodDark, { rim: mixHex(PAL.wood, PAL.paper, 0.3), rimW: 2 }));
  parts.push(P(blob(dx + dw * 0.55, base - dh * 0.42, 3.4, 3.4, { seed: seed + 1 }), PAL.gold));
  // 圆窗（暖光）+ 花箱
  const wx = x + w * 0.24, wy = base - h * 0.62, wr = 22;
  parts.push(P(blob(wx, wy, wr + 6, wr + 6, { seed: seed + 2 }), PAL.wood));
  parts.push(P(blob(wx, wy, wr, wr, { seed: seed + 3 }), PAL.goldLight, { sh: LG(wx - wr, wy - wr, wx + wr, wy + wr, [[0, rgba(PAL.white, 0.5)], [1, rgba(PAL.gold, 0.6)]]) }));
  const cross = new Path2D(); cross.rect(wx - 2, wy - wr, 4, 2 * wr); cross.rect(wx - wr, wy - 2, 2 * wr, 4);
  parts.push(P(cross, PAL.wood));
  parts.push(P(pathOf([[wx - 30, wy + wr + 4], [wx + 30, wy + wr + 4], [wx + 26, wy + wr + 18], [wx - 26, wy + wr + 18]]), PAL.woodDark));
  for (let k = 0; k < 5; k++) parts.push(P(blob(wx - 22 + k * 11, wy + wr + 2, 6, 6, { seed: seed + 10 + k, amp: 0.15, freq: 5 }), [PAL.heart, PAL.princess, PAL.gold, PAL.heart, PAL.princessLight][k]));
  // 烟囱 + 屋顶
  const chx = x + w * (0.18 + r() * 0.1);
  parts.push(P(pathOf([[chx - 14, wallTop - 20], [chx - 14, wallTop - h * 0.72], [chx + 14, wallTop - h * 0.72], [chx + 14, wallTop - 20]]), PAL.stone2, { drop: 3, rim: PAL.white, rimW: 1.6 }));
  const roof = poly([[x - w / 2 - 22, wallTop + 10], [x - w * 0.1, wallTop - h * 0.7], [x + w * 0.08, wallTop - h * 0.74], [x + w / 2 + 22, wallTop + 10]], { seed: seed + 4, amp: 1.2, step: 18, round: 0.25 });
  parts.push(P(roof, roofCol, { drop: 5, sh: LG(x - w / 2, wallTop - h * 0.7, x + w / 2, wallTop + 10, [[0, rgba(PAL.shadow, 0)], [1, rgba(PAL.shadow, 0.35)]]), rim: mixHex(roofCol, PAL.white, 0.45), rimW: 3 }));
  // 瓦片线
  const tiles = new Path2D();
  for (let k = 1; k < 4; k++) { const yy = lerp(wallTop - h * 0.68, wallTop + 6, k / 4); const half = lerp(w * 0.12, w / 2 + 18, k / 4); tiles.moveTo(x - half, yy); tiles.lineTo(x + half, yy); }
  const smoke = [chx, wallTop - h * 0.72];
  return { parts, tiles, smoke, door: [dx, base] };
}
function windmillParts(x, base) {
  const parts = [];
  const tower = poly([[x - 92, base + 4], [x - 62, base - 300], [x + 62, base - 300], [x + 92, base + 4]], { seed: 1201, amp: 1, step: 22 });
  parts.push(P(tower, mixHex(PAL.paper, PAL.goldLight, 0.15), { drop: 7, sh: LG(x - 92, 0, x + 92, 0, [[0, rgba(PAL.sand, 0)], [1, rgba(PAL.earth, 0.5)]]), rim: PAL.white, rimW: 2.5 }));
  const stones = new Path2D();
  for (let row = 0; row < 6; row++) for (let k = 0; k < 4; k++) { const yy = base - 24 - row * 46, xx = x - 60 + k * 34 + (row % 2) * 16 - row * 2; stones.rect(xx, yy, 22, 12); }
  parts.push(P(stones, rgba(PAL.sand, 0.45)));
  const door = new Path2D(); door.moveTo(x - 26, base + 2); door.lineTo(x - 26, base - 54); door.arc(x, base - 54, 26, Math.PI, 0); door.lineTo(x + 26, base + 2); door.closePath();
  parts.push(P(door, PAL.woodDark));
  parts.push(P(blob(x, base - 170, 18, 22, { seed: 1202 }), PAL.goldLight, { sh: shadeV(base - 192, base - 148, PAL.gold, 0, 0.6) }));
  const cap = poly([[x - 84, base - 292], [x - 50, base - 368], [x, base - 392], [x + 50, base - 368], [x + 84, base - 292]], { seed: 1203, amp: 1, step: 16, round: 0.5 });
  parts.push(P(cap, PAL.roofRed, { drop: 4, rim: mixHex(PAL.roofRed, PAL.white, 0.45), rimW: 3, sh: shadeH(x - 84, x + 84, PAL.redDark, 0, 0.5) }));
  return parts;
}
function windmillBlades(g, x, hubY, ang) {
  g.save();
  g.translate(x, hubY);
  for (let k = 0; k < 4; k++) {
    g.save(); g.rotate(ang + (k * Math.PI) / 2);
    g.fillStyle = DROP; g.fillRect(-4 + 2, 4, 8, 210);
    g.fillStyle = PAL.wood; g.fillRect(-5, 0, 10, 214);
    const sail = pathOf([[6, 40], [62, 46], [62, 206], [6, 210]]);
    g.fillStyle = mixHex(PAL.paper, PAL.goldLight, 0.2); g.fill(sail);
    g.fillStyle = LG(6, 0, 62, 0, [[0, rgba(PAL.sand, 0)], [1, rgba(PAL.sand, 0.55)]]); g.fill(sail);
    g.strokeStyle = PAL.wood; g.lineWidth = 3;
    g.beginPath(); for (let j = 0; j < 5; j++) { const yy = 44 + j * 40; g.moveTo(6, yy); g.lineTo(62, yy + 1); } g.moveTo(34, 42); g.lineTo(34, 208); g.stroke();
    g.restore();
  }
  g.fillStyle = PAL.woodDark; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill();
  g.fillStyle = PAL.gold; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
  g.restore();
}
/** 风车转角：90.15 起 0.6s 加速到 1.6 rad/s。 */
function windmillAngle(T, at) {
  const t = T - at, w = 1.6, ta = 0.6;
  return 0.35 + (t <= 0 ? 0 : t < ta ? (w * t * t) / (2 * ta) : w * (t - ta / 2));
}
function smokePuffs(g, x, y, T, seed, col = PAL.paper2) {
  for (let i = 0; i < 5; i++) {
    const ph = fract(T * 0.32 + i / 5 + hash2(seed, 1));
    const px = x + ph * 70 + Math.sin(ph * 5 + seed) * 10, py = y - ph * 170;
    g.fillStyle = rgba(col, 0.75 * (1 - ph) * Math.min(1, ph * 6));
    g.fill(blob(px, py, 14 + ph * 26, 11 + ph * 20, { seed: seed + i, amp: 0.08 }));
  }
}
function pigeon(g, x, y, s, flap, face) {
  g.save(); g.translate(x, y); g.scale(s * face, s);
  const wing = Math.sin(flap);
  g.fillStyle = PAL.white;
  g.beginPath(); g.ellipse(0, 0, 16, 8, -0.1, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(15, -5, 6, 5, 0, 0, TAU); g.fill();
  g.fillStyle = PAL.stone2; g.beginPath(); g.moveTo(-14, -1); g.lineTo(-26, -6); g.lineTo(-24, 4); g.fill();
  g.fillStyle = mixHex(PAL.white, PAL.stone, 0.3);
  g.beginPath(); g.moveTo(-4, -2); g.quadraticCurveTo(-6, -2 - wing * 26, 10, -4 - wing * 30); g.quadraticCurveTo(8, -6, 6, -2); g.closePath(); g.fill();
  g.fillStyle = PAL.gold; g.beginPath(); g.moveTo(20, -5); g.lineTo(25, -3.5); g.lineTo(20, -2.5); g.fill();
  g.fillStyle = PAL.ink; g.beginPath(); g.arc(16.5, -6, 1.2, 0, TAU); g.fill();
  g.restore();
}
(function buildV() {
  const k = 1, sky = mixHex(PAL.skyDusk, PAL.goldLight, 0.5);
  {
    const d = DEPTH_FAR, [Xa, Xb] = zoneRange(k, d);
    const rg = rangeBuild(LXd(Xa, d), LXd(Xb, d), 690, [80, 200], [200, 380], 1301, {});
    Z[k].far.push(grp(d, [partsSp([P(rg.body, mixHex(PAL.mountainFar, PAL.skyDusk, 0.45), { sh: shadeV(480, 700, PAL.skyDuskHigh, 0, 0.25) })], -1e9, 1e9)]));
  }
  // 金色丘陵 + 拼布田（0.28）
  {
    const d = 0.28, [Xa, Xb] = zoneRange(k, d);
    const p = bandPath(Xa, Xb, d, 668, 90, 0.0024, 1302);
    const fields = new Path2D(), fields2 = new Path2D(), hedge = new Path2D();
    const r = mulberry32(1303);
    for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += 70 + r() * 70) {
      const y0 = 600 + r() * 120, w = 60 + r() * 60, h = 26 + r() * 30, sk = (r() - 0.5) * 30;
      const f = r() < 0.5 ? fields : fields2;
      f.moveTo(xl, y0); f.lineTo(xl + w, y0 + sk * 0.3); f.lineTo(xl + w + sk, y0 + h); f.lineTo(xl + sk, y0 + h); f.closePath();
      hedge.moveTo(xl, y0 + h + 2); hedge.lineTo(xl + w + sk, y0 + h + 2);
    }
    Z[k].far.push(grp(d, [Sp(-1e9, 1e9, (g) => {
      drawParts(g, [P(p, mixHex(PAL.meadow, PAL.gold, 0.45), { rim: PAL.goldLight, rimW: 3, sh: shadeV(560, 900, PAL.earth, 0, 0.35) })]);
      g.save(); g.clip(p);
      g.fillStyle = rgba(PAL.gold, 0.45); g.fill(fields);
      g.fillStyle = rgba(PAL.leafLight, 0.45); g.fill(fields2);
      g.strokeStyle = rgba(PAL.grassDark, 0.45); g.lineWidth = 4; g.setLineDash([3, 6]); g.stroke(hedge);
      g.restore();
    })]));
  }
  const goldTree = { trunk: PAL.wood, crown: mixHex(PAL.leafLight, PAL.gold, 0.45), crown2: mixHex(PAL.grass, PAL.gold, 0.35), dark: PAL.earth, rim: PAL.goldLight, hi: PAL.goldLight };
  const goldTree2 = { trunk: PAL.woodDark, crown: mixHex(PAL.grass, PAL.gold, 0.25), crown2: mixHex(PAL.grassDark, PAL.gold, 0.2), dark: PAL.forest, rim: PAL.goldLight, hi: PAL.leafLight };
  {
    const d = 0.55, [Xa, Xb] = zoneRange(k, d);
    const p = bandPath(Xa, Xb, d, 756, 40, 0.003, 1304);
    const items = [partsSp([P(p, mixHex(PAL.meadow, PAL.gold, 0.32), { rim: PAL.goldLight, rimW: 3, sh: shadeV(700, 900, PAL.earth, 0, 0.4) })], -1e9, 1e9)];
    const r = mulberry32(1305);
    for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += 150 + r() * 260) {
      const X = 960 + (xl - 960) / d, top = 756 - 40 * (0.5 + 0.5 * fbm1(xl * 0.003, 1304)) - rise(X) * d;
      if (r() < 0.45) { const s = 0.7 + r() * 0.4; items.push(partsSp([P(blob(xl, top + 6 - 30 * s, 40 * s, 34 * s, { seed: xl | 0 }), PAL.gold, { drop: 3, rim: PAL.goldLight, rimW: 2, sh: shadeH(xl - 40 * s, xl + 40 * s, PAL.goldDark, 0, 0.6) })], xl - 50, xl + 50, null, true)); }
      else { const h = 100 + r() * 60; items.push(partsSp(roundTree(xl, top + 18, h, goldTree, 3000 + (xl | 0)), xl - h, xl + h, null, true)); }
    }
    Z[k].mid.push(grp(d, items));
  }
  // 风车（0.8，机位 6400 时在画面正中；V09 90.15 开始转）+ 纸鸽
  {
    const d = 0.8, X = JOURNEY_FIXED.windmill.x, x = LXd(X, d), base = 806;
    const items = [partsSp(windmillParts(x, base), x - 300, x + 300, (g, T, c, o) => {
      windmillBlades(g, x, base - 330, windmillAngle(T, o.windmillAt ?? V09));
      // 纸鸽：从风车旁飞起
      const t = T - (o.windmillAt ?? V09);
      if (t >= 0 && t < 3.6) for (let i = 0; i < 7; i++) {
        const ti = t - i * 0.06;
        if (ti < 0) continue;
        const px = x - 120 + i * 40 + ti * (180 + hash2(1310, i) * 160), py = base - 60 - i * 8 - ti * (230 + hash2(1311, i) * 120) + 30 * ti * ti;
        pigeon(g, px, py, 1.15 + hash2(1312, i) * 0.4, T * 22 + i * 1.7, 1);
      }
    })];
    const r = mulberry32(1306);
    const [Xa, Xb] = zoneRange(k, d);
    for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += 260 + r() * 360) {
      if (Math.abs(xl - x) < 260) continue;
      const h = 200 + r() * 110; items.push(partsSp(roundTree(xl, base + 6, h, r() < 0.5 ? goldTree : goldTree2, 3100 + (xl | 0)), xl - h * 0.6, xl + h * 0.6));
    }
    Z[k].mid.push(grp(d, items));
  }
  // 小屋（0.95）
  {
    const d = HOUSE_D, base = 838;
    const items = [];
    HOUSES.forEach((h, i) => {
      const x = LXd(h.X, d);
      const ck = cottage(x, base, h.w, h.h, h.roof, 3200 + i * 17);
      items.push(partsSp(ck.parts, x - h.w, x + h.w, (g, T) => {
        g.save(); g.strokeStyle = rgba(PAL.shadow, 0.18); g.lineWidth = 2; g.stroke(ck.tiles); g.restore();
        smokePuffs(g, ck.smoke[0], ck.smoke[1], T, 3300 + i * 7);
      }));
      if (!h.owner) items.push(partsSp(fence(x + h.w / 2 + 20, x + h.w / 2 + 200, base, PAL.wood, 3400 + i), x + h.w / 2, x + h.w / 2 + 220, null, true));
    });
    Z[k].mid.push(grp(d, items));
  }
  buildGround(k, { top: mixHex(PAL.meadow, PAL.gold, 0.3), deep: mixHex(PAL.grass, PAL.earth, 0.3), rim: PAL.goldLight, road: PAL.sand, roadEdge: PAL.earth, pebble: mixHex(PAL.stone2, PAL.earth, 0.3), verge: [PAL.heart, PAL.princess, PAL.gold, PAL.white], seed: 1307 });
  // 前景花田（1.25，摇曳）+ 纸蝴蝶
  buildFg(k, {
    d: 1.25, seed: 1308, gap: 46,
    make: (xl, base, r) => {
      const parts = [];
      const n = 3 + ((r() * 3) | 0);
      for (let j = 0; j < n; j++) {
        const fx = xl + (j - n / 2) * 16 + r() * 8, h = 70 + r() * 110, fy = base - h;
        parts.push({ stem: [fx, base, fx + (r() - 0.5) * 18, fy], col: [PAL.heart, PAL.princess, PAL.gold, PAL.princessLight, PAL.white][(r() * 5) | 0], s: 9 + r() * 7, seed: (xl | 0) + j });
      }
      const leaf = grassTuft(xl, base, 60 + r() * 30, null, (xl | 0) + 77, 4);
      const sway = r() * TAU;
      return Sp(xl - 60, xl + 60, (g, T) => {
        const a = Math.sin(T * 1.8 + sway) * 0.07;
        g.save(); g.translate(xl, base); g.rotate(a * 0.4); g.translate(-xl, -base);
        g.fillStyle = mixHex(PAL.grass, PAL.gold, 0.2); g.fill(leaf);
        g.restore();
        for (const f of parts) {
          const [x0, y0, x1, y1] = f.stem, ex = x1 + Math.sin(T * 1.8 + sway + f.seed) * 8;
          g.save(); g.strokeStyle = PAL.grassDark; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0, (y0 + y1) / 2, ex, y1); g.stroke();
          g.translate(ex, y1);
          g.fillStyle = DROP; g.fill(blob(2, 3, f.s, f.s, { seed: f.seed, amp: 0.18, freq: 5 }));
          g.fillStyle = f.col; g.fill(blob(0, 0, f.s, f.s, { seed: f.seed, amp: 0.18, freq: 5 }));
          g.fillStyle = PAL.goldLight; g.beginPath(); g.arc(0, 0, f.s * 0.35, 0, TAU); g.fill();
          g.restore();
        }
      });
    },
  });
  Z[k].fg.push(grp(1.2, [Sp(-1e9, 1e9, (g, T, c) => {
    // 纸蝴蝶（屏幕附近循环飞）
    const [a] = visX(c, 1.2);
    for (let i = 0; i < 3; i++) {
      const cyc = 7 + i * 2.3, ph = fract(T / cyc + i * 0.37);
      const bx = a + 300 + i * 620 + Math.sin(T * 0.9 + i) * 120 + ph * 300, by = 760 + Math.sin(T * 1.7 + i * 2) * 60 - i * 40;
      const f = Math.abs(Math.sin(T * 13 + i * 3));
      g.save(); g.translate(bx, by); g.rotate(Math.sin(T * 2 + i) * 0.3);
      const col = [PAL.princess, PAL.goldLight, PAL.crystal][i];
      g.scale(0.25 + f * 0.75, 1);
      g.fillStyle = col; g.fill(blob(-9, -6, 9, 11, { seed: 1320 + i })); g.fill(blob(9, -6, 9, 11, { seed: 1321 + i }));
      g.fillStyle = mixHex(col, PAL.white, 0.3); g.fill(blob(-7, 7, 6, 7, { seed: 1322 + i })); g.fill(blob(7, 7, 6, 7, { seed: 1323 + i }));
      g.restore();
      g.fillStyle = PAL.ink; g.fillRect(bx - 1.2, by - 10, 2.4, 20);
    }
  })]));
})();

// —— 区 2：S（风雪山口） ——
(function buildS() {
  const k = 2, sky = mixHex(PAL.skyDayLow, PAL.snowShade, 0.5);
  {
    const d = DEPTH_FAR, [Xa, Xb] = zoneRange(k, d);
    const rg = rangeBuild(LXd(Xa, d), LXd(Xb, d), 660, [140, 300], [180, 320], 1401, { snow: true, snowMin: 0, snowF: 0.4 });
    Z[k].far.push(grp(d, [partsSp([P(rg.body, mixHex(PAL.snowShade, sky, 0.45)), ...rg.caps.map((c) => P(c, mixHex(PAL.snow, sky, 0.25)))], -1e9, 1e9)]));
  }
  // 大雪山（0.28），最高那座插红旗（立誓之山）
  {
    const d = 0.28, [Xa, Xb] = zoneRange(k, d);
    const rg = rangeBuild(LXd(Xa, d), LXd(Xb, d), 720, [180, 330], [260, 420], 1402, { snow: true, snowMin: 150, snowF: 0.36, dark: true });
    const fx = LXd(8800, d), fBase = 720, fTop = 110;
    const flagMt = poly([[fx - 380, fBase + 40], [fx - 210, fBase - 240], [fx - 150, fBase - 210], [fx - 40, fTop + 40], [fx, fTop], [fx + 60, fTop + 70], [fx + 120, fBase - 330], [fx + 170, fBase - 300], [fx + 400, fBase + 40]], { seed: 1403, amp: 1.4, step: 22, round: 0.1 });
    const flagCap = poly([[fx, fTop], [fx + 60, fTop + 70], [fx + 96, fTop + 150], [fx + 62, fTop + 132], [fx + 40, fTop + 168], [fx + 10, fTop + 140], [fx - 20, fTop + 180], [fx - 44, fTop + 132], [fx - 78, fTop + 160], [fx - 40, fTop + 40]], { seed: 1404, amp: 1, step: 14, round: 0.25 });
    const flagDark = pathOf([[fx, fTop], [fx + 60, fTop + 70], [fx + 120, fBase - 330], [fx + 170, fBase - 300], [fx + 400, fBase + 40], [fx + 30, fBase + 40]]);
    const items = [partsSp([
      P(rg.body, mixHex(PAL.mountain, sky, 0.3), { sh: shadeV(380, 760, PAL.mountainDark, 0, 0.3) }),
      ...rg.darks.map((p) => P(p, rgba(PAL.mountainDark, 0.35))),
      ...rg.caps.map((c) => P(c, mixHex(PAL.snow, sky, 0.1), { rim: PAL.white, rimW: 1.5 })),
    ], -1e9, 1e9), partsSp([
      P(flagMt, mixHex(PAL.mountain, sky, 0.2), { drop: 5, rim: PAL.white, rimW: 3 }),
      P(flagDark, rgba(PAL.mountainDark, 0.45)),
      P(flagCap, PAL.snow, { rim: PAL.white, rimW: 2, sh: LG(fx - 80, 0, fx + 100, 0, [[0, rgba(PAL.snowShade, 0)], [1, rgba(PAL.snowShade, 0.6)]]) }),
    ], fx - 420, fx + 420, (g, T) => {
      // 峰顶 scarf 小红旗（立誓之山）
      g.save();
      g.strokeStyle = PAL.woodDark; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(fx, fTop + 4); g.lineTo(fx, fTop - 62); g.stroke();
      const wv = (i) => Math.sin(T * 9 - i * 1.4) * 5;
      g.fillStyle = PAL.scarf;
      g.beginPath(); g.moveTo(fx + 2, fTop - 62); g.lineTo(fx + 26, fTop - 56 + wv(1)); g.lineTo(fx + 52, fTop - 50 + wv(2)); g.lineTo(fx + 26, fTop - 44 + wv(1)); g.lineTo(fx + 2, fTop - 36); g.fill();
      g.restore();
    })];
    Z[k].far.push(grp(d, items));
  }
  // 近一点的雪岭（0.42）+ 小黑松点
  {
    const d = 0.42, [Xa, Xb] = zoneRange(k, d);
    const p = bandPath(Xa, Xb, d, 716, 70, 0.0028, 1405);
    const items = [partsSp([P(p, mixHex(PAL.snow, PAL.snowShade, 0.45), { rim: PAL.white, rimW: 3, sh: shadeV(600, 900, PAL.snowShade, 0, 0.6) })], -1e9, 1e9)];
    const r = mulberry32(1406);
    for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += 40 + r() * 80) {
      const X = 960 + (xl - 960) / d, top = 716 - 70 * (0.5 + 0.5 * fbm1(xl * 0.0028, 1405)) - rise(X) * d;
      const h = 40 + r() * 40;
      items.push(partsSp([P(pathOf([[xl - h * 0.25, top + 10], [xl, top + 10 - h], [xl + h * 0.25, top + 10]]), mixHex(PAL.forestDeep, sky, 0.35))], xl - 30, xl + 30, null, true));
    }
    Z[k].far.push(grp(d, items));
  }
  const snowPine = { trunk: PAL.woodDark, body: PAL.forest, body2: mixHex(PAL.forest, PAL.forestDeep, 0.4), dark: PAL.forestDeep, rim: mixHex(PAL.forest, PAL.snow, 0.4) };
  const snowRock = { body: mixHex(PAL.stone2, PAL.mountain, 0.3), dark: PAL.mountainDark, rim: PAL.white };
  {
    const d = 0.6, [Xa, Xb] = zoneRange(k, d);
    const p = bandPath(Xa, Xb, d, 760, 50, 0.0032, 1407);
    Z[k].mid.push(grp(d, [partsSp([P(p, PAL.snow, { rim: PAL.white, rimW: 3, sh: shadeV(680, 920, PAL.snowShade, 0.1, 0.8) })], -1e9, 1e9)]));
  }
  for (const [d, gap, hR, base0, seed] of [[0.76, [160, 300], [200, 330], 812, 1408], [0.92, [380, 520], [320, 440], 840, 1409]]) {
    const [Xa, Xb] = zoneRange(k, d);
    const items = [];
    const r = mulberry32(seed);
    for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += lerp(gap[0], gap[1], r())) {
      const X = 960 + (xl - 960) / d, base = base0 - rise(X) * d * 1.0;
      if (r() < 0.7) { const h = lerp(hR[0], hR[1], r()); items.push(partsSp(pineTree(xl, base, h, snowPine, 4000 + (xl | 0), 1), xl - h * 0.4, xl + h * 0.4)); }
      else items.push(partsSp(rock(xl, base, 120 + r() * 80, 70 + r() * 40, snowRock, 4100 + (xl | 0), 1), xl - 110, xl + 110, null, true));
    }
    Z[k].mid.push(grp(d, items));
  }
  buildGround(k, {
    top: PAL.snow, deep: mixHex(PAL.snowShade, PAL.snow, 0.3), rim: PAL.white, road: mixHex(PAL.snowShade, PAL.snow, 0.42), roadEdge: PAL.snowShade, pebble: PAL.ice, seed: 1410,
    extra: (items, r, Xa, Xb) => {
      // 蹄印
      for (let x = Xa; x < Xb; x += 52 + r() * 30) { const y = journeyGroundY(x) + 12 + r() * 14; items.push(partsSp([P(blob(x, y, 9, 4, { seed: x | 0 }), rgba(PAL.snowShade, 0.9))], x - 12, x + 12, null, true)); }
    },
  });
  buildFg(k, {
    d: 1.3, seed: 1411, gap: 150,
    make: (xl, base, r) => {
      const w = 180 + r() * 160, h = 70 + r() * 70;
      const parts = [P(blob(xl, base - h * 0.2, w / 2, h, { seed: xl | 0, amp: 0.06 }), PAL.snow, { drop: 5, rim: PAL.white, rimW: 3, sh: shadeV(base - h, base, PAL.snowShade, 0, 0.75) })];
      if (r() < 0.5) for (let j = 0; j < 4; j++) { const bx = xl - w * 0.3 + j * w * 0.18; parts.push(P(pathOf([[bx - 4, base - h * 0.7], [bx + (r() - 0.5) * 20, base - h * 1.5 - r() * 40], [bx + 4, base - h * 0.7]]), mixHex(PAL.ice, PAL.snowShade, 0.4))); }
      return partsSp(parts, xl - w / 2, xl + w / 2);
    },
  });
})();

// —— 区 3：N（月光森林） ——
function moonScreen(T, c, o = {}) {
  const k = o.moonRise ?? outCubic(seg(T, MOON_RISE[0], MOON_RISE[1]));
  const px = MOON.x - (c.x - 9500) * 0.05 * c.zoom, py = lerp(MOON.y0, MOON.y1, k) - (c.y - 540) * 0.05;
  return [px, py, k];
}
function drawMoon(g, x, y, R) {
  const disk = blob(x, y, R, R, { seed: 1501, amp: 0.006, n: 96 });
  g.save();
  g.fillStyle = PAL.moon; g.fill(disk);
  g.fillStyle = LG(x - R, y - R, x + R, y + R, [[0, rgba(PAL.white, 0.45)], [0.6, rgba(PAL.moonGlow, 0)], [1, rgba(PAL.moonGlow, 0.65)]]); g.fill(disk);
  g.fillStyle = rgba(PAL.moonGlow, 0.55);
  for (const [dx, dy, r] of [[-0.35, -0.2, 0.2], [0.22, 0.28, 0.14], [0.3, -0.34, 0.09], [-0.12, 0.42, 0.08], [0.45, 0.05, 0.07]]) g.fill(blob(x + dx * R, y + dy * R, r * R, r * R * 0.85, { seed: 1502 + Math.round(dx * 100), amp: 0.08 }));
  g.save(); g.clip(disk); g.translate(0, 6); g.lineWidth = 9; g.strokeStyle = rgba(PAL.white, 0.6); g.stroke(disk); g.restore();
  g.restore();
}
(function buildN() {
  const k = 3, sky = PAL.skyNight;
  // 月亮从山脊后升起：月亮在 LAYERS.far 里先画（屏幕空间），再画这些山脊与林影
  {
    const d = 0.15, [Xa, Xb] = zoneRange(k, d);
    const p = bandPath(Xa, Xb, d, 640, 90, 0.002, 1601, 0.6);
    Z[k].far.push(grp(d, [partsSp([P(p, mixHex(PAL.skyNight, PAL.mountainDark, 0.5), { rim: rgba(PAL.moonGlow, 0.5), rimW: 2.5 })], -1e9, 1e9)]));
  }
  for (const [d, base, hR, col, seed] of [[0.3, 700, [120, 210], mixHex(PAL.forestDeep, PAL.skyNight, 0.55), 1602], [0.45, 740, [150, 260], mixHex(PAL.forestDeep, PAL.skyNight, 0.3), 1603]]) {
    const [Xa, Xb] = zoneRange(k, d);
    const r = mulberry32(seed);
    const p = new Path2D();
    const la = LXd(Xa, d), lb = LXd(Xb, d);
    const rim = new Path2D();
    for (let xl = la; xl < lb; xl += 26 + r() * 30) {
      const X = 960 + (xl - 960) / d, h = lerp(hR[0], hR[1], r()), w = h * 0.34, b = base - rise(X) * d * 0.6;
      p.moveTo(xl - w, b + 10); p.lineTo(xl - w * 0.55, b - h * 0.45); p.lineTo(xl - w * 0.7, b - h * 0.42); p.lineTo(xl - w * 0.3, b - h * 0.75); p.lineTo(xl - w * 0.42, b - h * 0.72); p.lineTo(xl, b - h); p.lineTo(xl + w * 0.42, b - h * 0.72); p.lineTo(xl + w * 0.3, b - h * 0.75); p.lineTo(xl + w * 0.7, b - h * 0.42); p.lineTo(xl + w * 0.55, b - h * 0.45); p.lineTo(xl + w, b + 10); p.closePath();
      rim.moveTo(xl - w * 0.3, b - h * 0.75); rim.lineTo(xl, b - h);
    }
    p.rect(la - 50, base - 40, lb - la + 100, 1400);
    Z[k].far.push(grp(d, [Sp(-1e9, 1e9, (g) => {
      g.fillStyle = col; g.fill(p);
      g.save(); g.strokeStyle = rgba(PAL.moonGlow, d > 0.4 ? 0.35 : 0.2); g.lineWidth = 2; g.stroke(rim); g.restore();
    })]));
  }
  const nightPine = { trunk: mixHex(PAL.woodDark, PAL.ink, 0.4), body: mixHex(PAL.forestDeep, PAL.forest, 0.25), body2: PAL.forestDeep, dark: mixHex(PAL.forestDeep, PAL.ink, 0.5), rim: mixHex(PAL.moon, PAL.forest, 0.45) };
  {
    const d = 0.6, [Xa, Xb] = zoneRange(k, d);
    const p = bandPath(Xa, Xb, d, 770, 40, 0.003, 1604, 0.8);
    Z[k].mid.push(grp(d, [partsSp([P(p, mixHex(PAL.forestDeep, PAL.ink, 0.25), { rim: rgba(PAL.moon, 0.45), rimW: 2.5 })], -1e9, 1e9)]));
  }
  for (const [d, gap, hR, base0, seed] of [[0.74, [110, 220], [300, 460], 812, 1605], [0.9, [300, 460], [440, 600], 838, 1606]]) {
    const [Xa, Xb] = zoneRange(k, d);
    const items = [];
    const r = mulberry32(seed);
    for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += lerp(gap[0], gap[1], r())) {
      const X = 960 + (xl - 960) / d, base = base0 - rise(X) * d;
      const h = lerp(hR[0], hR[1], r());
      items.push(partsSp(pineTree(xl, base, h, nightPine, 5000 + (xl | 0)), xl - h * 0.4, xl + h * 0.4));
      if (d > 0.8 && r() < 0.6) {
        // 发光蘑菇
        const mx = xl + 60 + r() * 60, col = r() < 0.5 ? PAL.crystal : PAL.magic;
        items.push(partsSp([
          P(pathOf([[mx - 5, base + 4], [mx - 4, base - 26], [mx + 4, base - 26], [mx + 5, base + 4]]), PAL.paper2),
          P(blob(mx, base - 30, 20, 11, { seed: mx | 0 }), col, { rim: PAL.white, rimW: 1.5 }),
        ], mx - 24, mx + 24, null, true));
      }
    }
    Z[k].mid.push(grp(d, items));
  }
  buildGround(k, {
    top: mixHex(PAL.forestDeep, PAL.ink, 0.3), deep: mixHex(PAL.forestDeep, PAL.ink, 0.55), rim: mixHex(PAL.forest, PAL.moon, 0.3), road: mixHex(PAL.forestDeep, PAL.ink, 0.45), roadEdge: PAL.ink, pebble: mixHex(PAL.stoneDark, PAL.forestDeep, 0.5), seed: 1607,
    extra: (items, r, Xa, Xb) => {
      // 石板路：96.20–97.40 从勇者脚下往右一块块亮成银色
      for (let x = Xa; x < Xb; x += 74 + r() * 10) {
        const y = journeyGroundY(x) + 6 + r() * 4, w = 60 + r() * 8;
        const p = poly([[x - w / 2, y - 6], [x + w / 2, y - 7], [x + w / 2 + 3, y + 12], [x - w / 2 - 2, y + 13]], { seed: x | 0, amp: 0.8, step: 10, round: 0.5 });
        items.push(Sp(x - w, x + w, (g, T, c, o) => {
          const lit = moonRoadLit(T, x, o);
          g.fillStyle = DROP; g.save(); g.translate(1, 3); g.fill(p); g.restore();
          g.fillStyle = mixHex(mixHex(PAL.stoneDark, PAL.forestDeep, 0.35), PAL.moon, lit * 0.85); g.fill(p);
          if (lit > 0) { g.save(); g.clip(p); g.translate(0, 2); g.lineWidth = 3; g.strokeStyle = rgba(PAL.white, 0.8 * lit); g.stroke(p); g.restore(); }
        }));
      }
    },
  });
  buildFg(k, {
    d: 1.3, seed: 1608, gap: 110,
    make: (xl, base, r) => {
      const parts = [];
      const n = 4 + ((r() * 3) | 0), h = 110 + r() * 90;
      for (let j = 0; j < n; j++) {
        const a = -Math.PI / 2 + (j - (n - 1) / 2) * 0.42, L = h * (0.7 + r() * 0.3);
        const pts = [];
        for (let q = 0; q <= 6; q++) { const t = q / 6; pts.push([xl + Math.cos(a) * L * t + Math.cos(a + 1.2) * 18 * t * t, base + Math.sin(a) * L * t + 22 * t * t]); }
        parts.push(P(ribbon(pts, (t) => 9 * (1 - t) + 1), j % 2 ? mixHex(PAL.forestDeep, PAL.ink, 0.35) : mixHex(PAL.forestDeep, PAL.forest, 0.15), { drop: 4 }));
      }
      return partsSp(parts, xl - h, xl + h);
    },
  });
})();
/** 月光石板路：光的前沿从 96.20 时勇者脚下出发，以 2250 px/s 往右铺。 */
const ROAD_X0 = heroJourneyX(MOON_ROAD[0]);
function moonRoadLit(T, x, o = {}) {
  if (o.moonRoad != null) return clamp(o.moonRoad);
  if (T < MOON_ROAD[0] || x < ROAD_X0 - 40) return 0;
  const front = ROAD_X0 + (T - MOON_ROAD[0]) * 2250;
  return smoothstep(x - 10, x + 120, front);
}

// —— 区 4：C（洞口） ——
/** 杏仁形洞口（左右两端尖、上下两段弧），世界坐标 Path2D。 */
export function caveMouthPath(c) {
  const { x, y, w, h } = JOURNEY_FIXED.caveMouth;
  const p = new Path2D();
  const a = w / 2, b = h / 2;
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * TAU, s = Math.sin(t), cc = Math.cos(t);
    pts.push([x + a * cc, y + b * Math.sign(s) * Math.pow(Math.abs(s), 0.82) * (1 - 0.18 * cc * cc)]);
  }
  if (!c) return pathOf(pts);
  const sp = pts.map(([px, py]) => toScreen(c, 1, px, py));
  sp.forEach(([px, py], i) => (i ? p.lineTo(px, py) : p.moveTo(px, py)));
  p.closePath();
  return p;
}
(function buildC() {
  const k = 4, sky = mixHex(PAL.skyNight, PAL.dragonDeep, 0.5);
  {
    const d = 0.15, [Xa, Xb] = zoneRange(k, d);
    const p = bandPath(Xa, Xb, d, 650, 70, 0.002, 1701, 0.5);
    Z[k].far.push(grp(d, [partsSp([P(p, mixHex(PAL.skyNight, PAL.dragonDeep, 0.5), { rim: rgba(PAL.magic, 0.35), rimW: 2 })], -1e9, 1e9)]));
  }
  // 巨龙山（0.3）：顶出画面，裂缝透光、冒烟
  {
    const d = 0.3, X = JOURNEY_FIXED.dragonMountain.x, x = LXd(X, d);
    const mt = poly([[x - 1000, 1400], [x - 820, 700], [x - 640, 620], [x - 480, 520], [x - 330, 470], [x - 200, 330], [x - 80, 160], [x + 30, 10], [x + 70, -40], [x + 110, -10], [x + 150, -120], [x + 250, -30], [x + 330, 60], [x + 460, 260], [x + 620, 420], [x + 800, 600], [x + 1000, 1400]], { seed: 1702, amp: 2.4, step: 30, round: 0.1 });
    const col = mixHex(PAL.mountainDark, PAL.dragonDark, 0.6);
    const cracks = new Path2D();
    for (const [x0, y0, pts] of [[x - 120, 260, [[30, 60], [10, 120], [44, 180], [20, 260]]], [x + 200, 120, [[-20, 70], [16, 140], [-12, 220]]], [x - 420, 560, [[40, 40], [20, 90], [60, 150]]]]) { cracks.moveTo(x0, y0); for (const [dx, dy] of pts) cracks.lineTo(x0 + dx, y0 + dy); }
    Z[k].far.push(grp(d, [partsSp([P(mt, col, { drop: 6, rim: rgba(PAL.magic, 0.55), rimW: 3, sh: LG(x - 600, 0, x + 600, 0, [[0, rgba(PAL.dragonDeep, 0)], [1, rgba(PAL.dragonDeep, 0.6)]]) })], x - 1050, x + 1050, (g, T) => {
      g.save(); g.strokeStyle = rgba(PAL.fire, 0.35 + 0.15 * Math.sin(T * 2.3)); g.lineWidth = 5; g.lineCap = 'round'; g.stroke(cracks);
      g.strokeStyle = rgba(PAL.fire2, 0.5); g.lineWidth = 1.6; g.stroke(cracks); g.restore();
    })]));
  }
  const rockC = { body: mixHex(PAL.stoneDark, PAL.dragonDark, 0.5), dark: PAL.dragonDeep, rim: mixHex(PAL.magic, PAL.stone2, 0.5) };
  {
    const d = 0.6, [Xa, Xb] = zoneRange(k, d);
    const p = bandPath(Xa, Xb, d, 770, 60, 0.004, 1703, 0.5);
    Z[k].mid.push(grp(d, [partsSp([P(p, mixHex(PAL.dragonDark, PAL.stoneDark, 0.45), { rim: rgba(PAL.magic, 0.45), rimW: 2.5, sh: shadeV(700, 900, PAL.dragonDeep, 0, 0.6) })], -1e9, 1e9)]));
  }
  {
    const d = 0.8, [Xa, Xb] = zoneRange(k, d);
    const items = [];
    const r = mulberry32(1704);
    for (let xl = LXd(Xa, d); xl < LXd(Xb, d); xl += 160 + r() * 240) {
      const base = 818, roll = r();
      if (roll < 0.5) items.push(partsSp(rock(xl, base, 140 + r() * 120, 120 + r() * 120, rockC, 6000 + (xl | 0)), xl - 140, xl + 140));
      else if (roll < 0.75) {
        // 枯树
        const h = 220 + r() * 120, pts = [[xl, base + 4], [xl + 4, base - h * 0.5], [xl - 10, base - h]];
        const br = [[xl + 2, base - h * 0.55], [xl + 50, base - h * 0.78], [xl + 70, base - h * 0.85]];
        const br2 = [[xl - 2, base - h * 0.7], [xl - 46, base - h * 0.86]];
        items.push(partsSp([P(ribbon(pts, (t) => 12 * (1 - t) + 2), PAL.woodDark, { drop: 3 }), P(ribbon(br, (t) => 6 * (1 - t) + 1.5), PAL.woodDark), P(ribbon(br2, (t) => 5 * (1 - t) + 1.5), PAL.woodDark)], xl - 80, xl + 90, null, true));
      } else {
        // 水晶簇
        const parts = [];
        for (let j = 0; j < 4; j++) { const cx = xl + (j - 1.5) * 16, h = 40 + r() * 50, a = (j - 1.5) * 0.18; parts.push(P(pathOf([[cx - 9, base + 2], [cx - 7 + Math.sin(a) * h, base - h], [cx + Math.sin(a) * h + 4, base - h - 10], [cx + 9, base + 2]]), j % 2 ? PAL.crystal : mixHex(PAL.crystal, PAL.magic, 0.4), { rim: PAL.white, rimW: 1.4 })); }
        items.push(partsSp(parts, xl - 50, xl + 50, null, true));
      }
    }
    Z[k].mid.push(grp(d, items));
  }
  buildGround(k, {
    top: mixHex(PAL.dragonDark, PAL.stoneDark, 0.5), deep: mixHex(PAL.dragonDeep, PAL.ink, 0.2), rim: rgba(PAL.magic, 0.7), road: mixHex(PAL.dragonDark, PAL.stoneDark, 0.65), roadEdge: PAL.dragonDeep, pebble: mixHex(PAL.stoneDark, PAL.dragonDark, 0.3), seed: 1705,
    extra: (items, r) => {
      // 崖壁 + 杏仁形洞口（13000,640）+ 獠牙钟乳石 + 透紫光 + 飘烟
      const { x, y, w, h } = JOURNEY_FIXED.caveMouth;
      const cliff = poly([[12640, 900], [12700, 640], [12740, 420], [12790, 200], [12860, -300], [13900, -300], [13900, 900]], { seed: 1706, amp: 3, step: 30, round: 0.15 });
      const mouth = caveMouthPath();
      const fangs = new Path2D(), lower = new Path2D();
      for (let i = 0; i < 9; i++) {
        const t = (i + 0.5) / 9, fx = x - w * 0.44 + t * w * 0.88;
        const topY = y - (h / 2) * Math.pow(Math.sin(t * Math.PI), 0.82) * (1 - 0.18 * Math.cos(t * Math.PI) ** 2) + 4;
        const L = (36 + 34 * Math.sin(t * Math.PI)) * (0.7 + hash2(1707, i) * 0.5);
        fangs.moveTo(fx - 13, topY - 6); fangs.lineTo(fx + (hash2(1708, i) - 0.5) * 6, topY + L); fangs.lineTo(fx + 13, topY - 6); fangs.closePath();
        if (i % 2 === 0 && i > 0 && i < 8) { const botY = y + (h / 2) * Math.pow(Math.sin(t * Math.PI), 0.82) * 0.9 - 2; lower.moveTo(fx - 10, botY + 6); lower.lineTo(fx, botY - 22 - hash2(1709, i) * 14); lower.lineTo(fx + 10, botY + 6); lower.closePath(); }
      }
      items.push(Sp(12600, 13950, (g, T) => {
        drawParts(g, [P(cliff, mixHex(PAL.dragonDark, PAL.ink, 0.28), { drop: 6, rim: rgba(PAL.magic, 0.6), rimW: 3.5, sh: LG(12640, 0, 13600, 0, [[0, rgba(PAL.dragon, 0.25)], [1, rgba(PAL.dragonDeep, 0.5)]]) })]);
        // 洞内：近黑径向 + 紫光脉动
        g.save();
        g.fillStyle = PAL.dragonDeep; g.fill(mouth);
        const gr = g.createRadialGradient(x, y + 30, 10, x, y, w * 0.55);
        const pulse = 0.5 + 0.5 * Math.sin(T * 2.1);
        gr.addColorStop(0, rgba(PAL.magic, 0.55 + 0.2 * pulse)); gr.addColorStop(0.35, rgba(PAL.dragon, 0.5)); gr.addColorStop(1, rgba(PAL.ink, 0.92));
        g.fillStyle = gr; g.fill(mouth);
        g.clip(mouth);
        g.translate(0, 8); g.lineWidth = 16; g.strokeStyle = rgba(PAL.ink, 0.55); g.stroke(mouth);
        g.restore();
        g.fillStyle = mixHex(PAL.stone2, PAL.paper2, 0.45); g.fill(fangs); g.fill(lower);
        g.fillStyle = shadeH(x - w / 2, x + w / 2, PAL.dragonDark, 0.1, 0.45); g.fill(fangs);
        // 飘出的烟
        for (let i = 0; i < 6; i++) {
          const ph = fract(T * 0.22 + i / 6);
          const px = x - 80 + i * 30 - ph * 160, py = y - 120 - ph * 260 + Math.sin(ph * 6 + i) * 12;
          g.fillStyle = rgba(PAL.inkSoft, 0.4 * (1 - ph) * Math.min(1, ph * 5));
          g.fill(blob(px, py, 26 + ph * 50, 18 + ph * 34, { seed: 1710 + i, amp: 0.08 }));
        }
      }));
      // 白骨、零星金币
      const skull = (sx, sy, s) => [
        P(blob(sx, sy - 18 * s, 24 * s, 20 * s, { seed: sx | 0 }), mixHex(PAL.paper, PAL.stone, 0.25), { drop: 2, rim: PAL.white, rimW: 1.5 }),
        P(blob(sx + 6 * s, sy - 4 * s, 13 * s, 8 * s, { seed: (sx | 0) + 1 }), mixHex(PAL.paper, PAL.stone, 0.3)),
        P(blob(sx - 7 * s, sy - 20 * s, 6 * s, 7 * s, { seed: (sx | 0) + 2 }), PAL.ink), P(blob(sx + 9 * s, sy - 20 * s, 5.5 * s, 6.5 * s, { seed: (sx | 0) + 3 }), PAL.ink),
      ];
      items.push(partsSp(skull(12360, 878, 1), 12320, 12400));
      const ribs = [];
      for (let i = 0; i < 5; i++) { const bx = 12520 + i * 16; ribs.push(P(ribbon([[bx, 884], [bx + 6, 850 - i * 3], [bx + 16, 838 - i * 2]], (t) => 4 * (1 - t * 0.5)), mixHex(PAL.paper, PAL.stone, 0.25), { drop: 2 })); }
      ribs.push(P(ribbon([[12505, 884], [12610, 880]], () => 4), mixHex(PAL.paper, PAL.stone, 0.3)));
      items.push(partsSp(ribs, 12500, 12620));
      for (let i = 0; i < 18; i++) {
        const cx = 12260 + hash2(1711, i) * 760, cy = 872 + hash2(1712, i) * 34;
        items.push(partsSp([P(blob(cx, cy, 9, 4.5, { seed: 1713 + i }), PAL.coin, { rim: PAL.goldLight, rimW: 1.2, drop: 1.5 })], cx - 12, cx + 12, null, true));
      }
    },
  });
  // 前景（白马躲的岩石，画在角色之后）
  {
    const { x, w, h } = JOURNEY_FIXED.rock, base = 872;
    const body = poly([[x - w / 2, base + 6], [x - w * 0.46, base - h * 0.55], [x - w * 0.28, base - h * 0.92], [x - w * 0.02, base - h], [x + w * 0.26, base - h * 0.86], [x + w * 0.44, base - h * 0.5], [x + w / 2, base + 6]], { seed: 1720, amp: 2, step: 20, round: 0.5 });
    const chip = poly([[x - w * 0.2, base - h * 0.7], [x + w * 0.05, base - h * 0.82], [x + w * 0.16, base - h * 0.55], [x - w * 0.1, base - h * 0.5]], { seed: 1721, amp: 1, step: 12, round: 0.4 });
    Z[k].front.push(grp(1, [partsSp([
      P(body, mixHex(PAL.stoneDark, PAL.dragonDark, 0.45), { drop: 8, rim: mixHex(PAL.magic, PAL.stone2, 0.4), rimW: 3, sh: LG(x - w / 2, base - h, x + w / 2, base, [[0, rgba(PAL.dragonDeep, 0)], [1, rgba(PAL.dragonDeep, 0.6)]]) }),
      P(chip, rgba(PAL.stone2, 0.18)),
    ], x - w / 2 - 10, x + w / 2 + 10)]));
  }
  buildFg(k, {
    d: 1.32, seed: 1722, gap: 170,
    make: (xl, base, r) => {
      const w = 160 + r() * 140, h = 90 + r() * 90;
      const parts = rock(xl, base + 20, w, h, { body: mixHex(PAL.dragonDeep, PAL.stoneDark, 0.35), dark: PAL.ink, rim: rgba(PAL.magic, 0.6) }, 7000 + (xl | 0));
      if (r() < 0.4) for (let j = 0; j < 3; j++) { const cx = xl - 20 + j * 18, ch = 50 + r() * 40; parts.push(P(pathOf([[cx - 8, base - h * 0.6], [cx + (j - 1) * 10, base - h * 0.6 - ch], [cx + 8, base - h * 0.6]]), mixHex(PAL.crystal, PAL.magic, 0.3), { rim: PAL.white, rimW: 1.2 })); }
      return partsSp(parts, xl - w / 2, xl + w / 2);
    },
  });
})();

// ———————————————————— 天空（屏幕空间） ————————————————————
const STARS = Array.from({ length: 80 }, (_, i) => Object.freeze({ x: hash2(1801, i) * 2000 - 40, y: hash2(1802, i) * 640, s: 1.4 + hash2(1803, i) ** 3 * 5, at: MOON_RISE[0] - 0.1 + hash2(1804, i) * 1.5, tw: hash2(1805, i) * TAU }));
const CLOUDS = Array.from({ length: 16 }, (_, i) => Object.freeze({ X: -400 + i * 460 + hash2(1811, i) * 200, y: 110 + hash2(1812, i) * 230, s: 0.7 + hash2(1813, i) * 0.6, seed: 1814 + i }));
function cloudParts(x, y, s, seed, col, under) {
  const parts = [];
  const r = mulberry32(seed);
  const n = 4;
  for (let i = 0; i < n; i++) { const bx = x + (i - (n - 1) / 2) * 62 * s + (r() - 0.5) * 20 * s, by = y - (i === 1 || i === 2 ? 26 : 6) * s; parts.push(blob(bx, by, (54 + r() * 26) * s, (34 + r() * 16) * s, { seed: seed + i, amp: 0.04 })); }
  const base = blob(x, y + 12 * s, 150 * s, 26 * s, { seed: seed + 9, amp: 0.03 });
  return { parts, base, col, under };
}
function drawCloud(g, cl) {
  g.fillStyle = cl.under;
  g.save(); g.translate(3, 6); for (const p of cl.parts) g.fill(p); g.fill(cl.base); g.restore();
  g.fillStyle = cl.col; for (const p of cl.parts) g.fill(p); g.fill(cl.base);
}
function sunPos(T, c, k) {
  if (k === 0) {
    const a = inOutSine(seg(T, V08, V08 + 1.94));
    return [lerp(1480, 1700, a) - (c.x - 4000) * 0.04, lerp(170, 350, a) + Math.sin(a * Math.PI) * -26 - (c.y - 540) * 0.05];
  }
  return [1530 - (c.x - 6800) * 0.04, 420 - (c.y - 540) * 0.05];
}
const SKY_STOPS = [
  [[0, PAL.skyDay], [0.55, mixHex(PAL.skyDay, PAL.skyDayLow, 0.55)], [0.82, PAL.skyDayLow]],
  [[0, mixHex(PAL.goldLight, PAL.skyDay, 0.22)], [0.4, PAL.goldLight], [0.85, PAL.skyDusk]],
  [[0, mixHex(PAL.snowShade, PAL.mountain, 0.4)], [0.5, mixHex(PAL.skyDayLow, PAL.snowShade, 0.5)], [0.85, mixHex(PAL.skyDayLow, PAL.snow, 0.4)]],
  [[0, PAL.skyNightHigh], [0.62, PAL.skyNight], [0.9, mixHex(PAL.skyNight, PAL.moonGlow, 0.07)]],
  [[0, PAL.skyNightHigh], [0.55, PAL.skyNight], [0.86, mixHex(PAL.skyNight, PAL.dragonDeep, 0.7)]],
];
const CLOUD_COL = [[PAL.white, mixHex(PAL.skyDayLow, PAL.skyDay, 0.5)], [mixHex(PAL.paper, PAL.skyDusk, 0.25), mixHex(PAL.skyDusk, PAL.goldLight, 0.4)], [mixHex(PAL.snow, PAL.snowShade, 0.35), PAL.snowShade], null, null];
const CLOUD_SHAPES = CLOUD_COL.map((cc, k) => (cc ? CLOUDS.map((cl) => cloudParts(0, 0, cl.s, cl.seed + k * 31, cc[0], cc[1])) : null));

function drawSky(g, T, c, k, o) {
  g.save();
  g.fillStyle = lin_(g, 0, 0, 0, 1080, SKY_STOPS[k]);
  g.fillRect(-200, -200, 2320, 1480);
  if (k <= 2) {
    // 太阳（屏幕空间，微视差）
    if (k < 2) {
      const [sx, sy] = sunPos(T, c, k);
      const R = k === 0 ? 62 : 84;
      g.fillStyle = k === 0 ? PAL.goldLight : mixHex(PAL.goldLight, PAL.fire2, 0.4);
      g.fill(blob(sx, sy, R, R, { seed: 1820, amp: 0.01 }));
      g.fillStyle = rgba(PAL.white, 0.5); g.fill(blob(sx - R * 0.2, sy - R * 0.2, R * 0.6, R * 0.6, { seed: 1821, amp: 0.02 }));
    }
    // 纸云（0.1 深度 + 风）
    const cc = CLOUD_SHAPES[k];
    for (let i = 0; i < CLOUDS.length; i++) {
      const cl = CLOUDS[i], sh = cc[i];
      const x = cl.X + T * 9 - (c.x - 960) * 0.1;
      const xx = ((x % 7360) + 7360) % 7360 - 700;
      if (xx < -400 || xx > 2320) continue;
      g.save(); g.translate(xx, cl.y - (c.y - 540) * 0.1 + (k === 2 ? 40 : 0));
      if (k === 1) g.scale(1.25, 0.7);
      drawCloud(g, sh);
      g.restore();
    }
  } else {
    // 星星逐颗亮起
    for (const s of STARS) {
      const a = k === 4 ? 0.6 : 1;
      const on = clamp((T - s.at) / 0.25) * a;
      if (on <= 0) continue;
      const tw = 0.65 + 0.35 * Math.sin(T * 3 + s.tw);
      const x = s.x - (c.x - 9500) * 0.02, y = s.y - (c.y - 540) * 0.02;
      if (s.s > 4) sparkle(g, x, y, s.s * 2.2 * tw, { color: PAL.moon, alpha: on * 0.9, rot: s.tw });
      else { g.fillStyle = rgba(PAL.moon, on * tw); g.beginPath(); g.arc(x, y, s.s * 0.6, 0, TAU); g.fill(); }
    }
  }
  g.restore();
}
function lin_(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [o, col] of stops) gr.addColorStop(o, col); return gr; }

// 远处的龙山剪影：永远在右侧地平线、越走越大（我们正朝它走，所以不做横向视差）
function drawFarDragonMt(g, T, c, k) {
  if (k === 4) return;
  const prog = clamp((c.x - 1900) / (12300 - 1900));
  const s = lerp(0.55, 1.3, prog ** 1.3);
  const x = lerp(1730, 1560, prog), base = 702 - (c.y - 540) * 0.1;
  const col = k === 3 ? mixHex(PAL.dragonDeep, PAL.skyNight, 0.3) : mixHex(mixHex(PAL.mountainDark, PAL.dragonDark, 0.6), SKY_STOPS[k][2][1], 0.35 - prog * 0.15);
  g.save();
  g.translate(x, base); g.scale(s, s);
  g.fillStyle = col;
  g.fill(DRAGON_FAR);
  g.fillStyle = rgba(PAL.dragonDeep, 0.35); g.fill(DRAGON_FAR_SH);
  // 细烟
  for (let i = 0; i < 4; i++) {
    const ph = fract(T * 0.18 + i / 4);
    g.fillStyle = rgba(k === 3 ? PAL.dragonWing : PAL.inkSoft, 0.35 * (1 - ph));
    g.fill(blob(-6 + ph * 40, -306 - ph * 110, 10 + ph * 20, 8 + ph * 14, { seed: 1830 + i, amp: 0.08 }));
  }
  g.restore();
}
const DRAGON_FAR = poly([[-260, 40], [-180, -120], [-130, -100], [-70, -230], [-30, -300], [-6, -268], [16, -300], [44, -232], [100, -150], [150, -170], [260, 40]], { seed: 1831, amp: 1.2, step: 18, round: 0.08 });
const DRAGON_FAR_SH = pathOf([[16, -300], [44, -232], [100, -150], [150, -170], [260, 40], [30, 40], [0, -200]]);

// ———————————————————— 天气与光（屏幕空间） ————————————————————
function blizzardK(T, o) {
  if (o.blizzard != null) return clamp(o.blizzard);
  return 0.28 + 0.72 * smoothstep(V11, V11 + 0.12, T);
}
function drawSnow(g, T, c, big, o) {
  const k = blizzardK(T, o);
  const n = big ? 16 : 90;
  const vx = -520 * k - 40, vy = 60 + 60 * (1 - k);
  g.save();
  g.fillStyle = rgba(PAL.snow, big ? 0.85 : 0.95);
  for (let i = 0; i < n; i++) {
    const sp = 0.6 + hash2(1901 + (big ? 7 : 0), i) * 0.8;
    const px = fract(hash2(1902, i) + ((vx * sp * T) - (c.x - 9000) * (big ? 1.3 : 1) * c.zoom) / 2400) * 2400 - 240;
    const py = fract(hash2(1903, i) + (vy * sp * T) / 1300) * 1300 - 110 + Math.sin(T * 2 + i) * 8;
    const r = big ? 7 + hash2(1904, i) * 9 : 1.6 + hash2(1905, i) * 3.4;
    if (i > n * (0.35 + 0.65 * k)) continue;
    g.save(); g.translate(px, py); g.rotate(-0.25 * k);
    g.beginPath(); g.ellipse(0, 0, r * (1 + k * 1.6), r, 0, 0, TAU); g.fill();
    g.restore();
  }
  g.restore();
}
function drawLight(g, T, c, k, o) {
  g.save();
  g.globalCompositeOperation = 'screen';
  if (k === 0 || k === 1) {
    const [sx, sy] = sunPos(T, c, k);
    glow(g, sx, sy, k === 0 ? 300 : 420, k === 0 ? PAL.goldLight : PAL.fire2, k === 0 ? 0.5 : 0.55);
    rays(g, sx, sy, k === 0 ? 700 : 900, { n: 14, width: 0.05, rot: T * 0.05, color: PAL.goldLight, alpha: k === 0 ? 0.14 : 0.2, r0: 70, seed: 1910 + k });
  } else if (k === 2) {
    glow(g, 1300, 240 - (c.y - 540) * 0.05, 360, PAL.white, 0.35);
  } else if (k === 3 || k === 4) {
    const [mx, my, mk] = moonScreen(T, c, o);
    glow(g, mx, my, MOON.r * 2.1, PAL.moonGlow, 0.32 * clamp(mk * 1.4));
    if (k === 3) {
      // 月光：柔边梯形斜落到前方路上
      const beam = o.moonBeam ?? smoothstep(MOON_ROAD[0], MOON_ROAD[0] + 0.35, T) * (1 - smoothstep(V13 - 0.5, V13 - 0.2, T));
      if (beam > 0) {
        for (let i = 0; i < 4; i++) {
          const sp = 1 + i * 0.22;
          g.fillStyle = LG(0, my, 0, 900, [[0, rgba(PAL.moon, 0)], [0.5, rgba(PAL.moon, 0.06 * beam)], [1, rgba(PAL.moon, 0.13 * beam)]]);
          g.beginPath(); g.moveTo(mx - 70 * sp, my + 120); g.lineTo(mx + 30 * sp, my + 100); g.lineTo(mx - 40 + 240 * sp, 900); g.lineTo(mx - 420 - 150 * sp, 900); g.closePath(); g.fill();
        }
      }
      // 箭头形光斑（贴在勇者前方路面，指向右）+ 萤火
      const ar = smoothstep(MOON_ROAD[0] + 0.35, MOON_ROAD[0] + 0.65, T) * (1 - smoothstep(V13 - 0.55, V13 - 0.35, T));
      if (ar > 0) {
        const hx = heroJourneyX(T) + 560, [ax, ay] = toScreen(c, 1, hx, journeyGroundY(hx) + 16);
        const pz = c.zoom, pul = 0.75 + 0.25 * Math.sin(T * 7);
        g.save(); g.translate(ax, ay); g.scale(pz, pz * 0.42);
        g.fillStyle = rgba(PAL.moon, 0.55 * ar * pul);
        g.beginPath(); g.moveTo(-110, -26); g.lineTo(20, -26); g.lineTo(20, -60); g.lineTo(110, 0); g.lineTo(20, 60); g.lineTo(20, 26); g.lineTo(-110, 26); g.closePath(); g.fill();
        g.restore();
        glow(g, ax + 10, ay, 160 * pz, PAL.moon, 0.4 * ar * pul);
      }
      for (let i = 0; i < 26; i++) {
        const ph = fract(T * (0.12 + hash2(1920, i) * 0.1) + hash2(1921, i));
        const fx = fract(hash2(1922, i) - (c.x - 9600) * 0.9 / 2200) * 2200 - 140 + Math.sin(T * 1.3 + i) * 24;
        const fy = 900 - ph * 520;
        const a = Math.sin(ph * Math.PI) * (0.6 + 0.4 * Math.sin(T * 6 + i));
        glow(g, fx, fy, 22, PAL.magic, 0.7 * a);
        g.fillStyle = rgba(PAL.white, 0.9 * a); g.beginPath(); g.arc(fx, fy, 2.2, 0, TAU); g.fill();
      }
    } else {
      // 洞口紫光
      const { x, y } = JOURNEY_FIXED.caveMouth;
      const [cx, cy] = toScreen(c, 1, x, y + 20);
      glow(g, cx, cy, 420 * c.zoom, PAL.magic, 0.32 + 0.1 * Math.sin(T * 2.1));
    }
  }
  g.restore();
}

// ———————————————————— 遮挡物（屏幕空间，scene 给 blur 5–6） ————————————————————
const OCC_ART = (() => {
  const H0 = -120, H1 = 1220;
  const art = {};
  // 城门拱：厚石墙 + 左侧拱券边 + 红长幡
  {
    const wall = poly([[-200, H1], [-200, 420], [-160, 300], [-90, 200], [0, 130], [-30, H0], [560, H0], [560, H1]], { seed: 2001, amp: 2, step: 40 });
    const vous = new Path2D();
    for (let i = 0; i < 7; i++) {
      const a0 = Math.PI + (i / 7) * (Math.PI / 2), a1 = Math.PI + ((i + 1) / 7) * (Math.PI / 2);
      const cx = 200, cy = 520, r0 = 400, r1 = 470;
      vous.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0); vous.lineTo(cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1); vous.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1); vous.lineTo(cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0); vous.closePath();
    }
    const bricks = new Path2D();
    for (let row = 0; row < 18; row++) for (let x = -140 + (row % 2) * 50; x < 560; x += 100) bricks.rect(x, H0 + 20 + row * 74, 92, 64);
    const banner = poly([[250, H0], [430, H0], [430, 620], [340, 560], [250, 620]], { seed: 2002, amp: 1.5, step: 30 });
    art.gateArch = { parts: [P(wall, PAL.stone2, { sh: shadeH(-200, 560, PAL.stoneDark, 0.25, 0.55) }), P(bricks, rgba(PAL.stone, 0.45)), P(vous, mixHex(PAL.stone, PAL.paper, 0.2)), P(banner, PAL.scarf, { sh: shadeH(250, 430, PAL.scarfDark, 0, 0.5) })], cx: 180, gold: banner };
  }
  // 绕树变样的树干：深棕带叶
  {
    const trunk = poly([[-190, H1], [-150, 900], [-130, 500], [-120, 100], [-110, H0], [120, H0], [130, 120], [140, 520], [170, 900], [230, H1]], { seed: 2011, amp: 3, step: 40, round: 0.3 });
    const bark = new Path2D();
    for (let i = 0; i < 9; i++) { const x = -110 + i * 28; bark.moveTo(x, H0); bark.bezierCurveTo(x + 10, 300, x - 10, 700, x + 6 * (i % 3), H1); }
    const leaves = [blob(-60, -40, 260, 150, { seed: 2012, amp: 0.08 }), blob(180, 60, 200, 120, { seed: 2013, amp: 0.08 }), blob(300, 380, 150, 90, { seed: 2014, amp: 0.1 })];
    const branch = ribbon([[100, 460], [220, 420], [300, 380]], (t) => 22 * (1 - t) + 6);
    art.treeGag = { parts: [P(branch, PAL.woodDark), P(trunk, PAL.woodDark, { sh: shadeH(-190, 230, PAL.shadow, 0.05, 0.5) }), P(leaves[0], PAL.forest, { sh: shadeV(-190, 110, PAL.forestDeep, 0, 0.5) }), P(leaves[1], PAL.grassDark), P(leaves[2], PAL.forest)], bark };
  }
  // 大橡树：粗干 + 巨大树冠盖住上半屏
  {
    const trunk = poly([[-380, H1], [-250, 1000], [-210, 700], [-200, 420], [-250, 180], [-420, 40], [-200, 90], [-120, 20], [-60, H0], [150, H0], [140, 60], [300, 0], [420, 60], [220, 200], [200, 460], [230, 760], [300, 1000], [420, H1]], { seed: 2021, amp: 4, step: 46, round: 0.3 });
    const bark = new Path2D();
    for (let i = 0; i < 12; i++) { const x = -200 + i * 36; bark.moveTo(x, 200); bark.bezierCurveTo(x + 14, 500, x - 12, 800, x + 8 * (i % 3) + (x > 0 ? 30 : -30), H1); }
    const crown = [];
    const r = mulberry32(2022);
    for (let i = 0; i < 11; i++) crown.push([-760 + i * 152 + r() * 40, -60 + r() * 200 + Math.abs(i - 5) * 26, 170 + r() * 90, 120 + r() * 60, i]);
    art.oak = {
      parts: [
        ...crown.map(([x, y, rx, ry, i]) => P(blob(x, y, rx, ry, { seed: 2030 + i, amp: 0.07 }), i % 3 === 0 ? PAL.forestDeep : PAL.forest, { sh: shadeV(y - ry, y + ry, PAL.forestDeep, 0, 0.6) })),
        P(trunk, PAL.woodDark, { sh: shadeH(-380, 420, PAL.shadow, 0.05, 0.55) }),
        ...crown.filter((q) => q[4] % 2).map(([x, y, rx, ry, i]) => P(blob(x + 20, y + ry * 0.5, rx * 0.7, ry * 0.55, { seed: 2050 + i, amp: 0.08 }), PAL.grassDark, { sh: shadeV(y, y + ry, PAL.forestDeep, 0, 0.4) })),
        ...crown.filter((q) => q[4] % 3 === 1).map(([x, y, rx, ry, i]) => P(blob(x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.25, { seed: 2070 + i, amp: 0.1 }), rgba(PAL.grass, 0.85))),
      ], bark,
    };
  }
  // 半雪松：左半绿、右半积雪
  {
    const trunk = poly([[-70, H1], [-56, 400], [-40, H0], [40, H0], [56, 400], [70, H1]], { seed: 2081, amp: 2, step: 40 });
    const tiers = [];
    for (let i = 0; i < 7; i++) {
      const tb = H0 + 140 + i * 175, tw = 240 + i * 72, tt = tb - 260;
      const pts = [[0, tt], [tw * 0.25, tb - 90], [tw * 0.5, tb], [tw * 0.3, tb - 22], [tw * 0.12, tb + 6], [0, tb - 14], [-tw * 0.12, tb + 6], [-tw * 0.3, tb - 22], [-tw * 0.5, tb], [-tw * 0.25, tb - 90]];
      tiers.push({ p: poly(pts, { seed: 2082 + i, amp: 2, step: 26, round: 0.15 }), tb, tw, tt });
    }
    art.halfPine = { trunk, tiers };
  }
  // 雪崖：一整面嶙峋岩壁（左右锯齿边、受光面 / 背光面分块），雪堆在突出的岩棱上，岩棱下挂冰凌，顶上压一大片雪檐
  {
    const r = mulberry32(2091);
    const Lp = [], Rp = [];
    for (let y = H1 + 40; y >= H0 - 40; y -= 80) { Lp.push([-470 - r() * 170, y]); Rp.push([440 + r() * 170, y]); }
    const cliff = poly([...Lp, ...Rp.reverse()], { seed: 2091, amp: 6, step: 44, round: 0.08 });
    const lit = [], dark = [];
    for (let i = 0; i < 12; i++) {
      const y0 = H0 + i * 112 + r() * 40, x0 = -520 + r() * 520, w = 120 + r() * 200, h = 120 + r() * 120;
      const tri = poly([[x0, y0], [x0 + w, y0 + h * 0.3], [x0 + w * (0.3 + r() * 0.3), y0 + h]], { seed: 2100 + i, amp: 2, step: 30, round: 0.1 });
      (i % 3 === 2 ? dark : lit).push(tri);
    }
    const snow = [], cracks = new Path2D(), icicles = new Path2D(), ledges = new Path2D();
    for (let i = 0; i < 7; i++) {
      const y = 70 + i * 160 + r() * 40, x0 = -470 + r() * 300, w = 200 + r() * 280;
      snow.push({ p: poly([[x0, y + 6], [x0 + 20, y - 14 - r() * 10], [x0 + w * 0.35, y - 26 - r() * 14], [x0 + w * 0.7, y - 18 - r() * 12], [x0 + w, y + 4], [x0 + w * 0.6, y + 14], [x0 + w * 0.25, y + 12]], { seed: 2110 + i, amp: 2, step: 24, round: 0.6 }), y });
      // 雪堆下面突出的岩棱（背光的楔形暗面，冰凌挂在它前面）；不额外取 r()，保持其余形状不变
      ledges.moveTo(x0 - 8, y + 9); ledges.lineTo(x0 + w + 6, y + 7); ledges.lineTo(x0 + w * (0.55 + 0.2 * hash2(2131, i)), y + 44 + 18 * hash2(2132, i)); ledges.lineTo(x0 + w * 0.16, y + 30); ledges.closePath();
      cracks.moveTo(x0 + 6, y + 16); cracks.lineTo(x0 + w * 0.5, y + 20 + r() * 6); cracks.lineTo(x0 + w - 8, y + 14);
      for (let x = x0 + 24; x < x0 + w - 16; x += 30 + r() * 34) { const L = 22 + r() * 50; icicles.moveTo(x - 6, y + 14); icicles.lineTo(x + (r() - 0.5) * 4, y + 14 + L); icicles.lineTo(x + 6, y + 14); icicles.closePath(); }
    }
    const cap = poly([[-760, H0 - 60], [760, H0 - 60], [700, 40], [480, 96], [260, 50], [40, 120], [-200, 60], [-430, 110], [-690, 50]], { seed: 2120, amp: 6, step: 40, round: 0.45 });
    art.snowCliff = { cliff, lit, dark, snow, cracks, icicles, ledges, cap };
  }
  // 黑树干：近黑的粗干 + 月光勾左边 + 树皮纹 + 树结 + 断枝
  {
    const trunk = poly([[-136, H1], [-108, 760], [-92, 380], [-98, H0], [96, H0], [90, 340], [104, 740], [134, H1]], { seed: 2101, amp: 2.5, step: 40, round: 0.2 });
    const stub = ribbon([[78, 360], [150, 318], [204, 316]], (t) => 18 * (1 - t) + 4);
    const stub2 = ribbon([[-80, 640], [-140, 600], [-176, 606]], (t) => 14 * (1 - t) + 3);
    const bark = new Path2D();
    for (let i = 0; i < 7; i++) { const x = -70 + i * 22; bark.moveTo(x, H0); bark.bezierCurveTo(x + 8, 300, x - 8, 700, x + 6 * (i % 3) - 3, H1); }
    const knots = [blob(-20, 520, 14, 22, { seed: 2102 }), blob(40, 860, 12, 18, { seed: 2103 })];
    art.blackTrunks = { trunk, stub, stub2, bark, knots };
  }
  return art;
})();

function speedStreaks(g, x, w, seed, col, a) {
  g.save();
  g.strokeStyle = rgba(col, a); g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const y = -60 + hash2(seed, i) * 1180, L = 140 + hash2(seed + 1, i) * 360, lw = 2 + hash2(seed + 2, i) * 5;
    g.lineWidth = lw; g.beginPath(); g.moveTo(x + w * 0.5, y); g.lineTo(x + w * 0.5 + L, y); g.stroke();
  }
  g.restore();
}
function drawOccArt(g, kind, T, i) {
  const A = OCC_ART[kind];
  if (kind === 'gateArch') {
    g.translate(-180, 0); // 实心墙体中心对准接缝
    drawParts(g, A.parts);
    g.save(); g.strokeStyle = PAL.gold; g.lineWidth = 6; g.stroke(A.gold); g.restore();
    speedStreaks(g, 0, 700, 2201, PAL.paper, 0.3);
  } else if (kind === 'treeGag') {
    drawParts(g, A.parts.slice(0, 2));
    g.save(); g.strokeStyle = rgba(PAL.wood, 0.7); g.lineWidth = 7; g.stroke(A.bark); g.restore();
    drawParts(g, A.parts.slice(2));
    speedStreaks(g, 0, 380, 2202, PAL.leafLight, 0.3);
  } else if (kind === 'oak') {
    const n = A.parts.length;
    drawParts(g, A.parts.slice(0, 11));
    drawParts(g, [A.parts[11]]);
    g.save(); g.strokeStyle = rgba(PAL.wood, 0.65); g.lineWidth = 9; g.stroke(A.bark); g.restore();
    drawParts(g, A.parts.slice(12, n));
    speedStreaks(g, 0, 800, 2203, PAL.goldLight, 0.28);
  } else if (kind === 'halfPine') {
    g.fillStyle = PAL.woodDark; g.fill(A.trunk);
    for (const t of A.tiers) {
      g.save(); g.clip(t.p);
      g.fillStyle = PAL.forest; g.fillRect(-t.tw, t.tt - 10, t.tw, t.tb - t.tt + 40);
      g.fillStyle = PAL.grassDark; g.fillRect(-t.tw * 0.5, t.tb - 60, t.tw * 0.5, 80);
      g.fillStyle = PAL.snow; g.fillRect(0, t.tt - 10, t.tw, t.tb - t.tt + 40);
      g.fillStyle = PAL.snowShade; g.fillRect(0, t.tb - 46, t.tw, 70);
      g.restore();
    }
    speedStreaks(g, 0, 600, 2204, PAL.white, 0.3);
  } else if (kind === 'snowCliff') {
    g.fillStyle = mixHex(PAL.mountainDark, PAL.stoneDark, 0.35); g.fill(A.cliff);
    g.fillStyle = LG(-640, 0, 620, 0, [[0, rgba(PAL.mountain, 0.35)], [0.55, rgba(PAL.mountain, 0)], [1, rgba(PAL.ink, 0.35)]]); g.fill(A.cliff);
    g.save(); g.clip(A.cliff);
    g.fillStyle = rgba(PAL.mountain, 0.55); for (const p of A.lit) g.fill(p);
    g.fillStyle = rgba(PAL.ink, 0.28); for (const p of A.dark) g.fill(p);
    g.fillStyle = rgba(mixHex(PAL.mountainDark, PAL.ink, 0.4), 0.78); g.fill(A.ledges);
    g.strokeStyle = rgba(PAL.ink, 0.45); g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(A.cracks);
    g.restore();
    g.fillStyle = mixHex(PAL.ice, PAL.white, 0.25); g.fill(A.icicles);
    for (const s of A.snow) { g.fillStyle = PAL.snow; g.fill(s.p); g.fillStyle = shadeV(s.y - 14, s.y + 16, PAL.snowShade, 0, 0.8); g.fill(s.p); }
    g.fillStyle = PAL.snow; g.fill(A.cap);
    g.fillStyle = LG(0, 0, 0, 130, [[0, rgba(PAL.snowShade, 0)], [1, rgba(PAL.snowShade, 0.7)]]); g.fill(A.cap);
    speedStreaks(g, 0, 1000, 2205, PAL.white, 0.32);
  } else if (kind === 'blackTrunks') {
    const col = mixHex(PAL.ink, PAL.forestDeep, 0.3);
    const k = [0.92, 1.18, 0.8][i % 3];
    g.save(); g.scale(k, 1);
    g.fillStyle = col; g.fill(A.stub); g.fill(A.stub2); g.fill(A.trunk);
    g.save(); g.clip(A.trunk);
    g.lineCap = 'round';
    g.strokeStyle = rgba(PAL.ink, 0.55); g.lineWidth = 6; g.stroke(A.bark); // 树皮暗沟
    g.save(); g.translate(5, 0); g.strokeStyle = rgba(PAL.moon, 0.16); g.lineWidth = 3; g.stroke(A.bark); g.restore(); // 沟旁受光的棱
    g.fillStyle = rgba(PAL.ink, 0.6); for (const p of A.knots) g.fill(p);
    g.strokeStyle = rgba(PAL.moon, 0.2); g.lineWidth = 2.5; for (const p of A.knots) g.stroke(p);
    g.translate(6, 0); g.lineWidth = 10; g.strokeStyle = rgba(PAL.moon, 0.7); g.stroke(A.trunk); // 月光勾左边
    g.restore();
    g.restore();
    speedStreaks(g, 0, 240 * k, 2206 + i, PAL.moon, 0.32);
  }
}

/**
 * 换区遮挡物（屏幕空间；blur 5–6 由镜头的 ctx.layer 给）。kind：'gateArch' | 'treeGag' | 'oak' | 'halfPine' | 'snowCliff' | 'blackTrunks'，
 * 或省略 / 'all' = 画当前画面里所有的遮挡物。机位 c 传 journeyCam(T)（与 drawJourney 同一个，接缝才对得上）。
 */
export function drawOccluder(g, T, c = journeyCam(T), kind = 'all') {
  for (let i = 0; i < OCC.length; i++) {
    const oc = OCC[i];
    if (kind !== 'all' && kind !== oc.kind) continue;
    if (kind === 'all' && oc.kind === 'gateArch' && T > V04 + 1.6) continue;
    const x = occX(oc, c);
    if (x < -oc.w || x > 1920 + oc.w) continue;
    g.save();
    g.translate(x, occY(oc, c));
    drawOccArt(g, oc.kind, T, i);
    g.restore();
  }
}

// ———————————————————— drawJourney ————————————————————
function zoneSpans(c) {
  const s = SEAMS.map((oc) => occX(oc, c));
  const out = [];
  for (let k = 0; k < 5; k++) {
    const a = k === 0 ? -1e6 : s[k - 1], b = k === 4 ? 1e6 : s[k];
    if (b < -260 || a > 2180 || b <= a) continue;
    out.push({ z: k, x0: a, x1: b });
  }
  return out;
}
/** 机位 c 下当前可见的区（0–4 = M/V/S/N/C）及各自的屏幕 x 区间。 */
export const journeyZones = (c) => zoneSpans(c);
const ZONE_ID = { G: 0, M: 0, V: 1, S: 2, N: 3, C: 4 };

function camMatrix(c, d) {
  const z = 1 + (c.zoom - 1) * d;
  return new DOMMatrix().translate(960, 540).rotate((c.rot || 0) * 180 / Math.PI).scale(z, z).translate(-(960 + (c.x - 960) * d), -(540 + (c.y - 540) * d));
}
function drawGroups(g, T, c, groups, o) {
  const ref = o.flat && typeof o.flat === 'object' ? o.flat : null;
  for (const gr of groups) {
    g.save();
    // flat：冻结视差——各层先按参考机位 o.flat 摆好，再整体随 depth 1 一起移动（像同一张纸）
    if (ref) g.setTransform(g.getTransform().multiply(camMatrix(c, 1)).multiply(camMatrix(ref, 1).inverse()).multiply(camMatrix(ref, gr.d)));
    else applyCam(g, c, gr.d);
    const [a, b] = ref ? [-1e9, 1e9] : visX(c, gr.d);
    for (const it of gr.items) {
      if (it.x1 < a || it.x0 > b) continue;
      if (it.minor && o.detail === 0) continue;
      it.draw(g, T, c, o);
    }
    g.restore();
  }
}
const LAYERS = {
  sky: (g, T, c, k, o) => drawSky(g, T, c, k, o),
  far: (g, T, c, k, o) => {
    if (k === 3 || k === 4) {
      const [mx, my, mk] = moonScreen(T, c, o);
      if (my < 1200) drawMoon(g, mx, my, MOON.r);
    }
    drawGroups(g, T, c, Z[k].far.filter((q) => q.d <= DEPTH_FAR), o);
    drawFarDragonMt(g, T, c, k);
    drawGroups(g, T, c, Z[k].far.filter((q) => q.d > DEPTH_FAR), o);
  },
  mid: (g, T, c, k, o) => drawGroups(g, T, c, Z[k].mid, o),
  main: (g, T, c, k, o) => drawGroups(g, T, c, Z[k].main, o),
  front: (g, T, c, k, o) => {
    drawGroups(g, T, c, Z[k].front, o);
    if (k === 2) drawSnow(g, T, c, false, o);
  },
  fg: (g, T, c, k, o) => {
    drawGroups(g, T, c, Z[k].fg, o);
    if (k === 2) drawSnow(g, T, c, true, o);
  },
  light: (g, T, c, k, o) => drawLight(g, T, c, k, o),
};

/**
 * 旅途长卷。drawJourney(g, T, cam, o)：cam 一般传 journeyCam(T)；函数内部按各层深度 applyCam。
 * o.layer：'sky'（屏幕空间天色 + 太阳 / 云 / 星）| 'far'（远山、缩小王城、雪峰红旗、月亮、龙山剪影，0.05–0.45）|
 *          'mid'（风车、树林、小屋、岩石，0.55–0.95）| 'main'（地面、道路、石板、洞口崖壁、白骨金币，1.0）|
 *          'front'（角色之后再画：白马躲的岩石 + 风雪细雪片，1.0）| 'fg'（草丛、花田、雪堆、蕨、紫岩，1.25–1.32，blur 交给图层）|
 *          'light'（screen 叠加的光：太阳光芒、月光梯形、箭头光斑、萤火、洞口紫光；直接画在 g 上，不必包图层）
 * 其它：zone（'G'|'M'|'V'|'S'|'N'|'C' 强制只画某区，不做换区）、clipX:[x0,x1]（只画屏幕这一段，b07 城门拱换景用）、
 *       detail（1 默认；0 省略碎石小花等小件）、flat（传一个参考机位 cam：冻结视差，各层按参考机位摆好后像同一张纸一起移动）、
 *       windmillAt（风车开转时刻，默认 V09）、moonRise 0..1、moonRoad 0..1、moonBeam 0..1、blizzard 0..1（覆盖时间线）。
 */
export function drawJourney(g, T, c = journeyCam(T), o = {}) {
  const fn = LAYERS[o.layer || 'main'];
  if (!fn) return;
  const spans = o.zone ? [{ z: ZONE_ID[o.zone] ?? 0, x0: -1e6, x1: 1e6 }] : zoneSpans(c);
  for (const sp of spans) {
    let x0 = sp.x0, x1 = sp.x1;
    if (o.clipX) { x0 = Math.max(x0, o.clipX[0]); x1 = Math.min(x1, o.clipX[1]); }
    if (x1 <= x0) continue;
    g.save();
    if (spans.length > 1 || o.clipX) { g.beginPath(); g.rect(x0, -4000, x1 - x0, 9000); g.clip(); }
    fn(g, T, c, sp.z, o);
    g.restore();
  }
}
/** 同一套布景函数的别名（storyboard 里叫 journeyWorld）。 */
export const journeyWorld = drawJourney;
/** 图层纸纹跟随：ctx.layer 的 texOffset = journeyTexOffset(cam, depth)。 */
export const journeyTexOffset = (c, d) => { const z = 1 + (c.zoom - 1) * d; return [-(c.x - 960) * d * z, -(c.y - 540) * d * z]; };
/** journeyTexOffset 的短别名。 */
export const journeyTexOff = journeyTexOffset;

// ———————————————————— E03 倒放色带 ————————————————————
const BAND = [
  { top: PAL.skyNightHigh, low: PAL.skyNight, hill: mixHex(PAL.forestDeep, PAL.skyNight, 0.3), ground: mixHex(PAL.forestDeep, PAL.ink, 0.3) },
  { top: mixHex(PAL.snowShade, PAL.mountain, 0.4), low: mixHex(PAL.skyDayLow, PAL.snow, 0.4), hill: PAL.snowShade, ground: PAL.snow },
  { top: PAL.goldLight, low: PAL.skyDusk, hill: mixHex(PAL.meadow, PAL.gold, 0.45), ground: mixHex(PAL.meadow, PAL.gold, 0.3) },
  { top: PAL.skyDay, low: PAL.skyDayLow, hill: mixHex(PAL.meadow, PAL.grass, 0.3), ground: PAL.meadow },
  { top: mixHex(PAL.skyDayLow, PAL.princessLight, 0.25), low: PAL.skyDayLow, hill: mixHex(PAL.leafLight, PAL.princessLight, 0.3), ground: PAL.leafLight },
];
function bandCol(u, key) {
  const v = clamp(u, 0, BAND.length - 1), i = Math.min(BAND.length - 2, Math.floor(v)), f = smoothstep(0, 1, v - i);
  return mixHex(BAND[i][key], BAND[i + 1][key], f);
}
/**
 * E03（165.10–165.60）倒放：一条预算好的色带（夜 → 冷 → 金 → 绿 → 晨）+ 浓重横向速度线，不逐区画。
 * 屏幕空间整屏；p 0..1 = 倒放进度（0 夜、1 晨）；世界向右飞过（勇者向左骑）。o: { alpha, horizon（地平线 y，默认 760） }
 */
export function rewindBand(g, T, p, o = {}) {
  const { alpha = 1, horizon = 760 } = o;
  const u0 = clamp(p) * (BAND.length - 1);
  g.save();
  g.globalAlpha *= alpha;
  // 天：横向渐变，左边是「下一段」（更接近清晨），右边是刚飞过去的
  const sky = (key, y0, y1) => { const gr = g.createLinearGradient(0, 0, 1920, 0); for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, bandCol(u0 + 0.55 - (i / 8) * 1.1, key)); g.fillStyle = gr; g.fillRect(-20, y0, 1960, y1 - y0); };
  sky('top', -20, horizon * 0.55);
  g.globalAlpha *= 1;
  const gv = g.createLinearGradient(0, 0, 0, horizon);
  gv.addColorStop(0, rgba(bandCol(u0, 'top'), 0)); gv.addColorStop(0.5, rgba(bandCol(u0, 'low'), 0.6)); gv.addColorStop(1, bandCol(u0, 'low'));
  g.fillStyle = gv; g.fillRect(-20, 0, 1960, horizon);
  // 被拉成长条的山丘 / 树影
  const fly = T * 5200;
  for (let row = 0; row < 3; row++) {
    const y = horizon - 150 + row * 70, hh = 60 + row * 26;
    for (let i = 0; i < 7; i++) {
      const w = 700 + hash2(2301 + row, i) * 900;
      const x = fract(hash2(2302 + row, i) + (fly * (0.6 + row * 0.25)) / 4200) * 4200 - 1400;
      g.fillStyle = rgba(bandCol(u0 + 0.5 - (x / 1920) * 1.0, 'hill'), 0.55 + row * 0.15);
      g.beginPath(); g.ellipse(x, y + hh, w / 2, hh, 0, Math.PI, TAU); g.fill();
    }
  }
  // 地面
  const gr = g.createLinearGradient(0, 0, 1920, 0);
  for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, bandCol(u0 + 0.5 - (i / 8), 'ground'));
  g.fillStyle = gr; g.fillRect(-20, horizon, 1960, 1100 - horizon);
  // 速度线（奶油纸色 + 少量深色，向右飞）
  for (let i = 0; i < 46; i++) {
    const y = hash2(2310, i) * 1080, L = 260 + hash2(2311, i) * 900, sp = 0.7 + hash2(2312, i) * 0.9;
    const x = fract(hash2(2313, i) + (T * 6.5 * sp)) * (1920 + L * 2) - L;
    const dark = hash2(2314, i) < 0.25;
    g.strokeStyle = rgba(dark ? PAL.inkSoft : PAL.paper, dark ? 0.22 : 0.55);
    g.lineWidth = 2 + hash2(2315, i) * (dark ? 4 : 9);
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y); g.stroke();
  }
  g.restore();
}

// ———————————————————— 常量导出 ————————————————————
/**
 * 旅途常量（只读）。zones / occluders / fixed / containers / houses / slimes / events / cams / push / layers（推荐的图层配方）。
 */
export const JOURNEY = Object.freeze({
  width: 13400, groundY: 860,
  zones: Object.freeze([
    { id: 'G', x0: 0, x1: 2200, sky: 'skyDay/skyDayLow', zone: 0 }, { id: 'M', x0: 2200, x1: 5600, sky: 'skyDay', zone: 0 },
    { id: 'V', x0: 5600, x1: 7900, sky: 'skyDusk 低 + goldLight 高', zone: 1 }, { id: 'S', x0: 7900, x1: 9600, sky: 'mixHex(skyDayLow, snowShade, 0.5)', zone: 2 },
    { id: 'N', x0: 9600, x1: 12300, sky: 'skyNightHigh→skyNight', zone: 3 }, { id: 'C', x0: 12300, x1: 13400, sky: 'skyNight + dragonDeep 雾', zone: 4 },
  ].map(Object.freeze)),
  occluders: Object.freeze(OCC.map((q, i) => Object.freeze({ kind: q.kind, at: +q.at.toFixed(3), camX: Math.round(q.cx), D: +q.D.toFixed(2), width: q.w, seam: SEAMS.indexOf(q), index: OCC.filter((r, j) => j < i && r.kind === q.kind).length }))),
  fixed: JOURNEY_FIXED,
  containers: Object.freeze(CONTAINERS),
  houses: Object.freeze(HOUSES.map((h) => Object.freeze({ X: Math.round(h.X), depth: HOUSE_D, w: h.w, h: h.h, owner: h.owner, container: h.owner ? h.i : -1, door: Object.freeze([Math.round(LXd(h.X, HOUSE_D) - h.w * 0.12), 838]) }))),
  slimes: Object.freeze(SLIME_POP.map((t, i) => Object.freeze({ at: +t.toFixed(3), x: Math.round(worldAtScreen(t, SLIME_SX[i])), y: 860, slashAt: +SLASH_AT[i].toFixed(3) }))),
  events: Object.freeze({
    hudIn: V01 + 0.5, miniIn: V04 + 0.28, slimes: SLIME_POP, bats: V05 + 0.26, slashes: SLASH_AT, coins: COIN_AT, coinBite: V06 + 1.07, coinBounce: V06 + 1.62,
    treeGag: +T_INJ.toFixed(3), scarfTorn: +T_SCARF.toFixed(3), heartCracks: CRACK_AT, sigh: V07 + 1.39, noseBandage: V07 + 1.59,
    expPop: V08, lvUps: LV_AT, expRetract: [V08 + 1.59, V08 + 1.84], windmill: V09, pigeons: V09, chicken: V09 + 0.9,
    containers: OPEN_AT, grannyHug: V10 + 0.48, faint: V10 + 1.73, breath: BREATH_AT, sneeze: SNEEZE,
    moonRise: MOON_RISE, moonRoad: MOON_ROAD, brake: V13, rear: V13 + 0.16, dismount: [T_DISMOUNT, T_WALK], horseHide: [T_DASH0, T_DASH1],
    miniFlip: V13 + 1.16, hudOut: V13 + 1.26, push: [PUSH.t0, PUSH.t1], rewind: [E03 + 0.02, E03 + 0.52],
  }),
  cams: JOURNEY_CAM_KEYS, push: PUSH,
  layers: Object.freeze([
    Object.freeze({ layer: 'sky', ctxLayer: null }),
    Object.freeze({ layer: 'far', depth: 0.25, ctxLayer: Object.freeze({ shadow: 4, texture: 0.22 }) }),
    Object.freeze({ layer: 'mid', depth: 0.8, ctxLayer: Object.freeze({ shadow: 7, texture: 0.28 }) }),
    Object.freeze({ layer: 'main', depth: 1, ctxLayer: Object.freeze({ shadow: 10, texture: 0.3 }), note: 'main → 角色 → front 画在同一个图层里' }),
    Object.freeze({ layer: 'light', ctxLayer: null }),
    Object.freeze({ layer: 'fg', depth: 1.3, ctxLayer: Object.freeze({ blur: 4, shadow: 12 }) }),
    Object.freeze({ layer: 'occluder', ctxLayer: Object.freeze({ blur: 6 }) }),
  ]),
});
