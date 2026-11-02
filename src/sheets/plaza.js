// 模型图：城下广场（src/env/plaza.js）。渲染：
//   node tools/render.mjs stills --sheet plaza --times 0.5,1.5,2.5,3.45,3.6,4.8,5.1 --outdir out/review/sheets/plaza
//   node tools/render.mjs sheet --sheet plaza --from 0 --to 2 --every 0.1 --cols 7 --tile 360 --out out/review/sheets/plaza/anim.jpg
// [0,1) 灰蓝 / 光柱 / 晴晨 同机位 PL-W + 远景小国王四姿势放大｜[1,2) 前景城门拱扫过中线三帧（左墩以左 PLAZA、以右示意 JOURNEY）+ PL-BOARD / PL-HERO-CU / PL-GATE
// [2,3) PL-W 站位标注｜[3,6) 动态：PL_TOP 落到 PL-W → 告示拍上板（noticeOpts：unroll + pins + squash）→ 云缝裂开光柱落下 → 推到 PL-HERO → 喊声冲击（彩旗、木桶、花瓣）
import { PAL, rr, cut, blob, lin } from '../core/paper.js';
import { cam, applyCam, lerpCam, toScreen } from '../core/camera.js';
import { clamp, rgba, mixHex, TAU } from '../core/util.js';
import { glide, ez, whip } from '../core/ease.js';
import { glyphRow } from '../ui/type.js';
import { drawPlaza, drawGateArch, PLAZA, CAMS, PLAZA_LAYER } from '../env/plaza.js';

function label(g, text, x, y, size = 28, o = {}) {
  glyphRow(g, [...text], x, y, size, { family: 'play', fill: PAL.ink, edge: PAL.paper, edgeW: 0.18, gap: size * 0.04, ...o });
}
function tag(g, text, x, y, size = 24) {
  const w = [...text].length * size * 0.86 + 26;
  cut(g, rr(x, y - size * 0.8, w, size * 1.6, 8), PAL.paper, { shadow: 3, stroke: PAL.ink, lw: 2.5 });
  label(g, text, x + 13, y, size, { edge: null });
}
function standee(g, x, y, h, hr, col) {
  g.save();
  g.setLineDash([9, 7]); g.lineWidth = 3; g.strokeStyle = rgba(col, 0.95); g.fillStyle = rgba(col, 0.12);
  const bw = h * 0.36;
  g.beginPath(); g.roundRect(x - bw / 2, y - h + hr * 2 - 4, bw, h - hr * 2 + 4, bw * 0.3); g.fill(); g.stroke();
  g.beginPath(); g.arc(x, y - h + hr, hr, 0, TAU); g.fill(); g.stroke();
  g.restore();
}
const bg = (g) => { g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080); };
const grid = (cols, rows, x0 = 24, y0 = 72, gap = 16) => {
  const W = 1920 - x0 * 2, H = 1080 - y0 - 12;
  const cw = Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) * 16 / 9), ch = cw * 9 / 16;
  const ox = (1920 - (cw * cols + gap * (cols - 1))) / 2;
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([ox + c * (cw + gap), y0 + r * (ch + gap), cw, ch]);
  return out;
};
const ORDER = ['sky', 'far', 'mid', 'main', 'chars', 'light', 'fg'];
/** 整张广场画进 rect 小格；chars(g) 画在主体层之后（已是小格坐标 = 屏幕坐标）。 */
function scene(ctx, g, T, rect, c, o = {}, chars = null, skip = []) {
  const [x, y, w, h] = rect, s = w / 1920;
  const tf = (lg) => { lg.beginPath(); lg.rect(x, y, w, h); lg.clip(); lg.translate(x, y); lg.scale(s, h / 1080); };
  for (const L of ORDER) {
    if (skip.includes(L)) continue;
    if (L === 'chars') { if (chars) { g.save(); tf(g); chars(g); g.restore(); } continue; }
    if (L === 'sky' || L === 'light') { g.save(); tf(g); drawPlaza(g, T, c, { ...o, layer: L }); g.restore(); continue; }
    const lo = PLAZA_LAYER[L];
    ctx.layer(g, { ...lo, blur: lo.blur ? lo.blur * s : 0, shadow: lo.shadow ? lo.shadow * s : 0 }, (lg) => { lg.save(); tf(lg); drawPlaza(lg, T, c, { ...o, layer: L }); lg.restore(); });
  }
  g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 3; g.strokeRect(x, y, w, h); g.restore();
}
const withCam = (g, c, depth, fn) => { g.save(); applyCam(g, c, depth); fn(g); g.restore(); };
const crowd = (g) => {
  standee(g, 520, 860, 260, 52, PAL.heroBlue);
  for (const [i, x] of [640, 700, 770, 840, 1240, 1320, 1400, 1470].entries()) standee(g, x, 860, 150 + (i % 3) * 18, 34, [PAL.princess, PAL.meadow, PAL.skyDay, PAL.gold][i % 4]);
  standee(g, PLAZA.herald, 860, 185, 38, PAL.heroBlueDark);
};

