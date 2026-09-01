# Minecraft AI JavaBot

## Project Overview

Minecraft AI JavaBot 是一个基于 Mineflayer 的 Minecraft Java Edition 机器人原型。当前项目重点是建立可控、可验证的 Bot 接口：连接游戏、采集局部世界数据、维护持久化地图、分析地表、规划创造模式飞行路径，并通过结构化 Tool API 串行执行导航、放置和破坏动作。

项目目前处于 **Primitive Skills 与 World Understanding 原型阶段**，不是完整 AI Agent。代码中尚无 LLM 调用、Agent loop、长期或情景 memory、任务规划、自然语言理解或自主 Observe–Reason–Act 循环。聊天解析器只是三条固定中文命令的语法转换层。

长期目标是在导航、世界模型、结构化工具和动作恢复机制稳定后接入 Agent，再逐步实现多步骤任务、资源处理和自主建筑。高层能力应建立在可校验的 Tool API 上，而不是让模型直接调用 Mineflayer。

## Status Legend

- **Functional**：代码路径已接通，可在目标环境中使用，但不代表生产级可靠性。
- **Experimental**：已有可运行实现，仍受模式、地图完整度或恢复能力等明显限制。
- **Planned**：当前仓库没有对应实现。

## Current Capabilities

### Bot Connection — Functional

**Implemented**

- 使用 `mineflayer@^4.37.1` 连接 Minecraft Java Edition `1.20.1`。
- 监听 `login`、`spawn`、`kicked` 和 `error`；spawn 后发送 `Hello!` 并初始化各模块。

**Technical implementation**

- `bot.js` 在 spawn 时初始化 Raw World Map、Surface Map、Scanner、World Sync、Movement、Flight、Navigation 和 Chat Listener。
- 连接固定为 `127.0.0.1:25565`、`CityRobot001`、offline auth。

**Limitations**

- 没有配置加载、重连、优雅关闭、server/world/dimension 隔离或 sender authorization。

### Movement — Functional low-level primitives

**Implemented**

- 前后左右、跳跃、潜行、停止、按 yaw 转向和 `lookAt`。
- 创造模式 `flyTo()`，将整数 voxel 坐标转换到方块中心的 world position。

**Technical implementation**

- 基础移动使用 Mineflayer control states；飞行使用 `bot.creative.flyTo()`。

**Limitations**

- 基础移动没有作为聊天 Tool 暴露，也没有组合步行控制器。
- 飞行要求创造模式能力；没有模式/权限预检，`navigation.stop()` 也未实现有效取消。

### Perception — Functional prototype

**Implemented**

- 扫描 Bot 周围立方体范围内的已加载方块，并返回当前位置和实体快照。
- 初始半径 16 扫描；每 2 秒检查位移，移动超过 8 格后重扫；每 5 秒进行半径 8 校正；每 5 分钟清理地图。
- 监听 Mineflayer `blockUpdate`，增量更新内存地图。

**Technical implementation**

- Scanner 对坐标逐点调用 `bot.blockAt()`；定时任务有错误隔离。
- `scanAt()` 可请求指定区域，但仍只能读取客户端已经加载的数据。

**Limitations**

- 扫描不会主动加载远端 chunk，且立方体逐 voxel 扫描成本较高。
- 实体只存在于单次 `scan()` 返回值中，没有持久化、跟踪、空间索引或 Tool 查询接口。
- `blockUpdate` 不立即触发 Raw Map 写盘，但会通过地图事件更新派生 Surface Map。

### Raw World Representation — Functional prototype

**Implemented**

- 以 X/Z 方向 16×16 chunk 组织方块观测，保存 `type`、`state`、`lastSeen` 和动态 `confidence`。
- 三种 air 类型记为 `AIR`；其他方块记为 `SOLID`；缺失或过期数据为 `UNKNOWN`。
- 默认 30 分钟线性置信度衰减；远于 512 格且过期的 chunk 会从内存和磁盘清理。
- 启动时加载 Bot 周围 128 格的 chunk 文件。

**Technical implementation**

- Raw chunk 保存到 `maps/chunks/`，使用临时文件后 rename；单 chunk 保存有 10 秒冷却，存储错误不会直接终止进程。

**Limitations**

- 这是观测缓存，不是完整世界数据库；未区分流体、门、台阶、植物或真实 collision shape。
- 同步文件 I/O；无 schema version、数据库事务和 world/dimension namespace。
- `data/world_map.json` 是旧格式遗留数据，当前启动流程不会导入。

### Surface Map and Area Analysis — Functional read-only queries

**Implemented**

