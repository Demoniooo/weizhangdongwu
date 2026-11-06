// b05 · 整块共用的一帧：王座厅分层 + 全体角色 + 名字道具 + 界面 + 冲击。
// 图层栈按接缝合同：back / mid（+朝臣）/ main（布景 + 人物）/ confetti（出场合同的彩纸层）/ glow / fg / ui；
// 反应格（CU-K / CU-H）里在 mid 与 main 之间多一层虚化背景。每帧缓冲 ≤ 7。
// 两处接缝附近的一切参数从 SEAMS 合同读（./seam.js），不硬编码。
import { PAL } from '../../core/paper.js';
import { applyCam, toScreen } from '../../core/camera.js';
import { ez, outBack, outCubic, inQuad, inOutSine } from '../../core/ease.js';
import { clamp, lerp, seg, hit, noise1, hash2, rgba, mixHex } from '../../core/util.js';
import { burst } from '../../core/particles.js';
import { drawThroneRoom, THRONE, CAMS, throneLayer } from '../../env/throne.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawKing } from '../../rigs/king.js';
import { drawCitizen, drawGuard, drawScribe, drawHerald } from '../../rigs/folk.js';
import { confettiDraw, dustDraw, drawShockRing, drawSpeechWave } from '../../props/misc.js';
import { nameTagSmall, nameTile, glyphIcon } from '../../ui/kit.js';
import { paperGlyph, NAME_TIMES } from '../../ui/type.js';
import { impact, speedLines } from '../../fx/transitions.js';
import { applyParallax, drawSeamConfetti, decreeSweep, throneConfettiFloor } from '../_seams.js';
import {
  C, camAt, camSpeedX, cuAmount, hallBounce, beatAt, heroParams, kingAll, SETTLE,
  PRINT_AT, GROUP_X, SLAM_X, DECREE_Y, decreeUnroll, decreeHung,
} from './plan.js';
import {
  HERO, drawN1, drawLensWeng, drawCrownWeng, drawN2, drawBalloons, drawPuffs, drawSealRows, drawSealSparks,
  drawKingBubble, drawHeroBubble, TN3, BAL, PANEL_EVENTS as PK,
} from './names.js';
import { S_IN, S_OUT, IN, OUT, seamParams, seamEnv, seamLayer, seamOrder, seamAt } from './seam.js';

const LIGHT = 'sunny';
const TN2 = ['N2a', 'N2b', 'N2c'].flatMap(NAME_TIMES);
const ORDER_IN = seamOrder(S_IN);     // 入场合同的人物画序
const ORDER_OUT = seamOrder(S_OUT);   // 出场合同的人物画序
const ORDER_SWITCH = C.H1;            // 勇者格期间（其余人都在画外）换画序

// ———————————————————— 布景参数 ————————————————————
/** 出场前圣旨已吊好（hung 1）之后直接用出场合同的布景参数（decree 换回合同的 mid 层：hung 1 时两层位置完全相同）。 */
function envAt(T, c) {
  if (T >= C.I1 - 0.09) return { ...seamEnv(S_OUT, T, c) };
  const o = T <= C.N1a ? { ...seamEnv(S_IN, T, c) } : { light: LIGHT, windowL: 'day', windowR: 'day', lectern: true };
  o.confettiFloor = throneConfettiFloor(T);
  if (T >= C.N4a) o.decree = { layer: 'main', unroll: decreeUnroll(T), prints: PRINT_AT, hung: decreeHung(T), sweep: decreeSweep(T) };
  return o;
}
/** 图层参数：入场 / 出场合同给的那一份（两份对王座厅是同一组 throneLayer）。 */
const LAYER = (id) => seamLayer(T_LAYER_SRC, id, 0, null) || throneLayer(id, LIGHT);
const T_LAYER_SRC = S_IN;
const UI_LAYER = seamLayer(S_IN, 'ui', 0, null) || { shadow: 10, texture: 0.3 };
const CONFETTI_LAYER = seamLayer(S_OUT, 'confetti', 0, null) || { shadow: 3, texture: 0.12 };

