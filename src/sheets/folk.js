// 模型图：群众与孩子（src/rigs/folk.js）。每页一个镜头，时间窗见下（render.mjs --sheet folk）：
//   [0.0,1.2) 市民 12 变体 + 身份叠加 + s=0.30 外景版     [1.2,2.4) 群演动作（含 stepBack / blown 前后对比）
//   [2.4,3.6) 卫兵 / 书记官 / 传令官                       [3.6,4.8) 孩子四阶段 + 高度线 + 动作
//   [4.8,6.0) 表情表                                       [6.0,7.2) 特写细节（CU）+ 剪影 / 木杆 / 挤压
//   [7.2,11.2) 动态：错峰群演链、循环动作、职业动作
//   [11.2,35.2) 动态页的 6 个放大循环（每页 4s，时间从 7.2 重新开始）：zoom0 错峰群演链 [11.2,15.2)、zoom1 口哨 / 光点 / 掉下巴、
//               zoom2 逃跑 / 推车 / 扫地 / 挥手 / 鼓掌、zoom3 舞龙、zoom4 抛帽 / 声波 / 跑 / 写字、zoom5 划叉 / 纸卷塔 / 蹿高 / 拽签
//   [35.2,36.4) 收尾补充：卫兵 / 传令官 raiseHand、pounce、jawDrop，兜帽吹落，V03 一起举手
import { PAL, rr, cut, glow, sparkle } from '../core/paper.js';
import { clamp, lerp, fract, rgba, TAU } from '../core/util.js';
import { outBack, outCubic, inOutSine } from '../core/ease.js';
import { glyphRow } from '../ui/type.js';
import {
  drawCitizen, drawGuard, drawScribe, drawHerald, drawChild, drawFolkHat, drawAppleBasket,
  FOLK_VARIANTS, CITIZEN_POSES, FOLK_EXPRS, folkCrowd, folkStagger, drawCrowd, CHILD_STAGES,
} from '../rigs/folk.js';

const label = (g, text, x, y, size = 20, o = {}) => glyphRow(g, [...text], x, y, size, { family: 'play', fill: PAL.ink, edge: null, align: 'center', ...o });
const title = (g, text, sub) => {
  label(g, text, 96, 58, 34, { align: 'left' });
  if (sub) label(g, sub, 96, 98, 20, { align: 'left', fill: PAL.inkSoft });
};
function hline(g, y, x0, x1, color = PAL.inkSoft, a = 0.45, dash = null, lw = 1.5) {
  g.save(); g.strokeStyle = rgba(color, a); g.lineWidth = lw; if (dash) g.setLineDash(dash);
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.restore();
}
function bg(g, ctx) {
  ctx.fx.vignette = 0.12;
  g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080);
}
/** 一页：先铺纸底 + 标注（g），再把角色包进一个纸片图层（投影 + 纸纹）。 */
const page = (id, start, end, annot, figs, layerO = { shadow: 7, texture: 0.25 }, view = null, remap = null) => ({
  id, start, end,
  draw(g, T0, lt, ctx) {
    const T = remap ? remap(T0) : T0;
    bg(g, ctx);
    const cam = (x) => { if (view) { x.translate(960, 540); x.scale(view.z, view.z); x.translate(-view.cx, -view.cy); } };
    g.save(); cam(g); annot(g, T, lt); g.restore();
    ctx.layer(g, layerO, (lg) => { cam(lg); figs(lg, T, lt); });
    if (view) label(g, `放大 ×${view.z}：${view.name}`, 96, 1040, 22, { align: 'left', fill: PAL.inkSoft });
  },
});
function noteIcon(g, x, y, s, a = 1) {
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.scale(s, s);
  g.fillStyle = PAL.ink;
  g.beginPath(); g.ellipse(-4, 6, 6, 4.4, -0.4, 0, TAU); g.fill();
  g.fillRect(0.6, -16, 2.6, 22);
  g.beginPath(); g.moveTo(3.2, -16); g.quadraticCurveTo(12, -12, 10, -2); g.quadraticCurveTo(10, -9, 3.2, -10); g.fill();
  g.restore();
}

