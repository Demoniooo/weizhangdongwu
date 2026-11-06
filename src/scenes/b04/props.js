// b04 私有小道具：卷起来的告示（勇者腋下）、被吸起来的散页、「叮」小火花。
// 纯函数；颜色只用 PAL；投影与纸纹由镜头的图层给。
import { PAL, rr, cut, blob, rgba, mixHex, sparkle } from '../../core/paper.js';
import { clamp, TAU } from '../../core/util.js';
import { outBack } from '../../core/ease.js';
import { paperGlyph } from '../../ui/type.js';

/**
 * 卷起来的告示：背面牛皮纸朝外，透出立誓时画的红蜡笔虚线；前端露出奶油纸内面的螺旋；中间一道红绳。
 * (x, y) 卷心，rot 弧度（0 = 水平，前端朝 +x），len 长，d 直径。
 */
export function drawRolledNotice(g, { x = 0, y = 0, rot = 0, len = 124, d = 26, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  const L = len, R = d / 2;
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.globalAlpha *= alpha;
  const body = rr(-L / 2, -R, L, d, R * 0.45);
  g.save(); g.translate(2, 3.5); g.fillStyle = rgba(PAL.shadow, 0.3); g.fill(body); g.restore();
  cut(g, body, PAL.kraft, { rim: PAL.paper, rimW: 1.4 });
  // 圆柱明暗：上亮下暗
  g.save(); g.clip(body);
  const gr = g.createLinearGradient(0, -R, 0, R);
  gr.addColorStop(0, rgba(PAL.white, 0.35)); gr.addColorStop(0.35, rgba(PAL.white, 0)); gr.addColorStop(1, rgba(PAL.kraftDark, 0.75));
  g.fillStyle = gr; g.fillRect(-L, -R, 2 * L, d);
  // 红蜡笔虚线（地图路线的背面透出来）
  g.strokeStyle = rgba(PAL.scarf, 0.85); g.lineWidth = 2.6; g.lineCap = 'round'; g.setLineDash([8, 6]);
  g.beginPath(); g.moveTo(-L * 0.46, R * 0.25); g.bezierCurveTo(-L * 0.2, -R * 0.55, L * 0.08, R * 0.55, L * 0.44, -R * 0.15); g.stroke();
  g.setLineDash([]);
  // 纸卷外层的接缝（一道斜线）
  g.strokeStyle = rgba(PAL.kraftDark, 0.9); g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(-L * 0.3, -R); g.lineTo(-L * 0.36, R); g.stroke();
  g.restore();
  g.strokeStyle = PAL.kraftDark; g.lineWidth = 1.6; g.stroke(body);
  // 前端：奶油纸内面 + 螺旋
  const ex = L / 2 - 3;
  const end = blob(ex, 0, R * 0.42, R * 0.98, { seed: 7, amp: 0.02 });
  cut(g, end, PAL.paper, {});
  g.strokeStyle = PAL.kraftDark; g.lineWidth = 1.3; g.stroke(end);
  g.beginPath();
  for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU * 1.6, r = (1 - i / 32) * 0.82; const px = ex + Math.cos(a) * R * 0.4 * r, py = Math.sin(a) * R * 0.92 * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
  g.strokeStyle = rgba(PAL.kraftDark, 0.8); g.lineWidth = 1; g.stroke();
  // 中间一道红绳
  const band = rr(-4, -R - 1.5, 8, d + 3, 2);
  cut(g, band, PAL.scarf, { stroke: PAL.scarfDark, lw: 1 });
  g.restore();
}

/** 一张散页（书记官讲台上被吸起来的纸）：(x, y) 中心，rot 弧度，flip 0..1 翻面（背面略暗），s 缩放。 */
export function drawLooseSheet(g, { x = 0, y = 0, rot = 0, flip = 0, s = 1, alpha = 1, seed = 1 } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.translate(x, y); g.rotate(rot);
  const sx = Math.cos(flip * Math.PI);
  g.scale(s * Math.max(0.08, Math.abs(sx)), s);
  g.globalAlpha *= alpha;
  const w = 46, h = 58;
  const p = rr(-w / 2, -h / 2, w, h, 3);
  g.save(); g.translate(2, 3); g.fillStyle = rgba(PAL.shadow, 0.25); g.fill(p); g.restore();
  cut(g, p, sx >= 0 ? PAL.paper : PAL.paper2, { rim: PAL.white, rimW: 1.2 });
  g.strokeStyle = PAL.kraftDark; g.lineWidth = 1.2; g.stroke(p);
  if (sx >= 0) {
    g.strokeStyle = rgba(PAL.inkSoft, 0.7); g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const yy = -h / 2 + 12 + i * 10, ww = w * (0.55 + 0.25 * ((seed * 7 + i * 3) % 4) / 4);
      g.beginPath(); g.moveTo(-w / 2 + 8, yy); g.lineTo(-w / 2 + 8 + ww, yy); g.stroke();
    }
  }
  g.restore();
}

/**
 * 「叮」：呆毛尖上冒出的一颗小火花 + 拟声字（屏幕坐标）。p 0..1 寿命进度；(x, y) 呆毛尖。
 */
export function drawDing(g, { x = 0, y = 0, p = 0, size = 64 } = {}) {
  if (p <= 0 || p >= 1) return;
  const pop = outBack(clamp(p / 0.25), 2.4);
  const fade = 1 - clamp((p - 0.72) / 0.28);
  g.save();
  g.globalAlpha *= fade;
  // 四角星火花（永远正立）
  const sz = size * 1.15 * pop;
  sparkle(g, x, y, sz, { color: PAL.goldLight, alpha: 1, rot: 0.2 * p });
  sparkle(g, x, y, sz * 0.55, { color: PAL.white, alpha: 1, rot: 0.2 * p + Math.PI / 4 });
  // 三条短放射线
  g.strokeStyle = PAL.gold; g.lineWidth = 4; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.75, r0 = size * 0.62 * pop, r1 = size * (0.62 + 0.38 * clamp(p * 3)) * pop;
    g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.stroke();
  }
  // 拟声字「叮」：play 字形、红字奶油纸边，在火花右上
  const tk = outBack(clamp((p - 0.06) / 0.22), 2.6);
  if (tk > 0) paperGlyph(g, '叮', x + size * 0.95, y - size * 0.55 - 10 * p, size * 0.95 * tk, { family: 'play', fill: PAL.red, edge: PAL.paper, edgeW: 0.16, rot: 0.12 });
  g.restore();
}

/** 前景虚化彩纸片（depth 1.38 层，镜头自己 applyCam）：与 misc.confettiDraw 同配色。 */
export const CONF_COLS = [PAL.heart, PAL.gold, PAL.crystal, PAL.meadow];
export function bigConfetti(g, x, y, { rot = 0, flip = 1, size = 22, col = PAL.heart } = {}) {
  g.save();
  g.translate(x, y); g.rotate(rot); g.scale(1, Math.max(0.12, Math.abs(flip)));
  g.fillStyle = flip < 0 ? mixHex(col, PAL.ink, 0.28) : col;
  g.fillRect(-size * 0.65, -size * 0.22, size * 1.3, size * 0.44);
  g.restore();
}
