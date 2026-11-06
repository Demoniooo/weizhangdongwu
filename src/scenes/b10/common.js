// b10 私有辅助：时刻、机位时间线、龙洞分层绘制、公主笼。
// 纯函数：只由 T 决定；模块级只有常量。
import { cue } from '../../cues.js';
import { PAL } from '../../core/paper.js';
import { cam, applyCam, lerpCam, drift } from '../../core/camera.js';
import { ez, glide, snap, whip, outCubic } from '../../core/ease.js';
import { seg, clamp } from '../../core/util.js';
import { drawCave, CAMS, CAVE, groundAt } from '../../env/cave.js';
import { drawCage } from '../../props/cave.js';
import { drawPrincess } from '../../rigs/princess.js';
import { SEAM, seamCamOf } from './seam.js';

export const C = (id) => cue(id);
export const DEG = Math.PI / 180;

// ———————— 关键时刻（一律 cue + 偏移） ————————
export const T0 = C('Q1') - 0.15;            // 109.00 块起点（与 b09 重叠 0.15s，甩镜帘）
export const WHIP_IN = [T0, C('Q1')];        // 入场横向甩镜帘
export const WHIP_D2 = [C('D2a') - 0.16, C('D2a')]; // 109.60–109.76 甩镜到 CV-W
export const SNAP_Q2 = [C('Q2'), C('Q2') + 0.14];   // 113.31–113.45 snap 推回 CU-H
export const PULL_MH = [C('M1') - 0.13, C('M1') + 0.27]; // 113.70–114.10 拉回 CV-2S
export const PUSH_R1 = [C('M3') + 0.19, C('R1')];    // 116.40–117.03 略推向道具栏
export const BURN = [C('R1') + 0.15, C('R1') + 0.47];   // 117.18–117.50 燃烧边扫过
export const SMOKE = { t0: C('R1') + 0.37, tFull: C('R1') + 0.51, t1: C('R1') + 0.71 }; // 117.40 / 117.54 / 117.74
export const T_LOW = SMOKE.tFull;            // 灰烟盖满那一刻换到 CV-LOW
export const T_END = C('I2');                // 120.97 隐形接缝

// ———————— 机位 ————————
export const CU_H = CAMS.CU_H_CAVE;          // cam(500,720,3.4) 勇者格（洞）
const CU_H_PUSH = cam(512, 708, 3.62);       // Q1 情绪推近
const CU_H_Q2 = cam(506, 712, 3.5);
export const CV_W = CAMS.CV_W;
const CV_W_D2B = cam(930, 560, 1.07);        // D2b 越喷越凶，慢推
export const CV_2S = CAMS.CV_2S;
const CV_PUSH = cam(884, 533, 1.22);         // M3→R1 略推向道具栏与龙脸（龙头落到屏幕约 (1700,170)）
export const CV_LOW = CAMS.CV_LOW;
export const CV_LOW_END = CAMS.CV_LOW_END;
/** 全片统一漂移（与 _seams.js 的 DRIFT / withDrift 同一公式）。 */
export const DRIFT = Object.freeze({ amp: 5, speed: 0.35, seed: 3 });
export function withDrift(c, T, d = DRIFT) {
  const [dx, dy] = drift(T, d);
  return cam(c.x + dx / c.zoom, c.y + dy / c.zoom, c.zoom, c.rot || 0);
}

