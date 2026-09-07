---
title: Go MCP SDK：各 Transport 用法示例
date: 2026-03-25
tags: [go, mcp, ai]
column: golang-mcp
order: 2
viewable: true
---

依赖：`github.com/modelcontextprotocol/go-sdk v1.4.1`（见 [pkg.go.dev/mcp](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp)）。

以下均为**可独立编译的**`main`**骨架**，按需只保留一种 `Transport` 场景即可。

---

# 服务端 Transport

## 1. `StdioTransport`（服务端：当前进程 stdin/stdout）

本地 MCP 宿主（如 IDE）拉起进程后，通过管道与 **stdin/stdout** 通信。

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

---

## 2. `CommandTransport`（客户端：拉起子进程）

客户端 `exec.Cmd`**启动**已编译好的 MCP 可执行文件（对方使用 `StdioTransport`）。

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
        Command: exec.CommandContext(ctx, "./my-mcp-server"), // 或 `go`, `run`, `./cmd/server`
    }
    sess, err := c.Connect(ctx, t, nil)
    if err != nil {
        log.Fatal(err)
    }
    defer sess.Close()
    // sess.CallTool / ListTools …
}
```

---

## 3. `InMemoryTransport`（客户端&服务端：测试 / 同进程）

用 `NewInMemoryTransports()` 得到一对互通的 Transport。**先接 Server，再接 Client**。

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

---

## 4. `IOTransport`（客户端&服务端：任意 `io.ReadCloser` + `io.WriteCloser`）

与 **一对双工管道**配合：一侧的「读」接对端的「写」。

```go
package main

import (
    "context"
    "io"
    "log"

    "github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
    ctx := context.Background()

    // A→B：cr 读 / cw 写；B→A：sr 读 / sw 写
    ar, bw := io.Pipe()
    br, aw := io.Pipe()

    serverT := &mcp.IOTransport{Reader: ar, Writer: aw}
    clientT := &mcp.IOTransport{Reader: br, Writer: bw}

    s := mcp.NewServer(&mcp.Implementation{Name: "s", Version: "1"}, nil)
    c := mcp.NewClient(&mcp.Implementation{Name: "c", Version: "1"}, nil)

    ss, err := s.Connect(ctx, serverT, nil)
    if err != nil {
        log.Fatal(err)
    }
    defer ss.Close()

    cs, err := c.Connect(ctx, clientT, nil)
    if err != nil {
        log.Fatal(err)
    }
    defer cs.Close()
    _ = cs
}
```

---

## 5. `LoggingTransport`（装饰器：打印收发 JSON-RPC）

包在**已有 Transport 外**，把消息抄到 `io.Writer`（调试时常用 `os.Stderr`）。

```go
package main

import (
    "bytes"
    "context"
    "fmt"
    "log"
    "slices"
    "strings"

    "github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
    ctx := context.Background()
    ts, tc := mcp.NewInMemoryTransports()
    s := mcp.NewServer(&mcp.Implementation{Name: "s", Version: "1"}, nil)
    if _, err := s.Connect(ctx, ts, nil); err != nil {
        log.Fatal(err)
    }

    var buf bytes.Buffer
    wrapped := &mcp.LoggingTransport{Transport: tc, Writer: &buf}
    c := mcp.NewClient(&mcp.Implementation{Name: "c", Version: "1"}, nil)
    cs, err := c.Connect(ctx, wrapped, nil)
    if err != nil {
        log.Fatal(err)
    }
    defer cs.Close()
    _ = cs

    for _, line := range slices.Sorted(strings.SplitSeq(buf.String(), "\n")) {
        if line != "" {
            fmt.Println(line)
        }
    }
}
```

---

## ❌6. `SSEHandler` + `SSEClientTransport`（旧版 HTTP + SSE，2024-11-05）

服务端用 `NewSSEHandler`；客户端连 **SSE 根 URL**（GET 开流，随后 POST 到 `endpoint` 事件给出的地址）。

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
    ctx := context.Background()
    srv := mcp.NewServer(&mcp.Implementation{Name: "sse-srv", Version: "1"}, nil)

    h := mcp.NewSSEHandler(func(*http.Request) *mcp.Server { return srv }, nil)
    ts := httptest.NewServer(h)
    defer ts.Close()

    c := mcp.NewClient(&mcp.Implementation{Name: "sse-cli", Version: "1"}, nil)
    t := &mcp.SSEClientTransport{Endpoint: ts.URL}
    sess, err := c.Connect(ctx, t, nil)
    if err != nil {
        log.Fatal(err)
    }
    defer sess.Close()
    // sess.CallTool …
}
```

说明：`SSEServerTransport` 通常由 `SSEHandler` 在每次 GET 时创建；除非自制路由，否则不必直接使用 `SSEServerTransport`。

---

## ✅7. `StreamableHTTPHandler` + `StreamableClientTransport`（推荐：Streamable HTTP）

服务端：**同一 MCP 路径**上处理 **POST**（及规范允许的 **GET/DELETE**）。客户端填 **MCP 端点 URL**。

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
    // 服务端代码
    ctx := context.Background()
    srv := mcp.NewServer(&mcp.Implementation{Name: "http-srv", Version: "1"}, nil)

    h := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return srv }, &mcp.StreamableHTTPOptions{
        JSONResponse: true, // 示例：纯 JSON、无 SSE，便于 curl/打印；生产可改为 false
    })
    ts := httptest.NewServer(h)
    defer ts.Close()

    // 客户端代码
    c := mcp.NewClient(&mcp.Implementation{Name: "http-cli", Version: "1"}, nil)
    t := &mcp.StreamableClientTransport{
        Endpoint:             ts.URL,
        DisableStandaloneSSE: true, // 与 JSONResponse 搭配；需服务端主动下行时再设为 false
    }
    sess, err := c.Connect(ctx, t, nil)
    if err != nil {
        log.Fatal(err)
    }
    defer sess.Close()
    // sess.CallTool …
}
```

---

## ✅8. `StreamableServerTransport`（进阶：自带 HTTP 路由时）

一般 `StreamableHTTPHandler`**已封装会话与路由**。只有当你**自己处理**`http.Request`、为每个会话创建一个 transport 并 `Server.Connect` 时，才直接持有 `StreamableServerTransport`（需阅读 [类型文档](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp#StreamableServerTransport) 中与 `ServeHTTP`、SessionID、`EventStore` 的约定）。**多数项目用上一节的 Handler 即可，无需手写本类型。**

---

## 对照小结

| 场景 | 服务端 | 客户端 |
| --- | --- | --- |
| 本机进程管道 | `StdioTransport` + `Server.Run` | `CommandTransport` |
| 单测/同进程 | `InMemoryTransport`（一对） | 另一半 |
| 自定义字节流 | `IOTransport` | 对端 `IOTransport` |
| 调试 | 在客户端或服务端外包一层 `LoggingTransport` | 同左 |
| 旧远程 HTTP | `NewSSEHandler` | `SSEClientTransport` |
| 新远程 HTTP | `NewStreamableHTTPHandler` | `StreamableClientTransport` |

---

## 常见错误

- `Server.Run`**只能搭配「持久、已就绪」的 Transport**（如 `StdioTransport`、单会话场景下的内存管脚等）。  
- **不要**对 `SSEServerTransport` 调用 `Run`：`SSEServerTransport` 必须来自某次 **HTTP GET**，由 `SSEHandler` 或你的路由创建并 `Connect`。  
- 究竟是用Run 还是 Connect，按照上边例子的用法就OK了。
