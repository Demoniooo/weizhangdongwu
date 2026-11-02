// 人马合拍模型图：mount 中段、ride、rideSlash、rideFront + ridePillion 双人、face=−1 归程版、马上其它动作；第 2 页动态串场。
// node tools/render.mjs stills --sheet ride --times 0.5,1.5 --outdir out/review/sheets/ride
import { PAL, rgba, mixHex, blob, smooth as smoothPath } from '../core/paper.js';
import { clamp, lerp, TAU } from '../core/util.js';
import { ez, inOutQuad, outQuad } from '../core/ease.js';
import { sheetBg, label, ground } from './horse.js';
import { drawHorse, horseRig, horsePhase, drawReins } from '../rigs/horse.js';
import { drawHero, HERO_SEAT } from '../rigs/hero.js';

// 公主模块存在就用正式的，否则用占位纸偶（只为检验后座锚点）
let drawPrincess = null;
try { ({ drawPrincess } = await import('../rigs/princess.js')); } catch (e) { drawPrincess = null; }

/** 公主占位：粉裙 + 金辫的剪纸坐姿小偶，(x,y) = 臀底。 */
function princessStub(g, o) {
  const { x, y, s = 1, face = 1 } = o;
  g.save(); g.translate(x, y); g.scale(s * face, s);
  g.fillStyle = PAL.princessDark; g.fill(blob(6, 4, 30, 16, { seed: 3 }));
  g.fillStyle = PAL.princess; g.fill(blob(2, -36, 22, 40, { seed: 4 }));
  g.fillStyle = PAL.skin; g.fill(blob(10, -92, 26, 25, { seed: 5 }));
  g.fillStyle = PAL.hairGold; g.fill(blob(2, -104, 27, 16, { seed: 6 }));
  g.strokeStyle = PAL.hairGoldDark; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-14, -96); g.quadraticCurveTo(-30, -70, -22, -40); g.stroke();
  g.fillStyle = PAL.gold; g.beginPath(); g.moveTo(-4, -118); g.lineTo(2, -130); g.lineTo(8, -120); g.lineTo(14, -131); g.lineTo(18, -118); g.closePath(); g.fill();
  g.fillStyle = PAL.ink; g.beginPath(); g.ellipse(22, -92, 2.2, 3.2, 0, 0, TAU); g.fill();
  g.restore();
}

/** 画一组人马：马 → 后座 → 骑手 → 缰绳。返回 { h, a }（马、骑手锚点）。 */
function rideGroup(lg, o) {
  const hO = { s: 1, stirrup: 'ride', ...o.horse };
  const h = drawHorse(lg, hO);
  if (o.pillion) {
    const pO = { x: h.saddleBack[0], y: h.saddleBack[1], s: hO.s, face: hO.face ?? 1, t: hO.t, pose: 'ridePillion', rot: h.saddleRot };
    if (drawPrincess) drawPrincess(lg, pO); else princessStub(lg, pO);
  }
  const rO = { x: h.saddle[0], y: h.saddle[1], s: hO.s, face: hO.face ?? 1, t: hO.t, phase: hO.phase, rot: h.saddleRot, squash: hO.squash, scarf: { len: 300 }, ...o.hero };
  const a = drawHero(lg, rO);
  if (o.reins !== false && a && a.handL) drawReins(lg, h.bit, a.handL, { s: hO.s });
  return { h, a };
}
const mark = (g, p, c, n) => { g.save(); g.fillStyle = c; g.strokeStyle = PAL.white; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], 5, 0, TAU); g.fill(); g.stroke(); g.restore(); if (n) label(g, n, p[0] + 40, p[1] - 12, 15, { fill: c }); };

