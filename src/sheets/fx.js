// 模型图 fx：转场与冲击（src/fx/transitions.js）。
//   [0, 2)  动态九宫格：每格一个转场循环播放（看运动是否连贯、纸边是否稳定）
//   [2, 3)  第 1 页：甩镜帘 ×2、心形遮罩、圆形羽化（各 6 个中间帧，A/B 两块纯色画面）
//   [3, 4)  第 2 页：杏仁洞口、圆窗拉出（挖洞）、翻页、灰烟
//   [4, 5)  第 3 页：燃烧边、撕纸、撕纸分屏、左冷右暖
//   [5, 6)  第 4 页：冲击四级对照（−1 / 0 / +1 / +2 / +4 / +8 帧）
//   [6, 7)  第 5 页：速度线、其余遮罩形状、甩镜四个方向
//   [7, 9)  实拍：整帧冲击 S / M / L / MAX 真写 ctx.fx（震动 + 闪白 + 放射线）
import { PAL, rr, cut, blob, shade, lin } from '../core/paper.js';
import { clamp, seg, rgba, mixHex } from '../core/util.js';
import { whip, outCubic, inOutCubic, inOutSine, outExpo } from '../core/ease.js';
import { glyphRow, paperGlyph } from '../ui/type.js';
import {
  whipCurtain, shapeReveal, coverSize, pageTurn, smokeWipe, burnEdge, paperTear, splitScreen, colorSplit,
  impact, impactRays, IMPACT, speedLines,
} from '../fx/transitions.js';

const FW = 1920, FH = 1080;
const A_COL = PAL.skyDay, B_COL = PAL.dragonDark;

// ———————————————————— 测试画面 ————————————————————
function plate(g, col, letter, dx = 0) {
  g.fillStyle = col;
  g.fillRect(-40 + dx, -40, FW + 80, FH + 80);
  g.save();
  g.strokeStyle = rgba(PAL.white, 0.35);
  g.lineWidth = 6;
  g.strokeRect(70 + dx, 70, FW - 140, FH - 140);
  for (const [x, y] of [[70, 70], [FW - 70, 70], [70, FH - 70], [FW - 70, FH - 70]]) {
    g.fillStyle = rgba(PAL.white, 0.5);
    g.beginPath(); g.arc(x + dx, y, 16, 0, Math.PI * 2); g.fill();
  }
  paperGlyph(g, letter, 960 + dx, 540, 560, { family: 'latin', weight: 700, fill: rgba(PAL.white, 0.9), edge: null });
  g.restore();
}
const sceneA = (g, info) => plate(g, A_COL, 'A', info && info.dx ? info.dx : 0);
const sceneB = (g, info) => plate(g, B_COL, 'B', info && info.dx ? info.dx : 0);
/** 有明暗层次的测试画面（看调色）：灰渐变 + 白 / 肤 / 墨三个圆。 */
function sceneTone(g) {
  g.fillStyle = lin(g, 0, 0, 0, FH, [PAL.stone, PAL.stoneDark]);
  g.fillRect(-40, -40, FW + 80, FH + 80);
  cut(g, blob(480, 560, 230, 230, { seed: 2 }), PAL.white, { shadow: 10 });
  cut(g, blob(960, 560, 230, 230, { seed: 3 }), PAL.skin, { shadow: 10 });
  cut(g, blob(1440, 560, 230, 230, { seed: 4 }), PAL.ink, { shadow: 10 });
  paperGlyph(g, '冷', 300, 210, 150, { family: 'display', fill: PAL.paper, edge: PAL.ink, edgeW: 0.05 });
  paperGlyph(g, '暖', 1620, 210, 150, { family: 'display', fill: PAL.paper, edge: PAL.ink, edgeW: 0.05 });
}
/** 燃烧边测试用的纸面板（kit 还没好时的占位：奶油卡纸 + 墨框 + 缝线 + 5 格）。 */
function testPanel(g) {
  const x = 330, y = 230, w = 1260, h = 620;
  cut(g, rr(x, y, w, h, 26), PAL.paper, { stroke: PAL.ink, lw: 8, rim: PAL.white });
  g.save();
  g.setLineDash([22, 16]); g.strokeStyle = PAL.kraftDark; g.lineWidth = 4;
  g.stroke(rr(x + 24, y + 24, w - 48, h - 48, 16));
  g.restore();
  const cols = [PAL.heart, PAL.wood, PAL.coin, PAL.ice, PAL.heroBlue];
  for (let i = 0; i < 5; i++) {
    const cx = x + 150 + i * 240;
    cut(g, rr(cx - 95, y + 150, 190, 260, 18), PAL.paper2, { stroke: PAL.inkSoft, lw: 4 });
    cut(g, blob(cx, y + 280, 64, 64, { seed: 10 + i }), cols[i], { rim: mixHex(cols[i], PAL.white, 0.4) });
  }
  glyphRow(g, '道具', x + 60, y + 80, 64, { family: 'play', fill: PAL.ink, edge: null });
}

