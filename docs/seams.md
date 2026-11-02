# 隐形接缝合同（七处）

> **合同定稿时间：2026-10-01 15:10**（含集成负责人对 `'b15|b16'` 的四处裁定，见第 10 节“变更记录”）。
> 代码：`src/scenes/_seams.js`（`SEAMS` 合同数据 + `drawSeam` 参考实现 + 共享函数）；模型图：`src/sheets/seams.js`；参考画面：`out/review/seams/`。
> 依据：storyboard 3.8（隐形接缝铁律）、第 9 节（交接一览）与各块的入场 / 出场描述。

隐形接缝 = 同地点、同机位、不重叠、不转场：**A 块最后一帧与 B 块第一帧几乎像素一致**。两边作者看不到彼此的代码，所以接缝时刻 T 的完整画面状态（机位、漂移、图层栈、每个角色 / 道具 / 界面的全部参数、整帧后期）都写在合同里。两块都 `import` 合同，在接缝附近严格画成合同的样子；离开接缝后各自自由运动（`motion` 写了接缝前后各自该怎么动，速度方向要衔接）。

| # | 接缝 | 时刻 T | 地点 / 机位 | 一句话 |
|---|---|---|---|---|
| 1 | `b04\|b05` | `cue('N1a')` = 41.90 | 王座厅（晴）TR-2S | 问名 → 报名：空对话框、名签「？？？」、勇者吸气到最鼓、全场前倾 |
| 2 | `b05\|b06` | `cue('I1')` = 56.89 | 王座厅（晴）TR-HIGH | 圣旨吊成横幅横跨大厅、彩纸在落、国王举金印、头顶名签溢出全名、全场欢呼 |
| 3 | `b07\|b08` | `cue('V09') − 0.15` = 90.00 | 旅途长卷 `journeyCam(T)` | 一镜到底，接缝藏在大橡树后（HUD / 小地图 / 人马全部由共享函数算） |
| 4 | `b10\|b11` | `cue('I2')` = 120.97 | 龙洞（全亮）CV-LOW-END | 名字墙完好、龙吼到顶 → T 帧就是撞墙冲击第一帧 |
| 5 | `b12\|b13` | `cue('B08')` = 150.52 | 纸剧场（紫灯）TT-W | 台口刚弹开，勇者偶被含在龙偶嘴里只剩两条腿 |
| 6 | `b15\|b16` | `cue('O01')` = 185.47 | 王城婚礼 cam(960,540,0.9) | 礼物城堡：两条名字横幅绕尖塔系成蝴蝶结，烟花、彩纸 |
| 7 | `b16\|b17` | `cue('O07')` = 197.77 | 王座厅夜景 TR-NIGHT | 收拢成 3 格的取名面板「王浩然」+ 对勾章，全家松口气 |

---

## 0. 通用约定（七处都适用）

### 0.1 合同字段

每项 `SEAMS[key]`（key 如 `'b04|b05'`）：

| 字段 | 含义 |
|---|---|
| `T`、`cueId` | 接缝时刻（一律 `cue(...) + 偏移`）。A 块画 `[.., T)`，B 块画 `[T, ..)`，不重叠。 |
| `A`、`B`、`loc`、`title` | 前 / 后块、地点、画面一句话。 |
| `cam` | 基础机位（不含漂移）。旅途与剧场的机位随时间变，用 `camAt(T)`。 |
| `drift` | 漂移参数。全片统一 `DRIFT = { amp: 5, speed: 0.35, seed: 3 }`；旅途的漂移已内置在 `journeyCam(T)`（amp 5、seed 21），**不要再叠**。 |
| `env` | 布景：`{ fn, params }`。`layers` 里的 `'env:<层名>'` = 在这个图层里调一次布景函数画这一层（剧场是 `part`，其它是 `layer`）。婚礼的 `env.onBalcony` 列出画进 `drawCastle` 阳台回调的角色。 |
| `layers` | 图层栈（从下到上）：`{ id, o, clip?, draw:[…] }`。`o` = `ctx.layer` 参数（shadow / texture / blur / texOffset…），`null` = 直接画在 g 上；`draw` 按顺序列出这一层里画的东西（布景层名或下面元素的 id）。**哪个东西画在哪一层、什么顺序、图层参数是什么，都是合同的一部分**（投影与纸纹按图层算，换一层画面就不一样）。 |
| `actors` / `props` / `ui` | 元素表，每项 `{ id, fn, space, depth?, at?, base?, params, note }`。 |
| `fn` | `FN` 注册表里的函数名（签名统一为 `fn(g, params)`；原签名不同的已薄适配：`drawBanner` 读 `params.path`，`drawMiniMap` / `drawNameWall` 读 `params.t`，`drawOccluder` 读 `params.t / cam / kind`）。合同自己定义的组合画法（`drawJourneyRider`、`drawSeamConfetti`、`drawHeroBanner`、`drawSeamPanel`…）也在 `FN` 里并单独导出，两块直接调用。 |
| `space` | `'world'`：先 `applyCam(lg, cam, depth ?? 1)` 再画（世界坐标）；`'screen'`：屏幕坐标直接画；`'follow'`：屏幕坐标的界面，锚在世界点 `at`（`depth` 层）经 `toScreen(cam, depth, …)` 换算的位置，`params.dx / dy` 是屏幕偏移；`'parallax'`：按 `base` 机位设计的屏幕坐标，机位漂移时按 `depth` 层视差移动（`applyParallax(g, cam, base, depth)`）；`'balcony'`：画在 `drawCastle` 的 `onBalcony` 回调里（已在主体层机位里）。 |
| `params` | 参数。值为**函数**时 = 随时间变的量，按当前 T 求值 `f(T, E)`，`E = { c: 当前机位, A: 本帧已画元素的返回锚点（按 id） }`；`NOW` = “传当前 T”。用 `resolveParams(params, T, E)` 得到某一时刻的确切参数。 |
| `fx` | 整帧后期（写进 `ctx.fx`），值可以是函数。 |
| `motion` | 接缝前后各自在做什么（衔接速度方向用）。 |
| `notes` | 其它约定。 |

