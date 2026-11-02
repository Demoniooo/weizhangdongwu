# 场景块作者指南（17 位作者共用，务必通读）

项目根：`/Users/erapi0neer/dalabengba-mv`。你负责 `docs/blocks.json` 里的一个制作块（例如 b05），写出 `src/scenes/b05_names.js`。全片 17 块由 17 位作者**同时**编写，所以本指南的约定是大家能拼成一部连贯成片的前提。

## 1. 必读（按顺序）

1. `docs/brief.md`：风格、角色、硬性约束（10 分钟读完）。
2. `docs/storyboard.md`：第 1–4 节（视觉主张、色彩剧本、全片规则、各地点固定布局），**你那一块的整节**，相邻两块的“入场/出场/交接”，第 6 节名字梗总表里与你有关的行，第 7 节贯穿道具，第 8 节 cue 覆盖检查表里你的 cue，第 9 节交接一览，第 10 节风险与降级。
3. `docs/engine.md`：引擎、图层、遮罩、后期、粒子、自检命令。
4. `docs/api/*.md`：你要用到的基础模块的 API（ui、hero、horse、royals、dragon、folk、castle、plaza_throne、cave_theater、map_journey、props、fx_player）。文档与代码不一致时**以代码为准**（读源码里的 JSDoc 与默认值）。
5. `docs/seams.md` + `src/scenes/_seams.js`：如果你的块有“隐形接缝”（见第 4 节）。
6. 模型图：`out/review/sheets/<模块>/final_*.png`，先看一眼角色和布景实际长什么样。

## 2. 文件与镜头约定

- 你的文件 `src/scenes/bXX_*.js` 默认导出镜头数组；块内私有辅助放 `src/scenes/bXX/*.js`（自己建目录）。
- 镜头 `{ id, start, end, z?, draw(g, T, lt, ctx) }`，`id` 以块号开头（`b05_n1`），全片唯一；`start/end` 一律用 `cue('N1a') + 偏移` 写，不写死秒（`import { cue, CUES, NAMES } from '../cues.js'`）。
- **块的覆盖范围必须严格等于 `docs/blocks.json` 的 [start, end)**：块内任何时刻至少有一个镜头在画满屏（否则会出现 NO SHOT 空镜），且不得画到范围之外。
- **不许修改任何共享文件**：`src/core/*`、`src/env/*`、`src/rigs/*`、`src/props/*`、`src/ui/*`、`src/fx/*`、`src/cues.js`、`src/story.js`、`src/scenes/index.js`、`src/scenes/_seams.js`、`tools/*`、其它块的文件。缺功能时：
  - 角色缺姿势 → 用最接近的 pose + `joints`（关节角增量，度）微调；仍不行就在 `src/scenes/bXX/` 里自己画那个局部（例如特殊手势、道具），并在交付文档的“需求”一节写明。
  - 基础模块有 bug → 在自己块里用参数绕开，写进“需求”一节，集成负责人统一修。
- 纯函数：画面只由 T 决定。禁止 `Math.random()`、`Date.now()`、跨帧缓存状态（模块级常量、预建的 Path2D 可以）。随机用 `hash1/hash2/mulberry32(固定种子)`。

## 3. 计时（卡歌词的铁律）

- 每个 cue 只有一个**重音动作**（砸、喊、立起、弹出、拔剑……），落在 `cue + 0.00 … +0.15s`；预备动作放在 cue 之前（0.1–0.4s），余波放在之后。
- 名字逐字时刻一律用 `NAME_TIMES(seg)`（`src/ui/type.js`），不手抄秒数；逐字出现用 `glyphRow(..., { appear })` 或 `glyph13`。
- 走马灯进度 = 本 cue 已过时间 / 本 cue 时长。
- 纯音乐段（前奏 0–10.39、间奏一 56.89–74.40、间奏二 120.97–137.92、尾奏 201.6–208.1）在其它版本里可能被拉长：动作链要停在清楚的姿态上，留出保持。

## 4. 接缝与转场

- **隐形接缝**（b04→b05 41.90、b05→b06 56.89、b07→b08 90.00、b10→b11 120.97、b12→b13 150.52、b15→b16 185.47、b16→b17 197.77）：两块不重叠、不转场，前一块最后一帧与后一块第一帧要几乎像素一致。做法：`import { SEAMS, drawSeam } from './_seams.js'`，在接缝时刻 T 把机位、漂移、布景参数、每个角色/道具/界面的参数**严格设成合同里的值**（离开接缝 0.3s 以上可以自由运动；接近接缝时用缓动“落到”合同状态，或从合同状态“起步”）。验收：你的块在 T（或 T−1/30）的画面与 `drawSeam` 在 T 的画面对比，只允许次级运动（眨眼、飘动）不同。
- **接缝自检工具**：`node tools/seams.mjs --list "b04|b05"`（多个用逗号分隔）——对每个接缝渲染 A（全片 T−1/30）| REF（drawSeam 参考）| B（全片 T），输出平均像素差（< 0.01 看不出，0.01–0.03 轻微，> 0.03 必须对齐）和对照图 `out/review/seams_check/<接缝>.jpg`（已自动关掉胶片颗粒）。
- **重叠转场**（其余 9 处）：后一块的 start 早于前一块的 end。**转场由后一块画**：后一块在重叠期内用 `ctx.mask` 揭示自己（或在最上层 `z: 1` 画擦屏物）；前一块在重叠期内照常绘制、动作继续，不要提前淡出。
- 全片唯一的硬切在 18.00（b02 内部）。其它地方不许硬切、不许交叉溶解。块内转场按 storyboard 写的方式做（翻页、遮罩、擦屏物、甩镜带手画速度线、推镜穿越）。

