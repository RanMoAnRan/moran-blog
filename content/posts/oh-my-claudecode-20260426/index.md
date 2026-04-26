+++
title = 'oh-my-claudecode：把 Claude Code 变成多智能体工程控制台'
slug = 'oh-my-claudecode-multi-agent-control-console'
date = 2026-04-26T19:10:00+08:00
draft = false
tags = ['oh-my-claudecode', 'Claude Code', 'AI Coding', 'AI Agent', '多智能体']
categories = ['AI Tools', '开源']
summary = 'oh-my-claudecode 最有意思的地方，不是让 Claude Code 多几个快捷命令，而是把它改造成一个可以调度 Claude、Gemini、Codex 等多种智能体的工程控制台。'
toc = true
math = false
+++

如果说 Claude Code 解决的是“怎么让 AI 更深入地参与代码开发”，那么 `oh-my-claudecode` 想解决的就是下一个问题：

**当 AI 不再只是一个助手，而是一组可以被调度的 worker 时，我们应该怎样组织它们？**

这也是我觉得 `oh-my-claudecode` 值得单独写一篇的原因。

它不是简单给 Claude Code 加一堆提示词，也不是只做几个斜杠命令。它更像是在 Claude Code 外面搭了一层多智能体工程控制台：可以启动不同类型的 worker，可以把任务拆给 Claude、Gemini、Codex，可以通过 tmux 管理长期运行的 agent，也可以用 Autopilot、Ralph、Ultrawork、Team、Planning 等模式把复杂开发任务流程化。

换句话说，它关注的不是“这一次模型回答得好不好”，而是“整个 AI 工程团队怎么运转”。

## 它到底是什么

`oh-my-claudecode`，通常也简称 OMC，是一个围绕 Claude Code 构建的多 AI 编排插件。

它的核心思路可以概括成一句话：

> 把 Claude Code 从单一 AI Coding 助手，扩展成一个可以管理多种模型、多种 worker、多种工作流的开发控制台。

从项目定位看，它提供的能力大致包括：

- 多智能体 worker 管理
- Claude、Gemini、Codex 等不同 agent 的协同
- tmux 会话驱动的长期任务运行
- Autopilot 自动推进模式
- Ralph 持续执行模式
- Ultrawork 高强度并行工作流
- Team 多 agent 团队协作
- Planning 计划与审查流程
- Hooks、Commands、MCP、状态管理等运行时能力

这些能力放在一起，就不太像传统意义上的“Claude Code 配置增强包”，而更像一个面向 AI Coding 的控制平面。

Claude Code 负责具体的理解、生成、修改和工具调用；OMC 负责在更高层面决定：任务怎么拆、谁来做、什么时候继续、什么时候停、状态怎么保存、多个 agent 怎么互相配合。


## 技能全景：OMC 到底内置了哪些能力

如果只说 OMC 是“多智能体编排插件”，其实还不够具体。更准确地看，它的能力被拆成了一组可调用的 skills。每个 skill 都对应一种相对固定的工作流，覆盖安装配置、任务规划、研究、执行、验证、团队协作、记忆沉淀、可视化检查、发布管理等环节。

下面按使用场景把这些技能梳理一遍。

### 1. 安装、诊断与基础配置

这组技能负责让 OMC 自己可用、可检查、可维护。

#### `setup`

`setup` 是安装和更新相关请求的入口路由。它更像一个总分流器：当你说“安装 OMC”“更新 OMC”“配置 MCP”“检查环境”时，它会把请求转给更具体的 setup、doctor 或 MCP 流程。

它适合放在最前面使用，尤其是你不确定当前环境是否已经装好 OMC，或者不知道该调用哪个安装命令时。

#### `omc-setup`

`omc-setup` 更偏向正式安装或刷新 OMC 本体。它覆盖 plugin、npm、本地开发等不同安装形态，并尽量走官方推荐的 canonical setup flow。

如果 `setup` 是路由层，那么 `omc-setup` 就是实际安装执行层。

#### `omc-doctor`

`omc-doctor` 用于诊断和修复 OMC 安装问题。