// ———————————————————— 出场前的“归位”：从 N4 的站位蹦回合同站位 ————————————————————
const HOME0 = C.I1 - 0.94, HOME1 = SETTLE - 0.06;    // 55.95–56.53
/** 从 a 蹦两下到 b（世界坐标），返回 [x, y]。 */
function hopHome(T, a, b) {
  const u = seg(T, HOME0, HOME1);
  const e = inOutSine(u);
  const arc = Math.abs(Math.sin(Math.PI * 2 * u)) * 38;
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e) - arc];
}
const outXY = (id) => [OUT[id].params.x, OUT[id].params.y];

// ———————————————————— 配角 ————————————————————
const SB = [
  { t: C.N1a, pose: 'idle', expr: 'focused' },
  { t: C.N1a + 0.05, pose: 'write', blend: 0.2, expr: 'focused' },
  { t: C.N1c + 0.6, pose: 'quillSnap', blend: 0.05, expr: 'shock' },
  { t: C.N2a, pose: 'idle', blend: 0.3, expr: 'curious' },
  { t: C.N2c + 1.27, pose: 'stepBack', blend: 0.1, expr: 'shock' },
  { t: C.N3a + 0.3, pose: 'write', blend: 0.3, expr: 'focused' },
  { t: C.N3c + 1.13, pose: 'crossOut', blend: 0.05, expr: 'determined' },
];
/** 圣旨右端（世界 x），与 env 的 decreeOpts 同一公式：左端 1140 − 435，长 870。 */
const decreeEndX = (T) => THRONE.decree.from.cx - THRONE.decree.from.len / 2 + THRONE.decree.from.len * decreeUnroll(T);
function scribeParams(T) {
  if (T <= C.N1a) return seamParams(IN, 'scribe', T);
  if (T >= SETTLE) return seamParams(OUT, 'scribe', T);
  if (T >= C.N4a) {
    // 倒退着展开圣旨：手里卷筒对准圣旨右端（backAway 的 roll 锚点在脚底左上 (−18,−78)）；展开完退到一边，55.95 起蹦回讲台
    const ex = decreeEndX(T) + 18 + 70 * ez(T, C.N4c - 0.3, C.N4c - 0.05, outCubic);
    if (T < HOME0) return { x: ex, y: 808, s: 1, face: -1, t: T, pose: 'backAway', expr: T > C.N4c ? 'happy' : 'proud', cycle: (decreeEndX(T) - 705) / 110 };
    const [x, y] = hopHome(T, [decreeEndX(HOME0) + 88, 808], outXY('scribe'));
    return { x, y, s: 1, face: -1, t: T, pose: 'idle', expr: 'happy' };
  }
  const { pose, e } = beatAt(SB, T);
  const p0 = IN.scribe.params;
  const o = { x: p0.x, y: p0.y, s: 1, face: -1, t: T, pose, expr: e.expr };
  const lean0 = (p0.joints && p0.joints.lean) || 0;
  if (T < C.N1a + 0.25) o.joints = { lean: lean0 * (1 - ez(T, C.N1a + 0.05, C.N1a + 0.25)) };
  if (T >= C.N1c + 0.6 && T < C.N2a) o.p = seg(T, C.N1c + 0.6, C.N1c + 1.0);
  if (T >= C.N3c + 1.13) o.p = seg(T, C.N3c + 1.13, C.H1 - 0.06);
  return o;
}
const HERALD_N4 = [360, 880];
function heraldParams(T) {
  if (T <= C.N1a) return seamParams(IN, 'herald', T);
  if (T >= SETTLE) return seamParams(OUT, 'herald', T);
  if (T >= C.H1 + 0.1) {
    const blowing = T >= C.N4c + 0.04;
    const [x, y] = T < HOME0 ? HERALD_N4 : hopHome(T, HERALD_N4, outXY('herald'));
    return { x, y, s: 1, face: 1, t: T, pose: blowing ? 'blow' : 'idle', expr: blowing ? 'puff' : 'happy' };
  }
  const p0 = IN.herald.params;
  const o = { x: p0.x, y: p0.y, s: 1, face: -1, t: T, pose: 'idle', joints: { ...(p0.joints || {}) } };
  if (T >= C.N1c + 0.05 && T < C.N2a) { o.pose = 'jawDrop'; o.joints = { lean: -4 }; }
  if (T >= C.N2c + 1.27 && T < C.N3a + 0.4) { o.pose = 'jawDrop'; o.joints = { lean: -6 }; }
  if (T >= C.N3c + 0.4) { o.pose = 'jawDrop'; o.joints = { lean: -2 }; }
  return o;
}
const GUARD_L_N4 = [1735, 790];
function guardLParams(T) {
  if (T <= C.N1a) return seamParams(IN, 'guardL', T);
  if (T >= SETTLE) return seamParams(OUT, 'guardL', T);
  if (T >= C.H1 + 0.1) {
    const cheer = T >= C.N4c + 0.04;
    const [x, y] = T < HOME0 ? GUARD_L_N4 : hopHome(T, GUARD_L_N4, outXY('guardL'));
    return { x, y, s: 1, face: -1, t: T, pose: cheer ? 'cheer' : 'attention', hat: false, variant: 0 };
  }
  const o = { ...seamParams(IN, 'guardL', T) };
  if (T >= C.N2c + 1.27 && T < C.N3a + 0.3) o.pose = 'stepBack';
  return o;
}
function guardRParams(T) {
  if (T >= SETTLE && OUT.guardR) return seamParams(OUT, 'guardR', T);
  const p = OUT.guardR ? OUT.guardR.params : { x: 1880, y: 790, variant: 2 };
  return { x: p.x, y: p.y, s: 1, face: -1, t: T, pose: T >= C.N4c + 0.08 ? 'cheer' : 'attention', hat: false, variant: p.variant ?? 2 };
}
/** 朝臣：入场合同（lean）→ 各 cue 反应 → 出场合同（cheer）。 */
function courtierList(T) {
  if (T <= C.N1a) return seamParams(IN, 'courtiers', T).members;
  if (T >= SETTLE) return seamParams(OUT, 'courtiers', T).members;
  return IN.courtiers.params.members.map((m) => {
    const o = { ...m };
    if (T >= C.N1c + 0.1 && T < C.N2a) o.pose = 'stepBack';
    else if (T >= C.N2c + 1.27 && T < C.N3a + 0.4) o.pose = 'stepBack';
    else if (T >= C.N3a + 0.4 && T < C.H1) o.pose = 'idle';
    else if (T >= C.H1 && T < C.N4c) o.pose = 'clap';
    else if (T >= C.N4c) o.pose = 'cheer';
    return o;
  });
}

