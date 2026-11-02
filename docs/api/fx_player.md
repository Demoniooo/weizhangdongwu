# 转场与播放器（fx_player）API

> 本组文件：`src/fx/transitions.js`（转场与冲击）、`src/ui/player.js`（预览播放器）；模型图 `src/sheets/fx.js`。
> 规格来源：`docs/assets.md` 第 12 节；分镜规则：`docs/storyboard.md` 第 3.3 / 3.8 / 3.9 节、第 9 节交接表。
> 本文每个参数名、默认值都对照源码核对过；源码与本文不一致时以源码为准，并请提给本组修文档。

---

## 1. 模块与导出一览

### 1.1 `src/fx/transitions.js`

| 名称 | 类型 | 一句话用途 |
|---|---|---|
| `IMPACT` | 常量对象 | 冲击四级预设表 S / M / L / MAX（震动、闪白、保持帧数、衰减、放射线参数） |
| `impact(ctx, T, at, level, o)` | 函数 | 冲击帧：在 `at` 时刻写 `ctx.fx` 的震动 / 闪白（取大者），可顺手画放射线 |
| `impactRays(g, T, at, level, o)` | 函数 | 冲击放射线（纸条式集中线），只画线、不写 fx |
| `speedLines(g, dir, rect, o)` | 函数 | 手画速度线（引擎不做运动模糊，甩镜 / 奔跑用） |
| `WHIP_FROM` | 常量对象 | 甩镜方向 → 速度线带出发边的映射 `{down:'bottom', up:'top', left:'left', right:'right'}` |
| `whipCurtain(ctx, g, T, o, drawNext)` | 函数 | 甩镜帘：一条速度线带扫过全屏，带后是下一块画面 |
| `shapeGeom(shape, o)` | 函数 | 遮罩形状的轮廓点 + Path2D + 是否盖满全屏（给镜头自己做遮罩 / 对位用） |
| `coverSize(shape, o)` | 函数 | 某形状以 (cx, cy) 为中心盖满全屏所需的最小 `size`（放大动画的终点） |
| `shapeReveal(ctx, g, shape, o, drawNext)` | 函数 | 形状遮罩揭示（心形 / 圆 / 杏仁洞口 / 矩形 / 星 / 钥匙孔），可挖洞反向 |
| `pageTurn(ctx, g, T, o, drawNext)` | 函数 | 翻页：折线从右往左扫，页背 paper2，折线右侧露出下一页 |
| `burnEdge(ctx, g, rect, p, o)` | 函数 | 燃烧边：噪声扰动的亮橙前沿推进，线后焦黑、碎成灰片飞散 |
| `drawAsh(g, x, y, s)` | 函数 | 灰片画法（`burst` / `stream` 的 draw 回调） |
| `tearGeom(pts, p, o)` | 函数 | 撕口几何（只算不画：洞口 Path2D、两侧撕边点列） |
| `paperTear(g, pts, p, o)` | 函数 | 纸面撕裂：锯齿口随 p 扩大，两侧纸片翻卷露纸背 |
| `splitScreen(ctx, g, o, drawL, drawR)` | 函数 | 撕纸分屏：左右两片各画一块画面，中间一道撕纸边 |
| `COLD` | 常量（颜色） | 冷色 = `mixHex(PAL.magic, PAL.crystal, 0.3)`，`colorSplit` 的默认冷色 |
| `colorSplit(ctx, g, x, o)` | 函数 | 左冷右暖整帧分色（两块半屏渐变叠混合模式，不开缓冲） |
| `smokeWipe(g, T, o)` | 函数 | 灰烟擦屏：剪纸烟团翻滚涌出盖满全屏，再向两边散开 |

### 1.2 `src/ui/player.js`

| 名称 | 类型 | 一句话用途 |
|---|---|---|
| `startPlayer({ engine, canvas, story })` | 函数 | 启动预览播放器（控制条、快捷键、音频、字幕、打点、清晰度、偏移）；`main.js` / 打包入口调用 |
| `parseLRC(text)` | 函数 | 解析 LRC 文本 → `[{ t, lines:[...] }]`（按时间排序，同时刻多行合并） |
| `mergeAnchors(base, marks)` | 函数 | 合并 warp 锚点（新打的点优先，剔除时间不递增的旧点），返回 `{cueId: 真实秒}` |
| `window.player` | 运行时接口 | `startPlayer` 挂到页面上的调试 / 自动化接口（见 3.15） |
| `window.seek` | 运行时接口 | 同 `window.player.seek` |

---

## 2. 坐标与约定

1. **屏幕坐标**：所有形状、矩形、折线、中心点都是 1920×1080 的屏幕逻辑坐标，按调用时 `g` 的当前坐标系解释。镜头里请在**没有 `applyCam` 的 g** 上调用转场（机位放进 `drawNext` 里自己 `applyCam`）；要对位世界里的物体（洞口、圆窗、国王）就先用 `toScreen(cam, depth, x, y)` 换成屏幕坐标、尺寸乘 `cam.zoom`。
2. **任意外层变换都成立**：模型图把整帧缩进小格时照样对；需要离屏缓冲时函数会把 `g` 的当前变换抄进缓冲，羽化 / 投影按外层缩放换算。
3. **`drawNext(g2)` 回调约定**（`whipCurtain` / `shapeReveal` / `pageTurn`；`splitScreen` 的 `drawL` / `drawR` 同理）：
   - 画的是“后一块画面”的**整帧**，自己先铺满背景（可以多铺 40–80px 出血）；`g2` 已经被裁好，画到外面的部分不会显示。
   - `g2` 的变换与调用时的 `g` 相同（硬边时 `g2 === g` 并带 clip；羽化时是遮罩缓冲）。不要 `resetTransform`，需要的话 `g2.save(); applyCam(g2, c, 1); …; g2.restore()`。
   - 回调里可以再开 `ctx.layer`（每个 +1 缓冲；羽化模式下是“遮罩里再开图层”，同样 +1）。
   - 回调只能是 T 的纯函数（与镜头 draw 相同）。
4. **重叠期由谁画**（storyboard 3.8）：转场由**后一块**负责。后一块的转场镜头 `start` 早于前一块的 `end`，给 `z: 1`；它在重叠期只调用转场函数（不要在 `drawNext` 之外先铺背景，否则会盖掉前一块），前一块照常画（z 0，先画）。转场结束（p ≥ 1 / 已盖满）时函数会整帧调用 `drawNext`。
5. **读像素的两个效果**：`whipCurtain` 的拖影（`smear`）和 `pageTurn` 的页背透字（`see`）会读 `g.canvas` 上已经画好的像素，所以必须在前一块已经画到同一张画布之后调用（即 z: 1 的转场镜头直接在镜头的 `g` 上调用，不要包进后一块自己的 `ctx.layer` 里——那样只能读到图层自己的内容）。变换带旋转 / 镜像时拖影自动跳过。
6. **时间**：`T` 是默认秒；`t0 / t1 / tFull / at` 都是**绝对的默认秒**（直接写 `cue('L13') - 0.2` 这类值，不是镜头内的 `lt`）。`whipCurtain` / `pageTurn` / `smokeWipe` 都接受 `o.p` 直接给进度（模型图、倒放、推镜驱动时用）；`burnEdge` / `paperTear` 本来就只吃进度 `p`；`shapeReveal` / `splitScreen` / `colorSplit` 不吃时间，由镜头算好尺寸 / `enter` / `x` 传进来。
7. **`ctx.fx`**：只有 `impact` 写 `ctx.fx`（`shake` / `flash` / `flashColor` / `zoom`，都按“取大者”合并，可与其它镜头同时写）。其它函数都只在 `g` 上画，不碰 `ctx.fx`。
8. **确定性**：随机全部来自 `hash2(seed…)`，噪声 `noise1 / fbm1`；没有跨帧状态。同一 `seed` + 同一参数 = 同一画面。`src/ui/player.js` 是播放器界面，不受此限（用了 `Date` / `performance.now`）。
9. **状态**：每个函数内部 `save/restore`，不改调用方的变换、合成模式、alpha、clip。颜色只用 `PAL`。
10. **z 值**：转场镜头 `z: 1`；块内转场（b10 灰烟、b16 翻页、b17 圆窗拉出）在同一个镜头里先画老画面再调用。

