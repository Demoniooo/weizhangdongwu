// 七处隐形接缝的“接缝合同”（storyboard 3.8 / 第 9 节）。说明文档：docs/seams.md。
//
// 隐形接缝 = 同地点、同机位、不重叠、不转场：前一块最后一帧与后一块第一帧必须几乎像素一致。
// 两边作者看不到彼此的代码，所以把接缝时刻 T 的完整画面状态写在这里，两块都 import 本文件、在接缝附近严格画成这个状态；
// 离开接缝后各自自由运动（motion 字段写了接缝前后各自该怎么动，速度方向要衔接）。
//
// 读法（每项 SEAMS[key]）：
//   T        接缝时刻（cue + 偏移，不写死秒）。A 块在 [.., T) 画、B 块在 [T, ..) 画。
//   cam      基础机位（不含漂移）；drift 漂移参数；实际机位 = seamCam(key, T) = withDrift(cam, T, drift)（旅途 / 剧场另有 camAt）。
//   env      布景函数与参数；layers 里的 'env:<层名>' 表示“在这个图层里画布景的这一层”。
//   layers   图层栈（从下到上）：{ id, o（ctx.layer 参数；null = 直接画在 g 上）, draw:[…按顺序画的东西] }。
//   actors / props / ui  每项 { id, fn, space, depth?, at?, params, note }；fn 是 FN 注册表里的名字（签名统一为 fn(g, params)）。
//            space：'world' = 先 applyCam(lg, cam, depth) 再画；'screen' = 屏幕坐标直接画；
//                   'follow' = 屏幕坐标的界面，锚在世界点 at（depth 层）经 toScreen(cam) 换算出的位置（params 里的 dx/dy 是屏幕偏移）；
//                   'parallax' = 按 base 机位设计的屏幕坐标，随机位漂移按 depth 层视差移动（见 applyParallax）；
//                   'balcony' = 画在 drawCastle 的 onBalcony 回调里（env.onBalcony 列出这些 id，已在主体层机位里）。
//   params   值为函数时 = 随时间变化的量，按当前 T 求值：f(T, E)，E = { c（当前机位）, A（本帧已画元素返回的锚点，按 id） }；
//            常量 NOW = “传当前 T”（t 一律传 T，眨眼 / 呼吸 / 抖动才两边一致）。resolveParams(params, T, E) 给出某一时刻的确切参数。
//   fx       整帧后期（ctx.fx），值同样可以是函数。
//   motion   接缝前后在发生什么（两边作者衔接速度方向用）。notes 其它约定。
//
// drawSeam(g, T, ctx, key)：参考实现（标准答案）——按合同画出接缝附近 T 时刻的完整画面。
// 纯函数、确定性；只 import 基础模块与 src/cues.js。
import { cue, NAMES } from '../cues.js';
import { PAL } from '../core/paper.js';
import { cam, applyCam, toScreen, drift, shake } from '../core/camera.js';
import { lerp, smoothstep, hit } from '../core/util.js';
import { burst } from '../core/particles.js';
import { NAME_TIMES } from '../ui/type.js';
import { dialogBox, nameTagSmall, namePanel, marqueePlate, battleMenu, turnBanner, drawHUD, bubble } from '../ui/kit.js';
import { drawThroneRoom, THRONE, CAMS as TR, throneLayer } from '../env/throne.js';
import { journeyCam, heroJourneyState, hudState, drawJourney, drawOccluder, journeyTexOffset, occluderX } from '../env/journey.js';
import { drawMiniMap } from '../env/map.js';
import { drawCave, drawNameWall, drawStalactite, groundAt, CAMS as CV, CAVE } from '../env/cave.js';
import { drawTheater, theaterState, theaterCam, theaterClip, THEATER } from '../env/theater.js';
import { drawCastle, CASTLE, LAYER_FX as CASTLE_FX } from '../env/castle.js';
import { drawHero, heroRig } from '../rigs/hero.js';
import { drawKing } from '../rigs/king.js';
import { drawPrincess } from '../rigs/princess.js';
import { drawHorse, drawReins, horseRig } from '../rigs/horse.js';
import { drawDragon, drawLizard } from '../rigs/dragon.js';
import { drawCitizen, drawGuard, drawScribe, drawHerald, drawChild } from '../rigs/folk.js';
import { drawDove } from '../rigs/monsters.js';
import { drawBanner, drawBow, drawFireworkShape, confettiDraw } from '../props/misc.js';
import { drawCage } from '../props/cave.js';
import { drawStampMark } from '../props/royal.js';
import { samplePath } from '../props/paper.js';


// ———————————————————— 通用约定 ————————————————————
/** 全片统一漂移（storyboard 3.1：amp 4–6、speed 0.35）。旅途另用 journeyCam 内置的 { amp 5, speed 0.35, seed 21 }。 */
export const DRIFT = Object.freeze({ amp: 5, speed: 0.35, seed: 3 });
/** 参数值写 NOW = 传当前 T。 */
export const NOW = (T) => T;
/**
 * 机位叠漂移（两边必须用同一公式）：[dx, dy] = drift(T, d)；cam(c.x + dx / zoom, c.y + dy / zoom, zoom, rot)。
 * 即主体层（depth 1）在屏幕上平移 (dx, dy) 像素；zoom / rot 不变。不要用 addv(cam, drift(…))（cam 是对象，addv 会算出 [NaN, NaN]）。
 */
export function withDrift(c, T, d = DRIFT) {
  if (!d) return c;
  const [dx, dy] = drift(T, d);
  return cam(c.x + dx / c.zoom, c.y + dy / c.zoom, c.zoom, c.rot || 0);
}
/** 某深度层“按 base 机位设计的屏幕坐标” → 当前机位 c 下随视差移动：applyCam(c, depth) 后再乘 base 机位该层变换的逆。c = base 时等于屏幕坐标。 */
export function applyParallax(g, c, base, depth) {
  applyCam(g, c, depth);
  const z = 1 + (base.zoom - 1) * depth;
  g.translate(960 + (base.x - 960) * depth, 540 + (base.y - 540) * depth);
  g.scale(1 / z, 1 / z);
  if (base.rot) g.rotate(-base.rot);
  g.translate(-960, -540);
}

const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
/** 参数求值：函数 → f(T, E)；普通对象 / 数组逐项递归。返回新对象（不改合同里的原数据）。 */
export function resolveParams(v, T, E = {}) {
  if (typeof v === 'function') return v(T, E);
  if (Array.isArray(v)) return v.map((x) => resolveParams(x, T, E));
  if (isPlain(v)) { const o = {}; for (const k in v) o[k] = resolveParams(v[k], T, E); return o; }
  return v;
}

// ———————————————————— 绘图函数注册表（签名统一 fn(g, params)；原签名不是 (g, o) 的在这里做了薄适配） ————————————————————
/** 布景函数（签名 (g, T, cam, o)；剧场把 cam 放进 o.cam）。 */
const ENV = {
  drawThroneRoom: (g, T, c, o) => drawThroneRoom(g, T, c, o),
  drawJourney: (g, T, c, o) => drawJourney(g, T, c, o),
  drawCave: (g, T, c, o) => drawCave(g, T, c, o),
  drawCastle: (g, T, c, o) => drawCastle(g, T, c, o),
  drawTheater: (g, T, c, o) => drawTheater(g, T, { ...o, cam: c }),
};

// ———— 合同里定义的组合画法（两块都调用同一个函数，导出） ————
/** 一组彩纸 burst（world）：p = { t, bursts:[{ at, seed, count, x, y, spread, speed, angle, gravity, drag, life, spin, size }] }。 */
export function drawSeamConfetti(g, p) {
  for (const b of p.bursts) burst(g, p.t, b, confettiDraw);
}
/** 一组形状烟花（world）：p = { t, list:[drawFireworkShape 参数（不含 t）] }。 */
export function drawSeamFireworks(g, p) {
  for (const f of p.list) drawFireworkShape(g, { ...f, t: p.t });
}
/** 洞顶掉落的钟乳石（back 层世界坐标）：p = { t, list:[{ x, y, len, w, seed, at, rot }] }；y = y0 + ½·2000·age²。 */
export const STALACTITE_G = 2000;
export function drawSeamStalactites(g, p) {
  for (const s of p.list) {
    const age = Math.max(0, p.t - s.at);
    drawStalactite(g, { x: s.x, y: s.y + 0.5 * STALACTITE_G * age * age, len: s.len, w: s.w, seed: s.seed, rot: (s.rot || 0) * Math.min(1, age * 3), light: 1 });
  }
}
/**
 * 旅途骑乘（b07 / b08 共用，world depth 1）：参数全部由 heroJourneyState(t) 推出，见 journeyRiderParams。
 * 画序：马 → 勇者（骑在 saddle）→ 缰绳。返回 { horse, hero }（锚点）。
 */
