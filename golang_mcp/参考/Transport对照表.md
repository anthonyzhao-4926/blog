---
title: MCP 的 Transport
date: 2026-03-25
tags: [go, mcp, ai]
column: golang-mcp
order: 2
viewable: true
---

依赖 `github.com/modelcontextprotocol/go-sdk v1.4.1`(见 [pkg.go.dev/mcp](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp)),下面各段代码都是可以独立编译的 main 骨架,按需挑一种场景即可。

# 先搞清楚概念:传输其实只有两种

平时聊天总说「stdio、HTTP、SSE 三种传输」,其实是把概念混在一起了。MCP 官方标准里的传输就两种:

1. **stdio**——客户端把服务端当子进程拉起来,往 stdin 写 JSON-RPC 消息、从 stdout 读,一行一条,所以消息体里不能有裸换行。日志走 stderr,千万别往 stdout 打,否则客户端解析直接乱掉。典型场景是本机 IDE(Cursor 之类)连本地服务:不暴露端口,也没有 Origin/CORS 这些麻烦。
2. **Streamable HTTP**——服务端就是一个普通 HTTP 服务。客户端每次 POST 一条 JSON-RPC 消息,响应可能是普通 JSON,也可能是 SSE 流;服务端想主动往下推消息时,客户端可以另开一条 GET 的 SSE 连接,会话用 `MCP-Session-Id` 绑定。服务跑在服务器上供远程访问时用这个。

那 SSE 算什么?它并不是第三种传输,只是 HTTP 的一种响应形式(`text/event-stream`),服务端靠它把多条消息一条条推给客户端——可以理解成 Streamable HTTP 内部的一种机制。

规范上的细节(消息怎么分帧、响应怎么约定、会话怎么续传)我不在这里铺开,可以看 [MCP Transports 规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports.md),下面主要说代码怎么搭。

# 本机进程:StdioTransport

服务端启动姿势,给 IDE 这类本地宿主用。

```go
package main

import (
	"context"
	"log"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	s := mcp.NewServer(&mcp.Implementation{Name: "demo", Version: "1.0"}, nil)
	// … AddTool / AddResource 等
	if err := s.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
		log.Fatal(err)
	}
}
```

# 客户端拉起子进程:CommandTransport

客户端这边用 `exec.Cmd` 把上面那个进程拉起来,对端用的就是 StdioTransport。

```go
package main

import (
	"context"
	"log"
	"os/exec"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	ctx := context.Background()
	c := mcp.NewClient(&mcp.Implementation{Name: "host", Version: "1.0"}, nil)
	t := &mcp.CommandTransport{
		Command: exec.CommandContext(ctx, "./my-mcp-server"), // 或 go run 你的代码路径
	}
	sess, err := c.Connect(ctx, t, nil)
	if err != nil {
		log.Fatal(err)
	}
	defer sess.Close()
	// sess.CallTool / ListTools …
}
```

# 单测与同进程调试:InMemoryTransport

`NewInMemoryTransports()` 返回一对互通的 transport,连上之后完全走内存,不用真起进程和端口,写测试或演示很方便。注意顺序:先让 server 连,再连 client。

```go
package main

import (
	"context"
	"log"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	ctx := context.Background()
	server := mcp.NewServer(&mcp.Implementation{Name: "s", Version: "1"}, nil)
	client := mcp.NewClient(&mcp.Implementation{Name: "c", Version: "1"}, nil)

	ts, tc := mcp.NewInMemoryTransports()
	ss, err := server.Connect(ctx, ts, nil)
	if err != nil {
		log.Fatal(err)
	}
	defer ss.Close()

	cs, err := client.Connect(ctx, tc, nil)
	if err != nil {
		log.Fatal(err)
	}
	defer cs.Close()
	_ = cs // cs.ListTools …
}
```

# 调试利器:LoggingTransport

把它包在任何 transport 外面,收发的消息会被抄一份到 `io.Writer`(调试时写 `os.Stderr` 就行),排查协议问题特别好用。用法就是在 NewClient 时把 Transport 字段换成包了一层的东西,一行代码的事,不单独给骨架了。

# 跑成 HTTP 服务:StreamableHTTPHandler + StreamableClientTransport

服务端把 MCP server 包装成 http.Handler,注册进你自己的 HTTP 服务;客户端把 MCP endpoint 的 URL 填进 `StreamableClientTransport`。下面用 httptest 把两端串起来演示,实际部署时服务端就是普通的 `http.ListenAndServe`。

```go
package main

import (
	"context"
	"log"
	"net/http"
	"net/http/httptest"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	// 服务端:包成 http.Handler
	ctx := context.Background()
	srv := mcp.NewServer(&mcp.Implementation{Name: "http-srv", Version: "1"}, nil)

	h := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return srv }, nil)
	ts := httptest.NewServer(h)
	defer ts.Close()

	// 客户端:填 endpoint URL
	c := mcp.NewClient(&mcp.Implementation{Name: "http-cli", Version: "1"}, nil)
	t := &mcp.StreamableClientTransport{Endpoint: ts.URL}
	sess, err := c.Connect(ctx, t, nil)
	if err != nil {
		log.Fatal(err)
	}
	defer sess.Close()
	// sess.CallTool …
}
```

完整的服务端例子(带工具、监听端口)见 [Streamable HTTP](Streamable%20HTTP.md),注册到 gin 等框架的路由见 [配置路由](配置路由.md)。

# 旧版 HTTP + SSE:SSEHandler / SSEClientTransport

这是 2024-11-05 那版规范(HTTP + SSE 双端点)的实现,接口和上面长得差不多:服务端用 `NewSSEHandler`,客户端 `SSEClientTransport` 填 SSE 根 URL(GET 开流,之后 POST 到 `endpoint` 事件给出的地址)。现在只在新项目兼容存量服务时才用得上,有个坑值得记一下:`SSEServerTransport` 是服务端在处理某次 HTTP GET 时由 handler 创建的,所以它只能被 `Connect`,不能对它调 `Run`。

# 什么时候才需要 StreamableServerTransport

这个类型是给「自己处理 http.Request、自己按会话建 transport」的进阶场景用的。绝大多数项目用上一节的 `NewStreamableHTTPHandler` 就够,会话和路由它都封装好了,没必要手写这个类型。

# 一张表记住怎么配

| 场景 | 服务端 | 客户端 |
| --- | --- | --- |
| 本机进程(IDE 用) | `StdioTransport` + `Server.Run` | `CommandTransport` |
| 远程 HTTP(推荐) | `NewStreamableHTTPHandler` | `StreamableClientTransport` |
| 单测 / 同进程 | `InMemoryTransport`(一对) | 另一根 |
| 调试验证 | 包一层 `LoggingTransport` | 同左 |
| 存量旧版 HTTP+SSE | `NewSSEHandler` | `SSEClientTransport` |

# Run 还是 Connect

启动 server 有两种姿势:`Server.Run(ctx, transport)` 和 `Server.Connect(ctx, transport, opts)`。区别在于 Run 要求传输是「天生就绪、持久」的——StdioTransport 就是典型,进程一启动管道就在那儿了;HTTP 系的两个 handler 则是在收到入站请求时才现场创建一个 transport 并 Connect,会话跟着请求走,所以它们没有"Run"一说。go-sdk 里 transport 相关的结构体一共九个(三个服务端套件拆开算),看着多,拆开就上面这几类,拿不准就照例子的姿势写。
