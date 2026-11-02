// b01 · 绘本开场 [0.00, 10.00)（cue：intro，纯音乐段）。地点 BOOK（立体件 = CASTLE，同一个 drawCastle）。
// 一句话：台灯亮起，深红皮面书封烫金扫光，封面翻开，立体王国一层层立起，镜头推进书里的阳台。
// 交接 → b02（9.50–10.00）：b02 在 bookPageRect 遮罩里画 CASTLE 世界，机位 bookPushCam；本块照常画到 10.00，
// 天幕卡盖满屏（bookCardCovers）后只画立体件三组图层（LAYER_GROUPS），不加 drift、不改 ctx.fx（见 docs/api/castle.md 5.2 / 7）。
import { cue } from '../cues.js';
import { lerpCam } from '../core/camera.js';
import { clamp, lerp, seg, hit, pulse } from '../core/util.js';
import { ez, glide, inOutCubic, inOutSine, outQuad } from '../core/ease.js';
import { drawDesk, drawBook, bookPushCam, bookPopupAt, bookCardCovers, CAMS as BK } from '../env/book.js';
import { LAYER_GROUPS } from '../env/castle.js';
import { castleOpts } from './b01/shared.js';
import { liveCam, frameFx, lampGrade, coverFoil, gutterLight, openMotes, pushBokeh, popAccents, princessSparkle } from './b01/accents.js';

const I0 = cue('intro');
const at = (x) => I0 + x;

// ———————————————————— 时刻表（全部相对 intro） ————————————————————
const TT = {
  fade: [0, 1.2],          // 黑场淡入（outQuad）
  foil: [1.2, 2.4],        // 金箔扫光
  star: [2.4, 3.0],        // 「吧」右上四角星
  sub: [2.4, 4.2],         // 副标题逐字（0.2s 一字，9 字）
  subOut: [4.3, 4.5],
  tremble: 4.3,            // 整本书打哆嗦
  bookmark: 3.2,           // 书签抽动
  open: [3.7, 4.9],        // 封面翻开 θ 0→180°
  toSpread: [3.62, 5.2],   // BK-COVER → BK-SPREAD（略领先封面，见 bookCamAt）
  push: 8.2,               // 推镜进书（bookPushCam）
};

/** 台灯：0.05「咔」亮起，两次闪烁后在 0.9 稳定。 */
function lampAt(T) {
  const x = T - I0;
  if (x < 0.05) return 0;
  const base = lerp(0.55, 1, outQuad(seg(x, 0.05, 0.9)));
  return clamp(base * (1 - 0.55 * pulse(x, 0.17, 0.035) - 0.35 * pulse(x, 0.33, 0.03)));
}

/**
 * 书内机位（不含漂移）：BK-COVER（淡入时 1.00→1.04 轻贴近）→ BK-SPREAD → bookPushCam。
 * 翻开段机位略早于封面起步（3.62），途中多退半步（缩放 ×0.95 的弧），给翻过来的左页留出画框余量，5.20 落定 BK-SPREAD。
 */
export function bookCamAt(T) {
  if (T >= at(TT.push)) return bookPushCam(T);
  const creep = { ...BK.BK_COVER, zoom: lerp(1.0, BK.BK_COVER.zoom, inOutSine(seg(T, at(0), at(3.7)))) };
  const c = lerpCam(creep, BK.BK_SPREAD, ez(T, at(TT.toSpread[0]), at(TT.toSpread[1]), glide));
  const arc = Math.sin(Math.PI * seg(T, at(3.7), at(5.2))) ** 1.5;
  return arc > 0 ? { ...c, zoom: c.zoom * (1 - 0.05 * arc) } : c;
}

function coverAt(T) {
  const x = T - I0;
  return {
    foilSweep: 0, // book.js 自带扫光看不见（paperGlyph 局部坐标），由 coverFoil 在字形里补画
    star: seg(x, ...TT.star),
    subtitle: seg(x, ...TT.sub),
    subtitleAlpha: 1 - seg(x, ...TT.subOut),
    tremble: hit(x, TT.tremble, 0.22),
  };
}

function frame(g, T, ctx) {
  const c = liveCam(bookCamAt(T), T);
  const open = inOutCubic(seg(T, at(TT.open[0]), at(TT.open[1])));
  const lamp = lampAt(T);
  const castle = castleOpts(T);
  // 天幕卡盖满整屏后（约 9.45 起）书桌 / 书体 / 书签都在画外：只画立体件三组（交接期缓冲预算，画面与 b02 逐像素一致）
  const lean = T >= at(TT.push) && bookCardCovers(T, c);
  frameFx(ctx, T, lean);
  if (!lean) {
    drawDesk(g, T, c, { lamp });
    ctx.layer(g, { shadow: 14, texture: 0.3 }, (lg) => {
      const info = drawBook(lg, T, c, { layer: 'book', open, cover: coverAt(T), lamp, castle });
      coverFoil(lg, seg(T, at(TT.foil[0]), at(TT.foil[1])), c, info.titleCenters);
    });
    gutterLight(g, T, c);
  }
  if (open >= 0.999) {
    const popup = bookPopupAt(T);
    for (const [pop, fx] of LAYER_GROUPS) ctx.layer(g, fx, (lg) => drawBook(lg, T, c, { layer: 'popup', open, popup, castle, pop }));
  }
  if (lean) return;
  if (T > at(8.25) && T < at(9.3)) ctx.layer(g, { blur: 5 }, (lg) => pushBokeh(lg, T, c));
  popAccents(g, T, c);
  princessSparkle(g, T, c);
  lampGrade(g, T, c, lamp);
  ctx.layer(g, { shadow: 6, blur: 2 }, (lg) => {
    drawBook(lg, T, c, { layer: 'bookmark', open, bookmark: { wobbleAt: at(TT.bookmark) } });
    drawDesk(lg, T, c, { layer: 'dust', lamp: lamp * (1 - seg(T, at(8.2), at(9.2))) });
    openMotes(lg, T, c);
  });
}

export default [
  { id: 'b01_cover', start: at(0), end: at(4.9), draw(g, T, lt, ctx) { frame(g, T, ctx); } },
  { id: 'b01_popup', start: at(4.9), end: at(10.0), draw(g, T, lt, ctx) { frame(g, T, ctx); } },
];
