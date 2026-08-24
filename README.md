# Minecraft AI JavaBot

## Project Overview

Minecraft AI JavaBot 是一个基于 [Mineflayer](https://github.com/PrismarineJS/mineflayer) 的 Minecraft 机器人原型。项目目标是通过 AI Agent 控制 Minecraft 中的机器人，实现自然语言指令驱动的游戏操作。

当前版本已完成 Bot 接入、聊天命令解析、基础动作控制、局部世界感知、分块地图持久化，以及面向创造模式飞行的实验性路径规划与执行。现阶段的“指令解析”是基于固定中文命令的规则解析器，尚未接入大语言模型或外部 AI Agent；建筑生成也尚未实现。

## Features

### 已实现

- **Minecraft Bot 登录与连接**：使用 Mineflayer 以离线账号连接本机 `127.0.0.1:25565`，固定协议版本为 Minecraft Java Edition `1.20.1`。
- **基础身份设置**：Bot 使用固定用户名 `CityRobot001`，并忽略自己发送的聊天消息。当前没有多机器人、权限或动态身份管理。
- **聊天命令监听与解析**：监听服务器聊天，解析固定格式的中文命令，并对坐标、角度和持续时间进行基本校验。
- **基础移动控制**：支持前进、后退、左移、右移、跳跃和潜行。实现基于 Mineflayer `setControlState`，并非操作系统级键盘模拟。
- **视角控制**：支持按角度设置 yaw；底层模块也提供朝指定坐标观察的能力。
- **创造模式坐标飞行**：通过 `bot.creative.flyTo()` 飞往整数 voxel 坐标对应的方块中心。服务器必须允许 Bot 使用创造模式飞行。
- **位置、实体与方块扫描**：可读取 Bot 当前坐标、附近实体，以及指定立方体范围内 Mineflayer 已加载的方块。
- **分块世界地图**：以 16×16 的 X/Z chunk 索引保存方块类型、`AIR`/`SOLID`/`UNKNOWN` 状态、最后观测时间和置信度。
- **地图增量同步**：监听 `blockUpdate` 事件，将运行期间发生的方块变化写入内存地图。
- **地图持久化与过期清理**：地图按 chunk 写入 `maps/chunks/`；启动时加载 Bot 附近分块，并清理远距离、长期未使用的分块。
- **空间碰撞检查**：按 0.6×1.8 的机器人包围体检查目标占用、移动扫掠、头部碰撞和斜向穿角。
- **主动多射线视觉扫描**：Bot 可转向指定坐标，再扫描该方向前方 120°×20°、5 格以内的可见方块，并按坐标去重。
- **单方块自主放置**：可通过聊天命令在指定整数坐标放置背包中的一个方块，包含支撑面、碰撞、站位、导航和结果验证。
- **实验性三维导航**：使用 A* 搜索水平、对角和垂直邻居，执行路径压缩、路径跟随、阻塞检测，并在路径变化时请求有限次数的重规划。

## Commands

| 命令 | 示例 | 行为 |
| --- | --- | --- |
| `移动 <秒>` | `移动 2` | 向前移动 2 秒 |
| `后退 <秒>` | `后退 1` | 向后移动 1 秒 |
| `左移 <秒>` | `左移 1` | 向左移动 1 秒 |
| `右移 <秒>` | `右移 1` | 向右移动 1 秒 |
| `潜行 <秒>` | `潜行 2` | 保持潜行 2 秒 |
| `跳跃` | `跳跃` | 短暂触发跳跃控制 |
| `转向 <角度>` | `转向 90` | 将 yaw 设置为 90° |
| `飞到 <x> <y> <z>` | `飞到 10 80 -5` | 创造模式直飞至整数 voxel 坐标 |
| `导航 <x> <y> <z>` | `导航 10 80 -5` | 规划并跟随三维飞行路径 |
| `看 <x> <y> <z>` | `看 20 65 30` | 转向目标方块中心并扫描该方向视野内的可见方块 |
| `放置 <x> <y> <z> <方块名称>` | `放置 10 65 20 stone` | 在指定坐标放置一个方块 |

未知命令目前会被静默忽略。`飞到` 的底层执行仅接受整数坐标；聊天解析器虽然接受数值，但小数最终会被飞行模块拒绝。

## Architecture

```text
Minecraft 玩家聊天
        │
        ▼
chat/listener.js ── 过滤 Bot 自身消息、捕获执行异常
        │
        ▼
chat/parser.js ──── 固定中文命令解析与参数校验
        │
        ├──► basic_movement.js ── Mineflayer control states / look
        │
        ├──► flight.js ────────── creative.flyTo()
        │
        ├──► inspect.js ───────── lookAt(block center) → wait 300ms → vision.scanView()
        │
        ├──► navigation.js
        │        │
        │        ├──► scanner.js / map.js / storage.js
        │        │       ▲
        │        │       └── world_sync.js（blockUpdate）
        │        │
        │        ├──► planner.js ───── A* + spatial.js 碰撞检查
        │        │
        │        └──► path_follow.js ─ 路径压缩、飞行执行、阻塞与重规划检测
        │
        └──► place action → executor.js → block_place.js → Mineflayer placeBlock()
```

当前没有独立的 AI 服务层。命令来源是 Minecraft 聊天；现有移动和观察命令仍由解析器直接调用控制模块，`place` 结构化 action 则由 `executor.js` 调用放置技能。

## Implementation Details

### 入口与连接

- `bot.js`：创建 Mineflayer Bot，处理 `login`、`spawn`、`kicked` 和 `error` 事件；在出生后初始化地图、扫描器、世界同步、移动模块和聊天监听器。
- 连接参数目前直接写在代码中：`127.0.0.1:25565`、离线认证、用户名 `CityRobot001`、版本 `1.20.1`。
- Bot 出生后会在聊天中发送 `Hello!`。

### 聊天与控制

- `src/chat/listener.js`：监听聊天消息并将消息交给解析器。
- `src/chat/parser.js`：实现固定命令路由与基础参数校验。
- `src/skills/move/basic_movement.js`：封装控制状态、跳跃、潜行、停止和视角操作。
- `src/skills/move/flight.js`：将整数 voxel 坐标转换为方块中心 world 坐标并调用创造模式飞行 API。
- `src/skills/move/coordinate.js`：提供 world 坐标与 voxel 坐标之间的转换。

### Perception

- `src/perception/scanner.js`：扫描 Bot 周围或指定坐标附近的已加载方块；常规扫描在移动超过 8 格时触发，并每 5 秒校正近场地图。
- `src/perception/vision.js`：Vision Scan 模块，内部同时负责 0.1 格步进的单射线检测、FOV 射线生成和可见方块汇总，不再维护独立 raycast 模块。根据 Bot 转向后的 yaw/pitch 生成默认 120° 水平、60° 垂直视野内的多条射线，以 10° 为角度步长扫描 5 格以内的可见方块，并使用坐标键去重。
- **Vision Scan**：
  - Supports active observation toward specified coordinates.
  - Rotates Bot view before scanning.
  - Performs multi-ray field-of-view detection.
  - Returns visible blocks within 5 blocks.
- `src/perception/map.js`：维护 chunk 化的内存地图和方块置信度；未知或过期方块按 `UNKNOWN` 处理。
- `src/perception/storage.js`：同步读写 `maps/chunks/<chunkX>_<chunkZ>.json`。`data/world_map.json` 是旧版单文件地图数据，当前启动流程不再加载它。
- `src/perception/world_sync.js`：通过 Mineflayer `blockUpdate` 事件更新内存地图。事件更新目前不会立即持久化，后续扫描覆盖相应 chunk 时才会保存。
- `src/perception/spatial.js`：基于机器人包围体和地图状态进行占用及移动碰撞检查。出于安全考虑，`UNKNOWN` 与实体方块一样会阻止规划通过。

### 导航

- `src/skills/move/planner.js`：A* 路径规划器；默认最大搜索距离 128 格、最大访问 100,000 个节点。
- `src/skills/move/path_follow.js`：压缩连续路径点，调用飞行模块执行，并检测路径变化、长时间无进展和运动阻塞。
- `src/skills/move/navigation.js`：在规划前检查目标附近地图覆盖率；未知比例高于 10% 时尝试主动扫描，并将规划结果交给路径跟随器。
- `config/navigation_config.js`：集中保存搜索上限和 waypoint 到达阈值。

### Block Manipulation

- `src/skills/block_manipulation/reachability.js`：从 Bot 眼睛位置计算到方块包围盒的最短距离，并按默认 5 格创造模式交互距离判断目标是否可达。
- `src/skills/block_manipulation/inspect.js`：将目标 voxel 坐标转换为方块中心，调用 `bot.lookAt()` 转向，等待 300ms 后执行 Vision Scan 并返回去重后的可见方块集合；不会自动选择目标。
- `src/skills/block_manipulation/block_place.js`：实现第一版单方块自主放置，检查目标、六向支撑方块、玩家碰撞、交互距离和视线；需要时复用现有导航寻找安全站位，然后装备方块、执行放置并验证结果。
- 用户可以通过 `放置 x y z 方块名称` 聊天命令调用单方块自主放置能力。
- 方块破坏、连续放置、自动建筑、蓝图系统、自动材料收集和自动目标选择仍未实现。

### Repository Layout

```text
.
├── bot.js                         # 程序入口与 Bot 生命周期
├── config/
│   └── navigation_config.js       # 导航参数
├── src/
│   ├── chat/                      # 聊天监听、规则命令解析与 action 执行
│   ├── perception/                # 扫描、视觉、地图与空间感知；单射线算法内聚于 vision.js
│   └── skills/
│       ├── move/                  # 基础移动、飞行、规划与路径执行
│       └── block_manipulation/    # 观察、交互距离与第一版单方块放置
├── maps/chunks/                   # 当前使用的分块地图数据
├── data/world_map.json            # 旧版单文件地图数据
├── package.json
└── README.md
```

## Current Progress

| 状态 | 模块 | 说明 |
| --- | --- | --- |
| 已完成 | Bot 基础连接与生命周期 | 可连接固定的本地离线服务器并完成模块初始化 |
| 已完成 | 规则命令与基础动作 | 固定中文命令可驱动移动、跳跃、潜行和转向 |
| 已完成 | 局部感知与分块地图 | 支持扫描、增量更新、置信度和按 chunk 持久化 |
| 已完成 | 基础空间碰撞模型 | 支持包围体、扫掠和斜向穿角检查 |
| 部分完成 | 创造模式飞行 | 可直飞整数坐标，但没有飞行模式开关、权限检测或统一取消机制 |
| 部分完成 | 自动导航 | 已有 A*、路径跟随和重规划信号；依赖目标区域已被客户端加载，远距离主动扫描不保证取得方块数据 |
| 部分完成 | 玩家/实体感知 | 扫描结果包含实体和 Bot 位置，但没有持续跟踪、查询接口或身份管理层 |
| 部分完成 | 地图同步 | 方块事件更新内存地图，但未立即保存对应 chunk，也没有维度/世界标识 |
| 部分完成 | Block Manipulation 基础能力 | 已实现视觉观察、基础交互距离判断和单方块自主放置；方块破坏与连续建筑尚未实现 |
| 部分完成 | Vision Scan | 机器人可以主动转向目标方向，并获取该方向 120°×20° 视野内、5 格以内的可见方块 |
| 计划开发 | AI Agent 接入 | 尚无 LLM、工具调用协议、上下文管理或自然语言语义解析 |
| 计划开发 | 建筑生成 | 仓库中尚无蓝图、方块放置、材料管理或建筑规划模块 |

## Future Work

- 将服务器地址、端口、用户名、认证模式和版本移入配置文件或环境变量。
- 接入 AI Agent，将自然语言转换为受校验的结构化技能调用，并增加权限与安全边界。
- 为命令执行增加玩家反馈、未知命令提示、并发控制、取消和超时机制。
- 改进导航地图获取：区分未加载与真实空气，避免对远端未加载区域执行无效扫描。
- 为导航加入落脚面、重力、生存模式和可行走路径语义；当前算法主要面向创造模式三维飞行。
- 让 `blockUpdate` 增量同步按需持久化，并按服务器、维度或世界隔离地图。
- 实现可验证的建筑蓝图、选址、材料与方块放置流程。
- 添加自动化测试、日志系统、启动脚本、断线重连与优雅退出。
- 补充 `package.json` 项目元数据，并将代码直接使用的 `vec3` 声明为显式依赖，而不是依赖 Mineflayer 的传递依赖。

## Development Environment

| 项目 | 当前配置 |
| --- | --- |
| Minecraft | Java Edition 1.20.1 |
| Server | 本机 `127.0.0.1:25565`；离线认证。具体服务端实现（Vanilla/Paper/Spigot 等）未在仓库中记录 |
| Runtime | Node.js（CommonJS）；仓库未声明最低 Node.js 版本 |
| Language | JavaScript |
| Main dependency | `mineflayer@^4.37.1`（锁文件当前解析为 4.37.1） |
| Coordinate utility | `vec3@0.1.10`，当前由 Mineflayer 间接安装 |
| Storage | 本地 JSON chunk 文件 |

## Getting Started

1. 准备一个兼容 Minecraft Java Edition 1.20.1 的本地服务器，并允许离线账号加入。
2. 确保 Bot 需要使用飞行相关命令时具备创造模式能力。
3. 安装依赖并启动：

```bash
npm install
node bot.js
```

如服务器地址、端口、用户名或版本不同，请先修改 `bot.js` 中的连接配置。当前项目没有 `npm start` 脚本。

## Known Limitations

- 服务器连接信息和 Bot 身份均为硬编码。
- 规则解析器只识别精确的中文命令，不理解自由形式自然语言。
- 没有对命令发送者做授权，任意可发聊天消息的玩家都可能控制 Bot。
- 命令串行化尚未实现；多个聊天命令可能并发操作同一个 Bot。
- 导航取消函数仍为空实现，部分失败路径也不会主动停止正在进行的底层飞行。
- 地图将所有非空气方块统一视为 `SOLID`，尚未处理水、熔岩、可穿过方块、门或动态碰撞形状。
- 当前没有测试套件、CI、许可证和正式发布流程。

## License

仓库目前尚未提供许可证文件。在添加许可证前，不应假定项目已经以某种开源许可证发布。
