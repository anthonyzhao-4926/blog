---
title: 第一个 MCP
date: 2026-04-01
tags: [go, mcp, ai]
column: golang-mcp
order: 1
viewable: true
---

> **读完这篇你能**：写一个能跑的 MCP 服务端，并在 Inspector 里调用它的工具。
> **前置**：会 Go。约 10 分钟。

这篇只求跑通，用一个玩具工具（`hello_world`）把服务端的最小结构过一遍。从[下一篇](02-工具的参数.md)起会换成贯穿全专栏的真实案例——日志查询。

# 先看效果

在 MCP Inspector 里看到你的工具，填个名字，它回一句问候：

![Inspector 里看到 hello_world 工具](assets/1774354584007-f9536f31-8dff-4eb8-8da6-2959a1dd9578.png)

![调用效果](assets/1774354666188-0e873887-3103-4139-96f2-f02984cdb28a.gif)

# 完整代码

整篇只有这一个文件。真实项目里通常放在 `cmd/mcp-hello-world/main.go`。

```go
// MCP 服务端：hello_world 工具，根据 user_name 返回问候语。
package main

import (
	"context"
	"log"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	// 建 server
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "hello-world",
		Version: "0.1.0",
	}, nil)

	// 注册工具：元信息和 handler 是分开传入的两部分
	mcp.AddTool(server, &mcp.Tool{
		Name:        "hello_world",
		Description: "根据 user_name 返回问候语",
	}, helloWorldTool)

	// 启动
	if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
		log.Printf("server stopped: %v", err)
	}
}

// 输入参数结构体
type helloInput struct {
	UserName string `json:"user_name" jsonschema:"调用方用户名"`
}

// handler：一个普通函数
func helloWorldTool(ctx context.Context, req *mcp.CallToolRequest, in helloInput) (*mcp.CallToolResult, any, error) {
	text := "Hello World, " + in.UserName
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: text},
		},
	}, nil, nil
}
```

跑起来需要先装 Node.js，Inspector 本身是个 npm 包：

```shell
npx @modelcontextprotocol/inspector go run ./cmd/mcp-hello-world
# 路径换成你自己的
```

# 四段代码分别是什么

## 建 server

`mcp.NewServer` 的第二个参数是 server 级别的能力配置，先填 `nil`。第一个参数 `mcp.Implementation` 是自我描述，常用的只有三个字段：

| 字段 | 含义 |
| --- | --- |
| `Name` | 程序/逻辑标识名，例如包名或服务 ID |
| `Title` | 给界面和最终用户看的标题，可省略 |
| `Version` | 版本号 |

其余 `WebsiteURL`、`Icons` 属于展示字段，用到再看 [pkg.go.dev](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp#Implementation)。

## 注册工具

这个框架把**工具的元信息**和**工具的能力**（handler）拆成了两个参数，这是最值得先记住的设计。

元信息里常用的也是三个字段：

| 字段 | 含义 |
| --- | --- |
| `Name` | 工具名称，客户端靠它发起调用 |
| `Description` | 给人看，**也给模型看**——模型靠它决定什么时候调你的工具 |
| `InputSchema` | JSON Schema，描述期望的参数结构。不填时由 `In` 类型推断，[下一篇](02-工具的参数.md)细讲 |

`Annotations`、`Title`、`Icons`、`OutputSchema` 属于展示或进阶场景，先不管。

`Description` 值得多花点心思：它是模型唯一的选型依据，写清楚「什么情况下该用这个工具」，比写清楚「这个工具是什么」更重要。

## handler

签名长这样，`In` / `Out` 是两个泛型参数：

```go
func(ctx context.Context, req *CallToolRequest, in In) (result *CallToolResult, out Out, _ error)
```

看着参数不少，但框架在背后做了很多事：自动生成 schema、自动反序列化、自动校验、自动填充结果。**多数场景只需要关心 `in` → `out` / `error` 这条线**，`req` 和 `result` 都可以传 `nil`。

完整的自动化行为清单见[工具签名](参考/工具签名.md)。

## 启动

```go
server.Run(context.Background(), &mcp.StdioTransport{})
```

第二个参数是传输方式。`StdioTransport` 适合本机调试——宿主（IDE 之类）把你的程序当子进程拉起来，走标准输入输出通信，不占端口。

MCP 一共就那么几种传输，选型查[Transport 对照表](参考/Transport对照表.md)。部署到服务器要用的 Streamable HTTP 在[第三篇](03-跑成HTTP服务.md)。

---

**现在你能做到**：写出一个 stdio 启动的 MCP 服务端，注册工具并在 Inspector 里验证。

---

**下一篇**：[工具的参数](02-工具的参数.md)——给它换上真实的业务工具，并把参数写规矩。
