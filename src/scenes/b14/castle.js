// b14 私有：E04 春天王城（13 面字旗升起）+ E05 推进主堡圆窗。CASTLE 世界坐标。
import { PAL, glow } from '../../core/paper.js';
import { clamp, lerp, seg, hit, wobble } from '../../core/util.js';
import { ez, glide, outCubic } from '../../core/ease.js';
import { cam, applyCam, drift } from '../../core/camera.js';
import { NAMES } from '../../cues.js';
import { NAME_TIMES } from '../../ui/type.js';
import { drawCastle, castleToScreen, CASTLE, CAMS as CA, LAYER_FX } from '../../env/castle.js';
import { samplePath, pathAt } from '../../props/paper.js';
import { drawHorse, horseRig, horsePhase } from '../../rigs/horse.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawPrincess } from '../../rigs/princess.js';
import { drawLizard } from '../../rigs/dragon.js';
import { drawCitizen, drawGuard } from '../../rigs/folk.js';
import { E04, E05, PUSH } from './common.js';

const LAYERS = ['sky', 'far', 'mid', 'main', 'near', 'fg'];
export const FLAGS = { chars: NAMES.city, at: NAME_TIMES('E04'), finaleAt: E05 - 0.43 };

// —— 机位：CA-W 稳住读旗（zoom 1.0→1.04），168.40 起 glide→snap 推进圆窗 ——
const Z_END = 17.2; // 169.00 时圆窗玻璃半径 ≈ 70·17.2 ≈ 1200（盖满全屏）
export function castleCam(T) {
  const d = drift(T, { amp: 5, speed: 0.35, seed: 141 });
  const z0 = lerp(1.0, 1.04, ez(T, E04 + 0.2, PUSH.t0, glide));
  const u = clamp((T - PUSH.t0) / (PUSH.t1 - PUSH.t0));
  const e = Math.pow(u, 1.6);
  const z = z0 * Math.pow(Z_END / z0, e);
  const kc = 1 - Math.pow(1 - u, 3); // 机位中心先到圆窗（推进时漂移随之收掉），圆窗落在屏幕中心
  return cam(lerp(960 + d[0], CASTLE.window.x, kc), lerp(540 + d[1], CASTLE.window.y, kc), z);
}
/** 圆窗（玻璃）在机位下的屏幕圆：[x, y, r]。 */
export function windowScreen(c) {
  const [x, y] = castleToScreen(c, 'main', CASTLE.window.x, CASTLE.window.y);
  return [x, y, CASTLE.window.r * c.zoom];
}

// —— 白马回城：沿城下地面带从画右奔来，转上城门前石板路（near 层 = CA-W 下的屏幕坐标）——
const ROUTE = samplePath([[2060, 1016], [1700, 1010], [1300, 1004], [1080, 996], [990, 962], [966, 915], [962, 878]], 8);
const RIDE = { t0: E04, t1: E05 - 0.05 };
function routeAt(T) {
  const k = clamp((T - RIDE.t0) / (RIDE.t1 - RIDE.t0));
  const s = ROUTE.total * (0.06 + 0.94 * (k < 0.85 ? k : 0.85 + (1 - Math.pow(1 - (k - 0.85) / 0.15, 2)) * 0.15));
  return { p: pathAt(ROUTE, s), s };
}
function drawRiders(g, T) {
  if (T < RIDE.t0) return;
  const s = 0.3, face = -1;
  const { p, s: dist } = routeAt(T);
  const [x, y, ang] = p;
  const hp = horsePhase(-dist, s);
  const ho = { x, y, s, face, t: T, pose: 'gallop', phase: hp, speed: 1300, detail: 0, angle: clamp(ang - Math.PI, -0.5, 0.5) * 0.4 };
  const ha = horseRig(ho);
  const ro = { x: ha.saddle[0], y: ha.saddle[1], s, face, t: T, pose: 'rideFront', rot: ha.saddleRot, phase: face * hp, detail: 0, expr: 'grin', scarf: { notch: true, hole: true, vel: [-1200, 0], len: 900, ground: 1e5 } };
  const hr = heroRig(ro);
  const h = drawHorse(g, { ...ho, stirrupAt: hr.foot });
  drawPrincess(g, { x: h.saddleBack[0], y: h.saddleBack[1], s, face, t: T, pose: 'ridePillion', rot: h.saddleRot, tiara: false, expr: 'loving', detail: 0, braid: { vel: [-1200, 0] } });
  const hero = drawHero(g, ro);
  drawLizard(g, { pose: 'ride', x: hero.neck[0] + 6, y: hero.neck[1] + 1, s: s * 0.95, face: 1, t: T, detail: 0 });
}

// —— 城墙上挥手的市民（被垛口挡住下半身）——
const WALLERS = [[352, 2], [468, 9], [575, 5], [690, 1], [795, 7], [1125, 4], [1238, 10], [1345, 0], [1458, 6], [1568, 3]];
function drawWallCrowd(g, T) {
  WALLERS.forEach(([x, v], i) => {
    const k = clamp((T - (E04 + 0.05 * i)) / 0.3);
    const pose = k <= 0 ? 'idle' : { from: 'idle', to: i % 3 === 1 ? 'cheer' : 'wave', k };
    drawCitizen(g, { x, y: 700, s: 0.26, t: T, variant: v, face: x < 960 ? 1 : -1, pose, phase: i * 0.21, detail: 0, seed: 30 + i });
  });
  drawGuard(g, { x: 905, y: 700, s: 0.26, t: T, face: 1, pose: 'cheer', detail: 0, hat: true });
  drawGuard(g, { x: 1015, y: 700, s: 0.26, t: T, face: -1, pose: 'cheer', detail: 0, variant: 2 });
}

/** 整帧春天王城（自己铺满背景）。o.layers 可传更少的层（重叠期省缓冲）。 */
export function drawCastlePicture(g, T, ctx, c = castleCam(T)) {
  const o = { time: 'spring', flags: FLAGS, onWall: (lg) => drawWallCrowd(lg, T), windowGlow: 0.25 + 0.5 * seg(T, PUSH.t0, PUSH.t1) };
  for (const layer of LAYERS) {
    ctx.layer(g, LAYER_FX[layer], (lg) => {
      const { depth } = drawCastle(lg, T, c, { ...o, layer });
      if (layer === 'near') { lg.save(); applyCam(lg, c, depth); drawRiders(lg, T); lg.restore(); }
    });
  }
  return c;
}
