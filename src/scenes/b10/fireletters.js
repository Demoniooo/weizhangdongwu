// b10 D2：火焰字连珠炮（世界坐标 depth 1，CV-W 下与屏幕重合）。
// 每个字：从龙嘴喷出 → 擦着勇者飞过（他躲）→ 撞上左边洞壁（火花 + 一闪的字痕）→ 弹回、减速停进头顶一排字位。
// 最先喷出的字位在最左，所以落定后从左往右正好是正序。最后的「松」拐个弯正中呆毛。
import { PAL } from '../../core/paper.js';
import { clamp, lerp, seg, noise1, hash2 } from '../../core/util.js';
import { outCubic, outBack, inQuad, inOutSine } from '../../core/ease.js';
import { burst } from '../../core/particles.js';
import { NAME_TIMES, charsOf, paperGlyph } from '../../ui/type.js';
import { glow, rgba } from '../../core/paper.js';
import { drawFireLetter, sparkDraw, emberDraw } from '../../props/misc.js';
import { C } from './common.js';

export const CHARS = charsOf('dragon');
export const D2_TIMES = [...NAME_TIMES('D2a'), ...NAME_TIMES('D2b')];
export const MOUTH = [1382, 522];
export const HERO_X = 420;
const WALL_X = 196;
const D1 = 0.16; // 嘴 → 洞壁
const D2 = 0.46; // 洞壁 → 字位
// 字号：D2a 一样大；D2b 一个比一个大
export const SIZES = [82, 82, 82, 82, 82, 82, 82, 82, 92, 100, 108, 116, 126];
// 字位（一排，y=300）：D2a 每格 92；D2b 按字号放宽
export const SLOTS = (() => {
  const xs = [];
  for (let i = 0; i < 8; i++) xs.push(156 + 86 * i);
  let x = xs[7];
  for (let i = 8; i < 12; i++) { x += (SIZES[i - 1] + SIZES[i]) / 2 + 3; xs.push(x); }
  return xs.map((sx, i) => [sx, 300 - (SIZES[i] - 82) * 0.2]);
})();
// 每个字擦过勇者的高度（世界 y，勇者脚底约 912）：头 / 脚 / 胸 / 腹……
const ATTACK = [618, 694, 884, 766, 806, 640, 772, 872, 700, 878, 760, 806];
const ROT0 = [-0.5, 0.6, -0.7, 0.45, -0.55, 0.7, -0.4, 0.6, -0.5, 0.65, -0.6, 0.5];

