// b06 私有：片名页（60.20–63.40 主场；63.40 后缩到上方给角色卡让位）。
// 纸卷碾过镜头揭开深红片名页 →「达拉崩吧」三层剪纸字逐个立起 → 光芒 + 金箔扫光 → 围巾下划线写出剩下的名字 → 勇者 / 巨龙剪影对峙。
import { NAMES } from '../../cues.js';
import { PAL, rays, sparkle, glow } from '../../core/paper.js';
import { clamp, lerp, seg, TAU, hash2, rgba, wobble } from '../../core/util.js';
import { ez, glide, outBack, outExpo, outCubic, inOutCubic } from '../../core/ease.js';
import { burst, field } from '../../core/particles.js';
import { titleGlyphs } from '../../ui/type.js';
import { drawScarf } from '../../props/scarf.js';
import { samplePath, pathSlice, drawPaperRoll, rollOverCameraY } from '../../props/paper.js';
import { sparkDraw } from '../../props/misc.js';
import { drawHero } from '../../rigs/hero.js';
import { drawDragon } from '../../rigs/dragon.js';
import { drawDove } from '../../rigs/monsters.js';
import { impact } from '../../fx/transitions.js';
import { TT, drawTitlePage } from './common.js';

// 围巾下划线：从画左飞入 → 标题下 y≈640 横贯 → 冲出右边 → 绕回来在标题下打一个圈 → 尾巴飘
const SCARF_CTRL = [
  [-120, 668], [120, 652], [420, 642], [760, 640], [1100, 642], [1440, 638], [1720, 630], [1960, 640], [2060, 700],
  [1990, 790], [1800, 812], [1640, 800], [1560, 752], [1600, 706], [1690, 716], [1712, 776], [1650, 846], [1500, 880], [1340, 870],
];
const SCARF_PATH = samplePath(SCARF_CTRL, 14);
const REST = NAMES.hero.slice(4); // 斑得贝迪卜多比鲁翁
const SCARF_W = 96;