### 0.2 机位与漂移（两边必须同一公式）

```js
import { withDrift, DRIFT } from './_seams.js';
const c = withDrift(S.cam, T, S.drift);      // = cam(x + dx/zoom, y + dy/zoom, zoom, rot)，[dx,dy] = drift(T, DRIFT)
```
主体层在屏幕上平移 (dx, dy) 像素，zoom / rot 不变。**不要用 `addv(cam, drift(T))`**：`cam()` 是对象，`addv` 会算出 `[NaN, NaN]`（见第 9 节问题 2）。合同里的 `seamCam(key, T)` 给出接缝附近任一时刻的实际机位（旅途 = `journeyCam(T)`，剧场 = `withDrift(theaterCam(T), T, DRIFT)`）。

### 0.3 时间与 t

- 所有木偶、布景、界面的次级运动参数 `t` 一律传 **T 本身**（`t: NOW`）——眨眼、呼吸、烛火、光标闪烁、头发抖动才两边一致。
- 带时刻的事件（彩纸 burst、烟花、扫光、钟乳石下落、撞墙冲击）在合同里写成**绝对时刻**的共享参数（如 `CONFETTI_N4C`、`FIREWORKS_E12`、`IMPACT_I2`），两块调用同一函数，T 之后 B 块照样画到它们自然结束。

### 0.4 A 块怎么“落到”接缝、B 块怎么“从”接缝起步（通用）

- **A 块**：最后 0.3–0.5s 把一切动作收进合同状态——机位停在 `cam`（只剩漂移）、角色摆到合同姿态 / 表情、自己的震动 / 闪白 / 推近衰减到 0（< 0.5px、< 0.01）。最后一帧（T − 1/30）与 `drawSeam(T − 1/30)` 一致。
- **B 块**：第一帧（T）与 `drawSeam(T)` 一致；之后的动作从合同状态出发，**起步速度要连续**：机位从静止 glide 起步（glide 两端速度为 0），角色的 `{from: 合同姿态, to, k}` 从 k=0 开始，参数插值从合同值开始。
- 合同里的“随时间变的量”（函数参数）两边在接缝附近都必须调用合同的同一函数，不能各写一份。

### 0.5 验收方法（每处接缝都这样做）

参考画面 = 模型图 `seams`：第 k 处接缝占 [2(k−1), 2k) 秒，段内时间 lt 映射到 `T' = T + (lt − 1)`，**段中点 2k−1 = 接缝时刻 T**；A 块最后一帧对应 `2k − 1 − 1/30`。

```bash
cd /Users/erapi0neer/dalabengba-mv
K=1; TA=41.8667; TB=41.90                                            # 第 1 处：T−1/30 与 T
node tools/render.mjs stills --only b04 --times $TA --nograin --outdir out/review/seams/check/a
node tools/render.mjs stills --only b05 --times $TB --nograin --outdir out/review/seams/check/b
node tools/render.mjs stills --sheet seams --times 0.9667 --nograin --outdir out/review/seams/check/refA   # = drawSeam(T−1/30)
node tools/render.mjs stills --sheet seams --times 1 --nograin --outdir out/review/seams/check/refB        # = drawSeam(T)
# 逐像素对比（PSNR ≥ 35dB 视为“几乎一致”；差异图越黑越好）
ffmpeg -i out/review/seams/check/a/t41.87.png -i out/review/seams/check/refA/t0.97.png -lavfi psnr -f null -
ffmpeg -y -i out/review/seams/check/b/t41.90.png -i out/review/seams/check/refB/t1.00.png -lavfi "blend=all_mode=difference,eq=contrast=6" out/review/seams/check/diffB.png
```

注意：参考图左下角有一块标签（模型图专用，在字幕带里），对比时忽略这一块；`--nograin` 关掉胶片颗粒（颗粒每 1/12s 换一张，不关会在全画面产生噪点差异）。各处接缝的具体时刻见每节的“验收”行。

### 0.6 预算

七份合同每帧 4–8 个 `ctx.layer`（含界面层），均在 8 以内；前景虚化层每帧 ≤ 1；单次 burst ≤ 150 粒。

---

## 1. `b04|b05` · 41.90（N1a）· 王座厅 TR-2S

**画面**：TR-2S `cam(1060,600,1.35)` + 漂移。勇者在画左 (620,880)，吸气到最鼓（pose `inhale` + `inflate 1`、呆毛 `straight`、围巾被气流掀起 `wind [-20,-150]`），头顶小名签「？？？」；国王站在台阶 (1500,790) 探身（`leanForward`，表情 `joy`，王冠 tilt 15 / slip 0.12）；朝臣三人（depth 0.9，勇者身后）前倾；传令官、书记官、卫兵（无高帽）在对话框后面只露矛尖 / 帽翎 / 笔尖。屏幕下方对话框：默认矩形 (420,690)–(1500,900)，勇者头像在左端、红名签「？？？」，空文字，闪烁光标。

