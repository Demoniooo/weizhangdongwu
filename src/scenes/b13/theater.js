// b13 私有：纸剧场段（150.52–161.13）。剧场坐标 = TT-W 屏幕坐标；时序全部取 theaterState(T)（与 b12 共用），
// 块内只补木偶表演、名字之剑、剥字 / 还字、B11 冲击、B12 逐节弹飞与谢幕。
import { PAL, glow, sparkle, rays, blob, cut } from '../../core/paper.js';
import { applyCam, toScreen } from '../../core/camera.js';
import { clamp, lerp, seg, hit, wobble, TAU, rgba, mixHex, hash2, noise1 } from '../../core/util.js';
import { ez, outBack, outCubic, inExpo, glide, inOutCubic, outExpo, inQuad, inCubic } from '../../core/ease.js';
import { burst } from '../../core/particles.js';
import { charsOf, paperGlyph } from '../../ui/type.js';
import { marqueePlate, battleMenu, turnBanner, damageNumber, lvUpBadge } from '../../ui/kit.js';
import { drawTheater, theaterState, theaterClip, THEATER } from '../../env/theater.js';
import { drawCage } from '../../props/cave.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawPrincess } from '../../rigs/princess.js';
import { drawDragon, drawLizard } from '../../rigs/dragon.js';
import { drawNameSword } from '../../props/sword.js';
import { dustDraw, sparkDraw } from '../../props/misc.js';
import { impact } from '../../fx/transitions.js';
import { SEAMS, resolveParams } from '../_seams.js';
import { B08, B09, B10, B11, B12, E01, PEEL, PEEL_LEAD, PEEL_FLY, POP_AT, POP_SPAN, RET0, RET_STEP, RET_FLY, withDrift, qbez } from './common.js';

const HERO = charsOf('hero'), DRAGON = charsOf('dragon');
const GUARD = THEATER.sword.guard;                 // 护手 (600,560)
const WIN_C = [427.5, 215];                        // 勇者名字牌窗口中心（剥字起点 / 还字终点）
const FLOOR = THEATER.floorY;                      // 木偶脚底线 840

// ———————————————————— 接缝 150.52 的入场状态：一律从合同 SEAMS['b12|b13'] 读（b12 出场 = 本块首帧） ————————————————————
const SEAM = SEAMS['b12|b13'];
const seamItem = (id) => [...(SEAM.actors || []), ...(SEAM.props || []), ...(SEAM.ui || [])].find((it) => it.id === id);
/** 合同里的勇者偶（只剩两条腿，锚点 = 龙嘴 + 偏移）。 */
export const seamHero = (T, mouth) => resolveParams(seamItem('hero').params, T, { A: { dragon: { mouth } } });
/** 合同里的龙偶（jaw / eyes / puff）。 */
export const seamDragon = (T) => resolveParams(seamItem('dragon').params, T, {});
/** 合同里的迷你公主偶（expr / sign）。 */
export const seamPrincess = (T) => resolveParams(seamItem('princess').params, T, {});
/** 勇者围巾全块统一 = 合同里的围巾（V03 吸收心愿后长 20%、金边 0.6；V07 起缺口 + 破洞）。 */
export const SCARF = { ...(seamItem('hero').params(B08, { A: { dragon: { mouth: [0, 0] } } }).scarf || { len: 936, glow: 0.6, notch: true, hole: true }) };
const LAND_X = 700;                                // 吐出来后跪在菜单右边（菜单 x 150–560 会挡住签位 520）

