---
title: mcp-streamable-http-options
date: 2026-03-30
tags: [go, mcp, ai]
column: golang-mcp
order: 5
viewable: true
---

本文说明 `github.com/modelcontextprotocol/go-sdk/mcp` 包中 `StreamableHTTPOptions` 结构体各字段含义及使用要点。该结构体用于配置 `StreamableHTTPHandler`，即 MCP **Streamable HTTP** 传输的服务端入口。

## 总体作用

`NewStreamableHTTPHandler(getServer, opts)` 在 `opts != nil` 时会将 `*opts` 拷贝进 handler，用于控制：

- 有状态 / 无状态会话模型

- 响应为 SSE 还是单次 JSON

- 结构化日志

- 断线后基于 `Last-Event-ID` 的流重放

- 空闲会话自动关闭

- Localhost 反 DNS 重绑定与跨源策略

## 字段说明

```go
// StreamableHTTPOptions configures the StreamableHTTPHandler.
type StreamableHTTPOptions struct {
	Stateless bool
	JSONResponse bool
	Logger *slog.Logger
	EventStore EventStore
	SessionTimeout time.Duration
	DisableLocalhostProtection bool
	CrossOriginProtection *http.CrossOriginProtection
}
```

### Stateless

- **默认**`false`：标准有状态模式。客户端携带 `Mcp-Session-Id`，服务端校验并复用同一逻辑会话（`ServerSession` / `StreamableServerTransport`）。

- `true`：无状态模式：

- 不校验 `Mcp-Session-Id`；

- 使用临时会话与默认初始化参数；

- **服务端发往客户端的请求（server→client request）无法让客户回包，会被立即拒绝**；

- 在**处理某次入站请求的上下文内**发出的 server→client **通知**仍可能随该次响应到达客户端（详见 `StreamableServerTransport` 文档）。

适用于仅需工具调用、无需完整双向 MCP 的简单部署。SDK 在 `streamable_server.go` 中说明：每次请求临时会话，请求结束后关闭。

### JSONResponse

控制 **POST** 响应体格式（参见 MCP 规范「向服务端发送消息」相关章节）：

| 取值 | Content-Type | 说明 |
| --- | --- | --- |
| `false`（默认） | `text/event-stream` | SSE，在流里先后发多条服务端消息，最终包含这次request 的 JSON-RPC response，即请求处理过程中可承载服务端主动消息 |
| `true` | `application/json` | 单次 JSON，更简单；流式能力弱，部分场景下服务端消息走独立 SSE |

### Logger

- 非 `nil`：使用给定 `slog.Logger` 记录相关日志。

- `nil`**：不记录日志**（并非默认 stdout）。

### EventStore 断点续传

在 MCP Go SDK（StreamableHTTPOptions.EventStore）里，EventStore 是一个接口：用来给 Streamable HTTP 的 SSE 流做事件落盘/缓存，从而在断线后按 Last-Event-ID 续传、重放还没被客户端收到的消息。

没有 EventStore：连接断了，中间发过的事件一般没法按规范可靠地「从上次那条 SSE 事件接着播」。

有 EventStore（例如自带的 NewMemoryEventStore(nil)）时，典型生命周期是：

- 新开一条逻辑流 → Open  
- 每往流里写一段数据 → Append 
- 客户端带着 Last-Event-ID 来 GET 恢复 → After 用来按序号迭代重放后面的数据 
- 会话结束 → SessionClosed，可做清理

小结：EventStore = 可插拔的「SSE 事件存储 + 重放」后端；内存实现适合单机/演示，生产可以换成 Redis 等满足同一接口的实现。

例子见 [[端点续传]]

### SessionTimeout

- **非零**：会话在**连续空闲**超过该时长后自动关闭（实现会对进行中的 POST 做引用计数，避免误关）。

- **零值**：不因空闲自动关闭（仍可通过 DELETE 等方式结束会话）。

用于控制资源与内存占用。

### DisableLocalhostProtection

默认启用 **本地反 DNS 重绑定**：从 `127.0.0.1` / `[::1]` 接入时，若 `Host` 非本机形态，返回 **403**，降低恶意网页将解析指向本机后访问本地 MCP 的风险。

DNS 重绑定在干什么?

> 浏览器有 **同源策略**：网页上的 JS 一般只能向「与它来源一致」的主机发请求（协议 + 主机名 + 端口）。
>
> 攻击者控制的域名叫例如 `evil.com`。典型流程：
>
> 1. 用户打开 `http://evil.com`（HTTPS 同理）。
> 2. **首次解析**：`evil.com` → **公网 IP**（攻击者服务器）。页面从公网加载，**源（origin）为**`http://evil.com`。
> 3. 页面内 JS 再请求 `http://evil.com:8080/...`，浏览器仍视为 **同源**，允许发送。
> 4. 攻击者对 DNS 做手脚，使 `evil.com`**在短时间内改解析结果**，例如改为 `127.0.0.1` 或内网 `192.168.x.x`。常见手法包括：
>
> - DNS 记录 **TTL 极短**；
> - 同一域名在不同查询下返回不同地址（视解析器行为而定）；
> - 多 A 记录等，让客户端「第二轮解析」拿到回环或内网地址。
>
> 1. JS 请求的仍是 **主机名**`evil.com`（同源未变），但 TCP 实际连到 **本机或内网**。
>
> **结果**：在浏览器眼中仍是同源请求，却能打到 **本仅期望本机访问的 HTTP 服务**（如仅监听 `127.0.0.1`、未鉴权的调试或 MCP HTTP 端口等）。
>
> 要点：**不是伪造 TCP**，而是用「仍是 `evil.com`」的语义，在 IP 层把流量转到本机或内网。

**本地反 DNS 重绑定**：依赖 **Host 校验、强鉴权、减少裸露 HTTP localhost、优先 stdio/Unix socket** 等，**不要**假设「监听 `127.0.0.1` 就只有自己会连」。

参考：[MCP security best practices - local MCP server compromise](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices#local-mcp-server-compromise)。

### CrossOriginProtection

类型为 `*http.CrossOriginProtection`，用于自定义跨源行为。

- `nil`：`NewStreamableHTTPHandler` 会设为 `&http.CrossOriginProtection{}`（默认零值策略）。

什么是跨源？

> 1. 用户已打开银行或管理后台，Cookie 里带着登录态。
> 2. 用户又打开了攻击者页面 evil.com。
> 3. 页面里自动提交表单或发 fetch：请求发到银行转账接口，浏览器会 自动带上该站的 Cookie。
> 4. 银行若 没有额外校验（例如 CSRF Token、严格的 Origin/Referer、SameSite Cookie 等），就可能 按用户身份执行转账等操作。
>
> 要点：不是偷 Cookie，而是 借用浏览器「已有 Cookie」自动附带请求」这一行为，在用户当前浏览器会话仍有效时完成「伪造用户意图」的请求。

## 参考链接

- Streamable HTTP 传输（规范）：[Model Context Protocol - Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http)

- 响应格式（规范节选）：[Sending messages to the server](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#sending-messages-to-the-server)
