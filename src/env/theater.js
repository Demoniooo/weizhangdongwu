// 纸剧场（THEATER，storyboard 4.8 / assets 8.8）：黑边长成台口、顶幕 / 边幕 / 台唇 / 脚灯、主幕、台口咬合、
// 名字之剑撕开侧幕与顶幕、顶幕劈成两半掉落、剧场外暗房（TT-OUT），以及 b12 / b13 共用的状态函数 theaterState(T)。
// 坐标：剧场坐标 = TT_W 下的屏幕坐标（1920×1080）。drawTheater 内部 applyCam(g, o.cam, 1)（默认 TT_W），镜头不要先 applyCam。
// 分层（由镜头包进各自 ctx.layer）：part 'back'（暗房 + 剧场内壁 + 压平的山洞背景片 + 舞台地板）→ 木偶 →
//   'frame'（主幕、舞台光、边幕、顶幕、台唇与脚灯、咬合暗缝）→ 名字之剑 → 'frameFront'（盖在剑前的撕口布边）。
// 纯函数：只读参数（含 T），不存跨帧状态；只用 PAL；不调 ctx.layer / ctx.mask。
import { PAL, blob, poly, rr, smooth as smoothPath, cut, shade, lin, rad, glow, sparkle } from '../core/paper.js';
import { cam, applyCam, lerpCam } from '../core/camera.js';
import { clamp, lerp, seg, smoothstep, hash2, noise1, TAU, rgba, mixHex, hit, wobble } from '../core/util.js';
import { ez, outBack, outCubic, inCubic, inExpo, glide, spring, snap, inOutCubic } from '../core/ease.js';
import { cue } from '../cues.js';
import { NAME_TIMES } from '../ui/type.js';
import { drawCave, STANDOFF } from './cave.js';

const H = (a, b) => hash2(a, b);

// ———————————————————— 布局常量（屏幕坐标，TT_W） ————————————————————
export const THEATER = {
  letterbox: 138.3,
  valance: { y0: 0, y1: 150, fringe: 172 },
  wings: { left: [0, 110], right: [1810, 1920] },
  lip: { y0: 860, y1: 1080 },
  footY: 872,
  footlights: [252, 535, 818, 1102, 1385, 1668],
  opening: { x0: 110, x1: 1810, y0: 150, y1: 860 },
  floorY: 840,
  slots: { front: 850, back: 828 },
  heroPlate: { x0: 150, x1: 750, y0: 176, y1: 262, avatar: [190, 219, 38], window: { x: 270, y: 182, w: 315, h: 62 }, hp: { x0: 270, x1: 650, y0: 248, y1: 262 } },
  dragonPlate: { x0: 1170, x1: 1770, y0: 176, y1: 262, avatar: [1730, 219, 38], window: { x: 1335, y: 182, w: 315, h: 62 }, hp: { x0: 1270, x1: 1650, y0: 248, y1: 262 } },
  banner: { x: 960, y: 215, w: 420 },
  menu: { x0: 150, x1: 560, y0: 640, y1: 830 },
  hero: { x: 520, y: 840 },
  dragon: { head: [1350, 520], body: [1700, 760], rods: [1300, 1600] },
  cage: { x: 1480, y: 330, w: 120, h: 160 },
  sword: { guard: [600, 560], tile: 120, step: 126, first: 660 },
  backdrop: { scale: 0.92, center: [960, 505] },
  /** 走马灯窗口跨度 = 13 字 × 63 + 窗宽 315（storyboard b12）。 */
  marqueeSpan: 13 * 63 + 315,
  /** TT-OUT 下看得到的剧场坐标范围（暗房按它画足）。 */
  roomView: { x0: -600, x1: 2520, y0: -470, y1: 1300 },
};
export const CAMS = { TT_W: cam(960, 540, 1.0), TT_OUT: cam(960, 420, 0.62) };

// ———————————————————— 共享状态（b12 / b13 接缝 150.52 由它保证一致） ————————————————————
const C = (id) => cue(id);
/** 弹簧落下（0→1 带过冲），T0 前为 0。 */
const dropIn = (T, T0, f = 2.6, d = 0.42) => (T < T0 ? 0 : spring(T - T0, { freq: f, damping: d }));

function heroHP(T) {
  if (T < 149.5) return 1;
  if (T < 150.6) return lerp(1, 0.6, outCubic(seg(T, 149.5, 150.4)));
  if (T < 152.6) return lerp(0.6, 0.01, outCubic(seg(T, 150.6, 152.6)));
  return 0.01;
}
function dragonHP(T) { return T < 142.0 ? 1 : T < 157.35 ? 0.7 : lerp(0.7, 0, seg(T, 157.35, 157.45)); }
function dragonLag(T) {
  if (T < 142.2) return 1;
  if (T < 157.45) return lerp(1, 0.7, outCubic(seg(T, 142.2, 142.8)));
  return lerp(0.7, 0, outCubic(seg(T, 157.45, 157.8)));
}
/** 剧场机位（不含漂移 / 震动，镜头自己叠）：B03 snap 推近、B10 略推到 1.04、156.40 拉到 TT-OUT、157.80 回 TT-W。 */
export function theaterCam(T) {
  const W = CAMS.TT_W, O = CAMS.TT_OUT;
  if (T < 141.28) return W;
  if (T < 142.4) {
    const z = T < 141.36 ? lerp(1, 1.15, snap(seg(T, 141.28, 141.36))) : T < 141.6 ? lerp(1.15, 1.05, outCubic(seg(T, 141.36, 141.6))) : lerp(1.05, 1, glide(seg(T, 141.6, 142.4)));
    return cam(960, 540, z);
  }
  if (T < 153.78) return W;
  const pushed = cam(960, 540, lerp(1, 1.04, glide(seg(T, 153.78, 155.8))));
  if (T < 156.4) return pushed;
  if (T < 157.8) return lerpCam(pushed, O, glide(seg(T, 156.4, 157.0)));
  return lerpCam(O, W, glide(seg(T, 157.8, 158.6)));
}

/**
 * theaterState(T)：名字牌、菜单、HP、回合横幅、台口状态、灯光、机位（137.40–161.50）。
 * 返回 { grow, rods, turn, banner, heroPlate, dragonPlate, menu, hp, light, lightK, offK, curtain, curtainSway, bite, scale, wingTear,
 *        wingTearUp, valance, tearP, fallAt, splitX, floorCrack, cam, room, caveOpts }（字段说明见 docs/api/cave_theater.md）。
 * 字段名与 drawTheater 参数同名，可直接展开：drawTheater(lg, T, { ...st, part: 'back' })。
 */
