# 03 Agent 基础与最小运行闭环

版本：Pi **v1.0.0**（`a13d35a74`） · 记录日期：2026-10-25

前两篇说明程序如何启动。本篇从用户输入开始，介绍 Agent 如何请求模型、执行工具并生成回答；内容基于源码分析，示例不代表真实模型调用结果。

## 1. Agent 由哪些部分组成

可以把 Agent 理解为一个由程序控制的循环：将上下文交给模型，根据模型返回的工具调用执行操作，再把结果交给模型继续处理。

| 部分 | 作用 |
| --- | --- |
| 模型（LLM） | 根据上下文生成回答，或返回要调用的工具名称与参数 |
| 上下文（Context） | 本次请求提供给模型的信息，包括系统指令、对话消息和工具说明 |
| 工具（Tool） | 由宿主程序执行的函数，例如读取文件、运行命令 |
| Agent 运行时 | 管理消息、请求模型、调度工具，并决定何时继续或结束 |
| 界面 | 接收用户输入，展示文字和工具执行状态 |

模型返回 `read` 调用，不会直接读取本机文件。实际文件访问发生在 Pi 的工具函数中，读取结果随后进入下一次模型请求。

## 2. 最小闭环

以下只看普通文本输入，暂不展开斜杠命令、扩展和排队消息：

```text
用户输入
  ↓
加入消息历史，准备上下文与工具说明
  ↓
请求模型
  ↓
接收 assistant 消息
  ├─ 包含工具调用 → 校验并执行 → 写入工具结果 → 再次请求模型
  └─ 没有工具调用 → 本次运行结束
```

模型可以直接回答，也可以连续调用多次工具。一条 assistant 消息还可以同时包含文字和工具调用，不能仅凭“界面已经输出文字”判断任务结束。

在 Pi 中，一个 **turn** 是“一次模型响应，以及这次响应引发的工具调用和结果”。一次用户输入可以经历多个 turn，最终回答通常来自最后一次模型响应。

第二步的历史消息、上下文与工具说明，分别在 [04 消息历史与上下文准备](04-消息历史与上下文准备.md) 的三个子模块中展开。

## 3. 用读取 README 的例子理解消息

假设用户要求“读取 `README.md`，用一句话概括用途”，且文件内容是“本项目是 Pi v1.0.0 的中文源码学习文档站”。一种可能的过程如下：

```text
user       读取 README.md，用一句话概括用途。
assistant  请求调用 read，参数为 {"path":"README.md"}
toolResult 本项目是 Pi v1.0.0 的中文源码学习文档站。
assistant  这个项目提供 Pi v1.0.0 的中文源码学习文档。
```

这里请求了两次模型：第一次得到工具调用，第二次带着文件内容生成回答。模型不一定选择这条路径，示例只用于说明消息如何流转。

### 3.1 工具调用是什么

Pi 将工具调用保存在 assistant 消息的 `content` 中。单个内容块形如：

```json
{
  "type": "toolCall",
  "id": "call_1",
  "name": "read",
  "arguments": { "path": "README.md" }
}
```

运行时按 `name` 查找工具、校验 `arguments`，再调用工具的 `execute()`。工具定义中有两类信息：

| 信息 | 去向与作用 |
| --- | --- |
| 名称、描述、参数结构 | 提供给模型，说明工具能做什么、如何传参 |
| `execute()` | 留在宿主程序中，执行真实操作 |

Pi v1.0.0 将工具声明及其变化记录在 `system` 消息中，发送模型请求前再进行协议转换。

### 3.2 为什么要把结果放回消息

工具执行结束后，运行时生成 `role: "toolResult"` 的消息：`toolCallId` 对应调用的 `id`，`content` 保存供模型读取的结果，`isError` 标记是否失败。

下一次模型请求会带上此前的工具调用及对应结果，模型才能据此回答或继续操作。上下文是程序实际提供的消息；未读取、未加入上下文的文件内容不会自动被模型看见。

`system`、`user`、`assistant`、`toolResult` 分别表示系统指令与工具声明、用户输入、模型输出、工具结果。工具结果不是用户输入，也不是模型生成的回答。

## 4. 对应到 Pi 源码

