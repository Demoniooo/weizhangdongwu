// kit.js 模型图：每个组件的全部状态一屏排开 + 动态循环。
// 页面（秒）：[0,1) 符号 / 面板 / 气泡 ｜ [1,2) 对话框（N1 8 字验证）｜ [2,3) 取名面板 ｜ [3,4) 剧场名字牌 ｜ [4,5) 菜单 / 横幅 / 数字 / 徽章 ｜
//            [5,6) HUD / 经验条 / 计数牌 ｜ [6,7) 道具栏 / 角色卡 ｜ [7,8) 名签 / 头像 / 小尺寸符号 ｜
//            [8,10) 动态：对话框 ｜ [10,12) 动态：取名面板 N2 ｜ [12,14) 动态：HUD ｜ [14,16) 动态：剧场
import { PAL, rr, line } from '../core/paper.js';
import { clamp, mixHex, rgba } from '../core/util.js';
import { charsOf } from '../ui/type.js';
import { glyphRow, paperGlyph } from '../ui/type.js';
import {
  TXT, ICON_NAMES, glyphIcon, paperPanel, nameTab, dialogBox, bubble, thinkDots, namePanel, drawHUD, expBarBig, lvUpBadge, coinCounter,
  marqueePlate, battleMenu, turnBanner, damageNumber, itemBar, characterCard, enemyPlate, vsBadge, nameTagSmall, portraitHead, HUD_LAYOUT,
} from '../ui/kit.js';