// ———————————————————— 排版小工具 ————————————————————
const ink = (g, text, x, y, size, o = {}) => glyphRow(g, text, x, y, size, { family: 'play', fill: PAL.ink, edge: null, baseline: true, ...o });
const latin = (g, text, x, y, size, o = {}) => glyphRow(g, text, x, y, size, { family: 'latin', weight: 600, fill: PAL.ink, edge: null, gap: size * 0.01, baseline: true, ...o });

/** 一个缩略格：把整帧（1920×1080）缩进 (x, y, w) 的格子里画，外加纸卡底与墨框。 */
function thumb(g, x, y, w, fn) {
  const s = w / FW, h = FH * s;
  cut(g, rr(x - 5, y - 5, w + 10, h + 10, 6), PAL.paper2, { shadow: 4 });
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.translate(x, y); g.scale(s, s);
  fn(g);
  g.restore();
  g.strokeStyle = rgba(PAL.ink, 0.75); g.lineWidth = 2; g.strokeRect(x, y, w, h);
  return h;
}
function background(g, title, sub) {
  g.fillStyle = PAL.paper; g.fillRect(0, 0, FW, FH);
  ink(g, title, 60, 44, 40);
  latin(g, sub, 60 + 40 * title.length * 0.98 + 30, 46, 26, { fill: PAL.inkSoft, weight: 500 });
}
/** 一行 6 个中间帧。ps：进度数组；fn(g, p, i) 画一帧。 */
function row(g, y, name, note, ps, fn, lab = (p) => `p ${p.toFixed(2)}`) {
  latin(g, name, 60, y + 14, 28, { fill: PAL.redDark, weight: 700 });
  ink(g, note, 60 + name.length * 15.5 + 24, y + 14, 24, { fill: PAL.inkSoft });
  const w = 288, gap = (FW - 120 - 6 * w) / 5;
  for (let i = 0; i < ps.length; i++) {
    const x = 60 + i * (w + gap);
    const h = thumb(g, x, y + 34, w, (tg) => fn(tg, ps[i], i));
    latin(g, lab(ps[i], i), x + 4, y + 34 + h + 18, 18, { fill: PAL.inkSoft, weight: 500 });
  }
}
const SIX = [1, 2, 3, 4, 5, 6].map((k) => k / 7);

