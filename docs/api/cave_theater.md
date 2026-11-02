# 龙洞与纸剧场（cave_theater）API

> 本组文件：`src/env/cave.js`（龙洞布景，b09–b11、b13 E01）、`src/props/cave.js`（鸟笼 / 金币 / 金币堆 / 石碑 / 铁链）、`src/env/theater.js`（纸剧场，b12–b13）。
> 规格出处：`docs/assets.md` 8.7、8.8、9.5；布局出处：`docs/storyboard.md` 4.7、4.8。下文所有参数名、默认值都按源码核对过；与 assets.md 不一致处以本文（= 代码）为准，差异见第 6 节。

---

## 1. 模块与导出一览

### 1.1 `src/env/cave.js`

| 名称 | 类型 | 一句话用途 |
|---|---|---|
| `drawCave(g, T, cam, o)` | 函数 | 龙洞布景，按 `o.layer` 分层画（back / mid / main / fg），五种光照、flat 背景片、碎块、字痕、鸟笼吊链 |
| `drawNameWall(g, T, o)` | 函数 | D3 石碑名字墙（8 + 5 块砸落、熔岩光、120.97 撞碎飞散） |
| `drawCrystal(g, o)` | 函数 | 单个水晶簇（亮度、光晕、glint 扩散光环、闪光） |
| `drawStalactite(g, o)` | 函数 | 单根钟乳石（b10 120.75–120.90 洞顶掉落用） |
| `groundAt(x)` | 函数 | 地面线：世界 x → 地面 y（900 ± 20 起伏） |
| `fromScreen(c, depth, sx, sy)` | 函数 | 屏幕点 → 某深度层世界坐标（`toScreen` 的逆） |
| `caveToLayer(c, depth, sx, sy, o)` | 函数 | 同上，但兼容 flat（传同一个 `o`） |
| `caveToScreen(c, depth, x, y, o)` | 函数 | 某层世界点 → 屏幕，兼容 flat |
| `caveAmbient(o, T)` | 函数 | 某组光照参数下的环境亮度 0..1（给鸟笼、角色压暗用） |
| `CAVE` | 常量 | 布局：地面、入口、各层深度、水晶柱、金币堆、鸟笼、水晶、勇者站位、巨龙姿态落点 |
| `CAMS` | 常量 | 龙洞预设机位（8 个 + `STANDOFF`） |
| `STANDOFF` | 常量 | 对峙构图（b11 136.80 起 = b12 137.40 剧场首帧） |
| `NAME_WALL` | 常量 | 名字墙 13 个槽位（世界坐标）与撞击点 |
| `CRYSTALS` | 常量 | 水晶登记表（id / 层 / 位置，glint 点亮顺序按它算） |

### 1.2 `src/props/cave.js`

| 名称 | 类型 | 一句话用途 |
|---|---|---|
| `drawCage(g, o)` | 函数 | 金鸟笼（门、挂锁三颗锁芯、“正”字刻痕、落地、吊链、摆动；`mini` = 剧场纸板迷你偶） |
| `drawCoin(g, o)` | 函数 | 金币（自转、牙印咬口、闪光） |
| `drawCoinPile(g, o)` | 函数 | 金币堆（鳞片硬币、宝石、高脚杯、珍珠串、闪光） |
| `coinPileShape(o)` | 函数 | 金币堆外轮廓 Path2D（做遮罩 / 压暗） |
| `drawStoneTablet(g, o)` | 函数 | D3 刻字石碑（熔岩光、裂纹、落地挤压、碎片裁剪） |
| `drawChain(g, pts, o)` | 函数 | 沿折线画铁链 / 金链 |
| `dimc(c, light)` | 函数 | 颜色按环境亮度压暗（向 `PAL.shadow` 混） |
| `CAGE` | 常量 | 鸟笼几何（s=1，原点 = 笼心） |

### 1.3 `src/env/theater.js`

| 名称 | 类型 | 一句话用途 |
|---|---|---|
| `drawTheater(g, T, o)` | 函数 | 纸剧场，按 `o.part` 分次画（back / frame / frameFront） |
| `theaterState(T)` | 函数 | b12 / b13 共用的全部时序状态（台口、灯、名字牌、菜单、HP、横幅、机位） |
| `theaterCam(T)` | 函数 | 剧场机位曲线（不含漂移 / 震动） |
| `theaterClip(o)` | 函数 | 剧场盒子裁剪路径（木偶层用，TT-OUT 时不让木杆、龙身伸出剧场） |
| `stageTint(light, k)` | 函数 | 舞台叠色 → `ctx.layer` 的 `tint` 对象 |
| `THEATER` | 常量 | 剧场布局（屏幕坐标 = TT-W） |
| `CAMS` | 常量 | `TT_W`、`TT_OUT` |

---

## 2. 坐标、尺寸与锚点约定

### 2.1 龙洞（`drawCave` 系）

- **世界坐标** = 各层自己的坐标；`cam(960,540,1)` 时所有层与屏幕重合。**镜头不要先 `applyCam`**：`drawCave` 内部按层自己 `applyCam(g, cam, depth)`，`g` 传的是调用坐标系（通常 = 屏幕 / 图层画布）。
- 深度：`back` 0.5（后壁、洞顶、钟乳石、晶脉、洞口）+ 0.6（右上岩架上的后景水晶簇 `bc`）｜`mid` 金币堆 0.8 + 水晶柱 0.85｜`main` 1.0（地面、地面水晶、散落金币、鸟笼吊链、地上碎块）｜`fg` 1.4（前景岩石、前景水晶）。
- **角色与道具一律画在 depth 1**：`lg.save(); applyCam(lg, c, 1); drawHero(...); drawCage(...); lg.restore();`。地面高度用 `groundAt(x)`（`CAVE.groundY = 900` 只是名义值；x=420 处实际 911.8，x=1320 处 898.7）。
- `drawCave` 返回调用坐标系（屏幕）里的关键点：`{ cage, ring, lock, hook, pilePeak, pillarX, hero }`——笼心、吊环顶、挂锁、吊点、金币堆峰、水晶柱 x、勇者站位。flat 模式下也已换算好。
- 本组函数**都没有 `face` 参数**：布景不镜像；鸟笼门固定在左侧（朝勇者）。若确需镜像，调用方自己 `g.scale(-1, 1)`，但“正”字刻痕、挂锁会一起反，不建议。

### 2.2 道具（`src/props/cave.js`）

