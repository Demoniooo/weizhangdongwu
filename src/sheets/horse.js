// 白马模型图：①gallop 一周期 8 帧（固定机位连贴 + 着地辅助线）②各动作 ③归程/远景/剪影/比例/表情 ④动态串场 ⑤细节特写 ⑥坡度 angle 与跛行强度 limp。
// node tools/render.mjs stills --sheet horse --times 0.5,1.5,2.5,4.6,10.75,14.5 --outdir out/review/sheets/horse
import { PAL, rgba, mixHex, poly, line } from '../core/paper.js';
import { clamp, lerp, TAU, fract } from '../core/util.js';
import { ez, glide, inOutQuad, outQuad } from '../core/ease.js';
import { glyphRow } from '../ui/type.js';
import { drawHorse, horseRig, horsePhase, drawReins, HORSE_STRIDE } from '../rigs/horse.js';
// 勇者只在第 6 页做骑乘坡度演示；动态加载，勇者模块出错不影响白马 / 小动物模型图（monsters、ride 也 import 本文件的小工具）
let drawHero = null;
try { ({ drawHero } = await import('../rigs/hero.js')); } catch (e) { drawHero = null; }

// ———————————————————— 模型图通用小工具（monsters / ride 也用） ————————————————————
export function sheetBg(g, title, sub) {
  g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080);
  g.save();
  g.strokeStyle = rgba(PAL.kraftDark, 0.18); g.lineWidth = 1;
  for (let x = 0; x <= 1920; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1080); g.stroke(); }
  for (let y = 0; y <= 1080; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(1920, y); g.stroke(); }
  g.restore();
  label(g, title, 60, 44, 34, { align: 'left', fill: PAL.ink });
  if (sub) label(g, sub, 60, 84, 20, { align: 'left', fill: PAL.inkSoft });
}
export function label(g, text, x, y, size = 20, o = {}) {
  glyphRow(g, [...text], x, y, size, { family: 'play', fill: o.fill || PAL.inkSoft, edge: null, align: o.align || 'center', baseline: true, gap: size * 0.02 });
}
/** 脚底线 + s 缩放后的 260 身高线（虚线）。 */
export function ground(g, x0, x1, y, s = 1, o = {}) {
  g.save();
  g.strokeStyle = rgba(PAL.woodDark, 0.55); g.lineWidth = 2;
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
  if (o.h260 !== false) {
    g.setLineDash([6, 6]); g.strokeStyle = rgba(PAL.red, 0.35); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x0, y - 260 * s); g.lineTo(x1, y - 260 * s); g.stroke();
    g.setLineDash([]);
  }
  g.restore();
}
const LEGC = { hf: PAL.dragonWing, hn: PAL.heroBlue, ff: PAL.grassDark, fn: PAL.red };

