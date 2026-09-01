---
title: Claude可调用的工具
date: 2026-06-22
tags: [ai, claude]
column: claude-code
order: 2
viewable: true
---

## 可使用的工具

工具是使 Claude Code 成为代理的原因。没有工具，Claude 只能用文本回应。有了工具，Claude 可以采取行动：读取您的代码、编辑文件、运行命令、搜索网络并与外部服务交互。

![06a5fae76ddee62a330f818c15920e7c](../assets/06a5fae76ddee62a330f818c15920e7c.png)

内置工具通常分为五个类别，每个类别代表不同类型的代理能力。

| 类别         | Claude 可以做什么                                  |
| :----------- | :------------------------------------------------- |
| **文件操作** | 读取文件、编辑代码、创建新文件、重命名和重新组织   |
| **搜索**     | 按模式查找文件、使用正则表达式搜索内容、探索代码库 |
| **执行**     | 运行 shell 命令、启动服务器、运行测试、使用 git    |
| **网络**     | 搜索网络、获取文档、查找错误消息                   |
| **代码智能** | 编辑后查看类型错误和警告、跳转到定义、查找引用     |

### 📋 工具总览

Claude Code 提供以下内置工具，帮助理解和修改代码库。

| 工具 | 描述 | 需要权限 | 是否写工具 |
|------|------|--------|---------|
| **Agent** | 生成具有独立 context window 的 subagent 处理任务 | ❌ | 取决于子任务 |
| **AskUserQuestion** | 提出多选问题以收集需求或澄清歧义 | ❌ | ❌ |
| **Bash** | 在环境中执行 shell 命令 | ✅ | ✅ |
| **CronCreate** | 在当前会话中安排定期或一次性提示 | ❌ | ✅ |
| **CronDelete** | 按 ID 取消计划任务 | ❌ | ✅ |
| **CronList** | 列出会话中的所有计划任务 | ❌ | ❌ |
| **Edit** | 对文件进行精确字符串替换编辑 | ✅ | ✅ |
| **EnterPlanMode** | 切换到 Plan Mode 以在编码前设计方法 | ❌ | ❌ |
| **EnterWorktree** | 创建隔离的 git worktree 并切换到它 | ❌ | ✅ |
| **ExitPlanMode** | 提出计划以供批准并退出 Plan Mode | ✅ | ❌ |
| **ExitWorktree** | 退出 worktree 会话并返回原始目录 | ❌ | ✅ |
| **Glob** | 按名称模式查找文件 | ❌ | ❌ |
| **Grep** | 在文件内容中搜索模式（基于 ripgrep） | ❌ | ❌ |
| **ListMcpResourcesTool** | 列出已连接 MCP server 公开的资源 | ❌ | ❌ |
| **LSP** | 代码智能：跳转定义、查找引用、报告类型错误 | ❌ | ❌ |
| **Monitor** | 后台运行命令并将每行输出反馈给 Claude | ✅ | ❌ |
| **NotebookEdit** | 修改 Jupyter notebook 单元格 | ✅ | ✅ |
| **PowerShell** | 本地执行 PowerShell 命令 | ✅ | ✅ |
| **PushNotification** | 发送桌面或手机推送通知 | ❌ | ✅ |
| **Read** | 读取文件内容（支持文本、图像、PDF、Notebook） | ❌ | ❌ |
| **ReadMcpResourceTool** | 按 URI 读取特定 MCP 资源 | ❌ | ❌ |
| **RemoteTrigger** | 在 claude.ai 上创建、更新、运行和列出 Routines | ❌ | ✅ |
| **ScheduleWakeup** | 重新安排 self-paced `/loop` 的下一次迭代 | ❌ | ✅ |
| **SendMessage** | 向 agent team 队友发送消息或恢复 subagent | ❌ | ✅ |
| **ShareOnboardingGuide** | 上传 ONBOARDING.md 并返回共享链接 | ✅ | ✅ |
| **Skill** | 在主对话中执行可重用工作流 | ✅ | 取决于工作流 |
| **TaskCreate** | 在任务列表中创建新任务 | ❌ | ✅ |
| **TaskGet** | 检索特定任务的完整详细信息 | ❌ | ❌ |
| **TaskList** | 列出所有任务及其当前状态 | ❌ | ❌ |
| **TaskStop** | 按 ID 终止运行中的后台任务 | ❌ | ✅ |
| **TaskUpdate** | 更新任务状态、依赖项、详情或删除任务 | ❌ | ✅ |
| **TeamCreate** | 创建具有多个队友的 agent team | ❌ | ✅ |
| **TeamDelete** | 解散 agent team 并清理队友进程 | ❌ | ✅ |
| **ToolSearch** | 启用 tool search 时搜索并加载延迟工具 | ❌ | ❌ |
| **WaitForMcpServers** | 等待后台仍在连接的 MCP server 就绪 | ❌ | ❌ |
| **WebFetch** | 从 URL 获取内容并提取答案 | ✅ | ❌ |
| **WebSearch** | 执行网络搜索并返回结果标题和 URLs | ✅ | ❌ |
| **Workflow** | 运行动态工作流脚本协调多个 subagents | ✅ | 取决于工作流 |
| **Write** | 创建新文件或完全覆盖现有文件 | ✅ | ✅ |

