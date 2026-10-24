# Pi 学习文档站

基于 Pi **v1.0.0** 的中文源码学习文档，使用 VitePress 1.6.4。项目结构与源码版本见 [项目说明](../README.md)，正文从 [学习索引](learning/README.md) 开始。

## 启动与构建

使用已有的 Node.js ≥22.0.0 和 npm，从项目根目录执行：

```powershell
cd docs
npm ci --ignore-scripts  # 首次安装
npm run dev
```

打开终端输出的地址。在 `docs/` 中执行以下命令构建并预览：

```powershell
npm run build
npm run preview
```

构建产物位于 `docs/.vitepress/dist/`。文档站只使用 `docs/` 的依赖与配置，无需安装或构建 `pi/` 中的 npm 包。

## 内容与维护

| 项目路径 | 用途 |
| --- | --- |
| `docs/learning/README.md` | 学习索引，渲染为站点首页 |
| `docs/learning/01-项目启动.md` | 启动步骤、源码入口与验证记录 |
| `docs/.vitepress/config.mjs` | 导航、侧边栏、中文搜索和源码链接转换 |
| `pi/` | 固定在 v1.0.0 的官方源码子模块 |

新增笔记时：

1. 在 `docs/learning/` 按 `02-主题.md`、`03-主题.md` 命名，注明版本、日期和验证范围。
2. 更新学习索引及 `.vitepress/config.mjs` 的侧边栏。
3. 在 `docs/` 执行 `npm run build`；涉及导航或渲染时，再通过预览检查页面。

正文中的源码链接使用相对于笔记的路径，如 `../../pi/package.json`。站点渲染时将其转换为官方 GitHub 的 `v1.0.0` 链接，仓库内阅读时则直接定位 `pi/` 子模块文件。
