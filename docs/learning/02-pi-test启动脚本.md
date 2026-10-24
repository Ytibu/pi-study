# 02 pi-test 启动脚本

版本：Pi **v1.0.0**（`a13d35a74`） · 记录日期：2026-10-24 · 修订日期：2026-10-25

**`pi-test` 脚本完成一件事：把终端中的启动命令交给 Node.js，让它直接运行 Pi 的 CLI 源码。** 本模块解释三个脚本各自如何完成这项工作：

- **Linux/macOS `pi-test.sh`**：找到源码目录，处理 `--no-env` 和其余参数，预加载源码解析器，再运行实验 CLI 入口。
- **Windows `pi-test.ps1`**：完成同样的启动准备，运行普通 CLI 入口，并传回失败退出码。
- **Windows `pi-test.bat`**：从 CMD 调用 PowerShell 执行 `pi-test.ps1`，再传回退出码。

下面先看调用关系，再分别拆解脚本，最后解释源码解析器与 CLI 入口差异。依赖安装和模型数据准备见 [01 项目启动](01-项目启动.md)。

## 1. 先看调用关系

```text
pi/
├── pi-test.sh ─────────────→ Node.js → src/experimental/cli.ts
├── pi-test.ps1 ────────────→ Node.js → src/cli.ts
└── pi-test.bat → PowerShell → pi-test.ps1
```

图中的 `src/` 指 `pi/packages/coding-agent/src/`。两条 Node.js 启动命令都会先通过 `--import` 加载 `experimental/source-resolver.ts`，然后执行 CLI 入口。

脚本需要区分两个位置：

| 位置 | 决定什么 |
| --- | --- |
| 启动脚本所在目录 `pi/` | 从哪里加载 Pi 源码和源码解析器 |
| 调用者的当前工作目录 | Pi 在哪个项目中工作、发现项目配置与上下文 |

例如从本项目根目录运行 `./pi/pi-test.sh --version`，加载的是 `pi/` 中的代码，当前工作目录仍为本项目根目录。

## 2. Linux/macOS：pi-test.sh

这个脚本将 Bash 收到的参数交给 Node.js：按需清理环境变量，先加载 `source-resolver.ts`，再执行 `src/experimental/cli.ts`，最后以 Node.js 的退出状态结束。源码见 [pi-test.sh](../../pi/pi-test.sh)。

### 2.1 选择 Bash 并启用错误检查

这一步指定脚本使用 Bash，并为后续命令启用失败检查。

```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `#!/usr/bin/env bash`：直接执行脚本时，通过 `PATH` 查找 Bash。脚本使用数组和 `[[ ... ]]`，应使用 Bash，而不是 `sh`。
- `-e`：普通命令失败时提前退出；条件判断等语法有例外，不能理解为捕获所有错误。
- `-u`：读取未设置的变量时报错。
- `pipefail`：管道中任一命令失败，整个管道就不再只取最后一个命令的成功状态。

这组选项让路径解析、URL 生成或 Node.js 启动失败尽早暴露。

### 2.2 找到脚本目录，不切换工作项目

这一步得到 Pi 源码所在目录，供后续定位解析器和 CLI 文件，同时保留调用者的当前工作目录。

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

从内到外看：`${BASH_SOURCE[0]}` 是当前脚本路径，`dirname` 取其目录，`cd ... && pwd` 得到绝对目录，外层 `$(...)` 将输出赋给 `SCRIPT_DIR`。

这里的 `cd` 在命令替换的子 Shell 中执行，不改变外层脚本的当前目录。后续可以用绝对路径加载 Pi，同时保留用户选择的工作项目。引号用于保护路径中的空格。

### 2.3 消费 --no-env，保留其他参数

这一步识别脚本自己处理的 `--no-env` 开关，将其移除，并把其余参数按原顺序留给 CLI。

```bash
NO_ENV=false
ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--no-env" ]]; then
    NO_ENV=true
  else
    ARGS+=("$arg")
  fi
done
```