export default [
  // ———— [0,1) 三个时段 + 远景小国王 ————
  {
    id: 'sheet_plaza_times', start: 0, end: 1,
    draw(g, T, lt, ctx) {
      bg(g);
      label(g, '城下广场 PLAZA · 三个时段（同机位 PL-W）+ 远景阳台小国王', 30, 40, 34);
      const cells = grid(2, 2);
      scene(ctx, g, T, cells[0], CAMS.PL_W, { time: 'gray', notice: 'full', farKing: 'holdHead', beaconAt: [-1, -1] }, (q) => withCam(q, CAMS.PL_W, 1, crowd));
      scene(ctx, g, T, cells[1], CAMS.PL_W, { time: 'beam', beamAt: -1, notice: 'full', farKing: 'leanForward', lightCircle: 1, beaconAt: [-1, -1] }, (q) => withCam(q, CAMS.PL_W, 1, crowd));
      scene(ctx, g, T, cells[2], CAMS.PL_W, { time: 'morning', notice: 'corners', farKing: 'wave' }, (q) => withCam(q, CAMS.PL_W, 1, (qq) => standee(qq, 560, 860, 260, 52, PAL.heroBlue)));
      // 小国王四姿势：放大 4 倍看清楚，下排是 PL-W 原尺寸
      {
        const r = cells[3];
        g.save(); g.fillStyle = mixHex(PAL.paper, PAL.paper2, 0.5); g.fillRect(...r); g.restore();
        const poses = ['holdHead', 'leanForward', 'beardFlip', 'wave'];
        poses.forEach((pose, i) => {
          const cw = r[2] / 4;
          const zr = [r[0] + cw * i + 6, r[1] + 44, cw - 12, r[3] * 0.56];
          const zr2 = [r[0] + cw * i + 6, zr[1] + zr[3] + 10, cw - 12, r[3] - zr[3] - 64];
          // 上：以阳台为中心放大 4 倍；下：PL-W 原尺寸（1:1 像素）
          for (const [rect, k] of [[zr, 4], [zr2, 1]]) {
            ctx.layer(g, { shadow: 2, texture: 0.2 }, (lg) => {
              lg.save(); lg.beginPath(); lg.rect(...rect); lg.clip();
              lg.fillStyle = PAL.skyDay; lg.fillRect(...rect);
              lg.translate(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2); lg.scale(k, k); lg.translate(-PLAZA.castle.x - 20, -PLAZA.castle.y + 6);
              drawPlaza(lg, T, CAMS.PL_W, { layer: 'far', time: 'morning', farKing: pose });
              lg.restore();
            });
            g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 2; g.strokeRect(...rect); g.restore();
          }
          label(g, pose, zr[0] + 6, zr[1] + 18, 18);
        });
        tag(g, '远景小国王（far 层，PL-W 下约 30px）放大', r[0] + 12, r[1] + 26, 20);
        g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 3; g.strokeRect(...r); g.restore();
      }
      const names = ['灰蓝 gray · notice:full · 国王抱头', '光柱 beam · lightCircle 1 · 国王探身', '晴晨 morning · notice:corners · 挥手帕'];
      names.forEach((n, i) => tag(g, n, cells[i][0] + 12, cells[i][1] + 28, 20));
    },
  },
  // ———— [1,2) 前景城门拱 + 机位 ————
  {
    id: 'sheet_plaza_gate', start: 1, end: 2,
    draw(g, T, lt, ctx) {
      bg(g);
      label(g, '前景城门拱扫过中线（盖满全高）· PL-BOARD / PL-HERO-CU / PL-GATE', 30, 40, 34);
      const cells = grid(3, 2);
      [1500, 960, 420].forEach((ax, i) => {
        const r = cells[i], s = r[2] / 1920;
        // 接缝 = 左墩中线：左边广场、右边示意旅途（纯色天 + 草坡）
        ctx.mask(g, (mg) => { mg.fillRect(r[0], r[1], (ax) * s, r[3]); }, (lg) => scene(ctx, lg, T, r, CAMS.PL_GATE, { time: 'morning', notice: 'corners' }));
        ctx.mask(g, (mg) => { mg.fillRect(r[0] + ax * s, r[1], r[2] - ax * s, r[3]); }, (lg) => {
          lg.save(); lg.beginPath(); lg.rect(...r); lg.clip();
          lg.fillStyle = lin(lg, 0, r[1], 0, r[1] + r[3], [PAL.skyDay, PAL.skyDayLow]); lg.fillRect(...r);
          lg.fillStyle = PAL.meadow; lg.fill(blob(r[0] + r[2] * 0.6, r[1] + r[3] * 1.05, r[2] * 0.7, r[3] * 0.4, { seed: 9 }));
          lg.restore();
        });
        ctx.layer(g, { blur: 3 * s, shadow: 14 * s }, (lg) => { lg.save(); lg.beginPath(); lg.rect(...r); lg.clip(); lg.translate(r[0], r[1]); lg.scale(s, s); drawGateArch(lg, T, { x: ax, time: 'morning' }); lg.restore(); });
        g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 3; g.strokeRect(...r);
        g.setLineDash([6, 5]); g.strokeStyle = PAL.red; g.beginPath(); g.moveTo(r[0] + 960 * s, r[1]); g.lineTo(r[0] + 960 * s, r[1] + r[3]); g.stroke(); g.restore();
        tag(g, `gateArch x=${ax}（红虚线 = 屏幕中线）`, r[0] + 10, r[1] + 26, 18);
      });
      scene(ctx, g, T, cells[3], CAMS.PL_BOARD, { time: 'gray', notice: 'full' });
      scene(ctx, g, T, cells[4], CAMS.PL_HERO_CU, { time: 'beam', beamAt: -1, lightCircle: 1 }, (q) => withCam(q, CAMS.PL_HERO_CU, 1, (qq) => standee(qq, 520, 860, 260, 52, PAL.heroBlue)));
      scene(ctx, g, T, cells[5], CAMS.PL_GATE, { time: 'morning', notice: 'corners' });
      ['PL-BOARD cam(1080,560,1.8)', 'PL-HERO-CU cam(560,640,3.4)', 'PL-GATE cam(1500,560,1.2)'].forEach((n, i) => tag(g, n, cells[3 + i][0] + 10, cells[3 + i][1] + 26, 18));
    },
  },
  // ———— [2,3) 站位标注 ————
  {
    id: 'sheet_plaza_spots', start: 2, end: 3,
    draw(g, T, lt, ctx) {
      const c = CAMS.PL_W;
      scene(ctx, g, T, [0, 0, 1920, 1080], c, { time: 'morning', notice: 'corners', farKing: 'wave' }, (q) => withCam(q, c, 1, (qq) => {
        crowd(qq);
        qq.strokeStyle = rgba(PAL.red, 0.8); qq.lineWidth = 2; qq.setLineDash([12, 8]);
        qq.beginPath(); qq.moveTo(-100, 860); qq.lineTo(2100, 860); qq.stroke();
      }));
      const pin = (wx, wy, text, d = 1) => { const [sx, sy] = toScreen(c, d, wx, wy); g.save(); g.fillStyle = PAL.red; g.beginPath(); g.arc(sx, sy, 7, 0, TAU); g.fill(); g.restore(); label(g, text, sx + 12, sy - 18, 22); };
      pin(520, 866, '光圈 x=520'); pin(1080, 560, '告示板 (1080,560) 300×220'); pin(700, 780, '水井 700');
      pin(1780, 600, '城门拱 1660–1900 / 480–860'); pin(100, 880, '进城小路 x<200'); pin(1000, 860, '传令官 1000');
      pin(760, 700, '人群左组 620–900'); pin(1360, 700, '人群右组 1220–1500');
      pin(PLAZA.castle.x, PLAZA.castle.y, '阳台 (1500,190) ·0.4', 0.4);
      pin(190, 300, '木筋屋 0–380 ·0.8', 0.8); pin(1510, 330, '木筋屋 1380–1640 ·0.8', 0.8);
      label(g, 'PL-W · 地面线 y=860（红虚线）· 勇者 s=1 高 260', 30, 1040, 30);
    },
  },
  // ———— [3,6) 动态 ————
  {
    id: 'sheet_plaza_move', start: 3, end: 6,
    draw(g, T, lt, ctx) {
      const beamAt = 3.6, shockAt = 4.9;
      let c;
      if (lt < 0.3) c = lerpCam(CAMS.PL_TOP, CAMS.PL_W, ez(lt, 0, 0.3, whip));
      else if (lt < 0.9) c = CAMS.PL_W;
      else if (lt < 1.4) c = lerpCam(CAMS.PL_W, CAMS.PL_HERO, ez(lt, 0.9, 1.4, glide));
      else if (lt < 1.8) c = CAMS.PL_HERO;
      else c = lerpCam(CAMS.PL_HERO, CAMS.PL_W, ez(lt, 1.8, 2.1, whip));
      const noticeOpts = { unroll: clamp((lt - 0.4) / 0.1), pins: clamp((lt - 0.47) / 0.08) * 2, squash: 0.12 * Math.exp(-Math.max(0, lt - 0.5) / 0.08) * (lt > 0.5 ? 1 : 0) };
      scene(ctx, g, T, [0, 0, 1920, 1080], c, { time: 'beam', beamAt, notice: 'full', noticeOpts, farKing: T > shockAt ? 'beardFlip' : 'leanForward', lightCircle: clamp((T - beamAt - 0.3) / 0.5), shockAt, beaconAt: [3.2, 3.4] }, (q) => withCam(q, c, 1, crowd));
      tag(g, `动态：落镜 → 云缝光柱（beamAt ${beamAt}）→ PL-HERO → 喊声冲击（shockAt ${shockAt}）`, 30, 50, 24);
    },
  },
];
