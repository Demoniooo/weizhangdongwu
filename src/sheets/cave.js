// 模型图：龙洞布景（src/env/cave.js）。页面按时间切换（每页 2 秒）：
//   [0,2) 五种光照 + flat 网格 ｜ [2,4) CV-W 全尺寸 + 布局标注 ｜ [4,6) D3 名字墙：砸落 → 完整 → 撞碎
//   [6,8) flat 与正常版并排 + STANDOFF 对剧场 137.40 ｜ [8,10) 预设机位 ｜ [10,12) 黎明光束 ｜ [12,14) 战斗光 + 碎块冷却 + 字痕
//   [14,16) 全暗 → 水晶依距离亮起 ｜ [16,18) 道具（src/props/cave.js）：鸟笼各状态 / 迷你偶、金币、金币堆、石碑、铁链
// 渲染：node tools/render.mjs stills --sheet cave --times 1,3,4.9,5.4,5.9,7,9,11,13,14.2,15,16.6,17.4 --outdir out/review/sheets/cave
import { PAL, rr } from '../core/paper.js';
import { cam, applyCam, toScreen } from '../core/camera.js';
import { seg, rgba, mixHex, clamp } from '../core/util.js';
import { glyphRow } from '../ui/type.js';
import { drawCave, drawNameWall, drawCrystal, drawStalactite, CAVE, CAMS, STANDOFF, NAME_WALL, CRYSTALS, groundAt, caveAmbient } from '../env/cave.js';
import { drawCage, drawCoin, drawCoinPile, drawStoneTablet, drawChain } from '../props/cave.js';
import { drawTheater } from '../env/theater.js';

let RIG = {};
try { RIG = { ...(await import('../rigs/hero.js')) }; } catch (e) { /* 勇者木偶还没做好：用占位剪影 */ }
try { RIG = { ...RIG, ...(await import('../rigs/princess.js')) }; } catch (e) { /* 占位 */ }
try { RIG = { ...RIG, ...(await import('../rigs/dragon.js')) }; } catch (e) { /* 占位 */ }

const label = (g, text, x, y, size = 26, o = {}) => glyphRow(g, text, x, y, size, { family: 'play', fill: PAL.ink, edge: null, ...o });
const paper = (g) => { g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080); };
// 注意：图层画布是池化复用的，引擎不重置裁剪区，所以 xf 必须包在 save/restore 里（inTile）。
const xf = (lg, r) => { lg.beginPath(); lg.rect(r.x, r.y, r.w, r.h); lg.clip(); lg.translate(r.x, r.y); lg.scale(r.w / 1920, r.h / 1080); };
const inTile = (lg, r, fn) => { lg.save(); xf(lg, r); fn(lg); lg.restore(); };
function frame(g, r) { g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 3; g.strokeRect(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3); g.restore(); }
function heroStub(g, x, y, s = 1, a = 0.9) {
  if (RIG.drawHero) return RIG.drawHero(g, { x, y, s, face: 1, t: 0, pose: 'idle', expr: 'normal' });
  g.save(); g.globalAlpha *= a; g.fillStyle = PAL.heroBlue; g.fill(rr(x - 40 * s, y - 160 * s, 80 * s, 160 * s, 30 * s));
  g.fillStyle = PAL.skin; g.beginPath(); g.arc(x, y - 210 * s, 52 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = PAL.scarf; g.fill(rr(x - 46 * s, y - 165 * s, 120 * s, 22 * s, 10 * s)); g.restore();
}
function princessIn(g, T, light = 1) {
  const s = CAVE.cage.princessS;
  if (RIG.drawPrincess) RIG.drawPrincess(g, { x: CAVE.cage.floor[0], y: CAVE.cage.floor[1], s, face: -1, t: T, pose: 'caged', expr: 'eyeroll' });
  else { g.save(); g.fillStyle = mixHex(PAL.princess, PAL.shadow, (1 - light) * 0.8); g.fill(rr(1320 - 38 * s, 428 - 150 * s, 76 * s, 150 * s, 30 * s)); g.fillStyle = mixHex(PAL.skin, PAL.shadow, (1 - light) * 0.8); g.beginPath(); g.arc(1320, 428 - 190 * s, 44 * s, 0, Math.PI * 2); g.fill(); g.restore(); }
}
/** 正式镜头的分层写法：四层各包一个 ctx.layer，再把鸟笼（含公主）画在主体层。 */
function caveLayers(g, ctx, T, c, o, extra) {
  ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawCave(lg, T, c, { ...o, layer: 'back' }));
  ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => drawCave(lg, T, c, { ...o, layer: 'mid' }));
  ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
    drawCave(lg, T, c, { ...o, layer: 'main' });
    lg.save(); applyCam(lg, c, 1);
    const L = caveAmbient(o, T);
    drawCage(lg, { x: CAVE.cage.x, y: CAVE.cage.y, part: 'back', light: Math.max(0.15, L), tally: 12, lock: { pins: 1 } });
    princessIn(lg, T, L);
    drawCage(lg, { x: CAVE.cage.x, y: CAVE.cage.y, part: 'front', light: Math.max(0.15, L), tally: 12, lock: { pins: 1 } });
    if (extra) extra(lg);
    lg.restore();
  });
  ctx.layer(g, { blur: 4 }, (lg) => drawCave(lg, T, c, { ...o, layer: 'fg' }));
}
function tileCave(g, ctx, T, r, c, o, title) {
  ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg0) => inTile(lg0, r, (lg) => {
    drawCave(lg, T, c, o);
    lg.save(); applyCam(lg, c, 1);
    const L = caveAmbient(o, T);
    drawCage(lg, { x: CAVE.cage.x, y: CAVE.cage.y, part: 'all', light: Math.max(0.15, L), tally: 12 });
    heroStub(lg, CAVE.hero.x, CAVE.hero.y, 1, 0.9 * Math.max(0.2, L));
    lg.restore();
  }));
  frame(g, r);
  label(g, title, r.x, r.y + r.h + 26, 28);
}