- 从 Raw World Map 为每个 X/Z column 派生最高非空气方块，并持久化到 `maps/surface/`。
- Raw block/chunk 更新会标记 column dirty；100 ms 合并 column 更新、250 ms 合并 surface chunk 保存。
- 可按矩形 bounds 加载内存或磁盘中的 Surface Map，构建可配置分辨率的 Area Grid。
- Area Analyzer 计算覆盖率、未知/空 column、主导方块、方块计数、高度范围/平均值/众数，并按相邻同类主导方块聚合 region。

**Technical implementation**

- `src/map_analysis/surface/` 负责 column 分析、派生地图和 format version 2 的紧凑 chunk 存储。
- `src/map_analysis/area/` 负责跨 chunk 加载、栅格聚合和 region 连通分析。

**Limitations**

- Surface 与 Area API 已接入 AI Interface Query，但没有接入聊天命令、Navigation 或 LLM Agent。
- “地表”仅表示已观测 column 中最高的非空气方块，不能识别洞穴、建筑语义、生物群系、危险、可通行性或对象。
- 覆盖率取决于 Raw Map 的局部观测；unknown 不会被推断补全。

### Raw World Queries — Functional read-only prototype

**Implemented**

- `voxel.getBlock` 查询单个已观测 voxel。
- `voxel.getVolume` 查询三维 bounds，返回已知非空气方块并统计 unknown、air 和 coverage。
- `voxel.getSurroundings` 根据 Bot 当前整数 voxel 位置查询局部三维环境。

**Technical implementation**

- `src/perception/api.js` 只读取现有 Raw World Map，不调用 Scanner，也不保存地图。
- 单次 Volume 最多查询 32,768 个 voxel；air 只计数，不进入 `blocks` 数组。

**Limitations**

- 只能读取内存 Raw Map 中当前已观测且未过期的数据，不会按请求主动加载或扫描 Minecraft。
- 不提供方块语义、结构识别、实体观察、通行性分析或路径规划。

### Spatial Checks — Functional prototype

**Implemented**

- 使用 0.6×1.8 Bot AABB 判断占用空间。
- 以 0.1 格间隔进行扫掠采样，并检查多轴移动的中间组合以避免简单穿角。

**Technical implementation**

- `spatial.canOccupy()` 和 `spatial.canMove()` 查询 Raw World Map；任何非 `AIR` 状态均阻塞。

**Limitations**

- `UNKNOWN` 保守地视为不可通行；碰撞模型未使用 Minecraft 真实方块形状。
- 没有地面支撑、重力、落差、流体、伤害或实体碰撞模型。

### Navigation — Experimental

**Implemented**

- A* 搜索 4 个水平、4 个水平对角和 2 个垂直邻居。
- 欧氏 heuristic；水平对角代价为 `sqrt(2)`，其他邻居代价为 1。
- 最大搜索距离 128 格、最多访问 100,000 节点。
- 规划前检查目标周围半径 8 的 unknown ratio；超过 10% 时尝试目标处半径 16 扫描。
- 路径按方向和直线碰撞结果压缩，再使用 creative flight 逐 waypoint 执行。
- 执行时检查路径变化、移动进展和 blocked 状态。

**Technical implementation**

- `planner.js` 负责 A*；`path_follow.js` 负责压缩、碰撞复查、进展监控和飞行；`navigation.js` 负责地图准备和组合调用。

**Limitations**

- 仅适合创造模式三维飞行，不支持生存模式步行、跳跃、重力、落脚面和掉落风险。
- 主动扫描不能加载远端 chunk；unknown 比例过高时导航直接失败。
- 路径失效会返回 `REPLAN_REQUIRED` 并记录最多 3 次请求，但上层没有重新调用 planner，真正 replanning 尚未闭环。
- Queue 没有 timeout；底层飞行取消不可靠。

### AI Interface, Action Queue and Queries — Functional prototype

**Implemented**

- 三种 structured action：`navigate`、`place`、`break`。
- Validator 检查 action、有限坐标、place/break 的整数坐标及 place 方块名称。
- Surface、Area 与 Raw Voxel 只读查询通过同一 AI Interface 分发。
- AI 输入统一为 `{ type, name, parameters }`；返回统一为 `{ success, type, name, reason, data }`。
- Action 进入进程内 FIFO Promise Queue；Query 直接执行，不进入动作队列。

**Technical implementation**

- 统一入口为 `src/ai_interface/index.js` 的 `handle()`。
- Action 由 `ai_interface/actions/` 执行，Query 由 `ai_interface/queries/` 调用 Surface、Area 或 Perception API。
- Queue 会把执行异常转换为失败结果，并保证单次 rejection 不破坏后续队列链。

**Limitations**

