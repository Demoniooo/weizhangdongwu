// b09 私有：山洞整帧（布景分层 + 角色 + 巨眼 + 界面）与全部时序状态。
// 所有镜头调用同一个 drawFrame(g, T, ctx)，机位 camAt(T) 是一条连续曲线，镜头之间不会跳。
// 时刻一律 cue + 偏移；名字逐字时刻取 NAME_TIMES。纯函数：画面只由 T 决定（无跨帧状态）。
// 图层（每帧 ≤ 7）：后壁 / 金币堆+水晶柱 / 地面（+龙窝暗影）/ 巨龙 / 鸟笼+公主+勇者 / 前景虚化 / 界面。
import { cue, NAMES } from '../../cues.js';
import { PAL, glow, sparkle, blob, rad } from '../../core/paper.js';
import { clamp, lerp, seg, smoothstep, wobble, hit, hash2, rgba, mixHex, TAU } from '../../core/util.js';
import { ez, glide, outExpo, outBack, outCubic, inOutCubic, inOutSine, inCubic } from '../../core/ease.js';
import { cam, applyCam, toScreen, lerpCam, drift } from '../../core/camera.js';
import { burst, stream } from '../../core/particles.js';
import { drawCave, CAMS, CAVE, groundAt } from '../../env/cave.js';
import { drawCage } from '../../props/cave.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawPrincess } from '../../rigs/princess.js';
import { drawDragon } from '../../rigs/dragon.js';
import { bubble, vsBadge, enemyPlate } from '../../ui/kit.js';
import { NAME_TIMES, paperGlyph, glyph13 } from '../../ui/type.js';
import { impact } from '../../fx/transitions.js';
import { journeyCam } from '../../env/journey.js';
import { giantEye, darkFill } from './eye.js';

// ———————————————————— 时刻（cue + 偏移） ————————————————————
const at = (id, d = 0) => +(cue(id) + d).toFixed(4);
export const TT = {
  start: at('V13', 0.56),     // 98.60 入场（b08 重叠起点）
  full: at('V13', 1.56),      // 99.60 遮罩盖满
  V14: at('V14'), V15: at('V15'), V16: at('V16'), D1a: at('D1a'), D1b: at('D1b'),
  end: at('Q1'),              // 109.15
};
const V14 = TT.V14, V15 = TT.V15, V16 = TT.V16, D1A = TT.D1a;
const PLATE_T = [...NAME_TIMES('D1a'), ...NAME_TIMES('D1b')];
const FLICK = PLATE_T[12];                    // 「松」= 尾尖一甩「叮」
const GLINT_AT = V14 - 0.12;                  // 离鸟笼最近那簇（w4）在 V14 前后点亮
const GLINT_C = [1470, 455];
// 表演节点
const T_SEE = V14 + 0.63;                     // 100.60 公主看见勇者、挥手
const T_POINT = V14 + 0.98;                   // 100.95 指向他身后
const T_BUB = V14 + 1.08;                     // 101.05「后面！」
const T_EYE1 = V14 + 1.23, T_EYE2 = V14 + 1.38;   // 101.20 / 101.35 巨眼睁开
const T_HEAD = V14 + 1.63;                    // 101.60 慢慢回头

// ———————————————————— 机位 ————————————————————
const K = {
  dark: cam(1000, 592, 1.0),                  // 勇者小小在左下屏幕 (380,860)
  cage: cam(1240, 380, 1.8),                  // 鸟笼特写
  twoS: cam(900, 572, 1.15),                  // 双人：勇者左下、公主右上、右边一片黑
  wide: CAMS.CV_W,
  cud: cam(1132, 500, 2.3),                   // CU-D 稍低稍松：鼓起的脖子与胸口留在画里
  d1a: cam(1300, 500, 0.9),
  d1b: cam(1950, 560, 0.9),
};
/** 阅读式横摇：两端各 e 秒加 / 减速，中段匀速。 */
function panK(T, a, b, e = 0.45) {
  const L = b - a, v = 1 / (L - e);
  const u = clamp(T, a, b) - a;
  if (u < e) return (v * u * u) / (2 * e);
  if (u > L - e) { const r = L - u; return 1 - (v * r * r) / (2 * e); }
  return v * (u - e / 2);
}
export function camBase(T) {
  if (T < V14 + 0.23) return lerpCam(K.dark, cam(990, 586, 1.03), seg(T, TT.full, V14 + 0.23));
  if (T < V14 + 0.93) return lerpCam(cam(990, 586, 1.03), K.cage, ez(T, V14 + 0.23, V14 + 0.93, glide));
  if (T < V14 + 1.03) return lerpCam(K.cage, cam(1236, 382, 1.82), seg(T, V14 + 0.93, V14 + 1.03));
  if (T < V14 + 1.43) return lerpCam(cam(1236, 382, 1.82), K.twoS, ez(T, V14 + 1.03, V14 + 1.43, glide));
  if (T < V15) return lerpCam(K.twoS, cam(905, 574, 1.17), seg(T, V14 + 1.43, V15));
  if (T < V15 + 0.5) return lerpCam(cam(905, 574, 1.17), K.wide, ez(T, V15, V15 + 0.5, glide));
  if (T < V16) return lerpCam(K.wide, cam(975, 532, 1.03), seg(T, V15 + 0.5, V16));
  if (T < V16 + 0.39) return lerpCam(cam(975, 532, 1.03), K.cud, ez(T, V16, V16 + 0.39, outExpo));
  if (T < D1A) return lerpCam(K.cud, cam(1126, 496, 2.36), seg(T, V16 + 0.39, D1A));
  if (T < D1A + 0.54) return lerpCam(cam(1126, 496, 2.36), K.d1a, ez(T, D1A, D1A + 0.54, glide));
  return lerpCam(K.d1a, K.d1b, panK(T, D1A + 0.54, FLICK));
}
export function camAt(T) {
  const c = camBase(T);
  const [dx, dy] = drift(T, { amp: 5, speed: 0.35, seed: 9 });
  return cam(c.x + dx / c.zoom, c.y + dy / c.zoom, c.zoom, c.rot);
}

