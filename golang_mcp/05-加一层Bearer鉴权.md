---
title: 加一层 Bearer 鉴权
date: 2026-03-30
tags: [go, mcp, ai]
column: golang-mcp
order: 5
viewable: true
---

> **读完这篇你能**：给 MCP 的 HTTP 端点套一层 Bearer Token 校验。
>
> **前置**：[跑成 HTTP 服务](03-跑成HTTP服务.md) 或 [挂到 gin 路由](04-挂到gin路由.md)。

# 为什么单独立一篇

MCP 本身没有「鉴权」这个协议能力——因为一旦跑在 HTTP 上，它就是个普通 HTTP 服务，**鉴权是 HTTP 层的事**。

这件事单独立一篇只是因为太容易被跳过：本地调试时谁都不想配 token，等到部署上线，端口就裸着了。加了鉴权的代码一共十来行，早点加。

# 完整代码

工具本身不是重点，这里用一个 `ping` 来验证「身份已生效」：

```go
// MCP Streamable HTTP 示例：在交给 MCP handler 之前校验 Bearer Token（鉴权层与协议层分离）。
package main

import (
	"context"
	"crypto/subtle"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// 未设置 MCP_AUTH_TOKEN 时使用该占位值，仅便于本地试跑；生产环境必须设置强随机密钥。
const defaultDemoToken = "demo-change-me"

type pingToolOutput struct {
	OK string `json:"ok" jsonschema:"状态"`
}

func pingTool(_ context.Context, _ *mcp.CallToolRequest, _ any) (*mcp.CallToolResult, pingToolOutput, error) {
	return nil, pingToolOutput{OK: "authenticated"}, nil
}

// bearerAuth 要求请求头 Authorization: Bearer <token>，与 MCP_AUTH_TOKEN 一致。
func bearerAuth(expected string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if expected == "" {
			http.Error(w, "server misconfigured: empty auth token", http.StatusInternalServerError)
			return
		}
		raw := r.Header.Get("Authorization")
		const prefix = "Bearer "
		if !strings.HasPrefix(raw, prefix) {
			w.Header().Set("WWW-Authenticate", `Bearer realm="mcp"`)
			http.Error(w, "missing or invalid Authorization scheme", http.StatusUnauthorized)
			return
		}
		got := raw[len(prefix):]
		if len(got) != len(expected) || subtle.ConstantTimeCompare([]byte(got), []byte(expected)) != 1 {
			w.Header().Set("WWW-Authenticate", `Bearer realm="mcp"`)
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	token := strings.TrimSpace(os.Getenv("MCP_AUTH_TOKEN"))
	if token == "" {
		token = defaultDemoToken
		log.Printf("警告: 未设置 MCP_AUTH_TOKEN，使用内置演示 token，生产环境请勿如此。")
	}

	srv := mcp.NewServer(&mcp.Implementation{Name: "log-mcp", Version: "0.1.0"}, nil)
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "ping",
		Description: "鉴权通过后调用，用于验证身份已生效",
	}, pingTool)

	mcpHandler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return srv }, nil)

	// 关键就这一行：在 mcpHandler 外面再包一层
	handler := bearerAuth(token, mcpHandler)

	addr := "127.0.0.1:8000"
	log.Printf("MCP Streamable HTTP (with Bearer auth) on http://%s/", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
```

![带上 token 后调用成功](assets/1774831919870-af4c2851-c3c9-4eca-b581-16aedd2102b7.gif)

# 关键就一行

```go
handler := bearerAuth(token, mcpHandler)
```

因为 MCP handler 本身就是个 `http.Handler`，包一层中间件即可——每个请求都会先过鉴权，不通过就根本进不到 MCP 协议层，不会产生任何 MCP 消息。

这也是为什么鉴权失败的表现是 HTTP 401，而不是 MCP 的某个错误码。客户端看到的是连接层面的失败。

# 为什么要用 `ConstantTimeCompare`

普通 `got != expected` 在逐字节比较时，往往发现第一个不同的字节就返回，**比较耗时和「第几个字节错了」相关**。攻击者大量尝试时，理论上能从响应时间推测出前缀猜对了几位。`subtle.ConstantTimeCompare` 在长度相同时按固定流程比较，堵掉这个侧信道；前面的长度判断则保证它不会被用在长度不同的输入上。

对 demo 来说 `==` 也常被接受，这里用 `subtle` 只是偏稳妥的写法。

# 需要 OAuth 的话

上面是最简单的静态 token。如果对方是第三方应用、要走标准的 OAuth 授权流程，SDK 提供了两个包：

- [`github.com/modelcontextprotocol/go-sdk/auth`](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/auth)——OAuth 相关的原语。
- [`github.com/modelcontextprotocol/go-sdk/oauthex`](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/oauthex)——OAuth 协议的扩展，比如 ProtectedResourceMetadata。

内部服务到内部服务（也就是主线案例这种）用静态 Bearer 就够了，不必上 OAuth。

---

**下一篇**：[提供 Resources 知识库](06-提供Resources知识库.md)——把字段说明交给模型自己查。