// ———————————————————— 各转场的“给定进度画一帧” ————————————————————
const DEMO = {
  whipDown: (ctx) => (g, p) => { sceneA(g); whipCurtain(ctx, g, 0, { p, dir: 'down', colors: [A_COL, B_COL] }, sceneB); },
  whipRight: (ctx) => (g, p) => { sceneA(g); whipCurtain(ctx, g, 0, { p, from: 'right', colors: [A_COL, B_COL] }, sceneB); },
  whipLeft: (ctx) => (g, p) => { sceneA(g); whipCurtain(ctx, g, 0, { p, dir: 'left', colors: [A_COL, B_COL] }, sceneB); },
  whipUp: (ctx) => (g, p) => { sceneA(g); whipCurtain(ctx, g, 0, { p, dir: 'up', colors: [A_COL, B_COL] }, sceneB); },
  heart: (ctx) => {
    const end = coverSize('heart', { cx: 1400, cy: 560 });
    return (g, p) => {
      sceneA(g);
      const k = inOutCubic(p);
      shapeReveal(ctx, g, 'heart', { cx: 1100 + 300 * k, cy: 600 - 40 * k, size: 300 * (end / 300) ** k }, sceneB);
    };
  },
  circleFeather: (ctx) => (g, p) => { sceneA(g); shapeReveal(ctx, g, 'circle', { cx: 960, cy: 540, r: 1150 * outCubic(p), feather: 40 }, sceneB); },
  almond: (ctx) => {
    const end = coverSize('almond', { cx: 960, cy: 540 });
    return (g, p) => { sceneA(g); shapeReveal(ctx, g, 'almond', { cx: 960, cy: 540, size: 360 * (end / 360) ** (p ** 1.6) }, sceneB); };
  },
  circleOut: (ctx) => (g, p) => { sceneB(g); shapeReveal(ctx, g, 'circle', { cx: 960, cy: 540, r: 1150 * (70 / 1150) ** inOutSine(p), invert: true, outline: 10, outlineColor: PAL.goldLight }, sceneA); },
  pageTurn: (ctx) => (g, p) => { sceneA(g); pageTurn(ctx, g, 0, { p }, sceneB); },
  smoke: () => (g, p) => { if (p < 0.5) sceneA(g); else sceneB(g); smokeWipe(g, 0, { p, x: 1250, y: 600 }); },
  burn: (ctx) => (g, p, t = p) => { sceneA(g); burnEdge(ctx, g, { x: 330, y: 230, w: 1260, h: 620 }, p, { draw: testPanel, t, dur: 0.6 }); },
  tear: () => (g, p) => { sceneA(g); paperTear(g, [[760, 250], [980, 520], [1180, 780]], p, { width: 150, inside: (tg) => sceneB(tg) }); },
  split: (ctx) => (g, p) => { g.fillStyle = PAL.ink; g.fillRect(0, 0, FW, FH); splitScreen(ctx, g, { enter: outExpo(p), x: 960 }, sceneA, sceneB); },
  colorSplit: (ctx) => (g, p) => { sceneTone(g); colorSplit(ctx, g, 560 + 800 * p, { alpha: 0.5, seam: 0.6 }); },
};

// ———————————————————— 冲击一格（不写 fx，格内模拟震动与闪白） ————————————————————
function impactCell(g, T, at, level, scene = sceneTone) {
  const r = impact(null, T, at, level, { apply: false });
  g.save();
  g.translate(r.shake[0], r.shake[1]);
  scene(g);
  impactRays(g, T, at, level, { x: 960, y: 540 });
  g.restore();
  if (r.flash > 0) {
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = Math.min(1, r.flash); g.fillStyle = PAL.white; g.fillRect(0, 0, FW, FH); g.restore();
  }
  return r;
}

