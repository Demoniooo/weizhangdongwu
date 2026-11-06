// b06 私有：四张角色卡（63.40–66.40）。片名缩到上方 → 发牌（卡背朝上、错峰 0.12s、±4°）→ 依次翻开 → 收拢洗两次 → 顶牌翻成卡背。
import { NAMES } from '../../cues.js';
import { PAL } from '../../core/paper.js';
import { clamp, lerp, seg, TAU, wobble, pulse } from '../../core/util.js';
import { ez, glide, outBack, outCubic, inOutCubic, inQuad } from '../../core/ease.js';
import { burst } from '../../core/particles.js';
import { characterCard, portraitHead } from '../../ui/kit.js';
import { drawHeroHead } from '../../rigs/hero.js';
import { drawKing } from '../../rigs/king.js';
import { drawCrown } from '../../props/royal.js';
import { sparkDraw } from '../../props/misc.js';
import { TT } from './common.js';
import { drawTitleScene } from './titlepage.js';

const DEG = Math.PI / 180;
export const CARD_X = [480, 800, 1120, 1440];
export const CARD_Y = 640;
const TILT = [-4, 3, -3, 4].map((d) => d * DEG);
const STACK = [2, 0, 3, 1]; // 洗牌后的叠放次序（最后画的在最上面）：顶牌 = 勇者卡（index 0 排在 STACK 末尾之前…见 order）
/** 洗牌后从下到上的卡序：国王、巨龙、公主、勇者（勇者卡在最上，翻成卡背 = 地图封皮）。 */
export const ORDER = [3, 2, 1, 0];

/** 第 i 张卡在 T 时刻的位置、转角、翻面进度。 */
export function cardState(i, T) {
  const t0 = TT.deal0 + i * 0.12;
  const k = seg(T, t0, t0 + 0.42);
  const dealt = { x: CARD_X[i], y: CARD_Y, rot: TILT[i] };
  const from = { x: 960 + (i - 1.5) * 90, y: 1340, rot: TILT[i] * 4 - 0.3 + i * 0.2 };
  let x = lerp(from.x, dealt.x, outCubic(k)), y = lerp(from.y, dealt.y, outBack(k, 1.3)), rot = lerp(from.rot, dealt.rot, outCubic(k));
  // 翻开后小弹一下
  const fl = TT.flips[i];
  const flip = seg(T, fl, fl + 0.22);
  y -= 26 * Math.sin(Math.PI * flip);
  // 65.70 收拢 → 洗两次（左右分开再交错合上）
  const G = TT.gather;
  const gk = ez(T, G, G + 0.14, glide);
  const slot = ORDER.indexOf(i);
  const cx = 960, cy = CARD_Y + 10;
  const stackX = cx + (slot - 1.5) * 3, stackY = cy - slot * 3;
  x = lerp(x, stackX, gk); y = lerp(y, stackY, gk); rot = lerp(rot, (slot - 1.5) * 1.5 * DEG, gk);
  for (const [a, b] of [[G + 0.14, G + 0.27], [G + 0.27, G + 0.40]]) {
    const sk = seg(T, a, b);
    if (sk > 0 && sk < 1) {
      const side = (slot % 2 ? 1 : -1) * (a > G + 0.2 ? -1 : 1);
      x += side * 170 * Math.sin(Math.PI * sk);
      y -= 30 * Math.sin(Math.PI * sk);
      rot += side * 8 * DEG * Math.sin(Math.PI * sk);
    }
  }
  // 顶牌（勇者卡）66.10–66.40 翻成卡背
  let f = flip;
  if (i === ORDER[3]) f = flip - seg(T, TT.topFlip, TT.topFlip + 0.24);
  return { x, y, rot, flip: f, slot, gathered: gk };
}

function heroPortrait(T) {
  return (g, x, y, size) => {
    const wink = pulse(T, TT.flips[0] + 0.42, 0.12) > 0.4;
    drawHeroHead(g, { x, y: y + 4, s: size / 112, t: T, expr: wink ? 'wink' : 'grin', yaw: 0.35, ahogeAt: TT.flips[0] + 0.3 });
  };
}
function dragonPortrait(T) {
  return (g, x, y, size) => {
    const bl = Math.max(0, Math.sin(clamp((T - (TT.flips[2] + 0.4)) / 0.16) * Math.PI));
    portraitHead(g, 'dragon', x, y - 4, size * 0.9, { t: T, silhouette: true, blink: bl });
  };
}
/** 国王卡：鞠躬，王冠 65.55 掉下来（之后由卡外的 drawCrown 接手滚出）。 */
function kingPortrait(T) {
  return (g, x, y, size) => {
    const k = ez(T, TT.flips[3] + 0.12, TT.flips[3] + 0.26, glide);
    const crownOff = T >= CROWN_DROP();
    drawKing(g, { x: x + 6, y: y + size * 0.78, s: 1, face: 1, t: T, pose: { from: 'idle', to: 'bow', k }, expr: k > 0.5 ? 'proud' : 'joy', crown: { off: crownOff, tilt: 14 * k } });
  };
}