// ———————————————————— 光照 ————————————————————
const GL = { glintAt: GLINT_AT, glintC: GLINT_C, glintSpeed: 1100 };
function caveLight(T) {
  if (T < GLINT_AT + 0.05) return { light: { from: 'dark', to: 'glint', k: seg(T, GLINT_AT - 0.08, GLINT_AT + 0.05) }, ...GL };
  if (T < V15) return { light: 'glint', ...GL };
  const k = ez(T, V15, V15 + 0.5, inOutSine);
  if (k >= 1) return { light: 'lit' };
  return { light: { from: 'glint', to: 'lit', k }, ...GL };
}
/** 龙所在的右半边：V15 前压在暗里（巨眼睁开的地方“一片黑”）。 */
const lairDark = (T) => (T < V15 ? 1 : 1 - ez(T, V15, V15 + 0.42, inOutSine));
/** 角色的局部亮度（1 = 不压暗）。 */
const heroLight = (T) => (T < V15 ? lerp(0.1, 0.55, smoothstep(V14 + 0.55, V14 + 1.0, T)) : lerp(0.55, 1, ez(T, V15, V15 + 0.5)));
const cageLight = (T) => (T < V15 ? lerp(0.12, 0.74, smoothstep(V14 - 0.06, V14 + 0.3, T)) : lerp(0.74, 1, ez(T, V15, V15 + 0.5)));

// ———————————————————— 勇者 ————————————————————
const HERO_X = CAVE.hero.x, HERO_Y = groundAt(CAVE.hero.x);
// 与 b08 末尾一致的伤痕 / 围巾状态（heroJourneyState：创可贴剩 1、肿包、焦发、破袖、剑刃崩口、围巾缺口 + 破洞 + 金边）
const HERO_BASE = { injury: { bandages: 1, bump: true, singed: true, torn: true }, chip: true, soot: 0.12 };
const lerp3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
function heroState(T) {
  const o = { x: HERO_X, y: HERO_Y, s: 1, t: T, face: 1, ...HERO_BASE };
  const scarf = { notch: true, hole: true, glow: 0.6, len: 936, vel: [0, 0] };
  const tTurnL0 = V14 + 0.66, tTurnL1 = V14 + 0.88;          // 镜头摇开时转身，看左边墙上刚亮的水晶
  const tHead1 = T_HEAD + 0.3;
  const tWhirl0 = V15 - 0.14, tWhirl1 = V15 - 0.02;          // 转回来，握剑（重音 V15）
  const POINT_AF = [112, 4, 0];
  if (T < tTurnL0) {
    // 暗里：朝右站着，呼吸；左右张望；V14 后抬头望向亮起来的光
    const up = smoothstep(V14 + 0.02, V14 + 0.3, T);
    const peek = Math.sin(clamp((T - (TT.full + 0.05)) / 0.3) * Math.PI);   // 99.65–99.95 回头张望一下
    o.pose = 'idle';
    o.yaw = 1 - 1.3 * peek * (1 - up);
    o.jointsAdd = { nod: -3 - 11 * up, lean: -2 * up };
    o.expr = T < V14 + 0.04 ? 'worried' : 'normal';
    o.sweat = T < V14 ? 0.35 : 0;
  } else if (T < tTurnL1) {
    // 转身朝左：face 1 时 turn 0→1（turn=1 ≡ 朝左），围巾拖尾方向连续换边
    const k = inOutCubic(seg(T, tTurnL0, tTurnL1));
    o.face = 1; o.turn = k;
    o.pose = 'idle'; o.expr = 'normal';
    o.jointsAdd = { nod: -12 };
    scarf.back = -Math.cos(Math.PI * k);
  } else if (T < tWhirl0) {
    o.face = -1;
    if (T < T_HEAD) {
      // 指着墙上的水晶“哇”，背对黑暗
      const kp = outBack(seg(T, tTurnL1, tTurnL1 + 0.22), 1.6);
      o.pose = 'idle';
      o.joints = { aF: lerp3([-8, 16, 0], POINT_AF, kp), hF: kp > 0.4 ? 'point' : 'mitt' };
      o.jointsAdd = { nod: -16, lean: -4 };
      o.expr = 'normal';
      o.ahogeAt = tTurnL1 + 0.05;
    } else if (T < tHead1) {
      // 吱呀——慢慢回头（手放下、出汗）
      const kh = inOutSine(seg(T, T_HEAD, tHead1));
      o.pose = { from: 'idle', to: 'turnHead', k: kh };
      o.yaw = lerp(1, -0.65, kh);
      o.joints = { aF: lerp3(POINT_AF, [-4, 3, 0], smoothstep(0, 0.7, kh)), hF: kh < 0.4 ? 'point' : 'open' };
      o.jointsAdd = { nod: -16 * (1 - kh) };
      o.expr = kh < 0.25 ? 'normal' : 'worried';
      o.sweat = kh;
    } else {
      o.pose = 'freeze'; o.yaw = -0.65; o.expr = 'shock'; o.sweat = 1;
      o.ahoge = 'straight';
    }
  } else if (T < tWhirl1) {
    const k = inOutCubic(seg(T, tWhirl0, tWhirl1));
    o.face = -1; o.turn = k;
    o.pose = { from: 'freeze', to: 'gripHilt', k };
    o.expr = 'determined';
    scarf.back = Math.cos(Math.PI * k);
  } else {
    o.face = 1;
    const kd = ez(T, V15 + 0.3, V15 + 0.7, outExpo);
    const ks = ez(T, V15 + 1.1, V15 + 1.4, inOutCubic);
    if (T < V15 + 0.3) { o.pose = 'gripHilt'; o.squash = -0.05 * wobble(T, V15, 3, 0.18); }
    else if (ks <= 0) { o.pose = 'draw'; o.act = kd; }
    else { o.pose = { from: 'draw', to: 'stance', k: ks }; o.act = 1; }
    o.expr = 'determined';
    o.swordGlint = ez(T, V15 + 0.75, V15 + 1.15, inOutSine) * (1 - seg(T, V15 + 1.25, V15 + 1.4));
    o.ahogeAt = V15 + 0.32;
    if (T > V16 - 0.2) o.sweat = 0.4 + 0.6 * smoothstep(D1A, D1A + 1, T);
    if (T > D1A - 0.06) o.expr = 'shock';
  }
  o.scarf = scarf;
  // 转身 + 拔剑：上升气流把围巾前半段托成一道弧（在默认拖地形上叠一个隆起，再落回身后）
  const lift = smoothstep(tWhirl0, V15 + 0.38, T) * (1 - smoothstep(V15 + 0.95, V15 + 1.75, T));
  if (lift > 0.002) {
    const base = heroRig(o).scarf;
    const [r0x, r0y] = base[0];
    const dir = -(o.face) * (o.turn ? Math.cos(Math.PI * o.turn) : 1);   // 身后方向（屏幕 x 符号）
    const n = base.length;
    scarf.trail = base.map(([bx, by], i) => {
      const u = i / (n - 1), tau = i * 0.035;
      const hump = Math.sin(Math.PI * Math.min(1, u * 1.7)) * (1 - 0.25 * u);
      const fl = Math.sin(T * 11 - i * 0.55) * 18 * u;
      return [bx - r0x + dir * 70 * u * lift, by - r0y - lift * (250 * hump + fl) - 150 * tau * tau];
    });
    scarf.lag = 0.035;
  }
  return o;
}