---

## 3. 函数详解

### 3.1 `impact(ctx, T, at, level = 'M', o = {})`

冲击帧：`at` 时刻打一下。写 `ctx.fx.shake`（噪声震动，按幅值取大者）、`ctx.fx.flash`/`flashColor`（取大者）、可选 `ctx.fx.zoom`（推近）；给了 `o.g` 就同时在 `o.g` 上画放射线。`T < at` 时什么也不做。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `ctx` | — | 镜头的 ctx；传 `null` 等同 `apply:false` |
| `T` | — | 当前默认秒 |
| `at` | — | 冲击时刻（默认秒），一般就是 `cue(...)` |
| `level` | `'M'` | `'S'` / `'M'` / `'L'` / `'MAX'`，见第 4 节；不认识的值按 `'M'` |
| `o.shake` | 预设 | 震动振幅（px，噪声峰值），覆盖预设 |
| `o.flash` | 预设 | 闪白峰值 0..1，覆盖预设 |
| `o.frames` | 预设（MAX 2，其余 1） | 闪白保持帧数，覆盖预设（本次收尾新增） |
| `o.decay` | 预设 | 震动衰减时间常数（秒） |
| `o.freq` | `22` | 震动频率 |
| `o.seed` | `1` | 震动噪声种子（同时也会传给放射线；放射线自己的默认是 17） |
| `o.fps` | `30` | 帧长 = 1/fps，用来算闪白保持几帧 |
| `o.flashColor` | `PAL.white` | 闪色（例 `PAL.fire2`、`PAL.heart`） |
| `o.punch` | — | 推近量，例 `0.03` → `fx.zoom` 1.03 并按 0.12s 衰减 |
| `o.apply` | `true` | `false` = 只算不写 fx（模型图用） |
| `o.g` | — | 给了就在 `o.g` 上画放射线（`impactRays(o.g, T, at, level, o)`） |
| `o.rays` | `true` | `false` = 有 `o.g` 也不画放射线 |
| `o.x, o.y, o.n, o.reach, o.r0, o.color, o.edge, o.rot, o.alpha, o.life` | 见 3.2 | 透传给放射线 |

闪白曲线：`age < frames/fps` 时为峰值，之后 = 峰值 × 0.4 × e^(−(age−hold)/0.05)。
**返回** `{ k, flash, shake:[dx, dy] }`：`k` = e^(−age/decay)（0..1 衰减包络，可给镜头自己的余波用）；`T < at` 时返回 `{k:0, flash:0, shake:[0,0]}`。

### 3.2 `impactRays(g, T, at, level = 'M', o = {})`

从 (x, y) 向外射出的纸条集中线：头先冲出去、尾巴追上后消失，每 5 条有 1 条 goldLight。只在 `0 ≤ T−at ≤ life` 内画。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `o.x, o.y` | `960, 540` | 冲击点 |
| `o.n` | 预设 `rays` | 条数 |
| `o.reach` | 预设 `reach` | 最长伸展半径 px |
| `o.r0` | `reach × 0.11` | 中心留空半径 |
| `o.life` | 预设 `life` | 寿命（秒） |
| `o.color` | `PAL.white` | 线色 |
| `o.edge` | `PAL.ink` | 右下暗色错位色；`null` 关掉 |
| `o.rot` | `0` | 整体旋转（弧度） |
| `o.alpha` | `1` | 整体透明度 |
| `o.seed` | `17` | 种子 |

**返回** 无。

### 3.3 `speedLines(g, dir = 'h', rect = 全屏, o = {})`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `dir` | `'h'` | `'h'` 横线 / `'v'` 竖线（其它值按 `'h'`） |
| `rect` | `{x:0,y:0,w:1920,h:1080}` | 线被裁在里面；传 `undefined` / `null` = 全屏 |
| `o.t` | 不给 = 静止 | 秒；给了就沿走向流动 |
| `o.speed` | `2400` | 流动速度 px/s |
| `o.sign` | `1` | `+1` 朝 x/y 增大方向流动，`-1` 反向；粗头朝流动方向 |
| `o.density` | `2.2` | 每 100px 横截面的条数 |
| `o.alpha` | `0.75` | 整体不透明度 |
| `o.color` / `o.colors` | `PAL.white` | 单色，或颜色数组轮流用 |
| `o.len` | `[0.16, 0.55]` | 线长占走向长度的比例区间 |
| `o.lw` | `[1.5, 5.5]` | 最粗处半宽 px 区间 |
| `o.fade` | `0.1` | 横截面两侧渐隐（0..0.5） |
| `o.ends` | `0.08` | 走向两端渐隐比例（线快出 rect 时变淡） |
| `o.mask` | — | `(c 0..1) => 强度`，横截面分布（例：只在中间一条带里有线） |
| `o.shadow` | `0` | 右下暗色错位强度 0..1 |
| `o.seed` | `3` | 种子 |
| `o.clip` | `true` | `false` = 不裁到 rect |

**返回** 无。

### 3.4 `whipCurtain(ctx, g, T, o = {}, drawNext)`

一条速度线带（默认 160px）从一条边扫到对边；带已经扫过的一侧画 `drawNext`，带前方保持原画面。带两侧的画面像素被拉成拖影，带底是老 → 新颜色桥渐变，带内是长短不一的纸条，整帧还有几条跟着走的淡拖影线。**不开缓冲**（`ctx` 目前未使用，照传即可）。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `o.t0, o.t1` | `0, 0.15` | 带扫过的时间段（绝对默认秒，务必传） |
| `o.p` | — | 直接给进度 0..1（跳过 T） |
| `o.ease` | `inOutSine` | 带的走位缓动（机位自己用 `whip`） |
| `o.dir` | `'down'` | 机位甩动方向 `'down'|'up'|'left'|'right'`，经 `WHIP_FROM` 换成出发边 |
| `o.from` | — | 直接指定带的出发边 `'bottom'|'top'|'left'|'right'`，**优先于 dir** |
| `o.band` | `160` | 带宽 px |
| `o.colors` | `[PAL.paper, PAL.inkSoft]` | `[老画面颜色桥, 新画面颜色桥]` |
| `o.density` | `7` | 带内条纹密度（每 100px） |
| `o.smear` | `true` | 拖影；`false` 只画纯色带（带底更不透明） |
| `o.trail` | `0.6` | 整帧拖影线强度 0..1（0 关） |
| `o.seed` | `7` | 种子 |
| `drawNext` | — | `(g2) => {}` 画后一块整帧 |

**返回** 进度 `p`。`p ≤ 0` 什么也不画（返回 0）；`p ≥ 1` 整帧画 `drawNext`（返回 1）。