const CROWN_DROP = () => TT.flips[3] + 0.22;
/** 王冠离开国王头顶时的屏幕位置（国王卡此刻已翻正：卡心 + 卡面局部 (6,-34) 按卡的转角旋转）。 */
function crownStart() {
  const st = cardState(3, CROWN_DROP());
  const lx = 40, ly = -118, c = Math.cos(st.rot), s = Math.sin(st.rot);
  return [st.x + lx * c - ly * s, st.y + lx * s + ly * c];
}
/** 掉出卡外的王冠：沿卡面掉到卡下沿 → 弹一下 → 滚出卡外停在右下。屏幕坐标。 */
function crownRoll(T, start) {
  const t0 = CROWN_DROP();
  const t1 = t0 + 0.22, t2 = t1 + 0.55;
  const [sx, sy] = start;
  if (T < t1) { const k = seg(T, t0, t1); return { x: lerp(sx, sx + 40, k), y: lerp(sy, 862, inQuad(k)), rot: 0.6 * k, s: 0.7 }; }
  const k = seg(T, t1, t2);
  const x = lerp(sx + 40, 1810, outCubic(k)), y = 862 + 24 * k - 46 * Math.abs(Math.sin(Math.PI * 2 * k)) * (1 - k);
  return { x, y, rot: 0.6 + (x - sx - 40) / 50, s: 0.7 };
}

/** 王冠在 T 时刻的屏幕状态（T ≥ 掉落时刻有效；66.4 后停在右下角）。 */
export const crownAt = (T) => crownRoll(Math.max(T, CROWN_DROP()), crownStart());

/** 卡牌层（屏幕坐标）。返回王冠位置（给地图镜头接着画）。 */
export function drawCards(ctx, g, T, o = {}) {
  const out = {};
  ctx.layer(g, { shadow: 14, texture: 0.3 }, (lg) => {
    const list = [0, 1, 2, 3].map((i) => ({ i, st: cardState(i, T) }));
    // 收拢前按 i 画；收拢后按叠放次序画
    list.sort((a, b) => (a.st.gathered > 0.5 ? a.st.slot - b.st.slot : a.i - b.i));
    for (const { i, st } of list) {
      if (o.skipTop && i === ORDER[3]) continue;
      if (T < TT.deal0 + i * 0.12) continue;
      const base = { x: st.x, y: st.y, rot: st.rot, flip: clamp(st.flip), t: T };
      if (i === 0) characterCard(lg, { ...base, portrait: heroPortrait(T), portraitBg: PAL.skyDayLow, nameStrip: NAMES.hero, extras: { stars: 3 } });
      if (i === 1) characterCard(lg, { ...base, portrait: 'princess', portraitBg: PAL.princessLight, nameStrip: '？？？', extras: { scroll: true, stars: 3 } });
      if (i === 2) characterCard(lg, { ...base, portrait: dragonPortrait(T), portraitBg: PAL.dragonDark, nameStrip: '？？？', extras: { lv: 'LV ??' } });
      if (i === 3) characterCard(lg, { ...base, portrait: kingPortrait(T), portraitBg: PAL.princessLight, nameStrip: '国王', extras: { stars: 3 } });
      // 翻开瞬间的金色火花
      burst(lg, T, { at: TT.flips[i] + 0.13, seed: 120 + i, count: 14, x: CARD_X[i], y: CARD_Y - 60, spread: 110, speed: [120, 380], angle: [0, TAU], gravity: 300, drag: 1.8, life: [0.35, 0.7], size: [9, 16] }, sparkDraw);
    }
    // 王冠滚出卡外
    if (T >= CROWN_DROP()) {
      const cr = crownRoll(T, crownStart());
      out.crown = cr;
      drawCrown(lg, { x: cr.x, y: cr.y, rot: cr.rot, s: cr.s, t: T, F: 1, squash: 0.15 * wobble(T, CROWN_DROP() + 0.22, 4, 0.12) });
    }
  });
  return out;
}

/** 卡牌段整帧。 */
export function drawCardsScene(g, T, ctx) {
  drawTitleScene(g, T, ctx, { shrink: seg(T, TT.shrink0, TT.shrink1) });
  drawCards(ctx, g, T);
}
void STACK; void inOutCubic;
