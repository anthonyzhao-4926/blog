---
title: go:embed 速查
date: 2026-03-28
tags: [go, mcp, ai]
column: golang-mcp
viewable: true
---

> 本文是知识卡。MCP 里用它嵌提示词模板、流程图这类固定资源，见[注册预置提示词](../07-注册预置提示词.md)。

`//go:embed` 是 Go 1.16 起的编译指令：**在编译时把文件打进可执行文件**，而不是运行时再从磁盘读。部署时不用带着一堆模板文件。

# 三条硬性规则

1. 必须是带 `//` 的注释，且**紧挨着** `import` 和被它修饰的变量。
2. 被修饰的变量类型只能是 `string`、`[]byte` 或 `embed.FS`。
3. 不能嵌入会随构建变化、不可控的路径。

```go
import "embed"

//go:embed error_analysis_prompt.md
var promptFS embed.FS
```

# 三种变量类型

```go
//go:embed hello.txt
var s string          // 单个文件，读成字符串

//go:embed logo.png
var b []byte          // 单个文件，读成字节（图片、二进制用这个）

//go:embed prompts
var dir embed.FS      // 整个目录，用 fs 接口按路径读
```

用 `embed.FS` 读文件：

```go
data, err := promptFS.ReadFile("prompts/a.md")
```

配合 `text/template` 解析：

```go
var tmpl = template.Must(
	template.New("error_analysis_prompt.md").ParseFS(promptFS, "error_analysis_prompt.md"),
)
```

# 注意

- 目录嵌入默认**不含**以 `.` 或 `_` 开头的文件，除非写 `//go:embed all:prompts`。
- 嵌入的内容算进二进制体积，别把几十 MB 的素材塞进去。
- 路径相对**当前 Go 源文件所在目录**，不能用 `../` 跳出模块。
