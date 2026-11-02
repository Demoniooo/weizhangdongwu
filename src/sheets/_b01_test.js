// 临时对照（b01 作者用，交付前删除）：阳台公主提水壶的姿势候选。
import { PAL } from '../core/paper.js';
import { drawPrincess } from '../rigs/princess.js';

const VARS = [
  ['idle 默认', {}],
  ['armR+40', { joints: { armR: 40, elbowR: -10 } }],
  ['armR+60 elbowR+40', { joints: { armR: 60, elbowR: 40 } }],
  ['water pour0', { pose: 'water', pour: 0 }],
  ['water pour0 armR-20', { pose: 'water', pour: 0, joints: { armR: -20, elbowR: 30 } }],
  ['idle hR up', { joints: { armR: 70, elbowR: 70, wristR: -30 } }],
];

export default [
  {
    id: '_b01_test', start: 0, end: 4,
    draw(g, T) {
      g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080);
      VARS.forEach(([name, o], i) => {
        const x = 170 + i * 310, y = 900;
        g.fillStyle = PAL.stone2; g.fillRect(x - 140, y - 115, 280, 12);
        drawPrincess(g, { x, y, s: 1.4, face: -1, t: T, pose: 'idle', item: 'can', pour: 0, look: [-0.25, -0.45], ...o });
        g.fillStyle = PAL.ink; g.font = '28px sans-serif'; g.fillText(name, x - 130, 980);
      });
    },
  },
];
