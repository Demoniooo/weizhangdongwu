// b07 · 出发：登场、上马、希望、出城、打怪、金币、伤痕、慢慢升级（[74.10, 90.00)，见 docs/storyboard.md）。
// 入场：74.10–74.30 在 b06 之上把地图红虚线合拢成红带、红带涨满全屏；74.30 起红色就是广场里勇者围巾的特写，拉开 → 一甩 → 顺着围巾拉到亮相。
// 出场：90.00 隐形接缝（大橡树后），机位 / 勇者 / 白马 / HUD / 小地图全部来自 journey.js 与 _seams.js 合同的共享函数。
import { PAL } from '../core/paper.js';
import { clamp, lerp, seg } from '../core/util.js';
import { inCubic, outCubic } from '../core/ease.js';
import { drawScarfBand } from '../props/scarf.js';
import { journeyFx } from './_seams.js';
import { V01, V02, V03, V04, V05, V06, V07, V08, T_START, T_END, T_FULL, T_OVER, T_GATE_IN, T_GATE_OUT, gateSeamX, drawHudLayer, k01 } from './b07/common.js';
import { drawPlazaWorld, drawPlazaFg, drawGate, BAND_ANG, BAND_W } from './b07/plaza.js';
import { drawRoadWorld, drawRoadUI } from './b07/road.js';

// ———————————————————— 交接：红虚线合拢 → 红带涨满全屏（画在 b06 之上） ————————————————————
function drawBand(g, T, ctx) {
  const p = outCubic(k01(T, T_START, T_START + 0.13));
  const grow = inCubic(k01(T, T_START + 0.08, T_FULL - 0.004));
  const width = BAND_W * Math.exp(Math.log(2500 / BAND_W) * grow);
  ctx.layer(g, { shadow: 10 }, (lg) => {
    drawScarfBand(lg, T, { p, angle: BAND_ANG, width, wave: 0.25 * p * (1 - grow), t: T, length: 3200 });
  });
}

// ———————————————————— 广场段（PLAZA 晴晨） ————————————————————
function plazaShot(g, T, ctx, merge) {
  ctx.fx.sat = 1.05;
  drawPlazaWorld(g, T, ctx, { merge, noFg: merge });
  drawHudLayer(g, T, ctx);
}

// ———————————————————— 出城：城门拱扫过，左边广场 / 右边旅途 ————————————————————
function departShot(g, T, ctx) {
  if (T < T_GATE_IN) { plazaShot(g, T, ctx, false); return; }
  if (T >= T_GATE_OUT) { roadShot(g, T, ctx); return; }
  const sx = gateSeamX(T);
  const fxJ = journeyFx(T);
  const kJ = clamp(1 - sx / 1920);
  ctx.fx.sat = lerp(1.05, fxJ.sat, kJ);
  const pw = drawPlazaWorld(g, T, ctx, { merge: true, noFg: true, clipLeft: sx });
  drawRoadWorld(g, T, ctx, { clipX: [sx, 99999], merge: true, noOcc: true, fgExtra: (lg) => drawPlazaFg(lg, T, pw.c, sx) });
  ctx.layer(g, { blur: 3, shadow: 14 }, (lg) => drawGate(lg, T, sx));
  drawHudLayer(g, T, ctx);
}

// ———————————————————— 旅途一镜到底 ————————————————————
function roadShot(g, T, ctx) {
  const fx = journeyFx(T);
  ctx.fx.sat = fx.sat; ctx.fx.tint = fx.tint; ctx.fx.tintAlpha = fx.tintAlpha; ctx.fx.tintMode = fx.tintMode;
  drawRoadWorld(g, T, ctx);
  drawHudLayer(g, T, ctx, (lg, anchors, hs) => drawRoadUI(lg, T, anchors, hs));
}

export default [
  { id: 'b07_band', start: T_START, end: T_FULL, z: 1, draw: (g, T, lt, ctx) => drawBand(g, T, ctx) },
  { id: 'b07_scarf_cu', start: T_FULL, end: T_OVER, z: 1, draw: (g, T, lt, ctx) => plazaShot(g, T, ctx, true) },
  { id: 'b07_hero', start: T_OVER, end: V02, draw: (g, T, lt, ctx) => plazaShot(g, T, ctx, false) },
  { id: 'b07_horse', start: V02, end: V03, draw: (g, T, lt, ctx) => plazaShot(g, T, ctx, false) },
  { id: 'b07_hope', start: V03, end: V04, draw: (g, T, lt, ctx) => plazaShot(g, T, ctx, false) },
  { id: 'b07_depart', start: V04, end: V05, draw: (g, T, lt, ctx) => departShot(g, T, ctx) },
  { id: 'b07_slime', start: V05, end: V06, draw: (g, T, lt, ctx) => roadShot(g, T, ctx) },
  { id: 'b07_coins', start: V06, end: V07, draw: (g, T, lt, ctx) => roadShot(g, T, ctx) },
  { id: 'b07_scars', start: V07, end: V08, draw: (g, T, lt, ctx) => roadShot(g, T, ctx) },
  { id: 'b07_levelup', start: V08, end: T_END, draw: (g, T, lt, ctx) => roadShot(g, T, ctx) },
];
void PAL; void seg; void V06;
