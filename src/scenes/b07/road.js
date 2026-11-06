// b07 私有：JOURNEY 一镜到底（G / M 区，81.00–90.00）。
// 机位、勇者 / 白马状态、HUD、小地图、遮挡物一律来自 journey.js 与接缝合同（_seams.js）的共享函数；
// 块内只在离接缝 0.3s 以外叠加自己的表演（挥刀、叼金币、贴创可贴、升级金环），89.50 起逐字调用合同的 drawJourneyRider。
import { PAL, glow, sparkle, blob } from '../../core/paper.js';
import { clamp, lerp, seg, smoothstep, hash2, TAU, rgba, mixHex } from '../../core/util.js';
import { applyCam, toScreen } from '../../core/camera.js';
import { outCubic, outBack, inOutSine, inOutQuad, outQuad, inQuad, inOutCubic } from '../../core/ease.js';
import { drawJourney, drawOccluder, journeyCam, journeyTexOffset, journeyGroundY, JOURNEY, hudState } from '../../env/journey.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawHorse, horseRig, drawReins } from '../../rigs/horse.js';
import { drawSlime, drawBat, drawSnail } from '../../rigs/monsters.js';
import { glyphIcon, expBarBig, lvUpBadge, damageNumber, HUD_LAYOUT } from '../../ui/kit.js';
import { glyphRow } from '../../ui/type.js';
import { impact, speedLines } from '../../fx/transitions.js';
import { journeyRiderParams, drawJourneyRider } from '../_seams.js';
import { V04, V05, V06, V07, V08, V09, k01 } from './common.js';

const EV = JOURNEY.events;
const SLIMES = JOURNEY.slimes;
const SLASH = EV.slashes;                    // 82.60 / 82.95 / 83.30
const COIN_AT = EV.coins;                    // 83.83 + 0.14·i
const LV_AT = EV.lvUps;                      // 88.40 / 89.10 / 89.80
const CRACK_AT = EV.heartCracks;
/** 89.50 起不再叠任何块内表演：骑手逐字调用合同的 drawJourneyRider。 */
const T_PURE = V09 - 0.65;
/** 屏幕元素（经验条、徽章、金环、掉落的创可贴）必须在 89.85 前收完（合同 notes）。 */
const T_UI_END = V09 - 0.3;

// ———————————————————— 骑手：合同参数 + 块内表演 ————————————————————
const SW0 = SLASH[0] - 0.14, SW1 = EV.treeGag;          // 剑在手里：第一刀起手 → 树干盖住勇者那一刻收回背上
const BITE_AT = COIN_AT[11] - 0.77;                      // 84.60 叼住（+0.32 咔嚓验真 84.92，+0.63 吐出 85.23 → 85.37 进账）
const NOSE = [EV.noseBandage - 0.15, EV.noseBandage + 0.25]; // 87.45–87.85 俯身给马鼻子贴创可贴
function riderParams(T) {
  const { st, horse, hero } = journeyRiderParams(T);
  const h = { ...horse }, r = { ...hero, injury: { ...hero.injury }, scarf: { ...hero.scarf } };
  // 三刀：rideSlash 的 act 每一刀 0→1
  if (T >= SW0 && T < SW1) {
    r.sword = 'hand';
    let act = null;
    for (const t of SLASH) if (T >= t - 0.14 && T < t + 0.2) act = seg(T, t - 0.14, t + 0.16);
    if (act != null) r.act = act;
    if (typeof r.pose === 'string' && r.pose === 'ride') r.swordAngle = -0.75;
    if (typeof r.pose === 'object' && r.pose.to === 'ride') r.swordAngle = -0.75;
    if (T >= SLASH[2] + 0.3) r.expr = T < V06 ? 'determined' : r.expr;
  }
  // 叼金币验真
  if (T >= BITE_AT - 0.3 && T < BITE_AT + 0.82) {
    const kin = inOutQuad(seg(T, BITE_AT - 0.3, BITE_AT - 0.22)), kout = inOutQuad(seg(T, BITE_AT + 0.7, BITE_AT + 0.82));
    h.pose = kout > 0 ? { from: 'biteCoin', to: 'gallop', k: kout } : kin < 1 ? { from: 'gallop', to: 'biteCoin', k: kin } : 'biteCoin';
    h.gait = 'gallop'; h.at = BITE_AT;
  }
  // 87.40 叹气（表情先变）→ 87.45 俯身贴创可贴
  if (T >= EV.sigh - 0.08 && T < EV.sigh + 0.12) r.expr = 'relieved';
  if (T >= NOSE[0] && T < NOSE[1]) {
    const k = inOutSine(seg(T, NOSE[0], NOSE[0] + 0.13)) * (1 - inOutSine(seg(T, NOSE[1] - 0.13, NOSE[1])));
    r.pose = { from: 'ride', to: 'rideLean', k };
    r.jointsAdd = { aF: [96 * k, -34 * k, 0], lean: 24 * k, nod: 10 * k };
    h.joints = { neck: -10 * k, head: -14 * k }; // 马也把鼻子凑过来
    r.expr = 'grin';
    h.noseBandage = clamp((T - (EV.noseBandage - 0.02)) / 0.16);
  }
  return { st, horse: h, hero: r };
}
function drawRider(lg, T) {
  if (T >= T_PURE) return drawJourneyRider(lg, { t: T });
  const { horse, hero } = riderParams(T);
  const probe = horseRig(horse);
  const rO = { ...hero, x: probe.saddle[0], y: probe.saddle[1], rot: probe.saddleRot };
  const foot = heroRig(rO).foot;
  const ha = drawHorse(lg, { ...horse, stirrupAt: foot });
  const ra = drawHero(lg, rO);
  if (ra && ra.handL) drawReins(lg, ha.bit, ra.handL, { s: 1 });
  return { horse: ha, hero: ra };
}

