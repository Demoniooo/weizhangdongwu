# 集成备忘（集成负责人维护）

给各块作者的额外指示与已拍板的决定。场景作者开工前先读全局条目和自己块的条目。

## 全局
- 勇者围巾在窄平台/红毯上的处理见 docs/scene_guide.md 第 6 节。围巾不跟随 `turn`（转身一周时会在半程翻边），跳舞转圈的镜头自己画围巾或缩短。
- **朝左走/骑**：勇者的 `phase` 不随 `face` 翻转（马的会）。朝左行进时传 `phase = face × 路程 ÷ 步幅`，否则腿会“太空步”；勇者 trot/walk 步态还要乘 280 ÷ HERO_STRIDE。详见 docs/api/hero.md 第 7 节、docs/api/horse.md。
- **逐帧像素对比**（接缝验收）一律加 `--nograin`（胶片颗粒每 1/12 秒换一次，会让不同时刻的两帧整屏差 ±10）。
- **只给某一层降饱和/提亮**：`ctx.layer(g, { sat: 0.75, bright: 0.95, contrast, filter }, fn)`（引擎已支持，按图层生效）。整帧的 `ctx.fx.sat` 会把所有东西一起降——要“灰色王国里只有警报红是饱和的”就把红色元素单独放一层不降饱和。
- 插值姿势（{from,to,k}）若两端手持物不同（卫兵长矛换手/消失、传令官号角、书记官本子换卷轴），道具会在 k=0.5 处跳变；慢速过渡时注意避开或用遮挡。