### 3.5 `shapeGeom(shape = 'circle', o = {})`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `shape` | `'circle'` | `'circle'|'heart'|'almond'|'rect'|'star'|'keyhole'`；其它值按 circle |
| `o.cx, o.cy` | `960, 540` | 中心（heart 为包围盒中心） |
| `o.size` | `300` | 包围盒高度；circle 为直径 |
| `o.r` | — | circle 半径（优先于 size） |
| `o.w, o.h` | 按比例 | almond / rect 的宽高（优先于 size）；默认宽 = size × 1.444（almond）/ × 16/9（rect） |
| `o.rot` | `0` | 旋转（弧度） |
| `o.radius` | `0` | rect 圆角 |

默认宽高比：heart 1.105、almond 1.444（洞口 520×360）、rect 16:9、star 约 1.05、keyhole 约 0.62。
**返回** `{ pts（屏幕坐标轮廓点）, path（Path2D）, size（circle 为直径）, covers()（是否已盖满全屏）}`。

### 3.6 `coverSize(shape = 'circle', o = {})`

以 `(o.cx, o.cy)` 为中心、按 `o` 的比例 / 旋转，盖满全屏所需的最小 `size`（二分，结果再放大 1%）。circle 返回**直径**（= 2 × 最远角距离 + 8）。给了 `o.w / o.h` 时按同一比例放大。
**返回** number。

### 3.7 `shapeReveal(ctx, g, shape = 'circle', o = {}, drawNext)`

形状里面画 `drawNext`（`invert:true` 时画在形状外面，用于“圆窗拉出”）。硬边时形状之外那层纸在洞里投一道右下的影子；可加纸条描边。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `shape` 与 `o.cx/cy/size/r/w/h/rot/radius` | 见 3.5 | 形状与几何 |
| `o.feather` | `0` | 羽化 px；> 0 时走 `ctx.mask`（1 个缓冲，且不画投影）；需要传 `ctx` |
| `o.invert` | `false` | `true` = 画在形状之外（挖洞） |
| `o.outline` | heart 为 `true`，其余 `false` | `true`（宽 = size × 0.04，跟着放大）/ 数字（固定宽 px）/ `false` |
| `o.outlineColor` | heart：`PAL.heart`；其余：`PAL.paper` | 描边色 |
| `o.shadow` | `!feather` | 洞内投影；`false` 关 |
| `drawNext` | — | 画后一块整帧 |

**返回** `{ full, path }`：`full` = 新画面已盖满全屏（此时整帧画了 `drawNext`，不再裁剪、不画描边）。尺寸 ≤ 0.5 时什么也不画（`invert` 时整帧画 `drawNext`）；`invert` 且形状已盖满全屏时什么也不画。

### 3.8 `pageTurn(ctx, g, T, o = {}, drawNext)`

折线从右往左扫过（右下角先掀起）；折线右侧露出下一页，翻起的部分折到左侧画页背（paper2，隐约透出镜像的正面）+ 卷页亮带 + 投影；折线处在新页上投影子，折线上一道亮细线。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `o.t0, o.t1` | `0, 0.55` | 翻页时间段（绝对默认秒） |
| `o.p` | — | 直接给进度 |
| `o.ease` | `inOutSine` | 进度缓动 |
| `o.dir` | `'left'` | `'left'` 从右往左翻；`'right'` 镜像（从左往右） |
| `o.rect` | 全屏 | 页面矩形 `{x,y,w,h}`（插画框 / 跨页右页） |
| `o.back` | `PAL.paper2` | 页背色 |
| `o.see` | `0.2` | 页背透出正面的程度 0..1（读 `g.canvas`，见第 2 节第 5 条） |
| `o.tilt` | `14` | 起始折线倾角（度），随进度归零 |
| `o.k0` | `0.5` | 起始页背压缩比（透视里竖起的纸更窄），随进度到 1 |
| `drawNext` | — | 画下一页整帧（只在 `rect` 内显示） |

需要 `ctx`（页背用 1 个 `ctx.layer`，自带右下投影）；不传 `ctx` 时退化为直接画页背 + 简单错位影。
**返回** 进度 `p`；`p ≤ 0` 不画，`p ≥ 1` 在 `rect` 内整页画 `drawNext`。

### 3.9 `burnEdge(ctx, g, rect, p, o = {})`

一条被噪声扰动的亮橙前沿推进；前沿之前纸面先烤黄，之后是焦黑卷曲的纸，再往后碎成灰片飞散（`burst`）。前沿外侧还有光晕、三层剪纸火舌、火星。

两种用法：
- ① **推荐**：给 `o.draw(lg)`（面板画法）**并传 `ctx`** → 函数自己开 1 个 `ctx.layer`，在层里画面板再烧掉（给了 `o.draw` 却传 `ctx = null` 会退化成用法 ②，直接擦 g）；
- ② 不给 `o.draw` → `g` 必须是“只有这块面板”的图层（由镜头自己开的 `ctx.layer` 的 `lg`），函数直接在 `g` 上 `destination-out` 擦除。**千万不要在镜头主画布 g 上用 ②**（会把整帧擦成黑）。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `rect` | 全屏 | 被烧的面板矩形 `{x,y,w,h}`，要包住面板的全部内容（标题、名称） |
| `p` | — | 0..1 前沿走完全程；**可 > 1**，让灰片飞完：`p = (T − t0) / dur` |
| `o.dir` | `'left'` | 前沿推进方向：`'left'` 从右往左烧、`'right'` 从左往右、`'up'` 从下往上、`'down'` 从上往下 |
| `o.t` | `0` | 秒，驱动火舌摇曳、火星（传 `T`） |
| `o.dur` | `0.4` | 前沿扫过时长（秒），用于灰片的飞行时间 |
| `o.char` | `clamp(长×0.06+22, 26, 62)` | 焦黑带宽 px |
| `o.flakes` | `clamp(round(长/26), 8, 40)` | 灰片簇数（每簇 6 片） |
| `o.glow` | `1` | 光晕强度 |
| `o.seed` | `9` | 种子 |
| `o.draw` | — | `(lg) => {}` 画面板（用法 ①） |
| `o.layer` | `{shadow:10, texture:0.3}` | 用法 ① 那个图层的选项（数字 shadow 按外层缩放换算） |

**返回** `{ u（前沿推进量 px）, edge:[x, y]（前沿中点，给火焰吐息对位）}`。`p ≤ 0` 时用法 ① 画完整面板、用法 ② 什么也不画。

### 3.10 `drawAsh(g, x, y, s)`

灰片：不规则小纸片，焦黑或灰，个别带一圈暗红余烬。签名同 `burst` / `stream` 的 draw 回调（`s` 含 `i, p, rot, size, r`）。**返回** 无。

### 3.11 `tearGeom(pts, p, o = {})` / `paperTear(g, pts, p, o = {})`

`pts` 是撕裂线**折线点列**（≥ 2 点，`[[x,y], ...]`，不是 Path2D）。`p` 0..1：先从 `origin` 处沿线裂开（grow，前 35%），再张开（open，10%→100%）。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `o.origin` | `0.5` | 从线上哪儿开始裂（0..1） |
| `o.width` | `线长 × 0.2` | 口子最大半宽 px |
| `o.tooth` | `13` | 齿距 px |
| `o.grow` | `clamp(p/0.35)` | 直接覆盖裂开进度 |
| `o.open` | `outCubic(clamp((p−0.1)/0.9))` | 直接覆盖张开进度 |
| `o.seed` | `4` | 种子 |
| `o.inside` | `PAL.ink` | 口子里：颜色，或 `(g, holePath) => {}`（已裁剪，可画后面的画面） |
| `o.back` | `PAL.paper2` | 翻卷纸片的纸背色（丝绒幕给 `PAL.redDeep`） |
| `o.fiber` | `PAL.white` | 白纤维毛边色 |
| `o.curl` | `0.6` | 翻卷深度比例 |
| `o.crack` | `PAL.ink` | 未张开前的细裂纹色 |

