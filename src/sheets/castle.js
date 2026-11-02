// 模型图：王城外景（castle）。0–2s 网格（全部状态 + 循环动作），之后每秒一张全分辨率单图（真实图层合成）。
import { PAL, blob, cut, rr } from '../core/paper.js';
import { cam } from '../core/camera.js';
import { clamp } from '../core/util.js';
import { glyphRow } from '../ui/type.js';
import { drawCastle, CASTLE, CAMS, LAYER_FX, CASTLE_TIMES } from '../env/castle.js';
import { NAMES } from '../cues.js';

const LAYERS = ['sky', 'far', 'mid', 'main', 'near', 'fg'];

/** 画整座王城：layers=true 时每层包 ctx.layer（真实效果），否则直接画（网格缩略用）。 */
function scene(g, ctx, T, c, o, layers) {
  for (const L of LAYERS) {
    const oo = { ...o, layer: L };
    if (layers) {
      const fx = { ...LAYER_FX[L] };
      if (L === 'fg' && c.zoom > 1.5) fx.blur = 4;
      ctx.layer(g, fx, (lg) => drawCastle(lg, T, c, oo));
    } else drawCastle(g, T, c, oo);
  }
  if (o.redSeparate) {
    if (layers) ctx.layer(g, {}, (lg) => drawCastle(lg, T, c, { ...o, layer: 'alarm' }));
    else drawCastle(g, T, c, { ...o, layer: 'alarm' });
  }
}

function label(g, text, x, y, size = 30, fill = PAL.ink) {
  glyphRow(g, [...text], x, y, size, { family: 'play', fill, edge: PAL.paper, edgeW: 0.14 });
}

function tile(g, ctx, T, x, y, s, title, draw) {
  g.save();
  g.translate(x, y);
  g.save();
  g.translate(6, 8);
  g.fillStyle = 'rgba(43,26,36,0.25)';
  g.fillRect(0, 0, 1920 * s, 1080 * s);
  g.restore();
  g.beginPath(); g.rect(0, 0, 1920 * s, 1080 * s); g.clip();
  g.scale(s, s);
  draw(g);
  g.restore();
  label(g, title, x + 6, y + 1080 * s + 20, 24);
}

// 三个占位小人（s=0.26，世界高约 68）：只用于量尺寸
function dummy(g, x, y, s, kind, t) {
  const H = (kind === 'king' ? 220 : kind === 'princess' ? 250 : 260) * s;
  const bob = Math.sin(t * 3 + x) * 1.2;
  g.save();
  g.translate(x, y + bob);
  const bodyC = kind === 'hero' ? PAL.heroBlue : kind === 'princess' ? PAL.princess : PAL.robe;
  cut(g, blob(0, -H * 0.3, H * 0.24, H * 0.32, { seed: 3 }), bodyC);
  cut(g, blob(0, -H * 0.72, H * 0.2, H * 0.2, { seed: 4 }), PAL.skin);
  g.fillStyle = PAL.ink;
  g.beginPath(); g.ellipse(-H * 0.06, -H * 0.72, H * 0.018, H * 0.026, 0, 0, 7); g.ellipse(H * 0.06, -H * 0.72, H * 0.018, H * 0.026, 0, 0, 7); g.fill();
  if (kind === 'hero') cut(g, rr(-H * 0.2, -H * 0.56, H * 0.4, H * 0.07, 3), PAL.scarf);
  if (kind === 'princess') cut(g, blob(0, -H * 0.86, H * 0.2, H * 0.1, { seed: 5 }), PAL.hairGold);
  if (kind === 'king') cut(g, rr(-H * 0.14, -H * 0.98, H * 0.28, H * 0.14, 2), PAL.gold);
  g.restore();
  return H;
}

const flagTimes = (t0, step) => Array.from({ length: 13 }, (_, i) => t0 + step * i);
const BASE = { flags: undefined };
void BASE;

