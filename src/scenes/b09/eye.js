// b09 私有：洞口 = 龙眼。
//  · mouthInterior：b08→b09 交接遮罩里的“洞内”——一层径向渐变（起点与 journey.js 洞口内部同色同形，随推镜沉到近黑），
//    外加 journey 洞口的獠牙复刻（只是几条路径，不开缓冲），避免 98.60 那一帧獠牙突然消失。
//  · giantEye：黑暗里睁开的杏仁巨眼，轮廓 = journey.caveMouthPath 的同一个杏仁（只做缩放 / 竖向开合），
//    眼睑从中线横着裂开；虹膜 dragonEye → goldDark，竖瞳、月牙高光，眼光溢到黑暗上。
// 纯函数：只读参数；模块级常量只有预建的 Path2D。
import { PAL, glow, rad } from '../../core/paper.js';
import { clamp, lerp, hash2, rgba, mixHex } from '../../core/util.js';
import { applyCam, toScreen } from '../../core/camera.js';
import { caveMouthPath, JOURNEY_FIXED } from '../../env/journey.js';

const M = JOURNEY_FIXED.caveMouth;            // { x:13000, y:640, w:520, h:360 }（journey 主体层世界坐标）
let MOUTH = null;                             // 世界坐标的洞口杏仁（首次用到时建好，之后复用）
let FANGS = null;
const mouthWorld = () => (MOUTH || (MOUTH = caveMouthPath()));

/** journey.js 洞口獠牙的同一套几何（种子 1707–1709，与 b08 画面逐条对位）。 */
function fangPaths() {
  if (FANGS) return FANGS;
  const { x, y, w, h } = M;
  const fangs = new Path2D(), lower = new Path2D();
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9, fx = x - w * 0.44 + t * w * 0.88;
    const topY = y - (h / 2) * Math.pow(Math.sin(t * Math.PI), 0.82) * (1 - 0.18 * Math.cos(t * Math.PI) ** 2) + 4;
    const L = (36 + 34 * Math.sin(t * Math.PI)) * (0.7 + hash2(1707, i) * 0.5);
    fangs.moveTo(fx - 13, topY - 6); fangs.lineTo(fx + (hash2(1708, i) - 0.5) * 6, topY + L); fangs.lineTo(fx + 13, topY - 6); fangs.closePath();
    if (i % 2 === 0 && i > 0 && i < 8) {
      const botY = y + (h / 2) * Math.pow(Math.sin(t * Math.PI), 0.82) * 0.9 - 2;
      lower.moveTo(fx - 10, botY + 6); lower.lineTo(fx, botY - 22 - hash2(1709, i) * 14); lower.lineTo(fx + 10, botY + 6); lower.closePath();
    }
  }
  FANGS = { fangs, lower };
  return FANGS;
}

/** 洞内“黑”的终点色（= 暗光照山洞的平均色）：99.60 起 b09_dark 用同一函数叠一层再褪掉。 */
export function darkFill(g, cx, cy, R, a = 1) {
  if (a <= 0) return;
  g.save();
  g.globalAlpha *= clamp(a);
  g.fillStyle = rad(g, cx, cy, 0, R, [[0, mixHex(PAL.dragonDeep, PAL.ink, 0.42)], [0.55, mixHex(PAL.dragonDeep, PAL.ink, 0.7)], [1, mixHex(PAL.ink, PAL.shadow, 0.55)]]);
  g.fillRect(-80, -80, 2080, 1240);
  g.restore();
}

/**
 * 交接遮罩里的洞内（屏幕坐标，g 不带机位）。c = journeyCam(T)（与 b08 同一个对象），dark 0..1 = 沉到近黑的程度。
 * 起点：journey.js 洞口内部（dragonDeep 底 + magic→dragon→ink 径向 + 内缘暗边 + 獠牙 + 洞口紫光）；终点：darkFill。
 */
