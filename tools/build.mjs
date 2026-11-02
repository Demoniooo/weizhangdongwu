// 打包成单文件 HTML：esbuild 打包全部模块 + 字体按实际用字子集化（woff2）后 base64 内嵌。
//   node tools/build.mjs [--out dist/达拉崩吧-纸艺MV.html]
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(root);
const argv = process.argv.slice(2);
const out = argv[argv.indexOf('--out') + 1] && argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'dist/dalabengba-mv.html';

// 1) 收集用字：src 下所有 js 里的字符（名字、界面字、片尾署名）
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
const chars = new Set();
for (const f of walk('src')) for (const ch of fs.readFileSync(f, 'utf8')) if (ch.codePointAt(0) > 32) chars.add(ch);
for (let c = 32; c < 127; c++) chars.add(String.fromCharCode(c));
fs.mkdirSync('out/build', { recursive: true });
fs.writeFileSync('out/build/chars.txt', [...chars].join(''));

// 2) 子集化字体
const pyft = process.env.HOME + '/Library/Python/3.9/bin/pyftsubset';
const FILES = ['ZCOOLQingKeHuangYou-Regular.ttf', 'ZCOOLKuaiLe-Regular.ttf', 'ZCOOLXiaoWei-Regular.ttf', 'Fredoka-Variable.ttf'];
const embed = {};
for (const f of FILES) {
  const dst = `out/build/${f.replace(/\.ttf$/, '.woff2')}`;
  execFileSync(pyft, [`assets/fonts/${f}`, `--text-file=out/build/chars.txt`, '--flavor=woff2', `--output-file=${dst}`, '--layout-features=*']);
  embed[f] = 'data:font/woff2;base64,' + fs.readFileSync(dst).toString('base64');
  console.log('font', f, (fs.statSync(dst).size / 1024).toFixed(0) + ' KB');
}

// 3) 打包（单文件入口：不含 sheet/only 调试功能）
const entry = 'out/build/entry.js';
fs.writeFileSync(entry, `
import b01 from '../../src/scenes/b01_book.js';
import b02 from '../../src/scenes/b02_dragon.js';
import b03 from '../../src/scenes/b03_oath.js';
import b04 from '../../src/scenes/b04_ask.js';
import b05 from '../../src/scenes/b05_names.js';
import b06 from '../../src/scenes/b06_title.js';
import b07 from '../../src/scenes/b07_journey1.js';
import b08 from '../../src/scenes/b08_journey2.js';
import b09 from '../../src/scenes/b09_cave.js';
import b10 from '../../src/scenes/b10_dragonname.js';
import b11 from '../../src/scenes/b11_battle.js';
import b12 from '../../src/scenes/b12_theater1.js';
import b13 from '../../src/scenes/b13_namesword.js';
import b14 from '../../src/scenes/b14_return.js';
import b15 from '../../src/scenes/b15_wedding.js';
import b16 from '../../src/scenes/b16_family.js';
import b17 from '../../src/scenes/b17_close.js';
globalThis.__STATIC_BLOCKS__ = [b01, b02, b03, b04, b05, b06, b07, b08, b09, b10, b11, b12, b13, b14, b15, b16, b17].map((b) => [].concat(b || []));
const { createEngine } = await import('../../src/core/engine.js');
const { loadFonts } = await import('../../src/core/fonts.js');
const { default: story } = await import('../../src/story.js');
const { startPlayer } = await import('../../src/ui/player.js');
await loadFonts();
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const engine = createEngine({ canvas, dpr: 1, story });
window.engine = engine;
startPlayer({ engine, canvas, story });
`);
const res = await build({ entryPoints: [entry], bundle: true, format: 'esm', minify: true, write: false, target: 'es2022', legalComments: 'none' });
const js = res.outputFiles[0].text;

// 4) 拼 HTML
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,"><title>达拉崩吧 · 纸艺 MV</title>
<style>html,body{margin:0;height:100%;background:#120c10;overflow:hidden}canvas{display:block}</style></head>
<body><script>globalThis.__EMBED_FONTS__=${JSON.stringify(embed)};</script>
<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('built', out, (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB', chars.size + ' chars');