// ———————————————————— 公主 ————————————————————
function princessState(T) {
  const o = { x: CAVE.cage.floor[0] - 14, y: CAVE.cage.floor[1], s: CAVE.cage.princessS, face: -1, t: T };
  if (T < T_SEE - 0.08) { o.pose = 'pickLock'; o.expr = T < V14 - 0.2 ? 'focused' : 'eyeroll'; }
  else if (T < T_SEE + 0.03) { o.pose = { from: 'pickLock', to: 'wave', k: seg(T, T_SEE - 0.08, T_SEE + 0.03) }; o.expr = 'shock'; o.item = 'hairpin'; }
  else if (T < T_POINT - 0.08) { o.pose = 'wave'; o.expr = 'laugh'; o.item = 'hairpin'; }
  else if (T < T_POINT) { o.pose = { from: 'wave', to: 'pointBehind', k: seg(T, T_POINT - 0.08, T_POINT) }; o.expr = 'shock'; o.item = null; o.joints = { armR: -40 * seg(T, T_POINT - 0.08, T_POINT), head: 10 * seg(T, T_POINT - 0.08, T_POINT) }; }
  else if (T < V15 + 0.2) { o.pose = 'pointBehind'; o.expr = 'shock'; o.joints = { armR: -40 + 6 * Math.sin(T * 13), head: 10 }; }
  else if (T < V15 + 0.3) { o.pose = { from: 'pointBehind', to: 'caged', k: seg(T, V15 + 0.2, V15 + 0.3) }; o.expr = 'tense'; }
  else if (T < V16) { o.pose = 'caged'; o.expr = T < V15 + 0.85 ? 'tense' : 'smile'; }
  else { o.pose = 'caged'; o.expr = 'eyeroll'; }
  return o;
}
const cageSwing = (T) => 0.03 * wobble(T, T_SEE, 1.1, 0.9) + 0.05 * wobble(T, T_POINT, 1.2, 1.0) - 0.02 * wobble(T, V15 + 0.3, 1.0, 0.8);

