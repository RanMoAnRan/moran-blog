+++
title = 'RTK：我试了下这个“省 token”的小工具，感觉它更像 AI Coding 的消音器'
slug = 'rtk-ai-token-killer-cli-proxy'
date = 2026-05-28T16:30:00+08:00
draft = false
tags = ['RTK', 'AI Coding', 'CLI', 'Token', '开发工具']
categories = ['AI Tools', '开源']
summary = 'RTK 最打动我的不是“省 60%-90% token”这个数字，而是它把 AI Coding 里最吵的一层终端输出，变成了模型真正看得懂、也看得完的摘要。'
toc = true
math = false
+++

我一开始看 `rtk-ai/rtk`，其实有点没太当回事。

现在 AI Coding 工具太多了，几乎每个项目都会说自己能让 Claude Code、Codex、Cursor 更好用。再加上它的名字叫 **Rust Token Killer**，听起来有点像那种很会写宣传语的小工具：装上以后 token 消耗降低 60%-90%，然后给你一张很漂亮的对比表。

但我实际把它拉下来试了一下，感觉反而比 README 里的宣传语朴素很多。

它不是让模型更聪明，也不是给你一套新的提示词方法。它干的事很窄：**把终端输出在进入 AI 上下文之前先压一遍。**

这件事听上去不性感，但我越用 AI Coding，越觉得它正好卡在一个真实痛点上。

## AI Coding 里最吵的不是模型，而是终端

我以前用 Claude Code、Codex 或 Cursor 跑项目时，经常遇到一种情况：模型本来只是想确认一下仓库状态，结果一条命令把一大坨输出塞进上下文。

比如：

```bash
git status
git diff
npm test
pytest
docker logs xxx
ls -la
rg "某个关键字" .
```

这些命令对人来说已经够吵了，对模型来说更麻烦。因为模型不是“看一眼终端”，它是把这些内容吃进上下文窗口里。你塞进去的每一行日志、每一个无关文件、每一段重复堆栈，都会挤掉后面真正有用的上下文。

这也是我觉得 RTK 的定位有意思的地方。

它没有试图发明一个新的 AI Agent，也没有说要重做工作流。它只是站在 shell 命令和模型之间，当一个很小的代理层：命令照样跑，但输出会被整理成更适合 LLM 阅读的样子。

简单画一下就是：

```text
没有 RTK:
AI Agent -> shell -> git/test/docker/... -> 原始长输出 -> 上下文

使用 RTK:
AI Agent -> RTK -> git/test/docker/... -> 压缩后的输出 -> 上下文
```

这个位置很小，但挺关键。


第一次跑 `rtk gain`，它很诚实：

```text
No tracking data yet.
Run some rtk commands to start tracking savings.
```

也就是说它不是凭空给你画饼。你得真的用它跑过命令，它才会开始统计节省情况。

我拿项目试了几条最普通的命令。

`rtk git status` 的输出非常短：

```text
* main...origin/main
clean — nothing to commit
```

这比完整 `git status` 少很多废话，但没有丢掉关键信息：当前分支、远端关系、是否干净都在。

`rtk ls .` 也比较像“给 AI 看的目录”：

```text
.github/
archetypes/
assets/
content/
data/
docs/
i18n/
layouts/
public/
ql/
resources/
scripts/
static/
themes/
.gitignore  62B
.hugo_build.lock  0B
README.md  843B
hugo.toml  2.6K
vercel.json  106B
```

它没有把权限、用户、组、时间戳全摊开。对模型来说，这反而更合适。因为大多数时候，AI 需要知道的是“这里有什么”，不是每个文件的 inode 细节。

最明显的是 `rtk read`。

我让它读文章，并限制前 30 行：

它输出会保留 front matter 和开头正文，然后在后面补一句：

```text
[613 more lines]
```

这句话其实挺重要。它没有假装文件就这么点，也没有把后面 600 多行都塞出来，而是明确告诉模型：后面还有内容，只是现在没展开。

这比很多“粗暴截断”舒服，因为粗暴截断最危险的地方不是少看了，而是你不知道自己少看了。

## `rtk gain` 的统计挺有意思

跑完几条命令后，我再看 `rtk gain`，它给了一个全局统计：

```text
Total commands:    5
Input tokens:      8.1K
Output tokens:     911
Tokens saved:      7.2K (88.7%)
Total exec time:   248ms (avg 49ms)
```

它还会按命令拆开看：

```text
rtk read        saved 6.9K   97.1%
rtk ls -la .    saved 281    84.9%
rtk git status  saved 13     52.0%
rtk grep        saved 6      0.9%
rtk git diff    saved 1      100.0%
```

这个结果反而让我更相信它一点。

因为它不是所有命令都硬说自己省了很多。像我这次 `rtk grep "AI Agent" content/posts`，本来结果就不算长，所以只省了 `0.9%`。这说明 RTK 的价值不在于“每条命令都神奇压缩”，而在于它能识别哪些输出真的吵。

在这次试用里，`rtk read` 的效果最明显。原因也很简单：文章文件很长，模型通常只需要先看结构和开头，没必要一次吃完整篇。

