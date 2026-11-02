// b13 私有：时刻表（一律 cue + 偏移）、机位漂移、小工具。
import { cue } from '../../cues.js';
import { cam, drift } from '../../core/camera.js';
import { NAME_TIMES } from '../../ui/type.js';

export const B08 = cue('B08'), B09 = cue('B09'), B10 = cue('B10'), B11 = cue('B11'), B12 = cue('B12');
export const E01 = cue('E01'), E02 = cue('E02'), E03 = cue('E03');
/** 块的右端（b14 围巾擦屏 165.00–165.35 期间照常画）。 */
export const END = E03 + 0.27;
/** 名字之剑 13 个字的唱出时刻（B10a / b / c）。 */
export const PEEL = [...NAME_TIMES('B10a'), ...NAME_TIMES('B10b'), ...NAME_TIMES('B10c')];
/** 剥字：字在唱出前 0.05s 离开名字牌窗口，0.17s 后落进剑刃槽（重音 = 落槽，cue + 0.12）。 */
export const PEEL_LEAD = 0.05, PEEL_FLY = 0.17;
/** B12 谢幕：龙名字牌 center 模式 2.4s 滚完，第 k 字过中线 = 第 k 节弹飞（与 theaterState.popAt 一致：157.80 起每 0.2s）。 */
export const POP_SPAN = 2.4;
export const POP_AT = Array.from({ length: 13 }, (_, k) => B12 + (POP_SPAN / 12) * k);
/** 160.40 起 13 个字飞回名字牌（每字错峰 0.028s，飞 0.22s）。 */
export const RET0 = B12 + 2.6, RET_STEP = 0.028, RET_FLY = 0.22;

/** 全片统一漂移（与 _seams.js 的 withDrift 同一公式：主体层在屏幕上平移 (dx, dy) px）。 */
export const DRIFT = { amp: 5, speed: 0.35, seed: 3 };
export function withDrift(c, T, d = DRIFT) {
  const [dx, dy] = drift(T, d);
  return cam(c.x + dx / c.zoom, c.y + dy / c.zoom, c.zoom, c.rot);
}
export const DEG = Math.PI / 180;
/** 二次贝塞尔点。 */
export const qbez = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
