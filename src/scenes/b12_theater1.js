// b12 · 纸剧场（一）：于是、出招、砍向、中招、然后、反扑、咬（[137.4, 150.52)，见 docs/storyboard.md「b12」与 docs/blocks/b12.md）。
// 一台固定的纸剧场（TT-W）贯穿全块：137.40 接管 b11 的宽银幕黑边并长成台口 → 回合制界面落下 → 勇者回合出招暴击 →
// 敌方回合龙偶逼近 → 台口当上下颌咬合 → 弹开，勇者偶被含在龙偶嘴里（= b13 接缝合同 'b12|b13'）。
// 每个镜头画同一个整帧（drawB12）；镜头 id 只用来对应分镜段落。第一个镜头与 b11 重叠，z: 1 盖在上面并关掉引擎黑边。
import { cue } from '../cues.js';
import { drawB12, T0 } from './b12/stage.js';

const draw = (g, T, lt, ctx) => drawB12(g, T, ctx);

export default [
  { id: 'b12_proscenium', start: T0, end: cue('B01'), z: 1, draw },          // 黑边长成台口，角色翻成纸偶，木杆伸上来
  { id: 'b12_turn1', start: cue('B01'), end: cue('B03'), draw },              // B01 名字牌 / 横幅 / 菜单落下；B02 名字走马灯、选「攻击」、滑到台中蓄力
  { id: 'b12_slash', start: cue('B03'), end: cue('B04'), draw },              // B03 跳起月牙斩
  { id: 'b12_hit', start: cue('B04'), end: cue('B05'), draw },                // B04 龙名红闪滚动、-999 暴击、转一圈、勇者得意
  { id: 'b12_enemy', start: cue('B05'), end: cue('B07'), draw },              // B05 敌方回合紫灯上锁；B06 龙名又快又凶、龙偶逼近
  { id: 'b12_bite', start: cue('B07'), end: cue('B08'), draw },               // B07 台口咬合「嗷呜！」→ 弹开，勇者偶在龙嘴里乱蹬
];
