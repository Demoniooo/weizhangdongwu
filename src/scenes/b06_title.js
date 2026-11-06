// b06 · 间奏一：余波、片名、角色卡、王国地图（全片片头）。[56.89, 74.45)，cue I1（纯音乐 17.51s）。
// 分镜见 docs/storyboard.md「### b06 ·」；私有画法在 src/scenes/b06/。时刻一律 cue('I1') + 偏移（b06/common.js 的 TT）。
//   b06_aftermath [56.89, 60.50)  王座厅：接缝合同 → 国王张嘴「达…」→ 众人扑上去捂嘴「别！」→ 撞断吊绳 → 横幅卷成纸卷弹三级台阶 → 勇者跳过 → 滚向镜头
//   b06_title     [60.20, 63.40)  z1：纸卷碾过镜头揭开深红片名页 → 三层剪纸字立起 → 围巾下划线写全名 → 剪影对峙（62.60 封面帧）
//   b06_cards     [63.40, 66.40)  片名缩到上方 → 四张角色卡发牌、翻开 → 收拢洗牌 → 顶牌翻成卡背
//   b06_map       [66.40, 74.45)  卡背放大成第一片折页 → 风琴折 → 地标 + 城名环 → 小骑士画红虚线 → 图钉 → 拉回 → 扎进王城图标（74.10 起 b07 盖红带）
import { TT } from './b06/common.js';
import { drawAftermath } from './b06/aftermath.js';
import { drawRollOver } from './b06/titlepage.js';
import { drawCardsScene } from './b06/cards.js';
import { drawMapScene } from './b06/mapshot.js';

export default [
  {
    id: 'b06_aftermath',
    start: TT.start,
    end: TT.rollCam1,
    draw(g, T, lt, ctx) { drawAftermath(g, T, ctx); },
  },
  {
    id: 'b06_title',
    start: TT.rollCam0,
    end: TT.shrink0,
    z: 1,
    draw(g, T, lt, ctx) { drawRollOver(g, T, ctx); },
  },
  {
    id: 'b06_cards',
    start: TT.shrink0,
    end: TT.grow0,
    draw(g, T, lt, ctx) { drawCardsScene(g, T, ctx); },
  },
  {
    id: 'b06_map',
    start: TT.grow0,
    end: TT.end,
    draw(g, T, lt, ctx) { drawMapScene(g, T, ctx); },
  },
];
