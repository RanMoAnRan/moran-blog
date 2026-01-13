# 墨然的博客

基于 Hugo 的极简主义个人博客

## 本地开发

安装 Hugo（macOS）：

```bash
brew install hugo
```


```bash
hugo server --buildDrafts
```

浏览器打开：`http://localhost:1313/moran-blog/`


## 写作方式

- 文章放在 `content/posts/`，每篇文章一个文件夹（Page Bundle），正文为 `index.md`
- /__new/
```bash
hugo new content posts/my-post/index.md
```

- 草稿：Front Matter 中设置 `draft = true`，本地预览用 `hugo server --buildDrafts`
- 目录：Front Matter 设置 `toc = true`（默认启用）
- 数学公式：Front Matter 设置 `math = true`（KaTeX 渲染）

## 站点配置

主要配置在 `hugo.toml`：
- `params.profile`：首页简介
- `params.social`：社交链接
- `params.giscus`：Giscus 评论（填好 repo / repoId / categoryId 后，把 `enabled = true`）