// ———————————————————— 史莱姆、蝙蝠、刀光、金币（世界坐标） ————————————————————
function drawSlimes(lg, T) {
  SLIMES.forEach((sl, i) => {
    if (T < sl.at) return;
    const burst = seg(T, sl.slashAt, sl.slashAt + 0.6);
    if (burst >= 1) return;
    const pop = seg(T, sl.at, sl.at + 0.5);
    const scared = T >= sl.slashAt - 0.28;
    drawSlime(lg, { x: sl.x, y: journeyGroundY(sl.x), s: 1, face: -1, t: T, seed: i + 3, pop, hop: pop >= 1 && !scared ? true : undefined,
      eyes: scared ? 'scared' : 'roll', burst, hit: burst > 0 ? 0 : 0.35 * Math.exp(-Math.max(0, sl.slashAt - T) / 0.05) * (T > sl.slashAt - 0.06 ? 1 : 0) });
  });
}
const BATS = [
  { x: 3330, y: 820, vx: 520, vy: -620, seed: 1, s: 0.85 },
  { x: 3415, y: 836, vx: 700, vy: -520, seed: 2, s: 0.72 },
];
function drawBats(lg, T) {
  const t0 = EV.bats;
  if (T < t0 || T > t0 + 1.6) return;
  for (const b of BATS) {
    const tau = T - t0;
    const x = b.x + b.vx * tau * (0.6 + 0.4 * Math.min(1, tau * 3)), y = b.y + b.vy * tau + 160 * tau * tau + 18 * Math.sin(tau * 14 + b.seed);
    drawBat(lg, { x, y, s: b.s * Math.min(1, 0.4 + tau * 4), face: 1, t: T, seed: b.seed, pose: 'fly', expr: 'normal' });
  }
}
/** 月牙刀光：从刀口飞向史莱姆，t 时刻命中。 */
function drawCrescents(lg, T, heroX) {
  SLASH.forEach((t, i) => {
    const a = t - 0.1, b = t;
    if (T < a || T > t + 0.18) return;
    const sl = SLIMES[i];
    const hx = heroX(a) + 110, hy = 860 - 205;
    const tx = sl.x - 10, ty = 860 - 42;
    const u = outQuad(seg(T, a, b));
    const x = lerp(hx, tx, u), y = lerp(hy, ty, u);
    const fade = 1 - seg(T, t, t + 0.18);
    const ang = Math.atan2(ty - hy, tx - hx);
    lg.save(); lg.translate(x, y); lg.rotate(ang);
    const R = 74 * (0.8 + 0.4 * u) * (1 + 0.5 * (1 - fade));
    const p = new Path2D();
    p.arc(0, 0, R, -1.15, 1.15);
    p.arc(-R * 0.42, 0, R * 0.92, 1.02, -1.02, true);
    p.closePath();
    lg.globalAlpha *= fade;
    lg.fillStyle = rgba(PAL.white, 0.95); lg.fill(p);
    lg.strokeStyle = rgba(PAL.crystal, 0.55); lg.lineWidth = 3; lg.stroke(p);
    // 速度丝
    lg.strokeStyle = rgba(PAL.white, 0.5); lg.lineWidth = 2.5; lg.lineCap = 'round';
    for (let k = -2; k <= 2; k++) { lg.beginPath(); lg.moveTo(-R * 0.6, k * R * 0.28); lg.lineTo(-R * 1.8 - 30 * Math.abs(k), k * R * 0.32); lg.stroke(); }
    lg.restore();
    // 命中：冲击星
    if (T >= t) {
      const e = 1 - seg(T, t, t + 0.22);
      sparkle(lg, tx, ty - 6, 120 * (0.5 + 0.5 * outBack(seg(T, t, t + 0.08))) * e, { color: PAL.white, alpha: e, rot: 0.3 * i });
      sparkle(lg, tx, ty - 6, 70 * e, { color: PAL.goldLight, alpha: e, rot: 0.3 * i + 0.785 });
    }
  });
}

