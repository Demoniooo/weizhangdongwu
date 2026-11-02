// 模型图：王座厅（src/env/throne.js）。渲染：
//   node tools/render.mjs stills --sheet throne --times 0.5,1.5,2.5,3.5,5.0,7.5,8.5 --outdir out/review/sheets/throne
//   node tools/render.mjs sheet --sheet throne --from 0 --to 2 --every 0.1 --cols 7 --tile 360 --out out/review/sheets/throne/anim.jpg
// [0,1) 四种光照同机位 TR-W｜[1,2) 关键机位：CU-H、CU-K、TR-ROSE 内/外、TR-NIGHT 月亮、O04 四季窗 + 身高刻度
// [2,3) TR-W 站位与比例标注｜[3,4) 圣旨吊起 / 节日纸通道 / 低机位 / TR-KING / N4 圣旨展开 + 金印（红点 = 返回的字位）/ 开门
// [4,7) 动态：TR-W → TR-2S → CU-H → TR-ROSE（flat 0→1）｜[7,8) 全幅夜景 TR-NIGHT｜[8,9) 全幅节日 TR-HERALD
import { PAL, rr, cut } from '../core/paper.js';
import { cam, applyCam, lerpCam, toScreen } from '../core/camera.js';
import { clamp, rgba, TAU, fract } from '../core/util.js';
import { glide, ez } from '../core/ease.js';
import { glyphRow } from '../ui/type.js';
import { drawRoundWindow } from '../env/roundwindow.js';
import { drawThroneRoom, THRONE, CAMS, throneLayer, roseCam } from '../env/throne.js';

const LAYERS = ['back', 'mid', 'main', 'chars', 'glow', 'fg'];

function label(g, text, x, y, size = 28, o = {}) {
  glyphRow(g, [...text], x, y, size, { family: 'play', fill: PAL.ink, edge: PAL.paper, edgeW: 0.18, gap: size * 0.04, ...o });
}
function tag(g, text, x, y, size = 26) {
  const w = [...text].length * size * 0.86 + 26;
  cut(g, rr(x, y - size * 0.8, w, size * 1.6, 8), PAL.paper, { shadow: 3, stroke: PAL.ink, lw: 2.5 });
  label(g, text, x + 13, y, size, { edge: null });
}
/** 比例标注用的虚线人形（不是正式木偶）：脚底 (x,y)，高 h，头半径 hr。 */
function standee(g, x, y, h, hr, col, crown = 0) {
  g.save();
  g.setLineDash([9, 7]); g.lineWidth = 3; g.strokeStyle = rgba(col, 0.95);
  g.fillStyle = rgba(col, 0.12);
  const bw = h * 0.36;
  g.beginPath(); g.roundRect(x - bw / 2, y - h + hr * 2 - 4, bw, h - hr * 2 + 4, bw * 0.3); g.fill(); g.stroke();
  g.beginPath(); g.arc(x, y - h + hr, hr, 0, TAU); g.fill(); g.stroke();
  if (crown) { g.beginPath(); g.moveTo(x - hr * 0.7, y - h + 4); g.lineTo(x - hr * 0.8, y - h - crown); g.lineTo(x, y - h - crown * 0.4); g.lineTo(x + hr * 0.8, y - h - crown); g.lineTo(x + hr * 0.7, y - h + 4); g.stroke(); }
  g.restore();
}
/** 把整张 1920×1080 的王座厅画进 rect 小格（各层仍走 ctx.layer）。返回 mid 层 drawThroneRoom 的返回值（全幅屏幕坐标）。 */
function room(ctx, g, T, rect, c, o = {}, chars = null) {
  const [x, y, w, h] = rect, s = w / 1920;
  let res = null;
  const tf = (lg) => { lg.beginPath(); lg.rect(x, y, w, h); lg.clip(); lg.translate(x, y); lg.scale(s, h / 1080); };
  for (const L of LAYERS) {
    if (L === 'chars') { if (chars) { g.save(); tf(g); chars(g); g.restore(); } continue; }
    if (L === 'glow') { g.save(); tf(g); drawThroneRoom(g, T, c, { ...o, layer: 'glow' }); g.restore(); continue; }
    const lo = throneLayer(L, o.light);
    const sh = typeof lo.shadow === 'number' ? lo.shadow * s : lo.shadow ? { ...lo.shadow, blur: lo.shadow.blur * s, dx: lo.shadow.dx * s, dy: lo.shadow.dy * s } : 0;
    ctx.layer(g, { ...lo, blur: lo.blur ? lo.blur * s : 0, shadow: sh }, (lg) => { lg.save(); tf(lg); const r = drawThroneRoom(lg, T, c, { ...o, layer: L }); if (L === 'mid') res = r; lg.restore(); });
  }
  g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 3; g.strokeRect(x, y, w, h); g.restore();
  return res;
}
const bg = (g) => { g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080); };
const grid = (cols, rows, x0 = 24, y0 = 72, gap = 16) => {
  const W = 1920 - x0 * 2, H = 1080 - y0 - 12;
  const cw = Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) * 16 / 9), ch = cw * 9 / 16;
  const ox = (1920 - (cw * cols + gap * (cols - 1))) / 2;
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([ox + c * (cw + gap), y0 + r * (ch + gap), cw, ch]);
  return out;
};
/** 主体层世界坐标 → 小格内坐标（画在已 tf 的 g 上：applyCam 之后）。 */
function withCam(g, c, depth, fn) { g.save(); applyCam(g, c, depth); fn(g); g.restore(); }
const heroAt = (g) => standee(g, 620, 880, 260, 52, PAL.heroBlue);
const kingAt = (g, sit = false) => (sit ? standee(g, 1580, 660, 150, 44, PAL.robe, 30) : standee(g, 1500, 790, 220, 46, PAL.robe, 40));

