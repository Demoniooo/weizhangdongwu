// b01 · 绘本开场 —— 与 b02 共用的立体王城选项（b01→b02 交接 9.50–10.00 逐像素一致的前提，见 docs/api/castle.md 5.2 / 5.3 / 7）。
//
// 用法（b02 侧，交接遮罩里画 CASTLE 世界时用同一份选项）：
//   import { CASTLE_OPTS, castleOpts, drawBalconyPrincess, PRINCESS } from './b01/shared.js';
//   world(lg, T, ctx, bookCastleCam(T), castleOpts(T));      // 推荐：公主随 T 动（与 b01 完全同一个函数）
//   world(lg, T, ctx, bookCastleCam(T), CASTLE_OPTS);        // 也可以：静态对象（公主定格在保持姿态）
// 两种写法在 9.45 ≤ T ≤ 10.39 画出的公主逐像素相同：b01 让公主在 PRINCESS.hold（9.45）之后定格在
// “提着水壶、抬眼看镜头”的保持姿态（纯音乐段动作链停在清楚的姿态上），所以交接期无论 b02 用哪一种都一致。
// b02 从 L01（10.39）起接手浇花时，以 PRINCESS 的站位 / 朝向 / 保持姿态为起点插值即可（pose:'idle' → 'water'）。
//
// 纯函数：只由 T 决定；不调 ctx.layer / ctx.mask。
import { drawPrincess } from '../../rigs/princess.js';
import { seg } from '../../core/util.js';
import { cue } from '../../cues.js';

const I0 = cue('intro');

/** 阳台上的公主：主体层世界坐标（脚踩 floorY 590），s=0.26；朝左面向花箱（L01 浇花的方向）。 */
export const PRINCESS = {
  x: 948,
  s: 0.26,
  face: -1,
  /** 立体书里弹出的时刻（= book.bookPopupAt 的 princess 段 7.90–8.20） */
  popAt: I0 + 7.9,
  /** 此后（到 L01 10.39）定格在保持姿态：所有随 t 的次级运动冻结在这一刻 */
  hold: I0 + 9.45,
  /** 保持姿态的眼神 / 头部（抬眼看镜头） */
  look: [-0.25, -0.45],
  head: -7,
};

const blinkOnce = (T, at, dur = 0.16) => (T >= at && T < at + dur ? Math.sin((Math.PI * (T - at)) / dur) : 0);

/** 举水壶的两个手臂姿态（joints 增量，叠在 idle 上）：HIGH 高举「当当！」，FWD 提到花箱上方（保持姿态 = FWD）。 */
const ARM_HIGH = { armR: 70, elbowR: 70, wristR: -30 };
const ARM_FWD = { armR: 60, elbowR: 40, wristR: 0 };
const sm = (x) => x * x * (3 - 2 * x);

/**
 * 公主在时刻 T 的参数（drawPrincess 的 o，不含 x/y）。
 * 7.90 弹出：高举水壶、笑眯眼（「当当！」）→ 8.30–8.60 把水壶放到花箱上方、睁眼看花 → 8.80 眨一下（先想后动）
 * → 8.90–9.25 抬眼看镜头 → 9.45 起定格（保持姿态，b02 从这里接 L01 浇花）。
 */
export function princessParams(T) {
  const P = PRINCESS;
  const t = Math.min(T, P.hold);
  const lower = sm(seg(t, I0 + 8.3, I0 + 8.6));
  const up = sm(seg(t, I0 + 8.9, I0 + 9.25));
  const lookDown = [0.35, 0.3];
  const look = [lookDown[0] + (P.look[0] - lookDown[0]) * up, lookDown[1] + (P.look[1] - lookDown[1]) * up];
  const joints = { head: P.head * up };
  for (const k of Object.keys(ARM_FWD)) joints[k] = ARM_HIGH[k] + (ARM_FWD[k] - ARM_HIGH[k]) * lower;
  return {
    s: P.s,
    face: P.face,
    t,
    pose: 'idle',
    item: 'can',
    pour: 0,
    expr: t < I0 + 8.35 ? 'laugh' : 'smile',
    look,
    blink: blinkOnce(t, I0 + 8.8),
    joints,
  };
}

/** onBalcony 回调的实体：在阳台（门前、栏杆后）画公主。a = drawCastle 传来的 { popup, floorY, railY, depth }。 */
export function drawBalconyPrincess(g, T, a) {
  return drawPrincess(g, { x: PRINCESS.x, y: a.floorY, ...princessParams(T) });
}

/** 推荐：随 T 变化的城堡选项（b01 立体件、b02 交接世界都用它）。 */
export const castleOpts = (T) => ({ time: 'dawn', onBalcony: (g, a) => drawBalconyPrincess(g, T, a) });

/** 静态版（docs/api/castle.md 5.2 / 5.3 的写法）：公主定格在保持姿态；9.45–10.39 与 castleOpts(T) 逐像素一致。 */
export const CASTLE_OPTS = { time: 'dawn', onBalcony: (g, a) => drawBalconyPrincess(g, PRINCESS.hold, a) };
