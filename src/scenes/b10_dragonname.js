// b10 · 再说一遍、火焰字、是不是、听岔道具栏、不对、石碑墙（[109.00, 120.97)，docs/storyboard.md「b10」）。
// 入场：与 b09 重叠 109.00–109.15，本块画横向甩镜帘（速度线带由右往左，from:'right'），帘后是勇者格 CU-H（洞）。
// 出场：120.97 隐形接缝 → b11（合同 src/scenes/_seams.js 'b10|b11'：CV-LOW-END、两层名字墙、吼到最高点、勇者左下挡脸）。
import { PAL } from '../core/paper.js';
import { applyCam, toScreen } from '../core/camera.js';
import { clamp, seg, smoothstep } from '../core/util.js';
import { outCubic } from '../core/ease.js';
import { burst } from '../core/particles.js';
import { drawCave, drawNameWall, caveToLayer, groundAt } from '../env/cave.js';
import { drawCage } from '../props/cave.js';
import { drawHero, heroRig } from '../rigs/hero.js';
import { drawDragon } from '../rigs/dragon.js';
import { drawPrincess } from '../rigs/princess.js';
import { bubble, itemBar } from '../ui/kit.js';
import { drawMishearIcon } from '../props/village.js';
import { drawFireBreath, drawShockRing, sparkDraw, emberDraw } from '../props/misc.js';
import { whipCurtain, burnEdge, smokeWipe, impact } from '../fx/transitions.js';
import {
  C, T0, WHIP_IN, WHIP_D2, SNAP_Q2, BURN, SMOKE, T_LOW,
  camAt, camQ1Base, camD2Base, withDrift, caveFrame, drawCagedPrincess,
} from './b10/common.js';
import { drawFireLetters, drawFireSparks, drawScorch, wallHit, D2_TIMES, SONG_T, SONG_POOF } from './b10/fireletters.js';
import { heroParams, ITEM_T } from './b10/hero.js';
import { dragonParams, D3_TIMES, ROAR } from './b10/dragon.js';
import { SEAM_T, seamParams, seamLayer, seamEnv, seamFx, drawSeamStalactites } from './b10/seam.js';

// 道具栏：比分镜（y 200–560）下移 90px，让龙头从栏的右上方探出来、R1 鼓起后嘴在栏上沿之上
const BAR = { x: 880, y: 290, w: 840, h: 360 };
const BAR_BURN = { x: 860, y: 244, w: 880, h: 446 };
const KINDS = ['card', 'violin', 'eggtart', 'soda', 'marathon'];
const RARITY = [2, 3, 2, 3, 5];

// ———————— 场景通用 ————————
const tipAt = (t) => heroRig(heroParams(t)).ahogeTip;
// 字痕贴在后墙（depth 0.5）：按撞墙时刻的机位把世界点换到后墙坐标
const SCORCH_L = Array.from({ length: 12 }, (_, i) => {
  const w = wallHit(i), c = camAt(w.at);
  const [sx, sy] = toScreen(c, 1, w.x, w.y);
  return caveToLayer(c, 0.5, sx, sy);
});

function princessState(T) {
  if (T < C('D2a')) return { pose: 'pickLock' };
  if (T < C('Q2')) return { pose: 'caged', expr: T > SONG_T ? 'laugh' : 'shock' };
  if (T < C('R1')) return { pose: 'caged', expr: T > ITEM_T[2] ? 'eyeroll' : 'smug' };
  return { pose: 'caged', expr: 'shock' };
}

/** 主体层：鸟笼公主 → 巨龙 → 勇者（world depth 1）。返回锚点。 */
function drawActors(lg, T, o = {}) {
  const out = {};
  if (o.princess !== false) drawCagedPrincess(lg, T, princessState(T));
  if (o.dragon !== false) out.dragon = drawDragon(lg, dragonParams(T));
  if (o.hero !== false) out.hero = drawHero(lg, heroParams(T));
  return out;
}

