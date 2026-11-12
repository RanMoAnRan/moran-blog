+++
title = 'DeepSeek Harness 插件实战清单：从四千个扩展里挑出真正值得留下的十个'
slug = 'deepseek-harness-top-10-plugins'
date = 2026-11-12T14:20:00+08:00
draft = false
tags = ['DeepSeek Harness', 'DSH', 'AI Coding', 'AI Agent', '开源', '效率工具']
categories = ['AI Tools', '开源']
summary = '两个月前聊过 DeepSeek Harness“一切都是插件”的微内核架构，如今社区插件已经涨到四千多个。面对热闹的下载榜，真正值得留下的并不是陪伴型挂件，而是能解决读图、文件引用、网页操作、上下文查账与技能管理这几类高频卡点的扩展。本文整理了一套可落地的 10 插件清单，并补上实际安装时的包名陷阱与安全边界。'
toc = true
math = false
+++

两个月前写过一篇《[DeepSeek Harness：当 AI Coding Agent 的一切都变成插件](/posts/deepseek-harness-everything-is-a-plugin/)》。当时我最在意的还是它的微内核架构：模型、工具、会话日志甚至 Agent Loop 全都挂在 Cordis 插件树上，同时也顺带提醒过这种设计必然带来的两笔账——**组合爆炸**和**生态信任**。

没想到短短两个月过去，DSH 的插件生态就已经冲到四千多个扩展。

插件一多，问题立刻就从“能不能扩展”变成了“到底该装哪几个”。翻一下近 30 天的社区下载榜，排在最前面的往往是报余额的小鲸鱼挂件、会在桌面打瞌睡的桌宠——热闹归热闹，但它们卖的是陪伴感，解决不了日常开发里真正卡住你的小事。

真正能让 DSH 从“架构漂亮的 Demo”变成“顺手的日常工作台”的，反而是那些平时存在感不强、但装完第二天就离不开的生产力插件。

下面这套 10 个插件的清单，整理自近期社区口碑与实测体验，并结合各项目最新的 GitHub 仓库与 npm 发布状态做了校准——**不只是列功能，也会把几个很容易踩进去的包名坑、Profile 隔离坑和隐私边界顺手标出来。**

## 先看结构：这十个插件补在工作台的哪一层

在动手装之前，先把这 10 个插件放回 DSH 的能力分层里看一眼，会比按顺序硬记名字清楚得多：

```text
入口层       ──► dsh-market（插件目录、分组、备注、备份与主题）
感知与输入层 ──► ModLens（补视觉读图） / dsh-at-file（@路径引用）
行动与交付层 ──► dsh-browser（真实浏览器）/ dsh-genui（交互界面）/ dsh-image-gen（生图工作流）
成本与观测层 ──► dsh-our-free-model（免费聚合网关）/ dsh-context（上下文与 token 账本）
协作与资产层 ──► DS-Bot（多 Bot 团队协作）/ dsh-skills-manager（跨工具技能总管）
```

按“先入口、再补高频能力、最后管成本与协作”的顺序去理解，基本不会装成一棵互相打架的圣诞树。

---

## 一、入口层：先把插件台账管起来

### 01. dsh-market：可视化插件市场与配置管家

装插件最开始都有个鸡生蛋的问题：你得先知道社区里有什么，才能决定装什么。

`dsh-market`（npm 包名是 `dshmarket`）补的就是这个入口。装上以后，DSH 的插件页会多出一个可视化的插件市场标签页（在 `dsh 0.2.1+` 中直接出现在 `Plugins` 页面 `Installed` 旁边；旧版则位于设置页），带分类筛选、星标、双语简介和截图预览，点一下就能原地安装，多数插件刷新页面即生效。

但用久了之后，它真正留住人的其实不是“能装”，而是**能管**：

- **插件备注与分组**：插件超过二三十个以后，很容易忘记当初为什么装某一个；你可以给每个插件写一行自己的备注，并按场景分组管理。
- **一键主题**：内置社区主题切换，不需要重启宿主进程。
- **配置导出与同步**：可以把当前 Profile 的插件清单和配置导出成 JSON，或同步到 WebDAV / GitHub Gist，换机器时直接恢复。
- **诊断提示词复制**：遇到版本或加载顺序冲突时，支持一键汇总错误与告警生成修复提示词。

