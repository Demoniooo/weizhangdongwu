// b05 · 接缝合同读取（不硬编码合同值）：入场 b04|b05 @ N1a、出场 b05|b06 @ I1。
// 合同里每个角色 / 界面 / 布景的参数都按 resolveParams 在当前 T 求值（t 一律 = T），块内在接缝附近直接用它们。
import { SEAMS, resolveParams } from '../_seams.js';

export const S_IN = SEAMS['b04|b05'];
export const S_OUT = SEAMS['b05|b06'];

function itemsOf(S) {
  const m = {};
  if (!S) return m;
  for (const L of [S.actors, S.props, S.ui]) for (const it of L || []) m[it.id] = it;
  return m;
}
export const IN = itemsOf(S_IN);
export const OUT = itemsOf(S_OUT);

/** 某接缝里某元素在 T 的参数（新对象）；没有该元素返回 null。 */
export function seamParams(items, id, T, c) {
  const it = items[id];
  if (!it) return null;
  return resolveParams(it.params, T, { T, c, A: {} });
}
/** 某接缝布景参数（drawThroneRoom 的 o，不含 layer）。 */
export function seamEnv(S, T, c) {
  return S && S.env ? resolveParams(S.env.params, T, { T, c, A: {} }) : null;
}
/** 某接缝里某图层的 ctx.layer 参数（null = 直接画在 g 上）。 */
export function seamLayer(S, id, T, c) {
  const L = S && S.layers.find((l) => l.id === id);
  if (!L || L.o == null) return null;
  return resolveParams(L.o, T, { T, c, A: {} });
}
/** 某接缝 main 图层里人物的画序（不含 env:main）。 */
export function seamOrder(S) {
  const L = S && S.layers.find((l) => l.id === 'main');
  return L ? L.draw.filter((d) => !d.startsWith('env:')) : [];
}
/** follow 界面的世界锚点。 */
export function seamAt(items, id, T, c) {
  const it = items[id];
  return it && it.at ? resolveParams(it.at, T, { T, c, A: {} }) : null;
}
