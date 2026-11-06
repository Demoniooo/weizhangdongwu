// b08 私有：村庄的戏——五个容器（宝箱 / 陶罐 / 木桶 / 花盆 / 大宝箱）、容器主人（下巴掉地、老奶奶抱罐、晕倒）、
// 飞进背包的小道具、横穿的鸡、出门看热闹的村民。位置全部取 JOURNEY（容器世界 x、屋门 0.95 图层坐标）。纯函数。
import { PAL, blob, sparkle, glow } from '../../core/paper.js';
import { clamp, lerp, seg, smoothstep, hash2, TAU, rgba, mixHex, wobble } from '../../core/util.js';
import { outBack, outCubic, inQuad, inOutSine, inCubic } from '../../core/ease.js';
import { toScreen, applyCam } from '../../core/camera.js';
import { burst } from '../../core/particles.js';
import { cue } from '../../cues.js';
import { JOURNEY, journeyGroundY, journeyCam } from '../../env/journey.js';
import { drawChest, drawPot, drawBarrel, drawFlowerPot, drawItemIcon } from '../../props/village.js';
import { drawCitizen } from '../../rigs/folk.js';
import { drawChicken } from '../../rigs/monsters.js';

const V09 = cue('V09');
const EV = JOURNEY.events;
const CONT = JOURNEY.containers;
const HOUSE_OF = (i) => JOURNEY.houses.find((h) => h.container === i);
const OWNER_S = 0.82; // 村民比例：站在 0.95 层的小屋门口（门高 92），s=1 会比屋墙还高
const DROP_DELAY = 0.1; // 主人滞后 0.1s 下巴掉下来

/** 容器主人：变体 + 何时出门（0.95 层门口）。 */
const OWNERS = [
  { variant: 2, villager: true, seed: 801, out: V09 + 0.32 }, // 宝箱：鸭舌帽杂货商（草帽）
  { variant: 3, grandma: true, seed: 802, out: V09 + 0.5 }, // 陶罐：老奶奶（92.45 抱住另一只罐）
  { variant: 8, villager: true, seed: 803, out: V09 + 0.9 }, // 木桶：卷发大叔
  { variant: 9, seed: 804, out: V09 + 1.25 }, // 花盆：花环姑娘
  { variant: 10, villager: true, seed: 805, out: V09 + 1.6, step: 215 }, // 大宝箱：秃顶老爷爷（93.70 晕倒；多让几步，晕倒时正好在马头右前方）
];
/** 不开箱的几户：出门看热闹 / 挥手 / 鼓掌。 */
const EXTRAS = [
  { house: 1, variant: 7, villager: true, seed: 811, out: V09 + 0.38, pose: 'wave', face: -1 }, // X 6230：头巾男孩挥手
  { house: 7, variant: 1, seed: 812, out: 92.55, pose: 'clap', face: -1, step: 150 }, // X 7860：软帽小姑娘鼓掌（让开老爷爷）
  { house: 8, variant: 11, seed: 813, out: 92.9, pose: 'cheer', face: -1, step: 90 }, // X 8080：面包师欢呼
];