const pages = [];
const page = (k, id, draw) => pages.push({ id: 'sheet_cave_' + id, start: k * 2, end: k * 2 + 2, draw });

// —— 0：五种光照 + flat ——
page(0, 'lights', (g, T, lt, ctx) => {
  paper(g);
  label(g, '龙洞 drawCave · 五种光照（CV-W）', 40, 44, 34);
  const R = (i) => ({ x: 40 + (i % 3) * 626, y: 80 + Math.floor(i / 3) * 452, w: 600, h: 337.5 });
  tileCave(g, ctx, T, R(0), CAMS.CV_W, { light: 'dark' }, "light:'dark'（只有点点青光）");
  tileCave(g, ctx, T, R(1), CAMS.CV_W, { light: 'glint', glintAt: 0.2 }, "light:'glint'（离鸟笼近的先亮）");
  tileCave(g, ctx, T, R(2), CAMS.CV_W, { light: 'lit' }, "light:'lit'");
  tileCave(g, ctx, T, R(3), CAMS.CV_W, { light: 'battle', rubble: { at: -5, cooled: 0.2 } }, "light:'battle' + rubble");
  tileCave(g, ctx, T, R(4), CAMS.CV_W, { light: 'dawn', dawnP: 0.25 + 0.75 * seg(lt, 0, 1.8) }, "light:'dawn'（dawnP 扫过）");
  tileCave(g, ctx, T, R(5), cam(960, 540, 1), { ...STANDOFF.caveOpts, flat: true }, 'flat 背景片（按 STANDOFF 冻结）');
});

// —— 1：CV-W 全尺寸 + 布局标注 ——
page(1, 'layout', (g, T, lt, ctx) => {
  const c = CAMS.CV_W;
  caveLayers(g, ctx, T, c, { light: 'lit' }, (lg) => heroStub(lg, CAVE.hero.x, CAVE.hero.y));
  g.save();
  g.strokeStyle = rgba(PAL.goldLight, 0.85); g.fillStyle = PAL.goldLight; g.lineWidth = 2; g.setLineDash([10, 8]);
  g.beginPath(); for (let x = 0; x <= 1920; x += 20) g.lineTo(x, groundAt(x)); g.stroke();
  g.beginPath(); g.moveTo(0, 640); g.lineTo(1920, 640); g.stroke();
  g.setLineDash([]);
  const mark = (x, y, t, dx = 12, dy = -12) => { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); label(g, t, x + dx, y + dy, 24, { fill: PAL.goldLight }); };
  mark(CAVE.cage.x, CAVE.cage.y, '笼心 (1320,330)');
  mark(CAVE.cage.lock[0], CAVE.cage.lock[1], '挂锁 (1232,352)', -250, 30);
  mark(CAVE.cage.hook[0], 4, '吊点 (1320,0)', 14, 22);
  mark(CAVE.hero.x, CAVE.hero.y, '勇者 x=420', 14, 40);
  mark(1700, 780, '金币堆峰 (1700,780)', 14, -16);
  mark(1640, 450, '水晶柱 x=1640', 70, 0);
  mark(1880, 300, '后景水晶 (1880,300)', 18, -24);
  mark(560, 900, '(560,900)', -40, 50); mark(1100, 905, '(1100,905)', -40, 50); mark(140, 960, '前景水晶 (140,960)', 20, 60);
  label(g, '地面 y=900±20（虚线）', 40, 1040, 26, { fill: PAL.goldLight });
  label(g, '260px 身高线 y=640', 1500, 628, 22, { fill: PAL.goldLight });
  g.restore();
});

