# 达拉崩吧纸艺 MG 动画 — 复现包

纯代码 MG 动画的完整源码。**不含音频**（原曲与周深版现场均为版权内容,需自行获取）和成片 MP4。

## 先读这个

**`复现全流程.md`** — 完整复现手册（736 行）。从零到成片的全部流程、思路、命令、踩坑记录，附录 B 里有 8 个可直接套用的 agent 提示词模板。

其余文档：

| 文件 | 作用 |
|---|---|
| `docs/brief.md` | 导演任务书（风格、角色、硬性约束） |
| `docs/cues.md` | 时间轴与歌词 cue |
| `docs/engine.md` | 引擎 API 参考 |
| `docs/storyboard.md` | 定稿分镜（17 个场景块） |
| `docs/assets.md` | 基础资产规格 |
| `docs/api/*.md` | 12 组基础模块的**实际** API（以代码为准） |
| `docs/scene_guide.md` | 场景块作者规范 |
| `docs/integration_notes.md` | 集成拍板与素材坑 |
| `docs/seams.md` | 7 处隐形接缝的像素级合同 |
| `docs/blocks.json` | 17 块的区间与交接表 |

## 目录

```
src/core/      引擎（镜头调度、图层、遮罩、相机、纸艺绘制、粒子、纹理）
src/rigs/      角色（勇者/龙/公主/国王…）
src/env/       场景（书、城堡、广场王座厅、洞穴、旅途地图…）
src/props/ ui/ fx/   道具、界面、特效
src/scenes/    17 个场景块 b01–b17 + 引擎无关的接缝合同
assets/fonts/  4 款 OFL 中文字体（子集化时需要）
tools/         渲染与自检工具
```

## 跑起来

```bash
npm install                      # 只装 playwright-core 和 esbuild
node tools/check.mjs blocks      # 17 块逐块自检，应全部 OK
node tools/render.mjs sheet --sheet   # 全片缩略图总览
```

渲染单帧/单块：

```bash
node tools/render.mjs stills --only b05 --times 60.5 --outdir out/test
node tools/render.mjs sheet --only b05 --every 0.25 --cols 8 --out out/test/b05.jpg
```

## 三条铁律（踩过才知道）

1. **纯函数** — 画面只由时间 T 决定。禁止 `Math.random()` / `Date.now()` / 跨帧状态；随机一律用 `hash1/hash2/mulberry32(固定种子)`。`tools/lint.sh` 会扫。
2. **不许改共享文件** — `src/core/`、`src/rigs/`、`src/env/`、`src/props/`、`src/ui/`、`src/fx/`、`src/cues.js`、`src/scenes/_seams.js` 以及别人的块。缺功能就在自己块里绕开，并写进交付文档的"需求"一节。
3. **接缝必须像素级对齐** — 7 处隐形接缝的前后两块不重叠、不转场，交接瞬间画面要几乎完全一致。做法见 `docs/seams.md`，验收用 `node tools/seams.mjs --list "b04|b05"`（**务必加引擎的 nograin**，胶片颗粒会让不同时刻的两帧整屏差 ±10）。

字体均为 SIL OFL 授权，可自由使用。
