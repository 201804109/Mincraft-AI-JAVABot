# Minecraft AI JavaBot

## Project Overview

Minecraft AI JavaBot 是一个基于 Mineflayer 的 Minecraft Java Edition 机器人原型。长期目标是让 AI Agent 通过受控的感知、导航和操作技能完成多步骤任务。

**Current implementation：** 三个正式 structured action（`navigate`、`place`、`break`）通过统一 Tool API、FIFO Action Queue、Validator 和 Executor 执行；底层已有基础移动、局部世界感知、持久化 World Map、实验性创造模式三维导航，以及单方块放置和破坏原型。当前代码中没有 LLM、自然语言理解、任务分解、Agent memory 或自主 Observe–Reason–Act 循环。

**Long-term goal：** 先稳定现有 Primitive Skills 和 Unified Tool API，再接入 LLM Agent，最后扩展探索、资源收集与自动建筑。

## Current Capabilities

### Bot Interface

- `mineflayer@^4.37.1`（锁文件为 `4.37.1`），Minecraft Java Edition `1.20.1`。
- 固定连接 `127.0.0.1:25565`，用户名 `CityRobot001`，`offline` authentication。
- `spawn` 后发送 `Hello!`，初始化 World Map、Scanner、World Sync、Movement、Flight、Navigation 和 Chat Listener。
- 记录 `login`、`kicked`、`error`；没有配置加载、重连或优雅关闭。

### Movement

- `forward`、`backward`、`left`、`right`、`jump`、`sneak` 基于 Mineflayer control states。
- 支持 yaw 和底层 `lookAt(position)`。
- `flight.flyTo()` 使用 `bot.creative.flyTo()`，仅接受整数 voxel，并转换为 `(x + 0.5, y, z + 0.5)`。
- `basic_movement.stop()` 可清除 control states，但没有对应命令；`navigation.stop()` 是空实现。

### Perception

- Scanner 遍历立方体范围内客户端已加载方块；`scan()` 同时返回 Bot 位置和实体快照。
- 启动立即扫描半径 16；每 2 秒检查位置，移动超过 8 格时再扫描半径 16；每 5 秒校正半径 8；每 5 分钟清理地图。
- Scanner 的定时任务错误会被记录并隔离，不会因单次扫描或清理失败而停止后续定时执行。
- `blockUpdate` 增量更新内存地图，但不立即持久化。

### World Map and Spatial Intelligence

- X/Z 按 16×16 chunk 索引；block 保存 `type`、`state`、`lastSeen`、`confidence`。
- `air`、`cave_air`、`void_air` 为 `AIR`，其余观测类型统一为 `SOLID`；缺失或过期为 `UNKNOWN`。
- confidence 从 1 在默认 30 分钟内线性衰减到 0；过期 block 在读取时移除。
- chunk 以紧凑 JSON 同步写入临时文件后原子替换到 `maps/chunks/<chunkX>_<chunkZ>.json`；单 chunk 成功保存后有 10 秒写入冷却，启动时加载 Bot 周围 128 格。
- chunk 保存、加载和删除错误会被记录并隔离，避免持久化失败直接导致 Bot 进程崩溃。
- 距 Bot 超过 512 格且超过有效期未观察或访问的 chunk 会从内存和磁盘删除。
- `data/world_map.json` 是旧版数据；当前 `storage.load()` 返回空对象，启动流程不会导入它。
- Spatial 使用 0.6×1.8 AABB、0.1 格扫掠采样和多轴中间位置检查；`UNKNOWN` 与 `SOLID` 均不可通过。

### Navigation

- A* 搜索 4 个水平、4 个水平对角和 2 个垂直邻居；欧氏 heuristic，对角代价 `√2`，其他为 1。
- 最大搜索距离 128 格，最多访问 100,000 节点。
- 规划前检查目标周围半径 8；`UNKNOWN` 超过 10% 时请求目标处半径 16 的 Scanner 扫描。
- 路径按方向及直线碰撞结果压缩，通过 creative flight 逐点执行；直线步长 0.5，waypoint threshold 1.5。
- 每 250 ms 轮询；5 秒无至少 0.05 格进展会失败，约 2 秒内移动不足 0.1 格判定 blocked。
- 路径失效会返回 `REPLAN_REQUIRED` 并维护最多 3 次计数，但 `navigation.navigateTo()` 不会重新调用 planner，真正的 replanning **尚未实现**。
- 定位为面向创造模式飞行的 **Experimental prototype**，不支持生存模式步行、重力、跳跃、落脚面或掉落风险。

### Block Manipulation and Items

