---
flowix_key: q2v7k9dn
title: 20-DSH 升级后的版本与兼容性排查
date: 2026-10-09
tags:
  - ai
  - dsh
column: dsh-plugin
order: 20
viewable: true
---
> **读完这篇你能**：知道升级 `dsh` 之后该从哪三个出口读证据，为什么 `package.json` 里的 `engines.dsh` 拦不住任何东西；分清哪些 API 是设计给插件挂的、哪些是内部面；以及降级为什么会让新会话直接打不开。
>
> **前置**：[运行期动态挂载插件](19-运行期动态挂载插件.md)。约 30 分钟。
>
> **示例代码**：[dsh-upgrade-guard](https://github.com/anthonyzhao-4926/blog/tree/main/code/dsh_plugin/dsh-upgrade-guard)

一句话总纲：**DSH 不在运行时给插件提供任何「你和我版本不匹配」的检查。** 升级之后插件出问题，全部靠三类可观测证据自己发现。

这一条决定了本篇的写法：不是"升级后跑一条自检命令"，而是"升级后从三个出口读证据"。

## 目标

- 弄清版本号、dist-tag 和"能不能装"三件事的关系。
- 知道 `engines.dsh` 的真实效力。
- 会从启动审计、配置 dump、会话格式三条路径读升级证据。
- 分清 API 的稳定面与内部面，知道降级为什么不支持。

## 预览期的版本节奏

仓库根 `README.md` 的第 13 行是全篇的前提，原文加粗：

> DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

`SAFETY.md` 补了一句更硬的："还没经过安全审计，不得当作安全或可用于生产的软件"。而给贡献者的 `AGENTS.md` 里那条规则解释了这套节奏下的义务：**"公共 API 处于预稳定期；更新每一个消费者。"**

预稳定不等于随便改——它意味着改的时候要负责把调用方一起改。但对你这个树外插件作者来说，"调用方"就是你自己。而且上游现在**不接受外部 PR**（`CONTRIBUTING.md` 写明"很抱歉目前无法接受外部 pull request"），所以社区插件只能自己跟版本。

还有一个容易踩的现状：**仓库里没有 CHANGELOG。** 版本级变更记录实际分散在三处——GitHub releases、`.agents/notes/implemented/**` 里的说明文档、以及一份改名台账。想查"这一版改了什么"，得去这几个地方翻。

## 版本号与 dist-tag

全仓两百多个包**共用同一个版本号**。这不是约定俗成，是门禁：一个校验脚本要求每个 `@deepseek-ai/dsh-*` 清单的 `version` 必须等于根版本，不一致就报 `package.json version must match root version`。写版本的唯一入口是一个 release 脚本。

dist-tag 也不是人手维护的，而是**由代码算出来的**：

| 版本形态 | dist-tag |
| --- | --- |
| `…-alpha.N` | `alpha` |
| `…-canary.N` | `canary` |
| 其它预发布（**含 rc**） | `next` |
| 稳定版 | 不传，交给 npm 的默认 `latest` |

设计意图的原文是："dsh 发布把 alpha 和 canary 映射到同名 npm tag，把包括 rc 在内的其它预发布映射到 `next`，稳定版留给 npm 的 `latest` 默认。"

**这里有一个真实的陷阱。** 实测（2026-10-09）多数 dsh 包的 `latest` 指向 `0.0.1-rc.x` 这一档远古预发布，当前线在 `next` / `alpha` 上：

| 包 | `latest` | `next` |
| --- | --- | --- |
| `@deepseek-ai/dsh` | `0.2.0-rc.2` | `0.2.0-rc.2` |
| `@deepseek-ai/dsh-session` | `0.0.1-rc.1` | `0.2.0-rc.2` |
| `@deepseek-ai/dsh-tools` | `0.0.1-rc.1` | `0.2.0-rc.2` |
| `@deepseek-ai/dsh-home-paths` | `0.0.1-rc.3` | `0.2.0-rc.2` |

也就是说：**`pnpm add @deepseek-ai/dsh-tools`（不带版本）拿到的很可能不是内核正在跑的那一份。** 这不违背那套映射规则（预发布确实都发去了 `next`），但说明 `latest` 在这套包里是陷阱。`@deepseek-ai/dsh` 为什么是例外，源码里没找到解释——所以**以 registry 实况为准，别以规则推断为准**。

对插件的直接建议：**外部插件的依赖要显式 pin 版本区间**，不要靠默认 tag。

## engines.dsh 是空声明

你可能会想：在 `package.json` 里写一行 `"engines": { "dsh": "^0.2.0-rc.2" }` 不就行了？

不行。这个字段的类型定义里，注释写得很坦白：

> Runtime requirements; **DSH compatibility is declarative until a reader enforces it**.

实测结论是双重的：全仓对 `engines` 的引用只有两处，都在那个类型定义文件里，**没有任何 reader**；而且全仓**没有任何包**声明过 `engines.dsh`。被真正使用的只有根和几个 native 包的 `engines.node`。

对比一下就清楚了：`engines.node` 由 npm / pnpm 强校验，版本不对直接拒绝安装；`engines.dsh` **连一条警告都没有**。写错既不阻止加载，也不报错。

所以"声明兼容版本"这件事，**必须由你自己的插件来做**——这正是 demo 要演的第一件事。

## 四个诊断出口

### 出口一：启动期的"没激活"审计

生产启动路径上有一个结算函数，它会遍历 Loader 的每一行：禁用的和没有 fiber 的跳过；激活的通过；**失败的**取原始 rejection 并保留堆栈；**挂起的**算出它缺哪些服务，产出诊断。

这就是"插件升级后起不来"最常见的证据形态：不是一句"插件加载失败"，而是**"缺哪个服务"**或者 **"N 个条目没有激活"**。

### 出口二：`--dump-config` 的 stderr

`--dump-config` 用的是**和启动完全同一个 patch 算法**——注释专门写了这点，意思是连 patch 可见性的边角情况都不会漂移。它逐层重放并 diff，给每行记下"由哪个文件提供、被哪些 overlay 改过"，再渲染成带注释的 YAML。

关键在于 **patch 打空只 warn**。算法本体的原话是：

> A patch that matches nothing warns and is skipped.

有五种 warn，最常遇到的是两种：`insert` 的目标 id 不存在、以及覆盖/禁用类 patch 的目标 id 不存在。dump 会把这些 warn 打到 **stderr** 并带上层标签，CLI 参考也把它写成了契约："找不到目标的 patch 会报告到 stderr"。

**所以升级后"我的 patch 没生效但没报错"是设计行为**，唯一证据就是那行 warn。养成习惯：

```bash
dsh --profile test --dump-config 2>&1 >/dev/null | grep 'not found'
```

顺带一个逃生门：`--dump-default-config` 不会去解析你那份坏掉的 patch 文件，所以当 patch 坏到起不来时，它是唯一的出路。

### 出口三：门禁脚本（仓库内）

仓库里有一族 `gen-*` / `verify-*` 脚本，作用是把生成物当快照校验。它们对你改内核有用，但**当"契约快照"读也很有价值**：生成的 API 目录就是"文档化扩展点"的机械定义。

同一族里还有一个 `verify-cordis-config`，它校验 Loader 行的元数据：**只有行的 `config` 和 `disabled` 允许 `!!js` 表达式**，其它元数据字段必须保持静态——理由是留在那里的表达式只是真值数据，却会**静默改变装配**。这条规则解释了一个常见的困惑："为什么我在别处写的表达式不生效"。

### 出口四（弱）：`dsh --version`

`dsh --version` 是**运行时读 CLI 包的 `package.json`**，读不到就回落 `0.0.0`。

就这些。**没有 doctor，没有任何"插件版本与内核不匹配"的检查**——全仓 `grep -i doctor` 只命中一个测试里的变量名。唯一的"版本自检"是**发布期**的：打包后装进隔离目录、跑 `dsh --version`、断言等于本次发布版本。那是给发布者用的，不是给你用的。

所以"升级后怎么自检"这件事，在出厂状态下**是要你自己搭的**。

## 会话格式的方向性

会话日志有自己的格式版本，当前是 **3**。有一条权威文档专门记录它，机制值得完整说一遍，因为它决定了"升级后老会话能不能开"。

**什么时候涨版本**，判据原文是：**"当旧运行时无法再对新日志做完整语义正确的处理时"**才涨——"不报错地解析"不算正确。只有结构变化够这个标准：头形状、事件信封、核心事件语义、表面机制。**加一个普通事件类型不涨版本**，词汇增长由每个事件自己的 `ignorable` 标记来兜。最后一句是操作建议：**"拿不准就涨：近似恒等的升级步骤几乎不花钱，漏涨会让旧运行时静默读错新日志。"**

**旧会话在新版本里怎么处理**，结论是"兼容读 + 相邻迁移，但绝不向后兼容"：

- 迁移是**相邻边**串成的静态链，每个包只负责一步（`v0→v1`、`v1→v2`、`v2→v3` 各一个包）。
- 打开时选**数值最高**的规范 generation，**拒绝未来版本**，否则一次性解码并组合迁移链。
- 读打开用内存结果、**不发布**后继；写打开才编码、校验、**独占**发布最终版本号命名的后继。源文件的路径、字节、inode 都不变。
- 还有一条硬规则：**"更新的或非法的选中 generation 不得回退到前驱"**。

**两个方向的拒绝文案**（这就是你升级后会看到的全部词汇）：

```text
session "<id>" uses log format v<N>, but this harness reads only v<M>:
the log was written by a newer harness — upgrade the harness to open it

session "<id>" uses log format v<N>, older than the supported v<M>,
and this build ships no upgrade path for it
```

再加上第三种情况：**未知事件类型**。如果某个插件贡献了一个新事件、而这份 build 不认识它，除非那个事件带 `ignorable: true`，否则**整条日志都会被拒读**：

```text
session "<id>" contains event type "<type>" (seq N) unknown to this harness
and not marked ignorable; refusing to interpret the log
```

信封契约的解释是："缺省即必需：遇到未识别类型又没有这个标记的读者**必须**拒绝重建会话……默认必需意味着忘记标记会过度拒绝（一点不便），而不是静默地续上一个被掏空的会话。"

**对你写插件的直接后果有两面：**

- 你往 `SessionEventMap` 加新事件**不需要**涨 `SESSION_FORMAT_VERSION`；但别人的旧 build 遇到它会拒读整条日志，除非你写 `ignorable: true`。
- **降级 dsh 会让新版会话彻底打不开**，因为不提供 downgrade。而且预发布也**不算**"数据可丢弃"——权威文档原话是"alpha、beta 或 rc 形态的产品发布确立了已发布的会话格式义务。GitHub 的 prerelease 标记不会让持久化的用户数据变成可丢弃的。"

## 稳定面与内部面

仓库里没有一份叫"API 稳定性契约"的文档，但边界能从三处推出来，而且互相一致。

**规则级**：`AGENTS.md` 写着"公共 API 处于预稳定期；更新每一个消费者"，以及 "**插件，而不是循环改动**：新行为挂在文档化的扩展点上"。

**地图级**：`docs/architecture.md` 里有一张 "Where new behavior goes" 的表，这是**唯一的稳定面清单**。它是一组"目标 → 机制"的对应，比如：

| 想做的事 | 挂在哪 |
| --- | --- |
| 加一个模型提供方 | 在 `ctx.llm` 上注册 adapter |
| 加一个面向模型的能力 | 在 `ctx.tools` 上注册 |
| 加一条人类命令 | 在 `ctx.commands` 上注册 |
| 加持久化的会话状态 | 扩展 `SessionEventMap`，从日志渲染与重放 |

**生成物级**：API 目录被机械保证与源码一致，而且分成两层——harness tier（每个子系统文档的生成区域）和 inherited tier（"每个插件都能看到的框架 `ctx` 成员与事件"）。目录生成器把每个 `ctx.<key>` 映射到唯一一页，且**两侧都 fail-closed**：发现的 key 不在表里就报错，表里有但源码不再发现就报 stale。所以"某个 `ctx.x` 存不存在"是**可以机械核对**的。

**公认的内部面**（不要依赖）：

- `internal/*` 事件（`internal/plugin`、`internal/status`、`internal/service`、`internal/dispatch` 等）。它们是 Cordis 核心的，唯一官方介绍只有一句话摘要加源码指针。仓库内正经消费的只有两类：包不变式和少数基建。
- `vendor/` 全部。文档明说这是"钉住的 vendor 源码"，摘要得极简，好让 harness 那几页专注于仓库自己的词汇。
- `experimental/` 组。
- 未导出、未文档化的类型。因为有一族 `verify-export-jsdoc` 要求每个模块与导出都有 JSDoc，所以"有 JSDoc 的导出"**约等于**公开面。

最后一句必须说清：**这张稳定面清单是"这些地方是设计给插件挂的"，不是"这些地方不会变"。** 而且它是仓库自己的契约——对树外插件是否同样承诺，仓库里没有明确表述，而 `README` 那句加粗的破坏性变更声明反而是反向的。

## 改名留下的死路径

升级后最常见的报错形态不是"方法签名变了"，而是**包名或服务键整个消失**。仓库里有一份改名台账，理由写得很直白：

> 上一个预发布窗口让全仓改名变得便宜。留着弱名字会把偶然的词汇变成兼容契约。

配套规则是"改名的家族只有一个词汇表"：目录、npm 包名、import、Cordis 插件名、`ctx` 键、公开类型、直接耦合的事件或工具标识、配置、测试、夹具、示例、生成的参考、当前文档，全部用新名——而且

> **不保留任何别名、兼容包、重复服务键、双事件名或回退解析器。仓库拒绝旧名字。**

可以直接当升级素材的几条（旧 → 新）：

| 旧 | 新 |
| --- | --- |
| `@deepseek-ai/dsh-paths` | `@deepseek-ai/dsh-home-paths` |
| `@deepseek-ai/dsh-web-fetch-local` | `@deepseek-ai/dsh-web-fetch-http` |
| `@deepseek-ai/dsh-skill-local` | `@deepseek-ai/dsh-skill-filesystem` |
| `@deepseek-ai/dsh-hooks-claude` | `@deepseek-ai/dsh-hooks-claude-code` |
| `@deepseek-ai/dsh-timeout-policy` | `@deepseek-ai/dsh-tool-call-timeout-policy` |
| `@deepseek-ai/dsh-session-export` | `@deepseek-ai/dsh-session-log-export` |
| `ModelService` / `ctx.models` | `ModelDirectoryResolver` / `ctx.modelDirectories` |
| `PlanModeService` | `PlanModeController` |
| `InvariantService` | `InvariantRegistry` |

外部可验证的后果是：**旧名在 registry 上根本不存在**（`E404`），新名存在。所以"升级后 import 报找不到模块"这类错误，正确答案往往是去改名台账里对一下——而不是怀疑自己的环境。

顺带一个同类的坑：生成的 API 目录里**内嵌 `file:line` 源码指针**，所以在一个已记录符号的**上方**插入几行，就会让产物"过期"，报错长得像 snapshot 回归。改内核时遇到"我什么都没改却报 stale"，先想想是不是行号漂了。

## 自检包

demo `dsh-upgrade-guard` 把前面三件事做成了可跑的东西：读内核版本、挂一条 HTTP 报告、注册一条运行期不变式。

第一件是**把空声明变成硬检查**。因为 dsh 没有服务或事件暴露内核版本，只能从"解析到的包清单"推：

```ts
export function readKernelVersion(): { name: string, version: string } | undefined {
    for (const name of ['@deepseek-ai/dsh', '@deepseek-ai/dsh-tools']) {
        try {
            const path = createRequire(import.meta.url).resolve(`${name}/package.json`)
            const manifest = JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown }
            if (typeof manifest.version === 'string') return { name, version: manifest.version }
        } catch {
            // 解析不到就试下一个；两个都试不到由调用方报「未确认」。
        }
    }
    return undefined
}
```

道理是：**插件解析到哪一份 `@deepseek-ai/dsh-*`，就是它接下来要按哪一套 API 说话。** 先试 CLI 包（npm 必定发布它的 `package.json`），再退回本插件一定依赖的 `dsh-tools`。

第二件是**运行期不变式**：

```ts
export function apply(ctx: Context): void {
    ctx.invariants.register('dsh-upgrade-guard', (_ctx, fail) => {
        const kernel = readKernelVersion()
        if (kernel === undefined) {
            fail('无法确认内核版本；插件依赖 @deepseek-ai/dsh-tools/package.json 可解析')
            return
        }
        if (!satisfiesCaret(REQUIRED, kernel.version)) {
            fail(`内核 ${kernel.name}@${kernel.version} 不满足 ${REQUIRED}`)
        }
    })
}
```

这里有个反直觉的事实：**运行期不变式服务默认不在出厂组合里。** 它自己的 README 写着：`dsh-sdk-minimal` 会带上它，而 **`dsh-base` 刻意省略运行期诊断**。装配证据也一致——只有 `sdk-minimal` 的 patch 里有它。

所以自检包得**自己把服务插进来**，`cordis.patch.yml` 三行：

```yaml
- insert:
    - id: upgrade-guard-invariants
      name: '@deepseek-ai/dsh-invariants'
    - id: upgrade-guard
      name: '__PLUGIN_DIR__/lib/index.js'
      config:
        enginesDsh: '^0.2.0-rc.2'
    - id: upgrade-guard-invariant
      name: '__PLUGIN_DIR__/lib/invariant.js'
```

顺序重要：**服务行必须在注册它的行之前**，否则注册方会因为缺服务而挂起（19 篇讲的 `PENDING`）。

最后，`package.json` 里给了正例也留了反例。正例是仓库内的形状——`peerDependencies` 里放内核包，`devDependencies` 里放同 range 的一份：

```json
    "peerDependencies": {
        "@deepseek-ai/cordis": "^4.0.1",
        "@deepseek-ai/dsh-invariants": "^0.2.0-rc.2",
        "@deepseek-ai/dsh-tools": "^0.2.0-rc.2"
    },
```

反例是本专栏早期 demo 用的 `^0.1.7-rc.1`：它在 0.2 线上**永远解析不到内核那一份**。用 `peerDependencies` 的意图就是不要在自己身上再装第二份内核——装了两份，插件挂到的服务可能不是内核那一个。

## 验证

```bash
cd code/dsh_plugin/dsh-upgrade-guard && ./install.sh
```

四步，正好对应四个出口：

```bash
# 出口二：确认 patch 三行都进了组合树，且没有 warn
dsh --profile test --dump-config | grep -A4 upgrade-guard
dsh --profile test --dump-config 2>&1 >/dev/null | grep -c 'not found'   # 期望 0

# 出口四：本机 dsh 版本 vs 插件声明的区间
dsh --version
dsh plugin --profile test why @deepseek-ai/dsh-tools

# 出口一的报告面：起 web，读路由
dsh --profile test web --no-open &
curl -s http://127.0.0.1:3080/api/dsh-upgrade-guard/report
```

`report` 会返回四样东西：插件自己的版本、解析到的内核包与版本、配置里的区间、以及是否满足。这就是"我升级之后到底跑在哪一套 API 上"的答案。

最有价值的一步是**故意破坏**：把 `cordis.patch.yml` 里的 `enginesDsh` 改成 `'>=0.99.0'`，重启。你应当看到启动直接失败，消息形如：

```text
invariant violated by "dsh-upgrade-guard": 内核 @deepseek-ai/dsh-tools@… 不满足 >=0.99.0
```

这条消息的意义不只是"检查生效了"——它证明**这类检查在 DSH 里默认不存在，是你自己装上去的**。

包里还附了一个 `doctor.sh`，把三条出口串成一次输出（版本 / patch 有没有打空 / 插件实际解析到哪份内核）。升级之后第一件事跑它。

## 注意事项

- **`engines.dsh` 拦不住任何东西。** 它没有任何 reader，全仓也没有包声明过它。要拦就自己在插件里判。
- **别用默认 dist-tag 装 dsh 包。** 多数包的 `latest` 还停在 `0.0.1-rc.x`，当前线在 `next`。外部插件的依赖要显式 pin 区间。
- **patch 打空只 warn。** 升级后"配置没生效却没报错"是设计行为；证据只在 `--dump-config` 的 stderr 里。
- **没有 doctor，也没有版本自检。** 唯一的 `--version` 是运行时读 CLI 包的清单。自检要自己搭。
- **升级后先看"缺哪个服务"。** 启动审计的"N 个条目没有激活"通常就是某个服务键被改了名或整个搬走了。
- **降级不支持。** 会话格式有方向：旧 build 读新日志会被明确拒绝，而且预发布形态的数据**不算**可丢弃数据。降级之前先备份会话目录。
- **新事件要带 `ignorable: true`。** 否则别人的旧 build 会因为一个不认识的事件类型拒读**整条日志**——不是跳过那个事件。
- **别依赖 `internal/*` 和 `vendor/`。** 它们是内部面，唯一介绍是一句话摘要加源码指针。
- **稳定面是"设计给插件挂的地方"，不是"不会变的地方"。** 加行为优先挂在文档化的扩展点上；改内核的循环要同步更新 `docs/architecture.md`。
- **遇到"找不到模块"，先查改名台账。** 旧名在 registry 上是 `E404`，仓库刻意不保留任何别名或兼容包。

---

**下一篇**：[文件访问的三层管控](21-文件访问的三层管控.md)——插件能挂上去了，接下来是边界：模型的每一次读写和命令，究竟经过哪几层，哪一层失败会让整个动作停下来。
