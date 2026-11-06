// b11 第二拍：盘柱 · 名字跳台（124.00–127.33）。龙与勇者画在水晶柱同一深度 0.85（柱前 / 柱后两层夹住柱子）。
import { PAL, poly, mixHex } from '../../core/paper.js';
import { cam, applyCam, toScreen } from '../../core/camera.js';
import { clamp, lerp, seg, wobble, smoothstep } from '../../core/util.js';
import { ez, outCubic, inOutSine, glide, outQuad } from '../../core/ease.js';
import { burst } from '../../core/particles.js';
import { drawDragon } from '../../rigs/dragon.js';
import { drawHero } from '../../rigs/hero.js';
import { emberDraw } from '../../props/misc.js';
import { bubble } from '../../ui/kit.js';
import { TT, withDrift, camPath, hopPos } from './k.js';
import { heroLook, SCARF, caveEnv, caveLayers, drawCageGroup, drawBodySweep, sfxText } from './common.js';
import { COIL, coilSpine, plateAt, coilHeadPoint, NOSE_TOP, MOUTH, biteK } from './coil.js';
import { drawFireWallWipe } from './beat3.js';

const D = COIL.depth;
export function camB2(T) {
  const base = camPath(T, [[TT.sweepMid, cam(1840, 700, 1.05)], [TT.nose, cam(1840, 690, 1.05)], [TT.tailBite, cam(1830, 578, 1.05), glide], [TT.wall1, cam(1820, 566, 1.05), outQuad]]);
  const sway = 0.03 * Math.sin(((T - TT.sweepMid) / 2.4) * Math.PI * 2) * smoothstep(TT.nose, TT.nose + 0.5, T);
  return withDrift(cam(base.x, base.y, base.zoom, sway), T);
}

const STEPS = [TT.nose, ...TT.plates];      // 落脚时刻：鼻子、昆、图、库、塔、卡
const AIR = 0.3;                            // 每跳腾空时长
const footOnPlate = (i, T) => { const p = plateAt(i, T); return [p[0] + 4, p[1] - 47]; };
const footOnNose = (T) => coilHeadPoint(T, NOSE_TOP);

/** 第 k 个落脚点在 T 时刻的位置（k=0 鼻子，1..5 = 背板 0..4）。 */
const stepPos = (k, T) => (k === 0 ? footOnNose(T) : footOnPlate(k - 1, T));

function heroB2(T) {
  const L = heroLook(T);
  const base = { s: 1, face: 1, t: T, ...L, scarf: { ...SCARF, ground: 1e5, wind: [-520, -140] } };
  // 124.00–124.30：从左边被甩过来，落在龙鼻子上
  if (T < STEPS[0]) {
    const k = ez(T, TT.sweepMid, STEPS[0], outQuad);
    const p = hopPos([1180, 560], stepPos(0, STEPS[0]), k, 140);
    return { ...base, x: p[0], y: p[1] + 58, pose: 'hop', act: lerp(0.35, 0.85, k), expr: 'shout', scarf: { ...base.scarf, vel: [600, 100] } };
  }
  // 逐级往上跳：每级落地前 AIR 秒起跳（起跳点 = 上一级在起跳时刻的位置，落点 = 这一级在落地时刻的位置）
  for (let k = 1; k < STEPS.length; k++) {
    const t1 = STEPS[k], t0 = t1 - AIR;
    if (T < t0) {
      const p = stepPos(k - 1, T);
      const land = ez(T, STEPS[k - 1], STEPS[k - 1] + 0.14);
      return { ...base, x: p[0], y: p[1], pose: { from: 'hop', to: 'stance', k: land }, act: 0.92, expr: 'determined', squash: -0.2 * wobble(T, STEPS[k - 1], 4.5, 0.12) };
    }
    if (T < t1) {
      const k2 = (T - t0) / AIR;
      const p = hopPos(stepPos(k - 1, t0), stepPos(k, t1), k2, 120);
      return { ...base, x: p[0], y: p[1] + 58 * Math.sin(Math.PI * k2) * 0.4, pose: 'hop', act: lerp(0.12, 0.88, k2), expr: 'determined', scarf: { ...base.scarf, vel: [0, -500] } };
    }
  }
  // 126.80 落在「卡」上；126.92 起跳躲开（尾巴从上面拍下来、龙头从下面咬上来）；127.20 跃向半空（左上）
  const tEsc = TT.tailBite - 0.08;
  if (T < tEsc) {
    const p = stepPos(5, T);
    return { ...base, x: p[0], y: p[1], pose: { from: 'hop', to: 'stance', k: ez(T, STEPS[5], STEPS[5] + 0.1) }, act: 0.92, expr: 'shock', squash: -0.2 * wobble(T, STEPS[5], 4.5, 0.12), sweat: 0.6 };
  }
  const k = ez(T, tEsc, TT.wall1, outCubic);
  const a = stepPos(5, tEsc);
  const p = hopPos(a, [a[0] - 640, a[1] - 330], k, 260);
  return { ...base, x: p[0], y: p[1] + 58, pose: 'hop', act: lerp(0.15, 0.5, k), expr: 'shout', rot: -0.25 * k, scarf: { ...base.scarf, vel: [-700, -500] } };
}

