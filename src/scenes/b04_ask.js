// b04 · 国王大喜、问名、想了想、开口（[33.60, 41.90)，cue L13 L14 L15 L16；见 docs/storyboard.md「### b04 ·」）。
// 地点 THRONE（晴）。入场：b03 的红心沿轮廓放大成心形遮罩（本块负责画，33.60–34.10）。
// 出场：41.90 与 b05 隐形接缝（TR-2S + 漂移、空对话框只剩光标、名签「？？？」、勇者吸气到最鼓、全场前倾）。
//
// 镜头：
//   b04_heart_in [33.60, 34.10) z1  心形遮罩揭开 TR-W：国王跳在半空，34.00 落地（L13）
//   b04_joy      [34.10, 36.11)     TR-W：连蹦三下、王冠飞起落歪、两侧彩纸、卫兵欢呼、勇者挠头；35.20 起推到 TR-2S
//   b04_ask      [36.11, 38.11)     TR-2S：对话框弹起，国王探身「名字？」
//   b04_think    [38.11, 39.91)     名签翻成「？？？」，推到 CU-H：托腮、思考泡三点、呆毛弯成问号、一滴汗
//   b04_inhale   [39.91, 41.90)     呆毛弹直「叮」，拉回 TR-2S，猛吸一口气「咳咳」，全场前倾
import { cue } from '../cues.js';
import { PAL } from '../core/paper.js';
import { cam, applyCam, toScreen, drift, lerpCam } from '../core/camera.js';
import { clamp, lerp, seg, hit, wobble, hash2, TAU } from '../core/util.js';
import { ez, glide, outBack, outCubic, outQuad, inOutSine, brand } from '../core/ease.js';
import { burst } from '../core/particles.js';
import { drawThroneRoom, CAMS, THRONE, throneLayer } from '../env/throne.js';
import { drawHero, heroRig } from '../rigs/hero.js';
import { drawKing } from '../rigs/king.js';
import { drawCitizen, drawGuard, drawScribe, drawHerald, folkStagger } from '../rigs/folk.js';
import { dialogBox, nameTagSmall, thinkDots, TXT } from '../ui/kit.js';
import { confettiDraw } from '../props/misc.js';
import { shapeReveal, shapeGeom, coverSize, impact } from '../fx/transitions.js';
import { SEAMS, withDrift as seamDrift, resolveParams } from './_seams.js';
import { drawRolledNotice, drawLooseSheet, drawDing, bigConfetti, CONF_COLS } from './b04/props.js';

// ———————————————————— 接缝合同（b04|b05 @ 41.90）：一切接缝值从 SEAMS 读，不硬编码 ————————————————————
const SEAM = SEAMS['b04|b05'];
const SI = Object.fromEntries([...SEAM.actors, ...(SEAM.props || []), ...SEAM.ui].map((it) => [it.id, it]));
/** 合同里某元素在时刻 T 的参数（NOW → T）。 */
const sv = (id, T) => resolveParams(SI[id].params, T, {});

// ———————————————————— 时刻（一律 cue + 偏移） ————————————————————
const L13 = cue('L13'), L14 = cue('L14'), L15 = cue('L15'), L16 = cue('L16'), N1A = cue('N1a');
const T_IN = L13 - 0.40;          // 33.60 块起点 / 心形遮罩开始
const T_FULL = L13 + 0.10;        // 34.10 心形盖满（b03 结束）
const T_PUSH = L13 + 1.20;        // 35.20 TR-W → TR-2S

