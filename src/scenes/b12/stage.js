// b12 · 纸剧场（一）私有辅助：整帧画法 drawB12(g, T, ctx) + 三个木偶的编舞（纯函数，只由 T 决定）。
// 坐标一律是剧场坐标（= TT-W 下的屏幕坐标）；机位与接缝合同同一公式 withDrift(theaterCam(T), T, DRIFT)。
// 台口 / 灯 / 名字牌 / 菜单 / HP / 横幅的时序全部取 theaterState(T)（与 b13 共用）；木偶编舞、特效在本文件。
import { cue } from '../../cues.js';
import { PAL, glow, ribbon, blob, rr } from '../../core/paper.js';
import { applyCam } from '../../core/camera.js';
import { clamp, lerp, seg, smoothstep, wobble, hit, noise1, hash2, TAU, rgba, mixHex } from '../../core/util.js';
import { glide, outCubic, inCubic, outBack, inQuad, outQuad, inOutCubic, inOutSine, outExpo } from '../../core/ease.js';
import { burst, stream } from '../../core/particles.js';
import { drawTheater, theaterState, theaterCam, theaterClip, THEATER } from '../../env/theater.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawDragon } from '../../rigs/dragon.js';
import { drawPrincess } from '../../rigs/princess.js';
import { drawCage, drawChain } from '../../props/cave.js';
import { marqueePlate, battleMenu, turnBanner, damageNumber, glyphIcon, TXT } from '../../ui/kit.js';
import { glyphRow } from '../../ui/type.js';
import { impact, impactRays } from '../../fx/transitions.js';
import { SEAMS, resolveParams, withDrift, DRIFT } from '../_seams.js';

// ———————————————————— 时刻（cue + 偏移） ————————————————————
const B = (id) => cue(id);
export const T0 = B('B01') - 0.52;            // 137.40 接管黑边
export const T_END = B('B08');                // 150.52 接缝
const B01 = B('B01'), B02 = B('B02'), B03 = B('B03'), B04 = B('B04'), B05 = B('B05'), B06 = B('B06'), B07 = B('B07');
const SO_S = 0.88436;                         // STANDOFF 机位 zoom：b11 里 s=1 的角色在屏幕上的大小
const FLIP = { hero: [T0 + 0.17, T0 + 0.33], cage: [T0 + 0.22, T0 + 0.38], dragon: [T0 + 0.27, T0 + 0.45] }; // 翻成纸偶（错峰）
const ROD = [T0 + 0.45, T0 + 0.65];           // 137.85–138.05 木杆从台下伸上来（= theaterState.rods）
const HIT = B03 + 0.04;                       // 月牙斩命中（141.32）
const HOLD = 2 / 30;                          // 命中定格 2 帧
const LURCH = [B06 + 0.27, B06 + 0.77, B06 + 1.27, B06 + 1.72]; // 龙偶顿挫逼近（147.00 / 147.50 / 148.00 / 148.45）
const BUMP = B06 + 1.87;                      // 148.60 勇者偶撞上挡块
const SWAP = B07 + 0.03;                      // 149.36 勇者偶被含进嘴里（换成 puppetInMouth）

// ———————————————————— 站位（剧场坐标） ————————————————————
const HOME = 736;                             // 勇者偶签位：让开左下指令菜单（x 150–560）
const CHG = 950;                              // 蓄力滑到台中
const LAND = 1050;                            // 月牙斩落地
const STOP = 652;                             // 轨道尽头挡块（菜单右缘外）
const RETREAT = [HOME, 714, 692, 671, STOP];
// 接缝合同（b12|b13 @ 150.52）：接缝前 0.3s 起木偶参数直接读合同
const SEAM = SEAMS['b12|b13'];
const seamItem = (id) => [...SEAM.actors, ...SEAM.props, ...SEAM.ui].find((it) => it.id === id);
const SEAM_LOCK = T_END - 0.3;
const HOME_D = [1351.1, 517.9];               // 龙偶头心（puppet 预设）

// ———————————————————— 小工具 ————————————————————
/** 分段关键帧：keys = [[t, v], [t, v, ease], …]，ease 作用于“上一键 → 这一键”。 */
function track(T, keys) {
  if (T <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (T < t1) { const [t0, v0] = keys[i - 1]; const k = (e || ((x) => x))((T - t0) / (t1 - t0)); return v0 + (v1 - v0) * k; }
  }
  return keys[keys.length - 1][1];
}
/** 命中定格：HIT 起冻结 2 帧，木偶动作用这个时间。 */
const tp = (T) => (T >= HIT && T < HIT + HOLD ? HIT : T);
const nearSeam = (T) => 1 - smoothstep(T_END - 0.42, T_END - 0.12, T); // 接近接缝时把次级效果收干净