// ———————————————————— 第 1 页：12 变体 ————————————————————
const P1 = page('folk_variants', 0, 1.2, (g) => {
  title(g, '群众与孩子 · 市民 12 变体（s = 1）', '5 种粉彩身体色 × 高矮 × 帽型 / 发型；脚底线、150–190 市民身高带与 260 勇者身高线');
  hline(g, 470, 60, 1860, PAL.ink, 0.5);
  hline(g, 210, 60, 1860, PAL.red, 0.55, [10, 8]);
  hline(g, 320, 60, 1860, PAL.inkSoft, 0.3, [4, 8]);
  hline(g, 280, 60, 1860, PAL.inkSoft, 0.3, [4, 8]);
  label(g, '260 勇者', 1862, 200, 16, { align: 'right', fill: PAL.red });
  label(g, '190', 1862, 270, 16, { align: 'right', fill: PAL.inkSoft });
  label(g, '150', 1862, 310, 16, { align: 'right', fill: PAL.inkSoft });
  label(g, '脚底线', 1862, 458, 16, { align: 'right', fill: PAL.inkSoft });
  FOLK_VARIANTS.forEach((v, i) => label(g, `${i} ${v.name}`, 150 + i * 147, 500, 18));
  hline(g, 790, 60, 1860, PAL.ink, 0.35);
  const L2 = ['courtier 褶领', 'courtier', 'villager 草帽', 'villager', 'grandma 头巾拐杖', 'grandma', 'face -1', 'face -1', 'face -1'];
  L2.forEach((t, i) => label(g, t, 170 + i * 198, 820, 18));
  hline(g, 1010, 60, 1860, PAL.ink, 0.35);
  label(g, 's = 0.30 外景 · detail 0（远景简化）', 380, 890, 18);
  label(g, 's = 0.30 · detail 1', 1010, 890, 18);
  label(g, '卫兵 书记官 传令官 孩子 ×4', 1600, 890, 18);
}, (lg, T) => {
  FOLK_VARIANTS.forEach((v, i) => drawCitizen(lg, { x: 150 + i * 147, y: 470, t: T, variant: i }));
  const row2 = [{ variant: 0, courtier: true }, { variant: 6, courtier: true, pose: 'clap' }, { variant: 2, villager: true }, { variant: 7, villager: true, pose: 'wave' }, { variant: 3, grandma: true }, { variant: 9, grandma: true, pose: 'hugPot' }, { variant: 1, face: -1 }, { variant: 4, face: -1, pose: 'turnHead' }, { variant: 8, face: -1, pose: 'cheer' }];
  row2.forEach((o, i) => drawCitizen(lg, { x: 170 + i * 198, y: 790, t: T, ...o }));
  for (let i = 0; i < 12; i++) drawCitizen(lg, { x: 130 + i * 46, y: 1010, s: 0.3, t: T, variant: i, detail: 0, pose: i % 3 === 1 ? 'wave' : 'idle' });
  for (let i = 0; i < 12; i++) drawCitizen(lg, { x: 760 + i * 46, y: 1010, s: 0.3, t: T, variant: i, pose: i % 3 === 1 ? 'wave' : 'idle' });
  drawGuard(lg, { x: 1400, y: 1010, s: 0.3, t: T, detail: 0 });
  drawScribe(lg, { x: 1450, y: 1010, s: 0.3, t: T, detail: 0 });
  drawHerald(lg, { x: 1500, y: 1010, s: 0.3, t: T, detail: 0, pose: 'blow' });
  ['baby', 'toddler', 'kid', 'older'].forEach((st, i) => drawChild(lg, { x: 1560 + i * 40, y: 1010, s: 0.3, t: T, stage: st, detail: 0 }));
  drawGuard(lg, { x: 1730, y: 1010, s: 0.3, t: T });
  drawHerald(lg, { x: 1790, y: 1010, s: 0.3, t: T });
});

