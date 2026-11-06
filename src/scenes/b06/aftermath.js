// b06 私有：王座厅余波（56.89–60.50）。接缝 56.89 与 _seams.js 的 b05|b06 合同逐项一致（机位、漂移、布景、角色、彩纸、名签、后期），
// 之后：国王张嘴「达…」→ 众人扑上去捂嘴「别！」打成烟团 → 撞断横幅吊绳 → 横幅卷成大纸卷弹三级台阶 → 勇者跳过 → 纸卷滚向镜头出画。
import { NAMES } from '../../cues.js';
import { PAL, blob, cut, shade, glow } from '../../core/paper.js';
import { clamp, lerp, seg, hash2, noise1, wobble, TAU, rgba, mixHex } from '../../core/util.js';
import { ez, glide, outBack, outCubic, inQuad, inCubic, outQuad, snap } from '../../core/ease.js';
import { cam, applyCam, lerpCam, toScreen } from '../../core/camera.js';
import { burst } from '../../core/particles.js';
import { drawThroneRoom, CAMS as TR, throneLayer } from '../../env/throne.js';
import { SEAMS, resolveParams, drawSeamConfetti } from '../_seams.js';
import { drawHero } from '../../rigs/hero.js';
import { drawKing } from '../../rigs/king.js';
import { drawCitizen, drawGuard, drawScribe, drawHerald } from '../../rigs/folk.js';
import { drawCrown } from '../../props/royal.js';
import { drawDecree, drawPaperRoll } from '../../props/paper.js';
import { dustDraw, sparkDraw } from '../../props/misc.js';
import { nameTagSmall, bubble, glyphIcon } from '../../ui/kit.js';
import { impact } from '../../fx/transitions.js';
import { TT, camDrift } from './common.js';

const LOW1 = TR.TR_LOW;                 // cam(1000,720,1.2)：57.80–58.40 降到贴地
const LOW2 = cam(1180, 730, 1.2);       // 58.40 后略右摇，跟纸卷下台阶
const LOW3 = cam(1120, 760, 1.3);       // 59.20 后纸卷滚向镜头时微推
// —— 接缝合同（src/scenes/_seams.js 的 b05|b06）：接缝帧的一切参数都从这里读，不硬编码 ——
const SEAM = SEAMS['b05|b06'];
const ITEM = Object.fromEntries([...(SEAM.actors || []), ...(SEAM.props || []), ...(SEAM.ui || [])].map((it) => [it.id, it]));
const LAYER_O = Object.fromEntries(SEAM.layers.map((L) => [L.id, L.o]));
/** 合同里某一项在 T 时刻的参数（函数值按 T 求值）。 */
const cp = (id, T, c) => resolveParams(ITEM[id].params, T, { c, A: {} });
const lo = (id, T, c) => (LAYER_O[id] == null ? null : resolveParams(LAYER_O[id], T, { c, A: {} }));
const KING_AT = [ITEM.king.params.x, ITEM.king.params.y];
/** 机位（含漂移，与合同同一公式）。 */
export function aftCam(T) {
  let c = SEAM.cam;
  c = lerpCam(c, LOW1, ez(T, TT.camLow0, TT.camLow1, glide));
  c = lerpCam(c, LOW2, ez(T, TT.camLow1 - 0.05, TT.camLow1 + 0.45, glide));
  c = lerpCam(c, LOW3, ez(T, TT.heroJump - 0.1, TT.rollCam0, glide));
  return camDrift(c, T, 1, SEAM.drift);
}