function fxBase(ctx) {
  ctx.fx.vignette = Math.max(ctx.fx.vignette, 0.5);
  ctx.fx.vignetteColor = PAL.dragonDeep;
}

/** 冲击（震动 / 闪 / 推近）乘一个包络 fade 再写 ctx.fx（接缝前要衰减干净）。 */
function impactK(ctx, T, at, level, o, fade = 1) {
  const r = impact(null, T, at, level, { ...o, apply: false });
  if (T < at || fade <= 0) return r;
  const fx = ctx.fx, sh = [r.shake[0] * fade, r.shake[1] * fade];
  const cur = fx.shake || [0, 0];
  if (Math.hypot(sh[0], sh[1]) > Math.hypot(cur[0], cur[1])) fx.shake = sh;
  if (r.flash * fade > (fx.flash || 0)) { fx.flash = r.flash * fade; fx.flashColor = o.flashColor || PAL.white; }
  if (o.punch) fx.zoom = Math.max(fx.zoom || 1, 1 + o.punch * Math.exp(-(T - at) / 0.12) * fade);
  return r;
}

// ———— Q1 勇者格（CU-H 洞）：拢耳「再说一遍？」，与 K1 国王镜像 ————
const Q_BUBBLE = { x: 1272, y: 258, w: 520, h: 236, shape: 'round', mirror: true };
function frameQ1(g, T, ctx) {
  const c = withDrift(camQ1Base(T), T);
  let A = {};
  caveFrame(g, T, ctx, c, {
    mid: false,
    main: (lg) => { A = drawActors(lg, T, { dragon: false }); },
    ui: (gg) => {
      const pop = (T - (C('Q1') + 0.05)) / 0.2;
      if (pop <= 0 || !A.hero) return;
      const m = toScreen(c, 1, A.hero.mouth[0], A.hero.mouth[1]);
      ctx.layer(gg, { shadow: 8, texture: 0.25 }, (lg) => {
        bubble(lg, { ...Q_BUBBLE, text: '再说一遍？', tail: [m[0] + 70, m[1] - 40], pop, t: T, seed: 5 });
      });
    },
  });
}

