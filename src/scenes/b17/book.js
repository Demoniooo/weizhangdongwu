// b17 · 立体书（199.30–208.10）：拉回成书 → 纸手按住书页 → 立体件折倒 → 合书「啪！」→ 片尾卡（署名贴签、睡着的小蜥蜴、副标题、关灯）。
import { cue } from '../../cues.js';
import { PAL, glow, sparkle } from '../../core/paper.js';
import { cam, applyCam, lerpCam, drift } from '../../core/camera.js';
import { clamp, lerp, seg, smoothstep, hit, fract } from '../../core/util.js';
import { ez, glide, inExpo, inQuad, inBack, outBack, outCubic, outQuad, inOutSine } from '../../core/ease.js';
import { burst } from '../../core/particles.js';
import { LAYER_GROUPS } from '../../env/castle.js';
import { drawDesk, drawBook, bookPushCam, bookToCastleCam, BOOK, CAMS as BK } from '../../env/book.js';
import { drawHand, ashDraw, sparkDraw } from '../../props/misc.js';
import { drawCreditLabel } from '../../props/paper.js';
import { drawLizard } from '../../rigs/dragon.js';
import { paperGlyph } from '../../ui/type.js';
import { impact, impactRays } from '../../fx/transitions.js';
import { drawScrollInBook, CASTLE_O, T_BOOK } from './outside.js';

const O8 = cue('O08'), OUT = cue('OUT'), END = cue('END');
export const T_SLAP = O8;                        // 199.66 纸手按住书页
const T_FOLD0 = O8 + 0.09, T_FOLD1 = O8 + 0.29;  // 199.75–199.95 立体件反序折倒
const T_CLOSE0 = O8 + 0.29, T_CLOSE1 = O8 + 0.64; // 199.95–200.30 翻回封面
export const T_SLAM = T_CLOSE1;                  // 200.30「啪！」
const T_ROLL0 = O8 + 0.74, T_ROLL1 = O8 + 1.54;  // 200.40–201.20 卷轴尾巴卷回
const T_CAM0 = O8 + 0.94;                        // 200.60–201.60 BK-SPREAD → BK-COVER
// 片尾卡
const T_FOIL0 = OUT + 0.6, T_FOIL1 = OUT + 1.3;  // 202.20–202.90 金箔扫光
const T_LABEL = OUT + 1.2;                       // 202.80–203.20 贴签滑上
const T_LINES = [OUT + 1.7, OUT + 2.0, OUT + 2.3, OUT + 2.6];   // 203.30 / 203.60 / 203.90 / 204.20 署名逐行
const T_LIZ0 = OUT + 3.2, T_LIZ1 = OUT + 4.2;    // 204.80–205.80 小蜥蜴钻出、爬上封面
const T_SUB = [OUT + 4.4, OUT + 4.6, OUT + 4.8]; // 206.00 斑 / 206.20 得 / 206.40 贝
export const T_LAMP = OUT + 4.8;                 // 206.40 台灯“咔”地关掉
const T_EYE = OUT + 5.0;                         // 206.60 睁开一只发光的眼
const T_FADE0 = OUT + 5.2;                       // 206.80–208.10 淡出

// ———————————————————— 机位 ————————————————————
export function bookCam(T) {
  let c;
  if (T < O8) c = bookPushCam(T);
  else if (T < T_CAM0) c = BK.BK_SPREAD;
  else c = lerpCam(BK.BK_SPREAD, BK.BK_COVER, ez(T, T_CAM0, OUT, glide));
  // 片尾卡：机位活着（轻漂移，从 200.6 起慢慢淡入）
  const dk = smoothstep(T_CAM0, OUT + 0.6, T);
  if (dk > 0) { const [dx, dy] = drift(T, { amp: 4, speed: 0.3, seed: 17 }); c = cam(c.x + (dx * dk) / c.zoom, c.y + (dy * dk) / c.zoom, c.zoom, c.rot || 0); }
  return c;
}
const openAt = (T) => (T < T_CLOSE0 ? 1 : 1 - inExpo(seg(T, T_CLOSE0, T_CLOSE1)));
const foldAt = (T) => seg(T, T_FOLD0, T_FOLD1);
const lampAt = (T) => {
  if (T < T_LAMP - 0.05) return 1;
  if (T < T_LAMP) return T < T_LAMP - 0.025 ? 0.35 : 1;   // 关灯前闪一下
  return 0;
};