// ———————————————————— 第 2 页：群演动作 ————————————————————
const POSE_SLOTS = [
  ...CITIZEN_POSES.map((p) => ({ pose: p })),
  { pair: 'stepBack' }, { pair: 'blown' },
];
const P2 = page('folk_poses', 1.2, 2.4, (g) => {
  title(g, '群演动作（s = 0.72，同一函数 + 不同 variant / 相位批量调用）', 'flee 朝左逃并掉苹果篮；blown 帽子吹飞；hideBarrel 躲桶；最后两格是 stepBack / blown 的前后对比');
  for (let r = 0; r < 3; r++) hline(g, 330 + r * 310, 60, 1860, PAL.ink, 0.35);
  POSE_SLOTS.forEach((sl, k) => {
    const c = k % 7, r = Math.floor(k / 7);
    const x = 219 + c * 247, y = 330 + r * 310;
    label(g, sl.pair ? `${sl.pair} 前后对比` : sl.pose, x, y + 28, 19);
    if (sl.pair) { g.save(); g.strokeStyle = rgba(PAL.inkSoft, 0.7); g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 12, y - 70); g.lineTo(x + 10, y - 70); g.moveTo(x + 3, y - 77); g.lineTo(x + 10, y - 70); g.lineTo(x + 3, y - 63); g.stroke(); g.restore(); }
  });
}, (lg, T) => {
  POSE_SLOTS.forEach((sl, k) => {
    const c = k % 7, r = Math.floor(k / 7);
    const x = 219 + c * 247, y = 330 + r * 310;
    const v = (k * 5) % 12;
    if (sl.pair) {
      drawCitizen(lg, { x: x - 60, y, s: 0.72, t: T, variant: sl.pair === 'blown' ? 6 : 4, pose: 'idle' });
      drawCitizen(lg, { x: x + 62, y, s: 0.72, t: T, variant: sl.pair === 'blown' ? 6 : 4, pose: sl.pair, hatFly: sl.pair === 'blown' ? 0.22 : undefined });
      return;
    }
    const o = { x, y, s: 0.72, t: T, variant: v, pose: sl.pose };
    if (sl.pose === 'flee') Object.assign(o, { face: -1, dropItem: 0.42, variant: 1 });
    if (sl.pose === 'blown') Object.assign(o, { hatFly: 0.3, variant: 0 });
    if (sl.pose === 'hugPot') Object.assign(o, { grandma: true, variant: 3 });
    if (sl.pose === 'hideBarrel') Object.assign(o, { peek: 1, variant: 11 });
    if (sl.pose === 'faintBack') Object.assign(o, { x: x + 50, villager: true, variant: 10 });
    if (sl.pose === 'jawDrop') Object.assign(o, { villager: true, variant: 2 });
    if (sl.pose === 'push') Object.assign(o, { x: x - 40 });
    if (sl.pose === 'pounce') Object.assign(o, { x: x - 30, variant: 7 });
    drawCitizen(lg, o);
  });
});

// ———————————————————— 第 3 页：卫兵 / 书记官 / 传令官 ————————————————————
const GUARD_ROW = [['attention', {}], ['attention 无帽', { hat: false }], ['cheer', { pose: 'cheer' }], ['whistle', { pose: 'whistle' }], ['lean', { pose: 'lean' }], ['stepBack', { pose: 'stepBack' }], ['blown', { pose: 'blown', hatFly: 0.25 }], ['tossHat', { pose: 'tossHat', hatFly: 0.5 }], ['variant 1 / 2', { variant: 1, pair: 2 }]];
const SCRIBE_ROW = [['idle', {}], ['write + desk', { pose: 'write', desk: true }], ['crossOut', { pose: 'crossOut', p: 0.3 }], ['quillSnap', { pose: 'quillSnap', p: 0.45 }], ['run', { pose: 'run' }], ['unrollDecree', { pose: 'unrollDecree' }], ['backAway', { pose: 'backAway' }], ['tower 0', { pose: 'carryTower', tower: 0 }], ['tower 0.5', { pose: 'carryTower', tower: 0.5 }], ['tower 1', { pose: 'carryTower', tower: 1 }], ['deflate', { pose: 'deflate' }]];
const HERALD_ROW = [['idle', {}], ['slapNotice', { pose: 'slapNotice', p: 0.62 }], ['blow', { pose: 'blow' }], ['bentHorn', { pose: 'bentHorn' }], ['jawDrop', { pose: 'jawDrop' }], ['unrollScroll', { pose: 'unrollScroll', scrollLen: 92 }], ['kneel', { pose: 'kneel' }], ['run', { pose: 'run' }], ['pant', { pose: 'pant' }]];
const rowX = (n, i) => 96 + (1728 / n) * (i + 0.5);
const P3 = page('folk_staff', 2.4, 3.6, (g) => {
  title(g, '卫兵 / 书记官 / 传令官（s = 0.72）', '卫兵有帽 / 无帽、吹口哨返回音符发射点；书记官纸卷塔 tower 0 / 0.5 / 1；传令官 blow 返回号口 bell');
  for (let r = 0; r < 3; r++) hline(g, 330 + r * 310, 60, 1860, PAL.ink, 0.35);
  GUARD_ROW.forEach(([t], i) => label(g, t, rowX(GUARD_ROW.length, i), 358, 18));
  SCRIBE_ROW.forEach(([t], i) => label(g, t, rowX(SCRIBE_ROW.length, i), 668, 18));
  HERALD_ROW.forEach(([t], i) => label(g, t, rowX(HERALD_ROW.length, i), 978, 18));
}, (lg, T) => {
  GUARD_ROW.forEach(([, o], i) => {
    const x = rowX(GUARD_ROW.length, i);
    if (o.pair) { drawGuard(lg, { x: x - 34, y: 330, s: 0.72, t: T, variant: 1 }); drawGuard(lg, { x: x + 38, y: 330, s: 0.72, t: T, variant: 2, hat: false }); return; }
    const a = drawGuard(lg, { x, y: 330, s: 0.72, t: T, ...o });
    if (o.pose === 'whistle') for (let k = 0; k < 2; k++) noteIcon(lg, a.note[0] + 16 + k * 20, a.note[1] - 22 - k * 24, 0.9);
  });
  SCRIBE_ROW.forEach(([, o], i) => drawScribe(lg, { x: rowX(SCRIBE_ROW.length, i) - (o.desk ? 26 : 0), y: 640, s: 0.72, t: T, ...o }));
  HERALD_ROW.forEach(([, o], i) => {
    const a = drawHerald(lg, { x: rowX(HERALD_ROW.length, i) - (o.pose === 'blow' ? 20 : 0), y: 950, s: 0.72, t: T, ...o });
    if (o.pose === 'blow') for (let k = 0; k < 3; k++) { lg.save(); lg.strokeStyle = rgba(PAL.inkSoft, 0.7 - k * 0.15); lg.lineWidth = 2.4; lg.beginPath(); lg.arc(a.bell[0], a.bell[1], 12 + k * 11, a.bellDir - 0.6, a.bellDir + 0.6); lg.stroke(); lg.restore(); }
  });
});

