// b13 私有：救出段（E01 161.13 – 165.35）。穿过台口回到真正的龙洞（多层视差），黎明光冲进来；
// 公主早已推开笼门、勇者砍空；E02 公主全名花瓣在轨道最前方按阅读顺序诞生，最后收成头顶花环；小蜥蜴爬上勇者肩头。
import { PAL, glow, sparkle, rays } from '../../core/paper.js';
import { cam, applyCam, lerpCam, toScreen } from '../../core/camera.js';
import { clamp, lerp, seg, hit, wobble, TAU, rgba } from '../../core/util.js';
import { ez, outBack, outCubic, glide, inOutCubic, outExpo, inCubic } from '../../core/ease.js';
import { burst, field } from '../../core/particles.js';
import { drawCave, CAVE, groundAt, fromScreen } from '../../env/cave.js';
import { drawCage } from '../../props/cave.js';
import { drawHero, HERO_STRIDE } from '../../rigs/hero.js';
import { drawPrincess } from '../../rigs/princess.js';
import { drawLizard } from '../../rigs/dragon.js';
import { petalOrbit, drawPetal, sparkDraw, dustDraw } from '../../props/misc.js';
import { NAME_TIMES } from '../../ui/type.js';
import { E01, E02, E03, END, DEG, withDrift } from './common.js';
import { drawStage, SCARF } from './theater.js';

const CG = CAVE.cage.landed;                       // 落地鸟笼笼心 (1320, 778.7)
const CAGE_FLOOR = CG[1] + 98;                     // 笼底上表面（公主脚底）
const P_STOP = 1205;                               // 公主走出笼门后站定的 x
const H_STOP = 885;                                // 勇者退回站定的 x
const BIRTH = NAME_TIMES('E02');

// ———————————————————— 机位 ————————————————————
// storyboard 给的 cam(1300,420,1.5) 看不到地面与落地鸟笼（integration_notes）：按屏幕落点下移到 y≈640。
const CAM_IN = cam(1180, 640, 1.16, -3 * DEG);
const CAM_E01 = cam(1170, 662, 1.5, -2 * DEG);
const CAM_OUT = cam(1135, 622, 1.8, 1 * DEG);
export function rescueCam(T) {
  if (T < E01 + 0.5) return lerpCam(CAM_IN, CAM_E01, outCubic(seg(T, E01, E01 + 0.5)));
  return lerpCam(CAM_E01, CAM_OUT, glide(seg(T, E02 + 0.05, E03 - 0.08)));
}

