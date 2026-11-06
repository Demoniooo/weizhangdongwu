// b16 私有：王座厅夜景——O03 摇篮立起 / 婴儿；O04 身高尺 + 四季翻牌（机位锁死）；O05–O06 取名面板「王浩然」。
import { NAMES } from '../../cues.js';
import { PAL, rr, glow } from '../../core/paper.js';
import { cam, applyCam, lerpCam, toScreen } from '../../core/camera.js';
import { clamp, lerp, seg, hash2, rgba, mixHex, wobble, noise1 } from '../../core/util.js';
import { ez, glide, outBack, inQuad, inOutSine, outCubic, inOutCubic, spring } from '../../core/ease.js';
import { burst, stream } from '../../core/particles.js';
import { NAME_TIMES } from '../../ui/type.js';
import { glyphIcon, bubble } from '../../ui/kit.js';
import { drawThroneRoom, THRONE, CAMS as TR, throneLayer, throneDepth } from '../../env/throne.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawKing } from '../../rigs/king.js';
import { drawPrincess } from '../../rigs/princess.js';
import { drawLizard } from '../../rigs/dragon.js';
import { drawScribe, drawChild } from '../../rigs/folk.js';
import { drawCradle, stampP } from '../../props/royal.js';
import { drawScroll } from '../../props/paper.js';
import { star4 } from '../../props/scarf.js';
import { dustDraw, confettiDraw } from '../../props/misc.js';
import { applyParallax, drawSeamPanel, PANEL_O06, SEAMS, resolveParams } from '../_seams.js';
import { TT, O3, O4, O5, O6, O7, driftCam, bump, poseMix, sfx, sweatDrop, speedStreaks, babyBubble } from './common.js';
import { KING_TILT } from './castle.js';

const TAU = Math.PI * 2;
const FLOOR = THRONE.floorY; // 880
const SCARF = { len: 936, glow: 0.6, notch: true, hole: true, patch: true };
const RULER = [{ h: 110, at: TT.grow[0] }, { h: 160, at: TT.grow[1] }, { h: 200, at: TT.grow[2] }];
const CRADLE_X = THRONE.spots.cradle[0]; // 1100
const O6T = NAME_TIMES('O06'); // 王 浩 然

// ———————————————————— 机位 ————————————————————
/** O03 情绪点推近：翻页落定后从 TR-NIGHT 推到摇篮一家（王座上的国王仍在画右）。 */
export const CAM_CRADLE = cam(1120, 662, 1.6);
export function throneCam(T) {
  if (T < TT.ruler0) {
    const k = ez(T, TT.turn1, TT.turn1 + 0.5, glide);
    return driftCam(lerpCam(TR.TR_NIGHT, CAM_CRADLE, k), T, seg(T, TT.turn1, TT.turn1 + 0.6));
  }
  if (T < O4) {
    const k = ez(T, TT.ruler0, O4, inOutCubic);
    const a = driftCam(CAM_CRADLE, T, 1 - k);
    return lerpCam(a, TR.TR_RULER, k);
  }
  if (T < TT.back0) return TR.TR_RULER; // 锁死：时间流逝
  const k = ez(T, TT.back0, TT.back1, glide);
  return lerpCam(TR.TR_RULER, driftCam(TR.TR_NIGHT, T, seg(T, TT.back0, TT.back1 + 0.25)), k);
}

// ———————————————————— 窗外（四季、月相） ————————————————————
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const MOON = [0.3, 0.68, 0.35, 0];
function windowL(T) {
  const at = TT.seasons;
  if (T < at[0]) return 'night';
  let i = 0;
  for (let j = 0; j < 4; j++) if (T >= at[j]) i = j;
  const k = ez(T, at[i], at[i] + 0.3, inOutSine);
  if (k >= 1) return SEASONS[i];
  return { from: i === 0 ? 'night' : SEASONS[i - 1], to: SEASONS[i], k };
}
function moonPhase(T) {
  const at = TT.seasons;
  let v = 0;
  for (let j = 0; j < 4; j++) v = lerp(v, MOON[j], ez(T, at[j], at[j] + 0.3, inOutSine));
  return v;
}

