# Moran's Blog

A minimalist personal blog built with Hugo.

## Local Development

Install Hugo:

```bash
brew install hugo
```

Start the local development server:

```bash
hugo server --buildDrafts
```

Open in your browser: `http://localhost:1313/moran-blog/`

## Writing

- Posts live in `content/posts/`. Each post uses a Page Bundle directory with its content in `index.md`.
- Create a new post:

```bash
hugo new content posts/my-post/index.md
```

- Drafts: set `draft = true` in the front matter, then preview locally with `hugo server --buildDrafts`.
- Table of contents: set `toc = true` in the front matter.
- Math formulas: set `math = true` in the front matter to enable KaTeX rendering.

## Site Configuration

The main configuration file is `hugo.toml`:

- `params.profile`: homepage profile information
- `params.social`: social links
- `params.giscus`: Giscus comments. Fill in `repo`, `repoId`, and `categoryId`, then set `enabled = true`.
