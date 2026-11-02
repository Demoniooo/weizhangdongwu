// b14 私有：E03 归程骑行画面（倒放色带 + 白马载着勇者、后座公主、肩上小蜥蜴向左狂奔）。屏幕空间。
import { PAL, blob, poly, cut, shade, glow, rgba, mixHex } from '../../core/paper.js';
import { clamp, lerp, seg, TAU, hash2, hit } from '../../core/util.js';
import { ez, outCubic, inOutSine, outBack } from '../../core/ease.js';
import { burst, stream } from '../../core/particles.js';
import { rewindBand, hudState } from '../../env/journey.js';
import { drawMiniMap } from '../../env/map.js';
import { drawHorse, horseRig, horsePhase, drawReins } from '../../rigs/horse.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawPrincess } from '../../rigs/princess.js';
import { drawLizard } from '../../rigs/dragon.js';
import { speedLines } from '../../fx/transitions.js';
import { dustDraw } from '../../props/misc.js';
import { E03, E04, T_START } from './common.js';

const S = 1.12; // 人马缩放（中景）
const V = 1150; // 世界速度（px/s，向左）
const GROUND = 846; // 马蹄着地线（屏幕）
const HX = 905; // 马在屏幕上的 x（机位跟拍）
const LEAP = { t0: E03 - 0.04, t1: E03 + 0.3 }; // 165.04 → 165.38 一跃
const BAND = { t0: E03 + 0.02, t1: E04 }; // 165.10 → 165.60 夜→冷→金→绿→晨

const worldX = (t) => 20000 - V * (t - T_START);
/** 一跃的高度（屏幕 px）：起跳前蓄力下沉，腾空弧线，落地挤压。 */
function leapY(t) {
  const a = seg(t, LEAP.t0, LEAP.t1);
  if (t < LEAP.t0) return 6 * seg(t, LEAP.t0 - 0.06, LEAP.t0);
  if (a < 1) return -150 * Math.sin(Math.PI * a) * (1 - 0.15 * a);
  return 0;
}
const posAt = (t) => [worldX(t), GROUND + leapY(t)];

/** 岩石（洞口外白马藏身的那块）：跟着世界向右飞走。 */
function drawRock(g, T) {
  const x = 1330 + (T - T_START) * V * 1.05;
  if (x > 2300) return;
  const p = poly([[x - 250, GROUND + 18], [x - 230, GROUND - 120], [x - 150, GROUND - 205], [x - 30, GROUND - 236], [x + 110, GROUND - 190], [x + 210, GROUND - 90], [x + 250, GROUND + 18]], { seed: 141, round: 0.55, amp: 3 });
  cut(g, p, mixHex(PAL.dragonDeep, PAL.mountainDark, 0.35), { rim: mixHex(PAL.dragon, PAL.moonGlow, 0.3), rimW: 3 });
  shade(g, p, PAL.ink, x - 250, GROUND - 236, x + 250, GROUND, 0, 0.45);
  cut(g, blob(x - 60, GROUND - 150, 46, 26, { seed: 142 }), mixHex(PAL.dragonDark, PAL.crystal, 0.18));
}