// ———————————————————— 角色 ————————————————————
function princessState(T) {
  const kWalk = ez(T, E01 + 0.16, E01 + 0.78, inOutCubic);
  const x = lerp(CG[0] - 6, P_STOP, kWalk);
  const out = seg(x, CG[0] - 70, CG[0] - 105);                 // 跨过门槛
  const y = lerp(CAGE_FLOOR, groundAt(x), out);
  const s = lerp(CAVE.cage.princessS, 1, outBack(seg(T, E01 + 0.3, E01 + 0.56), 2.2));
  const spin = ez(T, E02 + 0.35, E02 + 1.15, inOutCubic);     // 花瓣绕着她时转一圈
  const lookUp = ez(T, E02 + 2.5, E02 + 2.9, outCubic);
  let pose = 'stepOut', expr = 'smug';
  if (T >= E01 + 0.8) { pose = { from: 'stepOut', to: 'twirl', k: ez(T, E01 + 0.8, E02 + 0.35, outCubic) }; expr = 'smug'; }
  if (T >= E02 + 0.3) { pose = 'twirl'; expr = 'laugh'; }
  if (T >= E02 + 1.3) { pose = { from: 'twirl', to: 'idle', k: ez(T, E02 + 1.3, E02 + 1.8, glide) }; expr = T < E02 + 2.5 ? 'smile' : 'loving'; }
  const inCage = x > CG[0] - 88;
  return { inCage, o: { x, y, s, face: -1, t: T, pose, expr, turn: spin, tiara: false, hairpin: T < E02 + 0.4,
    joints: { head: -10 * lookUp }, braid: { vel: [-260 * (kWalk > 0 && kWalk < 1 ? 1 : 0), 0] } } };
}
function heroState(T) {
  // 161.13 已在半空扑向挂锁 → 161.20 挥剑 → 161.35 砍空踉跄 → 退回站定，望着公主
  const act = T < E01 + 0.07 ? lerp(0.12, 0.4, seg(T, E01, E01 + 0.07)) : T < E01 + 0.22 ? lerp(0.4, 0.55, seg(T, E01 + 0.07, E01 + 0.22)) : lerp(0.55, 1, outCubic(seg(T, E01 + 0.22, E01 + 0.62)));
  let x = T < E01 + 0.07 ? lerp(930, 1040, outCubic(seg(T, E01 - 0.05, E01 + 0.07))) : lerp(1040, 1088, outCubic(seg(T, E01 + 0.07, E01 + 0.62)));
  const back = ez(T, E01 + 0.72, E02 + 0.55, inOutCubic);
  x = lerp(x, H_STOP, back);
  const heart = ez(T, E02 + 1.35, E02 + 1.6, outBack);
  const o = { x, y: groundAt(x), s: 1, face: 1, t: T, sword: 'hand', scarf: { ...SCARF } };
  if (T < E01 + 0.72) return { ...o, pose: 'swingMiss', act, y: groundAt(x) - (T < E01 + 0.07 ? 46 * Math.sin(Math.PI * seg(T, E01 - 0.15, E01 + 0.09)) : 0) };
  if (back < 1) {
    return { ...o, pose: { from: 'swingMiss', to: 'walk', k: seg(T, E01 + 0.72, E01 + 0.85) }, act: 1, phase: x / (HERO_STRIDE * 0.8), expr: 'worried', scarf: { ...SCARF, vel: [-160, 0] } };
  }
  const shy = T >= E02 + 1.3;
  return { ...o, pose: shy ? { from: 'idle', to: 'holdHands', k: ez(T, E02 + 2.9, E02 + 3.3, glide) * 0.5 } : 'idle', sword: 'back',
    expr: shy ? 'shy' : 'grin', ahoge: { from: 'normal', to: 'heart', k: heart }, ahogeAt: E02 + 1.35, blush: heart,
    jointsAdd: { nod: -6 * ez(T, E02 + 2.5, E02 + 2.9, outCubic) } };
}
// 小蜥蜴：162.40 金币堆后探头（depth 0.8，被金币堆挡住下半身）→ 163.20 窜到勇者靴边 → 163.50–164.30 顺着爬上肩头，转身朝右坐好
const PEEK = [1585, 818];                          // 金币堆左坡上沿（depth 0.8 世界坐标）
function lizardPlan(T, c, heroA) {
  const tPeek = E02 + 0.75, tRun = E02 + 1.25, tBoot = E02 + 1.55, tClimb = E02 + 1.85, tSit = E02 + 2.65;
  if (T < tPeek - 0.2) return null;
  if (T < tRun + 0.12) {
    const up = outBack(seg(T, tPeek - 0.2, tPeek + 0.05), 2.2);
    return { layer: 'mid', o: { x: PEEK[0], y: PEEK[1] + 46 * (1 - up), s: 1.15, face: -1, t: T, pose: 'peek', miniPlate: { period: 3.6 },
      eyes: { state: 'normal', look: [-0.9, 0.1], pupil: 0.9 } } };
  }
  // 跳出金币堆：屏幕位置连续，深度 0.8 → 1 换算
  const ps = toScreen(c, 0.8, PEEK[0], PEEK[1]);
  const p0 = fromScreen(c, 1, ps[0], ps[1]);
  const boot = heroA ? [heroA.foot[0] + 48, groundAt(heroA.foot[0] + 48)] : [H_STOP + 48, 905];
  if (T < tBoot) {
    const k = seg(T, tRun + 0.12, tBoot);
    const x = lerp(p0[0], boot[0], inOutCubic(k));
    const y = lerp(p0[1], groundAt(x), Math.min(1, k * 2.4)) - 60 * Math.sin(Math.PI * Math.min(1, k * 2.4)) * (k < 0.42 ? 1 : 0);
    return { layer: 'main', o: { x, y, s: 1.15, face: -1, t: T, pose: 'scurry', miniPlate: { period: 3.6 } } };
  }
  const sh = heroA ? [heroA.neck[0] - 40, heroA.neck[1] + 12] : [H_STOP - 40, 766];
  if (T < tClimb) return { layer: 'main', o: { x: boot[0], y: boot[1], s: 1.15, face: -1, t: T, pose: 'sit', miniPlate: { period: 3.6 }, eyes: { state: 'normal', look: [-0.3, -0.8] }, squash: 0.15 * wobble(T, tBoot, 3, 0.2) } };
  if (T < tSit) {
    const k = seg(T, tClimb, tSit);
    const e = inOutCubic(k);
    const x = lerp(boot[0], sh[0] + 30, e) + 26 * Math.sin(Math.PI * k);
    const y = lerp(boot[1], sh[1], e);
    return { layer: 'main', o: { x, y, s: 1.15, face: -1, t: T, pose: 'climb', joints: { tilt: 0 }, miniPlate: { period: 3.6 } } };
  }
  const land = wobble(T, tSit, 3, 0.25);
  return { layer: 'main', o: { x: sh[0], y: sh[1], s: 1.15, face: 1, t: T, pose: 'ride', miniPlate: { period: 3.6 }, squash: -0.18 * land } };
}

