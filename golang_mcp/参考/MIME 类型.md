---
title: MIME 类型
date: 2026-03-28
tags: [go, mcp, ai]
column: golang-mcp
order: 16
viewable: true
---

## 是什么

**MIME** 最初指 *Multipurpose Internet Mail Extensions*（多用途互联网邮件扩展），用来在邮件里标明附件是图片、音频还是别的格式。如今更广为人知的名字是 **媒体类型（Media Type）** 或 **内容类型（Content Type）**。

在 HTTP、邮件、以及 **MCP（Model Context Protocol）** 的 JSON 消息里，常用一个 **字符串** 告诉接收方：「接下来的字节/文本应按什么格式解析」。例如 `image/png` 表示 PNG 图像，`text/plain; charset=utf-8` 表示 UTF-8 纯文本。

IANA 维护官方登记表：[Media Types](https://www.iana.org/assignments/media-types/media-types.xhtml)。许多客户端与中间件以「类型 / 子类型 + 参数」的规则做路由与解码。

---

## 基本语法

典型形式：

```latex
type/subtype
type/subtype; parameter=value
```

- **type（大类）**：如 `text`、`image`、`audio`、`video`、`application`、`multipart`、`message` 等。  
- **subtype（子类型）**：如 `plain`、`png`、`json`、`octet-stream`。  
- **parameter（可选）**：分号后键值对，常见 `charset=utf-8`（文本）、`boundary=...`（multipart）等。

**大小写**：类型与子类型在规范上通常按 **小写** 使用；部分历史类型存在大小写混写，许多实现解析时 **不区分大小写**（仍以统一小写为宜）。

**不要太随便造名字**：未在 IANA 注册的类型可以 `application/vnd.*`（厂商扩展）或 `x-*`（历史惯例，不推荐新用），否则互操作性差。

---

## 与 HTTP、`Content-Type` 的关系

在 HTTP 响应（及 multipart 各部分）里，响应头 `Content-Type` 的值就是一个媒体类型字符串，例如：

- `text/html; charset=utf-8`  
- `application/json`  
- `image/jpeg`

浏览器、API 客户端、代理会据此选择解码器、字符集或下载行为。**MCP** 在 JSON 里用字段名 `mimeType`（见 go-sdk 的 `ImageContent`、`AudioContent`、`ResourceContents` 等），语义与 HTTP 的媒体类型字符串一致。

---

## 常见取值（按场景）

### 文本类（`text/*`）

| MIME Type | 说明 |
| --- | --- |
| `text/plain` | 纯文本，常配合 `charset=utf-8` |
| `text/html` | HTML |
| `text/css` | 样式表 |
| `text/markdown` | Markdown（部分环境仍用 `text/x-markdown`，以实际约定为准） |

### 图片（`image/*`，与 MCP `ImageContent` 最相关）

| MIME Type | 说明 |
| --- | --- |
| `image/png` | PNG |
| `image/jpeg` | JPEG（注意：历史上偶见 `image/jpg`，标准子类型是 `jpeg`） |
| `image/gif` | GIF |
| `image/webp` | WebP |
| `image/svg+xml` | SVG（XML 文本，有时用资源文本字段承载而非原始字节块） |

**原则**：`ImageContent.Data` 里的原始字节是什么格式，`MIMEType` 就应声明对应的 `image/*`，否则客户端可能解码错误或拒绝渲染。

### 音频（`audio/*`，与 MCP `AudioContent` 相关）

| MIME Type | 说明 |
| --- | --- |
| `audio/wav` | 常指 WAV（RIFF WAVE） |
| `audio/mpeg` | MP3 等 MPEG 音频 |
| `audio/ogg` | Ogg 容器 |
| `audio/webm` | WebM 中的音频轨等 |

### 结构与二进制载荷（`application/*`）

| MIME Type | 说明 |
| --- | --- |
| `application/json` | JSON 文本 |
| `application/xml` | XML |
| `application/pdf` | PDF |
| `application/octet-stream` | 「未指明的二进制」，下载时常作附件处理 |

### Multipart

`multipart/form-data`、`multipart/mixed` 等用于多块正文，块与块之间由 `boundary` 分隔；在表单上传、邮件中常见。MCP 的 prompt/tool 内容块通常不用 multipart，而是 JSON 内的多个 `Content` 对象。

---

## `charset` 与文本

对 `text/*` 以及部分 `application/*`（如 `application/json` 含文本），若缺省 charset，不同规范/实现的默认可能不同。为减少乱码，**明确写上**`charset=utf-8` 是稳妥做法，例如：

```latex
text/plain; charset=utf-8
```

二进制类型（如 `image/png`）一般**不**需要 charset。
