// 模型图：地图三种形态（src/env/map.js）。
//   [0,1)  三形态叠图（同一路线、地标成比例一致）+ 小地图 r = 0 / 0.5 / 1 + walked 金色
//   [1,2)  风琴折 unfold 0 / 0.33 / 0.5 / 0.66 / 1 + 城名环形字特写 + 小骑士 / 图钉 / 蜡笔手 + 小地图翻面与折起
//   [25.35, 34.10)  立誓蜡笔地图（按 b03 分镜的时刻与机位走一遍）
//   [66.40, 74.45)  间奏一羊皮纸地图（按 b06 分镜走一遍）
import { PAL, blob, poly, cut, rr } from '../core/paper.js';
import { clamp, lerp, seg, TAU, fract, rgba, mixHex } from '../core/util.js';
import { cam, applyCam, lerpCam } from '../core/camera.js';
import { ez, glide, inExpo, outCubic, inOutCubic } from '../core/ease.js';
import {
  MAP_UV, MAP_ORDER, MAP_ROUTE_R, mapRoute, mapToScreen, mapRoutePoints, MAP_FORMS,
  drawCrayonMap, drawParchmentMap, drawMiniMap, drawKnightToken, drawMissionPin, drawCrayon, drawMapCover, heartPoints, CRAYON, PARCHMENT,
} from '../env/map.js';
import { glyphRow } from '../ui/type.js';

const W = 1920, H = 1080;
function label(g, text, x, y, size = 30, o = {}) {
  glyphRow(g, [...text], x, y, size, { family: o.family || 'play', fill: o.fill || PAL.ink, edge: o.edge === undefined ? PAL.paper : o.edge, edgeW: 0.14, align: o.align || 'left', weight: o.weight });
}
function bg(g) { g.fillStyle = PAL.paper; g.fillRect(0, 0, W, H); }
const LMC = [PAL.red, PAL.grass, PAL.gold, PAL.mountain, PAL.forest, PAL.dragon];

// ———— b03 立誓：时刻（storyboard b03_map） ————
const R = MAP_ROUTE_R;
function crayonRoute(T) {
  if (T < 25.6) return 0;
  if (T < 28.1) return lerp(0, R.pass, inOutCubic(seg(T, 25.6, 28.1)) * 0.15 + seg(T, 25.6, 28.1) * 0.85);
  if (T < 28.3) return R.pass;
  if (T < 30.05) return lerp(R.pass, R.forest, seg(T, 28.3, 30.05));
  if (T < 30.2) return R.forest;
  return lerp(R.forest, 1, seg(T, 30.2, 31.95));
}
function crayonState(T) {
  return {
    icons: { sword: seg(T, 25.35, 25.65), mountain: seg(T, 28.17, 28.47), flag: seg(T, 28.35, 28.6), forest: seg(T, 30.12, 30.72), cage: seg(T, 32.03, 32.6), heart: seg(T, 32.3, 33.1) },
    route: crayonRoute(T), heartFill: seg(T, 33.0, 33.2), heartBeatAt: 33.2, owlBlink: 30.6,
  };
}
function crayonTip(T) {
  if (T >= 32.3 && T < 33.2) { const pts = heartPoints(CRAYON.heart.x, CRAYON.heart.y, CRAYON.heart.h, 120); const k = Math.min(pts.length - 1, Math.floor(seg(T, 32.3, 33.1) * (pts.length - 1))); return pts[k]; }
  const [u, v] = mapRoute(crayonRoute(Math.min(T, 31.95)));
  return mapToScreen('crayon', u, v);
}
function crayonCam(T) {
  const tip = crayonTip(Math.min(T, 32.2));
  const rot = (-4 * Math.PI / 180) * (1 - ez(T, 25.35, 26.0, glide));
  const fx = Math.max(760, tip[0] - 92);
  const follow = cam(fx, 540, 1.25, rot);
  return lerpCam(follow, cam(1545, 580, 1.5, 0), ez(T, 32.5, 33.5, glide));
}

