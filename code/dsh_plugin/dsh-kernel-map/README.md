# dsh-kernel-map

第 36 篇《给 DSH 提 PR》的配套 demo。它演示一件比「读懂内核」更可操作的事：
**内核里有一部分是机械生成的，所以插件可以依赖它。**

`docs/event-producer-consumer.md` 由 `scripts/gen-doc-graphs.ts` 用仓库的 TypeScript
Program 解析出来，每行带一个 `路径:行号` 指针和分发模式。这个插件把那份文档读成
一个只读工具和一个 HTTP 报告面。

## 装法

```sh
DSH_REPO_ROOT=/path/to/deepseek-harness ./install.sh
```

不设 `DSH_REPO_ROOT` 时它去找仓库里自带的 `local/deepseek-harness`。

## 为什么不用 `tool-cordis`

`@deepseek-ai/dsh-tool-cordis` 也把内核 API 目录暴露成工具，但它的 `files` 只发
`lib/index.js` 与 `lib/types/**/*.d.ts`——源码不进包，导出的那份目录数据不能被树外
插件按子路径 import。而且 `code/dsh_plugin/dsh-self-cordis/` 已经占掉了这条路。

这里走的是另一条同样「读懂内核」的路：读生成物。

## 三个门禁事实

| 事实 | 依据 |
| --- | --- |
| 生成型文档不许手改，改法只有「改源码或生成器再跑 `gen-*`」 | `docs/module-graph.md`、`docs/event-producer-consumer.md` 首行的 `do not edit by hand` |
| 「生成物过期」的文案不统一，别记固定后缀，记「跑它提示的那条 `gen-*`」 | `scripts/gen-module-graph.ts` / `gen-tool-catalog.ts` / `gen-config-catalog.ts` 各自的报错模板 |
| 手抄目录被文档规范点名为 slop | `docs/AGENTS.md` 的 slop 清单 |

## 看什么

装完以后问模型「DSH 里有哪些 waterfall 事件」。答案里的每一行都带 `路径:行号`——
在检出目录里改一行源码、重新生成，行号跟着变。

这就是「读生成物」相对「抄一份清单」的全部差别。