它适合处理这类情况：命令找不到、插件没有生效、路径不对、依赖缺失、版本状态异常、某些模式无法启动。它的目标不是执行业务任务，而是先把 OMC 自己修到健康状态。

#### `mcp-setup`

`mcp-setup` 用来配置常见 MCP server，让 agent 获得更强的工具能力。

MCP 在 OMC 里很重要，因为很多复杂工作流都依赖外部工具、上下文服务、文档能力或状态管理。`mcp-setup` 解决的是“agent 能接哪些工具、怎么接”的问题。

#### `configure-notifications`

`configure-notifications` 用自然语言配置通知集成，比如 Telegram、Discord、Slack。

这类能力适合长任务。比如 Autopilot、Ralph、Team 运行时间较长时，任务完成、失败或需要人工介入，都可以通过通知通道提醒用户。

#### `hud`

`hud` 负责配置 HUD 显示选项，比如布局、预设、展示元素。

HUD 的意义是把 OMC 的运行状态可视化，帮助用户理解当前模式、worker 状态、任务进度和关键提示。对于多 agent 工作流来说，可观察性非常重要。

### 2. 规划、澄清与需求收敛

这组技能解决的是 AI Coding 最容易翻车的问题：还没想清楚就开始改。

#### `deep-interview`

`deep-interview` 是苏格拉底式深度访谈技能。它会在需求模糊时持续提问，直到目标、约束、边界和成功标准变得足够清楚。

它的重点不是执行，而是防止错误执行。对于产品需求、架构改造、复杂功能设计，这个技能非常关键。

#### `plan`

`plan` 是战略规划技能，支持可选的 interview workflow。

它适合在正式编码前形成路线图：要改什么、为什么改、怎么验证、有哪些风险、执行顺序是什么。相比 `deep-interview`，`plan` 更靠近“形成方案”。

#### `ralplan`

`ralplan` 是面向 Ralph、Autopilot、Team 等执行型模式的共识规划入口。

它特别适合在用户请求比较模糊，但又想直接启动自动化执行时进行拦截。换句话说，它会先判断目标是否足够清楚，如果不清楚，就先规划和澄清，而不是让 agent 立刻开干。

#### `deep-dive`

`deep-dive` 是一个两阶段流程：先 `trace` 做因果调查，再 `deep-interview` 做需求结晶。

它适合那种“既不清楚问题根因，也不清楚最终该怎么改”的场景。先追踪事实，再澄清目标，避免在错误问题上做正确执行。

### 3. 研究、追踪与外部上下文

这组技能负责获取证据、分析系统、查文档和形成判断。

#### `autoresearch`

`autoresearch` 是有状态的单任务研究循环。它强调 evaluator contract、markdown decision logs 和 max-runtime stop behavior。

简单说，它不是随便搜一搜，而是围绕一个研究目标持续探索、记录判断、在时间上限内停止，并输出可追溯的研究结论。适合分析陌生模块、技术方案、历史行为和复杂 bug。

#### `trace`

`trace` 是证据驱动的追踪通道，会组织多个 tracer hypothesis，在 Claude 内置 team 模式下竞争式调查。

它适合排查因果链：一个 bug 为什么发生？请求从哪里进入？状态在哪里改变？哪个分支导致了错误？它强调从证据出发，而不是靠猜。

#### `debug`

`debug` 用于诊断当前 OMC session 或仓库状态。它会结合日志、trace、state 和聚焦复现来定位问题。

它不仅可以调试业务代码，也可以调试 OMC 当前会话本身：比如某个模式为什么卡住、状态为什么异常、worker 为什么没有按预期执行。

#### `external-context`

`external-context` 会调用并行的 document-specialist agents 来做外部 Web 搜索和文档查找。

它适合处理依赖官方文档、第三方库、最新 API、迁移指南的任务。它的价值是把“查资料”从主执行 agent 中拆出来，减少主线任务被打断。

#### `sciomc`

`sciomc` 会编排并行 scientist agents 做综合分析，并支持 AUTO mode。

