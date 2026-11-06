// b08 私有：旅途一帧（与 b07 共用同一套 journey.js 世界、机位、状态、HUD；本文件只决定图层配方与块内的戏）。
// 图层配方、整帧后期、骑手映射全部从接缝合同 SEAMS['b07|b08'] 读（_seams.js），保证 90.00 与 b07 逐像素一致。
// 图层预算：far / mid / main / fg / 遮挡物 / HUD = 6 个 ctx.layer（98.60 起 b09 的洞口遮罩 +1，合计 ≤ 8）。
import { PAL } from '../../core/paper.js';
import { clamp, smoothstep, mixHex } from '../../core/util.js';
import { applyCam } from '../../core/camera.js';
import { cue } from '../../cues.js';
import { drawJourney, drawOccluder, journeyCam, journeyZones, hudState, heroJourneyState, JOURNEY } from '../../env/journey.js';
import { drawMiniMap } from '../../env/map.js';
import { drawHUD } from '../../ui/kit.js';
import { impact } from '../../fx/transitions.js';
import { SEAMS, journeyFx, resolveParams } from '../_seams.js';
import { drawRider, drawSnowCap, drawHeroBreath } from './rider.js';
import { drawVillagers, drawContainers, drawItemFlights, drawOpenSparks, drawChickenRun } from './village.js';
import { drawGoldMotes, drawOakLeaves, drawWindStreaks, drawSneezeSnow, drawScarfCrack, drawSneezeWords, drawMoonHalo, drawBrakeDust } from './fx.js';

const V11 = cue('V11'), V12 = cue('V12'), V13 = cue('V13');
const EV = JOURNEY.events;
const SEAM = SEAMS['b07|b08'];
/** 合同图层表里某层的 ctx.layer 参数（值可能是 (T, E) 函数）。 */
const LAYER_O = (id, T, c) => resolveParams(SEAM.layers.find((l) => l.id === id).o, T, { c });

// ———— 各区的整帧后期（色彩剧本），按区在画面里所占的宽度加权，换区时随遮挡物连续过渡 ————
// G/M 与 V 区一律用合同的 journeyFx(T)（89.95 起 = V 区：sat 1.0 + goldLight screen 0.10）；S / N / C 是本块自己的。
const DEF_VIG = '#2a1520'; // 引擎默认暗角色
const ZONE_FX = [
  null, // 0 G/M → journeyFx
  null, // 1 V   → journeyFx
  { sat: 0.7, bright: 1, tint: 0, vig: 0.3, vigC: 0 }, // 2 S 风雪：sat 0.7
  { sat: 1.0, bright: 0.9, tint: 0, vig: 0.36, vigC: 0.5 }, // 3 N 月光：bright 0.9
  { sat: 1.0, bright: 0.92, tint: 0, vig: 0.5, vigC: 1 }, // 4 C 洞口：vignette 0.5 dragonDeep
];
/** 每个区在屏幕上的可见宽度占比。 */
export function zoneWeights(zs) {
  const w = [0, 0, 0, 0, 0];
  for (const z of zs) w[z.z] += Math.max(0, Math.min(1920, z.x1) - Math.max(0, z.x0)) / 1920;
  const s = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((v) => v / s);
}
function applyZoneFx(ctx, T, w) {
  const f = ctx.fx, jf = journeyFx(T);
  const V = { sat: jf.sat, bright: 1, tint: jf.tintAlpha, vig: 0.3, vigC: 0 };
  let sat = 0, bright = 0, tint = 0, vig = 0, vigC = 0;
  for (let k = 0; k < 5; k++) { const z = ZONE_FX[k] || V; sat += w[k] * z.sat; bright += w[k] * z.bright; tint += w[k] * z.tint; vig += w[k] * z.vig; vigC += w[k] * z.vigC; }
  const r6 = (v) => Math.round(v * 1e6) / 1e6; // 去掉加权的浮点尾数（接缝帧要与合同逐像素一致）
  f.sat = r6(sat); f.bright = r6(bright);
  if (tint > 0.001) { f.tint = jf.tint; f.tintAlpha = r6(tint); f.tintMode = jf.tintMode; }
  f.vignette = r6(vig); f.vignetteColor = mixHex(DEF_VIG, PAL.dragonDeep, clamp(vigC));
}
const spanOf = (zs, k) => { const z = zs.find((q) => q.z === k); return z ? { x0: Math.max(-10, z.x0), x1: Math.min(1930, z.x1) } : null; };
const clipTo = (g, sp) => { g.beginPath(); g.rect(sp.x0, -200, sp.x1 - sp.x0, 1500); g.clip(); };