// ———————————————————— 机位 ————————————————————
/** 机位叠漂移：直接用合同的 withDrift 与 DRIFT（主体层在屏幕上平移 (dx, dy)）。 */
const withDrift = (c, T) => seamDrift(c, T, SEAM.drift);
const SEAM_CAM = SEAM.cam;                                               // = CAMS.TR_2S
/** 推拉镜：焦点 F（世界 depth 1）在屏幕上沿直线走，zoom 按几何插值；端点严格等于 A / B。 */
function pushCam(A, B, k, F) {
  const zoom = A.zoom * Math.pow(B.zoom / A.zoom, k);
  const sa = toScreen(A, 1, F[0], F[1]), sb = toScreen(B, 1, F[0], F[1]);
  const sx = lerp(sa[0], sb[0], k), sy = lerp(sa[1], sb[1], k);
  return cam(F[0] - (sx - 960) / zoom, F[1] - (sy - 540) / zoom, zoom);
}
const HEAD_F = [646, 676];        // 勇者头（推 CU-H 的焦点）
function baseCam(T) {
  if (T < T_PUSH) return CAMS.TR_W;
  if (T < L14) return lerpCam(CAMS.TR_W, SEAM_CAM, ez(T, T_PUSH, L14, glide));
  if (T < L15) return SEAM_CAM;
  if (T < L16) return pushCam(SEAM_CAM, CAMS.CU_H, ez(T, L15, L15 + 0.49, glide), HEAD_F);
  return pushCam(CAMS.CU_H, SEAM_CAM, ez(T, L16, L16 + 0.59, glide), HEAD_F);
}
const camAt = (T) => withDrift(baseCam(T), T);

// ———————————————————— 站位 ————————————————————
const H_END = sv('hero', N1A), K_END = sv('king', N1A);
const HERO = { x: H_END.x, y: H_END.y };                                      // (620, 880)
const KING = { x: K_END.x, y: K_END.y };                                      // (1500, 790)
const COURT = sv('courtiers', N1A).members;                                   // 朝臣三人（depth 0.9，后墙前、勇者身后）
const COURT_D = SI.courtiers.depth ?? 0.9;
const GUARD_L = sv('guardL', N1A), HERALD = sv('herald', N1A), SCRIBE = sv('scribe', N1A);
const TAG = SI.headTag;                                                       // 头顶小名签：世界锚点 TAG.at（depth TAG.depth）

// ———————————————————— 国王：落地 + 连蹦三下 ————————————————————
// [起跳, 落地, 高度]：第一跳是 b03 33.60 蹦起的延续（心形遮罩里正在半空），34.00 落地；之后 34.55 / 35.10 落地。
const JUMPS = [[L13 - 0.56, L13, 150], [L13 + 0.05, L13 + 0.55, 96], [L13 + 0.60, L13 + 1.10, 92]];
const LANDS = JUMPS.map((j) => j[1]);
function kingState(T) {
  let lift = 0, kAir = 0, sq = 0, pop = 0, tilt = 0, airPose = 'hop';
  JUMPS.forEach(([t0, t1, h], i) => {
    const d = t1 - t0, u = (T - t0) / d;
    if (u >= 0 && u < 1) { lift = h * 4 * u * (1 - u); kAir = clamp(Math.sin(u * Math.PI) * 1.5); airPose = i === 0 ? 'leap' : 'hop'; }
    if (T >= t0) {
      const lu = T - t1;
      sq += lu >= 0 ? -0.24 * Math.exp(-lu / 0.075) * Math.cos(lu * 30) : 0.11 * Math.sin(clamp(u) * Math.PI);
    }
    const cu = (T - t0 - 0.06) / (d + 0.12);                       // 王冠比头慢半拍：飞起 80px，晚 0.1s 落回
    if (cu >= 0 && cu < 1) pop = Math.max(pop, 80 * 4 * cu * (1 - cu));
    if (T > t1 + 0.12) tilt += wobble(T, t1 + 0.12, 5, 0.2) * 9;   // 落回乱颤
  });
  const last = LANDS[2];
  const TILT_HOP = 10, CR = K_END.crown;
  tilt += TILT_HOP * ez(T, last + 0.08, last + 0.2, outBack);                       // 第三次落歪 10°
  tilt += (CR.tilt - TILT_HOP) * ez(T, L14, L14 + 0.28, outCubic);                 // L14 前倾时再前滑 5°（→ 合同 15°）
  const slip = (CR.slip || 0) * ez(T, L16 + 0.69, L16 + 0.95, outCubic);           // 40.60 探身，王冠再往下滑一点
  // 姿势
  let pose;
  if (T < last + 0.02) pose = { from: 'crouch', to: airPose, k: kAir };
  else if (T < L14) pose = { from: 'crouch', to: 'idle', k: ez(T, last + 0.06, last + 0.42, outCubic) };
  else {
    const k1 = ez(T, L14 - 0.04, L14 + 0.3, brand);                  // L14 探身问名
    const kBack = 0.4 * ez(T, L14 + 1.25, L14 + 1.8, inOutSine);      // 问完稍微收回一点，等答案
    const kIn = 0.4 * ez(T, L16 + 0.67, L16 + 0.95, outCubic);          // 40.60 再探身
    pose = { from: 'idle', to: K_END.pose, k: clamp(k1 - kBack + kIn) };
  }
  const lean2 = T >= L16 + 0.67 ? 7 * wobble(T, L16 + 0.69, 2.2, 0.22) : 0;  // 探身的过冲余振（接缝前衰减到 0）
  // 表情
  let expr = K_END.expr, talk = 0;
  if (T >= L14 - 0.08 && T < L16 + 0.1) {
    expr = { eyes: 'wide', brows: 'up', mouth: 'smile' };
    talk = seg(T, L14 + 0.27, L14 + 0.32) * (1 - seg(T, L14 + 0.74, L14 + 0.8));
  }
  return {
    x: KING.x, y: KING.y - lift, s: 1, face: -1, t: T, pose, expr, talk,
    squash: clamp(sq, -0.3, 0.3), joints: lean2 ? { lean: lean2 } : undefined,
    crown: { pop, tilt, slip },
  };
}

