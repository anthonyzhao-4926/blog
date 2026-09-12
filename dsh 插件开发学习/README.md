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

**不能**：不覆盖 Cordis 的全部 API（那是 [`cordis_api.md`](../dsh/cordis_api.md) 的事）；不涉及写 React 客户端组件和 slot 体系；不解释 DSH 内核为什么要这么设计。这三块分别留给阶段 2、阶段 5 和文末的「按需深挖」，见「接下来学什么」。

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
| 查 profile 目录里某个文件能不能手改 | [profile 与插件包结构](参考/profile与插件包结构.md) |
| 查 `ctx` 上还有哪些能力 | [Cordis API 文档](../dsh/cordis_api.md) |

### 参考卡片

不是读物，查到才用：

- [profile 与插件包结构](参考/profile与插件包结构.md)——profile 目录逐文件说明、patch 合成模型、插件包内部结构、维护速查表

### 接下来学什么（文档列表）

本节是**规划，不是读物**：规划里的文件都还不存在，所以只写文件名、不写成链接（写成链接在站点上会变死链）。要动笔时按下面的序号建文件即可。

三条规则：

- **编号从 06 起。** `05` 已被参考卡片占用，参考卡片不参与「下一篇」阅读链；新篇一律 `NN-描述.md`，`NN` 与 frontmatter 的 `order` 一致。
- **案例只增不改。** 阶段 2–4 继续拿 03 那个背景插件当主线案例，每篇只在它身上加一层，不换新案例。
- **「按需深挖」不占号。** 内核那批篇目在主线之外，想改内核或写大型扩展时再挑。

主线共 17 篇（06–22）：`06–08` 补 Cordis 地基，`09–10` 讲组合与热更新，`11–17` 挂到 DSH 扩展点，`18–20` 进浏览器端，`21–22` 发布与维护。

#### 阶段 2：服务、事件、配置（06–08）

**为什么现在学**：01–04 里的 `ctx.inject`、`ctx.on`、`ctx.effect` 都是照抄的用法。DSH 的所有扩展点——工具、权限门、会话、设置——全建在这三样上，不补这一层，后面只能死记。

| 编号 | 文件 | 读完你能 | 写什么 |
| --- | --- | --- | --- |
| 06 | `06-服务与依赖注入.md` | 把插件拆成「提供服务」和「消费服务」两半，说清 `inject` 的依赖跟踪 | 服务是什么：`ctx.tools` / `ctx.llm` / `ctx.agents` 都是服务，消费方只认能力名、不 import 提供方；`ctx.provide` 与 `Service` 子类（`super(ctx, name)` + `declare module` 扩展类型）；`inject` 的必需与可选依赖，加载顺序由依赖而非文件顺序决定；加载后仍跟踪依赖：服务消失自动卸载、回归自动重载；`ctx.isolate` 的隔离场景；动手把 03 的背景插件拆成「图片源服务 + 消费者」两个插件 |
| 07 | `07-事件与四种派发模式.md` | 选对派发模式，用事件把两个插件解耦 | 声明 / 发出 / 监听，typed events 的类型怎么写；`emit` 广播、`bail` 短路、`serial` 顺序、`waterfall` 管道（`next()` 语义）；什么时候必须用 waterfall（审批、工具前置门都会遇到）；「监听本身就是 effect」，卸载自动摘掉；Cordis 事件与会话记录的区别（哪些会进 session 日志）；给背景插件加一个「主题切换」事件，让另一个插件响应 |
| 08 | `08-配置与校验.md` | 给插件加上有默认值、会报错的配置 | 导出 `Config` 类型 + 同名 Schemastery schema；默认值写在 schema 字段上而不是代码里硬编码；非法配置加载失败并给出准确报错（绝不在配置不完整时启动）；计算得到的配置值；哪些值不该硬编码；把背景图片路径、透明度、模糊开关都变成配置项 |

前置：06←04；07←06；08←06。官方对应：`docs/cordis-tutorial/03-services`、`04-events`、`05-config`；`docs/user/develop/framework/service.md`、`events.md`、`docs/user/develop/basic/config.md`。

#### 阶段 3：组合与热更新（09–10）

**为什么现在学**：手上有了两个以上插件，才会真的遇到「谁先加载、谁覆盖谁、改完要不要重启」。

| 编号 | 文件 | 读完你能 | 写什么 |
| --- | --- | --- | --- |
| 09 | `09-patch语义与加载顺序.md` | 读懂并手写 patch，知道谁覆盖谁 | `cordis.yml` 配置项的完整形态（`id` / `name` / `config` / `disabled`）；insert / override / group 的语义；`dsh.profile.bundles` → `cordis.patch.yml` → home patch → `--patch` 的叠加顺序；表达式插值；loader / include / group / timer 四个内置插件各干什么；用 `dsh --dump-config`、`--dump-default-config` 验证自己的理解；参考卡片 05 那张合成图的「动手版」 |
| 10 | `10-HMR与装配诊断.md` | 改插件不重启就生效，并能诊断「插件为什么不加载」 | HMR 覆盖哪些改动、哪些必须重启；`patchReload: live` 与 `startup` 的区别；Fiber 状态机（PENDING / LOADING / ACTIVE / FAILED / UNLOADING / DISPOSED）怎么读；依赖没满足、模块解析失败、循环依赖的典型症状与日志；`plugin-hmr` 的相关配置 |

