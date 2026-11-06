// b11 第五拍：冲锋 · 正中对撞 · 撕纸分屏 · 对峙（133.50–137.92）。
import { PAL, lin, glow } from '../../core/paper.js';
import { cam, applyCam, toScreen, lerpCam } from '../../core/camera.js';
import { clamp, lerp, seg, wobble, hit, smoothstep, mixHex } from '../../core/util.js';
import { ez, outCubic, inOutSine, inQuad, glide, whip, outExpo, inCubic, outQuad } from '../../core/ease.js';
import { burst, stream, field } from '../../core/particles.js';
import { groundAt, STANDOFF, CAVE } from '../../env/cave.js';
import { drawDragon, drawDragonEye } from '../../rigs/dragon.js';
import { drawHero, heroRig, drawHeroHead } from '../../rigs/hero.js';
import { drawFireBreath, drawTumbleweed, emberDraw, dustDraw, sparkDraw } from '../../props/misc.js';
import { impact, splitScreen, colorSplit, COLD, speedLines } from '../../fx/transitions.js';
import { TT, withDrift, camPath, keyv, keyp, clashStar, scrape, sat01 } from './k.js';
import { heroLook, SCARF, caveEnv, caveLayers, drawCageGroup, whipLinesV } from './common.js';

const SO = STANDOFF;
const SS = 1 / SO.cam.zoom;          // 对峙时角色按屏幕 s=1（= b12 纸偶尺寸）
const CVW = cam(960, 560, 1.0), PUSH = cam(960, 600, 1.15);
export function camB5(T) {
  const base = camPath(T, [[TT.dnMid, cam(960, 300, 1.0)], [TT.dn1 + 0.04, CVW, whip], [TT.charge1, PUSH, glide], [TT.clash, PUSH], [TT.back1, SO.cam, glide]]);
  return withDrift(base, T);
}

const HIT = [960, 742];               // 正中对撞点（世界）
const tHit = TT.clash;

/** 勇者冲锋位置（世界 x）：剑尖在 135.40 正好顶到对撞点。 */
function heroX(T) {
  const tip = heroRig({ x: 0, y: 0, s: SS, face: 1, t: tHit, pose: 'charge', phase: 0 }).swordTip;
  const xHit = HIT[0] - tip[0];
  if (T < TT.charge0) return 300;
  if (T < tHit) return lerp(300, xHit, ez(T, TT.charge0, tHit, inQuad));
  const back = 732 + (420 - 960) / SO.cam.zoom;          // 推回到屏幕 x≈420（对峙机位）
  if (T < TT.back1) return lerp(xHit, back, ez(T, tHit + 0.06, TT.back1, outExpo));
  return SO.world.hero[0];
}
function dragonHead(T) {
  const hitX = 1255;
  const back = [732 + (1500 - 960) / SO.cam.zoom, 552];
  return keyp(T, [[TT.dnMid, [1760, 640]], [TT.charge0, [1740, 640]], [tHit, [hitX, 612], inQuad], [tHit + 0.06, [hitX, 612]], [TT.back1, back, outExpo], [TT.standoff, back], [TT.standoff + 0.01, SO.world.dragonHead]]);
}

function dragonB5(T) {
  const h = dragonHead(T);
  const stand = T >= TT.standoff;
  const kc = seg(T, TT.charge0, tHit);
  const kick = hit(T, tHit, 0.3);
  return {
    pose: stand ? 'standoff' : T < TT.back1 ? 'charge' : { from: 'charge', to: 'standoff', k: ez(T, TT.back0, TT.back1) },
    t: T, x: h[0], y: h[1], s: SS, jaw: stand ? 0.12 : lerp(0.4, 0.95, ez(T, tHit - 0.35, tHit - 0.2)) * (1 - 0.6 * kick),
    eyes: { state: 'angry', pupil: 0.14, red: 0.3 + 0.4 * kc, look: stand ? [-0.6, 0.05] : [-0.5, 0] },
    wings: 0.6, spikes: 0.3, redden: 0.2, nostril: 1,
    plates: Array.from({ length: 13 }, () => ({ lit: 0.7 + 0.3 * kc * (1 - seg(T, tHit, TT.standoff)) })),
    joints: { head: -10 * kick },
  };
}