const HERO = charsOf('hero');
const bg = (g) => { g.fillStyle = PAL.paper; g.fillRect(0, 0, 1920, 1080); };
const label = (g, text, x, y, size = 24, fill = PAL.inkSoft, family = 'play') => glyphRow(g, [...text], x, y, size, { family, fill, edge: null, gap: 0, baseline: true });
const title = (g, text, sub) => { label(g, text, 48, 46, 36, PAL.ink); if (sub) label(g, sub, 48, 84, 21); };
const limit900 = (g) => { g.save(); g.strokeStyle = rgba(PAL.red, 0.55); g.lineWidth = 2; g.setLineDash([12, 8]); g.beginPath(); g.moveTo(0, 900); g.lineTo(1920, 900); g.stroke(); g.restore(); label(g, 'y = 900（界面下限，字幕带之上）', 1500, 920, 18, PAL.red); };
/** 把以 (ox,oy) 为原点设计的组件缩放后画到 (tx,ty)。 */
const at = (g, ox, oy, tx, ty, s, fn) => { g.save(); g.translate(tx - ox * s, ty - oy * s); g.scale(s, s); fn(); g.restore(); };
const snail = (g, x, y) => { // 占位蜗牛（正式由 monsters.drawSnail 画）
  g.save(); g.fillStyle = PAL.skin; g.beginPath(); g.ellipse(x - 6, y - 8, 22, 8, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = PAL.earth; g.beginPath(); g.arc(x - 12, y - 22, 15, 0, Math.PI * 2); g.fill(); g.strokeStyle = PAL.woodDark; g.lineWidth = 2; g.beginPath(); g.arc(x - 12, y - 22, 8, 0, Math.PI * 1.6); g.stroke(); g.restore();
};

// ———————————————————— 页 1：符号 / 面板 / 气泡 ————————————————————
function pageIcons(g, T) {
  bg(g);
  title(g, 'kit.js · glyphIcon（全部路径画，64px）· paperPanel · bubble · thinkDots', '符号没有一个是字体字形；面板 = 卡纸 + 4px 墨线（抖 1.2px）+ 缝线 [10,8] 内缩 12 + 金包角；名签红底奶油字');
  ICON_NAMES.forEach((n, i) => {
    const x = 90 + i * 104, y = 160;
    g.fillStyle = rgba(PAL.paper2, 0.8); g.fill(rr(x - 46, y - 46, 92, 92, 12));
    const o = n === 'circledNum' ? { n: 1 } : {};
    glyphIcon(g, n, x, y, 64, o);
    label(g, n, x - 44, y + 66, 15, PAL.inkSoft, 'latin');
  });
  // 变体
  const vy = 300;
  const vars = [['heart', { fillFrac: 0.5 }, 'heart .5'], ['heart', { fillFrac: 0 }, 'heart 0'], ['heart', { crack: 0.25 }, 'crack .25'], ['heart', { crack: 0.7 }, 'crack .7'],
    ['exclaim', { bar: 0.4 }, 'bar .4'], ['circledNum', { n: 2 }, 'n 2'], ['circledNum', { n: 3 }, 'n 3'], ['circledNum', { n: 4 }, 'n 4'],
    ['arrow', { dir: 'left' }, 'left'], ['arrow', { dir: 'up' }, 'up'], ['lock', { open: 1 }, 'open'], ['coin', { spin: 1.1 }, 'spin'], ['star', { flat: true }, 'flat'], ['check', { fill: PAL.red, under: PAL.redDeep }, 'red']];
  vars.forEach(([n, o, l], i) => { const x = 90 + i * 104; glyphIcon(g, n, x, vy, 64, o); label(g, l, x - 44, vy + 62, 15, PAL.inkSoft, 'latin'); });
  // 面板
  paperPanel(g, { x: 60, y: 420, w: 360, h: 220 }, { tag: { text: TXT.naming, size: 30 } });
  paperPanel(g, { x: 470, y: 420, w: 360, h: 220 }, { bulge: 0.5, tag: { text: TXT.king, side: 'right', size: 30 } });
  paperPanel(g, { x: 880, y: 420, w: 360, h: 220 }, { bulge: 1 });
  paperPanel(g, { x: 1290, y: 420, w: 360, h: 220 }, { tear: 0.8, bulgeR: 20 });
  label(g, '基础', 70, 670, 20); label(g, 'bulge 0.5 + 右名签', 480, 670, 20); label(g, 'bulge 1（气球）', 890, 670, 20); label(g, 'tear 0.8 + bulgeR 20', 1300, 670, 20);
  // 气泡
  const sh = [['round', '再说一遍？'], ['jagged', '嗷——'], ['cloud', null], ['flame', '不对！'], ['soft', '呼——']];
  sh.forEach(([s, txt], i) => {
    const x = 170 + i * 330, y = 830;
    if (s === 'cloud') thinkDots(g, { x, y: y - 10, w: 240, h: 150, tail: [x - 110, y + 110], dots: [1, 1, 0.6] });
    else bubble(g, { shape: s, x, y, w: s === 'jagged' ? 300 : 290, h: 160, text: txt, tail: [x - 90, y + 125], t: T });
    label(g, s === 'cloud' ? 'thinkDots（cloud）' : s, x - 120, y + 140, 20, PAL.ink, 'latin');
  });
  bubble(g, { shape: 'round', x: 1760, y: 820, w: 260, h: 150, text: '是不是…', tail: [1860, 940], mirror: true });
  label(g, 'mirror', 1700, 960, 20, PAL.ink, 'latin');
  limit900(g);
}

// ———————————————————— 页 2：对话框 ————————————————————
function pageDialog(g, T) {
  bg(g);
  title(g, 'dialogBox · 国王问名 / 名签翻牌 / N1 文字区正好 8 个 120px 字（x 600–1384，字距 98）/ 右框鼓出 / 撕开', '默认位置 (420,690)–(1500,900)；头像在说话人一侧：国王右、勇者左');
  at(g, 420, 690, 40, 130, 0.5, () => dialogBox(g, { speaker: 'king', text: '名字？', typed: 1, cursor: true, t: T }));
  at(g, 420, 690, 640, 130, 0.5, () => dialogBox(g, { speaker: 'hero', from: 'king', tagFlip: 0.3, text: '', t: T }));
  at(g, 420, 690, 1240, 130, 0.5, () => dialogBox(g, { speaker: 'hero', text: '咳咳', typed: 1, erase: 0.4, cursor: true, t: T }));
  label(g, 'king · 名字？· 光标', 50, 260, 18); label(g, '翻牌中 tagFlip 0.3（头像换边）', 650, 260, 18); label(g, '咳咳 erase 0.4', 1250, 260, 18);
  at(g, 420, 690, 40, 300, 0.5, () => {
    const r = dialogBox(g, { speaker: 'hero', bulgeRight: 1, cursor: true, t: T });
    glyphRow(g, HERO.slice(0, 8), r.textArea.x, 795, 120, { style: 'cut', pitch: 98 });
  });
  at(g, 420, 690, 640, 300, 0.5, () => {
    const r = dialogBox(g, { speaker: 'hero', tear: 1, t: T });
    glyphRow(g, HERO.slice(0, 8), r.textArea.x, 795, 120, { style: 'cut', pitch: 98, perChar: (i) => ({ dx: -i * 4 }) });
  });
  label(g, 'bulgeRight 1（右框鼓 40px）', 50, 430, 18); label(g, 'tear 1（撕口 + 纸瓣 + 纤维）', 650, 430, 18);
  // 正式尺寸：N1 验证
  const r = dialogBox(g, { speaker: 'hero', textArea: { x: 600, w: 784 }, cursor: false, t: T });
  g.save(); g.strokeStyle = rgba(PAL.heroBlue, 0.6); g.setLineDash([6, 6]); g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) { const x = 600 + i * 98; g.beginPath(); g.moveTo(x, 700); g.lineTo(x, 890); g.stroke(); }
  g.restore();
  glyphRow(g, HERO.slice(0, 8), 600, 795, 120, { style: 'cut', pitch: 98 });
  label(g, '正式尺寸：textArea x 600–1384 = 8 × 98；display 120px 剪纸字（style cut）', 600, 668, 20, PAL.heroBlue);
  label(g, `返回 textArea.x ${Math.round(r.textArea.x)} w ${Math.round(r.textArea.w)}`, 1240, 600, 18, PAL.heroBlue, 'latin');
  limit900(g);
}