前置：09←08；10←09。官方对应：`docs/cordis-tutorial/06-composition-and-hmr`；`docs/user/develop/framework/index.md`；`cordis_api.md` 的 loader / include / group / timer / hmr 各节。

#### 阶段 4：挂到 DSH 的扩展点上（11–17）

**到这里才算真的会写 DSH 插件**。11–13 是每个插件作者都该会的三件事，14–15 用得上 Web 端时再写，16–17 可选。

| 编号 | 文件 | 读完你能 | 写什么 |
| --- | --- | --- | --- |
| 11 | `11-写一个工具.md` | 写一个模型能调用、UI 里看得见结果的工具 | `defineTool` 的最小形态（name / description / parameters / execute / result）；参数用 Schema 还是裸 JSON Schema、描述怎么写模型才用对；构造 `ToolResult`（文本 / 结构化 / 错误）；`run_in_background` 与长任务；工具在对话里的展示（presentation）；案例：给背景插件加一个 `set_background` 工具，让模型自己换背景 |
| 12 | `12-工具执行管线与权限门.md` | 在工具执行前后插手，做出放行 / 拒绝 / 改写 | 四个拦截点的分工：`tools/pre-execute`（waterfall 决定 allow / deny）、`tools/execute`（包住派发生命周期，做超时 / 重试 / 埋点）、`tools/post-execute`（改写结果）、`tools/result`（只观察、不可改）；`ctx.tools.guard()` 的单调最终否决（不变式）与 waterfall 的区别；`PreToolDecision` 的形状；案例：写一个「禁止删图」的权限门 |
| 13 | `13-写一个skill.md` | 把一个可复用工作流封装成按需加载的 skill | 两种形态：`<name>/SKILL.md` 目录与顶层 `<name>.md`（嵌套 `**/SKILL.md` 不会被扫描）；frontmatter 必填 `name` / `description` 与可选 `whenToUse` / `metadata`；`disable-model-invocation`、`user-invocable` 两个开关；扫描根与优先级（project-dsh 100 / project-agents 200 / custom 300 / user-dsh 400 / user-agents 500）；目录与正文分离的生命周期（改正文不用重启与失效缓存）；上下文成本：模型看到什么、正文何时才加载 |
| 14 | `14-注册一张设置卡.md` | 把插件配置搬到 Web 设置页 | 一个包的两半：Host（`src/`）与浏览器（`src/client/`，用 `dsh.client` 声明并从 `./client` 导出）；在 Host 注册一个 settings namespace，设置页凭 namespace 自动把两半配对；读 / 写用户设置与层叠解析（默认值 → 组合 base → 用户文档）；客户端 HMR 与热提交 |
| 15 | `15-加一个RemoteAPI.md` | 给浏览器端加一个带类型约束的 Host 调用 | `ctx.remote` 的五步：声明方法、声明失败、注册、客户端消费、测试；装饰器语义与查找解析；代码生成管线与 `/api` 路由；失败词汇表（一个 `RemoteError` + 错误码表） |
| 16 | `16-接一个LLM-adapter.md`（可选） | 接一个自己的模型供应商 | 继承 `LlmAdapter` 实现 `stream()`；`StreamChunk` 协议与关键规则；`GenerateOptions`；`ctx.llm.registerAdapter`；错误处理；两个参考实现（直连 HTTP 与包一层 LLM 库） |
| 17 | `17-动态Cordis工具.md`（可选） | 让 agent 在运行中挂载 / 卸载插件 | `dsh-tool-cordis` 的装法与用途；运行中检查当前插件树；内存插件的挂载、卸载、生命周期与清理；风险：临时插件会影响同进程的其他会话 |

前置：11←08；12←11；13←08；14←12；15←14；16←08；17←12。官方对应：`docs/user/develop/basic/tool.md`、`docs/user/develop/practice/`、`packages/skill/skill-filesystem/README.md`、`docs/cookbook/adding-a-tool.md`、`adding-a-settings-card.md`、`adding-a-remote-api.md`、`adding-an-llm-adapter.md`、`docs/subsystems/tools.md`、`docs/subsystems/settings.md`、`docs/subsystems/typert.md`。

#### 阶段 5：客户端 / UI 插件（18–20）

上面「不能」里明确划出去的那块，放到这里。三篇之间有严格依赖，别拆开读。

