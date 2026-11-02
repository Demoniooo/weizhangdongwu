// b13 · 纸剧场（二）+ 救出：HP 1、最后、名字之剑、战胜、落败、救出、公主全名（[150.52, 165.35)，docs/storyboard.md「b13」）。
// 入场 150.52 = b12 出场（隐形接缝，剧场状态 theaterState(T) 两块共用）；出场 165.00–165.35 由 b14 画巨大围巾从右往左擦屏。
// 剧场段（150.52–161.13）六个镜头共用同一个 drawStage（同一机位曲线、同一布景函数），镜头边界不跳；
// 161.13 起 drawRescue：龙洞多层视差 + 台口放大冲出屏幕。
import { cue } from '../cues.js';
import { drawStage } from './b13/theater.js';
import { drawRescue } from './b13/rescue.js';

const stage = (g, T, lt, ctx) => { drawStage(g, T, ctx); };

export default [
  // B08 150.52 龙偶把勇者“噗”地吐出来；HP 数到 1、名字牌裂开卡顿；152.80 公主举牌敲笼；153.00 抬头握拳；153.20 站起
  { id: 'b13_hp1', start: cue('B08'), end: cue('B09') - 0.16, draw: stage },
  // 153.30 小锁弹掉、光标跳到「技能」；B09 153.46 选中，子菜单「名字之剑」；153.65「叮」剑柄现身
  { id: 'b13_skill', start: cue('B09') - 0.16, end: cue('B10'), draw: stage },
  // B10 153.78 起 13 个字逐字剥下接成剑刃（a/b/c 三段）、围巾缠柄；156.00 捅破右侧幕；156.40 拉到 TT-OUT；156.80 竖起撕开顶幕
  { id: 'b13_sword', start: cue('B10'), end: cue('B11'), draw: stage },
  // B11 157.17 劈下：竖直斩线、MAX 冲击、台板裂开、顶幕两半掉落；慢动作定格
  { id: 'b13_strike', start: cue('B11'), end: cue('B12'), draw: stage },
  // B12 157.80 龙名谢幕：每滚过一字弹飞一节，缩成小蜥蜴；160.30 胜利横幅；160.40 字飞回名字牌；160.60 大幕合拢
  { id: 'b13_shrink', start: cue('B12'), end: cue('E01'), draw: stage },
  // E01 161.13 大幕拉开穿过台口回到龙洞；公主早已推开笼门、勇者砍空；E02 161.65 花瓣字绕着她诞生，164.90 收成花环
  { id: 'b13_rescue', start: cue('E01'), end: cue('E03') + 0.27, draw: (g, T, lt, ctx) => drawRescue(g, T, ctx) },
];
