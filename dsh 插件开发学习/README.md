---
title: dsh 插件开发学习
date: 2026-09-12
tags:
  - ai
  - dsh
column: dsh-plugin
order: 0
dsh-version: 0.2.0-rc.2
viewable: true
---
## dsh 插件开发学习

> 官方文档：https://deepseek-harness.github.io/deepseek-harness/

学写 DSH 插件：从最小的 `apply` 函数开始，做到能注册 HTTP 路由、能改页面外观、能调参数、能改掉 DSH 的默认配置，并且卸载时收拾干净。

### 基准版本

全栏（笔记、参考卡片、示例代码）都以 **dsh `0.2.0-rc.2`** 为准，依据是本仓库里的源码快照 `local/deepseek-harness-dsh-v0.2.0-rc.2/`。写新篇、改旧篇、核对某个 API 到底存不存在时，读这份快照的 `packages/` 与 `docs/`——**不要拿本机安装的 `dsh`、别的版本、或记忆里的旧 API 当依据**。预发布期里两代之间会整段更名或删除（例如设置这条线：`ctx.settingsScope` + `installSection` + `settings.plugin.item` 在 0.2.0 里被 `ctx.configForms` + volatile 字段 + `plugins.row.config` 取代）。

每篇 frontmatter 的 `dsh-version` 记的是这篇写作/校对时依据的版本。对不上的篇目，先按它标的版本读快照，再决定是改这篇还是标注差异。

### 读完能做到什么

**能**：写出一个能被 `dsh plugin add` 自动配置的插件包；用 `ctx.inject` 拿到内部服务、注册 HTTP 路由；监听注入类事件往页面里塞样式；理解插件从加载到卸载的四个阶段，知道什么必须交给 `ctx.effect` 管理；把写死的参数抽成 `Config`，在 profile 里覆盖它；用 patch 关掉或改写 DSH 自带插件的配置，不动 `node_modules`；给某个能力写自己的提供方（比如让 `web_search` 查自己的源），消费者一行不用改；订阅 DSH 内部事件（工具调用、审批结果、会话记录）做统计，并在五种分发模式里挑对一种。

**不能**：不覆盖 Cordis 的全部 API（那是 [`cordis_api.md`](../dsh/cordis_api.md)的事）；不涉及 React 客户端组件与 slot 体系（需求走到「界面」那一级才会遇到）；不解释 DSH 内核为什么这么设计（那是 `docs/subsystems/` 的事）。

### 前置假设

- 会 TypeScript / Node。
- 本机装好了 `dsh` 和 `pnpm`。
- 不需要预先了解 Cordis 或插件机制。

### 一条主线

**下面按顺序读就行**——每篇开头写了前置是哪个完整文件名。

1. [01-profile、bundle 与插件的关系](01-profile、bundle 与插件的关系.md)——profile、bundle、插件三者的关系，建一个干净的 test profile
2. [02-最小插件的结构与配置](02-最小插件的结构与配置.md)——一个插件包最少要有哪些文件，怎么被 `dsh plugin add` 自动配置
3. [03-用 patch 覆盖 DSH 的默认配置](03-用 patch 覆盖 DSH 的默认配置.md)——用 patch 改内置行、插自己的行、停用不要的行
4. [04-注册 HTTP 路由与注入页面样式](04-注册 HTTP 路由与注入页面样式.md)——注册 HTTP 路由，往页面里注入 CSS
5. [05-插件生命周期与 ctx.effect](05-插件生命周期与 ctx.effect.md)——插件从加载到卸载的四个阶段，什么必须交给 `ctx.effect`
6. [06-用 Config schema 声明插件配置](06-用 Config schema 声明插件配置.md)——`Config` + schema，配置的层叠与覆盖
7. [07-配置与源码的热重载](07-配置与源码的热重载.md)——patch 与源码的热重载，哪些改动必须重启
8. [08-替换内置能力的提供方与消费者](08-替换内置能力的提供方与消费者.md)——服务定义 / 提供方 / 消费者三件套，把某个能力换成自己的实现
9. [09-订阅 DSH 事件与五种分发模式](09-订阅 DSH 事件与五种分发模式.md)——订阅工具调用、审批结果与会话记录，把计数挂到 HTTP 路由上
10. [10-事件进阶](10-事件进阶.md)——DSH 的一百多个事件地图、Cordis 事件与会话记录的区别、一轮对话的完整生命周期
11. [11-为模型注册自定义工具](11-为模型注册自定义工具.md)——`defineTool` 注册一个 `note_search`，参数描述、ToolResult、后台任务与卡片意图
12. [12-在工具执行管线拦截危险调用](12-在工具执行管线拦截危险调用.md)——工具执行管线的四个拦截点，用 `ctx.tools.guard()` 拦下危险调用
13. [13-用 Skill 固化提示词与规则](13-用 Skill 固化提示词与规则.md)——把「配图放哪、命名怎么起」写成 skill，DSH 每次自己带上
14. [14-把插件配置搬进设置页](14-把插件配置搬进设置页.md)——一个包两半（Host + client），配置项搬进设置页
15. [15-把 Host 数据展示到界面](15-把 Host 数据展示到界面.md)——`/api` 路由暴露统计，客户端模块挂到侧边栏 slot
16. [16-把工具结果渲染成卡片](16-把工具结果渲染成卡片.md)——给 `note_search` 的结果做可点击的卡片，交互经 `followup` / `steer` 送回会话
17. [17-编写 LLM adapter 接入自有模型](17-编写 LLM adapter 接入自有模型.md)——写一个 `LlmAdapter`，把会话切到本机 Ollama 或公司内网的网关
18. [18-把插件打包成配置包](18-把插件打包成配置包.md)——把插件做成配置包，`dsh plugin add` 一条命令装上，四层 patch 的叠加顺序
19. [19-运行期动态挂载插件](19-运行期动态挂载插件.md)——运行期组合：把一截内存插件挂进正在跑的进程，用完摘掉
20. [20-DSH 升级后的版本与兼容性排查](20-DSH 升级后的版本与兼容性排查.md)——预发布期的破坏性变更节奏，升级后怎么把插件的 API 用法对齐回来
21. [21-文件访问的三层管控](21-文件访问的三层管控.md)——沙箱、观察策略、权限预设三层各管什么，失败时 fail-closed 落在哪
22. [22-危险操作的审批通道](22-危险操作的审批通道.md)——审批的四个结局与审计对，提问 seam，以及 plan mode 为什么不是拦截器
23. [23-会话上下文的压缩、裁剪与排水](23-会话上下文的压缩、裁剪与排水.md)——会话日志是唯一真相；压缩、裁剪、排水是三件不同的事
24. [24-会话用量与成本的计量](24-会话用量与成本的计量.md)——可重放计量、它的精度边界，以及外发上报时脱敏该由谁做
25. [25-插件的状态、密钥与配置存储](25-插件的状态、密钥与配置存储.md)——状态、密钥、用户配置各走哪条缝，「存引用不存明文」的准确含义
26. [26-多 agent 的任务拆解](26-多 agent 的任务拆解.md)——subagent 的 provider 注册与 spawn / fork 的差别；agent team 的 lead / teammate 与共享任务 DAG
27. [27-一批任务的并行编排](27-一批任务的并行编排.md)——workflow 的脚本编排、阶段与失败隔离；jobs 的后台作业与消费视图
28. [28-定时任务与目标推进](28-定时任务与目标推进.md)——schedule 的会话内定时与持久化转换；goal 的身份与轮次归属；todo 的整表不变量
29. [29-接入 MCP 服务](29-接入 MCP 服务.md)——把外部 MCP server 挂进来：工具怎么进 catalog、凭据怎么给、失败怎么呈现
30. [30-外部事件触发会话](30-外部事件触发会话.md)——webhook 的鉴权投递与规则、创建 workspace session 的语义，以及 GitHub 的现成评审链路
31. [31-把 DSH 嵌进自己的应用](31-把 DSH 嵌进自己的应用.md)——headless / sdk / sdk-minimal / acp 四个 profile 各适合什么；JSON-RPC 与 ACP
32. [32-系统提示词的配置](32-系统提示词的配置.md)——agent-instructions 与 system-prompt 的协作式配置、`@` 文件引用、agent-presets 换人设
33. [33-代码执行环境的接入](33-代码执行环境的接入.md)——PTC 的请求与执行规格边界、八个失败分类、绑定命名空间、子进程缝上的环境变量
34. [34-长驻终端与代码导航](34-长驻终端与代码导航.md)——终端的会话与后端契约、就绪的四种结束原因、三层字节上界；LSP 的四种操作与 provider 契约
35. [35-给团队加一条命令](35-给团队加一条命令.md)——命令注册表与 adapter、附件的身份与验证读、feedback 与 deliverables 为什么只给人看
36. [36-给DSH提PR](36-给DSH提PR.md)——门禁的权威在脚本里、测试的七层、生成物不许手改、能力缝与不变式、postmortem 当反面教材
37. [37-复用ClaudeCode的hooks](37-复用ClaudeCode的hooks.md)——协议 hook 与 native hook 两条路、两个桥各能承接什么、哪些 hook 从根上迁不过来
38. [38-会话格式升级了](38-会话格式升级了.md)——会话在磁盘上的布局、写入器 / 已定稿 / 已发布三个数、迁移链的两条硬约束、插件该怎么读会话

