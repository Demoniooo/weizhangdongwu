# 基础资产规格（assets）

> 基础阶段据此实现，场景作者据此调用。镜头内容以 `docs/storyboard.md` 为准；引擎 API 见 `docs/engine.md`。
> 本文列出每个模块的文件、导出函数签名、参数表、坐标约定、需要的姿态/变体，以及验收标准（模型图）。

---

## 0. 通用约定

### 0.1 纯函数与确定性
- 所有导出函数只读参数，不存跨帧状态；随机一律 `hash1/hash2/mulberry32(固定种子)`，噪声用 `noise1/fbm1`；次级运动（呼吸、眨眼、旗子、毛发）由参数 `t`（秒）驱动。
- 只用 `PAL` 里的颜色，深浅用 `mixHex/rgba`。
- 函数内部 `save/restore`，不改调用方的变换、合成模式与 alpha。
- **不在函数里调 `ctx.layer/ctx.mask`**（图层由镜头决定）；需要分层的模块按 `layer` 参数分次画，由镜头包进各自的图层。
- 名字字形与界面字走 `src/ui/type.js`；符号走 `src/ui/kit.js` 的 `glyphIcon`（四套字体都没有 ★ ♥ ♪ ✓ ✕ ✦ ▼ ▶ ①–④ 与箭头）。
- 注意命名冲突：`core/ease.js` 导出的 `smooth` 是缓动曲线，`core/paper.js` 的 `smooth` 是路径函数；两边都要用时写 `import { smooth as smoothPath } from '../core/paper.js'`。

### 0.2 角色木偶统一签名

