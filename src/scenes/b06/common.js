// b06 私有：时刻表（全部 cue('I1') + 偏移）、片名页底（深红皮面 + 金双线框 + 卷草角）、小工具。
import { cue } from '../../cues.js';
import { PAL, smooth, rr, lin, rad } from '../../core/paper.js';
import { clamp, lerp, hash2, rgba, mixHex } from '../../core/util.js';
import { drift } from '../../core/camera.js';

export const I1 = cue('I1');
/** 间奏一节点（默认秒，= I1 + 偏移；storyboard b06 逐镜头时刻）。 */
export const TT = {
  start: I1,                 // 56.89 接缝
  sweepEnd: I1 + 0.41,       // 57.30 横幅扫光走完
  kingTalk: I1 + 0.51,       // 57.40 国王张嘴「达…」
  pounce: I1 + 0.71,         // 57.60 所有人扑上去捂嘴「别！」
  camLow0: I1 + 0.91,        // 57.80 机位开始降到贴地
  camLow1: I1 + 1.51,        // 58.40 低机位到位
  ropeSnap: I1 + 1.51,       // 58.40 人山撞断横幅吊绳
  bounce: [I1 + 1.76, I1 + 1.96, I1 + 2.16], // 58.65 / 58.85 / 59.05 纸卷弹台阶
  heroJump: I1 + 2.31,       // 59.20 勇者跳过纸卷
  rollCam0: I1 + 3.31,       // 60.20 纸卷碾过镜头
  rollCam1: I1 + 3.61,       // 60.50
  rise: [I1 + 3.71, I1 + 3.86, I1 + 4.01, I1 + 4.16], // 60.60 / 60.75 / 60.90 / 61.05 片名逐字立起
  rays: I1 + 4.21,           // 61.10 光芒 + 金箔扫光
  foil1: I1 + 4.71,          // 61.60 扫光到「吧」右上闪星
  scarf0: I1 + 4.61,         // 61.50 围巾飞入
  scarf1: I1 + 5.11,         // 62.00
  text0: I1 + 4.81,          // 61.70 围巾上逐字写（每 0.1s 一字）
  sil0: I1 + 4.71,           // 61.60 两侧剪影立起
  sil1: I1 + 5.21,           // 62.10
  cover: I1 + 5.71,          // 62.60 封面帧
  shrink0: I1 + 6.51,        // 63.40 片名缩到上方
  shrink1: I1 + 6.81,        // 63.70
  deal0: I1 + 6.81,          // 63.70 发牌
  flips: [I1 + 7.41, I1 + 7.76, I1 + 8.11, I1 + 8.46], // 64.30 勇者 / 64.65 公主 / 65.00 巨龙 / 65.35 国王
  gather: I1 + 8.81,         // 65.70 收拢洗牌
  topFlip: I1 + 9.21,        // 66.10 最上面一张翻成卡背
  grow0: I1 + 9.51,          // 66.40 卡背放大成第一片折页
  unfold0: I1 + 9.91,        // 66.80 风琴折开始
  flat: I1 + 11.11,          // 68.00 摊平扬灰
  pass: [I1 + 11.71, I1 + 12.41, I1 + 13.11, I1 + 13.91, I1 + 14.61, I1 + 15.31], // 68.60 … 72.20 笔头经过地标
  pin: I1 + 15.51,           // 72.40 任务图钉
  pull0: I1 + 15.61,         // 72.50 拉回全图
  dive0: I1 + 16.41,         // 73.30 扎进王城图标
  dive1: I1 + 17.21,         // 74.10（b07 开始画红带）
  end: I1 + 17.56,           // 74.45 块结束
};

/** 全片统一漂移参数（与 _seams.js 的 DRIFT 相同：amp 5、speed 0.35、seed 3）。k = 漂移强度 0..1。 */
export function camDrift(c, T, k = 1, d = { amp: 5, speed: 0.35, seed: 3 }) {
  if (k <= 0) return c;
  const [dx, dy] = drift(T, d);
  return { x: c.x + (dx * k) / c.zoom, y: c.y + (dy * k) / c.zoom, zoom: c.zoom, rot: c.rot || 0 };
}

