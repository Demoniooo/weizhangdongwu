# 引擎与绘图 API（给所有子任务）

项目根：`/Users/erapi0neer/dalabengba-mv`。浏览器 Canvas 2D，ES 模块，本地 http 服务加载。

## 1. 文件结构

```
index.html / src/main.js       入口（?capture=1 逐帧渲染模式；否则是播放器）
src/cues.js                    提示点表 CUES / cue(id) / NAMES / PRESETS / makeWarp（见 docs/cues.md）
src/story.js                   汇总 src/scenes/index.js 里各块的镜头
src/scenes/index.js            各块镜头文件的汇总（集成负责人维护，场景作者不要改）
src/scenes/<block>.js          一个块一个文件，默认导出镜头数组；块内私有辅助放 src/scenes/<block>/*.js
src/core/engine.js             调度 / 图层 / 遮罩 / 后期 / 运动模糊（W=1920, H=1080）
src/core/paper.js              PAL 调色板 + 纸艺路径与填充 + 渐变 + 光效
src/core/camera.js             多层视差机位、震动、漂移
src/core/particles.js          无状态粒子 burst / stream / field
src/core/fonts.js              字体 FONT / font(size, family, weight)
src/core/ease.js               缓动（outBack, outExpo, spring, glide, whip, snap, ez…）
src/core/util.js               clamp/lerp/seg/envelope/pulse/hit/hits/wobble/osc/squash/stepIndex/hash/noise/rgba/mixHex
src/rigs/*.js                  角色木偶（基础阶段产出）
src/env/*.js                   场景/背景（基础阶段产出）
src/props/*.js                 道具（基础阶段产出）
src/ui/kit.js, src/ui/type.js  纸艺 RPG 界面、名字排版（基础阶段产出）
tools/render.mjs               stills / sheet / video
tools/lint.sh                  语法 + 乱码 + 非确定性 API 检查（每次改完必须跑）
```

## 2. 镜头（shot）约定

```js
// src/scenes/b05_court.js
import { cue } from '../cues.js';
export default [
  {
    id: 'b05_court_wide',          // 块前缀_描述，全片唯一
    start: cue('L13') - 0.2,       // 默认秒，激活区间 [start, end)
    end: cue('L15'),
    z: 0,                          // 可选，越大越靠上（转场镜头给 z: 1）
    draw(g, T, lt, ctx) { ... },   // g 已是逻辑 1920×1080 坐标；T 默认秒；lt = T - start
  },
];
```

- **纯函数**：画面只由 T 决定。随机用 `hash1/hash2/mulberry32(固定种子)`，噪声用 `noise1/fbm1`。
- 每个镜头自己画满整屏（先铺背景）。多个镜头同时激活时按 z、再按顺序叠加。
- **转场由后一个镜头负责**：后镜头的 start 早于前镜头的 end（重叠），在重叠期内用 `ctx.mask` 做遮罩揭示或在最上层画擦屏物体；前镜头在重叠期内照常绘制（动作可以继续）。
- 出错时引擎会在画面上画红色错误条并在控制台报 `[shot id]`，渲染工具会打印 `[pageerror]/[page]` 并统计 ERRORS。

## 3. ctx（每帧）

| 字段 | 说明 |
|---|---|
| `ctx.W/H/dpr/T/t` | 画布逻辑尺寸、像素比、默认秒、真实秒 |
| `ctx.layer(g, o, fn)` | 离屏图层：`fn(lg)` 在新画布上画（逻辑坐标、已清空），再整体合成回 g。`o`: `shadow`(数字=纸片高度 px，或 `{blur,dx,dy,color}`)、`texture`(0..1 纸纹，**只作用于有内容处**)、`texOffset:[x,y]`(纸纹随层平移)、`tint:{color,alpha,mode}`(给整层叠色，如夜景压暗、剪影)、`alpha`、`blend`、`blur`(px，景深虚化) |
| `ctx.mask(g, maskFn, drawFn, o)` | 遮罩：`drawFn(lg)` 画内容，`maskFn(mg)` 只需 fill 出保留区域。`o`: `feather`(px 羽化)、`invert`(挖洞)、`alpha`、`blend` |
| `ctx.fx` | 整帧后期（每帧复位，镜头按需设置）：`shake:[x,y]` 震动、`zoom`(>=1 推近)、`rot` 滚转、`sat/bright/contrast/hue/blur` 调色、`tint/tintAlpha/tintMode` 整帧叠色、`flash/flashColor` 闪白、`fade/fadeColor` 淡出、`paper`(纸纹 0.22)、`vignette`(暗角 0.3)、`vignetteColor`、`grain`(0.045)、`letterbox`(0..1 宽银幕黑边)。多个镜头同时改时自行取 max/叠加 |
| `ctx.paperPattern(g)` | 纸纹图案（透明底），可当 fillStyle 用，配 `source-atop` 给单个形状加纹理 |

性能：图层每个约 1 次全屏合成；一帧 ≤ 8 个 `ctx.layer` 为宜。**避免逐形状 shadowBlur 大量堆叠**（纸片投影优先按图层给）；避免 `ctx.filter` 模糊用在大量小形状上。

## 4. paper.js

