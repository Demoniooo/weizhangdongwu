// b01 私有辅助：活机位、整帧后期、台灯光、封面金箔扫光、开书透光与金尘、立起点缀（光点 / 纸屑 / 花瓣）、公主闪光。
// 纯函数：只由 T 决定（粒子用 hash2 定种）；不调 ctx.layer / ctx.mask（图层由镜头决定）。
import { PAL, glow, sparkle, lin, rad } from '../../core/paper.js';
import { applyCam, drift, shake } from '../../core/camera.js';
import { clamp, lerp, seg, hash2, TAU, rgba, pulse } from '../../core/util.js';
import { ez, glide, outBack, outQuad, inOutSine, smooth } from '../../core/ease.js';
import { burst } from '../../core/particles.js';
import { paperGlyph } from '../../ui/type.js';
import { bookToCastleCam, BOOK } from '../../env/book.js';
import { castleToScreen, CASTLE } from '../../env/castle.js';
import { cue } from '../../cues.js';
import { PRINCESS } from './shared.js';

const I0 = cue('intro');
const at = (x) => I0 + x;
/** 书内坐标 → 屏幕（书内机位 c，depth 1） */
const bk = (c, x, y) => [(x - c.x) * c.zoom + 960, (y - c.y) * c.zoom + 540];

// ———————————————————— 机位与整帧后期 ————————————————————
/** 叠手持漂移（屏幕振幅约 5px）；推镜途中 8.30–9.30 收掉，9.30 起机位严格等于 bookPushCam（与 b02 同一条）。 */
export function liveCam(c, T) {
  const w = 1 - ez(T, at(8.3), at(9.3), smooth);
  if (w <= 0) return c;
  const [dx, dy] = drift(T, { amp: 5, speed: 0.35, seed: 11 });
  return { ...c, x: c.x + (dx * w) / c.zoom, y: c.y + (dy * w) / c.zoom };
}

// 立起的“拍子”：每一级立体件冲上来时整帧轻轻一顶（fx.zoom 脉冲），主堡最重
const BEATS = [[5.62, 0.004], [6.24, 0.0025], [6.66, 0.007], [6.95, 0.003], [7.86, 0.0025], [8.02, 0.003]];
const punch = (x, t0, a, tau = 0.055) => (x < t0 ? 0 : a * ((x - t0) / tau) * Math.exp(1 - (x - t0) / tau));

/** 整帧：黑场淡入、封面暗角 0.42、立体书 sat 1.05、立起拍子、主堡轻震。交接期（lean）不碰。 */
export function frameFx(ctx, T, lean) {
  const fx = ctx.fx, x = T - I0;
  if (x < 1.2) fx.fade = Math.max(fx.fade || 0, 1 - outQuad(seg(x, 0, 1.2)));
  if (lean) return;
  const vig = lerp(0.42, 0.3, ez(x, 3.7, 5.2, glide));
  if (vig > fx.vignette) fx.vignette = vig;
  const sat = 1 + 0.05 * seg(x, 4.9, 5.6) * (1 - seg(x, 8.7, 9.4));
  if (sat !== 1) fx.sat = (fx.sat || 1) * sat;
  let z = 0;
  for (const [t0, a] of BEATS) z += punch(x, t0, a);
  if (z > 0) fx.zoom = Math.max(fx.zoom || 1, 1 + z);
  const b = shake(T, at(6.66), { amp: 2.2, decay: 0.09, freq: 18, seed: 9 });
  if (b[0] || b[1]) fx.shake = [fx.shake[0] + b[0], fx.shake[1] + b[1]];
}

