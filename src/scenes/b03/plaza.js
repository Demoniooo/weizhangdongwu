// b03 私有：城下广场段（19.95–25.35）—— 机位、群演、传令官、卫兵、勇者、告示与冲击。
// 布景一律走 env/plaza.js（drawPlaza 分层 + noticeOpts）；角色 s = 1，脚底 y ≈ 860。
import { PAL, rgba, mixHex, blob, cut } from '../../core/paper.js';
import { cam, applyCam, toScreen, lerpCam, drift } from '../../core/camera.js';
import { clamp, lerp, seg, hit, wobble, hash2, TAU, fract } from '../../core/util.js';
import { ez, glide, snap, whip, outCubic, outQuad, outQuart, outBack, inOutSine, inQuad } from '../../core/ease.js';
import { burst, stream } from '../../core/particles.js';
import { drawPlaza, CAMS, PLAZA, PLAZA_LAYER } from '../../env/plaza.js';
import { drawCrowd } from '../../rigs/folk.js';
import { drawHero } from '../../rigs/hero.js';
import { scarfTrail } from '../../props/scarf.js';
import { drawNotice } from '../../props/paper.js';
import { drawTumbleweed, dustDraw, sparkDraw, drawShockRing } from '../../props/misc.js';
import { bubble, glyphIcon } from '../../ui/kit.js';
import { paperGlyph } from '../../ui/type.js';
import { impact, speedLines } from '../../fx/transitions.js';
import { B_START, L06, L07, L08, TT } from './timing.js';

// ———————————————————— 机位 ————————————————————
const ARRIVE = cam(706, 596, 1.33); // 左摇到勇者方向：光柱、勇者、左组人群、传令官、远景阳台都在画里
const ARRIVE2 = cam(676, 604, 1.42); // 吸气前缓推

/** 广场机位（不含 drift / 震动）。各段 lerp 依次覆盖：k 在段前为 0、段后为 1。 */
export function plazaBaseCam(T) {
  let c = lerpCam(CAMS.PL_TOP, CAMS.PL_W, outQuart(seg(T, B_START, B_START + 0.2)));
  c = lerpCam(c, CAMS.PL_CROWD, ez(T, TT.push[0], TT.push[1], outCubic));
  c = lerpCam(c, cam(1012, 562, 1.34), ez(T, TT.push[1], L07, inOutSine)); // 慢慢再贴近一点（空场的尴尬）
  c = lerpCam(c, ARRIVE, ez(T, TT.pan[0], TT.pan[1] + 0.06, glide));
  c = lerpCam(c, ARRIVE2, ez(T, TT.pan[1] + 0.3, TT.cu[0], inOutSine));
  c = lerpCam(c, CAMS.PL_HERO_CU, ez(T, TT.cu[0], TT.cu[1], snap));
  c = lerpCam(c, CAMS.PL_W, ez(T, TT.whipBack[0], TT.whipBack[1], whip));
  return c;
}
/** 加 drift（按 zoom 收敛，特写里也只轻轻晃）。 */
export function plazaCam(T) {
  const c = plazaBaseCam(T);
  const [dx, dy] = drift(T, { amp: 5, speed: 0.35, seed: 31 });
  const k = 1 / Math.sqrt(c.zoom);
  return cam(c.x + dx * k, c.y + dy * k, c.zoom, c.rot);
}

// ———————————————————— 冲击波（L08） ————————————————————
const MOUTH = [554, 688]; // 勇者站定 x=520 时的嘴（heroRig 实测）
const WAVE_V = 2300;
/** 冲击波到达世界 x 的时刻（帽子、头发、告示都按它错峰）。 */
export const waveAt = (x) => TT.wave0 + Math.max(0, Math.abs(x - MOUTH[0]) - 60) / WAVE_V;