// ———————————————————— 第 4 页：孩子 ————————————————————
const CH_POSES = [['baby popUp', { stage: 'baby', pose: 'popUp' }], ['baby giggle', { stage: 'baby', pose: 'giggle' }], ['baby grabScarf', { stage: 'baby', pose: 'grabScarf' }], ['toddler stand', { stage: 'toddler' }], ['kid hop', { stage: 'kid', pose: 'hop', p: 0.5 }], ['older frown', { stage: 'older', pose: 'frown' }], ['older yank', { stage: 'older', pose: 'yank', p: 0.75 }], ['older laugh + 短围巾', { stage: 'older', pose: 'laugh', shortScarf: true }], ['older 无王冠', { stage: 'older', crown: false }]];
const P4 = page('folk_child', 3.6, 4.8, (g) => {
  title(g, '孩子 王浩然 · 四阶段（s = 1）', '婴儿 70（襁褓）/ 学步 110 / 幼童 160 / 少年 200；呆毛随阶段变长变卷、带一缕金；小王冠；O06 起短红围巾');
  const fy = 560;
  hline(g, fy, 60, 860, PAL.ink, 0.5);
  [[70, '70 婴儿'], [110, '110 学步'], [160, '160 幼童'], [200, '200 少年'], [260, '260 勇者']].forEach(([h, t], i) => {
    hline(g, fy - h, 60, 860, i === 4 ? PAL.red : PAL.inkSoft, i === 4 ? 0.5 : 0.4, [6, 7]);
    label(g, t, 70, fy - h - 12, 16, { align: 'left', fill: i === 4 ? PAL.red : PAL.inkSoft });
  });
  ['baby', 'toddler', 'kid', 'older'].forEach((st, i) => label(g, st, 330 + i * 150, fy + 28, 18));
  hline(g, 950, 60, 1860, PAL.ink, 0.35);
  CH_POSES.forEach(([t], i) => label(g, t, rowX(CH_POSES.length, i), 978, 18));
  label(g, '特写（s = 2）', 1380, 150, 20);
}, (lg, T) => {
  ['baby', 'toddler', 'kid', 'older'].forEach((st, i) => drawChild(lg, { x: 330 + i * 150, y: 560, t: T, stage: st, shortScarf: st === 'older' }));
  drawChild(lg, { x: 1130, y: 640, s: 2.0, t: T, stage: 'baby', pose: 'giggle' });
  drawChild(lg, { x: 1420, y: 640, s: 2.0, t: T, stage: 'kid', shortScarf: true, pose: 'laugh' });
  drawChild(lg, { x: 1720, y: 640, s: 1.6, t: T, stage: 'older', shortScarf: true });
  CH_POSES.forEach(([, o], i) => drawChild(lg, { x: rowX(CH_POSES.length, i), y: 950, s: 0.9, t: T, ...o }));
});

