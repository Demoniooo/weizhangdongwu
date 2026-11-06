// b07 私有：PLAZA 晴晨段（V01 登场 → V02 上马 → V03 众人的希望 → V04 冲出城门）。
// 世界坐标 = 广场主体层（depth 1），地面 y = 860；角色 s = 1。机位全部叠 drift。
import { PAL, glow, sparkle } from '../../core/paper.js';
import { clamp, lerp, seg, smoothstep, hash2, TAU, rgba, mixHex } from '../../core/util.js';
import { cam, applyCam, drift, toScreen } from '../../core/camera.js';
import { outCubic, outBack, inOutCubic, inOutSine, inOutQuad, glide, outQuad } from '../../core/ease.js';
import { stream } from '../../core/particles.js';
import { drawPlaza, drawGateArch, CAMS as PL, PLAZA_LAYER } from '../../env/plaza.js';
import { journeyTexOffset } from '../../env/journey.js';
import { drawHero, heroRig, HERO_SEAT } from '../../rigs/hero.js';
import { drawHorse, horseRig, horsePhase, drawReins } from '../../rigs/horse.js';
import { folkCrowd, drawCrowd, folkStagger } from '../../rigs/folk.js';
import { glyphIcon } from '../../ui/kit.js';
import { dustDraw } from '../../props/misc.js';
import { V01, V02, V03, V04, T_FULL, T_GATE, k01, ring, cbez, mix2 } from './common.js';

// ———————————————————— 站位 ————————————————————
export const HERO_X = 460;      // 勇者亮相站位（脚底）
export const HORSE_STOP = 610;  // 白马急停的位置（脚底中心）
const GY = 860;
/** 交接：红带（屏幕中心、角度 −0.42、宽 110）= 围巾在 PL_SCARF 下穿过的世界点与方向。 */
export const BAND_ANG = -0.42, BAND_W = 110;
const P0 = [PL.PL_SCARF.x, PL.PL_SCARF.y];
const DIR = [Math.cos(BAND_ANG), Math.sin(BAND_ANG)];
const Z_IN = 82; // 74.30 满屏红：围巾宽 27.5 × 82 ≈ 2250px 盖满

// ———————————————————— 白马 ————————————————————
const T_IN0 = V02 - 0.05, T_STOP = V02 + 0.71;            // 75.94 奔入 → 76.70 停稳
const X_IN0 = -230;
const T_REAR = V04 - 0.04, T_DASH = V04 + 0.08;           // 80.18 人立 → 80.30 冲出
const DASH_A = 2380, DASH_V = 1070;                        // 冲出加速度 / 末速（= 旅途 81.00 机位速度）
const DASH_T1 = DASH_V / DASH_A;
function horseX(T) {
  if (T < T_STOP) { const u = seg(T, T_IN0, T_STOP); return lerp(X_IN0, HORSE_STOP, 1 - (1 - u) ** 2); }
  if (T < T_DASH) return HORSE_STOP;
  const t = T - T_DASH;
  return t < DASH_T1 ? HORSE_STOP + 0.5 * DASH_A * t * t : HORSE_STOP + 0.5 * DASH_A * DASH_T1 * DASH_T1 + DASH_V * (t - DASH_T1);
}
function horseSpeed(T) {
  if (T < T_STOP) { const u = seg(T, T_IN0, T_STOP); return T < T_IN0 ? 0 : (2 * (1 - u) * (HORSE_STOP - X_IN0)) / (T_STOP - T_IN0); }
  if (T < T_DASH) return 0;
  const t = T - T_DASH;
  return t < DASH_T1 ? DASH_A * t : DASH_V;
}
const LAND = V02 + 1.71; // 77.70 落鞍
const landSq = (T) => (T > LAND ? -0.16 * Math.exp(-(T - LAND) / 0.12) * Math.cos((T - LAND) * 26) : 0);