- Interface 集合固定且较小；没有正式 schema、版本、优先级、timeout、取消、重试、幂等键或持久化队列。
- 一个永久不结束的动作会阻塞其后的所有动作。
- 执行结果只写控制台，不回复 Minecraft 聊天。

### Block Manipulation — Experimental

**Implemented**

- 单方块放置：检查空目标、六向支撑、身体重叠、距离和视线；必要时搜索半径 4 内安全站位并导航；操作后验证方块名称。
- 单方块破坏：检查目标、身体重叠、reachability 和视线；必要时搜索安全站位并导航；`bot.dig()` 后验证目标为空气。

**Technical implementation**

- 交互距离基于眼睛到方块 AABB 的最短距离，默认最大 5 格；视线以 0.1 格采样。

**Limitations**

- 仅支持显式坐标的单方块动作；支撑、空气和碰撞判断是简化模型。
- 安全站位要求脚下为非空气方块，与 creative-flight 导航语义并不完全一致。
- 没有工具选择、挖掘成本、掉落处理、连续操作、build order、蓝图或失败恢复。

### Item Handling — Experimental / creative-only fallback

**Implemented**

- 统计物品数量、检查库存并装备指定物品。
- 缺少物品时，如果 creative inventory 可用，则向 slots 36–44 补充物品并等待最多 5 秒确认。

**Technical implementation**

- 支持普通 registry name 和 `minecraft:` 前缀；优先复用同类 stack、空 hotbar，最后使用已占用 hotbar。

**Limitations**

- 没有生存模式采集、容器、合成、材料预算或库存规划。
- creative fallback 可能覆盖无关 hotbar slot；`prismarine-item` 和 `vec3` 是 Mineflayer 的传递依赖，未在 `package.json` 显式声明。

## Commands

`src/chat/parser.js` 当前只识别以下命令。未知命令静默忽略；参数错误或执行结果只输出到控制台。

| Command | Example | Behavior |
| --- | --- | --- |
| `导航 <x> <y> <z>` | `导航 10 80 -5` | 创建 `navigate` action；允许有限数值，planner 最终向下取整到 voxel |
| `放置 <x> <y> <z> <方块名称>` | `放置 10 65 20 stone` | 创建整数坐标的单方块 `place` action |
| `破坏 <x> <y> <z>` | `破坏 10 65 20` | 创建整数坐标的单方块 `break` action |

## Architecture

```text
Minecraft server
  ├─ chat ──► listener ──► fixed-command parser ──┐
  │                                               ▼
  │                Future Agent (planned) ──► AI Interface
  │                                      { type, name, parameters }
  │                                      ├─ action ──► FIFO Queue
  │                                      │              ▼
  │                                      │       Validator + Executor
  │                                      │       ├─ Navigation
  │                                      │       ├─ Block Place/Break
  │                                      │       └─ Item Manager
  │                                      └─ query ──► Voxel/Surface/Area API
  │
  ├─ loaded blocks ──► Scanner ───────────────┐
  └─ blockUpdate ────► World Sync ────────────┤
                                                  ▼
                                      Raw World Map (in memory)
                                        ├─► maps/chunks/
                                        ├─► Spatial checks ──► A* / Path Follower
                                        └─► Surface Map ──► maps/surface/
                                                              │
                                                              ▼
                                                    Area Grid / Regions
```

### Runtime data flow

1. Spawn 初始化地图与订阅关系，然后加载附近 Raw Map 和所有已保存 Surface Map chunk。
2. Scanner 与 `blockUpdate` 写入 Raw World Map。
3. Raw Map 事件将对应 Surface column/chunk 标记为 dirty，合并重算并持久化。
4. 导航读取 Raw Map；Surface/Area Query 读取持久化二维投影与区域摘要，二者没有语义集成。
5. 聊天 Parser 将命令转换为统一 Action 请求；未来 Agent 可通过同一入口提交 Action 或 Query。

## Repository Structure

```text
.
├── bot.js
├── config/navigation_config.js
├── src/
│   ├── ai_interface/
│   │   ├── index.js
│   │   ├── result.js
│   │   ├── actions/{action_queue,executor,validator}.js
│   │   └── queries/executor.js
│   ├── chat/{listener,parser}.js
│   ├── perception/{scanner,map,storage,world_sync,spatial,api}.js
│   ├── map_analysis/
│   │   ├── surface/{analyzer,map,storage,api}.js
│   │   └── area/{area_loader,area_grid,area_analyzer,api}.js
│   └── skills/
│       ├── move/{basic_movement,coordinate,flight,planner,path_follow,navigation}.js
│       ├── block_manipulation/{reachability,block_place,block_break}.js
│       └── item/item_manager.js
├── maps/chunks/                 # Raw World Map runtime data
├── maps/surface/                # Derived Surface Map runtime data
├── data/world_map.json          # Legacy data; not loaded by current startup
├── package.json
├── package-lock.json
├── README.md
└── CHANGELOG.md
```