```bash
# 常规 dsh web 环境安装（装完后重启 dsh web）
dsh plugin --profile web add dshmarket
```

> **实战踩坑提示（Web 与 Desktop 是两套 Profile）**：如果你同时在使用官方 `DSH Desktop` 桌面端，终端里执行 `--profile web` 只会装进 `profiles/web`，桌面端里是看不见的。桌面端请直接在软件内打开 **Settings → Plugins** 搜索 `dshmarket` 安装；另外 `dsh 0.2.1+` 的原生 Discover 页也支持手动添加 `https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json` 作为高速索引源。

---

## 二、感知与输入层：让纯文本模型“看见”并精准引用

DeepSeek 主力模型本身偏向纯文本推理，一遇到截图、UI 报错图、扫描件 PDF 就容易哑火；而写代码时如果想让模型看某个文件，手动全选复制既丑又费 token。这一组两个插件，补的就是输入这一环。

### 02. ModLens：给纯文本模型外接一双眼睛

`ModLens`（`@liustack/modlens`）的思路很工程化：既然当前模型本体不读图，就在外围接一套独立的视觉引擎。

当你把截图、照片或扫描件直接贴进对话框时，它会把图像送给视觉后端解析，再把**结构化 OCR 全文、按阅读顺序切分的版面区块、语义线索与不确定项**回传给主模型。使用上支持两种习惯：

- 把图片转成临时路径后，交由 `modlens_read_image` 工具按需读取；
- 或者直接切到带 `(modlens vision)` 后缀的模型变体，所见即所得。

更讨巧的是它的“零配置复用”设计：如果你本机已经装并登录过 Claude Code、Codex、OpenCode 或 Pi，或者配置了 Antigravity CLI / Gemini 免费额度，`ModLens` 可以直接复用现有通道，而且同一套技能也能跨工具共享。

```bash
npx -y @deepseek-ai/dsh plugin --profile web add @liustack/modlens
```

### 03. dsh-at-file：只传路径、不灌全文的 `@` 引用

以前让模型读本地文件，很多人习惯直接把几百行代码粘进输入框。这样不仅版面乱，还会让无关内容长期占满上下文。

`dsh-at-file` 把这个动作压成了一次 `@` 模糊搜索：在输入框敲 `@` 选中工作区文件或目录后，它**不会**把文件内容直接塞进 prompt，而是只在发送前附加一条极轻量的引用标记：

```xml
<workspace-reference path="docs/spec.pdf" kind="file" />
```

模型只在真正需要的时候再去调用读文件工具。它还专门做了一个很克制的默认行为——**忽略粘贴文本里的 `@path`**，防止你从别处复制一段带 `@` 的日志或代码时误触发引用栏。

```bash
# 适用于尚未升级到新版原生 @ 引用的环境（当前仓库最新标签为 v0.7.0）
dsh plugin --profile web add https://github.com/omdsh-dev/dsh-at-file/archive/refs/tags/v0.7.0.tar.gz
```

> **版本提醒**：`dsh-at-file` 仓库目前已经明确标注——**最新官方发布的 DeepSeek Harness 已原生内置 `@file` 与 `@session` 引用能力**。如果你用的是最新版的 DSH，直接用原生功能即可，不必再多挂一个第三方插件；只有停留在早期 `0.1.x` 版本的环境才需要单独安装它。

---

## 三、行动与交付层：从“只出文字”到“能点网页、能交界面”

看懂输入之后，下一步是把 Agent 的输出和行动边界往外推一步：操作真实网页、把文字回答渲染成交互组件、以及在对话里完成多模型生图。

### 04. dsh-browser：每个会话配一个真实浏览器

很多网页任务（比如登录后台查数据、填多步表单、点筛选器导出报表）光靠抓取静态 HTML 是跑不通的。`dsh-browser` 的做法不是模拟请求，而是直接给每个会话拉起一个真实的 Chrome 或 Edge 进程，并在右侧栏做实时画面镜像。

