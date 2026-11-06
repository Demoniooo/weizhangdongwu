// b10 巨龙表演轨：龙名升级（D2 不耐烦 → 听岔抽眼角/喷蒸汽/爆青筋 → R1 河豚炸刺 → D3 暴怒）。
import { clamp, lerp, seg, hit, wobble } from '../../core/util.js';
import { outBack, outCubic, inOutSine } from '../../core/ease.js';
import { NAME_TIMES } from '../../ui/type.js';
import { C, WHIP_D2, T_LOW, T_END } from './common.js';
import { D2_TIMES, SONG_EMIT } from './fireletters.js';
import { ITEM_T } from './hero.js';
import { SEAM_T, seamParams, land } from './seam.js';

const D3_TIMES = [...NAME_TIMES('D3a'), ...NAME_TIMES('D3b')];
export { D3_TIMES };
/** D3 机位下龙头落到屏幕约 (1180,250) 的世界头心（dragon 模型图实拍核对值）。 */
/** 听岔：龙头从道具栏右端上方探出来（CV-2S 下屏幕约 (1640,200)）；R1 鼓起时再升高。 */
export const PUFF_HEAD = [1491, 284];
export const ROAR = T_END - 0.27; // 120.70 吼

/** 每块背板的亮度：D1 全亮 → D2 喷出哪个字哪块就暗下去 → 120.70 吼时一齐全亮。 */
function plates(T) {
  return Array.from({ length: 13 }, (_, i) => {
    const te = i < 12 ? D2_TIMES[i] : SONG_EMIT;
    const dim = seg(T, te, te + 0.12);
    const relit = seg(T, ROAR - 0.04, ROAR + 0.08);
    const lit = Math.max(1 - 0.85 * dim, relit);
    const pop = Math.max(0, Math.sin(clamp((T - te) / 0.25) * Math.PI)) * (T >= te ? 1 : 0) + Math.max(0, Math.sin(clamp((T - ROAR - i * 0.008) / 0.12) * Math.PI));
    return { lit, pop: Math.min(1, pop) };
  });
}

/** drawDragon 参数（世界 depth 1）。 */
export function dragonParams(T) {
  const P = plates(T);
  // —— Q1 / 甩镜：name → rise → breathe ——
  if (T < C('D2a')) {
    const k = seg(T, WHIP_D2[0], WHIP_D2[1]);
    return { pose: { from: 'rise', to: 'breathe', k: inOutSine(k) }, t: T, plates: P, eyes: { state: 'angry', pupil: 0.18 }, jaw: 0.3 + 0.5 * k, nostril: k };
  }
  // —— D2：喷火字 ——
  if (T < C('Q2') + 0.2) {
    let jaw = 0.55, head = 0;
    for (const te of [...D2_TIMES.slice(0, 12), SONG_EMIT]) {
      jaw += 0.45 * hit(T, te, 0.12) - 0.25 * Math.exp(-(((T - (te - 0.06)) / 0.04) ** 2));
      head += -6 * hit(T, te, 0.1) + 3 * Math.exp(-(((T - (te - 0.07)) / 0.05) ** 2));
    }
    const angry = 0.2 + 0.25 * seg(T, C('D2b'), C('Q2'));
    return {
      pose: 'breathe', t: T, plates: P, jaw: clamp(jaw, 0.25, 1), nostril: 1,
      eyes: { state: 'angry', pupil: 0.14 }, redden: angry, joints: { head },
    };
  }
  // —— 听岔：面板后的龙，每出一件脸红一级 ——
  if (T < C('R1')) {
    const n = ITEM_T.filter((t) => T >= t + 0.05).length;
    const red = clamp(n / 5 + 0.15 * seg(T, ITEM_T[4], ITEM_T[4] + 0.6));
    const twitch = T >= ITEM_T[0] ? 0.6 + 0.4 * Math.abs(Math.sin(T * 9)) : 0;
    const spikes = 0.32 * outCubic(seg(T, C('M3') + 0.59, C('R1')));
    return {
      pose: 'puffer', x: PUFF_HEAD[0], y: PUFF_HEAD[1] + 6 * Math.sin(T * 2.1), t: T, plates: P, redden: 0.2 + 0.8 * red, jaw: 0.08 + 0.1 * red, nostril: 0.5 + 0.5 * red,
      eyes: { state: 'angry', pupil: 0.12, twitch, red: 0.4 * red },
      steam: [C('M2') + 0.08, C('M2') + 0.58], vein: T >= C('M3') + 0.05 ? outBack(seg(T, C('M3') + 0.05, C('M3') + 0.2), 2.5) : 0,
      spikes, joints: { head: 4 * Math.sin(T * 1.7) },
    };
  }
  // —— R1：河豚炸刺「不对！」——
  if (T < T_LOW) {
    const t0 = C('R1');
    const spikes = Array.from({ length: 13 }, (_, i) => clamp(outBack(seg(T, t0 + i * 0.02, t0 + 0.12 + i * 0.02), 2.4), 0, 1.15));
    const puff = clamp(outBack(seg(T, t0, t0 + 0.16), 2.2), 0, 1.15);
    const breath = seg(T, C('R1') + 0.12, C('R1') + 0.2) * (1 - seg(T, C('R1') + 0.5, C('R1') + 0.62));
    return {
      pose: 'puffer', x: PUFF_HEAD[0] + 30 * puff, y: PUFF_HEAD[1] - 62 * puff, t: T, plates: P, spikes, puff, redden: 1, vein: 1, jaw: 0.55 + 0.4 * breath, nostril: 1,
      eyes: { state: 'angry', pupil: 0.1, red: 0.7, twitch: 1 }, joints: { head: -16 * breath + 4 * wobble(T, t0, 6, 0.15) },
    };
  }
  // —— D3：直立在名字墙后（合同：wall 预设位置），每砸一块嘴张大一点，120.70 吼到最大 ——
  const landed = D3_TIMES.filter((t) => T >= t).length;
  const roar = outBack(seg(T, ROAR - 0.1, ROAR + 0.06), 1.8);
  const jaw = Math.max(lerp(0.12, 0.62, landed / 13) + 0.05 * hit(T, D3_TIMES[Math.max(0, landed - 1)], 0.1), roar);
  const settle = 1 - seg(T, ROAR + 0.05, SEAM_T - 0.06);
  const mine = {
    pose: 'wall', t: T, jaw: clamp(jaw), wings: 1,
    eyes: { state: 'angry', red: 0.5 * Math.max(0.6, roar) },
    spikes: 0.3 + 0.2 * roar, redden: lerp(0.75, 0.4, roar), vein: 1, plates: P,
    joints: { head: (12 * hit(T, ROAR, 0.18) * roar - 3 * seg(T, T_LOW, ROAR - 0.1) * (1 - roar)) * settle },
  };
  const k = seg(T, SEAM_T - 0.2, SEAM_T - 0.03);
  return k > 0 ? land(mine, seamParams('dragon', T), k) : mine;
}
export { outBack, outCubic, inOutSine, lerp };
