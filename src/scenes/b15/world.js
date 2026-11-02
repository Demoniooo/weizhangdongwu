// b15 · 婚礼：整块共用的“世界”——一条连续机位 + 一套王城婚礼布景 + 全部角色 / 道具的状态函数。
// 四个镜头（b15_wedding.js）都调用 scene(g, T, ctx)，只是 id 不同，便于联系表里按 cue 分段。
// 纯函数：画面只由 T 决定；随机只用 hash2；不跨帧缓存（模块级常量与静态几何除外）。
// 接缝 185.47（→ b16）：状态一律从 src/scenes/_seams.js 的合同读出（机位、漂移、图层栈、站位、王冠角度、横幅路径与配色、
// 蝴蝶结、纸鸽、烟花、彩纸）；图层按合同的 layers 逐层画；拉远落定（185.30）之后直接调用合同的 drawSeam。
import { cue, NAMES } from '../../cues.js';
import { PAL, sparkle, blob, cut } from '../../core/paper.js';
import { cam, applyCam, toScreen, drift } from '../../core/camera.js';
import { clamp, lerp, seg, smoothstep, hit, wobble, hash2, mixHex, rgba, TAU } from '../../core/util.js';
import { ez, glide, outBack, outCubic, inOutCubic, inOutSine, whip, inQuad, outQuad } from '../../core/ease.js';
import { burst } from '../../core/particles.js';
import { drawCastle, spireWrapPoint, CASTLE, LAYER_FX } from '../../env/castle.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawKing } from '../../rigs/king.js';
import { drawPrincess } from '../../rigs/princess.js';
import { drawLizard } from '../../rigs/dragon.js';
import { drawCitizen } from '../../rigs/folk.js';
import { drawDove } from '../../rigs/monsters.js';
import { drawCrown, drawTiara, drawBell } from '../../props/royal.js';
import { drawScarfKnot } from '../../props/scarf.js';
import { drawBanner, drawBow, drawSpeechWave, confettiDraw, heartPath } from '../../props/misc.js';
import { samplePath, pathAt } from '../../props/paper.js';
import { impact, speedLines } from '../../fx/transitions.js';
import { NAME_TIMES, paperGlyph, glyphWidth } from '../../ui/type.js';
import * as SM from '../_seams.js';

// ———————————————————— 时刻（一律 cue + 偏移） ————————————————————
const E09 = cue('E09'), E10 = cue('E10'), E11 = cue('E11'), E12 = cue('E12'), O01 = cue('O01');
export const T_START = E09 - 0.20;          // 176.80 块起点（与 b14 重叠到 177.20）
const T_REV1 = E09 - 0.05;                  // 176.95 圆形揭开到满屏
const T_LEAN = E09 + 0.20;                  // 177.20 b14 结束：此前精简图层
const T_CROWN = E09 + 0.05;                 // 177.05 王冠落回头上「叮」
const T_BELL1 = E09 + 0.30;                 // 177.30 钟声 + 纸鸽飞起
const T_TIARA0 = E09 + 0.45, T_TIARA1 = E09 + 0.55;   // 177.45 掏出小皇冠 / 177.55 戴上
const NT10 = NAME_TIMES('E10');             // 公主竖幅逐字
const T_LIFT = E10 + 1.84;                  // 179.60 人群举起舞龙
const T_WHIP0 = E11 - 0.14, T_WHIP1 = E11 + 0.06;      // 180.85–181.05 上甩回阳台
const T_HAND = E11 + 0.09;                  // 181.08 重音：手放进手里
const T_KNOT = E11 + 0.21;                  // 181.20 围巾缠手
const T_HEART = E11 + 0.41;                 // 181.40 爱心 + 第二次钟声
const NT12 = NAME_TIMES('E12');             // 勇者横幅逐字
const T_PULL = E12 - 0.08;                  // 181.58 纸鸽起飞拉横幅
const T_HOLD1 = E12 + 1.54;                 // 183.20 开始拉远
const T_LET = E12 + 2.18;                   // 183.84 松开手（红绳退回），三人回到合同姿势
const T_THROW = E12 + 2.64;                 // 184.30 人群抛竖幅
const T_WRAP0 = E12 + 2.74;                 // 184.40 绕尖塔
const T_BOW = E12 + 3.04;                   // 184.70 系成蝴蝶结「咚」
const T_PULL2 = E12 + 3.64;                 // 185.30 拉远落定 → 之后按合同画
export const T_END = O01;                   // 185.47 接缝

// ———————————————————— 接缝合同（b15|b16） ————————————————————
const SEAM_KEY = 'b15|b16';
const SEAM = SM.SEAMS[SEAM_KEY];
const itemOf = (id) => [...(SEAM.actors || []), ...(SEAM.props || []), ...(SEAM.ui || [])].find((a) => a.id === id) || null;
const itemP = (id) => (itemOf(id) || {}).params || {};
const S_HERO = itemP('hero'), S_PRIN = itemP('princess'), S_KING = itemP('king');
const S_LIZ = itemP('lizard'), S_CROWD = itemP('crowd'), S_BOW = itemP('bow'), S_DOVES = itemP('doves');
const S_ENV = SEAM.env.params;
const KING_TILT = SM.KING_CROWN_TILT ?? ((S_KING.crown && S_KING.crown.tilt) ?? 12);   // 王冠从 E09 起歪着（读合同）
const LF = LAYER_FX;
const SEAM_LAYERS = SEAM.layers;

// 配色（integration_notes 拍板，合同同）：公主横幅 princessLight 底 + gold 边 + red 字；蝴蝶结左勇者色、右公主色
const PRIN_STYLE = SM.PRINCESS_BANNER_STYLE || { style: 'princess', size: 54, base: PAL.princessLight, ink: PAL.red, edge: PAL.gold, tail: false };
const HERO_STYLE = SM.HERO_BANNER_STYLE || { style: 'hero', size: 60, tail: false };
const BOW_STYLE = SM.BOW_STYLE || { s: S_BOW.s ?? 0.55, rot: 0, left: PAL.skyDayLow, right: PAL.princessLight };
const BOW_AT = SM.BOW_AT || [961, 228];
const PRIN_PATH = SM.PRINCESS_BANNER_PATH;
const PRIN_FRONT = SM.PRINCESS_FRONT;
const HERO_PATH = SM.HERO_BANNER_PATH;

