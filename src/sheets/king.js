// 模型图：国王（src/rigs/king.js）。
// 时间轴：[0,2) 动作全表（循环动作随 t 动）｜[2,4) 表情全表｜[4,6) 王冠五态与特殊状态（puff 气球线、dangle、faint+legsUp、wrapped、peek、CU-K、s=0.26 阳台版）
//        ｜[6,8) 动态：连蹦三下 + 王冠飞起、慌跑转身、金印抡砸、拍手 / 挥帕 / 竖指盖眼。
// 出图：node tools/render.mjs stills --sheet king --times 0.5,1.7,2.5,4.5,6.5 --outdir out/review/sheets/king
//       node tools/render.mjs sheet --sheet king --from 6 --to 8 --every 0.1 --cols 7 --tile 360 --out out/review/sheets/king/anim.jpg
import { PAL, blob, cut } from '../core/paper.js';
import { clamp, lerp, fract, rgba, wobble, TAU } from '../core/util.js';
import { outBack, spring, inQuad, outQuad } from '../core/ease.js';
import { drawKing, drawKingCrown, KING_POSES, KING_EXPRS } from '../rigs/king.js';
import { drawStampMark, drawCrown, ell } from '../props/royal.js';
import { label, header, cell } from './royal.js';

const POSE_EXPR = {
  idle: 'smile', sit: 'confident', hop: 'joy', pace: 'panic', holdHead: 'panic', stoop: 'gasp', clutch: 'tearful', lookFar: 'squint',
  leanForward: 'squint', cupEar: 'squint', fingerUp: 'confident', puff: 'puffed', dangle: 'sick', sealRaise: 'confident', sealSlam: 'joy',
  crouch: 'confident', faint: 'faint', raiseScepter: 'proud', placeTiara: 'joy', giveHand: 'tearful', clap: 'joy', wipeTears: 'waterfall',
  biteNails: 'panic', slump: 'relieved', wave: 'joy', bow: 'smile', peek: 'starEyes', gasp: 'gasp', leap: 'joy',
};
const SEATED = new Set(['sit', 'slump']);

function stool(g, x, y, w = 70) {
  cut(g, blob(x, y + 4, w * 0.6, 8, { seed: 9 }), PAL.redDark, {});
  g.fillStyle = PAL.woodDark; g.fillRect(x - w * 0.45, y + 8, 7, 34); g.fillRect(x + w * 0.45 - 7, y + 8, 7, 34);
}

function page1(g, T, ctx) {
  header(g, 'king.js  ·  动作 KING_POSES（' + KING_POSES.length + '）', 's = 0.6 · 红虚线 = s=1 时 260px 身高线 × s');
  const cols = 8, cw = 232, ch = 252, x0 = 32, y0 = 72;
  const s = 0.6;
  KING_POSES.forEach((pose, i) => {
    const cx = x0 + (i % cols) * cw, cy = y0 + Math.floor(i / cols) * ch;
    const foot = cy + ch - 48;
    cell(g, cx, cy, cw - 6, ch - 6, { title: pose, foot, h260: 260 * s });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      const o = { x: cx + cw / 2 - 6, y: foot, s, t: T, pose, expr: POSE_EXPR[pose] };
      if (SEATED.has(pose)) { stool(lg, o.x, foot - 40 * s - 2); o.y = foot - 40 * s - 2; }
      if (pose === 'faint') { o.legsUp = 1; o.stars = 1; o.y = foot - 2; o.x = cx + cw - 50; }
      if (pose === 'peek') { o.y = foot; o.s = 0.9; o.peekHands = true; }
      if (pose === 'dangle') o.crown = { squash: 0.6, pop: 4 };
      if (pose === 'holdHead') o.crown = { slip: 1 };
      if (pose === 'cupEar') { o.earScale = 1.3; o.crown = { tilt: 15 }; }
      if (pose === 'puff') o.cheeks = 1;
      if (pose === 'wave') o.festive = true;
      drawKing(lg, o);
    });
    if (pose === 'peek') { g.fillStyle = rgba(PAL.kraftDark, 0.5); g.fillRect(cx + 10, foot, cw - 26, 3); }
  });
  // 朝左一排的示例（face = −1）
  const extra = ['cupEar', 'fingerUp', 'raiseScepter'];
  extra.forEach((pose, i) => {
    const k = KING_POSES.length + i;
    const cx = x0 + (k % cols) * cw, cy = y0 + Math.floor(k / cols) * ch;
    const foot = cy + ch - 48;
    cell(g, cx, cy, cw - 6, ch - 6, { title: pose + '  face -1', foot, h260: 260 * s });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => drawKing(lg, { x: cx + cw / 2 - 6, y: foot, s, t: T, pose, face: -1, expr: POSE_EXPR[pose], earScale: pose === 'cupEar' ? 1.3 : 1, crown: pose === 'cupEar' ? { tilt: 15 } : {} }));
  });
}