| 道具 | 锚点 | s=1 尺寸 |
|---|---|---|
| `drawCage` | **笼心** | 180×240（宽 2R=180；吊环顶在笼心上方 135 = `CAGE.ringTop`，笼底上表面 +98 = `CAGE.floorY`，底座下沿 +120 = `CAGE.baseBot`）；门在左，挂锁局部 (−88, 22) |
| `drawCage({mini:true})` | 笼心 | 120×160（穹顶顶 −80、底座 62–80）；吊杆从 −86 往上 `stick`（默认 300） |
| `drawCoin` | 币心 | 半径 `r` = 18 |
| `drawCoinPile` | 底边中心（落地点） | 850×120（`w`×`h`），峰在 `peak` 相对位置 |
| `drawStoneTablet` | 底边中心 | 边长 `size` = 200 |
| `drawCrystal` | 底座中心（贴地 / 贴墙点） | 最高一根约 110 |
| `drawStalactite` | 顶部挂点 | 长 `len` 120、宽 `w` 34 |
| `drawChain` | 折线 `pts` 本身 | 每节 9·s |

- `o.light`（0..1）= 环境亮度，< 1 时颜色向 `PAL.shadow` 压暗（`dimc`）；龙洞里传 `caveAmbient(o, T)`（鸟笼建议 `Math.max(0.15, …)` 免得全黑）。
- 全部函数内部 `save/restore`，不改调用方变换、合成模式与 alpha；不调 `ctx.layer / ctx.mask`；投影只画右下暗色错位，纸片投影由图层给。

### 2.3 纸剧场（`drawTheater` 系）

- **剧场坐标 = TT-W 下的屏幕坐标（1920×1080）**。`drawTheater` 内部 `applyCam(g, o.cam ?? CAMS.TT_W, 1)`，再按 `o.scale` 绕 (960,540) 缩放；**镜头不要先 `applyCam`**。木偶、名字牌、菜单也都写剧场坐标，由镜头自己 `applyCam(lg, st.cam, 1)` + 同样的 `scale`（见 5.4）。
- 台口：顶幕 y 0–150（流苏垂到 172），边幕 x 0–110 / 1810–1920，台唇 y 860–1080，脚灯 6 盏 y≈872；台口内框 x 110–1810、y 150–860；木偶脚底线 y=840（地板槽 `slots.front` 850 / `slots.back` 828）。
- 剧场“盒子”画到 x −80–2000、y −90（檐板下沿 `TOP`）–1080；TT-W（无暗房）时台唇再往画面下沿外多画 160px，叠漂移不露底。TT-OUT 时盒子外是暗房（`room`），并画两侧立柱（x −110–−58 / 1978–2030）、檐板冠饰与底座、书桌。
- 返回 `{ opening:{x0,x1,y0,y1}, lipTop }`：当前台口内框（含 bite 下压 / 上抬后的 y0、y1，剧场坐标）与台唇上沿 y（只有 `part:'frame'` 时按 grow 精确计算）。

---

## 3. 函数详解

### 3.1 `drawCave(g, T, c = CAMS.CV_W, o = {})`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `g` | — | 调用坐标系的 2D 上下文（图层画布） |
| `T` | — | 默认秒（驱动闪烁、光环、火光、碎块下落） |
| `c` | `CAMS.CV_W` | 机位 `cam()` 对象 |
| `o.layer` | 不传 = 全部层 | `'back' \| 'mid' \| 'main' \| 'fg'`；不传时依次画 back→mid→main→fg（flat 时默认不含 fg） |
| `o.light` | `'lit'` | `'dark' \| 'glint' \| 'lit' \| 'battle' \| 'dawn'`，或 `{ from, to, k }` 两种光照插值（k 0..1） |
| `o.glintAt` | `0` | glint：第一簇亮起的时刻（秒） |
| `o.glintC` | `[1320, 330]` | glint：扩散中心（世界坐标，默认 = 笼心），按各簇到中心的距离依次亮 |
| `o.glintSpeed` | `1600` | glint：扩散速度 px/s；每簇亮起用 0.35s，光环 0.9s |
| `o.dawnP` | `1` | dawn：晨光进度 0..1（光束从洞口扫进来、色调转柔粉） |
| `o.flat` | `false` | 剧场背景片：各层按 `flatRef` 机位摆好后当一张平面卡，再按 `c` 的 depth 1 整体变换；整体降饱和到约 0.9 |
| `o.flatRef` | `STANDOFF.cam` | flat 冻结视差时参照的机位 |
| `o.fg` | `false` | 只在 flat 且不传 layer 时有效：是否连 fg 层一起画（默认不画：STANDOFF 下前景晶簇会落到勇者脚边） |
| `o.rubble` | 无 | `{ at = 120.97, cooled = 0 }`：D3 碎块。T ≥ at+0.4 起 14 块从上方落到地面（main）、6 块嵌进后墙（back，at+0.45 起依次弹出），裂缝透余烬；`cooled` 0 = 熔岩亮，1 = 暗红余烬 |
| `o.scorch` | 无 | 数组 `[{ ch, x, y, at, size = 110, rot = 0, screen = false }]`：D2 火焰字撞在洞壁上一闪的字痕（back 层，0.45s 火光 → 2.4s 内焦痕淡出）。`screen:true` 时 x,y 是屏幕坐标，否则是 back 层（0.5）世界坐标 |
| `o.chain` | `true` | 是否画鸟笼吊链（从屏幕上沿外一直到吊环顶）；鸟笼落地 / 剧场背景片时传 `false` |
| `o.cageSwing` | `0` | 吊链绕吊点 (1320,0) 摆动的弧度（鸟笼本体需同步传 `swing` + `pivot: CAVE.cage.hook`） |

返回：`{ cage, ring, lock, hook, pilePeak, pillarX, hero }`（调用坐标系，见 2.1）。

> 注意：`drawCave` **不画鸟笼本体和角色**，只画吊链；鸟笼用 `drawCage` 在主体层画（公主夹在 back / front 两次之间）。

### 3.2 `drawNameWall(g, T, o = {})`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `o.dropAt` | `[...NAME_TIMES('D3a'), ...NAME_TIMES('D3b')]` | 13 个落地时刻（117.66 … 120.706）；每块提前 0.15s 从上方 inQuad 落下，落地即该字时刻 |
| `o.glow` | `1` | 熔岩光强度 0..1（刻痕光 + 地面反光） |
| `o.burst` | `Infinity`（不撞） | 撞碎时刻；b11 传 `120.97`：13 块各碎成 4–5 片带发光字飞散（朝镜头放大、向左上飞，0.6–1.05s 淡出）+ 60 粒碎石 + 撞击闪光 |
| `o.impact` | `NAME_WALL.impact` = `[1180, 520]` | 撞击点（世界坐标），碎片从这里向外、向左飞 |
| `o.cam` | 无 | 传了就内部 `applyCam(g, o.cam, 1)`；不传则按当前变换直接画（调用方已 `applyCam`） |
| `o.light` | `1` | 环境亮度（石面压暗） |