// ———————————————————— 布局 ————————————————————
const FLOOR = CASTLE.balcony.floorY;        // 590
const X = SM.BALCONY_X || { hero: 935, princess: 985, king: 1035 };   // 阳台站位（合同 = integration_notes）
const S = 0.26;                              // 阳台角色缩放
const BELLS = [{ tower: 5, side: -1 }, { tower: 7, side: 1 }];
const PRIN_X11 = X.princess - 10;            // E11 公主靠近一步牵手
const HAND_PT = [955.3, 552];                // 两只手放在栏杆顶上相握（世界坐标，量自木偶锚点）

// ———————————————————— 小工具 ————————————————————
/** 屏幕 → 某深度世界坐标（toScreen 的逆，无滚转）。 */
function fromScreen(c, d, sx, sy) {
  const z = 1 + (c.zoom - 1) * d;
  return [(sx - 960) / z + 960 + (c.x - 960) * d, (sy - 540) / z + 540 + (c.y - 540) * d];
}
/** 深度 d 的世界点 → 在主体层（depth 1）里画时的等效坐标（屏幕位置不变）。 */
function toMain(c, d, x, y) {
  if (Math.abs(d - 1) < 1e-6) return [x, y];
  const [sx, sy] = toScreen(c, d, x, y);
  return fromScreen(c, 1, sx, sy);
}
/** 时间关键帧机位：Hermite（Catmull-Rom 切线、两端速度 0），zoom 在对数空间。keys = [[t, cam], …]。 */
function camTrack(keys, T) {
  const n = keys.length;
  if (T <= keys[0][0]) return keys[0][1];
  if (T >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && T >= keys[i + 1][0]) i++;
  const [t0, A] = keys[i], [t1, B] = keys[i + 1];
  const h = t1 - t0, u = (T - t0) / h;
  const v = (c) => [c.x, c.y, Math.log(c.zoom)];
  const tan = (j) => {
    if (j <= 0 || j >= n - 1) return [0, 0, 0];
    const p = v(keys[j - 1][1]), q = v(keys[j + 1][1]), dt = keys[j + 1][0] - keys[j - 1][0];
    return p.map((pv, k) => (q[k] - pv) / dt);
  };
  const a = v(A), b = v(B), ma = tan(i), mb = tan(i + 1);
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  const r = a.map((av, k) => h00 * av + h10 * h * ma[k] + h01 * b[k] + h11 * h * mb[k]);
  return cam(r[0], r[1], Math.exp(r[2]), 0);
}
/** 与 drawBanner 内部同一套 samplePath（step 8）。 */
const SP = (pts) => samplePath(pts, 8);
/** 两条路径按“从起点算的弧长”逐点混合（字按弧长排，混合时不打乱字序）。 */
function blendPaths(spA, spB, k, step = 12) {
  if (k <= 0) return spA.pts.map((p) => [p[0], p[1]]);
  if (k >= 1) return spB.pts.map((p) => [p[0], p[1]]);
  const L = Math.max(spA.total, spB.total), out = [];
  for (let s = 0; s <= L + 0.01; s += step) {
    const a = extAt(spA, s), b = extAt(spB, s);
    out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)]);
  }
  return out;
}
/** 超出路径末端时沿末端切线外推。 */
function extAt(sp, s) {
  if (s <= sp.total) return pathAt(sp, s);
  const e = pathAt(sp, sp.total);
  return [e[0] + Math.cos(e[2]) * (s - sp.total), e[1] + Math.sin(e[2]) * (s - sp.total), e[2]];
}
/** 分段关键帧插值（段内 inOutSine）：keys = [[t, v], …]。 */
function keyed(T, keys) {
  if (T <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) if (T < keys[i + 1][0]) return lerp(keys[i][1], keys[i + 1][1], inOutSine(seg(T, keys[i][0], keys[i + 1][0])));
  return keys[keys.length - 1][1];
}

// ———————————————————— 机位 ————————————————————
const ZW = 1150 / 70;                        // 圆窗玻璃半径 1150px（与 b14 玫瑰窗同屏位同半径）
const CAM_WIN = cam(960, 430, ZW);
const CAM_E09 = cam(960, 520, 2.2);          // 阳台宽中景（主堡、阳台、邻塔、花环翻折）
const CAM_TIARA = cam(1000, 537, 3.3);       // 戴小皇冠：推近
const CAM_GROUND = cam(1180, 832, 1.87);     // 城下舞龙：竖幅从阳台一直到举竿人（字 ≥100px）
const CAM_BAL = cam(962, 545, 3.5);          // 甩回阳台
const CAM_HANDS = cam(958, 542, 4.3);        // 情绪推近：栏杆上相握的手
const CAM_E12 = cam(560, 360, 1.45);         // 左半边天空 + 阳台：纸鸽拉开勇者横幅
const CAM_END = SEAM.cam;                    // cam(960,540,0.9) 礼物城堡（合同）
const TRACK = [
  [E09 + 0.16, CAM_E09], [E09 + 0.33, CAM_E09], [E09 + 0.56, CAM_TIARA], [E10, CAM_TIARA],
  // E10 下摇：每出一个字，镜头正好让新字落在画面中下部、卷筒在其下方
  [NT10[1], cam(990, 600, 2.6)], [NT10[3], cam(980, 715, 2.15)], [NT10[5], cam(985, 805, 1.96)],
  [T_LIFT, cam(1060, 828, 1.89)], [E10 + 2.34, CAM_GROUND], [T_WHIP0, cam(1184, 830, 1.87)],
];
/** 基础机位（不含漂移）。 */
function baseCam(T) {
  if (T < E09 + 0.16) {
    // 圆窗拉出：慢起（揭开期间内外玻璃对齐）→ 快拉 → 软着陆
    const k = ez(T, T_START, E09 + 0.16, (u) => (u < 0.35 ? 0.175 * inQuad(u / 0.35) : 0.175 + 0.825 * outCubic((u - 0.35) / 0.65)));
    return lerpCamG(CAM_WIN, CAM_E09, k);
  }
  if (T < T_WHIP0) return camTrack(TRACK, T);
  if (T < T_WHIP1) return lerpCamG(TRACK[TRACK.length - 1][1], CAM_BAL, ez(T, T_WHIP0, T_WHIP1, whip));
  if (T < E12 - 0.21) return lerpCamG(CAM_BAL, CAM_HANDS, ez(T, T_WHIP1, E11 + 0.46, glide));
  if (T < T_HOLD1) return lerpCamG(CAM_HANDS, CAM_E12, ez(T, E12 - 0.21, E12 + 0.16, outCubic));
  return lerpCamG(CAM_E12, CAM_END, ez(T, T_HOLD1, T_PULL2, glide));
}
/** 机位插值：位置线性、缩放几何（与 lerpCam 相同，免得 rot 为 undefined）。 */
function lerpCamG(a, b, t) { return cam(lerp(a.x, b.x, t), lerp(a.y, b.y, t), a.zoom * Math.pow(b.zoom / a.zoom, t), 0); }
/** 实际机位：基础机位 + 合同漂移（揭开期间不漂，与 b14 的玫瑰窗对齐；接缝处 = withDrift(合同机位)）。 */
export function camAt(T) {
  const c = baseCam(T);
  const kd = smoothstep(T_REV1, E09 + 0.3, T);
  const [dx, dy] = drift(T, SEAM.drift || SM.DRIFT);
  return cam(c.x + (kd * dx) / c.zoom, c.y + (kd * dy) / c.zoom, c.zoom, 0);
}

