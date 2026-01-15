+++
draft = false
title = "OpenSpec——AI 时代的 Spec 驱动开发利器"
date = "2026-01-15T16:47:00+08:00"
tags = ["OpenSpec", "AI Engineering", "Spec-Driven Development", "Productivity", "Open Source"]
categories = ["AI Tools", "Software Architecture"]
summary = "OpenSpec 是一款专为 AI 辅助编程设计的规范驱动开发（SDD）工具，通过结构化的“提案-实施-归档”工作流，解决 AI 编程中上下文丢失与不可控问题。"
toc = true
math = true
cover = ""
+++

​		在 AI 辅助编程（AI Coding）日益普及的今天，许多开发者陷入了一种被称为**“Vibe Coding”（玄学编程）**的困境：我们不断地向 AI 发送零散的 Prompt，祈祷它能理解我们模糊的需求，结果往往是生成的代码难以维护、上下文随着对话窗口的关闭而丢失。

**Fission-AI** 推出的开源工具 **OpenSpec**正是为了解决这一痛点。它引入了 **Spec-Driven Development (SDD，规范驱动开发)** 的理念，强制要求在写代码之前先定义“规范”（Spec），让 AI 成为精准的执行者，而不是不可预测的黑盒。

本文将深入介绍 OpenSpec 的核心理念、安装配置及完整工作流，助你掌控 AI 编程的主动权。



## 什么是 OpenSpec？

OpenSpec 是一个轻量级的命令行工具（CLI）和规范框架。它不依赖复杂的 SaaS 平台，而是将规范文件直接存储在你的 Git 仓库中。

它的核心价值在于：

1. **意图先行（Intention First）**：在 AI 写代码前，先通过 Markdown 锁定需求。
2. **活体文档（Living Documentation）**：需求文档与代码同在一个仓库，随代码迭代而更新。
3. **确定性输出**：通过结构化的上下文（Context），减少 AI 的幻觉。
4. **轻量级集成**：完美适配 Cursor、Claude Code、GitHub Copilot 等主流 AI 编程助手。

## 核心架构：不仅仅是文档

OpenSpec 在你的项目中维护一个 `.openspec` 或 `openspec/` 目录，其结构设计非常精妙：

- **`spec/` (Living Specs)**：项目的“长期记忆”。这里存放着当前系统的真实状态（功能、约束、架构）。
- **`changes/` (Active Proposals)**：项目的“短期工作台”。每一次功能变更（Feature Request）或 Bug 修复都始于这里的一个提案。
- **Workflow**：`Proposal（提案）` -> `Implementation（实施）` -> `Archive（归档）`。

------

## 快速上手指南

### 1. 安装

OpenSpec 是基于 Node.js 的工具，通过 npm 进行全局安装：

Bash

```
npm install -g @fission-ai/openspec@latest
```

### 2. 初始化项目

进入你的项目根目录，运行初始化命令。OpenSpec 会自动检测你的项目环境并生成配置文件。

Bash

```
cd my-project
openspec init
```

执行后，你会发现目录下多了一个 `openspec/` 文件夹。

------

## 实战工作流：从需求到代码

假设我们需要为一个 Web 项目添加“用户深色模式”功能，传统的做法是直接在 Cursor 里输入：“帮我加个深色模式”。而使用 OpenSpec，我们将遵循 SDD 流程。

### 第一步：创建提案 (Proposal)

不要直接写代码，而是告诉 AI 生成一个提案。你可以在 Cursor 的 Chat 窗口中使用类似以下的 Prompt（OpenSpec 也支持通过 CLI 交互）：

> User Prompt:
>
> @openspec 创建一个变更提案：为网站添加深色模式切换功能，要求支持系统自动检测和手动切换，使用 Tailwind CSS 实现。

或者使用 CLI 命令：

Bash

```
# 生成变更脚手架
openspec new change "add-dark-mode"
```

AI 会在 `openspec/changes/add-dark-mode/` 下生成以下文件：

- `proposal.md`: 详细描述变更的背景、目标和范围。
- `tasks.md`: AI 生成的详细实施步骤列表（TodoList）。
- `spec-deltas/`: 描述这次变更对现有系统规范的修改。

### 第二步：审查与验证 (Review & Validate)

这是最关键的一步。你需要阅读 AI 生成的 `proposal.md`。如果 AI 理解错了（例如它想用 CSS 变量而不是 Tailwind），你可以直接修改 Markdown 文件。

确认无误后，运行验证命令确保格式正确：

Bash

```
openspec validate add-dark-mode
```

### 第三步：AI 实施 (Implementation)

现在，你可以让 AI 开始干活了。将提案作为上下文喂给你的 AI 助手（Cursor/Copilot）：

> User Prompt:
>
> @openspec/changes/add-dark-mode 请根据 tasks.md 中的步骤开始实施代码。

由于 AI 拥有了极其明确的上下文（Proposal）和执行计划（Tasks），它生成的代码质量将显著高于盲目对话。

### 第四步：归档 (Archive)

代码测试通过后，不要直接删除提案。运行归档命令：

Bash

```
openspec archive add-dark-mode
```

**发生了什么？**

1. OpenSpec 会将 `add-dark-mode` 中的关键信息合并到主目录的 `spec/` 中。
2. 你的系统文档（Living Spec）被自动更新了。
3. 原始提案被移动到归档目录，留作日后审计。

------

## OpenSpec vs. 传统 Prompt 工程

| **特性**     | **传统 Prompt 工程 (Vibe Coding)** | **OpenSpec (SDD)**   |
| ------------ | ---------------------------------- | -------------------- |
| **上下文**   | 依赖聊天记录，易丢失               | 依赖文件系统，持久化 |
| **可维护性** | 差，难以复现                       | 好，有迹可循         |
| **复杂任务** | 容易跑偏，逻辑混乱                 | 任务被拆解为原子步骤 |
| **文档**     | 无，或与代码脱节                   | 自动生成，始终最新   |

## 总结

OpenSpec 并不是要取代 AI，而是要**管好 AI**。它强迫开发者在 Coding 之前先进行 Thinking。虽然看似多了一个“写文档”的步骤，但它实际上消除了后期反复 Debug 和因为需求理解偏差导致的重构时间。

对于希望从“玩具级 AI 编程”进阶到“工程级 AI 开发”的团队来说，OpenSpec 绝对是一个值得尝试的工具。