- 槽位（世界坐标，depth 1）：第一排 8 块 200×200，底 y=900，中心 x = 300 + 200·i；第二排 5 块 287.5×287.5，底 y=700，中心 x = 281.25 + 287.5·(j+0.5)。在 `CV_LOW`（不计滚转）下正好是屏幕 8 块 160×160（底 y≈924，x 320–1600）+ 5 块 230×230（底 y≈764，x 385–1535）。
- 落地效果：挤压回弹、左右摆 0.035 rad、地面两道熔岩裂纹 0.3s 蔓延、整体熔岩光随落地块数增强。
- 返回：撞碎前 13 项 `[{ x, y, size, top, landed, hidden? }]`（每块当前底边中心与顶边，调用坐标系；未开始下落的 `hidden:true`）；**撞碎后返回空数组**。

### 3.3 `drawCrystal(g, o = {})`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `x, y` | `0, 0` | 底座中心 |
| `s` | `1` | 缩放（最高一根约 110·s） |
| `n` | `5` | 晶柱根数 |
| `seed` | `1` | 造型种子（同 n+seed 几何缓存复用） |
| `rot` | `0` | 整簇倾斜（弧度） |
| `lit` | `1` | 自身亮度 0..1 |
| `glow` | `= lit` | 光晕强度 |
| `color` | `PAL.crystal` | 晶体色 |
| `light` | `1` | 环境亮度（压暗底座岩石与暗面） |
| `ring` | `-1` | glint 扩散光环进度：−1 无；0..1 两圈椭圆环向外扩散 |
| `t` | `0` | 秒，驱动尖端闪光 |
| `base` | `true` | `true` 画岩石底座；`'socket'` 只压一道墙缝（墙上晶簇）；`false` 不画 |
| `alpha` | `1` | 透明度 |

返回：无（`undefined`）。

### 3.4 `drawStalactite(g, o = {})`

参数：`x, y`（顶部挂点）、`len = 120`、`w = 34`、`seed = 1`、`light = 1`、`alpha = 1`、`rot = 0`。返回：无。下落轨迹由镜头算（例如 `y = y0 + 0.5·2000·age²`）。

### 3.5 其它 cave.js 工具

- `groundAt(x)`：`900 + 10·sin(0.0043x+0.6) + 6·sin(0.0121x+2.2) + 3·sin(0.029x+0.4)`。
- `fromScreen(c, depth, sx, sy)` → `[x, y]`：屏幕点 → 该深度世界点（含滚转）。
- `caveToLayer(c, depth, sx, sy, o = {})` / `caveToScreen(c, depth, x, y, o = {})`：与 `drawCave` 同一套 flat 换算；flat 时传同一个 `o`（含 `flat` / `flatRef`）。
- `caveAmbient(o = {}, T = 0)` → 环境亮度：dark 0.05｜glint 0.06 → 0.56（随亮起的簇数）｜lit 1｜battle 0.92｜dawn 1；`{from,to,k}` 时线性插值。

### 3.6 `drawCage(g, o = {})`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `x, y` | `0, 0` | 笼心（龙洞里 `CAVE.cage` = (1320,330)） |
| `s` | `1` | 缩放 |
| `rot` | `0` | 绕笼心旋转（弧度） |
| `part` | `'all'` | `'back'` = 笼底 + 后排环与栏杆（+ 落地投影）；`'front'` = 前排栏杆、环、底座围带、尖饰吊环、门、挂锁、刻痕、链；公主夹在两次调用之间画 |
| `door` | `0` | 0..1：左侧门向外打开 0→115°（>0.05 时门框栏杆让位、挂锁跟着门走） |
| `lock` | `{}` | `{ pins = 0（已撬开的锁芯数 0..3）, open = false（锁梁弹开）, flash = 0（亮芯光晕 0..1） }` |
| `tally` | `0` | “正”字刻痕的笔画数（每 5 画一个正，最多 20），刻在笼底围带右半 |
| `onFloor` | `false` | 落地：接地投影 + 链子松垂在右侧地上（不再画直链） |
| `chain` | `0` | 吊环上方画多长的直链（px，s=1）；`true` = 200 |
| `swing` | `0` | 绕 `pivot` 摆动的弧度 |
| `pivot` | 链顶（无链 = 吊环顶） | 摆动支点，调用方坐标；龙洞里与吊链同步时传 `CAVE.cage.hook` |
| `squash` | `0` | 落地挤压：>0 压扁（宽 ×(1+0.5·squash)、高 ×(1−squash)）、<0 拉长，以底座下沿为锚（b02 L04 鸟笼扣下）；仅完整版，mini 不支持 |
| `mini` | `false` | 剧场迷你偶（纸板镂空版 120×160，金卡纸 + kraft 厚边 + 木签吊杆） |
| `stick` | `300` | 仅 mini：木签吊杆长（从吊环 −86 往上） |
| `light` | `1` | 环境亮度 |
| `alpha` | `1` | 透明度 |

返回：`{ ring, floor, lock, door, center }`（调用坐标系）：吊环顶、笼底中心（= 公主脚底，龙洞里 (1320,428)）、挂锁中心、门外沿中点、笼心；mini 另有 `stickTop`（mini 的 `floor` = 笼心 + (0,62)·s）。

### 3.7 `drawCoin(g, o = {})`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `x, y` | `0, 0` | 币心 |
| `s` | `1` | 缩放 |
| `r` | `18` | s=1 半径 |
| `rot` | `0` | 平面旋转 |
| `spin` | `0` | 绕竖轴自转（弧度）：scaleX = \|cos\|，侧面露厚度；cos<0 时是背面（一圈圆点） |
| `bite` | `0` | 0..1 右上牙印咬口大小（b07 马咬金币） |
| `flash` | `0` | 0..1 左上四角星闪光 + 金色光晕 |
| `light` | `1` | 环境亮度 |
| `alpha` | `1` | 透明度 |
| `t` | `0` | 秒（闪光星旋转） |

返回 `{ x, y, r: r·s }`。

### 3.8 `drawCoinPile(g, o = {})` / `coinPileShape(o = {})`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `x, y` | `0, 0` | 底边中心 |
| `w, h` | `850, 120` | 宽、峰高 |
| `peak` | `0.53` | 峰在宽度上的相对位置 0..1 |
| `s` | `1` | 缩放 |
| `seed` | `7` | 造型种子 |
| `sparkleT` | `0` | 闪光时钟（传 `T`） |
| `light` | `1` | 环境亮度 |
| `glint` | `1` | 闪光强度 |
| `gems` | `true` | 是否画宝石、高脚杯、珍珠串 |
| `alpha` | `1` | 透明度 |

返回 `{ peak:[x,y], left:[x,y], right:[x,y], top(u) }`（`top(u)` = 相对 x 偏移 u 处的堆顶 y）。龙洞里由 `drawCave` 的 mid 层以 `x=1675, y=900, w=850, h=120, peak=0.5294` 调用 → 峰 (1700,780)，镜头不用再画。`coinPileShape` 参数相同，返回调用方坐标的 Path2D。

