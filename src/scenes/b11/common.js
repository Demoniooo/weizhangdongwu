// b11 私有：共用画法（洞穴分层、勇者常量状态、甩镜速度线、龙身横扫遮挡、对撞火花）。
import { PAL, blob, glow, lin, rr } from '../../core/paper.js';
import { applyCam } from '../../core/camera.js';
import { clamp, lerp, seg, hash2, rgba, mixHex, smoothstep } from '../../core/util.js';
import { ez, inOutSine, outCubic } from '../../core/ease.js';
import { drawCave, CAVE } from '../../env/cave.js';
import { drawCage } from '../../props/cave.js';
import { drawPrincess } from '../../rigs/princess.js';
import { speedLines } from '../../fx/transitions.js';
import { font } from '../../core/fonts.js';
import { TT, I2 } from './k.js';

/** 勇者在整段里不变的状态（= b10|b11 接缝合同里的旅途终态）。soot 在剪影段里被火墙烤掉一半。 */
export function heroLook(T) {
  const soot = lerp(0.6, 0.22, smoothstep(TT.wall0, TT.up0, T));
  return {
    soot, chip: true, ahoge: 'candle', flame: 0, sword: 'hand',
    injury: { bandages: 1, bump: true, singed: true, torn: true },
  };
}
export const SCARF = { len: 936, glow: 0.6, notch: true, hole: true };

/** 洞穴环境参数：lit → battle（121.0–121.6），碎块余烬 0 → 0.6（137.40 与 STANDOFF.caveOpts 一致）。 */
export function caveEnv(T) {
  const k = seg(T, I2 + 0.03, I2 + 0.63);
  return {
    light: k <= 0 ? 'lit' : k >= 1 ? 'battle' : { from: 'lit', to: 'battle', k },
    rubble: { at: I2, cooled: 0.6 * seg(T, I2 + 0.5, TT.hand) },
  };
}

/**
 * 洞穴四层 + 钩子：hooks.back(lg) 画在后壁层里；hooks.beforeMid(g) 在 mid 之前（另开图层的柱后物）；
 * hooks.main(lg) 画在主体层（地面之后）；hooks.afterMain(g) 主体层之后；o.fgAlpha 前景层透明度；o.sat 各层饱和度。
 */
export function caveLayers(g, T, ctx, c, env, hooks = {}, o = {}) {
  const sat = o.sat ?? 1;
  const L = (sh) => (sat === 1 ? { shadow: sh, texture: 0.3 } : { shadow: sh, texture: 0.3, sat });
  let A = null;
  ctx.layer(g, L(6), (lg) => { drawCave(lg, T, c, { ...env, layer: 'back' }); if (hooks.back) hooks.back(lg); });
  if (hooks.beforeMid) hooks.beforeMid(g);
  ctx.layer(g, L(8), (lg) => drawCave(lg, T, c, { ...env, layer: 'mid' }));
  ctx.layer(g, L(10), (lg) => { A = drawCave(lg, T, c, { ...env, layer: 'main' }); if (hooks.main) hooks.main(lg); });
  if (hooks.afterMain) hooks.afterMain(g);
  const fa = o.fgAlpha ?? 1;
  if (fa > 0.003) ctx.layer(g, fa < 1 ? { blur: 4, alpha: fa } : { blur: 4 }, (lg) => { drawCave(lg, T, c, { ...env, layer: 'fg' }); if (hooks.fg) hooks.fg(lg); });
  return A;
}

/** 鸟笼 + 公主（depth 1 世界坐标，鸟笼后片 → 公主 → 前片）。 */
export function drawCageGroup(lg, c, T, p = {}) {
  lg.save(); applyCam(lg, c, 1);
  const cg = { x: CAVE.cage.x, y: CAVE.cage.y, tally: 12, lock: p.lock || { pins: 0 }, light: 1 };
  drawCage(lg, { ...cg, part: 'back' });
  const pr = drawPrincess(lg, { x: CAVE.cage.floor[0], y: CAVE.cage.floor[1], s: CAVE.cage.princessS, face: -1, t: T, pose: p.pose || 'pickLock', expr: p.expr || 'tense', ...(p.extra || {}) });
  drawCage(lg, { ...cg, part: 'front' });
  lg.restore();
  return pr;
}

/** 竖向甩镜：整帧竖速度线 + 拖影带（a = 0..1 强度，sign +1 线往下流 / −1 往上流）。 */
export function whipLinesV(g, T, a, sign) {
  if (a <= 0.01) return;
  g.save();
  g.globalAlpha = 0.55 * a;
  g.fillStyle = lin(g, 0, 0, 0, 1080, [rgba(PAL.dragonDeep, 0.0), rgba(PAL.dragonDeep, 0.85), rgba(PAL.dragonDeep, 0.0)]);
  g.fillRect(0, 0, 1920, 1080);
  g.restore();
  speedLines(g, 'v', undefined, { t: T, sign, alpha: 0.85 * a, density: 3.4, colors: [PAL.white, PAL.goldLight, PAL.magic], lw: [2, 7], len: [0.25, 0.7], shadow: 0.6, seed: 31 });
}

