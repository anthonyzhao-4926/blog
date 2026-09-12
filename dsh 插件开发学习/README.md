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

**能**：写出一个能被 `dsh plugin add` 自动装配的插件包；用 `ctx.inject` 拿到内部服务、注册 HTTP 路由；监听注入类事件往页面里塞样式；理解插件从加载到卸载的四个阶段，知道什么必须交给 `ctx.effect` 管理；把写死的参数抽成 `Config`，在 profile 里覆盖它。

**不能**：不覆盖 Cordis 的全部 API（那是 [`cordis_api.md`](../dsh/cordis_api.md) 的事）；01–04 不涉及 React 客户端组件与 slot 体系（需求走到「界面」时才会遇到）；不解释 DSH 内核为什么这么设计（那是 `docs/subsystems/` 的事）。

### 前置假设

- 会 TypeScript / Node。
- 本机装好了 `dsh` 和 `pnpm`。
- 不需要预先了解 Cordis 或插件机制。

### 一条主线（只保证顺序，不保证同一个例子）

**01–04 共用一个案例**：做一个把本地图片设成 DSH 聊天背景的插件。01、02 先打地基（profile 是什么、插件最小长什么样），03 是那个背景插件，04 把它用到的生命周期概念讲透。

**从 05 起每篇单独选例子**：讲「换供应商」用 DSH 的搜索能力，讲「审计」用工具调用日志，讲「写工具」用工作区笔记搜索……哪个例子把这个需求讲得最清楚就用哪个。需求不适合背景插件的，就不拿它硬套——全栏共用同一个例子既不是目标，也不是要求。

下面只表示**阅读顺序**，每篇开头写了前置是哪篇、结尾有下一篇的链接。

1. [插件与 profile](01-插件与profile.md)——profile、bundle、插件三者的关系，并建好 test profile
2. [第一个插件](02-第一个插件.md)——最小插件 + bundle 三件套，装进去看到 `hello world`
3. [给页面加背景](03-给页面加背景.md)——注册图片路由 + 注入样式，打通"让 UI 变样"的两条路
4. [effect 与插件生命周期](04-effect与生命周期.md)——四个阶段、fiber 是什么、为什么必须清理
5. [让插件可配置](05-让插件可配置.md)——把图片路径、透明度挪进 `Config`，改配置不用改代码

### 只想找某一件事

| 我想…… | 看这篇 |
| --- | --- |
| 搞懂 profile 和 bundle 到底啥关系 | [插件与 profile](01-插件与profile.md) |
| 知道一个插件包最少要有哪些文件 | [第一个插件](02-第一个插件.md) |
| 让插件能被自动装配（不用手改 profile） | [第一个插件](02-第一个插件.md) → `dsh.bundle.patch` 一节 |
| 注册一个 HTTP 路由 | [给页面加背景](03-给页面加背景.md) |
| 往页面里注入 CSS 或脚本 | [给页面加背景](03-给页面加背景.md) |
| 插件卸载后路由还留着 / 报 duplicate route | [effect 与插件生命周期](04-effect与生命周期.md) |
| 让插件里某个值可配（换图、调透明度） | [让插件可配置](05-让插件可配置.md) |
| 配置写了不生效 / 想覆盖插件的默认值 | [让插件可配置](05-让插件可配置.md) → 「配置的层叠」一节 |
| 查 profile 目录里某个文件能不能手改 | [profile 与插件包结构](参考/profile与插件包结构.md) |
| 查 `ctx` 上还有哪些能力 | [Cordis API 文档](../dsh/cordis_api.md) |

### 参考卡片

不是读物，查到才用：

- [profile 与插件包结构](参考/profile与插件包结构.md)——profile 目录逐文件说明、patch 合成模型、插件包内部结构、维护速查表

### 接下来的路（需求驱动）

这一版规划换了出发点。**曾经按 DSH 的功能分区排**——服务、事件、工具、UI……那是「讲完 DSH」的思路：先决定要覆盖哪些机制，再找场景套上去。**现在按「你会依次遇到的需求」排**：每篇从一个真实场景出发，只引入满足它所需的**最小机制**；DSH 的其余部分，等下一个需求逼到它时才出现。

