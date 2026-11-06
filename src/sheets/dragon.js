// 模型图：巨龙（src/rigs/dragon.js）。按时间分页：
//   [0,1) 样条预设 A   [1,2) 样条预设 B   [2,3) D1 逐节点亮 + 河豚 + 盘柱前后分层
//   [3,4) 缩小 popped 0/6/13 + 剧场木偶 jaw 0/1 + 龙爪   [4,5) CU-D（zoom 2.4）头部特写 jaw 0 / 0.5 / 1   [5,6) 表情与状态
//   [6,8) 动态：飞行循环、甩尾、点亮波、待机呼吸（逐帧看）   [8,9) 实拍构图核对   [9,10) 杏仁巨眼 / eyes.one 剪影 / 镜像龙爪
import { PAL, rr, cut } from '../core/paper.js';
import { cam, applyCam } from '../core/camera.js';
import { clamp, seg, rgba, mixHex } from '../core/util.js';
import { outBack } from '../core/ease.js';
import { glyphRow } from '../ui/type.js';
import { NAME_TIMES } from '../ui/type.js';
import { drawDragon, drawDragonHead, drawDragonClaw, drawDragonEye, dragonSpine, DRAGON_POSES } from '../rigs/dragon.js';

const W = 1920, H = 1080;
const label = (g, text, x, y, size = 26, o = {}) => glyphRow(g, [...text], x, y, size, { family: 'play', fill: PAL.ink, edge: null, align: 'center', gap: 1, ...o });

function bg(g, title, sub) {
  g.fillStyle = PAL.paper; g.fillRect(0, 0, W, H);
  label(g, title, 960, 44, 38, { family: 'display', fill: PAL.dragonDeep });
  if (sub) label(g, sub, 960, 84, 22, { fill: PAL.inkSoft });
}
function card(g, x, y, w, h) {
  cut(g, rr(x, y, w, h, 18), PAL.paper2, { shadow: 3 });
  g.save(); g.strokeStyle = rgba(PAL.inkSoft, 0.35); g.lineWidth = 2; g.setLineDash([10, 8]); g.stroke(rr(x + 8, y + 8, w - 16, h - 16, 12)); g.restore();
}
/** 把某姿态（CAVE 世界坐标）塞进矩形。 */
function fitPose(g, pose, t, x, y, w, h, pad = 30, extra = {}) {
  const sp = dragonSpine(pose, t);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const hd = sp.head;
  let pts = [...sp, [hd[0] - 200, hd[1] - 300], [hd[0] + 230, hd[1] + 150], [hd[0] - 200, hd[1] + 130]];
  if (extra.mirror) pts = pts.map((p) => [2 * hd[0] - p[0], p[1]]);
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1] - 150); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1] + 70); }
  if (extra.bbox) [x0, y0, x1, y1] = extra.bbox;
  const k = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0));
  g.translate(x + w / 2, y + h / 2); g.scale(k, k); g.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  return k;
}
const allLit = (n = 13) => Array.from({ length: 13 }, (_, i) => ({ lit: i < n ? 1 : 0 }));

function poseGrid(names, ctx, g, T, opts = {}) {
  const cols = 4, cw = 456, ch = 470, gx = 18, x0 = (W - cols * cw - (cols - 1) * gx) / 2, y0 = 110;
  names.forEach((nm, i) => {
    const cx = x0 + (i % cols) * (cw + gx), cy = y0 + Math.floor(i / cols) * (ch + 14);
    card(g, cx, cy, cw, ch);
    const pose = typeof nm === 'string' ? nm : nm.pose;
    const extra = typeof nm === 'string' ? {} : nm;
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      lg.save();
      lg.beginPath(); lg.rect(cx + 6, cy + 6, cw - 12, ch - 70); lg.clip();
      fitPose(lg, pose, T, cx, cy, cw, ch - 64, 22, { ...extra, mirror: extra.o && extra.o.face === 1 });
      drawDragon(lg, { pose, t: T, plates: allLit(), ...(extra.o || {}) });
      lg.restore();
    });
    label(g, extra.title || pose, cx + cw / 2, cy + ch - 46, 30, { family: 'latin', weight: 600 });
    const d = (DRAGON_POSES[pose] || {}).desc || '';
    label(g, extra.sub || d.slice(0, 22), cx + cw / 2, cy + ch - 16, 19, { fill: PAL.inkSoft });
  });
}