/** 右尖拱窗下沿远处的小城楼与旗（back 层世界坐标）；droop 0..1 旗子耷拉，fold 0..1 城楼像立体书一样折倒收走。 */
function drawWindowCity(lg, T, droop, fold) {
  if (fold >= 1) return;
  const W = THRONE.windows.R;
  lg.save();
  const clip = new Path2D(); clip.rect(W.x - W.w / 2 + 12, W.y0 + 40, W.w - 24, W.y1 - W.y0 - 48);
  lg.clip(clip);
  const base = W.y1 - 6;
  const col = mixHex(PAL.skyNight, PAL.ink, 0.35), roofC = mixHex(PAL.skyNightHigh, PAL.ink, 0.2);
  const towers = [[W.x - 46, 46, 15], [W.x - 14, 70, 18], [W.x + 20, 54, 14], [W.x + 50, 40, 12]];
  towers.forEach(([x, h, w], i) => {
    const f = clamp(fold * 1.4 - i * 0.12);
    const sy = 1 - outBack(f, 1.5) * 1.0;
    if (sy <= 0.01) return;
    lg.save(); lg.translate(x, base); lg.scale(1, Math.max(0.01, sy));
    lg.fillStyle = col; lg.fillRect(-w / 2, -h, w, h);
    lg.fillStyle = rgba(PAL.goldLight, 0.85); lg.fillRect(-2, -h * 0.62, 4, 6);
    lg.fillStyle = roofC; lg.beginPath(); lg.moveTo(-w / 2 - 3, -h); lg.lineTo(0, -h - w * 1.1); lg.lineTo(w / 2 + 3, -h); lg.closePath(); lg.fill();
    // 旗杆 + 旗：平时随风飘，droop 后耷拉
    const top = -h - w * 1.1;
    lg.strokeStyle = col; lg.lineWidth = 1.6; lg.beginPath(); lg.moveTo(0, top); lg.lineTo(0, top - 13); lg.stroke();
    const d = clamp(droop * 1.2 - i * 0.07);
    const flap = Math.sin(T * 7 + i * 1.7) * 2.5 * (1 - d);
    const ang = lerp(-0.08, 1.35, outBack(d, 1.2));
    lg.save(); lg.translate(0, top - 13); lg.rotate(ang);
    lg.fillStyle = [PAL.scarf, PAL.gold, PAL.scarf, PAL.gold][i];
    lg.beginPath(); lg.moveTo(0, 0); lg.lineTo(13, 3 + flap); lg.lineTo(0, 7); lg.closePath(); lg.fill();
    lg.restore();
    lg.restore();
  });
  lg.restore();
}

// ———————————————————— 角色状态 ————————————————————
const STAGES = ['toddler', 'kid', 'older'];
function childState(T) {
  // O04：身高尺；之前是摇篮里的婴儿（另画），之后少年
  const g = TT.grow;
  let stage = 'baby', idx = -1;
  for (let i = 0; i < 3; i++) if (T >= g[i]) { stage = STAGES[i]; idx = i; }
  const nxt = idx + 1 < 3 ? g[idx + 1] : 1e9;
  // 预备：下一次蹿高前 0.12s 下蹲压扁；蹿高瞬间拉长，0.35s 内弹回
  const pre = seg(T, nxt - 0.12, nxt);
  const at = idx >= 0 ? g[idx] : -1e9;
  const stretch = idx >= 0 ? wobble(T, at, 3.2, 0.16) : 0;
  const squash = -0.18 * inQuad(pre) + 0.32 * stretch;
  const hopK = idx >= 0 ? seg(T, at, at + 0.36) : 1;
  return { stage, idx, squash, hopK, at };
}

/** 接缝合同 b16|b17 的演员（197.47 起直接用合同参数，保证 197.77 与 drawSeam 一致）。 */
const SOUT = SEAMS['b16|b17'];
const OUT_ACT = Object.fromEntries((SOUT.actors || []).map((it) => [it.id, it]));
const outP = (id, T) => resolveParams(OUT_ACT[id].params, T, {});
const SETTLE = O7 - 0.3;
const CHILD_X = OUT_ACT.child ? OUT_ACT.child.params.x : 885;
const HERO_X = OUT_ACT.hero ? OUT_ACT.hero.params.x : 715;
const PRIN_X = OUT_ACT.princess ? OUT_ACT.princess.params.x : 1075;
const LIZ_X = OUT_ACT.lizard ? OUT_ACT.lizard.params.x : 985;
const SCRIBE_X = OUT_ACT.scribe ? OUT_ACT.scribe.params.x : 1290;
/** O04 孩子贴着 x=780 的柱子右缘站（柱上的刻度露在他身边）。 */
const RULER_CHILD_X = 824;

