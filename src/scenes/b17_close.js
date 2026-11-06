// b17 · 全名太难念、合上书、片尾（[197.77, 208.10)，docs/storyboard.md「b17」）。
// 镜头：王座厅（接缝 b16|b17 入场，小签 → 一拽 → 卷轴射向玫瑰窗）→ 圆窗拉出 + 夜城卷轴路 → 拉远成书、纸手合书 → 片尾卡。
// 私有辅助：src/scenes/b17/hall.js（王座厅）、outside.js（圆窗拉出与卷轴路）、book.js（立体书、合书、片尾卡）。
import { cue } from '../cues.js';
import { drawHall, T_OUT } from './b17/hall.js';
import { drawOutside, T_BOOK } from './b17/outside.js';
import { drawBookFrame } from './b17/book.js';

const O07 = cue('O07'), END = cue('END');

export default [
  {
    // O07 197.77「全名」小签垂下（重音）→ 197.95 孩子一拽 → 198.05 卷轴像礼花一样射出 → 198.08–198.50 机位上摇推到玫瑰窗
    id: 'b17_fullname',
    start: O07,
    end: T_OUT,
    draw(g, T, lt, ctx) { drawHall(g, T, ctx); },
  },
  {
    // 198.50–198.90 圆窗拉出（E05 的反向）落到 CASTLE 夜景 CA-W；198.47–199.50 卷轴绕主堡上空、落到城门外、沿山路铺向天边
    id: 'b17_scrollroad',
    start: T_OUT,
    end: T_BOOK,
    draw(g, T, lt, ctx) { drawOutside(g, T, ctx); },
  },
  {
    // 199.30–199.66 拉回成书（bookPushCam 反向）→ O08 199.66 纸手按住书页 → 折倒 → 200.30 合书「啪！」→ 镜头回到封面 → OUT 片尾卡 → 206.40 关灯 → END 淡出
    id: 'b17_book',
    start: T_BOOK,
    end: END,
    draw(g, T, lt, ctx) { drawBookFrame(g, T, ctx); },
  },
];
