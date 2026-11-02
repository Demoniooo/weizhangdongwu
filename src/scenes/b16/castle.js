// b16 私有：王城（婚礼 → 夕阳）——O01 横幅回弹成名签 + 阳台跳舞；O02 拉回全景、画框长出、压平成插画。
// 接缝 185.47 的一切参数都从 SEAMS['b15|b16'] 读（合同改了这里自动跟上）：图层栈、布景参数、阳台四人、横幅、蝴蝶结、纸鸽、人群、烟花、彩纸。
import { NAMES } from '../../cues.js';
import { PAL } from '../../core/paper.js';
import { cam, applyCam, lerpCam } from '../../core/camera.js';
import { clamp, lerp, seg, hash2, wobble } from '../../core/util.js';
import { ez, glide, outBack, inQuad, inOutSine, outCubic } from '../../core/ease.js';
import { burst, stream } from '../../core/particles.js';
import { glyphIcon } from '../../ui/kit.js';
import { drawCastle, CAMS as CA, LAYER_GROUPS } from '../../env/castle.js';
import { scrollCorner } from '../../env/book.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawKing } from '../../rigs/king.js';
import { drawPrincess } from '../../rigs/princess.js';
import { drawLizard } from '../../rigs/dragon.js';
import { drawCitizen, drawGuard, drawScribe, drawHerald } from '../../rigs/folk.js';
import { drawHorse } from '../../rigs/horse.js';
import { drawSlime } from '../../rigs/monsters.js';
import { confettiDraw } from '../../props/misc.js';
import { drawScarf, resample } from '../../props/scarf.js';
import { FN, SEAMS, resolveParams } from '../_seams.js';
import { TT, O1, O2, driftCam, poseMix, drawChestTag } from './common.js';

const TAU = Math.PI * 2;
const SIN = SEAMS['b15|b16'];
const ITEMS = Object.fromEntries([...(SIN.actors || []), ...(SIN.props || []), ...(SIN.ui || [])].map((it) => [it.id, it]));
const seamP = (id, T) => resolveParams(ITEMS[id].params, T, {});
const seamFn = (id) => (typeof ITEMS[id].fn === 'function' ? ITEMS[id].fn : FN[ITEMS[id].fn]);

// 合同站位（阳台四人）
const H0 = seamP('hero', 0), P0 = seamP('princess', 0), K0 = seamP('king', 0), L0 = seamP('lizard', 0);
const FLOOR = H0.y;
const LIZ_DX = L0.x - H0.x, LIZ_DY = L0.y - H0.y;
/** 国王王冠的“尾声歪角”（合同值，b16 王座厅里一直沿用，197.00 回正）。 */
export const KING_TILT = (K0.crown && K0.crown.tilt) || 0;
// 跳舞：名签弹出前两人被回弹的横幅带得各退半步（拉开间距，名签不互相遮挡），绕中点转一圈
const DCX = (H0.x + P0.x) / 2, DR = Math.max(35, (P0.x - H0.x) / 2 + 10);

// ———————————————————— 机位 ————————————————————
const CAM_GIFT = SIN.cam;
/** 阳台中近景：比 CA-BAL 近一档（zoom 3.0），胸前名签字 ≥ 52px；中心对准两人与国王。 */
export const CAM_DANCE = cam(DCX + 8, 548, 3.0);
export function castleCam(T) {
  let base;
  if (T < TT.pull0) base = lerpCam(CAM_GIFT, CAM_DANCE, ez(T, TT.push0, TT.push1, glide));
  else base = lerpCam(CAM_DANCE, CA.CA_W, ez(T, TT.pull0, TT.pull1, glide));
  const w = 1 - seg(T, TT.frame0, TT.frame1); // 188.80 起漂移停下（压平成插画）
  return driftCam(base, T, w);
}

// ———————————————————— 阳台上的四个角色 ————————————————————
const danceTheta = (T) => TAU * ez(T, TT.dance0, TT.dance1, inOutSine);