---

### 🔧 核心工具详解

#### Bash 工具行为

执行 shell 命令，shell实在是太强大了，几乎可以替代任何工具，干任何事。

会话启动时，Claude就已经确定工作的目录范围，默认是启动会话的目录及其子目录。为避免claude影响到其他目录，关于工作目录有如下与认知不一致的特性。

- `cd` 命令仅在工作目录范围内有效
- 当cd到工作目录外时，会被自动重置到工作目录的根目录。
- Subagent 启动时的工作目录永远都是工作目录的根目录。

除默认工作目录外，还可以使用 `--add-dir` 启动参数、`/add-dir` 命令或设置中的 `additionalDirectories` 方式，添加其他路径到当前的工作目录。这部分额外添加进来的，同样属于工作目录范围，同样适用上述特性。

**权限规则格式**

```
Bash(npm run *)          # 命令模式匹配
Bash(docker build *)     # 通配符模式
```

---

#### Edit 工具行为

对文件进行精确字符串替换（不使用正则表达式）。Edit 工具使用需要满足前置条件：

**三个必要条件**

1. **必须先读取** - 当前对话中必须读过该文件
2. **精确匹配** - `old_string` 字符串必须完全匹配（空格/缩进不能差）
3. **唯一出现** - `old_string` 只能在文件中出现一次

如果出现多次，需要：
- 提供更长的字符串（包含周围上下文）
- 或设置 `replace_all: true` 替换所有

**满足读取要求的方式**

- 先使用 Read 工具
- 或先在 Bash 中运行：`cat`、`head`、`tail`、`sed -n 'X,Yp'`、`grep` 等单文件命令

**权限规则格式**

```
Bash(npm run *)          # 命令模式匹配
Bash(docker build *)     # 通配符模式
```

---

#### Write 工具行为

创建新文件或完全覆盖现有文件（不追加）。

**两个关键规则**

- 新文件：可直接创建
- 现有文件：必须先在对话中读过，才能覆盖

部分修改应使用 **Edit** 工具而不是 Write。

**权限规则格式**

```
Edit(/src/**)            # 注意：Write 的权限规则也是 Edit(...) 格式
```

---

#### Read 工具行为

读取文件内容并返回带行号的结果。

**支持的文件类型**

- 纯文本（返回行号 + 内容）
- 图像（PNG/JPG 等，作为视觉内容）
- PDF（短文件全读，超 10 页用 `pages` 参数）
- Jupyter Notebook（返回所有单元格及输出）

**分页方式**
- 超过token限制时，返回第一页 + 提示
- 使用 `offset` 和 `limit` 参数读取更多
- PDF：一次最多读 20 页

**权限规则格式**
```
Read(~/secrets/**)       # 路径模式匹配
Read(*.env)              # 阻止读取环境文件
```

---

#### Glob 工具行为

按名称模式查找文件。具体执行方式是遍历地柜遍历工作目录，查找符合条件的文件。

**语法**
```
**/*.js              # 递归所有深度的 .js 文件
src/**/*.ts          # src/ 下所有 .ts 文件  
*.{json,yaml}        # .json 或 .yaml 文件
```

**特性**
- 结果按修改时间排序
- 限制 100 个文件，达到上限时显示截断标志
- 默认不遵循 `.gitignore`配置的内容，也会对git 忽略的文件进行遍历（设置 `CLAUDE_CODE_GLOB_NO_IGNORE=false` 改为遵循）

---

#### Grep 工具行为

在文件内容中搜索模式（基于 ripgrep）。

**使用范围**
- Glob：按名称找文件
- Grep：在文件内找行

**特性**

- 遵循 `.gitignore`（被忽略的文件跳过）
- 支持正则表达式元字符（需转义）
- 直接传递路径可搜索 gitignore 的文件

---

#### LSP 工具行为

**Language Server Protocol（语言服务器协议）** — 一种标准协议，让编辑器/工具能获得"懂代码"的能力，比如 VS Code 的代码补全、报错提示都依赖它。

