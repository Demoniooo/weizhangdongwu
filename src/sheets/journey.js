// 模型图：旅途长卷（src/env/journey.js）+ 小地图。
//   [0,1)  五个区 + 换区瞬间（同一套图层配方的缩略图）
//   [1,2)  六种遮挡物 + E03 倒放色带
//   [2,3)  hudState 数值表（86.6 / 88.4 / 89.8 / 92.0 / 98.0 / 165.4）
//   [80, 99.6) 全段一镜到底（验收：sheet --sheet journey --from 80 --to 99.6 --every 0.25）
// 勇者与白马是本模型图自带的简易占位（只为检查 x≈760 与马蹄不打滑），正式镜头用 rigs/hero、rigs/horse。
import { PAL, blob, poly, cut, shade, ribbon, rr, sparkle } from '../core/paper.js';
import { clamp, lerp, TAU, fract, rgba, mixHex } from '../core/util.js';
import { cam, applyCam } from '../core/camera.js';
import { drawJourney, drawOccluder, journeyCam, heroJourneyState, hudState, rewindBand, JOURNEY, journeyTexOffset, journeyZones, caveMouthPath } from '../env/journey.js';
import { drawMiniMap } from '../env/map.js';
import { glyphRow } from '../ui/type.js';
import { NAMES } from '../cues.js';

const W = 1920, H = 1080;
function label(g, text, x, y, size = 30, o = {}) {
  glyphRow(g, [...text], x, y, size, { family: o.family || 'play', fill: o.fill || PAL.ink, edge: o.edge === undefined ? PAL.paper : o.edge, edgeW: 0.14, align: o.align || 'left', gap: size * 0.02, weight: o.weight });
}
function paperBg(g) { g.fillStyle = PAL.paper; g.fillRect(0, 0, W, H); }

