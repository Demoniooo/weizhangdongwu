// 模型图：小蜥蜴（src/rigs/dragon.js 的 drawLizard）。
//   [0,1) 全部姿态（s=4，朝右）   [1,2) 朝左版 + 迷你名字牌两种尺寸 + 与巨龙 popped=13 对比 + 肩上 / 围巾里
//   [2,4) 动态：窜、爬、领舞、点头、睡觉呼吸
import { PAL, rr, cut, blob } from '../core/paper.js';
import { rgba, mixHex } from '../core/util.js';
import { glyphRow } from '../ui/type.js';
import { drawLizard, LIZARD_POSES, drawDragon } from '../rigs/dragon.js';

const W = 1920, H = 1080;
const label = (g, text, x, y, size = 24, o = {}) => glyphRow(g, [...text], x, y, size, { family: 'play', fill: PAL.ink, edge: null, align: 'center', gap: 1, ...o });
function bg(g, title, sub) {
  g.fillStyle = PAL.paper; g.fillRect(0, 0, W, H);
  label(g, title, 960, 44, 38, { family: 'display', fill: PAL.dragonDeep });
  if (sub) label(g, sub, 960, 84, 22, { fill: PAL.inkSoft });
}
function card(g, x, y, w, h) {
  cut(g, rr(x, y, w, h, 16), PAL.paper2, { shadow: 3 });
  g.save(); g.strokeStyle = rgba(PAL.inkSoft, 0.35); g.lineWidth = 2; g.setLineDash([10, 8]); g.stroke(rr(x + 7, y + 7, w - 14, h - 14, 10)); g.restore();
}
function groundLine(g, x0, x1, y, s) {
  g.save();
  g.strokeStyle = rgba(PAL.woodDark, 0.55); g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
  // 60·s 长度标尺
  g.strokeStyle = rgba(PAL.red, 0.7); g.lineWidth = 3;
  g.beginPath(); g.moveTo(x0 + 14, y + 14); g.lineTo(x0 + 14 + 60 * s, y + 14); g.moveTo(x0 + 14, y + 8); g.lineTo(x0 + 14, y + 20); g.moveTo(x0 + 14 + 60 * s, y + 8); g.lineTo(x0 + 14 + 60 * s, y + 20); g.stroke();
  g.restore();
}

