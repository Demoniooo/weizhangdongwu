// b11 第三拍：剪影对决（火墙后 127.40–130.50）。背景 fire2→fire 渐变，角色全是 ink 剪影，只有红围巾有颜色。
import { PAL, lin, glow, poly } from '../../core/paper.js';
import { cam, applyCam, toScreen } from '../../core/camera.js';
import { clamp, lerp, seg, wobble, rgba, smoothstep, hash2 } from '../../core/util.js';
import { ez, outCubic, inOutSine, outQuad, inQuad, glide, outExpo } from '../../core/ease.js';
import { field, burst } from '../../core/particles.js';
import { drawDragon } from '../../rigs/dragon.js';
import { drawHero, heroRig } from '../../rigs/hero.js';
import { drawFireBreath, emberDraw } from '../../props/misc.js';
import { impact, speedLines } from '../../fx/transitions.js';
import { TT, withDrift, keyp, keyv, hopPos, clashStar } from './k.js';
import { heroLook, SCARF } from './common.js';

export function camB3(T) {
  const z = lerp(1.0, 1.07, ez(T, TT.wallMid, TT.up0, glide));
  return withDrift(cam(960, 540 - 30 * seg(T, TT.snag0, TT.up0), z), T);
}

/** 巨龙（剪影世界 = 屏幕设计坐标，cam(960,540,1)）。 */
function dragonB3(T) {
  const head = keyp(T, [[TT.wallMid, [1300, 470]], [TT.clash1 - 0.1, [1220, 480], outQuad], [TT.clash1, [1180, 490], inQuad], [TT.horn, [1250, 470], outQuad],
    [TT.clash2 - 0.06, [1260, 500], glide], [TT.clash2 + 0.05, [1200, 430], outExpo], [TT.wing, [1240, 470], glide], [TT.clash3 - 0.08, [1210, 480]], [TT.clash3, [1130, 500], inQuad],
    [TT.clash3 + 0.3, [1330, 450], outExpo], [TT.up0, [1290, 460], glide]]);
  const shakeHead = (T > TT.horn && T < TT.clash2) ? 9 * Math.sin((T - TT.horn) * 30) : 0;
  const jaw = keyv(T, [[TT.wallMid, 0.5], [TT.clash1 - 0.12, 0.9], [TT.clash1 + 0.1, 0.4], [TT.clash2 - 0.15, 1], [TT.clash2, 0.12, inQuad], [TT.clash2 + 0.2, 0.5], [TT.clash3 - 0.12, 1], [TT.clash3 + 0.1, 0.6], [TT.up0, 0.35]]);
  const wingSweep = keyv(T, [[TT.wing - 0.18, 0], [TT.wing, -62, inQuad], [TT.wing + 0.22, 18, outQuad], [TT.wing + 0.5, 0, glide]]);
  return {
    pose: 'clash', t: T, x: head[0], y: head[1], jaw, wings: 1, arms: T < TT.horn ? 1 : 0.7, grip: seg(T, TT.clash1 - 0.1, TT.clash1),
    joints: { head: shakeHead + 20 * hitK(T, TT.clash2, 0.25), wing: wingSweep },
    eyes: { state: 'angry', pupil: 0.12 }, silhouette: true, silColor: PAL.ink, spikes: 0.4,
  };
}
const hitK = (T, at, d) => (T < at ? 0 : Math.exp(-(T - at) / d));