// ———— 占位：白马 + 勇者（只看位置、步态相位、伤痕 / 围巾状态） ————
const GAIT = {
  gallop: { stride: 280, duty: 0.32, off: [0, 0.1, 0.48, 0.58], lift: 46, bob: 10 },
  trot: { stride: 170, duty: 0.42, off: [0, 0.5, 0.5, 0], lift: 34, bob: 6 },
  walk: { stride: 115, duty: 0.62, off: [0, 0.5, 0.25, 0.75], lift: 22, bob: 3 },
};
function legFoot(x, gait, k, legIdx) {
  const G = GAIT[gait] || GAIT.gallop;
  const p = fract(x / G.stride + G.off[legIdx]);
  const reach = (G.stride * G.duty) / 2;
  if (p < G.duty) return [reach - G.stride * p, 0, 1];
  const s = (p - G.duty) / (1 - G.duty), e = s * s * (3 - 2 * s);
  return [-reach + 2 * reach * e, -G.lift * Math.sin(Math.PI * s) * k, 0];
}
function drawHorsePH(g, st, T) {
  const h = st.horse, pose = typeof h.pose === 'string' ? h.pose : h.pose.to;
  const gait = h.gait || (pose === 'skid' || pose === 'rear' ? 'trot' : 'walk');
  const moving = h.speed > 30 && pose !== 'hideRock';
  g.save();
  g.translate(h.x, h.y);
  g.rotate(h.angle * 0.8 + (pose === 'rear' ? -0.35 * Math.sin(Math.min(1, (T - JOURNEY.events.rear) / 0.2) * Math.PI / 2) : 0) + (pose === 'skid' ? -0.08 : 0));
  const G = GAIT[gait] || GAIT.gallop;
  const bob = moving ? -Math.abs(Math.sin((h.x / G.stride) * TAU)) * G.bob : 0;
  const hips = [[-72, -112], [-60, -112], [70, -112], [82, -112]];
  // 远侧两条腿先画（暗一点）
  const order = [1, 3, 0, 2];
  const feet = [];
  for (const i of order) {
    let [fx, fy, planted] = moving ? legFoot(h.x, gait, 1, i) : [0, 0, 1];
    if (pose === 'hideRock') { fx = 0; fy = 0; }
    const [hx, hy] = hips[i];
    const foot = [hx + fx, fy];
    const hip = [hx, hy + bob];
    const mid = [(hip[0] + foot[0]) / 2 + (i >= 2 ? 10 : -12), (hip[1] + foot[1]) / 2];
    const far = i === 1 || i === 3;
    g.save();
    g.strokeStyle = far ? PAL.horseShade : PAL.horse; g.lineWidth = 18; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(...hip); g.lineTo(...mid); g.lineTo(...foot); g.stroke();
    g.fillStyle = PAL.mane; g.beginPath(); g.ellipse(foot[0], foot[1] - 4, 11, 6, 0, 0, TAU); g.fill();
    if (h.bandageLeg && i === 2) { g.fillStyle = PAL.white; g.fillRect(mid[0] - 10, mid[1] - 6, 20, 12); g.fillStyle = PAL.heart; g.fillRect(mid[0] - 2, mid[1] - 6, 4, 12); }
    g.restore();
    feet.push([foot[0] + h.x, planted]);
  }
  g.translate(0, bob);
  const body = blob(0, -152, 112, 52, { seed: 9001, amp: 0.02 });
  cut(g, ribbon([[-104, -160], [-140, -150 + Math.sin(T * 9) * 6], [-160, -118 + Math.sin(T * 9 + 1) * 8]], (k) => 14 * (1 - k * 0.5)), PAL.mane);
  cut(g, body, PAL.horse, { rim: PAL.white });
  shade(g, body, PAL.horseShade, 0, -200, 0, -100, 0, 0.8);
  const neck = poly([[58, -176], [118, -258], [156, -262], [128, -196], [104, -132]], { seed: 9002, round: 0.6, amp: 1, step: 20 });
  cut(g, neck, PAL.horse);
  cut(g, ribbon([[64, -186], [96, -232], [124, -262]], (k) => 12 * (1 - k * 0.3)), PAL.mane);
  const head = blob(160, -250, 46, 25, { seed: 9003, rot: 0.55 });
  cut(g, head, PAL.horse);
  g.fillStyle = PAL.ink; g.beginPath(); g.ellipse(160, -264, 4, 5, 0, 0, TAU); g.fill();
  if (h.noseBandage) { g.fillStyle = PAL.white; g.save(); g.translate(186, -232); g.rotate(0.6); g.fillRect(-9, -4, 18, 8); g.restore(); }
  if (h.icicles > 0) { g.fillStyle = rgba(PAL.ice, h.icicles); for (let i = 0; i < 5; i++) { const x = 70 + i * 12, y = -192 - i * 13; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x, y + 18 * h.icicles); g.lineTo(x + 4, y); g.fill(); } }
  g.restore();
  return feet;
}
function drawRiderPH(g, st, T) {
  const h = st.horse;
  const pose = typeof st.pose === 'string' ? st.pose : st.pose.to;
  const riding = pose !== 'walk' && pose !== 'dismount';
  const x = riding ? h.x : st.x, y = riding ? h.y - 205 : st.y;
  g.save();
  g.translate(x, y);
  const lean = pose === 'rideLean' ? 0.45 : pose === 'rideHunch' ? 0.3 : pose === 'rideSlash' ? -0.2 : pose === 'sneeze' ? -0.25 : 0;
  g.rotate(lean);
  // 围巾拖尾
  const sc = st.scarf, len = 640;
  const pts = [];
  for (let k = 0; k <= 16; k++) {
    const t = k / 16, fr = sc.frozen;
    const wav = Math.sin(T * 9 - k * 0.7) * (5 + k * 2.2) * (1 - fr);
    pts.push([-10 - t * len, -118 + t * t * 40 * (1 - fr) + wav]);
  }
  const sp = ribbon(pts, (t) => 15 * (1 - t * 0.35));
  g.save();
  if (sc.notch) { g.beginPath(); g.rect(-2000, -2000, 4000, 4000); g.moveTo(-10 - len - 6, -118 + 40); g.lineTo(-10 - len + 34, -118 + 36); g.lineTo(-10 - len - 6, -118 + 22); g.closePath(); }
  cut(g, sp, PAL.scarf, { rim: rgba(PAL.goldLight, sc.glow), rimW: 2 });
  if (sc.hole) { g.fillStyle = mixHex(PAL.scarfDark, PAL.ink, 0.3); g.beginPath(); g.ellipse(-10 - len * 0.45, -118 + 0.2 * 40 + Math.sin(T * 9 - 7) * 10, 7, 5, 0, 0, TAU); g.fill(); }
  if (sc.frozen > 0.5) { g.fillStyle = PAL.ice; for (let i = 1; i < 10; i++) { const [px, py] = pts[i]; g.beginPath(); g.moveTo(px - 4, py + 10); g.lineTo(px, py + 26); g.lineTo(px + 4, py + 10); g.fill(); } }
  g.restore();
  // 身体
  if (!riding) { g.strokeStyle = PAL.boot; g.lineWidth = 16; g.lineCap = 'round'; const sw = Math.sin(T * 9); g.beginPath(); g.moveTo(-8, -70); g.lineTo(-8 + sw * 22, 0); g.moveTo(8, -70); g.lineTo(8 - sw * 22, 0); g.stroke(); }
  else { g.strokeStyle = PAL.boot; g.lineWidth = 15; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -70); g.lineTo(26, -20); g.lineTo(18, 14); g.stroke(); }
  const torso = rr(-26, -142, 52, 78, 20);
  cut(g, torso, PAL.heroBlue, { rim: mixHex(PAL.heroBlue, PAL.white, 0.4) });
  g.fillStyle = PAL.leather; g.fillRect(-26, -84, 52, 10); g.fillStyle = PAL.gold; g.fillRect(-6, -85, 12, 12);
  if (st.torn) { g.fillStyle = PAL.skin; g.beginPath(); g.moveTo(14, -130); g.lineTo(26, -124); g.lineTo(18, -112); g.fill(); }
  const head = blob(4, -186, 48, 46, { seed: 9010 });
  cut(g, head, PAL.skin);
  cut(g, poly([[-44, -192], [-36, -230], [4, -242], [44, -226], [50, -196], [24, -214], [-10, -214]], { seed: 9011, round: 0.7, amp: 1, step: 12 }), st.singed ? mixHex(PAL.heroHair, PAL.ink, 0.35) : PAL.heroHair);
  g.fillStyle = PAL.ink; g.beginPath(); g.ellipse(22, -186, 4.3, 6.2, 0, 0, TAU); g.fill();
  g.fillStyle = PAL.white; g.beginPath(); g.arc(20.6, -188.5, 1.6, 0, TAU); g.fill();
  g.fillStyle = rgba(PAL.blush, 0.45); g.beginPath(); g.ellipse(26, -170, 9, 6, 0, 0, TAU); g.fill();
  if (st.bandages > 0) {
    g.save(); g.translate(-2, -176); g.rotate(0.5); g.fillStyle = PAL.paper2; g.fillRect(-14, -4, 28, 8); g.rotate(-1); g.fillRect(-14, -4, 28, 8); g.restore();
  }
  if (st.bump) { g.fillStyle = PAL.skinShade; g.beginPath(); g.arc(-12, -236, 10, 0, TAU); g.fill(); g.fillStyle = PAL.paper2; g.fillRect(-20, -239, 16, 5); g.fillRect(-14.5, -244, 5, 16); }
  if (st.snowCap > 0) { g.fillStyle = PAL.snow; g.fill(blob(0, -236 - 14 * st.snowCap, 40 * st.snowCap + 4, 16 * st.snowCap + 2, { seed: 9012 })); }
  if (st.bandages > 1) { g.fillStyle = PAL.paper2; g.fillRect(-30, -118, 18, 7); }
  g.restore();
}