`maps/` 和 `data/` 中的 JSON 是运行/遗留数据，不是执行模块。

## Current Progress

| Layer | Status | Actual scope |
| --- | --- | --- |
| Layer 1 — Bot Interface | Functional | 固定本地连接、生命周期、聊天入口、底层控制 |
| Layer 2 — Perception | Functional prototype | 局部方块扫描、blockUpdate 同步、实体快照 |
| Layer 3 — World Representation | Functional prototype | 分 chunk Raw Map、置信度、持久化、派生 Surface Map |
| Layer 4 — Spatial / World Understanding | Partial | AABB/扫掠检查、地表栅格统计和 region 聚合；无语义对象或危险模型 |
| Layer 5 — Navigation | Experimental | A*、路径压缩和 creative flight 可运行；远端感知、取消、replanning 不完整 |
| Layer 6 — Primitive Skills / Interface | Experimental | 统一 Action/Query 入口、FIFO actions、只读 world queries、单方块操作 |
| Layer 7 — Agent Layer | Planned | 无 LLM、Agent loop、memory、planning 或 tool-selection loop |
| Layer 8 — High-Level Tasks | Planned | 无多步骤任务、探索、采集、蓝图或自主建筑 |

当前最准确的定位是：**Layer 1–3 已形成可工作的原型，Layer 4–6 有局部实现但仍实验性，Layer 7–8 尚未开始。**

## Roadmap

### 1. Navigation completion

- 闭环实现 `REPLAN_REQUIRED`：重新扫描、重新规划、限制总尝试次数并保留失败上下文。
- 实现 Queue/Action timeout、可靠 cancellation 和飞行停止。
- 区分 creative flight 与 survival walking；加入落脚面、跳跃、重力、跌落、流体和危险成本。
- 改善 loaded/unknown 管理，避免把远端未加载数据误当作确定不可达。

### 2. World understanding

- 将 Raw Map、Surface Map、Area Grid 的 coverage 与 freshness 统一暴露为查询接口。
- 引入真实 collision shapes、可通行方块类别、流体和动态实体占用。
- 在地表统计之上增加可验证的地形/区域标签；保留 unknown，不用推断替代观测。
- 为地图增加 server/world/dimension namespace、格式迁移和异步存储策略。

### 3. Structured tools

- 为 Tool 定义明确 schema、版本、错误分类、timeout、取消、重试和观测结果。
- 扩展只读 observation tools，并增加 inventory、move、interact 等受控工具。
- 增加游戏内结果反馈、sender authorization、结构化日志和自动化测试。

### 4. Agent integration

- 在 Tool API 稳定后接入 LLM tool calling；Agent 只能通过受控工具读取和改变世界。
- 定义短期 task context、可审计 observation 和明确停止条件。
- 在实现前保持 Agent、memory、planning 状态为 Planned。

### 5. Multi-step task execution

- 实现任务步骤状态、前置条件、逐步验证、失败补偿、取消和恢复。
- 首批组合任务限定为 `observe → navigate → place/break → verify`。
- 之后再加入资源收集、容器和合成；不把固定脚本描述为通用自主能力。

### 6. Autonomous building

- 在 primitives 与多步骤执行稳定后加入 blueprint parsing、坐标变换和 build order。
- 实现材料预算、安全站位规划、批量放置、局部重规划、结构验证和断点恢复。
- 自主设计、开放世界选址与长期建造仍属于更后期目标。

## Getting Started

1. 准备兼容 Minecraft Java Edition `1.20.1` 的本地服务器，并允许 offline 账号。
2. 使用当前导航和自动补物功能时，确保 Bot 具有创造模式能力。
3. 安装并启动：

```bash
npm install
node bot.js
```

当前没有 `npm start` script。修改连接参数需要编辑 `bot.js`。

## Remaining Project Limitations

- 只有基础 Voxel Query 测试；没有完整单元/集成测试、CI、结构化日志、配置系统、重连和发布流程。
- `package.json` 只有 Mineflayer dependency，没有 scripts、engines 或项目元数据。
- AI Interface 不是网络 API；它只是当前 Node.js 进程内的函数边界。
- Voxel、Surface 和 Area 查询已经接入 AI Interface，但尚未接入 LLM Agent 或 Navigation。
- 项目没有 LLM、Agent loop、memory、任务规划、多步骤执行或自主建筑实现。

## License

仓库没有许可证文件；不应假定项目已按某种开源许可证发布。