**被动模式（自动触发）**

每次 Claude 编辑文件后，LSP 工具自动检查：
- 有没有类型错误？
- 有没有警告？

Claude 可以直接根据这些反馈修复问题，**不需要你手动运行构建命令**（如 `tsc`、`cargo build`）。

**主动模式（Claude 主动调用）**

Claude 可以用它来理解代码结构：

| 功能 | 类比 |
|------|------|
| 跳转到定义 | VS Code 的 `F12` |
| 查找所有引用 | VS Code 的 `Shift+F12` |
| 获取类型信息 | 鼠标悬停时的类型提示 |
| 列出文件中的符号 | 文件大纲视图 |
| 查找接口实现 | `Go to Implementation` |
| 追踪调用层次 | Call Hierarchy 视图 |

**前置条件**

需要两步才能启用：
1. 安装对应语言的 **code intelligence plugin**（提供配置），安装插件详见 [官方 Anthropic 市场](https://code.claude.com/docs/zh-CN/discover-plugins#%E5%AE%98%E6%96%B9-anthropic-%E5%B8%82%E5%9C%BA)
2. 单独安装对应的 **语言服务器二进制文件**，

| 语言       | 插件                | 所需二进制文件               |
| :--------- | :------------------ | :--------------------------- |
| C/C++      | `clangd-lsp`        | `clangd`                     |
| C#         | `csharp-lsp`        | `csharp-ls`                  |
| Go         | `gopls-lsp`         | `gopls`                      |
| Java       | `jdtls-lsp`         | `jdtls`                      |
| Kotlin     | `kotlin-lsp`        | `kotlin-language-server`     |
| Lua        | `lua-lsp`           | `lua-language-server`        |
| PHP        | `php-lsp`           | `intelephense`               |
| Python     | `pyright-lsp`       | `pyright-langserver`         |
| Rust       | `rust-analyzer-lsp` | `rust-analyzer`              |
| Swift      | `swift-lsp`         | `sourcekit-lsp`              |
| TypeScript | `typescript-lsp`    | `typescript-language-server` |

可以先使用 `which gopls`查看是否安装了gopls，其他语言同理。

---

#### Agent 工具行为

创建独立的 subagent，具有自己的 context window。

**工作流**

1. Subagent 自主完成任务
2. 返回单个文本结果
3. 父对话看不到中间工具调用

**工具访问控制**

根据 subagent 定义中的 `tools` 和 `disallowedTools`：

| 情况 | 行为 |
|------|------|
| 都未设置 | 继承父对话全部工具 |
| 仅设置 `tools` | 仅获得列出的工具 |
| 仅设置 `disallowedTools` | 获得除了列出外的所有工具 |
| 都设置 | `disallowedTools` 优先 |

详见 Agent 与 Subagent

**权限**

- 启动 subagent 无需提示
- 工具调用在运行时根据权限规则检查
- 前台 subagent：显示权限提示
- 后台 subagent：使用已授予权限，自动拒绝需提示的调用

---

#### Skill 工具行为

执行可重用的基于提示的工作流（不添加新工具）。

**权限规则格式**
```
Skill(deploy *)          # Skill 名称匹配
Skill(tdd:*)             # 支持通配符
```

---

#### WebFetch 工具行为

从 URL 获取内容并提取答案。

**工作流程**

1. 获取 URL
2. HTML 转 Markdown
3. 使用小模型针对提示运行提取

**特性**
- HTTP 自动升级到 HTTPS
- 大页面截断到字符限制
- 15 分钟缓存
- 跨域重定向时返回提示（需第二次 WebFetch）
- 设置 `User-Agent` 和 `Accept` 头优先 Markdown

**权限规则格式**
```
WebFetch(domain:example.com)  # 域名匹配
```

**注意**
- 有损设计：提取提示决定了 Claude 接收的内容
- 具体的提示能获得更好结果

---

#### WebSearch 工具行为

执行网络搜索并返回结果。

**工作流程**
1. 查询搜索后端
2. 返回标题和 URLs
3. 不获取结果页面本身

**搜索优化**
- 内部最多 8 次后端查询优化搜索
- `allowed_domains`：仅包含某些主机
- `blocked_domains`：排除某些主机
- 两个列表不能组合使用

**权限规则格式**

```
WebSearch    # 仅接受裸工具名称，无 specifier
```

---

#### Workflow 工具行为

协调多个 subagents 并返回统一结果。

**核心概念**

- 运行动态工作流脚本
- 在后台协调许多 subagents
- 返回综合结果