// ———————————————————— 名字之剑几何 ————————————————————
/** 剑角：水平 → 156.80 举过头顶竖直 → B11 劈下（inExpo 过冲）→ 回落水平 → B12 斜举 → 160.40 还字时再举高。 */
export function swordAngle(T) {
  if (T < B11 - 0.37) return 0;
  if (T < B11 - 0.02) {
    const a = seg(T, B11 - 0.37, B11 - 0.1);
    return -Math.PI / 2 * inOutCubic(a) + 0.08 * Math.sin(Math.PI * seg(T, B11 - 0.37, B11 - 0.25)) - 0.1 * ez(T, B11 - 0.12, B11 - 0.02, outCubic);
  }
  // 劈下：B11−0.02 → B11+0.04（闪白两帧把转动盖住，第三帧剑已横在龙头上）
  if (T < B11 + 0.04) return lerp(-Math.PI / 2 - 0.1, 0.16, inQuad(seg(T, B11 - 0.02, B11 + 0.04)));
  if (T < B12) return 0.16 * (1 - outBack(seg(T, B11 + 0.04, B11 + 0.3), 2.2));
  // B12：勇者收剑斜举（剑尖朝右上、从回合横幅后面穿出画面上沿，不挡龙偶谢幕）；160.40 字飞回名字牌，剑柄再举高欢呼
  const salute = -1.3 * ez(T, B12 + 0.05, B12 + 0.5, inOutCubic);
  return salute - 0.25 * ez(T, RET0 + 0.12, RET0 + 0.42, outBack);
}
export const PLANT = [720, 660];                   // 斜举时护手位置（剧场坐标，胸口高度）
/** 护手位置：基本固定在 (600,560)；举剑前蹲一下、劈下时整体往前送 26px。 */
function guardAt(T) {
  const dip = 14 * Math.sin(Math.PI * seg(T, B11 - 0.42, B11 - 0.3));
  const lunge = 26 * ez(T, B11 - 0.02, B11 + 0.06, outExpo);
  const g0 = [GUARD[0] + lunge, GUARD[1] + dip - 10 * ez(T, B11 - 0.37, B11 - 0.1, inOutCubic) * (1 - seg(T, B11 - 0.02, B11 + 0.04))];
  const k = ez(T, B12 + 0.05, B12 + 0.5, inOutCubic);
  const up = ez(T, RET0 + 0.12, RET0 + 0.42, outBack);
  return [lerp(g0[0], PLANT[0], k), lerp(g0[1], PLANT[1], k) - 40 * up];
}
/** 13 块字牌的进度：剥下飞来（0→1），160.40 起按阅读顺序飞回名字牌（1→0）。 */
function swordTiles(T) {
  return PEEL.map((t, i) => {
    const inK = clamp((T - (t - PEEL_LEAD)) / PEEL_FLY);
    const back = clamp((T - (RET0 + RET_STEP * i)) / RET_FLY);
    return back > 0 ? 1 - back : inK;
  });
}
/** 名字之剑各参数（剧场坐标）。 */
export function swordState(T) {
  const angle = swordAngle(T);
  const [gx, gy] = guardAt(T);
  const glowK = T < B11 - 0.32 ? 0 : T < B12 + 0.2 ? clamp((T - (B11 - 0.32)) / 0.27) : 1 - clamp((T - (B12 + 0.2)) / 0.6);
  const ca = Math.cos(angle), sa = Math.sin(angle);
  return {
    x: gx, y: gy, angle, tiles: swordTiles(T), glow: glowK,
    scarfWrap: seg(T, B10, B10 + 0.32), from: WIN_C, t: T,
    grip: [gx - 59 * ca, gy - 59 * sa],
    alpha: seg(T, B09 + 0.12, B09 + 0.22),
  };
}

