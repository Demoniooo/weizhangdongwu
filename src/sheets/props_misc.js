// 模型图：src/props/misc.js —— 火焰字、火流/劈火/火墙、风滚草、花瓣与花瓣环、蝴蝶结、形状烟花、横幅、纸手、冲击环、声波、气球线、粒子回调。
import { PAL, rr, cut, lin, blob, poly } from '../core/paper.js';
import { clamp, lerp, osc, rgba, fract, TAU, mixHex } from '../core/util.js';
import { outExpo, inOutCubic, ez, outBack } from '../core/ease.js';
import { burst, field, stream } from '../core/particles.js';
import { glyphRow, NAME_TIMES } from '../ui/type.js';
import { NAMES } from '../cues.js';
import {
  drawFireLetter, drawFireBreath, drawTumbleweed, drawPetal, drawPetalOrbit, drawBanner, drawBow, drawFireworkShape, drawHand,
  drawShockRing, drawSpeechWave, drawBalloonString, confettiDraw, sparkDraw, snowDraw, dustDraw, ashDraw, emberDraw, heartPath, starPath,
} from '../props/misc.js';

const label = (g, text, x, y, size = 22, col = PAL.inkSoft) => glyphRow(g, text, x, y, size, { family: 'play', fill: col, edge: null, align: 'center', gap: 0 });
const bg = (g, title) => { g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080); label(g, title, 960, 40, 28, PAL.ink); };
const darkPanel = (g, x, y, w, h) => {
  g.save();
  g.fillStyle = lin(g, 0, y, 0, y + h, [PAL.dragonDeep, mixInk()]);
  g.beginPath(); g.roundRect(x, y, w, h, 24); g.fill();
  g.restore();
};
const mixInk = () => mixHex(PAL.dragonDeep, PAL.ink, 0.6);
const D2A = [...NAMES.dragonParts[0]], D2B = [...NAMES.dragonParts[1]];

