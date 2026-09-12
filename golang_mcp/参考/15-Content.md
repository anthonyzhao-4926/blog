---
title: Content
date: 2026-03-29
tags: [go, mcp, ai]
column: golang-mcp
order: 15
viewable: true
---

> 本文是知识卡,不需要从头读到尾;哪篇文章提到 Content 类型了,再跳过来查对应的那节。

`Content` 是 MCP 里消息内容的公共接口,工具结果、提示词消息、采样消息里的「一段内容」都是它。接口里带一个非导出方法,所以只能用 SDK 提供的实现,一共七种:

| 实现类型              | 干什么用的                                                  |
| ----------------- | ------------------------------------------------------ |
| TextContent       | 纯文本,最常见                                                |
| ImageContent      | Base64 图片 + MIME                                       |
| AudioContent      | Base64 音频 + MIME                                       |
| ResourceLink      | 只给资源的 URI,正文不内联,客户端需要时自己再 `resources/read`             |
| EmbeddedResource  | 直接把资源正文(文本或二进制)内联进消息,比如 prompt 里附带一段文档                 |
| ToolUseContent    | 「要调用哪个工具、参数是什么」,主要用于采样场景                               |
| ToolResultContent | 工具调用的结果,通常以 `user` 角色出现在采样消息里,靠 ID 和 ToolUseContent 配对 |

大部分类型就两个核心字段,完整字段表看 [pkg.go.dev](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp#Content) 就行,这里只讲用的时候容易糊涂的地方:

**ImageContent / AudioContent 是 Data + MIMEType。** Data 放原始字节,序列化时自动按 Base64 编码;MIMEType 是写死的字符串,必须和真实数据一致,不然客户端解码失败。图片的常见用法:

```go
png, err := os.ReadFile("error_analysis_flowchart.png")
if err != nil {
	log.Fatalf("读取 error_analysis_flowchart.png: %v", err)
}

_ = &mcp.ImageContent{
	MIMEType: "image/png",
	Data:     png,
}
```

MIME 的常用取值见 [MIME 类型](16-MIME类型.md)。

**EmbeddedResource 里装的是 `ResourceContents`,最容易搞混的是它跟普通「读文件」的关系。** `ResourceContents` 的正文有两种形态:

- `Text`:字符串文本。注意它装的是「本来就是一段文本」的内容,不一定对应磁盘上的文本文件。
- `Blob`:原始字节。真正的二进制文件——图片、PDF、压缩包、音视频——都得用它,保证字节级保真,不要用文本编码、换行规范化之类的手段去动原始字节。通用「读文件」场景(不知道文件是什么类型)常见做法是 `{ URI, Blob: data }`,能判断类型就顺手填上 `mimeType`。

具体的例子见 [提供 Resources 知识库](../06-提供Resources知识库.md)。

**ToolUseContent 和 ToolResultContent 只在采样消息里出现。** 它们对应的是「助手决定调用工具」和「工具返回结果」这两个回合,靠 ID 配对:ToolResultContent 的 `ToolUseID` 指向 ToolUseContent 的 `ID`。这两个类型与 wire 格式一致,没有 `Annotations` 字段。

# 哪些消息里允许哪些类型

不同消息对 Content 的放行范围不一样,SDK 反序列化时按上下文收:

- `PromptMessage`(提示词):上面七种基本都行。
- `SamplingMessage`(采样):只有 text / image / audio / tool_use / tool_result,不带资源类。
- `ToolResultContent` 内部的嵌套块:text / image / audio / resource_link / resource,和 `CallToolResult.content` 的规则一致。

简单记:提示词最宽松,采样最严格,工具结果介于中间且不含 tool_use。
