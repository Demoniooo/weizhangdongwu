// b14 私有：时刻、站位、小工具（只在 b14 内部用）。
import { cue } from '../../cues.js';
import { clamp, lerp } from '../../core/util.js';
import { cam } from '../../core/camera.js';

// —— cue 时刻（一律由 cue() 推出）——
export const E03 = cue('E03'); // 165.08 回到：白马跃出
export const E04 = cue('E04'); // 165.60 城名：第一面塔旗
export const E05 = cue('E05'); // 168.83 国王听说：号声
export const E06 = cue('E06'); // 169.74 卷轴弹开
export const E07 = cue('E07'); // 173.05 红叉章
export const E08 = cue('E08'); // 173.82 龙名第一字
export const E09 = cue('E09'); // 177.00 （b15）

export const T_START = E03 - 0.08; // 165.00 块起点
export const T_END = E09 + 0.2; // 177.20 块终点
export const T_IN_END = E03 + 0.27; // 165.35 b13 重叠结束
export const T_OUT = E09 - 0.2; // 176.80 b15 接管

// —— 入场围巾擦屏 ——
export const WIPE = { t0: T_START, t1: E03 + 0.54 }; // 165.00 → 165.62
/** 围巾擦屏进度 p（drawScarfWipe 的 p）：前快后稳，165.26 前端已出画左，165.55 尾巴离场。 */
export const wipeP = (T) => 1 - Math.pow(1 - clamp((T - WIPE.t0) / (WIPE.t1 - WIPE.t0)), 1.4);

// —— 甩镜落定春天王城 ——
export const WHIP = { t0: E04 - 0.03, t1: E04 + 0.2 }; // 165.57 → 165.80，带由左往右（王城在世界左边）

// —— 王城：推进圆窗 ——
export const PUSH = { t0: E05 - 0.43, t1: E05 + 0.17 }; // 168.40 → 169.00
export const MATCH_T0 = E05 - 0.28; // 168.55 圆形遮罩出现

// —— 王座厅站位（脚底，main 层）——
// 分镜原站位（勇者 620 / 公主 760 / 传令官 980）离台阶只剩 300px，放不下 13 个 ≥48px 的地上字：整排左移，
// 纸卷从传令官脚下一路铺过红毯、台阶前的方砖地，到王座正下方再爬台阶（见 docs/blocks/b14.md）。
export const POS = {
  hero: [360, 880],
  princess: [488, 880],
  herald: [630, 880],
  kingSit: [1580, 660],
};
export const STRIP_Y = 938; // 地上纸卷中线（红毯近缘）

// 王座厅机位（屏幕 y ≥ 900 是字幕带：机位压低，让地上字落在 y ≤ 880）
export const TC = {
  wide: cam(985, 650, 1.0),
  herald: cam(975, 680, 1.25),
  doodle: cam(990, 682, 1.27),
  scroll: cam(1180, 690, 1.3),
  king: cam(1380, 700, 1.34),
};

// —— 小工具 ——
export const mixCam = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), zoom: a.zoom * Math.pow(b.zoom / a.zoom, k), rot: lerp(a.rot || 0, b.rot || 0, k) });
export const withDrift = (c, d) => ({ ...c, x: c.x + d[0], y: c.y + d[1] });
/** 多段关键帧插值：keys = [[t, value], …]，value 为数字；ease 作用在每段上。 */
export function keyed(T, keys, ease = (x) => x) {
  if (T <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (T <= t1) { const [t0, v0] = keys[i - 1]; return lerp(v0, v1, ease(clamp((T - t0) / (t1 - t0)))); }
  }
  return keys[keys.length - 1][1];
}