// ———————————————————— 群演 ————————————————————
// grp：L 左组（面朝右，看告示）｜R 右组（面朝左）｜H 传令官
const CROWD0 = [
  { i: 0, variant: 9, x: 702, y: 864, face: 1, grp: 'L', seed: 11 },
  { i: 1, variant: 0, x: 770, y: 857, face: 1, grp: 'L', seed: 12 },
  { i: 2, variant: 2, x: 838, y: 866, face: 1, grp: 'L', seed: 13 },
  { i: 3, variant: 6, x: 898, y: 855, face: 1, grp: 'L', seed: 14 },
  { i: 4, variant: 5, x: 1250, y: 861, face: -1, grp: 'R', seed: 15, hider: true },
  { i: 5, kind: 'guard', variant: 0, x: 1312, y: 863, face: -1, grp: 'R', seed: 16 },
  { i: 6, variant: 8, x: 1392, y: 857, face: -1, grp: 'R', seed: 17 },
  { i: 7, variant: 11, x: 1468, y: 866, face: -1, grp: 'R', seed: 18 },
  { i: 8, kind: 'herald', x: 990, y: 869, face: 1, grp: 'H', seed: 19 },
];
const LEAN_ORDER = [6, 4, 2, 1, 3, 5, 0, 7, 0]; // 离告示近的先凑过去（下标 = i）
const BACK_JIT = [0.05, 0.0, 0.03, 0.06, 0.02, 0.04, 0.01, 0.055, 0];
const BACK_DX = [-58, -50, -46, -40, 0, 30, 46, 58, 0]; // 退一步（世界 x）；右组往右
const BACK_DY = [10, 6, 12, 4, 0, 2, 8, 12, 0]; // 顺带往镜头前一点，站成半圆
const TURN_ORDER = [0, 1, 2, 3, 6, 5, 7, 8, 4]; // 23.10 转头：离勇者近的先转
const kStag = (T, t0, dur, ease = outCubic) => ease(clamp((T - t0) / dur));

/** 卷着的告示从传令官手里抛上告示板（世界坐标）：返回 null 表示不画。 */
function rollFlight(T, hand) {
  const t0 = TT.slap - 0.13, t1 = TT.slap;
  if (T >= t1) return null;
  if (T < t0) return hand ? { x: hand[0] + 4, y: hand[1] - 6, rot: -0.3, s: 1 } : null;
  const u = (T - t0) / (t1 - t0);
  const a = [1072, 770], b = [PLAZA.board.cx, PLAZA.board.cy - 100];
  return { x: lerp(a[0], b[0], u) - 40 * Math.sin(Math.PI * u), y: lerp(a[1], b[1], outQuad(u)), rot: -0.3 + 7 * u, s: 1 };
}