```text
Session A ──► 独立 Chrome/Edge 进程 + 独立 Cookie/登录态 + 独立 CDP 端口
Session B ──► 独立 Chrome/Edge 进程 + 独立 Cookie/登录态 + 独立 CDP 端口
```

它最实用的地方在于两点：一是**会话隔离**，A 会话的登录态和标签页不会串到 B 会话；二是**随时可接管**，右侧栏既能看着 Agent 用真实鼠标和键盘事件点网页，遇到验证码或需要人工确认的步骤时，你直接接手操作或通过独立 CDP 端口连上去调试就行。

```bash
# DSH >= 0.1.7-rc.1 推荐直接通过 scoped npm 包安装
dsh plugin --profile web add @cjylzs/dsh-browser

# 如需锁定标签版本从 GitHub 安装
dsh plugin --profile web add github:CJYLZS/dsh-browser#v0.3.1
```

> **包名避坑**：npm 上存在一个无前缀的同名包 `dsh-browser`，那是完全无关的另一个项目。命令行安装时务必写全 `@cjylzs/dsh-browser`。

### 05. dsh-genui：让模型回答直接变成可交互界面

绝大多数时候，让模型总结一份订单数据、对比几套架构方案或者出一套测验题，吐出来的一长串 Markdown 表格还是不够直观。

`dsh-genui`（`@changfenhuang/dsh-genui`）让模型可以在回复里通过 `dsh-ui` 代码块直接内联渲染出 30 多种界面组件——统计卡片、趋势图、可排序数据表、表单、测验、Mermaid 图甚至 3D 场景。

最值得留意的机制有两个：

1. **流式边写边挂**：模型还在输出后续文字，前面的图表组件就已经挂载渲染出来了；
2. **事件回传闭环**：你在界面上点刷新、切筛选条件、拖滑块，操作事件会回传给模型，让它基于最新交互状态继续调整结果。

```bash
dsh plugin --profile web add @changfenhuang/dsh-genui
```

> **同样注意包名陷阱**：npm 上无前缀的 `dsh-genui` 也是另一个完全不相关的 Vue/OpenTiny 包，必须安装 `@changfenhuang/dsh-genui`。此外，`dsh plugin` 底层依赖 `pnpm` 解析包，终端安装前需确保 `pnpm` 已在 `PATH` 中。

### 06. dsh-image-gen：把多后端生图收进同一个对话窗口

做内容或原型配图时，最割裂的体验往往是“在 A 网站生图、下载后丢进 B 工具改图、再回本地文件夹找版本”。`dsh-image-gen` 把整条链路直接收进了 DSH：文生图、图生图、多轮局部修改、批量创作画布，全部留在当前会话里。

它的扩展性做得很务实：

- 后端支持 Gemini、OpenAI、Seedream、DashScope、Grok、GLM，也可以对接本地 `ComfyUI`；
- 支持 **BYOK（自带订阅/密钥）**，直接复用手头已有的订阅或 Key，不必额外买一套中转；
- 内置 500 多条结构化 Prompt 灵感库，并且支持**同一个提示词并发让多个模型各出一版**做横向对比。

```bash
dsh plugin --profile web add dsh-image-gen@latest
```

> **配置入口提示**：在 DSH `0.1.6` 及以上版本中，安装重启后可在左侧边栏 **插件 → 已安装 → dsh-image-gen** 里找到“图像生成”配置面板（`0.1.5` 及更早版本则在设置页的插件配置里）。

---

## 四、成本与可观测层：管住入口账单，也看清上下文账本

插件越多、工具链越长，两个现实问题会很快冒出来：调用费用怎么降，以及长会话为什么越来越慢、越来越贵。

### 07. dsh-our-free-model：免 Key 聚合多渠道免费额度

如果你只是想低成本体验前沿模型、做非敏感代码的快速验证，或者懒得为每个新模型单独注册绑卡，`dsh-our-free-model` 在社区里人气极高。它把十几家平台的新用户额度与编码助手免费通道（包括 DeepSeek V4.1 Flash、Kimi K3、CodeArts、CodeBuddy、Qoder、TRAE、Cline、Gemini 等渠道）聚合成了一个统一的 `"Our Free Model"` 模型分组，免填 Key 即可直接切换，还顺带提供一个本地 OpenAI 兼容转发端口，方便本机的 Claude Code、Codex 或 `curl` 直接调用。

