# Pi 源码学习

基于官方 [earendil-works/pi](https://github.com/earendil-works/pi) **v1.0.0** 的中文学习项目，使用 **VitePress 1.6.4** 整理源码分析、启动流程和实测记录。

核心交付物是 `docs/learning/` 中的学习文档及其站点。官方 Pi 作为 Git 子模块放在 `pi/`，为学习内容提供可复查、可复现的源码基线。

## 项目结构

```text
pi-study/
├── docs/
│   ├── learning/            # 学习内容与站点首页
│   ├── .vitepress/         # 站点配置
│   ├── package.json
│   └── package-lock.json
├── pi/                     # 官方 Pi 源码子模块
├── .gitmodules             # 上游仓库地址
└── AGENTS.md               # 本项目贡献指南
```

## Pi 版本依赖

| 项目 | 固定值 |
| --- | --- |
| 官方仓库 | `https://github.com/earendil-works/pi.git` |
| 学习版本 | `v1.0.0` |
| 提交 | `a13d35a742c6ef8462812a28fbe1d8c8b7431c32` |

根仓库通过子模块提交记录锁定源码；`.gitmodules` 声明上游地址。不要使用 `git submodule update --remote` 跟随最新版本，除非明确决定升级学习基线。

文档内容依赖该版本的 Pi 源码；VitePress 的 npm 安装和静态构建只依赖 `docs/` 中的配置与锁文件，不需要安装 Pi 的运行依赖。

## 本地启动

克隆本仓库时使用 `git clone --recurse-submodules <本项目仓库地址>`。已有工作副本可在根目录执行：

```powershell
git submodule update --init pi
git -C pi describe --tags --exact-match HEAD  # 预期 v1.0.0
git -C pi rev-parse HEAD                     # 与上表提交一致
```

使用宿主机已有 Node.js ≥22.0.0 和 npm，在项目根目录执行：

```powershell
cd docs
npm ci --ignore-scripts  # 首次安装；已有依赖可直接启动
npm run dev
```

访问终端输出的地址，通常为 `http://127.0.0.1:5173/`。

## 构建与维护

在 `docs/` 执行 `npm run build`，产物位于 `.vitepress/dist/`；执行 `npm run preview` 预览。新增笔记后同步更新 [学习索引](docs/learning/README.md) 与 `docs/.vitepress/config.mjs` 中的侧边栏。

需要实际运行 Pi 时，进入 `pi/` 阅读上游说明；Pi 要求 Node.js ≥22.19.0，具体步骤见 [项目启动](docs/learning/01-项目启动.md)。文档中的目录均以项目根目录为起点，命令另行注明工作目录。

## Git 工作流

日常修改、验证和小步提交统一在 `develop` 进行。`main` 由管理人员维护；需要整合时，通过 `develop` → `main` 的 Pull Request，由管理人员在托管平台手动执行 **Squash and merge**。

```powershell
# 开始任务：检查工作区并确认开发分支
git status --short
git switch develop

# 开发过程中按明确路径暂存并多次提交
git add -- <本次修改的文件>
git commit -m "docs: 描述本步改动"

# 完成适用检查并审阅差异，停留在 develop
git diff main...HEAD
git status --short
```

`develop` 保留完整的小步提交历史，不再为每项任务另开分支。代理不操作 `main` 的提交、合并、推送或历史，即使当前操作者就是管理人员，也不代为执行主干合并。远程推送与创建 PR 按用户要求执行。

完整贡献要求见 [AGENTS.md](AGENTS.md)，文档站使用说明见 [docs/README.md](docs/README.md)。
