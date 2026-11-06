// 预览播放器：播放/暂停、拖动、载入音频、版本对齐预设、跳到提示点（基础功能与快捷键保持不变）。
// 升级：① LRC 字幕（用户自备，画在字幕带 y ≥ 920，白字描边；不内置任何歌词）
//      ② 打点对齐（T）：边听边按空格，逐个记录下一个提示点的真实时间 → 应用为 warp，存本机（localStorage），可导出 / 导入 JSON
//      ③ 清晰度（dpr 1 / 1.5 / 2）④ 音画偏移微调（±0.05s）⑤ S 调试时间戳
// 快捷键：空格 播放/暂停 · ←/→ ±1 秒（Shift ±5）· [ / ] 上/下一个提示点 · H 隐藏界面 · F 全屏 · S 时间戳
//        T 打点对齐 · Q 清晰度 · - / = 音画偏移 ∓0.05s（0 归零）· C 字幕开关 · P 播放/暂停 · ? 帮助
// 时间约定：音频文件时间 a = audio.currentTime；画面时间（真实秒）x = a + 偏移；默认秒 T = warp.toDefault(x)。
//          打点记录的是音频文件时间 a（与偏移无关，可移植）；LRC 时间也按音频文件时间显示。
import { CUE_LIST, CUES, PRESETS, makeWarp } from '../cues.js';
import { createEngine } from '../core/engine.js';
import { PAL } from '../core/paper.js';
import { rgba } from '../core/util.js';

const LS_PREFS = 'dalabengba-mv/player', LS_TAP = 'dalabengba-mv/warp-tap';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const DPRS = [1, 1.5, 2];
const SUB_FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei",sans-serif';
const MONO = 'Menlo, "SF Mono", Consolas, monospace';
/** 打点顺序：除 intro（=0）以外的全部提示点，按时间。 */
const TAP_SEQ = CUE_LIST.map((q) => q[0]).filter((id) => id !== 'intro');
const LABEL = Object.fromEntries(CUE_LIST.map((q) => [q[0], q[2]]));

/**
 * 解析 LRC：返回按时间排序的 [{ t, lines:[...] }]；同一时刻的几行合并（双语歌词）。
 * 支持 [offset:±毫秒]（正值让歌词提前）、一行多个时间戳、[mm:ss:xx] 写法、增强型 <mm:ss.xx> 逐字时间（去掉）。空文本行 = 清屏。
 */
export function parseLRC(text) {
  const rows = [];
  let offMs = 0;
  const tsRe = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
  for (const raw of String(text).replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const om = line.match(/^\[offset:\s*([+-]?\d+)\s*\]/i);
    if (om) { offMs = Number(om[1]); continue; }
    const stamps = [];
    let m, last = 0;
    tsRe.lastIndex = 0;
    while ((m = tsRe.exec(line)) && m.index === last) {
      stamps.push(Number(m[1]) * 60 + Number(m[2].replace(':', '.')));
      last = tsRe.lastIndex;
    }
    if (!stamps.length) continue;
    const txt = line.slice(last).replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '').trim();
    for (const t of stamps) rows.push({ t, text: txt });
  }
  for (const r of rows) r.t = Math.max(0, r.t - offMs / 1000);
  rows.sort((a, b) => a.t - b.t);
  const items = [];
  for (const r of rows) {
    const prev = items[items.length - 1];
    if (prev && Math.abs(prev.t - r.t) < 1e-3) { if (r.text) prev.lines.push(r.text); }
    else items.push({ t: r.t, lines: r.text ? [r.text] : [] });
  }
  return items;
}

/**
 * 合并锚点：base 是原有锚点，marks 是新打的点（优先）。补 intro = 0；按默认秒排序后去掉与新点冲突（真实秒不递增）的旧点。
 * 返回 {cueId: 真实秒}。
 */
export function mergeAnchors(base = {}, marks = {}) {
  const all = { ...base, ...marks };
  if (all.intro === undefined) all.intro = 0;
  const items = Object.entries(all)
    .filter(([id, r]) => CUES[id] !== undefined && Number.isFinite(Number(r)))
    .map(([id, r]) => ({ id, r: Number(r), d: CUES[id], fixed: id in marks }))
    .sort((a, b) => a.d - b.d);
  const kept = [];
  for (const it of items) {
    const top = kept[kept.length - 1];
    if (!top || it.r > top.r + 0.01) { kept.push(it); continue; }
    if (!it.fixed) continue;
    while (kept.length && !kept[kept.length - 1].fixed && kept[kept.length - 1].r >= it.r - 0.01) kept.pop();
    const t2 = kept[kept.length - 1];
    if (!t2 || it.r > t2.r + 0.01) kept.push(it);
  }
  return Object.fromEntries(kept.map((k) => [k.id, +k.r.toFixed(3)]));
}

