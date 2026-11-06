// b16 私有：时刻表、机位工具、名签与小特效（只给 b16 用）。
import { cue } from '../../cues.js';
import { PAL, rr, blob, glow } from '../../core/paper.js';
import { cam, drift } from '../../core/camera.js';
import { clamp, lerp, seg, rgba, mixHex, hash2 } from '../../core/util.js';
import { outBack } from '../../core/ease.js';
import { font } from '../../core/fonts.js';
import { glyphRow, glyphWidth, paperGlyph } from '../../ui/type.js';
import { paperFill } from '../../props/scarf.js';
import { piece, ell } from '../../props/royal.js';
import { DRIFT } from '../_seams.js';

// ———————————————————— 时刻表（全部 cue + 偏移） ————————————————————
export const O1 = cue('O01'), O2 = cue('O02'), O3 = cue('O03'), O4 = cue('O04'), O5 = cue('O05'), O6 = cue('O06'), O7 = cue('O07');
export const TT = {
  // O01
  retract0: O1, retract1: O1 + 0.28, tagPop: O1 + 0.28,
  push0: O1 + 0.13, push1: O1 + 0.83,
  look: O1 + 0.53, dance0: O1 + 0.73, dance1: O1 + 2.13,
  // O02
  pull0: O2, pull1: O2 + 0.85, frame0: O2 + 1.05, frame1: O2 + 1.65,
  // O03
  turn0: O3 - 0.35, turn1: O3 + 0.2, cradle: O3, baby: O3 + 0.25, giggle: O3 + 0.65, grab: O3 + 0.85, hearts: O3 + 1.05, star: O3 + 1.2,
  // O04
  ruler0: O4 - 0.16, grow: [O4, O4 + 0.64, O4 + 1.29], seasons: [O4, O4 + 0.49, O4 + 0.99, O4 + 1.49],
  // O05
  back0: O5 - 0.13, back1: O5 + 0.17, roll0: O5 + 0.07, roll1: O5 + 0.57, nudge: O5 + 0.62,
  panel0: O5 + 0.77, panel1: O5 + 1.22, scribe: O5 + 0.97, nails: O5 + 1.12, cover: O5 + 1.27, cursor: O5 + 1.47,
  // O06
  fold: O6 + 0.62, contract: O6 + 0.72, stamp: O6 + 0.92, exhale: O6 + 1.12, crown: O6 + 1.32, tie: O6 + 1.42,
};

// ———————————————————— 机位 ————————————————————
/** 与 _seams.withDrift 同一公式，外加权重 w（0 = 锁死）。 */
export function driftCam(c, T, w = 1, d = DRIFT) {
  if (w <= 0) return cam(c.x, c.y, c.zoom, c.rot || 0);
  const [dx, dy] = drift(T, d);
  return cam(c.x + (w * dx) / c.zoom, c.y + (w * dy) / c.zoom, c.zoom, c.rot || 0);
}

/** 一次性鼓包：at 起 dur 秒内 0→1→0（sin 半波）。 */
export const bump = (T, at, dur) => (T < at || T > at + dur ? 0 : Math.sin(((T - at) / dur) * Math.PI));
/** 在两个姿态之间按时间插值（返回 {from,to,k} 或字符串）。 */
export const poseMix = (a, b, k) => (k <= 0 ? a : k >= 1 ? b : { from: a, to: b, k });

// ———————————————————— 胸前名签（O01） ————————————————————
/**
 * 两种名签：kind 'hero'（奶油卡 + 墨框 + 红字，与 rigs/hero.js 的名签同款）/ 'princess'（红卡 + 奶油字 + 挂绳金扣，与 princess.js 同款）。
 * (x,y) = 签心（调用方坐标，已 applyCam）；size = 字号（局部单位）；s = 角色缩放；pop 0..1（outBack 弹出）。
 */