// ———————————————————— 勇者偶 ————————————————————
const RIG0 = {};
function handOffset(pose, extra = {}) {
  const key = pose + JSON.stringify(extra);
  if (!RIG0[key]) { const r = heroRig({ x: 0, y: 0, s: 1, face: 1, t: 0, pose, rod: true, ...extra }); RIG0[key] = r.handR; }
  return RIG0[key];
}
const MOUTH0 = [1157, 566];                         // puppet 姿态 jaw 0.24 时的龙嘴（无 A 时的兜底）
/** 勇者偶本帧参数 + 画在哪一层（L2 = 木偶层，被剧场裁切；L4 = 与名字之剑同层）。 */
export function heroState(T, A) {
  const base = { s: 1, face: 1, t: T, rod: true, scarf: { ...SCARF } };
  const M0 = A?.mouth || MOUTH0;
  // 接缝帧：脑袋还在龙嘴里，两条腿乱蹬（合同 SEAMS['b12|b13'] 的 hero 参数原样照搬）
  if (T < B08 + 0.05) return { layer: 'L2', o: seamHero(T, M0) };
  // 噗！倒飞出去（150.57–150.90），落地单膝跪（菜单右侧，看得见）
  const tLand = B08 + 0.38;
  if (T < tLand) {
    const k = seg(T, B08 + 0.05, tLand);
    const s0 = seamHero(B08, MOUTH0);
    const x = lerp(s0.x, LAND_X, outCubic(k));
    const yb = lerp(s0.y, FLOOR, k) - 150 * Math.sin(Math.PI * Math.min(1, k * 1.05));
    return { layer: 'L2', o: { ...base, x, y: Math.min(yb, FLOOR), pose: 'puppetKneel', expr: 'dizzy', rot: lerp(s0.rot ?? 0, 0, outCubic(k)) - 0.35 * Math.sin(Math.PI * k), pivot: [0, -120], scarf: { ...SCARF, vel: [-900 * (1 - k), -200], ground: FLOOR } } };
  }
  // 跪地：晕 → 疼 → 153.00 抬头看公主、握拳 → 153.20 站起，破围巾自己飘起来
  const tLook = B08 + 2.48, tRise = B08 + 2.68;
  const land = wobble(T, tLand, 4, 0.18);
  if (T < tRise) {
    const look = ez(T, tLook - 0.08, tLook + 0.12, outCubic);
    const expr = T < B08 + 1.3 ? 'dizzy' : T < tLook - 0.06 ? 'hurt' : 'determined';
    return { layer: 'L2', o: { ...base, x: LAND_X, y: FLOOR, pose: 'puppetKneel', expr, squash: -0.12 * land,
      jointsAdd: { nod: -24 * look, aB: [-40 * look, 60 * look, 0] }, yaw: lerp(0.6, 1, look),
      scarf: { ...SCARF, ground: FLOOR, wind: [0, -260 * seg(T, tLook, tRise)] } } };
  }
  // 站起（153.20–153.45）→ 举剑柄（B09 153.46 起手 → 153.62 握住剑柄）
  const tGrip = B09 + 0.16;
  const sw = swordState(T);
  if (T < tGrip) {
    const kR = ez(T, tRise, tRise + 0.22, outBack);
    const kH = ez(T, B09, tGrip, outCubic);
    const off = handOffset('puppetHoldSword');
    const hx = lerp(LAND_X, sw.grip[0] - off[0], kH), hy = lerp(FLOOR, sw.grip[1] - off[1], kH) - 60 * Math.sin(Math.PI * kH);
    const pose = kH > 0 ? { from: 'puppetRise', to: 'puppetHoldSword', k: kH } : { from: 'puppetKneel', to: 'puppetRise', k: kR };
    return { layer: 'L2', o: { ...base, x: hx, y: hy, pose, sword: T < tGrip - 0.04 ? 'hand' : 'empty', swordAngle: kH > 0 ? lerp(-1.35, -0.1, kH) : lerp(0.9, -1.35, kR), expr: 'determined',
      squash: 0.1 * Math.sin(Math.PI * seg(T, tRise, tRise + 0.3)),
      scarf: { ...SCARF, ground: 1e5, wind: [-340, -300] } } };
  }
  // 握名字之剑（L4，手对准剑柄 grip）：举过头顶 / 劈下 / 斜举 / 还字后高举欢呼
  const raise = ez(T, B11 - 0.37, B11 - 0.1, inOutCubic) * (1 - seg(T, B11 - 0.02, B11 + 0.04));
  const plant = ez(T, B12 + 0.05, B12 + 0.5, inOutCubic);
  const cheer = ez(T, RET0 + 0.12, RET0 + 0.42, outBack);
  const jointsAdd = { aF: [-46 - 60 * raise + 20 * plant - 40 * cheer, 0, 0], aB: [-30 - 50 * raise - 70 * cheer, 0, 0],
    lean: -6 * raise + 10 * seg(T, B11 - 0.02, B11 + 0.04) * (1 - plant) - 6 * cheer };
  const o = { ...base, pose: 'puppetHoldSword', sword: 'empty', jointsAdd };
  const r = heroRig({ ...o, x: 0, y: 0 });
  let x = sw.grip[0] - r.handR[0], y = sw.grip[1] - r.handR[1];
  const expr = T < B11 - 0.4 ? 'determined' : T < B11 + 0.6 ? 'shout' : T < RET0 + 0.1 ? 'determined' : 'grin';
  // 脚底不低于台面（举剑时人跟着被木杆托起）
  if (y > FLOOR) y = FLOOR;
  return { layer: 'L4', o: { ...o, x, y, expr, ahogeAt: RET0 + 0.15, scarf: { ...SCARF, ground: FLOOR } }, sword: sw };
}

// ———————————————————— 龙偶 / 谢幕 / 小蜥蜴 ————————————————————
const LIZ_S = 2.45;
const LIZ_HOP = 290;                               // 诞生后往台中央蹦两下（大幕合拢时它还看得见）
let LIZ_PROBE = null;
function lizardHeadOffset() {
  if (LIZ_PROBE) return LIZ_PROBE;
  try {
    const cv = new OffscreenCanvas(4, 4).getContext('2d');
    const r = drawLizard(cv, { x: 0, y: 0, s: LIZ_S, face: -1, pose: 'sit', t: 0 });
    LIZ_PROBE = r.head;
  } catch (e) { LIZ_PROBE = [0, -95]; }
  return LIZ_PROBE;
}
const SHRUNK_HEAD = [1467 + (1350 - 1467) * 0.15, 860 + (520 - 860) * 0.15];   // popped=13 时龙头位置（pivot (1467,860)、0.15 倍）
/** popped（可带小数）：第 j 节在 POP_AT[j] 起 0.15s 内弹飞。 */
export const poppedAt = (T) => POP_AT.reduce((n, tp) => n + clamp((T - tp) / 0.15), 0);
/** B12 后小蜥蜴诞生（popped = 13）的时刻。 */
const LIZ_T = POP_AT[12] + 0.15;