export function mouthInterior(g, T, c, dark) {
  const k = 1 - clamp(dark);
  const [cx, cy] = toScreen(c, 1, M.x, M.y);
  const z = c.zoom;
  // 底：dragonDeep → 终点暗色
  g.fillStyle = mixHex(PAL.dragonDeep, mixHex(PAL.ink, PAL.shadow, 0.5), 0.55 * clamp(dark));
  g.fillRect(-80, -80, 2080, 1240);
  // journey 同款径向（中心 (13000, 670)，半径 0.55w）：洞里的紫光随推进熄灭
  const [gx, gy] = toScreen(c, 1, M.x, M.y + 30);
  const pulse = 0.5 + 0.5 * Math.sin(T * 2.1);
  const R = M.w * 0.55 * z;
  g.fillStyle = rad(g, gx, gy, 10 * z, R, [[0, rgba(PAL.magic, (0.55 + 0.2 * pulse) * k)], [0.35, rgba(PAL.dragon, 0.5 * k)], [1, rgba(PAL.ink, 0.92 * k)]]);
  g.fillRect(-80, -80, 2080, 1240);
  // 终点暗色逐渐盖上来
  darkFill(g, cx, cy, Math.max(700, 1300 * (z / 3.2)), clamp(dark));
  // 内缘暗边 + 獠牙（世界坐标，跟着推镜放大；越进越暗，最后成为黑里的剪影）
  g.save();
  applyCam(g, c, 1);
  const mouth = mouthWorld();
  g.save(); g.clip(mouth); g.translate(0, 8); g.lineWidth = 16; g.strokeStyle = rgba(PAL.ink, 0.55 * k); g.stroke(mouth); g.restore();
  const { fangs, lower } = fangPaths();
  const fc = mixHex(mixHex(PAL.stone2, PAL.paper2, 0.45), mixHex(PAL.dragonDeep, PAL.ink, 0.5), clamp(dark * 1.15));
  g.fillStyle = fc; g.fill(fangs); g.fill(lower);
  const sh = g.createLinearGradient(M.x - M.w / 2, 0, M.x + M.w / 2, 0);
  sh.addColorStop(0, rgba(PAL.dragonDark, 0.1 * k)); sh.addColorStop(1, rgba(PAL.dragonDark, 0.45 * k));
  g.fillStyle = sh; g.fill(fangs);
  g.restore();
  // b08 的“洞口紫光”（screen 叠在洞口上），同样随推进熄灭
  if (k > 0.01) glow(g, gx, toScreen(c, 1, M.x, M.y + 20)[1], 420 * z, PAL.magic, (0.32 + 0.1 * Math.sin(T * 2.1)) * k);
}

/** 交接遮罩：洞口杏仁（屏幕坐标）按 S 绕洞口屏幕中心放大（S=1 = 洞口内缘本身）。 */
export function mouthMaskPath(c, S) {
  const [cx, cy] = toScreen(c, 1, M.x, M.y);
  const p = new Path2D();
  const m = new DOMMatrix().translate(cx, cy).scale(S, S).translate(-cx, -cy);
  p.addPath(caveMouthPath(c), m);
  return p;
}

/** 盖满全屏所需的放大倍数（洞口屏幕半宽 a、半高 b；四角与四边中点都要在杏仁里）。 */
export function coverScale(c) {
  const [cx, cy] = toScreen(c, 1, M.x, M.y);
  const a = (M.w / 2) * c.zoom, b = (M.h / 2) * c.zoom;
  const inside = (S, px, py) => {
    const u = (px - cx) / (a * S);
    if (Math.abs(u) >= 1) return false;
    const s = Math.sqrt(1 - u * u);
    const half = b * S * Math.pow(s, 0.82) * (1 - 0.18 * u * u);
    return Math.abs(py - cy) < half;
  };
  const pts = [[-40, -40], [1960, -40], [-40, 1120], [1960, 1120], [960, -40], [960, 1120], [-40, 540], [1960, 540]];
  let lo = 1, hi = 12;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (pts.every(([x, y]) => inside(m, x, y))) hi = m; else lo = m; }
  return hi;
}

/**
 * 杏仁巨眼（屏幕或世界坐标都可，按调用方变换画）。轮廓 = 洞口杏仁（520×360 的同一个形状按 w 等比缩放）。
 * o: { x, y（眼心）, w（宽，高 = w·360/520）, open 0..1（眼睑从中线裂开，可 >1 过冲）, look:[dx,dy] −1..1, pupil 0..1,
 *      glow 0..1（眼光外溢）, alpha, slit 0..1（open=0 时那道金色细缝的亮度）, t }
 */
