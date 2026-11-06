// 模型图：书桌与绘本、片名页（book）。
// 0–2s 网格（合书 / θ60° / θ120° / 开书 / 立起中 / 全部立起 / 片尾 / 关灯 / 片名页）；
// 之后是全分辨率排练：b01 开场（2–12.39 ↔ 0–10.39）、b02 侧的世界画面（20–30.39，供逐像素对比）、
// b17 合书片尾（40–49.1 ↔ 199.0–208.1）、片名页（60–64 ↔ 60.2–64.2）、空片名页（64–65）、
// b17 接缝前的世界夜景（50–51 ↔ 199.0–200.0，与 40.30 比 199.30 接缝帧）、
// b01→b02 交接排练（81.5–82 ↔ 9.50–10.00：b01 精简版 + b02 遮罩世界，与 11.50 / 11.75 / 11.99 逐像素比）、遮罩矩形示意（70–72）；
// 段间空档铺纸色底（book_gap_*）。核对结论记在 docs/api/castle.md 8.2。
import { PAL, blob, cut, rr } from '../core/paper.js';
import { cam, lerpCam } from '../core/camera.js';
import { clamp, seg, hit, wobble } from '../core/util.js';
import { glide, ez, inOutCubic, outQuad, inExpo } from '../core/ease.js';
import { glyphRow } from '../ui/type.js';
import { drawDesk, drawBook, drawTitlePage, bookPushCam, bookToCastleCam, bookCastleCam, bookPopupAt, bookPageRect, bookCardCovers, CAMS, BOOK } from '../env/book.js';
import { drawCastle, CAMS as CA, LAYER_GROUPS } from '../env/castle.js';

function label(g, text, x, y, size = 30, fill = PAL.ink) {
  glyphRow(g, [...text], x, y, size, { family: 'play', fill, edge: PAL.paper, edgeW: 0.14 });
}
function tile(g, x, y, s, title, draw) {
  g.save();
  g.translate(x, y);
  g.save(); g.translate(6, 8); g.fillStyle = 'rgba(43,26,36,0.25)'; g.fillRect(0, 0, 1920 * s, 1080 * s); g.restore();
  g.beginPath(); g.rect(0, 0, 1920 * s, 1080 * s); g.clip();
  g.scale(s, s);
  draw(g);
  g.restore();
  label(g, title, x + 6, y + 1080 * s + 20, 24);
}

// 阳台占位公主（s=0.26）
function princessDummy(g, info) {
  const x = 964, y = info.floorY, H = 250 * 0.26;
  g.save();
  g.translate(x, y);
  cut(g, blob(0, -H * 0.3, H * 0.26, H * 0.32, { seed: 3 }), PAL.princess);
  cut(g, blob(0, -H * 0.72, H * 0.2, H * 0.2, { seed: 4 }), PAL.skin);
  cut(g, blob(0, -H * 0.86, H * 0.21, H * 0.1, { seed: 5 }), PAL.hairGold);
  g.fillStyle = PAL.ink;
  g.beginPath(); g.ellipse(-H * 0.06, -H * 0.72, H * 0.018, H * 0.026, 0, 0, 7); g.ellipse(H * 0.06, -H * 0.72, H * 0.018, H * 0.026, 0, 0, 7); g.fill();
  g.restore();
}

// 立体件 / 世界共用的三组图层（b01 与 b02 交接期必须用同一套分组与参数）= castle.js 的 LAYER_GROUPS
const GROUPS = LAYER_GROUPS;