01–04 也是需求驱动的：03 的需求是「让页面变样」，04 是被它引出的「为什么必须清理」。差别只在——01–04 恰好共用一个案例，05 起不共用。

**三条由此而来的取舍：**

- **没有需求支撑的机制不写。** 想学某条特性就直接查 [`cordis_api.md`](../dsh/cordis_api.md) 和官方文档——那是查的，不是读的。
- **只讲这篇真会用到的。** 用不到的概念，哪怕很核心也不提。
- **例子按需求挑，不追求全栏一致。** 同一个例子被相邻几篇接着用，是因为它确实接得上，不是因为「要保持一致」。

下面九级是需求自然加深的结果：解决上一级的需求之后，你才会真的遇到下一级。

#### 第一级：让插件贴合我的环境（05–08）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 05 | `05-让插件可配置.md` | 换张背景图、调个透明度都要改代码重装 | `Config` + Schemastery schema；`cordis.yml` 的 `config` 块；配置层叠与 patch 覆盖；默认值放哪；非法配置为什么必须加载失败 |
| 06 | `06-改代码不想重启.md` | 改一行就重启，迭代太慢；改了没生效还说不出为什么 | HMR 覆盖哪些改动、哪些必须重启；`patchReload` 的 `live` / `startup`；Fiber 状态机；用 `--dump-config` 排查装配 |
| 07 | `07-换掉DSH默认行为.md` | 内置 bash 直连本机不放心，或某个内置插件根本不想要 | patch 的 insert / override / disabled；bundles → profile patch → home patch → `--patch` 的叠加顺序；表达式插值；loader / include / group / timer |
| 08 | `08-同一能力换个供应商.md` | DSH 自带的搜索走官方源，想换成自己的，又不想改消费者 | 服务定义 / provider / 消费者三件套；`Service`、`provide`、`inject`；必需与可选依赖；服务消失自动卸载与重载；`ctx.isolate` |

#### 第二级：让插件对该发生的事有反应（09–11）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 09 | `09-想知道插件里发生了什么.md` | 想统计工具被调了多少次、审批被拒了几次，或对某个时机做自动化 | 事件系统：emit 广播 / bail 短路 / serial 顺序 / waterfall 管道各自用在什么场景；typed events；「监听本身就是 effect」；哪些事件会进 session 记录 |
| 10 | `10-让模型用上我自己的功能.md` | 不想自己点，想对模型说一句「帮我在这堆笔记里找 XX」 | 工具：`defineTool` 的最小形态；参数 schema 与描述怎么写模型才用对；`ToolResult` 的几种形态；长任务走后台；工具在 UI 里怎么展示 |
| 11 | `11-拦住模型乱来.md` | 模型跑了危险命令、写了不该写的目录，想在执行前拦下来 | 工具执行管线的四个拦截点；`PreToolDecision`；`ctx.tools.guard()` 的单调不变式；权限 / 沙箱 / 审批插件挂在哪 |

#### 第三级：让插件进入人的界面（12–15）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 12 | `12-不想每次重复讲规矩.md` | 每次都要跟模型解释「配图放哪、命名怎么起」，烦 | skill：两种形态与扫描根优先级；frontmatter；目录与正文分离的按需加载（上下文成本）；`user-invocable` / `disable-model-invocation` |
| 13 | `13-让别人自己配插件.md` | 插件给同事用，但路径和偏好每人不同，不想让他改 `cordis.yml` | 一个包两半（Host + `src/client`）；`dsh.client` 与 `./client` 导出；设置页按 settings namespace 自动配对；默认值 → 组合 base → 用户文档的层叠；热提交 |
| 14 | `14-在界面上看自己的数据.md` | 想在设置页或侧边栏看到「工作区有多少笔记、最近搜过什么」 | `ctx.remote` 五步与 `/api` 路由；失败词汇表；slot 的声明归属与 props 推导；客户端模块怎么注入 |
| 15 | `15-让结果长得像卡片.md` | 工具结果只是一坨文本，想渲染成可点击的卡片 | 对话渲染：`ConversationNodeDefinition` + 按 key 的 Chat renderer；数据为什么从 `session/event` 来；`followup()` / `steer()` 怎么把交互送回去 |

