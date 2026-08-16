# relax/shake · 甩一甩升级版

**状态：📋 规划中**
**技术：** Canvas + 物理（重力 / 碰撞 / 弹性）
**将用于：** LetOut（投掷/发泄式解压）

## 形态
一个「压力球」，用户拖动并甩出去，撞击墙壁回弹，带重力下坠与弹性形变。比单纯移动更有「被接住」的安心感。FaceTalk 早期用过 GSAP Draggable + InertiaPlugin 的愤怒小鸟式拖拽，可作为交互手感参考，但本模块改为轻量自研物理（或基于 LittleJS 这类 HTML5 轻量引擎），去掉第三方依赖。

## 路线
1. 单一压力球 + 拖动 + 惯性甩出
2. 加入重力、墙壁碰撞、弹性回弹
3. 多球 + 碰撞互相作用
4. 撞击触发 RCJ Particle Engine 粒子迸发

## 参考
- LittleJS（轻量 HTML5 游戏引擎，含粒子/物理/输入/声音）
- FaceTalk 早期 `Draggable + InertiaPlugin` 拖拽手感（已下线的解压小游戏）