```bash
dsh plugin add dsh-our-free-model
```

> **必须划清的安全边界**：便宜和免费从来不是没有代价的。使用这类聚合插件时，**你的对话内容会经过第三方网关或上游免费渠道，部分上游通道明确声明 prompt 可能被记录**。我在之前的文章里反复提过“隐私边界”与“插件即受信任代码”——拿它跑公开技术问答、写小脚本、测玩具原型完全没问题；**公司内网代码、客户资料、身份证件、API 密钥和账号凭据，一律不要碰这个分组，老老实实走可控的付费 API 或本地模型。**

### 08. dsh-context：给长会话配一本明明白白的“上下文账本”

做过长会话开发的人都有体感：聊到第 20 轮以后，响应突然变慢、费用突然飙升、模型还开始“降智”。大多数时候不是模型变笨了，而是上下文窗口里不知不觉塞进了大量冗余信息。

在上一篇聊 DSH 架构时我提到过，DSH 把会话做成了 append-only 的事件日志，每次请求模型前再由 `deriveMessages()` 投影出当前上下文。`dsh-context` 正是踩在这个机制上长出来的可观测插件——它把每一次请求究竟喂给了模型什么，拆开摊在台面上：

- 系统提示词占了多少 token；
- 各个插件注入的工具 Schema 占了多少；
- 模型思考过程、工具返回、读过的文件、跑过的命令各自消耗了多少；
- 这一轮比上一轮新增了什么，以及什么时候触发过上下文压缩。

它提供 5 个查看入口（全局 `Context Insights` 面板、会话内 `Context` 标签、多 Agent 的 `Fleet` 标签、右侧边栏以及 `/context` 斜杠命令），底层看的是同一份账本。**长会话跑不动的时候，先别急着换更贵的模型，先打开它查一遍“到底是谁吃掉了窗口”，往往立刻就能定位元凶。**

```bash
dsh plugin --profile web add dsh-context
```

---

## 五、协作与资产复用层：从单兵对话框走向团队与统一技能库

最后两个插件，解决的是“单窗口单兵作战的天花板”和“跨工具技能资产散落各处”的问题。

### 09. DS-Bot：在 DSH 里养一支带长期记忆的 Bot 团队

`DS-Bot`（`Fei2411/DS-Bot`）把 DSH 从一问一答的单人窗口，直接改造成了一个常驻型的多智能体协作系统。

你可以给每个 Bot 起名字、定角色、分配最适合它的底层模型，并且由一个权限最高的 `Chief` 主控 Bot 负责统筹建群与派活——比如直接跟 `Chief` 说“拉一个负责写文案的和一个负责写代码的进群”，它就会自动创建角色并组织群聊协作。

它有两个设计特别贴合长期使用：

- **两级 Markdown 记忆**：每个 Bot 的个人记忆与团队共享记忆都落成纯本地 Markdown 文件（桌面端默认在 `~/.ds-bot`），每轮对话后自动审查增删。你交代过一次“汇报结论先给结果再展开过程”，下次不用再重复。
- **全本地落盘与独立形态**：既可以作为插件装进 DSH，现在也已经提供开箱即用的独立 `DS Bot` 桌面客户端。

```bash
# 通过 npm 包名或 GitHub 地址安装均可
npx @deepseek-ai/dsh plugin --profile web add ds-bot
# 或
dsh plugin add github:Fei2411/DS-Bot
```

### 10. dsh-skills-manager：不挪动原目录的跨工具技能总管

如果你像我一样，电脑里同时装了 DSH、Codex、Claude Code、Cursor 甚至其他 CLI Agent，大概率已经遇到过一个烦人的管理问题：大家都有各自存放 `SKILL.md` 的目录，想找一个写过的技能、更新某套工作流或者清理失效技能时，得在好几个隐藏文件夹里来回翻。

`dsh-skills-manager`（`@michengai/dsh-skills-manager`）做了一个很聪明的取舍：**只统一读取和管理，不强行搬动第三方工具的物理文件**。

它把散落在本机 20 多种 AI 编程工具里的技能统一收拢进四个视图：