#### 第四级：让插件走出你的机器（16–19）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 16 | `16-用上自己的模型.md` | 想用本地 Ollama 或公司网关，而不是默认供应商 | `LlmAdapter` 的 `stream()`；`StreamChunk` 协议；`GenerateOptions`；错误与重试该由谁负责 |
| 17 | `17-发给同事安装.md` | 插件在自己机器上跑通了，想让别人一条命令装上 | bundle manifest `dsh.bundle` 与 profile manifest `dsh.profile` 的分工；加载顺序；给 surface bundle 自带命令行；从 GitHub 装时的 build script 坑 |
| 18 | `18-让agent自己加功能.md` | 想临时给页面加个东西，懒得写插件、懒得重装 | 动态 Cordis：运行中检查插件树、内存插件的挂载 / 卸载、生命周期与清理、为什么会影响同进程其他会话 |
| 19 | `19-DSH升级之后.md` | 升级 `dsh` 后插件报错，或行为跟原来不一样了 | developer preview 的破坏性变更节奏；invariants；用 `--dump-config` + 日志诊断；怎么把插件的 API 用法对齐到新版本 |

#### 第五级：让插件扛住真实使用（20–24）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 20 | `20-别让模型乱动我的文件.md` | 在公司机器、重要仓库上，不放心让模型无差别读写文件、跑命令 | 沙箱策略：文件效果模式、进程限制、fail-closed；fs 观察策略；权限预设；哪些边界是插件该自己守的 |
| 21 | `21-关键一步让人拍板.md` | 危险操作前要人确认，或想让人在几个方案里选 | 审批：`ApprovalRequest` / `ApprovalOutcome`、会话级策略、审计事件、answerer 契约；`user-questions`；plan mode 的「先方案、后执行」 |
| 22 | `22-会话一长就爆.md` | 上下文爆掉、模型忘事，或想回查几天前聊过什么 | 会话持久化（JSONL / SQLite、崩溃恢复、`SessionHeader`）；`session-query` 的语义与全文检索；session-projection；compaction 与 checkpoint；超大输出走 spill |
| 23 | `23-这一趟花了多少.md` | 想知道每个会话、每次任务花了多少 token、多久、失败几次 | token-meter 的可重放计量；session-telemetry 的外发上报与脱敏；time-context 给模型的时间信息 |
| 24 | `24-插件自己存状态和密钥.md` | 插件要存自己的状态、要放 API key，不想写死在代码里 | storage 的后端契约与 domain；credentials 的「存引用不存明文」与分层解析；settings 后端；`$DSH_HOME` 里各文件归谁管 |

#### 第六级：让插件参与多代理与自动化（25–27）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 25 | `25-一个任务拆给多个agent.md` | 一个任务太大，想拆给多个 agent；或想把跑腿活挪出主上下文 | subagent：provider 注册、spawn 与 fork 的差别、启动期与运行期的能力分割；agent team：lead / teammate、共享任务 DAG、对等邮箱 |
| 26 | `26-一批任务并行跑.md` | 一批互不依赖的任务想并行跑，且失败不互相拖累 | workflow：脚本编排、阶段、每项失败隔离、结构化结果；jobs：后台作业、`JobId`、生产者契约与消费视图 |
| 27 | `27-让事情定时发生.md` | 想让某件事定时发生，或给会话一个目标让它自动往前推进 | schedule 的会话内定时与持久化转换；goal 的持久化身份与轮次归属；todo 的整表不变量 |

#### 第七级：让 DSH 接上外部世界（28–30）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 28 | `28-接上公司内部系统.md` | 公司内部的日志、工单系统想让模型直接查 | MCP 客户端：怎么挂 MCP server、工具怎么进 catalog、鉴权与凭据怎么给、失败怎么呈现；正好接上 [`golang_mcp`](../golang_mcp/README.md) 专栏 |
| 29 | `29-外部事件触发会话.md` | PR 打开、告警来了，想自动触发一次分析 | webhook：鉴权投递、规则、创建 workspace session 的语义；webhook-github 的现成 PR 评审链路 |
| 30 | `30-把DSH嵌进我的应用.md` | 想在流水线或自己的 App 里驱动 DSH，而不是开界面 | headless / sdk / sdk-minimal / acp 四个 profile 各适合什么；JSON-RPC 与 ACP；api-gateway 与 Typert remote；python-sdk；network-proxy |