/** 出门：门板绕左边铰链打开（0–0.16s），人从门里跳出来（0.06–0.34s，outBack + 落地挤压）。 */
function doorOpenK(T, out) { return clamp((T - out) / 0.16); }
function drawDoorLeaf(lg, door, k) {
  if (k <= 0) return;
  const [dx, base] = door, dw = 30, dh = 92;
  const arch = (g, x0, w) => { g.beginPath(); g.moveTo(x0, base + 2); g.lineTo(x0, base - dh + 30); g.quadraticCurveTo(x0, base - dh, x0 + w / 2, base - dh); g.quadraticCurveTo(x0 + w, base - dh, x0 + w, base - dh + 30); g.lineTo(x0 + w, base + 2); g.closePath(); };
  lg.save();
  // 门洞（屋里暗）
  arch(lg, dx - dw, dw * 2); lg.fillStyle = mixHex(PAL.ink, PAL.woodDark, 0.35); lg.fill();
  lg.fillStyle = rgba(PAL.goldLight, 0.18); lg.fill(); // 屋里的暖光
  // 门板（绕左铰链转开：宽 = 2dw·cos θ，最后只剩一道边）
  const w = dw * 2 * Math.max(0.08, Math.cos(k * Math.PI * 0.46));
  arch(lg, dx - dw - (dw * 2 - w) * 0.15, w);
  lg.fillStyle = mixHex(PAL.wood, PAL.woodDark, 0.45 + 0.4 * k); lg.fill();
  lg.restore();
}
function popIn(T, out) {
  const k = clamp((T - out - 0.06) / 0.28);
  if (k <= 0) return null;
  const sc = 0.55 + 0.45 * clamp(outBack(k, 2.2));
  const land = T - out - 0.34;
  const sq = land > 0 ? -0.12 * Math.exp(-land / 0.09) * Math.cos(land * 30) : 0.1 * Math.sin(Math.PI * k);
  return { sc, sq, a: clamp(k * 5), hop: Math.sin(Math.PI * clamp(k * 1.15)) * 16 };
}

/** 主人在这一刻的动作 / 表情。 */
function ownerPose(i, T) {
  const at = CONT[i].at;
  const look = smoothstep(at - 0.9, at - 0.4, T);
  if (i === 1) {
    // 老奶奶：先好奇，罐盖一飞（92.45）立刻死死抱住自家另一只罐
    if (T < EV.grannyHug) return { pose: 'idle', expr: look > 0.5 ? 'curious' : 'smile', joints: { look: -0.6 * look } };
    const k = inOutSine(clamp((T - EV.grannyHug) / 0.1));
    return { pose: { from: 'idle', to: 'hugPot', k }, expr: 'grumpy', joints: { tilt: 4 * wobble(T, EV.grannyHug + 0.1, 3, 0.4) } };
  }
  const drop = at + DROP_DELAY;
  if (T < drop) return { pose: look > 0.3 ? 'lean' : 'idle', expr: look > 0.3 ? 'curious' : 'normal', joints: { look: -0.7 * look } };
  const k = clamp((T - drop) / 0.07);
  if (i === 4 && T >= EV.faint) {
    // 大宝箱主人：直挺挺向后晕倒（inQuad 倒下 + 落地弹两下）
    const f = clamp((T - EV.faint) / 0.3);
    const fall = inQuad(f), bounce = f >= 1 ? -6 * Math.exp(-(T - EV.faint - 0.3) / 0.12) * Math.abs(Math.sin((T - EV.faint - 0.3) * 22)) : 0;
    return { pose: { from: 'jawDrop', to: 'faintBack', k: fall }, expr: f > 0.5 ? 'faint' : 'jawdrop', joints: { tilt: bounce } };
  }
  return { pose: { from: 'idle', to: 'jawDrop', k }, expr: 'jawdrop', joints: { jaw: 0.25 * wobble(T, drop + 0.07, 4, 0.25) } };
}

/**
 * mid 图层里（0.95 屋门口）画村民。调用前 lg 是屏幕坐标；函数内部 applyCam(c, 0.95)。
 */