同一批篇目按主题分成九级，另外列在下面的[接下来的路](#接下来的路)；参考卡片另见[参考卡片](#参考卡片)。

### 只想找某一件事

| 我想…… | 看这篇 |
| --- | --- |
| 搞懂 profile 和 bundle 到底啥关系 | [01-profile、bundle 与插件的关系](01-profile、bundle 与插件的关系.md) |
| 知道一个插件包最少要有哪些文件 | [02-最小插件的结构与配置](02-最小插件的结构与配置.md) |
| 让插件能被自动配置（不用手改 profile） | [02-最小插件的结构与配置](02-最小插件的结构与配置.md) → 「bundle 声明」一节 |
| `patch.yaml` 里的 `insert` 是什么意思 | [03-用 patch 覆盖 DSH 的默认配置](03-用 patch 覆盖 DSH 的默认配置.md) |
| 注册一个 HTTP 路由 | [04-注册 HTTP 路由与注入页面样式](04-注册 HTTP 路由与注入页面样式.md) |
| 往页面里注入 CSS 或脚本 | [04-注册 HTTP 路由与注入页面样式](04-注册 HTTP 路由与注入页面样式.md) |
| 插件卸载后路由还留着 / 报 duplicate route | [05-插件生命周期与 ctx.effect](05-插件生命周期与 ctx.effect.md) |
| 让插件里某个值可配（换图、调透明度） | [06-用 Config schema 声明插件配置](06-用 Config schema 声明插件配置.md) |
| 配置写了不生效 / 想覆盖插件的默认值 | [06-用 Config schema 声明插件配置](06-用 Config schema 声明插件配置.md) → 「配置的层叠」一节 |
| 改一行代码／改一处 patch 不想重启 | [07-配置与源码的热重载](07-配置与源码的热重载.md) |
| 改了没生效，终端还什么都不说 | [07-配置与源码的热重载](07-配置与源码的热重载.md) → 「改动没生效时的排查」 |
| 把某项能力换成自己的实现（搜索走自己的源） | [08-替换内置能力的提供方与消费者](08-替换内置能力的提供方与消费者.md) |
| 搞清服务定义 / 提供方 / 消费者各是谁 | [08-替换内置能力的提供方与消费者](08-替换内置能力的提供方与消费者.md) → 「三件套」一节 |
| 搜索报 provider 不可用 / 歧义 | [08-替换内置能力的提供方与消费者](08-替换内置能力的提供方与消费者.md) → 「选择失败」一节 |
| 统计工具调了多少次、多久、失败几次 | [09-订阅 DSH 事件与五种分发模式](09-订阅 DSH 事件与五种分发模式.md) |
| 订阅审批结果或会话记录 | [09-订阅 DSH 事件与五种分发模式](09-订阅 DSH 事件与五种分发模式.md) → 「统计真实事件」一节 |
| 搞清 emit / parallel / serial / bail / waterfall 的区别 | [09-订阅 DSH 事件与五种分发模式](09-订阅 DSH 事件与五种分发模式.md) → 「五种分发模式」一节 |
| 插件卸载后监听器还留着 / 重载后事件重复响应 | [09-订阅 DSH 事件与五种分发模式](09-订阅 DSH 事件与五种分发模式.md) → 「监听器的归属」一节 |
| DSH 一共有哪些事件、怎么查全 | [10-事件进阶](10-事件进阶.md) → 「事件的三层」一节 |
| 某个时刻该听哪个事件 | [10-事件进阶](10-事件进阶.md) → 「真实事件轨迹」一节 |
| `turn/end` 这类监听器为什么永远不触发 | [10-事件进阶](10-事件进阶.md) → 「一个不触发的监听器」一节 |
| 只想收某个 agent 的事件 / 收不到事件 | [10-事件进阶](10-事件进阶.md) → 「事件的作用域过滤」一节 |
| 查热重载管哪些文件、`hmr` 行的 `root` 怎么配 | [profile 与插件包结构](参考/profile与插件包结构.md) → 「热重载速查」 |
| 关掉一个内置插件，或改它的参数 | [03-用 patch 覆盖 DSH 的默认配置](03-用 patch 覆盖 DSH 的默认配置.md) |
| 不想用了，怎么停用而不是卸载插件 | [03-用 patch 覆盖 DSH 的默认配置](03-用 patch 覆盖 DSH 的默认配置.md) → 「patch 语法」一节 |
| 搞不清 patch 的「行」和运行的「树」是什么关系 | [由行组成的树](参考/由行组成的树.html) |
| 查 profile 目录里某个文件能不能手改 | [profile 与插件包结构](参考/profile与插件包结构.md) |
| 给模型加一个自己的工具 | [11-为模型注册自定义工具](11-为模型注册自定义工具.md) |
| 工具参数写了模型不用 / 用错 | [11-为模型注册自定义工具](11-为模型注册自定义工具.md) → 「参数 schema 与描述」相关小节 |
| 长任务不想堵会话 | [11-为模型注册自定义工具](11-为模型注册自定义工具.md) → 「长任务走后台」相关小节 |
| 想在执行前拦下危险调用 | [12-在工具执行管线拦截危险调用](12-在工具执行管线拦截危险调用.md) |
| 搞清权限、沙箱、审批各挂在哪 | [12-在工具执行管线拦截危险调用](12-在工具执行管线拦截危险调用.md) → 「权限、沙箱、审批的挂点」 |
| 把项目规矩沉淀成 skill | [13-用 Skill 固化提示词与规则](13-用 Skill 固化提示词与规则.md) |
| skill 写了没被模型用上 | [13-用 Skill 固化提示词与规则](13-用 Skill 固化提示词与规则.md) → 「扫描根与优先级」相关小节 |
| 让插件使用者在界面上改配置，不碰 cordis.yml | [14-把插件配置搬进设置页](14-把插件配置搬进设置页.md) |
| 自己插件注册了设置项，设置页上却没有卡片 | [设置项与卡片速查](参考/设置项与卡片速查.md) → 「浏览器侧：卡片槽位」 |
| 在侧边栏 / 设置页展示自己的数据 | [15-把 Host 数据展示到界面](15-把 Host 数据展示到界面.md) |
| 外部插件能不能用 `ctx.remote` | [15-把 Host 数据展示到界面](15-把 Host 数据展示到界面.md) |
| 把工具结果渲染成可点击的卡片 | [16-把工具结果渲染成卡片](16-把工具结果渲染成卡片.md) |
| 卡片点击后怎么把交互送回会话 | [16-把工具结果渲染成卡片](16-把工具结果渲染成卡片.md) → 「把交互送回去」相关小节 |
| 换成本机 Ollama 或公司内网的网关 | [17-编写 LLM adapter 接入自有模型](17-编写 LLM adapter 接入自有模型.md) |
| 写一个模型提供方（adapter） | [17-编写 LLM adapter 接入自有模型](17-编写 LLM adapter 接入自有模型.md) → 「插件代码」相关小节 |
| 把插件打包，让同事一条命令装上 | [18-把插件打包成配置包](18-把插件打包成配置包.md) |
| 从 GitHub 装插件时构建脚本被拦住 | [18-把插件打包成配置包](18-把插件打包成配置包.md) → 「从 GitHub 安装」 |
| 不写包、不重装，临时挂一个插件 | [19-运行期动态挂载插件](19-运行期动态挂载插件.md) |
| 挂上了却什么都没发生（停在 PENDING） | [19-运行期动态挂载插件](19-运行期动态挂载插件.md) → 「挂载不等于生效」 |
| 升级 `dsh` 之后插件报错 | [20-DSH 升级后的版本与兼容性排查](20-DSH 升级后的版本与兼容性排查.md) |
| 不让模型读写工作区以外的文件 | [21-文件访问的三层管控](21-文件访问的三层管控.md) |
| 文件明明读过还是被拒 | [21-文件访问的三层管控](21-文件访问的三层管控.md) → 「观察策略的真实语义」 |
| 危险操作前停下来问人 | [22-危险操作的审批通道](22-危险操作的审批通道.md) |
| 审批没人应答 / headless 下直接被拒 | [22-危险操作的审批通道](22-危险操作的审批通道.md) → 「审批是一条通道」 |
| 上下文撑不住、模型开始忘事 | [23-会话上下文的压缩、裁剪与排水](23-会话上下文的压缩、裁剪与排水.md) |
| 想回查几天前的会话 | [23-会话上下文的压缩、裁剪与排水](23-会话上下文的压缩、裁剪与排水.md) → 「派生读模型」 |
| 看一个会话花了多少 token、多久 | [24-会话用量与成本的计量](24-会话用量与成本的计量.md) |
| 想知道失败了几次 | [24-会话用量与成本的计量](24-会话用量与成本的计量.md) → 「自己折的失败计数」 |
| 插件要存自己的状态 | [25-插件的状态、密钥与配置存储](25-插件的状态、密钥与配置存储.md) |
| 插件要放 API key，又不想写进配置 | [25-插件的状态、密钥与配置存储](25-插件的状态、密钥与配置存储.md) → 「引用与值」 |
| 查 `ctx` 上还有哪些能力 | [Cordis API 文档](../dsh/cordis_api.md) |

### 参考卡片

不是读物，查到才用：

- [profile 与插件包结构](参考/profile与插件包结构.md)——profile 目录逐文件说明、patch 合成模型、插件包内部结构、维护速查表
- [设置项与卡片速查](参考/设置项与卡片速查.md)——volatile 字段声明与读值、`ctx.settings`（`SettingsForms`）方法表、表单 namespace 的由来、`ctx.configForms` 与 `ConfigFormSnapshot` / `ConfigForm` 字段表、插件页三个配置挂载点与行 key 规则、落盘位置、两条生效路径对照
- [事件生命周期](参考/事件生命周期.html)——可交互的事件全表（按发生时机分区、带分发模式徽标），以及一轮对话从 `agent/created` 到收尾的主干顺序；来源是快照里所有事件的 `@mode` 注解
- [由行组成的树](参考/由行组成的树.html)——左栏四层 `cordis.patch.yml` 的行、右栏叠出来的插件树逐条对照：悬停任一行能看到同一 `id` 在哪些层被插入 / 改参数 / 停用，`group: true` 那一行的 `config` 就是它的子行列表；来源是 base、web-app、profile 与 overlay 四份真实补丁

### 接下来的路

撰写文档同时要完成代码，代码放在仓库内的 `code/dsh_plugin/`（与既有的三十多个 demo 同处一地；只写代码，不在本机执行、不启动 dsh）。

#### 第一级：贴合我的环境（03，06–08）

「贴合我的环境」这一级从 [03-用 patch 覆盖 DSH 的默认配置](03-用 patch 覆盖 DSH 的默认配置.md)就开始了：它教的是**改 DSH 自己的配置**，把它提前到 [02-最小插件的结构与配置](02-最小插件的结构与配置.md)后面，是因为 `patch.yaml` 在那一篇就已经出现过了，早解释早省事。

| 编号     | 文件                 | 需求（什么场景下看这篇）                 | 讲清 DSH 的什么                                                                                                            |
| ------ | ------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 03（已写） | `03-用 patch 覆盖 DSH 的默认配置.md` | 内置 bash 直连本机不放心，或某个内置插件根本不想要 | patch 的 insert / id+字段 / disabled；bundles → profile patch → home patch → `--patch` 的叠加顺序；`!!js` 表达式；id 找不到与文件写错两种失败待遇 |
| 06（已写） | `06-用 Config schema 声明插件配置.md`     | 换张背景图、调个透明度都要改代码重装           | `Config` + Schemastery schema；`cordis.yml` 的 `config` 块；配置层叠与 patch 覆盖；默认值放哪；非法配置为什么必须加载失败                            |
| 07（已写） | `07-配置与源码的热重载.md`    | 改一行就重启，迭代太慢；改了没生效还说不出为什么     | 配置热重载（默认开）与源码热重载（`hmr` 行的 `root`）；Fiber 状态机；改坏了会怎样；用 `--dump-config` 排查                                 |
| 08（已写） | `08-替换内置能力的提供方与消费者.md`  | DSH 自带的搜索走官方源，想换成自己的，又不想改消费者 | 服务定义 / provider / 消费者三件套；`inject` 与 `ctx.get` 的必需／可选之分；选择失败的四种 code；服务消失自动卸载与重载 |

#### 第二级：响应事件（09–12）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 09（已写） | `09-订阅 DSH 事件与五种分发模式.md` | 想统计工具被调了多少次、审批被拒了几次，或对某个时机做自动化 | 事件系统：emit 广播 / bail 短路 / serial 顺序 / waterfall 管道各自用在什么场景；typed events；「监听本身就是 effect」；哪些事件会进 session 记录 |
| 10（已写） | `10-事件进阶.md` | 想知道 DSH 到底有多少事件、一轮对话里依次发生了什么 | 事件地图与分类；Cordis 事件与会话记录的分工；一轮对话从 prompt 到 `turn/end` 的完整生命周期 |
| 11（已写） | `11-为模型注册自定义工具.md` | 不想自己点，想对模型说一句「帮我在这堆笔记里找 XX」 | 工具：`defineTool` 的最小形态；参数 schema 与描述怎么写模型才用对；`ToolResult` 的几种形态；长任务走后台；工具在 UI 里怎么展示 |
| 12（已写） | `12-在工具执行管线拦截危险调用.md` | 模型跑了危险命令、写了不该写的目录，想在执行前拦下来 | 工具执行管线的四个拦截点；`PreToolDecision`；`ctx.tools.guard()` 的单调不变式；权限 / 沙箱 / 审批插件挂在哪 |

#### 第三级：接入界面（13–16）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 13（已写） | `13-用 Skill 固化提示词与规则.md` | 每次都要跟模型解释「配图放哪、命名怎么起」，烦 | skill：两种形态与扫描根优先级；frontmatter；目录与正文分离的按需加载（上下文成本）；`user-invocable` / `disable-model-invocation` |
| 14（已写） | `14-把插件配置搬进设置页.md` | 插件给同事用，但路径和偏好每人不同，不想让他改 `cordis.yml` | 一个包两半（Host + `src/client`）；`dsh.client` 与 `./client` 导出；Host 侧只把要现场改的字段声明 `.volatile()`（类型是 `Volatile<T>`，读值走 `.get()`），表单的 namespace 就是这一行在 profile 里的 entry id；浏览器侧把配置页注册进插件页的 keyed 槽位 `plugins.row.config`（key = `<包名>#<行 id>`），插件页把表单作为 `form`（`state` + `mutate`）prop 喂给组件；设置写进当前 profile 的 patch；两条生效路径（装载层重启 / 设置页 volatile 提交不重启） |
| 15（已写） | `15-把 Host 数据展示到界面.md` | 想在设置页或侧边栏看到「工作区有多少笔记、最近搜过什么」 | `ctx.remote` 五步与 `/api` 路由；失败词汇表；slot 的声明归属与 props 推导；客户端模块怎么注入 |
| 16（已写） | `16-把工具结果渲染成卡片.md` | 工具结果只是一坨文本，想渲染成可点击的卡片 | 对话渲染：`ConversationNodeDefinition` + 按 key 的 Chat renderer；数据为什么从 `session/event` 来；`followup()` / `steer()` 怎么把交互送回去 |

#### 第四级：走出本机（17–20）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 17（已写） | `17-编写 LLM adapter 接入自有模型.md` | 想用本地 Ollama 或公司网关，而不是默认供应商 | `LlmAdapter` 的 `stream()`；`StreamChunk` 协议；`GenerateOptions`；错误与重试该由谁负责 |
| 18（已写） | `18-把插件打包成配置包.md` | 插件在自己机器上跑通了，想让别人一条命令装上 | bundle manifest `dsh.bundle` 与 profile manifest `dsh.profile` 的分工；四层加载顺序；给 surface bundle 自带命令行；从 GitHub 装时的 build script 坑 |
| 19（已写） | `19-运行期动态挂载插件.md` | 想临时给页面加个东西，懒得写插件、懒得重装 | 动态 Cordis：`ctx.plugin()` 与 fiber、运行中检查插件树、内存插件的挂载 / 卸载、生命周期与清理、为什么会影响同进程其他会话 |
| 20（已写） | `20-DSH 升级后的版本与兼容性排查.md` | 升级 `dsh` 后插件报错，或行为跟原来不一样了 | developer preview 的破坏性变更节奏；invariants；用 `--dump-config` + 日志诊断；怎么把插件的 API 用法对齐到新版本 |

#### 第五级：扛住真实使用（21–25）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 21（已写） | `21-文件访问的三层管控.md` | 在公司机器、重要仓库上，不放心让模型无差别读写文件、跑命令 | 沙箱策略：文件效果模式、策略解析链、fail-closed；fs 观察策略的真实语义；权限预设打包了什么；哪些边界是插件该自己守的 |
| 22（已写） | `22-危险操作的审批通道.md` | 危险操作前要人确认，或想让人在几个方案里选 | 审批：`ApprovalRequest` / `ApprovalOutcome`、会话级策略、审计对、answerer 契约；`user-questions`；plan mode 的「先方案、后执行」 |
| 23（已写） | `23-会话上下文的压缩、裁剪与排水.md` | 上下文爆掉、模型忘事，或想回查几天前聊过什么 | 会话日志是唯一真相；落盘与崩尾恢复；投影 / 检索 / 计量三条派生路；压缩、裁剪、排水三件事；四种 checkpoint |
| 24（已写） | `24-会话用量与成本的计量.md` | 想知道每个会话、每次任务花了多少 token、多久、失败几次 | token-meter 的可重放计量与精度边界；session-telemetry 的外发上报与脱敏责任；time-context 给模型的时间信息；失败计数自己折 |
| 25（已写） | `25-插件的状态、密钥与配置存储.md` | 插件要存自己的状态、要放 API key，不想写死在代码里 | storage 的后端契约与 domain；credentials 的「存引用不存明文」与分层解析；settings 三层；`$DSH_HOME` 里各文件归谁管 |

#### 第六级：多代理与自动化（26–28）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 26（已写） | `26-多 agent 的任务拆解.md` | 一个任务太大，想拆给多个 agent；或想把跑腿活挪出主上下文 | subagent：provider 注册、spawn 与 fork 的差别、启动期与运行期的能力分割；agent team：lead / teammate、共享任务 DAG、对等邮箱 |
| 27（已写） | `27-一批任务的并行编排.md` | 一批互不依赖的任务想并行跑，且失败不互相拖累 | workflow：脚本编排、阶段、每项失败隔离、结构化结果；jobs：后台作业、`JobId`、生产者契约与消费视图 |
| 28（已写） | `28-定时任务与目标推进.md` | 想让某件事定时发生，或给会话一个目标让它自动往前推进 | schedule 的会话内定时与持久化转换；goal 的持久化身份与轮次归属；todo 的整表不变量 |

#### 第七级：接入外部世界（29–31）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 29（已写） | `29-接入 MCP 服务.md` | 公司内部的日志、工单系统想让模型直接查 | MCP 客户端：怎么挂 MCP server、工具怎么进 catalog、鉴权与凭据怎么给、失败怎么呈现；正好接上 [`golang_mcp`](../golang_mcp/README.md)专栏 |
| 30（已写） | `30-外部事件触发会话.md` | PR 打开、告警来了，想自动触发一次分析 | webhook：鉴权投递、规则、创建 workspace session 的语义；webhook-github 的现成 PR 评审链路 |
| 31（已写） | `31-把 DSH 嵌进自己的应用.md` | 想在流水线或自己的 App 里驱动 DSH，而不是开界面 | headless / sdk / sdk-minimal / acp 四个 profile 各适合什么；JSON-RPC 与 ACP；api-gateway 与 Typert remote；python-sdk；network-proxy |

#### 第八级：定制模型上下文与执行环境（32–35）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 32（已写） | `32-系统提示词的配置.md` | 想让模型每次都知道项目规范、能引用具体文件 | agent-instructions 与 system-prompt 的协作式配置；file-reference 的 `@` 引用；agent-presets 怎么换一套人设与工具 |
| 33（已写） | `33-代码执行环境的接入.md` | 想让模型写一段代码跑一下、看结果，而不是一个个来回调工具 | PTC（程序化工具调用）：请求与执行规格的边界；八个失败分类为什么必须分开；绑定命名空间与可移植名字；`ctx.ptcRuntime` 的服务定义与消费者；子进程缝上环境变量的归属 |
| 34（已写） | `34-长驻终端与代码导航.md` | 想让模型多次操作同一个长驻终端；想让它会跳转定义、找引用 | terminal 的会话与后端契约、就绪判定、有界读取；tmux-context；lsp 的四种操作与 provider 契约 |
| 35（已写） | `35-给团队加一条命令.md` | 想把常用操作做成 `/xxx`；想贴截图让模型看图 | commands：注册、adapter 发现、解析与直接调用；attachment：图片身份、验证读、存储 seam；feedback 与 deliverables |

#### 第九级：改 DSH 与维护（36–38）

| 编号 | 文件 | 需求（什么场景下看这篇） | 讲清 DSH 的什么 |
| --- | --- | --- | --- |
| 36（已写） | `36-给DSH提PR.md` | 想给 DSH 内核或内置包提一个改动 | architecture 与 capability-seams；module-graph / graph-atlas 怎么读；development 与三种测试；defensive-patterns；invariants；i18n 流程；postmortem 怎么当反面教材 |
| 37（已写） | `37-复用ClaudeCode的hooks.md` | 从 Claude Code / Codex 迁过来，已有的 hooks 不想重写 | hook-protocol 的通用协议；hooks-claude-code / hooks-codex 各自能承接什么；哪些是「native hook」（普通 Cordis 插件）不需要协议 |
| 38（已写） | `38-会话格式升级了.md` | DSH 升级后老会话数据打不开，或需要迁移 | session-format 的版本与迁移链；persistence-catalog 记录了什么；session-format-status 的当前状态 |

#### 参考型文档

字典、字段表、图谱、术语表这类按定义不该顺序读的东西，不排进主线，写作时按需引用（都在 `local/deepseek-harness/docs/` 下）：

- Cordis 概念与 API 速查：`docs/cordis-primer.md`、`docs/cordis-api/`
- 速查表：`docs/tool-catalog.md`、`docs/tool-execution-pipeline.md`、`docs/config-catalog.md`、`docs/glossary.md`
- 事件与架构图谱：`docs/event-producer-consumer.md`、`docs/module-graph.md`、`docs/graph-atlas.md`、`docs/agent-lifecycle.md`
- 持久化现状：`docs/persistence-catalog.md`、`docs/session-format-status.md`
- 专题备忘：`docs/web-styling.md`、`docs/deepseek-llm-api-wire-extensions.md`、`docs/rescope.md`、`docs/defensive-patterns.md`
- 仓库维护流程：`docs/cookbook/adding-a-package.md`、`adding-a-vendored-package.md`、`maintaining-dsh-code-review.md`、`responding-to-pr-review-on-a-stack.md`
- 历史事故复盘：`docs/postmortem/`

#### 统一约束

- **骨架**：对上本栏的既有体例（`专栏写作规范.md` 在本仓库里已缺失，实际约定以本条为准）——开头三行（读完你能 / 前置 / 约 N 分钟），正文按「**目标** → **DSH 设计** → 具体做法 → 完整代码 / 代码解释 → 注意事项」，文末不写预告、不写「参考：」这类尾注；正文里提到别的篇一律写完整文件名（含编号）并加超链接，不用「上一篇 / 下一篇 / 08 篇」这类指代。「**DSH 设计**」自包含地讲本篇主题背后的 DSH 设计：**站在源码本身讲设计，不从本篇角度叙述**——不写「本篇的做法由……决定」这类从正文出发的句子，也不引用正文小节；**不假设读者读过本篇或任何前篇**，读者按新手对待，DSH 专有名词（profile、bundle、patch、seam、fiber、waterfall 等）第一次出现必须用大白话解释，解释不了就不用这个词；论断须能在源码快照（`local/deepseek-harness-dsh-v0.2.0-rc.2/`，优先 `docs/architecture.zh.md` 与对应 `docs/subsystems/*.zh.md`）找到出处并括号注明路径；至少配一个表达设计结构（非步骤复述）的 mermaid 图，图内文字同样不许出现未解释的术语。
- **两处本栏自己的取舍**：首节统一用「**目标**」（规范里叫「什么时候需要」）：先说清这篇改完是什么样，不适用的人自己会走；小节标题一律用**名词短语**，不写「第一步／第二步」，也不用问句。
- **例子按需求挑**，不追求全栏一致：同一个例子被相邻几篇接着用，是因为它确实接得上。
- **代码只给 delta**；字段表、错误码这类查阅内容进 `参考/`。
- **文件名与 order**：`NN-描述.md` 的 `NN` 必须与 frontmatter 的 `order` 一致；参考卡片不编号、不写 `order`，也不参与主线链路。
- **只讲用得到的**：一篇里用不到的概念，哪怕核心也不提——留在「参考型文档」或别的篇里。
- **不写教练口吻的套话**：「值得抄在本子上」「记住一句话」「记忆口诀」「划重点」「值得点一下」这类评价读者该怎么做笔记、该记住什么的话一律不写——直接说内容。概念也别自建一套名词再逐层解释，能挂到读者已有的心智模型上（比如「面向接口编程」）就挂上去。
- **不假设读者已知**：一个机制第一次出现时，先交代前提——它是什么、为什么会存在、谁在用它——再说怎么用。不写「`signal` 要透传下去」这种只有已经知道内情的人才读得懂的动作句；也不要用没铺垫过的内部词汇（`realm`、`宿主`、`preset`）。判断标准：这句话单独拎出来，一个只读到这里的读者能不能懂。

#### 写下一篇时的维护清单

- **01–38 已经写好：38 现在是链路末篇**，篇尾挂着「**主线到此结束**」。终点标记从 34 一路传到 38；九级表里 26–38 行都标了「（已写）」，「一条主线」的有序列表也在本轮补全到 38（原先只到 25，靠一句「其余篇目见接下来的路」兜着）。
- **01–38 已全部补过「DSH 设计」一节**（2026-10-16 补写，同日按「自包含 + 零基础」标准重写过一轮）：每篇在「目标」之后有一节站在源码本身讲本篇主题背后的 DSH 设计——不从本篇角度叙述、不假设读者读过本文，专有名词首次出现必有大白话解释；论断带快照出处括注，配 1–2 个 mermaid 设计结构图（样板见 [02-最小插件的结构与配置](02-最小插件的结构与配置.md)）。新篇照「统一约束」的骨架写；改旧篇的做法部分时，回头核对 DSH 设计是否还成立。
- **35–38 的 demo 分两套构建形态，都是有意的**：[35-给团队加一条命令](35-给团队加一条命令.md)的 `dsh-command-kit/`、[38-会话格式升级了](38-会话格式升级了.md)的 `dsh-session-audit/` 走「`patch.yaml` + 插件行直接指 `src/*.ts`」（与 [34-长驻终端与代码导航](34-长驻终端与代码导航.md)的 `dsh-nav-kit` 一致，省一次构建）；[36-给DSH提PR](36-给DSH提PR.md)的 `dsh-kernel-map/`、[37-复用ClaudeCode的hooks](37-复用ClaudeCode的hooks.md)的 `dsh-native-hook/` 走「`cordis.patch.yml` + `build.mjs` → `lib/index.js`」，更贴近内置包那种 JS 产物加载路径。
- **[36-给DSH提PR](36-给DSH提PR.md)有三处对规划的更正 / 补充**：① 规划写「想给 DSH 内核或内置包提一个改动」，而 `CONTRIBUTING.md:9` 明说**当前不收外部 PR**——正文因此把这篇定位成「动手改内核之前要知道什么」，并如实分出「写仓库外插件」与「在 fork 里改内核」两条路；② 规划写的「三种测试」在快照里实际是**七层**（单测 / 覆盖率 / 真 API e2e / owner-local 期望 / 性能基准 / 会话快照 / Web 浏览器快照），正文按七层写；③ 不变式的规则本栏第一稿抄错了——`docs/subsystems/invariants.md` 那一节仍写着「每个 workspace 包都拥有 companion，没有可查关系的就导出以 `No runtime invariant:` 打头的空安装器」，而 2026-08-28 的简化注记与 `scripts/package-invariants.ts` 已经改成「省略该子路径并在 README 写包特定原因，**空安装器被拒**」（快照实测 38 个 `src/invariant.ts` 对 316 个 `package.json`）。这条过期文档正好是本篇主题的又一个实例，正文已按现行规则写并把这件事当成例子。
- **两处文档自身的漂移已写进正文**：`docs/AGENTS.md` 说 `testing.md` 上限 1300，而门禁真正读的 `scripts/doc-budgets.manifest.json` 里是 1350——权威是清单；`docs/subsystems/invariants.md` 的空安装器段落落后于 2026-08-28 的简化注记。另外 `doc-sync` 实测 43 条、`check:all` 展开后约 71 个门禁、`gen-config-catalog` 的报错模板与 `gen-module-graph` 同款（素材里那份是过期模板，已按源码改正）。
- **[37-复用ClaudeCode的hooks](37-复用ClaudeCode的hooks.md)有三处发现值得留在版面上**：① 规划里的「哪些是 native hook」在仓库里**有官方定义**（`docs/cookbook/extension-cookbook.md`：挂在拦截点上的普通 Cordis 插件，不需要外部协议）；② 两个桥包的 README 都在 Known Limitations 里写「`SessionStart` 是 detached 跑的、可能错过第一个请求」，而同一份 README 讲接线的另一节又写它是 **awaited** 的——源码站后者（`detached.track(run)` 之后紧跟 `await run`），桥自己的测试也断言第一个请求看得到那段文本。正文以代码为准，并把这处「文档与代码不一致」单独写成一节；③ demo `dsh-native-hook` 原本订阅了当前版本不存在的事件 `agent/session-start`（只存在于归档 Agent Note，当前源码里零命中），而 `build.mjs` 走 esbuild **不求值类型**，于是两处错误——事件名、以及注入消息的 source 没做声明（消息来源映射里**没有通用的 `plugin` kind**）——都会静默失效。现已改成 `agent/created` + `declare module '@deepseek-ai/dsh-llm'` 声明自己的 source，并给 demo 补了 `pnpm run typecheck`（`install.sh` 里先跑它）。④ 补 typecheck 之后又抓出第三处：`tools/pre-execute` 的监听器必须是 `async`（事件契约的返回类型是 `Promise<PreToolDecision>`），原稿写成了同步箭头函数——esbuild 照样出产物、插件照样加载，只有类型是错的；demo 的 `typescript` 依赖同时提到 `^6.0.3`（与仓库一致），[37-复用ClaudeCode的hooks](37-复用ClaudeCode的hooks.md)正文里贴的片段也一并改成 async。
- **[38-会话格式升级了](38-会话格式升级了.md)有一处对规划的补充**：没有 `dsh doctor` / `dsh migrate` 这类产品入口，真实的迁移入口是检出目录里的一次性脚本 `pnpm run migrate:sessions-to-v4`。另补一条写作时确认的缺口：**公开 API 不暴露磁盘上的存储世代号**（`stat` / `list` 返回的是翻译过的逻辑头，恒为当前写入器版本），所以体检磁盘代际只能用官方的文件名解析器自己扫。
- **`.dsh-column-research/` 里留了八份调研素材**：26 / 29 / 30 / 34 / 35 / 36 / 37 / 38（35 与 38 是本轮补写的，其余是前几轮留下的）。复查某一篇的源码依据可以先看对应编号的素材，但**36 / 37 那两份的行号依据的是当时那棵 `local/deepseek-harness/` 树，快照现已改名为 `local/deepseek-harness-dsh-v0.2.0-rc.2/`**；正文里引用路径一律用带版本后缀的那个。
- **17–25 的 demo 对照**：[17-编写 LLM adapter 接入自有模型](17-编写 LLM adapter 接入自有模型.md)的 `dsh-llm-ollama/`（Ollama adapter）、[18-把插件打包成配置包](18-把插件打包成配置包.md)的 `dsh-team-kit/`（配置包，带 `prepare` 与给同事看的 README）、[19-运行期动态挂载插件](19-运行期动态挂载插件.md)的 `dsh-live-greeter/`（内存插件）+ `dsh-self-cordis/`、[20-DSH 升级后的版本与兼容性排查](20-DSH 升级后的版本与兼容性排查.md)的 `dsh-upgrade-guard/`（内核版本自检 + invariant companion + `doctor.sh`）、[21-文件访问的三层管控](21-文件访问的三层管控.md)的 `dsh-fs-write-watch/`（沙箱三层的只读观察器）、[22-危险操作的审批通道](22-危险操作的审批通道.md)的 `dsh-ask-before-bash/`（`tools/pre-execute` 返回 `ask`）、[23-会话上下文的压缩、裁剪与排水](23-会话上下文的压缩、裁剪与排水.md)的 `dsh-session-digest/`（host-only 投影单元）、[24-会话用量与成本的计量](24-会话用量与成本的计量.md)的 `dsh-turn-cost/`（读内置单元 + 自折失败计数）、[25-插件的状态、密钥与配置存储](25-插件的状态、密钥与配置存储.md)的 `dsh-note-hits/`（storage domain + 凭据引用）。每篇开头的「示例代码」链接指到 GitHub 上的目录。
- **[21-文件访问的三层管控](21-文件访问的三层管控.md)有一处对规划的更正**：沙箱的「fs 观察策略」规划写的是三选一模式，实际是 `dsh-fs-observation-policy` 的「先读后写 + 版本 CAS」，是个 event-only 插件，不是模式开关。
- **[22-危险操作的审批通道](22-危险操作的审批通道.md)有一处对规划的更正**：plan mode 是**软约束**（`docs/subsystems/plan.md` 原话 `Plan mode is soft guidance`），它不禁任何工具，真正的硬边界来自审批与沙箱。另外 `ctx.approval.effectivePolicy` 在源码里是 private，子系统文档与代码不一致，外部插件读有效策略要自己折叠 `overrideOf ?? config.policy ?? 'ask'`。
- **[23-会话上下文的压缩、裁剪与排水](23-会话上下文的压缩、裁剪与排水.md)有两处对规划的更正**：① 全文检索出厂是关的（`session-query-sqlite` 配 `openAt: never`），给模型的 5 个检索工具也不在任何出厂配置里，所以「回查几天前聊过什么」要自己补两处配置；② 「checkpoint」在仓库里指四种不同的东西，正文点名区分，别当成一个词。
- **[24-会话用量与成本的计量](24-会话用量与成本的计量.md)有一处对规划的更正**：规划里的「失败几次」内置没有任何字段——`session-stats` 的八个字段里没有失败计数；失败信号散在 `tool/result` 的 `isError`、`turn/end` 的 `reason`、`llm/retry` 三处，[24-会话用量与成本的计量](24-会话用量与成本的计量.md)的 demo 自己折了一个 `failureCounts` 单元。另外 `time-context` 出厂也不挂载。
- **[18-把插件打包成配置包](18-把插件打包成配置包.md)与 [19-运行期动态挂载插件](19-运行期动态挂载插件.md)的接缝**：`dsh-cordis-host-runner` / `dsh-tool-cordis` 这类扩展包 manifest 里没有 `dsh` 字段，**不是组合包**——`dsh plugin add` 只会给一条 `declares no dsh.bundle` 警告，配置靠 patch 行。[19-运行期动态挂载插件](19-运行期动态挂载插件.md)的 `dsh-self-cordis` 就是把这个「依赖 + 插行」打包成一个组合包。
- 调研素材放在 `.dsh-column-research/`（按规划编号命名，与文件名有偏移：素材 20/21 对应文档 21/22，23/24/25 一致）。17–25 落笔后清过一次，后来写 26–38 时又留了八份（见上面那条）；要复查某条源码依据，先按正文里的路径回快照查。
- **全栏已做过一次文件名重写**：[25-插件的状态、密钥与配置存储](25-插件的状态、密钥与配置存储.md)的 `NN-xxx.md` 从「动词短语」改成了「名词短语」（例如 `14-让别人自己配插件.md` → `14-把插件配置搬进设置页.md`），frontmatter 的 `title` 与各篇之间的「前置 / 下一篇」链接文字同步改过。重写时漏改了一处目标名（`13-用 Skill 固化项目规矩.md` 实际不存在），已在 `12` 篇、`14` 篇与 README 里修正为 `13-用 Skill 固化提示词与规则.md`。以后再加篇目，文件名与标题都按名词短语起。
- **三篇共用一个例子**（[11-为模型注册自定义工具](11-为模型注册自定义工具.md)、[15-把 Host 数据展示到界面](15-把 Host 数据展示到界面.md)、[16-把工具结果渲染成卡片](16-把工具结果渲染成卡片.md)，笔记搜索）：工具名 `note_search`，参数 `{ query, limit? }`，规范值 `{ hits: [{ path, line, snippet }], total }`（`line: 0` 表示文件名命中）；demo 分别是 `dsh_plugin/dsh-note-search/`、`dsh-note-stats/`、`dsh-note-card/`。跨篇契约：[11-为模型注册自定义工具](11-为模型注册自定义工具.md)的工具用 `output.presentationMeta` 把 `{ hits }` 投影进 `tool/result` 的 `meta`，[16-把工具结果渲染成卡片](16-把工具结果渲染成卡片.md)的卡片从 `meta` 读——改一边必须改另一边。
- **[15-把 Host 数据展示到界面](15-把 Host 数据展示到界面.md)有一处对规划的偏差**：外部插件走不通 `ctx.remote` 全链路（Client 侧类型来自仓库内部构建管线，`dsh-api-remotes` 只配置清单内的包），demo 改走 `ctx.connection.fetch.register` 的 `/api` exact 路由；文章把 `ctx.remote` 当「读懂内置插件的正规路」讲、`/api` 路由当「外部插件能走的路」讲。
- **[14-把插件配置搬进设置页](14-把插件配置搬进设置页.md)已改回 0.2.0 代写法**（依据 `local/deepseek-harness-dsh-v0.2.0-rc.2/`）：这篇曾在 10-09 被按一棵**过期源码树**（还停在 0.1.5-rc.2）「改对」过，结果把对的删了——`Schema…volatile()`、`Volatile<T>`、`config.image.get()`、`loader/volatile-update`、`autoGenerate` / `ctx.settings.configure({ auto: false })`、`plugins.row.config`、`dsh-client-ui-plugin-manager` 当时都被判为「查无此物」，而它们在 0.2.0-rc.2 里都在；反过来被换上来的 `ctx.settings.installSection` / `ctx.settingsScope` / `settings.plugin.item` / `$DSH_HOME/settings.yaml` 才是这个版本里不存在的。现在这篇与 demo 都按快照恢复：Host 侧两个字段声明 `.volatile()`、读值走 `.get()`、听 `loader/volatile-update`；浏览器侧注册进 keyed 槽位 `plugins.row.config`，key 是 `<包名>#<行 id>`；表单 namespace 就是这一行在 profile 里的 entry id（不是插件自起的字符串），插件页把表单作为 `form`（`state` + `mutate`）prop 喂给组件；自带页面的插件用 `ctx.settings.configure({ auto: false })` 关掉按 schema 自动生成的页面。教训：那次「改对」的判据是一棵 10-06 克隆、停在 0.1.5-rc.2 的树，而本机当时跑的已是 0.2.0-rc.2——**判据过期会得出「新 API 查无此物」的反向结论**。这也是 README 顶部要写「基准版本」的原因。另外 demo 补了 `pnpm run typecheck`（tsdown 只打包、不求值类型，这条错在安装期不会报），并修掉两个只有类型检查才看得见的错：浏览器半缺 `@deepseek-ai/dsh-client-ui-renderer/client` 的类型引入（`ctx.slots` 的 Context 合并在那里）、schema 常量上多余的 `: Schema<Config>` 标注（volatile 字段的序列化形态与接口里的 `Volatile<T>` 不同，标注与 `default` 签名冲突）。
- **[15-把 Host 数据展示到界面](15-把 Host 数据展示到界面.md)有一处对规划的澄清**：`followup()` / `steer()` 是 host 侧 `Agent` 的方法，浏览器端没有；卡片回送走 `session.prompt(content, 'queue' | 'steer')`，host 侧才映射到这两个动词。
- [09-订阅 DSH 事件与五种分发模式](09-订阅 DSH 事件与五种分发模式.md)的演示代码在 `dsh_plugin/dsh-event-log/`（三个插件：lab 只监听、probe 只派发、stats 监听真实事件并挂计数路由）。它**不写 profile 覆盖层**——插件没有配置项，`install.sh` 不该去覆盖 [08-替换内置能力的提供方与消费者](08-替换内置能力的提供方与消费者.md)留在 `cordis.patch.yml` 里的换源配置。
- patch 篇原本排在 **07**（那版规划里 05 是 config、06 是 HMR），后来提前到 **03**：`patch.yaml` 在 02 就出现了，拖到 07 才解释太晚。原来的 03–06（背景、生命周期、config、HMR）依次后移成 04–07，`service` 仍是 08；文件名、`order` 与所有交叉引用都已同步改过。
- **服务隔离（`ctx.isolate`／`isolate:` realm）从 [08-替换内置能力的提供方与消费者](08-替换内置能力的提供方与消费者.md)移出，暂不写**：那一篇只留三件套、必需／可选依赖、选择失败、服务消失与重现。等写到需要它的时候（一个进程里不同会话／不同组各用一份能力实例）再补，九级表对应行届时同步。
- 改完跑一次：`tool/check-columns.sh "dsh 插件开发学习"`。
