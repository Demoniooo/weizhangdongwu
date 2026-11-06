# 地图与旅途长卷（map_journey）API

> 本组文件：`src/env/map.js`（地图三形态）、`src/env/journey.js`（旅途长卷 + 旅途时间线）。
> 规格出处：`docs/assets.md` 8.4、8.6；布局出处：`docs/storyboard.md` 4.4、4.6。本文以代码为准（每个参数名都在代码里核对过）。
> 时刻一律是默认秒，全部由 `cue()` 推出（V01 74.40｜V03 78.14｜V04 80.22｜V05 82.04｜V06 83.83｜V07 86.01｜V08 88.01｜V09 90.15｜V10 91.97｜V11 94.04｜V12 95.85｜V13 98.04｜E03 165.08）。

---

## 1. 模块与导出一览

### 1.1 `src/env/map.js`

| 名称 | 类型 | 一句话用途 |
|---|---|---|
| `MAP_UV` | 常量 | 6 个地标的 (u,v)：castle / meadow / village / pass / forest / dragon |
| `MAP_ORDER` | 常量 | 路线经过地标的顺序（= `MAP_UV` 的键序） |
| `MAP_FORMS` | 常量 | 三种形态的矩形 `{x,y,w,h}`：crayon / parchment / mini |
| `MAP_ROUTE_R` | 常量 | 各地标在路线上的弧长参数 r（castle 0 … dragon 1） |
| `mapToScreen(form, u, v)` | 函数 | (u,v) → 某形态坐标 |
| `mapRoute(r)` | 函数 | r∈[0,1]（按弧长）→ [u,v] |
| `mapRouteAngle(r)` | 函数 | 路线在 r 处的切线角（弧度） |
| `mapRoutePoints(form, r0, r1)` | 函数 | 路线 [r0,r1] 段在某形态里的折线点 |
| `heartPoints(cx, cy, h, n)` | 函数 | 立誓那颗心的轮廓点 |
| `heartPath(cx, cy, h)` | 函数 | 同一颗心的 Path2D（b03→b04 心形遮罩用它） |
| `drawKnightToken(g, o)` | 绘制 | 60px 纸片小骑士（马 + 骑手） |
| `drawMissionPin(g, o)` | 绘制 | 水滴形红色任务图钉（「！」+ 落下 + 波纹） |
| `drawCrayon(g, o)` | 绘制 | 戴棕手套的手握红蜡笔（锚点 = 笔尖） |
| `CRAYON` | 常量 | 蜡笔地图布局（剑、雪峰、7 棵松、猫头鹰、龙山、鸟笼、心） |
| `drawCrayonMap(g, T, o)` | 绘制 | 蜡笔地图（b03 立誓，告示背面牛皮纸） |
| `PARCHMENT` | 常量 | 羊皮纸布局（矩形、折痕、罗盘、城名环、6 地标屏幕点、图钉位置） |
| `drawMapCover(g, rect, o)` | 绘制 | 地图封皮 / 卡背（kraft + 罗盘纹 + 双线框） |
| `drawParchmentMap(g, T, o)` | 绘制 | 羊皮纸风琴折地图（b06 间奏一） |
| `MINI` | 常量 | 小地图卡片矩形（= `MAP_FORMS.mini`） |
| `drawMiniMap(g, T, o)` | 绘制 | 旅途 HUD 右上小地图卡（b07 / b08 / b14） |

### 1.2 `src/env/journey.js`

| 名称 | 类型 | 一句话用途 |
|---|---|---|
| `JOURNEY_CAM_KEYS` | 常量 | 机位关键帧表 `[T, camX, camY, zoom]` × 14 |
| `journeyCam(T, o)` | 函数 | 旅途机位（单调三次样条 + drift；98.90 后 inQuad 推进洞口） |
| `journeyCamSpeed(T)` | 函数 | 机位水平速度（世界 px/s，不含 drift） |
| `journeyGroundY(x)` | 函数 | 主体层地面线 y（马蹄着地线） |
| `journeyGroundAngle(x)` | 函数 | 地面坡度角（弧度，正 = 向右下） |
| `heroJourneyX(T)` | 函数 | 勇者世界 x（= camX − 200/zoom；98.55 后步行） |
| `horseJourneyX(T)` | 函数 | 白马世界 x（98.48 后溜到岩石后） |
| `occluderX(T, kind, c, index)` | 函数 | 某遮挡物中线的屏幕 x（b07 用 gateArch 中线切 PLAZA / JOURNEY） |
| `JOURNEY_FIXED` | 常量 | 固定物：风车、岩石、洞口、雪峰红旗、月亮、远景王城、龙山 |
| `heroJourneyState(T)` | 函数 | 勇者与白马的全部状态（b07 / b08 共用，90.00 接缝由它保证） |
| `journeyMiniR(T)` | 函数 | 小地图骑士 r（去程） |
| `hudState(T)` | 函数 | HUD 全部状态（b07 / b08 / b14 共用） |
| `journeyLayerX(X, d)` | 函数 | 「镜头居中 X」→ 深度 d 的图层坐标 |
| `caveMouthPath(c)` | 函数 | 杏仁形洞口 Path2D（不传 c = 世界坐标；传 c = 屏幕坐标） |
| `drawOccluder(g, T, c, kind)` | 绘制 | 换区遮挡物（屏幕空间） |
| `journeyZones(c)` | 函数 | 机位 c 下可见的区与各自屏幕 x 区间 |
| `drawJourney(g, T, c, o)` | 绘制 | 旅途长卷，按 `o.layer` 分层画 |
| `journeyWorld` | 别名 | = `drawJourney`（storyboard 里叫 journeyWorld） |
| `journeyTexOffset(c, d)` | 函数 | 图层纸纹随层平移：`ctx.layer` 的 `texOffset` |
| `journeyTexOff` | 别名 | = `journeyTexOffset` |
| `rewindBand(g, T, p, o)` | 绘制 | E03 倒放色带（夜→冷→金→绿→晨）+ 速度线 |
| `JOURNEY` | 常量 | 区、遮挡物、固定物、容器、屋子、史莱姆、事件时刻、机位、图层配方 |

---

## 2. 坐标、尺寸与锚点约定

### 2.1 地图（一套 (u,v)，三种形态）

- `x = rect.x + u·rect.w, y = rect.y + v·rect.h`：
  - 蜡笔版 `crayon` {0, 0, 1920, 1080}：**世界坐标**（b03 镜头自己 `applyCam(g, c, 1)`，或传 `o.cam`）。
  - 羊皮纸版 `parchment` {160, 90, 1600, 900}：`cam(960,540,1)` 时的屏幕坐标（同样可 `applyCam` / 传 `o.cam`）。
  - 小地图 `mini` {1524, 72, 300, 170}：屏幕坐标（HUD，不跟机位）。
  - `form` 也可直接传任意 `{x,y,w,h}`（模型图叠图就是这么做的）。