// ———————————————————— 王冠（E09 落回，之后歪 KING_TILT 度） ————————————————————
function crownState(T) {
  if (T < T_CROWN) return { off: true };
  const w = wobble(T, T_CROWN, 3.2, 0.22);
  return { tilt: KING_TILT + 9 * w, squash: 0.3 * hit(T, T_CROWN, 0.09), glint: 0.9 * hit(T, T_CROWN + 0.03, 0.18) };
}

// ———————————————————— 阳台三人 ————————————————————
function kingParams(T) {
  // 177.38 上前一步给公主戴小皇冠，177.62 退回
  const k1 = ez(T, E09 + 0.36, E09 + 0.48, inOutCubic) - ez(T, E09 + 0.62, E09 + 0.76, inOutCubic);
  const o = { x: X.king - 20 * k1, y: FLOOR, s: S, face: -1, t: T, festive: true, bandage: true, crown: crownState(T) };
  if (T < E09) {
    // 晕乎乎地站着（头上转着晕星）→ 176.88 起蹲下蓄力
    const k = ez(T, E09 - 0.12, E09 - 0.02, outQuad);
    return { ...o, pose: { from: 'idle', to: 'crouch', k }, expr: T < E09 - 0.12 ? 'dizzy' : 'confident', stars: 1 - seg(T, E09 - 0.15, E09 - 0.05), holding: null };
  }
  if (T < E09 + 0.38) {
    // E09 重音：高举星星权杖（snap + 余振）
    const k = ez(T, E09, E09 + 0.08, outBack);
    return { ...o, pose: { from: 'crouch', to: 'raiseScepter', k }, expr: 'proud', holding: 'scepter', squash: 0.12 * wobble(T, E09 + 0.06, 3, 0.18) };
  }
  if (T < T_TIARA1 + 0.04) {
    // 177.38 收起权杖、从袍子里掏出小皇冠，递向公主
    const k = ez(T, E09 + 0.38, T_TIARA0, inOutCubic);
    return { ...o, pose: { from: 'raiseScepter', to: 'placeTiara', k }, expr: 'tearful', holding: k < 0.5 ? null : 'tiara' };
  }
  if (T < E11 - 0.16) {
    const k = ez(T, T_TIARA1 + 0.04, T_TIARA1 + 0.3, inOutCubic);
    return { ...o, pose: { from: 'placeTiara', to: 'idle', k }, expr: T < E10 + 0.4 ? 'joy' : 'proud', holding: null, look: [-0.3, 0.6] };
  }
  if (T < T_BOW - 0.12) {
    // E11：手心向上把公主“递”出去（含泪）→ 退回
    const k = ez(T, E11 - 0.16, E11 + 0.04, inOutCubic);
    const back = ez(T, E11 + 0.55, E11 + 0.8, inOutCubic);
    return { ...o, pose: { from: { from: 'idle', to: 'giveHand', k }, to: 'idle', k: back }, expr: T < E11 + 0.7 ? 'tearful' : 'joy', holding: null };
  }
  // 蝴蝶结弹出前后开始拍手（接缝：合同的 pose / expr）
  return { ...o, pose: S_KING.pose || 'clap', expr: S_KING.expr || 'joy', holding: null };
}

function princessParams(T) {
  const step = ez(T, E11 - 0.22, E11 + 0.02, inOutCubic) * (1 - ez(T, T_LET, T_LET + 0.24, inOutCubic));
  const o = { x: lerp(X.princess, PRIN_X11, step), y: FLOOR, s: S, face: -1, t: T, veil: 1, tiara: T >= T_TIARA1, tiaraGlint: 0.25 + 0.75 * hit(T, T_TIARA1, 0.25) };
  if (T < T_TIARA1) return { ...o, pose: 'bride', expr: T < E09 + 0.1 ? 'smile' : 'laugh', look: [0.6, -0.2] };
  if (T < E11 - 0.22) {
    // 摸摸小皇冠，笑了（举起的那只手按回去）
    const up = ez(T, T_TIARA1 + 0.02, T_TIARA1 + 0.12, outCubic) * (1 - ez(T, T_TIARA1 + 0.4, T_TIARA1 + 0.6, inOutCubic));
    return { ...o, pose: 'bride', expr: up > 0.3 ? 'laugh' : 'smile', joints: { armR: 110 * up, elbowR: -70 * up } };
  }
  if (T < T_LET) {
    // E11：近侧手伸过去放进勇者手里（落在栏杆顶上），另一只手拿着花束
    const k = ez(T, E11 - 0.22, T_HAND, inOutCubic);
    return { ...o, pose: { from: 'bride', to: 'holdHands', k }, item: null, expr: k > 0.6 ? 'loving' : 'shy', blush: 0.4 * k, joints: { armR: 80 * k, elbowR: -70 * k }, bouquetL: true };
  }
  const k = ez(T, T_LET, T_LET + 0.24, inOutCubic);
  return { ...o, pose: { from: 'holdHands', to: S_PRIN.pose || 'bride', k }, item: k > 0.5 ? 'bouquet' : null, expr: S_PRIN.expr || 'laugh', joints: { armR: 80 * (1 - k), elbowR: -70 * (1 - k) }, bouquetL: k <= 0.5 };
}

