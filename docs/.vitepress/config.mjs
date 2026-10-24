import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
	lang: "zh-CN",
	title: "Pi 源码学习",
	description: "earendil-works/pi v1.0.0 源码学习与启动记录",
	srcDir: "learning",
	rewrites: { "README.md": "index.md" },
	vite: {
		configFile: false,
		envDir: projectRoot,
		plugins: [
			{
				name: "standalone-docs",
				configResolved(config) {
					// 合并后将范围收回到文档项目；Vite 的路径匹配要求使用正斜杠。
					config.server.fs.allow = [projectRoot.replaceAll("\\", "/")];
				},
			},
		],
	},
	themeConfig: {
		nav: [
			{ text: "学习索引", link: "/" },
			{ text: "项目启动", link: "/01-项目启动" },
		],
		sidebar: [
			{
				text: "源码学习 · v1.0.0",
				items: [
					{ text: "学习索引", link: "/" },
					{ text: "01 项目启动", link: "/01-项目启动" },
				],
			},
		],
		outline: { level: [2, 3], label: "本页目录" },
		docFooter: { prev: "上一篇", next: "下一篇" },
		sidebarMenuLabel: "文档导航",
		returnToTopLabel: "返回顶部",
		darkModeSwitchLabel: "外观",
		search: {
			provider: "local",
			options: {
				translations: {
					button: { buttonText: "搜索文档", buttonAriaLabel: "搜索文档" },
					modal: { noResultsText: "没有找到相关文档", resetButtonTitle: "清空搜索" },
				},
				miniSearch: {
					options: {
						tokenize: (text) =>
							Array.from(new Intl.Segmenter("zh-CN", { granularity: "word" }).segment(text))
								.filter((word) => word.isWordLike)
								.map((word) => word.segment),
					},
				},
			},
		},
	},
	markdown: {
		config(md) {
			const renderLink = md.renderer.rules.link_open;
			md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
				const href = tokens[index].attrGet("href");
				// 将子模块文件链接转换为对应版本的官方源码链接。
				if (href?.startsWith("../../pi/")) {
					tokens[index].attrSet("href", `https://github.com/earendil-works/pi/blob/v1.0.0/${href.slice(9)}`);
				}
				return renderLink(tokens, index, options, env, renderer);
			};
		},
	},
});