- 地标 (u,v)：王城 castle (0.12,0.58)｜草原 meadow (0.27,0.68)｜村庄 village (0.43,0.52)｜雪山口 pass (0.58,0.33)｜月光森林 forest (0.73,0.53)｜巨龙山 dragon (0.885,0.40)。
- 路线：穿过 6 点的 Catmull-Rom（张力 0.5，与 `paper.smooth` 同构造）+ 轻微手绘抖动（在地标处为 0，正好穿过地标）；**弧长在 16:9 度量里算**，所以三种形态里同一个 r 落在同一相对位置。
- `MAP_ROUTE_R`（实测）：castle 0｜meadow 0.180｜village 0.386｜pass 0.594｜forest 0.807｜dragon 1。
- 锚点：
  - `drawKnightToken`：底座中心 (x,y)，size = 总高（默认 60）；`face` −1 整体 scaleX 镜像。
  - `drawMissionPin`：钉尖 (x,y)，size = 总高（默认 84）。
  - `drawCrayon`：笔尖 `tip:[x,y]`；`ang` = 从笔尖指向手的方向（默认 2.3 = 手在左下）。
  - `heartPoints/heartPath(cx, cy, h)`：心形 bbox 中心 (cx,cy)、高 h；点从顶部凹口出发顺时针。蜡笔地图上那颗心 = `CRAYON.heart` {x:1638, y:620, h:200}（世界坐标）。
- 绘制函数都内部 `save/restore`，不调 `ctx.layer/ctx.mask`，投影/纸纹由镜头的图层给。

### 2.2 旅途长卷

- 世界 x 0–13400；**主体层（depth 1）= 世界坐标**；地面线 y = 860，风雪区在 x 8000→9300 抬到 720，9500→10500 回落到 860（`journeyGroundY`）。
- 远 / 中 / 前景层的固定物 x 写成「**镜头居中 X**」：深度 d 的物体在 camX = X 时正好在屏幕中线；图层坐标 = `journeyLayerX(X, d)` = 960 + (X − 960)·d。所以「风车 X=6400」= 机位走到 6400 时风车在画面正中。
- 角色比例：`s = 1`（勇者 260、白马 300×230）。勇者屏幕 x 恒 ≈ 760（世界 x = camX − 200/zoom），98.55 后下马步行。
- 换区：屏幕空间的前景遮挡物从右往左扫过；每一层以遮挡物中线为界——**线右是新区、线左是旧区**，遮挡期间两区都画完整（各自裁到自己那侧），接缝永远在遮挡物后。区 id：0 = G/M，1 = V，2 = S，3 = N，4 = C。
- 遮挡物屏幕中线 x = 960 − (cam.x − camX₀)·D·cam.zoom，屏幕 y 偏移 = −(cam.y − camY₀)·1.5·cam.zoom（camX₀/camY₀ = 过中线那一刻的机位）。D 按「过中线时约 4600–4800 px/s 扫过」反解，城门拱固定 D = 1.5。遮挡物纵向 y −120…1220，过中线时占满画面高度。
- `face`：旅途全段去程 `face = 1`（向右）；b14 归程不画长卷（用 `rewindBand`），角色 `face = −1`。

### 2.3 返回对象字段

`heroJourneyState(T)` 与 `hudState(T)` 的全部字段见 3.2 节；`journeyZones(c)` 返回 `[{ z, x0, x1 }]`（z = 区 id，x0/x1 = 屏幕 x 区间）。

---

## 3. 函数详解

### 3.1 地图（map.js）

#### `mapToScreen(form, u, v)` → `[x, y]`
| 参数 | 默认值 | 说明 |
|---|---|---|
| `form` | 'crayon'（传空时） | `'crayon' \| 'parchment' \| 'mini'` 或任意 `{x,y,w,h}` |
| `u, v` | — | 0..1 |

#### `mapRoute(r)` → `[u, v]`；`mapRouteAngle(r)` → 弧度；`mapRoutePoints(form, r0 = 0, r1 = 1)` → `[[x,y], …]`
- r 自动 clamp 到 [0,1]；`mapRouteAngle` 在 16:9 度量下算（0 = 向右，正 = 向下）；`mapRoutePoints` 的 r0/r1 可颠倒（内部取 min/max），首尾点精确落在 r0、r1。

#### `heartPoints(cx, cy, h, n = 96)` → 点数组；`heartPath(cx, cy, h)` → Path2D

#### `drawKnightToken(g, o)` → 无
| 参数 | 默认值 | 说明 |
|---|---|---|
| `x, y` | 0, 0 | 底座中心 |
| `size` | 60 | 总高 px |
| `face` | 1 | 1 朝右 / −1 朝左 |
| `hop` | 0 | 0..1 蹦一下（sin 弧，影子不跟着跳） |
| `t` | 0 | 马腿小跑相位（传 T） |
| `pen` | false | 底座带红墨笔尖（b06 当笔头） |
| `alpha` | 1 | |
| `rot` | 0 | 整体转角（弧度） |

#### `drawMissionPin(g, o)` → 无
| 参数 | 默认值 | 说明 |
|---|---|---|
| `x, y` | 0, 0 | 钉尖 |
| `size` | 84 | 总高 px |
| `drop` | 1 | 0..1：0–0.55 从上方 380px 落下（inQuad），0.55–0.75 砸下挤压、回弹余振；0.55 起漾两圈波纹 |
| `alpha` | 1 | |

#### `drawCrayon(g, o)` → 无
| 参数 | 默认值 | 说明 |
|---|---|---|
| `tip` | [960, 540] | 笔尖坐标（锚点） |
| `ang` | 2.3 | 从笔尖指向手的方向（弧度）；2.3 = 手在左下 |
| `s` | 1 | 缩放 |
| `press` | 0 | 0..1 下压：笔尖压钝（尖头变成一小段平头）；0 时与旧版完全一样 |
| `t` | 0 | 笔触轻颤（传 T） |
| `alpha` | 1 | |

#### `drawCrayonMap(g, T, o)` → 无（b03 25.35–34.10）
| 参数 | 默认值 | 说明 |
|---|---|---|
| `cam` | — | 可选：内部 `applyCam(g, cam, 1)` |
| `icons.sword` | 0 | 剑之誓（王城旁剪纸剑立起 0..1，outBack） |
| `icons.mountain` | 0 | 山之誓（雪顶高峰立起） |
| `icons.flag` | 0 | 峰顶小红旗插上 |
| `icons.forest` | 0 | 7 棵松：数字 = 错峰 50ms 的总进度；或长度 7 的数组逐棵给 |
| `icons.cage` | 0 | 龙山 + 涂鸦龙 + 鸟笼（笼子在 0.3 之后才立） |
| `icons.heart` | 0 | 心的描边进度 |
| `route` | 0 | 红蜡笔虚线画到哪（按弧长，lw 9、dash [18,14]、两遍 alpha 0.8 + 抖动 + 露白）；地标处 r 见 `MAP_ROUTE_R` |
| `heartFill` | 0 | 心的排线涂满进度 |
| `heartBeatAt` | — | 心跳一下（1→1.12→1，0.32s）的时刻；涂鸦龙同时缩脖子 |
| `owlBlink` | — | 猫头鹰睁眼的时刻（不传则不画猫头鹰） |
| `sheet` | true | 画整张牛皮纸（`CRAYON.sheet` −380…2300 × −220…1300） |
| `doodles` | true | 王城、小丘、小屋底稿涂鸦 |

