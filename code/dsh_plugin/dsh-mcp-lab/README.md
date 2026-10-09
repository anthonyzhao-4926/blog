# dsh-mcp-lab

把两台 MCP 服务器接进模型的装配包。配套文章：[接入 MCP 服务](../../../dsh%20插件开发学习/29-接入%20MCP%20服务.md)

这个包里没有 `src/`——接一台 MCP 服务器不需要写插件，只要一条配置项。

## 装

```sh
./install.sh
```

## 换成你自己的服务器

`cordis.patch.yml` 里两条配置项，改这几个字段就行：

- `serverName`：工具名前缀，工具会以 `mcp__<serverName>__<工具名>` 出现。**改名等于改工具名**——会话历史与权限规则会跟着失效。取值 `[A-Za-z0-9_-]{1,32}`，一个注册作用域内唯一。
- `transport`：本地程序用 `stdio`（配 `command` / `args` / `env` / `cwd`），远端服务用 `streamable-http`（配 `url` / `headers`）。
- 凭据一律写成 `!!js process.env.XXX` 或模板字符串，不要写进文件。

## 验证

```sh
# 装配对不对
dsh --profile test --dump-config | grep -A6 'id: mcp-github'

# 起一次会话，看工具列表
dsh --profile test "列一下你现在能用哪些工具，只看 mcp__ 开头的"
```

## 三条值得亲手试一下的行为

1. **命名空间共存**：如果两台服务器都提供一个叫 `search` 的工具，它们会分别以 `mcp__github__search` 和 `mcp__web__search` 并存，不会打架。
2. **启动失败是可选的严格**：默认 `failOnStartupError: false`，连不上就只是"这台服务器的工具不出现 + 日志一条错"；改成 `true` 则启动直接中止。
3. **断开后的表现**：进程崩了会自动重连（500 ms 起、逐次翻倍、上限 30 s）。中断期间**最后已知的工具仍然列在那里，但调用会失败**；连续失败十次后工具被移除、重连停止，直到重载配置或重启。服务器稳定连一段时间后，这个失败计数会重置。