function heroParams(T) {
  const scarf = { len: 300, notch: true, hole: true, patch: true, glow: 0.6, ...(S_HERO.scarf || {}) };
  const o = { x: X.hero, y: FLOOR, s: S, face: 1, t: T, sword: 'back', scarf };
  if (T < E09 + 0.06) return { ...o, pose: 'idle', expr: 'normal', yaw: 0.6 };
  if (T < E10 + 0.1) {
    const k = ez(T, E09 + 0.06, E09 + 0.2, outBack) * (1 - ez(T, E09 + 0.4, E09 + 0.6, inOutCubic));
    return { ...o, pose: { from: 'idle', to: 'cheer', k }, expr: 'laugh', ahogeAt: T_CROWN };
  }
  if (T < E11 - 0.25) return { ...o, pose: 'idle', expr: 'grin', yaw: 0.3 };
  if (T < T_LET) {
    // E11：远侧手平伸、接住公主的手（落在栏杆顶上）；E12 前近侧手朝左上一指：纸鸽，出发！
    const k = ez(T, E11 - 0.25, T_HAND - 0.02, inOutCubic);
    const pt = ez(T, E12 - 0.2, E12 - 0.08, outBack) * (1 - ez(T, E12 + 0.5, E12 + 0.8, inOutCubic));
    return { ...o, pose: { from: 'idle', to: 'holdHands', k }, expr: pt > 0.2 ? 'grin' : 'shy', blush: 0.6 * k, ahogeAt: T_HAND,
      jointsAdd: { aB: [75 * k, -25 * k, 0], aF: [150 * pt, -30 * pt, 0] } };
  }
  const k = ez(T, T_LET, T_LET + 0.24, inOutCubic);
  return { ...o, pose: { from: 'holdHands', to: S_HERO.pose || 'cheer', k }, expr: S_HERO.expr || 'laugh', jointsAdd: { aB: [75 * (1 - k), -25 * (1 - k), 0] } };
}

/** 花束（公主牵手时拿在另一只手里；木偶的 bouquet 是两手捧的，这里单手版）。 */
function drawBouquet(g, x, y, s) {
  g.save();
  g.translate(x, y); g.scale(s, s);
  cut(g, blob(-6, 14, 7, 16, { seed: 61, rot: 0.3 }), PAL.grass);
  cut(g, blob(7, 13, 6, 15, { seed: 62, rot: -0.35 }), PAL.leafLight);
  const fl = [[0, -6, PAL.heart], [-11, -1, PAL.princessLight], [11, -2, PAL.white], [-5, -14, PAL.goldLight], [7, -13, PAL.princess]];
  fl.forEach(([fx, fy, col], i) => cut(g, blob(fx, fy, 7.5, 7, { seed: 70 + i }), col, { rim: PAL.white, rimW: 1 }));
  cut(g, blob(0, 22, 9, 4.5, { seed: 77 }), PAL.princessDark);
  g.restore();
}

// ———————————————————— 公主竖幅 ————————————————————
const PB_SIZE = PRIN_STYLE.size || 54;
const SP_PRIN = SP(PRIN_PATH);                                 // 合同路径（接缝时的样子，主体层坐标）
const L_PRIN = SP_PRIN.total;
/** 第 i 个字中心的大致弧长（竖排 1.04 字号一格；拐弯后横排约 1.1 字号一格）。 */
const PB_CHAR_S = [...NAMES.princess].map((_, i) => {
  const w = PB_SIZE * 1.5 * 0.42, v = PB_SIZE * 1.04, h = PB_SIZE * 1.1;
  return i <= 6 ? w + v * (i + 0.5) : w + v * 7 + h * (i - 7 + 0.5);
});
/** 竖幅前沿弧长 F(T)：每个字出现时前沿领先它约 50；舞龙时沿举竿人继续展开；抛起时冲上尖塔。 */
function princessFront(T, L) {
  if (T < E10 - 0.12) return 0;
  let F = keyed(T, [[E10 - 0.12, 0], ...NT10.map((t, i) => [t, PB_CHAR_S[i] + 52])]);
  F += 330 * ez(T, T_LIFT - 0.05, T_LIFT + 1.0, inOutSine);
  return lerp(F, L, ez(T, T_THROW, T_THROW + 0.32, outCubic));
}
// 城下地面：竖幅落地后、人群举竿时，这一段按 near 层（depth 1.1，与人群同一视差）设计，画时换成主体层等效坐标。
const S_WALL = SP(PRIN_PATH.slice(0, 3)).total;               // 栏杆到墙脚
const groundW = (s) => smoothstep(S_WALL - 10, S_WALL + 120, s);
function mapNear(pts, c) {
  let s = 0;
  return pts.map((p, i) => {
    if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    return toMain(c, 1 + 0.1 * groundW(s), p[0], p[1]);
  });
}
/** 落地后平铺在城门前草地上的样子（near 层坐标）：竖直段同合同，拐弯后贴地向右。 */
const GROUND_PATH = [...PRIN_PATH.slice(0, 3).map((p) => [p[0], p[1]]), [987, 925], [998, 968], [1040, 990], [1180, 993], [1346, 990], [1460, 985], [1600, 980]];

/** 舞龙队：合同城下右组（举竿时朝右，抛完转回合同朝向欢呼）；按竖幅卷筒到达的顺序依次举起。 */
const CROWD = S_CROWD.members || [];
const DANCERS = CROWD.filter((m) => m.x > 1000).sort((a, b) => a.x - b.x);
function danceK(T, j) {
  return {
    kL: ez(T, T_LIFT - 0.1 + j * 0.2, T_LIFT + 0.12 + j * 0.2, inOutCubic),
    kT: ez(T, T_THROW - 0.06 + j * 0.03, T_THROW + 0.16 + j * 0.03, outCubic),
  };
}
function crowdParams(T, m) {
  const o = { t: T, s: S_CROWD.s ?? 0.3, ...m };
  const j = DANCERS.indexOf(m);
  if (j >= 0) {
    const { kL, kT } = danceK(T, j);
    if (kL > 0 && kT < 1) {
      o.pose = kT > 0 ? { from: 'carryOverhead', to: m.pose || 'cheer', k: kT } : { from: 'cheer', to: 'carryOverhead', k: kL };
      o.phase = -j * 0.19;
      o.face = kT > 0.5 ? m.face : 1;
    } else if (T < T_LIFT) o.pose = { from: 'idle', to: 'cheer', k: ez(T, NT10[5] - 0.25, NT10[5] + 0.05) };
  } else if (T < NT10[4]) o.pose = 'idle';
  else o.pose = { from: 'idle', to: m.pose || 'cheer', k: seg(T, NT10[4], NT10[4] + 0.3) };
  return o;
}
/** 舞龙举竿点（near 层世界坐标）：只求 drawCitizen 的 carry 锚点，不落笔。没举起的人返回地面上的一点。 */
function probeCarry(T) {
  if (T < T_LIFT - 0.2 || T > T_THROW + 0.4 || !PROBE_G) return null;
  return DANCERS.map((m, j) => {
    const a = drawCitizen(PROBE_G, { ...crowdParams(T, m), alpha: 0 });
    const up = a && a.carry ? [a.carry[0], a.carry[1]] : [m.x + 6, m.y - 62];
    const k = danceK(T, j).kL;
    return [lerp(m.x + 4, up[0], k), lerp(m.y - 12, up[1] - PB_SIZE * 0.7, k)];
  });
}
const PROBE_G = (() => { try { return new OffscreenCanvas(4, 4).getContext('2d'); } catch (e) { return null; } })();

