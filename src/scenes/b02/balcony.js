// b02 私有：阳台上的戏——公主（和平→惊吓→被扣进鸟笼）、青鸟、水壶、小皇冠、鸟笼与龙爪。
// 9.50–10.20 公主直接用 b01 的 castleOpts(T)（交接逐像素一致）；10.20 起接手，次级运动的时间从 b01 的保持时刻继续走。
// 纯函数：只由 T 决定。
import { PAL, blob, cut, glow, sparkle } from '../../core/paper.js';
import { applyCam } from '../../core/camera.js';
import { clamp, lerp, seg, hit, wobble, TAU, rgba } from '../../core/util.js';
import { ez, outBack, outCubic, inQuad, inOutSine, glide, smooth } from '../../core/ease.js';
import { burst } from '../../core/particles.js';
import { drawPrincess, drawWateringCan } from '../../rigs/princess.js';
import { drawTiara } from '../../props/royal.js';
import { drawCage } from '../../props/cave.js';
import { drawDragonClaw } from '../../rigs/dragon.js';
import { dustDraw } from '../../props/misc.js';
import { CASTLE } from '../../env/castle.js';
import { PRINCESS, drawBalconyPrincess } from '../b01/shared.js';
import { TM } from './shared.js';

const FLOOR = CASTLE.balcony.floorY;          // 590
const RAIL = CASTLE.balcony.railY;            // 560（扶手顶 556）
export const PS = PRINCESS.s;                 // 0.26
export const CAGE_S = PS / 0.78;              // 鸟笼缩放：公主在笼里的比例与龙洞一致（CAVE.cage.princessS 0.78）
export const CAGE_X = 976;                    // 鸟笼落点 = 公主挥手后站的位置
const CAGE_Y = FLOOR - 120 * CAGE_S;          // 笼心（底座下沿贴地板）
const CAGE_FLOOR = CAGE_Y + 98 * CAGE_S;      // 笼底（公主脚底）
export const TIARA_REST = [1031, RAIL - 4.5]; // 小皇冠最后停在扶手顶上（右段两根栏杆之间，灯笼左边）

// ———————————————————— 公主 ————————————————————
const tLive = (T) => PRINCESS.hold + Math.max(0, T - TM.waterPrep);   // 次级运动从 b01 定格处继续

/** 公主脚底 x：浇花站在 948（b01 站位）→ 挥手时碎步挪到 976。 */
export function princessX(T) {
  return lerp(PRINCESS.x, CAGE_X, inOutSine(seg(T, TM.wave + 0.03, TM.wave + 0.42)));
}