export function horseO(T) {
  const x = horseX(T), sp = horseSpeed(T);
  const kk = (a, b) => inOutQuad(seg(T, a, b));
  let pose = 'speedLines', ex = {};
  if (T >= V02 + 0.5) pose = { from: 'gallop', to: 'skid', k: kk(V02 + 0.5, V02 + 0.62) }, ex.at = V02 + 0.56;
  if (T >= V02 + 0.71) { pose = { from: 'skid', to: 'rear', k: kk(V02 + 0.71, V02 + 0.82) }; ex.at = V02 + 0.56; }
  if (T >= V02 + 0.82) { pose = { from: 'rear', to: 'tossMane', k: kk(V02 + 0.82, V02 + 0.92) }; ex = { at: V02 + 0.96 }; }
  if (T >= V02 + 1.3) { pose = { from: 'tossMane', to: 'stand', k: kk(V02 + 1.3, V02 + 1.45) }; ex = { at: V02 + 0.96, stamp: LAND + 0.03 }; }
  if (T >= V02 + 1.45) { pose = 'stand'; ex = { stamp: LAND + 0.03 }; }
  if (T >= V03 + 1.46) { pose = { from: 'stand', to: 'pawGround', k: kk(V03 + 1.46, V03 + 1.56) }; ex = { paw: [V03 + 1.66, V03 + 1.91] }; }
  if (T >= T_REAR) { pose = { from: 'pawGround', to: 'rear', k: kk(T_REAR, T_REAR + 0.07) }; ex = { paw: [V03 + 1.66, V03 + 1.91] }; }
  if (T >= T_DASH) pose = { from: 'rear', to: 'gallop', k: kk(T_DASH, T_DASH + 0.12) }, ex = {};
  const moving = T < T_STOP || T >= T_DASH;
  return {
    x, y: GY, s: 1, face: 1, t: T, pose, ...ex,
    phase: moving ? horsePhase(x) : horsePhase(HORSE_STOP), speed: Math.max(sp, 1), vel: [sp, 0],
    squash: landSq(T), speedLines: T < V02 + 0.45 ? 1 : T >= T_DASH + 0.25 ? 0.6 * k01(T, T_DASH + 0.25, T_DASH + 0.5) : 0,
  };
}

// ———————————————————— 勇者 ————————————————————
const T_CROUCH = V02 + 1.11, T_JUMP = V02 + 1.26;          // 77.10 下蹲 → 77.25 起跳 → 77.70 落鞍
const LEN0 = 780, LEN1 = 936;                               // 79.60 变长 20%
const T_GROW = V03 + 1.46;                                  // 79.60
/** 众人心愿：20 颗光点（错峰 45ms 起飞，飞 0.45s，最后一颗 79.60 前到）。 */
const N_LIGHT = 20, L_T0 = V03 + 0.16, L_STEP = 0.045, L_FLY = 0.45;
export const lightArrive = (i) => L_T0 + i * L_STEP + L_FLY;
function scarfGlow(T) {
  let g = 0;
  for (let i = 0; i < N_LIGHT; i++) { const a = lightArrive(i); if (T >= a) g = Math.max(g, 0.85 * Math.exp(-(T - a) / 0.16)); }
  const base = 0.6 * outBack(k01(T, T_GROW - 0.05, T_GROW + 0.25), 2);
  return clamp(Math.max(g, base), 0, 1);
}
const scarfLen = (T) => lerp(LEN0, LEN1, outBack(k01(T, T_GROW - 0.05, T_GROW + 0.3), 1.6));
/** 风：V01–V03 往右上飘（勇者亮相的顺风），冲出后归零（气流 = −速度，围巾平拖在身后）。 */
const windAt = (T) => { const k = 1 - k01(T, T_REAR, T_DASH + 0.3, inOutSine); return [560 * k, -240 * k]; };