// ———————————————————— 花瓣环 ————————————————————
function petals(T, P) {
  const cx = P.o.x, cy = P.o.y - 100 * P.o.s;
  const o = { cx, cy, rx: 245, ry: 80, crown: { t0: E02 + 2.4, t1: E02 + 2.95, cx, cy: P.o.y - 300, Rx: 215, Ry: 92, scale: 0.62 } };
  const items = petalOrbit(T, o);
  // 最后一字「红」164.77 才诞生：0.13s 内直接飞进花环最右一格（164.90 花环收齐）
  const last = items[10];
  if (last.visible) {
    const fin = petalOrbit(T + 9, o)[10];
    const born = BIRTH[10];
    const k = outBack(seg(T, born + 0.02, born + 0.15), 1.6);
    if (T >= born + 0.02) Object.assign(last, { x: lerp(last.x, fin.x, k), y: lerp(last.y, fin.y, k), s: lerp(last.s, fin.s, seg(T, born + 0.02, born + 0.15)), rot: lerp(last.rot, fin.rot, k), behind: false, depth: 1 });
  }
  return items;
}
function drawPetals(lg, T, items, part) {
  const list = items.filter((it) => it.visible && (part === 'back' ? it.behind : !it.behind)).sort((a, b) => a.depth - b.depth);
  for (const it of list) {
    drawPetal(lg, { x: it.x, y: it.y, s: it.s, rot: it.rot, ch: it.ch, size: 90 });
    // 诞生的一闪
    const b = hit(T, BIRTH[it.i], 0.16);
    if (b > 0.05 && part === 'front') sparkle(lg, it.x + 30 * it.s, it.y - 34 * it.s, 54 * b, { color: PAL.white, alpha: b });
  }
}

