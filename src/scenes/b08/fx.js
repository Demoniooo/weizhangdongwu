// b08 私有：块内特效（金色浮尘、风雪横扫线、喷嚏、冰裂、急刹扬尘、月出光晕、橡树落叶）。纯函数，无跨帧状态。
import { PAL, blob, glow, sparkle, rays } from '../../core/paper.js';
import { clamp, lerp, seg, smoothstep, hash2, fract, TAU, rgba, mixHex, noise1 } from '../../core/util.js';
import { outBack, outCubic, inQuad } from '../../core/ease.js';
import { toScreen } from '../../core/camera.js';
import { burst, stream, field } from '../../core/particles.js';
import { cue } from '../../cues.js';
import { JOURNEY, JOURNEY_FIXED, journeyGroundY } from '../../env/journey.js';
import { horseRig } from '../../rigs/horse.js';
import { bubble, glyphIcon } from '../../ui/kit.js';
import { paperGlyph, glyphRow } from '../../ui/type.js';
import { riderParams } from './rider.js';

const V09 = cue('V09'), V11 = cue('V11'), V12 = cue('V12'), V13 = cue('V13');
const EV = JOURNEY.events;
const SNEEZE = EV.sneeze;

/** 把屏幕绘制裁到某个区（journeyZones 的 x 区间）里。 */
function clipSpan(g, sp) { g.beginPath(); g.rect(sp.x0, -100, sp.x1 - sp.x0, 1300); g.clip(); }

/** V 区：金色午后的浮尘（屏幕空间 screen 叠，接缝 0.3s 后淡入）。 */
export function drawGoldMotes(g, T, c, sp) {
  const a = smoothstep(V09 - 0.05, V09 + 0.35, T);
  if (!sp || a <= 0) return;
  g.save(); clipSpan(g, sp);
  g.globalCompositeOperation = 'screen';
  field(g, T, { seed: 881, count: 34, x: -60, y: 120, w: 2040, h: 760, vx: -22, vy: -18, sway: 26, swayFreq: 0.25, size: [2, 5] }, (gg, x, y, s) => {
    const px = x - ((c.x * 0.35) % 2040);
    const xx = ((px % 2040) + 2040) % 2040 - 60;
    const tw = 0.55 + 0.45 * Math.sin(T * 2.3 + s.r * TAU);
    gg.fillStyle = rgba(PAL.goldLight, 0.75 * a * tw);
    gg.beginPath(); gg.arc(xx, y, s.size * 0.5, 0, TAU); gg.fill();
    if (s.r > 0.8) glow(gg, xx, y, 14, PAL.goldLight, 0.35 * a * tw);
  });
  g.restore();
}

/** 大橡树扫过后抖落的几片叶子（屏幕空间，blur 前景感；90.30 之后才出现，不碰接缝）。 */
export function drawOakLeaves(g, T) {
  const t0 = V09 + 0.15;
  if (T < t0 || T > t0 + 2.2) return;
  for (let i = 0; i < 7; i++) {
    const tb = t0 + i * 0.09, age = T - tb;
    if (age < 0) continue;
    const x = 760 - 80 * i - 210 * age + 60 * Math.sin(age * 3 + i);
    const y = -40 + (180 + 40 * hash2(890, i)) * age + 22 * Math.sin(age * 5 + i * 2);
    if (y > 1140) continue;
    const rot = age * (2 + hash2(891, i) * 3) + i;
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, Math.max(0.2, Math.abs(Math.cos(age * 4 + i))));
    g.fillStyle = i % 3 === 0 ? PAL.grassDark : i % 3 === 1 ? PAL.forest : mixHex(PAL.grass, PAL.gold, 0.4);
    g.beginPath(); g.ellipse(0, 0, 22, 10, 0, 0, TAU); g.fill();
    g.strokeStyle = rgba(PAL.forestDeep, 0.6); g.lineWidth = 2; g.beginPath(); g.moveTo(-20, 0); g.lineTo(20, 0); g.stroke();
    g.restore();
  }
}