export function drawVillagers(lg, T, c) {
  lg.save();
  applyCam(lg, c, 0.95);
  const list = [];
  OWNERS.forEach((o, i) => { const h = HOUSE_OF(i); if (h) list.push({ ...o, door: h.door, owner: i }); });
  for (const e of EXTRAS) { const h = JOURNEY.houses[e.house]; if (h) list.push({ ...e, door: h.door, owner: -1 }); }
  for (const v of list) {
    if (T < v.out) continue;
    drawDoorLeaf(lg, v.door, doorOpenK(T, v.out));
    const pi = popIn(T, v.out);
    if (!pi) continue;
    // 主人出门后往右让一步（站到自家容器右侧，不被马头 / 容器挡住表情）；看热闹的就站在门口
    const step = outCubic(clamp((T - v.out - 0.06) / 0.45)) * (v.step ?? (v.owner >= 0 ? 54 : 0));
    const x = v.door[0] + 4 + step, y = v.door[1];
    let p;
    if (v.owner >= 0) p = ownerPose(v.owner, T);
    else {
      // 看热闹的：出门先张望，再做自己的动作（挥手 / 鼓掌 / 欢呼）
      const go = smoothstep(v.out + 0.35, v.out + 0.55, T);
      p = { pose: go > 0 ? { from: 'idle', to: v.pose, k: go } : 'idle', expr: go > 0.5 ? 'happy' : 'surprise', joints: {} };
    }
    lg.save();
    lg.globalAlpha *= pi.a;
    lg.translate(x, y); lg.scale(pi.sc, pi.sc); lg.translate(-x, -y);
    drawCitizen(lg, {
      x, y: y - pi.hop, s: OWNER_S, face: v.face ?? -1, t: T, variant: v.variant, villager: !!v.villager, grandma: !!v.grandma,
      seed: v.seed, pose: p.pose, expr: p.expr, joints: p.joints, squash: pi.sq, phase: hash2(v.seed, 1),
    });
    lg.restore();
  }
  lg.restore();
}

// ———— 容器（main 图层，世界坐标） ————
const CONT_Y = (cn) => cn.y - 6; // 摆在路的里侧边缘（马从它前面经过）
function openK(T, at) { return T < at ? 0 : clamp(outBack(clamp((T - at) / 0.2), 2.0)); }
/**
 * 立体书式“立起”：每个容器在它滑到屏幕 x≈1560 时从纸面上折起来（scaleY 0→1，底边铰链），
 * 正好是勇者到达前 1–1.5s 的预告。接缝 90.00 那一帧容器都还平躺着（合同里 b07 不画容器）。
 */
const POP_SX = 1560;
const POP_AT = CONT.map((cn) => {
  let a = cue('V09') + 0.25, b = cn.at;
  for (let k = 0; k < 40; k++) {
    const m = (a + b) / 2, c = journeyCam(m, { drift: false });
    if (960 + (cn.x - c.x) * c.zoom > POP_SX) a = m; else b = m;
  }
  return Math.max(cue('V09') + 0.3, (a + b) / 2);
});
export const containerPopAt = (i) => POP_AT[i];
function popUpK(T, i) { return clamp((T - POP_AT[i]) / 0.34); }
/** 容器口（世界坐标）：道具从这里蹦出来。 */
export function containerMouth(i) {
  const cn = CONT[i], y = CONT_Y(cn);
  const h = { chest: 70, pot: 96, barrel: 110, flowerPot: 70, bigChest: 92 }[cn.kind];
  return [cn.x, y - h];
}
export function drawContainers(lg, T) {
  CONT.forEach((cn, i) => {
    const pk = popUpK(T, i);
    if (pk <= 0) return;
    const o = { x: cn.x, y: CONT_Y(cn), s: 1, t: T, open: openK(T, cn.at), seed: 30 + i };
    // 被剑尖挑开的一瞬：容器一跳（挤压）
    const jolt = T >= cn.at ? Math.exp(-(T - cn.at) / 0.1) * Math.sin((T - cn.at) * 38) : 0;
    // 立起：outBack 过冲 + 一点左右晃（纸片的弹性）
    const sy = pk >= 1 ? 1 : Math.max(0.02, outBack(pk, 2.2));
    const sk = pk >= 1 ? 0 : 0.18 * Math.sin(pk * Math.PI * 2.2) * (1 - pk);
    lg.save();
    lg.translate(o.x, o.y); lg.transform(1, 0, -sk, 1, 0, 0); lg.scale(1 + 0.08 * jolt, sy * (1 - 0.1 * jolt)); lg.translate(-o.x, -o.y);
    if (cn.kind === 'chest' || cn.kind === 'bigChest') {
      const b = T < cn.at ? 0 : clamp((T - cn.at) / 0.06) * (1 - 0.6 * smoothstep(cn.at + 0.25, cn.at + 1.1, T));
      drawChest(lg, { ...o, big: cn.kind === 'bigChest', burst: b });
    } else if (cn.kind === 'pot') drawPot(lg, o);
    else if (cn.kind === 'barrel') drawBarrel(lg, o);
    else drawFlowerPot(lg, o);
    lg.restore();
    // 立起时底边的折痕纸条 + 一圈纸屑
    if (pk < 1) {
      const w = cn.kind === 'bigChest' ? 92 : 66;
      lg.fillStyle = rgba(PAL.shadow, 0.22 * (1 - pk));
      lg.fillRect(o.x - w, o.y - 3, w * 2, 5);
      burst(lg, T, { at: POP_AT[i] + 0.04, seed: 880 + i, count: 8, x: o.x, y: o.y - 6, spread: w * 0.7, speed: [60, 180], angle: [-Math.PI * 0.95, -Math.PI * 0.05], gravity: 500, drag: 2, life: [0.35, 0.55], size: [5, 9], spin: [-8, 8] },
        (g, x, y, s) => { g.save(); g.globalAlpha *= 1 - s.p; g.translate(x, y); g.rotate(s.rot); g.fillStyle = s.r < 0.5 ? PAL.paper : PAL.goldLight; g.fillRect(-s.size / 2, -s.size / 4, s.size, s.size / 2); g.restore(); });
    }
  });
}