function citizenState(m, T) {
  const L = m.grp === 'L', R = m.grp === 'R';
  const tLean = TT.lean + 0.04 * LEAN_ORDER[m.i];
  const tBack = TT.back + BACK_JIT[m.i];
  const tTurn = TT.turn + 0.05 * TURN_ORDER[m.i];
  const tFlip = tTurn + 0.32;
  const tBlow = waveAt(m.x);
  const kLean = kStag(T, tLean, 0.3);
  const kBack = kStag(T, tBack, 0.22, (x) => outBack(x, 1.4));
  const kRelax = kStag(T, TT.beam + 0.15 + 0.03 * m.i, 0.35, inOutSine);
  const kTurn = kStag(T, tTurn, 0.25);
  const kBlow = kStag(T, tBlow, 0.12);
  // 世界位移：退一步（含 stepBack 自带的 −16 补偿，位移全部由这里给）
  let x = m.x + BACK_DX[m.i] * kBack, y = m.y + BACK_DY[m.i] * kBack;
  if (m.hider) { const kh = kStag(T, tBack + 0.05, 0.3, (q) => outBack(q, 1.2)); x = lerp(m.x, 1352, kh); y = lerp(m.y, 852, kh); }
  // 20.10 「啪」一下：众人一哆嗦（离告示越近越早）
  const startle = Math.sin(Math.PI * clamp((T - TT.slap - 0.02 - Math.abs(m.x - 1080) * 0.00012) / 0.16)) * 9;
  // 风滚草经过：眼珠跟着它
  const tw = tumbleState(T);
  let look = 0;
  if (tw && kBack > 0.5) look = clamp((tw.x - x) / 260, -1, 1) * (m.face);
  let face = m.face, pose, joints = { bob: startle }, expr, sweat;
  let hatFly;
  if (kBlow > 0) {
    // L08 冲击波：全体被吹（左组此时已转身面朝勇者）
    face = L ? -1 : m.face;
    pose = { from: L ? 'lean' : 'lean', to: 'blown', k: kBlow };
    hatFly = clamp((T - tBlow) / 0.8);
  } else if (T >= tTurn) {
    if (L) {
      // 左组：先扭头看身后，再整个人转过来（一跳 + 挤压）
      const kf = kStag(T, tFlip, 0.12);
      if (kf <= 0) { pose = { from: 'idle', to: 'turnHead', k: kTurn }; }
      else { face = -1; pose = { from: 'turnHead', to: 'lean', k: kf }; joints.bob += Math.sin(Math.PI * kf) * 16; joints.sq = -0.1 * Math.sin(Math.PI * kf); }
    } else {
      pose = { from: 'idle', to: 'lean', k: kTurn }; expr = 'surprise';
    }
    // 吸气那一下：所有人一起往前探
    joints.lean = 6 * ez(T, TT.inhale[0], TT.inhale[1], inOutSine);
  } else if (kRelax > 0) {
    pose = { from: 'stepBack', to: 'idle', k: kRelax };
    joints.dx = 16 * (1 - kRelax);
    joints.lookY = -0.9 * Math.sin(Math.PI * clamp((T - TT.beam - 0.1) / 0.9));
    expr = kRelax > 0.3 ? 'surprise' : undefined;
  } else if (kBack > 0) {
    pose = { from: 'lean', to: 'stepBack', k: Math.min(1, kBack) };
    joints.dx = 16 * Math.min(1, kBack);
    joints.look = look;
    if (m.hider) joints.lean = 4 * kBack; // 从卫兵身后探头
    sweat = 0.8;
  } else {
    pose = { from: 'idle', to: 'lean', k: kLean };
  }
  return { x, y, face, pose, joints, expr, sweat, hatFly };
}

function guardState(m, T) {
  const tLean = TT.lean + 0.04 * LEAN_ORDER[m.i];
  const tBack = TT.back + BACK_JIT[m.i];
  const tBlow = waveAt(m.x);
  const kLean = kStag(T, tLean, 0.3), kBack = kStag(T, tBack, 0.22, (x) => outBack(x, 1.4));
  const kWh = kStag(T, TT.whistle[0], 0.2) * (1 - kStag(T, TT.whistle[1], 0.2));
  const kTurn = kStag(T, TT.turn + 0.05 * TURN_ORDER[m.i], 0.25);
  const kBlow = kStag(T, tBlow, 0.12);
  const x = m.x + BACK_DX[m.i] * kBack, y = m.y + BACK_DY[m.i] * kBack;
  const startle = Math.sin(Math.PI * clamp((T - TT.slap - 0.06) / 0.16)) * 7;
  let pose, joints = { bob: startle }, hatFly, hat = true;
  if (kBlow > 0) { pose = { from: 'lean', to: 'blown', k: kBlow }; hatFly = clamp((T - tBlow) / 0.8); if (hatFly >= 1) { hat = false; hatFly = undefined; } }
  else if (kTurn > 0) pose = { from: kWh > 0 ? 'whistle' : 'attention', to: 'lean', k: kTurn };
  else if (kWh > 0) { pose = { from: 'stepBack', to: 'whistle', k: kWh }; joints.dx = 14 * (1 - kWh); }
  else if (kBack > 0) { pose = { from: 'lean', to: 'stepBack', k: Math.min(1, kBack) }; joints.dx = 14 * Math.min(1, kBack); }
  else pose = { from: 'attention', to: 'lean', k: kLean };
  return { kind: 'guard', x, y, face: m.face, pose, joints, hatFly, hat };
}