export function dragonState(T) {
  const S0 = seamDragon(B08);
  // 噗：jaw 合同值 → 0.75（0.08s，重音），0.2s 后合上；腮帮的鼓气同时泄掉
  const spitJaw = T < B08 + 0.08 ? lerp(S0.jaw, 0.75, outCubic(seg(T, B08, B08 + 0.08))) : lerp(0.75, 0.06, ez(T, B08 + 0.22, B08 + 0.55, outCubic));
  const puff = (S0.puff || 0) * (1 - outCubic(seg(T, B08, B08 + 0.1)));
  let jaw = spitJaw, rot = 6 * Math.sin(Math.PI * seg(T, B08, B08 + 0.3)), eyes = T < B08 + 0.5 ? S0.eyes : { state: 'smug' }, tt = T;
  // 剑长出来：吓到；156.90 抬头咽口水
  if (T >= B10 + 0.3) eyes = { state: 'normal', pupil: lerp(0.3, 0.12, seg(T, B10 + 0.3, B10 + 1.2)), look: [-0.6, 0] };
  // 剑刃逼近：龙偶往后上方一缩（155.30–155.90），眼睛露在剑刃上方
  const rear = ez(T, B10 + 1.5, B10 + 2.1, outBack) * (1 - ez(T, B12, B12 + 0.5, glide));
  if (T >= B11 - 0.3) {
    const up = ez(T, B11 - 0.3, B11 - 0.12, outCubic);
    eyes = { state: 'worried', pupil: 0.1, look: [-0.3 * (1 - up), -1 * up] };
    jaw = 0.06 + 0.12 * Math.sin(Math.PI * seg(T, B11 - 0.2, B11 - 0.05));   // 咽口水
    rot = 6 * up;
  }
  // B11 受击定格（慢动作：待机运动冻结在 157.32）
  if (T >= B11 + 0.06) {
    eyes = { state: 'x' };
    jaw = 0.55;
    rot = lerp(6, -9, outExpo(seg(T, B11 + 0.06, B11 + 0.2)));
    tt = Math.min(T, B11 + 0.15) + 0.06 * Math.max(0, T - (B11 + 0.15));
  }
  const o = { pose: 'puppet', t: tt, jaw, rot: rot - 5 * rear, eyes, puff, x: 1350 + 40 * rear, y: 520 - 80 * rear };
  if (T < B08 + 0.01) return { o: { ...S0, t: T } };
  if (T < B12) return { o };
  // B12：逐节弹飞，缩到 0.15，木杆淡出；160.35 换成小蜥蜴
  const popped = Math.min(13, poppedAt(T));
  const plates = DRAGON.map((ch, j) => ({ lit: clamp((T - (POP_AT[j] - 0.14)) / 0.1), pop: 0 }));
  const dz = ez(T, B12, B12 + 0.5, outCubic);
  const so = { pose: 'shrink', t: T, popped, plates, rod: 1 - seg(T, B12 + 0.1, B12 + 0.6), jaw: lerp(0.55, 0.1, dz),
    rot: lerp(-14, 0, dz), x: 1350 + 40 * rear, y: 520 - 80 * rear, eyes: { state: T < B12 + 1.0 ? 'dizzy' : 'worried' } };
  return { o: so, lizard: T >= LIZ_T };
}
/** 小蜥蜴（剧场里，面朝左）：诞生 → 眨眼 → 160.75 牌子砸在旁边后撅嘴。 */
function lizardOpts(T) {
  const off = lizardHeadOffset();
  const born = seg(T, LIZ_T, LIZ_T + 0.25);
  const land = B12 + 2.95;
  const pout = T >= land + 0.08;
  const jump = T >= land && T < land + 0.3 ? -40 * Math.sin(Math.PI * seg(T, land, land + 0.3)) : 0;
  const hk = seg(T, LIZ_T + 0.05, LIZ_T + 0.3);
  const hop = -34 * Math.abs(Math.sin(2 * Math.PI * hk));
  return { x: SHRUNK_HEAD[0] - off[0] - LIZ_HOP * inOutCubic(hk), y: SHRUNK_HEAD[1] - off[1] + jump + hop, s: LIZ_S, face: -1, t: T, pose: pout ? 'pout' : hk > 0 && hk < 1 ? 'scurry' : 'sit',
    squash: 0.25 * (1 - outBack(born, 3)) - 0.12 * wobble(T, land + 0.3, 3, 0.2), miniPlate: { period: 3.6 },
    eyes: pout ? undefined : { blink: true } };
}

