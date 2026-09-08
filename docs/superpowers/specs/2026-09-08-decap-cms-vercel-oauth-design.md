# Decap CMS 在线编辑后台设计

## 目标

为现有 Hugo 博客增加可从 `https://moran.is-a.dev/admin/` 访问的在线编辑后台。后台和博客静态文件由 GitHub Pages 托管，GitHub OAuth 接口由 `https://moran-blog.vercel.app` 上的 Vercel Functions 托管。保存或发布文章时直接提交到 `RanMoAnRan/moran-blog` 的 `main` 分支，再由 GitHub Pages 工作流构建公开网站。整个方案不要求自建常驻服务器。

## 保持不变的部分

- Hugo 仍然负责将内容构建为静态网页。
- 文章继续存储在 `content/posts/<slug>/index.md`。
- 文章图片继续与 `index.md` 放在同一个 Page Bundle 目录中。
- Front Matter 继续使用 TOML 分隔符 `+++`。
- GitHub Pages 继续运行现有 Hugo 构建工作流。
- Vercel 仅作为 OAuth Functions 的运行平台；其静态博客副本不是公开主站。

## 架构

```text
GitHub Pages /admin/
       |
       v
   Decap CMS ----------------------+
       |                           |
       | OAuth 登录                | GitHub Contents API
       v                           v
Vercel /api/auth            RanMoAnRan/moran-blog
       |                           |
       v                           | push main
GitHub OAuth                        v
       |                    GitHub Pages 自动部署
       v
Vercel /api/callback
       |
       +---- postMessage token ---> Decap CMS
```

## 组件

### 管理后台

`static/admin/index.html` 加载固定主版本的 Decap CMS 浏览器脚本并提供基础加载界面。Hugo 会把该目录原样发布到 `/admin/`。

`static/admin/config.yml` 配置 GitHub 后端、仓库、`main` 分支、OAuth 接口和文章集合。文章集合使用：

```yaml
folder: content/posts
path: "{{slug}}/index"
media_folder: ""
public_folder: ""
```

这会保留当前 Page Bundle 结构，并让后台上传的媒体文件与文章放在同一目录。

编辑字段覆盖当前仓库实际使用的全部 Front Matter：`title`、`slug`、`date`、`draft`、`tags`、`categories`、`summary`、`toc`、`math`、可选 `cover` 和正文。配置使用 TOML Front Matter，避免后台保存后改变现有文章格式。

### OAuth 接口

`api/auth.js` 发起 GitHub OAuth：

1. 生成密码学安全的随机 `state`。
2. 将 `state` 写入 `HttpOnly`、`Secure`、`SameSite=Lax` Cookie。
3. 将浏览器重定向到 GitHub 授权页面。

`api/callback.js` 完成认证：

1. 检查 GitHub 返回的 `code` 和 `state`。
2. 使用恒定时间比较验证 Cookie 中的 `state`。
3. 使用服务端环境变量中的 Client Secret 换取访问令牌。
4. 返回仅负责把 Decap CMS 兼容认证消息发送给打开窗口的最小 HTML。
5. 限定消息目标为 `https://moran.is-a.dev`，然后关闭认证窗口。

`api/_oauth.js` 保存无状态公共逻辑，包括环境变量校验、Cookie 解析、安全响应头、允许来源和 GitHub 请求封装。敏感信息不得写入日志或返回错误页面。

### Node 配置

增加最小 `package.json`，只声明项目为 ESM 并提供 OAuth 单元测试脚本。不引入运行时依赖，OAuth 接口只使用 Node 标准库和内置 `fetch`，减少供应链与部署复杂度。

## 配置要求

Vercel 项目必须配置：

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `OAUTH_COOKIE_SECRET`
- 可选 `CMS_ORIGIN`，默认值为 `https://moran.is-a.dev`
- 可选 `AUTH_ORIGIN`，默认值为 `https://moran-blog.vercel.app`

GitHub OAuth App 使用：

- Homepage URL：`https://moran.is-a.dev`
- Authorization callback URL：`https://moran-blog.vercel.app/api/callback`

环境变量缺失时，接口返回通用配置错误，不泄露具体秘密或上游响应内容。

## 发布流程

后台用户必须使用对目标仓库具有推送权限的 GitHub 账号登录。点击发布后，Decap CMS 通过 GitHub API 直接提交到 `main`。不启用 Editorial Workflow，不创建审核分支或 PR。GitHub Pages 工作流收到推送后自动重新构建公开站点，Vercel 同时保留 OAuth Functions 部署。

## 错误处理

- 非 `GET` 请求返回 `405`。
- 来源不在允许列表时拒绝启动认证。
- `state` 缺失、不一致或过期时终止认证。
- GitHub 拒绝授权或令牌交换失败时显示简短错误，不暴露访问令牌、Client Secret 或完整上游响应。
- OAuth Cookie 设置较短有效期，并在回调成功或失败后清除。
- 管理后台加载失败时保留可读的基础提示。

## 验证

1. 运行 OAuth 公共逻辑单元测试，覆盖 Cookie、来源、状态校验和错误分支。
2. 运行 `hugo --gc --minify`，确认 `/admin/index.html` 和 `/admin/config.yml` 被正确复制。
3. 本地启动 Hugo，检查后台页面能加载并解析集合配置。
4. 使用模拟环境变量调用 `/api/auth`，检查 GitHub 跳转参数、Cookie 和安全响应头。
5. 使用伪造或缺失的 `state` 调用回调，确认请求被拒绝。
6. 生产环境配置 OAuth App 和 Vercel 环境变量后，执行一次登录、编辑草稿和发布的端到端验证。

## 范围限制

- 本次不实现多用户角色、文章审核、数据库、全文搜索或独立媒体存储。
- 本次不迁移现有文章、不改变公开博客页面，也不修改当前未跟踪的 `static/images/`。
- 本次不提交或推送 Git 变更。
