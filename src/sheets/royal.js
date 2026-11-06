// 模型图：王室道具（src/props/royal.js）。
// 时间轴：[0,2) 第 1 页（王冠五态 / 小皇冠 / 金印 / 权杖 / 钟 / 灯笼 + 动态循环）；[2,4) 第 2 页（印迹四种 + 砸下过程、花环三种 + 翻折、摇篮立起）。
// 出图：node tools/render.mjs stills --sheet royal --times 0.5,1.7,2.5,3.7 --outdir out/review/sheets/royal
import { PAL, cut, blob } from '../core/paper.js';
import { clamp, seg, fract, rgba, wobble } from '../core/util.js';
import { glyphRow } from '../ui/type.js';
import { drawCrown, drawTiara, drawSeal, drawStampMark, drawScepter, drawBell, drawGarland, drawCradle, drawLantern, stampP, ell } from '../props/royal.js';

/** 模型图标签（走 type.js；latin 字体只写 ASCII，中文用 play）。 */
export function label(g, text, x, y, size = 22, o = {}) {
  const ascii = /^[\x20-\x7e]*$/.test(text);
  glyphRow(g, text, x, y, size, { family: ascii ? 'latin' : 'play', weight: ascii ? 600 : 400, fill: o.color || PAL.inkSoft, edge: null, align: o.align || 'center', gap: ascii ? 0 : size * 0.02 });
}
/** 页眉。 */
export function header(g, title, sub) {
  g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080);
  g.fillStyle = rgba(PAL.kraft, 0.35); g.fillRect(0, 0, 1920, 64);
  label(g, title, 40, 34, 30, { align: 'left', color: PAL.ink });
  if (sub) label(g, sub, 1880, 34, 20, { align: 'right' });
}
/** 单元格：底线（脚底线）+ 可选身高线（s=1 时 260px × s）。 */
export function cell(g, x, y, w, h, o = {}) {
  g.save();
  g.strokeStyle = rgba(PAL.kraftDark, 0.35); g.lineWidth = 1; g.setLineDash([6, 6]);
  g.strokeRect(x + 4, y + 4, w - 8, h - 8);
  if (o.foot !== undefined) {
    g.setLineDash([]); g.strokeStyle = rgba(PAL.kraftDark, 0.8); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x + 14, o.foot); g.lineTo(x + w - 14, o.foot); g.stroke();
    if (o.h260) {
      g.setLineDash([3, 5]); g.strokeStyle = rgba(PAL.red, 0.5);
      g.beginPath(); g.moveTo(x + 14, o.foot - o.h260); g.lineTo(x + w - 14, o.foot - o.h260); g.stroke();
    }
  }
  g.restore();
  if (o.title) label(g, o.title, x + w / 2, y + h - 22, o.ts || 19);
}