/** 公主参数（T ≥ 10.20）。返回 drawPrincess 的 o（含 x / y）。 */
export function princessAt(T) {
  const t = tLive(T);
  const x = princessX(T);
  const o = { x, y: FLOOR, s: PS, t, face: PRINCESS.face, item: 'can', pour: 0, expr: 'smile', joints: {} };
  const holdLook = PRINCESS.look;
  if (T < TM.turn) {
    // 10.20 低头看花、抬壶（预备）→ 10.39 出水（重音）→ 11.25 收壶
    const kPrep = ez(T, TM.waterPrep, TM.L01, inOutSine);
    const kIn = ez(T, TM.L01, TM.L01 + 0.16, (u) => outBack(u, 1.6));
    const k = lerp(0, 0.55, kPrep) + 0.45 * kIn;
    const kOut = ez(T, TM.pourEnd, TM.turn, inOutSine);
    o.pose = { from: 'idle', to: 'water', k: k * (1 - 0.5 * kOut) };
    o.pour = 0.85 * outCubic(seg(T, TM.L01, TM.L01 + 0.14)) * (1 - kOut) + 0.08 * Math.sin(T * 7) * seg(T, TM.L01 + 0.2, TM.L01 + 0.4) * (1 - kOut);
    const lk = smooth(seg(T, TM.waterPrep - 0.05, TM.L01 - 0.05));
    o.look = [lerp(holdLook[0], 0.5, lk), lerp(holdLook[1], 0.55, lk)];
    o.joints = { head: lerp(PRINCESS.head, 9, lk) + 2 * Math.sin(T * 2.4) * kIn, armR: 34 * k };
    o.expr = T < TM.L01 + 0.05 ? 'smile' : { eyes: 'happy', mouth: 'smile' };
    // 青鸟落下时抬眼一瞟（11.00–11.20）
    const peek = Math.sin(Math.PI * seg(T, TM.birdLand + 0.08, TM.birdLand + 0.42));
    if (peek > 0) { o.look = [lerp(o.look[0], -0.2, peek), lerp(o.look[1], -0.9, peek)]; o.expr = peek > 0.3 ? { eyes: 'wide', mouth: 'smile', brows: 'up' } : o.expr; }
    return o;
  }
  // 11.36 转身朝城下（turn 0→0.5 翻面）
  if (T < TM.wave + 0.04) {
    const u = seg(T, TM.turn, TM.wave + 0.04);
    o.turn = 0.5 * inOutSine(u);
    o.pose = { from: 'idle', to: 'wave', k: u };
    o.pour = 0;
    o.squash = -0.06 * Math.sin(Math.PI * u);
    o.expr = 'laugh';
    return o;
  }
  o.face = 1;
  o.joints = {};
  const tLook = TM.look;
  if (T < TM.look - 0.08) {
    // 11.40 挥手（提着水壶挥，洒出一点水）+ 碎步挪到中间
    o.pose = 'wave';
    o.pour = 0.28;
    o.expr = T < TM.L02 + 0.08 ? 'laugh' : { eyes: 'wide', mouth: 'smile', brows: 'up' };   // 龙影掠过：笑容僵住（先想后动）
    const stepK = seg(T, TM.wave + 0.03, TM.wave + 0.42);
    o.joints = { step: stepK * 1.6, lean: 3 * Math.sin(Math.PI * stepK) };
    o.squash = 0.04 * hit(T, TM.wave + 0.04, 0.12);
    return o;
  }
  // 12.27 起：抬头（12.35 重音）→ 12.45 水壶脱手 → 一直仰望（发抖）
  const kUp = ez(T, tLook - 0.08, tLook + 0.06, (u) => outBack(u, 1.8));
  o.pose = { from: 'wave', to: 'lookUp', k: kUp };
  o.item = T < TM.canDrop ? 'can' : null;
  o.pour = 0;
  o.expr = 'shock';
  o.look = [0.35, -1];
  o.sweat = seg(T, TM.tear, TM.tear + 0.4);
  o.joints = { head: -6 * kUp + 1.6 * Math.sin(T * 41) * seg(T, TM.roar, TM.roar + 0.1) };
  o.squash = -0.12 * hit(T, TM.roar, 0.18);
  // 15.30 鸟笼砸下前：仰头看正上方，缩脖子
  const kTop = seg(T, TM.cageFall - 0.06, TM.slam - 0.02);
  if (kTop > 0) { o.look = [0, -1]; o.joints.head -= 10 * kTop; o.squash += -0.08 * kTop; }
  if (T >= TM.slam) {
    o.y = CAGE_FLOOR;                                         // 被笼底“铲”起来
    o.squash = -0.22 * hit(T, TM.slam, 0.09) + 0.1 * wobble(T, TM.slam + 0.05, 5, 0.12);
    o.tiara = T < TM.tiaraOff;
    o.joints.head += 8 * hit(T, TM.tiaraOff, 0.12);            // 小皇冠被磕飞：头一歪
    const kC = ez(T, TM.eyeroll - 0.02, TM.eyeroll + 0.14, (u) => outBack(u, 1.5));
    if (kC > 0) { o.pose = { from: 'lookUp', to: 'caged', k: kC }; o.look = [0, 0]; o.joints.head = lerp(o.joints.head, 0, kC); }
    o.expr = T < TM.eyeroll - 0.08 ? 'shock' : 'eyeroll';      // 先翻白眼、再抱臂
    o.sweat = 0;
  }
  return o;
}

