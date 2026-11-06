// 小动物模型图：每种 3 个关键帧 + 史莱姆弹出/表情/炸开 + 纸鸽叼横幅锚点检验。
// node tools/render.mjs stills --sheet monsters --times 0.5,1.5 --outdir out/review/sheets/monsters
import { PAL, rgba, mixHex } from '../core/paper.js';
import { TAU, clamp } from '../core/util.js';
import { field } from '../core/particles.js';
import { sheetBg, label, ground } from './horse.js';
import { drawSlime, drawBat, drawBird, drawDove, drawSnail, drawChicken, drawButterfly, drawFirefly, BIRD_FEET } from '../rigs/monsters.js';

const dot = (g, p, c = PAL.red, r = 5) => { g.save(); g.fillStyle = c; g.strokeStyle = PAL.white; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], r, 0, TAU); g.fill(); g.stroke(); g.restore(); };

function pageSlime(g, T, ctx) {
  sheetBg(g, '小怪 monsters · 1/2 史莱姆 · 蝙蝠', 'drawSlime：pop 弹出 5 帧、7 种表情、burst 0→1、hop 循环、detail 0；drawBat：fly 三相位、swoop、hang（宽 80 / 翼展 90，s=1）');
  // 第一排：pop 关键帧 + hop
  const y1 = 300;
  const pops = [0.12, 0.3, 0.45, 0.62, 1];
  ground(g, 70, 1180, y1, 1, { h260: false });
  ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => {
    pops.forEach((p, i) => drawSlime(lg, { x: 140 + i * 200, y: y1, pop: p, t: T, eyes: 'roll' }));
    drawSlime(lg, { x: 1260, y: y1, t: T, hop: true });
    drawSlime(lg, { x: 1420, y: y1, t: T, hop: true, seed: 2, s: 0.6, expr: 'happy' });
    drawSlime(lg, { x: 1560, y: y1, t: T, s: 0.3, detail: 0 });
    drawSlime(lg, { x: 1660, y: y1, t: T, s: 0.3, detail: 0, hop: true, seed: 5 });
    drawSlime(lg, { x: 1780, y: y1, t: T, s: 0.6, silhouette: true });
  });
  ground(g, 1190, 1860, y1, 1, { h260: false });
  pops.forEach((p, i) => label(g, `pop ${p}`, 140 + i * 200, y1 + 28, 20, { fill: PAL.ink }));
  label(g, 'hop', 1260, y1 + 28, 20, { fill: PAL.ink });
  label(g, 's 0.6 / 0.3 detail 0 / 剪影', 1600, y1 + 28, 18, { fill: PAL.ink });
  // 第二排：表情
  const y2 = 520;
  const ex = ['normal', 'roll', 'angry', 'happy', 'scared', 'dizzy', 'x'];
  ground(g, 70, 1860, y2, 1, { h260: false });
  ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => ex.forEach((e, i) => drawSlime(lg, { x: 160 + i * 250, y: y2, s: 1.3, t: T, expr: e })));
  ex.forEach((e, i) => label(g, e, 160 + i * 250, y2 + 28, 20, { fill: PAL.ink }));
  // 第三排：炸开
  const y3 = 790;
  const bs = [0, 0.06, 0.2, 0.35, 0.5, 0.75, 1];
  ground(g, 70, 1180, y3, 1, { h260: false });
  ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg) => bs.forEach((b, i) => drawSlime(lg, { x: 140 + i * 160, y: y3, burst: b, t: T })));
  bs.forEach((b, i) => label(g, `burst ${b}`, 140 + i * 160, y3 + 28, 18, { fill: PAL.ink }));
  // 蝙蝠
  const bats = [[{ pose: 'fly', flap: 0 }, 'fly 0'], [{ pose: 'fly', flap: 0.25 }, 'fly 0.25'], [{ pose: 'fly', flap: 0.6 }, 'fly 0.6'], [{ pose: 'swoop' }, 'swoop'], [{ pose: 'hang' }, 'hang'], [{ pose: 'fly' }, 'fly（t）']];
  ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => bats.forEach(([oo], i) => drawBat(lg, { x: 1290 + (i % 3) * 200, y: 650 + Math.floor(i / 3) * 210, s: 1.6, t: T, ...oo })));
  bats.forEach(([, n], i) => label(g, n, 1290 + (i % 3) * 200, 650 + Math.floor(i / 3) * 210 + 80, 18, { fill: PAL.ink }));
}

