// b17 · 王座厅夜景（O07 197.77–198.50）：接缝合同 b16|b17 的画面 + 「全名」小签 + 孩子一拽 + 卷轴射向玫瑰窗。
// 接缝时刻 T0 的每一项参数都直接取自 src/scenes/_seams.js 的合同（resolveParams），T > T0 才叠加本块的表演。
import { cue } from '../../cues.js';
import { PAL, glow, sparkle } from '../../core/paper.js';
import { applyCam, lerpCam, toScreen } from '../../core/camera.js';
import { clamp, lerp, seg, smoothstep, rgba, mixHex, wobble } from '../../core/util.js';
import { ez, inOutCubic, outBack, outCubic, outQuad, spring } from '../../core/ease.js';
import { burst } from '../../core/particles.js';
import { drawThroneRoom, roseCam, throneToScreen, THRONE } from '../../env/throne.js';
import { nameTab, glyphIcon, TXT } from '../../ui/kit.js';
import { paperGlyph } from '../../ui/type.js';
import { drawInfiniteScroll } from '../../props/paper.js';
import { sparkDraw, confettiDraw } from '../../props/misc.js';
import { SEAMS, FN, resolveParams, applyParallax, withDrift } from '../_seams.js';

export const SEAM = SEAMS['b16|b17'];
const ITEMS = Object.fromEntries([...SEAM.actors, ...(SEAM.props || []), ...SEAM.ui].map((it) => [it.id, it]));
export const T0 = cue('O07');                    // 197.77 接缝 + 重音：小签垂下
export const T_YANK = T0 + 0.18;                 // 197.95 孩子一拽
export const T_FIRE = T0 + 0.28;                 // 198.05 卷轴射出
export const T_PUSH0 = T0 + 0.31;                // 198.08 机位开始上摇推向玫瑰窗
export const T_ROSE = T0 + 0.63;                 // 198.40 卷头穿过玫瑰窗
export const T_OUT = T0 + 0.73;                  // 198.50 圆窗拉出（下一镜头）
/** 推到玫瑰窗铺满全屏（r = 1150 盖住四角），圆窗拉出从这一帧起步。 */
export const ROSE_FULL = roseCam(960, 540, 1150, 1);

/** 王座厅机位：接缝前后 = 合同机位（TR-NIGHT + 统一漂移）；198.08 起推向玫瑰窗，flat 一起 0→1。 */
export function hallCam(T) {
  const c0 = withDrift(SEAM.cam, T, SEAM.drift);
  const k = ez(T, T_PUSH0, T_OUT, inOutCubic);
  return { c: k > 0 ? lerpCam(c0, ROSE_FULL, k) : c0, k };
}

// 面板（parallax 空间，按 TR-NIGHT 屏幕坐标设计、depth 1.1）→ 屏幕
function panelToScreen(c, x, y) {
  const b = SEAM.ui.find((u) => u.id === 'panel').base, d = 1.1;
  const zc = 1 + (c.zoom - 1) * d, zb = 1 + (b.zoom - 1) * d;
  return [960 + zc * ((x - 960) / zb + (b.x - c.x) * d), 540 + zc * ((y - 540) / zb + (b.y - c.y) * d)];
}
const PANEL_CX = 920, PANEL_BOTTOM = 620;       // 收拢后 3 格面板的下沿中点（PANEL_O06：x 400 + 1040/2）