export function theaterState(T) {
  const B = C;
  const grow = seg(T, 137.4, 137.92);
  // 回合
  const turn = T >= 160.3 ? 'victory' : T >= B('B05') && T < 153.3 ? 'enemy' : 'hero';
  const TEXT = { hero: '勇者的回合', enemy: '敌方回合', victory: '胜利！' };
  let prev = TEXT[turn], flip = 1;
  if (T >= B('B05') && T < B('B05') + 0.3) { prev = TEXT.hero; flip = seg(T, B('B05'), B('B05') + 0.3); }
  if (T >= 153.3 && T < 153.6) { prev = TEXT.enemy; flip = seg(T, 153.3, 153.6); }
  if (T >= 160.3 && T < 160.5) { prev = TEXT.hero; flip = seg(T, 160.3, 160.5); }
  const banner = { text: TEXT[turn], prev, flip, drop: dropIn(T, 137.92), smash: seg(T, 160.3, 160.45) };
  // 勇者名字牌
  const b10 = [...NAME_TIMES('B10a'), ...NAME_TIMES('B10b'), ...NAME_TIMES('B10c')];
  const peeled = b10.filter((t) => T >= t).length;
  const stepT = T >= B('B08') && T < B('B09') ? B('B08') + Math.floor((T - B('B08')) / 0.2) * 0.2 : 0;
  const heroPlate = {
    drop: dropIn(T, 137.92),
    state: T < B('B02') ? 'idle' : T < B('B03') ? 'active' : T < B('B08') ? 'idle' : T < B('B10') ? 'cracked' : T < 160.4 ? 'empty' : 'active',
    progress: T < B('B02') ? 0 : T < B('B03') ? seg(T, B('B02'), B('B03')) : T < B('B08') ? 1 : T < B('B09') ? seg(stepT, B('B08'), B('B09')) : 1,
    stutter: T >= B('B08') && T < B('B09') ? { step: Math.round((stepT - B('B08')) / 0.2), jolt: hit(T, stepT, 0.08), slip: Math.round((stepT - B('B08')) / 0.2) % 3 === 2 ? 1 - seg(T, stepT, stepT + 0.18) : 0 } : null,
    crack: T < 150.6 ? 0 : T < 160.4 ? seg(T, 150.6, 150.68) : 1 - seg(T, 160.4, 160.9),
    pulse: T >= 152.6 && T < 153.45 ? hit(T, 152.6, 0.1) + hit(T, 152.85, 0.1) + hit(T, 153.1, 0.1) + hit(T, 153.35, 0.1) : 0,
    gold: T >= B('B02') && T < B('B03'),
    peeled, peelTimes: b10, restore: seg(T, 160.4, 160.9),
  };
  // 巨龙名字牌
  const popAt = Array.from({ length: 13 }, (_, k) => +(B('B12') + 0.2 * k).toFixed(3));
  const dragonPlate = {
    drop: dropIn(T, 137.98),
    state: T < B('B04') ? 'idle' : T < B('B05') ? 'hit' : T < B('B06') ? 'idle' : T < B('B07') ? 'angry' : T < 157.35 ? 'idle' : 'cracked',
    progress: T < B('B04') ? 0 : T < B('B05') ? seg(T, B('B04'), B('B05')) : T < B('B06') ? 1 : T < B('B07') ? seg(T, B('B06'), B('B07')) : T < B('B12') ? 1 : seg(T, B('B12'), B('E01')),
    flashRed: T >= B('B06') && T < B('B07') ? 0.5 + 0.5 * Math.sin((T - B('B06')) * TAU * 3) : T >= B('B04') && T < B('B04') + 0.4 ? 1 - seg(T, B('B04'), B('B04') + 0.4) : 0,
    shrink: seg(T, B('B12'), 160.2), popAt, popped: popAt.filter((t) => T >= t).length,
    fall: seg(T, 160.5, 160.75), landAt: 160.75,
  };
  // 菜单
  const locked = T >= B('B05') && T < 153.3;
  const menu = {
    show: T < 137.95 ? 0 : T < 160.3 ? outBack(seg(T, 137.95, 138.15)) : 1 - seg(T, 160.3, 160.55),
    cursor: T < 153.3 ? 'attack' : 'skill', cursorMove: seg(T, 153.3, 153.4),
    flash: hit(T, 139.4, 0.15), press: hit(T, 140.3, 0.14) + hit(T, B('B09'), 0.14),
    locked, lockDrop: seg(T, B('B05'), B('B05') + 0.25), lockPop: seg(T, 153.3, 153.45),
    gray: locked ? seg(T, B('B05'), B('B05') + 0.2) : T >= 153.3 && T < 153.5 ? 1 - seg(T, 153.3, 153.5) : 0,
    submenu: { text: '名字之剑', p: T < B('B09') ? 0 : outBack(seg(T, B('B09'), B('B09') + 0.16)) * (1 - seg(T, 153.95, 154.25)), select: hit(T, 153.65, 0.15) },
  };
  // HP（0..1；hero 最大 100）
  const hh = heroHP(T);
  const hp = {
    hero: hh, heroLag: Math.max(hh, heroHP(T - 0.35)), heroNum: Math.max(1, Math.round(hh * 100)), heroCritical: T >= 152.6,
    dragon: dragonHP(T), dragonLag: dragonLag(T),
  };
  // 灯光：B05 起转紫，153.30 回暖，160.90–161.10 熄灭
  const lightK = T < B('B05') ? 0 : T < 153.3 ? seg(T, B('B05'), B('B05') + 0.22) : 1 - seg(T, 153.3, 153.6);
  const offK = seg(T, 160.9, 161.1);
  const light = offK > 0.5 ? 'off' : lightK > 0.5 ? 'purple' : 'warm';
  // 台口
  const curtain = T < 160.6 ? 0 : T < 161.13 ? inOutCubic(seg(T, 160.6, 161.1)) : 1 - outCubic(seg(T, 161.13, 161.4));
  const bite = T < 149.33 ? 0 : T < 149.48 ? inExpo(seg(T, 149.33, 149.48)) : T < 149.8 ? 1 : 1 - spring(T - 149.8, { freq: 3.2, damping: 0.38 });
  const scale = T < 161.13 ? 1 : lerp(1, 1.8, inCubic(seg(T, 161.13, 161.5)));
  const valance = T < 156.8 ? 'whole' : T < 157.17 ? 'torn' : 'halves';
  const c = theaterCam(T);
  return {
    grow, rods: seg(T, 137.85, 138.05), turn, banner, heroPlate, dragonPlate, menu, hp,
    light, lightK, offK, curtain, curtainSway: T >= 161.1 ? wobble(T, 161.1, 3, 0.3) : 0, bite, scale,
    wingTear: ez(T, 156.0, 156.25, outCubic), wingTearUp: ez(T, 156.8, 156.92, inOutCubic), valance, tearP: ez(T, 156.82, 157.08, inOutCubic), fallAt: 157.4, splitX: 960,
    floorCrack: ez(T, 157.2, 157.32, outCubic),
    cam: c, room: c.zoom < 0.995,
    caveOpts: { light: 'battle', rubble: { at: 120.97, cooled: lerp(0.6, 0.85, seg(T, 137.4, 150)) } },
  };
}

/**
 * 剧场盒子的裁剪路径（屏幕坐标；cam / scale 与 drawTheater 一致）。木偶层建议 g.clip(theaterClip(o))：
 * TT-OUT 时木签和龙偶的长身体不会伸出剧场（名字之剑不要裁，它就是要捅出去）。
 */
export function theaterClip(o = {}) {
  const c = o.cam || CAMS.TT_W, sc = o.scale ?? 1;
  const z = c.zoom;
  const m = new DOMMatrix().translate(960, 540).rotate((c.rot || 0) * 180 / Math.PI).scale(z, z).translate(-c.x, -c.y)
    .translate(960, 540).scale(sc, sc).translate(-960, -540);
  const p = new Path2D(); p.addPath(rectP(-80, -90, 2080, 1166), m);
  return p;
}

/** 敌方回合等的舞台叠色（给镜头的 ctx.layer tint 用；drawTheater 的 'frame' 已在台口内叠过，一般不用再叠）。 */
export function stageTint(light = 'warm', k = 1) {
  if (light === 'purple') return { color: PAL.dragon, alpha: 0.18 * k, mode: 'multiply' };
  if (light === 'off') return { color: PAL.ink, alpha: 0.35 * k, mode: 'multiply' };
  return null;
}