// ———————————————————— 小工具 ————————————————————
function inView(c, depth, x, y, pad) {
  const [sx, sy] = toScreen(c, depth, x, y);
  return sx > -pad && sx < 1920 + pad && sy > -pad && sy < 1080 + pad;
}

// ———————————————————— 一帧 ————————————————————
export function drawFrame(g, T, ctx) {
  const c = camAt(T);
  const env = envAt(T, c);
  ctx.fx.sat = Math.max(ctx.fx.sat || 0, 1.05);
  const cu = cuAmount(T);
  const R = {};
  const hits = impactsAt(T, ctx);

  // —— back / mid（反应格里背景虚化）
  const lb = LAYER('back'), lm = LAYER('mid');
  ctx.layer(g, cu > 0.05 ? { ...lb, blur: 3.2 * cu } : lb, (lg) => drawThroneRoom(lg, T, c, { ...env, layer: 'back' }));
  ctx.layer(g, cu > 0.05 ? { ...lm, blur: 2.4 * cu } : lm, (lg) => {
    drawThroneRoom(lg, T, c, { ...env, layer: 'mid' });
    lg.save(); applyCam(lg, c, IN.courtiers ? IN.courtiers.depth ?? 0.9 : 0.9);
    for (const m of courtierList(T)) if (inView(c, 0.9, m.x, m.y - 90, 260)) drawCitizen(lg, { t: T, s: 1, ...m });
    lg.restore();
  });

  // —— 反应格的虚化背景（碎片 / 字母牌 / 远处吊着的国王）
  drawCuBackground(g, T, ctx, c);

  // —— main：布景 + 人物 + 圣旨 + 气球
  ctx.layer(g, LAYER('main'), (lg) => {
    const r = drawThroneRoom(lg, T, c, { ...env, layer: 'main' });
    R.decree = r.decree;
    if (r.decree) R.decreeZoom = 1 + (c.zoom - 1) * lerp(1, 0.8, decreeHung(T));
    lg.save(); applyCam(lg, c, 1);
    drawActors(lg, T, c, R);
    lg.restore();
  });

  // —— 彩纸层（出场合同：礼炮 CONFETTI_N4C；另加 53.95 气球被戳破的彩纸）
  if (T >= C.N4a - 0.06) {
    ctx.layer(g, CONFETTI_LAYER, (lg) => {
      lg.save(); applyCam(lg, c, 1);
      if (OUT.confetti) drawSeamConfetti(lg, seamParams(OUT, 'confetti', T, c));
      burst(lg, T, { at: C.N4a - 0.05, seed: 51, count: 70, x: SLAM_X[0] + 40, y: 330, spread: 260, speed: [80, 420], angle: [-3.1, -0.05], gravity: 520, drag: 1.8, life: [1.6, 2.3], spin: [-9, 9], size: [9, 15] }, confettiDraw);
      lg.restore();
    });
  }

  // —— glow / fg
  drawThroneRoom(g, T, c, { ...env, layer: 'glow' });
  ctx.layer(g, LAYER('fg'), (lg) => drawThroneRoom(lg, T, c, { ...env, layer: 'fg' }));

  // —— 金印放射线（在印章字之下）
  drawRays(g, T, c, hits);

  // —— ui（屏幕空间）
  ctx.layer(g, UI_LAYER, (lg) => {
    drawHeadTag(lg, T, c, R);
    drawN1(lg, T);
    drawN2(lg, T, c);
    if (R.kingMouthS) drawKingBubble(lg, T, R.kingMouthS);
    if (R.heroMouthS) drawHeroBubble(lg, T, R.heroMouthS);
    if (R.decree) { drawSealRows(lg, T, R.decree.chars, R.decreeZoom); drawSealSparks(lg, T, R.decree.chars); }
    drawLensWeng(lg, T);
  });

  drawOverlay(g, T);
}