### 3.9 `drawStoneTablet(g, o = {})`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `x, y` | `0, 0` | 底边中心 |
| `size` | `200` | 边长 |
| `char` | `''` | 刻的字（`paperGlyph` 'stone' 样式：刻槽 + 熔岩光） |
| `charSize` | `0.72·size` | 字号 |
| `glow` | `0` | 刻痕熔岩光 0..1 |
| `crack` | `0` | 裂纹蔓延 0..1 |
| `seed` | `1` | 造型种子 |
| `rot` | `0` | 旋转 |
| `s` | `1` | 缩放 |
| `squash` | `0` | 落地挤压（>0 压扁、以底边为锚） |
| `light` | `1` | 环境亮度 |
| `alpha` | `1` | 透明度 |
| `t` | `0` | 秒（熔岩光闪烁） |
| `clip` | `null` | 局部坐标 Path2D：只画这块形状内（碎片用，自动画断口石茬） |

返回 `{ top:[x,y], center:[x,y] }`。

### 3.10 `drawChain(g, pts, o = {})` / `dimc(c, light = 1)`

- `drawChain`：`pts` 折线（调用方坐标），`o: { s = 1, light = 1, gold = false（金链）, alpha = 1 }`；每 9·s 交替正面环 / 侧面环。返回链节数。
- `dimc(c, light)`：`light ≥ 0.999` 原色，否则 `mixHex(c, PAL.shadow, (1−light)·0.86)`。

### 3.11 `drawTheater(g, T, o = {})`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `o.part` | `'frame'` | `'back'`（暗房墙〔room 时〕+ 剧场内壁 + 压平的山洞背景片〔`drawCave` flat〕+ 吊杆 + 舞台光 + 舞台地板）／`'frame'`（主幕、台口内叠色与脚灯光、咬合黑缝、边幕、顶幕、〔room 时〕书桌与剧场外框、台唇与脚灯）／`'frameFront'`（名字之剑穿过时盖在剑前的撕口布边） |
| `o.grow` | `1` | 0..1 宽银幕黑边长成台口（0 = 上下各 138.3px 近黑条；1 = 完整台口）；内部错峰：黑转丝绒 0–0.58、流苏 0.29–0.71、穗子 0.55–0.85、边幕滑入 0.19–0.87、台唇长高 0.1–0.7、脚灯 0.38 起逐盏点亮、背景片缩到 0.92 在 0.2–0.9、地板 0.35–0.8 |
| `o.curtain` | `0` | 主幕合拢 0..1（1 = 在 x=960 合上；>1 继续挤压 26px/单位） |
| `o.curtainSway` | `0` | 主幕下摆晃动量（theaterState 给 `wobble`） |
| `o.bite` | `0` | 台口咬合 0..1（1 = 顶幕下压 362、台唇上抬 314，在中线相遇，中间压成黑缝；允许 <0 的弹簧余振） |
| `o.wingTear` | `0` | 0..1 右侧边幕在 y≈560 被剑尖横向撕开（锯齿口随剑尖长大） |
| `o.wingTearUp` | `0` | 0..1 撕口上沿往上扩到檐板（剑竖起时一路撕开右侧边幕） |
| `o.valance` | `'whole'` | `'whole' \| 'torn' \| 'halves'` |
| `o.tearP` | torn/halves 时 1，否则 0 | 顶幕竖向撕口进度 0..1（从流苏往上撕） |
| `o.tearX` | `600` | 撕口 x（= 名字之剑护手 x） |
| `o.fallAt` | `Infinity` | halves：两半开始掉落的时刻（0.55s 内绕外侧角落下 1300px） |
| `o.splitX` | `960` | halves：劈开线 x |
| `o.floorCrack` | `0` | 0..1 舞台地板（back）与台唇（frame）沿 `splitX` 裂开：先往下蔓延再张开（B11 157.17） |
| `o.light` | `'warm'` | `'warm' \| 'purple' \| 'off'`；只用来推 `lightK` / `offK` 的默认值 |
| `o.lightK` | purple 时 1，否则 0 | 紫灯程度 0..1（台口内 multiply `PAL.dragon` α0.18·k，脚灯与光束转紫） |
| `o.offK` | off 时 1，否则 0 | 熄灯程度 0..1（台口内 multiply `PAL.ink` α0.35·k，脚灯灭） |
| `o.room` | `cam.zoom < 0.995` | 画剧场外暗房（back：墙纸、夜窗、台灯光，depth 0.75）与书桌、檐板冠饰、底座（frame） |
| `o.scale` | `1` | 整座剧场绕 (960,540) 缩放（E01 1→1.8） |
| `o.cam` | `CAMS.TT_W` | 剧场机位 |
| `o.cave` | `STANDOFF.caveOpts` | back 里传给 `drawCave` 的参数（内部强制 `flat:true, chain:false`）；也认 `o.caveOpts`（= theaterState 的字段名） |
| `o.tasselSwing` | `0` | 角穗额外摆角（弧度） |

返回：`{ opening:{ x0:110, x1:1810, y0:150+dy, y1:860−dyB }, lipTop }`。

### 3.12 `theaterState(T)`

b12 / b13 共用的唯一时序源（137.40–161.50），接缝 150.52 两侧调用同一函数即逐帧一致。返回：

