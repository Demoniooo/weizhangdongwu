// b06 私有：王国地图（66.40–74.45）。卡背放大成第一片折页 → 风琴折翻开 → 摊平扬灰 → 地标弹起 + 城名环 →
// 小骑士画红虚线（机位 1.6 跟笔头）→ 任务图钉 → 拉回全图（罗盘转、金光扫）→ 一头扎进王城图标（与 b07 的红带对位）。
import { PAL } from '../../core/paper.js';
import { clamp, lerp, seg, TAU } from '../../core/util.js';
import { ez, glide, outCubic, inOutCubic, inExpo, outBack } from '../../core/ease.js';
import { cam, applyCam, lerpCam } from '../../core/camera.js';
import { drawParchmentMap, drawMapCover, PARCHMENT, MAP_ORDER, MAP_ROUTE_R, mapRoute, mapToScreen, mapRoutePoints } from '../../env/map.js';
import { characterCard } from '../../ui/kit.js';
import { drawCrown } from '../../props/royal.js';
import { TT, camDrift, lerpRect, drawTitlePage } from './common.js';
import { drawTitleScene } from './titlepage.js';
import { drawCards, cardState, ORDER, crownAt } from './cards.js';

const R = MAP_ROUTE_R;
const PASS = TT.pass;
/** 笔头（红虚线前端）沿路线的 r：每段在 PASS[i] → PASS[i+1] 之间半缓动半匀速走完。 */
export function routeR(T) {
  if (T < PASS[0]) return 0;
  for (let i = 0; i < 5; i++) if (T < PASS[i + 1]) {
    const k = seg(T, PASS[i], PASS[i + 1]);
    return lerp(R[MAP_ORDER[i]], R[MAP_ORDER[i + 1]], glide(k) * 0.5 + k * 0.5);
  }
  return 1;
}