`tearGeom` 只算不画，**返回** `{ hole（Path2D）, holePts, sideA, sideB, normals, center, ws, open, grow, len }`；`paperTear` 画出来并返回同一个对象（`hole` 可给镜头做遮罩，例如龙头从口子里撞出来）。`p ≤ 0` 时不画。

### 3.12 `splitScreen(ctx, g, o = {}, drawL, drawR)`

左右两张“照片”各画一块画面（各用一台机位），中间一道斜的撕纸边：左片压在右片上，撕边露白色纸芯并在右片上投影。**不开缓冲**（两次 `g.clip`）。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `o.x` | `960` | 分界中心 x |
| `o.angle` | `6°`（弧度 0.1047） | 倾角，正 = 上端偏右 |
| `o.enter` | `1` | 0..1，两片从左右两侧滑进来；≤ 0 不画 |
| `o.strip` | `10` | 白纸芯平均宽 px |
| `o.seed` | `11` | 种子 |
| `drawL / drawR` | — | `(g2, info) => {}`，`info = { side:'L'|'R', dx（这一片当前的滑入偏移） }`；想让画面跟着片走就把 `dx` 加到机位 / translate 上 |

**返回** `{ seam:[[x,y], ...] }`（左片右边缘折线，已含滑入偏移）。

### 3.13 `colorSplit(ctx, g, x = 960, o = {})`

左冷右暖：冷、暖两块半屏线性渐变依次以 `modes` 里的混合模式叠在整帧上（默认先 `color` 统一色相、再 `soft-light` 加对比），不逐形状滤镜、不开缓冲。在镜头内容画完后（界面之前）调用。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `x` | `960` | 分界（撞击点）x |
| `o.y` | `540` | 分界线经过的点的 y |
| `o.angle` | `0` | 分界线相对竖直的倾角（弧度） |
| `o.cold` | `COLD` | 左侧冷色 |
| `o.warm` | `PAL.fire` | 右侧暖色 |
| `o.alpha` | `0.5` | 强度 0..1；≤ 0 不画 |
| `o.soft` | `140` | 过渡带宽 px |
| `o.seam` | `0` | 分界亮线（goldLight，screen）0..1 |
| `o.modes` | `[['color',0.7],['soft-light',1]]` | `[混合模式, 强度系数]` 依次叠 |

**返回** 无。

### 3.14 `smokeWipe(g, T, o = {})`

一团剪纸烟从 (x, y) 翻滚着涌出，在 `tFull` 盖满全屏，再从中间向左右两边散开（每朵烟三层纸：暗底片 → 烟身 → 亮顶盖，偶带漩涡纹）。**不开缓冲**。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `o.t0, o.t1` | `0, 0.3` | 整段时间（绝对默认秒） |
| `o.tFull` | `(t0+t1)/2` | 盖满全屏的时刻 |
| `o.p` | — | 直接给进度：0..0.5 涌出、0.5 盖满、0.5..1 散开 |
| `o.x, o.y` | `960, 600` | 烟的起点 |
| `o.color` | `PAL.dragonDeep` | 烟色（暗底、顶盖都由它与 stone 系混出） |
| `o.grid` | `210` | 大烟团间距（越小烟团越多越碎） |
| `o.seed` | `5` | 种子 |

**返回** `{ cover（0..1 覆盖程度）, full, phase:'in'|'full'|'out' }`。注意 `full` 只在 `T` 恰好等于 `tFull` 时为 true，**换画面请用 `T < tFull` 判断**（`phase` 在之前是 `'in'`、之后是 `'out'`）。

### 3.15 播放器导出

- `startPlayer({ engine, canvas, story })`：`engine` 为 `createEngine` 的返回值；`story` 用于切清晰度时重建引擎（不传则不能切清晰度）。无返回值；挂 `window.seek`、`window.player`、更新 `window.engine`。
- `parseLRC(text)` → `[{ t（音频文件秒）, lines:[字符串…] }]`：支持 `[mm:ss.xx]` / `[mm:ss:xx]` / `[mm:ss]`、一行多个时间戳、`[offset:±毫秒]`（正值让歌词提前）、增强型 `<mm:ss.xx>` 逐字时间（去掉）、UTF-8 BOM；同一时刻的几行合并成多行字幕（双语）；空文本行 = 清屏。
- `mergeAnchors(base = {}, marks = {})` → `{cueId: 真实秒}`：补 `intro = 0`；按默认秒排序后丢掉与新点冲突（真实秒不递增）的旧点；保留 3 位小数。
- `window.player`：`state()`（`{t, playing, hasAudio, audioName, offset, dpr, preset, anchors, subs, subsOn, subsName, stampOn, tap:{on,i,next,marks}}`）、`loadLrcText(text, name = 'lyrics.lrc')`（返回条数）、`seek(x)`、`setOffset(v, quiet)`、`setDpr(d, quiet)`、`parseLRC`、`mergeAnchors`。

---

## 4. 枚举全表

### 4.1 `impact` 等级（`IMPACT`）

| 等级 | 震动 px | 闪白 | 保持帧 | 衰减 s | 放射线 条 / 半径 / 粗 / 寿命 | 用在（storyboard） |
|---|---|---|---|---|---|---|
| `'S'` | 8 | 0.25 | 1 | 0.22 | 10 / 430 / 8 / 0.24s | 小冲击 6–10：b05 字撞框（shake 10）、b10（shake 10）、b16 摇篮（shake 8 + flash 0.4）、b17（shake 10） |
| `'M'` | 14 | 0.5 | 1 | 0.30 | 14 / 640 / 11 / 0.30s | 中冲击 12–18：b02（shake 12 / flash 0.3）、b03（shake 16 / flash 0.35）、b05（shake 12）、b10（shake 14 / flash 0.3）、b11 五拍（12–18）、b12（shake 18 / flash 0.8）、b17（shake 16 / flash 0.2） |
| `'L'` | 22 | 0.8 | 1 | 0.40 | 18 / 880 / 14 / 0.38s | 大冲击 20–26：b02 13.45 龙头吼（shake 22、decay 0.5、flash 0.4 fire2）、b05 45.00「翁」撞镜（shake 20）、b05（shake 24 / flash 0.7）、b10（shake 20）、b11（shake 24 / flash 0.6）、**b11 135.40 正中对撞（shake 26、flash 1.0 两帧 → `frames:2`）**、b12（shake 22 / flash 0.4 heart） |
| `'MAX'` | 32 | 1.0 | 2 | 0.50 | 26 / 1180 / 18 / 0.48s | **全片只用一次**：b13 B11 157.17 名字之剑劈下（shake 32、flash 1.0 两帧） |

数值不在预设上时用 `o.shake / o.flash / o.decay / o.frames` 覆盖（见 5.1）。

### 4.2 `speedLines` 的 `dir`