function page1(g, T, ctx) {
  header(g, 'royal.js  ·  王冠 / 小皇冠 / 金印 / 权杖 / 钟 / 灯笼', 'props · page 1');
  const t = T;
  // —— 王冠：端正 / spin / squash / 旋转飞 / 闪光 ——
  const crowns = [
    ['crown', {}],
    ['spin 0.7', { spin: 0.7 }],
    ['spin = t (loop)', { spin: t * 2.4 }],
    ['squash 0.5', { squash: 0.5 }],
    ['squash 1', { squash: 1 }],
    ['rot + glint', { rot: 0.32, glint: 1, t }],
  ];
  crowns.forEach(([name, o], i) => {
    const x = 40 + i * 230, y = 80;
    cell(g, x, y, 220, 230, { title: name });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => drawCrown(lg, { x: x + 110, y: y + 160, s: 1.45, t, ...o }));
  });
  // 小皇冠
  const tiaras = [['tiara', {}], ['tiara glint', { glint: 1, t }], ['tiara spin=t', { spin: -t * 3 }]];
  tiaras.forEach(([name, o], i) => {
    const x = 1430 + (i % 2) * 230, y = 80 + Math.floor(i / 2) * 230;
    if (i === 2) return;
    cell(g, x, y, 220, 230, { title: name });
    ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => drawTiara(lg, { x: x + 110, y: y + 150, s: 2.6, t, ...o }));
  });
  {
    const x = 1430, y = 310;
    cell(g, x, y, 450, 150, { title: 'tiara spin / rot (落地打旋)' });
    ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => {
      drawTiara(lg, { x: x + 110, y: y + 95, s: 2, spin: -t * 3, t });
      drawTiara(lg, { x: x + 330, y: y + 95, s: 2, rot: t * 4, t });
    });
  }
  // —— 金印 ——
  const seals = [['seal lift 0', { lift: 0 }], ['lift 0.5', { lift: 0.5 }], ['lift 1', { lift: 1 }], ['squash 1 (impact)', { squash: 1 }]];
  seals.forEach(([name, o], i) => {
    const x = 40 + i * 230, y = 320;
    cell(g, x, y, 220, 380, { title: name, foot: y + 320 });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => drawSeal(lg, { x: x + 110, y: y + 320, s: 0.95, t, ...o }));
  });
  {
    const x = 960, y = 320;
    cell(g, x, y, 220, 380, { title: 'seal slam loop', foot: y + 320 });
    const ph = fract(t / 1.0);
    const lift = ph < 0.55 ? Math.sin((ph / 0.55) * Math.PI * 0.5) : Math.max(0, 1 - (ph - 0.55) / 0.12);
    const sq = ph > 0.67 ? Math.max(0, wobble(ph, 0.67, 3, 0.08)) : 0;
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      drawStampMark(lg, { x: x + 110, y: y + 324, kind: 'gold', w: 150, h: 40, p: ph > 0.67 ? clamp(0.25 + (ph - 0.67) * 2.5) : 0, rot: 0, rays: true, chars: null });
      drawSeal(lg, { x: x + 110, y: y + 320, s: 0.95, lift, squash: sq, t });
    });
  }
  // —— 权杖 ——
  {
    const x = 1200, y = 470;
    cell(g, x, y, 220, 230, { title: 'scepter / glint+glow' });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      drawScepter(lg, { x: x + 70, y: y + 150, s: 0.95, t });
      drawScepter(lg, { x: x + 160, y: y + 150, s: 0.95, t, glint: 1, glow: 0.8, rot: 0.15 });
    });
  }
  // —— 钟 ——
  {
    const x = 1430, y = 470;
    cell(g, x, y, 220, 230, { title: 'bell swing (loop)' });
    const sw = 0.45 * Math.sin(t * Math.PI * 2 / 1.1);
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => drawBell(lg, { x: x + 110, y: y + 40, s: 1.25, swing: sw, clapper: -0.6 * Math.sin(t * Math.PI * 2 / 1.1 - 0.9) * 0.5, t }));
  }
  // —— 灯笼 ——
  {
    const x = 1660, y = 470;
    cell(g, x, y, 220, 230, { title: 'lantern pulse 0 / 2Hz' });
    ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => {
      drawLantern(lg, { x: x + 60, y: y + 40, s: 1.15, pulse: 0, t });
      drawLantern(lg, { x: x + 160, y: y + 40, s: 1.15, pulse: 0.5 + 0.5 * Math.sin(t * Math.PI * 4), swing: 0.08 * Math.sin(t * 2.2), t });
    });
  }
  // —— 底排：印迹四种 + 砸下过程（循环） ——
  const marks = [['gold + chars', { kind: 'gold', w: 330, h: 110, chars: '达拉崩吧' }], ['check', { kind: 'check' }], ['x', { kind: 'x' }], ['error', { kind: 'error' }]];
  marks.forEach(([name, o], i) => {
    const x = 40 + i * (i === 0 ? 0 : 230) + (i > 0 ? 230 * 1 : 0), y = 720;
    const w = i === 0 ? 450 : 220;
    const xx = i === 0 ? 40 : 270 + i * 230;
    cell(g, xx, y, w, 340, { title: name });
    ctx.layer(g, { texture: 0.2 }, (lg) => {
      lg.fillStyle = PAL.paper2; lg.fillRect(xx + 20, y + 30, w - 40, 250);
      drawStampMark(lg, { x: xx + w / 2, y: y + 155, r: 82, ...o, p: 1 });
    });
  });
  {
    const x = 960 + 230 * 0 + 230, y = 720;
    const xx = 1190;
    cell(g, xx, y, 690, 340, { title: 'p: 0.12 / 0.25 / 0.35 / 0.6 / loop' });
    const ps = [0.12, 0.25, 0.35, 0.6];
    ctx.layer(g, { texture: 0.2 }, (lg) => {
      lg.fillStyle = PAL.paper2; lg.fillRect(xx + 20, y + 30, 650, 250);
      ps.forEach((p, i) => drawStampMark(lg, { x: xx + 90 + i * 130, y: y + 150, r: 52, kind: 'check', p, seed: 3 + i }));
      const loopT = fract(T / 1.2) * 1.2;
      drawStampMark(lg, { x: xx + 610, y: y + 150, r: 52, kind: 'x', p: stampP(loopT, 0.3) });
    });
  }
}