/** 冲击：每个 cue 的重音（小级）。 */
function applyImpacts(ctx, T) {
  impact(ctx, T, EV.containers[0], 'S', { shake: 5, flash: 0 });
  impact(ctx, T, EV.containers[4], 'S', { shake: 8, flash: 0.12, flashColor: PAL.goldLight });
  impact(ctx, T, V11, 'S', { shake: 7, flash: 0.22, flashColor: PAL.white });
  impact(ctx, T, EV.sneeze, 'S', { shake: 9, flash: 0.15, flashColor: PAL.white });
  impact(ctx, T, V13 + 0.02, 'S', { shake: 10, flash: 0 });
}

/** 整帧。 */
export function drawFrame(g, T, ctx) {
  const c = SEAM.camAt(T); // = journeyCam(T)：整帧只算一次，所有层、遮挡物、角色共用
  const zs = journeyZones(c);
  applyZoneFx(ctx, T, zoneWeights(zs));
  const sV = spanOf(zs, 1), sS = spanOf(zs, 2), sN = spanOf(zs, 3);
  const st = heroJourneyState(T);

  // 天
  drawJourney(g, T, c, { layer: 'sky' });
  // 远景
  ctx.layer(g, LAYER_O('far', T, c), (lg) => drawJourney(lg, T, c, { layer: 'far' }));
  // 中景 + 屋门口的村民（只在 V 区那一侧）
  ctx.layer(g, LAYER_O('mid', T, c), (lg) => {
    drawJourney(lg, T, c, { layer: 'mid' });
    if (sV) { lg.save(); clipTo(lg, sV); drawVillagers(lg, T, c); lg.restore(); }
  });
  // 主体：地面 → 容器 → 骑手 → 身上的雪 / 白气 / 喷嚏 → 鸡 → 扬尘 → 岩石与细雪（front）→ 屏幕拟声
  let R = null;
  ctx.layer(g, LAYER_O('main', T, c), (lg) => {
    drawJourney(lg, T, c, { layer: 'main' });
    if (sV) { lg.save(); clipTo(lg, sV); applyCam(lg, c, 1); drawContainers(lg, T); lg.restore(); }
    lg.save(); applyCam(lg, c, 1);
    const sil = smoothstep(EV.dismount[1] + 0.05, EV.dismount[1] + 0.4, T) * 0.88; // 98.60–98.95 背着洞口紫光渐成剪影
    R = drawRider(lg, T, { sil });
    if (st.snowCap > 0.01) drawSnowCap(lg, R.hero, st.snowCap);
    if (T >= V11 && T < V12) drawHeroBreath(lg, T, R.hero);
    drawSneezeSnow(lg, T, R.hero);
    drawScarfCrack(lg, T, R.hero);
    drawBrakeDust(lg, T);
    lg.restore();
    if (sV) { lg.save(); clipTo(lg, sV); applyCam(lg, c, 1); drawChickenRun(lg, T, c); lg.restore(); }
    drawJourney(lg, T, c, { layer: 'front' });
    drawSneezeWords(lg, T, c, R.hero);
  });
  // 光（screen）：太阳 / 月光 / 萤火 / 洞口紫光 + 块内的金尘、开箱金光、月出光晕
  drawJourney(g, T, c, { layer: 'light' });
  if (sV) {
    drawGoldMotes(g, T, c, sV);
    if (T >= EV.containers[0] - 0.05) { g.save(); clipTo(g, sV); g.globalCompositeOperation = 'screen'; applyCam(g, c, 1); drawOpenSparks(g, T); g.restore(); }
  }
  if (sN) drawMoonHalo(g, T, c, sN);
  // 前景（虚化）
  ctx.layer(g, LAYER_O('fg', T, c), (lg) => drawJourney(lg, T, c, { layer: 'fg' }));
  if (sS) drawWindStreaks(g, T, c, sS);
  drawOakLeaves(g, T);
  // 换区遮挡物（HUD 之下）
  ctx.layer(g, LAYER_O('occluder', T, c), (lg) => drawOccluder(lg, T, c));
  // HUD：左上角色卡 + 右上小地图 + 飞进背包的道具
  const hs = hudState(T);
  ctx.layer(g, LAYER_O('hud', T, c), (lg) => {
    const a = drawHUD(lg, { ...hs, t: T });
    drawMiniMap(lg, T, hs.mini);
    if (T >= EV.containers[0] && T < EV.containers[4] + 0.8) drawItemFlights(lg, T, c, a.bag);
  });
  applyImpacts(ctx, T);
  void journeyCam;
}
