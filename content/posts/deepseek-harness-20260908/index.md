+++
title = 'DeepSeek Harness：当 AI Coding Agent 的一切都变成插件'
slug = 'deepseek-harness-everything-is-a-plugin'
date = 2026-09-08T14:00:00+08:00
draft = false
tags = ['DeepSeek Harness', 'DSH', 'AI Coding', 'AI Agent', '开源']
categories = ['AI Tools', '开源']
summary = 'DeepSeek Harness 最值得看的地方，不是 DeepSeek 又做了一个 Coding Agent，而是它把模型适配器、工具注册表、会话日志，甚至 Agent Loop 本身都降成了插件：产品不再是一个焊死的程序，而是一棵启动时组装出来、运行时还能替换的插件树。'
toc = true
math = false
+++

最近看 `DeepSeek Harness`，也就是 `DSH`，我第一反应不是“DeepSeek 终于也做 Claude Code 了”。

如果只是把模型接进终端，让它读文件、改代码、跑命令，今天已经不是什么稀奇事。Claude Code、Codex、OpenCode，以及一长串开源 Agent，早就把这套交互做成了标准答案。

DSH 真正值得看的地方，是它连这套“标准答案”本身都不想固定下来。

在它的架构里，模型适配器是插件，工具注册表是插件，会话日志是插件，权限和沙箱是插件，Web 界面是插件，连负责驱动模型与工具往返的 Agent Loop 也是插件。

官方给出的那句定位很直接：

> Everything is a Plugin.

这不只是说“DSH 支持安装插件”。几乎所有成熟开发工具都有插件系统。DSH 更激进的地方在于：**插件不是长在产品外面的附加能力，插件拼起来以后才是产品本身。**

## 它到底是什么

Harness 这个词不太好直译。

它不是单纯的聊天界面，也不只是一个调用大模型的 SDK。它更像模型与真实开发环境之间的“装备系统”：一边接住模型输出，另一边管理文件、Shell、工具、权限、会话、上下文、界面和外部服务，让模型真正能够连续做事。

简单画一下，大概是这样：

```text
用户 / Web / SDK / ACP
          │
          ▼
     Agent Loop
          │
    ┌─────┼──────────┐
    ▼     ▼          ▼
  LLM   Session    Tools
                  │
           ┌──────┼──────┐
           ▼      ▼      ▼
          FS    Shell    MCP
           │      │
           └── Sandbox / Approval
```

大多数 AI Coding 产品也能画出一张类似的图。区别在于，别人的图通常在描述“程序内部有哪些模块”，DSH 的图描述的是“当前挂载了哪些插件”。

这些能力都通过底层框架 `Cordis` 接到一个共享的 `ctx` 上。`ctx.llm` 提供模型调用，`ctx.tools` 提供工具注册和执行，`ctx.sessions` 管会话，`ctx.agents` 管正在运行的 Agent。插件声明自己依赖什么服务、提供什么服务，依赖准备好以后再加载；依赖消失，插件也会自动卸载，等服务回来以后重新加载。

所以 DSH 并没有一个高高在上、只能修改源码才能碰的“神圣核心”。想换模型适配器，不必改 Agent Loop；想把本地文件系统换成远程沙箱，不必复制一套 Shell 工具；想在工具执行前加审计，也不必往循环里塞条件判断。

你做的事情，是在插件树上挂一个新节点，或者替换原来的节点。

## “一切都是插件”到底意味着什么

普通插件系统的结构通常是这样的：

```text
固定核心
├── 固定会话
├── 固定 Agent Loop
├── 固定工具系统
└── plugins/
      ├── GitHub
      ├── Jira
      └── 自定义命令
```

核心先决定产品是什么，插件只负责让它“多会一点东西”。

DSH 的结构更接近：

```text
Cordis Context
├── session plugin
├── llm plugin
├── agent-loop plugin
├── tools plugin
├── persistence plugin
├── sandbox plugin
├── approval plugin
└── web / headless / sdk / acp plugin
```