| id | 函数 / 空间 | 关键参数 |
|---|---|---|
| env | `drawThroneRoom` | `light:'sunny', windowL/R:'day', lectern:true, confettiFloor:0.35` |
| courtiers | 群演 world depth 0.9（画在 mid 层） | 变体 0/3/6，x 300/430/545，`pose:'lean', courtier:true, face 1` |
| guardL / herald / scribe | world | 卫兵 (1240,880) `lean, hat:false`；传令官 (980,880) `idle + joints.lean 9`；书记官 (1150,880) `idle, expr focused, joints.lean 6` |
| king | `drawKing` world | (1500,790) `face -1, leanForward, joy, crown {tilt:15, slip:0.12}` |
| hero | `drawHero` world | (620,880) `face 1, inhale, expr normal, inflate 1, ahoge straight, scarf {len 780, wind [-20,-150]}` |
| headTag | `nameTagSmall` follow | 锚在世界 (590,548)，`text '？？？', kind 'head', size 40` |
| dialog | `dialogBox` screen | `speaker 'hero', tag '？？？', text '', cursor true, textArea {x:600, w:784}, t: T` |
| fx | | `sat 1.05` |

图层：back `{texture .22}` → mid `{shadow 10, texture .28}`（布景 + 朝臣）→ main `{shadow 8, texture .28}`（布景 + guardL、herald、scribe、king、hero）→ glow（直接画）→ fg `{shadow 12, texture .2, blur 4}` → ui `{shadow 10, texture .3}`（headTag、dialog）。

**光标相位**：`dialogBox` 光标周期 0.4s、亮在每周期前 62%，相位 = `t mod 0.4`。41.90 时相位 0.75（灭），41.8667 时 0.67（也灭）——接缝两侧光标都不亮，**b05 可以从 41.90 起直接不画光标**。

**A（b04）怎么落**：39.91–40.50 拉回 TR-2S 后机位只剩漂移；40.60 全场前倾、41.20 起保持；41.60 前勇者已鼓满（inflate 1）；41.60–41.90「咳咳」逐字弹走（`erase` 0→1，41.90 前字已全部消失）；腋下的告示卷在 38.11 前收掉（合同里不画）。
**B（b05）怎么起**：41.90「达」从 0 开始弹进框（outBack）；勇者 0.12s 内放气（inflate 1→0）、`{from:'inhale', to:'shout'/'proud'}`；机位 41.90 起 glide 推向 `cam(1080,640,1.42)`（起步速度 0）；书记官开始在本子上写（`idle → write`）。
**验收**：A `--only b04 --times 41.8667` 对 `--sheet seams --times 0.9667`；B `--only b05 --times 41.90` 对 `--sheet seams --times 1`。

---

## 2. `b05|b06` · 56.89（I1）· 王座厅 TR-HIGH

**画面**：TR-HIGH `cam(1000,470,0.85)` + 漂移，全厅大全景。圣旨吊成横幅横跨大厅（`drawThroneRoom` 的 `decree {hung 1, chars 13}`，世界 x 260–1880、y 218–322，mid 层），金字上一道扫光正走到中间（`decreeSweep(T)`，56.89 时 0.48）；两侧礼炮 55.75 喷出的 120 片彩纸在半空往下飘（`CONFETTI_N4C`），地上彩纸正在铺满（`throneConfettiFloor(T)`）；国王站在台阶 (1500,790) 把金印举过头顶（`sealRaise`，王冠 tilt 12 / slip 0.2 / squash 0.4）；勇者 (620,880) 欢呼，头顶名签换成全名、两头溢出（`spill 1`）；传令官吹号，书记官、卫兵、朝臣欢呼。

| id | 函数 / 空间 | 关键参数 |
|---|---|---|
| env | `drawThroneRoom` | `light 'sunny', windowL/R 'day', lectern, decree {hung:1, chars:13, sweep: decreeSweep}, confettiFloor: throneConfettiFloor` |
| courtiers | 群演 depth 0.9 | 同第 1 处位置，`pose 'cheer'` |
| guardL / scribe / herald / guardR | world | 卫兵 (1240,880) `cheer, hat:false`；书记官 (1150,880) `idle, happy`；传令官 (980,880) `face 1, blow`；卫兵 (1880,790) `cheer, hat:false`（在 TR-HIGH 下被前景虚化立柱挡住） |
| king | world | (1500,790) `face -1, sealRaise, joy, holding 'seal', crown {tilt 12, slip .2, squash .4}` |
| hero | world | (620,880) `cheer, laugh` |
| confetti | `drawSeamConfetti` world | `bursts: CONFETTI_N4C`（单独一层 `{shadow 3, texture .12}`，在 main 之后） |
| headTag | `nameTagSmall` follow | 锚在世界 (597,548)，`text NAMES.hero, size 40, spill 1` |
| fx | | `sat 1.05` |

