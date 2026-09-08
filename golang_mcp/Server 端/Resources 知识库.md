---
title: Resources 知识库
date: 2026-03-29
tags: [go, mcp, ai]
column: golang-mcp
order: 9
viewable: true
---

MCP 所支持的 Resources 其实就是一个用来检索的知识库。为了测试，为了测试，我让 AI 随便生成了一个 MySQL 表的描述。[mysql_settlement_line_demo](../%E5%8F%82%E8%80%83/mysql_settlement_line_demo.md)

# 一个小例子

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

const demoResourceURI = "file:///demo/mysql-settlement-fields.md"

const demoMarkdownFile = "cmd/mcp-resource-demo/resource/mysql_settlement_line_demo.md"

func readDemoMarkdown(_ context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
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
	s := mcp.NewServer(&mcp.Implementation{Name: "resource-demo", Version: "0.1.0"}, nil)

	s.AddResource(&mcp.Resource{
		URI:         demoResourceURI,
		Name:        "mysql-settlement-fields-demo",
		Title:       "MySQL 结算行字段释义（Demo）",
		Description: "resource/mysql_settlement_line_demo.md：复杂字段含义说明（测试用 Markdown）",
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

为了防止Cursor直接读取当前项目文件，我打开另外一个项目，连接MCP进行测试。

![20260329105506_rec_](assets/1774752933551-8b591172-6353-43f4-98b3-6477c101a729.gif)

![image](assets/1774752981140-8d1a44fd-fe4a-4b6b-89b6-a05882bfc04b.png)

# 代码解释

## 资源URI

```go
const demoResourceURI = "file:///demo/mysql-settlement-fields.md"
```

![image](assets/1774753672584-65da6e81-a495-403e-a124-b6356337ca46.png)

| Scheme | 用途 |
| --- | --- |
| `https://` | 客户端自己能直接从 Web 拉取的资源 |
| `file://` | 类似文件的资源，**不必**对应真实磁盘 |
| `git://` | Git 集成场景 |
| 自定义 | 遵循 [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) 即可 |

## 资源注册

```go
	s.AddResource(&mcp.Resource{
		URI:         demoResourceURI,
		Name:        "mysql-settlement-fields-demo",
		Title:       "MySQL 结算行字段释义（Demo）",
		Description: "resource/mysql_settlement_line_demo.md：复杂字段含义说明（测试用 Markdown）",
		MIMEType:    "text/markdown",
	}, readDemoMarkdown)
```

| 字段名 | 作用 |
| --- | --- |
| `Name` | 逻辑/程序侧名称；缺 `Title` 时可作展示名。 |
| `Title` | 面向 UI 用户的可读标题，缺省则用 `name` 展示。 |
| `Description` | 资源是什么、有什么用，给客户端/模型看的。 |
| `URI` | 资源唯一标识（`file://`、`https://` 等协议 URI）。 |
| `MIMEType` | 资源内容的 MIME 类型。[MIME 类型](../%E5%8F%82%E8%80%83/MIME%20%E7%B1%BB%E5%9E%8B.md) |

`Annotations`、`Size`、`Icons` 这些属于可选补充信息，用到再看 [pkg.go.dev](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp#Resource)。

## 资源处理Handler

```go
func readDemoMarkdown(_ context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
	// 验证 URI
	if req.Params.URI != demoResourceURI {
		return nil, mcp.ResourceNotFoundError(req.Params.URI)
	}
	// 读取资源文件
	data, err := os.ReadFile(demoMarkdownFile)
	if err != nil {
		return nil, fmt.Errorf("读取 %s: %w", demoMarkdownFile, err)
	}
	// 返回资源内容
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
```

| 字段名 | 作用 |
| --- | --- |
| URI | 资源 URI。 |
| MIMEType | MIME 类型（可选）。[MIME 类型](../%E5%8F%82%E8%80%83/MIME%20%E7%B1%BB%E5%9E%8B.md) |
| Text | 字符串文本内容。 |
| Blob | 原始字节内容（二进制文件）。Text 和 Blob 怎么选，见 [Content](../%E5%8F%82%E8%80%83/Content.md) 里的说明。 |

那把返回内容改成 Blob 看下效果

```go
	// 返回资源内容
	return &mcp.ReadResourceResult{
		Contents: []*mcp.ResourceContents{
			{
				URI:      demoResourceURI,
				MIMEType: "text/markdown",
				Blob:     data,
			},
		},
	}, nil
```

![image](assets/1774771400737-e2e46a4b-4b12-4925-9f4a-61cae4789bb8.png)
