// type.js 模型图：全部 style、沿路径排字（含竖排）、glyph13 六态、走马灯五态、片名三层纸叠、卷轴墨字、NAME_TIMES 表。
// 页面：[0,1) 材质 ｜ [1,2) 路径/字槽/走马灯 ｜ [2,3) 片名/墨字 ｜ [3,4) NAME_TIMES ｜ [4,8) 动态循环
import { PAL, rr, cut, poly, blob, line, smooth as smoothPath } from '../core/paper.js';
import { clamp, seg, noise1, mixHex, rgba } from '../core/util.js';
import { NAMES } from '../cues.js';
import { paperGlyph, glyphRow, glyphsOnPath, glyph13, marquee, titleGlyphs, scrollInk, NAME_TIMES, segChars, charsOf, STYLE_NAMES } from '../ui/type.js';

const HERO = charsOf('hero');
const bg = (g) => { g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080); };
const label = (g, text, x, y, size = 26, fill = PAL.inkSoft, family = 'play') => glyphRow(g, text, x, y, size, { family, fill, edge: null, gap: size * 0.02, baseline: true });
const title = (g, text, sub) => { label(g, text, 48, 52, 40, PAL.ink); if (sub) label(g, sub, 48, 96, 24, PAL.inkSoft); };
const band = (g, x, y, w, h, c, a = 1) => { g.save(); g.globalAlpha *= a; g.fillStyle = c; g.fill(rr(x, y, w, h, 14)); g.restore(); };

const STYLE_DESC = {
  cut: '红字奶油边 N1', tile: '字母牌 N2 O06', balloon: '气球字 N3', seal: '印章字 N4', gold: '金箔 圣旨', title3: '片名三层纸叠',
  plate: '龙背板 发光', fire: '火焰字 D2', stone: '石刻+熔岩 D3', steel: '剑刃字牌 B10', petal: '花瓣字 E02', flag: '塔旗字 E04',
  ink: '卷轴墨字', banner: '横幅字 E12',
};
const BAND = { plate: PAL.dragonDeep, fire: PAL.dragonDeep, stone: PAL.stone2, steel: PAL.steel, title3: PAL.redDeep, banner: PAL.skyDayLow, petal: PAL.princessLight, flag: PAL.paper2 };
const BALLOON = [PAL.princessLight, PAL.skyDay, PAL.leafLight, PAL.goldLight];

function styleRow(g, st, x, y, T) {
  const W = 920;
  band(g, x, y - 52, W, 104, BAND[st] || PAL.paper2, BAND[st] ? 1 : 0.55);
  label(g, st, x + 18, y - 14, 30, BAND[st] && st !== 'banner' && st !== 'petal' && st !== 'flag' && st !== 'steel' && st !== 'stone' ? PAL.paper : PAL.ink, 'latin');
  label(g, STYLE_DESC[st], x + 18, y + 26, 20, BAND[st] && st !== 'banner' && st !== 'petal' && st !== 'flag' && st !== 'steel' && st !== 'stone' ? mixHex(PAL.paper, PAL.ink, 0.25) : PAL.inkSoft);
  const size = st === 'tile' ? 44 : st === 'seal' ? 46 : st === 'balloon' ? 52 : 54;
  const x0 = x + 200;
  const o = { style: st, gap: st === 'tile' || st === 'seal' ? 2 : size * 0.06 };
  if (st === 'stone') o.glow = 0.55;
  if (st === 'balloon') o.perChar = (i) => ({ fill: BALLOON[i % 4], rot: noise1(i * 1.7, 3) * 0.4, scale: 0.85 + 0.25 * noise1(i * 2.3, 5), flipY: i === 2, mirror: i === 5, dy: noise1(i * 1.1 + T, 8) * 6 });
  if (st === 'gold' || st === 'title3') o.foilX = x0 + 120;
  glyphRow(g, HERO, x0, y, size, o);
}

function pageStyles(g, T) {
  bg(g);
  title(g, 'type.js · 全部 style（paperGlyph 的 o.style，每行写一遍勇者名）', '锚点 = 字形墨迹中心；纸边 / 暗色错位底片（右下）/ 顶部切口亮边；gold 与 title3 带一道金箔扫光');
  STYLE_NAMES.forEach((st, i) => styleRow(g, st, i < 7 ? 36 : 980, 200 + (i % 7) * 124, T));
}