function scarfPts(T) {
  const k = ez(T, TT.scarf0, TT.scarf1, outExpo);
  if (k <= 0) return null;
  const sp = SCARF_PATH;
  const L = sp.total * k;
  const pts = pathSlice(sp, 0, Math.max(30, L));
  // 飘动：越靠尾巴越飘；文字段（前 1100px）只轻微起伏，保证可读
  const settle = seg(T, TT.scarf1 - 0.1, TT.scarf1 + 0.5);
  let acc = 0;
  return pts.map((p, i) => {
    if (i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const u = acc / sp.total;
    const amp = (u < 0.42 ? 3 : 3 + (u - 0.42) * 46) * (0.5 + 0.5 * settle);
    const w = Math.sin(acc / 160 - T * 4.2) * amp + Math.sin(acc / 71 - T * 6.1) * amp * 0.25;
    // 飞入时的甩动：前端（新出现的部分）向上甩起
    const lead = clamp((acc - (L - 260)) / 260);
    return [p[0], p[1] + w - lead * 40 * (1 - k)];
  });
}

/** 片名组（三层剪纸字 + 围巾下划线）。g 为屏幕坐标；shrink 0..1 → 缩到 0.55 倍、移到上方。 */
function drawTitleGroup(ctx, g, T, shrink) {
  const k = ez(shrink, 0, 1, glide);
  const s = lerp(1, 0.55, k);
  const cy = lerp(470, 220, k);
  const tf = (lg) => { lg.translate(960, cy); lg.scale(s, s); lg.translate(-960, -470); };
  // 围巾（在字后面）
  const pts = scarfPts(T);
  if (pts && pts.length > 2) {
    ctx.layer(g, { shadow: 9, texture: 0.3 }, (lg) => {
      lg.save(); tf(lg);
      const grow = clamp(((T - TT.text0) / 0.1 + 0.6) / REST.length);
      drawScarf(lg, pts, { width: SCARF_W, endWidth: 62, t: T, seed: 9, fringeLen: 26, lift: 3,
        text: REST, textSize: 72, textFill: PAL.gold, textEdge: PAL.redDeep, textStart: 742, textGrow: T >= TT.text0 - 0.05 ? grow : 0, textGap: 6 });
      lg.restore();
    });
  }
  // 三层剪纸字
  ctx.layer(g, { shadow: 14, texture: 0.3 }, (lg) => {
    lg.save(); tf(lg);
    const rise = TT.rise.map((t0) => (T - t0) / 0.4);
    const foil = T >= TT.rays ? seg(T, TT.rays, TT.foil1) : null;
    const out = titleGlyphs(lg, { x: 960, y: 560, size: 300, rise, foil, starAt: TT.foil1, t: T });
    // 每字落定喷一撮金色火花
    out.forEach((m, i) => burst(lg, T, { at: TT.rise[i] + 0.2, seed: 81 + i, count: 18, x: m.x, y: 560, spread: m.w * 0.4, speed: [160, 420], angle: [-Math.PI * 0.9, -Math.PI * 0.1], gravity: 520, drag: 1.6, life: [0.45, 0.8], size: [10, 18] }, sparkDraw));
    lg.restore();
  });
}

/** 两侧剪影（勇者举剑 / 盘龙单眼）。fold：63.40 后折倒。 */
function drawSilhouettes(ctx, g, T) {
  const up = ez(T, TT.sil0, TT.sil1, (x) => outBack(x, 1.6));
  const fold = ez(T, TT.shrink0, TT.shrink1, inOutCubic);
  const vis = up * (1 - fold);
  if (vis <= 0.01) return;
  const breathe = Math.sin(T * 2.6) * 0.012;
  ctx.layer(g, { shadow: 12, texture: 0.25 }, (lg) => {
    // 勇者：脚底 (330,620)、高 300，ink 剪影 + scarf 红边，剑举向前上方
    // 站在围巾下划线上（脚底贴丝带上沿），立体书式以脚底为铰链立起
    const HX = 290, HY = 612;
    lg.save();
    lg.translate(HX, HY); lg.scale(1, Math.max(0.01, vis * (1 + breathe))); lg.translate(-HX, -HY);
    drawHero(lg, { x: HX, y: HY, s: 1.12, face: 1, t: T, pose: 'draw', act: 1, swordArc: 0, sword: 'hand', swordAngle: -1.32, silhouette: true, keepColor: [], edge: { color: PAL.scarf, w: 5 },
      scarf: { len: 170, wind: [-220, -160] }, jointsAdd: { lean: 2 * Math.sin(T * 2.6) } });
    lg.restore();
    // 巨龙：盘着、面朝左，只亮一只黄眼
    // 盘在丝带右段上，头朝左（面向勇者），整条在画框里
    const DX = 1472, DY = 440, DB = 600;
    lg.save();
    lg.translate(DX, DB); lg.scale(1, Math.max(0.01, vis * (1 - breathe))); lg.translate(-DX, -DB);
    drawDragon(lg, { pose: 'coil', t: T, x: DX, y: DY, s: 0.46, face: -1, silhouette: true, keepColor: ['eye'], eyes: { one: true, glow: 0.9 } });
    lg.restore();
  });
}

/** 两只纸鸟飞过（62.60–63.40）。 */
function drawBirds(g, T) {
  for (let i = 0; i < 2; i++) {
    const t0 = TT.cover - 0.15 + i * 0.22;
    const k = seg(T, t0, t0 + 1.4);
    if (k <= 0 || k >= 1) continue;
    const x = lerp(-140, 2060, k), y = 170 + i * 64 + Math.sin(k * 7 + i) * 20;
    drawDove(g, { x, y, s: 0.95 - i * 0.15, t: T, seed: i * 3 });
  }
}

/** 片名页整帧（屏幕坐标）。shrink：63.40 后片名缩到上方的进度。 */
export function drawTitleScene(g, T, ctx, o = {}) {
  ctx.layer(g, { texture: 0.32 }, (lg) => drawTitlePage(lg, T, { glint: seg(T, TT.rays + 0.1, TT.rays + 0.9) }));
  // 光芒（61.10 起慢转）+ 金色浮尘
  const rk = ez(T, TT.rays - 0.1, TT.rays + 0.4);
  const shr = o.shrink ?? 0;
  if (rk > 0) {
    const cy = lerp(470, 220, ez(shr, 0, 1, glide));
    rays(g, 960, cy, lerp(1150, 760, shr), { n: 20, width: 0.07, rot: T * 0.06, color: PAL.goldLight, alpha: 0.2 * rk, r0: 40, seed: 5 });
    glow(g, 960, cy, lerp(620, 380, shr), PAL.goldLight, 0.16 * rk);
  }
  field(g, T, { seed: 91, count: 34, x: 80, y: 80, w: 1760, h: 920, vx: 6, vy: -14, sway: 16, swayFreq: 0.3, size: [5, 11] }, (lg, x, y, s) => {
    const tw = 0.5 + 0.5 * Math.sin(T * 3.1 + s.r * 20);
    sparkle(lg, x, y, s.size * tw, { color: PAL.goldLight, alpha: 0.65 * tw * Math.max(rk, 0.35), rot: s.rot * 0.1 });
  });
  drawSilhouettes(ctx, g, T);
  drawTitleGroup(ctx, g, T, shr);
  if (T >= TT.cover - 0.2 && T < TT.shrink1 + 0.6) drawBirds(g, T);
  // 立字小震 + 火花：每字落定
  TT.rise.forEach((t0) => impact(ctx, T, t0 + 0.2, 'S', { shake: 5, flash: 0 }));
}

/** 纸卷碾过镜头（60.20–60.50，z:1 画在余波之上）：卷下是片名页，卷上仍是王座厅。 */
export function drawRollOver(g, T, ctx) {
  const p = seg(T, TT.rollCam0, TT.rollCam1);
  const { y } = rollOverCameraY(p);
  if (p < 1) {
    g.save(); g.beginPath(); g.rect(-20, y, 1960, 1200); g.clip();
    drawTitleScene(g, T, ctx);
    g.restore();
    ctx.layer(g, { shadow: 12, texture: 0.25 }, (lg) => drawPaperRoll(lg, { overCamera: p, t: T, chars: NAMES.hero }));
    impact(ctx, T, TT.rollCam0, 'S', { shake: 10, flash: 0 });
  } else {
    drawTitleScene(g, T, ctx);
  }
}
void hash2; void TAU; void rgba; void wobble; void outCubic;