export default [
  // ———— [0,1) 四种光照，同机位 TR-W ————
  {
    id: 'sheet_throne_lights', start: 0, end: 1,
    draw(g, T, lt, ctx) {
      bg(g);
      label(g, '王座厅 THRONE · 四种光照（同机位 TR-W）', 30, 40, 34);
      const cells = grid(2, 2);
      const L = [['sunny', '晴 sunny：彩窗四色光斑 + 光柱浮尘', { windowL: 'day', windowR: 'day' }],
        ['festive', '节日 festive：花环 + 金粉 + 更亮', { windowL: 'day', windowR: 'day', confettiFloor: 0.6 }],
        ['gray', '阴 gray：窗灰 + 雨丝', {}],
        ['night', '夜 night：星空 + 月亮 + 柱上烛光', { windowR: 'moon' }]];
      cells.forEach((r, i) => {
        const [light, name, extra] = L[i];
        room(ctx, g, T, r, CAMS.TR_W, { light, ...extra }, (gg) => withCam(gg, CAMS.TR_W, 1, (q) => { heroAt(q); kingAt(q, light === 'night'); }));
        tag(g, name, r[0] + 14, r[1] + 32, 22);
      });
    },
  },
  // ———— [1,2) 关键机位 ————
  {
    id: 'sheet_throne_views', start: 1, end: 2,
    draw(g, T, lt, ctx) {
      bg(g);
      label(g, '关键机位 · 反应格 / 玫瑰窗内外 / 夜窗月亮 / 四季翻牌', 30, 40, 34);
      const cells = grid(3, 2);
      // CU-H：勇者头在左半 (690,480)
      room(ctx, g, T, cells[0], CAMS.CU_H, { light: 'sunny' }, (gg) => withCam(gg, CAMS.CU_H, 1, heroAt));
      // CU-K：国王头在右半 (1290,490)
      room(ctx, g, T, cells[1], CAMS.CU_K, { light: 'sunny' }, (gg) => withCam(gg, CAMS.CU_K, 1, (q) => kingAt(q)));
      // TR-ROSE 内侧（flat:1，窗心 = 屏幕中心）
      room(ctx, g, T, cells[2], CAMS.TR_ROSE, { light: 'festive', flat: 1 });
      // TR-ROSE 外侧：同一函数 face:'out'（与 castle 外景匹配用）
      {
        const [x, y, w, h] = cells[3], s = w / 1920;
        ctx.layer(g, { texture: 0.2 }, (lg) => {
          lg.save(); lg.beginPath(); lg.rect(x, y, w, h); lg.clip();
          lg.fillStyle = PAL.stone; lg.fillRect(x, y, w, h);
          lg.translate(x, y); lg.scale(s, s);
          drawRoundWindow(lg, { x: 960, y: 540, r: 675, face: 'out', t: T });
          lg.restore();
        });
        g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 3; g.strokeRect(x, y, w, h); g.restore();
      }
      // TR-NIGHT：右窗月亮 = 屏幕 (1220,250) r70（红圈为目标）
      room(ctx, g, T, cells[4], CAMS.TR_NIGHT, { light: 'night', windowR: 'moon', door: 0.5 }, (gg) => {
        withCam(gg, CAMS.TR_NIGHT, 1, (q) => standee(q, 1100, 880, 70, 22, PAL.heroBlue));
        gg.save(); gg.setLineDash([8, 6]); gg.strokeStyle = PAL.red; gg.lineWidth = 4; gg.beginPath(); gg.arc(1220, 250, 70, 0, TAU); gg.stroke(); gg.restore();
      });
      // TR-RULER：O04 左窗四季翻牌（1 秒走完四季）+ 柱上身高刻度
      {
        const seasons = ['spring', 'summer', 'autumn', 'winter'];
        const q = fract(lt) * 4, i = Math.floor(q), k = clamp((q - i) * 2.2 - 0.4);
        const wl = i === 0 && k <= 0 ? 'spring' : { from: seasons[(i + 3) % 4], to: seasons[i], k: i === 0 ? 1 : k };
        const marks = [{ h: 110, at: 1.1 }, { h: 160, at: 1.35 }, { h: 200, at: 1.6 }];
        room(ctx, g, T, cells[5], CAMS.TR_RULER, { light: 'night', windowL: wl, windowR: 'moon', moonPhase: (q / 4) * 0.8, ruler: marks }, (gg) =>
          withCam(gg, CAMS.TR_RULER, 1, (qq) => standee(qq, 753, 880, T < 1.35 ? 110 : T < 1.6 ? 160 : 200, 30, PAL.heroBlue)));
      }
      const names = ['CU-H cam(700,690,3.4)', 'CU-K cam(1400,640,3.3)', 'TR-ROSE 内 flat:1', '外侧 face:out（castle 圆窗）', 'TR-NIGHT 月亮 (1220,250) r70', 'TR-RULER 四季 + 刻度'];
      cells.forEach((r, i) => tag(g, names[i], r[0] + 12, r[1] + 30, 20));
    },
  },
  // ———— [2,3) 站位与比例 ————
  {
    id: 'sheet_throne_spots', start: 2, end: 3,
    draw(g, T, lt, ctx) {
      const c = CAMS.TR_W;
      room(ctx, g, T, [0, 0, 1920, 1080], c, { light: 'sunny', lectern: true }, (gg) => withCam(gg, c, 1, (q) => {
        const S = THRONE.spots;
        heroAt(q); kingAt(q);
        standee(q, S.scribe[0], 880, 180, 40, PAL.inkSoft);
        standee(q, S.herald[0], 880, 185, 40, PAL.heroBlueDark);
        standee(q, S.princess[0], 880, 250, 50, PAL.princessDark);
        q.strokeStyle = rgba(PAL.red, 0.8); q.lineWidth = 2; q.setLineDash([12, 8]);
        q.beginPath(); q.moveTo(-200, 880); q.lineTo(2200, 880); q.moveTo(560, 620); q.lineTo(680, 620); q.stroke();
      }));
      const pin = (wx, wy, text, d = 1) => { const [sx, sy] = toScreen(c, d, wx, wy); g.save(); g.fillStyle = PAL.red; g.beginPath(); g.arc(sx, sy, 7, 0, TAU); g.fill(); g.restore(); label(g, text, sx + 12, sy - 18, 22); };
      pin(620, 880, '勇者 620'); pin(1500, 790, '国王站 (1500,790)'); pin(1580, 660, '国王坐 (1580,660)');
      pin(1150, 880, '书记官/讲台 1150'); pin(980, 880, '传令官 980'); pin(760, 880, '公主 760');
      pin(1100, 880 + 40, '摇篮 1100'); pin(1240, 880, '卫兵 1240'); pin(1880, 790, '卫兵 (1880,790)');
      pin(THRONE.rose.x, THRONE.rose.y, '玫瑰窗 (1580,250) r150 ·0.55', 0.55);
      pin(600, 360, '尖拱窗 L 600 ·0.55', 0.55); pin(1150, 360, '尖拱窗 R 1150 ·0.55', 0.55);
      pin(150, 700, '左门 150 ·0.55', 0.55); pin(780, 300, '柱 780 / 长幡 ·0.8', 0.8);
      label(g, 'TR-W · 地面线 y=880（红虚线）· 勇者 s=1 高 260（头顶线 620）', 30, 1040, 30);
    },
  },
  // ———— [3,4) 圣旨 / 节日纸通道 / 低机位 / TR-KING / N4 圣旨展开 + 金印 / 夜里开门 ————
  {
    id: 'sheet_throne_props', start: 3, end: 4,
    draw(g, T, lt, ctx) {
      bg(g);
      label(g, '圣旨吊起 · 节日纸通道 · 低机位 · TR-KING · N4 展开 + 金印 · 开门', 30, 40, 34);
      const cells = grid(3, 2);
      const hung = ez(lt, 0.05, 0.6, glide);
      room(ctx, g, T, cells[0], CAMS.TR_HIGH, { light: 'sunny', decree: { hung, sweep: clamp((lt - 0.65) / 0.3) }, confettiFloor: lt });
      room(ctx, g, T, cells[1], cam(1100, 600, 1.2), { light: 'festive', aisle: clamp(lt * 1.4), confettiFloor: 1, door: clamp(lt * 2) }, (gg) => withCam(gg, cam(1100, 600, 1.2), 1, (q) => kingAt(q, true)));
      room(ctx, g, T, cells[2], CAMS.TR_LOW, { light: 'sunny', decree: { hung: 1 } });
      room(ctx, g, T, cells[3], CAMS.TR_KING, { light: 'sunny' }, (gg) => withCam(gg, CAMS.TR_KING, 1, (q) => kingAt(q)));
      // b05 N4：圣旨在地上（hung 0）由右向左展开，三段金印按 prints 时刻砸下；红点 = 返回值 decree.chars（屏幕坐标）
      {
        const r = cells[4], s = r[2] / 1920;
        const res = room(ctx, g, T, r, CAMS.TR_SEAL, { light: 'sunny', decree: { hung: clamp((lt - 0.8) * 6), unroll: clamp(0.25 + lt * 1.5), prints: [3.15, 3.4, 3.65], layer: 'main' } });
        if (res && res.decree) {
          g.save(); g.fillStyle = PAL.red;
          for (const [px, py] of res.decree.chars) { g.beginPath(); g.arc(r[0] + px * s, r[1] + py * s, 3, 0, TAU); g.fill(); }
          g.restore();
        }
      }
      room(ctx, g, T, cells[5], CAMS.TR_NIGHT, { light: 'night', windowR: 'moon', door: clamp(lt * 1.5), lectern: true });
      const names = ['TR-HIGH 圣旨 hung 0→1 + 扫光', '节日 aisle + 彩纸 + door', 'TR-LOW cam(1000,720,1.2)', 'TR-KING cam(1480,600,1.7)', 'TR-SEAL N4 layer:main 展开 + 金印 → 吊起', '夜 door 0→1 + lectern'];
      cells.forEach((r, i) => tag(g, names[i], r[0] + 12, r[1] + 30, 20));
    },
  },
  // ———— [7,8) 全幅夜景 TR-NIGHT（O03–O07）｜[8,9) 全幅节日 TR-HERALD（E05–E08） ————
  {
    id: 'sheet_throne_night', start: 7, end: 8,
    draw(g, T, lt, ctx) {
      const c = CAMS.TR_NIGHT;
      room(ctx, g, T, [0, 0, 1920, 1080], c, { light: 'night', windowL: 'night', windowR: 'moon', door: 0.6 }, (gg) => withCam(gg, c, 1, (q) => { standee(q, 1100, 880, 70, 22, PAL.heroBlue); standee(q, 980, 880, 260, 52, PAL.heroBlue); standee(q, 1220, 880, 250, 50, PAL.princessDark); kingAt(q, true); }));
      g.save(); g.setLineDash([8, 6]); g.strokeStyle = rgba(PAL.red, 0.8); g.lineWidth = 3; g.beginPath(); g.arc(1220, 250, 70, 0, TAU); g.stroke(); g.restore();
      tag(g, 'TR-NIGHT 全幅 · 右窗月亮 = 屏幕 (1220,250) r70（红虚线）· 摇篮 1100', 30, 50, 24);
    },
  },
  {
    id: 'sheet_throne_festive', start: 8, end: 9,
    draw(g, T, lt, ctx) {
      const c = CAMS.TR_HERALD;
      room(ctx, g, T, [0, 0, 1920, 1080], c, { light: 'festive', aisle: 1, confettiFloor: 1, windowL: 'day', windowR: 'day' }, (gg) => withCam(gg, c, 1, (q) => { heroAt(q); standee(q, 760, 880, 250, 50, PAL.princessDark); standee(q, 980, 880, 185, 40, PAL.heroBlueDark); kingAt(q, true); }));
      tag(g, '节日 festive 全幅 · TR-HERALD cam(1000,560,1.2) · aisle 1 · confettiFloor 1', 30, 50, 24);
    },
  },
  // ———— [4,7) 动态：机位连续运动 + flat 渐变 ————
  {
    id: 'sheet_throne_move', start: 4, end: 7,
    draw(g, T, lt, ctx) {
      const keys = [[0, CAMS.TR_W, 0], [0.8, CAMS.TR_2S, 0], [1.5, CAMS.CU_H, 0], [2.1, CAMS.TR_2S, 0], [3.0, roseCam(960, 540, 675, 1), 1]];
      let k = 0; while (k < keys.length - 2 && lt > keys[k + 1][0]) k++;
      const [t0, c0, f0] = keys[k], [t1, c1, f1] = keys[k + 1];
      const u = ez(lt, t0, t1, glide);
      const c = lerpCam(c0, c1, u), flat = f0 + (f1 - f0) * u;
      room(ctx, g, T, [0, 0, 1920, 1080], c, { light: 'sunny', flat }, (gg) => withCam(gg, c, 1, (q) => { heroAt(q); kingAt(q); }));
      tag(g, `动态：TR-W → TR-2S → CU-H → TR-2S → 玫瑰窗（flat ${flat.toFixed(2)}）`, 30, 50, 24);
    },
  },
];