function sPath(x0, y0, w, h, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const u = i / n; pts.push([x0 + u * w, y0 + Math.sin(u * Math.PI * 2) * h]); }
  return pts;
}

function pagePaths(g, T) {
  bg(g);
  title(g, 'glyphsOnPath · glyph13 六态 · marquee 五态', '字永远正立：切线角夹在 ±15°；竖排只从上往下；走马灯为剧场规格 72px / 字距 63 / 窗宽 315（mode pass）');
  // —— S 形路径（横排）
  const pts = sPath(70, 250, 820, 70);
  line(g, pts, { color: rgba(PAL.inkSoft, 0.5), lw: 3, dash: [10, 10], amp: 0 });
  glyphsOnPath(g, HERO, pts, { size: 60, style: 'banner', gap: 4 });
  label(g, 'glyphsOnPath（S 形，style banner）', 70, 360, 22);
  // —— 竖排 S 路径
  const vp = [];
  for (let i = 0; i <= 40; i++) { const u = i / 40; vp.push([150 + Math.sin(u * Math.PI * 2) * 60, 420 + u * 600]); }
  line(g, vp, { color: rgba(PAL.inkSoft, 0.5), lw: 3, dash: [10, 10], amp: 0 });
  glyphsOnPath(g, charsOf('princess'), vp, { size: 50, vertical: true, style: 'cut', gap: 3 });
  label(g, '竖排 vertical', 230, 440, 22);
  label(g, '（公主名，从上往下）', 230, 470, 20);
  // —— glyph13 六态
  const states = ['off', 'lit', 'fire', 'gold', 'steel', 'stone'];
  const bgs = { off: PAL.dragonDeep, lit: PAL.dragonDeep, fire: PAL.dragonDeep, gold: PAL.paper2, steel: PAL.steel, stone: PAL.stone2 };
  states.forEach((st, r) => {
    const y = 470 + r * 98, x0 = 420;
    band(g, x0 - 10, y - 44, 790, 88, bgs[st]);
    const anchors = HERO.map((_, i) => ({ x: x0 + 110 + i * 52, y: y + Math.sin(i * 0.8) * 8, ang: Math.cos(i * 0.8) * 0.5 }));
    if (st === 'steel') anchors.forEach((a) => { g.fillStyle = PAL.steelDark; g.fill(rr(a.x - 24, a.y - 24, 48, 48, 6)); g.fillStyle = PAL.steel; g.fill(rr(a.x - 22, a.y - 22, 44, 44, 5)); });
    if (st === 'off' || st === 'lit') anchors.forEach((a, i) => cut(g, blob(a.x, a.y, 25, 25, { seed: i + 3, amp: 0.03 }), PAL.dragonDeep, { stroke: PAL.gold, lw: 2.5 }));
    glyph13(g, HERO, anchors, { size: 40, state: st, glow: st === 'lit' || st === 'fire' ? 0.8 : 0, glyph: st === 'stone' ? { glow: 0.7 } : undefined });
    label(g, st, x0 + 6, y + 8, 26, st === 'gold' || st === 'steel' || st === 'stone' ? PAL.ink : PAL.paper, 'latin');
  });
  label(g, 'glyph13（龙背板 / 名字之剑 / 塔旗 / 石碑）', 420, 1060, 22);
  // —— marquee 五态
  const states2 = ['idle', 'active', 'hit', 'angry', 'cracked', 'empty'];
  const p = (T % 1);
  states2.forEach((st, r) => {
    const x = 1440, y = 180 + r * 128, rect = { x, y, w: 315, h: 70 };
    g.fillStyle = PAL.inkSoft; g.fill(rr(x - 8, y - 8, 331, 86, 12));
    g.fillStyle = mixHex(PAL.ink, PAL.redDeep, 0.25); g.fill(rr(x - 3, y - 3, 321, 76, 9));
    const res = marquee(g, HERO, rect, p, { pitch: 63, size: 72, mode: 'pass', state: st, t: T });
    g.strokeStyle = rgba(PAL.goldLight, 0.6); g.lineWidth = 1.5; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(res.centerX, y - 10); g.lineTo(res.centerX, y + 80); g.stroke(); g.setLineDash([]);
    label(g, st, x - 200, y + 36, 30, PAL.ink, 'latin');
    label(g, `p ${p.toFixed(2)}  中线字 ${res.centerIndex}  已过 ${res.passed}`, x, y + 98, 18);
  });
  // 三个固定进度（active）
  [0.15, 0.5, 0.85].forEach((pp, k) => {
    const x = 1060 + k * 0, y = 0;
    void x; void y; void pp;
  });
}

