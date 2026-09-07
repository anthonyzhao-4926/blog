---
title: Streamable HTTP
date: 2026-03-25
tags: [go, mcp, ai]
column: golang-mcp
order: 4
viewable: true
---

我们在[Go MCP SDK：各 Transport 用法示例](Go%20MCP%20SDK%EF%BC%9A%E5%90%84%20Transport%20%E7%94%A8%E6%B3%95%E7%A4%BA%E4%BE%8B.md)中学习了各种MCP 支持的Transport，也知道了如何启动服务。Streamable HTTP将会作为未来常用的Transport，这里再举例说明，同时描述更多细节。

# 一个小例子

```go
// MCP 服务端：hello_world 工具，根据 user_name 返回问候语。传输为 Streamable HTTP（见 docs/mcp-go-transport-examples.md §7）。
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	const (
		host = "127.0.0.1"
		port = 8000
	)
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "hello-world",
		Version: "0.1.0",
	}, nil)

	// 注册 hello_world 工具
	mcp.AddTool(server, &mcp.Tool{
		Name:        "hello_world",
		Description: "根据 user_name 返回问候语",
	}, helloWorldTool)

	// http 的 handler
	handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
		return server
	}, nil)

	addr := fmt.Sprintf("%s:%d", host, port)
	log.Printf("streamable HTTP MCP: http://%s", addr)
	// 启动http服务，注册http handler
	err := http.ListenAndServe(addr, handler)
	if err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}

type helloInput struct {
	UserName string `json:"user_name" jsonschema:"调用方用户名"`
}

func helloWorldTool(ctx context.Context, req *mcp.CallToolRequest, in helloInput) (*mcp.CallToolResult, any, error) {
	text := "Hello World, " + in.UserName
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: text},
		},
	}, nil, nil
}
```

现在我们就完全可以把mcp 服务当做一个 http 服务来启动了

```go
go run cmd/mcp-hello-world/main.go
```

这次我们换一个更方便的连接工具 [api fox](https://apifox.com/)，最新版本已支持MCP连接

![图片](assets/1774400767510-eededcdc-a039-425b-9fb3-c18cf15b2e14.png)

![20260325090806_rec_](assets/1774400920066-32a2f083-50c6-403e-8f33-299c08adec3a.gif)

# 代码解释

## 没变的代码

```go
    server := mcp.NewServer(&mcp.Implementation{
		Name:    "hello-world",
		Version: "0.1.0",
	}, nil)

	// 注册 hello_world 工具
	mcp.AddTool(server, &mcp.Tool{
		Name:        "hello_world",
		Description: "根据 user_name 返回问候语",
	}, helloWorldTool)
```

new 一个 server, 注册工具，这些代码都与原来一样。

## 将server注入到http handler

```go
handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
	return server
}, nil)
```

现在MCP对外提供服务的是一个http 服务，需要把 MCP server 封装为一个 http 的 handler。然后正常指定ip端口启动 http 服务就可以了。也还挺简单的。

```go
const (
	host = "127.0.0.1"
	port = 8000
)

addr := fmt.Sprintf("%s:%d", host, port)
log.Printf("streamable HTTP MCP: http://%s", addr)
// 启动http服务，注册http handler
err := http.ListenAndServe(addr, handler)
if err != nil {
	log.Fatalf("server stopped: %v", err)
}
```

# 细节扩展

## StreamableHTTPOptions

将MCP server 注入到 http handler 时，调用的方法签名如下

```go
func NewStreamableHTTPHandler(getServer func(*http.Request) *Server, opts *StreamableHTTPOptions) *StreamableHTTPHandler
```

第一个参数上边已经说过了，第二个参数可选配置，虽然说大部分不用太关心，但是也还是了解一下吧。详见[mcp-streamable-http-options](mcp-streamable-http-options.md)