function balconyCast(T) {
  const th = danceTheta(T);
  const dancing = T > TT.dance0 && T < TT.dance1;
  const spread = ez(T, O1 + 0.06, O1 + 0.3, outBack); // 回弹的冲劲：各退半步
  const r = lerp((P0.x - H0.x) / 2, DR, spread);
  const cx = lerp((P0.x + H0.x) / 2, DCX, spread);
  const hx = cx - r * Math.cos(th), px = cx + r * Math.cos(th);
  const hDepth = -Math.sin(th), pDepth = Math.sin(th);
  const reveal = T >= TT.tagPop && T < TT.look; // 低头看自己的新名签
  // —— 勇者（合同参数为底）
  const hero = { ...seamP('hero', T) };
  hero.x = hx;
  if (T > O1) {
    const kDown = ez(T, O1 + 0.08, O1 + 0.3, outCubic);
    let pose;
    if (T < TT.look) pose = poseMix(H0.pose, 'holdHands', kDown);
    else if (T < TT.dance0) pose = 'holdHands';
    else if (dancing) pose = 'dance';
    else pose = poseMix('dance', 'holdHands', ez(T, TT.dance1, TT.dance1 + 0.2));
    hero.pose = pose;
    if (reveal) hero.expr = 'shock';
    else if (T >= TT.look) hero.expr = 'laugh';
    const tb = wobble(T, TT.tagPop, 4, 0.18);
    const sq = -0.08 * tb + (dancing ? 0.04 * Math.sin((TAU * (T - TT.dance0)) / 0.45) : 0);
    if (sq) hero.squash = sq;
    if (reveal) hero.jointsAdd = { nod: 16 * seg(T, TT.tagPop, TT.tagPop + 0.08) };
    if (dancing) {
      hero.phase = (T - TT.dance0) / 0.9;
      if (th <= Math.PI) hero.turn = th / Math.PI; else { hero.face = -1; hero.turn = (th - Math.PI) / Math.PI; }
      hero.y = FLOOR + 1.5 * Math.max(0, hDepth);
      hero.s = H0.s * (1 + 0.025 * hDepth);
    }
    if (T >= SCARF0) hero.scarf = { ...hero.scarf, len: 14 };
  }
  // —— 公主
  const princess = { ...seamP('princess', T) };
  princess.x = px;
  if (T > O1) {
    let pose;
    if (T < TT.look) pose = poseMix(P0.pose, 'holdHands', ez(T, O1 + 0.2, O1 + 0.45));
    else if (T < TT.dance0) pose = 'holdHands';
    else if (dancing) pose = 'dance';
    else pose = poseMix('dance', 'holdHands', ez(T, TT.dance1, TT.dance1 + 0.2));
    princess.pose = pose;
    if (reveal) { princess.expr = 'shock'; princess.look = [0, 0.8]; }
    else if (T >= TT.look && !dancing) princess.look = [-0.7, 0];
    const sq = -0.08 * wobble(T, TT.tagPop + 0.04, 4, 0.18);
    if (sq) princess.squash = sq;
    if (dancing) {
      princess.turn = th / TAU;
      princess.braid = { spin: 1.4 };
      princess.y = FLOOR + 1.5 * Math.max(0, pDepth);
      princess.s = P0.s * (1 + 0.025 * pDepth);
    }
  }
  // —— 国王：拍手（王冠保持合同歪角）
  const king = { ...seamP('king', T) };
  if (T > TT.dance1 + 0.1) king.pose = 'idle';
  // —— 小蜥蜴：蹲在勇者肩上，跳舞时跟拍子点头
  const lizard = { ...seamP('lizard', T) };
  const sx = dancing ? Math.cos(th) : 1;
  lizard.x = hx + LIZ_DX * sx;
  lizard.y = (hero.y ?? FLOOR) + LIZ_DY;
  if (dancing && sx < 0) lizard.face = -1;
  if (T >= TT.dance0 - 0.1) lizard.joints = { head: 16 * Math.sin((TAU * (T - TT.dance0)) / 0.45) };
  return { hero, princess, king, lizard, th, hDepth, pDepth, dancing, cx: (hx + px) / 2 };
}

// ———————————————————— 围巾绕成一颗心，把两人圈在一起（186.05 起，一直留到插画里） ————————————————————
const SCARF0 = TT.look + 0.05, SCARF1 = TT.look + 0.42;
const HEART_W = 128, HEART_H = 92, HEART_CY = 529;
/** 心形（参数 u 0..1 一圈，从左瓣中部出发顺时针：左瓣 → 顶凹 → 右瓣 → 底尖 → 回到左边）。世界坐标。 */
function heartPt(cx, u, T) {
  const t = Math.PI * 1.55 - u * TAU; // 从左侧出发
  const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  const br = 1 + 0.03 * Math.sin(T * 5.2);
  return [cx + (x / 32) * HEART_W * br, HEART_CY - ((y - 2.5) / 29) * HEART_H * br];
}
function heartScarf(T, B) {
  if (T < SCARF0) return null;
  const rig = heroRig({ ...B.hero, scarf: { ...B.hero.scarf, len: 300 } });
  const knot = rig.neck;
  const cx = B.cx;
  const n = 72, out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const hp = heartPt(cx, u * 1.02, T);
    const b = clamp(u / 0.1), bb = b * b * (3 - 2 * b);
    out.push([lerp(knot[0], hp[0], bb), lerp(knot[1], hp[1], bb)]);
  }
  const loop = resample(out, 28);
  const k = T < SCARF1 ? outBack(seg(T, SCARF0, SCARF1), 1.3) : 1;
  const nat = rig.scarf;
  return nat.map((p, i) => [lerp(p[0], loop[i][0], k), lerp(p[1], loop[i][1], k)]);
}
function drawHeartScarf(lg, T, pts) {
  const s = 0.26;
  drawScarf(lg, pts, { width: 22 * s, endWidth: 8 * s, lift: 1.4 * s, fringeLen: 15 * s, t: T, seed: 3, glow: 0.6, notch: true, hole: true, patch: true });
}

