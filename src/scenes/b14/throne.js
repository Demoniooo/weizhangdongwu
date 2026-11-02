// b14 私有：王座厅（节日金）。E05 号声 / E06 卷轴三行勇者名 / E07 红叉章 / E08 龙名纸卷铺到王座把国王卷晕。
import { PAL, sparkle, rgba, cut, blob, poly, shade } from '../../core/paper.js';
import { clamp, lerp, seg, hit, wobble, TAU } from '../../core/util.js';
import { ez, glide, outBack, outCubic, inOutSine, inQuad } from '../../core/ease.js';
import { applyCam, drift, toScreen } from '../../core/camera.js';
import { NAMES } from '../../cues.js';
import { NAME_TIMES, paperGlyph } from '../../ui/type.js';
import { drawThroneRoom, throneLayer, roseCam, THRONE } from '../../env/throne.js';
import { drawScroll } from '../../props/paper.js';
import { drawKing, drawKingCrown } from '../../rigs/king.js';
import { drawCrown } from '../../props/royal.js';
import { drawHero } from '../../rigs/hero.js';
import { drawPrincess } from '../../rigs/princess.js';
import { drawHerald, drawCitizen, drawGuard } from '../../rigs/folk.js';
import { drawLizard } from '../../rigs/dragon.js';
import { E05, E06, E07, E08, T_OUT, POS, STRIP_Y, TC, mixCam, withDrift } from './common.js';
import { castleCam, windowScreen } from './castle.js';

const LIGHT = 'festive';
const ROOM = { light: LIGHT, garland: true, confettiFloor: 0.3, beams: 1 };

// —— 名字时刻 ——
const T6 = [NAME_TIMES('E06a'), NAME_TIMES('E06b'), NAME_TIMES('E06c')];
const T8a = NAME_TIMES('E08a'), T8b = NAME_TIMES('E08b');
const ROWS = NAMES.heroParts;
const DRAGON = [...NAMES.dragon];

// —— 关键时刻 ——
export const T_ROSE = E05 + 0.17; // 169.00 圆形盖满全屏，开始拉出
const T_WIDE = E05 + 0.97; // 169.80 拉到全景
const T_POP = E06; // 169.74 卷轴弹开
const T_FLOOR = E07 - 0.45; // 172.60 卷轴下端着地，开始向右滚
const T_STAMP = E07; // 173.05 红叉章
const T_GASP = E07 + 0.25; // 173.30 国王倒吸凉气
const T_HIDE = E07 + 0.45; // 173.50 小蜥蜴缩进围巾
const T_PEEK = E08 + 1.78; // 175.60 小蜥蜴探出头
const T_STEPS = [E08 + 1.98, E08 + 2.18, E08 + 2.38]; // 175.80 / 176.00 / 176.20 连弹三级台阶
const T_FAINT = E08 + 2.44; // 176.26 晕倒翘腿
const T_WRAP = E08 + 2.58; // 176.40 纸卷裹住
const T_CROWN = E08 + 2.63; // 176.45 王冠飞出
const T_RISE = E08 + 2.68; // 176.50 机位升向玫瑰窗

