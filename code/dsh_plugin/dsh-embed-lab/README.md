# dsh-embed-lab

把 DSH 当成一个组件来用——不是往里加插件，而是从外面驱动它。

配套文章：[把 DSH 嵌进自己的应用](../../../dsh%20插件开发学习/31-把%20DSH%20嵌进自己的应用.md)

## 跑

```sh
./run.sh
```

它会先列出五个 profile 各自是什么，然后用其中最省事的一条（`headless`）跑一个真实任务，最后用手写的 JSON-RPC 客户端跟 `sdk` profile 对话一次。

## 五个 profile

| profile | 适合什么 | 关键点 |
| --- | --- | --- |
| `web` | 给人用 | 浏览器应用层，挂在 `dsh-base` 上 |
| `headless` | 一次性任务 | 命令行任务应用，跑完就退 |
| `sdk` | 你自己的程序要驱动它 | JSON-RPC over stdio，`dsh-base` + SDK 服务器 |
| `sdk-minimal` | 要最小依赖 | **不用 `dsh-base`**，由组合包给完整配置树 |
| `acp` | 已有支持 ACP 的客户端 | 仅面向自动化，没有人参与 |

选型的经验法则：**只想跑一件事就用 `headless`；要自己控制多轮对话就用 `sdk`；对面已经会说 ACP 就用 `acp`；嫌 `base` 装的东西太多就用 `sdk-minimal`。**

## 为什么 client.mjs 手写协议

因为协议本身很朴素：**JSON-RPC，按换行分帧**——一行一条消息。手写一遍能看到"从外面驱动"的真实样子：

1. 你 `spawn` 的是一个**真正的 dsh 进程**，带一个具名 profile；
2. 你发请求（带 `id`），收响应（同 `id`）；
3. 服务器主动推来的东西没有 `id`，是通知——会话事件、agent 状态变化、子 agent 完成都走这条路。

生产里用 `@deepseek-ai/dsh-sdk-client` 就行：它帮你起子进程（用**具名 profile 加有序 patch**）、管握手、把协议层消息摊成高层 API。Python SDK 用的是**同一种协议**，所以两边可以互换。

注意这个包**不创建开发者项目**——SDK 是一套驱动运行时的方式，不是一个脚手架。
