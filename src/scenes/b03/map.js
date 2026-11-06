// b03 私有：立誓段（25.35–34.10）—— 告示背面的牛皮纸蜡笔地图、勇者的蜡笔手、画面下沿偷看的国王。
// 地图坐标 = env/map.js 蜡笔版世界坐标（1920×1080，x = u·1920）；机位跟着蜡笔尖右移，32.50 起推到交接机位。
import { PAL, rgba, glow, sparkle } from '../../core/paper.js';
import { cam, applyCam, toScreen, lerpCam, drift } from '../../core/camera.js';
import { clamp, lerp, seg, hit, wobble, hash2, TAU } from '../../core/util.js';
import { ez, glide, outCubic, outBack, inOutSine, inOutCubic, inCubic } from '../../core/ease.js';
import { stream } from '../../core/particles.js';
import { drawCrayonMap, drawCrayon, mapRoute, mapToScreen, MAP_ROUTE_R, CRAYON, heartPoints } from '../../env/map.js';
import { drawKing } from '../../rigs/king.js';
import { paperGlyph } from '../../ui/type.js';
import { impact } from '../../fx/transitions.js';
import { L09, L10, L11, L12, HANDOFF, MT, smax } from './timing.js';

const D2R = Math.PI / 180;
export const MAP_CAM0 = cam(760, 540, 1.25, -4 * D2R); // 告示落定后的地图机位（storyboard）
export const MAP_END = cam(1545, 580, 1.5, 0); // 交接：心 (1638,620) h200 → 屏幕 (1100,600) 高 300

// ———————————————————— 路线与笔尖 ————————————————————
const R = MAP_ROUTE_R;
const mix = (u, k = 0.25) => inOutSine(u) * k + u * (1 - k); // 起落略缓、中段匀速（赶路）
/** 红蜡笔虚线画到哪（按弧长 r）。 */
export function routeR(T) {
  if (T < MT.draw0) return 0;
  if (T < MT.atPass) return lerp(0, R.pass, mix(seg(T, MT.draw0, MT.atPass)));
  if (T < MT.leavePass) return R.pass;
  if (T < MT.atForest) return lerp(R.pass, R.forest, mix(seg(T, MT.leavePass, MT.atForest)));
  if (T < MT.leaveForest) return R.forest;
  return lerp(R.forest, 1, mix(seg(T, MT.leaveForest, MT.atDragon)));
}
const routePt = (r) => mapToScreen('crayon', ...mapRoute(r));
const H = CRAYON.heart;
const HEART = heartPoints(H.x, H.y, H.h, 120);
const HEART_DRAW = [MT.heart[0], MT.heart[1] - 0.02]; // 32.30–33.08 描心
const FILL = [MT.heart[1] - 0.04, MT.fill[1]]; // 33.06–33.20 来回涂满
function heartAt(k) {
  const f = clamp(k) * (HEART.length - 1), i = Math.min(HEART.length - 2, Math.floor(f)), u = f - i;
  return [lerp(HEART[i][0], HEART[i + 1][0], u), lerp(HEART[i][1], HEART[i + 1][1], u)];
}
/** 笔尖（世界）+ 下压程度 + 是否画着。 */
export function tipAt(T) {
  if (T < MT.atDragon) {
    const drawing = (T >= MT.draw0 && T < MT.atPass) || (T >= MT.leavePass && T < MT.atForest) || (T >= MT.leaveForest);
    return { p: routePt(routeR(T)), press: drawing ? 0.55 + 0.2 * Math.sin(T * 31) : 0.12, drawing };
  }
  if (T < HEART_DRAW[0]) {
    // 抬笔：从龙山脚的路线终点弧线挪到心的顶点凹口
    const u = inOutSine(seg(T, MT.atDragon, HEART_DRAW[0]));
    const a = routePt(1), b = HEART[0];
    return { p: [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - 70 * Math.sin(Math.PI * u)], press: 0, drawing: false };
  }
  if (T < FILL[0]) return { p: heartAt(seg(T, HEART_DRAW[0], HEART_DRAW[1])), press: 0.6 + 0.2 * Math.sin(T * 37), drawing: true };
  if (T < FILL[1]) {
    // 排线涂满：沿 −0.75 rad 方向来回 5 趟，从左上扫到右下
    const u = seg(T, FILL[0], FILL[1]);
    const zig = Math.abs(((u * 5) % 2) - 1) * 2 - 1;
    const ca = Math.cos(-0.75 + Math.PI / 2), sa = Math.sin(-0.75 + Math.PI / 2);
    const along = lerp(-0.42, 0.42, u) * H.h;
    return { p: [H.x + Math.cos(-0.75) * zig * H.h * 0.42 + ca * along, H.y - 10 + Math.sin(-0.75) * zig * H.h * 0.42 + sa * along], press: 0.85, drawing: true };
  }
  // 涂完：抬笔离开（往左下出画）
  const u = inCubic(seg(T, MT.handOut[0], MT.handOut[1]));
  return { p: [H.x + 40 - 520 * u, H.y + 60 + 420 * u], press: 0, drawing: false };
}