// ———————————————————— 台灯（左上主光）：暖光 + 远角压暗 ————————————————————
/** 台灯光洒在书桌与书上（screen 暖光 + 右下远处 multiply 压暗）；推镜进书时 8.40–9.30 收掉（交接帧不带）。 */
export function lampGrade(g, T, c, lamp) {
  const k = 1 - seg(T, at(8.4), at(9.3));
  if (k <= 0.001) return;
  const [sx, sy] = bk(c, BOOK.lamp.x, BOOK.lamp.y);
  const z = c.zoom;
  g.save();
  // 远离台灯处压暗（灯没亮时整片都暗，亮起后只剩右下）
  g.globalCompositeOperation = 'multiply';
  const r0 = lerp(200, 760, lamp) * z, r1 = 2700 * z;
  g.fillStyle = rad(g, sx, sy, r0, r1, [[0, rgba(PAL.shadow, 0)], [0.55, rgba(PAL.shadow, 0.16 * k)], [1, rgba(PAL.shadow, 0.42 * k)]]);
  g.fillRect(0, 0, 1920, 1080);
  g.restore();
  // 0.05「咔」：灯泡亮起的一下暖光透过黑场（随后两次闪烁由 lamp 本身给出）
  const flare = 0.24 * pulse(T - I0, 0.11, 0.05);
  if (lamp > 0) glow(g, sx, sy, 1450 * z, PAL.goldLight, (0.14 * lamp + flare) * k);
}

// ———————————————————— 封面金箔扫光（book.js 自带的扫光因 paperGlyph 局部坐标问题看不见，这里在字形里补画） ————————————————————
/**
 * 在书体图层里、drawBook('book') 之后调用：p = 扫光进度 0..1（只在 0<p<1 时画），centers = drawBook 返回的 titleCenters（书内坐标）。
 * 一道斜向亮带从左扫过「达拉崩吧」（只落在字形里），同时一层很淡的光掠过皮面。封面合着、不发抖时用（b01 1.20–2.40；b17 片尾也可复用）。
 */
export function coverFoil(lg, p, c, centers) {
  if (!centers || p <= 0 || p >= 1) return;
  const Tt = BOOK.title, C = BOOK.cover;
  const u = inOutSine(clamp(p));
  const bx = lerp(Tt.x - 520, Tt.x + 520, u), by = Tt.y;
  lg.save();
  applyCam(lg, c, 1);
  lg.globalCompositeOperation = 'screen';
  // 皮面上的一层宽而淡的掠光
  lg.save();
  lg.beginPath(); lg.rect(C.x0, C.y0, C.x1 - C.x0, C.y1 - C.y0); lg.clip();
  lg.fillStyle = lin(lg, bx - 260, by - 170, bx + 260, by + 170, [[0, rgba(PAL.goldLight, 0)], [0.5, rgba(PAL.goldLight, 0.13)], [1, rgba(PAL.goldLight, 0)]]);
  lg.fillRect(C.x0, C.y0, C.x1 - C.x0, C.y1 - C.y0);
  lg.restore();
  // 字形里的亮带（渐变按字心平移：paperGlyph 在字形局部坐标里求值）
  const chars = [...Tt.text];
  chars.forEach((ch, k) => {
    const [cx, cy] = centers[k];
    const band = lin(lg, bx - 120 - cx, by - 80 - cy, bx + 120 - cx, by + 80 - cy, [
      [0, rgba(PAL.white, 0)], [0.36, rgba(PAL.goldLight, 0)], [0.46, rgba(PAL.goldLight, 0.75)],
      [0.5, rgba(PAL.white, 1)], [0.54, rgba(PAL.goldLight, 0.75)], [0.64, rgba(PAL.goldLight, 0)], [1, rgba(PAL.white, 0)],
    ]);
    paperGlyph(lg, ch, cx, cy, Tt.size, { fill: band, edge: null });
  });
  lg.restore();
}

// ———————————————————— 开书：书缝透光 + 金尘 + 封面落下压出的气 ————————————————————
/** 封面翻过 90° 前后，书页里透出一团暖光（screen，书内坐标的书缝）。画在立体件之前、书体之后。 */
export function gutterLight(g, T, c) {
  const x = T - I0;
  const k = Math.sin(Math.PI * seg(x, 3.85, 5.05));
  if (k <= 0.01) return;
  const [sx, sy] = bk(c, 960, 520);
  g.save();
  g.translate(sx, sy);
  g.scale(0.7, 1.15);
  glow(g, 0, 0, 520 * c.zoom, PAL.goldLight, 0.34 * k);
  g.restore();
  glow(g, sx, sy, 180 * c.zoom, PAL.white, 0.22 * k);
}

