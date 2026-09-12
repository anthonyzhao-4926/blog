---
title: profile 与插件包结构
date: 2026-09-12
tags:
  - ai
  - dsh
column: dsh-plugin
viewable: true
---

> 本文是知识卡，不用顺序读。装插件报错、想知道某个文件能不能手改、或者要弄清装配顺序时来查。

`~/.dsh/profiles/web` 是 web profile 的全部配置所在。本文按文件逐个说明：它是什么、由谁维护、什么情况下需要改、以及它们如何组合成一棵 Cordis 插件树。

## 目录总览

```
~/.dsh/profiles/
├── node_modules/          # 所有 profile 共享的依赖池（639 个软链，含 dsh 内核包）
├── dsh-tui/               # 另一个 profile（终端界面）
└── web/                   # ← 本篇主角：网页版 profile
    ├── package.json       # 我是谁 + 我要装哪些插件     ← 手写
    ├── cordis.yml         # 插件树根（空数组）          ← 别动
    ├── cordis.patch.yml   # 我的覆盖层（空数组）        ← 手写
    ├── pnpm-workspace.yaml# 包管理器策略                ← 手写
    ├── pnpm-lock.yaml     # 依赖锁定快照                ← 生成
    ├── node_modules/      # 已安装的依赖                ← 生成
    └── .dsh-module-fallback/  # 运行期回退解析目录      ← 生成（启动时重建）
```

一句话概括：**这个目录本身几乎没有业务代码，它全部的职责是"声明装配清单"**。真正的功能都在 `node_modules` 里的插件包中，由 DSH 启动时按顺序装配成一棵 Cordis 插件树。

## 逐文件说明

### `package.json`：装配清单

```json
{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {
    "dsh-better-sidebar": "^0.19.0",
    "<插件名>": "link:/绝对路径/到/插件目录"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-better-sidebar",
        "<某个本地开发的插件>"
      ]
    }
  }
}
```

四个字段，四层含义：

- `name`：profile 的名字，出现在日志里。注意它是 `dsh-profile-web`，而启动时要写 `--profile web`，两者不是同一个字符串。
- `private: true`：防呆，避免误发到 npm。
- `dependencies`：**物理上装哪些包**。这里有两种来源，要区分开：
  - `"dsh-better-sidebar": "^0.19.0"` —— 从 npm 仓库拉下来的第三方插件；
  - `"link:..."` —— 链到你自己的本地源码目录（所以改完插件源码，通常要重装或重启才生效）。
- `dsh.profile.bundles`：**逻辑上按什么顺序装配**。数组顺序 = patch 叠加顺序：先 `dsh-base`（内核：配置、生命周期、Agent 循环），再 `dsh-web-app`（HTTP 服务、前端静态资源、Web 会话外壳），然后才是业务插件。顺序很重要，后面讲守卫时会看到为什么。每装一个新插件，这个数组就长一项。

> 小技巧：加插件优先用 `dsh plugin --profile web add <插件来源>`，而不是手改这个文件。CLI 会同时维护 `dependencies` 和 `bundles` 两边；手工只改一边，就会出现"装了但没挂载"或"声明了但找不到包"。

### `cordis.yml`：插件树根

```yaml
# dsh profile root — an empty entry list. The tree is composed as patches:
# each bundle in package.json's dsh.profile.bundles, then cordis.patch.yml, then any
# --patch overlays. Edit cordis.patch.yml, not this file.
[]
```

它是"第 0 层"：一个**空的插件行列表**。所有插件都是通过 patch 一层层"贴"到这个空列表上的，而不是直接写在这里。文件里的注释已经把规则写明了，照做即可 —— **不要动这个文件**。

### `cordis.patch.yml`：profile 覆盖层

当前是空的 `[]`，但它是 profile 里**最该由你动**的文件。完整的合成顺序是：

```
空根（cordis.yml）
  ├─ @deepseek-ai/dsh-base       的 cordis.patch.yml
  ├─ @deepseek-ai/dsh-web-app    的 cordis.patch.yml
  ├─ dsh-better-sidebar          的 cordis.patch.yml
  ├─ 其他插件                     的 cordis.patch.yml
  ├─ ← 本文件（profile 自己的补丁）
  └─ 命令行 --patch 覆盖
```

想给某个插件加参数、临时关掉某一行、或者插一条自己的 entry，写这里。

当所有插件的特性patch后，我们还可以在这里最后对已经挂载的所有插件特性进行最后的修改。

比如换掉侧边栏内置终端的 shell：

```yaml
- insert:
    - id: better-sidebar
      name: 'dsh-better-sidebar'
      config:
        shell: /bin/zsh
        shellArgs:
          - --noprofile
          - --no-rc
```

⚠️ 一个常见的坑：**profile 自己的 `cordis.patch.yml` 属于"用户状态"，框架升级时可能被重写**。所以在这里手工写过的挂载行会莫名消失。正因如此，插件作者现在更推荐把挂载声明写进**插件包自带的 `cordis.patch.yml`**（见下文），让 `dsh plugin add / update` 自动补回来。如果两边都写了 `insert`，同一个插件会被挂载两次 —— 路由注册两遍，其中一份必然在竞争里失败，整棵树可能起不来。

