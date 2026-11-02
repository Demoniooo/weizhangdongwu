// b05 · 勇者名 ×4 —— 时刻、机位曲线、角色时间表（全是 T 的纯函数）。
// 所有时刻都写成 cue + 偏移；机位叠全片统一漂移（_seams.js 的 withDrift / DRIFT），保证两处隐形接缝同一公式。
import { cue } from '../../cues.js';
import { cam, lerpCam } from '../../core/camera.js';
import { ez, glide, whip, snap, inOutSine, outBack, outCubic, inQuad, inCubic } from '../../core/ease.js';
import { clamp, lerp, seg, hit, wobble, noise1, fbm1 } from '../../core/util.js';
import { CAMS } from '../../env/throne.js';
import { withDrift, DRIFT } from '../_seams.js';
import { IN, OUT, seamParams } from './seam.js';

/** cue 表（只读）。 */
export const C = {};
for (const id of ['L16', 'N1a', 'N1b', 'N1c', 'K1', 'N2a', 'N2b', 'N2c', 'K2', 'N3a', 'N3b', 'N3c', 'H1', 'N4a', 'N4b', 'N4c', 'I1']) C[id] = cue(id);
export const B_START = C.N1a;
export const B_END = C.I1;

// ———————————————————— 机位 ————————————————————
/** 偏国王的双人：storyboard 写 cam(1300,560,1.45)，那样勇者（x=620）出画；按“屏幕落点优先”左移到 1200，勇者留在画左。 */
export const CAM_KING2S = cam(1200, 560, 1.45);
/** N3c 上摇：国王被吊起 180px 后仍在画内，书记官讲台留在画底。 */
export const CAM_KINGUP = cam(1220, 505, 1.4);
/** N2 期间缓慢推近一点点（紧张感），面板按 TR_2S 设计的屏幕坐标随视差走。 */
export const CAM_PANEL = cam(1062, 592, 1.39);
/** N4c 第三次后拉（第三级），随后 glide 到 TR_HIGH。 */
export const CAM_SEAL3 = cam(1040, 560, 1.0);

/** 机位关键帧：[t0, t1, from, to, ease]；段与段之间保持上一段终点。 */
const KEYS = [
  [C.N1a, C.N1c, CAMS.TR_2S, CAMS.TR_NAME, glide],               // 41.90–43.80 缓推（起点速度 0）
  [C.N1c + 1.0, C.K1 + 0.02, CAMS.TR_NAME, CAMS.CU_K, whip],       // 44.80–45.12 右甩到国王格
  [C.K1 + 0.2, C.K1 + 0.8, CAMS.CU_K, CAMS.TR_2S, glide],          // 45.30–45.90 拉回双人
  [C.N2a, C.K2 - 0.11, CAMS.TR_2S, CAM_PANEL, inOutSine],           // 45.94–49.20 极慢推近
  [C.K2 - 0.11, C.K2, CAM_PANEL, CAMS.CU_K, snap],                  // 49.20–49.31 snap 国王格
  [C.N3a, C.N3a + 0.57, CAMS.CU_K, CAM_KING2S, glide],              // 49.83–50.40 拉到偏国王双人
  [C.N3c, C.H1 - 0.08, CAM_KING2S, CAM_KINGUP, glide],              // 51.77–53.10 跟着上摇
  [C.H1 - 0.08, C.H1 + 0.07, CAM_KINGUP, CAMS.CU_H, whip],          // 53.10–53.25 左甩到勇者格
  [C.N4a, C.N4a + 0.12, CAMS.CU_H, CAMS.TR_SEAL, snap],              // 54.00 急拉
  [C.N4b, C.N4b + 0.12, CAMS.TR_SEAL, CAMS.TR_SEAL2, snap],          // 54.68 后拉一级
  [C.N4c, C.N4c + 0.14, CAMS.TR_SEAL2, CAM_SEAL3, snap],             // 55.71 再拉一级
  [C.I1 - 0.89, C.I1 - 0.09, CAM_SEAL3, CAMS.TR_HIGH, glide],        // 56.00–56.80 拉到 TR-HIGH
];