function drawBalcony(lg, T, S) {
  const B = S.B;
  const sc = heartScarf(T, B);
  if (sc) drawHeartScarf(lg, T, sc); // 心在两人身后
  // 画序：深度靠后的先画；接缝时刻按合同（onBalcony 列表）
  const order = [...(SIN.env.onBalcony || ['lizard', 'hero', 'princess', 'king'])];
  const swap = B.dancing && B.hDepth > B.pDepth;
  const seq = swap ? order.filter((id) => id !== 'lizard' && id !== 'hero').flatMap((id) => (id === 'princess' ? ['princess', 'lizard', 'hero'] : [id])) : order;
  for (const id of seq) {
    if (id === 'hero') S.hero = drawHero(lg, B.hero);
    else if (id === 'princess') S.princess = drawPrincess(lg, B.princess);
    else if (id === 'king') drawKing(lg, B.king);
    else if (id === 'lizard') drawLizard(lg, B.lizard);
  }
}

// ———————————————————— 城墙上 / 城下的人（O02 全员到场） ————————————————————
function drawWallFolk(lg, T) {
  if (T < TT.pull0 - 0.4) return;
  drawGuard(lg, { x: 470, y: 700, s: 0.26, face: 1, t: T, pose: 'attention', detail: 0, seed: 61 });
  drawHerald(lg, { x: 700, y: 700, s: 0.26, face: 1, t: T, pose: 'idle', detail: 0, seed: 62 });
  drawScribe(lg, { x: 1225, y: 700, s: 0.26, face: -1, t: T, pose: 'write', detail: 0, seed: 63 });
  drawGuard(lg, { x: 1450, y: 700, s: 0.26, face: -1, t: T, pose: 'attention', detail: 0, variant: 2, seed: 64 });
}
function crowdParams(T) {
  const p = seamP('crowd', T);
  if (T < O1 + 1.1) return p;
  return { ...p, members: p.members.map((m, i) => ({ ...m, pose: i % 3 === 0 ? 'wave' : 'idle', detail: 0 })) };
}
function drawGroundExtras(lg, T) {
  if (T < TT.pull0 - 0.3) return;
  drawCitizen(lg, { x: 850, y: 1012, s: 0.3, face: 1, t: T, variant: 3, grandma: true, pose: 'wave', detail: 0, seed: 71 });
  drawSlime(lg, { x: 1100, y: 1018, s: 0.32, face: -1, t: T, expr: 'happy', detail: 0 });
  drawHorse(lg, { x: 1005, y: 992, s: 0.3, face: -1, t: T, pose: 'stand', detail: 0 });
}

// ———————————————————— 合同道具 + O01 动作 ————————————————————
function retractK(T) {
  const u = seg(T, TT.retract0, TT.retract1);
  return 0.35 * u + 0.65 * inQuad(u);
}
/** 某个合同道具在 T 的参数（叠加 b16 自己的动画）；返回 null = 不画。 */
function propParams(id, T) {
  const p = seamP(id, T);
  if (T <= O1) return p;
  const rk = retractK(T), rT = T - O1;
  const fade = 1 - seg(T, O1 + 0.45, O1 + 0.75); // 脱落的字飘一会儿就淡掉（推镜前）
  switch (id) {
    case 'princessTail': case 'princessBanner': case 'heroBanner':
      if (fade <= 0) return null;
      return { ...p, retract: rk, retractT: rT, alpha: fade };
    case 'bow': {
      const k = 1 - seg(T, O1, O1 + 0.14);
      return k > 0 ? { ...p, pop: (p.pop ?? 1) * k } : null;
    }
    case 'doves': {
      const a = T - O1;
      if (a > 2.2) return null;
      return { ...p, list: p.list.map((d, i) => {
        const sgn = d.face || 1, fx = i % 2 ? 0.8 : 1;
        return { ...d, x: d.x + sgn * (520 * a + 140 * a * a) * fx, y: d.y - (160 * a + 60 * a * a) * (i % 2 ? 0.6 : 1), flap: T * 3.2 + (d.seed || 0) * 0.41 + a * 2.5 };
      }) };
    }
    case 'fireworks': case 'confetti':
      return T < O1 + 3.2 ? p : null;
    default:
      return p;
  }
}
function drawSeamItem(lg, id, T, c) {
  const it = ITEMS[id];
  const p = id === 'crowd' ? crowdParams(T) : propParams(id, T);
  if (!p) return;
  lg.save();
  if (it.space === 'world') applyCam(lg, c, it.depth ?? 1);
  seamFn(id)(lg, p);
  if (id === 'crowd') drawGroundExtras(lg, T);
  lg.restore();
}