#### `drawMapCover(g, rect, o)` → 无
| 参数 | 默认值 | 说明 |
|---|---|---|
| `rect` | — | `{x,y,w,h}` |
| `o.alpha` | 1 | |
| `o.seed` | 331 | 纸边抖动种子 |
| `o.inner` | false | true = 内页（kraft 略深） |

#### `drawParchmentMap(g, T, o)` → 无（b06 66.40–74.45）
| 参数 | 默认值 | 说明 |
|---|---|---|
| `cam` | — | 可选：内部 `applyCam(g, cam, 1)` |
| `unfold` | 1 | 0..1 四片风琴折：0 = 只剩第一片位置上的封皮叠；1/3、2/3、1 依次在折痕 x 560/960/1360 处翻开（scaleX 翻转带明暗，过 90° 换正面） |
| `landmarks` | 0 | 立起进度：一个数（6 个同进度）或长度 6 数组（顺序 = `MAP_ORDER`）；王城 1 倍，其余 5 个放大 1.35 倍 |
| `bounce` | [] | 长度 6 的时刻数组：笔头经过时地标跳一下 + 各自小动画（史莱姆蹦、风车转、雪花、弯月亮、龙吐烟圈） |
| `route` | 0 | 红虚线画到哪（scarf，lw 8，dash [20,14]，先画墨影） |
| `knight` | true | route>0 时在线头画纸片小骑士当笔头；route ≥ 1 时骑士停在 r 0.955（山脚），把山顶让给图钉 |
| `knightSize` | 60 | |
| `ring` | 0 | 城名环形字写到哪（半径 92、48px，从正上方顺时针，字头朝外 + 两圈细红线） |
| `pin` | 0 | 任务图钉 `drop`（落在 `PARCHMENT.pin` = (1586,432)） |
| `compass` | 0 | 罗盘指针转角（弧度，0 朝上） |
| `sweep` | 0 | 0..1 一道金光斜扫（0 与 1 时不画） |
| `dustAt` | — | 摊平扬灰的时刻（之后 1.2s） |

底纸常驻细节（不需要参数）：区域水彩、左下海 + 波纹 + 摇晃纸船、portolan 罗盘方位线（右下罗盘与左上 (520,250) 小副罗盘各放射 16 条）、5 只墨线飞鸟（翅膀随 T 扇）、田块、河、墨线小山与树、金线 + 深红线 + 墨线三重边框、四角金色卷草。

#### `drawMiniMap(g, T, o)` → 无（屏幕坐标）
| 参数 | 默认值 | 说明 |
|---|---|---|
| `r` | 0 | 小骑士在路线上的位置（按弧长） |
| `dir` | 1 | 骑士朝向；归程 −1 |
| `walked` | 'red' | 'red'：0→r 画红；'gold'：0→r 红 + r→1 金（归程走过的路段变金） |
| `show` | 1 | 0..1 从右侧滑入（outBack）；≤0 不画 |
| `flip` | 0 | 0..1 翻到背面（kraft + 墨线问号） |
| `fold` | 0 | 0..1 下半张向上折起 |
| `knightSize` | 44 | 骑士大小 |
| `rect` | `MINI` | 改卡片位置（模型图用） |

`hudState(T).mini` 可直接展开传入：`drawMiniMap(g, T, hudState(T).mini)`。

### 3.2 旅途（journey.js）

#### `journeyCam(T, o = {})` → `cam` 对象 `{x, y, zoom, rot:0}`
- 81.00–98.90：`JOURNEY_CAM_KEYS` 的单调三次样条（PCHIP，速度连续、不过冲）；81.00 之前按初速**线性外推**（最多外推 1.5s，城门拱 80.80–81.20 扫过时要用）；98.90–99.60 inQuad 推进洞口 (12450,540,1)→(13000,640,3.2)（zoom 按指数插值）；99.60 之后保持。
- 默认叠 `drift(T, {amp: 5, speed: 0.35, seed: 21})`；`o.drift = false` 取纯曲线。

**`JOURNEY_CAM_KEYS`**（实测值）：

| T | camX | camY | zoom | 说明 |
|---|---|---|---|---|
| 81.00 (V04+0.78) | 1900 | 560 | 1.15 | 城门拱后，接 PLAZA |
| 82.04 (V05) | 2800 | 540 | 1.00 | 草原，史莱姆 |
| 83.83 (V06) | 3350 | 540 | 1.00 | 打怪放慢 |
| 86.01 (V07) | 4150 | 540 | 1.00 | 金币收完 |
| 88.01 (V08) | 5150 | 540 | 1.00 | 伤痕 |
| 90.15 (V09) | 6100 | 540 | 1.00 | 进村 |
| 91.00 | 6400 | 500 | 0.92 | 村庄：略升、略拉开 |
| 91.97 (V10) | 6800 | 500 | 0.92 | 开箱开始 |
| 94.04 (V11) | 8000 | 520 | 1.00 | 进山口 |
| 95.50 | 9200 | 440 | 1.00 | 山口顶 |
| 95.85 (V12) | 9500 | 460 | 1.00 | 翻过山口，月出 |
| 98.04 (V13) | 12200 | 540 | 1.00 | 月光疾驰（全段最快约 1375 px/s） |
| 98.35 | 12450 | 540 | 1.00 | 急刹 |
| 98.90 | 12450 | 540 | 1.00 | 静止 |
| 99.60（`JOURNEY.push`） | 13000 | 640 | 3.20 | inQuad 推进洞口，由 b09 接 |

90.00 接缝：`journeyCam(90.00, {drift:false})` = (6041.07, 540, 1.0)。

#### `journeyCamSpeed(T)` → number（世界 px/s，不含 drift）
#### `journeyGroundY(x)` / `journeyGroundAngle(x)`
#### `heroJourneyX(T)` / `horseJourneyX(T)`
- `heroJourneyX`：T < 98.55 时 = camX − 200/zoom（不含 drift，屏幕 x ≈ 760）；98.55 起从 12250 步行（0.3s 加速到 175 px/s）走向洞口。
- `horseJourneyX`：T < 98.48 时与勇者同 x；98.48–98.76 inOutCubic 溜到岩石 x = 12650，之后停在那。

#### `occluderX(T, kind, c = journeyCam(T), index = 0)` → 屏幕 x（无该遮挡物时 NaN）
- `kind` 见 4.4；`blackTrunks` 用 `index` 0–2 选第几根。

