---
title: dsh 插件开发学习
date: 2026-09-12
tags:
  - ai
  - dsh
column: dsh-plugin
order: 0
viewable: true
---

## dsh 插件开发学习

学写 DSH 插件：从最小的 `apply` 函数开始，做到能注册 HTTP 路由、能改页面外观、并且卸载时收拾干净。

### 读完能做到什么

**能**：写出一个能被 `dsh plugin add` 自动装配的插件包；用 `ctx.inject` 拿到内部服务、注册 HTTP 路由；监听注入类事件往页面里塞样式；理解插件从加载到卸载的四个阶段，知道什么必须交给 `ctx.effect` 管理。

**不能**：不覆盖 Cordis 的全部 API（那是 [`cordis_api.md`](../dsh/cordis_api.md) 的事）；不涉及写 React 客户端组件和 slot 体系；不解释 DSH 内核为什么要这么设计。

### 前置假设

- 会 TypeScript / Node。
- 本机装好了 `dsh` 和 `pnpm`。
- 不需要预先了解 Cordis 或插件机制。

### 一条主线

全程围绕一个目标：**做一个把本地图片设成 DSH 聊天背景的插件**。

01、02 先打好地基（profile 是什么、插件最小长什么样），03 才是那个背景插件，04 把它用到的生命周期概念讲透。每篇结尾都有下一篇的链接。

1. [插件与 profile](01-插件与profile.md)——profile、bundle、插件三者的关系，并建好 test profile
2. [第一个插件](02-第一个插件.md)——最小插件 + bundle 三件套，装进去看到 `hello world`
3. [给页面加背景](03-给页面加背景.md)——注册图片路由 + 注入样式，打通"让 UI 变样"的两条路
4. [effect 与插件生命周期](04-effect与生命周期.md)——四个阶段、fiber 是什么、为什么必须清理

### 只想找某一件事

| 我想…… | 看这篇 |
| --- | --- |
| 搞懂 profile 和 bundle 到底啥关系 | [插件与 profile](01-插件与profile.md) |
| 知道一个插件包最少要有哪些文件 | [第一个插件](02-第一个插件.md) |
| 让插件能被自动装配（不用手改 profile） | [第一个插件](02-第一个插件.md) → `dsh.bundle.patch` 一节 |
| 注册一个 HTTP 路由 | [给页面加背景](03-给页面加背景.md) |
| 往页面里注入 CSS 或脚本 | [给页面加背景](03-给页面加背景.md) |
| 插件卸载后路由还留着 / 报 duplicate route | [effect 与插件生命周期](04-effect与生命周期.md) |
| 查 profile 目录里某个文件能不能手改 | [profile 与插件包结构](参考/05-profile与插件包结构.md) |
| 查 `ctx` 上还有哪些能力 | [Cordis API 文档](../dsh/cordis_api.md) |

### 参考卡片

不是读物，查到才用：

- [profile 与插件包结构](参考/05-profile与插件包结构.md)——profile 目录逐文件说明、patch 合成模型、插件包内部结构、维护速查表