/** 竖幅路径（主体层坐标）：平铺 → 举竿舞龙 → 抛起后落回合同路径；各段在主体层里按弧长混合。 */
function princessPath(T, c) {
  const lift = ez(T, T_LIFT - 0.1, T_LIFT + 0.2, outCubic);
  const thr = ez(T, T_THROW, T_THROW + 0.3, inOutCubic);
  if (thr >= 1) return PRIN_PATH.map((p) => [p[0], p[1]]);
  const ground = SP(mapNear(GROUND_PATH, c));
  let cur = ground;
  const top = probeCarry(T);
  if (lift > 0 && top) {
    const last = top[top.length - 1];
    const dance = [...GROUND_PATH.slice(0, 6), [1110, 978], ...top, [last[0] + 90, last[1] - 4], [last[0] + 190, last[1] + 6], [last[0] + 300, last[1] + 14]];
    cur = SP(blendPaths(ground, SP(mapNear(dance, c)), lift));
  }
  return blendPaths(cur, SP_PRIN, thr);
}

// ———————————————————— 勇者横幅 ————————————————————
const HB_SIZE = HERO_STYLE.size || 60;
const SP_HERO = SP(HERO_PATH);
const L_HERO = SP_HERO.total;
/** 第 i 个字中心弧长：按 display 字宽量（g 是当前图层）。 */
function heroCharS(g) {
  const out = [];
  let s = HB_SIZE * 1.5 * 0.42;
  for (const ch of [...NAMES.hero]) { const adv = glyphWidth(g, ch, HB_SIZE) + HB_SIZE * 0.1; out.push(s + adv / 2); s += adv; }
  return out;
}
/** 勇者横幅前沿（纸鸽叼着的卷筒）弧长：181.58 起飞，每个字出现时前沿领先它约 55，184.40 正好到尖塔左侧。 */
function heroFront(T, cs) {
  if (T <= T_PULL) return 0;
  const keys = [[T_PULL, 0]];
  NT12.forEach((t, i) => { if (t < T_WRAP0 - 0.15) keys.push([t, Math.min(L_HERO - 4, cs[i] + 55)]); });
  keys.push([T_WRAP0, L_HERO]);
  return Math.min(L_HERO, keyed(T, keys));
}

// ———————————————————— 纸鸽 ————————————————————
const DOVE_S = 0.75;
const BEAK = [35.5, -15];                       // 喙相对身体中心（s=1，朝右）
const doveAt = (pt, s, face) => ({ x: pt[0] - BEAK[0] * s * face, y: pt[1] - BEAK[1] * s });
const SEAM_DOVES = S_DOVES.list || [{ x: 1092, y: 128, s: 0.72, face: 1, seed: 1 }, { x: 1150, y: 196, s: 0.66, face: 1, seed: 2 }];
/** 勇者横幅那只：从画左外飞到横幅起点 → 拉着前沿往右飞 → 184.40 绕尖塔一圈 → 系好结飞到合同位置。 */
function dove1(T, frontPt) {
  const dEnd = SEAM_DOVES[0];
  const seed = dEnd.seed ?? 1;
  const start = HERO_PATH[0];
  if (T < T_PULL - 0.4) return null;
  if (T < T_PULL) {
    const k = ez(T, T_PULL - 0.4, T_PULL, outCubic);
    const p = doveAt(start, DOVE_S, 1);
    return { x: lerp(p.x - 260, p.x, k), y: lerp(p.y - 90, p.y, k), s: DOVE_S, face: 1, seed, front: true, carry: true };
  }
  if (T < T_WRAP0) {
    const f = frontPt || [start[0], start[1], 0];
    return { ...doveAt(f, DOVE_S, 1), s: DOVE_S, face: 1, seed, front: true, carry: true };
  }
  if (T < T_BOW) {
    const q = spireWrapPoint(seg(T, T_WRAP0, T_BOW));
    const face = Math.cos(q.ang) >= 0 ? 1 : -1;
    return { ...doveAt([q.x, q.y - 4], DOVE_S, face), s: DOVE_S, face, seed, front: q.front, carry: true };
  }
  const k = ez(T, T_BOW + 0.02, T_PULL2 - 0.05, outCubic);
  const q = spireWrapPoint(1), p = doveAt([q.x, q.y - 4], DOVE_S, 1);
  return { x: lerp(p.x, dEnd.x, k), y: lerp(p.y, dEnd.y, k) - 40 * Math.sin(Math.PI * k), s: lerp(DOVE_S, dEnd.s, k), face: dEnd.face, seed, front: true };
}
/** 公主竖幅那只：184.20 从右上俯冲接住抛起的末端，顺塔后冲上尖塔，系好结飞到合同位置。 */
function dove2(T, frontPt) {
  const dEnd = SEAM_DOVES[1];
  const seed = dEnd.seed ?? 2;
  if (T < T_THROW - 0.1 || !frontPt) return null;
  if (T < T_THROW + 0.32) {
    const k = ez(T, T_THROW - 0.1, T_THROW + 0.14, outCubic);
    const p = doveAt(frontPt, DOVE_S, -1);
    return { x: lerp(1800, p.x, k), y: lerp(230, p.y, k), s: DOVE_S, face: -1, seed, front: false, carry: PAL.princessLight };
  }
  const k = ez(T, T_THROW + 0.32, T_PULL2 - 0.05, outCubic);
  const p = doveAt(frontPt, DOVE_S, -1);
  return { x: lerp(p.x, dEnd.x, k), y: lerp(p.y, dEnd.y, k) - 30 * Math.sin(Math.PI * k), s: lerp(DOVE_S, dEnd.s, k), face: k > 0.25 ? dEnd.face : -1, seed, front: k > 0.1 };
}

// ———————————————————— 小蜥蜴 ————————————————————
const LIZ_S = S_LIZ.s ?? 0.3, LIZ_S_DANCE = 0.38;
const T_SLIDE0 = E10 + 1.09, T_SLIDE1 = T_LIFT - 0.06;      // 178.85–179.54 顺竖幅滑下
function lizardOnShoulder(T) {
  const off = [(S_LIZ.x ?? 877) - X.hero, (S_LIZ.y ?? 554) - FLOOR];
  const land = T >= T_WHIP1 && T < T_WHIP1 + 0.2 ? -0.25 * hit(T, T_WHIP1, 0.06) : 0;
  return { x: X.hero + off[0], y: FLOOR + off[1], s: LIZ_S, face: 1, t: T, pose: S_LIZ.pose || 'ride', squash: land };
}
const lizardOnBalcony = (T) => T < T_SLIDE0 || T >= T_WHIP1;

