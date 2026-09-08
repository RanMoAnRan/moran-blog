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

Open in your browser: `http://localhost:1313/`

## Writing

- Posts live in `content/posts/`. Each post uses a Page Bundle directory with its content in `index.md`.
- Create a new post:

```bash
hugo new content posts/my-post/index.md
```

- Drafts: set `draft = true` in the front matter, then preview locally with `hugo server --buildDrafts`.
- Table of contents: set `toc = true` in the front matter.
- Math formulas: set `math = true` in the front matter to enable KaTeX rendering.

## Online editor

The Decap CMS editor is published at `/admin/`. In production it signs in with
GitHub and writes posts directly to the `main` branch. It keeps Hugo page bundle
content in `content/posts/<directory>/index.md` and stores uploaded post media
beside that `index.md` file.

### Local preview

Run Hugo and the local Decap content proxy in separate terminals:

```bash
hugo server
npx decap-server
```

Then open `http://localhost:1313/admin/`. Local mode does not use GitHub OAuth
and writes changes to the working tree without committing them.

### Production authentication

1. Create a GitHub OAuth App under **Settings > Developer settings > OAuth Apps**.
2. Set its **Homepage URL** to `https://moran.is-a.dev`.
3. Set its **Authorization callback URL** to
   `https://moran.is-a.dev/api/callback`.
4. Add the following environment variables to the Vercel project for the
   Production environment:

   - `GITHUB_CLIENT_ID`: the OAuth App client ID.
   - `GITHUB_CLIENT_SECRET`: the OAuth App client secret.
   - `OAUTH_COOKIE_SECRET`: a random secret generated with
     `openssl rand -base64 32`.

5. Redeploy the project and open `https://moran.is-a.dev/admin/`.

Do not add these secrets to the repository or to `config.yml`. The GitHub
account used in the editor must have write access to `RanMoAnRan/moran-blog`.

## Site Configuration

The main configuration file is `hugo.toml`:

- `params.profile`: homepage profile information
- `params.social`: social links
- `params.giscus`: Giscus comments. Fill in `repo`, `repoId`, and `categoryId`, then set `enabled = true`.