function heroB5(T) {
  const L = heroLook(T);
  const x = heroX(T);
  const base = { s: SS, face: 1, t: T, ...L, x, y: groundAt(x), scarf: { ...SCARF } };
  if (T < TT.charge0) return { ...base, pose: 'stance', expr: 'determined' };
  if (T < tHit) {
    const sp = 520 * ez(T, TT.charge0, tHit, inQuad);
    return { ...base, pose: 'charge', phase: (T - TT.charge0) * lerp(1.2, 2.6, seg(T, TT.charge0, tHit)), expr: 'shout', scarf: { ...SCARF, vel: [sp + 200, 0] } };
  }
  if (T < tHit + 0.06) return { ...base, pose: 'charge', phase: 0.3, expr: 'shout', scarf: { ...SCARF, vel: [700, 0] } };
  if (T < TT.standoff) {
    const k = seg(T, tHit + 0.06, TT.back1);
    return { ...base, pose: 'brake', expr: 'hurt', squash: -0.15 * (1 - k), scarf: { ...SCARF, vel: [-500 * (1 - k), 0] } };
  }
  return { ...base, x: SO.world.hero[0], y: SO.world.hero[1], pose: SO.pose.hero, expr: 'determined', scarf: { ...SCARF } };
}

export function drawBeat5(g, T, ctx) {
  const c = camB5(T);
  const env = caveEnv(T);
  const sat = sat01(T);
  const fgA = 1 - seg(T, TT.fade0, TT.fade1);
  ctx.fx.contrast = 1.06; ctx.fx.vignette = 0.42; ctx.fx.vignetteColor = PAL.dragonDeep;
  const dp = dragonB5(T), ho = heroB5(T);
  let A = null;
  // 公主：冲锋时扒着笼子看，对峙时左右看
  const prLook = T > TT.weed0 ? [Math.sin((T - TT.weed0) * 5) * 0.8, 0] : [-0.3, 0.2];
  caveLayers(g, T, ctx, c, env, {
    main: (lg) => {
      lg.save(); applyCam(lg, c, 1);
      // 擦痕 + 烟（被推回）
      if (T > tHit) {
        const k = seg(T, tHit + 0.06, TT.back1);
        scrape(lg, heroX(tHit), heroX(T), groundAt(heroX(T)) + 4, k, 3);
        if (T < TT.standoff + 0.6) {
          burst(lg, T, { at: tHit + 0.08, seed: 1501, count: 16, x: heroX(tHit + 0.3), y: groundAt(400), spread: 120, speed: [40, 160], angle: [-3, -0.1], gravity: -30, life: [0.6, 1.2], size: [26, 50] }, dustDraw);
          burst(lg, T, { at: tHit + 0.08, seed: 1502, count: 14, x: dragonHead(tHit + 0.4)[0] + 200, y: 900, spread: 160, speed: [40, 160], angle: [-3, -0.1], gravity: -30, life: [0.6, 1.2], size: [26, 50] }, dustDraw);
        }
      }
      A = drawDragon(lg, dp);
      // 冲锋时嘴里的火越烧越亮；135.10 起喷出火焰吐息，135.40 剑尖顶上
      if (T < tHit + 0.5 && T > TT.charge0) {
        const heat = seg(T, TT.charge0 + 0.3, tHit);
        glow(lg, A.mouth[0], A.mouth[1], 80 + 120 * heat, PAL.fire2, 0.35 + 0.5 * heat);
        const p = ez(T, tHit - 0.3, tHit, inQuad);
        if (p > 0) {
          const fade = 1 - seg(T, tHit + 0.04, tHit + 0.3);
          drawFireBreath(lg, { from: A.mouth, to: HIT, p, w0: 26, w1: 70, t: T, intensity: 1.3, alpha: fade, rise: 0, seed: 17 });
        }
      }
      drawHero(lg, ho);
      // 风滚草：136.90–137.60 从右往左滚过两人之间，弹两下（烧焦版）
      const kw = seg(T, TT.weed0, TT.weed1 + 0.3);
      if (kw > 0 && kw < 1) {
        const x = lerp(1190, 330, kw);
        const bounce = Math.abs(Math.sin(kw * Math.PI * 2.5)) * 70 * (1 - kw * 0.6);
        drawTumbleweed(lg, { x, y: groundAt(x) - bounce, s: 1.25, r: 46, roll: -(1190 - x) / (46 * 1.25), t: T, charred: 1, squash: bounce < 6 ? 0.2 : 0, seed: 5 });
      }
      // 对峙：火星在飘
      if (T > TT.back0) stream(lg, T, { start: TT.back0, end: TT.end, rate: 14, seed: 1503, life: [1.4, 2.4], emit: (tb, i, r) => ({ x: 300 + r * 1400, y: 920, vx: (r - 0.5) * 40, vy: -90 - r * 60 }), drag: 0.2 }, emberDraw);
      lg.restore();
      // 鸟笼吊在龙头上方：画在龙之后，免得龙角挡住笼中左右张望的公主
      drawCageGroup(lg, c, T, { pose: T < TT.standoff ? 'cheerSign' : SO.pose.princess, expr: T < TT.standoff ? 'tense' : 'smile', lock: { pins: 1 }, extra: { sign: 0.9, look: prLook } });
    },
  }, { sat, fgAlpha: fgA });
  // 正中对撞：白金色四角星芒 + 放射线 + flash 1.0 两帧 + shake 26（L 级，'MAX' 留给 b13）
  const [hx, hy] = toScreen(c, 1, HIT[0], HIT[1]);
  if (T >= tHit) {
    impact(ctx, T, tHit, 'L', { shake: 26, flash: 1, frames: 2, g, x: hx, y: hy, seed: 135 });
    clashStar(g, hx, hy, 420, (T - tHit) / 0.8, { glow: PAL.goldLight });
    if (T < tHit + 0.7) burst(g, T, { at: tHit, seed: 1504, count: 60, x: hx, y: hy, spread: 10, speed: [500, 1400], angle: [0, Math.PI * 2], gravity: 500, life: [0.3, 0.7], size: [4, 9] }, sparkDraw);
  }
  // 左冷右暖：分界就在撞击点（两个半屏渐变遮罩），对撞时最强，137.40 前退掉（与 b12 背景片一致）
  const cs = T < tHit ? 0.18 * seg(T, TT.charge0, tHit) : lerp(0.55, 0.22, seg(T, tHit, TT.back1)) * (1 - seg(T, TT.fade0, TT.fade1));
  if (cs > 0.005) colorSplit(ctx, g, hx, { y: hy, alpha: cs, seam: T >= tHit ? 0.7 * (1 - seg(T, tHit, TT.back1)) : 0, cold: COLD, warm: PAL.fire });
  // 冲锋的速度线（两侧往中间）
  const kv = seg(T, TT.charge0 + 0.6, tHit) * (1 - seg(T, tHit, tHit + 0.2));
  if (kv > 0.02) speedLines(g, 'h', { x: 0, y: 560, w: 1920, h: 380 }, { t: T, sign: 1, alpha: 0.35 * kv, density: 1.6, colors: [PAL.white, PAL.goldLight], seed: 51 });
  // 136.30–136.80 黑边合上 + 撕纸分屏（左：勇者坚定的眼睛；右：龙的竖瞳）；分屏两片 136.66 起向两侧拉开，露出对峙全景
  ctx.fx.letterbox = Math.max(ctx.fx.letterbox || 0, ez(T, TT.lb0, TT.lb1, inOutSine));
  const eIn = outExpo(seg(T, TT.lb0, TT.lb0 + 0.2));
  const eOut = inCubic(seg(T, TT.lb1 - 0.15, TT.lb1 + 0.04));
  const enter = eIn * (1 - eOut);
  if (enter > 0.001) {
    splitScreen(ctx, g, { enter, x: 960, angle: 0.1, seed: 11 },
      (g2) => drawHeroEyes(g2, T),
      (g2) => drawDragonPupil(g2, T));
  }
  drawWhipIn(g, T);
  return { c, A };
}