// ———————————————————— 角色表演（T ≤ T0 时与合同参数完全相同） ————————————————————
function actorParams(id, T, E) {
  const p = resolveParams(ITEMS[id].params, T, E);
  const u = T - T0;
  if (u <= 0) return p;
  const jaw = (t0) => smoothstep(t0, t0 + 0.08, T);           // 下巴掉下来（错峰）
  if (id === 'child') {
    // 197.80 看见小签（眼睛先动）→ 197.84 抬手预备 → 197.95 一拽（yank p 0.5→0.8）→ 198.05 被射出的卷轴吓到
    const reach = smoothstep(T0 + 0.07, T0 + 0.16, T);
    const pull = seg(T, T_YANK, T_YANK + 0.12);
    const yp = 0.3 + 0.2 * reach + 0.5 * pull;
    p.pose = reach > 0 ? { from: 'stand', to: 'yank', k: reach } : 'stand';
    if (reach > 0) p.p = yp;
    p.expr = T < T0 + 0.03 ? 'laugh' : T < T_FIRE + 0.03 ? (pull > 0.3 ? 'determined' : 'curious') : 'jawdrop';
    p.joints = { lookY: -0.9 * smoothstep(T0 + 0.02, T0 + 0.08, T), look: -0.2, jaw: 0.8 * jaw(T_FIRE + 0.02), sq: -0.05 * Math.sin(Math.PI * seg(T, T0 + 0.12, T_YANK)) };
    p.squash = 0.06 * Math.sin(Math.PI * seg(T, T_YANK, T_YANK + 0.14));
  } else if (id === 'hero') {
    const k = jaw(T_FIRE + 0.03);
    p.pose = { from: 'deflate', to: 'idle', k: outBack(clamp(k), 2) };
    p.expr = T < T_FIRE + 0.01 ? (T < T0 + 0.1 ? 'relieved' : 'normal') : 'shock';
    p.jointsAdd = { lean: -6 * k };
    p.yaw = 0.6;
    p.ahoge = k > 0.2 ? 'straight' : 'normal';
  } else if (id === 'princess') {
    const k = jaw(T_FIRE + 0.07);
    p.pose = { from: 'deflate', to: 'idle', k: outBack(clamp(k), 2) };
    p.expr = T < T_FIRE + 0.05 ? (T < T0 + 0.14 ? 'relieved' : 'smile') : 'shock';
    p.look = [0.3, -0.8];
  } else if (id === 'king') {
    const k = jaw(T_FIRE + 0.1);
    p.pose = k > 0 ? { from: 'slump', to: 'gasp', k } : 'slump';
    p.seated = true;
    p.expr = T < T_FIRE + 0.08 ? 'relieved' : 'gasp';
    p.crown = { ...(p.crown || {}), pop: 14 * Math.max(0, wobble(T, T_FIRE + 0.12, 3, 0.18)) };   // 王冠保持合同的端正（tilt 0），只被吓得弹一下
  } else if (id === 'scribe') {
    const k = jaw(T_FIRE + 0.05);
    p.pose = k > 0 ? { from: 'deflate', to: 'jawDrop', k } : 'deflate';
  } else if (id === 'lizard') {
    // 趴平 → 198.05 弹起来坐直、眼睛瞪圆
    const k = smoothstep(T_FIRE + 0.04, T_FIRE + 0.16, T);
    p.pose = k > 0 ? { from: 'flat', to: 'sit', k } : 'flat';
    if (k > 0) { p.eyes = { state: 'normal', open: 1, pupil: 0.5, look: [0.3, -0.9] }; p.mouth = 'o'; p.squash = 0.18 * Math.sin(Math.PI * k); }
  }
  return p;
}

// ———————————————————— 「全名」小签（同 namePanel tagBelow 的 nameTab + triDown 样式；绳更短，免得挡住孩子的脸） ————————————————————
function tagState(T, c, E) {
  const top = panelToScreen(c, PANEL_CX, PANEL_BOTTOM);
  const sc = (1 + (c.zoom - 1) * 1.1) / (1 + (SEAM.cam.zoom - 1) * 1.1);
  const drop = T <= T0 ? 0 : spring(T - T0, { freq: 3.4, damping: 0.32 });   // 197.77 起垂下（带过冲）
  const len = 24 * drop * sc;
  const sway = Math.sin(T * 2.4) * 4 * sc * (1 - smoothstep(T0 + 0.1, T0 + 0.16, T));
  let hang = [top[0] + sway, top[1] + len];
  // 197.90 起被孩子的手抓住：签跟着手走
  const hand = E.A.childHand;
  const grab = smoothstep(T0 + 0.12, T0 + 0.17, T);
  if (hand && grab > 0) hang = [lerp(hang[0], hand[0], grab), lerp(hang[1], hand[1] - 18 * sc, grab)];
  return { top, hang, sc, drop };
}
function drawTag(g, T, st) {
  if (st.drop <= 0.001) return;
  const { top, hang, sc } = st;
  g.save();
  g.strokeStyle = PAL.inkSoft; g.lineWidth = 2.5 * sc; g.lineCap = 'round';
  g.beginPath(); g.moveTo(top[0], top[1] - 2); g.lineTo(hang[0], hang[1]); g.stroke();
  g.translate(hang[0], hang[1]);
  g.scale(sc, sc);
  // 刚垂下时整枚签从面板下沿“滑出”：被面板遮住的部分不画（面板在更上面一层）
  const r = nameTab(g, TXT.fullName, 0, 26, { size: 34, anchor: 'center', rot: Math.sin(T * 2.4) * 0.03 });
  const ty = r.y + r.h + 22 + Math.sin(T * 5) * 3;
  glyphIcon(g, 'triDown', 0, ty, 26, { fill: PAL.red });
  g.restore();
}

