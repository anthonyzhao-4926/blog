---
title: golang-mcp
date: 2026-09-08
tags: [go, mcp, ai]
column: golang-mcp
order: 0
viewable: true
---

## golang-mcp

> 官方文档:https://modelcontextprotocol.io
> 用到的 SDK:https://github.com/modelcontextprotocol/go-sdk

用 Go 写 MCP 服务端的学习笔记。整体思路是「先跑起来,再拆开讲」,大部分文章都带一个能直接跑的小例子。

### 阅读路线(Server 端,按顺序)

1. [快速开始](Server%20端/快速开始.md)——写第一个 MCP:一个工具 + stdio 启动,跑在 Inspector 里看效果
2. [MCP 的 Transport](Server%20端/MCP%20的%20Transport.md)——传输层其实只有 stdio 和 Streamable HTTP 两种,各自怎么配
3. [Streamable HTTP](Server%20端/Streamable%20HTTP.md)——把 MCP 跑成 HTTP 服务,常用配置项和安全开关
4. [端点续传](Server%20端/端点续传.md)——进阶:SSE 断线续传与 EventStore,初学可跳过
5. [配置路由](Server%20端/配置路由.md)——把 MCP handler 挂到 gin 这类框架的路由上
6. [鉴权](Server%20端/鉴权.md)——HTTP 层套一层 Bearer Token
7. [输入限制](Server%20端/输入限制.md)——参数必填、候选值下拉,靠 jsonschema 约束
8. [预置提示词](Server%20端/预置提示词.md)——把常用 prompt 注册成服务端能力,AI 不用再手动粘
9. [Resources 知识库](Server%20端/Resources%20知识库.md)——给模型提供可检索的资料,如数据库字段说明
10. [错误处理](Server%20端/错误处理.md)——协议错误和业务错误的区分,附错误码速查

### 参考

用到再查的知识卡和素材,不用按顺序读:

- [Content](参考/Content.md)——消息里「一段内容」都有哪些类型
- [MIME 类型](参考/MIME%20类型.md)——MIME 是什么、MCP 里常用哪些取值
- [mysql_settlement_line_demo](参考/mysql_settlement_line_demo.md)——Resources 示例用的测试文档
- [分析日志Prompt 模板](参考/分析日志Prompt%20模板.md)——预置提示词示例的模板文件
