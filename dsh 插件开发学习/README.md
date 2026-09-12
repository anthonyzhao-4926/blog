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

> 官方文档：https://deepseek-harness.github.io/deepseek-harness/

学写 DSH 插件：从最小的 `apply` 函数开始，做到能注册 HTTP 路由、能改页面外观、并且卸载时收拾干净。

### 读完能做到什么

**能**：写出一个能被 `dsh plugin add` 自动装配的插件包；用 `ctx.inject` 拿到内部服务、注册 HTTP 路由；监听注入类事件往页面里塞样式；理解插件从加载到卸载的四个阶段，知道什么必须交给 `ctx.effect` 管理。

**不能**：不覆盖 Cordis 的全部 API（那是 [`cordis_api.md`](../dsh/cordis_api.md) 的事）；不涉及写 React 客户端组件和 slot 体系；不解释 DSH 内核为什么要这么设计。这三块分别留给阶段 2、阶段 5、阶段 6，见文末的[学习路线](#接下来学什么循序渐进的学习路线)。

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

### 接下来学什么（循序渐进的学习路线）

本节是**规划**，不是读物；规划中的篇目还没有文件。本专栏 01–04 只走完「插件地基」这一段，下面是往下走的顺序。

**两条前置说明**：阶段之间有依赖，建议按序；只想写出有用的插件、不打算改内核，走到**阶段 4**（要写 UI 就再加**阶段 5**）就可以停。官方 `cordis-tutorial/` 的 01–07 正好覆盖阶段 1–4 的地基，本专栏对应它 01–02，所以最省力的下一步是接它的 03–07。

所有 `docs/...`、`packages/...` 路径都指本机源码 `local/deepseek-harness/` 下的文件，线上对应官方文档站的同一篇。

#### 阶段 2：服务、事件、配置

**为什么现在学**：01–04 里的 `ctx.inject`、`ctx.on`、`ctx.effect` 都是照抄的用法。DSH 的所有扩展点——工具、权限门、会话、设置——全建在这三样上，不补这一层，后面只能死记。

- **服务与依赖注入**：`Service`、`ctx.provide`、`inject` 的必需与可选、服务消失时自动卸载并在回归时重载、`ctx.isolate` 的服务隔离。目标是看懂 DSH 为什么把「执行 bash」拆成定义（`dsh-shell`）/ 提供者（`dsh-bash-local`）/ 消费者（`dsh-tool-bash`）三个包。
- **事件**：`emit`（广播）、`bail`（短路）、`serial`（顺序）、`waterfall`（管道）四种派发模式，typed events，以及「监听本身就是 effect」。这是 DSH 松耦合扩展点的通用语言。
- **配置**：导出 `Config` 类型 + 同名 Schemastery schema、默认值写在 schema 上、非法配置必须大声失败，以及配置改动怎么配合热更新。

对应：`docs/cordis-tutorial/03-services`、`04-events`、`05-config`；`docs/user/develop/framework/service.md`、`events.md`、`docs/user/develop/basic/config.md`。

#### 阶段 3：组合与热更新

**为什么现在学**：手上有了两个以上插件，才会真的遇到「谁先加载、谁覆盖谁、改完要不要重启」。

- `cordis.yml` 配置项的完整形态与 patch 的 insert / override 语义——参考卡片里那张 patch 合成图在这里变成可操作的东西
- 热模块替换（HMR）：改插件源码不重启就生效，以及 `patchReload: live` 与 `startup` 的区别
- 用 `dsh --dump-config` / `--dump-default-config` 读装配结果，排查「插件为什么没生效」

对应：`docs/cordis-tutorial/06-composition-and-hmr`；`cordis_api.md` 的 loader / include / group / timer / hmr 各节。

#### 阶段 4：挂到 DSH 的扩展点上

**到这里才算真的会写 DSH 插件**。下面按投入产出比排序，每一条都能独立成篇：

1. **写一个工具**——`defineTool`、参数 schema、结果构造、工具在对话里的展示方式。DSH 最核心的扩展点。
2. **写一个 hook / 权限门**——`tools/pre-execute` 的 waterfall 决定放行或拒绝，`ctx.tools.guard()` 做不可撤销的最终否决，再分清 `tools/execute`（包住派发生命周期，超时 / 重试 / 埋点）、`tools/post-execute`、`tools/result` 各自的位置。看懂沙箱和权限是怎么拦下工具调用的。
3. **注册一张设置卡**——同一个包里的 Host 半边（`src/`）与浏览器半边（`src/client/`，用 `dsh.client` 声明并从 `./client` 导出），注册一个 settings namespace，Web 设置页会自动把它和插件配对。
4. **加一个 Remote API**——`ctx.remote` 的五步：声明方法、声明失败、注册、客户端消费、测试。
5. **（可选）接一个 LLM adapter**——继承 `LlmAdapter` 实现 `stream()`，按 `StreamChunk` 协议接自己的模型供应商。
6. **（可选）动态 Cordis 工具**——`dsh-tool-cordis`，让 agent 在运行中检查自己的插件树、挂载或卸载内存里的插件。

对应：`docs/user/develop/basic/tool.md`、`docs/user/develop/practice/`、`docs/cookbook/adding-a-tool.md`、`adding-a-settings-card.md`、`adding-a-remote-api.md`、`adding-an-llm-adapter.md`、`docs/subsystems/tools.md`。

#### 阶段 5：客户端 / UI 插件

上面的「不能」里明确划出去的那块，放到这里：

- `dsh.client` 声明、client bundle 的路由与 index tap
- Slot 体系：谁声明、基数与作用域、props 怎么推导
- Conversation 组装：`ConversationNodeDefinition` + 按 key 注册的 Chat renderer
- React 组件、主题与 locale、client HMR

对应：`docs/subsystems/web-client.md`、`client-modules.md`、`slots.md`、`conversation.md`；现成例子是 `packages/client/ui-*`。

#### 阶段 6：内核（要改内核或写大型扩展再看）

不必按序，挑着看。这几块决定你能不能回答「DSH 为什么这么设计」：

- 会话与循环：session / turn / step 生命周期、`SessionEventMap`、`deriveMessages()`
- 持久化与查询：JSONL / SQLite 后端、`session-query`、compaction、checkpoint
- 系统提示词装配与工具执行管线
- 沙箱、审批与授权：sandbox policy、approval、authorization、fs policy
- 子代理与编排：subagent、agent team、workflow、ralph、goal、jobs、schedule
- MCP 客户端——正好接上 [`golang_mcp`](../golang_mcp/README.md) 专栏：那边写服务端，这边做集成
- Web server / API gateway / Typert remote 机制

对应：`docs/subsystems/README.md` 那张表，逐行点进去。

#### 阶段 7：发布与维护

- 把插件打成 bundle 发到 npm，再用 `dsh plugin add` 装进别人的 profile
- 上游的 `docs/cookbook/adding-a-package.md`、`docs/testing.md`、invariants 与 postmortem
- 跟进 developer preview 的破坏性变更

#### 怎么判断一个阶段学会了

每阶段都对应一个能在这台机器上跑起来的产物；做不出来就是没学会：

| 阶段 | 预计篇幅 | 产物 |
| --- | --- | --- |
| 2 | 3–4 篇 | 一个 `provide` 服务、并被另一个插件 `inject` 消费的插件 |
| 3 | 1–2 篇 | 改源码不重启就生效，且能用 `--dump-config` 解释为什么 |
| 4 | 4–6 篇 | 一个模型能调用、结果能在 UI 里正常显示的工具 |
| 5 | 3–4 篇 | 一个能在对话流里渲染自定义行的浏览器插件 |
| 6 | 按需 | 能指出某个 DSH 行为由哪个包的哪个服务 / 事件负责 |
