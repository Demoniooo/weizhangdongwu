// b10 勇者表演轨：按时间给出 drawHero 参数（姿势关键帧之间用 {from,to,k} 插值，表情先于动作 2–4 帧）。
import { clamp, lerp, seg, wobble } from '../../core/util.js';
import { ez, outBack, outCubic, inOutSine, glide } from '../../core/ease.js';
import { groundAt } from '../../env/cave.js';
import { C, T_LOW } from './common.js';
import { passTime, SONG_T, SONG_POOF } from './fireletters.js';
import { SEAM_T, seamParams, land } from './seam.js';

export const HERO_X = 420;

// 关键帧：{ t（开始过渡）, d（过渡时长）, pose, act?, expr?, dy?（腾空高度，世界 px 向上为正）, turn?, ease? }
const K = [];
const key = (t, d, pose, o = {}) => K.push({ t, d, pose, ...o });
// —— Q1：拢耳（与 K1 国王镜像）——
key(C('Q1') - 0.15, 0.01, 'idle', { expr: 'normal' });
key(C('Q1') - 0.06, 0.06, 'idle', { expr: 'squint', jl: -6 });          // 预备：先往后一缩
key(C('Q1'), 0.12, 'cupEar', { expr: 'squint', ease: 'back' });          // 重音：探身拢耳
// —— D2a：火焰字连珠炮，左躲右闪 ——
key(passTime(0) - 0.1, 0.07, 'freeze', { expr: 'shock' });               // 第一个字从头顶擦过
key(passTime(1) - 0.09, 0.07, 'duck');                                    // 110.0x 低头
key(passTime(1) + 0.12, 0.07, 'freeze', { expr: 'shock' });
key(passTime(2) - 0.1, 0.06, 'hop', { act: 0.5, dy: 95, ease: 'out' });  // 跳起
key(passTime(2) + 0.1, 0.07, 'freeze', { expr: 'shock' });
key(passTime(3) - 0.09, 0.07, 'limbo');                                   // 后仰下腰
key(passTime(3) + 0.1, 0.07, 'freeze', { expr: 'shock' });
key(passTime(4) - 0.09, 0.06, 'sidestep');                                // 侧身收腹
key(passTime(4) + 0.1, 0.07, 'freeze', { expr: 'shock' });
key(passTime(5) - 0.08, 0.06, 'duck');
key(passTime(5) + 0.09, 0.06, 'freeze', { expr: 'shock' });
key(passTime(6) - 0.1, 0.08, 'sidestep', { turn: 0.5 });                  // 转身：侧成一条线让过去
key(passTime(6) + 0.08, 0.08, 'freeze', { expr: 'shock' });
key(passTime(7) - 0.1, 0.06, 'hop', { act: 0.5, dy: 90, ease: 'out' });
key(passTime(7) + 0.1, 0.07, 'freeze', { expr: 'worried' });
// —— D2b：越来越大，越躲越吃力 ——
key(passTime(8) - 0.1, 0.07, 'duck', { expr: 'worried' });
key(passTime(8) + 0.12, 0.08, 'freeze', { expr: 'worried' });
key(passTime(9) - 0.11, 0.06, 'hop', { act: 0.5, dy: 80, ease: 'out', expr: 'worried' });
key(passTime(9) + 0.1, 0.08, 'brake', { expr: 'hurt' });                  // 落地踉跄
key(passTime(10) - 0.1, 0.08, 'limbo', { expr: 'worried' });
key(passTime(10) + 0.12, 0.08, 'freeze', { expr: 'worried' });
key(passTime(11) - 0.1, 0.07, 'sidestep', { expr: 'worried' });
key(passTime(11) + 0.1, 0.06, 'freeze', { expr: 'shock' });               // 抬头看见「松」拐弯
key(SONG_T, 0.05, 'freeze', { expr: 'shock' });
key(SONG_POOF + 0.03, 0.12, 'idle', { expr: 'normal' });                  // 噗：黑脸、眨白眼
// —— Q2：竖一根手指（与 K2 镜像）——
key(C('Q2') - 0.02, 0.12, 'fingerUp', { expr: 'smug', ease: 'back' });
// —— 听岔：像魔术师一样变出五件东西 ——
const ITEM_T = [C('M1'), C('M1') + 0.69, C('M2'), C('M2') + 0.5, C('M3')];
export { ITEM_T };
ITEM_T.forEach((t0, j) => {
  key(t0 - 0.24, 0.1, 'fingerUp', { expr: 'smug' });                     // 举手：变！
  if (j < 4) key(t0, 0.1, 'present', { expr: 'grin', ease: 'back' });     // 张臂一指
});
key(C('M3'), 0.09, 'present', { expr: 'grin', ease: 'back' });
key(C('M3') + 0.16, 0.16, 'bow', { expr: 'relieved' });                    // 传说级：深鞠躬
key(C('M3') + 0.62, 0.14, 'present', { expr: 'smug' });                   // 起身得意
// —— R1：笑僵在脸上 ——
key(C('R1') - 0.02, 0.06, 'freeze', { expr: 'grin' });
key(C('R1') + 0.42, 0.08, 'freeze', { expr: 'shock' });
// —— D3：退到墙左、抬臂挡脸 ——
key(T_LOW - 0.01, 0.01, 'shieldFace', { expr: 'hurt' });
K.sort((a, b) => a.t - b.t);

