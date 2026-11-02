// 模型图：纸剧场（src/env/theater.js）。页面按时间切换：
//   [0,2) 黑边长成台口（grow 0→1）｜ [2,4) 十二种状态网格 ｜ [4,6) TT-OUT（剑穿侧幕、撕开顶幕、暗房）
//   [6,8) 布局 / 字幕带检查 ｜ [8,32.1) theaterState 实时回放（T' = 137.40 + (T − 8)，驱动 kit 名字牌 / 菜单 / 横幅 + 木偶）
// 渲染：node tools/render.mjs stills --sheet theater --times 0.5,1.7,3,5,7 --outdir out/review/sheets/theater
import { PAL, rr } from '../core/paper.js';
import { cam, applyCam } from '../core/camera.js';
import { seg, clamp, rgba, lerp } from '../core/util.js';
import { glyphRow } from '../ui/type.js';
import { drawTheater, theaterState, theaterClip, THEATER, CAMS } from '../env/theater.js';
import { drawCage } from '../props/cave.js';
import { cue } from '../cues.js';

let K = {};
for (const m of ['../rigs/hero.js', '../rigs/princess.js', '../rigs/dragon.js', '../ui/kit.js', '../props/sword.js']) {
  try { K = { ...K, ...(await import(m)) }; } catch (e) { /* 其它组的模块还没好：用占位 */ }
}

const label = (g, text, x, y, size = 26, o = {}) => glyphRow(g, text, x, y, size, { family: 'play', fill: PAL.ink, edge: null, ...o });
const paper = (g) => { g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080); };
// 图层画布池化复用、引擎不重置裁剪：裁剪一律包在 save/restore 里
const inTile = (lg, r, fn) => { lg.save(); lg.beginPath(); lg.rect(r.x, r.y, r.w, r.h); lg.clip(); lg.translate(r.x, r.y); lg.scale(r.w / 1920, r.h / 1080); fn(lg); lg.restore(); };
const frameR = (g, r) => { g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 3; g.strokeRect(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3); g.restore(); };

/** 木偶层（剧场坐标）：笼中迷你偶、龙偶、勇者偶。按推荐写法裁进剧场盒子（theaterClip），TT-OUT 时龙身 / 围巾不伸出剧场。 */
function puppets(lg, T, o = {}) {
  const c = o.cam || CAMS.TT_W;
  lg.save(); lg.clip(theaterClip({ cam: c, scale: o.scale ?? 1 })); applyCam(lg, c, 1);
  if (o.scale && o.scale !== 1) { lg.translate(960, 540); lg.scale(o.scale, o.scale); lg.translate(-960, -540); }
  const cg = THEATER.cage;
  drawCage(lg, { x: cg.x, y: cg.y, mini: true, part: 'back', lock: { pins: 1 } });
  if (K.drawPrincess) K.drawPrincess(lg, { x: cg.x, y: cg.y + 62, s: 0.5, face: -1, t: T, pose: 'puppetCage', expr: 'tense', sign: o.sign ?? 0 });
  drawCage(lg, { x: cg.x, y: cg.y, mini: true, part: 'front', lock: { pins: 1 } });
  if (K.drawDragon) K.drawDragon(lg, { pose: 'puppet', t: T, jaw: o.jaw ?? 0.05, eyes: { open: 1, state: o.angry ? 'angry' : 'normal' } });
  else { lg.fillStyle = PAL.dragon; lg.beginPath(); lg.ellipse(1350, 520, 150, 110, 0, 0, Math.PI * 2); lg.fill(); }
  if (K.drawHero) K.drawHero(lg, { x: o.heroX ?? THEATER.hero.x, y: THEATER.hero.y, s: 1, face: 1, t: T, pose: o.heroPose || 'puppetStand', rod: true, sword: 'hand' });
  else { lg.fillStyle = PAL.heroBlue; lg.fill(rr(480, 600, 80, 240, 30)); }
  lg.restore();
}
/** 界面层（剧场坐标，跟着剧场机位与缩放）。 */
function ui(lg, T, st) {
  if (!K.marqueePlate) return;
  lg.save(); applyCam(lg, st.cam, 1);
  if (st.scale !== 1) { lg.translate(960, 540); lg.scale(st.scale, st.scale); lg.translate(-960, -540); }
  const hp = st.heroPlate, dp = st.dragonPlate;
  K.marqueePlate(lg, { side: 'hero', progress: hp.progress, state: hp.state, drop: hp.drop, t: T, hp: st.hp.hero, hpLag: st.hp.heroLag, peeled: hp.peeled, crack: hp.crack });
  K.marqueePlate(lg, { side: 'dragon', progress: dp.progress, state: dp.state, drop: dp.drop, t: T, hp: st.hp.dragon, hpLag: st.hp.dragonLag, shrink: dp.shrink });
  if (K.turnBanner) K.turnBanner(lg, { text: st.banner.text, textFrom: st.banner.prev, flip: st.banner.flip < 1 ? st.banner.flip : 0, drop: st.banner.drop, t: T });
  if (K.battleMenu) K.battleMenu(lg, { pop: st.menu.show, cursor: st.menu.cursor === 'skill' ? lerp(0, 1, st.menu.cursorMove) : 0, locked: st.menu.gray, t: T });
  lg.restore();
}