// ———————————————————— 卷轴（屏幕空间：从小签射向玫瑰窗，越远越窄） ————————————————————
const HEAD_KANJI = ['王', '浩', '然'];
const BAND_Y = 915;                              // 有人声段落的字幕带上沿（留 5px 余量）
function drawHallScroll(g, T, c, flat, from, ctx) {
  if (T < T_FIRE) return;
  const z = c.zoom;
  const [rx, ry, rr] = (() => { const [x, y] = throneToScreen(c, 'back', THRONE.rose.x, THRONE.rose.y, flat); const d = 1 + (c.zoom - 1) * lerp(0.55, 1, flat); return [x, y, THRONE.rose.r * d]; })();
  const [sx, sy] = from;
  const dx = rx - sx, dy = ry - sy;
  const w0 = 64 * z, w1 = 46 * z, w2 = Math.max(14, 0.16 * rr);
  // 45° 斜着往上冲（从公主头顶上方掠过，不挡脸），越靠近后墙的玫瑰窗越窄（远去）
  const path = [
    [sx, sy, w0],
    [sx + 0.22 * dx, sy + 0.30 * dy, w0 * 0.96],
    [sx + 0.52 * dx, sy + 0.60 * dy, w1],
    [sx + 0.82 * dx, sy + 0.88 * dy, lerp(w1, w2, 0.6)],
    [rx, ry, w2],
  ];
  const p = outCubic(seg(T, T_FIRE, T_ROSE));
  // 文字从勇者全名开始（卷头的「王浩然」由卷头标签负责）；字幕带（y ≥ 915）里只画点纹
  // 先画整条点纹版，再在羽化遮罩里叠写字版：字在字幕带上沿渐隐成点纹（不会出现被横切一半的字）
  const so = { p, t: T * 3, offset: 2.42 * w0 };
  const r = drawInfiniteScroll(g, path, { ...so, minPx: 1e9 });
  ctx.mask(g, (mg) => mg.fillRect(-200, -200, 2400, 200 + BAND_Y - 40), (mg) => drawInfiniteScroll(mg, path, { ...so, minPx: 10 }), { feather: 22 });
  // 卷头标签：大大的「王浩然」骑在卷头上，越飞越远越小
  const [hx, hy] = r.head;
  const hs = lerp(w0, w2, smoothstep(0, 1, p)) * 1.05;
  const a = 1 - smoothstep(0.88, 1, p);
  if (a > 0.01) {
    g.save();
    g.globalAlpha *= a;
    const adv = hs * 0.86;
    HEAD_KANJI.forEach((ch, i) => {
      const x = hx + (i - 1) * adv, y = hy - hs * 0.62 + Math.sin(T * 30 + i) * hs * 0.02;
      paperGlyph(g, ch, x, y, hs, { fill: PAL.red, edge: PAL.paper, edgeW: 0.12, rot: -0.06 + (i - 1) * 0.03 });
    });
    g.restore();
  }
  // 射出瞬间：小签处的礼花火星
  burst(g, T, { at: T_FIRE, seed: 1701, count: 26, x: sx, y: sy, spread: 18 * z, speed: [220 * z, 620 * z], angle: [-2.6, -0.5], gravity: 900 * z, drag: 1.6, life: [0.3, 0.6], size: [10 * z, 18 * z] }, sparkDraw);
  burst(g, T, { at: T_FIRE + 0.02, seed: 1702, count: 22, x: sx, y: sy, spread: 14 * z, speed: [180 * z, 520 * z], angle: [-2.8, -0.3], gravity: 700 * z, drag: 1.4, life: [0.4, 0.7], size: [8 * z, 14 * z] }, confettiDraw);
  // 卷头穿过玫瑰窗：一团金光 + 一颗小四角星 + 碎光
  const hitK = seg(T, T_ROSE - 0.02, T_ROSE + 0.14);
  if (hitK > 0 && hitK < 1) {
    glow(g, rx, ry, rr * (0.22 + 0.35 * hitK), PAL.goldLight, 0.75 * Math.sin(Math.PI * hitK));
    sparkle(g, rx, ry, rr * 0.16 * outBack(Math.min(1, hitK * 1.6)), { color: PAL.white, alpha: 1 - hitK, rot: 0.3 + hitK * 0.6, thin: 0.16 });
  }
  burst(g, T, { at: T_ROSE, seed: 1703, count: 20, x: rx, y: ry, spread: rr * 0.05, speed: [rr * 0.6, rr * 1.6], angle: [-3.14, 3.14], gravity: 0, drag: 3, life: [0.2, 0.4], size: [rr * 0.03, rr * 0.06] }, sparkDraw);
}

