+++
title = 'Ink & Thought：从零开始的极简博客copy111'
slug = 'ink-and-thought-copy'
date = 2026-01-08T00:00:00+08:00
draft = false
tags = ['SSG', 'Hugo', '设计']
categories = ['博客']
summary = '这是一篇用于验证排版、暗色模式、目录、代码高亮与数学公式的示例文章。'
toc = true
math = true
+++

> 设计做减法，把注意力交还给文字。

## 为什么选择 “静态网站生成器 + 托管平台”

静态站的核心优势是：**快、稳、简单**。写作只需要 Markdown，发布只需要一次构建，托管由平台负责。

## 你会在这里看到什么

- 编程：可复用的工程经验
- 产品：从需求到落地的思考
- 生活：把感受写成文字

## 代码高亮测试

```ts
type Post = {
  title: string;
  tags: string[];
};

export function readingTime(words: number) {
  return Math.max(1, Math.round(words / 300));
}
```

## 数学公式（LaTeX）测试

当你需要表达数学符号时，可以写：

$$
E = mc^2
$$

## 接下来

你可以从 `content/posts/` 开始写作：每篇文章一个文件夹，使用 `index.md` 作为正文。