### `pnpm-workspace.yaml`：包管理器策略

```yaml
packages:
  - .
nodeLinker: hoisted
autoInstallPeers: false
minimumReleaseAgeExclude:
  - dsh-better-sidebar@0.13.0
  - '@noob-stupid/dsh-plugin-console@0.3.15'
allowBuilds:
  node-pty: true
  protobufjs: true
```

五条设置各有用途：

| 配置                         | 作用                         | 为什么这么设                                                               |
| -------------------------- | -------------------------- | -------------------------------------------------------------------- |
| `packages: [.]`            | 单包工作区                      | profile 自己就是一个包                                                      |
| `nodeLinker: hoisted`      | 依赖**平铺**到顶层 `node_modules` | 插件之间要互相 `import`，扁平布局才好解析（pnpm 默认的隔离布局会让插件找不到 peer）                  |
| `autoInstallPeers: false`  | 不自动补 peer 依赖               | 避免 DSH 内核包被重复装一份，导致"两个实例"类诡异 bug                                     |
| `minimumReleaseAgeExclude` | 对指定包跳过"新版本冷静期"             | 刚发布的版本想立刻用                                                           |
| `allowBuilds`              | 只放行这两个包的安装脚本               | pnpm 默认拦截依赖的 postinstall；`node-pty` 要编译原生模块（终端功能），`protobufjs` 要生成代码 |

装插件时报 "Ignored build scripts"，八成就是这里没放行。

### `pnpm-lock.yaml`：依赖锁定快照

44KB，记录**整棵依赖树的精确版本 + 完整性哈希**，保证"今天装的和明天装的是同一套东西"。由 `pnpm install` 自动维护，**不要手改**。

### `node_modules/`：依赖安装目录

186 个顶层条目，但形态分三类，看懂了三类，排查问题会快很多：

| 形态 | 例子 | 含义 |
|---|---|---|
| 真实目录 | `dsh-better-sidebar/` | 从 npm 装下来的包，源码 + `lib/` 编译产物都在里面 |
| 指向本地源码的软链 | `<插件名> -> ../../../../<你的源码目录>/<插件目录>` | 用 `link:` 装的插件，改源码直接作用于这个路径 |
| 指向 fallback 的软链 | `zwitch -> .../.dsh-module-fallback/node_modules/zwitch` | 运行期回退解析，见下一节 |

另外两个子目录：

- `.pnpm/lock.yaml`：pnpm 自己的虚拟存储元数据（注意它和根目录的 `pnpm-lock.yaml` 是**两份不同的文件**）；
- `.bin/`：随依赖带进来的命令行工具（20 个），比如 `katex`、`marked`、`modlens` —— 这些不是给你用的业务命令，是插件构建时调用的。

### `.dsh-module-fallback/`：模块回退解析

先看现象：这个目录里的条目，**全部是指回本 profile `node_modules` 的软链**：

```
.dsh-module-fallback/node_modules/d3-format -> .../web/node_modules/d3-format
```

这不是自己指自己吗？不是，它解决的是一个很实际的问题：

> **Node 的模块解析是"从当前文件所在目录一路往上找 `node_modules`"。** 当插件源码不在 profile 目录里时（用 `link:` 装的插件，真实路径在别处），从它出发往上找，永远找不到 `~/.dsh/profiles/web/node_modules`。
>
> 回退目录就是给这条查找路径"接一根管子"：在插件需要解析依赖的位置放一层 `node_modules`，把每个依赖软链回 profile 的依赖池。既不复制文件，也不会出现两份版本不同的同一个包。

三个要点：

1. 它是**运行期状态**，不是安装产物 —— DSH 启动 profile 时按 `node_modules` 内容生成，`pnpm install` 之后通常也会重建。所以它不该被当成"源码"去提交或备份。
2. 它会**连带影响 `node_modules` 的形态**：很多包在顶层不是真实目录，而是指向 fallback 的软链。如果 fallback 目录被清掉、软链还留在原地，这些包就会变成断链（`ls` 报 `No such file or directory`）。我排查时就撞上过这个状态：当时 `web/node_modules` 顶层 77 个软链中有 100 个（含深层）指向已不存在的 `.dsh-module-fallback`，父级 `profiles/node_modules` 的 639 个软链里有 157 个同样断链。
3. 修复方式很简单：回到 profile 目录 `pnpm install`；下次 `dsh web` 启动时也会自动补齐。

## 插件包内部结构

profile 只是清单，插件的"实体"在 `node_modules/<插件名>`。以侧边栏插件 `dsh-better-sidebar@0.19.0` 为例：