它更像研究型多智能体流程，适合复杂技术比较、架构分析、根因分析、方案评估。和普通 `autoresearch` 相比，它更强调多研究者并行分析。

#### `ask`

`ask` 是一个 process-first advisor routing 技能，可以通过 `omc ask` 路由给 Claude、Codex 或 Gemini，并捕获 artifact，而不是让用户手写底层 CLI 命令。

它适合把问题交给合适的模型咨询，同时保留结果，避免临时命令散落在终端里。

#### `ccg`

`ccg` 代表 Claude-Codex-Gemini 三模型编排。它会通过 `/ask codex` 和 `/ask gemini` 获取结果，再由 Claude 综合。

这个技能很适合需要多模型交叉验证的问题。比如方案设计、代码审查、复杂 bug 分析，可以让不同模型给出独立观点，再统一归纳。

### 4. 自动执行与持续推进

这组技能负责真正“把事情做完”。

#### `autopilot`

`autopilot` 是从 idea 到 working code 的全自动执行模式。

它适合目标明确、风险可控、验证方式清楚的任务。比如实现一个小功能、修复一个有明确复现路径的 bug、补一组测试。它的优势是减少人工来回指挥，但前提是任务边界足够清楚。

#### `ralph`

`ralph` 是一个自引用循环，目标是持续执行直到任务完成，并可配置 verification reviewer。

它比普通执行更强调“不要半途停在建议阶段”。Ralph 会围绕目标不断行动、验证、修复，直到达到完成条件。适合测试修复、构建修复、迁移清理等需要多轮迭代的任务。

#### `ultrawork`

`ultrawork` 是高吞吐并行执行引擎。

它适合任务列表较多、可并行度较高的场景，比如批量修复、批量迁移、批量文档更新、多个独立 issue 并行处理。它的重点是吞吐，而不是单点深度分析。

#### `ultraqa`

`ultraqa` 是 QA 循环技能：test、verify、fix、repeat，直到目标达成。

它适合质量治理类任务。比如“让测试全部通过”“修复这个 flaky test”“确保构建和 lint 都通过”。它的核心是验证闭环，而不是一次性修改。

#### `self-improve`

`self-improve` 是自主进化式代码改进引擎，带 tournament selection 的味道。

它适合探索多个改进方案，然后比较优劣，保留更好的实现。这个技能更实验性，也更适合可度量、可验证、可回滚的优化任务。

#### `cancel`

`cancel` 用于取消当前活跃的 OMC 模式，包括 autopilot、ralph、ultrawork、ultraqa、swarm、ultrapilot、pipeline、team 等。

自动化能力越强，停止机制越重要。`cancel` 就是刹车。

### 5. 团队协作与多 agent 编排

这组技能体现了 OMC 最核心的多智能体能力。

#### `team`

`team` 会在共享任务列表上协调 N 个 agent，使用 Claude Code native teams。

它适合复杂任务拆分：研究、实现、测试、审查、文档可以分给不同 agent。关键是任务必须有清晰边界，否则 team 只会放大混乱。

#### `omc-teams`

`omc-teams` 是 CLI-team runtime，可以在 tmux pane 中运行 claude、codex 或 gemini worker。

如果说 `team` 更偏 Claude Code 原生团队能力，那么 `omc-teams` 更偏进程级、多 CLI、多模型的运行时管理。它适合需要真实终端 worker 并行工作的场景。

#### `project-session-manager`

`project-session-manager` 是 worktree-first 的开发环境管理器，面向 issue、PR 和 feature，并支持可选 tmux session。

它解决的是多任务并行时的环境隔离问题。不同 issue 或 feature 可以有不同 worktree，减少互相污染，也更容易回滚和切换。

#### `omc-reference`

`omc-reference` 是 OMC 的参考目录技能，包含 agent catalog、可用工具、team pipeline routing、commit protocol 和 skills registry。

当你委派 agent、使用 OMC 工具、组织团队、提交代码或调用技能时，它会自动加载相关参考信息。它更像系统内置手册，保证 agent 知道 OMC 自己有哪些规则和能力。