function heraldState(m, T) {
  const S = TT.slap;
  // 抡起来（0→0.42）→ 甩出（0.42→0.58）→ 收势（→1）
  let p = 0.42 * ez(T, S - 0.34, S - 0.13, inOutSine) + 0.16 * seg(T, S - 0.13, S - 0.08) + 0.42 * ez(T, S - 0.08, S + 0.2, outCubic);
  const hop = Math.sin(Math.PI * clamp((T - (S - 0.16)) / 0.24)) * 26; // 甩出时一蹦
  const land = -0.12 * wobble(T, S + 0.08, 3.5, 0.18);
  const kPresent = kStag(T, S + 0.22, 0.25);
  const kDown = kStag(T, TT.back + 0.75, 0.4, inOutSine);
  const tTurn = TT.turn - 0.22;
  const kFace = kStag(T, tTurn, 0.12);
  const kJaw = kStag(T, TT.turn + 0.02, 0.18);
  const tBlow = waveAt(m.x);
  const kBent = kStag(T, tBlow, 0.14);
  let face = 1, pose, joints = { bob: hop, sq: land };
  if (kBent > 0) { face = -1; pose = { from: 'jawDrop', to: 'bentHorn', k: kBent }; joints = { lean: -8 * kBent }; }
  else if (kFace > 0) {
    face = -1;
    pose = { from: 'idle', to: 'jawDrop', k: kJaw };
    joints = { bob: Math.sin(Math.PI * kFace) * 14 };
  } else if (kPresent > 0) {
    // 手举着告示“请看”→ 众人退开后尴尬地左右看 → 慢慢放下手
    pose = { from: { from: 'slapNotice', to: 'raiseHand', k: kPresent }, to: 'idle', k: kDown };
    const kAwk = clamp((T - TT.back - 0.1) / 0.9);
    joints.look = kAwk > 0 && kAwk < 1 ? Math.sin(kAwk * TAU * 1.5) : 0;
    joints.lookY = -0.7 * Math.sin(Math.PI * clamp((T - TT.beam - 0.1) / 0.8));
    joints.head = -6 * kDown;
  } else {
    pose = 'slapNotice';
  }
  return { kind: 'herald', x: m.x, y: m.y, face, pose, p, joints, sweat: T > TT.back + 0.1 && T < TT.beam ? 0.7 : undefined };
}

/** 本帧群演成员（drawCrowd 的 members，含每人姿态）。 */
function crowdMembers(T) {
  return CROWD0.map((m) => {
    const st = m.kind === 'guard' ? guardState(m, T) : m.kind === 'herald' ? heraldState(m, T) : citizenState(m, T);
    return { i: m.i, kind: m.kind, variant: m.variant, seed: m.seed, s: 1, ...st };
  });
}

// ———————————————————— 风滚草 ————————————————————
function tumbleState(T) {
  const [t0, t1] = TT.tumble;
  if (T < t0 || T > t1) return null;
  const u = (T - t0) / (t1 - t0);
  const x = lerp(170, 1880, u);
  // 弹两下：两段抛物线
  const b = u < 0.38 ? 0 : u < 0.62 ? (u - 0.38) / 0.24 : u < 0.8 ? (u - 0.62) / 0.18 : 0;
  const amp = u < 0.62 ? 70 : 34;
  const lift = b > 0 ? 4 * b * (1 - b) * amp : 0;
  const land = u >= 0.62 && u < 0.66 ? 1 - (u - 0.62) / 0.04 : u >= 0.8 && u < 0.84 ? 1 - (u - 0.8) / 0.04 : 0;
  return { x, y: 872 - lift, roll: (x - 170) / 50, squash: 0.3 * land };
}