// ———————————————————— 第 1 页：gallop 8 帧 + 步态循环 ————————————————————
function pageCycle(g, T, ctx) {
  sheetBg(g, '白马 drawHorse · 1/6 步态', 'gallop 一周期 8 帧：固定机位，马按 phase = x ÷ 280 前进 35px/帧；彩色竖线 = 该腿支撑期蹄位（蹄子应始终压在线上）');
  const s = 0.78, cellW = 452, x0 = 70;
  const rows = [350, 655];
  // 先求 8 帧着地点（局部世界：每格原点 = 格左 + 60）
  const frames = [];
  for (let k = 0; k < 8; k++) {
    const wx = k * (HORSE_STRIDE / 8) * s;
    frames.push({ k, wx, a: horseRig({ x: wx, y: 0, s, pose: 'gallop', phase: horsePhase(wx, s), t: 0.3 }) });
  }
  const guides = [];
  for (const f of frames) for (const leg of ['hf', 'hn', 'ff', 'fn']) if (f.a.contact[leg]) guides.push([f.a.hooves[leg][0], leg]);
  for (let r = 0; r < 2; r++) {
    const gy = rows[r];
    for (let c = 0; c < 4; c++) {
      const cx = x0 + c * cellW, ox = cx + 130;
      g.save(); g.fillStyle = rgba(PAL.white, 0.35); g.fillRect(cx, gy - 240, cellW - 16, 275); g.restore();
      ground(g, cx, cx + cellW - 16, gy, s);
      for (const [x, leg] of guides) {
        g.save(); g.strokeStyle = rgba(LEGC[leg], 0.55); g.lineWidth = 1.5; g.setLineDash([4, 4]);
        g.beginPath(); g.moveTo(ox + x, gy - 40); g.lineTo(ox + x, gy + 14); g.stroke(); g.restore();
      }
      const f = frames[r * 4 + c];
      label(g, `${f.k}/8`, cx + 30, gy - 218, 22, { fill: PAL.ink });
    }
  }
  ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
    for (const f of frames) {
      const r = Math.floor(f.k / 4), c = f.k % 4;
      const ox = x0 + c * cellW + 130, gy = rows[r];
      drawHorse(lg, { x: ox + f.wx, y: gy, s, pose: 'gallop', phase: horsePhase(f.wx, s), t: 0.3 + f.k * 0.035 });
    }
  });
  for (const f of frames) {
    const r = Math.floor(f.k / 4), c = f.k % 4, ox = x0 + c * cellW + 130, gy = rows[r];
    for (const leg of ['hf', 'hn', 'ff', 'fn']) if (f.a.contact[leg]) {
      const x = ox + f.a.hooves[leg][0];
      g.save(); g.fillStyle = LEGC[leg];
      g.beginPath(); g.moveTo(x, gy + 3); g.lineTo(x - 6, gy + 14); g.lineTo(x + 6, gy + 14); g.closePath(); g.fill(); g.restore();
    }
  }
  // 腿色图例
  let lx = 1240;
  for (const [leg, name] of [['hf', '远后'], ['hn', '近后'], ['ff', '远前'], ['fn', '近前']]) {
    g.save(); g.fillStyle = LEGC[leg]; g.fillRect(lx, 36, 18, 18); g.restore();
    label(g, name, lx + 46, 46, 20, { fill: PAL.ink }); lx += 110;
  }
  // 第三排：原地循环（phase 由 t 推进）
  const gy = 985;
  ground(g, 60, 1860, gy, 0.62, { h260: false });
  const loops = [['gallop', 'gallop 900px/s'], ['trot', 'trot 380px/s'], ['walk', 'walk 150px/s'], ['limp', 'limp（伤腿 fn）']];
  ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
    loops.forEach(([pose, name], i) => {
      const x = 230 + i * 460;
      drawHorse(lg, { x, y: gy, s: 0.62, pose, t: T, bandageLeg: pose === 'limp' ? 'fn' : false, noseBandage: pose === 'limp' });
    });
  });
  loops.forEach(([, name], i) => label(g, name, 230 + i * 460, gy + 34, 20, { fill: PAL.ink }));
}