// ———————————————————— 青鸟 ————————————————————
/** 小纸鸟（侧面，朝 face 方向）：身体 + 翅膀（flap -1..1）+ 尾 + 喙 + 眼。col = [身, 腹, 翅]。 */
export function paperBird(g, x, y, s, o = {}) {
  const { face = 1, flap = 0, col = [PAL.roof, PAL.skyDayLow, PAL.heroBlue], rot = 0, perch = 0 } = o;
  g.save();
  g.translate(x, y); g.rotate(rot); g.scale(s * face, s);
  // 尾
  cut(g, blob(-15, 1, 9, 3.6, { seed: 41, amp: 0.05, rot: 0.25 }), col[2]);
  // 身
  cut(g, blob(0, 0, 13, 9, { seed: 42, amp: 0.03 }), col[0], { rim: rgba(PAL.white, 0.7), rimW: 1.2 });
  cut(g, blob(3, 3.5, 8.5, 4.6, { seed: 43, amp: 0.04 }), col[1]);
  // 头
  cut(g, blob(10, -6, 6.4, 6, { seed: 44, amp: 0.03 }), col[0]);
  // 喙
  g.fillStyle = PAL.gold;
  g.beginPath(); g.moveTo(15.6, -7); g.lineTo(21, -5); g.lineTo(15.6, -3.4); g.closePath(); g.fill();
  // 眼
  g.fillStyle = PAL.ink; g.beginPath(); g.arc(11.5, -7, 1.5, 0, TAU); g.fill();
  g.fillStyle = PAL.white; g.beginPath(); g.arc(11.1, -7.5, 0.55, 0, TAU); g.fill();
  // 翅（折起时贴身，扇动时绕肩转）
  const a = perch ? 0.15 : -0.35 + flap * 0.95;
  g.save(); g.translate(-1, -3); g.rotate(a);
  g.scale(1, perch ? 0.55 : 1);
  cut(g, blob(-6, -5, 10, 5.2, { seed: 45, amp: 0.05, rot: -0.35 }), col[2], { rim: rgba(PAL.white, 0.6), rimW: 1 });
  g.restore();
  // 脚（停着时）
  if (perch) { g.strokeStyle = PAL.goldDark; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-1, 8); g.lineTo(-2, 12); g.moveTo(3, 8); g.lineTo(3, 12); g.stroke(); }
  g.restore();
}

const BIRD_FROM = [1110, 452];          // 从 7 号塔锥顶旁飞来
/** 青鸟：10.55 飞来 → 10.90 落在小皇冠上 → 12.30 被龙影惊起 → 往左上飞走。target = 小皇冠尖（世界）。 */
function drawBluebird(g, T, target) {
  if (T < TM.birdLand - 0.42 || T > TM.look + 0.75 || !target) return;
  const s = 0.62;
  const flee0 = TM.L02 + 0.2;
  let x, y, face = -1, flap = 0, perch = 0, rot = 0;
  if (T < TM.birdLand) {
    const u = seg(T, TM.birdLand - 0.42, TM.birdLand);
    const e = inOutSine(u);
    x = lerp(BIRD_FROM[0], target[0] + 2, e);
    y = lerp(BIRD_FROM[1], target[1] - 7, e) - 26 * Math.sin(Math.PI * e);
    flap = Math.sin(T * 38);
    rot = -0.15 + 0.3 * u;
  } else if (T < flee0) {
    x = target[0] + 2; y = target[1] - 7;
    const land = hit(T, TM.birdLand, 0.1);
    y += 2.5 * land;
    perch = 1;
    // 停着：小跳、歪头
    const hop = Math.max(0, Math.sin(TAU * (T - TM.birdLand) * 0.9)) ** 8;
    y -= 3 * hop;
    rot = 0.08 * Math.sin(T * 3.1);
    if (T > TM.wave) face = 1;   // 公主转身后鸟也转向
  } else {
    const u = (T - flee0);
    x = target[0] + 2 - 150 * u - 120 * u * u;
    y = target[1] - 7 - 90 * u - 260 * u * u;
    flap = Math.sin(T * 52);
    face = -1; rot = -0.5;
  }
  paperBird(g, x, y, s, { face, flap, perch, rot });
}

