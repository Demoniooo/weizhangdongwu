// 模型图：勇者（总览）。① s=1 正侧面 idle / run / shout / cupEar / thumbsUp / present，face=±1 各一排（标 260 身高线与脚底线）。
// 第二页（2–4s）：CU 头（s=3.4 ≈ zoom 3.4）+ 伤痕 0/4、soot、inflate、剪影、剪影 + 红边、名签、远景 s=0.26 / 0.52。
// 其余见 hero_poses / hero_face / hero_scarf / hero_sword / hero_puppet / hero_ride / hero_anim；API 文档 docs/api/hero.md。
import { PAL } from '../core/paper.js';
import { glyphRow } from '../ui/type.js';
import { drawHero, drawHeroHead } from '../rigs/hero.js';

// ———— 模型图公用小工具（其它 hero_* 模型图也用） ————
export function sheetBg(g, title, sub) {
  g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080);
  if (title) label(g, title, 60, 52, 34, { family: 'display', fill: PAL.red });
  if (sub) label(g, sub, 60, 96, 20, { family: 'play', fill: PAL.inkSoft });
}
export function label(g, text, x, y, size = 20, o = {}) {
  glyphRow(g, [...text], x, y, size, { family: 'latin', fill: PAL.ink, edge: null, gap: size * 0.02, align: o.align || 'left', ...o });
}
/** 脚底线 + 身高线（260·s）。 */
export function guide(g, x, footY, s = 1, w = 150, h = 260) {
  g.save();
  g.strokeStyle = 'rgba(44,34,51,0.28)'; g.lineWidth = 1.2; g.setLineDash([6, 5]);
  g.beginPath(); g.moveTo(x - w, footY); g.lineTo(x + w, footY); g.moveTo(x - w, footY - h * s); g.lineTo(x + w, footY - h * s); g.stroke();
  g.restore();
}

const SIX = ['idle', 'run', 'shout', 'cupEar', 'thumbsUp', 'present'];

const PAGES = [
  {
    id: 'sheet_hero_overview', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      sheetBg(g, 'hero · drawHero', 's=1 · face=+1 (row 1) / face=-1 (row 2) · dashed lines = foot line & 260 height');
      for (let r = 0; r < 2; r++) {
        const face = r ? -1 : 1, fy = r ? 980 : 520;
        for (let i = 0; i < 6; i++) {
          const x = 200 + i * 304;
          guide(g, x, fy);
          label(g, `${SIX[i]}${r ? ' -1' : ''}`, x, fy + 34, 22, { align: 'center' });
        }
        ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
          for (let i = 0; i < 6; i++) {
            const x = 200 + i * 304;
            drawHero(lg, { x, y: fy, s: 1, face, t: T + i * 0.37, pose: SIX[i], earScale: SIX[i] === 'cupEar' ? 1.3 : 1, scarf: { len: 210, vel: SIX[i] === 'run' ? [face * 420, 0] : [0, 0] } });
          }
        });
      }
    },
  },
];

// —— 第 2 页：CU 头（zoom 3.4 → 头约 360px）+ 状态：伤痕 0/4、soot、inflate、剪影、名签、s=0.26 远景 ——
const STATES = [
  { k: 'injury 0', o: {} },
  { k: 'injury 4', o: { injury: { bandages: 4, bump: true, singed: true, torn: true }, expr: 'hurt' } },
  { k: 'soot 1', o: { soot: 1, expr: 'normal', ahoge: 'candle', flame: 1 } },
  { k: 'inflate 1', o: { pose: 'inhale', inflate: 1 } },
  { k: 'silhouette', o: { silhouette: true, pose: 'stance' } },
  { k: 'sil+edge', o: { silhouette: true, edge: { color: PAL.scarf, w: 5 }, pose: 'stance', keepColor: [] } },
];
export const _detailPage = {
  id: 'sheet_hero_cu', start: 2, end: 4,
  draw(g, T, lt, ctx) {
    sheetBg(g, 'hero · CU head s=3.4 (=zoom 3.4) + states', 'injury 0/4 · soot=1 · inflate=1 · silhouette (keep scarf) · title silhouette + red edge · nameTag · s=0.26 detail 0');
    ctx.layer(g, { shadow: 10, texture: 0.25 }, (lg) => {
      drawHeroHead(lg, { x: 330, y: 470, s: 3.4, t: T, expr: 'grin', toothSparkle: 2.4 + Math.floor((T - 2) / 0.8) * 0.8 });
    });
    for (let i = 0; i < 6; i++) guide(g, 780 + i * 190, 520, 1, 80);
    ctx.layer(g, { shadow: 7, texture: 0.25 }, (lg) => {
      STATES.forEach((st, i) => {
        drawHero(lg, { x: 780 + i * 190, y: 520, t: T + i * 0.3, scarf: { len: 140, notch: i === 1, hole: i === 1 }, ...st.o });
      });
      // 胸前名签 + 远景
      drawHero(lg, { x: 840, y: 990, t: T, pose: 'holdHands', expr: 'shy', nameTag: '达拉崩吧', nameTagSize: 24, scarf: { len: 160, patch: true, hole: true, notch: true } });
      for (let i = 0; i < 4; i++) drawHero(lg, { x: 1180 + i * 70, y: 990, s: 0.26, detail: 0, t: T + i, pose: ['idle', 'walk', 'cheer', 'run'][i], scarf: { len: 300 } });
      for (let i = 0; i < 4; i++) drawHero(lg, { x: 1500 + i * 100, y: 990, s: 0.52, t: T + i, pose: ['idle', 'walk', 'cheer', 'run'][i], scarf: { len: 300 } });
    });
    STATES.forEach((st, i) => label(g, st.k, 780 + i * 190, 556, 18, { align: 'center' }));
    label(g, 'nameTag', 840, 1030, 18, { align: 'center' });
    label(g, 's=0.26 detail 0', 1285, 1030, 18, { align: 'center' });
    label(g, 's=0.52', 1650, 1030, 18, { align: 'center' });
  },
};

export default [...PAGES, _detailPage];