// ———————————————————— 第 2 页：动作 ————————————————————
function pagePoses(g, T, ctx) {
  sheetBg(g, '白马 drawHorse · 2/6 动作', 'stand · tossMane · pawGround · rear · skid · leap 0/0.5/1 · headwind · biteCoin · hideRock · limp · speedLines（次级运动随 t 活动）');
  const s = 0.66;
  const cells = [
    { x: 230, y: 330, o: { pose: 'stand' }, n: 'stand' },
    { x: 690, y: 330, o: { pose: 'tossMane' }, n: 'tossMane（甩头·闪光）' },
    { x: 1150, y: 330, o: { pose: 'pawGround' }, n: 'pawGround' },
    { x: 1630, y: 330, o: { pose: 'rear' }, n: 'rear' },
    { x: 230, y: 640, o: { pose: 'skid', vel: [0, 0] }, n: 'skid（急停）' },
    { x: 690, y: 640, o: { pose: 'leap', air: 0 }, n: 'leap air 0', lift: 30 },
    { x: 1150, y: 640, o: { pose: 'leap', air: 0.5 }, n: 'leap air 0.5', lift: 60 },
    { x: 1630, y: 640, o: { pose: 'leap', air: 1 }, n: 'leap air 1', lift: 30 },
    { x: 230, y: 960, o: { pose: 'headwind', gait: 'trot', icicles: 1, snow: 0.8, breath: 1 }, n: 'headwind 冰凌·积雪·白气' },
    { x: 690, y: 960, o: { pose: 'biteCoin', gait: 'trot', at: T - 0.42 }, n: 'biteCoin（叼金币验真）' },
    { x: 1150, y: 960, o: { pose: 'hideRock' }, n: 'hideRock（岩石由 env 画）', rock: true },
    { x: 1630, y: 960, o: { pose: 'speedLines' }, n: 'speedLines' },
  ];
  for (const c of cells) ground(g, c.x - 215, c.x + 215, c.y, s);
  ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
    for (const c of cells) drawHorse(lg, { x: c.x, y: c.y - (c.lift || 0), s, t: T, ...c.o });
  });
  // 岩石示意（只露耳朵和尾巴）
  const rock = cells.find((c) => c.rock);
  ctx.layer(g, { shadow: 5, texture: 0.3 }, (lg) => {
    const x = rock.x, y = rock.y, top = y - 140 * s;
    const p = poly([[x - 150, y], [x - 146, y - 60], [x - 100, top + 10], [x - 20, top - 4], [x + 70, top], [x + 128, y - 70], [x + 150, y]], { seed: 4, round: 0.7, amp: 2 });
    lg.fillStyle = PAL.stone2; lg.fill(p);
    lg.save(); lg.clip(p); lg.fillStyle = rgba(PAL.stoneDark, 0.25); lg.fillRect(x - 160, y - 40, 330, 50); lg.restore();
  });
  for (const c of cells) label(g, c.n, c.x, c.y + 30, 20, { fill: PAL.ink });
}

