---
title: 提供 Resources 知识库
date: 2026-03-29
tags: [go, mcp, ai]
column: golang-mcp
order: 6
viewable: true
---

> **读完这篇你能**：把一份说明文档注册成 Resource，让模型自己检索。
> **前置**：[工具的参数](02-工具的参数.md)。

# 为什么需要它

主线案例走到这里，`query_logs` 已经能用了，但模型还是得猜：

- `time_range` 到底能写 `30m` 还是 `30 minutes`？
- `log_levels` 里 `error` 包含 `fatal` 吗？
- 查不到日志是服务名拼错了，还是这段时间真没有？

这些问题的答案**不在参数 schema 里，也不是一次函数调用能返回的**。它们是背景知识。

三个选项：

| 做法 | 问题 |
| --- | --- |
| 全部写进 `Tool.Description` | 描述会膨胀到几百字，挤占上下文，而且每个工具都要重复一遍 |
| 让用户自己贴文档 | 每次都要贴，贴漏了模型就开始瞎猜 |
| **注册成 Resource** | 模型按需取用，只在需要时占用上下文 |

Resource 就是 MCP 提供的第三个能力：**一份带 URI 的资料，模型可以自己决定什么时候去读。**

# 完整代码

素材是一份日志系统的字段与查询语法说明：[日志系统字段与查询语法](参考/日志系统字段与查询语法.md)。

```go
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const demoResourceURI = "file:///docs/log-query-syntax.md"

const demoMarkdownFile = "cmd/mcp-log-mcp/resource/log-query-syntax.md"

func readDemoMarkdown(_ context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
	// 校验 URI：不是我要的那个资源，就明确说「没找到」
	if req.Params.URI != demoResourceURI {
		return nil, mcp.ResourceNotFoundError(req.Params.URI)
	}
	data, err := os.ReadFile(demoMarkdownFile)
	if err != nil {
		return nil, fmt.Errorf("读取 %s: %w", demoMarkdownFile, err)
	}
	return &mcp.ReadResourceResult{
		Contents: []*mcp.ResourceContents{
			{
				URI:      demoResourceURI,
				MIMEType: "text/markdown",
				Text:     string(data),
			},
		},
	}, nil
}

func main() {
	s := mcp.NewServer(&mcp.Implementation{Name: "log-mcp", Version: "0.1.0"}, nil)

	// 注册资源：元信息 + handler，和工具是一个套路
	s.AddResource(&mcp.Resource{
		URI:         demoResourceURI,
		Name:        "log-query-syntax",
		Title:       "日志查询语法说明",
		Description: "日志系统支持的 time_range 写法、日志级别含义与建议排查顺序",
		MIMEType:    "text/markdown",
	}, readDemoMarkdown)

	handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return s }, nil)
	addr := "127.0.0.1:8000"
	log.Printf("MCP Streamable HTTP listening on http://%s/", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
```

> 测试时建议换一个项目打开 Cursor 再连——否则 Cursor 可能直接读你当前项目的文件，看不出资源到底有没有生效。

![模型自己取用资源](assets/1774752933551-8b591172-6353-43f4-98b3-6477c101a729.gif)

![调用效果](assets/1774752981140-8d1a44fd-fe4a-4b6b-89b6-a05882bfc04b.png)

# 资源 URI 怎么写

```go
const demoResourceURI = "file:///docs/log-query-syntax.md"
```

URI 是资源的唯一标识。**注意它不需要对应真实磁盘路径**——上面这个 URI 和实际文件路径完全无关，`file://` 只是个约定俗成的 scheme。

| Scheme | 用途 |
| --- | --- |
| `https://` | 客户端自己能直接从 Web 拉取的资源 |
| `file://` | 类文件资源，**不必**对应真实磁盘 |
| `git://` | Git 集成场景 |
| 自定义 | 遵循 [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) 即可 |

![URI 在客户端里的呈现](assets/1774753672584-65da6e81-a495-403e-a124-b6356337ca46.png)

# 注册资源的字段

```go
s.AddResource(&mcp.Resource{ ... }, readDemoMarkdown)
```

| 字段 | 作用 |
| --- | --- |
| `Name` | 逻辑/程序侧名称；缺 `Title` 时可作展示名 |
| `Title` | 面向 UI 用户的可读标题 |
| `Description` | 资源是什么、有什么用——**模型靠它决定要不要读** |
| `URI` | 资源唯一标识 |
| `MIMEType` | 资源内容的类型，见 [MIME 类型](参考/MIME类型.md) |

`Annotations`、`Size`、`Icons` 属于可选补充信息，用到再看 [pkg.go.dev](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp#Resource)。

`Description` 的地位和 `Tool.Description` 一样重要：写得含糊，模型就不知道该在什么时候来读它。

# handler 返回什么

```go
return &mcp.ReadResourceResult{
	Contents: []*mcp.ResourceContents{
		{URI: demoResourceURI, MIMEType: "text/markdown", Text: string(data)},
	},
}, nil
```

| 字段 | 作用 |
| --- | --- |
| `URI` | 资源 URI |
| `MIMEType` | MIME 类型 |
| `Text` | 字符串文本内容 |
| `Blob` | 原始字节内容（二进制文件） |

`Text` 和 `Blob` 二选一，怎么选见 [Content](参考/Content.md)。把返回内容改成 `Blob` 试试——内容一样能取到：

```go
return &mcp.ReadResourceResult{
	Contents: []*mcp.ResourceContents{
		{URI: demoResourceURI, MIMEType: "text/markdown", Blob: data},
	},
}, nil
```

![改用 Blob 返回](assets/1774771400737-e2e46a4b-4b12-4925-9f4a-61cae4789bb8.png)

# 资源不存在时怎么办

看上面 handler 的第一段：

```go
if req.Params.URI != demoResourceURI {
	return nil, mcp.ResourceNotFoundError(req.Params.URI)
}
```

**用 `mcp.ResourceNotFoundError`，不要用 `fmt.Errorf`。** 它带标准错误码 `-32002`，并把请求的 URI 放进 `data.uri`，客户端才能区分「这个资源不存在」和「服务端读文件失败了」。这两种情况客户端该做的事完全不同。

# 什么时候该用 Resource

一个简单的判断：**信息是不是「查一次能复用很久」的背景知识？**

- 是 → Resource（字段说明、配置约定、业务规则、接口返回格式）
- 不是 → Tool（每次都要按参数现算的，比如查这段时间的日志）

Resource 是只读的，客户端不能通过它改任何东西。

---

**下一篇**：[注册预置提示词](07-注册预置提示词.md)——把整理好的分析套路固化下来。