// 金币：每只史莱姆炸出 4 枚，落地弹两下，按 COIN_AT 逐枚飞进计数器；第 12 枚被白马半路叼住、验真后吐出。
const COIN_FLY = 0.42;
const COINS = Array.from({ length: 12 }, (_, i) => {
  const k = Math.floor(i / 4), j = i % 4, sl = SLIMES[k];
  const land = sl.x + [-120, -40, 50, 140][j] + (hash2(i, 5) - 0.5) * 40;
  return { i, t0: sl.slashAt + 0.05, x0: sl.x, y0: 860 - 40, x1: land, y1: 852, h: 150 + 90 * hash2(i, 6), fly: COIN_AT[i] - COIN_FLY };
});
COINS[11].fly = BITE_AT - 0.24; // 被叼的那枚：84.36 弹起飞向马嘴
function coinWorld(cn, T) {
  // 炸出 → 落地（0.42s 抛物线）→ 两次小弹跳
  const u = seg(T, cn.t0, cn.t0 + 0.42);
  if (u < 1) return [lerp(cn.x0, cn.x1, u), lerp(cn.y0, cn.y1, u) - cn.h * 4 * u * (1 - u), u];
  const b = T - (cn.t0 + 0.42);
  const hop = (bt, d, H) => (bt >= 0 && bt < d ? H * 4 * (bt / d) * (1 - bt / d) : 0);
  return [cn.x1, cn.y1 - hop(b, 0.22, 26) - hop(b - 0.22, 0.12, 8), 1];
}
function drawCoinsWorld(lg, T) {
  for (const cn of COINS) {
    if (T < cn.t0 || T >= cn.fly) continue;
    const [x, y] = coinWorld(cn, T);
    glyphIcon(lg, 'coin', x, y - 17, 36, { spin: (T - cn.t0) * 9 + cn.i });
  }
}

// ———————————————————— 升级：金环 + 掉一张创可贴（世界坐标，勇者胸口） ————————————————————
const LV_DUR = [0.42, 0.42, 0.12];
function drawLevelRings(lg, T, heroX) {
  LV_AT.forEach((t, i) => {
    const d = LV_DUR[i];
    if (T < t || T > t + d) return;
    const u = seg(T, t, t + d);
    const x = heroX(T) + 4, y = 860 - 250;
    lg.save();
    lg.strokeStyle = rgba(PAL.goldLight, 0.95 * (1 - u)); lg.lineWidth = 16 * (1 - u) + 3;
    lg.beginPath(); lg.ellipse(x, y, 70 + 150 * outCubic(u), 52 + 110 * outCubic(u), 0, 0, TAU); lg.stroke();
    lg.strokeStyle = rgba(PAL.gold, 0.8 * (1 - u)); lg.lineWidth = 5;
    lg.beginPath(); lg.ellipse(x, y, 40 + 110 * outCubic(u), 30 + 80 * outCubic(u), 0, 0, TAU); lg.stroke();
    lg.restore();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + i, r = 90 + 150 * outCubic(u);
      sparkle(lg, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, 26 * (1 - u), { color: PAL.goldLight, alpha: 1 - u, rot: a });
    }
    // 掉一张创可贴：从身上飘落、翻转、淡出
    const fall = seg(T, t + 0.02, t + d);
    if (fall > 0 && fall < 1) {
      const px = x - 30 - 60 * fall, py = y + 10 + 150 * fall * fall;
      lg.save(); lg.translate(px, py); lg.rotate(fall * 5 + i); lg.scale(1, Math.cos(fall * 9));
      lg.globalAlpha *= 1 - fall;
      lg.fillStyle = mixHex(PAL.skin, PAL.paper, 0.4); lg.fillRect(-15, -6, 30, 12);
      lg.fillStyle = mixHex(PAL.skin, PAL.kraft, 0.5); lg.fillRect(-5, -6, 10, 12);
      lg.restore();
    }
  });
}