// ———————————————————— 页 3：取名面板 ————————————————————
function pagePanel(g, T) {
  bg(g);
  title(g, 'namePanel · 8 格 → 13/8 崩飞 → 3 格收拢', '原尺寸 (440,250)–(1480,620)，格 112×124 间距 12，格排 x 470–1450、y 400–524；此页缩 0.5 排开');
  const tilesOf = (n, p = 1) => HERO.slice(0, n).map((ch) => ({ ch, p }));
  at(g, 440, 250, 60, 150, 0.5, () => namePanel(g, { ropeTop: 130, tiles: tilesOf(4), counter: 4, t: T }));
  at(g, 440, 250, 680, 150, 0.5, () => namePanel(g, { ropeTop: 130, tiles: tilesOf(8), counter: 8, full: 1, t: T }));
  at(g, 440, 250, 1300, 150, 0.5, () => namePanel(g, { ropeTop: 130, tiles: tilesOf(13), counter: 13, bulge: 1, overTag: 1, t: T }));
  label(g, 'N2a 4/8', 70, 360, 20); label(g, 'N2b 8/8 满格泛金', 690, 360, 20); label(g, 'N2c 13/8 压扁 + 鼓成气球 + 字数超限', 1310, 360, 20);
  at(g, 440, 250, 60, 470, 0.5, () => namePanel(g, { ropeTop: 130, tiles: tilesOf(13), counter: 13, bulge: 0.8, strings: { left: 0 }, swing: 40, t: T + 0.6 }));
  at(g, 440, 250, 680, 470, 0.5, () => namePanel(g, { ropeTop: 130, tiles: tilesOf(13), counter: 13, bulge: 0.6, strings: { left: 0 }, swing: 70, popFrames: 0.45, t: T + 0.6 }));
  at(g, 440, 250, 1300, 470, 0.5, () => namePanel(g, { ropeTop: 130, tiles: charsOf('child').map((ch) => ({ ch, p: 1 })), counter: 3, foldEmpty: 1, contract: 1, glowOk: 0.8, tagBelow: true, t: T }));
  label(g, '左绳断 swing 40°', 70, 720, 20); label(g, 'swing 70° + popFrames 0.45（格框崩飞、牌弹回原宽）', 690, 720, 20); label(g, 'O06 3/8 空格折起 + 收拢 + 刚刚好光 + 「全名」小签', 1310, 720, 20);
  at(g, 440, 250, 60, 790, 0.5, () => namePanel(g, { ropeTop: 130, tiles: charsOf('child').map((ch, i) => ({ ch, p: i < 2 ? 1 : 0.5 })), counter: 2, foldEmpty: 0.5, cursor: 2, t: T }));
  at(g, 440, 250, 680, 790, 0.5, () => namePanel(g, { ropeTop: 130, tiles: charsOf('child').map((ch) => ({ ch, p: 1 })), counter: 3, foldEmpty: 1, contract: 0.5, t: T }));
  label(g, '落牌中 + foldEmpty 0.5', 70, 1000, 20); label(g, 'contract 0.5', 690, 1000, 20);
}