先看分层，避免一开始陷入 CLI 与会话管理细节：

| 目录 | 在闭环中的职责 |
| --- | --- |
| `packages/coding-agent/` | 把界面输入接入会话，提供文件、命令等工具和模型运行配置 |
| `packages/agent/` | 管理 Agent 状态，执行“模型 → 工具 → 模型”循环 |
| `packages/ai/` | 提供消息与模型类型、模型服务协议适配等基础能力 |

普通输入的主要路径：

```text
AgentSession.prompt()
  → _runAgentPrompt() → Agent.prompt()
  → runAgentLoop() → runLoop()
      → streamAssistantResponse()     请求模型，接收响应
      → executeToolCalls()            执行工具，生成结果
      → 回到下一次模型请求，或结束
```

| 源码入口 | 本篇重点 |
| --- | --- |
| [agent-session.ts](../../pi/packages/coding-agent/src/core/agent-session.ts) 的 `prompt()` | 处理输入、检查模型与认证，组装用户消息后交给 Agent |
| [agent.ts](../../pi/packages/agent/src/agent.ts) 的 `prompt()` | 准备上下文和循环配置，调用 `runAgentLoop()`；根据事件更新状态 |
| [agent-loop.ts](../../pi/packages/agent/src/agent-loop.ts) 的 `runLoop()` | 请求模型、识别工具调用、写回结果和控制循环 |
| 同文件的 `streamAssistantResponse()` | 转换消息，调用 `streamFunction`，将流式响应整理为 assistant 消息 |
| 同文件的 `prepareToolCall()`、`executePreparedToolCall()` | 查找工具、校验参数并执行 `tool.execute()` |
| [sdk.ts](../../pi/packages/coding-agent/src/core/sdk.ts) 的 `createAgentSession()` | 创建 Agent，并将 `streamFn` 接到 `modelRuntime.streamSimple()` |
| [model-runtime.ts](../../pi/packages/coding-agent/src/core/model-runtime.ts) 的 `streamSimple()` | 准备模型请求并交给对应提供商适配器 |
| [read.ts](../../pi/packages/coding-agent/src/core/tools/read.ts) | 定义 `read` 的参数与文件读取实现 |

建议先读 `runLoop()` 的主干，再跟进模型请求和工具执行。会话持久化、上下文压缩和各个工具的细节可放到后续篇章。

## 5. 界面更新与结束条件

### 5.1 界面如何看到过程

Agent 通过事件通知界面，而不是等所有操作完成后一次性返回文字。主要事件定义见 [types.ts](../../pi/packages/agent/src/types.ts)：

| 事件 | 作用 |
| --- | --- |
| `agent_start` / `agent_end` | 标记一次 Agent 循环的开始与结束 |
| `turn_start` / `turn_end` | 标记一次模型响应及相关工具处理 |
| `message_start` / `message_update` / `message_end` | 通知消息创建、流式更新和完成 |
| `tool_execution_start` / `tool_execution_update` / `tool_execution_end` | 通知工具执行进度与结果 |

交互模式在 [interactive-mode.ts](../../pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts) 中消费这些事件，展示文字与工具状态。`message_end` 只表示一条消息结束；`agent_end` 之后，会话层仍可能处理重试或继续运行。

### 5.2 何时继续，何时结束

| 情况 | 主循环的处理 |
| --- | --- |
| 模型返回工具调用 | 执行后写入结果，通常继续请求模型 |
| 没有工具调用，也没有排队消息或继续指令 | 结束本次循环 |
| 模型响应出错或中止 | 结束本次循环，上层会话可另行处理重试 |
| 工具不存在、参数无效或执行抛错 | 生成错误工具结果，模型可据此调整；不保证一定恢复成功 |

图中展示的是正常主干。源码还支持新输入插入、工具终止标记和 `finishTurn` 等控制，因此“工具执行完必定再请求模型”并非无条件成立。

## 6. 验证范围

- 已对照锁定的 Pi v1.0.0 源码，确认输入、模型请求、工具执行、结果回传和事件路径。
- README 示例为流程示意，未执行真实模型请求或模型驱动的工具调用。
- 本篇不新增可执行示例；文档构建与页面预览只验证站点，不代表 Agent 运行验证。
