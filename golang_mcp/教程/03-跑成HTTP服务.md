---
title: Streamable HTTP
date: 2026-03-25
tags: [go, mcp, ai]
column: golang-mcp
order: 3
viewable: true
---

在 [MCP 的 Transport](MCP%20的%20Transport.md) 里我们把传输方式过了一遍,也知道了怎么启动服务。Streamable HTTP 是目前远程部署的主流方式,这里单独拿出来写透一点。

# 一个小例子

```go
// MCP 服务端：hello_world 工具，根据 user_name 返回问候语。传输为 Streamable HTTP。
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

	// 把 MCP server 包装成 http handler
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

到这一步,MCP 服务就完全可以当做一个普通 HTTP 服务来启动了。

```shell
go run cmd/mcp-hello-world/main.go
```

这次换一个更方便的连接工具 [ApiFox](https://apifox.com/),最新版本已支持 MCP 连接。

![图片](assets/1774400767510-eededcdc-a039-425b-9fb3-c18cf15b2e14.png)

![20260325090806_rec_](assets/1774400920066-32a2f083-50c6-403e-8f33-299c08adec3a.gif)

# 代码解释

## 与 stdio 版没差别的部分

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

new 一个 server、注册工具,这些代码和 [快速开始](快速开始.md) 里的完全一样。

## 把 server 包成 http handler

```go
handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
	return server
}, nil)
```

与 stdio 版唯一的区别在这里:对外暴露的不再是进程管道,而是一个 http 服务,所以得先用 `NewStreamableHTTPHandler` 把 MCP server 包成 http.Handler。包好之后就是常规操作,指定 ip:port 启动就行。

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

注意这里监听的是 `127.0.0.1` 而不是 `0.0.0.0`,规范的安全建议里明确要求本机服务绑回环地址,防止被别的机器直接扫到,配合下文的本地保护开关一起用。

# 配置项

`NewStreamableHTTPHandler(getServer, opts)` 的第二个参数 `opts` 平时大多传 nil,真需要调整行为时,常用的是这几个:

| 字段 | 默认 | 作用 |
| --- | --- | --- |
| `JSONResponse` | false | 默认响应走 SSE 流;设为 true 时每次 POST 直接回一个 JSON,方便 curl 调试,但流式能力弱,服务端没法在同一条连接里先推消息再给结果 |
| `Stateless` | false | 默认有状态,客户端要带 `MCP-Session-Id`;设为 true 后每次请求都是临时会话、不校验会话头,适合只有工具调用的轻量部署,代价是服务端主动发起的请求无法使用 |
| `SessionTimeout` | 0 | 会话空闲超过该时长自动关闭,防占资源;零值表示不自动关 |
| `Logger` | nil | 传入 `*slog.Logger` 让 handler 打结构化日志;注意 nil 是**完全不记日志**,不是记到 stdout |
| `EventStore` | nil | 给 SSE 流做事件存储,客户端断线后能带 `Last-Event-ID` 续传,见[端点续传](端点续传.md) |
| `DisableLocalhostProtection` | false | 关掉下面的本地保护开关 |
| `CrossOriginProtection` | 默认策略 | 自定义跨源策略 |

完整字段说明以 [pkg.go.dev](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp#StreamableHTTPOptions) 为准。

## 两个默认开启的安全开关

**本地保护(防 DNS 重绑定)。** 浏览器有同源策略,页面里的 JS 只能请求同源地址。攻击者利用「域名解析结果可以随时变」这一点:让 `evil.com` 先解析到自己的公网服务器(页面从那儿加载,源是 `evil.com`),随后把解析改成 `127.0.0.1`。之后页面里发往 `http://evil.com:8000` 的请求,浏览器眼里仍是同源,实际却打到了你的本机服务上——包括只监听回环地址、没做鉴权的 MCP 端口。handler 默认开启的校验会拒绝 Host 非本机形态的请求,一般不用管它,除非你的部署确实需要别的域名访问本地服务。

**跨源保护(防「借用登录态」的跨站请求)。** 典型场景:用户开着银行后台的 Cookie,又打开了攻击者页面,页面发个请求到银行接口,浏览器自动带上 Cookie,转账就这么被「代执行」了。对 MCP 来说风险类似,默认策略会校验跨源请求,真要自定义可以传 `*http.CrossOriginProtection`。

安全相关更完整的建议(校验 Origin、绑 127.0.0.1、上鉴权)在规范的 [security best practices](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices),鉴权的具体做法单独有一篇[鉴权](鉴权.md)。