// —— 2：D3 名字墙 ——
page(2, 'namewall', (g, T, lt, ctx) => {
  const c = CAMS.CV_LOW;
  const dropAt = Array.from({ length: 13 }, (_, i) => 4.15 + i * 0.09 + (i >= 8 ? 0.12 : 0));
  const o = { light: 'lit' };
  ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawCave(lg, T, c, { ...o, layer: 'back' }));
  ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => drawCave(lg, T, c, { ...o, layer: 'mid' }));
  ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
    drawCave(lg, T, c, { ...o, layer: 'main', rubble: { at: 5.7, cooled: 0 } });
    drawNameWall(lg, T, { cam: c, dropAt, glow: 0.4 + 0.6 * seg(T, 5.0, 5.5), burst: 5.7 });
  });
  ctx.layer(g, { blur: 4 }, (lg) => drawCave(lg, T, c, { ...o, layer: 'fg' }));
  g.fillStyle = rgba(PAL.paper, 0.85); g.fill(rr(30, 24, 980, 56, 10));
  label(g, `drawNameWall · CV-LOW · 8 + 5 块（4.15 起每 0.09s 落一块，5.70 撞碎）  T=${T.toFixed(2)}`, 46, 52, 26);
});

// —— 3：flat 对正常版、STANDOFF 对剧场 137.40 ——
page(3, 'standoff', (g, T, lt, ctx) => {
  paper(g);
  label(g, 'STANDOFF：上 = 正常分层（b11 结尾，带黑边）／ 下 = 剧场 grow=0（b12 137.40）', 40, 44, 30);
  const A = { x: 40, y: 70, w: 860, h: 483.75 }, B = { x: 980, y: 70, w: 860, h: 483.75 };
  const Cc = { x: 40, y: 610, w: 740, h: 416.25 }, D = { x: 980, y: 610, w: 740, h: 416.25 };
  const so = STANDOFF;
  const marks = (lg) => {
    lg.fillStyle = PAL.goldLight;
    for (const [x, y] of [so.hero, so.dragonHead, so.dragonBody, so.cage]) { lg.beginPath(); lg.arc(x, y, 10, 0, Math.PI * 2); lg.fill(); }
  };
  ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg0) => inTile(lg0, A, (lg) => {
    drawCave(lg, T, so.cam, { ...so.caveOpts });
    lg.save(); applyCam(lg, so.cam, 1);
    drawCage(lg, { x: 1320, y: 330, light: 0.92 });
    heroStub(lg, so.world.hero[0], so.world.hero[1]);
    lg.restore();
    lg.fillStyle = PAL.shadow; lg.fillRect(0, 0, 1920, 138.3); lg.fillRect(0, 1080 - 138.3, 1920, 138.3);
    marks(lg);
  }));
  ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg0) => inTile(lg0, B, (lg) => {
    drawTheater(lg, T, { part: 'back', grow: 0 });
    lg.save(); drawCage(lg, { x: 1480, y: 330, s: so.cam.zoom, light: 0.92 }); heroStub(lg, 520, 840, so.cam.zoom); lg.restore();
    drawTheater(lg, T, { part: 'frame', grow: 0 });
    marks(lg);
  }));
  ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg0) => inTile(lg0, Cc, (lg) => drawCave(lg, T, CAMS.CV_W, { light: 'lit' })));
  ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg0) => inTile(lg0, D, (lg) => drawCave(lg, T, CAMS.CV_W, { light: 'lit', flat: true, flatRef: CAMS.CV_W })));
  [A, B, Cc, D].forEach((r) => frame(g, r));
  label(g, '正常分层 STANDOFF.cam', A.x, A.y + A.h + 26, 22);
  label(g, '剧场 back+frame grow=0', B.x, B.y + B.h + 26, 22);
  label(g, '正常 CV-W', Cc.x, Cc.y + Cc.h + 26, 24);
  label(g, 'flat（flatRef=CV-W：同构图、降饱和、不含前景层）', D.x, D.y + D.h + 30, 24);
  label(g, `cam(${so.cam.x}, ${so.cam.y}, ${so.cam.zoom})  勇者世界 (${so.world.hero.join(', ')})`, 400, 590, 20);
});