/** 基础机位（不含漂移、不含冲击偏移）。 */
export function baseCam(T) {
  let c = CAMS.TR_2S;
  for (const [t0, t1, a, b, fn] of KEYS) {
    if (T < t0) break;
    c = T >= t1 ? b : lerpCam(a, b, fn((T - t0) / (t1 - t0)));
  }
  return c;
}
/** 机位速度（屏幕 px/s，水平），给速度线用。 */
export function camSpeedX(T) {
  const dt = 1 / 120;
  const a = baseCam(T - dt), b = baseCam(T + dt);
  return ((b.x - a.x) * Math.max(a.zoom, b.zoom)) / (2 * dt);
}
/** N4c 全厅震起：0..1..0 的弹跳（55.71 起 0.28s）。 */
export function hallBounce(T) {
  const u = (T - C.N4c) / 0.28;
  return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) * (1 - 0.35 * u);
}
/** 最终机位：基础 + 全片统一漂移（与接缝合同同一公式）+ 全厅震起。 */
export function camAt(T) {
  const c = withDrift(baseCam(T), T, DRIFT);
  const hb = hallBounce(T);
  return hb > 0 ? cam(c.x, c.y + (20 * hb) / c.zoom, c.zoom, c.rot) : c;
}
/** 是否处在反应格（景深：背景虚化）。返回 0..1。 */
export function cuAmount(T) {
  const z = baseCam(T).zoom;
  return clamp((z - 1.6) / 1.5);
}

// ———————————————————— 通用：动作节拍 ————————————————————
/**
 * beats：[{ t, pose, blend, ...其它 }]（按 t 升序）。返回当前姿态（含 {from,to,k} 插值）与当前节拍。
 * 表情等离散项提前 lead 秒切换（先想后动）。
 */
export function beatAt(beats, T, lead = 0.08) {
  let i = -1;
  for (let k = 0; k < beats.length; k++) if (T >= beats[k].t) i = k;
  if (i < 0) i = 0;
  const pose = poseOf(beats, i, T);
  // 表情：每拍在 t − lead 切换（先想后动）；lead 可逐拍覆盖（负值 = 动作开始后才换，接缝帧用）
  let j = 0;
  for (let k = 0; k < beats.length; k++) if (T >= beats[k].t - (beats[k].lead ?? lead)) j = k;
  return { pose, b: beats[i], e: beats[j], i };
}
function poseOf(beats, i, T) {
  const b = beats[i];
  if (i === 0 || !b.blend) return b.pose;
  const k = clamp((T - b.t) / b.blend);
  if (k >= 1) return b.pose;
  const prev = poseOf(beats, i - 1, b.t);
  return { from: prev, to: b.pose, k: (b.ease || inOutSine)(k) };
}