// ———————————————————— 迷你公主偶 ————————————————————
/** 鸟笼迷你偶沿顶上吊杆滑到龙头左上方（152.40–152.70，举牌给勇者看），B12 机位拉回时再滑回原位。 */
const CAGE_SIDE = [1090, 392];
export function cagePos(T) {
  const k = ez(T, B08 + 1.88, B08 + 2.2, inOutCubic) * (1 - ez(T, B12 + 0.08, B12 + 0.7, inOutCubic));
  const sw = 0.06 * wobble(T, B08 + 2.2, 2.2, 0.35) - 0.05 * wobble(T, B12 + 0.7, 2.2, 0.35);
  return { x: lerp(THEATER.cage.x, CAGE_SIDE[0], k), y: lerp(THEATER.cage.y, CAGE_SIDE[1], k), rot: sw };
}
function princessOpts(T) {
  const P0 = seamPrincess(T);
  const cp = cagePos(T);
  P0.x += cp.x - THEATER.cage.x; P0.y += cp.y - THEATER.cage.y;
  const tSign = B08 + 2.28;
  const sign = ez(T, tSign - 0.1, tSign + 0.12, outBack) * (1 - ez(T, B12 + 2.2, B12 + 2.5, glide) * 0.4);
  const expr = T < B08 + 0.6 ? P0.expr : T < tSign - 0.15 ? 'tense' : T < B11 - 0.3 ? 'smile' : T < B11 + 0.5 ? 'shock' : 'laugh';
  return { ...P0, sign: T < B08 + 0.01 ? P0.sign : sign, expr };
}

// ———————————————————— 弹飞的小纸字（气球） ————————————————————
function balloonChars(lg, T, A) {
  if (T < B12 || !A) return;
  const piv = [1467, 860];
  const kNow = A.scale || 1;
  for (let j = 0; j < 13; j++) {
    const t0 = POP_AT[j] + 0.08;
    const age = T - t0;
    if (age < 0 || age > 1.25) continue;
    // 弹飞点：脖根处（已弹飞节的锚点留在脖根），按弹飞时刻的缩放换算
    const ref = A.plates?.[Math.min(12, Math.max(0, Math.floor(poppedAt(T)) - 1))] || [1280, 470];
    const kAt = 1 - 0.85 * (j / 13);
    const nat = [piv[0] + (ref[0] - piv[0]) / Math.max(0.15, kNow), piv[1] + (ref[1] - piv[1]) / Math.max(0.15, kNow)];
    const o0 = [piv[0] + (nat[0] - piv[0]) * kAt, piv[1] + (nat[1] - piv[1]) * kAt - 30];
    const e = outCubic(clamp(age / 0.35));
    const vx = (hash2(j, 3) - 0.5) * 220 - 170;     // 扇形散开，不排成一竖列
    const x = o0[0] + vx * age + 60 * (hash2(j, 5) - 0.5) * e + 22 * Math.sin(age * 4.2 + j) * clamp(age / 0.4);
    const y = o0[1] - 80 * e - (120 + 80 * hash2(j, 7)) * age;
    const a = 1 - clamp((age - 0.8) / 0.45);
    const sc = lerp(0.4, 1, outBack(clamp(age / 0.3), 2.6));
    lg.save();
    lg.globalAlpha *= a;
    // 线
    lg.strokeStyle = rgba(PAL.inkSoft, 0.7); lg.lineWidth = 2; lg.beginPath(); lg.moveTo(x, y + 30 * sc);
    lg.quadraticCurveTo(x + 10 * Math.sin(age * 6 + j), y + 60 * sc, x - 4, y + 86 * sc); lg.stroke();
    // 纸气球
    const b = blob(x, y, 34 * sc, 36 * sc, { seed: 40 + j, amp: 0.03 });
    cut(lg, b, PAL.dragonDark, { rim: PAL.dragonWing, rimW: 2, stroke: PAL.gold, lw: 3 });
    paperGlyph(lg, DRAGON[j], x, y + 1, 46 * sc, { fill: PAL.goldLight, edge: PAL.dragonDeep, edgeW: 0.1, rot: 0.15 * Math.sin(age * 3 + j) });
    lg.restore();
  }
}