// ———————————————————— 勇者偶 ————————————————————
function heroX(T) {
  const k = [
    [T0 + 0.15, 520], [T0 + 0.48, HOME, glide],
    [B03 - 0.78, HOME], [B03 - 0.12, CHG, outCubic],
    [B03 - 0.04, CHG], [HIT, LAND - 34, outQuad], [B03 + 0.26, LAND, outCubic],
    [B04 + 0.76, LAND], [B04 + 1.46, HOME, glide],
  ];
  RETREAT.slice(1).forEach((x, i) => {
    const a = LURCH[i] + 0.05, b = i === 3 ? BUMP : a + 0.2;
    k.push([a, RETREAT[i]], [b, x, i === 3 ? inQuad : outCubic]);
  });
  return track(T, k);
}
function heroLift(T) {
  return track(T, [
    [T0 + 0.15, 0], [T0 + 0.315, -26, outQuad], [T0 + 0.48, 0, inQuad],
    [B02 - 0.02, 0], [B02 + 0.09, -16, outQuad], [B02 + 0.22, 0, inQuad],
    [B03 - 0.08, 0], [HIT, -150, outQuad], [HIT + 0.06, -150], [B03 + 0.26, 0, inQuad],
  ]);
}
/** 勇者偶参数（不含 x/y 的木杆处理），T 为真实时刻，动作用 tp(T)。 */
export function heroParams(T) {
  const P = tp(T);
  const x = heroX(P), lift = heroLift(P);
  const scarf = { len: 936, glow: 0.6, notch: true, hole: true, ground: THEATER.floorY };
  const flipMid = (FLIP.hero[0] + FLIP.hero[1]) / 2;
  if (T < flipMid) {
    // b11 对峙里的勇者（屏幕 (520,840)，s = STANDOFF zoom），开始被“搬”到签位
    return { x, y: 840 + lift, s: lerp(SO_S, 1, glide(seg(T, T0 + 0.15, T0 + 0.45))), face: 1, t: T, pose: 'stance', expr: 'determined', scarf: { ...scarf, vel: [0, 0] } };
  }
  const o = { x, y: 840 + lift, s: lerp(SO_S, 1, glide(seg(T, T0 + 0.15, T0 + 0.45))), face: 1, t: T, rod: T >= ROD[1], sword: 'hand', scarf };
  // 滑动时围巾被“风”带起（时间回溯速度）
  const vx = (heroX(P + 0.03) - heroX(P - 0.03)) / 0.06;
  o.scarf = { ...scarf, vel: [vx, 0] };
  if (P < B03 - 0.78) {
    o.pose = 'puppetStand';
    o.expr = P >= B02 - 0.06 && P < B02 + 1.1 ? 'smug' : 'determined';
    o.ahogeAt = B02;
    o.jointsAdd = { nod: P >= B02 - 0.06 && P < B02 + 1.1 ? -8 * seg(P, B02 - 0.06, B02 + 0.1) : 0 };
  } else if (P < B03) {
    const k = glide(seg(P, B03 - 0.78, B03 - 0.12));
    o.pose = { from: 'puppetStand', to: 'puppetSlash', k }; o.act = 0; o.expr = 'shout';
    o.rot = 0.06 * k;
    o.squash = -0.09 * smoothstep(B03 - 0.2, B03 - 0.08, P) * (1 - seg(P, B03 - 0.08, B03 - 0.02));
    o.swordGlint = seg(P, B03 - 0.45, B03 - 0.05);
  } else if (P < B04 + 0.76) {
    o.pose = 'puppetSlash'; o.act = outCubic(seg(P, B03, HIT + 0.08)); o.expr = 'shout';
    o.rot = 0.06 * (1 - seg(P, HIT, B03 + 0.3)) + 0.05 * wobble(P, B03 + 0.26, 3, 0.25);
    o.squash = -0.14 * wobble(P, B03 + 0.26, 3.2, 0.18) * (P >= B03 + 0.26 ? 1 : 0);
    if (P >= B03 + 0.45) o.expr = 'determined';
  } else if (P < B05) {
    const k = glide(seg(P, B04 + 0.76, B04 + 1.36));
    o.pose = k < 1 ? { from: 'puppetSlash', to: 'heroPose', k } : 'heroPose'; o.act = 1;
    o.sword = k < 0.5 ? 'hand' : 'shoulder';
    o.expr = P < B04 + 1.0 ? 'determined' : 'smug';
    o.toothSparkle = B04 + 1.5;
    o.rot = -0.04 * k + 0.03 * wobble(P, B04 + 1.46, 2.5, 0.3);
    o.jointsAdd = { nod: -10 * k };
  } else if (P < SWAP) {
    const k = glide(seg(P, B05, B05 + 0.3));
    const k2 = glide(seg(P, BUMP - 0.08, BUMP + 0.08));
    o.pose = k2 > 0 ? { from: 'gulp', to: 'shieldFace', k: k2 } : k < 1 ? { from: 'heroPose', to: 'gulp', k } : 'gulp';
    o.sword = k < 0.5 ? 'shoulder' : 'hand';
    if (k >= 0.5) o.swordAngle = lerp(1.15, 0.55, k2);   // 哆嗦时剑尖垂向地面，撞上挡块时横在胸前（不挡脸）
    o.expr = P < B05 + 0.5 ? 'worried' : 'shock';
    o.sweat = seg(P, B05 + 0.3, B05 + 1.2);
    // 在杆子上直哆嗦（越来越抖），后退时后仰，撞上挡块弹一下
    const shiver = smoothstep(B05 + 0.5, B05 + 1.2, P) * (1 + 0.8 * seg(P, B06, BUMP));
    o.x += 1.6 * shiver * noise1(P * 34, 5);
    o.y += 1.2 * shiver * Math.abs(noise1(P * 29, 9));
    o.rot = 0.015 * shiver * noise1(P * 26, 13) - 0.07 * smoothstep(LURCH[0], LURCH[0] + 0.3, P) + 0.09 * wobble(P, BUMP, 4, 0.22);
    o.squash = -0.1 * wobble(P, BUMP, 5, 0.15);
  }
  return o;
}