// ———————————————————— 画笔小工具 ————————————————————
function under(g, path, d, a = 0.3) { g.save(); g.translate(d * 0.35, d * 0.85); g.fillStyle = rgba(PAL.shadow, a); g.fill(path); g.restore(); }
/** 近黑（= 引擎宽银幕黑边的观感）：shadow 底上再正片叠底一层 ink。 */
function nearBlack(g, path, a = 1) {
  if (a <= 0) return;
  g.save(); g.globalAlpha *= a;
  g.fillStyle = PAL.shadow; g.fill(path);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha *= 0.84; g.fillStyle = PAL.ink; g.fill(path);
  g.restore();
}
const rectP = (x, y, w, h) => { const p = new Path2D(); p.rect(x, y, w, h); return p; };
/** 丝绒竖褶：一条横向渐变（每褶 暗→亮→中→暗）。 */
function pleats(g, x0, x1, fw, base, hi, lo, phase = 0) {
  const W = x1 - x0, stops = [];
  const start = x0 - ((((x0 - phase) % fw) + fw) % fw);
  for (let x = start; x < x1 + fw; x += fw) {
    for (const [f, col] of [[0, lo], [0.12, base], [0.34, hi], [0.5, base], [0.84, base], [1, lo]]) {
      const pos = (x + f * fw - x0) / W;
      if (pos >= 0 && pos <= 1) stops.push([pos, col]);
    }
  }
  stops.sort((a, b) => a[0] - b[0]);
  if (!stops.length) return base;
  return lin(g, x0, 0, x1, 0, stops);
}
const VEL = { base: PAL.redDark, hi: mixHex(PAL.redDark, PAL.red, 0.55), lo: mixHex(PAL.redDark, PAL.redDeep, 0.8) };
const CURT = { base: mixHex(PAL.red, PAL.redDark, 0.42), hi: mixHex(PAL.red, PAL.white, 0.08), lo: mixHex(PAL.redDark, PAL.redDeep, 0.55) };

// ———————————————————— 顶幕 ————————————————————
const hemY = (x) => 145 + 7 * Math.abs(Math.sin(((x - 110) / 283.33) * Math.PI));
const TOP = -90; // 剧场檐板下沿：顶幕 / 边幕 / 主幕最高只到这里（TT-OUT 时上面是暗房）
function valanceBody(g, T, st) {
  const { hK, colorK, braidK, fringeOf } = st;
  const yB = lerp(THEATER.letterbox, 150, hK);
  const hem = (x) => yB + (hemY(x) - 150) * hK;
  const top = TOP - st.dy;
  // 底片：黑条（grow 早期）
  const bodyP = new Path2D();
  bodyP.moveTo(-80, top);
  bodyP.lineTo(2000, top);
  for (let x = 2000; x >= -80; x -= 20) bodyP.lineTo(x, hem(x));
  bodyP.closePath();
  if (colorK < 1) nearBlack(g, bodyP, 1);
  if (colorK > 0) {
    g.save(); g.globalAlpha *= colorK;
    under(g, bodyP, 6, 0.35);
    g.fillStyle = pleats(g, -80, 2000, 64, VEL.base, VEL.hi, VEL.lo, 30); g.fill(bodyP);
    g.fillStyle = lin(g, 0, top, 0, yB, [[0, rgba(PAL.shadow, 0.35)], [0.7, rgba(PAL.shadow, 0)], [1, rgba(PAL.redDeep, 0.25)]]); g.fill(bodyP);
    // 金色编带
    if (braidK > 0) {
      g.save(); g.globalAlpha *= braidK;
      const band = new Path2D();
      band.moveTo(-80, hem(-80) - 22);
      for (let x = -80; x <= 2000; x += 20) band.lineTo(x, hem(x) - 22);
      for (let x = 2000; x >= -80; x -= 20) band.lineTo(x, hem(x) - 8);
      band.closePath();
      under(g, band, 2.5, 0.35);
      g.fillStyle = lin(g, 0, 120, 0, 145, [PAL.goldLight, PAL.gold, PAL.goldDark]); g.fill(band);
      g.save(); g.clip(band); g.strokeStyle = rgba(PAL.goldDark, 0.6); g.lineWidth = 2;
      for (let x = -80; x <= 2000; x += 9) { g.beginPath(); g.moveTo(x, hem(x) - 23); g.lineTo(x + 8, hem(x) - 7); g.stroke(); }
      g.restore();
      g.restore();
    }
    g.restore();
  }
  // 扇贝流苏
  for (let x = -60, i = 0; x <= 1980; x += 40, i++) {
    const fk = fringeOf(x);
    if (fk <= 0) continue;
    const y0 = hem(x) - 2;
    const sy = outBack(clamp(fk), 2.4);
    g.save(); g.translate(x, y0); g.scale(1, Math.max(0.001, sy));
    const sc = new Path2D(); sc.moveTo(-20, 0); sc.bezierCurveTo(-19, 18, -8, 24, 0, 24); sc.bezierCurveTo(8, 24, 19, 18, 20, 0); sc.closePath();
    under(g, sc, 2.5, 0.35);
    g.fillStyle = lin(g, 0, 0, 0, 24, [PAL.gold, PAL.goldDark]); g.fill(sc);
    const inner = new Path2D(); inner.moveTo(-12, 0); inner.bezierCurveTo(-11, 11, -5, 15, 0, 15); inner.bezierCurveTo(5, 15, 11, 11, 12, 0); inner.closePath();
    g.fillStyle = rgba(PAL.goldLight, 0.55); g.fill(inner);
    g.strokeStyle = PAL.goldDark; g.lineWidth = 1.3; g.lineCap = 'round';
    for (let q = -2; q <= 2; q++) { g.beginPath(); g.moveTo(q * 6, 21 - Math.abs(q) * 2.5); g.lineTo(q * 6.4, 29 - Math.abs(q) * 2.5); g.stroke(); }
    g.fillStyle = PAL.goldLight; g.beginPath(); g.arc(0, 26, 3.4, 0, TAU); g.fill();
    g.fillStyle = PAL.goldDark; g.beginPath(); g.arc(0.8, 27, 1.6, 0, TAU); g.fill();
    g.restore();
  }
  // 角上的穗子
  if (st.tasselK > 0) for (const [tx, sgn] of [[124, 1], [1796, -1]]) tassel(g, tx, hem(tx) - 4, st.tasselK, st.tasselSwing * sgn);
}

function tassel(g, x, y, k, swing) {
  const sy = outBack(clamp(k), 2);
  g.save(); g.translate(x, y); g.rotate(swing); g.scale(1, Math.max(0.001, sy));
  g.strokeStyle = PAL.goldDark; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 30); g.stroke();
  const knot = blob(0, 34, 9, 8, { seed: 9, amp: 0.03 });
  under(g, knot, 2, 0.35); cut(g, knot, PAL.gold, { rim: PAL.goldLight, rimW: 1.5 });
  const skirt = new Path2D(); skirt.moveTo(-6, 40); skirt.lineTo(6, 40); skirt.lineTo(13, 82); skirt.quadraticCurveTo(0, 88, -13, 82); skirt.closePath();
  under(g, skirt, 2.5, 0.35);
  g.fillStyle = lin(g, -13, 0, 13, 0, [PAL.goldLight, PAL.gold, PAL.goldDark]); g.fill(skirt);
  g.save(); g.clip(skirt); g.strokeStyle = rgba(PAL.goldDark, 0.6); g.lineWidth = 1.2;
  for (let q = -5; q <= 5; q++) { g.beginPath(); g.moveTo(q * 1.1, 42); g.lineTo(q * 2.5, 88); g.stroke(); }
  g.restore();
  g.fillStyle = PAL.goldDark; g.fill(rr(-8, 41, 16, 5, 2));
  g.restore();
}