// ———— 烟团（打架的纸云）：57.74 成形，向右蹦三下，58.40 撞到右侧吊绳那根柱子 ————
const CLOUD0 = TT.pounce + 0.14, CLOUD1 = TT.ropeSnap;
function cloudAt(T) {
  const k = seg(T, CLOUD0, CLOUD1);
  const x = lerp(1520, 1730, inQuad(k));
  const hop = Math.abs(Math.sin(Math.PI * 3 * k)) * 46 * (1 - k * 0.3);
  const y = 650 - hop;
  const r = lerp(120, 175, outBack(clamp(k * 4), 2)) * (1 + 0.04 * Math.sin(T * 31));
  return { x, y, r, k };
}
/** 从烟团里乱伸出来的手脚与家伙（先于云画，内端被云盖住）。 */
const LIMBS = [
  { col: PAL.heroBlue, end: 'boot', a: 0.2, w: 24, sp: 9 },
  { col: PAL.red, end: 'hand', a: 1.2, w: 22, sp: -11 },
  { col: PAL.robe, end: 'boot', a: 2.3, w: 26, sp: 7 },
  { col: PAL.gold, end: 'hand', a: 3.1, w: 20, sp: -8 },
  { col: PAL.grassDark, end: 'hand', a: 4.0, w: 22, sp: 10 },
  { col: PAL.heroBlue, end: 'hand', a: 4.9, w: 22, sp: -9 },
  { col: PAL.red, end: 'boot', a: 5.6, w: 24, sp: 8 },
];
function drawLimbs(g, T, cl) {
  g.save();
  g.lineCap = 'round';
  LIMBS.forEach((L, i) => {
    const a = L.a + Math.sin(T * L.sp + i) * 0.35;
    const out = cl.r * (1.22 + 0.26 * Math.sin(T * 13 + i * 2.1));
    const x0 = cl.x + Math.cos(a) * cl.r * 0.3, y0 = cl.y + Math.sin(a) * cl.r * 0.24;
    const x1 = cl.x + Math.cos(a) * out, y1 = cl.y + Math.sin(a) * out * 0.8;
    g.strokeStyle = mixHex(L.col, PAL.ink, 0.25); g.lineWidth = L.w * 1.35 + 4;
    g.beginPath(); g.moveTo(x0 + 2, y0 + 3); g.lineTo(x1 + 2, y1 + 3); g.stroke();
    g.strokeStyle = L.col; g.lineWidth = L.w * 1.35;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (L.end === 'boot') cut(g, blob(x1 + Math.cos(a) * 12, y1 + Math.sin(a) * 9, 24, 16, { seed: 90 + i, rot: a }), PAL.boot, { rim: mixHex(PAL.boot, PAL.white, 0.3), rimW: 2 });
    else cut(g, blob(x1 + Math.cos(a) * 9, y1 + Math.sin(a) * 7, 18, 16, { seed: 95 + i }), PAL.skin, { rim: PAL.white, rimW: 2 });
  });
  // 卫兵的长矛与传令官的号从团里戳出来
  const sa = -0.5 + Math.sin(T * 6) * 0.4;
  g.strokeStyle = PAL.wood; g.lineWidth = 8;
  const sx0 = cl.x - Math.cos(sa) * 40, sy0 = cl.y - Math.sin(sa) * 30, sx1 = cl.x + Math.cos(sa) * cl.r * 1.55, sy1 = cl.y + Math.sin(sa) * cl.r * 1.2;
  g.beginPath(); g.moveTo(sx0, sy0); g.lineTo(sx1, sy1); g.stroke();
  g.save(); g.translate(sx1, sy1); g.rotate(sa);
  cut(g, blob(14, 0, 22, 9, { seed: 99 }), PAL.steel, { rim: PAL.white, rimW: 2 });
  g.restore();
  g.restore();
}
function drawCloud(g, T, cl, alpha = 1) {
  const step = Math.floor(T * 14); // 14fps 的“沸腾”抖动
  g.save();
  g.globalAlpha *= alpha;
  drawLimbs(g, T, cl);
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * TAU + hash2(step, i) * 0.5;
    const rr = cl.r * (0.42 + hash2(i, 7) * 0.32);
    const px = cl.x + Math.cos(a) * cl.r * 0.55 + (hash2(step + 3, i) - 0.5) * 16;
    const py = cl.y + Math.sin(a) * cl.r * 0.42 + (hash2(step + 9, i) - 0.5) * 14;
    const p = blob(px, py, rr, rr * 0.86, { seed: 40 + i + (step % 3) * 17, amp: 0.05 });
    cut(g, p, mixHex(PAL.paper, PAL.paper2, hash2(i, 3) * 0.6), { rim: PAL.white, rimW: 3 });
    shade(g, p, PAL.kraftDark, px, py - rr, px, py + rr, 0, 0.35);
  }
  const core = blob(cl.x, cl.y + 6, cl.r * 0.62, cl.r * 0.5, { seed: 77 + (step % 4), amp: 0.06 });
  cut(g, core, PAL.paper, { rim: PAL.white, rimW: 3 });
  // 打架符号：路径星 + 小旋涡线
  for (let i = 0; i < 4; i++) {
    const a = T * 5 + i * 1.7;
    const sx = cl.x + Math.cos(a) * cl.r * 0.8, sy = cl.y - cl.r * 0.35 + Math.sin(a * 1.3) * cl.r * 0.35;
    glyphIcon(g, 'star', sx, sy, 30 + 8 * Math.sin(T * 20 + i), { rot: a });
  }
  g.restore();
}