// ———————————————————— 角色 ————————————————————
function drawActors(lg, T, c, R) {
  const order = T < ORDER_SWITCH ? ORDER_IN : ORDER_OUT;
  const list = order.length ? order : ['guardL', 'herald', 'scribe', 'king', 'hero'];
  if (!list.includes('guardR')) drawOne(lg, T, c, R, 'guardR');
  for (const id of list) drawOne(lg, T, c, R, id);
  // 气球字（N3）：线从嘴 → 王冠尖；N3c 起随国王升起
  const ka = R.king;
  if (ka && T >= TN3[0] && T < C.N4a - 0.05) {
    const [kx, ky] = R.kingXY;
    const mouth = [ka.mouth[0] - 6, ka.mouth[1]];
    drawPuffs(lg, T, mouth);
    if (inView(c, 1, 1100, 420, 900)) drawBalloons(lg, T, mouth, ka.crownTop, [kx - 1500, ky - 790]);
  }
}
function drawOne(lg, T, c, R, id) {
  if (id === 'guardL' || id === 'guardR') {
    const p = id === 'guardL' ? guardLParams(T) : guardRParams(T);
    if (inView(c, 1, p.x, p.y - 100, 300)) drawGuard(lg, p);
  } else if (id === 'herald') {
    const p = heraldParams(T);
    if (!inView(c, 1, p.x, p.y - 100, 300)) return;
    const a = drawHerald(lg, p);
    if (p.pose === 'blow' && a && a.bell && T < SETTLE) drawSpeechWave(lg, { x: a.bell[0], y: a.bell[1], dir: a.bellDir, t: T, n: 3, r0: 26, gap: 30, thick: 8, alpha: ez(T, C.N4c + 0.04, C.N4c + 0.15) * (1 - ez(T, C.I1 - 0.55, SETTLE)) });
  } else if (id === 'scribe') {
    const p = scribeParams(T);
    if (!inView(c, 1, p.x, p.y - 100, 300)) return;
    drawScribe(lg, p);
    drawCrossInk(lg, T, p);
  } else if (id === 'king') {
    const ko = kingAll(T);
    R.kingXY = [ko.x, ko.y];
    // 站在“地上的圣旨”上：脚下一块接触影
    if (T >= C.N4a && T < SETTLE) contactShadow(lg, ko.x, ko.y, 70, 0.26 * (1 - ez(T, C.I1 - 0.7, SETTLE)));
    const ka = drawKing(lg, ko);
    R.king = ka;
    if (ka && ka.mouth) R.kingMouthS = toScreen(c, 1, ka.mouth[0] - 10, ka.mouth[1] + 4);
    drawCrownWeng(lg, T, ka);
    // 印面落点：金色冲击环 + 一圈灰
    for (let i = 0; i < 3; i++) {
      const at = PRINT_AT[i];
      const u = (T - at) / 0.45;
      if (u < 0 || u >= 1) continue;
      drawShockRing(lg, { x: GROUP_X[i], y: 796, r: 60 + 240 * outCubic(u), squash: 0.3, alpha: 1 - u, color: PAL.goldLight, seed: 4 + i });
      burst(lg, T, { at, seed: 30 + i, count: 18, x: GROUP_X[i], y: 795, spread: 90, speed: [120, 380], angle: [-3.0, -0.15], gravity: 260, drag: 1.4, life: [0.35, 0.7], size: [12, 22] }, dustDraw);
    }
  } else if (id === 'hero') {
    const ha = drawHero(lg, heroParams(T));
    R.hero = ha;
    if (ha && ha.mouth) R.heroMouthS = toScreen(c, 1, ha.mouth[0] + 8, ha.mouth[1]);
  }
}
/** 书记官划叉的墨迹（52.90）：按笔尖锚点回溯采样；画完弹一个红叉。 */
function drawCrossInk(lg, T, sp) {
  const t0 = C.N3c + 1.13;
  if (T < t0 || T >= C.H1 + 0.1 || sp.pose !== 'crossOut') return;
  const p = sp.p ?? 0;
  const pts = [];
  for (let k = 0; k <= 20; k++) {
    const pk = (k / 20) * p;
    if (pk > 0.45 && pk < 0.55) { pts.push(null); continue; }
    pts.push(drawScribe(lg, { ...sp, p: pk, alpha: 0 }).quill);
  }
  lg.save(); lg.strokeStyle = PAL.ink; lg.lineWidth = 4; lg.lineCap = 'round'; lg.lineJoin = 'round';
  lg.beginPath(); let pen = false;
  for (const q of pts) { if (!q) { pen = false; continue; } if (pen) lg.lineTo(q[0], q[1]); else lg.moveTo(q[0], q[1]); pen = true; }
  lg.stroke(); lg.restore();
  const u = seg(T, t0 + 0.2, t0 + 0.32);
  if (u > 0) glyphIcon(lg, 'cross', sp.x - 52, sp.y - 150, 70 * outBack(u, 2.2), { alpha: Math.min(1, u * 3) });
}
function contactShadow(lg, x, y, rx, a) {
  if (a <= 0) return;
  lg.save(); lg.globalAlpha = a; lg.fillStyle = PAL.shadow;
  lg.beginPath(); lg.ellipse(x - 30, y + 2, rx, rx * 0.16, 0, 0, Math.PI * 2); lg.fill(); lg.restore();
}