// ———————————————————— 勇者 ————————————————————
function heroState(T) {
  // 姿势链：idle → 挠头（L13）→ idle → 托腮想（L15）→ 吸气（L16）
  const kScr = ez(T, L13 + 0.16, L13 + 0.36, outCubic) * (1 - ez(T, L13 + 1.36, L13 + 1.66, inOutSine));
  const kThink = ez(T, L15 - 0.04, L15 + 0.26, outCubic);
  const kInh = ez(T, L16 + 0.04, L16 + 0.6, glide);
  let pose;
  if (T < L15 - 0.04) pose = { from: 'idle', to: 'scratchHead', k: kScr };
  else if (T < L16 + 0.04) pose = { from: 'idle', to: 'think', k: kThink };
  else pose = { from: 'think', to: H_END.pose, k: kInh };
  // 表情（先于动作 2–4 帧）
  let expr = H_END.expr;
  if (T >= L13 + 0.12 && T < L13 + 1.6) expr = 'shy';
  else if (T >= L14 + 0.3 && T < L15 - 0.1) expr = { eyes: 'dot', brows: 'up', mouth: 'smile' };
  if (T >= L15 - 0.1 && T < L16 - 0.03) expr = 'think';
  if (T >= L16 - 0.03 && T < L16 + 0.22) expr = 'smug';
  // 呆毛：normal → 问号（39.20–39.62 慢慢弯）→ 39.91 弹直
  let ahoge = 'normal';
  const kQ = clamp(ez(T, L15 + 1.09, L15 + 1.51, glide) - 0.07 * Math.max(0, wobble(T, L15 + 1.51, 3.2, 0.22)));
  if (T >= L15 + 1.09 && T < L16) ahoge = { from: 'normal', to: 'question', k: kQ };
  if (T >= L16) ahoge = T < L16 + 0.06 ? { from: 'question', to: H_END.ahoge, k: seg(T, L16, L16 + 0.06) } : H_END.ahoge;
  // 吸气：39.95–40.50 猛吸（0 → 0.85），之后慢慢鼓到 41.60 满
  const inflate = T < L16 ? 0 : H_END.inflate * (0.85 * ez(T, L16 + 0.04, L16 + 0.59, outQuad) + 0.15 * ez(T, L16 + 0.59, L16 + 1.69, inOutSine));
  // 挤压拉伸：吸气前一缩，「咳咳」两下小抖，之后回到 0
  const sq = -0.07 * Math.sin(Math.PI * seg(T, L16 - 0.02, L16 + 0.12))
    + 0.05 * Math.sin(Math.PI * seg(T, L16 + 0.12, L16 + 0.9))
    - 0.035 * hit(T, L16 + 0.31, 0.06) - 0.035 * hit(T, L16 + 0.43, 0.06);
  const sweat = T >= L15 + 1.4 && T < L16 + 0.05 ? ez(T, L15 + 1.44, L16 - 0.02, inOutSine) : 0;
  const wk = ez(T, L16 + 0.07, L16 + 0.69, outCubic);
  return {
    x: HERO.x, y: HERO.y, s: H_END.s, face: H_END.face, t: T, pose, expr, ahoge, inflate, squash: sq, sweat,
    ahogeAt: T >= L16 ? L16 : null, sword: H_END.sword,
    scarf: { ...H_END.scarf, wind: [H_END.scarf.wind[0] * wk, H_END.scarf.wind[1] * wk] },
  };
}
/** 腋下夹着的告示卷：35.45–35.85 塞到背后（被身体挡住），之后不再画。 */
function rollState(T, ha) {
  if (T >= L13 + 1.86) return null;
  const k = ez(T, L13 + 1.45, L13 + 1.85, inOutSine);
  const c = ha.chest;
  return { x: c[0] - 4 - 40 * k, y: c[1] + 4 + 26 * k, rot: lerp(-0.16, -1.45, k), len: 124 * (1 - 0.35 * k) };
}