// ———— 道具飞进背包（屏幕空间，画在 HUD 图层里） ————
const POP = 0.12, FLY_END = 0.32; // 0–0.12 蹦出来亮相，0.12–0.32 沿弧线飞进背包（= hudState.bagAt）
export function drawItemFlights(g, T, c, bag) {
  CONT.forEach((cn, i) => {
    const t = T - cn.at;
    if (t < 0 || t > FLY_END + 0.45) return;
    const [mx, my] = containerMouth(i);
    const m = toScreen(c, 1, mx, my);
    if (t <= FLY_END) {
      const kp = clamp(t / POP), kf = clamp((t - POP) / (FLY_END - POP));
      const p0 = [m[0] - 46 * kp, m[1] - 120 * outBack(kp, 2.4)]; // 往左上蹦（让开右边主人的脸）
      const ctrl = [lerp(p0[0], bag[0], 0.35) + 40, Math.min(p0[1], bag[1]) - 150];
      const e = inOutSine(kf);
      const x = (1 - e) * (1 - e) * p0[0] + 2 * (1 - e) * e * ctrl[0] + e * e * bag[0];
      const y = (1 - e) * (1 - e) * p0[1] + 2 * (1 - e) * e * ctrl[1] + e * e * bag[1];
      const s = (0.35 + 0.95 * outBack(kp, 2)) * lerp(1, 0.42, inCubic(kf));
      // 拖尾闪光
      for (let j = 1; j <= 4; j++) {
        const ee = clamp(e - j * 0.07);
        if (kf <= 0 || ee <= 0) continue;
        const tx = (1 - ee) * (1 - ee) * p0[0] + 2 * (1 - ee) * ee * ctrl[0] + ee * ee * bag[0];
        const ty = (1 - ee) * (1 - ee) * p0[1] + 2 * (1 - ee) * ee * ctrl[1] + ee * ee * bag[1];
        sparkle(g, tx, ty, 16 - j * 3, { color: PAL.goldLight, alpha: 0.75 - j * 0.15, rot: j });
      }
      glow(g, x, y, 70 * s, PAL.goldLight, 0.55 * (1 - kf * 0.5));
      drawItemIcon(g, cn.item, { x, y, s: s * 1.15, rot: 0.5 * Math.sin(t * 14) * kf, t: T, glint: clamp((t - 0.02) / 0.12) });
    } else {
      // 进包：一圈金色小闪星
      burst(g, T, { at: cn.at + FLY_END, seed: 840 + i, count: 9, x: bag[0], y: bag[1] - 4, speed: [140, 320], angle: [-Math.PI, 0], gravity: 300, drag: 3, life: [0.3, 0.45], size: [10, 18] },
        (gg, x, y, s) => sparkle(gg, x, y, s.size * (1 - s.p * 0.7), { color: s.r < 0.5 ? PAL.goldLight : PAL.white, alpha: 1 - s.p, rot: s.rot }));
    }
  });
}

