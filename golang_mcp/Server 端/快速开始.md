---
title: 快速开始
date: 2026-04-01
tags: [go, mcp, ai]
column: golang-mcp
order: 1
viewable: true
---

# 一个小例子

先别管三七二十一，先写一个简单的 MCP，搞出来看下啥效果。

```go
// MCP 服务端：hello_world 工具，根据 user_name 返回问候语。
package main

import (
    "context"
    "log"

    "github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
    // new 一个 server
    server := mcp.NewServer(&mcp.Implementation{
        Name:    "hello-world",
        Version: "0.1.0",
    }, nil)

    // 注册 hello_world 工具，分为工具元信息和 handler 两个部分
    mcp.AddTool(server, &mcp.Tool{
        Name:        "hello_world", // 工具名称
        Description: "根据 user_name 返回问候语", // 工具描述
    }, helloWorldTool) 

    // 启动 server
    if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
        log.Printf("server stopped: %v", err)
    }
}

// 输入参数结构体
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

使用如下命令启动服务，需要安装Node.Js

```shell
npx @modelcontextprotocol/inspector go run ./cmd/mcp-hello-world 
# 替换你自己的代码路径
```

![图片](assets/1774354584007-f9536f31-8dff-4eb8-8da6-2959a1dd9578.png)

![20260324201716_rec_](assets/1774354666188-0e873887-3103-4139-96f2-f02984cdb28a.gif)

# 代码解释

## new 一个server

```shell
server := mcp.NewServer(&mcp.Implementation{
		Name:    "hello-world",
		Version: "0.1.0",
	}, nil)
```

这里使用 `mcp.Implementation` 创建了一个 server。`mcp.Implementation`字段如下

| **字段名** | **含义** |
| --- | --- |
| **Name** | 程序/逻辑标识名，例如包名或服务 ID；没填 `Title` 时 UI 可能拿它当显示名。 |
| **Title** | 给界面和最终用户看的标题，好读易懂，少用领域黑话；可省略。 |
| **Version** | 版本号。 |

其余像 `WebsiteURL`、`Icons` 这类展示字段可有可无，完整定义看 [pkg.go.dev](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp#Implementation)。

## 注册一个工具

```shell
mcp.AddTool(server, &mcp.Tool{
		Name:        "hello_world", // 工具名称
		Description: "根据 user_name 返回问候语", // 工具描述
	}, helloWorldTool) 
```

给我的服务添加一个工具。本框架设计时，工具的元信息和工具的能力即handler是分开的。

`mcp.Tool`是工具的元信息，常用的就三个字段

| 字段名 | 含义 |
| --- | --- |
| Name | 工具名称，客户端靠它发起调用 |
| Description | 工具描述：给人看，也给 AI 理解功能用——AI 靠它决定什么时候该调你的工具 |
| InputSchema | JSON Schema，描述调用工具时期望的参数结构 |

其余 `Annotations`、`Title`、`Icons`、`OutputSchema` 都是展示或进阶场景才用到的，用到再看 [pkg.go.dev](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp#Tool)。

## 工具

```go
func helloWorldTool(ctx context.Context, req *mcp.CallToolRequest, in helloInput) (*mcp.CallToolResult, any, error) {
    text := "Hello World, " + in.UserName
    return &mcp.CallToolResult{
        Content: []mcp.Content{
            &mcp.TextContent{Text: text},
        },
    }, nil, nil
}
```

就是一个正常的函数，函数的签名支持泛型

```go
func(_ context.Context, request *CallToolRequest, input In) (result *CallToolResult, output Out, _ error)
```

`In` 和 `Out` 不是摆设，框架在背后做了不少事：

- 用 `In` 的类型推断生成默认的 input schema；想自定义，在 `mcp.Tool.InputSchema` 里显式传一个覆盖就行
- 把客户端传来的 arguments 自动反序列化填进 `input`，不用自己 `json.Unmarshal`
- 进 handler 之前先按 schema 校验参数，不合法直接在协议层拒掉——不用在业务代码里到处写校验
- `Out` 不是 `any` 时同样推断默认的 output schema；成功路径下，结构化输出会写进结果的 `StructuredOutput`
- 没设置 `result.Content` 时，SDK 会用输出 JSON 填上，方便「只关心返回一个 JSON 对象」的用法
- 返回的 `error` 被当作「工具执行错误」而不是协议错误：SDK 会把描述塞进 content 并把 `IsError` 置为 true，符合 MCP 对工具调用失败的建模

多数场景可以完全无视 `request` 和返回的 `*CallToolResult`，只关心 `input` → `output` / `error` 这条线。甚至 result 直接传 `nil` 都可以——只要你想返回的是 `output` 或 `error`，SDK 会按上面规则自动补全一个有效结果。

只有需要读原始请求元数据、自定义 content、精细控制结果字段时，才需要碰 `request` 或自己构造 `CallToolResult`。

## 启动server

```go
if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
	log.Printf("server stopped: %v", err)
}
```

比较简单，就是 `server.Run()` 一下。

第二个参数是传输方式，本机调试一般用 StdioTransport 就够了，细节在 [MCP 的 Transport](MCP%20的%20Transport.md) 里，那里把每种传输入怎么配都过了一遍。