- `PAL`：全片调色板（纸 paper/paper2/kraft、墨 ink/inkSoft、皇家 red/redDark/gold/goldLight…、天空 skyDay/skyDusk/skyNight/skyDoom…、自然 meadow/grass/forest/stone/roof/water/snow/mountain…、角色 skin/heroBlue/scarf/heroHair/princess/hairGold/robe/ermine/beard/horse/mane/dragon/dragonBelly/dragonEye…、特效 fire/fire2/ember/moon/moonGlow/magic/crystal/slime/bat/coin/heart）。**只用这些颜色**，需要深浅变化用 `mixHex(a, b, t)` 或 `rgba(hex, a)`。
- 路径（返回 Path2D，可复用、可 translate 后画）：
  - `rr(x, y, w, h, r)` 圆角矩形
  - `blob(cx, cy, rx, ry, {seed, amp=0.025, n=56, rot, freq})` 手剪椭圆（边缘稳定不闪）
  - `poly(points, {seed, amp=1.6px, step=26, round=0..1, closed})` 手剪多边形
  - `smooth(points, {closed, tension})` 平滑闭合/开放曲线
  - `ribbon(points, widths|fn)` 粗细变化的条带（围巾、火舌、藤蔓、头发）
- 填充：`cut(g, path, fill, {shadow(纸片高度px), shadowAlpha, stroke, lw, rim(切口亮边色), rimW, alpha, blend})`；`shade(g, path, color, x0,y0,x1,y1, a0, a1)` 在形状内叠一层明暗渐变。投影/描边会自动乘当前缩放。
- 渐变：`lin(g, x0,y0,x1,y1, stops)`、`rad(g, x,y,r0,r1, stops)`；stops 为颜色数组或 `[[offset, color], ...]`。
- 光效：`glow(g, x,y,r, color, alpha, mode='screen')`、`rays(g, x,y,r, {n,width,rot,color,alpha,r0,seed})`、`sparkle(g, x,y,size, {rot,color,alpha})`、`line(g, pts, {seed,amp,lw,color,dash,p(生长0..1),alpha})`。

## 5. camera.js

- `cam(x=960, y=540, zoom=1, rot=0)`：机位（世界坐标，(960,540,1,0) 时与屏幕重合）。
- `applyCam(g, c, depth)`：在当前变换上叠加某深度图层的机位变换。depth 1 = 主体层；0.2–0.6 远景；1.2–1.6 前景。
- `toScreen(c, depth, x, y)`：世界坐标 → 屏幕坐标（让 UI/文字跟随角色）。
- `lerpCam(a, b, t)`、`shake(T, at, {amp, decay, freq, seed})`、`drift(T, {amp, speed, seed})`、`addv(...)`。

典型写法：
```js
const c = lerpCam(camA, camB, ez(T, t0, t1, glide));
ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => { applyCam(lg, c, 0.3); drawFarHills(lg, T); });
ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => { applyCam(lg, c, 1); drawHero(lg, {...}); });
ctx.layer(g, { blur: 4 }, (lg) => { applyCam(lg, c, 1.5); drawForegroundLeaves(lg, T); });
```

## 6. particles.js（全部无状态）

- `burst(g, T, {at, seed, count, x, y, spread, speed:[a,b], angle:[a,b], gravity, drag, life:[a,b], spin, size}, draw)`：一次性爆发。
- `stream(g, T, {start, end, rate, seed, life, emit:(tBorn,i,r)=>({x,y,vx,vy}), gravity, drag, size, spin}, draw)`：持续发射。
- `field(g, T, {seed, count, x, y, w, h, vx, vy, sway, swayFreq, size}, draw)`：循环飘落场。
- `draw(g, x, y, s)`，`s` 含 `i, age, p(寿命进度), rot, size, r(0..1)` 等。

## 7. 字体

`font(size, family, weight)`：`display` 站酷庆科黄油体（名字大字、标题）、`play` 站酷快乐体（对白、界面）、`serif` 站酷小薇（绘本旁白、片头片尾）、`latin` Fredoka（数字、LV、HP，可变字重 300–700）。
剪纸字的标准做法：先用 `lineJoin='round'` 粗描边（奶油色纸边，约字号 0.18 倍）→ 再填色 → 整体给图层投影。

## 8. 渲染与自检（每次改完都要做）

```bash
cd /Users/erapi0neer/dalabengba-mv
./tools/lint.sh src/scenes/b05_names.js src/scenes/b05   # 只查自己的文件；必须通过（语法 + 中文乱码 U+FFFD + 非确定性 API）
# --only b05 只加载并渲染 b05 块（快，且不受别的块报错影响）；去掉 --only 就是全片（检查块间交接时用）
node tools/render.mjs stills --only b05 --times 42.0,43.1 --outdir out/review/b05            # 单帧 PNG（1920×1080）
node tools/render.mjs sheet  --only b05 --from 41.8 --to 57 --every 0.25 --cols 8 --tile 300 --out out/review/b05/sheet.jpg   # 联系表（带时间戳与镜头 id）
node tools/render.mjs cues   --only b05 --from 41.8 --to 57 --out out/review/b05/cues.jpg       # 每个 cue 后 0.12s 一帧，印 cue 与画面提示
node tools/pops.mjs --only b05 --from 41.9 --to 56.9                                           # 找非计划跳变、空镜、报错
node tools/render.mjs sheet --sheet hero --from 0 --to 2 --every 0.1 --out out/review/sheets/hero/anim.jpg   # 资产模型图
```
用 Read 工具打开 PNG/JPG 亲眼检查。输出末尾若有 `ERRORS n` 必须修掉。多个任务同时在渲染，**输出目录只用自己的子目录**。
每个块单独动态加载：别的块有语法错误不会影响你（控制台会报 `[block load failed]`），你自己的块报这个错就说明文件有语法问题。