这跟我平时用 AI 改代码的体感很接近。最浪费上下文的，往往不是一条短状态命令，而是某个文件、某段日志、某个测试失败堆栈一下子铺满屏幕。

## 它最像什么

如果让我用一个不那么技术的比喻，我觉得 RTK 像一个“消音器”。

不是让枪变强，而是让噪声少一点。

AI Coding 工具真正工作时，模型一直在听各种声音：文件列表、diff、测试日志、构建输出、Docker 日志、搜索结果。问题是这些声音里有很多是背景噪音。

RTK 做的不是替模型思考，而是帮模型少听废话。

这也是它和很多 AI 工具不一样的地方。很多项目在加能力：更多 agent、更多 prompt、更多命令、更多自动化。RTK 反过来做减法：少给模型一些东西，但给得更准一点。

这个方向我挺喜欢。

## Hook 是它真正适合长期用的地方

临时手写 `rtk git status` 可以体验效果，但不是它最理想的用法。

README 里真正推荐的是初始化到具体 AI 工具里，让 Bash 命令自动改写。比如：

```bash
rtk init -g              # Claude Code / Copilot 默认模式
rtk init -g --codex      # Codex
rtk init -g --gemini     # Gemini CLI
rtk init --agent cursor
rtk init --agent antigravity
```

我这次只做了 Codex 的 dry-run，没有直接写入全局配置：

```bash
/tmp/rtk-bin/rtk init -g --codex --dry-run
```

它显示将会做两件事：

```text
[dry-run] would create RTK.md: /Users/ranmoanran/.codex/RTK.md
[dry-run] would add @/Users/ranmoanran/.codex/RTK.md reference to AGENTS.md: /Users/ranmoanran/.codex/AGENTS.md
```

这个设计也挺克制。至少对 Codex 来说，它不是偷偷改一堆系统状态，而是把 RTK 的使用说明放进 `.codex/RTK.md`，再让 `AGENTS.md` 引用它。

不过我还是建议第一次用的时候先 dry-run。因为这类工具一旦接入 hook，就会影响 AI 助手看到的命令输出。大多数时候这是好事，但你得知道它改了什么。

## 它不适合所有场景

RTK 有个天然的边界：**它给你的不是原始输出，而是压缩后的输出。**

这句话要认真对待。

如果你只是让 AI 看项目结构、确认改动范围、跑测试摘要、定位明显报错，压缩输出通常更好。因为原始输出里太多内容只是噪音。

但如果你正在排一个很细的 bug，比如某个日志里只有一行特殊字符异常，或者某个构建工具在长输出里藏了真正原因，那 RTK 的摘要就可能不够。这个时候我会回到原始命令，或者把完整日志保存成文件再一点点查。

所以我不会把它理解成“替代 shell”。它更像是 AI Coding 默认视图的一层过滤器：平时先看摘要，遇到不对劲再展开原文。

这个心态比较重要。否则很容易从一个极端走到另一个极端：以前什么都塞给模型，现在什么都不让模型看。

两种都不对。

## 我会怎么用它

如果是轻度 AI Coding，我可能不会急着装。偶尔让 AI 改一两个文件，手动控制输出也够了。

但如果是下面这些场景，我会认真考虑把 RTK 放进默认工具链：

- 经常用 Claude Code / Codex 长时间跑任务
- 项目测试输出特别长
- 前端构建、Playwright、Vitest、Pytest 日志很吵
- 经常让 AI 看 `git diff`、`rg`、`docker logs`
- 多 agent 并行工作时，上下文污染很严重

尤其是多 agent 场景。一个 agent 吃掉几千行没用日志还只是它自己的问题；多个 agent 都这么干，上下文和成本都会被快速放大。

RTK 这种工具在单次对话里未必惊艳，但在长会话和高频工具调用里会慢慢变得有价值。

## 我对它的真实评价

RTK 不是那种看一眼就让人兴奋的工具。

它没有炫酷 UI，也不会给你一个“AI 自动完成整个项目”的演示。它甚至有点像管道里的一个小零件：装在那儿，平时你不太会注意到它。

但正因为这样，我觉得它反而比较真实。

AI Coding 继续往前走，很多问题不会靠“再来一个更强模型”解决，而是要靠这些很工程化的小层来解决：上下文怎么喂，输出怎么压，错误怎么看，状态怎么留，权限怎么收。

RTK 切的就是其中很小的一刀：**别让模型被终端输出淹死。**

这句话不夸张。现在很多 AI 编程体验变差，不是模型突然变笨，而是它在一堆无意义输出里迷路了。

所以我对 RTK 的结论很简单：它不是 AI Coding 的主角，但可能是重度使用者很需要的基础小工具。它让模型少看垃圾信息，也让人类少为上下文污染买单。

## 相关链接

- GitHub: https://github.com/rtk-ai/rtk
- 安装说明: https://github.com/rtk-ai/rtk/blob/develop/INSTALL.md
- 官网: https://www.rtk-ai.app
