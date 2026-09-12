---
title: 挂到 gin 路由
date: 2026-03-25
tags: [go, mcp, ai]
column: golang-mcp
order: 4
viewable: true
---

> **读完这篇你能**：把 MCP 挂到 gin（或任何 HTTP 框架）的某个路由上。
>
> **前置**：[跑成 HTTP 服务](03-跑成HTTP服务.md)。

# 什么时候需要

`http.ListenAndServe(addr, handler)` 是「整个端口都给 MCP 用」。但实际项目里更常见的是这两种情况：

- 一个服务想对外提供多个 MCP 能力，各占一个路径。
- 公司已有 gin/echo/chi 框架的 HTTP 服务，MCP 只是其中一个接口。

两种都归结为同一件事：**`NewStreamableHTTPHandler` 返回的本来就是个标准 `http.Handler`，把它注册到路由上就行。**

# 改哪里

```go
// 之前：把整个端口交给 MCP
err := http.ListenAndServe(addr, handler)

// 现在：交给 gin，自己指定路径
r := gin.Default()
r.Any("/mcp", gin.WrapH(handler))
err := r.Run(addr)
```

`gin.WrapH` 负责把 `http.Handler` 适配成 `gin.HandlerFunc`，其他框架也都有对应的桥接函数。

**用 `Any` 而不是 `POST`。** 客户端调用工具确实走 POST，但 Streamable HTTP 协议里客户端还可能发 GET 来接收服务端主动推送的消息、发 DELETE 来结束会话。只注册 POST 时工具能调通，但那两条路径会 404。

# 完整代码

工具定义和 handler 都不变，只换 `main` 的启动部分：

```go
package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	const (
		host = "127.0.0.1"
		port = 8000
	)

	server := mcp.NewServer(&mcp.Implementation{
		Name:    "log-mcp",
		Version: "0.1.0",
	}, nil)

	// 注册工具：定义见 02-工具的参数.md
	mcp.AddTool(server, &mcp.Tool{
		Name:        "query_logs",
		Description: "按服务名和时间范围查询日志，可筛选日志级别",
		InputSchema: queryLogsInputSchema,
	}, queryLogsTool)

	handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
		return server
	}, nil)

	addr := fmt.Sprintf("%s:%d", host, port)
	r := gin.Default()
	r.Any("/mcp", gin.WrapH(handler))

	log.Printf("streamable HTTP MCP: http://%s/mcp", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
```

![连上 /mcp 调用工具](assets/1774421663753-517e1125-b496-434e-96de-39db01085d57.gif)

# 连上之后别忘了鉴权

MCP 走的是普通 HTTP，所以鉴权不用在 MCP 层面做——**在 `gin.WrapH` 外面再包一层中间件就行**，和普通接口完全一样。具体写法见[加一层 Bearer 鉴权](05-加一层Bearer鉴权.md)。

---

**下一篇**：[加一层 Bearer 鉴权](05-加一层Bearer鉴权.md)——只在本机玩的话可以跳过，直接去 [06](06-提供Resources知识库.md)。
