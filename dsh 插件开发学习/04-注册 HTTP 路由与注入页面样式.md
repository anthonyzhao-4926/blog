---
title: 04-注册 HTTP 路由与注入页面样式
date: 2026-08-31
tags:
  - ai
  - dsh
column: dsh-plugin
order: 4
viewable: true
---
> **读完这篇你能**：写一个插件，让浏览器能拿到你的图片，并把 DSH 页面背景换掉。
>
> **前置**：[03-用 patch 覆盖 DSH 的默认配置](03-用 patch 覆盖 DSH 的默认配置.md)。约 25 分钟。
>
> **示例代码**：[dsh-chat-background](https://github.com/anthonyzhao-4926/blog/tree/main/code/dsh_plugin/dsh-chat-background)
>
> **DSH 版本**：0.2.0-rc.2

[03-用 patch 覆盖 DSH 的默认配置](03-用 patch 覆盖 DSH 的默认配置.md)把 patch 讲完了，但它改的都是 DSH 自带的那几行。现在回到我们自己的插件——写一个真正能动 UI 的。实现如下效果：
![](assets/Pasted%20image%2020260831223352.png)

## 目标

写一个插件，把一张本地图片设为 DSH 的聊天背景。

## DSH 设计

先看服务器本身。DSH 的 webServer 就是一个 HTTP 服务器加一张路由表，它自己不了解任何 DSH 概念，也不提供任何文件：`/api` 桥接、插件包资源、HMR 事件流、打包好的页面文件，全都由插件往表里注册。所以「让浏览器能访问某个地址」不是改服务器配置，而是和内置功能走同一条路：往表里注册一行。服务器一激活就开始监听；handler 拿到请求后，拥有响应的全部控制权。

这张路由表是为「组合」设计的，不是为「顺序」设计的。注册进去的是具名路由：`exact` 逐字匹配一个路径，`prefix` 匹配一个前缀及其下所有路径。匹配顺序是固定的：先查精确匹配，再取最长前缀，最后交给唯一一个「回退席位」接管；没人认领时，服务器答 404。重复注册同一路径会直接抛错——路由归属是插件之间的组合约定，撞了就是配置错，不是谁先到先得。也正因为具名路由互不相交，注册先后不影响任何一次请求的结果。

```mermaid
flowchart TD
    B["浏览器请求到达 webServer"] --> Q{"路由表按固定顺序匹配"}
    Q -->|"1. 精确匹配命中"| H1["认领这个路径的插件<br/>如接口桥接、热更新流"]
    Q -->|"2. 最长前缀命中"| H2["认领这个前缀的插件"]
    Q -->|"3. 都不命中"| H3["回退席位（仅一席）<br/>静态页面插件：返回构建好的页面文件"]
```

回退席位目前由发行版预置的一个静态页面插件认领。它把 Web 壳的构建产物（dist 目录）端给浏览器，官方文档叫它 SPA dist 服务器。认领手段和其他插件毫无区别，就是 `ctx.webServer.registerFallback(handler)`，外面用 `ctx.effect` 包着注册；插件卸载时席位释放，未命中的请求回到 404。

路由之外，webServer 还提供另一个扩展点：页面注入表。路由回答的是「有请求时谁来应答」，注入表回答的是「返回页面 HTML 之前，谁能往里面加东西」。想往页面里塞 `<style>`、`<script>` 这类启动所需的东西，正规通道不是改 HTML 文件，而是订阅 `webserver/index-inject` 事件。每次要返回页面时，webServer 新建一张空表并广播这个事件，每个订阅者把自己当前的行 push 进去，最后按行自带的定位渲染进 HTML：该进 head 的插在 `<head>` 开标签后，该进 body 的插在 `<body>` 开标签后。

这里的关键在于，行是推到那一刻现读的，而且每返回一次页面就重新采集一遍。主题偏好、模块图都是当场取值，所以运行期切换主题、装卸插件，下一次刷新页面就跟着变，不存在表里数据过期这回事。插件卸载时，订阅随 fiber 销毁，它推过的行也一起消失。

最后一个问题是时机。插件想用 webServer，可轮到它启动的那一刻，服务器可能还没就绪。插件之间不约启动顺序，只声明服务依赖：插件声明自己需要哪些服务，框架等服务就绪再启动它，也就是「加载顺序通过服务依赖表达，而非手动编排启动序列」（`docs/cordis-primer.zh.md`）。代码里就是 `ctx.inject(['webServer'], ...)`——这不是可选的等待工具，而是「我要用某个服务」的正规声明。

一句话点题：服务器只提供路由表和事件，页面上能看到的一切，都是各个插件认领和推入的。

## 两条链路

hello world 只是打印一句话，而这个插件要「动 UI」。页面是 DSH 自己渲染的，插件想影响它，需要打通两条路（机制就是上文的第一个和第三个）：

1. 让浏览器能拿到图片：图片在插件目录里，浏览器可访问不到你的磁盘。所以我们要在 DSH 的 webServer 上注册一个 HTTP 路由：浏览器请求某个地址时，服务器把图片文件返回给它。
2. 让页面穿上背景：页面不知道「背景长什么样」。DSH 提供了一个钩子 `webserver/index-inject`，允许插件往每个页面的 `<head>` 里注入一段 `<style>`。

```mermaid
flowchart LR
    A["浏览器打开页面"] --> B["请求 /dsh-chat-background/image.jpg"]
    B --> C["webServer 路由<br/>（插件注册的）"]
    C --> D["读取插件目录里的<br/>image.jpg 并返回"]
    A --> E["页面 HTML 里已被注入 &lt;style&gt;"]
    E --> F["CSS 把背景图铺在布局根"]
    D --> F
```

## 目录结构

```text
dsh-chat-background/                    ← 插件包（bundle）
├── src/                                ← 源码目录
│   ├── dsh-chat-background.ts          ← 插件本体：name + apply
│   └── style.css                       ← 背景样式（独立文件，方便改）
├── image.jpg                           ← 你的背景图片
├── package.json                        ← 身份 + dsh.bundle 声明
├── patch.yaml                          ← 挂载指令
└── tsconfig.json                       ← 类型配置（让编辑器认识 node:fs）
```

## 图片准备

把想用的背景图放到插件根目录，本教程用 `image.jpg`。

> 为什么图片不能写进代码？一是几 MB 的图会让代码文件爆炸；二是浏览器根本读不到你磁盘上的文件，必须走 HTTP 路由，这是唯一的正规通道。

## 插件代码


```ts
// src/dsh-chat-background.ts
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
// 只引入类型声明（module augmentation），编译后剥离，运行时零开销
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'dsh-chat-background'

// 图片在插件根目录（../），样式表与源码同目录；都用 import.meta.url 解析
const IMAGE_PATH = new URL('../image.jpg', import.meta.url).pathname
const IMAGE_URL = '/dsh-chat-background/image.jpg'
const STYLE = readFileSync(new URL('./style.css', import.meta.url), 'utf8')

export function apply(ctx: Context): void {
    // 1. 注册路由：浏览器请求 IMAGE_URL 时返回图片
    ctx.inject(['webServer'], (serverCtx) => {
        const webServer = serverCtx.webServer
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: IMAGE_URL,
            handler: async (_req, res) => {
                res.writeHead(200, { 'content-type': 'image/jpeg' })
                res.end(await readFile(IMAGE_PATH))
            },
        }))
    })

    // 2. 注入样式：把 style.css 内容原样注入每个 index 响应
    ctx.on('webserver/index-inject', (table) => {
        table.push({ kind: 'style', text: STYLE })
    })
}
```

这段代码做了两件事：第 1 段注册图片路由，第 2 段注入样式。我们按顺序拆开讲。

### 注册图片路由

```ts
ctx.inject(['webServer'], (serverCtx) => {
    const webServer = serverCtx.webServer
    ctx.effect(() => webServer.register({
        kind: 'exact',
        path: IMAGE_URL,
        handler: async (_req, res) => {
            res.writeHead(200, { 'content-type': 'image/jpeg' })
            res.end(await readFile(IMAGE_PATH))
        },
    }))
})
```

表面看只是"注册一个路由"，其实是三层嵌套，每一层解决一个问题。

最外层 `ctx.inject(['webServer'], ...)`：声明"我依赖 webServer"

`webServer` 是 DSH 内置的 HTTP 服务器服务（Cordis Service）。它自己也有启动过程——要监听端口、准备就绪。插件执行到 `apply()` 时，webServer 很可能还没准备好。`ctx.inject` 就是告诉 Cordis："我依赖 webServer，等它可用了再叫我"。Cordis 会替我们等，服务就绪后才执行里面的回调。

中间层 `webServer.register({...})`：往路由表里加一条

`register` 接收一个路由描述对象：

- `kind: 'exact'`：路径逐字匹配。浏览器请求的地址必须和 `path` 一模一样（`/dsh-chat-background/image.jpg` 一个字符都不能差）。另一个可选值是 `'prefix'`，匹配 `path` 和 `path/<任意内容>`，适合托管一个目录。
- `handler`：拥有响应的完整生命周期。服务器把请求交给 handler，写什么状态码、返回什么内容都由它决定（甚至可以挂起连接做 SSE）。所以我们必须自己 `res.writeHead(...)` 声明状态码和类型，`res.end(...)` 结束响应。
- 重复注册同一条 (kind, path) 会直接抛错——DSH 认为路由是"组合级契约"，撞了就是配置错误。

`handler` 内部就三行：`res.writeHead(200, { 'content-type': 'image/jpeg' })` 告诉浏览器"这是张 JPEG 图片"；`await readFile(IMAGE_PATH)` 把插件目录里的图片读进内存；`res.end(...)` 把字节流发给浏览器。

`register` 还有返回值：一个注销函数（把这条路由从表里删掉）。这个返回值是留给最内层用的。

最内层 `ctx.effect(...)`：把注销函数绑进插件生命周期

```ts
ctx.effect(() => webServer.register({ ... }))
```

`ctx.effect` 接收一个函数，该函数会立即执行，函数的返回值也是一个函数，当卸载当前插件时执行清理动作（[05-插件生命周期与 ctx.effect](05-插件生命周期与 ctx.effect.md)着重讲解）。

等插件被卸载（禁用、移除、重载）时，Cordis 会逆序执行所有清理函数。


于是 `register` 返回的注销函数就有了归属：插件活着，路由在；插件卸载，路由自动消失。

这里不使用 `ctx.effect` 包装 `webServer.register` 也是可以的，路由一样可以注册进去，只是卸载插件时不会执行清理动作，下次再启用插件时 `register` 就会抛 `duplicate exact route` 异常。

- 请求来了会发生什么

```mermaid
sequenceDiagram
    participant S as DSH 服务端
    participant B as 浏览器
    participant W as webServer
    participant H as 我们的 handler

    S->>B: 响应页面 HTML（head 已注入 style.css）
    Note over B: 解析 CSS：background-image: url(...)<br/>命中布局根 → 触发资源加载
    B->>W: GET /dsh-chat-background/image.jpg
    W->>W: 查路由表（exact 命中）
    W->>H: 调用 handler(req, res)
    H->>H: readFile(图片文件)
    H-->>B: 200 + image/jpeg + 图片字节
```

### 注入样式

```ts
ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'style', text: STYLE })
})
```

`webserver/index-inject` 是 DSH 的「往页面里塞东西」事件：每次浏览器来要页面 HTML 之前，DSH 都会重新广播一次，`table` 是刚新建的空列表，各插件往里面 push 自己当前的行。我们 push 一条 `style`，内容就是 style.css 的全文，DSH 会把它渲染成 `<style>...</style>` 放进页面的 `<head>`。

`new URL('./style.css', import.meta.url)`：以插件源码文件自己的位置为基准找文件，不依赖你从哪个目录启动 DSH（这是比写相对路径更稳的写法）。

如果你问我为什么我知道是要监听`webserver/index-inject`这个事件？事实上我也不知道。写这个教程时，将 dsh 源码克隆下来放到目录中，AI 可以帮你解决一切。

## 样式表

```css
/* src/style.css */
/* 布局根（AppFrame.frame）铺一张背景图，同时覆盖侧边栏与聊天区 */
div:has(> [data-shell-overlay]) {
  background-image: url('/dsh-chat-background/image.jpg');
  background-size: cover;
}

/* 侧边栏列：局部置空 fill 变量，透出布局根背景 */
div:has(> [data-shell-overlay]) > div:first-child {
  --dsw-specific-sidebar-fill: transparent;
}

/* 聊天列容器（AppFrame 里含 main 槽位的那一列，自身背景是底色）：
   用 :has 定位那一列，不绑 CSS module 的哈希类名 */
div:has(> [data-shell-overlay]) > div:has([data-slot='main']) {
  background: transparent;
}

/* 会话根（ConversationMainPanel，自身带 data-phase）；conversation 那条
   留着兼容旧版槽位名 */
div:has(> [data-shell-overlay]) [data-slot='main'] > [data-phase],
div:has(> [data-shell-overlay]) [data-slot='conversation'] > [data-phase] {
  background: transparent;
}
```

## bundle 文件

### package.json

```json
{
  "name": "dsh-chat-background",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@deepseek-ai/cordis": "^4.0.1",
    "@deepseek-ai/dsh-host-webserver": "^0.2.0-rc.2"
  },
  "devDependencies": {
    "@types/node": "^24.0.0"
  },
  "dsh": {
    "bundle": {
      "patch": "./patch.yaml"
    }
  }
}
```

`@deepseek-ai/dsh-host-webserver` 是 DSH 的 web 服务包，前面写插件时说过——它负责提供 `ctx.webServer` 和 `webserver/index-inject` 的类型声明。装上它，代码里的类型才会齐全。

（前面提到的 `@deepseek-ai/dsh-host-frontend-static` 是另一个包，它在发行版组合里认领回退席位；本插件不需要它——页面文件由它返回给浏览器，我们只往表里 inject 一行样式。）

### patch.yaml

```yaml
- insert:
    - id: dsh-chat-background
      name: '/你的插件绝对路径/dsh-chat-background/src/dsh-chat-background.ts'
```

## 安装与验证

```bash
cd 你的插件目录
pnpm install          # 装上依赖（含 dsh-host-webserver）
dsh plugin --profile test add link:.
dsh --profile test --dump-config   # 插件树里应出现 dsh-chat-background
dsh --profile test --no-open       # 启动，web 端口 3080
```

---