function page2(g, T, ctx) {
  header(g, 'royal.js  ·  印迹细节 / 花环 · 彩旗 · 花拱 fold / 摇篮 rise', 'props · page 2');
  const t = T;
  // 花环三种 × fold
  const folds = [0.2, 0.55, 1];
  ['garland', 'bunting', 'arch'].forEach((kind, r) => {
    folds.forEach((f, c) => {
      const x = 40 + c * 300, y = 80 + r * 250;
      cell(g, x, y, 290, 240, { title: `${kind} fold ${f}` });
      ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg) => {
        if (kind === 'arch') drawGarland(lg, { kind, x0: x + 50, y0: y + 200, x1: x + 240, y1: y + 200, h: 150, fold: f, t, s: 0.9 });
        else drawGarland(lg, { kind, x0: x + 30, y0: y + 50, x1: x + 260, y1: y + 60, fold: f, t, s: 1 });
      });
    });
  });
  {
    const x = 940, y = 80;
    cell(g, x, y, 460, 490, { title: 'fold loop（立体书翻折）' });
    const f = clamp(fract(T / 1.4) * 1.8);
    ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg) => {
      lg.strokeStyle = rgba(PAL.kraftDark, 0.6); lg.lineWidth = 3; lg.beginPath(); lg.moveTo(x + 30, y + 60); lg.lineTo(x + 430, y + 60); lg.stroke();
      drawGarland(lg, { kind: 'garland', x0: x + 40, y0: y + 60, x1: x + 420, y1: y + 60, fold: f, t, s: 1.1 });
      drawGarland(lg, { kind: 'bunting', x0: x + 40, y0: y + 200, x1: x + 420, y1: y + 190, fold: clamp(f - 0.1), t, s: 1.1, seed: 2 });
      drawGarland(lg, { kind: 'arch', x0: x + 110, y0: y + 470, x1: x + 350, y1: y + 470, h: 180, fold: clamp(f - 0.2), t, s: 1 });
    });
  }
  // 摇篮
  const rises = [0, 0.3, 0.65, 1];
  rises.forEach((r, i) => {
    const x = 40 + i * 300, y = 830;
    cell(g, x, y - 0, 290, 240, { title: `cradle rise ${r}`, foot: y + 190 });
    ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => drawCradle(lg, { x: x + 145, y: y + 190, s: 0.95, rise: r, t }));
  });
  {
    const x = 1420, y = 80;
    cell(g, x, y, 460, 490, { title: "cradle part back / baby / front + rock", foot: y + 400 });
    const rock = 0.06 * Math.sin(t * Math.PI * 2 / 1.6);
    const rise = clamp(fract(T / 2) * 2.2);
    ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => {
      const a = drawCradle(lg, { x: x + 230, y: y + 400, s: 1.6, rise: 1, rock, part: 'back', t });
      // 占位婴儿（folk.drawChild 由别组实现）
      if (a) { cut(lg, blob(a.baby[0], a.baby[1] - 40, 34, 32, { seed: 5 }), PAL.skin, { rim: PAL.white }); lg.fillStyle = PAL.ink; lg.fill(ell(a.baby[0] - 10, a.baby[1] - 42, 3, 4.5)); lg.fill(ell(a.baby[0] + 10, a.baby[1] - 42, 3, 4.5)); }
      drawCradle(lg, { x: x + 230, y: y + 400, s: 1.6, rise: 1, rock, part: 'front', t });
    });
    const x2 = 1420, y2 = 590;
    cell(g, x2, y2, 460, 240, { title: 'rise loop', foot: y2 + 200 });
    ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => drawCradle(lg, { x: x2 + 230, y: y2 + 200, s: 1, rise, t, hood: -1 }));
  }
  // 大号金印印迹（金箔扫光循环）
  {
    const x = 1240, y = 850;
    cell(g, x, y, 640, 220, { title: 'gold stamp sweep loop' });
    ctx.layer(g, { texture: 0.2 }, (lg) => {
      lg.fillStyle = PAL.paper2; lg.fillRect(x + 20, y + 20, 600, 160);
      drawStampMark(lg, { x: x + 320, y: y + 100, kind: 'gold', w: 420, h: 120, chars: '卜多比鲁翁', sweep: fract(T / 1.5), t, rot: 0 });
    });
  }
}

export default [
  { id: 'sheet_royal_p1', start: 0, end: 2, draw(g, T, lt, ctx) { page1(g, T, ctx); } },
  { id: 'sheet_royal_p2', start: 2, end: 4, draw(g, T, lt, ctx) { page2(g, T, ctx); } },
];