function pageStatic(g, T, ctx) {
  sheetBg(g, '人马合拍 ride · 1/2', `drawHero 骑乘类 pose 的 (x,y) = drawHorse 返回的 saddle（鞍顶），rot = saddleRot；后座 = saddleBack${drawPrincess ? '' : '（公主模块未就绪：粉色占位偶）'}`);
  const s = 0.82, y1 = 470, y2 = 960;
  for (const [x0, x1, y] of [[60, 1860, y1], [60, 1860, y2]]) ground(g, x0, x1, y, s);
  const ph = horsePhase(T * 900, s);
  // —— 第一排 ——
  // ① mount 中段：从马左侧地面起跳，弧线落进鞍（k=0.5）
  const mx = 230;
  const hm = horseRig({ x: mx, y: y1, s, pose: 'stand', t: T });
  const start = [mx - 150 * s, y1 - HERO_SEAT * s], end = hm.saddle;
  const k = 0.5, mid = [lerp(start[0], end[0], k), lerp(start[1], end[1], k) - 80 * s * 4 * k * (1 - k)];
  g.save(); g.setLineDash([6, 6]); g.strokeStyle = rgba(PAL.red, 0.55); g.lineWidth = 2;
  g.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20; const p = [lerp(start[0], end[0], u), lerp(start[1], end[1], u) - 80 * s * 4 * u * (1 - u)]; i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); g.restore();
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
    drawHorse(lg, { x: mx, y: y1, s, pose: 'stand', t: T });
    drawHero(lg, { x: mid[0], y: mid[1], s, t: T, pose: 'mount', scarf: { len: 300 } });
    // ② ride（gallop 同相位）
    rideGroup(lg, { horse: { x: 640, y: y1, s, pose: 'gallop', phase: ph, t: T }, hero: { pose: 'ride' } });
    // ③ rideSlash（三连斩的出刀瞬间）
    rideGroup(lg, { horse: { x: 1080, y: y1, s, pose: 'gallop', phase: ph + 0.3, t: T }, hero: { pose: 'rideSlash', act: 0.32 } });
    // ④ rideFront + ridePillion
    rideGroup(lg, { horse: { x: 1560, y: y1, s, pose: 'gallop', phase: ph + 0.55, t: T }, hero: { pose: 'rideFront' }, pillion: true });
  });
  mark(g, end, PAL.red, 'saddle');
  label(g, 'mount（弧线中段 k=0.5）', mx, y1 + 30, 19, { fill: PAL.ink });
  label(g, 'ride', 640, y1 + 30, 19, { fill: PAL.ink });
  label(g, 'rideSlash', 1080, y1 + 30, 19, { fill: PAL.ink });
  label(g, 'rideFront + ridePillion', 1560, y1 + 30, 19, { fill: PAL.ink });
  // —— 第二排：归程 face −1 与马上其它动作 ——
  const ph2 = horsePhase(-T * 900, s);
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
    rideGroup(lg, { horse: { x: 230, y: y2, s, face: -1, pose: 'gallop', phase: ph2, t: T }, hero: { pose: 'ride' } });
    rideGroup(lg, { horse: { x: 680, y: y2, s, face: -1, pose: 'gallop', phase: ph2 + 0.4, t: T }, hero: { pose: 'rideFront' }, pillion: true });
    rideGroup(lg, { horse: { x: 1130, y: y2, s, pose: 'walk', t: T }, hero: { pose: 'rideLean' } });
    rideGroup(lg, { horse: { x: 1560, y: y2, s, pose: 'headwind', gait: 'trot', t: T, icicles: 1, breath: 1 }, hero: { pose: 'rideHunch' } });
  });
  label(g, 'ride face −1（归程）', 230, y2 + 30, 19, { fill: PAL.ink });
  label(g, 'rideFront + ridePillion face −1', 680, y2 + 30, 19, { fill: PAL.ink });
  label(g, 'walk + rideLean（挑箱）', 1130, y2 + 30, 19, { fill: PAL.ink });
  label(g, 'headwind + rideHunch', 1560, y2 + 30, 19, { fill: PAL.ink });
}