// ———————————————————— 龙偶 ————————————————————
function dragonDX(T) {
  const keys = [
    [HIT, 0], [HIT + 0.08, 16, outQuad], [B04, 8, inOutSine], [B04 + 0.2, 72, outCubic],
    [B04 + 1.5, 72], [B04 + 2.2, 0, glide],
    [B05 + 0.57, 0], [B05 + 1.47, 34, glide],
  ];
  let x = 34;
  LURCH.forEach((t, i) => { const nx = x - (i < 3 ? 76 : 80); keys.push([t - 0.05, x], [t + 0.14, nx, outBack]); x = nx; });
  keys.push([B07 - 0.13, x], [B07, -575, inCubic], [B07 + 0.15, -575], [B07 + 0.47, -190, inOutCubic], [B07 + 0.9, 0, outCubic]);
  return track(T, keys);
}
function dragonDY(T) {
  return track(T, [[B07 - 0.13, 0], [B07, 46, inCubic], [B07 + 0.15, 46], [B07 + 0.47, 18, inOutCubic], [B07 + 0.9, 0, outCubic]]);
}
function dragonJaw(T) {
  return track(T, [
    [HIT, 0.04], [HIT + 0.05, 0.5, outQuad], [B04, 0.28], [B04 + 1.5, 0.3], [B04 + 1.9, 0.04, outCubic],
    [B05 + 0.57, 0.04], [B05 + 1.47, 0.3, glide], [B06 + 0.17, 0.3], [B07 - 0.13, 1, inOutSine],
    [B07, 1], [B07 + 0.05, 0.24, outQuad],
  ]);
}
export function dragonParams(T) {
  const P = tp(T);
  const flipMid = (FLIP.dragon[0] + FLIP.dragon[1]) / 2;
  const o = { t: T, pose: T < flipMid ? 'standoff' : 'puppet', jaw: dragonJaw(P) };
  // 眼睛：对峙怒目 → 看勇者亮名字时斜眼得意 → 选中「攻击」吓一跳 → 中招叉叉眼 → 蚊香眼 → 恼羞成怒 → 敌方回合红眼
  if (P < B02 + 0.16) o.eyes = { state: 'angry', pupil: 0.2 };
  else if (P < B03 - 0.98) o.eyes = { state: 'smug' };
  else if (P < HIT) o.eyes = { state: 'normal', pupil: 0.12, look: [-0.6, 0.15] };
  else if (P < B04) o.eyes = { state: 'x' };
  else if (P < B04 + 1.5) o.eyes = { state: 'dizzy' };
  else if (P < B05) o.eyes = { state: 'angry', pupil: 0.16, look: [-0.5, 0.1] };
  else {
    const red = seg(P, B05 + 0.57, B05 + 1.3) * nearSeam(P);
    o.eyes = { state: 'angry', pupil: lerp(0.3, 0.12, red), red, glow: 0.4 * red };
  }
  if (T < flipMid) o.eyes = { state: 'angry', pupil: 0.2 };
  // 头：中招后仰 / 敌方回合后仰蓄力 / 逼近时压低
  const head = 18 * outCubic(seg(P, B04, B04 + 0.18)) * (1 - glide(seg(P, B04 + 1.4, B04 + 2.0))) + 7 * wobble(P, B04 + 0.18, 2.4, 0.4)
    + 9 * glide(seg(P, B05 + 0.57, B05 + 1.47)) * (1 - glide(seg(P, B06 + 0.1, B06 + 0.6)))
    - 7 * glide(seg(P, B06 + 0.1, B06 + 0.6)) * (1 - glide(seg(P, B07 + 0.2, B07 + 0.8)));
  o.joints = { head };
  o.rot = -3 * glide(seg(P, B06 + 0.1, B06 + 0.6)) * (1 - glide(seg(P, B07 + 0.2, B07 + 0.8)));
  o.spikes = outBack(seg(P, B06, B06 + 0.2)) * (1 - glide(seg(P, B07 + 0.3, B07 + 0.75)));
  o.vein = seg(P, B04 + 1.55, B04 + 1.75) * (1 - glide(seg(P, B07 + 0.3, B07 + 0.75)));
  o.steam = [B04 + 1.75, B04 + 2.45];
  if (P >= SWAP) o.puff = 0.15 * outBack(seg(P, SWAP, SWAP + 0.16));
  if (P >= B05) o.wings = 0.5 + 0.25 * smoothstep(B05 + 0.57, B05 + 1.4, P) * (1 - glide(seg(P, B07 + 0.3, B07 + 0.75)));
  if (T >= SEAM_LOCK) return { o: resolveParams(seamItem('dragon').params, T, {}), dx: dragonDX(P), dy: dragonDY(P) };
  return { o, dx: dragonDX(P), dy: dragonDY(P) };
}
/** B04 在杆子上转一圈：横向 |cos| 压扁，背面（cos<0）露出牛皮纸背。 */
function dragonTwirl(T) {
  const u = seg(T, B04 + 0.06, B04 + 0.58);
  if (u <= 0 || u >= 1) return { sx: 1, back: false };
  const c = Math.cos(TAU * inOutSine(u));
  return { sx: Math.max(0.05, Math.abs(c)), back: c < 0 };
}