**A（b05）怎么落**：56.00–56.80 glide 拉到 TR-HIGH；56.20–56.80 三行印章字飞回圣旨、圣旨吊成横幅（hung 0→1，56.80 到位）；56.30 名签翻成全名（56.80 前 spill 到 1）；56.60 起扫光 = `decreeSweep(T)`（**请 import 合同的函数**，不要各写一份时长）；彩纸 = `CONFETTI_N4C`（55.75 起画）。
**B（b06）怎么起**：彩纸继续画同一组 burst 直到消失（≈58.1），地上彩纸 `throneConfettiFloor` 57.4 铺满；扫光 57.20 走完；57.40 国王张嘴前机位保持 TR-HIGH。
**约定**：王座厅里卫兵一直不戴高帽（L13 起）；N4c 的“卫兵抛帽”改成双臂上举，接缝帧不出现帽子。
**验收**：A `--only b05 --times 56.8567` 对 `--sheet seams --times 2.9667`；B `--only b06 --times 56.89` 对 `--sheet seams --times 3`。

---

## 3. `b07|b08` · 90.00（V09 − 0.15）· 旅途长卷，藏在大橡树后

**条件**：`T ∈ [89.90, 90.10]` 内大橡树（`drawOccluder` 的 `oak`）在画面上，中线屏幕 x = `occluderX(T,'oak')`：89.90 → 1176、89.9667 → 854、**90.00 → 696**、90.0333 → 538、90.10 → 225；树干（中段宽约 440）在 **89.94–90.02** 完全挡住骑手（勇者屏幕 x≈758）。90.00 时 HUD 与小地图、大橡树左侧拖在地上的围巾都露在外面，所以它们必须两边逐像素一致。

**两边必须用的共享函数（逐层同一组）**：

| 层 | 画什么 | 图层参数 |
|---|---|---|
| sky | `drawJourney(g, T, c, {layer:'sky'})` | 直接画 |
| far | `drawJourney(…'far')` | `{shadow 4, texture .22, texOffset: journeyTexOffset(c, .25)}` |
| mid | `drawJourney(…'mid')` | `{shadow 7, texture .28, texOffset: journeyTexOffset(c, .8)}` |
| main | `drawJourney(…'main')` → `drawJourneyRider(g, {t:T})`（world）→ `drawJourney(…'front')` | `{shadow 10, texture .3, texOffset: journeyTexOffset(c, 1)}` |
| light | `drawJourney(…'light')` | 直接画 |
| fg | `drawJourney(…'fg')` | `{blur 4, shadow 12}` |
| occluder | `drawOccluder(g, T, c, 'all')` | `{blur 6}` |
| hud | `drawHUD(g, {...hudState(T), t:T})` + `drawMiniMap(g, T, hudState(T).mini)` | `{shadow 8}` |

- 机位 `c = journeyCam(T)`（已含漂移）；整帧后期 `journeyFx(T)`：89.85–89.95 在橡树后由 M 区（sat 1.1）过渡到 V 区（tint goldLight screen 0.10），89.95 起恒为 V 区值。
- **人马**：`journeyRiderParams(T)` 返回 `{ horse, hero }` = `heroJourneyState(T)` 的逐项映射；`drawJourneyRider` 先用 `horseRig` 求鞍位，再画马（`stirrupAt` = 勇者脚）→ 勇者（骑在 `saddle`、`rot = saddleRot`、`phase = 马的 phase`）→ 缰绳。90.00 时：马 (5841,860) `trot`、腿与鼻子绷带；勇者 `ride`、`grin`、创可贴 1、包 / 焦发 / 破袖 / 剑崩口、黑灰 0.12；围巾 `len 936, glow .6, notch, hole, vel [马速 ≈399, 0]`。
- HUD 90.00：LV 4、名字牌露 9 字（「达拉崩吧斑得贝迪卜」+ 省略号）、心 4、金币 ×12、背包 0；小地图 r ≈ 0.393（草原末端）。

**A（b07）怎么落**：经验条（expBig）89.85 前缩回；LV UP 徽章、创可贴飞走、金环等屏幕特效 89.85 前结束；M→V 的天色与远景交给 `drawJourney` 自己在橡树中线处切（不要另做过渡）。
**B（b08）怎么起**：不做任何入场；纸鸽、风车开转等从 V09（90.15）开始；马 90.15 起 trot→walk（`heroJourneyState` 已排好）。
**验收**：A `--only b07 --times 89.9667` 对 `--sheet seams --times 4.9667`；B `--only b08 --times 90` 对 `--sheet seams --times 5`。

---

## 4. `b10|b11` · 120.97（I2）· 龙洞 CV-LOW-END

**画面**：`CV_LOW_END = cam(1000,420,0.9,−5°)` + 漂移（仰拍、荷兰角）。两层名字墙完好（`drawNameWall`，dropAt 默认 = `NAME_TIMES('D3a'/'D3b')`），刻痕发熔岩光；墙后巨龙 `wall` 姿态吼到最大（`jaw 1`、13 块背板全亮、背刺 .5、脸红 .4、青筋 1），左上方吼声气泡「嗷——」（`bubble jagged`，display 140px，泡尾指向龙嘴）；笼中公主还在撬锁；勇者缩在左下（世界 x=150，墙左端外侧）抬臂挡脸，脸上黑灰 .6、呆毛烧成蜡烛芯（火已灭）；三根钟乳石刚从洞顶掉下来（`STALACTITES_D3`）。

