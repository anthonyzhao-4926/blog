# dsh-nav-kit

第 34 篇《长驻终端与代码导航》的配套 demo。一个包，两个插件，正好是那条 seam 的两侧：

| 插件 | 角色 | 依赖 |
| --- | --- | --- |
| `nav-kit-md-links` | LSP **提供方**：把 `[[笔记名]]` 当成符号 | `lsp`、`fs` |
| `nav-kit-terminal-journal` | 终端**消费方**：从有界 scrollback 里取一页 | `terminals`、`tools` |

## 为什么不是「从零写一个 PTY 后端」

仓库里那套已经写好的就绪轮询、有界缓冲与转义序列清理大约四百行，而且 `LocalPtySession`
这个类**不随包发布**——包的 `files` 只含 `lib/index.js` 与 `lib/types/**/*.d.ts`，
虽然每个包都声明了 `"./src/*"` 这个 exports 子路径，它在装好的包里指向不存在的文件。

所以仓库外的插件拿到的运行时面就等于 `lib/index.js` 里那几个导出：注册一个后端可以，
复用内置后端内部那套零件不行。这个 demo 因此只写两侧里最可能被写到的那一侧——
**消费**。

## 装法

```sh
./install.sh
```

它会做三件事：把 `patch.yaml` 里的 `/绝对路径/dsh-nav-kit` 换成本目录、装依赖、
再 `dsh plugin --profile test add link:.`。

## 装配前提

- `@deepseek-ai/dsh-lsp` 与 `@deepseek-ai/dsh-terminal` 都**不在 dsh 自带的那批包里**
  （终端那两个在 minimal 预设里，LSP 三个包全仓只在 e2b 的测试组合里出现过一次）。
  patch 里都自己插了。
- 如果你的 profile 已经用过 minimal 预设，删掉 `nav-kit-pty` / `nav-kit-pty-bash` 两行，
  否则后端会重复注册，加载期就抛。
- 受限沙箱模式下 `dsh-terminal-bash` 还需要执行世界里有一个 `ctx.sandbox` 提供方，
  否则创建会话时直接失败——它不会退回到不隔离的执行。

## 看什么

`terminal_journal` 的返回值里带了 `lineBegin` / `lineEnd` / `totalLines` 和一句截断提示。
这三个数是「相对最新一行」坐标系里的，翻页就是让 `offset` 加上上一页的行数。
它们存在的原因是：**终端输出的量级不可控**，所以写入、保留、读取三层各有一个字节上界。