// ———— b06 羊皮纸：时刻（storyboard b06_map） ————
const PASS_T = [68.6, 69.3, 70.0, 70.8, 71.5, 72.2];
function parchRoute(T) {
  if (T < PASS_T[0]) return 0;
  for (let i = 0; i < 5; i++) if (T < PASS_T[i + 1]) return lerp(R[MAP_ORDER[i]], R[MAP_ORDER[i + 1]], glide(seg(T, PASS_T[i], PASS_T[i + 1])) * 0.5 + seg(T, PASS_T[i], PASS_T[i + 1]) * 0.5);
  return 1;
}
function parchCam(T) {
  const full = cam(960, 540, 1, 0);
  const [px, py] = mapToScreen('parchment', ...mapRoute(parchRoute(T - 0.12)));
  const follow = cam(clamp(px, 560, 1360), clamp(py, 340, 740), 1.6, Math.sin(T * 1.7) * 0.03 * ez(T, 68.6, 69.0) * (1 - ez(T, 72.0, 72.4)));
  let c = lerpCam(full, follow, ez(T, 68.6, 69.1, glide) * (1 - ez(T, 72.5, 73.3, glide)));
  const [cx, cy] = PARCHMENT.landmarks[0];
  c = lerpCam(c, cam(cx + 20, cy + 30, 16, 0), inExpo(seg(T, 73.3, 74.1)));
  return c;
}
function parchState(T) {
  return {
    unfold: seg(T, 66.8, 68.0), dustAt: 68.0,
    landmarks: MAP_ORDER.map((_, i) => seg(T, 68.0 + 0.08 * i, 68.32 + 0.08 * i)),
    bounce: PASS_T, ring: seg(T, 68.1, 68.6), route: parchRoute(T), pin: seg(T, 72.4, 73.0),
    compass: TAU * inOutCubic(seg(T, 72.5, 73.3)), sweep: seg(T, 72.5, 73.3),
  };
}