function drawWhipIn(g, T) {
  const a = 1 - seg(T, TT.dnMid, TT.dn1 + 0.06);
  if (a > 0) whipLinesV(g, T, a, -1);
}

/** 分屏左片：勇者坚定的眼睛（冷色底）。 */
function drawHeroEyes(g, T) {
  g.fillStyle = lin(g, 0, 0, 960, 0, [mixHex(PAL.dragonDeep, PAL.magic, 0.35), mixHex(PAL.magic, PAL.crystal, 0.3)]);
  g.fillRect(-60, -60, 1200, 1200);
  glow(g, 560, 520, 520, PAL.crystal, 0.35);
  const L = heroLook(T);
  const push = 1 + 0.04 * seg(T, TT.lb0, TT.lb1);
  drawHeroHead(g, { x: 560, y: 610, s: 7.2 * push, face: 1, t: T, expr: 'determined', yaw: 0.85, soot: L.soot, injury: { bandages: 1, bump: true, singed: true }, ahoge: 'candle', blink: 0 });
}
/** 分屏右片：龙的竖瞳（暖色底）。 */
function drawDragonPupil(g, T) {
  g.fillStyle = lin(g, 960, 0, 1920, 0, [PAL.fireDeep, PAL.fire]);
  g.fillRect(800, -60, 1200, 1200);
  glow(g, 1400, 520, 560, PAL.fire2, 0.4);
  const push = 1 + 0.04 * seg(T, TT.lb0, TT.lb1);
  g.save(); g.fillStyle = PAL.dragon; g.beginPath(); g.ellipse(1400, 540, 520 * push, 400 * push, 0, 0, Math.PI * 2); g.fill(); g.restore();
  drawDragonEye(g, { x: 1400, y: 540, w: 330 * push, h: 390 * push, open: 1, pupil: 0.1, look: [-0.5, 0], state: 'angry', red: 0.45, glow: 0.4, inner: -1, t: T });
}
void clamp; void wobble; void smoothstep; void keyv; void field; void lerpCam; void CAVE; void outCubic; void glide; void outQuad;
