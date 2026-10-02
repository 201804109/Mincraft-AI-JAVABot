# Minecraft AI JavaBot

一个基于 Mineflayer 的 Minecraft Java Edition Bot 原型，提供局部世界感知、导航和结构化方块操作工具。

## Overview

JavaBot 连接 Minecraft Java 服务器，通过 Mineflayer 读取已加载的世界数据，并维护本地 Raw World Map。Surface Map 和 Area Analysis 从观测数据生成地表与区域摘要。

聊天指令由 DeepSeek 驱动的 AgentRuntime 处理。Agent 通过结构化 tools 查询世界、导航以及放置或破坏方块；动作经 AI Interface 校验并串行执行。

项目目前提供单方块和批量方块操作。批量接口负责连续处理多个目标，并在需要时使用单方块完整 API 寻找新的施工位置。完整建筑计划执行仍在开发中。

## Current Capabilities

| Capability | Status | Description |
| --- | --- | --- |
| Bot Connection | Functional | Mineflayer 连接本地 Java 服务器 |
| Perception | Functional prototype | 扫描附近已加载方块并跟踪 block updates |
| World Map | Functional prototype | Raw Map 持久化及 Surface / Area 分析 |
| Navigation | Experimental | 基于地图规划路径，当前面向 creative flight |
| Block Manipulation | Experimental | 单方块与批量放置、破坏 |
| Agent Tool Calling | Functional prototype | DeepSeek 通过结构化 tools 查询并执行动作 |
| Autonomous Building | In progress | build plan executor 尚未实现 |

批量操作会优先在当前位置连续处理目标；没有可继续处理的目标时，会尝试使用完整单方块接口导航。单个目标失败不会终止整个 batch，失败次数上限用于避免无限重试。

## Agent Tools

Agent 通过 registry 获取工具定义，并由 TaskRunner 过滤后发送给模型。每轮最多调用一个 tool；batch tool 的一次调用可以包含多个目标。

**Queries**

- `self.getPosition`
- `voxel.getBlock`
- `voxel.getVolume`
- `voxel.getSurroundings`
- `surface.getColumn`, `surface.getChunk`, `surface.getArea`
- `area.getAreaSummary`, `area.getAreaGrid`, `area.getRegions`

**Actions**

- `navigate`
- `place`
- `break`
- `batch_place`
- `batch_break`

## Architecture

```text
Minecraft Chat
      ↓
AgentRuntime
      ↓
DeepSeek
      ↓
Structured Tools
  ├── Queries ──► World / Surface / Area
  └── Actions ──► Navigation
                  Block Manipulation
                    ├── place / break
                    └── batch_place / batch_break
      ↓
Mineflayer
      ↓
Minecraft

Scanner / blockUpdate
      ↓
Raw World Map
      ↓
Surface / Area analysis
```

AgentRuntime 从 registry 中选择可用工具；ModelClient 负责模型 tool calling 和工具名映射；AI Interface 校验 action 并将动作加入串行队列。Perception 与 map analysis 为查询和导航提供已观测数据。

## Repository Structure

```text
.
├── bot.js
├── config/
├── src/
│   ├── agent/
│   ├── ai_interface/
│   ├── chat/
│   ├── perception/
│   ├── map_analysis/
│   └── skills/
│       ├── move/
│       ├── block_manipulation/
│       │   ├── block_place.js
│       │   ├── block_break.js
│       │   ├── block_batch.js
│       │   ├── block_batch_place.js
│       │   ├── block_batch_break.js
│       │   └── reachability.js
│       └── item/
├── maps/
├── package.json
└── README.md
```

## Getting Started

Requirements: Node.js, a Minecraft Java Edition `1.20.1` server, and an offline account accepted by that server.

```bash
npm install
node bot.js
```

The current connection defaults to `127.0.0.1:25565` and is configured in `bot.js`. Set `DEEPSEEK_API_KEY` in the environment to use the Agent. Navigation and automatic item acquisition currently depend on creative-mode capabilities.

Run the available checks with:

```bash
npm test
```

## Current Development

Current focus:

```text
build_plan.json
      ↓
build executor (not implemented)
      ↓
batch_place / batch_break
      ↓
Minecraft
```

The first building milestone is executing a deterministic build plan. AI-generated designs, a Blueprint Compiler, and survival resource planning are outside the current implementation.

## Key Limitations

- Navigation is experimental and currently targets creative-flight workflows.
- Perception only includes loaded or otherwise observed world data; it does not represent a complete world database.
- Batch operations reduce repeated tool calls and navigation, but do not perform advanced construction scheduling.
- There is no `build_plan.json` executor or complete autonomous building workflow yet.
- Block-state-aware placement is incomplete; stairs, doors, and slabs do not have reliable orientation handling.
- Creative inventory fallback may be needed to acquire placement materials; survival resource gathering and crafting are not implemented.
- Agent memory is short-term and in-memory; it is lost when the process exits.

## License

No license file is currently included in the repository.