// ———————————————————— 头顶名签（入场 / 出场合同的锚点之间，跟着勇者的头走） ————————————————————
function drawHeadTag(lg, T, c, R) {
  if (!R.hero) return;
  const aIn = seamAt(IN, 'headTag', T, c), aOut = seamAt(OUT, 'headTag', T, c);
  const hIn = heroHeadAt(C.N1a), hd = R.hero.head;
  // 接缝 0.3s 内用合同的固定锚点；中间跟着头（相对入场时头心的位移）
  const wIn = ez(T, C.N1a, C.N1a + 0.3, inOutSine) * (1 - ez(T, C.I1 - 0.7, SETTLE, inOutSine));
  const follow = [aIn[0] + (hd[0] - hIn[0]), aIn[1] + (hd[1] - hIn[1])];
  const fixed = T < C.N2a ? aIn : aOut;
  const w = [lerp(fixed[0], follow[0], wIn), lerp(fixed[1], follow[1], wIn)];
  const [sx, sy0] = toScreen(c, 1, w[0], w[1]);
  const sy = Math.max(sy0, lerp(sy0, 112, cuAmount(T)));   // 反应格里名签不出安全区
  if (sx < -300 || sx > 2220 || sy < -100 || sy > 1180) return;
  if (T >= SETTLE) { nameTagSmall(lg, { ...seamParams(OUT, 'headTag', T, c), x: sx, y: sy }); return; }
  const p0 = seamParams(IN, 'headTag', T, c);
  const flip = seg(T, C.I1 - 0.59, C.I1 - 0.44);
  const o = { ...p0, x: sx, y: sy };
  if (flip > 0) {
    const pOut = seamParams(OUT, 'headTag', T, c);
    Object.assign(o, pOut, { x: sx, y: sy, textFrom: p0.text, flip, spill: seg(T, C.I1 - 0.44, SETTLE - 0.02) });
  }
  nameTagSmall(lg, o);
}
/** 入场接缝时勇者的头心（按入场合同的勇者参数求锚点；模块常量）。 */
const HEAD_IN = heroRig(seamParams(IN, 'hero', C.N1a)).head;
const heroHeadAt = () => HEAD_IN;

