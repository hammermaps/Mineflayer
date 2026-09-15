# Mineflayer · 原生协议兼容与机器人运行库

为 Minecraft Java / Paper 原生协议兼容、机器人状态可靠性和插件自动化维护的 JavaScript 运行库。当前维护主线是 `26.2`。

**这是 zkonikishi 独立维护的 Mineflayer 派生版本，不是 PrismarineJS 官方发行版的镜像，也不是从零重写的独立协议栈。** 我们保留并扩展上游 API，选择性吸收更新，以自身兼容性测试和真实服务器验收为准。

## 与 Minecraft MCP Server 的关系

| 项目 | 负责什么 |
| --- | --- |
| **本仓库：Mineflayer** | 连接 Minecraft、解析协议、维护世界/实体/物品状态、执行玩家操作 |
| [Minecraft MCP Server](https://github.com/zkonikishi/Minecraft-MCP-Server/tree/26.2) | 将机器人能力封装为 AI 可调用的 MCP 工具，管理重连、插件测试流程和实验性图像输出 |

本库可以单独供 JavaScript 项目使用，不必搭配 MCP。本库**不提供 MCP 服务或图像识别**；MCP 中的 `get-bot-view` 是另一个仓库实现的简化结构图工具。

## 与上游的主要差异

| 领域 | 本维护版本的实现 |
| --- | --- |
| 原生 26.2 数据 | 提供并安装原生数据，适配 entity metadata / item component serializer；不以 ViaVersion 替代原生兼容 |
| 数据包与时钟 | 独立 attack 包、use_entity 字段、clockUpdates；按服务端注册表和维度默认时钟选择，不猜固定 ID |
| 队伍与计分板 | 兼容显示名、颜色、flags 等字段；修复队伍删除事件；每次登录清理旧状态，同时保留容器对象引用 |
| 背包与窗口 | 关闭窗口后的背包同步、窗口 ID 复用/缓存清理；窗口标题标准化为 ChatMessage |
| 手持物品 | 服务端指定快捷栏槽位不回发，主动选择时去重；拒绝非法槽位 |
| 生命周期与物理 | configuration 阶段停止 PLAY 物理包；按协议能力发送 player_loaded；丢弃卡顿后超出上限的物理积压 |
| 资源包协议 | UUID 保持线上的字符串表示；此项不是资源包渲染能力 |
| 玩家能力与诊断 | 暴露服务端授予的能力/速度；控制属性可枚举；登录前聊天返回明确错误 |
| 安装防护 | 安装器拒绝未知版本、未经审查的数据覆盖，防止静默破坏原生数据 |

这些差异以本维护版本和已审查的上游修订为比较基础，不表示官方永远没有相同修复。不能仅因为官方存在 `pc26_2` 分支，就用它覆盖本项目。

## 兼容性：按范围声明，不保证通吃

| 目标 | 状态 |
| --- | --- |
| Minecraft Java / Paper 26.2 | 当前原生维护重点，协议 776；已完成隔离服验证 |
| 旧版 Minecraft Java | 保留版本分派；历史矩阵验证过一组版本和基础操作，不代表所有历史版本、所有 API 均兼容 |
| 使用普通客户端协议的服务端插件 | 可通过通用聊天、GUI、物品、方块和实体操作进行交互；具体业务需验收 |
| 仅服务端模组 | 若允许普通客户端连接，可能使用通用能力；尚无完整模组兼容矩阵 |
| 要求客户端模组的 Fabric / Forge / NeoForge | 尚无专门的握手、扩展注册表和自定义通信适配，不声明支持 |
| 基岩版 | 不在当前范围 |

**读取到实体或物品数据不等于看见它的外观。** 本库不是完整 Minecraft 图形客户端，不负责纹理、GUI 画面、玩家皮肤、自定义模型或资源包渲染。玩家能力字段也不代表当前锁定的物理引擎已经支持完整创造飞行模拟。

## 安装与最小用法

要求 Node.js >=22。安装本维护分支，而不是 `npm install mineflayer` 对应的官方 npm 发行版：

```sh
npm install github:zkonikishi/Mineflayer#26.2
```

```js
const mineflayer = require('mineflayer')

const bot = mineflayer.createBot({
  host: '127.0.0.1',
  port: 29565,
  username: 'TestBot',
  auth: 'offline',
  version: '26.2'
})

bot.once('spawn', () => console.log('Robot spawned'))
bot.on('error', console.error)
bot.on('kicked', console.error)
```

`29565` 是测试端口示例，需先准备对应服务器。离线认证仅用于允许离线身份的服务器；正版服使用 Microsoft 认证，并妥善保管认证缓存。不要提交令牌、账号缓存或服务器凭据。

### 可复现部署与原生数据

- 发布部署应把分支引用换成经过验收的完整 commit SHA，并保留宿主项目 lockfile。
- 本库的 minecraft-protocol 依赖仍引用分支；**固定 Mineflayer SHA 不等于固定整个依赖树**。宿主需要同时审查数据、协议、区块与物理依赖，MCP 仓库中已有对应的锁定组合。
- 安装脚本会将随库提供的 26.2 数据写入已安装 minecraft-data 并生成索引。未经允许的版本或覆盖冲突会失败，不要绕过。
- 若 npm 未执行安装脚本，需要在本库目录明确运行 `node tools/install-minecraft-data-26.2.mjs`。不要跳过后宣称原生版本已可用。
- 升级上述底层依赖后必须重跑测试。不要在多个项目共享的依赖目录中盲目替换数据。

## 验证与开发

```sh
npm run lint
node tools/team-regression.js
node tools/window-sync-regression.js
node tools/resource-pack-regression.js
node tools/game-lifecycle-regression.js
node tools/time-regression.js
node tools/data-install-regression.mjs
node tools/native-test-server-regression.js
node tools/block-actions-regression.js
node tools/upstream-september-regression.js
```

这些定向回归与上游完整测试套件不是同一范围。`npm test` 的可执行范围还取决于本地测试文件是否齐全；不要通过恢复或提交别人的工作区删除来伪造完整验收。

| 验收记录 | 范围 |
| --- | --- |
| 2026-09-15 选择性更新 | 既有 22 个报告用例/断言与新增 14 项测试通过，lint 通过；候选版及 MCP 安装版 Paper 26.2-92 检查通过 |
| 2026-09-08 历史矩阵 | 28 版本内部测试：576 通过、40 不适用跳过、0 失败；27 个旧版实际服务端基础测试及原生 Paper 26.2 验证 |

验收是**按修订记录的历史事实**，不代表当前任意工作区、每个历史补丁版本或所有生产插件业务均已验证。模型渲染不是这些协议测试的结论。

- [2026-09-15 更新与已知限制](https://github.com/zkonikishi/Mineflayer/blob/26.2/docs/upstream-update-2026-09-15.md)
- [2026-09-13 更新审查](https://github.com/zkonikishi/Mineflayer/blob/26.2/docs/upstream-update-2026-09-13.md)
- [历史兼容验收](https://github.com/zkonikishi/Mineflayer/blob/26.2/docs/compatibility-2026-09-08.md)
- [API 参考](https://github.com/zkonikishi/Mineflayer/blob/26.2/docs/api.md)：沿用上游文档体系，具体行为以本分支代码及类型定义为准。

测试使用独立目录、空闲端口和测试账号；结束后正常退出机器人并向自己的服务器发送 `stop`。不要影响正式服或批量终止 Java 进程。

## 独立化方向（尚未完成）

我们希望把原生兼容能力整理成清晰的版本/功能边界，与 MCP 的独立工具层协作，并逐步为插件和模组建立专门适配。当前仍基于 Mineflayer/PrismarineJS，尚未实现完全独立协议栈或跨加载器通用客户端。

具体路线包括：减少业务代码与底层内部对象耦合、明确能力检测、拆分可复用兼容模块、补充适配器规范和测试矩阵。先保持可验证的原生兼容，再按需要替换底层；不为“独立”立即推倒重写所有协议。

## 文档维护与来源

`docs/README.md` 是本说明的受 Git 管理源文件；本地根目录 `README.md` 由发布流程复制生成，更新时保持两份一致。现有其他语言文档和示例主要沿用上游，仅作参考，不代表本分支的最新发布承诺。

本项目基于 [PrismarineJS/mineflayer](https://github.com/PrismarineJS/mineflayer)，保留 MIT 许可、原作者和贡献者归属；独立维护不会取消这些义务。见 [LICENSE](https://github.com/zkonikishi/Mineflayer/blob/26.2/LICENSE)。