### 6. 验证、审查与质量控制

这组技能负责防止 AI “自信地说完成了，但其实没验证”。

#### `verify`

`verify` 的目标很直接：在声称完成之前，确认改动真的有效。

它会推动 agent 做实际验证，而不是只看代码逻辑。比如跑测试、复现问题、检查输出、确认构建。这个技能应该成为所有自动执行任务的收尾习惯。

#### `visual-verdict`

`visual-verdict` 用于截图和参考图之间的结构化视觉 QA 判断。

它适合前端、设计稿还原、截图回归、UI 验收。相比“看起来差不多”，它要求给出结构化 verdict，更适合纳入 QA 流程。

#### `ai-slop-cleaner`

`ai-slop-cleaner` 用 deletion-first workflow 清理 AI 生成代码里的 slop，并支持 reviewer-only mode。

这里的 slop 可以理解为 AI 常见的代码垃圾：多余抽象、重复逻辑、无用兼容层、过度防御、虚假通用性、没被使用的 helper。它强调先删，再安全回归，而不是继续往上堆代码。

### 7. 记忆、知识库与技能沉淀

这组技能负责把一次性经验变成长期资产。

#### `remember`

`remember` 用于审查可复用的项目知识，并决定它应该进入 project memory、notepad，还是更持久的文档。

它解决的是“哪些东西值得记住”的问题。不是所有对话内容都该进记忆，只有项目约定、踩坑结论、稳定决策和可复用规则才值得沉淀。

#### `wiki`

`wiki` 是持久 markdown 知识库，目标是跨 session 持续积累。

它采用类似 Karpathy 所说的 LLM Wiki 思路：把 AI 和人的协作知识写成可读、可维护、可增长的 markdown，而不是埋在聊天记录里。

#### `learner`

`learner` 会从当前对话中提取一个 learned skill。

当某个流程在本次任务中被证明有效时，可以用它把经验抽象出来，形成未来可复用的技能雏形。

#### `skillify`

`skillify` 会把当前 session 中的可重复工作流转成 OMC skill draft。

它比 `learner` 更靠近“生成技能草稿”。适合把一套已经跑通的工作方式产品化，比如某项目的发布检查流程、特定框架的迁移流程、固定 QA 流程。

#### `skill`

`skill` 是本地技能管理器，支持 list、add、remove、search、edit 和 setup wizard。

如果说 `skillify` 负责生成技能草稿，那么 `skill` 负责管理技能生命周期。

#### `writer-memory`

`writer-memory` 是面向写作者的 agentic memory system，用于跟踪角色、关系、场景和主题。

这个技能看起来不像典型编程工具，但它说明 OMC 的技能系统并不局限于代码。它也可以服务长期写作、世界观设定、系列文章、小说创作等需要跨会话记忆的工作。

### 8. 项目发布与专项工作流

最后还有一些更专项的技能，处理特定阶段或特定类型工作。

#### `release`

`release` 是通用发布助手。它会分析仓库发布规则，把规则缓存到 `.omc/RELEASE_RULE.md`，然后引导发布。

它适合处理版本号、 changelog、tag、构建、发布检查等流程。重点是先学习项目自己的发布规则，而不是套一个固定模板。

#### `deepinit`

`deepinit` 用于深度代码库初始化，会生成层级化的 `AGENTS.md` 文档。

它适合新项目接入 OMC，或者让 agent 更好理解一个已有仓库。通过分层 `AGENTS.md`，可以把不同目录的约定、架构、注意事项沉淀下来。

## 这些技能可以怎样组合

单个 skill 有价值，但 OMC 真正强的地方在组合。

比如一个复杂重构任务，可以这样走：

1. `deep-interview` 澄清目标和边界
2. `trace` 或 `autoresearch` 研究当前实现
3. `ralplan` 形成可执行计划
4. `team` 或 `omc-teams` 分配 worker
5. `ralph` 或 `autopilot` 推进实现
6. `ultraqa` 持续跑测试、修复、再验证
7. `verify` 做完成前确认
8. `remember` 或 `wiki` 沉淀项目经验
9. `skillify` 把可复用流程变成新 skill