| 字段 | 内容 |
|---|---|
| `grow` | `seg(T, 137.40, 137.92)` 台口生长 |
| `rods` | `seg(T, 137.85, 138.05)` 木偶木杆淡入 0..1 |
| `turn` | `'hero'`（< B05 145.23，及 153.30–160.30）／`'enemy'`（145.23–153.30）／`'victory'`（≥ 160.30） |
| `banner` | `{ text, prev, flip, drop, smash }`：当前横幅字、翻牌前的字、翻牌进度（B05、153.30、160.30 各 0.2–0.3s；稳定时 1）、吊落弹簧（137.92 起）、`smash` = 160.30–160.45 被「胜利！」砸掉 |
| `heroPlate` | `{ drop, state, progress, stutter, crack, pulse, gold, peeled, peelTimes, restore }`：`state` 见 4.3；`progress` 走马灯进度（B02–B03 滚全名；B08–B09 每 0.2s 跳一格）；`stutter` B08–B09 时 `{ step, jolt, slip }`，其余 `null`；`crack` 150.60 裂开 → 160.40–160.90 合上；`pulse` 152.60–153.45 四下心跳；`gold` B02–B03 亮金边；`peeled` 已剥下的字数（B10 段 13 个时刻 `peelTimes`）；`restore` 160.40–160.90 字飞回 |
| `dragonPlate` | `{ drop, state, progress, flashRed, shrink, popAt, popped, fall, landAt }`：`drop` 137.98 起（晚 60ms）；`progress` B04–B05、B06–B07、B12–E01；`flashRed` 受击 / 暴怒红闪；`shrink` B12–160.20 缩小；`popAt` 13 个弹飞时刻（157.80 起每 0.2s）、`popped` 已弹飞节数；`fall` 160.50–160.75 牌子掉下、`landAt` 160.75 |
| `menu` | `{ show, cursor, cursorMove, flash, press, locked, lockDrop, lockPop, gray, submenu:{ text:'名字之剑', p, select } }`：`show` 137.95–138.15 outBack 弹出、160.30–160.55 收起；`cursor` `'attack'`→153.30 起 `'skill'`；`flash` 139.40；`press` 140.30 与 B09；`locked` 敌方回合；`lockDrop` / `lockPop` 小锁挂上 / 弹掉；`gray` 变灰 0..1；`submenu.p` B09 弹出、153.95–154.25 收起，`select` 153.65 |
| `hp` | `{ hero, heroLag, heroNum, heroCritical, dragon, dragonLag }`：hero 1 → 0.6（149.50–150.40）→ 0.01（150.60–152.60），`heroNum` 100→60→1（显示用整数，最小 1），`heroCritical` ≥152.60；dragon 142.00 掉到 0.7、157.35–157.45 清零，`dragonLag` 滞后缩条 |
| `light` / `lightK` / `offK` | `'warm' \| 'purple' \| 'off'`；`lightK` B05 起 0.22s 转紫、153.30–153.60 回暖；`offK` 160.90–161.10 熄灯 |
| `curtain` / `curtainSway` | 160.60–161.10 合拢（inOutCubic），161.13–161.40 拉开；161.10 起下摆 `wobble` |
| `bite` | B07 149.33–149.48 inExpo 合上，保持到 149.80，之后弹簧弹开（有负值余振） |
| `scale` | 161.13–161.50 inCubic 1→1.8 |
| `wingTear` / `wingTearUp` | 156.00–156.25 横向撕口；156.80–156.92 撕口上扩 |
| `valance` / `tearP` / `fallAt` / `splitX` | `'whole'` → 156.80 `'torn'` → 157.17 `'halves'`；`tearP` 156.82–157.08；`fallAt` 157.40；`splitX` 960 |
| `floorCrack` | 157.20–157.32 outCubic 0→1（舞台地板沿斩线裂开） |
| `cam` / `room` | `theaterCam(T)`；`room = cam.zoom < 0.995` |
| `caveOpts` | 背景片参数 `{ light:'battle', rubble:{ at:120.97, cooled: 0.6→0.85（137.40–150.00）} }` |

> 字段名与 `drawTheater` 的参数同名（`caveOpts` 也被 drawTheater 认作 `cave`），可以直接展开：`drawTheater(lg, T, { ...st, part: 'back' })`。

### 3.13 `theaterCam(T)` / `theaterClip(o)` / `stageTint(light, k)`

- `theaterCam(T)`：< 141.28 TT-W｜B03 141.28–141.36 snap 1→1.15、→141.60 回 1.05、→142.40 glide 回 1｜153.78–155.80 glide 推到 1.04｜156.40–157.00 glide 拉到 TT-OUT｜157.80–158.60 glide 回 TT-W。不含漂移 / 震动，镜头自己叠 `drift`。
- `theaterClip(o = {})`：`o.cam`（默认 TT-W）、`o.scale`（默认 1）与 `drawTheater` 一致；返回屏幕坐标 Path2D（剧场盒子 x −80–2000、y −90–1076）。木偶层 `lg.clip(theaterClip({ cam: st.cam, scale: st.scale }))`；名字之剑不要裁（它就是要捅出去）。
- `stageTint(light = 'warm', k = 1)`：`'purple'` → `{ color: PAL.dragon, alpha: 0.18·k, mode: 'multiply' }`；`'off'` → `{ color: PAL.ink, alpha: 0.35·k, mode: 'multiply' }`；`'warm'` → `null`。`part:'frame'` 已在台口内叠过，一般只给台口外（TT-OUT 时伸出去的东西）或木偶层单独用。

---

## 4. 枚举全表

### 4.1 `drawCave` 的 `layer`

| 值 | 内容 | 建议图层 |
|---|---|---|
| `'back'` | 后壁岩体、洞口夜空 / 晨光、洞顶、钟乳石、晶脉、墙上水晶、墙内碎块、字痕；+ 0.6 岩架水晶 | `{ shadow: 6, texture: 0.3 }` |
| `'mid'` | 金币堆（0.8）、水晶柱（0.85）、黎明光束 | `{ shadow: 8, texture: 0.3 }` |
| `'main'` | 地面、石笋、散落金币、地面水晶、鸟笼吊链、地上碎块；角色 / 鸟笼 / 名字墙也画在这一层 | `{ shadow: 10, texture: 0.3 }` |
| `'fg'` | 前景岩石、前景水晶、二道光束 | `{ blur: 4 }`（前景虚化层每帧 ≤1） |

### 4.2 `drawCave` 的 `light`

| 值 | 一句话 | 用在 |
|---|---|---|
| `'dark'` | 近黑，只有左 w1、右 bc 两簇水晶微弱闪烁（环境 0.05） | b09_dark 98.60–99.97 |
| `'glint'` | 从 `glintC`（默认鸟笼）按距离逐簇亮起，每簇一圈扩散光环；环境 0.06→0.56 | b09_eye V14 99.97 起 |
| `'lit'` | 水晶全亮、正常色 | b09 102.10 后、b10 全块（含 D3） |
| `'battle'` | 左冷（magic / crystal）右暖（fire，火光闪动），环境 0.92 | b11、b12–b13 剧场背景片（`STANDOFF.caveOpts`） |
| `'dawn'` | 左侧洞口斜射 princessLight→goldLight 光束 + 浮尘，色调转柔粉；`dawnP` 驱动扫入 | b13_rescue 162.00–163.20 |
| `{from,to,k}` | 两种光照插值（环境 / 冷暖 / 黎明 / 每簇亮度线性混） | glint→lit（102.10–102.60）、battle→dawn（E01） |

### 4.3 剧场相关

