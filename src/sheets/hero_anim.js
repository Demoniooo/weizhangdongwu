// 动态模型图：循环动作。第 1 段（0–2s）walk / run / dance；第 2 段（2–4s）slash / draw act 循环 + 骑乘（与马合拍）；第 3 段（4–6s）idle 呼吸眨眼 / cheer / charge。
// 渲染：node tools/render.mjs sheet --sheet hero_anim --from 0 --to 2 --every 0.1 --cols 7 --tile 360（另两段改 --from 2 --to 4 / --from 4 --to 6）
import { drawHero, heroRig, HERO_STRIDE } from '../rigs/hero.js';
import { sheetBg, label, guide } from './hero.js';

let H = null;
try { H = await import('../rigs/horse.js'); } catch (e) { H = null; }
const fract = (x) => x - Math.floor(x);
/** 2s 一循环的翻面：0–0.6s 翻到背面（turn 0→1）、停 0.4s、1.0–1.6s 翻回（1→0）、停 0.4s —— 首尾都是 turn 0，循环不跳。 */
const turnLoop = (T) => { const f = fract(T / 2); return f < 0.3 ? f / 0.3 : f < 0.5 ? 1 : f < 0.8 ? 1 - (f - 0.5) / 0.3 : 0; };

function row(g, T, ctx, items, title) {
  sheetBg(g, title, '');
  items.forEach(([k], i) => { guide(g, 330 + i * 630, 900, 1.9, 250); label(g, k, 330 + i * 630, 960, 30, { align: 'center' }); });
  ctx.layer(g, { shadow: 9, texture: 0.22 }, (lg) => {
    items.forEach(([, o, fn], i) => {
      if (fn) { fn(lg, 330 + i * 630, 900); return; }
      drawHero(lg, { x: 330 + i * 630, y: 900, s: 1.9, t: T, ...o, scarf: { len: 300, ...(o.scarf || {}) } });
    });
  });
}

export default [
  {
    id: 'sheet_hero_anim_a', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      row(g, T, ctx, [
        ['walk (phase = x / 150)', { pose: 'walk', phase: (T * 160) / HERO_STRIDE }],
        ['run', { pose: 'run', scarf: { vel: [430, 0] } }],
        ['dance + turn', { pose: 'dance', turn: turnLoop(T) }],
      ], 'hero · loops A');
    },
  },
  {
    id: 'sheet_hero_anim_b', start: 2, end: 4,
    draw(g, T, lt, ctx) {
      row(g, T, ctx, [
        ['slash (act loop 1s)', { pose: 'slash', act: fract(T) }],
        ['draw (act loop 2s)', { pose: 'draw', act: Math.min(1, fract(T / 2) * 1.5) }],
        ['ride (same phase)', {}, (lg, x, y) => {
          if (!H) return;
          const ho = { x, y, s: 1.3, t: T, pose: 'gallop', phase: T * 2.4 };
          const ha = H.horseRig(ho);
          const ro = { x: ha.saddle[0], y: ha.saddle[1], s: 1.3, t: T, pose: 'ride', phase: T * 2.4, rot: ha.saddleRot ?? (ha.saddleAngle || 0), scarf: { len: 380, vel: [600, 0] } };
          H.drawHorse(lg, { ...ho, stirrupAt: heroRig(ro).foot });
          drawHero(lg, ro);
        }],
      ], 'hero · loops B');
    },
  },
  {
    id: 'sheet_hero_anim_c', start: 4, end: 6,
    draw(g, T, lt, ctx) {
      row(g, T, ctx, [
        ['idle (breath + blink)', { pose: 'idle', expr: 'normal' }],
        ['cheer', { pose: 'cheer' }],
        ['charge', { pose: 'charge', scarf: { vel: [520, 0] } }],
      ], 'hero · loops C');
    },
  },
];
