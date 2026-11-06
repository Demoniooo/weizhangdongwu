// 逐帧确定性渲染（Playwright + 本机 Chrome for Testing）。
//   node tools/render.mjs stills --times 12.1,13.5 [--dpr 1] [--outdir out/stills] [--stamp] [--prefix b02_]
//   node tools/render.mjs sheet  --from 10 --to 18 --every 0.25 [--cols 6] [--tile 480] [--out out/sheet.jpg]
//   node tools/render.mjs cues   --from 41 --to 57 [--offset 0.12] [--cols 5] [--tile 384] [--only b05] [--out out/review/cues.jpg]
//                                每个 cue 后 offset 秒渲染一帧，左上角印 cue id 与画面提示，拼成联系表（检查每句歌词的画面）
//   通用：--sheet <name> 只渲染 src/sheets/<name>.js；--only b05,b06 只渲染这些前缀的镜头；--nograin 关掉胶片颗粒（逐像素对比用）
//   node tools/render.mjs video  [--fps 30] [--dpr 2] [--samples 1] [--workers 3] [--start 0] [--end 208.1]
//                                [--out out/dalabengba.mp4] [--prores] [--audio song.mp3] [--preset original]
// 所有时间都是“真实秒”（默认版本下与默认秒相同）。页面报错会原样打印（[pageerror] / [page]）。
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './server.mjs';

import { CHROME } from './chrome.mjs';
const argv = process.argv.slice(2);
const mode = argv[0];
const opt = {};
for (let i = 1; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; opt[k] = v; }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(root);