function pageTitle(g, T, lt) {
  bg(g);
  title(g, 'titleGlyphs（片名三层纸叠）· scrollInk（卷轴墨字）', 'rise[4] 以基线为锚 scaleY（outBack）；foil 金箔扫光；starAt 四角星；scrollInk 返回笔尖 pen');
  g.fillStyle = PAL.redDeep; g.fill(rr(60, 130, 1800, 520, 26));
  g.strokeStyle = PAL.gold; g.lineWidth = 4; g.stroke(rr(84, 154, 1752, 472, 18)); g.lineWidth = 1.5; g.stroke(rr(96, 166, 1728, 448, 14));
  titleGlyphs(g, { x: 960, y: 500, size: 300, foil: clamp(lt * 1.4 - 0.1), starAt: 0.65, t: lt });
  // 基线
  g.strokeStyle = rgba(PAL.goldLight, 0.5); g.setLineDash([8, 8]); g.lineWidth = 2; g.beginPath(); g.moveTo(300, 500); g.lineTo(1620, 500); g.stroke(); g.setLineDash([]);
  label(g, '基线 y=500（正式 y=560）', 1640, 508, 18, PAL.goldLight);
  // 卷轴
  const sx = 120, sy = 700;
  cut(g, rr(sx, sy, 1080, 300, 18), PAL.paper2, { stroke: PAL.redDark, lw: 6 });
  cut(g, rr(sx - 30, sy - 12, 40, 324, 16), PAL.wood); cut(g, rr(sx + 1070, sy - 12, 40, 324, 16), PAL.wood);
  const res = scrollInk(g, ['达拉崩吧', '斑得贝迪', '卜多比鲁翁'], { x: sx + 60, y: sy + 20, w: 960, h: 260 }, clamp(lt * 1.25), { size: 74, fill: PAL.ink });
  g.fillStyle = PAL.red; g.beginPath(); g.arc(res.pen[0], res.pen[1], 7, 0, Math.PI * 2); g.fill();
  label(g, 'pen', res.pen[0] + 10, res.pen[1] + 24, 18, PAL.red, 'latin');
  // 金墨 / 小字示例
  cut(g, rr(1280, 700, 560, 300, 18), PAL.paper, { stroke: PAL.redDark, lw: 6 });
  scrollInk(g, NAMES.dragonParts.join('\n'), { x: 1320, y: 730, w: 480, h: 150 }, clamp(lt * 1.25), { size: 54, fill: PAL.goldDark });
  scrollInk(g, '原曲《达拉崩吧》', { x: 1320, y: 900, w: 480, h: 70 }, 1, { family: 'serif', size: 40, fill: PAL.inkSoft });
  label(g, 'fill goldDark（金墨）', 1320, 1030, 18);
  label(g, 'family serif', 1640, 1030, 18);
}

function pageTimes(g) {
  bg(g);
  title(g, 'NAME_TIMES（由 cues.js 计算；与 storyboard 附录 A 对照，附录为两位小数）', 'cue 分段：段首字 = 段 cue，步长 = 段长 ÷ 字数；N4 印章段整段同时；B10 / E02 / E04 / E06 / E08 / E10 / E12 / O06 按附录写死');
  const segs = ['N1a', 'N1b', 'N1c', 'N2a', 'N2b', 'N2c', 'N3a', 'N3b', 'N3c', 'N4a', 'N4b', 'N4c', 'D1a', 'D1b', 'D2a', 'D2b', 'D3a', 'D3b',
    'B10a', 'B10b', 'B10c', 'E02', 'E04', 'E06a', 'E06b', 'E06c', 'E08a', 'E08b', 'E10', 'E12', 'O06'];
  segs.forEach((s, i) => {
    const col = i < 16 ? 0 : 1, row = i % 16;
    const x = 48 + col * 940, y = 150 + row * 56;
    if (row % 2 === 0) band(g, x - 10, y - 26, 920, 54, PAL.paper2, 0.7);
    label(g, s, x, y, 24, PAL.red, 'latin');
    const cs = segChars(s);
    label(g, cs.join(''), x + 70, y, 21, PAL.ink);
    const ts = NAME_TIMES(s);
    const step = ts.length > 1 ? (ts[1] - ts[0]).toFixed(3) : '0';
    label(g, 'step ' + step, x + 70, y + 19, 13, PAL.inkSoft, 'latin');
    const tx = x + 70 + Math.max(cs.length, 5) * 21 + 18;
    const vals = ts.map((v) => v.toFixed(3));
    const wrap = vals.length > 8 ? Math.ceil(vals.length / 2) : vals.length;
    label(g, vals.slice(0, wrap).join('  '), tx, vals.length > wrap ? y - 9 : y, 16, PAL.ink, 'latin');
    if (vals.length > wrap) label(g, vals.slice(wrap).join('  '), tx, y + 13, 16, PAL.ink, 'latin');
  });
}

