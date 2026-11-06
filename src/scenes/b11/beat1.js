// b11 第一拍：撞墙 · 劈火（120.97–124.00）。120.97 第一帧严格按接缝合同 SEAMS['b10|b11']。
import { PAL } from '../../core/paper.js';
import { cam, applyCam, toScreen } from '../../core/camera.js';
import { clamp, lerp, seg, hit, wobble } from '../../core/util.js';
import { ez, outCubic, inOutSine, inQuad, whip, glide, outQuad, outBack } from '../../core/ease.js';
import { burst } from '../../core/particles.js';
import { drawNameWall, groundAt, CAMS } from '../../env/cave.js';
import { drawDragon, DRAGON_POSES } from '../../rigs/dragon.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawFireBreath, dustDraw } from '../../props/misc.js';
import { bubble } from '../../ui/kit.js';
import { SEAMS, resolveParams, seamCam, drawSeamStalactites } from '../_seams.js';
import { TT, I2, withDrift, camPath, keyv, keyp, hopPos } from './k.js';
import { heroLook, SCARF, caveEnv, caveLayers, drawCageGroup, drawBodySweep } from './common.js';

// 接缝合同：机位 / 布景 / 角色 / 道具 / 界面 / 后期一律从 SEAMS 读，120.97 之后在合同值上叠动画。
export const SEAM = SEAMS['b10|b11'];
const ITEMS = Object.fromEntries([...SEAM.actors, ...SEAM.props, ...SEAM.ui].map((it) => [it.id, it]));
export const seamP = (id, T, E = {}) => resolveParams(ITEMS[id].params, T, E);
const K1 = cam(600, 600, 1.1), K2 = cam(800, 592, 1.1);
export function camB1(T) {
  if (T <= SEAM.T) return seamCam('b10|b11', T);
  return withDrift(camPath(T, [[SEAM.T, SEAM.cam], [TT.whip1, K1, whip], [TT.push0, K1], [TT.land + 0.25, K2, glide]]), T, SEAM.drift);
}

const ALL_LIT = (v) => Array.from({ length: 13 }, () => ({ lit: v }));

/** 巨龙参数（depth 1 世界坐标）。 */
function dragonB1(T) {
  const S0 = seamP('dragon', T);
  if (T <= SEAM.T) return S0;
  const HEAD_WALL = DRAGON_POSES[S0.pose].head;
  const kb = ez(T, TT.start, TT.start + 0.33, outCubic);         // 撞穿墙冲出
  const kl = ez(T, TT.bite - 0.13, TT.bite, inQuad);             // 扑咬
  const kr = ez(T, TT.bite + 0.08, TT.land + 0.2, glide);        // 咬空后收回
  const lunge = kl * (1 - 0.55 * kr);
  const head = keyp(T, [[TT.start, HEAD_WALL], [TT.start + 0.33, [960, 600], outCubic], [TT.fire - 0.05, [900, 606], outQuad], [TT.fire + 0.05, [920, 596], outQuad], [TT.fireOff, [905, 600]], [TT.bite, [470, 668], inQuad], [TT.land + 0.2, [585, 620], glide], [TT.sweep0, [620, 612]]]);
  // 喷火时的后坐与抖动
  const recoil = T > TT.fire && T < TT.fireOff ? 5 * Math.sin((T - TT.fire) * 40) * (1 - seg(T, TT.fire, TT.fireOff)) : 0;
  const pose = kb < 1 ? { from: 'wall', to: 'charge', k: kb } : lunge > 0 ? { from: 'charge', to: 'lunge', k: lunge } : 'charge';
  const jaw = keyv(T, [[TT.start, 1], [TT.start + 0.3, 0.45], [TT.fire - 0.12, 0.25], [TT.fire, 1, outBack], [TT.fireOff - 0.05, 0.95], [TT.fireOff + 0.06, 0.4], [TT.bite - 0.1, 1], [TT.bite, 0.95], [TT.bite + 0.05, 0.06, inQuad], [TT.land, 0.15], [TT.sweep0, 0.35]]);
  return {
    ...S0, pose, t: T, x: head[0] + recoil, y: head[1], jaw, wings: lerp(S0.wings, 0.5, kb),
    eyes: { ...S0.eyes, red: S0.eyes.red * (1 - 0.4 * kb), pupil: 0.14 }, spikes: lerp(S0.spikes, 0.25, kb), redden: lerp(S0.redden, 0.15, kb), vein: lerp(S0.vein, 0.4, kb),
    plates: ALL_LIT(lerp(1, 0.75, kb)), nostril: T > TT.fire - 0.15 && T < TT.fireOff ? 1 : 0.3,
  };
}