## 按块
- **b01 / b17**：书签只用一种——`src/env/book.js` 的 `drawBook` 自带书签参数（`o.bookmark`）；不要另调 `props/scarf.js` 的 `drawBookmark`，保证开头与结尾同一个书签。b01、b02、b17 的立体书/王城必须用 `castle.LAYER_GROUPS` 三组分层（见 docs/api/castle.md 第 5 节），重叠期 b01 用 `book.bookCardCovers(T)` 判断后省掉书桌/书/书签层，否则缓冲超预算。
- **b02**：王城阳台自带一盏红灯笼（castle.js），不要在同一位置再画 `drawLantern`。10.39 之前不要给机位加 drift、不要做羽化遮罩，否则 b01→b02 逐像素一致的交接会破（docs/api/castle.md）。阳台左侧花箱会挡住站在那里的人到胸口，三人站位 x ≈ 935 / 985 / 1035。
- **b15 / b16（接缝 185.47，14:25 裁定）**：合同 'b15|b16' 改 4 处——① 公主竖幅/尾段 `base: princessLight`、`ink: red`、gold 边，蝴蝶结右环 princessLight；② 勇者横幅路径 = 画左短引线（≤150 单位）→ 13 字从左往右（纸鸽正常速度拉开，逐字按 NAME_TIMES('E12')）→ 再绕主堡尖塔一圈 → 蝴蝶结；③ 王冠 tilt 12°（到 O06 回正）；④ 阳台站位 935 / 985 / 1035（避开花箱）。一切以 `_seams.js` 定稿为准，从 SEAMS 读值不要硬编码。
- **b17**：book.js 里沉睡的小蜥蜴与片名字是占位，换成真的 `drawLizard`（pose 'sleep'）与 `type.titleGlyphs`（参数名不同，docs/api/castle.md 给了包装写法）。199.36–199.66 灯光尘埃淡入已做好。
- **b16**：跳舞转圈时围巾见“全局”。王座厅夜景（TR_NIGHT）默认偏灰、三根柱子的烛光糊成一片：用 `ctx.fx.contrast` / `vignette` 或 `candles:false` 调出夜与烛光的对比。夜窗里没有远处塔楼——196.80 “窗外旗子耷拉”的笑点要在块内自己画。
- **b05 / b06**：圣旨用 `drawThroneRoom` 的 `decree` 参数（新增 `unroll`、`prints`、`printDur`、`layer:'main'`），返回值里的 `decree.chars`（13 个字的屏幕坐标）就是印章字飞回圣旨的落点。接缝 56.89 两边的 `decree.layer / hung / sweep` 必须与 `_seams.js` 合同完全一致，中途换 layer 会跳。王座厅新增机位：`TR_NAME`、`TR_KING2S`、`TR_SEAL`、`TR_SEAL2`、`TR_LOW`、`TR_HERALD`、`TR_SCROLL`（docs/api/plaza_throne.md）。
- **b08 / b09**：“洞口 = 龙眼”形状匹配——杏仁巨眼（`drawDragonEye` 的 `shape:'almond'`）轮廓与 `journey.caveMouthPath` 两端尖角略有差异；交接遮罩两边都用 **`caveMouthPath`** 同一个形状（b09 的巨眼睁开时也用它裁切/描边），保证对位一致。
- **b11 / b12**：b12 台口里的龙洞背景片（`drawCave({flat:true})`）不画前景层、饱和度约低 10%，与 b11 137.40 那一帧不是逐像素一致。**b11 在 137.0–137.40 把前景层淡出、把洞穴各层 `sat` 渐变到约 0.9**；b12 从 137.40 起接手黑边→台口（docs/api/cave_theater.md）。洞穴光照从 `glint` 换到 `lit` 亮度会从 0.56 跳到 1，要用 `{ from:'glint', to:'lit', k }` 渐变（b09）。
- **b13**：storyboard 给 E01 的机位 `cam(1300,420,1.5)` 只看得到世界 y 60–780，地面（y≈900）和落地的鸟笼（`CAVE.cage.landed` = (1320, 778.7)）出画了——机位往下调。B11 157.17 斩线让台板裂开用 `drawTheater` 的 `floorCrack`（`theaterState` 已返回）。
- **b02**：鸟笼扣下落地的挤压用 `drawCage` 的 `squash`。
- **b07 / b08（旅途）**：`drawJourney` 的 main 层**不画**史莱姆、宝箱、村民，只提供位置（`JOURNEY.slimes`、`JOURNEY.containers`、`JOURNEY.houses`），由块内调用 monsters/village/folk 画；小屋的 `door` 坐标是 depth 0.95 那一层的坐标，不是世界坐标。事件时刻有浮点尾数（第三次升级是 89.80000000000001），判断一律写 `T >= 字段值`，不要手写秒数比较。城门拱遮挡物实际 depth 1.5（storyboard 写 1.3，以代码为准）。HUD/小地图一律取 `hudState(T)`、`journeyMiniR`，保证 90.00 接缝一致。
- **b06**：片名页“盘龙剪影只亮一只眼”用 `drawDragon({ pose:'coil', silhouette:true, keepColor:['eye'], eyes:{ one:true } })`（docs/api/dragon.md 第 5 节）。
- **b13**：B12 逐节弹飞的每字时刻 `tPop` 由块内按走马灯进度自己算（docs/api/dragon.md 第 5 节）。
- **b14**：176.40 国王“晕倒 + 两腿朝天 + 被纸卷裹住”三者不要在同一帧给满（腿会被纸卷盖住）——先晕倒翘腿、再裹。E03 公主坐后座用 `drawPrincess` 的 `rot: saddleRot` 跟马背俯仰。`aisle`（纸卷铺成通道）只是纹理，要能读出字的地上卷轴由块内自己画（`props/paper.js` 的 `drawScroll`）。
- **b03**：告示拍上告示板（L06）用 `drawPlaza` 的 `noticeOpts`（直传 `drawNotice`：unroll、pins、squash）。广场远景里的小王城是简化版，不能当作与 CASTLE 世界对位的匹配剪辑。
- **b13**：花瓣环里最后一字「红」164.77 才诞生，按默认参数头顶花环约 165.25 才完成（storyboard 要求 164.90）。用 `drawPetalOrbit` / `petalOrbit` 的 `crown` 时序参数提前收成花环（见 docs/api/props.md 第 7 节）。
- **b15**：公主横幅底色以色彩剧本为准——`princessLight` 底 + `gold` 边 + 深色字（`princessDark` 或 `red`），不用红底（props 默认是红底，需传参覆盖，写法见 docs/api/props.md）。勇者横幅 `skyDayLow` 底 + `gold` 边。
- **b17**：无限卷轴里「王浩然」默认固定在路径起点，不随卷头移动；如果分镜要“卷头是大大的王浩然”，在块内自己在卷头位置补画大号「王浩然」（`paperGlyph`），或用 drawInfiniteScroll 的参数调整（见 docs/api/props.md）。
- **b10**：听岔道具卡被烧（R1 117.03 起）只用 `fx/transitions.js` 的 `burnEdge`，把 `kit.itemBar` 作为它的 `draw` 传进去，再配 `misc.ashDraw` 纸灰粒子；**不要**同时用 itemBar 自带的 `burn`（两条燃烧线对不齐）。图标本身没有烧焦态。入场甩镜帘（b09→b10，速度线带由右往左）写 `whipCurtain(..., { from: 'right' })`——写 `dir:'left'` 方向是反的（docs/api/fx_player.md）。
- **b03**：入场甩镜帘（b02→b03，镜头向下甩、速度线带由下往上）用 `whipCurtain(..., { from: 'bottom' })`，按 docs/api/fx_player.md 核对方向。
- **b11**：135.40 的“flash 1.0 保持 2 帧、shake 26”写 `impact(ctx, T, at, 'L', { shake: 26, flash: 1, frames: 2 })`；`'MAX'` 只留给全片唯一一次（b13 的 B11 157.17）。