const GRID = [
  ['黎明 dawn（L01）', (T) => ({ time: 'dawn' })],
  ['危急 doom + 火 + 烽火', (T) => ({ time: 'doom', fires: [{ house: 3, at: 0.2 }, { house: 4, at: 0.5 }, { house: 1, at: 0.8 }], beacons: [{ tower: 4, at: 0.3 }, { tower: 5, at: 0.5 }], lantern: 1 })],
  ['灰蓝 gray（L05）', (T) => ({ time: 'gray', lantern: 1, beacons: [{ tower: 4, at: 0.2 }, { tower: 5, at: 0.4 }] })],
  ['春日 spring + E04 升旗', (T) => ({ time: 'spring', flags: { chars: NAMES.city, at: flagTimes(0.1, 0.12), finaleAt: 1.75 } })],
  ['婚礼 wedding deco=1 + 绕塔', (T) => ({ time: 'wedding', deco: 1, ribbonWrap: { p: clamp(T / 1.6) }, flags: { chars: NAMES.city, at: flagTimes(-9, 0.01) } })],
  ['夕阳 sunset（O02）', (T) => ({ time: 'sunset', sun: { x: 1220, y: 250, r: 70 }, flags: { chars: NAMES.city, at: flagTimes(-9, 0.01) } })],
  ['夜 night + 窗灯', (T) => ({ time: 'night' })],
  ['popup 立起中（错峰：塔 0→1、主堡 0.3、屋顶 0.15）', (T) => ({ time: 'dawn', popup: [1, 1, 1, ...Array.from({ length: 13 }, (_, i) => i / 12), 0.3, 0.15, 0, 0.5, 0, 0.7, 0] })],
  ['L02 双天空 split=900 + 撕裂', (T) => ({ time: 'dawn', split: 900, tear: { at: 0.3, x: 1320, y: 300 } })],
];

const shots = [
  {
    id: 'castle_grid', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080);
      label(g, 'castle.js 王城外景 —— 同一构图 CA-W，七个时段 + 立起 + 双天空（模型图，未加图层投影）', 40, 30, 28);
      const s = 0.27, gx = 120, gy = 66, dx = 1920 * s + 40, dy = 1080 * s + 44;
      GRID.forEach(([title, fn], k) => {
        const col = k % 3, row = Math.floor(k / 3);
        tile(g, ctx, T, gx + col * dx, gy + row * dy, s, title, (tg) => scene(tg, ctx, T, CAMS.CA_W, fn(T), false));
      });
    },
  },
];

// 全分辨率单图：真实图层合成（每秒一张）
const FULL = [
  ['dawn', { time: 'dawn' }, CAMS.CA_W],
  ['doom', { time: 'doom', fires: [{ house: 3, at: 2 }, { house: 4, at: 2 }, { house: 5, at: 2 }], beacons: [{ tower: 4, at: 2 }] }, CAMS.CA_W],
  ['gray', { time: 'gray', lantern: 1, redSeparate: true, beacons: [{ tower: 4, at: 0 }, { tower: 5, at: 0 }] }, CAMS.CA_W],
  ['spring', { time: 'spring', flags: { chars: NAMES.city, at: flagTimes(0, 0.001) } }, CAMS.CA_W],
  ['wedding', { time: 'wedding', deco: 1, ribbonWrap: { p: 1 }, flags: { chars: NAMES.city, at: flagTimes(0, 0.001) } }, cam(960, 540, 0.9)],
  ['sunset', { time: 'sunset', sun: { x: 1220, y: 250, r: 70 }, flags: { chars: NAMES.city, at: flagTimes(0, 0.001) } }, CAMS.CA_W],
  ['night', { time: 'night' }, CAMS.CA_W],
  ['CA_MW dawn', { time: 'dawn' }, CAMS.CA_MW],
  ['CA_BAL dawn + 三人 s=0.26', { time: 'dawn', lantern: 1, onBalcony: (g, info) => { dummy(g, 905, info.floorY, 0.26, 'hero', 0); dummy(g, 965, info.floorY, 0.26, 'princess', 0); dummy(g, 1028, info.floorY, 0.26, 'king', 0); } }, CAMS.CA_BAL],
  ['CA_TOWN doom 火雨', { time: 'doom', fires: [{ house: 3, at: 9.2 }, { house: 4, at: 9.4 }, { house: 5, at: 9.6 }, { house: 2, at: 9.9 }] }, CAMS.CA_TOWN],
  ['CA_BAL_K gray 烽火', { time: 'gray', lantern: 1, beacons: [{ tower: 4, at: 10.2 }, { tower: 5, at: 10.4 }] }, CAMS.CA_BAL_K],
];
FULL.forEach(([name, o, c], k) => {
  shots.push({
    id: `castle_full_${k}`, start: 2 + k, end: 3 + k,
    draw(g, T, lt, ctx) {
      g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080);
      scene(g, ctx, T, c, o, true);
      g.fillStyle = PAL.paper; g.fillRect(16, 1022, 620, 48);
      label(g, `castle · ${name}`, 30, 1046, 26, PAL.ink);
    },
  });
});

export default shots;
void CASTLE; void CASTLE_TIMES;