// ———————————————————— 纸手 ————————————————————
const SLAP_AT = [470, 470];                      // 按在左页（封面内侧）偏中，盖住立体王城的左半
function handState(T) {
  const c = BK.BK_SPREAD;
  void c;
  if (T < O8 - 0.13) return null;
  const s0 = 0.95;
  if (T < T_CLOSE0 - 0.07) {
    // 199.53–199.66 从画面上方压下来；199.66 按住；199.78–199.88 滑向左边封面边缘
    const dn = ez(T, O8 - 0.13, O8, inQuad);
    const slide = ez(T, O8 + 0.12, T_CLOSE0 - 0.07, inOutSine);
    const x = lerp(SLAP_AT[0], 205, slide), y = lerp(-420, SLAP_AT[1], dn) + 60 * slide;
    return { x, y, s: s0, rot: lerp(0, 0.85, slide), pose: slide > 0.55 ? 'grab' : 'slap', press: Math.max(hit(T, O8, 0.14), 0.25 * (1 - slide) * (T > O8 ? 1 : 0)) };
  }
  // 199.88–200.21 勾住封面边往上掀（跟着封面外缘走），200.21 松手（封面自己“啪”地甩过去）、手抽回画外
  const T_REL = T_CLOSE1 - 0.09;
  const th = openAt(Math.min(T, T_REL)) * Math.PI;
  const ex = 960 + 880 * Math.cos(th);
  const rel = smoothstep(T_REL, T_CLOSE1 + 0.25, T);
  const rot = 0.85;
  const hx = ex + 118 * Math.sin(rot) * s0, hy = 540 - 100 * Math.cos(rot) * s0;
  const s = s0 * (1 + 0.1 * Math.sin(th));
  if (rel <= 0) return { x: hx, y: hy, s, rot, pose: 'grab', press: 0 };
  const x = lerp(hx, hx + 90, rel), y = lerp(hy, -620, outQuad(rel));
  return { x, y, s, rot: lerp(rot, 0.3, rel), pose: rel > 0.2 ? 'slap' : 'grab', press: 0, alpha: 1 };
}

