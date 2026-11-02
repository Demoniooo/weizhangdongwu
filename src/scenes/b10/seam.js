// b10 → b11 隐形接缝（120.97）：从 src/scenes/_seams.js 的合同读值，接近接缝时把本块的参数“落到”合同状态。
import { SEAMS, resolveParams, withDrift as seamWithDrift, drawSeamStalactites } from '../_seams.js';
import { clamp, lerp } from '../../core/util.js';

export const SEAM = SEAMS['b10|b11'];
export const SEAM_T = SEAM.T;
const ITEMS = [...(SEAM.actors || []), ...(SEAM.props || []), ...(SEAM.ui || [])];
export const seamItem = (id) => ITEMS.find((x) => x.id === id);
/** 合同里某元素在 T 的参数（E = { T, c, A }）。 */
export const seamParams = (id, T, E = {}) => resolveParams(seamItem(id).params, T, { T, A: {}, ...E });
export const seamLayer = (id) => SEAM.layers.find((L) => L.id === id).o;
export const seamEnv = (T) => resolveParams(SEAM.env.params, T, {});
export const seamFx = (T) => resolveParams(SEAM.fx || {}, T, {});
/** 合同机位（含漂移）。 */
export const seamCamOf = (base, T) => seamWithDrift(base, T, SEAM.drift);

/** 数值 / 数组 / 对象逐项从 a 插到 b（非数值在 k ≥ 0.5 时取 b；b 里没有的键保留 a）。k ≥ 1 时直接返回 b 的副本（保证接缝处逐项相等）。 */
export function land(a, b, k) {
  if (k >= 1) return b;
  if (k <= 0 || a === undefined) return k <= 0 ? a : b;
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, k);
  if (Array.isArray(a) && Array.isArray(b)) return b.map((v, i) => land(a[i], v, k));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const o = { ...a };
    for (const key in b) o[key] = land(a[key], b[key], k);
    return o;
  }
  return k < 0.5 ? a : b;
}
export const clamp01 = (x) => clamp(x);
export { drawSeamStalactites };
