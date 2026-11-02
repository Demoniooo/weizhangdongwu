// 引擎自检镜头（正式镜头接入后删除）。
import { PAL, blob, poly, rr, cut, lin, glow, rays, sparkle, shade } from '../core/paper.js';
import { cam, applyCam, shake } from '../core/camera.js';
import { burst, field } from '../core/particles.js';
import { font } from '../core/fonts.js';
import { ez, outBack, glide } from '../core/ease.js';

export default [{
  id: 'kit_test', start: 0, end: 208.1,
  draw(g, T, lt, ctx) {
    const c = cam(960 + Math.sin(T * 0.5) * 120, 540, 1 + 0.08 * Math.sin(T * 0.3), 0);
    // 天空
    g.fillStyle = lin(g, 0, 0, 0, 1080, [PAL.skyDay, PAL.skyDayLow]);
    g.fillRect(0, 0, 1920, 1080);
    glow(g, 1500, 220, 260, PAL.goldLight, 0.8);
    // 远山（深度 0.3）
    ctx.layer(g, { shadow: 6, texture: 0.35 }, (lg) => {
      applyCam(lg, c, 0.3);
      cut(lg, poly([[-200, 1080], [-200, 620], [200, 380], [520, 560], [860, 330], [1260, 600], [1620, 420], [2100, 640], [2100, 1080]], { seed: 4, round: 0.6 }), PAL.mountainFar);
    });
    // 中景草地（深度 0.7）
    ctx.layer(g, { shadow: 8, texture: 0.35 }, (lg) => {
      applyCam(lg, c, 0.7);
      cut(lg, blob(700, 1180, 1400, 420, { seed: 8, amp: 0.02 }), PAL.meadow, { rim: PAL.leafLight });
    });
    // 主体层：纸片小人占位
    ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
      applyCam(lg, c, 1);
      const bob = Math.abs(Math.sin(T * 4)) * -18;
      const body = rr(900, 640 + bob, 120, 160, 40);
      cut(lg, body, PAL.heroBlue, { rim: '#8fb4ea' });
      shade(lg, body, PAL.ink, 900, 640, 1020, 800, 0, 0.3);
      cut(lg, blob(960, 590 + bob, 70, 66, { seed: 2 }), PAL.skin, { rim: '#fff0dc' });
      cut(lg, poly([[1010, 700 + bob], [1180, 640 + bob + Math.sin(T * 6) * 20], [1170, 690 + bob], [1010, 730 + bob]], { seed: 5, round: 0.5 }), PAL.scarf);
    });
    // 前景草叶（深度 1.4，虚化）
    ctx.layer(g, { blur: 3 }, (lg) => {
      applyCam(lg, c, 1.4);
      for (let i = 0; i < 9; i++) cut(lg, blob(80 + i * 240, 1100, 140, 90, { seed: 20 + i }), PAL.grassDark);
    });
    // 金币爆发
    const at = Math.floor(T / 2) * 2 + 0.2;
    burst(g, T, { at, seed: Math.floor(T / 2), count: 18, x: 960, y: 560, speed: [300, 700], angle: [-2.6, -0.5], gravity: 1400, life: [1, 1.6] }, (g2, x, y, s) => {
      g2.save(); g2.translate(x, y); g2.scale(Math.cos(s.rot), 1);
      cut(g2, blob(0, 0, 16, 16, { seed: 3, amp: 0.01 }), PAL.coin, { stroke: PAL.coinDark, lw: 3 });
      g2.restore();
    });
    field(g, T, { seed: 9, count: 30, vy: 40, sway: 30 }, (g2, x, y, s) => sparkle(g2, x, y, s.size * 1.6, { rot: s.rot, alpha: 0.7 }));
    // 文字
    const p = ez(T % 4, 0.1, 0.8, outBack);
    g.save(); g.translate(960, 220); g.scale(p, p);
    g.font = font(110, 'display'); g.textAlign = 'center';
    g.lineJoin = 'round'; g.lineWidth = 22; g.strokeStyle = PAL.paper; g.strokeText('达拉崩吧斑得贝迪卜多比鲁翁', 0, 0);
    g.fillStyle = PAL.red; g.fillText('达拉崩吧斑得贝迪卜多比鲁翁', 0, 0);
    g.font = font(44, 'play'); g.fillStyle = PAL.ink; g.fillText('纸艺 MV 引擎自检 · KuaiLe', 0, 80);
    g.font = font(40, 'serif'); g.fillText('很久很久以前 · XiaoWei', 0, 140);
    g.font = font(40, 'latin', 600); g.fillText('LV 12  HP 999  x12', 0, 200);
    g.restore();
    const sh = shake(T % 3, 1.0, { amp: 14 });
    ctx.fx.shake = sh;
    rays(g, 1500, 220, 500, { alpha: 0.25, rot: T * 0.1 });
  },
}];