// ———————————————————— 机位 ————————————————————
function followCam(T) {
  const Tf = Math.min(T, MT.atDragon + 0.25);
  let sx = 0, sy = 0;
  for (let k = 0; k < 10; k++) { const p = tipAt(Tf - k * 0.033).p; sx += p[0]; sy += p[1]; }
  sx /= 10; sy /= 10;
  const x = smax(760, sx - 92, 70);
  const y = 540 + 0.18 * (sy - 560);
  const rot = MAP_CAM0.rot * (1 - ez(T, L09, L09 + 0.65, glide));
  return cam(x, y, 1.25, rot);
}
export function mapBaseCam(T) {
  return lerpCam(followCam(T), MAP_END, ez(T, MT.push[0], MT.push[1], glide));
}
/** 地图机位（含 drift；交接前收掉 drift，保证 33.60 心正好在 (1100,600)）。 */
export function mapCam(T) {
  const c = mapBaseCam(T);
  const [dx, dy] = drift(T, { amp: 5, speed: 0.35, seed: 37 });
  const k = (1 - ez(T, MT.push[1] - 0.5, MT.push[1], inOutSine)) / Math.sqrt(c.zoom);
  return cam(c.x + dx * k, c.y + dy * k, c.zoom, c.rot);
}

// ———————————————————— 地图状态 ————————————————————
export function mapState(T) {
  return {
    icons: {
      sword: seg(T, L09, L09 + 0.3),
      mountain: seg(T, L10, L10 + 0.3),
      flag: seg(T, L10 + 0.18, L10 + 0.43),
      forest: seg(T, L11, L11 + 0.6),
      cage: seg(T, L12, L12 + 0.57),
      heart: seg(T, HEART_DRAW[0], HEART_DRAW[1]),
    },
    route: routeR(T),
    heartFill: seg(T, FILL[0], FILL[1]),
    heartBeatAt: MT.beat,
    owlBlink: L11 + 0.48,
  };
}

// ———————————————————— 图标立起时的“啵”线（世界坐标，画在纸上） ————————————————————
function popLines(g, T, at, x, y, r, seed, color = PAL.ink) {
  const a = T - at;
  if (a < 0 || a > 0.32) return;
  const k = a / 0.32;
  g.save();
  g.strokeStyle = rgba(color, 0.75 * (1 - k)); g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const ang = -Math.PI + (i / 6) * Math.PI + (hash2(seed, i) - 0.5) * 0.25;
    const r0 = r * (0.7 + 0.5 * k), r1 = r0 + 26 + 16 * hash2(seed + 3, i);
    g.lineWidth = 5 - 2 * k;
    g.beginPath(); g.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0 * 0.8); g.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1 * 0.8); g.stroke();
  }
  g.restore();
}

// ———————————————————— 国王（前景，屏幕空间） ————————————————————
const KS = 1.6;
function kingDraw(g, T, c) {
  const [tA, tB, tC, tD, tE] = MT.king;
  if (T < tA - 0.02) return;
  const sway = Math.sin(T * 0.9) * 16 + Math.sin(T * 2.3) * 4;
  const par = -0.04 * (c.x - MAP_CAM0.x); // 很轻的视差：机位右移时他略往左挪
  const x = 1500 + sway + par;
  if (T < tE - 0.06) {
    const rise = outBack(clamp((T - tA) / 0.28), 1.7);
    const bump = (t) => Math.sin(Math.PI * clamp((T - t) / 0.22)) * 22;
    const duck = Math.sin(Math.PI * clamp((T - (tE - 0.3)) / 0.26)) * 26; // 蹦之前先缩一下
    const cut = 1080 + (1 - rise) * 170 * KS / 1.6 * 1.6 - bump(tB) - bump(tC) * 0.7 - bump(tD) * 0.5 + duck;
    const expr = T < tB ? 'gasp' : T < tC ? { eyes: 'wide', brows: 'up', mouth: 'smile' } : T < tD ? 'starEyes' : 'waterfall';
    drawKing(g, { x, y: cut, s: KS, t: T, pose: 'peek', expr, peekHands: true, peekCut: 22, joints: { head: 4 * Math.sin(T * 1.7) }, look: [0.55 + 0.25 * Math.sin(T * 0.7), -0.6] });
    return;
  }
  // 33.60 整个人蹦进画面、高举双手（b04 心形遮罩随即盖上）
  const k = clamp((T - (tE - 0.06)) / 0.4);
  const feet0 = 1080 + 22 * KS + 178 * KS * 1.0; // 换姿态那一刻头的位置与偷看时一致
  const feet = lerp(feet0, 1150, outBack(k, 1.5));
  drawKing(g, { x: x + 10 * k, y: feet, s: KS, t: T, pose: 'leap', expr: 'joy', squash: 0.12 * Math.sin(Math.PI * clamp(k * 1.6)) });
}