**T 帧 = 撞墙冲击第一帧**（storyboard：“b11 的第一帧就是这面墙被撞碎的第一帧”）：
- `drawNameWall` 两边都传 `burst: cue('I2')`：T 之前完好，T 起同一函数画撞碎（T 帧是满墙裂开的金色断口 + 撞击火光）。
- 冲击后期 `IMPACT_I2`（写在 `fx = caveImpactFx(T)` 里）：flash 0.6（衰减 0.12s，默认闪光色）、shake `{amp 24, decay .3, freq 24, seed 9}`，两边同一参数。常驻后期：contrast 1.1、vignette 0.5（dragonDeep）。
- 所以本处的“几乎像素一致”= **A 块 T−1/30 对 `drawSeam(T−1/30)`（墙完好、无冲击），B 块 T 对 `drawSeam(T)`（冲击第一帧）**。

| id | 函数 / 空间 | 关键参数 |
|---|---|---|
| env | `drawCave` | `light 'lit', rubble {at: I2, cooled 0}`（rubble 在 I2+0.4 之前不画，b10 传了也无妨） |
| stalactites | `drawSeamStalactites` world depth 0.5（back 层） | `STALACTITES_D3`：x 760 / 1215 / 985，120.75 / 120.80 / 120.90 掉落，y = y0 + ½·2000·age² |
| cageBack / princess / cageFront | world | 鸟笼 (1320,330) `tally 12, lock {pins 0}`；公主笼底 `s .78, face -1, pickLock, tense` |
| dragon | `drawDragon` world | `pose 'wall', jaw 1, wings 1, eyes {angry, red .5}, spikes .5, redden .4, vein 1, plates 13×{lit 1}` |
| wall | `drawNameWall` world | `glow 1, burst: cue('I2')` |
| hero | `drawHero` world | (150, groundAt(150)) `shieldFace, hurt, ahoge 'candle', flame 0, soot .6, chip, injury {bandages 1, bump, singed, torn}, scarf {len 936, glow .6, notch, hole}` |
| roar | `bubble` follow | 锚 = `drawDragon` 返回的 `mouth`；泡心 = 龙嘴屏幕位置 + (−330, −230)，`w 520, h 250, shape 'jagged', text '嗷——', textSize 140, textFamily 'display', seed 7` |

图层：back `{shadow 6, texture .3}`（布景 + 钟乳石）→ mid `{shadow 8}` → main `{shadow 10, texture .3}`（布景 → 笼后片 → 公主 → 笼前片 → 巨龙 → 名字墙 → 勇者）→ fg `{blur 4}` → ui `{shadow 10, texture .25}`（气泡）。

**A（b10）怎么落**：117.70–120.90 CV-LOW → CV-LOW-END glide 结束后静止；最后一块石碑 120.71 落定；120.70 吼：气泡弹出（120.97 前 pop 到 1）、背板全亮；**b10 自己的砸落震动、推近 1.02、120.70 的闪白必须在 120.94 前衰减到 0**（合同在 T 之前不带任何震动 / 闪白）。
**B（b11）怎么起**：T 起名字墙用同一 `drawNameWall`（burst = I2）炸开，冲击 = `IMPACT_I2`；巨龙从 `wall` 向左冲出（`{from:'wall', to:'charge'}` 从 k=0 起），气泡随冲击炸碎；120.97–121.25 机位甩正到 `cam(1000,560,1.1)`；钟乳石继续按同一公式下落直到落进墙后。
**验收**：A `--only b10 --times 120.9367` 对 `--sheet seams --times 6.9667`；B `--only b11 --times 120.97` 对 `--sheet seams --times 7`。

---

## 5. `b12|b13` · 150.52（B08）· 纸剧场 TT-W

**画面**：TT-W + 漂移（`withDrift(theaterCam(T), T, DRIFT)`）。台口刚从咬合弹开（`bite` 余振 ≈ 0.004），紫色舞台灯；龙偶回到原位（`puppet` 姿态，头 (1350,520)），嘴合在勇者身上（`jaw .3`、腮帮微鼓）；勇者偶只剩两条乱蹬的腿从龙嘴角斜伸出来（`puppetInMouth`，木杆跟着晃）；右上吊杆的笼中迷你公主吓一跳；顶部两块名字牌：勇者牌窗口空、HP 60（白色滞后条 ≈ 0.607），巨龙牌静止显示「苏瓦西拉松」、HP 70；回合横幅「敌方回合」；左下指令菜单变灰挂锁。

**唯一时序源**：一切台口 / 灯 / 名字牌 / 菜单 / HP / 横幅都只从 `theaterState(T)` 取（150.52：`heroPlate.state 'cracked', progress 0, crack 0`；`dragonPlate.state 'idle', progress 1`；`hp.hero .6`；`light 'purple'`；`menu.gray 1`）。

| id | 函数 / 空间 | 关键参数 |
|---|---|---|
| env | `drawTheater` | `{ ...theaterState(T), cave: st.caveOpts, cam: c }`，三次：`part 'back' / 'frame' / 'frameFront'` |
| cageBack / princess / cageFront | world（木偶层，裁进 `theaterClip`） | 迷你笼 (1480,330) `mini, lock {pins 1}`；公主 (1480,392) `s .5, face -1, puppetCage, shock, sign 0` |
| dragon | world | `pose 'puppet', jaw .3, eyes {angry}, puff .15` |
| hero | world | `x = dragon.mouth.x − 4, y = dragon.mouth.y + 52, face 1, puppetInMouth, rod true, rot −0.85, scarf {len 936, glow .6, notch, hole}`（**锚点取龙偶的返回值 `mouth`**，所以先画龙后画勇者） |
| heroPlate | `marqueePlate` world | `side 'hero', state / progress / crack / peeled / drop = st.heroPlate, hp = st.hp.hero, hpLag = st.hp.heroLag, hpText 'HP 60', mode 'pass'` |
| dragonPlate | `marqueePlate` world | `side 'dragon', state / progress / drop / shrink = st.dragonPlate, hp / hpLag = st.hp.dragon*` |
| banner | `turnBanner` world | `text = st.banner.text, textFrom = st.banner.prev, flip = flip < 1 ? flip : 0, drop` |
| menu | `battleMenu` world | `pop = st.menu.show, cursor (attack→0), locked = st.menu.gray, lockPop, blink = st.menu.flash, press` |