// ———————————————————— 反应格的虚化背景 ————————————————————
function drawCuBackground(g, T, ctx, c) {
  const k1 = T >= C.K1 && T < C.N2a;
  const k2 = T >= C.K2 - 0.02 && T < C.N3a + 0.6;
  const h1 = T >= C.H1 - 0.04 && T < C.N4a;
  if (!k1 && !k2 && !h1) return;
  ctx.layer(g, { blur: 5, shadow: 6, texture: 0.2 }, (lg) => {
    if (k1) {
      // K1：撕碎的对话框纸片在国王身后飘落（按国王格屏幕坐标设计，随拉回机位视差移动）
      const a = ez(T, C.K1, C.K1 + 0.15) * (1 - ez(T, C.K1 + 0.5, C.K1 + 0.8));
      lg.save(); applyParallax(lg, c, CAMS.CU_K, 0.7); lg.globalAlpha *= a;
      for (let i = 0; i < 7; i++) {
        const x = 120 + hash2(i, 1) * 900, y0 = -80 + hash2(i, 2) * 520, v = 140 + hash2(i, 3) * 120;
        const y = y0 + (T - C.K1) * v, rot = hash2(i, 4) * 6 + (T - C.K1) * (hash2(i, 5) - 0.5) * 5;
        const w = 70 + hash2(i, 6) * 80, h = 34 + hash2(i, 7) * 40;
        lg.save(); lg.translate(x + Math.sin(T * 2 + i) * 30, y); lg.rotate(rot);
        lg.fillStyle = mixHex(PAL.paper, PAL.paper2, hash2(i, 8)); lg.fillRect(-w / 2, -h / 2, w, h);
        lg.strokeStyle = PAL.inkSoft; lg.lineWidth = 4; lg.strokeRect(-w / 2, -h / 2, w, h);
        lg.restore();
      }
      lg.restore();
    }
    if (k2) {
      // K2：崩飞的字母牌在国王身后慢慢飘落（只在画面左半，不挡脸）
      const a = ez(T, C.K2 - 0.02, C.K2 + 0.1) * (1 - ez(T, C.N3a + 0.1, C.N3a + 0.5));
      lg.save(); applyParallax(lg, c, CAMS.CU_K, 0.6); lg.globalAlpha *= a * 0.85;
      for (let i = 0; i < 5; i++) {
        const x = 150 + i * 170 + hash2(i, 9) * 60, y0 = -40 + hash2(i, 10) * 380;
        const y = y0 + (T - C.K2 + 0.3) * (80 + hash2(i, 11) * 70);
        nameTile(lg, HERO[(i * 5 + 2) % 13], x + Math.sin(T * 1.7 + i) * 20, y, 80, { rot: hash2(i, 12) * 6 + (T - C.K2) * (hash2(i, 13) - 0.5) * 3 });
      }
      lg.restore();
    }
    if (h1) {
      // H1：右上角挂在气球下的国王（远景 depth 0.6，按勇者格屏幕坐标设计）
      const a = ez(T, C.H1 - 0.04, C.H1 + 0.07) * (1 - ez(T, C.N4a - 0.1, C.N4a - 0.02));
      lg.save(); applyParallax(lg, c, CAMS.CU_H, 0.6); lg.globalAlpha *= a;
      const kx = 1590, ky = 560 + Math.sin(T * 2.2) * 10;
      lg.translate(kx, ky); lg.scale(1.2, 1.2);
      for (let i = 0; i < 13; i++) {
        const B = BAL[i];
        const bx = (B.x - 1100) * 0.42 + noise1(T + i, 3) * 6, by = -330 + (B.y - 420) * 0.45 + noise1(T * 1.2 + i, 4) * 5;
        lg.strokeStyle = rgba(PAL.inkSoft, 0.8); lg.lineWidth = 1.6;
        lg.beginPath(); lg.moveTo(0, -192); lg.lineTo(bx, by + 18); lg.stroke();
        paperGlyph(lg, HERO[i], bx, by, 46, { style: 'balloon', fill: B.fill, scale: B.s, rot: B.rot, flipY: B.flipY, mirror: B.mirror });
      }
      drawKing(lg, { x: 0, y: 0, s: 0.92, face: -1, t: T, pose: 'dangle', expr: 'sick', crown: { squash: 1, pop: 5 }, green: 1 });
      lg.restore();
    }
  });
}