// ———————————————————— 页 4：剧场名字牌 ————————————————————
function pagePlates(g, T) {
  g.fillStyle = mixHex(PAL.redDeep, PAL.ink, 0.25); g.fillRect(0, 0, 1920, 1080);
  g.fillStyle = PAL.redDark; g.fillRect(0, 0, 1920, 150);
  label(g, 'marqueePlate · 勇者牌 x 150–750 / 巨龙牌 x 1170–1770（窗 5 字 72px 字距 63，mode pass）', 48, 46, 32, PAL.paper);
  label(g, '第一行为正式位置 y 176–262；下面各行用 tf.dy 下移｜pass：p 0 首字刚进窗、p 1 末字刚出窗（跨度 13×63+315）；idle 默认 fit 静止显示开头', 48, 84, 20, PAL.goldLight);
  const rows = [
    ['active · p 0', { state: 'active', progress: 0 }, { state: 'idle', progress: 0, hp: 1 }],
    ['active · p 0.5', { state: 'active', progress: 0.5, hp: 0.8 }, { state: 'hit', progress: 0.5, hp: 0.7, hpLag: 0.95 }],
    ['active · p 1', { state: 'active', progress: 1, hp: 0.6 }, { state: 'angry', progress: 0.45, hp: 0.7 }],
    ['cracked · HP 1', { state: 'cracked', progress: 0.35, hp: 0.01, hpLag: 0.3, hpText: 'HP 1' }, { state: 'idle', progress: 0.2, hp: 0, hpText: 'HP 0', crack: 1 }],
    ['empty · beat', { state: 'empty', progress: 0.5, beat: 1, hp: 0.05, hpText: 'HP 1' }, { state: 'active', progress: 0.62, hp: 0.3, shrink: 0.5 }],
  ];
  rows.forEach(([lab, h, d], r) => {
    const dy = r * 168;
    marqueePlate(g, { side: 'hero', ...h, t: T, tf: { dy }, ropeTop: r ? 176 + dy - 20 : 120 });
    marqueePlate(g, { side: 'dragon', ...d, t: T, tf: { dy }, ropeTop: r ? 176 + dy - 20 : 120 });
    label(g, `勇者 ${lab}`, 160, 290 + dy, 19, PAL.goldLight);
    label(g, `巨龙 ${d.state}${d.shrink ? ' · shrink .5' : ''}${d.crack ? ' · crack' : ''}`, 1180, 290 + dy, 19, PAL.goldLight);
  });
}

// ———————————————————— 页 5：菜单 / 横幅 / 数字 / 徽章 ————————————————————
function pageMenu(g, T) {
  bg(g);
  title(g, 'battleMenu · turnBanner · damageNumber · vsBadge · enemyPlate · lvUpBadge', '菜单正式位置 x 150–560、y 640–830；光标为路径画金色小剑；锁、星、剑全部路径画');
  battleMenu(g, { cursor: 0, blink: 0.5, t: T });
  at(g, 150, 640, 640, 640, 1, () => battleMenu(g, { cursor: 1, press: 1, t: T, submenu: { p: 1, sel: 0.3 } }));
  at(g, 150, 640, 640, 380, 1, () => battleMenu(g, { cursor: 0, locked: 1, t: T }));
  at(g, 150, 640, 150, 380, 1, () => battleMenu(g, { cursor: 1.5, t: T }));
  label(g, 'cursor 1.5（滑动中）', 160, 600, 18); label(g, 'locked（变灰 + 小锁）', 650, 600, 18); label(g, 'cursor 0 · blink', 160, 860, 18); label(g, '技能 press + 子菜单「名字之剑」', 650, 860, 18);
  turnBanner(g, { text: TXT.heroTurn, x: 1500, y: 170, t: T });
  turnBanner(g, { text: TXT.enemyTurn, x: 1500, y: 290, t: T });
  turnBanner(g, { text: TXT.enemyTurn, textFrom: TXT.heroTurn, flip: 0.75, x: 1500, y: 400, t: T });
  turnBanner(g, { text: TXT.victory, x: 1440, y: 520, t: T });
  damageNumber(g, { text: '-999', x: 1620, y: 735, p: 0.3, label: TXT.crit });
  damageNumber(g, { text: 'HP 1', x: 1250, y: 850, p: 0.35, size: 80 });
  damageNumber(g, { text: 'EXP +9999', x: 1640, y: 870, p: 0.35, size: 64, color: 'gold' });
  damageNumber(g, { text: '-8', x: 1420, y: 870, p: 0.3, size: 40 });
  vsBadge(g, { x: 230, y: 230, size: 150, t: T });
  enemyPlate(g, { x: 640, y: 200, ropeTop: 110, t: T });
  lvUpBadge(g, { x: 1040, y: 220, p: 1, t: T });
  lvUpBadge(g, { x: 1180, y: 250, p: 1, s: 0.7, t: T });
  lvUpBadge(g, { x: 1270, y: 270, p: 0.45, s: 0.55, t: T });
  limit900(g);
}