// ———————————————————— 第 3 页：归程 / 远景 / 剪影 / 比例 / 表情 ————————————————————
function pageMisc(g, T, ctx) {
  sheetBg(g, '白马 drawHorse · 3/6 归程·远景·剪影·比例·表情', 'face=−1 归程版；detail 0 远景（s=0.3）；silhouette（只留鬃毛）；s=1 比例尺：脚底线 / 230 马高 / 260 勇者 / 330 人马合计');
  const s = 0.62;
  const row1 = [['gallop', 0], ['trot', 0], ['rear', 0], ['leap', 50], ['tossMane', 0]];
  row1.forEach(([p], i) => ground(g, 120 + i * 360 - 170, 120 + i * 360 + 170, 300, s));
  ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
    row1.forEach(([pose, lift], i) => drawHorse(lg, { x: 150 + i * 360, y: 300 - lift, s, face: -1, pose, t: T, air: 0.5 }));
  });
  row1.forEach(([pose], i) => label(g, `${pose} face −1`, 150 + i * 360, 330, 20, { fill: PAL.ink }));
  // 远景 detail 0（s=0.3）与 detail 1 对比
  ground(g, 60, 960, 560, 0.3);
  const far = [['gallop', 0], ['trot', 0], ['stand', 0], ['rear', 0], ['skid', 0]];
  ctx.layer(g, { shadow: 3, texture: 0.25 }, (lg) => {
    far.forEach(([pose], i) => drawHorse(lg, { x: 120 + i * 170, y: 560, s: 0.3, pose, t: T, detail: 0 }));
    drawHorse(lg, { x: 120 + 5 * 170 - 10, y: 560, s: 0.3, pose: 'gallop', t: T, detail: 1 });
  });
  label(g, 'detail 0 · s=0.3（最右为 detail 1 对比）', 500, 590, 20, { fill: PAL.ink });
  // 剪影
  ground(g, 1000, 1860, 560, 0.5, { h260: false });
  ctx.layer(g, { shadow: 4, texture: 0.2 }, (lg) => {
    drawHorse(lg, { x: 1200, y: 560, s: 0.5, pose: 'gallop', t: T, silhouette: true, keepColor: ['mane', 'tail'] });
    drawHorse(lg, { x: 1620, y: 560, s: 0.5, pose: 'rear', t: T, silhouette: true });
  });
  label(g, 'silhouette（keepColor: mane, tail）', 1200, 590, 20, { fill: PAL.ink });
  label(g, 'silhouette 全黑', 1620, 590, 20, { fill: PAL.ink });
  // s=1 比例尺
  const bx = 340, by = 1020;
  g.save();
  for (const [h, c, n] of [[0, PAL.woodDark, '脚底'], [230, PAL.inkSoft, '230 马（耳尖）'], [260, PAL.red, '260 勇者'], [330, PAL.heroBlue, '330 人马合计']]) {
    g.strokeStyle = rgba(c, 0.6); g.lineWidth = h ? 1.4 : 2; g.setLineDash(h ? [8, 6] : []);
    g.beginPath(); g.moveTo(80, by - h); g.lineTo(660, by - h); g.stroke();
    label(g, n, 720, by - h, 18, { fill: c });
  }
  g.setLineDash([]);
  g.strokeStyle = rgba(PAL.inkSoft, 0.6);
  g.beginPath(); g.moveTo(bx - 150, by + 18); g.lineTo(bx + 150, by + 18); g.stroke();
  g.restore();
  label(g, '300', bx, by + 34, 16, { fill: PAL.inkSoft });
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawHorse(lg, { x: bx, y: by, s: 1, pose: 'stand', t: T, reins: true }));
  const a = horseRig({ x: bx, y: by, s: 1, pose: 'stand', t: T });
  for (const [k, c] of [['saddle', PAL.red], ['saddleBack', PAL.princessDark], ['mouth', PAL.heroBlue], ['tail', PAL.grassDark], ['hoofFront', PAL.goldDark], ['stirrup', PAL.inkSoft]]) {
    const p = a[k];
    g.save(); g.fillStyle = c; g.strokeStyle = PAL.white; g.lineWidth = 2;
    g.beginPath(); g.arc(p[0], p[1], 6, 0, TAU); g.fill(); g.stroke(); g.restore();
    label(g, k, p[0] + (k === 'tail' ? -40 : 44), p[1] - 14, 16, { fill: c });
  }
  // 表情（头部特写 s=1.9）
  const ex = ['normal', 'proud', 'happy', 'scared', 'effort', 'hurt', 'neigh', 'chomp'];
  ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
    const hd = horseRig({ x: 0, y: 0, s: 1.7, pose: 'stand', t: 0.2 }).head;
    ex.forEach((e, i) => {
      const cx = 1040 + (i % 4) * 215, cy = 840 + Math.floor(i / 4) * 200;
      lg.save();
      lg.beginPath(); lg.rect(cx - 100, cy - 135, 200, 168); lg.clip();
      drawHorse(lg, { x: cx - hd[0] - 34, y: cy - hd[1] - 46, s: 1.7, pose: 'stand', expr: e, t: 0.2, joints: e === 'neigh' ? { jaw: 24 } : undefined });
      lg.restore();
    });
  });
  ex.forEach((e, i) => label(g, e, 1040 + (i % 4) * 215, 840 + Math.floor(i / 4) * 200 + 44, 18, { fill: PAL.ink }));
}