// —— 机位 ——
const ROSE_END = roseCam(960, 540, 1150, 1);
const roseOf = (c, flat) => { const d = 0.55 + 0.45 * flat, z = 1 + (c.zoom - 1) * d; const [x, y] = toScreen(c, d, THRONE.rose.x, THRONE.rose.y); return [x, y, THRONE.rose.r * z]; };
const WIDE_ROSE = roseOf(TC.wide, 0);
function matchRose(T) { return windowScreen(castleCam(T)); }
/** 王座厅机位与 flat（视差冻结）。 */
export function throneCam(T) {
  if (T < T_ROSE) { const [x, y, r] = matchRose(T); return { c: roseCam(x, y, r, 1), flat: 1 }; }
  const d = drift(T, { amp: 5, speed: 0.35, seed: 143 });
  if (T < T_WIDE) {
    // 拉出：玫瑰窗在屏幕上从正中缩回 TR-W 里的位置（半径按比例插值），flat 1→0，反解机位
    const k = ez(T, T_ROSE, T_WIDE, outCubic), kf = ez(T, T_ROSE, T_WIDE, inOutSine);
    const [x0, y0, r0] = matchRose(T_ROSE), [x1, y1, r1] = WIDE_ROSE;
    const c = roseCam(lerp(x0, x1, k), lerp(y0, y1, k), r0 * Math.pow(r1 / r0, k), 1 - kf);
    return { c: withDrift(c, [d[0] * k, d[1] * k]), flat: 1 - kf };
  }
  let c = TC.wide;
  c = mixCam(c, TC.herald, ez(T, T_WIDE, E06 + 0.86, glide));
  c = mixCam(c, TC.doodle, ez(T, T_FLOOR, T_STAMP + 0.05, glide));
  c = mixCam(c, TC.scroll, ez(T, E08 - 0.1, T_STEPS[0] - 0.2, glide));
  c = mixCam(c, TC.king, ez(T, T_STEPS[0] - 0.2, T_RISE, glide));
  const k = ez(T, T_RISE, T_OUT, glide);
  c = withDrift(c, [d[0] * (1 - k), d[1] * (1 - k)]);
  if (k > 0) c = mixCam(c, ROSE_END, k);
  return { c, flat: k };
}

// —— 竖卷轴（传令官举在胸前，头从卷轴上沿探出来念）——
const SCROLL_W = 232;
const SCROLL_DX = 31; // 卷轴中心相对传令官脚底的 x
const ROW_Y = [34, 82, 130];
/** 竖卷轴纸长：一行一行往下长（卷轴越念越长）。 */
function scrollLen(T) {
  if (T < T_POP) return 0;
  const steps = [[T_POP, 0, 64], [T6[1][0] - 0.12, 64, 112], [T6[2][0] - 0.12, 112, 158]];
  let L = 0;
  for (const [t0, a, b] of steps) if (T >= t0) L = lerp(a, b, outBack(clamp((T - t0) / 0.2), 1.6));
  return L;
}
const rowP = (T, i) => T6[i].reduce((s, t0) => s + clamp((T - t0) / 0.13), 0) / T6[i].length;