const pages = [];
const page = (k0, k1, id, draw) => pages.push({ id: 'sheet_theater_' + id, start: k0, end: k1, draw });

// —— 0：黑边长成台口 ——
page(0, 2, 'grow', (g, T, lt, ctx) => {
  const grow = seg(lt, 0.15, 1.35);
  const o = { grow };
  ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawTheater(lg, T, { ...o, part: 'back' }));
  ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => puppets(lg, T, {}));
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawTheater(lg, T, { ...o, part: 'frame' }));
  g.fillStyle = rgba(PAL.paper, 0.85); g.fill(rr(1360, 960, 520, 50, 10));
  label(g, `grow = ${grow.toFixed(2)}（0 = 138.3px 黑边）`, 1376, 986, 26);
});

// —— 1：状态网格 ——
page(2, 4, 'states', (g, T, lt, ctx) => {
  paper(g);
  const S = [
    ['grow 0', { grow: 0 }], ['grow 0.5', { grow: 0.5 }], ['grow 1（暖光）', { grow: 1 }], ['curtain 0.55', { curtain: 0.55 }],
    ['curtain 1（合幕）', { curtain: 1 }], ['bite 0.6', { bite: 0.6 }], ['bite 1（黑缝）', { bite: 1 }], ['wingTear 1 + valance torn', { wingTear: 1, valance: 'torn', tearP: 1, sword: true }],
    ['valance halves（掉落中）+ floorCrack', { valance: 'halves', tearP: 1, fallAt: 2.75, floorCrack: 1 }], ["light 'purple'", { light: 'purple' }], ["light 'off'", { light: 'off', curtain: 0.97 }], ['scale 1.35 + curtain 0.3（E01）', { scale: 1.35, curtain: 0.3 }],
  ];
  S.forEach(([name, o], i) => {
    const r = { x: 30 + (i % 4) * 472, y: 40 + Math.floor(i / 4) * 345, w: 448, h: 252 };
    ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg0) => inTile(lg0, r, (lg) => {
      drawTheater(lg, T, { ...o, part: 'back' });
      puppets(lg, T, { scale: o.scale });
      drawTheater(lg, T, { ...o, part: 'frame' });
      if (o.sword) { lg.fillStyle = PAL.steel; lg.fill(rr(560, 500, 1500, 120, 10)); lg.fillStyle = PAL.steelDark; lg.fillRect(560, 600, 1500, 20); }
      drawTheater(lg, T, { ...o, part: 'frameFront' });
    }));
    frameR(g, r);
    label(g, name, r.x, r.y + r.h + 26, 24);
  });
});

// —— 2：TT-OUT ——
page(4, 6, 'out', (g, T, lt, ctx) => {
  const c = CAMS.TT_OUT;
  const vert = seg(lt, 0.9, 1.3);
  const o = { cam: c, wingTear: 1, wingTearUp: seg(lt, 0.9, 1.02), valance: vert > 0 ? 'torn' : 'whole', tearP: vert };
  ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawTheater(lg, T, { ...o, part: 'back' }));
  ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => puppets(lg, T, { cam: c, heroPose: 'puppetHoldSword' }));
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawTheater(lg, T, { ...o, part: 'frame' }));
  ctx.layer(g, { shadow: 10, texture: 0.2 }, (lg) => {
    lg.save(); applyCam(lg, c, 1);
    if (K.drawNameSword) K.drawNameSword(lg, { x: 600, y: 560, angle: -Math.PI / 2 * vert, glow: vert, scarfWrap: 1, t: T });
    else { lg.fillStyle = PAL.steel; lg.fill(rr(660, 500, 1650, 120, 10)); }
    lg.restore();
    drawTheater(lg, T, { ...o, part: 'frameFront' });
  });
  g.fillStyle = rgba(PAL.paper, 0.85); g.fill(rr(30, 24, 820, 50, 10));
  label(g, 'TT-OUT cam(960,420,0.62)：暗房 + 桌沿 + 剑穿右侧幕 → 竖起撕开顶幕', 46, 50, 24);
});