// ———————————————————— 勇者 ————————————————————
const HX0 = -210, HX1 = 520;
/** 勇者脚底世界 x（跪滑减速进光圈；之前按初速度直线外推，让围巾拖尾自然）。 */
export function heroX(t) {
  const [t0, t1] = TT.slide;
  const v0 = (2 * (HX1 - HX0)) / (t1 - t0);
  if (t <= t0) return HX0 + v0 * (t - t0);
  if (t >= t1) return HX1;
  return HX0 + (HX1 - HX0) * outQuad((t - t0) / (t1 - t0));
}
function heroState(T) {
  const x = heroX(T), y = 860;
  const trail = scarfTrail((tt) => [heroX(tt), 860], T, 24, 0.035).map(([px, py]) => [px - x, py - y]);
  const wrap = ez(T, TT.wrapOn[0], TT.wrapOn[1], outCubic) * (1 - ez(T, TT.wrapOff[0], TT.wrapOff[1], inOutSine));
  const kBrake = ez(T, TT.stop - 0.05, TT.stop + 0.06, outCubic);
  const kYank = ez(T, TT.wrapOff[0] - 0.02, TT.wrapOff[0] + 0.16, outCubic);
  const kIn = ez(T, TT.inhale[0], TT.inhale[1], inOutSine);
  const kShout = ez(T, TT.shout - 0.04, TT.shout + 0.02, outCubic);
  let pose = kBrake > 0 ? { from: 'kneeSlide', to: 'brake', k: kBrake } : 'kneeSlide';
  if (kYank > 0) pose = { from: pose, to: 'idle', k: kYank };
  if (kIn > 0) pose = { from: pose, to: 'inhale', k: kIn };
  if (kShout > 0) pose = { from: pose, to: 'shout', k: kShout };
  // 扯围巾：近侧手猛地往外一甩
  const yankArm = Math.sin(Math.PI * clamp((T - TT.wrapOff[0] + 0.02) / 0.3)) * 70;
  const squash = -0.16 * hit(T, TT.stop, 0.12) + 0.05 * wobble(T, TT.stop + 0.08, 4, 0.2) + 0.05 * kIn * (1 - kShout) - 0.06 * hit(T, TT.shout, 0.1);
  let expr = 'determined';
  if (T >= TT.stop - 0.06 && T < TT.wrapOff[0] + 0.1) expr = 'shock';
  if (T >= TT.shout - 0.07) expr = 'shout'; // 先想后动：嘴先张
  return {
    x, y, s: 1, face: 1, t: T, pose, expr,
    inflate: kIn * (1 - ez(T, TT.shout - 0.03, TT.shout + 0.05)),
    squash, ahogeAt: TT.stop + 0.02,
    jointsAdd: { aF: [-yankArm, 0, 0] },
    scarf: { trail, lag: 0.035, wrapFace: wrap, ground: 860 },
  };
}

// ———————————————————— 文字与符号（屏幕空间，全在 y ≤ 900） ————————————————————
function sfx(g, chars, x, y, size, k, o = {}) {
  if (k <= 0) return;
  const sc = outBack(clamp(k * 1.6), 2.2);
  g.save();
  g.translate(x, y); g.rotate(o.rot || 0); g.scale(sc, sc);
  g.globalAlpha *= o.alpha ?? 1;
  let cx = -((chars.length - 1) * size * 0.86) / 2;
  for (const ch of chars) { paperGlyph(g, ch, cx, 0, size, { style: o.style || 'cut', family: o.family, fill: o.fill, edge: o.edge, rot: o.chRot || 0, inkCenter: true }); cx += size * 0.86; }
  g.restore();
}

// ———————————————————— 整帧 ————————————————————
/**
 * 广场整帧。o.lean：甩镜帘重叠期（与 b02 相加缓冲 ≤ 8）只开 2 个图层；o.under：告示已盖满全屏，只画最省的底。
 */
