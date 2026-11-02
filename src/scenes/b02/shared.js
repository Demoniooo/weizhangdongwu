// b02 私有：时刻表（全部 cue + 偏移）、机位曲线、王城三组图层的统一画法。
// 纯函数：只由 T 决定；不缓存跨帧状态。
import { cue } from '../../cues.js';
import { cam, lerpCam, drift } from '../../core/camera.js';
import { clamp, lerp, seg } from '../../core/util.js';
import { ez, glide, snap, smooth } from '../../core/ease.js';
import { drawCastle, LAYER_GROUPS, CAMS as CA } from '../../env/castle.js';
import { bookCastleCam } from '../../env/book.js';

const L01 = cue('L01'), L02 = cue('L02'), L03 = cue('L03'), L04 = cue('L04'), L05 = cue('L05'), L06 = cue('L06');

/** 本块所有关键时刻（默认秒，全部由 cue + 偏移得到）。 */
export const TM = {
  start: L01 - 0.89,          // 9.50 块起点（与 b01 重叠 0.50s）
  b01End: L01 - 0.39,         // 10.00 b01 结束（遮罩到此为止）
  L01, L02, L03, L04, L05, L06,
  end: L06 + 0.02,            // 20.10 块终点（与 b03 重叠 0.15s）
  // —— 和平 ——
  waterPrep: L01 - 0.19,      // 10.20 低头、抬壶（预备）
  birdLand: L01 + 0.51,       // 10.90 青鸟落在小皇冠上
  pourEnd: L01 + 0.86,        // 11.25 收壶
  turn: L01 + 0.97,           // 11.36 转身朝城下
  wave: L01 + 1.01,           // 11.40 挥手
  // —— 来袭 ——
  shadow0: L02 - 0.16,        // 11.95 龙影起步（12.11 进画）
  shadow1: L02 + 0.61,        // 12.72 龙影尾巴出左边
  doomK1: L02 + 0.59,         // 12.70 整片天变紫红
  look: L02 + 0.24,           // 12.35 公主抬头
  canDrop: L02 + 0.34,        // 12.45 水壶掉落
  camW0: L02 + 0.49, camW1: L02 + 0.94,   // 12.60–13.05 拉到 CA-W
  tear: L02 + 0.99,           // 13.10 纸天撕开
  headOut: L02 + 1.14,        // 13.25 龙头撞出
  roar: L02 + 1.34,           // 13.45 吼
  dive0: L02 + 1.47, dive1: L02 + 2.04,   // 13.58–14.15 前景掠过
  camT0: L02 + 1.49, camT1: L02 + 1.99,   // 13.60–14.10 机位落到 CA-TOWN
  // —— 灾祸 ——
  fire1: L03,                 // 14.18 第一颗火球
  rain0: L03 + 0.12, rain1: L03 + 1.02,   // 14.30–15.20 火雨
  hat: L03 + 0.72,            // 14.90 高帽被掀、躲进木桶
  // —— 掳走 ——
  snap0: L04 - 0.21,          // 15.20 snap 推到 CA-BAL
  cageFall: L04 - 0.11,       // 15.30 鸟笼开始下坠
  slam: L04 + 0.04,           // 15.45 扣下
  tiaraOff: L04 + 0.09,       // 15.50 小皇冠被磕飞
  eyeroll: L04 + 0.39,        // 15.80 抱臂翻白眼
  claw: L04 + 0.54,           // 15.95 龙爪探入
  hook: L04 + 0.64,           // 16.05 勾住笼环
  lift: L04 + 0.69,           // 16.10 提走；小皇冠落地
  pull1: L04 + 1.79,          // 17.20 拉远到位；龙缩成小黑点
  layerSwap: L04 + 1.19,      // 16.60 龙换到远景层
  twinkle: L04 + 2.04,        // 17.45 「叮！」
  gray0: L05 - 1.0,           // 17.00 天从上往下褪成灰蓝
  red0: L05 - 0.25,           // 17.75 小点变红
  // —— 国王 ——
  kSee: L05 + 0.30, kGrab: L05 + 0.50, kLook: L05 + 0.90, kHead: L05 + 1.20,
  kPace0: L05 + 1.30, kPace1: L05 + 1.95,
  beacon4: L05 + 0.40, beacon5: L05 + 0.60,
  whip0: L05 + 1.95,          // 19.95 向下甩镜
};