// ———————————————————— 群演 ————————————————————
const st = (T, t0, i, step, dur, ease = outCubic) => folkStagger(T, t0, i, { step, dur, ease });
function courtierPose(T, i) {
  const kThrow = st(T, L13 + 0.16, i, 0.04, 0.14);
  const kClap = st(T, L13 + 1.55, i, 0.05, 0.35, inOutSine);
  const kIdle = st(T, L13 + 2.0, i, 0.05, 0.4, inOutSine);
  const kLean = st(T, L16 + 0.69, i, 0.045, 0.28, (x) => outBack(x, 1.5));
  if (kLean > 0) return { pose: { from: 'idle', to: COURT[i].pose, k: kLean } };
  if (kIdle > 0) return { pose: { from: 'clap', to: 'idle', k: kIdle }, joints: { look: 0.6 } };
  if (kClap > 0) return { pose: { from: 'cheer', to: 'clap', k: kClap } };
  return { pose: { from: 'clap', to: 'cheer', k: kThrow } };
}
function guardPose(T, i) {
  const kCalm = st(T, L13 + 1.6, i, 0.08, 0.4, inOutSine);
  const kLean = st(T, L16 + 0.69, i, 0.06, 0.28, (x) => outBack(x, 1.4));
  if (kLean > 0) return { from: 'attention', to: GUARD_L.pose, k: kLean };
  if (kCalm > 0) return { from: 'cheer', to: 'attention', k: kCalm };
  return 'cheer';
}
function heraldState(T) {
  const up = ez(T, T_IN, L13 + 0.1, outCubic) * (1 - ez(T, L13 + 1.5, L13 + 1.95, inOutSine));
  const bounce = up * 5 * Math.abs(Math.sin(TAU * (T - T_IN) * 1.3));
  const lean = (HERALD.joints?.lean ?? 0) * ez(T, L16 + 0.72, L16 + 1.0, outCubic);
  return { ...HERALD, t: T, expr: up > 0.3 ? 'happy' : HERALD.expr, joints: { shF: 118 * up, elF: -20 * up, bob: bounce, lean } };
}
function scribeState(T) {
  // L13 跟着乐、L14 开始记、L16 40.60 举笔、41.20 蘸墨，然后备好姿势等着记
  const kWrite = ez(T, L14 + 0.1, L14 + 0.35, outCubic) * (1 - ez(T, L15 - 0.15, L15 + 0.1, inOutSine));
  const raise = ez(T, L16 + 0.69, L16 + 0.95, outBack) * (1 - ez(T, L16 + 1.24, L16 + 1.36, inOutSine));
  const dip = Math.sin(Math.PI * seg(T, L16 + 1.24, L16 + 1.62));
  const lean = (SCRIBE.joints?.lean ?? 0) * ez(T, L16 + 0.69, L16 + 1.0, outCubic);
  const joy = T < L14 ? 1 - ez(T, L13 + 1.5, L13 + 2.0) : 0;
  const o = { x: SCRIBE.x, y: SCRIBE.y, s: SCRIBE.s, face: SCRIBE.face, t: T };
  if (kWrite > 0) return { ...o, pose: { from: SCRIBE.pose, to: 'write', k: kWrite }, expr: 'focused' };
  return {
    ...o, pose: SCRIBE.pose, expr: T < L14 ? (joy > 0.4 ? 'happy' : 'normal') : SCRIBE.expr,
    joints: { lean, shF: 92 * raise - 40 * dip, elF: -38 * raise + 30 * dip, bob: 4 * joy * Math.abs(Math.sin(TAU * T * 1.2)) },
  };
}