/** 救出镜头一帧。 */
export function drawRescue(g, T, ctx) {
  const c = withDrift(rescueCam(T), T);
  const light = { from: 'battle', to: 'dawn', k: seg(T, E01, E01 + 0.47) };
  const co = { light, dawnP: seg(T, E02 + 0.35, E02 + 1.55), rubble: { at: 120.97, cooled: 0.85 + 0.15 * seg(T, E01, E01 + 1.9) }, chain: false };
  const P = princessState(T);
  const items = T >= BIRTH[0] ? petals(T, P) : [];
  let heroA = null;
  const Hs = heroState(T);
  // 预估勇者锚点（给小蜥蜴定位用：靴边、肩头）
  const LZ0 = lizardPlan(T, c, { foot: [Hs.x + 6, Hs.y], neck: [Hs.x - 4, Hs.y - 150] });
  // —— 远景 + 中景（后壁 0.5、金币堆 0.8、水晶柱 0.85、黎明光束）；探头的小蜥蜴夹在后壁与金币堆之间 ——
  ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => {
    drawCave(lg, T, c, { ...co, layer: 'back' });
    if (LZ0 && LZ0.layer === 'mid') { lg.save(); applyCam(lg, c, 0.8); drawLizard(lg, LZ0.o); lg.restore(); }
    drawCave(lg, T, c, { ...co, layer: 'mid' });
  });
  // —— 身后半圈的花瓣（缩小、虚化） ——
  if (items.some((it) => it.visible && it.behind)) {
    ctx.layer(g, { blur: 3, shadow: 6, texture: 0.25 }, (lg) => { lg.save(); applyCam(lg, c, 1); drawPetals(lg, T, items, 'back'); lg.restore(); });
  }
  // —— 主体层：地面、鸟笼、公主、勇者、小蜥蜴、身前花瓣 ——
  ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
    drawCave(lg, T, c, { ...co, layer: 'main' });
    lg.save(); applyCam(lg, c, 1);
    const cg = { x: CG[0], y: CG[1], onFloor: true, door: ez(T, E01 - 0.02, E01 + 0.14, outBack), lock: { pins: 3, open: true }, tally: 12, light: 1, t: T };
    drawCage(lg, { ...cg, part: 'back' });
    if (P.inCage) drawPrincess(lg, P.o);
    drawCage(lg, { ...cg, part: 'front' });
    if (!P.inCage) drawPrincess(lg, P.o);
    heroA = drawHero(lg, Hs);
    // 砍空：剑撞在门框上的火花
    burst(lg, T, { at: E01 + 0.08, seed: 151, count: 12, x: CG[0] - 100, y: CG[1] + 20, spread: 10, speed: [200, 520], angle: [-Math.PI * 0.95, -Math.PI * 0.35], gravity: 900, drag: 1.5, life: [0.25, 0.5], size: [8, 14] }, sparkDraw);
    burst(lg, T, { at: E01 + 0.55, seed: 152, count: 8, x: 1110, y: groundAt(1110) - 4, spread: 26, speed: [40, 160], angle: [Math.PI * 1.1, Math.PI * 1.9], gravity: -40, drag: 2, life: [0.5, 0.9], size: [12, 22] }, dustDraw);
    const LZ = lizardPlan(T, c, heroA);
    if (LZ && LZ.layer === 'main') drawLizard(lg, LZ.o);
    drawPetals(lg, T, items, 'front');
    // 花环收齐的金光（164.90）
    const done = hit(T, BIRTH[10] + 0.15, 0.3);
    if (done > 0.03) { const ring = petalOrbit(T + 9, { cx: P.o.x, cy: P.o.y - 100, crown: { cx: P.o.x, cy: P.o.y - 300, Rx: 215, Ry: 92, t0: 0, t1: 1 } }); glow(lg, P.o.x, ring[5].y + 30, 260, PAL.goldLight, 0.5 * done); }
    lg.restore();
  });
  ctx.layer(g, { blur: 4 }, (lg) => drawCave(lg, T, c, { ...co, layer: 'fg' }));
  // 晨光尘埃 + 洞口斜射光（屏幕空间）
  const dawn = seg(T, E02 + 0.35, E02 + 1.55);
  if (dawn > 0) {
    g.save();
    rays(g, -160, 120, 2100, { n: 7, width: 0.06, rot: 0.42 + 0.05 * Math.sin(T * 0.6), color: PAL.princessLight, alpha: 0.16 * dawn, seed: 13 });
    field(g, T, { seed: 161, count: 34, x: 0, y: 0, w: 1920, h: 1080, vx: 14, vy: -10, sway: 16, swayFreq: 0.3, size: [2, 5] }, (gg, x, y, s) => {
      gg.fillStyle = rgba(s.r > 0.5 ? PAL.goldLight : PAL.princessLight, 0.55 * dawn * (0.4 + 0.6 * Math.sin(T * 2 + s.i) ** 2));
      gg.beginPath(); gg.arc(x, y, s.size, 0, TAU); gg.fill();
    });
    g.restore();
  }
  // —— 穿过台口：大幕拉开、整座台口 1 → 1.8 倍冲出屏幕边缘（161.13–161.50） ——
  if (T < E01 + 0.4) drawStage(g, T, ctx, { offK: 1 - seg(T, E01, E01 + 0.2), light: 'warm', lightK: 0 });
  void END;
}