// ———————————————————— 勇者 ————————————————————
export const HERO_X = 620, HERO_Y = 880;
const HB = [
  { t: C.N1a, pose: 'inhale', expr: 'normal' },
  { t: C.N1a, pose: 'shout', blend: 0.12, expr: 'shout', lead: -0.03 },
  { t: C.N1b - 0.05, pose: 'proud', blend: 0.18, expr: 'smug' },
  { t: C.N1c - 0.06, pose: 'shout', blend: 0.1, expr: 'shout' },
  { t: C.K1 - 0.1, pose: 'gulp', blend: 0.12, expr: 'shock' },
  { t: C.K1 + 0.25, pose: 'scratchHead', blend: 0.25, expr: 'grin' },
  { t: C.N2a - 0.24, pose: 'inhale', blend: 0.16, expr: 'normal' },
  { t: C.N2a, pose: 'shout', blend: 0.1, expr: 'shout' },
  { t: C.N2b - 0.04, pose: 'present', blend: 0.16, expr: 'smug' },
  { t: C.N2c - 0.05, pose: 'shout', blend: 0.1, expr: 'shout' },
  { t: C.N2c + 1.25, pose: 'duck', blend: 0.1, expr: 'shock' },
  { t: C.K2 + 0.3, pose: 'idle', blend: 0.3, expr: 'normal' },
  { t: C.N3c + 0.23, pose: 'scratchHead', blend: 0.3, expr: 'worried' },
  { t: C.H1 - 0.1, pose: 'thumbsUp', blend: 0.1, expr: 'laugh' },
  { t: C.N4a - 0.02, pose: 'gulp', blend: 0.08, expr: 'shock' },
  { t: C.N4b - 0.06, pose: 'cheer', blend: 0.16, expr: 'grin' },
  { t: C.N4c - 0.05, pose: 'cheer', blend: 0.1, expr: 'laugh' },
];
/** 出场接缝前 0.3s 起完全落到合同状态（只剩 t 驱动的次级运动）。 */
export const SETTLE = C.I1 - 0.3;
/** 勇者木偶参数。 */
export function heroParams(T) {
  if (T <= C.N1a) return seamParams(IN, 'hero', T);
  if (T >= SETTLE) return seamParams(OUT, 'hero', T);
  const { pose, e } = beatAt(HB, T);
  const o = { x: HERO_X, y: HERO_Y, s: 1, face: 1, t: T, pose, expr: e.expr, sword: 'back' };
  // 41.90 起 0.12s 内放气开喊；N2a 前再小吸一口
  o.inflate = (1 - ez(T, C.N1a, C.N1a + 0.12, outCubic)) * (T < C.N1a + 0.2 ? 1 : 0)
    + (T > C.N2a - 0.3 && T < C.N2a + 0.1 ? 0.55 * Math.sin(Math.PI * seg(T, C.N2a - 0.26, C.N2a + 0.05)) : 0);
  if (o.inflate <= 0.001) delete o.inflate;
  // 呆毛：接缝时 straight，开喊后弹回；N1c / N2c / H1 / N4c 弹一下
  const ka = ez(T, C.N1a + 0.04, C.N1a + 0.25, outBack);
  o.ahoge = T < C.N1a + 0.25 ? (ka <= 0 ? 'straight' : { from: 'straight', to: 'normal', k: ka }) : 'normal';
  const bounces = [C.N1a + 0.18, C.N1c, C.N2c, C.K2 + 0.2, C.H1 + 0.02, C.N4c];
  let ah = null;
  for (const b of bounces) if (T >= b) ah = b;
  if (ah != null && T < C.I1 - 0.5) o.ahogeAt = ah;
  // 围巾：接缝时被气流掀起（合同 wind [-20,-150]），随喊声起伏、一直离开红毯飘着；出场前落回（合同无风）
  const shout = (p) => (typeof p === 'string' ? (p === 'shout' ? 1 : 0) : p.to === 'shout' ? p.k : p.from === 'shout' ? 1 - p.k : 0);
  const loud = clamp(shout(pose));
  const gust = 0.75 + 0.25 * fbm1(T * 0.9, 41);
  const live = [(-90 - 110 * loud) * gust, (-150 - 120 * loud) * gust];
  const kIn = ez(T, C.N1a, C.N1a + 0.45, inOutSine), kOut = 1 - ez(T, C.I1 - 0.75, SETTLE, inOutSine);
  const w0 = (IN.hero && IN.hero.params.scarf && IN.hero.params.scarf.wind) || [0, 0];
  o.scarf = { len: 780, wind: [lerp(w0[0], live[0], kIn) * kOut, lerp(w0[1], live[1], kIn) * kOut] };
  // 反应叠加件
  o.sweat = ez(T, C.N3c + 0.23, C.N3c + 0.6) * (1 - ez(T, C.H1 - 0.1, C.H1)) + 0.7 * ez(T, C.N4a, C.N4a + 0.1) * (1 - ez(T, C.N4b - 0.1, C.N4b + 0.1));
  if (T >= C.H1 - 0.2 && T < C.N4a) o.toothSparkle = C.H1 + 0.12;
  o.blush = 0.35 * ez(T, C.K1 + 0.25, C.K1 + 0.5) * (1 - ez(T, C.N2a - 0.2, C.N2a));
  // 喊叫时的挤压回弹、金印落地时被震一下
  let sq = 0;
  for (const h of [C.N1a, C.N1b, C.N1c, C.N2a, C.N2b, C.N2c]) sq += 0.07 * wobble(T, h, 4, 0.18);
  sq += -0.12 * hit(T, C.N4a, 0.12) - 0.08 * hit(T, C.N4c, 0.12);
  o.squash = sq * (1 - ez(T, C.I1 - 0.6, SETTLE));
  return o;
}