#### `heroJourneyState(T)` → 对象（**b07 / b08 只从这里取角色状态**）
| 字段 | 说明 |
|---|---|
| `x, y` | 勇者脚底世界坐标（`heroJourneyX`、`journeyGroundY`）；骑乘时勇者画在马的 `saddle` 锚点上，x/y 只在下马步行后（98.55 起）直接用 |
| `pose` | 勇者建议动作：`'ride' \| 'rideSlash' \| 'rideLean' \| 'rideHunch' \| 'sneeze' \| 'dismount' \| 'walk'`，切换处是 `{from, to, k}`（0.12s inOutSine 过渡）；见 4.5 |
| `expr` | 建议表情：`grin / determined / hurt / worried / laugh / smug / squint / shock`；见 4.5 |
| `bandages` | 创可贴张数：绕树前 0；86.04 起 4，每升一级 −1（90.00 时 1） |
| `bump, singed, torn, chip` | 绕树（86.04）后一直为 true：头包、焦发、破袖、剑刃崩口 |
| `soot` | 0 / 0.12（绕树后脸上一点灰） |
| `snowCap` | 0..1 头肩积雪（94.20→95.20 堆高，喷嚏后 0.08s 消失） |
| `scarf.notch` / `scarf.hole` | 围巾末端 V 形缺口 / 中段破洞（树干盖住围巾中段 86.13 起 true，一直保留） |
| `scarf.frozen` | 0..1 冻成木板（94.10→94.46 冻住，喷嚏 95.22→95.36 裂开） |
| `scarf.glow` | 0.6（V03 众人心愿后的金边强度） |
| `scarf.len` | 936（b07 79.60 变长 20% 后的长度） |
| `horse.x, horse.y` | 白马脚底世界坐标 |
| `horse.angle` | 地面坡度角（弧度） |
| `horse.phase` | = horse.x ÷ 280，喂 `drawHorse` 的步态相位（天然不打滑） |
| `horse.speed` | 世界 px/s（绝对值） |
| `horse.pose` | `'gallop' \| 'trot' \| 'walk' \| 'limp' \| 'headwind' \| 'skid' \| 'rear' \| 'hideRock'`，切换处 `{from,to,k}`（0.25s）；见 4.5 |
| `horse.gait` | 腿部步态：gallop / trot / walk（limp → gallop，headwind → trot；skid / rear / hideRock 为 null） |
| `horse.limp` | 0..1 瘸的程度（绕树后 1，每升一级 −1/3） |
| `horse.bandageLeg` | 绕树后 true（马腿绷带） |
| `horse.noseBandage` | 87.70 起 true（87.60 勇者贴上去） |
| `horse.icicles` | 0..1 鬃毛冰凌（94.30→94.90 长出，95.75→96.35 化掉） |

有效区间 80.8–99.6（b14 不用它）。

#### `journeyMiniR(T)` → 0..1
- = clamp((camX − 1900) / (12450 − 1900))（不含 drift），T < 81.00 时 0。

#### `hudState(T)` → 对象（**b07 / b08 / b14 只从这里取 HUD 状态**）
| 字段 | 说明 |
|---|---|
| `show` | 0..1 左上角色卡：74.90 滑入（outBack 0.35s），99.30 滑出（0.3s）；b14（≥ E03−1 = 164.08）恒 0 |
| `lv` | 1 + 已升级数（88.40 / 89.10 / 89.80 各 +1，最高 4） |
| `lvAt` | 升级时刻数组 [88.40, 89.10, 89.80] |
| `nameReveal` | 名字牌露几个字：6 / 7 / 8 / 9（后面自己补省略号） |
| `nameRevealAt` | = `lvAt` |
| `hearts` | 0..5（半颗用 .5）：5 → 裂到 1.5（86.10/86.25/86.40/86.55）→ 升级补回 2 / 3 / 4 |
| `crackAt` | 心裂开时刻数组 |
| `heartFlash` | 0..1：79.60–79.94 五颗心闪一下；86.55 之后最后一颗（半颗）闪红直到第一次升级 |
| `heartShiver` | 0..1 风雪段心打哆嗦（喷嚏前 0.4、喷嚏时 1，入夜归零） |
| `coins` | 金币数 0..12（到达时刻 83.83 + 0.14·i） |
| `coinAt` | 12 枚金币到达时刻 |
| `coinBounce` | 「×12」大弹的时刻 85.45 |
| `bag` | 背包件数 0..5（开箱后 0.32s 进包） |
| `bagAt` | 5 件道具进包时刻 |
| `bagItems` | `['potion','key','boots','shield','hat']` |
| `exp` | 0..1 经验条填充（蜗牛位置） |
| `expBig` | 0..1：88.01 放大弹到画面上方中央（outBack 0.2s），89.60–89.85 缩回 |
| `snailCrown` | 89.80 起 true（蜗牛戴小王冠） |
| `levelUpAt` | 最近一次升级时刻，或 null |
| `mini.r` | 小骑士 r：去程 = `journeyMiniR(T)`；b14 165.12→165.75 从 1 倒退到 0（inOutSine） |
| `mini.show` | 去程 80.50 滑入、99.50–99.60 收走；b14 165.10 滑入、166.30–166.45 收走 |
| `mini.flip` | 99.20→99.40 翻到背面（问号） |
| `mini.fold` | 去程 99.42→99.54；b14 166.20→166.38 折起 |
| `mini.dir` | 去程 1，b14 −1 |
| `mini.walked` | 去程 'red'，b14 'gold' |

关键时刻实测（模型图 `sheet_journey_hud` 同表）：

| T | lv | 露字 | 心 | 金币 | 包 | exp | expBig | mini.r | 创可贴 | 围巾 |
|---|---|---|---|---|---|---|---|---|---|---|
| 86.60 | 1 | 6 | 1.5 | 12 | 0 | 0.44 | 0 | 0.239 | 4 | 缺口+破洞 |
| 88.40 | 2 | 7 | 2 | 12 | 0 | 0 | 1 | 0.325 | 3 | 缺口+破洞 |
| 89.80 | 3（下一帧 89.833 才升到 4） | 8 | 3 | 12 | 0 | 1 | 0.03 | 0.385 | 2 | 缺口+破洞 |
| 90.00 | 4 | 9 | 4 | 12 | 0 | 0.025 | 0 | 0.393 | 1 | 缺口+破洞 |
| 92.00 | 4 | 9 | 4 | 12 | 0 | 0.12 | 0 | 0.466 | 1 | 缺口+破洞 |

#### `journeyLayerX(X, d)` → 图层 x
#### `journeyTexOffset(c, d)`（别名 `journeyTexOff`）→ `[dx, dy]`
- = `[-(c.x − 960)·d·z, -(c.y − 540)·d·z]`，z = 1 + (c.zoom − 1)·d。传给 `ctx.layer` 的 `texOffset`，纸纹就跟着该层一起平移（否则纸纹钉在屏幕上，像隔着一层纱）。

#### `caveMouthPath(c)` → Path2D
- 杏仁形（左右两端尖、上下两段弧），中心 (13000,640)，宽 520、高 360（`JOURNEY_FIXED.caveMouth`）。
- 不传 `c`：世界坐标（配 `applyCam(g, c, 1)` 用）；传 `c`：已用 `toScreen(c, 1, …)` 换成屏幕坐标——**b09 的遮罩直接 `mg.fill(caveMouthPath(journeyCam(T)))`**。

#### `drawOccluder(g, T, c = journeyCam(T), kind = 'all')` → 无（屏幕空间）
- `kind`：见 4.4；`'all'` / 省略 = 画当前画面里所有的遮挡物（81.82 之后不再画城门拱）。
- `c` 必须与同一帧 `drawJourney` 的机位是同一个对象（接缝才对得上）。
- 不 applyCam、不自带 blur：镜头用 `ctx.layer(g, {blur: 6}, …)` 包住。