// ———————————————————— 公主（笼中迷你偶） ————————————————————
function princessParams(T) {
  let expr = 'tense', sign = 0;
  if (T >= B02 && T < B03) expr = 'focused';
  if (T >= HIT && T < B05) { expr = 'laugh'; sign = outCubic(seg(T, B04 + 0.1, B04 + 0.35)) * (1 - inOutCubic(seg(T, B04 + 1.6, B04 + 2.0))); }
  if (T >= B04 + 2.0 && T < B05) expr = 'smile';
  if (T >= B05) expr = T < B06 ? 'tense' : 'shock';
  return { x: THEATER.cage.x, y: THEATER.cage.y + 62, s: 0.5, face: -1, t: T, pose: 'puppetCage', expr, sign };
}
function cageSwing(T) {
  const s = 0.07 * wobble(T, B04 + 0.08, 1.3, 0.8) + LURCH.reduce((a, t) => a + 0.025 * wobble(T, t + 0.1, 1.4, 0.5), 0) + 0.06 * wobble(T, B07 + 0.17, 1.6, 0.35);
  return s * nearSeam(T);
}

// ———————————————————— 画笔 ————————————————————
/** 从台下伸上来的木杆（与 rigs 里的木杆同色）。 */
function risingRod(g, x, yTop, w, k) {
  if (k <= 0) return;
  const y0 = lerp(905, yTop, outCubic(clamp(k)));
  g.save();
  g.fillStyle = PAL.wood; g.fillRect(x - w / 2, y0, w, 1180 - y0);
  g.fillStyle = rgba(PAL.woodDark, 0.6); g.fillRect(x + w * 0.12, y0, w * 0.38, 1180 - y0);
  g.restore();
}
/** 白色月牙斩（沿弧线的粗细条带）：c = 弧心，R 半径，a0..a1 角度，w 最大宽度。 */
function crescent(g, cx, cy, R, a0, a1, w, alpha) {
  if (alpha <= 0) return;
  const pts = [], ws = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24, a = lerp(a0, a1, u); pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); ws.push(w * Math.pow(Math.sin(Math.PI * u), 0.8) + 0.5); }
  g.save();
  g.globalAlpha *= alpha;
  glow(g, cx + Math.cos((a0 + a1) / 2) * R, cy + Math.sin((a0 + a1) / 2) * R, R * 0.9, PAL.goldLight, 0.55);
  g.fillStyle = rgba(PAL.goldLight, 0.9); g.fill(ribbon(pts, ws.map((v) => v * 1.35)));
  g.fillStyle = PAL.white; g.fill(ribbon(pts, ws));
  g.restore();
}

