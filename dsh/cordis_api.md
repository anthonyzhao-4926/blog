---
title: Cordis API 文档
date: 2026-08-24
tags: [dsh, cordis]
---

# Cordis API 文档

> 基于当前仓库源码整理（`cordis@4.0.0-rc.8`）。  
> **API 尚未稳定，可能不经通知变更。**  
> 论文：[A Programming Paradigm for Spatiotemporal Composability](https://github.com/cordiverse/paper)  
> 入门：[cordis-primer](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-primer)

**Cordis** 是一套面向「时空可组合性」的**元框架**。

- **元框架**：本身不规定「怎么写 HTTP、怎么连数据库」，而是提供一套把功能拼起来的运行时。应用、机器人、工具链都可以建在它上面。
- **时空可组合性**：插件既能按依赖关系在「空间」上组合（谁依赖谁、谁和谁隔离），也能按生命周期在「时间」上组合（何时加载、何时卸载、使生效的逻辑如何回收）。

Cordis 的核心不是 HTTP 路由（按 URL 分发请求），而是下面五个概念。首次出现时的含义：

| 词汇 | 解释 |
| --- | --- |
| **Context（上下文）** | 一次运行里插件拿到的「工作环境」。通过它加载插件、读服务、收发事件。每个插件实例拿到的是带作用域的 Context。 |
| **Plugin（插件）** | 一段可被加载的功能：函数、类，或带 `apply` 方法的对象。加载一次就产生一条 Fiber。 |
| **Service（服务）** | 挂到 Context 上、可供其他插件注入的能力，例如 `ctx.timer`、`ctx.loader`。 |
| **Fiber（纤程）** | 一次插件运行的生命周期单元，经历加载、激活、卸载、失败等状态。 |
| **Event（事件）** | 插件之间的消息通道。用 `on` 监听、用 `emit` 等派发。 |

本文档按公开 npm 包梳理**可编程 API**（给 TypeScript / JavaScript 调用的接口），不是 HTTP REST 文档。


---

## 包一览

**包**：独立发布的 npm 模块，可单独安装。本仓库是 monorepo（一个 git 仓库里放多个包）。

| 包名 | 角色 |
| --- | --- |
| `cordis` | 核心运行时：Context、插件、服务、事件、Fiber、日志。 |
| `@cordisjs/plugin-loader` | **Loader（加载器）**：按配置树（一份嵌套的插件清单）加载插件，管理 **Entry（配置条目）** 和 **Group（分组）**。 |
| `@cordisjs/plugin-include` | 从 YAML / JSON 配置文件读出插件树并挂到 Loader 上。YAML / JSON 是两种常见的文本配置格式。 |
| `@cordisjs/plugin-group` | 配置树里的分组插件，用来把多条 Entry 收成一组。实现上是对 loader 里 `Group` 的再导出。 |
| `@cordisjs/plugin-timer` | 定时器服务。提供延时、间隔，以及**节流**（限制执行频率）和**防抖**（停止触发后再执行）。定时器随 Fiber 卸载自动清掉。 |
| `@cordisjs/plugin-hmr` | **HMR（Hot Module Replacement，热更新）**：文件改了只重载受影响的插件，尽量不重启整个进程。依赖 Node 内部的模块加载器。 |
| `@cordisjs/plugin-logger-console` | **Exporter（导出器）** 的一种：把框架里的日志记录打印到终端 / 浏览器控制台。 |
| `@cordisjs/utils` | 未对外发布的私有工具包，目前提供随 Context 回收的 `List`。 |
| `create-cordis` | **脚手架 CLI**：命令行工具，用来从模板生成新项目。CLI 即 Command Line Interface（命令行界面）。 |

---

## 核心概念

除开篇五个词外，阅读 API 时还会反复遇到这些：

| 词汇 | 解释 |
| --- | --- |
| **Effect（使生效）** | 动词：使一段逻辑在 Fiber 生命期内生效，例如监听事件、开端口、设定时器。Fiber 卸载时按相反顺序 **dispose（释放）**。不是纯函数语境里的「副作用」。 |
| **dispose / disposer** | 释放函数。调用后撤销已使生效的逻辑（取消监听、关定时器等）。 |
| **Inject（注入）** | 声明「我依赖哪些服务」。依赖还没就绪时，这条 Fiber 停在 `PENDING`（等待），不会执行插件体。 |
| **Isolate（隔离）** | 把某个服务名切到独立命名空间。两个隔离域里可以各有一个叫 `db` 的服务，互不可见。 |
| **Intercept（拦截配置）** | 向下游 Context 叠一层服务配置，不改插件代码也能改行为（例如换日志名、调日志级别）。 |
| **extend** | 以当前 Context 为原型再派生一个「影子」Context，可附加自己的属性。isolate / intercept 都建立在它上面。 |
| **Registry（注册表）** | 记录「哪个插件函数正在跑、对应哪些 Fiber」。 |
| **Reflect（反射）** | 负责服务的提供、查找、属性混入。读 `ctx.foo` 时实际走这里。 |
| **mixin（混入）** | 把某个服务上的方法提升到 Context 上，于是可以写 `ctx.plugin()` 而不必写 `ctx.registry.plugin()`。 |

最小示例：先提供一个计数服务，再注入它并打日志。

```ts
import { Context, Service } from 'cordis'

class Counter extends Service {
  value = 0
  constructor(ctx: Context) {
    super(ctx, 'counter')
  }
  increase() {
    this.value += 1
  }
}

const root = new Context()

await root.plugin(Counter)

await root.inject(['counter'], (ctx) => {
  ctx.counter.increase()
  ctx.logger.info('value = %d', ctx.counter.value)
})
```

---

## `cordis` 核心

安装包名就是 `cordis`。

```ts
import {
  Context,
  Service,
  Inject,
  Fiber,
  FiberState,
  Logger,
  LoggerLevel,
  CordisError,
  ValidationError,
} from 'cordis'
```

- **`FiberState`**：Fiber 的状态枚举（等待、加载中、已激活等），见 [Fiber 与 Effect](#fiber-与-effect)。
- **`Logger` / `LoggerLevel`**：日志对象和级别（error / warn / info / debug）。
- **`CordisError`**：框架自己的错误类型，目前主要用于「在已停用的 Context 上使新逻辑生效」。
- **`ValidationError`**：插件配置没通过 schema 校验时抛出的错误。**schema** 是「配置长什么样」的描述。

---

### Context

```ts
const ctx = new Context()
```

构造时会创建 **root Fiber**（根纤程，`uid` 为 `0`，一开始就是激活态），并挂上四个内置服务：`events`、`logger`、`reflect`、`registry`。

实例本身是 **Proxy**（ES 代理对象：读写属性时可以插入自定义逻辑）。因此 `ctx.foo` 不会只是普通字段，而会走 Reflect 去解析对应服务。

#### 静态成员

**symbol** 是 JavaScript 的唯一键，用来在对象上挂框架内部数据，避免和用户字段撞名。

| 成员 | 说明 |
| --- | --- |
| `Context.is(value)` | 判断值是不是 Context。 |
| `Context.effect` | 给 disposer 挂「使生效」元数据（标签、子节点）用的 symbol。 |
| `Context.filter` | 事件过滤 symbol。带这个方法的 `thisArg` 可以决定哪些监听能收到事件。 |
| `Context.isolate` | 隔离表 symbol，存「服务名 → 隔离域」。 |
| `Context.intercept` | 拦截配置表 symbol，存「服务名 → 叠加配置」。 |

#### 实例属性

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `root` | `this` | 根 Context，一般是 `new Context()` 得到的那个。 |
| `baseUrl` | `string \| undefined` | 解析相对模块路径时的基准 URL。Loader / Include 会写入，例如当前工作目录的 `file:` 地址。 |
| `fiber` | `Fiber` | 当前这条 Fiber。 |
| `events` | `EventsService` | 事件服务。 |
| `logger` | `LoggerService` | 日志服务。 |
| `reflect` | `ReflectService` | 属性 / 服务反射。 |
| `registry` | `RegistryService` | 插件注册表。 |

下列方法通过 mixin 直接挂在 Context 上，写起来和访问对应服务等价：

- 来自 `registry`：`plugin`（加载插件）、`inject`（按依赖加载一段回调）
- 来自 `fiber`：`effect`（使一段逻辑生效）
- 来自 `events`：`on`、`once`、`emit`、`parallel`、`serial`、`bail`、`waterfall`（见 [事件](#事件-events)）
- 来自 `reflect`：`get`、`set`、`provide`、`accessor`、`mixin`

#### `ctx.extend(meta?)`

以当前 Context 为原型创建一个**影子 Context**：外表像新对象，读不到的属性会落到原来的 Context 上。可把 `meta` 里的自有属性贴上去。isolate / intercept 都用它实现「同一棵树上分出不同视角」。

```ts
const child = ctx.extend({ foo: 1 })
```

#### `ctx.isolate(name, label?)`

把服务名 `name` 切到独立**隔离域**（同一服务名的另一套存储）。

- 不传 `label`：每次调用生成新的本地隔离，互不共享。
- 传入同一个 **`symbol` 标签**：多个 Context 共用这一域。

```ts
const ctx1 = root.isolate('foo')
const ctx2 = root.isolate('foo')          // 与 ctx1 不同域
const shared = Symbol('shared')
const a = root.isolate('foo', shared)
const b = root.isolate('foo', shared)    // a / b 同域
```

#### `ctx.intercept(name, config)`

向下游叠加一层名为 `name` 的拦截配置。下游服务可通过 `Service[Service.resolveConfig]()` 把祖先到当前的配置合并起来。

```ts
const child = ctx.intercept('logger', { name: 'my-plugin', level: 3 })
child.logger.debug('only visible under this intercept')
```

---

### 插件 Plugin

插件有三种形态，均可带**静态元数据**（写在函数 / 类 / 对象上的字段，加载器读取它们，而不是运行时才算）：

```ts
interface Plugin.Base<T> {
  name?: string
  Config?: StandardSchemaV1<any, T>   // 见下方「配置校验」
  inject?: Inject
  provide?: string | string[]
  intercept?: Dict<boolean>
}
```

**`Dict`**：键为字符串的普通对象，来自依赖库 `cosmokit`。

#### 1. 函数插件

```ts
function foo(ctx: Context, config: { bar?: string }) {
  ctx.on('ready', () => {})
  return () => {
    // 返回值是 disposer：Fiber 卸载时调用
  }
}

await ctx.plugin(foo, { bar: 'baz' })
```

#### 2. 对象插件

必须有 `apply(ctx, config)`。加载器实际执行的是这个方法。

```ts
const plugin = {
  name: 'foo',
  inject: ['timer'],
  apply(ctx: Context, config: any) {
    ctx.timer.timeout(() => {}, 1000)
  },
}

await ctx.plugin(plugin)
```

#### 3. 类插件

用 `new` 构造。若实现了 `[Service.init]`，构造完成后会把返回值当成 Effect 执行。Effect 可以是 disposer、异步 disposer，或产生多个 disposer 的迭代器。

```ts
class Foo {
  static inject = ['logger']
  constructor(ctx: Context, config: { n: number }) {
    ctx.logger.info('n = %d', config.n)
  }
}

await ctx.plugin(Foo, { n: 1 })
```

#### 配置校验

`plugin.Config` 需符合 [Standard Schema](https://github.com/standard-schema/standard-schema)（一套让 Zod / Valibot / ArkType 等校验库能被统一调用的接口）。Cordis **只支持同步**校验。

- 校验失败：抛 `ValidationError`，消息里带 issue path（出错字段路径）。
- schema 返回 Promise：抛 `TypeError('Async config validation is not supported')`。

`ctx.plugin()` 的返回值是 **thenable Fiber**。**thenable** 指实现了 `.then()`、因而可以被 `await` 的对象。这里 `await fiber` 会等到 Fiber 进入 `ACTIVE`（已激活）；失败则抛出插件体里的错误。

```ts
const fiber = ctx.plugin(Foo, config)
await fiber          // 等到 ACTIVE，失败则抛出
await fiber.dispose()
```

无效插件（不是函数，也没有 `apply` 方法）会抛：

```text
invalid plugin, expect function or object with an "apply" method
```

**停用的 Context**：所属 Fiber 已经 dispose，不能再使新逻辑生效。此时再调用 `plugin` / `effect` / `on` 会抛 `CordisError('INACTIVE_EFFECT')`。

---

### Registry

`ctx.registry` 管理「**插件运行时（Runtime）** → 多条 Fiber」。同一个插件函数可以加载多次（不同配置、不同父 Context），它们共享一条 Runtime，各自是一条 Fiber。

| 方法 | 说明 |
| --- | --- |
| `plugin(plugin, config?)` | 加载插件，返回 thenable Fiber。 |
| `inject(deps, callback)` | 等价于 `plugin({ inject, apply: callback })`：先等依赖，再跑这段函数。 |
| `resolve(plugin)` | 解析出作为 Map 键的函数：插件本身是函数就用它，否则用 `plugin.apply`。 |
| `get(plugin)` | 取这条插件的 `Plugin.Runtime`。 |
| `has(plugin)` | 是否已注册。 |
| `delete(plugin)` | 注销，并 dispose 其下全部 Fiber。 |
| `keys()` / `values()` / `entries()` / `forEach()` | 遍历运行时。 |
| `size` | 已注册插件数。 |
| `counter` | 递增分配 Fiber 的 **uid**（实例编号）。 |

```ts
ctx.registry.get(Foo)      // Plugin.Runtime | undefined
ctx.registry.delete(Foo)   // 卸载该插件的所有实例
```

`Plugin.Runtime`：

```ts
interface Plugin.Runtime {
  name?: string
  fibers: DisposableList<Fiber>   // 可按插入序遍历、按值删除的列表
  callback: Function              // 真正执行的函数（函数插件本身或 apply）
  Config?: StandardSchemaV1
}
```

**`DisposableList`**：核心里的通用列表。`push` 返回删除函数；`clear` 按相反顺序取出元素，方便做 dispose。

---

### Service 与依赖注入

**依赖注入**：插件不自己 `new` 依赖，而是声明「我需要 `foo`」，由运行时在 `foo` 就绪后再启动它。

```ts
abstract class Service<T = never> {
  constructor(ctx: Context, name: string)
}
```

`T` 是该服务可被 intercept 的配置类型。构造时会 `ctx.reflect.provide(name, this)`，把实例挂到 Context，之后别人就能 `inject(['该名字'])`。

#### 静态 symbol

| Symbol | 用途 |
| --- | --- |
| `Service.init` | 构造后执行的初始化 Effect。 |
| `Service.check` | 可用性检查。返回 `false` 时，依赖方当作「这个服务还不存在」。 |
| `Service.config` | 标记「我有 intercept 配置」，并带上配置类型 `T`。 |
| `Service.invoke` | 让服务实例可以当函数调用，例如 `ctx.logger()` 再返回一个具名 Logger。 |
| `Service.extend` | 扩展影子实例（配合 Context 的追踪代理）。 |
| `Service.tracker` | **Tracker（追踪器）**：记录这个对象和哪个服务名、哪个 `ctx` 字段关联，便于跨 Context 访问时改写 `this.ctx`。 |
| `Service.resolveConfig` | 把 intercept 链上的配置合并成一份。 |

```ts
class Http extends Service<{ timeout?: number }> {
  static inject = ['timer']

  constructor(ctx: Context) {
    super(ctx, 'http')
  }

  async [Service.init]() {
    // 可返回 disposer
    return () => {}
  }

  get timeout() {
    return this[Service.resolveConfig]().timeout ?? 3000
  }
}
```

#### Inject

```ts
type Inject = string[] | Record<string, any>

// 1. 数组：只声明依赖名
ctx.inject(['foo', 'bar'], (ctx) => { ... })

// 2. 对象：依赖名 + 对该服务的 intercept 配置
ctx.inject({ logger: { name: 'worker' } }, (ctx) => { ... })

// 3. 装饰器：编译期标在 class 或方法上的语法（TypeScript 5+）
@Inject('foo')
class Bar extends Service {
  constructor(ctx: Context) {
    super(ctx, 'bar')
  }

  @Inject('foo')
  onFooReady() {
    // foo 就绪后执行；返回值作为 effect disposer
    return () => {}
  }
}
```

**装饰器 `@Inject()`** 只能用在 class 或 class method 上。方法级注入会在 `[Service.init]` 阶段通过 `ctx.inject` 挂上；服务消失时自动 dispose。

依赖未就绪时，对应 Fiber 为 `PENDING`，不会执行插件体。依赖恢复后自动刷新（内部 `_refresh`）再加载。

---

### Reflect

服务查找、提供、属性混入都走 `ctx.reflect`。下列方法也 mixin 到 Context。

#### `ctx.provide(name, value?, check?)`

在当前 Fiber 上**注册服务**（把一个值放到名为 `name` 的槽里）。同一隔离域里同名服务不可重复注册。返回 disposer，调用后撤销该服务。

```ts
const dispose = ctx.provide('foo', { bar: 1 })
ctx.foo.bar  // 1
dispose()
```

可选 `check()`：返回 `false` 时，依赖该服务的 Fiber 会视为依赖未满足。

#### `ctx.get(name, strict?)` / `ctx.set(name, value)`

- **`get`**：按当前 isolate 查找实现。`strict` 默认 `true`，意思是「提供方 Fiber 必须是 `ACTIVE` 才看得到」。
- **`set`**：改已经 provide 过的值；只能由当初提供该服务的同一个 Fiber 设置。

未 inject 就读服务、未 provide 就写服务会抛错：

```text
cannot get property "foo" without inject
cannot set property "foo" without provide
```

#### `ctx.accessor(name, { get, set? })`

声明**计算属性**（每次读写都走自定义 get / set），而不是存一份服务实例。mixin 内部就是用 accessor 实现的。

#### `ctx.mixin(source, mixins)`

把某个对象或服务上的方法提升到 Context。框架启动时就用它把 `plugin`、`on`、`effect` 摊平到 `ctx`。

```ts
ctx.mixin('timer', ['timeout', 'interval', 'debounce'])
// 之后可直接 ctx.timeout(...)
```

`mixins` 可以是字符串数组（同名提升），或 `{ 源键: 目标键 }` 映射（改名提升）。

#### 其他

| 方法 | 说明 |
| --- | --- |
| `reflect.trace(value)` | 按当前 Context 生成**可追踪代理**：访问带 Tracker 的对象时，自动换成「站在当前 ctx 视角」的版本。 |
| `reflect.bind(fn)` | 包装函数，调用时 `this` 和参数都会先 `trace` 一遍。事件监听默认会 bind。 |
| `reflect.notify(names, filter?)` | 通知依赖这些服务名的 Fiber 重新检查依赖并刷新。 |

---

### 事件 Events

通过 TypeScript 的 **`declare module`（模块扩充）** 把事件名合并进核心的 `Events` 接口，这样 `ctx.on('message', ...)` 才能得到参数类型：

```ts
declare module 'cordis' {
  interface Events {
    'app/ready'(): void
    'message'(text: string): void
    'check'(value: number): boolean | void
  }
}
```

#### 监听

```ts
const dispose = ctx.on('message', (text) => {
  ctx.logger.info(text)
})

ctx.once('app/ready', () => {})  // 只触发一次，然后自动摘掉
dispose()
```

`options`：

```ts
interface EventOptions {
  prepend?: boolean   // 插到监听队列头部，先于已有监听执行；也可把整个 options 直接传 true
  global?: boolean    // 忽略 Context.filter，所有监听都收到
}
```

```ts
ctx.on('message', handler, true)                 // prepend
ctx.on('internal/update', handler, { global: true, prepend: true })
```

#### 派发模式

同一批监听，按不同策略执行：

| 方法 | 同步 | 语义 |
| --- | --- | --- |
| `ctx.emit(name, ...args)` | 同步 | 全部执行，互不等待。某个监听抛错会中断后续。 |
| `ctx.parallel(name, ...args)` | 异步 | 用 `Promise.allSettled`（等全部结束，失败不互相取消）。有拒绝则抛 **`AggregateError`**（把多个错误收在 `.errors` 里）。 |
| `ctx.serial(name, ...args)` | 异步 | 按顺序 `await`。监听返回 **bailed** 值则短路并返回该值。 |
| `ctx.bail(name, ...args)` | 同步 | 与 serial 相同，但不 `await`。 |
| `ctx.waterfall(name, ...args, inner)` | 同步 | **洋葱模型**：每个监听收到 `next`，可先处理后调用 `next()`，也可直接返回从而跳过后面的监听。没人接手时落到最后一个参数 `inner`。 |

**bailed（已拦截）**：返回值不是 `null` / `false` / `undefined`，就认为「这件事处理完了」。`isBailed(value)` 即此判断。

**`thisArg`**：派发时可选的第一个对象参数，会作为监听函数的 `this`，并参与 `Context.filter` 过滤（例如「只有同一隔离域的监听能收到」）。

```ts
ctx.emit(session, 'message', text)
ctx.parallel(session, 'message', text)
```

waterfall 示例：两个监听都做 `value + next()`，内层返回 `2`，外层再加，得到 `1+1+2 = 4`。

```ts
ctx.on('transform', (value, next) => value + next())
ctx.on('transform', (value, next) => value + next())
ctx.waterfall('transform', 1, () => 2)  // 4
```

---

### Fiber 与 Effect

`Fiber` 是一次插件运行。root Context 自带 `uid === 0` 且状态为 `ACTIVE` 的 Fiber。

**Effect** 在本文译为动词**使生效**：调用 `ctx.effect()` 即使一段逻辑随 Fiber 生效，并在卸载时回收。这和「副作用 / side effect」（函数是否改了外部状态）不是一回事。`ctx.effect()`、插件返回值、`Service.init` 的返回值，都会被收进当前 Fiber 的使生效表。

#### 状态

```ts
enum FiberState {
  PENDING,     // 依赖未就绪，插件体还没跑
  LOADING,     // 正在执行插件体 / 初始化 Effect
  ACTIVE,      // 已激活，可对外提供服务
  FAILED,      // 执行出错
  DISPOSED,    // 已销毁（uid 被置空）
  UNLOADING,   // 正在按相反顺序回收 effect
}
```

#### 公开字段 / 方法

| 成员 | 说明 |
| --- | --- |
| `uid` | 实例编号；dispose 后为 `null`。root 为 `0`。 |
| `ctx` | 该 Fiber 的 Context。 |
| `config` | 经过 schema 校验后的配置。 |
| `state` | 当前 `FiberState`。 |
| `runtime` | 所属 `Plugin.Runtime`。 |
| `inject` | 解析后的依赖表（服务名 → intercept 配置或 `null`）。 |
| `dispose()` | 卸载。插件 Fiber 返回 `Promise<void>`。 |
| `await()` | 等到 **`inertia`（惯性异步）** 结束。inertia 是加载 / 卸载尚未收尾时挂着的那条 Promise；若失败则抛出。 |
| `restart()` | 先卸再装。 |
| `update(config, noSave?)` | 校验配置后走 `internal/update` waterfall，再 restart。`noSave` 为 true 时，Loader 不会把配置写回文件。 |
| `effect(fn, label?)` | 使一段逻辑生效。`label` 只用于调试时展示。 |
| `getEffects()` | 当前 effect 的元数据树（标签 + 子节点）。 |
| `name` | 运行时名称；没有则沿父链回退，直到 `'root'`。 |
| `assertActive()` | 已 dispose 则抛 `CordisError`。 |

#### Effect

```ts
type Disposable<T = any> = () => T

type Effect =
  | Disposable
  | Iterable<Disposable>          // 例如 function* 生成器，可 yield 多个 disposer
  | Promise<Disposable>
  | AsyncIterable<Disposable>     // 异步生成器
```

```ts
const dispose = ctx.effect(() => {
  const server = listen()
  return () => server.close()
}, 'listen()')

// 生成器：多个 disposer，卸载时逆序执行
ctx.effect(function* () {
  yield () => step1()
  yield () => step2()
})

// 异步
await ctx.effect(async () => {
  const res = await open()
  return () => res.close()
})
```

`effect()` 返回的 disposer 自身也是 thenable：`await` 它得到的是「异步 dispose 函数」。插件体和 `Service.init` 的返回值同样按 Effect 收集。

`fiber.update()` 会触发：

```ts
ctx.waterfall(fiber, 'internal/update', config, noSave, next)
```

监听者可改写配置，或选择不调用 `next` 从而短路。Loader 用这条链把配置写回文件。

---

### 隔离 isolate 与拦截 intercept

#### isolate

服务在存储里的真正键不是字符串 `'db'`，而是 `ctx[Context.isolate]['db']` 这个 symbol。不同隔离域拿到不同 symbol，因此同名服务互不可见。

```ts
const isolated = root.isolate('db')
isolated.provide('db', localDb)   // 不影响 root.db
```

Service 默认带 filter：只有 isolate 标签相同的 Context，才能收到「以该服务为 `thisArg`」发出的事件。

#### intercept

`ctx.intercept(name, config)` 把配置挂到 **原型链**（对象找不到自有属性就往父对象找）上。`Service[Service.resolveConfig](base?, head?)` 从祖先走到当前，收集同名配置后用 `Object.assign` 合并；若服务的 `Config` 带 `merge` 方法，则走自定义合并。

Loader 自身也声明了 intercept：

```ts
interface Loader.Intercept {
  await?: boolean   // 为 true 时：只要还有插件没加载完，Loader 的 check 就失败，依赖它的 Fiber 继续等
}
```

---

### Logger

`ctx.logger` 是**可调用服务**（因为实现了 `Service.invoke`）：直接 `.info()` 用当前 Fiber 的默认名字；`ctx.logger('http')` 则得到一个名为 `http` 的 Logger。

```ts
ctx.logger.info('hello %s', 'world')
ctx.logger('http').error(err)
ctx.logger.warn('deprecated')
ctx.logger.debug('verbose')
```

级别数字越大越啰嗦：

```ts
enum LoggerLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}
```

默认级别为 `INFO`。可用 intercept 覆盖。未指定 `name` 时，用当前 Fiber 名称做 **hyphenate**（把 `CamelCase` / 空格变成 `camel-case` 这种短横线形式）。

```ts
ctx.intercept('logger', { name: 'worker', level: LoggerLevel.DEBUG })
```

#### Exporter

**Exporter** 是日志的出口：每条日志会送给所有已注册的导出器，由它们决定打印、落盘还是丢掉。

```ts
interface Exporter {
  colors?: number | false
  maxLength?: number
  levels?: Record<string, number>   // 可含 default，按 logger 名覆盖级别
  formatters?: Record<string, Formatter>  // %x 占位符怎么把值收成字符串
  export(message: Message): void
}

const dispose = ctx.logger.exporter({
  levels: { default: LoggerLevel.DEBUG },
  export(message) {
    // message: { sn, ts, name, type, level, args, fiber? }
    // sn = 序号, ts = 时间戳
  },
})
```

内置一个 **ring buffer（环形缓冲区）**：只保留最近 `bufferSize`（默认 1000）条，超出就丢掉最旧的。默认格式化占位符：`%s` 字符串、`%d` / `%i` 整数、`%f` 数字、`%o` / `%O` JSON、`%c` 空、`%C` 带颜色的名字。

`Logger.format(exporter, message)` / `Logger.color` / `Logger.code` 可用于自定义渲染。

---

### 内部事件

框架自己发出的事件。一般不必手动订阅，除非在写 Loader、HMR 这类**基础设施插件**（给别的插件提供运行环境，而不是业务功能）。

| 事件 | 参数 | 时机 |
| --- | --- | --- |
| `internal/plugin` | `(fiber)` | Fiber 创建或销毁（`uid` 被置空）。 |
| `internal/status` | `(fiber, oldState)` | Fiber 状态变化。 |
| `internal/service` | `(name, value)` | 服务提供 / 撤销后通知。带 isolate filter。 |
| `internal/update` | `(config, noSave, next)` | `fiber.update()` 的 waterfall。 |
| `internal/listener` | `(name, listener, options)` | `ctx.on()` 注册前。若 bail 得到返回值，就用它代替默认注册。 |
| `internal/dispatch` | `(mode, name, args, thisArg)` | 名称不以 `internal/` 开头的事件派发前。`mode` 是 emit / parallel 等。 |
| `internal/get` | `(ctx, name, error, next)` | 读取尚未声明的属性时的 waterfall。 |
| `internal/set` | `(ctx, name, value, error, next)` | 写入服务属性时的 waterfall。 |

---

## `@cordisjs/plugin-loader`

**Loader** 按**配置树**加载插件。配置树是一份可嵌套的清单：每项是一个插件，分组节点的 `config` 又是子清单。

`cordis` 的 CLI 会先挂上 Loader，再创建 Include 入口（去读 `cordis.yml`）。

```ts
import Loader from '@cordisjs/plugin-loader'

const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'
await ctx.plugin(Loader, { baseUrl?: string })
```

挂载后 Context 上出现 `ctx.loader`。

### Loader

继承 **`EntryTree`（条目树）**：内存里的整棵配置，负责 id 解析、增删改、递归等待加载完成。

| 成员 | 说明 |
| --- | --- |
| `config.baseUrl` | 写入 `ctx.baseUrl`，作为相对路径 import 的起点。 |
| `envData` | 来自环境变量 `process.env.CORDIS_SHARED` 的 JSON；没有则默认 `{ startTime }`。用于多进程共享启动信息。 |
| `internal` | Node 的内部 **ESM ModuleLoader**（ES 模块加载器）。要访问它，进程需加 `--expose-internals`，或安装可选依赖 `node-addon-require-builtin`。HMR 依赖这个。 |
| `builtins` | **伪协议** `cordis:<name>` 对应的内置模块表。`import` 遇到此前缀就不走文件系统，而从这张表取。 |
| `locate(fiber?)` | 沿父链找到所属 Loader Entry 的 id。 |
| `unwrapExports(exports)` | 解开 `default` / `__esModule` 互操作。打包器和 Node 对「默认导出」的包法不一致，这里统一取出真正的插件。 |
| `showLog(entry, type)` | 打印 apply / reload / unload 一类加载日志。 |
| `exit()` | 默认空实现（**no-op**：调用了但什么也不做）。HMR 发现框架自身文件被改时会调它，宿主可以改写成退出进程。 |
| `write()` | 根 Loader 是 no-op；Include 会覆盖为「写回配置文件」。 |

`Service.check`：若 intercept 了 `{ await: true }`，且树上还有没跑完的加载任务，Loader 视为未就绪。

### EntryOptions

配置树中的一条插件记录：

```ts
interface EntryOptions {
  id: string
  name: string
  config?: any
  group?: boolean | null
  disabled?: boolean | null
  inject?: Inject | null
  intercept?: Dict | null
  isolate?: Dict<true | string> | null
}
```

- **`name`**：**模块说明符**，即 `import` 能理解的名字：npm 包名、相对路径，或 `cordis:<builtin>`。
- **`group: true`**：该节点是分组，`config` 为子 `EntryOptions[]`。分组自己不会因为 `disabled` 停掉，但 `disabled` 会传给子孙。
- **`isolate[name] = true`**：该 Entry 的本地隔离域，后缀形如 `#<entryId>`。
- **`isolate[name] = 'label'`**：全局命名隔离域，后缀形如 `@label`，同名 label 共享。
- **`config`**：传给插件的配置。在 YAML 里可用 `!!js` 表达式，见 [表达式插值](#表达式插值)。

### EntryTree

| 方法 | 说明 |
| --- | --- |
| `entries()` | 递归遍历全部 Entry（含子树）。 |
| `getTasks()` | 尚未完成的 init 任务或 Fiber inertia。 |
| `await()` | 等到任务清空。 |
| `ensureId(options)` | 没有 id 则生成 8 位 **hex**（十六进制随机串）。 |
| `resolve(id)` | 用 `父:子` 形式解析跨树 Entry。分隔符是 `:`。 |
| `resolveGroup(id \| null)` | `null` 表示根组。 |
| `create(options, parent?, position?)` | 插入一条并 `write()`。 |
| `remove(id)` | 删除并 `write()`。 |
| `update(id, options, parent?, position?)` | 更新字段，或改父节点 / 位置。 |
| `import(name, getOuterStack?)` | 加载模块。`getOuterStack` 用于把报错堆栈接到配置文件的位置。 |

```ts
const id = await ctx.loader.create({
  name: '@cordisjs/plugin-timer',
})

await ctx.loader.update(id, { disabled: true })
ctx.loader.remove(id)
await ctx.loader.await()
```

### Entry / EntryGroup

**`Entry`**：配置里的一行，对应一次（或待执行的）插件加载，持有 `fiber`。主要方法：

- `update`：改 options，必要时重启 Fiber
- `refresh`：若尚未创建 Fiber 且未 disabled，则 `init`
- `init`：import 模块并 `registry.plugin`
- `evaluate`：在该 Entry 的 Context 上求值一段 JS 表达式

**`EntryGroup`**：一组 Entry 的容器（根树或某个 `group: true` 节点）。

| 方法 | 说明 |
| --- | --- |
| `create(options)` | 创建或复用 Entry 并 update。 |
| `remove(id)` | dispose Fiber 并从 store 删除。 |
| `update(config[])` | 按 id 做 **diff**（新旧清单对比）：有则更新、无则删除、多则新增。 |
| `stop()` | 停掉组内全部 entry。 |

### Loader 事件

```ts
interface Events {
  'exit'(signal: NodeJS.Signals): Promise<void>
  'loader/config-update'(): void
  'loader/entry-init'(entry: Entry): void
  'loader/partial-dispose'(entry: Entry, legacy: Partial<EntryOptions>, active: boolean): void
  'loader/patch-context'(entry: Entry, next: () => void): void
}
```

- **`loader/entry-init`**：刚 new 出 Entry、尚未加载模块。
- **`loader/patch-context`**：更新隔离 / 拦截 / 父 Context 时的 waterfall，`next` 里会真正 `fiber.update`。
- **`loader/partial-dispose`**：Entry 部分字段变化或被移除。`legacy` 是旧 options，`active` 表示是否仍留在树上。
- **`loader/config-update`**：配置即将写回文件。

`internal/update` 在带 entry 的 Fiber 上还会：

1. 把 config（若 `Config` 有 `simplify` 就先简化）写回 `entry.options.config`，再 `tree.write()`。
2. 打 reload 日志。

若插件自己调用 `fiber.dispose()`，且不是 HMR、也不是祖先树在卸，Loader 会把该 entry 标为 `disabled` 并写回配置——相当于「运行时关掉自己，并记住下次不要再开」。

### 表达式插值

配置里可以嵌一段要在 Context 上执行的 JavaScript，而不是写死字面量。

```ts
interface JsExpr { __jsExpr: string }

evaluate(ctx, expr)      // 等价于 with (ctx) eval(expr)
interpolate(ctx, value)  // 递归走对象 / 数组，遇到 JsExpr 就 evaluate
isJsExpr(value)
```

YAML 用自定义标签 `!!js` 表示这种表达式，加载时在该 Entry 的 Context 上求值。`eval` 能读到 `ctx` 上的服务，因此配置可以引用运行时状态。

---

## `@cordisjs/plugin-include`

把 YAML / JSON 配置文件变成一棵 EntryTree。依赖 `loader`（必须先加载 Loader）。

```ts
await ctx.loader.create({
  name: '@cordisjs/plugin-include',
  config: {
    path: './cordis.yml',
    initial?: any[],
    patches?: PatchOptions[],
    enableLogs?: boolean,
  },
})
```

支持扩展名：`.yml` / `.yaml` / `.json`。

- **readonly（只读）**：文件不可写时进入只读；再 `write()` 会抛 `cannot overwrite readonly config`。
- 写入先写 `filename.tmp`，再 **rename**（改名覆盖），避免写到一半损坏原文件。并 **debounce** 到下一个 **macrotask**（事件循环里的宏任务，相当于 `setTimeout(0)`）再真正落盘，避免一次更新触发多次写。
- 文件不存在且提供了 `initial`：先把这份初始清单写出去，再读回来。

### PatchOptions

**运行时补丁**：在读入的配置上再叠一层修改，不要求去改源文件。

```ts
interface PatchOptions {
  id?: string
  insert?: EntryOptions[]
  name?: string          // 校验目标 name，不匹配则跳过（防止补错条目）
  config?: any
  group?: boolean | null
  disabled?: boolean | null
  inject?: any
  intercept?: any
  isolate?: any
}
```

- 有 `insert`：无 `id` 则插入根清单；有 `id` 则插入那个 group。
- 无 `insert`：必须有 `id`，按字段覆盖目标。

`refresh()`：文件内容变了就重读，并 `root.update`。HMR 看到配置文件变更会调它。

若 `internal/update` 传来的 `path` 没变，Include 只用内存里的 `data` 刷新子树，不会当成「换了一个文件」往下传 `next`。

---

## `@cordisjs/plugin-group`

配置树里的分组节点。包本身只是把 loader 里的 `Group` 再导出一次，方便在 `name` 字段里写 `@cordisjs/plugin-group`。

```ts
import Group from '@cordisjs/plugin-group'
```

配置里通常这样写：

```yaml
- id: main
  name: '@cordisjs/plugin-group'
  config:
    - id: timer
      name: '@cordisjs/plugin-timer'
    - id: app
      name: ./plugins/app.ts
      disabled: true
```

`Group` 在 `[Service.init]` 里用这份 `config` 调用 `update`，并监听 `internal/update`，以便热更新配置时同步子树。

---

## `@cordisjs/plugin-timer`

```ts
import TimerService from '@cordisjs/plugin-timer'

await ctx.plugin(TimerService)
```

mixin 到 Context 的方法：`timeout`、`interval`、`throttle`、`debounce`。另有已废弃的别名 `setTimeout` / `setInterval`（旧名字，请改用前者）。

**重载**：同一个函数名，按参数不同有多种用法。

| 方法 | 重载 | 说明 |
| --- | --- | --- |
| `ctx.timeout(fn, ms)` | 返回 `() => void` | `ms` 毫秒后执行 `fn`，到时或手动调用返回值都会清掉定时器。 |
| `ctx.timeout(ms)` | 返回 `Promise<void>` | 睡一段时间。Fiber dispose 时这条 Promise 会 **reject**（失败结束），错误信息为 `Context has been disposed`。 |
| `ctx.interval(fn, ms)` | 返回 disposer | 每隔 `ms` 执行一次，等价于受生命周期管理的 `setInterval`。 |
| `ctx.interval(ms)` | 返回 `AsyncIterableIterator` | 可用 `for await` 按节拍循环；dispose 时迭代器抛错。**AsyncIterableIterator** 即异步可迭代器。 |
| `ctx.throttle(fn, ms, noTrailing?)` | 返回带 `dispose` 的包装函数 | **节流**：每隔至少 `ms` 才真正执行一次。`noTrailing` 为 true 时，冷却结束不再补一次「尾巴」调用。 |
| `ctx.debounce(fn, ms)` | 返回带 `dispose` 的包装函数 | **防抖**：连续触发时只在停下来 `ms` 之后执行最后一次。 |

```ts
const stop = ctx.timeout(() => {}, 1000)
stop()

await ctx.timeout(500)

for await (const _ of ctx.interval(1000)) {
  break
}

const onResize = ctx.debounce(() => {}, 200)
onResize()
onResize.dispose()
```

---

## `@cordisjs/plugin-hmr`

**HMR（热更新）**：监视源文件，改动后只重载受影响的插件。依赖 `loader` 和 `timer`，且 Loader 必须拿到 Node 内部 `ModuleLoader`（启动参数 `--expose-internals`）。

```ts
import Hmr from '@cordisjs/plugin-hmr'

await ctx.plugin(Hmr, {
  base?: string
  root: string[]          // 监视目录，默认 ['.']
  ignored: string[]       // 忽略规则，默认 node_modules、点文件、cache、data
  debounce: number        // 合并短时间内的多次变更，默认 100ms
  // 其余字段传给 chokidar
})
```

**chokidar**：常用的文件系统监视库，HMR 用它听 `root` 下的改动。

服务名：`ctx.hmr`。

行为概要：

1. chokidar 监听 `root`。
2. 变更落在 CLI 入口的依赖树（称为 **externals**，框架自身那批模块）→ 调用 `loader.exit()`。默认是空的，通常由宿主改成退出进程再拉起。
3. 变更出现在 ESM **`loadCache`**（Node 已加载模块的缓存）里 → 分析依赖，只重载受影响插件。
4. 变更是某个 Include 的配置文件 → `include.refresh()`。
5. 其他 → 发 `hmr/change`。

重载成功发 `hmr/reload`。若重新 `import` 失败，会**回滚**（把模块缓存恢复成改之前），并打日志。

```ts
interface Events {
  'hmr/change'(url: string): void
  'hmr/reload'(reloads: Map<Plugin, { filename: string; runtime?: Plugin.Runtime }>): void
}
```

---

## `@cordisjs/plugin-logger-console`

把日志打到 console。Node 与浏览器的入口不同：

- Node：用 `util.inspect`（把任意值收成带颜色的字符串）和 `supports-color`（探测终端颜色等级）。
- Browser：用 `console.log` / `warn` / `error`。

```ts
import ConsoleExporter from '@cordisjs/plugin-logger-console'

await ctx.plugin(ConsoleExporter, {
  colors?: false | 0 | 1 | 2 | 3   // 颜色等级；false / 0 为关闭
  maxLength?: number
  levels?: Record<string, number>
  showDiff?: boolean          // 是否在行尾显示与上一条的时间差，默认 false
  showTime?: string           // 时间模板，默认 'yyyy-MM-dd hh:mm:ss '
  label?: { width?: number; margin?: number; align?: 'left' | 'right' }
})
```

构造时调用 `ctx.logger.exporter(this)`，把自己登记为导出器。插件名是 `logger-console`。

---

## `@cordisjs/utils`

内部包，未发布到 npm。提供随 Context / Fiber 回收的列表：

```ts
import { List } from '@cordisjs/utils'

const list = new List<Handler>(ctx, 'handlers')
list.push(handler)     // 登记为 effect，Fiber 卸载时自动删除
list.length
for (const item of list) {}
for (const item of list.filter(x => x.enabled)) {}
```

和核心里的 `DisposableList` 不同：`List.push` 绑在当前 Fiber 的 effect 上，生命周期跟插件走；`DisposableList` 只是通用列表，不自动绑定 Fiber。

---

## `create-cordis`

**脚手架**：从网上的模板包拉下一份项目骨架，改好 `package.json` 名字，可选地装依赖并启动。默认模板 `@cordisjs/boilerplate`，要求 Node `>= 22`。

```bash
npm create cordis@latest my-app
# 或
npx create-cordis my-app -t @cordisjs/boilerplate
```

| 参数 | 别名 | 说明 |
| --- | --- | --- |
| `<name>` | | 项目目录名 |
| `--template` | `-t` | npm 上的模板包名 |
| `--ref` | `-r` | **dist-tag**（发布标签，如 `latest` / `beta`），默认 `latest` |
| `--forced` | `-f` | 目标已存在也覆盖 |
| `--yes` | `-y` | 跳过「是否现在安装」的提问，也不装依赖 |
| `--git` | `-g` | 在新目录执行 `git init` |
| `--prod` | `-p` | 去掉模板的 `devDependencies`（开发依赖）和 `workspaces`（monorepo 工作区字段） |
| `--mirror` | `-m` | 预留给 **yargs**（命令行参数解析库），源码里没有再读这个值 |

可编程入口：

```ts
import scaffold, { stageYarnBin } from 'create-cordis'

await scaffold({
  name: 'cordis',
  version: '0.3.0',
  template: '@cordisjs/boilerplate',
})

await stageYarnBin({
  rootDir,
  registry,
  agent: { name: 'yarn', version: '1.22.22' },
})
```

**`stageYarnBin`**：按调用方的 yarn 版本和 `.yarnrc.yml` 里的 **`yarnPath`**（指向仓库内 yarn 可执行文件的路径），必要时下载并放置 yarn 二进制，让全局 yarn 1 也能驱动较新的 yarn。

---

## CLI

`cordis` 包自带 **`bin.js`**（npm 安装后可当作命令执行的入口脚本），做的事情等价于：

```ts
const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'
await ctx.plugin(Loader)
await ctx.loader.create({
  name: '@cordisjs/plugin-include',
  config: { path: './cordis.yml' },
})
```

即：把当前工作目录当作 `baseUrl`，读取 `./cordis.yml` 作为插件树。需要 HMR 时建议：

```bash
node --expose-internals --import tsx ./node_modules/cordis/bin.js
```

- **`--expose-internals`**：允许加载 Node 内部模块，HMR 才能清 ESM 缓存。
- **`--import tsx`**：启动时先加载 [tsx](https://github.com/privatenumber/tsx)，以便直接跑 TypeScript。本仓库用的是 `@cordiverse/tsx` 分支。

---

## TypeScript 扩展约定

插件通过 `declare module 'cordis'` 把服务和事件**合并进**核心类型（接口同名即合并，而不是覆盖）。这样使用方写 `ctx.foo`、`ctx.on('foo/ready')` 时才有补全。

```ts
import { Context, Service } from 'cordis'

declare module 'cordis' {
  interface Context {
    foo: Foo
  }

  interface Events {
    'foo/ready'(): void
  }
}

class Foo extends Service {
  constructor(ctx: Context) {
    super(ctx, 'foo')
  }
}

export default Foo
```

使用方：

```ts
await ctx.plugin(Foo)
ctx.foo
ctx.on('foo/ready', () => {})
```

**`InjectKey`**：可以从 `Context` 上选出「实现了 `[Service.config]`」的服务名。因此只有声明了配置类型的服务，才能出现在 `@Inject('xxx', config)` 的类型检查里；随便写一个字符串会报类型错误。

---

## 错误码与异常

| 类型 | 条件 |
| --- | --- |
| `CordisError('INACTIVE_EFFECT')` | 在已 dispose 的 Fiber 上调用 `effect` / `on` / `plugin` / `update` / `restart`。 |
| `ValidationError` | 插件 `Config` 校验失败，消息带 issue path。 |
| `TypeError('Async config validation is not supported')` | schema 的 `validate` 返回了 Promise。 |
| `TypeError('Invalid effect')` | `effect` 或插件返回了既不是函数、也不是可迭代 / Promise 的值。 |
| `Error('invalid plugin, ...')` | 插件形态无法解析。 |
| `Error('service "x" has been registered at <name>')` | 同一隔离域里重复 `provide`。 |
| `Error('cannot resolve entry id')` | Loader 按 id 找不到 Entry。 |
| `Error('cannot overwrite readonly config')` | Include 试图写入只读文件。 |
| `Error('--expose-internals is required for HMR service')` | HMR 拿不到内部 ModuleLoader。 |
| `Error('Context has been disposed')` | `timeout` / `interval` 在 Fiber 卸载后还没结束。 |

---

## 典型启动组合

手工把日志、加载器、配置文件串起来，效果接近 CLI：

```ts
import { Context } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import LoggerConsole from '@cordisjs/plugin-logger-console'
import { pathToFileURL } from 'node:url'

const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'

await ctx.plugin(LoggerConsole)
await ctx.plugin(Loader)

await ctx.loader.create({
  name: '@cordisjs/plugin-include',
  config: {
    path: './cordis.yml',
    enableLogs: true,
  },
})

await ctx.loader.await()
```

`cordis.yml` 示例：

```yaml
- id: logger
  name: '@cordisjs/plugin-logger-console'
  config:
    showTime: 'hh:mm:ss '

- id: timer
  name: '@cordisjs/plugin-timer'

- id: app
  name: ./src/index.ts
  inject:
    - timer
  isolate:
    db: true
  intercept:
    logger:
      name: app
```

这份配置的含义：先开控制台日志和定时器，再加载本地 `./src/index.ts`；它声明依赖 `timer`，把 `db` 服务隔到自己的本地域，并把日志名改成 `app`。
