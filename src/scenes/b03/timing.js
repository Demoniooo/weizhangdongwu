// b03 私有：时刻表与共用小工具。所有时刻 = cue() + 偏移（默认秒）。
import { cue } from '../../cues.js';
import { clamp, lerp, seg } from '../../core/util.js';

export const L06 = cue('L06'); // 20.08 告示拍上
export const L07 = cue('L07'); // 22.11 云缝光柱
export const L08 = cue('L08'); // 24.11 大喊
export const L09 = cue('L09'); // 25.35 剑之誓
export const L10 = cue('L10'); // 28.17 山之誓
export const L11 = cue('L11'); // 30.12 林之誓
export const L12 = cue('L12'); // 32.03 公主之誓
export const L13 = cue('L13'); // 34.00（b04）

export const B_START = L06 - 0.13; // 19.95 块起点（甩镜帘开始，与 b02 重叠到 20.10）
export const WHIP_END = L06 + 0.02; // 20.10 甩镜帘结束 = b02 终点
export const B_END = L13 + 0.10; // 34.10 块终点
export const HANDOFF = L13 - 0.40; // 33.60 b04 心形遮罩开始

// —— 广场段 ——
export const TT = {
  slap: L06 + 0.02, // 20.10 卷着的告示拍上板「啪！」
  push: [L06 + 0.03, L06 + 0.55], // 推到 PL_CROWD
  lean: L06 + 0.32, // 20.40 众人凑近
  back: L06 + 0.87, // 20.95 齐退一步
  tumble: [L06 + 1.17, L06 + 2.07], // 21.25–22.15 风滚草
  whistle: [L06 + 1.27, L06 + 2.02], // 卫兵吹口哨
  beam: L07, // 22.11 云缝裂开
  pan: [L07, L07 + 0.34], // 左摇
  slide: [L07 + 0.14, L07 + 0.94], // 22.25–23.05 跪滑
  stop: L07 + 0.94, // 23.05 停在光圈
  wrapOn: [L07 + 0.92, L07 + 1.01],
  wrapOff: [L07 + 1.19, L07 + 1.31], // 23.30 扯下围巾
  turn: L07 + 0.99, // 23.10 齐刷刷转头
  inhale: [L07 + 1.51, L07 + 1.92], // 23.62–24.03 深吸气
  cu: [L08 - 0.06, L08], // snap 到特写
  shout: L08,
  whipBack: [L08 + 0.14, L08 + 0.39], // 24.25–24.50 甩回全景
  wave0: L08 + 0.13, // 冲击波离开嘴（世界环）
  tear: L08 + 0.49, // 24.60 告示撕下
  cover: L08 + 0.79, // 24.90 盖满屏幕
  flip: [L08 + 0.94, L08 + 1.14], // 25.05–25.25 翻面
  land: L09, // 25.35 平拍在镜头前
};

// —— 地图段 ——
export const MT = {
  hand: [L09 + 0.15, L09 + 0.42], // 25.50 手伸进来
  draw0: L09 + 0.25, // 25.60 开始画线
  atPass: L10 - 0.07, // 28.10 抵达雪山口
  leavePass: L10 + 0.13,
  atForest: L11 - 0.07,
  leaveForest: L11 + 0.08,
  atDragon: L12 - 0.08, // 31.95
  heart: [L12 + 0.27, L12 + 1.07], // 32.30–33.10 画心
  fill: [L12 + 0.97, L12 + 1.17], // 33.00–33.20 涂满
  beat: L12 + 1.17, // 33.20 心跳一下
  push: [L12 + 0.47, L12 + 1.47], // 32.50–33.50 推到交接机位
  handOut: [L12 + 1.19, L12 + 1.47],
  king: [L09 + 0.15, L10 + 0.18, L11 + 0.18, L12 + 0.27, HANDOFF], // 偷看表情：瞪眼 / 挑眉 / 星星眼 / 瀑布泪 / 蹦起
};

/** 平滑 max（软拐角，避免跟拍机位在起跟那一刻速度突变）。 */
export const smax = (a, b, k = 60) => 0.5 * (a + b + Math.sqrt((a - b) * (a - b) + k * k));
export { clamp, lerp, seg };
