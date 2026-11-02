// 成片镜头表：汇总 src/scenes/ 各块导出的镜头。
import { DURATION } from './cues.js';
import { loadBlocks } from './scenes/index.js';

const blocks = await loadBlocks();

export default {
  duration: DURATION,
  shots: blocks.flat(),
  // 硬切点（默认秒）：运动模糊的子帧不会跨越它们。全片唯一硬切在 18.00（见 storyboard 3.8）。
  cuts: [18.0],
};
