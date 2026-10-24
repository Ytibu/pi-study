# 04.4 AgentSession：输入处理与请求装配

版本：Pi **v1.0.0**（`a13d35a74`） · 记录／修订日期：2026-10-25

所属模块：[04 消息历史与上下文准备](04-消息历史与上下文准备.md)。主要源码：[agent-session.ts](../../pi/packages/coding-agent/src/core/agent-session.ts)。

## 1. AgentSession 连接哪些组件

构造函数接收 `Agent`、`SessionManager`、`ResourceLoader`、`SettingsManager`、`ModelRuntime` 等依赖。它协调会话行为，并向 Agent 安装事件处理与请求钩子。

| 初始化动作 | 作用 |
| --- | --- |
| `agent.subscribe(_handleAgentEvent)` | 接收完成消息，记录会话并处理扩展等行为 |
| `_buildRuntime()` | 创建工具定义、扩展运行器，并刷新工具注册表 |
| `_installAgentRequestProjection()` | 安装每次请求前的 `prepareRequest` 钩子 |
| `_installAgentNextTurnRefresh()` | 安装后续响应前的刷新钩子 |

`AgentSession` 管会话策略，底层 `Agent` 管运行状态与循环；二者不是同一个类。

## 2. prompt() 如何处理当前输入

以下对应空闲状态下普通输入的源码顺序：

| 顺序 | 实际调用或数据变化 |
| --- | --- |
| 1 | `_runInputHandlers()` 允许输入处理器修改或接管输入 |
| 2 | `_expandSkillCommand()`、`expandPromptTemplate()` 展开技能命令与模板 |
| 3 | 检查所选模型与认证，必要时通过 `_checkCompaction()` 处理已有上下文 |
| 4 | `emitBeforeAgentStart()` 允许扩展调整指令选项、工具选择并附加消息 |
| 5 | `_normalizePromptImages()` 后构建 `role: "user"` 的消息 |
| 6 | 加入待发送消息与扩展消息，调用 `_preparePromptAndToolLoadout()` |
| 7 | 如有 `system` 更新，将其放在这批消息前，再调用 `_runAgentPrompt()` |

扩展命令可提前返回；运行中的新输入则进入 steer 或 follow-up 队列。这些分支不会立即按上表发起普通请求。

## 3. 工具选择与指令装配

`_preparePromptAndToolLoadout()` 同时协调两项准备工作：

```text
options.selectedTools
  → _applyToolLoadout() → agent.state.tools

指令选项 + 当前已记录的系统分区
  → buildSystemPromptSections() + diffSystemPromptSections()
  → system 更新（有变化时）
```

`_applyToolLoadout()` 从 `_toolRegistry` 按名称选择工具，处理 `prepareLoadout` 钩子对描述及声明可见性的调整，再更新 Agent 的工具状态。已注册、当前启用、最终对模型可见的工具集合需要区分。

此处生成指令分区更新；`toolsAdded`、`toolsRemoved` 的结构化声明变化由下一层 AgentLoop 计算。

## 4. 每次请求前重新投影

`_installAgentRequestProjection()` 安装的 `prepareRequest` 钩子在模型请求前调用 `sessionManager.buildSessionProjection()`。其中核心装配如下：

```typescript
const projection = this.sessionManager.buildSessionProjection();
const canonicalContext = {
	...request.context,
	messages: projection.messages,
	tools: this.agent.state.tools.slice(),
};
```

这是源码摘录：消息来自当前会话投影，可执行工具来自 Agent 状态。因此初次合并的内存消息并非直接发送的最终版本。已有钩子、虚拟模型路由等还可在这一边界调整请求。

后续响应前，`_installAgentNextTurnRefresh()` 还会检查压缩、刷新工具与指令选项，并将更新交回 AgentLoop。

验证范围见 [总览](04-消息历史与上下文准备.md#_4-验证范围)。下一篇：[04.5 Agent 与 AgentLoop](04-5-AgentLoop请求准备.md)。
