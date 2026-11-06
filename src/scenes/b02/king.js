// b02 私有：L05 阳台上的国王（硬切后 18.00–20.10）——「！」弹出、看见小皇冠、捡起攥在胸口、望龙山、抱头王冠盖眼、来回慌跑、向下甩镜。
// 纯函数：只由 T 决定。
import { PAL } from '../../core/paper.js';
import { cam, toScreen } from '../../core/camera.js';
import { clamp, lerp, seg, hit, wobble, TAU } from '../../core/util.js';
import { ez, outBack, outCubic, inBack, inOutSine, whip, glide, smooth } from '../../core/ease.js';
import { drawKing } from '../../rigs/king.js';
import { glyphIcon } from '../../ui/kit.js';
import { CASTLE } from '../../env/castle.js';
import { TM, withDrift } from './shared.js';
import { DOT, EX_SIZE } from './dragon.js';
import { TIARA_REST, PS, drawRestingTiara, tiaraState } from './balcony.js';

const FLOOR = CASTLE.balcony.floorY;
const KS = 0.26;
const KX0 = 996;                 // 18.00 刚冲出门、一步还没落稳
const KX1 = 1016;                // 18.15 落脚（伸手正好够到扶手上的小皇冠）
const PACE_L = 950, PACE_R = 1016;
const DOT_WY = 503;              // 「！」圆点的世界 y（王冠尖上方约 15）
export const K_ZOOM = 2.6;
/** CA-BAL-K：以「！」圆点在 18.00 落在屏幕 DOT 反解（storyboard 4.2 / castle.md CA_BAL_K 近似值）。 */
export const CAM_K = cam(KX0 + 1 - (DOT[0] - 960) / K_ZOOM, DOT_WY - (DOT[1] - 540) / K_ZOOM, K_ZOOM);

/** 国王脚底 x。 */
export function kingX(T) {
  if (T < TM.kPace0) return lerp(KX0, KX1, outCubic(seg(T, TM.L05, TM.L05 + 0.15)));
  const a = TM.kPace0, m = TM.kPace0 + 0.33, b = TM.kPace1;
  if (T < m) return lerp(KX1, PACE_L, inOutSine(seg(T, a, m)));
  return lerp(PACE_L, PACE_R, inOutSine(seg(T, m + 0.04, b + 0.02)));
}
const turnAt = TM.kPace0 + 0.33;   // 第一次转身（19.63）

/** 国王参数（drawKing 的 o）。 */
export function kingAt(T) {
  const x = kingX(T);
  const o = { x, y: FLOOR, s: KS, t: T, face: 1, expr: 'panic', crown: {}, holding: null, joints: {}, sweat: 0.8 };
  // 18.00 冲出门：慌跑步态的大跨步定在“一步没落稳”，双手乱挥
  if (T < TM.kSee) {
    const land = seg(T, TM.L05, TM.L05 + 0.15);
    const kIdle = ez(T, TM.L05 + 0.16, TM.kSee, outCubic);
    o.pose = { from: 'pace', to: 'idle', k: kIdle * 0.7 };
    o.t = 0.07 + 0.2 * land + (T - TM.L05) * 0.25;            // 慌跑相位：从跨步定格滑到落脚
    o.squash = -0.14 * hit(T, TM.L05 + 0.15, 0.08) + 0.05 * wobble(T, TM.L05 + 0.2, 6, 0.12);
    o.look = [0.6, -0.2];
    o.crown = { tilt: 4 * wobble(T, TM.L05 + 0.15, 5, 0.2), pop: 6 * hit(T, TM.L05 + 0.15, 0.08) };
    return o;
  }
  // 18.30 看见扶手上的小皇冠（先瞪眼）→ 18.40 伸手 → 18.50 抓起 → 攥在胸口
  if (T < TM.kLook) {
    const reach = ez(T, TM.kSee + 0.06, TM.kGrab, outCubic);
    const pull = ez(T, TM.kGrab, TM.kGrab + 0.16, outBack);
    o.expr = T < TM.kGrab ? 'gasp' : 'tearful';
    o.look = [1, 0.7 - 0.9 * pull];
    if (T < TM.kGrab) {
      o.pose = 'idle';
      o.joints = { head: 14 * smooth(seg(T, TM.kSee - 0.04, TM.kSee + 0.08)), lean: 14 * reach, hR: [lerp(30, 54, reach), lerp(-40, -96, reach)], bendR: -1, handR: 'open', layR: 'front' };
    } else {
      o.pose = 'clutch';
      o.holding = 'tiara';
      o.joints = { head: lerp(14, 6, pull), lean: lerp(14, 4, pull), hL: [6, -100], hR: [20, -102] };
      o.squash = 0.06 * wobble(T, TM.kGrab + 0.1, 4, 0.2);
      o.tiaraGlint = 0.6;
    }
    return o;
  }
  // 18.90 转头望向右边的龙山（踮脚、往右探）
  if (T < TM.kHead) {
    const k = ez(T, TM.kLook - 0.06, TM.kLook + 0.12, outBack);
    o.pose = 'clutch';
    o.holding = 'tiara';
    o.expr = { eyes: 'tear', brows: 'worried', mouth: 'wobble', tears: 1 };
    o.look = [1, -0.5 * k];
    o.joints = { head: lerp(6, -6, k), lean: lerp(4, -3, k), tip: k, hL: [6, -104], hR: [20, -106] };
    o.tiaraGlint = 0.5;
    return o;
  }
  // 19.20 双手抱头、王冠滑下盖住眼睛 → 19.30 抱着头来回慌跑（转身挤压）
  const slip = ez(T, TM.kHead, TM.kHead + 0.2, (u) => outBack(u, 1.6));
  o.pose = 'holdHead';
  o.holding = 'tiara';
  o.crown = { slip, tilt: -6 * slip + 5 * wobble(T, TM.kHead + 0.2, 4, 0.25) };
  o.expr = 'panic';
  if (T >= TM.kPace0) {
    const ph = TAU * (T - TM.kPace0) * 3.6;
    const s1 = Math.sin(ph);
    o.face = T < turnAt + 0.02 ? -1 : 1;
    o.joints = { legL: 30 * s1, legR: -30 * s1, footL: 9 * s1, footR: -9 * s1, lift: 6 * Math.abs(s1), lean: 9 };
    o.squash = -0.2 * Math.exp(-(((T - turnAt - 0.02) / 0.045) ** 2)) - 0.16 * Math.exp(-(((T - TM.kPace0) / 0.045) ** 2));
  } else {
    o.squash = -0.1 * hit(T, TM.kHead + 0.04, 0.1);
  }
  return o;
}