// ———————————————————— 叹气、给马贴创可贴（世界坐标的小特效） ————————————————————
function drawSigh(lg, T, anchors) {
  const t0 = EV.sigh;
  if (T < t0 || T > t0 + 0.8 || !anchors) return;
  const m = anchors.hero.mouth;
  for (let k = 0; k < 3; k++) {
    const a = T - t0 - k * 0.07;
    if (a < 0) continue;
    const u = seg(a, 0, 0.7);
    const x = m[0] + 18 + 60 * u + k * 8, y = m[1] - 8 - 70 * u - k * 10;
    lg.fillStyle = rgba(PAL.paper, 0.75 * (1 - u));
    lg.fill(blob(x, y, 13 + 20 * u - k * 3, 10 + 14 * u - k * 2, { seed: 40 + k, amp: 0.08 }));
  }
}
function drawHeldBandage(lg, T, anchors) {
  if (!anchors || T < NOSE[0] || T > EV.noseBandage) return;
  const hd = anchors.hero.handR;
  lg.save(); lg.translate(hd[0] + 6, hd[1] + 4); lg.rotate(-0.4);
  lg.fillStyle = mixHex(PAL.skin, PAL.paper, 0.4); lg.fillRect(-14, -5, 28, 10);
  lg.fillStyle = mixHex(PAL.skin, PAL.kraft, 0.5); lg.fillRect(-5, -5, 10, 10);
  lg.restore();
}

// ———————————————————— 画旅途一帧 ————————————————————
/**
 * o: { clipX:[x0,x1]（城门拱换景：只画接缝右边）, merge（远+中景合并为 1 层，换景期省缓冲）, fgExtra(lg)（与旅途前景同层的额外前景：广场前景） , noOcc }
 * 返回 { c, rider }。
 */