// ———————————————————— 状态汇总 ————————————————————
function stateAt(T, c) {
  const st = { T, c };
  st.lean = T < T_LEAN;
  st.king = kingParams(T);
  st.prin = princessParams(T);
  st.hero = heroParams(T);
  st.knotP = ez(T, T_KNOT, T_KNOT + 0.26, outCubic) * (1 - ez(T, T_LET - 0.12, T_LET + 0.08, inOutCubic));
  const env = { time: S_ENV.time || 'wedding', deco: seg(T, E09 - 0.05, E09 + 0.40), flags: S_ENV.flags };
  if (T >= T_BOW) env.ribbonWrap = S_ENV.ribbonWrap;
  else if (T >= T_WRAP0) env.ribbonWrap = { ...(S_ENV.ribbonWrap || {}), p: seg(T, T_WRAP0, T_BOW) };
  st.env = env;
  // 公主竖幅
  if (T >= E10 - 0.12) {
    const path = princessPath(T, c);
    const sp = SP(path);
    st.prinBanner = { path, sp, grow: clamp(princessFront(T, sp.total) / sp.total) };
    if (T >= T_THROW - 0.1) st.d2 = dove2(T, pathAt(sp, st.prinBanner.grow * sp.total));
  }
  // 绕尖塔时鸽子要先于主体层决定前后
  if (T >= T_WRAP0 && T < T_BOW) st.d1 = dove1(T, null);
  return st;
}

// ———————————————————— 绘制：阳台（onBalcony，主体层坐标） ————————————————————
function drawBalconyPeople(g, st) {
  const { T } = st;
  if (lizardOnBalcony(T)) drawLizard(g, lizardOnShoulder(T));
  const ha = drawHero(g, st.hero);
  const { bouquetL, ...pO } = st.prin;
  const pa = drawPrincess(g, pO);
  if (bouquetL && pa.handL) drawBouquet(g, pa.handL[0] - 1, pa.handL[1] + 2, S * 0.62);
  const ka = drawKing(g, st.king);
  st.heroA = ha; st.prinA = pa; st.kingA = ka;
  // 小皇冠：177.45 国王掏出 → 177.48–177.55 从他手里落到公主头上
  if (T >= T_TIARA0 && T < T_TIARA1) {
    const k = ez(T, T_TIARA0 + 0.03, T_TIARA1, inOutCubic);
    const from = ka.tiara || ka.handR, to = pa.tiara;
    if (from && to) drawTiara(g, { x: lerp(from[0], to[0], k), y: lerp(from[1], to[1], k) - 10 * S * Math.sin(Math.PI * k), s: S, glint: 0.5, t: T });
  }
}

/** 栏杆前的一层（主体层坐标，画在 main 层 env 之后）：放在栏杆顶上的两只相握的手 + 红绳。 */
function drawHandsOnRail(g, st) {
  const { T, heroA: ha, prinA: pa } = st;
  if (!ha || !pa || T < E11 - 0.25 || T >= T_LET + 0.1) return;
  const hx = (ha.handL[0] + pa.handR[0]) / 2, hy = (ha.handL[1] + pa.handR[1]) / 2;
  st.handMid = [hx, hy];
  const meet = ez(T, T_HAND - 0.06, T_HAND, inQuad);
  if (meet > 0 && st.knotP > 0) drawScarfKnot(g, { x: hx, y: hy, s: S * 0.95, p: st.knotP, t: T, part: 'all' });
  // 接触瞬间的小闪光（重音）
  if (T >= T_HAND && T < T_HAND + 0.25) sparkle(g, hx + 4, hy - 9, 7 * Math.sin(Math.PI * seg(T, T_HAND, T_HAND + 0.25)), { color: PAL.white });
}

/** 钟：像立体书机关一样从塔侧翻出（177.22 / 181.32），摆两下，再折回（不留到接缝）。 */
const RINGS = [[T_BELL1, 0.55], [T_HEART, 0.45]];
function drawBells(g, st) {
  const { T } = st;
  for (const [t0, dur] of RINGS) {
    const open = ez(T, t0 - 0.08, t0, outBack) * (1 - ez(T, t0 + dur - 0.06, t0 + dur + 0.08, inOutCubic));
    if (open <= 0.001) continue;
    for (const b of BELLS) {
      const tw = CASTLE.towers[b.tower];
      const bx = tw.x + b.side * 35, by = tw.top + 6;
      g.save();
      g.translate(bx, by);
      g.scale(b.side * open, 1);
      g.fillStyle = mixHex(PAL.wood, PAL.woodDark, 0.3);
      g.fillRect(0, -3, 34, 6);
      g.fillStyle = PAL.goldDark; g.beginPath(); g.arc(34, 0, 3.2, 0, TAU); g.fill();
      g.restore();
      const sw = T >= t0 ? b.side * 0.55 * Math.sin((T - t0) * 9.5) * Math.exp(-(T - t0) * 1.6) : 0;
      drawBell(g, { x: bx + b.side * 34 * open, y: by, s: 0.28 * open, swing: sw, t: T });
    }
  }
}