`"$@"` 按原参数边界逐个遍历；`ARGS+=("$arg")` 按原顺序保存其他参数。`--no-env` 只设置包装层开关，随后被移除，不交给 CLI。

例如在项目根目录执行：

```bash
./pi/pi-test.sh --no-env --print "hello world"
```

包装层得到 `NO_ENV=true`；CLI 收到两个参数：`--print` 和 `hello world`，后者仍是一个参数。

开关启用后，脚本用 `unset` 清理列出的环境变量，再输出 `Running without API keys...`。两平台的清理范围与局限见第 5 节。

### 2.4 生成解析器 URL，交给 Node.js

这一步让 Node.js 先加载源码解析器，再执行实验 CLI 入口，并接收前面保留的参数。

```bash
RESOLVER_URL="$(node -p 'require("node:url").pathToFileURL(process.argv[1]).href' "$SCRIPT_DIR/packages/coding-agent/src/experimental/source-resolver.ts")"
node --import "$RESOLVER_URL" "$SCRIPT_DIR/packages/coding-agent/src/experimental/cli.ts" ${ARGS[@]+"${ARGS[@]}"}
```

第一条命令用 `node -p` 执行表达式并输出结果：

1. `process.argv[1]` 取得传入的解析器文件路径。
2. `pathToFileURL(...).href` 将文件路径转换为 `file:` URL，正确处理路径中的 `#`、`?`、`%` 等字符。
3. Shell 将结果保存到 `RESOLVER_URL`，供下一条命令使用。

第二条命令中，`--import` 要求 Node.js 在 CLI 入口之前加载源码解析器。入口后的内容才是传给 Pi 的参数。

`${ARGS[@]+"${ARGS[@]}"}` 表示数组已设置时按元素展开，并保留各参数的边界；空数组时不传入额外参数。这种写法也照顾了 `set -u` 下的空数组场景，不应改成会拆分字符串的 `${ARGS[*]}`。

最后一条命令直接运行 Node.js，没有使用 `exec` 替换 Bash 进程。正常执行到末尾时，脚本以 Node.js 的退出状态结束；Node.js 失败也会触发 `-e`。

## 3. Windows：pi-test.ps1

这个脚本将 PowerShell 收到的参数交给 Node.js：按需清理环境变量，先加载 `source-resolver.ts`，再执行普通入口 `src/cli.ts`，并保留 Node.js 的失败退出码。源码见 [pi-test.ps1](../../pi/pi-test.ps1)。

### 3.1 错误策略与脚本目录

这一步设置 PowerShell 错误处理方式，找到 Pi 源码目录，并建立保存 CLI 参数的列表。

```powershell
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$noEnv = $false
$forwardArgs = New-Object System.Collections.Generic.List[string]
```

`$ErrorActionPreference` 让普通 PowerShell 非终止错误升级为终止错误。它不能替代对外部程序退出码的检查，所以脚本末尾还会单独读取 Node.js 的退出码。

`$MyInvocation.MyCommand.Path` 取得当前脚本路径，`Split-Path -Parent` 得到 `pi/` 所在目录。这里没有 `Set-Location`，同样保留调用者的当前工作目录。`List[string]` 用于保存待转发参数。

### 3.2 参数过滤与环境清理

这一步从输入参数中取出 `--no-env` 开关，按需清理指定环境变量，其余参数留给 CLI。

```powershell
foreach ($arg in $args) {
	if ($arg -eq "--no-env") {
		$noEnv = $true
	} else {
		$forwardArgs.Add($arg)
	}
}
```

脚本没有声明 `param(...)`，通过 `$args` 接收传入参数。处理逻辑与 Bash 一致：移除包装层开关，保存其余参数。一个细节是 PowerShell 的字符串 `-eq` 默认不区分大小写，而 Bash 的这里使用区分大小写的比较；使用标准写法 `--no-env` 即可。

开关启用时，脚本先定义 `$envVarsToUnset`，然后执行：

```powershell
foreach ($name in $envVarsToUnset) {
	Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
}

Write-Host "Running without API keys..."
```