/** b01 排练：Tb ∈ [0, 10.39)。lean：天幕卡盖满屏后省掉书桌 / 书体 / 书签三层（交接期省缓冲，画面不变） */
function b01Frame(g, Tb, ctx, layers = true, lean = false) {
  const fadeIn = 1 - outQuad(seg(Tb, 0, 1.2));
  if (ctx) ctx.fx.fade = Math.max(ctx.fx.fade || 0, fadeIn);
  const lamp = seg(Tb, 0, 1.2);
  const open = inOutCubic(seg(Tb, 3.7, 4.9));
  const c = Tb < 8.2 ? lerpCam(CAMS.BK_COVER, CAMS.BK_SPREAD, ez(Tb, 3.7, 5.2, glide)) : bookPushCam(Tb);
  const cover = {
    foilSweep: seg(Tb, 1.2, 2.4),
    star: seg(Tb, 2.4, 3.0),
    subtitle: seg(Tb, 2.4, 4.2),
    subtitleAlpha: 1 - seg(Tb, 4.3, 4.5),
    tremble: hit(Tb, 4.3, 0.22),
  };
  const castle = { time: 'dawn', onBalcony: princessDummy };
  const popup = bookPopupAt(Tb);
  const L = (o, fn) => (layers && ctx ? ctx.layer(g, o, fn) : fn(g));
  const skip = lean && Tb >= 8.2 && bookCardCovers(Tb, c);
  if (!skip) drawDesk(g, Tb, c, { lamp });
  if (!skip) L({ shadow: 14, texture: 0.3 }, (lg) => drawBook(lg, Tb, c, { layer: 'book', open, cover, lamp, castle }));
  for (const [pop, fx] of GROUPS) L(fx, (lg) => drawBook(lg, Tb, c, { layer: 'popup', open, popup, castle, pop }));
  if (!skip) L({ shadow: 6, blur: 2 }, (lg) => {
    drawBook(lg, Tb, c, { layer: 'bookmark', open, bookmark: { wobbleAt: 3.2 } });
    drawDesk(lg, Tb, c, { layer: 'dust', lamp: lamp * (1 - seg(Tb, 8.2, 9.2)) });
  });
}

/** b02 侧：同一时刻直接画 CASTLE 世界（机位 = bookCastleCam(T) = bookToCastleCam(bookPushCam(T))） */
function worldFrame(g, Tb, ctx) {
  g.fillStyle = PAL.ink; g.fillRect(0, 0, 1920, 1080);
  worldLayers(g, Tb, ctx);
}
function worldLayers(g, Tb, ctx) {
  const c = bookCastleCam(Tb);
  const castle = { time: 'dawn', onBalcony: princessDummy };
  for (const [pop, fx] of GROUPS) ctx.layer(g, fx, (lg) => { for (const layer of pop) drawCastle(lg, Tb, c, { ...castle, layer }); });
}

/** b17 排练：Tc ∈ [199.0, 208.1) */
function b17Frame(g, Tc, ctx) {
  const castle = { time: 'night' };
  if (Tc < 199.3) {
    worldNight(g, Tc, ctx, CA.CA_W);
    return;
  }
  const close = Tc < 199.95 ? 0 : 1 - inExpo(seg(Tc, 199.95, 200.3));
  const open = Tc < 199.95 ? 1 : close;
  let c = bookPushCam(Tc);
  if (Tc >= 200.6) c = lerpCam(CAMS.BK_SPREAD, CAMS.BK_COVER, ez(Tc, 200.6, 201.6, glide));
  const slam = hit(Tc, 200.3, 0.18);
  ctx.fx.shake = [Math.sin(Tc * 90) * 16 * slam, Math.cos(Tc * 77) * 12 * slam];
  ctx.fx.fade = Math.max(ctx.fx.fade || 0, seg(Tc, 206.8, 208.1));
  const lampOn = Tc < 206.4 ? 1 : 0;
  if (!lampOn) ctx.fx.bright = 0.55;
  const cover = {
    foilSweep: seg(Tc, 202.2, 202.9),
    star: seg(Tc, 202.85, 203.4),
    subtitle: Tc >= 206 ? Math.min(3, (Tc - 206) / 0.2 + 1) / 9 : 0,
    tremble: Tc >= 206.2 && Tc < 206.5 ? 0.8 : hit(Tc, 206.5, 0.2) * 0.8,
    gleam: lampOn ? 0 : 1,
  };
  const label = Tc < 202.8 ? 0 : { p: seg(Tc, 202.8, 203.2), lines: [seg(Tc, 203.3, 203.6), seg(Tc, 203.6, 203.9), seg(Tc, 203.9, 204.2), seg(Tc, 204.2, 204.5)] };
  const crawl = seg(Tc, 204.8, 205.8);
  const lizard = Tc < 204.8 ? null : crawl < 1
    ? { x: 1860 - 150 * crawl, y: 880 - 330 * crawl, pose: 'crawl', face: -1 }
    : { pose: 'sleep', eye: Tc > 206.6 && Tc < 206.95 ? 1 : 0, zzz: 1 };
  const fold = seg(Tc, 199.75, 199.95);
  drawDesk(g, Tc, c, { lamp: lampOn });
  ctx.layer(g, { shadow: 14, texture: 0.3 }, (lg) => drawBook(lg, Tc, c, { layer: 'book', open, cover, lamp: lampOn, castle, label, lizard }));
  if (open >= 0.999) for (const [pop, fx] of GROUPS) ctx.layer(g, fx, (lg) => drawBook(lg, Tc, c, { layer: 'popup', open, fold, castle, pop }));
  ctx.layer(g, { shadow: 6, blur: 2 }, (lg) => {
    drawBook(lg, Tc, c, { layer: 'bookmark', open, bookmark: { wobbleAt: 200.3, extra: Tc >= 200.3 ? 'scroll' : undefined, roll: seg(Tc, 200.4, 201.2) } });
    // 浮尘随书页入画再淡入（199.30 接缝帧与世界画面一致）
    drawDesk(lg, Tc, c, { layer: 'dust', lamp: lampOn * seg(Tc, 199.36, 199.66) });
  });
}
function worldNight(g, Tc, ctx, c) {
  g.fillStyle = PAL.ink; g.fillRect(0, 0, 1920, 1080);
  for (const [pop, fx] of GROUPS) ctx.layer(g, fx, (lg) => { for (const layer of pop) drawCastle(lg, Tc, c, { time: 'night', layer }); });
}

