# 墨然的博客（Ink & Thought）

基于 Hugo 的极简主义个人博客：内容优先、高可读性、暗色模式、TOC、纯前端搜索、可选 Giscus 评论，适合部署到 GitHub Pages / Vercel。

## 本地开发

安装 Hugo（macOS）：

```bash
brew install hugo
```

启动预览：

```bash
hugo server --buildDrafts
```

构建产物在 `public/`：

```bash
hugo --minify
```

## 写作方式

- 文章放在 `content/posts/`，每篇文章一个文件夹（Page Bundle），正文为 `index.md`
- 新建文章：

```bash
hugo new content posts/my-post/index.md
```

- 草稿：Front Matter 中设置 `draft = true`，本地预览用 `hugo server --buildDrafts`
- 目录：Front Matter 设置 `toc = true`（默认启用）
- 数学公式：Front Matter 设置 `math = true`（KaTeX 渲染）

## 站点配置

主要配置在 `hugo.toml`：

- `baseURL`：部署后站点地址
- `params.profile`：首页简介
- `params.social`：社交链接
- `params.giscus`：Giscus 评论（填好 repo / repoId / categoryId 后，把 `enabled = true`）

## 部署到 GitHub Pages（免费）

已内置 GitHub Actions 工作流：`.github/workflows/pages.yml`

1. 推送到 `main`
2. GitHub 仓库设置 → Pages → Source 选择 **GitHub Actions**
3. 等待工作流完成后访问站点

## 站内搜索

构建时会生成 `index.json`，搜索页面在 `/search/`，支持标题 / 摘要 / 正文匹配。