/** 国王机位：CA-BAL-K（18.30 后淡入漂移）→ 18.95–19.35 情绪推近 → 19.95 向下甩（到 20.10 正好甩到一半）。 */
export function kingCam(T) {
  let c = CAM_K;
  const push = ez(T, TM.kLook + 0.05, TM.kHead + 0.15, glide);
  if (push > 0) {
    const z = lerp(K_ZOOM, 2.85, push);
    c = cam(lerp(CAM_K.x, CAM_K.x + 40, push), lerp(CAM_K.y, CAM_K.y + 6, push), z);
  }
  const w = whip(seg(T, TM.whip0, TM.whip0 + 0.3));
  if (w > 0) c = { ...c, y: c.y + (338 / K_ZOOM) * 2.6 * w };
  return withDrift(c, T, smooth(seg(T, TM.L05 + 0.3, TM.L05 + 0.9)), 4.5, 29);
}
/** 甩镜的屏幕速度（px/帧量级），给竖向拖影用。 */
export function whipSpeed(T) {
  const a = seg(T, TM.whip0, TM.whip0 + 0.3);
  if (a <= 0 || a >= 1) return 0;
  const dt = 1 / 30;
  const y0 = whip(seg(T - dt, TM.whip0, TM.whip0 + 0.3)), y1 = whip(a);
  return (y1 - y0) * 338 * 2.8;
}

/** onBalcony：阳台上画国王；小皇冠在 18.50 之前停在扶手上（由 tiaraOnRail 在栏杆前画）。 */
export function drawKingOnBalcony(g, T) {
  return drawKing(g, kingAt(T));
}
/** 扶手上的小皇冠（栏杆前；18.50 被抓走）。 */
export function drawRailTiara(g, T) {
  if (T >= TM.kGrab) return;
  const st = tiaraState(T);
  if (!st) return;
  const shake = T > TM.kSee + 0.1 ? 0.12 * Math.sin(T * 50) * seg(T, TM.kSee + 0.1, TM.kGrab) : 0;   // 手伸过来：小皇冠轻颤
  drawRestingTiara(g, T, { ...st, rot: st.rot + shake });
}

/** 「！」提示牌（屏幕坐标，红色元素层）：18.00 竖杠 0.18s 弹出，圆点正好在 DOT；跟着国王走，18.40 缩回。 */
export function drawAlert(g, T, c) {
  if (T < TM.L05 || T > TM.kSee + 0.24) return null;
  const bar = seg(T, TM.L05, TM.L05 + 0.18);
  const out = ez(T, TM.kSee + 0.08, TM.kSee + 0.22, inBack);
  const [sx, sy] = toScreen(c, 1, kingX(T) + 1, DOT_WY);
  const S = EX_SIZE * (1 - out);
  if (S <= 1) return null;
  const jig = T > TM.L05 + 0.18 ? 0.06 * wobble(T, TM.L05 + 0.18, 5, 0.25) : 0;
  return glyphIcon(g, 'exclaim', sx, sy - 0.34 * S, S, { bar, rot: jig });
}

export { PAL, TIARA_REST, PS };