// ———————————————————— 片尾卡：署名贴签 + 小蜥蜴（画在封面上，跟着书一起发抖） ————————————————————
const LIZ_REST = [1714, 552];                    // 书名「吧」右侧
const LIZ_S = 2.5;
function lizardState(T) {
  if (T < T_LIZ0) return null;
  // 204.80 从书底边与书页的缝里钻出来（x≈1716），205.55 爬到书名旁，205.55–205.80 转身蜷成一团
  const u = seg(T, T_LIZ0, T_LIZ1 - 0.25);
  const y0 = BOOK.cover.y1 + 30, y1 = LIZ_REST[1] + 4;
  const climb = outCubic(u);
  const x = lerp(1720, LIZ_REST[0], climb) + Math.sin(u * 9) * 3 * (1 - u);
  const y = lerp(y0, y1, climb);
  const curl = seg(T, T_LIZ1 - 0.25, T_LIZ1);
  const sleepy = T >= T_LIZ1;
  const yawn = sleepy && T < T_LIZ1 + 0.38 ? Math.sin(Math.PI * seg(T, T_LIZ1 + 0.02, T_LIZ1 + 0.38)) : 0;
  const eye = T >= T_EYE && T < T_EYE + 0.36;
  return { x, y, climb, u, curl, sleepy, yawn, eye, emerging: u < 0.18 };
}
function drawCoverExtras(g, T, q) {
  // 署名贴签（drawCreditLabel，CREDIT_LINES 四行）：202.80–203.20 从下方滑上来贴在封面下部
  const lp = seg(T, T_LABEL, T_LABEL + 0.4);
  if (lp > 0) drawCreditLabel(g, { x: 1400, y: 770, s: 0.92, p: lp, lines: T_LINES.map((t0) => seg(T, t0, t0 + 0.32)) });
  // 小蜥蜴
  const L = lizardState(T);
  if (!L) return;
  g.save();
  if (L.emerging) { g.beginPath(); g.rect(BOOK.cover.x0, BOOK.cover.y0 - 400, BOOK.cover.x1 - BOOK.cover.x0 + 40, BOOK.cover.y1 + 6 - (BOOK.cover.y0 - 400)); g.clip(); }
  if (!L.sleepy) {
    // 爬：climb 姿态是斜 −62° 的窜，这里再转 −24° 让身体顺着几乎竖直的路线往上爬；最后 0.25s 转回水平蜷起来
    g.translate(L.x, L.y);
    g.rotate((-24 * (1 - L.curl) * Math.PI) / 180);
    // 爬的时候迷你名字牌会跟着身子转成竖条，先不画；蜷好后再顶上
    drawLizard(g, { x: 0, y: 0, s: LIZ_S, face: 1, t: T, pose: L.curl > 0 ? { from: 'climb', to: 'sleep', k: L.curl } : 'climb', miniPlate: L.curl > 0.6 });
  } else {
    const pose = L.eye ? 'eyeOpen' : 'sleep';
    drawLizard(g, { x: LIZ_REST[0], y: LIZ_REST[1], s: LIZ_S, face: 1, t: T, pose, mouth: L.yawn > 0.15 ? 'open' : 'smile', squash: 0.06 * L.yawn, joints: { head: -18 * L.yawn }, miniPlate: true });
    // zzz（latin）：睡着后从头顶冒出来
    const zk = smoothstep(T_LIZ1 + 0.3, T_LIZ1 + 0.6, T) * (L.eye ? 0.3 : 1);
    if (zk > 0) {
      for (let k = 0; k < 3; k++) {
        const ph = fract((T - T_LIZ1) * 0.55 + k / 3);
        const a = Math.sin(ph * Math.PI) * zk;
        if (a <= 0.02) continue;
        paperGlyph(g, 'z', LIZ_REST[0] + 22 + ph * 30, LIZ_REST[1] - 52 - ph * 64, 18 + ph * 14, { family: 'latin', weight: 700, fill: PAL.goldLight, edge: PAL.ink, edgeW: 0.12, alpha: a, rot: -0.25 + ph * 0.2 });
      }
    }
  }
  g.restore();
}