| 枚举 | 值 | 说明 / 用在 |
|---|---|---|
| `part` | `'back'` / `'frame'` / `'frameFront'` | 见 3.11；b12、b13 每帧都是三次调用 |
| `valance` | `'whole'` | 完整顶幕（b12 全块、b13 至 156.80） |
| | `'torn'` | 竖起的剑从 `tearX` 往上撕开（156.80–157.17） |
| | `'halves'` | B11 157.17 劈成两半，`fallAt` 157.40 起各自掉下（配 `floorCrack` 地板裂开） |
| `light` | `'warm'` | 暖脚灯（默认；b12 至 B05、b13 153.30 起） |
| | `'purple'` | 敌方回合紫灯（b12 B05 145.23 – b13 153.30） |
| | `'off'` | 熄灯（b13 160.90–161.10，合幕时） |
| `turn` | `'hero'` / `'enemy'` / `'victory'` | 回合横幅「勇者的回合」/「敌方回合」/「胜利！」 |
| `heroPlate.state` | `'idle'` | < B02，及 B03–B08 |
| | `'active'` | B02–B03 亮金边滚全名；160.40 后复原 |
| | `'cracked'` | B08–B10 裂开卡顿 |
| | `'empty'` | B10–160.40 字被剥光 |
| `dragonPlate.state` | `'idle'` / `'hit'`（B04–B05）/ `'angry'`（B06–B07）/ `'cracked'`（≥157.35） | |
| `menu.cursor` | `'attack'` / `'skill'` | 153.30 起跳到技能 |

### 4.4 道具

| 枚举 | 值 | 说明 / 用在 |
|---|---|---|
| `drawCage.part` | `'all'` / `'back'` / `'front'` | 有公主时必须 back → 公主 → front（b09、b11、b13） |
| `drawCage.lock.pins` | 0 / 1 / 2 / 3 | b09 0（正在撬）→ b11 131.20 第一颗撬开 1 → E01 `open:true` |
| `drawCage.mini` | `true` | b12–b13 右上吊杆迷你偶（`THEATER.cage` (1480,330)） |
| `drawCrystal.base` | `true` / `'socket'` / `false` | 地面簇 / 墙上簇 / 不要底座 |

### 4.5 `STANDOFF.pose`（给木偶的推荐姿态名，均已在各 rig 里存在）

`hero: 'stance'`（hero.js）、`dragon: 'standoff'`（dragon.js）、`princess: 'caged'`（princess.js）。

---

## 5. 推荐用法

### 5.1 龙洞标准分层（b09：暗 → 水晶依距离亮起 → 全亮）

```js
import { drawCave, CAMS, CAVE, caveAmbient, groundAt } from '../env/cave.js';
import { drawCage } from '../props/cave.js';
import { cam, applyCam, drift } from '../core/camera.js';
import { seg } from '../core/util.js';

// drift 返回 [dx, dy] 向量（不是机位），叠到预设机位上：
const withDrift = (c0, T) => { const [dx, dy] = drift(T, { amp: 5, speed: 0.35 }); return cam(c0.x + dx, c0.y + dy, c0.zoom, c0.rot); };
const c = withDrift(CAMS.CV_W, T);
const o = { light: T < 102.1 ? 'glint' : { from: 'glint', to: 'lit', k: seg(T, 102.1, 102.6) }, glintAt: 99.97 };
ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawCave(lg, T, c, { ...o, layer: 'back' }));
ctx.layer(g, { shadow: 8, texture: 0.3 }, (lg) => drawCave(lg, T, c, { ...o, layer: 'mid' }));
ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
  drawCave(lg, T, c, { ...o, layer: 'main' });                 // 含鸟笼吊链
  const L = Math.max(0.15, caveAmbient(o, T));
  lg.save(); applyCam(lg, c, 1);
  const cg = { x: CAVE.cage.x, y: CAVE.cage.y, light: L, tally: 12, lock: { pins: 0 } };
  drawCage(lg, { ...cg, part: 'back' });
  drawPrincess(lg, { x: CAVE.cage.floor[0], y: CAVE.cage.floor[1], s: CAVE.cage.princessS, face: -1, t: T, pose: 'caged' });
  drawCage(lg, { ...cg, part: 'front' });
  drawHero(lg, { x: CAVE.hero.x, y: groundAt(CAVE.hero.x), s: 1, face: 1, t: T });
  lg.restore();
});
ctx.layer(g, { blur: 4 }, (lg) => drawCave(lg, T, c, { ...o, layer: 'fg' }));
```

### 5.2 D3 名字墙 → 120.97 撞碎（b10 结尾 / b11 开头隐形接缝）

```js
import { drawCave, drawNameWall, CAMS } from '../env/cave.js';
import { lerpCam } from '../core/camera.js';
import { ez, glide } from '../core/ease.js';

// b10：CV-LOW → CV-LOW-END（117.70–120.90 缓推 + 荷兰角加深）；b11 第一帧用同一机位与同一函数
const c = lerpCam(CAMS.CV_LOW, CAMS.CV_LOW_END, ez(T, 117.7, 120.9, glide));
const o = { light: 'lit', rubble: { at: 120.97, cooled: 0 } };   // b10 传 rubble 也无妨：120.97+0.4 之前不画
ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
  drawCave(lg, T, c, { ...o, layer: 'main' });
  // 巨龙 wall 姿态画在墙后（先画龙，再画墙）
  drawNameWall(lg, T, { cam: c, glow: 1, burst: 120.97 });       // dropAt 默认取 NAME_TIMES('D3a'/'D3b')
});
```

### 5.3 STANDOFF：b11 结尾对峙 = b12 剧场首帧

```js
import { drawCave, STANDOFF } from '../env/cave.js';
// b11 136.80–137.92：带黑边的对峙全景（ctx.fx.letterbox = 1 → 黑边 138.3px）
const c = STANDOFF.cam;                       // cam(732.01, 567.46, 0.88436)，由屏幕落点反解
ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawCave(lg, T, c, { ...STANDOFF.caveOpts, layer: 'back' }));
// …mid / main 同理；勇者脚底世界坐标 STANDOFF.world.hero（屏幕 (520,840)），龙头 STANDOFF.world.dragonHead
// 姿态 STANDOFF.pose.hero / .dragon / .princess；朝向 STANDOFF.face
// b12 137.40 起：drawTheater({ grow: 0 }) 的背景片就是 drawCave({ ...STANDOFF.caveOpts, flat: true }) 按同一机位冻结
```

### 5.4 纸剧场一帧（b12 / b13 通用写法，接缝靠 theaterState）