export default [
  {
    id: 'sheet_map_overview', start: 0, end: 1,
    draw(g, T, lt, ctx) {
      bg(g);
      label(g, '地图 · 三种形态共用一套 (u,v)（map.js）', 60, 60, 40, { family: 'display', fill: PAL.redDark });
      const s = 0.42;
      // 蜡笔版（缩略）
      ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(60, 110, W * s, H * s); lg.clip(); lg.translate(60, 110); lg.scale(s, s);
        drawCrayonMap(lg, 33.6 + lt, { icons: { sword: 1, mountain: 1, flag: 1, forest: 1, cage: 1, heart: 1 }, route: 1, heartFill: 1, owlBlink: 30.6 });
        drawCrayon(lg, { tip: mapToScreen('crayon', ...mapRoute(1)), ang: 2.3, t: lt });
        lg.restore();
      });
      label(g, '蜡笔版 x = u·1920, y = v·1080（立誓 b03）', 60, 110 + H * s + 34, 26);
      // 羊皮纸版（缩略）
      ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(1000, 110, W * s, H * s); lg.clip(); lg.translate(1000, 110); lg.scale(s, s);
        lg.fillStyle = PAL.woodDark; lg.fillRect(0, 0, W, H);
        drawParchmentMap(lg, 72.3 + lt * 0.4, { unfold: 1, landmarks: 1, route: 1, ring: 1, pin: 1, compass: lt * TAU * 0.25, bounce: [], knight: false });
        lg.restore();
      });
      label(g, '羊皮纸版 x = 160 + u·1600, y = 90 + v·900（间奏一 b06）', 1000, 110 + H * s + 34, 26);
      // 叠图：三种形态的路线归一化到同一个框
      const box = { x: 60, y: 650, w: 600, h: 337.5 };
      g.save();
      cut(g, rr(box.x - 10, box.y - 10, box.w + 20, box.h + 20, 10), PAL.paper2, { stroke: PAL.inkSoft, lw: 2 });
      const forms = [['crayon', PAL.scarf, 9], ['parchment', PAL.gold, 5], ['mini', PAL.ink, 2]];
      for (const [f, col, lw] of forms) {
        const F = MAP_FORMS[f];
        const pts = mapRoutePoints(f, 0, 1).map(([x, y]) => [box.x + ((x - F.x) / F.w) * box.w, box.y + ((y - F.y) / F.h) * box.h]);
        g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      }
      MAP_ORDER.forEach((k, i) => { const [u, v] = MAP_UV[k]; g.fillStyle = LMC[i]; g.beginPath(); g.arc(box.x + u * box.w, box.y + v * box.h, 9, 0, TAU); g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 2; g.stroke(); });
      const [ku, kv] = mapRoute(fract(lt));
      g.fillStyle = PAL.white; g.beginPath(); g.arc(box.x + ku * box.w, box.y + kv * box.h, 7, 0, TAU); g.fill(); g.stroke();
      g.restore();
      label(g, '叠图：红=蜡笔 金=羊皮纸 墨=小地图（归一化后重合）', 60, 1030, 24);
      // 小地图 r = 0 / 0.5 / 1 + walked 金色
      const cards = [[0, 'red', 1, 'r = 0'], [0.5, 'red', 1, 'r = 0.5'], [1, 'red', 1, 'r = 1'], [0.35, 'gold', -1, '归程 walked gold r = 0.35']];
      cards.forEach(([r, walked, dir, name], i) => {
        const x = 720 + (i % 2) * 420, y = 650 + Math.floor(i / 2) * 215;
        drawMiniMap(g, lt * 2, { r, walked, dir, rect: { x, y, w: 300, h: 170 } });
        label(g, name, x, y + 196, 22);
      });
      // 小骑士 / 图钉
      drawKnightToken(g, { x: 1620, y: 800, size: 120, face: 1, hop: fract(lt * 2), t: lt * 2, pen: true });
      drawKnightToken(g, { x: 1800, y: 800, size: 60, face: -1, t: lt * 2 });
      label(g, '纸片小骑士 60px（右：face -1）', 1540, 850, 22);
      drawMissionPin(g, { x: 1700, y: 1000, drop: clamp(fract(lt) * 1.6) });
      label(g, '任务图钉 drop', 1540, 1040, 22);
    },
  },
  {
    id: 'sheet_map_states', start: 1, end: 2,
    draw(g, T, lt, ctx) {
      bg(g);
      label(g, '风琴折 unfold · 城名环形字 · 蜡笔手 · 小地图翻面与折起', 60, 56, 36, { family: 'display', fill: PAL.redDark });
      const s = 0.17;
      [0, 0.33, 0.5, 0.66, 1].forEach((u, i) => {
        const x = 60 + i * (W * s + 24), y = 86;
        ctx.layer(g, { shadow: 6, texture: 0.2 }, (lg) => {
          lg.save(); lg.beginPath(); lg.rect(x, y, W * s, H * s); lg.clip(); lg.translate(x, y); lg.scale(s, s);
          lg.fillStyle = PAL.woodDark; lg.fillRect(0, 0, W, H);
          drawParchmentMap(lg, 67 + lt, { unfold: u });
          lg.restore();
        });
        label(g, `unfold ${u}`, x, y + H * s + 24, 22, { family: 'latin', weight: 600 });
      });
      // 动态翻折
      const ud = fract(lt);
      const s2 = 0.27;
      ctx.layer(g, { shadow: 6, texture: 0.2 }, (lg) => {
        const x = 60, y = 330;
        lg.save(); lg.beginPath(); lg.rect(x, y, W * s2, H * s2); lg.clip(); lg.translate(x, y); lg.scale(s2, s2);
        lg.fillStyle = PAL.woodDark; lg.fillRect(0, 0, W, H);
        drawParchmentMap(lg, 67 + lt, { unfold: ud, dustAt: 68 });
        lg.restore();
      });
      label(g, `动态 unfold ${ud.toFixed(2)}`, 60, 330 + H * s2 + 26, 22);
      // 城名环形字特写（王城图标 1.8 倍）
      ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
        const [cx, cy] = PARCHMENT.landmarks[0];
        lg.save(); lg.beginPath(); lg.rect(620, 330, 560, 340); lg.clip();
        lg.fillStyle = PAL.paper2; lg.fillRect(620, 330, 560, 340);
        lg.translate(900, 500); lg.scale(1.75, 1.75); lg.translate(-cx, -cy);
        drawParchmentMap(lg, 68.6 + lt, { unfold: 1, landmarks: [1, 0, 0, 0, 0, 0], ring: clamp(lt * 1.6), route: 0.04, bounce: [68.6 + 0.5] });
        lg.restore();
      });
      label(g, '城名环形字（半径 92、48px，正上方起顺时针）', 620, 696, 22);
      // 蜡笔手特写
      ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
        const x0 = 1220, y0 = 330, w = 640, h = 340;
        lg.save(); lg.beginPath(); lg.rect(x0, y0, w, h); lg.clip();
        lg.fillStyle = PAL.kraft; lg.fillRect(x0, y0, w, h);
        const q = fract(lt);
        const pts = []; for (let k = 0; k <= 30; k++) { const v = (k / 30) * q; pts.push([x0 + 300 + v * 280, y0 + 110 + Math.sin(v * TAU) * 40]); }
        lg.strokeStyle = PAL.scarf; lg.lineWidth = 9; lg.setLineDash([18, 14]); lg.lineCap = 'round';
        lg.beginPath(); pts.forEach(([x, y], i) => (i ? lg.lineTo(x, y) : lg.moveTo(x, y))); lg.stroke(); lg.setLineDash([]);
        drawCrayon(lg, { tip: pts[pts.length - 1], ang: 2.3, s: 0.95, t: lt * 3, press: 0.5 });
        lg.restore();
      });
      label(g, '戴棕手套的手 + 红蜡笔（tip 锚点）', 1220, 696, 22);
      // 小地图：翻面、折起、滑入；封皮；小骑士
      const st = [{ flip: 0.35, n: 'flip 0.35' }, { flip: 1, n: 'flip 1（背面问号）' }, { fold: 0.5, n: 'fold 0.5' }, { fold: 0.85, n: 'fold 0.85' }, { show: clamp(fract(lt) * 1.3), n: 'show 滑入（动态）' }];
      st.forEach((o, i) => {
        const x = 60 + i * 340, y = 760;
        drawMiniMap(g, lt * 2, { r: 0.62, ...o, rect: { x, y, w: 300, h: 170 } });
        label(g, o.n, x, y + 210, 22);
      });
      ctx.layer(g, { shadow: 6 }, (lg) => drawMapCover(lg, { x: 1780, y: 740, w: 120, h: 170 }));
      label(g, '封皮=卡背', 1772, 950, 20);
    },
  },
  {
    // 时间轴空档（2–25.35、34.10–66.40）：只放索引页，免得体检报空镜
    id: 'sheet_map_index', start: 2, end: 66.4,
    draw(g, T) {
      if (T >= 25.35 && T < 34.1) return;
      bg(g);
      label(g, '地图模型图按真实时间轴取时刻', 96, 120, 44, { family: 'display', fill: PAL.redDark });
      label(g, '[0, 1) 三形态叠图 + 小地图 r / walked　　[1, 2) 风琴折 + 城名环形字 + 蜡笔手 + 小地图翻面折起', 96, 200, 28);
      label(g, '[25.35, 34.10) b03 立誓蜡笔地图　　[66.40, 74.45) b06 间奏一羊皮纸地图', 96, 250, 28);
    },
  },
  {
    id: 'sheet_map_crayon', start: 25.35, end: 34.1,
    draw(g, T, lt, ctx) {
      g.fillStyle = PAL.woodDark; g.fillRect(0, 0, W, H);
      const c = crayonCam(T);
      const st = crayonState(T);
      ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
        lg.save(); applyCam(lg, c, 1);
        drawCrayonMap(lg, T, st);
        if (T >= 25.5 && T < 33.45) {
          const enter = clamp((T - 25.5) / 0.2);
          const tip = crayonTip(T);
          drawCrayon(lg, { tip: [tip[0] - (1 - enter) * 500, tip[1] + (1 - enter) * 400], ang: 2.3, t: T, press: 0.5 + 0.5 * Math.sin(T * 30) });
        }
        lg.restore();
      });
      ctx.fx.paper = 0.3; ctx.fx.vignette = 0.2;
    },
  },
  {
    id: 'sheet_map_parch', start: 66.4, end: 74.45,
    draw(g, T, lt, ctx) {
      g.fillStyle = PAL.woodDark; g.fillRect(0, 0, W, H);
      const c = parchCam(T);
      const st = parchState(T);
      ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
        lg.save(); applyCam(lg, c, 1);
        drawParchmentMap(lg, T, st);
        lg.restore();
      });
      ctx.fx.vignette = 0.32;
    },
  },
];
