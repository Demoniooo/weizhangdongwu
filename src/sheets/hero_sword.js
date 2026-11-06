// 模型图：剑（最好的剑：入鞘 / 出鞘 / 空鞘 / 崩口 / 平面版 / 剑光；拔剑弧光三帧；小图标）+ 名字之剑（字牌 4 / 8 / 13、角度 0 / −π/4 / −π/2、扫光、围巾缠柄）。
import { PAL } from '../core/paper.js';
import { drawHero } from '../rigs/hero.js';
import { drawSword, drawNameSword, drawSwordIcon } from '../props/sword.js';
import { sheetBg, label } from './hero.js';

const STATES = [
  ['sheathed', { state: 'sheathed' }], ['bare', { state: 'bare' }], ['scabbard (empty)', { state: 'scabbard' }], ['chip', { state: 'bare', chip: true }],
  ['flat (theater)', { state: 'bare', flat: true }], ['glint .3', { state: 'bare', glint: 0.3 }], ['glint .7', { state: 'bare', glint: 0.7 }], ['glint 1', { state: 'bare', glint: 1 }],
];
const tilesN = (n, fly = []) => Array.from({ length: 13 }, (_, i) => (i < n ? 1 : fly[i - n] ?? 0));

export default [
  {
    id: 'sheet_hero_sword_a', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      sheetBg(g, 'sword · drawSword / drawSwordIcon', 'steel blade · gold guard · ruby pommel · scabbard woodDark + gold fittings · glint = 4-point star running to the tip · draw arc (white crescent)');
      ctx.layer(g, { shadow: 6, texture: 0.2 }, (lg) => {
        STATES.forEach(([, so], i) => drawSword(lg, { x: 140 + i * 235, y: 420, s: 1.3, rot: -Math.PI / 2, t: T, ...so }));
        ['draw', 'draw', 'draw', 'slash', 'slash'].forEach((p, i) => {
          const act = [0.38, 0.58, 0.8, 0.3, 0.5][i];
          drawHero(lg, { x: 170 + i * 270, y: 960, s: 1, t: T, pose: p, act, scarf: { len: 160 } });
        });
        [32, 64, 128].forEach((sz, i) => drawSwordIcon(lg, { x: 1520 + i * 120 + (i === 2 ? 40 : 0), y: 820, size: sz }));
        drawSwordIcon(lg, { x: 1700, y: 960, size: 96, rot: 0, glow: 0.6 });
      });
      STATES.forEach(([k], i) => label(g, k, 140 + i * 235, 470, 17, { align: 'center' }));
      ['draw .38', 'draw .58', 'draw .8', 'slash .3', 'slash .5'].forEach((k, i) => label(g, k, 170 + i * 270, 1000, 17, { align: 'center' }));
      label(g, 'icon 32 / 64 / 128 · glow', 1660, 1040, 17, { align: 'center' });
    },
  },
  {
    id: 'sheet_hero_sword_b', start: 2, end: 4,
    draw(g, T, lt, ctx) {
      sheetBg(g, 'name sword · drawNameSword (s=0.42)', 'tiles 4 / 8 / 13 (+tiles in flight) · angle 0 / -pi/4 / -pi/2 · glow sweep · scarfWrap · glyphs always upright');
      ctx.layer(g, { shadow: 8, texture: 0.2 }, (lg) => {
        const from = [250, 150];
        drawNameSword(lg, { x: 170, y: 250, s: 0.42, t: T, tiles: tilesN(4, [0.55, 0.25]), from, scarfWrap: 0.5 });
        drawNameSword(lg, { x: 170, y: 430, s: 0.42, t: T, tiles: tilesN(8, [0.7]), from, scarfWrap: 1 });
        drawNameSword(lg, { x: 170, y: 610, s: 0.42, t: T, tiles: tilesN(13), glow: 0.55 + 0.4 * Math.sin(T * 1.3), scarfWrap: 1, notch: true, hole: true });
        drawNameSword(lg, { x: 300, y: 1010, s: 0.26, angle: -Math.PI / 4, t: T, tiles: tilesN(13), glow: 1, scarfWrap: 1 });
        drawNameSword(lg, { x: 1080, y: 1030, s: 0.2, angle: -Math.PI / 2, t: T, tiles: tilesN(13), glow: 1, scarfWrap: 1 });
        drawNameSword(lg, { x: 1640, y: 900, s: 0.9, t: T, tiles: tilesN(1), scarfWrap: 0.55 + 0.45 * Math.sin(T * 2), part: 'back' });
        drawNameSword(lg, { x: 1640, y: 900, s: 0.9, t: T, tiles: tilesN(1), scarfWrap: 0.55 + 0.45 * Math.sin(T * 2), part: 'front' });
      });
      label(g, 'tiles 4 (+2 flying) · scarfWrap .5', 170, 330, 16);
      label(g, 'tiles 8 (+1 flying) · scarfWrap 1', 170, 510, 16);
      label(g, 'tiles 13 + tip · glow sweep', 170, 690, 16);
      label(g, 'angle -pi/4', 420, 1050, 16);
      label(g, 'angle -pi/2', 1110, 1050, 16);
      label(g, 'hilt close-up: scarfWrap (back / front parts)', 1600, 1010, 16, { align: 'center' });
    },
  },
];