/** S 区：横向风雪扫线（屏幕空间，V11 那一下最猛）。 */
export function drawWindStreaks(g, T, c, sp) {
  if (!sp) return;
  const gust = smoothstep(V11 - 0.03, V11 + 0.05, T);
  const peak = Math.exp(-Math.max(0, T - V11) / 0.35) * (T >= V11 - 0.03 ? 1 : 0);
  const a = 0.18 + 0.32 * gust + 0.5 * peak;
  if (a <= 0.01) return;
  g.save(); clipSpan(g, sp);
  g.lineCap = 'round';
  const n = 22;
  for (let i = 0; i < n; i++) {
    const sp2 = 0.7 + hash2(901, i) * 0.8;
    const L = 160 + hash2(902, i) * 420;
    const y = 60 + hash2(903, i) * 900 + Math.sin(T * 1.6 + i) * 10;
    const x = fract(hash2(904, i) - (T * 2.4 * sp2) - (c.x - 9000) * 0.0004) * (1920 + L * 2) - L;
    const w = 2 + hash2(905, i) * 4;
    g.strokeStyle = rgba(PAL.white, a * (0.35 + 0.5 * hash2(906, i)));
    g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y + L * 0.06); g.stroke();
  }
  g.restore();
}

/** 喷嚏：积雪炸飞（世界坐标，main 图层里）。ra = 勇者锚点。 */
export function drawSneezeSnow(lg, T, ra) {
  if (T < SNEEZE || T > SNEEZE + 1.2 || !ra) return;
  const [hx, hy] = ra.head;
  burst(lg, T, { at: SNEEZE + 0.01, seed: 911, count: 34, x: hx, y: hy - 52, spread: 26, speed: [220, 620], angle: [-Math.PI * 0.95, -Math.PI * 0.35], gravity: 1100, drag: 1.4, life: [0.6, 1.0], size: [8, 20], spin: [-6, 6] },
    (g, x, y, s) => {
      g.save(); g.globalAlpha *= 1 - smoothstep(0.65, 1, s.p);
      g.fillStyle = PAL.snowShade; g.beginPath(); g.ellipse(x + 2, y + 3, s.size * 0.6, s.size * 0.45, s.rot, 0, TAU); g.fill();
      g.fillStyle = PAL.snow; g.beginPath(); g.ellipse(x, y, s.size * 0.6, s.size * 0.45, s.rot, 0, TAU); g.fill();
      g.restore();
    });
  // 喷出的一团白雾（向前）
  const age = T - SNEEZE;
  if (age < 0.5) {
    const p = age / 0.5, [mx, my] = ra.mouth;
    for (let i = 0; i < 5; i++) {
      const d = (40 + 150 * outCubic(p)) * (0.5 + i * 0.16);
      const x = mx + d, y = my - 6 + (i - 2) * 12 * p;
      lg.fillStyle = rgba(PAL.white, 0.75 * (1 - p));
      lg.fill(blob(x, y, 14 + 34 * p * (0.6 + i * 0.12), 10 + 22 * p, { seed: 920 + i, amp: 0.1 }));
    }
  }
}

/** 冻住的围巾“咔”地裂开：冰碴迸出（世界坐标）。 */
export function drawScarfCrack(lg, T, ra) {
  const at = SNEEZE + 0.04;
  if (T < at || T > at + 0.9 || !ra || !ra.scarf) return;
  const pts = ra.scarf;
  for (let j = 0; j < 3; j++) {
    const q = pts[Math.min(pts.length - 1, 6 + j * 7)];
    burst(lg, T, { at: at + j * 0.03, seed: 930 + j, count: 9, x: q[0], y: q[1], spread: 10, speed: [120, 380], angle: [-Math.PI, 0], gravity: 1200, drag: 1.2, life: [0.4, 0.7], size: [5, 10], spin: [-9, 9] },
      (g, x, y, s) => {
        g.save(); g.globalAlpha *= 1 - s.p; g.translate(x, y); g.rotate(s.rot);
        g.fillStyle = s.r < 0.5 ? PAL.ice : PAL.white;
        g.beginPath(); g.moveTo(-s.size * 0.5, 0); g.lineTo(0, -s.size * 0.4); g.lineTo(s.size * 0.6, s.size * 0.1); g.lineTo(0, s.size * 0.35); g.closePath(); g.fill();
        g.restore();
      });
  }
}