| 值 | 说明 | 用在 |
|---|---|---|
| `'h'` | 横线（默认） | 横向甩镜（b05 44.80 右甩、b11 甩镜）、奔跑（b07、b14 归途） |
| `'v'` | 竖线 | 竖向甩镜（b03 入场机位下落）、下落 / 上升 |

### 4.3 `whipCurtain` 的 `dir` / `from`

| `dir`（机位甩动方向） | 等价 `from`（带出发边） | 带的走向 | 新画面出现在 | 用在 |
|---|---|---|---|---|
| `'down'`（默认） | `'bottom'` | 下 → 上 | 带下方 | **b02→b03**（19.95–20.10，带由下往上） |
| `'up'` | `'top'` | 上 → 下 | 带上方 | — |
| `'left'` | `'left'` | 左 → 右 | 带左方 | — |
| `'right'` | `'right'` | 右 → 左 | 带右方 | **b09→b10**（109.00–109.15，带由右往左） |

> **易错**：storyboard 把 b09→b10 写成「横向甩镜帘（向左）」，指的是**带向左走**（由右往左）。请写 `from: 'right'`（或 `dir: 'right'`），**不要写 `dir: 'left'`**——那是带从左边进来往右走。

### 4.4 `shapeReveal` / `shapeGeom` 的 `shape`

| 值 | 几何 | 默认描边 | 用在 |
|---|---|---|---|
| `'heart'` | 参数心形，`size` = 包围盒高，宽 ≈ 1.105 × size | heart 色，宽 size × 0.04（300 高时 12px，跟着放大） | **b03→b04**（33.60–34.10，心 (1100,600) 高 300 → 满屏） |
| `'circle'` | 圆，`r` 或 `size`（直径） | 无 | **b14→b15**（176.80–177.20 圆心 (960,540) 揭开）、b14 168.55–169.00 圆窗推入、**b17 198.50–198.90 圆窗拉出（`invert:true`）** |
| `'almond'` | 杏仁（上下两条三次曲线），默认 w = 1.444 × h | 无 | **b08→b09**（98.60–99.60 洞口 520×360 随推镜放大）、b09 101.20 巨眼轮廓（用 `shapeGeom` 取 path） |
| `'rect'` | 矩形，可圆角 `radius`、旋转 `rot`，默认 16:9 | 无 | 画框 / 卡片揭示 |
| `'star'` | 尖朝上的五角星，尖端修圆 | 无 | 备用（剑光 = 星星母题） |
| `'keyhole'` | 钥匙孔 | 无 | 备用 |

### 4.5 其它枚举

| 函数 | 参数 | 取值 | 说明 / 用在 |
|---|---|---|---|
| `pageTurn` | `dir` | `'left'`（默认）/ `'right'` | 从右往左翻 / 镜像；b16 用 `'left'` |
| `burnEdge` | `dir` | `'left'`（默认）/ `'right'` / `'up'` / `'down'` | 前沿推进方向；b10 道具栏用 `'left'`（火从右往左） |
| `smokeWipe` | 返回 `phase` | `'in'` / `'full'` / `'out'` | 涌出 / 恰好盖满 / 散开；b10 117.50–117.80 |
| `splitScreen` | `info.side` | `'L'` / `'R'` | 回调里区分左右片；b11 136.30–136.80 |
| `colorSplit` | `modes` 的混合模式 | 任意 canvas 合成模式名 | 默认 `color` + `soft-light`；b11 135.40 起 |

---

## 5. 推荐用法（可直接复制，`drawXxx` 换成你块里的画法）

公共 import：

```js
import { cue } from '../cues.js';
import { PAL } from '../core/paper.js';
import { seg, lerp, mixHex } from '../core/util.js';
import { whip, outCubic, inOutCubic, outExpo } from '../core/ease.js';
import { cam, applyCam, toScreen } from '../core/camera.js';
import {
  impact, speedLines, whipCurtain, shapeReveal, shapeGeom, coverSize, pageTurn,
  burnEdge, paperTear, splitScreen, colorSplit, smokeWipe, COLD,
} from '../fx/transitions.js';
```

### 5.1 冲击帧 `impact`

```js
draw(g, T, lt, ctx) {
  drawScene(g, T);
  // b02 13.45 龙头吼：大冲击，衰减放慢，闪 fire2 色
  impact(ctx, T, 13.45, 'L', { decay: 0.5, flash: 0.4, flashColor: PAL.fire2 });
  // b11 135.40 正中对撞：shake 26、flash 1.0 持续 2 帧，放射线画在撞击点
  impact(ctx, T, 135.40, 'L', { shake: 26, flash: 1, frames: 2, g, x: 960, y: 520 });
  // b13 B11 157.17 名字之剑劈下：全片唯一一次 MAX（shake 32、flash 1.0 两帧）+ 放射线
  impact(ctx, T, cue('B11'), 'MAX', { g, x: 960, y: 540 });
  // 只要余波包络（例：字随冲击回弹），不写 fx
  const { k } = impact(null, T, cue('B11'), 'MAX', { apply: false });
}
```

### 5.2 甩镜帘 `whipCurtain`（b02→b03、b09→b10 交接）

```js
// src/scenes/b03_oath.js —— 后一块负责画，z: 1，start 早于 b02 的 end
const GRAY_BLUE = mixHex(PAL.skyDay, PAL.stone2, 0.6);   // 颜色桥：灰蓝天 / stone
export default [
  {
    id: 'b03_whip_in', start: 19.95, end: 20.10, z: 1,
    draw(g, T, lt, ctx) {
      // 带由下往上（dir:'down' = from:'bottom'），帘下是 PLAZA 灰蓝天
      whipCurtain(ctx, g, T, { t0: 19.95, t1: 20.10, dir: 'down', colors: [GRAY_BLUE, PAL.stone] },
        (g2) => drawPlaza(g2, T, ctx));   // drawPlaza 自己铺满背景；机位 cam(960,240,1) → PL-W 用 whip 缓动
    },
  },
  // 20.10 起是 b03 的正式镜头（照常画整帧）
];

// src/scenes/b10_dragonname.js —— b09→b10：横向甩镜帘，带由右往左（注意是 from:'right'）
{
  id: 'b10_whip_in', start: 109.00, end: 109.15, z: 1,
  draw(g, T, lt, ctx) {
    whipCurtain(ctx, g, T, { t0: 109.00, t1: 109.15, from: 'right', colors: [PAL.goldLight, PAL.dragonDeep] },
      (g2) => drawHeroCloseUpCave(g2, T, ctx));   // 帘后是 CU-H（洞）
  },
},
```

### 5.3 形状揭示 `shapeReveal`