/** 顶幕（含撕口 / 劈成两半）。st.dy 为咬合下压量。 */
function drawValance(g, T, st) {
  g.save();
  g.translate(0, st.dy);
  if (st.valance === 'halves') {
    const sx = st.splitX;
    const age = T - st.fallAt;
    const fp = age > 0 ? clamp(age / 0.55) : 0;
    const cutLine = (side) => {
      const p = new Path2D();
      const pts = [];
      for (let y = -900; y <= 260; y += 26) pts.push([sx + (H(Math.round(y), 3) - 0.5) * 18, y]);
      if (side < 0) { p.moveTo(-200, -900); for (const q of pts) p.lineTo(q[0], q[1]); p.lineTo(-200, 260); }
      else { p.moveTo(2200, -900); for (const q of pts) p.lineTo(q[0], q[1]); p.lineTo(2200, 260); }
      p.closePath(); return p;
    };
    for (const side of [-1, 1]) {
      g.save();
      const pv = side < 0 ? [-60, 0] : [1980, 0];
      g.translate(pv[0], pv[1] + 1300 * fp * fp);
      g.rotate(-side * 0.42 * fp * fp);
      g.translate(-pv[0], -pv[1]);
      g.clip(cutLine(side));
      valanceWithTear(g, T, st);
      g.restore();
    }
  } else valanceWithTear(g, T, st);
  g.restore();
}
function tearHole(st) {
  const x = st.tearX, top = st.tearP >= 0.999 ? -400 : 182 - st.tearP * 290;
  const p = new Path2D();
  p.moveTo(x - 64, 200);
  for (let y = 200; y >= top; y -= 22) p.lineTo(x - 64 + (H(Math.round(y), 5) - 0.5) * 14, y);
  p.lineTo(x, top - 16);
  for (let y = top; y <= 200; y += 22) p.lineTo(x + 64 + (H(Math.round(y), 6) - 0.5) * 14, y);
  p.closePath();
  return p;
}
function valanceWithTear(g, T, st) {
  if (st.tearP > 0 && (st.valance === 'torn' || st.valance === 'halves')) {
    g.save();
    const cl = new Path2D(); cl.rect(-300, -1200, 2600, 1600); cl.addPath(tearHole(st));
    g.clip(cl, 'evenodd');
    valanceBody(g, T, st);
    g.restore();
  } else valanceBody(g, T, st);
}

// ———————————————————— 边幕 ————————————————————
function wingHole(wt, up = 0) {
  const kx = Math.min(1, wt * 1.25), hh = 6 + 72 * smoothstep(0, 0.55, wt), j = Math.min(1, wt * 2);
  const x0 = 1806, x1 = 1806 + 200 * kx, p = new Path2D();
  const yTop = lerp(560 - hh, -120, clamp(up));
  p.moveTo(x0, lerp(560 - hh * 0.6, -120, clamp(up)));
  for (let x = x0; x <= x1; x += 16) p.lineTo(x, yTop + (H(x, 7) - 0.5) * 16 * j);
  p.lineTo(x1, 560);
  for (let x = x1; x >= x0; x -= 16) p.lineTo(x, 560 + hh + (H(x, 8) - 0.5) * 16 * j);
  p.lineTo(x0, 560 + hh * 0.6);
  p.closePath();
  return { p, hh, x0, x1 };
}
function drawWing(g, side, st) {
  const k = st.wingK;
  if (k <= 0) return;
  g.save();
  g.translate(side < 0 ? -190 * (1 - k) : 190 * (1 - k), 0);
  const inner = side < 0 ? 110 : 1810, outer = side < 0 ? -80 : 2000;
  const p = new Path2D();
  p.moveTo(outer, TOP);
  p.lineTo(inner, TOP);
  for (let y = TOP; y <= 880; y += 40) p.lineTo(inner + (side < 0 ? 1 : -1) * 6 * Math.pow(Math.max(0, y) / 880, 3) + Math.sin(y * 0.02) * 1.5, y);
  p.lineTo(outer, 880);
  p.closePath();
  if (side > 0 && st.wingTear > 0) { const cl = new Path2D(); cl.rect(1500, -1200, 800, 2400); cl.addPath(wingHole(st.wingTear, st.wingTearUp).p); g.clip(cl, 'evenodd'); }
  under(g, p, 8, 0.4);
  g.fillStyle = pleats(g, Math.min(inner, outer), Math.max(inner, outer), 36, VEL.base, VEL.hi, VEL.lo, side < 0 ? 0 : 18); g.fill(p);
  g.fillStyle = lin(g, inner, 0, outer, 0, [[0, rgba(PAL.fire2, 0.1 * st.lampAll)], [0.4, rgba(PAL.shadow, 0)], [1, rgba(PAL.shadow, 0.35)]]); g.fill(p);
  g.fillStyle = lin(g, 0, 400, 0, 880, [[0, rgba(PAL.shadow, 0)], [1, rgba(PAL.shadow, 0.3)]]); g.fill(p);
  // 内缘金绳
  const rope = new Path2D(); const rx = inner + (side < 0 ? -5 : 5);
  rope.moveTo(rx, TOP); rope.lineTo(rx, 880);
  g.lineCap = 'butt';
  g.strokeStyle = rgba(PAL.shadow, 0.35); g.lineWidth = 9; g.save(); g.translate(2, 3); g.stroke(rope); g.restore();
  g.strokeStyle = PAL.gold; g.lineWidth = 8; g.stroke(rope);
  g.strokeStyle = PAL.goldDark; g.lineWidth = 2;
  for (let y = -40; y <= 880; y += 10) { g.beginPath(); g.moveTo(rx - 4, y); g.lineTo(rx + 4, y + 7); g.stroke(); }
  g.strokeStyle = rgba(PAL.goldLight, 0.8); g.lineWidth = 1.5; g.beginPath(); g.moveTo(rx - 2.5, TOP); g.lineTo(rx - 2.5, 880); g.stroke();
  g.restore();
}