/** 屏幕上的拟声：「阿嚏！」大喊泡（95.20）+ 围巾“咔”。在 main 图层末尾（屏幕坐标）画。「！」用路径画的 exclaim（字体里太细）。 */
export function drawSneezeWords(g, T, c, ra) {
  if (!ra) return;
  const age = T - SNEEZE;
  if (age >= -0.02 && age < 0.62) {
    const pop = clamp((age + 0.02) / 0.14);
    const out = 1 - smoothstep(0.42, 0.62, age);
    const m = toScreen(c, 1, ra.mouth[0], ra.mouth[1]);
    const bx = m[0] + 236, by = m[1] - 196, tail = [m[0] + 34, m[1] - 18];
    const sh = noise1(T * 30, 7) * 5 * Math.exp(-Math.max(0, age) / 0.2);
    g.save(); g.globalAlpha *= out;
    bubble(g, { x: bx + sh, y: by, w: 340, h: 176, shape: 'jagged', tail, pop, t: T, seed: 9 });
    const k = pop >= 1 ? 1 : outBack(pop, 2);
    const ap = clamp((pop - 0.25) / 0.4);
    if (ap > 0) {
      g.translate(tail[0], tail[1]); g.scale(k, k); g.translate(-tail[0], -tail[1]);
      glyphRow(g, ['阿', '嚏'], bx + sh - 34, by + 2, 76, {
        style: 'cut', fill: PAL.red, edge: PAL.paper, under: PAL.redDeep, align: 'center', gap: 2,
        appear: [ap, clamp(ap * 1.4 - 0.2)], perChar: (i) => ({ rot: (i ? 0.08 : -0.07), dy: noise1(T * 9 + i * 2, 9) * 2.5 }),
      });
      glyphIcon(g, 'exclaim', bx + sh + 60, by, 78 * clamp(ap * 1.6 - 0.5), { rot: 0.14 });
    }
    g.restore();
  }
  const ac = T - (SNEEZE + 0.05);
  if (ac >= 0 && ac < 0.55 && ra.scarf) {
    const q = ra.scarf[9];
    const [sx, sy] = toScreen(c, 1, q[0], q[1] - 60);
    const k = outBack(clamp(ac / 0.12), 2.6), a = 1 - smoothstep(0.35, 0.55, ac);
    paperGlyph(g, '咔', sx, sy - 20 * ac, 58 * k, { family: 'display', fill: PAL.heroBlueDark, edge: PAL.white, edgeW: 0.16, rot: -0.18, alpha: a });
  }
}

/** V12 月出：月亮背后的光晕与慢转光芒、山脊上一圈亮边（屏幕空间 screen）。 */
export function drawMoonHalo(g, T, c, sp) {
  if (!sp) return;
  const k = outCubic(seg(T, V12, V12 + 1.0));
  if (k <= 0) return;
  const M = JOURNEY_FIXED.moon;
  const mx = M.x - (c.x - 9500) * 0.05 * c.zoom, my = lerp(M.y0, M.y1, k) - (c.y - 540) * 0.05;
  g.save(); clipSpan(g, sp);
  g.globalCompositeOperation = 'screen';
  const pulse = Math.exp(-Math.max(0, T - V12) / 0.5);
  rays(g, mx, my, 760, { n: 16, width: 0.035, rot: T * 0.04, color: PAL.moonGlow, alpha: 0.1 + 0.12 * pulse, r0: M.r * 0.9, seed: 941 });
  glow(g, mx, my, M.r * 1.55, PAL.moon, 0.18 + 0.3 * pulse);
  // 刚冒头那一下：山脊线上一道亮边
  if (T < V12 + 0.6) glow(g, mx, 760 - (c.y - 540) * 0.15, 360, PAL.moonGlow, 0.5 * pulse * (1 - k));
  g.restore();
  // 月亮边上两颗跟着亮起的四角星
  for (let i = 0; i < 3; i++) {
    const at = V12 + 0.35 + i * 0.22, a = clamp((T - at) / 0.15) * (0.6 + 0.4 * Math.sin(T * 5 + i * 2));
    if (a <= 0) continue;
    const ang = -2.4 + i * 0.7, r = M.r + 70 + i * 40;
    sparkle(g, mx + Math.cos(ang) * r, my + Math.sin(ang) * r, 22 - i * 4, { color: PAL.moon, alpha: a, rot: T * 0.6 + i });
  }
}