再比如一个前端视觉回归任务，可以这样走：

1. `plan` 明确验收标准
2. `visual-verdict` 对比截图和参考图
3. `ultraqa` 循环修复和验证
4. `ai-slop-cleaner` 清理修复过程中产生的多余代码
5. `verify` 做最终确认

这才是 OMC 的核心价值：它不是一堆孤立按钮，而是一组可以组合的工作流积木。

## 为什么 Claude Code 也需要控制台

Claude Code 本身已经很强。

它能读项目、能改文件、能跑命令、能理解上下文，也能在很多场景里完成从需求到实现的闭环。

但只要任务稍微复杂一点，问题就会从“模型能不能写”变成“流程能不能稳”。

比如你让 Claude Code 做这样一个任务：

> 重构前端状态管理，迁移旧 API 调用，补齐测试，并确保生产构建通过。

这个需求看起来是一句话，实际却可能涉及：

- 梳理当前状态管理结构
- 找到旧 API 的所有调用点
- 区分核心路径和边缘页面
- 制定迁移计划
- 小步替换实现
- 更新类型定义
- 补测试或调整 mock
- 运行 lint、test、build
- 根据失败结果继续修
- 最后输出变更说明和风险点

如果只靠一个连续对话硬推，容易遇到几个问题：

- 任务越长，上下文越容易变散
- 模型可能跳过计划直接改代码
- 验证失败后只修局部，不回看整体设计
- 多个方向无法并行探索
- 中途停止后恢复成本高
- 复杂变更缺少清晰的阶段边界

这时，一个更高层的编排系统就有意义了。

`oh-my-claudecode` 做的不是替代 Claude Code 的智能，而是给这种智能加上“组织方式”。

## 多 worker：从一个助手到一组工程代理

OMC 最核心的想象力，在于它把 AI Coding 从单助手模式推进到多 worker 模式。

在单助手模式里，你通常只有一个 Claude Code 会话。它既要研究需求，又要设计方案，还要写代码、跑测试、修错误、写总结。

这当然可以工作，但它有一个天然限制：所有任务都挤在一条执行链上。

多 worker 模式则不一样。

你可以把同一个目标拆成几个方向，让不同 agent 并行探索：

- 一个 worker 负责读代码和画调用链
- 一个 worker 负责找测试缺口
- 一个 worker 负责尝试最小改动方案
- 一个 worker 负责检查兼容性风险
- 一个 worker 负责整理文档和迁移说明

这更接近真实工程团队的工作方式。

真正重要的不是“同时有很多 AI 在干活”，而是每个 worker 都有相对清晰的角色、边界和产出。

否则，多智能体只会制造更多噪音。

OMC 的价值，就在于它试图把这些 worker 组织起来，而不是简单多开几个聊天窗口。

## Claude、Gemini、Codex：多模型协作的意义

`oh-my-claudecode` 另一个很有意思的地方，是它并不把能力锁死在单一模型或单一客户端里。

它强调 Claude、Gemini、Codex 等不同 AI worker 的协同。

这背后其实有一个很现实的判断：未来的 AI Coding，很可能不是“一家模型包打天下”，而是按任务类型选择不同能力。

比如：

- Claude 适合长上下文理解、复杂代码推理、结构化修改
- Gemini 可能适合大上下文检索、多模态或快速广域分析
- Codex 适合在终端开发流里做代码修改、测试修复、工程执行

当然，具体能力会随着模型版本变化，但“按任务路由到不同 worker”这个方向不会过时。

这就像真实团队不会让同一个人同时负责所有角色。架构师、实现者、测试者、审查者、文档维护者，关注点本来就不同。

多模型协作的价值，不是盲目叠加模型，而是利用差异化能力形成更稳的工作链。

## tmux：很朴素，但很工程化

我很喜欢 OMC 里 tmux 这个设计点。

听起来它没有那么“AI 原生”，甚至有点朴素。但恰恰是这种朴素，让它很适合工程场景。