// ———————————————————— 一帧 ————————————————————
/** 立体书各阶段（199.30–208.10）。 */
export function drawBookFrame(g, T, ctx) {
  const c = bookCam(T);
  const open = openAt(T);
  const fold = foldAt(T);
  const lamp = lampAt(T);
  const castle = CASTLE_O;
  const sub = T_SUB.reduce((n, t0) => n + clamp((T - t0) / 0.14), 0);
  const trem = smoothstep(T_SUB[1] - 0.02, T_SUB[1] + 0.06, T) * (1 - smoothstep(T_LAMP + 0.06, T_LAMP + 0.16, T));
  const cover = {
    foilSweep: seg(T, T_FOIL0, T_FOIL1), star: seg(T, T_FOIL1 - 0.05, T_FOIL1 + 0.5),
    subtitle: sub / 9, subtitleAlpha: 1, tremble: 0.8 * trem, gleam: lamp > 0.5 ? 0 : 1,
  };
  // 震动：199.66 按住 shake 10；200.30 合书 shake 16 + flash 0.2 + 冲击线
  impact(ctx, T, T_SLAP, 'S', { shake: 10, flash: 0, rays: false });
  impact(ctx, T, T_SLAM, 'M', { shake: 16, flash: 0.2, rays: false });
  const showDesk = true;
  if (showDesk) drawDesk(g, T, c, { lamp });
  const book = { layer: 'book', open, cover, lamp, castle, lizard: T >= T_LABEL ? {} : undefined, lizardFn: (lg) => drawCoverExtras(lg, T) };
  ctx.layer(g, { shadow: 14, texture: 0.3 }, (lg) => drawBook(lg, T, c, book));
  // 立体件（只在书完全翻开时画）+ 卷轴（near 之后、fg 之前）
  if (open >= 0.999) {
    const castleCam = bookToCastleCam(c);
    const [g1, g2, g3] = LAYER_GROUPS;
    ctx.layer(g, g1[1], (lg) => drawBook(lg, T, c, { layer: 'popup', open, fold, castle, pop: g1[0] }));
    ctx.layer(g, g2[1], (lg) => drawBook(lg, T, c, { layer: 'popup', open, fold, castle, pop: g2[0] }));
    ctx.layer(g, g3[1], (lg) => {
      drawBook(lg, T, c, { layer: 'popup', open, fold, castle, pop: ['near'] });
      drawScrollInBook(lg, T, c, castleCam, fold);
      drawBook(lg, T, c, { layer: 'popup', open, fold, castle, pop: ['fg'] });
    });
  }
  // 书签（与 b01 同一个 drawBook 书签）+ 200.30 起书口垂出的卷轴尾巴 + 台灯光里的浮尘（199.36–199.66 随书页入画淡入）
  ctx.layer(g, { shadow: 6, blur: 2 }, (lg) => {
    drawBook(lg, T, c, { layer: 'bookmark', open, bookmark: { wobbleAt: T_SLAM, extra: T >= T_SLAM ? 'scroll' : undefined, roll: seg(T, T_ROLL0, T_ROLL1) } });
    drawDesk(lg, T, c, { layer: 'dust', lamp: lamp * seg(T, T_BOOK + 0.06, O8) });
  });
  // 纸手
  const H = handState(T);
  if (H && (H.alpha ?? 1) > 0 && H.y > -700) {
    ctx.layer(g, { shadow: 16, texture: 0.25 }, (lg) => { applyCam(lg, c, 1); drawHand(lg, { ...H, t: T, sleeve: 900 }); });
  }
  // 200.30「啪！」：书四边喷纸灰 + 金色浮尘、冲击线、拟声字
  if (T >= T_SLAM - 0.01 && T < T_SLAM + 1.2) {
    ctx.layer(g, { shadow: 8 }, (lg) => {
      applyCam(lg, c, 1);
      const C = BOOK.cover;
      const edges = [[C.x0 + 40, (C.y0 + C.y1) / 2, 140, 3.14], [C.x1 + 8, (C.y0 + C.y1) / 2, 140, 0], [(C.x0 + C.x1) / 2, C.y0, 300, -1.57], [(C.x0 + C.x1) / 2, C.y1 + 8, 300, 1.57]];
      edges.forEach(([x, y, spread, ang], i) => {
        burst(lg, T, { at: T_SLAM, seed: 1730 + i, count: 10, x, y, spread, speed: [120, 360], angle: [ang - 0.7, ang + 0.7], gravity: 90, drag: 2.2, life: [0.6, 1.1], size: [7, 12] }, ashDraw);
        burst(lg, T, { at: T_SLAM, seed: 1740 + i, count: 8, x, y, spread, speed: [60, 220], angle: [ang - 0.9, ang + 0.9], gravity: -40, drag: 1.6, life: [0.8, 1.4], size: [8, 13] }, sparkDraw);
      });
      // 冲击线从书的外框往外射（r0 在书外），拟声字「啪！」压在书的上方
      impactRays(lg, T, T_SLAM, 'M', { x: 1400, y: 545, n: 18, reach: 900, r0: 470, seed: 31 });
      const k = seg(T, T_SLAM, T_SLAM + 0.16), out = seg(T, T_SLAM + 0.48, T_SLAM + 0.66);
      if (k > 0 && out < 1) {
        const sc = outBack(k, 2.6) * (1 - inBack(out, 2.2));
        ['啪', '！'].forEach((ch, i) => paperGlyph(lg, ch, 1360 + i * 84 * sc, 128 + i * 6, 120 * sc, { style: 'cut', rot: -0.1 + i * 0.08, inkCenter: true }));
      }
    });
  }
  // 台灯关掉：整帧压暗成夜蓝；黑暗里烫金字微微反光；淡出到黑
  const fx = ctx.fx;
  fx.vignette = Math.max(fx.vignette ?? 0, lerp(0.34, 0.42, smoothstep(T_CAM0, OUT, T)));
  if (lamp < 0.5) {
    fx.bright = Math.min(fx.bright ?? 1, 0.55);
    fx.tint = PAL.skyNight; fx.tintAlpha = 0.18; fx.tintMode = 'multiply';
  }
  const fd = clamp((T - T_FADE0) / (END - 0.05 - T_FADE0));
  if (fd > 0) fx.fade = Math.max(fx.fade ?? 0, inOutSine(fd));
  return { c };
}
void glow; void sparkle; void outCubic;