```js
import { drawTheater, theaterState, theaterClip, THEATER } from '../env/theater.js';
import { cam as mkCam, applyCam, drift } from '../core/camera.js';

const st = theaterState(T);
const [dx, dy] = drift(T, { amp: 4, speed: 0.35 });
const cam = mkCam(st.cam.x + dx, st.cam.y + dy, st.cam.zoom, st.cam.rot);
const o = { ...st, cam };                                           // 字段名与 drawTheater 参数同名（caveOpts 自动当 cave）
const stage = (lg) => { applyCam(lg, cam, 1); if (st.scale !== 1) { lg.translate(960, 540); lg.scale(st.scale, st.scale); lg.translate(-960, -540); } };

ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawTheater(lg, T, { ...o, part: 'back' }));
ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {                // 木偶：裁进剧场盒子
  lg.save(); lg.clip(theaterClip({ cam, scale: st.scale })); stage(lg);
  drawCage(lg, { x: THEATER.cage.x, y: THEATER.cage.y, mini: true, part: 'back', lock: { pins: 1 } });
  drawPrincess(lg, { x: THEATER.cage.x, y: THEATER.cage.y + 62, s: 0.5, face: -1, t: T, pose: 'puppetCage' });
  drawCage(lg, { x: THEATER.cage.x, y: THEATER.cage.y, mini: true, part: 'front', lock: { pins: 1 } });
  drawHero(lg, { x: THEATER.hero.x, y: THEATER.hero.y, s: 1, face: 1, t: T, rod: true, pose: 'puppetStand' });
  lg.restore();
});
ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawTheater(lg, T, { ...o, part: 'frame' }));
ctx.layer(g, { shadow: 10, texture: 0.2 }, (lg) => {
  lg.save(); stage(lg); drawNameSword(lg, { x: 600, y: 560 /* … */ }); lg.restore();   // 剑不裁
  drawTheater(lg, T, { ...o, part: 'frameFront' });                 // 撕口布边盖在剑前
  // 名字牌 / 菜单 / 横幅：同样 stage(lg) 后按 st.heroPlate / st.dragonPlate / st.menu / st.banner / st.hp 画
});
```

### 5.5 黑边长成台口（b11 → b12 交接 137.40–137.92）

```js
// b12 从 137.40 起接管：ctx.fx.letterbox = 0，自己画同尺寸黑条（grow = 0 时就是上下 138.3px 近黑条）
const st = theaterState(T);                   // st.grow = seg(T, 137.40, 137.92)
ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawTheater(lg, T, { ...st, part: 'back' }));
// 木偶层：137.40 时木偶落点 = STANDOFF.hero / dragonHead / cage（屏幕坐标 = 剧场坐标）；137.85 起木杆淡入（st.rods）
ctx.layer(g, { shadow: 8, texture: 0.25 }, (lg) => drawTheater(lg, T, { ...st, part: 'frame' }));
```

### 5.6 E01 黎明山洞 + 落地鸟笼 + 金币

```js
import { drawCave, CAVE } from '../env/cave.js';
import { drawCage, drawCoin } from '../props/cave.js';
const c = cam(1300, 420, 1.5);
const o = { light: { from: 'battle', to: 'dawn', k: seg(T, 161.13, 161.6) }, dawnP: seg(T, 162.0, 163.2),
            rubble: { at: 120.97, cooled: 0.85 + 0.15 * seg(T, 161.13, 163) }, chain: false };
// …四层同 5.1；鸟笼落地（CAVE.cage.landed = 底座下沿贴地的笼心 (1320, 778.7)）：
drawCage(lg, { x: CAVE.cage.landed[0], y: CAVE.cage.landed[1], onFloor: true, door: seg(T, 161.0, 161.3),
               lock: { pins: 3, open: true }, tally: 12, light: 1 });
// b07 金币：自转 + 马咬一口
drawCoin(lg, { x, y, spin: T * 9, bite: seg(T, t0, t0 + 0.12), flash: hit(T, t1, 0.3), t: T });
```

---

## 6. 与 assets.md 的差异

| 项 | assets.md | 实际实现 |
|---|---|---|
| 挂锁位置 | (1232,350) | `CAVE.cage.lock = [1232, 352]`（= 笼心 + `CAGE.lock` (−88,22)）；吊环顶 `CAVE.cage.ring` = (1320,195)、笼底 `CAVE.cage.floor` = (1320,428) |
| cave `CAMS` | 8 个 | 另加 `CAMS.STANDOFF`（= `STANDOFF.cam`） |
| cave 额外导出 | — | `drawStalactite`、`groundAt`、`fromScreen`、`caveToLayer`、`caveToScreen`、`caveAmbient`、`NAME_WALL`、`CRYSTALS` |
| `drawCave` 参数 | layer / light / flat / rubble / scorch | 另有 `glintAt`、`glintC`、`glintSpeed`、`dawnP`、`flatRef`、`fg`、`chain`、`cageSwing`；`light` 可传 `{from,to,k}`；`rubble` 是 `{at, cooled}`；`scorch` 是数组 |
| `drawCave` 返回 | 未写 | `{ cage, ring, lock, hook, pilePeak, pillarX, hero }` |
| flat | 冻结视差、合成一层、sat 0.9 | 默认参照 `STANDOFF.cam`（`flatRef` 可改），**默认不含 fg 层**（`fg:true` 可加） |
| `drawNameWall` | dropAt / glow / burst | 另有 `impact`、`cam`、`light`；撞碎后返回空数组 |
| `STANDOFF` | 屏幕落点 + 对应机位与姿态 | 机位由落点反解：`cam(732.01, 567.46, 0.88436)`；另带 `world`（depth 1 世界坐标）、`face`、`pose`、`letterbox: 138.3`、`caveOpts` |
| 9.5 `drawCage` | door / lock / tally / onFloor / chain / mini | 另有 `part`、`swing`、`pivot`、`squash`（本轮新增）、`stick`、`rot`、`light`、`alpha`；`lock.flash`；`chain` 是长度（px）或 `true`=200 |
| `CAVE.cage` | 吊点 / 笼心 / 尺寸 / 挂锁 | 另有 `ring`、`floor`、`door:'left'`、`princessS: 0.78`、`landed`（本轮新增：落地笼心） |
| 9.5 `drawCoin` | spin / bite / flash | 另有 `r`（默认 18）、`rot`、`light` |
| 9.5 `drawCoinPile` | sparkleT | 另有 `w/h/peak/seed/light/glint/gems`；另导出 `coinPileShape` |
| 9.5 `drawStoneTablet` | size / char / glow / crack | 另有 `squash`、`clip`、`charSize`（默认 0.72·size）、`seed`、`light` |
| 9.5 额外导出 | — | `drawChain`、`dimc`、`CAGE` |
| `drawTheater` 参数 | grow / part / curtain / bite / wingTear / valance / light / room / scale | 另有 `wingTearUp`、`tearP`、`tearX`、`fallAt`、`splitX`、`floorCrack`（本轮新增）、`lightK`、`offK`、`curtainSway`、`cam`、`cave`（也认 `caveOpts`）、`tasselSwing`；`valance` 的 fallAt 是独立参数 |
| theater 额外导出 | — | `theaterCam`、`theaterClip`、`stageTint` |
| `theaterState` | turn / heroPlate{progress,state} / dragonPlate{progress,state} / menu{cursor,locked,submenu} / hp{hero,dragon} | 超集，见 3.12（另含台口、灯、机位、背景片参数） |
| 紫灯 | tint dragon α0.18 | `part:'frame'` 内已在台口内 multiply 叠过；`stageTint` 给额外图层用 |

---

## 7. 已知限制与注意事项