export function plazaFrame(g, T, ctx, o = {}) {
  const c = plazaCam(T);
  const satK = ez(T, L07, L07 + 1.39, inOutSine);
  const satEnv = lerp(0.86, 1, satK), satCrowd = lerp(0.74, 1, satK);
  const torn = T >= TT.tear;
  const notice = T < TT.slap ? 'none' : torn ? 'corners' : 'full';
  const tb = waveAt(PLAZA.board.cx);
  const noticeOpts = notice === 'full' ? {
    unroll: ez(T, TT.slap, TT.slap + 0.1, outCubic),
    pins: [seg(T, TT.slap + 0.03, TT.slap + 0.1), seg(T, TT.slap + 0.06, TT.slap + 0.13)],
    squash: hit(T, TT.slap, 0.09) * 0.14 - 0.05 * wobble(T, tb, 6, 0.25),
    rot: 0.05 * wobble(T, tb, 7, 0.3) + 0.03 * Math.sin((T - tb) * 40) * clamp((T - tb) / 0.1) * (T > tb ? 1 : 0),
  } : {};
  const po = {
    time: 'beam', beamAt: TT.beam, notice, noticeOpts,
    farKing: T < TT.turn ? 'holdHead' : T < waveAt(1500) - 0.1 ? 'leanForward' : 'beardFlip',
    lightCircle: ez(T, L07 + 0.29, L07 + 0.89),
    shockAt: TT.wave0 + 0.1,
  };
  const members = crowdMembers(T);
  const hero = T >= TT.slide[0] - 0.05 ? heroState(T) : null;

  // ① 天空（直接画，整屏不透明）
  drawPlaza(g, T, c, { ...po, layer: 'sky' });
  if (o.lean) {
    // 甩镜帘期间：远 + 中合一层、主体 + 角色合一层（与 b02 相加缓冲不超）
    ctx.layer(g, { shadow: 6, texture: 0.25, sat: satEnv }, (lg) => { drawPlaza(lg, T, c, { ...po, layer: 'far' }); drawPlaza(lg, T, c, { ...po, layer: 'mid' }); });
    ctx.layer(g, { shadow: 8, texture: 0.3, sat: satEnv }, (lg) => {
      drawPlaza(lg, T, c, { ...po, layer: 'main' });
      lg.save(); applyCam(lg, c, 1); drawCrowdAndProps(lg, T, members); lg.restore();
    });
    drawPlaza(g, T, c, { ...po, layer: 'fg' });
  } else {
    ctx.layer(g, { ...PLAZA_LAYER.far, sat: satEnv }, (lg) => drawPlaza(lg, T, c, { ...po, layer: 'far' }));
    ctx.layer(g, { ...PLAZA_LAYER.mid, sat: satEnv }, (lg) => drawPlaza(lg, T, c, { ...po, layer: 'mid' }));
    ctx.layer(g, { ...PLAZA_LAYER.main, sat: satEnv }, (lg) => drawPlaza(lg, T, c, { ...po, layer: 'main' }));
    ctx.layer(g, { shadow: 9, texture: 0.3, sat: satCrowd }, (lg) => { applyCam(lg, c, 1); drawCrowdAndProps(lg, T, members); });
    if (hero) ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => { applyCam(lg, c, 1); drawHeroAndFx(lg, T, hero); });
    drawPlaza(g, T, c, { ...po, layer: 'light' });
    ctx.layer(g, PLAZA_LAYER.fg, (lg) => drawPlaza(lg, T, c, { ...po, layer: 'fg' }));
  }
  screenFx(g, T, c, members);
  // 冲击：L06 拍板小震、L08 大喊中震
  impact(ctx, T, TT.slap, 'S', { shake: 7, flash: 0.12, decay: 0.18 });
  impact(ctx, T, TT.shout, 'M', { shake: 16, flash: 0.35 });
  return c;
}