// ———————————————————— 台唇与脚灯 ————————————————————
function lampColors(st) {
  const k = st.lightK, off = st.offK;
  const core = mixHex(mixHex(PAL.white, PAL.fire2, 0.4), PAL.magic, k);
  const halo = mixHex(PAL.goldLight, PAL.magic, k);
  const wash = mixHex(PAL.fire2, PAL.dragonWing, k);
  return { core, halo, wash, on: 1 - off };
}
function drawLip(g, T, st) {
  const yTop = lerp(941.7, 860, st.lipK);
  g.save();
  g.translate(0, -st.dyB);
  const ext = st.room ? 0 : 160; // 无暗房时台唇往画面下沿外多画 160px：叠漂移 / 从 TT-OUT 拉回的最后几帧不露底
  const body = rectP(-80, yTop, 2080, 1080 + st.dyB + ext - yTop);
  nearBlack(g, body, 1);
  const a = st.lipColorK;
  if (a > 0) {
    g.save(); g.globalAlpha *= a;
    g.translate(0, yTop - 860);
    const face = rectP(-80, 860, 2080, 220 + st.dyB + ext);
    g.fillStyle = lin(g, 0, 860, 0, 1100, [[0, PAL.woodDark], [0.08, PAL.wood], [0.55, mixHex(PAL.wood, PAL.woodDark, 0.45)], [1, PAL.woodDark]]);
    g.fill(face);
    // 木纹
    g.strokeStyle = rgba(PAL.woodDark, 0.4); g.lineWidth = 2;
    for (const yy of [892, 1056]) { g.beginPath(); g.moveTo(-80, yy); g.lineTo(2000, yy); g.stroke(); }
    g.strokeStyle = rgba(PAL.sand, 0.12); g.lineWidth = 1.5;
    for (let q = 0; q < 26; q++) { const yy = 900 + H(q, 1) * 150, x0 = -80 + H(q, 2) * 1900; g.beginPath(); g.moveTo(x0, yy); g.bezierCurveTo(x0 + 80, yy - 3, x0 + 160, yy + 4, x0 + 260, yy); g.stroke(); }
    // 嵌板（脚灯下方各一块）+ 金角饰
    for (const fx of THEATER.footlights) {
      const pn = rr(fx - 112, 912, 224, 124, 10);
      g.save(); g.translate(2, 3); g.fillStyle = rgba(PAL.sand, 0.18); g.fill(pn); g.restore();
      g.fillStyle = mixHex(PAL.woodDark, PAL.redDeep, 0.35); g.fill(pn);
      g.fillStyle = lin(g, 0, 912, 0, 1036, [[0, rgba(PAL.shadow, 0.4)], [0.3, rgba(PAL.shadow, 0)]]); g.fill(pn);
      g.strokeStyle = rgba(PAL.gold, 0.85); g.lineWidth = 2.4; g.stroke(rr(fx - 102, 922, 204, 104, 7));
      for (const [cx, cy, sx, sy] of [[fx - 102, 922, 1, 1], [fx + 102, 922, -1, 1], [fx - 102, 1026, 1, -1], [fx + 102, 1026, -1, -1]]) {
        g.save(); g.translate(cx, cy); g.scale(sx, sy);
        g.fillStyle = PAL.gold; g.beginPath(); g.moveTo(0, 0); g.lineTo(22, 0); g.quadraticCurveTo(8, 4, 4, 8); g.quadraticCurveTo(0, 14, 0, 22); g.closePath(); g.fill();
        g.fillStyle = PAL.goldLight; g.beginPath(); g.arc(5, 5, 2.2, 0, TAU); g.fill();
        g.restore();
      }
      // 中心小徽：路径画的四角星
      g.save(); g.translate(fx, 974);
      g.fillStyle = rgba(PAL.goldDark, 0.9); g.beginPath();
      for (let q = 0; q < 8; q++) { const ang = (q / 8) * TAU - Math.PI / 2, r = q % 2 ? 4 : 13; g.lineTo(Math.cos(ang) * r + 1, Math.sin(ang) * r + 1.5); }
      g.closePath(); g.fill();
      g.fillStyle = PAL.gold; g.beginPath();
      for (let q = 0; q < 8; q++) { const ang = (q / 8) * TAU - Math.PI / 2, r = q % 2 ? 4 : 13; g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); }
      g.closePath(); g.fill();
      g.restore();
    }
    // 顶沿金线脚
    const mold = rr(-80, 852, 2080, 16, 6);
    under(g, mold, 3, 0.4);
    g.fillStyle = lin(g, 0, 852, 0, 868, [PAL.goldLight, PAL.gold, PAL.goldDark]); g.fill(mold);
    g.fillStyle = rgba(PAL.shadow, 0.35); g.fillRect(-80, 868, 2080, 6);
    g.restore();
  }
  // 斩线裂缝（台唇上沿往下）
  if (st.floorCrack > 0 && a > 0) { g.save(); g.globalAlpha *= a; drawCrack(g, st.splitX + 3, yTop - 2, yTop + 120, st.floorCrack, 12); g.restore(); }
  // 脚灯
  const L = lampColors(st);
  THEATER.footlights.forEach((fx, i) => {
    const k = st.lampOf(i);
    if (k <= 0) return;
    const yy = yTop + 12;
    const sc = outBack(clamp(k), 2.2);
    const lit = clamp(k * 1.4 - 0.25) * L.on * (0.9 + 0.1 * noise1(T * 9 + i * 3, 2));
    g.save(); g.translate(fx, yy); g.scale(sc, sc);
    if (lit > 0) { glow(g, 0, -8, 70, L.halo, 0.7 * lit); }
    const bulb = blob(0, -7, 11, 9, { seed: 60 + i, amp: 0.03 });
    g.fillStyle = lit > 0 ? mixHex(PAL.woodDark, L.core, lit) : PAL.woodDark; g.fill(bulb);
    if (lit > 0) { g.fillStyle = rgba(PAL.white, 0.8 * lit); g.beginPath(); g.ellipse(-3, -10, 4, 2.6, -0.4, 0, TAU); g.fill(); }
    const hood = new Path2D(); hood.moveTo(-36, -4); hood.bezierCurveTo(-34, 16, -16, 22, 0, 22); hood.bezierCurveTo(16, 22, 34, 16, 36, -4); hood.lineTo(30, -6); hood.bezierCurveTo(26, 8, 14, 12, 0, 12); hood.bezierCurveTo(-14, 12, -26, 8, -30, -6); hood.closePath();
    under(g, hood, 3, 0.45);
    g.fillStyle = lin(g, -36, 0, 36, 0, [PAL.goldLight, PAL.gold, PAL.goldDark]); g.fill(hood);
    g.fillStyle = rgba(PAL.goldLight, 0.9); g.beginPath(); g.ellipse(-12, 13, 8, 2.4, 0.2, 0, TAU); g.fill();
    g.restore();
  });
  g.restore();
  return yTop - st.dyB;
}

// ———————————————————— 主幕 ————————————————————
function drawCurtains(g, T, st) {
  const c = st.curtain;
  if (c <= 0.001) return;
  const sway = st.curtainSway || 0;
  for (const side of [-1, 1]) {
    const wing = side < 0 ? 110 : 1810;
    const xe = side < 0 ? 110 + 850 * c + 26 * Math.max(0, c - 1) : 1810 - 850 * c - 26 * Math.max(0, c - 1);
    const x0 = side < 0 ? 40 : 1880;
    const p = new Path2D();
    p.moveTo(x0, TOP);
    p.lineTo(xe, TOP);
    for (let y = TOP; y <= 870; y += 30) { const bow = Math.sin((Math.max(0, y) / 870) * Math.PI) * 10 * (1 - Math.min(1, c)); p.lineTo(xe + (side < 0 ? 1 : -1) * (bow + sway * 12 * Math.pow(Math.max(0, y) / 870, 2)), y); }
    p.lineTo(x0, 872);
    p.closePath();
    const width = Math.abs(xe - wing) + 70;
    const fw = Math.max(22, width / 9);
    under(g, p, 8, 0.4);
    g.fillStyle = pleats(g, Math.min(x0, xe), Math.max(x0, xe), fw, CURT.base, CURT.hi, CURT.lo, side < 0 ? 0 : fw / 2); g.fill(p);
    g.fillStyle = lin(g, 0, 300, 0, 872, [[0, rgba(PAL.shadow, 0)], [1, rgba(PAL.shadow, 0.25)]]); g.fill(p);
    // 内缘金边 + 下摆金流苏
    g.save(); g.clip(p);
    g.fillStyle = PAL.gold; g.fillRect(side < 0 ? xe - 14 : xe, TOP, 14, 980);
    g.fillStyle = PAL.goldLight; g.fillRect(side < 0 ? xe - 13 : xe + 1, TOP, 3, 980);
    g.restore();
    for (let x = Math.min(x0, xe) + 10; x < Math.max(x0, xe) - 4; x += 22) {
      g.fillStyle = PAL.goldDark; g.beginPath(); g.moveTo(x - 10, 864); g.quadraticCurveTo(x, 884 + sway * 4, x + 10, 864); g.closePath(); g.fill();
      g.fillStyle = PAL.gold; g.beginPath(); g.moveTo(x - 9, 862); g.quadraticCurveTo(x, 880 + sway * 4, x + 9, 862); g.closePath(); g.fill();
    }
  }
}