// —— 地上纸卷：纸卷在前面滚，传令官念到哪个字，金字就写到哪 ——
const X0 = POS.herald[0] + SCROLL_DX; // 地上纸卷起点（藏在竖卷轴底端后面，从卷轴右缘露出来）
const DOODLE_AT = 176, CROSS_AT = DOODLE_AT + 26;
const PITCH = 48;
const CHAR_AT = [...T8a.map((_, i) => 268 + PITCH * i), ...T8b.map((_, i) => 268 + PITCH * 8 + 16 + PITCH * i)];
const CHAR_T = [...T8a, ...T8b];
const STRIP_END = CHAR_AT[12] + 44; // 纸卷在地上走到这里（王座正下方）开始爬台阶
const STEP_X = X0 + STRIP_END;
function rollS(T) {
  if (T < T_FLOOR) return 0;
  const a = lerp(0, CROSS_AT + 70, ez(T, T_FLOOR, T_STAMP - 0.08, outCubic)); // 先唰地滚出涂鸦
  const b = lerp(CROSS_AT + 70, STRIP_END, ez(T, T_STAMP + 0.12, T_STEPS[0] - 0.12, inOutSine));
  return T < T_STAMP + 0.12 ? a : b;
}
/** 爬台阶段：纸卷中心（main 层）。三下弹跳落在三级台阶上，再滚到国王脚边。 */
function climbPos(T) {
  const ys = [STRIP_Y - 12, 838, 808, 778], xs = [STEP_X, STEP_X + 6, STEP_X + 12, STEP_X + 18];
  let x = xs[0], y = ys[0];
  for (let i = 0; i < 3; i++) {
    const t0 = T_STEPS[i] - 0.14, k = clamp((T - t0) / 0.14);
    if (T >= t0) { x = lerp(xs[i], xs[i + 1], k); y = lerp(ys[i], ys[i + 1], k) - 46 * Math.sin(Math.PI * k); }
  }
  return [x + 28 * ez(T, T_STEPS[2] + 0.03, T_WRAP, inQuad), y];
}
/** 地上纸卷 + 涂鸦 + 红叉章 + 写出来的龙名 + 爬台阶。 */
function drawFloorScroll(g, T) {
  if (T < T_FLOOR - 0.02) return;
  const s = rollS(T);
  const climbing = T >= T_STEPS[0] - 0.14;
  const stamp = clamp((T - (T_STAMP - 0.07)) / 0.1);
  drawScroll(g, {
    x: X0, y: STRIP_Y, orient: 'h', len: Math.max(2, s), width: 62, rollR: 22, handle: false, roll: !climbing, notes: 0.7, t: T, seed: 147,
    items: [{ kind: 'doodle', at: DOODLE_AT, y: 2, size: 0.52 }, { kind: 'cross', at: CROSS_AT, y: -2, size: 66, p: stamp }],
  });
  // 红叉章砸下：墨点四溅
  if (T >= T_STAMP && T < T_STAMP + 0.5) {
    const k = seg(T, T_STAMP, T_STAMP + 0.4);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.4, r = 34 + 46 * outCubic(k);
      g.fillStyle = rgba(PAL.red, 0.85 * (1 - k));
      g.beginPath(); g.arc(X0 + CROSS_AT + Math.cos(a) * r, STRIP_Y + Math.sin(a) * r * 0.45, 4 - 2 * k, 0, TAU); g.fill();
    }
  }
  // 龙名：传令官念一个字，纸上写出一个金字（逐字时刻 = NAME_TIMES）
  CHAR_AT.forEach((at, i) => {
    const q = clamp((T - CHAR_T[i]) / 0.12);
    if (q <= 0 || at > s + 10) return;
    const pop = 1 + 0.2 * hit(T, CHAR_T[i] + 0.12, 0.09);
    writeGlyph(g, DRAGON[i], X0 + at, STRIP_Y + 1, 46, q, pop);
    const fl = hit(T, CHAR_T[i] + 0.1, 0.12);
    if (fl > 0.05) sparkle(g, X0 + at + 22, STRIP_Y - 24, 13 * fl, { color: PAL.goldLight, alpha: fl });
  });
  // 爬台阶：一截立起的纸 + 纸卷
  if (climbing && T < T_WRAP + 0.04) {
    const [cx, cy] = climbPos(T);
    const band = poly([[STEP_X - 26, STRIP_Y + 30], [STEP_X + 6, STRIP_Y - 30], [cx + 16, cy + 6], [cx - 16, cy + 6], [STEP_X - 30, STRIP_Y - 10]], { seed: 151, amp: 0.8 });
    cut(g, band, PAL.paper, { rim: PAL.white, rimW: 1.5 });
    shade(g, band, PAL.paper2, STEP_X - 30, cy, STEP_X + 20, cy, 0.55, 0);
    drawRoll(g, cx, cy, T);
  }
}
function writeGlyph(g, ch, x, y, size, q, scale) {
  const w = size * 0.95;
  g.save();
  if (q < 1) { g.beginPath(); g.rect(x - w / 2 - 4, y - size, (w + 8) * q, size * 2); g.clip(); }
  paperGlyph(g, ch, x + size * 0.03, y + size * 0.04, size * scale, { family: 'display', fill: PAL.goldDark, edge: null });
  paperGlyph(g, ch, x, y, size * scale, { family: 'display', fill: PAL.gold, edge: PAL.white, edgeW: 0.05 });
  g.restore();
}
/** 竖立的小纸卷（爬台阶时）。 */
function drawRoll(g, x, y, T) {
  const R = 22, H = 66;
  const body = poly([[x - R, y - H / 2], [x + R, y - H / 2], [x + R, y + H / 2], [x - R, y + H / 2]], { seed: 152, amp: 0.6 });
  cut(g, body, PAL.paper, { rim: PAL.white, rimW: 1.5 });
  shade(g, body, PAL.paper2, x - R, y, x + R, y, 0, 0.7);
  g.fillStyle = PAL.red; g.fillRect(x - R, y - H / 2 + 6, R * 2, 4); g.fillRect(x - R, y + H / 2 - 10, R * 2, 4);
  cut(g, blob(x, y - H / 2, R, R * 0.4, { seed: 153 }), PAL.paper2, { stroke: PAL.kraftDark, lw: 1.5 });
  g.strokeStyle = rgba(PAL.kraftDark, 0.7); g.lineWidth = 1.2;
  g.beginPath(); g.ellipse(x, y - H / 2, R * 0.55, R * 0.22, T * 6, 0, TAU); g.stroke();
}