function drawCrowdAndProps(lg, T, members) {
  const A = drawCrowd(lg, members, { t: T });
  // 传令官手里卷着的告示（抛上告示板之前）
  const ha = A[8];
  const rf = rollFlight(T, ha && ha.hand);
  if (rf) drawNotice(lg, { x: rf.x, y: rf.y + 100, rot: rf.rot, s: rf.s, unroll: 0, pins: 0, t: T });
  // 拍板扬灰
  burst(lg, T, { at: TT.slap, seed: 303, count: 16, x: PLAZA.board.cx, y: 660, spread: 130, speed: [60, 220], angle: [-2.9, -0.25], gravity: -30, drag: 2.2, life: [0.5, 0.9], size: [12, 24] }, dustDraw);
  burst(lg, T, { at: TT.slap, seed: 304, count: 10, x: PLAZA.board.cx, y: 455, spread: 140, speed: [40, 150], angle: [-2.6, -0.5], gravity: -20, drag: 2.4, life: [0.45, 0.8], size: [10, 18] }, dustDraw);
  // 齐退一步：脚下扬起的小尘与“唰”的速度线
  for (const m of members) {
    if (m.kind === 'herald') continue;
    const tb = TT.back + BACK_JIT[m.i], dir = Math.sign(BACK_DX[m.i] || 1);
    burst(lg, T, { at: tb + 0.06, seed: 320 + m.i, count: 5, x: m.x - dir * 10, y: m.y - 4, spread: 14, speed: [40, 120], angle: dir > 0 ? [-2.9, -2.3] : [-0.8, -0.25], gravity: -10, drag: 2.6, life: [0.35, 0.6], size: [9, 16] }, dustDraw);
    const ks = clamp((T - tb) / 0.28);
    if (ks > 0 && ks < 1) {
      lg.save();
      lg.globalAlpha *= Math.sin(Math.PI * ks) * 0.85;
      lg.strokeStyle = PAL.paper; lg.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        const yy = m.y - 40 - k * 34 - hash2(m.i, k) * 12, len = 40 + 50 * hash2(m.i + 5, k);
        const x0 = m.x + dir * (32 + 40 * ks), x1 = x0 + dir * len;
        lg.lineWidth = 5 - k * 0.6; lg.beginPath(); lg.moveTo(x0, yy); lg.lineTo(x1, yy); lg.stroke();
      }
      lg.restore();
    }
  }
  // 风滚草（从左往右滚过空地，弹两下）
  const tw = tumbleState(T);
  if (tw) {
    drawTumbleweed(lg, { x: tw.x, y: tw.y, r: 44, roll: tw.roll, squash: tw.squash, t: T, seed: 5 });
    for (const [k, at] of [[0, 0.62], [1, 0.8]]) {
      const tl = lerp(TT.tumble[0], TT.tumble[1], at);
      burst(lg, T, { at: tl, seed: 340 + k, count: 6, x: lerp(170, 1880, at), y: 870, spread: 10, speed: [40, 110], angle: [-3.0, -0.2], gravity: -10, drag: 2.5, life: [0.35, 0.6], size: [8, 14] }, dustDraw);
    }
  }
  // 卫兵口哨的音符（路径画）
  const ga = A[5];
  if (ga && ga.note) {
    for (const [k, t0] of [[0, TT.whistle[0] + 0.12], [1, TT.whistle[0] + 0.42]]) {
      const q = (T - t0) / 0.9;
      if (q <= 0 || q >= 1) continue;
      const nx = ga.note[0] - 18 - q * 50 + Math.sin(q * 9 + k) * 10, ny = ga.note[1] - 20 - q * 120;
      glyphIcon(lg, 'note', nx, ny, 34 + 6 * k, { alpha: Math.sin(Math.PI * q) * 1.2, rot: Math.sin(q * 7 + k) * 0.25 });
    }
  }
}

function drawHeroAndFx(lg, T, hero) {
  // 跪滑：膝下火花 + 尘土、身后几道速度线
  const [s0, s1] = TT.slide;
  stream(lg, T, { start: s0, end: s1 - 0.06, rate: 55, seed: 351, life: [0.25, 0.45], gravity: 900, drag: 1.5, size: [7, 13],
    emit: (tb, i, r) => ({ x: heroX(tb) - 6, y: 856, vx: -260 - 380 * r, vy: -160 - 260 * hash2(i, 3) }) }, sparkDraw);
  stream(lg, T, { start: s0, end: s1 + 0.04, rate: 24, seed: 352, life: [0.4, 0.7], gravity: -30, drag: 2.2, size: [12, 22],
    emit: (tb, i, r) => ({ x: heroX(tb) + 18, y: 852, vx: -90 - 120 * r, vy: -40 - 40 * hash2(i, 5) }) }, dustDraw);
  burst(lg, T, { at: TT.stop, seed: 353, count: 14, x: HX1 + 30, y: 852, spread: 20, speed: [80, 260], angle: [-3.0, -0.15], gravity: -20, drag: 2.4, life: [0.4, 0.75], size: [12, 22] }, dustDraw);
  const vx = (heroX(T + 0.01) - heroX(T - 0.01)) / 0.02;
  if (vx > 120) {
    lg.save();
    lg.globalAlpha *= clamp(vx / 1200) * 0.8;
    lg.strokeStyle = PAL.white; lg.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const yy = 860 - 30 - k * 42 - hash2(k, 7) * 14, len = 90 + 120 * hash2(k, 8);
      const x1 = hero.x - 70 - 30 * hash2(k, 9);
      lg.lineWidth = 6 - k * 0.7; lg.beginPath(); lg.moveTo(x1, yy); lg.lineTo(x1 - len, yy); lg.stroke();
    }
    lg.restore();
  }
  drawHero(lg, hero);
  // L08 世界冲击波：三圈奶油纸环扫过广场（帽子按到达时刻飞）
  for (let k = 0; k < 3; k++) {
    const t0 = TT.wave0 + k * 0.06;
    const age = T - t0;
    if (age <= 0 || age > 0.6) continue;
    const r = 60 + age * WAVE_V;
    drawShockRing(lg, { x: MOUTH[0], y: MOUTH[1], r, width: lerp(30, 12, age / 0.6), alpha: (1 - age / 0.6) * 0.9, squash: 0.92, seed: 40 + k });
  }
}

