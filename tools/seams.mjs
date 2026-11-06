// 隐形接缝验收：对 src/scenes/_seams.js 里的每个接缝，渲染
//   A = 全片在 T−1/30（前一块最后一帧）、REF = drawSeam 参考画面在 T、B = 全片在 T（后一块第一帧），
// 计算 A↔REF、B↔REF、A↔B 的平均像素差（0..1，关掉胶片颗粒），并拼成一张 A | REF | B 对照图。
//   node tools/seams.mjs [--list "b04|b05,b05|b06"] [--out out/review/seams_check]
// 判读：差值 < 0.01 基本看不出；0.01–0.03 有轻微次级运动差；> 0.03 需要对齐。
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './server.mjs';
import { CHROME } from './chrome.mjs';

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; opt[k] = v; }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(root);
const outdir = opt.out || 'out/review/seams_check';
fs.mkdirSync(outdir, { recursive: true });

const { srv, port } = await startServer(root);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/?capture=1&dpr=1&nograin=1`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });

const keys = await page.evaluate(async () => {
  const m = await import('/src/scenes/_seams.js');
  window.__seams = m;
  return Object.entries(m.SEAMS).map(([k, v]) => ({ key: k, T: v.T }));
});
const want = opt.list ? String(opt.list).split(',') : null;
const ff = (args) => new Promise((res, rej) => { const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }); p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))); });

const rows = [];
for (const { key, T } of keys) {
  if (want && !want.includes(key)) continue;
  const safe = key.replace('|', '_');
  // 渲染一帧：mode 'film' 用全片，'ref' 用 drawSeam 参考实现；渲染后把下采样像素存进 window.__px[label]
  const grab = async (label, mode, t) => {
    await page.evaluate(([mode, t, label, key]) => {
      if (mode === 'ref') window.engine.renderProbe(t, (g, TT, lt, ctx) => window.__seams.drawSeam(g, TT, ctx, key));
      else window.renderFrame(t);
      const c = document.querySelector('canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const smp = [];
      for (let i = 0; i < d.length; i += 32) smp.push(d[i], d[i + 1], d[i + 2]);
      (window.__px ||= {})[label] = smp;
    }, [mode, t, label, key]);
    const f = path.join(outdir, `${safe}_${label}.png`);
    await page.screenshot({ path: f });
    return f;
  };
  const fA = await grab('A', 'film', T - 1 / 30);
  const fR = await grab('REF', 'ref', T);
  const fB = await grab('B', 'film', T);
  const d = await page.evaluate(() => {
    const P = window.__px, diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length / 255; };
    return { AR: diff(P.A, P.REF), BR: diff(P.B, P.REF), AB: diff(P.A, P.B) };
  });
  const active = await page.evaluate(([a, b]) => { window.renderFrame(a); const x = window.engine.ctx.active.join('+'); window.renderFrame(b); return [x, window.engine.ctx.active.join('+')]; }, [T - 1 / 30, T]);
  const combo = path.join(outdir, `${safe}.jpg`);
  await ff(['-i', fA, '-i', fR, '-i', fB, '-filter_complex', '[0:v]scale=640:-1[a];[1:v]scale=640:-1[r];[2:v]scale=640:-1[b];[a][r][b]hstack=inputs=3', '-q:v', '3', combo]);
  rows.push({ key, T, ...d, before: active[0], after: active[1], combo });
  const flag = (x) => (x < 0.01 ? 'ok ' : x < 0.03 ? 'minor' : 'ALIGN');
  console.log(`${key.padEnd(8)} T=${T.toFixed(2)}  A~REF ${d.AR.toFixed(4)} ${flag(d.AR)}  B~REF ${d.BR.toFixed(4)} ${flag(d.BR)}  A~B ${d.AB.toFixed(4)} ${flag(d.AB)}  [${active[0] || 'NO SHOT'} → ${active[1] || 'NO SHOT'}]  ${combo}`);
}
fs.writeFileSync(path.join(outdir, 'report.json'), JSON.stringify(rows, null, 1));
for (const e of [...new Set(errs)].slice(0, 10)) console.log('ERROR', e.slice(0, 200));
await browser.close();
srv.close();