// ———————————————————— 名字牌 / 菜单 / 横幅（剧场坐标） ————————————————————
/** 名字牌（剧场坐标）。返回已经掉到台上的巨龙牌参数（由木偶层画），否则 null。 */
function drawPlates(lg, T, st) {
  const hp = st.hp, hpl = st.heroPlate, dpl = st.dragonPlate;
  // —— 勇者牌 ——
  let ho = { side: 'hero', state: hpl.state, progress: hpl.progress, mode: 'pass', crack: hpl.crack, peeled: hpl.peeled, drop: hpl.drop,
    hp: hp.hero, hpLag: hp.heroLag, hpText: `HP ${hp.heroNum}`, t: T };
  if (hpl.pulse > 0) ho.tf = { s: 1 + 0.08 * hpl.pulse };
  if (T >= B10 - PEEL_LEAD && T < RET0) {
    // 剥字：当前要剥的字停在中线（center 模式），剥走一个、整排左移一格
    const dep = PEEL.filter((t) => T >= t - PEEL_LEAD).length;
    const slide = PEEL.slice(0, 12).reduce((s, t) => s + ez(T, t - PEEL_LEAD, t - PEEL_LEAD + 0.1, outCubic), 0);
    ho = { ...ho, state: 'active', mode: 'center', progress: slide / 12, peeled: dep, centerGold: true };
  } else if (T >= RET0) {
    // 还字：按阅读顺序落回窗口
    // 还字：每个字落在中线（center 模式），整排随之左移
    const arr = HERO.map((c, i) => RET0 + RET_STEP * i + RET_FLY);
    const n = arr.filter((t) => T >= t).length;
    const name = HERO.map((c, i) => (T >= arr[i] ? c : ' ')).join('');
    const slide = arr.slice(1).reduce((sum, t) => sum + ez(T, t - 0.04, t + 0.06, outCubic), 0);
    ho = { ...ho, state: 'active', mode: 'center', progress: n > 0 ? slide / 12 : 0, peeled: 0, name, centerGold: true };
  }
  marqueePlate(lg, ho);
  // —— 巨龙牌 ——
  let dop = { side: 'dragon', state: dpl.state, progress: dpl.progress, drop: dpl.drop, shrink: dpl.shrink, hp: hp.dragon, hpLag: hp.dragonLag, t: T };
  if (T >= B12) {
    const fall = seg(T, B12 + 2.7, B12 + 2.95);
    const fk = inQuad(fall);
    const shr = 0.45 * ez(T, B12, B12 + POP_SPAN, glide);
    const land = wobble(T, B12 + 2.95, 3, 0.18);
    dop = { ...dop, state: 'cracked', mode: 'center', progress: seg(T, B12, B12 + POP_SPAN), shrink: shr,
      tf: { dx: lerp(0, 1445 - 1470, fk), dy: lerp(0, 812 - 219, fk) + 8 * land, rot: lerp(0, 0.06, fk) - 0.03 * land },
      ropeTop: fall > 0 ? 219 : 120 };
  }
  if (T >= B12 + 2.7) return dop;                    // 掉下来以后是台上的道具：交给木偶层画（大幕合拢时被盖住）
  marqueePlate(lg, dop);
  return null;
}
function drawMenu(lg, T, st) {
  const m = st.menu;
  battleMenu(lg, { pop: m.show, cursor: m.cursor === 'skill' ? m.cursorMove : 0, locked: m.gray, lockPop: m.lockPop, blink: m.flash, press: m.press,
    submenu: m.submenu, t: T });
}
function drawBanner(lg, T, st) {
  const tv = B12 + 2.5;
  const b = st.banner;
  if (T < tv) { turnBanner(lg, { text: b.text, textFrom: b.prev, flip: b.flip < 1 ? b.flip : 0, drop: b.drop, t: T }); return; }
  // 「胜利！」从天而降，把旧横幅砸飞
  const hitK = seg(T, tv + 0.08, tv + 0.2);
  if (hitK < 1) {
    lg.save();
    lg.translate(960, 215 + 40 * hitK); lg.scale(1 + 0.15 * hitK, 1 - 0.9 * outCubic(hitK)); lg.translate(-960, -215);
    lg.globalAlpha *= 1 - hitK;
    turnBanner(lg, { text: '勇者的回合', drop: 1, t: T });
    lg.restore();
  }
  turnBanner(lg, { text: '胜利！', drop: seg(T, tv, tv + 0.14), t: T });
}

// ———————————————————— 冲击：竖直斩线 + 放射线 ————————————————————
function strikeFx(g, T, c) {
  const age = T - B11;
  if (age < 0 || age > 0.75) return;
  const top = toScreen(c, 1, 960, -400), bot = toScreen(c, 1, 960, 1400);
  const k = 1 - clamp((age - 0.12) / 0.6);
  const w = lerp(40, 6, clamp(age / 0.3));
  g.save();
  g.globalCompositeOperation = 'screen';
  const gr = g.createLinearGradient(top[0] - 90, 0, top[0] + 90, 0);
  gr.addColorStop(0, rgba(PAL.goldLight, 0)); gr.addColorStop(0.5, rgba(PAL.goldLight, 0.55 * k)); gr.addColorStop(1, rgba(PAL.goldLight, 0));
  g.fillStyle = gr; g.fillRect(top[0] - 90, -20, 180, 1120);
  g.restore();
  g.save();
  g.fillStyle = rgba(PAL.white, k);
  const grow = outExpo(clamp(age / 0.08));
  const y0 = lerp(540, -20, grow), y1 = lerp(540, 1100, grow);
  g.beginPath();
  g.moveTo(top[0], y0); g.lineTo(top[0] + w / 2, 540); g.lineTo(bot[0], y1); g.lineTo(top[0] - w / 2, 540); g.closePath();
  g.fill();
  g.restore();
}

