# 02 pi-test 启动脚本

版本：Pi **v1.0.0**（`a13d35a74`） · 记录日期：2026-10-24 · 修订日期：2026-10-25

`pi-test` 脚本负责定位源码、处理参数、预加载源码解析器，再交给 Node.js 运行。依赖与模型数据准备见 [01 项目启动](01-项目启动.md)。

## 1. 调用关系

```text
pi/
├── pi-test.sh ─────────────→ Node.js → src/experimental/cli.ts
├── pi-test.ps1 ────────────→ Node.js → src/cli.ts
└── pi-test.bat → PowerShell → pi-test.ps1
```

`src/` 指 `pi/packages/coding-agent/src/`。两条 Node.js 命令均通过 `--import` 预加载 `experimental/source-resolver.ts`。

脚本所在目录用于定位源码，调用者的当前目录决定 Pi 操作哪个项目；脚本不会切换工作目录。

## 2. Linux/macOS：pi-test.sh

源码：[pi-test.sh](../../pi/pi-test.sh)。

| 代码或步骤 | 作用 |
| --- | --- |
| `#!/usr/bin/env bash` | 从 PATH 选择 Bash；脚本使用数组与 `[[ ... ]]`，不能用 `sh` 替代 |
| `set -euo pipefail` | 启用命令失败、未定义变量和管道失败检查；`-e` 在条件判断等场景有例外 |
| `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"` | 获取脚本绝对目录；`cd` 在子 Shell 中，不改变调用者目录 |
| 遍历 `"$@"` | 移除包装层的 `--no-env`，用 `ARGS` 数组按顺序保留其余参数 |
| `unset` | 开关启用时清理指定环境变量 |

核心启动代码：

```bash
RESOLVER_URL="$(node -p 'require("node:url").pathToFileURL(process.argv[1]).href' "$SCRIPT_DIR/packages/coding-agent/src/experimental/source-resolver.ts")"
node --import "$RESOLVER_URL" "$SCRIPT_DIR/packages/coding-agent/src/experimental/cli.ts" ${ARGS[@]+"${ARGS[@]}"}
```

第一行将解析器路径转为 `file:` URL，正确处理路径中的特殊字符。第二行先加载解析器，再执行实验入口；数组展开保留参数边界，空数组不传额外参数。脚本最终返回 Node.js 的退出状态。

例如在项目根目录执行 `./pi/pi-test.sh --no-env --print "hello world"`，CLI 只收到 `--print` 和 `hello world` 两个参数。

## 3. Windows：pi-test.ps1

源码：[pi-test.ps1](../../pi/pi-test.ps1)。

| 代码或步骤 | 作用 |
| --- | --- |
| `$ErrorActionPreference = "Stop"` | 将 PowerShell 非终止错误升级为终止错误；外部程序退出码仍需单独检查 |
| `Split-Path -Parent $MyInvocation.MyCommand.Path` | 获取脚本目录 |
| 遍历 `$args` | 移除 `--no-env`，用 `$forwardArgs` 保存其余参数 |
| `Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue` | 清理指定环境变量，忽略变量不存在的错误 |

核心启动代码：

```powershell
$resolverUrl = ([System.Uri](Join-Path $scriptDir "packages/coding-agent/src/experimental/source-resolver.ts")).AbsoluteUri
$cliPath = Join-Path $scriptDir "packages/coding-agent/src/cli.ts"
& node --import $resolverUrl $cliPath @forwardArgs
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
	exit $exitCode
}
```

解析器路径转为 `file:` URL 后传给 `--import`，`@forwardArgs` 展开 CLI 参数；`$LASTEXITCODE` 用于向调用者返回 Node.js 的失败状态。这里执行普通 `src/cli.ts`，与 Bash 的实验入口不同。

直接在现有 PowerShell 会话中运行脚本，`--no-env` 也会清理该会话的环境变量。若要限制在子进程内，从项目根目录执行：

```powershell
pwsh -NoProfile -File .\pi\pi-test.ps1 --no-env --version
```