// ———————————————————— 巨龙 ————————————————————
function dragonState(T) {
  if (T < V15) return null;
  const o = { t: T, seed: 3 };
  if (T < V15 + 0.3) {
    o.pose = 'coil';
    o.eyes = { state: 'normal', open: 1, pupil: 0.14, look: [-0.8, 0.3], glow: 1, blink: false };
  } else if (T < V15 + 1.5) {
    const k = ez(T, V15 + 0.3, V15 + 1.5, glide);
    o.pose = { from: 'coil', to: 'rise', k, stagger: 0.6 };
    o.eyes = { state: 'normal', open: 1, pupil: 0.14 + 0.12 * k, look: [-0.8 + 0.3 * k, 0.3], glow: 1 - 0.75 * k, blink: false };
  } else if (T < V16 - 0.07) {
    o.pose = 'rise';
    o.eyes = { state: 'smug', pupil: 0.26, look: [-0.55, 0.3], glow: 0.25 * (1 - seg(T, V15 + 1.5, V15 + 2)) };
    // 吸气前的预备：微微低头、鼻孔张开
    o.joints = { head: -4 * smoothstep(V16 - 0.4, V16 - 0.07, T) };
    o.nostril = smoothstep(V16 - 0.35, V16 - 0.07, T);
  } else if (T < D1A) {
    o.pose = 'rise';
    const cs = ez(T, V16 - 0.05, V16 + 0.13, outBack);
    const cough = wobble(T, V16 + 0.34, 5, 0.12) + wobble(T, V16 + 0.64, 5, 0.12);
    o.chestSwell = cs * (1 - 0.18 * (hit(T, V16 + 0.34, 0.12) + hit(T, V16 + 0.64, 0.12)));
    o.puff = 0.1 * cs;
    o.eyes = T < V16 + 0.94 ? { state: 'closed' } : { state: 'smug', pupil: 0.3, look: [-0.6, 0.2] };
    o.joints = { head: -4 + 12 * cs - 7 * cough };
    o.jaw = 0.4 * (hit(T, V16 + 0.33, 0.1) + hit(T, V16 + 0.63, 0.1));
    o.nostril = 1 - seg(T, V16, V16 + 0.3);
  } else {
    const k = ez(T, D1A, D1A + 0.34, glide);
    o.pose = k < 1 ? { from: 'rise', to: 'name', k } : 'name';
    o.chestSwell = 1 - ez(T, D1A, D1A + 0.4);
    o.puff = 0.1 * (1 - ez(T, D1A, D1A + 0.4));
    o.eyes = { state: 'smug', pupil: 0.3, look: [-0.5, 0.2] };
    o.joints = { head: 8 * (1 - k) };
    o.tailFlick = FLICK;
  }
  // 背板：亮起之前不刻字（熄灭时几乎看不见；盘卧时也不会倒着读），亮起的一刻字跟着光出来
  o.plates = PLATE_T.map((t0, i) => {
    const lit = T >= D1A ? clamp((T - t0) / 0.12) : 0;
    const p = { lit, pop: T >= D1A ? Math.max(0, Math.sin(clamp((T - t0) / 0.35) * Math.PI)) : 0 };
    if (lit <= 0) p.char = ' ';
    void i;
    return p;
  });
  return o;
}

// 巨眼：101.20 / 101.35 在勇者身后的黑暗里睁开，V15 时收拢回巨龙的真眼
const EYE1 = { x: 1150, y: 618, w: 452 };     // 世界坐标（depth 1）：CV-2S 下屏幕约 (1248,592)、520×360（= b08 洞口在 zoom 1 时的尺寸）
const EYE2 = { x: 1595, y: 598, w: 404 };
const eyeOpen = (T, t0) => (T < t0 ? 0 : outBack(seg(T, t0, t0 + 0.26), 1.4));

// ———————————————————— 小工具 ————————————————————
const texOff = (c, d) => { const z = 1 + (c.zoom - 1) * d; return [-(c.x - 960) * d * z, -(c.y - 540) * d * z]; };
function dimRegion(g, box, a) {
  if (a <= 0.003 || !box) return;
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = rgba(PAL.ink, clamp(a));
  g.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
  g.restore();
}
function bboxOf(pts, pad = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (!p) continue; x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}
const overlap = (a, b) => a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

// ———————————————————— D1 背板覆盖层 ————————————————————
// 已点亮的背板整块重画在龙身之前（龙身凹弯处会盖住背板下半，字读不全）。样式同 dragon.js 的背板：金边圆片 + 深色面 + 亮字。
function drawLitPlates(lg, T, DS, A) {
  if (!A || !A.plates) return;
  const chars = [...NAMES.dragon];
  const k = A.scale || 1;
  A.plates.forEach(([x, y, ang], i) => {
    const p = DS.plates[i];
    if (!p || p.lit <= 0 || i === 12) return; // 第 13 节是黑桃尾尖，由龙自己画
    const sc = k * (1 + 0.15 * (p.pop || 0));
    const a = clamp(p.lit * 3);
    lg.save();
    lg.globalAlpha *= a;
    glow(lg, x, y, 105 * sc, PAL.dragonEye, 0.45 * p.lit);
    lg.fillStyle = mixHex(PAL.gold, PAL.goldLight, p.lit * 0.8);
    lg.fill(blob(x, y, 50 * sc, 50 * sc, { seed: 40 + i, amp: 0.014, n: 36 }));
    lg.fillStyle = mixHex(PAL.dragonDeep, PAL.dragonDark, p.lit * 0.55);
    lg.fill(blob(x, y, 41 * sc, 41 * sc, { seed: 60 + i, amp: 0.012, n: 32 }));
    lg.restore();
    glyph13(lg, [chars[i]], [{ x, y, ang }], { size: 64 * sc, state: 'lit', appear: [a], pop: [p.pop || 0] });
  });
}

// ———————————————————— 鸟笼 + 笼中公主 ————————————————————
// 笼子分前后两次画（后排栏杆 → 公主 → 前排栏杆），公主跟笼子一起绕吊钩摆；吊链由 drawCave 的 main 层画。
function drawCageAndPrincess(lg, T, c, PS, swing) {
  const C = CAVE.cage;
  const common = { x: C.x, y: C.y, s: 1, swing, pivot: C.hook, chain: 0, lock: { pins: T < T_SEE ? 2 : 1 }, tally: 9, t: T };
  lg.save();
  applyCam(lg, c, 1);
  drawCage(lg, { ...common, part: 'back' });
  lg.save();
  lg.translate(C.hook[0], C.hook[1]);
  lg.rotate(swing);
  lg.translate(-C.hook[0], -C.hook[1]);
  drawPrincess(lg, PS);
  lg.restore();
  drawCage(lg, { ...common, part: 'front' });
  lg.restore();
}