// ———————————————————— 国王 ————————————————————
export const KING_STAND = [1500, 790];
/** 圣旨三段字的中心 x（hung 0 时，探针实测）与国王砸印时的站位（face −1，sealSlam 的印面在 x−130）。 */
export const GROUP_X = [865, 1115, 1390];
export const SLAM_X = GROUP_X.map((x) => x + 130);
export const DECREE_Y = 790; // 站在“地上展开的圣旨”上（与台阶顶同高）
const KB = [
  { t: C.N1a, pose: 'leanForward', expr: 'joy' },
  { t: C.N1b - 0.05, pose: 'leanForward', expr: 'squint' },
  { t: C.N1c, pose: 'gasp', blend: 0.14, expr: 'gasp' },
  { t: C.K1 - 0.15, pose: 'cupEar', blend: 0.16, expr: 'squint' },
  { t: C.N2a - 0.1, pose: 'idle', blend: 0.25, expr: 'confident' },
  { t: C.N2b + 0.7, pose: 'clap', blend: 0.18, expr: 'joy' },
  { t: C.N2c - 0.02, pose: 'gasp', blend: 0.12, expr: 'gasp' },
  { t: C.N2c + 1.27, pose: 'holdHead', blend: 0.08, expr: 'panic' },
  { t: C.K2 - 0.12, pose: 'fingerUp', blend: 0.12, expr: 'squint' },
  { t: C.N3a - 0.06, pose: 'puff', blend: 0.08, expr: 'puffed' },
  { t: C.N3c + 0.4, pose: 'dangle', blend: 0.25, expr: 'sick' },
  { t: C.N4a - 0.16, pose: 'sealRaise', blend: 0.06, expr: 'confident' },
];
/** 第 i 次砸印的时刻。 */
export const PRINT_AT = [C.N4a, C.N4b, C.N4c];
/** 国王位置（脚底）。 */
export function kingPos(T) {
  let x = KING_STAND[0], y = KING_STAND[1];
  // N3c 被吊起 180px（52.20–53.10），并随气球轻摆
  const lift = 180 * ez(T, C.N3c + 0.43, C.H1 - 0.08, inOutSine);
  if (T < C.N4a - 0.12) {
    y -= lift;
    x += lift > 0 ? Math.sin((T - C.N3c) * 2.2) * 8 * (lift / 180) : 0;
    // 勇者格期间（画外）：气球把他飘到圣旨左段上空
    const k = ez(T, C.H1 - 0.05, C.N4a - 0.14, inOutSine);
    x = lerp(x, SLAM_X[0] + 40, k);
    y -= 40 * k;
    return [x, y];
  }
  // 54.00 前 0.12s：气球被金印戳破，借着下落砸下
  if (T < C.N4a) {
    const u = seg(T, C.N4a - 0.12, C.N4a);
    return [lerp(SLAM_X[0] + 40, SLAM_X[0], u), lerp(KING_STAND[1] - 220, DECREE_Y, inQuad(u))];
  }
  // N4a → N4b：原地抬印，54.42 往右一跳
  if (T < C.N4b) {
    const u = seg(T, C.N4b - 0.26, C.N4b);
    return [lerp(SLAM_X[0], SLAM_X[1], outCubic(u)), DECREE_Y - 60 * Math.sin(Math.PI * u)];
  }
  // N4b → N4c：55.45 深蹲蓄力，55.58 跳起，55.71 砸下
  if (T < C.N4c) {
    const u = seg(T, C.N4c - 0.15, C.N4c);
    return [lerp(SLAM_X[1], SLAM_X[2], outCubic(u)), DECREE_Y - 150 * Math.sin(Math.PI * u)];
  }
  // 砸完：站在台阶顶，56.20 起挪到出场合同的位置（王座前）
  const end = OUT.king ? [OUT.king.params.x, OUT.king.params.y] : KING_STAND;
  const u = ez(T, C.I1 - 0.69, C.I1 - 0.32, inOutSine);
  return [lerp(SLAM_X[2], end[0], u), lerp(DECREE_Y, end[1], u) - 18 * Math.sin(Math.PI * u)];
}
/** 金印：抬起 → 砸下的插值进度（0 = sealRaise，1 = sealSlam）。 */
export function slamK(T) {
  let k = 0;
  for (const at of PRINT_AT) {
    const down = ez(T, at - 0.11, at, inCubic);
    const up = ez(T, at + 0.3, at + 0.5, inOutSine);
    if (T >= at - 0.11) k = down * (1 - up);
  }
  // 最后一下砸完之后一直按着，56.20 再举起庆祝
  if (T >= C.N4c) k = 1 - ez(T, C.I1 - 0.69, C.I1 - 0.35, inOutSine);
  return k;
}
/** 出场合同里国王的王冠（被气球线勒过：歪、下滑、压扁），N4 期间一直保持这个底子。 */
const crownOut = () => ((OUT.king && OUT.king.params.crown) || { tilt: 12, slip: 0.2, squash: 0.4 });
/** 国王木偶完整参数（含 x, y）。接缝两端直接取合同。 */
export function kingAll(T) {
  if (T <= C.N1a) return seamParams(IN, 'king', T);
  if (T >= SETTLE) return seamParams(OUT, 'king', T);
  const [x, y] = kingPos(T);
  return { ...kingParams(T), x, y };
}
/** 国王木偶参数（不含 x,y）。 */
export function kingParams(T) {
  const { pose, e } = beatAt(KB, T);
  const o = { s: 1, face: -1, t: T, pose, expr: e.expr };
  // 王冠：接缝 tilt 15、slip 0.12；K2 滑下盖眼；N3a 鼓腮时弹回；N3c 被线勒扁；气球破后留下“歪 12、滑 0.2、扁 0.4”
  const c0 = (IN.king && IN.king.params.crown) || { tilt: 15, slip: 0.12 };
  const crown = { tilt: c0.tilt, slip: c0.slip };
  const kCover = ez(T, C.K2 + 0.04, C.K2 + 0.24, (u) => outBack(u, 1.4));
  crown.slip = lerp(c0.slip, 1, kCover);
  crown.tilt = c0.tilt * (1 - kCover);
  if (T >= C.N3a - 0.02) {
    const back = ez(T, C.N3a - 0.02, C.N3a + 0.2, (u) => outBack(u, 2.2));
    crown.slip = lerp(1, 0, back);
    crown.tilt = lerp(0, 8, back) + 6 * wobble(T, C.N3a + 0.05, 4, 0.3);
    crown.pop = 26 * Math.sin(Math.PI * seg(T, C.N3a - 0.02, C.N3a + 0.22));
  }
  if (T >= C.N3c + 0.25) {
    const q = ez(T, C.N3c + 0.25, C.N3c + 0.6);
    crown.squash = q; crown.pop = (crown.pop || 0) + 5 * q; crown.tilt = lerp(crown.tilt, 0, q);
  }
  if (T >= C.N4a - 0.08) {
    const co = crownOut();
    const k = ez(T, C.N4a - 0.08, C.N4a + 0.1, outBack);
    const pops = 22 * hit(T, C.N4a, 0.12) + 18 * hit(T, C.N4b, 0.12) + 30 * hit(T, C.N4c, 0.14);
    crown.squash = lerp(1, co.squash, k); crown.slip = lerp(0, co.slip, k);
    crown.tilt = lerp(0, co.tilt, k) + 8 * wobble(T, C.N4a, 4, 0.3) + 8 * wobble(T, C.N4c, 4, 0.3);
    crown.pop = pops * (1 - ez(T, C.I1 - 0.6, SETTLE));
  }
  o.crown = crown;
  // K1 拢耳：45.80 耳朵夸张地变大到 1.3 倍
  if (T >= C.K1 - 0.15 && T < C.N2a) o.earScale = 1 + 0.3 * ez(T, C.K1 + 0.66, C.K1 + 0.84, (u) => outBack(u, 2.4));
  // N3：吹气球（每吹出一个鼓一次腮）
  if (T >= C.N3a - 0.06 && T < C.N3c + 0.4) o.cheeks = 0.55 + 0.45 * blowPulse(T);
  // N3c：脸色发青
  if (T >= C.N3c + 0.4 && T < C.N4a - 0.2) o.green = ez(T, C.N3c + 0.4, C.N3c + 0.9);
  // N4：金印（抬起 ↔ 砸下插值；55.45 深蹲蓄力）
  if (T >= C.N4a - 0.16) {
    const k = slamK(T);
    if (T >= C.N4c - 0.26 && T < C.N4c - 0.13) o.pose = { from: 'sealRaise', to: 'crouch', k: Math.sin(Math.PI * seg(T, C.N4c - 0.26, C.N4c - 0.13)) * 0.8 };
    else o.pose = k <= 0 ? 'sealRaise' : { from: 'sealRaise', to: 'sealSlam', k };
    o.holding = 'seal';
    o.expr = k > 0.55 ? 'joy' : 'confident';
    if (T >= C.N4c + 0.25) o.expr = 'joy';
    o.squash = (-0.18 * hit(T, C.N4a, 0.08) - 0.16 * hit(T, C.N4b, 0.08) - 0.22 * hit(T, C.N4c, 0.09)) * (1 - ez(T, C.I1 - 0.6, SETTLE));
  }
  return o;
}
/** 吹气球的鼓腮脉冲（每个气球字诞生时 1）。 */
export function blowPulse(T) {
  let p = 0;
  for (const t0 of BALLOON_T) p = Math.max(p, Math.exp(-(((T - t0 + 0.04) / 0.09) ** 2)));
  return p;
}
/** 气球字逐字时刻（N3a / N3b / N3c）。由 names.js 填入，避免循环引用。 */
export const BALLOON_T = [];

// ———————————————————— 书记官 / 传令官 / 卫兵 / 朝臣 ————————————————————
/** 圣旨展开进度（书记官倒退着展开）。勇者格期间不画圣旨（它就在勇者身边，会穿帮）；54.00 急拉 + 闪白时已露出第一段。 */
export function decreeUnroll(T) {
  if (T < C.N4a) return 0.4;
  if (T < C.N4b) return lerp(0.4, 0.66, ez(T, C.N4a + 0.1, C.N4b - 0.04, inOutSine));
  return lerp(0.66, 1, ez(T, C.N4b + 0.1, C.N4c - 0.25, inOutSine));
}
/** 圣旨吊起进度（56.20–56.80）。 */
export const decreeHung = (T) => ez(T, C.I1 - 0.69, C.I1 - 0.09, inOutSine);
/** 圣旨扫光（56.60 起，0.3s 扫过 13 个金字；接缝时刻后由 b06 走完）。 */
export const decreeSweep = (T) => (T >= C.I1 - 0.29 ? (T - (C.I1 - 0.29)) / 0.6 : -1);

void clamp; void noise1; void lerp;