// —— 第 2 页：V02 缩略版串场：奔入 → 急停扬蹄 → 甩头 → 勇者起跳落鞍（同挤压）→ 踏蹄 → 奔出挥刀 ——
function pageRun(g, T, ctx) {
  const t = T - 1;
  sheetBg(g, '人马合拍 ride · 2/2 动态', 'V02 缩略：白马奔入 → 急停人立 → 甩头 → 勇者起跳落鞍（人马同一个 squash）→ 踏蹄 → 奔出、马上挥刀');
  const s = 1, gy = 860;
  ground(g, 60, 1860, gy, s);
  // 马的世界 x：0–0.7 奔入减速，0.7–1.0 急停
  const hx = t < 1.0 ? lerp(-260, 860, 1 - (1 - clamp(t / 1.0)) ** 2) : t < 2.55 ? 860 : 860 + 0.5 * 1800 * (t - 2.55) ** 2 * (t < 2.9 ? 1 : 0) + (t >= 2.9 ? 0.5 * 1800 * 0.35 ** 2 + 630 * (t - 2.9) : 0);
  const speed = t < 1.0 ? 2240 * (1 - clamp(t / 1.0)) : t > 2.55 ? Math.min(900, 1800 * (t - 2.55)) : 0;
  let pose = 'gallop', extra = {};
  const kk = (a, b) => clamp((t - a) / (b - a));
  if (t < 0.62) pose = 'speedLines';
  else if (t < 0.8) pose = { from: 'gallop', to: 'skid', k: inOutQuad(kk(0.62, 0.8)) };
  else if (t < 1.05) pose = { from: 'skid', to: 'rear', k: inOutQuad(kk(0.8, 1.05)) };
  else if (t < 1.25) pose = { from: 'rear', to: 'stand', k: inOutQuad(kk(1.05, 1.25)) };
  else if (t < 2.2) { pose = 'tossMane'; extra.at = 1 + 1.4; extra.stamp = 1 + 2.12; }
  else if (t < 2.55) { pose = 'stand'; extra.stamp = 1 + 2.12; }
  else if (t < 2.75) pose = { from: 'stand', to: 'gallop', k: inOutQuad(kk(2.55, 2.75)) };
  // 起跳落鞍：1.55–1.95 弧线，1.95 落鞍挤压
  const land = 1.95, sq = t > land ? -0.16 * Math.exp(-(t - land) / 0.12) * Math.cos((t - land) * 26) : 0;
  const hO = { x: hx, y: gy, s, t: T, pose, phase: horsePhase(hx, s), speed, vel: [speed, 0], squash: sq, ...extra };
  const hr = horseRig(hO);
  const ground0 = [700, gy - HERO_SEAT * s];
  ctx.layer(g, { shadow: 9, texture: 0.25 }, (lg) => {
    if (t < 1.55) {
      drawHorse(lg, hO);
      drawHero(lg, { x: 700, y: gy, s, t: T, pose: 'idle', expr: 'grin', scarf: { len: 420 } });
    } else if (t < land) {
      drawHorse(lg, hO);
      const u = (t - 1.55) / (land - 1.55);
      const p = [lerp(ground0[0], hr.saddle[0], u), lerp(ground0[1], hr.saddle[1], u) - 170 * 4 * u * (1 - u)];
      drawHero(lg, { x: p[0], y: p[1], s, t: T, pose: 'mount', scarf: { len: 420 } });
    } else {
      const slash = t > 2.9 ? { pose: 'rideSlash', act: clamp((t - 2.95) / 0.6) } : { pose: 'ride' };
      rideGroup(lg, { horse: hO, hero: { ...slash, scarf: { len: 420 } } });
    }
  });
  label(g, `t = ${t.toFixed(2)}`, 960, 960, 24, { fill: PAL.ink });
}

export default [
  { id: 'sheet_ride_static', start: 0, end: 1, draw: (g, T, lt, ctx) => pageStatic(g, T, ctx) },
  { id: 'sheet_ride_run', start: 1, end: 4.6, draw: (g, T, lt, ctx) => pageRun(g, T, ctx) },
];
