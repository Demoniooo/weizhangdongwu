// b08 私有：旅途骑手（白马 + 勇者 + 缰绳）及挂在他们身上的东西（积雪帽、白气、下马、步行进洞的剪影）。
// 位置 / 动作 / 伤痕 / 围巾破损一律取 journey.heroJourneyState(T)；本文件只补“表演”（张望、拔剑、喷嚏进度、风、急刹惯性）。
// 画在 main 图层里、applyCam(lg, c, 1) 之后（世界坐标）。纯函数。
import { PAL, blob } from '../../core/paper.js';
import { clamp, lerp, seg, smoothstep, wobble, rgba, mixHex, hash2, TAU } from '../../core/util.js';
import { inOutSine, outCubic, inOutCubic } from '../../core/ease.js';
import { cue } from '../../cues.js';
import { heroJourneyState, journeyGroundY, JOURNEY } from '../../env/journey.js';
import { drawHorse, horseRig, drawReins } from '../../rigs/horse.js';
import { drawHero, heroRig, HERO_SEAT, HERO_STRIDE } from '../../rigs/hero.js';
import { journeyRiderParams } from '../_seams.js';

const V09 = cue('V09'), V10 = cue('V10'), V11 = cue('V11'), V12 = cue('V12'), V13 = cue('V13');
const EV = JOURNEY.events;
const OPEN = EV.containers; // 92.00 … 93.40
const SNEEZE = EV.sneeze; // 95.20
const [DIS0, DIS1] = EV.dismount; // 98.30 / 98.55
export const T_SEAM = V09 - 0.15; // 90.00 接缝
/** 接缝两侧 0.3s 内不加任何块内表演（合同状态），之后才自由发挥。 */
const free = (T) => smoothstep(T_SEAM + 0.3, T_SEAM + 0.55, T);

// ———— 拔剑 / 收剑（V10 用剑尖挑箱）：剑在 91.62–93.78 拿在手里 ————
const DRAW0 = V10 - 0.35, DRAW1 = DRAW0 + 0.3; // 91.62 拔剑一挥 → 91.92
const SHEATH0 = OPEN[4] + 0.2, SHEATH1 = SHEATH0 + 0.22; // 93.60 收剑 → 93.82
export const swordInHand = (T) => T >= DRAW0 + 0.05 && T < SHEATH0 + 0.14;

/** 骑手动作：在 heroJourneyState 的建议上叠块内表演。 */
function riderPose(T, st) {
  let pose = st.pose, act;
  const base = typeof pose === 'string' ? pose : pose.to;
  // 拔剑：ride → rideSlash（act 0 手在脑后 = 背上剑柄处）→ 一记小挥砍 → 回到 ride，剑留在手里
  if (T >= DRAW0 - 0.08 && T < DRAW1 + 0.1 && base === 'ride') {
    if (T < DRAW0) return { pose: { from: 'ride', to: 'rideSlash', k: inOutSine(seg(T, DRAW0 - 0.08, DRAW0)) }, act: 0 };
    if (T < DRAW1) return { pose: 'rideSlash', act: outCubic(seg(T, DRAW0, DRAW1)) };
    return { pose: { from: 'rideSlash', to: 'ride', k: inOutSine(seg(T, DRAW1, DRAW1 + 0.1)) }, act: 1 };
  }
  // 收剑：ride → rideSlash act 0（手回到脑后插剑）→ ride
  if (T >= SHEATH0 && T < SHEATH1 + 0.1) {
    if (T < SHEATH0 + 0.14) return { pose: { from: 'ride', to: 'rideSlash', k: inOutSine(seg(T, SHEATH0, SHEATH0 + 0.14)) }, act: 0 };
    return { pose: { from: 'rideSlash', to: 'ride', k: inOutSine(seg(T, SHEATH0 + 0.14, SHEATH1 + 0.1)) }, act: 0 };
  }
  // 喷嚏：act 0 憋气 → 0.5 后仰到底（95.17）→ 0.62 猛地前喷（95.20）→ 1 松下来
  if (base === 'sneeze' || (typeof pose === 'object' && (pose.from === 'sneeze' || pose.to === 'sneeze'))) {
    const a0 = SNEEZE - 0.18;
    act = T < SNEEZE - 0.03 ? 0.5 * inOutSine(seg(T, a0, SNEEZE - 0.03)) : T < SNEEZE + 0.03 ? lerp(0.5, 0.64, seg(T, SNEEZE - 0.03, SNEEZE + 0.03)) : lerp(0.64, 1, outCubic(seg(T, SNEEZE + 0.03, SNEEZE + 0.18)));
  }
  // 下马：act 跟着 98.30–98.55 走
  if (base === 'dismount') act = inOutCubic(seg(T, DIS0, DIS1));
  return { pose, act };
}