/** 围巾特写段的中心线（世界坐标）：从结点上行、在 P0 以 −0.42 的方向穿过，再往右上延伸；whip = V01 的一甩。 */
function shapeA(knot, T, len) {
  const C1 = [knot[0] - 26, knot[1] - 150], C2 = [P0[0] - DIR[0] * 190, P0[1] - DIR[1] * 190];
  const pts = [];
  for (let i = 0; i <= 24; i++) pts.push(cbez(knot, C1, C2, P0, i / 24));
  for (let i = 1; i <= 26; i++) {
    const d = i * 22, bend = Math.max(0, d - 260);
    pts.push([P0[0] + DIR[0] * d, P0[1] + DIR[1] * d - 0.0016 * bend * bend]);
  }
  // 弧长参数
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  // 74.30 起轻轻飘动；V01 一甩：一道行波从根部冲向末端
  const flut = 3.5 * k01(T, T_FULL, T_FULL + 0.12);
  // 一甩：一个行波包 74.38 从画面左下（u≈0.22）冲出，74.45 过画面中心（P0，u≈0.41），之后冲向末端渐弱
  const wAmp = T < V01 - 0.03 ? 0 : 27 * smoothstep(V01 - 0.03, V01 + 0.02, T) * Math.exp(-Math.max(0, T - V01 - 0.05) / 0.35);
  const uc = 0.22 + 3.0 * (T - (V01 - 0.02));
  return pts.map((p, i) => {
    const u = L[i] / len;
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    const off = flut * Math.sin(TAU * (1.3 * u - 1.6 * (T - T_FULL))) * u + wAmp * Math.sin(TAU * (u - uc) * 2.4) * Math.exp(-((u - uc) ** 2) / 0.012) * Math.min(1, u * 3);
    return [p[0] - (ty / tl) * off, p[1] + (tx / tl) * off];
  });
}

/** 勇者的绘制参数（ha = 马的锚点，骑乘 / 上马时用）。 */
export function heroO(T, ha) {
  const len = scarfLen(T), glowS = scarfGlow(T);
  const wind = windAt(T), sp = horseSpeed(T), riding = T >= LAND;
  let o;
  if (T < T_JUMP) {
    // 站姿：亮相（叉腰扛剑）→ 瞥 HUD 皱眉 → 回头看马 → 下蹲蓄力
    const crouch = k01(T, T_CROUCH, T_JUMP, outCubic);
    let expr = 'smug', yaw;
    if (T >= V01 + 0.97 && T < V02 - 0.12) { expr = 'squint'; yaw = lerp(1, -0.28, k01(T, V01 + 0.97, V01 + 1.12, inOutSine)); }
    if (T >= V02 - 0.12) { expr = 'shock'; yaw = lerp(-0.28, -0.6, k01(T, V02 - 0.12, V02 + 0.05, inOutSine)); }
    if (T >= V02 + 0.45) { expr = 'grin'; yaw = lerp(-0.6, 1, k01(T, V02 + 0.45, V02 + 0.65, inOutSine)); }
    if (T >= V02 + 0.95) { expr = 'laugh'; yaw = 1; }
    if (T >= T_CROUCH - 0.08) { expr = 'determined'; yaw = 1; }
    o = {
      x: HERO_X, y: GY, pose: 'heroPose', expr, yaw, squash: -0.2 * crouch, jointsAdd: { lean: 12 * crouch, nod: 6 * crouch },
      ahogeAt: V01 + 0.8, toothSparkle: V01 + 0.86, swordGlint: k01(T, V01 + 0.78, V01 + 1.1), // 机位落定 PL-HERO 那一下：亮相闪光
    };
  } else if (!riding) {
    // 起跳成弧（臀底从站姿的 脚底 − HERO_SEAT 飞到鞍顶）
    const u = k01(T, T_JUMP, LAND);
    const g0 = [HERO_X, GY - HERO_SEAT], g1 = ha.saddle;
    const p = [lerp(g0[0], g1[0], u), lerp(g0[1], g1[1], u) - 175 * 4 * u * (1 - u)];
    o = { x: p[0], y: p[1], pose: 'mount', expr: 'grin', rot: lerp(0.1, ha.saddleRot, u), joints: { aF: [40, 149, 0] } };
  } else {
    let expr = 'grin';
    if (T >= V03 + 0.25) expr = 'laugh';
    if (T >= T_GROW - 0.08) expr = 'determined';
    if (T >= T_REAR - 0.06) expr = 'shout';
    if (T >= T_DASH + 0.25) expr = 'determined';
    const still = T < T_DASH;
    o = {
      x: ha.saddle[0], y: ha.saddle[1], pose: 'ride', expr, rot: ha.saddleRot, squash: landSq(T),
      phase: still ? 0.3 : ha.phaseRide, joints: { aF: [40, 149, 0] }, yaw: T >= V03 && T < T_GROW ? lerp(1, 0.55, bell(T, V03, T_GROW)) : 1,
    };
  }
  return {
    ...o, s: 1, face: 1, t: T, sword: 'shoulder',
    scarf: { len, glow: glowS, wind, vel: [riding ? sp : 0, 0], ground: riding ? GY : undefined },
  };
}
function bell(T, a, b) { return Math.sin(Math.PI * seg(T, a, b)); }

