// b02 · 和平、巨龙、掳走、国王（[9.50, 20.10)，cue L01–L05，地点 CASTLE；见 docs/storyboard.md「### b02」与 docs/blocks/b02.md）。
// 一句话：黎明阳台上公主浇花；龙影扫过天变紫，纸天被撕开龙头撞出；火雨点燃城下；金鸟笼扣走公主、龙缩成红点；硬切到阳台上抱头的国王。
// 交接：入场 ← b01（9.50–10.00，由本块在 bookPageRect 遮罩里画同一个王城世界，机位 bookCastleCam，逐像素一致）；
//       块内 18.00 全片唯一硬切（红点 = 「！」圆点，story.cuts）；出场 → b03（19.95–20.10，b03 画竖向甩镜帘，本块照常画到 20.10）。
import { PAL, glow } from '../core/paper.js';
import { applyCam } from '../core/camera.js';
import { clamp, lerp, seg, hit, mixHex, rgba } from '../core/util.js';
import { ez, smooth, inOutSine } from '../core/ease.js';
import { impact, speedLines } from '../fx/transitions.js';
import { castleToScreen, tearPath, drawCastle, CASTLE } from '../env/castle.js';
import { bookPageRect } from '../env/book.js';
import { bubble } from '../ui/kit.js';
import { TM, camAt, drawWorld } from './b02/shared.js';
import { balconyScene, slamDust, cageState, drawCageWithPrincess, drawClaw, tiaraState, drawRestingTiara, princessAt, CAGE_S } from './b02/balcony.js';
import { drawDragonShadow, shadowTailX, shadowActive, tearHeadState, drawTearHead, diveState, drawDive, flightState, drawFlight, drawDot } from './b02/dragon.js';
import { drawFireRain, drawEmberRain, rainPulse, drawTownFolk, drawForegroundBirds, FIRES, NEAR } from './b02/fx.js';
import { kingAt, kingCam, drawKingOnBalcony, drawRailTiara, drawAlert, whipSpeed } from './b02/king.js';
import { drawCage } from '../props/cave.js';
import { drawPrincess } from '../rigs/princess.js';

const TEAR = { at: TM.tear, x: 1320, y: 300 };
const DOOM = TM.doomK1;

// ———————————————————— 时段 / 天空 ————————————————————
function timeAt(T) {
  if (T < TM.L02) return 'dawn';
  if (T < DOOM) return { from: 'dawn', to: 'doom', k: smooth(seg(T, TM.L02 + 0.08, DOOM)) };
  if (T < TM.gray0) return 'doom';
  if (T < TM.L05) return { from: 'doom', to: 'gray', k: seg(T, TM.gray0, TM.L05), wipe: 'down' };
  return 'gray';
}
/** 危急段整帧：sat 1.1、skyDoom 叠色（multiply ≤ 0.18）；17.2 起回落，18.00 前归 1（红点要和「！」同色）。 */
function doomFx(ctx, T) {
  const k = smooth(seg(T, TM.L02 + 0.1, DOOM)) * (1 - smooth(seg(T, TM.pull1, TM.red0 + 0.1)));
  if (k <= 0) return;
  ctx.fx.sat = Math.max(ctx.fx.sat || 1, 1 + 0.1 * k);
  if (0.12 * k > (ctx.fx.tintAlpha || 0)) { ctx.fx.tint = PAL.skyDoom; ctx.fx.tintAlpha = 0.12 * k; ctx.fx.tintMode = 'multiply'; }
}

/** sky 层（depth 0.05）世界坐标 → 屏幕逻辑坐标的矩阵（与 applyCam 同一换算），把撕口路径搬到屏幕上做裁剪。 */
function skyMatrix(c) {
  const d = CASTLE.depth.sky, z = 1 + (c.zoom - 1) * d;
  let m = new DOMMatrix().translate(960, 540);
  if (c.rot) m = m.rotate((c.rot * 180) / Math.PI);
  return m.scale(z).translate(-(960 + (c.x - 960) * d), -(540 + (c.y - 540) * d));
}

// ==================== 9.50–18.00 的王城（三组图层 + 阳台的人） ====================
function castleOpts(T, extraMain) {
  const o = { time: timeAt(T) };
  if (T >= TM.fire1 - 0.001) o.fires = FIRES;
  if (T >= TM.L02 && T < DOOM + 0.05 && shadowActive(T)) o.split = Math.min(2400, shadowTailX(T));
  if (T >= TM.tear) o.tear = TEAR;
  if (T < TM.lift + 0.12) o.onBalcony = (g, a) => { const r = balconyScene(g, T, a); if (extraMain) extraMain.ring = r.ring; };
  return o;
}