/** 人马组（屏幕坐标）。返回 { horse, hero, princess } 锚点。 */
export function drawRideGroup(g, T, o = {}) {
  const s = o.s ?? S, face = -1;
  const [wx, hy] = posAt(T);
  const air = seg(T, LEAP.t0, LEAP.t1);
  const leaping = T >= LEAP.t0 && air < 1;
  const land = T >= LEAP.t1 ? hit(T, LEAP.t1, 0.09) : 0;
  const crouch = T < LEAP.t0 ? seg(T, LEAP.t0 - 0.08, LEAP.t0) : 0;
  const sq = -0.14 * land * Math.cos((T - LEAP.t1) * 30) - 0.1 * crouch;
  const hp = horsePhase(wx, s);
  let pose = 'gallop';
  if (leaping) pose = air < 0.12 ? { from: 'gallop', to: 'leap', k: air / 0.12 } : air > 0.85 ? { from: 'leap', to: 'gallop', k: (air - 0.85) / 0.15 } : 'leap';
  const ho = { x: HX, y: hy, s, face, t: T, pose, air, phase: hp, speed: V / s, squash: sq, speedLines: 0.8, vel: [face * V, 0], expr: leaping ? 'happy' : undefined };
  const ha = horseRig(ho);
  const ro = {
    x: ha.saddle[0], y: ha.saddle[1], s, face, t: T, pose: 'rideFront', rot: ha.saddleRot, squash: sq,
    phase: face * hp, expr: leaping && air < 0.7 ? 'grin' : 'determined', ahogeAt: LEAP.t0 + 0.02,
    injury: { bandages: 1 }, scarf: { notch: true, hole: true, vel: [face * V, -260 * Math.cos(Math.PI * air) * (leaping ? 1 : 0)], len: 900, ground: 1e5 },
  };
  const hr = heroRig(ro);
  const h = drawHorse(g, { ...ho, stirrupAt: hr.foot });
  // 后座公主：辫子按世界轨迹回溯
  const p0 = posAt(T);
  const trail = Array.from({ length: 13 }, (_, k) => { const q = posAt(T - k * 0.035); return [q[0] - p0[0], q[1] - p0[1]]; });
  const pr = drawPrincess(g, {
    x: h.saddleBack[0], y: h.saddleBack[1], s, face, t: T, pose: 'ridePillion', rot: h.saddleRot, tiara: false,
    expr: leaping && air < 0.6 ? 'laugh' : 'loving', braid: { trail, vel: [face * V, 0] }, squash: sq,
  });
  const hero = drawHero(g, ro);
  drawReins(g, h.bit, hero.handL, { s });
  // 小蜥蜴：蹲在勇者肩头（勇者身后一侧），面朝右——回头望着越来越远的龙山
  const sh = [hero.neck[0] + 20 * s, hero.neck[1] + 4 * s];
  drawLizard(g, { pose: 'ride', x: sh[0], y: sh[1], s: s * 0.95, face: 1, t: T, joints: { head: leaping ? -12 * Math.sin(Math.PI * air) : 4 * Math.sin(T * 9) } });
  return { horse: h, hero, princess: pr };
}

/** 整帧归程画面（屏幕空间，自己铺满背景）。fade 0..1 = 甩镜开始后速度线衰减。 */
export function drawRidePicture(g, T, ctx, o = {}) {
  const p = ez(T, BAND.t0, BAND.t1, inOutSine);
  rewindBand(g, T, p, { horizon: 760 });
  ctx.layer(g, { shadow: 12, texture: 0.3 }, (lg) => {
    drawRock(lg, T);
    // 蹄下扬尘（向右飞，回溯出生时刻的蹄位）
    stream(lg, T, { start: LEAP.t1 - 0.02, end: E04 + 0.4, rate: 40, seed: 147, life: [0.25, 0.5], size: [16, 30],
      emit: (tb, i, r) => ({ x: HX + 60 + r * 90, y: GROUND - 6, vx: 900 + 500 * r, vy: -90 - 120 * r }) }, dustDraw);
    burst(lg, T, { at: LEAP.t1, seed: 148, count: 22, x: HX + 30, y: GROUND - 4, spread: 140, speed: [180, 520], angle: [-2.9, -0.2], gravity: 300, drag: 1.5, life: [0.35, 0.7], size: [18, 34] }, dustDraw);
    drawRideGroup(lg, T);
  });
  // 浓重横向速度线（向右飞 = 勇者向左骑）
  const k = 1 - 0.85 * seg(T, E04 - 0.1, E04 + 0.25);
  speedLines(g, 'h', undefined, { t: T, sign: 1, speed: 3200, alpha: 0.55 * k, density: 1.6, colors: [PAL.white, PAL.paper], len: [0.2, 0.6], seed: 149 });
  // 小地图：小骑士倒退回王城，走过的路段由红变金
  const hs = hudState(T);
  if (o.mini !== false) drawMiniMap(g, T, hs.mini);
}