// ———————————————————— 彩纸 ————————————————————
// 34.30 左侧朝臣举手一撒（depth 0.9 → 画在 0.95）；35.00 右侧画外的朝臣一撒（从右沿飞进来）。
const CONF_D = 0.95;
const BURSTS = [
  ...COURT.map((m, i) => ({ at: L13 + 0.3 + i * 0.04, seed: 41 + i, count: 34, x: m.x + 16, y: 676, spread: 14, speed: [380, 760], angle: [-2.1, -0.75], gravity: 560, drag: 1.5, life: [2.0, 2.8], spin: [-9, 9], size: [9, 14] })),
  { at: L13 + 1.0, seed: 47, count: 80, x: 2010, y: 600, spread: 30, speed: [520, 980], angle: [-2.95, -2.2], gravity: 560, drag: 1.4, life: [2.0, 2.7], spin: [-9, 9], size: [9, 14] },
];
// 前景虚化大彩纸（depth 1.38），只在 34.4–37.6 飘过镜头前
const FG_CONF = Array.from({ length: 9 }, (_, i) => ({
  x0: 120 + hash2(i, 31) * 1800, t0: L13 + 0.42 + hash2(i, 32) * 1.3, v: 260 + hash2(i, 33) * 140,
  col: CONF_COLS[i % 4], size: 34 + hash2(i, 34) * 22, ph: hash2(i, 35) * TAU,
}));

// ———————————————————— 界面 ————————————————————
function dialogState(T) {
  if (T < L14) return null;
  const base = { t: T, seed: 11 };
  if (T < L15) {
    return { ...base, speaker: 'king', pop: seg(T, L14, L14 + 0.3), text: '名字？', typed: seg(T, L14 + 0.29, L14 + 0.74), cursor: T >= L14 + 0.89 };
  }
  if (T < L16) {
    // 38.11 名签与头像翻牌（国王 → ？？？），「名字？」弹走；推到 CU-H 时对话框收起，让出特写
    return {
      ...base, speaker: 'hero', from: 'king', tag: TXT.unknown, tagFlip: seg(T, L15, L15 + 0.26),
      text: '名字？', erase: seg(T, L15, L15 + 0.22), textArea: { x: 490, w: 790 },
      pop: 1 - seg(T, L15 + 0.5, L15 + 0.7),
    };
  }
  // 39.98 重新弹起（勇者说话），40.20「咳咳」，41.60–41.85 逐字弹走，只剩空框 + 光标（= 合同的对话框参数）
  const er = seg(T, L16 + 1.69, L16 + 1.94), D = sv('dialog', T);
  return {
    ...base, ...D, pop: seg(T, L16 + 0.07, L16 + 0.31),
    text: er >= 1 ? D.text : '咳咳', typed: seg(T, L16 + 0.29, L16 + 0.53), erase: er,
    cursor: T >= L16 + 0.55 && D.cursor,
  };
}