```js
drawHero(g, o)   // 其余角色同形：drawKing / drawPrincess / drawHorse / drawDragon / drawCitizen …
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `x, y` | number | **脚底中心**的当前坐标（调用方已 `applyCam`，即世界坐标） |
| `s` | number | 缩放；1 = 全景标准高度（勇者 260）。外景 CASTLE 用 0.26 / 0.30 |
| `face` | 1 / −1 | 1 朝右，−1 朝左（整体 scaleX 镜像；文字类附件不镜像） |
| `t` | number | 秒，驱动呼吸、眨眼、头发与衣摆余振；传 `T` 即可 |
| `pose` | string | 动作名（各角色枚举见下）；可传 `{from, to, k}` 在两个动作之间插值（关节角线性插值） |
| `expr` | string | 表情名 |
| `alpha` | number | 默认 1 |
| `silhouette` | bool | 剪影模式：全部填 ink，只留 `keepColor` 指定部件（I2 剪影段只留围巾） |
| `rod` | bool | 纸剧场木偶：从脚下画一根伸到画面下方的木杆，关节只允许整体平移/倾斜 + 少数平面姿势 |
| `squash` | number | 挤压拉伸量（>0 拉长，<0 压扁），保持面积，以脚底为锚 |

**返回值**：一个锚点对象（同一坐标系），供镜头挂特效或接道具，例如 `{ head:[x,y], mouth:[x,y], handR:[x,y], handL:[x,y], neck:[x,y] }`。

**关节木偶**：每个部件是剪纸片（`cut` + 切口亮边 + 纸纹由图层给），绕枢轴旋转；动作 = 关节角预设表 + 缓动插值。拖尾类（围巾、麻花辫、鬃毛、龙尾、旗）用 `trail` 参数：调用方传入锚点在过去时刻的偏移数组（时间回溯采样：第 k 点 = 锚点在 `T − k·0.035` 的位置减去当前锚点），未传时按 `vel`（px/s）与 `wind` 生成默认拖尾 + 噪声飘动。

### 0.3 比例（s = 1）

勇者 260（头约 104）｜国王 220 + 王冠 45｜公主 250｜白马 长 300 × 高 230｜巨龙 头宽 360、身体弧长约 1650｜小蜥蜴 长 60｜市民 150–190｜卫兵 200（含高帽）｜书记官 180｜传令官 185｜孩子 70 / 110 / 160 / 200｜史莱姆 宽 80｜蝙蝠 翼展 90。

### 0.4 模型图与验收

- 每个模块配一张模型图：`src/sheets/<模块名>.js`（导出镜头数组，同正式镜头约定），用
  `node tools/render.mjs stills --sheet <名> --times 0.5,1.5 --outdir out/review/sheets/<名>` 出图，用 Read 打开亲眼检查。
- 模型图背景铺 `PAL.paper`，网格标注 s=1 的 260px 身高线、脚底线。
- 通用验收：纸边稳定不闪（逐帧对比 0.5 与 0.533 两帧只有次级运动在变）；投影方向一律右下；不出现 PAL 以外的颜色；`./tools/lint.sh` 通过；图层 ≤ 8。

---

## 1. src/rigs/hero.js —— 勇者 达拉崩吧

**导出**：`drawHero(g, o)`；常量 `HERO_POSES`、`HERO_EXPRS`。

**造型**：圆脸、腮红、豆豆眼带高光；栗色乱发 + 一根会弹的呆毛；蓝色短袍（heroBlue / heroBlueDark）、棕腰带金扣、棕靴（boot）；背上带鞘的剑（steel 刃、gold 护手、红宝石剑首）；超长红围巾（scarf / scarfDark）。

**特有参数**

| 参数 | 默认 | 说明 |
|---|---|---|
| `scarf` | `{}` | `{ len:780, width:22, glow:0, notch:false, hole:false, patch:false, frozen:0, wrapFace:0, trail, vel:[0,0], wind:[0,0] }`。len 为 s=1 时总长；glow 0..1 金边（V03 后 0.6）；notch / hole 为 V07 起的 V 形缺口与中段破洞；patch 为 E09 起盖在破洞上的粉色补丁；frozen 0..1 冻成硬板挂冰凌；wrapFace 0..1 在脸上缠一圈（L07） |
| `ahoge` | `'normal'` | 呆毛形状：`normal / question / straight / heart / candle`；`flame` 0..1（candle 时头顶小火苗）；`curl` 0..1 |
| `sword` | `'back'` | `back / shoulder / hand / none`；`swordAngle` 弧度；`swordGlint` 0..1（剑光四角星沿刃口跑到剑尖的进度）；`chip` 崩口 |
| `injury` | `{}` | `{ bandages:0..4, bump:false, singed:false, torn:false }`（V07 起 4，V08 每升一级减 1） |
| `soot` | 0 | 0..1 满脸黑灰（D2b–R1） |
| `inflate` | 0 | 0..1 吸气鼓胸鼓腮（L16 最大 1，对应身体 1.25 倍） |
| `earScale` | 1 | 拢耳时那只耳朵的放大（Q1 到 1.3） |
| `nameTag` | null | 胸前名签文字（O01 起「达拉崩吧」），走 `type.paperGlyph` |
| `blush` | 0 | 脸红强度（E02） |

**动作枚举 `pose`**（括号内为用到的块）

| 类别 | 名称 |
|---|---|
| 站与走 | `idle`（全片）、`walk`（b08、b13）、`run`（b03）、`kneeSlide`（b03 跪滑）、`brake`（急停挤压） |
| 表演 | `heroPose`（叉腰扛剑，b07）、`scratchHead`（b04）、`think`（指抵下巴，b04）、`inhale`（b04，配 `inflate`）、`shout`（b03）、`proud`（b05）、`thumbsUp`（双拇指，b05）、`cupEar`（拢耳探身，b10，与国王 `cupEar` 镜像）、`fingerUp`（b10 Q2）、`present`（魔术师张臂，b10）、`bow`（鞠躬，b10）、`shieldFace`（抬臂挡脸，b10 D3）、`sigh`、`gulp`、`turnHead`（慢慢转头，b09）、`freeze` |
| 骑乘 | `ride`（马上随步态起伏，调用方传马的 `saddle` 锚点）、`rideSlash`（b07 马上三连斩）、`rideLean`（俯身用剑尖挑箱，b08）、`rideHunch`（顶风，b08）、`sneeze`（b08）、`mount`（跃上马鞍弧线中段）、`dismount`、`rideFront`（E03 前座） |
| 战斗 | `gripHilt`（反手握剑，b09）、`draw`（拔剑弧线，b09）、`stance`（剑尖指右）、`roll`（b11）、`plantSword`（竖剑劈火，b11）、`vault`（撑下颌翻越）、`hop`（踩名字跳台）、`thrust`、`slash`、`hangSwing`（挂在围巾上荡，b11）、`kick`、`charge` |
| 剧场纸偶（`rod:true`） | `puppetStand`、`puppetLunge`、`puppetSlash`、`puppetInMouth`（只画两条乱蹬的腿）、`puppetKneel`、`puppetRise`、`puppetHoldSword`（横握名字之剑剑柄） |
| 尾声 | `swingMiss`（E01 砍空踉跄）、`holdHands`（b15）、`dance`（b16，配 `turn` 0..1 做 scaleX 翻面）、`leanOver`（俯身看摇篮）、`unrollScroll`（O05）、`tieScarf`（O06）、`deflate`（长出一口气）、`cheer` |

**表情枚举 `expr`**：`normal`、`grin`、`smug`、`determined`、`shout`（大嘴闭眼）、`shock`、`think`（眼珠右上翻）、`squint`（一只眼眯）、`wink`、`hurt`、`dizzy`（蚊香眼）、`worried`（冒汗）、`laugh`、`shy`、`relieved`。叠加件：`sweat` 0..1、`toothSparkle` 时刻。

**返回锚点**：`head, mouth, eye, neck（围巾根）, handR, handL, swordTip, hilt, scarfEnd`。

**验收（模型图 `src/sheets/hero.js`）**：① s=1 正侧面 idle、run、shout、cupEar、thumbsUp、present 各一，face=±1 各一排；② 骑乘四式与马合拍；③ 围巾五态：常态、glow、notch+hole、patch、frozen；④ 呆毛五形；⑤ 伤痕 0/4、soot=1、inflate=1；⑥ 剪影模式（只留围巾有色）；⑦ 纸偶 `rod` 七式；⑧ CU 机位（zoom 3.4）下头部 360px 时纸边与描边不糊、不抖。

---

## 2. src/rigs/king.js —— 国王

**导出**：`drawKing(g, o)`、`drawKingCrown(g, o)`（王冠单独飞时用）；常量 `KING_POSES`、`KING_EXPRS`。

**造型**：矮圆身材；过大的金王冠（gold / goldDark，宝石 red）；大白胡子（beard）；红袍（robe / robeDark）+ 白底黑点貂皮领（ermine + ink 点）；星星权杖（star 用路径画）。

**特有参数**

| 参数 | 默认 | 说明 |
|---|---|---|
| `crown` | `{}` | `{ tilt:0（度）, slip:0（0..1，1 = 盖住眼睛）, pop:0（向上弹起 px）, squash:0（被线勒扁 0..1）, spin:0, off:false（不画，交给 drawKingCrown） }`。全片情绪刻度见 storyboard 第 7 节 |
| `holding` | null | `tiara / seal / scepter / scroll / handkerchief / null` |
| `bandage` | false | 头上一圈绷带（E09 起） |
| `festive` | false | 节日长袍（金边更宽） |
| `cheeks` | 0 | 鼓腮 0..1（N3 吹气球） |
| `beardFlip` | 0 | 胡子被吹起盖住脸 0..1（L08） |
| `green` | 0 | 脸发青 0..1（N3） |
| `earScale` | 1 | 拢耳那只耳朵的放大（K1 到 1.3） |
| `legsUp` | 0 | 晕倒时两腿翘起 0..1 |
| `wrapped` | 0 | 被纸卷裹住 0..1（E08） |

**动作枚举**：`idle`、`sit`、`hop`（喜悦连蹦）、`pace`（慌跑）、`holdHead`（抱头）、`stoop`（捡东西）、`clutch`（把小皇冠攥在胸口）、`lookFar`、`leanForward`（探身）、`cupEar`（K1、E05）、`fingerUp`（K2）、`puff`（吹气球）、`dangle`（被气球吊起，两腿悬空）、`sealRaise`、`sealSlam`、`crouch`、`faint`（向后仰倒、两腿朝天）、`raiseScepter`、`placeTiara`、`giveHand`、`clap`、`wipeTears`、`biteNails`、`slump`（瘫进椅子）、`wave`（挥手帕）、`bow`、`peek`（只露王冠和眼睛，用于 b03 画面下沿偷看）、`gasp`、`leap`（b03 蹦进画面）。

**表情枚举**：`joy`、`panic`、`squint`、`confident`、`puffed`、`sick`（发青）、`dizzy`、`faint`（叉叉眼）、`proud`、`tearful`、`waterfall`（两道小瀑布泪）、`starEyes`、`relieved`、`gasp`、`smile`。

**返回锚点**：`head, mouth, crownTop（王冠尖，K1 卡「翁」用）, handR, handL, ear`。

**验收**：① 王冠五态（端正、tilt 15°、slip 1 盖眼、squash 1 被勒扁、pop 弹起）；② `puff` + `cheeks=1` 与气球线汇聚点在嘴；③ `dangle`、`faint + legsUp`、`wrapped`；④ CU-K（zoom 3.3）下胡子与貂皮点清楚；⑤ `peek` 只露王冠和眼睛的裁切版；⑥ s=0.26 外景版（阳台上）可读。

---

## 3. src/rigs/princess.js —— 公主 米娅

**导出**：`drawPrincess(g, o)`；常量 `PRINCESS_POSES`、`PRINCESS_EXPRS`。

**造型**：金色大麻花辫（hairGold / hairGoldDark，拖尾链）、粉色多层长裙（princess / princessDark / princessLight）、小皇冠（gold）；不是花瓶——被关时在撬锁、翻白眼。

**特有参数**：`tiara`（true / false，L04 被磕飞后为 false，E09 戴回）、`veil`（婚礼头纱）、`braid`（`{trail, vel, wind}`）、`hairpin`（手里的发卡）、`sign`（举着「加油！」小牌，0..1 举起程度）、`nameTag`（O01 起「米娅」）、`blush`。

**动作枚举**：`idle`、`water`（浇花，手持水壶）、`wave`、`lookUp`、`caged`（抱臂）、`pickLock`（发卡撬锁）、`pointBehind`（指向勇者身后）、`cheerSign`（举牌敲笼）、`stepOut`（转着发卡走出笼门）、`twirl`、`ridePillion`（E03 后座搂着勇者）、`bride`、`holdHands`、`coverFace`（害羞捂脸）、`dance`（配 `turn`）、`leanOver`、`nudgeAway`（用脚推开卷轴）、`shakeHead`、`deflate`、`puppetCage`（剧场里的笼中迷你偶）。

**表情枚举**：`smile`、`eyeroll`、`shock`、`focused`（咬舌尖）、`smug`、`laugh`、`shy`、`loving`、`tense`、`relieved`。

**验收**：① 麻花辫在 vel=0 / 向左奔跑 / 跳舞旋转三种下的拖尾；② `caged + eyeroll`、`pickLock + focused`；③ `bride + veil + tiara`；④ s=0.26 阳台版；⑤ `nameTag:'米娅'` 字 ≥ 48px（CA-BAL 机位下）。

---

## 4. src/rigs/horse.js —— 最快的白马

**导出**：`drawHorse(g, o)`；常量 `HORSE_POSES`。

**造型**：白马（horse / horseShade）、金色鬃毛与尾（mane，拖尾）、金辔头、鞍（leather）。

**特有参数**：`phase`（步态相位，**= 世界 x ÷ 步幅**，步幅 s=1 时 280，保证不打滑；未传则用 t）、`gait`（`gallop / trot / walk`）、`mane`（`{trail, vel, wind}`）、`bandageLeg`、`noseBandage`、`icicles` 0..1、`dust`（返回扬尘发射点）。

**动作枚举**：`gallop`、`trot`、`walk`、`limp`（一瘸一拐，V07）、`skid`（急停扬尘）、`rear`（人立）、`tossMane`（骄傲甩头）、`pawGround`、`headwind`（顶风低头）、`biteCoin`（叼住金币验真）、`hideRock`（躲在岩石后只露耳朵和尾巴，岩石由 env 画）、`leap`（E03 从岩石后跃出）、`stand`、`speedLines`（附带速度线）。

**返回锚点**：`saddle`（骑手脚底锚点）、`saddleBack`（后座）、`head`、`mouth`、`hoofFront`、`tail`。骑手由镜头另外调用 `drawHero(...pose:'ride')` 画在 `saddle` 上，人马同时挤压时用同一个 `squash`。

**验收**：① gallop 一个周期 8 帧连贴，蹄子落点与地面线一致（phase = x / 步幅）；② rear、tossMane、skid、hideRock；③ 与勇者合拍：`mount` 中段、`ride`、`rideSlash`、`rideFront + ridePillion` 双人；④ face=−1 归程版。

---

## 5. src/rigs/dragon.js —— 巨龙 昆图库塔卡提考特苏瓦西拉松 / 小蜥蜴

**导出**：`drawDragon(g, o)`、`dragonSpine(pose, t)`、`DRAGON_POSES`、`drawLizard(g, o)`。

**造型**：紫色长蛇形西方龙（dragon / dragonDark / dragonDeep），大头、两只弯角、黄眼竖瞳（dragonEye）、青绿腹甲（dragonBelly）、小蝙蝠翼（dragonWing）、黑桃形尾尖；**身体 13 节**，每节背上一块背板（名字的一个字）。

**身体模型**：脊线是一条样条，每帧按弧长采样 64 点；13 节沿弧长等距；身体用 `ribbon` 画腹甲与背两层。任何姿态都是 64 点数组，姿态切换 = 逐点插值（不做拓扑变化）。

**参数**

| 参数 | 说明 |
|---|---|
| `pose` | 样条预设名或 `{from,to,k}`：`fly`（波浪飞行，L02–L04）、`shadow`（只画剪影，L02 龙影）、`coil`（盘在金币堆上，V14）、`rise`（昂首，头 (1150,470)）、`name`（D1：头在左 (960,440) 朝左，S 形身体到尾尖 (2450,820)）、`breathe`（D2 喷火）、`puffer`（R1）、`wall`（D3 直立，头 (1180,250)）、`lunge`、`coilPillar`（I2 第二拍盘柱，返回每节在柱前 / 柱后）、`clash`、`charge`、`standoff`（= `STANDOFF` 构图）、`puppet`（剧场：剪纸头 + 身体在双签上）、`shrink`（B12，配 `popped`） |
| `spine` | 直接传 64 点数组（覆盖 pose） |
| `plates` | 长度 13 的数组：`{ lit:0..1, pop:0..1, char }`；字由 `type.glyph13` 画，旋转夹在 ±15°、永远正立 |
| `spikes` | 0..1 背刺竖起（R1 河豚炸刺） |
| `puff` | 0..1 整体鼓到 1.2 倍 |
| `redden` | 0..1 脸红（龙层叠 fireDeep） |
| `jaw` | 0..1 张嘴（下颚铰链 0→60°） |
| `eyes` | `{ open:0..1, pupil:0..1（竖瞳宽）, look:[dx,dy], state:'normal'/'angry'/'dizzy'/'closed'/'x' }` |
| `wings` | 0..1 张开 |
| `tailFlick` | 甩尾时刻（秒） |
| `popped` | 0..13 已弹飞的节数（B12，剩余节数决定整体缩放 1→0.15） |
| `silhouette` | 剪影（I2 第三拍） |
| `chestSwell` | 0..1 吸气鼓胸（V16） |
| `steam`、`vein` | 鼻孔蒸汽时刻、额头青筋 0..1（M2、M3） |

**返回**：`{ mouth, eyeL, eyeR, head, horn, plates:[[x,y,ang]×13], tailTip, segments:[[x,y,ang]×13], front:[bool×13] }`——镜头用 `mouth` 发火焰字，用 `plates` 挂字与跳台，用 `front` 做盘柱前后分层。

**小蜥蜴 `drawLizard(g, o)`**：长 60（s=1），紫色、小角、黑桃尾、大眼；`pose`：`sit`、`peek`、`scurry`、`climb`、`ride`（蹲在勇者肩上）、`hideScarf`（缩进围巾只露头）、`lead`（舞龙领舞）、`nod`、`coverEyes`（用尾巴捂眼）、`flat`（趴平）、`pout`、`sleep`、`eyeOpen`；`miniPlate`（头顶迷你名字牌，字极小、持续滚动长名字，是纹理不是阅读点）；`face`：B12 时 −1，E02 起与勇者同向。

**验收**：① 每个样条预设一张（13 节等距、背板全部正立可读）；② D1 阅读版：13 块背板依次亮的 4 个中间帧；③ `puffer`（spikes=1, puff=1）；④ `coilPillar` 前后分层示意；⑤ `shrink` popped = 0 / 6 / 13；⑥ `puppet` 剧场版与 `jaw` 0 / 1；⑦ CU-D（zoom 2.4）头部细节：牙、舌、鼻孔纹，描边宽随 `scaleOf` 反算；⑧ 小蜥蜴全部姿态 + miniPlate。

---

## 6. src/rigs/folk.js —— 市民、卫兵、书记官、传令官、村民、孩子

**导出**：`drawCitizen(g, o)`、`drawGuard(g, o)`、`drawScribe(g, o)`、`drawHerald(g, o)`、`drawChild(g, o)`、`FOLK_VARIANTS`。

**豆形市民 `drawCitizen`**：`variant`（0–11：5 种粉彩身体色 × 高矮 × 帽子；`courtier:true` 加褶领；`villager:true` 草帽；`grandma:true` 头巾 + 拐杖）。
- `pose`：`idle`、`sweep`、`push`（推车）、`flee`（向左逃，掉东西）、`lean`（前倾凑近）、`stepBack`（齐退一步）、`turnHead`、`blown`（帽子飞、头发向后）、`cheer`、`raiseHand`（举手放光点）、`jawDrop`（下巴掉 30px）、`faintBack`、`hugPot`（老奶奶抱罐）、`carryOverhead`（举横幅舞龙）、`wave`、`clap`、`hideBarrel`、`pounce`（扑上去捂嘴）、`deflate`。
- 参数：`hat`（false 表示帽子已飞）、`sweat`、`dropItem`（苹果篮）。

**卫兵 `drawGuard`**：高帽 + 长矛；`pose`：`attention`、`cheer`、`whistle`（扭头吹口哨，返回音符发射点）、`lean`、`stepBack`、`blown`、`tossHat`；`hat` 参数（L08 后王座厅里不戴）。

**书记官 `drawScribe`**：眼镜 + 鹅毛笔 + 小讲台（`desk:true`）；`pose`：`write`、`crossOut`（划大叉）、`quillSnap`（笔断成两截）、`run`、`unrollDecree`（横着展开圣旨）、`backAway`、`carryTower`（背一座摇晃的纸卷塔，`tower` 0..1 倾倒）、`deflate`。

**传令官 `drawHerald`**：高羽毛帽 + 挂小旗的小号；`pose`：`slapNotice`、`blow`（返回声波发射点）、`bentHorn`（号被吹弯）、`jawDrop`、`unrollScroll`、`kneel`、`run`、`pant`。

**孩子王浩然 `drawChild`**：`stage`：`baby`（70，襁褓）/ `toddler`（110）/ `kid`（160）/ `older`（200）；栗色头发带一缕金、呆毛（`curl` 随 stage 变卷）、小王冠；`shortScarf`（O06 起）；`pose`：`popUp`（从摇篮弹起）、`giggle`、`grabScarf`、`stand`、`hop`（蹿高）、`frown`、`yank`（拽「全名」小签）、`laugh`。

**验收**：① 12 个市民变体一排；② 群演动作各一（stepBack 与 blown 的前后对比）；③ 卫兵有帽 / 无帽；④ 书记官纸卷塔 0 / 0.5 / 1；⑤ 孩子四阶段并排，标注高度线；⑥ s=0.30 外景版可读。

---

## 7. src/rigs/monsters.js —— 史莱姆、蝙蝠、鸟、蜗牛等小动物

**导出**：`drawSlime(g,o)`、`drawBat(g,o)`、`drawBird(g,o)`、`drawDove(g,o)`、`drawSnail(g,o)`、`drawChicken(g,o)`、`drawButterfly(g,o)`、`drawFirefly(g,x,y,s)`（给粒子 draw 回调用）。

| 函数 | 关键参数 |
|---|---|
| `drawSlime` | `pop` 0..1（从草里弹出，spring 挤压）、`eyes` 乱转、`burst` 0..1（炸成绿色水花，slime / slimeDark） |
| `drawBat` | `flap`（t 驱动）、`pose`：`fly / swoop` |
| `drawBird` | `kind`：`paper`（挂线纸鸟）/ `blue`（落在公主小皇冠上的青鸟）；`thread` 是否画吊线 |
| `drawDove` | 纸鸽；`carry`（叼着横幅端点，返回喙的位置）、`flap` |
| `drawSnail` | 经验条上的小蜗牛；`crown`（LV4 戴小王冠）、`crawl` 相位 |
| `drawChicken`、`drawButterfly`、`drawFirefly` | 村庄与月光段的点缀 |

**验收**：一张图上每种动物 3 个关键帧；史莱姆 burst 0 / 0.5 / 1；纸鸽叼横幅时喙的锚点与横幅端点重合。

---

## 8. src/env/*.js —— 布景（每个地点一个模块）

**统一约定**
- 签名：`drawXxx(g, T, cam, o)`，`o.layer` ∈ `'sky' | 'far' | 'mid' | 'main' | 'near' | 'fg'`（各模块列出自己有哪些层）。函数内部自己调用 `applyCam(g, cam, depth)`，镜头只负责把每一层包进 `ctx.layer`：
  ```js
  ctx.layer(g, { shadow: 6, texture: 0.3 }, (lg) => drawCastle(lg, T, c, { layer: 'far', time: 'dawn' }));
  ```
- 布局坐标全部导出成常量（`CASTLE`、`THRONE`…），与 storyboard 第 4 节一致，镜头只读不改。
- 预设机位导出成 `CAMS`（`cam()` 对象）。
- 时段 / 天气 / 装饰只是参数，**不改坐标**。
- 每层可接受 `flat:true`（冻结视差，所有层按 depth 1 画，用于剧场背景片与插画页）。

### 8.1 src/env/book.js —— 书桌与绘本、片名页

**导出**：`drawDesk(g, T, cam, o)`、`drawBook(g, T, cam, o)`、`drawTitlePage(g, T, o)`、`bookPushCam(T)`、`bookToCastleCam(bookCam)`、`bookPageRect(T)`、`BOOK`、`CAMS`（`BK_COVER`、`BK_SPREAD`）。

| 函数 / 参数 | 说明 |
|---|---|
| `drawDesk` `o.lamp` 0..1 | woodDark 桌面 + wood 木纹 + 台灯光斑（中心 (200,100) r 900）；lamp=0 时关灯 |
| `drawBook` `o.open` 0..1 | 封面翻开角 θ = open·180°，铰链 x=960；θ<90° 画外皮（shade 随 sinθ），θ>90° 画内侧 kraft 衬页 |
| `o.cover` | `{ foilSweep:0..1, star:0..1, subtitle:0..1（副标题写到哪，挤到书口的最后几个字自动压扁）, tremble:0..1 }` |
| `o.bookmark` | `{ wobbleAt, extra:'scroll' }`（片尾多垂一截卷轴尾巴） |
| `o.popup` | 0..1 或长度 N 的数组：立体件立起进度（顺序：天幕卡、城丘、城墙、13 塔、主堡、屋顶、花丛、太阳、纸鸟、云、公主）；内部调用 `drawCastle(…, {popup})` 经 `bookPopup` 变换画进跨页 |
| `o.fold` | 0..1 立体件按反序折倒（O08） |
| `o.label` | 片尾署名贴签 0..1 + 四行文字出现进度 |
| `o.lizard` | 片尾睡着的小蜥蜴（调 `drawLizard`） |
| `drawTitlePage` | 满屏 redDeep 皮面 + 纸纹 + gold 双线框 + 四角卷草；`o.title` 交给 `type.titleGlyphs` |
| `bookPushCam(T)` | 8.20–10.39 的书内推镜曲线（O07–O08 反向用同一条曲线的镜像时段）；返回书内机位 |
| `bookToCastleCam(c)` | 书内机位 → CASTLE 等效机位：`cam(960 + (c.x−960)·2, 880 + (c.y−800)·2, 0.5·c.zoom)` |
| `bookPageRect(T)` | 天幕卡（书内 x 300–1620、y 260–880）在当前书内机位下的屏幕矩形 `{x,y,w,h}` |

**布局**：见 storyboard 4.1（封面 x 960–1840、y 200–880；跨页 x 80–1840；书缝 x=960；太阳徽章 (1400,330)；标题中心 (1400,500)；书签 x=1560）。

**验收**：① 合书 / θ=60° / θ=120° / 开书四帧；② popup 0 / 0.5 / 1；③ popup=1 时立体件与 `drawCastle` 世界画面在 `bookToCastleCam` 下逐像素对比（误差 ≤ 2px）；④ 片名页空页；⑤ 片尾帧（关灯前后）。

### 8.2 src/env/castle.js —— 王城外景

**导出**：`drawCastle(g, T, cam, o)`、`drawRoundWindow(g, o)`、`CASTLE`（塔、主堡、圆窗、阳台、城门、山路、屋顶坐标）、`CAMS`（`CA_W`、`CA_MW`、`CA_BAL`、`CA_TOWN`）。

| 参数 | 说明 |
|---|---|
| `layer` | `sky`（天空 + 太阳 / 月亮，depth 0.05）、`far`（远山 + 雪峰红旗 + 龙山冒烟，0.3）、`mid`（城丘 + 山路，0.6）、`main`（城墙、13 塔、主堡、圆窗、阳台、城门，1.0）、`near`（城下屋顶 + 地面带，1.1）、`fg`（花丛、彩旗串，1.4） |
| `time` | `dawn / doom / gray / spring / wedding / sunset / night`；`sky` 可传 `{split:x}` 做 L02 双天空（split 左侧黎明、右侧 skyDoom） |
| `popup` | 同 book（立体书用） |
| `fires` | 数组 `[{house:i, at}]`：屋顶着火时刻（火舌 ribbon + 噪声） |
| `beacons` | 塔顶烽火 `[{tower:i, at}]` |
| `flags` | `{ chars:'蒙达鲁克…', at:[13 个时刻] }`：E04 起方旗写字（spring 弹上去 + 正弦抖开）；不传则空白小三角旗 |
| `deco` | 0..1 婚礼花环、彩旗、花拱从塔顶翻折下来的进度 |
| `tear` | `{ at, x, y }` 纸天撕裂（L02） |
| `lantern` | 红灯笼脉冲开关 |
| `windows` | 夜里窗灯 |
| `ribbonWrap` | `{ p:0..1, part:'back'|'front' }` 婚礼横幅绕主堡尖塔一圈的后半 / 前半（只有这一处前后遮挡） |
| `sun` | `{ x, y, r }` 屏幕坐标太阳（O02 必须是 (1220,250) r70） |

**布局常量**（世界，depth 1）：13 塔 x = 300 + 110·i，宽 70，高 [170,210,250,210] 循环；主堡 i=6 x 840–1080、尖顶 y=120；**圆窗 (960,430) r=70**；**王家阳台 x 850–1070、地板 y=590、栏杆顶 y=560、门拱 x 925–995、红灯笼 (1062,548)**；城墙 x 260–1660、y 700–880；城门拱 x 890–1030、y 740–880；山路样条见 storyboard 4.2；雪峰 x=1260（depth 0.3）、龙山 x=1700（depth 0.3）。

**`drawRoundWindow(g, o)`**：8 瓣彩色玻璃 + 金心；`o.face` = `'out'`（外侧受光）/ `'in'`（内侧逆光 + 放射光束）；王座厅玫瑰窗用同一函数（r 不同），保证 E05、E09 前、O07 的内外匹配。

**验收**：① 七个时段同一构图各一张（L01 / E04 / O02 三联画并排）；② popup=0.5；③ L02 双天空 split=900；④ 着火、烽火；⑤ E04 旗帜写字中间帧；⑥ 婚礼 deco=1 + ribbonWrap；⑦ CA-BAL 下三个人（s=0.26）站阳台，人物约 177px。

### 8.3 src/env/plaza.js —— 城下广场

**导出**：`drawPlaza(g, T, cam, o)`、`drawGateArch(g, T, o)`（V04 换景用的前景城门拱）、`PLAZA`、`CAMS`（`PL_W`、`PL_BOARD`、`PL_HERO`、`PL_HERO_CU`、`PL_GATE`）。

| 参数 | 说明 |
|---|---|
| `layer` | `sky`、`far`（缩小的王城，0.4，含阳台和小国王）、`mid`（木筋屋，0.8）、`main`（地面、告示板、水井、城门，1.0）、`fg`（彩旗串、木桶、花箱，1.35） |
| `time` | `gray`（L06）/ `beam`（L07–L08，云缝光柱，`beamAt`）/ `morning`（V01–V04） |
| `notice` | `none / full / corners`（告示本体交给 `props/notice.js`；corners = 只剩两个纸角） |
| `farKing` | 远景阳台小国王的 `pose`（抱头、探身、胡子被掀、挥手帕） |
| `lightCircle` | 0..1 光圈（地面中心 x=520） |

**布局**：地面线 y=860；告示板中心 (1080,560)，板面 300×220；水井 x=700；城门拱 x 1660–1900、y 480–860；进城小路 x<200；人群左组 x 620–900、右组 1220–1500；传令官 x=1000。

**验收**：灰蓝 / 光柱 / 晴晨三张；`drawGateArch` 扫过屏幕中线的三帧（覆盖全高）；远景小国王四个姿势在 PL-W 下可辨认。

### 8.4 src/env/map.js —— 地图（三种形态，一套 (u,v)）

**导出**：`MAP_UV`、`mapRoute(r)`（r∈[0,1] → (u,v)，按弧长）、`mapToScreen(form, u, v)`、`drawCrayonMap(g, T, o)`、`drawParchmentMap(g, T, o)`、`drawMiniMap(g, T, o)`、`drawKnightToken(g, o)`、`drawMissionPin(g, o)`、`drawCrayon(g, o)`。

| 函数 | 参数 |
|---|---|
| `drawCrayonMap` | `icons:{sword,mountain,forest,cage,heart}`（各 0..1 立起进度）、`route` 0..1（画到哪）、`heartFill` 0..1、`owlBlink` 时刻；蜡笔笔触 lw 9、两遍 alpha 0.8、轻微抖动 |
| `drawParchmentMap` | `unfold` 0..1（4 片风琴折，竖折痕 x 560 / 960 / 1360）、`landmarks` 0..1 数组（6 个）、`bounce` 各地标被经过的时刻、`route` 0..1（红虚线 lw 8 dash [20,14]）、`ring` 0..1（城名环形字，半径 92、48px）、`pin` 0..1、`compass` 转角、`sweep` 0..1 |
| `drawMiniMap` | `{ r, dir:1|−1, walked:'red'|'gold', show:0..1, flip:0..1（翻到背面问号）}`；卡片 x 1524–1824、y 72–242 |
| `drawKnightToken` | 60px 纸片小骑士（马 + 骑手剪影），`face` |
| `drawMissionPin` | 水滴形红图钉，钉头路径画「！」，`drop` 0..1 + 波纹 |
| `drawCrayon` | 戴手套的手 + scarf 色红蜡笔（带纸套），`tip:[x,y]` |

**地标 (u,v)**：王城 (0.12,0.58)｜草原 (0.27,0.68)｜村庄 (0.43,0.52)｜雪山口 (0.58,0.33)｜月光森林 (0.73,0.53)｜巨龙山 (0.885,0.40)。换算：蜡笔 x=u·1920, y=v·1080；羊皮纸 x=160+u·1600, y=90+v·900；小地图 x=1524+u·300, y=72+v·170。

**验收**：三种形态同一路线叠图（地标位置成比例一致）；风琴折 unfold 0 / 0.33 / 0.66 / 1；城名环形字可读；小地图 r = 0 / 0.5 / 1 与 walked 金色态。

### 8.5 src/env/throne.js —— 王座厅

**导出**：`drawThroneRoom(g, T, cam, o)`、`THRONE`、`CAMS`（`TR_W`、`TR_2S`、`TR_HERO`、`TR_KING`、`CU_H`、`CU_K`、`TR_HIGH`、`TR_ROSE`、`TR_NIGHT`、`TR_RULER`）。

| 参数 | 说明 |
|---|---|
| `layer` | `back`（后墙、尖拱窗、玫瑰窗，0.55）、`mid`（柱、长幡，0.8）、`main`（地面、红毯、台阶、王座、讲台，1.0）、`fg`（虚化立柱、顶部帷幔，1.35–1.4） |
| `light` | `gray`（窗灰、雨丝）/ `sunny`（彩窗在地面投四色光斑，x 400–1300，随 drift 轻移）/ `festive` / `night`（窗外星空 + 柱上烛光） |
| `windowL`、`windowR` | 窗里画什么：`gray / day / sunset / night / moon / spring / summer / autumn / winter`（O04 四季翻牌传 `{from,to,k}`）；`windowR:'moon'` 时月亮在窗心 |
| `rose` | `{ face:'in', glow }` → 调 `castle.drawRoundWindow` |
| `decree` | 圣旨横幅：`{ hung:0..1, chars:13, sweep:0..1 }` |
| `aisle` | 0..1 纸卷铺成的通道（E08 后） |
| `confettiFloor` | 地上的彩纸 |

**布局常量**：地面 y=880；红毯 y 880–960、x −200–1300；左门拱中心 x=150；尖拱窗 x=600、1150（宽 150，y 180–540）；**玫瑰窗 (1580,250) r=150**；柱 x 260 / 780 / 1300 / 1880；台阶 x 1300–1900，顶 y 850 / 820 / 790；**王座 x=1580**（座面 y=660、靠背顶 y=430）；站位：勇者 620、国王站 (1500,790) / 坐 (1580,660)、书记官 1150、传令官 980、公主 760、摇篮 1100。

**验收**：四种光照同机位 TR-W 各一张；CU-H 与 CU-K 构图（头部 360px 左右各半）；TR-ROSE 两种 face；夜景 windowR='moon' 在 TR-NIGHT 下屏幕约 (1220,250)；O04 四季窗。

### 8.6 src/env/journey.js —— 旅途长卷 + 旅途时间线

**导出**：`drawJourney(g, T, cam, o)`、`drawOccluder(g, T, cam, kind)`、`journeyCam(T)`、`heroJourneyX(T)`、`heroJourneyState(T)`、`hudState(T)`、`rewindBand(g, T, p)`、`JOURNEY`（区、遮挡物时刻、固定物）。

| 名称 | 说明 |
|---|---|
| `drawJourney` `o.layer` | `sky`（按 camX 插值的天色）、`far`（远山、缩小王城、雪峰红旗、月亮、龙山剪影，0.05–0.3）、`mid`（风车、树林、小屋，0.6–0.95）、`main`（道路、怪、宝箱、村民，1.0）、`fg`（草丛、花田，1.2–1.5） |
| 区 | G 0–2200｜M 2200–5600｜V 5600–7900｜S 7900–9600｜N 9600–12300｜C 12300–13400（杏仁洞口 (13000,640) 宽 520 高 360；白马岩石 x=12650）；只画视窗外扩一屏内的区，Path2D 在模块加载时按固定种子预建 |
| `drawOccluder` | `gateArch`（81.00）、`treeGag`（86.00）、`oak`（89.95）、`halfPine`（93.95）、`snowCliff`（95.75）、`blackTrunks`（97.60/97.75/97.90）；depth 1.5，blur 交给图层；过屏幕中线时几乎占满画面高度 |
| `journeyCam(T)` | 单调三次样条，关键帧表见 storyboard 4.6 |
| `heroJourneyX(T)` | camX − 200/zoom（98.55 后步行） |
| `heroJourneyState(T)` | `{ bandages, bump, singed, torn, scarf:{notch,hole,frozen,glow}, soot, snowCap, chip, horse:{gait, limp, noseBandage, icicles} }` |
| `hudState(T)` | `{ show, lv, nameReveal（6/7/8/9 字）, hearts（0..5，半颗用 .5）, coins, bag, exp（0..1 + 放大态 88.01–89.85）, mini:{r, show, flip} }`；b07、b08、b14 共用 |
| `rewindBand(g, T, p)` | E03 倒放：一条预算好的色带（夜→冷→金→绿→晨）+ 横向速度线，不逐区画 |

**验收**：`sheet --from 80 --to 99.6 --every 0.25` 全段联系表（这一张就是验收）：换区只发生在遮挡物后、勇者始终在屏幕 x≈760、马蹄不打滑；90.00 前后两帧（b07/b08 接缝）逐像素一致；`hudState` 在 86.6、88.4、89.8、92.0 的数值截图。

### 8.7 src/env/cave.js —— 龙洞

**导出**：`drawCave(g, T, cam, o)`、`drawNameWall(g, T, o)`、`drawCrystal(g, o)`、`CAVE`、`STANDOFF`、`CAMS`（`CV_W`、`CV_WIDE`、`CV_2S`、`CU_H_CAVE`、`CU_D`、`CV_CAGE`、`CV_LOW`、`CV_LOW_END`）。

| 参数 | 说明 |
|---|---|
| `layer` | `back`（后壁、钟乳石、后景水晶，0.5–0.6）、`mid`（水晶柱 0.85、金币堆 0.8）、`main`（地面、地面水晶、鸟笼吊链，1.0）、`fg`（前景水晶与石笋，1.4） |
| `light` | `dark`（只有点点青光）/ `glint`（水晶依距离逐个亮，传 `glintAt` 与中心）/ `lit` / `battle`（左冷右暖）/ `dawn`（左侧洞口斜射 princessLight→goldLight 光束，`dawnP` 0..1） |
| `flat` | 剧场背景片模式（冻结视差、合成一层、sat 0.9） |
| `rubble` | D3 墙碎块：`{at, cooled:0..1}`（大战飞散 → E01 冷却成暗红余烬） |
| `scorch` | D2 洞壁上一闪的火焰字痕 |

**`drawNameWall(g, T, o)`**：D3 石碑墙；`o.dropAt[13]` 落地时刻（取 `NAME_TIMES`）、`o.glow` 熔岩光、`o.burst`（120.97 撞碎时刻，13 块炸开、字碎片飞散）；8 块 160×160（底边屏幕 y≈925，x 320–1600）+ 5 块 230×230（底边 y=765，x 385–1535）。

**布局常量**：地面 y=900；入口 x −200–140；水晶柱 x=1640（宽 110）；金币堆 x 1250–2100、峰 (1700,780)；**鸟笼吊点 (1320,0)，笼心 (1320,330)，180×240，门朝左，挂锁 (1232,350)**；勇者站位 x=420；`STANDOFF` = 勇者脚底屏幕 (520,840)、龙头 (1350,520)、龙身到 (1700,760)、鸟笼 (1480,330)（含对应机位与姿态）。

**验收**：五种光照同机位各一张；名字墙 8 + 5 块完整版与撞碎中间帧；`flat` 版与正常版并排；`STANDOFF` 帧与剧场 137.40 帧对比。

### 8.8 src/env/theater.js —— 纸剧场

**导出**：`drawTheater(g, T, o)`、`theaterState(T)`、`THEATER`、`CAMS`（`TT_W`、`TT_OUT`）。

| 参数 | 说明 |
|---|---|
| `grow` | 0..1 由宽银幕黑边长成台口（0 = 上下 138.3px 纯黑条；1 = 顶幕 y 0–150 + 流苏到 172、边幕 x 0–110 / 1810–1920、台唇 y 860–1080 + 6 盏脚灯） |
| `part` | `'back'`（台口内背景片：调用 `drawCave({flat:true})`）/ `'frame'`（顶幕、边幕、台唇、脚灯）/ `'frameFront'`（名字之剑穿过时盖在剑前的那部分台框） |
| `curtain` | 0..1 主幕合拢（1 = 在 x=960 合上） |
| `bite` | 0..1 台口当上下颌合拢（1 = 顶幕与台唇在屏幕中线相遇） |
| `wingTear` | 0..1 右侧边幕被剑尖撕开（预剪锯齿口随剑尖长大） |
| `valance` | `'whole' / 'torn'（被竖起的剑撕开）/ 'halves'（B11 劈成两半落下，带 fallAt）` |
| `light` | `warm / purple`（敌方回合 tint dragon α0.18）/ `off` |
| `room` | TT-OUT 时剧场外的暗房与桌沿（画足 2400×1350） |
| `scale` | 整座台口缩放（E01 穿过台口 1→1.8） |

**`theaterState(T)`**：返回 `{ turn:'hero'|'enemy'|'victory', heroPlate:{progress, state}, dragonPlate:{progress, state}, menu:{cursor, locked, submenu}, hp:{hero, dragon} }`，b12、b13 共用，接缝 150.52 由它保证一致。

**验收**：grow 0 / 0.5 / 1；curtain 0 / 1；bite 0 / 0.6 / 1；wingTear 与 valance 三态；TT-OUT 全景（剧场外暗房无空白）；字幕带 y≥920 只有台唇与脚灯。

---

## 9. src/props/*.js —— 道具

签名统一为 `drawXxx(g, o)`，`o.x, o.y` 为道具锚点（各条写明锚在哪），`o.s` 缩放，`o.rot` 弧度，`o.t` 秒。

### 9.1 src/props/sword.js

| 导出 | 参数 | 用到 |
|---|---|---|
| `drawSword(g,o)` | 锚在剑柄握点；`state:'sheathed'|'bare'`、`glint` 0..1（四角星沿刃口跑到剑尖）、`chip`、`arc`（拔剑白色弧光进度）、`flat`（剧场平面版） | 全片 |
| `drawNameSword(g,o)` | 锚在护手中心（剧场 (600,560)）；`tiles` 长度 13 的 0..1（每块字牌从名字牌飞来的进度，终点 x = 护手 x + 60 + 126·i）、`angle`（0 水平 → −π/2 竖直）、`glow` 0..1（沿刃上跑的扫光）、`scarfWrap` 0..1（围巾螺旋缠柄）、`part:'back'|'front'`；字牌 120×120，steel / steelDark 底、金包边、墨字 96px，走 `type.glyph13` | b13 |
| `drawSwordIcon(g,o)` | 地图与菜单用的小剑（`kit.glyphIcon('sword')` 的道具版） | b03、b13 |

**验收**：拔剑弧光三帧；名字之剑 tiles = 4 / 8 / 13 三帧 + angle 0 / −π/4 / −π/2；字永远正立可读。

### 9.2 src/props/scarf.js

| 导出 | 参数 | 用到 |
|---|---|---|
| `drawScarf(g, pts, o)` | 沿一串点画粗细渐变的 `ribbon`（宽 22→8、末端流苏）；`notch`、`hole`、`patch`、`frozen` 0..1（硬板 + 冰凌）、`glow` 0..1、`fringe` | 勇者木偶内部调用；b06 片名下划线（`o.text` 沿围巾写字） |
| `scarfTrail(anchorFn, T, n, lag)` | 时间回溯采样：返回 `n` 个点，第 k 点 = `anchorFn(T − k·lag)` | 镜头自算拖尾 |
| `drawScarfWipe(g, T, o)` | b14 入场的巨型围巾擦屏：`p` 0..1（从右往左），带缺口与破洞，`hole` 处挖空透出下层 | b14 |
| `drawScarfBand(g, T, o)` | 红虚线合拢成满屏红带（b07 入场）：`p` 0..1 间隔合拢、`angle` | b07 |
| `drawBookmark(g, o)` | 书签（scarf 色燕尾丝带），`wobbleAt` | b01、b17 |
| `drawScarfKnot(g, o)` | 围巾缠两人相握的手（红绳）`p` 0..1 | b15 |

**验收**：五态并排；擦屏 p=0.3 / 0.6 时破洞透出下层；书签与开场合书构图一致。

### 9.3 src/props/paper.js —— 纸制品（告示、卷轴、圣旨、纸卷、贴签）

| 导出 | 参数 | 用到 |
|---|---|---|
| `drawNotice(g,o)` | 锚在纸中心；`face:'front'|'back'`、`flip` 0..1（scaleX 1→0→−1）、`unroll` 0..1、`pins` 0..2、`corners`（只剩两个纸角）；正面「勇者招募」+ 丑龙涂鸦 +「金币 ×999」，背面牛皮纸（交给 `map.drawCrayonMap`） | b03、b07 |
| `drawScroll(g,o)` | 平铺段 + 滚筒：`len`（展开长度）、`dir`（1 向右滚 / −1）、`rollR`、`text`（逐字揭示，`type.scrollInk`）、`notes`（页边旧笔记与划掉的字）、`doodle`（勇者举剑 + 龙）、`stampX` 0..1 | b04 记录、b14 捷报、b16 长名卷轴 |
| `drawDecree(g,o)` | 圣旨：奶油长卷 + 红边，`unroll`、`prints[3]`（三段金印各自的出现时刻）、`hung` 0..1（吊成横幅） | b05 |
| `drawPaperRoll(g,o)` | 大纸卷：`r`、`spin`（表面转过金色名字）、`bounceAt[]`；`overCamera` 0..1（碾过镜头：横向纸卷从屏幕下沿滚到上沿） | b06 |
| `drawScrollTower(g,o)` | 书记官背的纸卷塔，`tilt` 0..1、`topple` 0..1 | b16 |
| `drawInfiniteScroll(g, path, o)` | 沿路径展开的无限卷轴：`p` 0..1、文字循环（王浩然 + 四个长名字，路径画小圆点分隔），屏幕字高 < 6px 时改画点纹纸带 | b17 |
| `drawCreditLabel(g,o)` | 片尾奶油贴签（paper 底、ink 框、缝线角）`p` 0..1 | b17 |

### 9.4 src/props/royal.js —— 王冠、小皇冠、金印、权杖、钟、婚礼装饰

| 导出 | 参数 | 用到 |
|---|---|---|
| `drawCrown(g,o)` | 国王大王冠（单独飞、滚、落回头上时用）`spin`、`squash` | b05、b14、b15 |
| `drawTiara(g,o)` | 公主小皇冠 `glint` | b01、b02、b15 |
| `drawSeal(g,o)` | 和国王一样大的金印（木柄 + 金底）`lift` 0..1 | b05 |
| `drawStampMark(g,o)` | 印迹：`kind:'gold'|'check'|'x'|'error'`、`p` 0..1（砸下 + 放射线）；对勾、叉用路径画 | b05、b14、b16 |
| `drawScepter(g,o)` | 星星权杖 | b15 |
| `drawBell(g,o)` | 钟 `swing`（声波弧线另画） | b15 |
| `drawGarland(g,o)` | 花环、彩旗串、花拱 `fold` 0..1（像立体书机关一样从上翻折下来） | b15 |
| `drawCradle(g,o)` | 摇篮 `rise` 0..1（立体书机关立起 + 底部折角） | b16 |
| `drawLantern(g,o)` | 红灯笼 `pulse` | b02 |

### 9.5 src/props/cave.js —— 鸟笼与洞内道具

| 导出 | 参数 | 用到 |
|---|---|---|
| `drawCage(g,o)` | 锚在笼心；`door` 0..1（朝左开）、`lock:{pins:0..3, open:bool}`、`tally`（“正”字刻痕数）、`onFloor`、`chain`、`mini`（剧场迷你偶） | b02、b09、b11、b13 |
| `drawCoin(g,o)` | `spin`（scaleX = cos）、`bite`（牙印）、`flash` | b07、b09 |
| `drawCoinPile(g,o)` | 金币堆，`sparkleT` | b09–b13 |
| `drawStoneTablet(g,o)` | D3 石碑：`size`、`char`、`glow`（刻痕熔岩光）、`crack` | b10（`cave.drawNameWall` 调用） |

### 9.6 src/props/village.js —— 宝箱与容器、道具小图标、听岔图标

| 导出 | 参数 |
|---|---|
| `drawChest(g,o)` | `open` 0..1、`big`、`burst`（金光迸出） |
| `drawPot / drawBarrel / drawFlowerPot` | `open` 0..1 |
| `drawItemIcon(g, name, o)` | 路径画小道具：`potion / key / boots / shield / hat / bag` |
| `drawMishearIcon(g, name, o)` | 听岔五件：`card`（昆特牌：王冠压交叉双剑，红边金框）、`violin`（wood 琴身两片 blob + 细腰、f 孔、四弦、琴弓）、`eggtart`（sand 花边酥皮、coin 蛋液、焦斑、三缕热气）、`soda`（ice/water 瓶、吸管、气泡）、`marathon`（heroBlue 跑鞋 + 被冲断的红色终点线） |

### 9.7 src/props/misc.js —— 其它

| 导出 | 说明 |
|---|---|
| `drawTumbleweed(g,o)` | 纸风滚草 `roll`、`charred`（I2 烧焦版） |
| `drawPetal(g,o)` | 心形花瓣（princess / princessLight）可带一个字（`type.paperGlyph`，princessDark） |
| `petalOrbit(T, o)` | E02 花瓣环：返回每片的位置、缩放、是否在身后；每个字在轨道最前方诞生，最后收成头顶花环 |
| `drawBanner(g, path, o)` | 名字横幅 / 竖幅：沿路径排字（`type.glyphsOnPath`）、`grow` 0..1、`style:'princess'|'hero'`、`retract` 0..1（O01 卷尺式弹回）；E10 竖排段从上往下、落地后横排 |
| `drawBow(g,o)` | 婚礼大蝴蝶结 `pop` |
| `drawFireLetter(g,o)` | D2 火焰字：display 字形 + fire2→fire→fireDeep 竖向渐变 + 3–5 条火舌 + screen 光晕 + 拖烟（`type` 提供字形路径） |
| `drawFireBreath(g,o)` | 火柱 / 火流（`split` 0..1 被剑劈成 V 字）、火墙（`wall`，用于剪影段擦屏） |
| `drawFireworkShape(g,o)` | 爱心形 / 星形烟花（burst 粒子按路径形状排列） |
| `drawHand(g,o)` | 讲故事人的纸手（skin + inkSoft 袖口）：`pose:'slap'|'grab'`、`press` 0..1 |
| `drawShockRing(g,o)` | 奶油纸冲击环（墨线），`r`、`alpha` |
| `drawSpeechWave(g,o)` | 号声 / 钟声的声波弧线 |
| `drawBalloonString(g,o)` | 气球线（N3 线缠成结） |
| `confettiDraw / sparkDraw / snowDraw / dustDraw / ashDraw / emberDraw` | 给 `burst/stream/field` 的 draw 回调（彩纸用 heart/gold/crystal/meadow；纸灰带焦边） |

**props 验收**：每个文件一张模型图，覆盖上表每个导出的关键状态（例：鸟笼 door 0 / 1、lock pins 0 / 1 / 3、onFloor；花瓣环 4 个中间帧；横幅 retract 0 / 0.5 / 1）。

---

## 10. src/ui/kit.js —— 纸艺 RPG 界面

**材质统一**：底色 paper，外轮廓 4px ink 墨线（`poly`，抖动 1.2px），内圈 kraftDark 2px 缝线（虚线 [10,8]，内缩 12px），四角 gold 包角饰；名签红底（red）奶油字；图层投影 8–14、纸纹 0.3 由镜头给。界面字用 `play`，数字 / LV / HP / VS / EXP 用 `latin` 600–700。**所有界面元素都在 y ≤ 900**（字幕带只放装饰）。

| 导出 | 参数 | 用到 |
|---|---|---|
| `paperPanel(g, rect, o)` | 基础卡纸面板：`stitch`、`corners`、`tag:{text, side}`、`bulge` 0..1（边框鼓成气球，blob） | 所有面板 |
| `glyphIcon(g, name, x, y, size, o)` | **路径画符号**：`star`、`heart`、`note`（音符）、`check`、`cross`、`triDown`、`triRight`、`sparkle4`、`dot`、`exclaim`（「！」图形版）、`question`、`sword`、`lock`、`circledNum`（1–4）、`arrow` | 全片 |
| `dialogBox(g, o)` | `rect`（默认 (420,690)–(1500,900)）、`speaker:'king'|'hero'`（头像放在说话人一侧：国王右端、勇者左端）、`tag`（「国王」/「？？？」，`tagFlip` 0..1）、`text` + `typed` 0..1（打字机，每字弹一下）、`cursor`（闪烁小三角）、`textArea`（N1 为 x 600–1384，正好 8 个 120px 字）、`bulgeRight` 0..1、`tear` 0..1（右框撕开，返回撕口位置） | b04、b05 |
| `bubble(g, o)` | `shape:'round'|'jagged'|'cloud'|'flame'|'soft'`、`text`（≤5 字）、`tail:[x,y]`、`pop` 0..1（outBack）、`mirror`（K1 / Q1 镜像） | 全片 |
| `thinkDots(g, o)` | 云朵思考泡里三个路径圆点依次弹出 | b04 |
| `namePanel(g, o)` | 吊线取名面板：`rect`（(440,250)–(1480,620)）、`label`「取名」、`slots` 8、`tiles[]`（字 + 落入进度 + `squashX`）、`counter`（「0/8」…「13/8」，超限变红）、`overTag`（「字数超限！」闪烁次数）、`strings:{left, right}`（断绳时刻）、`swing` 角度、`popFrames` 0..1（格框崩飞）、`foldEmpty` 0..1（O06 空格折起）、`contract` 0..1（外框收拢到 3 格）、`drop` 0..1（坠出画面）、`tagBelow`（O07「全名」小签 + 小三角，`yank` 0..1） | b05、b16、b17 |
| `drawHUD(g, state)` | 左上角色卡 x 96–600、y 72–232：头像圆框（d 120）、名字牌（`nameReveal` 6–9 字 + 省略号）、EXP 细条、5 颗路径心（`hearts` 可为 .5，`crackAt[]`）、「LV n」、金币图标 +「×n」、小背包；`state` 直接用 `journey.hudState(T)` | b07、b08 |
| `expBarBig(g, o)` | V08 放大到画面上方中央的经验条（x 560–1360、y 140–170），`fill` 跟着 `drawSnail` 爬 | b07 |
| `lvUpBadge(g, o)` | 金色纸徽章「LV UP」像气球一样慢慢鼓起（0.35s），`scale` 越来越小的变体可选 | b07、b13 |
| `coinCounter(g, o)` | 翻页计数牌：`value`、`flipAt[]`（每到一枚翻一格）、`bounce` | b07 |
| `marqueePlate(g, o)` | 剧场名字牌：`side:'hero'|'dragon'`、`name`、`progress` 0..1（= 本 cue 已过时间 / 本 cue 时长）、`state:'idle'|'active'|'hit'|'angry'|'cracked'|'empty'`、`window` 5 字（72px、字距 63、窗宽 315）、`centerGold`（经过中线的字变 goldLight）、`hp` 0..1 + 滞后白条、`shrink`（B12 随龙缩小）；返回窗口中线 x 与当前中线字序号（B12 弹飞节用） | b12、b13 |
| `battleMenu(g, o)` | 2×2「攻击 / 技能 / 道具 / 逃跑」（x 150–560、y 640–830）、`cursor`（路径金色小剑）、`press`、`locked`（灰 + 小锁）、`submenu:{text:'名字之剑', p}` | b12、b13 |
| `turnBanner(g, o)` | 「勇者的回合 / 敌方回合 / 胜利！」绸带横幅：`text`、`flip` 0..1、`drop` | b12、b13 |
| `damageNumber(g, o)` | 「-999」「HP 1」「EXP +9999」等：latin 700、heart 红或金、奶油描边，`pop` + 上飘淡出 | b07、b12、b13 |
| `itemBar(g, o)` | 道具栏「道具」5 格（x 880–1720、y 200–560，每格 150×200，名称 play 40px 在格下）：`items[]`（`kind`、入格进度、`rarity` 星数，马拉松 = 5 颗路径星炸开）、`burn` 0..1（燃烧边从右往左，交给 `fx.burnEdge`） | b10 |
| `characterCard(g, o)` | 300×420 角色卡：`face:'back'|'front'`、`flip`、`portrait`（调木偶头部）、`nameStrip`（勇者全名绕到卡背 / 「？？？」/「国王」）、`extras`（小卷轴、「LV ??」） | b06 |
| `enemyPlate(g, o)` | 「？？？ LV 99」吊牌（与名字牌同材质） | b09 |
| `vsBadge(g, o)` | 红金纸徽章「VS」`drop` | b09 |
| `nameTagSmall(g, o)` | 头顶小名签（「？？？」→ 全名，全名从两头溢出）与胸前名签（「达拉崩吧」「米娅」） | b04、b05、b16 |

**验收（`src/sheets/kit.js`）**：每个组件的全部状态一屏排开；`glyphIcon` 全部符号 64px 一排（确认没有一个是字体字）；对话框 N1 文字区正好 8 个 120px 字；名字牌 progress 0 / 0.5 / 1 与五种 state；取名面板 8 格 → 13/8 崩飞 → 3 格收拢三个关键态；所有界面在 1920×1080 下 y ≤ 900。

---

## 11. src/ui/type.js —— 剪纸字与名字排版

| 导出 | 说明 |
|---|---|
| `NAME_TIMES(seg)` | 由 `cues.js` 算逐字时刻：段首字 = 段 cue，步长 = 段长 ÷ 字数；`seg` 取 `'N1a'…'N4c'、'D1a'…'D3b'` 或无分段句子的自定义段 `'B10a/b/c'、'E02'、'E04'、'E06'、'E08'、'E10'、'E12'、'O06'`（数值见 storyboard 附录 A）。返回时刻数组 |
| `charsOf(name)` | `NAMES` 的逐字数组（不用整串 `fillText`） |
| `paperGlyph(g, ch, x, y, size, o)` | 单字剪纸字：`lineJoin='round'` 奶油纸边（字号 × 0.18）→ 填色 → 切口亮边；`o.family`（默认 display）、`fill`、`edge`、`rot`、`scale`、`squashX`、`flipY`（颠倒）、`mirror`（镜像）、`alpha`；返回字宽（display 字宽 = 0.765 × 字号） |
| `glyphRow(g, chars, x, y, size, o)` | 逐字定格排一行：`appear[]`（每字出现进度，outBack 0→1 过冲 1.15）、`gap`、`perChar(i)` 回调改单字变换 |
| `typeOn(g, text, x, y, size, p, o)` | 打字机（对白、界面），每字弹一下 |
| `glyphsOnPath(g, chars, path, o)` | 沿曲线按弧长排字，旋转跟切线但夹在 ±15°，永远正立；`grow` 0..1；`vertical:true` 时竖排从上往下（字不转） |
| `glyph13(g, chars, anchors, o)` | 13 格字槽：每槽独立位置、角度、状态 `off / lit / fire / gold / steel / stone`、出现时刻、弹跳；用于龙身背板、名字之剑、塔旗、石碑墙 |
| `marquee(g, chars, rect, progress, o)` | 走马灯：用 rect 裁剪，偏移 = 窗口跨度 × progress；`stutter`（每 0.2s 跳一格并抖）、`shake`、`centerGold` |
| 材质样式 | `style` 参数统一：`cut`（红字奶油边，N1）、`tile`（字母牌，N2、O06）、`balloon`（play 字形 + 粉彩填色 + 椭圆高光，N3）、`seal`（红底白字印章字，N4 三行）、`gold`（金箔，圣旨）、`title3`（片名三层纸叠 red / gold / paper，偏移 0 / 8 / 16）、`plate`（龙背板刻痕 → 发光）、`fire`（火焰字字形，交给 props 加火舌）、`stone`（石刻 + 熔岩缝）、`steel`（剑刃字牌）、`petal`、`flag`、`ink`（卷轴墨字，左→右书写遮罩）、`banner` |
| `titleGlyphs(g, o)` | 片名「达拉崩吧」300px 三层纸叠：`rise[4]`（scaleY 0→1 以基线为锚）、`foil` 0..1 扫光、`starAt` |
| `scrollInk(g, text, rect, p, o)` | 卷轴墨字从左往右“写”出 |

**规则**：名字每字屏幕 ≥ 48px；变形 / 飞走前至少静止可读 0.25s；「·」只在 play / latin 里有，display / serif 里用 `glyphIcon('dot')`；中文标点「！？」不用 latin。

**验收（`src/sheets/type.js`）**：全部 `style` 各写一遍勇者名；`glyphsOnPath` 在 S 形路径上（含竖排）；`glyph13` 六种状态；`marquee` 五种状态；`NAME_TIMES` 打印表与 storyboard 附录 A 一致（模型图上直接印出数值）。

---

## 12. src/fx/transitions.js —— 转场与冲击（新增模块）

| 导出 | 说明 | 用到 |
|---|---|---|
| `impact(ctx, T, at, level)` | 冲击帧：`level` 'S' / 'M' / 'L' / 'MAX' → shake 8 / 14 / 22 / 32、flash 0.25 / 0.5 / 0.8 / 1.0（MAX 两帧）、放射线；多处同时写 fx 时取 max | 全片 |
| `speedLines(g, dir, rect, o)` | 手画速度线（引擎默认不做运动模糊）：`dir` 'h' / 'v'，`density`、`alpha` | 甩镜、奔跑 |
| `whipCurtain(ctx, g, T, o, drawNext)` | 甩镜帘：`{t0, t1, dir:'down'|'left'|'right'|'up'}`；一条 160px 速度线带从一边扫到另一边，带后由 `drawNext(lg)` 画后一块画面（`ctx.mask`） | b03 入场、b10 入场 |
| `shapeReveal(ctx, g, shape, o, drawNext)` | 形状遮罩揭示：`shape` 'heart' / 'circle' / 'almond' / 'rect'，`{cx, cy, size, rot, feather, outline}`；heart 带 heart 色描边 | b03→b04、b08→b09、b14、b15、b17 |
| `pageTurn(ctx, g, T, o, drawNext)` | 翻页：折线从右往左，卷起部分画渐变条带与页背 paper2，折线右侧露出下一页 | b16 |
| `burnEdge(ctx, g, rect, p, o)` | 燃烧边：一条被噪声扰动的亮橙线推进，线后变焦黑卷曲并 burst 灰片 | b10 |
| `paperTear(g, path, p, o)` | 纸面撕裂：锯齿口随 p 扩大、边缘卷起露纸背 | b02 天空、b05 对话框、b13 侧幕 |
| `splitScreen(ctx, g, o, drawL, drawR)` | 撕纸分屏：两个矩形遮罩各用一台机位，中间一道撕纸边 | b11 |
| `colorSplit(ctx, g, x, o)` | 左冷右暖：两个半屏遮罩叠 tint（magic / fire），不逐形状滤镜 | b11 |
| `smokeWipe(g, T, o)` | 灰烟 blob 翻滚盖满再散开 | b10 |

**验收**：每个转场在 `src/sheets/fx.js` 里用两块纯色测试画面跑 6 个中间帧；冲击四级对照。

---

## 13. 建造顺序与交付

1. **共享时间线与常量**：`type.NAME_TIMES`、`map.MAP_UV / mapRoute`、`journey.journeyCam / hudState`、`book.bookPushCam`、`cave.STANDOFF`、`theater.theaterState`、各布景 `CAMS`。
2. **字与界面**：`type.js` → `kit.js`（`glyphIcon` 先做）。
3. **布景**：先 `throne.js`、`cave.js`（出镜最久），再 `castle.js`（书、地图、旅途都复用它）、`book.js`、`plaza.js`、`map.js`、`journey.js`、`theater.js`。
4. **木偶**：`hero.js`（含围巾）→ `dragon.js`（样条 + glyph13）→ `king.js` → `princess.js` → `horse.js` → `folk.js` → `monsters.js`。
5. **道具与转场**：`props/*`、`fx/transitions.js`。
6. 每个模块交付时附模型图（第 0.4 节流程），`./tools/lint.sh` 通过，模型图 PNG 放 `out/review/sheets/<模块>/`。
7. 场景作者只 import 基础库、不改基础库；缺动作或参数时提给基础阶段统一加，并同步更新本文件。