#### `journeyZones(c)` → `[{ z, x0, x1 }]`
- 机位 c 下可见的区（0–4 = G·M / V / S / N / C）及各自屏幕 x 区间；遮挡期间返回两项。

#### `drawJourney(g, T, c = journeyCam(T), o = {})` → 无
| 参数 | 默认值 | 说明 |
|---|---|---|
| `o.layer` | 'main' | 见 4.3：`sky / far / mid / main / front / fg / light` |
| `o.zone` | — | `'G'\|'M'\|'V'\|'S'\|'N'\|'C'`：强制只画某区，不做换区（G 与 M 是同一个区 0） |
| `o.clipX` | — | `[x0, x1]` 只画屏幕这一段（b07 城门拱换景：`clipX: [occluderX(T,'gateArch',c), 99999]`） |
| `o.detail` | 1 | 0 = 省略碎石小花等小件（远景合并或性能紧张时用） |
| `o.flat` | — | 传一个参考机位 cam：冻结视差，各层按参考机位摆好后像同一张纸一起随 depth 1 移动 |
| `o.windmillAt` | V09 (90.15) | 风车开转时刻 |
| `o.moonRise` | 时间线 | 0..1 覆盖月亮升起进度 |
| `o.moonRoad` | 时间线 | 0..1 覆盖石板被照亮进度 |
| `o.moonBeam` | 时间线 | 0..1 覆盖月光梯形强度 |
| `o.blizzard` | 时间线 | 0..1 覆盖风雪强度 |

#### `rewindBand(g, T, p, o = {})` → 无（屏幕空间整屏）
| 参数 | 默认值 | 说明 |
|---|---|---|
| `T` | — | 驱动山丘长条与速度线向右飞（世界向右飞过 = 勇者向左骑） |
| `p` | — | 0..1 倒放进度：0 夜、1 晨（夜→冷→金→绿→晨五段） |
| `o.alpha` | 1 | |
| `o.horizon` | 760 | 地平线屏幕 y |

#### `JOURNEY`（只读）
| 键 | 内容 |
|---|---|
| `width` / `groundY` | 13400 / 860 |
| `zones[]` | `{ id:'G'…'C', x0, x1, sky（说明文字）, zone（区 id） }`：G 0–2200、M 2200–5600、V 5600–7900、S 7900–9600、N 9600–12300、C 12300–13400 |
| `occluders[]` | `{ kind, at, camX, D, width, seam（换区接缝序号 0–3，非接缝 −1）, index }` |
| `fixed` | = `JOURNEY_FIXED` |
| `containers[]` | 5 个容器 `{ kind, at（开箱时刻）, x（世界）, y（= 860）, item }`：chest 92.00 @6777｜pot 92.35 @6951｜barrel 92.70 @7140｜flowerPot 93.05 @7343｜bigChest 93.40 @7558 |
| `houses[]` | `{ X（镜头居中 X）, depth 0.95, w, h, owner, container（对应容器序号或 −1）, door:[x, 838]（**depth 0.95 图层坐标**，主人站这里） }` |
| `slimes[]` | `{ at, x（世界）, y 860, slashAt }`：82.04 @3090｜82.12 @3277｜82.20 @3461 |
| `events` | 全部事件时刻（见 4.6） |
| `cams` / `push` | = `JOURNEY_CAM_KEYS` / `{t0 98.90, t1 99.60, x 13000, y 640, zoom 3.2}` |
| `layers[]` | 推荐图层配方（见 5.1） |

`JOURNEY_FIXED`：`windmill {x 6400, depth 0.8, base 806, hubY 476}`｜`rock {x 12650, w 300, h 210}`（主体层）｜`caveMouth {x 13000, y 640, w 520, h 360}`（主体层）｜`flagPeak {x 8800, depth 0.28, top 110}`｜`moon {x 1450, y0 900, y1 330, r 260}`（屏幕，depth≈0.05）｜`castle {x 300, depth 0.3, scale 0.35}`｜`dragonMountain {x 13700, depth 0.3}`。

---

## 4. 枚举全表

### 4.1 地图形态 `form`
| 值 | 说明 | 用在 |
|---|---|---|
| `'crayon'` | 告示背面牛皮纸 + 红蜡笔，世界坐标 1920×1080 | b03（25.35–34.10） |
| `'parchment'` | 羊皮纸风琴折 1600×900 | b06（66.40–74.45） |
| `'mini'` | HUD 右上 300×170 卡片 | b07、b08、b14 |

### 4.2 地标键 `MAP_ORDER`
| 键 | (u,v) | 说明 / 用在 |
|---|---|---|
| `castle` | (0.12,0.58) | 王城；路线起点；b06 城名环形字围着它；b06 结尾镜头扎进它 |
| `meadow` | (0.27,0.68) | 草原（b03 小丘；b06 草丛 + 史莱姆） |
| `village` | (0.43,0.52) | 村庄（b06 风车 + 宝箱） |
| `pass` | (0.58,0.33) | 雪山口（b03 山之誓、红旗；b06 雪峰 + 红旗） |
| `forest` | (0.73,0.53) | 月光森林（b03 7 棵松 + 猫头鹰；b06 深色松 + 弯月） |
| `dragon` | (0.885,0.40) | 巨龙山（b03 鸟笼 + 心；b06 图钉；小地图终点） |

### 4.3 `drawJourney` 的 `o.layer`
| 值 | 深度 | 内容 | 推荐图层 |
|---|---|---|---|
| `sky` | 屏幕空间 | 区天色渐变 + 太阳（G/M、V）+ 纸云（G/M/V/S）+ 星星（N、C） | 直接画在 g 上 |
| `far` | 0.05–0.45 | 月亮（N/C，屏幕空间）、远山带 0.12、龙山剪影（越走越大）、远景王城 0.3、雪峰红旗 0.28、远林 0.3/0.45 | `{shadow:4, texture:0.22, texOffset: journeyTexOffset(c,0.25)}` |
| `mid` | 0.55–0.95 | 树林、篱笆、风车 0.8、小屋 0.95、雪坡、暗林、紫岩 | `{shadow:7, texture:0.28, texOffset: …(c,0.8)}` |
| `main` | 1.0 | 地面、道路、石板（月光照亮）、洞口崖壁与杏仁洞口、白骨金币 | `{shadow:10, texture:0.3, texOffset: …(c,1)}`，**main → 角色 → front 画在同一个图层里** |
| `front` | 1.0 | 角色之后再画：白马躲的岩石（C 区）+ 风雪细雪片（S 区） | 同上（与 main 同层） |
| `light` | 屏幕空间（screen 叠加） | 太阳光芒、月光梯形、箭头光斑、萤火、洞口紫光 | 直接画在 g 上 |
| `fg` | 1.2–1.32 | 草丛、花田、雪堆 + 大雪片、蕨、紫岩 | `{blur:4, shadow:12}` |

