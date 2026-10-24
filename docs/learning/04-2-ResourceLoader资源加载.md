# 04.2 ResourceLoader：项目资源加载

版本：Pi **v1.0.0**（`a13d35a74`） · 记录／修订日期：2026-10-25

所属模块：[04 消息历史与上下文准备](04-消息历史与上下文准备.md)。主要源码：[resource-loader.ts](../../pi/packages/coding-agent/src/core/resource-loader.ts)。

## 1. 接口与默认实现

`ResourceLoader` 定义资源读取接口，`DefaultResourceLoader` 实现资源发现、加载和缓存。它的输出交给会话层使用；系统消息由后续组件构建。

| 接口 | 返回内容及用途 |
| --- | --- |
| `getAgentsFiles()` | `{ agentsFiles: [{ path, content }] }`，提供项目约定文件 |
| `getSystemPrompt()` | 自定义基础提示词文本 |
| `getAppendSystemPrompt()` | 附加提示词文本数组 |
| `getSkills()` | 技能列表与诊断信息 |
| `getPrompts()` | 提示模板，供输入展开使用 |
| `getExtensions()` | 已加载扩展及其运行时信息，供会话创建扩展运行器 |

接口还管理主题等资源，本模块只跟踪参与输入和请求准备的部分。

## 2. 何时加载

[createAgentSession()](../../pi/packages/coding-agent/src/core/sdk.ts) 未收到外部 `resourceLoader` 时，执行：

```typescript
resourceLoader = new DefaultResourceLoader({ cwd, agentDir, settingsManager });
await resourceLoader.reload();
```

这是创建会话时的准备工作。之后 getter 读取已加载结果；`AgentSession.reload()` 等显式重载路径才会再次调用资源加载器的 `reload()`。

如果调用方注入自己的加载器，SDK 不会在这段默认创建分支里替它重载资源。

## 3. 项目约定文件的发现

`reload()` 通过 `loadProjectContextFiles({ cwd, agentDir })` 准备约定文件；`noContextFiles` 开启时此列表为空。

```text
全局 agentDir 中的约定文件
  + 从祖先目录到 cwd 的约定文件
  → 去重及嵌套 worktree 遮蔽处理
  → agentsFiles 缓存
```

每个目录由 `loadContextFileFromDir()` 按候选顺序选取一个文件：`AGENTS.override.md`、`AGENTS.md`、`AGENTS.MD`、`CLAUDE.md`、`CLAUDE.MD`。它读取约定文件，不会把整个项目目录作为上下文加载。

自定义提示词走另一条路径：默认发现受信任项目中的 `.pi/SYSTEM.md`，否则尝试全局 `SYSTEM.md`；`APPEND_SYSTEM.md` 的默认发现采用类似顺序。显式配置与覆盖函数可改变加载结果，细节见 `reload()`。

## 4. 结果交给谁

[AgentSession._rebuildSystemPrompt()](../../pi/packages/coding-agent/src/core/agent-session.ts) 读取约定文件、技能和提示词缓存，整理成 `NormalizedBuildSystemPromptOptions`。提示模板则由 `AgentSession.prompt()` 的输入展开路径使用。

资源加载与每次请求的消息组装是两个阶段：文件先成为资源数据，再由会话层选择如何使用。

验证范围见 [总览](04-消息历史与上下文准备.md#_4-验证范围)。下一篇：[04.3 SystemPrompt](04-3-SystemPrompt指令构建.md)。
