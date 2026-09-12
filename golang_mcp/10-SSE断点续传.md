---
title: SSE 断点续传
date: 2026-03-25
tags: [go, mcp, ai]
column: golang-mcp
order: 10
viewable: true
---

> **这篇不影响主线。** 等真的部署到公网、遇到「SSE 断线丢消息」了再回来看。

# 为什么需要 EventStore

[Streamable HTTP](03-跑成HTTP服务.md) 里，服务端往下推消息走的是 SSE 长连接。网络一抖连接断了，那些还没发出去的事件就丢了。

协议里的解法是给事件编号：客户端重连时带上 `Last-Event-ID`，服务端把断点之后的事件重新放一遍。

想支持这个，服务端就必须把发过的事件存下来，这正是 `EventStore` 的职责。它是 `mcp.StreamableHTTPOptions.EventStore` 字段，一个接口，SDK 允许你用自己的实现。

# 默认实现：MemoryEventStore

SDK 自带一个 `NewMemoryEventStore(nil)`，把事件存在内存里，单机演示开箱即用：

```go
eventStore := mcp.NewMemoryEventStore(nil)
options := &mcp.StreamableHTTPOptions{
	EventStore: eventStore,
}
handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
	return server
}, options)
```

**生产环境一般要换成 Redis 之类的持久化实现**——单机的内存存储意味着：多实例部署时客户端重连可能落到另一台机器上，取不到事件；进程重启事件就全丢了。

自己实现下面这个接口就行。

# 接口就四个方法

```go
type EventStore interface {
	Open(_ context.Context, sessionID, streamID string) error
	Append(_ context.Context, sessionID, streamID string, data []byte) error
	After(_ context.Context, sessionID, streamID string, index int) iter.Seq2[[]byte, error]
	SessionClosed(_ context.Context, sessionID string) error
}
```

对应一条 SSE 流的完整生命周期：

- **Open**：一条新流要开始写事件了，先把底层结构准备好（内存分桶、文件、目录都行）。同一对 `(sessionID, streamID)` 可能被重复 Open，实现要能扛住——内存实现的做法是懒初始化 map。
- **Append**：每发一段事件就把原始字节追加存下来。要保证顺序，重放才有意义；同时得自己管容量——配个上限、淘汰策略或 TTL，别指望清理全靠 `SessionClosed`。
- **After**：客户端重连时调用，按顺序把 index 之后的事件取出来。有一条硬性约定：**如果中间的数据已经被淘汰丢弃了，必须立刻返回 error，不能只给一部分**——否则客户端会以为没有丢，状态就错乱了。
- **SessionClosed**：整个会话结束，可以把该会话的数据清掉了。注意它**不一定会被调**（进程崩溃、客户端消失都会跳过），所以超时淘汰这些自愈手段还是得有。

踩坑点基本都在注释里，实现前建议把 [event.go 的源码注释](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp#EventStore)读一遍，它把边界情况说得很清楚。

---

**主线到此结束。** 中间跳过的可以回头补：[挂到 gin 路由](04-挂到gin路由.md)、[加一层 Bearer 鉴权](05-加一层Bearer鉴权.md)、[提供 Resources 知识库](06-提供Resources知识库.md)。
