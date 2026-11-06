// 模型图：骑乘（锚点 = 马的 saddle；只画外侧一条腿；人马同一 phase 合拍；马镫跟着勇者的脚：stirrupAt = heroRig().foot）。
import { PAL, rr, blob } from '../core/paper.js';
import { drawHero, heroRig } from '../rigs/hero.js';
import { sheetBg, label } from './hero.js';

let H = null;
try { H = await import('../rigs/horse.js'); } catch (e) { H = null; }

/** 马组模块不在时的占位马（只为对齐锚点）。 */
function placeholderHorse(g, o) {
  const { x, y, s = 1, face = 1 } = o;
  g.save(); g.translate(x, y); g.scale(face * s, s);
  g.fillStyle = PAL.horse; g.fill(blob(0, -120, 110, 46, { seed: 2 })); g.fill(rr(70, -210, 40, 90, 18));
  for (const lx of [-70, -40, 50, 80]) g.fill(rr(lx, -90, 16, 90, 6));
  g.fillStyle = PAL.leather; g.fill(rr(-30, -170, 52, 14, 5));
  g.restore();
  return { saddle: [x - 4 * s * face, y - 162 * s], saddleAngle: 0 };
}
function horseAndRider(g, o, ho, ro) {
  const base = { s: o.s ?? 1, face: o.face ?? 1, t: o.t };
  const hO = { ...base, x: o.x, y: o.y, ...ho };
  const ha = H ? H.horseRig(hO) : placeholderHorse({ save() {}, restore() {}, translate() {}, scale() {}, fill() {} }, hO);
  // 马的 phase 内部会乘 face；勇者的 phase 不乘 —— 所以勇者传 face × 马的 phase（gallop 步幅 280 = HORSE_STRIDE，一单位 = 一个周期，正好合拍）
  const rO = { ...base, x: ha.saddle[0], y: ha.saddle[1], rot: ha.saddleRot ?? (ha.saddleAngle || 0) * (o.face ?? 1), phase: (o.face ?? 1) * ho.phase, ...ro };
  const hr = heroRig(rO);
  if (H) H.drawHorse(g, { ...hO, stirrupAt: hr.foot }); else placeholderHorse(g, hO);
  return drawHero(g, rO);
}

const LIST = [
  ['ride (gallop)', { pose: 'gallop' }, { pose: 'ride', scarf: { vel: [600, 0] } }],
  ['rideSlash .3', { pose: 'gallop' }, { pose: 'rideSlash', act: 0.3, scarf: { vel: [600, 0] } }],
  ['rideLean', { pose: 'walk' }, { pose: 'rideLean', scarf: { vel: [120, 0] } }],
  ['rideHunch (snow)', { pose: 'headwind', icicles: 0.6 }, { pose: 'rideHunch', scarf: { wind: [-500, 0], frozen: 1, notch: true, hole: true }, injury: { bandages: 1 } }],
  ['sneeze .6', { pose: 'headwind' }, { pose: 'sneeze', act: 0.6, scarf: { wind: [-300, 0] } }],
  ['rideFront (face -1)', { pose: 'gallop', face: -1 }, { pose: 'rideFront', face: -1, scarf: { vel: [-600, 0], patch: true, hole: true, notch: true } }],
];

export default [
  {
    id: 'sheet_hero_ride', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      sheetBg(g, 'hero · riding (anchor = horse saddle)', `${H ? 'horse.js' : 'placeholder horse'} · rider phase = face x horse phase (gallop) · stirrupAt = heroRig(o).foot · mount = seat anchor mid-arc`);
      ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
        LIST.forEach(([, ho, ro], i) => {
          const cx = 250 + (i % 3) * 620, fy = 500 + Math.floor(i / 3) * 430;
          const face = ho.face ?? 1;
          const phase = face * (T * 2.2 + i * 0.3); // 马：phase = 世界 x ÷ 280，往左跑时递减
          horseAndRider(lg, { x: cx, y: fy, s: 0.9, t: T, face }, { ...ho, phase }, { ...ro, scarf: { len: 380, ...(ro.scarf || {}) } });
        });
        // 上马弧线中段（座位锚点在空中）
        drawHero(lg, { x: 1720, y: 210, s: 0.7, t: T, pose: 'mount', scarf: { len: 200, vel: [300, -200] } });
      });
      LIST.forEach(([k], i) => label(g, k, 250 + (i % 3) * 620, 540 + Math.floor(i / 3) * 430, 20, { align: 'center' }));
      label(g, 'mount (mid-arc)', 1720, 300, 18, { align: 'center' });
    },
  },
];