```js
// ① b03→b04 心形（b04 负责，33.60–34.10，z: 1）：心 (1100,600) 高 300 → 满屏，中心滑到国王，heart 描边 12px 跟着放大
{
  id: 'b04_heart_in', start: 33.60, end: 34.10, z: 1,
  draw(g, T, lt, ctx) {
    const k = inOutCubic(seg(T, 33.60, 34.10));
    const [kx, ky] = KING_SCREEN;                        // 国王在 TR-W 里的屏幕位置（用 toScreen 算）
    const end = coverSize('heart', { cx: kx, cy: ky });  // 在终点中心盖满全屏所需的高度
    shapeReveal(ctx, g, 'heart', { cx: lerp(1100, kx, k), cy: lerp(600, ky, k), size: 300 * (end / 300) ** k },
      (g2) => drawThrone(g2, T, ctx));                   // 心里是王座厅 TR-W
  },
},

// ② b08→b09 杏仁洞口（b09 负责，98.60–99.60，z: 1）：外形 = 洞口 (13000,640) 520×360 在 journeyCam 下的屏幕投影
{
  id: 'b09_mouth_in', start: 98.60, end: 99.60, z: 1,
  draw(g, T, lt, ctx) {
    const c = journeyCam(T);                             // import { journeyCam } from '../env/journey.js'（与 b08 同一条机位函数）
    const [cx, cy] = toScreen(c, 1, 13000, 640);
    shapeReveal(ctx, g, 'almond', { cx, cy, w: 520 * c.zoom, h: 360 * c.zoom, rot: c.rot || 0 }, (g2) => {
      // 重叠 1.0s：遮罩里只画一层径向渐变（硬边 = 0 缓冲，两块合计仍 ≤ 8）
      const r = g2.createRadialGradient(cx, cy, 0, cx, cy, 1100);
      r.addColorStop(0, PAL.dragonDeep); r.addColorStop(1, mixHex(PAL.dragonDeep, PAL.ink, 0.7));
      g2.fillStyle = r; g2.fillRect(-40, -40, 2000, 1160);
    });
  },
},
// 巨眼（b09 101.20）复用同一轮廓：const eye = shapeGeom('almond', { cx: 1250, cy: 520, w: 560, h: 300 }).path;

// ③ b14→b15 圆形（b15 负责，176.80–177.20，z: 1）：圆心 (960,540) 揭开，圆里是主堡圆窗外侧玻璃大特写
{
  id: 'b15_rose_in', start: 176.80, end: 177.20, z: 1,
  draw(g, T, lt, ctx) {
    const R = coverSize('circle', { cx: 960, cy: 540 }) / 2 + 100;  // 羽化 40 时多放 ~2.5 倍羽化，角上不留半透明
    shapeReveal(ctx, g, 'circle', { cx: 960, cy: 540, r: R * outCubic(seg(T, 176.80, 177.20)), feather: 40 },
      (g2) => drawRoseWindowOutside(g2, T, ctx));
  },
},

// ④ b17 198.50–198.90 圆窗拉出（块内）：先画厅内整帧，圆外画夜里的主堡外墙，圆缩到窗的大小
draw(g, T, lt, ctx) {
  drawThroneNight(g, T, ctx);
  const k = inOutCubic(seg(T, 198.50, 198.90));
  shapeReveal(ctx, g, 'circle', { cx: 960, cy: 430, r: lerp(1150, 70, k), invert: true, outline: 10, outlineColor: PAL.goldLight },
    (g2) => drawCastleNight(g2, T, ctx));
}
```

### 5.4 翻页 `pageTurn`（b16 189.40–189.95，块内）

```js
draw(g, T, lt, ctx) {
  drawSunsetIllustration(g, T, ctx);                 // 插画页（太阳在 (1220,250) r 70）
  pageTurn(ctx, g, T, { t0: 189.40, t1: 189.95 },    // 右下角先掀，页背 paper2 透出正面
    (g2) => drawThroneNight(g2, T, ctx));            // 新一页：TR-NIGHT，月亮在同一位置 (1220,250) r 70
  // 插画有画框时只翻框内：pageTurn(ctx, g, T, { t0, t1, rect: { x: 160, y: 90, w: 1600, h: 900 } }, …)
}
```

### 5.5 燃烧边 `burnEdge` + 灰烟 `smokeWipe`（b10，块内）

```js
// 117.20–117.60 一口火从右往左横扫道具栏；117.50–117.80 灰烟盖满再散开，露出 CV-LOW
import { itemBar } from '../ui/kit.js';
const BAR = { x: 880, y: 200, w: 840, h: 360 };       // kit.itemBar 的默认 rect
draw(g, T, lt, ctx) {
  const tFull = 117.65;
  if (T < tFull) {
    drawHeroCloseUpCave(g, T, ctx);
    const p = Math.max(0, (T - 117.20) / 0.4);         // 可 > 1：让灰片飞完
    const { edge } = burnEdge(ctx, g, BAR, p, {
      dir: 'left', t: T, dur: 0.4,
      draw: (lg) => itemBar(lg, { rect: BAR, items: ITEMS, t: T }),   // 用 burnEdge 自己擦除，itemBar 不要再传 burn
    });
    // edge = 前沿中点，可给龙的火焰吐息对位
  } else {
    drawCaveLowAngle(g, T, ctx);                       // CV-LOW 仰拍
  }
  smokeWipe(g, T, { t0: 117.50, t1: 117.80, tFull, x: 1300, y: 380, color: PAL.dragonDeep });
}
```

> kit.itemBar 自带的 `burn` 参数是另一套燃烧线（边后不画），**不要和 burnEdge 混用**，两条前沿对不齐。

### 5.6 撕纸 `paperTear`

```js
// b02 13.10 天空右上的纸面撕开（0.2s 扩大），13.25 龙头从裂口撞出
const TEAR = [[1230, 190], [1300, 300], [1380, 420]];
draw(g, T, lt, ctx) {
  drawSky(g, T);
  const geo = paperTear(g, TEAR, seg(T, 13.10, 13.30), { width: 130, inside: PAL.ink });   // 纸背 paper2、后面是黑
  if (T >= 13.25) ctx.mask(g, (mg) => mg.fill(geo.hole), (lg) => drawDragonHead(lg, T));   // 龙头只在口子里（+1 缓冲）
}
// b13 撕开顶幕（丝绒）：paperTear(g, pts, p, { back: PAL.redDeep, inside: (g2) => drawCaveBehind(g2, T) });
```

### 5.7 撕纸分屏 `splitScreen` + 左右分色 `colorSplit`（b11）

```js
// 135.40 正中对撞：左冷右暖，分界就在撞击点
draw(g, T, lt, ctx) {
  drawClash(g, T, ctx);
  impact(ctx, T, 135.40, 'L', { shake: 26, flash: 1, frames: 2, g, x: HIT_X, y: HIT_Y });
  colorSplit(ctx, g, HIT_X, { y: HIT_Y, alpha: 0.5, seam: 0.6 });     // 默认冷 = COLD（magic+crystal）、暖 = PAL.fire
}

// 136.30–136.80 撕纸分屏：左半勇者的眼睛，右半龙的竖瞳；同时黑边 0→1
draw(g, T, lt, ctx) {
  ctx.fx.letterbox = Math.max(ctx.fx.letterbox || 0, seg(T, 136.30, 136.80));
  g.fillStyle = PAL.ink; g.fillRect(0, 0, 1920, 1080);                // 两片滑入前的底
  splitScreen(ctx, g, { enter: outExpo(seg(T, 136.30, 136.60)), x: 960 },
    (g2, { dx }) => { g2.save(); g2.translate(dx, 0); drawHeroEyes(g2, T, ctx); g2.restore(); },
    (g2, { dx }) => { g2.save(); g2.translate(dx, 0); drawDragonPupil(g2, T, ctx); g2.restore(); });
  colorSplit(ctx, g, 960, { alpha: 0.35 });                          // 可选：分屏后继续保持左冷右暖
}
```

### 5.8 速度线 `speedLines`

```js
// 横甩时整帧速度线（粗头朝流动方向）；只在中间一条带里画（例：甩镜时的光带）
speedLines(g, 'h', undefined, { t: T, sign: -1, alpha: 0.6 });
speedLines(g, 'h', { x: 0, y: 380, w: 1920, h: 320 }, { t: T, density: 5, colors: [PAL.goldLight, PAL.white], mask: (c) => Math.exp(-(((c - 0.5) / 0.22) ** 2)), shadow: 1 });
```