export default [
  {
    id: 'sheet_lizard_poses', start: 0, end: 1,
    draw(g, T, lt, ctx) {
      bg(g, '小蜥蜴 · 全部姿态（s = 4，朝右）', '红色标尺 = 全长 60 × s；虚线底 = 脚底线；peek 的红点 = paw，ride 的 y = 肩线，hideScarf 的 y = 围巾上沿');
      const names = Object.keys(LIZARD_POSES);
      const cols = 5, cw = 360, ch = 300, gx = 14, x0 = (W - cols * cw - (cols - 1) * gx) / 2, y0 = 112;
      names.forEach((nm, i) => {
        const cx = x0 + (i % cols) * (cw + gx), cy = y0 + Math.floor(i / cols) * (ch + 14);
        card(g, cx, cy, cw, ch);
        const fx = cx + cw / 2 - 10, fy = cy + ch - 70;
        groundLine(g, cx + 14, cx + cw - 14, fy, 4);
        if (nm === 'ride') { g.save(); g.fillStyle = PAL.heroBlue; g.fill(rr(cx + 60, fy, 240, 40, 18)); g.restore(); }
        if (nm === 'hideScarf') { g.save(); g.fillStyle = PAL.scarf; g.fill(rr(cx + 60, fy - 4, 240, 46, 20)); g.restore(); }
        ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => {
          const a = drawLizard(lg, { pose: nm, x: fx, y: fy, s: 4, t: T, seed: i, miniPlate: nm === 'sit' || nm === 'pout' });
          if (nm === 'peek' && a.paw) { lg.fillStyle = PAL.red; lg.beginPath(); lg.arc(a.paw[0], a.paw[1], 5, 0, Math.PI * 2); lg.fill(); }
        });
        if (nm === 'hideScarf') { g.save(); g.fillStyle = mixHex(PAL.scarf, PAL.scarfDark, 0.3); g.fill(rr(cx + 60, fy + 4, 240, 38, 18)); g.restore(); }
        label(g, nm, cx + cw / 2, cy + ch - 30, 26, { family: 'latin', weight: 600 });
      });
    },
  },
  {
    id: 'sheet_lizard_misc', start: 1, end: 2,
    draw(g, T, lt, ctx) {
      bg(g, '小蜥蜴 · 朝向 / 迷你名字牌 / 与巨龙缩小版对比', 'face=−1（B12 诞生时朝左）；迷你名字牌：屏幕字高 ≥ 6px 时滚字，否则画点纹纸带');
      // 朝左一排
      card(g, 40, 110, 1840, 300);
      ['sit', 'pout', 'peek', 'scurry', 'sleep'].forEach((nm, i) => {
        ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => drawLizard(lg, { pose: nm, x: 230 + i * 360, y: 360, s: 3.4, face: -1, t: T, miniPlate: nm === 'pout' }));
        label(g, nm + ' · face −1', 230 + i * 360, 392, 22, { family: 'latin', weight: 600 });
      });
      // 迷你名字牌两种尺寸
      card(g, 40, 430, 900, 540);
      ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
        drawLizard(lg, { pose: 'sit', x: 300, y: 900, s: 6, t: T, miniPlate: true });
        drawLizard(lg, { pose: 'sit', x: 700, y: 900, s: 1.8, t: T, miniPlate: true });
        drawLizard(lg, { pose: 'sit', x: 820, y: 900, s: 1, t: T, miniPlate: true });
      });
      label(g, 's = 6（滚字）· s = 1.8 · s = 1（点纹纸带）', 490, 945, 22);
      // 与巨龙 popped = 13 对比（剧场台面）
      card(g, 960, 430, 920, 540);
      ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
        lg.save();
        lg.strokeStyle = rgba(PAL.woodDark, 0.6); lg.lineWidth = 4; lg.beginPath(); lg.moveTo(990, 880); lg.lineTo(1850, 880); lg.stroke();
        lg.translate(1180 - 1450 * 2.6, 880 - 840 * 2.6); lg.scale(2.6, 2.6);
        drawDragon(lg, { pose: 'shrink', popped: 13, t: T });
        lg.restore();
        drawLizard(lg, { pose: 'sit', x: 1500, y: 880, s: 2.45 * 2.6, face: -1, t: T, miniPlate: true });
        drawLizard(lg, { pose: 'pout', x: 1740, y: 880, s: 2.45 * 2.6, face: -1, t: T });
      });
      label(g, 'shrink popped=13 与 drawLizard s=2.45 头宽相同（图中 ×2.6 放大）', 1420, 945, 22);
    },
  },
  {
    id: 'sheet_lizard_dyn', start: 2, end: 4,
    draw(g, T, lt, ctx) {
      bg(g, '小蜥蜴 · 动态循环', `t = ${T.toFixed(2)}`);
      card(g, 40, 110, 1840, 860);
      const base = 600;
      groundLine(g, 60, 1860, base, 5);
      ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
        const run = ((T - 2) * 260) % 1500;
        drawLizard(lg, { pose: 'scurry', x: 200 + run, y: base, s: 5, t: T });
        drawLizard(lg, { pose: 'lead', x: 380, y: 920, s: 5, t: T });
        drawLizard(lg, { pose: 'nod', x: 820, y: 920, s: 5, t: T, miniPlate: true });
        drawLizard(lg, { pose: 'sleep', x: 1250, y: 920, s: 5, t: T });
        // 爬：沿一面竖墙往上
        lg.fillStyle = mixHex(PAL.wood, PAL.paper2, 0.4); lg.fill(rr(1640, 640, 60, 320, 8));
        drawLizard(lg, { pose: 'climb', x: 1640, y: 940 - ((T - 2) * 120) % 260, s: 4.5, t: T });
      });
      ['scurry', 'lead', 'nod', 'sleep', 'climb'].forEach((n, i) => label(g, n, [960, 380, 820, 1250, 1640][i], [640, 950, 950, 950, 950][i], 22, { family: 'latin', weight: 600 }));
      void blob;
    },
  },
];
