// 批量体检：一个浏览器依次加载每张资产模型图 / 每个场景块，在若干时刻渲染，汇总页面报错与空镜。
//   node tools/check.mjs sheets [--list hero,dragon] [--times 0.5,1.7]
//   node tools/check.mjs blocks [--list b01,b05] [--samples 6]      每块在 [start,end) 内均匀取 samples 个时刻
// 输出每项一行：OK / ERR n（附前 3 条报错）。退出码 = 出错项数（0 为全部通过）。
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './server.mjs';
import { CHROME } from './chrome.mjs';

const argv = process.argv.slice(2);
const mode = argv[0];
const opt = {};
for (let i = 1; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; opt[k] = v; }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

let items = [];
if (mode === 'sheets') {
  items = fs.readdirSync(path.join(root, 'src/sheets')).filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => f.slice(0, -3)).sort();
} else if (mode === 'blocks') {
  items = JSON.parse(fs.readFileSync(path.join(root, 'docs/blocks.json'), 'utf8')).map((b) => b.id);
} else {
  console.log('usage: node tools/check.mjs sheets|blocks [--list a,b] [--times ..] [--samples n]');
  process.exit(2);
}
if (opt.list) { const want = String(opt.list).split(','); items = items.filter((x) => want.includes(x)); }

const { srv, port } = await startServer(root);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
let errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const blocks = mode === 'blocks' ? JSON.parse(fs.readFileSync(path.join(root, 'docs/blocks.json'), 'utf8')) : [];

let bad = 0;
for (const it of items) {
  errs = [];
  const q = new URLSearchParams({ capture: '1', dpr: '1' });
  if (mode === 'sheets') q.set('sheet', it); else q.set('only', it);
  let times = [];
  let empty = 0;
  try {
    await page.goto(`http://127.0.0.1:${port}/?${q}`);
    await page.waitForFunction(() => window.ready === true || window.__failed, null, { timeout: 60000 });
    if (mode === 'sheets') {
      const dur = await page.evaluate(() => window.duration);
      const n = Number(opt.samples || 8);
      times = opt.times ? String(opt.times).split(',').map(Number) : Array.from({ length: n }, (_, i) => +(((i + 0.5) / n) * dur).toFixed(3));
    } else {
      const b = blocks.find((x) => x.id === it);
      const n = Number(opt.samples || 6);
      times = Array.from({ length: n }, (_, i) => +(b.start + ((i + 0.5) / n) * (b.end - b.start)).toFixed(3));
    }
    for (const t of times) {
      const active = await page.evaluate((x) => { window.renderFrame(x); return window.engine.ctx.active.length; }, t);
      if (active === 0) empty++;
    }
  } catch (e) {
    errs.push('LOAD/RUN: ' + e.message.split('\n')[0]);
  }
  const uniq = [...new Set(errs)];
  const status = uniq.length ? `ERR ${uniq.length}` : empty ? `EMPTY ${empty}/${times.length}` : 'OK';
  if (uniq.length || empty) bad++;
  console.log(`${it.padEnd(18)} ${status.padEnd(10)} t=[${times.map((x) => x.toFixed(2)).join(',')}]`);
  for (const e of uniq.slice(0, 3)) console.log('    ' + e.slice(0, 220));
}
await browser.close();
srv.close();
console.log(`${items.length - bad}/${items.length} clean`);
process.exit(bad);