// ———————————————————— 水壶掉落 ————————————————————
function drawDroppedCan(g, T, from) {
  if (T < TM.canDrop || !from) return;
  const u = T - TM.canDrop;
  const s = 0.9 * PS;
  const landY = FLOOR - 12;
  const fallT = 0.17;
  let y, rot;
  if (u < fallT) { y = lerp(from[1], landY, (u / fallT) ** 2); rot = 1.2 * u / fallT; }
  else {
    const b = u - fallT;
    y = landY - 7 * Math.max(0, Math.sin(Math.PI * Math.min(1, b / 0.16))) * Math.exp(-b * 4);
    rot = 1.2 + 0.35 * Math.min(1, b / 0.16);
  }
  const x = from[0] - 10 * Math.min(1, u / 0.3);
  drawWateringCan(g, { x, y, s, rot: -rot, pour: 0, t: T, F: 1 });
}

// ———————————————————— 小皇冠 ————————————————————
const TIARA_FROM = [CAGE_X + 3, CAGE_FLOOR - 286 * PS];   // 戴在头上时的位置（公主笼里的头顶）
/** 小皇冠：15.50 被磕飞 → 打旋 → 16.10 落在扶手上弹一下、闪光 → 一直留在那里（直到国王拿走）。 */
export function tiaraState(T) {
  if (T < TM.tiaraOff) return null;
  const land = TM.lift;
  if (T < land) {
    const u = seg(T, TM.tiaraOff, land);
    const x = lerp(TIARA_FROM[0], TIARA_REST[0], outCubic(u));
    const y = lerp(TIARA_FROM[1], TIARA_REST[1], u * u) - 46 * Math.sin(Math.PI * Math.min(1, u * 1.15));
    return { x, y, rot: -0.4 + 7.5 * u, spin: 9 * u, glint: 0 };
  }
  const b = T - land;
  const bounce = 6 * Math.abs(Math.sin(Math.PI * Math.min(2, b / 0.13))) * Math.exp(-b * 9);
  const rock = 0.35 * wobble(T, land, 4.2, 0.22);
  const glint = Math.max(hit(T, land + 0.02, 0.25), 0.55 * Math.max(0, Math.sin((T - land) * 2.1)) ** 12);
  return { x: TIARA_REST[0], y: TIARA_REST[1] - bounce, rot: rock, spin: 0, glint };
}
export function drawRestingTiara(g, T, st) {
  if (!st) return;
  drawTiara(g, { x: st.x, y: st.y, s: PS, rot: st.rot, spin: st.spin, glint: st.glint, t: T });
  if (st.glint > 0.3) sparkle(g, st.x + 3, st.y - 8, 14 * st.glint, { color: PAL.white, alpha: st.glint });
}

// ———————————————————— 鸟笼与龙爪 ————————————————————
/** 鸟笼状态：下坠 → 扣下（挤压）→ 被勾起提走。返回 { x, y（笼心）, squash, swing, onBalcony }。 */
export function cageState(T) {
  if (T < TM.cageFall) return null;
  if (T < TM.slam) {
    const u = seg(T, TM.cageFall, TM.slam);
    return { x: CAGE_X, y: lerp(CAGE_Y - 330, CAGE_Y, inQuad(u)), squash: -0.12 * u, swing: 0, balcony: true, falling: u };
  }
  const sq = 0.32 * hit(T, TM.slam, 0.06) * Math.cos(Math.min(Math.PI, (T - TM.slam) * 30)) + 0.12 * wobble(T, TM.slam + 0.08, 6, 0.1);
  if (T < TM.lift) return { x: CAGE_X, y: CAGE_Y, squash: sq, swing: 0.05 * wobble(T, TM.hook, 4, 0.2), balcony: true };
  const u = T - TM.lift;
  const up = 1250 * u * u + 40 * u;
  const dx = 260 * u * u;
  const swing = -0.25 * Math.sin(Math.min(Math.PI, u * 9)) * Math.exp(-u * 2);
  return { x: CAGE_X + dx, y: CAGE_Y - up, squash: -0.12 * Math.min(1, u * 6) * Math.exp(-u * 6), swing, balcony: CAGE_Y - up + 40 * CAGE_S > RAIL - 8 && u < 0.2 };
}