// ———————————————————— 第 4 页：动态串场（机位跟拍，地面刻度检验打滑） ————————————————————
// 马的世界 x(T)：奔入 → 急停 → 人立 → 甩头 → 刨地 → 小跑 → 慢走 → 再奔出
const RUN = { t0: 3 };
function runX(T) {
  const t = T - RUN.t0;
  // 速度剖面（px/s），积分得位置
  const segs = [[0, 0.8, 900, 900], [0.8, 1.1, 900, 0], [1.1, 3.4, 0, 0], [3.4, 4.6, 0, 380], [4.6, 5.4, 380, 150], [5.4, 6.2, 150, 900]];
  let x = 0;
  for (const [a, b, v0, v1] of segs) {
    if (t <= a) break;
    const e = Math.min(t, b) - a, d = b - a;
    x += v0 * e + ((v1 - v0) * e * e) / (2 * d);
  }
  if (t > 6.2) x += 900 * (t - 6.2);
  return x;
}
function pageRun(g, T, ctx) {
  const t = T - RUN.t0;
  const hx = runX(T);
  const camX = hx + 120 - Math.max(0, 900 - 900) ;
  sheetBg(g, '白马 drawHorse · 4/6 动态串场', 'gallop → skid → rear → tossMane → pawGround → trot → walk → gallop（phase = 世界 x ÷ 280，地面刻度每 70px）');
  const gy = 820, s = 1;
  const sx = 960 - (camX - 400) * 0;
  const off = 760 - hx; // 机位：马固定在屏幕 x≈760
  g.save();
  g.strokeStyle = rgba(PAL.woodDark, 0.6); g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, gy); g.lineTo(1920, gy); g.stroke();
  for (let wx = Math.floor((-off - 100) / 70) * 70; wx < -off + 2100; wx += 70) {
    const x = wx + off;
    g.lineWidth = wx % 280 === 0 ? 3 : 1.5;
    g.beginPath(); g.moveTo(x, gy); g.lineTo(x, gy + (wx % 280 === 0 ? 26 : 14)); g.stroke();
  }
  g.restore();
  // 姿态时间线
  let pose = 'gallop', extra = {};
  const k = (a, b) => clamp((t - a) / (b - a));
  if (t < 0.8) pose = 'speedLines';
  else if (t < 1.1) pose = { from: 'gallop', to: 'skid', k: inOutQuad(k(0.8, 0.95)) };
  else if (t < 1.5) pose = { from: 'skid', to: 'rear', k: inOutQuad(k(1.1, 1.4)) };
  else if (t < 2.0) pose = 'rear';
  else if (t < 2.3) pose = { from: 'rear', to: 'stand', k: inOutQuad(k(2.0, 2.3)) };
  else if (t < 2.9) { pose = 'tossMane'; extra.at = RUN.t0 + 2.6; }
  else if (t < 3.4) { pose = 'pawGround'; extra.paw = [RUN.t0 + 3.05, RUN.t0 + 3.3]; }
  else if (t < 3.6) pose = { from: 'stand', to: 'trot', k: inOutQuad(k(3.4, 3.6)) };
  else if (t < 4.6) pose = 'trot';
  else if (t < 4.8) pose = { from: 'trot', to: 'walk', k: inOutQuad(k(4.6, 4.8)) };
  else if (t < 5.4) pose = 'walk';
  else if (t < 5.7) pose = { from: 'walk', to: 'gallop', k: inOutQuad(k(5.4, 5.7)) };
  else pose = 'gallop';
  const o = { x: hx + off, y: gy, s, t: T, pose, phase: horsePhase(hx, s), ...extra, speed: Math.max(0, (runX(T + 0.02) - runX(T - 0.02)) / 0.04) };
  o.vel = [o.speed, 0];
  ctx.layer(g, { shadow: 9, texture: 0.25 }, (lg) => drawHorse(lg, o));
  const a = horseRig(o);
  for (const d of a.dust) {
    g.save(); g.fillStyle = rgba(PAL.sand, 0.5 * d.k);
    g.beginPath(); g.arc(d.x - 10, d.y - 8, 10 * d.k + 4, 0, TAU); g.fill(); g.restore();
  }
  label(g, typeof pose === 'string' ? pose : `${pose.from} → ${pose.to}  k=${pose.k.toFixed(2)}`, 960, 960, 26, { fill: PAL.ink });
}