// ———————————————————— 口水、尘、火花 ————————————————————
function spitFx(lg, T, heroA) {
  // 噗：一串口水珠从龙嘴喷出
  burst(lg, T, { at: B08 + 0.04, seed: 131, count: 16, x: MOUTH0[0], y: MOUTH0[1], spread: 16, speed: [260, 620], angle: [Math.PI * 0.85, Math.PI * 1.18], gravity: 1300, drag: 1.4, life: [0.4, 0.8], size: [6, 13] },
    (g, x, y, s) => { g.fillStyle = rgba(PAL.crystal, 0.85 * (1 - s.p)); g.beginPath(); g.ellipse(x, y, s.size * 0.6, s.size * 0.8, s.rot, 0, TAU); g.fill(); g.fillStyle = rgba(PAL.white, 0.9 * (1 - s.p)); g.beginPath(); g.arc(x - s.size * 0.2, y - s.size * 0.3, s.size * 0.18, 0, TAU); g.fill(); });
  // 身上挂着的口水珠（亮晶晶，慢慢滑落）
  if (heroA && T > B08 + 0.38 && T < B08 + 2.7) {
    const a = 1 - seg(T, B08 + 2.2, B08 + 2.7);
    const pts = [[heroA.head[0] + 30, heroA.head[1] - 10], [heroA.head[0] - 20, heroA.head[1] + 30], [heroA.chest[0] + 18, heroA.chest[1]]];
    pts.forEach(([x, y], i) => {
      const dy = 18 * seg(T, B08 + 0.6 + i * 0.4, B08 + 2.4);
      lg.fillStyle = rgba(PAL.crystal, 0.8 * a); lg.beginPath(); lg.ellipse(x, y + dy, 6, 9, 0, 0, TAU); lg.fill();
      sparkle(lg, x - 2, y + dy - 3, 10 + 4 * Math.sin(T * 9 + i), { color: PAL.white, alpha: 0.9 * a });
    });
  }
  // 落地扬尘
  burst(lg, T, { at: B08 + 0.38, seed: 132, count: 10, x: LAND_X, y: FLOOR - 4, spread: 30, speed: [60, 200], angle: [Math.PI * 1.05, Math.PI * 1.95], gravity: -40, drag: 2, life: [0.5, 0.9], size: [14, 26] }, dustDraw);
}

/** 名字之剑 + 握剑的勇者（剧场坐标）。B12 起剑插进台板：剑与飞回的字牌只画在台面以上。 */
function drawSwordHero(lg, T, H) {
  const sw = swordState(T);
  let heroA = null;
  swooshFx(lg, T, sw);
  drawNameSword(lg, { ...sw, part: 'back' });
  if (H.layer === 'L4') {
    lg.save(); lg.beginPath(); lg.rect(-800, -1800, 3600, 1800 + FLOOR + 18); lg.clip();
    heroA = drawHero(lg, H.o);
    lg.restore();
  }
  drawNameSword(lg, { ...sw, part: 'front' });
  // 剑柄现身的闪光、每块字牌落槽的“咔”火花
  const ga = hit(T, B09 + 0.19, 0.12);
  if (ga > 0.02) { glow(lg, sw.x, sw.y, 160, PAL.goldLight, 0.8 * ga); sparkle(lg, sw.x, sw.y - 10, 90 * ga, { color: PAL.white }); }
  if (T < B11) PEEL.forEach((t, i) => {
    const k = hit(T, t - PEEL_LEAD + PEEL_FLY, 0.1);
    if (k < 0.03) return;
    const u = 60 + 126 * i, p = [sw.x + u * Math.cos(sw.angle), sw.y + u * Math.sin(sw.angle)];
    sparkle(lg, p[0] + 40, p[1] - 46, 46 * k, { color: PAL.goldLight, alpha: k });
  });
  return heroA;
}
/** B11 劈下的白色月牙残影（剑扫过的扇面，闪白两帧之后还看得见 0.25s）。 */
function swooshFx(lg, T, sw) {
  const t0 = B11 - 0.02, age = T - t0;
  if (age < 0 || age > 0.36) return;
  const a0 = -Math.PI / 2 - 0.1, a1 = Math.max(a0 + 0.01, sw.angle);
  const fade = 1 - clamp((age - 0.08) / 0.28);
  const R0 = 260, R1 = 1820;
  lg.save();
  const p = new Path2D();
  p.arc(sw.x, sw.y, R1, a0, a1);
  p.arc(sw.x, sw.y, R0, a1, a0, true);
  p.closePath();
  const gr = lg.createRadialGradient(sw.x, sw.y, R0, sw.x, sw.y, R1);
  gr.addColorStop(0, rgba(PAL.white, 0)); gr.addColorStop(0.55, rgba(PAL.goldLight, 0.35 * fade)); gr.addColorStop(0.92, rgba(PAL.white, 0.85 * fade)); gr.addColorStop(1, rgba(PAL.white, 0));
  lg.fillStyle = gr; lg.fill(p);
  lg.restore();
}

const SWORD_L2 = B12 + 1.0;                         // 剑 + 勇者从 ui 层换回木偶层的时刻（机位已回 TT-W）
/** 只用来“空跑”一遍 drawPlates 取巨龙牌参数的空画布。 */
const NULL_G = (() => { try { return new OffscreenCanvas(2, 2).getContext('2d'); } catch (e) { return null; } })();