图层：back `{shadow 6, texture .3}` → puppets `{shadow 10, texture .3}`，`clip = theaterClip({cam, scale})`（笼后片 → 公主 → 笼前片 → 龙偶 → 勇者偶）→ frame `{shadow 8, texture .25}` → ui `{shadow 10, texture .2}`（frameFront → 勇者牌 → 巨龙牌 → 横幅 → 菜单）。

**勇者名字牌必须显式 `mode:'pass'`**（第 9 节问题 1）：`theaterState` 在 150.52 把勇者牌从 `idle, p=1` 切成 `cracked, p=0`，而 `marqueePlate` 默认 mode 随 state 变（idle→fit 显示「卜多比鲁翁」，cracked→pass 窗口空），不显式指定就会在接缝上跳。合同规定两边都传 `mode:'pass'`；**b12 最晚在咬合闭死（149.48，画面只剩黑缝）时切到 pass**——名字被“吃掉”，窗口空着进入接缝。

**A（b12）怎么落**：149.33 咬合，149.80–150.30 弹开；咬合黑缝里把龙偶摆回原位、勇者塞进嘴里；150.30 后只有腿乱蹬、台口余振（`theaterState.bite`）。
**B（b13）怎么起**：150.52 重音——龙偶“噗”：jaw .3→.7（0.1s），勇者偶从 `mouth` 锚点向左上倒飞（`puppetInMouth → puppetKneel`），150.90 落在 x=520 单膝跪地；150.60 名字牌裂开（`st.heroPlate.crack`）。
**验收**：A `--only b12 --times 150.4867` 对 `--sheet seams --times 8.9667`；B `--only b13 --times 150.52` 对 `--sheet seams --times 9`。

---

## 6. `b15|b16` · 185.47（O01）· 王城婚礼 cam(960,540,0.9)

**画面**：`cam(960,540,0.9)` + 漂移，礼物城堡全景（`drawCastle` 婚礼装 `time 'wedding', deco 1`，13 面城名旗全升 `flags {chars: NAMES.city, at: NAME_TIMES('E04')}`）。
- **勇者横幅**（天蓝底、金边、深蓝字，60px）：起点在画左 (120,330)，短引线后 13 个字「达拉崩吧斑得贝迪卜多比鲁翁」沿一道上升的弧从左往右横过左半边天空（在旗子上方、彩旗串下方），到尖塔左侧 (900,214) 接 `ribbonWrap {p 1, color skyDayLow}` 绕尖塔一圈（后半圈在尖塔后、前半圈在前）。画法 `drawHeroBanner(g, {t, grow, retract})`（路径 `HERO_BANNER_PATH`，样式 `HERO_BANNER_STYLE`）。
- **公主竖幅**（`PRINCESS_BANNER_STYLE`：princessLight 底、gold 边、red 字，54px）：从阳台栏杆 (985,566) 竖直垂下 6 字「米娅莫拉苏娜」，在城门前拐弯向右横排 5 字「丹妮谢莉红」（字心在屏幕 y≈890，**不进字幕带**），末端被纸鸽提起、从城堡后面（屋顶、城墙、塔群之后）升到尖塔右侧。画两次：`range [0, PRINCESS_FRONT]`（≈0.383，带字，城堡前）+ `range [PRINCESS_FRONT − 0.002, 1]`（尾段，画在 mid 层之后、main 之前）。
- **蝴蝶结**：结心 `BOW_AT (961,228)`（绕塔横幅正前方），`BOW_STYLE`：s .55、左环勇者色 skyDayLow、右环公主色 princessLight。两只纸鸽在结的右上方扑翼。
- **阳台三人**（s .26，`BALCONY_X`：勇者 935 / 公主 985 / 国王 1035，地板 y=590）：勇者 `cheer`（围巾补丁）+ 肩上小蜥蜴；公主 `bride`、头纱、小皇冠；国王 `clap`、节日长袍、头上绷带、王冠 tilt 12（`KING_CROWN_TILT`）。
- **城下人群**（near 层 depth 1.1，s .30）欢呼，有两人站在横排竖幅前。
- **烟花**：`FIREWORKS_E12`（184.80–185.40 五朵，心形 / 星形，都在天上空处，不压旗与横幅）；**彩纸如雨**：`CONFETTI_E12`（三阵，188.4 前全部消失）。

图层：sky → far → mid（+ 公主竖幅尾段）→ main（布景，阳台三人走 `onBalcony`）→ near → ribbons `{shadow 8, texture .25}`（公主竖幅前段 → 人群 → 勇者横幅 → 蝴蝶结 → 纸鸽）→ fg（`LAYER_FX.fg`，blur 3）→ sparkle（直接画：烟花、彩纸）。前六层参数 = castle `LAYER_FX`。fx：`sat 1.1`。