/** 整个王座厅夜景的“演员表”（世界坐标）。 */
function cast(T) {
  if (T >= SETTLE) {
    const A = {};
    for (const id of Object.keys(OUT_ACT)) A[id] = outP(id, T);
    return A;
  }
  const A = {};
  const naming = T >= TT.back0; // O05 起
  const ruler = T >= TT.ruler0 && !naming;
  // —— 孩子
  const C = childState(T);
  if (ruler || naming) {
    const hop = naming ? ez(T, O5 - 0.11, O5 + 0.15, outBack) : 0; // 跳到面板正下方
    const hopY = naming ? -38 * Math.sin(Math.PI * seg(T, O5 - 0.11, O5 + 0.15)) : 0;
    let pose = 'stand', expr, p;
    if (ruler && C.idx >= 0 && C.hopK < 1) { pose = 'hop'; p = 0.25 + 0.75 * C.hopK; }
    if (naming) {
      if (T >= TT.nudge && T < TT.cursor) pose = 'frown';
      else if (T >= TT.cursor && T < TT.exhale) expr = { eyes: 'wide', mouth: 'o', brows: 'worried', sweat: 0.8 };
      else if (T >= TT.exhale && T < TT.tie + 0.1) expr = 'relieved';
      else if (T >= TT.tie + 0.1) pose = 'laugh';
      if (T >= TT.tie + 0.3) { pose = 'stand'; expr = 'laugh'; } // 落到接缝合同：stand + laugh
    }
    A.child = {
      x: lerp(RULER_CHILD_X, CHILD_X, hop), y: FLOOR + hopY, s: 1, face: 1, t: T, stage: ruler && C.idx < 0 ? 'baby' : naming ? 'older' : C.stage,
      pose, p, expr, squash: ruler ? C.squash : 0.12 * wobble(T, O5 + 0.15, 3, 0.15) + 0.1 * wobble(T, TT.tie + 0.1, 3, 0.15),
      shortScarf: T >= TT.tie + 0.08,
    };
  }
  // —— 勇者
  if (!naming && !ruler) {
    const lean = 0.78 * ez(T, O3 + 0.05, O3 + 0.32, outCubic);
    A.hero = { x: 905, y: FLOOR, s: 1, face: 1, t: T, pose: poseMix('idle', 'leanOver', lean), expr: T >= TT.baby + 0.05 ? 'laugh' : 'normal', sword: 'back', scarf: { ...SCARF } };
  } else if (ruler) {
    const look = C.idx >= 0 ? 1 : 0;
    A.hero = { x: 640, y: FLOOR, s: 1, face: 1, t: T, pose: 'idle', expr: C.idx >= 0 && T - C.at < 0.35 ? 'shock' : 'laugh', sword: 'back', scarf: { ...SCARF },
      squash: -0.05 * wobble(T, C.at, 3, 0.2) * look, yaw: 0.6 };
  } else {
    // O05：唰地摊开长名卷轴（前冲一步）→ 被推回 → 紧张 → 196.80 瘪 → 197.02 跳过去系围巾 → 197.44 跳回 715 瘪着
    const lunge = ez(T, O5 - 0.08, O5 + 0.08, outBack);
    let x = lerp(640, 680, lunge), y = FLOOR, pose = 'idle', expr = 'normal', sweat = 0;
    if (T >= O5 - 0.08 && T < TT.nudge + 0.2) { pose = 'unrollScroll'; expr = 'smug'; }
    else if (T >= TT.nudge + 0.2 && T < TT.exhale) { pose = poseMix('unrollScroll', 'idle', ez(T, TT.nudge + 0.2, TT.nudge + 0.4)); expr = 'worried'; sweat = 0.6 + 0.4 * seg(T, TT.cover, TT.cover + 0.3); }
    const settle = ez(T, TT.exhale - 0.1, TT.exhale + 0.2, inOutSine);
    const t0 = TT.tie - 0.08; // 197.02
    const go = ez(T, t0, t0 + 0.1, outCubic), back = ez(T, t0 + 0.28, t0 + 0.42, inOutSine);
    const step = go * (1 - back);
    x = lerp(x, HERO_X, settle) + 92 * step;
    y -= 14 * (Math.sin(Math.PI * seg(T, t0, t0 + 0.1)) + Math.sin(Math.PI * seg(T, t0 + 0.28, t0 + 0.42)));
    if (T >= TT.exhale) {
      expr = 'relieved'; pose = 'deflate';
      if (T >= t0 + 0.08 && T < t0 + 0.3) { pose = 'tieScarf'; expr = 'laugh'; }
    }
    A.hero = { x, y, s: 1, face: 1, t: T, pose, expr, sword: 'back', scarf: { ...SCARF } };
    if (sweat) A.hero.sweat = sweat;
    const sq = T >= TT.nudge + 0.2 && T < TT.nudge + 0.6 ? -0.08 * wobble(T, TT.nudge + 0.2, 4, 0.15) : 0;
    if (sq) A.hero.squash = sq;
  }
  // —— 公主
  if (!naming && !ruler) {
    const lean = 0.78 * ez(T, O3 + 0.1, O3 + 0.36, outCubic);
    A.princess = { x: 1295, y: FLOOR, s: 1, face: -1, t: T, pose: poseMix('idle', 'leanOver', lean), expr: T >= TT.baby + 0.05 ? (T >= TT.hearts ? 'loving' : 'laugh') : 'smile', tiara: true };
  } else if (ruler) {
    A.princess = { x: 1062, y: FLOOR, s: 1, face: -1, t: T, pose: 'idle', expr: C.idx >= 0 && T - C.at < 0.35 ? 'shock' : 'laugh', tiara: true,
      squash: -0.05 * wobble(T, C.at + 0.04, 3, 0.2) };
  } else {
    let pose = 'idle', expr = 'smile';
    const x = lerp(1062, PRIN_X, ez(T, TT.back0, TT.back1, glide));
    if (T >= TT.nudge - 0.08 && T < TT.nudge + 0.22) { pose = 'nudgeAway'; expr = 'eyeroll'; }
    else if (T >= TT.nudge + 0.22 && T < TT.panel0 + 0.3) { pose = 'shakeHead'; expr = 'smug'; }
    else if (T >= TT.panel0 + 0.3 && T < TT.exhale) { pose = 'idle'; expr = 'tense'; }
    else if (T >= TT.exhale) { pose = 'deflate'; expr = 'relieved'; }
    A.princess = { x, y: FLOOR, s: 1, face: -1, t: T, pose, expr, tiara: true };
  }
  // —— 国王（王座：坐姿锚点 = 座面）；王冠一直歪着（合同值），197.00 自己回正
  const [kx, ky] = THRONE.spots.kingSit;
  {
    let pose = 'sit', expr = 'smile', seated = false;
    if (!naming && !ruler && T >= O3 + 0.55) { pose = 'wipeTears'; seated = true; expr = 'waterfall'; }
    if (naming) {
      if (T >= TT.nails && T < TT.exhale) { pose = 'biteNails'; seated = true; expr = { eyes: 'wide', brows: 'worried', mouth: 'wobble', sweat: 1 }; }
      else if (T >= TT.exhale) { pose = 'slump'; expr = 'relieved'; }
    }
    const k = ez(T, TT.crown, TT.crown + 0.25, outBack);
    const pop = 22 * Math.sin(Math.PI * seg(T, TT.crown, TT.crown + 0.25));
    A.king = { x: kx, y: ky, s: 1, face: -1, t: T, pose, expr, crown: { tilt: KING_TILT * (1 - k), slip: 0 } };
    if (pop > 0.01) A.king.crown.pop = pop;
    const glint = T >= TT.crown + 0.2 && T < TT.crown + 0.42 ? Math.sin(Math.PI * seg(T, TT.crown + 0.2, TT.crown + 0.42)) : 0;
    if (glint > 0.001) A.king.crown.glint = glint;
    if (seated) A.king.seated = true;
  }
  // —— 小蜥蜴
  if (!naming && !ruler) A.lizard = { x: 1013, y: 788, s: 1, face: 1, t: T, pose: 'peek' };
  else {
    let pose = 'sit';
    if (naming && T >= TT.cover && T < TT.exhale) pose = 'coverEyes';
    if (naming && T >= TT.exhale) pose = 'flat';
    A.lizard = { x: LIZ_X, y: FLOOR, s: 1, face: 1, t: T, pose };
  }
  // —— 书记官（O05 194.70 背着纸卷塔从王座台阶那边进来）
  if (naming && T >= TT.scribe - 0.1) {
    const k = ez(T, TT.scribe - 0.1, TT.scribe + 0.75, outCubic);
    const x = lerp(1720, SCRIBE_X, k);
    let pose = 'carryTower', tower = 0.18 + 0.12 * Math.sin(T * 7);
    if (k >= 1) tower = 0.42 + 0.06 * Math.sin(T * 9);
    if (T >= TT.exhale) { pose = 'deflate'; tower = lerp(0.5, 1, ez(T, TT.exhale, TT.exhale + 0.45, inOutSine)); }
    A.scribe = { x, y: FLOOR, s: 1, face: -1, t: T, pose, tower };
    if (k < 1) A.scribe.cycle = (1720 - x) / 120;
  }
  return A;
}