const MOTES = Array.from({ length: 46 }, (_, i) => ({
  tb: 4.1 + hash2(i, 1) * 0.7,
  y0: 290 + hash2(i, 2) * 500,
  vx: (hash2(i, 3) - 0.5) * 190,
  vy: -(30 + hash2(i, 4) * 95),
  life: 1.4 + hash2(i, 5) * 1.2,
  size: 2.2 + hash2(i, 6) * 3.2,
  ph: hash2(i, 7) * TAU,
  star: hash2(i, 8) > 0.68,
}));
const AIR = Array.from({ length: 24 }, (_, i) => ({
  side: i < 15 ? 'left' : 'bottom',
  tb: 4.76 + hash2(i, 11) * 0.12,
  u: hash2(i, 12),
  v: 90 + hash2(i, 13) * 140,
  life: 0.7 + hash2(i, 14) * 0.6,
  size: 1.8 + hash2(i, 15) * 2.4,
}));

/** 书缝里飘出的金尘、封面落下时从书边压出的浮尘（书内坐标，画在前景浮尘层里）。 */
export function openMotes(lg, T, c) {
  const x = T - I0;
  if (x < 4.05 || x > 7.3) return;
  lg.save();
  applyCam(lg, c, 1);
  for (const m of MOTES) {
    const age = x - m.tb;
    if (age < 0 || age > m.life) continue;
    const p = age / m.life;
    const drag = (1 - Math.exp(-1.5 * age)) / 1.5;
    const px = 960 + m.vx * drag + Math.sin(age * 2.2 + m.ph) * 16;
    const py = m.y0 + m.vy * age;
    const a = Math.min(1, p * 5) * (1 - p) ** 1.3 * (0.65 + 0.35 * Math.sin(age * 9 + m.ph));
    if (m.star) {
      glow(lg, px, py, m.size * 5, PAL.goldLight, a * 0.5);
      sparkle(lg, px, py, m.size * 3.4, { color: PAL.white, alpha: a, rot: age * 2 + m.ph });
    } else {
      lg.globalAlpha = a;
      lg.fillStyle = m.size > 4 ? PAL.white : PAL.goldLight;
      lg.beginPath(); lg.arc(px, py, m.size, 0, TAU); lg.fill();
      lg.globalAlpha = 1;
    }
  }
  for (const m of AIR) {
    const age = x - m.tb;
    if (age < 0 || age > m.life) continue;
    const p = age / m.life;
    const drag = (1 - Math.exp(-3 * age)) / 3;
    let px, py;
    if (m.side === 'left') { px = 78 - m.v * drag; py = 210 + m.u * 660 - 30 * age; } else { px = 100 + m.u * 840; py = 886 + m.v * 0.6 * drag; }
    lg.globalAlpha = (1 - p) ** 1.5 * 0.75;
    lg.fillStyle = m.size > 3 ? PAL.paper : PAL.goldLight;
    lg.beginPath(); lg.arc(px, py, m.size, 0, TAU); lg.fill();
    lg.globalAlpha = 1;
  }
  lg.restore();
}

// ———————————————————— 推镜进书：镜头前飞过的虚焦浮尘（depth > 1，比书页放大得快 → 向四周飞散） ————————————————————
const BOKEH = Array.from({ length: 12 }, (_, i) => {
  const ang = (i / 12) * TAU + (hash2(i, 31) - 0.5) * 0.5;
  const rr = 150 + hash2(i, 32) * 300;
  return { x: 954 + Math.cos(ang) * rr * 1.7, y: 640 + Math.sin(ang) * rr * 0.9, d: 1.6 + hash2(i, 33) * 0.9, r: 7 + hash2(i, 34) * 9, ph: hash2(i, 35) * TAU, warm: hash2(i, 36) > 0.3 };
});
/**
 * 8.25–9.30：书内坐标、深度 1.6–2.5 处的一圈浮尘（避开画面中心的阳台），推镜时比书页放大得快，从中心向外掠过镜头。
 * 画在单独的虚焦图层里（blur 5）。
 */