/** 王座厅一帧。图层栈 = 合同 SEAM.layers（back / mid / main（角色）/ glow / fg / panel），另加一层卷轴。 */
export function drawHall(g, T, ctx) {
  const { c, k } = hallCam(T);
  const flat = k;
  const E = { T, c, A: {}, key: SEAM.key };
  const env = resolveParams(SEAM.env.params, T, E);
  if (flat > 0) env.flat = flat;
  const tagRef = { st: null };
  for (const L of SEAM.layers) {
    const run = (lg) => {
      lg.save();
      for (const ref of L.draw) {
        if (ref.startsWith('env:')) { drawThroneRoom(lg, T, c, { ...env, layer: ref.slice(4) }); continue; }
        const it = ITEMS[ref];
        const prm = it.space === 'world' ? actorParams(ref, T, E) : resolveParams(it.params, T, E);
        lg.save();
        if (it.space === 'world') applyCam(lg, c, it.depth ?? 1);
        else if (it.space === 'parallax') applyParallax(lg, c, it.base, it.depth ?? 1);
        const ret = FN[it.fn](lg, prm);
        lg.restore();
        E.A[ref] = ret;
        if (ref === 'child' && ret && (ret.handF || ret.hand)) {
          const h = ret.handF || ret.hand;
          E.A.childHand = toScreen(c, 1, h[0], h[1]);
        }
      }
      // 小签画在面板之前（面板盖住刚滑出的上半截）
      if (L.id === 'panel') { /* 面板已画 */ }
      lg.restore();
    };
    if (L.id === 'panel' && T > T0) {
      tagRef.st = tagState(T, c, E);
      // 卷轴：在角色之前、面板之后（面板挂在 depth 1.1，卷轴从孩子手里飞向后墙，被面板挡住一角才对）
      if (T >= T_FIRE) ctx.layer(g, { shadow: 9, texture: 0.22 }, (lg) => drawHallScroll(lg, T, c, flat, [tagRef.st.hang[0], tagRef.st.hang[1] + 30 * tagRef.st.sc], ctx));
      // 小签在面板下面一层：先画签，再画面板
      ctx.layer(g, L.o, (lg) => { drawTag(lg, T, tagRef.st); run(lg); });
      continue;
    }
    if (L.o) ctx.layer(g, L.o, run); else run(g);
  }
  // 197.77「叮」：小签落定时的小四角星
  const dk = seg(T, T0 + 0.05, T0 + 0.3);
  if (dk > 0 && dk < 1 && tagRef.st) {
    const [x, y] = [tagRef.st.hang[0] + 46 * tagRef.st.sc, tagRef.st.hang[1] + 8 * tagRef.st.sc];
    sparkle(g, x, y, 30 * outBack(Math.min(1, dk * 3)) * tagRef.st.sc, { color: PAL.goldLight, alpha: 1 - dk, rot: dk * 1.2 });
  }
  return { c, flat };
}
void mixHex; void rgba; void outQuad;