// ———————————————————— 整帧 ————————————————————
/** o.overlay：99.60 起盖在最上面的“眼睛适应黑暗”层（= 交接遮罩终点色），透明度 0..1。 */
export function drawFrame(g, T, ctx, o = {}) {
  const c = camAt(T);
  const CL = caveLight(T);
  const swing = cageSwing(T);
  const lair = lairDark(T);
  // 1) 后壁
  ctx.layer(g, { shadow: 6, texture: 0.3, texOffset: texOff(c, 0.5) }, (lg) => drawCave(lg, T, c, { ...CL, layer: 'back' }));
  // 2) 金币堆 + 水晶柱
  ctx.layer(g, { shadow: 8, texture: 0.3, texOffset: texOff(c, 0.8) }, (lg) => drawCave(lg, T, c, { ...CL, layer: 'mid' }));
  // 3) 地面 + 吊链 + 龙窝的黑暗（multiply：有内容处压暗，透明处等于盖一层墨，对下面两层同样是压暗）
  //    V16 起鸟笼挂在龙身后（CU-D 时龙头完整、D1 时背板压在笼前）；之前挂在龙角前（公主不被龙角挡住）
  const PS = princessState(T);
  const cageBehind = T >= V16;
  ctx.layer(g, { shadow: 10, texture: 0.3, texOffset: texOff(c, 1) }, (lg) => {
    drawCave(lg, T, c, { ...CL, layer: 'main', cageSwing: swing });
    if (lair > 0.002) {
      const [lx, ly] = toScreen(c, 1, 1560, 690);
      lg.save();
      lg.globalCompositeOperation = 'multiply';
      lg.fillStyle = rad(lg, lx, ly, 0, 1150 * c.zoom, [[0, rgba(PAL.ink, 0.86 * lair)], [0.5, rgba(PAL.ink, 0.7 * lair)], [1, rgba(PAL.ink, 0)]]);
      lg.fillRect(-40, -40, 2000, 1160);
      lg.restore();
    }
    if (T < V15) drawEyeLight(lg, T, c);
    if (cageBehind) drawCageAndPrincess(lg, T, c, PS, swing);
  });
  // 4) 巨龙（V15 前藏在黑里；亮灯时从暗处显出来）
  const DS = dragonState(T);
  let A = null;
  if (DS) {
    const tint = 0.95 * (1 - ez(T, V15, V15 + 0.45, inOutSine));
    ctx.layer(g, { shadow: 10, texture: 0.3, texOffset: texOff(c, 1), tint: tint > 0.005 ? { color: PAL.ink, alpha: tint, mode: 'multiply' } : undefined }, (lg) => {
      applyCam(lg, c, 1);
      A = drawDragon(lg, DS);
    });
  }
  // 巨眼（屏幕坐标直接画；V15 收拢进真眼）
  drawGiantEyes(g, T, c, A);
  // 5) （鸟笼 + 公主）+ 亮起的背板 + 勇者（同一图层，按区域各自压暗）
  const HS = heroState(T);
  let heroA = null;
  ctx.layer(g, { shadow: 10, texture: 0.3, texOffset: texOff(c, 1) }, (lg) => {
    if (!cageBehind) drawCageAndPrincess(lg, T, c, PS, swing);
    // D1：亮起的背板整块压在身体前（龙身凹弯处的背板会被身体盖住下半，字读不全）
    if (A && T >= D1A) {
      lg.save();
      applyCam(lg, c, 1);
      drawLitPlates(lg, T, DS, A);
      lg.restore();
    }
    // 勇者
    lg.save();
    applyCam(lg, c, 1);
    heroA = drawHero(lg, HS);
    lg.restore();
    const hb = bboxOf([toScreen(c, 1, HS.x - 150, HS.y - 320), toScreen(c, 1, HS.x + 150, HS.y + 30), ...heroA.scarf.map(([x, y]) => toScreen(c, 1, x, y))], 30);
    dimRegion(lg, hb, 0.86 * (1 - heroLight(T)));
    // 暗里一圈冷色边光（只勾身体，不勾地上的围巾；水晶亮起后褪掉）
    const rimA = 1 - smoothstep(V14 + 0.3, V14 + 0.95, T);
    if (rimA > 0.01) {
      lg.save();
      lg.globalCompositeOperation = 'destination-over';
      lg.globalAlpha = rimA;
      applyCam(lg, c, 1);
      const rc = mixHex(PAL.crystal, PAL.white, 0.2);
      drawHero(lg, { ...HS, part: 'body', silhouette: true, silColor: rc, keepColor: [], edge: { color: rc, w: 6 } });
      lg.restore();
    }
  });
  // 6) 前景
  ctx.layer(g, { blur: 4 }, (lg) => drawCave(lg, T, c, { ...CL, layer: 'fg' }));
  // 粒子与光（屏幕空间）
  drawFx(g, T, c, A, heroA);
  // 7) 界面
  drawUI(g, T, ctx, c, A, PS);
  // 眼睛适应黑暗：交接遮罩的终点色褪掉
  if (o.overlay > 0) {
    const jc = journeyCam(T);
    const [cx, cy] = toScreen(jc, 1, 13000, 640);
    darkFill(g, cx, cy, 1300 * (jc.zoom / 3.2), o.overlay);
  }
  // 后期：山洞的暗角（颜色从默认暗红过渡到 dragonDeep，避免交接时角上跳色）
  const vk = smoothstep(TT.full, TT.full + 0.4, T);
  ctx.fx.vignette = Math.max(ctx.fx.vignette, lerp(0.42, 0.5, vk));
  ctx.fx.vignetteColor = mixHex(PAL.shadow, PAL.dragonDeep, vk);
  // VS 落地轻震
  impact(ctx, T, V15 + 1.45, 'S', { shake: 8, flash: 0 });
}