这里没有明显的“核心产品”和“外围插件”分界。模型、循环、存储和界面处在同一个组合系统里。

这带来一个很有意思的变化：DSH 的产品形态不是编译时决定的，而是启动时组合出来的。

官方自带 `web`、`headless`、`sdk`、`sdk-minimal` 和 `acp` 等 profile。`web` 组装出浏览器应用；`headless` 适合跑一次性任务；`sdk` 提供 JSON-RPC 服务；`acp` 面向自动化协议。它们不是几套各写各的程序，而是从同一批能力里选择不同组合。

profile 下面又是一层 bundle。bundle 是一个带配置层的 npm 包，告诉 DSH“我要往插件树里插入或覆盖哪些节点”。基础 bundle 先放进模型、工具、持久化、沙箱、审批、凭据等公共能力，后面的 bundle 再叠加界面或运行方式，用户自己的 `cordis.patch.yml` 最后继续覆盖。

```text
空配置
  │
  ├── dsh-base
  ├── surface bundle（web / headless / sdk / acp）
  ├── profile patch
  ├── home patch
  └── --patch 临时覆盖
          │
          ▼
      最终插件树
```

后加载的层可以按 ID 替换前面的配置。你不需要 fork 整个项目，只要在更上面加一层自己的 patch。

这套设计很像 Linux 发行版、依赖注入容器和浏览器扩展系统混在一起：底层提供组合规则，上层决定最终长成什么样。

## Agent Loop 也只是一个可替换节点

AI Agent 看起来很神秘，扒开以后通常还是一个循环：收消息，请求模型，执行工具，把结果送回模型，直到没有下一步。

DSH 把这个过程拆成 `turn` 和 `step`。

一个 `step` 是一次模型请求，加上这次回复触发的工具调用。一个 `turn` 可以包含零个或多个 step：只要工具结果要求模型继续，或者又有输入进入队列，当前 turn 就接着向下跑；没有事情欠着，turn 才真正结束。

```text
turn/start
  │
  ├── 取出输入
  ├── 组装 System Prompt 和工具 Schema
  ├── step/start
  │     ├── 请求模型
  │     ├── 接收流式回复
  │     ├── 执行 tool/call
  │     └── 写入 tool/result
  ├── 还有工具结果或新输入？── yes ──> 下一个 step
  │
  └── turn/end
```

重要的不是循环本身，而是循环周围布满了事件口。

模型请求前有 `agent/request`，工具执行前后有 `tools/pre-execute` 和 `tools/post-execute`，Agent 即将停止时有 `agent/turn-stopping`。插件可以监听、改写或拦截这些事件，而不必直接修改 Loop。

例如，要给工具调用加审批，可以挂在执行管线前；要注入项目上下文，可以在请求组装阶段加入；要替换模型，只需要给 `ctx.llm` 注册新的 adapter。默认 Loop 只是这套接口的一种实现，理论上你甚至可以把整个决策循环换掉。

这就是 DSH 和一般“支持 hooks 的 Coding Agent”最本质的差别。hooks 通常是在固定流程上留几个洞，DSH 则把流程本身也放进了可组合系统。

## 会话不是聊天记录，而是事件日志

DSH 里另一个很有分量的设计，是 append-only 的 Session Event Log。

它不把发送给模型的 messages 当作第一份数据。用户消息、模型回复、失败尝试、工具调用、工具结果、turn 和 step 的边界，都会先变成带类型的事件追加到会话日志里。真正请求模型时，再由 `deriveMessages()` 从日志投影出当前上下文。

它有一条很硬的规则：

> 模型能看到的内容，必须能从日志里重建。

这条规则解决的是 Agent 系统里一个经常被忽略的问题：你在界面里看到的、磁盘里存的、模型实际收到的，究竟是不是同一段历史？

如果上下文在运行过程中被插件偷偷拼接，进程重启后又无法还原，那么会话恢复、分叉、追踪和调试都会变成猜谜。DSH 强制模型可见输入落进日志，系统提示词和工具 schema 的请求快照也被记录下来，于是恢复和回放不必依赖“当时大概是怎么组装的”。