// —— 4：预设机位 ——
page(4, 'cams', (g, T, lt, ctx) => {
  paper(g);
  label(g, '预设机位 CAMS（lit）', 40, 44, 32);
  const names = ['CV_W', 'CV_WIDE', 'CV_2S', 'CU_H_CAVE', 'CU_D', 'CV_CAGE', 'CV_LOW', 'CV_LOW_END'];
  names.forEach((n, i) => {
    const r = { x: 30 + (i % 4) * 472, y: 80 + Math.floor(i / 4) * 490, w: 450, h: 253.1 };
    tileCave(g, ctx, T, r, CAMS[n], { light: 'lit' }, n);
  });
  ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
    lg.save(); lg.translate(30, 900);
    drawCrystal(lg, { x: 80, y: 140, s: 0.9, n: 5, seed: 31, lit: 1, t: T }); drawCrystal(lg, { x: 250, y: 140, s: 0.9, n: 5, seed: 31, lit: 0.1, t: T });
    drawCrystal(lg, { x: 430, y: 140, s: 0.9, n: 7, seed: 29, lit: 1, ring: seg(lt, 0, 1), t: T });
    drawStalactite(lg, { x: 600, y: 0, len: 150, w: 40, seed: 5 }); drawStalactite(lg, { x: 680, y: 0, len: 90, w: 28, seed: 9 });
    lg.restore();
  });
  label(g, 'drawCrystal lit 1 / 0.1 / glint 光环 · drawStalactite', 780, 1000, 24);
});

// —— 5：黎明 ——
page(5, 'dawn', (g, T, lt, ctx) => {
  const c = cam(1300, 420, 1.5);
  const d = seg(lt, 0.1, 1.8);
  caveLayers(g, ctx, T, c, { light: { from: 'battle', to: 'dawn', k: seg(lt, 0, 0.4) }, dawnP: d, rubble: { at: -10, cooled: 0.6 + 0.4 * d }, chain: false }, null);
  g.fillStyle = rgba(PAL.paper, 0.85); g.fill(rr(30, 24, 760, 56, 10));
  label(g, `E01 黎明 cam(1300,420,1.5)  dawnP=${d.toFixed(2)}`, 46, 52, 26);
});

// —— 6：战斗光 + 碎块冷却 + 字痕 ——
page(6, 'battle', (g, T, lt, ctx) => {
  const c = cam(1000, 560, 1.1);
  const scorch = '昆图库塔'.split('').map((ch, i) => ({ ch, x: 260 + i * 130, y: 330 + (i % 2) * 60, at: 12.1 + i * 0.22, size: 110, screen: true, rot: (i - 1.5) * 0.08 }));
  caveLayers(g, ctx, T, c, { light: 'battle', rubble: { at: 11.0, cooled: seg(lt, 0, 1.9) }, scorch }, null);
  g.fillStyle = rgba(PAL.paper, 0.85); g.fill(rr(30, 24, 860, 56, 10));
  label(g, `battle · rubble cooled=${seg(lt, 0, 1.9).toFixed(2)} · scorch 字痕（屏幕坐标）`, 46, 52, 26);
});

// —— 7：全暗 → glint ——
page(7, 'glint', (g, T, lt, ctx) => {
  const c = CAMS.CV_W;
  caveLayers(g, ctx, T, c, { light: lt < 0.25 ? 'dark' : 'glint', glintAt: 14.25 }, (lg) => heroStub(lg, 380, 860, 1, 0.5));
  g.fillStyle = rgba(PAL.paper, 0.85); g.fill(rr(30, 24, 760, 56, 10));
  label(g, `dark → glint（glintAt=14.25，中心 = 鸟笼）  T=${T.toFixed(2)}`, 46, 52, 26);
});