export function giantEye(g, o) {
  const { x, y, w } = o;
  const open = Math.max(0, o.open ?? 1), look = o.look || [0, 0], pupil = o.pupil ?? 0.25, gl = o.glow ?? 1, alpha = o.alpha ?? 1;
  if (alpha <= 0.002) return;
  const s = w / M.w, h = M.h * s, rx = w / 2, ry = h / 2;
  g.save();
  g.globalAlpha *= clamp(alpha);
  // 眼光溢到黑暗上（先画，压在眼睛下面）
  if (gl > 0) {
    g.save(); g.translate(x, y); g.scale(1, 0.62);
    glow(g, 0, 0, w * 0.95, PAL.dragonEye, 0.42 * gl * clamp(open * 1.6 + (o.slit ?? 0) * 0.4));
    glow(g, 0, 0, w * 0.55, PAL.goldLight, 0.22 * gl * clamp(open));
    g.restore();
  }
  if (open <= 0.004) {
    const sl = clamp(o.slit ?? 0);
    if (sl > 0) {
      g.strokeStyle = rgba(PAL.goldLight, 0.9 * sl); g.lineCap = 'round'; g.lineWidth = Math.max(1.5, h * 0.018);
      g.beginPath(); g.moveTo(x - rx * 0.92, y); g.lineTo(x + rx * 0.92, y); g.stroke();
      glow(g, x, y, rx * 0.6, PAL.dragonEye, 0.35 * sl);
    }
    g.restore();
    return;
  }
  const k = open;
  const mtx = new DOMMatrix().translate(x, y).scale(s, s * k).translate(-M.x, -M.y);
  const P = new Path2D(); P.addPath(mouthWorld(), mtx);
  // 眉骨（暗紫的皮，下缘被眼光照出一道暖边）：露在眼睛上沿之上，在黑暗里勾出“这是一张脸”
  const br = clamp(o.brow ?? 0) * clamp(k * 1.5);
  if (br > 0.01) {
    const bp = new Path2D();
    bp.moveTo(x - rx * 1.06, y - ry * 0.12);
    bp.quadraticCurveTo(x - rx * 0.15, y - ry * (2.25 + 0.15 * k), x + rx * 1.02, y - ry * 0.55);
    bp.quadraticCurveTo(x + rx * 0.05, y - ry * (1.5 + 0.1 * k), x - rx * 1.06, y - ry * 0.12);
    bp.closePath();
    g.save();
    g.globalAlpha *= br;
    g.fillStyle = mixHex(PAL.dragonDeep, PAL.dragonDark, 0.6); g.fill(bp);
    g.clip(bp); g.translate(0, ry * 0.07);
    g.lineWidth = Math.max(2, ry * 0.08); g.strokeStyle = rgba(PAL.goldDark, 0.6); g.stroke(bp);
    g.restore();
  }
  // 眼眶暗边（压在虹膜外一圈，像洞口岩框）
  g.save(); g.lineJoin = 'round'; g.lineWidth = Math.max(3, h * 0.06); g.strokeStyle = rgba(PAL.dragonDeep, 0.95); g.stroke(P); g.restore();
  g.save();
  g.clip(P);
  // 眼白（暗金）
  g.fillStyle = mixHex(PAL.goldDark, PAL.dragonDeep, 0.35); g.fill(P);
  // 虹膜
  const cx = x + look[0] * rx * 0.22, cy = y + look[1] * ry * 0.16;
  const R = ry * 0.98;
  const hl = [-0.6, -0.8];
  const gr = g.createRadialGradient(cx + hl[0] * R * 0.2, cy + hl[1] * R * 0.2, 0, cx, cy, R);
  gr.addColorStop(0, mixHex(PAL.dragonEye, PAL.goldLight, 0.5)); gr.addColorStop(0.55, PAL.dragonEye); gr.addColorStop(1, PAL.goldDark);
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgba(PAL.goldDark, 0.45); g.lineWidth = R * 0.045; g.beginPath(); g.arc(cx, cy, R * 0.8, 0, Math.PI * 2); g.stroke();
  // 虹膜纹（放射细线，像纸上压出的纹）
  g.strokeStyle = rgba(PAL.goldDark, 0.28); g.lineWidth = Math.max(1, R * 0.018);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + hash2(91, i) * 0.2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.32, cy + Math.sin(a) * R * 0.32); g.lineTo(cx + Math.cos(a) * R * (0.7 + hash2(92, i) * 0.12), cy + Math.sin(a) * R * (0.7 + hash2(92, i) * 0.12)); g.stroke();
  }
  // 竖瞳（贯穿）
  const pw = R * lerp(0.1, 0.46, pupil), ph = R * 0.98;
  g.fillStyle = PAL.ink;
  g.beginPath(); g.moveTo(cx, cy - ph); g.quadraticCurveTo(cx + pw, cy, cx, cy + ph); g.quadraticCurveTo(cx - pw, cy, cx, cy - ph); g.fill();
  // 月牙高光 + 小点
  const hx = cx + hl[0] * R * 0.45, hy = cy + hl[1] * R * 0.42, hr = R * 0.28;
  g.fillStyle = PAL.white;
  g.beginPath(); g.arc(hx, hy, hr, Math.PI * 0.65, Math.PI * 1.85); g.arc(hx + hr * 0.28, hy + hr * 0.22, hr * 0.82, Math.PI * 1.85, Math.PI * 0.65, true); g.fill();
  g.globalAlpha *= 0.8; g.beginPath(); g.arc(cx - hl[0] * R * 0.38, cy - hl[1] * R * 0.36, R * 0.07, 0, Math.PI * 2); g.fill();
  g.globalAlpha /= 0.8;
  // 眼窝内缘的阴影（上沿厚、下沿薄：眼睛陷在眼窝里）
  g.save(); g.translate(0, h * 0.05 * k); g.lineJoin = 'round'; g.lineWidth = h * 0.16; g.strokeStyle = rgba(PAL.dragonDeep, 0.55); g.stroke(P); g.restore();
  g.restore();
  // 眼睑墨线（一圈，上沿再压一道更粗的）
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = PAL.ink; g.lineWidth = Math.max(1.2, h * 0.016); g.stroke(P);
  g.restore();
  g.restore();
}