// —— 收尾对位：b07 用 props/scarf.drawScarfBand 默认几何（中心 (960,540)、角 −0.42、宽 110 = lw 8 × 13.75、周期 = 34 × 13.75）画合拢的红带。
//    本块 74.10 的机位让王城起点处的一段红虚线正好落在这条带上：虚线第 4 段（弧长 112–132，段心 122？）——取段心 s = 34k + 10。
const DASH_S = 146;              // 选中的虚线段心弧长（王城城名环外第一段完整的虚线；段 i 占 [34i, 34i+20]，段心 34i+10）
const FINAL = (() => {
  const pts = mapRoutePoints('parchment', 0, 0.2);
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = (s) => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const k = (s - L[i - 1]) / (L[i] - L[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; };
  const p = at(DASH_S), a = at(DASH_S - 34), b = at(DASH_S + 34);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const zoom = 110 / 8;
  return { x: p[0], y: p[1], zoom, rot: -0.42 - ang };
})();
export const MAP_FINAL_CAM = cam(FINAL.x, FINAL.y, FINAL.zoom, FINAL.rot);

/** 机位：全图 → 跟笔头 1.6 → 拉回 → 扎进王城图标（焦点在屏幕上匀速移到中心、zoom 按指数涨、转角跟着转）。 */
export function mapCam(T) {
  const full = cam(960, 540, 1, 0);
  const [px, py] = mapToScreen('parchment', ...mapRoute(routeR(T - 0.12)));
  const wob = Math.sin(T * 1.7) * 0.03 * ez(T, PASS[0], PASS[0] + 0.4) * (1 - ez(T, PASS[5] - 0.2, PASS[5] + 0.2));
  const follow = cam(clamp(px, 560, 1360), clamp(py, 340, 740), 1.6, wob);
  let c = lerpCam(full, follow, ez(T, PASS[0] - 0.15, PASS[0] + 0.75, glide) * (1 - ez(T, TT.pull0, TT.dive0, glide)));
  // 68.00–68.60 摊平后略推近一点，地标弹起时有呼吸
  c = lerpCam(c, cam(960, 560, 1.06, 0), ez(T, TT.flat, TT.flat + 0.5, glide) * (1 - ez(T, PASS[0] - 0.15, PASS[0] + 0.75, glide)));
  if (T >= TT.dive0) {
    const z0 = c.zoom, z1 = FINAL.zoom;
    const e = inExpo(seg(T, TT.dive0, TT.dive1)) * 0.985 + seg(T, TT.dive0, TT.dive1) * 0.015;
    const z = z0 * Math.pow(z1 / z0, e);
    const w = (1 - z0 / z) / (1 - z0 / z1);
    const rk = inOutCubic(seg(T, TT.dive0 + 0.15, TT.dive1));
    c = cam(lerp(c.x, FINAL.x, w), lerp(c.y, FINAL.y, w), z, lerp(c.rot || 0, FINAL.rot, rk));
  }
  // 风琴折展开时地图与桌面（屏幕空间的片名页、牌、王冠）同框，机位不漂；68.30 摊平后漂移渐入，扎进王城时渐出（对位 b07）
  return camDrift(c, T, seg(T, TT.flat + 0.3, TT.flat + 0.9) * (1 - seg(T, TT.dive0, TT.dive1 - 0.1)));
}
export function mapState(T) {
  return {
    unfold: seg(T, TT.unfold0, TT.flat), dustAt: TT.flat,
    landmarks: MAP_ORDER.map((_, i) => seg(T, TT.flat + 0.08 * i, TT.flat + 0.32 + 0.08 * i)),
    bounce: PASS, ring: seg(T, TT.flat + 0.1, TT.flat + 0.6), route: routeR(T), pin: seg(T, TT.pin, TT.pin + 0.6),
    compass: TAU * inOutCubic(seg(T, TT.pull0, TT.dive0)), sweep: seg(T, TT.pull0, TT.dive0),
  };
}

const FOLD0 = { x: 160, y: 90, w: 400, h: 900 };
/** 66.40–66.80：顶牌（卡背）放大成第一片折页。 */
function growingCover(lg, T) {
  const k = ez(T, TT.grow0, TT.unfold0, inOutCubic);
  const st = cardState(ORDER[3], TT.grow0);
  const card = { x: st.x - 150, y: st.y - 210, w: 300, h: 420 };
  const r = lerpRect(card, FOLD0, k);
  lg.save();
  lg.translate(r.x + r.w / 2, r.y + r.h / 2); lg.rotate(st.rot * (1 - k)); lg.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  if (k < 0.02) characterCard(lg, { x: st.x, y: st.y, rot: 0, flip: 0, t: T });
  else drawMapCover(lg, r);
  lg.restore();
}

/** 地图段整帧。 */
export function drawMapScene(g, T, ctx) {
  const c = mapCam(T);
  const early = T < TT.flat + 0.3;
  if (early) {
    // 片名页 + 剩下的牌 + 滚出去的王冠仍在桌面上，被展开的地图一片片盖住
    drawTitleScene(g, T, ctx, { shrink: 1 });
    drawCards(ctx, g, T, { skipTop: true });
  } else {
    ctx.layer(g, { texture: 0.32 }, (lg) => {
      lg.save(); applyCam(lg, c, 1);
      drawTitlePage(lg, T);
      lg.restore();
    });
  }
  ctx.layer(g, { shadow: 12, texture: 0.3 }, (lg) => {
    lg.save(); applyCam(lg, c, 1);
    if (T < TT.unfold0) growingCover(lg, T);
    else drawParchmentMap(lg, T, mapState(T));
    if (!early) {
      // 王冠还压在地图右下角外（国王卡掉出来的那顶）
      const cr = crownAt(T);
      drawCrown(lg, { x: cr.x, y: cr.y, rot: cr.rot, s: cr.s, t: T, F: 1 });
    }
    lg.restore();
  });
  ctx.fx.vignette = Math.max(ctx.fx.vignette ?? 0, 0.24 + 0.1 * seg(T, TT.dive0, TT.dive1));
}
void outCubic; void outBack; void PARCHMENT; void PAL;