// ———————————————————— 合同条目的“动画版” ————————————————————
const ITEM = {
  princessTail(g, st) {
    const { T, prinBanner: pb } = st;
    if (!pb || T < T_THROW) return;
    drawBanner(g, pb.path, { ...PRIN_STYLE, size: PB_SIZE, grow: pb.grow, range: [PRIN_FRONT - 0.002, 1], tail: false, t: T });
    for (const d of [st.d1, st.d2]) if (d && !d.front) drawDoveP(g, T, d);
  },
  princessBanner(g, st) {
    const { T, prinBanner: pb } = st;
    if (!pb) return;
    const appear = NT10.map((t) => seg(T, t, t + 0.18));
    const res = drawBanner(g, pb.path, { ...PRIN_STYLE, size: PB_SIZE, grow: pb.grow, range: [0, T >= T_THROW ? PRIN_FRONT : 1], tail: false, appear, t: T });
    drawLizardOnBanner(g, st, res);
  },
  heroBanner(g, st) {
    const { T } = st;
    if (T < T_PULL) return;
    const F = heroFront(T, heroCharS(g));
    if (F <= 0.5) { st.heroFrontPt = [HERO_PATH[0][0], HERO_PATH[0][1], 0]; return; }
    const appear = NT12.map((t) => seg(T, t, t + 0.18));
    const grow = clamp(F / L_HERO);
    st.heroFrontPt = drawBanner(g, HERO_PATH, { ...HERO_STYLE, size: HB_SIZE, grow, tail: grow >= 1 ? false : undefined, appear, t: T }).front;
  },
  bow(g, st) {
    const { T } = st;
    if (T < T_BOW) return;
    const pop = seg(T, T_BOW, T_BOW + 0.24);
    const bounce = 1 + 0.1 * wobble(T, T_BOW + 0.2, 3.2, 0.12) * (1 - seg(T, T_PULL2 - 0.3, T_PULL2 - 0.1));
    drawBow(g, { x: BOW_AT[0], y: BOW_AT[1], ...BOW_STYLE, s: (BOW_STYLE.s ?? 0.55) * bounce, t: T, pop });
  },
  doves(g, st) {
    const { T } = st;
    if (!(T >= T_WRAP0 && T < T_BOW)) st.d1 = dove1(T, st.heroFrontPt);
    for (const d of [st.d1, st.d2]) if (d && d.front) drawDoveP(g, T, d);
  },
  crowd(g, st) {
    const { T, c } = st;
    g.save(); g.setTransform(st.base); applyCam(g, c, 1.1);
    for (const m of [...CROWD].sort((a, b) => a.y - b.y)) drawCitizen(g, crowdParams(T, m));
    g.restore();
  },
  fireworks(g, st) { SM.drawSeamFireworks(g, { t: st.T, list: SM.FIREWORKS_E12 }); },
  confetti(g, st) { SM.drawSeamConfetti(g, { t: st.T, bursts: SM.CONFETTI_E12 }); },
};
function drawDoveP(g, T, d) {
  const o = { x: d.x, y: d.y, s: d.s, face: d.face, seed: d.seed, t: T };
  if (d.carry) { o.carry = d.carry; o.carryEdge = PAL.gold; }
  drawDove(g, o);
}

function drawLizardOnBanner(g, st, res) {
  const { T } = st;
  if (lizardOnBalcony(T)) return;
  const sv = lerp(LIZ_S, LIZ_S_DANCE, seg(T, T_SLIDE0, T_SLIDE0 + 0.3)) * (1 - 0.2 * seg(T, T_WHIP0, T_WHIP1));
  if (T < T_SLIDE1) {
    // 顺着竖幅当滑梯滑下（头朝下，越滑越快）
    const k = ez(T, T_SLIDE0, T_SLIDE1, inQuad);
    drawLizard(g, { x: PRIN_PATH[0][0] + 24, y: lerp(FLOOR - 24, 958, k), s: sv, face: 1, t: T, pose: 'climb', joints: { tilt: 150 } });
    return;
  }
  if (T < T_WHIP0) {
    // 一跳，骑到竖幅最前面领舞（跟着卷筒往前走）
    const f = res.front;
    const hopK = ez(T, T_SLIDE1, T_LIFT + 0.14, outCubic);
    const fx = f[0] - 30, fy = f[1] - PB_SIZE * 0.76;
    drawLizard(g, { x: lerp(PRIN_PATH[0][0] + 24, fx, hopK), y: lerp(958, fy, hopK) - 60 * Math.sin(Math.PI * hopK), s: sv, face: 1, t: T, pose: 'lead' });
    return;
  }
  // 甩镜期间顺着竖幅一路往上跑回阳台
  const k = ez(T, T_WHIP0, T_WHIP1, whip);
  drawLizard(g, { x: PRIN_PATH[0][0] + 26, y: lerp(958, FLOOR - 26, k), s: sv, face: 1, t: T, pose: 'climb', joints: { tilt: -40 } });
}

function drawFallingCrown(g, st) {
  const { T, kingA } = st;
  if (T >= T_CROWN || !kingA) return;
  // 从画面上沿外掉下来，转着落到头上那一点（crownBase / crownRot / crownS）
  const k = ez(T, E09 - 0.16, T_CROWN, inQuad);
  const bx = kingA.crownBase[0], by = kingA.crownBase[1];
  drawCrown(g, { x: lerp(bx + 26, bx, k), y: lerp(by - 260, by, k), s: kingA.crownS, rot: kingA.crownRot + (1 - k) * 5.2, spin: (1 - k) * 9, F: 1, t: T, glint: 0.4 });
}

const FLOCK = Array.from({ length: 7 }, (_, i) => ({
  x0: 700 + 85 * i + (hash2(i, 51) - 0.5) * 40, y0: 560 + hash2(i, 52) * 60,
  vx: (i < 3 ? -1 : 1) * (60 + hash2(i, 53) * 90), vy: -(330 + hash2(i, 54) * 160), at: T_BELL1 + i * 0.045, s: 0.26 + hash2(i, 55) * 0.08,
}));
function drawFlock(g, st) {
  const { T } = st;
  if (T < T_BELL1 || T > T_BELL1 + 1.6) return;
  FLOCK.forEach((d, i) => {
    const age = T - d.at;
    if (age < 0) return;
    drawDove(g, { x: d.x0 + d.vx * age, y: d.y0 + d.vy * age + 40 * age * age, s: d.s * Math.min(1, age * 6), face: d.vx > 0 ? 1 : -1, t: T, seed: 10 + i });
  });
}
/** 舞龙时的彩纸（179.65 / 180.15 两阵，181.6 前落完，不留到接缝）。 */
const DANCE_CONFETTI = [
  { at: T_LIFT + 0.05, seed: 151, count: 46, x: 1250, y: 820, spread: 120, speed: [380, 760], angle: [-2.4, -0.7], gravity: 420, drag: 1.4, life: [1.2, 1.7], spin: [-9, 9], size: [9, 14] },
  { at: T_LIFT + 0.55, seed: 152, count: 40, x: 1420, y: 820, spread: 120, speed: [380, 760], angle: [-2.4, -0.7], gravity: 420, drag: 1.4, life: [1.1, 1.5], spin: [-9, 9], size: [9, 14] },
];
function drawExtrasFront(g, st) {
  const { T } = st;
  drawFallingCrown(g, st);
  drawFlock(g, st);
  if (T >= T_LIFT && T <= T_WHIP1 + 0.4) for (const b of DANCE_CONFETTI) burst(g, T, b, confettiDraw);
}