// ———————————————————— 机位 ————————————————————
/** 和平段：推镜落定 CA-MW 后继续极慢地贴近阳台（看清浇花、青鸟、挥手），12.60 再拉开。 */
export const CAM_MW_IN = cam(958, 556, 1.95);
/** 城下：CA-TOWN 略上抬（storyboard 4.2 预设 cam(960,900,1.8)；屋顶与逃难的人落在画面中下部，字幕带只剩草地与前景）。 */
export const CAM_TOWN = cam(960, 852, 1.85);
/** 鸟笼扣下后贴近笼子（翻白眼看得清）。 */
export const CAM_CAGE = cam(980, 532, 3.05);
/** 远景：拉远并右摇（龙山峰顶落在屏幕约 (1580,430)，红点 (1500,400) 在峰顶左上；城堡占左边三分之二）。 */
export const CAM_FAR = cam(1300, 455, 0.9);

/** 9.50–18.00 的基础机位（不含漂移 / 震动）。 */
export function baseCam(T) {
  if (T < TM.L01) return bookCastleCam(T);                     // 与 b01 同一条推镜（交接逐像素一致）
  const mw = lerpCam(CA.CA_MW, CAM_MW_IN, ez(T, TM.L01 + 0.15, TM.L02 + 0.2, glide));
  if (T < TM.camW0) return mw;
  if (T < TM.camW1) return lerpCam(mw, CA.CA_W, ez(T, TM.camW0, TM.camW1, glide));
  if (T < TM.camT0) return CA.CA_W;
  if (T < TM.camT1) return lerpCam(CA.CA_W, CAM_TOWN, ez(T, TM.camT0, TM.camT1, glide));
  if (T < TM.snap0) return CAM_TOWN;
  if (T < TM.L04) return lerpCam(CAM_TOWN, CA.CA_BAL, ez(T, TM.snap0, TM.L04, snap));
  const bal = lerpCam(CA.CA_BAL, CAM_CAGE, ez(T, TM.slam + 0.02, TM.claw + 0.1, glide));
  if (T < TM.lift) return bal;
  if (T < TM.pull1) return lerpCam(bal, CAM_FAR, ez(T, TM.lift, TM.pull1, glide));
  return CAM_FAR;
}

/** 手持漂移的权重：推镜落定（L01）后淡入；17.45–17.90 收掉（红点 = 「！」圆点要钉在屏幕 (1500,400)）。 */
export function driftK(T) {
  return smooth(seg(T, TM.L01, TM.L01 + 0.8)) * (1 - smooth(seg(T, TM.twinkle, TM.red0 + 0.15)));
}

/** 加漂移（屏幕振幅约 amp px，与 b01 liveCam 同一写法：世界位移 = 屏幕位移 / zoom）。 */
export function withDrift(c, T, k, amp = 5, seed = 23) {
  if (k <= 0) return c;
  const [dx, dy] = drift(T, { amp, speed: 0.35, seed });
  return { ...c, x: c.x + (dx * k) / c.zoom, y: c.y + (dy * k) / c.zoom };
}

/** 9.50–18.00 的实际机位。 */
export const camAt = (T) => withDrift(baseCam(T), T, driftK(T));

// ———————————————————— 王城三组图层 ————————————————————
/**
 * 用 LAYER_GROUPS 三组图层画王城（与 b01 立体件同一分组与参数）。
 * hooks: { [castle 层名]: (lg, depth) => {} } 在该层画完后、同一缓冲里接着画（插角色 / 道具 / 特效）。
 * fx: 叠在每组图层参数上的覆盖（如 { sat: 0.75 }），或 [组0, 组1, 组2] 分别覆盖。
 */
export function drawWorld(g, T, ctx, c, o, hooks = {}, fx = null) {
  LAYER_GROUPS.forEach(([pop, base], gi) => {
    const extra = Array.isArray(fx) ? fx[gi] : fx;
    ctx.layer(g, extra ? { ...base, ...extra } : base, (lg) => {
      for (const layer of pop) {
        const r = drawCastle(lg, T, c, { ...o, layer });
        if (hooks[layer]) hooks[layer](lg, r.depth);
      }
    });
  });
}

export { clamp, lerp };
