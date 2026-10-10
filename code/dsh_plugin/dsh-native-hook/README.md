# dsh-native-hook

第 37 篇《复用 Claude Code 的 hooks》的配套 demo。同一个行为做两遍：

- **A 面**：普通的 Cordis 插件，直接订阅 `tools/pre-execute` 与 `agent/created`。
- **B 面**：把同一条 Claude Code `hooks.json` 交给 `dsh-hooks-claude-code` 桥。

`cordis.patch.yml` 里 A 是活的、B 是注释掉的。换面就改那个文件再跑一次 `./install.sh`。

## A/B 差异表

| 维度 | A：native hook | B：桥接的 CC hook |
| --- | --- | --- |
| 载体 | TypeScript 插件，`ctx.on(...)` | JSON 配置 + `dsh-hooks-claude-code` |
| 阻断方式 | 返回 `{ kind: 'deny', reason }` | 进程 `exit 2` + 往 stderr 写原因 |
| 能要审批吗 | 能（返回 `{ kind: 'ask' }`） | CC 能；**Codex 不能**，它没有 ask |
| `SessionStart` 上下文 | 在 `agent/created` 上注入（serial，被 await） | 挂在同一个事件上、同样 await，只是多一次进程与 JSON 编解码 |
| 审计日志 | 不写 `hook/*`，要自己折 | 自动写 `hook/invoked` + `hook/result` |
| 能改工具参数 | 不能（`PreToolDecision` 没有改写通道） | 不能（`updatedInput` 只解析、不生效） |
| 覆盖的事件 | 全部扩展点 | CC 桥 7 / 30，Codex 桥 5 / 10 |

两个包的 README 都写着「`SessionStart` 是 detached 跑的，可能错过第一个请求」——
本版本的代码不是这样：桥在 `agent/created` 里 `await` 它，桥自己的测试也断言第一个请求
看得到那段上下文。装好以后按 `install.sh` 打印的第 3 步去看一眼。

## 装法

```sh
./install.sh
```

它会先 `pnpm run typecheck` 再 `pnpm run build`。`build.mjs` 走 esbuild，只转译、不求值类型，
所以事件名写错、消息 source 没声明这类问题构建期一声不响，要 `tsc` 才看得见。

## 两个包都别装错的细节

- 桥是**进程级**配置：`configPath` 在装载时读一次，相对路径按启动目录解析，
  不是每个会话各读一份。
- `transcript_path` 永远是空串——持久化 seam 不暴露产物路径，默认会话日志又是
  zstd 压缩的，脚本读不了。依赖 transcript 的 hook 从根上迁不过来。
- 桥不在任何出厂装配里，`packages/bundle/*` 与 `apps/cli/config/` 都不挂它。