- `reachability` 计算眼睛到方块 AABB 的最短距离，默认范围 5 格。
- 单方块放置检查空目标、六向支撑、身体重叠、距离和 0.1 格步进视线；必要时在 4 格内寻找有地面且身体空间为空的站位并导航。放置后等待 200 ms 验证名称。
- Item Manager 可计数和装备物品；若缺少物品且 creative inventory 可用，会向 hotbar slots 36–44 补充并最多等待 5 秒确认。
- 单方块破坏检查目标、reachability、身体重叠和视线；必要时寻找 4 格内站位并导航，调用 `bot.dig()` 后等待 200 ms 验证为空气。
- 连续操作、自动目标选择、材料收集、蓝图、build order、建筑规划和恢复均未实现。

## Commands

以下是 `src/chat/parser.js` 当前识别的全部命令。未知命令静默忽略；错误与结果只输出到控制台，不回复 Minecraft 聊天。

| Command | Example | Description |
| --- | --- | --- |
| `导航 <x> <y> <z>` | `导航 10 80 -5` | 实验性 A* + creative flight；目标按 voxel 向下取整 |
| `放置 <x> <y> <z> <方块名称>` | `放置 10 65 20 stone` | 生成 `place` action，在整数坐标放置一块 |
| `破坏 <x> <y> <z>` | `破坏 10 65 20` | 生成 `break` action，破坏整数坐标处方块 |

玩家聊天只暴露以上三个 Agent-level Tool。Movement、jump、turn、sneak 和 direct flight 仍作为内部底层能力保留，但不再是玩家命令。

## Architecture

```text
Minecraft Player ──► chat/listener.js ──► chat/parser.js
                                             │
                                             ├── navigate action
                                             ├── place action
                                             └── break action
Future AI Agent（planned）──► structured action ─┘
                                             ▼
                                     actions/tool_api.js
                                             ▼
                                  actions/action_queue.js（FIFO）
                                             ▼
                                     actions/executor.js
                                       ├──► validator / result
                                       └──► navigation / block skills / item manager

Minecraft loaded world ──► scanner ──► in-memory World Map ──► chunk storage
Minecraft blockUpdate ──► world_sync ────────────┘
                                                  ▼
                                      spatial ──► planner / path_follow
```

Parser 是不依赖 Bot 或 Skill 的纯文本解析器。玩家的 `navigate`、`place`、`break` 与未来 AI 产生的同类 structured action 都从 `runTool()` 开始，共用 FIFO Queue、Validator、Executor 和 Unified Result 边界。

## Repository Structure

```text
.
├── bot.js
├── config/navigation_config.js
├── src/
│   ├── actions/{tool_api,action_queue,executor,validator,result}.js
│   ├── chat/{listener,parser}.js
│   ├── perception/
│   │   ├── scanner.js
│   │   ├── map.js
│   │   ├── storage.js
│   │   ├── world_sync.js
│   │   └── spatial.js
│   └── skills/
│       ├── move/{basic_movement,coordinate,flight,planner,path_follow,navigation}.js
│       ├── block_manipulation/{reachability,block_place,block_break}.js
│       └── item/item_manager.js
├── maps/chunks/                 # 当前持久化 chunk
├── data/world_map.json          # 旧版数据，当前不加载
├── package.json
├── package-lock.json
└── README.md
```

## Implementation Details

### Bot Lifecycle

`bot.js` 在 `spawn` 时重置内存地图并调用兼容性的空 `storage.load()`，初始化扫描、事件同步和控制模块。实际 chunk 加载发生在 `scanner.start()`。

### Chat and Commands

Listener 忽略 Bot 自身消息但不授权发送者。Parser 只将三种精确中文命令转换为 structured action；Listener 再调用唯一公共入口 `runTool()`。玩家与未来外部调用者共用同一个 FIFO Queue、Validator、Executor 和 Unified Result contract。

### Movement

基础 control state 与 creative flight 模块仍供 Navigation 等内部 Skill 使用，但不再直接暴露为玩家聊天命令。Creative flight 没有模式/权限预检或可靠中断。

### Perception and World Map

Scanner 只查询 `bot.blockAt()`，不会加载远端 chunk；`scanAt()` 可能仍留下大量 `UNKNOWN`。地图是观测缓存：扫描会更新内存并按 chunk 持久化，World Sync 只更新内存。持久化采用临时文件替换、错误隔离和单 chunk 写入冷却，但写盘仍是同步 I/O。实体不持久化或跟踪。

### Navigation

Planner、Spatial、Path Follower 构成可运行的创造模式原型，但依赖已加载且未过期的地图。未知空间保守阻塞，active scan 只查询客户端已有数据，replanning 信号未闭环。

### Block Manipulation

Place/Break 是单目标 primitive，实时查询局部方块；安全站位移动依赖实验性导航。站位要求下方为非空气方块，与纯飞行导航语义不完全一致。支撑和碰撞按空气/非空气简化。

## Development Stage

