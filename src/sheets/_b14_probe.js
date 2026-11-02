// 临时探针（b14 作者用，交付前删除）
import { drawHerald } from '../rigs/folk.js';
import { drawScroll } from '../props/paper.js';
import { PAL } from '../core/paper.js';
export default [{
  id: 'b14probe', start: 0, end: 1,
  draw(g, T) {
    g.fillStyle = PAL.paper2; g.fillRect(0, 0, 1920, 1080);
    const r = (v) => (Array.isArray(v) ? v.map(r) : typeof v === 'number' ? +v.toFixed(1) : v);
    const variants = [
      { pose: 'unrollScroll' },
      { pose: 'raiseHand' },
      { pose: 'unrollScroll', jointsAdd: { shF: 40, shB: 40 } },
      { pose: 'unrollScroll', joints: { shF: 40, shB: 45, elF: -10, elB: -10 } },
      { pose: 'idle', jointsSet: { shF: 150, elF: -20, shB: 140, elB: -10 } },
      { pose: 'unrollScroll', jointsSet: { shF: 135, elF: 10, shB: 128, elB: 18 } },
    ];
    variants.forEach((v, i) => {
      const x = 200 + i * 300, y = 600;
      g.save(); g.translate(0, 0);
      const A = drawHerald(g, { x, y, s: 1.4, face: 1, t: 170, scrollLen: 0, ...v });
      console.warn('HERALD', i, JSON.stringify(v), 'handF', r(A.handF), 'handB', r(A.handB), 'scrollTop', r(A.scrollTop), 'head', r(A.head));
      g.restore();
      g.fillStyle = PAL.ink; g.font = '20px sans-serif'; g.fillText(String(i), x - 10, y + 40);
    });
  },
}];