// ———————————————————— 第 5 页：表情 ————————————————————
const EXPRS = Object.keys(FOLK_EXPRS);
const P5 = page('folk_exprs', 4.8, 6.0, (g) => {
  title(g, '表情表（所有木偶共用 FOLK_EXPRS；统一脸部画法）', 'ink 竖椭圆眼 + 左上白高光、blush 腮红 α≈0.45、ink 弧线嘴（张嘴 redDeep + heart 舌）、ink 短弧眉、skinShade 鼻点');
  EXPRS.forEach((e, k) => { const c = k % 8, r = Math.floor(k / 8); label(g, e, 96 + 216 * (c + 0.5), 300 + r * 230, 19); });
}, (lg, T) => {
  EXPRS.forEach((e, k) => {
    const c = k % 8, r = Math.floor(k / 8);
    const x = 96 + 216 * (c + 0.5), y = 280 + r * 230;
    const v = (k * 7) % 12, H = FOLK_VARIANTS[v].H, hr = 32 + (H - 150) * 0.09, s = 1.6;
    lg.save();
    lg.beginPath(); lg.rect(x - 105, y - 190, 210, 176); lg.clip();
    drawCitizen(lg, { x, y: y - 92 + s * (H - hr), s, t: 0.3, variant: v, expr: e, pose: e === 'jawdrop' ? 'jawDrop' : 'idle', sweat: e === 'scared' || e === 'strain' ? 1 : undefined, noBlink: true, jitter: 0 });
    lg.restore();
  });
});

// ———————————————————— 第 6 页：特写细节 + 模式 ————————————————————
const P6 = page('folk_cu', 6.0, 7.2, (g) => {
  title(g, '特写细节（s = 3.4，头约 220–240px）+ 剪影 / 木杆 / 挤压 / 飞帽', '纸边稳定、错位分层与切口亮边在大尺寸下不糊');
  label(g, 'silhouette（keepColor：hat / scarf）', 1440, 630, 18);
  label(g, 'rod 纸剧场木杆', 1500, 1010, 18);
  label(g, 'squash -0.25 / 0 / +0.25', 1150, 1010, 18);
  label(g, 'drawFolkHat 单独的帽子（飞帽 / 抛帽）', 1500, 150, 18);
}, (lg, T) => {
  lg.save(); lg.beginPath(); lg.rect(60, 120, 1000, 900); lg.clip();
  drawCitizen(lg, { x: 300, y: 560 + 3.4 * (156 - 32.5), s: 3.4, t: T, variant: 9, expr: 'happy' });
  drawGuard(lg, { x: 800, y: 600 + 3.4 * 124, s: 3.4, t: T, pose: 'attention', expr: 'normal' });
  lg.restore();
  drawCitizen(lg, { x: 1260, y: 600, t: T, variant: 4, silhouette: true, keepColor: ['hat'] });
  drawCitizen(lg, { x: 1440, y: 600, t: T, variant: 0, silhouette: true, keepColor: ['hat'], pose: 'cheer' });
  drawChild(lg, { x: 1620, y: 600, t: T, stage: 'kid', silhouette: true, keepColor: ['scarf'], shortScarf: true });
  [-0.25, 0, 0.25].forEach((q, i) => drawCitizen(lg, { x: 1060 + i * 95, y: 980, s: 0.85, t: T, variant: 5, squash: q }));
  lg.save(); lg.beginPath(); lg.rect(1360, 650, 400, 330); lg.clip();
  drawCitizen(lg, { x: 1440, y: 900, s: 0.85, t: T, variant: 6, rod: true, pose: 'wave' });
  drawHerald(lg, { x: 1620, y: 900, s: 0.85, t: T, rod: true });
  lg.restore();
  ['beret', 'bonnet', 'cap', 'tall', 'kerchief', 'toque', 'straw', 'busby'].forEach((ty, i) => drawFolkHat(lg, { type: ty, x: 1180 + (i % 4) * 160, y: 230 + Math.floor(i / 4) * 130, s: 0.95, rot: Math.sin(T * 2 + i) * 0.2, t: T, colors: ty === 'busby' ? { main: PAL.ink, plume: PAL.ermine } : ty === 'tall' ? { main: PAL.inkSoft } : ty === 'kerchief' ? { main: PAL.fire } : ty === 'straw' ? { main: PAL.sand } : ty === 'cap' ? { main: PAL.wood } : ty === 'toque' ? { main: PAL.white } : ty === 'bonnet' ? { main: PAL.paper, second: PAL.princessDark } : {} }));
});

// ———————————————————— 第 7 页：动态 ————————————————————
const D0 = 7.2;
/** 广场群演链：idle → lean（40ms 错峰）→ stepBack（45ms）→ turnHead（50ms）→ blown（50ms，帽子挨个飞）→ cheer。
 *  连续性要点：① stepBack 退的那一步（dx −16）之后一直保持（告示前空出半圆），turnHead 段用 joints 补偿插值、
 *  之后各段叠同一个 BACK；② hatFly 从 blown 起一路传到 cheer，飞走的帽子不会回到头上。 */
