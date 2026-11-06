// 连贯性体检：低分辨率逐帧渲染，找出“非计划跳变”（相邻帧差异突增）、空镜（NO SHOT）和报错。
//   node tools/pops.mjs --from 0 --to 208.1 [--fps 30] [--thresh 0.07] [--only b05] [--out out/review/pops.json]
// 输出：每个可疑时间点的差异值、前后激活镜头；位于 story.cuts（计划硬切）±1 帧内的跳变会标为 planned。
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './server.mjs';
import { CHROME } from './chrome.mjs';

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; opt[k] = v; }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fps = Number(opt.fps || 30), from = Number(opt.from || 0), to = Number(opt.to || 208.1), thresh = Number(opt.thresh || 0.07);

const { srv, port } = await startServer(root);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const q = new URLSearchParams({ capture: '1', dpr: '0.25', nograin: '1' });
if (opt.only) q.set('only', opt.only);
await page.goto(`http://127.0.0.1:${port}/?${q}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
const cuts = await page.evaluate(() => window.engine.ctx.story.cuts || []);

const res = await page.evaluate(({ from, to, fps }) => {
  const c = document.querySelector('canvas');
  const x = c.getContext('2d');
  let prev = null;
  const out = [];
  for (let f = Math.round(from * fps); f <= Math.round(to * fps); f++) {
    const t = f / fps;
    window.renderFrame(t);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let diff = 0;
    if (prev) { for (let i = 0; i < d.length; i += 16) diff += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]); diff /= (d.length / 16) * 3 * 255; }
    prev = d.slice();
    const T = window.engine.ctx.T;
    out.push({ t: +t.toFixed(3), T: +T.toFixed(3), diff: +diff.toFixed(4), active: window.engine.ctx.active.join('+') });
  }
  return out;
}, { from, to, fps });
await browser.close(); srv.close();

const flagged = [];
for (let i = 1; i < res.length; i++) {
  const r = res[i];
  const win = res.slice(Math.max(1, i - 15), Math.min(res.length, i + 16)).map((z) => z.diff).sort((a, b) => a - b);
  const med = win[Math.floor(win.length / 2)] || 0;
  const planned = cuts.some((c) => Math.abs(c - r.T) <= 1.5 / fps);
  const shotChange = res[i - 1].active !== r.active;
  if (r.diff > thresh && r.diff > med * 3) flagged.push({ t: r.t, T: r.T, diff: r.diff, median: +med.toFixed(4), planned, shotChange, before: res[i - 1].active, after: r.active });
}
const empty = res.filter((r) => !r.active).map((r) => r.t);
const report = { from, to, fps, thresh, frames: res.length, cuts, flagged, emptyFrames: empty.length ? [empty[0], empty[empty.length - 1], empty.length] : [], errors: [...new Set(errs)].slice(0, 20) };
if (opt.out) { fs.mkdirSync(path.dirname(opt.out), { recursive: true }); fs.writeFileSync(opt.out, JSON.stringify(report, null, 1)); }
console.log(`frames ${res.length}  flagged ${flagged.length} (unplanned ${flagged.filter((f) => !f.planned).length})  empty ${empty.length}  errors ${report.errors.length}`);
for (const f of flagged) console.log(`${f.planned ? 'planned ' : 'JUMP    '} t=${f.t.toFixed(2)} diff=${f.diff} (med ${f.median}) ${f.shotChange ? f.before + ' → ' + f.after : f.after}`);
if (empty.length) console.log('NO SHOT frames:', report.emptyFrames);
for (const e of report.errors) console.log('ERROR', e);