**A（b15）怎么落**：183.20–185.30 glide 拉远到 cam(960,540,0.9)；横幅展开阶段按阅读顺序露字（纸鸽从左往右拉）；184.40 绕塔、184.70 蝴蝶结弹出（`pop` 0→1）；184.80 起烟花 / 彩纸 = 合同的同一组。
**B（b16）怎么起**：185.47「唰！」两条横幅沿原路弹回（`drawHeroBanner` 与两次 `drawBanner` 都传同一个 `retract` 0→1、`retractT = T − 185.47`），绕塔一圈与蝴蝶结同时松开消失；烟花 / 彩纸继续画到自然结束（≤187.1 / ≤188.4）；185.60–186.30 推回 CA-BAL。
**验收**：A `--only b15 --times 185.4367` 对 `--sheet seams --times 10.9667`；B `--only b16 --times 185.47` 对 `--sheet seams --times 11`。

---

## 7. `b16|b17` · 197.77（O07）· 王座厅夜景 TR-NIGHT

**画面**：TR-NIGHT `cam(900,560,1.3)` + 漂移（O04 的锁机位已在 193.60 解除）。夜光（`light 'night'`），左尖拱窗冬景（`windowL 'winter'`），右尖拱窗满月（`windowR 'moon', moonPhase 0`，屏幕 (1220,250) r70），柱上烛火，x=780 柱上留着 O04 的三道身高刻度（`ruler`）。正中上方挂着收拢成 3 格的取名面板：「王浩然」三块字母牌、空格已折起、外框收拢（`contract 1`）、meadow + gold 光（`glowOk .55`）、计数「3/3」，右下角一枚红色对勾章。面板下方：勇者 (715) 系完围巾长出一口气、孩子王浩然（少年 200，x 885，短红围巾，笑眯眼）、公主 (1092)、小蜥蜴趴平 (985)；书记官 (1290) 瘪着，纸卷塔倒了一地；国王瘫在王座上（画右边缘），王冠端正。

| id | 函数 / 空间 | 关键参数 |
|---|---|---|
| env | `drawThroneRoom` | `light 'night', windowL 'winter', windowR 'moon', moonPhase 0, candles, ruler [{h 110, at O04}, {h 160, at 192.30}, {h 200, at 192.95}]` |
| scribe | world | (1290,880) `deflate, tower 1` |
| king | world | 坐姿锚点 = 座面 (1580,660)，`slump, relieved, crown {tilt 0, slip 0}` |
| princess | world | (1092,880) `face -1, deflate, relieved` |
| child | world | (885,880) `stage 'older', stand, laugh, shortScarf` |
| lizard | world | (985,880) `flat` |
| hero | world | (715,880) `deflate, relieved, scarf {len 936, glow .6, notch, hole, patch}` |
| panel | `drawSeamPanel` parallax（base TR-NIGHT，depth 1.1） | `panel {rect PANEL_O06 = (400,250,1040,370), tiles '王浩然', counter '3/3', foldEmpty 1, contract 1, glowOk .55}`，`stamp {kind 'check', x 1030, y 540, r 60, rot −.12, p 1}` |

图层：back / mid / main（人物）/ glow / fg 用 `throneLayer(层, 'night')`（夜景纸纹 0.1、投影更实）→ panel `{shadow 12, texture .25}`。

**面板空间**：`applyParallax(g, cam, CAMS.TR_NIGHT, 1.1)` 之后按 TR-NIGHT 的屏幕坐标画——机位就是 TR-NIGHT 时它正好在屏幕 `PANEL_O06`（收拢后 3 格中心 x=920，不挡右窗月亮）；漂移或 b17 推镜时它按 depth 1.1 视差跟着走。

**A（b16）怎么落**：193.60–193.90 回到 TR-NIGHT；196.30 空格折起、196.40 外框收拢（建议同时把计数翻成「3/3」，`counterPop` 一下）、196.60 对勾章、196.80 全家瘪下、197.00 王冠回正、197.10 系短围巾；197.77 前全部静止，只剩呼吸 / 眨眼 / 烛火。摇篮在 O04 孩子长大时像立体书机关一样折倒收走（接缝帧不画）。
**B（b17）怎么起**：197.77 重音——`namePanel` 的 `tagBelow`（「全名」小签）从此刻开始出现（接缝帧不画），197.95 孩子 `yank`；198.05 起机位上摇推向玫瑰窗，面板随视差出画。
**验收**：A `--only b16 --times 197.7367` 对 `--sheet seams --times 12.9667`；B `--only b17 --times 197.77` 对 `--sheet seams --times 13`。

---

## 8. 参考画面

`node tools/render.mjs stills --sheet seams --times 1,3,5,7,9,11,13 --outdir out/review/seams`（每段中点 = 接缝时刻 T）：

| # | 文件 | 备注 |
|---|---|---|
| 1 | `out/review/seams/t1.00.png` | 41.90 |
| 2 | `out/review/seams/t3.00.png` | 56.89 |
| 3 | `out/review/seams/t5.00.png` | 90.00（另附 89.90 人马未被挡的一帧 `t4.90.png`） |
| 4 | `out/review/seams/t7.00.png` | 120.97 = 撞墙第一帧（另附 120.937 = 接缝前完好状态 `t6.97.png`） |
| 5 | `out/review/seams/t9.00.png` | 150.52 |
| 6 | `out/review/seams/t11.00.png` | 185.47 |
| 7 | `out/review/seams/t13.00.png` | 197.77 |