/**
 * 123.90–124.10 龙身横扫遮挡（屏幕坐标，从右往左，几乎贴着镜头）：紫鳞身体 + 青绿腹甲 + 一排背板被拉成金色光带。
 * 124.00 时盖满全屏（两边在这一刻换镜）。
 */
export function drawBodySweep(g, T) {
  const p = seg(T, TT.sweep0, TT.sweep1);
  if (p <= 0 || p >= 1) return;
  const LEN = 3400;
  const xL = lerp(1960, -LEN - 40, inOutSine(p));     // 前沿
  const xR = xL + LEN;
  const top = -60, bot = 1140, belly = 760;
  g.save();
  // 身体（上缘、下缘带一点起伏，前端圆头）
  const body = new Path2D();
  body.moveTo(xL + 120, top);
  for (let x = xL + 120; x <= xR; x += 80) body.lineTo(x, top + 18 * Math.sin(x * 0.004 + 1.3));
  body.lineTo(xR, bot);
  for (let x = xR; x >= xL + 120; x -= 80) body.lineTo(x, bot - 14 * Math.sin(x * 0.005));
  body.quadraticCurveTo(xL - 120, (top + bot) / 2, xL + 120, top);
  g.fillStyle = lin(g, 0, top, 0, bot, [PAL.dragonDark, PAL.dragon, PAL.dragon, PAL.dragonDark]);
  g.fill(body);
  g.clip(body);
  // 鳞片横纹（被拉长）
  g.strokeStyle = rgba(PAL.dragonDeep, 0.45); g.lineWidth = 6;
  for (let i = 0; i < 26; i++) {
    const y = top + 40 + i * 44 + 10 * Math.sin(i * 1.7);
    const x0 = xL + 200 + hash2(5, i) * 900;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 700 + hash2(6, i) * 1300, y + 4); g.stroke();
  }
  // 腹甲
  g.fillStyle = PAL.dragonBelly;
  g.fillRect(xL, belly, LEN + 200, bot - belly + 40);
  g.fillStyle = rgba(PAL.dragonDeep, 0.25);
  for (let i = 0; i < 7; i++) g.fillRect(xL, belly + 22 + i * 52, LEN + 200, 6);
  // 背板 → 金色光带（13 块，按阅读顺序从左往右排在身上，被速度拉成长条）
  for (let i = 0; i < 13; i++) {
    const cx = xL + 260 + i * ((LEN - 400) / 12);
    const y = 150 + 22 * Math.sin(i * 0.9);
    g.fillStyle = lin(g, cx - 200, 0, cx + 420, 0, [rgba(PAL.goldLight, 0), rgba(PAL.goldLight, 0.95), rgba(PAL.gold, 0.6), rgba(PAL.gold, 0)]);
    g.fill(rr(cx - 200, y - 46, 620, 92, 46));
    glow(g, cx, y, 150, PAL.dragonEye, 0.5);
  }
  g.restore();
  // 速度线压在上面
  speedLines(g, 'h', { x: Math.max(0, xL), y: 0, w: Math.min(1920, xR) - Math.max(0, xL), h: 1080 }, { t: T, sign: -1, alpha: 0.7, density: 3, colors: [PAL.white, PAL.goldLight], lw: [2, 6], seed: 13 });
}

/** 屏幕层“咚”“啪！”这类拟声：剪纸字（奶油纸边 + 墨描边），pop 0..1。 */
export function sfxText(g, text, x, y, size, p, o = {}) {
  if (p <= 0 || p >= 1) return;
  const k = p < 0.25 ? outCubic(p / 0.25) * 1.15 : 1.15 - 0.15 * seg(p, 0.25, 0.45);
  const a = 1 - seg(p, 0.7, 1);
  g.save();
  g.translate(x, y); g.rotate(o.rot ?? -0.12); g.scale(k, k);
  g.globalAlpha *= a;
  g.font = font(size, o.family || 'display');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.36; g.strokeStyle = PAL.ink; g.strokeText(text, 0, 0);
  g.lineWidth = size * 0.2; g.strokeStyle = PAL.paper; g.strokeText(text, 0, 0);
  g.fillStyle = o.color || PAL.red; g.fillText(text, 0, 0);
  g.restore();
}

export const coolWarm = (T) => mixHex(PAL.magic, PAL.crystal, 0.3 + 0 * T);
export { clamp, ez };
