---
title: 06-用 Config schema 声明插件配置
date: "2026-09-12"
tags:
  - "ai"
  - "dsh"
column: dsh-plugin
order: 6
dsh-version: 0.2.0-rc.2
viewable: true
---
> **读完这篇你能**：把插件里写死的图片路径、透明度改成交互配置，不改代码、不重装就能换图。
>
> **前置**：[05-插件生命周期与 ctx.effect](05-插件生命周期与 ctx.effect.md)。约 20 分钟。
>
> **示例代码**：[dsh-chat-background-config](https://github.com/anthonyzhao-4926/blog/tree/main/code/dsh_plugin/dsh-chat-background-config)

[04-注册 HTTP 路由与注入页面样式](04-注册 HTTP 路由与注入页面样式.md)里，图片路径是写死的常量：

```ts
const IMAGE_PATH = new URL('../image.jpg', import.meta.url).pathname
```

样式表也不接受参数——透明度想要可调，得先有人把值送进 CSS。

想换张图、调个透明度，只能改源码——改完还要重装、重启。如果你一个人用、一辈子只换一次图，这没问题。下面任意一条成立，就该把它升级成配置：

- 换台机器（公司 / 家里）要换图，但不想每台机器维护一份不同的源码；
- 想现场试几个透明度，而不是"改一次、装一次、重启一次"；
- 插件要给别人用，别人不该碰你的源码。

这篇把 [04-注册 HTTP 路由与注入页面样式](04-注册 HTTP 路由与注入页面样式.md)的背景插件做成可配置版本，代码单独放在 `dsh_plugin/dsh-chat-background-config/`。

## 目标

改完之后，换图只需要在 profile 里写一段配置：

```yaml
# ~/.dsh/profiles/test/cordis.patch.yml
- id: dsh-chat-background-config
  config:
    image: /Users/you/Pictures/cat.jpg
    opacity: 0.5
```

保存配置，背景变成 cat.jpg、透明度 0.5（配置热重载默认开着，不用重启）。什么都不写，就用插件自带的那张图、透明度 0.35。

## DSH 设计

这一节不依赖本文后面的任何内容，单独讲清 DSH 的插件配置是怎么设计的（依据源码快照 `local/deepseek-harness-dsh-v0.2.0-rc.2/docs/architecture.zh.md`、`local/deepseek-harness-dsh-v0.2.0-rc.2/docs/cordis-api/fiber.zh.md`）。

先交代名词。DSH 里一个**插件**是一段带名字的可装载代码。运行中的 DSH 是一张按行组织的插件清单：每一行叫一个 **entry**（条目），写着插件的名字、代码位置，以及一块可选的 `config` 数据——「插件配置」就存放在这里。

**配置写在条目上，天然能被各层补丁改写。** DSH 启动时手里没有写死的功能清单，而是从空清单开始按序叠加几层**补丁**（patch：一份 YAML 文件，每行声明「插入一个条目 / 修改一个条目 / 停用一个条目」）：先叠官方功能包——DSH 叫它**组合包**（bundle：一批插件连同它们的挂载补丁）；再叠当前配置方案 **profile**（DSH 允许保存多套配置方案，启动时选一套）目录里的补丁；然后叠用户级补丁；最后叠命令行临时补丁。补丁改配置只有一条规则：按条目的 `id` 定位，把这个条目原来的整个 `config` 块替换成新写的这一块——不是逐字段合并。所以任何一层补丁都没写的字段，没有任何一层替它保留，只能由插件自己声明的默认值补齐。

**校验是装载的一道关，先于插件代码执行。** DSH 把一个已加载的插件实例叫 **fiber**，fiber 的定义就包括「持有经过校验的配置」。约定是：插件导出一个名叫 `Config` 的校验器（一种通用校验接口，叫 standard-schema）；装载时先拿它校验条目上的 `config` 块，通过、并按校验器里声明的默认值补全之后，配置才归 fiber 持有，插件的启动函数才开始执行；通不过就抛 `ValidationError`，fiber 停在 FAILED 状态，启动函数根本不会跑。「配置写错当场失败」靠的不是插件自觉，是这道关卡的先后顺序。

**配置归 fiber 持有，改配置等于换一个新实例。** fiber 有一条专门的更新通道：新配置在任何重载发生之前先过同一道校验关，通过了才卸载旧实例——它注册过的路由、监听器等随之全部撤销——并带着新配置重新装载；通不过则错误直接抛出，旧配置接着跑。「保存配置就生效」和「改坏了不会把插件搞挂」，是同一条设计的两面。

```mermaid
flowchart TD
    A["各层补丁按序叠加<br/>组合包 → profile → 用户级 → 命令行"] -->|"按 id 定位<br/>整块替换"| E["条目上的 config 块"]
    E --> F{"装载时的校验关<br/>插件导出的校验器"}
    F -->|"通过：按声明补默认值"| G["fiber 持有完整配置<br/>插件启动函数执行"]
    F -->|"失败：ValidationError"| H["fiber 停在 FAILED<br/>启动函数不执行"]
```

这张图同时解释了三条写配置时的自然推论：默认值只需写在校验器一处（补丁没写的字段由它兜底）、约束要尽量写进校验器（它在这道关上执行）、非法值宁可当场报错（好过一个带着错配置跑起来的插件）。

## Config 的导出

Cordis 认一个约定：插件导出同名的 `Config` 类型和 `Config` schema，它就会在调用 `apply` 之前，用 schema 校验 entry 的 `config` 块，并把缺失的字段用默认值补齐。

```ts
// src/dsh-chat-background.ts（新增部分）
import Schema from '@deepseek-ai/schemastery'

// 04-注册 HTTP 路由与注入页面样式 里写死的图片路径，现在降级成"默认值"
const DEFAULT_IMAGE = new URL('../image.jpg', import.meta.url).pathname

export interface Config {
    /** 背景图片的绝对路径。 */
    image: string
    /** 图片显示强度：0 完全透明，1 完全不透明。 */
    opacity: number
}

export const Config: Schema<Config> = Schema.object({
    image: Schema.string().default(DEFAULT_IMAGE),
    opacity: Schema.number().min(0).max(1).default(0.35),
})

export function apply(ctx: Context, config: Config): void {
    // ...
}
```

三个要点：

- **名字必须叫 `Config`。** 类型给编辑器，`Schema` 值给 Cordis 运行时。只写 `interface Config` 不够——Cordis 要的是一个运行时的 [Standard Schema](https://standardschema.dev/) 验证器，普通对象没有 `~standard` 接口。
- **默认值写在 schema 里**（`.default(...)`），不要写成 `apply` 里的 `config.image ?? ...`。`apply` 拿到的永远是补齐后的完整配置，代码里不用再防 `undefined`。
- **约束也写在 schema 里。** `.min(0).max(1)` 表示透明度只能是 0~1，`Schema.string()` 表示图片路径必须是字符串。约束在这里声明，Cordis 就在加载时替你执行。


别忘了在本插件`package.json`中添加依赖——`Schema` 来自 `@deepseek-ai/schemastery`，不在 `cordis` 里。

```json
"dependencies": {
  "@deepseek-ai/cordis": "^4.0.1",
  "@deepseek-ai/dsh-host-webserver": "^0.2.0-rc.2",
  "@deepseek-ai/schemastery": "^3.18.2"
}
```

这份 `package.json` 是"插件的清单"：插件代码 `import` 的包都写在这里；profile 的 `package.json` 是"要挂哪些插件"的清单。两个文件分属两层，别混。

```bash
cd dsh_plugin/dsh-chat-background-config
pnpm install
```

## config 的接入

配置声明好了，接下来是"哪里用它"。两处。

### 路由读取 config.image

图片路径可配之后，`content-type` 也得跟着路径走。先补一张扩展名对照表：

```ts
import { extname } from 'node:path'

// 允许的图片扩展名 → Content-Type；换成 PNG/WebP 时响应头要跟着变
const CONTENT_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
}
```

handler 只改一处——读 `config.image`，而不是模块顶层的常量：

```ts
ctx.inject(['webServer'], (serverCtx) => {
    const webServer = serverCtx.webServer
    ctx.effect(() => webServer.register({
        kind: 'exact',
        path: IMAGE_URL,
        handler: async (_req, res) => {
            const contentType = CONTENT_TYPES[extname(config.image).toLowerCase()]
                ?? 'application/octet-stream'
            res.writeHead(200, { 'content-type': contentType })
            res.end(await readFile(config.image))
        },
    }))
})
```

注意路由地址 `IMAGE_URL` 本身没变——浏览器拿图的通道是固定的，变的是**通道背后读哪个文件**。

### 样式改用 CSS 变量

[04-注册 HTTP 路由与注入页面样式](04-注册 HTTP 路由与注入页面样式.md)的 `style.css` 是静态文件，透明度一进来它就不再静态了。改法是把唯一的动态值提成 CSS 变量，样式表本身尽量不动：

```ts
/** 用配置值生成样式：静态选择器来自 style.css，只有遮罩浓度随配置变化。 */
function buildStyle(config: Config): string {
    // 透明度的实现：在图片上盖一层与页面底色同色的遮罩，越不透明遮得越多
    const veilPercent = Math.round((1 - config.opacity) * 100)
    // var() 的兜底不能省：自定义属性的 var() 替换发生在「声明它的那个元素」上，
    // 变量解析不出来时，用到它的整条 background-image 会一起失效（背景图消失）
    const veil = `color-mix(in srgb, var(--dsw-alias-bg-base, transparent) ${veilPercent}%, transparent)`
    const styleSheet = readFileSync(new URL('./style.css', import.meta.url), 'utf8')
    // 变量定义在 body 上，不能放在 :root：--dsw-alias-bg-base 由主题插件定义在
    // body，html 上取不到它，定义在 :root 会变成非法值，连带背景图整条不生效
    return `body { --dsh-chat-background-veil: ${veil}; }\n${styleSheet}`
}
```

`style.css` 里对应改一行：

```css
div:has(> [data-shell-overlay]) {
    background-image:
        linear-gradient(var(--dsh-chat-background-veil), var(--dsh-chat-background-veil)),
        url('/dsh-chat-background-config/image.jpg');
    background-size: cover;
}
```

> 为什么不直接在 `style.css` 里写 `opacity: 0.35`？因为那会把整个布局根、连同里面的文字和按钮一起变透明。图片的"透明度"是盖一层与页面底色同色的遮罩实现的：`opacity` 越低，遮罩越浓。`--dsw-alias-bg-base` 是 DSH 主题里的页面底色变量，明暗主题各有一份。

## config 的位置

插件自己那份补丁（本包叫 `patch.yaml`，就是真正由 `dsh.bundle.patch` 声明进去的那份）只负责"把插件挂上树"，不写 config：

```yaml
- insert:
    - id: dsh-chat-background-config
      name: '/绝对路径/dsh-chat-background-config/src/dsh-chat-background.ts'
```

你机器上的偏好写在 **profile 的 `cordis.patch.yml`** 里，用 entry 的 `id` 定位：

```yaml
# ~/.dsh/profiles/test/cordis.patch.yml
- id: dsh-chat-background-config
  config:
    image: /Users/you/Pictures/cat.jpg
    opacity: 0.5
```

理由和 [01-profile、bundle 与插件的关系](01-profile、bundle 与插件的关系.md)解释 profile 时是同一个：**插件是"能力"，配置是"这台机器上的选择"**。源码可以共享、可以发布；这台机器用哪张图，不该混进源码里。

## 安装与验证

```bash
cd 你的插件目录
dsh plugin --profile test add link:.
dsh --profile test --dump-config   # 插件树里出现 dsh-chat-background-config
dsh --profile test --no-open       # 启动，web 端口 3080
```

`--dump-config` 打印的是各层 patch 合成后的结果。改完 `cordis.patch.yml` 里的 config，再跑一次 `--dump-config`，就能确认新值真的进了配置树——比"重启后盯着页面猜"快得多。

自建 profile 默认就开着配置热重载：改完 `cordis.patch.yml` **保存就生效**，不用重启启动命令（条件与边界见[07-配置与源码的热重载](07-配置与源码的热重载.md)）。

## 配置的层叠

一个 entry 的 config 不只一个来源。完整顺序是：

```mermaid
flowchart TD
    A["空根 cordis.yml"] --> B["bundles 里每个插件自带的 patch<br/>（含我们的 insert）"]
    B --> C["profile 自己的 cordis.patch.yml<br/>（你写 config 的地方）"]
    C --> D["~/.dsh/cordis.patch.yml<br/>（机器级，跨 profile）"]
    D --> E["命令行 --patch 覆盖"]
```

后面一层按 `id` 覆盖前面一层。**而且覆盖是整块替换，不是逐字段合并**：你写 `config: { opacity: 0.5 }`，这一行原来整个 config（比如 `{ image: ..., opacity: 0.35 }`）都会被换掉，`image` 回落到 **schema 默认值**，而不是保留上一层的值。

由此得到一条规矩：**默认值只写在 schema 一处。** 不要一半放 schema、一半放插件自带的 `patch.yaml`，否则你在 profile 里覆盖另一个字段时，前一半会悄无声息地消失。真要在 profile 层覆盖，就把要保留的字段一起写全。

## 非法配置当场失败

schema 不只是文档，它在加载时执行。把透明度写成 1.5：

```yaml
- id: dsh-chat-background-config
  config:
    opacity: 1.5
```

插件不会"凑合用默认值"，而是在 `apply` 之前就失败：

```text
ValidationError: invalid config:
  - $.opacity expected number <= 1 but got 1.5 (at opacity)
```

对应的 fiber 停在 FAILED 状态，插件根本没启动。

这正是我们想要的：配置错误在加载时炸掉，**比**插件带着一个你没打算要的值跑起来、过一会儿表现成"背景看着不太对"**好排障**得多。所以不要把 schema 写得太宽松——类型、范围、枚举这些能表达的约束都写进去，别用"容错"把错误吞掉。

`image` 指向的文件不存在，schema 判不了——它不知道你的磁盘上有什么，只能在请求到达、`readFile` 报错时暴露。引用型的配置（文件、服务、别的插件）大多如此：能自证的约束在 schema 里当场失败，要引用别的东西的，得等解析到它时才失败。

## 注意事项

- **`id` 要对得上。** profile 的覆盖靠 entry 的 `id` 定位；`id` 写错，这条 patch 会警告"entry not found"然后跳过，插件照常按默认值启动——现象就是"配置没生效"。
- **图片路径写绝对路径。** `readFile` 解析相对路径时基准是 DSH 进程的工作目录，不稳定；配置里直接给绝对路径。
- **跟 [04-注册 HTTP 路由与注入页面样式](04-注册 HTTP 路由与注入页面样式.md)的插件二选一。** 本文的插件是独立一份（名字带 `-config`）。两套都挂着时，两边会往同一个布局根注入背景样式，后注入的盖住前面的。先在 profile 里用[03-用 patch 覆盖 DSH 的默认配置](03-用 patch 覆盖 DSH 的默认配置.md)里那招停用 [04-注册 HTTP 路由与注入页面样式](04-注册 HTTP 路由与注入页面样式.md)的那份（`- id: <它的 entry id>` + `disabled: true`）。
- **改 config 保存即生效。** 配置热重载默认开着，不用重启进程；源码热重载默认关着，怎么开、哪些改动必须重启，见[07-配置与源码的热重载](07-配置与源码的热重载.md)。

---