// ———— 占位：HUD 角色卡 + 经验条 ————
function heartPath(x, y, s) {
  const p = new Path2D();
  p.moveTo(x, y + s * 0.35);
  p.bezierCurveTo(x - s * 0.1, y + s * 0.2, x - s * 0.55, y - s * 0.05, x - s * 0.5, y - s * 0.3);
  p.bezierCurveTo(x - s * 0.45, y - s * 0.6, x - s * 0.08, y - s * 0.6, x, y - s * 0.3);
  p.bezierCurveTo(x + s * 0.08, y - s * 0.6, x + s * 0.45, y - s * 0.6, x + s * 0.5, y - s * 0.3);
  p.bezierCurveTo(x + s * 0.55, y - s * 0.05, x + s * 0.1, y + s * 0.2, x, y + s * 0.35);
  return p;
}
function drawHudPH(g, T, hs) {
  if (hs.show > 0) {
    g.save();
    g.translate(-(1 - hs.show) * 560, 0);
    const card = poly([[96, 72], [600, 72], [600, 232], [96, 232]], { seed: 9101, amp: 1.2, step: 30 });
    cut(g, card, PAL.paper, { stroke: PAL.ink, lw: 4 });
    g.strokeStyle = PAL.kraftDark; g.lineWidth = 2; g.setLineDash([10, 8]); g.strokeRect(108, 84, 480, 136); g.setLineDash([]);
    cut(g, blob(170, 152, 58, 58, { seed: 9102 }), PAL.skyDayLow, { stroke: PAL.ink, lw: 3 });
    cut(g, blob(172, 160, 36, 34, { seed: 9103 }), PAL.skin);
    cut(g, blob(170, 134, 38, 18, { seed: 9104 }), PAL.heroHair);
    const name = [...NAMES.hero].slice(0, hs.nameReveal).concat(['…']);
    glyphRow(g, name, 244, 112, 30, { family: 'play', fill: PAL.ink, edge: null, align: 'left' });
    for (let i = 0; i < 5; i++) {
      const v = clamp(hs.hearts - i);
      const hx = 260 + i * 40 + (hs.heartShiver ? Math.sin(T * 60 + i) * 2.5 * hs.heartShiver : 0), hy = 156;
      const hp = heartPath(hx, hy, 32);
      g.fillStyle = PAL.paper2; g.fill(hp);
      if (v > 0) { g.save(); g.beginPath(); g.rect(hx - 20, hy - 30, 40 * v, 60); g.clip(); g.fillStyle = (i === Math.ceil(hs.hearts) - 1 && hs.heartFlash > 0) ? mixHex(PAL.heart, PAL.red, hs.heartFlash) : PAL.heart; g.fill(hp); g.restore(); }
      g.strokeStyle = PAL.ink; g.lineWidth = 2.4; g.stroke(hp);
    }
    glyphRow(g, [...`LV ${hs.lv}`], 474, 154, 30, { family: 'latin', weight: 700, fill: PAL.redDark, edge: null, align: 'left' });
    cut(g, blob(262, 200, 13, 13, { seed: 9105 }), PAL.coin, { stroke: PAL.coinDark, lw: 2.5 });
    glyphRow(g, [...`×${hs.coins}`], 284, 200, 28, { family: 'latin', weight: 600, fill: PAL.ink, edge: null, align: 'left' });
    cut(g, rr(372, 186, 26, 24, 6), PAL.leather, { stroke: PAL.woodDark, lw: 2 });
    glyphRow(g, [...`${hs.bag}`], 408, 200, 26, { family: 'latin', weight: 600, fill: PAL.ink, edge: null, align: 'left' });
    g.fillStyle = PAL.paper2; g.fillRect(452, 194, 128, 12); g.fillStyle = PAL.gold; g.fillRect(452, 194, 128 * hs.exp, 12); g.strokeStyle = PAL.ink; g.lineWidth = 2; g.strokeRect(452, 194, 128, 12);
    g.restore();
  }
  if (hs.expBig > 0) {
    g.save();
    const k = hs.expBig;
    g.translate(960, 155); g.scale(k, k); g.translate(-960, -155);
    cut(g, rr(552, 132, 816, 46, 23), PAL.paper, { stroke: PAL.ink, lw: 4, shadow: 8 });
    g.fillStyle = PAL.gold; g.fillRect(566, 145, 788 * hs.exp, 20);
    g.strokeStyle = PAL.ink; g.lineWidth = 2; g.strokeRect(566, 145, 788, 20);
    const sx = 566 + 788 * hs.exp;
    cut(g, blob(sx - 6, 132, 22, 16, { seed: 9106 }), mixHex(PAL.earth, PAL.sand, 0.4), { stroke: PAL.woodDark, lw: 2 });
    g.strokeStyle = PAL.woodDark; g.lineWidth = 2; g.beginPath(); g.arc(sx - 6, 132, 9, 0, TAU * 0.8); g.stroke();
    if (hs.snailCrown) { g.fillStyle = PAL.gold; g.beginPath(); g.moveTo(sx + 4, 112); g.lineTo(sx + 8, 102); g.lineTo(sx + 12, 110); g.lineTo(sx + 16, 100); g.lineTo(sx + 20, 112); g.fill(); }
    if (hs.levelUpAt != null && T - hs.levelUpAt < 0.6) { const a = (T - hs.levelUpAt) / 0.6; sparkle(g, 960, 120, 40 * Math.sin(a * Math.PI), { color: PAL.goldLight }); label(g, 'LV UP', 960, 90 - a * 20, 44, { family: 'latin', weight: 700, fill: PAL.gold, align: 'center' }); }
    g.restore();
  }
}