失败也不是简单丢掉。成功回复会沉淀为 `assistant/message`，失败、重试、取消或流错误可以作为 attempt 留在日志里，但不一定进入下一次模型上下文。也就是说，**事实可以被保留，但不必都继续污染对话表面。**

上下文压缩也沿用这个思路。压缩不是粗暴删掉旧 messages，而是在日志中记录选择范围、摘要、被遮蔽的事件和模型调用信息，再用一次 surface replacement 改变模型看到的会话表面。原始历史还在，当前上下文只是它的一种投影。

这让 Session 不只是“聊天记录”，更像 Agent 的事件溯源账本。

## Capability Seam：换一个 Provider，整条链一起移动

DSH 文档里经常出现一个词：`seam`，接缝。

一项能力通常被拆成三部分：

```text
Service Definition  -> 定义接口
Service Provider    -> 提供实现
Consumer            -> 消费能力，通常是模型可见工具
```

以文件系统为例，工具不应该偷偷假设文件一定在本机；Shell 也不该自己决定进程怎么启动。它们依赖抽象的文件和子进程能力，具体 provider 可以指向本地，也可以指向远程沙箱。

这个边界一旦守住，替换 provider 时移动的就不只是一个工具，而是整个执行世界。文件访问、Bash、PTY、LSP 可以一起落到同一个远程环境里，不需要为 Docker、SSH 或云沙箱各 fork 一套 Agent。

MCP 在这里也不再是特殊外挂。它只是工具能力的一种 provider。Web 搜索同样可以拆成服务定义、Exa 或 DeepSeek 等搜索 provider，以及暴露给模型的 `web_search` 工具。

这套抽象的价值不在“支持多少工具”，而在能力之间没有偷偷绑死。

很多 Agent 项目刚开始只有一个 `bash()` 和一个 `readFile()`，功能当然跑得起来。等到要加远程执行、权限审计、多租户、浏览器客户端时，才发现本地路径、进程环境和用户状态早就渗进了每一层。

DSH 是反过来：先承认 Agent 最终一定会跨模型、跨界面、跨执行环境，再从一开始把接缝留下。

## 可插拔越彻底，权限边界越不能含糊

“一切都是插件”听起来很自由，但自由的另一面是攻击面。

一个 DSH 插件不是浏览器里改改主题的脚本。它可能接触模型请求、读取会话、注册工具、启动进程、访问网络，甚至替换权限相关能力。只要插件处在信任链里，它就可能碰到用户交给 Agent 的真实工作区和凭据。

DSH 把沙箱与审批拆成两个独立开关：

```text
sandbox/mode     -> 命令和文件操作能到哪里
approval/policy  -> 哪些动作必须先问用户
```

界面里的权限预设只是把这两个开关组合起来。例如 `workspace-write + ask` 是在工作区内允许写入，但敏感动作需要确认；`danger-full-access + never` 则几乎完全放开。

这种拆分是对的。沙箱回答“能不能做到”，审批回答“做之前要不要问”，两者不是一回事。只有弹窗而没有隔离，点错一次就什么都能做；只有隔离而没有审批，Agent 仍然可能在允许范围内做出破坏性操作。

但架构上的边界不等于安全承诺。官方目前仍把 DSH 标为 developer preview，明确提醒项目尚未经过安全审计，兼容性也会发生破坏性变化。沙箱和审批只能降低风险，不能替代容器、虚拟机、最小权限与插件审查。

尤其当插件可以参与底层能力组合时，“安装一个插件”实际上更接近“给运行时增加一段受信任代码”，而不是给编辑器换个皮肤。

## 它和 Claude Code、Codex、OpenCode 的差别

把 DSH 直接叫作“DeepSeek 版 Claude Code”，不能说完全错，但会漏掉它最特别的部分。

Claude Code 和 Codex 首先是完成度较高的产品。用户关心的是打开以后能不能理解项目、调用工具、修改代码、跑测试，以及权限体验是否顺手。它们也有 MCP、skills、hooks 或配置扩展点，但产品主干仍由官方定义。