// ———————————————————— 取名面板（parallax：按 TR-NIGHT 屏幕坐标，depth 1.1） ————————————————————
function panelState(T) {
  if (T < TT.panel0) return null;
  const tiles = [...NAMES.child].map((ch, i) => ({ ch, p: clamp((T - (O6T[i] - 0.13)) / 0.24) }));
  const landed = tiles.filter((q) => q.p >= 0.55).length;
  const panel = {
    rect: PANEL_O06, tiles: T >= O6T[0] - 0.14 ? tiles : [], t: T,
    foldEmpty: seg(T, TT.fold, TT.fold + 0.12),
    contract: seg(T, TT.contract, TT.contract + 0.14),
  };
  if (T >= TT.contract + 0.07) panel.counter = '3/3';
  const pops = [...O6T.map((x) => x + 0.002), TT.contract + 0.07].map((at) => (T >= at && T < at + 0.22 ? Math.sin(((T - at) / 0.22) * Math.PI) : 0));
  const cp = Math.max(...pops);
  if (cp > 0) panel.counterPop = cp;
  const gk = seg(T, TT.contract + 0.05, TT.contract + 0.2);
  if (gk > 0) panel.glowOk = gk * lerp(1, 0.55, ez(T, TT.contract + 0.25, TT.exhale + 0.1));
  if (T >= TT.cursor && T < TT.fold - 0.02) panel.cursor = Math.min(2, landed);
  const off = -(1 - spring(T - TT.panel0, { freq: 2.3, damping: 0.42 })) * 760;
  const tremble = T >= TT.cursor && T < O6T[0] ? (0.6 + 0.6 * seg(T, TT.cursor, O6T[0])) * Math.sin(T * 46) : 0;
  const jolt = O6T.reduce((s, x) => s + 7 * bump(T, x, 0.12), 0);
  const bounce = wobble(T, TT.contract + 0.12, 3.4, 0.14);
  panel.ropeTop = -40 - off - jolt;
  const stamp = T >= TT.stamp - 0.13 ? { kind: 'check', x: 1048, y: 556, r: 64, rot: -0.12, p: stampP(T, TT.stamp), t: T } : null;
  return { panel, stamp, off: off + jolt, tremble, bounce };
}