// 黑烟团（「噗」）
function smokeDraw(g, x, y, s) {
  const p = s.p ?? 0.3;
  const a = (1 - p) * 0.78;
  if (a <= 0) return;
  const r = (s.size || 20) * (0.55 + p * 1.1);
  g.save();
  g.fillStyle = `rgba(44,34,51,${a.toFixed(3)})`;
  g.beginPath(); g.ellipse(x, y, r, r * 0.82, s.rot || 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(86,73,94,${(a * 0.6).toFixed(3)})`;
  g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.25, r * 0.5, r * 0.4, s.rot || 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ———— D2 火焰字（CV-W）/ Q2 snap 回 CU-H ————
function frameD2(g, T, ctx, c, o = {}) {
  let A = {};
  caveFrame(g, T, ctx, c, {
    back: (lg) => drawScorch(lg, T, (i) => SCORCH_L[i]),
    main: (lg) => { A = drawActors(lg, T); },
    over: (gg) => {
      if (T < D2_TIMES[0] || T > SONG_POOF + 0.9) return;
      ctx.layer(gg, { texture: 0.14 }, (lg) => {
        applyCam(lg, c, 1);
        drawFireSparks(lg, T);
        drawFireLetters(lg, T, tipAt);
        if (T >= SONG_T - 0.02) {
          const tp = tipAt(SONG_T);
          burst(lg, T, { at: SONG_T, seed: 31, count: 18, x: tp[0], y: tp[1], spread: 8, speed: [120, 380], angle: [-2.9, -0.2], gravity: 500, drag: 2, life: [0.3, 0.6], size: [4, 8] }, emberDraw);
          const h = heroRig(heroParams(SONG_POOF)).head;
          burst(lg, T, { at: SONG_POOF, seed: 32, count: 12, x: h[0], y: h[1] - 8, spread: 18, speed: [160, 360], angle: [-3.1, 0.1], gravity: -60, drag: 3.2, life: [0.22, 0.4], size: [16, 30] }, smokeDraw);
        }
      });
    },
    ui: o.ui ? (gg) => o.ui(gg, A, c) : undefined,
  });
}

// ———— 听岔道具栏（CV-2S）/ R1 烧栏 ————
function barItems(T) {
  return KINDS.map((kind, j) => ({
    kind, rarity: RARITY[j], p: (T - ITEM_T[j]) / 0.3,
    burst: j === 4 ? seg(T, ITEM_T[4] + 0.06, ITEM_T[4] + 0.6) : 0,
  }));
}
function frameMishear(g, T, ctx) {
  const c = camAt(T);
  let A = {};
  const red = clamp(ITEM_T.filter((t) => T >= t + 0.05).length / 5);
  caveFrame(g, T, ctx, c, {
    main: (lg) => { A = drawActors(lg, T, { dragon: false }); },
    over: (gg) => {
      // 龙层：每出一件脸红一级（tint fireDeep）
      ctx.layer(gg, { shadow: 10, texture: 0.3, tint: { color: PAL.fireDeep, alpha: 0.3 * red + (T >= C('R1') ? 0.1 : 0), mode: 'multiply' } }, (lg) => {
        applyCam(lg, c, 1);
        A.dragon = drawDragon(lg, dragonParams(T));
      });
      // 道具栏（燃烧边负责整块面板；itemBar 不传 burn）
      const slide = (T - (C('M1') - 0.15)) / 0.38;
      if (slide > 0) {
        const p = (T - BURN[0]) / (BURN[1] - BURN[0]);
        A.burn = burnEdge(ctx, gg, BAR_BURN, p, {
          dir: 'left', t: T, dur: BURN[1] - BURN[0], seed: 9,
          draw: (lg) => itemBar(lg, { rect: BAR, items: barItems(T), slide, t: T, drawIcon: (g2, kind, x, y, size) => drawMishearIcon(g2, kind, { x, y, s: size / 150, t: T, glow: 0.85 }) }),
        });
      }
    },
    ui: (gg) => {
      ctx.layer(gg, { texture: 0.12 }, (lg) => {
        // 变魔术的星点（从勇者举起的手里冒出来）
        lg.save(); applyCam(lg, c, 1);
        for (let j = 0; j < 5; j++) {
          if (T < ITEM_T[j] - 0.05 || T > ITEM_T[j] + 0.7) continue;
          const hp = heroRig(heroParams(ITEM_T[j] - 0.04)).handR;
          burst(lg, T, { at: ITEM_T[j] - 0.04, seed: 50 + j, count: 14, x: hp[0], y: hp[1], spread: 10, speed: [140, 420], angle: [-2.6, -0.4], gravity: 260, drag: 2.2, life: [0.3, 0.6], size: [8, 14] }, sparkDraw);
        }
        lg.restore();
        // R1：一口火从右往左横扫道具栏 + 「不对！」
        if (T >= C('R1') && A.dragon) {
          const m = toScreen(c, 1, A.dragon.mouth[0], A.dragon.mouth[1]);
          const fp = seg(T, BURN[0] - 0.06, BURN[0] + 0.05) * (1 - seg(T, BURN[1] + 0.02, BURN[1] + 0.14));
          if (fp > 0 && A.burn) {
            const e = A.burn.edge;
            drawFireBreath(lg, { from: m, to: [e[0] - 30, e[1] + 30], p: fp, w0: 24, w1: 110, t: T, seed: 7, intensity: 1.2, curve: -20 });
          }
          const pop = (T - (C('R1') + 0.05)) / 0.18;
          if (pop > 0) bubble(lg, { x: 1180, y: 176, w: 420, h: 210, shape: 'flame', text: '不对！', tail: [m[0] - 30, m[1] - 20], pop, t: T, seed: 3 });
        }
      });
    },
  });
  if (T >= C('R1')) impactK(ctx, T, C('R1') + 0.02, 'L', { shake: 20, flash: 0.25, flashColor: PAL.fire2 });
}

// ———— D3 石碑墙（CV-LOW）：图层栈与合同 'b10|b11' 一致 ————
function frameD3(g, T, ctx) {
  const c = camAt(T);
  const env = seamEnv(T);
  const E = { T, c, A: {} };
  const landed = D3_TIMES.filter((t) => T >= t).length;
  const glowK = clamp(0.35 + 0.65 * (landed / 13) + 0.25 * seg(T, ROAR - 0.05, ROAR + 0.1));
  const endK = 1 - smoothstep(SEAM_T - 0.17, SEAM_T - 0.035, T); // 本块的冲击 / 扬尘在接缝前收干净
  ctx.layer(g, seamLayer('back'), (lg) => {
    drawCave(lg, T, c, { ...env, layer: 'back' });
    lg.save(); applyCam(lg, c, 0.5); drawSeamStalactites(lg, seamParams('stalactites', T)); lg.restore();
  });
  ctx.layer(g, seamLayer('mid'), (lg) => drawCave(lg, T, c, { ...env, layer: 'mid' }));
  ctx.layer(g, seamLayer('main'), (lg) => {
    drawCave(lg, T, c, { ...env, layer: 'main' });
    lg.save(); applyCam(lg, c, 1);
    drawCage(lg, seamParams('cageBack', T));
    drawPrincess(lg, seamParams('princess', T));
    drawCage(lg, seamParams('cageFront', T));
    E.A.dragon = drawDragon(lg, dragonParams(T));
    drawNameWall(lg, T, { ...seamParams('wall', T), glow: glowK });
    drawHero(lg, heroParams(T));
    lg.restore();
  });
  // 扬尘、吼声冲击环（接缝前 0.05s 全部结束）
  if (T < SEAM_T - 0.04) {
    ctx.layer(g, { texture: 0.12 }, (lg) => {
      applyCam(lg, c, 1);
      D3_TIMES.forEach((t, i) => {
        if (T < t || T > t + 1.1) return;
        const row2 = i >= 8;
        const x = row2 ? 281.25 + 287.5 * (i - 8 + 0.5) : 300 + 200 * i;
        const life = Math.min(1.0, SEAM_T - 0.06 - t);
        burst(lg, T, { at: t, seed: 120 + i, count: 20, x, y: row2 ? 700 : groundAt(x), spread: row2 ? 120 : 90, speed: [60, 260], angle: [-3.0, -0.15], gravity: 120, drag: 2.2, life: [life * 0.5, life], size: [14, 26] }, dustDraw2);
      });
      if (T >= ROAR) {
        const k = seg(T, ROAR, ROAR + 0.2);
        const m = E.A.dragon ? E.A.dragon.mouth : [1060, 300];
        drawShockRing(lg, { x: m[0] - 20, y: m[1], r: 80 + 520 * outCubic(k), alpha: (1 - k) * 0.9, squash: 0.82, lw: 3 });
      }
    });
  }
  ctx.layer(g, seamLayer('fg'), (lg) => drawCave(lg, T, c, { ...env, layer: 'fg' }));
  if (T >= ROAR) {
    ctx.layer(g, seamLayer('ui'), (lg) => {
      const R = seamParams('roar', T, E);
      const at = E.A.dragon.mouth;
      const [sx, sy] = toScreen(c, 1, at[0], at[1]);
      bubble(lg, { ...R, x: sx + (R.dx || 0), y: sy + (R.dy || 0), pop: (T - ROAR) / 0.15 });
    });
  }
  D3_TIMES.forEach((t, i) => impactK(ctx, T, t, i >= 8 ? 'M' : 'S', { shake: i >= 8 ? 14 : 10, flash: 0, punch: 0.02, seed: i + 3 }, endK));
  impactK(ctx, T, ROAR, 'M', { shake: 16, flash: 0.3, flashColor: PAL.fire2, seed: 77 }, endK);
  const fx = seamFx(T);
  for (const k in fx) if (fx[k] !== undefined) ctx.fx[k] = fx[k];
}
// 扬尘：石色纸团，变大变淡
function dustDraw2(g, x, y, s) {
  const p = s.p ?? 0.3;
  const a = (1 - p) * 0.5;
  if (a <= 0) return;
  const r = (s.size || 16) * (0.6 + p * 1.3);
  g.save();
  g.fillStyle = `rgba(171,161,146,${a.toFixed(3)})`;
  g.beginPath(); g.ellipse(x, y, r, r * 0.72, s.rot || 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(207,198,182,${(a * 0.7).toFixed(3)})`;
  g.beginPath(); g.ellipse(x - r * 0.2, y - r * 0.18, r * 0.55, r * 0.38, s.rot || 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ———————— 镜头表 ————————
export default [
  {
    id: 'b10_q1', start: T0, end: WHIP_D2[1], z: 1,
    draw(g, T, lt, ctx) {
      fxBase(ctx);
      if (T < WHIP_IN[1]) {
        whipCurtain(ctx, g, T, { t0: WHIP_IN[0], t1: WHIP_IN[1], from: 'right', colors: [PAL.goldLight, PAL.dragonDeep] }, (g2) => frameQ1(g2, T, ctx));
        return;
      }
      frameQ1(g, T, ctx);
      if (T >= WHIP_D2[0]) {
        whipCurtain(ctx, g, T, { t0: WHIP_D2[0], t1: WHIP_D2[1], from: 'right', colors: [PAL.dragonDeep, PAL.fire] }, (g2) => frameD2(g2, T, ctx, withDrift(camD2Base(T), T)));
      }
    },
  },
  {
    id: 'b10_d2', start: WHIP_D2[1], end: SNAP_Q2[0],
    draw(g, T, lt, ctx) {
      fxBase(ctx);
      frameD2(g, T, ctx, camAt(T));
      D2_TIMES.slice(0, 12).forEach((t, i) => impactK(ctx, T, t, 'S', { shake: 6, flash: 0, seed: i + 1 }));
      impactK(ctx, T, SONG_T, 'S', { shake: 9, flash: 0.2, flashColor: PAL.fire2, seed: 21 });
    },
  },
  {
    id: 'b10_q2', start: SNAP_Q2[0], end: C('M1'),
    draw(g, T, lt, ctx) {
      fxBase(ctx);
      frameD2(g, T, ctx, camAt(T), {
        ui: (gg, A, c) => {
          const pop = (T - (C('Q2') + 0.09)) / 0.2;
          if (pop <= 0 || !A.hero) return;
          const m = toScreen(c, 1, A.hero.mouth[0], A.hero.mouth[1]);
          ctx.layer(gg, { shadow: 8, texture: 0.25 }, (lg) => {
            bubble(lg, { ...Q_BUBBLE, text: '是不是…', tail: [m[0] + 70, m[1] - 40], pop, t: T, seed: 6 });
          });
        },
      });
      ctx.fx.sat = Math.max(ctx.fx.sat, 1 + 0.2 * seg(T, C('M1') - 0.12, C('M1')));
    },
  },
  {
    id: 'b10_mishear', start: C('M1'), end: T_LOW,
    draw(g, T, lt, ctx) {
      fxBase(ctx);
      frameMishear(g, T, ctx);
      ctx.fx.sat = Math.max(ctx.fx.sat, 1 + 0.2 * (1 - seg(T, C('R1') + 0.1, C('R1') + 0.4)));
      if (T >= SMOKE.t0) smokeWipe(g, T, { t0: SMOKE.t0, t1: SMOKE.t1, tFull: SMOKE.tFull, x: 1300, y: 420, color: PAL.dragonDeep });
    },
  },
  {
    id: 'b10_d3', start: T_LOW, end: SEAM_T,
    draw(g, T, lt, ctx) {
      fxBase(ctx);
      frameD3(g, T, ctx);
      if (T < SMOKE.t1) smokeWipe(g, T, { t0: SMOKE.t0, t1: SMOKE.t1, tFull: SMOKE.tFull, x: 1300, y: 420, color: PAL.dragonDeep });
    },
  },
];