// ———————————————————— 页 6：HUD / 经验条 / 计数牌 ————————————————————
function pageHUD(g, T) {
  g.fillStyle = mixHex(PAL.skyDayLow, PAL.meadow, 0.25); g.fillRect(0, 0, 1920, 1080);
  label(g, 'drawHUD（左上 x 96–600、y 72–232）· expBarBig · coinCounter', 660, 46, 32, PAL.ink);
  label(g, 'state = journey.hudState(T)：show / lv / nameReveal / hearts / coins / bag / exp；小地图另由 map.drawMiniMap 画', 660, 84, 20, PAL.inkSoft);
  drawHUD(g, { show: 1, lv: 1, nameReveal: 6, hearts: 5, coins: 0, bag: 0, exp: 0.15, t: T });
  at(g, 0, 0, 0, 220, 1, () => drawHUD(g, { show: 1, lv: 4, nameReveal: 9, hearts: 1.5, coins: 12, bag: 3, exp: 0.6, t: T }));
  at(g, 0, 0, 0, 440, 1, () => drawHUD(g, { show: 1, lv: 2, nameReveal: 7, hearts: 3, coins: 7, coinFlipAt: [0, 0.1, 0.2, 0.3, 0.4, 0.5, T - 0.06], bag: 1, exp: { v: 0.5, big: 0.5 }, t: T, revealAt: T - 0.05 }));
  at(g, 0, 0, 0, 660, 1, () => drawHUD(g, { show: 0.6, lv: 1, nameReveal: 6, hearts: 5, coins: 0, t: T }));
  label(g, 'LV1 · 6 字 · 5 心 · ×0', 620, 160, 19); label(g, 'LV4 · 9 字 · 1.5 心（最后一颗闪红）· ×12 · 背包 3', 620, 380, 19);
  label(g, '翻页中 · 新字弹入 · exp 已弹出一半', 620, 600, 19); label(g, 'show 0.6（滑入中）', 620, 820, 19);
  const eb = expBarBig(g, { fill: 0.42, lv: 2, t: T });
  snail(g, eb.snail[0], eb.snail[1]);
  label(g, 'expBarBig x 560–1360、y 140–170（蜗牛由 monsters.drawSnail 画在 snail 锚点）', 900, 230, 18);
  expBarBig(g, { fill: 0.42, lv: 2, k: 0.5, t: T, rect: { x: 980, y: 300, w: 800, h: 30 } });
  label(g, 'k 0.5（从 HUD 小条弹出中）', 1100, 360, 18);
  coinCounter(g, { x: 1000, y: 470, value: 0, t: T, size: 40 });
  coinCounter(g, { x: 1200, y: 470, flipAt: [0, 0.2, T - 0.05], t: T, size: 40 });
  coinCounter(g, { x: 1400, y: 470, value: 12, t: T, size: 40, bounceAt: T - 0.08 });
  label(g, '×0', 1000, 530, 18, PAL.inkSoft, 'latin'); label(g, '翻页中', 1200, 530, 18); label(g, '×12 大弹 + 火花', 1400, 530, 18);
  limit900(g);
}

// ———————————————————— 页 7：道具栏 / 角色卡 ————————————————————
function pageItems(g, T) {
  g.fillStyle = mixHex(PAL.dragonDeep, PAL.ink, 0.2); g.fillRect(0, 0, 1920, 1080);
  label(g, 'itemBar（x 880–1720、y 200–560）· characterCard 300×420', 48, 46, 32, PAL.paper);
  itemBar(g, { items: [{ kind: 'card', rarity: 2 }, { kind: 'violin', rarity: 3 }, { kind: 'eggtart', rarity: 2 }, { kind: 'soda', rarity: 3 }, { kind: 'marathon', rarity: 5, burst: 0.5 }], t: T });
  at(g, 880, 200, 60, 140, 0.5, () => itemBar(g, { items: [{ kind: 'card', rarity: 2 }, { kind: 'violin', rarity: 3, p: 0.5 }], t: T }));
  at(g, 880, 200, 60, 360, 0.5, () => { const r = itemBar(g, { items: [{ kind: 'card', rarity: 2 }, { kind: 'violin', rarity: 3 }, { kind: 'eggtart', rarity: 2 }, { kind: 'soda', rarity: 3 }, { kind: 'marathon', rarity: 5 }], burn: 0.45, t: T }); g.strokeStyle = PAL.fire2; g.lineWidth = 5; g.beginPath(); r.edge.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); });
  label(g, '入格中 p 0.5', 70, 340, 18, PAL.paper); label(g, 'burn 0.45（返回燃烧线，亮边交给 fx.burnEdge；此处黄线示意）', 70, 560, 18, PAL.paper);
  const cards = [
    { face: 'back' },
    { flip: 1, portrait: 'hero', nameStrip: charsOf('hero').join('') },
    { flip: 1, portrait: 'princess', nameStrip: TXT.unknown, extras: { scroll: true } },
    { flip: 1, portrait: 'dragon', silhouette: true, portraitBg: PAL.dragonDeep, nameStrip: TXT.unknown, extras: { lv: 'LV ??' } },
    { flip: 1, portrait: 'king', portraitBg: PAL.princessLight, nameStrip: TXT.king },
    { flip: 0.4, portrait: 'hero', nameStrip: TXT.king },
  ];
  cards.forEach((c, i) => characterCard(g, { x: 170 + i * 316, y: 820, s: 0.62, rot: (i - 2.5) * 0.02, t: T, ...c }));
  ['卡背（罗盘纹）', '勇者：全名绕到背面', '公主：？？？ + 小卷轴', '巨龙：剪影 + LV ??', '国王', '翻牌中 flip .4'].forEach((l, i) => label(g, l, 80 + i * 316, 1000, 18, PAL.paper));
}