// ———————————————————— 剧场外：暗房、檐板、底座、书桌 ————————————————————
function drawRoomWall(g, T, c) {
  g.save();
  applyCam(g, c, 0.75);
  g.fillStyle = lin(g, 0, -1600, 0, 1600, [[0, mixHex(PAL.ink, PAL.shadow, 0.5)], [0.55, mixHex(PAL.woodDark, PAL.ink, 0.62)], [1, mixHex(PAL.ink, PAL.shadow, 0.6)]]);
  g.fillRect(-3000, -3000, 8000, 6000);
  // 墙纸竖条
  g.fillStyle = rgba(PAL.woodDark, 0.18);
  for (let x = -2400; x < 4400; x += 120) g.fillRect(x, -3000, 44, 6000);
  // 窗：夜空 + 月牙
  const win = rr(1860, -360, 380, 470, 26);
  g.fillStyle = rgba(PAL.shadow, 0.5); g.save(); g.translate(10, 18); g.fill(win); g.restore();
  g.fillStyle = lin(g, 0, -360, 0, 110, [PAL.skyNightHigh, PAL.skyNight]); g.fill(win);
  g.save(); g.clip(win);
  g.fillStyle = PAL.moon; g.beginPath(); g.arc(2150, -250, 46, 0, TAU); g.fill();
  g.fillStyle = PAL.skyNightHigh; g.beginPath(); g.arc(2170, -262, 42, 0, TAU); g.fill();
  glow(g, 2140, -245, 160, PAL.moonGlow, 0.3);
  for (let q = 0; q < 9; q++) sparkle(g, 1890 + H(q, 1) * 320, -330 + H(q, 2) * 400, 3 + H(q, 3) * 4, { color: PAL.moon, alpha: 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(T * 1.7 + q * 2)) });
  g.restore();
  g.strokeStyle = PAL.woodDark; g.lineWidth = 26; g.stroke(win);
  g.lineWidth = 12; g.beginPath(); g.moveTo(2050, -360); g.lineTo(2050, 110); g.moveTo(1860, -120); g.lineTo(2240, -120); g.stroke();
  g.strokeStyle = rgba(PAL.goldLight, 0.18); g.lineWidth = 3; g.stroke(rr(1847, -373, 406, 496, 30));
  // 台灯光
  glow(g, -700, -900, 2600, PAL.goldLight, 0.2);
  glow(g, -400, -500, 1200, PAL.fire2, 0.12);
  g.restore();
}

/** 书桌（剧场坐标，在 frame 里画：剧场立在桌上，木签藏在台子里，桌面要压在木签前面）。 */
function drawDesk(g, T) {
  g.save();
  const desk = rectP(-3000, 1128, 8000, 180);
  g.fillStyle = lin(g, 0, 1128, 0, 1300, [[0, mixHex(PAL.woodDark, PAL.ink, 0.35)], [0.3, PAL.woodDark], [1, mixHex(PAL.wood, PAL.woodDark, 0.4)]]); g.fill(desk);
  g.strokeStyle = rgba(PAL.wood, 0.35); g.lineWidth = 2;
  for (let q = 0; q < 18; q++) { const yy = 1150 + H(q, 4) * 140, x0 = -2800 + H(q, 5) * 7000; g.beginPath(); g.moveTo(x0, yy); g.bezierCurveTo(x0 + 300, yy - 6, x0 + 600, yy + 8, x0 + 1000, yy); g.stroke(); }
  glow(g, -300, 1200, 1400, PAL.goldLight, 0.16);
  const edge = rectP(-3000, 1300, 8000, 28);
  g.fillStyle = lin(g, 0, 1300, 0, 1328, [PAL.wood, PAL.woodDark]); g.fill(edge);
  g.fillStyle = mixHex(PAL.woodDark, PAL.ink, 0.5); g.fillRect(-3000, 1328, 8000, 900);
  // 桌上的小东西：红线团、铅笔、剪刀、纸屑
  g.save(); g.translate(-380, 1196);
  g.fillStyle = rgba(PAL.shadow, 0.4); g.beginPath(); g.ellipse(14, 34, 70, 14, 0, 0, TAU); g.fill();
  g.fillStyle = PAL.wood; g.fill(rr(-58, -42, 18, 84, 4)); g.fill(rr(40, -42, 18, 84, 4));
  g.fillStyle = PAL.scarf; g.fill(rr(-42, -34, 84, 68, 10));
  g.strokeStyle = PAL.scarfDark; g.lineWidth = 2; for (let q = -28; q <= 28; q += 7) { g.beginPath(); g.moveTo(-40, q); g.lineTo(40, q + 3); g.stroke(); }
  g.strokeStyle = PAL.scarf; g.lineWidth = 3; g.beginPath(); g.moveTo(40, 20); g.bezierCurveTo(140, 60, 220, 10, 330, 46); g.stroke();
  g.restore();
  g.save(); g.translate(-120, 1262); g.rotate(-0.08);
  g.fillStyle = rgba(PAL.shadow, 0.35); g.fill(rr(-150, 6, 300, 12, 6));
  g.fillStyle = PAL.gold; g.fill(rr(-150, -7, 250, 14, 3)); g.fillStyle = PAL.goldDark; g.fill(rr(-150, 2, 250, 5, 2));
  g.fillStyle = PAL.sand; g.beginPath(); g.moveTo(100, -7); g.lineTo(140, 0); g.lineTo(100, 7); g.closePath(); g.fill();
  g.fillStyle = PAL.ink; g.beginPath(); g.moveTo(128, -2.6); g.lineTo(140, 0); g.lineTo(128, 2.6); g.closePath(); g.fill();
  g.fillStyle = PAL.heart; g.fill(rr(-162, -7, 16, 14, 3));
  g.restore();
  g.save(); g.translate(2260, 1205); g.rotate(0.35);
  g.fillStyle = rgba(PAL.shadow, 0.35); g.beginPath(); g.ellipse(10, 26, 110, 14, 0, 0, TAU); g.fill();
  for (const sgn of [-1, 1]) {
    g.save(); g.rotate(sgn * 0.16);
    g.fillStyle = PAL.steelDark; g.beginPath(); g.moveTo(0, -4 * sgn); g.lineTo(120, -2 * sgn); g.lineTo(120, 2 * sgn); g.lineTo(0, 6 * sgn); g.closePath(); g.fill();
    g.fillStyle = PAL.steel; g.beginPath(); g.moveTo(0, -4 * sgn); g.lineTo(118, -2 * sgn); g.lineTo(60, 0); g.closePath(); g.fill();
    g.lineWidth = 9; g.strokeStyle = PAL.red; g.beginPath(); g.ellipse(-34, 14 * sgn, 26, 15, 0, 0, TAU); g.stroke();
    g.restore();
  }
  g.fillStyle = PAL.steelDark; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
  g.restore();
  for (let q = 0; q < 7; q++) {
    const px = 2050 + H(q, 11) * 420, py = 1160 + H(q, 12) * 110, r = 16 + H(q, 13) * 22;
    const sp = poly([[px, py - r], [px + r * 1.1, py + r * 0.3], [px - r * 0.6, py + r * 0.6]], { seed: 900 + q, amp: 1.5, round: 0.2 });
    under(g, sp, 3, 0.35);
    g.fillStyle = [PAL.paper, PAL.kraft, PAL.princessLight, PAL.paper2, PAL.skyDayLow, PAL.kraft, PAL.paper][q]; g.fill(sp);
  }
  g.restore();
}

