// 模型图：围巾（五态、沿围巾写字、擦屏、红带合拢、书签、缠手红绳）。
import { PAL, blob, rr } from '../core/paper.js';
import { drawHero } from '../rigs/hero.js';
import { drawScarf, scarfPoints, drawScarfWipe, scarfWipeMask, drawScarfBand, drawBookmark, drawScarfKnot } from '../props/scarf.js';
import { sheetBg, label } from './hero.js';

const FIVE = [
  ['normal', {}], ['glow .6', { glow: 0.6 }], ['notch + hole', { notch: true, hole: true }],
  ['patch', { notch: true, hole: true, patch: true }], ['frozen 1', { notch: true, hole: true, frozen: 1 }],
];

/** 两块测试画面：A = 前一镜（深紫），B = 后一镜（晴天 + 小城）。 */
function sceneA(g) { g.fillStyle = PAL.dragonDeep; g.fillRect(-200, -200, 2400, 1500); g.fillStyle = PAL.dragon; g.fill(blob(600, 700, 420, 260, { seed: 3 })); }
function sceneB(g) {
  g.fillStyle = PAL.skyDayLow; g.fillRect(-200, -200, 2400, 1500);
  g.fillStyle = PAL.meadow; g.fillRect(-200, 760, 2400, 600);
  for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? PAL.roof : PAL.roofRed; g.fill(rr(700 + i * 90, 520 - (i % 3) * 60, 60, 260 + (i % 3) * 60, 6)); }
}

export default [
  {
    id: 'sheet_hero_scarf_a', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      sheetBg(g, 'scarf · five states', 'normal · glow (gold edge) · notch + hole (V07) · patch (E09) · frozen (V11 board + icicles)');
      ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
        FIVE.forEach(([, so], i) => {
          const x = 300 + i * 360;
          drawHero(lg, { x, y: 520, s: 0.82, t: T + i * 0.2, pose: 'run', scarf: { len: 420, vel: [430, 0], wind: so.frozen ? [-500, 0] : [0, 0], ...so }, expr: so.frozen ? 'hurt' : 'determined' });
        });
        FIVE.forEach(([, so], i) => {
          const x0 = 70 + i * 372;
          const pts = scarfPoints([x0, 700], { len: 330, n: 24, t: T + i * 0.3, back: 1, wind: so.frozen ? [600, 0] : [520, -40], seed: i + 1 });
          drawScarf(lg, pts, { ...so, t: T, seed: i + 3, width: 30, endWidth: 12 });
        });
        const tp = Array.from({ length: 40 }, (_, i) => [140 + i * 42, 925 + 26 * Math.sin(i * 0.33 - T * 2.2) * (i / 39)]);
        drawScarf(lg, tp, { width: 96, endWidth: 70, t: T, text: '斑得贝迪卜多比鲁翁', textSize: 72, textFill: PAL.gold, textStart: 120, fringeLen: 34 });
      });
      FIVE.forEach(([k], i) => label(g, k, 300 + i * 360, 560, 20, { align: 'center' }));
      label(g, 'drawScarf o.text (display 72px gold along the scarf)', 960, 1040, 18, { align: 'center' });
    },
  },
  {
    id: 'sheet_hero_scarf_b', start: 2, end: 4,
    draw(g, T, lt, ctx) {
      sheetBg(g, 'scarf · wipe / band / bookmark / knot', 'drawScarfWipe p=.3 / .6 (hole shows next shot) · drawScarfBand p=0 / .5 / 1 · drawBookmark · drawScarfKnot p=.35 / .7 / 1');
      // 擦屏两格（缩 0.42）
      [0.3, 0.6].forEach((p, i) => {
        const ox = 70 + i * 900, oy = 140, k = 0.42, W = 1920 * k, Hh = 1080 * k;
        const tf = (lg) => { lg.beginPath(); lg.rect(ox, oy, W, Hh); lg.clip(); lg.translate(ox, oy); lg.scale(k, k); };
        g.save(); tf(g); sceneA(g); g.restore();
        ctx.mask(g, (mg) => { mg.save(); mg.translate(ox, oy); mg.scale(k, k); mg.fill(scarfWipeMask(T, { p, t: T })); mg.restore(); }, (lg) => { lg.save(); tf(lg); sceneB(lg); lg.restore(); });
        g.save(); tf(g); drawScarfWipe(g, T, { p, t: T }); g.restore();
        g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 2; g.strokeRect(ox, oy, W, Hh); g.restore();
        label(g, `wipe p=${p} (hole & twisted tail show the next shot)`, ox + W / 2, oy + Hh + 26, 18, { align: 'center' });
      });
      // 红带三格
      [0, 0.5, 1].forEach((p, i) => {
        const ox = 70 + i * 420, oy = 640, k = 0.2;
        g.save(); g.beginPath(); g.rect(ox, oy, 1920 * k, 1080 * k); g.clip();
        g.fillStyle = PAL.paper2; g.fillRect(ox, oy, 1920 * k, 1080 * k);
        g.translate(ox, oy); g.scale(k, k);
        drawScarfBand(g, T, { p, wave: p === 1 ? 1 : 0, t: T });
        g.restore();
        g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 2; g.strokeRect(ox, oy, 1920 * k, 1080 * k); g.restore();
        label(g, `band p=${p}${p === 1 ? ' wave 1' : ''}`, ox + 192, oy + 1080 * k + 24, 16, { align: 'center' });
      });
      ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
        // 书签
        [null, 2.2, 3.4].forEach((w, i) => {
          lg.fillStyle = PAL.redDeep; lg.fillRect(1330 + i * 90 - 40, 640, 80, 18);
          drawBookmark(lg, { x: 1330 + i * 90, y: 656, len: 120, t: T, wobbleAt: w == null ? null : Math.floor(T) + (w % 1) });
        });
        // 缠手红绳
        [0.35, 0.7, 1].forEach((p, i) => {
          const x = 1030 + i * 300, y = 960, k = 2;
          drawScarfKnot(lg, { x, y, s: k, p, part: 'back', t: T });
          lg.fillStyle = PAL.skin; lg.fill(blob(x - 22 * k, y, 24 * k, 17 * k, { seed: 3 }));
          lg.fillStyle = PAL.leather; lg.fill(blob(x + 20 * k, y, 23 * k, 17 * k, { seed: 4 }));
          drawScarfKnot(lg, { x, y, s: k, p, part: 'front', t: T });
        });
      });
      label(g, 'bookmark (wobbleAt)', 1420, 800, 16, { align: 'center' });
      [0.35, 0.7, 1].forEach((p, i) => label(g, `knot p=${p}`, 1030 + i * 300, 1046, 16, { align: 'center' }));
    },
  },
];