/** 勇者参数（depth 1 世界坐标）。A = 本帧巨龙锚点（落在龙脖子上用）。 */
function heroB1(T, A) {
  const H0 = seamP('hero', T);
  if (T <= SEAM.T) return H0;
  const L = heroLook(T);
  const base = { ...H0, ...L, scarf: { ...SCARF } };
  if (T <= TT.roll0) {
    // 合同：抬臂挡脸（剑在背上）；撞墙后被气浪推得一缩
    const x = H0.x - 14 * ez(T, TT.start, TT.start + 0.2, outCubic);
    return { ...base, x, y: groundAt(x), pose: H0.pose, expr: H0.expr, sword: H0.sword, squash: -0.06 * wobble(T, TT.start, 5, 0.18) };
  }
  if (T < TT.roll1) {   // 向左翻滚躲开冲过来的龙
    const k = ez(T, TT.roll0, TT.roll1, inOutSine);
    const x = lerp(136, 40, k);
    return { ...base, x, y: groundAt(x), pose: 'roll', act: k, expr: 'hurt', sword: 'back', scarf: { ...SCARF, vel: [-300, 0] } };
  }
  if (T < TT.plant + 0.02) {  // 起身竖剑
    const k = ez(T, TT.roll1, TT.plant + 0.02, outCubic);
    return { ...base, x: 40, y: groundAt(40), pose: { from: 'roll', to: 'plantSword', k }, act: 1, expr: 'determined', sword: k > 0.5 ? 'hand' : 'back' };
  }
  if (T < TT.push0) {   // 竖剑劈火：被火推得往后滑一点
    const x = 40 - 14 * ez(T, TT.plant, TT.plant + 0.5, outCubic);
    return { ...base, x, y: groundAt(x), pose: 'plantSword', expr: 'determined', squash: -0.05 * wobble(T, TT.plant, 3, 0.3), scarf: { ...SCARF, wind: [-420, -60] } };
  }
  if (T < TT.bite - 0.12) {   // 顶着火 V 往前推
    const k = ez(T, TT.push0, TT.bite - 0.12, inOutSine);
    const x = lerp(26, 205, k);
    return { ...base, x, y: groundAt(x), pose: { from: 'plantSword', to: 'walk', k: 0.3 }, phase: x / 150, jointsAdd: { lean: 10 }, expr: 'determined', scarf: { ...SCARF, wind: [-380, -40] } };
  }
  if (T < TT.vault0) {        // 看见大嘴压下来：蹲身蓄力
    const k = ez(T, TT.bite - 0.12, TT.vault0, outCubic);
    return { ...base, x: 205, y: groundAt(205), pose: { from: 'plantSword', to: 'hop', k }, act: 0.05, expr: 'shock' };
  }
  const neck = A && A.plates ? [A.plates[1][0], A.plates[1][1] - 46] : [700, 520];
  if (T < TT.land) {          // 撑着下颌翻过去，落在龙脖子上
    const k = ez(T, TT.vault0, TT.land, inOutSine);
    const p = hopPos([205, groundAt(205)], neck, k, 230);
    return { ...base, x: p[0], y: p[1] + 58, pose: 'vault', act: k, expr: 'shout', scarf: { ...SCARF, vel: [700, -200] } };
  }
  // 骑在龙脖子上（落地挤压）
  return { ...base, x: neck[0], y: neck[1], pose: { from: 'hop', to: 'stance', k: ez(T, TT.land, TT.land + 0.25) }, act: 0.95, expr: 'determined', squash: -0.18 * wobble(T, TT.land, 4, 0.2), scarf: { ...SCARF, vel: [-500, 0], ground: 1e5 } };
}

/** 勇者竖着的剑刃上、与火柱等高的点（劈火点）。 */
function bladeAt(ho) {
  const r = heroRig(ho);
  const t = 0.55;
  return [lerp(r.hilt[0], r.swordTip[0], t), lerp(r.hilt[1], r.swordTip[1], t)];
}