const bez = (a, b, c, u) => [(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * b[0] + u * u * c[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * b[1] + u * u * c[1]];

/** 第 i 个字（0..11）撞墙的世界点与时刻。 */
export function wallHit(i) {
  return { at: D2_TIMES[i] + D1, x: WALL_X + hash2(i, 3) * 20, y: ATTACK[i] - 8 };
}
/** 第 i 个字擦过勇者（x=420）的时刻。 */
export const passTime = (i) => D2_TIMES[i] + D1 * ((MOUTH[0] - HERO_X) / (MOUTH[0] - WALL_X));

function posAt(i, T) {
  const te = D2_TIMES[i];
  const h = ATTACK[i];
  const W = [wallHit(i).x, wallHit(i).y];
  const S = SLOTS[i];
  const a = T - te;
  if (a < D1) {
    const u = clamp(a / D1);
    return { p: bez(MOUTH, [820, h + 6], W, u), rot: 0, phase: 1 };
  }
  const v = clamp((a - D1) / D2);
  const e = outBack(v, 1.15);
  const ctrl = [lerp(W[0], S[0], 0.25), Math.min(h, S[1]) - 140];
  const p = bez(W, ctrl, S, clamp(e, 0, 1.08));
  return { p, rot: ROT0[i] * (1 - outCubic(v)), phase: v < 1 ? 2 : 3 };
}

/** 「松」：喷出 → 拐弯到呆毛上方 → 俯冲正中呆毛（ahoge = 呆毛尖世界坐标，按命中时刻算）。 */
export const SONG_T = D2_TIMES[12];          // 112.986 命中
export const SONG_EMIT = SONG_T - 0.29;
export const SONG_POOF = C('Q2') - 0.21;     // 113.10「噗」
const APEX = [790, 410];
function songPos(T, tip) {
  const a = T - SONG_EMIT;
  if (a < 0.14) { const u = outCubic(clamp(a / 0.14)); return bez(MOUTH, [1080, 330], APEX, u); }
  if (a < 0.2) { const u = clamp((a - 0.14) / 0.06); return [lerp(APEX[0], APEX[0] - 40, inOutSine(u)), APEX[1] + Math.sin(u * Math.PI) * -10]; }
  const u = inQuad(clamp((T - (SONG_EMIT + 0.2)) / (SONG_T - SONG_EMIT - 0.2)));
  const top = [tip[0], tip[1] - 30];
  return bez([APEX[0] - 40, APEX[1]], [620, 330], top, u);
}

/**
 * 画全部火焰字（调用方已 applyCam depth 1）。tip = 呆毛尖（世界坐标，函数：t → [x,y]）。
 * 返回 { songOn }。
 */
export function drawFireLetters(g, T, tip) {
  const dis0 = C('Q2') - 0.11; // 113.20 起散成火星
  for (let i = 0; i < 12; i++) {
    const te = D2_TIMES[i];
    if (T < te) continue;
    const st = posAt(i, T), pr = posAt(i, T - 1 / 60);
    const vx = (st.p[0] - pr.p[0]) * 60, vy = (st.p[1] - pr.p[1]) * 60;
    const settle = st.phase === 3 ? 1 : 0;
    const bob = settle ? Math.sin(T * 6.2 + i * 0.9) * 4 : 0;
    const birth = outBack(clamp((T - te) / 0.08), 2);
    const dis = seg(T, dis0 + i * 0.02, dis0 + 0.4 + i * 0.02);
    if (dis >= 1) continue;
    drawFireLetter(g, {
      x: st.p[0], y: st.p[1] + bob, ch: CHARS[i], size: SIZES[i], s: 0.35 + 0.65 * birth, rot: st.rot + (settle ? Math.sin(T * 3 + i) * 0.04 : 0),
      t: T, seed: i + 1, vel: [vx, vy], heat: st.phase === 1 ? 1.3 : 1, dissolve: dis, tongues: 4,
    });
  }
  // 「松」
  let songOn = false;
  if (T >= SONG_EMIT && T < SONG_POOF + 0.06) {
    songOn = true;
    const tp = tip(Math.min(T, SONG_T));
    let p;
    if (T < SONG_T) p = songPos(T, tip(SONG_T));
    else p = [tp[0], tp[1] - 34 - 8 * outBack(clamp((T - SONG_T) / 0.08), 3)];
    const pp = T < SONG_T ? songPos(T - 1 / 60, tip(SONG_T)) : p;
    const birth = outBack(clamp((T - SONG_EMIT) / 0.08), 2);
    const sitting = T >= SONG_T;
    const s = sitting ? lerp(1, 0.62, outCubic(clamp((T - SONG_T) / 0.06))) : 0.4 + 0.6 * birth;
    const fade = 1 - seg(T, SONG_POOF, SONG_POOF + 0.06);
    drawFireLetter(g, {
      x: p[0], y: p[1], ch: CHARS[12], size: SIZES[12], s, rot: sitting ? Math.sin(T * 30) * 0.05 : -0.25 * (1 - seg(T, SONG_EMIT, SONG_T)),
      t: T, seed: 13, vel: [(p[0] - pp[0]) * 60, (p[1] - pp[1]) * 60], heat: 1.4, alpha: fade, tongues: 5,
    });
  }
  return { songOn };
}

/** 撞墙火花 + 喷出时嘴边火星（world depth 1）。 */
export function drawFireSparks(g, T) {
  for (let i = 0; i < 12; i++) {
    const w = wallHit(i);
    if (T < w.at || T > w.at + 0.8) continue;
    burst(g, T, { at: w.at, seed: 40 + i, count: 16, x: w.x - 10, y: w.y, spread: 14, speed: [180, 520], angle: [-1.35, 1.35], gravity: 700, drag: 2.2, life: [0.3, 0.6], size: [5, 10] }, sparkDraw);
  }
  for (let i = 0; i < 12; i++) {
    const te = D2_TIMES[i];
    if (T < te || T > te + 0.6) continue;
    burst(g, T, { at: te, seed: 70 + i, count: 10, x: MOUTH[0] - 20, y: MOUTH[1], spread: 10, speed: [120, 380], angle: [Math.PI - 0.9, Math.PI + 0.7], gravity: -60, drag: 2, life: [0.3, 0.55], size: [3, 6] }, emberDraw);
  }
  if (T >= SONG_T && T < SONG_T + 0.7) burst(g, T, { at: SONG_T, seed: 91, count: 14, x: 0, y: 0, speed: [0, 0] }, () => {});
}

/**
 * 一闪的字痕：撞墙瞬间洞壁上亮一下火焰字形，随即变成焦痕、0.7s 内淡掉（比 drawCave 的 scorch 短，免得十几个字痕在墙上叠成一竖排）。
 * 坐标：back 层（depth 0.5）世界坐标，由 toLayer(i) 给（按撞墙时刻的机位换算，之后贴在墙上随视差走）。
 */
export function drawScorch(g, T, toLayer) {
  for (let i = 0; i < 12; i++) {
    const w = wallHit(i);
    const life = T - w.at;
    if (life < 0 || life > 0.75) continue;
    const [x, y] = toLayer(i);
    const size = SIZES[i] * 0.78;
    const flash = 1 - seg(life, 0.03, 0.22), fade = 1 - seg(life, 0.18, 0.72);
    const rot = (hash2(i, 9) - 0.5) * 0.4;
    g.save();
    glow(g, x, y, size * 1.5, PAL.fire, 0.7 * flash);
    paperGlyph(g, CHARS[i], x + 2, y + 3, size, { family: 'display', fill: rgba(PAL.shadow, 0.45 * fade), edge: null, rot });
    if (flash > 0.02) paperGlyph(g, CHARS[i], x, y, size, { style: 'fire', alpha: flash, rot });
    g.restore();
  }
}

export { PAL, noise1 };