/** 剧场外框（只在 TT-OUT 看得到）：两侧立柱、顶上的檐板 + 冠饰、底下的底座。 */
function drawShell(g, T) {
  // 两侧立柱（盖住边幕外缘与木偶层 theaterClip 的直切边 x=−80 / 2000）
  for (const x0 of [-110, 1978]) {
    const post = rectP(x0, -8, 52, 1088);
    under(g, post, 6, 0.4);
    g.fillStyle = lin(g, x0, 0, x0 + 52, 0, [PAL.woodDark, mixHex(PAL.woodDark, PAL.wood, 0.55), PAL.woodDark]); g.fill(post);
    g.fillStyle = PAL.gold; g.fillRect(x0 + 7, -8, 4, 1088); g.fillRect(x0 + 41, -8, 4, 1088);
    g.fillStyle = rgba(PAL.goldLight, 0.7); g.fillRect(x0 + 7, -8, 1.5, 1088);
  }
  // 底座
  const base = rectP(-90, 1076, 2100, 60);
  under(g, base, 6, 0.4);
  g.fillStyle = lin(g, 0, 1076, 0, 1136, [PAL.wood, PAL.woodDark]); g.fill(base);
  g.fillStyle = PAL.gold; g.fillRect(-90, 1076, 2100, 6);
  for (const fx of [-60, 1980]) { const ft = rr(fx - 30, 1130, 60, 14, 5); g.fillStyle = PAL.goldDark; g.fill(ft); }
  // 檐板
  const cor = rectP(-110, -90, 2140, 92);
  under(g, cor, 8, 0.4);
  g.fillStyle = lin(g, 0, -90, 0, 2, [mixHex(PAL.woodDark, PAL.redDeep, 0.3), PAL.woodDark]); g.fill(cor);
  g.fillStyle = PAL.gold; g.fillRect(-110, -90, 2140, 7); g.fillRect(-110, -8, 2140, 8);
  g.fillStyle = PAL.goldLight; g.fillRect(-110, -90, 2140, 2);
  for (let x = -60; x < 2000; x += 80) { g.fillStyle = PAL.goldDark; g.beginPath(); g.arc(x, -44, 7, 0, TAU); g.fill(); g.fillStyle = PAL.gold; g.beginPath(); g.arc(x - 1, -45, 5, 0, TAU); g.fill(); }
  for (const fx of [-110, 2030]) { const fb = blob(fx, -112, 26, 26, { seed: 71, amp: 0.03 }); under(g, fb, 4, 0.35); cut(g, fb, PAL.gold, { rim: PAL.goldLight }); }
  // 冠饰：金扇贝 + 红宝石四角星
  g.save(); g.translate(960, -88);
  const shell = new Path2D(); shell.moveTo(-150, 0);
  for (let k = 0; k <= 8; k++) { const a = Math.PI + (k / 8) * Math.PI; shell.lineTo(Math.cos(a) * 150, Math.sin(a) * 120); }
  shell.closePath();
  under(g, shell, 6, 0.4);
  g.fillStyle = lin(g, 0, -120, 0, 0, [PAL.goldLight, PAL.gold, PAL.goldDark]); g.fill(shell);
  g.strokeStyle = PAL.goldDark; g.lineWidth = 3;
  for (let k = 1; k < 8; k++) { const a = Math.PI + (k / 8) * Math.PI; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 140, Math.sin(a) * 112); g.stroke(); }
  g.fillStyle = PAL.red; g.beginPath();
  for (let q = 0; q < 8; q++) { const a = (q / 8) * TAU - Math.PI / 2, r = q % 2 ? 11 : 32; g.lineTo(Math.cos(a) * r, -48 + Math.sin(a) * r); }
  g.closePath(); g.fill();
  g.fillStyle = rgba(PAL.white, 0.6); g.beginPath(); g.ellipse(-6, -58, 5, 3, -0.5, 0, TAU); g.fill();
  g.restore();
}

// ———————————————————— 撕口布边（盖在剑前） ————————————————————
function flap(g, pts, lining) {
  const p = poly(pts, { seed: 31, amp: 2, step: 14, round: 0.3 });
  under(g, p, 5, 0.45);
  g.fillStyle = lining; g.fill(p);
  g.fillStyle = lin(g, pts[0][0], pts[0][1], pts[2][0], pts[2][1], [[0, rgba(PAL.shadow, 0.35)], [1, rgba(PAL.redDark, 0)]]); g.fill(p);
  g.strokeStyle = rgba(mixHex(PAL.redDark, PAL.red, 0.4), 0.9); g.lineWidth = 2.4; g.stroke(p);
}
function drawFrameFront(g, T, st) {
  const lining = mixHex(PAL.redDeep, PAL.ink, 0.25);
  if (st.wingTear > 0) {
    const w = st.wingTear, { hh } = wingHole(w), f = smoothstep(0.15, 1, w);
    const yT = lerp(560 - hh, -60, clamp(st.wingTearUp)), yB = 560 + hh;
    flap(g, [[1806, yT - 4], [1846, yT + 30 * f], [1898, yT + 40 * f], [1960, yT + 22 * f], [2010, yT - 4]], lining);
    flap(g, [[1806, yB + 4], [1850, yB - 28 * f], [1902, yB - 38 * f], [1962, yB - 20 * f], [2010, yB + 4]], lining);
    g.strokeStyle = rgba(VEL.hi, 0.8); g.lineWidth = 1.3;
    for (let q = 0; q < 10; q++) { const x = 1815 + q * 18, y0 = q % 2 ? yT + 30 * f : yB - 30 * f; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + 4, y0 + (q % 2 ? 9 : -9)); g.stroke(); }
  }
  if ((st.valance === 'torn' || st.valance === 'halves') && st.tearP > 0 && (st.valance !== 'halves' || T < st.fallAt + 0.02)) {
    const x = st.tearX, top = Math.max(-92, 182 - st.tearP * 290), f = st.tearP;
    g.save(); g.translate(0, st.dy);
    flap(g, [[x - 64, top], [x - 40 + 10 * f, 172 - 20], [x - 30 + 8 * f, 186], [x - 74, 182]], lining);
    flap(g, [[x + 64, top], [x + 40 - 10 * f, 172 - 20], [x + 30 - 8 * f, 186], [x + 74, 182]], lining);
    g.restore();
  }
}

// ———————————————————— 斩线裂缝（B11 157.17：舞台地板 / 台唇沿劈开线裂开） ————————————————————
/** x = 劈开线，y0..y1 裂缝纵向范围，p 0..1 裂开程度（先往下蔓延、再张开）。返回 Path2D（剧场坐标）。 */
function crackPath(x, y0, y1, p, seed) {
  const yEnd = lerp(y0, y1, clamp(p * 1.6)), w = 1.5 + 7.5 * clamp(p);
  const L = [], R = [];
  for (let y = y0, i = 0; y < yEnd; y += 11, i++) {
    const cx = x + (H(i, seed) - 0.5) * 14, k = 1 - 0.75 * (y - y0) / Math.max(1, y1 - y0);
    L.push([cx - w * k, y]); R.push([cx + w * k, y]);
  }
  const path = new Path2D();
  if (!L.length) return path;
  path.moveTo(L[0][0], L[0][1]);
  for (const q of L) path.lineTo(q[0], q[1]);
  path.lineTo(x + (H(99, seed) - 0.5) * 10, yEnd);
  for (let i = R.length - 1; i >= 0; i--) path.lineTo(R[i][0], R[i][1]);
  path.closePath();
  return path;
}
function drawCrack(g, x, y0, y1, p, seed) {
  if (p <= 0) return;
  const c = crackPath(x, y0, y1, p, seed);
  g.save();
  g.save(); g.translate(-1.5, 0); g.strokeStyle = rgba(PAL.sand, 0.35); g.lineWidth = 2; g.stroke(c); g.restore();
  nearBlack(g, c, 1);
  g.restore();
}

// ———————————————————— 舞台地板（back 层，木偶站在上面） ————————————————————
function drawStageFloor(g, k) {
  if (k <= 0) return;
  g.save(); g.globalAlpha *= k;
  const fl = rectP(100, 806, 1720, 60);
  g.fillStyle = lin(g, 0, 806, 0, 866, [mixHex(PAL.woodDark, PAL.ink, 0.35), PAL.woodDark, PAL.wood]); g.fill(fl);
  g.strokeStyle = rgba(PAL.shadow, 0.35); g.lineWidth = 1.5;
  for (const yy of [818, 834]) { g.beginPath(); g.moveTo(100, yy); g.lineTo(1820, yy); g.stroke(); }
  for (const [yy, w] of [[THEATER.slots.back, 4], [THEATER.slots.front, 5]]) {
    g.fillStyle = mixHex(PAL.ink, PAL.shadow, 0.5); g.fillRect(140, yy - w / 2, 1640, w);
    g.fillStyle = rgba(PAL.sand, 0.3); g.fillRect(140, yy + w / 2, 1640, 1.5);
  }
  g.fillStyle = lin(g, 0, 806, 0, 822, [[0, rgba(PAL.shadow, 0.5)], [1, rgba(PAL.shadow, 0)]]); g.fillRect(100, 806, 1720, 16);
  g.restore();
}