/** 巨眼的光落在地上（暖黄两团，V15 前）。 */
function drawEyeLight(g, T, c) {
  const o1 = eyeOpen(T, T_EYE1), o2 = eyeOpen(T, T_EYE2);
  if (o1 <= 0) return;
  for (const [E, op] of [[EYE1, o1], [EYE2, o2]]) {
    if (op <= 0) continue;
    const [sx, sy] = toScreen(c, 1, E.x, groundAt(E.x) + 6);
    g.save(); g.translate(sx, sy); g.scale(1, 0.16);
    glow(g, 0, 0, E.w * c.zoom * 0.75, PAL.dragonEye, 0.32 * clamp(op));
    g.restore();
  }
}

function drawGiantEyes(g, T, c, A) {
  if (T < T_EYE1 - 0.14 || T > V15 + 0.5) return;
  const o1 = eyeOpen(T, T_EYE1), o2 = eyeOpen(T, T_EYE2);
  const slit1 = smoothstep(T_EYE1 - 0.14, T_EYE1, T), slit2 = smoothstep(T_EYE2 - 0.1, T_EYE2, T);
  const conv = ez(T, V15, V15 + 0.34, inOutCubic);
  // 睁开后眨一下（活的），勇者回头时瞳孔眯成一条缝
  const blink = 1 - 0.9 * Math.max(0, Math.sin(clamp((T - (T_EYE2 + 0.16)) / 0.15) * Math.PI));
  const focus = smoothstep(T_HEAD, T_HEAD + 0.2, T);
  const look = [lerp(-0.45, -0.85, focus), lerp(0.1, 0.32, focus)];
  const pupil = lerp(0.32, 0.1, focus);
  const tgt = (i, E) => {
    const [sx, sy] = toScreen(c, 1, E.x, E.y);
    const w0 = E.w * c.zoom;
    if (!A || conv <= 0) return { x: sx, y: sy, w: w0 };
    const real = i === 0 ? A.eyeL : A.eyeR;
    const [rx, ry] = toScreen(c, 1, real[0], real[1]);
    const wR = 66 * c.zoom;
    return { x: lerp(sx, rx, conv), y: lerp(sy, ry, conv), w: w0 * Math.pow(wR / w0, conv) };
  };
  const a = 1 - smoothstep(0.6, 0.97, conv);
  const e1 = tgt(0, EYE1), e2 = tgt(1, EYE2);
  giantEye(g, { ...e2, open: o2 * blink, slit: slit2, look, pupil, glow: 1, alpha: a, t: T, brow: 1 - conv });
  giantEye(g, { ...e1, open: o1 * blink, slit: slit1, look, pupil, glow: 1, alpha: a, t: T, brow: 1 - conv });
}