---

## 9. 基础模块问题

| # | 文件 / 函数 | 现象 | 建议 | 合同里的绕法 |
|---|---|---|---|---|
| 1 | `src/env/theater.js` `theaterState` + `src/ui/kit.js` `marqueePlate` | 150.52（b12\|b13 接缝）`heroPlate` 从 `idle, progress 1` 切到 `cracked, progress 0`；`marqueePlate` 的默认 mode 跟着 state 变（idle→fit、其余→pass），于是窗口内容在接缝上从「卜多比鲁翁」跳成空。 | `theaterState` 把 B03–B08 的勇者牌改成 `progress 1 + mode 'pass'`（窗口空），或把 state 切到 cracked 的时刻与 `crack` 一起放到 150.60；或 `marqueePlate` 的默认 mode 不随 state 变。 | 合同规定两边都显式传 `mode:'pass'`，b12 在咬合闭死（149.48）时切换。 |
| 2 | `docs/api/cave_theater.md` 5.1 / 5.4 示例 | `addv(CAMS.CV_W, drift(T, …))`：`cam()` 是对象，`addv` 只处理 `[x,y]` 数组，结果是 `[NaN, NaN]`，照抄会得到错误机位。 | 改成 `withDrift(c, T, d)` 的写法：`cam(c.x + dx / c.zoom, c.y + dy / c.zoom, c.zoom, c.rot)`。 | 合同导出 `withDrift` / `DRIFT`，七处都用它。 |
| 3 | `src/ui/kit.js` `drawHUD` | LV 数字弹跳（`lvPopAt` / `levelUpAt`）把「LV 4」以左端为基准放大到 1.4 倍，数字右半压到 EXP 细条上（90.00 时「4」被盖住一半）。 | 放大时以文字中心为锚并限制宽度，或 EXP 细条右移 20px。 | 不影响接缝（两边同一函数），只记录。 |
| 4 | storyboard b10 D3 / `src/env/cave.js` `CAMS.CV_LOW_END` | D3 缓推终点 zoom 0.9 后，名字墙第一排字（「昆图库塔卡提考特」）落在屏幕 y≈850–960，进了字幕带（117.66–120.97 是有人声段）。 | `CV_LOW_END` 改 `cam(1000,470,0.9,−5°)`（地面上移约 45px），或缓推终点用 0.86。 | 合同按 storyboard 用 `CV_LOW_END`，未改（b10 / b11 已在用这个常量）。 |
| 5 | `src/props/misc.js` `drawBanner` | 字一律从路径起点 + 0.42·带宽开始排，没有“从第几像素开始写字”的参数；用全角空格垫前也不可靠（站酷庆科黄油体的 U+3000 只有约 0.2em 宽）。 | 加 `textStart`（弧长偏移）参数。 | 勇者横幅按裁定改成“短引线 + 字段”一条路径，不需要垫字。 |
| 6 | `src/scenes/b13_namesword.js`（集成时发现，非基础模块） | 2026-10-01 15:00 前后加载时报 `[block load failed] Illegal return statement`，整块空着。 | 作者修语法。 | — |

---

## 10. 变更记录

| 时间 | 接缝 | 改动 |
|---|---|---|
| 2026-10-01 14:00 | 全部 | 第一版合同（七处）与模型图。 |
| 2026-10-01 14:50 | `b05\|b06` | `decreeSweep` 时长 0.7s → 0.6s（与 b05 已写的一致，56.60 起、57.20 扫完），T 前返回 −1。 |
| 2026-10-01 15:00 | `b15\|b16` | **集成负责人裁定 ①**：公主竖幅 / 尾段改 `base PAL.princessLight`、`ink PAL.red`（gold 边不变）→ `PRINCESS_BANNER_STYLE`；蝴蝶结右环改 `PAL.princessLight`（左环仍勇者色 skyDayLow）→ `BOW_STYLE`。 |
| 2026-10-01 15:00 | `b15\|b16` | **裁定 ②**：勇者横幅改成一条路径——起点在画左 (120,330)、短引线（字前约 38 世界单位）→ 13 字从左往右 → 到尖塔左侧绕塔一圈 → 蝴蝶结；去掉先向左绕城一圈的无字长引线。`drawHeroBanner` 现在就是 `drawBanner(g, HERO_BANNER_PATH, { ...HERO_BANNER_STYLE, grow, retract, retractT, t })`；`HERO_BANNER_LEAD / NAME` 保留为同一路径切开的两段（兼容旧 import）。 |
| 2026-10-01 15:00 | `b15\|b16`、`b16\|b17` | **裁定 ③**：国王王冠尾声角度统一 12°（`KING_CROWN_TILT`）：E09 之后一直 12，O06（195.68）起自己回正，197.77 时为 0。 |
| 2026-10-01 15:00 | `b15\|b16` | **裁定 ④**：阳台三人站位改为 `BALCONY_X` = 勇者 935 / 公主 985 / 国王 1035（避开左侧花箱 x 860–922）；公主竖幅起点随之移到 (985,566)，小蜥蜴在勇者肩上 (928,554)。 |
| 2026-10-01 15:05 | `b15\|b16` | 公主竖幅横排段抬到世界 y≈932（字心屏幕 y≈890）：原来字心在屏幕 y≈927，进了有人声段的字幕带。 |