| 编号 | 文件 | 读完你能 | 写什么 |
| --- | --- | --- | --- |
| 18 | `18-浏览器插件与dshclient.md` | 让插件往 Web 前端注入一个客户端模块 | `dsh.client` 声明；client bundle 的路由与 index tap；`WebBootGraph` 的线组；Host / Client 配对模型；client HMR 怎么工作 |
| 19 | `19-Slot体系.md` | 把组件挂到正确的 UI 位置 | slot 的声明归属；基数与作用域；框架注入与 feature 注入；props 怎么推导；现有 slot 层级怎么查 |
| 20 | `20-自定义对话渲染.md` | 让某类会话事件在对话流里渲染成自己的行 | `ConversationNodeDefinition` + 按 key 注册的 Chat renderer；从 `session/event` 取数据（`assistant/chunk`、turn / step 边界、工具活动）；用 `agent.followup()` / `agent.steer()` 把输入送回；为什么渲染要挂在事件流上而不是直接拿模型输出 |

前置：18←15；19←18；20←19。官方对应：`docs/subsystems/web-client.md`、`client-modules.md`、`slots.md`、`conversation.md`；现成例子是 `packages/client/ui-*`。

#### 阶段 6：发布与维护（21–22）

| 编号 | 文件 | 读完你能 | 写什么 |
| --- | --- | --- | --- |
| 21 | `21-把插件发布成bundle.md` | 把插件发成 npm 包，让别人装进自己的 profile | bundle manifest `dsh.bundle` 与 profile manifest `dsh.profile` 的分工；`dsh plugin add` 装进别人的 profile；加载顺序；给 surface bundle 自带命令行；从 GitHub 装时的 build script 坑 |
| 22 | `22-跟进上游与兼容.md`（可选） | 跟得住 developer preview 的破坏性变更 | 破坏性变更的发布节奏与渠道；怎么读 Agent Notes 与 changelog；invariants 是干什么的、失败了怎么查；升级 `dsh` 与 profile 里插件的步骤 |

前置：21←11；22 无强前置。官方对应：`docs/user/develop/basic/publish.md`、`docs/cookbook/adding-a-package.md`、`docs/testing.md`、`docs/subsystems/invariants.md`、`SAFETY.md`。

#### 按需深挖：内核（不预先占号）

想改内核、写大型扩展，或者只是想回答「DSH 为什么这么设计」时再挑，不必按序。每一条都是主动线之外的独立选题，写的时候再取号。

- **会话与循环**：session / turn / step 生命周期、`SessionEventMap` 全变体、`deriveMessages()`、执行包围（`docs/subsystems/core.md`、`session.md`、`docs/architecture.md`）
- **持久化与崩溃恢复**：`SessionPersistence`、JSONL 与 SQLite 后端、`session/flush`、`SessionHeader`、格式版本迁移（`docs/subsystems/persistence.md`）
- **会话查询与投影**：逻辑记录、语义过滤与全文检索、`SessionProjectionMap` 与一致切面（`docs/subsystems/session-query.md`、`session-projection.md`）
- **compaction 与 checkpoint**：`compaction/*` 事件、`CompactionEngine`、工具结果裁剪策略、检查点（`docs/subsystems/compaction.md`）
- **系统提示词装配**：per-assembly 上下文、prompt sections 的协作式装配、工具提供方结果（`docs/subsystems/system-prompt.md`）
- **沙箱、审批与授权**：文件效果模式与进程限制、`ApprovalRequest` / `ApprovalOutcome`、权限预设（`docs/subsystems/sandbox.md`、`approval.md`、`permission-presets.md`）
- **子代理与 agent team**：`SubagentStartRequest`、spawn 与 fork 的差别、命名可续 teammate、共享任务 DAG（`docs/subsystems/subagent.md`、`agent-team.md`）
- **workflow 与 goal / jobs / schedule**：workflow 脚本编排、目标轮次、后台作业、会话内定时（`docs/subsystems/workflow.md`、`goal.md`、`jobs.md`、`schedule.md`）
- **MCP 客户端集成**：把外部 MCP 服务端挂进 DSH——正好接上 [`golang_mcp`](../golang_mcp/README.md) 专栏，那边写服务端、这边做集成（`packages/mcp`）
- **Web server / API gateway / Typert**：HTTP 载体与路由匹配、claimable fallback、Remote 方法调用机制（`docs/subsystems/web-server.md`、`typert.md`、`docs/api-gateway.md`）
- **各 profile 的差别**：web / headless / sdk / sdk-minimal / acp / desktop 各适合什么场景、怎么从模板起一个新 profile（包根 `README.zh.md` 与 `apps/`）

#### 每篇按同一个骨架写

沿用 `专栏写作规范.md`：开头三行（读完你能 / 前置 / 约 N 分钟）、结尾以 `**下一篇**：` 开头链到下一篇的 markdown 链接，教程型正文按「先看效果 → 改哪里 → 代码解释」排。字段表、错误码这类查阅型内容挪进 `参考/`。

#### 动笔写第一篇时顺手做的事

- 04 的结尾要从「**主线到此结束。**」改成「**下一篇**：服务与依赖注入」，终点标记往后挪到 22。
- 新文件名 `NN-描述.md` 的 `NN` 必须与 frontmatter 的 `order` 一致（`tool/check-columns.sh` 会校验）。
- 参考卡片 05 在 `参考/` 下，不参与「下一篇」链路，不用动。
- 改完跑一次：`tool/check-columns.sh "dsh 插件开发学习"`。