export function pushBokeh(lg, T, c) {
  const x = T - I0;
  const k = seg(x, 8.25, 8.6) * (1 - seg(x, 8.95, 9.3));
  if (k <= 0.01) return;
  for (const m of BOKEH) {
    lg.save();
    applyCam(lg, c, m.d);
    const px = m.x + Math.sin(x * 0.9 + m.ph) * 10, py = m.y + Math.cos(x * 0.7 + m.ph) * 8;
    const a = k * (0.7 + 0.3 * Math.sin(x * 3 + m.ph));
    const col = m.warm ? PAL.goldLight : PAL.white;
    glow(lg, px, py, m.r * 2.4, col, a * 0.55);
    lg.globalAlpha = a * 0.5;
    lg.fillStyle = col;
    lg.beginPath(); lg.arc(px, py, m.r, 0, TAU); lg.fill();
    lg.restore();
  }
}

// ———————————————————— 立起点缀 ————————————————————
// 光点“叮”：塔顶旗杆尖随 13 座塔从左到右逐个闪一下，主堡尖顶闪一颗大的（剑光 = 星星 的四角星）
const popS = (k) => (k >= 1 ? 1 : k <= 0 ? 0 : Math.max(0.002, outBack(clamp(k), 1.5)));
const PINGS = CASTLE.towers.map((tw) => {
  const t0 = tw.keep ? 6.5 : 5.7 + 0.055 * tw.i;
  const dur = tw.keep ? 0.38 : 0.32;
  return { tw, t0, dur, at: t0 + dur * 0.62, size: tw.keep ? 30 : 15, seed: 30 + tw.i };
});
// 纸屑：城墙落地、屋顶落地扬起的一点牛皮纸屑（绿草地上看得见）
const PUFFS = [
  ...[300, 640, 960, 1280, 1620].map((x, j) => ({ at: 5.6 + Math.abs(j - 2) * 0.03, x, y: 880, n: 7, r: 46, seed: 20 + j })),
  ...CASTLE.houses.map((h, j) => ({ at: 6.94 + j * 0.012, x: h.x, y: 960, n: 5, r: 34, seed: 80 + j })),
];
const PETALS = [{ at: 7.13, x: 40, y: 1000, dir: 1, seed: 91 }, { at: 7.16, x: 1880, y: 1000, dir: -1, seed: 92 }];
const FLECK = [PAL.kraft, PAL.paper, PAL.kraftDark, PAL.paper2];
const PETAL = [PAL.princess, PAL.heart, PAL.princessLight, PAL.goldLight];

function ping(g, sx, sy, k, size) {
  const e = Math.sin(Math.PI * clamp(k));
  if (e <= 0.01) return;
  glow(g, sx, sy, size * 2.6, PAL.goldLight, 0.55 * e);
  sparkle(g, sx, sy, size * (0.35 + 0.65 * outBack(clamp(k * 1.8), 2.2)) * e, { color: PAL.white, alpha: 0.95, rot: k * 1.2 });
}

