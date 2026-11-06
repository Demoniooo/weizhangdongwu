// 模型图：剧场纸偶（rod:true）七式 —— 平面剪纸 + 奶油贴纸边 + 铜钉关节 + 木杆；外加名字之剑握柄示意。
import { PAL } from '../core/paper.js';
import { drawHero } from '../rigs/hero.js';
import { drawNameSword } from '../props/sword.js';
import { sheetBg, label } from './hero.js';

const P7 = ['puppetStand', 'puppetLunge', 'puppetSlash', 'puppetInMouth', 'puppetKneel', 'puppetRise', 'puppetHoldSword'];

export default [
  {
    id: 'sheet_hero_puppet', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      sheetBg(g, 'hero · theater puppets (rod: true)', 'flat paper · cream sticker edge · brass split pins · wooden rod · puppetHoldSword holds drawNameSword by handR');
      g.fillStyle = PAL.redDeep; g.fillRect(0, 860, 1920, 220);
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
        P7.forEach((p, i) => {
          const x = 150 + i * 255, y = 620;
          if (p === 'puppetHoldSword') {
            const a = drawHero(lg, { x, y, t: T, pose: p, rod: true, rodLen: 420, scarf: { len: 120, notch: true, hole: true } });
            drawNameSword(lg, { x: a.handR[0] + 20 * 0.3, y: a.handR[1], s: 0.3, t: T, tiles: Array(13).fill(1).map((v, k) => (k < 4 ? 1 : 0)), scarfWrap: 1 });
          } else drawHero(lg, { x, y, t: T, pose: p, act: 0.5, rod: true, rodLen: 420, scarf: { len: 120, notch: true, hole: true, vel: p === 'puppetLunge' ? [300, 0] : [0, 0] } });
        });
      });
      P7.forEach((p, i) => label(g, p, 150 + i * 255, 690, 18, { align: 'center', fill: PAL.ink }));
    },
  },
];