/** 栏杆前（main 层画完后、同一缓冲里）：扬灰、离开阳台的鸟笼、龙爪、小皇冠。 */
function afterMain(lg, T, c, ref) {
  lg.save(); applyCam(lg, c, 1);
  slamDust(lg, T);
  const cs = cageState(T);
  let ring = ref.ring;
  if (cs && !cs.balcony && T < TM.lift + 0.45) ring = drawCageWithPrincess(lg, T, cs, princessAt(T));
  drawClaw(lg, T, ring);
  if (T < TM.L05) drawRestingTiara(lg, T, tiaraState(T));
  lg.restore();
}

// ———————————————————— 镜头 ————————————————————
const shots = [
  {
    // 9.50–12.11：交接遮罩 → 推镜落定 CA-MW（L01 浇花）→ 青鸟、挥手、前景纸鸟
    id: 'b02_peace', start: TM.start, end: TM.L02,
    draw(g, T, lt, ctx) {
      const c = camAt(T);
      const o = castleOpts(T);
      if (T < TM.b01End) {
        // 交接 9.50–10.00：天幕卡矩形遮罩（不羽化、不加 drift、不改 ctx.fx），里面画与 b01 同一个王城世界
        const r = bookPageRect(T);
        ctx.mask(g, (mg) => mg.fillRect(r.x, r.y, r.w, r.h), (lg) => drawWorld(lg, T, ctx, c, o));
        return;
      }
      g.fillStyle = PAL.skyDayLow; g.fillRect(0, 0, 1920, 1080);
      drawWorld(g, T, ctx, c, o);
      if (T > TM.wave - 0.15) ctx.layer(g, { blur: 2.5, shadow: 6 }, (lg) => drawForegroundBirds(lg, T));
    },
  },
  {
    // 12.11–15.20：龙影扫过、天变紫（L02）→ 拉到 CA-W，纸天撕裂、龙头撞出「嗷——」→ 俯冲掠过镜头 → CA-TOWN 火雨（L03）
    id: 'b02_attack', start: TM.L02, end: TM.snap0,
    draw(g, T, lt, ctx) {
      const c = camAt(T);
      const o = castleOpts(T);
      g.fillStyle = PAL.skyDoom; g.fillRect(0, 0, 1920, 1080);
      const town = T > TM.camT0;
      drawWorld(g, T, ctx, c, o, town ? {
        near: (lg) => { lg.save(); applyCam(lg, c, NEAR); drawTownFolk(lg, T); lg.restore(); },
      } : {});
      // 龙影（半透明、模糊的剪影，盖过整个画面）
      if (shadowActive(T)) ctx.layer(g, { alpha: 0.55, blur: 8 }, (lg) => drawDragonShadow(lg, T));
      // 裂口里的龙头 + 吼叫气泡
      const tc = castleToScreen(c, 'sky', TEAR.x, TEAR.y);
      const hs = tearHeadState(T, tc);
      if (hs) {
        ctx.layer(g, { shadow: 12, texture: 0.3, blur: hs.blur }, (lg) => {
          const hp = tearPath(TEAR, T);
          let hole = null;
          if (hp) { hole = new Path2D(); hole.addPath(hp, skyMatrix(c)); }
          drawTearHead(lg, T, hs, hole);
        });
      }
      // 俯冲掠过（前景，虚化 + 速度线）
      const ds = diveState(T);
      if (ds) {
        ctx.layer(g, { blur: 5, shadow: 16 }, (lg) => drawDive(lg, T, ds));
        speedLines(g, 'h', null, { t: T, sign: -1, alpha: 0.5 * Math.sin(Math.PI * ds.u), density: 1.4, colors: [PAL.paper, PAL.fire2], seed: 12 });
      }
      // 火雨（屏幕坐标）
      if (town) {
        ctx.layer(g, {}, (lg) => { drawEmberRain(lg, T); drawFireRain(lg, T, c); });
        const p = rainPulse(T);
        if (p > 0) glow(g, 1500, 120, 1200, PAL.fire, 0.28 * p);
      }
      // 吼：「嗷——」锯齿气泡（龙头左边）
      if (T >= TM.roar - 0.02 && T < TM.dive0 + 0.02 && hs) {
        const pop = ez(T, TM.roar - 0.02, TM.roar + 0.1, (u) => u) * (1 - seg(T, TM.dive0 - 0.04, TM.dive0 + 0.02));
        bubble(g, { x: tc[0] - 430, y: tc[1] - 70, w: 400, h: 200, shape: 'jagged', text: '嗷——', tail: [hs.x - 130 * hs.s, hs.y + 40 * hs.s], pop, t: T, seed: 9 });
      }
      doomFx(ctx, T);
      impact(ctx, T, TM.roar, 'L', { shake: 22, decay: 0.5, flash: 0.4, flashColor: PAL.fire2 });
      impact(ctx, T, TM.fire1, 'M', { shake: 12, flash: 0.3, flashColor: PAL.fire2 });
      for (const at of [TM.fire1 + 0.12, TM.fire1 + 0.24, TM.fire1 + 0.48, TM.fire1 + 0.6, TM.hat]) impact(ctx, T, at, 'S', { shake: 5, flash: 0.08, flashColor: PAL.fire2, seed: Math.round(at * 10) });
    },
  },
  {
    // 15.20–18.00：snap 推到 CA-BAL → 15.45 鸟笼扣下（L04）→ 小皇冠磕飞 → 翻白眼 → 龙爪提走 → 拉远右摇，龙缩成红点
    id: 'b02_abduct', start: TM.snap0, end: TM.L05,
    draw(g, T, lt, ctx) {
      const c = camAt(T);
      const ref = {};
      const o = castleOpts(T, ref);
      g.fillStyle = PAL.skyDoom; g.fillRect(0, 0, 1920, 1080);
      const sat = lerp(1, 0.75, smooth(seg(T, TM.gray0 + 0.2, TM.L05 - 0.1)));
      drawWorld(g, T, ctx, c, o, { main: (lg) => afterMain(lg, T, c, ref) }, sat < 1 ? { sat } : null);
      // 提走后的龙 + 鸟笼（屏幕坐标，盖在王城前）→ 小黑点 → 「叮！」→ 红点（单独一层，不降饱和）
      const fs = flightState(T);
      ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
        if (fs) drawFlight(lg, T, fs, (gg, x, y, s, swing, det) => {
          gg.save(); gg.translate(x, y); gg.rotate(swing); gg.scale(s / CAGE_S, s / CAGE_S); gg.translate(-x, -y);
          const cy = y + 135 * CAGE_S;
          drawCage(gg, { x, y: cy, s: CAGE_S, part: 'back' });
          drawPrincess(gg, { x, y: cy + 98 * CAGE_S, s: 0.26, face: -1, t: T, pose: 'caged', expr: 'eyeroll', tiara: false, detail: det });
          drawCage(gg, { x, y: cy, s: CAGE_S, part: 'front' });
          gg.restore();
        });
        drawDot(lg, T);
      });
      // snap 推镜的竖向速度线
      const sp = Math.sin(Math.PI * seg(T, TM.snap0, TM.L04));
      if (sp > 0.05) speedLines(g, 'v', null, { t: T, sign: 1, alpha: 0.55 * sp, density: 1.2, colors: [PAL.paper, PAL.goldLight], seed: 31 });
      doomFx(ctx, T);
      impact(ctx, T, TM.slam, 'S', { shake: 9, flash: 0.22, seed: 4 });
      impact(ctx, T, TM.hook, 'S', { shake: 4, flash: 0, seed: 6 });
    },
  },
  {
    // 18.00–20.10：硬切（红点 = 「！」圆点）。灰蓝王国，只有警报红饱和（灯笼、烽火、「！」单独一层）
    id: 'b02_king', start: TM.L05, end: TM.end,
    draw(g, T, lt, ctx) {
      const c = kingCam(T);
      const o = {
        time: 'gray', lantern: 1, redSeparate: true,
        beacons: [{ tower: 4, at: TM.beacon4 }, { tower: 5, at: TM.beacon5 }],
        onBalcony: (lg) => drawKingOnBalcony(lg, T),
      };
      g.fillStyle = PAL.stone2; g.fillRect(0, 0, 1920, 1080);
      const smear = whipSpeed(T);
      const post = smear > 0.5 ? (lg) => {
        lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0);
        const d = smear * (lg.canvas.width / 1920);
        for (let k = 1; k <= 3; k++) { lg.globalAlpha = 0.28; lg.drawImage(lg.canvas, 0, d * k * 0.45); }
        lg.restore();
      } : null;
      drawWorld(g, T, ctx, c, o, {
        main: (lg) => { lg.save(); applyCam(lg, c, 1); drawRailTiara(lg, T); lg.restore(); if (post) post(lg); },
        fg: (lg) => { if (post) post(lg); },
        far: (lg) => { if (post) post(lg); },
      }, { sat: 0.75 });
      // 警报红：灯笼光 + 烽火 + 「！」（不降饱和）
      ctx.layer(g, { shadow: 6 }, (lg) => {
        drawCastle(lg, T, c, { ...o, layer: 'alarm' });
        drawAlert(lg, T, c);
        if (post) post(lg);
      });
      impact(ctx, T, TM.L05 + 0.06, 'S', { shake: 7, flash: 0, seed: 8 });
      impact(ctx, T, TM.kHead + 0.04, 'S', { shake: 6, flash: 0, seed: 12 });
    },
  },
];

export default shots;
