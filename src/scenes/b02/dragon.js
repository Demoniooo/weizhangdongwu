// b02 私有：巨龙的四种出场——L02 龙影、L02 纸天裂口里的龙头、俯冲掠过镜头前、提着鸟笼飞向龙山并缩成小点。
// 全部画在屏幕坐标（镜头自己决定图层）；纯函数：只由 T 决定。
import { PAL, glow, sparkle } from '../../core/paper.js';
import { clamp, lerp, seg, hit, wobble, TAU, mixHex, rgba } from '../../core/util.js';
import { ez, outBack, outCubic, inQuad, inOutSine, inOutQuad, glide } from '../../core/ease.js';
import { drawDragon, drawDragonHead, dragonSpine, DRAGON_POSES } from '../../rigs/dragon.js';
import { glyphIcon } from '../../ui/kit.js';
import { paperGlyph } from '../../ui/type.js';
import { TM } from './shared.js';

// ———————————————————— L02 龙影 ————————————————————
const SH_S = 1.05, SH_Y = 250;
const SH_SP = dragonSpine('shadow', 0);
const SH_HEAD = DRAGON_POSES.shadow.head;
const SH_TAIL_DX = (SH_SP[SH_SP.length - 1][0] - SH_HEAD[0]) * SH_S;   // 尾尖在头心右边多远（屏幕 px）

/** 龙影头心的屏幕 x（右 → 左，中段最快）。 */
export function shadowHeadX(T) {
  const u = seg(T, TM.shadow0, TM.shadow1);
  return lerp(2250, -2350, inOutQuad(u));
}
/** 龙影后缘（尾尖）屏幕 x：skyDoom 只露在它右侧。 */
export const shadowTailX = (T) => shadowHeadX(T) + SH_TAIL_DX + 40;
export const shadowActive = (T) => T > TM.shadow0 && T < TM.shadow1;

export function drawDragonShadow(g, T) {
  if (!shadowActive(T)) return;
  const x = shadowHeadX(T);
  drawDragon(g, { pose: 'shadow', t: T, x, y: SH_Y + 40 * Math.sin(T * 3), s: SH_S, rot: 4, face: -1, detail: 0 });
}

// ———————————————————— L02 裂口里的龙头 ————————————————————
/** 龙头状态（屏幕坐标；tc = 撕口中心的屏幕坐标）。 */
export function tearHeadState(T, tc) {
  if (T < TM.headOut || T > TM.dive0 + 0.06) return null;
  const e = ez(T, TM.headOut, TM.headOut + 0.2, (u) => outBack(u, 2.2));
  let s = lerp(0.55, 0.92, e);
  let x = tc[0] - 18 * e, y = tc[1] + 14 * e;
  let rot = lerp(14, 2, e);
  // 13.36–13.44 往后缩一下（预备），13.45 吼（张嘴、往前顶、甩头）
  const wind = Math.sin(Math.PI * seg(T, TM.roar - 0.11, TM.roar + 0.01));
  const roar = ez(T, TM.roar - 0.02, TM.roar + 0.06, outCubic);
  s *= 1 - 0.06 * wind + 0.08 * roar * hit(T, TM.roar, 0.4);
  rot += 9 * wind - 7 * roar + 3 * wobble(T, TM.roar, 7, 0.3);
  y += 8 * wind;
  const jaw = Math.max(0.04, roar * (1 - 0.35 * seg(T, TM.roar + 0.25, TM.dive0)));
  // 13.53 起朝镜头猛扑（变大、往左下冲）
  const lun = ez(T, TM.dive0 - 0.05, TM.dive0 + 0.06, inQuad);
  s *= lerp(1, 2.6, lun);
  x += lerp(0, -330, lun); y += lerp(0, 260, lun);
  return { x, y, s, rot, jaw, blur: 5 * lun, eyes: { state: T < TM.roar - 0.12 ? 'normal' : 'angry', pupil: lerp(0.3, 0.14, roar), red: 0.35 * roar, look: [-0.3, 0.2] } };
}

export function drawTearHead(g, T, st, hole) {
  if (!st) return null;
  const base = g.getTransform();
  // 脖子：只在撕口里露出（往右上缩回纸后）
  if (hole) {
    g.save();
    g.clip(hole);
    g.setTransform(base);
    drawDragonHead(g, { x: st.x, y: st.y, s: st.s, face: -1, rot: st.rot, neck: true, jaw: st.jaw, eyes: st.eyes, spikes: 0.6, t: T, nostril: st.jaw });
    g.restore();
  }
  return drawDragonHead(g, { x: st.x, y: st.y, s: st.s, face: -1, rot: st.rot, neck: false, jaw: st.jaw, eyes: st.eyes, spikes: 0.6, t: T, nostril: st.jaw });
}

