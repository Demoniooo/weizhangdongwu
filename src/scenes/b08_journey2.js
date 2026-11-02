// b08 · 村庄、宝箱、风霜、月光、闯进山洞（[90.00, 99.60)，见 docs/storyboard.md「### b08 ·」与 4.6 旅途长卷）。
// 与 b07 共用的“一镜到底”旅途世界：机位 / 勇者与白马 / HUD / 小地图一律取 src/env/journey.js 的共享函数；
// 五个镜头按 cue 分段，画的是同一个连续世界（drawFrame），段与段之间没有任何切换。
// 入场：b07|b08 隐形接缝 90.00（藏在大橡树后）；出场：b09 在 98.60–99.60 用洞口杏仁遮罩随推镜接走（本块照常画到 99.60）。
import { cue } from '../cues.js';
import { drawFrame } from './b08/frame.js';
import { SEAMS } from './_seams.js';

const V10 = cue('V10'), V11 = cue('V11'), V12 = cue('V12'), V13 = cue('V13');
const START = SEAMS['b07|b08'].T; // 90.00（= V09 − 0.15 = docs/blocks.json start，b07|b08 接缝）
const END = cue('V14') - 0.37; // 99.60（= docs/blocks.json end）

const draw = (g, T, lt, ctx) => drawFrame(g, T, ctx);

export default [
  // V09 90.15：大橡树扫过后金色午后的村庄全貌，风车开转、纸鸽飞起；勇者四处张望、笑；一只鸡横穿
  { id: 'b08_village', start: START, end: V10, draw },
  // V10 91.97：拔剑一挥，92.00 起剑尖挑开五个容器，道具飞进背包；主人下巴掉地、老奶奶抱罐、老爷爷晕倒；半雪松扫过
  { id: 'b08_chests', start: V10, end: V11, draw },
  // V11 94.04：风雪迎面，围巾被吹直冻成木板；积雪越堆越高；95.20 喷嚏震飞积雪、围巾“咔”地裂开；雪崖扫过
  { id: 'b08_snow', start: V11, end: V12, draw },
  // V12 95.85：月亮第一次升起，星星逐颗亮起，月光把石板一块块照成银色光路；全速疾驰；黑树干三连
  { id: 'b08_moon', start: V12, end: V13, draw },
  // V13 98.04：洞口前急刹扬尘、白马人立发抖；勇者下马，白马躲进岩石；勇者独自走向洞口被紫光勾成剪影；推镜进洞口
  { id: 'b08_cave_mouth', start: V13, end: END, draw },
];