// ———————————————————— 整帧 ————————————————————
export function drawB12(g, T, ctx) {
  const st = theaterState(T);
  const c = withDrift(theaterCam(T), T, DRIFT);
  // 接管 b11 的宽银幕黑边：引擎黑边关掉，黑条由 drawTheater 的 grow 0 自己画
  ctx.fx.letterbox = 0;
  const tassel = (0.22 * wobble(T, B01, 2.2, 0.45) + 0.12 * wobble(T, B07 + 0.47, 2.6, 0.3)) * nearSeam(T);
  const thud = 0.024 * wobble(T, B01, 3.2, 0.16);
  const env = { ...st, cave: st.caveOpts, cam: c, tasselSwing: tassel, bite: st.bite + thud };
  const stage = (lg) => applyCam(lg, c, 1);

  // 1) 剧场后片：暗房 / 内壁 / 压平的山洞背景片 / 舞台地板
  ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawTheater(lg, T, { ...env, part: 'back' }));

  // 2) 木偶层（裁进剧场盒子）
  let heroA = null, dragA = null;
  const hp = heroParams(T);
  const dp = dragonParams(T);
  ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
    lg.save(); lg.clip(theaterClip({ cam: c, scale: st.scale })); stage(lg);
    drawCagePuppet(lg, T);
    dragA = drawDragonPuppet(lg, T, dp);
    heroA = drawHeroPuppet(lg, T, hp, dragA);
    lg.restore();
  });

  // 3) 台口内特效（在顶幕 / 台唇之下）
  g.save(); stage(g);
  drawStageFx(g, T, heroA, dragA, dp);
  g.restore();

  // 4) 台口：主幕、舞台光、边幕、顶幕、台唇与脚灯、咬合黑缝
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawTheater(lg, T, { ...env, part: 'frame' }));

  // 5) 界面（名字牌 / 横幅 / 菜单 / 伤害数字 / 拟声）
  if (T >= B01 - 0.02) ctx.layer(g, { shadow: 10, texture: 0.2 }, (lg) => {
    drawTheater(lg, T, { ...env, part: 'frameFront' });
    lg.save(); stage(lg);
    drawUI(lg, T, st, dragA, dp);
    lg.restore();
  });

  // 6) 冲击
  impact(ctx, T, B01, 'S', { shake: 5, flash: 0, decay: 0.18 });
  impact(ctx, T, HIT, 'M', { shake: 18, flash: 0.8, decay: 0.26 });
  if (T >= B04) impact(ctx, T, B04 + 0.06, 'S', { shake: 6, flash: 0, decay: 0.2 });
  for (const t of LURCH) if (T >= t && T < t + 0.8) impact(ctx, T, t + 0.1, 'S', { shake: 5, flash: 0, decay: 0.16, seed: 3 });
  if (T >= BUMP && T < BUMP + 0.8) impact(ctx, T, BUMP, 'S', { shake: 4, flash: 0, decay: 0.12, seed: 5 });
  if (T < T_END - 0.25) impact(ctx, T, B07 + 0.17, 'L', { shake: 22, flash: 0.4, flashColor: PAL.heart, decay: 0.2 });
}

// —— 鸟笼 + 公主 ——
function drawCagePuppet(lg, T) {
  const mid = (FLIP.cage[0] + FLIP.cage[1]) / 2;
  const u = seg(T, FLIP.cage[0], FLIP.cage[1]);
  const sx = u > 0 && u < 1 ? Math.max(0.05, Math.abs(Math.cos(Math.PI * u))) : 1;
  const cx = THEATER.cage.x, cy = THEATER.cage.y;
  lg.save();
  lg.translate(cx, 0); lg.scale(sx, 1); lg.translate(-cx, 0);
  if (T < mid) {
    // b11 洞里的真鸟笼（屏幕 (1480,330)，按 STANDOFF 缩放）+ 吊链
    const s = SO_S, L = 0.92;
    drawChain(lg, [[cx, cy - 135 * s], [cx, -40]], { s, light: L });
    const cg = { x: cx, y: cy, s, light: L, tally: 12, lock: { pins: 1 } };
    drawCage(lg, { ...cg, part: 'back' });
    drawPrincess(lg, { x: cx, y: cy + 98 * s, s: 0.78 * s, face: -1, t: T, pose: 'caged', expr: 'tense' });
    drawCage(lg, { ...cg, part: 'front' });
  } else {
    const sw = cageSwing(T);
    const cg = { x: cx, y: cy, mini: true, lock: { pins: 1 }, swing: sw };
    drawCage(lg, { ...cg, part: 'back' });
    const pp = princessParams(T);
    if (sw) {
      // 公主跟着笼子一起摆（绕吊杆顶）
      const pv = [cx, cy - (86 + 300)];
      lg.save(); lg.translate(pv[0], pv[1]); lg.rotate(sw); lg.translate(-pv[0], -pv[1]);
      drawPrincess(lg, pp);
      lg.restore();
    } else drawPrincess(lg, pp);
    drawCage(lg, { ...cg, part: 'front' });
  }
  lg.restore();
}