export function drawRoadWorld(g, T, ctx, o = {}) {
  const c = journeyCam(T);
  const cl = o.clipX ? { clipX: o.clipX } : {};
  drawJourney(g, T, c, { layer: 'sky', ...cl });
  if (o.merge) {
    ctx.layer(g, { shadow: 6, texture: 0.25, texOffset: journeyTexOffset(c, 0.5) }, (lg) => { drawJourney(lg, T, c, { layer: 'far', ...cl }); drawJourney(lg, T, c, { layer: 'mid', ...cl }); });
  } else {
    ctx.layer(g, { shadow: 4, texture: 0.22, texOffset: journeyTexOffset(c, 0.25) }, (lg) => drawJourney(lg, T, c, { layer: 'far', ...cl }));
    ctx.layer(g, { shadow: 7, texture: 0.28, texOffset: journeyTexOffset(c, 0.8) }, (lg) => drawJourney(lg, T, c, { layer: 'mid', ...cl }));
  }
  let rider = null;
  const heroX = (t) => JOURNEY_HERO_X(t);
  ctx.layer(g, { shadow: 10, texture: 0.3, texOffset: journeyTexOffset(c, 1) }, (lg) => {
    drawJourney(lg, T, c, { layer: 'main', ...cl });
    lg.save();
    if (o.clipX) { lg.beginPath(); lg.rect(o.clipX[0], -100, o.clipX[1] - o.clipX[0], 1300); lg.clip(); }
    applyCam(lg, c, 1);
    if (T < T_PURE) {
      drawSlimes(lg, T);
      drawCoinsWorld(lg, T);
    }
    rider = drawRider(lg, T);
    if (T < T_PURE) {
      drawHeldBandage(lg, T, rider);
      drawSigh(lg, T, rider);
      drawBats(lg, T);
      drawCrescents(lg, T, heroX);
    }
    if (T < T_UI_END + 0.1) drawLevelRings(lg, T, heroX);
    lg.restore();
    drawJourney(lg, T, c, { layer: 'front', ...cl });
  });
  drawJourney(g, T, c, { layer: 'light', ...cl });
  // 出城的速度线（81.00–82.00，机位最快）
  const sl = k01(T, T_GATE_SPEED0, T_GATE_SPEED0 + 0.25) * (1 - k01(T, V05 - 0.3, V05));
  if (sl > 0) {
    g.save();
    if (o.clipX) { g.beginPath(); g.rect(o.clipX[0], -10, o.clipX[1] - o.clipX[0], 1100); g.clip(); }
    speedLines(g, 'h', { x: 0, y: 330, w: 1920, h: 560 }, { t: T, sign: -1, alpha: 0.32 * sl, density: 1.4, colors: [PAL.white, PAL.skyDayLow], mask: (u) => Math.exp(-(((u - 0.55) / 0.3) ** 2)) });
    g.restore();
  }
  ctx.layer(g, { blur: 4, shadow: 12 }, (lg) => {
    if (o.fgExtra) o.fgExtra(lg);
    drawJourney(lg, T, c, { layer: 'fg', ...cl });
  });
  if (!o.noOcc && T > V04 + 1.6) ctx.layer(g, { blur: 6 }, (lg) => drawOccluder(lg, T, c));
  // 冲击：三刀小震
  if (T < T_PURE) for (const t of SLASH) impact(ctx, T, t, 'S', { shake: 7, flash: 0.12, seed: 3 });
  return { c, rider };
}
const T_GATE_SPEED0 = V04 + 0.7;
const JOURNEY_HERO_X = (t) => { const c = journeyCam(t, { drift: false }); return c.x - 200 / c.zoom; };

// ———————————————————— 屏幕元素（画在 HUD 层里，卡片之后） ————————————————————
/** 金币飞进计数器、「啪！」「-8」、心裂「咔」、V08 经验条 + 蜗牛 + LV UP 徽章。anchors = drawHUD 的返回。 */
export function drawRoadUI(lg, T, anchors, hs) {
  if (T >= T_UI_END + 0.02) return;
  const coinA = anchors.coin;
  // 金币飞行
  for (const cn of COINS) {
    if (T < cn.fly) continue;
    if (cn.i === 11) { drawBittenCoin(lg, T, coinA, cn); continue; }
    const t1 = COIN_AT[cn.i];
    if (T > t1 + 0.25) continue;
    const c0 = journeyCam(cn.fly);
    const [wx, wy] = coinWorld(cn, cn.fly);
    const s0 = toScreen(c0, 1, wx, wy - 14);
    if (T <= t1) {
      const u = inOutSine(seg(T, cn.fly, t1));
      const ctl = [lerp(s0[0], coinA[0], 0.3), Math.min(s0[1], coinA[1]) - 180 - 60 * hash2(cn.i, 2)];
      const p = qb(s0, ctl, coinA, u);
      const sz = lerp(44, 30, u) * (0.75 + 0.25 * outBack(seg(T, cn.fly, cn.fly + 0.12)));
      // 金色拖尾（三颗渐小的残影）+ 光晕
      for (let k = 3; k >= 1; k--) {
        const q = qb(s0, ctl, coinA, Math.max(0, u - 0.06 * k));
        glow(lg, q[0], q[1], sz * (0.9 - 0.15 * k), PAL.goldLight, 0.28 * (1 - k / 4));
      }
      glow(lg, p[0], p[1], sz * 1.5, PAL.goldLight, 0.6);
      glyphIcon(lg, 'coin', p[0], p[1], sz, { spin: T * 14 + cn.i });
    } else {
      const e = 1 - seg(T, t1, t1 + 0.25);
      sparkle(lg, coinA[0], coinA[1], 46 * e, { color: PAL.goldLight, alpha: e, rot: cn.i });
      sparkle(lg, coinA[0] + 18, coinA[1] - 16, 22 * e, { color: PAL.white, alpha: e, rot: cn.i * 2 });
    }
  }
  // 三刀：「啪！」+「-8」
  SLASH.forEach((t, i) => {
    if (T < t || T > t + 0.95) return;
    const c = journeyCam(t);
    const sl = SLIMES[i];
    const [sx, sy] = toScreen(c, 1, sl.x, 860 - 60);
    const pa = seg(T, t, t + 0.1), fade = 1 - seg(T, t + 0.38, t + 0.5);
    if (fade > 0) {
      lg.save(); lg.globalAlpha *= fade;
      glyphRow(lg, ['啪', '！'], sx + 40, sy - 120, 62, { style: 'cut', appear: [pa, seg(T, t + 0.03, t + 0.13)], perChar: (k) => ({ rot: (k ? 0.2 : -0.12) }) });
      lg.restore();
    }
    damageNumber(lg, { text: '-8', x: sx - 30, y: sy - 70, size: 46, color: 'red', p: seg(T, t + 0.02, t + 0.92), rise: 80 });
  });
  // 心裂开「咔」：贴在角色卡右侧、与心同一行，一下一个、逐次往上错一点
  CRACK_AT.forEach((t, k) => {
    if (T < t || T > t + 0.34) return;
    const h = anchors.hearts[4];
    const u = seg(T, t, t + 0.34);
    lg.save(); lg.globalAlpha *= 1 - smoothstep(0.55, 1, u);
    glyphRow(lg, ['咔'], 652 + 16 * k, h[1] - 6 - 12 * k - 14 * outCubic(u), 40, { family: 'play', fill: PAL.ink, edge: PAL.paper, edgeW: 0.16, appear: [seg(T, t, t + 0.07)], align: 'center', perChar: () => ({ rot: (k % 2 ? 0.16 : -0.12) }) });
    lg.restore();
  });
  drawExpBig(lg, T, hs, anchors);
}