function drawPanel(lg, c, PS) {
  lg.save();
  applyParallax(lg, c, TR.TR_NIGHT, 1.1);
  if (PS.off || PS.tremble || PS.bounce) {
    lg.translate(920 + PS.tremble, 435 + PS.off);
    lg.rotate(PS.tremble * 0.004);
    const b = 1 + 0.04 * PS.bounce;
    lg.scale(b, 1 / b);
    lg.translate(-920, -435);
  }
  drawSeamPanel(lg, { panel: PS.panel, stamp: PS.stamp });
  lg.restore();
}

// ———————————————————— 长名卷轴（O05） ————————————————————
function scrollState(T, hero) {
  if (T < O5 - 0.02 || T > TT.nudge + 0.5) return null;
  const out = ez(T, TT.roll0, TT.roll1, outCubic);
  const back = ez(T, TT.nudge + 0.03, TT.nudge + 0.2, inQuad);
  const len = 352 * out * (1 - back);
  return { x: hero.x + 58, y: FLOOR - 64, len, snap: back };
}

// ———————————————————— 整帧 ————————————————————
const OUT_PANEL = (SOUT.ui || []).find((u) => u.id === 'panel');

/**
 * 王座厅夜景一帧。o.pageK：翻页进度（drawNext 里调用时传，整帧后期按它过渡）。返回 { c }。
 */
