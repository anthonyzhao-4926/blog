---
title: Content
date: 2026-03-29
tags: [go, mcp, ai]
column: golang-mcp
order: 12
viewable: true
---

> 本文无需系统浏览，涉及到的部分会通过链接引用到这里

Content 是一个接口，但是接口中有一个非导出方法，也就意味着只能使用包提供的实现了。包提供的可使用的内容如下

| 实现类型 | 典型用途 |
| --- | --- |
| TextContent | 纯文本 |
| ImageContent | Base64 图片 + MIME |
| AudioContent | Base64 音频 + MIME |
| ResourceLink | 引用资源 URI，主体可不内联 |
| EmbeddedResource | 内联资源正文（文本或二进制） |
| ToolUseContent | 助手请求调用工具（**主要用于采样**） |
| ToolResultContent | 工具调用结果（**主要用于采样**，`role` 多为 `user`） |

**使用场景提示（SDK 反序列化策略）：**

- `PromptMessage`：允许上述各类 `Content`（含 `resource` / `resource_link`）。  
- `SamplingMessage`：通常仅 `text`、`image`、`audio`、`tool_use`、`tool_result`（不含资源类）。  
- `ToolResultContent.Content`**嵌套块**：仅 `text`、`image`、`audio`、`resource_link`、`resource`（与 `CallToolResult.content` 规则一致）。

---

## TextContent

纯文本内容；协议里最常用的一类。

| 字段名 | 作用 |
| --- | --- |
| Text | 文本正文。 |
| Annotations | 可选注解（受众、优先级、修改时间等，见资源规范中的 annotations）。 |

---

## ImageContent

图像内容；**Data 为原始字节**，在 JSON 中按 Base64 与 `mimeType` 传输。

| 字段名 | 作用 |
| --- | --- |
| Data | 图片数据（编码后以 Base64 出现在 JSON 的 `data` 字段）。 |
| MIMEType | 媒体类型（如 `image/png`），对应 JSON `mimeType`。详见[MIME 类型](../%E5%8F%82%E8%80%83/MIME%20%E7%B1%BB%E5%9E%8B.md) |
| Annotations | 可选注解。 |

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

---

## AudioContent

音频内容；与图片类似，**Data + MIMEType**。

| 字段名 | 作用 |
| --- | --- |
| Data | 音频数据（JSON 中 Base64 的 `data`）。 |
| MIMEType | 媒体类型（如 `audio/wav`）。[MIME 类型](../%E5%8F%82%E8%80%83/MIME%20%E7%B1%BB%E5%9E%8B.md) |
| Annotations | 可选注解。 |

---

## ResourceLink

指向 MCP 资源的**链接/元信息**，不强制在消息里内联全文；客户端可按 URI 再 `resources/read`。

| 字段名 | 作用 |
| --- | --- |
| URI | 资源 URI。 |
| Name | 程序侧名称。 |
| Title | 面向展示的标题。 |
| Description | 资源说明。 |
| MIMEType | 已知时的 MIME 类型。[MIME 类型](../%E5%8F%82%E8%80%83/MIME%20%E7%B1%BB%E5%9E%8B.md) |
| Size | 可选，资源大小（字节）。 |
| Meta | 扩展元数据（`_meta`）。 |
| Annotations | 可选注解。 |
| Icons | 可选图标列表。 |

---

## EmbeddedResource

**内嵌**资源：把 `ResourceContents` 直接放进消息（文本或 blob），适合 prompt 里附带文档片段等。

| 字段名 | 作用 |
| --- | --- |
| Resource | 资源载荷（URI、MIME、正文文本或二进制），见下表 ResourceContents。 |
| Annotations | 可选注解。 |

---

## ResourceContents

表示一份资源内容

| 字段名 | 作用 |
| --- | --- |
| URI | 资源 URI。 |
| MIMEType | MIME 类型（可选）。[MIME 类型](../%E5%8F%82%E8%80%83/MIME%20%E7%B1%BB%E5%9E%8B.md) |
| Text | 文本类资源内容，通常是字符串文本，而不是文本文件。 |
| Blob | 使用 `Blob` 的场景**真正的二进制文件**：图片、PDF、Office、压缩包、音视频片段、字体等；不宜或不能可靠表示为 UTF-8 字符串。**需要字节级保真**：避免文本编码、换行规范化等破坏原始字节。**通用「读文件」**：服务端按字节读取未知类型文件时，常见做法是 `{ URI, Blob: data }`，并视情况填写 `mimeType`。 |

示例详见[Resources 知识库](Resources%20%E7%9F%A5%E8%AF%86%E5%BA%93.md)

---

## ToolUseContent

助手侧发出的 **「要调用哪个工具、参数是什么」**；与 `ToolResultContent` 通过 **ID** 配对。SDK 注释标明：**仅适用于采样消息语境**（如 `CreateMessageParams` / 带 tools 的返回）。

| 字段名 | 作用 |
| --- | --- |
| ID | 本次工具调用的唯一 id，用于与 `ToolResultContent` 对应。 |
| Name | 要调用的工具名。 |
| Input | 工具参数（JSON 对象）。 |

说明：该类型 **无** `Annotations` 字段（与 wire 格式一致）。

---

## ToolResultContent

**工具执行结果**；通常出现在 `role`**为**`user` 的采样消息里，`ToolUseID` 对应先前的 `ToolUseContent.ID`。

| 字段名 | 作用 |
| --- | --- |
| ToolUseID | 对应哪一次 `tool_use` 的结果。 |
| Content | 非结构化结果，由若干 **嵌套** `Content` 块组成（允许类型见上文总览）。 |
| StructuredContent | 可选的结构化结果（任意 JSON 值）。 |
| IsError | 是否为错误结果。 |
| Meta | 扩展元数据（`_meta`）。 |

说明：该类型 **无** `Annotations` 字段（与 wire 格式一致）。

---