/** 名签 + 音符 + 蝴蝶结松开的彩纸（画在横幅那一层）。 */
function drawTagsAndNotes(lg, T, c, S) {
  if (T < TT.tagPop - 0.02) return;
  lg.save(); applyCam(lg, c, 1);
  const H = S.hero, P = S.princess;
  const s = H0.s;
  // 名签字号：保证在跳舞机位下屏幕字 ≥ 52px
  const size = Math.ceil(52 / (s * CAM_DANCE.zoom)) + 1;
  const ht = () => H && drawChestTag(lg, { kind: 'hero', text: NAMES.heroShort, x: H.nameTag[0], y: H.nameTag[1] - 2, size, s, pop: seg(T, TT.tagPop, TT.tagPop + 0.22), t: T });
  const pt = () => P && drawChestTag(lg, { kind: 'princess', text: NAMES.princessShort, x: P.chest[0], y: P.chest[1] + 3, size, s, pop: seg(T, TT.tagPop + 0.04, TT.tagPop + 0.26), t: T });
  if (S.B.hDepth > S.B.pDepth) { pt(); ht(); } else { ht(); pt(); }
  if (T >= TT.dance0 - 0.1 && T < TT.dance1 + 1.6) {
    stream(lg, T, {
      start: TT.dance0, end: TT.dance1, rate: 8, seed: 161, life: [1.1, 1.6], size: [9, 13],
      emit: (tb, i, r) => ({ x: DCX + (r - 0.5) * 120, y: 505 - 10 * r, vx: (hash2(i, 3) - 0.5) * 30, vy: -45 - 25 * hash2(i, 4) }),
    }, (g2, x, y, q) => {
      const a = q.p < 0.15 ? q.p / 0.15 : 1 - Math.max(0, (q.p - 0.7) / 0.3);
      glyphIcon(g2, 'note', x + 6 * Math.sin(q.age * 5 + q.i), y, q.size, { fill: [PAL.gold, PAL.heart, PAL.crystal][q.i % 3], alpha: a, rot: 0.25 * Math.sin(q.age * 4 + q.i) });
    });
  }
  const bow = ITEMS.bow && seamP('bow', T);
  if (bow) burst(lg, T, { at: O1 + 0.06, seed: 166, count: 26, x: bow.x, y: bow.y, spread: 20, speed: [120, 380], angle: [-3.1, 0], gravity: 260, drag: 1.2, life: [0.9, 1.5], spin: [-8, 8], size: [9, 14] }, confettiDraw);
  lg.restore();
}

// ———————————————————— 插画画框（188.80–189.40 从四角长出） ————————————————————
export function drawPlateFrame(g, k) {
  if (k <= 0) return;
  const m = 44 * clamp(k * 1.6);
  g.save();
  if (m > 0.5) {
    const outer = new Path2D(); outer.rect(-20, -20, 1960, 1120);
    outer.rect(m, m, 1920 - 2 * m, 1080 - 2 * m);
    g.fillStyle = PAL.paper2; g.fill(outer, 'evenodd');
  }
  const L = clamp((k - 0.15) / 0.7);
  const inset = 60;
  if (L > 0) {
    const ln = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (x1 - x0) * L, y0 + (y1 - y0) * L); g.stroke(); };
    for (const [w, off, col] of [[8, 0, PAL.goldDark], [5, 0, PAL.gold], [2.5, 13, PAL.gold]]) {
      g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
      const a = inset + off, bx = 1920 - a, by = 1080 - a, mx = 960, my = 540;
      ln(a, a, mx + 1, a); ln(bx, a, mx - 1, a); ln(a, by, mx + 1, by); ln(bx, by, mx - 1, by);
      ln(a, a, a, my + 1); ln(a, by, a, my - 1); ln(bx, a, bx, my + 1); ln(bx, by, bx, my - 1);
    }
  }
  const corners = [[inset - 6, inset - 6, 1, 1], [1920 - inset + 6, inset - 6, -1, 1], [inset - 6, 1080 - inset + 6, 1, -1], [1920 - inset + 6, 1080 - inset + 6, -1, -1]];
  corners.forEach(([x, y, sx, sy], i) => {
    const q = clamp((k - i * 0.06) / 0.45);
    if (q > 0) scrollCorner(g, x, y, sx, sy, 1.25 * outBack(q, 2), PAL.gold);
  });
  g.restore();
}