/** V13 急刹：四蹄扬尘 + 地上两道刹车印（世界坐标，main 图层里，画在马之后）。 */
export function drawBrakeDust(lg, T) {
  const t0 = V13, t1 = V13 + 0.42;
  if (T < t0 - 0.02 || T > t1 + 1.2) return;
  // 刹车印：蹄子在 98.04–98.35 划过的地面
  const hx = (t) => riderParams(t).horse.x;
  const x0 = hx(t0), x1 = hx(Math.min(T, t0 + 0.31));
  if (x1 > x0) {
    lg.save(); lg.lineCap = 'round';
    for (const [dx, w] of [[-34, 7], [52, 6]]) {
      lg.strokeStyle = rgba(mixHex(PAL.dragonDeep, PAL.ink, 0.3), 0.55); lg.lineWidth = w;
      lg.beginPath(); lg.moveTo(x0 + dx, 868); lg.lineTo(x1 + dx, 867); lg.stroke();
    }
    lg.restore();
  }
  stream(lg, T, {
    start: t0, end: t1, rate: 70, seed: 951, life: [0.5, 1.0], drag: 2.2, gravity: -40, size: [14, 30],
    emit: (tb, i, r) => {
      const hp = riderParams(tb).horse;
      const a = horseRig(hp);
      const d = a.dust.length ? a.dust[i % a.dust.length] : { x: a.hooves.fn[0], y: a.hooves.fn[1] };
      return { x: d.x + (r - 0.5) * 20, y: Math.min(d.y, 880) - 6, vx: 220 + 260 * r, vy: -60 - 120 * r };
    },
  }, (g, x, y, s) => {
    const r = s.size * (0.6 + s.p * 1.4);
    g.fillStyle = rgba(mixHex(PAL.stone2, PAL.dragon, 0.35), 0.6 * (1 - s.p));
    g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, TAU); g.fill();
  });
  // 白马溜去岩石后：起跑处一团尘
  burst(lg, T, { at: EV.horseHide[0] + 0.02, seed: 961, count: 14, x: 12250, y: 860, spread: 30, speed: [80, 260], angle: [-Math.PI, -Math.PI * 0.55], gravity: -30, drag: 2.4, life: [0.5, 0.9], size: [14, 26] },
    (g, x, y, s) => { g.fillStyle = rgba(mixHex(PAL.stone2, PAL.dragon, 0.35), 0.5 * (1 - s.p)); g.beginPath(); g.ellipse(x, y, s.size * (0.7 + s.p), s.size * 0.6 * (0.7 + s.p), 0, 0, TAU); g.fill(); });
}

/** V13 急刹那一下的冲击线（屏幕空间）：从马头前方向外的短速度线。 */
export function drawBrakeLines(g, T, c, anchor) {
  const age = T - V13;
  if (age < 0 || age > 0.35 || !anchor) return;
  const [ax, ay] = toScreen(c, 1, anchor[0], anchor[1]);
  const a = 1 - age / 0.35;
  g.save(); g.lineCap = 'round'; g.strokeStyle = rgba(PAL.moon, 0.8 * a);
  for (let i = 0; i < 7; i++) {
    const ang = -0.9 + i * 0.3, r0 = 90 + 50 * outCubic(age / 0.35), L = 50 + 30 * hash2(971, i);
    g.lineWidth = 5 - i * 0.3;
    g.beginPath(); g.moveTo(ax + Math.cos(ang) * r0, ay + Math.sin(ang) * r0); g.lineTo(ax + Math.cos(ang) * (r0 + L), ay + Math.sin(ang) * (r0 + L)); g.stroke();
  }
  g.restore();
}
void inQuad; void journeyGroundY; void clamp;