// ———————————————————— 一帧 ————————————————————
const ENV = SEAM.env.params;                    // { light:'sunny', windowL/R:'day', lectern:true, confettiFloor:0.35 }
const WALL = '#E3D6BE';                         // 后墙底色（= mixHex(paper2, stone, 0.35)）：虚化时屏幕边缘不透黑底
/**
 * 王座厅整帧。merge：心形遮罩里（与 b03 重叠期）把 back+mid 合成一层、不画界面，省缓冲。
 */
function drawRoom(g, T, ctx, { merge = false } = {}) {
  const c = camAt(T);
  const env = { ...ENV, confettiFloor: ENV.confettiFloor * ez(T, L13 + 0.95, L13 + 3.1, inOutSine) };
  // 景深：推到勇者格时远景 / 中景（含朝臣）虚化，回到 TR-2S 时为 0（接缝处与合同一致）
  const kz = seg(c.zoom, 1.9, CAMS.CU_H.zoom);
  const room = (lg, layer) => drawThroneRoom(lg, T, c, { ...env, layer });
  const drawCourt = (lg) => {
    lg.save(); applyCam(lg, c, COURT_D);
    COURT.forEach((m, i) => drawCitizen(lg, { s: 1, ...m, t: T, ...courtierPose(T, i) }));
    lg.restore();
  };
  // 远景 + 中景（柱子、长幡、朝臣）
  if (merge) ctx.layer(g, throneLayer('mid'), (lg) => { room(lg, 'back'); room(lg, 'mid'); drawCourt(lg); });
  else {
    if (kz > 0) { g.save(); g.fillStyle = WALL; g.fillRect(-20, -20, 1960, 1120); g.restore(); }
    ctx.layer(g, { ...throneLayer('back'), blur: 3.2 * kz }, (lg) => room(lg, 'back'));
    ctx.layer(g, { ...throneLayer('mid'), blur: 2.4 * kz }, (lg) => { room(lg, 'mid'); drawCourt(lg); });
  }
  // 主体层：地面、台阶、王座、讲台 + 全部角色 + 飞起的散页 + 彩纸
  let heroA = null, kingA = null;
  ctx.layer(g, throneLayer('main'), (lg) => {
    room(lg, 'main');
    lg.save(); applyCam(lg, c, 1);
    drawGuard(lg, { ...GUARD_L, t: T, pose: guardPose(T, 0) });
    drawGuard(lg, { x: 1880, y: 790, s: 1, face: -1, t: T, pose: guardPose(T, 1), hat: false, variant: 2, seed: 5 });
    drawHerald(lg, heraldState(T));
    drawScribe(lg, scribeState(T));
    kingA = drawKing(lg, kingState(T));
    // 被吸起来的散页（40.00–40.85：从讲台飞向勇者，落回对话框后面）
    if (T > L16 + 0.08 && T < L16 + 1.0) drawSheets(lg, T);
    const ho = heroState(T);
    const probe = heroRig(ho);
    const roll = rollState(T, probe);
    if (roll) drawRolledNotice(lg, roll);
    heroA = drawHero(lg, ho);
    lg.restore();
    // 彩纸（在角色前面）
    if (T > L13 + 0.28 && T < L13 + 4.0) {
      lg.save(); applyCam(lg, c, CONF_D);
      for (const b of BURSTS) burst(lg, T, b, confettiDraw);
      lg.restore();
    }
  });
  // 光（彩窗光柱 + 浮尘）
  room(g, 'glow');
  // 前景：虚化立柱 + 帷幔 + 镜头前飘过的大彩纸
  ctx.layer(g, throneLayer('fg'), (lg) => {
    room(lg, 'fg');
    if (T > L13 + 0.4 && T < L13 + 3.8) {
      lg.save(); applyCam(lg, c, 1.38);
      for (const f of FG_CONF) {
        const age = T - f.t0;
        if (age < 0 || age > 2.6) continue;
        const y = -60 + f.v * age, x = f.x0 + 40 * Math.sin(age * 2.2 + f.ph);
        bigConfetti(lg, x, y, { rot: f.ph + age * 3, flip: Math.cos(age * 5 + f.ph), size: f.size, col: f.col });
      }
      lg.restore();
    }
  });
  if (merge) return { c, heroA, kingA };
  // 界面层（屏幕空间）
  ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => drawUI(lg, T, c, heroA));
  return { c, heroA, kingA };
}
function drawSheets(lg, T) {
  const from = [1150, 742], to = [HERO.x + 70, 650];
  for (let i = 0; i < 3; i++) {
    const t0 = L16 + 0.08 + i * 0.07, u = clamp((T - t0) / 0.78);
    if (u <= 0 || u >= 1) continue;
    // 先被吸起朝勇者飘（0–0.55），吸气停住后打着旋往下落回对话框后面
    const a = outCubic(clamp(u / 0.55)), b = clamp((u - 0.5) / 0.5);
    const x = lerp(from[0] - i * 26, to[0] + 40 + i * 40, a) + 22 * Math.sin(u * 9 + i);
    const y = lerp(from[1] - i * 8, to[1] - 40 + i * 30, a) - 70 * Math.sin(Math.PI * clamp(u / 0.6)) + 150 * b * b;   // 终点在对话框背后
    drawLooseSheet(lg, { x, y, rot: (u * 5 + i) * (i % 2 ? -1 : 1), flip: u * 2.2 + i * 0.3, s: 0.9, seed: i + 1 });
  }
}