function page2(g, T, ctx) {
  header(g, 'king.js  ·  表情 KING_EXPRS（' + KING_EXPRS.length + '）', 'CU 胸像 s = 1.25');
  const cols = 5, cw = 374, ch = 330, x0 = 18, y0 = 72;
  KING_EXPRS.forEach((expr, i) => {
    const cx = x0 + (i % cols) * cw, cy = y0 + Math.floor(i / cols) * ch;
    cell(g, cx, cy, cw - 8, ch - 8, { title: expr });
    g.save();
    g.beginPath(); g.rect(cx + 6, cy + 6, cw - 20, ch - 52); g.clip();
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      const o = { x: cx + cw / 2 - 4, y: cy + 400, s: 1.25, t: T, pose: 'idle', expr };
      if (expr === 'puffed') o.cheeks = 1;
      if (expr === 'squint') o.crown = { tilt: 15 };
      if (expr === 'faint') o.stars = 1;
      drawKing(lg, o);
    });
    g.restore();
  });
}

function balloon(g, x, y, r, c) {
  cut(g, blob(x, y, r, r * 1.12, { seed: Math.round(x) % 97 }), c, { rim: PAL.white });
  g.fillStyle = rgba(PAL.white, 0.7); g.fill(ell(x - r * 0.35, y - r * 0.4, r * 0.18, r * 0.3, -0.4));
}