function dragonB2(T) {
  const kb = biteK(T);
  const chase = smoothstep(TT.nose, TT.nose + 0.4, T) * (1 - kb);
  const snap = Math.max(0, Math.sin((T - TT.nose) * Math.PI * 2.4));
  const lit = STEPS.slice(1).map((ts, i) => ({ lit: 0.8 + 0.2 * clamp((T - ts) / 0.1), pop: T > ts ? Math.max(0, Math.sin(clamp((T - ts) / 0.32) * Math.PI)) : 0, i }));
  const plates = Array.from({ length: 13 }, (_, i) => (i < 5 ? { lit: lit[i].lit, pop: lit[i].pop } : { lit: 0.8 }));
  return {
    pose: 'coilPillar', spine: coilSpine(T), t: T,
    jaw: kb > 0.95 ? 0.18 : lerp(0.3, 0.25 + 0.7 * snap, chase) * (1 - kb) + 0.9 * kb * (kb < 0.95 ? 1 : 0),
    eyes: { state: 'angry', red: 0.4 + 0.5 * kb, pupil: 0.14, look: [-0.3, -0.7 * chase] },
    wings: 0.45, arms: 0.3, spikes: 0.25 + 0.5 * seg(T, TT.tailBite, TT.tailBite + 0.08), redden: 0.15 + 0.7 * seg(T, TT.tailBite, TT.tailBite + 0.1), vein: 0.4 + 0.6 * seg(T, TT.tailBite, TT.tailBite + 0.1),
    plates,
    // 咬住尾巴时抵消待机甩尾（drawDragon 内部 sway），尾尖停在嘴里
    joints: { tail: -(Math.sin(T * 1.7 + 0.4) * 4 + Math.sin(T * 0.9) * 2) * kb },
  };
}

/** 前景钟乳石（depth 1.35，虚化）：压住画面上沿，也挡住摇臂上升时水晶柱顶那块岩檐的平底。 */
function fgStalactites(lg, c) {
  lg.save(); applyCam(lg, c, 1.35);
  lg.fillStyle = mixHex(PAL.dragonDeep, PAL.ink, 0.45);
  for (let i = 0; i < 12; i++) {
    const x = 1150 + i * 175 + 40 * Math.sin(i * 2.3), w = 120 + 50 * Math.abs(Math.sin(i * 1.7)), L = 230 + 120 * Math.abs(Math.sin(i * 3.1));
    lg.fill(poly([[x - w / 2, -600], [x + w / 2, -600], [x + w * 0.18, L], [x - w * 0.1, L + 20]], { seed: 70 + i, round: 0.4 }));
  }
  lg.restore();
}

export function drawBeat2(g, T, ctx) {
  const c = camB2(T);
  const env = caveEnv(T);
  ctx.fx.contrast = 1.08; ctx.fx.vignette = 0.48; ctx.fx.vignetteColor = PAL.dragonDeep;
  const dp = dragonB2(T);
  const ho = heroB2(T);
  let A = null;
  caveLayers(g, T, ctx, c, env, {
    fg: (lg) => fgStalactites(lg, c),
    beforeMid: (g2) => ctx.layer(g2, { shadow: 8, texture: 0.3 }, (lg) => { lg.save(); applyCam(lg, c, D); drawDragon(lg, { ...dp, part: 'back' }); lg.restore(); }),
    main: (lg) => {
      drawCageGroup(lg, c, T, { pose: T < TT.plates[2] ? 'pickLock' : 'cheerSign', expr: 'tense', extra: { sign: 0.7 } });
      lg.save(); applyCam(lg, c, D);
      A = drawDragon(lg, { ...dp, part: 'front' });
      // 踩中背板：一撮金色火星
      STEPS.forEach((ts, k) => { if (T > ts && T < ts + 0.6) { const p = stepPos(k, ts); burst(lg, T, { at: ts, seed: 1200 + k, count: 14, x: p[0], y: p[1] + 10, spread: 20, speed: [120, 300], angle: [-2.8, -0.3], gravity: 600, life: [0.3, 0.6], size: [3, 6] }, emberDraw); } });
      drawHero(lg, ho);
      lg.restore();
    },
  });
  // 界面层：只在第一跳 / 最后一跳配「咚」，咬尾「嗷！」
  const sp = (k) => toScreen(c, D, ...stepPos(k, STEPS[k]));
  const p0 = seg(T, STEPS[0], STEPS[0] + 0.55), p5 = seg(T, STEPS[5], STEPS[5] + 0.32);
  const pb = seg(T, TT.tailBite, TT.wall1);
  if ((p0 > 0 && p0 < 1) || (p5 > 0 && p5 < 1) || (pb > 0 && pb < 1)) {
    ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
      if (p0 > 0 && p0 < 1) { const [x, y] = sp(0); sfxText(lg, '咚', x - 120, y + 30, 92, p0, { rot: -0.15 }); }
      if (p5 > 0 && p5 < 1) { const [x, y] = sp(5); sfxText(lg, '咚', x - 190, y - 40, 104, p5, { rot: -0.1 }); }
      if (pb > 0 && pb < 1 && A) {
        const m = toScreen(c, D, A.mouth[0], A.mouth[1]);
        const pop = ez(T, TT.tailBite, TT.tailBite + 0.16, outCubic);
        bubble(lg, { x: m[0] + 230, y: m[1] - 160, w: 300, h: 170, shape: 'jagged', text: '嗷！', textSize: 104, textFamily: 'display', tail: m, pop, t: T, seed: 21 });
      }
    });
  }
  // 127.17–127.47 火墙从右往左擦过，墙后是剪影段
  drawFireWallWipe(g, T, ctx);
  if (T < TT.sweep1) drawBodySweep(g, T);
  return { c, A };
}
void inOutSine; void MOUTH; void PAL;