// ———————————————————— 第 5 页：细节特写（冰凌/积雪/白气、咬金币、绷带与创可贴、归程脸、甩头闪光） ————————————————————
function pageDetail(g, T, ctx) {
  sheetBg(g, '白马 drawHorse · 5/6 细节特写', 'headwind + icicles/snow/breath · biteCoin（at 驱动：扑咬→咔嚓留牙印→吐出）· bandageLeg + noseBandage · face −1 高光仍在左上 · tossMane 闪光');
  const s = 1.5, gy = 520;
  const lt = T - 10;
  const cells = [
    { x: 250, o: { pose: 'headwind', gait: 'trot', icicles: 1, snow: 1, breath: 1 }, n: 'headwind · icicles 1 · snow 1 · breath 1' },
    { x: 760, o: { pose: 'biteCoin', gait: 'trot', at: 10 + Math.floor(lt / 1.5) * 1.5 + 0.35 }, n: 'biteCoin（循环演示 at）' },
    { x: 1270, o: { pose: 'limp', gait: 'trot', bandageLeg: 'fn', noseBandage: true }, n: 'limp · bandageLeg · noseBandage' },
    { x: 1700, o: { pose: 'stand', face: -1 }, n: 'face −1：眼睛高光仍在左上', fx: true },
  ];
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
    for (const c of cells) {
      lg.save(); lg.beginPath(); lg.rect(c.x - 250, 110, 500, gy - 70); lg.clip();
      drawHorse(lg, { x: c.fx ? c.x + 160 : c.x - 60, y: gy + 120, s, t: T, ...c.o });
      lg.restore();
    }
  });
  for (const c of cells) label(g, c.n, c.x, gy + 80, 19, { fill: PAL.ink });
  // 第二排：甩头（at 循环）与刨地 / 踏蹄（paw / stamp 时刻数组）
  const y2 = 1000, s2 = 0.9;
  ground(g, 60, 1860, y2, s2);
  const k = Math.floor(lt / 1.6) * 1.6;
  ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
    drawHorse(lg, { x: 300, y: y2, s: s2, t: T, pose: 'tossMane', at: 10 + k + 0.55 });
    drawHorse(lg, { x: 800, y: y2, s: s2, t: T, pose: 'pawGround', paw: [10 + k + 0.4, 10 + k + 0.75] });
    drawHorse(lg, { x: 1300, y: y2, s: s2, t: T, pose: 'stand', stamp: 10 + k + 0.6 });
    drawHorse(lg, { x: 1720, y: y2, s: s2, t: T, pose: 'rear', tremble: 1, expr: 'scared' });
  });
  label(g, 'tossMane at', 300, y2 + 30, 19, { fill: PAL.ink });
  label(g, 'pawGround paw:[t1,t2]', 800, y2 + 30, 19, { fill: PAL.ink });
  label(g, 'stand stamp:t', 1300, y2 + 30, 19, { fill: PAL.ink });
  label(g, 'rear + tremble + scared（洞口发抖）', 1720, y2 + 30, 19, { fill: PAL.ink });
}

