# README Update Summary

## Session Memory MVP — 2026-09-05

- 新增纯内存 SessionMemory，默认保留最近 10 个完整 Turn，支持深拷贝快照和 clear。
- Runtime 使用 Session 快照创建 Task，串行化整个请求与提交过程；Tool 失败 Result 也记录，模型错误不污染历史。
- ModelClient 保存规范化 assistant 消息、原始 Tool arguments 和存在时的 reasoning_content。
- bot.js 注入单一共享 Session；仍仅支持 navigate/place/break，每轮一次模型请求、最多一次工具执行。
- 新增 6 项 node:test 模拟测试，覆盖文本/工具历史、裁剪、失败和并发；未进行真实服务器集成测试。

以下为此前 README 更新记录，描述当时状态。

## Added

- 记录 Surface Map、Area Grid、区域分析和 `maps/surface/` 持久化实现。
- 为每类能力补充实现方式、状态与当前限制。
- 增加 Functional / Experimental / Planned 状态定义和实际运行数据流。

## Changed

- 将项目阶段重新定位为 Primitive Skills 与 World Understanding 原型，而非完整 AI Agent。
- 更新架构图、仓库目录、Layer 进度和 Roadmap，使其与当前代码一致。
- 明确 Navigation 仅是 creative-flight 原型，replanning 信号尚未闭环。
- 明确 Tool API 是进程内函数边界，当前只支持 `navigate`、`place`、`break`。

## Removed

- 移除或改写可能暗示完整 Agent、通用世界理解或自主任务能力的表述。
- 移除将未接入运行入口的 Area Analysis 描述为 Bot 可直接使用能力的可能误解。

## Remaining limitations

- 无 LLM、Agent loop、memory、task planning 或 multi-step execution。
- 导航缺少真正 replanning、可靠 cancellation、survival movement 和远端地图获取。
- 世界模型与碰撞语义简化，Surface/Area Analysis 尚未暴露为 Tool。
- 单方块操作和物品补充主要面向创造模式；没有自主建筑系统。
- 无测试、CI、配置、重连和正式发布/许可配置。
