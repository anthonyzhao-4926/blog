---
title: golang-mcp
date: 2026-09-08
tags: [go, mcp, ai]
column: golang-mcp
order: 0
viewable: true
---

## golang-mcp

> 官方规范：https://modelcontextprotocol.io
> 使用的 SDK：https://github.com/modelcontextprotocol/go-sdk

用 Go 把 MCP 服务端做出来、跑起来、部署上去。

### 读完能做到什么

**能**：独立把一个内部系统的查询接口做成 MCP Server——定义工具和参数约束、提供资料给模型检索、注册预置提示词、加鉴权、挂到你自己的 HTTP 框架上、远程部署。

**不能**：精通 JSON Schema 的全部写法；搞懂 SSE 的分帧与重连协议细节；写出生产级的 EventStore 实现。这些本专栏只讲到「知道有这么回事、该往哪查」。

### 前置假设

- 会写 Go，看得懂结构体标签和泛型函数。
- 用过至少一个 LLM 客户端（Cursor / Claude Desktop / ApiFox 之类），知道 MCP 大致是干什么的。
- 不需要预先了解 MCP 协议。

### 一条主线

除第一篇的语法示例外，全专栏复用同一个案例：**给公司日志聚合系统做一个 MCP**，提供 `list_services`、`query_logs` 两个工具，再逐步挂上资源、提示词、鉴权。

**下面按顺序读就行**——每篇开头写了前置是哪篇、读完你能做什么，结尾有下一篇的链接。

1. [第一个 MCP](01-第一个MCP.md)——最小结构跑通，在 Inspector 里看到工具
2. [工具的参数](02-工具的参数.md)——换成日志查询案例，把参数写规矩
3. [跑成 HTTP 服务](03-跑成HTTP服务.md)——从 stdio 换成 Streamable HTTP，用 ApiFox 连上
4. [挂到 gin 路由](04-挂到gin路由.md)——不用 gin 的话可以跳过，直接去 06
5. [加一层 Bearer 鉴权](05-加一层Bearer鉴权.md)——只在本机玩的话可以跳
6. [提供 Resources 知识库](06-提供Resources知识库.md)——把字段说明交给模型自己查
7. [注册预置提示词](07-注册预置提示词.md)——把整理好的分析套路固化下来
8. [错误返回与重试](08-错误返回与重试.md)——分清协议错误和业务错误
9. [Streamable HTTP 配置与安全](09-StreamableHTTP配置与安全.md)——**可选**，等要部署到别人能访问的地方再看
10. [SSE 断点续传](10-SSE断点续传.md)——**可选**，等真遇到断线丢消息再看

> 9、10 编在主线末尾而不是单独一个目录，是为了让你回头时不用离开这条路：读完 08 想继续就往 09、10 走，当时跳过了以后再回来，位置也还是这里。

### 只想找某一件事

已经会 MCP、不想按顺序读的话：

| 我想…… | 看这篇 |
| --- | --- |
| 知道 MCP 有哪几种传输、该选哪个 | [Transport 对照表](参考/Transport对照表.md) |
| 搞清泛型 handler 到底帮我做了什么 | [工具签名](参考/工具签名.md) |
| 给参数加枚举、默认值、必填 | [工具的参数](02-工具的参数.md) |
| 把 MCP 挂到已有的 HTTP 框架 | [挂到 gin 路由](04-挂到gin路由.md) |
| 加鉴权 | [加一层 Bearer 鉴权](05-加一层Bearer鉴权.md) |
| 让模型能查背景资料 | [提供 Resources 知识库](06-提供Resources知识库.md) |
| 判断错误该返回哪种类型 | [错误返回与重试](08-错误返回与重试.md) |
| 查错误码含义 | [错误码](参考/错误码.md) |

### 参考卡片

以下不是读物，是查到才用的字典，不用顺序读：

- [Transport 对照表](参考/Transport对照表.md)——九种 transport 各自什么场景，一张表查完
- [工具签名](参考/工具签名.md)——泛型 handler 的签名、SDK 自动做了哪些事
- [错误码](参考/错误码.md)——JSON-RPC 错误码速查
- [go:embed 速查](参考/goembed速查.md)——把模板、图片打进二进制
- [Content](参考/Content.md)——消息里「一段内容」有哪些类型
- [MIME 类型](参考/MIME类型.md)——MIME 是什么、MCP 里常用哪些取值
- [日志系统字段与查询语法](参考/日志系统字段与查询语法.md)——主线案例的测试素材
- [分析日志 Prompt 模板](参考/分析日志Prompt模板.md)——主线案例的提示词正文
