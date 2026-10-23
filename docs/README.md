# Pi 学习文档站

本目录是 `pi-study` 的核心文档项目，使用 VitePress 1.6.4 展示基于官方 Pi **v1.0.0** 的中文学习内容。官方源码位于同级的 `../pi/`，由根 Git 仓库以子模块锁定版本，详见 [项目说明](../README.md)。

学习内容依赖固定版本的 Pi；文档站使用自己的 npm 依赖、锁文件和工具配置，不加入 Pi 的 npm workspaces，也不调用 Pi 的构建脚本。

## 本地运行

所有命令均在本项目目录执行：

```powershell
cd E:\codeSpace\pi-study\docs

# 首次安装本项目锁定的依赖
npm ci --ignore-scripts

# 启动开发服务器
npm run dev
```

打开终端输出的地址，通常为 `http://127.0.0.1:5173/`。端口占用时以实际输出为准。

## 构建与预览

```powershell
npm run build
npm run preview
```

静态产物位于本项目的 `.vitepress/dist/`；`node_modules/`、缓存和构建产物由本项目自己的 `.gitignore` 忽略。

## 源码依赖与构建边界

- `package.json`、`package-lock.json`：只管理文档站依赖，不使用 `workspace:`、`file:` 或 Pi 包引用。
- `.npmrc`：本项目的 npm 配置，明确禁用 workspace 模式；仍遵循宿主机正常的用户级 npm 设置。
- `tsconfig.json`、`.vitepress/config.mjs`：本项目自己的工具配置，不继承 Pi 配置。
- 使用宿主机 Node.js ≥22.0.0 和 npm；只构建文档站无需安装 Pi 的运行依赖。
- 学习文档中的源码引用在渲染时转为公开 GitHub 链接，不读取文档项目外的文件。

源码阅读和行为核验以根仓库锁定的 `pi/` 为准。历史学习笔记保留当时的旧路径和执行记录，当前源码位置是 `E:\codeSpace\pi-study\pi`。Pi 与文档站是同级目录。

## 添加学习文档

1. 在本项目的 `learning/` 新增 Markdown，并更新原学习索引。
2. 在 `.vitepress/config.mjs` 的 `themeConfig.sidebar` 中添加入口。
3. 在本项目目录运行 `npm run build` 检查页面生成与站内链接。

原学习索引 `learning/README.md` 通过路由重写作为首页。正文指向仓库文件的 `../../` 相对链接仅在渲染时转换为 GitHub `v1.0.0` 源码链接；原文不改写。本地搜索使用中文分词。

配置方式参考 [VitePress 1.6.4 官方文档](https://vuejs.github.io/vitepress/v1/guide/routing)。
