---
title: Hooks
date: 2026-07-20
tags: [ai, claude]
column: claude-code
order: 8
viewable: true
---

Hook 是在特定时机触发指定动作的机制。简单来说就是，用户指定什么时候干一些用户自己想干的事。

所以，Claude  Hook 的学习大块上就可以分为：

- 如何指定触发时机
- 如何执行指定动作

其余内容就都是围绕这两个主题的琐碎细节了。

## 如何指定触发时机

Claude Hook 的触发时机指定可以分为，三层机制的设计思想是**逐步收窄**触发范围：

- 生命周期事件**Event**：粗粒度，确定生命周期阶段
- 匹配器**Matcher**：中粒度，确定具体工具/操作
- **if**：细粒度，基于上下文条件做最终判断

先看一个例子

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": ".claude/hooks/block-rm.sh"
          }
        ]
      }
    ]
  }
}
```

- 生命周期事件Event：`PreToolUse`

- 匹配器Matcher：`Bash`工具
- if：`Bash(rm *)`当执行的是 `rm *` 命令时，会执行一个 command 类型动作。这个动作是执行一个具体的sh脚本。

### 生命周期事件

| 生命周期事件        | 描述                                                         |
| ------------------- | ------------------------------------------------------------ |
| SessionStart        | 当会话开始或恢复时                                           |
| Setup               | 当使用 `--init-only` 启动 Claude Code，或在 `-p` 模式下使用 `--init` 或 `--maintenance` 时。用于 CI 或脚本中的一次性准备工作 |
| UserPromptSubmit    | 当你提交提示词时，在 Claude 处理之前                         |
| UserPromptExpansion | 当用户输入的命令展开为提示词时，在到达 Claude 之前。可以阻止展开 |
| PreToolUse          | 在工具调用执行之前。可以阻止调用                             |
| PermissionRequest   | 当权限对话框出现时                                           |
| PermissionDenied    | 当工具调用被自动模式分类器拒绝时。返回 `{retry: true}` 可告知模型允许重试被拒绝的工具调用 |
| PostToolUse         | 在工具调用成功之后                                           |
| PostToolUseFailure  | 在工具调用失败之后                                           |
| PostToolBatch       | 在一整批并行工具调用完成之后，下一次模型调用之前             |
| Notification        | 当 Claude Code 发送通知时                                    |
| MessageDisplay      | 当助手消息文本正在显示时                                     |
| SubagentStart       | 当子代理被创建时                                             |
| SubagentStop        | 当子代理完成时                                               |
| TaskCreated         | 当通过 TaskCreate 创建任务时                                 |
| TaskCompleted       | 当任务被标记为已完成时                                       |
| Stop                | 当 Claude 完成响应时                                         |
| StopFailure         | 当轮次因 API 错误而结束时。输出和退出码会被忽略              |
| TeammateIdle        | 当代理团队中的队友即将进入空闲状态时                         |
| InstructionsLoaded  | 当 CLAUDE.md 或 `.claude/rules/*.md` 文件被加载到上下文中时。在会话开始时以及文件在会话期间被延迟加载时触发 |
| ConfigChange        | 当配置文件在会话期间发生变更时                               |
| CwdChanged          | 当工作目录发生变化时，例如当 Claude 执行 `cd` 命令时。适用于使用 direnv 等工具进行响应式环境管理 |
| FileChanged         | 当被监视的文件在磁盘上发生变化时。`matcher` 字段指定要监视的文件名 |
| WorktreeCreate      | 当通过 `--worktree` 或 `isolation: "worktree"` 创建工作树时。替代默认的 git 行为 |
| WorktreeRemove      | 当工作树被移除时，包括会话退出时或子代理完成时               |
| PreCompact          | 在上下文压缩之前                                             |
| PostCompact         | 在上下文压缩完成之后                                         |
| Elicitation         | 当 MCP 服务器在工具调用期间请求用户输入时                    |
| ElicitationResult   | 在用户响应 MCP 引出请求之后，响应被发送回服务器之前          |
| SessionEnd          | 当会话终止时                                                 |

## 事件详解