export function journeyRiderParams(t) {
  const st = heroJourneyState(t);
  const h = st.horse;
  const horse = {
    x: h.x, y: h.y, s: 1, face: 1, t, pose: h.pose, phase: h.phase, speed: h.speed, gait: h.gait || undefined,
    bandageLeg: h.bandageLeg, noseBandage: h.noseBandage, icicles: h.icicles, vel: [h.speed, 0],
  };
  const hero = {
    s: 1, face: 1, t, pose: st.pose, expr: st.expr, phase: h.phase, sword: 'back', chip: st.chip, soot: st.soot,
    injury: { bandages: st.bandages, bump: st.bump, singed: st.singed, torn: st.torn },
    scarf: { len: st.scarf.len, glow: st.scarf.glow, notch: st.scarf.notch, hole: st.scarf.hole, frozen: st.scarf.frozen, vel: [h.speed, 0] },
  };
  return { st, horse, hero };
}
export function drawJourneyRider(g, p) {
  const { horse, hero } = journeyRiderParams(p.t);
  // 先求马的锚点（不画）定出鞍位与马镫，再画马 → 勇者 → 缰绳
  const probe = drawHorseProbe(horse);
  const rO = { ...hero, x: probe.saddle[0], y: probe.saddle[1], rot: probe.saddleRot };
  const foot = heroRig(rO).foot;
  const ha = drawHorse(g, { ...horse, stirrupAt: foot });
  const ra = drawHero(g, rO);
  if (ra && ra.handL) drawReins(g, ha.bit, ra.handL, { s: 1 });
  return { horse: ha, hero: ra };
}
// horseRig 与 drawHorse 同参数同锚点（只求锚点不画）
const drawHorseProbe = (o) => horseRig(o);

/** 一组纸鸽（world）：p = { t, list:[{ x, y, s, face, rot, seed }] }。 */
export function drawCrowdDoves(g, p) {
  return p.list.map((d) => drawDove(g, { ...d, t: p.t }));
}
/** 王座厅名字面板 + 对勾章（parallax 空间：按 TR-NIGHT 屏幕坐标设计，depth 1.1）。p = { panel:{…namePanel}, stamp:{…drawStampMark} }。 */
export function drawSeamPanel(g, p) {
  const r = namePanel(g, p.panel);
  if (p.stamp) drawStampMark(g, p.stamp);
  return r;
}

/** fn 名 → 函数。原函数签名不是 (g, o) 的已适配：drawBanner 读 params.path；drawMiniMap / drawNameWall 读 params.t；drawOccluder 读 params.t / cam / kind。 */
export const FN = {
  drawHero, drawKing, drawPrincess, drawHorse, drawDragon, drawLizard,
  drawCitizen, drawGuard, drawScribe, drawHerald, drawChild, drawDove,
  dialogBox, nameTagSmall, namePanel, marqueePlate, battleMenu, turnBanner, drawHUD, bubble,
  drawBow, drawFireworkShape, drawCage, drawStampMark,
  drawBanner: (g, p) => drawBanner(g, p.path, p),
  drawMiniMap: (g, p) => drawMiniMap(g, p.t, p),
  drawNameWall: (g, p) => drawNameWall(g, p.t, p),
  drawOccluder: (g, p) => drawOccluder(g, p.t, p.cam, p.kind ?? 'all'),
  drawSeamConfetti, drawSeamFireworks, drawSeamStalactites, drawJourneyRider, drawSeamPanel, drawCrowdDoves, drawHeroBanner,
  drawCrowd: drawCrowdP,
};

// ———————————————————— 共用片段 ————————————————————
const C = (id) => cue(id);
/** 王座厅（晴）的推荐图层：throneLayer(层, 'sunny')。 */
const TR_LAYERS = (light, uiO, extraMain = [], afterMain = [], midExtra = ['courtiers']) => [
  { id: 'back', o: throneLayer('back', light), draw: ['env:back'] },
  { id: 'mid', o: throneLayer('mid', light), draw: ['env:mid', ...midExtra] },
  { id: 'main', o: throneLayer('main', light), draw: ['env:main', ...extraMain] },
  ...afterMain,
  { id: 'glow', o: null, draw: ['env:glow'] },
  { id: 'fg', o: throneLayer('fg', light), draw: ['env:fg'] },
  ...(uiO ? [uiO] : []),
];

// —— 王座厅勇者站位（脚底，THRONE.spots.hero = (620,880)）——
const HERO_TR = { x: THRONE.spots.hero[0], y: THRONE.spots.hero[1] };

// —— b05|b06：两侧礼炮的彩纸（55.75 = N4c + 0.04 喷出；两块都画同一组 burst，彩纸 57.4 前后落定、58.1 全部消失） ——
export const CONFETTI_N4C = Object.freeze([
  Object.freeze({ at: C('N4c') + 0.04, seed: 551, count: 60, x: 250, y: 860, spread: 18, speed: [900, 1700], angle: [-1.45, -0.85], gravity: 300, drag: 2.0, life: [1.6, 2.4], spin: [-9, 9], size: [13, 21] }),
  Object.freeze({ at: C('N4c') + 0.04, seed: 552, count: 60, x: 1830, y: 770, spread: 18, speed: [900, 1700], angle: [-2.3, -1.7], gravity: 300, drag: 2.0, life: [1.6, 2.4], spin: [-9, 9], size: [13, 21] }),
]);
/** 圣旨横幅扫光：56.60 从左端起扫、0.6s 扫完（57.20）；之前 −1、之后 > 1 都不画（drawDecree 的约定）。 */
export const decreeSweep = (T) => (T >= C('I1') - 0.29 ? (T - (C('I1') - 0.29)) / 0.6 : -1);
/** 地上彩纸：L13 的残留 0.35，N4c 礼炮后 55.9–57.4 铺满到 1。 */
export const throneConfettiFloor = (T) => 0.35 + 0.65 * smoothstep(C('N4c') + 0.19, C('I1') + 0.51, T);

// —— b07|b08：大橡树中线的屏幕 x（接缝遮挡检查用；90.00 时 ≈ 696，89.94–90.02 树干完全挡住骑手） ——
export const oakScreenX = (T) => occluderX(T, 'oak', journeyCam(T));
// —— b07|b08：旅途整帧后期（M 区正午 sat 1.1 → V 区金色午后 tint goldLight screen 0.10；89.85–89.95 在橡树后交叉过渡） ——
export function journeyFx(T) {
  const k = smoothstep(C('V09') - 0.3, C('V09') - 0.2, T);
  return { sat: lerp(1.1, 1.0, k), tint: PAL.goldLight, tintAlpha: 0.1 * k, tintMode: 'screen' };
}

// —— b10|b11：撞墙冲击（I2 = 120.97 起；b10 自己的震动 / 闪白 / 推近必须在 120.94 前衰减干净） ——
export const IMPACT_I2 = Object.freeze({ at: C('I2'), flash: 0.6, flashDecay: 0.12, shake: Object.freeze({ amp: 24, decay: 0.3, freq: 24, seed: 9 }) });
export function caveImpactFx(T) {
  const I = IMPACT_I2;
  const fx = { contrast: 1.1, vignette: 0.5, vignetteColor: PAL.dragonDeep };
  if (T >= I.at) { fx.flash = I.flash * hit(T, I.at, I.flashDecay); fx.shake = shake(T, I.at, I.shake); }
  return fx;
}
/** D3 结尾掉下的三根钟乳石（back 层 depth 0.5 世界坐标，洞顶 y≈10）。 */
export const STALACTITES_D3 = Object.freeze([
  Object.freeze({ x: 760, y: 12, len: 132, w: 36, seed: 71, at: 120.75, rot: 0.06 }),
  Object.freeze({ x: 1215, y: 6, len: 156, w: 40, seed: 72, at: 120.8, rot: -0.05 }),
  Object.freeze({ x: 985, y: 10, len: 118, w: 32, seed: 73, at: 120.9, rot: 0.04 }),
]);
const HERO_CAVE_X = 150;