/** 74.30–75.20：围巾从“红带”形状松回自然飘动（同时宽度从 27.5 收回默认 22 → 8）。 */
function scarfBlendK(T) { return 1 - k01(T, V01 + 0.12, V01 + 0.8, inOutSine); }

// ———————————————————— 群众（20 只手 = 20 颗光点） ————————————————————
const ROW_B = folkCrowd(8, { x0: 860, x1: 1560, y: 838, s: 0.9, face: -1, seed: 71, start: 2, xJit: 0.18 });
const ROW_F = folkCrowd(9, { x0: 820, x1: 1520, y: 853, s: 1, face: -1, seed: 73, start: 7, xJit: 0.18 });
export const CROWD = [
  ...ROW_B.map((m) => ({ ...m, i: m.i })),
  ...ROW_F.map((m) => ({ ...m, i: m.i + 8 })),
  { i: 17, kind: 'herald', x: 1000, y: 860, face: -1, seed: 5 },
  { i: 18, kind: 'guard', x: 1620, y: 852, face: -1, seed: 9, variant: 1 },
  { i: 19, kind: 'guard', x: 1250, y: 840, s: 0.92, face: -1, seed: 11, variant: 2 },
];
const LIGHT_ORDER = [8, 3, 12, 17, 0, 10, 5, 14, 19, 1, 9, 6, 15, 18, 2, 11, 4, 13, 16, 7]; // 起飞顺序（从近到远交错）
function crowdPose(T, m) {
  const isG = m.kind === 'guard', isH = m.kind === 'herald';
  const base = isG ? 'attention' : 'idle';
  const kUp = folkStagger(T, V03, m.i, { step: 0.05, dur: 0.24, ease: (x) => outBack(x, 1.6) });
  const kCheer = folkStagger(T, T_DASH + 0.05, m.i, { step: 0.03, dur: 0.2 });
  const surprised = T >= V02 + 0.5 && T < V02 + 1.2;
  let expr = surprised ? 'surprise' : 'happy';
  if (isG) expr = surprised ? 'surprise' : 'normal';
  if (kCheer > 0) return { pose: { from: 'raiseHand', to: isG ? 'cheer' : 'cheer', k: kCheer }, expr: 'happy' };
  if (kUp > 0) return { pose: { from: base, to: 'raiseHand', k: kUp }, expr: 'hope' };
  // 亮相时前排两个人朝勇者挥手（错峰）
  if ((m.i === 8 || m.i === 11) && T >= V01 + 0.5 && T < V02 + 0.4) {
    const k = smoothstep(V01 + 0.5 + (m.i === 11 ? 0.12 : 0), V01 + 0.7 + (m.i === 11 ? 0.12 : 0), T) * (1 - smoothstep(V02 + 0.2, V02 + 0.4, T));
    return { pose: { from: 'idle', to: 'wave', k }, expr: surprised ? 'surprise' : 'happy' };
  }
  void isH;
  return { pose: base, expr };
}