/**
 * 纸剧场。g 为屏幕坐标系；o.cam 为剧场机位（默认 TT_W；TT_OUT 时自动画暗房）。
 * o: { part:'back'|'frame'|'frameFront', grow 0..1, curtain 0..1（>1 = 合拢挤压）, curtainSway, bite 0..1（可 <0 弹簧余振）,
 *      wingTear 0..1, wingTearUp 0..1（撕口上扩到檐板）, valance:'whole'|'torn'|'halves', tearP 0..1, tearX=600, fallAt, splitX=960,
 *      floorCrack 0..1（B11 舞台地板与台唇沿 splitX 裂开）,
 *      light:'warm'|'purple'|'off', lightK（紫 0..1，默认由 light 推）, offK, room（默认 cam.zoom<0.995）, scale（整座台口缩放，E01 1→1.8）,
 *      cam, cave（back 里传给 drawCave 的参数，默认 STANDOFF.caveOpts；也认 caveOpts）, tasselSwing（弧度） }
 * 返回 { opening:{x0,x1,y0,y1}（当前台口内框，剧场坐标）, lipTop }。
 */
export function drawTheater(g, T, o = {}) {
  const part = o.part || 'frame';
  const grow = clamp(o.grow ?? 1);
  const c = o.cam || CAMS.TT_W;
  const room = o.room ?? c.zoom < 0.995;
  const scale = o.scale ?? 1;
  const light = o.light || 'warm';
  const bite = o.bite ?? 0;
  const st = {
    grow, room, curtain: o.curtain ?? 0, curtainSway: o.curtainSway ?? 0, bite, floorCrack: clamp(o.floorCrack ?? 0),
    dy: bite * 362, dyB: bite * 314,
    wingTear: clamp(o.wingTear ?? 0), wingTearUp: clamp(o.wingTearUp ?? 0), valance: o.valance || 'whole', tearP: clamp(o.tearP ?? (o.valance === 'torn' || o.valance === 'halves' ? 1 : 0)), tearX: o.tearX ?? 600,
    fallAt: o.fallAt ?? Infinity, splitX: o.splitX ?? 960,
    lightK: clamp(o.lightK ?? (light === 'purple' ? 1 : 0)), offK: clamp(o.offK ?? (light === 'off' ? 1 : 0)),
    hK: outCubic(seg(grow, 0.1, 0.6)), colorK: seg(grow, 0, 0.577), braidK: seg(grow, 0.3, 0.62),
    fringeOf: (x) => seg(grow, 0.29 + 0.22 * Math.abs(x - 960) / 1000, 0.29 + 0.22 * Math.abs(x - 960) / 1000 + 0.2),
    tasselK: seg(grow, 0.55, 0.85), tasselSwing: (o.tasselSwing ?? 0) + 0.12 * wobble(grow * 0.52, 0.3, 2.2, 0.25) + 0.02 * Math.sin(T * 1.3),
    wingK: outCubic(seg(grow, 0.19, 0.87)),
    lipK: outCubic(seg(grow, 0.1, 0.7)), lipColorK: seg(grow, 0.15, 0.65),
    lampOf: (i) => seg(grow, 0.38 + 0.085 * i, 0.38 + 0.085 * i + 0.12),
  };
  st.lampAll = (1 - st.offK) * seg(grow, 0.4, 0.95);
  g.save();
  if (part === 'back' && room) drawRoomWall(g, T, c);
  applyCam(g, c, 1);
  if (scale !== 1) { g.translate(960, 540); g.scale(scale, scale); g.translate(-960, -540); }
  let lipTop = 860 - st.dyB;
  if (part === 'back') {
    const box = rectP(-60, -90, 2040, 1170);
    g.save();
    g.clip(box);
    g.fillStyle = mixHex(PAL.ink, PAL.redDeep, 0.3); g.fill(box);
    const k = 1 - (1 - THEATER.backdrop.scale) * outCubic(seg(grow, 0.2, 0.9));
    const [bx, by] = THEATER.backdrop.center;
    // 背景片上沿的吊杆与吊绳（顶幕掉了 / 撕开时看得到）
    const topY = by - by * k;
    g.strokeStyle = rgba(PAL.sand, 0.35); g.lineWidth = 2;
    for (const rx of [300, 960, 1620]) { g.beginPath(); g.moveTo(rx, -90); g.lineTo(rx, topY); g.stroke(); }
    g.save();
    g.translate(bx, by); g.scale(k, k); g.translate(-bx, -by);
    g.beginPath(); g.rect(-40, -40, 2000, 1160); g.clip();
    drawCave(g, T, cam(960, 540, 1), { ...(o.cave || o.caveOpts || STANDOFF.caveOpts), flat: true, chain: false });
    g.restore();
    g.fillStyle = PAL.woodDark; g.fill(rr(bx - 1000 * k - 10, topY - 12, 2000 * k + 20, 16, 5));
    g.fillStyle = rgba(PAL.sand, 0.3); g.fillRect(bx - 1000 * k - 6, topY - 11, 2000 * k + 12, 3);
    // 舞台灯打在背景片上
    if (grow > 0) {
      const L = lampColors(st), a = st.lampAll;
      g.save(); g.globalCompositeOperation = 'screen';
      g.fillStyle = lin(g, 0, 860, 0, 360, [[0, rgba(L.wash, 0.2 * a)], [1, rgba(L.wash, 0)]]); g.fillRect(-60, 300, 2040, 600);
      g.restore();
    }
    drawStageFloor(g, seg(grow, 0.35, 0.8));
    drawCrack(g, st.splitX, 806, 868, st.floorCrack, 11);
    g.restore();
  } else if (part === 'frame') {
    const op = rectP(THEATER.opening.x0, 0, THEATER.opening.x1 - THEATER.opening.x0, 880);
    drawCurtains(g, T, st);
    // 舞台光：脚灯往上的暖光 / 紫光；敌方回合在台口内叠紫，熄灯压暗
    if (grow > 0) {
      const L = lampColors(st), a = st.lampAll;
      g.save(); g.clip(op);
      if (st.lightK > 0) { g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba(PAL.dragon, 0.18 * st.lightK); g.fill(op); g.globalCompositeOperation = 'source-over'; }
      if (st.offK > 0) { g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba(PAL.ink, 0.35 * st.offK); g.fill(op); g.globalCompositeOperation = 'source-over'; }
      if (a > 0) {
        for (const fx of THEATER.footlights) glow(g, fx, 880 - st.dyB, 330, L.halo, 0.13 * a);
        g.globalCompositeOperation = 'screen';
        g.fillStyle = lin(g, 0, 870 - st.dyB, 0, 520, [[0, rgba(L.wash, 0.16 * a)], [1, rgba(L.wash, 0)]]); g.fill(op);
      }
      g.restore();
    }
    // 咬合：台口内两颚之间压成黑缝
    if (bite > 0.05) {
      const top = 150 + st.dy, bot = 860 - st.dyB;
      const gap = rectP(THEATER.opening.x0 - 10, top, THEATER.opening.x1 - THEATER.opening.x0 + 20, Math.max(0, bot - top));
      nearBlack(g, gap, smoothstep(0.3, 1, bite) * 0.97);
    }
    drawWing(g, -1, st);
    drawWing(g, 1, st);
    drawValance(g, T, st);
    if (room) { drawDesk(g, T); drawShell(g, T); }
    lipTop = drawLip(g, T, st);
  } else if (part === 'frameFront') {
    drawFrameFront(g, T, st);
  }
  g.restore();
  return { opening: { x0: THEATER.opening.x0, x1: THEATER.opening.x1, y0: 150 + st.dy, y1: 860 - st.dyB }, lipTop };
}