tmux 的意义在于：worker 可以是长期运行的，可以被观察，可以被恢复，可以被切换。

AI agent 如果只存在于一次 API 调用或一个短会话里，很难处理长任务。真实开发经常需要等待测试、观察输出、继续修复、保留上下文、切换任务。

tmux 正好提供了一种成熟的终端会话管理能力：

- 每个 worker 可以有独立 pane 或 session
- 长任务不会因为前台切换而丢失
- 用户可以随时观察执行状态
- 中断后可以重新 attach
- 多个 agent 的输出可以并行存在

这不是花哨功能，却非常贴近真实开发。

很多 AI 工具的问题，恰恰不是模型不够先进，而是运行环境太像一次性聊天窗口。OMC 用 tmux 把 agent 拉回了工程师熟悉的终端世界。

## Autopilot、Ralph、Ultrawork：不同强度的自动化

OMC 里几个名字很有代表性：Autopilot、Ralph、Ultrawork。

它们背后其实对应不同强度的自动化工作方式。

Autopilot 更像自动驾驶：在目标明确、风险可控时，让系统持续推进，减少人工来回指挥。

Ralph 更像“执行到完成”的工作流：不是只给建议，而是围绕目标持续行动、观察结果、继续修复。

Ultrawork 听起来更激进，适合高强度并行推进任务，把多个 worker 和多个执行链组织起来。

这些模式说明 OMC 并不是只有一种“自动干活”的方式，而是在尝试区分不同场景下的自动化等级。

这很重要。

因为 AI Coding 最怕两个极端：

- 太保守，每一步都要人类重复确认，效率上不去
- 太激进，AI 自己一路狂改，最后很难 review

更合理的方式是按任务风险选择自动化强度。

小范围、可测试、易回滚的任务，可以更自动；涉及认证、支付、数据迁移、基础设施的任务，则应该更多计划、更多审查、更多人工确认。

## Planning：让 AI 先停下来想清楚

我一直觉得，AI Coding 里最容易被低估的能力不是“写代码”，而是“停下来计划”。

很多模型失败，不是因为不会写，而是因为写得太快。

它看到需求以后，立刻改文件；改到一半发现边界不对；再补一层兼容；测试挂了再局部修；最后整个改动越来越散。

Planning 模式的意义，就是把“先想清楚”变成流程的一部分。

一个好的计划至少应该回答：

- 要改哪些文件
- 为什么改这些文件
- 哪些行为必须保持不变
- 怎么验证结果
- 哪些地方风险最高
- 如果失败，如何回退

这看起来慢，但对复杂任务反而更快。

因为真正浪费时间的，往往不是计划本身，而是没有计划导致的返工。

## Team：不是让 agent 更多，而是让边界更清楚

Team 模式听起来最容易让人兴奋，但也最容易被误用。

多 agent 不是万能药。任务边界不清楚时，越多 agent 只会越乱。

一个有效的 team workflow，关键是先定义角色和产出：

- 研究 agent：输出现状分析和调用链
- 计划 agent：输出改造路线和风险点
- 实现 agent：按计划做最小可行修改
- 测试 agent：补用例并运行验证
- review agent：检查 diff、边界和回归风险

如果每个 agent 都只是在“帮我完成这个需求”，那就很容易重复劳动。

所以我理解 OMC 的 Team 价值，不是把同一句话广播给多个模型，而是提供一个可以管理角色、状态和执行结果的框架。

这才是多智能体协作真正有用的地方。

## 它和普通 Claude Code 配置有什么区别

很多 Claude Code 配置项目，本质上是在提供：

- 更好的 CLAUDE.md
- 更好的 commands
- 更好的 hooks
- 更好的 agents 或 skills

这些当然有价值。

但 `oh-my-claudecode` 更进一步，它关注的是运行时编排。

普通配置更像“给一个 AI 助手制定工作规范”；OMC 更像“搭一个 AI 工程团队的控制台”。

区别大概是：