/** 剧场一帧（150.52 ≤ T < E01）：四个图层 back / 木偶 / frame / 剑 + 界面。portal：E01 穿越台口时由救出镜头调用（只画台口与界面）。 */
export function drawStage(g, T, ctx, portal = null) {
  const st = theaterState(T);
  const c = withDrift(st.cam, T);
  const scale = st.scale;
  const stage = (lg) => { applyCam(lg, c, 1); if (scale !== 1) { lg.translate(960, 540); lg.scale(scale, scale); lg.translate(-960, -540); } };
  const o = { ...st, cam: c, cave: st.caveOpts };
  const D = dragonState(T);
  let A = null, heroA = null;
  let H = heroState(T, null);
  if (!portal) {
    ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawTheater(lg, T, { ...o, part: 'back' }));
    // —— 木偶层（裁进剧场盒子） ——
    ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
      lg.save(); lg.clip(theaterClip({ cam: c, scale })); stage(lg);
      const cg = cagePos(T), P = princessOpts(T);
      const cr = cg.rot ? { rot: cg.rot } : {};
      drawCage(lg, { x: cg.x, y: cg.y, mini: true, part: 'back', lock: { pins: 1 }, ...cr });
      drawPrincess(lg, P);
      drawCage(lg, { x: cg.x, y: cg.y, mini: true, part: 'front', lock: { pins: 1 }, ...cr });
      if (!D.lizard) A = drawDragon(lg, D.o);
      else drawLizard(lg, lizardOpts(T));
      H = heroState(T, A);
      if (H.layer === 'L2') heroA = drawHero(lg, H.o);
      // B12 机位回到 TT-W 之后：剑与勇者、掉到台上的巨龙牌都回木偶层（大幕合拢时被正确盖住）
      if (T >= SWORD_L2) heroA = drawSwordHero(lg, T, H) || heroA;
      if (T >= B12 + 2.7) { const dop = drawPlates(NULL_G, T, st); if (dop) marqueePlate(lg, dop); }
      spitFx(lg, T, heroA);
      // 小蜥蜴诞生的“噗”烟
      burst(lg, T, { at: LIZ_T - 0.02, seed: 141, count: 14, x: SHRUNK_HEAD[0], y: SHRUNK_HEAD[1] + 10, spread: 20, speed: [80, 260], angle: [0, TAU], gravity: -60, drag: 2.4, life: [0.4, 0.8], size: [16, 30] }, dustDraw);
      // 牌子落地扬尘
      burst(lg, T, { at: B12 + 2.95, seed: 142, count: 16, x: 1445, y: FLOOR - 6, spread: 160, speed: [60, 220], angle: [Math.PI * 1.1, Math.PI * 1.9], gravity: -30, drag: 2.2, life: [0.5, 1.0], size: [14, 28] }, dustDraw);
      balloonChars(lg, T, A);
      lg.restore();
    });
  }
  ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawTheater(lg, T, { ...o, part: 'frame', ...(portal || {}) }));
  // —— 名字牌 → 剑 + 握剑的勇者 → 撕口布边 → 横幅 / 菜单 / 战果（合同 ui 层：shadow 10、texture 0.2） ——
  ctx.layer(g, { shadow: 10, texture: 0.2 }, (lg) => {
    const uiA = portal ? 1 - seg(T, E01 + 0.05, E01 + 0.25) : 1;
    lg.save(); stage(lg); lg.globalAlpha *= uiA;
    drawPlates(lg, T, st);
    lg.restore();
    if (!portal && T >= B09 + 0.1 && T < SWORD_L2) { lg.save(); stage(lg); heroA = drawSwordHero(lg, T, H) || heroA; lg.restore(); }
    if (!portal) drawTheater(lg, T, { ...o, part: 'frameFront' });
    lg.save(); stage(lg); lg.globalAlpha *= uiA;
    drawBanner(lg, T, st);
    drawMenu(lg, T, st);
    // EXP / LV UP（160.50–160.60）
    if (!portal) {
      const tx = B12 + 2.7, fade = 1 - seg(T, E01 - 0.25, E01 - 0.05);
      if (T > tx && fade > 0) {
        lg.save(); lg.globalAlpha *= fade;
        damageNumber(lg, { text: 'EXP +9999', color: 'gold', x: 1000, y: 560, size: 70, p: Math.min(0.66, (T - tx) / 0.9), rise: 60 });
        lvUpBadge(lg, { x: 900, y: 410, p: seg(T, tx + 0.08, tx + 0.43), s: 0.8, t: T });
        lg.restore();
      }
    }
    lg.restore();
    if (!portal) strikeFx(lg, T, c);
  });
  if (!portal) {
    // B11 157.17：全片唯一一次最大冲击（shake 32、flash 1.0 两帧、放射线）
    const hp = toScreen(c, 1, 1240, 560);
    impact(ctx, T, B11, 'MAX', { g, x: hp[0], y: hp[1] });
  }
  return { st, c };
}