// —— b15|b16：礼物城堡（世界坐标 depth 1，cam(960,540,0.9)）——
/** 阳台三人脚底 x（主体层世界坐标，地板 y=590；裁定：避开左侧花箱 x 860–922）。 */
export const BALCONY_X = Object.freeze({ hero: 935, princess: 985, king: 1035 });
/** 国王王冠的尾声角度（度）：E09 之后一直 12，O06（195.68）起自己回正，b16|b17 时为 0。 */
export const KING_CROWN_TILT = 12;
/**
 * 勇者横幅（style 'hero'，60px，一条路径，集成负责人裁定 2026-10-01）：起点在画左 (120,330)（纸鸽从这里起飞往右拉），
 * 短引线（字前 ≈38 世界单位）→ 13 个字从左往右沿一道上升的弧横过左半边天空（在旗子上方、彩旗串下方）→ 到尖塔左侧 (900,214)
 * 接 drawCastle 的 ribbonWrap 绕塔一圈 → 蝴蝶结（BOW_AT）。
 * HERO_BANNER_LEAD / HERO_BANNER_NAME 是同一条路径按“第一个字之前 / 之后”切开的两段（兼容旧接口）；画法一律 drawHeroBanner。
 */
export const HERO_BANNER_PATH = Object.freeze([
  [120, 330], [200, 262], [330, 210], [480, 182], [640, 172], [780, 180], [870, 196], [900, 214],
].map((p) => Object.freeze(p)));
export const HERO_BANNER_LEAD = Object.freeze(HERO_BANNER_PATH.slice(0, 2));
export const HERO_BANNER_NAME = Object.freeze(HERO_BANNER_PATH.slice(1));
/** 勇者横幅的绘制参数（drawBanner 的 o，不含 grow / retract / t）。 */
export const HERO_BANNER_STYLE = Object.freeze({ style: 'hero', size: 60, tail: false });
/**
 * 勇者横幅。p = { t, grow=1（展开到哪）, retract=0（O01 卷尺式弹回起点）, retractT（回弹开始后的秒数，脱落的字据此飘落）, alpha }。
 * 就是 drawBanner(g, HERO_BANNER_PATH, { ...HERO_BANNER_STYLE, grow, retract, retractT, t, alpha })；返回 drawBanner 的返回值。
 */
export function drawHeroBanner(g, p) {
  const o = { ...HERO_BANNER_STYLE, grow: p.grow ?? 1, retract: p.retract ?? 0, t: p.t };
  if (p.retractT !== undefined) o.retractT = p.retractT;
  if (p.alpha !== undefined) o.alpha = p.alpha;
  return drawBanner(g, HERO_BANNER_PATH, o);
}
/**
 * 公主竖幅（style 'princess'，54px；配色按裁定：底 princessLight、字 red、gold 边）：起点 = 阳台栏杆（公主身前）(985,566)；
 * 竖直垂下 6 字（米娅莫拉苏娜）→ 落地拐弯在地上向右 5 字（丹妮谢莉红）→ 末端被第二只纸鸽提起，从城堡后面（屋顶、城墙、塔群之后）升到尖塔右侧接蝴蝶结。
 */
export const PRINCESS_BANNER_PATH = Object.freeze([
  [985, 566], [985, 700], [986, 850], [988, 905], [1000, 925], [1030, 932], [1180, 933], [1346, 930],
  [1446, 906], [1530, 830], [1566, 700], [1544, 560], [1474, 440], [1344, 362], [1204, 324], [1084, 268], [1012, 234],
].map((p) => Object.freeze(p)));
/** 弧长比例：路径从起点到第 idx 个控制点（与 drawBanner 内部同一个 samplePath(path, 8)）。 */
export function pathFrac(path, idx) {
  const sp = samplePath(path, 8);
  let n = 0;
  for (let i = 0; i < idx; i++) n += Math.max(1, Math.ceil(Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]) / 8));
  return sp.L[n] / sp.total;
}
/** 公主竖幅在城堡前 / 后的分界（弧长比例，= 地面右端第 7 个控制点）：[0, PRINCESS_FRONT] 画在城堡前（带字），[PRINCESS_FRONT, 1] 画在城堡主体层之前（被塔挡住）。 */
export const PRINCESS_FRONT = pathFrac(PRINCESS_BANNER_PATH, 7);
/** 公主竖幅的绘制参数（drawBanner 的 o，不含 path / grow / range / retract / t）：裁定配色 princessLight 底、red 字、gold 边。 */
export const PRINCESS_BANNER_STYLE = Object.freeze({ style: 'princess', size: 54, base: PAL.princessLight, ink: PAL.red, edge: PAL.gold, tail: false });
/** 蝴蝶结（结心世界坐标 + drawBow 参数）：左环勇者色 skyDayLow、右环公主色 princessLight。 */
export const BOW_AT = Object.freeze([961, 228]);
export const BOW_STYLE = Object.freeze({ s: 0.55, rot: 0, left: PAL.skyDayLow, right: PAL.princessLight });
/** 184.80–185.40 的五朵纸烟花（drawFireworkShape，life 1.7：186.5–187.1 前后熄灭，b16 继续画到熄灭）。都放在天上空处，不压旗、不压横幅。 */
export const FIREWORKS_E12 = Object.freeze([
  Object.freeze({ x: 1610, y: 150, size: 230, shape: 'heart', at: 184.8, seed: 31 }),
  Object.freeze({ x: 1810, y: 470, size: 210, shape: 'star', at: 184.95, seed: 32 }),
  Object.freeze({ x: 260, y: 760, size: 190, shape: 'heart', at: 185.1, seed: 33 }),
  Object.freeze({ x: 1380, y: 95, size: 180, shape: 'star', at: 185.25, seed: 34 }),
  Object.freeze({ x: 1840, y: 760, size: 170, shape: 'star', at: 185.4, seed: 35 }),
]);
/** 彩纸如雨（184.80 / 184.92 / 185.04 三阵，从画面上方往下飘；life 2.6–3.4，188.4 前全部消失）。 */
export const CONFETTI_E12 = Object.freeze([
  Object.freeze({ at: 184.8, seed: 181, count: 40, x: 420, y: -120, spread: 160, speed: [80, 420], angle: [0.4, 2.7], gravity: 230, drag: 1.1, life: [2.6, 3.4], spin: [-8, 8], size: [14, 22] }),
  Object.freeze({ at: 184.92, seed: 182, count: 40, x: 960, y: -160, spread: 180, speed: [80, 420], angle: [0.4, 2.7], gravity: 230, drag: 1.1, life: [2.6, 3.4], spin: [-8, 8], size: [14, 22] }),
  Object.freeze({ at: 185.04, seed: 183, count: 40, x: 1500, y: -120, spread: 160, speed: [80, 420], angle: [0.4, 2.7], gravity: 230, drag: 1.1, life: [2.6, 3.4], spin: [-8, 8], size: [14, 22] }),
]);

// —— b16|b17：取名面板（按 TR-NIGHT 屏幕坐标设计，depth 1.1 视差） ——
/** 收拢前的 8 格外框屏幕矩形（比 N2 的 (440,250) 左移 40：收拢后 3 格面板中心 x=920，不挡右尖拱窗里的月亮）。 */
export const PANEL_O06 = Object.freeze({ x: 400, y: 250, w: 1040, h: 370 });