// ———————————————————— 机位 ————————————————————
const CAM_HERO2 = cam(545, 612, 1.55);
/** PL-HOPE 往左让 75px：storyboard 的 cam(1060,600,1.45) 会把骑手切在画左边缘。 */
const CAM_HOPE = cam(985, 600, 1.45);
function plazaCamBase(T) {
  if (T < V01) { // 74.30 满屏红（贴在围巾上）→ 74.40 拉开到围巾特写
    const e = inOutCubic(k01(T, T_FULL, V01 + 0.02));
    return cam(P0[0], P0[1], Math.exp(lerp(Math.log(Z_IN), Math.log(PL.PL_SCARF.zoom), e)));
  }
  if (T < V01 + 0.05) return PL.PL_SCARF;
  if (T < V01 + 0.8) { // 顺着围巾往下拉到 PL-HERO
    const u = glide(k01(T, V01 + 0.05, V01 + 0.8));
    const a = PL.PL_SCARF, b = PL.PL_HERO;
    return cam(lerp(a.x, b.x, u) - 46 * Math.sin(Math.PI * u), lerp(a.y, b.y, u), a.zoom * Math.pow(b.zoom / a.zoom, u));
  }
  if (T < V02 - 0.09) return PL.PL_HERO;
  if (T < V02 + 0.51) { const u = glide(k01(T, V02 - 0.09, V02 + 0.51)); return cam(lerp(560, 460, u), 600, 1.6); }
  if (T < V03 - 0.04) { const u = glide(k01(T, V02 + 0.51, V02 + 1.9)); const b = CAM_HERO2; return cam(lerp(460, b.x, u), lerp(600, b.y, u), 1.6 * Math.pow(b.zoom / 1.6, u)); }
  const H = CAM_HOPE;
  if (T < T_DASH) { const u = glide(k01(T, V03 - 0.04, V04 - 0.02)); const a = CAM_HERO2; return cam(lerp(a.x, H.x, u), lerp(a.y, H.y, u), a.zoom * Math.pow(H.zoom / a.zoom, u)); }
  // 冲出：跟拍，81.00 时勇者落在屏幕 x≈760、zoom 1.15、camY 560（与旅途机位同一构图）
  const u = inOutSine(k01(T, T_DASH, T_GATE - 0.05));
  const z = lerp(H.zoom, 1.15, u), y = lerp(H.y, 560, u);
  const sx0 = 960 + (HORSE_STOP - H.x) * H.zoom;
  const sx = lerp(sx0, 760, u);
  return cam(horseX(T) + (960 - sx) / z, y, z);
}
export function plazaCam(T) {
  const c = plazaCamBase(T);
  const [dx, dy] = drift(T, { amp: 5, speed: 0.35, seed: 7 });
  const k = k01(T, V01 - 0.02, V01 + 0.3); // 满屏红到特写这一段不漂（避免露边）
  return cam(c.x + (dx * k) / c.zoom, c.y + (dy * k) / c.zoom, c.zoom, 0);
}

// ———————————————————— 画一帧广场 ————————————————————
/**
 * o: { merge（重叠期 / 换景期：远+中景合并 1 层、前景并入或交给调用方）, noFg, clipLeft（只画屏幕 x < clipLeft 的部分：城门拱换景）}
 * 返回 { c, hero（勇者锚点）, horse（马锚点） }。
 */
