// b11 第四拍：公主加油 · 围巾荡秋千（130.50–133.50），颜色恢复。
import { PAL } from '../../core/paper.js';
import { cam, applyCam, toScreen } from '../../core/camera.js';
import { clamp, lerp, seg, wobble, hit, smoothstep } from '../../core/util.js';
import { ez, outCubic, inOutSine, inQuad, glide, whip, outQuad } from '../../core/ease.js';
import { burst } from '../../core/particles.js';
import { groundAt } from '../../env/cave.js';
import { drawDragon } from '../../rigs/dragon.js';
import { drawHero } from '../../rigs/hero.js';
import { sparkDraw, dustDraw } from '../../props/misc.js';
import { impact } from '../../fx/transitions.js';
import { TT, withDrift, camPath, keyp, keyv, hopPos, clashStar } from './k.js';
import { heroLook, SCARF, caveEnv, caveLayers, drawCageGroup, whipLinesV, sfxText } from './common.js';

const CAGE_CAM = cam(1320, 340, 2.2), WIDE = cam(1120, 520, 1.15);
export function camB4(T) {
  const base = camPath(T, [[TT.upMid, cam(1320, 620, 2.2)], [TT.up1 + 0.04, CAGE_CAM, whip], [TT.pull0, CAGE_CAM], [TT.pull1, WIDE, glide], [TT.dn0, WIDE], [TT.dnMid, cam(1130, 760, 1.2), inQuad]]);
  return withDrift(base, T);
}

const HEAD0 = [880, 560];
function dragonB4(T) {
  const kick = hit(T, TT.kick, 0.22);
  const head = keyp(T, [[TT.upMid, HEAD0], [TT.swing0, [890, 552]], [TT.kick, [872, 560]], [TT.kick + 0.12, [950, 530], outCubic], [TT.dnMid, [920, 545], glide]]);
  // 眼珠跟着荡圈的勇者转：132.60 转成蚊香眼
  const th = swingTheta(T);
  const look = T > TT.swing0 && T < TT.kick ? [Math.cos(th) * 0.9, 0.3 + 0.5 * Math.sin(th)] : [-0.6, 0.1];
  const dizzy = T >= TT.dizzy && T < TT.dnMid + 0.4;
  return {
    pose: 'rise', t: T, x: head[0], y: head[1], wings: 0.6, arms: 0.3, jaw: 0.3 + 0.35 * kick,
    joints: { head: -18 * kick + 6 * Math.sin(T * 3) * (1 - kick), neck: -6 * kick },
    eyes: { state: dizzy ? 'dizzy' : 'angry', pupil: 0.16, look, red: 0.2 },
    plates: Array.from({ length: 13 }, () => ({ lit: 0.75 })), spikes: 0.2, redden: 0.25 + 0.4 * kick,
  };
}

/** 荡圈角：131.50–133.00 从 π（左）经前面（下、大）→ 0（右）→ 后面（上、小）→ −π（左）。 */
function swingTheta(T) {
  return Math.PI - 2 * Math.PI * ez(T, TT.swing0, TT.swing1, inOutSine);
}
const RX = 380, RY = 64, DY = 112;

function heroB4(T, A) {
  const L = heroLook(T);
  const piv = [lerp(A.head[0], A.horn[0], 0.45), lerp(A.head[1], A.horn[1], 0.45)];
  const base = { s: 1, face: 1, t: T, ...L, scarf: { ...SCARF, to: piv, ground: 1e5, wind: [-200, 0] } };
  let neck, front = true, face = 1, pose = 'hangSwing', sc = 1, rot = 0, extra = {};
  if (T < TT.swing0) {        // 吊在龙角左下方晃
    const a = -1.05 + 0.18 * Math.sin((T - TT.upMid) * 3.4);
    neck = [piv[0] + Math.sin(a) * 300, piv[1] + Math.cos(a) * 300 * 0.62];
    rot = -a * 0.35;
  } else if (T < TT.kick) {   // 绳球：绕龙头荡一整圈
    const th = swingTheta(T);
    neck = [piv[0] + RX * Math.cos(th), piv[1] + DY + RY * Math.sin(th)];
    front = Math.sin(th) >= 0;
    face = front ? 1 : -1;
    sc = 1 + 0.07 * Math.sin(th);
    rot = 0.5 * Math.cos(th) * (front ? -1 : 1);
    if (T > TT.kick - 0.16) { pose = 'kick'; face = 1; rot = 0; }
  } else if (T < TT.release) { // 一脚踢在龙鼻子上，弹开一点
    const k = seg(T, TT.kick, TT.release);
    neck = [piv[0] - RX - 40 * outCubic(k), piv[1] + DY - 10];
    pose = 'kick'; face = 1;
  } else {                    // 围巾松开，落回画左
    const k = ez(T, TT.release, TT.release + 0.3, inQuad);
    const p0 = [piv[0] - RX - 40, piv[1] + DY + 150];
    const p = hopPos(p0, [p0[0] - 60, groundAt(p0[0] - 60)], k, -20);
    const ground = k >= 1;
    return { side: 'front', o: { ...base, x: p[0], y: p[1], pose: ground ? 'stance' : 'hop', act: 0.8, expr: 'determined', squash: ground ? -0.2 * wobble(T, TT.release + 0.3, 4, 0.14) : 0, scarf: { ...SCARF, vel: [-200, 300] } } };
  }
  extra = { x: neck[0], y: neck[1] + 150 * sc, s: sc, face, rot, pose, expr: pose === 'kick' ? 'shout' : 'determined' };
  return { side: front ? 'front' : 'back', o: { ...base, ...extra } };
}