/** Q1 段机位（甩镜帘两侧共用）。 */
export const camQ1Base = (T) => lerpCam(CU_H, CU_H_PUSH, ez(T, C('Q1'), C('Q1') + 0.5, glide));
/** D2 段机位。 */
export const camD2Base = (T) => lerpCam(CV_W, CV_W_D2B, ez(T, C('D2b') - 0.2, C('Q2') - 0.1, glide));
/** 不含漂移的机位时间线（甩镜帘期间由镜头分别取两侧）。 */
export function baseCam(T) {
  if (T < WHIP_D2[1]) return camQ1Base(T);
  if (T < SNAP_Q2[0]) return camD2Base(T);
  if (T < PULL_MH[0]) {
    const k = ez(T, SNAP_Q2[0], SNAP_Q2[1], snap);
    const a = camD2Base(SNAP_Q2[0]);
    const b = lerpCam(CU_H, CU_H_Q2, ez(T, SNAP_Q2[1], PULL_MH[0], glide));
    return lerpCam(a, b, k);
  }
  if (T < PUSH_R1[0]) return lerpCam(CU_H_Q2, CV_2S, ez(T, PULL_MH[0], PULL_MH[1], glide));
  if (T < T_LOW) return lerpCam(CV_2S, CV_PUSH, ez(T, PUSH_R1[0], PUSH_R1[1] + 0.12, glide));
  return lerpCam(CV_LOW, SEAM.cam, ez(T, C('D3a') + 0.04, C('I2') - 0.07, glide));
}
/** 实际机位（叠漂移；D3 段用合同的漂移参数，接缝处与 drawSeam 同一机位）。 */
export const camAt = (T) => (T >= T_LOW ? seamCamOf(baseCam(T), T) : withDrift(baseCam(T), T));

// ———————— 龙洞分层 ————————
/**
 * 画一帧龙洞：back / mid / main（+ main 回调画角色）/ extra / fg / ui。
 * o: { cave（drawCave 参数）, mid=true, fg=true, back(lg) 已 applyCam(depth0.5), main(lg) 已 applyCam(depth1), mainL / backL（图层选项覆盖）,
 *      over(g) 主体层之后、前景之前的额外图层, ui(g) 最上层 }
 */
export function caveFrame(g, T, ctx, c, o = {}) {
  const co = { light: 'lit', rubble: { at: T_END, cooled: 0 }, ...(o.cave || {}) };
  if (o.backMid) {
    // 省缓冲：远景两层合并成一层
    ctx.layer(g, { shadow: 6, texture: 0.3, ...(o.backL || {}) }, (lg) => {
      drawCave(lg, T, c, { ...co, layer: 'back' });
      drawCave(lg, T, c, { ...co, layer: 'mid' });
    });
  } else {
    ctx.layer(g, { shadow: 6, texture: 0.3, ...(o.backL || {}) }, (lg) => {
      drawCave(lg, T, c, { ...co, layer: 'back' });
      if (o.back) { lg.save(); applyCam(lg, c, 0.5); o.back(lg); lg.restore(); }
    });
    if (o.mid !== false) ctx.layer(g, { shadow: 8, texture: 0.3, ...(o.midL || {}) }, (lg) => drawCave(lg, T, c, { ...co, layer: 'mid' }));
  }
  ctx.layer(g, { shadow: 10, texture: 0.3, ...(o.mainL || {}) }, (lg) => {
    drawCave(lg, T, c, { ...co, layer: 'main' });
    if (o.main) { lg.save(); applyCam(lg, c, 1); o.main(lg); lg.restore(); }
  });
  if (o.over) o.over(g);
  if (o.fg !== false) ctx.layer(g, { blur: 4 }, (lg) => drawCave(lg, T, c, { ...co, layer: 'fg' }));
  if (o.ui) o.ui(g);
}

// ———————— 鸟笼里的公主（不说话也在反应） ————————
/** expr / pose 由镜头按段给；画在 depth 1（调用方已 applyCam）。 */
export function drawCagedPrincess(lg, T, o = {}) {
  const cg = { x: CAVE.cage.x, y: CAVE.cage.y, light: 1, tally: 12, lock: { pins: 0 } };
  drawCage(lg, { ...cg, part: 'back' });
  drawPrincess(lg, {
    x: CAVE.cage.floor[0] + 4, y: CAVE.cage.floor[1], s: CAVE.cage.princessS, face: -1, t: T,
    pose: o.pose || 'pickLock', expr: o.expr, ...(o.extra || {}),
  });
  drawCage(lg, { ...cg, part: 'front' });
}

export { CAMS, CAVE, groundAt, PAL, clamp, seg, outCubic, whip };