function page3(g, T, ctx) {
  header(g, 'king.js  ·  王冠五态 / puff·气球线 / dangle / faint+legsUp / wrapped / peek / CU-K / s=0.26', 'special states');
  // 王冠五态
  const crowns = [['端正', {}], ['tilt 15°', { tilt: 15 }], ['slip 1 盖眼', { slip: 1 }], ['squash 1 勒扁', { squash: 1 }], ['pop 40', { pop: 40 }]];
  crowns.forEach(([name, c], i) => {
    const cx = 18 + i * 196, cy = 72;
    cell(g, cx, cy, 190, 300, { title: 'crown ' + name });
    g.save(); g.beginPath(); g.rect(cx + 6, cy + 6, 178, 252); g.clip();
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => drawKing(lg, { x: cx + 95, y: cy + 380, s: 1.05, t: T, pose: 'idle', expr: i === 2 ? 'panic' : i === 3 ? 'sick' : i === 4 ? 'gasp' : 'smile', crown: c }));
    g.restore();
  });
  // puff + cheeks + 气球线汇聚在嘴
  {
    const cx = 1000, cy = 72;
    cell(g, cx, cy, 300, 300, { title: 'puff + cheeks=1（线汇于 mouth）' });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      const a = drawKing(lg, { x: cx + 170, y: cy + 262, s: 0.78, t: T, pose: 'puff', cheeks: 1 });
      const balls = [[cx + 40, cy + 70, PAL.princessLight], [cx + 95, cy + 40, PAL.skyDay], [cx + 70, cy + 120, PAL.leafLight], [cx + 140, cy + 80, PAL.goldLight]];
      lg.strokeStyle = PAL.inkSoft; lg.lineWidth = 1.4;
      for (const [bx, by] of balls) { lg.beginPath(); lg.moveTo(a.mouth[0], a.mouth[1]); lg.quadraticCurveTo((bx + a.mouth[0]) / 2, by + 60, bx, by + 22); lg.stroke(); }
      for (const [bx, by, c] of balls) balloon(lg, bx, by, 20, c);
      lg.fillStyle = PAL.red; lg.fill(ell(a.mouth[0], a.mouth[1], 3, 3));
    });
  }
  // dangle（被气球吊起，王冠勒扁）
  {
    const cx = 1310, cy = 72;
    cell(g, cx, cy, 290, 300, { title: 'dangle + squash 1' });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      const a = drawKing(lg, { x: cx + 145, y: cy + 250, s: 0.72, t: T, pose: 'dangle', expr: 'sick', crown: { squash: 1, pop: 6 } });
      lg.strokeStyle = PAL.inkSoft; lg.lineWidth = 1.3;
      for (let k = 0; k < 7; k++) { const bx = cx + 40 + k * 35; lg.beginPath(); lg.moveTo(a.crownTop[0] + (k - 3) * 4, a.crownTop[1] + 10); lg.lineTo(bx, cy + 40); lg.stroke(); }
      for (let k = 0; k < 7; k++) balloon(lg, cx + 40 + k * 35, cy + 30, 14, [PAL.princessLight, PAL.skyDay, PAL.leafLight, PAL.goldLight][k % 4]);
    });
  }
  // faint + legsUp（地面与王座）
  {
    const cx = 1610, cy = 72;
    cell(g, cx, cy, 292, 300, { title: 'faint + legsUp（地面 / 座）', foot: cy + 250 });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      drawKing(lg, { x: cx + 250, y: cy + 250, s: 0.55, t: T, pose: 'faint', legsUp: 1, expr: 'faint', stars: 1 });
      stool(lg, cx + 150, cy + 130);
      drawKing(lg, { x: cx + 150, y: cy + 130, s: 0.5, t: T, pose: 'faint', joints: { tilt: 34 }, legsUp: 0.8, expr: 'dizzy' });
    });
  }
  // wrapped 0.5 / 1
  [0.5, 1].forEach((w, i) => {
    const cx = 18 + i * 220, cy = 384;
    cell(g, cx, cy, 214, 330, { title: 'wrapped ' + w, foot: cy + 290 });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => drawKing(lg, { x: cx + 107, y: cy + 290, s: 0.85, t: T, pose: 'idle', expr: w === 1 ? 'dizzy' : 'panic', wrapped: w }));
  });
  // beardFlip / green / bandage + festive / earScale
  const misc = [
    ['beardFlip 1（L08）', { beardFlip: 1, pose: 'leanForward', expr: 'gasp' }],
    ['beardFlip 0.45', { beardFlip: 0.45, pose: 'leanForward', expr: 'gasp' }],
    ['green 1 / sick', { expr: 'sick', pose: 'idle' }],
    ['bandage + festive + scepter', { bandage: true, festive: true, pose: 'raiseScepter', expr: 'proud' }],
    ['silhouette keep crown', { silhouette: true, keepColor: ['crown'], pose: 'hop' }],
    ['rod（剧场木杆）', { rod: true, pose: 'clap', expr: 'joy' }],
  ];
  misc.forEach(([name, o], i) => {
    const cx = 458 + i * 240, cy = 384;
    cell(g, cx, cy, 234, 330, { title: name, foot: cy + 290 });
    g.save(); g.beginPath(); g.rect(cx + 6, cy + 6, 222, 282); g.clip();
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => drawKing(lg, { x: cx + 117, y: cy + 290, s: 0.82, t: T, ...o }));
    g.restore();
  });
  // peek（裁切线 = 画面下沿）
  {
    const cx = 18, cy = 724;
    cell(g, cx, cy, 440, 346, { title: 'peek：瞪眼 / 挑眉 / 星星眼 / 瀑布泪' });
    const exs = [['gasp', 'wide'], [{ eyes: 'dot', brows: 'up', mouth: 'smile' }, 'brow'], ['starEyes', 'star'], ['waterfall', 'tears']];
    exs.forEach(([e], i) => {
      const px = cx + 60 + i * 105, py = cy + 250;
      ctx.layer(g, { shadow: 4, texture: 0.25 }, (lg) => drawKing(lg, { x: px, y: py, s: 0.85, t: T, pose: 'peek', expr: e, crown: i === 3 ? { tilt: -8 } : {} }));
    });
    g.fillStyle = PAL.kraftDark; g.fillRect(cx + 10, cy + 250, 420, 4);
    label(g, '↑ 裁切线（锚点）', cx + 220, cy + 280, 18);
  }
  // CU-K：zoom 3.3 机位
  {
    const cx = 468, cy = 724;
    cell(g, cx, cy, 700, 346, { title: 'CU-K（zoom 3.3）胡子与貂皮点' });
    g.save(); g.beginPath(); g.rect(cx + 6, cy + 6, 688, 300); g.clip();
    ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
      lg.translate(cx + 350, cy + 150); lg.scale(3.3 * 0.62, 3.3 * 0.62); lg.translate(-1500, -650);
      drawKing(lg, { x: 1500, y: 790, s: 1, t: T, pose: 'cupEar', face: -1, expr: 'squint', earScale: 1.3, crown: { tilt: 15 } });
    });
    g.restore();
  }
  // s = 0.26：CA-BAL（zoom 2.6）与 CA-W（zoom 1，detail 0）
  {
    const cx = 1178, cy = 724;
    cell(g, cx, cy, 724, 346, { title: 's=0.26 · CA-BAL zoom 2.6 / CA-W zoom 1 (detail 0)' });
    g.save(); g.beginPath(); g.rect(cx + 6, cy + 6, 712, 300); g.clip();
    // 阳台占位：栏杆
    ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
      lg.save();
      lg.translate(cx + 250, cy + 270); lg.scale(2.6, 2.6); lg.translate(-1000, -590);
      drawKing(lg, { x: 1000, y: 590, s: 0.26, t: T, pose: 'holdHead', expr: 'panic', crown: { slip: 1 }, holding: null });
      lg.fillStyle = PAL.stone2; lg.fillRect(940, 560, 120, 4); for (let k = 0; k < 9; k++) lg.fillRect(942 + k * 14, 560, 4, 30);
      lg.restore();
      lg.save();
      lg.translate(cx + 560, cy + 270);
      for (let k = 0; k < 4; k++) drawKing(lg, { x: -60 + k * 42, y: 0, s: 0.26, t: T + k, pose: ['wave', 'holdHead', 'leanForward', 'clap'][k], expr: 'joy', detail: 0, beardFlip: k === 2 ? 1 : 0 });
      lg.restore();
    });
    g.restore();
  }
}

