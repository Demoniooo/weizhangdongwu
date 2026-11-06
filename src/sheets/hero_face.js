// 模型图：勇者表情（脸部统一画法）、叠加件、呆毛五形（0–2s）；呆毛曲线插值 normal→question / normal→heart（2–4s）。
import { PAL } from '../core/paper.js';
import { drawHeroHead, HERO_EXPRS } from '../rigs/hero.js';
import { sheetBg, label } from './hero.js';

const AHOGES = [
  ['normal', {}], ['normal curl 1', { curl: 1 }], ['question', { ahoge: 'question' }], ['straight', { ahoge: 'straight' }],
  ['heart', { ahoge: 'heart', expr: 'shy', blush: 0.8 }], ['candle', { ahoge: 'candle' }], ['candle flame 1', { ahoge: 'candle', flame: 1, soot: 1 }],
  ['normal→question .5', { ahoge: { from: 'normal', to: 'question', k: 0.5 } }],
];
const OVER = [
  ['sweat 1', { sweat: 1 }], ['blush 1', { blush: 1, expr: 'shy' }], ['inflate 1', { inflate: 1 }], ['soot 1', { soot: 1 }],
  ['toothSparkle', { expr: 'grin', toothSparkle: 'loop' }], ['wrapFace .6', { scarf: { wrapFace: 0.6 } }], ['wrapFace 1', { scarf: { wrapFace: 1 } }], ['earScale 1.3 yaw -.3', { yaw: -0.32, earScale: 1.3, earSide: 1, expr: 'squint' }],
];

// 第 2 页：呆毛曲线插值 {from, to, k}（b04 想名字时弯成问号；b13 163.00 弯成一颗心 + 脸红）
const MORPH = [0, 0.25, 0.5, 0.75, 1];

export default [
  {
    id: 'sheet_hero_face', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      sheetBg(g, 'hero · expressions', 'skin face · ink bean eyes + white highlight · blush .45 · ink mouth arc · open mouth redDeep + heart tongue');
      const list = HERO_EXPRS;
      ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
        list.forEach((e, i) => {
          const cx = 140 + (i % 8) * 234, cy = 250 + Math.floor(i / 8) * 250;
          drawHeroHead(lg, { x: cx, y: cy, s: 1.55, t: T + i * 0.41, expr: e, seed: i + 2 });
        });
      });
      list.forEach((e, i) => label(g, e, 140 + (i % 8) * 234, 250 + Math.floor(i / 8) * 250 + 112, 20, { align: 'center' }));
      ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
        for (let r = 0; r < 2; r++) {
          const arr = r ? OVER : AHOGES;
          arr.forEach(([, o], i) => {
            const cx = 140 + i * 234, cy = 790 + r * 0 + (r ? 160 : 0);
            const oo = { ...o };
            if (oo.toothSparkle === 'loop') oo.toothSparkle = Math.floor(T / 0.9) * 0.9 + 0.2;
            drawHeroHead(lg, { x: cx, y: r ? 950 : 770, s: r ? 1.05 : 1.15, t: T + i * 0.3, seed: i + 9, ...oo });
          });
        }
      });
      AHOGES.forEach(([k], i) => label(g, k, 140 + i * 234, 856, 16, { align: 'center' }));
      OVER.forEach(([k], i) => label(g, k, 140 + i * 234, 1028, 16, { align: 'center' }));
    },
  },
  {
    id: 'sheet_hero_face_morph', start: 2, end: 4,
    draw(g, T, lt, ctx) {
      sheetBg(g, 'hero · ahoge morph  { from, to, k }', 'b04 normal to question (expr think) · b13 normal to heart (expr shy, blush = k) · k = 0 / .25 / .5 / .75 / 1');
      ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
        MORPH.forEach((k, i) => {
          drawHeroHead(lg, { x: 300 + i * 330, y: 360, s: 1.6, t: T + i * 0.2, seed: i + 3, expr: 'think', ahoge: { from: 'normal', to: 'question', k } });
          drawHeroHead(lg, { x: 300 + i * 330, y: 800, s: 1.6, t: T + i * 0.2, seed: i + 5, expr: 'shy', blush: k, ahoge: { from: 'normal', to: 'heart', k } });
        });
      });
      MORPH.forEach((k, i) => {
        label(g, `question k=${k}`, 300 + i * 330, 500, 18, { align: 'center' });
        label(g, `heart k=${k}`, 300 + i * 330, 940, 18, { align: 'center' });
      });
    },
  },
];
