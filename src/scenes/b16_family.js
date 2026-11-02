// b16 · 名字变短、童话结局、有了孩子、长大、王浩然（[185.47, 197.77)，见 docs/storyboard.md）。
// 两段连续的“演员表”：王城（b16/castle.js，O01–O02）与王座厅夜景（b16/throne.js，O03–O06），镜头只负责切分与翻页。
import { pageTurn } from '../fx/transitions.js';
import { seg, lerp } from '../core/util.js';
import { inOutSine } from '../core/ease.js';
import { drawCastleScene } from './b16/castle.js';
import { drawThroneScene } from './b16/throne.js';
import { TT, O1, O2, O4, O5, O7 } from './b16/common.js';

export default [
  {
    // O01 185.47「唰！」横幅弹回成名签 → 推到阳台跳舞
    id: 'b16_short', start: O1, end: O2,
    draw(g, T, lt, ctx) { drawCastleScene(g, T, ctx); },
  },
  {
    // O02 187.75 拉回 CA-W：夕阳全家福；188.80 画框长出、压平成插画
    id: 'b16_storybook', start: O2, end: TT.turn0,
    draw(g, T, lt, ctx) { drawCastleScene(g, T, ctx); },
  },
  {
    // 189.40–189.95 翻页（太阳 → 月亮）；O03 189.75 摇篮立起，婴儿弹起
    id: 'b16_baby', start: TT.turn0, end: TT.ruler0,
    draw(g, T, lt, ctx) {
      if (T < TT.turn1) {
        drawCastleScene(g, T, ctx, { page: true });
        const p = inOutSine(seg(T, TT.turn0, TT.turn1));
        pageTurn(ctx, g, T, { t0: TT.turn0, t1: TT.turn1, see: 0.22 }, (g2) => drawThroneScene(g2, T, ctx, { pageK: p }));
        // 整帧后期在两页之间按翻页进度过渡（旧页：纸纹 0.30 / 暗角 0.35；新页：夜景对比）
        ctx.fx.paper = lerp(0.3, 0.22, p);
        ctx.fx.sat = 1;
      } else drawThroneScene(g, T, ctx);
    },
  },
  {
    // O04 191.66 身高尺 + 四季翻牌（191.50 起机位左移到 TR-RULER 并锁死）
    id: 'b16_grow', start: TT.ruler0, end: TT.back0,
    draw(g, T, lt, ctx) { drawThroneScene(g, T, ctx); },
  },
  {
    // O05 193.73 长名卷轴被推开、取名面板降下；O06 195.72「王浩然」落格、收拢、对勾章、松口气
    id: 'b16_naming', start: TT.back0, end: O7,
    draw(g, T, lt, ctx) { drawThroneScene(g, T, ctx); },
  },
];
void O4; void O5;