export function drawThroneScene(g, T, ctx, o = {}) {
  const c = throneCam(T);
  const A = cast(T);
  const naming = T >= TT.back0;
  const settled = T >= SETTLE;
  const env = settled
    ? resolveParams(SOUT.env.params, T, {})
    : { light: 'night', windowL: windowL(T), windowR: 'moon', moonPhase: moonPhase(T), candles: true, ruler: RULER };
  const droop = ez(T, TT.exhale, TT.exhale + 0.35, outCubic);
  const fold = seg(T, TT.crown + 0.05, TT.crown + 0.4);
  // 摇篮：O03 立起；O04 孩子蹿高后像立体书机关一样折倒收走
  const cradleRise = seg(T, O3, O3 + 0.32) * (1 - seg(T, TT.grow[0] + 0.08, TT.grow[0] + 0.36));
  const PS = naming && !settled ? panelState(T) : null;
  const scr = naming && A.hero && !settled ? scrollState(T, A.hero) : null;
  const anchors = {};

  ctx.layer(g, throneLayer('back', 'night'), (lg) => {
    drawThroneRoom(lg, T, c, { ...env, layer: 'back' });
    if (fold < 1 && !settled) {
      lg.save(); applyCam(lg, c, throneDepth('back'));
      drawWindowCity(lg, T, droop, fold);
      // 窗外第一颗星（四角星 = V15 剑光）
      const st = seg(T, TT.star, TT.star + 0.55);
      if (st > 0 && st < 1) star4(lg, 566, 236, 30 * Math.sin(Math.PI * st), PAL.goldLight, 1);
      lg.restore();
    }
  });
  ctx.layer(g, throneLayer('mid', 'night'), (lg) => drawThroneRoom(lg, T, c, { ...env, layer: 'mid' }));
  ctx.layer(g, throneLayer('main', 'night'), (lg) => {
    drawThroneRoom(lg, T, c, { ...env, layer: 'main' });
    lg.save(); applyCam(lg, c, 1);
    if (!naming && T < TT.ruler0) drawNursery(lg, T, A, cradleRise, anchors);
    else {
      if (cradleRise > 0) drawCradle(lg, { x: CRADLE_X, y: FLOOR, s: 1, rise: cradleRise, t: T });
      // 合同画序：scribe → king → princess → child → lizard → hero（O04 也按这个序）
      if (A.scribe) drawScribe(lg, A.scribe);
      anchors.king = drawKing(lg, A.king);
      drawPrincess(lg, A.princess);
      if (A.child) anchors.child = drawChild(lg, A.child);
      drawLizard(lg, A.lizard);
      if (scr && scr.len < 6 && scr.snap > 0) drawScroll(lg, { orient: 'h', x: scr.x, y: scr.y, len: 0, width: 128, t: T, alpha: 1 - seg(T, TT.nudge + 0.3, TT.nudge + 0.5) });
      anchors.hero = drawHero(lg, A.hero);
      if (scr && scr.len >= 6) drawLongScroll(lg, T, scr);
      if (!settled) drawReactions(lg, T, A, anchors);
    }
    lg.restore();
  });
  drawThroneRoom(g, T, c, { ...env, layer: 'glow' });
  ctx.layer(g, throneLayer('fg', 'night'), (lg) => drawThroneRoom(lg, T, c, { ...env, layer: 'fg' }));
  if (settled && OUT_PANEL) {
    ctx.layer(g, resolveParams((SOUT.layers.find((L) => L.draw.includes('panel')) || {}).o || { shadow: 12, texture: 0.25 }, T, {}), (lg) => {
      lg.save(); applyParallax(lg, c, OUT_PANEL.base, OUT_PANEL.depth ?? 1); drawSeamPanel(lg, resolveParams(OUT_PANEL.params, T, {})); lg.restore();
    });
  } else if (PS) ctx.layer(g, { shadow: 12, texture: 0.25 }, (lg) => drawPanel(lg, c, PS));
  if (!settled) drawScreenFx(g, T, c, A, anchors);
  // 夜与烛光对比：块内加一点对比与暗角；196.80 松口气时“放松”回默认（接缝合同 fx = {}）
  const relax = seg(T, TT.exhale, TT.exhale + 0.6);
  const night = (o.pageK ?? 1) * (1 - relax);
  if (night > 0) {
    ctx.fx.contrast = 1 + 0.1 * night;
    ctx.fx.vignette = lerp(0.3, 0.42, night);
  }
  return { c };
}