// ———— 横幅：58.40 右吊绳断 → 右端垂下 → 58.50 左绳断，一“唰”卷成大纸卷 → 58.65 落在顶层台阶 ————
const BANNER = { x0: 260, y: 270, len: 1620, w: 104 };
const ROLL = { r: 130, len: 480 };
const STEP_X = 1650;
const STEPS = [[STEP_X, 790], [STEP_X - 30, 820], [STEP_X - 60, 850]];
function decreeLocal(T, alpha = 1) {
  return { x: 0, y: 0, len: BANNER.len, width: BANNER.w, unroll: 1, hung: 0, sag: 0, ropeH: 140, sweep: -1, charSize: 64, prints: [-1e6, -1e6, -1e6], printDur: 0.22, t: T, seed: 12, alpha };
}
/** 横幅下落（world，在 main 层里按 depth 0.8 画）。 */
function drawFallingBanner(lg, T, c) {
  const k1 = seg(T, TT.ropeSnap, TT.ropeSnap + 0.1);
  const k2 = seg(T, TT.ropeSnap + 0.1, TT.ropeSnap + 0.2);
  if (k2 >= 1) return;
  lg.save();
  applyCam(lg, c, 0.8);
  // 左绳（断之前）与右绳断头
  lg.strokeStyle = PAL.kraftDark; lg.lineWidth = 4; lg.lineCap = 'round';
  const th = 0.2 * inQuad(k1) * (1 - k2);
  if (k2 <= 0) { lg.beginPath(); lg.moveTo(250, 214); lg.lineTo(220, 78); lg.stroke(); }
  const sw = Math.sin((T - TT.ropeSnap) * 14) * 0.5 * Math.exp(-(T - TT.ropeSnap) * 3);
  lg.beginPath(); lg.moveTo(1920, 78); lg.lineTo(1920 + Math.sin(sw) * 50, 78 + Math.cos(sw) * 60); lg.stroke();
  lg.translate(BANNER.x0, BANNER.y + 120 * inQuad(k2));
  lg.rotate(th);
  // 58.50 起：横幅从上沿往下“唰”地卷起（scaleY 收向下沿）
  const sy = 1 - outCubic(k2);
  lg.translate(0, BANNER.w / 2); lg.scale(1 - 0.4 * k2, Math.max(0.02, sy)); lg.translate(0, -BANNER.w / 2);
  drawDecree(lg, decreeLocal(T));
  lg.restore();
}