OpenCode 更开放。它支持多模型 provider、插件、MCP、不同 Agent 和细粒度权限，用户可以把它改造成自己的工作台。从使用体验看，它和 DSH 的距离比 Claude Code、Codex 更近。

DSH 的区别不在于功能列表一定更长，而在于它把“可替换”推进到了更底层：Agent Loop、Session、LLM、Tools、Persistence 和前端入口都只是 Cordis 插件树上的节点。

```text
Claude Code / Codex  -> 先是一款产品，再提供扩展点
OpenCode             -> 开放、多模型、可配置的 Coding Agent
DeepSeek Harness     -> 先是一套可组合运行时，再组装成产品
```

这不是严格的优劣顺序。

想装完就写代码，产品化程度高往往更重要；想接很多模型，OpenCode 的现成 provider 生态可能更省事；想研究 Agent 基础设施、替换执行环境、嵌入自己的系统，DSH 这种微内核式结构才真正有吸引力。

换句话说，前三者更经常在回答“这个 Agent 好不好用”，DSH 还在回答另一个问题：**一个 Agent 到底应该由什么组成。**

## 抽象不是免费的

DSH 的设计很漂亮，但漂亮不等于便宜。

第一笔成本是理解门槛。要真正看懂一个功能从哪里来，不能只搜某个入口函数，还要顺着 profile、bundle、patch、plugin、service 和 event 一路追下去。对普通用户来说，这套词汇比改一份 JSON 配置重得多。

第二笔成本是组合爆炸。当模型、工具、存储、权限、界面都能替换，不同插件版本和加载顺序就可能产生大量状态。后层按 ID 覆盖前层很灵活，但灵活也意味着“当前到底跑的是什么”需要更强的可观测性。`dsh --profile web --dump-config` 不是锦上添花，而是这类系统的生存必需品。

第三笔成本是生态信任。插件越强，审核越重要。一个普通 UI 插件出错，最多界面难看；一个能插进工具执行管线、模型请求或凭据服务的插件出错，后果完全不同。

第四笔成本是项目仍然太早。developer preview 意味着今天写下的插件接口、配置层和运行方式，明天可能就要迁移。现在的 DSH 更适合愿意读文档、接受破坏性变更的开发者，不适合把“稳定省心”放在第一位的人。

所以它目前更像一份公开的架构主张，而不是已经赢下市场的最终答案。

## 总结

DeepSeek Harness 最值得看的，不是 DeepSeek 又给自己的模型做了一个壳。

事实上，它并没有把自己锁死在 DeepSeek 模型上。模型只是 `ctx.llm` 后面的 adapter，和工具、会话、存储、沙箱一样，可以被组合和替换。

它真正想做的，是把 AI Coding Agent 从一个封闭应用拆成一棵插件树：

```text
模型决定怎么思考
工具决定能做什么
权限决定可以做到哪里
会话决定过去如何被记住
界面决定人怎么参与
Profile 决定这些东西如何组装
```

过去我们总在比较模型。谁写代码更准，谁上下文更长，谁推理更强。但 Agent 真正进入工程以后，模型只占其中一层。它怎么拿到上下文，怎么调用工具，失败如何记录，权限在哪里拦住，执行环境如何替换，这些 Harness 层的问题会越来越重要。

Claude Code 和 Codex 在把 Agent 做成更完整的产品，OpenCode 在把多模型 Coding Agent 做得更开放，DSH 则往下挖了一层：它试图把“产品是怎么长出来的”本身变成可编程对象。

这条路会带来复杂度，也未必适合所有人。但如果未来的 AI Agent 真要像今天的操作系统和浏览器一样长出庞大生态，那么“一切都是插件”就不只是一个漂亮口号。

它可能是在提前定义那个生态的插槽。

## 相关链接

- GitHub: https://github.com/deepseek-ai/deepseek-harness
- 官方文档: https://deepseek-harness.github.io/deepseek-harness/
- 架构说明: https://deepseek-harness.github.io/deepseek-harness/en/reference/
- 插件开发: https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/
