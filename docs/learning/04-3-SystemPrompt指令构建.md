# 04.3 SystemPrompt：系统指令构建与差量更新

版本：Pi **v1.0.0**（`a13d35a74`） · 记录／修订日期：2026-10-25

所属模块：[04 消息历史与上下文准备](04-消息历史与上下文准备.md)。主要源码：[system-prompt.ts](../../pi/packages/coding-agent/src/core/system-prompt.ts)，由一组函数组成。

## 1. 输入与输出

`buildSystemPromptSections()` 接收 `BuildSystemPromptOptions`，输出按名称组织的 `SystemPromptSections`。输入由 [AgentSession._rebuildSystemPrompt()](../../pi/packages/coding-agent/src/core/agent-session.ts) 收集。

| 输入 | 来源 |
| --- | --- |
| `cwd` | 会话当前工作目录 |
| `contextFiles`、`skills` | ResourceLoader 的约定文件与技能 |
| `customPrompt`、`appendSystemPrompt` | ResourceLoader 的基础与附加提示词 |
| `selectedTools` | 本次选择的有效工具名称 |
| `toolSnippets`、`toolGuidelines` | 已注册工具贡献的简短说明和规则 |

## 2. buildSystemPromptSections() 的构建结果

| 分区 | 默认构建规则 |
| --- | --- |
| `preamble` | 使用 `customPrompt`；未提供时使用内置编码助手说明 |
| `tools`、`rules`、`docs` | 无自定义基础提示词时，生成工具摘要、去重后的规则与 Pi 文档位置 |
| `addendum` | 有附加提示词时加入 |
| `project_context` | 有约定文件时，将路径和正文包装为项目指令 |
| `skills` | 工具条件满足且存在技能时，加入格式化的技能说明 |
| `cwd` | 当前工作目录，路径分隔符统一为 `/` |

除 `preamble` 外，生成的分区文本会按名称包装为标签。工具摘要来自 `toolSnippets`，结构化参数声明由 AgentLoop 另行处理。

## 3. diffSystemPromptSections() 如何更新

`AgentSession._preparePromptAndToolLoadout()` 先取得当前消息重放后的分区，再与新分区比较：

```text
getCurrentSystemMessage(messages).sections
  + buildSystemPromptSections(options)
  → diffSystemPromptSections(previous, current)
  → system 消息的 sections 补丁，或 undefined
```

| 比较结果 | 补丁内容 |
| --- | --- |
| 新增分区或文本改变 | 写入该分区的新文本 |
| 分区被移除 | 将该分区置为 `null` |
| 所有分区相同 | 返回 `undefined`，不生成这类系统更新 |

消息重放由 [transcript.ts](../../pi/packages/ai/src/utils/transcript.ts) 的 `getCurrentSystemMessage()` 完成：同名分区替换，`null` 删除。这样历史可以保存指令变化，而无需每次重复追加完整指令。

## 4. 文本渲染与特殊覆盖

`buildSystemPromptState()` 生成 `{ content, sections? }`；`buildSystemPrompt()` 再通过 `getSystemMessageText()` 渲染完整文本。

普通请求主要走分区差量路径。扩展要求整段强制提示词时，`AgentSession._installAgentForcedPromptProjection()` 在请求边界投影该文本，持久化记录仍保留结构化分区。阅读时应区分这两条路径。

验证范围见 [总览](04-消息历史与上下文准备.md#_4-验证范围)。下一篇：[04.4 AgentSession](04-4-AgentSession输入与装配.md)。