/** 纸卷：返回屏幕坐标状态 { x, y, s(屏幕缩放), r, len, spin, alpha, front(在勇者前) } 或 null。 */
export function rollState(T, c) {
  const t0 = TT.ropeSnap + 0.1;
  if (T < t0) return null;
  const B = TT.bounce;
  const land = TT.heroJump - 0.02; // 59.18 落地
  const zs = c.zoom;
  // 1) 58.50–58.65：从横幅下沿成形、落到顶层台阶
  if (T < B[0]) {
    const k = seg(T, t0, B[0]);
    const a = toScreen(c, 0.8, BANNER.x0 + BANNER.len * 0.55, BANNER.y + BANNER.w / 2 + 40);
    const b = toScreen(c, 1, STEPS[0][0], STEPS[0][1] - ROLL.r);
    const r = lerp(40, ROLL.r, outCubic(clamp(k * 1.6)));
    const len = lerp(BANNER.len * 0.75, ROLL.len, outCubic(clamp(k * 1.6)));
    return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], inQuad(k)), s: lerp(1 + (zs - 1) * 0.8, zs, k), r, len, spin: k * 4, front: false };
  }
  // 2) 58.65–59.18：弹三级台阶（每次落地挤压），最后一跳落到地面
  const spots = [...STEPS, [STEP_X - 110, 880]];
  const times = [B[0], B[1], B[2], land];
  if (T < land) {
    let i = 0; while (i < 3 && T >= times[i + 1]) i++;
    const k = seg(T, times[i], times[i + 1]);
    const p0 = spots[i], p1 = spots[i + 1];
    const hgt = i < 2 ? 70 : 52;
    const wx = lerp(p0[0], p1[0], k), wy = lerp(p0[1], p1[1], k) - ROLL.r - hgt * Math.sin(Math.PI * k);
    const [sx, sy] = toScreen(c, 1, wx, wy);
    return { x: sx, y: sy, s: zs * (1 + 0.03 * (i + k)), r: ROLL.r, len: ROLL.len, spin: 4 + (i + k) * 1.4, front: false };
  }
  // 3) 59.18–60.15：沿红毯滚向镜头，越滚越大，从下沿出画
  const k = seg(T, land, TT.rollCam0 - 0.05);
  const [sx0, sy0] = toScreen(c, 1, spots[3][0], spots[3][1] - ROLL.r);
  const e = inCubic(k);
  const s = zs * 1.12 * Math.pow(4.4, e);
  return { x: lerp(sx0, 960, outQuad(k)), y: lerp(sy0, 1080 + ROLL.r * s * 0.9, e) + (1 - k) * 0, s, r: ROLL.r, len: ROLL.len, spin: 8 + k * 9, front: T >= TT.heroJump + 0.02 };
}
function drawRoll(lg, T, st) {
  if (!st) return;
  lg.save();
  lg.translate(st.x, st.y);
  lg.scale(st.s, st.s);
  drawPaperRoll(lg, { x: 0, y: 0, r: st.r, len: st.len, spin: st.spin, t: T, bounceAt: TT.bounce, view: 'side', chars: NAMES.hero });
  lg.restore();
}