function drawFx(g, T, c, A, heroA) {
  // 水滴：暗里零星落下的青色亮点
  if (T < V15 + 0.4) {
    stream(g, T, { start: TT.full - 1.2, end: V15 + 0.2, rate: 2.6, seed: 905, life: [0.9, 1.3], gravity: 900, drag: 0,
      emit: (tb, i) => { const [sx, sy] = toScreen(c, 0.9, 300 + hash2(906, i) * 1700, 120 + hash2(907, i) * 80); return { x: sx, y: sy, vx: 0, vy: 40 }; } },
    (gg, x, y, s) => {
      const a = Math.sin(Math.PI * s.p) * 0.85;
      gg.fillStyle = rgba(PAL.crystal, 0.55 * a);
      gg.beginPath(); gg.ellipse(x, y, 1.6, 5.5, 0, 0, TAU); gg.fill();
      sparkle(gg, x, y, 5 * a, { color: PAL.white, alpha: a * 0.7 });
    });
  }
  // V14：第一簇（w4，离鸟笼最近）亮起的一下：光斑 + 星 + 一圈光环
  if (T >= V14 - 0.05 && T < V14 + 0.8) {
    const [wx, wy] = toScreen(c, 0.5, GLINT_C[0], GLINT_C[1]);
    const k = hit(T, V14, 0.22);
    glow(g, wx, wy, 190 * c.zoom, PAL.crystal, 0.6 * k);
    sparkle(g, wx + 4, wy - 16 * c.zoom, 30 * k * c.zoom, { color: PAL.white, alpha: k, rot: 0.2 });
    const rp = clamp((T - V14) / 0.7);
    if (rp > 0 && rp < 1) {
      g.save(); g.strokeStyle = rgba(PAL.crystal, 0.5 * (1 - rp)); g.lineWidth = 3 * (1 - rp) + 1;
      g.beginPath(); g.ellipse(wx, wy, (40 + 320 * outCubic(rp)) * c.zoom, (26 + 200 * outCubic(rp)) * c.zoom, 0, 0, TAU); g.stroke(); g.restore();
    }
  }
  if (!heroA) return;
  // 勇者回头那一刻：脸上一抹巨眼的暖光
  if (T >= T_HEAD && T < V15 + 0.3) {
    const [hx, hy] = toScreen(c, 1, heroA.head[0], heroA.head[1]);
    glow(g, hx + 30 * c.zoom, hy, 120 * c.zoom, PAL.dragonEye, 0.22 * smoothstep(T_HEAD, T_HEAD + 0.3, T) * (1 - seg(T, V15, V15 + 0.3)));
  }
  // V15：握住剑柄“叮”的一点光
  if (T >= V15 && T < V15 + 0.4) {
    const [hx, hy] = toScreen(c, 1, heroA.hilt[0], heroA.hilt[1]);
    const k = hit(T, V15, 0.12);
    sparkle(g, hx, hy, 36 * k * c.zoom, { color: PAL.goldLight, alpha: k, rot: 0.4 });
  }
  // 拔剑：脚下一圈尘
  if (T >= V15 + 0.3 && T < V15 + 1.1) {
    const [fx, fy] = toScreen(c, 1, heroA.foot[0], heroA.foot[1]);
    burst(g, T, { at: V15 + 0.32, seed: 912, count: 14, x: fx, y: fy, spread: 30, speed: [120, 320], angle: [-3.0, -0.15], gravity: 600, life: [0.4, 0.75], size: [6, 14] }, (gg, x, y, s) => {
      gg.fillStyle = rgba(mixHex(PAL.dragonWing, PAL.stone2, 0.5), 0.5 * (1 - s.p));
      gg.fill(blob(x, y, s.size * (0.6 + s.p), s.size * 0.5 * (0.6 + s.p), { seed: s.i + 3 }));
    });
  }
  // 剑光跑到剑尖：一颗大四角星（剑光 = 星星）
  if (T >= V15 + 1.1 && T < V15 + 1.75) {
    const [tx, ty] = toScreen(c, 1, heroA.swordTip[0], heroA.swordTip[1]);
    const k = Math.sin(Math.PI * seg(T, V15 + 1.12, V15 + 1.7));
    sparkle(g, tx, ty, 60 * k * c.zoom, { color: PAL.white, alpha: k, rot: 0.15 * (T - V15) });
    sparkle(g, tx, ty, 30 * k * c.zoom, { color: PAL.goldLight, alpha: k, rot: 0.785 });
    glow(g, tx, ty, 120 * c.zoom, PAL.goldLight, 0.5 * k);
  }
  if (!A) return;
  // 巨龙解开盘绕：金币从堆上哗啦滑落
  if (T >= V15 + 0.5 && T < V15 + 2.2) {
    const [px, py] = toScreen(c, 0.8, 1640, 790);
    burst(g, T, { at: V15 + 0.55, seed: 921, count: 26, x: px, y: py, spread: 220 * c.zoom, speed: [80, 260], angle: [-2.6, -0.5], gravity: 1500, life: [0.6, 1.1], spin: [-10, 10], size: [8, 12] }, (gg, x, y, s) => {
      gg.save(); gg.translate(x, y); gg.scale(Math.cos(s.rot), 1);
      gg.fillStyle = PAL.coin; gg.beginPath(); gg.arc(0, 0, s.size * c.zoom * 0.9, 0, TAU); gg.fill();
      gg.strokeStyle = PAL.coinDark; gg.lineWidth = 1.5; gg.stroke();
      gg.restore();
    });
  }
  // V16 吸气：几道气流被吸进鼻孔
  if (T >= V16 - 0.3 && T < V16 + 0.15) {
    const [nx, ny] = toScreen(c, 1, A.nose[0], A.nose[1]);
    const k = seg(T, V16 - 0.3, V16 + 0.1);
    g.save();
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a0 = Math.PI * (0.85 + 0.12 * i), r0 = (230 - 40 * i) * c.zoom * 0.5, ph = clamp(k * 1.4 - i * 0.12);
      if (ph <= 0 || ph >= 1) continue;
      const r = r0 * (1 - ph);
      g.strokeStyle = rgba(PAL.white, 0.5 * Math.sin(Math.PI * ph));
      g.lineWidth = 3;
      g.beginPath(); g.arc(nx, ny, r + 20, a0, a0 + 0.35); g.stroke();
    }
    g.restore();
  }
  // V16 清嗓：两个烟圈
  for (const [i, tc] of [[0, V16 + 0.34], [1, V16 + 0.64]]) {
    if (T < tc || T > tc + 1.0) continue;
    const p = (T - tc) / 1.0;
    const [mx, my] = toScreen(c, 1, A.mouth[0], A.mouth[1]);
    const x = mx - 150 * c.zoom * outCubic(p) - 30 * i, y = my - 95 * c.zoom * outCubic(p) - 10 * p;
    const r = (14 + 40 * outCubic(p)) * c.zoom * 0.5;
    g.save();
    g.globalAlpha *= (1 - p) * 0.9;
    g.lineWidth = Math.max(2, (9 - 6 * p) * c.zoom * 0.5);
    g.strokeStyle = mixHex(PAL.stone2, PAL.paper2, 0.4);
    g.beginPath(); g.ellipse(x, y, r * 1.3, r, -0.3, 0, TAU); g.stroke();
    g.strokeStyle = rgba(PAL.white, 0.5); g.lineWidth *= 0.4;
    g.beginPath(); g.ellipse(x - 1, y - 2, r * 1.2, r * 0.9, -0.3, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
    g.restore();
  }
  // D1：每块背板亮起时喷一小撮火星 + 光晕
  if (T >= D1A) {
    PLATE_T.forEach((t0, i) => {
      if (T < t0 || T > t0 + 0.8) return;
      const [px, py] = toScreen(c, 1, A.plates[i][0], A.plates[i][1]);
      const k = hit(T, t0, 0.25);
      glow(g, px, py, 120 * c.zoom, PAL.dragonEye, 0.55 * k);
      glow(g, px, py, 70 * c.zoom, PAL.goldLight, 0.6 * k);
      burst(g, T, { at: t0, seed: 940 + i, count: 12, x: px, y: py - 30 * c.zoom, spread: 10, speed: [120, 300], angle: [-2.6, -0.55], gravity: 700, life: [0.35, 0.7], size: [3, 6] }, (gg, x, y, s) => {
        gg.fillStyle = rgba(s.r < 0.5 ? PAL.goldLight : PAL.ember, 1 - s.p);
        gg.beginPath(); gg.arc(x, y, s.size * (1 - 0.5 * s.p) * c.zoom, 0, TAU); gg.fill();
      });
    });
    // 尾尖一甩：一颗星
    if (T >= FLICK - 0.02) {
      const [tx, ty] = toScreen(c, 1, A.tailTip[0], A.tailTip[1]);
      const k = Math.sin(Math.PI * clamp((T - FLICK) / 0.5));
      sparkle(g, tx + 20, ty - 26, 46 * k, { color: PAL.white, alpha: k, rot: 0.3 });
      sparkle(g, tx + 20, ty - 26, 24 * k, { color: PAL.goldLight, alpha: k, rot: 1.08 });
      glow(g, tx, ty, 140, PAL.goldLight, 0.5 * k);
    }
  }
}

