// b07 私有：时刻表、通用小工具、HUD 层（左上角色卡 + 右上小地图 + V08 经验条 / 徽章 / 飞金币等屏幕元素）。
// 时刻一律由 cue() 推出；HUD 状态一律取 journey.hudState(T)（90.00 接缝两边同一个函数）。
import { cue } from '../../cues.js';
import { clamp, lerp, seg } from '../../core/util.js';
import { hudState } from '../../env/journey.js';
import { drawMiniMap } from '../../env/map.js';
import { drawHUD } from '../../ui/kit.js';

// ———————————————————— 时刻 ————————————————————
export const V01 = cue('V01'), V02 = cue('V02'), V03 = cue('V03'), V04 = cue('V04');
export const V05 = cue('V05'), V06 = cue('V06'), V07 = cue('V07'), V08 = cue('V08'), V09 = cue('V09');
/** 块范围 [74.10, 90.00)。 */
export const T_START = +(V01 - 0.3).toFixed(3);  // 浮点尾数会让 74.1 那一帧落空，取到毫秒
export const T_END = +(V09 - 0.15).toFixed(3);
/** 交接：红带盖满全屏的时刻（74.30）、重叠结束（74.45）。 */
export const T_FULL = V01 - 0.1;
export const T_OVER = V01 + 0.05;
/** 城门拱换景：左墩中线（= PLAZA / JOURNEY 接缝）过屏幕中线的时刻（81.00）与扫过速度（屏幕 px/s）。 */
export const T_GATE = V04 + 0.78;
export const GATE_V = 8000;
export const gateSeamX = (T) => 960 + (T_GATE - T) * GATE_V;
/** 城门拱完全扫出画左的时刻（右墩右缘 = 接缝 + 1420）。之后不再画广场。 */
export const T_GATE_OUT = T_GATE + (960 + 1420) / GATE_V;
/** 城门拱左缘进画的时刻（左墩左缘 = 接缝 − 220 到 1920）。之前不画旅途。 */
export const T_GATE_IN = T_GATE - (1920 + 220 - 960) / GATE_V;

// ———————————————————— 小工具 ————————————————————
export const k01 = (T, a, b, fn) => { const u = seg(T, a, b); return fn ? fn(u) : u; };
/** 阻尼余振（at 之后 freq Hz、decay 秒衰减），at 之前为 0。 */
export const ring = (T, at, freq = 3, decay = 0.3) => (T < at ? 0 : Math.exp(-(T - at) / decay) * Math.sin(2 * Math.PI * freq * (T - at)));
export const bell = (T, a, b) => { const u = seg(T, a, b); return Math.sin(Math.PI * u); };
export const mix2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
export const clamp01 = (x) => clamp(x, 0, 1);

/** 二次贝塞尔点。 */
export const qbez = (p0, p1, p2, u) => {
  const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
  return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]];
};
/** 三次贝塞尔点。 */
export const cbez = (p0, p1, p2, p3, u) => {
  const v = 1 - u;
  const a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
};

/**
 * HUD 层：左上角色卡 + 右上小地图（+ extra(lg, anchors) 叠在卡片之后的屏幕元素）。
 * 一律 drawHUD(g, { ...hudState(T), t: T })；小地图 drawMiniMap(g, T, hudState(T).mini)。
 */
export function drawHudLayer(g, T, ctx, extra) {
  const hs = hudState(T);
  let anchors = null;
  if (hs.show <= 0 && hs.mini.show <= 0 && !extra) return { anchors, hs }; // 还没滑入：不开缓冲
  ctx.layer(g, { shadow: 8 }, (lg) => {
    anchors = drawHUD(lg, { ...hs, t: T });
    drawMiniMap(lg, T, hs.mini);
    if (extra) extra(lg, anchors, hs);
  });
  return { anchors, hs };
}