// ———————————————————— 页 8：名签 / 头像 / 小尺寸 ————————————————————
function pageTags(g, T) {
  bg(g);
  title(g, 'nameTagSmall · portraitHead（默认 Q 版头像）· 小尺寸符号可读性', '头顶名签：「？？？」→ 全名从两头溢出；胸前名签「达拉崩吧」「米娅」');
  nameTagSmall(g, { x: 220, y: 200, text: TXT.unknown, t: T });
  nameTagSmall(g, { x: 760, y: 200, text: charsOf('hero').join(''), spill: 1, t: T });
  nameTagSmall(g, { x: 760, y: 330, text: charsOf('hero').join(''), spill: 0.4, t: T });
  nameTagSmall(g, { x: 220, y: 330, text: charsOf('hero').join(''), textFrom: TXT.unknown, flip: 0.3, t: T });
  nameTagSmall(g, { x: 1300, y: 220, kind: 'chest', text: charsOf('heroShort').join(''), size: 52 });
  nameTagSmall(g, { x: 1640, y: 220, kind: 'chest', text: charsOf('princessShort').join(''), size: 52 });
  label(g, 'head ？？？', 160, 270, 18); label(g, 'head 全名 spill 1', 700, 270, 18); label(g, 'spill 0.4', 700, 400, 18); label(g, '翻牌中', 160, 400, 18);
  label(g, 'chest 52px', 1240, 300, 18); label(g, 'chest 52px', 1580, 300, 18);
  ['hero', 'king', 'princess', 'dragon', 'dragon', 'baby', 'unknown'].forEach((w, i) => {
    const x = 160 + i * 250, y = 560;
    g.fillStyle = rgba(PAL.paper2, 0.8); g.fill(rr(x - 110, y - 130, 220, 250, 18));
    portraitHead(g, w, x, y, 150, { t: T, silhouette: i === 4, expr: i === 0 ? 'smile' : undefined });
    label(g, i === 4 ? 'dragon 剪影' : w, x - 90, y + 140, 18, PAL.ink, 'latin');
  });
  ICON_NAMES.forEach((n, i) => { glyphIcon(g, n, 120 + i * 60, 800, 28, n === 'circledNum' ? { n: 2 } : {}); glyphIcon(g, n, 120 + i * 60, 870, 18, n === 'circledNum' ? { n: 3 } : {}); });
  label(g, '28px / 18px', 120, 930, 18);
  limit900(g);
}