```
dsh-better-sidebar/
├── package.json        # 关键在 dsh 字段（见下）
├── cordis.patch.yml    # 自带的挂载声明
├── lib/                # 编译产物：index.js（宿主）+ client.js（浏览器端）
├── src/                # TypeScript 源码（client/ 下是 React 组件）
├── scripts/            # install.sh / install.ps1 安装辅助
└── README.md           # 中文说明 94KB，功能文档很全
```

它的 `package.json` 里有 DSH 专属的 `dsh` 字段，这是插件能被"自动装配"的秘密：

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": {
    "inject": ["@deepseek-ai/dsh-client-ui-slots", "..."],
    "platform": "web"
  }
}
```

- `bundle.patch`：CLI 读到这个声明，就把包名追加进 `dsh.profile.bundles`；启动时把这份 patch 合进插件树 —— **一条命令完成"安装 + 挂载"，不用改 profile 任何文件**。
- `client.platform` / `client.inject`：告诉宿主"这个包有浏览器端代码，需要注入哪些前端依赖（slot、locale 等）"。

再看它自带的 `cordis.patch.yml`，里面藏了一个很精巧的设计：

```yaml
- insert:
    - id: better-sidebar
      name: 'dsh-better-sidebar'
      disabled: !!js "[...ctx.loader.entries()].some((e) => e.options.name === 'dsh-better-sidebar' && e.options.id !== 'better-sidebar' && !e.disabled)"
```

`!!js` 后面是一段**在加载时求值的表达式**：如果已经有**别的 entry**（比如某个聚合包）挂了同一个包，这一行就自动禁用自己。因为重复挂载会让 `/sidebar/api` 注册两次，直接 "duplicate prefix route" 把整棵树搞崩。这也解释了前面那句顺序要求：守卫只能看到**排在它前面**的行，所以聚合包必须排在它前面 —— 而 `dsh plugin add` 正好是往后追加，天然满足。

任何 DSH 插件都是这个结构：`package.json` 里声明 `dsh.bundle.patch`，自带的 `cordis.patch.yml` 里写一行 `insert: { id: ..., name: '<插件名>' }` 把自己挂上树；宿主端代码（`lib/index.js`）提供 HTTP 路由，客户端代码（`lib/client.js`）注册界面上的标签页或查看器。你自己写的插件只要照这个骨架填内容就能被自动装配。

## profile 对照：`dsh-tui`

```json
// profiles/dsh-tui/package.json
{
  "name": "dsh-profile-dsh-tui",
  "private": true,
  "dependencies": { "@deepseek-harness-tui/dsh-tui": "0.10.1" },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-harness-tui/dsh-tui"],
      "patchReload": "live"
    }
  }
}
```

结构一模一样（`dependencies` + `bundles` + 那五个文件），差别只在内容：界面包从 `dsh-web-app` 换成 TUI 包，并且多了一个 `patchReload: "live"` —— **改 patch 文件后热重载，不用重启**。web profile 没开这个，所以改了 `cordis.patch.yml` 记得重启 `dsh web`。

这也说明 profile 的设计意图就是"**一套内核，多套界面/插件集合，互不干扰**"。

## 文件维护速查表

| 文件/目录                                | 手改？  | 说明                             |
| ------------------------------------ | ---- | ------------------------------ |
| `package.json`                       | ✅ 可以 | 但优先用 `dsh plugin add`          |
| `cordis.patch.yml`                   | ✅ 推荐 | 覆盖配置、临时禁用、自定义 entry 都写这里       |
| `pnpm-workspace.yaml`                | ✅ 可以 | 装插件报错时才需要动                     |
| `cordis.yml`                         | ❌ 别动 | 空根，动了会破坏 patch 合成模型            |
| `pnpm-lock.yaml` / `.pnpm/lock.yaml` | ❌ 别动 | 由 pnpm 维护                      |
| `node_modules/`                      | ❌ 别动 | 由 pnpm 维护；软链断了就 `pnpm install` |
| `.dsh-module-fallback/`              | ❌ 别动 | 运行期自动生成                        |

## 常用命令

```sh
cd ~/.dsh/profiles/web

# 1. 依赖装好没 / 软链断没断
pnpm install

# 2. 谁挂了哪个插件（看 bundle 顺序）
node -e "console.log(require('./package.json').dsh.profile.bundles)"

# 3. 启动 web profile，观察插件树装配日志
dsh web          # 等价于 dsh --profile web

# 4. 某个包到底是真目录还是软链
ls -la node_modules/dsh-better-sidebar node_modules/.bin | head
```

## 要点

- `profiles/web` = **装配清单**，不是代码仓库：四个手写文件 + 三个生成物。
- 合成模型是"**空根 + 多层 patch**"：bundles 里每个插件的 patch → profile 自己的 `cordis.patch.yml` → 命令行 `--patch`。
- `dsh` 字段（`bundle.patch` / `client.platform`）让插件能"装完即挂载"，这是官方推荐的插件分发姿势；profile 里的手工挂载行是会被升级冲掉的旧姿势。
- `.dsh-module-fallback` 解决"插件不在 profile 目录里也能解析依赖"的问题，属于运行期状态，断了 `pnpm install` 即可。