const shots = [
  {
    id: 'book_grid', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080);
      label(g, 'book.js 书桌与绘本 —— 合书 / 翻开 / 立起 / 片尾 / 片名页（模型图）', 40, 30, 28);
      const s = 0.27, gx = 120, gy = 66, dx = 1920 * s + 40, dy = 1080 * s + 44;
      const items = [
        ['合书：扫光 + 星 + 副标题挤扁', (tg) => { drawDesk(tg, T, CAMS.BK_COVER, { lamp: 1 }); drawBook(tg, T, CAMS.BK_COVER, { layer: 'all', cover: { foilSweep: (T % 1.2) / 1.2, star: clamp(T / 1.2), subtitle: clamp(T / 1.8) }, bookmark: { wobbleAt: 0.4 } }); }],
        ['θ = 60°', (tg) => { const c = lerpCam(CAMS.BK_COVER, CAMS.BK_SPREAD, 0.4); drawDesk(tg, T, c, { lamp: 1 }); drawBook(tg, T, c, { layer: 'all', open: 1 / 3, castle: { time: 'dawn' } }); }],
        ['θ = 120°', (tg) => { const c = lerpCam(CAMS.BK_COVER, CAMS.BK_SPREAD, 0.7); drawDesk(tg, T, c, { lamp: 1 }); drawBook(tg, T, c, { layer: 'all', open: 2 / 3, castle: { time: 'dawn' } }); }],
        ['开书 popup 0（页上印的黎明天 + 远山）', (tg) => { drawDesk(tg, T, CAMS.BK_SPREAD, { lamp: 1 }); drawBook(tg, T, CAMS.BK_SPREAD, { layer: 'all', open: 1, popup: 0, castle: { time: 'dawn' } }); }],
        ['立起中（b01 的 5.0–6.6 时刻表）', (tg) => { drawDesk(tg, T, CAMS.BK_SPREAD, { lamp: 1 }); drawBook(tg, T, CAMS.BK_SPREAD, { layer: 'all', open: 1, popup: bookPopupAt(5.0 + (T / 2) * 1.6), castle: { time: 'dawn' } }); }],
        ['popup 1 全部立起 + 公主', (tg) => { drawDesk(tg, T, CAMS.BK_SPREAD, { lamp: 1 }); drawBook(tg, T, CAMS.BK_SPREAD, { layer: 'all', open: 1, popup: 1, castle: { time: 'dawn', onBalcony: princessDummy } }); }],
        ['片尾：署名贴签 + 小蜥蜴 + 卷轴尾', (tg) => { drawDesk(tg, T, CAMS.BK_COVER, { lamp: 1 }); drawBook(tg, T, CAMS.BK_COVER, { layer: 'all', label: { p: 1, lines: [1, 1, 1, clamp(T / 2)] }, lizard: { pose: 'sleep', zzz: 1 }, bookmark: { extra: 'scroll', roll: 1 } }); }],
        ['关灯（副标题又写了 3 字，蜥蜴睁一只眼）', (tg) => { drawDesk(tg, T, CAMS.BK_COVER, { lamp: 0 }); drawBook(tg, T, CAMS.BK_COVER, { layer: 'all', lamp: 0, cover: { subtitle: 3 / 9, gleam: 1 }, label: 1, lizard: { pose: 'sleep', eye: 1, zzz: 0 }, bookmark: { extra: 'scroll', roll: 1 } }); tg.fillStyle = 'rgba(19,25,55,0.42)'; tg.fillRect(0, 0, 1920, 1080); }],
        ['片名页（三层纸叠字 + 光芒）', (tg) => drawTitlePage(tg, T, { title: { rise: [1, 1, clamp(T * 2 - 0.4), clamp(T * 2 - 0.8)], foil: (T % 1.4) / 1.4, star: clamp((T - 1) / 0.8) }, rays: 1 })],
      ];
      items.forEach(([title, fn], k) => tile(g, gx + (k % 3) * dx, gy + Math.floor(k / 3) * dy, s, title, fn));
    },
  },
  { id: 'book_b01', start: 2, end: 12.39, draw(g, T, lt, ctx) { b01Frame(g, T - 2, ctx); } },
  { id: 'book_world', start: 20, end: 30.39, draw(g, T, lt, ctx) { worldFrame(g, T - 20, ctx); } },
  { id: 'book_b17', start: 40, end: 49.1, draw(g, T, lt, ctx) { b17Frame(g, 199.0 + (T - 40), ctx); } },
  {
    id: 'book_title', start: 60, end: 64,
    draw(g, T, lt, ctx) {
      const Tt = 60.2 + (T - 60);
      const rise = [60.6, 60.75, 60.9, 61.05].map((t0) => seg(Tt, t0, t0 + 0.32));
      drawTitlePage(g, Tt, { title: { rise, foil: seg(Tt, 61.1, 61.6), star: seg(Tt, 61.6, 62.2), T: Tt }, rays: seg(Tt, 61.1, 61.5) });
    },
  },
  { id: 'book_title_blank', start: 64, end: 65, draw(g, T) { drawTitlePage(g, 60.2 + (T - 60), {}); } },
  {
    // b17 接缝核对：199.30 前的世界夜景（CA-W，无 drift），与 book_b17 同刻（T=40.30 ↔ 50.30）逐像素比较
    id: 'book_b17_world', start: 50, end: 51,
    draw(g, T, lt, ctx) { worldNight(g, 199.0 + (T - 50), ctx, CA.CA_W); },
  },
  {
    // b01→b02 交接排练（“b01+b02”）：b01 精简版 + b02 在 bookPageRect 遮罩里画世界；应与 book_b01 同刻逐像素一致
    // 对照：T=81.50 / 81.75 / 81.99 ↔ book_b01 的 11.50 / 11.75 / 11.99（Tb = 9.50 / 9.75 / 9.99）。
    // 时差 70s 是 1/3s 的整数倍：引擎后期颗粒按 floor(T·12)&3 换贴图，时差不对齐会整屏差 ±10。
    id: 'book_handoff', start: 81.5, end: 82,
    draw(g, T, lt, ctx) {
      const Tb = 9.5 + (T - 81.5);
      b01Frame(g, Tb, ctx, true, true);
      ctx.mask(g, (mg) => { const r = bookPageRect(Tb); mg.fillRect(r.x, r.y, r.w, r.h); }, (lg) => worldLayers(lg, Tb, ctx));
    },
  },
  {
    // 交接遮罩示意：bookPageRect 画成描边
    id: 'book_rect', start: 70, end: 72,
    draw(g, T, lt, ctx) {
      const Tb = 9.0 + (T - 70) * 0.5;
      b01Frame(g, Tb, ctx, false);
      const r = bookPageRect(Tb);
      g.strokeStyle = PAL.heart; g.lineWidth = 6; g.setLineDash([24, 14]);
      g.strokeRect(r.x, r.y, r.w, r.h);
      g.setLineDash([]);
      label(g, `bookPageRect(${Tb.toFixed(2)})`, 40, 60, 34, PAL.ink);
    },
  },
];

// 段间空档铺纸色底（check.mjs 在整段时长里均匀取样，不留空镜）
[[12.39, 20], [30.39, 40], [49.1, 50], [51, 60], [65, 70], [72, 81.5]].forEach(([a, b], k) => {
  shots.push({ id: `book_gap_${k}`, start: a, end: b, draw(g) { g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080); label(g, `book 模型图 · 段间空档 ${a}–${b}`, 40, 60, 30); } });
});

export default shots;
void BOOK; void rr; void wobble; void bookToCastleCam;