function drawUI(lg, T, c, heroA) {
  // 头顶小名签「？？？」（L15 与对话框名签同时翻出）
  if (T >= L15) {
    // 合同锚点（TR-2S 时严格在这里）；推到勇者格时挪到呆毛左上方（否则贴着画面上沿）
    let [sx, sy] = toScreen(c, TAG.depth ?? 1, TAG.at[0], TAG.at[1]);
    const kz = seg(c.zoom, SEAM_CAM.zoom, CAMS.CU_H.zoom);
    if (kz > 0 && heroA) {
      const [ax, ay] = toScreen(c, 1, heroA.ahogeTip[0], heroA.ahogeTip[1]);
      sx = lerp(sx, ax - 150, kz); sy = lerp(sy, Math.max(112, ay - 70), kz);
    }
    nameTagSmall(lg, { ...sv('headTag', T), x: sx, y: sy, pop: seg(T, L15, L15 + 0.25) });
  }
  // 思考泡（云朵 + 三个圆点 38.40 / 38.70 / 39.00），呆毛一弹时被戳破
  if (T >= L15 + 0.12 && T < L16 + 0.16 && heroA) {
    const [hx, hy] = toScreen(c, 1, heroA.head[0], heroA.head[1]);
    const z = c.zoom / CAMS.CU_H.zoom;
    const pop = T < L16 ? seg(T, L15 + 0.12, L15 + 0.34) : 1 - seg(T, L16, L16 + 0.14);
    thinkDots(lg, {
      x: hx + 560 * z + 80 * (1 - z), y: hy - 210 * z - 40 * (1 - z), w: 420 * Math.max(0.6, z), h: 250 * Math.max(0.6, z),
      tail: [hx + 170 * z, hy - 110 * z], pop, t: T, at: [L15 + 0.29, L15 + 0.59, L15 + 0.89], seed: 9,
    });
  }
  // 「叮」：呆毛尖
  if (T >= L16 && T < L16 + 0.5 && heroA) {
    const [ax, ay] = toScreen(c, 1, heroA.ahogeTip[0], heroA.ahogeTip[1]);
    drawDing(lg, { x: ax, y: ay, p: (T - L16) / 0.5, size: 64 });
  }
  const d = dialogState(T);
  if (d) dialogBox(lg, d);
}