// ———————————————————— 七份合同 ————————————————————
export const SEAMS = {
  // ═══════════════ 1. b04 → b05 · 41.90（N1a）· 王座厅 TR-2S ═══════════════
  'b04|b05': {
    key: 'b04|b05', A: 'b04', B: 'b05', T: C('N1a'), cueId: 'N1a', loc: 'THRONE（晴）',
    title: '问名 → 报名：空对话框、名签「？？？」',
    cam: TR.TR_2S, drift: DRIFT,
    env: { fn: 'drawThroneRoom', params: { light: 'sunny', windowL: 'day', windowR: 'day', lectern: true, confettiFloor: 0.35 } },
    layers: TR_LAYERS('sunny', { id: 'ui', o: { shadow: 10, texture: 0.3 }, draw: ['headTag', 'dialog'] }, ['guardL', 'herald', 'scribe', 'king', 'hero']),
    actors: [
      {
        id: 'courtiers', fn: 'drawCrowd', space: 'world', depth: 0.9,
        params: { t: NOW, members: [
          { variant: 0, x: 300, y: 880, face: 1, pose: 'lean', courtier: true, seed: 11 },
          { variant: 3, x: 430, y: 880, face: 1, pose: 'lean', courtier: true, seed: 12 },
          { variant: 6, x: 545, y: 880, face: 1, pose: 'lean', courtier: true, seed: 13 },
        ] },
        note: '朝臣三人（depth 0.9，后墙前、勇者身后），lean 前倾看勇者；画在 mid 层里（柱子之后、地面之前）。',
      },
      { id: 'guardL', fn: 'drawGuard', space: 'world', params: { x: 1240, y: 880, s: 1, face: -1, t: NOW, pose: 'lean', hat: false, variant: 0 }, note: '卫兵（无高帽：广场被吹飞了）朝勇者前倾；身体几乎全被对话框挡住，只露矛尖。另一名卫兵 (1880,790) 在画外。' },
      { id: 'herald', fn: 'drawHerald', space: 'world', params: { x: 980, y: 880, s: 1, face: -1, t: NOW, pose: 'idle', joints: { lean: 9 } }, note: '传令官（大半在对话框后），前倾 9°。' },
      { id: 'scribe', fn: 'drawScribe', space: 'world', params: { x: 1150, y: 880, s: 1, face: -1, t: NOW, pose: 'idle', expr: 'focused', joints: { lean: 6 } }, note: '书记官站在讲台位（41.20 已蘸墨，举着本子准备记）；只露头顶。' },
      { id: 'king', fn: 'drawKing', space: 'world', params: { x: 1500, y: 790, s: 1, face: -1, t: NOW, pose: 'leanForward', expr: 'joy', crown: { tilt: 15, slip: 0.12 } }, note: '国王站在台阶上探身（L14 起王冠前滑：tilt 15、slip 0.12，K1 沿用）。' },
      {
        id: 'hero', fn: 'drawHero', space: 'world',
        params: { x: HERO_TR.x, y: HERO_TR.y, s: 1, face: 1, t: NOW, pose: 'inhale', expr: 'normal', inflate: 1, ahoge: 'straight', sword: 'back', scarf: { len: 780, wind: [-20, -150] } },
        note: '吸气到最鼓：pose inhale + inflate 1（身体 1.25 倍、腮帮鼓）；呆毛 straight（L16 弹直）；围巾被气流掀起（wind [-90,-260]）。告示卷已不在手上。',
      },
    ],
    props: [],
    ui: [
      { id: 'headTag', fn: 'nameTagSmall', space: 'follow', depth: 1, at: [590, 548], params: { text: '？？？', kind: 'head', size: 40, t: NOW }, note: '勇者头顶小名签「？？？」（L15 38.11 与对话框名签同时翻出，保持到 56.30）。屏幕坐标，锚在世界点 (624,556) 随机位走。' },
      { id: 'dialog', fn: 'dialogBox', space: 'screen', params: { speaker: 'hero', tag: '？？？', text: '', cursor: true, textArea: { x: 600, w: 784 }, t: NOW }, note: '对话框：默认矩形 (420,690)–(1500,900)；勇者头像在左端、红名签「？？？」；空文字、闪烁光标（周期 0.4s，相位 = T mod 0.4，41.90 正处在“灭”的半周期）；文字区 x 600–1384 留给 N1 的 8 个 120px 字。' },
    ],
    fx: { sat: 1.05 },
    motion: 'A（b04）：39.91–40.50 拉回 TR-2S 后机位只剩 drift；40.60 全场前倾、41.20 起保持；勇者吸气到 41.60 已鼓满，41.60–41.90「咳咳」逐字弹走（erase 0→1），最后一帧对话框已空。B（b05）：41.90 起勇者 0.12s 内放气开喊（inflate 1→0、inhale→shout/proud），「达」在 41.90 弹进框（outBack，从 0 开始）；机位 41.90 起 glide 缓推到 cam(1080,640,1.42)（起点速度为 0）；光标可在 41.90 直接关掉（此刻正好是灭相）。',
    notes: [
      '对话框 / 名签 / 头像全部用 dialogBox 同一组参数；t 一律传 T（光标与头像眨眼相位才一致）。',
      '地上彩纸 confettiFloor 0.35 是 L13 两把彩纸的残留，两块都保持到 55.9（见 b05|b06）。',
      '图层：back / mid（含朝臣）/ main（布景 + 人物）/ glow（直接画）/ fg / ui，共 5 个 ctx.layer。',
    ],
  },
  // ═══════════════ 2. b05 → b06 · 56.89（I1）· 王座厅 TR-HIGH ═══════════════
  'b05|b06': {
    key: 'b05|b06', A: 'b05', B: 'b06', T: C('I1'), cueId: 'I1', loc: 'THRONE（晴）',
    title: '金印之后：圣旨横幅、彩纸、全名溢出',
    cam: TR.TR_HIGH, drift: DRIFT,
    env: {
      fn: 'drawThroneRoom',
      params: { light: 'sunny', windowL: 'day', windowR: 'day', lectern: true, decree: { hung: 1, chars: 13, sweep: decreeSweep }, confettiFloor: throneConfettiFloor },
    },
    layers: TR_LAYERS('sunny', { id: 'ui', o: { shadow: 10, texture: 0.3 }, draw: ['headTag'] }, ['guardL', 'scribe', 'herald', 'guardR', 'king', 'hero'],
      [{ id: 'confetti', o: { shadow: 3, texture: 0.12 }, draw: ['confetti'] }]),
    actors: [
      {
        id: 'courtiers', fn: 'drawCrowd', space: 'world', depth: 0.9,
        params: { t: NOW, members: [
          { variant: 0, x: 300, y: 880, face: 1, pose: 'cheer', courtier: true, seed: 11 },
          { variant: 3, x: 430, y: 880, face: 1, pose: 'cheer', courtier: true, seed: 12 },
          { variant: 6, x: 545, y: 880, face: 1, pose: 'cheer', courtier: true, seed: 13 },
        ] },
        note: '同一组朝臣（位置不变），cheer 欢呼。',
      },
      { id: 'guardL', fn: 'drawGuard', space: 'world', params: { x: 1240, y: 880, s: 1, face: -1, t: NOW, pose: 'cheer', hat: false, variant: 0 }, note: '卫兵欢呼（仍无高帽）。' },
      { id: 'scribe', fn: 'drawScribe', space: 'world', params: { x: 1150, y: 880, s: 1, face: -1, t: NOW, pose: 'idle', expr: 'happy' }, note: '书记官展开完圣旨后回到讲台位（圣旨已吊成横幅，手里只剩本子）。' },
      { id: 'herald', fn: 'drawHerald', space: 'world', params: { x: 980, y: 880, s: 1, face: 1, t: NOW, pose: 'blow' }, note: '传令官还在吹号（55.75 起）。' },
      { id: 'guardR', fn: 'drawGuard', space: 'world', params: { x: 1880, y: 790, s: 1, face: -1, t: NOW, pose: 'cheer', hat: false, variant: 2 }, note: '台阶顶层的卫兵欢呼（TR-HIGH 下被右侧前景虚化立柱挡住，仍要画：b06 降机位后会露出来）。' },
      { id: 'king', fn: 'drawKing', space: 'world', params: { x: 1500, y: 790, s: 1, face: -1, t: NOW, pose: 'sealRaise', expr: 'joy', holding: 'seal', crown: { tilt: 12, slip: 0.2, squash: 0.4 } }, note: '国王站在台阶上把金印举过头顶；王冠被气球线勒过：歪 12°、下滑 0.2、压扁 0.4（之后一直这样歪到 E07）。' },
      { id: 'hero', fn: 'drawHero', space: 'world', params: { x: HERO_TR.x, y: HERO_TR.y, s: 1, face: 1, t: NOW, pose: 'cheer', expr: 'laugh', ahoge: 'normal', sword: 'back', scarf: { len: 780 } }, note: '勇者欢呼（双臂上举，cheer 的弹跳由 t 驱动）。' },
    ],
    props: [
      { id: 'confetti', fn: 'drawSeamConfetti', space: 'world', depth: 1, params: { t: NOW, bursts: CONFETTI_N4C }, note: '两侧礼炮 55.75 喷出的 120 片彩纸（CONFETTI_N4C），此刻在大厅半空往下飘。' },
    ],
    ui: [
      { id: 'headTag', fn: 'nameTagSmall', space: 'follow', depth: 1, at: [597, 548], params: { text: NAMES.hero, kind: 'head', size: 40, spill: 1, t: NOW }, note: '头顶名签 56.30 已换成全名（spill 1：签内的字正常、两头溢出的字带纸边下垂）。' },
    ],
    fx: { sat: 1.05 },
    motion: 'A（b05）：56.00–56.80 glide 拉到 TR-HIGH 后静止只剩 drift；圣旨 56.80 吊好（hung 1），56.60 起扫光 decreeSweep(T)；三行印章字 56.80 前已飞回圣旨；彩纸（55.75 的两阵 burst）在半空往下飘；全场 cheer 循环。B（b06）：同一 decreeSweep 走完（57.30），同一 burst 彩纸 57.4 前后落定，地上彩纸 throneConfettiFloor 铺满；57.40 国王张嘴前保持 TR-HIGH 不动。',
    notes: [
      '圣旨横幅用 drawThroneRoom 的 decree 参数画（mid 层，世界 x 260–1880、y 218–322），不要另画 drawDecree。',
      '彩纸用 drawSeamConfetti(g, { t: T, bursts: CONFETTI_N4C })，画在 main 之后单独一层（shadow 3）；b06 照样画到它们消失。',
      '卫兵在王座厅里一直不戴高帽；N4c 的“卫兵抛帽”改成双臂上举欢呼（或抛的是传令官的号旗），接缝帧不出现帽子。',
    ],
  },

  // ═══════════════ 3. b07 → b08 · 90.00（V09 − 0.15）· 旅途长卷，藏在大橡树后 ═══════════════
  'b07|b08': {
    key: 'b07|b08', A: 'b07', B: 'b08', T: C('V09') - 0.15, cueId: 'V09−0.15', loc: 'JOURNEY（M 区 → V 区）',
    title: '旅途一镜到底：接缝藏在大橡树后',
    cam: null, camAt: (T) => journeyCam(T), drift: '内置在 journeyCam(T)（amp 5, speed 0.35, seed 21），不要再叠',
    hidden: { by: 'oak', x: oakScreenX, window: [C('V09') - 0.25, C('V09') - 0.05], covers: [C('V09') - 0.21, C('V09') - 0.13], note: '90.00 ± 0.1s 内大橡树（drawOccluder 的 oak）在画面上，中线屏幕 x = oakScreenX(T)：89.90→1176、89.9667→854、90.00→696、90.0333→538、90.10→225；树干中段宽约 440，89.94–90.02（covers）完全挡住骑手（屏幕 x≈700–840）。HUD、小地图、橡树左边拖地的围巾仍露在外面，必须两边逐像素一致。' },
    env: { fn: 'drawJourney', params: {} },
    layers: [
      { id: 'sky', o: null, draw: ['env:sky'] },
      { id: 'far', o: (T, E) => ({ shadow: 4, texture: 0.22, texOffset: journeyTexOffset(E.c, 0.25) }), draw: ['env:far'] },
      { id: 'mid', o: (T, E) => ({ shadow: 7, texture: 0.28, texOffset: journeyTexOffset(E.c, 0.8) }), draw: ['env:mid'] },
      { id: 'main', o: (T, E) => ({ shadow: 10, texture: 0.3, texOffset: journeyTexOffset(E.c, 1) }), draw: ['env:main', 'rider', 'env:front'] },
      { id: 'light', o: null, draw: ['env:light'] },
      { id: 'fg', o: { blur: 4, shadow: 12 }, draw: ['env:fg'] },
      { id: 'occluder', o: { blur: 6 }, draw: ['oak'] },
      { id: 'hud', o: { shadow: 8 }, draw: ['hud', 'minimap'] },
    ],
    actors: [
      { id: 'rider', fn: 'drawJourneyRider', space: 'world', depth: 1, params: { t: NOW }, note: '白马 + 骑手 + 缰绳：参数全部来自 journeyRiderParams(T)（= heroJourneyState(T) 的逐项映射），两块逐字调用同一个函数或照抄映射。' },
    ],
    props: [
      { id: 'oak', fn: 'drawOccluder', space: 'screen', params: { t: NOW, cam: (T, E) => E.c, kind: 'all' }, note: '换区遮挡物（此刻只有大橡树），屏幕空间，单独一层 blur 6。' },
    ],
    ui: [
      { id: 'hud', fn: 'drawHUD', space: 'screen', params: (T) => ({ ...hudState(T), t: T }), note: 'drawHUD(g, { ...hudState(T), t: T })：LV 4、名字牌露 9 字 + 省略号、心 4、金币 ×12。' },
      { id: 'minimap', fn: 'drawMiniMap', space: 'screen', params: (T) => ({ ...hudState(T).mini, t: T }), note: 'drawMiniMap(g, T, hudState(T).mini)：小骑士 r ≈ 0.39（草原末端）。' },
    ],
    fx: journeyFx,
    motion: '机位按 journeyCam 匀速向右（≈400 px/s，zoom 1），勇者恒在屏幕 x≈758；白马 trot（V08+0.09 起），90.15 起 trot→walk 过渡（HORSE_SCHED）；大橡树 89.85–90.05 以约 4800 px/s 从右往左扫过（89.95 过中线）。b07 的一切换区动作（M→V 天色、远景）都交给 drawJourney 自己在橡树中线处切；b08 不做任何“入场”。',
    notes: [
      '两块逐层调用同一组函数：journeyCam(T) / drawJourney(各层) / journeyRiderParams(T) / drawOccluder / drawHUD(hudState) / drawMiniMap(hudState.mini)，图层与 texOffset 按 layers 表。',
      '整帧后期用 journeyFx(T)：89.85–89.95 在橡树后由 M 区（sat 1.1）过渡到 V 区（tint goldLight screen 0.10），89.95 起两边恒为 V 区值。',
      'b07 的其它屏幕元素（经验条 expBig、LV UP 徽章、创可贴飞走等）必须在 89.85 前结束；b08 的纸鸽、风车开转等事件从 90.15（V09）开始。',
    ],
  },

  // ═══════════════ 4. b10 → b11 · 120.97（I2）· 龙洞 CV-LOW ═══════════════
  'b10|b11': {
    key: 'b10|b11', A: 'b10', B: 'b11', T: C('I2'), cueId: 'I2', loc: 'CAVE（水晶全亮）',
    title: '石碑名字墙：龙吼到顶 → 撞墙第一帧',
    cam: CV.CV_LOW_END, drift: DRIFT,
    env: { fn: 'drawCave', params: { light: 'lit', rubble: { at: C('I2'), cooled: 0 } } },
    layers: [
      { id: 'back', o: { shadow: 6, texture: 0.3 }, draw: ['env:back', 'stalactites'] },
      { id: 'mid', o: { shadow: 8, texture: 0.3 }, draw: ['env:mid'] },
      { id: 'main', o: { shadow: 10, texture: 0.3 }, draw: ['env:main', 'cageBack', 'princess', 'cageFront', 'dragon', 'wall', 'hero'] },
      { id: 'fg', o: { blur: 4 }, draw: ['env:fg'] },
      { id: 'ui', o: { shadow: 10, texture: 0.25 }, draw: ['roar'] },
    ],
    actors: [
      { id: 'princess', fn: 'drawPrincess', space: 'world', params: { x: CAVE.cage.floor[0], y: CAVE.cage.floor[1], s: CAVE.cage.princessS, face: -1, t: NOW, pose: 'pickLock', expr: 'tense' }, note: '笼中公主还在撬锁（第一颗锁芯 131.20 才开）。' },
      {
        id: 'dragon', fn: 'drawDragon', space: 'world',
        params: { pose: 'wall', t: NOW, jaw: 1, wings: 1, eyes: { state: 'angry', red: 0.5 }, spikes: 0.5, redden: 0.4, vein: 1, plates: Array.from({ length: 13 }, () => ({ lit: 1 })) },
        note: 'wall 姿态直立在墙后（头 (1180,250)），吼到最大（jaw 1），13 块背板全亮，背刺 0.5、脸红 0.4、青筋 1。',
      },
      {
        id: 'hero', fn: 'drawHero', space: 'world',
        params: { x: HERO_CAVE_X, y: groundAt(HERO_CAVE_X), s: 1, face: 1, t: NOW, pose: 'shieldFace', expr: 'hurt', ahoge: 'candle', flame: 0, soot: 0.6, chip: true, sword: 'back',
          injury: { bandages: 1, bump: true, singed: true, torn: true }, scarf: { len: 936, glow: 0.6, notch: true, hole: true } },
        note: '勇者缩在左下（世界 x=150，墙左端外侧）抬臂挡脸；脸上还有 0.6 的黑灰、呆毛烧成蜡烛芯（火苗已灭）；伤痕与围巾状态 = 旅途结束时（创可贴 1、包、焦发、破袖、剑崩口、围巾缺口 + 破洞 + 金边）。',
      },
    ],
    props: [
      { id: 'stalactites', fn: 'drawSeamStalactites', space: 'world', depth: 0.5, params: { t: NOW, list: STALACTITES_D3 }, note: '120.75 / 120.80 / 120.90 从洞顶掉下的三根钟乳石（back 层），按 y = y0 + ½·2000·age² 继续往下掉，b11 画到它们落进墙后。' },
      { id: 'cageBack', fn: 'drawCage', space: 'world', params: { x: CAVE.cage.x, y: CAVE.cage.y, part: 'back', tally: 12, lock: { pins: 0 }, light: 1 } },
      { id: 'cageFront', fn: 'drawCage', space: 'world', params: { x: CAVE.cage.x, y: CAVE.cage.y, part: 'front', tally: 12, lock: { pins: 0 }, light: 1 }, note: '鸟笼吊在 (1320,330)，“正”字刻痕 12 画，锁芯 0。' },
      { id: 'wall', fn: 'drawNameWall', space: 'world', params: { t: NOW, glow: 1, burst: C('I2') }, note: '名字墙：dropAt 用默认（NAME_TIMES D3a/D3b），burst = 120.97。T < 120.97 时完好；T = 120.97 起由同一函数画撞碎（b11 的第一帧就是撞碎第一帧）。' },
    ],
    ui: [
      {
        id: 'roar', fn: 'bubble', space: 'follow', depth: 1, at: (T, E) => E.A.dragon.mouth,
        params: (T, E) => ({ dx: -330, dy: -230, w: 520, h: 250, shape: 'jagged', text: '嗷——', textSize: 140, textFamily: 'display', tail: [E.A.dragon.mouth[0], E.A.dragon.mouth[1]], t: T, seed: 7 }),
        note: '120.70 弹出的吼声气泡「嗷——」（display 140px），泡心在龙嘴屏幕位置 + (−330,−230)，泡尾指向龙嘴；b11 在撞墙时把它一起炸碎。',
      },
    ],
    fx: caveImpactFx,
    motion: 'A（b10）：117.70–120.90 机位 CV-LOW→CV-LOW-END（glide）结束后静止只剩 drift；13 块石碑全部落定（最后一块 120.71），120.70 吼：气泡弹出、背板全亮；b10 的砸落震动 / 推近 / 闪白在 120.94 前衰减到 0。B（b11）：120.97 第一帧 = 撞墙冲击的第一帧：名字墙 burst（同一 drawNameWall）、flash 0.6、shake 24（IMPACT_I2，已写进 fx），巨龙从 wall 姿态向左冲出；120.97–121.25 机位甩正到 cam(1000,560,1.1)。',
    notes: [
      '这一处“几乎像素一致”的意思：A 块 T−1/30 与 drawSeam(T−1/30) 一致（墙完好、无冲击），B 块 T 与 drawSeam(T) 一致（冲击第一帧）。冲击本身是 I2 的重音动作，两边用同一组参数（IMPACT_I2）。',
      '画序：鸟笼后片 → 公主 → 鸟笼前片 → 巨龙 → 名字墙 → 勇者（墙在龙前，勇者在墙左外侧）。',
      '气泡锚在龙嘴（drawDragon 的返回值 mouth，世界坐标）经 toScreen 的屏幕位置；b11 若要移动龙头，气泡跟着走或炸掉都行（T 之后）。',
    ],
  },

  // ═══════════════ 5. b12 → b13 · 150.52（B08）· 纸剧场 TT-W ═══════════════
  'b12|b13': {
    key: 'b12|b13', A: 'b12', B: 'b13', T: C('B08'), cueId: 'B08', loc: 'THEATER（紫灯，敌方回合）',
    title: '台口弹开：勇者偶被含在龙偶嘴里',
    cam: null, camAt: (T) => withDrift(theaterCam(T), T, DRIFT), drift: DRIFT,
    env: { fn: 'drawTheater', params: (T) => { const st = theaterState(T); return { ...st, cave: st.caveOpts }; } },
    layers: [
      { id: 'back', o: { shadow: 6, texture: 0.3 }, draw: ['env:back'] },
      { id: 'puppets', o: { shadow: 10, texture: 0.3 }, clip: (T, E) => theaterClip({ cam: E.c, scale: theaterState(T).scale }), draw: ['cageBack', 'princess', 'cageFront', 'dragon', 'hero'] },
      { id: 'frame', o: { shadow: 8, texture: 0.25 }, draw: ['env:frame'] },
      { id: 'ui', o: { shadow: 10, texture: 0.2 }, draw: ['env:frameFront', 'heroPlate', 'dragonPlate', 'banner', 'menu'] },
    ],
    actors: [
      { id: 'princess', fn: 'drawPrincess', space: 'world', params: { x: THEATER.cage.x, y: THEATER.cage.y + 62, s: 0.5, face: -1, t: NOW, pose: 'puppetCage', expr: 'shock', sign: 0 }, note: '笼中迷你偶（吊杆在右上），看见勇者被吃，吓一跳；152.80 才举「加油！」。' },
      { id: 'dragon', fn: 'drawDragon', space: 'world', params: { pose: 'puppet', t: NOW, jaw: 0.3, eyes: { state: 'angry' }, puff: 0.15 }, note: '龙偶回到原位（头 (1350,520)，双签 x 1300 / 1600），嘴合在勇者身上（jaw 0.3），腮帮微鼓。' },
      {
        id: 'hero', fn: 'drawHero', space: 'world',
        params: (T, E) => ({ x: E.A.dragon.mouth[0] - 4, y: E.A.dragon.mouth[1] + 52, s: 1, face: 1, t: T, pose: 'puppetInMouth', rod: true, rot: -0.85, scarf: { len: 936, glow: 0.6, notch: true, hole: true } }),
        note: '勇者偶只剩两条乱蹬的腿（puppetInMouth，腿的摆动由 t 驱动）：锚点 = 龙偶返回的 mouth + (−4, 52)，整体 rot −0.85（腿从嘴角斜着朝左下伸出），木杆跟着晃。',
      },
    ],
    props: [
      { id: 'cageBack', fn: 'drawCage', space: 'world', params: { x: THEATER.cage.x, y: THEATER.cage.y, mini: true, part: 'back', lock: { pins: 1 } } },
      { id: 'cageFront', fn: 'drawCage', space: 'world', params: { x: THEATER.cage.x, y: THEATER.cage.y, mini: true, part: 'front', lock: { pins: 1 } } },
    ],
    ui: [
      {
        id: 'heroPlate', fn: 'marqueePlate', space: 'world',
        params: (T) => { const st = theaterState(T), p = st.heroPlate; return { side: 'hero', state: p.state, progress: p.progress, mode: 'pass', crack: p.crack, peeled: p.peeled, drop: p.drop, hp: st.hp.hero, hpLag: st.hp.heroLag, hpText: `HP ${st.hp.heroNum}`, t: T }; },
        note: '勇者名字牌：全部取 theaterState(T).heroPlate / hp，并且两边都显式传 mode:"pass"（见 docs/seams.md 基础模块问题 1）——接缝帧窗口为空、HP 60、未裂。',
      },
      {
        id: 'dragonPlate', fn: 'marqueePlate', space: 'world',
        params: (T) => { const st = theaterState(T), p = st.dragonPlate; return { side: 'dragon', state: p.state, progress: p.progress, drop: p.drop, shrink: p.shrink, hp: st.hp.dragon, hpLag: st.hp.dragonLag, t: T }; },
        note: '巨龙名字牌：idle、progress 1（fit：窗里是“苏瓦西拉松”）、HP 70。',
      },
      { id: 'banner', fn: 'turnBanner', space: 'world', params: (T) => { const b = theaterState(T).banner; return { text: b.text, textFrom: b.prev, flip: b.flip < 1 ? b.flip : 0, drop: b.drop, t: T }; }, note: '回合横幅「敌方回合」。' },
      { id: 'menu', fn: 'battleMenu', space: 'world', params: (T) => { const m = theaterState(T).menu; return { pop: m.show, cursor: m.cursor === 'skill' ? m.cursorMove : 0, locked: m.gray, lockPop: m.lockPop, blink: m.flash, press: m.press, t: T }; }, note: '指令菜单：灰 + 小锁（敌方回合）。' },
    ],
    fx: {},
    motion: 'A（b12）：149.33 台口咬合、149.80–150.30 弹开（bite 的弹簧余振由 theaterState 给，150.52 已 < 0.01）；龙偶在咬合黑缝里回到原位，弹开后露出嘴里乱蹬的两条腿；HP 149.50–150.40 从 100 掉到 60。B（b13）：150.52 重音——龙偶“噗”地吐出勇者：jaw 0.24→0.7（0.1s），勇者偶从 mouth 锚点向左上倒飞（puppetInMouth → puppetKneel，150.90 落在 x=520 单膝跪地）；名字牌 150.60 裂开（theaterState.crack）。',
    notes: [
      '剧场的一切时序都只从 theaterState(T) 取（台口、灯、名字牌、菜单、HP、横幅）；机位 = withDrift(theaterCam(T), T, DRIFT)。',
      '木偶层裁进 theaterClip({ cam, scale })；名字牌 / 横幅 / 菜单画在剧场坐标（applyCam(cam, 1)），与 sheets/theater.js 的 ui() 同一映射。',
      '勇者名字牌：theaterState 在 150.52 把 state 从 idle（p=1）切成 cracked（p=0），默认 mode 会从 fit 跳成 pass、窗口内容从“卜多比鲁翁”变成空。合同规定两边都传 mode:"pass"：b12 最晚在咬合闭死（149.48，画面只剩黑缝）时切到 pass，名字“被吃掉”、窗口空着进入接缝。',
    ],
  },

  // ═══════════════ 6. b15 → b16 · 185.47（O01）· 王城婚礼 cam(960,540,0.9) ═══════════════
  'b15|b16': {
    key: 'b15|b16', A: 'b15', B: 'b16', T: C('O01'), cueId: 'O01', loc: 'CASTLE（婚礼装）',
    title: '礼物城堡：两条横幅绕尖塔系成蝴蝶结',
    cam: cam(960, 540, 0.9), drift: DRIFT,
    env: {
      fn: 'drawCastle',
      params: { time: 'wedding', deco: 1, flags: { chars: NAMES.city, at: NAME_TIMES('E04') }, ribbonWrap: { p: 1, color: PAL.skyDayLow } },
      onBalcony: ['lizard', 'hero', 'princess', 'king'],
    },
    layers: [
      { id: 'sky', o: CASTLE_FX.sky, draw: ['env:sky'] },
      { id: 'far', o: CASTLE_FX.far, draw: ['env:far'] },
      { id: 'mid', o: CASTLE_FX.mid, draw: ['env:mid', 'princessTail'] },
      { id: 'main', o: CASTLE_FX.main, draw: ['env:main'] },
      { id: 'near', o: CASTLE_FX.near, draw: ['env:near'] },
      { id: 'ribbons', o: { shadow: 8, texture: 0.25 }, draw: ['princessBanner', 'crowd', 'heroBanner', 'bow', 'doves'] },
      { id: 'fg', o: CASTLE_FX.fg, draw: ['env:fg'] },
      { id: 'sparkle', o: null, draw: ['fireworks', 'confetti'] },
    ],
    actors: [
      { id: 'hero', fn: 'drawHero', space: 'balcony', params: { x: BALCONY_X.hero, y: CASTLE.balcony.floorY, s: 0.26, face: 1, t: NOW, pose: 'cheer', expr: 'laugh', sword: 'back', scarf: { len: 300, notch: true, hole: true, patch: true, glow: 0.6 } }, note: '阳台左：勇者（s 0.26，x≈935）举手欢呼；围巾破洞上有粉色补丁。横幅起点已交给纸鸽拉到画左（O01 回弹时横幅收回他手里）。' },
      { id: 'lizard', fn: 'drawLizard', space: 'balcony', params: { x: BALCONY_X.hero - 7, y: 554, s: 0.3, face: 1, t: NOW, pose: 'ride' }, note: '小蜥蜴已回到勇者肩上（b16 186.20 跟着点头）。' },
      { id: 'princess', fn: 'drawPrincess', space: 'balcony', params: { x: BALCONY_X.princess, y: CASTLE.balcony.floorY, s: 0.26, face: -1, t: NOW, pose: 'bride', expr: 'laugh', veil: 1, tiara: true }, note: '阳台中：公主（头纱、小皇冠），竖幅系在她身前的栏杆上。' },
      { id: 'king', fn: 'drawKing', space: 'balcony', params: { x: BALCONY_X.king, y: CASTLE.balcony.floorY, s: 0.26, face: -1, t: NOW, pose: 'clap', expr: 'joy', festive: true, bandage: true, crown: { tilt: KING_CROWN_TILT } }, note: '阳台右：国王（节日长袍、头上绷带）拍手；王冠歪 12°（KING_CROWN_TILT，E09 之后一直 12，O06 才回正）。' },
      {
        id: 'crowd', fn: 'drawCrowd', space: 'world', depth: 1.1,
        params: { t: NOW, s: 0.3, members: [
          { variant: 1, x: 560, y: 1010, face: 1, pose: 'cheer', seed: 41 }, { variant: 4, x: 650, y: 1030, face: 1, pose: 'cheer', seed: 42 },
          { variant: 8, x: 760, y: 1005, face: 1, pose: 'cheer', seed: 43 }, { variant: 2, x: 1190, y: 1030, face: -1, pose: 'cheer', seed: 44 },
          { variant: 9, x: 1290, y: 1005, face: -1, pose: 'cheer', seed: 45 }, { variant: 5, x: 1390, y: 1030, face: -1, pose: 'cheer', seed: 46 },
          { variant: 10, x: 1480, y: 1010, face: -1, pose: 'cheer', seed: 47, villager: true },
        ] },
        note: '城下人群（坐标在 near 层 depth 1.1 的地面带，s 0.30）欢呼，刚把竖幅抛上天；画在 ribbons 层（站在横排竖幅前面）。',
      },
    ],
    props: [
      { id: 'princessTail', fn: 'drawBanner', space: 'world', depth: 1, params: { path: PRINCESS_BANNER_PATH, ...PRINCESS_BANNER_STYLE, grow: 1, range: [PRINCESS_FRONT - 0.002, 1], t: NOW }, note: '公主竖幅被纸鸽提起的那一段（无字）画在城堡后面（mid 层之后、main 之前），从塔群后面升到尖塔。' },
      { id: 'princessBanner', fn: 'drawBanner', space: 'world', depth: 1, params: { path: PRINCESS_BANNER_PATH, ...PRINCESS_BANNER_STYLE, grow: 1, range: [0, PRINCESS_FRONT], t: NOW }, note: '公主竖幅（princessLight 底、gold 边、red 字）：栏杆竖直垂下 6 字（米娅莫拉苏娜）→ 地面拐弯向右 5 字（丹妮谢莉红）。' },
      { id: 'heroBanner', fn: 'drawHeroBanner', space: 'world', depth: 1, params: { t: NOW, grow: 1, retract: 0 }, note: '勇者横幅（HERO_BANNER_STYLE：天蓝底、金边、深蓝字 60px，HERO_BANNER_PATH）：起点在画左 (120,330)，短引线后 13 字沿上升的弧从左往右横过左半边天空，到尖塔左侧 (900,214) 接 drawCastle 的 ribbonWrap 绕塔一圈。' },
      { id: 'bow', fn: 'drawBow', space: 'world', depth: 1, params: { x: BOW_AT[0], y: BOW_AT[1], ...BOW_STYLE, t: NOW, pop: 1 }, note: '大蝴蝶结（184.70 弹出）系在绕塔横幅的正前方：左环勇者色 skyDayLow、右环公主色 princessLight（BOW_STYLE）。' },
      { id: 'doves', fn: 'drawCrowdDoves', space: 'world', depth: 1, params: { t: NOW, list: [{ x: 1092, y: 128, s: 0.72, face: 1, seed: 1 }, { x: 1150, y: 196, s: 0.66, face: 1, seed: 2 }] }, note: '两只纸鸽在蝴蝶结右上方扑翼（系完结正要飞开），s 0.72 / 0.66、朝右。' },
      { id: 'fireworks', fn: 'drawSeamFireworks', space: 'world', depth: 1, params: { t: NOW, list: FIREWORKS_E12 }, note: '184.80–185.40 五朵纸烟花（FIREWORKS_E12），b16 画到熄灭（≤187.1）。' },
      { id: 'confetti', fn: 'drawSeamConfetti', space: 'world', depth: 1, params: { t: NOW, bursts: CONFETTI_E12 }, note: '彩纸如雨（CONFETTI_E12），b16 画到消失（≤188.4）。' },
    ],
    ui: [],
    fx: { sat: 1.1 },
    motion: 'A（b15）：183.20–185.30 glide 拉远到 cam(960,540,0.9) 后静止只剩 drift；横幅展开阶段纸鸽从左往右拉、按阅读顺序露字（drawHeroBanner 的 grow）；184.40 绕塔、184.70 蝴蝶结弹出，184.80 起烟花与彩纸。B（b16）：185.47「唰！」两条横幅沿原路弹回（drawHeroBanner 与两次 drawBanner 都传同一个 retract 0→1、retractT = T − 185.47，185.47–185.75），绕塔一圈与蝴蝶结同时松开消失；烟花 / 彩纸画到自然结束；185.60–186.30 机位推回 CA-BAL；天光 186.20 起由 wedding 转 sunset。',
    notes: [
      '阳台上三人走 drawCastle 的 onBalcony 回调（在门前、栏杆后，自动在主体层机位里）：画序 小蜥蜴 → 勇者 → 公主 → 国王。',
      '公主竖幅画两次：range [0, PRINCESS_FRONT] 在城堡前（带字），[PRINCESS_FRONT, 1] 在城堡主体层之前（被塔挡住）。勇者横幅整条在前。',
      '13 面城名旗：flags = { chars: NAMES.city, at: NAME_TIMES("E04") }（全部早已升起）。',
    ],
  },

  // ═══════════════ 7. b16 → b17 · 197.77（O07）· 王座厅夜景 TR-NIGHT ═══════════════
  'b16|b17': {
    key: 'b16|b17', A: 'b16', B: 'b17', T: C('O07'), cueId: 'O07', loc: 'THRONE（夜）',
    title: '刚好 3 格：王浩然，全家松口气',
    cam: TR.TR_NIGHT, drift: DRIFT,
    env: {
      fn: 'drawThroneRoom',
      params: { light: 'night', windowL: 'winter', windowR: 'moon', moonPhase: 0, candles: true,
        ruler: [{ h: 110, at: C('O04') }, { h: 160, at: 192.3 }, { h: 200, at: 192.95 }] },
    },
    layers: TR_LAYERS('night', { id: 'panel', o: { shadow: 12, texture: 0.25 }, draw: ['panel'] }, ['scribe', 'king', 'princess', 'child', 'lizard', 'hero'], [], []),
    actors: [
      { id: 'scribe', fn: 'drawScribe', space: 'world', params: { x: 1290, y: 880, s: 1, face: -1, t: NOW, pose: 'deflate', tower: 1 }, note: '书记官瘪下去，背上的纸卷塔已经倒了、纸卷滚了一地（tower 1）。' },
      { id: 'king', fn: 'drawKing', space: 'world', params: { x: THRONE.spots.kingSit[0], y: THRONE.spots.kingSit[1], s: 1, face: -1, t: NOW, pose: 'slump', expr: 'relieved', crown: { tilt: 0, slip: 0 } }, note: '国王瘫在王座上（坐姿锚点 = 座面 (1580,660)），王冠 197.00 已自己回正。' },
      { id: 'princess', fn: 'drawPrincess', space: 'world', params: { x: 1092, y: 880, s: 1, face: -1, t: NOW, pose: 'deflate', expr: 'relieved', tiara: true }, note: '公主在孩子右边瘪下去。' },
      { id: 'child', fn: 'drawChild', space: 'world', params: { x: 885, y: 880, s: 1, face: 1, t: NOW, stage: 'older', pose: 'stand', expr: 'laugh', shortScarf: true }, note: '孩子王浩然（少年 200）站在面板正下方，系着短红围巾，笑得眼睛眯起来。' },
      { id: 'lizard', fn: 'drawLizard', space: 'world', params: { x: 985, y: 880, s: 1, face: 1, t: NOW, pose: 'flat' }, note: '小蜥蜴直接趴平在孩子脚边。' },
      { id: 'hero', fn: 'drawHero', space: 'world', params: { x: 715, y: 880, s: 1, face: 1, t: NOW, pose: 'deflate', expr: 'relieved', sword: 'back', scarf: { len: 936, glow: 0.6, notch: true, hole: true, patch: true } }, note: '勇者刚给孩子系完围巾，在孩子左边长出一口气。' },
    ],
    props: [],
    ui: [
      {
        id: 'panel', fn: 'drawSeamPanel', space: 'parallax', base: TR.TR_NIGHT, depth: 1.1,
        params: { panel: { rect: PANEL_O06, tiles: '王浩然', counter: '3/3', foldEmpty: 1, contract: 1, glowOk: 0.55, t: NOW }, stamp: { kind: 'check', x: 1030, y: 540, r: 60, rot: -0.12, p: 1, t: NOW } },
        note: '取名面板（N2 同一块）：3 格「王浩然」、空格已折起、外框收拢（contract 1），meadow + gold 光 0.55，计数「3/3」；红色对勾章盖在右下角。按 TR-NIGHT 屏幕坐标设计、随 depth 1.1 视差（applyParallax）。',
      },
    ],
    fx: {},
    motion: 'A（b16）：193.60–193.90 机位回到 TR-NIGHT 后只剩 drift；196.30 空格折起、196.40 外框收拢、196.60 对勾章、196.80 全家瘪下、197.00 王冠回正、197.10 系短围巾——197.77 时全部静止，只有呼吸 / 眨眼 / 烛火（t 驱动）。B（b17）：197.77 重音——面板下沿垂下「全名」小签（namePanel 的 tagBelow，从 197.77 才开始画）；197.95 孩子 yank；198.05 起机位上摇推向玫瑰窗（面板随 depth 1.1 视差出画）。',
    notes: [
      '面板画在 applyParallax(g, cam, TR_NIGHT, 1.1) 里：机位 = TR-NIGHT 时就是屏幕坐标 PANEL_O06（收拢后 3 格中心 x=920）；b17 推镜时面板跟着视差走。',
      '左尖拱窗 windowL:"winter"（O04 四季翻完停在冬），右尖拱窗 windowR:"moon"（月亮在屏幕 (1220,250) r70），柱上 O04 的三道身高刻度 ruler 保留。',
      '摇篮在 O04 孩子长大时已像立体书机关一样折倒收走（接缝帧不画摇篮）；传令官、卫兵不在场。',
    ],
  },
};