let errors = 0;
async function openPage(browser, port, dpr, extra = '') {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
  page.on('pageerror', (e) => { errors++; console.log('[pageerror]', e.message); });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { if (m.type() === 'error') errors++; console.log('[page]', m.text()); } });
  const q = new URLSearchParams({ capture: '1', dpr: String(dpr), fps: String(opt.fps || 30), samples: String(opt.samples || 1) });
  if (opt.preset) q.set('preset', opt.preset);
  if (opt.sheet) q.set('sheet', opt.sheet);
  if (opt.only) q.set('only', opt.only);
  if (opt.nograin) q.set('nograin', '1');
  await page.goto(`http://127.0.0.1:${port}/?${q}${extra}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
  return page;
}
const launch = () => chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const ff = (args) => spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
const waitProc = (p) => new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));

const { srv, port } = await startServer(root);
const t0 = Date.now();
try {
  if (mode === 'cues') {
    const { CUE_LIST } = await import('../src/cues.js');
    const a = Number(opt.from || 0), b = Number(opt.to || 208.1), off = Number(opt.offset ?? 0.12);
    const list = CUE_LIST.filter(([, t]) => t >= a - 1e-6 && t <= b + 1e-6);
    const outdir = `out/cue_frames_${process.pid}`;
    fs.mkdirSync(outdir, { recursive: true });
    const browser = await launch();
    const page = await openPage(browser, port, 1, '');
    let i = 0;
    for (const [id, t, label] of list) {
      await page.evaluate(({ x, tag }) => {
        window.renderFrame(x);
        const c = document.querySelector('canvas'), g = c.getContext('2d');
        const k = c.width / 1920;
        g.setTransform(k, 0, 0, k, 0, 0);
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, 1920, 70);
        g.fillStyle = '#ffe28e'; g.font = '44px "KuaiLe", sans-serif'; g.fillText(tag, 24, 52);
        g.fillStyle = '#fff'; g.font = '30px Menlo, monospace'; g.fillText(window.engine.ctx.active.join(' + ').slice(0, 48), 1000, 48);
      }, { x: t + off, tag: `${id} ${t.toFixed(2)}  ${label}` });
      await page.screenshot({ path: path.join(outdir, `${String(i++).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
    }
    await browser.close();
    const cols = Number(opt.cols || 5), tile = Number(opt.tile || 384), rows = Math.ceil(i / cols);
    const out = opt.out || 'out/review/cues.jpg';
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const p = ff(['-framerate', '1', '-i', path.join(outdir, '%04d.jpg'), '-vf', `scale=${tile}:-1,tile=${cols}x${rows}:padding=4:color=0x303030`, '-frames:v', '1', '-q:v', '3', out]);
    p.stdin.end(); await waitProc(p);
    fs.rmSync(outdir, { recursive: true, force: true });
    console.log('cues', out, `${i} cues`, errors ? `ERRORS ${errors}` : 'no page errors');
  } else if (mode === 'stills' || mode === 'sheet') {
    const dpr = Number(opt.dpr || 1);
    let times;
    if (mode === 'stills') times = String(opt.times).split(',').map(Number);
    else { const a = Number(opt.from || 0), b = Number(opt.to || 10), e = Number(opt.every || 0.5); times = []; for (let x = a; x <= b + 1e-9; x += e) times.push(+x.toFixed(3)); }
    const outdir = opt.outdir || (mode === 'sheet' ? `out/sheet_frames_${process.pid}` : 'out/stills');
    fs.mkdirSync(outdir, { recursive: true });
    const browser = await launch();
    const page = await openPage(browser, port, dpr, opt.stamp || mode === 'sheet' ? '&stamp=1' : '');
    const files = [];
    for (const t of times) {
      await page.evaluate((x) => window.renderFrame(x), t);
      const f = path.join(outdir, mode === 'sheet' ? `${String(files.length).padStart(4, '0')}.jpg` : `${opt.prefix || ''}t${t.toFixed(2)}.png`);
      await page.screenshot({ path: f, type: mode === 'sheet' ? 'jpeg' : 'png', quality: mode === 'sheet' ? 88 : undefined });
      files.push(f);
    }
    await browser.close();
    if (mode === 'sheet') {
      const cols = Number(opt.cols || 6), tile = Number(opt.tile || 480);
      const rows = Math.ceil(files.length / cols);
      const out = opt.out || 'out/sheet.jpg';
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const p = ff(['-framerate', '1', '-i', path.join(outdir, '%04d.jpg'), '-vf', `scale=${tile}:-1,tile=${cols}x${rows}:padding=4:color=0x303030`, '-frames:v', '1', '-q:v', '3', out]);
      p.stdin.end(); await waitProc(p);
      fs.rmSync(outdir, { recursive: true, force: true });
      console.log('sheet', out, `${files.length} frames`, errors ? `ERRORS ${errors}` : 'no page errors');
    } else console.log('stills', files.join(' '), errors ? `ERRORS ${errors}` : 'no page errors');
  } else if (mode === 'video') {
    const fps = Number(opt.fps || 30), dpr = Number(opt.dpr || 2), workers = Number(opt.workers || 3);
    const b0 = await launch();
    const probe = await openPage(b0, port, 1);
    const duration = await probe.evaluate(() => window.duration);
    await b0.close();
    const start = Number(opt.start || 0), end = Number(opt.end || duration);
    const f0 = Math.round(start * fps), f1 = Math.round(end * fps), total = f1 - f0;
    const tmp = `out/chunks_${process.pid}`; fs.mkdirSync(tmp, { recursive: true });
    const per = Math.ceil(total / workers);
    let done = 0;
    const jobs = [];
    for (let w = 0; w < workers; w++) {
      const a = f0 + w * per, b = Math.min(f1, a + per);
      if (a >= b) continue;
      const chunk = path.join(tmp, `c${w}.mov`);
      jobs.push((async () => {
        const browser = await launch();
        const page = await openPage(browser, port, dpr);
        const enc = ff(['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
          '-vf', 'scale=1920:1080:flags=lanczos,format=yuv422p10le', '-c:v', 'prores_ks', '-profile:v', '3', '-vendor', 'apl0', '-r', String(fps), chunk]);
        for (let f = a; f < b; f++) {
          await page.evaluate((x) => window.renderFrame(x), f / fps);
          const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
          if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
          done++;
          if (done % 150 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${total} frames  ${el.toFixed(0)}s  eta ${((el / done) * (total - done)).toFixed(0)}s`); }
        }
        enc.stdin.end(); await waitProc(enc);
        await browser.close();
        return chunk;
      })());
    }
    const chunks = await Promise.all(jobs);
    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, chunks.map((c) => `file '${path.resolve(c)}'`).join('\n'));
    const out = opt.out || 'out/dalabengba.mp4';
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const master = out.replace(/\.mp4$/, '_ProRes422HQ.mov');
    const audioArgs = opt.audio ? ['-i', String(opt.audio)] : [];
    let p = ff(['-f', 'concat', '-safe', '0', '-i', list, ...audioArgs, '-map', '0:v', ...(opt.audio ? ['-map', '1:a', '-c:a', 'pcm_s16le', '-shortest'] : []), '-c:v', 'copy', master]);
    p.stdin.end(); await waitProc(p);
    p = ff(['-i', master, '-map', '0:v', ...(opt.audio ? ['-map', '0:a', '-c:a', 'aac', '-b:a', '256k'] : []), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opt.crf || 16), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-g', String(fps * 2), '-movflags', '+faststart', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out]);
    p.stdin.end(); await waitProc(p);
    fs.rmSync(tmp, { recursive: true, force: true });
    if (!opt.prores) fs.unlinkSync(master);
    console.log('video', out, opt.prores ? master : '', `${((Date.now() - t0) / 1000).toFixed(0)}s`, errors ? `ERRORS ${errors}` : 'no page errors');
  } else {
    console.log('unknown mode', mode);
  }
} finally {
  srv.close();
}
