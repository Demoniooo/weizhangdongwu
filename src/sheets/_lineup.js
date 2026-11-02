// 美术一致性检查（集成负责人用）：全部角色 s=1 同框站一排 + 外景缩放 + 典型布景里的比例试摆。
// 第 0–2 秒：角色阵容（脚底线 y=900，勇者头顶参考线 y=640）；第 2–4 秒：王座厅 TR-W 里试摆；第 4–6 秒：王城外景 s=0.26/0.30 试摆。
import { PAL } from '../core/paper.js';
import { font } from '../core/fonts.js';
import { cam, applyCam } from '../core/camera.js';
import { drawHero } from '../rigs/hero.js';
import { drawKing } from '../rigs/king.js';
import { drawPrincess } from '../rigs/princess.js';
import { drawHorse } from '../rigs/horse.js';
import { drawLizard, drawDragonHead } from '../rigs/dragon.js';
import { drawCitizen, drawGuard, drawScribe, drawHerald, drawChild } from '../rigs/folk.js';
import { drawSlime, drawBat } from '../rigs/monsters.js';
import { drawThroneRoom, CAMS as TR_CAMS } from '../env/throne.js';
import { drawCastle, CAMS as CA_CAMS } from '../env/castle.js';

function label(g, s, x, y) {
  g.save(); g.font = font(24, 'play'); g.fillStyle = PAL.inkSoft; g.textAlign = 'center'; g.fillText(s, x, y); g.restore();
}

export default [
  {
    id: 'lineup_cast', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080);
      g.save(); g.strokeStyle = 'rgba(159,44,44,0.5)'; g.setLineDash([12, 10]); g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 900); g.lineTo(1920, 900); g.moveTo(0, 640); g.lineTo(1920, 640); g.stroke(); g.restore();
      g.font = font(30, 'play'); g.fillStyle = PAL.ink; g.fillText('阵容 s=1 · 脚底线 y=900 · 勇者 260 头顶线 y=640', 40, 60);
      const t = T;
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
        drawHorse(lg, { x: 250, y: 900, s: 1, face: 1, t, pose: 'stand' });
        drawHero(lg, { x: 520, y: 900, s: 1, face: 1, t, pose: 'idle', expr: 'normal' });
        drawKing(lg, { x: 760, y: 900, s: 1, face: -1, t, pose: 'idle', expr: 'joy' });
        drawPrincess(lg, { x: 990, y: 900, s: 1, face: -1, t, pose: 'idle', expr: 'smile' });
        drawGuard(lg, { x: 1180, y: 900, s: 1, face: -1, t, pose: 'attention' });
        drawScribe(lg, { x: 1340, y: 900, s: 1, face: -1, t, pose: 'write' });
        drawHerald(lg, { x: 1500, y: 900, s: 1, face: -1, t, pose: 'kneel' === 'x' ? 'kneel' : 'unrollScroll' });
        drawCitizen(lg, { x: 1650, y: 900, s: 1, face: -1, t, variant: 0, pose: 'idle' });
        drawCitizen(lg, { x: 1770, y: 900, s: 1, face: -1, t, variant: 5, pose: 'cheer' });
        drawChild(lg, { x: 1870, y: 900, s: 1, face: -1, t, stage: 'kid', pose: 'stand' });
        drawLizard(lg, { x: 640, y: 900, s: 1, face: 1, t, pose: 'sit' });
        drawSlime(lg, { x: 1100, y: 900, s: 1, t });
        drawBat(lg, { x: 1250, y: 420, s: 1, t, pose: 'fly' });
        drawDragonHead(lg, { x: 1560, y: 300, s: 0.55, face: -1, t, jaw: 0.3 });
      });
      ['白马', '勇者', '国王', '公主', '卫兵', '书记官', '传令官', '市民0', '市民5', '孩子'].forEach((s, i) => label(g, s, [250, 520, 760, 990, 1180, 1340, 1500, 1650, 1770, 1870][i], 950));
      label(g, '小蜥蜴', 640, 990); label(g, '史莱姆', 1100, 990); label(g, '龙头 ×0.55', 1560, 120);
    },
  },
  {
    id: 'lineup_throne', start: 2, end: 4,
    draw(g, T, lt, ctx) {
      const c = TR_CAMS.TR_W || TR_CAMS['TR-W'] || cam();
      for (const layer of ['back', 'mid', 'main']) ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawThroneRoom(lg, T, c, { layer, light: 'sunny' }));
      ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
        applyCam(lg, c, 1);
        drawHero(lg, { x: 620, y: 880, s: 1, face: 1, t: T, pose: 'idle', expr: 'grin' });
        drawPrincess(lg, { x: 760, y: 880, s: 1, face: 1, t: T, pose: 'idle', expr: 'smile' });
        drawHerald(lg, { x: 980, y: 880, s: 1, face: -1, t: T, pose: 'unrollScroll' });
        drawScribe(lg, { x: 1150, y: 880, s: 1, face: -1, t: T, pose: 'write', desk: true });
        drawKing(lg, { x: 1500, y: 790, s: 1, face: -1, t: T, pose: 'idle', expr: 'joy' });
      });
      ctx.layer(g, { blur: 4 }, (lg) => drawThroneRoom(lg, T, c, { layer: 'fg', light: 'sunny' }));
      g.font = font(30, 'play'); g.fillStyle = PAL.white; g.fillText('王座厅 TR-W 试摆', 40, 60);
    },
  },
  {
    id: 'lineup_castle', start: 4, end: 6,
    draw(g, T, lt, ctx) {
      const c = CA_CAMS.CA_BAL || CA_CAMS['CA-BAL'] || cam();
      for (const layer of ['sky', 'far', 'mid', 'main']) ctx.layer(g, { shadow: layer === 'sky' ? 0 : 6, texture: 0.3 }, (lg) => drawCastle(lg, T, c, { layer, time: 'spring' }));
      ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => {
        applyCam(lg, c, 1);
        drawHero(lg, { x: 930, y: 590, s: 0.26, face: 1, t: T, pose: 'idle', expr: 'grin' });
        drawPrincess(lg, { x: 990, y: 590, s: 0.26, face: -1, t: T, pose: 'idle', expr: 'smile' });
        drawKing(lg, { x: 1040, y: 590, s: 0.26, face: -1, t: T, pose: 'idle', expr: 'joy' });
      });
      for (const layer of ['near', 'fg']) ctx.layer(g, { shadow: 6, texture: 0.3, blur: layer === 'fg' ? 3 : 0 }, (lg) => drawCastle(lg, T, c, { layer, time: 'spring' }));
      g.font = font(30, 'play'); g.fillStyle = PAL.ink; g.fillText('王城阳台 CA-BAL 试摆 s=0.26', 40, 60);
    },
  },
];
