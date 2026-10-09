---
flowix_key: h7k2v9pm
title: 26-多 agent 的任务拆解
date: 2026-10-09
tags:
  - ai
  - dsh
column: dsh-plugin
order: 26
viewable: true
---
> **读完这篇你能**：分清「子 agent」和「多 agent 协作」是两件事；知道一个子 agent 提供方要满足什么契约、能力又是怎么被发现和校验的；会先看清手上这台机器到底能接什么活，再决定委派。
>
> **前置**：[插件的状态、密钥与配置存储](25-插件的状态、密钥与配置存储.md)。约 35 分钟。
>
> **示例代码**：[dsh-subagent-survey](https://github.com/anthonyzhao-4926/blog/tree/main/code/dsh_plugin/dsh-subagent-survey)

任务太大，一个上下文装不下；或者有些活纯属跑腿（翻文件、查日志），不该占着主对话的注意力。这两种需求指向的是同一套机制的两个面。

## 目标

- 分清子 agent（一次委派）与多 agent 协作（一个团队）各自的模型。
- 理解「能力」为什么要在请求之前校验，以及两类能力为什么用两种发现方式。
- 会读一个提供方的能力矩阵，据此决定委派与否。

## 子 agent 与多 agent

这两件事经常被混着说，但它们的组成完全不同。

**子 agent** 是一个委派通道：把一件事交给另一个 agent 去做，拿回结果。它的核心问题是「交给谁、能带什么条件去」。

**多 agent 协作**是一套共享状态：几个 agent 一起看同一块任务板、互相发消息。它的核心问题是「谁在做什么、怎么不撞车」。

本篇先讲透前者（它是后者的地基），再看后者。

## 两类能力，两种发现方式

这是这套机制里最值得先记住的一点。

提供方（provider）通过一个**静态描述符**公布它的启动时功能。服务会在单次 run 存在之前就检查一遍——**如果请求依赖了提供方不具备的功能，会被明确拒绝，绝不会"先接受再静默忽略"**。这是那个"失败要响"的规则在子 agent 这条路上的落点。

五个 flag 一一对应启动请求里的可选项：

| flag | 对应请求里的 |
| --- | --- |
| `agentOptions` | Agent 提供方、模型、推理强度、token 覆盖 |
| `outputSchema` | 结构化输出 schema |
| `depthLimit` | 委派深度上限 |
| `toolFilter` | 工具过滤器 |
| `persona` | 人设 |

但**可继续**子 agent 不走这套。它由继续执行管理器自己组合，因此只由**一个可选方法**把关：

```ts
prepareContinuable?(request: ContinuableCreateRequest): Promise<ContinuableCreateSpec>
```

**方法存在即能力。** 服务在提供方没有这个方法时拒绝可继续的启动；有它的提供方仍然可以服务普通的一次性委派。

这个设计值得停一下：为什么不用第六个 flag？

因为可继续子 agent 的**组合归继续执行管理器**，提供方在这件事上唯一的参与就是交出"这个孩子的初始状态要不要带父历史"。给一个只参与这么一点的路径加 flag，等于让描述符去描述它并不拥有的行为——不如让方法的类型本身说话。

## 提供方契约

一个提供方是一个具名的传输层，多个可以共存。它要交出六个成员：

- **`name`**：注册名，比如 `spawn`、`fork`、`acp`。
- **`capabilities`**：上面那五个 flag。
- **`inheritsParentContext`**：子 agent 能不能看到父的**已完成轮次前缀**。
- **`agentRouteDefaults?`**：提供方自有的默认提供方 / 模型路由，可选。
- **`start(request)`**：建立一个**一次性**子 agent，发布之后把句柄交回来。
- **`prepareContinuable?(request)`**：可选，交出可继续子 agent 的创建输入。

关于 `inheritsParentContext`，有一个非常容易读错的地方，它的定义里专门点了出来：

> 它只描述对话种子注入（`fork` 为 true；`spawn` 和 `acp` 为 false），使消费方能生成准确的面向模型的措辞，**而并不暗示继承了工具、服务或权限**。

也就是说这个字段是**给模型看的描述用的**，不是权限声明。子 agent 拿到的是**一个新的扁平作用域**，不是父级注册的副本。

`start()` 的时序契约也值得记：服务已经校验过能力、也解析好了描述符，所以提供方在**返回之前**拥有设置过程，并且要在拒绝之前把自己没发布出去的部分清干净；**发布之后**所有权就转移了，后面无论是轮次失败还是基础设施故障，都通过返回的那个 run 结算。不同的启动可以重叠——取消、失败、结果结算和清理各自独立。

## 委派出去之后

`start()` 用一个已经发布的 run 兑现：

```ts
interface SubagentRun {
  readonly id: SessionId
  readonly localAgent: Agent | undefined
  readonly result: Promise<SubagentResult>
  dispose(): Promise<void>
}
```

三个字段各有讲究：

- **`id`**：对本地 run 来说，**它必须等于发布出去的子会话 id**，那个子会话会用 `parentSession` 记下父会话；远端提供方则铸一个在父命名空间内唯一的 id。
- **`localAgent`**：进程内的那个孩子；远端 run 是 `undefined`。
- **`result`**：**子 agent 自己的失败不会让这个 Promise reject**——模型或传输层失败会以 `stopReason: 'error'` 兑现，让消费者把它映射成一个出错的工具结果。只有这条缝没法表示成停止原因的基础设施故障才会 reject。

最后一条是有意的：让"这次没干成"和"这条通道坏了"在类型上就分得开。前者是业务结果，后者是异常。

事件方面：服务铸一个唯一的 `runId`，观察结果，发 `subagent/start`，然后返回同一个 run。**`start()` 拒绝意味着没发布的资源已经清理、且不会发出生命周期事件对**；发布之后的结果失败会结束已经发出的那对事件。成对的 `subagent/end` 带着同样的标识与最终输出（或基础设施失败）。两个事件都**只用于观察**，而且会隔离各自监听器的异常。

## 任务拆解与协作

当一个任务大到需要**多个** agent 同时在场，就是另一套东西了：一个隐式的 Root Team。它在 `packages/experimental/agent-team/` 下——**实验性**，这一点要先说在前面。

三块共享状态：

**身份与 roster。** `TeamId` 是带独立品牌的 Root 会话 id。每个成员从 `provisioning` 开始，只到达一个终态：`active` 或 `failed`。运行时的 `running` / `idle` / `inactive` 是**另外派生**的，绝不会回写那条记录。

**持久 mailbox。** Lead 会话先存下完整的排队消息，只有目标的待处理收件条目或已记录的用户消息落盘之后，才写一条独立的确认事件——于是"已排队减去已投递"就构成了恢复用的邮箱。

投递方式是固定的，调用方选不了：running 的目标在**最近的步骤边界**收到消息，idle 的目标**起一个轮次**，inactive 的成员则**冷恢复**。正因为调用方不能选，持久记录里干脆不存调度方式。

**共享任务 DAG。** 每条任务事件都存完整快照，`revision` 是 compare-and-set 值、每次变更加一；`blockedBy` 边必须指向未删除的任务并维持无环。状态里 `pending` 表示还没开始或已被释放，`in_progress` 带着 owner，`completed` 满足阻塞关系，`deleted` 是保留的 tombstone。

有一个字段名特别容易误读：**`writeScopes` 是规范化的、提示性的路径前缀，不是锁**。它是给人和模型看"这几件事可能会撞"的警告，不提供任何互斥保证。视图层会补上 owner 名、就绪状态和写作用域重叠警告，但**不会改变持久快照**。

回放靠 `foldTeam()`：把一个 Root 会话折成 roster、任务板和"已排队减去已投递"的邮箱。它按 `TeamId` 挑记录，所以普通 fork 继承来的事件保留祖先 id、**不会进到新 Root 的状态里**。顺序和时间继续由会话事件自己的 `seq` 与 `time` 负责，Team 快照不重复存。

## 侦察当前能力

demo `dsh-subagent-survey` 不长，但它演示的正是本篇最该带走的那件事：**动手之前先看清手上有什么**。

```ts
export function apply(ctx: Context): void {
    ctx.tools.register(defineTool({
        name: 'subagent_survey',
        description: '列出当前所有子 agent 提供方，以及每个提供方支持的启动时能力。',
        parameters: {},
        output: {
            schema: { type: 'string' as const },
            render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
        },
        execute: () => {
            const names = ctx.subagents.list()
            if (names.length === 0) return '当前没有任何子 agent 提供方。'
            return names.map((name) => describeProvider(ctx, name)).join('\n\n')
        },
    }))
}
```

`describeProvider` 里把两类能力**分别用各自的方式**读出来：

```ts
function describeProvider(ctx: Context, name: string): string {
    const provider = ctx.subagents.getProvider(name)
    // list() 与 getProvider() 之间可以被别的 fiber 摘掉，所以这里要兜住。
    if (provider === undefined) return `${name}: 刚刚被移除`

    // capabilities 是五个布尔 flag，一一对应启动请求里的可选项。
    const supported = Object.entries(provider.capabilities)
        .filter(([, enabled]) => enabled)
        .map(([capability]) => capability)

    return [
        name,
        `  启动时能力：${supported.length === 0 ? '（一个都不支持）' : supported.join(', ')}`,
        `  继承父对话前缀：${provider.inheritsParentContext ? '是' : '否'}`,
        `  可继续子 agent：${provider.prepareContinuable === undefined ? '不支持' : '支持'}`,
    ].join('\n')
}
```

注意最后两行：`inheritsParentContext` 是一个普通的布尔读法，而"支持不支持可继续"**是问方法在不在**。这两行并排放在输出里，正好把"两种发现方式"变得可见。

那个 `undefined` 兜底也不是摆设：**摘掉提供方会阻止新的启动，但不会撤销已经接受的 run**，而 `list()` 和 `getProvider()` 之间确实隔着一次调用。

## 验证

```bash
cd code/dsh_plugin/dsh-subagent-survey && ./install.sh
```

三步：

```bash
# 1. 装配对不对
dsh --profile test --dump-config | grep -A3 'id: dsh-subagent-survey'

# 2. 看能力矩阵
dsh --profile test "调 subagent_survey，把结果原样贴给我"

# 3. 把某个提供方停掉，再跑一次
#    在 profile 的 cordis.patch.yml 里给它加 disabled: true，重启
dsh --profile test "再跑一次 subagent_survey"
```

第二步你应当看到几个提供方各一行，能力各不相同——这正是"必须在委派前查"的理由：同一个请求发给不同的提供方，有的接受、有的直接拒。第三步那个提供方从矩阵里消失，而**之前已经跑起来的 run 不受影响**。

## 注意事项

- **`inheritsParentContext` 不是权限声明。** 它只说明子 agent 能不能看到父的已完成轮次前缀，是给模型措辞用的。工具、服务、权限都不在它描述的范围里。
- **子 agent 拿到的是新的扁平作用域。** 它不继承父级的注册，别假设子 agent 能看到父装的东西。
- **能力在请求之前校验。** 依赖了提供方不具备的能力会当场被拒（`UNSUPPORTED_CAPABILITY`），不会静默降级——所以先查再加条件，比先试再兜错更省事。
- **`result` 不因模型失败而 reject。** 子 agent 自己的失败是 `stopReason: 'error'` 的正常兑现；只有基础设施故障才 reject。消费方要分别处理这两条路。
- **摘掉提供方不撤销已接受的 run。** 它只阻止新的启动。要停正在跑的，用 `interrupt`；要按父级整片收，用两个 `drain*` 方法。
- **`start()` 返回之前，清理是提供方的事。** 拒绝时必须把自己没发布的部分收拾干净，否则会留下孤儿资源。
- **agent team 是实验性的。** 它在 `packages/experimental/` 下，契约还会变，别把它当成稳定地基来盖长期的东西。
- **`writeScopes` 不是锁。** 它是提示性的路径前缀，用来提醒"这几件事可能撞车"，不提供互斥。要真正防撞，得自己在任务编排里串行化。

---

**下一篇**：[一批任务的并行编排](27-一批任务的并行编排.md)——一个子 agent 是委派，一批子 agent 就是编排：怎么让它们同时跑、各自的结果怎么收、其中一个失败时别人怎么办。
