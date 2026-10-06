---
flowix_key: fl4tbsma
---

# dsh-event-timeline

《[事件进阶](../../../dsh%20插件开发学习/10-事件进阶.md)》的示例插件：把 DSH 真实派发过的
事件按发生顺序打到日志里，用来看**谁在谁之前**——也就是生命周期。

它只监听、不注册路由，所以 web 和 headless 都能用。

## 装

```bash
cd code/dsh_plugin/dsh-event-timeline && ./install.sh test
```

`install.sh` 会用本机绝对路径生成 `patch.yaml`（模板见 `patch.yaml.template`），
再把这个包加进 profile 的 `dsh.profile.bundles`。

## 看

```bash
# web：事件直接进控制台
dsh --profile test --no-open --port 3099

# headless：答案和事件都在 stdout，只想留事件就 grep
dsh headless '用 shell 执行 node -e "console.log(1+1)"' 2>/dev/null | grep dsh-event-timeline
```

一轮对话典型会按顺序出现这些行（相对启动的毫秒）：

```text
+  102ms dispatch  emit      session/created  this=有作用域  args=1
+  103ms dispatch  serial    agent/created  this=有作用域  args=1
+  104ms dispatch  emit      agent/status  this=有作用域  args=1
+  104ms · 记录 turn/start
+  105ms dispatch  waterfall agent/pre-step  this=有作用域  args=2
+  134ms dispatch  waterfall agent/request  this=有作用域  args=2
+  136ms dispatch  waterfall llm/stream  this=有作用域  args=2
+  845ms dispatch  waterfall tools/pre-execute  this=有作用域  args=2
+  845ms dispatch  waterfall tools/execute  this=有作用域  args=2
+  911ms dispatch  emit      tools/result  this=有作用域  args=2
+ 1559ms dispatch  serial    agent/turn-stopping  this=有作用域  args=1
+ 1560ms · 记录 turn/end
```

两条读法：

- `dispatch <mode>` 行来自 Cordis 内部事件 `internal/dispatch`，能看到**分发模式**和
  **有没有作用域载体**；`· 记录` 行来自 `session/event`，是**会话日志记录**，不是 Cordis 事件。
- 启动和退出时各会刷一屏 `internal/plugin`：那是插件树的建立与销毁，`uid` 非空为建立。

## 边界

- **统计看整进程**：本插件没有作用域标签，所有 agent、所有会话的事件都会进来。
- **`internal/dispatch` 是排查工具**，不是 harness 事件；别长期依赖它的输出格式。
- 事件集合与分发模式会随 DSH 版本变化（例如 `agent/session-start` 在部分版本不派发）。
  跨版本时以 `node_modules/@deepseek-ai/*` 的类型声明为准。

## 与其他示例的关系

09 篇的 [dsh-event-log](../dsh-event-log/) 负责"数事件、量耗时、挂 HTTP 路由"；
本包只干一件事——按顺序打印。两者互相独立，可以只装其中一个。
