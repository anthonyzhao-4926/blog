---
title: Resources 知识库
date: 2026-03-29
tags: [go, mcp, ai]
column: golang-mcp
order: 13
viewable: true
---

MCP 所支持的 Resources 其实就是一个用来检索的知识库。为了测试，我让AI随便生成了一个MySQl表的描述。[[mysql_settlement_line_demo]]

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

| **Scheme** | **用途与注意** |
| --- | --- |
| `https://` | 表示**客户端自己能直接从 Web 拉**的资源时更合适； |
| `file://` | 类似文件的资源，**不必**对应真实磁盘；目录等可用 [XDG MIME](https://specifications.freedesktop.org/shared-mime-info-spec/0.14/ar01s02.html#id-1.3.14)如 `inode/directory` |
| `git://` | Git 集成场景 |
| **自定义** | 须符合 [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986)，并考虑上面各 scheme 的指导 |

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
| `Annotations` | 给客户端用的可选注解（如展示、行为提示等）。 |
| `Description` | 资源含义说明，便于客户端/模型理解“这是什么”。 |
| `MIMEType` | 资源内容的 MIME 类型。[[MIME 类型]] |
| `Name` | 逻辑/程序侧名称；旧版或缺 `title` 时可作展示名。 |
| `Size` | 原始内容字节数（编码/分词前）；便于展示大小与估算上下文。 |
| `Title` | 面向 UI/终端用户的可读标题；缺省则用 `name` 展示。 |
| `URI` | 资源唯一标识（如 `file://`、`https://` 等协议 URI）。 |
| `Icons` | 资源可选图标列表。 |

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
| MIMEType | MIME 类型（可选）。[[MIME 类型]] |
| Text | 文本类资源内容，通常是字符串文本，而不是文本文件。 |
| Blob | 使用 `Blob` 的场景**真正的二进制文件**：图片、PDF、Office、压缩包、音视频片段、字体等；不宜或不能可靠表示为 UTF-8 字符串。**需要字节级保真**：避免文本编码、换行规范化等破坏原始字节。**通用「读文件」**：服务端按字节读取未知类型文件时，常见做法是 `{ URI, Blob: data }`，并视情况填写 `mimeType`。 |

将返回内容改为Bolb看下

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
