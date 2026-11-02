// 模型图：src/props/paper.js —— 告示、卷轴（竖挂 / 平铺）、圣旨、大纸卷（侧视 / 端视 / 碾过镜头）、纸卷塔、无限卷轴、片尾贴签。
import { PAL, blob, cut, lin } from '../core/paper.js';
import { clamp, lerp, osc, rgba, fract, mixHex } from '../core/util.js';
import { inOutCubic, outBack, ez } from '../core/ease.js';
import { glyphRow } from '../ui/type.js';
import { NAMES, CUES } from '../cues.js';
import { drawNotice, drawScroll, drawDecree, drawPaperRoll, rollOverCameraY, drawScrollTower, drawInfiniteScroll, drawCreditLabel, NOTICE } from '../props/paper.js';

const label = (g, text, x, y, size = 22, col = PAL.inkSoft) => glyphRow(g, text, x, y, size, { family: 'play', fill: col, edge: null, align: 'center', gap: 0 });
const bg = (g, title) => { g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080); label(g, title, 960, 40, 28, PAL.ink); };
const board = (lg, x, y) => {
  cut(lg, blob(x, y, 175, 128, { seed: 3, amp: 0.01 }), PAL.wood, { rim: mixHex(PAL.wood, PAL.sand, 0.4) });
};
const H = NAMES.heroParts, DR = NAMES.dragonParts;