`Env:` 是 PowerShell 的环境变量提供程序，删除其中的条目会影响当前进程及之后启动的 Node.js。局部的 `-ErrorAction SilentlyContinue` 让不存在的变量不会因全局 `Stop` 策略而中断脚本。

如果直接在现有 PowerShell 会话中运行 `.\pi\pi-test.ps1 --no-env`，变量清理也会影响该会话。希望把影响限制在子进程时，可从项目根目录运行：

```powershell
pwsh -NoProfile -File .\pi\pi-test.ps1 --no-env --version
```

这只隔离进程环境，认证文件等来源仍需另行考虑。

### 3.3 拼接路径与启动 Node.js

这一步构造解析器与普通 CLI 的文件路径，调用 Node.js 加载源码，并转发保留的参数。

```powershell
$resolverUrl = ([System.Uri](Join-Path $scriptDir "packages/coding-agent/src/experimental/source-resolver.ts")).AbsoluteUri
$cliPath = Join-Path $scriptDir "packages/coding-agent/src/cli.ts"
& node --import $resolverUrl $cliPath @forwardArgs
```

`Join-Path` 相对于脚本目录构造路径；`[System.Uri]` 和 `.AbsoluteUri` 将解析器路径表示为 URL。Windows 盘符路径不能直接当作 `--import` 的模块说明符，因此这里也使用 `file:` URL。

`&` 是调用运算符，执行当前环境找到的 `node`。`@forwardArgs` 是参数展开语法，将列表元素作为参数传入，而不是先拼成一个字符串。

注意 `$cliPath` 指向普通 `src/cli.ts`，与 Bash 脚本使用的 `src/experimental/cli.ts` 不同。

### 3.4 保留 Node.js 的失败退出码

这一步把 Node.js 的失败状态传给上层调用者，使终端或自动化程序能够判断启动是否成功。

```powershell
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
	exit $exitCode
}
```

`$LASTEXITCODE` 保存最近一个外部程序的退出码。脚本紧接 Node.js 调用读取它，并在非零时以相同状态退出；Node.js 成功时正常执行到脚本末尾。这样上层终端或自动化程序才能识别启动失败。

## 4. Windows CMD：pi-test.bat

这个脚本让 CMD 用户也能启动同一份 Pi 源码：找到 Windows PowerShell，调用 `pi-test.ps1`，再传回退出码。源码加载由 `.ps1` 完成。源码见 [pi-test.bat](../../pi/pi-test.bat)。

| 代码 | 作用 |
| --- | --- |
| `@echo off`、`setlocal` | 关闭命令回显，将批处理变量修改限制在本次调用 |
| `set "SCRIPT_DIR=%~dp0"` | 取得批处理自身的盘符与目录，包含结尾分隔符 |
| `set "POWERSHELL_EXE=powershell.exe"` | 固定调用 Windows PowerShell，不会自动改用 `pwsh.exe` |
| `where %POWERSHELL_EXE% >nul 2>nul` | 查找程序，丢弃查找输出与错误文本 |
| `if errorlevel 1 (...)` | 查找失败时向 stderr 输出提示，并以 `1` 退出 |

实际调用与退出：

```bat
%POWERSHELL_EXE% -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%pi-test.ps1" %*
exit /b %ERRORLEVEL%
```

`-NoProfile` 不加载 PowerShell profile；`-ExecutionPolicy Bypass` 设置该 PowerShell 进程的执行策略，不修改系统全局配置，也不能覆盖优先级更高的组织策略。`%*` 转发批处理收到的参数，`exit /b` 将子进程状态返回调用者。

这条路径经过 CMD 和 Windows PowerShell 两层解析；含复杂引号或 Shell 特殊字符的参数不能仅凭 `%*` 推断为跨平台完全等价，本篇未验证这类输入。

## 5. 两个平台的共性与差异

### 5.1 --no-env 的实际范围

两脚本在此版本中清理同一组 35 个变量，包含常见 API Key、GitHub Token、Google 与 AWS 配置变量。完整名单直接查阅脚本，不在正文重复展开。

