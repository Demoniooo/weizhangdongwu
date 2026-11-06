// 临时对照（b01 作者用，交付前删除）：b01→b02 交接逐像素核对。
// 0–1：只开 b01（Tb = 9.4 + t）；10–11：b01 + 模拟 b02（bookPageRect 遮罩里画世界，CASTLE_OPTS 静态公主）；
// 20–21：同上但用 castleOpts(Tb)；30–31：b02 世界直接画（不加遮罩、不画 b01）。
import { PAL } from '../core/paper.js';
import { bookCastleCam, bookPageRect } from '../env/book.js';
import { drawCastle, LAYER_GROUPS } from '../env/castle.js';
import b01 from '../scenes/b01_book.js';
import { CASTLE_OPTS, castleOpts } from '../scenes/b01/shared.js';

const popupShot = b01[b01.length - 1];
const world = (g, Tb, ctx, o) => {
  const c = bookCastleCam(Tb);
  for (const [pop, fx] of LAYER_GROUPS) ctx.layer(g, fx, (lg) => { for (const layer of pop) drawCastle(lg, Tb, c, { ...o, layer }); });
};
const b01At = (g, Tb, ctx) => popupShot.draw(g, Tb, Tb - popupShot.start, ctx);

export default [
  { id: '_b01_only', start: 0, end: 1, draw(g, T, lt, ctx) { b01At(g, 9.4 + T, ctx); } },
  { id: '_b01_b02static', start: 10, end: 11, draw(g, T, lt, ctx) { const Tb = 9.4 + (T - 10); b01At(g, Tb, ctx); ctx.mask(g, (mg) => { const r = bookPageRect(Tb); mg.fillRect(r.x, r.y, r.w, r.h); }, (lg) => world(lg, Tb, ctx, CASTLE_OPTS)); } },
  { id: '_b01_b02anim', start: 20, end: 21, draw(g, T, lt, ctx) { const Tb = 9.4 + (T - 20); b01At(g, Tb, ctx); ctx.mask(g, (mg) => { const r = bookPageRect(Tb); mg.fillRect(r.x, r.y, r.w, r.h); }, (lg) => world(lg, Tb, ctx, castleOpts(Tb))); } },
  { id: '_b02_world', start: 30, end: 31, draw(g, T, lt, ctx) { const Tb = 9.4 + (T - 30); g.fillStyle = PAL.ink; g.fillRect(0, 0, 1920, 1080); world(g, Tb, ctx, castleOpts(Tb)); } },
];