/** 一整帧（与正式镜头相同的图层配方）。tiled：缩略图里不再开图层。 */
function drawFrame(g, T, ctx, c, o = {}) {
  const st = heroJourneyState(T), hs = hudState(T);
  const L = (opt, fn) => (o.flat ? (g.save(), fn(g), g.restore()) : ctx.layer(g, opt, fn));
  drawJourney(g, T, c, { layer: 'sky' });
  L({ shadow: 4, texture: 0.22, texOffset: journeyTexOffset(c, 0.25) }, (lg) => drawJourney(lg, T, c, { layer: 'far' }));
  L({ shadow: 7, texture: 0.28, texOffset: journeyTexOffset(c, 0.8) }, (lg) => drawJourney(lg, T, c, { layer: 'mid' }));
  let feet = [];
  L({ shadow: 10, texture: 0.3, texOffset: journeyTexOffset(c, 1) }, (lg) => {
    drawJourney(lg, T, c, { layer: 'main' });
    lg.save(); applyCam(lg, c, 1);
    feet = drawHorsePH(lg, st, T);
    drawRiderPH(lg, st, T);
    lg.restore();
    drawJourney(lg, T, c, { layer: 'front' });
  });
  drawJourney(g, T, c, { layer: 'light' });
  L({ blur: 4, shadow: 12 }, (lg) => drawJourney(lg, T, c, { layer: 'fg' }));
  L({ blur: 6 }, (lg) => drawOccluder(lg, T, c));
  if (!o.noHud) L({ shadow: 8 }, (lg) => { drawHudPH(lg, T, hs); drawMiniMap(lg, T, hs.mini); });
  return { st, hs, feet };
}