## 5. “精致”的标准（评审会逐条检查）

1. **构图**：每一帧有明确焦点（视线、对比、留白引导到它）；主体落在三分线附近或刻意居中；画面四边有东西压住（前景、边框），不出现“空的一角”；守安全区（左右 96px、上下 72px）。
2. **层次**：至少 3 层景深（远 / 中 / 主体 / 前景），用 `applyCam(g, cam, depth)` 做视差；前景层 `blur 3–5`；每层 `ctx.layer` 给纸片投影（远景 4–6、主体 8–12）与纸纹 `texture 0.25–0.35`。
3. **光**：主光左上、投影右下；同一地点同一时段的光一致；夜景、洞穴用 `tint` 图层压暗 + `glow` 点光源。
4. **色彩**：按 storyboard 第 2 节色彩剧本；只用 `PAL`；同一时刻主色 ≤3、点缀 ≤2。
5. **运动**：一切位移都缓动（入场 outBack/outExpo/spring 带过冲，常规镜头 glide，冲击推近 snap）；有预备动作和跟随余振（围巾、呆毛、王冠、龙尾、旗帜、裙摆）；群体动作错峰 30–80ms；动作结束后保持 0.2s 以上再做下一件事；匀速只用于持续行进。
6. **机位永远活着**：所有机位叠 `drift(T, {amp 4–6, speed 0.35})`（storyboard 指定锁死的除外）；情绪点推近，冲击点震动（`ctx.fx.shake` 或 `src/fx/transitions.js` 的 `impact`）。
7. **表演**：角色在每个 cue 都有可读的表情变化；不说话的角色也在反应（眨眼、转头、呼吸、小动作）；表情在动作之前 2–4 帧变化（先想后动）。
8. **文字**：只允许 storyboard 第 3.5 节列出的文字（四个长名字、王浩然、≤5 字短对白/拟声、自拟界面字、听岔五名词、片尾署名），**绝不写歌词原句**；名字每字屏幕 ≥48px，变形/飞走前静止可读 ≥0.25s；符号（星、心、对勾、三角、箭头、圈数字）用 `glyphIcon` 路径画，不用字体字形。
9. **字幕带**：有人声的段落（10.39–56.89、74.40–120.97、137.92–201.60）里 **y ≥ 920 只放装饰**（地面、脚灯、前景物），不放名字、界面、对白、关键动作。
10. **没有死帧**：任何 0.5s 窗口里画面都有东西在动（至少次级运动 + 漂移 + 粒子）。

## 6. 已知素材注意事项

- **勇者的超长围巾**默认平铺在脚底高度向身后拖 780×s。在阳台、塔顶、窄台面上会“悬空伸出平台”；在红地毯上红配红看不清。用 `scarf: { len, trail, to, ground, vel, wind }` 控制：窄处缩短 `len` 或用 `trail` 自定义点列让它从栏杆垂下；红毯上让它飘起或搭在台阶上。参见 `docs/api/hero.md`。
- 小人物（外景 s≤0.3、远景群众）传 `detail: 0` 用简化版，省性能也更干净。
- 每帧全屏缓冲（`ctx.layer` + `ctx.mask`，遮罩里再开图层再算一个）≤ 8，**包括重叠期两块相加**；不要逐个小形状 `shadowBlur`，投影按图层给。
- 字体：名字/标题 `display`（黄油体），对白/界面 `play`（快乐体），数字/LV/HP `latin`（Fredoka），旁白/片尾 `serif`（小薇）。「·」只在 play/latin 里有。

## 7. 自检流程（每完成一个镜头就跑；至少完整迭代 2 轮）

```bash
cd /Users/erapi0neer/dalabengba-mv
./tools/lint.sh src/scenes/bXX_*.js src/scenes/bXX            # 语法 + 乱码 + 非确定性；必须通过
node tools/check.mjs blocks --list bXX --samples 12             # 块内 12 个时刻：无报错、无空镜
node tools/render.mjs cues  --only bXX --from <start> --to <end> --out out/review/bXX/cues.jpg          # 每个 cue 后 0.12s 一帧：检查“这一句的画面”
node tools/render.mjs sheet --only bXX --from <start> --to <end> --every 0.25 --cols 8 --tile 300 --out out/review/bXX/sheet.jpg   # 节奏与连贯
node tools/render.mjs stills --only bXX --times <关键时刻> --outdir out/review/bXX                     # 全分辨率细看
node tools/pops.mjs --only bXX --from <start> --to <end>         # 非计划跳变
# 接缝 / 转场：把相邻块一起渲染（相邻块可能还没写完，那就对照 drawSeam 或 storyboard 描述）
node tools/render.mjs stills --only bXX,bYY --times <交接时刻> --outdir out/review/bXX/handoff
```

**每张图都要用 Read 打开亲眼看**，对照 storyboard 逐 cue 检查：画面是不是那一句在讲的事？重音动作是否落在 cue 后 0–0.15s？构图、层次、光、色、表演、文字规则、字幕带。中文写进文件后可能出现乱码（U+FFFD），lint 会抓，必须修掉。多人同时渲染，**输出只写到 `out/review/bXX/`**。

## 8. 交付

1. `src/scenes/bXX_*.js`（+ 可选 `src/scenes/bXX/`）。
2. `docs/blocks/bXX.md`：
   - 实现的镜头表（镜头 id、起止 cue/秒、内容一句话）；
   - 与 storyboard 的差异及原因；
   - 接缝 / 转场自检结果（对哪几帧、结论）；
   - 已知问题（按严重程度）；
   - 需求（需要基础模块增加/修复的东西，写清文件、函数、现象、建议）。
3. `out/review/bXX/` 下的 cues.jpg、sheet.jpg 与关键帧 PNG。