const easeOf = (k, e) => (e === 'back' ? outBack(k, 2.2) : e === 'out' ? outCubic(k) : inOutSine(k));
const poseOf = (k) => (k.act !== undefined ? { name: k.pose, act: k.act } : { name: k.pose });

/** 某时刻的姿势状态：{ pose（可插值）, act, expr, dy, turn, jl }。 */
export function heroTrack(T) {
  let i = -1;
  for (let j = 0; j < K.length; j++) if (K[j].t <= T) i = j;
  if (i < 0) i = 0;
  const cur = K[i], prev = K[Math.max(0, i - 1)];
  const k = clamp((T - cur.t) / cur.d);
  const e = easeOf(k, cur.ease);
  const pa = poseOf(prev), pb = poseOf(cur);
  const pose = k >= 1 || pa.name === pb.name ? pb.name : { from: pa.name, to: pb.name, k: clamp(e, 0, 1.2) };
  const act = pb.act ?? pa.act;
  // 表情先于动作：过渡开始即换
  const expr = cur.expr || prev.expr;
  const dy = lerp(prev.dy || 0, cur.dy || 0, e);
  const turn = lerp(prev.turn || 0, cur.turn || 0, clamp(e));
  const jl = lerp(prev.jl || 0, cur.jl || 0, clamp(e));
  return { pose, act, expr, dy, turn, jl };
}

// 跳起的抛物线：hop 关键帧持续约 0.2s，dy 在中段最高
function hopLift(T) {
  let lift = 0;
  for (const k of K) {
    if (k.pose !== 'hop') continue;
    const a = (T - k.t) / 0.2;
    if (a > 0 && a < 1) lift = Math.max(lift, k.dy * Math.sin(a * Math.PI));
  }
  return lift;
}

/** 旅途留下的伤痕与围巾状态（与接缝合同同一组值，全块一致）。 */
const HERO_SEAM = seamParams('hero', SEAM_T);
const KEEP = { chip: HERO_SEAM.chip, injury: HERO_SEAM.injury, sword: HERO_SEAM.sword };
const SCARF = HERO_SEAM.scarf;

/** drawHero 的完整参数（世界坐标 depth 1）。 */
export function heroParams(T) {
  const tr = heroTrack(T);
  const inD3 = T >= T_LOW;
  const x = inD3 ? HERO_SEAM.x : HERO_X;
  const gy = groundAt(x);
  const lift = hopLift(T);
  const hit = SONG_T;
  const candle = T >= hit;
  const flameOut = C('R1') + 0.4;             // 117.43 小火苗被风吹灭
  const flame = candle ? clamp(outBack(clamp((T - hit) / 0.12), 2)) * (1 - seg(T, flameOut, flameOut + 0.08)) : 0;
  const soot = inD3 ? HERO_SEAM.soot : seg(T, SONG_POOF, SONG_POOF + 0.05) * 0.86;
  const earScale = 1 + 0.3 * clamp(outBack(seg(T, C('Q1') + 0.35, C('Q1') + 0.47), 2.6), 0, 1.25);
  const ear = T < C('D2a') + 0.1 ? earScale : 1;
  const squash = hit <= T && T < hit + 0.4 ? -0.12 * wobble(T, hit, 5, 0.12) : 0;
  const trem = inD3 ? Math.sin(T * 47) * 1.4 * (1 - seg(T, SEAM_T - 0.2, SEAM_T - 0.06)) : 0;
  const blink = T > C('Q2') + 0.32 && T < C('Q2') + 0.42 ? Math.sin(seg(T, C('Q2') + 0.32, C('Q2') + 0.42) * Math.PI) : undefined;
  const o = {
    x: x + trem, y: gy - lift, s: 1, face: 1, t: T,
    pose: tr.pose, expr: tr.expr, ...KEEP,
    earScale: ear, soot,
    ahoge: candle ? 'candle' : 'normal', flame,
    scarf: inD3 ? SCARF : { ...SCARF, vel: [0, 0] },
  };
  if (tr.act !== undefined) o.act = tr.act;
  if (tr.turn) o.turn = tr.turn;
  if (squash) o.squash = squash;
  if (tr.jl) o.jointsAdd = { lean: tr.jl };
  if (!inD3) o.ahogeAt = candle ? hit : passTime(0);
  if (blink !== undefined) o.blink = blink;
  if (T > passTime(8) && T < SONG_T) o.sweat = 0.8;
  if (inD3) {
    // 接近接缝：逐项落到合同状态（120.97 之前 0.03s 完全一致）
    const k = seg(T, SEAM_T - 0.16, SEAM_T - 0.03);
    return k > 0 ? land(o, seamParams('hero', T), k) : o;
  }
  return o;
}

export { ez, glide };