// —— 角色状态 ——
function heraldState(T) {
  if (T < T_POP - 0.14) return { pose: 'blow' };
  if (T < T_POP) return { pose: { from: 'blow', to: 'unrollScroll', k: seg(T, T_POP - 0.14, T_POP) } };
  const reading = (T >= T6[0][0] - 0.05 && T < T6[0][3] + 0.25) || (T >= T6[1][0] - 0.05 && T < T6[1][3] + 0.25) || (T >= T6[2][0] - 0.05 && T < T6[2][4] + 0.25) || (T >= E08 && T < T8b[4] + 0.2);
  const expr = reading ? (Math.sin(T * 28) > -0.2 ? { eyes: 'dot', mouth: 'O' } : { eyes: 'dot', mouth: 'o' }) : T >= T_GASP && T < E08 ? 'shock' : 'proud';
  return { pose: 'unrollScroll', expr };
}
function kingState(T) {
  const o = { x: POS.kingSit[0], y: POS.kingSit[1], s: 1, face: -1, t: T, festive: true, seated: true };
  if (T < E05 + 0.4) return { ...o, pose: 'sit', expr: 'smile', crown: { tilt: 6 } };
  if (T < T6[0][0] + 0.2) {
    const k = ez(T, E05 + 0.4, E05 + 0.6, outBack);
    return { ...o, pose: { from: 'sit', to: 'cupEar', k }, expr: 'squint', earScale: lerp(1, 1.3, k), crown: { tilt: 6 + 9 * k } };
  }
  if (T < T_STAMP) {
    // 每念完一行点一次头（越听越高兴）
    const nods = T6.map((ts) => ts[ts.length - 1] + 0.18);
    const nod = nods.reduce((a, t0) => a + Math.max(0, Math.sin(Math.PI * clamp((T - t0) / 0.34))), 0);
    const k = 1 - ez(T, T6[0][0] + 0.2, T6[0][0] + 0.5, outCubic);
    return { ...o, pose: { from: 'sit', to: 'cupEar', k }, expr: T < T6[1][0] ? 'smile' : 'joy', earScale: lerp(1, 1.3, k), joints: { head: 18 * nod }, crown: { tilt: 6 + 9 * k - 3 * nod } };
  }
  if (T < E08) {
    const b = clamp((T - T_GASP) / 0.12);
    const pop = T >= T_GASP ? 40 * Math.sin(Math.PI * clamp((T - T_GASP) / 0.36)) : 0;
    return { ...o, pose: T < T_GASP ? 'sit' : { from: 'sit', to: 'gasp', k: b }, expr: T < T_GASP ? 'joy' : 'gasp', crown: { tilt: 6 - 5 * wobble(T, T_GASP + 0.36, 5, 0.25), pop } };
  }
  if (T < T_FAINT) {
    // 龙名越念越长：脸发青、冒汗、眼冒金星
    const k = seg(T, E08, T_FAINT);
    const ex = k < 0.35 ? 'gasp' : k < 0.75 ? 'sick' : 'dizzy';
    return { ...o, pose: { from: 'gasp', to: 'sit', k: Math.min(1, k * 3) }, expr: ex, green: 0.8 * k, sweat: k, stars: seg(k, 0.6, 1), joints: { head: 6 * Math.sin(T * 7) * k }, crown: { tilt: 6 + 7 * Math.sin(T * 8) * k } };
  }
  const f = ez(T, T_FAINT, T_FAINT + 0.12, outBack);
  return { ...o, pose: { from: 'sit', to: 'faint', k: f }, legsUp: ez(T, T_FAINT + 0.02, T_FAINT + 0.14, outBack), expr: 'faint', stars: 1, green: 0.5, wrapped: ez(T, T_WRAP, T_WRAP + 0.14, outCubic), crown: { off: true } };
}
function drawKingAll(g, T) {
  const ko = kingState(T);
  const a = drawKing(g, ko);
  if (!ko.crown || !ko.crown.off) return;
  // 王冠：晕倒时先留在头上，176.45 弹起飞出画面上沿
  if (T < T_CROWN) { drawKingCrown(g, { ...ko, crown: {} }); return; }
  const u = T - T_CROWN;
  drawCrown(g, { x: a.crownBase[0] - 300 * u, y: a.crownBase[1] - 2700 * u + 800 * u * u, s: a.crownS, rot: a.crownRot - 8 * u, spin: T * 9, F: 1, t: T, glint: 0.8 });
}