function pageBirds(g, T, ctx) {
  sheetBg(g, '小动物 monsters · 2/2 鸟 · 纸鸽 · 蜗牛 · 鸡 · 蝴蝶 · 萤火', 'drawBird blue（落脚点锚）/ paper（挂线）；drawDove carry：红点 = 返回的 beak 锚点 = 横幅端点；drawSnail crawl + crown；drawChicken；drawButterfly；drawFirefly');
  // 青鸟：落在一根横杆上（落脚点 = 杆顶）
  const yb = 250;
  g.save(); g.strokeStyle = PAL.woodDark; g.lineWidth = 5; g.beginPath(); g.moveTo(70, yb); g.lineTo(560, yb); g.stroke(); g.restore();
  const blue = [[{ pose: 'perch' }, 'perch'], [{ pose: 'land', flap: 0.2 }, 'land'], [{ pose: 'startle', flap: 0.1 }, 'startle']];
  ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg) => {
    blue.forEach(([oo], i) => drawBird(lg, { kind: 'blue', x: 140 + i * 170, y: yb, s: 1.8, t: T, ...oo }));
    [0, 0.25, 0.55].forEach((f, i) => drawBird(lg, { kind: 'blue', x: 680 + i * 140, y: yb - 10, s: 1.6, pose: 'fly', flap: f, t: T }));
  });
  blue.forEach(([, n], i) => label(g, n, 140 + i * 170, yb + 26, 18, { fill: PAL.ink }));
  [0, 0.25, 0.55].forEach((f, i) => label(g, `fly ${f}`, 680 + i * 140, yb + 26, 18, { fill: PAL.ink }));
  // 纸鸟（挂线）
  ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => {
    [0, 0.25, 0.6].forEach((f, i) => drawBird(lg, { kind: 'paper', x: 1180 + i * 200, y: 230, s: 1.6, flap: f, t: T, thread: 120, seed: i }));
    drawBird(lg, { kind: 'paper', x: 1780, y: 230, s: 1.6, t: T, thread: 120, seed: 4 });
  });
  [0, 0.25, 0.6].forEach((f, i) => label(g, `paper flap ${f}`, 1180 + i * 200, 300, 18, { fill: PAL.ink }));
  label(g, 'paper（t 摆动）', 1780, 300, 18, { fill: PAL.ink });
  // 纸鸽：三相位 + 叼横幅
  const yd = 470;
  ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
    [0, 0.25, 0.55].forEach((f, i) => drawDove(lg, { x: 150 + i * 220, y: yd, s: 1.3, flap: f, t: T }));
  });
  [0, 0.25, 0.55].forEach((f, i) => label(g, `dove flap ${f}`, 150 + i * 220, yd + 70, 18, { fill: PAL.ink }));
  // 叼横幅：先求喙锚点，再从锚点往左画横幅，最后画鸽子（压在横幅端上）
  const dx = 1500, dy = 450 + Math.sin(T * 2) * 10;
  ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
    lg.save(); lg.globalAlpha = 0; const a = drawDove(lg, { x: dx, y: dy, s: 1.3, t: T, carry: true }); lg.restore();
    const b = a.beak;
    // 横幅：从喙往左拖成一条带波浪的纸带
    // 横幅：端头收成一个角捏在喙里，往左拖成一条带波浪的纸带
    const pts = [];
    for (let i = 0; i <= 24; i++) { const x = b[0] - 30 - i * 26; pts.push([x, b[1] + 16 + i * 1.2 + Math.sin(i * 0.6 - T * 6) * 6 * Math.min(1, i / 4)]); }
    lg.save();
    lg.beginPath(); lg.moveTo(b[0], b[1]);
    for (const p of pts) lg.lineTo(p[0], p[1] - 20);
    for (let i = pts.length - 1; i >= 0; i--) lg.lineTo(pts[i][0], pts[i][1] + 22);
    lg.closePath();
    lg.fillStyle = PAL.skyDayLow; lg.fill(); lg.lineWidth = 3; lg.strokeStyle = PAL.gold; lg.stroke();
    lg.restore();
    drawDove(lg, { x: dx, y: dy, s: 1.3, t: T, carry: true });
    dot(lg, b, PAL.red, 4);
  });
  label(g, 'carry：横幅端点 = beak 锚点（红点）', 1420, 560, 20, { fill: PAL.ink });
  // 蜗牛（经验条）
  const ys = 720;
  g.save(); g.fillStyle = PAL.paper2; g.strokeStyle = PAL.inkSoft; g.lineWidth = 3;
  g.beginPath(); g.roundRect(70, ys, 900, 26, 13); g.fill(); g.stroke();
  g.fillStyle = PAL.gold; g.beginPath(); g.roundRect(73, ys + 3, 420 + 60 * (0.5 - 0.5 * Math.cos(T * 1.2 * TAU)), 20, 10); g.fill();
  g.restore();
  const snails = [[{ crawl: 0 }, 'crawl 0'], [{ crawl: 0.35 }, 'crawl 0.35'], [{ crawl: 0.7 }, 'crawl 0.7'], [{ crown: true }, 'crown（LV4）'], [{ expr: 'effort' }, 'effort']];
  ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg) => snails.forEach(([oo], i) => drawSnail(lg, { x: 140 + i * 190, y: ys, s: 1.5, t: T, ...oo })));
  snails.forEach(([, n], i) => label(g, n, 140 + i * 190, ys + 50, 18, { fill: PAL.ink }));
  // 鸡
  const yc = 1000;
  ground(g, 1000, 1860, yc, 1, { h260: false });
  const chick = [[{ pose: 'walk', phase: 0 }, 'walk 0'], [{ pose: 'walk', phase: 0.25 }, 'walk 0.25'], [{ pose: 'run' }, 'run'], [{ pose: 'peck' }, 'peck']];
  ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg) => chick.forEach(([oo], i) => drawChicken(lg, { x: 1080 + i * 210, y: yc, s: 1.5, t: T, ...oo })));
  chick.forEach(([, n], i) => label(g, n, 1080 + i * 210, yc + 26, 18, { fill: PAL.ink }));
  // 蝴蝶
  const cols = [PAL.princess, PAL.gold, PAL.crystal, PAL.magic, PAL.heart];
  ctx.layer(g, { shadow: 3, texture: 0.2 }, (lg) => cols.forEach((c, i) => drawButterfly(lg, { x: 1120 + i * 150, y: 760 + Math.sin(T * 3 + i) * 8, s: 1.6, t: T, color: c, flap: i * 0.12 + T * 5, angle: Math.sin(T * 2 + i) * 0.2 })));
  label(g, '纸蝴蝶 5 色', 1420, 830, 18, { fill: PAL.ink });
  // 萤火（夜色小卡片里）
  g.save(); g.fillStyle = PAL.skyNight; g.beginPath(); g.roundRect(70, 820, 900, 210, 18); g.fill(); g.restore();
  field(g, T, { seed: 7, count: 24, x: 80, y: 830, w: 880, h: 190, vx: 10, vy: -26, sway: 18, size: [3, 6] }, (lg, x, y, s) => drawFirefly(lg, x, y, { ...s, age: T + s.r * 5 }));
  drawFirefly(g, 140, 900, 2.2);
  label(g, 'drawFirefly（field 粒子 + 单个 s=2.2）', 520, 1000, 18, { fill: PAL.paper });
}

export default [
  { id: 'sheet_monsters_slime', start: 0, end: 1, draw: (g, T, lt, ctx) => pageSlime(g, T, ctx) },
  { id: 'sheet_monsters_birds', start: 1, end: 2, draw: (g, T, lt, ctx) => pageBirds(g, T, ctx) },
];