// ———————————————————— 整帧检查镜头 ————————————————————
function tag(g, name, note) {
  cut(g, rr(60, 960, 1800, 84, 18), rgba(PAL.paper, 0.92), { stroke: PAL.ink, lw: 3, shadow: 6 });
  latin(g, name, 92, 1002, 34, { fill: PAL.redDark, weight: 700 });
  ink(g, note, 92 + name.length * 19 + 30, 1002, 30, { fill: PAL.inkSoft });
}
function FULL_SHOTS() {
  const S = (id, start, name, note, fn) => ({ id, start, end: start + 1, draw(g, T, lt, ctx) { fn(g, T, lt, ctx); tag(g, name, note); } });
  return [
    S('fx_full_whip_down', 10, 'whipCurtain', "dir:'down'  t0 10.1  t1 10.7", (g, T, lt, ctx) => { sceneA(g); whipCurtain(ctx, g, T, { t0: 10.1, t1: 10.7, dir: 'down', colors: [A_COL, B_COL] }, sceneB); }),
    S('fx_full_whip_right', 11, 'whipCurtain', "from:'right'  t0 11.1  t1 11.7", (g, T, lt, ctx) => { sceneA(g); whipCurtain(ctx, g, T, { t0: 11.1, t1: 11.7, from: 'right', colors: [A_COL, PAL.goldLight] }, sceneB); }),
    S('fx_full_heart', 12, 'shapeReveal', "'heart' 由 (1100,600) 高 300 放大", (g, T, lt, ctx) => { DEMO.heart(ctx)(g, seg(lt, 0.1, 0.9)); }),
    S('fx_full_page', 13, 'pageTurn', 't0 13.1  t1 13.9', (g, T, lt, ctx) => { sceneA(g); pageTurn(ctx, g, T, { t0: 13.1, t1: 13.9 }, sceneB); }),
    S('fx_full_smoke', 14, 'smokeWipe', 't0 14.1  t1 14.9（14.5 盖满时换画面）', (g, T, lt, ctx) => { if (T < 14.5) sceneA(g); else sceneB(g); smokeWipe(g, T, { t0: 14.1, t1: 14.9, x: 1250, y: 600 }); }),
    S('fx_full_burn', 15, 'burnEdge', 'p = (T - 15.1) / 0.6，dur 0.6', (g, T, lt, ctx) => { sceneA(g); burnEdge(ctx, g, { x: 330, y: 230, w: 1260, h: 620 }, Math.max(0, (T - 15.1) / 0.6), { draw: testPanel, t: T, dur: 0.6 }); }),
    S('fx_full_tear', 16, 'paperTear', 'p = seg(T, 16.1, 16.8)', (g, T, lt, ctx) => { sceneA(g); paperTear(g, [[760, 250], [980, 520], [1180, 780]], seg(T, 16.1, 16.8), { width: 150, inside: (tg) => sceneB(tg) }); }),
    S('fx_full_split', 17, 'splitScreen', 'enter = outExpo(seg(T, 17.1, 17.6))', (g, T, lt, ctx) => { g.fillStyle = PAL.ink; g.fillRect(0, 0, FW, FH); splitScreen(ctx, g, { enter: outExpo(seg(T, 17.1, 17.6)) }, sceneA, sceneB); }),
    S('fx_full_color', 18, 'colorSplit', 'x 随时间移动，seam 0.6', (g, T, lt, ctx) => { sceneTone(g); colorSplit(ctx, g, 560 + 800 * lt, { alpha: 0.5, seam: 0.6 }); }),
    S('fx_full_speed', 19, 'speedLines', "'h' t = T（白）+ 'v' 带状金线", (g, T, lt, ctx) => { sceneB(g); speedLines(g, 'h', { x: 0, y: 0, w: 1920, h: 520 }, { t: T }); speedLines(g, 'v', { x: 0, y: 540, w: 1920, h: 400 }, { t: T, density: 5, colors: [PAL.goldLight, PAL.white], sign: -1, mask: (c) => Math.exp(-(((c - 0.5) / 0.22) ** 2)), shadow: 1 }); }),
  ];
}