// ———————————————————— 整帧 ————————————————————
/** 地图整帧。o.lean：交接期（与 b04 相加缓冲）只开 2 个图层。 */
export function mapFrame(g, T, ctx, o = {}) {
  const c = mapCam(T);
  const st = mapState(T);
  const tip = tipAt(T);
  // 底色（纸片之外不应露出；保险起见铺一层桌面暗色）
  g.fillStyle = PAL.woodDark; g.fillRect(-40, -40, 2000, 1160);
  const handIn = outBack(clamp((T - MT.hand[0]) / (MT.hand[1] - MT.hand[0])), 1.3);
  const handOn = T >= MT.hand[0] && T < MT.handOut[1];
  const drawHand = (lg) => {
    if (!handOn) return;
    const p = tip.p;
    const off = 1 - handIn;
    const ang = 2.3 + 0.08 * Math.sin(T * 1.3) - 0.12 * clamp((T - MT.heart[0]) / 0.4) * (1 - clamp((T - MT.handOut[0]) / 0.2));
    drawCrayon(lg, { tip: [p[0] - off * 520, p[1] + off * 430], ang, t: T, press: tip.press, s: 1 });
  };
  ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
    lg.save(); applyCam(lg, c, 1);
    drawCrayonMap(lg, T, st);
    // 图标立起的“啵”线
    popLines(lg, T, L09, CRAYON.sword.x, CRAYON.sword.y - 90, 70, 61);
    popLines(lg, T, L10, CRAYON.mountain.x, CRAYON.mountain.y - 140, 150, 62);
    popLines(lg, T, L11, 1418, 560, 110, 63, PAL.forest);
    popLines(lg, T, L12, CRAYON.dragonMt.x, CRAYON.dragonMt.y - 170, 150, 64, PAL.dragonDark);
    // 蜡笔屑：画线时从笔尖掉下来的红色小渣
    if (handOn) {
      stream(lg, T, { start: MT.draw0, end: FILL[1], rate: 14, seed: 371, life: [0.35, 0.6], gravity: 260, drag: 1.2, size: [2.5, 4.5],
        emit: (tb) => { const q = tipAt(tb); return q.drawing ? { x: q.p[0] + 6, y: q.p[1] + 4, vx: -40 + 80 * hash2(tb * 97, 1), vy: -60 } : { x: -9999, y: -9999 }; } },
        (gg, x, y, s) => { if (x < -9000) return; gg.fillStyle = rgba(PAL.scarfDark, 0.8 * (1 - s.p)); gg.beginPath(); gg.ellipse(x, y, s.size, s.size * 0.7, s.rot, 0, TAU); gg.fill(); });
    }
    // 心跳：心后一圈暖光
    const hb = T - MT.beat;
    if (hb > -0.02 && hb < 0.5) glow(lg, H.x, H.y, 210, PAL.heart, 0.45 * Math.sin(Math.PI * clamp((hb + 0.02) / 0.5)));
    if (o.lean) drawHand(lg);
    lg.restore();
  });
  // 左上主光：一层很淡的暖光，让纸面有方向
  glow(g, 260, 60, 1250, PAL.goldLight, 0.16);
  // 「叮！」：剑立起（L09）
  {
    const k = clamp((T - L09 - 0.12) / 0.1), out = clamp((T - L09 - 0.75) / 0.18);
    if (k > 0 && out < 1) {
      const [sx, sy] = toScreen(c, 1, CRAYON.sword.x + 70, CRAYON.sword.y - 190);
      const sc = outBack(clamp(k * 1.4), 2.4);
      g.save(); g.globalAlpha *= 1 - out; g.translate(sx, sy); g.rotate(-0.16); g.scale(sc, sc);
      paperGlyph(g, '叮', -30, 0, 64, { style: 'cut' });
      paperGlyph(g, '！', 30, 0, 64, { style: 'cut', inkCenter: true });
      g.restore();
      const [gx, gy] = toScreen(c, 1, CRAYON.sword.x + 10, CRAYON.sword.y - 150);
      sparkle(g, gx, gy, 34 * Math.sin(Math.PI * clamp((T - L09 - 0.1) / 0.4)), { rot: 0.4, color: PAL.white, alpha: 0.95 });
    }
  }
  // 心涂满跳一下：几颗小心形纸屑一样的闪点
  {
    const a = T - MT.beat;
    if (a > 0 && a < 0.55) {
      const [hx, hy] = toScreen(c, 1, H.x, H.y);
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i - 2.5) * 0.42;
        const r = 150 + 140 * outCubic(a / 0.55);
        sparkle(g, hx + Math.cos(ang) * r * 1.2, hy + Math.sin(ang) * r - 20, 16 * (1 - a / 0.55), { rot: i, color: i % 2 ? PAL.goldLight : PAL.white, alpha: 1 });
      }
    }
  }
  if (!o.lean) ctx.layer(g, { shadow: 16, texture: 0.25 }, (lg) => { lg.save(); applyCam(lg, c, 1); drawHand(lg); lg.restore(); });
  ctx.layer(g, { blur: 2, shadow: 12, texture: 0.22 }, (lg) => kingDraw(lg, T, c));
  ctx.fx.paper = Math.max(ctx.fx.paper, 0.3);
  ctx.fx.vignette = 0.2;
  impact(ctx, T, L09, 'S', { shake: 6, flash: 0, decay: 0.16 });
  return c;
}
