# Mineflayer — native 26.2 fork

2026-09-15：新增登录状态清理、物理积压限制、窗口标题标准化与玩家能力状态，详见 [本轮说明](https://github.com/zkonikishi/Mineflayer/blob/26.2/docs/upstream-update-2026-09-15.md)。

2026-09-13：选择性集成箱子状态修复与 pnpm 自依赖路径修复，原生 26.2 协议补丁保持不变。详见 [更新审查](https://github.com/zkonikishi/Mineflayer/blob/26.2/docs/upstream-update-2026-09-13.md)。

这是 [zkonikishi/Mineflayer](https://github.com/zkonikishi/Mineflayer/tree/26.2) 的 `26.2` 分支，为 Minecraft Java / Paper 26.2 原生协议和插件自动化测试维护。它不是 PrismarineJS 官方 npm 发布版，也不是 MCP 服务端。

本项目基于 [PrismarineJS/mineflayer](https://github.com/PrismarineJS/mineflayer)；保留上游 API 和 MIT 许可。它是有明确兼容性补丁的 fork，而不是完全独立重写。

## 与官方分支的关系

2026-09-07 审计时，官方 `pc26_2` 为 `c77e6d5ac22d0efd9872fa7b5f9165e0b7a3d0c6`，本 fork 已提交版本 `56b64fae1a019eb08a088b9b1b20bc223342add9` 在其上增加 6 个提交。不要因为官方存在同名适配分支，就用它覆盖本 fork。

主要差异：

- 原生 26.2 数据、entity metadata / item component serializer 映射。
- 独立 attack 包、新 use_entity 字段和 clockUpdates 处理。
- Team 显示名、颜色、flags 和删除事件生命周期修复。
- 关闭窗口后的背包同步、窗口 ID 复用和缓存清理。
- configuration 阶段暂停物理包发送。
- 资源包 UUID 使用协议需要的字符串，而非 UUID 包装对象。
- player_loaded 按协议字段启用，PLAY 状态下每次 spawn 通知，不吞发送错误。

## 安装与使用

需要 Node.js >=22。安装的是本 fork，不是 `npm install mineflayer` 对应的官方发行版：

```sh
npm install github:zkonikishi/Mineflayer#26.2
```

可复现部署应将 `26.2` 换成经过验收的完整 commit SHA，并保存宿主项目 lockfile。本 fork 的 protocol 依赖仍引用分支；仅固定 Mineflayer SHA 不等于固定整个依赖树。

```js
const mineflayer = require('mineflayer')
const bot = mineflayer.createBot({
  host: '127.0.0.1',
  port: 29565,
  username: 'TestBot',
  auth: 'offline',
  version: '26.2'
})
bot.on('error', console.error)
bot.on('kicked', console.error)
```

离线认证仅适用于 offline-mode 测试服。正版服使用 Microsoft 认证；账号缓存不能提交到 Git。

安装脚本会把随仓库提供的 26.2 数据写入已安装 minecraft-data 并重新生成数据索引。不要跳过脚本后直接宣称 26.2 可用，也不要在共享依赖目录中盲目升级。升级 minecraft-data、minecraft-protocol、prismarine-chunk 或 prismarine-physics 后需要重跑协议测试。

## 版本与验收边界

保留上游旧版本分派逻辑，不代表 1.8 到 26.2 的每个版本、每种功能均已实测。基岩版不在此项目范围。

已执行的专项检查包括 Team 的 1.8.9 / 1.21.11 / 26.2 三个版本、窗口缓存三种情形和资源包 UUID 两种事件。Paper 26.2 的实机结果必须区分已提交依赖与尚未发布的本地改动。

资源包状态响应不是资源包下载、渲染或模型视觉验收；本机器人也不是完整 Minecraft 图形客户端。时钟按服务端 world_clock / dimension_type.default_clock 映射选择，不猜固定 ID；未知维度返回空时间。安装器拒绝未审查数据版本及未知数据覆盖，仅允许已核验旧数据迁移。28 个声明版本已完成内部矩阵（576 通过、40 项版本不适用跳过、0 失败）；27 个旧版真实服务端基础操作和原生 Paper 26.2 验收通过。这不等于每个历史补丁版本或每项业务功能都经过验证。

## 开发检查

```sh
npm run lint
node tools/team-regression.js
node tools/window-sync-regression.js
node tools/resource-pack-regression.js
node tools/game-lifecycle-regression.js
node tools/time-regression.js
node tools/data-install-regression.mjs
```

这些是定向回归，不替代上游完整测试套件。独立测试服应使用隔离目录和测试端口；测试后通过客户端退出和服务器 stop 自然关闭。

## API、MCP 与归属

- [API 文档](https://github.com/zkonikishi/Mineflayer/blob/26.2/docs/api.md)沿用上游接口说明，具体行为以当前版本为准。
- [Minecraft MCP Server](https://github.com/zkonikishi/Minecraft-MCP-Server/tree/26.2) 是另一个项目：它把机器人操作封装为 MCP 工具，并管理重连、命令响应和生命周期。本仓库只提供机器人库。
- 原有翻译、教程和示例保留作上游参考，不应当成 fork 的发布或验收承诺。
- 原作者及贡献者归属保留，见 [LICENSE](https://github.com/zkonikishi/Mineflayer/blob/26.2/LICENSE)。

## 完整收尾记录

参见 [2026-09-08 兼容验收](https://github.com/zkonikishi/Mineflayer/blob/26.2/docs/compatibility-2026-09-08.md)。本项目是无头协议客户端，不需要图形 Minecraft 客户端；模型渲染不是发布门禁。
