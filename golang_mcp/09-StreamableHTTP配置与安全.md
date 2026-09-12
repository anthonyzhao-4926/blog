---
title: Streamable HTTP 配置与安全
date: 2026-03-25
tags: [go, mcp, ai]
column: golang-mcp
order: 9
viewable: true
---

> **这篇不影响主线。** 等你要把 MCP 部署到别人能访问的地方、或者要调 handler 行为时再看。

# 配置项

`NewStreamableHTTPHandler(getServer, opts)` 的第二个参数平时大多传 `nil`，需要调行为时常用这几个：

| 字段 | 默认 | 作用 |
| --- | --- | --- |
| `JSONResponse` | false | 默认响应走 SSE 流；设为 true 时每次 POST 直接回一个 JSON，方便 curl 调试，但流式能力弱——服务端没法在同一条连接里先推消息再给结果 |
| `Stateless` | false | 默认有状态，客户端要带 `MCP-Session-Id`；设为 true 后每次请求都是临时会话、不校验会话头，适合只有工具调用的轻量部署，代价是服务端主动发起的请求无法使用 |
| `SessionTimeout` | 0 | 会话空闲超过该时长自动关闭，防占资源；零值表示不自动关 |
| `Logger` | nil | 传入 `*slog.Logger` 让 handler 打结构化日志。注意 nil 是**完全不记日志**，不是记到 stdout |
| `EventStore` | nil | 给 SSE 流做事件存储，客户端断线后能带 `Last-Event-ID` 续传，见 [SSE 断点续传](10-SSE断点续传.md) |
| `DisableLocalhostProtection` | false | 关掉下面的本地保护开关 |
| `CrossOriginProtection` | 默认策略 | 自定义跨源策略 |

完整字段说明以 [pkg.go.dev](https://pkg.go.dev/github.com/modelcontextprotocol/go-sdk/mcp#StreamableHTTPOptions) 为准。

# 两个默认开启的安全开关

这两个开关默认就是开的，一般不用管。但你要部署到特殊环境、发现请求被莫名拒掉时，得知道是它们在拦。

## 本地保护：防 DNS 重绑定

浏览器有同源策略，页面里的 JS 只能请求同源地址。攻击者利用「域名解析结果可以随时变」这一点：

1. 让 `evil.com` 先解析到自己的公网服务器，页面从那儿加载——页面眼里自己的源是 `evil.com`。
2. 随后把 `evil.com` 的解析改成 `127.0.0.1`。
3. 页面里再发往 `http://evil.com:8000` 的请求，浏览器眼里仍是同源，实际却打到了你的本机服务上。

这其中包括只监听回环地址、又没做鉴权的 MCP 端口——攻击者就这样绕过了「只绑 127.0.0.1 就安全」的假设。

handler 默认开启的校验会**拒绝 Host 不是本机形态的请求**。一般不用管它，除非你的部署确实需要别的域名访问本地服务。

## 跨源保护：防「借用登录态」的跨站请求

典型场景：用户开着银行后台的 Cookie，又打开了攻击者页面；页面发个请求到银行接口，浏览器自动带上 Cookie，转账就被「代执行」了。

对 MCP 来说风险类似。默认策略会校验跨源请求，真要自定义可以传 `*http.CrossOriginProtection`。

# 部署检查清单

对外提供服务前，这几条挨个过一遍：

- [ ] 监听地址是 `127.0.0.1` 还是 `0.0.0.0`？只有确实要对公网提供服务时才用后者。
- [ ] 加鉴权了吗？见[加一层 Bearer 鉴权](05-加一层Bearer鉴权.md)。
- [ ] 需要多实例吗？需要的话 `EventStore` 得换成 Redis 之类的共享实现，见 [SSE 断点续传](10-SSE断点续传.md)。
- [ ] 配 `SessionTimeout` 了吗？零值表示会话永不自动关闭，长期运行会积压。

安全方面更完整的规范建议见 [security best practices](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices)。

---

**下一篇**：[SSE 断点续传](10-SSE断点续传.md)——**可选**，真遇到断线丢消息再看。