// —— 龙偶 ——
function drawDragonPuppet(lg, T, dp) {
  const { o, dx, dy } = dp;
  const fu = seg(T, FLIP.dragon[0], FLIP.dragon[1]);
  const fsx = fu > 0 && fu < 1 ? Math.max(0.04, Math.abs(Math.cos(Math.PI * fu))) : 1;
  const tw = dragonTwirl(T);
  const rodK = seg(T, ROD[0], ROD[1]);
  const piv = 1321 + dx;                     // 前签位置（翻面 / 转圈的轴）
  lg.save();
  lg.translate(dx, dy);
  if (fsx !== 1 || tw.sx !== 1) { lg.translate(piv - dx, 0); lg.scale(fsx * tw.sx, 1); lg.translate(-(piv - dx), 0); }
  let A;
  if (tw.back) {
    // 纸偶背面：整片牛皮纸剪影（木杆自己画）
    lg.save(); lg.translate(5, 7); drawDragon(lg, { ...o, silhouette: true, silColor: PAL.kraftDark, keepColor: [], rod: 0 }); lg.restore();
    A = drawDragon(lg, { ...o, silhouette: true, silColor: PAL.kraft, keepColor: [], rod: 0 });
    lg.save(); lg.globalCompositeOperation = 'destination-over';
    for (const [ax, ay] of A.rods) risingRod(lg, ax, ay, 13, 1);
    lg.restore();
  } else if (o.pose === 'puppet' && rodK < 1) {
    A = drawDragon(lg, { ...o, rod: 0 });
    lg.save(); lg.globalCompositeOperation = 'destination-over';
    for (const [ax, ay] of A.rods) risingRod(lg, ax, ay, 13, rodK);
    lg.restore();
  } else A = drawDragon(lg, o);
  lg.restore();
  // 返回调用坐标的锚点（加回平移）
  const sh = (p) => (p ? [p[0] + dx, p[1] + dy] : p);
  return { ...A, mouth: sh(A.mouth), head: sh(A.head), nose: sh(A.nose), horn: sh(A.horn), eyeL: sh(A.eyeL), eyeR: sh(A.eyeR), jawTip: sh(A.jawTip) };
}

// —— 勇者偶 ——
function drawHeroPuppet(lg, T, hp, dragA) {
  if (T >= SWAP) {
    // 被含在嘴里：只剩两条乱蹬的腿（= 接缝合同的参数）
    const o = resolveParams(seamItem('hero').params, T, { A: { dragon: dragA } });
    return drawHero(lg, o);
  }
  const u = seg(T, FLIP.hero[0], FLIP.hero[1]);
  const sx = u > 0 && u < 1 ? Math.max(0.04, Math.abs(Math.cos(Math.PI * u))) : 1;
  const rodK = seg(T, ROD[0], ROD[1]);
  lg.save();
  if (sx !== 1) { lg.translate(hp.x, 0); lg.scale(sx, 1); lg.translate(-hp.x, 0); }
  if (hp.pose !== 'stance' && rodK < 1) {
    const seat = heroRig({ ...hp, rod: false }).seat;
    risingRod(lg, hp.x, seat[1] - 15, 8.4 * (hp.s ?? 1), rodK);
  }
  const A = drawHero(lg, hp.pose === 'stance' ? hp : { ...hp, rod: rodK >= 1 ? true : false });
  lg.restore();
  return A;
}