### 4.4 遮挡物 `kind`（`drawOccluder`）
| 值 | 过中线时刻 | 换区 | 造型 | 用在 |
|---|---|---|---|---|
| `gateArch` | 81.00（80.80–81.20 扫过） | PLAZA → JOURNEY G（由 b07 自己切） | 厚石墙 + 左侧拱券 + 红长幡；**实心墙体中心对准中线**（墙宽约 760） | b07 `b07_depart` |
| `treeGag` | 86.00 | 不换区（绕树变样：盖住勇者 86.04 换伤，盖住围巾 86.13 换破损） | 深棕树干带叶 | b07 `b07_road` |
| `oak` | 89.95 | M → V（**b07/b08 接缝 90.00 藏在它后面**） | 粗干 + 巨大树冠盖住上半屏 | b07 尾 / b08 头 |
| `halfPine` | 93.95 | V → S | 雪松：左半绿、右半积雪 | b08 `b08_chests` 尾 |
| `snowCliff` | 95.75 | S → N | 嶙峋岩壁（锯齿边、受光 / 背光块面、裂缝）+ 岩棱积雪 + 冰凌 + 顶上雪檐 | b08 `b08_snow` 尾 |
| `blackTrunks` | 97.60 / 97.75 / 97.90 | 第 2 根（97.75，index 1）N → C | 近黑粗干（三根宽度 ×0.8 / ×0.92 / ×1.18）+ 月光勾左边 + 树皮纹 + 树结 + 断枝 + 速度条纹 | b08 `b08_moon` 尾 |

### 4.5 角色状态枚举（`heroJourneyState`）
勇者 `pose`：
| 值 | 时段 | 用在 |
|---|---|---|
| `ride` | 默认骑乘 | b07、b08 |
| `rideSlash` | 82.46–82.76 / 82.81–83.11 / 83.16–83.46（三刀） | b07 V05 |
| `rideLean` | 每次开箱前 0.13s–后 0.17s（92.00 … 93.40） | b08 V10 |
| `rideHunch` | 94.04–95.02、95.38–95.80（顶风弓身） | b08 V11 |
| `sneeze` | 95.02–95.38（95.20 阿嚏） | b08 V11 |
| `dismount` | 98.30–98.55 | b08 V13 |
| `walk` | 98.55 起（步行进洞） | b08 V13 |

勇者 `expr`：`grin`（出发）→ `determined`（82.04 打怪）→ `grin`（83.83 金币）→ `hurt`（86.04 绕树后）→ `worried`（87.61）→ `grin`（88.40 升级）→ `laugh`（90.15 进村）→ `smug`（91.97 开箱）→ `squint`（94.04 风雪）→ `determined`（95.80 月光）→ `shock`（98.04 急刹）→ `determined`（98.55 进洞）。

白马 `horse.pose`：
| 值 | 时段 | 用在 |
|---|---|---|
| `gallop` | 81–82.10、83.70–86.04、95.80–98.04、98.48–98.72 | b07、b08 |
| `trot` | 82.10–83.70（打怪放慢）、88.10–90.15、93.90–94.04 | b07、b08 |
| `limp` | 86.04–88.10（瘸，`gait` 仍是 gallop） | b07 V07 |
| `walk` | 90.15–93.90（村庄） | b08 V09–V10 |
| `headwind` | 94.04–95.80（顶风前倾，`gait` trot） | b08 V11 |
| `skid` | 98.04–98.20（急刹扬尘） | b08 V13 |
| `rear` | 98.20–98.48（人立发抖） | b08 V13 |
| `hideRock` | 98.72 起（躲岩石后只露耳朵尾巴） | b08 V13 |

### 4.6 事件时刻 `JOURNEY.events`
`hudIn` 74.90｜`miniIn` 80.50｜`slimes` 82.04/82.12/82.20｜`bats` 82.30｜`slashes` 82.60/82.95/83.30｜`coins` 83.83+0.14·i｜`coinBite` 84.90｜`coinBounce` 85.45｜`treeGag` 86.039｜`scarfTorn` 86.134｜`heartCracks` 86.10/86.25/86.40/86.55｜`sigh` 87.40｜`noseBandage` 87.60｜`expPop` 88.01｜`lvUps` 88.40/89.10/89.80｜`expRetract` [89.60, 89.85]｜`windmill` 90.15｜`pigeons` 90.15｜`chicken` 91.05｜`containers` 92.00/92.35/92.70/93.05/93.40｜`grannyHug` 92.45｜`faint` 93.70｜`breath` 94.29/94.79/95.29/95.79｜`sneeze` 95.20｜`moonRise` [95.85, 96.85]｜`moonRoad` [96.20, 97.40]｜`brake` 98.04｜`rear` 98.20｜`dismount` [98.30, 98.55]｜`horseHide` [98.48, 98.76]｜`miniFlip` 99.20｜`hudOut` 99.30｜`push` [98.90, 99.60]｜`rewind` [165.10, 165.60]。

### 4.7 其它枚举
| 名称 | 值 | 用在 |
|---|---|---|
| 容器 `JOURNEY.containers[].kind` | `chest / pot / barrel / flowerPot / bigChest` | b08 V10（画法在 `props/village.js`） |
| 道具 `item` / `bagItems` | `potion / key / boots / shield / hat` | b08 V10 飞进背包 |
| 小地图 `walked` | `'red'`（去程）/ `'gold'`（归程） | b07/b08 / b14 |
| 小地图 `dir` | 1 / −1 | 去程 / b14 归程 |
| 区 id | 0 G·M｜1 V｜2 S｜3 N｜4 C | `journeyZones` |

---

## 5. 推荐用法

### 5.1 旅途一帧的标准图层配方（b07 81.00 起、b08 全段；共 5 个 `ctx.layer`）

```js
import { drawJourney, drawOccluder, journeyCam, journeyTexOffset, heroJourneyState, hudState } from '../env/journey.js';
import { drawMiniMap } from '../env/map.js';
import { applyCam } from '../core/camera.js';

draw(g, T, lt, ctx) {
  const c = journeyCam(T);                       // 整帧只算一次，所有层、遮挡物、角色共用同一个 c
  drawJourney(g, T, c, { layer: 'sky' });        // 屏幕空间，直接画
  ctx.layer(g, { shadow: 4, texture: 0.22, texOffset: journeyTexOffset(c, 0.25) }, (lg) => drawJourney(lg, T, c, { layer: 'far' }));
  ctx.layer(g, { shadow: 7, texture: 0.28, texOffset: journeyTexOffset(c, 0.8) }, (lg) => drawJourney(lg, T, c, { layer: 'mid' }));
  ctx.layer(g, { shadow: 10, texture: 0.3, texOffset: journeyTexOffset(c, 1) }, (lg) => {
    drawJourney(lg, T, c, { layer: 'main' });
    lg.save(); applyCam(lg, c, 1); /* 角色、怪、宝箱、村民（世界坐标），见 5.2 */ lg.restore();
    drawJourney(lg, T, c, { layer: 'front' });   // 白马躲的岩石、细雪片盖在角色前面
  });
  drawJourney(g, T, c, { layer: 'light' });      // screen 叠加光，直接画
  ctx.layer(g, { blur: 4, shadow: 12 }, (lg) => drawJourney(lg, T, c, { layer: 'fg' }));
  ctx.layer(g, { blur: 6 }, (lg) => drawOccluder(lg, T, c));   // 换区遮挡物永远在最上（HUD 之下）
  // HUD：左上角色卡（ui/kit.js）+ 右上小地图
  const hs = hudState(T);
  drawMiniMap(g, T, hs.mini);
}
```

