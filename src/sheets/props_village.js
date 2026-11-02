// 模型图：src/props/village.js —— 听岔五图标、道具小图标、宝箱与容器（静态网格 + 开箱循环）。
import { PAL, rr, cut, shade } from '../core/paper.js';
import { clamp, osc, rgba } from '../core/util.js';
import { glyphRow } from '../ui/type.js';
import { drawChest, drawPot, drawBarrel, drawFlowerPot, drawItemIcon, drawMishearIcon, MISHEAR_NAMES } from '../props/village.js';

const label = (g, text, x, y, size = 22, col = PAL.inkSoft) => glyphRow(g, text, x, y, size, { family: 'play', fill: col, edge: null, align: 'center', gap: 0 });
const bg = (g, title) => {
  g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080);
  label(g, title, 960, 44, 30, PAL.ink);
};
const ground = (g, y, x0 = 80, x1 = 1840) => { g.strokeStyle = rgba(PAL.inkSoft, 0.35); g.lineWidth = 2; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]); };
const ICONS = ['card', 'violin', 'eggtart', 'soda', 'marathon'];
const ITEMS = ['potion', 'key', 'boots', 'shield', 'hat', 'bag'];

export default [
  {
    id: 'sheet_village_icons', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      bg(g, 'props/village · 听岔五图标（s=1.35，格 150×200 放大）+ 道具小图标（s=1.4）');
      // 道具栏格子（示意，界面组的 itemBar 负责正式外框）
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
        ICONS.forEach((n, i) => {
          const cx = 300 + i * 330;
          const cell = rr(cx - 135, 120, 270, 380, 18);
          cut(lg, cell, PAL.paper2, { rim: PAL.white });
          shade(lg, cell, PAL.kraft, 0, 120, 0, 500, 0, 0.35);
        });
      });
      ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
        ICONS.forEach((n, i) => drawMishearIcon(lg, n, { x: 300 + i * 330, y: 290, s: 1.35, t: T, glow: 0.8 }));
        ITEMS.forEach((n, i) => drawItemIcon(lg, n, { x: 330 + i * 250, y: 800, s: 1.4, t: T, glint: (T * 0.7 + i * 0.13) % 1 }));
      });
      ICONS.forEach((n, i) => { label(g, MISHEAR_NAMES[n], 300 + i * 330, 455, 40, PAL.ink); label(g, n, 300 + i * 330, 530, 20); });
      ITEMS.forEach((n, i) => label(g, n, 330 + i * 250, 900, 22));
      label(g, 'drawItemIcon(g, name, {x,y,s,t,glint})', 960, 680, 24);
    },
  },
  {
    id: 'sheet_village_containers', start: 2, end: 4,
    draw(g, T, lt, ctx) {
      bg(g, 'props/village · 容器：open 0 / 0.35 / 0.7 / 1(+burst)，big，陶罐 / 木桶 / 花盆');
      ground(g, 470); ground(g, 930);
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
        [0, 0.35, 0.7, 1].forEach((k, i) => drawChest(lg, { x: 220 + i * 300, y: 470, s: 1.5, open: k, burst: i === 3 ? 0.85 : 0, t: T }));
        drawChest(lg, { x: 1530, y: 470, s: 1.25, big: true, open: 1, burst: 0.6, t: T });
        drawPot(lg, { x: 200, y: 930, s: 1.5, open: 0, t: T });
        drawPot(lg, { x: 450, y: 930, s: 1.5, open: 0.75, t: T });
        drawBarrel(lg, { x: 760, y: 930, s: 1.4, open: 0, t: T });
        drawBarrel(lg, { x: 1030, y: 930, s: 1.4, open: 0.7, t: T });
        drawFlowerPot(lg, { x: 1360, y: 930, s: 1.5, open: 0, t: T });
        drawFlowerPot(lg, { x: 1640, y: 930, s: 1.5, open: 0.8, t: T });
      });
      ['open 0', 'open 0.35', 'open 0.7', 'open 1 + burst'].forEach((s, i) => label(g, s, 220 + i * 300, 520));
      label(g, 'big, open 1', 1530, 520);
      ['pot 0', 'pot 0.75', 'barrel 0', 'barrel 0.7', 'flowerpot 0', 'flowerpot 0.8'].forEach((s, i) => label(g, s, [200, 450, 760, 1030, 1360, 1640][i], 980));
    },
  },
  {
    id: 'sheet_village_anim', start: 4, end: 6,
    draw(g, T, lt, ctx) {
      bg(g, 'props/village · 动态：开箱循环（osc 2s）、图标弹入（pop）');
      ground(g, 560);
      const k = osc(lt, 2);
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
        drawChest(lg, { x: 260, y: 560, s: 1.6, open: k, burst: clamp(k * 1.4 - 0.4), t: T });
        drawChest(lg, { x: 640, y: 560, s: 1.25, big: true, open: k, burst: clamp(k * 1.4 - 0.4), t: T });
        drawPot(lg, { x: 980, y: 560, s: 1.6, open: k, t: T });
        drawBarrel(lg, { x: 1280, y: 560, s: 1.5, open: k, t: T });
        drawFlowerPot(lg, { x: 1620, y: 560, s: 1.6, open: k, t: T });
        ICONS.forEach((n, i) => drawMishearIcon(lg, n, { x: 300 + i * 330, y: 830, s: 1.1, t: T, pop: clamp((lt % 2) * 2.2 - i * 0.18), glow: 0.7 }));
      });
      label(g, 'open = osc(t, 2s)', 960, 620);
    },
  },
];