// —— 8：道具（src/props/cave.js）——
page(8, 'props', (g, T, lt, ctx) => {
  paper(g);
  label(g, '道具 src/props/cave.js：鸟笼 drawCage · 金币 drawCoin · 金币堆 drawCoinPile · 石碑 drawStoneTablet · 铁链 drawChain', 40, 44, 28);
  const k = seg(lt, 0.2, 1.6);
  ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
    // 第一行：鸟笼（锚 = 笼心，s=1 180×240）
    drawCage(lg, { x: 170, y: 300, tally: 12, lock: { pins: 0 }, chain: 40 });
    drawCage(lg, { x: 450, y: 300, tally: 7, door: 0.5 * k, lock: { pins: 2, flash: 1 - k }, chain: 40 });
    drawCage(lg, { x: 730, y: 300, tally: 20, door: 1, lock: { pins: 3, open: true }, chain: 40 });
    drawCage(lg, { x: 1010, y: 300, onFloor: true, squash: 0.22 * Math.sin(Math.PI * k) * (1 - k), tally: 12, lock: { pins: 3, open: true }, door: 0.35 });
    drawCage(lg, { x: 1290, y: 300, chain: 110, swing: 0.28 * Math.sin(T * 2.4), light: 0.45, tally: 12 });
    drawCage(lg, { x: 1560, y: 330, mini: true, stick: 120, lock: { pins: 1 } });
    drawCage(lg, { x: 1780, y: 330, mini: true, stick: 120, door: k, lock: { pins: 3, open: true } });
    // 第二行：金币（spin 序列、bite、flash）+ 金币堆
    [0, 0.6, 1.2, 1.5, 2.2, Math.PI].forEach((sp, i) => drawCoin(lg, { x: 110 + i * 92, y: 600, s: 1.6, spin: sp }));
    drawCoin(lg, { x: 680, y: 600, s: 1.6, bite: 0.5 });
    drawCoin(lg, { x: 772, y: 600, s: 1.6, bite: 1 });
    drawCoin(lg, { x: 864, y: 600, s: 1.6, spin: T * 6, flash: 1 - seg(lt, 0, 0.8), t: T });
    drawCoinPile(lg, { x: 1230, y: 700, w: 520, h: 110, sparkleT: T });
    drawCoinPile(lg, { x: 1690, y: 700, w: 340, h: 80, peak: 0.4, seed: 3, sparkleT: T, light: 0.3, gems: false });
    // 第三行：石碑（锚 = 底边中心）+ 铁链
    drawStoneTablet(lg, { x: 130, y: 1010, size: 150, char: '昆', seed: 41 });
    drawStoneTablet(lg, { x: 320, y: 1010, size: 150, char: '图', glow: 1, seed: 42, t: T });
    drawStoneTablet(lg, { x: 510, y: 1010, size: 150, char: '库', glow: 1, crack: k, seed: 43, t: T });
    drawStoneTablet(lg, { x: 700, y: 1010, size: 150, char: '塔', glow: 0.6, squash: 0.16 * (1 - k), light: 0.5, seed: 44, t: T });
    drawChain(lg, [[930, 860], [1080, 905], [1240, 880], [1380, 930]]);
    drawChain(lg, [[1460, 860], [1600, 900], [1740, 875], [1870, 925]], { gold: true, s: 1.4 });
  });
  const L = (t, x, y) => label(g, t, x, y, 21);
  L('关 · tally 12 · pins 0', 70, 455); L('door 0→0.5 · pins 2 闪', 350, 455); L('door 1 · open · 20 画', 630, 455);
  L('onFloor · squash 落地', 910, 455); L('swing · light 0.45', 1200, 455); L('mini 关 / 开门', 1560, 455);
  L('spin 0 → π（背面）', 110, 660); L('bite 0.5 / 1 · flash', 660, 660);
  L('金币堆 light 1 / 0.3', 1240, 740);
  L('石碑 glow 0 / 1 / crack / squash', 120, 1050); L('铁链 / 金链 s1.4', 1100, 980);
});

export default pages;