- **性能**：龙洞几何（岩体、钟乳石、晶簇、金币堆、石碑、鸟笼）首次调用时按固定种子建好并缓存（纯记忆化，不影响确定性），之后每帧只换颜色。剧场 `part:'back'` 每帧调用一次 `drawCave` flat（三层合一），是剧场最重的一步；剧场一帧建议 4 个图层（back / 木偶 / frame / 剑+frameFront+界面）。`light:'dark'` 与 `glint` 用整层 multiply 压暗，不额外开图层。
- **glint → lit 会跳**：glint 全亮后环境亮度只有 0.56，而 lit 是 1；切换时用 `{ from:'glint', to:'lit', k }` 过渡（storyboard 102.10–102.60 正好有这段）。
- **角色不会被布景压暗**：暗光照下角色请用图层 tint（例：`tint: { color: PAL.ink, alpha: 0.8 * (1 - caveAmbient(o, T)), mode: 'multiply' }`），鸟笼传 `light`。
- **吊链与鸟笼分开画**：`drawCave` 只画链；`cageSwing` 摆动时鸟笼要传同样的 `swing` 和 `pivot: CAVE.cage.hook`，否则链和笼脱节。鸟笼落地（E01）时 `drawCave` 传 `chain:false`。
- **名字墙**：槽位是 depth 1 世界坐标，屏幕尺寸只在 `CV_LOW` 下精确（滚转会让整排略微倾斜）；巨龙 `wall` 姿态必须先于名字墙画（墙在龙前）。撞碎后返回空数组，碎片与碎石只活约 1.4s，此后地上 / 墙上的残块由 `drawCave` 的 `rubble` 接手（同一个 120.97）。
- **flat 与正常分层不完全逐像素一致**：flat 默认不含 fg 层且整体降饱和约 10%。b11 在 136.80 起的 STANDOFF 段若要和 b12 137.40 首帧对齐，fg 层应在 137.40 前淡出或不画。
- **TT-OUT（本轮已核对）**：暗房只在 `room` 为真时画（默认 `cam.zoom < 0.995`）；`theaterCam` 拉远到 0.995 以下时可见范围仍在剧场盒子内，所以开关不会跳。TT-OUT 可见剧场坐标约 x −588–2508、y −451–1291（`THEATER.roomView` 留了余量 −600–2520 × −470–1300；暗房墙在 depth 0.75 画到 ±3000 以外，书桌画到 y 2200）。逐像素透明检查：TT-OUT ±10px 漂移、torn / halves 掉落中 / 掉完、theaterCam 156.5–158.55 全程、TT-W ±6px 漂移、bite 1 / −0.2、grow 0 / 0.5、scale 1.8、合幕熄灯，均 0 空白像素（修掉了 TT-W 向下漂移 ≥1px 与 158.55 回拉末帧底边露 1–6 行的问题）。木偶层必须 `clip(theaterClip(...))`，否则龙偶长身体、勇者围巾会伸到剧场外；裁切直边 x=−80 / 2000 正好藏在两侧立柱下。
- **剧场 bite / scale / room 不要叠用**：bite 只为 TT-W 设计；scale > 1（E01 穿越台口）时 back 层背景片也一起放大，E01 镜头应在台口内换画真正的多层山洞。
- **halves**：撕口布边（frameFront）在 `fallAt + 0.02` 后不再画；两半顶幕掉落时画在台唇、书桌之下。顶幕掉了以后可以看到背景片上沿的吊杆与三根吊绳（设计如此）。
- **迷你鸟笼**：门只是一片翻开的卡纸，没有 `tally`、`onFloor`、`chain`、`squash`；返回点里 `floor` 在笼心下方 62·s。
- **E01 机位与落地鸟笼**：storyboard 的 E01 机位 `cam(1300,420,1.5)` 只看得到世界 y 60–780，看不到地面（y≈900）和 `CAVE.cage.landed`（笼心 y 778.7，笼底 898.7）；b13 作者需按屏幕落点用 `toScreen` 反解机位（例如把 cam.y 下移到 ~600）。
- **地板裂缝**只画在台口内地板与台唇上，不劈开背景片；裂缝在 back 与 frame 两层各画一段，两层用同一 `splitX`。
- `drawCage` 的 `tally` 最多 20 画（4 个“正”）；`drawStoneTablet` 的 `char` 只取一个字。

---

## 8. 模型图清单

| 模型图 | 页面 | 最终 PNG |
|---|---|---|
| `src/sheets/cave.js` | [0,2) 五种光照 + flat｜[2,4) CV-W 布局标注｜[4,6) D3 名字墙砸落 → 撞碎｜[6,8) STANDOFF 对剧场 grow=0、flat 对正常｜[8,10) 8 个预设机位 + 水晶 / 钟乳石｜[10,12) 黎明光束｜[12,14) 战斗光 + 碎块冷却 + 字痕｜[14,16) 全暗 → glint｜[16,18) 道具页（本轮新增，替代单独的 cave_props 模型图）：鸟笼关 / 开门 / 全开 / 落地挤压 / 摆动 / 迷你偶、金币 spin·bite·flash、金币堆两种亮度、石碑 glow·crack·squash、铁链 / 金链 | `out/review/sheets/cave/final_t{1.00,3.00,4.90,5.40,5.90,7.00,9.00,11.00,13.00,14.20,15.00,16.60,17.40}.png` |
| `src/sheets/theater.js` | [0,2) 黑边长成台口｜[2,4) 十二种状态网格（halves 格含 floorCrack）｜[4,6) TT-OUT（剑穿侧幕 → 竖起撕顶幕，含 wingTearUp）｜[6,8) 布局 / 字幕带｜[8,32.1) theaterState 实时回放（T' = 137.40 + (T − 8)，`{...st}` 直接展开、木偶按 theaterClip 裁切） | `out/review/sheets/theater/final_t{0.50,1.70,3.00,5.00,5.60,7.00}.png`（各页）+ `final_t{8.20,9.60,11.90,16.60,20.05,21.20,26.80,27.60,28.20,31.55}.png`（回放：T' 137.60 / 139.00 / 141.30 / 146.00 / 149.45 / 150.60 / 156.20 / 157.00 / 157.60 / 160.95） |

自检命令：

```bash
./tools/lint.sh src/env/cave.js src/props/cave.js src/env/theater.js src/sheets/cave.js src/sheets/theater.js docs/api/cave_theater.md
node tools/check.mjs sheets --list cave,theater
node tools/render.mjs stills --sheet cave --times 1,3,4.9,5.4,5.9,7,9,11,13,14.2,15,16.6,17.4 --outdir out/review/sheets/cave --prefix final_
node tools/render.mjs stills --sheet theater --times 0.5,1.7,3,5,5.6,7,8.2,9.6,11.9,16.6,20.05,21.2,26.8,27.6,28.2,31.55 --outdir out/review/sheets/theater --prefix final_
```