function drawCourt(g, T, c, flat) {
  // 朝臣（depth 0.78，站在大厅中间靠后）：念名字时鼓掌，看见龙画像后退，国王晕倒掉下巴
  g.save();
  applyCam(g, c, lerp(0.78, 1, flat));
  [[1105, 2, 1], [1215, 9, -1]].forEach(([x, v, f], i) => {
    let pose = 'idle', expr;
    if (T >= T6[0][0] + 0.3 + 0.05 * i && T < T_STAMP) pose = 'clap';
    if (T >= T_STAMP) pose = { from: 'clap', to: 'stepBack', k: clamp((T - T_STAMP - 0.05 * i) / 0.2) };
    if (T >= E08 + 0.6) { pose = 'lean'; expr = 'curious'; }
    if (T >= T_FAINT + 0.04 * i) { pose = 'jawDrop'; expr = undefined; }
    drawCitizen(g, { x, y: 866, s: 0.8, t: T, variant: v, courtier: true, face: f, pose, expr, phase: i * 0.3, seed: 60 + i });
  });
  g.restore();
}

function drawCast(g, T, c, flat) {
  drawCourt(g, T, c, flat);
  g.save();
  applyCam(g, c, 1);
  drawGuard(g, { x: 1856, y: 790, s: 1, t: T, face: -1, pose: T >= T_FAINT ? 'jawDrop' : T >= T_GASP ? 'stepBack' : 'attention', variant: 1 });
  drawKingAll(g, T);
  // 勇者：念到自己名字时叉腰得意，看见龙画像咧嘴，龙名越念越长开始冒汗
  const named = T >= T6[0][0];
  const hero = drawHero(g, {
    x: POS.hero[0], y: POS.hero[1], s: 1, face: 1, t: T,
    pose: !named ? 'idle' : T < T_STAMP ? { from: 'idle', to: 'proud', k: ez(T, T6[0][0], T6[0][0] + 0.25, outBack) } : 'idle',
    expr: !named ? 'normal' : T < T_STAMP ? 'smug' : T < E08 ? 'grin' : 'worried',
    blush: named && T < T_STAMP ? 0.6 : 0, ahogeAt: T6[2][0] + 0.02, sweat: T >= E08 + 1 ? 0.6 : 0,
    injury: { bandages: 1 }, scarf: { notch: true, hole: true, len: 230, wind: [-420, -230], ground: 1e5 },
  });
  // 公主：看着勇者，眼里冒心；龙画像时得意；国王快晕时吃惊
  drawPrincess(g, {
    x: POS.princess[0], y: POS.princess[1], s: 1, face: 1, t: T, tiara: false,
    pose: 'idle', expr: T < T_STAMP ? (named ? 'loving' : 'smile') : T < E08 ? 'smug' : 'shock', look: T < T_STAMP && named ? [-0.6, 0] : [0.6, 0],
  });
  // 小蜥蜴：蹲在勇者肩头（朝右）；173.50 认出画像缩进围巾，175.60 又探出头
  const hidden = T >= T_HIDE && T < T_PEEK;
  if (!hidden) drawLizard(g, { pose: 'ride', x: hero.neck[0] - 18, y: hero.neck[1] + 2, s: 1, face: 1, t: T, eyes: T >= T_STAMP && T < T_HIDE ? { state: 'normal', open: 1.25 } : undefined, joints: { head: T >= T_STAMP && T < T_HIDE ? 16 : 0 } });
  else drawLizard(g, { pose: 'hideScarf', x: hero.neck[0] - 6, y: hero.neck[1] - 4, s: 1, face: 1, t: T });
  // 传令官 + 竖卷轴
  const ha = drawHerald(g, { x: POS.herald[0], y: POS.herald[1], s: 1, face: 1, t: T, ...heraldState(T), scrollLen: 0 });
  drawFloorScroll(g, T);
  if (T >= T_POP - 0.02 && ha.scrollTop) {
    drawScroll(g, {
      x: POS.herald[0] + SCROLL_DX, y: ha.scrollTop[1], orient: 'v', len: scrollLen(T), width: SCROLL_W, rollR: 15, notes: 1, t: T, seed: 146, roll: T < T_FLOOR,
      rows: ROWS.map((chars, i) => ({ chars, p: rowP(T, i), size: 44, y: ROW_Y[i] })),
    });
  }
  g.restore();
  return { herald: ha, hero };
}