### 5.2 在旅途世界里放角色（世界坐标、groundY、depth）

```js
import { drawHorse } from '../rigs/horse.js';
import { drawHero } from '../rigs/hero.js';
import { heroJourneyState, journeyGroundY, JOURNEY } from '../env/journey.js';

// 在 main 图层里、applyCam(lg, c, 1) 之后（depth 1 = 世界坐标）：
const st = heroJourneyState(T), h = st.horse;
const a = drawHorse(lg, {
  x: h.x, y: h.y, s: 1, face: 1, t: T,
  pose: h.pose, gait: h.gait ?? undefined, phase: h.phase, speed: h.speed,   // phase = x/280：蹄子不打滑
  bandageLeg: h.bandageLeg, noseBandage: h.noseBandage, icicles: h.icicles,
});
const heroO = {
  s: 1, face: 1, t: T, pose: st.pose, expr: st.expr, soot: st.soot,
  injury: { bandages: st.bandages, bump: st.bump, singed: st.singed, torn: st.torn },
  scarf: { notch: st.scarf.notch, hole: st.scarf.hole, frozen: st.scarf.frozen, glow: st.scarf.glow, len: st.scarf.len },
};
const onFoot = T >= JOURNEY.events.dismount[1];              // 98.55 起步行
drawHero(lg, onFoot ? { ...heroO, x: st.x, y: st.y } : { ...heroO, x: a.saddle[0], y: a.saddle[1], rot: a.saddleRot });

// 怪 / 容器：世界坐标 + 地面线
for (const sl of JOURNEY.slimes) drawSlime(lg, { x: sl.x, y: journeyGroundY(sl.x), t: T /* … */ });
for (const cn of JOURNEY.containers) drawContainer(lg, { kind: cn.kind, x: cn.x, y: cn.y, open: T >= cn.at /* … */ });
```

- 村民（容器主人）站在屋门口：屋子在 depth 0.95 层，门的坐标 `JOURNEY.houses[i].door` 是 **0.95 图层坐标**，要另开 `lg.save(); applyCam(lg, c, 0.95); drawCitizen(lg, { x: door[0], y: door[1], … }); lg.restore();`（画在 mid 图层里，或 main 图层里先画）。
- 跟着角色的屏幕 UI（「-8」、拟声字）：`toScreen(c, 1, x, y)`。
- 勇者伤痕 / 围巾 / 创可贴**只从 `heroJourneyState(T)` 取**，不要在块里另写时刻（90.00 接缝两边必须由同一函数算出）。

### 5.3 b07 城门拱换景（80.80–81.20，PLAZA → JOURNEY）

```js
const c = journeyCam(T);                                  // 81.00 前线性外推，照样用
const sx = occluderX(T, 'gateArch', c);                   // 城门拱中线屏幕 x：左边 PLAZA，右边 JOURNEY
ctx.mask(g, (mg) => mg.fillRect(-10, -10, sx + 10, 1100), (lg) => drawPlazaFrame(lg, T));   // 左：PLAZA（自己的块内函数）
drawJourney(g, T, c, { layer: 'sky', clipX: [sx, 99999] });
ctx.layer(g, { shadow: 4, texture: 0.22, texOffset: journeyTexOffset(c, 0.25) }, (lg) => drawJourney(lg, T, c, { layer: 'far', clipX: [sx, 99999] }));
// … mid / main / fg 同样带 clipX …
ctx.layer(g, { blur: 6 }, (lg) => drawOccluder(lg, T, c, 'gateArch'));
```

### 5.4 b08→b09 洞口遮罩、b14 倒放

```js
// b09（98.60–99.60）：洞口杏仁轮廓做遮罩，里面画洞内黑紫
import { caveMouthPath, journeyCam } from '../env/journey.js';
ctx.mask(g, (mg) => mg.fill(caveMouthPath(journeyCam(T))), (lg) => { /* dragonDeep → 近黑径向渐变 */ });

// b14（165.10–165.60）：倒放色带 + 小地图倒退变金
import { rewindBand, hudState } from '../env/journey.js';
rewindBand(g, T, seg(T, 165.10, 165.60));
const hs = hudState(T); drawMiniMap(g, T, hs.mini);       // r 1→0、dir −1、walked 'gold'
```

### 5.5 b03 蜡笔地图 + 蜡笔手、b03→b04 心形

```js
import { drawCrayonMap, drawCrayon, mapRoute, mapToScreen, MAP_ROUTE_R, CRAYON, heartPath } from '../env/map.js';
ctx.layer(g, { shadow: 10, texture: 0.3 }, (lg) => {
  lg.save(); applyCam(lg, c, 1);
  drawCrayonMap(lg, T, {
    icons: { sword: seg(T, 25.35, 25.65), mountain: seg(T, 28.17, 28.47), flag: seg(T, 28.35, 28.6), forest: seg(T, 30.12, 30.72), cage: seg(T, 32.03, 32.6), heart: seg(T, 32.3, 33.1) },
    route: r, heartFill: seg(T, 33.0, 33.2), heartBeatAt: 33.2, owlBlink: 30.6,
  });
  drawCrayon(lg, { tip: mapToScreen('crayon', ...mapRoute(r)), ang: 2.3, t: T, press: 0.6 });
  lg.restore();
});
// b04 心形遮罩：与地图上那颗心同一轮廓
const { x, y, h } = CRAYON.heart;   // 世界坐标；屏幕上用 toScreen 换算后再放大
ctx.mask(g, (mg) => mg.fill(heartPath(sx, sy, sh)), (lg) => drawThrone(lg /* … */));
```

### 5.6 b06 羊皮纸：卡背 → 风琴折 → 画路线

```js
import { drawMapCover, drawParchmentMap, PARCHMENT, MAP_ORDER, MAP_ROUTE_R } from '../env/map.js';
// 66.10–66.80：卡背 = 封皮（同一个函数），放大到第一片折页 {x:160, y:90, w:400, h:900}
drawMapCover(lg, lerpRect(cardRect, { x: 160, y: 90, w: 400, h: 900 }, k));   // lerpRect / cardRect 是块内自写的矩形插值与卡片位置
// 66.80 起：
drawParchmentMap(lg, T, {
  unfold: seg(T, 66.8, 68.0), dustAt: 68.0,
  landmarks: MAP_ORDER.map((_, i) => seg(T, 68.0 + 0.08 * i, 68.32 + 0.08 * i)),
  bounce: [68.6, 69.3, 70.0, 70.8, 71.5, 72.2], ring: seg(T, 68.1, 68.6),
  route, pin: seg(T, 72.4, 73.0), compass: TAU * inOutCubic(seg(T, 72.5, 73.3)), sweep: seg(T, 72.5, 73.3),
});
```

---

## 6. 与 assets.md 的差异