export default [
  {
    id: 'sheet_dragon_poses_a', start: 0, end: 1,
    draw(g, T, lt, ctx) {
      bg(g, '巨龙 · 样条预设（一）', '64 点脊线 · 13 节沿弧长等距 · 背板字由 glyph13 画（全亮以检查正立可读）');
      poseGrid(['fly', 'shadow', 'coil', 'rise', 'name', 'breathe', 'puffer', 'wall'], ctx, g, T);
    },
  },
  {
    id: 'sheet_dragon_poses_b', start: 1, end: 2,
    draw(g, T, lt, ctx) {
      bg(g, '巨龙 · 样条预设（二）', 'lunge / coilPillar / clash / charge / standoff / puppet / shrink + face=1 镜像检查');
      poseGrid(['lunge', 'coilPillar', 'clash', 'charge', 'standoff', 'puppet', { pose: 'shrink', title: 'shrink', sub: 'popped = 4', o: { popped: 4 } },
        { pose: 'name', title: 'name · face=1', sub: '镜像：字不镜像、投影仍右下', o: { face: 1 } }], ctx, g, T);
    },
  },
  {
    id: 'sheet_dragon_d1', start: 2, end: 3,
    draw(g, T, lt, ctx) {
      bg(g, 'D1 阅读版 · 河豚 · 盘柱分层', '13 块背板从脖子到尾巴依次点亮（4 个中间帧）；puffer spikes=1 puff=1；coilPillar 柱前 / 柱后两层');
      const times = NAME_TIMES('D1a').concat(NAME_TIMES('D1b'));
      const probes = [105.9, 106.9, 108.1, 108.95];
      probes.forEach((P, i) => {
        const cx = 40 + (i % 2) * 610, cy = 110 + Math.floor(i / 2) * 330;
        card(g, cx, cy, 590, 316);
        ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => {
          lg.save(); lg.beginPath(); lg.rect(cx + 6, cy + 6, 578, 270); lg.clip();
          fitPose(lg, 'name', T, cx, cy, 590, 280, 14);
          const plates = times.map((tt, j) => ({ lit: clamp((P - tt) / 0.12), pop: Math.max(0, Math.sin(clamp((P - tt) / 0.35) * Math.PI)) }));
          drawDragon(lg, { pose: 'name', t: P, plates, tailFlick: 108.9 });
          lg.restore();
        });
        label(g, `T = ${P.toFixed(2)}`, cx + 295, cy + 296, 24, { family: 'latin', weight: 600 });
      });
      // 河豚
      card(g, 1270, 110, 610, 420);
      ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(1276, 116, 598, 370); lg.clip();
        fitPose(lg, 'puffer', T, 1270, 110, 610, 380, 20, { bbox: [1000, 60, 2350, 1080] });
        drawDragon(lg, { pose: 'puffer', t: T, spikes: 1, puff: 1, redden: 0.8, vein: 1, plates: allLit(0) });
        lg.restore();
      });
      label(g, 'puffer · spikes 1 · puff 1 · redden', 1575, 508, 22);
      // 盘柱：两层（柱后 0.9 → 柱 → 柱前 1.1）
      card(g, 1270, 545, 610, 425);
      ctx.layer(g, { shadow: 4, texture: 0.25, tint: { color: PAL.dragonDeep, alpha: 0.25 } }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(1276, 551, 598, 380); lg.clip();
        fitPose(lg, 'coilPillar', T, 1270, 545, 610, 390, 16, { bbox: [1200, -320, 1960, 980] });
        drawDragon(lg, { pose: 'coilPillar', t: T, part: 'back', plates: allLit() });
        lg.restore();
      });
      ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(1276, 551, 598, 380); lg.clip();
        fitPose(lg, 'coilPillar', T, 1270, 545, 610, 390, 16, { bbox: [1200, -320, 1960, 980] });
        cut(lg, rr(1585, -400, 110, 1400, 30), PAL.crystal, { rim: PAL.white });
        lg.fillStyle = rgba(PAL.white, 0.35); lg.fillRect(1600, -400, 18, 1400);
        drawDragon(lg, { pose: 'coilPillar', t: T, part: 'front', plates: allLit() });
        lg.restore();
      });
      label(g, 'coilPillar · part back / 柱 / part front', 1575, 948, 22);
    },
  },
  {
    id: 'sheet_dragon_shrink', start: 3, end: 4,
    draw(g, T, lt, ctx) {
      bg(g, '缩小 · 剧场木偶 · 龙爪', 'shrink popped = 0 / 6 / 13（以 (1467,860) 为中心缩到 0.15，落在台面 y=840）；puppet jaw 0 / 1（双签、黄铜钉、奶油纸边）');
      [0, 6, 13].forEach((pp, i) => {
        const cx = 40 + i * 420, cy = 110;
        card(g, cx, cy, 400, 400);
        ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => {
          lg.save(); lg.beginPath(); lg.rect(cx + 6, cy + 6, 388, 340); lg.clip();
          fitPose(lg, 'shrink', T, cx, cy, 400, 360, 10, { bbox: [1100, 300, 2900, 900] });
          lg.strokeStyle = rgba(PAL.woodDark, 0.6); lg.lineWidth = 6; lg.beginPath(); lg.moveTo(1000, 840); lg.lineTo(3000, 840); lg.stroke();
          drawDragon(lg, { pose: 'shrink', t: T, popped: pp, plates: allLit() });
          lg.restore();
        });
        label(g, `popped = ${pp}`, cx + 200, cy + 372, 26, { family: 'latin', weight: 600 });
      });
      [0, 1].forEach((jw, i) => {
        const cx = 40 + i * 630, cy = 530;
        card(g, cx, cy, 610, 440);
        ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
          lg.save(); lg.beginPath(); lg.rect(cx + 6, cy + 6, 598, 380); lg.clip();
          fitPose(lg, 'puppet', T, cx, cy, 610, 400, 10, { bbox: [1100, 280, 2300, 1000] });
          drawDragon(lg, { pose: 'puppet', t: T, jaw: jw, plates: allLit(jw ? 13 : 0), eyes: jw ? { state: 'angry', red: 0.6 } : {} });
          lg.restore();
        });
        label(g, `puppet · jaw ${jw}`, cx + 305, cy + 410, 26, { family: 'latin', weight: 600 });
      });
      card(g, 1300, 110, 580, 860);
      ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(1306, 116, 568, 800); lg.clip();
        const a = drawDragonClaw(lg, { x: 1560, y: 520, s: 1.3, rot: -35, grip: clamp((T % 1) * 2), t: T });
        lg.fillStyle = PAL.red; lg.beginPath(); lg.arc(a.hook[0], a.hook[1], 6, 0, Math.PI * 2); lg.fill();
        lg.restore();
      });
      label(g, 'drawDragonClaw · 红点 = hook', 1590, 940, 24);
    },
  },
  {
    id: 'sheet_dragon_cu', start: 4, end: 5,
    draw(g, T, lt, ctx) {
      g.fillStyle = mixHex(PAL.dragonDeep, PAL.ink, 0.3); g.fillRect(0, 0, W, H);
      // CU-D 机位：cam(1120,470,2.4) 对着 rise 姿态的头；三档 jaw：[4,4.34) 0 · [4.34,4.67) 0.5 · [4.67,5) 1
      const c = cam(1120, 470, 2.4);
      const ph = T < 4.34 ? 0 : T < 4.67 ? 1 : 2;
      const jaw = [0, 0.5, 1][ph];
      ctx.layer(g, { shadow: 12, texture: 0.3 }, (lg) => {
        applyCam(lg, c, 1);
        drawDragon(lg, { pose: 'rise', t: T, jaw, eyes: { state: ['smug', 'normal', 'angry'][ph] }, nostril: ph === 2 ? 1 : 0, plates: allLit(4) });
      });
      label(g, `CU-D cam(1120,470,2.4) · jaw ${jaw} · 嘴角颊皮 / 舌 / 牙 / 鼻孔纹 / 角的纸片层次`, 960, 1040, 28, { fill: PAL.paper });
    },
  },
  {
    id: 'sheet_dragon_expr', start: 5, end: 6,
    draw(g, T, lt, ctx) {
      bg(g, '龙头 · 表情与状态', 'eyes.state / jaw / redden / vein / steam / spikes / twitch / nostril / silhouette');
      const cells = [
        ['normal', {}], ['angry', { eyes: { state: 'angry' } }], ['smug', { eyes: { state: 'smug' } }], ['dizzy', { eyes: { state: 'dizzy' } }],
        ['closed', { eyes: { state: 'closed' } }], ['happy', { eyes: { state: 'happy' }, jaw: 0.3 }], ['x', { eyes: { state: 'x' }, jaw: 0.4 }], ['twitch', { eyes: { twitch: 1, state: 'angry' }, redden: 0.3 }],
        ['jaw 0.5', { jaw: 0.5, eyes: { look: [-1, 0] } }], ['redden+vein', { redden: 1, vein: 1, eyes: { state: 'angry' } }], ['steam', { steam: [5.0, 5.5], nostril: 1, eyes: { state: 'angry' }, redden: 0.6 }], ['spikes', { spikes: 1, jaw: 0.7, eyes: { state: 'angry', red: 1 } }],
        ['glow (dark)', { eyes: { glow: 1, pupil: 0.1 }, silhouette: true, keepColor: ['eye'] }], ['look up', { eyes: { look: [0.6, -1], pupil: 0.6 } }], ['flat', { flat: true, jaw: 0.6 }], ['detail 0', { detail: 0, jaw: 0.4 }],
      ];
      cells.forEach(([nm, o], i) => {
        const cx = 50 + (i % 8) * 230, cy = 110 + Math.floor(i / 8) * 470;
        card(g, cx, cy, 220, 440);
        ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => {
          lg.save(); lg.beginPath(); lg.rect(cx + 4, cy + 4, 212, 380); lg.clip();
          drawDragonHead(lg, { x: cx + 104, y: cy + 200, s: 0.47, t: T, seed: i + 2, ...o });
          lg.restore();
        });
        label(g, nm, cx + 110, cy + 410, 22, { family: 'latin', weight: 600 });
      });
    },
  },
  {
    id: 'sheet_dragon_dyn', start: 6, end: 8,
    draw(g, T, lt, ctx) {
      bg(g, '动态：飞行行波 + 扇翅 · 甩尾 · 点亮波 · 待机', `t = ${T.toFixed(2)}`);
      // 飞行（右边飞入左边，循环）
      card(g, 40, 110, 1840, 380);
      ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(46, 116, 1828, 368); lg.clip();
        drawDragon(lg, { pose: 'fly', t: T, x: 420, y: 250, s: 0.62 });
        drawDragon(lg, { pose: 'shadow', t: T, x: 1420, y: 270, s: 0.3, alpha: 0.55 });
        drawDragon(lg, { pose: 'fly', t: T, x: 1500, y: 400, s: 0.3, face: 1, detail: 0 });
        lg.restore();
      });
      // 甩尾 + 点亮波
      card(g, 40, 505, 1200, 470);
      ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(46, 511, 1188, 420); lg.clip();
        fitPose(lg, 'name', T, 40, 505, 1200, 440, 16);
        const ph = (T - 6) % 2;
        const plates = Array.from({ length: 13 }, (_, j) => { const tt = j * 0.11; return { lit: clamp((ph - tt) / 0.1), pop: Math.max(0, Math.sin(clamp((ph - tt) / 0.35) * Math.PI)) }; });
        drawDragon(lg, { pose: 'name', t: T, plates, tailFlick: 7.5 });
        lg.restore();
      });
      label(g, 'name：逐节点亮 + 拱起 10px + 7.50 甩尾', 640, 955, 22);
      card(g, 1260, 505, 620, 470);
      ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(1266, 511, 608, 420); lg.clip();
        fitPose(lg, 'coil', T, 1260, 505, 620, 440, 14);
        drawDragon(lg, { pose: 'coil', t: T, eyes: { state: 'closed' } });
        lg.restore();
      });
      label(g, 'coil：待机呼吸', 1570, 955, 22);
    },
  },
  {
    id: 'sheet_dragon_frames', start: 8, end: 9,
    draw(g, T, lt, ctx) {
      bg(g, '实拍构图核对（每格 = 1920×1080 缩到 0.3）', '红十字 = storyboard 给的目标点；绿点 = drawDragon 返回的锚点');
      const shots = [
        { t: 'D1 开始 cam(1300,500,0.9)', c: cam(1300, 500, 0.9), o: { pose: 'name', plates: allLit(3) }, mark: [[960, 440]], key: 'head' },
        { t: 'D1 结束 cam(1950,560,0.9)', c: cam(1950, 560, 0.9), o: { pose: 'name', plates: allLit(13) }, mark: [[2450, 820]], key: 'tailTip' },
        { t: 'D2 CV-W：嘴约 (1380,520)', c: cam(960, 540, 1), o: { pose: 'breathe' }, mark: [[1380, 520]], key: 'mouth' },
        { t: 'D3 CV-LOW：屏幕头 (1180,250) → x:1294, y:72', c: cam(1000, 420, 0.8, -3 * Math.PI / 180), o: { pose: 'wall', x: 1294, y: 72, plates: allLit(13) }, mark: [[1294, 72]], key: 'head' },
        { t: '剧场 TT-W：puppet 头 (1350,520)、身到 (1700,760)', c: cam(960, 540, 1), o: { pose: 'puppet', jaw: 0.4 }, mark: [[1350, 520], [1700, 760]], key: 'head', stage: true },
        { t: 'b02 外景：fly s=0.5 face=1 飞向龙山', c: cam(960, 540, 1), o: { pose: 'fly', x: 1200, y: 380, s: 0.5, face: 1 }, mark: [[1200, 380]], key: 'head', sky: true },
      ];
      shots.forEach((sh, i) => {
        const sx = 30 + (i % 3) * 630, sy = 110 + Math.floor(i / 3) * 470, k = 0.3125;
        card(g, sx - 6, sy - 6, 600 + 12, 338 + 72);
        g.save();
        g.beginPath(); g.rect(sx, sy, 600, 338); g.clip();
        g.fillStyle = sh.sky ? PAL.skyDay : sh.stage ? PAL.redDeep : mixHex(PAL.dragonDeep, PAL.ink, 0.2); g.fillRect(sx, sy, 600, 338);
        g.restore();
        ctx.layer(g, { shadow: 4, texture: 0.2 }, (lg) => {
          lg.save(); lg.beginPath(); lg.rect(sx, sy, 600, 338); lg.clip();
          lg.translate(sx, sy); lg.scale(k, k);
          if (sh.stage) { lg.fillStyle = PAL.woodDark; lg.fillRect(0, 860, 1920, 220); }
          applyCam(lg, sh.c, 1);
          const a = drawDragon(lg, { t: T, ...sh.o });
          lg.strokeStyle = PAL.red; lg.lineWidth = 6 / sh.c.zoom;
          for (const [mxp, myp] of sh.mark) { lg.beginPath(); lg.moveTo(mxp - 30, myp); lg.lineTo(mxp + 30, myp); lg.moveTo(mxp, myp - 30); lg.lineTo(mxp, myp + 30); lg.stroke(); }
          const p = a[sh.key];
          if (p) { lg.fillStyle = PAL.grass; lg.beginPath(); lg.arc(p[0], p[1], 14 / sh.c.zoom, 0, Math.PI * 2); lg.fill(); }
          lg.restore();
        });
        label(g, sh.t, sx + 300, sy + 370, 21);
      });
    },
  },
  {
    id: 'sheet_dragon_eye', start: 9, end: 10,
    draw(g, T, lt, ctx) {
      bg(g, '杏仁巨眼 · 单眼剪影 · 镜像龙爪', "drawDragonEye shape:'almond'（b09 101.20，open 0 → 1）· eyes.one（b06 片名页盘龙剪影只亮一只眼）· 角色卡剪影双眼 · drawDragonClaw face=1");
      const dark = mixHex(PAL.dragonDeep, PAL.ink, 0.55);
      [0, 0.35, 0.7, 1].forEach((op, i) => {
        const cx = 40 + i * 465, cy = 110;
        card(g, cx, cy, 445, 300);
        g.fillStyle = dark; g.fill(rr(cx + 12, cy + 12, 421, 230, 10));
        ctx.layer(g, { texture: 0.2 }, (lg) => drawDragonEye(lg, { shape: 'almond', x: cx + 222, y: cy + 127, w: 400, h: 214, open: op, pupil: 0.22, look: [-0.25, 0.05], glow: 0.8 * op, t: T }));
        label(g, `almond · open ${op}`, cx + 222, cy + 272, 24, { family: 'latin', weight: 600 });
      });
      card(g, 40, 430, 900, 560);
      g.fillStyle = dark; g.fill(rr(52, 442, 876, 476, 10));
      ctx.layer(g, { shadow: 6, texture: 0.2 }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(52, 442, 876, 476); lg.clip();
        fitPose(lg, 'coil', T, 40, 430, 900, 500, 30);
        drawDragon(lg, { pose: 'coil', t: T, silhouette: true, keepColor: ['eye'], silColor: PAL.ink, eyes: { one: true, glow: 0.8, pupil: 0.2 } });
        lg.restore();
      });
      label(g, "coil · silhouette · keepColor ['eye'] · eyes.one（远眼不画、近眼睁开）", 490, 955, 22);
      card(g, 960, 430, 420, 560);
      g.fillStyle = dark; g.fill(rr(972, 442, 396, 476, 10));
      ctx.layer(g, { shadow: 6, texture: 0.2 }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(972, 442, 396, 476); lg.clip();
        drawDragonHead(lg, { x: 1160, y: 640, s: 0.72, t: T, silhouette: true, keepColor: ['eye'], eyes: { glow: 1, pupil: 0.15 }, seed: 3 });
        lg.restore();
      });
      label(g, '角色卡：剪影 + 双眼', 1170, 955, 22);
      card(g, 1400, 430, 480, 560);
      ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
        lg.save(); lg.beginPath(); lg.rect(1406, 436, 468, 480); lg.clip();
        const a = drawDragonClaw(lg, { x: 1700, y: 700, s: 0.9, rot: 30, face: 1, grip: 0.7, t: T });
        lg.fillStyle = PAL.red; lg.beginPath(); lg.arc(a.hook[0], a.hook[1], 6, 0, Math.PI * 2); lg.fill();
        lg.restore();
      });
      label(g, 'drawDragonClaw face=1 · 红点 = hook', 1640, 955, 22);
    },
  },
];