// ———————————————————— 接缝机位与参考绘制 ————————————————————
/** 接缝附近 T 时刻的实际机位（含漂移）。 */
export function seamCam(key, T) {
  const S = SEAMS[key];
  if (!S) throw new Error('unknown seam ' + key);
  if (S.camAt) return S.camAt(T);
  return withDrift(S.cam, T, S.drift);
}

function itemsOf(S) {
  const m = {};
  for (const list of [S.actors, S.props, S.ui]) for (const it of list || []) m[it.id] = it;
  return m;
}
function drawItem(lg, it, T, E) {
  const fn = typeof it.fn === 'function' ? it.fn : FN[it.fn];
  if (!fn) throw new Error('seam fn missing: ' + it.fn);
  const p = resolveParams(it.params, T, E);
  let ret;
  lg.save();
  if (it.space === 'world') { applyCam(lg, E.c, it.depth ?? 1); ret = fn(lg, p); }
  else if (it.space === 'follow') {
    const at = resolveParams(it.at, T, E);
    const [sx, sy] = toScreen(E.c, it.depth ?? 1, at[0], at[1]);
    ret = fn(lg, { ...p, x: sx + (p.dx || 0), y: sy + (p.dy || 0) });
  } else if (it.space === 'parallax') { applyParallax(lg, E.c, it.base, it.depth ?? 1); ret = fn(lg, p); }
  else ret = fn(lg, p);
  lg.restore();
  E.A[it.id] = ret;
  return ret;
}
/** 批量群演（同 folk.drawCrowd：按 y 从后往前）：p = { t, members:[{ kind?, …drawCitizen 参数 }] }。 */
function drawCrowdP(g, p) {
  const list = [...p.members].sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
  const out = [];
  for (const m of list) {
    const o = { t: p.t, s: p.s ?? 1, ...m };
    const kind = o.kind || 'citizen';
    const fn = kind === 'guard' ? drawGuard : kind === 'scribe' ? drawScribe : kind === 'herald' ? drawHerald : kind === 'child' ? drawChild : drawCitizen;
    out.push(fn(g, o));
  }
  return out;
}