| 项 | assets.md | 实际 |
|---|---|---|
| `drawJourney` 层 | sky / far / mid / main / fg | 另有 `front`（角色之后画：岩石、细雪片）与 `light`（screen 叠加光）；`main` **不画**怪、宝箱、村民（只给位置：`JOURNEY.slimes / containers / houses`，由场景块调用 rigs / props 画） |
| 层深度 | far 0.05–0.3、mid 0.6–0.95、fg 1.2–1.5 | far 0.05–0.45、mid 0.55–0.95、fg 1.2–1.32 |
| `sky` 天色 | 按 camX 插值（storyboard：区间 600px 插值） | 每区一套天色，换区在遮挡物中线处硬切（接缝藏在遮挡物后，不做插值） |
| 城门拱深度 | assets 1.5；storyboard b07 写 depth 1.3、blur 3 | D = 1.5，墙体中心对准换景中线；blur 由镜头给（建议 6，与其它遮挡物同层） |
| `journeyCam(T)` | `journeyCam(T)` | `journeyCam(T, o)`，多 `o.drift`（默认叠 drift amp 5） |
| `heroJourneyState` | 列出伤痕 / 围巾 / 马的若干字段 | 另含 `x, y, pose, expr`、`scarf.len`、`horse.{x, y, angle, phase, speed, pose, bandageLeg}` |
| `hudState` | `{show, lv, nameReveal, hearts, coins, bag, exp, mini:{r, show, flip}}` | 另含 `lvAt, nameRevealAt, crackAt, heartFlash, heartShiver, coinAt, coinBounce, bagAt, bagItems, expBig, snailCrown, levelUpAt`、`mini.{fold, dir, walked}`；b14 段（≥164.08）`show` 恒 0，只出小地图 |
| 新增导出（journey） | — | `JOURNEY_CAM_KEYS`、`journeyCamSpeed`、`journeyGroundY`、`journeyGroundAngle`、`horseJourneyX`、`occluderX`、`JOURNEY_FIXED`、`journeyMiniR`、`journeyLayerX`、`journeyZones`、`journeyWorld`、`journeyTexOffset`（别名 `journeyTexOff`）、`caveMouthPath` |
| 新增导出（map） | — | `MAP_ORDER`、`MAP_FORMS`、`MAP_ROUTE_R`、`mapRouteAngle`、`mapRoutePoints`、`heartPoints`、`heartPath`、`CRAYON`、`PARCHMENT`、`MINI`、`drawMapCover` |
| `drawCrayonMap` 参数 | icons{sword,mountain,forest,cage,heart}, route, heartFill, owlBlink | 另有 `icons.flag`、`heartBeatAt`、`sheet`、`doodles`、`cam`；`icons.forest` 可传长度 7 数组 |
| `drawParchmentMap` 参数 | unfold, landmarks, bounce, route, ring, pin, compass, sweep | 另有 `knight`、`knightSize`、`dustAt`、`cam`；地标纸片除王城外放大 1.35 倍 |
| `drawMiniMap` 参数 | r, dir, walked, show, flip | 另有 `fold`、`knightSize`（默认 44）、`rect` |
| `drawCrayon` | `tip` | 另有 `ang, s, press, t, alpha` |

---

## 7. 已知限制与注意事项

- **性能**：标准配方 5 个 `ctx.layer`（far / mid / main / fg / 遮挡物）+ HUD；b07 城门拱期间再加 PLAZA 的遮罩，注意总缓冲 ≤ 8（可把 PLAZA 远景合并成 1 层）。换区期间两区都画（各裁一半），那几帧绘制量约 1.5 倍。
- **同一帧只算一次 `journeyCam(T)`**，所有层、遮挡物、角色、`caveMouthPath` 共用；自己另加 shake 时加到这个对象上再传，否则遮挡物与世界错位、接缝露馅。
- 遮挡物只在换区时刻附近出现（中线离屏一个宽度以上就跳过）；`drawOccluder` 不画 blur，忘了包 `{blur: 6}` 会显得太锐、抢戏。
- `o.zone` 强制某区时不做换区，也就没有遮挡物保护——只用于插画页、缩略图。
- `heroJourneyState` / `hudState` 只对 80.8–99.6（以及 hudState 的 b14 段 164.08 起）有意义；98.55 后勇者步行，99.6 之后 x 会继续增长（b09 不要再用它）。
- 时刻由 cue 相加得出、带浮点尾数（如第三次升级 `lvAt[2]` = 89.80000000000001）：T = 89.80 那一帧仍是 LV 3，下一帧（89.833）才是 LV 4；判断事件一律用 `T >= 字段值`，不要自己写死 89.8。名字牌省略号由 HUD 自己补（`nameReveal` 只给字数）。
- `heroJourneyState().pose` 在切换处是 `{from, to, k}`，`drawHero`/`drawHorse` 都接受这种写法；自己判断状态时取 `typeof p === 'string' ? p : p.to`。
- `horse.gait` 在 skid / rear / hideRock 时为 null，传给 `drawHorse` 时改成 `undefined`（让它用自己的默认）。
- 地图：`drawParchmentMap` 的 `bounce` 不传时地标不跳；`route ≥ 1` 时骑士停在 r 0.955；`ring` 用 `paperGlyph` 逐字画，字号固定 48px（放大机位时字跟着放大）。
- `drawMiniMap` 内部不跟机位，永远是屏幕坐标；b07 80.50 之前 `mini.show = 0` 不画。
- `drawCrayonMap` 的 `owlBlink` 不传时猫头鹰不出现（它在第 5 棵松前面）。

---

## 8. 模型图清单

| 模型图 | 内容 | 定稿输出 |
|---|---|---|
| `src/sheets/map.js` | [0,1) 三形态叠图 + 小地图 r 0 / 0.5 / 1 + walked 金色 + 小骑士 / 图钉；[1,2) 风琴折 unfold 0 / 0.33 / 0.5 / 0.66 / 1 + 城名环形字特写 + 蜡笔手 + 小地图翻面与折起 + 封皮；[25.35,34.10) b03 蜡笔地图走一遍；[66.40,74.45) b06 羊皮纸走一遍 | `out/review/sheets/map/final_t{0.50,1.50,27.00,30.90,33.30,67.30,68.60,70.85,73.20}.png` |
| `src/sheets/journey.js` | [0,1) 五区 + 换区缩略图；[1,2) 六种遮挡物 + 倒放色带 + 归程小地图；[2,3) hudState / heroJourneyState 数值表；[80,99.6) 全段一镜到底（占位勇者 / 白马 / HUD，只为验位置与状态） | `out/review/sheets/journey/final_t{0.50,1.50,2.50,81.00,86.00,89.95,90.00,93.95,95.75,97.75,98.80,99.45}.png`；全段验收联系表 `out/review/sheets/journey/final_run.jpg`（80–99.6，每 0.25s） |

两张模型图按真实时间轴取时刻；时间轴空档放了一页索引（`sheet_map_index` [2,66.4)、`sheet_journey_index` [3,80)），所以 `check.mjs` 默认 8 个采样点不再报空镜。

验收命令：

```bash
./tools/lint.sh src/env/map.js src/env/journey.js src/sheets/map.js src/sheets/journey.js
node tools/check.mjs sheets --list map,journey
node tools/render.mjs sheet --sheet journey --from 80 --to 99.6 --every 0.25 --cols 8 --tile 300 --out out/review/sheets/journey/final_run.jpg
```