const BACK = { dx: -16 };
function plazaPose(u, i) {
  const st = (t0, step, dur, ease = outCubic) => folkStagger(u, t0, i, { step, dur, ease, jitter: 0.012, seed: 3 });
  const kLean = st(0.4, 0.04, 0.3), kBack = st(1.0, 0.045, 0.22, (x) => outBack(x, 1.4)), kTurn = st(1.7, 0.05, 0.25), kBlow = st(2.3, 0.05, 0.2), kCheer = st(3.3, 0.03, 0.25);
  const hatFly = clamp((u - 2.3 - i * 0.05) / 0.9);
  if (kCheer > 0) return { pose: { from: 'blown', to: 'cheer', k: kCheer }, hatFly, joints: BACK };
  if (kBlow > 0) return { pose: { from: 'turnHead', to: 'blown', k: kBlow }, hatFly, joints: BACK };
  if (kTurn > 0) return { pose: { from: 'stepBack', to: 'turnHead', k: kTurn }, joints: { dx: -16 * kTurn } };
  if (kBack > 0) return { pose: { from: 'lean', to: 'stepBack', k: kBack } };
  return { pose: { from: 'idle', to: 'lean', k: kLean } };
}
const motionAnnot = (g, T) => {
  const u = T - D0;
  title(g, `动态（${u.toFixed(1)}s）：错峰群演链 / 循环动作 / 职业动作`, '同一 pose 不同 variant / 相位：folkCrowd + folkStagger + drawCrowd；舞龙横幅按相位传正弦波');
  for (let r = 0; r < 3; r++) hline(g, 330 + r * 310, 60, 1860, PAL.ink, 0.35);
  label(g, '广场：lean / stepBack / turnHead / blown（帽子挨个飞）/ cheer', 560, 358, 18);
  label(g, 'whistle + 音符', 1300, 358, 18);
  label(g, 'raiseHand 光点', 1580, 358, 18);
  label(g, 'flee + 掉篮', 190, 668, 18);
  label(g, 'push', 440, 668, 18);
  label(g, 'sweep', 600, 668, 18);
  label(g, 'wave / clap', 770, 668, 18);
  label(g, 'carryOverhead 舞龙（相位错开）', 1400, 668, 18);
  ['tossHat', 'blow 声波', 'run', 'write', 'crossOut', 'carryTower', 'hop', 'yank'].forEach((t, i) => label(g, t, rowX(8, i), 978, 18));
};
const motionFigs = (lg, T) => {
  const u = T - D0;
  // 第 1 行：错峰群演
  const crowd = folkCrowd(7, { x0: 150, x1: 980, y: 330, s: 0.8, seed: 4 });
  drawCrowd(lg, crowd, { t: T, each: (m) => plazaPose(u, m.i) });
  const ga = drawGuard(lg, { x: 1300, y: 330, s: 0.8, t: T, pose: 'whistle' });
  for (let k = 0; k < 3; k++) { const q = fract(u * 0.7 + k / 3); noteIcon(lg, ga.note[0] + 14 + q * 50 + Math.sin(q * 9 + k) * 6, ga.note[1] - 10 - q * 90, 0.9, Math.sin(Math.PI * q)); }
  const ra = drawCitizen(lg, { x: 1580, y: 330, s: 0.8, t: T, variant: 9, pose: 'raiseHand' });
  const q = fract(u / 1.6);
  const lp = [ra.hand[0] + Math.sin(q * 6) * 6, ra.hand[1] - 12 - q * 120];
  glow(lg, lp[0], lp[1], 26, PAL.goldLight, 0.9 * Math.sin(Math.PI * q));
  sparkle(lg, lp[0], lp[1], 11, { color: PAL.goldLight, rot: u, alpha: Math.sin(Math.PI * q) });
  drawCitizen(lg, { x: 1760, y: 330, s: 0.8, t: T, variant: 2, villager: true, pose: { from: 'idle', to: 'jawDrop', k: clamp(Math.sin(u * 2.2) * 1.5) } });
  // 第 2 行：循环
  const dp = fract(u / 2);
  drawCitizen(lg, { x: 220, y: 640, s: 0.8, t: T, variant: 1, face: -1, pose: 'flee', dropItem: dp });
  drawCitizen(lg, { x: 120, y: 640, s: 0.8, t: T, variant: 10, face: -1, pose: 'flee', phase: 0.4 });
  drawCitizen(lg, { x: 400, y: 640, s: 0.8, t: T, variant: 2, pose: 'push' });
  drawCitizen(lg, { x: 600, y: 640, s: 0.8, t: T, variant: 4, pose: 'sweep' });
  drawCitizen(lg, { x: 720, y: 640, s: 0.8, t: T, variant: 5, pose: 'wave' });
  drawCitizen(lg, { x: 830, y: 640, s: 0.8, t: T, variant: 6, pose: 'clap', courtier: true });
  const dance = folkCrowd(6, { x0: 1010, x1: 1780, y: 640, s: 0.8, seed: 9, start: 3 });
  const hands = drawCrowd(lg, dance, { t: T, pose: 'carryOverhead', each: (m) => ({ phase: -m.i * 0.13 }) });
  const pts = hands.map((a) => a.carry).sort((a, b) => a[0] - b[0]);
  const band = [[pts[0][0] - 50, pts[0][1] + 6], ...pts, [pts[pts.length - 1][0] + 50, pts[pts.length - 1][1] + 6]];
  lg.save();
  lg.lineCap = 'round'; lg.lineJoin = 'round';
  const path = new Path2D(); band.forEach((p, i) => (i ? path.lineTo(p[0], p[1] - 14) : path.moveTo(p[0], p[1] - 14)));
  lg.strokeStyle = PAL.redDark; lg.lineWidth = 34; lg.stroke(path);
  lg.strokeStyle = PAL.red; lg.lineWidth = 28; lg.stroke(path);
  lg.strokeStyle = PAL.gold; lg.lineWidth = 2.5; lg.setLineDash([2, 12]); lg.stroke(path);
  lg.restore();
  // 第 3 行：职业动作
  const tq = fract(u / 1.4);
  drawGuard(lg, { x: rowX(8, 0), y: 950, s: 0.72, t: T, pose: 'tossHat', hatFly: tq > 0.02 && tq < 0.98 ? tq : undefined });
  const ha = drawHerald(lg, { x: rowX(8, 1) - 24, y: 950, s: 0.72, t: T, pose: 'blow' });
  for (let k = 0; k < 3; k++) { const w = fract(u * 1.6 + k / 3); lg.save(); lg.strokeStyle = rgba(PAL.inkSoft, 0.8 * (1 - w)); lg.lineWidth = 2.5; lg.beginPath(); lg.arc(ha.bell[0], ha.bell[1], 8 + w * 60, ha.bellDir - 0.55, ha.bellDir + 0.55); lg.stroke(); lg.restore(); }
  drawHerald(lg, { x: rowX(8, 2), y: 950, s: 0.72, t: T, pose: 'run' });
  drawScribe(lg, { x: rowX(8, 3) - 26, y: 950, s: 0.72, t: T, pose: 'write', desk: true });
  const cp = fract(u / 2.0);
  const trail = [];
  for (let k = 0; k <= 24; k++) { const pk = (k / 24) * cp; const a = drawScribe(lg, { x: rowX(8, 4) - 20, y: 950, s: 0.72, t: T, pose: 'crossOut', p: pk, alpha: 0 }); trail.push([pk, a.quill]); }
  drawScribe(lg, { x: rowX(8, 4) - 20, y: 950, s: 0.72, t: T, pose: 'crossOut', p: cp });
  lg.save(); lg.strokeStyle = PAL.ink; lg.lineWidth = 3; lg.lineCap = 'round';
  lg.beginPath(); trail.forEach(([pk, q2], k) => { if (pk > 0.45 && pk < 0.55) return; (k && !(trail[k - 1][0] > 0.45 && trail[k - 1][0] < 0.55) ? lg.lineTo(q2[0], q2[1]) : lg.moveTo(q2[0], q2[1])); }); lg.stroke(); lg.restore();
  drawScribe(lg, { x: rowX(8, 5), y: 950, s: 0.72, t: T, pose: 'carryTower', tower: clamp(Math.sin(u * 1.2) * 0.75 + 0.3) });
  drawChild(lg, { x: rowX(8, 6), y: 950, s: 0.9, t: T, stage: 'kid', pose: 'hop', p: fract(u / 1.2) });
  drawChild(lg, { x: rowX(8, 7), y: 950, s: 0.9, t: T, stage: 'older', pose: 'yank', p: fract(u / 1.6), shortScarf: true });
};
const P7 = page('folk_motion', D0, D0 + 4, motionAnnot, motionFigs);
// 放大的循环检查页（同一套动作，时间从 D0 重新开始）：6 页，每页 4s，[11.2,35.2)；顺序同 ZOOMS（第 1 行左 / 右，第 2 行左 / 右，第 3 行左 / 右）
const ZOOMS = [
  { cx: 565, cy: 235, z: 1.85, name: '错峰群演链（lean / stepBack / turnHead / blown / cheer）' },
  { cx: 1530, cy: 235, z: 1.85, name: '口哨音符 / 举手光点 / 掉下巴' },
  { cx: 470, cy: 545, z: 2.0, name: '逃跑掉篮 / 推车 / 扫地 / 挥手 / 鼓掌' },
  { cx: 1400, cy: 530, z: 1.9, name: '舞龙：竿顶 carry 锚点连成横幅，相位错开' },
  { cx: 560, cy: 850, z: 2.0, name: '抛帽 / 吹号声波 / 跑 / 写字' },
  { cx: 1430, cy: 850, z: 2.0, name: '划叉（quill 锚点画墨迹）/ 纸卷塔 / 蹿高 / 拽签' },
];
const PZ = ZOOMS.map((v, k) => page(`folk_motion_zoom${k}`, D0 + 4 + k * 4, D0 + 8 + k * 4, motionAnnot, motionFigs, { shadow: 7, texture: 0.25 }, v, (T) => D0 + ((T - D0 - 4) % 4)));