/**
 * 头的朝向 / 表情 / 呆毛等表演（离接缝 0.3s 之后才加）。只返回“要覆盖的字段”，
 * 没有表演时返回 {}，保证接缝附近传给 drawHero 的参数与合同完全一样。
 */
function riderActing(T, st) {
  const f = free(T);
  const out = {};
  let yaw = 1, nod = 0;
  // V09：进村四处张望——先抬头看风车和鸽子（yaw 转向镜头），再看前路
  if (T < V10 - 0.3 && f > 0) {
    const up = smoothstep(V09 + 0.3, V09 + 0.6, T) * (1 - smoothstep(V09 + 1.0, V09 + 1.3, T));
    const cam = smoothstep(V09 + 1.15, V09 + 1.4, T) * (1 - smoothstep(91.45, 91.68, T));
    yaw = 1 - f * (0.75 * up + 1.05 * cam);
    nod = -12 * f * up;
    // 91.05 鸡横穿：低头看一眼
    const ch = smoothstep(EV.chicken + 0.05, EV.chicken + 0.2, T) * (1 - smoothstep(EV.chicken + 0.55, EV.chicken + 0.75, T));
    if (ch > 0) { yaw = lerp(yaw, 0.55, ch); nod = lerp(nod, 16, ch); }
    if (T >= V09 + 0.05) out.ahogeAt = V09 + 0.05;
  }
  // V11：顶风眯眼（喷嚏前 0.2s 交还给动作自带的憋气脸）
  if (T >= V11 + 0.02 && T < SNEEZE - 0.2) out.expr = 'squint';
  // V12：抬头看见月亮（96.00–96.70），神情坚定
  if (T >= V12) {
    const up = smoothstep(V12 + 0.15, V12 + 0.45, T) * (1 - smoothstep(V12 + 0.85, V12 + 1.2, T));
    if (up > 0) { nod = -15 * up; yaw = 1 - 0.35 * up; }
  }
  // V13：急刹吓一跳（呆毛竖弹）→ 下马后冒汗，独自走向洞口
  if (T >= V13) {
    const sw = smoothstep(V13 + 0.6, V13 + 0.9, T) * 0.7;
    if (sw > 0) out.sweat = sw;
    out.ahogeAt = V13 + 0.02;
  }
  if (yaw !== 1) out.yaw = yaw;
  if (nod !== 0) out.jointsAdd = { nod };
  return out;
}

/** 围巾受的风：V11 顶风吹直；V13 急刹时惯性往前甩。 */
function scarfWind(T) {
  const gust = smoothstep(V11 - 0.02, V11 + 0.06, T) * (1 - smoothstep(V12 - 0.2, V12 + 0.15, T));
  const brake = smoothstep(V13 + 0.01, V13 + 0.07, T) * (1 - smoothstep(V13 + 0.2, V13 + 0.42, T));
  return [-560 * gust + 900 * brake, 140 * brake];
}

/** V10 剑在手里时的刃角（弧度，0 = 朝前、正 = 朝下）：平端在马头前方；每次开箱前剑尖先压低、开箱那一下往上一挑。 */
function swordAngleAt(T) {
  if (T < DRAW1 || T >= SHEATH0 + 0.14) return null;
  let a = 0.42;
  for (const at of OPEN) {
    a += 0.22 * smoothstep(at - 0.16, at - 0.04, T) * (1 - smoothstep(at - 0.04, at, T)); // 预备：剑尖压低
    a -= 0.75 * smoothstep(at - 0.03, at + 0.02, T) * (1 - smoothstep(at + 0.06, at + 0.22, T)); // 一挑
  }
  if (T < DRAW1 + 0.1) a = lerp(60 * Math.PI / 180, a, inOutSine(seg(T, DRAW1, DRAW1 + 0.1))); // 接 rideSlash 收势（sw 60°）
  if (T >= SHEATH0) a = lerp(a, -150 * Math.PI / 180, inOutSine(seg(T, SHEATH0, SHEATH0 + 0.14))); // 收剑：剑尖甩到脑后插回鞘
  return a;
}