- **全局技能 / 项目技能**：按目录或来源仓库浏览，支持自定义分类和拖拽归类（分类元数据独立存放，不污染原目录）；
- **发现中心**：打通 `ClawHub` 榜单与 `skills.sh` 市场，支持订阅公开 GitHub 仓库、增量检测更新与版本回退；
- **回收站**：误删技能时，支持连同原始安装路径与元数据一起原样恢复。

```bash
dsh plugin --profile web add @michengai/dsh-skills-manager
```

---

## 速查清单与稳妥的装配顺序

十个插件一次看完容易眼花，这里整理成一张速查表：

| 序号 | 插件 | 一句话定位 | 解决什么卡点 | 推荐安装标识符 |
| :--- | :--- | :--- | :--- | :--- |
| 01 | `dsh-market` | 可视化插件市场 | 找插件、分组备注、备份同步 | `dshmarket` |
| 02 | `ModLens` | 外接视觉引擎 | 纯文本模型看不懂图 | `@liustack/modlens` |
| 03 | `dsh-at-file` | `@` 路径引用 | 粘大段文件太费 token（新版已内置） | `omdsh-dev/dsh-at-file#v0.7.0` |
| 04 | `dsh-browser` | 真实隔离浏览器 | 模型只能读字、不会操作网页 | `@cjylzs/dsh-browser` |
| 05 | `dsh-genui` | 内联交互界面 | 纯文字回复不够直观、无法交互 | `@changfenhuang/dsh-genui` |
| 06 | `dsh-image-gen` | 对话式生图台 | 生图、改图与比对来回切工具 | `dsh-image-gen@latest` |
| 07 | `dsh-our-free-model` | 免费通道聚合 | 低成本试跑与多渠道白名单测试 | `dsh-our-free-model` |
| 08 | `dsh-context` | 上下文账本 | 看不清长会话变慢与烧钱的原因 | `dsh-context` |
| 09 | `DS-Bot` | 多 Bot 协作团队 | 单窗口单兵上限与跨角色记忆 | `ds-bot` |
| 10 | `dsh-skills-manager` | 跨工具技能总管 | 多款 Agent 的 Skills 散落难管 | `@michengai/dsh-skills-manager` |

最后给一条实操建议：**千万不要照着清单一口气全装上。**

DSH 插件不是只能改界面的浏览器皮肤，它们可以直接插进工具管线、修改侧栏 DOM、接管模型请求并读写本地环境。装得太猛，不但容易在侧栏和快捷键上打架，也会放大排查成本。

更稳妥的节奏是分三步走：

1. **第一天先装入口与账本**：`dshmarket` + `dsh-context`（如果本机是多 Agent 混用，再顺手加上 `dsh-skills-manager`），先把插件台账和上下文透明度立住；
2. **第二周按高频卡点补能力**：经常丢报错截图就加 `@liustack/modlens`，经常让 Agent 查后台或填表就加 `@cjylzs/dsh-browser`，偏重数据分析与演示则上 `@changfenhuang/dsh-genui`；
3. **最后再决定要不要多体协作与免费通道**：确认日常工作流稳定之后，再按需引入 `DS-Bot`，以及在严格隔离敏感数据的前提下试用 `dsh-our-free-model`。

DSH 最有意思的地方，在于它把“工作台长成什么样”的决定权还给了使用者。真正决定体验的，从来不是你装了多少个插件，而是你有没有把自己每天最常被卡住的那几件小事，精准地填进插槽里。

---

## 相关链接

- 生态项目索引：[dsh-market](https://github.com/dsh-market/dsh-market) · [modlens](https://github.com/liustack/modlens) · [dsh-at-file](https://github.com/FSMargoo/dsh-at-file) · [dsh-browser](https://github.com/CJYLZS/dsh-browser) · [dsh-genui](https://github.com/omdsh-dev/dsh-genui) · [dsh-image-gen](https://github.com/shanliuling/dsh-image-gen) · [dsh-context](https://github.com/bowenliang123/dsh-context) · [DS-Bot](https://github.com/Fei2411/DS-Bot) · [dsh-skills-manager](https://github.com/MichengAI/dsh-skills-manager)