// ———————————————————— 片名页（屏幕坐标，storyboard 4.9） ————————————————————
const W = 1920, H = 1080;
/** 四角卷草（金线，smooth 曲线）。 */
const CURL = (() => {
  const base = [[0, 0], [70, 6], [118, 30], [132, 66], [112, 92], [84, 88], [78, 64], [96, 52]];
  const base2 = [[0, 0], [6, 70], [30, 118], [66, 132], [92, 112], [88, 84], [64, 78], [52, 96]];
  return [smooth(base, { closed: false, tension: 0.5 }), smooth(base2, { closed: false, tension: 0.5 })];
})();

/** 片名页底：满屏 redDeep 皮面 + 皮纹 + 内缩 60 的 gold 双线框 + 四角卷草。g 为屏幕坐标。glint：金线扫光 0..1。 */
export function drawTitlePage(g, T, o = {}) {
  g.save();
  // 皮面：左上微亮、右下压暗
  g.fillStyle = lin(g, 0, 0, W, H, [[0, mixHex(PAL.redDeep, PAL.red, 0.16)], [0.55, PAL.redDeep], [1, mixHex(PAL.redDeep, PAL.ink, 0.35)]]);
  g.fillRect(-40, -40, W + 80, H + 80);
  g.fillStyle = rad(g, 640, 360, 80, 1250, [[0, rgba(PAL.goldLight, 0.12)], [1, rgba(PAL.goldLight, 0)]]);
  g.fillRect(-40, -40, W + 80, H + 80);
  // 皮纹：稀疏的细碎斑点（固定种子）
  g.fillStyle = rgba(PAL.ink, 0.1);
  for (let i = 0; i < 220; i++) {
    const x = hash2(601, i) * W, y = hash2(602, i) * H, r = 1 + hash2(603, i) * 2.2;
    g.beginPath(); g.ellipse(x, y, r * 1.6, r, hash2(604, i) * 3, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = rgba(PAL.goldLight, 0.05);
  for (let i = 0; i < 120; i++) {
    const x = hash2(611, i) * W, y = hash2(612, i) * H;
    g.fillRect(x, y, 2, 1.2);
  }
  // 金双线框（内缩 60）+ 压印暗线
  const inset = 60;
  const frame = (d, lw, col) => { g.strokeStyle = col; g.lineWidth = lw; g.stroke(rr(inset + d, inset + d, W - 2 * (inset + d), H - 2 * (inset + d), 10)); };
  frame(2, 7, rgba(PAL.ink, 0.35));
  frame(0, 5, PAL.gold);
  frame(16, 2.4, PAL.goldDark);
  frame(15, 1.2, rgba(PAL.goldLight, 0.7));
  // 金线扫光（片名立起后一道）
  if (o.glint > 0 && o.glint < 1) {
    const gx = lerp(-300, W + 300, o.glint);
    g.save();
    g.beginPath(); g.rect(0, 0, W, H); g.clip();
    g.globalCompositeOperation = 'screen';
    g.fillStyle = lin(g, gx - 160, 0, gx + 160, 0, [[0, rgba(PAL.goldLight, 0)], [0.5, rgba(PAL.goldLight, 0.35)], [1, rgba(PAL.goldLight, 0)]]);
    g.fillRect(gx - 160, 0, 320, H);
    g.restore();
  }
  // 四角卷草
  g.lineCap = 'round'; g.lineJoin = 'round';
  const corners = [[inset + 24, inset + 24, 1, 1], [W - inset - 24, inset + 24, -1, 1], [inset + 24, H - inset - 24, 1, -1], [W - inset - 24, H - inset - 24, -1, -1]];
  for (const [cx, cy, sx, sy] of corners) {
    g.save(); g.translate(cx, cy); g.scale(sx * 0.9, sy * 0.9);
    for (const [col, lw, d] of [[rgba(PAL.ink, 0.35), 6, 2], [PAL.gold, 4.2, 0]]) {
      g.save(); g.translate(d, d);
      g.strokeStyle = col; g.lineWidth = lw;
      g.stroke(CURL[0]); g.stroke(CURL[1]);
      g.fillStyle = col; g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.fillStyle = PAL.goldLight; g.beginPath(); g.arc(-1.5, -1.5, 2.6, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.restore();
}

/** 线性插值矩形。 */
export const lerpRect = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
/** 0..1 → 0..1 的“落定后保持”包络（在 [a,b] 内上升）。 */
export const rise01 = (T, a, b) => clamp((T - a) / (b - a));