/** 每帧求一次骑手的全部参数（不画）：以接缝合同的映射 journeyRiderParams 为底，只在需要时叠块内表演字段。 */
export function riderParams(T) {
  const base = journeyRiderParams(T);
  const st = base.st, h = st.horse;
  const hp = typeof h.pose === 'string' ? h.pose : h.pose.to;
  const horse = { ...base.horse };
  if (h.angle) horse.angle = h.angle;
  if (h.limp) horse.limp = h.limp;
  const sno = smoothstep(V11 + 0.3, SNEEZE - 0.05, T) * (1 - smoothstep(SNEEZE + 0.04, SNEEZE + 0.22, T));
  if (sno > 0) horse.snow = sno * 0.9;
  const br = smoothstep(V11 + 0.1, V11 + 0.3, T) * (1 - smoothstep(V12 - 0.1, V12 + 0.2, T));
  if (br > 0) horse.breath = br;
  const tremble = Math.max(smoothstep(EV.rear - 0.02, EV.rear + 0.08, T) * (1 - smoothstep(EV.horseHide[0], EV.horseHide[0] + 0.1, T)), T >= SNEEZE ? 0.6 * Math.exp(-(T - SNEEZE - 0.02) / 0.18) : 0);
  if (tremble > 0.01) horse.tremble = Math.min(1, tremble);
  const sl = smoothstep(1050, 1250, Math.abs(h.speed)) * (T > V12 + 0.5 && T < V13 ? 1 : 0);
  if (sl > 0) horse.speedLines = sl;
  if (hp === 'skid' || (typeof h.pose === 'object' && h.pose.to === 'skid')) horse.at = V13;
  if (T >= EV.rear - 0.05 && T < EV.horseHide[1]) horse.expr = 'scared';
  if (T >= V11 && T < V12) horse.wind = [-480, 0];
  const rp = riderPose(T, st);
  const ac = riderActing(T, st);
  const wind = scarfWind(T);
  const hero = { ...base.hero, scarf: { ...base.hero.scarf }, pose: rp.pose, ...ac };
  if (swordInHand(T)) hero.sword = 'hand';
  const sa = swordAngleAt(T);
  if (sa != null) hero.swordAngle = sa;
  if (rp.act != null) hero.act = rp.act;
  if (wind[0] !== 0 || wind[1] !== 0) hero.scarf.wind = wind;
  return { st, horse, hero };
}

const DIS_BASE = (pose) => (typeof pose === 'string' ? pose : pose.k < 0.5 ? pose.from : pose.to);

/**
 * 画骑手（马 → 勇者 → 缰绳），下马后画步行的勇者。返回 { horse, hero, st, onFoot }（锚点，世界坐标）。
 * o.sil：0..1 被洞口紫光勾成剪影的程度（步行进洞时）。
 */
export function drawRider(lg, T, o = {}) {
  const { st, horse, hero } = riderParams(T);
  const hb = DIS_BASE(hero.pose);
  const onFoot = hb === 'walk';
  const dismounting = hb === 'dismount';
  let ha, ra;
  if (!onFoot && !dismounting) {
    const probe = horseRig(horse);
    const rO = { ...hero, x: probe.saddle[0], y: probe.saddle[1], rot: probe.saddleRot };
    const foot = heroRig(rO).foot;
    ha = drawHorse(lg, { ...horse, stirrupAt: foot });
    ra = drawHero(lg, rO);
    if (ra && ra.handL) drawReins(lg, ha.bit, ra.handL, { s: 1 });
    return { horse: ha, hero: ra, st, onFoot: false };
  }
  ha = drawHorse(lg, horse);
  if (dismounting) {
    // 臀底锚点：从马鞍（人立的马背上）滑下来，落到「站立脚底 − HERO_SEAT」
    const k = inOutCubic(seg(T, DIS0, DIS1));
    const gx = st.x, gy = journeyGroundY(gx) - HERO_SEAT;
    const sx = lerp(ha.saddle[0], gx, k), sy = lerp(ha.saddle[1], gy, k) - 46 * Math.sin(Math.PI * Math.min(1, k * 1.15));
    ra = drawHero(lg, { ...hero, x: sx, y: sy, rot: lerp(ha.saddleRot, 0, k), scarf: { ...hero.scarf, ground: journeyGroundY(gx) } });
    return { horse: ha, hero: ra, st, onFoot: false };
  }
  // 步行：phase = 走过的路程 ÷ HERO_STRIDE（脚不打滑）
  const walkV = Math.max(0, (heroWalkX(T + 0.01) - heroWalkX(T - 0.01)) / 0.02);
  const wo = {
    ...hero, x: st.x, y: st.y, pose: hero.pose, phase: (st.x - 12250) / HERO_STRIDE,
    scarf: { ...hero.scarf, vel: [walkV, 0], ground: st.y },
  };
  const sil = clamp(o.sil ?? 0);
  ra = drawHero(lg, wo);
  if (sil > 0) {
    lg.save(); lg.globalAlpha *= sil;
    drawHero(lg, { ...wo, silhouette: true, keepColor: ['scarf'], silColor: mixHex(PAL.ink, PAL.dragonDeep, 0.35), edge: { color: mixHex(PAL.magic, PAL.white, 0.15), w: 3.2 } });
    lg.restore();
  }
  return { horse: ha, hero: ra, st, onFoot: true };
}
const heroWalkX = (T) => heroJourneyState(T).x;