/** 画笼（back）→ 笼里的公主 → 笼（front），整体绕吊环顶转 swing。 */
export function drawCageWithPrincess(g, T, st, P) {
  const s = CAGE_S;
  const ring = [st.x, st.y - 135 * s];
  g.save();
  g.translate(ring[0], ring[1]); g.rotate(st.swing); g.translate(-ring[0], -ring[1]);
  const o = { x: st.x, y: st.y, s, squash: st.squash, tally: 0, lock: { pins: 0 } };
  drawCage(g, { ...o, part: 'back' });
  if (P) {
    // 公主跟着笼底走（笼被挤压时一起压）
    const dy = st.y - CAGE_Y;
    drawPrincess(g, { ...P, x: P.x + (st.x - CAGE_X), y: P.y + dy + st.squash * 120 * s * 0.5 });
  }
  drawCage(g, { ...o, part: 'front' });
  g.restore();
  return ring;
}

const CLAW_ROT = -38;
/** 15.95 龙爪从右上探入 → 16.05 勾住笼环 → 16.10 起把笼子提走。ring = 当前吊环顶（世界）。 */
export function drawClaw(g, T, ring) {
  if (T < TM.claw || T > TM.lift + 0.45 || !ring) return;
  const s = CAGE_S * 1.05;
  const grip = lerp(0.15, 1, ez(T, TM.hook - 0.05, TM.hook + 0.03, outCubic));
  // 先在原点算一次勾尖偏移（alpha 0 只取锚点）
  const ref = drawDragonClaw(g, { x: 0, y: 0, s, rot: CLAW_ROT, grip, t: T, alpha: 0 });
  const off = [ref.hook[0], ref.hook[1]];
  let hx = ring[0], hy = ring[1] + 1;
  if (T < TM.hook) {
    const u = ez(T, TM.claw, TM.hook, outCubic);
    hx += lerp(230, 0, u); hy += lerp(-300, 0, u);
  }
  drawDragonClaw(g, { x: hx - off[0], y: hy - off[1], s, rot: CLAW_ROT + 6 * hit(T, TM.hook, 0.15), grip, t: T });
}

// ———————————————————— onBalcony（主体层世界坐标，门前、栏杆后） ————————————————————
/** 9.50–16.20 阳台上的人与物。返回需要画在栏杆前的东西的锚点。 */
export function balconyScene(g, T, a) {
  const out = {};
  if (T < TM.waterPrep) {                       // 交接段：与 b01 同一个函数、同一参数
    out.princess = drawBalconyPrincess(g, T, a);
    return out;
  }
  const P = princessAt(T);
  const cs = cageState(T);
  if (cs && cs.balcony) {
    out.ring = drawCageWithPrincess(g, T, cs, T >= TM.slam ? P : null);
    if (T < TM.slam) out.princess = drawPrincess(g, P);
  } else if (!cs) {
    out.princess = drawPrincess(g, P);
  }
  if (out.princess) {
    drawBluebird(g, T, out.princess.tiaraTop);
    out.hand = out.princess.handR;
  }
  if (T >= TM.canDrop && T < TM.snap0) drawDroppedCan(g, T, CAN_FROM);
  return out;
}
const CAN_FROM = [990, 566];     // 12.45 脱手时壶的握点（抬头姿势的右手附近）

/** 鸟笼扣下的扬灰（画在栏杆前）。 */
export function slamDust(g, T) {
  if (T < TM.slam || T > TM.slam + 0.9) return;
  for (const side of [-1, 1]) {
    burst(g, T, { at: TM.slam, seed: side > 0 ? 61 : 62, count: 14, x: CAGE_X + side * 24, y: FLOOR - 4, spread: 6,
      speed: [60, 190], angle: side > 0 ? [-0.9, -0.05] : [Math.PI + 0.05, Math.PI + 0.9], gravity: -40, drag: 3.2, life: [0.45, 0.85], size: [4, 9] }, dustDraw);
  }
}

export { applyCam, FLOOR, RAIL, CAGE_Y };