export function drawBeat4(g, T, ctx) {
  const c = camB4(T);
  const env = caveEnv(T);
  ctx.fx.contrast = 1.06; ctx.fx.vignette = 0.45; ctx.fx.vignetteColor = PAL.dragonDeep;
  const dp = dragonB4(T);
  let A = null, H = null;
  const pin = T >= TT.pin;
  const prPose = T < TT.cheer + 0.35 ? 'cheerSign' : T < TT.pin + 0.25 ? { from: 'cheerSign', to: 'pickLock', k: ez(T, TT.cheer + 0.35, TT.cheer + 0.5) } : T < TT.pull0 + 0.2 ? 'pickLock' : 'cheerSign';
  const prExpr = T < TT.pin + 0.03 ? 'focused' : T < TT.pull0 + 0.2 ? 'smug' : T > TT.kick ? 'laugh' : 'tense';
  caveLayers(g, T, ctx, c, env, {
    main: (lg) => {
      drawCageGroup(lg, c, T, { pose: prPose, expr: prExpr, lock: { pins: pin ? 1 : 0, flash: hit(T, TT.pin, 0.3) }, extra: { sign: T < TT.cheer + 0.35 ? 1 : 0.85, item: undefined } });
      lg.save(); applyCam(lg, c, 1);
      // 先求锚点：后半圈的勇者要画在龙后面
      const probe = { ...dp };
      A = drawDragonDeferred(lg, probe, T, (anchors) => { H = heroB4(T, anchors); return H.side === 'back' ? H.o : null; });
      if (H.side === 'front') drawHero(lg, H.o);
      if (pin && T < TT.pin + 0.5) { const lk = [1232, 352]; burst(lg, T, { at: TT.pin, seed: 1401, count: 12, x: lk[0], y: lk[1], speed: [80, 220], angle: [-3, -0.1], gravity: 300, life: [0.3, 0.6], size: [5, 9] }, sparkDraw); }
      if (T > TT.release + 0.28 && T < TT.release + 0.9) burst(lg, T, { at: TT.release + 0.3, seed: 1402, count: 10, x: H.o.x, y: groundAt(H.o.x), spread: 30, speed: [60, 200], angle: [-2.9, -0.3], gravity: -20, life: [0.4, 0.8], size: [16, 30] }, dustDraw);
      lg.restore();
    },
  });
  // 133.00 踢鼻子：「啪！」+ 小冲击（不闪白）
  if (T >= TT.kick && T < TT.kick + 0.6 && A) {
    const [nx, ny] = toScreen(c, 1, A.nose[0], A.nose[1]);
    impact(ctx, T, TT.kick, 'S', { flash: 0, shake: 10, g, x: nx, y: ny, seed: 4 });
    clashStar(g, nx, ny, 90, (T - TT.kick) / 0.4, { rot: 0.3 });
    ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => sfxText(lg, '啪！', nx - 40, ny - 150, 110, seg(T, TT.kick, TT.kick + 0.6), { rot: -0.18 }));
  }
  // 131.20 锁芯「咔」：锁上闪一下（局部，不算整帧闪白）
  if (T >= TT.pin && T < TT.pin + 0.5) {
    const [lx, ly] = toScreen(c, 1, 1232, 352);
    clashStar(g, lx, ly, 70, (T - TT.pin) / 0.35, { glow: PAL.goldLight });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => sfxText(lg, '咔', lx - 120, ly - 60, 84, seg(T, TT.pin, TT.pin + 0.5), { rot: -0.2, color: PAL.gold }));
  }
  // 竖甩：入（130.50–130.62 从下往上收）/ 出（133.40–133.50 向下甩）
  const aIn = 1 - seg(T, TT.upMid, TT.up1 + 0.05), aOut = seg(T, TT.dn0, TT.dnMid);
  if (aIn > 0) whipLinesV(g, T, aIn, 1);
  if (aOut > 0) whipLinesV(g, T, aOut, -1);
  return { c, A };
}

/** 先画出龙（得到锚点），需要时把“后半圈”的勇者夹在龙前面画之前：龙画两遍代价太大，这里先画勇者再画龙。 */
function drawDragonDeferred(lg, dp, T, decide) {
  // 用上一刻的锚点近似（龙头几乎不动）：先用 0 透明度量锚点太贵，改为按龙参数推算——直接画龙拿锚点，
  // 后半圈时把勇者画在龙之前：先存一份龙的锚点估计（同参数、alpha 0 不画），再按需要排序。
  const est = drawDragon(lg, { ...dp, alpha: 0.0001, detail: 0 });
  const back = decide(est);
  if (back) drawHero(lg, back);
  return drawDragon(lg, dp);
}
void clamp; void smoothstep; void keyv; void outQuad;
