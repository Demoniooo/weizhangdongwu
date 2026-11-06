// b05 · 勇者名 ×4（[41.90, 56.89)，第一个名字高潮；见 docs/storyboard.md「b05」与 docs/blocks/b05.md）。
// 整块在王座厅里一条连续的机位曲线上（src/scenes/b05/plan.js），所有镜头共用同一个 drawFrame：
// 镜头只是按分镜切出来的时间段（联系表里看得到 id），画面完全由 T 决定，镜头之间不会跳。
// 入场 41.90 = b04|b05 隐形接缝（TR-2S、空对话框、名签「？？？」）；出场 56.89 = b05|b06 隐形接缝（TR-HIGH、圣旨横幅）。
import { cue } from '../cues.js';
import { drawFrame } from './b05/frame.js';

const shot = (id, start, end) => ({ id, start, end, draw: (g, T, lt, ctx) => drawFrame(g, T, ctx) });

export default [
  shot('b05_n1', cue('N1a'), cue('K1') - 0.04),          // 41.90 对话框：8 字正好装下 → 右框鼓出 → 「卜」撞破 → 后四字飞出 → 「翁」撞镜头
  shot('b05_k1', cue('K1') - 0.04, cue('N2a')),          // 45.06 甩到国王格：拢耳「再说一遍？」，「翁」卡在王冠尖；拉回双人，面板降下
  shot('b05_n2', cue('N2a'), cue('K2') - 0.11),          // 45.94 吊线 8 格取名面板：按牌 → 满格 → 挤扁 → 鼓成气球 → 超限 → 断绳 → 崩飞
  shot('b05_k2', cue('K2') - 0.11, cue('N3a')),          // 49.20 snap 国王格：竖指「是不是…」，王冠滑下盖眼
  shot('b05_n3', cue('N3a'), cue('H1') - 0.08),          // 49.83 气球字：吹出 → 互撞缠线 → 越来越小 → 13 根线把国王吊起
  shot('b05_h1', cue('H1') - 0.08, cue('N4a') - 0.1),    // 53.10 甩到勇者格：双拇指「对对！」，牙齿一闪
  shot('b05_n4', cue('N4a') - 0.1, cue('I1')),           // 53.90 金印三连砸：印章字三行越拉越大 → 名签更新 → 圣旨吊成横幅
];