// ———————————————————— 动态页 ————————————————————
function dynDialog(g, T, lt) {
  bg(g);
  title(g, '动态：dialogBox（2 秒循环）弹起 → 打字「名字？」→ 光标 → 翻牌换成勇者「？？？」→「咳咳」→ 逐字弹走', `lt ${lt.toFixed(2)}`);
  const pop = clamp(lt / 0.3), typed = clamp((lt - 0.3) / 0.45), flip = clamp((lt - 0.95) / 0.3);
  const t2 = clamp((lt - 1.3) / 0.25), er = clamp((lt - 1.7) / 0.28);
  dialogBox(g, { speaker: flip >= 0.5 ? 'hero' : 'king', from: 'king', tagFlip: flip, pop,
    text: flip < 0.5 ? '名字？' : '咳咳', typed: flip < 0.5 ? typed : t2, erase: flip < 0.5 ? 0 : er, cursor: true, t: T });
  thinkDots(g, { x: 700, y: 420, w: 240, h: 150, tail: [600, 560], pop: clamp((lt - 0.9) / 0.3), t: lt, at: [1.1, 1.3, 1.5] });
  bubble(g, { shape: 'round', x: 1420, y: 400, w: 340, h: 170, text: '再说一遍？', tail: [1520, 540], pop: clamp((lt - 0.2) / 0.25) });
  bubble(g, { shape: 'jagged', x: 1100, y: 250, w: 300, h: 160, text: '嗷——', tail: [1180, 380], pop: clamp((lt - 0.5) / 0.25), t: T });
  bubble(g, { shape: 'flame', x: 1500, y: 160, w: 300, h: 150, text: '不对！', tail: [1640, 260], pop: clamp((lt - 0.7) / 0.25), t: T });
  const n1 = clamp((lt - 0.2) / 1.4);
  at(g, 420, 690, 60, 170, 0.45, () => {
    const r = dialogBox(g, { speaker: 'hero', bulgeRight: n1 > 0.8 ? Math.sin((n1 - 0.8) * 20) * 0.5 + 0.8 : 0, tear: n1 > 0.92 ? (n1 - 0.92) / 0.08 : 0, t: T });
    glyphRow(g, HERO.slice(0, 8), r.textArea.x, 795, 120, { style: 'cut', pitch: 98, appear: HERO.slice(0, 8).map((_, i) => clamp(n1 * 9 - i)) });
  });
  label(g, 'N1：逐字弹进 → 右框鼓出 → 撕开', 70, 290, 18);
  limit900(g);
}

function dynPanel(g, T, lt) {
  bg(g);
  title(g, '动态：namePanel N2 压缩时间线（2 秒）按格 → 满格泛金 → 挤压 → 鼓气球 → 超限闪 → 左绳断甩下 → 格框崩飞 → 坠落', `lt ${lt.toFixed(2)}`);
  const u = lt / 2;
  const times = HERO.map((_, i) => 0.05 + i * 0.07);
  const tiles = HERO.map((ch, i) => ({ ch, p: clamp((lt - times[i]) / 0.12) }));
  const landed = tiles.filter((q) => q.p >= 0.6).length;
  const swingP = clamp((lt - 1.15) / 0.35);
  namePanel(g, {
    tiles, counter: landed, full: clamp((lt - 0.62) / 0.1) * (1 - clamp((lt - 0.72) / 0.2)),
    bulge: clamp((lt - 0.7) / 0.4), overTag: clamp((lt - 0.9) / 0.3),
    strings: { left: 1.15, right: 1.8 }, swing: 70 * (1 - Math.exp(-swingP * 4) * Math.cos(swingP * 9)),
    popFrames: Math.max(0, (lt - 1.5) / 0.4), drop: clamp((lt - 1.8) / 0.2), t: lt,
  });
  void u;
}

function dynHUD(g, T, lt) {
  g.fillStyle = mixHex(PAL.skyDayLow, PAL.meadow, 0.25); g.fillRect(0, 0, 1920, 1080);
  label(g, '动态：HUD 滑入 → 金币逐枚翻页 → 心逐颗裂开 → 经验条弹出 + 蜗牛爬 + LV UP 鼓起 → 露字弹入', 660, 46, 26, PAL.ink);
  label(g, `lt ${lt.toFixed(2)}`, 660, 84, 20, PAL.inkSoft, 'latin');
  const flips = Array.from({ length: 12 }, (_, i) => 0.3 + i * 0.05);
  const crack = [0.95, 1.05, 1.15, 1.25]; // hudState 写法：按时间先后的 4 次受伤，从右往左裂（5 → 4 → 3 → 2 → 1.5）
  const hearts = lt >= 1.6 ? 2 : [5, 4, 3, 2, 1.5][crack.filter((c) => lt >= c).length];
  const big = clamp((lt - 1.2) / 0.2) * (1 - clamp((lt - 1.85) / 0.15));
  const lv = lt < 1.6 ? 1 : 2;
  // 直接用 journey.hudState(T) 的字段名（coinAt / coinBounce / expBig / heartFlash / levelUpAt）
  drawHUD(g, { show: clamp(lt / 0.25), lv, nameReveal: lt < 1.6 ? 6 : 7, hearts, coins: flips.filter((f) => lt >= f).length, coinAt: flips, coinBounce: 0.95, crackAt: crack, bag: 0, exp: 0.3, expBig: big,
    heartFlash: lt >= 1.3 && lt < 1.6 ? 0.5 + 0.5 * Math.sin((lt - 1.25) * Math.PI * 4.4) : 0, levelUpAt: lt >= 1.6 ? 1.6 : null, t: lt });
  if (big > 0) { const eb = expBarBig(g, { fill: clamp((lt - 1.2) / 0.6), k: big, lv, t: lt }); if (eb) snail(g, eb.snail[0], eb.snail[1]); }
  lvUpBadge(g, { x: 960, y: 330, p: clamp((lt - 1.45) / 0.35), t: lt, alpha: 1 - clamp((lt - 1.9) / 0.1) });
  // 飞向计数牌的金币
  for (let i = 0; i < 12; i++) {
    const k = clamp((lt - (flips[i] - 0.25)) / 0.25);
    if (k <= 0 || k >= 1) continue;
    const x = 900 + (HUD_LAYOUT.coin[0] + 18 - 900) * k, y = 640 + (HUD_LAYOUT.coin[1] - 640) * k - Math.sin(k * Math.PI) * 220;
    glyphIcon(g, 'coin', x, y, 34, { spin: k * 9 });
  }
}

