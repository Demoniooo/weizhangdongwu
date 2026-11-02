// b15 · 婚礼（第三个高潮）[176.80, 185.47)：E09 王冠落回 + 小皇冠 → E10 公主竖幅垂到城下舞龙 → E11 手放进手里、围巾缠成红绳 → E12 纸鸽拉开勇者横幅、绕尖塔系成蝴蝶结。
// 整块是同一地点（CASTLE 婚礼装）的一条连续机位，四个镜头共用 src/scenes/b15/world.js 的 scene()；镜头只是按 cue 分段命名。
// 入场：176.80–177.20 与 b14 重叠，由本块画圆形羽化遮罩揭开圆窗外侧（z: 1）。出场：185.47 隐形接缝 → b16（_seams.js 'b15|b16'）。
import { cue } from '../cues.js';
import { scene } from './b15/world.js';

const draw = (g, T, lt, ctx) => scene(g, T, ctx);

export default [
  { id: 'b15_bells', start: cue('E09') - 0.2, end: cue('E10'), z: 1, draw },
  { id: 'b15_banner1', start: cue('E10'), end: cue('E11') - 0.14, draw },
  { id: 'b15_hands', start: cue('E11') - 0.14, end: cue('E12'), draw },
  { id: 'b15_gift', start: cue('E12'), end: cue('O01'), draw },
];
