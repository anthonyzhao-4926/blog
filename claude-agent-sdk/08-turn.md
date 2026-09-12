---
title: Turn
date: 2026-08-24
tags: [ai, claude]
column: claude-agent-sdk
order: 8
viewable: true
---

> **读完这篇你能**：说清一个 turn 的边界。**注意：本篇目前只有一张截图，文字待补。**
> **前置**：[工具调用过程](04-工具调用过程.md)。约 2 分钟。

## 什么是 turn

Anthropic 的 Messages API 里，对话是严格 **user / assistant 交替**的。一个 `user` 消息加一个 `assistant` 消息构成一个来回，这个来回称作一个 **turn**。

这解释了一个常让人困惑的现象：**工具调用的结果，消息角色是 `user`。** 因为工具在模型之外执行，所有非 AI 生成的内容都以 `user` 角色回传给模型。所以消息结构看起来是这样：

```
user -> message 块 -> user -> message 块 -> result
```

推导过程见[工具调用过程](04-工具调用过程.md)。

![Clipboard_Screenshot_1786699561](assets/Clipboard_Screenshot_1786699561.png)

---

**主线到此结束。** 到这里，从发消息、流式渲染、展示思考、工具调用，到 subagent 进度、权限配置与审批，整条链路都走通了。