// —— 3：布局 / 字幕带 ——
page(6, 8, 'layout', (g, T, lt, ctx) => {
  const st = theaterState(139.0);
  ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawTheater(lg, T, { part: 'back' }));
  ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => puppets(lg, T, {}));
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawTheater(lg, T, { part: 'frame' }));
  ctx.layer(g, { shadow: 8, texture: 0.2 }, (lg) => ui(lg, T, st));
  g.save();
  g.strokeStyle = PAL.goldLight; g.lineWidth = 2; g.setLineDash([12, 8]);
  g.beginPath(); g.moveTo(0, 920); g.lineTo(1920, 920); g.stroke();
  g.beginPath(); g.moveTo(0, THEATER.floorY); g.lineTo(1920, THEATER.floorY); g.stroke();
  const R = (q) => g.strokeRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0);
  R(THEATER.opening); R(THEATER.heroPlate); R(THEATER.dragonPlate); R(THEATER.menu);
  g.setLineDash([]);
  g.fillStyle = PAL.goldLight;
  for (const [x, y] of [[THEATER.hero.x, THEATER.hero.y], THEATER.dragon.head, THEATER.dragon.body, [THEATER.cage.x, THEATER.cage.y], THEATER.sword.guard]) { g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill(); }
  g.restore();
  label(g, '字幕带 y≥920：只有台唇与脚灯', 1290, 905, 24, { fill: PAL.goldLight });
  label(g, '木偶脚底线 y=840', 1290, 828, 22, { fill: PAL.goldLight });
});

// —— 4：theaterState 回放（137.40 → 161.50） ——
page(8, 32.1, 'state', (g, T, lt, ctx) => {
  const Tf = 137.4 + lt;
  const st = theaterState(Tf);
  const o = { ...st, cave: st.caveOpts }; // 字段名与 drawTheater 参数同名，直接展开
  const inMouth = Tf >= 149.45 && Tf < cue('B08');
  const heroPose = inMouth ? 'puppetInMouth' : Tf >= 153.78 ? 'puppetHoldSword' : Tf >= cue('B08') && Tf < 153.2 ? 'puppetKneel' : 'puppetStand';
  const heroX = inMouth ? 1240 : Tf >= 140.5 && Tf < 142.6 ? lerp(520, 760, seg(Tf, 140.5, 141.2)) * (1 - seg(Tf, 142.5, 143.2)) + 520 * seg(Tf, 142.5, 143.2) : 520;
  ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawTheater(lg, Tf, { ...o, part: 'back' }));
  if (st.scale < 1.79) ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => puppets(lg, Tf, { cam: st.cam, scale: st.scale, heroPose, heroX, jaw: Tf >= cue('B06') && Tf < 149.48 ? seg(Tf, 146.9, 149.2) : inMouth ? 0.5 : 0.05, angry: Tf >= cue('B05') && Tf < 153.3, sign: Tf >= 152.8 && Tf < 153.6 ? 1 : 0 }));
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawTheater(lg, Tf, { ...o, part: 'frame' }));
  ctx.layer(g, { shadow: 10, texture: 0.2 }, (lg) => {
    if (Tf >= 153.78 && Tf < 160.9 && K.drawNameSword) {
      lg.save(); applyCam(lg, st.cam, 1);
      const b10 = st.heroPlate.peelTimes;
      const tiles = b10.map((t) => clamp((Tf - t) / 0.25));
      const ang = -Math.PI / 2 * seg(Tf, 156.8, 157.1) + Math.PI / 2 * seg(Tf, 157.17, 157.32);
      K.drawNameSword(lg, { x: 600, y: 560, tiles, angle: ang, glow: seg(Tf, 156.8, 157.1), scarfWrap: seg(Tf, 153.78, 154.1), t: Tf });
      lg.restore();
    }
    drawTheater(lg, Tf, { ...o, part: 'frameFront' });
    ui(lg, Tf, st);
  });
  g.fillStyle = rgba(PAL.paper, 0.9); g.fill(rr(24, 960, 1300, 100, 10));
  label(g, `T'=${Tf.toFixed(2)} turn=${st.turn} grow=${st.grow.toFixed(2)} bite=${st.bite.toFixed(2)} curtain=${st.curtain.toFixed(2)} light=${st.light}`, 40, 990, 22);
  label(g, `勇者牌 ${st.heroPlate.state} p=${st.heroPlate.progress.toFixed(2)} 剥=${st.heroPlate.peeled}  龙牌 ${st.dragonPlate.state} p=${st.dragonPlate.progress.toFixed(2)} 弹飞=${st.dragonPlate.popped}  HP ${st.hp.heroNum} / ${(st.hp.dragon * 100).toFixed(0)}%  cam z=${st.cam.zoom.toFixed(2)}`, 40, 1030, 22);
});

export default pages;
