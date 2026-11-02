// 模型图：公主米娅（src/rigs/princess.js）。
// 时间轴：[0,2) 动作全表（循环动作随 t 动）｜[2,4) 表情全表｜[4,6) 验收专页：麻花辫三种拖尾 / caged+eyeroll / pickLock+focused / bride+veil+tiara / s=0.26 阳台 + 名签字高 / ridePillion / 剧场迷你偶
//        ｜[6,8) 动态：来回奔跑（trail 时间回溯采样）/ 跳舞转身 / 举牌敲笼 / 转发卡走出 / 摇头 / 浇花。
// 出图：node tools/render.mjs stills --sheet princess --times 0.5,1.7,2.5,4.5,6.5 --outdir out/review/sheets/princess
//       node tools/render.mjs sheet --sheet princess --from 6 --to 8 --every 0.1 --cols 7 --tile 360 --out out/review/sheets/princess/anim.jpg
import { PAL, blob, cut } from '../core/paper.js';
import { clamp, lerp, fract, rgba, TAU } from '../core/util.js';
import { glyphWidth } from '../ui/type.js';
import { drawPrincess, drawWateringCan, PRINCESS_POSES, PRINCESS_EXPRS } from '../rigs/princess.js';
import { ell } from '../props/royal.js';
import { label, header, cell } from './royal.js';

const POSE_EXPR = {
  idle: 'smile', water: 'smile', wave: 'laugh', lookUp: 'shock', caged: 'eyeroll', pickLock: 'focused', pointBehind: 'tense', cheerSign: 'laugh',
  stepOut: 'smug', twirl: 'laugh', ridePillion: 'loving', bride: 'shy', holdHands: 'loving', coverFace: 'shy', dance: 'laugh', leanOver: 'loving',
  nudgeAway: 'eyeroll', shakeHead: 'relieved', deflate: 'relieved', puppetCage: 'laugh',
};

/** 占位小笼（cave.drawCage 由别组实现；这里只画几根栏杆示意）。 */
function cageBars(g, cx, cy, w, h) {
  g.save(); g.strokeStyle = rgba(PAL.goldDark, 0.9); g.lineWidth = 3.5;
  for (let i = 0; i <= 6; i++) { const x = cx - w / 2 + (i * w) / 6; g.beginPath(); g.moveTo(x, cy + h / 2); g.lineTo(x, cy - h / 2 + 30); g.quadraticCurveTo(x + (cx - x) * 0.6, cy - h / 2, cx, cy - h / 2 - 6); g.stroke(); }
  g.beginPath(); g.moveTo(cx - w / 2 - 4, cy + h / 2); g.lineTo(cx + w / 2 + 4, cy + h / 2); g.stroke();
  g.restore();
}

function page1(g, T, ctx) {
  header(g, 'princess.js  ·  动作 PRINCESS_POSES（' + PRINCESS_POSES.length + '）', 's = 0.6 · 红虚线 = s=1 时 260px × s');
  const cols = 8, cw = 232, ch = 330, x0 = 32, y0 = 72;
  const s = 0.6;
  const list = [...PRINCESS_POSES, 'caged', 'pointBehind', 'holdHands', 'dance'];
  list.forEach((pose, i) => {
    const flip = i >= PRINCESS_POSES.length;
    const cx = x0 + (i % cols) * cw, cy = y0 + Math.floor(i / cols) * ch;
    const foot = cy + ch - 46;
    cell(g, cx, cy, cw - 6, ch - 6, { title: pose + (flip ? '  face -1' : ''), foot, h260: 260 * s });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      const o = { x: cx + cw / 2 - 6, y: foot, s, t: T, pose, face: flip ? -1 : 1, expr: POSE_EXPR[pose] };
      if (pose === 'ridePillion') { cut(lg, blob(o.x, foot - 70, 70, 26, { seed: 3 }), PAL.horse, {}); o.y = foot - 88; }
      if (pose === 'puppetCage') { o.s = 0.42; o.y = foot - 40; }
      if (pose === 'nudgeAway') o.item = null;
      if (pose === 'dance') o.turn = 0.08 + 0.06 * Math.sin(T * 2);
      if (pose === 'bride') o.veil = 1;
      drawPrincess(lg, o);
      if (pose === 'puppetCage') cageBars(lg, o.x, foot - 90, 110, 150);
    });
  });
}