function screenFx(g, T, c, members) {
  // 「啪！」：贴着告示左上角，跟着推镜走
  {
    const k = clamp((T - TT.slap - 0.01) / 0.1);
    const out = clamp((T - TT.slap - 0.5) / 0.16);
    if (k > 0 && out < 1) {
      const [sx, sy] = toScreen(c, 1, 908, 452);
      sfx(g, ['啪', '！'], sx, sy, 76 * (c.zoom * 0.85), k, { rot: -0.2, alpha: 1 - out });
    }
  }
  // 「唰」：众人齐退
  {
    const k = clamp((T - TT.back - 0.04) / 0.1);
    const out = clamp((T - TT.back - 0.55) / 0.15);
    if (k > 0 && out < 1) {
      const [sx, sy] = toScreen(c, 1, 640, 640);
      sfx(g, ['唰'], sx, sy, 62, k, { rot: -0.12, style: undefined, family: 'display', fill: PAL.ink, edge: PAL.paper, alpha: 1 - out });
    }
  }
  // 甩镜速度线：入场竖甩（内容往上走）、L08 后横甩回全景
  const kIn = 1 - seg(T, B_START, B_START + 0.24);
  if (kIn > 0) speedLines(g, 'v', undefined, { t: T, sign: -1, alpha: 0.75 * kIn, density: 2.4, colors: [PAL.white, PAL.paper2], seed: 21 });
  const wb = seg(T, TT.whipBack[0], TT.whipBack[1]);
  if (wb > 0 && wb < 1) speedLines(g, 'h', undefined, { t: T, sign: -1, alpha: 0.85 * Math.sin(Math.PI * wb), density: 2.6, colors: [PAL.white, PAL.paper], shadow: 0.5, seed: 22 });
  // L08 特写：嘴边三圈冲击环 +「！！」锯齿气泡
  const sh = T - TT.shout;
  if (sh >= -0.02 && sh < 0.45) {
    const [mx, my] = toScreen(c, 1, MOUTH[0], MOUTH[1]);
    for (let k = 0; k < 3; k++) {
      const a = sh - k * 0.06;
      if (a <= 0 || a > 0.36) continue;
      const r = 70 + (a / 0.36) ** 0.8 * 1300;
      drawShockRing(g, { x: mx + 30, y: my, r, width: lerp(34, 14, a / 0.36), alpha: 1 - (a / 0.36) ** 2, lw: 4, seed: 50 + k });
    }
    const pop = clamp((sh + 0.02) / 0.12);
    const fade = clamp((T - (TT.whipBack[0] + 0.06)) / 0.12);
    if (pop > 0 && fade < 1) {
      g.save(); g.globalAlpha *= 1 - fade;
      bubble(g, { x: 1330, y: 300, w: 330, h: 200, shape: 'jagged', text: '！！', tail: [mx + 70, my - 40], pop, t: T, seed: 9 });
      g.restore();
    }
  }
}