/** 立起点缀（屏幕空间，画在立体件之上）：塔尖光点、纸屑、花瓣、太阳到位的暖光。 */
export function popAccents(g, T, c) {
  const x = T - I0;
  if (x < 5.4 || x > 8.6) return;
  const cc = bookToCastleCam(c);
  const z = cc.zoom;
  for (const P of PINGS) {
    const k = (x - P.at) / 0.34;
    if (k <= 0 || k >= 1) continue;
    const s = popS(seg(x, P.t0, P.t0 + P.dur));
    const tipY = 700 + (P.tw.poleTop - 700) * s;
    const [sx, sy] = castleToScreen(cc, 'main', P.tw.x, tipY);
    ping(g, sx, sy, k, P.size * z * 2);
  }
  for (const P of PUFFS) {
    if (x < P.at || x > P.at + 0.9) continue;
    const [sx, sy] = castleToScreen(cc, 'main', P.x, P.y);
    burst(g, T, { at: at(P.at), seed: P.seed, count: P.n, x: sx, y: sy - 4 * z, spread: P.r * 0.35 * z, speed: [130 * z, 400 * z], angle: [-Math.PI * 0.94, -Math.PI * 0.06], gravity: 620 * z, drag: 3.2, life: [0.45, 0.85], spin: [-9, 9], size: [6, 11] }, (bg, px, py, s) => {
      const a = (1 - s.p) ** 1.3;
      const w = s.size * z * 1.7;
      bg.save();
      bg.globalAlpha *= a;
      bg.translate(px, py); bg.rotate(s.rot);
      bg.fillStyle = FLECK[s.i % FLECK.length];
      bg.fillRect(-w / 2, -w * 0.32, w, w * 0.64);
      bg.restore();
    });
  }
  for (const P of PETALS) {
    if (x < P.at || x > P.at + 1.4) continue;
    const [sx, sy] = castleToScreen(cc, 'main', P.x, P.y);
    burst(g, T, { at: at(P.at), seed: P.seed, count: 10, x: sx, y: sy, spread: 60 * z, speed: [260 * z, 560 * z], angle: P.dir > 0 ? [-1.45, -0.55] : [-Math.PI + 0.55, -Math.PI + 1.45], gravity: 260 * z, drag: 2.4, life: [0.9, 1.35], spin: [-5, 5], size: [8, 12] }, (bg, px, py, s) => {
      const a = Math.min(1, s.p * 6) * (1 - s.p) ** 1.2;
      const w = s.size * z * 2;
      bg.save();
      bg.globalAlpha *= a;
      bg.translate(px + Math.sin(s.age * 5 + s.i) * 6 * z, py); bg.rotate(s.rot);
      bg.fillStyle = PETAL[s.i % PETAL.length];
      bg.beginPath(); bg.ellipse(0, 0, w * 0.55, w * 0.32, 0, 0, TAU); bg.fill();
      bg.restore();
    });
  }
  // 太阳沿铁丝升到位（7.85）：一圈暖光脉冲 + 一颗四角星
  const sunK = seg(x, 7.8, 8.45);
  if (sunK > 0 && sunK < 1) {
    const [sx, sy] = castleToScreen(cc, 'main', 960, -54);
    const e = Math.sin(Math.PI * sunK);
    glow(g, sx, sy, 330 * z * (0.8 + 0.4 * sunK), PAL.goldLight, 0.42 * e);
    sparkle(g, sx + 92 * z, sy - 88 * z, 34 * z * outBack(clamp(sunK * 2.2), 2.2) * (1 - smooth(seg(sunK, 0.55, 1))), { color: PAL.white, alpha: 0.95, rot: sunK * 0.9 });
  }
}

// ———————————————————— 公主弹出的闪光（7.90–8.60） ————————————————————
export function princessSparkle(g, T, c) {
  const x = T - I0;
  if (x < 7.95 || x > 8.7) return;
  const cc = bookToCastleCam(c);
  const z = cc.zoom;
  const [hx, hy] = castleToScreen(cc, 'main', PRINCESS.x - 4, 506);
  const k = seg(x, 7.98, 8.6);
  const grow = outBack(clamp(k / 0.28), 2.6);
  const fade = 1 - smooth(seg(k, 0.45, 1));
  glow(g, hx, hy, 120 * z, PAL.goldLight, 0.6 * fade);
  sparkle(g, hx + 26 * z, hy - 24 * z, 50 * z * grow * fade, { color: PAL.white, alpha: 1, rot: k * 1.4 });
  for (let j = 0; j < 3; j++) {
    const kk = seg(x, 8.06 + j * 0.07, 8.5 + j * 0.07);
    if (kk <= 0 || kk >= 1) continue;
    const a = Math.sin(Math.PI * kk);
    const ang = -2.3 + j * 1.25;
    const r = (44 + 34 * kk) * z;
    sparkle(g, hx + Math.cos(ang) * r, hy + Math.sin(ang) * r, 18 * z * a, { color: j === 1 ? PAL.goldLight : PAL.white, alpha: a, rot: kk * 2 });
  }
}