function page2(g, T, ctx) {
  header(g, 'princess.js  ·  表情 PRINCESS_EXPRS（' + PRINCESS_EXPRS.length + '）', 'CU 胸像 s = 1.35');
  const cols = 5, cw = 374, ch = 498, x0 = 18, y0 = 72;
  PRINCESS_EXPRS.forEach((expr, i) => {
    const cx = x0 + (i % cols) * cw, cy = y0 + Math.floor(i / cols) * ch;
    cell(g, cx, cy, cw - 8, ch - 8, { title: expr });
    g.save(); g.beginPath(); g.rect(cx + 6, cy + 6, cw - 20, ch - 52); g.clip();
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => drawPrincess(lg, { x: cx + cw / 2 - 4, y: cy + 610, s: 1.6, t: T, pose: expr === 'shy' ? 'coverFace' : expr === 'focused' ? 'pickLock' : 'idle', expr }));
    g.restore();
  });
}

function page3(g, T, ctx) {
  header(g, 'princess.js  ·  麻花辫拖尾 / caged+eyeroll / pickLock+focused / bride+veil+tiara / s=0.26 / ridePillion / puppet', 'acceptance');
  // ① 麻花辫：静止 / 向左奔跑 / 跳舞旋转 / 侧风
  const bs = [
    ['braid vel = 0', { pose: 'idle' }],
    ['向左奔跑 vel [-420,0]', { pose: 'stepOut', face: -1, braid: { vel: [-420, 0] }, expr: 'laugh' }],
    ['跳舞旋转 turn + spin', { pose: 'dance', turn: 0.12 + 0.3 * fract(T * 0.6), braid: { spin: 2.2 }, expr: 'laugh' }],
    ['侧风 wind [-320,-60]', { pose: 'lookUp', braid: { wind: [-320, -60] }, expr: 'shock' }],
  ];
  bs.forEach(([name, o], i) => {
    const cx = 18 + i * 236, cy = 72;
    cell(g, cx, cy, 230, 330, { title: name, foot: cy + 286 });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => drawPrincess(lg, { x: cx + 115, y: cy + 286, s: 0.85, t: T, ...o }));
  });
  // ② caged + eyeroll / pickLock + focused（笼栏占位）
  [['caged + eyeroll', 'caged', 'eyeroll'], ['pickLock + focused', 'pickLock', 'focused']].forEach(([name, pose, expr], i) => {
    const cx = 962 + i * 236, cy = 72;
    cell(g, cx, cy, 230, 330, { title: name, foot: cy + 286 });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      drawPrincess(lg, { x: cx + 100, y: cy + 286, s: 0.85, t: T, pose, expr });
      cageBars(lg, cx + 115, cy + 180, 200, 230);
      if (pose === 'pickLock') { lg.fillStyle = PAL.goldDark; lg.fill(ell(cx + 152, cy + 168, 9, 11)); }
    });
  });
  // ③ bride + veil + tiara
  {
    const cx = 1434, cy = 72;
    cell(g, cx, cy, 470, 330, { title: 'bride + veil + tiara  /  tiara:false', foot: cy + 286 });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      drawPrincess(lg, { x: cx + 150, y: cy + 286, s: 0.85, t: T, pose: 'bride', expr: 'shy', veil: 1 });
      drawPrincess(lg, { x: cx + 360, y: cy + 286, s: 0.85, t: T, pose: 'caged', expr: 'eyeroll', tiara: false });
    });
  }
  // ④ s = 0.26 阳台（CA-BAL zoom 2.6）+ 名签字高
  {
    const cx = 18, cy = 412;
    cell(g, cx, cy, 700, 380, { title: 's=0.26 · CA-BAL zoom 2.6：浇花 / 挥手 / 名签「米娅」（字高标尺 48px）' });
    g.save(); g.beginPath(); g.rect(cx + 6, cy + 6, 688, 330); g.clip();
    ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
      lg.save(); lg.translate(cx + 360, cy + 320); lg.scale(2.6, 2.6); lg.translate(-960, -590);
      lg.fillStyle = PAL.stone2; lg.fillRect(850, 590, 220, 6);
      drawPrincess(lg, { x: 900, y: 590, s: 0.26, t: T, pose: 'water', expr: 'smile', pour: 0.8 });
      drawPrincess(lg, { x: 960, y: 590, s: 0.26, t: T, pose: 'wave', expr: 'laugh' });
      drawPrincess(lg, { x: 1022, y: 590, s: 0.26, t: T, pose: 'holdHands', expr: 'loving' });
      lg.fillStyle = PAL.stone2; lg.fillRect(850, 560, 220, 3); for (let k = 0; k < 16; k++) lg.fillRect(852 + k * 14, 560, 3, 30);
      // 名签单独画在栏杆前（only:'nameTag'）
      drawPrincess(lg, { x: 1022, y: 590, s: 0.26, t: T, pose: 'holdHands', nameTag: '米娅', only: 'nameTag' });
      lg.restore();
    });
    // 48px 标尺
    g.fillStyle = rgba(PAL.red, 0.8); g.fillRect(cx + 660, cy + 60, 6, 48);
    label(g, '48', cx + 640, cy + 84, 16, { color: PAL.red });
    g.restore();
  }
  // ⑤ ridePillion（后座，面朝左）+ 远景 detail 0
  {
    const cx = 728, cy = 412;
    cell(g, cx, cy, 380, 380, { title: 'ridePillion face -1 / detail 0 远景' });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      cut(lg, blob(cx + 190, cy + 260, 120, 36, { seed: 5 }), PAL.horse, { rim: PAL.white });
      drawPrincess(lg, { x: cx + 230, y: cy + 232, s: 0.85, t: T, pose: 'ridePillion', face: -1, expr: 'loving', braid: { vel: [-600, 0] } });
      for (let k = 0; k < 4; k++) drawPrincess(lg, { x: cx + 60 + k * 26, y: cy + 350, s: 0.22, t: T + k, pose: ['idle', 'wave', 'caged', 'dance'][k], detail: 0 });
    });
  }
  // ⑥ 剧场迷你偶 / 剪影 / 举牌 sign 0 → 1
  const misc = [
    ['puppetCage（剧场迷你偶）', { pose: 'puppetCage', s: 0.6 }],
    ['silhouette keep braid', { pose: 'twirl', silhouette: true, keepColor: ['braid'] }],
    ['cheerSign sign 0.3', { pose: 'cheerSign', sign: 0.3, expr: 'tense' }],
    ['nudgeAway（踢开卷轴）', { pose: 'nudgeAway', expr: 'eyeroll' }],
  ];
  misc.forEach(([name, o], i) => {
    const cx = 1118 + (i % 2) * 393, cy = 412 + Math.floor(i / 2) * 330;
    cell(g, cx, cy, 387, i < 2 ? 324 : 330, { title: name, foot: cy + 280 });
    ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
      drawPrincess(lg, { x: cx + 190, y: cy + 280, s: 0.8, t: T, ...o });
      if (o.pose === 'puppetCage') cageBars(lg, cx + 190, cy + 190, 150, 200);
      if (o.pose === 'nudgeAway') { cut(lg, blob(cx + 290, cy + 268, 40, 12, { seed: 8 }), PAL.paper2, { rim: PAL.white }); }
    });
  });
  // ⑦ 水壶单独
  {
    const cx = 18, cy = 800;
    cell(g, cx, cy, 700, 270, { title: 'drawWateringCan pour 0 / 0.5 / 1（掉落时可单独画）' });
    ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => [0, 0.5, 1].forEach((p, i) => drawWateringCan(lg, { x: cx + 120 + i * 220, y: cy + 70, s: 1.6, pour: p, t: T })));
  }
  // ⑧ pose 插值 {from,to,k} 时默认手持物不消失（水壶 / 发卡）+ rot（马背俯仰，ridePillion 传 saddleRot）
  {
    const cx = 728, cy = 800;
    cell(g, cx, cy, 380, 270, { title: '{from,to,k} 保留手持物 / rot 马背俯仰', foot: cy + 226 });
    const k = 0.5 - 0.5 * Math.cos(TAU * T * 0.5);
    ctx.layer(g, { shadow: 5, texture: 0.25 }, (lg) => {
      drawPrincess(lg, { x: cx + 62, y: cy + 226, s: 0.6, t: T, pose: { from: 'water', to: 'lookUp', k: k * 0.45 }, expr: 'smile', pour: 0.6 });
      drawPrincess(lg, { x: cx + 160, y: cy + 226, s: 0.6, t: T, pose: { from: 'pickLock', to: 'stepOut', k }, expr: 'smug' });
      const rot = 0.16 * Math.sin(TAU * T * 1.1);
      lg.save(); lg.translate(cx + 300, cy + 150); lg.rotate(rot);
      cut(lg, blob(0, 18, 64, 18, { seed: 5 }), PAL.horse, { rim: PAL.white });
      lg.restore();
      drawPrincess(lg, { x: cx + 300, y: cy + 150, s: 0.5, t: T, pose: 'ridePillion', face: -1, rot: -rot, expr: 'loving', braid: { vel: [-500, 0] } });
    });
  }
}

