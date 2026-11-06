// 模型图：勇者全部动作（站立 / 表演 / 战斗 / 尾声 / 躲闪）。0–2s 第 1 页、2–4s 第 2 页、4–6s 细节、6–8s 躲闪。骑乘见 hero_ride，纸偶见 hero_puppet，循环动作见 hero_anim。
import { PAL } from '../core/paper.js';
import { drawHero } from '../rigs/hero.js';
import { sheetBg, label, guide } from './hero.js';

const A = [
  ['idle'], ['walk'], ['run', { scarf: { vel: [420, 0] } }], ['kneeSlide', { scarf: { vel: [380, 0] } }], ['brake'], ['heroPose'], ['scratchHead'],
  ['think'], ['inhale', { inflate: 1 }], ['shout'], ['proud'], ['thumbsUp'], ['cupEar', { earScale: 1.3 }], ['fingerUp', { soot: 1, ahoge: 'candle', flame: 1 }],
  ['present'], ['bow'], ['shieldFace'], ['sigh'], ['gulp'], ['turnHead'], ['freeze'],
  ['gripHilt'], ['draw', { act: 1 }], ['stance'], ['roll', { act: 0.25 }], ['plantSword'], ['vault', { act: 0.5 }], ['hop', { act: 0.5 }],
];
const B = [
  ['thrust', { act: 0.4 }], ['slash', { act: 0.0 }], ['slash', { act: 0.38 }], ['slash', { act: 0.62 }], ['hangSwing'], ['kick'], ['charge', { scarf: { vel: [520, 0] } }],
  ['swingMiss', { act: 0.3 }], ['swingMiss', { act: 0.55 }], ['holdHands'], ['dance'], ['dance', { turn: 0.35 }], ['leanOver'], ['unrollScroll'],
  ['tieScarf'], ['deflate'], ['cheer'], ['draw', { act: 0.2 }], ['draw', { act: 0.45 }], ['draw', { act: 0.7 }], ['thrust', { act: 0 }],
  ['hop', { act: 0 }], ['hop', { act: 0.22 }], ['hop', { act: 0.8 }], ['roll', { act: 0.6 }], ['vault', { act: 0.2 }], ['idle→cheer k.5'], ['walk', { face: -1 }],
];

function grid(g, T, ctx, list) {
  const cols = 7, cw = 1920 / cols, rh = 236, top = 150, s = 0.62;
  list.forEach(([name], i) => {
    const cx = cw * (i % cols) + cw / 2, fy = top + rh * Math.floor(i / cols) + 190;
    guide(g, cx, fy, s, cw * 0.42);
    label(g, name, cx, fy + 26, 17, { align: 'center' });
  });
  ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
    list.forEach(([name, o = {}], i) => {
      const cx = cw * (i % cols) + cw / 2, fy = top + rh * Math.floor(i / cols) + 190;
      const air = ['vault', 'hop', 'kick', 'hangSwing', 'roll'].includes(name);
      const pose = name.startsWith('idle→') ? { from: 'idle', to: 'cheer', k: 0.5 } : name;
      drawHero(lg, { x: cx, y: air ? fy - 20 : fy, s, t: T + i * 0.29, pose, ...o, scarf: { len: 150, ground: fy, ...(o.scarf || {}) } });
    });
  });
}

const C = [['idle'], ['gripHilt'], ['think'], ['scratchHead'], ['kneeSlide', { scarf: { vel: [380, 0] } }], ['plantSword'], ['bow']];
function detail(g, T, ctx) {
  const s = 1.45;
  C.forEach(([name], i) => { const x = 140 + i * 274; guide(g, x, 860, s, 120); label(g, name, x, 900, 22, { align: 'center' }); });
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
    C.forEach(([name, o = {}], i) => drawHero(lg, { x: 140 + i * 274, y: 860, s, t: T + i * 0.3, pose: name, ...o, scarf: { len: 200, ground: 860, ...(o.scarf || {}) } }));
  });
}

// 第 4 页：b10 D2a 左躲右闪（110.00 低头 / 110.30 跳起 / 110.60 后仰下腰 / 110.90 侧身 / 111.30 转身）+ b11 低头躲翼
const DODGE = [['duck'], ['hop', { act: 0.5 }], ['limbo'], ['sidestep'], ['dance turn .5', { pose: 'dance', turn: 0.5 }], ['duck face -1', { pose: 'duck', face: -1 }]];
function dodges(g, T, ctx) {
  const s = 1.2;
  DODGE.forEach(([name], i) => { const x = 170 + i * 316; guide(g, x, 820, s, 130); label(g, name, x, 862, 22, { align: 'center' }); });
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
    DODGE.forEach(([name, o = {}], i) => drawHero(lg, { x: 170 + i * 316, y: name === 'hop' ? 760 : 820, s, t: T + i * 0.3, pose: name, ...o, scarf: { len: 220, ground: 820, ...(o.scarf || {}) } }));
  });
}

export default [
  { id: 'sheet_hero_poses_a', start: 0, end: 2, draw(g, T, lt, ctx) { sheetBg(g, 'hero · poses (1/2)', 's=0.62 · act = action progress 0..1'); grid(g, T, ctx, A); } },
  { id: 'sheet_hero_poses_c', start: 4, end: 6, draw(g, T, lt, ctx) { sheetBg(g, 'hero · pose detail (s=1.45)', 'joints, hands, hilt grip, finger on chin, hands-on-grip'); detail(g, T, ctx); } },
  { id: 'sheet_hero_poses_b', start: 2, end: 4, draw(g, T, lt, ctx) { sheetBg(g, 'hero · poses (2/2)', 'action poses at several act values · {from,to,k} interpolation · face=-1'); grid(g, T, ctx, B); } },
  { id: 'sheet_hero_poses_d', start: 6, end: 8, draw(g, T, lt, ctx) { sheetBg(g, 'hero · dodges (b10 D2a / b11)', 'duck · hop act .5 (scene adds jump height) · limbo · sidestep · turn via dance + turn · s=1.2'); dodges(g, T, ctx); } },
];