---

## 6. 与 assets.md 的差异

| 项 | assets.md 第 12 节 | 实际实现 |
|---|---|---|
| `impact` 签名 | `impact(ctx, T, at, level)` | 多一个可选 `o`（覆盖 shake/flash/decay/frames、画放射线、punch、apply:false）；返回 `{k, flash, shake}` |
| 冲击放射线 | 包含在 impact 里 | 另外导出 `impactRays`；impact 只有给了 `o.g` 才画线 |
| `whipCurtain` 揭示方式 | 带后由 `drawNext(lg)` 用 `ctx.mask` 画 | 用 `g.clip`（0 缓冲），`drawNext(g)` 拿到的是带 clip 的 g；另加 `from`、`band`、`colors`、`smear`、`trail` 等参数 |
| `whipCurtain` 的 `dir` | 'down' / 'left' / 'right' / 'up' | `dir` = 机位甩动方向（down → 带从下往上）；另有 `from` 直接指定出发边。**b09→b10 要写 `from:'right'`** |
| `shapeReveal` 形状 | heart / circle / almond / rect | 另有 `star`、`keyhole`；另导出 `shapeGeom`、`coverSize`；支持 `invert`（圆窗拉出）、`shadow`、`r / w / h / radius` |
| `paperTear(g, path, p, o)` | 第二个参数叫 path | 实际是**折线点列** `pts`（`[[x,y],...]`），不是 Path2D；另导出 `tearGeom` |
| `burnEdge` | `rect, p, o` | 加 `o.draw`（函数自己开 1 个图层）与 `o.layer`；`p` 可 > 1 让灰片飞完；另导出 `drawAsh` |
| `colorSplit` | 两个半屏遮罩叠 tint（magic / fire） | 两块半屏渐变按 `modes` 混合（默认 color + soft-light），0 缓冲；冷色默认 `COLD`（magic 掺三成 crystal），另导出 `COLD` |
| `pageTurn` | 折线从右往左 | 另有 `dir:'right'`、`rect`（只翻画框内）、`back`、`see`、`tilt`、`k0` |
| `smokeWipe` | 盖满再散开 | 另有 `tFull`、`p`、`grid`；返回 `{cover, full, phase}` |
| 新增 | — | `impact` 的 `frames`（闪白保持帧数）是本次收尾为 b11 135.40 补的参数 |

---

## 7. 已知限制与注意事项

### 7.1 每种转场的全屏缓冲（storyboard 3.9：每帧含重叠期两块相加 ≤ 8）

| 函数 | 自身缓冲 | 说明 |
|---|---|---|
| `impact` / `impactRays` | 0 | 只写 `ctx.fx` / 在 g 上画线 |
| `speedLines` | 0 | |
| `whipCurtain` | 0 | `g.clip` + 从 g 自己画布 drawImage 的细条拖影（每帧约 15 次条带拷贝） |
| `shapeReveal` 硬边 | 0 | `g.clip` |
| `shapeReveal` `feather > 0` | 1 | `ctx.mask` |
| `pageTurn` | 1 | 页背 `ctx.layer`（自带投影） |
| `burnEdge` 给 `o.draw` | 1 | 面板图层 |
| `burnEdge` 不给 `o.draw` | 0 | 但调用方必须已经开了一个只含面板的图层（那个算 1） |
| `paperTear` | 0 | 若再用 `ctx.mask` 让东西从口子里出来，+1 |
| `splitScreen` | 0 | 两次 `g.clip` |
| `colorSplit` | 0 | 两次整帧渐变混合（默认 2 种模式 × 冷暖 = 4 次整帧填充） |
| `smokeWipe` | 0 | 约 164 朵烟（130 大 + 34 小），每朵 3–5 次 path 填充 |

再加上 `drawNext` / `drawL` / `drawR` 里自己开的图层（羽化模式下“遮罩里再开图层”同样每个 +1）。重叠期请把前一块的远景合并成 1 层（3.9）。

### 7.2 其它注意

1. **转场镜头不要先铺背景**：重叠期后一块只调用转场函数，背景交给 `drawNext`；否则会把前一块整个盖掉。
2. **拖影 / 透字读画布**：`whipCurtain` 的 `smear` 与 `pageTurn` 的 `see` 读 `g.canvas`，调用顺序决定读到什么（见第 2 节第 5 条）。g 带旋转时拖影自动跳过（画面仍正确，只是少了拖影）。
3. **甩镜方向**：b09→b10 写 `from:'right'`；`dir:'left'` 是带从左往右。
4. **`smokeWipe` 换画面用 `T < tFull`**，不要用返回的 `full`。盖满窗口很短（默认整段 0.3s），换机位只能放在 `tFull` 那一刻。
5. **`burnEdge` 用法 ②** 只能在只含面板的图层里调；在镜头主画布上会把擦除区刷成黑（场景缓冲不透明）。
6. **`burnEdge` 的 rect** 要包住面板全部内容，rect 之外（垂直于推进方向 16px 以外）的内容不会被烧掉。
7. **`impact` 的 `o.seed`** 同时作用于震动与放射线；**`o.color` 是放射线颜色**，闪色请用 `o.flashColor`。闪白保持帧数按 `o.fps`（默认 30）算，60fps 出片时传 `fps: 60`。
8. **`colorSplit`** 要在内容画完之后、界面（kit / 字）之前调用，否则界面也被染色。
9. **羽化圆盖满**：`covers()` 只按几何判断，羽化时边缘仍半透明；终点半径请比 `coverSize/2` 多放约 2.5 × feather，避免最后一帧角上跳变。
10. **心形描边**：`outline:true` 时宽 = size × 0.04，盖满全屏那一刻起不再画描边（`full:true`）。
11. **`splitScreen` / `colorSplit` / `whipCurtain` 的 `ctx` 参数目前未使用**，照传即可（为以后换实现留着）。
12. **粒子预算**：`burnEdge` 每簇 6 片，默认最多 40 簇（单次 burst 6 粒，满足 3.9 的 ≤150 粒/次）。
13. 播放器的字幕用系统中文字体（PingFang / Noto Sans CJK / 微软雅黑），不走项目的子集化字体——因为歌词由用户自备，子集里没有这些字。
14. 播放器控制条是盖在画面底部的 HTML 层：窗口正好 16:9 时，**暂停状态下控制条会挡住字幕带下沿（双行字幕的第二行）**。播放时鼠标 2.5 秒不动控制条自动隐藏，或按 H 手动隐藏；字幕本身始终画在 y ≥ 920 的字幕带里，不会为了让位而上移。
15. 音频比画面短时（例如版本不对），音频播完会自动暂停；再按播放，浏览器会让音频从头开始，画面跟着回到开头。

---

## 8. 模型图清单（`src/sheets/fx.js`）

总时长 20s。出图：

```bash
./tools/lint.sh src/fx/transitions.js src/ui/player.js src/sheets/fx.js docs/api/fx_player.md
node tools/check.mjs sheets --list fx
node tools/render.mjs stills --sheet fx --times 0.5,1.7,2.5,3.5,4.5,5.5,6.5,8.75,10.4,11.4,12.6,13.5,14.5,15.45,16.55,17.3,18.5,19.5 --outdir out/review/sheets/fx --prefix final_
```