## 4. Windows CMD：pi-test.bat

源码：[pi-test.bat](../../pi/pi-test.bat)。它检查 `powershell.exe` 是否存在，再转交 `.ps1`：

```bat
%POWERSHELL_EXE% -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%pi-test.ps1" %*
exit /b %ERRORLEVEL%
```

| 代码或参数 | 作用 |
| --- | --- |
| `@echo off`、`setlocal` | 关闭回显，将批处理变量修改限制在本次调用 |
| `%~dp0` | 获取脚本目录 |
| `powershell.exe` | 固定使用 Windows PowerShell，不自动选择 `pwsh`；找不到时以 `1` 退出 |
| `-NoProfile`、`-ExecutionPolicy Bypass` | 不加载 profile，设置本次 PowerShell 进程的执行策略，不修改全局配置 |
| `%*`、`exit /b %ERRORLEVEL%` | 转发参数并返回退出码 |

参数经过 CMD 与 PowerShell 两层解析，复杂引号和特殊字符未验证；执行策略仍受更高优先级的组织策略约束。

## 5. 关键机制与边界

### 5.1 --no-env

两脚本清理同一组 35 个环境变量，完整名单见源码。它不清理所有认证来源：部分 Key（如 `DEEPSEEK_API_KEY`）、`auth.json` 和云服务默认凭据仍可能有效，也不隔离项目资源或控制联网。`Running without API keys...` 只是提示，不能证明无凭据。

两脚本会遍历全部参数，不识别 `--` 终止标记。PowerShell 的 `-eq` 默认不区分大小写，Bash 此处区分大小写，统一使用 `--no-env` 即可。

### 5.2 源码解析器

Node.js 能处理可擦除的 TypeScript 类型语法，但不会自动应用 [tsconfig.json](../../pi/tsconfig.json) 的 `paths`。[source-resolver.ts](../../pi/packages/coding-agent/src/experimental/source-resolver.ts) 通过 `registerHooks` 将 `@earendil-works/*` 导入映射到源码，例如：

```text
@earendil-works/pi-ai → packages/ai/src/index.ts
```

匹配的别名找不到源码时直接报错，不回退到旧 `dist`；其他导入交给 Node.js 解析。这使 CLI 无需先构建 `dist`，但仍须安装依赖、补齐模型 JSON。

### 5.3 普通入口与实验入口

| 入口 | 行为 |
| --- | --- |
| [src/cli.ts](../../pi/packages/coding-agent/src/cli.ts) | `setupCli()` 后调用 `main(process.argv.slice(2))` |
| [src/experimental/cli.ts](../../pi/packages/coding-agent/src/experimental/cli.ts) | 初始化后先尝试实验命令分发，未命中则调用 `main(args)` |

仅当 `PI_EXPERIMENTAL=1` 且首个参数为 `server` 或 `client` 时进入实验路径，因此运行 `.sh` 不会自动开启实验功能。条件见 [commands.ts](../../pi/packages/coding-agent/src/experimental/commands.ts) 与 [experimental.ts](../../pi/packages/coding-agent/src/core/experimental.ts)。

## 6. 验证范围

以下为原记录中的检查结果，本次精简未重新执行 Shell 或 CLI 验证：

| 检查 | 原记录结果 |
| --- | --- |
| 源码版本 | 子模块固定在 v1.0.0（`a13d35a74`） |
| 包装脚本、解析器与 CLI 入口 | 已对照源码分析 |
| PowerShell AST、Git Bash `bash -n` | 语法检查通过 |
| 独立参数片段 | Bash 空数组传入 0 个参数；两种 Shell 均保留 `hello world` 的参数边界 |
| 原生 Linux/macOS、完整 CLI、交互与模型调用 | 本篇未验证；历史 Windows 启动结果见第 01 篇 |

Bash 检查曾因执行环境限制子进程失败，允许后通过；未修改上游脚本或安装依赖。语法和参数片段通过不代表完整 CLI 启动成功。
