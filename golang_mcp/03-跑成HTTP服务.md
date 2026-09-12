---
title: 跑成 HTTP 服务
date: 2026-03-25
tags: [go, mcp, ai]
column: golang-mcp
order: 3
viewable: true
---

> **读完这篇你能**：把已经写好的 MCP 换成 Streamable HTTP 启动，并用 ApiFox 连上验证。
> **前置**：[工具的参数](02-工具的参数.md)。约 10 分钟。

# 为什么要换

`StdioTransport` 的宿主是「把你的程序当子进程拉起来」，所以只有本机的客户端能用。要让同事连、要部署到服务器，就得暴露一个 HTTP 端点。

MCP 规范里的传输只有两种：**stdio** 和 **Streamable HTTP**。前者管本机，后者管远程——就这么简单。其余的几种类型只是这两种的封装或历史版本，见[Transport 对照表](参考/Transport对照表.md)。

# 改哪里

只改启动那几行。**工具定义、handler、参数结构体，一行都不用动。**

之前是：

```go
if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
	log.Fatal(err)
}
```

现在换成：

```go
// 把 MCP server 包成 http.Handler
handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
	return server
}, nil)

// 按普通 HTTP 服务启动
if err := http.ListenAndServe("127.0.0.1:8000", handler); err != nil {
	log.Fatal(err)
}
```

`NewStreamableHTTPHandler` 的第一个参数是个函数而不是直接的 `*mcp.Server`，因为 HTTP 是有状态的——每次入站请求会现场创建一个 transport 并绑定会话，这个函数负责告诉 handler「该用哪个 server」。只有一个 server 时直接返回它就完了。第二个参数是配置项，先传 `nil`。

# 完整代码

只有 `main` 变了，工具部分沿用[上一篇](02-工具的参数.md)的 `queryLogsInput` / `queryLogsTool`：

```go
// MCP 服务端：query_logs 工具；传输为 Streamable HTTP。
package main

import (
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
		Name:    "log-mcp",
		Version: "0.1.0",
	}, nil)

	// 注册工具：定义见 02-工具的参数.md
	mcp.AddTool(server, &mcp.Tool{
		Name:        "query_logs",
		Description: "按服务名和时间范围查询日志，可筛选日志级别",
		InputSchema: queryLogsInputSchema,
	}, queryLogsTool)

	// 把 MCP server 包装成 http handler
	handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
		return server
	}, nil)

	addr := fmt.Sprintf("%s:%d", host, port)
	log.Printf("streamable HTTP MCP: http://%s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
```

```shell
go run cmd/mcp-log-mcp/main.go
```

到这一步，MCP 服务就可以完全当做一个普通 HTTP 服务来对待了。

# 连上去验证

调试工具换成 [ApiFox](https://apifox.com/)，新版本已支持 MCP 连接，比 Inspector 更适合看 HTTP 这种形态。

![在 ApiFox 里新建 MCP 连接](assets/1774400767510-eededcdc-a039-425b-9fb3-c18cf15b2e14.png)

![连上后调用工具](assets/1774400920066-32a2f083-50c6-403e-8f33-299c08adec3a.gif)

# 两个默认开启的安全开关

因为现在是「一个能被网络访问的 HTTP 端口」，SDK 默认开了两道防线，一般不用管，但值得知道它们在防什么：

- **本地保护**：拒绝 Host 不是本机形态的请求，防 DNS 重绑定（攻击者让自己的域名先解析到公网、再改解析到 `127.0.0.1`，把页面里的请求引到你本机端口）。
- **跨源保护**：校验跨源请求，防「借用登录态」的跨站请求。

另外监听地址建议写 `127.0.0.1` 而不是 `0.0.0.0`——规范的安全建议明确要求本机服务绑回环，别让同网段的其他机器直接扫到。

要自定义这两道防线、或者部署到别的域名下，见[Streamable HTTP 配置与安全](09-StreamableHTTP配置与安全.md)。对外提供服务前一定要加鉴权：[加一层 Bearer 鉴权](05-加一层Bearer鉴权.md)。

---

**现在你能做到**：让 MCP 以 HTTP 服务的形式跑起来，并远程连上调试。

到这里，一个能用的 MCP 有了。

---

**下一篇**：[挂到 gin 路由](04-挂到gin路由.md)——把它挂进你已有的 HTTP 框架。

不用 gin 的话跳过它，直接去[提供 Resources 知识库](06-提供Resources知识库.md)。