/** 动态页：大尺寸循环。 */
function page4(g, T, ctx) {
  header(g, 'king.js  ·  动态：连蹦三下 + 王冠飞起 / 慌跑转身 / 金印抡砸 / 拍手 / 挥帕 / K2 竖指 + 王冠滑下', 'loops');
  const t = T - 6;
  // 1) 连蹦三下（0.55s 一跳），王冠每次飞起 80px 再落回乱颤，第三次落歪
  {
    const cx = 20, cy = 72;
    cell(g, cx, cy, 460, 500, { title: 'hop ×3 + crown pop / tilt', foot: cy + 450 });
    const hops = [0.1, 0.65, 1.2];
    let yoff = 0, sq = 0, k = 0, pop = 0, tilt = 0;
    hops.forEach((h0, i) => {
      const u = (t - h0) / 0.5;
      if (u >= 0 && u < 1) { yoff = -95 * 4 * u * (1 - u); k = clamp(Math.sin(u * Math.PI) * 1.4); }
      if (t >= h0) { const lu = t - (h0 + 0.5); sq += lu >= 0 ? -0.22 * Math.exp(-lu / 0.07) * Math.cos(lu * 30) : 0.12 * Math.sin(clamp(u) * Math.PI); }
      const cu = (t - h0 - 0.06) / 0.62;
      if (cu >= 0 && cu < 1) pop = Math.max(pop, 80 * 4 * cu * (1 - cu));
      if (t > h0 + 0.68) tilt += wobble(t, h0 + 0.68, 5, 0.18) * 8;
    });
    if (t > 1.88) tilt += 10;
    if (t < 0.1) { k = 0; }
    const pre = clamp((0.1 - t) / 0.1);
    ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawKing(lg, { x: cx + 230, y: cy + 450 + yoff, s: 1.25, t: T, pose: { from: 'crouch', to: 'hop', k: yoff < -2 ? k : pre * 0 }, expr: 'joy', squash: clamp(sq, -0.3, 0.3), crown: { pop, tilt } }));
  }
  // 2) 慌跑来回 + 转身挤压
  {
    const cx = 490, cy = 72;
    cell(g, cx, cy, 460, 500, { title: 'pace 来回 + 转身挤压 + slip 1', foot: cy + 450 });
    const P = 1.0, u = fract(t / P), dir = u < 0.5 ? 1 : -1, v = u < 0.5 ? u / 0.5 : (u - 0.5) / 0.5;
    const px = dir > 0 ? lerp(cx + 110, cx + 350, v) : lerp(cx + 350, cx + 110, v);
    const turnSq = -0.18 * Math.exp(-((v) * 0.5) / 0.04) ;
    ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawKing(lg, { x: px, y: cy + 450, s: 1.1, t: T, face: dir, pose: 'pace', expr: 'panic', squash: turnSq, crown: { slip: 1 }, holding: 'tiara' }));
  }
  // 3) 金印：抡起 → 砸下 → 印迹
  {
    const cx = 960, cy = 72;
    cell(g, cx, cy, 500, 500, { title: 'sealRaise → sealSlam（k 插值）+ stamp', foot: cy + 450 });
    const u = fract(t / 1.0);
    const k = u < 0.45 ? 0 : u < 0.62 ? inQuad((u - 0.45) / 0.17) : 1;
    const imp = 0.62;
    const sq = u > imp ? -0.2 * Math.exp(-(u - imp) / 0.05) : 0;
    ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
      lg.fillStyle = PAL.paper2; lg.fillRect(cx + 170, cy + 440, 300, 16);
      drawStampMark(lg, { x: cx + 330, y: cy + 452, kind: 'gold', w: 150, h: 30, rot: 0, p: u > imp ? clamp(0.25 + (u - imp) * 2) : 0 });
      drawKing(lg, { x: cx + 200, y: cy + 450, s: 1.05, t: T, pose: { from: 'sealRaise', to: 'sealSlam', k }, expr: k > 0.5 ? 'joy' : 'confident', squash: sq, crown: { pop: u > imp ? 20 * Math.exp(-(u - imp) / 0.1) : 0 } });
    });
  }
  // 4) 拍手 / 挥手帕 / 擦泪（坐） / 啃指甲
  const loops = [['clap', 'joy', {}], ['wave', 'joy', { festive: true }], ['wipeTears', 'waterfall', { seated: true }], ['biteNails', 'panic', { sweat: 1 }]];
  loops.forEach(([pose, expr, extra], i) => {
    const cx = 1470 + (i % 2) * 220, cy = 72 + Math.floor(i / 2) * 250;
    cell(g, cx, cy, 214, 244, { title: pose, foot: cy + 205 });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      const o = { x: cx + 107, y: cy + 205, s: 0.66, t: T, pose, expr, ...extra };
      if (extra.seated) { stool(lg, o.x, o.y - 40 * 0.66); o.y -= 40 * 0.66; }
      drawKing(lg, o);
    });
  });
  // 5) K2：竖指 + 王冠滑下盖眼（循环）
  {
    const cx = 20, cy = 582;
    cell(g, cx, cy, 620, 488, { title: 'K2：fingerUp + crown slip 0→1（0.2s）+ 翁 掉下', foot: cy + 520 });
    const u = fract(t / 1.0);
    const slip = clamp((u - 0.25) / 0.2);
    g.save(); g.beginPath(); g.rect(cx + 6, cy + 6, 608, 440); g.clip();
    ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
      const a = drawKing(lg, { x: cx + 300, y: cy + 690, s: 2.3, t: T, pose: 'fingerUp', face: -1, expr: 'squint', crown: { slip: outBack(slip, 1.4) * 1, tilt: 6 * (1 - slip) } });
      void a;
    });
    g.restore();
  }
  // 6) 王冠单独：drawKingCrown 与 off 配合（相对头飞起）+ 用返回的 crownBase / crownRot / crownS 交给 drawCrown 在世界里飞（无缝接手）
  {
    const cx = 650, cy = 582;
    cell(g, cx, cy, 620, 488, { title: 'off + drawKingCrown｜crownBase/Rot/S 交接 drawCrown（红影 = 对位校验）', foot: cy + 450 });
    const u = fract(t / 1.2);
    const fly = u < 0.5 ? outQuad(u / 0.5) : 1 - inQuad((u - 0.5) / 0.5);
    ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
      drawKing(lg, { x: cx + 150, y: cy + 450, s: 1.0, t: T, pose: u < 0.5 ? 'gasp' : 'idle', expr: u < 0.5 ? 'faint' : 'relieved', crown: { off: true } });
      drawKingCrown(lg, { x: cx + 150, y: cy + 450, s: 1.0, t: T, pose: u < 0.5 ? 'gasp' : 'idle', crown: { pop: 150 * fly, tilt: 40 * Math.sin(fly * 3) } });
      // 交接：朝左、前倾、王冠歪 15° 的国王；前 0.3 周期王冠停在头上（应与头上那顶完全重合），之后在世界坐标里飞走
      const KO = { x: cx + 470, y: cy + 450, s: 0.9, face: -1, t: T, pose: 'leanForward', expr: 'gasp' };
      const fu = clamp((u - 0.3) / 0.7);
      const a = drawKing(lg, { ...KO, crown: { off: true, tilt: 15 } });
      drawCrown(lg, { x: a.crownBase[0] - 120 * fu, y: a.crownBase[1] - 300 * outQuad(fu) + 260 * fu * fu, s: a.crownS, rot: a.crownRot - fu * TAU * 1.25, spin: -1 * t * 5 * fu, F: 1, t, glint: 0.6 * fu });
      // 对位校验：王冠戴在头上 + 同锚点的单色 drawCrown（半透明红），完全重合时只看到偏红的同一顶王冠
      const b = drawKing(lg, { x: cx + 560, y: cy + 250, s: 0.55, face: -1, t: T, pose: 'cupEar', expr: 'squint', crown: { tilt: 15 }, joints: { lean: 8 } });
      lg.globalAlpha = 0.45;
      drawCrown(lg, { x: b.crownBase[0], y: b.crownBase[1], s: b.crownS, rot: b.crownRot, F: 1, mono: PAL.red });
      lg.globalAlpha = 1;
    });
  }
  // 7) bow + crown 掉落滚动（国王卡）
  {
    const cx = 1280, cy = 582;
    cell(g, cx, cy, 620, 488, { title: 'bow：王冠滑落滚出（scene 用 off + drawCrown）', foot: cy + 450 });
    const u = fract(t / 1.6);
    const k = clamp(u / 0.3);
    const fall = clamp((u - 0.25) / 0.6);
    ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
      drawKing(lg, { x: cx + 200, y: cy + 450, s: 1.1, t: T, pose: { from: 'idle', to: 'bow', k: outBack(k) }, expr: 'smile', crown: { off: fall > 0 } });
      if (fall <= 0) return;
      const x = cx + 300 + fall * 260, y = cy + 450 - 60 * Math.abs(Math.sin(fall * 9)) * (1 - fall) - 2;
      drawCrown(lg, { x, y, s: 1.1, rot: fall * 9, t });
    });
  }
}

export default [
  { id: 'sheet_king_poses', start: 0, end: 2, draw(g, T, lt, ctx) { page1(g, T, ctx); } },
  { id: 'sheet_king_exprs', start: 2, end: 4, draw(g, T, lt, ctx) { page2(g, T, ctx); } },
  { id: 'sheet_king_special', start: 4, end: 6, draw(g, T, lt, ctx) { page3(g, T, ctx); } },
  { id: 'sheet_king_loops', start: 6, end: 8, draw(g, T, lt, ctx) { page4(g, T, ctx); } },
];