function fxOf(ctx, T, inOverlap) {
  ctx.fx.sat = Math.max(ctx.fx.sat ?? 1, inOverlap ? lerp(1, 1.05, seg(T, T_IN, T_FULL)) : 1.05);
  if (!inOverlap) {
    // b03 的纸纹 0.30 / 暗角 0.2 → 王座厅默认 0.22 / 0.3（0.5s 过渡，不跳）
    const k = ez(T, T_FULL, T_FULL + 0.5, inOutSine);
    ctx.fx.paper = lerp(0.3, 0.22, k);
    ctx.fx.vignette = lerp(0.2, 0.3, k);
  }
  // 国王落地：小震
  impact(ctx, T, LANDS[0], 'S', { shake: 6, flash: 0 });
  impact(ctx, T, LANDS[1], 'S', { shake: 4, flash: 0 });
  impact(ctx, T, LANDS[2], 'S', { shake: 5, flash: 0 });
}

// ———————————————————— 心形遮罩（b03 → b04） ————————————————————
const HEART0 = { cx: 1100, cy: 600, size: 300 };
function heartGeom(T) {
  const [kx, ky] = toScreen(CAMS.TR_W, 1, KING.x, KING.y - 150);          // 国王（半空）在 TR-W 的屏幕位置
  const end = coverSize('heart', { cx: kx, cy: ky }) * 1.03;
  const k = outQuad(seg(T, T_IN, T_FULL - 0.04));                            // 34.06 起已盖满（描边带也出画）
  const size = HEART0.size * Math.pow(end / HEART0.size, k);
  const m = (size - HEART0.size) / (end - HEART0.size);                     // 中心随放大量滑向国王：b03 的心始终包在里面
  return { cx: lerp(HEART0.cx, kx, m), cy: lerp(HEART0.cy, ky, m), size };
}

export default [
  {
    id: 'b04_heart_in', start: T_IN, end: T_FULL, z: 1,
    draw(g, T, lt, ctx) {
      const hg = heartGeom(T);
      fxOf(ctx, T, true);
      shapeReveal(ctx, g, 'heart', hg, (g2) => {
        drawRoom(g2, T, ctx, { merge: true });
        // 红心“开口”：33.60 时心里还是 b03 涂满的红，0.16s 内从中心开出一个心形洞（不做溶解）
        const q = outCubic(seg(T, T_IN, T_IN + 0.16));
        if (q < 1) {
          const outer = shapeGeom('heart', hg).path, inner = shapeGeom('heart', { ...hg, size: hg.size * q * 0.999 }).path;
          const p = new Path2D(); p.addPath(outer); if (q > 0.002) p.addPath(inner);
          g2.save(); g2.fillStyle = PAL.heart; g2.fill(p, 'evenodd'); g2.restore();
        }
      });
    },
  },
  { id: 'b04_joy', start: T_FULL, end: L14, draw(g, T, lt, ctx) { fxOf(ctx, T, false); drawRoom(g, T, ctx); } },
  { id: 'b04_ask', start: L14, end: L15, draw(g, T, lt, ctx) { fxOf(ctx, T, false); drawRoom(g, T, ctx); } },
  { id: 'b04_think', start: L15, end: L16, draw(g, T, lt, ctx) { fxOf(ctx, T, false); drawRoom(g, T, ctx); } },
  { id: 'b04_inhale', start: L16, end: N1A, draw(g, T, lt, ctx) { fxOf(ctx, T, false); drawRoom(g, T, ctx); } },
];