// ———————————————————— 第 6 页：坡度 angle（含骑手 saddleRot）与跛行强度 limp（收尾补充） ————————————————————
/** 一条过 (x, y)、倾角 a 的斜地面线。 */
function slopeLine(g, x, y, a, half = 260) {
  const c = Math.cos(a), s = Math.sin(a);
  g.save(); g.strokeStyle = rgba(PAL.woodDark, 0.6); g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(x - c * half, y - s * half); g.lineTo(x + c * half, y + s * half); g.stroke(); g.restore();
}
function pageSlope(g, T, ctx) {
  sheetBg(g, '白马 drawHorse · 6/6 坡度 angle · 跛行强度 limp', 'angle（弧度，正 = 向右下）绕脚底整体转，返回锚点与 saddleRot 已含坡度；三角 = 着地蹄（应压在斜线上）。下排 limp 0..1 叠加在 trot 上（V08 每升一级减轻）');
  const s = 0.7, y1 = 430;
  const cells = [
    { x: 300, a: -0.16, o: { pose: 'gallop', face: 1 }, n: 'gallop 上坡 angle −0.16' },
    { x: 960, a: 0.16, o: { pose: 'trot', face: 1 }, n: 'trot 下坡 angle 0.16' },
    { x: 1600, a: 0.16, o: { pose: 'gallop', face: -1 }, n: 'face −1 上坡 + 骑手 rot = saddleRot', rider: true },
  ];
  for (const c of cells) slopeLine(g, c.x, y1, c.a);
  ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
    for (const c of cells) {
      const ph = horsePhase(T * 600 * (c.o.face ?? 1), s);
      const hO = { x: c.x, y: y1, s, t: T, angle: c.a, phase: ph, ...c.o, stirrup: c.rider ? 'ride' : undefined };
      const h = drawHorse(lg, hO);
      if (c.rider && drawHero) {
        const a = drawHero(lg, { x: h.saddle[0], y: h.saddle[1], s, face: hO.face, t: T, phase: ph, pose: 'ride', rot: h.saddleRot, scarf: { len: 260 } });
        if (a && a.handL) drawReins(lg, h.bit, a.handL, { s });
      }
    }
  });
  for (const c of cells) {
    const a = horseRig({ x: c.x, y: y1, s, t: T, angle: c.a, phase: horsePhase(T * 600 * (c.o.face ?? 1), s), ...c.o });
    for (const leg of ['hf', 'hn', 'ff', 'fn']) if (a.contact[leg]) {
      const [hx, hy] = a.hooves[leg];
      g.save(); g.fillStyle = LEGC[leg]; g.beginPath(); g.moveTo(hx, hy + 3); g.lineTo(hx - 6, hy + 14); g.lineTo(hx + 6, hy + 14); g.closePath(); g.fill(); g.restore();
    }
    label(g, c.n, c.x, y1 + 110, 20, { fill: PAL.ink });
  }
  // 跛行强度：bandageLeg fn，limp 1 → 0
  const y2 = 900, s2 = 0.72;
  ground(g, 60, 1860, y2, s2, { h260: false });
  const ks = [1, 0.66, 0.33, 0];
  ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
    ks.forEach((k, i) => drawHorse(lg, { x: 260 + i * 460, y: y2, s: s2, t: T, pose: 'trot', limp: k, bandageLeg: k > 0 ? 'fn' : false, expr: k > 0.5 ? 'hurt' : undefined }));
  });
  ks.forEach((k, i) => label(g, `trot · limp ${k}`, 260 + i * 460, y2 + 34, 20, { fill: PAL.ink }));
}

export default [
  { id: 'sheet_horse_cycle', start: 0, end: 1, draw: (g, T, lt, ctx) => pageCycle(g, T, ctx) },
  { id: 'sheet_horse_poses', start: 1, end: 2, draw: (g, T, lt, ctx) => pagePoses(g, T, ctx) },
  { id: 'sheet_horse_misc', start: 2, end: 3, draw: (g, T, lt, ctx) => pageMisc(g, T, ctx) },
  { id: 'sheet_horse_run', start: 3, end: 10, draw: (g, T, lt, ctx) => pageRun(g, T, ctx) },
  { id: 'sheet_horse_detail', start: 10, end: 14, draw: (g, T, lt, ctx) => pageDetail(g, T, ctx) },
  { id: 'sheet_horse_slope', start: 14, end: 16, draw: (g, T, lt, ctx) => pageSlope(g, T, ctx) },
];