/** 文本文件：先按 UTF-8 严格解码，失败再按 GB18030（很多中文 LRC 是 GBK）。 */
async function readText(f) {
  const buf = await f.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { /* 不是 UTF-8 */ }
  try { return new TextDecoder('gb18030').decode(buf); } catch { return new TextDecoder().decode(buf); }
}

export function startPlayer({ engine, canvas, story }) {
  let eng = engine;
  const params = new URLSearchParams(location.search);
  const stampArg = params.has('stamp');

  // —— 样式与界面 ——
  const css = document.createElement('style');
  css.textContent = `
  .mv-wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
  .mv-bar{position:fixed;left:0;right:0;bottom:0;display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));
    background:linear-gradient(transparent,rgba(18,12,16,.92) 40%);color:#f6edda;font:13px/1.3 -apple-system,"PingFang SC",sans-serif;transition:opacity .25s;z-index:3}
  .mv-bar.hide,.mv-bar.idle{opacity:0;pointer-events:none}
  body.mv-idle{cursor:none}
  .mv-bar button,.mv-bar select,.mv-bar label{background:#2c2233;color:#f6edda;border:1px solid #56495e;border-radius:6px;padding:5px 8px;font:inherit;cursor:pointer}
  .mv-bar button:hover,.mv-bar label:hover{border-color:#f2b634}
  .mv-bar button.on{border-color:#f2b634;color:#ffe28e}
  .mv-bar input[type=range]{flex:1 1 180px;min-width:120px;accent-color:#f2b634}
  .mv-bar select[data-k=preset]{max-width:210px;text-overflow:ellipsis}
  .mv-time{font-variant-numeric:tabular-nums;min-width:12ch}
  .mv-cue{color:#f2b634;min-width:14ch}
  .mv-grp{display:inline-flex;align-items:center;gap:4px}
  .mv-grp .mv-val{font-variant-numeric:tabular-nums;min-width:7.5ch;text-align:center;cursor:pointer}
  .mv-toast{position:fixed;left:50%;top:18px;transform:translate(-50%,-8px);background:rgba(44,34,51,.94);color:#f6edda;border:1px solid #f2b634;border-radius:8px;
    padding:8px 14px;font:14px/1.4 -apple-system,"PingFang SC",sans-serif;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:5;max-width:80vw}
  .mv-toast.show{opacity:1;transform:translate(-50%,0)}
  .mv-tap{position:fixed;right:16px;top:16px;width:min(420px,calc(100vw - 32px));background:rgba(28,20,28,.9);color:#f6edda;border:1px solid #f2b634;border-radius:10px;
    padding:12px 14px;font:13px/1.45 -apple-system,"PingFang SC",sans-serif;z-index:4;box-shadow:0 6px 24px rgba(0,0,0,.35)}
  .mv-tap h3{margin:0 0 6px;font-size:15px;color:#ffe28e;display:flex;justify-content:space-between}
  .mv-tap .next{font-size:20px;margin:4px 0}
  .mv-tap .next b{color:#f2b634;margin-right:8px;font-variant-numeric:tabular-nums}
  .mv-tap .eta{color:#cdbfa6;font-variant-numeric:tabular-nums}
  .mv-tap .bar{height:6px;background:#3b2f3f;border-radius:3px;margin:6px 0 8px;overflow:hidden}
  .mv-tap .bar i{display:block;height:100%;width:0;background:#f2b634}
  .mv-tap .log{color:#cdbfa6;font-variant-numeric:tabular-nums;min-height:1.4em}
  .mv-tap .keys{margin-top:6px;color:#9d8fa3;font-size:12px}
  .mv-tap.hit{border-color:#ffe28e;box-shadow:0 0 0 3px rgba(242,182,52,.45)}
  .mv-help{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(18,12,16,.6);z-index:6}
  .mv-help[hidden],.mv-tap[hidden]{display:none}
  .mv-help>div{background:#2c2233;color:#f6edda;border:1px solid #56495e;border-radius:12px;padding:18px 22px;max-width:min(620px,92vw);font:14px/1.6 -apple-system,"PingFang SC",sans-serif}
  .mv-help h3{margin:0 0 8px;color:#ffe28e}
  .mv-help table{border-collapse:collapse}
  .mv-help td{padding:2px 14px 2px 0;vertical-align:top}
  .mv-help td:first-child{color:#f2b634;white-space:nowrap}
  .mv-help p{margin:10px 0 0;color:#cdbfa6;font-size:13px}`;
  document.head.appendChild(css);
  const wrap = document.createElement('div');
  wrap.className = 'mv-wrap';
  canvas.parentNode.insertBefore(wrap, canvas);
  wrap.appendChild(canvas);
  const fit = () => {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    canvas.style.width = `${1920 * s}px`; canvas.style.height = `${1080 * s}px`;
  };
  addEventListener('resize', fit); fit();

  const bar = document.createElement('div');
  bar.className = 'mv-bar';
  bar.innerHTML = `
    <button data-k="play">▶ 播放</button>
    <span class="mv-time">00:00.00</span>
    <input type="range" min="0" max="1000" value="0" step="0.1">
    <span class="mv-cue"></span>
    <select data-k="preset" title="音频版本（对齐预设）">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('')}</select>
    <label title="载入音频（也可以直接把文件拖进窗口）">载入音频<input data-k="audio" type="file" accept="audio/*" hidden></label>
    <label title="载入 LRC 字幕（用户自备歌词）">载入字幕<input data-k="lrc" type="file" accept=".lrc,.txt,text/plain" hidden></label>
    <button data-k="subs" title="字幕开关（C）">字幕</button>
    <span class="mv-grp" title="音画偏移：+ 画面提前，− 画面推后（蓝牙耳机一般调成负的）；点数值归零">
      <button data-k="offdn">−</button><span class="mv-val" data-k="off">偏移 +0.00s</span><button data-k="offup">+</button></span>
    <select data-k="dpr" title="清晰度（Q）">${DPRS.map((d) => `<option value="${d}">清晰度 ${d}x</option>`).join('')}</select>
    <button data-k="tap" title="打点对齐（T）：放音频，听到每个提示点时按空格">打点 T</button>
    <button data-k="export" title="导出当前对齐（JSON）">导出</button>
    <label title="导入对齐 JSON（打点导出的文件）">导入<input data-k="import" type="file" accept=".json,application/json" hidden></label>
    <button data-k="hide" title="隐藏界面（H）；播放时鼠标不动 2.5 秒也会自动隐藏">隐藏 H</button>
    <button data-k="help" title="快捷键（?）">?</button>`;
  document.body.appendChild(bar);
  const $ = (s) => bar.querySelector(s);
  const btn = $('[data-k=play]'), time = $('.mv-time'), range = $('input[type=range]'), cueEl = $('.mv-cue');
  const presetSel = $('[data-k=preset]'), dprSel = $('[data-k=dpr]'), subsBtn = $('[data-k=subs]'), offEl = $('[data-k=off]');

  const toastEl = document.createElement('div');
  toastEl.className = 'mv-toast';
  document.body.appendChild(toastEl);
  let toastTimer = 0;
  const toast = (msg, ms = 2200) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  };

  const tapEl = document.createElement('div');
  tapEl.className = 'mv-tap';
  tapEl.hidden = true;
  tapEl.innerHTML = `<h3><span>打点对齐</span><span class="cnt"></span></h3>
    <div class="next"><b></b><span></span></div>
    <div class="eta"></div><div class="bar"><i></i></div>
    <div class="log"></div>
    <div class="keys">空格 记录 · ⌫ 撤销 · N 跳过 · P 暂停 · ←/→ 回退重打 · Enter 或 T 完成并应用 · Esc 放弃</div>`;
  document.body.appendChild(tapEl);

  const helpEl = document.createElement('div');
  helpEl.className = 'mv-help';
  helpEl.hidden = true;
  helpEl.innerHTML = `<div><h3>快捷键</h3><table>
    <tr><td>空格 / P</td><td>播放 / 暂停（打点时空格 = 记录）</td></tr>
    <tr><td>← / →</td><td>后退 / 前进 1 秒（Shift 5 秒）</td></tr>
    <tr><td>[ / ]</td><td>上一个 / 下一个提示点</td></tr>
    <tr><td>T</td><td>打点对齐：放音频，听到每一句开头按空格；Enter 或 T 完成，应用并存在本机</td></tr>
    <tr><td>- / = / 0</td><td>音画偏移 −0.05s / +0.05s / 归零（+ 画面提前）</td></tr>
    <tr><td>Q</td><td>清晰度 1x → 1.5x → 2x</td></tr>
    <tr><td>C</td><td>字幕开关（先“载入字幕”选你的 .lrc）</td></tr>
    <tr><td>S</td><td>调试时间戳（真实秒 / 默认秒 / 提示点 / 镜头）</td></tr>
    <tr><td>H / F</td><td>隐藏界面 / 全屏（播放时鼠标 2.5 秒不动，界面自动隐藏）</td></tr></table>
    <p>音频、.lrc、对齐 .json 都可以直接拖进窗口。字幕与打点只存在这台电脑的浏览器里；“导出打点”得到 JSON，可发给别人“导入打点”。</p></div>`;
  helpEl.onclick = () => { helpEl.hidden = true; };
  document.body.appendChild(helpEl);

  // —— 状态 ——
  const saved = store.get(LS_PREFS, {}) || {};
  const prefs = { preset: 'original', dpr: 1, offset: 0, subs: true, ...saved };
  const audio = new Audio();
  let playing = false, t = 0, t0 = 0, p0 = 0, hasAudio = false, audioName = '', lastA = 0;
  let offset = Number(prefs.offset) || 0;
  let subs = [], subsOn = prefs.subs !== false, subsName = '';
  let stampOn = false;
  let presetKey = 'original', anchors = {};
  const tap = { on: false, base: {}, marks: {}, order: [], i: 0, hitAt: 0 };

  const savePrefs = () => store.set(LS_PREFS, { preset: presetKey, dpr: eng.ctx.dpr, offset, subs: subsOn });
  const tapSaved = () => { const v = store.get(LS_TAP, null); return v && v.anchors && typeof v.anchors === 'object' ? v : null; };
  const ensureTapOption = () => {
    const v = tapSaved();
    let opt = presetSel.querySelector('option[value=tap]');
    if (!v) { if (opt) opt.remove(); return; }
    if (!opt) { opt = document.createElement('option'); opt.value = 'tap'; presetSel.appendChild(opt); }
    opt.textContent = `自定义打点（${Object.keys(v.anchors).length} 个锚点${v.audio ? ' · ' + v.audio : ''}）`;
  };
  const anchorsOf = (key) => (key === 'tap' ? (tapSaved() || { anchors: {} }).anchors : (PRESETS[key] || PRESETS.original).anchors);
  const applyPreset = (key, quiet) => {
    if (key === 'tap' && !tapSaved()) key = 'original';
    presetKey = PRESETS[key] || key === 'tap' ? key : 'original';
    anchors = { ...anchorsOf(presetKey) };
    eng.setWarp(anchors);
    presetSel.value = presetKey;
    savePrefs();
    if (!quiet) toast(`对齐：${presetSel.selectedOptions[0] ? presetSel.selectedOptions[0].textContent : presetKey}`);
  };

  // —— 时钟 ——
  const dur = () => eng.duration;
  const audioTime = (x) => x - offset;
  const now = () => {
    if (hasAudio) {
      let a = audio.currentTime;
      if (playing && a < lastA && lastA - a < 0.05) a = lastA; // 抹掉 currentTime 的小回跳
      lastA = a;
      return a + offset;
    }
    return playing ? p0 + (performance.now() - t0) / 1000 : p0;
  };
  const seek = (x) => {
    x = Math.max(0, Math.min(dur(), x));
    p0 = x; t0 = performance.now();
    if (hasAudio) { const a = Math.max(0, x - offset); audio.currentTime = a; lastA = a; }
    if (tap.on) tapResync(audioTime(x));
    draw(x);
  };
  const setPlay = (on) => {
    if (on && t >= dur() - 0.01) seek(0);
    playing = on;
    btn.textContent = on ? '❚❚ 暂停' : '▶ 播放';
    p0 = t; t0 = performance.now();
    if (hasAudio) {
      if (on) { const pr = audio.play(); if (pr && pr.catch) pr.catch((e) => { toast('音频无法播放：' + e.message); setPlay(false); }); }
      else audio.pause();
    }
  };
  const fmt = (x) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${(x % 60).toFixed(2).padStart(5, '0')}`;
  const cueAt = (T) => { let c = CUE_LIST[0]; for (const q of CUE_LIST) if (q[1] <= T + 1e-6) c = q; return c; };

  // —— 画面上的叠加：字幕带、调试时间戳 ——
  function subAt(a) {
    if (!subs.length || a < subs[0].t) return null;
    let lo = 0, hi = subs.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (subs[mid].t <= a) lo = mid; else hi = mid - 1; }
    const it = subs[lo];
    if (!it.lines.length) return null;
    const end = Math.min(lo + 1 < subs.length ? subs[lo + 1].t : Infinity, it.t + 10);
    if (a >= end) return null;
    return { lines: it.lines, alpha: Math.min(1, (a - it.t) / 0.12, (end - a) / 0.15) };
  }
  function drawSubs(g, dpr, x) {
    const it = subsOn ? subAt(audioTime(x)) : null;
    if (!it || it.alpha <= 0) return;
    const n = it.lines.length;
    const size = Math.min(54, 136 / (1.22 * n)); // 整块高 ≤ 136px，落在 y 927–1063
    g.save();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalAlpha = it.alpha;
    g.font = `600 ${size}px ${SUB_FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.miterLimit = 2;
    it.lines.forEach((ln, i) => {
      const y = 995 + (i - (n - 1) / 2) * size * 1.22;
      const w = g.measureText(ln).width, sc = Math.min(1, 1680 / (w || 1));
      g.save();
      g.translate(960, y); g.scale(sc, sc);
      g.shadowColor = rgba(PAL.shadow, 0.35); g.shadowBlur = 8 * dpr; g.shadowOffsetY = 2 * dpr;
      g.strokeStyle = rgba(PAL.ink, 0.92); g.lineWidth = size * 0.2; g.strokeText(ln, 0, 0);
      g.shadowColor = 'transparent';
      g.fillStyle = PAL.white; g.fillText(ln, 0, 0);
      g.restore();
    });
    g.restore();
  }
  function drawStamp(g, dpr, x) {
    if (!stampOn) return;
    const T = eng.warp.toDefault(x), c = cueAt(T);
    const txt = `真实 ${x.toFixed(2)}  默认 ${T.toFixed(2)}  ${c[0]}  ${(eng.ctx.active || []).join(' + ')}`.slice(0, 90);
    g.save();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.font = `22px ${MONO}`;
    const w = g.measureText(txt).width;
    g.fillStyle = rgba(PAL.ink, 0.72); g.fillRect(16, 16, w + 28, 42);
    g.fillStyle = PAL.white; g.textBaseline = 'middle'; g.fillText(txt, 30, 38);
    g.restore();
  }

  function draw(x) {
    t = x;
    eng.render(x);
    const g = canvas.getContext('2d');
    drawSubs(g, eng.ctx.dpr, x);
    drawStamp(g, eng.ctx.dpr, x);
    time.textContent = fmt(x);
    range.value = String((x / dur()) * 1000);
    const c = cueAt(eng.warp.toDefault(x));
    cueEl.textContent = `${c[0]} · ${c[2]}`;
    if (tap.on) tapPanel(x);
  }
  // 播放时鼠标不动 2.5 秒，控制条与鼠标自动隐藏（不挡字幕带）；动一下鼠标就回来
  let lastMove = performance.now(), barHover = false;
  const wake = () => { lastMove = performance.now(); };
  addEventListener('mousemove', wake);
  addEventListener('pointerdown', wake);
  bar.addEventListener('mouseenter', () => { barHover = true; });
  bar.addEventListener('mouseleave', () => { barHover = false; });
  function loop() {
    const idle = playing && !barHover && performance.now() - lastMove > 2500;
    bar.classList.toggle('idle', idle);
    document.body.classList.toggle('mv-idle', idle);
    if (playing) {
      const x = now();
      if (x >= dur()) { setPlay(false); seek(dur()); if (tap.on) tapFinish(true); } else draw(x);
    }
    requestAnimationFrame(loop);
  }

  // —— 打点对齐 ——
  const tapWarp = () => makeWarp(mergeAnchors(tap.base, tap.marks));
  function tapEnter() {
    if (!hasAudio) { toast('先载入音频，再按 T 打点（打点记录的是音频里的真实时间）', 3200); return; }
    tap.on = true; tap.base = { ...anchors }; tap.marks = {}; tap.order = [];
    tapResync(audioTime(t));
    if (tap.i >= TAP_SEQ.length) { tap.on = false; toast('已经过了最后一个提示点，先往回拖再按 T'); return; }
    tapEl.hidden = false;
    if (!playing) setPlay(true);
    toast('打点开始：听到每一句开头按空格', 2000);
  }
  /** 拖动 / 回退后：丢掉音频时间 a 之后的点，指针指向 a 之后第一个提示点。 */
  function tapResync(a) {
    while (tap.order.length && tap.marks[tap.order[tap.order.length - 1]] > a - 0.02) delete tap.marks[tap.order.pop()];
    const w = tapWarp();
    let i = 0;
    while (i < TAP_SEQ.length && w.toReal(CUES[TAP_SEQ[i]]) <= a + 0.02) i++;
    tap.i = i;
    eng.setWarp(mergeAnchors(tap.base, tap.marks));
  }
  function tapRecord() {
    const id = TAP_SEQ[tap.i];
    if (!id) return;
    const a = hasAudio ? audio.currentTime : audioTime(now());
    tap.marks[id] = +a.toFixed(3);
    tap.order.push(id);
    tap.i++;
    tap.hitAt = performance.now();
    eng.setWarp(mergeAnchors(tap.base, tap.marks)); // 边打边预览
    if (id === 'END') tapFinish(true);
  }
  function tapUndo() {
    const id = tap.order.pop();
    if (!id) return;
    delete tap.marks[id];
    tap.i = TAP_SEQ.indexOf(id);
    eng.setWarp(mergeAnchors(tap.base, tap.marks));
    toast(`撤销 ${id}`, 1200);
  }
  function tapFinish(apply) {
    if (!tap.on) return;
    tap.on = false;
    tapEl.hidden = true;
    const n = tap.order.length;
    if (!apply || !n) { eng.setWarp(anchors); toast(n ? '已放弃本次打点' : '没有记录任何点，对齐不变'); return; }
    const merged = mergeAnchors(tap.base, tap.marks);
    const ok = store.set(LS_TAP, { anchors: merged, audio: audioName, saved: new Date().toISOString(), taps: n });
    if (!ok) toast('浏览器不允许本地存储：本次对齐只在这一页有效，记得导出 JSON', 3600);
    if (ok) { ensureTapOption(); applyPreset('tap', true); }
    else { presetKey = 'tap'; anchors = merged; eng.setWarp(anchors); }
    if (ok) toast(`已应用打点：本次 ${n} 个，共 ${Object.keys(merged).length} 个锚点（已存本机，可导出）`, 3200);
    draw(t);
  }
  function tapPanel(x) {
    const id = TAP_SEQ[tap.i];
    const a = audioTime(x);
    tapEl.querySelector('.cnt').textContent = `${tap.order.length} 个 · 第 ${Math.min(tap.i + 1, TAP_SEQ.length)} / ${TAP_SEQ.length}`;
    const nx = tapEl.querySelector('.next');
    nx.querySelector('b').textContent = id || '—';
    nx.querySelector('span').textContent = id ? LABEL[id] : '全部打完了，按 Enter 应用';
    const w = tapWarp();
    if (id) {
      const due = w.toReal(CUES[id]);
      const prevId = TAP_SEQ[tap.i - 1];
      const from = prevId ? (tap.marks[prevId] ?? w.toReal(CUES[prevId])) : 0;
      tapEl.querySelector('.eta').textContent = `预计 ${fmt(due)}（${due - a >= 0 ? '还有 ' + (due - a).toFixed(1) + 's' : '已过 ' + (a - due).toFixed(1) + 's'}）`;
      tapEl.querySelector('.bar i').style.width = `${Math.max(0, Math.min(1, (a - from) / Math.max(0.1, due - from))) * 100}%`;
    } else {
      tapEl.querySelector('.eta').textContent = '';
      tapEl.querySelector('.bar i').style.width = '100%';
    }
    tapEl.querySelector('.log').textContent = tap.order.slice(-3).reverse().map((k) => `${k} ${fmt(tap.marks[k])}`).join(' · ') || '还没有记录';
    tapEl.classList.toggle('hit', performance.now() - tap.hitAt < 160);
  }

  // —— 导出 / 导入 ——
  function exportWarp() {
    const data = {
      format: 'dalabengba-mv/warp', version: 1,
      label: presetKey === 'tap' ? '自定义打点' : (PRESETS[presetKey] || {}).label || presetKey,
      preset: presetKey, audio: audioName || null, offset, exported: new Date().toISOString(),
      durationReal: +makeWarp(anchors).duration.toFixed(3),
      anchors,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const el = document.createElement('a');
    const d = new Date(), p2 = (v) => String(v).padStart(2, '0');
    el.href = url;
    el.download = `dalabengba-warp-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.json`;
    document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`已导出 ${Object.keys(anchors).length} 个锚点`);
  }
  async function importWarp(f) {
    try {
      const obj = JSON.parse(await readText(f));
      const raw = obj && typeof obj.anchors === 'object' ? obj.anchors : obj;
      const merged = mergeAnchors({}, Object.fromEntries(Object.entries(raw || {}).filter(([id, v]) => CUES[id] !== undefined && Number.isFinite(Number(v)))));
      if (Object.keys(merged).length < 2) throw new Error('里面没有可用的锚点');
      if (!store.set(LS_TAP, { anchors: merged, audio: obj.audio || f.name, saved: new Date().toISOString(), imported: true })) {
        presetKey = 'tap'; anchors = merged; eng.setWarp(anchors); toast('已导入（浏览器不允许本地存储，刷新后会丢）', 3200); draw(t); return;
      }
      ensureTapOption();
      applyPreset('tap', true);
      toast(`已导入对齐：${Object.keys(merged).length} 个锚点`);
      draw(t);
    } catch (e) { toast('导入失败：' + e.message, 3200); }
  }

  // —— 音频 / 字幕 ——
  function loadAudio(f) {
    if (playing) setPlay(false);
    audio.src = URL.createObjectURL(f);
    audioName = f.name;
    hasAudio = true;
    audio.currentTime = Math.max(0, t - offset);
    lastA = audio.currentTime;
    toast(`音频：${f.name}`);
  }
  async function loadLrc(f) {
    try {
      const items = parseLRC(await readText(f));
      if (!items.length) throw new Error('没找到 [mm:ss.xx] 时间戳');
      subs = items; subsName = f.name; subsOn = true;
      subsBtn.classList.add('on');
      savePrefs();
      toast(`字幕：${f.name}（${items.filter((i) => i.lines.length).length} 句）`);
      draw(t);
    } catch (e) { toast('字幕载入失败：' + e.message, 3200); }
  }
  function loadAny(f) {
    const n = f.name.toLowerCase();
    if ((f.type || '').startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg|oga|opus|webm)$/.test(n)) loadAudio(f);
    else if (/\.(lrc|txt)$/.test(n)) loadLrc(f);
    else if (n.endsWith('.json')) importWarp(f);
    else toast(`不认识的文件：${f.name}`);
  }

  // —— 偏移 / 清晰度 / 字幕开关 ——
  function setOffset(v, quiet) {
    offset = Math.max(-5, Math.min(5, Math.round(v * 100) / 100));
    offEl.textContent = `偏移 ${offset >= 0 ? '+' : '−'}${Math.abs(offset).toFixed(2)}s`;
    savePrefs();
    if (!quiet) toast(`音画偏移 ${offset >= 0 ? '+' : '−'}${Math.abs(offset).toFixed(2)}s（${offset > 0 ? '画面提前' : offset < 0 ? '画面推后' : '归零'}）`, 1400);
    if (hasAudio) { p0 = audio.currentTime + offset; t0 = performance.now(); if (!playing) draw(Math.max(0, Math.min(dur(), p0))); }
    else if (!playing) draw(t);
  }
  function setDpr(d, quiet) {
    d = DPRS.includes(Number(d)) ? Number(d) : 1;
    dprSel.value = String(d);
    if (d === eng.ctx.dpr) return;
    if (!story) { toast('当前入口没有传 story，不能切清晰度'); dprSel.value = String(eng.ctx.dpr); return; }
    eng = createEngine({ canvas, dpr: d, story, stamp: stampArg });
    eng.setWarp(tap.on ? mergeAnchors(tap.base, tap.marks) : anchors);
    window.engine = eng;
    savePrefs();
    draw(t);
    if (!quiet) toast(`清晰度 ${d}x（画布 ${Math.round(1920 * d)}×${Math.round(1080 * d)}）`, 1600);
  }
  function setSubs(on) {
    subsOn = on;
    subsBtn.classList.toggle('on', on);
    savePrefs();
    if (!subs.length && on) toast('还没有字幕：点“载入字幕”选你的 .lrc（或拖进窗口）', 2600);
    else toast(on ? '字幕：开' : '字幕：关', 1000);
    if (!playing) draw(t);
  }

  // —— 事件 ——
  const blurAfter = (el, fn) => (e) => { fn(e); el.blur(); };
  btn.onclick = blurAfter(btn, () => setPlay(!playing));
  range.oninput = () => seek((Number(range.value) / 1000) * dur());
  range.onchange = () => range.blur();
  presetSel.onchange = () => { applyPreset(presetSel.value); seek(t); presetSel.blur(); };
  dprSel.onchange = () => { setDpr(Number(dprSel.value)); dprSel.blur(); };
  $('[data-k=audio]').onchange = (e) => { const f = e.target.files[0]; if (f) loadAudio(f); e.target.value = ''; };
  $('[data-k=lrc]').onchange = (e) => { const f = e.target.files[0]; if (f) loadLrc(f); e.target.value = ''; };
  $('[data-k=import]').onchange = (e) => { const f = e.target.files[0]; if (f) importWarp(f); e.target.value = ''; };
  subsBtn.onclick = blurAfter(subsBtn, () => setSubs(!subsOn));
  $('[data-k=offdn]').onclick = blurAfter($('[data-k=offdn]'), () => setOffset(offset - 0.05));
  $('[data-k=offup]').onclick = blurAfter($('[data-k=offup]'), () => setOffset(offset + 0.05));
  offEl.onclick = () => setOffset(0);
  $('[data-k=tap]').onclick = blurAfter($('[data-k=tap]'), () => (tap.on ? tapFinish(true) : tapEnter()));
  $('[data-k=export]').onclick = blurAfter($('[data-k=export]'), exportWarp);
  $('[data-k=hide]').onclick = blurAfter($('[data-k=hide]'), () => bar.classList.toggle('hide'));
  $('[data-k=help]').onclick = blurAfter($('[data-k=help]'), () => { helpEl.hidden = !helpEl.hidden; });
  audio.addEventListener('ended', () => { if (tap.on) tapFinish(true); if (playing) setPlay(false); });
  audio.addEventListener('error', () => { if (hasAudio) toast('这个音频文件浏览器解不了', 3000); });
  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', (e) => { e.preventDefault(); for (const f of e.dataTransfer.files) loadAny(f); });

  addEventListener('keydown', (e) => {
    const tg = e.target.tagName;
    if (tg === 'SELECT' || tg === 'TEXTAREA' || (tg === 'INPUT' && e.target.type !== 'range')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (tap.on) {
      if (k === ' ') { e.preventDefault(); tapRecord(); return; }
      if (k === 'Backspace') { e.preventDefault(); tapUndo(); return; }
      if (k === 'n' || k === 'N') { tapTapSkip(); return; }
      if (k === 'Enter' || k === 't' || k === 'T') { e.preventDefault(); tapFinish(true); return; }
      if (k === 'Escape') { tapFinish(false); return; }
    }
    if (k === ' ') { e.preventDefault(); setPlay(!playing); }
    else if (k === 'p' || k === 'P') setPlay(!playing);
    else if (k === 'ArrowRight') { e.preventDefault(); seek(t + (e.shiftKey ? 5 : 1)); }
    else if (k === 'ArrowLeft') { e.preventDefault(); seek(t - (e.shiftKey ? 5 : 1)); }
    else if (k === ']' || k === '[') {
      const T = eng.warp.toDefault(t);
      const list = CUE_LIST.map((q) => q[1]);
      const next = k === ']' ? list.find((x) => x > T + 0.05) : [...list].reverse().find((x) => x < T - 0.05);
      if (next !== undefined) seek(eng.warp.toReal(next));
    } else if (k === 'h' || k === 'H') bar.classList.toggle('hide');
    else if (k === 'f' || k === 'F') (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
    else if (k === 's' || k === 'S') { stampOn = !stampOn; if (!playing) draw(t); }
    else if (k === 't' || k === 'T') tapEnter();
    else if (k === 'q' || k === 'Q') setDpr(DPRS[(DPRS.indexOf(eng.ctx.dpr) + 1) % DPRS.length]);
    else if (k === '-' || k === '_') setOffset(offset - 0.05);
    else if (k === '=' || k === '+') setOffset(offset + 0.05);
    else if (k === '0') setOffset(0);
    else if (k === 'c' || k === 'C') setSubs(!subsOn);
    else if (k === '?' || k === '/') helpEl.hidden = !helpEl.hidden;
    else if (k === 'Escape') helpEl.hidden = true;
  });
  function tapTapSkip() { if (TAP_SEQ[tap.i]) { toast(`跳过 ${TAP_SEQ[tap.i]}（按前后的点插值）`, 1200); tap.i++; } }

  // —— 启动：恢复偏好（URL 参数优先）——
  ensureTapOption();
  subsBtn.classList.toggle('on', subsOn);
  setOffset(offset, true);
  if (params.get('preset') && PRESETS[params.get('preset')]) applyPreset(params.get('preset'), true);
  else applyPreset(prefs.preset || 'original', true);
  if (!params.has('dpr') && DPRS.includes(Number(prefs.dpr)) && Number(prefs.dpr) !== eng.ctx.dpr) setDpr(Number(prefs.dpr), true);
  dprSel.value = String(eng.ctx.dpr);

  window.seek = seek;
  window.player = {
    state: () => ({ t, playing, hasAudio, audioName, offset, dpr: eng.ctx.dpr, preset: presetKey, anchors: { ...anchors }, subs: subs.length, subsOn, subsName, stampOn, tap: { on: tap.on, i: tap.i, next: TAP_SEQ[tap.i], marks: { ...tap.marks } } }),
    loadLrcText: (text, name = 'lyrics.lrc') => { subs = parseLRC(text); subsName = name; subsOn = true; subsBtn.classList.add('on'); draw(t); return subs.length; },
    seek, setOffset, setDpr, parseLRC, mergeAnchors,
  };
  seek(Number(params.get('t') || 0));
  loop();
}
