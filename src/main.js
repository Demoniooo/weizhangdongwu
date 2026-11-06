// 入口：?capture=1 为逐帧渲染模式（供 tools/render.mjs 调用 window.renderFrame），否则启动播放器。
import { createEngine } from './core/engine.js';
import { loadFonts } from './core/fonts.js';
import { PRESETS } from './cues.js';
import fullStory from './story.js';

const params = new URLSearchParams(location.search);
const capture = params.has('capture');
const dpr = Number(params.get('dpr') || (capture ? window.devicePixelRatio || 1 : 1));
const samples = Number(params.get('samples') || 1);
const fps = Number(params.get('fps') || 30);

await loadFonts(globalThis.__FONT_BASE__ || '/assets/fonts/');

// ?sheet=<name> 只渲染 src/sheets/<name>.js（资产模型图/测试）；?only=b05,b06 只保留指定前缀的镜头（单块预览）
let story = fullStory;
const sheet = params.get('sheet');
if (sheet) {
  const mod = await import(`./sheets/${sheet}.js`);
  const shots = [].concat(mod.default);
  story = { duration: Math.max(...shots.map((s) => s.end)), shots, cuts: [] };
}
const only = params.get('only');
if (only) {
  const pre = only.split(',');
  story = { ...story, shots: story.shots.filter((s) => pre.some((p) => s.id.startsWith(p))) };
}
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const engine = createEngine({ canvas, dpr, story, stamp: params.has('stamp'), noGrain: params.has('nograin') });
const preset = params.get('preset');
if (preset && PRESETS[preset]) engine.setWarp(PRESETS[preset].anchors);

window.engine = engine;
window.duration = engine.duration;
window.renderFrame = (t) => engine.render(t, { samples, fps });

if (capture) {
  document.body.classList.add('capture');
  engine.render(0);
  window.ready = true;
} else {
  const { startPlayer } = await import('./ui/player.js');
  startPlayer({ engine, canvas, story });
  window.ready = true;
}