// ———————————————————— 俯冲：身体贴着镜头前从右上往左下掠过 ————————————————————
const DIVE_ROT = -17;
/** 前景巨龙（屏幕坐标）：头从猛扑的龙头位置接手，沿身体方向往左下甩出，身体 + 尾巴随后扫过。 */
export function diveState(T) {
  const t0 = TM.dive0 + 0.06, t1 = TM.dive1;
  if (T < t0 || T >= t1) return null;
  const u = seg(T, t0, t1);
  const d = [-Math.cos(DIVE_ROT * Math.PI / 180), Math.sin(-DIVE_ROT * Math.PI / 180)];   // 头前进方向（左下）
  const dist = 5600 * (0.55 * u + 0.45 * u * u);
  const s = lerp(2.35, 2.6, u);
  return { x: 1030 + d[0] * dist, y: 590 + d[1] * dist, s, rot: DIVE_ROT, u };
}
export function drawDive(g, T, st) {
  if (!st) return;
  drawDragon(g, { pose: 'fly', t: T, x: st.x, y: st.y, s: st.s, face: -1, rot: st.rot, jaw: 0.55, wings: 1, arms: 0.4,
    eyes: { state: 'angry', pupil: 0.14, red: 0.3 }, spikes: 0.5, detail: 1 });
}

// ———————————————————— 提着鸟笼飞向龙山 ————————————————————
export const DOT = [1500, 400];      // 红点 = 「！」圆点（屏幕）
export const EX_SIZE = 132;          // 「！」符号尺寸（圆点半径 = 0.1 × size）
const F0 = TM.lift + 0.32, F1 = TM.pull1;   // 16.42 → 17.20
/** 飞行中的龙（屏幕）：16.42 从画面上沿右侧进来（大），沿弧线往龙山缩小，17.20 缩到红点位置。 */
export function flightState(T) {
  if (T < F0 || T >= F1 + 0.08) return null;
  const u = seg(T, F0, F1);
  const e = inOutSine(u);
  const p0 = [1240, 70], p1 = [1580, 150], p2 = [DOT[0] + 6, DOT[1] - 2];
  const a = lerp(lerp(p0[0], p1[0], e), lerp(p1[0], p2[0], e), e);
  const b = lerp(lerp(p0[1], p1[1], e), lerp(p1[1], p2[1], e), e);
  const s = 0.78 * Math.pow(0.018 / 0.78, Math.pow(u, 0.75));
  const fade = 1 - seg(T, F1 - 0.04, F1 + 0.06);
  return { x: a, y: b, s, rot: lerp(8, 18, u), u, alpha: fade };
}
/** 龙 + 爪下吊着的鸟笼（公主在里面）。drawCageFn(g, x, y, s, swing) 由镜头传入（复用阳台上同一个鸟笼画法）。 */
export function drawFlight(g, T, st, drawCageFn) {
  if (!st || st.alpha <= 0) return;
  g.save();
  g.globalAlpha *= st.alpha;
  const det = st.s > 0.18 ? 1 : 0;
  const A = drawDragon(g, { pose: 'fly', t: T, x: st.x, y: st.y, s: st.s, face: 1, rot: st.rot, arms: 0.9, grip: 1, wings: 1,
    jaw: 0.1, eyes: { state: 'smug' }, detail: det });
  const claw = A.claw || A.head;
  // 鸟笼吊在近侧前爪下（笼心在吊环下 135·s）
  const cs = st.s * 0.42;
  const swing = 0.22 * Math.sin(T * 5.2) * (1 - st.u);
  drawCageFn(g, claw[0], claw[1], cs, swing, det);
  g.restore();
}

// ———————————————————— 小黑点 → 「叮！」→ 红点 ————————————————————
export function drawDot(g, T) {
  if (T < F1 - 0.06) return;
  const [x, y] = DOT;
  // 墨点：龙缩成的小黑点
  const red = ez(T, TM.red0, TM.L05 - 0.06, inOutSine);
  const inkA = seg(T, F1 - 0.06, F1 + 0.04) * (1 - red);
  const r0 = 8.5 + 1.5 * hit(T, F1, 0.2);
  if (inkA > 0) {
    g.save(); g.globalAlpha *= inkA;
    g.fillStyle = PAL.ink; g.beginPath(); g.arc(x, y, r0, 0, TAU); g.fill();
    g.fillStyle = rgba(PAL.white, 0.35); g.beginPath(); g.arc(x - r0 * 0.35, y - r0 * 0.35, r0 * 0.28, 0, TAU); g.fill();
    g.restore();
  }
  // 17.45 四角星「叮！」
  const tw = T - TM.twinkle;
  if (tw >= 0 && tw < 0.5) {
    const k = outBack(clamp(tw / 0.12), 2) * (1 - seg(tw, 0.28, 0.5));
    glyphIcon(g, 'sparkle4', x, y, 92 * k, { rot: tw * 2.2, fill: PAL.goldLight, alpha: k });
    glow(g, x, y, 60 * k, PAL.goldLight, 0.5 * k);
    const a = outBack(clamp((tw - 0.02) / 0.14), 2.2) * (1 - seg(tw, 0.32, 0.5));
    if (a > 0) paperGlyph(g, '叮', x + 66, y - 52, 46 * a, { family: 'play', fill: PAL.ink, edge: PAL.paper, rot: -0.12 });
    if (a > 0) paperGlyph(g, '！', x + 104, y - 58, 46 * a, { family: 'play', fill: PAL.ink, edge: PAL.paper, rot: 0.1 });
  }
  // 17.75–18.00 变成实心红点（= 「！」的圆点：同一个 glyphIcon、同一尺寸）
  if (red > 0) {
    const sc = lerp(0.72, 1, ez(T, TM.red0, TM.L05 - 0.08, outBack));
    const S = EX_SIZE * sc;
    glyphIcon(g, 'exclaim', x, y - 0.34 * S, S, { bar: 0, alpha: red });
  }
}

export { glide };