function page4(g, T, ctx) {
  header(g, 'princess.js  ·  动态：来回奔跑（trail 回溯采样）/ 跳舞转身 / 举牌敲笼 / 转发卡走出 / 摇头 / 浇花', 'loops');
  const t = T - 6;
  // 1) 来回奔跑：用 trail（锚点在 T − k·0.035 的位置 − 当前位置）
  {
    const cx = 20, cy = 72;
    cell(g, cx, cy, 940, 480, { title: 'run back & forth · braid trail（时间回溯采样）', foot: cy + 430 });
    const pos = (tt) => [cx + 470 + 330 * Math.sin(tt * 2.1), cy + 430 - 10 * Math.abs(Math.sin(tt * 9))];
    const p0 = pos(t);
    const v = 330 * 2.1 * Math.cos(t * 2.1);
    const trail = Array.from({ length: 14 }, (_, k) => { const p = pos(t - k * 0.035); return [p[0] - p0[0], p[1] - p0[1]]; });
    ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawPrincess(lg, { x: p0[0], y: p0[1], s: 1.15, t: T, face: v >= 0 ? 1 : -1, pose: 'stepOut', item: null, expr: 'laugh', braid: { trail, vel: [v, 0] } }));
  }
  // 2) 跳舞转身（turn 0→1）
  {
    const cx = 970, cy = 72;
    cell(g, cx, cy, 460, 480, { title: 'dance + turn（scaleX 翻面）+ 辫子外甩', foot: cy + 430 });
    const turn = fract(t / 2 + 0.1);
    ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawPrincess(lg, { x: cx + 230, y: cy + 430, s: 1.15, t: T, pose: 'dance', turn, expr: 'laugh', nameTag: '米娅', braid: { spin: 3 * Math.abs(Math.sin(turn * TAU)) } }));
  }
  // 3) 举牌敲笼（sign 0→1 举起）
  {
    const cx = 1440, cy = 72;
    cell(g, cx, cy, 460, 480, { title: 'cheerSign：sign 0→1 + 敲笼', foot: cy + 430 });
    const k = clamp(fract(t / 2) * 3);
    ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => {
      drawPrincess(lg, { x: cx + 210, y: cy + 430, s: 1.05, t: T, pose: 'cheerSign', sign: k, expr: k < 1 ? 'tense' : 'laugh' });
      cageBars(lg, cx + 230, cy + 280, 400, 330);
    });
  }
  // 4) 转发卡走出 / 摇头 / 浇花 / 捂脸
  const loops = [['stepOut', 'smug', {}], ['shakeHead', 'relieved', {}], ['water', 'smile', { pour: 0.5 + 0.5 * Math.sin(t * 3) }], ['coverFace', 'shy', { nameTag: '米娅' }]];
  loops.forEach(([pose, expr, extra], i) => {
    const cx = 20 + i * 472, cy = 562;
    cell(g, cx, cy, 466, 508, { title: pose, foot: cy + 470 });
    ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawPrincess(lg, { x: cx + 233, y: cy + 470, s: 1.15, t: T, pose, expr, ...extra }));
  });
}

export default [
  { id: 'sheet_princess_poses', start: 0, end: 2, draw(g, T, lt, ctx) { page1(g, T, ctx); } },
  { id: 'sheet_princess_exprs', start: 2, end: 4, draw(g, T, lt, ctx) { page2(g, T, ctx); } },
  { id: 'sheet_princess_accept', start: 4, end: 6, draw(g, T, lt, ctx) { page3(g, T, ctx); } },
  { id: 'sheet_princess_loops', start: 6, end: 8, draw(g, T, lt, ctx) { page4(g, T, ctx); } },
];

export { glyphWidth, lerp };