// ———— 角色 ————
function heroState(T) {
  // 合同态 → 惊 → 蓄力 → 飞扑 → 烟团里 → 被甩出 → 落地发懵 → 看见纸卷 → 跳 → 欢呼
  const P = TT.pounce;
  if (T < P - 0.18) return { seam: true }; // 合同原样
  if (T < P - 0.04) {
    const k = seg(T, P - 0.18, P - 0.06);
    return { x: 620, y: 880, pose: { from: 'cheer', to: 'brake', k: ez(k, 0, 1, outCubic) }, expr: 'shock', ahoge: 'straight', squash: -0.08 * k };
  }
  if (T < CLOUD0) {
    const k = seg(T, P - 0.04, CLOUD0);
    const x = lerp(620, 1430, outCubic(k)), y = lerp(880, 690, k) - 150 * Math.sin(Math.PI * k);
    return { x, y, pose: 'hop', act: 0.5, expr: 'shout', rot: 0.6 * k, air: true, vel: [3600, 0] };
  }
  if (T < TT.ropeSnap) return { inCloud: true };
  const land = TT.ropeSnap + 0.3;
  if (T < land) {
    const k = seg(T, TT.ropeSnap, land);
    const cl = cloudAt(TT.ropeSnap);
    return { x: lerp(cl.x - 40, 1400, k), y: lerp(cl.y - 40, 880, inQuad(k)) - 160 * Math.sin(Math.PI * k), pose: 'roll', act: k * 1.5, expr: 'dizzy', air: true, vel: [-900, 0] };
  }
  const J0 = TT.heroJump - 0.17, J1 = TT.heroJump + 0.25;
  if (T < J0) {
    const sq = wobble(T, land, 3, 0.15) * 0.18;
    return { x: 1400, y: 880, pose: T < land + 0.25 ? 'brake' : 'freeze', expr: T < land + 0.22 ? 'dizzy' : 'shock', squash: -Math.abs(sq), ahoge: T < land + 0.22 ? 'normal' : 'straight' };
  }
  if (T < J1) {
    const k = seg(T, J0, J1);
    return { x: 1400 - 40 * k, y: 880 - 300 * Math.sin(Math.PI * clamp((k - 0.12) / 0.8)), pose: 'hop', act: k, expr: k < 0.6 ? 'shout' : 'shock', air: k > 0.1 && k < 0.9, ahoge: 'straight', vel: [-260, k < 0.5 ? -700 : 600] };
  }
  const k = seg(T, J1, J1 + 0.3);
  return { x: 1360, y: 880, pose: k < 1 ? { from: 'hop', to: 'cheer', k } : 'cheer', act: 1, expr: 'laugh', squash: -0.12 * wobble(T, J1, 3, 0.2) };
}
function drawHeroAt(lg, T, hs) {
  if (hs.inCloud) return null;
  const o = { x: hs.x, y: hs.y, s: 1, face: 1, t: T, pose: hs.pose, act: hs.act, expr: hs.expr, ahoge: hs.ahoge || 'normal', sword: 'back', squash: hs.squash || 0,
    // 空中：围巾缩短并顺相对气流往身后上方飘（不再垂到地上）；落地后恢复 780 拖地
    scarf: hs.air ? { len: 460, vel: hs.vel || [-420, 260], ground: 1e5 } : { len: 780, vel: hs.vel || [0, 0] } };
  if (hs.rot) { o.rot = hs.rot; o.pivot = [0, -120]; }
  return drawHero(lg, o);
}
/** 扑上去的四个人：起点、出发时刻、画法。 */
const POUNCERS = [
  { id: 'guardR', fn: drawGuard, at: TT.pounce - 0.05 },
  { id: 'guardL', fn: drawGuard, at: TT.pounce - 0.02 },
  { id: 'scribe', fn: drawScribe, at: TT.pounce },
  { id: 'herald', fn: drawHerald, at: TT.pounce + 0.03 },
].map((P) => { const q = ITEM[P.id].params; return { ...P, x: q.x, y: q.y, face: q.face }; });
/** 散落在台阶上的人堆（58.40 后）。 */
const HEAP = {
  guardR: { x: 1790, y: 790, face: -1, rot: 0.15 },
  guardL: { x: 1520, y: 830, face: 1, rot: -0.1 },
  scribe: { x: 1640, y: 800, face: -1, rot: 0.25 },
  herald: { x: 1440, y: 800, face: 1, rot: -0.3 },
};
function drawPouncer(lg, T, P, cl, c) {
  const o = cp(P.id, T, c); // 合同参数（接缝帧原样）
  const fly0 = P.at, fly1 = CLOUD0 + 0.02;
  if (T < fly0 - 0.12) return P.fn(lg, T >= TT.pounce - 0.16 ? { ...o, expr: 'shock' } : o);
  if (T < fly0) return P.fn(lg, { ...o, x: P.x, y: P.y, face: P.face, pose: 'stepBack', expr: 'shock' });
  if (T < fly1) {
    const k = seg(T, fly0, fly1);
    const tx = cl.x + (P.x < cl.x ? -60 : 60), ty = cl.y + 40;
    const face = tx > P.x ? 1 : -1;
    return P.fn(lg, { ...o, x: lerp(P.x, tx, outCubic(k)), y: lerp(P.y, ty, k) - 110 * Math.sin(Math.PI * k), face, pose: 'pounce', expr: 'determined' });
  }
  if (T < TT.ropeSnap) {
    // 烟团里翻滚：绕团心转，四肢从云边伸出来
    const i = POUNCERS.indexOf(P);
    const a = T * 7.5 + i * (TAU / 4);
    lg.save();
    lg.translate(cl.x + Math.cos(a) * cl.r * 0.42, cl.y + Math.sin(a) * cl.r * 0.3);
    lg.rotate(a + Math.PI / 2);
    P.fn(lg, { ...o, x: 0, y: 95, face: i % 2 ? 1 : -1, pose: 'pounce', expr: 'determined' });
    lg.restore();
    return null;
  }
  // 人堆
  const h = HEAP[P.id];
  const k = seg(T, TT.ropeSnap, TT.ropeSnap + 0.3);
  const cl0 = cloudAt(TT.ropeSnap);
  lg.save();
  lg.translate(lerp(cl0.x, h.x, outCubic(k)), lerp(cl0.y, h.y, inQuad(k)) - 80 * Math.sin(Math.PI * k));
  lg.rotate(h.rot * k + (1 - k) * 2);
  P.fn(lg, { ...o, x: 0, y: 30, face: h.face, pose: 'pounce', expr: 'dizzy' });
  lg.restore();
  return null;
}
function kingParams(T, c) {
  const base = cp('king', T, c); // 合同：sealRaise + joy + 金印 + 王冠（歪 / 下滑 / 压扁）
  const lean0 = TT.kingTalk - 0.24;
  if (T < lean0) return base;
  if (T < TT.pounce - 0.04) {
    const k = ez(T, lean0, TT.kingTalk - 0.02, glide);
    return { ...base, pose: { from: base.pose, to: 'leanForward', k }, expr: T < TT.kingTalk - 0.06 ? base.expr : 'smile', talk: T >= TT.kingTalk ? 0.9 : 0, crown: { ...base.crown, pop: 6 * wobble(T, TT.kingTalk, 4, 0.2) } };
  }
  return { ...base, pose: 'leanForward', expr: 'gasp', crown: { ...base.crown, pop: 10 * Math.abs(wobble(T, TT.pounce, 5, 0.2)) } };
}