/** O03：摇篮 + 婴儿 + 俯身的父母 + 扒边的小蜥蜴。父母在摇篮后面，勇者的围巾垂进摇篮被婴儿抓住。 */
function drawNursery(lg, T, A, rise, anchors) {
  const babyOn = T >= TT.baby - 0.04;
  const pr = clamp((T - TT.baby) / 0.3);
  const jump = T >= TT.baby ? Math.sin(Math.PI * clamp((T - TT.baby) / 0.32)) * 58 : 0;
  const giggle = T >= TT.giggle && T < TT.grab;
  const chew = T >= TT.grab - 0.06;
  const bx = CRADLE_X - 30, by = FLOOR - 58 - jump + (T < TT.baby ? 46 : 0);
  const babyMouth = [bx + 10, by - 44];
  // 勇者围巾：随俯身从身后垂挂转到身前垂进摇篮；190.60 被婴儿一把抓住拽过去
  const hero = { ...A.hero };
  const rig = heroRig(hero);
  const lean = ez(T, O3 + 0.05, O3 + 0.32, outCubic);
  const k0 = rig.neck;
  const hang = [lerp(k0[0] - 12, k0[0] + 34, lean), lerp(k0[1] + 58, k0[1] + 66, lean)];
  const kg = chew ? ez(T, TT.grab - 0.06, TT.grab + 0.08, outCubic) : 0;
  hero.scarf = { ...hero.scarf, to: [lerp(hang[0], babyMouth[0] + 6, kg), lerp(hang[1], babyMouth[1] + 8, kg)] };
  anchors.hero = drawHero(lg, hero);
  anchors.princess = drawPrincess(lg, A.princess);
  anchors.king = drawKing(lg, A.king);
  if (rise > 0) drawCradle(lg, { x: CRADLE_X, y: FLOOR, s: 1, rise, t: T, part: 'back' });
  if (babyOn && rise >= 1) {
    const pose = T < TT.giggle ? 'popUp' : giggle ? 'giggle' : 'grabScarf';
    const sq = T >= TT.baby ? 0.22 * wobble(T, TT.baby + 0.3, 3, 0.15) - 0.15 * (1 - pr) * (pr > 0 ? 1 : 0) : 0;
    anchors.baby = drawChild(lg, { x: bx, y: by, s: 1, face: 1, t: T, stage: 'baby', pose, squash: sq });
  }
  if (rise > 0) drawCradle(lg, { x: CRADLE_X, y: FLOOR, s: 1, rise, t: T, part: 'front', rock: T >= TT.baby ? 0.05 * wobble(T, TT.baby, 2.2, 0.5) : 0 });
  if (rise >= 1) drawLizard(lg, A.lizard);
  // 婴儿咯咯笑：泡泡 + 小爱心
  if (T >= TT.giggle && anchors.baby) {
    const m = anchors.baby.mouth || babyMouth;
    for (let i = 0; i < 6; i++) {
      const t0 = TT.giggle + i * 0.08, a = T - t0;
      if (a < 0 || a > 0.9) continue;
      const x = m[0] + 14 + (hash2(31, i) - 0.3) * 56 + 8 * Math.sin(a * 6 + i), y = m[1] - 12 - a * 95;
      if (i % 2) glyphIcon(lg, 'heart', x, y, 18 + 6 * hash2(32, i), { alpha: 1 - seg(a, 0.6, 0.9), scale: outBack(seg(a, 0, 0.18), 2) });
      else babyBubble(lg, x, y, 8 + 5 * hash2(33, i), 1 - seg(a, 0.6, 0.9));
    }
  }
  // 190.80 父母头顶冒爱心
  if (T >= TT.hearts) {
    const heads = [anchors.hero && anchors.hero.head, anchors.princess && anchors.princess.head];
    heads.forEach((h, i) => {
      if (!h) return;
      const a = T - TT.hearts - i * 0.06;
      if (a < 0) return;
      const pk = outBack(seg(a, 0, 0.22), 2.4);
      glyphIcon(lg, 'heart', h[0] + (i ? -10 : 10), h[1] - 96 - 22 * Math.min(1, a), 44 * pk, { alpha: 1 - seg(a, 0.8, 1.1) });
    });
  }
}

/** 长名卷轴：从勇者手边沿地板向右滚开（字在 y ≤ 900 的屏幕带以上）。 */
function drawLongScroll(lg, T, scr) {
  drawScroll(lg, {
    orient: 'h', x: scr.x, y: scr.y, len: scr.len, width: 128, t: T, notes: 0.5,
    items: [{ kind: 'text', at: 26, chars: NAMES.hero, size: 44, fill: PAL.red, under: PAL.redDark, y: -6 }],
  });
}