/** 整帧王座厅（自己铺满背景）。o.roseOnly：只画后墙 + 光（圆窗推入的遮罩里用）。 */
export function drawThronePicture(g, T, ctx, o = {}) {
  const { c, flat } = throneCam(T);
  const room = { ...ROOM, flat, rose: { face: 'in' } };
  if (o.roseOnly) {
    ctx.layer(g, throneLayer('back', LIGHT), (lg) => drawThroneRoom(lg, T, c, { ...room, layer: 'back' }));
    drawThroneRoom(g, T, c, { ...room, layer: 'glow' });
    return { c, flat };
  }
  for (const L of ['back', 'mid', 'main']) ctx.layer(g, throneLayer(L, LIGHT), (lg) => drawThroneRoom(lg, T, c, { ...room, layer: L }));
  let cast;
  ctx.layer(g, { shadow: 10, texture: 0.28 }, (lg) => { cast = drawCast(lg, T, c, flat); });
  drawThroneRoom(g, T, c, { ...room, layer: 'glow' });
  ctx.layer(g, throneLayer('fg', LIGHT), (lg) => drawThroneRoom(lg, T, c, { ...room, layer: 'fg' }));
  return { c, flat, cast };
}
/** 传令官号口的屏幕坐标（声波 / 气泡对位用，不画）。 */
export function heraldBellScreen(g, T) {
  const { c } = throneCam(T);
  const ha = drawHerald(g, { x: POS.herald[0], y: POS.herald[1], s: 1, face: 1, t: T, pose: 'blow', alpha: 0 });
  return toScreen(c, 1, ha.bell[0], ha.bell[1]);
}