// ———————————————————— 冲击（每个衰减到看不见再停，不留跳变） ————————————————————
function impactsAt(T, ctx) {
  const out = [];
  const add = (at, level, o, win = 0.9) => { if (T >= at && T < at + win) { impact(ctx, T, at, level, o); out.push([at, level, o]); } };
  add(C.N1c, 'S', { shake: 10, flash: 0.15, rays: false, decay: 0.16 }, 0.8);
  for (const t of TN2.slice(0, 8)) add(t + 0.14, 'S', { shake: 3, flash: 0, rays: false, decay: 0.1, seed: 21 }, 0.5);
  add(C.K1 - 0.1, 'L', { shake: 20, flash: 0.3, rays: false, seed: 5, decay: 0.2 });
  add(PK.left, 'M', { shake: 12, flash: 0, rays: false, seed: 7, decay: 0.18 });
  add(PK.pop, 'S', { shake: 10, flash: 0.2, rays: false, seed: 8, decay: 0.16 }, 0.8);
  add(C.N4a, 'L', { shake: 24, flash: 0.7, seed: 11, decay: 0.24, reach: 760 }, 0.68);
  add(C.N4b, 'L', { shake: 22, flash: 0.6, seed: 12, decay: 0.24, reach: 820 }, 1.0);
  add(C.N4c, 'L', { shake: 26, flash: 0.8, seed: 13, decay: 0.24, reach: 900 }, 1.12);
  return out;
}

// ———————————————————— 最上层：速度线、印影、放射线 ————————————————————
function drawOverlay(g, T) {
  const v = camSpeedX(T);
  const sl = clamp((Math.abs(v) - 1500) / 5000);
  if (sl > 0.01) speedLines(g, 'h', null, { t: T, sign: v > 0 ? -1 : 1, alpha: 0.85 * sl, density: 2.6, colors: [PAL.white, PAL.paper, PAL.goldLight], shadow: 0.4, seed: v > 0 ? 3 : 9 });
  // N4a 前的印影：深色圆角方形压上勇者特写并扩大（multiply）
  if (T >= C.N4a - 0.1 && T < C.N4a) {
    const u = seg(T, C.N4a - 0.1, C.N4a);
    const s = lerp(260, 2600, inQuad(u));
    g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.25 + 0.6 * u;
    g.fillStyle = mixHex(PAL.shadow, PAL.goldDark, 0.25);
    g.beginPath(); g.roundRect(960 - s / 2 + 120 * (1 - u), 470 - s * 0.42, s, s * 0.84, s * 0.12); g.fill();
    g.restore();
  }
}
/** 金印放射线（屏幕坐标：印面落点），画在 ui 层之下，不压印章字。 */
function drawRays(g, T, c, hits) {
  for (const [at, level, o] of hits) {
    const i = PRINT_AT.indexOf(at);
    if (i < 0 || T > at + 0.45) continue;
    const [sx, sy] = toScreen(c, 1, GROUP_X[i], 760);
    impact(null, T, at, level, { ...o, g, x: sx, y: sy, apply: false, color: PAL.goldLight, alpha: 0.8 });
  }
}

void hit; void DECREE_Y; void S_OUT; void seamEnv;