这个开关有三条边界：

- 清理的是固定名单，并非所有认证变量。例如 [env-api-keys.ts](../../pi/packages/ai/src/env-api-keys.ts) 还识别 `DEEPSEEK_API_KEY`、`NVIDIA_API_KEY` 等，脚本没有清理它们。
- 不删除 `auth.json`、云服务默认凭据等文件，也不隔离项目资源。因此输出 `Running without API keys...` 不是“无凭据”的验证结论。
- 不等于 `--offline`；它本身不控制联网。解析循环也没有识别 `--` 终止标记，会遍历所有传入参数并移除匹配的 `--no-env`。

### 5.2 为什么需要源码解析器

[source-resolver.ts](../../pi/packages/coding-agent/src/experimental/source-resolver.ts) 弥补的是 Node.js 原生 TypeScript 支持与工作区别名之间的缺口：Node.js 能去掉类型语法，但不会自动应用 [tsconfig.json](../../pi/tsconfig.json) 中的 `paths`。

以一个实际映射为例：

```text
导入 @earendil-works/pi-ai
  → 查找 pi/tsconfig.json 的 paths
  → 定位 pi/packages/ai/src/index.ts
  → Node.js 加载源码
```

解析器根据自身文件位置定位 Pi 根目录，筛选 `@earendil-works/` 别名，并通过 `registerHooks` 注册模块解析钩子。匹配到的别名会尝试对应源码文件；找不到时直接报错，避免静默使用旧 `dist`。不匹配的导入则交给 Node.js 后续解析。

因此“无需先构建 `dist`”来自预加载解析器和 Node.js 的配合。依赖安装、模型 JSON 等运行准备仍然需要完成。

### 5.3 两个 CLI 入口为何不同

普通 [cli.ts](../../pi/packages/coding-agent/src/cli.ts) 执行 `setupCli()` 后直接调用 `main(process.argv.slice(2))`。`slice(2)` 跳过 Node.js 可执行文件与入口文件，取出用户参数。

实验 [experimental/cli.ts](../../pi/packages/coding-agent/src/experimental/cli.ts) 也先初始化，但会先等待 `runExperimentalCommand(args)`：

| 条件 | 后续路径 |
| --- | --- |
| `PI_EXPERIMENTAL=1`，且首个参数是 `server` 或 `client` | 进入实验命令分发；`client` 结束后还会显式退出进程 |
| 实验开关未启用，或首个参数不是上述命令 | 调用普通 `main(args)` |

条件依据见 [commands.ts](../../pi/packages/coding-agent/src/experimental/commands.ts) 和 [experimental.ts](../../pi/packages/coding-agent/src/core/experimental.ts)。所以运行 `.sh` 不代表自动开启实验功能；Windows 包装脚本则没有经过这层实验命令分发。

上游 [experimental-cli-entry.test.ts](../../pi/packages/coding-agent/test/experimental-cli-entry.test.ts) 也描述了普通入口与实验入口的边界。本篇仅阅读该测试，未运行它。

## 6. 本篇验证范围

| 检查 | 本次结果 |
| --- | --- |
| 源码版本 | 子模块为 v1.0.0 对应提交 `a13d35a74` |
| 两平台包装脚本、解析器与 CLI 入口 | 已对照源码分析 |
| PowerShell 脚本语法 | 宿主机 PowerShell AST 解析通过 |
| Bash 脚本语法 | 宿主机 Git Bash 的 `bash -n` 检查通过 |
| 参数处理片段 | Bash 空数组传入 0 个参数；两种 Shell 均保留示例中的 `hello world` 参数边界 |
| 原生 Linux/macOS、完整 Windows 启动、交互界面、模型调用 | 本篇未验证；历史 Windows 启动记录见第 01 篇 |

上述 Shell 检查只覆盖语法和独立参数片段，不代表完整 CLI 启动成功。Bash 检查曾受执行环境子进程限制，允许该检查创建子进程后通过；没有修改上游脚本或安装依赖。