// —— 台口内特效：剑光蓄力、月牙斩、火花、绕头星、落灰 ——
function drawStageFx(g, T, heroA, dragA, dp) {
  // 蓄力：剑身白金光越来越亮
  const charge = smoothstep(B03 - 0.75, B03 - 0.05, T) * (1 - seg(T, HIT, HIT + 0.12));
  if (charge > 0 && heroA && heroA.swordTip) {
    const [hx, hy] = heroA.hilt, [tx, ty] = heroA.swordTip;
    for (let i = 0; i <= 4; i++) glow(g, lerp(hx, tx, i / 4), lerp(hy, ty, i / 4), 36 + 46 * charge, i === 4 ? PAL.white : PAL.goldLight, 0.5 * charge);
    glow(g, tx, ty, 150 * charge, PAL.white, 0.75 * charge);
    if (charge > 0.6) glyphIcon(g, 'sparkle4', tx, ty, 70 * charge * (0.85 + 0.15 * Math.sin(T * 40)), { rot: T * 3, alpha: seg(charge, 0.6, 0.9) });
  }
  // 月牙斩：从剑弧飞出，横劈过龙偶
  const sp = seg(T, B03 + 0.01, B03 + 0.22);
  if (sp > 0 && T < B03 + 0.5) {
    const fade = 1 - seg(T, B03 + 0.16, B03 + 0.46);
    const cx = lerp(1130, 1660, outCubic(sp)), cy = 520;
    for (let k = 3; k >= 0; k--) crescent(g, cx - 250 - k * 30 * (1 - 0.5 * sp), cy + 20, 255, -1.0, 1.0, 26 - k * 5, fade * (k ? 0.3 / k : 1));
  }
  // 命中：龙偶脖子上的斩痕 + 白纸火花
  if (T >= HIT && T < HIT + 0.6) {
    const k = 1 - seg(T, HIT + 0.05, HIT + 0.45);
    g.save(); g.globalAlpha *= k;
    g.strokeStyle = PAL.white; g.lineCap = 'round'; g.lineWidth = 10 * k + 2;
    g.beginPath(); g.moveTo(1170, 430); g.lineTo(1560, 650); g.stroke();
    g.restore();
    burst(g, T, { at: HIT, seed: 1203, count: 42, x: 1330, y: 540, spread: 30, speed: [300, 900], angle: [-2.6, 0.6], gravity: 900, drag: 2.2, life: [0.35, 0.7], size: [6, 14] }, (bg, x, y, s) => {
      bg.save(); bg.translate(x, y); bg.rotate(s.rot); bg.globalAlpha *= 1 - s.p;
      bg.fillStyle = s.i % 4 === 0 ? PAL.goldLight : PAL.white; bg.fillRect(-s.size / 2, -s.size * 0.18, s.size, s.size * 0.36);
      bg.restore();
    });
  }
  // 中招：头上绕三颗星（蚊香眼期间）
  const sk = seg(T, B04 + 0.12, B04 + 0.3) * (1 - seg(T, B04 + 1.3, B04 + 1.55));
  if (sk > 0 && dragA) {
    const [hx, hy] = dragA.head;
    for (let i = 0; i < 3; i++) {
      const a = T * 5.2 + (i * TAU) / 3;
      const x = hx - 10 + Math.cos(a) * 130, y = hy - 175 + Math.sin(a) * 34;
      const front = Math.sin(a) > -0.2;
      glyphIcon(g, 'star', x, y, (front ? 46 : 34) * outBack(sk, 2), { alpha: front ? 1 : 0.75, rot: a * 0.6 });
    }
  }
  // 敌方回合：龙偶每顿一下，台口上方簌簌掉灰
  const dust = (bg, x, y, s) => {
    bg.save(); bg.translate(x, y); bg.rotate(s.rot); bg.globalAlpha *= 0.85 * (1 - s.p);
    bg.fillStyle = [PAL.sand, PAL.stone, PAL.kraft, PAL.paper2][s.i % 4];
    bg.fillRect(-s.size / 2, -s.size / 3, s.size, s.size * 0.66);
    bg.restore();
  };
  LURCH.forEach((t, i) => burst(g, T, { at: t + 0.1, seed: 1240 + i, count: 34, x: 960, y: 176, spread: 760, speed: [10, 70], angle: [1.2, 1.9], gravity: 520, drag: 0.6, life: [0.9, 1.5], spin: [-5, 5], size: [3, 8] }, dust));
  if (T >= B06 && T < B07 + 0.2) {
    stream(g, T, { start: B06 + 0.2, end: B07, rate: 26, seed: 1260, life: [1.0, 1.6], gravity: 300, drag: 0.4, size: [2, 5], spin: [-4, 4],
      emit: (tb, i, r) => ({ x: 150 + hash2(i, 77) * 1620, y: 168 + r * 10, vx: (hash2(i, 78) - 0.5) * 30, vy: 20 }) }, dust);
  }
  // 撞上挡块：脚边一小团灰
  burst(g, T, { at: BUMP, seed: 1270, count: 14, x: STOP - 30, y: 836, spread: 12, speed: [40, 140], angle: [-3.0, -1.9], gravity: 300, drag: 2.5, life: [0.4, 0.7], size: [6, 12] }, dust);
  burst(g, T, { at: B03 + 0.26, seed: 1271, count: 16, x: LAND, y: 836, spread: 30, speed: [50, 160], angle: [-3.0, -0.2], gravity: 300, drag: 2.5, life: [0.4, 0.7], size: [6, 12] }, dust);
  // 挡块（轨道尽头的小木块），敌方回合开始被注意到
  void dp;
}