export default [
  {
    id: 'sheet_paper_notice', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      bg(g, 'props/paper · drawNotice（280×200）：正面 / 翻面 flip .35 · .65 / 背面回调 / unroll / corners / 图钉按下');
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
        board(lg, 260, 300);
        drawNotice(lg, { x: 260, y: 300, t: T, pins: 2 });
        drawNotice(lg, { x: 660, y: 300, t: T, flip: 0.35 });
        drawNotice(lg, { x: 1020, y: 300, t: T, flip: 0.65, back: (bg2, { w, h }) => {
          bg2.strokeStyle = PAL.scarf; bg2.lineWidth = 5; bg2.setLineDash([14, 10]);
          bg2.beginPath(); bg2.moveTo(-w / 2 + 30, h / 2 - 40); bg2.bezierCurveTo(-40, -60, 30, 60, w / 2 - 30, -h / 2 + 40); bg2.stroke();
        } });
        drawNotice(lg, { x: 1420, y: 300, t: T, face: 'back' });
        board(lg, 260, 760);
        drawNotice(lg, { x: 260, y: 760, t: T, unroll: osc(lt, 2), pins: 2 });
        board(lg, 660, 760);
        drawNotice(lg, { x: 660, y: 760, t: T, corners: true });
        drawNotice(lg, { x: 1060, y: 760, t: T, pins: clamp(lt * 2) * 2, squash: Math.max(0, Math.sin(Math.min(1, lt * 3) * Math.PI)) * 0.12 });
        drawNotice(lg, { x: 1560, y: 780, s: 1.6, t: T, rot: -0.12 + 0.06 * Math.sin(T) });
      });
      label(g, 'front pins 2', 260, 450); label(g, 'flip .35', 660, 450); label(g, 'flip .65 + back()', 1020, 450); label(g, "face 'back'", 1420, 450);
      label(g, 'unroll osc', 260, 910); label(g, 'corners', 660, 910); label(g, 'pins 0→2 + squash', 1060, 910); label(g, 's 1.6（扑镜放大）', 1560, 1000);
    },
  },
  {
    id: 'sheet_paper_scroll', start: 2, end: 4,
    draw(g, T, lt, ctx) {
      bg(g, 'props/paper · drawScroll：竖挂（逐行写出金墨字 + 页边旧笔记）/ 平铺在地向右滚（涂鸦 + 红叉章 + 龙名）/ dir −1 向左滚');
      const len = lerp(140, 470, inOutCubic(clamp(lt / 0.5)));
      const rows = H.map((chars, i) => ({ chars, p: clamp((lt - 0.4 - i * 0.5) / 0.45), size: 54 }));
      const roll = lerp(120, 1180, clamp(lt / 1.9));
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
        drawScroll(lg, { x: 300, y: 110, orient: 'v', len, width: 320, rows, notes: 1, t: T });
        drawScroll(lg, { x: 700, y: 140, s: 0.55, orient: 'v', len: 420, width: 300, rows: [{ chars: H[0], p: 1, size: 54, fill: PAL.ink, under: rgba(PAL.ink, 0.25) }], notes: 1, doodle: { y: 300, p: 1, stampX: clamp((lt - 1) * 3) }, t: T });
        drawScroll(lg, { x: 620, y: 840, orient: 'h', len: roll, width: 130, t: T, notes: 0.6, items: [
          { kind: 'doodle', at: 140, p: 1, size: 0.9 },
          { kind: 'cross', at: 175, p: clamp((roll - 300) / 160), size: 110 },
          { kind: 'text', at: 330, chars: DR[0], size: 62 },
          { kind: 'text', at: 330 + 8 * 52, chars: DR[1], size: 62 },
        ] });
        const lenL = lerp(120, 840, clamp(lt / 1.9));
        drawScroll(lg, { x: 1820, y: 420, orient: 'h', dir: -1, len: lenL, width: 120, t: T, notes: 0.6, items: [
          { kind: 'text', at: 60, chars: H[0], size: 60 },
          { kind: 'doodle', at: 470, p: 1, size: 0.8 },
          { kind: 'cross', at: 500, p: clamp((lenL - 600) / 140), size: 100 },
          { kind: 'dots', at: 640, to: 820 },
        ] });
      });
      label(g, "dir −1：纸向左展开，字与涂鸦仍正读", 1420, 520);
      label(g, `竖挂 orient 'v'，len ${len.toFixed(0)}，rows 逐行写出`, 300, 1030 - 380);
      label(g, '小尺寸 s .55 + doodle + stampX', 700, 420);
      label(g, `平铺 orient 'h'，len = ${roll.toFixed(0)}（卷筒随之向右滚）`, 1180, 960);
    },
  },
  {
    id: 'sheet_paper_decree', start: 4, end: 6,
    draw(g, T, lt, ctx) {
      bg(g, 'props/paper · drawDecree：展开 + 三段金印（N4a/b/c）/ 吊成横幅 + 扫光 · drawPaperRoll：侧视 / 端视 / 弹台阶挤压');
      const Tn = lerp(CUES.N4a - 0.1, CUES.N4c + 0.29, clamp(lt / 1.9));   // 默认 prints = CUES.N4a/N4b/N4c
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
        drawDecree(lg, { x: 120, y: 200, len: 900, width: 180, unroll: clamp((Tn - (CUES.N4a - 0.05)) / 0.25), t: Tn });
        drawDecree(lg, { x: 1140, y: 300, s: 0.66, len: 1000, width: 130, unroll: 1, hung: 1, t: 60, sweep: fract(lt / 1.6) * 1.3 - 0.15 });
        drawPaperRoll(lg, { x: 380, y: 720, r: 110, len: 380, spin: lt * 3, t: lt, bounceAt: [0.5, 1.1] });
        drawPaperRoll(lg, { x: 860, y: 720, r: 110, view: 'end', spin: lt * 3, t: lt });
        drawPaperRoll(lg, { x: 1400, y: 760, r: 150, len: 640, spin: -lt * 2.2, t: lt });
      });
      label(g, `t = ${Tn.toFixed(2)}（印 N4a ${CUES.N4a.toFixed(2)} / N4b ${CUES.N4b.toFixed(2)} / N4c ${CUES.N4c.toFixed(2)}）`, 570, 330);
      label(g, 'hung 1 + sweep', 1470, 400);
      label(g, 'side + bounceAt', 380, 870); label(g, "view 'end'", 860, 870); label(g, 'side r150 len640', 1400, 950);
    },
  },
  {
    id: 'sheet_paper_overcam', start: 6, end: 8,
    draw(g, T, lt, ctx) {
      // 碾过镜头：卷筒上方是“前一画面”，下方由遮罩画“片名页”
      const p = clamp(lt / 1.8);
      g.fillStyle = PAL.paper2; g.fillRect(0, 0, 1920, 1080);
      label(g, 'props/paper · drawPaperRoll overCamera：横贯全屏的纸卷从下沿滚到上沿（rollOverCameraY(p) 给遮罩用的 y）', 960, 40, 26, PAL.ink);
      for (let i = 0; i < 8; i++) { g.fillStyle = rgba(PAL.red, 0.25); g.fillRect(100 + i * 230, 200, 140, 600); }
      const res = rollOverCameraY(p);   // 只算不画：先遮罩，再在最上层画纸卷
      ctx.mask(g, (mg) => mg.fillRect(0, res.y, 1920, 1200), (lg) => {
        lg.fillStyle = PAL.redDeep; lg.fillRect(0, 0, 1920, 1080);
        lg.strokeStyle = PAL.gold; lg.lineWidth = 6; lg.strokeRect(60, 60, 1800, 960);
        glyphRow(lg, '达拉崩吧', 960, 560, 260, { align: 'center', fill: PAL.red, edge: PAL.paper, edgeW: 0.09 });
      });
      ctx.layer(g, { shadow: 10, texture: 0.25 }, (lg) => { drawPaperRoll(lg, { overCamera: p, t: lt }); });
      label(g, `overCamera = ${p.toFixed(2)}  y = ${res.y.toFixed(0)}`, 960, 1050, 22, PAL.goldLight);
    },
  },
  {
    id: 'sheet_paper_tower', start: 8, end: 10,
    draw(g, T, lt, ctx) {
      bg(g, 'props/paper · drawScrollTower（tilt 摇晃 / topple 倒塌）· drawInfiniteScroll（透视变窄、远处点纹）· drawCreditLabel（滑入 + 逐行）');
      g.strokeStyle = rgba(PAL.inkSoft, 0.35); g.setLineDash([10, 8]); g.beginPath(); g.moveTo(80, 560); g.lineTo(900, 560); g.stroke(); g.setLineDash([]);
      const path = [];
      for (let i = 0; i <= 10; i++) { const u = i / 10; path.push([980 + u * 900, 980 - u * 520 + Math.sin(u * 5) * 30, lerp(110, 10, Math.pow(u, 0.7))]); }
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
        drawScrollTower(lg, { x: 230, y: 450, tilt: 1, t: T, groundY: 110 });
        drawScrollTower(lg, { x: 620, y: 450, tilt: 1, t: T, topple: clamp((lt - 0.2) / 1.5), groundY: 110 });
        drawInfiniteScroll(lg, path, { p: clamp(0.25 + lt / 1.6), width: 110, t: T });
        drawCreditLabel(lg, { x: 470, y: 820, p: clamp(lt / 0.6), lines: clamp((lt - 0.5) / 1.2) * 4 });
      });
      label(g, 'tilt 1', 230, 600); label(g, 'topple 0→1', 620, 600); label(g, 'infinite scroll（w 110→10）', 1500, 1040);
    },
  },
];