/** 余波整帧。o.lite：重叠期（60.20 后）合并图层省缓冲。返回本帧需要的锚点。 */
export function drawAftermath(g, T, ctx) {
  const c = aftCam(T);
  const lite = T >= TT.rollCam0 - 0.05;
  const decreeOn = T < TT.ropeSnap;
  const env = resolveParams(SEAM.env.params, T, { c, A: {} }); // 合同布景参数（圣旨横幅、扫光、地上彩纸）
  if (!decreeOn) delete env.decree;
  const A = {};
  const cl = cloudAt(T);
  const inCloud = T >= CLOUD0 && T < TT.ropeSnap;
  const roll = rollState(T, c);
  // back / mid（朝臣）
  if (lite) {
    ctx.layer(g, lo('mid', T, c), (lg) => { drawThroneRoom(lg, T, c, { ...env, layer: 'back' }); drawThroneRoom(lg, T, c, { ...env, layer: 'mid' }); });
  } else {
    ctx.layer(g, lo('back', T, c), (lg) => drawThroneRoom(lg, T, c, { ...env, layer: 'back' }));
    ctx.layer(g, lo('mid', T, c), (lg) => {
      drawThroneRoom(lg, T, c, { ...env, layer: 'mid' });
      lg.save(); applyCam(lg, c, ITEM.courtiers.depth ?? 0.9);
      const cq = cp('courtiers', T, c);
      const late = T >= TT.pounce + 0.02, alarm = T >= TT.pounce - 0.1;
      for (const m of [...cq.members].sort((a, b) => (a.y ?? 0) - (b.y ?? 0))) {
        const q = { t: cq.t, s: cq.s ?? 1, ...m };
        if (late) { q.pose = 'jawDrop'; } else if (alarm) { q.expr = 'surprise'; }
        drawCitizen(lg, q);
      }
      lg.restore();
    });
  }
  // main：布景 + 角色（合同顺序：guardL, scribe, herald, guardR, king, hero）
  ctx.layer(g, lo('main', T, c), (lg) => {
    A.env = drawThroneRoom(lg, T, c, { ...env, layer: 'main' });
    if (!decreeOn) drawFallingBanner(lg, T, c);
    lg.save(); applyCam(lg, c, 1);
    const P = Object.fromEntries(POUNCERS.map((p) => [p.id, p]));
    // 国王：烟团前正常画；烟团里只露王冠飞起；之后躺在人堆里
    const kingDraw = () => {
      if (T < CLOUD0) { A.king = drawKing(lg, kingParams(T, c)); return; }
      if (T < TT.ropeSnap) {
        lg.save(); lg.translate(cl.x + 30, cl.y + 30); lg.rotate(Math.sin(T * 9) * 0.5);
        drawKing(lg, { x: 0, y: 110, s: 1, face: -1, t: T, pose: 'leap', expr: 'gasp', holding: null, crown: { off: true } });
        lg.restore();
        return;
      }
      const k = seg(T, TT.ropeSnap, TT.ropeSnap + 0.25);
      drawKing(lg, { x: lerp(cl.x, 1560, outCubic(k)), y: lerp(cl.y, 784, inQuad(k)), s: 1, face: -1, t: T, pose: 'faint', expr: 'dizzy', legsUp: 0.85 * k, stars: k, holding: null, crown: { tilt: 34, slip: 0.45, squash: 0.4 } });
    };
    drawPouncer(lg, T, P.guardL, cl, c);
    drawPouncer(lg, T, P.scribe, cl, c);
    drawPouncer(lg, T, P.herald, cl, c);
    drawPouncer(lg, T, P.guardR, cl, c);
    kingDraw();
    const hs = heroState(T);
    if (inCloud) {
      // 勇者也在团里翻滚
      const a = T * 7.5 + 2.4;
      lg.save(); lg.translate(cl.x + Math.cos(a) * cl.r * 0.35, cl.y + Math.sin(a) * cl.r * 0.25); lg.rotate(-a);
      drawHero(lg, { x: 0, y: 120, s: 1, face: 1, t: T, pose: 'kick', expr: 'shout', sword: 'back', scarf: { len: 420, vel: [Math.cos(a) * 900, Math.sin(a) * 900], ground: 1e5 } });
      lg.restore();
      drawCloud(lg, T, cl);
      // 王冠从烟团顶上蹦出来
      const ck = (T - CLOUD0) % 0.33 / 0.33;
      drawCrown(lg, { x: cl.x - 10 + Math.sin(T * 6) * 30, y: cl.y - cl.r * 0.9 - 90 * Math.sin(Math.PI * ck), rot: T * 9, s: 1, t: T, F: 1, squash: 0.4 });
    }
    lg.restore();
    // 纸卷在勇者后 / 前
    if (roll && !roll.front) drawRoll(lg, T, roll);
    lg.save(); applyCam(lg, c, 1);
    if (!inCloud) A.hero = hs.seam ? drawHero(lg, cp('hero', T, c)) : drawHeroAt(lg, T, hs);
    lg.restore();
    if (roll && roll.front) drawRoll(lg, T, roll);
    // 烟团成形 / 散开的纸尘
    lg.save(); applyCam(lg, c, 1);
    burst(lg, T, { at: CLOUD0, seed: 61, count: 26, x: KING_AT[0], y: 690, spread: 60, speed: [200, 520], angle: [0, TAU], gravity: -60, drag: 2.4, life: [0.5, 0.9], size: [26, 46] }, dustDraw);
    const c0 = cloudAt(TT.ropeSnap);
    burst(lg, T, { at: TT.ropeSnap, seed: 62, count: 34, x: c0.x, y: c0.y, spread: 80, speed: [260, 700], angle: [0, TAU], gravity: 120, drag: 2.2, life: [0.5, 1.0], size: [30, 56] }, dustDraw);
    burst(lg, T, { at: TT.ropeSnap, seed: 63, count: 16, x: 1880, y: 330, spread: 20, speed: [300, 800], angle: [Math.PI * 0.6, Math.PI * 1.3], gravity: 900, drag: 1.2, life: [0.4, 0.8], size: [8, 14] }, sparkDraw);
    for (const [i, b] of TT.bounce.entries()) {
      const s = STEPS[i];
      burst(lg, T, { at: b, seed: 70 + i, count: 10, x: s[0], y: s[1], spread: 160, speed: [80, 260], angle: [-Math.PI * 0.95, -Math.PI * 0.05], gravity: 200, drag: 2.6, life: [0.35, 0.6], size: [16, 30] }, dustDraw);
    }
    lg.restore();
  });
  // 彩纸（合同：main 之后单独一层，画到它们落完）
  const conf = cp('confetti', T, c);
  if (T < Math.max(...conf.bursts.map((b) => b.at + (b.life?.[1] ?? 2)))) {
    ctx.layer(g, lo('confetti', T, c), (lg) => { lg.save(); applyCam(lg, c, ITEM.confetti.depth ?? 1); drawSeamConfetti(lg, conf); lg.restore(); });
  }
  drawThroneRoom(g, T, c, { ...env, layer: 'glow' });
  ctx.layer(g, lo('fg', T, c), (lg) => drawThroneRoom(lg, T, c, { ...env, layer: 'fg' }));
  // 界面：头顶全名名签 → 国王「达…」→「别！」
  if (T < TT.pounce + 0.7) {
    ctx.layer(g, lo('ui', T, c), (lg) => {
      const pop = 1 - seg(T, TT.pounce - 0.12, TT.pounce - 0.02);
      if (pop > 0) {
        const at = resolveParams(ITEM.headTag.at, T, { c, A: {} });
        const [sx, sy] = toScreen(c, ITEM.headTag.depth ?? 1, at[0], at[1]);
        const q = cp('headTag', T, c);
        nameTagSmall(lg, { ...q, x: sx + (q.dx || 0), y: sy + (q.dy || 0), pop: pop * (q.pop ?? 1) });
      }
      if (A.king && T >= TT.kingTalk - 0.02 && T < TT.pounce + 0.1) {
        const [mx, my] = toScreen(c, 1, A.king.mouth[0], A.king.mouth[1]);
        bubble(lg, { x: mx - 170, y: my - 150, w: 200, h: 120, text: '达…', tail: [mx - 18, my - 6], pop: seg(T, TT.kingTalk - 0.02, TT.kingTalk + 0.16), mirror: false, t: T });
      }
      if (T >= TT.pounce) {
        const [bx, by] = toScreen(c, 1, KING_AT[0] - 220, 420);
        bubble(lg, { x: bx, y: by, w: 230, h: 140, text: '别！', shape: 'jagged', tail: toScreen(c, 1, KING_AT[0] - 80, 560), pop: seg(T, TT.pounce, TT.pounce + 0.14), t: T });
      }
    });
  }
  // 后期：合同 sat 1.05；冲击帧
  const fx = resolveParams(SEAM.fx || {}, T, { c, A: {} });
  for (const k in fx) if (fx[k] !== undefined) ctx.fx[k] = fx[k];
  impact(ctx, T, CLOUD0, 'S', { shake: 8, flash: 0.15 });
  impact(ctx, T, TT.ropeSnap, 'M', { shake: 12, flash: 0.25 });
  TT.bounce.forEach((b, i) => impact(ctx, T, b, 'S', { shake: 6 + i * 2, flash: 0 }));
  return { c, roll };
}
void glow; void snap; void rgba; void noise1;