// ———————————————————— 最上层（不开缓冲）的附加物 ————————————————————
function drawSparkle(g, st) {
  const { T, c } = st;
  g.save(); applyCam(g, c, 1);
  for (const [t0, dur] of RINGS) {
    if (T < t0 || T > t0 + dur) continue;
    const a = 1 - seg(T, t0 + dur - 0.15, t0 + dur);
    for (const b of BELLS) {
      const tw = CASTLE.towers[b.tower];
      drawSpeechWave(g, { x: tw.x + b.side * 69, y: tw.top + 32, dir: b.side > 0 ? -0.2 : Math.PI + 0.2, spread: 0.6, n: 3, r0: 12, gap: 14, t: T - t0, speed: 2.2, thick: 4, alpha: a });
    }
  }
  if (T >= T_CROWN && T < T_CROWN + 0.55 && st.kingA) {
    const k = seg(T, T_CROWN, T_CROWN + 0.12), a = 1 - seg(T, T_CROWN + 0.38, T_CROWN + 0.55);
    const [x, y] = st.kingA.crownTop;
    paperGlyph(g, '叮', x + 22, y - 18 - 10 * k, 22, { family: 'play', fill: PAL.goldDark, edge: PAL.paper, edgeW: 0.16, scale: outBack(k, 2.4), alpha: a, rot: 0.12 });
    sparkle(g, x, y - 2, 16 * (1 - seg(T, T_CROWN, T_CROWN + 0.3)), { color: PAL.white });
  }
  drawHeart(g, st);
  g.restore();
  if (T > T_WHIP0 + 0.01 && T < T_WHIP1) {
    const a = Math.sin(Math.PI * seg(T, T_WHIP0, T_WHIP1));
    speedLines(g, 'v', null, { t: T, sign: 1, alpha: 0.8 * a, density: 2.6, colors: [PAL.white, PAL.princessLight, PAL.skyDayLow], shadow: 0.6 });
  }
}

function drawHeart(g, st) {
  const { T } = st;
  if (T < T_HEART - 0.02 || T > E12 + 0.5 || !st.handMid) return;
  const [hx, hy] = st.handMid;
  const k = seg(T, T_HEART, T_HEART + 0.22);
  const sc = outBack(k, 2.6);
  const fade = 1 - seg(T, E12 + 0.2, E12 + 0.5);
  const y = hy - 27 - 12 * seg(T, T_HEART, E12 + 0.5);
  const w = 26 * sc;
  if (w <= 0.1) return;
  g.save();
  g.globalAlpha *= fade;
  const p = heartPath(hx, y, w, w * 0.9, 0, 0.1);
  g.lineJoin = 'round'; g.lineWidth = 2.6; g.strokeStyle = PAL.white; g.stroke(p);
  g.fillStyle = PAL.heart; g.fill(p);
  g.fillStyle = rgba(PAL.white, 0.5); g.fill(heartPath(hx - w * 0.18, y - w * 0.16, w * 0.28, w * 0.22, -0.4, 0.4));
  g.restore();
  if (k < 1) sparkle(g, hx + w * 0.55, y - w * 0.4, 9 * Math.sin(Math.PI * k), { color: PAL.white });
}

// ———————————————————— 主函数 ————————————————————
export function scene(g, T, ctx) {
  // ④ 拉远落定之后：直接按合同画（与 b16 的第一帧同一份代码）
  if (T >= T_PULL2) { SM.drawSeam(g, T, ctx, SEAM_KEY); return; }
  const c = camAt(T);
  const st = stateAt(T, c);
  ctx.fx.sat = Math.max(ctx.fx.sat ?? 1, lerp(1, (SEAM.fx && SEAM.fx.sat) || 1.1, seg(T, T_START, T_LEAN)));
  const env = { ...st.env, onBalcony: (bg) => drawBalconyPeople(bg, st), onWall: (wg) => drawBells(wg, st) };
  const castle = (lg, layer) => {
    drawCastle(lg, T, c, { ...env, layer });
    if (layer === 'main') { lg.save(); applyCam(lg, c, 1); drawHandsOnRail(lg, st); lg.restore(); }
  };

  if (T < T_REV1 + 0.02) {
    // ① 揭开：圆形羽化遮罩（中心屏幕 (960,540)），里面是圆窗外侧大特写（此机位只看得到主体层）
    const R = lerp(0, 1270, ez(T, T_START, T_REV1 + 0.02, outQuad));
    if (R <= 1) return;
    ctx.mask(g, (mg) => { mg.beginPath(); mg.arc(960, 540, R, 0, TAU); mg.fill(); }, (lg) => {
      lg.fillStyle = PAL.stone; lg.fillRect(-40, -40, 2000, 1160);
      ctx.layer(lg, LF.main, (l2) => castle(l2, 'main'));
    }, { feather: 40 });
    return;
  }
  // 合同条目在世界坐标（depth 1）里画；crowd 自己换到 depth 1.1
  const runItem = (lg, id) => {
    const fn = ITEM[id];
    if (!fn) return;
    lg.save(); st.base = lg.getTransform(); applyCam(lg, c, 1); fn(lg, st); lg.restore();
  };
  const runLayer = (lg, L) => {
    for (const ref of L.draw) {
      if (ref.startsWith('env:')) castle(lg, ref.slice(4));
      else runItem(lg, ref);
    }
    if (L.id === 'ribbons') { lg.save(); applyCam(lg, c, 1); drawExtrasFront(lg, st); lg.restore(); }
  };
  if (st.lean) {
    // ② 与 b14 重叠的后半段（176.95–177.20）：合并成 3 个缓冲（与 LAYER_GROUPS 同参数）
    ctx.layer(g, { shadow: 5, texture: 0.18 }, (lg) => { castle(lg, 'sky'); castle(lg, 'far'); });
    ctx.layer(g, { shadow: 10, texture: 0.32 }, (lg) => { castle(lg, 'mid'); castle(lg, 'main'); });
    ctx.layer(g, { shadow: 9, texture: 0.3 }, (lg) => { castle(lg, 'near'); castle(lg, 'fg'); lg.save(); applyCam(lg, c, 1); drawExtrasFront(lg, st); lg.restore(); });
  } else {
    // ③ 正常：逐层照合同的图层栈画（参数、顺序、哪一层画什么都与 drawSeam 相同；条目换成本块的动画版）
    for (const L of SEAM_LAYERS) {
      if (L.o) ctx.layer(g, L.o, (lg) => runLayer(lg, L));
      else { g.save(); runLayer(g, L); g.restore(); }
    }
  }
  drawSparkle(g, st);

  // 冲击：王冠落回（小）、手放进手里（小）、蝴蝶结「咚」（中，185.30 前衰减干净）
  impact(ctx, T, T_CROWN, 'S', { shake: 5, flash: 0.15, decay: 0.16 });
  impact(ctx, T, T_HAND, 'S', { shake: 3, flash: 0.1, decay: 0.12 });
  impact(ctx, T, T_BOW + 0.06, 'M', { shake: 10, flash: 0.3, decay: 0.12, flashColor: PAL.goldLight });
}