export function drawBeat1(g, T, ctx) {
  const c = camB1(T);
  const env = T <= SEAM.T ? resolveParams(SEAM.env.params, T) : caveEnv(T);
  // 整帧后期：合同 fx（contrast 1.1 / vignette 0.5 / 120.97 冲击 flash 0.6 + shake 24）
  const fx = resolveParams(SEAM.fx, T, {});
  for (const k in fx) if (fx[k] !== undefined) ctx.fx[k] = fx[k];
  let A = null, ho = null, bubbleAt = null;
  caveLayers(g, T, ctx, c, env, {
    back: (lg) => {
      if (T < TT.start + 0.95) { lg.save(); applyCam(lg, c, ITEMS.stalactites.depth); drawSeamStalactites(lg, seamP('stalactites', T)); lg.restore(); }
    },
    main: (lg) => {
      const pr = seamP('princess', T);
      drawCageGroup(lg, c, T, { pose: pr.pose, expr: pr.expr, lock: seamP('cageFront', T).lock });
      lg.save(); applyCam(lg, c, 1);
      A = drawDragon(lg, dragonB1(T));
      const wp = seamP('wall', T);
      drawNameWall(lg, wp.t, wp);
      // 撞墙扬尘
      if (T > TT.start) burst(lg, T, { at: TT.start + 0.02, seed: 1121, count: 16, x: 760, y: 880, spread: 300, speed: [120, 420], angle: [-3.0, -0.2], gravity: -40, drag: 2.2, life: [0.5, 0.9], size: [18, 34] }, dustDraw);
      if (T >= TT.roll1) burst(lg, T, { at: TT.roll1 - 0.04, seed: 1122, count: 10, x: 50, y: groundAt(50), spread: 30, speed: [60, 200], angle: [-2.9, -0.3], gravity: -20, life: [0.4, 0.8], size: [18, 34] }, dustDraw);
      // 火柱之前勇者画在主体层里（与合同画序一致：笼 → 公主 → 龙 → 墙 → 勇者）
      ho = heroB1(T, A);
      if (T < TT.fire) drawHero(lg, ho);
      lg.restore();
      if (T <= TT.start + 0.13) bubbleAt = A.mouth;
    },
    afterMain: (g2) => {
      if (T < TT.fire) return;
      // 火柱（从龙嘴向左喷，被竖着的剑劈成 V 字），画在勇者身后
      const fire = T >= TT.fire && T < TT.fireOff + 0.12;
      if (fire) {
        g2.save(); applyCam(g2, c, 1);
        const p = ez(T, TT.fire, TT.fire + 0.12, outCubic);
        const split = ez(T, TT.plant, TT.plant + 0.32, outCubic);
        const blade = bladeAt(ho);
        const fade = 1 - seg(T, TT.fireOff - 0.04, TT.fireOff + 0.12);
        drawFireBreath(g2, { from: A.mouth, to: [blade[0] - 520, blade[1] + 30], p, w0: 26, w1: 110, t: T, intensity: 1.2 * fade + 0.1, split, splitAt: blade, splitAngle: 0.5 + 0.15 * seg(T, TT.push0, TT.fireOff), rise: 0.02, alpha: fade, seed: 11 });
        g2.restore();
      }
      // 勇者单独一层：迎着火时正面被照成橙色
      const lit = fire ? (1 - seg(T, TT.fireOff - 0.04, TT.fireOff + 0.12)) * ez(T, TT.fire, TT.plant + 0.1) : 0;
      ctx.layer(g2, lit > 0.02 ? { shadow: 10, texture: 0.3, tint: { color: PAL.fire, alpha: 0.42 * lit, mode: 'soft-light' } } : { shadow: 10, texture: 0.3 }, (lg) => {
        lg.save(); applyCam(lg, c, 1); drawHero(lg, ho); lg.restore();
      });
    },
  });
  // 吼声气泡：合同同帧；撞墙瞬间被冲击波一起炸碎（0.12s 放大、转、淡出）
  if (bubbleAt) {
    const k = seg(T, TT.start, TT.start + 0.12);
    if (k < 1) {
      const it = ITEMS.roar;
      const E = { T, c, A: { dragon: { mouth: bubbleAt } } };
      const [sx, sy] = toScreen(c, it.depth ?? 1, bubbleAt[0], bubbleAt[1]);
      const bp = resolveParams(it.params, T, E);
      const bx = sx + (bp.dx || 0), by = sy + (bp.dy || 0);
      const uiL = SEAM.layers.find((l) => l.id === 'ui').o;
      ctx.layer(g, uiL, (lg) => {
        if (k > 0) { lg.translate(bx, by); lg.rotate(-0.25 * k); lg.scale(1 + 0.5 * k, 1 + 0.5 * k); lg.translate(-bx, -by); lg.globalAlpha = 1 - k; }
        bubble(lg, { ...bp, x: bx, y: by });
      });
    }
  }
  if (T >= TT.sweep0) drawBodySweep(g, T);
  return { c, A };
}
void hit; void clamp;