// ———————————————————— 整帧 ————————————————————
/**
 * 王城一帧。o.page = true：翻页期间的旧页（书页上的插画：合并成 3 层、flat 1、无投影）。
 */
export function drawCastleScene(g, T, ctx, o = {}) {
  const c = castleCam(T);
  const flat = o.page ? 1 : seg(T, TT.frame0, TT.frame1);
  const S = { B: balconyCast(T) };
  const envP = resolveParams(SIN.env.params, T, {});
  const env = { ...envP, flat, onBalcony: (lg) => drawBalcony(lg, T, S), onWall: (lg) => drawWallFolk(lg, T) };
  if (T > O1) {
    env.time = T < TT.dance0 ? envP.time : T >= TT.dance1 ? 'sunset' : { from: envP.time, to: 'sunset', k: seg(T, TT.dance0, TT.dance1) };
    const wrapP = (envP.ribbonWrap?.p ?? 1) * (1 - ez(T, O1, O1 + 0.08, inQuad));
    env.ribbonWrap = wrapP > 0 && envP.ribbonWrap ? { ...envP.ribbonWrap, p: wrapP } : undefined;
    if (T >= TT.dance0) env.bunting = 1;
    if (T >= TT.frame0 - 0.2) env.sun = { x: 1220, y: 250, r: 70, kind: 'sunset' };
  }
  const shadowK = 1 - flat;
  const fxOf = (o0) => {
    const f = { ...o0 };
    if (typeof f.shadow === 'number') f.shadow *= shadowK;
    if (f.blur) f.blur *= shadowK;
    return f;
  };
  const tagsLayer = SIN.layers.some((L) => L.draw.includes('heroBanner')) ? 'heroBanner' : 'env:fg';
  const runRefs = (lg, refs) => {
    for (const ref of refs) {
      if (ref.startsWith('env:')) drawCastle(lg, T, c, { ...env, layer: ref.slice(4) });
      else if (ITEMS[ref]) drawSeamItem(lg, ref, T, c);
    }
    if (refs.includes(tagsLayer)) drawTagsAndNotes(lg, T, c, S);
  };
  if (o.page) {
    // 翻页旧页：按 LAYER_GROUPS 合并（名签、人群照画），无投影
    for (const [grp, fx] of LAYER_GROUPS) {
      ctx.layer(g, { texture: fx.texture }, (lg) => {
        for (const L of grp) {
          drawCastle(lg, T, c, { ...env, layer: L });
          if (L === 'near' && ITEMS.crowd) drawSeamItem(lg, 'crowd', T, c);
        }
        if (grp.includes('fg')) drawTagsAndNotes(lg, T, c, S);
      });
    }
  } else {
    for (const L of SIN.layers) {
      const lo = L.o == null ? null : resolveParams(L.o, T, {});
      if (lo) ctx.layer(g, fxOf(lo), (lg) => runRefs(lg, L.draw)); else runRefs(g, L.draw);
    }
  }
  drawPlateFrame(g, seg(T, TT.frame0, TT.frame1));
  // 整帧后期：接缝 fx（sat 1.1）→ 夕阳 sat 1.0、暗角 0.35；189.0 起纸纹 0.30
  const fx0 = resolveParams(SIN.fx || {}, T, {});
  for (const k in fx0) if (fx0[k] !== undefined) ctx.fx[k] = fx0[k];
  const kSun = seg(T, TT.dance0, TT.dance1);
  if (kSun > 0) {
    ctx.fx.sat = lerp(fx0.sat ?? 1, 1, kSun);
    ctx.fx.vignette = lerp(0.3, 0.35, kSun);
  }
  const kp = seg(T, O2 + 1.25, TT.frame1);
  if (kp > 0) ctx.fx.paper = lerp(0.22, 0.3, kp);
  return { c };
}