export function drawPlazaWorld(g, T, ctx, o = {}) {
  const c = plazaCam(T);
  const P = { time: 'morning', notice: 'corners', farKing: T >= V03 ? 'wave' : 'idle', t: T };
  // 注意：ctx.layer 的离屏画布来自缓冲池，clip 必须包在 save/restore 里，否则会漏到之后的帧
  const clip = (lg) => { if (o.clipLeft != null) { lg.beginPath(); lg.rect(-50, -50, o.clipLeft + 50, 1200); lg.clip(); } };
  const L = (opt, fn) => ctx.layer(g, opt, (lg) => { lg.save(); clip(lg); fn(lg); lg.restore(); });
  g.save(); clip(g);
  drawPlaza(g, T, c, { ...P, layer: 'sky' });
  g.restore();
  const farO = { ...PLAZA_LAYER.far, texOffset: journeyTexOffset(c, 0.4) };
  if (o.merge) {
    L({ shadow: 7, texture: 0.27, texOffset: journeyTexOffset(c, 0.6) }, (lg) => { drawPlaza(lg, T, c, { ...P, layer: 'far' }); drawPlaza(lg, T, c, { ...P, layer: 'mid' }); });
  } else {
    L(farO, (lg) => drawPlaza(lg, T, c, { ...P, layer: 'far' }));
    L({ ...PLAZA_LAYER.mid, texOffset: journeyTexOffset(c, 0.8) }, (lg) => drawPlaza(lg, T, c, { ...P, layer: 'mid' }));
  }
  let heroA = null, horseA = null, crowdA = null;
  const hO = horseO(T);
  const showHorse = T >= T_IN0;
  L({ shadow: 9, texture: 0.3, texOffset: journeyTexOffset(c, 1) }, (lg) => {
    drawPlaza(lg, T, c, { ...P, layer: 'main' });
    lg.save(); applyCam(lg, c, 1);
    // 群众（站在后排地面 y 838–860，马从他们面前跑过）
    crowdA = drawCrowd(lg, CROWD, { t: T, each: (m) => crowdPose(T, m) });
    // 尘土（急停、冲出）在马之前画
    drawDust(lg, T);
    let ha = null;
    if (showHorse) {
      ha = horseRig(hO);
      ha.phaseRide = hO.phase; // gallop 1 周期 = 1 个马步
    }
    const ho = heroO(T, ha || { saddle: [HORSE_STOP, 700], saddleRot: 0 });
    // 围巾特写段：自定义中心线（trail）从红带形状松回自然飘动
    const kA = scarfBlendK(T);
    if (kA > 0) {
      const natural = heroRig(ho);
      const A = shapeA(natural.neck, T, ho.scarf.len);
      const B = natural.scarf;
      const Ares = resampleTo(A, B.length, ho.scarf.len);
      const pts = B.map((b, i) => mix2(b, Ares[i], kA));
      ho.scarf = { ...ho.scarf, trail: pts.map((p) => [p[0] - natural.neck[0], p[1] - natural.neck[1]]), lag: 0.0005, wind: [0, 0], vel: [0, 0], width: lerp(22, 30.5, kA), endWidth: lerp(8, 18, kA) };
    }
    if (showHorse && T >= LAND) {
      // 骑乘：马 → 勇者 → 缰绳（马镫挂勇者靴底）
      const foot = heroRig(ho).foot;
      horseA = drawHorse(lg, { ...hO, stirrupAt: foot });
      heroA = drawHero(lg, ho);
      if (heroA.handL) drawReins(lg, horseA.bit, heroA.handL, { s: 1 });
    } else {
      if (showHorse) horseA = drawHorse(lg, hO);
      heroA = drawHero(lg, ho);
    }
    lg.restore();
  });
  // 心愿光点（screen 光晕不吃纸片投影，单独一层）
  if (T >= V03 && T < T_GROW + 0.5 && heroA && crowdA) {
    L({}, (lg) => drawLights(lg, T, c, crowdA, heroA));
  }
  g.save(); clip(g);
  drawPlaza(g, T, c, { ...P, layer: 'light' });
  g.restore();
  if (!o.noFg) {
    L({ ...PLAZA_LAYER.fg, texOffset: journeyTexOffset(c, 1.35) }, (lg) => drawPlaza(lg, T, c, { ...P, layer: 'fg' }));
  }
  return { c, hero: heroA, horse: horseA, P };
}
/** 城门拱换景时，广场前景（彩旗、木桶、花箱）交给调用方合并进前景层（clipLeft 裁剪）。 */
export function drawPlazaFg(lg, T, c, clipLeft) {
  lg.save();
  lg.beginPath(); lg.rect(-50, -50, clipLeft + 50, 1200); lg.clip();
  drawPlaza(lg, T, c, { time: 'morning', notice: 'corners', t: T, layer: 'fg' });
  lg.restore();
}

function resampleTo(pts, n, len) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const s = (len * k) / (n - 1);
    while (j < L.length - 1 && L[j] < s) j++;
    const f = clamp((s - L[j - 1]) / (L[j] - L[j - 1] || 1));
    out.push([lerp(pts[j - 1][0], pts[j][0], f), lerp(pts[j - 1][1], pts[j][1], f)]);
  }
  return out;
}

// ———————————————————— 尘土 ————————————————————
function drawDust(lg, T) {
  // 急停扬尘
  if (T > V02 + 0.45 && T < V02 + 1.6) {
    stream(lg, T, { start: V02 + 0.48, end: V02 + 0.8, rate: 40, seed: 31, life: [0.5, 0.9], size: [14, 26],
      emit: (tb, i, r) => { const x = horseX(tb) + 60 + 40 * r; return { x, y: GY - 6, vx: 120 + 220 * r, vy: -60 - 90 * r }; } }, dustDraw);
  }
  // 冲出扬尘
  if (T > T_DASH - 0.05 && T < T_GATE + 0.6) {
    stream(lg, T, { start: T_DASH, end: T_GATE + 0.4, rate: 34, seed: 37, life: [0.45, 0.8], size: [16, 30],
      emit: (tb, i, r) => { const x = horseX(tb) - 70 - 40 * r; return { x, y: GY - 4, vx: -180 - 160 * r, vy: -50 - 70 * r }; } }, dustDraw);
  }
}