/** 头肩积雪（heroJourneyState.snowCap 0..1）：画在勇者之后，按 颈→头 的方向贴在头顶。 */
export function drawSnowCap(lg, ra, k) {
  if (!ra || k <= 0.01) return;
  const [hx, hy] = ra.head, [nx, ny] = ra.neck;
  let dx = hx - nx, dy = hy - ny;
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const ang = Math.atan2(dy, dx) + Math.PI / 2;
  const cx = hx + dx * 47, cy = hy + dy * 47;
  const h = 6 + 26 * k, w = 26 + 22 * k;
  lg.save();
  lg.translate(cx, cy); lg.rotate(ang);
  const pile = blob(0, -h * 0.35, w, h * 0.62, { seed: 811, amp: 0.07, freq: 4 });
  const top = blob(-w * 0.18, -h * 0.72, w * 0.55, h * 0.42, { seed: 812, amp: 0.09 });
  lg.save(); lg.translate(2, 3); lg.fillStyle = rgba(PAL.snowShade, 0.9); lg.fill(pile); lg.restore();
  lg.fillStyle = PAL.snow; lg.fill(pile);
  if (k > 0.45) { lg.fillStyle = PAL.white; lg.fill(top); }
  lg.fillStyle = rgba(PAL.snowShade, 0.55); lg.fill(blob(w * 0.28, -h * 0.15, w * 0.45, h * 0.28, { seed: 813, amp: 0.1 }));
  lg.restore();
  // 肩头一小撮
  const sx = nx - 16, sy = ny + 6;
  lg.fillStyle = PAL.snow;
  lg.fill(blob(sx, sy - 4 * k, 12 + 12 * k, 4 + 6 * k, { seed: 814, amp: 0.1 }));
}

/** 顶风段勇者呼出的白气（EV.breath 每 0.5s 一团，被风吹向左后方）。 */
export function drawHeroBreath(lg, T, ra) {
  if (!ra) return;
  for (const b of EV.breath) {
    const age = T - b;
    if (age < 0 || age > 0.75) continue;
    const p = age / 0.75;
    const x = ra.mouth[0] + 14 - 300 * age, y = ra.mouth[1] - 4 - 28 * p;
    const a = 0.85 * (1 - p) * Math.min(1, age * 12);
    lg.save(); lg.globalAlpha *= a;
    for (let i = 0; i < 3; i++) {
      const r = (6 + 16 * p) * (1 - i * 0.2);
      lg.fillStyle = i === 0 ? rgba(PAL.snowShade, 0.7) : PAL.white;
      lg.beginPath(); lg.arc(x - i * 9 * (0.6 + p), y + (i % 2) * 4 + (i === 0 ? 2 : 0), r, 0, TAU); lg.fill();
    }
    lg.restore();
  }
}

/** 测量：给特效用的骑手锚点（不画）。 */
export function riderAnchors(T) {
  const { st, horse, hero } = riderParams(T);
  const hb = DIS_BASE(hero.pose);
  if (hb === 'walk') return { hero: heroRig({ ...hero, x: st.x, y: st.y }), horse: horseRig(horse) };
  const probe = horseRig(horse);
  if (hb === 'dismount') return { hero: heroRig({ ...hero, x: st.x, y: journeyGroundY(st.x) - HERO_SEAT }), horse: probe };
  return { hero: heroRig({ ...hero, x: probe.saddle[0], y: probe.saddle[1], rot: probe.saddleRot }), horse: probe };
}
void hash2; void wobble;