export default [
  {
    id: 'sheet_misc_fireletter', start: 0, end: 2,
    draw(g, T, lt, ctx) {
      bg(g, 'props/misc · drawFireLetter：悬停一排（heat 1）/ 飞行带拖烟（vel −700）越来越大 / dissolve 0.35 · 0.7');
      darkPanel(g, 60, 80, 1800, 940);
      ctx.layer(g, { texture: 0.15 }, (lg) => {
        D2A.forEach((ch, i) => drawFireLetter(lg, { x: 220 + i * 120, y: 250 + Math.sin(T * 3 + i) * 5, ch, size: 86, t: T, seed: i + 1 }));
        D2B.forEach((ch, i) => drawFireLetter(lg, { x: 300 + i * 250, y: 560, ch, size: 84 + i * 12, t: T, seed: 20 + i, vel: [-700 - i * 60, 30], rot: Math.sin(T * 2 + i) * 0.08 }));
        drawFireLetter(lg, { x: 1260, y: 250, ch: '松', size: 86, t: T, seed: 41, dissolve: 0.35 });
        drawFireLetter(lg, { x: 1400, y: 250, ch: '松', size: 86, t: T, seed: 42, dissolve: 0.7 });
        drawFireLetter(lg, { x: 1620, y: 250, ch: '昆', size: 140, t: T, seed: 43, heat: 1.3, tongues: 5 });
      });
      label(g, 'D2a 一排（size 86）', 640, 360, 22, PAL.paper2);
      label(g, 'D2b 飞行：vel=[-700,30]，size 84→132，拖烟随速度', 800, 700, 22, PAL.paper2);
      label(g, 'dissolve .35 / .7', 1330, 360, 22, PAL.paper2);
      label(g, 'size 140 heat 1.3', 1620, 360, 22, PAL.paper2);
      // CU 级大字
      ctx.layer(g, { texture: 0.15 }, (lg) => drawFireLetter(lg, { x: 960, y: 860, ch: '卡', size: 220, t: T, seed: 7, vel: [-300, 0] }));
      label(g, 'CU：size 220', 1200, 960, 22, PAL.paper2);
    },
  },
  {
    id: 'sheet_misc_firebreath', start: 2, end: 4,
    draw(g, T, lt, ctx) {
      bg(g, 'props/misc · drawFireBreath：火流（p 生长）/ 被剑劈成 V 字（split 0→1）');
      darkPanel(g, 60, 80, 1800, 940);
      const p = clamp(lt / 0.8);
      const sk = clamp((lt - 0.2) / 1.2);
      ctx.layer(g, { texture: 0.12 }, (lg) => {
        drawFireBreath(lg, { from: [1760, 300], to: [260, 330], p, t: T, seed: 3, w0: 24, w1: 90 });
        drawFireBreath(lg, { from: [1760, 760], to: [200, 790], p: 1, t: T, seed: 9, split: sk, splitAt: [760, 780], w0: 26, w1: 100 });
      });
      // 剑（示意）
      ctx.layer(g, { shadow: 6 }, (lg) => {
        lg.save(); lg.translate(744, 780);
        cut(lg, poly([[-7, 150], [7, 150], [7, -150], [0, -175], [-7, -150]], { seed: 2, amp: 0.3 }), PAL.steel, { rim: PAL.white });
        cut(lg, rr(-40, 150, 80, 14, 7), PAL.gold);
        lg.restore();
      });
      label(g, `p = ${p.toFixed(2)}`, 960, 420, 24, PAL.paper2);
      label(g, `split = ${sk.toFixed(2)}，splitAt = 剑刃`, 960, 990, 24, PAL.paper2);
    },
  },
  {
    id: 'sheet_misc_firewall', start: 4, end: 6,
    draw(g, T, lt, ctx) {
      bg(g, 'props/misc · 火墙（wall）从右往左扫，身后由镜头遮罩出剪影画面（用返回的 edge）');
      const x = lerp(2150, -500, inOutCubic(clamp(lt / 2)));
      // 前一画面
      g.fillStyle = lin(g, 0, 80, 0, 1000, [PAL.dragonDeep, mixInk()]); g.fillRect(60, 80, 1800, 940);
      ctx.layer(g, { shadow: 8 }, (lg) => { cut(lg, blob(500, 700, 110, 180, { seed: 3 }), PAL.heroBlue); cut(lg, blob(1400, 600, 220, 140, { seed: 4 }), PAL.dragon); });
      const res = { edge: null };
      ctx.layer(g, {}, (lg) => { Object.assign(res, drawFireBreath(lg, { wall: { x, depth: 520, dir: -1, y0: 80, y1: 1020 }, t: T, seed: 7 })); });
      // 剪影画面（遮罩：back 线以右）
      ctx.mask(g, (mg) => { mg.fillRect(res.back, 0, 2400, 1080); }, (lg) => {
        lg.fillStyle = lin(lg, 0, 0, 0, 1080, [PAL.fire2, PAL.fire]); lg.fillRect(60, 80, 1800, 940);
        lg.fillStyle = PAL.ink; lg.fill(blob(500, 700, 110, 180, { seed: 3 })); lg.fill(blob(1400, 600, 220, 140, { seed: 4 }));
      }, { feather: 30 });
      label(g, `wall.x = ${x.toFixed(0)}`, 960, 1050, 22);
    },
  },
  {
    id: 'sheet_misc_petals', start: 6, end: 8,
    draw(g, T, lt, ctx) {
      bg(g, 'props/misc · 风滚草（常态 / 烧焦）· 花瓣（flip）· E02 花瓣环（161.55→165.25 压到 2s）· 蝴蝶结 · 形状烟花');
      const ground = 330;
      g.strokeStyle = rgba(PAL.inkSoft, 0.35); g.setLineDash([10, 8]); g.beginPath(); g.moveTo(80, ground); g.lineTo(900, ground); g.stroke(); g.setLineDash([]);
      const rx = lerp(120, 860, fract(lt / 2));
      ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => {
        drawTumbleweed(lg, { x: 200, y: ground, t: T, roll: T * 2 });
        drawTumbleweed(lg, { x: 420, y: ground, t: T, roll: -T * 2, charred: 1 });
        drawTumbleweed(lg, { x: rx, y: ground - Math.abs(Math.sin(lt * 5)) * 40, t: T, roll: rx / 46, s: 0.8 });
        [0, 0.25, 0.45, 0.7].forEach((f, i) => drawPetal(lg, { x: 1080 + i * 130, y: 180, ch: '米娅莫拉'[i], flip: f, t: T }));
        drawPetal(lg, { x: 1660, y: 180, ch: '红', s: 1.3, rot: Math.sin(T * 2) * 0.2, t: T });
        drawBow(lg, { x: 1500, y: 560, s: 0.9, pop: clamp((lt % 2) * 1.6), t: T });
      });
      label(g, 'normal / charred / rolling', 420, 380);
      label(g, 'flip 0 / .25 / .45 / .7', 1260, 260);
      // 花瓣环
      const TE = 161.55 + lt * 1.85;
      const o = { cx: 560, cy: 820, rx: 320, ry: 90 };
      ctx.layer(g, { shadow: 4, texture: 0.3, blur: 1.5 }, (lg) => drawPetalOrbit(lg, TE, { ...o, part: 'back' }));
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
        cut(lg, blob(560, 760, 60, 150, { seed: 9 }), PAL.princess);
        cut(lg, blob(560, 590, 52, 52, { seed: 10 }), PAL.skin);
      });
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => drawPetalOrbit(lg, TE, { ...o, part: 'front' }));
      label(g, `E02 T=${TE.toFixed(2)}`, 560, 1040, 22);
      // 烟花
      ctx.layer(g, { texture: 0.1 }, (lg) => {
        const tt = lt % 2;
        drawFireworkShape(lg, { x: 1180, y: 860, shape: 'heart', at: 0.1, t: tt, size: 220 });
        drawFireworkShape(lg, { x: 1600, y: 860, shape: 'star', at: 0.3, t: tt, size: 220 });
      });
      label(g, 'pop 循环', 1500, 720);
      label(g, 'heart / star firework', 1390, 1040);
    },
  },
  {
    id: 'sheet_misc_banner', start: 8, end: 10,
    draw(g, T, lt, ctx) {
      bg(g, 'props/misc · drawBanner：勇者横幅（grow）/ 公主竖幅落地拐弯横排 / retract 字脱落 / range 绕柱前后分层');
      const gr = clamp(lt / 1.6);
      const wave = [];
      for (let i = 0; i <= 14; i++) wave.push([110 + i * 122, 190 + Math.sin(i * 0.75 + T * 2.2) * 30]);
      const vert = [[250, 290], [250, 560], [256, 700], [300, 760], [520, 768], [980, 760]];
      const loop = [];
      for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + (i / 40) * Math.PI * 2 * 1.05; loop.push([1500 + Math.cos(a) * 190, 760 + Math.sin(a) * 46 - i * 2.2]); }
      ctx.layer(g, { shadow: 7, texture: 0.3 }, (lg) => {
        drawBanner(lg, wave, { style: 'hero', size: 58, grow: gr, t: T });
        drawBanner(lg, vert, { style: 'princess', size: 62, grow: gr, t: T });
        drawBanner(lg, [[1120, 420], [1450, 400], [1830, 430]], { style: 'hero', size: 44, chars: [...NAMES.hero], grow: 1, retract: clamp((lt - 0.3) / 0.5), retractT: Math.max(0, lt - 0.3), t: T });
        drawBanner(lg, loop, { style: 'hero', size: 34, grow: 1, range: [0.25, 0.75], t: T });
      });
      ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => {
        cut(lg, poly([[1478, 1000], [1522, 1000], [1514, 560], [1500, 470], [1486, 560]], { seed: 4 }), PAL.roof);
      });
      ctx.layer(g, { shadow: 7, texture: 0.3 }, (lg) => {
        drawBanner(lg, loop, { style: 'hero', size: 34, grow: 1, range: [0, 0.25], t: T, tail: false });
        drawBanner(lg, loop, { style: 'hero', size: 34, grow: 1, range: [0.75, 1], t: T });
      });
      label(g, 'hero（skyDayLow / gold / heroBlueDark）grow', 960, 290);
      label(g, 'princess（red / gold / paper）竖排从上往下 → 落地横排', 620, 850);
      label(g, 'retract：卷尺式弹回，字旋转飘落', 1480, 520);
      label(g, 'range：后半圈 / 柱 / 前半圈', 1500, 1040);
    },
  },
  {
    id: 'sheet_misc_hand', start: 10, end: 12,
    draw(g, T, lt, ctx) {
      bg(g, 'props/misc · drawHand（slap / press / grab）· 冲击环 · 声波 · 气球线（knot）· 粒子外观回调');
      ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
        drawHand(lg, { x: 230, y: 600, s: 0.62, pose: 'slap', press: 0, sleeve: 300 });
        drawHand(lg, { x: 560, y: 600, s: 0.62, pose: 'slap', press: osc(lt, 1), sleeve: 300 });
        drawHand(lg, { x: 890, y: 600, s: 0.62, pose: 'grab', sleeve: 300 });
      });
      label(g, 'slap', 230, 760); label(g, 'press = osc', 560, 760); label(g, 'grab', 890, 760);
      ctx.layer(g, { shadow: 4, texture: 0.2 }, (lg) => {
        for (let k = 0; k < 3; k++) { const q = fract(lt / 1.2 + k / 3); drawShockRing(lg, { x: 1200, y: 330, r: 30 + q * 170, alpha: 1 - q * q, seed: k + 2 }); }
        drawSpeechWave(lg, { x: 1460, y: 330, dir: 0, t: T, n: 3 });
        drawSpeechWave(lg, { x: 1460, y: 330, dir: Math.PI, t: T, n: 3, color: PAL.goldLight });
        const balloons = [[1690, 170], [1770, 140], [1850, 190], [1730, 240], [1810, 260]];
        drawBalloonString(lg, { from: [1760, 560], to: balloons, knot: osc(lt, 2), t: T });
        balloons.forEach(([bx, by], i) => cut(lg, blob(bx, by, 26, 30, { seed: i + 3 }), [PAL.princessLight, PAL.skyDay, PAL.leafLight, PAL.goldLight, PAL.princessLight][i], { rim: PAL.white }));
      });
      label(g, 'shock ring', 1200, 560); label(g, 'speech wave', 1460, 560); label(g, `balloon knot ${osc(lt, 2).toFixed(2)}`, 1770, 600);
      // 粒子回调：每格一个 burst
      const cbs = [confettiDraw, sparkDraw, snowDraw, dustDraw, ashDraw, emberDraw];
      const names = ['confettiDraw', 'sparkDraw', 'snowDraw', 'dustDraw', 'ashDraw', 'emberDraw'];
      g.fillStyle = mixHex(PAL.dragonDeep, PAL.ink, 0.3); g.beginPath(); g.roundRect(1140, 640, 690, 400, 20); g.fill();
      ctx.layer(g, {}, (lg) => {
        cbs.forEach((fn, i) => {
          const cx = 1250 + (i % 3) * 230, cy = 770 + Math.floor(i / 3) * 190;
          burst(lg, lt % 1.4, { at: 0.02, seed: 3 + i, count: 26, x: cx, y: cy, speed: [70, 220], angle: [-3.0, -0.15], gravity: i === 3 ? -30 : i === 5 ? -120 : 320, life: [1.0, 1.35], size: i === 1 ? [10, 16] : [8, 13] }, fn);
        });
      });
      names.forEach((n, i) => label(g, n, 1250 + (i % 3) * 230, 830 + Math.floor(i / 3) * 190, 18, PAL.paper2));
    },
  },
];