// —— 界面 ——
function drawUI(lg, T, st, dragA, dp) {
  const hp = st.heroPlate, dpl = st.dragonPlate, m = st.menu, b = st.banner;
  // 149.50 咬合：黑缝处炸开的放射线（压在名字牌 / 横幅 / 菜单之下）
  if (T < T_END - 0.3) impactRays(lg, T, B07 + 0.17, 'L', { x: 960, y: 529, color: PAL.goldLight, alpha: 0.9 });
  // 勇者名字牌：149.36 起名字随咬合被“吃掉”（pass 模式往左滚出），接缝时窗口空着（合同）
  let mode, prog = hp.progress;
  if (T >= SWAP) { mode = 'pass'; prog = T >= B07 + 0.15 ? hp.progress : lerp(0.7222, 1, inCubic(seg(T, SWAP, B07 + 0.15))); }
  marqueePlate(lg, { side: 'hero', state: hp.state, progress: prog, mode, crack: hp.crack, peeled: hp.peeled, drop: hp.drop, hp: st.hp.hero, hpLag: st.hp.heroLag, hpText: `HP ${st.hp.heroNum}`, t: T });
  marqueePlate(lg, { side: 'dragon', state: dpl.state, progress: dpl.progress, drop: dpl.drop, shrink: dpl.shrink, hp: st.hp.dragon, hpLag: st.hp.dragonLag, t: T });
  turnBanner(lg, { text: b.text, textFrom: b.prev, flip: b.flip < 1 ? b.flip : 0, drop: b.drop, t: T });
  // B02 勇者名字牌亮起：金光一闪 + 四颗小星从牌角弹出
  if (T >= B02 && T < B02 + 0.8) {
    glow(lg, 450, 219, 380, PAL.goldLight, 0.5 * hit(T, B02, 0.22));
    [[168, 182], [732, 184], [300, 262], [640, 262]].forEach(([x, y], i) => {
      const u = seg(T, B02 + i * 0.05, B02 + i * 0.05 + 0.4);
      if (u > 0 && u < 1) glyphIcon(lg, 'sparkle4', x + (i % 2 ? 14 : -14) * u, y + (i < 2 ? -16 : 16) * u, 38 * Math.sin(Math.PI * u), { rot: u * 2 });
    });
  }
  const menu = battleMenu(lg, { pop: m.show, cursor: m.cursor === 'skill' ? m.cursorMove : 0, locked: m.gray, lockPop: m.lockPop, blink: m.flash, press: m.press, t: T });
  // 140.30 选中「攻击」：叮！
  const dk = seg(T, B03 - 0.98, B03 - 0.86);
  if (dk > 0 && T < B03 - 0.2 && menu) {
    const bt = menu.buttons[0];
    const a = 1 - seg(T, B03 - 0.45, B03 - 0.25);
    glyphRow(lg, ['叮', '！'], bt.x + bt.w + 6, bt.y - 62 - 18 * outCubic(seg(T, B03 - 0.98, B03 - 0.3)), 58, {
      style: 'cut', fill: PAL.gold, under: PAL.goldDark, align: 'center', alpha: a,
      appear: [dk * 1.2, (dk - 0.25) * 1.3], perChar: (i) => ({ rot: (i ? 0.12 : -0.08) }),
    });
    glyphIcon(lg, 'sparkle4', bt.x + bt.w + 74, bt.y - 96, 30 * outBack(dk, 2.4), { alpha: a });
    glyphIcon(lg, 'sparkle4', bt.x + bt.w - 52, bt.y - 92, 20 * outBack(clamp(dk * 1.4 - 0.3), 2.4), { alpha: a });
  }
  // 141.80 暴击「-999」
  const dnp = (T - (B04 + 0.06)) / 1.25;
  if (dnp > 0 && dnp < 1 && dragA) damageNumber(lg, { text: '-999', x: dragA.head[0] - 300, y: 430, size: 120, p: dnp, label: TXT.crit, rise: 70 });
  // 149.50 黑缝上炸出「嗷呜！」
  const ak = seg(T, B07 + 0.15, B07 + 0.3);
  if (ak > 0 && T < T_END - 0.3) {
    const out = seg(T, B07 + 0.47, B07 + 0.64);
    const cy = 529;
    lg.save();
    lg.translate(960, cy); lg.scale(1 + 0.5 * outCubic(out), 1 + 0.5 * outCubic(out)); lg.translate(-960, -cy);
    glyphRow(lg, ['嗷', '呜', '！'], 960, cy, 100, {
      style: 'cut', align: 'center', alpha: 1 - out, gap: 6,
      appear: [0, 1, 2].map((i) => (T - (B07 + 0.15) - i * 0.05) / 0.12),
      perChar: (i) => ({ rot: [-0.1, 0.07, 0.14][i] + 0.04 * noise1(T * 18 + i * 3, 4), dy: 4 * noise1(T * 22 + i, 7) }),
    });
    lg.restore();
  }
  void dp;
}