/**
 * 参考实现：按合同画出接缝 key 在 T 时刻（接缝附近，建议 |T − 接缝| ≤ 0.2s）的完整画面（含图层、机位、漂移、角色、道具、界面、后期）。
 * 两块在接缝时刻画出的画面都要与它一致。
 */
export function drawSeam(g, T, ctx, key) {
  const S = SEAMS[key];
  if (!S) throw new Error('unknown seam ' + key);
  const c = seamCam(key, T);
  const E = { T, c, A: {}, key };
  const items = itemsOf(S);
  // 整帧后期
  const fx = resolveParams(S.fx || {}, T, E);
  for (const k in fx) if (fx[k] !== undefined) ctx.fx[k] = fx[k];
  const env = S.env ? resolveParams(S.env.params, T, E) : null;
  if (env && S.env.onBalcony) env.onBalcony = (bg) => { for (const id of S.env.onBalcony) drawItem(bg, items[id], T, { ...E, c: E.c, balcony: true }); };
  for (const L of S.layers) {
    const run = (lg) => {
      lg.save();
      if (L.clip) lg.clip(resolveParams(L.clip, T, E));
      for (const ref of L.draw) {
        if (ref.startsWith('env:')) {
          const sub = ref.slice(4);
          const o = S.env.fn === 'drawTheater' ? { ...env, part: sub } : { ...env, layer: sub };
          ENV[S.env.fn](lg, T, c, o);
        } else {
          const it = items[ref];
          if (!it) throw new Error(`seam ${key}: no item ${ref}`);
          drawItem(lg, it, T, E);
        }
      }
      lg.restore();
    };
    const o = L.o == null ? null : resolveParams(L.o, T, E);
    if (o) ctx.layer(g, o, run); else run(g);
  }
  return E.A;
}

/** 七处接缝的键（按时间顺序）。 */
export const SEAM_KEYS = Object.keys(SEAMS);