| 镜头 id | 区间 | 内容 |
|---|---|---|
| `fx_live_grid` | [0, 2) | 动态九宫格：甩镜帘、心形、翻页、灰烟、燃烧边、撕纸、分屏、分色、冲击 MAX 各一格循环 |
| `fx_page1` | [2, 3) | 第 1 页：甩镜帘 dir:'down'（b02→b03）、from:'right'（b09→b10）、心形（b03→b04）、圆形羽化 40（b14→b15），各 6 个中间帧 |
| `fx_page2` | [3, 4) | 第 2 页：杏仁洞口（b08→b09）、圆窗拉出 invert（b17）、翻页（b16）、灰烟（b10） |
| `fx_page3` | [4, 5) | 第 3 页：燃烧边（b10，p 到 1.3）、撕纸（b02）、撕纸分屏（b11）、左冷右暖（b11） |
| `fx_page4` | [5, 6) | 第 4 页：冲击四级对照（−1 / 命中 / +1 / +2 / +4 / +8 帧） |
| `fx_page5` | [6, 7) | 第 5 页：速度线 6 种、star / keyhole / rect、甩镜 dir:'left' / 'up' |
| `fx_live_impact` | [7, 9) | 整帧实拍：S 7.2 / M 7.7 / L 8.2 / MAX 8.7 真写 `ctx.fx` |
| `fx_full_whip_down` … `fx_full_speed` | [10, 20) 每秒一个 | 整帧检查（和镜头作者同样的写法，传 T 与 t0/t1）：10 甩镜下、11 甩镜右、12 心形、13 翻页、14 灰烟、15 燃烧边、16 撕纸、17 分屏、18 分色、19 速度线；底部纸签印函数名与参数 |

验收图：`out/review/sheets/fx/final_t*.png`（18 张：0.50 / 1.70 九宫格，2.50–6.50 五页，8.75 实拍冲击，10.40–19.50 整帧检查）。同目录的 `t*.png`、`anim.jpg` 是上一轮的旧图（九宫格第三行标签出画），以 `final_` 为准。

### 本次收尾记录（2026-10-01）

- `src/fx/transitions.js`：`impact` 新增可选 `o.frames`（闪白保持帧数，默认仍取预设，旧调用行为不变），给 b11 135.40「flash 1.0 持续 2 帧、shake 26」用；同步更新函数注释。
- `src/sheets/fx.js`：动态九宫格改为格宽 500、行距 326，修好第三行名字标签（splitScreen / colorSplit / impact MAX）掉出画面底边的问题；整帧检查镜头底部纸签（上一位作者已修）复核正常。
- 核对 `docs/engine.md` 最新变更（`--only`、cues 联系表、`tools/check.mjs`、lint 只查指定文件）：对本组没有影响；`check.mjs sheets --list fx` 8 个时刻全部 OK，lint 通过。
- 播放器 4 项升级（LRC 字幕、打点对齐、清晰度、音频偏移）代码齐全；用 `node tools/build.mjs` 打包后在无头 Chrome 里打开 `dist/dalabengba-mv.html` 实测：0 报错；控制条 14 个控件齐全；文件输入载入测试 LRC（双语同时间戳、清屏行、逐字时间、GBK 编码）字幕正确显示在字幕带；`=`/`-`/`0` 偏移 0.10 → 0.05 → 0；Q 清晰度 1.5x（画布 2880×1620）→ 2x → 1x；载入静音 WAV 后 T 打点、空格记 3 个点、Enter 应用，warp 生效并写入 localStorage，下拉框出现「自定义打点（4 个锚点 · silence.wav）」；导入 JSON、导出 JSON 下载均正常。

---

## 播放器使用说明（给最终用户）

打开 `dist/dalabengba-mv.html`（单文件，双击即可）或开发时的 `index.html`。画面下方是控制条；播放时鼠标 2.5 秒不动会自动隐藏，动一下鼠标就回来。

### 快捷键

| 键 | 作用 |
|---|---|
| 空格 / P | 播放 / 暂停（打点模式下空格 = 记录） |
| ← / → | 后退 / 前进 1 秒（按住 Shift 为 5 秒） |
| [ / ] | 跳到上一个 / 下一个提示点（歌词句首） |
| T | 进入打点对齐（再按一次 T 或 Enter 完成并应用） |
| - / = （也可 _ / +） | 音画偏移 −0.05s / +0.05s |
| 0 | 偏移归零 |
| Q | 清晰度 1x → 1.5x → 2x 循环 |
| C | 字幕开 / 关 |
| S | 调试时间戳（真实秒 / 默认秒 / 提示点 / 镜头） |
| H | 隐藏 / 显示控制条 |
| F | 全屏 |
| ? | 快捷键帮助（Esc 或点一下关闭） |

### 载入音频

点「载入音频」选择歌曲文件（mp3 / m4a / wav / flac / ogg 等），或直接把文件拖进窗口。载入后画面跟着音频走。不载音频也能播放（按内部时钟预览）。

### 载入 LRC 字幕

点「载入字幕」选择你自己准备的 `.lrc`（或 `.txt`），也可以拖进窗口。播放器**不内置任何歌词**。
- 字幕显示在画面底部字幕带（y ≥ 920 区域），白字黑描边；同一时刻的两行（如双语）会上下叠放，太长会自动缩小。
- 支持 `[mm:ss.xx]`、一行多个时间戳、`[offset:+200]`（正值让歌词提前，单位毫秒）、带逐字时间的增强 LRC；UTF-8 与 GBK 编码都能读。
- 按 C 或点「字幕」开关。字幕时间按**音频文件时间**算，不受「音画偏移」影响。

### 打点对齐（让画面对上你手里的版本）

1. 先载入音频，拖到开头（或任意位置）。
2. 按 T（或点「打点 T」）：右上角出现打点面板，显示下一个要打的提示点、预计时刻和进度条，音频开始播放。
3. 每听到面板上那一句的开头，按一次空格。面板会闪一下并跳到下一个。画面会边打边预览。
   - ⌫（Backspace）撤销上一个；N 跳过当前这个（按前后的点插值）；P 暂停；←/→ 回退后重打（回退位置之后的点会丢掉）。
4. 按 Enter 或 T 完成：对齐立即生效，并保存在本机浏览器里（「对齐」下拉框里出现「自定义打点」）；Esc 放弃本次打点。
5. 点「导出」得到一个 JSON 文件，可以发给别人；对方点「导入」（或把 JSON 拖进窗口）即可用同一份对齐。
> 浏览器禁止本地存储（如隐私模式）时，打点只在当前页面有效，请记得导出。

### 版本预设

「对齐」下拉框（控制条上的版本选择）里有：原版 3:28（ilem · 洛天依 / 言和）、周深 Live 4:05（近似对齐），以及你打点 / 导入后的「自定义打点」。换成你手里音频对应的版本即可；都对不上时用打点对齐。

### 清晰度

控制条上的「清晰度」下拉框或按 Q：1x（1920×1080，最流畅）/ 1.5x / 2x（3840×2160，最清晰但最吃性能）。电脑卡顿时选 1x。选择会被记住。

### 音频偏移

控制条上的「− 偏移 +0.00s +」或按 - / =，每次 ±0.05 秒（范围 ±5 秒），点数值或按 0 归零。
- 正值 = 画面提前；负值 = 画面推后。用蓝牙耳机时声音有延迟，一般调成负的。
- 偏移只影响画面与声音的对齐，不改变打点数据，也不影响字幕时间。设置会被记住。
