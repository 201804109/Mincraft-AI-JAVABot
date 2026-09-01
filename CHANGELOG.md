# README Update Summary

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
