# 04.1 SessionManager：会话记录与投影

版本：Pi **v1.0.0**（`a13d35a74`） · 记录／修订日期：2026-10-25

所属模块：[04 消息历史与上下文准备](04-消息历史与上下文准备.md)。主要源码：[session-manager.ts](../../pi/packages/coding-agent/src/core/session-manager.ts)。

## 1. 组件职责与数据

`SessionManager` 管理会话条目及当前分支，并从条目构建当前有效消息。这里的“投影”指按分支、压缩和编辑记录整理后的消息视图。

| 数据 | 源码中的作用 |
| --- | --- |
| `SessionEntry` | 会话条目，可以是消息、模型切换、压缩、上下文编辑等记录 |
| `id`、`parentId`、`leafId` | 表示条目关系与当前分支末端 |
| `SessionProjection.entries` | 保留来源条目与投影消息的对应关系 |
| `SessionProjection.messages` | 当前分支实际参与上下文的 `AgentMessage[]` |
| `SessionContext` | 从投影中取出 `messages`、`thinkingLevel`、`model` |

持久化会话以 JSONL 保存条目，也支持纯内存会话。会话条目、投影消息和磁盘文件是不同层次的数据。

## 2. 写入路径：appendMessage()

普通消息的记录路径为：

```text
Agent 发出 message_end
  → AgentSession._handleAgentEvent()
  → SessionManager.appendMessage(message)
  → _appendEntry(entry)
```

`appendMessage()` 将消息包装成 `type: "message"` 的条目，`parentId` 指向当前 `leafId`。`_appendEntry()` 更新条目列表、索引与叶节点，再交给持久化逻辑。

扩展自定义消息、压缩和摘要有各自的写入入口；这里跟踪的是 `system`、`user`、`assistant`、`toolResult` 等普通消息路径。

## 3. 读取路径：buildSessionProjection()

| 源码步骤 | 处理结果 |
| --- | --- |
| `buildSessionPath()` | 从指定叶节点沿 `parentId` 回溯，得到当前分支 |
| `buildContextEntries()` | 应用最近一次压缩，保留压缩检查点、需保留的旧条目及后续条目 |
| 收集 `context_edit` | 按目标条目记录上下文内容替换或排除操作 |
| `projectContextEntry()` | 将条目转换为消息，并应用内容编辑 |
| `buildSessionProjection()` | 汇总来源关系、有效消息、模型与思考级别 |

因此，另一分支的消息、已被摘要替代的旧正文或被排除的内容，不会仅因仍存在于会话文件中就进入当前请求。

## 4. 谁使用投影

| 调用方 | 时机与用途 |
| --- | --- |
| [sdk.ts](../../pi/packages/coding-agent/src/core/sdk.ts) 的 `createAgentSession()` | 用 `buildSessionContext()` 的 `messages` 初始化 Agent |
| [agent-session.ts](../../pi/packages/coding-agent/src/core/agent-session.ts) 的 `_installAgentRequestProjection()` | 每次请求前重新取得 `buildSessionProjection()`，作为请求消息来源 |
| 同文件的 `_compactBeforeNextAssistantResponse()` | 后续响应前检查压缩阈值并刷新消息 |

历史不是只在启动时读一次。会话条目发生编辑或压缩后，下一次投影可以改变模型看到的内容。

验证范围见 [总览](04-消息历史与上下文准备.md#_4-验证范围)。下一篇：[04.2 ResourceLoader](04-2-ResourceLoader资源加载.md)。