#### 第八级：定制模型看到的东西和执行环境（31–34）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 31 | `31-让模型知道我的规矩.md` | 想让模型每次都知道项目规范、能引用具体文件 | agent-instructions 与 system-prompt 的协作式装配；file-reference 的 `@` 引用；time-context；agent-presets 怎么换一套人设与工具 |
| 32 | `32-让模型跑代码.md` | 想让模型跑代码做数据分析，或在远程机器上跑命令 | code-runtime 的请求 / 结果、绑定命名空间、日志捕获与失败分类；subprocess 的显式 spawn；e2b 远程执行 |
| 33 | `33-长驻终端与代码导航.md` | 想让模型多次操作同一个长驻终端；想让它会跳转定义、找引用 | terminal 的会话与后端契约、就绪判定、有界读取；tmux-context；lsp 的四种操作与 provider 契约 |
| 34 | `34-给团队加一条命令.md` | 想把常用操作做成 `/xxx`；想贴截图让模型看图 | commands：注册、adapter 发现、解析与直接调用；attachment：图片身份、验证读、存储 seam；feedback 与 deliverables |

#### 第九级：改 DSH 本身与维护（35–37）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 35 | `35-给DSH提PR.md` | 想给 DSH 内核或内置包提一个改动 | architecture 与 capability-seams；module-graph / graph-atlas 怎么读；development 与三种测试；defensive-patterns；invariants；i18n 流程；postmortem 怎么当反面教材 |
| 36 | `36-复用ClaudeCode的hooks.md` | 从 Claude Code / Codex 迁过来，已有的 hooks 不想重写 | hook-protocol 的通用协议；hooks-claude-code / hooks-codex 各自能承接什么；哪些是「native hook」（普通 Cordis 插件）不需要协议 |
| 37 | `37-会话格式升级了.md` | DSH 升级后老会话数据打不开，或需要迁移 | session-format 的版本与迁移链；persistence-catalog 记录了什么；session-format-status 的当前状态 |

#### 参考型文档：只查不写

字典、字段表、图谱、术语表这类按定义不该顺序读的东西，不排进主线，写作时按需引用：

- Cordis 概念与 API 速查：`docs/cordis-primer.md`、`docs/cordis-api/`
- 速查表：`docs/tool-catalog.md`、`docs/tool-execution-pipeline.md`、`docs/config-catalog.md`、`docs/glossary.md`
- 事件与架构图谱：`docs/event-producer-consumer.md`、`docs/module-graph.md`、`docs/graph-atlas.md`、`docs/agent-lifecycle.md`
- 持久化现状：`docs/persistence-catalog.md`、`docs/session-format-status.md`
- 专题备忘：`docs/web-styling.md`、`docs/deepseek-llm-api-wire-extensions.md`、`docs/rescope.md`、`docs/defensive-patterns.md`
- 仓库维护流程：`docs/cookbook/adding-a-package.md`、`adding-a-vendored-package.md`、`maintaining-dsh-code-review.md`、`responding-to-pr-review-on-a-stack.md`
- 历史事故复盘：`docs/postmortem/`

#### 每篇按同一个骨架写

需求驱动正好对上 [`专栏写作规范.md`](../专栏写作规范.md) 里的**任务型**骨架：开头写「什么时候需要」（不适用的人可以走），再给最小改动，最后才解释概念。结尾以 `**下一篇**：` 开头链到下一篇。

#### 动笔写下一篇时顺手做的事

- 05 已经写好，`04` 的「主线到此结束」也换成了指向 05 的「下一篇」。**05 现在是链路末篇**，所以暂时挂着终点标记；写 06 时把它换成指向 06 的「**下一篇**：」，终点标记继续往后传。
- 新文件名 `NN-描述.md` 的 `NN` 必须与 frontmatter 的 `order` 一致（`tool/check-columns.sh` 会校验）。
- 参考卡片在 `参考/` 下，不编号、不写 `order`，也不参与「下一篇」链路，不用动。
- 改完跑一次：`tool/check-columns.sh "dsh 插件开发学习"`。
