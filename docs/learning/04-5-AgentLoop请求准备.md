# 04.5 Agent 与 AgentLoop：请求上下文准备

版本：Pi **v1.0.0**（`a13d35a74`） · 记录／修订日期：2026-10-25

所属模块：[04 消息历史与上下文准备](04-消息历史与上下文准备.md)。主要源码：[agent.ts](../../pi/packages/agent/src/agent.ts)、[agent-loop.ts](../../pi/packages/agent/src/agent-loop.ts)。

## 1. Agent 将状态交给循环

`Agent.prompt()` 经 `runPromptMessages()` 调用 `runAgentLoop()`，分别传入运行上下文、循环配置、事件接收函数与 `streamFunction`。

| 数据 | 构建入口与内容 |
| --- | --- |
| `AgentContext` | `createContextSnapshot()` 复制当前 `messages` 与可执行 `tools` 数组 |
| `AgentLoopConfig` | `createLoopConfig()` 收集模型、思考级别、转换函数、请求钩子与队列读取函数等 |

这一步复制的是数组，不是把全部消息和工具对象深拷贝。

## 2. runAgentLoop() 合并消息并发出事件

源码的初始装配为：

```typescript
const initialMessages = declareToolChanges(context, prompts);
const newMessages: AgentMessage[] = [...initialMessages];
const currentContext: AgentContext = {
	...context,
	messages: [...context.messages, ...initialMessages],
};
```

随后循环为新消息发出 `message_start`、`message_end`。Agent 将完成消息加入内存状态，AgentSession 的订阅处理器将消息记录到 SessionManager；这先于 `runLoop()` 中的 `prepareRequest` 调用，使请求钩子能取得包含新输入的会话投影。

## 3. declareToolChanges() 准备工具声明

| 实际调用 | 作用 |
| --- | --- |
| `getCurrentTools()` | 重放历史 `system` 消息，取得模型当前被告知的工具 |
| `context.tools.map(toToolDeclaration)` | 从可执行工具中提取名称、描述、参数结构及可选采样约束 |
| `getToolStateChanges()` | 比较旧声明与当前声明，同名定义改变时先移除再添加 |
| `withToolChanges()` | 将 `toolsAdded`、`toolsRemoved` 写入已有或新增的 `system` 消息 |

这些辅助函数位于 [transcript.ts](../../pi/packages/ai/src/utils/transcript.ts)。`toToolDeclaration()` 不保留 `execute` 等宿主字段。以 [read.ts](../../pi/packages/coding-agent/src/core/tools/read.ts) 为例，发送的是 `read` 的描述和参数结构，文件读取函数留在宿主执行。

声明相同且没有其他系统更新时，不会为工具重复增加消息；有待发送的系统消息时，循环会以当前可执行集合重算其工具变化。

## 4. runLoop() 到模型请求的顺序

```text
处理下一轮准备结果与排队消息（如有）
  → declareToolChanges()，记录新增消息
  → config.prepareRequest()（如有，Pi 在这里刷新会话投影）
  → streamAssistantResponse()
      → transformContext()（如有）
      → convertToLlm()
      → normalizeContext({ messages: llmMessages })
      → streamFunction(model, llmContext, options)
```

[sdk.ts](../../pi/packages/coding-agent/src/core/sdk.ts) 为 Pi 创建的 Agent 提供 `convertToLlm` 包装函数、扩展上下文变换和模型流函数。应用消息的具体转换见 [messages.ts](../../pi/packages/coding-agent/src/core/messages.ts)：例如摘要转为用户消息，被排除的 Bash 输出被过滤。

`normalizeContext()` 生成提供商适配层使用的 `TranscriptContext`；本路径的系统指令和工具声明已在消息中。随后 `streamFn` 接入 `modelRuntime.streamSimple()`，进入模型请求阶段。

`prepareNextTurn` 负责后续响应前的刷新，`prepareRequest` 是每次请求边界，`transformContext` 则在转换为模型消息前执行。阅读时要按这一调用顺序区分职责。

验证范围见 [总览](04-消息历史与上下文准备.md#_4-验证范围)。