/** 开箱金光迸出（世界坐标，main 图层之后用 screen 叠）：金色光点往上喷。 */
export function drawOpenSparks(g, T) {
  CONT.forEach((cn, i) => {
    const [mx, my] = containerMouth(i);
    burst(g, T, { at: cn.at, seed: 860 + i, count: 18, x: mx, y: my + 6, spread: 26, speed: [260, 620], angle: [-Math.PI * 0.85, -Math.PI * 0.15], gravity: 900, drag: 1.6, life: [0.45, 0.8], size: [7, 15] },
      (gg, x, y, s) => sparkle(gg, x, y, s.size * (1 - s.p * 0.5), { color: s.r < 0.6 ? PAL.goldLight : PAL.coin, alpha: 1 - s.p, rot: s.rot }));
  });
}

// ———— 横穿的鸡（main 图层，世界坐标；画在马之后 = 从马前面跑过） ————
const CH0 = EV.chicken - 0.55, CH1 = EV.chicken + 0.5; // 90.50 从画右冲进来，91.05 从马头前横穿，91.55 跑出画左
export function drawChickenRun(lg, T, c) {
  if (T < CH0 || T > CH1) return;
  const u = (T - CH0) / (CH1 - CH0);
  const sx = lerp(1990, -90, u); // 屏幕轨迹（91.05 时 ≈ 马头前）
  const x = c.x + (sx - 960) / c.zoom;
  const cross = smoothstep(CH0 + 0.25, CH0 + 0.75, T);
  const y = lerp(848, 904, cross);
  const s = lerp(0.95, 1.18, cross);
  // 惊起的羽毛
  burst(lg, T, { at: EV.chicken, seed: 871, count: 10, x: x + 10, y: y - 40, spread: 12, speed: [80, 260], angle: [-Math.PI, 0], gravity: 120, drag: 2.5, life: [0.6, 1.0], size: [7, 12], spin: [-5, 5] },
    (gg, px, py, st) => {
      gg.save(); gg.globalAlpha *= 1 - st.p; gg.translate(px, py); gg.rotate(st.rot);
      gg.fillStyle = st.r < 0.7 ? PAL.white : PAL.goldLight; gg.beginPath(); gg.ellipse(0, 0, st.size, st.size * 0.38, 0, 0, TAU); gg.fill();
      gg.restore();
    });
  // 扬起的小尘
  for (let j = 0; j < 4; j++) {
    const tb = CH0 + 0.12 + j * 0.2;
    const age = T - tb;
    if (age < 0 || age > 0.5) continue;
    const dx = c.x + (lerp(1990, -90, (tb - CH0) / (CH1 - CH0)) - 960) / c.zoom + 30;
    lg.fillStyle = rgba(mixHex(PAL.sand, PAL.paper2, 0.5), 0.55 * (1 - age / 0.5));
    lg.beginPath(); lg.ellipse(dx + age * 40, lerp(848, 904, smoothstep(CH0 + 0.25, CH0 + 0.75, tb)) - 4 - age * 20, 10 + age * 40, 6 + age * 18, 0, 0, TAU); lg.fill();
  }
  drawChicken(lg, { x, y, s, face: -1, t: T, pose: 'run', phase: (T - CH0) * 7 });
  void journeyGroundY; void blob; void outCubic;
}