/** 第 12 枚：84.36 从地上弹起飞向马嘴（84.60 叼住，马自己画嘴里那枚）→ 85.23 吐出 → 85.37 进账。 */
function drawBittenCoin(lg, T, coinA, cn) {
  const tCatch = BITE_AT, tSpit = BITE_AT + 0.63, t1 = COIN_AT[11];
  if (T < tCatch) {
    const c = journeyCam(T);
    const a0 = coinWorld(cn, cn.fly);
    const ho = riderParams(tCatch).horse;
    const mouth = horseRig(ho).mouth;
    const u = outQuad(seg(T, cn.fly, tCatch));
    const p = [lerp(a0[0], mouth[0], u), lerp(a0[1] - 14, mouth[1], u) - 120 * 4 * u * (1 - u)];
    const s = toScreen(c, 1, p[0], p[1]);
    glyphIcon(lg, 'coin', s[0], s[1], 30, { spin: T * 12 });
    return;
  }
  if (T < tSpit) return;
  if (T <= t1) {
    const c0 = journeyCam(tSpit);
    const ho = riderParams(tSpit - 0.01).horse;
    const m = horseRig(ho).coin || horseRig(ho).mouth;
    const s0 = toScreen(c0, 1, m[0], m[1]);
    const u = inOutQuad(seg(T, tSpit, t1));
    const ctl = [lerp(s0[0], coinA[0], 0.5), Math.min(s0[1], coinA[1]) - 120];
    const p = qb(s0, ctl, coinA, u);
    const p2 = qb(s0, ctl, coinA, Math.max(0, u - 0.18));
    lg.save(); lg.strokeStyle = rgba(PAL.goldLight, 0.6); lg.lineWidth = 10; lg.lineCap = 'round';
    lg.beginPath(); lg.moveTo(p2[0], p2[1]); lg.lineTo(p[0], p[1]); lg.stroke(); lg.restore();
    glow(lg, p[0], p[1], 40, PAL.goldLight, 0.5);
    glyphIcon(lg, 'coin', p[0], p[1], 30, { spin: T * 16 });
  } else if (T < t1 + 0.3) {
    const e = 1 - seg(T, t1, t1 + 0.3);
    sparkle(lg, coinA[0], coinA[1], 60 * e, { color: PAL.goldLight, alpha: e });
  }
}
const qb = (a, b, cc, u) => [(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * b[0] + u * u * cc[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * b[1] + u * u * cc[1]];

// ———————————————————— V08 慢慢升级 ————————————————————
const BIG = [V08, V08 + 0.2];                 // 88.01 弹出（线性 k，expBarBig 内部 outBack）
const BACK = [V08 + 1.67, T_UI_END];          // 89.68–89.85 缩回 HUD
/** 放大经验条：默认 x 560 会压到角色卡（96–600），整体右移到 650–1420（LV 字在小地图 1524 之前）。 */
const BIG_RECT = { x: 650, y: 146, w: 770, h: 30 };
function drawExpBig(lg, T, hs, anchors) {
  if (T < BIG[0] || T >= BACK[1]) return;
  const k = T < BACK[0] ? seg(T, BIG[0], BIG[1]) : 1 - seg(T, BACK[0], BACK[1]);
  if (k <= 0) return;
  // 填充：跟 hudState.exp；89.80 之后保持满格（蜗牛戴着王冠趴在终点被收回）
  let fill = T >= LV_AT[2] ? 1 : hs.exp;
  // 每次升级的 0.12s：蜗牛从终点“蹦”回起点
  let hopU = -1;
  for (let i = 0; i < 2; i++) if (T >= LV_AT[i] && T < LV_AT[i] + 0.12) hopU = seg(T, LV_AT[i], LV_AT[i] + 0.12);
  // LV UP 徽章（在条之后画 = 条在上）
  drawBadges(lg, T, anchors);
  const eb = expBarBig(lg, { k, fill, lv: hs.lv, t: T, rect: BIG_RECT, alpha: 1 - seg(T, BACK[1] - 0.05, BACK[1]) });
  if (!eb) return;
  const sc = eb.rect.h / 30;
  let sx = eb.snail[0], sy = eb.snail[1];
  if (hopU >= 0) {
    const x0 = eb.rect.x + eb.rect.w, x1 = eb.rect.x;
    sx = lerp(x0, x1, inOutSine(hopU)); sy = eb.rect.y - 70 * sc * 4 * hopU * (1 - hopU);
  }
  const crown = T >= LV_AT[2] ? outBack(seg(T, LV_AT[2], LV_AT[2] + 0.05)) : 0;
  lg.save(); lg.globalAlpha *= 1 - seg(T, BACK[1] - 0.05, BACK[1]);
  drawSnail(lg, { x: Math.max(eb.rect.x + 14 * sc, sx), y: sy + 2 * sc, s: 1.15 * sc, t: T, crawl: T * 3.2, crown, expr: crown > 0.5 ? 'proud' : hopU >= 0 ? 'happy' : 'effort' });
  // 使劲的汗珠
  if (hopU < 0 && crown <= 0) {
    const ph = (T * 2.2) % 1;
    lg.fillStyle = rgba(PAL.skyDay, 0.9 * (1 - ph));
    lg.beginPath(); lg.arc(sx + 30 * sc, sy - 44 * sc + ph * 26 * sc, 4.5 * sc, 0, TAU); lg.fill();
  }
  lg.restore();
}
/** 88.40 第一枚气球徽章慢慢鼓起；89.10 它松手飞走、第二枚（0.8 倍）鼓起；89.60 第二枚缩小飞进 HUD 的 LV，89.80 落进去（LV 4）。 */
function drawBadges(lg, T, anchors) {
  const t1 = LV_AT[0], t2 = LV_AT[1], t3 = LV_AT[2];
  if (T >= t1 && T < t2 + 0.45) {
    const p = seg(T, t1, t1 + 0.35);
    const up = T < t2 ? 0 : inQuad(seg(T, t2 - 0.04, t2 + 0.4));
    lvUpBadge(lg, { x: 1180 + 260 * up + 14 * Math.sin(T * 5) * up, y: 340 - 560 * up, p, s: 1, t: T });
  }
  if (T >= t2 && T < t3) {
    const p = seg(T, t2, t2 + 0.35);
    const fly = inOutCubic(seg(T, t3 - 0.22, t3));
    const lv = HUD_LAYOUT.lv;
    const x = lerp(1180, lv[0] + 30, fly), y = lerp(352, lv[1], fly) - 160 * Math.sin(Math.PI * fly);
    lvUpBadge(lg, { x, y, p, s: lerp(0.8, 0.22, fly), t: T });
  }
  void anchors;
}
export { V07 };