// ———————————————————— 第 8 页：收尾补充（storyboard 用到、assets.md 未列的姿态）————————————————————
const D8 = D0 + 4 + ZOOMS.length * 4;
const EXTRA = [
  ['卫兵 raiseHand', { kind: 'guard', pose: 'raiseHand' }],
  ['卫兵 pounce', { kind: 'guard', pose: 'pounce' }],
  ['卫兵 jawDrop', { kind: 'guard', pose: 'jawDrop' }],
  ['书记官 pounce', { kind: 'scribe', pose: 'pounce' }],
  ['书记官 jawDrop', { kind: 'scribe', pose: 'jawDrop' }],
  ['传令官 raiseHand', { kind: 'herald', pose: 'raiseHand' }],
  ['传令官 pounce', { kind: 'herald', pose: 'pounce' }],
  ['兜帽 hatFly 0.3', { variant: 4, pose: 'blown', hatFly: 0.3 }],
  ['hideBarrel peek 0.3', { variant: 11, pose: 'hideBarrel', peek: 0.3 }],
];
/** b07 V03：市民 + 卫兵 + 传令官错峰 50ms 一起举手，hand 锚点升起光点。 */
const V03 = [
  ...folkCrowd(6, { x0: 180, x1: 1060, y: 640, s: 0.8, seed: 5 }),
  { i: 6, kind: 'guard', x: 1230, y: 640, s: 0.8 },
  { i: 7, kind: 'herald', x: 1380, y: 628, s: 0.8 },
  { i: 8, kind: 'guard', x: 1540, y: 652, s: 0.8, variant: 2 },
];
const P8 = page('folk_extra', D8, D8 + 1.2, (g, T) => {
  title(g, '收尾补充：分镜用到的姿态（s = 0.72）+ V03 一起举手', 'raiseHand（卫兵 / 传令官）、pounce（卫兵 / 书记官 / 传令官，b06 捂嘴）、jawDrop（卫兵 / 书记官，b17）；兜帽被吹落到脖子后');
  hline(g, 330, 60, 1860, PAL.ink, 0.35);
  EXTRA.forEach(([t], i) => label(g, t, rowX(EXTRA.length, i), 358, 18));
  hline(g, 640, 60, 1860, PAL.ink, 0.35);
  label(g, `V03：drawCrowd 混编 kind + folkStagger 50ms + hand 锚点光点（${(T - D8).toFixed(2)}s）`, 860, 668, 18);
}, (lg, T) => {
  EXTRA.forEach(([, o], i) => {
    const x = rowX(EXTRA.length, i) - (o.pose === 'pounce' ? 30 : 0);
    drawCrowd(lg, [{ i: 0, x, y: 330, s: 0.72, ...o }], { t: T });
  });
  const u = T - D8;
  const hands = drawCrowd(lg, V03, {
    t: T,
    each: (m) => ({ pose: { from: m.kind === 'guard' ? 'attention' : 'idle', to: 'raiseHand', k: folkStagger(u, 0.05, m.i, { step: 0.05, dur: 0.3 }) } }),
  });
  hands.forEach((a, i) => {
    const q = clamp((u - 0.4 - i * 0.06) / 0.7);
    if (q <= 0) return;
    const al = Math.sin(Math.PI * Math.min(1, q * 1.15));
    const p = [a.hand[0] + Math.sin(q * 5 + i) * 5, a.hand[1] - 12 - q * 110];
    glow(lg, p[0], p[1], 22, i % 2 ? PAL.heart : PAL.goldLight, 0.85 * al);
    sparkle(lg, p[0], p[1], 10, { color: i % 2 ? PAL.heart : PAL.goldLight, rot: u + i, alpha: al });
  });
});

export default [P1, P2, P3, P4, P5, P6, P7, ...PZ, P8];