| Layer | Status | Current scope |
| --- | --- | --- |
| Layer 1 — Bot Interface | Functional prototype | 固定连接、聊天入口、基础控制 |
| Layer 2 — Perception | Functional prototype | 局部扫描、事件同步、实体快照 |
| Layer 3 — Spatial Intelligence | Functional prototype | World Map、占用/扫掠、reachability，模型简化 |
| Layer 4 — Navigation | Experimental | A* 与执行存在；加载范围、取消、replanning 不完整 |
| Layer 5 — Primitive Actions | Partial / Experimental | 单方块 place/break 与 creative item acquisition |
| Layer 6 — Agent Layer | Planned | 已有 Unified Tool API；无 LLM、任务分解、memory、context |
| Layer 7 — High-Level Tasks | Planned | 无探索、采集、自主任务或建筑系统 |

项目准确处于 **Layer 5 的早期 Primitive Action prototype**：Layer 1–3 已有基础，Layer 4–5 仍实验性，尚不是 AI Agent。

## Current Progress

| Status | Module | Description |
| --- | --- | --- |
| Functional prototype | Connection / lifecycle | 固定本地离线服务器连接与模块初始化 |
| Functional prototype | Commands / Tool API | 三个中文命令、pure Parser、统一 Executor 和 FIFO Queue |
| Functional prototype | Perception / map | 扫描、事件同步、confidence、可靠 chunk 持久化 |
| Functional prototype | Spatial checks | AABB、扫掠、穿角检查，语义简化 |
| Experimental | Navigation | A*、压缩和跟随可运行；取消、远端地图、replanning 不完整 |
| Experimental | Single-block place / break | 包含站位、视线、导航和结果验证 |
| Partial | Item management | 计数、装备、creative hotbar 补物；非通用材料系统 |
| Planned | Agent Layer | 已有统一 Tool API 边界，但尚无 LLM、任务分解、memory 或 context |
| Planned | High-level tasks | 无多步骤执行、蓝图或自动建筑 |

## Known Limitations

- 连接、身份、版本与 offline auth 硬编码；`package.json` 缺少元数据、scripts 和 engine。
- 无 sender authorization；未知命令静默；结果不回传游戏聊天。
- 高层 Tool 使用单 Bot FIFO Queue，但没有 timeout 或可靠 cancellation；一个永久不结束的 Action 会阻塞后续队列。
- 导航依赖 loaded chunks；active scan 不加载远端数据；`REPLAN_REQUIRED` 不会真正重新规划。
- 非空气方块一律 `SOLID`，未处理流体、门、台阶、可穿越方块和真实 collision shapes；`UNKNOWN` 一律阻塞。
- 地图无 server/world/dimension 隔离；尽管已有临时文件替换、错误隔离和写入冷却，chunk 仍同步写盘，事件更新不立即保存，也没有数据库级事务。
- 实体只有快照；无跟踪、碰撞整合或查询接口。
- 导航只面向 creative flight；无 survival、重力、落脚、跳跃、坠落和危险模型。
- creative Item Manager 可能占用/覆盖非目标 hotbar；无生存获取、配方或材料预算。
- Place/Break 站位搜索依赖 loaded blocks，视线和实体碰撞简化。
- 无连续操作、自动目标、蓝图、建筑顺序、资源收集或多步骤恢复。
- 无测试、CI、结构化日志、重连、许可证和发布流程。
- 直接使用的 `vec3`、`prismarine-item` 仅由 Mineflayer 传递安装，未显式声明。

## Roadmap

### Phase 1 — Stabilize Primitive Skills

- 完成 navigation replanning、可靠 cancellation 和 Queue-level timeout。
- 加强现有 Unified Result 的错误分类、运行观测和恢复语义。
- 增加 sender authorization、游戏内反馈和自动化测试。
- 区分 loaded/unknown，使用真实 collision shapes，完善 survival inventory 与操作。

### Phase 2 — Agent Interface

在现有统一、可校验的 structured action/tool boundary 上接入 Agent；Agent 不直接操作 Mineflayer：

```json
{
  "action": "navigate",
  "position": { "x": 10, "y": 70, "z": 20 }
}
```

保持所有动作通过 `runTool()`、同一个 FIFO Queue 和受控 Executor，并在现有 `success`、`action`、`reason`、`data` contract 上扩展所需的 Agent 观测与恢复信息。

### Phase 3 — LLM Agent

接入自然语言、tool calling、context 和 memory，形成：

```text
Observe → Reason → Act → Observe
```

### Phase 4 — Multi-step Tasks

实现任务分解、步骤验证、取消和恢复，例如：

```text
navigate → place → verify
```

### Phase 5 — Building System

在 primitive 和 Agent loop 稳定后加入 blueprint、multi-block placement、build order、材料检查、安全站位规划、验证和恢复。

## Getting Started

1. 准备兼容 Minecraft Java Edition `1.20.1` 的本地服务器并允许 offline 账号。
2. 使用 flight 和自动补物时，确保 Bot 有创造模式能力。
3. 安装并启动：

```bash
npm install
node bot.js
```

当前没有 `npm start` script。修改连接参数需编辑 `bot.js`。

## License

仓库没有许可证文件；不应假定项目已按某种开源许可证发布。