/** 面板时段的反应：人人冒汗。 */
function drawReactions(lg, T, A) {
  if (T < TT.cover || T >= TT.exhale + 0.1) return;
  const k = seg(T, TT.cover, TT.cover + 0.25) * (1 - seg(T, TT.exhale, TT.exhale + 0.1));
  const list = [[A.hero.x + 34, FLOOR - 236], [A.princess.x - 30, FLOOR - 232], [A.child ? A.child.x + 26 : 0, FLOOR - 188]];
  list.forEach(([x, y], i) => { if (x) sweatDrop(lg, x, y, 10, ((T - TT.cover) * 1.3 + i * 0.37) % 1, k); });
}

/** 屏幕空间小件：拟声、速度线、松口气气泡、王冠回正的闪光。 */
function drawScreenFx(g, T, c, A, anchors) {
  // O03 婴儿弹起「叮！」
  if (T >= TT.baby && T < TT.baby + 0.7 && anchors.baby) {
    const a = anchors.baby.ahoge || anchors.baby.top;
    const [sx, sy] = toScreen(c, 1, a[0], a[1]);
    const p = seg(T, TT.baby + 0.02, TT.baby + 0.2);
    glyphIcon(g, 'sparkle4', sx + 4, sy - 6, 50 * outBack(p, 2.5), { alpha: 1 - seg(T, TT.baby + 0.45, TT.baby + 0.7) });
    sfx(g, '叮！', sx + 74, sy - 44, 56, { pop: seg(T, TT.baby + 0.03, TT.baby + 0.2), alpha: 1 - seg(T, TT.baby + 0.5, TT.baby + 0.7), fill: PAL.gold, rot: 0.1 });
  }
  // O04 每次蹿高：竖向速度线；第一次配「咻」（机位锁死）
  if (T >= TT.ruler0 && T < TT.back0) {
    const C = childState(T);
    if (C.idx >= 0 && T - C.at < 0.3) {
      const [sx, sy] = toScreen(c, 1, RULER_CHILD_X, FLOOR - [110, 160, 200][C.idx]);
      speedStreaks(g, { x: sx - 120, y: sy - 20, w: 240, h: 300 }, 10, 'v', 1 - seg(T, C.at + 0.12, C.at + 0.3), 50 + C.idx);
    }
    if (T >= TT.grow[0] && T < TT.grow[0] + 0.55) {
      const [sx, sy] = toScreen(c, 1, RULER_CHILD_X, FLOOR - 110);
      sfx(g, '咻', sx + 170, sy - 40, 72, { pop: seg(T, TT.grow[0], TT.grow[0] + 0.14), alpha: 1 - seg(T, TT.grow[0] + 0.4, TT.grow[0] + 0.55), fill: PAL.red, rot: 0.12 });
    }
    // 甩镜 191.50–191.66：横向手画速度线
    const wk = T < O4 ? Math.sin(Math.PI * seg(T, TT.ruler0, O4)) : 0;
    if (wk > 0) speedStreaks(g, { x: -40, y: 0, w: 2000, h: 1080 }, 26, 'h', 0.75 * wk, 77, PAL.paper);
  }
  // O06 196.80「呼——」柔软气泡（画左，不挡右窗的小城楼与国王）
  if (T >= TT.exhale - 0.02 && T < TT.exhale + 0.62) {
    const pop = seg(T, TT.exhale, TT.exhale + 0.2);
    const out = seg(T, TT.exhale + 0.45, TT.exhale + 0.62);
    bubble(g, { shape: 'soft', x: 360, y: 300, w: 400, h: 200, text: '呼——', tail: [610, 520], pop: pop * (1 - out), t: T, seed: 9 });
  }
  // 197.00 王冠自己回正：闪一下 +「叮」
  if (T >= TT.crown + 0.12 && T < TT.crown + 0.6 && anchors.king && anchors.king.crownTop) {
    const [sx, sy] = toScreen(c, 1, anchors.king.crownTop[0], anchors.king.crownTop[1]);
    const p = seg(T, TT.crown + 0.18, TT.crown + 0.32);
    const fade = 1 - seg(T, TT.crown + 0.42, TT.crown + 0.6);
    glyphIcon(g, 'sparkle4', Math.min(sx, 1862) - 6, sy - 4, 64 * outBack(p, 2.4), { alpha: fade });
    sfx(g, '叮', Math.min(sx, 1880) - 120, sy - 40, 58, { pop: p, alpha: fade, fill: PAL.gold, rot: -0.12 });
  }
}