export function drawChestTag(g, o) {
  const { x, y, text, size = 78, s = 1, pop = 1, kind = 'hero', t = 0, rot = 0 } = o;
  if (pop <= 0.001) return;
  const k = pop >= 1 ? 1 : outBack(clamp(pop), 2.2);
  const chars = [...text];
  g.save();
  g.translate(x, y);
  g.rotate(rot + 0.025 * Math.sin(t * 1.7 + (kind === 'hero' ? 0 : 2)));
  g.scale(s * k, s * k);
  if (kind === 'hero') {
    const w = chars.length * size * 0.9 + size * 0.7, h = size * 1.42;
    paperFill(g, rr(-w / 2, -h / 2, w, h, size * 0.22), PAL.paper, { lift: 3.2, rim: PAL.white, rimW: 2, under: PAL.kraftDark, underW: 2.4 });
    g.strokeStyle = PAL.ink; g.lineWidth = Math.max(1.2, size * 0.06); g.lineJoin = 'round';
    g.stroke(rr(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, size * 0.16));
    paperFill(g, blob(-w / 2 + 12, -h / 2 + 12, 6, 6, { seed: 71 }), PAL.gold, { rim: PAL.goldLight, rimW: 1.2, under: PAL.goldDark, underW: 1.2 });
    glyphRow(g, chars, 0, 0, size, { align: 'center', family: 'display', fill: PAL.red, edge: null, gap: size * 0.06 });
  } else {
    const ws = chars.map((c) => glyphWidth(g, c, size, 'display'));
    const tw = ws.reduce((a, b) => a + b, 0) + size * 0.04 * (chars.length - 1);
    const W = tw + size * 0.55, H = size * 1.3;
    g.translate(0, -H * 0.3);
    g.save(); g.strokeStyle = PAL.redDark; g.lineWidth = Math.max(1.2, size * 0.035); g.beginPath();
    g.moveTo(-W * 0.22, -H * 0.15); g.lineTo(-size * 0.12, -size * 0.42); g.moveTo(W * 0.22, -H * 0.15); g.lineTo(size * 0.12, -size * 0.42); g.stroke(); g.restore();
    const card = new Path2D(); card.roundRect(-W / 2, -H * 0.2, W, H, size * 0.16);
    piece(g, card, PAL.red, { sh: 2.4, F: 1, rim: mixHex(PAL.red, PAL.white, 0.4), rimW: 2.4 });
    g.save(); g.strokeStyle = rgba(PAL.paper, 0.85); g.lineWidth = Math.max(1.5, size * 0.03); g.setLineDash([size * 0.09, size * 0.07]);
    const inner = new Path2D(); inner.roundRect(-W / 2 + size * 0.1, -H * 0.2 + size * 0.1, W - size * 0.2, H - size * 0.2, size * 0.1); g.stroke(inner); g.restore();
    let xx = -tw / 2;
    for (let i = 0; i < chars.length; i++) { paperGlyph(g, chars[i], xx + ws[i] / 2, H * 0.45, size, { family: 'display', fill: PAL.paper, edge: null }); xx += ws[i] + size * 0.04; }
    piece(g, ell(0, -H * 0.2, size * 0.1, size * 0.1), PAL.gold, { sh: 1, F: 1, rim: PAL.goldLight });
  }
  g.restore();
}

// ———————————————————— 拟声小字（≤5 字，play 体，奶油纸边） ————————————————————
export function sfx(g, text, x, y, size, o = {}) {
  const { pop = 1, rot = -0.08, fill = PAL.red, edge = PAL.paper, alpha = 1 } = o;
  if (pop <= 0 || alpha <= 0) return;
  const k = pop >= 1 ? 1 : outBack(clamp(pop), 2.4);
  g.save();
  g.globalAlpha *= clamp(alpha);
  g.translate(x, y); g.rotate(rot); g.scale(k, k);
  g.font = font(size, o.family || 'play');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = rgba(PAL.shadow, 0.35); g.lineWidth = size * 0.26; g.strokeText(text, size * 0.05, size * 0.08);
  g.strokeStyle = edge; g.lineWidth = size * 0.22; g.strokeText(text, 0, 0);
  g.fillStyle = fill; g.fillText(text, 0, 0);
  g.restore();
}

/** 汗滴（小水滴形纸片），(x,y) 为滴尖；k 0..1 滑落进度。 */
export function sweatDrop(g, x, y, size, k = 0, alpha = 1) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= clamp(alpha);
  g.translate(x, y + k * size * 1.6);
  const p = new Path2D();
  p.moveTo(0, -size);
  p.bezierCurveTo(size * 0.55, -size * 0.25, size * 0.62, size * 0.5, 0, size * 0.62);
  p.bezierCurveTo(-size * 0.62, size * 0.5, -size * 0.55, -size * 0.25, 0, -size);
  g.fillStyle = PAL.ice; g.fill(p);
  g.strokeStyle = PAL.skyNight; g.lineWidth = Math.max(1, size * 0.12); g.stroke(p);
  g.fillStyle = rgba(PAL.white, 0.9); g.beginPath(); g.arc(-size * 0.18, size * 0.05, size * 0.14, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** 竖向/横向手画速度线（白纸条），rect 内，seed 固定。 */
export function speedStreaks(g, rect, n, dir, k, seed = 7, color = PAL.white) {
  if (k <= 0) return;
  g.save();
  g.globalAlpha *= clamp(k);
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = hash2(seed, i), b = hash2(seed + 1, i), c = hash2(seed + 2, i);
    if (dir === 'v') {
      const x = rect.x + a * rect.w, len = rect.h * (0.25 + 0.5 * b), y = rect.y + c * (rect.h - len), w = 2 + 4 * b;
      g.beginPath(); g.moveTo(x - w / 2, y + len); g.lineTo(x, y); g.lineTo(x + w / 2, y + len); g.closePath(); g.fill();
    } else {
      const y = rect.y + a * rect.h, len = rect.w * (0.2 + 0.45 * b), x = rect.x + c * (rect.w - len), w = 3 + 6 * b;
      g.beginPath(); g.moveTo(x, y - w / 2); g.lineTo(x + len, y); g.lineTo(x, y + w / 2); g.closePath(); g.fill();
    }
  }
  g.restore();
}

/** 小泡泡（婴儿咯咯笑）。 */
export function babyBubble(g, x, y, r, alpha = 1) {
  if (alpha <= 0 || r <= 0.5) return;
  g.save();
  g.globalAlpha *= clamp(alpha);
  g.fillStyle = rgba(PAL.skyDayLow, 0.35); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgba(PAL.white, 0.9); g.lineWidth = Math.max(1.2, r * 0.14); g.stroke();
  g.fillStyle = rgba(PAL.white, 0.95); g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.2, 0, Math.PI * 2); g.fill();
  g.restore();
}

export { glow, lerp, seg, clamp };