/** 勇者（剪影，围巾保留颜色）。A = 本帧巨龙锚点。 */
function heroB3(T, A) {
  const L = heroLook(T);
  const base = { s: 1, face: 1, t: T, ...L, silhouette: true, scarf: { ...SCARF, ground: 1e5, wind: [-560, -160] } };
  const horn = A ? [A.horn[0] - 18, A.horn[1] + 6] : [1300, 250];
  const claw = A && A.claw ? A.claw : [1000, 560];
  const tip = heroRig({ x: 0, y: 0, s: 1, face: 1, t: T, pose: 'thrust', act: 1 }).swordTip;
  const tAt = [claw[0] - tip[0] - 14, claw[1] - tip[1]];        // 前刺到底时剑尖顶在龙爪上
  if (T < TT.clash1 - 0.1) {   // 从左上方跃下来
    const k = ez(T, TT.wallMid - 0.25, TT.clash1 - 0.1, inQuad);
    const p = hopPos([330, 70], [tAt[0] - 60, tAt[1] - 70], k, -60);
    return { ...base, x: p[0], y: p[1] + 58, pose: 'hop', act: 0.45, rot: -0.2 * (1 - k), expr: 'shout', scarf: { ...base.scarf, vel: [700, 600] } };
  }
  if (T < TT.clash1 + 0.08) {  // 前刺：剑对爪
    const k = seg(T, TT.clash1 - 0.1, TT.clash1 + 0.02);
    return { ...base, x: lerp(tAt[0] - 60, tAt[0], outCubic(k)), y: lerp(tAt[1] - 12, tAt[1], k), pose: 'thrust', act: lerp(0.35, 1, outCubic(k)), expr: 'shout', scarf: { ...base.scarf, vel: [600, 100] } };
  }
  if (T < TT.horn) {           // 被弹开，翻上龙角
    const k = ez(T, TT.clash1 + 0.08, TT.horn, inOutSine);
    const p = hopPos(tAt, horn, k, 210);
    return { ...base, x: p[0], y: p[1] + 58 * (1 - k), pose: 'hop', act: lerp(0.2, 0.9, k), expr: 'determined', scarf: { ...base.scarf, vel: [300, -500] } };
  }
  if (T < TT.clash2 - 0.06) {  // 站在龙角上
    return { ...base, x: horn[0], y: horn[1], pose: 'stance', expr: 'determined', squash: -0.18 * wobble(T, TT.horn, 4, 0.15), scarf: { ...base.scarf, vel: [-200, 0] } };
  }
  const land = [640, 868];
  if (T < TT.wing - 0.08) {    // 剑对牙：从龙头上方往前翻过去（往左落地）
    const k = ez(T, TT.clash2 - 0.06, TT.wing - 0.1, inOutSine);
    const p = hopPos(horn, land, k, 150);
    if (k >= 1) return { ...base, x: land[0], y: land[1], pose: { from: 'hop', to: 'stance', k: 1 }, act: 0.95, expr: 'determined', squash: -0.22 * wobble(T, TT.wing - 0.1, 4, 0.12) };
    return { ...base, x: p[0], y: p[1] + 58, pose: 'vault', act: k, face: -1, expr: 'shout', scarf: { ...base.scarf, vel: [-500, 200] } };
  }
  if (T < TT.wing + 0.12) {    // 龙翼横扫：低头躲
    return { ...base, x: land[0], y: land[1], pose: 'duck', expr: 'hurt', scarf: { ...base.scarf, vel: [0, 0], wind: [-700, -80] } };
  }
  if (T < TT.clash3 - 0.1) {   // 反砍
    const k = seg(T, TT.wing + 0.12, TT.clash3 - 0.12);
    return { ...base, x: land[0] + 30 * k, y: land[1], pose: 'slash', act: outCubic(k), expr: 'shout', scarf: { ...base.scarf, vel: [200, 0] } };
  }
  if (T < TT.clash3 + 0.04) {  // 跃起：第三次对撞
    const k = ez(T, TT.clash3 - 0.1, TT.clash3, outQuad);
    const p = hopPos([670, 868], [880, 560], k, 60);
    return { ...base, x: p[0], y: p[1] + 58, pose: 'thrust', act: lerp(0.3, 1, k), expr: 'shout', scarf: { ...base.scarf, vel: [900, -300] } };
  }
  // 两边被弹开：勇者倒飞到左上，围巾甩向龙角并挂住（129.80），吊在龙角左下方晃
  const fly = ez(T, TT.clash3 + 0.04, TT.snag0 + 0.05, outExpo);
  const pFly = [lerp(880, 430, fly), lerp(560, 330, fly) - 80 * Math.sin(Math.PI * fly)];
  const hang = [horn[0] - 560, horn[1] + 190];
  const kSn = ez(T, TT.snag0, TT.snag0 + 0.35, inOutSine);
  const sw = wobble(T, TT.snag0 + 0.2, 1.6, 0.5);
  const p = [lerp(pFly[0], hang[0], kSn) + 60 * sw, lerp(pFly[1], hang[1], kSn) - 20 * Math.abs(sw)];
  const snag = T >= TT.snag0;
  return { ...base, x: p[0], y: p[1] + 58, pose: snag ? { from: 'roll', to: 'hangSwing', k: kSn } : 'roll', act: 0.25 + 0.5 * fly, expr: 'hurt',
    scarf: snag ? { ...base.scarf, to: horn, ground: 1e5 } : { ...base.scarf, vel: [-800, -300] } };
}