/** 界面：「后面！」、VS、敌人名字牌、「咳」×2、「叮」（同一图层，纸片投影）。 */
function drawUI(g, T, ctx, c, A, PS) {
  const items = [];
  // 「后面！」：挂在公主嘴边（随机位走），退场时整体缩回、字不先消失
  const bp = clamp((T - T_BUB) / 0.22);
  const bOut = seg(T, V15 - 0.22, V15 - 0.04);
  if (bp > 0 && bOut < 1) items.push((lg) => {
    const [mx, my] = toScreen(c, 1, PS.x - 40, PS.y - 168);
    const bx = Math.max(240, mx - 210), by = Math.max(150, my - 120);
    const k = 1 - inCubic(bOut);
    lg.save(); lg.translate(mx - 6, my); lg.scale(k, k); lg.translate(-(mx - 6), -my);
    bubble(lg, { x: bx, y: by, w: 300, h: 150, text: '后面！', tail: [mx - 6, my], pop: bp, t: T, seed: 9 });
    lg.restore();
  });
  // VS 徽章 + 敌人名字牌（挂在世界里，推镜时自然出画；VS 在 V16 前弹掉）
  const vsP = seg(T, V15 + 1.25, V15 + 1.61);
  const vsOut = seg(T, V16 - 0.08, V16 + 0.14);
  if (vsP > 0 && vsOut < 1) items.push((lg) => {
    const [vx, vy] = toScreen(c, 1, 800, 560);
    const k = vsOut > 0 ? (1 + 0.2 * Math.sin(Math.PI * Math.min(1, vsOut * 2))) * (1 - inCubic(vsOut)) : 1;
    lg.save(); lg.translate(vx, vy); lg.scale(k, k); lg.translate(-vx, -vy);
    vsBadge(lg, { x: vx, y: vy, size: 170, drop: vsP, t: T });
    lg.restore();
  });
  const epP = seg(T, V15 + 1.52, V15 + 1.95);
  if (epP > 0 && T < V16 + 0.5) items.push((lg) => {
    const [ex, ey] = toScreen(c, 1, 1590, 250);
    enemyPlate(lg, { x: ex, y: ey, drop: epP, t: T });
  });
  // 「咳」×2（各跟一个烟圈）
  if (A) for (const [j, tc] of [[0, V16 + 0.34], [1, V16 + 0.64]]) {
    const p = clamp((T - tc) / 0.16), out = seg(T, tc + 0.4, tc + 0.52);
    if (p <= 0 || out >= 1) continue;
    items.push((lg) => {
      const [mx, my] = toScreen(c, 1, A.mouth[0], A.mouth[1]);
      const bx = mx - 300 + 40 * j, by = my - 190 - 60 * j;
      const k = 1 - inCubic(out);
      lg.save(); lg.translate(mx - 30, my - 20); lg.scale(k, k); lg.translate(-(mx - 30), -(my - 20));
      bubble(lg, { x: bx, y: by, w: 170, h: 120, text: '咳', tail: [mx - 30, my - 20], pop: p, t: T, seed: 21 + j });
      lg.restore();
    });
  }
  // 「叮」
  if (A && T >= FLICK && T < FLICK + 0.6) items.push((lg) => {
    const [tx, ty] = toScreen(c, 1, A.tailTip[0], A.tailTip[1]);
    const k = outBack(clamp((T - FLICK) / 0.18), 2.2) * (1 - seg(T, FLICK + 0.4, FLICK + 0.6));
    if (k <= 0) return;
    lg.save(); lg.translate(tx + 96, ty - 96); lg.rotate(0.12); lg.scale(k, k);
    paperGlyph(lg, '叮', 0, 0, 64, { family: 'play', fill: PAL.goldDark, edge: PAL.paper, edgeW: 0.14 });
    lg.restore();
  });
  if (!items.length) return;
  ctx.layer(g, { shadow: 10, texture: 0.25 }, (lg) => { for (const f of items) f(lg); });
}