- 前者优化单个 agent 的行为
- 后者组织多个 agent 的协作
- 前者更关注提示词和规则
- 后者更关注任务生命周期
- 前者适合增强日常使用
- 后者适合推进复杂长任务

这也是为什么我更愿意把 OMC 看作 workflow/control plane，而不是 prompt pack。

## 适合什么场景

我觉得 OMC 最适合几类任务。

### 第一，复杂代码库探索

比如接手一个大型项目，想快速弄懂认证、支付、权限、构建、部署、数据流。

这类任务很适合让不同 worker 并行研究，再汇总成结构化结论。

### 第二，大规模重构

状态管理迁移、API SDK 替换、模块拆分、类型系统整理，都属于单 agent 容易疲劳的任务。

Team 和 Planning 能让这种任务更有边界。

### 第三，测试与质量治理

让不同 agent 分别负责单元测试、集成测试、边界场景、构建验证，比单一路径更容易发现遗漏。

### 第四，长时间自动推进任务

依赖升级、lint 清理、类型错误修复、批量迁移，通常需要多轮执行和修复。

tmux 加 Autopilot 或 Ralph 这类模式，会比普通聊天式工具更合适。

### 第五，多模型能力实验

如果你想比较 Claude、Gemini、Codex 在同一工程任务中的表现，OMC 这类工具也提供了一个更自然的实验场。

## 需要注意的地方

不过，OMC 这种工具也不是所有人都应该马上用满。

它带来的能力越强，对使用者的工程判断要求也越高。

你需要知道什么时候适合多 agent，什么时候一个 Claude Code 会话就够了；什么时候可以 Autopilot，什么时候必须人工 review；什么时候应该让 worker 并行探索，什么时候应该先收敛方案。

如果任务很小，比如改一行样式、补一个文案、修一个明显 typo，那直接用 Claude Code 就好。

如果目标不清楚，也不要急着开 Team。多 agent 不能替你定义需求，它只会放大已有的清晰度或混乱度。

我觉得比较合理的使用原则是：

- 简单任务：单 Claude Code 会话
- 中等任务：Planning + 执行
- 长任务：Ralph 或 Autopilot
- 大型复杂任务：Team + 明确角色 + 阶段验收
- 高风险任务：计划优先，人工 review 优先，自动化谨慎开启

## 背后的趋势：AI Coding 开始进入“组织工程”阶段

`oh-my-claudecode` 最值得关注的地方，其实不是某个具体命令，而是它反映的趋势。

AI Coding 的第一阶段，是让模型会写代码。

第二阶段，是让模型接入 IDE、终端、文件系统和测试命令。

现在正在进入第三阶段：怎么组织多个 AI agent 可靠地完成复杂工程任务。

这时，真正重要的能力会变成：

- 任务拆解
- 角色分工
- 上下文持久化
- 执行观测
- 失败恢复
- 权限边界
- 自动化等级
- 验证闭环
- 人工接管点

这些东西听起来没有“模型参数”那么性感，但它们决定 AI 能不能进入真实工程流程。

一个没有控制平面的 AI agent，再强也像一台马力很大的发动机：能跑，但不一定知道什么时候转弯、什么时候刹车、什么时候该让人接管。

OMC 这类项目的意义，就是开始给这些发动机装方向盘、仪表盘、刹车和调度系统。

## 总结

`oh-my-claudecode` 最有意思的地方，不是让 Claude Code 多几个快捷命令，而是把 Claude Code 改造成一个多智能体工程控制台。

它试图把 Claude、Gemini、Codex 等不同 worker 放进同一个协作框架里，用 tmux 承载长期运行，用 Planning 管住前置思考，用 Autopilot 和 Ralph 推动持续执行，用 Team 和 Ultrawork 处理复杂并行任务。

这代表了 AI Coding 一个很重要的方向：

**从“我有一个很聪明的助手”，走向“我有一套可以组织 AI 工程团队的系统”。**

未来真正好用的 AI Coding 工具，可能不只是模型更强、回答更准，而是更会组织任务、更会保存状态、更会验证结果、更会在关键时刻停下来让人判断。