/** 剪影段整幅画面（背景 + 角色层 + 火花）。clip 由调用方给（火墙擦屏时只画墙后）。 */
export function drawSilhouetteScene(g, T, ctx, o = {}) {
  const c = camB3(T);
  // 背景：火墙身后同一条 fire2→fire 渐变 + 远处洞顶 / 地面的墨色剪影 + 热浪光
  g.fillStyle = lin(g, 0, 0, 0, 1080, [PAL.fire2, PAL.fire]);
  g.fillRect(-60, -60, 2040, 1200);
  glow(g, 980, 520, 900, PAL.goldLight, 0.35);
  g.save(); applyCam(g, c, 0.5);
  g.fillStyle = rgba(PAL.fireDeep, 0.5);
  for (let i = 0; i < 16; i++) { const x = -80 + i * 140 + 30 * hash2(3, i), L = 70 + 120 * hash2(4, i); g.fill(poly([[x - 26, -40], [x + 26, -40], [x + 4, L]], { seed: 40 + i, round: 0.3 })); }
  g.restore();
  g.save(); applyCam(g, c, 1);
  g.fillStyle = PAL.ink;
  g.fill(poly([[-200, 900], [300, 880], [700, 905], [1100, 885], [1500, 900], [1900, 882], [2200, 900], [2200, 1300], [-200, 1300]], { seed: 9, round: 0.5 }));
  g.restore();
  field(g, T, { seed: 1301, count: 34, x: 0, y: 0, w: 1920, h: 1080, vx: -30, vy: -70, sway: 24, size: [3, 7] }, (g2, x, y, s) => emberDraw(g2, x, y, { ...s, p: 0.3, age: T, i: s.i }));
  let A = null, H = null;
  ctx.layer(g, { shadow: 6, texture: 0.25 }, (lg) => {
    lg.save(); applyCam(lg, c, 1);
    A = drawDragon(lg, dragonB3(T));
    H = heroB3(T, A);
    const ha = drawHero(lg, H);
    lg.restore();
    A.heroTip = ha.swordTip;
  });
  // 三次对撞的星形火花（屏幕坐标）+ 冲击
  const hits = [[TT.clash1, 'M', 0.5, 14, 150], [TT.clash2, 'M', 0, 12, 110], [TT.clash3, 'L', 0.8, 18, 230]];
  for (const [at, lv, fl, sh, size] of hits) {
    if (T < at || T > at + 0.6) continue;
    const pt = at === TT.clash2 ? A.mouth : at === TT.clash1 ? (A.claw || A.mouth) : [900, 560];
    const [sx, sy] = toScreen(c, 1, pt[0] - (at === TT.clash3 ? 0 : 20), pt[1]);
    if (!o.noFx) impact(ctx, T, at, lv, fl > 0 ? { flash: fl, shake: sh, g, x: sx, y: sy, seed: Math.round(at * 10), alpha: 0.8, life: 0.26, color: PAL.goldLight } : { flash: 0, shake: sh, g, x: sx, y: sy, rays: false, seed: Math.round(at * 10) });
    clashStar(g, sx, sy, size, (T - at) / 0.5, { rot: at });
    burst(g, T, { at, seed: Math.round(at * 100), count: 26, x: sx, y: sy, spread: 10, speed: [300, 900], angle: [0, Math.PI * 2], gravity: 700, life: [0.25, 0.55], size: [3, 7] }, emberDraw);
  }
  // 被弹开的速度线
  const kb = seg(T, TT.clash3, TT.clash3 + 0.35);
  if (kb > 0 && kb < 1) speedLines(g, 'h', { x: 0, y: 200, w: 1920, h: 500 }, { t: T, sign: -1, alpha: 0.5 * (1 - kb), density: 2.4, colors: [PAL.ink, PAL.fireDeep], lw: [2, 6], seed: 33 });
  return { c, A };
}

/** 127.17–127.47 火墙擦屏：前沿从右往左扫过；墙后（back 以右）是剪影段。 */
export function drawFireWallWipe(g, T, ctx) {
  const p = seg(T, TT.wall0, TT.wall1);
  if (p <= 0 || p >= 1) return;
  const x = lerp(2150, -760, inOutSine(p));
  const back = x + 560;
  if (T < TT.wallMid && back < 1960) {
    g.save();
    const r = new Path2D(); r.rect(back, -100, 2200, 1300); g.clip(r);
    drawSilhouetteScene(g, T, ctx, { noFx: true });
    g.restore();
  }
  drawFireBreath(g, { wall: { x, dir: -1, depth: 560, intensity: 1.15 }, t: T, seed: 7 });
}

export function drawBeat3(g, T, ctx) {
  ctx.fx.contrast = 1.06; ctx.fx.vignette = 0.42; ctx.fx.vignetteColor = PAL.redDeep;
  const r = drawSilhouetteScene(g, T, ctx);
  drawFireWallWipe(g, T, ctx);
  return r;
}
void clamp; void smoothstep;