function dynTheater(g, T, lt) {
  g.fillStyle = mixHex(PAL.redDeep, PAL.ink, 0.25); g.fillRect(0, 0, 1920, 1080);
  g.fillStyle = PAL.redDark; g.fillRect(0, 0, 1920, 150);
  label(g, '动态：名字牌吊下 + 走马灯（勇者 active → cracked；巨龙 hit → angry）· 菜单光标 / 按下 / 上锁 / 解锁 / 子菜单 · 横幅翻牌 · -999', 40, 46, 22, PAL.paper);
  const u = lt / 2;
  marqueePlate(g, { side: 'hero', progress: (u * 2) % 1, state: lt < 1 ? 'active' : 'cracked', hp: lt < 1 ? 0.9 : 0.02, hpLag: lt < 1 ? 0.9 : 0.4, hpText: lt < 1 ? 'HP 60' : 'HP 1', drop: clamp(lt / 0.25), t: T, beat: lt > 1 ? 1 : 0 });
  marqueePlate(g, { side: 'dragon', progress: (u * 2.4) % 1, state: lt < 1 ? 'hit' : 'angry', hp: 0.7, hpLag: lt < 0.8 ? 1 : 0.7, drop: clamp((lt - 0.06) / 0.25), t: T });
  turnBanner(g, { text: lt < 1 ? TXT.heroTurn : TXT.enemyTurn, textFrom: TXT.heroTurn, flip: clamp((lt - 0.9) / 0.25), drop: clamp(lt / 0.3), t: T });
  const cur = lt < 0.5 ? 0 : lt < 0.7 ? (lt - 0.5) / 0.2 : 1;
  battleMenu(g, { pop: clamp((lt - 0.05) / 0.2), cursor: cur, press: lt > 0.75 && lt < 0.95 ? 1 : 0, locked: clamp((lt - 1.0) / 0.15), lockPop: clamp((lt - 1.5) / 0.3), submenu: { p: clamp((lt - 1.65) / 0.25), sel: clamp((lt - 1.85) / 0.15) }, t: T });
  damageNumber(g, { text: '-999', x: 1350, y: 520, p: clamp((lt - 0.3) / 1.2), label: TXT.crit });
}

export default [
  { id: 'sheet_kit_icons', start: 0, end: 1, draw: (g, T) => pageIcons(g, T) },
  { id: 'sheet_kit_dialog', start: 1, end: 2, draw: (g, T) => pageDialog(g, T) },
  { id: 'sheet_kit_panel', start: 2, end: 3, draw: (g, T) => pagePanel(g, T) },
  { id: 'sheet_kit_plates', start: 3, end: 4, draw: (g, T) => pagePlates(g, T) },
  { id: 'sheet_kit_menu', start: 4, end: 5, draw: (g, T) => pageMenu(g, T) },
  { id: 'sheet_kit_hud', start: 5, end: 6, draw: (g, T) => pageHUD(g, T) },
  { id: 'sheet_kit_items', start: 6, end: 7, draw: (g, T) => pageItems(g, T) },
  { id: 'sheet_kit_tags', start: 7, end: 8, draw: (g, T) => pageTags(g, T) },
  { id: 'sheet_kit_dyn_dialog', start: 8, end: 10, draw: (g, T, lt) => dynDialog(g, T, lt) },
  { id: 'sheet_kit_dyn_panel', start: 10, end: 12, draw: (g, T, lt) => dynPanel(g, T, lt) },
  { id: 'sheet_kit_dyn_hud', start: 12, end: 14, draw: (g, T, lt) => dynHUD(g, T, lt) },
  { id: 'sheet_kit_dyn_theater', start: 14, end: 16, draw: (g, T, lt) => dynTheater(g, T, lt) },
];
