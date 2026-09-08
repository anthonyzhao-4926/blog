---
title: MIME 类型
date: 2026-03-28
tags: [go, mcp, ai]
column: golang-mcp
order: 11
viewable: true
---

MIME 最初是 *Multipurpose Internet Mail Extensions*(多用途互联网邮件扩展),用来在邮件里标明附件是什么格式。今天更常见的叫法是**媒体类型(Media Type)**或**内容类型(Content Type)**:一段字节/文本该按什么格式解析,靠一个字符串说清楚,`image/png` 是 PNG 图片,`text/plain; charset=utf-8` 是 UTF-8 纯文本。IANA 维护着官方登记表:[Media Types](https://www.iana.org/assignments/media-types/media-types.xhtml)。

# 语法

```text
type/subtype
type/subtype; parameter=value
```

`type` 是大类(text、image、audio、video、application…),`subtype` 是子类(plain、png、json…),分号后面是可选参数,最常见的是 `charset=utf-8`。规范上按小写用;解析器大多不区分大小写。另外别随便造名字——没注册的类型可以用 `application/vnd.*` 这类厂商扩展,`x-*` 是历史惯例、新代码不推荐。

# 和 HTTP 的关系

HTTP 的 `Content-Type` 响应头就是媒体类型字符串,浏览器、代理、API 客户端都靠它决定怎么解码。MCP 在 JSON 里用 `mimeType` 字段表达同一件事(go-sdk 的 `ImageContent`、`AudioContent`、`ResourceContents` 等),语义一致。

# MCP 里常用的取值

图片类(配 `ImageContent`,最常见):

| MIME Type | 说明 |
| --- | --- |
| `image/png` | PNG |
| `image/jpeg` | JPEG(注意标准子类是 jpeg,不是 jpg) |
| `image/gif` | GIF |
| `image/webp` | WebP |
| `image/svg+xml` | SVG 本质是 XML 文本,有时走文本字段而不是原始字节 |

音频类(配 `AudioContent`):`audio/wav`(WAV)、`audio/mpeg`(MP3)、`audio/ogg`、`audio/webm`。

文本与数据类(配 `TextContent` / 资源):`text/plain`、`text/markdown`、`text/html`、`application/json`、`application/pdf`、`application/octet-stream`(未指明的二进制)。

规则很简单:`ImageContent.Data` 里的字节是什么格式,MIMEType 就声明对应的 `image/*`,否则客户端解码失败或拒渲染。

# charset 与文本

`text/*` 和部分文本型 `application/*` 缺省 charset 时,不同实现的默认值可能不一样。想稳就显式写上 `charset=utf-8`:

```text
text/plain; charset=utf-8
```

二进制类型(如 `image/png`)不需要 charset。