const ZONE_NAMES = ['草原 G/M', '村庄 V', '风雪 S', '月光 N', '洞口 C'];
const TILES = [
  { T: 83.0, name: 'G/M 草原正午' }, { T: 91.0, name: 'V 金色午后村庄' }, { T: 95.5, name: 'S 风雪山口顶' },
  { T: 97.0, name: 'N 月光疾驰' }, { T: 98.7, name: 'C 洞口（白马躲岩石）' }, { T: 89.97, name: '换区：大橡树后 M→V' },
];

export default [
  {
    id: 'sheet_journey_zones', start: 0, end: 1,
    draw(g, T, lt, ctx) {
      paperBg(g);
      label(g, '旅途长卷 · 五区 + 换区（journey.js）', 96, 62, 40, { family: 'display', fill: PAL.redDark });
      const s = 0.29, tw = W * s, th = H * s;
      TILES.forEach((tl, i) => {
        const x = 96 + (i % 3) * (tw + 36), y = 110 + Math.floor(i / 3) * (th + 120);
        const Ti = tl.T + lt * 0.8;
        ctx.layer(g, { shadow: 8 }, (lg) => {
          lg.save();
          lg.beginPath(); lg.rect(x, y, tw, th); lg.clip();
          lg.translate(x, y); lg.scale(s, s);
          drawFrame(lg, Ti, ctx, journeyCam(Ti), { flat: true, noHud: false });
          lg.restore();
        });
        label(g, tl.name, x, y + th + 34, 30);
        const zs = journeyZones(journeyCam(Ti)).map((z) => ZONE_NAMES[z.z]).join(' | ');
        label(g, `T ${Ti.toFixed(2)}  ${zs}`, x, y + th + 72, 22, { fill: PAL.inkSoft, edge: null });
      });
    },
  },
  {
    id: 'sheet_journey_occluders', start: 1, end: 2,
    draw(g, T, lt, ctx) {
      paperBg(g);
      label(g, '换区遮挡物（屏幕空间，blur 交给图层）+ E03 倒放色带', 96, 62, 40, { family: 'display', fill: PAL.redDark });
      const kinds = ['gateArch', 'treeGag', 'oak', 'halfPine', 'snowCliff', 'blackTrunks'];
      const s = 0.2, tw = W * s, th = H * s;
      kinds.forEach((k, i) => {
        const x = 96 + i * (tw + 16), y = 110;
        const oc = JOURNEY.occluders.find((q) => q.kind === k);
        ctx.layer(g, { shadow: 6 }, (lg) => {
          lg.save(); lg.beginPath(); lg.rect(x, y, tw, th); lg.clip();
          lg.fillStyle = PAL.skyDayLow; lg.fillRect(x, y, tw, th);
          lg.translate(x, y); lg.scale(s, s);
          // 机位停在过中线那一刻
          drawOccluder(lg, oc.at, journeyCam(oc.at, { drift: false }), k);
          lg.restore();
        });
        label(g, k, x, y + th + 30, 24, { family: 'latin', weight: 600 });
        label(g, `${oc.at.toFixed(2)}s  D ${oc.D}`, x, y + th + 60, 20, { fill: PAL.inkSoft, edge: null });
      });
      label(g, 'rewindBand(g, T, p)：p = 0 / 0.33 / 0.66 / 1（夜 → 冷 → 金 → 绿 → 晨）', 96, 470, 30);
      [0, 0.33, 0.66, 1].forEach((p, i) => {
        const x = 96 + i * 440, y = 500, s2 = 0.21;
        ctx.layer(g, { shadow: 6 }, (lg) => {
          lg.save(); lg.beginPath(); lg.rect(x, y, W * s2, H * s2); lg.clip(); lg.translate(x, y); lg.scale(s2, s2);
          rewindBand(lg, 165.1 + lt * 0.5, p);
          lg.restore();
        });
      });
      // 动态：p 随时间走一遍
      const p = fract(lt);
      ctx.layer(g, { shadow: 6 }, (lg) => {
        lg.save(); const x = 96, y = 760, s3 = 0.22; lg.beginPath(); lg.rect(x, y, W * s3, H * s3); lg.clip(); lg.translate(x, y); lg.scale(s3, s3);
        rewindBand(lg, 165.1 + lt, p); lg.restore();
      });
      label(g, `动态 p = ${p.toFixed(2)}`, 96 + W * 0.22 + 30, 820, 28);
      // 小地图归程态
      const hs = hudState(165.1 + lt * 0.7);
      drawMiniMap(g, 165.1 + lt * 0.7, { ...hs.mini, rect: { x: 1100, y: 780, w: 300, h: 170 } });
      label(g, `归程小地图 r ${hs.mini.r.toFixed(2)} 金色`, 1100, 990, 24);
    },
  },
  {
    id: 'sheet_journey_hud', start: 2, end: 3,
    draw(g, T, lt, ctx) {
      paperBg(g);
      label(g, 'hudState(T) / heroJourneyState(T) 数值', 96, 62, 40, { family: 'display', fill: PAL.redDark });
      const ts = [86.6, 88.4, 89.8, 92.0, 98.0, 165.4];
      const cols = ['T', 'LV', '露字', '心', '金币', '背包', 'EXP', '放大', '小地图 r', '创可贴', '围巾'];
      cols.forEach((cname, i) => label(g, cname, 96 + i * 158, 140, 28, { fill: PAL.redDark }));
      ts.forEach((t, r) => {
        const hs = hudState(t), st = heroJourneyState(t), y = 210 + r * 80;
        const vals = [t.toFixed(2), `${hs.lv}`, `${hs.nameReveal}`, `${hs.hearts}`, `${hs.coins}`, `${hs.bag}`, hs.exp.toFixed(2), hs.expBig.toFixed(2), hs.mini.r.toFixed(3), `${st.bandages}`, `${st.scarf.notch ? '缺口' : '—'}${st.scarf.hole ? '+破洞' : ''}`];
        vals.forEach((v, i) => label(g, v, 96 + i * 158, y, 28, { family: i === 10 ? 'play' : 'latin', weight: 600, edge: null }));
      });
      // 预览：这几个时刻的 HUD 卡
      ts.slice(0, 4).forEach((t, i) => {
        const s = 0.42, x = 96 + i * 440, y = 720;
        g.save(); g.translate(x, y); g.scale(s, s); g.translate(-96, -72);
        drawHudPH(g, t, hudState(t));
        g.restore();
        label(g, `${t.toFixed(1)}s`, x, y + 100, 24, { family: 'latin', weight: 600 });
      });
    },
  },
  {
    // 时间轴空档（3–80）：只放索引页，免得体检报空镜
    id: 'sheet_journey_index', start: 3, end: 80,
    draw(g) {
      paperBg(g);
      label(g, '旅途模型图按真实时间轴取时刻', 96, 120, 44, { family: 'display', fill: PAL.redDark });
      label(g, '[0, 1) 五区 + 换区　　[1, 2) 遮挡物 + 倒放色带　　[2, 3) hudState 数值表', 96, 200, 28);
      label(g, '[80, 99.6) 全段一镜到底：sheet --sheet journey --from 80 --to 99.6 --every 0.25', 96, 250, 28);
    },
  },
  {
    id: 'sheet_journey_run', start: 80, end: 99.6,
    draw(g, T, lt, ctx) {
      const c = journeyCam(T);
      const zs = journeyZones(c);
      // 各区的整帧后期（storyboard 色彩剧本，镜头会自己设）
      const main = zs.reduce((a, b) => (b.x1 - Math.max(0, b.x0) > a.x1 - Math.max(0, a.x0) ? b : a), zs[0]).z;
      if (main === 1) { ctx.fx.tint = PAL.goldLight; ctx.fx.tintAlpha = 0.1; ctx.fx.tintMode = 'screen'; }
      if (main === 2) ctx.fx.sat = 0.75;
      if (main === 3) ctx.fx.bright = 0.92;
      if (main === 4) { ctx.fx.vignette = 0.5; ctx.fx.vignetteColor = PAL.dragonDeep; }
      if (main === 0) ctx.fx.sat = 1.08;
      const { feet } = drawFrame(g, T, ctx, c);
      // 推进洞口时把杏仁轮廓描一下（b09 的遮罩就是它）
      if (T > JOURNEY.push[0]) { g.save(); g.strokeStyle = rgba(PAL.magic, 0.6); g.lineWidth = 3; g.setLineDash([12, 10]); g.stroke(caveMouthPath(c)); g.restore(); }
      // 自检：勇者屏幕 x、着地蹄子的世界 x
      const st = heroJourneyState(T);
      const hx = 960 + (st.x - c.x) * c.zoom;
      g.save();
      g.fillStyle = rgba(PAL.ink, 0.55); g.fillRect(16, 1020, 900, 44);
      label(g, `勇者屏幕x ${hx.toFixed(0)}  马 ${typeof st.horse.pose === 'string' ? st.horse.pose : st.horse.pose.to}  着地蹄 ${feet.filter((f) => f[1]).map((f) => f[0].toFixed(0)).join(',')}`, 28, 1042, 24, { fill: PAL.paper, edge: null, family: 'play' });
      g.restore();
    },
  },
];
