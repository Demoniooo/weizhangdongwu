// b03 · 招募、勇者到、高喊、立誓 [19.95, 34.10)（cue：L06 L07 L08 L09 L10 L11 L12）。地点 PLAZA → MAP（蜡笔版）。
// 一句话：告示「勇者招募」拍上木板，众人齐退一步空出一块地，风滚草滚过；云缝漏光，勇者跪滑进光圈被自己的围巾缠了一脸；
// 一声大喊吹飞所有人的帽子，告示扑向镜头翻面成蜡笔地图；红蜡笔画出四个誓言，每个图标正好在自己的 cue 上立起，国王在画面下沿偷看。
// 入场 ← b02（19.95–20.10）：本块画竖向甩镜帘（镜头向下甩，速度线带由下往上 = whipCurtain from:'bottom'）。
// 出场 → b04（33.60–34.10）：b04 画心形遮罩；本块照常画到 34.10，机位已落在 MAP_END，涂满的心在屏幕 (1100,600)、高 300。
import { PAL, mixHex } from '../core/paper.js';
import { lerp, seg } from '../core/util.js';
import { toScreen } from '../core/camera.js';
import { whipCurtain } from '../fx/transitions.js';
import { drawCrayonMap } from '../env/map.js';
import { B_START, WHIP_END, B_END, HANDOFF, L07, L08, L09, TT } from './b03/timing.js';
import { plazaFrame, plazaCam } from './b03/plaza.js';
import { mapFrame, mapCam, mapState } from './b03/map.js';
import { noticeFlight, noticeCovers, drawFlyingNotice, SE } from './b03/notice.js';

const GRAY_BLUE = mixHex(PAL.skyDay, PAL.stone2, 0.6); // 颜色桥：灰蓝天 / stone

// 告示撕下那一刻的屏幕起点（广场机位下的告示板中心）与落定转角（= 地图机位滚转）
const C_TEAR = plazaCam(TT.tear);
const START = [...toScreen(C_TEAR, 1, 1080, 560), C_TEAR.zoom];
const C_LAND = mapCam(L09);

/** 纸背：在告示局部坐标里画地图，使 25.35 落定时与地图镜头首帧一致（推导见 b03/notice.js 文件头）。 */
function noticeBack(T) {
  return (bg) => {
    bg.scale(C_LAND.zoom / SE, C_LAND.zoom / SE);
    bg.translate(-C_LAND.x, -C_LAND.y);
    drawCrayonMap(bg, T, mapState(T));
  };
}

function shoutFrame(g, T, ctx) {
  const st = noticeFlight(T, START, C_LAND.rot);
  if (!noticeCovers(st)) plazaFrame(g, T, ctx);
  else { g.fillStyle = PAL.kraft; g.fillRect(-40, -40, 2000, 1160); }
  if (st) {
    const lift = seg(T, TT.tear, TT.cover);
    ctx.layer(g, { shadow: lerp(4, 22, lift), texture: 0.3 }, (lg) => drawFlyingNotice(lg, T, st, noticeBack(T)));
  }
}

export default [
  {
    // 甩镜帘：b02 照常画在下面，带由下往上扫，带下方是灰蓝广场（机位从高处减速落到 PL-W）
    id: 'b03_whip_in', start: B_START, end: WHIP_END, z: 1,
    draw(g, T, lt, ctx) {
      whipCurtain(ctx, g, T, { t0: B_START, t1: WHIP_END, from: 'bottom', colors: [GRAY_BLUE, PAL.stone] }, (g2) => plazaFrame(g2, T, ctx, { lean: true }));
    },
  },
  { id: 'b03_recruit', start: WHIP_END, end: L07, draw(g, T, lt, ctx) { plazaFrame(g, T, ctx); } },
  { id: 'b03_arrive', start: L07, end: L08, draw(g, T, lt, ctx) { plazaFrame(g, T, ctx); } },
  { id: 'b03_shout', start: L08, end: L09, draw(g, T, lt, ctx) { shoutFrame(g, T, ctx); } },
  { id: 'b03_map', start: L09, end: B_END, draw(g, T, lt, ctx) { mapFrame(g, T, ctx, { lean: T >= HANDOFF }); } },
];