function pageDynamic(g, T, lt) {
  bg(g);
  title(g, '动态：片名逐字立起 + 扫光 + 星 ｜ 走马灯 pass 滚动 ｜ glyph13 逐节点亮 ｜ 气球字晃动', `lt ${lt.toFixed(2)}s（4 秒循环）`);
  // 片名逐字立起
  g.fillStyle = PAL.redDeep; g.fill(rr(60, 120, 1000, 330, 22));
  const rise = [0, 1, 2, 3].map((i) => clamp((lt - 0.2 - i * 0.15) / 0.4));
  titleGlyphs(g, { x: 560, y: 380, size: 200, rise, foil: lt > 1.4 ? clamp((lt - 1.4) / 0.6) : null, starAt: 2.0, t: lt });
  // 走马灯
  const states = ['active', 'hit', 'angry', 'cracked'];
  states.forEach((st, r) => {
    const x = 1300, y = 140 + r * 100, rect = { x, y, w: 315, h: 66 };
    g.fillStyle = mixHex(PAL.ink, PAL.redDeep, 0.25); g.fill(rr(x - 4, y - 4, 323, 74, 9));
    marquee(g, HERO, rect, clamp(lt / 3.6), { pitch: 63, size: 72, mode: 'pass', state: st, t: T });
    label(g, st, x - 160, y + 34, 28, PAL.ink, 'latin');
  });
  // glyph13 逐节点亮（lit 数组）
  band(g, 60, 500, 1800, 140, PAL.dragonDeep);
  const anchors = HERO.map((_, i) => ({ x: 160 + i * 132, y: 570 + Math.sin(i * 0.7 + lt * 2) * 14, ang: Math.cos(i * 0.7 + lt * 2) * 0.4 }));
  anchors.forEach((a, i) => cut(g, blob(a.x, a.y, 48, 48, { seed: i + 3, amp: 0.03 }), PAL.dragonDeep, { stroke: PAL.gold, lw: 3 }));
  const lit = HERO.map((_, i) => clamp((lt - 0.2 - i * 0.25) / 0.2));
  const pop = HERO.map((_, i) => Math.max(0, Math.sin(clamp((lt - 0.2 - i * 0.25) / 0.3) * Math.PI)));
  glyph13(g, HERO, anchors, { size: 64, state: 'lit', lit, glow: lit, pop });
  // 气球字（N3 规则：字序正确、歪、大小不一、崩颠倒、得镜像）
  const bx = 160;
  glyphRow(g, HERO, bx, 820, 92, { style: 'balloon', gap: 14, perChar: (i) => ({ fill: BALLOON[i % 4], rot: noise1(i * 1.7, 3) * 0.44 + noise1(T * 1.3 + i, 9) * 0.08, scale: i < 8 ? 0.85 + 0.35 * noise1(i * 2.3, 5) : 1 - (i - 8) * 0.12, flipY: i === 2, mirror: i === 5, dy: noise1(i * 1.1 + T * 0.9, 8) * 18 }) });
  label(g, 'balloon：粉彩按字序循环；「崩」颠倒、「得」镜像；c 段越来越小', bx, 960, 22);
}

export default [
  { id: 'sheet_type_styles', start: 0, end: 1, draw: (g, T) => pageStyles(g, T) },
  { id: 'sheet_type_paths', start: 1, end: 2, draw: (g, T) => pagePaths(g, T) },
  { id: 'sheet_type_title', start: 2, end: 3, draw: (g, T, lt) => pageTitle(g, T, lt) },
  { id: 'sheet_type_times', start: 3, end: 4, draw: (g) => pageTimes(g) },
  { id: 'sheet_type_dynamic', start: 4, end: 8, draw: (g, T, lt) => pageDynamic(g, T, lt) },
];