// ———————————————————— 心愿光点 ————————————————————
function drawLights(lg, T, c, crowdA, heroA) {
  const sc = heroA.scarf; // 28 个世界点
  for (let j = 0; j < N_LIGHT; j++) {
    const mi = LIGHT_ORDER[j];
    const a = crowdA[mi];
    if (!a) continue;
    const t0 = L_T0 + j * L_STEP, t1 = t0 + L_FLY;
    const born = k01(T, t0 - 0.16, t0, outBack);
    if (born <= 0) continue;
    const hand0 = toScreen(c, 1, a.hand[0], a.hand[1] - 18);
    const hand = [hand0[0], hand0[1] - 46 * c.zoom * outCubic(k01(T, t0 - 0.16, t0))];
    const ti = Math.round(lerp(7, 26, (j * 7) % 20 / 19));
    const tgt = toScreen(c, 1, sc[ti][0], sc[ti][1]);
    const heart = j % 3 === 1;
    if (T < t1) {
      const u = outQuad(k01(T, t0, t1));
      const ctl = [lerp(hand[0], tgt[0], 0.35) + 60 * (hash2(j, 3) - 0.5), Math.min(hand[1], tgt[1]) - 160 - 80 * hash2(j, 4)];
      const lift = (1 - k01(T, t0 - 0.16, t0)) * 0; void lift;
      const p = qb(hand, ctl, tgt, u);
      const p2 = qb(hand, ctl, tgt, Math.max(0, u - 0.12));
      const size = (heart ? 40 : 46) * c.zoom * 0.72 * born * (1 - 0.3 * u);
      // 拖尾
      lg.save(); lg.globalCompositeOperation = 'screen';
      lg.strokeStyle = rgba(PAL.goldLight, 0.5 * born); lg.lineWidth = size * 0.28; lg.lineCap = 'round';
      lg.beginPath(); lg.moveTo(p2[0], p2[1]); lg.quadraticCurveTo(lerp(p2[0], p[0], 0.5), lerp(p2[1], p[1], 0.5) - 6, p[0], p[1]); lg.stroke();
      lg.restore();
      glow(lg, p[0], p[1], size * 2.1, heart ? PAL.heart : PAL.goldLight, 0.75 * born);
      glow(lg, p[0], p[1], size * 0.9, PAL.white, 0.45 * born);
      glyphIcon(lg, heart ? 'heart' : 'star', p[0], p[1], size, { rot: (T - t0) * 4 * (j % 2 ? 1 : -1), alpha: born });
    } else {
      const age = T - t1;
      if (age < 0.3) {
        const e = 1 - age / 0.3;
        glow(lg, tgt[0], tgt[1], 70 * c.zoom * 0.6 * (0.6 + 0.4 * e), PAL.goldLight, 0.7 * e);
        sparkle(lg, tgt[0], tgt[1], 34 * c.zoom * 0.6 * (0.4 + 0.6 * e), { color: PAL.white, alpha: e, rot: j });
      }
    }
  }
  // 79.60 通体金边：沿围巾一串闪光
  const g0 = k01(T, T_GROW - 0.04, T_GROW + 0.06) * (1 - k01(T, T_GROW + 0.2, T_GROW + 0.48));
  if (g0 > 0) {
    for (let i = 4; i < sc.length; i += 3) {
      const p = toScreen(c, 1, sc[i][0], sc[i][1]);
      sparkle(lg, p[0], p[1], 26 * c.zoom * 0.7 * g0 * (0.6 + 0.4 * Math.sin(i + T * 20)), { color: PAL.goldLight, alpha: g0, rot: i * 0.7 });
    }
    glow(lg, toScreen(c, 1, sc[14][0], sc[14][1])[0], toScreen(c, 1, sc[14][0], sc[14][1])[1], 380 * g0, PAL.goldLight, 0.35 * g0);
  }
}
const qb = (a, b, cc, u) => [(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * b[0] + u * u * cc[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * b[1] + u * u * cc[1]];

/** 城门拱（屏幕空间前景）：左墩中线 = 换景接缝。 */
export function drawGate(lg, T, seamX) {
  return drawGateArch(lg, T, { x: seamX, time: 'morning', t: T });
}
void mixHex; void ring;