// ———————————————————— 镜头 ————————————————————
export default [
  {
    id: 'fx_live_grid', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      background(g, '转场与冲击 · 动态九宫格', 'fx · loop 2s');
      const cells = [
        ['whipCurtain', (tg) => DEMO.whipDown(ctx)(tg, whip(seg(lt, 0.25, 1.55)))],
        ['shapeReveal heart', (tg) => DEMO.heart(ctx)(tg, seg(lt, 0.2, 1.6))],
        ['pageTurn', (tg) => DEMO.pageTurn(ctx)(tg, inOutSine(seg(lt, 0.2, 1.6)))],
        ['smokeWipe', (tg) => DEMO.smoke()(tg, seg(lt, 0.15, 1.75))],
        ['burnEdge', (tg) => DEMO.burn(ctx)(tg, seg(lt, 0.15, 0.75) * 1 + Math.max(0, lt - 0.75) / 0.6, lt)],
        ['paperTear', (tg) => DEMO.tear()(tg, seg(lt, 0.2, 1.4))],
        ['splitScreen', (tg) => DEMO.split(ctx)(tg, seg(lt, 0.2, 1.0))],
        ['colorSplit', (tg) => { sceneTone(tg); colorSplit(ctx, tg, 960 + Math.sin(lt * Math.PI) * 360, { alpha: 0.5, seam: 0.6 }); }],
        ['impact MAX', (tg) => impactCell(tg, lt, 0.4, 'MAX')],
      ];
      // 三行九格：格宽 500（高 281），行距 326，第三行的名字标签落在 y≈1037，不出画
      const w = 500;
      cells.forEach(([name, fn], i) => {
        const cx = 110 + (i % 3) * 600, cy = 84 + Math.floor(i / 3) * 326;
        const h = thumb(g, cx, cy, w, fn);
        latin(g, name, cx + 2, cy + h + 20, 22, { fill: PAL.redDark, weight: 700 });
      });
    },
  },
  {
    id: 'fx_page1', start: 2, end: 3,
    draw(g, T, lt, ctx) {
      background(g, '转场模型图 1/5', 'A = skyDay, B = dragonDark');
      row(g, 92, 'whipCurtain', "dir:'down'（b02 到 b03：竖向甩镜，带从下往上）", SIX.map(whip), DEMO.whipDown(ctx));
      row(g, 332, 'whipCurtain', "from:'right'（b09 到 b10：带从右往左）", SIX.map(whip), DEMO.whipRight(ctx));
      row(g, 572, 'shapeReveal', "'heart'（b03 到 b04：心 (1100,600) 高 300 放大到满屏，描边 = size x 0.04）", SIX, DEMO.heart(ctx));
      row(g, 812, 'shapeReveal', "'circle' feather 40（b14 到 b15：半径 0 到 1150）", SIX, DEMO.circleFeather(ctx));
    },
  },
  {
    id: 'fx_page2', start: 3, end: 4,
    draw(g, T, lt, ctx) {
      background(g, '转场模型图 2/5', 'shapeReveal / pageTurn / smokeWipe');
      row(g, 92, 'shapeReveal', "'almond'（b08 到 b09：洞口 520 x 360 放大到满屏）", SIX, DEMO.almond(ctx));
      row(g, 332, 'shapeReveal', "'circle' invert（b17 圆窗拉出：圆里是厅内 B，圆外是夜城 A）", SIX, DEMO.circleOut(ctx));
      row(g, 572, 'pageTurn', '（b16 翻页：右下角先掀，页背 paper2 透出正面）', SIX.map(inOutSine), DEMO.pageTurn(ctx));
      row(g, 812, 'smokeWipe', '（b10 灰烟：0.5 盖满，然后向两边散开）', SIX, DEMO.smoke());
    },
  },
  {
    id: 'fx_page3', start: 4, end: 5,
    draw(g, T, lt, ctx) {
      background(g, '转场模型图 3/5', 'burnEdge / paperTear / splitScreen / colorSplit');
      row(g, 92, 'burnEdge', '（b10 道具栏从右往左烧，灰片飞散；p 可 >1）', [0.12, 0.3, 0.48, 0.66, 0.84, 1.3], DEMO.burn(ctx));
      row(g, 332, 'paperTear', '（b02 纸天撕开：先裂后张，纸片翻起露纸背）', [0.06, 0.18, 0.32, 0.5, 0.72, 1], DEMO.tear());
      row(g, 572, 'splitScreen', '（b11 撕纸分屏：两片滑入，左片压右片）', SIX, DEMO.split(ctx));
      row(g, 812, 'colorSplit', '（b11 对撞：左冷 magic 右暖 fire，分界随撞击点）', SIX, DEMO.colorSplit(ctx), (p) => `x ${Math.round(560 + 800 * p)}`);
    },
  },
  {
    id: 'fx_page4', start: 5, end: 6,
    draw(g, T, lt, ctx) {
      background(g, '冲击四级对照 4/5', 'shake 8/14/22/32 · flash 0.25/0.5/0.8/1.0');
      const fr = [-1, 0, 1, 2, 4, 8];
      ['S', 'M', 'L', 'MAX'].forEach((lv, i) => {
        const L = IMPACT[lv];
        row(g, 92 + i * 240, `impact '${lv}'`, `震动 ${L.shake} · 闪白 ${L.flash}${L.frames > 1 ? '（保持两帧）' : ''} · 放射线 ${L.rays} 条`, fr,
          (tg, f) => impactCell(tg, 1 + f / 30, 1, lv), (f) => (f < 0 ? `${f} 帧` : f === 0 ? '命中帧' : `+${f} 帧`));
      });
    },
  },
  {
    id: 'fx_page5', start: 6, end: 7,
    draw(g, T, lt, ctx) {
      background(g, '速度线 · 其余形状 · 甩镜方向 5/5', 'speedLines / shapeReveal / whipCurtain');
      const sl = [
        ['h · white', (tg) => { sceneA(tg); speedLines(tg, 'h', undefined, { t: 0.3 }); }],
        ['h · ink', (tg) => { plate(tg, PAL.skyDayLow, 'A'); speedLines(tg, 'h', undefined, { t: 0.3, colors: [PAL.ink, PAL.inkSoft], alpha: 0.55 }); }],
        ['v · white', (tg) => { sceneB(tg); speedLines(tg, 'v', undefined, { t: 0.3, density: 3 }); }],
        ['h · band', (tg) => { sceneB(tg); speedLines(tg, 'h', undefined, { t: 0.3, density: 6, colors: [PAL.goldLight, PAL.white], mask: (c) => Math.exp(-(((c - 0.5) / 0.18) ** 2)), shadow: 1 }); }],
        ['h · t+0.05', (tg) => { sceneA(tg); speedLines(tg, 'h', undefined, { t: 0.35 }); }],
        ['h · sign -1', (tg) => { sceneA(tg); speedLines(tg, 'h', undefined, { t: 0.3, sign: -1 }); }],
      ];
      row(g, 92, 'speedLines', '（手画速度线：粗头朝流动方向，t 驱动流动）', sl.map((_, i) => i), (tg, i) => sl[i][1](tg), (i) => sl[i][0]);
      const shp = [['star', 0.45], ['star', 0.8], ['keyhole', 0.45], ['keyhole', 0.8], ['rect', 0.45], ['rect', 0.8]];
      row(g, 332, 'shapeReveal', "其余形状：'star' / 'keyhole' / 'rect'（圆角 40，旋转 6°）", shp.map((_, i) => i), (tg, i) => {
        const [s, k] = shp[i];
        sceneA(tg);
        shapeReveal(ctx, tg, s, { cx: 960, cy: 540, size: 900 * k, radius: 40, rot: s === 'rect' ? 0.1 : 0, outline: 14, outlineColor: PAL.gold }, sceneB);
      }, (i) => `${shp[i][0]} ${shp[i][1]}`);
      row(g, 572, 'whipCurtain', "dir:'left'（机位向左甩，带从左边进来）", SIX.map(whip), DEMO.whipLeft(ctx));
      row(g, 812, 'whipCurtain', "dir:'up'（机位向上甩，带从上往下）", SIX.map(whip), DEMO.whipUp(ctx));
    },
  },
  {
    id: 'fx_live_impact', start: 7, end: 9,
    draw(g, T, lt, ctx) {
      sceneTone(g);
      const hits = [['S', 7.2], ['M', 7.7], ['L', 8.2], ['MAX', 8.7]];
      let cur = 'S';
      for (const [lv, at] of hits) { if (T >= at - 0.05) cur = lv; impact(ctx, T, at, lv, { g, x: 960, y: 560 }); }
      cut(g, rr(60, 60, 520, 120, 20), PAL.paper, { stroke: PAL.ink, lw: 5, shadow: 8 });
      latin(g, `impact '${cur}'`, 92, 120, 52, { fill: PAL.redDark, weight: 700 });
      ink(g, '整帧实拍（真写 ctx.fx）', 620, 120, 40);
    },
  },

  // —— 整帧检查（和镜头作者的写法一样：传 T 与 t0/t1；为了看清，时长放慢到 0.6–0.8s）——
  ...FULL_SHOTS(),
];
